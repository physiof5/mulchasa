import type { Metadata } from 'next'

export const metadata: Metadata = { title: '진행 후기', robots: { index: false } }

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return children
}
