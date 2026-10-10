'use client'

// 둘러보기 — 위쪽 글자 탭: 커뮤니티(제도·복지 소식) · 서식자료 · 자가진단
// 블로그로 나가지 않고 앱 안에서 읽고, 내려받고, 점검한다.

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import FormCard from '@/components/FormCard'
import { FORMS, FORM_CATEGORIES, type FormCategory } from '@/lib/forms'
import { ARTICLE_CATEGORIES, ARTICLE_LIST_FIELDS, formatDate } from '@/lib/articles'
import { LAST_RESULT_KEYS, parseLastResult } from '@/lib/checks'
import { useLocalStorageItem } from '@/lib/useDeviceStorage'

const GREEN = '#0A8A7B'
const GREEN_DARK = '#0F6E56'
const GREEN_LIGHT = '#E8F6F4'

const TABS = [
  { key: 'community', label: '커뮤니티' },
  { key: 'forms', label: '서식자료' },
  { key: 'checks', label: '자가진단' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function BrowsePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = use(searchParams)
  const router = useRouter()
  const initial = TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : 'community'
  const [tab, setTab] = useState<TabKey>(initial)

  const choose = (key: TabKey) => {
    setTab(key)
    router.replace(key === 'community' ? '/browse' : `/browse?tab=${key}`, { scroll: false })
    window.scrollTo(0, 0)
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="px-5 pt-4 flex gap-5" role="tablist" aria-label="둘러보기 분류">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => choose(t.key)}
              className="relative min-h-[48px] pb-2 text-[21px] font-extrabold"
              style={{ color: tab === t.key ? '#111827' : '#B0B8C1' }}
            >
              {t.label}
              {tab === t.key && <span className="absolute left-0 right-0 bottom-0 h-[3px] rounded-full" style={{ background: GREEN }} />}
            </button>
          ))}
        </div>
      </div>

      {tab === 'community' && <Community />}
      {tab === 'forms' && <Forms />}
      {tab === 'checks' && <Checks />}

      <BottomNav />
    </main>
  )
}

// ── 커뮤니티: 제도·복지 소식 (매거진) ──
interface ArticleRow {
  id: string
  category: string
  title: string
  summary: string
  cover_url: string | null
  published_at: string | null
  checked_at: string | null
}

