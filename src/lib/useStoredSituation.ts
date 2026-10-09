// 맞춤 찾기(/find)에서 고른 상황을 읽는 훅
// 서버 화면에는 값이 없고(null) 브라우저에서만 읽히므로, 화면이 어긋나지 않게 useSyncExternalStore로 읽는다.
import { useMemo, useSyncExternalStore } from 'react'
import { parseSituation, readSituationRaw, type StoredSituation } from './care'

const subscribe = () => () => {}

export function useStoredSituation(): StoredSituation | null {
  const raw = useSyncExternalStore(subscribe, readSituationRaw, () => null)
  return useMemo(() => parseSituation(raw), [raw])
}
