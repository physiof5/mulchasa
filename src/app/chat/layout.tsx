import type { Metadata } from 'next'

export const metadata: Metadata = { title: '채팅', robots: { index: false } }

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children
}
