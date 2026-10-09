import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
 
export const runtime = 'nodejs'
 
// 방문 운동 지도 요청서 등록
// 환자는 계정이 없으므로, 등록 시 access_token을 발급해 본인 확인에 사용합니다.
export async function POST(req: Request) {
  try {
    const body = await req.json()
 
    const {
      nickname,
      contactType,
      contact,
      subject,
      bodyPart,
      duration,
      nature,
      intensity,
      purpose,
      note,
      latitude,
      longitude,
      areaLabel,
      addressDetail,
      preferredSlots,
    } = body
 
    // 개인정보 동의 확인 (3가지 모두 필수)
    if (body.agreeCollect !== true || body.agreeSensitive !== true || body.agreeShare !== true) {
      return NextResponse.json({ error: '개인정보 처리에 동의해주세요' }, { status: 400 })
    }

    // 최소 검증
    if (!nickname || !String(nickname).trim()) {
      return NextResponse.json({ error: '호칭을 입력해주세요' }, { status: 400 })
    }
    if (!contact || !String(contact).trim()) {
      return NextResponse.json({ error: '연락처를 입력해주세요' }, { status: 400 })
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: '주소를 확인해주세요' }, { status: 400 })
    }
    if (!Array.isArray(preferredSlots) || preferredSlots.length === 0) {
      return NextResponse.json({ error: '희망 시간을 선택해주세요' }, { status: 400 })
    }
 
    const { data, error } = await supabaseAdmin
      .from('requests')
      .insert({
        nickname: String(nickname).trim().slice(0, 20),
        contact_type: contactType === 'kakao' ? 'kakao' : 'phone',
        contact: String(contact).trim().slice(0, 200),
        subject: subject || null,
        body_part: bodyPart || null,
        duration: duration || null,
        nature: nature || null,
        intensity: typeof intensity === 'number' ? intensity : null,
        purpose: purpose || null,
        note: note ? String(note).slice(0, 500) : null,
        latitude,
        longitude,
        area_label: areaLabel || null,
        address_detail: addressDetail ? String(addressDetail).slice(0, 200) : null,
        preferred_slots: preferredSlots,
        consented_at: new Date().toISOString(),
      })
      .select('id, access_token')
      .single()
 
    if (error || !data) {
      console.error('request insert error:', error)
      return NextResponse.json({ error: '요청서 등록에 실패했습니다' }, { status: 500 })
    }
 
    return NextResponse.json({ ok: true, id: data.id, token: data.access_token })
  } catch (e) {
    console.error('requests route error:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
 