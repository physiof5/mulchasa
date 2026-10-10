'use client'

// 카카오 로그인에서 돌아오는 곳
// 1) 로그인 정보를 받아 저장(Supabase가 주소의 토큰을 자동으로 읽음)
// 2) 처음 온 회원이면 가입 동의(만 14세 이상 · 개인정보 수집·이용)를 받고
// 3) 원래 가려던 화면으로 보낸다.

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TERMS_KEY, avatarOf, displayName, hasAgreedTerms, safeNext, useAuthUser } from '@/lib/auth'

const GREEN = '#0A8A7B'

export default function AuthCallbackPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = use(searchParams)
  const next = safeNext(typeof params.next === 'string' ? params.next : null)
  const router = useRouter()
  const user = useAuthUser()
  const [error, setError] = useState('')
  const [agreeAge, setAgreeAge] = useState(false)
  const [agreeCollect, setAgreeCollect] = useState(false)
  const [saving, setSaving] = useState(false)

  // 카카오에서 취소했거나 오류가 난 경우, 또는 너무 오래 걸리는 경우 안내
  useEffect(() => {
    const t0 = window.setTimeout(() => {
      const q = new URLSearchParams(window.location.search)
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const err = q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error')
      if (err) setError(err.includes('denied') || err.includes('cancel') ? '카카오 로그인을 취소했어요.' : '카카오 로그인에 실패했어요.')
    }, 0)
    const t1 = window.setTimeout(() => setError((e) => e || '로그인 확인이 오래 걸리고 있어요. 다시 시도해 주세요.'), 12000)
    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
    }
  }, [])

  // 이미 동의한 회원은 바로 이동
  useEffect(() => {
    if (user && hasAgreedTerms(user)) router.replace(next)
  }, [user, next, router])

  const agree = async () => {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ data: { [TERMS_KEY]: new Date().toISOString() } })
    if (error) {
      setError('동의 내용을 저장하지 못했어요. 다시 시도해 주세요.')
      setSaving(false)
      return
    }
    router.replace(next)
  }

  const decline = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  // 동의 화면 (처음 가입하는 카카오 회원)
  if (user && !hasAgreedTerms(user)) {
    const avatar = avatarOf(user)
    const allOk = agreeAge && agreeCollect
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white flex flex-col">
        <div className="flex-1 px-6 pt-12">
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">👤</span>}
            </span>
            <p className="text-[18px] font-bold text-gray-900">{displayName(user)}님, 반가워요!</p>
          </div>
          <h1 className="text-[24px] font-extrabold text-gray-900 leading-snug mt-6">
            가입을 마치려면
            <br />
            아래 내용에 동의해 주세요
          </h1>

          <div className="mt-6 rounded-2xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                const v = !allOk
                setAgreeAge(v)
                setAgreeCollect(v)
              }}
              className="w-full flex items-center gap-3 p-4 text-left min-h-[60px]"
              style={{ background: allOk ? '#E8F6F4' : '#F9FAFB' }}
            >
              <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-sm shrink-0" style={{ background: allOk ? GREEN : '#D1D5DB' }}>
                ✓
              </span>
              <span className="text-[17px] font-bold text-gray-900">모두 동의해요</span>
            </button>
            <div className="p-4 space-y-4 border-t border-gray-100">
              <Check checked={agreeAge} onChange={setAgreeAge} title="[필수] 만 14세 이상이에요" />
              <Check
                checked={agreeCollect}
                onChange={setAgreeCollect}
                title="[필수] 개인정보 수집·이용"
                lines={[
                  '항목: 카카오 회원번호, 닉네임, 프로필 사진 (이메일은 카카오에서 동의한 경우만)',
                  '목적: 회원 확인·로그인, 문의 응대',
                  '보관: 탈퇴할 때까지',
                ]}
              />
            </div>
          </div>
          <p className="text-[14px] text-gray-500 mt-3 leading-relaxed">
            동의하지 않으면 가입할 수 없어요. 자가진단·정보 보기는 로그인 없이도 쓸 수 있어요.{' '}
            <Link href="/privacy" target="_blank" className="underline">
              개인정보처리방침
            </Link>
          </p>
          {error && <p className="text-[14px] text-red-500 mt-3">{error}</p>}
        </div>

        <div className="px-6 pb-8 pt-4 space-y-2">
          <button
            type="button"
            onClick={agree}
            disabled={!allOk || saving}
            className="w-full min-h-[56px] rounded-2xl text-[17px] font-bold text-white disabled:opacity-40"
            style={{ background: GREEN }}
          >
            {saving ? '저장 중...' : '동의하고 시작하기'}
          </button>
          <button type="button" onClick={decline} className="w-full min-h-[48px] text-[15px] text-gray-400">
            동의하지 않고 나가기
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      {error && user === null ? (
        <>
          <p className="text-[18px] font-bold text-gray-900">{error}</p>
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="mt-6 min-h-[52px] px-8 rounded-xl text-white font-bold flex items-center"
            style={{ background: GREEN }}
          >
            다시 로그인하기
          </Link>
          <Link href="/" className="mt-3 min-h-[48px] flex items-center text-[15px] text-gray-500">
            홈으로
          </Link>
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[#0A8A7B] animate-spin" aria-hidden="true" />
          <p className="text-[17px] text-gray-600 mt-5">로그인하고 있어요...</p>
        </>
      )}
    </main>
  )
}

function Check({ checked, onChange, title, lines }: { checked: boolean; onChange: (v: boolean) => void; title: string; lines?: string[] }) {
  return (
    <label className="flex gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-6 h-6 mt-0.5 shrink-0 accent-[#0A8A7B]" />
      <span className="min-w-0">
        <span className="block text-[16px] font-bold text-gray-900">{title}</span>
        {lines?.map((l) => (
          <span key={l} className="block text-[14px] text-gray-500 leading-relaxed mt-0.5">
            · {l}
          </span>
        ))}
      </span>
    </label>
  )
}
