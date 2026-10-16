// 진행 후기 — 전문가(물리치료사)가 10회 이상 함께한 회원의 운동 지도 기록을 쓰고, 회원이 공개에 동의해야 공개
// · 회원 이름은 '김OO님'·'김 **님'처럼 성만 · 얼굴 등 알아볼 수 있는 부분은 모자이크 후 올림
// · 사진 2~5장 + 양식(나이대 · 첫 만남 때 상황 · 운동 지도 방법 · 변화)
// · 회원은 공개할 때 만족도 별점·한마디를 남길 수 있고(선택), 언제든 내릴 수 있음

import { findBannedPhrase } from '@/lib/practitioner'

export const REVIEW_BUCKET = 'case-reviews'
export const PHOTO_MIN = 2
export const PHOTO_MAX = 5
export const SESSIONS_MIN = 10
export const SESSIONS_MAX = 300

export const AGE_BANDS = ['40대 이하', '50대', '60대', '70대', '80대', '90대 이상'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

/** 운동 목표 (하나 고르기, 선택) — '치료' 표현은 쓰지 않음 */
export const PURPOSE_CHIPS = ['보행 연습', '낙상 예방', '근력 운동', '균형 운동', '일상생활 동작', '수술 후 재활 운동', '관절 움직임 운동', '자세 운동'] as const

export type LabelStyle = 'OO' | '**'
export const SURNAME_RE = /^[가-힣]{1,2}$/

export function memberLabel(surname: string, style: LabelStyle): string {
  const s = surname.trim()
  return style === 'OO' ? `${s}OO님` : `${s} **님`
}

/** 저장된 표시 이름 → 성·형식 (고쳐 쓸 때) */
export function parseLabel(label: string): { surname: string; style: LabelStyle } {
  const m = label.match(/^([가-힣]{1,2}) ?(OO|\*\*) ?님$/)
  return m ? { surname: m[1], style: m[2] as LabelStyle } : { surname: '', style: 'OO' }
}

export const FIELDS = {
  first_state: {
    label: '첫 만남 때 상황',
    min: 10,
    max: 500,
    placeholder: '예) 뇌졸중 후 6개월째. 지팡이를 짚고도 10m 걷기를 힘들어하셨고, 넘어질까 봐 외출을 꺼리셨어요.',
  },
  approach: {
    label: '이렇게 운동을 지도했어요',
    min: 10,
    max: 800,
    placeholder: '예) 주 2회 댁으로 찾아가 앉았다 일어서기·제자리 균형 운동을 했어요. 화장실 가는 길의 손잡이 위치도 함께 점검했어요.',
  },
  changes: {
    label: '이런 변화가 있었어요',
    min: 10,
    max: 500,
    placeholder: '예) 10회째에는 지팡이 없이 거실을 걸으시고, 보호자와 함께 동네 산책을 시작하셨어요.',
  },
} as const
export type TextKey = keyof typeof FIELDS

export type ReviewStatus = 'pending' | 'published' | 'declined' | 'hidden'

export interface CaseReview {
  id: string
  room_id?: string | null
  therapist_id: string
  member_label: string
  age_band: string
  sessions: number
  purpose: string
  first_state: string
  approach: string
  changes: string
  photos: string[]
  status: ReviewStatus
  hidden_by: 'member' | 'expert' | 'admin' | null
  member_rating: number | null
  member_comment: string
  decline_reason: string
  submit_count: number
  submitted_at: string
  decided_at: string | null
  published_at: string | null
}

export interface CaseReviewView {
  role: 'expert' | 'member' | 'public'
  review: CaseReview
  therapist: { id: string; name: string; photo: string | null; years: number | null; studio: string | null }
}

export interface MyReviewItem {
  id: string
  role: 'expert' | 'member'
  member_label: string
  age_band: string
  sessions: number
  status: ReviewStatus
  hidden_by: CaseReview['hidden_by']
  photo: string | null
  member_rating: number | null
  therapist_name: string
  submitted_at: string
  published_at: string | null
  room_id: string | null
}

/** 공개 목록(프로필·홈)에서 읽는 칸 */
export const PUBLIC_FIELDS = 'id, therapist_id, member_label, age_band, sessions, purpose, first_state, approach, changes, photos, member_rating, member_comment, published_at'
export type PublicReview = Pick<
  CaseReview,
  'id' | 'therapist_id' | 'member_label' | 'age_band' | 'sessions' | 'purpose' | 'first_state' | 'approach' | 'changes' | 'photos' | 'member_rating' | 'member_comment' | 'published_at'
>

export const REVIEW_DISCLAIMER = '전문가가 작성하고 회원이 공개에 동의한 진행 기록이에요 · 결과는 사람마다 다를 수 있어요 · 운동 지도는 진료를 대신하지 않아요'

export function statusInfo(status: ReviewStatus, hiddenBy?: CaseReview['hidden_by']): { label: string; bg: string; color: string } {
  if (status === 'published') return { label: '공개 중', bg: '#E8F6F4', color: '#0F6E56' }
  if (status === 'pending') return { label: '회원 확인 중', bg: '#FFF4E5', color: '#B45309' }
  if (status === 'declined') return { label: '공개 안 함', bg: '#F2F4F6', color: '#6B7280' }
  return { label: hiddenBy === 'member' ? '회원이 내림' : hiddenBy === 'admin' ? '운영팀이 숨김' : '숨김', bg: '#F2F4F6', color: '#6B7280' }
}

/** 글 검사: 의료행위·효과 보장 표현, 전화번호 */
export function textProblem(text: string): string | null {
  const banned = findBannedPhrase(text)
  if (banned) return `‘${banned}’ 같은 표현은 쓸 수 없어요. ‘운동 지도’, ‘재활 운동’처럼 바꿔 주세요.`
  if (/01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/.test(text)) return '전화번호는 적을 수 없어요.'
  return null
}

/** 공개 사진 주소 → 보관함 안의 경로 (지울 때) */
export function photoPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${REVIEW_BUCKET}/`
  const i = url.indexOf(marker)
  return i < 0 ? null : decodeURIComponent(url.slice(i + marker.length))
}

const ERRORS: Record<string, string> = {
  face_check_required: '사진 속 얼굴을 가렸는지 확인하고 체크해 주세요.',
  bad_label: '회원 표시는 ‘김OO님’ 또는 ‘김 **님’처럼 성만 적어 주세요.',
  too_few_sessions: `${SESSIONS_MIN}회 이상 진행한 뒤에 쓸 수 있어요.`,
  text_length: '각 칸을 10자 이상 적어 주세요.',
  bad_photos: `사진을 ${PHOTO_MIN}~${PHOTO_MAX}장 올려 주세요.`,
  already_published: '이미 공개된 후기예요. 고치려면 먼저 숨겨 주세요.',
  withdrawn: '회원이 내린 후기는 다시 올릴 수 없어요.',
  too_many_submits: '같은 회원에게는 3번까지만 공개를 요청할 수 있어요.',
  already_decided: '이미 답한 후기예요.',
  not_expert: '승인된 전문가만 후기를 쓸 수 있어요.',
  not_found: '후기를 찾지 못했어요. 지워졌을 수 있어요.',
  closed: '대화가 중지된 회원에게는 후기를 요청할 수 없어요.',
  bad_input: '나이대를 골라 주세요.',
}

export function reviewError(err: { message?: string; code?: string } | null | undefined, fallback = '잠시 후 다시 시도해 주세요.'): string {
  if (!err) return fallback
  const msg = err.message ?? ''
  if (ERRORS[msg]) return ERRORS[msg]
  const key = Object.keys(ERRORS).find((k) => msg.includes(k))
  if (key) return ERRORS[key]
  if (err.code === 'PGRST202' || err.code === '42883' || err.code === '42P01') return '진행 후기 준비 중이에요. (운영자: day16 SQL 실행 필요)'
  return fallback
}

/** 별 표시 (★★★★☆) */
export function stars(n: number): string {
  const r = Math.max(0, Math.min(5, Math.round(n)))
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}
