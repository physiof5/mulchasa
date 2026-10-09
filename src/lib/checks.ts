// 1분 자가진단 — 낙상 위험 체크 · 장기요양등급 예상
// ⚠️ 참고용. 결과는 이 기기(localStorage)에만 저장하고 서버로 보내지 않는다.
// 표현 원칙: '예상·참고용·가능성'만 쓰고 '합격·보장·확정'은 쓰지 않는다 (문서 01·02).

// ── 낙상 위험 ──────────────────────────────────────────────
// 미국 질병통제예방센터(CDC) STEADI 'Stay Independent' 점검표 12문항 (Rubenstein 등, 2011)
// 보호자가 부모님을 대신 답하는 말투로 옮김. '예' 점수 합계 4점 이상이면 넘어질 위험이 있을 수 있음.

export interface FallQuestion {
  id: string
  text: string
  points: number
  why: string
  tip: string
}

export const FALL_QUESTIONS: FallQuestion[] = [
  { id: 'fell', text: '지난 1년 안에\n넘어지신 적이 있나요?', points: 2, why: '한 번 넘어지신 분은 다시 넘어지기 쉬워요.', tip: '넘어졌던 때의 시간·장소·동작을 적어 두었다가 진료나 운동 지도 때 알려 주세요.' },
  { id: 'aid', text: '지팡이나 보행기를 쓰시거나,\n쓰라는 권유를 받으셨나요?', points: 2, why: '보조기구가 필요하다는 건 이미 넘어질 위험이 있다는 뜻일 수 있어요.', tip: '키에 맞게 높이를 맞춘 보조기구를 쓰고, 바르게 쓰는 법을 함께 익혀요.' },
  { id: 'unsteady', text: '걸으실 때 가끔\n휘청거리거나 불안해 보이시나요?', points: 1, why: '휘청거림은 균형이 약해졌다는 신호예요.', tip: '균형 운동을 안전하게 배우면 도움이 돼요.' },
  { id: 'furniture', text: '집 안에서 가구를\n짚으며 걸으시나요?', points: 1, why: '가구를 짚는 것도 균형이 약해졌다는 신호예요.', tip: '자주 다니는 길에 손잡이를 달고, 바닥의 물건을 치워 두세요.' },
  { id: 'worry', text: '넘어질까 봐\n걱정하시나요?', points: 1, why: '넘어질까 두려우면 덜 움직이게 되고, 그만큼 다리 힘이 약해져요.', tip: '안전한 곳에서 조금씩 움직이며 자신감을 되찾는 게 중요해요.' },
  { id: 'chair', text: '의자에서 일어나실 때\n손으로 짚어야 하나요?', points: 1, why: '다리 근육이 약해졌다는 신호예요. 넘어지는 큰 이유 중 하나예요.', tip: '앉았다 일어서기 같은 다리 근력 운동이 도움이 돼요.' },
  { id: 'curb', text: '길의 턱(보도 턱)을\n올라가기 힘들어하시나요?', points: 1, why: '이것도 다리 힘이 약해졌다는 신호예요.', tip: '계단·턱 오르기 연습은 전문가와 함께 안전하게 시작하세요.' },
  { id: 'toilet', text: '화장실에 급하게\n가셔야 할 때가 많나요?', points: 1, why: '특히 밤에 서둘러 화장실에 가다 넘어지는 일이 많아요.', tip: '침실에서 화장실까지 밤에도 켜지는 센서등을 달아 두세요.' },
  { id: 'feet', text: '발의 감각이\n둔해지셨나요?', points: 1, why: '발 감각이 둔하면 걸려 넘어지기 쉬워요.', tip: '발에 잘 맞고 바닥이 미끄럽지 않은 신발을 신으세요. 감각이 둔해진 것은 진료 때 꼭 말씀하세요.' },
  { id: 'dizzy_med', text: '어지럽거나 평소보다 피곤하게\n만드는 약을 드시나요?', points: 1, why: '약의 부작용이 넘어질 위험을 높일 수 있어요.', tip: '드시는 약 목록을 들고 의사·약사와 상의해 보세요. 약을 마음대로 끊지는 마세요.' },
  { id: 'sleep_med', text: '잠이나 기분을 위해\n드시는 약이 있나요?', points: 1, why: '수면제·안정제 같은 약은 넘어질 위험을 높일 수 있어요.', tip: '의사·약사에게 넘어질 위험이 없는지 물어보세요.' },
  { id: 'sad', text: '자주 우울하거나\n기운이 없어 보이시나요?', points: 1, why: '우울한 마음은 넘어짐과 관련이 있어요.', tip: '마음이 힘들어 보이시면 진료 때나 가까운 정신건강복지센터에서 상담을 받아 보세요.' },
]

export const FALL_MAX_SCORE = FALL_QUESTIONS.reduce((sum, q) => sum + q.points, 0) // 14
export const FALL_RISK_THRESHOLD = 4

export interface HomeHazard {
  id: string
  text: string
  tip: string
  /** 장기요양등급이 있으면 복지용구(안전손잡이·미끄럼방지용품·경사로 등)로 마련 가능 */
  welfareEquipment: boolean
}

