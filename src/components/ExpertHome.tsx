'use client'

// 전문가 모드 홈 — 업무에 집중: 오늘 일정 · 받은 요청 · 채팅 · 구독 · 관리 메뉴
// 자가진단·서식자료·제도 소식 같은 회원용 정보는 보여 주지 않는다(회원 모드에서).

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { PushPrompt } from '@/components/PushPrompt'
import { CONTACT_EMAIL, INBOX_SEEN_KEY, MAX_ACCEPT, isExpired, untilLabel } from '@/lib/consult'
import { refreshPushOwner } from '@/lib/push'
import { setAppMode, useAppMode } from '@/lib/mode'
import { SCHEDULE_FIELDS, dateLabel, hhmm, itemState, kindInfo, todayRange, type ScheduleItem } from '@/lib/schedule'

const GREEN = '#0A8A7B'
const GREEN_DARK = '#0F6E56'
const GREEN_LIGHT = '#E8F6F4'

interface FeedLite {
  status: 'open' | 'closed'
  accepted_count: number
  expires_at: string
  created_at: string
  my_room_id: string | null
}

interface Summary {
  today: ScheduleItem[] | null // null = 스케줄 준비 전(SQL)
  acceptable: number
  fresh: number
  unread: number
  activeChats: number
}

function readSeen(): number {
  try {
    return new Date(localStorage.getItem(INBOX_SEEN_KEY) ?? 0).getTime() || 0
  } catch {
    return 0
  }
}

async function loadSummary(verified: boolean): Promise<Summary> {
  const { from, to } = todayRange()
  const [sched, rooms, feed] = await Promise.all([
    supabase.from('expert_schedule').select(SCHEDULE_FIELDS).gte('starts_at', from).lt('starts_at', to).order('starts_at', { ascending: true }),
    supabase.rpc('my_chat_rooms'),
    verified ? supabase.rpc('consult_feed') : Promise.resolve({ data: [] as FeedLite[] }),
  ])
  const roomList = (Array.isArray(rooms.data) ? rooms.data : []) as { role: string; unread: number; blocked: boolean }[]
  const mine = roomList.filter((r) => r.role === 'expert')
  const open = ((Array.isArray(feed.data) ? feed.data : []) as FeedLite[]).filter(
    (r) => !r.my_room_id && r.status === 'open' && r.accepted_count < MAX_ACCEPT && !isExpired(r)
  )
  const seen = readSeen()
  return {
    today: sched.error ? null : ((sched.data as ScheduleItem[]) ?? []),
    acceptable: open.length,
    fresh: open.filter((r) => new Date(r.created_at).getTime() > seen).length,
    unread: mine.reduce((n, r) => n + (r.unread || 0), 0),
    activeChats: mine.filter((r) => !r.blocked).length,
  }
}

