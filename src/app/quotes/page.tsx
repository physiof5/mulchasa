'use client'

// 하단 탭 '받은 견적'
// · 보호자: 내가 보낸 상담 요청과 수락한 전문가 현황 (3단계에서 방문 PT 견적이 함께 모임)
// · 승인된 전문가: '받은 요청' — 내 활동 지역 근처 상담 요청 (구독 중이면 수락, 아니면 열람만)

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuthUser } from '@/lib/auth'
import BottomNav from '@/components/BottomNav'
import { GuardianAvatar, StateChip, LoginNeeded, Spinner, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'
import {
  MAX_ACCEPT, CONTACT_EMAIL, consultTitle, ageText, fetchMyExpert, isExpired, shortConditions, shortMobility, timeAgo, untilLabel,
  type ConsultRow, type MyExpert,
} from '@/lib/consult'

interface FeedRow extends ConsultRow {
  distance_km: number | null
  my_room_id: string | null
}

export default function QuotesPage() {
  const user = useAuthUser()
  const [expert, setExpert] = useState<MyExpert | null | undefined>(undefined)

  useEffect(() => {
    if (!user) return
    let alive = true
    fetchMyExpert().then((e) => alive && setExpert(e))
    return () => {
      alive = false
    }
  }, [user])

  const isExpert = !!expert?.verified
  const title = isExpert ? '받은 요청' : '받은 견적'

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-3 flex items-center">
        <h1 className="flex-1 text-[22px] font-extrabold text-gray-900">{title}</h1>
        <Link href="/mypage" aria-label="내 프로필" className="w-12 h-12 -mr-2 flex items-center justify-center text-gray-700">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
            <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      {user === null ? (
        <LoginNeeded
          title={'로그인하면 보낸 요청과\n받은 견적을 볼 수 있어요'}
          desc={`부모님 상태를 알려 주면 가까운 전문가 최대 ${MAX_ACCEPT}명이 수락하고 채팅으로 무료 상담해요.`}
          next="/quotes"
        />
      ) : user === undefined || expert === undefined ? (
        <Spinner />
      ) : isExpert ? (
        <ExpertTabs expert={expert!} />
      ) : (
        <>
          {expert && !expert.verified && (
            <p className="mx-5 mt-4 rounded-xl px-4 py-3 text-[14px] leading-relaxed" style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
              전문가 승인이 끝나면 이 탭에서 근처 상담 요청을 받아 볼 수 있어요.
            </p>
          )}
          <MyRequests />
        </>
      )}
      <BottomNav />
    </main>
  )
}

