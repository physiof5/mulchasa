import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '무료 상담 요청',
  description: '부모님 상태를 몇 가지 고르면, 가까운 물리치료사 최대 3명이 수락하고 채팅으로 무료 상담해 드려요.',
}

export default function ConsultNewLayout({ children }: { children: React.ReactNode }) {
  return children
}
