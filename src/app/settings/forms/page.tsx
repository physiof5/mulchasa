// 서식자료실 — 장기요양 관련 공식 서식을 아이콘 목록으로 보여 주고 바로 내려받게 한다.
// 파일은 public/forms 에 있고, 내려받을 때는 알아보기 쉬운 한글 파일 이름으로 저장된다.

import type { Metadata } from 'next'
import Link from 'next/link'
import { LINKS, PHONES } from '@/lib/care'
import { FORMS, FORM_CATEGORIES, FORMS_SOURCE, WRITER_LABEL, type FormCategory, type FormItem } from '@/lib/forms'

export const metadata: Metadata = {
  title: '서식자료실',
  description: '장기요양인정 신청서, 의사소견서, 본인부담금 감경신청서 등 장기요양 공식 서식을 쉬운 설명과 함께 내려받으세요.',
}

const GREEN_DARK = '#0F6E56'
const LAW_HOME = 'https://www.law.go.kr'
const tel = (n: string) => `tel:${n.replace(/-/g, '')}`

const TYPE_STYLE: Record<FormItem['type'], { label: string; color: string; bg: string }> = {
  pdf: { label: 'PDF', color: '#C2410C', bg: '#FFF1E8' },
  hwp: { label: 'HWP', color: '#1D4ED8', bg: '#EAF1FF' },
  hwpx: { label: 'HWPX', color: '#1D4ED8', bg: '#EAF1FF' },
}

const isCategory = (v: unknown): v is FormCategory => FORM_CATEGORIES.some((c) => c.key === v)

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const raw = (await searchParams).cat
  const cat = isCategory(raw) ? raw : null
  const groups = FORM_CATEGORIES.filter((c) => !cat || c.key === cat).map((c) => ({
    ...c,
    items: FORMS.filter((f) => f.category === c.key),
  }))

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="px-4 py-2 flex items-center gap-1">
          <Link href="/settings" aria-label="설정으로" className="w-12 h-12 -ml-2 flex items-center justify-center text-gray-500">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="text-[18px] font-bold text-gray-900">서식자료실</h1>
        </div>
      </div>

      {/* 분류 고르기 — 고른 분류가 가려지지 않게 줄바꿈으로 모두 보여 준다 */}
      <nav aria-label="서식 분류" className="bg-white flex flex-wrap gap-2 px-4 pt-3 pb-4 border-b border-gray-100">
        <CategoryChip href="/settings/forms" label={`전체 ${FORMS.length}`} active={!cat} />
        {FORM_CATEGORIES.map((c) => (
          <CategoryChip
            key={c.key}
            href={`/settings/forms?cat=${c.key}`}
            label={`${c.label} ${FORMS.filter((f) => f.category === c.key).length}`}
            active={cat === c.key}
          />
        ))}
      </nav>

      <section className="px-5 pt-5">
        <div className="rounded-2xl bg-white border border-gray-100 p-4">
          <p className="text-[16px] font-bold text-gray-900">장기요양 공식 서식을 모았어요</p>
          <ul className="mt-1.5 space-y-1 text-[15px] text-gray-600 leading-relaxed">
            <li>· 서식마다 언제 쓰는지 쉬운 말로 적어 두었어요.</li>
            <li>· 서식은 바뀔 수 있어요. 내기 전에 공단이나 국가법령정보센터에서 최신본인지 확인해 주세요.</li>
            <li>· HWP·HWPX 파일은 한글(한컴오피스)이나 무료 &lsquo;한컴오피스 뷰어&rsquo; 앱으로 열 수 있어요.</li>
          </ul>
        </div>
      </section>

      {groups.map((g) => (
        <section key={g.key} className="px-5 pt-6">
          <h2 className="text-[17px] font-extrabold text-gray-900 mb-2.5">
            {g.label} <span className="text-[15px] font-semibold text-gray-400">{g.items.length}</span>
          </h2>
          <ul className="flex flex-col gap-3">
            {g.items.map((f) => (
              <FormCard key={f.id} form={f} />
            ))}
          </ul>
        </section>
      ))}

      <section className="px-5 pt-7">
        <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          <ExternalRow href={LINKS.ltcHome} title="노인장기요양보험 누리집" sub="온라인 신청·민원서식" />
          <ExternalRow href={LAW_HOME} title="국가법령정보센터" sub="최신 서식 찾아보기" />
          <a href={tel(PHONES.nhis.number)} className="flex items-center gap-3 px-4 py-3 min-h-[60px]">
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-bold text-gray-900">국민건강보험공단 {PHONES.nhis.number}</span>
              <span className="block text-[14px] text-gray-500 mt-0.5">어떤 서식이 필요한지 모르겠을 때</span>
            </span>
            <span className="text-gray-300 text-xl" aria-hidden="true">
              ›
            </span>
          </a>
        </div>
        <p className="text-[13px] text-gray-400 mt-3 leading-relaxed">출처: {FORMS_SOURCE}</p>
      </section>
    </main>
  )
}

function CategoryChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="min-h-[44px] px-4 rounded-full border text-[15px] font-semibold flex items-center whitespace-nowrap"
      style={active ? { background: '#0A8A7B', borderColor: '#0A8A7B', color: '#fff' } : { background: '#fff', borderColor: '#E5E7EB', color: '#4B5563' }}
    >
      {label}
    </Link>
  )
}

function FileIcon({ type }: { type: FormItem['type'] }) {
  const s = TYPE_STYLE[type]
  return (
    <span className="relative w-12 h-14 shrink-0" aria-hidden="true">
      <svg width="48" height="56" viewBox="0 0 48 56" fill="none">
        <path d="M6 2h25l15 15v33a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z" fill={s.bg} stroke={s.color} strokeWidth="2" />
        <path d="M31 2v11a4 4 0 0 0 4 4h11" stroke={s.color} strokeWidth="2" />
      </svg>
      <span className="absolute inset-x-0 bottom-2.5 text-center text-[11px] font-extrabold tracking-tight" style={{ color: s.color }}>
        {s.label}
      </span>
    </span>
  )
}

function FormCard({ form: f }: { form: FormItem }) {
  const href = `/forms/${f.file}`
  const meta = [TYPE_STYLE[f.type].label, f.pages ? `${f.pages}쪽` : null, `${f.sizeKb}KB`].filter(Boolean).join(' · ')
  return (
    <li className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start gap-3">
        <FileIcon type={f.type} />
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-bold text-gray-900 leading-snug">{f.title}</p>
          <p className="text-[13px] text-gray-400 mt-0.5 leading-snug">{f.official}</p>
          <span className="inline-block mt-1.5 text-[13px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
            {WRITER_LABEL[f.writer]}
          </span>
        </div>
      </div>
      <p className="text-[15px] text-gray-700 leading-relaxed mt-3">{f.summary}</p>
      {f.submitTo && <p className="text-[14px] text-gray-500 mt-1.5">제출: {f.submitTo}</p>}
      <div className={'mt-3 grid gap-2 ' + (f.type === 'pdf' ? 'grid-cols-2' : 'grid-cols-1')}>
        {f.type === 'pdf' && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[48px] rounded-xl border border-gray-200 bg-white text-[16px] font-semibold text-gray-700 flex items-center justify-center"
          >
            열어 보기
          </a>
        )}
        <a
          href={href}
          download={f.downloadName}
          className="min-h-[48px] rounded-xl border text-[16px] font-bold flex items-center justify-center gap-1.5"
          style={{ borderColor: '#CFE7E2', color: GREEN_DARK, background: '#F6FBFA' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          내려받기
        </a>
      </div>
      <p className="text-[13px] text-gray-400 mt-2 text-right">{meta}</p>
    </li>
  )
}

function ExternalRow({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 min-h-[60px]">
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-bold text-gray-900">{title}</span>
        <span className="block text-[14px] text-gray-500 mt-0.5">{sub}</span>
      </span>
      <span className="text-gray-300 text-xl" aria-hidden="true">
        ↗
      </span>
    </a>
  )
}
