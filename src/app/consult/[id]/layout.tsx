import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '상담 요청',
  robots: { index: false },
}

export default function ConsultDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
