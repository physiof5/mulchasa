// 상담 요청 · 채팅 공통 (2단계)
// 규칙: 요청서 1건에 전문가 최대 3명 수락 / 수락은 구독 중인 전문가만 / 3명이 차면 다른 전문가는 열람만
// 서버 저장은 Supabase 함수(create_consult 등)로만 — 정해진 선택지 값만 저장된다.

import { supabase } from '@/lib/supabase'
import {
  CONDITION_OPTIONS,
  MOBILITY_OPTIONS,
  PLACE_OPTIONS,
  labelOf,
  type AgeBand,
  type Condition,
  type Fell,
  type Mobility,
  type Option,
  type Place,
} from '@/lib/care'

export const MAX_ACCEPT = 3
export const CONSULT_DAYS = 14
export const CHAT_KEEP_DAYS = 180
export const NOTE_MAX = 500
export const MESSAGE_MAX = 1000
export const CONTACT_EMAIL = 'spacex2025@naver.com'

/** 상담 대상 — 맞춤 찾기(어머님·아버님·다른 가족)에 배우자·본인을 더함 */
export type ConsultWho = 'mother' | 'father' | 'spouse' | 'self' | 'other'

export const CONSULT_WHO_OPTIONS: Option<ConsultWho>[] = [
  { value: 'mother', label: '어머님' },
  { value: 'father', label: '아버님' },
  { value: 'spouse', label: '배우자' },
  { value: 'self', label: '본인' },
  { value: 'other', label: '다른 가족' },
]

/** 질문 문장의 주어 (본인이면 빈 글자 → '지금 어떻게 움직이세요?') */
export function consultSubject(who: ConsultWho | string | null | undefined): string {
  if (who === 'mother') return '어머님'
  if (who === 'father') return '아버님'
  if (who === 'spouse') return '배우자분'
  if (who === 'self') return ''
  return '가족분'
}

export type Want = 'home_exercise' | 'fall_safety' | 'visit' | 'center' | 'cost_schedule' | 'welfare'

export const WANT_OPTIONS: Option<Want>[] = [
  { value: 'home_exercise', label: '집에서 할 수 있는 운동', desc: '혼자서도 안전하게 할 수 있는 동작' },
  { value: 'fall_safety', label: '넘어지지 않게 집 안 점검', desc: '화장실·문턱·조명·침대 높이 등' },
  { value: 'visit', label: '집으로 오는 운동 지도', desc: '방문 일정·진행 방식' },
  { value: 'center', label: '운동센터 다니기', desc: '가까운 센터에서 받는 운동 지도' },
  { value: 'cost_schedule', label: '비용·일정', desc: '1회 비용, 가능한 요일·시간' },
  { value: 'welfare', label: '장기요양·복지용구 같은 제도', desc: '함께 챙기면 좋은 지원' },
]

export interface ConsultAnswers {
  who: ConsultWho
  age: AgeBand
  mobility: Mobility
  conditions: Condition[]
  fell: Fell
  place: Place
  wants: Want[]
}

export interface ConsultArea {
  label: string
  lat: number
  lng: number
}

/** 화면에서 쓰는 요청서 (서버가 돌려주는 모양) */
export interface ConsultRow {
  id: string
  answers: ConsultAnswers
  note: string
  area_label: string
  status: 'open' | 'closed'
  accepted_count: number
  created_at: string
  expires_at: string
}

export interface MyExpert {
  id: string
  name: string
  verified: boolean
  subscribed: boolean
  subscribed_until: string | null
}

// ── 글자 만들기 ──
export function consultTitle(a: Pick<ConsultAnswers, 'who'> | null | undefined): string {
  const who = a?.who
  const name = who === 'mother' ? '어머님' : who === 'father' ? '아버님' : who === 'spouse' ? '배우자' : who === 'self' ? '본인' : '가족'
  return `${name} 상담`
}

export function ageText(age: AgeBand | string | null | undefined): string {
  return age === 'under65' ? '65세 미만' : age === '65plus' ? '65세 이상' : ''
}

/** 요청서 내용 줄 (보호자·전문가 화면 공통) */
export function answerLines(a: ConsultAnswers): { label: string; value: string }[] {
  return [
    { label: '대상', value: `${labelOf(CONSULT_WHO_OPTIONS, a.who)} (${ageText(a.age)})` },
    { label: '거동', value: labelOf(MOBILITY_OPTIONS, a.mobility) },
    { label: '상황', value: (a.conditions ?? []).map((c) => labelOf(CONDITION_OPTIONS, c)).join(', ') },
    { label: '최근 1년 낙상', value: a.fell === 'yes' ? '있어요' : a.fell === 'no' ? '없어요' : '잘 모르겠어요' },
    { label: '궁금한 점', value: (a.wants ?? []).map((w) => labelOf(WANT_OPTIONS, w)).join(', ') },
    { label: '받고 싶은 곳', value: labelOf(PLACE_OPTIONS, a.place) },
  ].filter((l) => l.value)
}

