import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '전문가 찾기',
  description: '내 주변 물리치료사 전문가를 거리순으로 찾아보세요.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
