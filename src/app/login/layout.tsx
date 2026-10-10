import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '로그인',
  description: '카카오로 3초 만에 시작해요.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
