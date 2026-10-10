'use client'

// 로그인·회원가입 — 카카오 하나로 '일반 회원' 가입 겸 로그인
// 예전에 이메일로 가입한 전문가는 아래 '이메일로 로그인'을 그대로 쓸 수 있다.

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import { safeNext, useAuthUser } from '@/lib/auth'

const GREEN = '#0A8A7B'
const GREEN_DARK = '#0F6E56'

export default function LoginPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = use(searchParams)
  const next = safeNext(typeof params.next === 'string' ? params.next : null)
  const reason = typeof params.reason === 'string' ? params.reason : null
  const router = useRouter()
  const user = useAuthUser()

  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 이미 로그인했다면 바로 가려던 곳으로
  useEffect(() => {
    if (user) router.replace(next)
  }, [user, next, router])

  const emailLogin = async () => {
    if (!email.trim() || !password) return
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      const msg = (error.message || '').toLowerCase()
      setError(
        msg.includes('email not confirmed')
          ? '이메일 확인이 아직 안 됐어요. 받은 메일의 링크를 눌러 주세요.'
          : msg.includes('invalid login')
            ? '이메일 또는 비밀번호가 맞지 않아요.'
            : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'
      )
      setBusy(false)
      return
    }
    router.replace(next)
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white flex flex-col">
      <div className="px-4 py-2 flex items-center">
        <button onClick={() => router.back()} aria-label="뒤로" className="w-12 h-12 -ml-2 flex items-center justify-center text-gray-500">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 px-6 pt-6">
        <p className="text-[16px] font-bold" style={{ color: GREEN_DARK }}>
          보호가 필요해
        </p>
        <h1 className="text-[28px] font-extrabold text-gray-900 leading-snug mt-2">
          부모님 돌봄,
          <br />
          혼자 고민하지 마세요
        </h1>
        <p className="text-[17px] text-gray-600 mt-3 leading-relaxed">
          {reason === 'expert'
            ? '전문가 가입은 로그인한 뒤에 할 수 있어요. 카카오로 먼저 시작해 주세요.'
            : '카카오로 3초 만에 시작해요. 자가진단 결과를 이어 보고, 전문가에게 연락할 수 있어요.'}
        </p>

        <div className="mt-10">
          <KakaoLoginButton next={next} />
          <p className="text-[13px] text-gray-400 mt-3 text-center leading-relaxed">
            카카오에서 닉네임·프로필 사진만 받아요. 전화번호는 받지 않아요.
          </p>
        </div>

        <div className="mt-10 border-t border-gray-100 pt-5">
          <button
            type="button"
            onClick={() => setShowEmail((v) => !v)}
            aria-expanded={showEmail}
            className="w-full min-h-[48px] text-[15px] font-semibold text-gray-500 flex items-center justify-center gap-1"
          >
            예전에 이메일로 가입한 전문가이신가요? {showEmail ? '▴' : '▾'}
          </button>
          {showEmail && (
            <div className="space-y-3 mt-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                autoComplete="email"
                className="w-full min-h-[52px] px-4 border border-gray-200 rounded-xl text-[16px] focus:outline-none focus:border-[#0A8A7B]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && emailLogin()}
                placeholder="비밀번호"
                autoComplete="current-password"
                className="w-full min-h-[52px] px-4 border border-gray-200 rounded-xl text-[16px] focus:outline-none focus:border-[#0A8A7B]"
              />
              {error && <p className="text-[14px] text-red-500">{error}</p>}
              <button
                type="button"
                onClick={emailLogin}
                disabled={busy || !email.trim() || !password}
                className="w-full min-h-[52px] rounded-xl text-[16px] font-bold text-white disabled:opacity-40"
                style={{ background: GREEN }}
              >
                {busy ? '로그인 중...' : '이메일로 로그인'}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="px-6 pb-8 pt-6 text-[13px] text-gray-400 text-center leading-relaxed">
        처음 가입할 때 개인정보 수집·이용 동의를 받아요.{' '}
        <Link href="/privacy" className="underline">
          개인정보처리방침
        </Link>
      </p>
    </main>
  )
}
