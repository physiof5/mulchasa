'use client'

// 회원 모드 / 전문가 모드
// · 회원 모드: 전문가 찾기·상담 요청·받은 견적·둘러보기(자가진단·서식자료·제도 소식)
// · 전문가 모드: 업무만 — 받은 요청·채팅·스케줄·크루·프로필·구독
// 전문가 프로필이 있는 계정만 전문가 모드를 쓸 수 있고, 모드는 이 기기에 기억한다(기본은 전문가 모드).

import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchMyExpert, type MyExpert } from '@/lib/consult'
import { setDeviceItem, useLocalStorageItem } from '@/lib/useDeviceStorage'

export type AppMode = 'member' | 'expert'
export const MODE_KEY = 'app_mode'

/** 전문가 모드에서는 열지 않는 회원 전용 화면 */
export const MEMBER_ONLY_PATHS = ['/browse', '/magazine', '/check', '/settings', '/find', '/symptom', '/consult/new', '/experts', '/centers', '/search', '/request']
/** 전문가 모드에서만 쓰는 화면 */
export const EXPERT_ONLY_PATHS = ['/schedule', '/crew', '/subscription', '/reviews/write']

export function matchPath(pathname: string, list: string[]): boolean {
  return list.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

// ── 내 전문가 정보 (여러 화면이 함께 씀, 30초 동안 기억) ──
interface ExpertState {
  ready: boolean
  userId: string | null
  expert: MyExpert | null
}
const SERVER_STATE: ExpertState = { ready: false, userId: null, expert: null }
let state: ExpertState = SERVER_STATE
let fetchedAt = 0
let inflight: Promise<void> | null = null
const subscribers = new Set<() => void>()
let authHooked = false

function emit() {
  subscribers.forEach((f) => f())
}

/** 전문가 정보 다시 읽기 (전문가 가입·승인 직후, 로그인·로그아웃 때) */
export function refreshMyExpert(force = false): Promise<void> {
  if (inflight) return inflight
  if (!force && state.ready && Date.now() - fetchedAt < 30_000) return Promise.resolve()
  inflight = (async () => {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user.id ?? null
    const expert = userId ? await fetchMyExpert() : null
    state = { ready: true, userId, expert }
    fetchedAt = Date.now()
    emit()
  })()
    .catch(() => {
      state = { ...state, ready: true }
      emit()
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

function subscribe(cb: () => void) {
  subscribers.add(cb)
  if (!authHooked) {
    authHooked = true
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') refreshMyExpert(true)
    })
  }
  return () => {
    subscribers.delete(cb)
  }
}

export function useMyExpert(): ExpertState {
  const snap = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE
  )
  useEffect(() => {
    refreshMyExpert()
  }, [])
  return snap
}

/** 모드 바꾸기 (이 기기에 기억) — null이면 지움(로그아웃) */
export function setAppMode(mode: AppMode | null) {
  setDeviceItem(MODE_KEY, mode)
}

export function storedMode(): AppMode | null {
  try {
    const v = localStorage.getItem(MODE_KEY)
    return v === 'expert' || v === 'member' ? v : null
  } catch {
    return null
  }
}

export function useAppMode(): {
  mode: AppMode
  ready: boolean
  /** 전문가 프로필이 있는 계정인지 (승인 대기 포함) */
  canExpert: boolean
  expert: MyExpert | null
  userId: string | null
} {
  const stored = useLocalStorageItem(MODE_KEY)
  const { ready, expert, userId } = useMyExpert()
  const canExpert = !!expert
  // 확인 전에는 기기에 기억한 모드로 먼저 그려 깜빡임을 줄인다
  const mode: AppMode = ready ? (canExpert && stored !== 'member' ? 'expert' : 'member') : stored === 'expert' ? 'expert' : 'member'
  return { mode, ready, canExpert, expert, userId }
}
