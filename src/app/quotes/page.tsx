'use client'

// 하단 탭 — 모드마다 다르게
// · 회원 모드 '받은 견적': [받은 견적] 내 요청을 수락한 전문가들(3단계에서 방문 PT 견적도 여기에) / [내가 보낸 요청]
// · 전문가 모드 '받은 요청': 내 활동 지역 근처 상담 요청만 (구독 중이면 수락, 아니면 열람만)

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuthUser } from '@/lib/auth'
import BottomNav from '@/components/BottomNav'
import { PushPrompt } from '@/components/PushPrompt'
import { setDeviceItem } from '@/lib/useDeviceStorage'
import { useAppMode } from '@/lib/mode'
import { Avatar, GuardianAvatar, StateChip, LoginNeeded, Spinner, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'
import {
  MAX_ACCEPT, CONTACT_EMAIL, INBOX_SEEN_KEY, consultTitle, ageText, isExpired, listTime, shortConditions, shortMobility, timeAgo, untilLabel,
  type ConsultAnswers, type ConsultRow, type MyExpert,
} from '@/lib/consult'

interface FeedRow extends ConsultRow {
  distance_km: number | null
  my_room_id: string | null
}

export default function QuotesPage() {
  const user = useAuthUser()
  const { mode, ready, expert } = useAppMode()
  const isExpertMode = mode === 'expert'

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-3 flex items-center">
        <h1 className="flex-1 text-[22px] font-extrabold text-gray-900">{isExpertMode ? '받은 요청' : '받은 견적'}</h1>
        <Link href="/mypage" aria-label="내 프로필" className="w-12 h-12 -mr-2 flex items-center justify-center text-gray-700">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
            <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      {user === null ? (
        <LoginNeeded
          title={'로그인하면 받은 견적과\n보낸 요청을 볼 수 있어요'}
          desc={`몸 상태를 알려 주면 가까운 전문가 최대 ${MAX_ACCEPT}명이 수락하고 채팅으로 무료 상담해요.`}
          next="/quotes"
        />
      ) : user === undefined || !ready ? (
        <Spinner />
      ) : isExpertMode && expert ? (
        expert.verified ? (
          <Inbox expert={expert} />
        ) : (
          <p className="mx-5 mt-5 rounded-xl px-4 py-4 text-[15px] leading-relaxed" style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
            면허 확인이 끝나면 이 탭에서 근처 상담 요청을 받아 볼 수 있어요. 그동안 프로필을 채워 두세요.
          </p>
        )
      ) : (
        <MemberTabs />
      )}
      <BottomNav />
    </main>
  )
}

