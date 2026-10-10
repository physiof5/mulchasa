'use client'

// 카카오 로그인 버튼 (카카오 디자인 가이드: 노란 바탕 #FEE500 + 검은 말풍선 + '카카오 로그인' 계열 문구)

import { useState } from 'react'
import { signInWithKakao } from '@/lib/auth'

export default function KakaoLoginButton({ next, label = '카카오로 시작하기' }: { next?: string; label?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    setBusy(true)
    setError('')
    const { error } = await signInWithKakao(next)
    if (error) {
      setError('카카오 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setBusy(false)
    }
    // 성공하면 카카오 화면으로 넘어가므로 여기서 끝
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="w-full min-h-[56px] rounded-2xl flex items-center justify-center gap-2.5 text-[17px] font-bold active:scale-[0.99] transition-all disabled:opacity-60"
        style={{ background: '#FEE500', color: 'rgba(0,0,0,0.85)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#000"
            d="M12 3C6.48 3 2 6.47 2 10.75c0 2.76 1.86 5.18 4.66 6.55-.2.74-.74 2.7-.85 3.12-.13.52.19.51.4.37.17-.11 2.62-1.78 3.68-2.5.69.1 1.39.15 2.11.15 5.52 0 10-3.47 10-7.75S17.52 3 12 3Z"
          />
        </svg>
        {busy ? '카카오로 이동 중...' : label}
      </button>
      {error && <p className="text-[14px] text-red-500 mt-2 text-center">{error}</p>}
    </div>
  )
}
