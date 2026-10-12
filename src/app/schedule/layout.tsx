import type { Metadata } from 'next'

export const metadata: Metadata = { title: '스케줄', robots: { index: false } }

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return children
}
