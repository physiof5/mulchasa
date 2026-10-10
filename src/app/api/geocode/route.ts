import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')

  if (!address) {
    return NextResponse.json({ error: '주소를 입력해주세요' }, { status: 400 })
  }

  const response = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
    {
      headers: {
        Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
      },
    }
  )

  const data = await response.json()

  if (!data.documents || data.documents.length === 0) {
    return NextResponse.json({ error: '주소를 찾을 수 없습니다' }, { status: 404 })
  }

  const doc = data.documents[0]
  const { x, y } = doc
  // 동네 이름(시·도 + 시·군·구) — 상담 요청서에는 정확한 주소 대신 이 값만 저장
  const area = doc.address ?? doc.road_address ?? {}
  const region = [area.region_1depth_name, area.region_2depth_name].filter(Boolean).join(' ')
  return NextResponse.json({
    latitude: parseFloat(y),
    longitude: parseFloat(x),
    address: doc.address_name,
    region,
  })
}