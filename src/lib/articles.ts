// 둘러보기 > 커뮤니티의 '제도·복지 소식' (매거진)
// 글은 운영자가 관리자 화면에서 앱 전용으로 씀 — 블로그 글을 그대로 옮겨 붙이지 않는다(유사문서 위험).
// 글마다 근거 링크 · 시행일 · 최종 확인일을 함께 보여 준다(프로젝트 지침).

export const ARTICLE_CATEGORIES = ['장기요양', '복지용구', '정부지원금', '장애인 복지', '통합돌봄', '돌봄 팁'] as const
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]

export interface ArticleSource {
  label: string
  url: string
}

export interface Article {
  id: string
  category: string
  title: string
  summary: string
  body: string
  cover_url: string | null
  sources: ArticleSource[]
  effective_date: string | null
  checked_at: string | null
  status: 'draft' | 'published'
  published_at: string | null
  updated_at: string
}

export const ARTICLE_LIST_FIELDS = 'id, category, title, summary, cover_url, published_at, checked_at'

export function cleanSources(v: unknown): ArticleSource[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((s) => s && typeof s.label === 'string' && typeof s.url === 'string' && /^https?:\/\//.test(s.url))
    .slice(0, 10)
    .map((s) => ({ label: String(s.label).slice(0, 80), url: String(s.url).slice(0, 500) }))
}

/** 본문 간단 문법: '## 소제목' / '- 목록' / '> 알림 상자' / 빈 줄 = 문단 나눔 */
export type Block = { type: 'h' | 'p' | 'note'; text: string } | { type: 'ul'; items: string[] }

export function parseBody(body: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let list: string[] = []
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') })
    para = []
  }
  const flushList = () => {
    if (list.length) blocks.push({ type: 'ul', items: list })
    list = []
  }
  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) {
      flushPara()
      flushList()
    } else if (line.startsWith('## ')) {
      flushPara()
      flushList()
      blocks.push({ type: 'h', text: line.slice(3) })
    } else if (line.startsWith('- ')) {
      flushPara()
      list.push(line.slice(2))
    } else if (line.startsWith('> ')) {
      flushPara()
      flushList()
      blocks.push({ type: 'note', text: line.slice(2) })
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return blocks
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}
