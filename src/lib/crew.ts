// 크루 — 물리치료사 동료 모임 (최대 10명, 대표 1 · 리더 2)
// · 크루 채팅(공지·케이스 공유) · '도와주세요' 질문과 답 채택 · 좋아요(하트) · 신입 버디
// · 일정이 안 될 때 크루원 추천(회원이 수락해야 연결, 돈은 오가지 않음)
// · 개인 점수 100 = 응답 30 · 기록 30 · 협업 20 · 프로필 20 − 감점
// · 크루 점수 = 크루원 개인 점수 합산 + 크루 활동 점수(최근 90일) — 평균이 아니라서 누구를 내보내도 오르지 않음
// · 월간 미션 배지 5단계(파랑 → 초록 → 노랑 → 빨강 → 보라)

import { supabase } from '@/lib/supabase'

export const CREW_MAX = 10
export const LEADER_MAX = 2
export const CREW_MSG_MAX = 1000
export const QA_MAX = 500
export const HEARTS_PER_MONTH = 5

export type CrewRole = 'owner' | 'leader' | 'member'
export const ROLE_LABEL: Record<CrewRole, string> = { owner: '대표', leader: '리더', member: '크루원' }

export interface ProfileCheck {
  years: boolean
  certs: boolean
  photo: boolean
  intro: boolean
}

export interface ScoreBreakdown {
  total: number
  response: number
  record: number
  collab: number
  profile: number
  /** 나에게만 보임 */
  penalty?: number
  profile_check?: ProfileCheck
  points: number
}

export interface CrewMember {
  user_id: string
  therapist_id: string
  name: string
  photo: string | null
  years: number | null
  role: CrewRole
  joined_at: string
  verified: boolean
  score: ScoreBreakdown
  me: boolean
  hearts: number
  /** 이번 달 내가 좋아요를 보냈는지 */
  hearted: boolean
  buddy: { user_id: string; name: string; until: string } | null
}

export type JoinMode = 'approval' | 'open'

export interface CrewInfo {
  id: string
  name: string
  intro: string
  region: string
  notice: string
  notice_at: string | null
  is_open: boolean
  join_mode: JoinMode
  min_score: number
  created_at: string
  /** 대표·리더에게만 */
  invite_code: string | null
  badge_level: number
}

export interface JoinRequest {
  id: string
  name: string
  photo: string | null
  years: number | null
  message: string
  created_at: string
  score: number
}

export interface MissionCounts {
  case: number
  help: number
  review: number
}

export interface MyCrew {
  crew: CrewInfo
  my_role: CrewRole
  members: CrewMember[]
  score: { members: number; activity: number; total: number }
  mission: {
    month: string
    target: MissionCounts & { level: number }
    actual: MissionCounts
    history: { month: string; result: 'up' | 'keep' | 'down' | 'none'; level_after: number; progress: number }[]
  }
  requests: JoinRequest[]
  removals_left: number
  hearts_left: number
  unread: number
}

export interface NoCrew {
  crew: null
  my_score: ScoreBreakdown | null
  my_requests: { id: string; crew_id: string; crew_name: string; created_at: string }[]
}

export interface CrewSearchItem {
  id: string
  name: string
  region: string
  intro: string
  members: number
  score: number | null
  badge_level: number
  join_mode: JoinMode
  min_score: number
  requested: boolean
}

export interface CrewMsg {
  id: number
  crew_id: string
  sender_id: string | null
  kind: 'text' | 'case' | 'system' | 'notice'
  body: string
  created_at: string
}
export const CREW_MSG_FIELDS = 'id, crew_id, sender_id, kind, body, created_at'

export async function fetchMyCrew(): Promise<MyCrew | NoCrew | null> {
  const { data, error } = await supabase.rpc('my_crew')
  if (error || !data || typeof data !== 'object') return null
  return data as MyCrew | NoCrew
}

// ── 월간 미션 배지 (5 → 1단계, 1이 가장 높음) ──
export const BADGES: Record<number, { label: string; color: string; bg: string; rule: string }> = {
  5: { label: '파랑', color: '#1D4ED8', bg: '#DBEAFE', rule: '처음 미션을 달성했어요' },
  4: { label: '초록', color: '#15803D', bg: '#DCFCE7', rule: '2번 연속 달성' },
  3: { label: '노랑', color: '#A16207', bg: '#FEF9C3', rule: '3번 연속 달성' },
  2: { label: '빨강', color: '#BE123C', bg: '#FFE4E6', rule: '4번 연속 달성' },
  1: { label: '보라', color: '#6D28D9', bg: '#EDE9FE', rule: '5번 연속 달성 — 가장 높은 단계' },
}

export function badgeInfo(level: number | null | undefined) {
  return level && BADGES[level] ? { level, ...BADGES[level] } : null
}

export const MISSION_PARTS: { key: keyof MissionCounts; label: string; how: string }[] = [
  { key: 'case', label: '케이스 공유', how: '크루 채팅에서 ‘케이스’로 보낸 글' },
  { key: 'help', label: '도움 채택', how: '‘도와주세요’ 질문에서 채택된 답' },
  { key: 'review', label: '진행 후기 공개', how: '크루원의 진행 후기가 회원 동의로 공개됨' },
]

