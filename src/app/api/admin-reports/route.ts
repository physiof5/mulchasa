import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// 관리자 — 채팅 신고 확인·처리 (쿠키 인증 + service_role, 서버에서만)

function authed(req: NextRequest) {
  const token = req.cookies.get('mulchasa_admin')?.value
  return !!token && token === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  const status = req.nextUrl.searchParams.get('status') === 'done' ? 'done' : 'new'

  // 관리자 화면을 열 때마다 보관 기간이 지난 대화·요청서도 함께 정리 (예약 작업이 없어도 지워지게)
  await supabaseAdmin.rpc('purge_old_chats').then(({ error }) => error && console.error('purge_old_chats error:', error))

  const { data, error } = await supabaseAdmin
    .from('chat_reports')
    .select('id, room_id, reporter_role, reason, detail, snapshot, status, created_at, handled_at, chat_rooms(id, admin_blocked, blocked_by, therapists(name))')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    console.error('admin reports error:', error)
    return NextResponse.json({ error: '신고 목록을 불러오지 못했어요 (day13 SQL 실행 여부 확인)' }, { status: 500 })
  }
  return NextResponse.json({ reports: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  const { id, action } = await req.json().catch(() => ({}))
  if (typeof id !== 'string' || !['done', 'reopen', 'stop_room', 'resume_room'].includes(action)) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  if (action === 'done' || action === 'reopen') {
    const { error } = await supabaseAdmin
      .from('chat_reports')
      .update(action === 'done' ? { status: 'done', handled_at: new Date().toISOString() } : { status: 'new', handled_at: null })
      .eq('id', id)
    if (error) return NextResponse.json({ error: '처리하지 못했어요' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // 대화 중지 / 다시 열기 — 신고된 대화방 기준
  const { data: report } = await supabaseAdmin.from('chat_reports').select('room_id').eq('id', id).single()
  if (!report?.room_id) return NextResponse.json({ error: '대화방이 이미 지워졌어요' }, { status: 404 })
  const { error } = await supabaseAdmin
    .from('chat_rooms')
    .update({ admin_blocked: action === 'stop_room' })
    .eq('id', report.room_id)
  if (error) return NextResponse.json({ error: '대화방을 바꾸지 못했어요' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
