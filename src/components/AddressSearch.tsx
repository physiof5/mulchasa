'use client'

// 주소 찾기 한 칸 (카카오 주소 검색 → 좌표) — 전문가 가입·프로필 수정에서 함께 씀
import { useState } from 'react'

export interface GeoResult {
  latitude: number
  longitude: number
  address: string
  /** 시·도 + 시·군·구 (예: 서울 송파구) */
  region?: string
}

const GREEN = '#0A8A7B'

export default function AddressSearch({
  label,
  placeholder = '예: 하남시 신장로 101',
  value,
  onChange,
  hint,
}: {
  label: string
  placeholder?: string
  value: GeoResult | null
  onChange: (v: GeoResult | null) => void
  hint?: string
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const search = async () => {
    if (!text.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(text)}`)
      const data = await res.json()
      if (res.ok) onChange(data)
      else setError('주소를 찾지 못했어요. 도로명이나 동 이름까지 넣어 보세요.')
    } catch {
      setError('주소를 찾는 중 문제가 생겼어요. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="text-[15px] font-bold text-gray-800 mb-2">{label}</p>
      {value ? (
        <div className="rounded-xl p-4 border flex items-start gap-3" style={{ background: '#E8F6F4', borderColor: '#BFE3DC' }}>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold" style={{ color: '#0F6E56' }}>
              📍 위치를 확인했어요
            </p>
            <p className="text-[15px] text-gray-700 mt-0.5">{value.address}</p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="min-h-[40px] px-3 rounded-lg bg-white border border-gray-200 text-[14px] font-semibold text-gray-600 shrink-0">
            바꾸기
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder={placeholder}
              aria-label={label}
              className="flex-1 min-w-0 min-h-[52px] px-4 border border-gray-200 rounded-xl text-[16px] focus:outline-none focus:border-[#0A8A7B]"
            />
            <button
              type="button"
              onClick={search}
              disabled={busy || !text.trim()}
              className="min-h-[52px] px-5 rounded-xl text-[16px] font-bold text-white shrink-0 disabled:bg-gray-200 disabled:text-gray-400"
              style={{ background: busy || !text.trim() ? undefined : GREEN }}
            >
              {busy ? '찾는 중' : '찾기'}
            </button>
          </div>
          {error && <p className="text-[14px] text-red-500 mt-2">{error}</p>}
        </>
      )}
      {hint && <p className="text-[13px] text-gray-400 mt-2">{hint}</p>}
    </div>
  )
}
