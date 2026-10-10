import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '센터 찾기',
  description: '가까운 운동센터 위치를 지도에서 찾아보세요.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