function Community() {
  const [rows, setRows] = useState<ArticleRow[] | null>(null)
  const [cat, setCat] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    supabase
      .from('articles')
      .select(ARTICLE_LIST_FIELDS)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(60)
      .then(({ data, error }) => alive && setRows(error ? [] : ((data as ArticleRow[]) ?? [])))
    return () => {
      alive = false
    }
  }, [])

  const shown = useMemo(() => (rows ?? []).filter((r) => !cat || r.category === cat), [rows, cat])
  const usedCats = useMemo(() => ARTICLE_CATEGORIES.filter((c) => (rows ?? []).some((r) => r.category === c)), [rows])

  return (
    <section className="pb-6">
      <div className="px-5 pt-5">
        <p className="text-[14px] font-semibold" style={{ color: GREEN_DARK }}>
          물리치료사·사회복지사가 정리했어요
        </p>
        <h2 className="text-[20px] font-extrabold text-gray-900 mt-0.5">제도·복지 소식</h2>
      </div>

      {usedCats.length > 1 && (
        <div className="px-5 pt-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <Pill label="전체" active={!cat} onClick={() => setCat(null)} />
          {usedCats.map((c) => (
            <Pill key={c} label={c} active={cat === c} onClick={() => setCat(c)} />
          ))}
        </div>
      )}

      <div className="px-5 pt-4 space-y-3">
        {rows === null ? (
          [0, 1, 2].map((i) => <div key={i} className="h-[112px] rounded-2xl bg-white animate-pulse" />)
        ) : shown.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center">
            <p className="text-[17px] font-bold text-gray-900">첫 소식을 준비하고 있어요</p>
            <p className="text-[15px] text-gray-500 mt-1">그동안 서식자료와 자가진단을 둘러보세요.</p>
          </div>
        ) : (
          shown.map((a) => (
            <Link key={a.id} href={`/magazine/${a.id}`} className="flex gap-3.5 rounded-2xl bg-white border border-gray-100 p-3.5 active:scale-[0.99] transition-all">
              <span className="w-[88px] h-[88px] rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: GREEN_LIGHT }}>
                {a.cover_url ? (
                  <img src={a.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-[13px] font-bold px-2 text-center" style={{ color: GREEN_DARK }}>
                    {a.category}
                  </span>
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="inline-block text-[12px] font-bold px-2 py-0.5 rounded-md" style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
                  {a.category}
                </span>
                <span className="block text-[16px] font-bold text-gray-900 leading-snug mt-1 line-clamp-2">{a.title}</span>
                <span className="block text-[13px] text-gray-400 mt-1">{formatDate(a.published_at)}</span>
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  )
}

// ── 서식자료 ──
function Forms() {
  const [cat, setCat] = useState<FormCategory | null>(null)
  const list = FORMS.filter((f) => !cat || f.category === cat)
  return (
    <section className="pb-6">
      <div className="px-5 pt-5">
        <h2 className="text-[20px] font-extrabold text-gray-900">장기요양 공식 서식 {FORMS.length}종</h2>
        <p className="text-[14px] text-gray-500 mt-1">서식마다 언제 쓰는지 쉬운 말로 적어 두었어요.</p>
      </div>
      <div className="px-5 pt-3 flex flex-wrap gap-2">
        <Pill label="전체" active={!cat} onClick={() => setCat(null)} />
        {FORM_CATEGORIES.map((c) => (
          <Pill key={c.key} label={c.label} active={cat === c.key} onClick={() => setCat(c.key)} />
        ))}
      </div>
      <ul className="px-5 pt-4 flex flex-col gap-3">
        {list.map((f) => (
          <FormCard key={f.id} form={f} />
        ))}
      </ul>
      <p className="px-5 pt-4 text-[13px] text-gray-400 leading-relaxed">
        서식은 바뀔 수 있어요. 내기 전에 공단(1577-1000)이나 국가법령정보센터에서 최신본인지 확인해 주세요. HWP·HWPX는 한컴오피스 뷰어로 열 수 있어요.
      </p>
    </section>
  )
}

// ── 자가진단 ──
function Checks() {
  const fall = parseLastResult(useLocalStorageItem(LAST_RESULT_KEYS.fall))
  const ltc = parseLastResult(useLocalStorageItem(LAST_RESULT_KEYS.ltc))
  const cost = parseLastResult(useLocalStorageItem(LAST_RESULT_KEYS.cost))
  const cards = [
    { href: '/check/fall', title: '넘어질 위험 체크', sub: '낙상 위험 12가지 질문 + 집 안 점검', last: fall },
    { href: '/check/ltc', title: '장기요양등급 예상', sub: '1~5등급·인지지원등급 범위와 신청 방법', last: ltc },
    { href: '/check/cost', title: '돌봄 비용 모의 계산', sub: '방문요양·주야간보호·요양원 한 달 비용', last: cost },
  ]
  return (
    <section className="pb-6">
      <div className="px-5 pt-5">
        <h2 className="text-[20px] font-extrabold text-gray-900">1분 자가진단</h2>
        <p className="text-[14px] text-gray-500 mt-1">설치 없이 바로, 결과는 이 기기에만 남아요.</p>
      </div>
      <div className="px-5 pt-4 space-y-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="block rounded-2xl bg-white border border-gray-100 p-5 active:scale-[0.99] transition-all">
            <span className="flex items-center gap-2">
              <span className="flex-1 text-[18px] font-bold text-gray-900">{c.title}</span>
              <span className="text-gray-300 text-xl" aria-hidden="true">
                ›
              </span>
            </span>
            <span className="block text-[14px] text-gray-500 mt-0.5">{c.sub}</span>
            {c.last && (
              <span className="inline-block mt-2 text-[13px] px-2.5 py-1 rounded-md bg-gray-100 text-gray-600">지난 결과: {c.last.summary}</span>
            )}
          </Link>
        ))}
      </div>
      <p className="px-5 pt-4 text-[13px] text-gray-400">자가진단은 참고용이에요. 진료나 공단의 공식 판정을 대신하지 않아요.</p>
    </section>
  )
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="shrink-0 min-h-[40px] px-3.5 rounded-full border text-[14px] font-semibold whitespace-nowrap"
      style={active ? { background: GREEN, borderColor: GREEN, color: '#fff' } : { background: '#fff', borderColor: '#E5E7EB', color: '#4B5563' }}
    >
      {label}
    </button>
  )
}
