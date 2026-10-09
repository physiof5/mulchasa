import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '장기요양등급 1분 예상',
  description: '일상생활에서 도움이 필요한 정도로 장기요양등급 범위를 미리 살펴보고, 신청 방법까지 알려 드려요. (참고용)',
}

export default function LtcCheckLayout({ children }: { children: React.ReactNode }) {
  return children
}
