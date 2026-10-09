// 대표 사진 3칸 (정사각형) — 검색 목록·지도 카드·프로필에서 함께 쓴다
// 사진이 3장보다 적으면 빈칸은 연한 자리표시로 채워 줄이 흐트러지지 않게 한다.

import type { ReactNode } from 'react'

export default function PhotoTriplet({
  urls,
  name,
  gap = 2,
  rounded = '',
  linkable = false,
  overlay,
}: {
  urls: string[]
  name: string
  gap?: number
  rounded?: string
  /** 눌러서 원본 크게 보기 */
  linkable?: boolean
  /** 배지 등 사진 위에 얹을 내용 */
  overlay?: ReactNode
}) {
  const slots = [0, 1, 2]
  return (
    <div className={'relative grid grid-cols-3 overflow-hidden ' + rounded} style={{ gap }}>
      {slots.map((i) => {
        const url = urls[i]
        if (!url) {
          return (
            <div
              key={i}
              aria-hidden="true"
              className="aspect-square flex items-center justify-center"
              style={{ background: i === 0 ? 'linear-gradient(135deg, #d4e8e3, #a8d4c8)' : '#EEF4F2' }}
            >
              {i === 0 && (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.6 }}>
                  <circle cx="12" cy="8" r="4" fill="#fff" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </div>
          )
        }
        const img = <img src={url} alt={`${name} 대표 사진 ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
        return linkable ? (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-gray-100">
            {img}
          </a>
        ) : (
          <div key={i} className="aspect-square bg-gray-100">
            {img}
          </div>
        )
      })}
      {overlay}
    </div>
  )
}