// 집 안 환경 점검 (화장실·문턱·조명·동선 — 문서 01 '낙상 위험' 기획)
export const HOME_HAZARDS: HomeHazard[] = [
  { id: 'bathroom', text: '화장실 바닥이 미끄럽고, 잡을 손잡이가 없어요', tip: '미끄럼방지 매트를 깔고 변기·욕조 옆에 안전손잡이를 달아 주세요.', welfareEquipment: true },
  { id: 'threshold', text: '현관·방문에 걸려 넘어질 만한 문턱이 있어요', tip: '문턱을 없애거나 경사로를 대어 높이 차이를 줄여요.', welfareEquipment: true },
  { id: 'light', text: '밤에 화장실 가는 길이 어두워요', tip: '센서등·수면등으로 침실에서 화장실까지 길을 밝혀 주세요.', welfareEquipment: false },
  { id: 'clutter', text: '바닥에 전선·물건·작은 깔개가 있어요', tip: '다니는 길의 물건을 치우고, 미끄러지는 깔개는 치우거나 고정해요.', welfareEquipment: false },
  { id: 'stairs', text: '계단·높낮이 차이가 있는데 손잡이가 없어요', tip: '손잡이를 달고, 계단 끝에 눈에 띄는 표시를 붙여요.', welfareEquipment: false },
  { id: 'bed', text: '침대·의자가 너무 낮거나 높아 일어나기 힘들어요', tip: '앉았을 때 무릎이 직각이 되는 높이가 일어나기 편해요.', welfareEquipment: false },
]

export function fallScore(answers: Record<string, boolean>): number {
  return FALL_QUESTIONS.reduce((sum, q) => sum + (answers[q.id] ? q.points : 0), 0)
}

// ── 장기요양등급 예상 ────────────────────────────────────────
// 공단 인정조사(신체·인지·행동·간호·재활 영역)와 의사소견서를 대신할 수 없는 '간이 점검'.
// 일상생활 동작 8가지 + 치매·행동·간호 3가지로 도움이 필요한 정도를 보고,
// 공단이 밝힌 등급별 상태 설명과 가장 가까운 범위를 보여 준다.

export type Eligibility = '65plus' | 'under65_disease' | 'under65_none'

export const ELIGIBILITY_OPTIONS: { value: Eligibility; label: string; desc?: string }[] = [
  { value: '65plus', label: '65세 이상이세요' },
  { value: 'under65_disease', label: '65세 미만이지만 치매·뇌졸중·파킨슨병 등이 있으세요', desc: '노인성 질병이 있으면 65세 미만도 신청할 수 있어요' },
  { value: 'under65_none', label: '65세 미만이고, 해당 질병은 없으세요' },
]

export interface LtcItem {
  id: string
  title: string
  options: [string, string, string] // 0점·1점·2점
}

const HELP3: [string, string, string] = ['혼자 하세요', '조금 도와드려요', '거의 다 도와드려요']

export const ADL_ITEMS: LtcItem[] = [
  { id: 'dress', title: '옷 입고 벗기', options: HELP3 },
  { id: 'wash', title: '세수·양치하기', options: HELP3 },
  { id: 'bath', title: '목욕하기', options: HELP3 },
  { id: 'eat', title: '식사하기', options: HELP3 },
  { id: 'transfer', title: '앉았다 일어나기·\n자리 옮기기', options: HELP3 },
  { id: 'move', title: '방 밖으로 나오기\n(집 안에서 다니기)', options: HELP3 },
  { id: 'toilet', title: '화장실 쓰기\n(뒤처리 포함)', options: HELP3 },
  { id: 'continence', title: '대소변 가리기', options: ['실수 없으세요', '가끔 실수하세요', '자주 실수하세요'] },
]

export type Dementia = 'diagnosed' | 'memory' | 'none'
export const DEMENTIA_OPTIONS: { value: Dementia; label: string }[] = [
  { value: 'diagnosed', label: '네, 진단받으셨어요' },
  { value: 'memory', label: '진단은 없지만 기억력이 많이 떨어지셨어요' },
  { value: 'none', label: '아니요' },
]

export const BEHAVIOR_ITEM: LtcItem = {
  id: 'behavior',
  title: '길을 잃거나, 밤에 돌아다니시거나,\n의심·화를 자주 내시나요?',
  options: ['없어요', '가끔 있어요', '자주 있어요'],
}

export const NURSING_OPTIONS = [
  { value: false, label: '없어요' },
  { value: true, label: '있어요' },
]

export type LtcBand = 'g12' | 'g23' | 'g34' | 'g45' | 'g4' | 'g5c' | 'memory_check' | 'none' | 'not_eligible'

export interface LtcInput {
  eligibility: Eligibility
  adl: Record<string, number> // 0~2
  dementia: Dementia
  behavior: number // 0~2
  nursing: boolean
}

