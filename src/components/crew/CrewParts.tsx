'use client'

// 크루 화면 조각: 미션 배지·역할 표시, 입력 칸
import { ROLE_LABEL, badgeInfo, type CrewRole } from '@/lib/crew'
import { GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'

/** 월간 미션 배지 (단계가 없으면 '배지 도전 중') */
export function BadgeChip({ level, plain }: { level: number; plain?: boolean }) {
  const b = badgeInfo(level)
  if (!b) {
    if (plain) return null
    return (
      <span className="inline-flex items-center min-h-[26px] px-2.5 rounded-md text-[13px] font-bold whitespace-nowrap" style={{ background: '#F2F4F6', color: '#6B7280' }}>
        배지 도전 중
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 min-h-[26px] px-2.5 rounded-md text-[13px] font-bold whitespace-nowrap" style={{ background: b.bg, color: b.color }}>
      <BadgeIcon level={level} />
      {b.label} 배지
    </span>
  )
}

/** 방패 모양 배지 아이콘 (단계 숫자) */
export function BadgeIcon({ level, size = 14 }: { level: number; size?: number }) {
  const b = badgeInfo(level)
  if (!b) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 4 5.5v6c0 5 3.4 9.3 8 10.5 4.6-1.2 8-5.5 8-10.5v-6L12 2Z" fill={b.color} />
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">
        {level}
      </text>
    </svg>
  )
}

/** 받은 좋아요 수 */
export function HeartCount({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap" aria-label={`좋아요 ${n}개`}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21Z" fill="#F04452" />
      </svg>
      <span className="font-bold text-gray-700">{n}</span>
    </span>
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
