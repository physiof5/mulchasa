'use client'

// 채팅방 — 회원 ↔ 상담을 수락한 전문가 (열면 이 대화에 맞는 모드로 바뀜)
// · 새 메시지는 실시간(Supabase Realtime)으로 받고, 혹시 끊겨도 8초마다 한 번 더 확인
// · 신고(최근 대화 50개 함께 보관) · 차단(두 사람 모두 보낼 수 없음, 차단한 사람만 풀 수 있음)
// · 대화는 마지막 메시지 후 180일 뒤 자동 삭제
// · 전문가: 크루원 추천(회원이 수락해야 새 대화방) · 진행 후기 쓰기(10회 이상, 회원이 공개에 동의해야 공개)
// · 위쪽 '다음 방문' 막대: 스케줄에서 이 대화와 연결한 일정 (회원 확인·진행 완료·회차)

import { use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthUser } from '@/lib/auth'
import {
  CHAT_KEEP_DAYS, MESSAGE_MAX, ageText, clockTime, consultTitle, dayLabel, friendlyError, refreshNavBadges, type ConsultAnswers,
} from '@/lib/consult'
import { notifyPush } from '@/lib/push'
import { setAppMode, storedMode, useAppMode } from '@/lib/mode'
import { crewError, ROLE_LABEL, type CrewRole } from '@/lib/crew'
import { findBannedPhrase, bannedMessage } from '@/lib/practitioner'
import VisitBar from '@/components/VisitBar'
import { TopBar, Avatar, GuardianAvatar, AnswerList, LoginNeeded, Spinner, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'

interface RoomInfo {
  id: string
  role: 'guardian' | 'expert'
  therapist: { id: string; name: string; photo: string | null; years: number | null; studio: string | null; rating: number | null; reviews: number }
  consult: { id: string; answers: ConsultAnswers; note: string; area_label: string; created_at: string } | null
  blocked: boolean
  blocked_by_me: boolean
  admin_blocked: boolean
  partner_read_at: string
  has_crew?: boolean
  review?: { id: string; status: 'pending' | 'published' | 'declined' | 'hidden' } | null
  referral?: {
    id: string
    note: string
    mine: boolean
    from_name: string | null
    to: { therapist_id: string; name: string; photo: string | null; years: number | null }
  } | null
  /** 크루원 추천으로 연결된 방이면: 추천한 선생님의 인수인계 메모 (이 방의 전문가에게만) */
  handover?: { from_name: string | null; from_user_id: string; text: string; at: string } | null
}

interface Candidate {
  user_id: string
  name: string
  photo: string | null
  years: number | null
  role: CrewRole
  distance_km: number | null
  /** 내가 버디(선배)인 신입 크루원 */
  my_buddy?: boolean
  /** 회원이 고른 경력 조건을 채우는지 */
  meets?: boolean
}

interface Msg {
  id: number
  room_id: string
  sender_id: string | null
  kind: 'text' | 'system'
  body: string
  created_at: string
}

const MSG_FIELDS = 'id, room_id, sender_id, kind, body, created_at'

const QUICK_GUARDIAN = [
  '안녕하세요. 첫 상담은 어떻게 진행되나요?',
  '부모님 상황에 맞는 운동 지도가 궁금해요.',
  '집으로 와 주실 수 있나요?',
  '비용은 어떻게 되나요?',
]
const QUICK_EXPERT = [
  '안녕하세요. 요청서 잘 읽었어요. 몇 가지 여쭤봐도 될까요?',
  '지금 가장 힘들어하시는 동작이 무엇인가요?',
  '편하신 요일과 시간대를 알려 주시겠어요?',
]

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'abuse', label: '욕설·비방·괴롭힘' },
  { value: 'sexual', label: '성적인 말이나 행동' },
  { value: 'spam', label: '광고·스팸' },
  { value: 'money', label: '선입금 등 돈을 먼저 요구' },
  { value: 'medical', label: '치료·효과 보장 같은 의료행위 약속' },
  { value: 'privacy', label: '개인정보를 요구하거나 퍼뜨림' },
  { value: 'other', label: '기타' },
]

export default function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const user = useAuthUser()
  if (user === null) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white">
        <TopBar title="채팅" backHref="/chat" />
        <LoginNeeded title={'로그인하면\n대화를 이어갈 수 있어요'} desc="대화는 참여한 두 사람만 볼 수 있어요." next={`/chat/${id}`} />
      </main>
    )
  }
  if (user === undefined) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white">
        <TopBar title="채팅" backHref="/chat" />
        <Spinner />
      </main>
    )
  }
  return <Room id={id} me={user.id} />
}

