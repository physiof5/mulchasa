import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createHmac } from 'crypto'
 
export const runtime = 'nodejs'

// ── 스팸 방지 설정 ──────────────────────────────
const MIN_FILL_MS = 4000          // 화면을 연 뒤 4초 안에 보낸 요청은 자동 프로그램으로 봄
const IP_LIMIT_PER_HOUR = 3       // 같은 인터넷 주소(IP)에서 1시간에 최대 3건
const CONTACT_LIMIT_PER_DAY = 3   // 같은 연락처로 하루 최대 3건

// IP 원문은 저장하지 않고, 비밀 값으로 섞은 '지문'만 저장
function hashIp(ip: string) {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET || 'local-dev')
    .update(ip)
    .digest('hex')
    .slice(0, 32)
}

// 같은 조건으로 최근에 들어온 요청 수 (조회 실패 시 0 → 정상 사용자를 막지 않음)
async function countRecent(column: 'ip_hash' | 'contact', value: string, sinceMs: number) {
  const since = new Date(Date.now() - sinceMs).toISOString()
  const { count, error } = await supabaseAdmin
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
    .gte('created_at', since)
  if (error) {
    console.error('rate limit count error:', error)
    return 0
  }
  return count ?? 0
}
 
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
 
    // ① 숨은 칸(허니팟): 사람에게는 안 보이는 칸이 채워져 있으면 자동 프로그램 → 저장하지 않고 조용히 종료
    if (body.website) {
      return NextResponse.json({ ok: true, id: null, token: null })
    }

    // ② 너무 빨리 제출한 요청 차단
    const elapsed = Date.now() - Number(body.startedAt)
    if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
      return NextResponse.json({ error: '잠시 후 다시 시도해주세요' }, { status: 429 })
    }

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

    // ③ 연락처 형식 확인 (전화번호는 숫자만 저장)
    const isKakao = contactType === 'kakao'
    const contactValue = isKakao
      ? String(contact).trim()
      : String(contact).replace(/[^0-9]/g, '')
    if (isKakao && !contactValue.startsWith('https://open.kakao.com/')) {
      return NextResponse.json({ error: '카카오 오픈채팅 주소를 확인해주세요' }, { status: 400 })
    }
    if (!isKakao && !/^01[0-9]{8,9}$/.test(contactValue)) {
      return NextResponse.json({ error: '휴대폰 번호를 확인해주세요' }, { status: 400 })
    }

    // ④ 반복 요청 제한
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    const ipHash = hashIp(ip)
    if ((await countRecent('ip_hash', ipHash, 60 * 60 * 1000)) >= IP_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: '짧은 시간에 요청이 많아요. 1시간 뒤 다시 시도해주세요' },
        { status: 429 }
      )
    }
    if ((await countRecent('contact', contactValue, 24 * 60 * 60 * 1000)) >= CONTACT_LIMIT_PER_DAY) {
      return NextResponse.json(
        { error: '같은 연락처로 오늘 이미 여러 번 요청하셨어요. 내일 다시 시도해주세요' },
        { status: 429 }
      )
    }
 
    const { data, error } = await supabaseAdmin
      .from('requests')
      .insert({
        nickname: String(nickname).trim().slice(0, 20),
        contact_type: contactType === 'kakao' ? 'kakao' : 'phone',
        contact: contactValue.slice(0, 200),
        ip_hash: ipHash,
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
 