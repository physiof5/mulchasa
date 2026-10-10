'use client'

// 전문가 찾기 — 회원이 고른 거리(km) 안의 전문가 프로필을 가까운 순으로
// 위치는 기기에만 저장하고, 거리 계산도 기기에서 한다 (서버로 보내지 않음)

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import PhotoTriplet from '@/components/PhotoTriplet'
import { pickPhotos } from '@/lib/squareImage'
import { PURPOSE_OPTIONS, practitionerLabel, summarizeAvailability } from '@/lib/practitioner'
import { distanceKm, formatKm, saveDeviceCoords, setDeviceItem, useLocalStorageItem, useSavedCoords } from '@/lib/useDeviceStorage'

const GREEN = '#0A8A7B'
const GREEN_DARK = '#0F6E56'
const GREEN_LIGHT = '#E8F6F4'
const RADIUS_OPTIONS = [3, 5, 10, 20, 30]

interface Expert {
  id: string
  name: string
  years_experience: number
  practitioner_type: string
  studio_name: string | null
  hospital_name: string | null
  latitude: number | null
  longitude: number | null
  profile_image_url: string | null
  service_mode: string | null
  visit_radius_km: number | null
  photos: string[]
  tags: string[]
  rating: number | null
  reviewCount: number
  availability: string[]
}

