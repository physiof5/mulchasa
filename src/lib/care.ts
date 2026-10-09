// 보호자용 '부모님 상황 맞춤 찾기' — 질문 선택지, 추천 규칙, 제도 '다음 할 일'
// 답변은 화면(기기) 안에서만 쓰고 서버에 보내지 않는다. 방문 요청서로 넘길 때만 sessionStorage에 잠시 둔다.

export type Who = 'mother' | 'father' | 'other'
export type AgeBand = '65plus' | 'under65'
export type Mobility = 'independent' | 'aid' | 'assist' | 'bed'
export type Condition = 'stroke' | 'parkinson' | 'dementia' | 'surgery' | 'joint' | 'frail'
export type Fell = 'yes' | 'no' | 'unknown'
export type Grade = 'yes' | 'waiting' | 'no' | 'unknown'
export type Place = 'home' | 'center' | 'both'

export interface Situation {
  who: Who
  age: AgeBand
  mobility: Mobility
  conditions: Condition[]
  fell: Fell
  grade: Grade
  place: Place
}

export interface Option<T extends string> {
  value: T
  label: string
  desc?: string
}

export const WHO_OPTIONS: Option<Who>[] = [
  { value: 'mother', label: '어머님' },
  { value: 'father', label: '아버님' },
  { value: 'other', label: '다른 가족', desc: '배우자·조부모님 등' },
]

export const AGE_OPTIONS: Option<AgeBand>[] = [
  { value: '65plus', label: '65세 이상이세요' },
  { value: 'under65', label: '65세가 안 되셨어요' },
]

export const MOBILITY_OPTIONS: Option<Mobility>[] = [
  { value: 'independent', label: '혼자 잘 걸으세요', desc: '지팡이 없이 집 안팎을 다니세요' },
  { value: 'aid', label: '지팡이·보행기를 쓰세요', desc: '혼자 걷지만 짚을 것이 필요해요' },
  { value: 'assist', label: '옆에서 부축해야 걸으세요', desc: '혼자 걷기는 불안해요' },
  { value: 'bed', label: '주로 누워 계시거나 휠체어를 쓰세요', desc: '침대·휠체어에서 지내는 시간이 길어요' },
]

export const CONDITION_OPTIONS: Option<Condition>[] = [
  { value: 'stroke', label: '뇌졸중(중풍)' },
  { value: 'parkinson', label: '파킨슨병' },
  { value: 'dementia', label: '치매·기억력 저하' },
  { value: 'surgery', label: '골절·관절 수술을 받으셨어요' },
  { value: 'joint', label: '허리·무릎 등 관절이 불편하세요' },
  { value: 'frail', label: '특별한 병은 없지만 기운이 많이 떨어지셨어요' },
]
/** '특별한 병은 없지만'은 다른 항목과 함께 고를 수 없음 */
export const EXCLUSIVE_CONDITION: Condition = 'frail'

export const FALL_OPTIONS: Option<Fell>[] = [
  { value: 'yes', label: '네, 넘어지신 적이 있어요' },
  { value: 'no', label: '아니요' },
  { value: 'unknown', label: '잘 모르겠어요' },
]

export const GRADE_OPTIONS: Option<Grade>[] = [
  { value: 'yes', label: '네, 있어요', desc: '1~5등급 또는 인지지원등급' },
  { value: 'waiting', label: '신청해서 결과를 기다려요' },
  { value: 'no', label: '아니요, 없어요' },
  { value: 'unknown', label: '잘 모르겠어요' },
]

export const PLACE_OPTIONS: Option<Place>[] = [
  { value: 'home', label: '집으로 와 주세요', desc: '거동이 불편하시면 추천해요' },
  { value: 'center', label: '가까운 운동센터로 갈게요', desc: '물리치료사가 운영하는 운동센터' },
  { value: 'both', label: '둘 다 괜찮아요' },
]

export const labelOf = <T extends string>(options: Option<T>[], value: T | undefined | null) =>
  options.find((o) => o.value === value)?.label ?? ''

/** 받침에 맞춰 '을/를' (괄호·따옴표는 건너뛰고 마지막 한글 글자로 판단, 영문 끝은 '를') */
export function eulReul(word: string): string {
  const clean = word.replace(/[)\]'"’”\s]+$/u, '')
  const last = clean.charCodeAt(clean.length - 1)
  if (last >= 0xac00 && last <= 0xd7a3) return (last - 0xac00) % 28 === 0 ? '를' : '을'
  return '를'
}

export function honorific(who?: Who | null): string {
  if (who === 'mother') return '어머님'
  if (who === 'father') return '아버님'
  return '가족분'
}

const NEURO: Condition[] = ['stroke', 'parkinson']
/** 65세 미만도 장기요양을 신청할 수 있는 노인성 질병 (선택지 중) */
const GERIATRIC_DISEASES: Condition[] = ['stroke', 'parkinson', 'dementia']

