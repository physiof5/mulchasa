import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createHmac } from 'crypto'
import { isValidRegion } from '@/lib/regions'

export const runtime = 'nodejs'

// ── 스팸 방지 설정 ──────────────────────────────
const MIN_FILL_MS = 3000      // 화면을 연 뒤 3초 안에 보낸 신청은 자동 프로그램으로 봄
const IP_LIMIT_PER_HOUR = 5   // 같은 인터넷 주소(IP)에서 1시간에 최대 5건

function hashIp(ip: string) {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET || 'local-dev')
    .update(ip)
    .digest('hex')
    .slice(0, 32)
}

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

const TIME_SLOTS = ['평일 낮', '평일 저녁', '주말']

// 사전 신청 (보호자 / 전문가)
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    // ① 숨은 칸이 채워져 있으면 자동 프로그램 → 저장하지 않고 조용히 종료
    if (body.website) return NextResponse.json({ ok: true })

    // ② 너무 빨리 제출한 신청 차단
    const elapsed = Date.now() - Number(body.startedAt)
    if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
      return NextResponse.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 429 })
    }

    // ③ 입력값 확인
    const role = body.role === 'pt' ? 'pt' : body.role === 'guardian' ? 'guardian' : null
    const name = clean(body.name, 20)
    const phone = String(body.phone ?? '').replace(/[^0-9]/g, '')
    const regions: string[] = Array.isArray(body.regions)
      ? Array.from(new Set<string>(body.regions.map((r: unknown) => clean(r, 20)))).filter(isValidRegion).slice(0, 30)
      : []
    const region = regions.join(', ')
    const needs = Array.isArray(body.needs)
      ? body.needs.map((n: unknown) => clean(n, 30)).filter(Boolean).slice(0, 10)
      : []
    const note = clean(body.note, 300) || null
    const source = clean(body.source, 30) || null

    if (body.agreed !== true) {
      return NextResponse.json({ error: '개인정보 수집·이용에 동의해 주세요.' }, { status: 400 })
    }
    // 보호자: 받고 싶은 장소 (home / center / both)
    const place = ['home', 'center', 'both'].includes(body.place) ? body.place : null
    if (role === 'guardian' && !place) {
      return NextResponse.json({ error: '운동 지도를 받고 싶은 곳을 골라 주세요.' }, { status: 400 })
    }

    // 전문가: 활동 방식(방문/센터) + 이동 수단 + 활동 시간대
    const modes: string[] = Array.isArray(body.modes)
      ? ['home', 'center'].filter((m) => body.modes.includes(m))
      : []
    const transport = body.transport === 'car' || body.transport === 'transit' ? body.transport : null
    const timeSlots: string[] = Array.isArray(body.timeSlots)
      ? TIME_SLOTS.filter((s) => body.timeSlots.includes(s))
      : []
    const centerName = modes.includes('center') ? clean(body.centerName, 40) || null : null
    if (role === 'pt') {
      if (modes.length === 0 || timeSlots.length === 0) {
        return NextResponse.json({ error: '활동 방식과 시간대를 골라 주세요.' }, { status: 400 })
      }
      if (modes.includes('home') && !transport) {
        return NextResponse.json({ error: '방문할 때 이동 수단을 골라 주세요.' }, { status: 400 })
      }
    }
    const serviceMode =
      role === 'guardian' ? place : modes.length === 2 ? 'both' : modes[0]

    if (role === 'guardian' && regions.length !== 1) {
      return NextResponse.json({ error: '사시는 지역을 하나 골라 주세요.' }, { status: 400 })
    }
    if (!role || !name || regions.length === 0 || needs.length === 0) {
      return NextResponse.json({ error: '입력하지 않은 항목이 있어요.' }, { status: 400 })
    }
    if (!/^01[0-9]{8,9}$/.test(phone)) {
      return NextResponse.json({ error: '휴대폰 번호를 확인해 주세요.' }, { status: 400 })
    }

    // ④ 같은 번호·같은 유형으로 이미 신청했다면 중복 저장하지 않음
    const { count: dup } = await supabaseAdmin
      .from('waitlist')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .eq('role', role)
    if ((dup ?? 0) > 0) return NextResponse.json({ ok: true, duplicate: true })

    // ⑤ 같은 IP에서 반복 신청 제한
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    const ipHash = hashIp(ip)
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recent } = await supabaseAdmin
      .from('waitlist')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', since)
    if ((recent ?? 0) >= IP_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: '짧은 시간에 신청이 많아요. 1시간 뒤 다시 시도해 주세요.' },
        { status: 429 }
      )
    }

    const { error } = await supabaseAdmin.from('waitlist').insert({
      role,
      name,
      phone,
      region,
      needs,
      note,
      source,
      agreed_privacy: true,
      service_mode: serviceMode,
      center_name: role === 'pt' ? centerName : null,
      has_car: role === 'pt' && modes.includes('home') ? transport === 'car' : null,
      time_slots: role === 'pt' ? timeSlots : [],
      ip_hash: ipHash,
    })
    if (error) {
      console.error('waitlist insert error:', error)
      return NextResponse.json({ error: '신청이 저장되지 않았어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('waitlist route error:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
