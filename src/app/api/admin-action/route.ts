import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { SolapiMessageService } from 'solapi'
 
// 솔라피 SDK는 Node 런타임 필요
export const runtime = 'nodejs'
 
export async function POST(req: NextRequest) {
  // 인증: httpOnly 쿠키로만 확인. (비밀번호를 본문으로 받지 않음 → 노출 경로 차단)
  const token = req.cookies.get('mulchasa_admin')?.value
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }
 
  const { id, action } = await req.json().catch(() => ({}))
  if (!id || !action) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }
 
  // 거부 / 대기 되돌리기 — service_role로 쓰기(RLS 우회)
  if (action === 'reject' || action === 'revert') {
    const status = action === 'reject' ? 'rejected' : 'pending'
    const { error } = await supabaseAdmin
      .from('therapists')
      .update({ verification_status: status })
      .eq('id', id)
    if (error) return NextResponse.json({ error: '상태 변경 실패' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
 
  if (action !== 'approve') {
    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
  }
 
  // 승인
  const { data: therapist, error: fetchError } = await supabaseAdmin
    .from('therapists')
    .select('id, name, phone, verification_status')
    .eq('id', id)
    .single()
 
  if (fetchError || !therapist) {
    return NextResponse.json({ error: '치료사를 찾을 수 없습니다' }, { status: 404 })
  }
 
  const wasAlreadyVerified = therapist.verification_status === 'verified'
 
  const { error: updateError } = await supabaseAdmin
    .from('therapists')
    .update({ verification_status: 'verified' })
    .eq('id', id)
 
  if (updateError) {
    return NextResponse.json({ error: '상태 변경 실패' }, { status: 500 })
  }
 
  // 문자 발송 — 이미 승인된 건이면 중복 발송하지 않음
  let smsSent = false
  let smsError: string | null = null
 
  if (!wasAlreadyVerified) {
    try {
      const messageService = new SolapiMessageService(
        process.env.SOLAPI_API_KEY!,
        process.env.SOLAPI_API_SECRET!
      )
      const text =
        `[물찾사] ${therapist.name}님, 면허 인증이 승인되었습니다.\n` +
        `이제 검색 결과에 프로필이 노출됩니다. 프로필 사진·자격증 등은 마이페이지에서 추가/수정하실 수 있습니다.`
 
      await messageService.send({
        // 솔라피는 하이픈 없는 01012345678 형식 요구
        to: String(therapist.phone).replace(/[^0-9]/g, ''),
        from: process.env.SOLAPI_SENDER!,
        text,
      })
      smsSent = true
    } catch (e) {
      smsError = e instanceof Error ? e.message : '문자 발송 실패'
      console.error('SMS 발송 실패:', e)
    }
  }
 
  return NextResponse.json({ ok: true, smsSent, smsError, alreadyVerified: wasAlreadyVerified })
}
 