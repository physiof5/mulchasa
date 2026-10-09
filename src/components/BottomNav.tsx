'use client'

// 하단 탭: 홈 · 진단 · 매칭 · 내 주변 · MY (커뮤니티가 생기면 '내 주변' 자리를 바꿀 예정)
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

const GREEN = '#0A8A7B'

const ICONS: Record<string, ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  check: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="m8.5 12 2.2 2.2L15.5 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  find: (
    <>
      <circle cx="12" cy="5.5" r="2.3" fill="currentColor" />
      <path d="M12 8.5v6m0 0-3 5.5m3-5.5 3 5.5M7 11.5l5-1 5 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  near: (
    <>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  my: (
    <>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
}

export default function BottomNav() {
  const pathname = usePathname() || '/'
  const router = useRouter()

  // 지도는 기기에 저장된 위치가 있으면 함께 넘김 (위치는 서버로 보내지 않음)
  const goNear = () => {
    const p = new URLSearchParams({ view: 'map' })
    try {
      const lat = localStorage.getItem('mulchasa_lat')
      const lng = localStorage.getItem('mulchasa_lng')
      if (lat && lng) {
        p.set('lat', lat)
        p.set('lng', lng)
      }
    } catch {
      // 위치 없이 이동
    }
    router.push(`/search?${p.toString()}`)
  }

  const tabs = [
    { key: 'home', label: '홈', href: '/', active: pathname === '/' },
    { key: 'check', label: '진단', href: '/check', active: pathname.startsWith('/check') },
    { key: 'find', label: '매칭', href: '/find', active: pathname.startsWith('/find') },
    { key: 'near', label: '내 주변', href: null, active: pathname.startsWith('/search') },
    { key: 'my', label: 'MY', href: '/mypage', active: pathname.startsWith('/mypage') },
  ]

  return (
    <>
      <nav
        className="max-w-md mx-auto fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="주요 메뉴"
      >
        {tabs.map((t) => {
          const inner = (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {ICONS[t.key]}
              </svg>
              <span className="text-[12px] font-semibold">{t.label}</span>
            </>
          )
          const cls = 'flex-1 min-h-[60px] flex flex-col items-center justify-center gap-0.5'
          const style = { color: t.active ? GREEN : '#8B95A1' }
          return t.href ? (
            <Link key={t.key} href={t.href} className={cls} style={style} aria-current={t.active ? 'page' : undefined}>
              {inner}
            </Link>
          ) : (
            <button key={t.key} type="button" onClick={goNear} className={cls} style={style} aria-current={t.active ? 'page' : undefined}>
              {inner}
            </button>
          )
        })}
      </nav>
      {/* 탭에 내용이 가리지 않도록 자리 확보 */}
      <div className="h-[72px]" aria-hidden="true" />
    </>
  )
}
