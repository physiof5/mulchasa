// 이 기기(브라우저)에 저장된 값을 화면에서 읽는 훅
// 서버 화면에서는 값이 없으므로(null), 화면이 어긋나지 않게 useSyncExternalStore로 읽는다.
// setDeviceItem으로 저장하면 같은 화면의 훅도 바로 새 값으로 다시 그려진다.
import { useMemo, useSyncExternalStore } from 'react'

const EVENT = 'device-storage'

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function setDeviceItem(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // 저장이 막혀 있어도 화면은 그대로
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useLocalStorageItem(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    () => null
  )
}

/** 화면이 브라우저에서 그려지는 중인지 (서버 화면 = false) */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

/** 홈에서 '현재 위치로 설정'한 좌표 (기기에만 저장된 값) */
export function useSavedCoords(): { lat: string; lng: string } | null {
  const lat = useLocalStorageItem('mulchasa_lat')
  const lng = useLocalStorageItem('mulchasa_lng')
  return useMemo(() => (lat && lng ? { lat, lng } : null), [lat, lng])
}

/** 위치 저장 (기기에만) */
export function saveDeviceCoords(lat: number, lng: number) {
  setDeviceItem('mulchasa_location_set', '1')
  setDeviceItem('mulchasa_lat', String(lat))
  setDeviceItem('mulchasa_lng', String(lng))
}

/** 두 좌표 사이 거리(km) */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  if (km < 10) return `${km.toFixed(1)}km`
  return `${Math.round(km)}km`
}
