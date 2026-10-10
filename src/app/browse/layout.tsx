import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '둘러보기',
  description: '제도·복지 소식, 장기요양 서식자료, 1분 자가진단을 한곳에서.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