export default function ExpertHome() {
  const { expert } = useAppMode()
  const [summary, setSummary] = useState<Summary | null>(null)
  const verified = !!expert?.verified

  useEffect(() => {
    let alive = true
    const run = () => loadSummary(verified).then((s) => alive && setSummary(s)).catch(() => {})
    run()
    try {
      if (!sessionStorage.getItem('push_owner_checked')) {
        sessionStorage.setItem('push_owner_checked', '1')
        refreshPushOwner()
      }
    } catch {
      // 무시
    }
    window.addEventListener('focus', run)
    const timer = window.setInterval(run, 60_000)
    return () => {
      alive = false
      window.removeEventListener('focus', run)
      window.clearInterval(timer)
    }
  }, [verified])

  const name = expert?.name ?? '전문가'

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      {/* 위: 모드 표시 + 내 프로필 */}
      <div className="px-5 pt-4 flex items-center">
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1 min-h-[26px] px-2.5 rounded-full text-[12px] font-bold text-white" style={{ background: '#1F2937' }}>
            전문가 모드
          </span>
          <h1 className="text-[22px] font-extrabold text-gray-900 mt-1.5 truncate">{name}님, 오늘도 함께해요</h1>
        </div>
        <Link href="/mypage" aria-label="내 프로필" className="w-12 h-12 -mr-2 flex items-center justify-center text-gray-700 shrink-0">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="2" />
            <path d="M4.5 20.5c0-3.8 3.4-6.5 7.5-6.5s7.5 2.7 7.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      {expert && !verified && (
        <p className="mx-5 mt-3 rounded-xl px-4 py-3 text-[14px] leading-relaxed" style={{ background: '#FFF8E6', color: '#92400E' }}>
          면허 확인 중이에요. 승인되면 받은 요청·채팅을 쓸 수 있어요. 그동안 프로필과 스케줄을 채워 두세요.
        </p>
      )}

      {/* 오늘 일정 */}
      <section className="px-5 pt-4">
        <div className="rounded-2xl bg-white border border-gray-100 p-4">
          <div className="flex items-center">
            <h2 className="flex-1 text-[18px] font-extrabold text-gray-900">
              오늘 일정 <span className="text-[14px] font-semibold text-gray-400">{dateLabel(new Date())}</span>
            </h2>
            <Link href="/schedule" className="min-h-[40px] px-1 flex items-center text-[14px] font-semibold text-gray-500">
              스케줄 ›
            </Link>
          </div>
          {summary === null ? (
            <div className="h-[56px] mt-2 rounded-xl bg-gray-50 animate-pulse" />
          ) : summary.today === null ? (
            <p className="text-[14px] text-gray-500 mt-2">스케줄 준비 중이에요. (운영자: day15 SQL 실행 필요)</p>
          ) : summary.today.length === 0 ? (
            <div className="mt-2 flex items-center gap-3">
              <p className="flex-1 text-[15px] text-gray-500">오늘 잡힌 일정이 없어요.</p>
              <Link href="/schedule" className="min-h-[40px] px-3 rounded-lg text-[14px] font-bold flex items-center" style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
                + 일정 추가
              </Link>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {summary.today.slice(0, 4).map((it) => {
                const k = kindInfo(it.kind)
                const st = itemState(it)
                return (
                  <li key={it.id}>
                    <Link href="/schedule" className="flex items-center gap-3 py-2.5 min-h-[52px]" style={{ opacity: st === 'past' ? 0.5 : 1 }}>
                      <span className="w-[46px] text-[15px] font-extrabold text-gray-900 tabular-nums shrink-0">{hhmm(it.starts_at)}</span>
                      <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: k.color }} aria-hidden="true" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-bold text-gray-900 truncate">{it.title}</span>
                        <span className="block text-[13px] text-gray-500 truncate">
                          {k.label}
                          {it.place ? ` · ${it.place}` : ''}
                        </span>
                      </span>
                      {st === 'now' && (
                        <span className="text-[12px] font-bold shrink-0" style={{ color: GREEN }}>
                          진행 중
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
              {summary.today.length > 4 && <li className="pt-2 text-[13px] text-gray-400">그 밖에 {summary.today.length - 4}개</li>}
            </ul>
          )}
        </div>
      </section>

      {/* 받은 요청 · 채팅 */}
      <section className="px-5 pt-3 grid grid-cols-2 gap-3">
        <StatCard
          href="/quotes"
          title="받은 요청"
          value={summary ? `${summary.acceptable}건` : '-'}
          sub={!verified ? '승인 후 열려요' : summary && summary.fresh > 0 ? `새 요청 ${summary.fresh}건` : '수락할 수 있는 요청'}
          hot={!!summary && summary.fresh > 0}
        />
        <StatCard
          href="/chat"
          title="채팅"
          value={summary ? `${summary.unread}개` : '-'}
          sub={summary ? `안 읽은 메시지 · 대화 ${summary.activeChats}개` : '안 읽은 메시지'}
          hot={!!summary && summary.unread > 0}
        />
      </section>

      {/* 구독 */}
      <section className="px-5 pt-3">
        <Link href="/subscription" className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-4">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: expert?.subscribed ? GREEN_LIGHT : '#FFF8E6' }} aria-hidden="true">
            <Icon name="subscription" color={expert?.subscribed ? GREEN : '#B45309'} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[16px] font-bold text-gray-900">{expert?.subscribed ? '구독 중' : '구독이 꺼져 있어요'}</span>
            <span className="block text-[14px] text-gray-500 truncate">
              {expert?.subscribed
                ? `${expert.subscribed_until ? `${untilLabel(expert.subscribed_until)}까지 · ` : ''}요청서 1건에 ${MAX_ACCEPT}명까지 수락`
                : '구독하면 상담 요청을 수락할 수 있어요'}
            </span>
          </span>
          <span className="text-gray-300 text-xl shrink-0" aria-hidden="true">
            ›
          </span>
        </Link>
      </section>

      {/* 관리 메뉴 */}
      <section className="px-5 pt-6">
        <h2 className="text-[16px] font-bold text-gray-500 mb-2">관리</h2>
        <div className="grid grid-cols-3 gap-2.5">
          <MenuTile href="/mypage" icon="profile" label="프로필 관리" />
          <MenuTile href="/quotes" icon="inbox" label="상담·요청 관리" />
          <MenuTile href="/chat" icon="chat" label="채팅 관리" />
          <MenuTile href="/subscription" icon="subscription" label="구독 관리" />
          <MenuTile href="/crew" icon="crew" label="크루 관리" />
          <MenuTile href="/schedule" icon="schedule" label="스케줄 관리" />
        </div>
        <Link href="/reviews/mine" className="mt-2.5 flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-4">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-[22px]" style={{ background: GREEN_LIGHT }} aria-hidden="true">
            📝
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[16px] font-bold text-gray-900">진행 후기 관리</span>
            <span className="block text-[13px] text-gray-500 leading-snug">10회 이상 함께한 회원의 진행 기록을 올려 프로필에 보여 주세요</span>
          </span>
          <span className="text-gray-300 text-xl shrink-0" aria-hidden="true">
            ›
          </span>
        </Link>
      </section>

      <section className="px-5 pt-5">
        <PushPrompt message="새 상담 요청·메시지가 오면 알림으로 알려 드릴까요?" />
      </section>

      {/* 회원 모드 안내 */}
      <section className="px-5 pt-5 pb-4">
        <button
          type="button"
          onClick={() => setAppMode('member')}
          className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left flex items-center gap-3"
        >
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-gray-800">회원 모드로 전환</span>
            <span className="block text-[13px] text-gray-500 mt-0.5 leading-relaxed">자가진단·서식자료·제도 소식, 내가 보낸 상담 요청은 회원 모드에서 볼 수 있어요.</span>
          </span>
          <span className="text-gray-300 text-xl shrink-0" aria-hidden="true">
            ›
          </span>
        </button>
        <p className="text-[12px] text-gray-400 mt-3 text-center">문의 {CONTACT_EMAIL}</p>
      </section>

      <BottomNav />
    </main>
  )
}

function StatCard({ href, title, value, sub, hot }: { href: string; title: string; value: string; sub: string; hot?: boolean }) {
  return (
    <Link href={href} className="rounded-2xl bg-white border p-4 active:scale-[0.99] transition-all" style={{ borderColor: hot ? '#FCA5A5' : '#F3F4F6' }}>
      <span className="block text-[14px] font-bold text-gray-500">{title}</span>
      <span className="block text-[26px] font-extrabold mt-0.5" style={{ color: hot ? '#E5484D' : '#111827' }}>
        {value}
      </span>
      <span className="block text-[13px] text-gray-500 mt-0.5 leading-snug">{sub}</span>
    </Link>
  )
}

function MenuTile({ href, icon, label, badge }: { href: string; icon: IconName; label: string; badge?: string }) {
  return (
    <Link href={href} className="relative min-h-[92px] rounded-2xl bg-white border border-gray-100 flex flex-col items-center justify-center gap-1.5 active:scale-[0.98] transition-all">
      {badge && (
        <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">{badge}</span>
      )}
      <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: GREEN_LIGHT }} aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span className="text-[13px] font-bold text-gray-800 text-center leading-tight px-1">{label}</span>
    </Link>
  )
}

type IconName = 'profile' | 'inbox' | 'chat' | 'subscription' | 'crew' | 'schedule'

function Icon({ name, color = GREEN }: { name: IconName; color?: string }) {
  const paths: Record<IconName, ReactNode> = {
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="2" />
        <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    inbox: (
      <>
        <path d="M4 13 6.5 5h11L20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <path d="M4 13h4.5l1 2.5h5l1-2.5H20" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
    chat: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5v-9Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />,
    subscription: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" stroke={color} strokeWidth="2" />
        <path d="M3 10h18M7 15h4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    crew: (
      <>
        <circle cx="12" cy="8" r="3" stroke={color} strokeWidth="2" />
        <path d="M6.5 20c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M5 11.5a2.2 2.2 0 1 1 .6-4.3M19 11.5a2.2 2.2 0 1 0-.6-4.3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
    schedule: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke={color} strokeWidth="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {paths[name]}
    </svg>
  )
}
