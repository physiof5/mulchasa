'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Script from 'next/script'
import ConsultFormModal from '@/components/ConsultFormModal'
import PhotoTriplet from '@/components/PhotoTriplet'
import { pickPhotos } from '@/lib/squareImage'
import { practitionerLabel, summarizeAvailability } from '@/lib/practitioner'

interface Therapist {
  id: string
  name: string
  hospital_name: string | null
  studio_name: string | null
  years_experience: number
  practitioner_type: string
  intro: string
  kakao_link: string
  latitude: number | null
  longitude: number | null
  distance?: number | null
  profile_image_url: string | null
  tags?: string[]
  rating?: number | null
  reviewCount?: number
  purposeMatch?: boolean
  service_mode: string | null
  visit_radius_km: number | null
  availability?: string[]
  /** 대표 사진 (정사각형, 최대 3장) */
  photos?: string[]
}

declare global {
  interface Window {
    kakao: any
  }
}

// 유사 목적 태그 묶음: 설문에서 닿지 않던 태그도 함께 매칭
const PURPOSE_GROUPS: Record<string, string[]> = {
  '필라테스': ['필라테스', '1:1 PT'],
  '1:1 PT': ['1:1 PT', '필라테스'],
  '수술 후 재활 운동': ['수술 후 재활 운동', '스포츠 재활 운동'],
  '스포츠 재활 운동': ['스포츠 재활 운동', '수술 후 재활 운동'],
  '신경계 재활 운동': ['신경계 재활 운동', '일상생활 동작 회복'],
  '일상생활 동작 회복': ['일상생활 동작 회복', '신경계 재활 운동', '보행·균형(낙상 예방)'],
  '보행·균형(낙상 예방)': ['보행·균형(낙상 예방)', '일상생활 동작 회복'],
}


function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  if (km < 10) return `${km.toFixed(1)}km`
  return `${Math.round(km)}km`
}

function typeLabel(type: string): string {
  return practitionerLabel(type)
}

const EXPERIENCE_FILTERS = [
  { label: '전체', min: 0 },
  { label: '3년+', min: 3 },
  { label: '5년+', min: 5 },
  { label: '10년+', min: 10 },
]

// 활동 형태 필터 (service_mode 기준이라 예전 가입자도 함께 걸러짐)
const TYPE_FILTERS = [
  { label: '전체', value: 'all' },
  { label: '🏢 운동센터', value: 'center' },
  { label: '🏠 방문', value: 'visit' },
]

// 와이드 배너형 결과 카드 → 대표 사진 3장(정사각형) 카드
function ResultCard({ t, onProfile, onConsult, isVisitMode }: {
  t: Therapist
  onProfile: () => void
  onConsult: () => void
  isVisitMode?: boolean
}) {
  const availText = summarizeAvailability(t.availability || [])
  const canVisit = t.service_mode === 'visit' || t.service_mode === 'both'
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* 대표 사진 3장 (정사각형) */}
      <div className="relative cursor-pointer" onClick={onProfile}>
        <PhotoTriplet urls={t.photos ?? pickPhotos(null, t.profile_image_url)} name={t.name} />
        <span className="absolute top-3 left-3 bg-white/95 text-[11px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1" style={{ color: '#0F6E56' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#0A8A7B" /><path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          면허 인증
        </span>
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
          {canVisit && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-md text-white" style={{ background: '#B45309' }}>
              🏠 방문 가능
            </span>
          )}
          {t.purposeMatch && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-md text-white" style={{ background: '#0A8A7B' }}>
              ✓ 목적 맞춤
            </span>
          )}
        </div>
        {t.distance != null && (
          <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-semibold px-2.5 py-1 rounded-md">
            📍 {formatDistance(t.distance)}
          </span>
        )}
      </div>

      {/* 정보 */}
      <div className="px-4 pt-3.5 pb-4">
        <div className="cursor-pointer" onClick={onProfile}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[18px] font-bold text-gray-900">{t.name}</span>
            {t.rating != null && (
              <>
                <span className="text-[13px] font-semibold" style={{ color: '#BA7517' }}>★ {t.rating.toFixed(1)}</span>
                <span className="text-xs text-gray-400">({t.reviewCount})</span>
              </>
            )}
          </div>
          <div className="text-[13px] text-gray-500 mb-2">
            경력 {t.years_experience}년 · {typeLabel(t.practitioner_type)}
            {(t.hospital_name || t.studio_name) && ` · ${t.hospital_name || t.studio_name}`}
          </div>

          {availText && (
            <div className="text-[12px] text-gray-500 mb-2.5 flex items-start gap-1">
              <span className="shrink-0">🕐</span>
              <span>{availText}</span>
            </div>
          )}

          {isVisitMode && t.visit_radius_km != null && (
            <div className="text-[12px] mb-2.5" style={{ color: '#B45309' }}>
              🏠 {t.visit_radius_km}km 이내 방문
            </div>
          )}

          {/* 태그 */}
          {t.tags && t.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-3">
              {t.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-md" style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 카톡 버튼 */}
        <button
          onClick={onConsult}
          className="w-full py-3 bg-[#FEE500] text-gray-900 rounded-xl font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
        >
          💬 카톡 상담하기
        </button>
      </div>
    </div>
  )
}

