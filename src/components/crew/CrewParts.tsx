'use client'

// 크루 화면 조각: 등급·역할 표시, 입력 칸
import { ROLE_LABEL, tierInfo, type CrewRole } from '@/lib/crew'
import { GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'

export function TierChip({ tier, suffix = ' 크루' }: { tier: string; suffix?: string }) {
  const t = tierInfo(tier)
  return (
    <span className="inline-flex items-center gap-1 min-h-[26px] px-2.5 rounded-md text-[13px] font-bold whitespace-nowrap" style={{ background: t.bg, color: t.color }}>
      <TierIcon tier={t.key} />
      {t.key}
      {suffix}
    </span>
  )
}

export function TierIcon({ tier, size = 14 }: { tier: string; size?: number }) {
  const t = tierInfo(tier)
  if (t.key === '으뜸') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 8l4 4 4-7 4 7 4-4-2 11H6L4 8Z" fill={t.color} />
      </svg>
    )
  }
  if (t.key === '든든') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z" fill={t.color} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21v-8M12 13c0-4 3-6 7-6 0 4-3 6-7 6ZM12 15c0-3-2.5-5-6-5 0 3 2.5 5 6 5Z" stroke={t.color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function RoleChip({ role }: { role: CrewRole }) {
  if (role === 'member') return null
  const style = role === 'owner' ? { background: GREEN_DARK, color: '#fff' } : { background: GREEN_LIGHT, color: GREEN_DARK }
  return (
    <span className="inline-flex items-center min-h-[22px] px-2 rounded-md text-[12px] font-bold whitespace-nowrap" style={style}>
      {ROLE_LABEL[role]}
    </span>
  )
}

export function TextField({
  label, value, onChange, max, placeholder, hint, error, multiline, rows = 3, inputMode, autoCapitalize,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  max: number
  placeholder?: string
  hint?: string
  error?: string | null
  multiline?: boolean
  rows?: number
  inputMode?: 'text' | 'numeric'
  autoCapitalize?: 'characters' | 'off'
}) {
  const cls = 'mt-1.5 w-full px-4 py-3 border rounded-xl text-[16px] focus:outline-none focus:border-[#0A8A7B] ' + (error ? 'border-red-300' : 'border-gray-200')
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-[15px] font-bold text-gray-800">{label}</span>
        <span className="text-[12px] text-gray-400">
          {value.length}/{max}
        </span>
      </span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} rows={rows} placeholder={placeholder} className={cls + ' resize-none leading-relaxed'} />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, max))}
          placeholder={placeholder}
          inputMode={inputMode}
          autoCapitalize={autoCapitalize}
          className={cls + ' min-h-[52px]'}
        />
      )}
      {error ? <span className="block text-[13px] text-red-500 mt-1 leading-relaxed">{error}</span> : hint && <span className="block text-[13px] text-gray-500 mt-1 leading-relaxed">{hint}</span>}
    </label>
  )
}

export function PrimaryButton({ label, onClick, disabled, danger }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full min-h-[52px] rounded-xl text-[16px] font-bold text-white disabled:bg-gray-200 disabled:text-gray-400"
      style={{ background: disabled ? undefined : danger ? '#E5484D' : '#0A8A7B' }}
    >
      {label}
    </button>
  )
}
