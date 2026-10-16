'use client'

// 크루 채팅 — 크루원끼리만 (실시간 + 10초마다 한 번 더 확인)
// · '케이스'로 보내면 눈에 띄게 표시되고 협업 점수에 들어가요 (회원을 알아볼 수 있는 내용은 빼기)
// · 공지는 대표·리더가 올리고 위에 고정돼요
// · 1년 지난 메시지는 자동 삭제

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { refreshNavBadges } from '@/lib/consult'
import { CREW_MSG_FIELDS, CREW_MSG_MAX, ROLE_LABEL, crewError, crewTime, type CrewMsg, type MyCrew } from '@/lib/crew'
import Sheet from '@/components/Sheet'
import { Avatar, Spinner, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'
import { PrimaryButton, TextField } from '@/components/crew/CrewParts'

const CASE_TEMPLATE = '[나이대·상황]\n\n[지금까지 한 운동 지도]\n\n[함께 고민하고 싶은 점]\n'

export default function CrewChat({ data, reload }: { data: MyCrew; reload: () => Promise<void> }) {
  const crewId = data.crew.id
  const me = data.members.find((m) => m.me)?.user_id ?? ''
  const [msgs, setMsgs] = useState<CrewMsg[]>([])
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState('')
  const [isCase, setIsCase] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const lastIdRef = useRef(0)
  const stickRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const reloadRef = useRef(reload)
  useEffect(() => {
    reloadRef.current = reload
  }, [reload])

  const merge = useCallback((rows: CrewMsg[]) => {
    if (rows.length === 0) return
    setMsgs((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]))
      rows.forEach((r) => map.set(r.id, r))
      return Array.from(map.values()).sort((a, b) => a.id - b.id)
    })
    lastIdRef.current = Math.max(lastIdRef.current, ...rows.map((r) => r.id))
  }, [])

  const markRead = useCallback(() => {
    supabase.rpc('mark_crew_read').then(() => refreshNavBadges())
  }, [])

  const pullNew = useCallback(
    () =>
      supabase
        .from('crew_messages')
        .select(CREW_MSG_FIELDS)
        .eq('crew_id', crewId)
        .gt('id', lastIdRef.current)
        .order('id', { ascending: true })
        .limit(100)
        .then(({ data: rows }) => {
          const list = (rows as CrewMsg[]) ?? []
          merge(list)
          if (list.some((r) => r.sender_id !== me) && document.visibilityState === 'visible') markRead()
          if (list.some((r) => r.kind === 'notice' || r.kind === 'system')) reloadRef.current()
        }),
    [crewId, me, merge, markRead]
  )

  // 처음: 최근 200개
  useEffect(() => {
    let alive = true
    supabase
      .from('crew_messages')
      .select(CREW_MSG_FIELDS)
      .eq('crew_id', crewId)
      .order('id', { ascending: false })
      .limit(200)
      .then(({ data: rows }) => {
        if (!alive) return
        merge(((rows as CrewMsg[]) ?? []).reverse())
        setLoaded(true)
        markRead()
      })
    return () => {
      alive = false
    }
  }, [crewId, merge, markRead])

  // 실시간 + 예비 확인
  useEffect(() => {
    const channel = supabase
      .channel(`crew-${crewId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crew_messages', filter: `crew_id=eq.${crewId}` }, (payload) => {
        const m = payload.new as CrewMsg
        merge([m])
        if (m.sender_id !== me && document.visibilityState === 'visible') markRead()
        // 공지·가입·역할 변경 → 위쪽 정보 새로
        if (m.kind === 'notice' || m.kind === 'system') reloadRef.current()
      })
      .subscribe()
    const poll = window.setInterval(pullNew, 10_000)
    const onFocus = () => {
      pullNew()
      markRead()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      supabase.removeChannel(channel)
      window.clearInterval(poll)
      window.removeEventListener('focus', onFocus)
    }
  }, [crewId, me, merge, markRead, pullNew])

  // 맨 아래 따라가기 (위로 올려 읽는 중이면 그대로)
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      stickRef.current = el.scrollHeight - window.scrollY - window.innerHeight < 160
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (loaded && stickRef.current) window.scrollTo({ top: document.documentElement.scrollHeight })
  }, [msgs.length, loaded])

  // 입력 칸은 최대 6줄까지 늘어남
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  const toggleCase = () => {
    const next = !isCase
    setIsCase(next)
    if (next && !text.trim()) setText(CASE_TEMPLATE)
    if (!next && text === CASE_TEMPLATE) setText('')
    inputRef.current?.focus()
  }

  const send = async () => {
    const body = text.trim().slice(0, CREW_MSG_MAX)
    if (!body || body === CASE_TEMPLATE.trim() || sending || !me) return
    setSending(true)
    setError('')
    stickRef.current = true
    const { data: row, error: e } = await supabase
      .from('crew_messages')
      .insert({ crew_id: crewId, sender_id: me, kind: isCase ? 'case' : 'text', body })
      .select(CREW_MSG_FIELDS)
      .single()
    setSending(false)
    if (e || !row) return setError(crewError(e, '보내지 못했어요. 잠시 후 다시 보내 주세요.'))
    setText('')
    setIsCase(false)
    merge([row as CrewMsg])
  }

  const byId = new Map(data.members.map((m) => [m.user_id, m]))

  if (!loaded) return <Spinner />

  return (
    <div className="px-4 pt-3">
      <p className="rounded-xl px-4 py-3 text-[13px] leading-relaxed" style={{ background: '#FFFBEB', color: '#92400E' }}>
        🔒 크루원만 볼 수 있어요. 케이스를 나눌 때는 회원 이름·연락처·사진처럼 누구인지 알 수 있는 내용은 빼 주세요. 메시지는 1년 뒤 지워져요.
      </p>

      {msgs.length === 0 && <p className="text-center text-[15px] text-gray-500 py-12">첫 인사를 남겨 보세요 👋</p>}

      {msgs.map((m, i) => {
        const prev = msgs[i - 1]
        const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
        const mine = m.sender_id === me && (m.kind === 'text' || m.kind === 'case')
        const who = m.sender_id ? byId.get(m.sender_id) : undefined
        const showName = !mine && (m.kind === 'text' || m.kind === 'case') && (newDay || !prev || prev.sender_id !== m.sender_id || prev.kind === 'system' || prev.kind === 'notice')
        return (
          <div key={m.id}>
            {newDay && <p className="text-center text-[13px] text-gray-500 my-4">{new Date(m.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</p>}
            {m.kind === 'system' ? (
              <p className="mx-auto my-3 w-fit max-w-[90%] text-center text-[14px] text-gray-600 bg-white rounded-full px-4 py-2 leading-snug">{m.body}</p>
            ) : m.kind === 'notice' ? (
              <div className="my-3 mx-auto max-w-[92%] rounded-2xl bg-white border-2 px-4 py-3" style={{ borderColor: GREEN_LIGHT }}>
                <p className="text-[13px] font-bold" style={{ color: GREEN_DARK }}>
                  📌 새 공지 · {who?.name ?? '크루'} {who ? ROLE_LABEL[who.role] : ''}
                </p>
                <p className="text-[16px] text-gray-800 mt-1 whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
              </div>
            ) : (
              <div className={`flex gap-2 mt-2 ${mine ? 'justify-end' : 'items-start'}`}>
                {!mine && <span className="w-10 shrink-0">{showName && <Avatar src={who?.photo} name={who?.name ?? '?'} size={40} />}</span>}
                <div className={`min-w-0 max-w-[78%] ${mine ? 'flex flex-col items-end' : ''}`}>
                  {showName && (
                    <p className="text-[13px] text-gray-600 mb-1">
                      <b className="text-gray-800">{who?.name ?? '지난 크루원'}</b>
                      {who && who.role !== 'member' && <span style={{ color: GREEN_DARK }}> · {ROLE_LABEL[who.role]}</span>}
                    </p>
                  )}
                  <div className={`flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
                    {m.kind === 'case' ? (
                      <div className="rounded-2xl bg-white border-2 px-4 py-3 min-w-0" style={{ borderColor: GREEN }}>
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-md text-white" style={{ background: GREEN }}>
                          케이스
                        </span>
                        <p className="text-[16px] text-gray-900 mt-1.5 whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                      </div>
                    ) : (
                      <p
                        className={`rounded-2xl px-4 py-2.5 text-[16px] leading-relaxed whitespace-pre-wrap break-words min-w-0 ${mine ? 'rounded-br-md text-white' : 'rounded-tl-md bg-white text-gray-900'}`}
                        style={mine ? { background: GREEN } : undefined}
                      >
                        {m.body}
                      </p>
                    )}
                    <span className="text-[12px] text-gray-400 shrink-0">{crewTime(m.created_at)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* 입력 칸에 가리지 않도록 */}
      <div className={isCase ? 'h-[150px]' : 'h-[96px]'} aria-hidden="true" />

      <div className="fixed left-0 right-0 max-w-md mx-auto z-20 bg-white border-t border-gray-100 px-3 pt-2 pb-2" style={{ bottom: 'calc(60px + env(safe-area-inset-bottom))' }}>
        {isCase && <p className="text-[13px] px-1 pb-1.5 leading-snug" style={{ color: GREEN_DARK }}>케이스로 보내요 · 회원을 알아볼 수 있는 내용은 빼 주세요</p>}
        {error && <p className="text-[13px] text-red-500 px-1 pb-1.5">{error}</p>}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={toggleCase}
            aria-pressed={isCase}
            className="min-h-[44px] px-3 rounded-full text-[14px] font-bold shrink-0 border-2"
            style={isCase ? { background: GREEN, color: '#fff', borderColor: GREEN } : { color: GREEN_DARK, borderColor: GREEN_LIGHT, background: GREEN_LIGHT }}
          >
            케이스
          </button>
          <div className="flex-1 min-w-0 flex items-end gap-1 rounded-3xl border border-gray-200 pl-4 pr-1 py-1 focus-within:border-[#0A8A7B]">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, CREW_MSG_MAX))}
              rows={1}
              placeholder="크루에게 메시지"
              aria-label="크루 채팅 메시지"
              className="flex-1 min-w-0 resize-none bg-transparent py-2 text-[16px] leading-relaxed focus:outline-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || sending}
              aria-label="보내기"
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white disabled:bg-gray-200"
              style={{ background: !text.trim() || sending ? undefined : GREEN }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 위에 고정된 공지 (대표·리더는 고치기) */
export function NoticeBar({ data, reload }: { data: MyCrew; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const isLead = data.my_role === 'owner' || data.my_role === 'leader'
  const notice = data.crew.notice
  if (!notice && !isLead) return null

  return (
    <>
      {notice ? (
        <button type="button" onClick={() => setOpen(true)} className="w-full flex items-start gap-2 px-5 py-2.5 text-left border-t border-gray-100" style={{ background: '#FAFAF7' }}>
          <span className="text-[14px] font-bold shrink-0 pt-px" style={{ color: GREEN_DARK }}>
            📌 공지
          </span>
          <span className="flex-1 min-w-0 text-[15px] text-gray-800 line-clamp-1">{notice}</span>
          <span className="text-[13px] text-gray-400 shrink-0 pt-0.5">더보기</span>
        </button>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="w-full min-h-[44px] px-5 text-left text-[14px] font-semibold border-t border-gray-100" style={{ color: GREEN_DARK }}>
          📌 크루 공지 올리기
        </button>
      )}
      {open && (
        <Sheet
          title="크루 공지"
          onClose={() => setOpen(false)}
          footer={
            isLead ? (
              <PrimaryButton
                label="공지 고치기"
                onClick={() => {
                  setOpen(false)
                  setEditing(true)
                }}
              />
            ) : undefined
          }
        >
          <p className="text-[17px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{notice}</p>
          {data.crew.notice_at && <p className="text-[13px] text-gray-400 mt-3">{new Date(data.crew.notice_at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>}
        </Sheet>
      )}
      {editing && <NoticeSheet initial={notice} onClose={() => setEditing(false)} onDone={reload} />}
    </>
  )
}

function NoticeSheet({ initial, onClose, onDone }: { initial: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async (value: string) => {
    if (busy) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('set_crew_notice', { p_text: value.trim() })
    setBusy(false)
    if (e) return setError(crewError(e))
    await onDone()
    onClose()
  }
  return (
    <Sheet title="크루 공지" onClose={onClose} footer={<PrimaryButton label={busy ? '올리는 중...' : '공지 올리기'} onClick={() => save(text)} disabled={busy || !text.trim() || text.trim() === initial} />}>
      <TextField label="공지 내용" value={text} onChange={setText} max={500} multiline rows={5} placeholder="예: 이번 주 목요일 저녁 8시 케이스 회의 (온라인)" hint="올리면 크루 채팅에도 알림이 남아요." />
      {initial && (
        <button type="button" onClick={() => save('')} disabled={busy} className="mt-3 min-h-[44px] text-[15px] font-semibold text-gray-500 underline underline-offset-2">
          공지 내리기
        </button>
      )}
      {error && <p className="text-[14px] text-red-500 mt-2">{error}</p>}
    </Sheet>
  )
}
