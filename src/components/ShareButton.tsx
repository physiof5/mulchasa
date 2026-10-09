'use client'

// 이 화면 주소를 가족에게 보내기 (결과가 아니라 '점검하는 주소'만 공유 — 건강 정보가 퍼지지 않게)
import { useState } from 'react'

export default function ShareButton({ path, title, text, label = '가족에게 이 점검 보내기' }: {
  path: string
  title: string
  text: string
  label?: string
}) {
  const [done, setDone] = useState('')

  const share = async () => {
    const url = window.location.origin + path
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, text, url })
        return
      }
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setDone('주소를 복사했어요. 카톡에 붙여넣어 보내 주세요.')
    } catch {
      // 공유 창을 닫은 경우 등 — 조용히 넘어감
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={share}
        className="w-full min-h-[52px] rounded-xl bg-white border border-gray-200 text-[16px] font-semibold text-gray-700 flex items-center justify-center gap-2"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="2" />
          <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" stroke="currentColor" strokeWidth="2" />
        </svg>
        {label}
      </button>
      {done && <p className="text-[14px] text-gray-500 text-center mt-2">{done}</p>}
    </div>
  )
}
