import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { SolapiMessageService } from 'solapi'
 
// 솔라피 SDK는 Node 런타임 필요
export const runtime = 'nodejs'
 
// 관리자 목록 조회: 상태별 치료사 (휴대폰·면허번호 포함 → 서버에서만)
export async function GET(req: NextRequest) {
  const token = req.cookies.get('mulchasa_admin')?.value
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }
  const status = req.nextUrl.searchParams.get('status') ?? 'pending'
  if (!['pending', 'verified', 'rejected'].includes(status)) {
    return NextResponse.json({ error: '잘못된 상태값' }, { status: 400 })
  }
  const { data, error } = await supabaseAdmin
    .from('therapists')
    .select('*')
    .eq('verification_status', status)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('admin list error:', error)
    return NextResponse.json({ error: '목록을 불러오지 못했어요' }, { status: 500 })
  }
  // 면허증 사진은 비공개 보관함 → 10분짜리 임시 주소만 만들어 관리자 화면에 준다
  const therapists = await Promise.all(
    (data ?? []).map(async (t) => {
      if (!t.license_photo_path) return { ...t, license_photo_url: null }
      const { data: signed } = await supabaseAdmin.storage.from(LICENSE_BUCKET).createSignedUrl(t.license_photo_path, 600)
      return { ...t, license_photo_url: signed?.signedUrl ?? null }
    })
  )
  return NextResponse.json({ therapists })
}

const LICENSE_BUCKET = 'licenses'

/** 확인(승인·거부)이 끝난 면허증 사진은 바로 지우고, 확인한 시각만 남긴다 */
async function deleteLicensePhoto(id: string) {
  const { data } = await supabaseAdmin.from('therapists').select('license_photo_path').eq('id', id).single()
  const path = data?.license_photo_path as string | null | undefined
  if (!path) return
  const { error } = await supabaseAdmin.storage.from(LICENSE_BUCKET).remove([path])
  if (error) {
    console.error('license photo delete error:', error)
    return
  }
  await supabaseAdmin
    .from('therapists')
    .update({ license_photo_path: null, license_checked_at: new Date().toISOString() })
    .eq('id', id)
}

export async function POST(req: NextRequest) {
  // 인증: httpOnly 쿠키로만 확인. (비밀번호를 본문으로 받지 않음 → 노출 경로 차단)
  const token = req.cookies.get('mulchasa_admin')?.value
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }
 
  const { id, action, days } = await req.json().catch(() => ({}))
  if (!id || !action) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  // 구독 켜기·연장·끄기 (시범 기간: 운영자가 직접, 정기결제는 시범 오픈 뒤)
  // 켜기: 오늘(또는 남은 구독 마지막 날)부터 days일 뒤까지 / 끄기: days = 0
  if (action === 'subscription') {
    const n = Number(days)
    if (!Number.isInteger(n) || n < 0 || n > 366) {
      return NextResponse.json({ error: '기간을 확인해 주세요' }, { status: 400 })
    }
    const { data: t } = await supabaseAdmin.from('therapists').select('verification_status, subscribed_until').eq('id', id).single()
    if (!t || t.verification_status !== 'verified') {
      return NextResponse.json({ error: '승인된 전문가만 구독을 켤 수 있어요' }, { status: 400 })
    }
    let until: string | null = null
    if (n > 0) {
      const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10) // 한국 날짜
      const base = t.subscribed_until && t.subscribed_until >= today ? t.subscribed_until : today
      const d = new Date(`${base}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + n)
      until = d.toISOString().slice(0, 10)
    }
    const { error } = await supabaseAdmin.from('therapists').update({ subscribed_until: until }).eq('id', id)
    if (error) return NextResponse.json({ error: '구독을 바꾸지 못했어요 (day13 SQL 실행 여부 확인)' }, { status: 500 })
    return NextResponse.json({ ok: true, subscribed_until: until })
  }
 
  // 승인 안내 문자 다시 보내기 (예: 문자 서비스 IP 설정을 고친 뒤)
  if (action === 'resend_sms') {
    const { data: t } = await supabaseAdmin.from('therapists').select('name, phone, verification_status').eq('id', id).single()
    if (!t || t.verification_status !== 'verified') {
      return NextResponse.json({ error: '승인된 전문가에게만 보낼 수 있어요' }, { status: 400 })
    }
    const r = await sendApprovalSms(t.name, t.phone)
    return NextResponse.json({ ok: true, smsSent: r.sent, smsError: r.error })
  }

  // 거부 / 대기 되돌리기 — service_role로 쓰기(RLS 우회)
  if (action === 'reject' || action === 'revert') {
    const status = action === 'reject' ? 'rejected' : 'pending'
    const { error } = await supabaseAdmin
      .from('therapists')
      .update({ verification_status: status })
      .eq('id', id)
    if (error) return NextResponse.json({ error: '상태 변경 실패' }, { status: 500 })
    if (action === 'reject') await deleteLicensePhoto(id)
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
  await deleteLicensePhoto(id)
 
  // 문자 발송 — 이미 승인된 건이면 중복 발송하지 않음
  let smsSent = false
  let smsError: string | null = null
  if (!wasAlreadyVerified) {
    const r = await sendApprovalSms(therapist.name, therapist.phone)
    smsSent = r.sent
    smsError = r.error
  }

  return NextResponse.json({ ok: true, smsSent, smsError, alreadyVerified: wasAlreadyVerified })
}

/** 승인 안내 문자 (솔라피) — 실패해도 승인 자체는 유지 */
async function sendApprovalSms(name: string, phone: string): Promise<{ sent: boolean; error: string | null }> {
  try {
    const messageService = new SolapiMessageService(process.env.SOLAPI_API_KEY!, process.env.SOLAPI_API_SECRET!)
    const text =
      `[보호가 필요해] ${name}님, 물리치료사 면허 확인이 끝나 전문가 승인이 완료되었어요.\n` +
      `이제 보호자 검색에 프로필이 보여요. MY에서 사진·소개·오픈채팅을 채워 주세요.`
    await messageService.send({
      // 솔라피는 하이픈 없는 01012345678 형식 요구
      to: String(phone).replace(/[^0-9]/g, ''),
      from: process.env.SOLAPI_SENDER!,
      text,
    })
    return { sent: true, error: null }
  } catch (e) {
    console.error('SMS 발송 실패:', e)
    return { sent: false, error: e instanceof Error ? e.message : '문자 발송 실패' }
  }
}