function Room({ id, me }: { id: string; me: string }) {
  const [info, setInfo] = useState<RoomInfo | null | undefined>(undefined)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [menu, setMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [referring, setReferring] = useState(false)
  const [refBusy, setRefBusy] = useState(false)
  const router = useRouter()
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastIdRef = useRef(0)
  const stickRef = useRef(true)

  const merge = useCallback((rows: Msg[]) => {
    if (rows.length === 0) return
    setMsgs((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]))
      rows.forEach((r) => map.set(r.id, r))
      return Array.from(map.values()).sort((a, b) => a.id - b.id)
    })
    lastIdRef.current = Math.max(lastIdRef.current, ...rows.map((r) => r.id))
  }, [])

  const loadInfo = useCallback(
    () =>
      supabase.rpc('get_room', { p_id: id }).then(({ data, error }) => {
        if (error) return setInfo((cur) => (cur === undefined ? null : cur))
        setInfo((data as RoomInfo | null) ?? null)
      }),
    [id]
  )

  const markRead = useCallback(() => {
    supabase.rpc('mark_room_read', { p_id: id }).then(() => refreshNavBadges())
  }, [id])

  const pullNew = useCallback(
    () =>
      supabase
        .from('chat_messages')
        .select(MSG_FIELDS)
        .eq('room_id', id)
        .gt('id', lastIdRef.current)
        .order('id', { ascending: true })
        .limit(100)
        .then(({ data }) => {
          const rows = (data as Msg[]) ?? []
          merge(rows)
          if (rows.some((r) => r.sender_id !== me) && document.visibilityState === 'visible') markRead()
        }),
    [id, me, merge, markRead]
  )

  // 처음 열 때: 방 정보 + 최근 메시지 200개
  useEffect(() => {
    let alive = true
    loadInfo()
    supabase
      .from('chat_messages')
      .select(MSG_FIELDS)
      .eq('room_id', id)
      .order('id', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!alive) return
        merge(((data as Msg[]) ?? []).reverse())
        setLoaded(true)
        markRead()
      })
    return () => {
      alive = false
    }
  }, [id, loadInfo, merge, markRead])

  // 실시간 + 예비 확인
  useEffect(() => {
    const channel = supabase
      .channel(`room-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${id}` }, (payload) => {
        const m = payload.new as Msg
        merge([m])
        if (m.sender_id !== me && document.visibilityState === 'visible') markRead()
      })
      .subscribe()
    const poll = window.setInterval(pullNew, 8000)
    const infoTimer = window.setInterval(loadInfo, 20000)
    const onFocus = () => {
      pullNew()
      loadInfo()
      markRead()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      supabase.removeChannel(channel)
      window.clearInterval(poll)
      window.clearInterval(infoTimer)
      window.removeEventListener('focus', onFocus)
    }
  }, [id, me, merge, markRead, pullNew, loadInfo])

  // 새 메시지가 오면 맨 아래로 (위로 올려 읽는 중이면 그대로)
  useEffect(() => {
    const el = listRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [msgs.length, loaded, info])

  // 위쪽 '다음 방문' 막대 등이 늦게 그려져 목록 높이가 줄어도 맨 아래에 붙어 있게
  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [loaded])

  // 이 대화에 맞는 모드로 (알림을 눌러 들어온 경우 등) — 전문가 대화면 전문가 모드, 내 상담이면 회원 모드
  const { canExpert } = useAppMode()
  const role = info?.role
  useEffect(() => {
    if (!role || !canExpert) return
    const target = role === 'expert' ? 'expert' : 'member'
    if (storedMode() !== target) setAppMode(target)
  }, [role, canExpert])

  // 입력 칸은 글 길이에 맞춰 최대 5줄까지 늘어남
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 136)}px`
  }, [text])

  const onScroll = () => {
    const el = listRef.current
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  const canSend = !!info && !info.blocked && !info.admin_blocked

  const send = async (raw: string, fromQuick = false) => {
    const body = raw.trim().slice(0, MESSAGE_MAX)
    if (!body || sending || !canSend) return
    setSending(true)
    setSendError('')
    if (!fromQuick) setText('')
    stickRef.current = true
    const { data, error } = await supabase.from('chat_messages').insert({ room_id: id, sender_id: me, body }).select(MSG_FIELDS).single()
    setSending(false)
    if (error || !data) {
      if (!fromQuick) setText(raw)
      setSendError(error?.message?.includes('too_fast') ? friendlyError(error) : '보내지 못했어요. 잠시 후 다시 보내 주세요.')
      loadInfo()
      return
    }
    merge([data as Msg])
    // 상대에게 '새 메시지' 알림 (대화방을 보고 있으면 알림이 뜨지 않음)
    notifyPush({ type: 'message', message_id: (data as Msg).id })
  }

  const setBlock = async (on: boolean) => {
    if (on && !confirm('이 대화를 차단할까요? 두 분 모두 이 대화방에서 메시지를 보낼 수 없어요. 내가 다시 풀 수 있어요.')) return
    const { error } = await supabase.rpc('set_room_block', { p_id: id, p_on: on })
    setMenu(false)
    if (error) return alert(friendlyError(error))
    loadInfo()
  }

  // 회원: 추천받은 크루원과 연결 / 사양
  const answerReferral = async (accept: boolean) => {
    const ref = info?.referral
    if (!ref || refBusy) return
    if (!accept && !confirm('추천을 사양할까요? 지금 대화는 그대로 이어져요.')) return
    setRefBusy(true)
    const { data, error } = await supabase.rpc('answer_referral', { p_id: ref.id, p_accept: accept })
    setRefBusy(false)
    if (error) return alert(crewError(error))
    if (accept && typeof data === 'string') {
      notifyPush({ type: 'referral_accepted', referral_id: ref.id })
      refreshNavBadges()
      router.push(`/chat/${data}`)
      return
    }
    loadInfo()
    pullNew()
  }

  // 전문가: 보낸 추천 거두기
  const cancelReferral = async () => {
    const ref = info?.referral
    if (!ref || refBusy || !confirm('추천을 거둘까요?')) return
    setRefBusy(true)
    const { error } = await supabase.rpc('cancel_referral', { p_id: ref.id })
    setRefBusy(false)
    if (error) return alert(crewError(error))
    loadInfo()
    pullNew()
  }

  if (info === undefined || !loaded) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white">
        <TopBar title="채팅" backHref="/chat" />
        <Spinner />
      </main>
    )
  }
  if (info === null) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white">
        <TopBar title="채팅" backHref="/chat" />
        <section className="px-6 pt-16 text-center">
          <p className="text-[19px] font-bold text-gray-900">대화방을 열 수 없어요</p>
          <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">요청서가 지워졌거나, 보관 기간({CHAT_KEEP_DAYS}일)이 지나 대화가 삭제되었을 수 있어요.</p>
          <Link href="/chat" className="mt-6 inline-flex min-h-[52px] px-6 rounded-xl text-white text-[16px] font-bold items-center" style={{ background: GREEN }}>
            채팅 목록으로
          </Link>
        </section>
      </main>
    )
  }

  const isGuardian = info.role === 'guardian'
  const t = info.therapist
  const partnerName = isGuardian ? t.name : '회원'
  const title = isGuardian ? t.name : info.consult ? `${consultTitle(info.consult.answers)} (${ageText(info.consult.answers.age)})` : '회원'
  const sub = isGuardian ? `물리치료사${t.years ? ` · 경력 ${t.years}년` : ''}` : `회원${info.consult?.area_label ? ` · ${info.consult.area_label}` : ''}`
  const myTexts = msgs.filter((m) => m.sender_id === me && m.kind === 'text').length
  const last = msgs[msgs.length - 1]
  const waiting = !!last && last.kind === 'text' && last.sender_id !== me
  const quick = myTexts === 0 && canSend ? (isGuardian ? QUICK_GUARDIAN : QUICK_EXPERT) : []

  let notice: { text: string; tone: 'warn' | 'stop' } | null = null
  if (info.admin_blocked) notice = { text: '운영 정책에 따라 이 대화는 중지되었어요.', tone: 'stop' }
  else if (info.blocked) notice = { text: info.blocked_by_me ? '내가 차단한 대화예요. 오른쪽 위 메뉴에서 풀 수 있어요.' : '상대방이 대화를 차단했어요.', tone: 'stop' }
  else if (waiting) notice = { text: `${partnerName}님이 답변을 기다리고 있어요.`, tone: 'warn' }
  const review = info.review ?? null
  const referral = info.referral ?? null

  return (
    <main className="max-w-md mx-auto h-[100dvh] flex flex-col" style={{ background: '#F2F4F6' }}>
      <TopBar
        title={title}
        sub={sub}
        backHref="/chat"
        right={
          <button type="button" onClick={() => setMenu(true)} aria-label="메뉴" className="w-12 h-12 -mr-2 flex items-center justify-center text-gray-600 shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        }
      />
      {info.consult && (
        <Link href={`/consult/${info.consult.id}`} className="bg-white border-b border-gray-100 px-5 min-h-[48px] flex items-center gap-2">
          <span className="flex-1 min-w-0 text-[15px] text-gray-700 truncate">
            {consultTitle(info.consult.answers)} · {info.consult.area_label}
          </span>
          <span className="text-[15px] font-semibold shrink-0" style={{ color: GREEN_DARK }}>
            요청서 보기 ›
          </span>
        </Link>
      )}
      <VisitBar roomId={id} isGuardian={isGuardian} canSend={canSend} onMessage={() => pullNew()} />

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="rounded-xl px-4 py-3 text-[13px] leading-relaxed mb-4" style={{ background: '#FFFBEB', color: '#92400E' }}>
          🔒 전화번호·계좌번호는 꼭 필요할 때만 알려 주세요. 돈을 먼저 보내 달라고 하면 신고해 주세요.
          {!isGuardian && ' 운동 지도 범위에서만 안내해 주세요(진단·치료·효과 보장 약속 금지).'} 대화는 마지막 메시지 후 {CHAT_KEEP_DAYS}일 뒤 지워져요.
        </div>

        {!isGuardian && info.handover && (
          <div className="mb-3 rounded-2xl bg-white border-2 p-4" style={{ borderColor: GREEN_LIGHT }}>
            <p className="text-[14px] font-bold" style={{ color: GREEN_DARK }}>
              📋 {info.handover.from_name ?? '크루원'}님의 인수인계 메모
            </p>
            <p className="text-[15px] text-gray-800 mt-1.5 leading-relaxed whitespace-pre-wrap break-words">{info.handover.text}</p>
            <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">나만 볼 수 있어요. 궁금한 점은 크루 ‘질문’ 탭이나 크루 채팅으로 선배에게 물어보세요.</p>
            <Link href="/crew" className="mt-2 inline-flex min-h-[40px] items-center text-[14px] font-bold" style={{ color: GREEN_DARK }}>
              크루로 가기 ›
            </Link>
          </div>
        )}
        {isGuardian ? <ExpertCard t={t} /> : info.consult && <RequestCard consult={info.consult} />}

        {msgs.map((m, i) => {
          const prev = msgs[i - 1]
          const next = msgs[i + 1]
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
          const mine = m.sender_id === me && m.kind === 'text'
          const sameGroup = (a?: Msg) => !!a && a.kind === m.kind && a.sender_id === m.sender_id && clockTime(a.created_at) === clockTime(m.created_at)
          const showTime = !sameGroup(next) || newDayOf(next, m)
          const showAvatar = !mine && m.kind === 'text' && (!sameGroup(prev) || newDay)
          const unreadByPartner = mine && new Date(m.created_at).getTime() > new Date(info.partner_read_at).getTime()
          return (
            <div key={m.id}>
              {newDay && <p className="text-center text-[13px] text-gray-500 my-4">{dayLabel(m.created_at)}</p>}
              {m.kind === 'system' ? (
                <p className="mx-auto my-3 w-fit max-w-[90%] text-center text-[14px] text-gray-600 bg-white/80 rounded-full px-4 py-2 leading-snug">{m.body}</p>
              ) : mine ? (
                <div className="flex justify-end items-end gap-1.5 mt-1.5">
                  {showTime && (
                    <span className="text-[12px] text-gray-400 text-right leading-tight shrink-0">
                      {unreadByPartner && <span className="block" style={{ color: GREEN_DARK }}>안 읽음</span>}
                      {clockTime(m.created_at)}
                    </span>
                  )}
                  <p className="max-w-[75%] rounded-2xl rounded-br-md px-4 py-2.5 text-[16px] leading-relaxed text-white whitespace-pre-wrap break-words" style={{ background: GREEN }}>
                    {m.body}
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 mt-1.5">
                  <span className="w-10 shrink-0">{showAvatar && (isGuardian ? <Avatar src={t.photo} name={t.name} size={40} /> : <GuardianAvatar size={40} />)}</span>
                  <div className="flex items-end gap-1.5 min-w-0">
                    <p className="max-w-[240px] sm:max-w-[280px] rounded-2xl rounded-tl-md bg-white px-4 py-2.5 text-[16px] leading-relaxed text-gray-900 whitespace-pre-wrap break-words">{m.body}</p>
                    {showTime && <span className="text-[12px] text-gray-400 shrink-0">{clockTime(m.created_at)}</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {quick.length > 0 && (
          <div className="mt-5 ml-auto max-w-[88%] rounded-2xl bg-white p-3">
            <p className="text-[13px] text-gray-500 px-1 pb-2">눌러서 바로 보내기</p>
            <div className="flex flex-col gap-2">
              {quick.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={sending}
                  onClick={() => send(q, true)}
                  className="min-h-[48px] text-left rounded-xl px-4 py-2.5 text-[15px] leading-snug font-medium disabled:opacity-50"
                  style={{ background: GREEN_LIGHT, color: GREEN_DARK }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {referral && isGuardian && (
        <div className="bg-white border-t-2 px-4 pt-3 pb-3" style={{ borderColor: GREEN_LIGHT }}>
          <p className="text-[14px] font-bold" style={{ color: GREEN_DARK }}>
            {referral.from_name ?? t.name}님이 같은 크루의 물리치료사를 추천했어요
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Avatar src={referral.to.photo} name={referral.to.name} size={48} />
            <div className="flex-1 min-w-0">
              <p className="text-[17px] font-extrabold text-gray-900 truncate">{referral.to.name}</p>
              <p className="text-[14px] text-gray-500">물리치료사{referral.to.years ? ` · 경력 ${referral.to.years}년` : ''}</p>
            </div>
            <Link href={`/therapist/${referral.to.therapist_id}`} className="min-h-[44px] px-3 rounded-lg border border-gray-200 text-[14px] font-semibold text-gray-600 flex items-center shrink-0">
              프로필
            </Link>
          </div>
          {referral.note && <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-[15px] text-gray-700 leading-relaxed whitespace-pre-line">{referral.note}</p>}
          <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
            <button type="button" disabled={refBusy} onClick={() => answerReferral(false)} className="min-h-[48px] rounded-xl border border-gray-200 text-[15px] font-semibold text-gray-600">
              괜찮아요
            </button>
            <button type="button" disabled={refBusy} onClick={() => answerReferral(true)} className="min-h-[48px] rounded-xl text-[16px] font-bold text-white" style={{ background: GREEN }}>
              {refBusy ? '연결하는 중...' : `${referral.to.name}님과 대화 시작`}
            </button>
          </div>
          <p className="text-[12px] text-gray-400 mt-2">연결하면 요청서 내용이 이 전문가에게도 보여요. 지금 대화는 그대로 남아요.</p>
        </div>
      )}
      {referral && !isGuardian && referral.mine && (
        <div className="bg-white border-t border-gray-100 px-5 py-2.5 flex items-center gap-2">
          <p className="flex-1 text-[14px] text-gray-700">
            <b>{referral.to.name}</b>님을 추천했어요 · 회원의 답을 기다리는 중
          </p>
          <button type="button" onClick={cancelReferral} disabled={refBusy} className="min-h-[40px] px-3 rounded-lg border border-gray-200 text-[13px] font-semibold text-gray-600 shrink-0">
            거두기
          </button>
        </div>
      )}
      {review?.status === 'pending' && (
        <Link href={`/reviews/${review.id}`} className="bg-white border-t border-gray-100 px-5 min-h-[52px] flex items-center gap-2">
          <span className="text-[18px]" aria-hidden="true">📝</span>
          <span className="flex-1 text-[15px] text-gray-800">
            {isGuardian ? '전문가가 진행 후기 공개 동의를 요청했어요' : '진행 후기 · 회원이 확인하는 중이에요'}
          </span>
          <span className="text-[15px] font-bold shrink-0" style={{ color: GREEN_DARK }}>
            {isGuardian ? '확인하기 ›' : '보기 ›'}
          </span>
        </Link>
      )}
      {notice && (
        <div className="bg-white border-t border-gray-100 px-5 py-3 flex items-center gap-2.5">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[14px] font-extrabold shrink-0"
            style={{ background: notice.tone === 'warn' ? '#F59E0B' : '#9CA3AF' }}
            aria-hidden="true"
          >
            !
          </span>
          <p className="flex-1 text-[15px] text-gray-800">{notice.text}</p>
        </div>
      )}
      {sendError && <p className="bg-white px-5 pt-2 text-[14px] text-red-500">{sendError}</p>}

      <div className="bg-white px-3 pt-2 pb-3 border-t border-gray-100" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-end gap-2 rounded-3xl border border-gray-200 pl-4 pr-1.5 py-1.5 focus-within:border-[#0A8A7B]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX))}
            rows={1}
            disabled={!canSend}
            placeholder={canSend ? '메시지를 입력하세요' : '메시지를 보낼 수 없어요'}
            aria-label="메시지"
            ref={inputRef}
            className="flex-1 min-w-0 resize-none bg-transparent py-2 text-[16px] leading-relaxed focus:outline-none disabled:text-gray-400"
          />
          <button
            type="button"
            onClick={() => send(text)}
            disabled={!text.trim() || sending || !canSend}
            aria-label="보내기"
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white disabled:bg-gray-200"
            style={{ background: !text.trim() || sending || !canSend ? undefined : GREEN }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {menu && (
        <Sheet onClose={() => setMenu(false)} title="대화 메뉴">
          {isGuardian && <SheetLink href={`/therapist/${t.id}`} label="전문가 프로필 보기" />}
          {info.consult && <SheetLink href={`/consult/${info.consult.id}`} label="요청서 보기" />}
          {!isGuardian && <SheetLink href={`/schedule?room=${info.id}`} label="스케줄에 일정 잡기" />}
          {!isGuardian &&
            (review ? (
              <SheetLink href={`/reviews/${review.id}`} label="진행 후기 보기" />
            ) : (
              canSend && <SheetLink href={`/reviews/write?room=${info.id}`} label="진행 후기 쓰기 (10회 이상 진행 후)" />
            ))}
          {isGuardian && review && review.status !== 'declined' && <SheetLink href={`/reviews/${review.id}`} label="진행 후기 보기" />}
          {!isGuardian && info.has_crew && canSend && !referral && (
            <SheetButton
              label="크루원 추천하기"
              onClick={() => {
                setMenu(false)
                setReferring(true)
              }}
            />
          )}
          <SheetButton
            label="신고하기"
            danger
            onClick={() => {
              setMenu(false)
              setReporting(true)
            }}
          />
          {info.blocked_by_me ? (
            <SheetButton label="차단 풀기" onClick={() => setBlock(false)} />
          ) : (
            !info.blocked && <SheetButton label="차단하기" danger onClick={() => setBlock(true)} />
          )}
        </Sheet>
      )}
      {referring && (
        <ReferralSheet
          roomId={id}
          onClose={() => setReferring(false)}
          onDone={(refId) => {
            setReferring(false)
            notifyPush({ type: 'referral', referral_id: refId })
            loadInfo()
            pullNew()
          }}
        />
      )}
      {reporting && <ReportSheet roomId={id} canBlock={!info.blocked} onBlock={() => setBlock(true)} onClose={() => setReporting(false)} />}
    </main>
  )
}

function newDayOf(a: Msg | undefined, b: Msg): boolean {
  return !!a && new Date(a.created_at).toDateString() !== new Date(b.created_at).toDateString()
}

function ExpertCard({ t }: { t: RoomInfo['therapist'] }) {
  return (
    <div className="flex items-start gap-2 mb-2">
      <span className="w-10 shrink-0">
        <Avatar src={t.photo} name={t.name} size={40} />
      </span>
      <div className="max-w-[85%] w-full rounded-2xl rounded-tl-md bg-white p-4">
        <p className="text-[14px] font-bold text-gray-500">상담을 수락한 전문가</p>
        <p className="text-[19px] font-extrabold text-gray-900 mt-2">{t.name}</p>
        <p className="text-[14px] text-gray-500">
          물리치료사{t.studio ? ` · ${t.studio}` : ''}
        </p>
        <div className="mt-3 grid grid-cols-3 rounded-xl bg-gray-50 py-3 text-center">
          <span>
            <span className="block text-[13px] text-gray-500">만족도</span>
            <span className="block text-[17px] font-extrabold text-gray-900">{t.rating != null ? Number(t.rating).toFixed(1) : '-'}</span>
          </span>
          <span>
            <span className="block text-[13px] text-gray-500">진행 후기</span>
            <span className="block text-[17px] font-extrabold text-gray-900">{t.reviews}</span>
          </span>
          <span>
            <span className="block text-[13px] text-gray-500">경력</span>
            <span className="block text-[17px] font-extrabold text-gray-900">{t.years ? `${t.years}년` : '-'}</span>
          </span>
        </div>
        <Link href={`/therapist/${t.id}`} className="mt-3 flex min-h-[48px] rounded-xl items-center justify-center text-white text-[16px] font-bold" style={{ background: GREEN }}>
          전문가 프로필 보기
        </Link>
      </div>
    </div>
  )
}

function RequestCard({ consult }: { consult: NonNullable<RoomInfo['consult']> }) {
  return (
    <div className="flex items-start gap-2 mb-2">
      <span className="w-10 shrink-0">
        <GuardianAvatar size={40} />
      </span>
      <div className="max-w-[85%] w-full rounded-2xl rounded-tl-md bg-white px-4 pt-3 pb-2">
        <p className="text-[14px] font-bold text-gray-500">상담 요청서</p>
        <AnswerList answers={consult.answers} note={consult.note} area={consult.area_label} />
      </div>
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl px-3 pt-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto w-10 h-1.5 rounded-full bg-gray-200 mb-2" aria-hidden="true" />
        {children}
        <button type="button" onClick={onClose} className="w-full min-h-[52px] mt-1 text-[16px] font-semibold text-gray-500">
          닫기
        </button>
      </div>
    </div>
  )
}

function SheetLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center min-h-[56px] px-4 rounded-xl text-[17px] font-semibold text-gray-800 active:bg-gray-50">
      {label}
    </Link>
  )
}

function SheetButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center min-h-[56px] px-4 rounded-xl text-[17px] font-semibold active:bg-gray-50 text-left"
      style={{ color: danger ? '#E5484D' : '#1F2937' }}
    >
      {label}
    </button>
  )
}

function ReferralSheet({ roomId, onClose, onDone }: { roomId: string; onClose: () => void; onDone: (referralId: string) => void }) {
  const [list, setList] = useState<Candidate[] | null>(null)
  const [pick, setPick] = useState<Candidate | null>(null)
  const [note, setNote] = useState('')
  const [handover, setHandover] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const banned = findBannedPhrase(note)

  useEffect(() => {
    let alive = true
    supabase.rpc('crew_referral_candidates', { p_room: roomId }).then(({ data }) => {
      if (alive) setList(Array.isArray(data) ? (data as Candidate[]) : [])
    })
    return () => {
      alive = false
    }
  }, [roomId])

  const choose = (c: Candidate) => {
    if (c.meets === false) return
    setPick(c)
    if (!note.trim() || note.startsWith('제 일정이')) setNote(`제 일정이 맞지 않아 같은 크루의 ${c.name} 선생님을 추천드려요. 믿고 맡길 수 있는 동료예요.`)
  }

  const submit = async () => {
    if (!pick || busy || banned) return
    setBusy(true)
    setError('')
    const { data, error: e } = await supabase.rpc('create_referral', { p_room: roomId, p_to_user: pick.user_id, p_note: note.trim(), p_handover: handover.trim() })
    setBusy(false)
    if (e || typeof data !== 'string') return setError(crewError(e))
    onDone(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="크루원 추천하기">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <p className="text-[20px] font-extrabold text-gray-900">크루원 추천하기</p>
        <p className="text-[14px] text-gray-500 mt-1 leading-relaxed">일정이 안 맞을 때 같은 크루의 동료를 회원에게 소개해요. 회원이 수락해야 새 대화가 열리고, 돈은 오가지 않아요.</p>
        {list === null ? (
          <Spinner />
        ) : list.length === 0 ? (
          <p className="text-[15px] text-gray-500 py-8 text-center leading-relaxed">추천할 수 있는 크루원이 없어요.<br />(이미 이 회원과 대화 중인 크루원은 빠져요)</p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {list.map((c) => {
              const on = pick?.user_id === c.user_id
              const blocked = c.meets === false
              return (
                <button
                  key={c.user_id}
                  type="button"
                  onClick={() => choose(c)}
                  aria-pressed={on}
                  disabled={blocked}
                  className="flex items-center gap-3 min-h-[64px] px-3 rounded-xl border-2 text-left disabled:opacity-50"
                  style={on ? { borderColor: GREEN, background: GREEN_LIGHT } : { borderColor: '#E5E7EB' }}
                >
                  <Avatar src={c.photo} name={c.name} size={44} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[16px] font-bold text-gray-900 truncate">
                      {c.name} {c.role !== 'member' && <span className="text-[13px] font-semibold" style={{ color: GREEN_DARK }}>{ROLE_LABEL[c.role]}</span>}
                      {c.my_buddy && <span className="ml-1 text-[12px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#EDE9FE', color: '#6D28D9' }}>내 버디</span>}
                    </span>
                    <span className="block text-[13px] text-gray-500">
                      경력 {c.years ? `${c.years}년` : '-'}
                      {c.distance_km != null && ` · 회원 동네에서 약 ${c.distance_km}km`}
                    </span>
                    {blocked && <span className="block text-[12px] text-amber-700">회원이 경력 3년 이상 선생님을 원해요</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {pick && (
          <>
            <label className="block mt-4">
              <span className="text-[15px] font-bold text-gray-800">회원에게 남길 말</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                rows={3}
                className="mt-1.5 w-full p-3 border border-gray-200 rounded-xl text-[15px] leading-relaxed focus:outline-none focus:border-[#0A8A7B] resize-none"
              />
            </label>
            {banned && <p className="text-[13px] text-red-500 mt-1">{bannedMessage(banned)}</p>}
            <label className="block mt-4">
              <span className="text-[15px] font-bold text-gray-800">인수인계 메모 (선택 · {pick.name}님에게만)</span>
              <textarea
                value={handover}
                onChange={(e) => setHandover(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="예: 왼쪽 편마비, 집 계단 4칸. 오전 시간을 선호하시고 따님이 결정하세요. 첫 방문 때 화장실 동선부터 봐 주세요."
                className="mt-1.5 w-full p-3 border border-gray-200 rounded-xl text-[15px] leading-relaxed focus:outline-none focus:border-[#0A8A7B] resize-none"
              />
              <span className="block text-[12px] text-gray-400 mt-1 leading-relaxed">
                회원이 연결을 수락한 뒤에만 새 대화방에서 보여요. 방문·운동 지도는 받은 선생님이 직접 하고, 선배는 인수인계와 질문 답으로 도와요.
              </span>
            </label>
          </>
        )}
        {error && <p className="text-[14px] text-red-500 mt-2">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={!pick || busy || !!banned}
          className="mt-4 w-full min-h-[52px] rounded-xl text-[16px] font-bold text-white disabled:bg-gray-200 disabled:text-gray-400"
          style={{ background: !pick || busy || banned ? undefined : GREEN }}
        >
          {busy ? '보내는 중...' : pick ? `${pick.name}님 추천하기` : '추천할 크루원을 골라 주세요'}
        </button>
        <button type="button" onClick={onClose} className="mt-1 w-full min-h-[48px] text-[15px] font-semibold text-gray-500">
          취소
        </button>
      </div>
    </div>
  )
}

function ReportSheet({ roomId, canBlock, onBlock, onClose }: { roomId: string; canBlock: boolean; onBlock: () => void; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!reason) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('report_room', { p_id: roomId, p_reason: reason, p_detail: detail })
    setBusy(false)
    if (e) return setError(friendlyError(e, '신고를 보내지 못했어요. 잠시 후 다시 시도해 주세요.'))
    setDone(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="신고하기">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        {done ? (
          <>
            <p className="text-[20px] font-extrabold text-gray-900">신고를 받았어요</p>
            <p className="text-[15px] text-gray-600 mt-2 leading-relaxed">운영팀이 최근 대화 내용을 함께 확인하고 조치할게요. 더는 대화하고 싶지 않다면 차단할 수 있어요.</p>
            {canBlock && (
              <button type="button" onClick={onBlock} className="mt-5 w-full min-h-[52px] rounded-xl text-[16px] font-bold text-white" style={{ background: '#E5484D' }}>
                이 대화 차단하기
              </button>
            )}
            <button type="button" onClick={onClose} className="mt-2 w-full min-h-[52px] rounded-xl text-[16px] font-semibold text-gray-600 border border-gray-200">
              닫기
            </button>
          </>
        ) : (
          <>
            <p className="text-[20px] font-extrabold text-gray-900">무엇이 문제였나요?</p>
            <p className="text-[14px] text-gray-500 mt-1">신고하면 최근 대화 50개가 운영팀에 함께 전달돼요.</p>
            <div className="mt-4 flex flex-col gap-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex items-center gap-3 min-h-[52px] px-4 rounded-xl border-2 cursor-pointer"
                  style={reason === r.value ? { borderColor: GREEN, background: GREEN_LIGHT } : { borderColor: '#E5E7EB' }}
                >
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="w-5 h-5 accent-[#0A8A7B]" />
                  <span className="text-[16px] font-semibold text-gray-800">{r.label}</span>
                </label>
              ))}
            </div>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="자세한 내용 (선택)"
              className="mt-3 w-full p-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#0A8A7B] resize-none"
            />
            {error && <p className="text-[14px] text-red-500 mt-2">{error}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={!reason || busy}
              className="mt-4 w-full min-h-[52px] rounded-xl text-[16px] font-bold text-white disabled:bg-gray-200 disabled:text-gray-400"
              style={{ background: !reason || busy ? undefined : '#E5484D' }}
            >
              {busy ? '보내는 중...' : '신고하기'}
            </button>
            <button type="button" onClick={onClose} className="mt-1 w-full min-h-[48px] text-[15px] font-semibold text-gray-500">
              취소
            </button>
          </>
        )}
      </div>
    </div>
  )
}
