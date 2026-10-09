// 돌봄 비용 모의 계산 — 2026년 장기요양급여 비용
// 근거: 보건복지부 고시 제2025-247호(2026.1.1 시행), 보건복지부 보도자료(2025.11.4, 2025년 제6차 장기요양위원회)
// 최종 확인 2026-10-09. 매년 1월 새 수가가 고시되면 이 파일의 숫자만 바꾼다.
// 참고 화면: dolbomgil.com/cost (입력 항목 구성만 참고)

export const COST_BASIS = {
  notice: '보건복지부 고시 제2025-247호',
  effective: '2026년 1월 1일 시행',
  checkedAt: '2026-10-09',
}

export type CostService = 'facility' | 'daycare' | 'homecare'
export type CostGrade = '1' | '2' | '3' | '4' | '5' | 'cog'
export type CopayType = 'general' | 'reduced40' | 'reduced60' | 'exempt' | 'unknown'
export type DaycareBand = 'h3' | 'h6' | 'h8' | 'h10' | 'h13'

export const SERVICE_OPTIONS: { value: CostService; label: string; short: string; desc: string; emoji: string }[] = [
  { value: 'homecare', label: '방문요양', short: '방문요양', desc: '요양보호사가 집으로 와요', emoji: '🏠' },
  { value: 'daycare', label: '주야간보호(주간보호)', short: '주야간보호', desc: '낮 동안 센터에 다녀와요', emoji: '🚐' },
  { value: 'facility', label: '요양원', short: '요양원', desc: '시설에 들어가 생활해요', emoji: '🏥' },
]

export const GRADE_OPTIONS: { value: CostGrade; label: string }[] = [
  { value: '1', label: '1등급' },
  { value: '2', label: '2등급' },
  { value: '3', label: '3등급' },
  { value: '4', label: '4등급' },
  { value: '5', label: '5등급' },
  { value: 'cog', label: '인지지원등급' },
]

/** 재가급여(방문요양·주야간보호 등) 월 한도액 — 넘는 금액은 전부 본인 부담 */
export const MONTHLY_LIMIT: Record<CostGrade, number> = {
  '1': 2512900,
  '2': 2331200,
  '3': 1528200,
  '4': 1409700,
  '5': 1208900,
  cog: 676320,
}

/** 방문요양 1회 비용 (이용 시간별) */
export const HOMECARE_FEE: { minutes: number; fee: number }[] = [
  { minutes: 30, fee: 17450 },
  { minutes: 60, fee: 25320 },
  { minutes: 90, fee: 34120 },
  { minutes: 120, fee: 43430 },
  { minutes: 150, fee: 50640 },
  { minutes: 180, fee: 57020 },
  { minutes: 210, fee: 63530 },
  { minutes: 240, fee: 70080 },
]

/**
 * 등급별로 고를 수 있는 방문요양 1회 시간
 * 1~2등급 최대 240분, 3~5등급 최대 180분, 5등급은 인지활동형 위주(2~3시간)로 안내되고 있어 그 범위만 보여 준다.
 * 인지지원등급은 방문요양을 이용할 수 없다.
 */
export function homecareMinutesFor(grade: CostGrade): number[] {
  if (grade === 'cog') return []
  if (grade === '1' || grade === '2') return HOMECARE_FEE.map((r) => r.minutes)
  if (grade === '5') return [120, 150, 180]
  return HOMECARE_FEE.filter((r) => r.minutes <= 180).map((r) => r.minutes)
}

export const DAYCARE_BANDS: { value: DaycareBand; label: string }[] = [
  { value: 'h3', label: '3~6시간' },
  { value: 'h6', label: '6~8시간' },
  { value: 'h8', label: '8~10시간' },
  { value: 'h10', label: '10~13시간' },
  { value: 'h13', label: '13시간 이상' },
]

/** 주야간보호 1일 비용 (등급 × 하루 이용 시간) */
export const DAYCARE_FEE: Record<CostGrade, Record<DaycareBand, number>> = {
  '1': { h3: 41820, h6: 56060, h8: 69730, h10: 76820, h13: 82370 },
  '2': { h3: 38720, h6: 51930, h8: 64590, h10: 71160, h13: 76310 },
  '3': { h3: 35740, h6: 47940, h8: 59640, h10: 65750, h13: 70500 },
  '4': { h3: 34120, h6: 46300, h8: 58010, h10: 64090, h13: 68860 },
  '5': { h3: 32490, h6: 44650, h8: 56360, h10: 62460, h13: 67240 },
  cog: { h3: 32490, h6: 44650, h8: 56360, h10: 56360, h13: 56360 },
}