/** 상황 → 운동 지도 분야(tags.label) 추천, 앞쪽이 대표 */
export function recommendPurposes(s: Situation): string[] {
  const has = (c: Condition) => s.conditions.includes(c)
  const list: string[] = []
  if (NEURO.some(has)) list.push('신경계 재활 운동')
  if (has('surgery')) list.push('수술 후 재활 운동')
  if (s.mobility === 'assist' || s.mobility === 'bed' || has('dementia') || has('frail')) {
    list.push('일상생활 동작 회복')
  }
  if (s.fell === 'yes' || s.mobility === 'aid' || s.mobility === 'assist') list.push('보행·균형(낙상 예방)')
  if (has('joint')) list.push('근골격 재활 운동')
  if (list.length === 0) list.push('보행·균형(낙상 예방)')
  return Array.from(new Set(list))
}

/** 장기요양 신청 대상: 소득 무관, 65세 이상 또는 65세 미만 노인성 질병 */
export function isLtcEligible(s: Pick<Situation, 'age' | 'conditions'>): boolean {
  return s.age === '65plus' || s.conditions.some((c) => GERIATRIC_DISEASES.includes(c))
}

// ── 공식 안내처 (2026-10-09 확인) ─────────────────────────
export const LINKS = {
  ltcApplyGuide: 'https://www.nhis.or.kr/static/html/wbda/c/wbdac02.html', // 국민건강보험공단 장기요양인정 신청절차
  ltcHome: 'https://www.longtermcare.or.kr', // 노인장기요양보험 누리집
  bokjiro: 'https://www.bokjiro.go.kr', // 복지로
  blog: 'https://blog.naver.com/spacex_2025',
}
export const PHONES = {
  nhis: { label: '국민건강보험공단', number: '1577-1000' },
  dementia: { label: '치매상담콜센터', number: '1899-9988' },
  nps: { label: '국민연금공단', number: '1355' },
  welfare: { label: '보건복지상담센터', number: '129' },
}

export interface StepAction {
  label: string
  href: string
  external?: boolean
}
export interface NextStep {
  id: string
  title: string
  body: string[]
  actions: StepAction[]
}

/** 결과 화면의 제도 '다음 할 일' (사회복지사 관점) */
export function nextSteps(s: Situation): NextStep[] {
  const steps: NextStep[] = []
  const eligible = isLtcEligible(s)
  const has = (c: Condition) => s.conditions.includes(c)
  const tel = (n: string) => `tel:${n.replace(/-/g, '')}`

  if ((s.grade === 'no' || s.grade === 'unknown') && eligible) {
    const body = [
      '소득과 상관없이 65세 이상이거나, 65세 미만이라도 치매·뇌졸중·파킨슨병 같은 노인성 질병이 있으면 신청할 수 있어요.',
      '등급을 받으면 방문요양·주간보호·복지용구 같은 돌봄 서비스를 비용 일부만 내고 이용할 수 있어요. 가족이 대신 신청할 수도 있어요.',
    ]
    if (s.age === 'under65') {
      body.push('장애인 활동지원을 받고 있거나 받을 예정이라면, 장기요양등급을 받은 뒤 활동지원 신청이 제한될 수 있어요. 먼저 국민연금공단(1355)에 물어보세요.')
    }
    steps.push({
      id: 'ltc-apply',
      title: '장기요양등급을 신청해 볼 수 있어요',
      body,
      actions: [
        { label: '1분 등급 예상해 보기', href: '/check/ltc' },
        { label: '신청 방법 보기 (건강보험공단)', href: LINKS.ltcApplyGuide, external: true },
        { label: `공단 상담 ${PHONES.nhis.number}`, href: tel(PHONES.nhis.number) },
      ],
    })
  }

  if (s.age === 'under65' && !eligible && s.grade !== 'yes') {
    steps.push({
      id: 'under65',
      title: '65세 미만이라면 다른 제도도 함께 살펴봐요',
      body: [
        '65세 미만은 치매·뇌졸중·파킨슨병 같은 노인성 질병이 있을 때만 장기요양을 신청할 수 있어요.',
        '장애가 있다면 장애인 활동지원 같은 제도가 맞을 수 있어요. 보건복지상담센터(129)에서 받을 수 있는 지원을 물어볼 수 있어요.',
      ],
      actions: [
        { label: '복지로에서 찾아보기', href: LINKS.bokjiro, external: true },
        { label: `보건복지상담 ${PHONES.welfare.number}`, href: tel(PHONES.welfare.number) },
      ],
    })
  }

  if (s.grade === 'waiting') {
    steps.push({
      id: 'ltc-waiting',
      title: '방문조사 때는 평소 모습 그대로',
      body: [
        '공단 직원이 집으로 와서 몸 상태와 생활 모습을 살펴봐요.',
        '밤에 화장실 가기, 옷 입기처럼 평소 힘들어하시는 순간을 미리 적어 두면 빠뜨리지 않고 말씀드릴 수 있어요.',
      ],
      actions: [{ label: '장기요양 글 읽기 (블로그)', href: LINKS.blog, external: true }],
    })
  }

  if (s.grade === 'yes') {
    steps.push({
      id: 'equipment',
      title: '복지용구로 안전용품을 마련할 수 있어요',
      body: [
        '장기요양등급이 있으면 안전손잡이·미끄럼방지용품·성인용 보행기 같은 복지용구를 정해진 한도 안에서 비용 일부만 내고 사거나 빌릴 수 있어요.',
        '품목과 남은 한도는 공단 누리집이나 전화로 확인할 수 있어요.',
      ],
      actions: [
        { label: '노인장기요양보험 누리집', href: LINKS.ltcHome, external: true },
        { label: '복지용구 글 읽기 (블로그)', href: LINKS.blog, external: true },
      ],
    })
  }

  if (s.fell === 'yes' || s.mobility === 'aid' || s.mobility === 'assist') {
    steps.push({
      id: 'fall',
      title: '넘어질 위험을 1분 만에 점검해 보세요',
      body: [
        '최근에 넘어지셨거나 짚고 걸으신다면 다시 넘어질 위험이 높을 수 있어요.',
        '몸 상태와 함께 집 안 위험한 곳(화장실·문턱·조명)도 확인해요.',
      ],
      actions: [{ label: '낙상 위험 1분 체크', href: '/check/fall' }],
    })
  }

  if (has('dementia')) {
    steps.push({
      id: 'dementia',
      title: '치매안심센터에서 검진·상담을 받을 수 있어요',
      body: [
        '가까운 보건소의 치매안심센터에서 치매 검진과 가족 상담을 받을 수 있어요.',
        '장기요양 5등급·인지지원등급은 치매가 있는 분이 받는 등급이라, 진단을 받아 두는 것이 중요해요.',
      ],
      actions: [{ label: `치매상담콜센터 ${PHONES.dementia.number}`, href: tel(PHONES.dementia.number) }],
    })
  }

  return steps
}