// ── 회원: [받은 견적] / [내가 보낸 요청] ──
function MemberTabs() {
  const [tab, setTab] = useState<'received' | 'sent'>('received')
  return (
    <>
      <div className="bg-white px-5 flex gap-5 border-b border-gray-100" role="tablist">
        {(
          [
            ['received', '받은 견적'],
            ['sent', '내가 보낸 요청'],
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
      {tab === 'received' ? <Received onGoSent={() => setTab('sent')} /> : <MyRequests />}
    </>
  )
}

function NewRequestCta() {
  return (
    <div className="px-5 pt-5">
      <Link href="/consult/new" className="flex items-center gap-3 rounded-2xl p-4 text-white active:scale-[0.99] transition-all" style={{ background: GREEN }}>
        <span className="flex-1 min-w-0">
          <span className="block text-[18px] font-extrabold">무료 상담 요청하기</span>
          <span className="block text-[14px] opacity-90 mt-0.5">몸 상태를 고르면 가까운 전문가가 채팅으로 답해요</span>
        </span>
        <span className="text-[24px]" aria-hidden="true">
          ›
        </span>
      </Link>
    </div>
  )
}

interface ReceivedRoom {
  id: string
  role: 'guardian' | 'expert'
  therapist: { id: string; name: string; photo: string | null; years: number | null }
  consult: { id: string; who: ConsultAnswers['who']; age: ConsultAnswers['age']; area_label: string } | null
  last_message: string
  last_message_at: string
  unread: number
  blocked: boolean
}

// 받은 견적: 내 상담 요청을 수락한 전문가들 (3단계에서 방문 PT 견적도 여기에)
function Received({ onGoSent }: { onGoSent: () => void }) {
  const [rooms, setRooms] = useState<ReceivedRoom[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    const run = () =>
      supabase.rpc('my_chat_rooms').then(({ data, error: e }) => {
        if (!alive) return
        setError(!!e)
        setRooms(Array.isArray(data) ? (data as ReceivedRoom[]).filter((r) => r.role === 'guardian') : [])
      })
    run()
    window.addEventListener('focus', run)
    return () => {
      alive = false
      window.removeEventListener('focus', run)
    }
  }, [])

  return (
    <section className="pb-6">
      <NewRequestCta />
      <div className="px-5 pt-5 space-y-3">
        {rooms === null ? (
          [0, 1].map((i) => <div key={i} className="h-[150px] rounded-2xl bg-white animate-pulse" />)
        ) : error ? (
          <p className="rounded-2xl bg-white border border-gray-100 p-5 text-[15px] text-gray-500">받은 견적을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center">
            <p className="text-[17px] font-bold text-gray-900">아직 받은 견적이 없어요</p>
            <p className="text-[15px] text-gray-500 mt-1 leading-relaxed">상담 요청을 보내면 수락한 전문가가 여기에 모여요.</p>
            <button type="button" onClick={onGoSent} className="mt-4 inline-flex min-h-[48px] px-5 rounded-xl items-center text-[15px] font-bold border" style={{ borderColor: GREEN, color: GREEN_DARK }}>
              내가 보낸 요청 보기
            </button>
          </div>
        ) : (
          rooms.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <Avatar src={r.therapist.photo} name={r.therapist.name} size={52} />
                <div className="flex-1 min-w-0">
                  <p className="text-[17px] font-extrabold text-gray-900 truncate">{r.therapist.name}</p>
                  <p className="text-[14px] text-gray-500 truncate">
                    물리치료사{r.therapist.years ? ` · 경력 ${r.therapist.years}년` : ''}
                  </p>
                </div>
                <span className="text-[13px] text-gray-400 shrink-0">{listTime(r.last_message_at)}</span>
              </div>
              {r.consult && (
                <p className="mt-3 text-[14px] font-semibold" style={{ color: GREEN_DARK }}>
                  {consultTitle(r.consult)} 요청을 수락했어요 · {r.consult.area_label}
                </p>
              )}
              <p className="mt-1 text-[15px] text-gray-600 line-clamp-2">{r.blocked ? '차단된 대화예요' : r.last_message}</p>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <Link href={`/chat/${r.id}`} className="min-h-[48px] rounded-xl text-white text-[16px] font-bold flex items-center justify-center gap-2" style={{ background: GREEN }}>
                  채팅하기
                  {r.unread > 0 && <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#F04452] text-white text-[12px] font-bold flex items-center justify-center">{r.unread}</span>}
                </Link>
                <Link href={`/therapist/${r.therapist.id}`} className="min-h-[48px] px-4 rounded-xl border border-gray-200 text-[15px] font-semibold text-gray-600 flex items-center">
                  프로필
                </Link>
              </div>
            </div>
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

// ── 회원: 내가 보낸 요청 ──
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
      <NewRequestCta />
      <div className="px-5 pt-5 space-y-3">
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
    </section>
  )
}

// ── 전문가: 받은 요청 ──
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
        // 홈 '새 요청 n건'은 이 화면을 본 뒤에 온 요청만 센다
        if (!e) setDeviceItem(INBOX_SEEN_KEY, new Date().toISOString())
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

      <PushPrompt className="mx-5 mt-3" message="근처에 새 상담 요청이 오면 알림으로 알려 드릴까요?" />

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
              활동 지역(이동 거리, 최소 20km) 안의 요청이 여기에 모여요. 프로필을 채워 두면 회원이 전문가 찾기에서도 찾아요.
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
        요청은 {MAX_ACCEPT}명이 수락하거나 회원이 마감하면 더 받을 수 없어요. 열람만 할 때도 내용은 상담 목적에만 써 주세요.
      </p>
    </section>
  )
}
