'use client'

// 홈 맨 위 '진행 중인 상담' 카드 — 다시 들어온 사람이 탭을 헤매지 않고 바로 이어가도록
// · 보호자: 진행 중인 요청마다 '전문가 n/3 수락' + 새 메시지 수
// · 전문가: 받은 요청(새 요청·수락 가능) + 안 읽은 메시지
// 로그인하지 않았거나 진행 중인 일이 없으면 아무것도 보이지 않는다.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuthUser } from '@/lib/auth'
import { MAX_ACCEPT, consultTitle, fetchMyExpert, isExpired, untilLabel, type ConsultRow } from '@/lib/consult'
import { refreshPushOwner } from '@/lib/push'
import { PushPrompt } from '@/components/PushPrompt'

const GREEN = '#0A8A7B'
const GREEN_DARK = '#0F6E56'
export const INBOX_SEEN_KEY = 'inbox_seen_at'

interface RoomLite {
  id: string
  role: 'guardian' | 'expert'
  consult: { id: string } | null
  unread: number
}

interface FeedLite {
  id: string
  status: 'open' | 'closed'
  accepted_count: number
  expires_at: string
  created_at: string
  my_room_id: string | null
}

interface Summary {
  requests: { row: ConsultRow; unread: number }[]
  expert: { fresh: number; acceptable: number; unread: number } | null
  otherUnread: number
}

const canAccept = (r: FeedLite) => !r.my_room_id && r.status === 'open' && r.accepted_count < MAX_ACCEPT && !isExpired(r)

function readSeen(): number {
  try {
    return Number(new Date(localStorage.getItem(INBOX_SEEN_KEY) ?? 0).getTime()) || 0
  } catch {
    return 0
  }
}

async function loadSummary(): Promise<Summary> {
  const [reqRes, roomsRes, expert] = await Promise.all([
    supabase
      .from('consult_requests')
      .select('id, answers, note, area_label, status, accepted_count, created_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.rpc('my_chat_rooms'),
    fetchMyExpert(),
  ])
  const rooms: RoomLite[] = Array.isArray(roomsRes.data) ? (roomsRes.data as RoomLite[]) : []
  const unreadByConsult: Record<string, number> = {}
  rooms.filter((r) => r.role === 'guardian' && r.consult).forEach((r) => (unreadByConsult[r.consult!.id] = (unreadByConsult[r.consult!.id] ?? 0) + r.unread))

  const rows = (reqRes.data as ConsultRow[] | null) ?? []
  const requests = rows
    .map((row) => ({ row, unread: unreadByConsult[row.id] ?? 0 }))
    .filter(({ row, unread }) => unread > 0 || (row.status === 'open' && !isExpired(row)))
    .slice(0, 3)

  // 요청서가 지워졌어도 남은 보호자 쪽 대화 (드묾)
  const shownIds = new Set(requests.map((r) => r.row.id))
  const otherUnread = rooms.filter((r) => r.role === 'guardian' && (!r.consult || !shownIds.has(r.consult.id))).reduce((n, r) => n + r.unread, 0)

  let expertSummary: Summary['expert'] = null
  if (expert?.verified) {
    const { data } = await supabase.rpc('consult_feed')
    const feed: FeedLite[] = Array.isArray(data) ? (data as FeedLite[]) : []
    const seen = readSeen()
    const open = feed.filter(canAccept)
    expertSummary = {
      fresh: open.filter((r) => new Date(r.created_at).getTime() > seen).length,
      acceptable: open.length,
      unread: rooms.filter((r) => r.role === 'expert').reduce((n, r) => n + r.unread, 0),
    }
  }
  return { requests, expert: expertSummary, otherUnread }
}

export default function HomeActivity() {
  const user = useAuthUser()
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    if (!user) return
    let alive = true
    const run = () => loadSummary().then((s) => alive && setSummary(s)).catch(() => {})
    run()
    // 알림을 켠 기기는 지금 로그인한 계정으로 다시 묶기 (한 번만)
    try {
      if (!sessionStorage.getItem('push_owner_checked')) {
        sessionStorage.setItem('push_owner_checked', '1')
        refreshPushOwner()
      }
    } catch {
      // 무시
    }
    window.addEventListener('focus', run)
    return () => {
      alive = false
      window.removeEventListener('focus', run)
    }
  }, [user])

  if (!user || !summary) return null
  const { requests, expert, otherUnread } = summary
  const hasExpertNews = !!expert && (expert.acceptable > 0 || expert.unread > 0)
  if (requests.length === 0 && !hasExpertNews && otherUnread === 0) return null

  return (
    <section className="px-5 pt-2">
      <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
        <div className="flex items-center mb-1">
          <h2 className="flex-1 text-[18px] font-extrabold text-gray-900">진행 중인 상담</h2>
          <Link href="/quotes" className="min-h-[40px] px-1 flex items-center text-[14px] font-semibold text-gray-500">
            전체 보기 ›
          </Link>
        </div>

        <div className="divide-y divide-gray-100">
          {expert && hasExpertNews && (
            <>
              {expert.acceptable > 0 && (
                <ActivityRow
                  href="/quotes"
                  title="받은 상담 요청"
                  sub={`수락할 수 있는 요청 ${expert.acceptable}건`}
                  badge={expert.fresh > 0 ? `새 요청 ${expert.fresh}` : undefined}
                />
              )}
              {expert.unread > 0 && <ActivityRow href="/chat" title="보호자와의 채팅" sub="답장을 기다리고 있어요" badge={`새 메시지 ${expert.unread}`} />}
            </>
          )}
          {requests.map(({ row, unread }) => {
            const waiting = row.accepted_count === 0 && row.status === 'open' && !isExpired(row)
            return (
              <ActivityRow
                key={row.id}
                href={`/consult/${row.id}`}
                title={consultTitle(row.answers)}
                sub={
                  waiting
                    ? `전문가 수락을 기다리는 중 · ${untilLabel(row.expires_at)}까지`
                    : `전문가 ${row.accepted_count}/${MAX_ACCEPT} 수락${row.status === 'open' && !isExpired(row) ? ` · ${untilLabel(row.expires_at)}까지` : ''}`
                }
                dots={row.accepted_count}
                badge={unread > 0 ? `새 메시지 ${unread}` : undefined}
              />
            )
          })}
          {otherUnread > 0 && <ActivityRow href="/chat" title="채팅" sub="확인하지 않은 메시지가 있어요" badge={`새 메시지 ${otherUnread}`} />}
        </div>

        <PushPrompt className="mt-3" message="전문가가 수락하거나 답장하면 알림으로 알려 드릴까요?" />
      </div>
    </section>
  )
}

function ActivityRow({ href, title, sub, badge, dots }: { href: string; title: string; sub: string; badge?: string; dots?: number }) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3 min-h-[60px] active:opacity-70">
      {dots !== undefined && (
        <span className="flex gap-1 shrink-0" aria-hidden="true">
          {Array.from({ length: MAX_ACCEPT }, (_, i) => (
            <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: i < dots ? GREEN : '#E5E7EB' }} />
          ))}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-bold text-gray-900 truncate">{title}</span>
        <span className="block text-[14px] text-gray-500 leading-snug">{sub}</span>
      </span>
      {badge ? (
        <span className="shrink-0 min-h-[28px] px-2.5 rounded-full text-[13px] font-bold text-white flex items-center" style={{ background: '#F04452' }}>
          {badge}
        </span>
      ) : (
        <span className="shrink-0 text-[20px] text-gray-300" aria-hidden="true" style={{ color: GREEN_DARK, opacity: 0.4 }}>
          ›
        </span>
      )}
    </Link>
  )
}
