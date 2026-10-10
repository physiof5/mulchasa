'use client'

// 관리자 — 매거진(둘러보기 > 커뮤니티 '제도·복지 소식') 쓰기·고치기·공개
// 블로그 글을 그대로 붙이지 말고, 앱용으로 짧게 다시 써 주세요(유사문서 위험).

import { useEffect, useState } from 'react'
import { ARTICLE_CATEGORIES, formatDate, type Article } from '@/lib/articles'

const GREEN = '#0A8A7B'

interface Draft {
  id?: string
  category: string
  title: string
  summary: string
  body: string
  cover_url: string
  sourcesText: string
  effective_date: string
  checked_at: string
  status: 'draft' | 'published'
}

const today = () => new Date().toISOString().slice(0, 10)
const empty = (): Draft => ({
  category: ARTICLE_CATEGORIES[0],
  title: '',
  summary: '',
  body: '',
  cover_url: '',
  sourcesText: '',
  effective_date: '',
  checked_at: today(),
  status: 'draft',
})

const toDraft = (a: Article): Draft => ({
  id: a.id,
  category: a.category,
  title: a.title,
  summary: a.summary,
  body: a.body,
  cover_url: a.cover_url ?? '',
  sourcesText: (a.sources ?? []).map((s) => `${s.label} | ${s.url}`).join('\n'),
  effective_date: a.effective_date ?? '',
  checked_at: a.checked_at ?? today(),
  status: a.status,
})