// ── 보호자: 내가 보낸 요청 ──
function MyRequests() {
  const [rows, setRows] = useState<ConsultRow[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    return supabase
      .from('consult_requests')
      .select('id, answers, note, area_label, status, accepted_count, created_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error: e }) => {
        setError(!!e)
        setRows((data as ConsultRow[]) ?? [])
      })
  }, [])

  useEffect(() => {
    let alive = true
    const run = () => alive && load()
    run()
    window.addEventListener('focus', run)
    return () => {
      alive = false
      window.removeEventListener('focus', run)
    }
  }, [load])

  return (
    <section className="pb-6">
      <div className="px-5 pt-5">
        <Link
          href="/consult/new"
          className="flex items-center gap-3 rounded-2xl p-4 text-white active:scale-[0.99] transition-all"
          style={{ background: GREEN }}
        >
          <span className="flex-1 min-w-0">
            <span className="block text-[18px] font-extrabold">무료 상담 요청하기</span>
            <span className="block text-[14px] opacity-90 mt-0.5">부모님 상태를 고르면 전문가가 채팅으로 답해요</span>
          </span>
          <span className="text-[24px]" aria-hidden="true">
            ›
          </span>
        </Link>
      </div>

      <h2 className="px-5 pt-6 text-[18px] font-bold text-gray-900">내 상담 요청</h2>
      <div className="px-5 pt-3 space-y-3">
        {rows === null ? (
          [0, 1].map((i) => <div key={i} className="h-[120px] rounded-2xl bg-white animate-pulse" />)
        ) : error ? (
          <p className="rounded-2xl bg-white border border-gray-100 p-5 text-[15px] text-gray-500">상담 요청을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center">
            <p className="text-[17px] font-bold text-gray-900">아직 보낸 요청이 없어요</p>
            <p className="text-[15px] text-gray-500 mt-1">요청을 보내면 진행 상황이 여기에 보여요.</p>
          </div>
        ) : (
          rows.map((r) => (
            <Link key={r.id} href={`/consult/${r.id}`} className="block rounded-2xl bg-white border border-gray-100 p-4 active:scale-[0.99] transition-all">
              <div className="flex items-center gap-2">
                <p className="flex-1 min-w-0 text-[17px] font-extrabold text-gray-900 truncate">
                  {consultTitle(r.answers)} <span className="text-[14px] font-semibold text-gray-500">({ageText(r.answers.age)})</span>
                </p>
                <StateChip row={r} />
              </div>
              <p className="text-[14px] text-gray-600 mt-1.5 truncate">{[shortMobility(r.answers), ...shortConditions(r.answers)].join(' · ')}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="flex gap-1" aria-hidden="true">
                  {Array.from({ length: MAX_ACCEPT }, (_, i) => (
                    <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: i < r.accepted_count ? GREEN : '#E5E7EB' }} />
                  ))}
                </span>
                <span className="text-[14px] text-gray-600 flex-1">
                  전문가 {r.accepted_count}명 수락 · {r.area_label}
                </span>
                <span className="text-[13px] text-gray-400 shrink-0">{timeAgo(r.created_at)}</span>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="mx-5 mt-6 rounded-2xl border border-dashed border-gray-300 p-4">
        <p className="text-[16px] font-bold text-gray-700">방문 PT 견적은 준비 중이에요</p>
        <p className="text-[14px] text-gray-500 mt-1 leading-relaxed">곧 요청서 하나로 가까운 전문가들의 10회 기준 견적을 이곳에서 비교할 수 있어요.</p>
      </div>
    </section>
  )
}

// ── 전문가: 받은 요청 / 내가 보낸 요청 ──
function ExpertTabs({ expert }: { expert: MyExpert }) {
  const [tab, setTab] = useState<'inbox' | 'mine'>('inbox')
  return (
    <>
      <div className="bg-white px-5 flex gap-5 border-b border-gray-100" role="tablist">
        {(
          [
            ['inbox', '받은 요청'],
            ['mine', '내가 보낸 요청'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className="relative min-h-[48px] text-[16px] font-bold"
            style={{ color: tab === k ? '#111827' : '#9CA3AF' }}
          >
            {label}
            {tab === k && <span className="absolute left-0 right-0 bottom-0 h-[3px] rounded-full" style={{ background: GREEN }} />}
          </button>
        ))}
      </div>
      {tab === 'inbox' ? <Inbox expert={expert} /> : <MyRequests />}
    </>
  )
}

type Filter = 'all' | 'can' | 'mine'

function Inbox({ expert }: { expert: MyExpert }) {
  const [rows, setRows] = useState<FeedRow[] | null>(null)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let alive = true
    const run = () =>
      supabase.rpc('consult_feed').then(({ data, error: e }) => {
        if (!alive) return
        setError(!!e)
        setRows(Array.isArray(data) ? (data as FeedRow[]) : [])
      })
    run()
    window.addEventListener('focus', run)
    const timer = window.setInterval(run, 60_000)
    return () => {
      alive = false
      window.removeEventListener('focus', run)
      window.clearInterval(timer)
    }
  }, [])

  const canAccept = (r: FeedRow) => !r.my_room_id && r.status === 'open' && r.accepted_count < MAX_ACCEPT && !isExpired(r)
  const shown = (rows ?? []).filter((r) => (filter === 'all' ? true : filter === 'can' ? canAccept(r) : !!r.my_room_id))

  return (
    <section className="pb-6">
      <div className="px-5 pt-4">
        {expert.subscribed ? (
          <p className="rounded-xl px-4 py-3 text-[14px] leading-relaxed" style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
            <b>구독 중</b>
            {expert.subscribed_until ? ` · ${untilLabel(expert.subscribed_until)}까지` : ''} — 요청서 1건에 전문가 {MAX_ACCEPT}명까지 수락할 수 있어요.
          </p>
        ) : (
          <div className="rounded-xl px-4 py-3" style={{ background: '#FFF8E6', border: '1px solid #FDE68A' }}>
            <p className="text-[15px] font-bold text-amber-900">구독하면 요청을 수락하고 채팅할 수 있어요</p>
            <p className="text-[13px] text-amber-900/80 mt-0.5 leading-relaxed">
              지금은 요청 내용만 볼 수 있어요. 시범 기간에는 운영팀이 구독을 켜 드려요 ({CONTACT_EMAIL}).
            </p>
          </div>
        )}
      </div>

      <div className="px-5 pt-3 flex gap-2">
        {(
          [
            ['all', '전체'],
            ['can', '수락 가능'],
            ['mine', '내가 수락'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className="min-h-[40px] px-4 rounded-full border text-[14px] font-semibold"
            style={filter === k ? { background: '#1F2937', borderColor: '#1F2937', color: '#fff' } : { background: '#fff', borderColor: '#E5E7EB', color: '#4B5563' }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-5 pt-3 space-y-3">
        {rows === null ? (
          [0, 1, 2].map((i) => <div key={i} className="h-[128px] rounded-2xl bg-white animate-pulse" />)
        ) : error ? (
          <p className="rounded-2xl bg-white border border-gray-100 p-5 text-[15px] text-gray-500">요청을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center">
            <p className="text-[17px] font-bold text-gray-900">{filter === 'mine' ? '아직 수락한 요청이 없어요' : '아직 근처에 새 요청이 없어요'}</p>
            <p className="text-[15px] text-gray-500 mt-1 leading-relaxed">
              활동 지역(이동 거리, 최소 20km) 안의 요청이 여기에 모여요. 프로필을 채워 두면 보호자가 전문가 찾기에서도 찾아요.
            </p>
            <Link href="/mypage" className="mt-4 inline-flex min-h-[48px] px-5 rounded-xl items-center text-[15px] font-bold border" style={{ borderColor: GREEN, color: GREEN_DARK }}>
              내 프로필 보기
            </Link>
          </div>
        ) : (
          shown.map((r) => (
            <Link key={r.id} href={`/consult/${r.id}`} className="block rounded-2xl bg-white border border-gray-100 p-4 active:scale-[0.99] transition-all">
              <div className="flex items-start gap-3">
                <GuardianAvatar size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 min-w-0 text-[17px] font-extrabold text-gray-900 truncate">
                      {consultTitle(r.answers)} <span className="text-[14px] font-semibold text-gray-500">({ageText(r.answers.age)})</span>
                    </p>
                    {r.my_room_id ? (
                      <span className="inline-flex items-center min-h-[26px] px-2.5 rounded-md text-[13px] font-bold" style={{ background: GREEN, color: '#fff' }}>
                        수락함
                      </span>
                    ) : (
                      <StateChip row={r} />
                    )}
                  </div>
                  <p className="text-[14px] text-gray-600 mt-1 truncate">{[shortMobility(r.answers), ...shortConditions(r.answers)].join(' · ')}</p>
                  {r.note && <p className="text-[14px] text-gray-500 mt-1 line-clamp-2">&ldquo;{r.note}&rdquo;</p>}
                  <p className="text-[13px] text-gray-400 mt-2">
                    {r.area_label}
                    {r.distance_km != null ? ` · 약 ${r.distance_km}km` : ''} · {timeAgo(r.created_at)}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
      <p className="px-5 pt-4 text-[13px] text-gray-400 leading-relaxed">
        요청은 {MAX_ACCEPT}명이 수락하거나 보호자가 마감하면 더 받을 수 없어요. 열람만 할 때도 내용은 상담 목적에만 써 주세요.
      </p>
    </section>
  )
}