const SHORT_CONDITION: Record<Condition, string> = {
  stroke: '뇌졸중',
  parkinson: '파킨슨병',
  dementia: '치매·기억력',
  surgery: '골절·관절 수술',
  joint: '관절 불편',
  frail: '기력 저하',
}
const SHORT_MOBILITY: Record<Mobility, string> = {
  independent: '혼자 걸으심',
  aid: '지팡이·보행기',
  assist: '부축 필요',
  bed: '주로 누워 지내심·휠체어',
}

/** 목록 카드용 짧은 상황 요약 */
export function shortConditions(a: ConsultAnswers | null | undefined): string[] {
  if (!a) return []
  return (a.conditions ?? []).map((c) => SHORT_CONDITION[c]).filter(Boolean)
}

export function shortMobility(a: ConsultAnswers | null | undefined): string {
  return a ? SHORT_MOBILITY[a.mobility] ?? '' : ''
}

export function isExpired(row: Pick<ConsultRow, 'expires_at'>): boolean {
  return new Date(row.expires_at).getTime() < Date.now()
}

/** 요청서 상태 칩 */
export function consultState(row: Pick<ConsultRow, 'status' | 'accepted_count' | 'expires_at'>): { label: string; tone: 'open' | 'full' | 'done' } {
  if (row.status === 'closed') return { label: '마감', tone: 'done' }
  if (row.accepted_count >= MAX_ACCEPT) return { label: `${MAX_ACCEPT}/${MAX_ACCEPT} 마감`, tone: 'full' }
  if (isExpired(row)) return { label: '받는 기간 끝남', tone: 'done' }
  return { label: `수락 ${row.accepted_count}/${MAX_ACCEPT}`, tone: 'open' }
}

// ── 시간 표시 ──
const pad = (n: number) => String(n).padStart(2, '0')

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 목록 오른쪽 날짜: 오늘이면 시각, 아니면 월.일 */
export function listTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return clockTime(iso)
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}. ${d.getDate()}.`
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}

export function clockTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  return `${h < 12 ? '오전' : '오후'} ${pad(h % 12 === 0 ? 12 : h % 12)}:${pad(d.getMinutes())}`
}

export function dayLabel(iso: string): string {
  const d = new Date(iso)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`
}

export function untilLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

// ── 서버 함수 오류 → 쉬운 말 ──
const ERRORS: Record<string, string> = {
  login_required: '로그인이 필요해요. 다시 로그인해 주세요.',
  consent_required: '건강 정보 동의에 체크해 주세요.',
  bad_input: '빠진 답이 있어요. 앞 질문을 다시 확인해 주세요.',
  bad_location: '동네를 다시 찾아 주세요.',
  too_many_today: '오늘은 요청을 3번까지 보낼 수 있어요. 내일 다시 보내 주세요.',
  too_many_open: '진행 중인 요청이 3건 있어요. 받은 견적 탭에서 지난 요청을 마감한 뒤 보내 주세요.',
  not_expert: '승인된 전문가만 수락할 수 있어요.',
  not_subscribed: '구독 중인 전문가만 수락할 수 있어요.',
  not_found: '요청을 찾지 못했어요. 삭제되었을 수 있어요.',
  own_request: '내가 보낸 요청은 수락할 수 없어요.',
  closed: '이미 마감된 요청이에요.',
  full: `이미 ${MAX_ACCEPT}명의 전문가가 수락했어요.`,
  too_far: '활동 지역에서 너무 먼 요청이에요.',
  too_fast: '메시지를 너무 빨리 보내고 있어요. 잠시 뒤 다시 보내 주세요.',
}

export function friendlyError(err: { message?: string; code?: string } | null | undefined, fallback = '잠시 후 다시 시도해 주세요.'): string {
  if (!err) return fallback
  const key = Object.keys(ERRORS).find((k) => err.message === k || err.message?.includes(k))
  if (key) return ERRORS[key]
  // 함수가 아직 없을 때 (SQL 실행 전)
  if (err.code === 'PGRST202' || err.code === '42883' || err.code === '42P01') return '상담 기능 준비 중이에요. (운영자: day13 SQL 실행 필요)'
  return fallback
}

// ── 서버 호출 ──
export async function fetchMyExpert(): Promise<MyExpert | null> {
  const { data, error } = await supabase.rpc('my_expert')
  if (error || !data || typeof data !== 'object') return null
  return data as MyExpert
}

// ── 로그인하러 갔다 돌아올 때까지 작성 중인 요청서를 이 기기에 잠시 보관 ──
export const CONSULT_DRAFT_KEY = 'consult_draft'

export function saveConsultDraft(draft: unknown) {
  try {
    sessionStorage.setItem(CONSULT_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // 저장이 막혀 있으면 다시 고르게 됨
  }
}

export function takeConsultDraft<T>(): T | null {
  try {
    const raw = sessionStorage.getItem(CONSULT_DRAFT_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function clearConsultDraft() {
  try {
    sessionStorage.removeItem(CONSULT_DRAFT_KEY)
  } catch {
    // 무시
  }
}

/** 채팅·요청 화면을 본 뒤 하단 탭 배지를 다시 세도록 알림 */
export const NAV_REFRESH_EVENT = 'nav-badges-refresh'
export function refreshNavBadges() {
  window.dispatchEvent(new Event(NAV_REFRESH_EVENT))
}
