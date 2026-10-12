// 전문가 스케줄 — 종류·색, 날짜 계산 (모두 이 기기의 시간대 기준)

export type ScheduleKind = 'visit' | 'center' | 'consult' | 'personal' | 'off'

export const SCHEDULE_KINDS: { value: ScheduleKind; label: string; color: string; bg: string }[] = [
  { value: 'visit', label: '방문 지도', color: '#0F6E56', bg: '#E8F6F4' },
  { value: 'center', label: '센터 지도', color: '#1D4ED8', bg: '#EFF6FF' },
  { value: 'consult', label: '상담', color: '#B45309', bg: '#FFF7ED' },
  { value: 'personal', label: '개인 일정', color: '#4B5563', bg: '#F3F4F6' },
  { value: 'off', label: '휴무', color: '#B91C1C', bg: '#FEF2F2' },
]

export function kindInfo(kind: string) {
  return SCHEDULE_KINDS.find((k) => k.value === kind) ?? SCHEDULE_KINDS[3]
}

export interface ScheduleItem {
  id: string
  kind: ScheduleKind
  title: string
  starts_at: string
  ends_at: string
  place: string
  memo: string
  room_id: string | null
}

export const SCHEDULE_FIELDS = 'id, kind, title, starts_at, ends_at, place, memo, room_id'
export const TITLE_MAX = 60
export const PLACE_MAX = 60
export const MEMO_MAX = 300

const pad = (n: number) => String(n).padStart(2, '0')
const DAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 'YYYY-MM-DD' (이 기기 시간대) */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** 그 주 월요일 0시 */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (x.getDay() + 6) % 7
  return addDays(x, -diff)
}

export function todayKey(): string {
  return dateKey(new Date())
}

export function dayName(d: Date): string {
  return DAYS[d.getDay()]
}

/** '10월 11일 (일)' */
export function dateLabel(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dayName(d)})`
}

/** 'HH:MM' (이 기기 시간대) */
export function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 날짜 'YYYY-MM-DD' + 'HH:MM' → ISO (이 기기 시간대) */
export function toIso(day: string, time: string): string {
  const [h, m] = time.split(':').map(Number)
  const d = fromDateKey(day)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** 오늘 0시 ~ 내일 0시 (ISO) */
export function todayRange(): { from: string; to: string } {
  const start = fromDateKey(todayKey())
  return { from: start.toISOString(), to: addDays(start, 1).toISOString() }
}

/** 지금 진행 중인지 / 끝났는지 */
export function itemState(item: Pick<ScheduleItem, 'starts_at' | 'ends_at'>): 'past' | 'now' | 'later' {
  const now = Date.now()
  const s = new Date(item.starts_at).getTime()
  const e = new Date(item.ends_at).getTime()
  if (e <= now) return 'past'
  if (s <= now) return 'now'
  return 'later'
}