/** 결과 화면 안전 안내 (운동 지도는 진료를 대신하지 않음) */
export function safetyNotes(s: Situation): string[] {
  const notes = ['운동 지도는 진료를 대신하지 않아요. 최근 갑자기 생긴 마비·말 어눌함·심한 어지럼은 운동보다 먼저 병원에 가 주세요. 위급하면 119.']
  if (s.conditions.includes('surgery')) {
    notes.push('수술 후라면 담당 의사가 허락한 운동 범위를 먼저 확인해 주세요.')
  }
  return notes
}

// ── 방문 요청서로 넘기는 값 (기기 안 sessionStorage, 서버로 가는 건 요청서 동의 후) ──
export const SITUATION_KEY = 'care_situation'

export interface StoredSituation extends Situation {
  purpose: string
}

export function saveSituation(s: StoredSituation) {
  try {
    sessionStorage.setItem(SITUATION_KEY, JSON.stringify(s))
  } catch {
    // 저장이 막혀 있어도 흐름은 그대로 진행
  }
}

const isOneOf = <T extends string>(options: Option<T>[], v: unknown): v is T =>
  typeof v === 'string' && options.some((o) => o.value === v)

/** 저장된 글자를 꺼내기 (막혀 있으면 null) */
export function readSituationRaw(): string | null {
  try {
    return sessionStorage.getItem(SITUATION_KEY)
  } catch {
    return null
  }
}

/** 저장된 값의 형식 검사 (깨진 값이면 null) */
export function parseSituation(raw: string | null): StoredSituation | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    const conditions = Array.isArray(v.conditions)
      ? (v.conditions as unknown[]).filter((c): c is Condition => isOneOf(CONDITION_OPTIONS, c))
      : []
    if (
      isOneOf(WHO_OPTIONS, v.who) && isOneOf(AGE_OPTIONS, v.age) && isOneOf(MOBILITY_OPTIONS, v.mobility) &&
      isOneOf(FALL_OPTIONS, v.fell) && isOneOf(GRADE_OPTIONS, v.grade) && isOneOf(PLACE_OPTIONS, v.place) &&
      typeof v.purpose === 'string'
    ) {
      return { who: v.who, age: v.age, mobility: v.mobility, conditions, fell: v.fell, grade: v.grade, place: v.place, purpose: v.purpose }
    }
    return null
  } catch {
    return null
  }
}

/** 요청서·상담 메시지에 쓰는 한 줄 요약들 (장기요양등급은 최소 수집 원칙에 따라 넣지 않음) */
export function situationLines(s: Situation): { icon: string; label: string; value: string }[] {
  const conditionText = s.conditions.map((c) => labelOf(CONDITION_OPTIONS, c)).join(', ')
  const ageText = s.age === '65plus' ? '65세 이상' : '65세 미만'
  return [
    { icon: '👤', label: '대상', value: `${honorific(s.who)} (${ageText})` },
    { icon: '🚶', label: '거동', value: labelOf(MOBILITY_OPTIONS, s.mobility) },
    ...(conditionText ? [{ icon: '📋', label: '상황', value: conditionText }] : []),
    { icon: '⚠️', label: '최근 1년 낙상', value: s.fell === 'yes' ? '있어요' : s.fell === 'no' ? '없어요' : '잘 모르겠어요' },
    { icon: '🏠', label: '희망 장소', value: labelOf(PLACE_OPTIONS, s.place) },
  ]
}
