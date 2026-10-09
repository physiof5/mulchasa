import type { Metadata, Viewport } from 'next'
import './globals.css'

// 앱 이름은 아직 정하지 않아, 블로그·유튜브 채널 이름 '보호가 필요해'를 임시로 씀
export const metadata: Metadata = {
  title: {
    default: '보호가 필요해 — 부모님 돌봄 길잡이',
    template: '%s | 보호가 필요해',
  },
  description: '장기요양·복지 정보, 1분 자가진단, 물리치료사의 운동 지도까지. 부모님 돌봄을 물리치료사·사회복지사가 함께 봐 드려요.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '물찾사',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0A8A7B',
  width: 'device-width',
  initialScale: 1,
  // 어르신·보호자가 글자를 키워 볼 수 있도록 화면 확대를 막지 않음
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="물찾사" />
  <meta name="mobile-web-app-capable" content="yes" />
</head>
      <body>{children}</body>
    </html>
  )
}