export const SCORE_PARTS: { key: 'response' | 'record' | 'collab' | 'profile'; label: string; max: number; how: string }[] = [
  { key: 'response', label: '응답', max: 30, how: '대화방이 열리고 24시간 안에 답한 비율 (기록이 없으면 15점)' },
  {
    key: 'record',
    label: '기록',
    max: 30,
    how: '회원의 처음 상태와 어떤 운동으로 어떤 변화가 있었는지 진실하게 쓴 진행 후기 — 한 편에 최대 10점 (공개 동의 5 · 앱 기록 10회 확인 3 · 사진 3장 이상과 꼼꼼한 내용 2), 최근 1년 좋은 3편',
  },
  { key: 'collab', label: '협업', max: 20, how: '추천 연결(보냄 4 · 받음 2) · 도움 채택 2 · 버디 성장 3 · 케이스 공유 1 (최근 90일)' },
  { key: 'profile', label: '프로필', max: 20, how: '경력 · 보유 자격 · 프로필 사진 · 자기소개 30자 이상 (항목마다 5점)' },
]

export const PROFILE_ITEMS: { key: keyof ProfileCheck; label: string }[] = [
  { key: 'years', label: '경력' },
  { key: 'certs', label: '보유 자격 1개 이상' },
  { key: 'photo', label: '프로필 사진' },
  { key: 'intro', label: '자기소개 30자 이상' },
]

export const MIN_SCORE_OPTIONS = [
  { value: 0, label: '프로필 완성만', desc: '프로필 4항목을 채운 물리치료사 누구나' },
  { value: 40, label: '40점 이상', desc: '처음 시작하면 35점이에요 · 첫 활동을 한 분부터' },
  { value: 50, label: '50점 이상', desc: '진행 후기나 협업 기록이 있는 경험자 위주' },
]

// ── 오류 → 쉬운 말 ──
const ERRORS: Record<string, string> = {
  not_expert: '승인된 물리치료사만 크루를 쓸 수 있어요.',
  already_in_crew: '이미 크루에 들어가 있어요. 한 사람은 한 크루만 함께할 수 있어요.',
  bad_name: '크루 이름은 2~20자로 정해 주세요.',
  name_taken: '이미 있는 크루 이름이에요. 다른 이름을 골라 주세요.',
  crew_closed: '지금은 가입 신청을 받지 않는 크루예요.',
  crew_full: `크루 정원(${CREW_MAX}명)이 다 찼어요.`,
  too_many_requests: '가입 신청은 한 번에 3곳까지 보낼 수 있어요.',
  already_requested: '이미 신청했어요. 대표·리더가 확인하면 알려 드려요.',
  bad_code: '초대 코드를 다시 확인해 주세요. (영문·숫자 6자리)',
  not_allowed: '대표나 리더만 할 수 있어요.',
  owner_must_transfer: '대표는 다른 크루원에게 대표를 넘긴 뒤 나갈 수 있어요.',
  too_many_leaders: `리더는 ${LEADER_MAX}명까지 정할 수 있어요.`,
  no_crew: '크루에 들어가야 추천할 수 있어요.',
  already_connected: '이미 이 회원과 연결된 크루원이에요.',
  closed: '대화가 중지되어 추천할 수 없어요.',
  already_decided: '이미 답한 추천이에요.',
  not_found: '찾지 못했어요. 이미 정리되었을 수 있어요.',
  too_fast: '메시지를 너무 빨리 보내고 있어요. 잠시 뒤 다시 보내 주세요.',
  bad_input: '입력한 내용을 다시 확인해 주세요.',
  min_years: '회원이 경력 3년 이상 선생님을 원해요. 다른 크루원을 골라 주세요.',
  profile_incomplete: '프로필 4항목(경력·보유 자격·프로필 사진·자기소개 30자 이상)을 모두 채워야 크루에 함께할 수 있어요.',
  score_too_low: '이 크루가 정한 최소 점수에 아직 못 미쳐요.',
  reason_required: '내보내는 사유를 골라 주세요.',
  too_many_removals: '크루원 내보내기는 한 달에 2명까지예요.',
  own_answer: '내 답은 채택할 수 없어요.',
  already_hearted: '이번 달에 이미 좋아요를 보냈어요.',
  no_hearts_left: `좋아요는 한 달에 ${HEARTS_PER_MONTH}개까지 보낼 수 있어요.`,
}

export function crewError(err: { message?: string; code?: string } | null | undefined, fallback = '잠시 후 다시 시도해 주세요.'): string {
  if (!err) return fallback
  const msg = err.message ?? ''
  if (ERRORS[msg]) return ERRORS[msg]
  const key = Object.keys(ERRORS)
    .sort((a, b) => b.length - a.length)
    .find((k) => msg.includes(k))
  if (key) return ERRORS[key]
  if (err.code === 'PGRST202' || err.code === '42883' || err.code === '42P01') return '크루 기능 준비 중이에요. (운영자: day16·day18 SQL 실행 필요)'
  return fallback
}

/** 크루 채팅 시간 표시 (오늘이면 시각, 아니면 날짜) */
export function crewTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  if (d.toDateString() === now.toDateString()) {
    const h = d.getHours()
    return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())}`
  }
  return `${d.getMonth() + 1}/${d.getDate()}`
}