export function ltcBand(input: LtcInput): LtcBand {
  if (input.eligibility === 'under65_none') return 'not_eligible'
  const adlScores = ADL_ITEMS.map((i) => input.adl[i.id] ?? 0)
  const adl = adlScores.reduce((a, b) => a + b, 0)
  const fullHelp = adlScores.filter((v) => v === 2).length
  const total = adl + input.behavior + (input.nursing ? 2 : 0) // 0~20
  const hasDementia = input.dementia === 'diagnosed'

  if (total >= 14 || fullHelp >= 6) return 'g12'
  if (total >= 9) return 'g23'
  if (total >= 5) return 'g34'
  if (total >= 2) return hasDementia || input.dementia === 'memory' ? 'g45' : 'g4'
  if (hasDementia) return 'g5c'
  if (input.dementia === 'memory') return 'memory_check'
  return 'none'
}

export const LTC_BAND_TEXT: Record<LtcBand, { headline: string; detail: string }> = {
  g12: { headline: '1~2등급 범위일\n가능성이 있어요', detail: '일상생활 대부분에 다른 사람의 도움이 필요한 상태로 보여요.' },
  g23: { headline: '2~3등급 범위일\n가능성이 있어요', detail: '일상생활의 상당 부분에 도움이 필요한 상태로 보여요.' },
  g34: { headline: '3~4등급 범위일\n가능성이 있어요', detail: '일상생활의 일부에 도움이 필요한 상태로 보여요.' },
  g45: { headline: '4~5등급 또는 인지지원등급\n범위일 가능성이 있어요', detail: '도움이 필요한 일이 조금 있고, 기억력 문제도 함께 있는 상태로 보여요. 5등급·인지지원등급은 치매가 있는 분이 받는 등급이에요.' },
  g4: { headline: '4등급 근처이거나\n등급 외일 수 있어요', detail: '도움이 필요한 일이 조금 있는 상태로 보여요. 경계에 있어 실제 조사 결과에 따라 달라질 수 있어요.' },
  g5c: { headline: '5등급 또는 인지지원등급\n범위일 가능성이 있어요', detail: '몸은 대부분 스스로 움직이시지만 치매가 있는 상태로 보여요.' },
  memory_check: { headline: '먼저 치매 검진을\n받아 보시길 권해요', detail: '몸은 대부분 스스로 움직이시는데 기억력이 떨어지셨다면, 치매 진단 여부에 따라 5등급·인지지원등급을 받을 수 있는지가 달라져요.' },
  none: { headline: '지금 상태로는 등급 외일\n가능성이 있어요', detail: '일상생활을 대부분 스스로 하시는 상태로 보여요. 신청은 누구나 할 수 있고, 상태가 바뀌면 다시 신청할 수 있어요.' },
  not_eligible: { headline: '장기요양 신청 대상이\n아닐 수 있어요', detail: '65세 미만은 치매·뇌졸중·파킨슨병 같은 노인성 질병이 있을 때만 장기요양을 신청할 수 있어요. 다른 제도를 함께 살펴봐요.' },
}

// 국민건강보험공단이 밝힌 등급별 상태와 장기요양인정점수 (nhis.or.kr, 2026-10-09 확인)
export const OFFICIAL_GRADES = [
  { grade: '1등급', desc: '일상생활에서 전적으로 다른 사람의 도움이 필요한 상태', score: '95점 이상' },
  { grade: '2등급', desc: '일상생활에서 상당 부분 다른 사람의 도움이 필요한 상태', score: '75점 이상 95점 미만' },
  { grade: '3등급', desc: '일상생활에서 부분적으로 다른 사람의 도움이 필요한 상태', score: '60점 이상 75점 미만' },
  { grade: '4등급', desc: '심신의 기능 상태 장애로 일상생활에서 일정 부분 다른 사람의 도움이 필요한 상태', score: '51점 이상 60점 미만' },
  { grade: '5등급', desc: '치매 환자 (노인성 질병으로 한정)', score: '45점 이상 51점 미만' },
  { grade: '인지지원등급', desc: '치매 환자 (노인성 질병으로 한정)', score: '45점 미만' },
]

/** 문서 01·02에서 정한 고지 문구 (문구 그대로 표시) */
export const LTC_DISCLAIMER = '참고용이며 공식 판정은 국민건강보험공단 방문조사와 등급판정위원회를 거칩니다'

// ── 지난 결과 (이 기기에만, 답변 없이 결과 요약만) ──────────────
export const LAST_RESULT_KEYS = { fall: 'check_fall_last', ltc: 'check_ltc_last', cost: 'check_cost_last' } as const

export interface LastResult {
  at: string // ISO 날짜
  summary: string
}

export function saveLastResult(kind: keyof typeof LAST_RESULT_KEYS, summary: string) {
  try {
    const value: LastResult = { at: new Date().toISOString(), summary }
    localStorage.setItem(LAST_RESULT_KEYS[kind], JSON.stringify(value))
  } catch {
    // 저장이 막혀 있어도 결과 화면은 그대로
  }
}

export function parseLastResult(raw: string | null): LastResult | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    return typeof v?.at === 'string' && typeof v?.summary === 'string' ? { at: v.at, summary: v.summary } : null
  } catch {
    return null
  }
}
