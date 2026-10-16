import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// 알림 보내기 (웹 푸시) — 화면이 '방금 이런 일이 있었어요'라고 알려 주면 서버가 확인하고 상대에게 보낸다.
//  · message: 내가 방금 보낸 메시지 → 대화 상대에게
//  · accept : 내가 방금 수락한 상담 → 요청한 회원에게
//  · consult: 내가 방금 낸 상담 요청 → 근처 승인 전문가에게
//  · review_request: 전문가가 낸 진행 후기 → 해당 회원에게 (공개 동의 요청)
//  · review_decided: 회원의 공개 동의·거절 → 쓴 전문가에게
//  · referral: 전문가가 크루원을 추천 → 회원에게
//  · referral_accepted: 회원이 추천을 수락 → 추천받은 크루원(새 대화방)과 추천한 전문가에게
// 같은 일로 두 번 보내지 않도록 표(pushed_at 등)에 표시한다. 알림 글에는 건강 정보·대화 내용을 넣지 않는다.

export const runtime = 'nodejs'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:spacex2025@naver.com'

const WHO: Record<string, string> = { mother: '어머님', father: '아버님', spouse: '배우자', self: '본인', other: '가족' }

interface Payload {
  title: string
  body: string
  url: string
  tag?: string
}

const recent = (iso: string, minutes: number) => Date.now() - new Date(iso).getTime() < minutes * 60_000

async function sendToUsers(userIds: string[], payload: Payload): Promise<number> {
  if (!PUBLIC_KEY || !PRIVATE_KEY || userIds.length === 0) return 0
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY)
  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', userIds)
  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: 60 * 60 * 24,
          urgency: 'high',
        })
        sent++
        await supabaseAdmin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        // 사라진 기기(앱 삭제·알림 해제) → 지움
        if (code === 404 || code === 410) await supabaseAdmin.from('push_subscriptions').delete().eq('id', s.id)
        else console.error('push send error:', code, e)
      }
    })
  )
  return sent
}

