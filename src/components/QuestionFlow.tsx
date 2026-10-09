'use client'

// 한 화면에 질문 하나씩 보여 주는 흐름 공통 UI (맞춤 찾기 · 자가진단)
// 보호자·어르신 모두 읽기 쉽게: 본문 17~18px, 터치 영역 56px 이상

import type { ReactNode } from 'react'
import Link from 'next/link'

export const GREEN = '#0A8A7B'
export const GREEN_DARK = '#0F6E56'
export const GREEN_LIGHT = '#E8F6F4'

export function FlowShell({
  title,
  step,
  total,
  onBack,
  children,
  footer,
}: {
  title: string
  step: number
  total: number
  onBack: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-white flex flex-col">
      <div className="sticky top-0 z-10 bg-white px-4 pt-2 pb-2">
        <div className="flex items-center gap-1">
          <button onClick={onBack} aria-label="이전" className="w-12 h-12 -ml-2 flex items-center justify-center text-gray-500">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="flex-1 min-w-0 text-[15px] font-semibold text-gray-500 truncate">{title}</p>
          {total > 0 && (
            <span className="text-[15px] text-gray-400 tabular-nums">
              {step}/{total}
            </span>
          )}
        </div>
        {total > 0 && (
          <div
            className="h-1.5 bg-gray-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={step}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(step / total) * 100}%`, background: GREEN }}
            />
          </div>
        )}
      </div>
      <div className="flex-1 px-5 pt-6 pb-8">{children}</div>
      {footer && <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-gray-100">{footer}</div>}
    </main>
  )
}

export function Question({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[24px] font-extrabold text-gray-900 leading-snug whitespace-pre-line">{title}</h1>
      {sub && <p className="text-[16px] text-gray-500 mt-2 leading-relaxed">{sub}</p>}
    </div>
  )
}

export function OptionButton({
  label,
  desc,
  selected,
  onClick,
  multi,
}: {
  label: string
  desc?: string
  selected: boolean
  onClick: () => void
  multi?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="w-full min-h-[60px] px-4 py-3.5 rounded-2xl border-2 text-left flex items-center gap-3 active:scale-[0.99] transition-all"
      style={selected ? { borderColor: GREEN, background: GREEN_LIGHT } : { borderColor: '#E5E7EB', background: '#fff' }}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[18px] font-bold leading-snug" style={{ color: selected ? GREEN_DARK : '#1F2937' }}>
          {label}
        </span>
        {desc && <span className="block text-[15px] text-gray-500 mt-0.5 leading-snug">{desc}</span>}
      </span>
      <span
        aria-hidden="true"
        className={'w-6 h-6 shrink-0 flex items-center justify-center text-[13px] font-bold ' + (multi ? 'rounded-md' : 'rounded-full')}
        style={selected ? { background: GREEN, color: '#fff' } : { border: '2px solid #D1D5DB', color: 'transparent' }}
      >
        ✓
      </span>
    </button>
  )
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full min-h-[56px] rounded-2xl text-[18px] font-bold text-white transition-all active:scale-[0.99] disabled:cursor-not-allowed"
      style={{ background: disabled ? '#B8D9D4' : GREEN }}
    >
      {children}
    </button>
  )
}

/** 결과 화면의 '다음 할 일' 카드 */
export function StepCard({
  title,
  body,
  actions,
  tone = 'default',
}: {
  title: string
  body: string[]
  actions: { label: string; href: string; external?: boolean }[]
  tone?: 'default' | 'warn'
}) {
  return (
    <div
      className="rounded-2xl p-4 border"
      style={tone === 'warn' ? { background: '#FFFBEB', borderColor: '#FDE68A' } : { background: '#fff', borderColor: '#EEF0F2' }}
    >
      <p className="text-[17px] font-bold text-gray-900 leading-snug">{title}</p>
      <div className="mt-1.5 space-y-1.5">
        {body.map((line) => (
          <p key={line} className="text-[15px] text-gray-600 leading-relaxed">
            {line}
          </p>
        ))}
      </div>
      {actions.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {actions.map((a) => {
            const cls = 'min-h-[48px] px-4 rounded-xl flex items-center justify-between text-[16px] font-semibold border'
            const style = { borderColor: '#CFE7E2', color: GREEN_DARK, background: '#F6FBFA' }
            const inner = (
              <>
                <span>{a.label}</span>
                <span aria-hidden="true">{a.external ? '↗' : '›'}</span>
              </>
            )
            // 내부 화면은 Link, 외부 누리집·전화는 a
            return a.external || !a.href.startsWith('/') ? (
              <a
                key={a.label}
                href={a.href}
                {...(a.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={cls}
                style={style}
              >
                {inner}
              </a>
            ) : (
              <Link key={a.label} href={a.href} className={cls} style={style}>
                {inner}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
