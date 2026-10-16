// 다음 방문 카드 + 회차 세기
// · 전문가가 스케줄에서 상담 대화와 연결한 일정(방문 지도·센터 지도·상담)을 그 회원도 함께 봄
// · 회원: 다가오는 일정 '확인했어요' / '시간 바꾸고 싶어요'(채팅으로 전달), 지난 방문 '진행 완료' / '진행 안 했어요'
// · 회원이 '진행 완료'를 누른 방문 수 = 확인된 회차 (진행 후기에 '앱 기록 n회'로 표시)

import { kindInfo } from '@/lib/schedule'

export const VISIT_GOAL = 10

export type MemberAnswer = 'none' | 'confirmed' | 'change'
export type MemberResult = 'done' | 'missed' | null

export interface VisitItem {
  id: string
  kind: 'visit' | 'center' | 'consult'
  starts_at: string
  ends_at: string
  place: string
  /** 전문가에게만 */
  title: string | null
  member_answer: MemberAnswer
  member_result: MemberResult
  expert_done: boolean
  session_no: number | null
}

export interface RoomVisits {
  role: 'member' | 'expert'
  verified: number
  items: VisitItem[]
}

export interface VisitCard {
  room_id: string
  therapist: { name: string; photo: string | null }
  next: Pick<VisitItem, 'id' | 'kind' | 'starts_at' | 'ends_at' | 'place' | 'member_answer'> | null
  ask: Pick<VisitItem, 'id' | 'kind' | 'starts_at'> | null
  verified: number
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

/** '10월 20일 (화) 오전 10:00' */
export function visitWhen(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]}) ${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** '오늘' · '내일' · '모레' · 'n일 뒤' (이 기기 날짜 기준) */
export function dayGap(iso: string, nowMs: number): string {
  const a = new Date(iso)
  const b = new Date(nowMs)
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  const n = Math.round((da - db) / 86_400_000)
  if (n === 0) return '오늘'
  if (n === 1) return '내일'
  if (n === 2) return '모레'
  if (n > 0) return `${n}일 뒤`
  return `${-n}일 전`
}

export function visitKindLabel(kind: string): string {
  if (kind === 'consult') return '상담'
  if (kind === 'center') return '센터 운동 지도'
  return '방문 운동 지도'
}

export function visitColor(kind: string) {
  return kindInfo(kind)
}

/** 다음(아직 안 끝난) 일정 하나 */
export function nextVisit(items: VisitItem[], nowMs: number): VisitItem | null {
  return items.find((i) => new Date(i.ends_at).getTime() > nowMs) ?? null
}

/** 회원이 진행 여부를 아직 답하지 않은 지난 방문 (가장 최근 것, 14일 이내) */
export function visitToAsk(items: VisitItem[], nowMs: number): VisitItem | null {
  const list = items.filter(
    (i) => i.kind !== 'consult' && i.member_result === null && new Date(i.starts_at).getTime() <= nowMs && nowMs - new Date(i.ends_at).getTime() < 14 * 86_400_000
  )
  return list.length ? list[list.length - 1] : null
}

const ERRORS: Record<string, string> = {
  already_started: '이미 시작한 일정이에요. 바꾸려면 채팅으로 말씀해 주세요.',
  not_started: '아직 시작하지 않은 일정이에요.',
  closed: '대화가 중지되어 요청을 보낼 수 없어요.',
  not_found: '일정을 찾지 못했어요. 전문가가 지웠을 수 있어요.',
  too_fast: '잠시 뒤 다시 눌러 주세요.',
}

export function visitError(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return '잠시 후 다시 시도해 주세요.'
  const key = Object.keys(ERRORS).find((k) => err.message?.includes(k))
  if (key) return ERRORS[key]
  if (err.code === 'PGRST202' || err.code === '42883') return '방문 일정 기능 준비 중이에요. (운영자: day17 SQL 실행 필요)'
  return '잠시 후 다시 시도해 주세요.'
}
