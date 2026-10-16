import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { PRIVATE_KEY, PUBLIC_KEY, sendToUsers } from '@/lib/webpushServer'

// 매일 저녁 8시(한국) 예약 작업 — vercel.json 의 crons 가 부른다
//  · 내일 잡힌 방문·상담 → 회원에게 '내일 방문이 있어요'
//  · 오늘 끝난 방문 중 진행 여부를 아직 안 누른 것 → 회원에게 '잘 진행됐나요?'
// 같은 일정으로 두 번 보내지 않도록 표에 표시하면서 꺼낸다(claim_visit_pushes). 알림 글에 건강 정보는 넣지 않는다.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Reminder {
  id: string
  kind: string
  when: string
  room_id: string
  user_id: string
  name: string | null
}
interface Ask {
  id: string
  room_id: string
  user_id: string
  name: string | null
}

export async function GET(req: NextRequest) {
  // Vercel 예약 작업만 (환경변수 CRON_SECRET 을 Authorization: Bearer 로 보내 줌)
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }
  if (!PUBLIC_KEY || !PRIVATE_KEY) return NextResponse.json({ ok: false, reason: 'push_not_configured' })

  const { data, error } = await supabaseAdmin.rpc('claim_visit_pushes')
  if (error) {
    console.error('claim_visit_pushes error:', error)
    return NextResponse.json({ error: '대상을 불러오지 못했어요 (day17 SQL 실행 여부 확인)' }, { status: 500 })
  }
  const { reminders = [], asks = [] } = (data ?? {}) as { reminders?: Reminder[]; asks?: Ask[] }

  let sent = 0
  for (const r of reminders) {
    const what = r.kind === 'consult' ? '상담' : r.kind === 'center' ? '센터 운동 지도' : '방문 운동 지도'
    sent += await sendToUsers([r.user_id], {
      title: `내일 ${what}가 있어요`,
      body: `${r.when} · ${r.name ?? '전문가'}님 · 눌러서 일정을 확인해 주세요`,
      url: `/chat/${r.room_id}`,
      tag: `visit-${r.room_id}`,
    })
  }
  for (const a of asks) {
    sent += await sendToUsers([a.user_id], {
      title: '오늘 방문은 잘 진행됐나요?',
      body: `${a.name ?? '전문가'}님과의 방문 · 눌러서 ‘진행 완료’를 기록해 주세요`,
      url: `/chat/${a.room_id}`,
      tag: `visit-done-${a.room_id}`,
    })
  }
  return NextResponse.json({ ok: true, reminders: reminders.length, asks: asks.length, sent })
}
