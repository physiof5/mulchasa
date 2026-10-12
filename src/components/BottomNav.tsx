'use client'

// 하단 탭 — 모드마다 다르게
// · 회원 모드:   홈 · 전문가 찾기 · 받은 견적 · 채팅 · 둘러보기
// · 전문가 모드: 홈 · 받은 요청 · 채팅 · 스케줄 · 크루   (프로필·구독은 홈 오른쪽 위 → MY / 홈 메뉴)
// '채팅'에는 지금 모드의 안 읽은 메시지 수가 붙는다.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { NAV_REFRESH_EVENT } from '@/lib/consult'
import { useAppMode } from '@/lib/mode'

const GREEN = '#0A8A7B'

const ICONS: Record<string, ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  // 나침반
  experts: (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  // 영수증
  quotes: (
    <>
      <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  // 받은 편지함 (전문가: 받은 요청)
  inbox: (
    <>
      <path d="M4 13 6.5 5h11L20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 13h4.5l1 2.5h5l1-2.5H20" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  // 말풍선
  chat: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5v-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8.5 9.5h.01M12 9.5h.01M15.5 9.5h.01" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  // 신문
  browse: (
    <>
      <path d="M5 4h12v15a2 2 0 0 0 2 2H6a1 1 0 0 1-1-1V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17 8h2.5a.5.5 0 0 1 .5.5V19a2 2 0 0 1-2 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 8h6M8 12h6M8 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  // 달력
  schedule: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 14h3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  // 사람 셋 (크루)
  crew: (
    <>
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M6.5 20c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 11.5a2.2 2.2 0 1 1 .6-4.3M19 11.5a2.2 2.2 0 1 0-.6-4.3M2.5 17c.3-1.7 1.3-2.9 2.8-3.4M21.5 17c-.3-1.7-1.3-2.9-2.8-3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
}

interface RoomLite {
  role: 'guardian' | 'expert'
  unread: number
}

// 탭을 옮길 때마다 서버에 묻지 않도록 20초 동안 기억
let cache: { at: number; userId: string; member: number; expert: number } | null = null

function useUnreadByMode(): { member: number; expert: number } {
  const [state, setState] = useState(() => (cache ? { member: cache.member, expert: cache.expert } : { member: 0, expert: 0 }))

  useEffect(() => {
    let alive = true
    const load = async (force: boolean) => {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user.id
      if (!uid) {
        cache = null
        if (alive) setState({ member: 0, expert: 0 })
        return
      }
      if (!force && cache && cache.userId === uid && Date.now() - cache.at < 20_000) {
        if (alive) setState({ member: cache.member, expert: cache.expert })
        return
      }
      const { data: rooms } = await supabase.rpc('my_chat_rooms')
      const list: RoomLite[] = Array.isArray(rooms) ? (rooms as RoomLite[]) : []
      const sum = (role: RoomLite['role']) => list.filter((r) => r.role === role).reduce((n, r) => n + (r.unread || 0), 0)
      cache = { at: Date.now(), userId: uid, member: sum('guardian'), expert: sum('expert') }
      if (alive) setState({ member: cache.member, expert: cache.expert })
    }
    load(false)
    const refresh = () => load(true)
    window.addEventListener(NAV_REFRESH_EVENT, refresh)
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 30_000)
    return () => {
      alive = false
      window.removeEventListener(NAV_REFRESH_EVENT, refresh)
      window.removeEventListener('focus', refresh)
      window.clearInterval(timer)
    }
  }, [])

  return state
}

interface Tab {
  key: string
  icon: string
  label: string
  href: string
  active: boolean
  badge?: number
}

export default function BottomNav() {
  const pathname = usePathname() || '/'
  const { mode } = useAppMode()
  const unread = useUnreadByMode()
  const on = (...prefixes: string[]) => prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))

  const tabs: Tab[] =
    mode === 'expert'
      ? [
          { key: 'home', icon: 'home', label: '홈', href: '/', active: pathname === '/' || on('/subscription') },
          { key: 'inbox', icon: 'inbox', label: '받은 요청', href: '/quotes', active: on('/quotes', '/consult') },
          { key: 'chat', icon: 'chat', label: '채팅', href: '/chat', active: on('/chat'), badge: unread.expert },
          { key: 'schedule', icon: 'schedule', label: '스케줄', href: '/schedule', active: on('/schedule') },
          { key: 'crew', icon: 'crew', label: '크루', href: '/crew', active: on('/crew') },
        ]
      : [
          { key: 'home', icon: 'home', label: '홈', href: '/', active: pathname === '/' },
          { key: 'experts', icon: 'experts', label: '전문가 찾기', href: '/experts', active: on('/experts', '/search', '/centers') },
          { key: 'quotes', icon: 'quotes', label: '받은 견적', href: '/quotes', active: on('/quotes', '/consult') },
          { key: 'chat', icon: 'chat', label: '채팅', href: '/chat', active: on('/chat'), badge: unread.member },
          { key: 'browse', icon: 'browse', label: '둘러보기', href: '/browse', active: on('/browse', '/magazine', '/check', '/settings/forms') },
        ]

  return (
    <>
      <nav
        className="max-w-md mx-auto fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label={mode === 'expert' ? '전문가 모드 메뉴' : '주요 메뉴'}
      >
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className="flex-1 min-h-[60px] flex flex-col items-center justify-center gap-0.5"
            style={{ color: t.active ? GREEN : '#8B95A1' }}
            aria-current={t.active ? 'page' : undefined}
          >
            <span className="relative">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {ICONS[t.icon]}
              </svg>
              {!!t.badge && t.badge > 0 && (
                <span className="absolute -top-1.5 left-3.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F04452] text-white text-[11px] font-bold leading-[18px] text-center">
                  {t.badge > 99 ? '99+' : t.badge}
                </span>
              )}
            </span>
            <span className="text-[12px] font-semibold whitespace-nowrap">
              {t.label}
              {!!t.badge && t.badge > 0 && <span className="sr-only"> (안 읽은 메시지 {t.badge}개)</span>}
            </span>
          </Link>
        ))}
      </nav>
      {/* 탭에 내용이 가리지 않도록 자리 확보 */}
      <div className="h-[72px]" aria-hidden="true" />
    </>
  )
}
