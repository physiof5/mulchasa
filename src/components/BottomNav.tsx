'use client'

// 하단 탭: 홈 · 전문가 찾기 · 받은 견적 · 채팅 · 둘러보기
// (내 프로필은 홈 오른쪽 위 사람 아이콘 → MY)
// 승인된 전문가에게는 '받은 견적' 자리가 '받은 요청'으로 보이고, '채팅'에는 안 읽은 메시지 수가 붙는다.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { NAV_REFRESH_EVENT } from '@/lib/consult'

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
}

// 탭을 옮길 때마다 서버에 묻지 않도록 20초 동안 기억
let cache: { at: number; userId: string; expert: boolean; unread: number } | null = null

function useNavBadges(): { expert: boolean; unread: number } {
  const [state, setState] = useState(() => (cache ? { expert: cache.expert, unread: cache.unread } : { expert: false, unread: 0 }))

  useEffect(() => {
    let alive = true
    const load = async (force: boolean) => {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user.id
      if (!uid) {
        cache = null
        if (alive) setState({ expert: false, unread: 0 })
        return
      }
      if (!force && cache && cache.userId === uid && Date.now() - cache.at < 20_000) {
        if (alive) setState({ expert: cache.expert, unread: cache.unread })
        return
      }
      const [ex, un] = await Promise.all([supabase.rpc('my_expert'), supabase.rpc('my_unread_total')])
      const expert = !!(ex.data && typeof ex.data === 'object' && (ex.data as { verified?: boolean }).verified)
      const unread = typeof un.data === 'number' ? un.data : 0
      cache = { at: Date.now(), userId: uid, expert, unread }
      if (alive) setState({ expert, unread })
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

export default function BottomNav() {
  const pathname = usePathname() || '/'
  const { expert, unread } = useNavBadges()

  const tabs = [
    { key: 'home', label: '홈', href: '/', active: pathname === '/' },
    { key: 'experts', label: '전문가 찾기', href: '/experts', active: pathname.startsWith('/experts') || pathname.startsWith('/search') || pathname.startsWith('/centers') },
    { key: 'quotes', label: expert ? '받은 요청' : '받은 견적', href: '/quotes', active: pathname.startsWith('/quotes') || pathname.startsWith('/consult') },
    { key: 'chat', label: '채팅', href: '/chat', active: pathname.startsWith('/chat'), badge: unread },
    {
      key: 'browse',
      label: '둘러보기',
      href: '/browse',
      active: pathname.startsWith('/browse') || pathname.startsWith('/magazine') || pathname.startsWith('/check') || pathname.startsWith('/settings/forms'),
    },
  ]

  return (
    <>
      <nav
        className="max-w-md mx-auto fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="주요 메뉴"
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
                {ICONS[t.key]}
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
