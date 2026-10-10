import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// 알림 보내기 (웹 푸시) — 화면이 '방금 이런 일이 있었어요'라고 알려 주면 서버가 확인하고 상대에게 보낸다.
//  · message: 내가 방금 보낸 메시지 → 대화 상대에게
//  · accept : 내가 방금 수락한 상담 → 보호자에게
//  · consult: 내가 방금 낸 상담 요청 → 근처 승인 전문가에게
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
      title: toGuardian ? `${t?.name ?? '전문가'}님의 새 메시지` : '보호자님의 새 메시지',
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

  return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
}
