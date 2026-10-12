import type { Metadata } from 'next'

export const metadata: Metadata = { title: '구독 관리', robots: { index: false } }

export default function SubscriptionLayout({ children }: { children: React.ReactNode }) {
  return children
}