export async function POST(req: NextRequest) {
  if (!PUBLIC_KEY || !PRIVATE_KEY) return NextResponse.json({ ok: false, reason: 'not_configured' })

  // 보낸 사람 확인 (로그인 토큰)
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  const { data: auth } = await supabaseAdmin.auth.getUser(token)
  const me = auth.user?.id
  if (!me) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  // ① 새 메시지
  if (body.type === 'message' && Number.isInteger(body.message_id)) {
    const { data: m } = await supabaseAdmin.from('chat_messages').select('id, room_id, sender_id, kind, created_at, pushed_at').eq('id', body.message_id).single()
    if (!m || m.sender_id !== me || m.kind !== 'text' || m.pushed_at || !recent(m.created_at, 3)) return NextResponse.json({ ok: false })
    // 한 번만: 아직 안 보낸 경우에만 표시를 남기고 진행
    const { data: claimed } = await supabaseAdmin.from('chat_messages').update({ pushed_at: new Date().toISOString() }).eq('id', m.id).is('pushed_at', null).select('id')
    if (!claimed || claimed.length === 0) return NextResponse.json({ ok: false })

    const { data: room } = await supabaseAdmin
      .from('chat_rooms')
      .select('id, guardian_id, expert_user_id, blocked_by, admin_blocked, therapists(name), consult_requests(answers, area_label)')
      .eq('id', m.room_id)
      .single()
    if (!room || room.blocked_by || room.admin_blocked) return NextResponse.json({ ok: false })
    const toGuardian = me === room.expert_user_id
    const recipient = toGuardian ? room.guardian_id : room.expert_user_id
    const t = room.therapists as unknown as { name: string } | null
    const c = room.consult_requests as unknown as { answers: { who?: string }; area_label: string } | null
    const topic = c ? `${WHO[c.answers?.who ?? ''] ?? '가족'} 상담` : '상담'
    const sent = await sendToUsers([recipient], {
      title: toGuardian ? `${t?.name ?? '전문가'}님의 새 메시지` : '회원님의 새 메시지',
      body: toGuardian ? `${topic} · 눌러서 대화를 확인해 주세요` : `${topic}${c?.area_label ? ` (${c.area_label})` : ''} · 눌러서 대화를 확인해 주세요`,
      url: `/chat/${room.id}`,
      tag: `room-${room.id}`,
    })
    return NextResponse.json({ ok: true, sent })
  }

  // ② 상담 수락
  if (body.type === 'accept' && typeof body.room_id === 'string') {
    const { data: room } = await supabaseAdmin
      .from('chat_rooms')
      .select('id, guardian_id, expert_user_id, created_at, accept_pushed_at, therapists(name)')
      .eq('id', body.room_id)
      .single()
    if (!room || room.expert_user_id !== me || room.accept_pushed_at || !recent(room.created_at, 10)) return NextResponse.json({ ok: false })
    const { data: claimed } = await supabaseAdmin.from('chat_rooms').update({ accept_pushed_at: new Date().toISOString() }).eq('id', room.id).is('accept_pushed_at', null).select('id')
    if (!claimed || claimed.length === 0) return NextResponse.json({ ok: false })
    const t = room.therapists as unknown as { name: string } | null
    const sent = await sendToUsers([room.guardian_id], {
      title: '전문가가 상담을 수락했어요',
      body: `${t?.name ?? '전문가'}님(물리치료사)과 무료로 채팅할 수 있어요`,
      url: `/chat/${room.id}`,
      tag: `room-${room.id}`,
    })
    return NextResponse.json({ ok: true, sent })
  }

  // ③ 근처 새 상담 요청
  if (body.type === 'consult' && typeof body.consult_id === 'string') {
    const { data: r } = await supabaseAdmin.from('consult_requests').select('id, user_id, answers, area_label, created_at, push_sent_at').eq('id', body.consult_id).single()
    if (!r || r.user_id !== me || r.push_sent_at || !recent(r.created_at, 10)) return NextResponse.json({ ok: false })
    const { data: claimed } = await supabaseAdmin.from('consult_requests').update({ push_sent_at: new Date().toISOString() }).eq('id', r.id).is('push_sent_at', null).select('id')
    if (!claimed || claimed.length === 0) return NextResponse.json({ ok: false })
    const { data: targets } = await supabaseAdmin.rpc('consult_push_targets', { p_id: r.id })
    const ids = Array.isArray(targets) ? (targets as string[]).filter(Boolean) : []
    const sent = await sendToUsers(ids, {
      title: '근처에 새 상담 요청이 왔어요',
      body: `${r.area_label} · ${WHO[(r.answers as { who?: string })?.who ?? ''] ?? '가족'} 상담 · 먼저 수락한 3명까지 채팅할 수 있어요`,
      url: `/consult/${r.id}`,
      tag: `consult-${r.id}`,
    })
    return NextResponse.json({ ok: true, targets: ids.length, sent })
  }

  // ④ 진행 후기 공개 동의 요청
  if (body.type === 'review_request' && typeof body.review_id === 'string') {
    const { data: r } = await supabaseAdmin
      .from('case_reviews')
      .select('id, expert_user_id, guardian_id, status, submitted_at, pushed_at, therapists(name)')
      .eq('id', body.review_id)
      .single()
    if (!r || r.expert_user_id !== me || !r.guardian_id || r.status !== 'pending' || r.pushed_at || !recent(r.submitted_at, 10)) return NextResponse.json({ ok: false })
    const { data: claimed } = await supabaseAdmin.from('case_reviews').update({ pushed_at: new Date().toISOString() }).eq('id', r.id).is('pushed_at', null).select('id')
    if (!claimed || claimed.length === 0) return NextResponse.json({ ok: false })
    const t = r.therapists as unknown as { name: string } | null
    const sent = await sendToUsers([r.guardian_id], {
      title: '진행 후기 공개 동의를 요청했어요',
      body: `${t?.name ?? '전문가'}님(물리치료사)이 함께한 운동 기록을 올리려고 해요 · 눌러서 확인해 주세요`,
      url: `/reviews/${r.id}`,
      tag: `review-${r.id}`,
    })
    return NextResponse.json({ ok: true, sent })
  }

  // ⑤ 진행 후기 동의·거절 결과
  if (body.type === 'review_decided' && typeof body.review_id === 'string') {
    const { data: r } = await supabaseAdmin
      .from('case_reviews')
      .select('id, expert_user_id, guardian_id, status, decided_at, decided_pushed_at')
      .eq('id', body.review_id)
      .single()
    if (!r || r.guardian_id !== me || !r.decided_at || r.decided_pushed_at || !recent(r.decided_at, 10)) return NextResponse.json({ ok: false })
    const { data: claimed } = await supabaseAdmin.from('case_reviews').update({ decided_pushed_at: new Date().toISOString() }).eq('id', r.id).is('decided_pushed_at', null).select('id')
    if (!claimed || claimed.length === 0) return NextResponse.json({ ok: false })
    const ok = r.status === 'published'
    const sent = await sendToUsers([r.expert_user_id], {
      title: ok ? '진행 후기가 공개됐어요' : '회원이 진행 후기를 공개하지 않기로 했어요',
      body: ok ? '회원이 공개에 동의했어요. 내 프로필에서 확인해 보세요' : '눌러서 이유를 확인하고, 고쳐서 다시 요청할 수 있어요',
      url: `/reviews/${r.id}`,
      tag: `review-${r.id}`,
    })
    return NextResponse.json({ ok: true, sent })
  }

  // ⑥ 크루원 추천 → 회원
  if (body.type === 'referral' && typeof body.referral_id === 'string') {
    const { data: f } = await supabaseAdmin
      .from('referrals')
      .select('id, room_id, guardian_id, from_user_id, status, created_at, pushed_at, from_t:therapists!referrals_from_therapist_id_fkey(name), to_t:therapists!referrals_to_therapist_id_fkey(name)')
      .eq('id', body.referral_id)
      .single()
    if (!f || f.from_user_id !== me || !f.guardian_id || f.status !== 'pending' || f.pushed_at || !recent(f.created_at, 10)) return NextResponse.json({ ok: false })
    const { data: claimed } = await supabaseAdmin.from('referrals').update({ pushed_at: new Date().toISOString() }).eq('id', f.id).is('pushed_at', null).select('id')
    if (!claimed || claimed.length === 0) return NextResponse.json({ ok: false })
    const from = f.from_t as unknown as { name: string } | null
    const to = f.to_t as unknown as { name: string } | null
    const sent = await sendToUsers([f.guardian_id], {
      title: `${from?.name ?? '전문가'}님이 동료 물리치료사를 추천했어요`,
      body: `같은 크루의 ${to?.name ?? '물리치료사'}님 · 눌러서 연결할지 골라 주세요`,
      url: `/chat/${f.room_id}`,
      tag: `room-${f.room_id}`,
    })
    return NextResponse.json({ ok: true, sent })
  }

  // ⑦ 회원이 추천을 수락 → 추천받은 크루원(새 대화) + 추천한 전문가
  if (body.type === 'referral_accepted' && typeof body.referral_id === 'string') {
    const { data: f } = await supabaseAdmin
      .from('referrals')
      .select('id, guardian_id, from_user_id, to_user_id, new_room_id, status, decided_at, decided_pushed_at, to_t:therapists!referrals_to_therapist_id_fkey(name)')
      .eq('id', body.referral_id)
      .single()
    if (!f || f.guardian_id !== me || f.status !== 'accepted' || !f.new_room_id || !f.decided_at || f.decided_pushed_at || !recent(f.decided_at, 10)) {
      return NextResponse.json({ ok: false })
    }
    const { data: claimed } = await supabaseAdmin.from('referrals').update({ decided_pushed_at: new Date().toISOString() }).eq('id', f.id).is('decided_pushed_at', null).select('id')
    if (!claimed || claimed.length === 0) return NextResponse.json({ ok: false })
    const to = f.to_t as unknown as { name: string } | null
    let sent = 0
    if (f.to_user_id) {
      sent += await sendToUsers([f.to_user_id], {
        title: '크루원 추천으로 새 회원과 연결됐어요',
        body: '눌러서 요청서를 확인하고 먼저 인사해 보세요',
        url: `/chat/${f.new_room_id}`,
        tag: `room-${f.new_room_id}`,
      })
    }
    if (f.from_user_id) {
      sent += await sendToUsers([f.from_user_id], {
        title: '추천이 연결됐어요 🤝',
        body: `회원이 ${to?.name ?? '크루원'}님과 연결했어요 · 협력 포인트 +10`,
        url: '/crew',
        tag: `referral-${f.id}`,
      })
    }
    return NextResponse.json({ ok: true, sent })
  }

  return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
}
