'use client'

// 아래에서 올라오는 창 (크루·진행 후기 화면에서 함께 씀)
import { useEffect, type ReactNode } from 'react'

export default function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  // 열려 있는 동안 뒤 화면이 같이 스크롤되지 않게
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md max-h-[90dvh] flex flex-col bg-white rounded-t-3xl">
        <div className="px-5 pt-3 pb-2 shrink-0">
          <div className="mx-auto w-10 h-1.5 rounded-full bg-gray-200 mb-3" aria-hidden="true" />
          <p className="text-[20px] font-extrabold text-gray-900">{title}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-2">{children}</div>
        <div className="px-5 pt-2 shrink-0" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          {footer}
          <button type="button" onClick={onClose} className="w-full min-h-[48px] mt-1 text-[16px] font-semibold text-gray-500">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

/** 창 안의 줄 버튼 */
export function SheetAction({ label, desc, onClick, danger, disabled }: { label: string; desc?: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex flex-col justify-center min-h-[56px] px-4 py-2 rounded-xl text-left active:bg-gray-50 disabled:opacity-40"
    >
      <span className="text-[17px] font-semibold" style={{ color: danger ? '#E5484D' : '#1F2937' }}>
        {label}
      </span>
      {desc && <span className="text-[13px] text-gray-500 leading-snug">{desc}</span>}
    </button>
  )
}
