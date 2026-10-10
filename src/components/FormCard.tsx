// 서식 한 장 카드 (파일 아이콘 + 쉬운 요약 + 열어 보기/내려받기) — 서식자료실·둘러보기에서 함께 씀
import type { FormItem } from '@/lib/forms'
import { WRITER_LABEL } from '@/lib/forms'

const GREEN_DARK = '#0F6E56'

export const TYPE_STYLE: Record<FormItem['type'], { label: string; color: string; bg: string }> = {
  pdf: { label: 'PDF', color: '#C2410C', bg: '#FFF1E8' },
  hwp: { label: 'HWP', color: '#1D4ED8', bg: '#EAF1FF' },
  hwpx: { label: 'HWPX', color: '#1D4ED8', bg: '#EAF1FF' },
}

export function FileIcon({ type }: { type: FormItem['type'] }) {
  const s = TYPE_STYLE[type]
  return (
    <span className="relative w-12 h-14 shrink-0" aria-hidden="true">
      <svg width="48" height="56" viewBox="0 0 48 56" fill="none">
        <path d="M6 2h25l15 15v33a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z" fill={s.bg} stroke={s.color} strokeWidth="2" />
        <path d="M31 2v11a4 4 0 0 0 4 4h11" stroke={s.color} strokeWidth="2" />
      </svg>
      <span className="absolute inset-x-0 bottom-2.5 text-center text-[11px] font-extrabold tracking-tight" style={{ color: s.color }}>
        {s.label}
      </span>
    </span>
  )
}

export default function FormCard({ form: f }: { form: FormItem }) {
  const href = `/forms/${f.file}`
  const meta = [TYPE_STYLE[f.type].label, f.pages ? `${f.pages}쪽` : null, `${f.sizeKb}KB`].filter(Boolean).join(' · ')
  return (
    <li className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start gap-3">
        <FileIcon type={f.type} />
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-bold text-gray-900 leading-snug">{f.title}</p>
          <p className="text-[13px] text-gray-400 mt-0.5 leading-snug">{f.official}</p>
          <span className="inline-block mt-1.5 text-[13px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
            {WRITER_LABEL[f.writer]}
          </span>
        </div>
      </div>
      <p className="text-[15px] text-gray-700 leading-relaxed mt-3">{f.summary}</p>
      {f.submitTo && <p className="text-[14px] text-gray-500 mt-1.5">제출: {f.submitTo}</p>}
      <div className={'mt-3 grid gap-2 ' + (f.type === 'pdf' ? 'grid-cols-2' : 'grid-cols-1')}>
        {f.type === 'pdf' && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[48px] rounded-xl border border-gray-200 bg-white text-[16px] font-semibold text-gray-700 flex items-center justify-center"
          >
            열어 보기
          </a>
        )}
        <a
          href={href}
          download={f.downloadName}
          className="min-h-[48px] rounded-xl border text-[16px] font-bold flex items-center justify-center gap-1.5"
          style={{ borderColor: '#CFE7E2', color: GREEN_DARK, background: '#F6FBFA' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          내려받기
        </a>
      </div>
      <p className="text-[13px] text-gray-400 mt-2 text-right">{meta}</p>
    </li>
  )
}
