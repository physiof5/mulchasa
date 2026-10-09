import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '낙상 위험 1분 체크',
  description: '12가지 질문과 집 안 점검으로 부모님이 넘어질 위험을 살펴보고, 예방 방법을 알려 드려요. (참고용)',
}

export default function FallCheckLayout({ children }: { children: React.ReactNode }) {
  return children
}
