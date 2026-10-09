import { redirect } from 'next/navigation'

// 예전 '증상으로 찾기'(통증 중심) 주소 → 보호자용 '부모님 상황 맞춤 찾기'로 이동
// 블로그·SNS에 남아 있는 옛 링크도 그대로 쓰이도록 주소는 남겨 둔다.
export default function SymptomPage() {
  redirect('/find')
}
