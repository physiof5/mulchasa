import { NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

const BLOG_ID = 'spacex_2025'
const RSS_URL = `https://rss.blog.naver.com/${BLOG_ID}.xml`

// 비워두면 전체 글, 카테고리 이름을 넣으면 해당 카테고리 글만 보여줍니다.
// 예: ['복지용구', '건강하게 움직이다']
const ALLOWED_CATEGORIES: string[] = ['장기요양', '장애인복지', '정부지원금', '복지용구']

type BlogPost = {
  id: string
  title: string
  link: string
  summary: string
  thumbnail: string | null
  category: string
  tags: string[]
  publishedAt: string
}

// HTML 태그·특수문자를 걷어내고 읽기 좋은 요약문으로 정리
function cleanText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\.{3,}/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function GET() {
  try {
    const res = await fetch(RSS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BopilBot/1.0)' },
    })
    if (!res.ok) throw new Error(`RSS 응답 오류: ${res.status}`)

    const xml = await res.text()
    const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false })
    const data = parser.parse(xml)

    const channel = data?.rss?.channel
    const rawItems = channel?.item ?? []
    const items = Array.isArray(rawItems) ? rawItems : [rawItems]

    const posts: BlogPost[] = items.map((item: Record<string, string>) => {
      const description = String(item.description ?? '')
      const imgMatch = description.match(/<img[^>]+src="([^"]+)"/)
      const guid = String(item.guid ?? item.link ?? '')

      return {
        id: guid.split('/').pop() ?? guid,
        title: cleanText(String(item.title ?? '')),
        link: guid,
        summary: cleanText(description).slice(0, 120),
        thumbnail: imgMatch ? imgMatch[1] : null,
        category: cleanText(String(item.category ?? '')),
        tags: String(item.tag ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 5),
        publishedAt: new Date(String(item.pubDate)).toISOString(),
      }
    })

    // 띄어쓰기를 무시하고 비교 ('장애인 복지' = '장애인복지')
    const normalize = (s: string) => s.replace(/\s+/g, '')
    const allowed = ALLOWED_CATEGORIES.map(normalize)

    const filtered =
      allowed.length > 0
        ? posts.filter((p) => allowed.includes(normalize(p.category)))
        : posts

    return NextResponse.json(
      { blogTitle: cleanText(String(channel?.title ?? '보호가 필요해')), posts: filtered },
      {
        // 배포 후 1시간 동안은 저장된 결과를 보여주고, 그 뒤 새로 받아옵니다.
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      }
    )
  } catch (e) {
    console.error('blog-feed error:', e)
    return NextResponse.json(
      { blogTitle: '보호가 필요해', posts: [], error: '블로그 글을 불러오지 못했어요' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}