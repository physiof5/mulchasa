import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '1분 자가진단',
  description: '부모님의 낙상 위험과 장기요양등급을 1분 만에 살펴보고, 다음 할 일을 알려 드려요. 설치 없이 바로 시작해요.',
}

export default function CheckLayout({ children }: { children: React.ReactNode }) {
  return children
}
