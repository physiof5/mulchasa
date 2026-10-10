'use client'

// 센터 찾기 — 지도에는 '운동센터 위치'만 표시 (방문 전문가의 집·기준 주소는 절대 표시하지 않음)
// 센터 위치 = 전문가가 따로 입력한 센터 주소(center_lat/lng). 예전 '센터만' 가입자는 기준 좌표가 곧 센터 주소.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { hasCenterWork, hasVisitWork } from '@/lib/practitioner'
import { distanceKm, formatKm, useSavedCoords } from '@/lib/useDeviceStorage'

const GREEN = '#0A8A7B'
const GREEN_DARK = '#0F6E56'

interface Center {
  key: string
  name: string
  address: string | null
  lat: number
  lng: number
  experts: { id: string; name: string; years: number }[]
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any
  }
}

export default function CentersPage() {
  const coords = useSavedCoords()
  const [centers, setCenters] = useState<Center[] | null>(null)
  const [selected, setSelected] = useState<Center | null>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    loadCenters()
      .then((c) => alive && setCenters(c))
      .catch(() => alive && setCenters([]))
    return () => {
      alive = false
    }
  }, [])

  const me = useMemo(() => (coords ? { lat: Number(coords.lat), lng: Number(coords.lng) } : null), [coords])
  const sorted = useMemo(() => {
    if (!centers) return null
    return centers
      .map((c) => ({ ...c, distance: me ? distanceKm(me.lat, me.lng, c.lat, c.lng) : null }))
      .sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999))
  }, [centers, me])

  // 지도 그리기
  useEffect(() => {
    if (!sdkReady || !mapRef.current || !centers || !window.kakao?.maps) return
    window.kakao.maps.load(() => {
      const center = me ?? (centers[0] ? { lat: centers[0].lat, lng: centers[0].lng } : { lat: 37.5665, lng: 126.978 })
      const map = new window.kakao.maps.Map(mapRef.current, { center: new window.kakao.maps.LatLng(center.lat, center.lng), level: 6 })
      const bounds = new window.kakao.maps.LatLngBounds()
      let n = 0
      if (me) {
        const dot = document.createElement('div')
        dot.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);transform:translate(-50%,-50%)'
        new window.kakao.maps.CustomOverlay({ map, position: new window.kakao.maps.LatLng(me.lat, me.lng), content: dot })
        bounds.extend(new window.kakao.maps.LatLng(me.lat, me.lng))
        n++
      }
      centers.forEach((c) => {
        const el = document.createElement('button')
        el.type = 'button'
        el.style.cssText = 'transform:translate(-50%,-100%);cursor:pointer;background:none;border:0;padding:0'
        const label = c.name.length > 9 ? c.name.slice(0, 9) + '…' : c.name
        el.innerHTML = `<div style="background:${GREEN};color:#fff;border-radius:16px;padding:6px 11px;font:700 13px sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25);position:relative">🏢 ${escapeHtml(label)}<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${GREEN}"></div></div>`
        el.addEventListener('click', () => setSelected(c))
        new window.kakao.maps.CustomOverlay({ map, position: new window.kakao.maps.LatLng(c.lat, c.lng), content: el, yAnchor: 1 })
        bounds.extend(new window.kakao.maps.LatLng(c.lat, c.lng))
        n++
      })
      if (n >= 2) map.setBounds(bounds, 50, 50, 50, 50)
    })
  }, [sdkReady, centers, me])

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`}
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
      />
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold text-gray-900">센터 찾기</h1>
        <Link href="/experts" className="min-h-[40px] px-3 rounded-full border border-gray-200 text-[14px] font-semibold text-gray-600 flex items-center">
          전문가 목록
        </Link>
      </div>

      <div className="relative">
        <div ref={mapRef} className="w-full h-[340px] bg-gray-100" aria-label="운동센터 지도" />
        {selected && (
          <div className="absolute left-3 right-3 bottom-3 rounded-2xl bg-white shadow-xl p-4">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[18px] font-extrabold text-gray-900">{selected.name}</p>
                {selected.address && <p className="text-[14px] text-gray-500 mt-0.5">{selected.address}</p>}
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="닫기" className="w-10 h-10 -mr-2 -mt-2 text-gray-400 text-2xl">
                ×
              </button>
            </div>
            <ExpertLinks c={selected} />
          </div>
        )}
      </div>

      <section className="px-5 pt-5 pb-6">
        <p className="text-[14px] text-gray-500 mb-3">지도에는 운동센터 위치만 보여요. 방문 전문가의 주소는 공개하지 않아요.</p>
        {sorted === null ? (
          <div className="h-24 rounded-2xl bg-white animate-pulse" />
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center">
            <p className="text-[17px] font-bold text-gray-900">아직 등록된 운동센터가 없어요</p>
            <Link href="/experts" className="mt-3 inline-flex min-h-[48px] px-5 rounded-xl text-white font-bold items-center" style={{ background: GREEN }}>
              방문 전문가 보기
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {sorted.map((c) => (
              <li key={c.key} className="rounded-2xl bg-white border border-gray-100 p-4">
                <button type="button" onClick={() => setSelected(c)} className="w-full text-left">
                  <p className="text-[17px] font-bold text-gray-900">
                    {c.name}
                    {c.distance !== null && <span className="ml-2 text-[14px] font-semibold" style={{ color: GREEN_DARK }}>약 {formatKm(c.distance)}</span>}
                  </p>
                  {c.address && <p className="text-[14px] text-gray-500 mt-0.5">{c.address}</p>}
                </button>
                <ExpertLinks c={c} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <BottomNav />
    </main>
  )
}

function ExpertLinks({ c }: { c: Center }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {c.experts.map((e) => (
        <Link
          key={e.id}
          href={`/therapist/${e.id}`}
          className="min-h-[40px] px-3 rounded-full border text-[14px] font-semibold flex items-center"
          style={{ borderColor: '#CFE7E2', color: GREEN_DARK, background: '#F6FBFA' }}
        >
          {e.name} 전문가 · {e.years}년 ›
        </Link>
      ))}
    </div>
  )
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string)
}

async function loadCenters(): Promise<Center[]> {
  const { data: rows } = await supabase
    .from('therapists')
    .select('id, name, years_experience, studio_name, work_types, latitude, longitude')
    .eq('verification_status', 'verified')
  if (!rows) return []
  const withCenter = rows.filter((r) => hasCenterWork(r.work_types ?? []) && r.studio_name)
  if (withCenter.length === 0) return []

  // 센터 주소 칸은 따로 읽음 (칸이 아직 없어도 화면은 열리게)
  const centerPos: Record<string, { address: string | null; lat: number | null; lng: number | null }> = {}
  const { data: cRows, error } = await supabase
    .from('therapists')
    .select('id, center_address, center_lat, center_lng')
    .in('id', withCenter.map((r) => r.id))
  if (!error) (cRows || []).forEach((r) => (centerPos[r.id] = { address: r.center_address, lat: r.center_lat, lng: r.center_lng }))

  const map = new Map<string, Center>()
  withCenter.forEach((r) => {
    const pos = centerPos[r.id]
    let lat = pos?.lat ?? null
    let lng = pos?.lng ?? null
    // 센터 주소를 따로 안 넣은 경우: 방문을 하지 않는 '센터만' 전문가라면 기준 좌표가 곧 센터 주소
    if ((lat === null || lng === null) && !hasVisitWork(r.work_types ?? [])) {
      lat = r.latitude
      lng = r.longitude
    }
    if (lat === null || lng === null) return
    const name = (r.studio_name as string).trim()
    const key = `${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`
    const c = map.get(key) ?? { key, name, address: pos?.address ?? null, lat, lng, experts: [] }
    c.experts.push({ id: r.id, name: r.name, years: r.years_experience })
    map.set(key, c)
  })
  return Array.from(map.values())
}
