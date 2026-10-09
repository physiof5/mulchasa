'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BlogFeed from '@/components/BlogFeed'
import BottomNav from '@/components/BottomNav'

interface Review {
  id: string
  author_name: string
  rating: number
  content: string
  therapist_name: string | null
}

const GREEN = '#0A8A7B'

// 보호자가 '병명'이 아니라 '지금 상황'으로 고르는 입구 → 전문가 운동 지도 분야(tags.label)로 연결
const SITUATIONS = [
  { label: '혼자 일어나기·\n걷기가 힘들어요', tag: '일상생활 동작 회복', emoji: '🚶' },
  { label: '자꾸 넘어질까\n걱정돼요', tag: '보행·균형(낙상 예방)', emoji: '🧓' },
  { label: '수술 후 회복\n운동이 필요해요', tag: '수술 후 재활 운동', emoji: '🩹' },
  { label: '허리·무릎이\n불편해요', tag: '근골격 재활 운동', emoji: '🦵' },
]
const NEURO_TAG = '신경계 재활 운동'


export default function Home() {
  const router = useRouter()
  const [stage, setStage] = useState<'checking' | 'onboarding' | 'ready'>('checking')
  const [locName] = useState('내 주변')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
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
        // 불러오기 실패 시 후기 영역을 숨김
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

  // 부모님 상황 맞춤 찾기 (위치는 /find가 기기에서 직접 읽음)
  const goFind = () => router.push('/find')

  // 상황 타일 → 해당 운동 지도 분야 전문가 목록
  const goPurpose = (tag: string) => {
    const params = new URLSearchParams()
    params.set('purpose', tag)
    if (userLat) params.set('lat', userLat.toString())
    if (userLng) params.set('lng', userLng.toString())
    router.push(`/search?${params.toString()}`)
  }

  // 제도·지원금: 홈의 블로그 글 영역으로 이동, 글을 못 불러왔으면 블로그를 바로 열기
  const scrollToInfo = () => {
    const el = document.getElementById('info')
    if (el && el.offsetHeight > 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.open('https://blog.naver.com/spacex_2025', '_blank', 'noopener,noreferrer')
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
            물리치료사 면허를 가진 운동 전문가를<br />
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
            모든 전문가는<br />
            물리치료사 면허를 확인했어요 🛡️
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      {/* 상단: 위치 + 내 정보 */}
      <div className="px-5 pt-4 flex items-center justify-between">
        <button onClick={() => setStage('onboarding')} className="flex items-center gap-1 text-[19px] font-bold text-gray-900 min-h-[48px]">
          {userLat !== null ? locName : '위치 설정하기'}
          <span className="text-gray-400 text-base">▾</span>
        </button>
        <button onClick={() => router.push('/mypage')} aria-label="내 정보" className="w-12 h-12 flex items-center justify-center text-gray-700">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
            <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 검색처럼 보이는 입구 → 맞춤 찾기 */}
      <div className="px-5 pt-1">
        <button onClick={goFind} className="w-full flex items-center gap-2.5 px-4 min-h-[52px] rounded-2xl bg-white border border-gray-200 text-left active:scale-[0.99] transition-all">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-400 shrink-0">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-[16px] text-gray-400">어떤 운동 도움이 필요하세요?</span>
        </button>
        <p className="mt-3 text-[15px] font-semibold" style={{ color: '#0F6E56' }}>
          🛡️ 물리치료사 면허를 가진 운동 전문가만 만나요
        </p>
      </div>

      {/* 두 갈래 입구: 정보 / 운동 지도 */}
      <div className="px-5 pt-4 grid grid-cols-2 gap-3">
        <button onClick={scrollToInfo} className="bg-white border border-gray-100 rounded-2xl p-4 min-h-[150px] text-left flex flex-col active:scale-[0.98] transition-all">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" style={{ color: GREEN }}>
            <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="mt-auto block text-[18px] font-bold text-gray-900 leading-snug">제도·지원금<br />알아보기</span>
          <span className="block text-[13px] text-gray-500 mt-1">장기요양등급·복지용구</span>
        </button>
        <button onClick={goFind} className="rounded-2xl p-4 min-h-[150px] text-left flex flex-col text-white active:scale-[0.98] transition-all" style={{ background: GREEN }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="text-white">
            <circle cx="12" cy="5" r="2.5" fill="currentColor" />
            <path d="M12 8v6m0 0-3 5m3-5 3 5M7 11l5-1 5 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="mt-auto block text-[18px] font-bold leading-snug">부모님 운동 지도<br />부탁하기</span>
          <span className="block text-[13px] mt-1" style={{ color: '#CFEDE7' }}>집으로 방문 · 운동센터</span>
        </button>
      </div>

      {/* 상황으로 찾기 */}
      <section className="px-5 pt-7">
        <h2 className="text-[18px] font-bold text-gray-900">부모님이 이런 상황이라면</h2>
        <p className="text-[14px] text-gray-500 mt-0.5 mb-3">운동을 지도해 줄 물리치료사를 찾아 드려요</p>

        <button
          onClick={() => goPurpose(NEURO_TAG)}
          className="w-full flex items-center gap-3 p-4 mb-2.5 rounded-2xl border-2 text-left active:scale-[0.98] transition-all"
          style={{ borderColor: '#9FD8CE', background: '#F1FAF8' }}
        >
          <span className="text-[26px] shrink-0">🧠</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[16px] font-bold text-gray-900 leading-snug">뇌졸중·파킨슨 등으로<br />일상생활이 불편해요</span>
            <span className="block text-[13px] mt-0.5" style={{ color: '#0F6E56' }}>신경계 재활 운동 전문가 보기</span>
          </span>
          <span className="text-gray-400 text-xl shrink-0">›</span>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          {SITUATIONS.map((s) => (
            <button
              key={s.tag}
              onClick={() => goPurpose(s.tag)}
              className="bg-white border border-gray-100 rounded-2xl p-4 min-h-[96px] text-left flex flex-col gap-1.5 active:scale-[0.98] transition-all"
            >
              <span className="text-[22px]">{s.emoji}</span>
              <span className="text-[15px] font-semibold text-gray-800 leading-snug whitespace-pre-line">{s.label}</span>
            </button>
          ))}
        </div>

        <button onClick={goMap} className="w-full mt-3 py-3 text-[15px] font-semibold text-gray-500 min-h-[48px]">
          지도로 내 주변 전문가 보기 →
        </button>
      </section>

      {/* 1분 자가진단 — 블로그·유튜브에서 들어온 보호자가 바로 해 볼 수 있게 */}
      <section className="px-5 pt-5">
        <h2 className="text-[18px] font-bold text-gray-900">1분 자가진단</h2>
        <p className="text-[14px] text-gray-500 mt-0.5 mb-3">설치 없이 바로, 결과는 이 기기에만 남아요</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/check/fall" className="bg-white border border-gray-100 rounded-2xl p-4 min-h-[112px] flex flex-col gap-1.5 active:scale-[0.98] transition-all">
            <span className="text-[24px]" aria-hidden="true">🧓</span>
            <span className="text-[16px] font-bold text-gray-900 leading-snug">넘어질 위험<br />체크</span>
          </Link>
          <Link href="/check/ltc" className="bg-white border border-gray-100 rounded-2xl p-4 min-h-[112px] flex flex-col gap-1.5 active:scale-[0.98] transition-all">
            <span className="text-[24px]" aria-hidden="true">📋</span>
            <span className="text-[16px] font-bold text-gray-900 leading-snug">장기요양등급<br />예상</span>
          </Link>
        </div>
      </section>

      <div id="info" className="scroll-mt-4 pt-2">
        <BlogFeed />
      </div>

      {reviews.length > 0 && (
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
      )}

      <div className="mx-5 mb-8 p-5 rounded-2xl border" style={{ background: 'linear-gradient(to bottom right, #E8F6F4, #ffffff)', borderColor: 'rgba(10,138,123,0.1)' }}>
        <p className="text-[16px] font-bold text-gray-900 mb-1">물리치료사이신가요? 👋</p>
        <p className="text-[14px] text-gray-500 leading-relaxed mb-4">
          운동센터 운영·소속, 프리랜서 방문, 육아와 함께하는 파트타임까지.<br />
          면허 확인 후 보호자와 직접 연결돼요.
        </p>
        <button onClick={() => router.push('/register')} className="w-full py-3.5 bg-white border rounded-xl font-bold text-[15px] transition-all" style={{ borderColor: GREEN, color: GREEN }}>
          전문가로 가입하기 →
        </button>
      </div>

      <BottomNav />
    </main>
  )
}

