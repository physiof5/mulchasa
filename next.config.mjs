/** @type {import('next').NextConfig} */
const nextConfig = {
  // 개발 중 같은 와이파이의 휴대폰(내부망 IP)에서 접속해 확인할 수 있게 허용 (배포에는 영향 없음)
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*'],
}

export default nextConfig
