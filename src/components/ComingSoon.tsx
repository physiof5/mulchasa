// 아직 준비 중인 탭의 안내 화면 (무엇이 여기에 생기는지 + 지금 할 수 있는 일)
import Link from 'next/link'
import type { ReactNode } from 'react'
import BottomNav from '@/components/BottomNav'

const GREEN = '#0A8A7B'

export default function ComingSoon({
  title,
  icon,
  headline,
  lines,
  action,
}: {
  title: string
  icon: ReactNode
  headline: string
  lines: string[]
  action: { label: string; href: string }
}) {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-3">
        <h1 className="text-[22px] font-extrabold text-gray-900">{title}</h1>
      </div>
      <section className="px-6 pt-14 text-center">
        <div className="mx-auto w-24 h-24 rounded-full flex items-center justify-center" style={{ background: '#E8F6F4' }} aria-hidden="true">
          {icon}
        </div>
        <p className="text-[21px] font-extrabold text-gray-900 mt-6 leading-snug whitespace-pre-line">{headline}</p>
        <div className="mt-3 space-y-1.5">
          {lines.map((l) => (
            <p key={l} className="text-[15px] text-gray-600 leading-relaxed">
              {l}
            </p>
          ))}
        </div>
        <Link href={action.href} className="mt-8 inline-flex min-h-[52px] px-6 rounded-xl text-white text-[16px] font-bold items-center" style={{ background: GREEN }}>
          {action.label}
        </Link>
        <p className="text-[13px] text-gray-400 mt-6">이 화면은 시범 오픈에 맞춰 열려요.</p>
      </section>
      <BottomNav />
    </main>
  )
}
