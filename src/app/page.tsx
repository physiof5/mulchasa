'use client'

// 홈 — 매칭에 집중한 대시보드
// 전문가 찾기(내 주변 거리순) · 상담 요청(무료) · 센터 찾기(지도) · 방문 PT 견적 받기(10회 기준)
// 정보성 자료(제도 소식·서식·자가진단)는 하단 '둘러보기' 탭으로 옮김

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import HomeActivity from '@/components/HomeActivity'
import { saveDeviceCoords, setDeviceItem, useIsClient, useLocalStorageItem } from '@/lib/useDeviceStorage'

interface Review {
  id: string
  nickname: string
  rating: number
  content: string
}

const GREEN = '#0A8A7B'
const GREEN_DARK = '#0F6E56'
const GREEN_LIGHT = '#E8F6F4'

// 보호자가 '병명'이 아니라 '지금 상황'으로 고르는 입구 → 전문가 운동 지도 분야(tags.label)로 연결
const SITUATIONS = [
  { label: '혼자 일어나기·\n걷기가 힘들어요', tag: '일상생활 동작 회복' },
  { label: '자꾸 넘어질까\n걱정돼요', tag: '보행·균형(낙상 예방)' },
  { label: '수술 후 회복\n운동이 필요해요', tag: '수술 후 재활 운동' },
  { label: '허리·무릎이\n불편해요', tag: '근골격 재활 운동' },
]
const NEURO_TAG = '신경계 재활 운동'

