// 제도·복지 소식 한 편 — 근거 링크 · 시행일 · 최종 확인일을 함께 보여 준다
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { cleanSources, formatDate, parseBody, type Article } from '@/lib/articles'

const GREEN = '#0A8A7B'
const GREEN_DARK = '#0F6E56'
const GREEN_LIGHT = '#E8F6F4'

async function getArticle(id: string): Promise<Article | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await supabase.from('articles').select('*').eq('id', id).eq('status', 'published').maybeSingle()
  return (data as Article | null) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const a = await getArticle((await params).id)
  return a ? { title: a.title, description: a.summary } : { title: '제도·복지 소식' }
}

export default async function MagazinePage({ params }: { params: Promise<{ id: string }> }) {
  const a = await getArticle((await params).id)
  if (!a) notFound()
  const blocks = parseBody(a.body)
  const sources = cleanSources(a.sources)

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-1">
        <Link href="/browse" aria-label="둘러보기로" className="w-12 h-12 -ml-2 flex items-center justify-center text-gray-500">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <p className="text-[16px] font-bold text-gray-900">제도·복지 소식</p>
      </div>

      {a.cover_url && <img src={a.cover_url} alt="" className="w-full aspect-[16/9] object-cover" />}

      <article className="px-5 pt-6 pb-8">
        <span className="inline-block text-[13px] font-bold px-2.5 py-1 rounded-md" style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
          {a.category}
        </span>
        <h1 className="text-[25px] font-extrabold text-gray-900 leading-snug mt-3">{a.title}</h1>
        <p className="text-[14px] text-gray-400 mt-2">
          {formatDate(a.published_at)}
          {a.checked_at && ` · 최종 확인 ${formatDate(a.checked_at)}`}
        </p>
        {a.summary && <p className="text-[17px] text-gray-700 leading-relaxed mt-5 font-semibold">{a.summary}</p>}

        <div className="mt-6 space-y-4">
          {blocks.map((b, i) =>
            b.type === 'h' ? (
              <h2 key={i} className="text-[20px] font-extrabold text-gray-900 pt-3">
                {b.text}
              </h2>
            ) : b.type === 'ul' ? (
              <ul key={i} className="space-y-1.5 pl-1">
                {b.items.map((it, j) => (
                  <li key={j} className="text-[17px] text-gray-700 leading-relaxed flex gap-2">
                    <span className="shrink-0" style={{ color: GREEN }}>
                      •
                    </span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            ) : b.type === 'note' ? (
              <p key={i} className="rounded-xl p-4 text-[16px] leading-relaxed" style={{ background: '#FFFBEB', color: '#78350F' }}>
                {b.text}
              </p>
            ) : (
              <p key={i} className="text-[17px] text-gray-700 leading-[1.75]">
                {b.text}
              </p>
            )
          )}
        </div>

        <div className="mt-8 rounded-2xl bg-gray-50 p-4">
          <p className="text-[15px] font-bold text-gray-800">근거와 기준일</p>
          {a.effective_date && <p className="text-[14px] text-gray-600 mt-1">시행일: {formatDate(a.effective_date)}</p>}
          {a.checked_at && <p className="text-[14px] text-gray-600 mt-0.5">최종 확인일: {formatDate(a.checked_at)}</p>}
          {sources.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[14px] underline" style={{ color: GREEN_DARK }}>
                    {s.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-[13px] text-gray-400 mt-2 leading-relaxed">제도와 금액은 바뀔 수 있어요. 신청 전에 공단(1577-1000)이나 주민센터에 꼭 확인해 주세요.</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <Link href="/browse?tab=checks" className="min-h-[52px] rounded-xl border border-gray-200 text-[15px] font-bold text-gray-700 flex items-center justify-center">
            1분 자가진단
          </Link>
          <Link href="/experts" className="min-h-[52px] rounded-xl text-[15px] font-bold text-white flex items-center justify-center" style={{ background: GREEN }}>
            전문가 찾기
          </Link>
        </div>
      </article>
      <BottomNav />
    </main>
  )
}
