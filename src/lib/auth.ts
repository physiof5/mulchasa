'use client'

// 회원 로그인 — 모두 카카오로 '일반 회원'으로 가입하고, 물리치료사는 나중에 '전문가로 가입하기'로 전환한다.
// 카카오에서 받는 정보: 닉네임, 프로필 사진, (비즈 앱이면) 이메일, 카카오 회원번호.
// ※ 카카오톡 '아이디'와 전화번호는 카카오가 넘겨주지 않는다.

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/** 가입 동의 기록 (카카오 로그인 직후 한 번 받음) — Supabase 사용자 정보(user_metadata)에 남긴다 */
export const TERMS_KEY = 'agreed_terms_at'

/** 로그인 뒤 돌아갈 주소는 우리 사이트 안쪽 경로만 허용 */
export function safeNext(next: string | null | undefined, fallback = '/mypage'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}

export async function signInWithKakao(next?: string) {
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`
  return supabase.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo } })
}

export function displayName(user: User | null | undefined): string {
  const m = user?.user_metadata ?? {}
  return (m.name || m.full_name || m.user_name || m.preferred_username || m.nickname || user?.email?.split('@')[0] || '회원') as string
}

export function avatarOf(user: User | null | undefined): string | null {
  const m = user?.user_metadata ?? {}
  const url = (m.avatar_url || m.picture || m.profile_image) as string | undefined
  return url && /^https?:\/\//.test(url) ? url.replace(/^http:\/\//, 'https://') : null
}

export function loginMethod(user: User | null | undefined): string {
  const p = user?.app_metadata?.provider
  return p === 'kakao' ? '카카오 로그인' : p === 'email' ? '이메일 로그인' : '로그인'
}

export function hasAgreedTerms(user: User | null | undefined): boolean {
  // 예전 이메일 가입 전문가는 가입 때 이미 동의를 받았으므로 통과
  if (user?.app_metadata?.provider === 'email') return true
  return typeof user?.user_metadata?.[TERMS_KEY] === 'string'
}

/** 지금 로그인한 사용자 (undefined = 확인 중, null = 로그인 안 함) */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setUser(data.session?.user ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setUser(session?.user ?? null)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])
  return user
}

/** 이 계정에 연결된 전문가 프로필 id (없으면 null) */
export async function findMyTherapistId(userId: string): Promise<string | null> {
  const { data } = await supabase.from('therapists').select('id').eq('user_id', userId).maybeSingle()
  if (data?.id) return data.id
  // 승인 전이라 공개 조회에 안 잡히는 경우를 대비해 본인 전용 함수로 한 번 더 확인
  const { data: priv } = await supabase.rpc('get_my_therapist_private')
  const mine = Array.isArray(priv) ? priv[0] : priv
  return (mine && typeof mine.id === 'string' ? mine.id : null) ?? null
}
