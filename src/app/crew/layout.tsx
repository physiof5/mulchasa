import type { Metadata } from 'next'

export const metadata: Metadata = { title: '크루', robots: { index: false } }

export default function CrewLayout({ children }: { children: React.ReactNode }) {
  return children
}
