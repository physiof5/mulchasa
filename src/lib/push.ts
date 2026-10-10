'use client'

// 알림(웹 푸시) — 이 기기에서 켜기·끄기, 상태 확인, 알림 보내 달라고 서버에 알리기
// · 안드로이드·PC 크롬/엣지/삼성 인터넷: 바로 켤 수 있음
// · 아이폰·아이패드(iOS 16.4+): 사파리 '공유 → 홈 화면에 추가'로 설치한 앱에서만 켤 수 있음
// · 비밀 키는 서버에만(VAPID_PRIVATE_KEY). 화면에는 공개 키(NEXT_PUBLIC_VAPID_PUBLIC_KEY)만 쓴다.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type PushState =
  | 'checking'
  | 'unsupported' // 이 브라우저는 알림을 못 받음
  | 'ios-install' // 아이폰: 홈 화면에 추가해야 함
  | 'no-key' // 운영 설정(공개 키) 없음
  | 'denied' // 알림을 차단해 둠
  | 'off'
  | 'on'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const SW_URL = '/sw.js'

function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL)
  return reg ? reg.pushManager.getSubscription() : null
}

export async function readPushState(): Promise<Exclude<PushState, 'checking'>> {
  if (typeof window === 'undefined') return 'unsupported'
  if (isIOS() && !isStandalone()) return 'ios-install'
  if (!supported()) return 'unsupported'
  if (!PUBLIC_KEY) return 'no-key'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const sub = await currentSubscription()
    return sub && Notification.permission === 'granted' ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_ua: navigator.userAgent.slice(0, 200),
  })
  if (error) console.error('save_push_subscription error:', error)
  return !error
}

/** 알림 켜기 (버튼을 눌렀을 때만 — 브라우저 허용 창이 뜸) */
export async function enablePush(): Promise<{ state: Exclude<PushState, 'checking'>; error?: string }> {
  const pre = await readPushState()
  if (pre === 'unsupported' || pre === 'ios-install' || pre === 'no-key') return { state: pre }
  const { data } = await supabase.auth.getSession()
  if (!data.session) return { state: 'off', error: '로그인한 뒤 알림을 켤 수 있어요.' }
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { state: permission === 'denied' ? 'denied' : 'off' }
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' })
    await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) }))
    const ok = await saveSubscription(sub)
    if (!ok) return { state: 'off', error: '알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' }
    return { state: 'on' }
  } catch (e) {
    console.error('enablePush error:', e)
    return { state: 'off', error: '알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.' }
  }
}

/** 이 기기 알림 끄기 (로그아웃할 때도 부름) */
export async function disablePush(): Promise<void> {
  try {
    if (!supported()) return
    const sub = await currentSubscription()
    if (!sub) return
    await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
    await sub.unsubscribe()
  } catch (e) {
    console.error('disablePush error:', e)
  }
}

/** 로그인한 채로 앱을 열면, 이미 켠 기기의 알림 정보를 내 계정에 다시 묶어 둔다(다른 계정이 쓰던 기기 대비) */
export async function refreshPushOwner(): Promise<void> {
  try {
    if (!supported() || Notification.permission !== 'granted') return
    const sub = await currentSubscription()
    if (sub) await saveSubscription(sub)
  } catch {
    // 조용히 넘어감
  }
}

export type PushEvent = { type: 'message'; message_id: number } | { type: 'accept'; room_id: string } | { type: 'consult'; consult_id: string }

/** 상대에게 알림을 보내 달라고 서버에 알림 (실패해도 화면 흐름은 그대로) */
export function notifyPush(event: PushEvent): void {
  supabase.auth.getSession().then(({ data }) => {
    const token = data.session?.access_token
    if (!token) return
    fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {})
  })
}

/** 화면에서 쓰는 알림 상태 */
export function usePushState(): { state: PushState; busy: boolean; error: string; turnOn: () => Promise<void>; turnOff: () => Promise<void> } {
  const [state, setState] = useState<PushState>('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    readPushState().then((s) => alive && setState(s))
    return () => {
      alive = false
    }
  }, [])

  const turnOn = useCallback(async () => {
    setBusy(true)
    setError('')
    const r = await enablePush()
    setState(r.state)
    setError(r.error ?? '')
    setBusy(false)
  }, [])

  const turnOff = useCallback(async () => {
    setBusy(true)
    await disablePush()
    setState(await readPushState())
    setBusy(false)
  }, [])

  return { state, busy, error, turnOn, turnOff }
}
