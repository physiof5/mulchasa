import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '돌봄 비용 모의 계산',
  description: '방문요양·주야간보호·요양원을 이용하면 한 달에 본인이 얼마를 내는지 2026년 공식 수가로 미리 계산해 봐요. (참고용)',
}

export default function CostCheckLayout({ children }: { children: React.ReactNode }) {
  return children
}
