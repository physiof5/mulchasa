'use client'

// 상담 요청서 한 건
// · 보호자(본인): 수락한 전문가(최대 3명)와 채팅 바로가기, 요청 마감·삭제
// · 전문가: 요청 내용 열람 → (구독 중 + 자리 있음) 수락하고 채팅 시작 / 3명이 차면 열람만

import { use, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthUser } from '@/lib/auth'
import {
  MAX_ACCEPT, CONTACT_EMAIL, consultTitle, ageText, friendlyError, isExpired, timeAgo, untilLabel, refreshNavBadges,
  type ConsultRow,
} from '@/lib/consult'
import { TopBar, Avatar, StateChip, AnswerList, LoginNeeded, Spinner, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'

interface AcceptedRoom {
  room_id: string
  therapist_id: string
  name: string
  years: number | null
  photo: string | null
  studio: string | null
  rating: number | null
  reviews: number
  last_message: string
  last_message_at: string
  unread: number
}

type View =
  | { role: 'owner'; consult: ConsultRow; rooms: AcceptedRoom[] }
  | { role: 'expert'; consult: ConsultRow; distance_km: number | null; my_room_id: string | null; subscribed: boolean }

export default function ConsultDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = use(params)
  const query = use(searchParams)
  const justSent = query.new === '1'
  const user = useAuthUser()
  const [view, setView] = useState<View | null | undefined>(undefined)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!user) return
    let alive = true
    supabase.rpc('get_consult', { p_id: id }).then(({ data, error }) => {
      if (!alive) return
      if (error) {
        setLoadError(friendlyError(error, '요청을 불러오지 못했어요.'))
        setView(null)
        return
      }
      setLoadError('')
      setView((data as View | null) ?? null)
    })
    return () => {
      alive = false
    }
  }, [user, id, reload])

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      <TopBar title={view?.role === 'expert' ? '받은 상담 요청' : '내 상담 요청'} backHref="/quotes" />
      {user === null ? (
        <LoginNeeded title={'로그인하면\n요청을 볼 수 있어요'} desc="상담 요청은 보낸 분과 연결된 전문가만 볼 수 있어요." next={`/consult/${id}`} />
      ) : view === undefined ? (
        <Spinner />
      ) : view === null ? (
        <NotFound message={loadError} />
      ) : view.role === 'owner' ? (
        <OwnerView view={view} justSent={justSent} onChanged={() => setReload((n) => n + 1)} />
      ) : (
        <ExpertView view={view} />
      )}
    </main>
  )
}

function NotFound({ message }: { message: string }) {
  return (
    <section className="px-6 pt-16 text-center">
      <p className="text-[19px] font-bold text-gray-900">요청을 볼 수 없어요</p>
      <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">
        {message || '삭제되었거나, 받는 기간이 끝났거나, 활동 지역 밖의 요청이에요.'}
      </p>
      <Link href="/quotes" className="mt-6 inline-flex min-h-[52px] px-6 rounded-xl text-white text-[16px] font-bold items-center" style={{ background: GREEN }}>
        목록으로
      </Link>
    </section>
  )
}

function Dots({ count }: { count: number }) {
  return (
    <span className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: MAX_ACCEPT }, (_, i) => (
        <span key={i} className="w-3 h-3 rounded-full" style={{ background: i < count ? GREEN : '#E5E7EB' }} />
      ))}
    </span>
  )
}

