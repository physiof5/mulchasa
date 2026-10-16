import type { Metadata } from 'next'

export const metadata: Metadata = { title: '내 진행 후기', robots: { index: false } }

export default function MyReviewsLayout({ children }: { children: React.ReactNode }) {
  return children
}
