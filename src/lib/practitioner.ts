// 전문가(물리치료사) 프로필 공통 선택지 — 가입·마이페이지·사전 신청·검색이 함께 씀
// ⚠️ 분야·부위 라벨은 Supabase tags.label 과 글자 하나까지 같아야 검색이 됩니다.

// 활동 형태 (여러 개 선택)
export const WORK_TYPES = [
  { value: 'center_owner', label: '운동센터 운영', desc: '직접 운영하는 운동센터가 있어요' },
  { value: 'center_staff', label: '운동센터 소속', desc: '운동센터에 소속되어 지도해요' },
  { value: 'freelance_visit', label: '프리랜서 (방문)', desc: '보호자 댁으로 찾아가 운동을 지도해요' },
  { value: 'part_time', label: '파트타임 가능', desc: '육아·본업과 함께, 정해진 시간만 활동해요' },
]

export const WORK_TYPE_VALUES = WORK_TYPES.map((w) => w.value)

const CENTER_TYPES = ['center_owner', 'center_staff']
const VISIT_TYPE = 'freelance_visit'

export const hasCenterWork = (types?: string[] | null) =>
  (types ?? []).some((t) => CENTER_TYPES.includes(t))

export const hasVisitWork = (types?: string[] | null) => (types ?? []).includes(VISIT_TYPE)

/** 운영·소속·방문 중 하나는 있어야 어디서 활동하는지 알 수 있음 (파트타임만으로는 부족) */
export const hasPlaceWork = (types?: string[] | null) => hasCenterWork(types) || hasVisitWork(types)

/** 활동 형태 → 기존 service_mode 칸 값 (검색 필터가 이 칸을 씀) */
export function deriveServiceMode(types?: string[] | null): 'center' | 'visit' | 'both' | null {
  const center = hasCenterWork(types)
  const visit = hasVisitWork(types)
  if (center && visit) return 'both'
  if (visit) return 'visit'
  if (center) return 'center'
  return null
}

/** 저장된 순서와 상관없이 선택지 순서대로 라벨을 돌려줌 */
export function workTypeLabels(types?: string[] | null): string[] {
  const set = new Set(types ?? [])
  return WORK_TYPES.filter((w) => set.has(w.value)).map((w) => w.label)
}

/** 프로필 표시 이름: 모든 가입자는 물리치료사 면허 확인 대상 */
export function practitionerLabel(type?: string | null): string {
  // 예전(물찾사) 가입자 중 '움직임 전문가'를 고른 분만 다르게 표시
  return type === 'exercise_specialist' ? '운동 전문가' : '물리치료사'
}

export const BODY_PART_OPTIONS = ['목', '어깨', '허리', '무릎', '손목', '발목', '골반']

// 운동 지도 분야 — '치료' 표현은 쓰지 않음 (의료행위로 오해될 수 있음)
export const PURPOSE_OPTIONS = [
  '신경계 재활 운동',
  '일상생활 동작 회복',
  '보행·균형(낙상 예방)',
  '수술 후 재활 운동',
  '근골격 재활 운동',
  '스포츠 재활 운동',
  '산후 재활 운동',
  '자세교정 운동',
  '필라테스',
  '1:1 PT',
]

/** 가입 동의와 프로필에 함께 보여 주는 활동 원칙 */
export const PRACTICE_RULES = [
  '운동 지도·재활 운동 코칭 범위에서 활동해요',
  '도수·기기 치료 등 의료행위는 하지 않아요',
  '치료·완치·효과 보장 표현을 쓰지 않아요',
]

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const SLOT_LABELS: Record<string, string> = { morning: '오전', afternoon: '오후', evening: '저녁' }

/** ['1-morning', '2-morning', ...] → '평일 오전 · 토 저녁' */
export function summarizeAvailability(slots?: string[] | null): string {
  if (!slots || slots.length === 0) return ''
  const bySlot: Record<string, number[]> = {}
  slots.forEach((s) => {
    const [day, slot] = s.split('-')
    if (!bySlot[slot]) bySlot[slot] = []
    bySlot[slot].push(Number(day))
  })
  const parts: string[] = []
  ;['morning', 'afternoon', 'evening'].forEach((slot) => {
    const days = bySlot[slot]
    if (!days || days.length === 0) return
    const weekdays = days.filter((d) => d >= 1 && d <= 5)
    const weekend = days.filter((d) => d === 0 || d === 6)
    const chunk: string[] = []
    if (weekdays.length === 5) chunk.push('평일')
    else if (weekdays.length > 0) chunk.push(weekdays.sort().map((d) => DAY_LABELS[d]).join('·'))
    if (weekend.length > 0) chunk.push(weekend.sort().map((d) => DAY_LABELS[d]).join('·'))
    if (chunk.length > 0) parts.push(`${chunk.join('·')} ${SLOT_LABELS[slot]}`)
  })
  return parts.join(' · ')
}
