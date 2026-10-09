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

/** 분야를 보호자 눈높이로 풀어 쓴 한 줄 설명 */
export const PURPOSE_INFO: Record<string, string> = {
  '신경계 재활 운동': '뇌졸중·파킨슨병 등으로 약해진 균형·걷기·손 쓰기를 운동으로 다시 익혀요',
  '일상생활 동작 회복': '일어나 앉기, 옮겨 앉기, 화장실 가기 같은 생활 동작을 안전하게 연습해요',
  '보행·균형(낙상 예방)': '다리 힘과 균형을 길러 넘어질 위험을 줄이는 운동이에요',
  '수술 후 재활 운동': '수술 후 담당 의사가 허락한 범위 안에서 움직임과 근력을 되찾는 운동이에요',
  '근골격 재활 운동': '허리·무릎 등 불편한 관절 주변 근육을 운동으로 관리해요',
  '스포츠 재활 운동': '운동하다 다친 뒤 다시 운동으로 돌아가도록 돕는 운동이에요',
  '산후 재활 운동': '출산 후 약해진 근력과 자세를 되찾는 운동이에요',
  '자세교정 운동': '굽은 등·어깨처럼 무너진 자세를 바르게 하는 운동이에요',
  '필라테스': '몸통 힘과 유연성을 기르는 운동이에요',
  '1:1 PT': '목표에 맞춰 1:1로 근력과 체력을 기르는 운동이에요',
}

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

// ── 프로필 '질문답변' (숨고 참고) ─────────────────────────────
// 보호자가 연락하기 전에 자주 묻는 것을 전문가가 미리 답해 둔다. 답한 질문만 프로필에 보인다.
export const FAQ_QUESTIONS = [
  { key: 'process', q: '첫 만남은 어떻게 진행되나요?', ph: '예: 처음 30분은 생활 모습과 걷는 모습을 보고, 함께 운동 목표를 정해요' },
  { key: 'price', q: '비용은 어떻게 안내하나요?', ph: '예: 1회 60분 기준으로 상담 때 안내해요. 방문 거리에 따라 교통비가 더해질 수 있어요' },
  { key: 'prepare', q: '미리 준비할 것이 있나요?', ph: '예: 편한 옷과 운동화, 의자 하나 놓을 공간이면 충분해요' },
  { key: 'experience', q: '어떤 분들을 주로 지도해 보셨나요?', ph: '예: 뇌졸중 뒤 걷기 연습을 하시는 70~80대 어르신을 많이 만나요' },
  { key: 'schedule', q: '일정 변경·취소는 어떻게 하나요?', ph: '예: 하루 전까지 카카오톡으로 알려 주시면 날짜를 바꿔 드려요' },
] as const

export const FAQ_MAX = 300

/** DB에서 읽은 값·입력값을 정리: 정해진 질문만, 앞뒤 공백 제거, 빈 답은 빼고, 300자까지 */
export function cleanFaq(v: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!v || typeof v !== 'object') return out
  const src = v as Record<string, unknown>
  for (const { key } of FAQ_QUESTIONS) {
    const a = src[key]
    if (typeof a === 'string' && a.trim()) out[key] = a.trim().slice(0, FAQ_MAX)
  }
  return out
}

// ── 쓰면 안 되는 표현 (문서 01·02 표현 원칙: 의료행위·효과 보장으로 보일 수 있는 말) ──
const BANNED_PHRASES = ['완치', '효과 보장', '효과를 보장', '보장해 드', '보장합니다', '100% 효과', '도수', '고쳐 드', '고쳐드', '낫게 해', '진단해']

/** 문제 되는 표현을 찾으면 그 낱말을, 없으면 null ('물리치료사'라는 직업 이름은 괜찮음) */
export function findBannedPhrase(text: string): string | null {
  const t = text.replace(/\s+/g, ' ').replace(/물리치료사/g, '')
  if (t.includes('치료')) return '치료'
  return BANNED_PHRASES.find((p) => t.includes(p)) ?? null
}

export const bannedMessage = (word: string) =>
  `‘${word}’ 같은 표현은 쓸 수 없어요. 의료행위나 효과 보장으로 보일 수 있어요. ‘운동 지도’, ‘재활 운동’처럼 바꿔 주세요.`

/** 카카오 오픈채팅 주소만 허용. 'open.kakao.com/...'처럼 앞부분이 빠진 주소는 https를 붙여 줌 */
export function toOpenChatUrl(link: string): string | null {
  const v = link.trim()
  if (/^https:\/\/open\.kakao\.com\/./.test(v)) return v
  if (/^(http:\/\/)?open\.kakao\.com\/./.test(v)) return 'https://' + v.replace(/^http:\/\//, '')
  return null
}
