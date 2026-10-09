'use client'

import { useState } from 'react'
import { REGIONS, ALL_SUFFIX } from '@/lib/regions'

const GREEN = '#0A8A7B'

type Props = {
  multiple: boolean          // true: 여러 곳 선택(전문가), false: 한 곳만(보호자)
  value: string[]            // ["서울 송파구", ...]
  onChange: (next: string[]) => void
}

export default function RegionPicker({ multiple, value, onChange }: Props) {
  const [activeSido, setActiveSido] = useState<string | null>(
    value[0] ? value[0].split(' ')[0] : null
  )
  const current = REGIONS.find((r) => r.sido === activeSido)

  const toggle = (sido: string, district: string) => {
    const key = `${sido} ${district}`
    if (!multiple) {
      onChange(value[0] === key ? [] : [key])
      return
    }
    if (value.includes(key)) {
      onChange(value.filter((v) => v !== key))
      return
    }
    // '전체'를 고르면 같은 시·도의 개별 지역은 지우고, 개별 지역을 고르면 '전체'를 지움
    const others = value.filter((v) => {
      const [s, d] = v.split(' ')
      if (s !== sido) return true
      return district === ALL_SUFFIX ? false : d !== ALL_SUFFIX
    })
    onChange([...others, key])
  }

  const chip = (selected: boolean) =>
    selected
      ? { borderColor: GREEN, background: '#E8F6F4', color: '#0F6E56' }
      : { borderColor: '#E5E7EB', background: 'white', color: '#374151' }

  return (
    <div>
      <p className="text-[14px] text-gray-500 mb-3">
        {multiple
          ? '시·도를 고른 뒤 활동할 수 있는 지역을 모두 골라 주세요 (여러 곳 가능)'
          : '시·도를 고른 뒤 사시는 시·군·구를 하나 골라 주세요'}
      </p>

      {/* 고른 지역 */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {value.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="px-3 py-2 rounded-full text-[15px] font-bold text-white"
              style={{ background: GREEN }}
              aria-label={`${v} 선택 취소`}
            >
              {v} ✕
            </button>
          ))}
        </div>
      )}

      {/* 1단계: 시·도 */}
      <div className="grid grid-cols-4 gap-2">
        {REGIONS.map((r) => {
          const picked = value.some((v) => v.startsWith(`${r.sido} `))
          const active = activeSido === r.sido
          return (
            <button
              key={r.sido}
              type="button"
              onClick={() => setActiveSido(r.sido)}
              className="min-h-[48px] rounded-xl border-2 text-[16px] font-bold transition-all"
              style={
                active
                  ? { borderColor: GREEN, background: GREEN, color: 'white' }
                  : chip(picked)
              }
            >
              {r.sido}
            </button>
          )
        })}
      </div>

      {/* 2단계: 시·군·구 */}
      {current && (
        <div className="mt-4 rounded-2xl bg-gray-50 p-3">
          <div className="text-[15px] font-bold text-gray-800 mb-2 px-1">{current.sido}</div>
          <div className="grid grid-cols-3 gap-2">
            {multiple && current.districts.length > 1 && (
              <button
                type="button"
                onClick={() => toggle(current.sido, ALL_SUFFIX)}
                className="min-h-[48px] rounded-xl border-2 text-[15px] font-bold"
                style={chip(value.includes(`${current.sido} ${ALL_SUFFIX}`))}
              >
                {current.sido} 전체
              </button>
            )}
            {current.districts.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggle(current.sido, d)}
                className="min-h-[48px] rounded-xl border-2 text-[15px] font-medium"
                style={chip(value.includes(`${current.sido} ${d}`))}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
