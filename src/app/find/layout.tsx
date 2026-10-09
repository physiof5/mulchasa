import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '부모님 상황 맞춤 찾기',
  description: '부모님의 걷기·생활 상황을 1분 안에 고르면, 맞는 운동 지도 분야와 함께 챙길 제도를 알려 드려요.',
}

export default function FindLayout({ children }: { children: React.ReactNode }) {
  return children
}