export default function ExpertsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = use(searchParams)
  const initialPurpose = typeof params.purpose === 'string' && PURPOSE_OPTIONS.includes(params.purpose) ? params.purpose : null
  const [purpose, setPurpose] = useState<string | null>(initialPurpose)
  const coords = useSavedCoords()
  const radiusRaw = useLocalStorageItem('expert_radius')
  const radius = radiusRaw === 'all' ? null : RADIUS_OPTIONS.includes(Number(radiusRaw)) ? Number(radiusRaw) : 10
  const [experts, setExperts] = useState<Expert[] | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoError, setGeoError] = useState('')

  useEffect(() => {
    let alive = true
    loadExperts()
      .then((list) => alive && setExperts(list))
      .catch(() => alive && setExperts([]))
    return () => {
      alive = false
    }
  }, [])

  const list = useMemo(() => {
    if (!experts) return null
    const me = coords ? { lat: Number(coords.lat), lng: Number(coords.lng) } : null
    return experts
      .filter((e) => !purpose || e.tags.includes(purpose))
      .map((e) => ({ ...e, distance: me && e.latitude && e.longitude ? distanceKm(me.lat, me.lng, e.latitude, e.longitude) : null }))
      .filter((e) => !me || radius === null || (e.distance !== null && e.distance <= radius))
      .sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999))
  }, [experts, coords, radius, purpose])

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('이 기기에서는 위치 기능을 쓸 수 없어요.')
      return
    }
    setGeoBusy(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        saveDeviceCoords(p.coords.latitude, p.coords.longitude)
        setGeoBusy(false)
      },
      () => {
        setGeoBusy(false)
        setGeoError('위치 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.')
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <h1 className="text-[22px] font-extrabold text-gray-900">전문가 찾기</h1>
          <Link href="/centers" className="min-h-[40px] px-3 rounded-full border border-gray-200 text-[14px] font-semibold text-gray-600 flex items-center gap-1">
            센터 지도
          </Link>
        </div>

        {/* 거리 */}
        <div className="px-5 pb-2 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }} role="group" aria-label="거리">
          {RADIUS_OPTIONS.map((km) => (
            <Chip key={km} label={`${km}km`} active={radius === km} onClick={() => setDeviceItem('expert_radius', String(km))} />
          ))}
          <Chip label="전체" active={radius === null} onClick={() => setDeviceItem('expert_radius', 'all')} />
        </div>

        {/* 분야 */}
        <div className="px-5 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }} role="group" aria-label="운동 지도 분야">
          <Chip label="모든 분야" active={!purpose} onClick={() => setPurpose(null)} soft />
          {PURPOSE_OPTIONS.map((p) => (
            <Chip key={p} label={p} active={purpose === p} onClick={() => setPurpose(p)} soft />
          ))}
        </div>
      </div>

      {!coords && (
        <div className="mx-5 mt-4 rounded-2xl p-4 border" style={{ background: GREEN_LIGHT, borderColor: '#BFE3DC' }}>
          <p className="text-[15px] font-bold" style={{ color: GREEN_DARK }}>
            위치를 정하면 가까운 순으로 보여 드려요
          </p>
          <p className="text-[14px] text-gray-600 mt-0.5">위치는 이 기기에만 저장돼요.</p>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={geoBusy}
            className="mt-3 min-h-[44px] px-4 rounded-xl text-white text-[15px] font-bold disabled:opacity-60"
            style={{ background: GREEN }}
          >
            {geoBusy ? '위치 확인 중...' : '현재 위치로 설정'}
          </button>
          {geoError && <p className="text-[13px] text-red-500 mt-2">{geoError}</p>}
        </div>
      )}

      <div className="px-5 pt-4 pb-6">
        {list === null ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-[300px] rounded-2xl bg-white animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center">
            <p className="text-[17px] font-bold text-gray-900">
              {coords && radius !== null ? `${radius}km 안에 맞는 전문가가 아직 없어요` : '조건에 맞는 전문가가 아직 없어요'}
            </p>
            <p className="text-[15px] text-gray-500 mt-1">거리를 넓히거나, 상담 요청을 남겨 주세요.</p>
            <Link href="/find" className="mt-4 inline-flex min-h-[48px] px-5 rounded-xl text-white font-bold items-center" style={{ background: GREEN }}>
              무료 상담 요청하기
            </Link>
          </div>
        ) : (
          <>
            <p className="text-[14px] text-gray-500 mb-3">
              {coords && radius !== null ? `${radius}km 안` : '전체'} · <b className="text-gray-800">{list.length}명</b>
              {coords ? ' · 가까운 순' : ''}
            </p>
            <div className="space-y-4">
              {list.map((e) => (
                <ExpertCard key={e.id} e={e} distance={e.distance} highlight={purpose} />
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  )
}

function Chip({ label, active, onClick, soft }: { label: string; active: boolean; onClick: () => void; soft?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="shrink-0 min-h-[40px] px-3.5 rounded-full border text-[14px] font-semibold whitespace-nowrap"
      style={
        active
          ? soft
            ? { background: GREEN_LIGHT, borderColor: GREEN, color: GREEN_DARK }
            : { background: GREEN, borderColor: GREEN, color: '#fff' }
          : { background: '#fff', borderColor: '#E5E7EB', color: '#4B5563' }
      }
    >
      {label}
    </button>
  )
}

function ExpertCard({ e, distance, highlight }: { e: Expert; distance: number | null; highlight: string | null }) {
  const canVisit = e.service_mode === 'visit' || e.service_mode === 'both'
  const avail = summarizeAvailability(e.availability)
  const tags = highlight ? [highlight, ...e.tags.filter((t) => t !== highlight)] : e.tags
  return (
    <Link href={`/therapist/${e.id}`} className="block bg-white rounded-2xl border border-gray-100 overflow-hidden active:scale-[0.99] transition-all">
      <PhotoTriplet
        urls={e.photos}
        name={e.name}
        overlay={
          <>
            <span className="absolute top-2.5 left-2.5 bg-white/95 text-[12px] font-bold px-2 py-1 rounded-md" style={{ color: GREEN_DARK }}>
              ✓ 면허 확인
            </span>
            {canVisit && (
              <span className="absolute top-2.5 right-2.5 text-[12px] font-bold px-2 py-1 rounded-md text-white" style={{ background: '#B45309' }}>
                방문 가능
              </span>
            )}
            {distance !== null && (
              <span className="absolute bottom-2.5 right-2.5 bg-black/55 text-white text-[12px] font-semibold px-2 py-1 rounded-md">약 {formatKm(distance)}</span>
            )}
          </>
        }
      />
      <div className="p-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[19px] font-extrabold text-gray-900">{e.name}</span>
          {e.rating !== null && (
            <span className="text-[14px] font-semibold" style={{ color: '#BA7517' }}>
              ★ {e.rating.toFixed(1)} <span className="text-gray-400 font-normal">({e.reviewCount})</span>
            </span>
          )}
        </div>
        <p className="text-[14px] text-gray-500 mt-0.5">
          경력 {e.years_experience}년 · {practitionerLabel(e.practitioner_type)}
          {(e.studio_name || e.hospital_name) && ` · ${e.studio_name || e.hospital_name}`}
        </p>
        {avail && <p className="text-[13px] text-gray-500 mt-1">🕐 {avail}</p>}
        {tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2.5">
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[13px] px-2.5 py-1 rounded-md" style={{ background: '#E1F5EE', color: GREEN_DARK }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

async function loadExperts(): Promise<Expert[]> {
  const { data: rows } = await supabase
    .from('therapists')
    // 공개 칸만 (휴대폰·면허번호·이메일은 가져오지 않음)
    .select('id, name, years_experience, practitioner_type, studio_name, hospital_name, latitude, longitude, profile_image_url, service_mode, visit_radius_km')
    .eq('verification_status', 'verified')
  if (!rows || rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const [photoRes, ttRes, rvRes, avRes] = await Promise.all([
    supabase.from('therapists').select('id, photo_urls').in('id', ids),
    supabase.from('therapist_tags').select('therapist_id, tag_id').in('therapist_id', ids),
    supabase.from('reviews').select('therapist_id, rating').in('therapist_id', ids),
    supabase.from('therapist_availability').select('therapist_id, day_of_week, slot').in('therapist_id', ids),
  ])

  const photoMap: Record<string, unknown> = {}
  if (!photoRes.error) (photoRes.data || []).forEach((r) => (photoMap[r.id] = r.photo_urls))

  const tagIds = Array.from(new Set((ttRes.data || []).map((t) => t.tag_id)))
  const labelOf: Record<string, string> = {}
  if (tagIds.length > 0) {
    const { data: tags } = await supabase.from('tags').select('id, label').in('id', tagIds)
    ;(tags || []).forEach((t) => (labelOf[t.id] = t.label))
  }
  const tagMap: Record<string, string[]> = {}
  ;(ttRes.data || []).forEach((t) => {
    const l = labelOf[t.tag_id]
    if (l) (tagMap[t.therapist_id] ||= []).push(l)
  })

  const rv: Record<string, { sum: number; n: number }> = {}
  ;(rvRes.data || []).forEach((r) => {
    const x = (rv[r.therapist_id] ||= { sum: 0, n: 0 })
    x.sum += r.rating
    x.n += 1
  })

  const av: Record<string, string[]> = {}
  ;(avRes.data || []).forEach((a) => (av[a.therapist_id] ||= []).push(`${a.day_of_week}-${a.slot}`))

  return rows.map((r) => ({
    ...r,
    photos: pickPhotos(photoMap[r.id], r.profile_image_url),
    tags: tagMap[r.id] || [],
    rating: rv[r.id] ? rv[r.id].sum / rv[r.id].n : null,
    reviewCount: rv[r.id]?.n ?? 0,
    availability: av[r.id] || [],
  }))
}
