// 크루 — 물리치료사 동료 모임 (최대 10명, 대표 1 · 리더 2)
// · 크루 채팅(공지·케이스 공유) · 일정이 안 될 때 크루원 추천(회원이 수락해야 연결, 돈은 오가지 않음)
// · 크루 스코어 = 크루원 점수 평균 (1인 100점: 응답 30 · 만족 30 · 협업 20 · 신뢰 20 − 감점, 최근 90일)

import { supabase } from '@/lib/supabase'

export const CREW_MAX = 10
export const LEADER_MAX = 2
export const CREW_MSG_MAX = 1000

export type CrewRole = 'owner' | 'leader' | 'member'
export const ROLE_LABEL: Record<CrewRole, string> = { owner: '대표', leader: '리더', member: '크루원' }

export interface ScoreBreakdown {
  total: number
  response: number
  satisfaction: number
  collab: number
  trust: number
  /** 나에게만 보임 */
  penalty?: number
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
}

export interface CrewInfo {
  id: string
  name: string
  intro: string
  region: string
  notice: string
  notice_at: string | null
  is_open: boolean
  created_at: string
  /** 대표·리더에게만 */
  invite_code: string | null
}

export interface JoinRequest {
  id: string
  name: string
  photo: string | null
  years: number | null
  message: string
  created_at: string
}

export interface MyCrew {
  crew: CrewInfo
  my_role: CrewRole
  members: CrewMember[]
  score: number
  tier: string
  requests: JoinRequest[]
  unread: number
}

export interface NoCrew {
  crew: null
  my_requests: { id: string; crew_id: string; crew_name: string; created_at: string }[]
}

export interface CrewSearchItem {
  id: string
  name: string
  region: string
  intro: string
  members: number
  score: number | null
  tier: string
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

// ── 등급 · 점수 설명 ──
export const TIERS = [
  { key: '새싹', min: 0, color: '#6B7280', bg: '#F2F4F6', perk: '크루 채팅 · 케이스 공유 · 크루원 추천 연결' },
  { key: '든든', min: 60, color: '#0F6E56', bg: '#E8F6F4', perk: '크루원 프로필에 ‘든든 크루’ 배지' },
  { key: '으뜸', min: 80, color: '#B45309', bg: '#FFF4E5', perk: '‘으뜸 크루’ 배지 + 크루 찾기 맨 위에 보여요' },
] as const

export function tierInfo(key: string | null | undefined) {
  return TIERS.find((t) => t.key === key) ?? TIERS[0]
}

export function nextTier(score: number) {
  return TIERS.find((t) => t.min > score) ?? null
}

export const SCORE_PARTS: { key: keyof Omit<ScoreBreakdown, 'total' | 'penalty' | 'points'>; label: string; max: number; how: string }[] = [
  { key: 'response', label: '응답', max: 30, how: '대화방이 열리고 24시간 안에 답한 비율' },
  { key: 'satisfaction', label: '만족', max: 30, how: '진행 후기에 회원이 남긴 만족도 별점 (후기가 적으면 4점 기준으로 계산)' },
  { key: 'collab', label: '협업', max: 20, how: '추천이 연결됨(보냄 4점 · 받음 2점) + 케이스 공유 1점' },
  { key: 'trust', label: '신뢰', max: 20, how: '경력(최대 10) · 보유 자격(최대 5) · 프로필 사진 2 · 자기소개 3' },
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
}

export function crewError(err: { message?: string; code?: string } | null | undefined, fallback = '잠시 후 다시 시도해 주세요.'): string {
  if (!err) return fallback
  const msg = err.message ?? ''
  if (ERRORS[msg]) return ERRORS[msg]
  const key = Object.keys(ERRORS)
    .sort((a, b) => b.length - a.length)
    .find((k) => msg.includes(k))
  if (key) return ERRORS[key]
  if (err.code === 'PGRST202' || err.code === '42883' || err.code === '42P01') return '크루 기능 준비 중이에요. (운영자: day16 SQL 실행 필요)'
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
