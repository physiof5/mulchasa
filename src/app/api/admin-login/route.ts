import { NextRequest, NextResponse } from 'next/server'
 
export const runtime = 'nodejs'
 
const COOKIE = 'mulchasa_admin'
 
// 로그인: 비밀번호를 서버에서 검증하고 httpOnly 쿠키 발급
export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: '' }))
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  // httpOnly → 클라이언트 JS가 읽을 수 없음(XSS로도 탈취 어려움)
  res.cookies.set(COOKIE, process.env.ADMIN_PASSWORD!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8, // 8시간
  })
  return res
}
 
// 세션 확인: 쿠키가 유효한지 (페이지 진입 시 로그인 화면 건너뛰기용)
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value
  return NextResponse.json({
    authenticated: !!token && token === process.env.ADMIN_PASSWORD,
  })
}
 
// 로그아웃: 쿠키 제거
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
 