export default function Home() {
  const router = useRouter()
  const isClient = useIsClient()
  const locationSet = useLocalStorageItem('mulchasa_location_set')
  const lat = useLocalStorageItem('mulchasa_lat')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const onboarding = isClient && (showOnboarding || locationSet !== '1')

  // 실제 후기만 (예시 후기 금지 — 없으면 영역을 숨김)
  useEffect(() => {
    let alive = true
    supabase
      .from('reviews')
      .select('id, nickname, rating, content')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (alive && !error && data) setReviews(data as Review[])
      })
    return () => {
      alive = false
    }
  }, [])

  const skipLocation = () => {
    setDeviceItem('mulchasa_location_set', '1')
    setShowOnboarding(false)
  }

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('이 기기에서는 위치 기능을 쓸 수 없어요.')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        saveDeviceCoords(p.coords.latitude, p.coords.longitude)
        setGeoLoading(false)
        setShowOnboarding(false)
      },
      () => {
        setGeoLoading(false)
        setGeoError('위치 권한이 거부되었어요. 허용하거나 "다음에 하기"를 눌러 주세요.')
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  const goPurpose = (tag: string) => router.push(`/experts?purpose=${encodeURIComponent(tag)}`)

  if (!isClient) return <main className="max-w-md mx-auto min-h-screen bg-gray-50" />

  if (onboarding) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white flex flex-col">
        <div className="flex justify-end px-5 pt-5">
          <button onClick={skipLocation} className="min-h-[48px] text-[15px] text-gray-400 font-medium">
            다음에 하기
          </button>
        </div>
        <div className="px-5 pt-8">
          <h1 className="text-[26px] font-extrabold text-gray-900 leading-snug">
            위치를 지정하고
            <br />
            가까운 전문가를 찾아보세요
          </h1>
          <p className="text-[15px] text-gray-500 mt-3 leading-relaxed">
            물리치료사 면허를 가진 운동 전문가를 내 주변에서 찾아 드려요.
            <br />
            위치는 이 기기에만 저장돼요.
          </p>
        </div>
        <div className="px-5 pt-10">
          <button
            onClick={handleCurrentLocation}
            disabled={geoLoading}
            className="w-full min-h-[56px] rounded-2xl font-bold text-[17px] text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            style={{ background: geoLoading ? '#7FC3B7' : GREEN }}
          >
            {geoLoading ? '위치를 불러오는 중...' : '현재 위치로 설정'}
          </button>
          {geoError && <p className="text-[14px] text-red-500 mt-3 leading-relaxed text-center">{geoError}</p>}
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      {/* 상단: 위치 + 내 프로필 */}
      <div className="px-5 pt-4 flex items-center justify-between">
        <button onClick={() => setShowOnboarding(true)} className="flex items-center gap-1 text-[20px] font-extrabold text-gray-900 min-h-[48px]">
          {lat ? '내 주변' : '위치 설정하기'}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-gray-500">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Link href="/mypage" aria-label="내 프로필" className="w-12 h-12 flex items-center justify-center text-gray-700">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="2" />
            <path d="M4.5 20.5c0-3.8 3.4-6.5 7.5-6.5s7.5 2.7 7.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      {/* 진행 중인 상담 (로그인 + 진행 중인 일이 있을 때만) */}
      <HomeActivity />

      {/* 매칭 대시보드 */}
      <section className="px-5 pt-3">
        <div className="grid grid-cols-2 gap-3">
          <Tile href="/experts" badge="내 주변 거리순" title="전문가 찾기" sub="면허 확인된 물리치료사" tall icon={<ExpertsArt />} />
          <div className="flex flex-col gap-3">
            <Tile href="/consult/new" badge="무료 상담" title="상담 요청" sub="무료로 물어보세요" icon={<ChatArt />} />
            <Tile href="/centers" title="센터 찾기" sub="운동센터 위치 보기" icon={<CenterArt />} />
          </div>
        </div>
        <div className="mt-3">
          <Tile href="/request" badge="10회 기준" title="방문 PT 견적 받기" sub="집으로 오는 운동 지도, 견적을 한눈에" wide icon={<QuoteArt />} />
        </div>

        <div className="mt-4 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-white border border-gray-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z" fill={GREEN} />
            <path d="m9 12 2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[15px] font-semibold text-gray-700">모든 전문가는 면허증을 확인했어요</span>
        </div>
      </section>

      {/* 상황으로 찾기 */}
      <section className="px-5 pt-8">
        <h2 className="text-[19px] font-extrabold text-gray-900">부모님이 이런 상황이라면</h2>
        <p className="text-[14px] text-gray-500 mt-0.5 mb-3">운동을 지도해 줄 물리치료사를 찾아 드려요</p>

        <button
          onClick={() => goPurpose(NEURO_TAG)}
          className="w-full flex items-center gap-3 p-4 mb-2.5 rounded-2xl border-2 text-left active:scale-[0.98] transition-all"
          style={{ borderColor: '#9FD8CE', background: '#F1FAF8' }}
        >
          <span className="text-[26px] shrink-0" aria-hidden="true">
            🧠
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[16px] font-bold text-gray-900 leading-snug">
              뇌졸중·파킨슨 등으로
              <br />
              일상생활이 불편해요
            </span>
            <span className="block text-[13px] mt-0.5" style={{ color: GREEN_DARK }}>
              신경계 재활 운동 전문가 보기
            </span>
          </span>
          <span className="text-gray-400 text-xl shrink-0" aria-hidden="true">
            ›
          </span>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          {SITUATIONS.map((s) => (
            <button
              key={s.tag}
              onClick={() => goPurpose(s.tag)}
              className="bg-white border border-gray-100 rounded-2xl p-4 min-h-[80px] text-left flex flex-col justify-center active:scale-[0.98] transition-all"
            >
              <span className="text-[15px] font-semibold text-gray-800 leading-snug whitespace-pre-line">{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 실제 후기 (있을 때만) */}
      {reviews.length > 0 && (
        <section className="pt-8">
          <h2 className="px-5 text-[19px] font-extrabold text-gray-900 mb-3">이용 후기</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 px-5" style={{ scrollbarWidth: 'none' }}>
            {reviews.map((r) => (
              <div key={r.id} className="shrink-0 w-[280px] bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold" style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
                    {r.nickname.charAt(0)}
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-gray-900">{r.nickname}</div>
                    <div className="text-[12px]" style={{ color: '#BA7517' }}>
                      ★ {Number(r.rating).toFixed(1)}
                    </div>
                  </div>
                </div>
                <div className="text-[14px] text-gray-600 leading-relaxed line-clamp-3">{r.content}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 둘러보기 안내 */}
      <section className="px-5 pt-8">
        <Link href="/browse" className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-4 min-h-[64px]">
          <span className="flex-1 min-w-0">
            <span className="block text-[16px] font-bold text-gray-900">제도 소식 · 서식자료 · 자가진단</span>
            <span className="block text-[14px] text-gray-500 mt-0.5">둘러보기에서 한곳에 모아 볼 수 있어요</span>
          </span>
          <span className="text-gray-300 text-xl" aria-hidden="true">
            ›
          </span>
        </Link>
      </section>

      <section className="px-5 pt-4 pb-8">
        <div className="p-5 rounded-2xl border" style={{ background: 'linear-gradient(to bottom right, #E8F6F4, #ffffff)', borderColor: 'rgba(10,138,123,0.1)' }}>
          <p className="text-[16px] font-bold text-gray-900 mb-1">물리치료사이신가요?</p>
          <p className="text-[14px] text-gray-500 leading-relaxed mb-4">
            운동센터 운영·소속, 프리랜서 방문, 육아와 함께하는 파트타임까지. 면허 확인 후 보호자와 직접 연결돼요.
          </p>
          <Link href="/register" className="w-full min-h-[48px] bg-white border rounded-xl font-bold text-[15px] flex items-center justify-center" style={{ borderColor: GREEN, color: GREEN }}>
            전문가로 가입하기 →
          </Link>
        </div>
      </section>

      <BottomNav />
    </main>
  )
}

function Tile({
  href,
  badge,
  title,
  sub,
  icon,
  tall,
  wide,
}: {
  href: string
  badge?: string
  title: string
  sub: string
  icon: React.ReactNode
  tall?: boolean
  wide?: boolean
}) {
  return (
    <Link
      href={href}
      className={
        'relative block bg-white rounded-3xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] active:scale-[0.98] transition-all ' +
        (tall ? 'h-full min-h-[268px] p-5' : wide ? 'min-h-[112px] p-5 pr-28' : 'min-h-[128px] p-4 pr-3')
      }
    >
      {badge && (
        <span className="absolute -top-2.5 left-4 px-2.5 py-1 rounded-full text-[12px] font-bold text-white" style={{ background: GREEN_DARK }}>
          {badge}
        </span>
      )}
      <span className={'block font-extrabold text-gray-900 leading-tight ' + (tall ? 'text-[24px] mt-2' : wide ? 'text-[21px] mt-1' : 'text-[19px] mt-1.5')}>{title}</span>
      <span className={'block text-gray-500 mt-1 leading-snug ' + (tall ? 'text-[14px]' : 'text-[13px]')}>{sub}</span>
      <span className={'absolute ' + (tall ? 'right-4 bottom-4' : wide ? 'right-5 top-1/2 -translate-y-1/2' : 'right-3 bottom-3')} aria-hidden="true">
        {icon}
      </span>
    </Link>
  )
}

// ── 타일 그림 (브랜드 색 선 그림) ──
function ExpertsArt() {
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" fill="none">
      <circle cx="56" cy="56" r="52" fill={GREEN_LIGHT} />
      <circle cx="44" cy="40" r="11" fill="#fff" stroke={GREEN} strokeWidth="4" />
      <path d="M26 84c0-12 8-20 18-20s18 8 18 20" fill="#fff" stroke={GREEN} strokeWidth="4" strokeLinecap="round" />
      <circle cx="74" cy="66" r="15" fill="#fff" stroke={GREEN_DARK} strokeWidth="4" />
      <path d="m85 77 10 10" stroke={GREEN_DARK} strokeWidth="5" strokeLinecap="round" />
      <path d="m68 66 4 4 8-8" stroke={GREEN} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ChatArt() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="26" r="25" fill={GREEN_LIGHT} />
      <path d="M13 17a4 4 0 0 1 4-4h18a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H23l-7 6v-6h0a3 3 0 0 1-3-3V17Z" fill="#fff" stroke={GREEN} strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 23h.01M26 23h.01M32 23h.01" stroke={GREEN_DARK} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}
function CenterArt() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="26" r="25" fill={GREEN_LIGHT} />
      <path d="M26 41s11-8.5 11-17a11 11 0 1 0-22 0c0 8.5 11 17 11 17Z" fill="#fff" stroke={GREEN} strokeWidth="3" strokeLinejoin="round" />
      <path d="M21 27v-5l5-3.5 5 3.5v5h-10Z" stroke={GREEN_DARK} strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  )
}
function QuoteArt() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="31" fill={GREEN_LIGHT} />
      <path d="M20 14h24v36l-4-3-4 3-4-3-4 3-4-3-4 3V14Z" fill="#fff" stroke={GREEN} strokeWidth="3" strokeLinejoin="round" />
      <path d="M26 24h12M26 31h12M26 38h7" stroke={GREEN_DARK} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