// ── 보호자 화면 ──
function OwnerView({ view, justSent, onChanged }: { view: Extract<View, { role: 'owner' }>; justSent: boolean; onChanged: () => void }) {
  const router = useRouter()
  const c = view.consult
  const [busy, setBusy] = useState(false)
  const open = c.status === 'open' && !isExpired(c)
  const full = c.accepted_count >= MAX_ACCEPT

  const close = async () => {
    if (!confirm('요청을 마감할까요? 더는 새 전문가가 수락할 수 없어요. 이미 시작한 채팅은 그대로 남아요.')) return
    setBusy(true)
    const { error } = await supabase.rpc('close_consult', { p_id: c.id })
    setBusy(false)
    if (error) return alert(friendlyError(error))
    onChanged()
  }

  const remove = async () => {
    if (!confirm('요청서를 지울까요? 이 요청으로 시작한 채팅도 함께 지워지고, 되돌릴 수 없어요.')) return
    setBusy(true)
    const { error } = await supabase.from('consult_requests').delete().eq('id', c.id)
    setBusy(false)
    if (error) return alert(friendlyError(error, '지우지 못했어요. 잠시 후 다시 시도해 주세요.'))
    refreshNavBadges()
    router.replace('/quotes')
  }

  return (
    <>
      {justSent && (
        <div className="mx-5 mt-4 rounded-2xl p-4" style={{ background: GREEN_LIGHT }}>
          <p className="text-[17px] font-extrabold" style={{ color: GREEN_DARK }}>
            요청을 보냈어요!
          </p>
          <p className="text-[15px] text-gray-700 mt-1 leading-relaxed">
            가까운 전문가가 수락하면 <b>채팅</b> 탭에 대화방이 생겨요. 이 화면은 <b>받은 견적</b> 탭에서 다시 볼 수 있어요.
          </p>
        </div>
      )}

      <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-5">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-[21px] font-extrabold text-gray-900">
            {consultTitle(c.answers)} <span className="text-[15px] font-semibold text-gray-500">({ageText(c.answers.age)})</span>
          </h1>
          <StateChip row={c} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Dots count={c.accepted_count} />
          <p className="text-[15px] text-gray-700">
            전문가 <b>{c.accepted_count}명</b> 수락 / 최대 {MAX_ACCEPT}명
          </p>
        </div>
        <p className="text-[14px] text-gray-500 mt-2">
          {c.status === 'closed'
            ? '마감한 요청이에요. 시작한 채팅은 그대로 이어갈 수 있어요.'
            : full
              ? `${MAX_ACCEPT}명이 모두 수락해서 더 받지 않아요.`
              : open
                ? `${untilLabel(c.expires_at)}까지 받아요 · ${timeAgo(c.created_at)} 보냄`
                : '받는 기간이 끝났어요.'}
        </p>
      </section>

      <section className="px-5 pt-6">
        <h2 className="text-[18px] font-bold text-gray-900 mb-3">수락한 전문가</h2>
        {view.rooms.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 p-5">
            <p className="text-[16px] font-bold text-gray-800">아직 수락한 전문가가 없어요</p>
            <p className="text-[15px] text-gray-500 mt-1 leading-relaxed">
              가까운 물리치료사에게 요청이 전달됐어요. 시범 기간이라 지역에 따라 시간이 걸릴 수 있어요. 그동안 직접 찾아볼 수도 있어요.
            </p>
            <Link
              href="/experts"
              className="mt-4 flex min-h-[48px] rounded-xl items-center justify-center text-[16px] font-bold border"
              style={{ borderColor: GREEN, color: GREEN_DARK }}
            >
              내 주변 전문가 둘러보기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {view.rooms.map((r) => (
              <div key={r.room_id} className="rounded-2xl bg-white border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <Avatar src={r.photo} name={r.name} size={56} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[17px] font-extrabold text-gray-900 truncate">{r.name}</p>
                    <p className="text-[14px] text-gray-500 truncate">물리치료사{r.years ? ` · 경력 ${r.years}년` : ''}</p>
                    <p className="text-[14px] text-gray-500 truncate">{r.reviews > 0 ? `★ ${Number(r.rating).toFixed(1)} · 후기 ${r.reviews}개` : '아직 후기가 없어요'}</p>
                  </div>
                  <Link href={`/therapist/${r.therapist_id}`} className="shrink-0 min-h-[40px] px-3 rounded-lg border border-gray-200 text-[14px] font-semibold text-gray-600 flex items-center">
                    프로필
                  </Link>
                </div>
                <Link
                  href={`/chat/${r.room_id}`}
                  className="mt-3 flex items-center gap-2 min-h-[52px] px-4 rounded-xl text-white"
                  style={{ background: GREEN }}
                >
                  <span className="flex-1 min-w-0 text-[15px] truncate opacity-90">{r.last_message || '채팅 시작하기'}</span>
                  {r.unread > 0 && <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#F04452] text-white text-[12px] font-bold flex items-center justify-center">{r.unread}</span>}
                  <span className="text-[16px] font-bold shrink-0">채팅 ›</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mx-5 mt-6 rounded-2xl bg-white border border-gray-100 px-5 py-3">
        <h2 className="text-[17px] font-bold text-gray-900 py-2">보낸 내용</h2>
        <AnswerList answers={c.answers} note={c.note} area={c.area_label} />
      </section>

      <section className="px-5 pt-6 space-y-2.5">
        {c.status === 'open' && !isExpired(c) && !full && (
          <button type="button" disabled={busy} onClick={close} className="w-full min-h-[52px] rounded-xl bg-white border border-gray-200 text-[16px] font-semibold text-gray-700 disabled:opacity-50">
            요청 마감하기
          </button>
        )}
        <button type="button" disabled={busy} onClick={remove} className="w-full min-h-[52px] rounded-xl text-[15px] font-semibold text-red-500 disabled:opacity-50">
          요청서 지우기
        </button>
        <p className="text-[13px] text-gray-400 leading-relaxed text-center">
          연결되지 않은 요청서는 받는 기간이 끝나고 30일 뒤, 대화는 마지막 메시지 후 180일 뒤 자동으로 지워져요.
        </p>
      </section>
    </>
  )
}

// ── 전문가 화면 ──
function ExpertView({ view }: { view: Extract<View, { role: 'expert' }> }) {
  const router = useRouter()
  const c = view.consult
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const full = c.accepted_count >= MAX_ACCEPT
  const closed = c.status === 'closed' || isExpired(c)

  const accept = async () => {
    setBusy(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('accept_consult', { p_id: c.id })
    if (rpcError || typeof data !== 'string') {
      setError(friendlyError(rpcError, '수락하지 못했어요. 잠시 후 다시 시도해 주세요.'))
      setBusy(false)
      return
    }
    refreshNavBadges()
    router.push(`/chat/${data}`)
  }

  let action: ReactNode
  if (view.my_room_id) {
    action = (
      <Link href={`/chat/${view.my_room_id}`} className="w-full min-h-[56px] rounded-2xl text-white text-[18px] font-bold flex items-center justify-center" style={{ background: GREEN }}>
        채팅으로 이동
      </Link>
    )
  } else if (closed || full) {
    action = (
      <div className="rounded-2xl bg-gray-100 p-4 text-center">
        <p className="text-[16px] font-bold text-gray-700">{full ? `${MAX_ACCEPT}명이 모두 수락했어요` : '마감된 요청이에요'}</p>
        <p className="text-[14px] text-gray-500 mt-1">요청 내용은 볼 수 있지만 수락할 수 없어요.</p>
      </div>
    )
  } else if (!view.subscribed) {
    action = (
      <div className="rounded-2xl p-4" style={{ background: '#FFF8E6', border: '1px solid #FDE68A' }}>
        <p className="text-[16px] font-bold text-amber-900">구독 중인 전문가만 수락할 수 있어요</p>
        <p className="text-[14px] text-amber-900/80 mt-1 leading-relaxed">
          시범 기간에는 운영팀이 구독을 켜 드려요. {CONTACT_EMAIL} 로 성함과 &lsquo;구독 신청&rsquo;을 보내 주세요.
        </p>
        <button type="button" disabled className="mt-3 w-full min-h-[52px] rounded-xl bg-gray-200 text-gray-400 text-[16px] font-bold">
          상담 수락하기
        </button>
      </div>
    )
  } else {
    action = (
      <button
        type="button"
        onClick={accept}
        disabled={busy}
        className="w-full min-h-[56px] rounded-2xl text-white text-[18px] font-bold disabled:opacity-60"
        style={{ background: GREEN }}
      >
        {busy ? '수락하는 중...' : `상담 수락하고 채팅 시작 · 남은 자리 ${MAX_ACCEPT - c.accepted_count}`}
      </button>
    )
  }

  return (
    <>
      <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-5">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-[21px] font-extrabold text-gray-900">
            {consultTitle(c.answers)} <span className="text-[15px] font-semibold text-gray-500">({ageText(c.answers.age)})</span>
          </h1>
          <StateChip row={c} />
        </div>
        <p className="text-[15px] text-gray-600 mt-2">
          {c.area_label}
          {view.distance_km != null ? ` · 약 ${view.distance_km}km` : ''} · {timeAgo(c.created_at)}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Dots count={c.accepted_count} />
          <p className="text-[14px] text-gray-600">
            {c.accepted_count}명 수락 / 최대 {MAX_ACCEPT}명
          </p>
        </div>
      </section>

      <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 px-5 py-3">
        <AnswerList answers={c.answers} note={c.note} />
      </section>

      <section className="px-5 pt-5">
        {action}
        {error && <p className="text-[15px] text-red-500 mt-3">{error}</p>}
        <p className="text-[13px] text-gray-500 mt-4 leading-relaxed">
          운동 지도 범위에서 안내해 주세요. 진단·치료·효과 보장은 약속하지 않아요. 연락처와 비용은 보호자가 원할 때 채팅에서 안내해 주세요.
        </p>
      </section>
    </>
  )
}