/**
 * 노인요양시설(요양원) 1일 비용
 * high: 요양보호사를 더 많이 둔 기관(요양보호사 1명당 어르신 2.1명 이하), low: 그 밖의 기관
 * 월 한도액이 없고, 3~5등급은 등급판정위원회가 시설급여를 인정한 경우 이용
 */
export const FACILITY_FEE: Record<Exclude<CostGrade, 'cog'>, { low: number; high: number }> = {
  '1': { low: 88520, high: 93070 },
  '2': { low: 82120, high: 86340 },
  '3': { low: 77540, high: 81540 },
  '4': { low: 77540, high: 81540 },
  '5': { low: 77540, high: 81540 },
}

/** 본인부담률 — 재가(방문요양·주야간보호)와 시설(요양원)이 다르다 */
export const COPAY_OPTIONS: { value: CopayType; label: string; desc: string; home: number; facility: number }[] = [
  { value: 'general', label: '일반', desc: '대부분 여기에 해당해요 (집 15% · 요양원 20%)', home: 0.15, facility: 0.2 },
  { value: 'reduced40', label: '40% 감경', desc: '건강보험료 하위 25~50% 등 (집 9% · 요양원 12%)', home: 0.09, facility: 0.12 },
  { value: 'reduced60', label: '60% 감경', desc: '의료급여 수급자(기초생활수급자 제외), 건강보험료 하위 25% 이하 등 (집 6% · 요양원 8%)', home: 0.06, facility: 0.08 },
  { value: 'exempt', label: '면제', desc: '기초생활수급자(의료급여) (0%)', home: 0, facility: 0 },
  { value: 'unknown', label: '잘 모르겠어요', desc: '일반 기준으로 계산할게요', home: 0.15, facility: 0.2 },
]

export interface CostInput {
  service: CostService
  grade: CostGrade
  copay: CopayType
  /** 요양원·주야간보호: 한 달 이용 일수 */
  days: number
  /** 주야간보호: 하루 이용 시간 */
  band: DaycareBand
  /** 방문요양: 1회 이용 시간(분) */
  minutes: number
  /** 방문요양: 한 달 이용 횟수 */
  visits: number
  /** 식비 등 비급여 (한 달, 원) — 기관마다 달라 직접 입력 */
  extra: number
}

export type Range = [number, number]

export interface CostResult {
  /** 이 등급으로는 이 서비스를 쓸 수 없을 때 그 이유 */
  blocked: string | null
  unitFee: Range
  count: number
  unitLabel: '일' | '회'
  totalFee: Range
  /** 재가 월 한도액 (요양원은 null) */
  limit: number | null
  covered: Range
  over: Range
  copayRate: number
  copay: Range
  nhis: Range
  extra: number
  /** 본인이 한 달에 내는 돈 = 본인부담 + 한도 초과분 + 비급여 */
  monthly: Range
  /** 월 한도 사용률(%) */
  usagePct: number | null
  /** 한도 안에서 쓸 수 있는 최대 일수·횟수 */
  maxCount: number | null
  notes: string[]
}

const floor10 = (n: number) => Math.floor(n / 10) * 10
const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)))

export const COUNT_LIMIT = { days: 31, visits: 62 }

