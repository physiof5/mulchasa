'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BlogFeed from '@/components/BlogFeed'

interface Review {
  id: string
  author_name: string
  rating: number
  content: string
  therapist_name: string | null
}

const FALLBACK_REVIEWS: Review[] = [
  { id: 'd1', author_name: '김혜지', rating: 5, content: '허리 디스크로 3개월 고생했는데, 면허 보유 선생님이라 믿고 맡겼어요. 통증이 확실히 줄었습니다.', therapist_name: '박치료 선생님' },
  { id: 'd2', author_name: '신소은', rating: 5, content: '무릎 수술 후 재활을 받았어요. 자격이 검증된 분이라 운동 하나하나 안심하고 따라갈 수 있었습니다.', therapist_name: '이재활 선생님' },
  { id: 'd3', author_name: '정민우', rating: 5, content: '어깨 통증 때문에 찾았는데 친절하게 원인부터 설명해주셔서 좋았어요. 자세 교정도 받고 있습니다.', therapist_name: '최움직임 선생님' },
]

export default function Home() {
  const router = useRouter()
  const [stage, setStage] = useState<'checking' | 'onboarding' | 'ready'>('checking')
  const [locName] = useState('내 주변')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [reviews, setReviews] = useState<Review[]>(FALLBACK_REVIEWS)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const done = localStorage.getItem('mulchasa_location_set')
      const savedLat = localStorage.getItem('mulchasa_lat')
      const savedLng = localStorage.getItem('mulchasa_lng')
      if (done === '1') {
        if (savedLat && savedLng) {
          setUserLat(Number(savedLat))
          setUserLng(Number(savedLng))
        }
        setStage('ready')
      } else {
        setStage('onboarding')
      }
    } catch {
      setStage('ready')
    }
  }, [])

  useEffect(() => {
    if (stage !== 'ready') return
    async function fetchReviews() {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('id, nickname, rating, content')
          .order('created_at', { ascending: false })
          .limit(5)
        if (!error && data && data.length > 0) {
          const mapped: Review[] = data.map((r: { id: string; nickname: string; rating: number; content: string }) => ({
            id: r.id,
            author_name: r.nickname,
            rating: r.rating,
            content: r.content,
            therapist_name: null,
          }))
          setReviews(mapped)
        }
      } catch {
        // 더미 유지
      }
    }
    fetchReviews()
  }, [stage])

  const saveLocation = (lat: number | null, lng: number | null) => {
    try {
      localStorage.setItem('mulchasa_location_set', '1')
      if (lat !== null && lng !== null) {
        localStorage.setItem('mulchasa_lat', lat.toString())
        localStorage.setItem('mulchasa_lng', lng.toString())
      }
    } catch {
      // 진행
    }
    if (lat !== null && lng !== null) {
      setUserLat(lat)
      setUserLng(lng)
    }
    setStage('ready')
  }

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('이 기기에서는 위치 기능을 사용할 수 없습니다')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => saveLocation(position.coords.latitude, position.coords.longitude),
      () => {
        setGeoLoading(false)
        setGeoError('위치 권한이 거부되었습니다. 허용하거나 "다음에 하기"를 눌러주세요.')
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  const goSymptom = () => {
    const params = new URLSearchParams()
    if (userLat) params.set('lat', userLat.toString())
    if (userLng) params.set('lng', userLng.toString())
    const qs = params.toString()
    router.push(qs ? `/symptom?${qs}` : '/symptom')
  }

  const goMap = () => {
    const params = new URLSearchParams()
    params.set('view', 'map')
    if (userLat) params.set('lat', userLat.toString())
    if (userLng) params.set('lng', userLng.toString())
    router.push(`/search?${params.toString()}`)
  }

  if (stage === 'checking') {
    return <main className="max-w-md mx-auto min-h-screen bg-white" />
  }

  if (stage === 'onboarding') {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white flex flex-col">
        <div className="flex justify-end px-5 pt-5">
          <button onClick={() => saveLocation(null, null)} className="text-[15px] text-gray-400 font-medium">
            다음에 하기
          </button>
        </div>
        <div className="px-5 pt-8">
          <h1 className="text-[26px] font-extrabold text-gray-900 leading-snug">
            위치를 지정하고<br />
            가까운 전문가를 찾아보세요
          </h1>
          <p className="text-sm text-gray-400 mt-3 leading-relaxed">
            면허 검증된 물리치료사·운동전문가를<br />
            내 주변에서 찾아드려요
          </p>
        </div>
        <div className="px-5 pt-10">
          <button
            onClick={handleCurrentLocation}
            disabled={geoLoading}
            className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            style={{ background: geoLoading ? '#7FC3B7' : '#0A8A7B' }}
          >
            {geoLoading ? '위치를 불러오는 중...' : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3.5" stroke="white" strokeWidth="2" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="2" opacity="0.5" />
                </svg>
                현재 위치로 설정
              </>
            )}
          </button>
          {geoError && <p className="text-xs text-red-400 mt-3 leading-relaxed text-center">{geoError}</p>}
        </div>
        <div className="mt-auto px-5 pb-10 text-center">
          <p className="text-xs text-gray-300 leading-relaxed">
            물찾사의 모든 전문가는<br />
            물리치료사 면허를 보유하고 있습니다 🛡️
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <div className="bg-gray-50 px-5 pt-5 pb-2 flex items-center justify-between">
        <button className="flex items-center gap-1 text-lg font-bold text-gray-900">
          {locName}
          <span className="text-gray-400 text-base">▾</span>
        </button>
        <button onClick={goSymptom} className="text-gray-700" aria-label="검색">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mx-5 my-2 rounded-2xl p-5 relative overflow-hidden" style={{ background: '#0A8A7B' }}>
        <div className="text-xs mb-1" style={{ color: '#9FE1CB' }}>면허 검증된 전문가만</div>
        <div className="text-[17px] font-bold text-white leading-snug">
          믿을 수 있는 물리치료사,<br />물찾사에서 만나세요
        </div>
        <svg className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20" width="56" height="56" viewBox="0 0 24 24" fill="none">
          <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" fill="white" />
          <path d="m9 12 2 2 4-4" stroke="#0A8A7B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="px-5 pt-2 grid grid-cols-2 gap-2.5">
        <button onClick={goSymptom} className="row-span-2 bg-white border border-gray-100 rounded-2xl p-4 min-h-[150px] relative text-left active:scale-[0.98] transition-all">
          <span className="inline-block text-[11px] px-2 py-0.5 rounded-md mb-2" style={{ background: '#E1F5EE', color: '#0F6E56' }}>부위·목적 맞춤</span>
          <div className="text-[17px] font-bold text-gray-900">증상으로 찾기</div>
          <div className="text-xs text-gray-400 mt-0.5">치료사·운동전문가</div>
          <svg className="absolute right-3 bottom-3" width="46" height="46" viewBox="0 0 24 24" fill="none" style={{ color: '#5DCAA5' }}>
            <circle cx="12" cy="5" r="2.5" fill="currentColor" />
            <path d="M12 8v6m0 0-3 5m3-5 3 5M7 11l5-1 5 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button onClick={goMap} className="bg-white border border-gray-100 rounded-2xl p-4 relative text-left active:scale-[0.98] transition-all">
          <span className="inline-block text-[11px] px-2 py-0.5 rounded-md mb-1.5" style={{ background: '#FAECE7', color: '#993C1D' }}>내 주변</span>
          <div className="text-[15px] font-bold text-gray-900">지도로 찾기</div>
          <svg className="absolute right-2.5 bottom-2.5" width="30" height="30" viewBox="0 0 24 24" fill="none" style={{ color: '#F0997B' }}>
            <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>

        <button onClick={goSymptom} className="bg-white border border-gray-100 rounded-2xl p-4 relative text-left active:scale-[0.98] transition-all">
          <span className="inline-block text-[11px] px-2 py-0.5 rounded-md mb-1.5" style={{ background: '#E6F1FB', color: '#185FA5' }}>병원·센터</span>
          <div className="text-[15px] font-bold text-gray-900">센터 찾기</div>
          <svg className="absolute right-2.5 bottom-2.5" width="30" height="30" viewBox="0 0 24 24" fill="none" style={{ color: '#85B7EB' }}>
            <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 21h4V11a1 1 0 0 0-1-1h-3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M9 7v4m-2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <BlogFeed />

      <div className="px-5 pb-4">
        <div className="text-base font-bold text-gray-900 mb-2.5">실시간 후기</div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {reviews.map((r) => (
            <div key={r.id} className="shrink-0 w-[280px] bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold" style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                  {r.author_name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{r.author_name}</div>
                  <div className="text-xs" style={{ color: '#BA7517' }}>★ {r.rating.toFixed(1)}</div>
                </div>
              </div>
              <div className="text-[13px] text-gray-600 leading-relaxed line-clamp-3">{r.content}</div>
              {r.therapist_name && <div className="text-[11px] text-gray-400 mt-2">{r.therapist_name}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-5 mb-8 p-5 rounded-2xl border" style={{ background: 'linear-gradient(to bottom right, #E8F6F4, #ffffff)', borderColor: 'rgba(10,138,123,0.1)' }}>
        <p className="text-sm font-bold text-gray-900 mb-1">물리치료사이신가요? 👋</p>
        <p className="text-xs text-gray-500 leading-relaxed mb-4">
          물찾사에 가입하고 환자와 직접 연결되세요.<br />
          면허 인증 후 24시간 내 활성화됩니다.
        </p>
        <button onClick={() => router.push('/register')} className="w-full py-3 bg-white border rounded-xl font-bold text-sm transition-all" style={{ borderColor: '#0A8A7B', color: '#0A8A7B' }}>
          치료사로 가입하기 →
        </button>
      </div>

      <nav className="max-w-md mx-auto fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex py-2 px-0">
        <TabItem active label="홈" />
        <TabItem label="내 주변" onClick={goMap} />
        <TabItem label="채팅" />
        <TabItem label="찜" />
        <TabItem label="내 정보" onClick={() => router.push('/mypage')} />
      </nav>
      <div className="h-16" />
    </main>
  )
}

function TabItem({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  const icons: Record<string, React.ReactNode> = {
    '홈': <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
    '내 주변': <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="m15 9-4 1.5L9.5 15 14 13l1-4Z" fill="currentColor" /></>,
    '채팅': <path d="M4 5h16v11H9l-4 3v-3H4V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
    '찜': <path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.5 12 20 12 20Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
    '내 정보': <><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
  }
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center gap-0.5" style={{ color: active ? '#0A8A7B' : '#9CA3AF' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">{icons[label]}</svg>
      <span className="text-[11px]">{label}</span>
    </button>
  )
}
