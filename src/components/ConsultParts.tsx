'use client'

// 상담 요청·채팅 화면에서 함께 쓰는 조각들

import Link from 'next/link'
import type { ReactNode } from 'react'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import { answerLines, consultState, type ConsultAnswers, type ConsultRow } from '@/lib/consult'

export const GREEN = '#0A8A7B'
export const GREEN_DARK = '#0F6E56'
export const GREEN_LIGHT = '#E8F6F4'

/** 위쪽 막대: 뒤로 + 제목 (+ 오른쪽 버튼) */
export function TopBar({ title, sub, backHref, onBack, right }: { title: string; sub?: string; backHref?: string; onBack?: () => void; right?: ReactNode }) {
  const icon = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  const cls = 'w-12 h-12 -ml-2 flex items-center justify-center text-gray-600 shrink-0'
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-1.5 flex items-center gap-1">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="뒤로" className={cls}>
          {icon}
        </button>
      ) : (
        <Link href={backHref ?? '/'} aria-label="뒤로" className={cls}>
          {icon}
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[18px] font-extrabold text-gray-900 truncate">{title}</p>
        {sub && <p className="text-[13px] text-gray-500 truncate -mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

/** 동그란 사진 (없으면 첫 글자) */
export function Avatar({ src, name, size = 52 }: { src?: string | null; name: string; size?: number }) {
  return (
    <span
      className="rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold"
      style={{ width: size, height: size, background: GREEN_LIGHT, color: GREEN_DARK, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : name.slice(0, 1)}
    </span>
  )
}

/** 보호자 쪽 (전문가 화면에서 상대 표시) */
export function GuardianAvatar({ size = 52 }: { size?: number }) {
  return (
    <span className="rounded-full shrink-0 flex items-center justify-center" style={{ width: size, height: size, background: '#F2F4F6' }} aria-hidden="true">
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="#8B95A1" strokeWidth="2" />
        <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="#8B95A1" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function StateChip({ row }: { row: Pick<ConsultRow, 'status' | 'accepted_count' | 'expires_at'> }) {
  const s = consultState(row)
  const style =
    s.tone === 'open'
      ? { background: GREEN_LIGHT, color: GREEN_DARK }
      : s.tone === 'full'
        ? { background: '#FFF4E5', color: '#B45309' }
        : { background: '#F2F4F6', color: '#6B7280' }
  return (
    <span className="inline-flex items-center min-h-[26px] px-2.5 rounded-md text-[13px] font-bold whitespace-nowrap" style={style}>
      {s.label}
    </span>
  )
}

/** 요청서 내용 (선택한 답 + 남긴 글) */
export function AnswerList({ answers, note, area }: { answers: ConsultAnswers; note?: string; area?: string }) {
  const lines = [...answerLines(answers), ...(area ? [{ label: '동네', value: area }] : [])]
  return (
    <div>
      <dl className="divide-y divide-gray-100">
        {lines.map((l) => (
          <div key={l.label} className="flex gap-3 py-2.5">
            <dt className="w-[86px] shrink-0 text-[14px] text-gray-500 pt-0.5">{l.label}</dt>
            <dd className="flex-1 min-w-0 text-[16px] font-semibold text-gray-800 leading-snug">{l.value}</dd>
          </div>
        ))}
      </dl>
      {note && (
        <div className="mt-2 rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-[13px] font-semibold text-gray-500">남긴 글</p>
          <p className="text-[16px] text-gray-800 leading-relaxed mt-1 whitespace-pre-line">{note}</p>
        </div>
      )}
    </div>
  )
}

/** 로그인이 필요한 화면 */
export function LoginNeeded({ title, desc, next }: { title: string; desc: string; next: string }) {
  return (
    <section className="px-6 pt-14 text-center">
      <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{ background: GREEN_LIGHT }} aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="10" width="14" height="10" rx="2" stroke={GREEN} strokeWidth="2" />
          <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke={GREEN_DARK} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-[21px] font-extrabold text-gray-900 mt-5 leading-snug whitespace-pre-line">{title}</p>
      <p className="text-[15px] text-gray-600 mt-2 leading-relaxed">{desc}</p>
      <div className="mt-7 text-left">
        <KakaoLoginButton next={next} label="카카오로 로그인" />
      </div>
    </section>
  )
}

export function Spinner() {
  return (
    <div className="py-16 flex justify-center" aria-label="불러오는 중">
      <span className="w-8 h-8 rounded-full border-[3px] border-gray-200 animate-spin" style={{ borderTopColor: GREEN }} />
    </div>
  )
}