export function calcCost(input: CostInput): CostResult {
  const copayOption = COPAY_OPTIONS.find((o) => o.value === input.copay) ?? COPAY_OPTIONS[0]
  const extra = Math.max(0, Math.round(input.extra || 0))
  const notes: string[] = []
  const empty = (blocked: string): CostResult => ({
    blocked,
    unitFee: [0, 0],
    count: 0,
    unitLabel: '일',
    totalFee: [0, 0],
    limit: null,
    covered: [0, 0],
    over: [0, 0],
    copayRate: 0,
    copay: [0, 0],
    nhis: [0, 0],
    extra,
    monthly: [extra, extra],
    usagePct: null,
    maxCount: null,
    notes,
  })

  // ── 요양원: 월 한도 없음, 1일 비용 × 일수 × 시설 본인부담률 ──
  if (input.service === 'facility') {
    if (input.grade === 'cog') {
      return empty('인지지원등급은 요양원(시설급여)을 이용할 수 없어요. 주야간보호·단기보호·복지용구를 이용할 수 있어요.')
    }
    const fee = FACILITY_FEE[input.grade]
    const days = clampInt(input.days, 1, COUNT_LIMIT.days)
    const rate = copayOption.facility
    const total: Range = [fee.low * days, fee.high * days]
    const copay: Range = [floor10(total[0] * rate), floor10(total[1] * rate)]
    if (input.grade === '3' || input.grade === '4' || input.grade === '5') {
      notes.push(
        '3~5등급은 원칙적으로 집에서 받는 서비스(재가급여)를 이용해요. 가족 돌봄이 어렵거나 치매 증상 등으로 시설이 꼭 필요하다고 등급판정위원회가 인정하면 요양원을 이용할 수 있어요.'
      )
    }
    notes.push('요양원은 요양보호사를 얼마나 두었는지에 따라 1일 비용이 달라서 범위로 보여 드려요.')
    return {
      blocked: null,
      unitFee: [fee.low, fee.high],
      count: days,
      unitLabel: '일',
      totalFee: total,
      limit: null,
      covered: total,
      over: [0, 0],
      copayRate: rate,
      copay,
      nhis: [total[0] - copay[0], total[1] - copay[1]],
      extra,
      monthly: [copay[0] + extra, copay[1] + extra],
      usagePct: null,
      maxCount: null,
      notes,
    }
  }

  // ── 재가(주야간보호·방문요양): 월 한도액 안은 본인부담률, 넘는 금액은 전부 본인 ──
  let unit = 0
  let count = 0
  let unitLabel: '일' | '회' = '일'
  if (input.service === 'daycare') {
    unit = DAYCARE_FEE[input.grade][input.band]
    count = clampInt(input.days, 1, COUNT_LIMIT.days)
    if (input.grade === 'cog' && (input.band === 'h10' || input.band === 'h13')) {
      notes.push('인지지원등급은 하루 8시간을 넘게 이용해도 8~10시간 비용으로 계산돼요.')
    }
  } else {
    if (input.grade === 'cog') {
      return empty('인지지원등급은 방문요양을 이용할 수 없어요. 주야간보호·단기보호·복지용구를 이용할 수 있어요.')
    }
    const allowed = homecareMinutesFor(input.grade)
    const minutes = allowed.includes(input.minutes) ? input.minutes : allowed[allowed.length - 1]
    unit = HOMECARE_FEE.find((r) => r.minutes === minutes)?.fee ?? 0
    count = clampInt(input.visits, 1, COUNT_LIMIT.visits)
    unitLabel = '회'
    if (input.grade === '5') {
      notes.push('5등급은 주로 인지활동형 방문요양(1회 2~3시간)으로 이용해요. 프로그램에 따라 비용이 다를 수 있어요.')
    }
  }

  const limit = MONTHLY_LIMIT[input.grade]
  const rate = copayOption.home
  const total = unit * count
  const covered = Math.min(total, limit)
  const over = total - covered
  const copay = floor10(covered * rate)
  const monthly = copay + over + extra

  return {
    blocked: null,
    unitFee: [unit, unit],
    count,
    unitLabel,
    totalFee: [total, total],
    limit,
    covered: [covered, covered],
    over: [over, over],
    copayRate: rate,
    copay: [copay, copay],
    nhis: [covered - copay, covered - copay],
    extra,
    monthly: [monthly, monthly],
    usagePct: Math.round((total / limit) * 100),
    maxCount: unit > 0 ? Math.floor(limit / unit) : null,
    notes,
  }
}

// ── 화면 표시 도우미 ──

/** 1234567 → '1,234,567원' */
export function won(n: number): string {
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`
}

/** 만 원 단위로 반올림한 숫자 문자열 (1만 원 미만은 원 단위 그대로) */
function man(n: number): string {
  return String(Math.round(n / 10000)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 큰 글씨용: '약 23만 원', 범위면 '약 53만~56만 원' */
export function manwon(range: Range): string {
  const [a, b] = range
  if (b <= 0) return '0원'
  if (b < 10000) return a === b ? won(a) : `${won(a)}~${won(b)}`
  if (man(a) === man(b)) return `약 ${man(a)}만 원`
  return `약 ${man(a)}만~${man(b)}만 원`
}

/** '1,234원' 또는 '1,234~1,300원' */
export function wonRange(range: Range): string {
  const [a, b] = range
  if (a === b) return won(a)
  return `${won(a).replace('원', '')}~${won(b)}`
}

export const percent = (rate: number) => `${Math.round(rate * 100)}%`

/** 결과·요약에 쓰는 짧은 이름 */
export function serviceLabel(s: CostService) {
  return SERVICE_OPTIONS.find((o) => o.value === s)?.short ?? ''
}

export function gradeLabel(g: CostGrade) {
  return GRADE_OPTIONS.find((o) => o.value === g)?.label ?? ''
}