export default function AdminMagazine({ onAuthLost }: { onAuthLost: () => void }) {
  const [list, setList] = useState<Article[] | null>(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const res = await fetch('/api/admin-articles', { cache: 'no-store' })
    if (res.status === 401) return onAuthLost()
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(j.error || '목록을 불러오지 못했어요')
      setList([])
      return
    }
    setError('')
    setList(j.articles ?? [])
  }

  useEffect(() => {
    let alive = true
    fetch('/api/admin-articles', { cache: 'no-store' })
      .then(async (res) => {
        if (!alive) return
        if (res.status === 401) return onAuthLost()
        const j = await res.json().catch(() => ({}))
        if (!res.ok) setError(j.error || '목록을 불러오지 못했어요')
        setList(j.articles ?? [])
      })
      .catch(() => alive && setList([]))
    return () => {
      alive = false
    }
  }, [onAuthLost])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  const upload = async (file: File) => {
    setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin-articles/upload', { method: 'POST', body: fd })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return alert(j.error || '이미지를 올리지 못했어요')
    set('cover_url', j.url)
  }

  const save = async (status: 'draft' | 'published') => {
    if (!draft) return
    setBusy(true)
    const sources = draft.sourcesText
      .split('\n')
      .map((l) => l.split('|').map((x) => x.trim()))
      .filter((p) => p.length >= 2 && p[1])
      .map(([label, url]) => ({ label, url }))
    const res = await fetch('/api/admin-articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, sources, status }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.status === 401) return onAuthLost()
    if (!res.ok) return alert(j.error || '저장하지 못했어요')
    alert(status === 'published' ? '공개했어요. 둘러보기 > 커뮤니티에 보여요.' : '임시 저장했어요.')
    setDraft(null)
    load()
  }

  const remove = async (a: Article) => {
    if (!confirm(`'${a.title}' 글을 지울까요? 되돌릴 수 없어요.`)) return
    const res = await fetch(`/api/admin-articles?id=${a.id}`, { method: 'DELETE' })
    if (!res.ok) return alert('삭제하지 못했어요')
    load()
  }

  if (draft) {
    const input = 'w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]'
    return (
      <div className="px-5 py-4 space-y-4">
        <button onClick={() => setDraft(null)} className="text-sm text-gray-500">
          ← 목록으로
        </button>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-bold text-gray-700">
            분류
            <select value={draft.category} onChange={(e) => set('category', e.target.value)} className={input + ' mt-1'}>
              {ARTICLE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-gray-700">
            시행일 (선택)
            <input type="date" value={draft.effective_date} onChange={(e) => set('effective_date', e.target.value)} className={input + ' mt-1'} />
          </label>
        </div>
        <label className="block text-sm font-bold text-gray-700">
          제목
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} maxLength={120} className={input + ' mt-1'} placeholder="예: 2026년 장기요양 월 한도액, 한눈에 보기" />
        </label>
        <label className="block text-sm font-bold text-gray-700">
          한 줄 요약
          <textarea value={draft.summary} onChange={(e) => set('summary', e.target.value)} maxLength={300} rows={2} className={input + ' mt-1 resize-none'} />
        </label>
        <label className="block text-sm font-bold text-gray-700">
          본문
          <span className="block text-xs font-normal text-gray-400 mt-0.5">빈 줄 = 문단 나눔 · &apos;## &apos; 소제목 · &apos;- &apos; 목록 · &apos;&gt; &apos; 알림 상자</span>
          <textarea value={draft.body} onChange={(e) => set('body', e.target.value)} rows={16} className={input + ' mt-1 font-mono text-[13px]'} />
        </label>
        <div>
          <p className="text-sm font-bold text-gray-700">대표 이미지 (선택)</p>
          {draft.cover_url && <img src={draft.cover_url} alt="" className="mt-2 w-full max-h-48 object-cover rounded-xl" />}
          <div className="flex gap-2 mt-2">
            <label className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold cursor-pointer">
              {busy ? '올리는 중...' : '이미지 올리기'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {draft.cover_url && (
              <button onClick={() => set('cover_url', '')} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">
                빼기
              </button>
            )}
          </div>
        </div>
        <label className="block text-sm font-bold text-gray-700">
          근거 링크 (한 줄에 하나: 이름 | 주소)
          <textarea
            value={draft.sourcesText}
            onChange={(e) => set('sourcesText', e.target.value)}
            rows={3}
            className={input + ' mt-1 font-mono text-[13px]'}
            placeholder="보건복지부 고시 제2025-247호 | https://..."
          />
        </label>
        <label className="block text-sm font-bold text-gray-700">
          최종 확인일
          <input type="date" value={draft.checked_at} onChange={(e) => set('checked_at', e.target.value)} className={input + ' mt-1'} />
        </label>
        <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3 leading-relaxed">
          블로그 글을 그대로 붙이면 네이버에서 유사문서로 볼 수 있어요. 앱용으로 짧게 다시 써 주세요. &apos;치료·완치·효과 보장&apos; 같은 표현은 쓰지 않아요.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button disabled={busy || !draft.title.trim()} onClick={() => save('draft')} className="py-3 rounded-xl border border-gray-200 font-bold text-sm disabled:opacity-40">
            임시 저장
          </button>
          <button disabled={busy || !draft.title.trim()} onClick={() => save('published')} className="py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40" style={{ background: GREEN }}>
            공개하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 py-4">
      <button onClick={() => setDraft(empty())} className="w-full py-3 rounded-xl text-white font-bold text-sm mb-4" style={{ background: GREEN }}>
        + 새 글 쓰기
      </button>
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      {list === null ? (
        <p className="text-center text-gray-400 py-12">불러오는 중...</p>
      ) : list.length === 0 ? (
        <p className="text-center text-gray-400 py-12">아직 글이 없어요</p>
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className="border border-gray-200 rounded-xl p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">
                  {a.category} · {a.status === 'published' ? `공개 ${formatDate(a.published_at)}` : '임시 저장'}
                </p>
                <p className="font-bold text-gray-900 mt-0.5">{a.title}</p>
              </div>
              {a.status === 'published' && (
                <a href={`/magazine/${a.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#0A8A7B] underline shrink-0 mt-1">
                  보기
                </a>
              )}
              <button onClick={() => setDraft(toDraft(a))} className="text-xs font-bold text-gray-600 shrink-0 mt-1">
                고치기
              </button>
              <button onClick={() => remove(a)} className="text-xs text-red-500 shrink-0 mt-1">
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