// 카카오맵
function KakaoMap({ therapists, userLat, userLng, onSelectTherapist }: {
  therapists: Therapist[]
  userLat: number | null
  userLng: number | null
  onSelectTherapist: (t: Therapist) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [sdkReady, setSdkReady] = useState(false)

  useEffect(() => {
    if (!sdkReady || !mapRef.current || !window.kakao?.maps) return

    window.kakao.maps.load(() => {
      if (!mapRef.current) return

      const centerLat = userLat ?? (therapists[0]?.latitude ?? 37.5665)
      const centerLng = userLng ?? (therapists[0]?.longitude ?? 126.9780)

      const map = new window.kakao.maps.Map(mapRef.current, {
        center: new window.kakao.maps.LatLng(centerLat, centerLng),
        level: 6,
      })

      const bounds = new window.kakao.maps.LatLngBounds()
      let boundsCount = 0

      if (userLat && userLng) {
        const myMarkerImage = new window.kakao.maps.MarkerImage(
          'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="#3B82F6" stroke="white" stroke-width="3"/>
              <circle cx="12" cy="12" r="4" fill="white"/>
            </svg>
          `),
          new window.kakao.maps.Size(24, 24),
          { offset: new window.kakao.maps.Point(12, 12) }
        )
        new window.kakao.maps.Marker({
          map,
          position: new window.kakao.maps.LatLng(userLat, userLng),
          image: myMarkerImage,
          title: '내 위치',
        })
        bounds.extend(new window.kakao.maps.LatLng(userLat, userLng))
        boundsCount++
      }

      // 치료사 "말풍선 1명" 클러스터 스타일 마커 (운동닥터 스타일)
      therapists.forEach(t => {
        if (!t.latitude || !t.longitude) return

        const labelName = (t.hospital_name || t.studio_name || t.name)
        const shortName = labelName.length > 7 ? labelName.slice(0, 7) + '…' : labelName

        const content = document.createElement('div')
        content.style.cssText = 'transform: translate(-50%, -100%); cursor: pointer;'
        content.innerHTML = `
          <div style="background:#0A8A7B; color:#fff; border-radius:18px; padding:6px 12px; font-size:13px; font-weight:700; font-family:sans-serif; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.25); display:flex; flex-direction:column; align-items:center; line-height:1.3; position:relative;">
            <span>1명</span>
            <span style="font-size:11px; font-weight:500;">${shortName}</span>
            <div style="position:absolute; bottom:-6px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:7px solid #0A8A7B;"></div>
          </div>
        `
        content.addEventListener('click', () => onSelectTherapist(t))

        const overlay = new window.kakao.maps.CustomOverlay({
          map,
          position: new window.kakao.maps.LatLng(t.latitude, t.longitude),
          content,
          yAnchor: 1,
          xAnchor: 0.5,
        })
        void overlay

        bounds.extend(new window.kakao.maps.LatLng(t.latitude, t.longitude))
        boundsCount++
      })

      // 모든 마커가 보이도록 범위 자동 조정
      if (boundsCount >= 2) {
        map.setBounds(bounds, 60, 60, 60, 60)
      } else if (boundsCount === 1) {
        map.setCenter(bounds.getCenter())
        map.setLevel(4)
      }
    })
  }, [sdkReady, therapists, userLat, userLng])

  return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`}
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
        onLoad={() => setSdkReady(true)}
      />
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}

// 지도 하단 시트 (운동닥터 스타일 - 큰 시트)
function MapBottomSheet({ therapist, onClose, onConsult, onProfile }: {
  therapist: Therapist
  onClose: () => void
  onConsult: () => void
  onProfile: () => void
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-20" style={{ animation: 'slideUp 0.25s ease-out' }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      {/* 핸들 */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>

      {/* 닫기 */}
      <button onClick={onClose} className="absolute top-3 right-4 text-gray-400 text-2xl leading-none z-10">×</button>

      {/* 소속 헤더 */}
      <div className="px-5 pt-2 pb-3">
        <div className="text-[17px] font-bold text-gray-900">{therapist.hospital_name || therapist.studio_name}</div>
        <div className="text-xs text-gray-400 mt-0.5">{typeLabel(therapist.practitioner_type)}</div>
      </div>

      {/* 대표 사진 3장 (정사각형) */}
      <div className="px-5 mb-4 cursor-pointer" onClick={onProfile}>
        <PhotoTriplet urls={therapist.photos ?? pickPhotos(null, therapist.profile_image_url)} name={therapist.name} rounded="rounded-2xl" />
      </div>

      {/* 정보 */}
      <div className="px-5 pb-2 cursor-pointer" onClick={onProfile}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[18px] font-bold text-gray-900">{therapist.name}</span>
          {therapist.rating != null && (
            <span className="text-[13px] font-semibold" style={{ color: '#BA7517' }}>★ {therapist.rating.toFixed(1)} <span className="text-gray-400 font-normal">({therapist.reviewCount})</span></span>
          )}
          <span className="ml-auto px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">✓ 면허 인증</span>
        </div>
        <div className="text-[13px] text-gray-500 mb-2">
          경력 {therapist.years_experience}년
          {therapist.distance != null && <span style={{ color: '#0A8A7B' }} className="font-bold"> · 📍 {formatDistance(therapist.distance)}</span>}
        </div>
        {therapist.tags && therapist.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {therapist.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-md" style={{ background: '#E1F5EE', color: '#0F6E56' }}>{tag}</span>
            ))}
          </div>
        )}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{therapist.intro}</p>
      </div>

      {/* 버튼 */}
      <div className="px-5 pb-6 flex gap-2">
        <button onClick={onProfile} className="flex-1 py-3 border border-[#0A8A7B] text-[#0A8A7B] rounded-xl text-sm font-semibold">
          프로필 보기
        </button>
        <button onClick={onConsult} className="flex-1 py-3 bg-[#FEE500] text-gray-900 rounded-xl text-sm font-bold">
          💬 카톡 상담
        </button>
      </div>
    </div>
  )
}

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [filtered, setFiltered] = useState<Therapist[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTherapist, setSelectedTherapist] = useState<Therapist | null>(null)
  const [mapSelectedTherapist, setMapSelectedTherapist] = useState<Therapist | null>(null)
  const [expFilter, setExpFilter] = useState(0)
  const [typeFilter, setTypeFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>(
    searchParams.get('view') === 'map' ? 'map' : 'list'
  )

  const bodyPart = searchParams.get('part')
  const purpose = searchParams.get('purpose')
  const userLat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null
  const userLng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null
  // 설문에서 고른 제공 방식: 'visit'(집으로 방문) / 'center'(센터 내방) / null(무관)
  const mode = searchParams.get('mode')
  const isVisitMode = mode === 'visit'
  // 부위/목적 없이 들어오면 전체 치료사 모드 (지도로 찾기)
  const isAllMode = !bodyPart && !purpose
  const hasLocation = userLat !== null && userLng !== null
  // 방문 검색은 "내 위치가 치료사의 방문 반경 안에 드는가"를 계산해야 하므로 위치가 필수
  const needsLocation = isVisitMode && !hasLocation

  useEffect(() => {
    async function fetchTherapists() {
      setLoading(true)

      // 태그 라벨 ↔ id 맵 (한 번만 로드)
      const { data: allTagData } = await supabase
        .from('tags').select('id, label, category')
      const labelToId: Record<string, string> = {}
      const idToLabel: Record<string, string> = {}
      ;(allTagData || []).forEach(tg => {
        labelToId[tg.label] = tg.id
        idToLabel[tg.id] = tg.label
      })

      const partTagId = bodyPart ? labelToId[bodyPart] : undefined
      const purposeLabels = purpose ? (PURPOSE_GROUPS[purpose] || [purpose]) : []
      const purposeTagIds = purposeLabels
        .map(l => labelToId[l])
        .filter(Boolean) as string[]

      let therapistIds: string[] = []
      let purposeMatchedIds = new Set<string>()

      if (!bodyPart && !purpose) {
        // 전체 모드 (지도로 찾기): 검증된 모든 치료사
        const { data: allVerified } = await supabase
          .from('therapists').select('id').eq('verification_status', 'verified')
        therapistIds = (allVerified || []).map(t => t.id)
      } else {
        const targetTagIds = [partTagId, ...purposeTagIds].filter(Boolean) as string[]
        if (targetTagIds.length === 0) { setTherapists([]); setLoading(false); return }

        const { data: ttData } = await supabase
          .from('therapist_tags').select('therapist_id, tag_id').in('tag_id', targetTagIds)
        if (!ttData || ttData.length === 0) { setTherapists([]); setLoading(false); return }

        const hasPart = new Set<string>()
        const hasPurpose = new Set<string>()
        ttData.forEach(r => {
          if (partTagId && r.tag_id === partTagId) hasPart.add(r.therapist_id)
          if (purposeTagIds.includes(r.tag_id)) hasPurpose.add(r.therapist_id)
        })
        purposeMatchedIds = hasPurpose

        if (bodyPart && purpose) {
          // 부위 우선: 부위 전문가를 모두 노출, 목적까지 맞는 사람을 위로 정렬
          // 부위 전문가가 한 명도 없으면 목적 풀로 폴백 (빈 화면 방지)
          const partPool = Array.from(hasPart)
          therapistIds = partPool.length > 0 ? partPool : Array.from(hasPurpose)
        } else if (bodyPart) {
          therapistIds = Array.from(hasPart)
        } else {
          therapistIds = Array.from(hasPurpose)
        }
      }

      if (therapistIds.length === 0) { setTherapists([]); setLoading(false); return }

      const { data: tDataRaw } = await supabase
        // 검색 카드에 필요한 칸만 (면허번호·이메일·휴대폰은 가져오지 않음)
        .from('therapists')
        .select('id, name, hospital_name, studio_name, years_experience, practitioner_type, intro, kakao_link, latitude, longitude, profile_image_url, service_mode, visit_radius_km')
        .in('id', therapistIds).eq('verification_status', 'verified')
      if (!tDataRaw) { setTherapists([]); setLoading(false); return }

      // 제공 방식 필터
      let tData = tDataRaw
      if (mode === 'visit') {
        tData = tDataRaw.filter(t => {
          const sm = t.service_mode || 'center'
          if (sm !== 'visit' && sm !== 'both') return false
          // 방문은 치료사의 반경 안에 환자가 들어와야 성립
          if (!hasLocation || !t.latitude || !t.longitude) return false
          const d = getDistanceKm(userLat!, userLng!, t.latitude, t.longitude)
          return d <= (t.visit_radius_km ?? 0)
        })
      } else if (mode === 'center') {
        tData = tDataRaw.filter(t => {
          const sm = t.service_mode || 'center'
          return sm === 'center' || sm === 'both'
        })
      }

      if (tData.length === 0) { setTherapists([]); setLoading(false); return }

      // 대표 사진 3장 — 따로 읽어서, 칸이 아직 없어도 검색은 그대로 되게
      const photoMap: Record<string, unknown> = {}
      const { data: photoRows, error: photoError } = await supabase
        .from('therapists')
        .select('id, photo_urls')
        .in('id', tData.map(t => t.id))
      if (!photoError) (photoRows || []).forEach(r => { photoMap[r.id] = r.photo_urls })

      // 각 치료사의 태그 전체 로드 (표시용)
      const { data: allTtData } = await supabase
        .from('therapist_tags')
        .select('therapist_id, tag_id')
        .in('therapist_id', therapistIds)

      const therapistTagsMap: Record<string, string[]> = {}
      ;(allTtData || []).forEach(tt => {
        const label = idToLabel[tt.tag_id]
        if (!label) return
        if (!therapistTagsMap[tt.therapist_id]) therapistTagsMap[tt.therapist_id] = []
        therapistTagsMap[tt.therapist_id].push(label)
      })

      // 각 치료사의 리뷰 평점 로드
      const { data: reviewData } = await supabase
        .from('reviews')
        .select('therapist_id, rating')
        .in('therapist_id', therapistIds)

      const reviewMap: Record<string, { sum: number; count: number }> = {}
      ;(reviewData || []).forEach(rv => {
        if (!reviewMap[rv.therapist_id]) reviewMap[rv.therapist_id] = { sum: 0, count: 0 }
        reviewMap[rv.therapist_id].sum += rv.rating
        reviewMap[rv.therapist_id].count += 1
      })

      // 가용 시간표 로드
      const { data: avData } = await supabase
        .from('therapist_availability')
        .select('therapist_id, day_of_week, slot')
        .in('therapist_id', therapistIds)

      const availabilityMap: Record<string, string[]> = {}
      ;(avData || []).forEach(a => {
        if (!availabilityMap[a.therapist_id]) availabilityMap[a.therapist_id] = []
        availabilityMap[a.therapist_id].push(`${a.day_of_week}-${a.slot}`)
      })

      const enriched = tData.map(t => {
        const rv = reviewMap[t.id]
        return {
          ...t,
          distance: (hasLocation && t.latitude && t.longitude)
            ? getDistanceKm(userLat!, userLng!, t.latitude, t.longitude) : null,
          tags: therapistTagsMap[t.id] || [],
          rating: rv ? rv.sum / rv.count : null,
          reviewCount: rv ? rv.count : 0,
          purposeMatch: purposeMatchedIds.has(t.id),
          availability: availabilityMap[t.id] || [],
          photos: pickPhotos(photoMap[t.id], t.profile_image_url),
        }
      })

      const bothSearch = !!bodyPart && !!purpose
      enriched.sort((a, b) => {
        // 부위+목적 동시 검색이면, 목적까지 맞는 사람을 먼저
        if (bothSearch && a.purposeMatch !== b.purposeMatch) return a.purposeMatch ? -1 : 1
        if (hasLocation) {
          if (a.distance === null && b.distance === null) return b.years_experience - a.years_experience
          if (a.distance === null) return 1
          if (b.distance === null) return -1
          return a.distance - b.distance
        }
        return b.years_experience - a.years_experience
      })

      setTherapists(enriched)
      setLoading(false)
    }
    // 네트워크 오류가 나도 '찾고 있어요'에 멈추지 않게
    fetchTherapists().catch(() => {
      setTherapists([])
      setLoading(false)
    })
  }, [bodyPart, purpose, mode, userLat, userLng, hasLocation])

  useEffect(() => {
    let result = [...therapists]
    if (expFilter > 0) result = result.filter(t => t.years_experience >= expFilter)
    if (typeFilter !== 'all') result = result.filter(t => {
      const sm = t.service_mode || 'center'
      return sm === typeFilter || sm === 'both'
    })
    setFiltered(result)
  }, [therapists, expFilter, typeFilter])

  const isFilterActive = expFilter > 0 || typeFilter !== 'all'
  const resetFilters = () => { setExpFilter(0); setTypeFilter('all') }

  // 방문 검색인데 위치가 없으면 반경 계산이 불가능
  if (needsLocation) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white px-5 py-20 text-center">
        <div className="text-5xl mb-4">📍</div>
        <p className="text-base font-bold text-gray-700 mb-2">위치 정보가 필요해요</p>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">
          방문 가능한 전문가를 찾으려면<br />
          어디로 방문할지 알아야 해요.
        </p>
        <button onClick={() => router.push('/')} className="px-6 py-3 bg-[#0A8A7B] text-white rounded-xl font-semibold">
          위치 설정하러 가기
        </button>
      </main>
    )
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400">전문가를 찾고 있어요...</p>
      </div>
    )
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3 z-10">
        <button onClick={() => router.back()} className="text-gray-600 text-xl">←</button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">
            {isAllMode
              ? `내 주변 전문가 ${filtered.length}명`
              : isVisitMode
                ? `방문 가능 전문가 ${filtered.length}명`
                : `${bodyPart || purpose} 전문가 ${filtered.length}명`}
          </h1>
          {(isVisitMode || (bodyPart && purpose)) && (
            <p className="text-sm text-gray-400">
              {isVisitMode && '🏠 집으로 방문'}
              {isVisitMode && purpose && ' · '}
              {purpose}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{hasLocation ? '📍 거리순' : '⭐ 경력순'}</span>
          {viewMode === 'list' && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={'px-3 py-1.5 rounded-full text-xs font-bold transition-all ' +
                (isFilterActive ? 'bg-[#0A8A7B] text-white' : 'bg-gray-100 text-gray-600')}
            >
              필터 {isFilterActive ? '●' : ''}
            </button>
          )}
        </div>
      </div>

      {/* 탭 전환 */}
      <div className="flex border-b border-gray-100 bg-white sticky top-[73px] z-10 max-w-md mx-auto w-full">
        <button
          onClick={() => setViewMode('list')}
          className={'flex-1 py-3 text-sm font-bold transition-all ' +
            (viewMode === 'list' ? 'text-[#0A8A7B] border-b-2 border-[#0A8A7B]' : 'text-gray-400')}
        >
          📋 리스트 보기
        </button>
        <button
          onClick={() => setViewMode('map')}
          className={'flex-1 py-3 text-sm font-bold transition-all ' +
            (viewMode === 'map' ? 'text-[#0A8A7B] border-b-2 border-[#0A8A7B]' : 'text-gray-400')}
        >
          🗺️ 지도 보기
        </button>
      </div>

      {/* 필터 */}
      {viewMode === 'list' && showFilters && (
        <div className="bg-gray-50 px-5 py-4 border-b border-gray-100">
          <div className="mb-3">
            <p className="text-xs font-bold text-gray-500 mb-2">경력</p>
            <div className="flex gap-2 flex-wrap">
              {EXPERIENCE_FILTERS.map(f => (
                <button key={f.min} onClick={() => setExpFilter(f.min)}
                  className={'px-3 py-1.5 rounded-full text-xs font-semibold transition-all ' +
                    (expFilter === f.min ? 'bg-[#0A8A7B] text-white' : 'bg-white text-gray-600 border border-gray-200')}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <p className="text-xs font-bold text-gray-500 mb-2">활동 형태</p>
            <div className="flex gap-2 flex-wrap">
              {TYPE_FILTERS.map(f => (
                <button key={f.value} onClick={() => setTypeFilter(f.value)}
                  className={'px-3 py-1.5 rounded-full text-xs font-semibold transition-all ' +
                    (typeFilter === f.value ? 'bg-[#0A8A7B] text-white' : 'bg-white text-gray-600 border border-gray-200')}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {isFilterActive && (
            <button onClick={resetFilters} className="text-xs text-red-400 font-semibold">✕ 필터 초기화</button>
          )}
        </div>
      )}

      {/* 지도 뷰 */}
      {viewMode === 'map' && (
        <div className="relative" style={{ height: 'calc(100vh - 130px)', minHeight: '500px' }}>
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-gray-50">
              <p className="text-gray-400 text-sm">표시할 전문가가 없어요</p>
            </div>
          ) : (
            <>
              <KakaoMap
                therapists={filtered}
                userLat={userLat}
                userLng={userLng}
                onSelectTherapist={setMapSelectedTherapist}
              />
              {mapSelectedTherapist && (
                <MapBottomSheet
                  therapist={mapSelectedTherapist}
                  onClose={() => setMapSelectedTherapist(null)}
                  onConsult={() => {
                    setSelectedTherapist(mapSelectedTherapist)
                    setMapSelectedTherapist(null)
                  }}
                  onProfile={() => router.push('/therapist/' + mapSelectedTherapist.id)}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* 리스트 뷰 */}
      {viewMode === 'list' && (
        <>
          {filtered.length === 0 ? (
            <div className="px-5 py-20 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-base font-bold text-gray-700 mb-2">
                {isFilterActive
                  ? '필터 조건에 맞는 전문가가 없습니다'
                  : isVisitMode
                    ? '방문 가능한 전문가가 아직 없어요'
                    : '아직 맞는 전문가가 없어요'}
              </p>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                {isFilterActive
                  ? '필터를 조정해보세요'
                  : isVisitMode
                    ? '이 지역에 방문 가능한 전문가가 아직 등록되지 않았어요. 요청서를 남기시면 운영팀이 연결을 도와드려요.'
                    : '아직 이 분야 전문가가 많지 않아요. 요청서를 남기시면 운영팀이 연결을 도와드려요.'}
              </p>
              {isFilterActive ? (
                <button onClick={resetFilters} className="px-6 py-3 bg-[#0A8A7B] text-white rounded-xl font-semibold">필터 초기화</button>
              ) : (
                <div className="flex flex-col gap-2.5 max-w-xs mx-auto">
                  {/* 아직 전문가가 적은 시기: 요청서를 남기면 운영팀이 연결을 도움 */}
                  <button
                    onClick={() => router.push(purpose ? `/request?purpose=${encodeURIComponent(purpose)}` : '/request')}
                    className="min-h-[52px] px-6 bg-[#0A8A7B] text-white rounded-xl font-bold text-[16px]"
                  >
                    방문 요청서 남기기
                  </button>
                  <button onClick={() => router.push('/find')} className="min-h-[52px] px-6 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold text-[16px]">
                    상황 다시 고르기
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">
              {filtered.map((t) => (
                <ResultCard
                  key={t.id}
                  t={t}
                  onProfile={() => router.push('/therapist/' + t.id)}
                  onConsult={() => setSelectedTherapist(t)}
                  isVisitMode={isVisitMode}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ConsultFormModal
        isOpen={selectedTherapist !== null}
        onClose={() => setSelectedTherapist(null)}
        therapistName={selectedTherapist?.name || ''}
        kakaoLink={selectedTherapist?.kakao_link || ''}
        purpose={purpose}
      />
    </main>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}
