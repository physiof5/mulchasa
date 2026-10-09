// 이 기기(브라우저)에 저장된 값을 화면에서 읽는 훅
// 서버 화면에서는 값이 없으므로(null), 화면이 어긋나지 않게 useSyncExternalStore로 읽는다.
import { useMemo, useSyncExternalStore } from 'react'

const subscribe = () => () => {}

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

/** 홈에서 '현재 위치로 설정'한 좌표 (기기에만 저장된 값) */
export function useSavedCoords(): { lat: string; lng: string } | null {
  const lat = useLocalStorageItem('mulchasa_lat')
  const lng = useLocalStorageItem('mulchasa_lng')
  return useMemo(() => (lat && lng ? { lat, lng } : null), [lat, lng])
}
