'use client'

// 채팅방 위 '다음 방문' 막대 + 일정·회차 창
// · 회원: 다가오는 일정 '확인했어요' / '시간 바꾸고 싶어요'(채팅으로 전달), 지난 방문 '진행 완료' / '진행 안 했어요'
// · 전문가: 회원이 확인했는지 보기, 지난 방문 '진행 완료 표시', 일정 잡기

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { notifyPush } from '@/lib/push'
import {
  VISIT_GOAL, dayGap, nextVisit, visitError, visitKindLabel, visitToAsk, visitWhen, visitColor, type RoomVisits, type VisitItem,
} from '@/lib/visits'
import Sheet from '@/components/Sheet'
import { GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'

/** 화면에 쓸 '지금' (1분마다 갱신) */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}

export default function VisitBar({
  roomId, isGuardian, canSend, refreshKey, onMessage,
}: {
  roomId: string
  isGuardian: boolean
  canSend: boolean
  refreshKey?: number
  /** 회원이 '시간 바꾸고 싶어요'로 채팅 메시지를 보냈을 때 */
  onMessage?: (messageId: number) => void
}) {
  const [data, setData] = useState<RoomVisits | null>(null)
  const [open, setOpen] = useState(false)
  const [changing, setChanging] = useState<VisitItem | null>(null)
  const [busy, setBusy] = useState(false)
  const now = useNow()

  const load = useCallback(async () => {
    const { data: d, error } = await supabase.rpc('room_visits', { p_room: roomId })
    if (!error) setData((d as RoomVisits | null) ?? null)
  }, [roomId])

  useEffect(() => {
    let alive = true
    supabase.rpc('room_visits', { p_room: roomId }).then(({ data: d, error }) => {
      if (alive && !error) setData((d as RoomVisits | null) ?? null)
    })
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    const t = window.setInterval(load, 60_000)
    return () => {
      alive = false
      window.removeEventListener('focus', onFocus)
      window.clearInterval(t)
    }
  }, [roomId, load, refreshKey])

  const run = async (fn: () => PromiseLike<{ error: { message?: string; code?: string } | null }>) => {
    if (busy) return
    setBusy(true)
    const { error } = await fn()
    setBusy(false)
    if (error) return alert(visitError(error))
    load()
  }
  const answer = (it: VisitItem) => run(() => supabase.rpc('answer_visit', { p_id: it.id, p_answer: 'confirmed', p_note: '' }))
  const result = (it: VisitItem, r: 'done' | 'missed' | null) => run(() => supabase.rpc('record_visit_result', { p_id: it.id, p_result: r }))
  const expertDone = (it: VisitItem, on: boolean) =>
    run(() => supabase.from('expert_schedule').update({ expert_done_at: on ? new Date().toISOString() : null }).eq('id', it.id))

  if (!data) return null
  const next = nextVisit(data.items, now)
  // 창 목록: 다가오는 일정 먼저, 지난 일정은 최근 것부터
  const upcoming = data.items.filter((i) => new Date(i.ends_at).getTime() > now)
  const past = data.items.filter((i) => new Date(i.ends_at).getTime() <= now).reverse()
  const listed = [...upcoming, ...past]
  const ask = isGuardian
    ? visitToAsk(data.items, now)
    : [...data.items].reverse().find((i) => i.kind !== 'consult' && !i.expert_done && i.member_result === null && new Date(i.starts_at).getTime() <= now) ?? null

  // 일정이 하나도 없으면: 전문가에게만 '일정 잡기' 안내
  if (!next && !ask) {
    if (isGuardian) return null
    return (
      <Link href={`/schedule?room=${roomId}`} className="bg-white border-b border-gray-100 px-5 min-h-[44px] flex items-center gap-2 text-[14px]">
        <span aria-hidden="true">📅</span>
        <span className="flex-1 text-gray-600">다음 일정을 잡으면 회원에게도 보여요</span>
        <span className="font-bold shrink-0" style={{ color: GREEN_DARK }}>
          일정 잡기 ›
        </span>
      </Link>
    )
  }

  return (
    <>
      {next && (
        <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-3">
          <button type="button" onClick={() => setOpen(true)} className="flex-1 min-w-0 flex items-center gap-3 text-left min-h-[48px]">
            <span className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0" style={{ background: visitColor(next.kind).bg, color: visitColor(next.kind).color }}>
              <span className="text-[11px] font-bold leading-none">{new Date(next.starts_at).getMonth() + 1}월</span>
              <span className="text-[17px] font-extrabold leading-tight">{new Date(next.starts_at).getDate()}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold text-gray-900 truncate">
                {new Date(next.starts_at).getTime() <= now ? '지금 진행 중' : `다음 ${next.kind === 'consult' ? '상담' : '방문'} · ${dayGap(next.starts_at, now)}`}{' '}
                <span className="text-gray-600 font-semibold">{visitWhen(next.starts_at).replace(/^\d+월 \d+일 /, '')}</span>
              </span>
              <span className="block text-[13px] text-gray-500 truncate">
                {next.session_no ? `${next.session_no}회째 · ` : ''}
                {visitKindLabel(next.kind)}
                {next.place ? ` · ${next.place}` : ''}
              </span>
            </span>
          </button>
          {isGuardian ? (
            next.member_answer === 'none' && new Date(next.starts_at).getTime() > now ? (
              <button type="button" onClick={() => setOpen(true)} className="min-h-[40px] px-3 rounded-lg text-[14px] font-bold text-white shrink-0" style={{ background: GREEN }}>
                확인하기
              </button>
            ) : (
              <AnswerChip answer={next.member_answer} member />
            )
          ) : (
            <AnswerChip answer={next.member_answer} />
          )}
        </div>
      )}

      {ask && (
        <div className="border-b px-4 py-2 flex items-center gap-2" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <p className="flex-1 min-w-0 text-[14px] text-gray-800 leading-snug">
            {visitWhen(ask.starts_at).replace(/ (오전|오후).*/, '')} {isGuardian ? '방문, 진행하셨나요?' : '방문 · 진행했다면 표시해 주세요'}
          </p>
          {isGuardian ? (
            <>
              <button type="button" disabled={busy} onClick={() => result(ask, 'missed')} className="min-h-[40px] px-2.5 rounded-lg border border-gray-200 bg-white text-[13px] font-semibold text-gray-600 shrink-0">
                안 했어요
              </button>
              <button type="button" disabled={busy} onClick={() => result(ask, 'done')} className="min-h-[40px] px-3 rounded-lg text-[14px] font-bold text-white shrink-0" style={{ background: GREEN }}>
                진행 완료
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => expertDone(ask, true)} className="min-h-[40px] px-3 rounded-lg text-[14px] font-bold text-white shrink-0" style={{ background: GREEN }}>
              진행 완료 표시
            </button>
          )}
        </div>
      )}

      {open && (
        <Sheet
          title={isGuardian ? '방문 일정' : '이 회원과의 일정'}
          onClose={() => setOpen(false)}
          footer={
            !isGuardian ? (
              <Link href={`/schedule?room=${roomId}`} className="flex w-full min-h-[52px] rounded-xl text-white text-[16px] font-bold items-center justify-center" style={{ background: GREEN }}>
                스케줄에서 일정 잡기·고치기
              </Link>
            ) : undefined
          }
        >
          <Progress verified={data.verified} isGuardian={isGuardian} />
          <ul className="mt-4 space-y-2">
            {listed.map((it) => {
              const started = new Date(it.starts_at).getTime() <= now
              const c = visitColor(it.kind)
              return (
                <li key={it.id} className="rounded-2xl border border-gray-100 p-3.5" style={{ opacity: it.member_result === 'missed' ? 0.6 : 1 }}>
                  <div className="flex items-start gap-2">
                    <span className="text-[12px] font-bold px-2 py-0.5 rounded-md shrink-0 mt-0.5" style={{ background: c.bg, color: c.color }}>
                      {it.session_no ? `${it.session_no}회째` : visitKindLabel(it.kind)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[16px] font-bold text-gray-900">{visitWhen(it.starts_at)}</span>
                      <span className="block text-[13px] text-gray-500 truncate">
                        {!isGuardian && it.title ? `${it.title} · ` : ''}
                        {visitKindLabel(it.kind)}
                        {it.place ? ` · ${it.place}` : ''}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {!started && <AnswerChip answer={it.member_answer} member={isGuardian} />}
                    {started && it.kind !== 'consult' && <ResultChip result={it.member_result} expertDone={it.expert_done} />}
                    <span className="flex-1" />
                    {isGuardian && !started && it.member_answer !== 'confirmed' && (
                      <button type="button" disabled={busy} onClick={() => answer(it)} className="min-h-[40px] px-3 rounded-lg text-[14px] font-bold text-white" style={{ background: GREEN }}>
                        확인했어요
                      </button>
                    )}
                    {isGuardian && !started && canSend && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setOpen(false)
                          setChanging(it)
                        }}
                        className="min-h-[40px] px-3 rounded-lg border border-gray-200 text-[14px] font-semibold text-gray-600"
                      >
                        시간 바꾸고 싶어요
                      </button>
                    )}
                    {isGuardian && started && it.kind !== 'consult' &&
                      (it.member_result === null ? (
                        <>
                          <button type="button" disabled={busy} onClick={() => result(it, 'missed')} className="min-h-[40px] px-3 rounded-lg border border-gray-200 text-[14px] font-semibold text-gray-600">
                            안 했어요
                          </button>
                          <button type="button" disabled={busy} onClick={() => result(it, 'done')} className="min-h-[40px] px-3 rounded-lg text-[14px] font-bold text-white" style={{ background: GREEN }}>
                            진행 완료
                          </button>
                        </>
                      ) : (
                        <button type="button" disabled={busy} onClick={() => result(it, null)} className="min-h-[40px] px-3 rounded-lg text-[13px] font-semibold text-gray-500 underline underline-offset-2">
                          되돌리기
                        </button>
                      ))}
                    {!isGuardian && started && it.kind !== 'consult' && it.member_result === null && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => expertDone(it, !it.expert_done)}
                        className="min-h-[40px] px-3 rounded-lg text-[14px] font-bold"
                        style={it.expert_done ? { color: '#6B7280' } : { background: GREEN, color: '#fff' }}
                      >
                        {it.expert_done ? '표시 취소' : '진행 완료 표시'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="text-[13px] text-gray-500 mt-3 leading-relaxed">
            {isGuardian
              ? '일정은 전문가가 잡아요. 시간을 바꾸고 싶으면 버튼을 누르거나 채팅으로 말씀해 주세요.'
              : '회원에게는 날짜·시간·장소·종류만 보여요 (제목·메모는 나만). 회원이 ‘진행 완료’를 누른 방문만 확인된 회차로 세요.'}
          </p>
        </Sheet>
      )}

      {changing && (
        <ChangeSheet
          item={changing}
          onClose={() => setChanging(null)}
          onSent={(msgId) => {
            setChanging(null)
            load()
            if (msgId) {
              notifyPush({ type: 'message', message_id: msgId })
              onMessage?.(msgId)
            }
          }}
        />
      )}
    </>
  )
}

function Progress({ verified, isGuardian }: { verified: number; isGuardian: boolean }) {
  const shown = Math.min(verified, VISIT_GOAL)
  return (
    <div className="rounded-2xl p-4" style={{ background: GREEN_LIGHT }}>
      <p className="text-[15px] font-bold" style={{ color: GREEN_DARK }}>
        {isGuardian ? '진행 완료를 누른 방문' : '회원이 확인한 회차'} <span className="text-[20px] font-extrabold">{verified}회</span>
      </p>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {Array.from({ length: VISIT_GOAL }, (_, i) => (
          <span key={i} className="flex-1 h-2 rounded-full" style={{ background: i < shown ? GREEN : '#FFFFFF' }} />
        ))}
      </div>
      <p className="text-[12px] text-gray-600 mt-1.5">
        {isGuardian
          ? '방문이 끝나면 ‘진행 완료’를 눌러 함께 기록해 주세요.'
          : verified >= VISIT_GOAL
            ? '10회를 채웠어요. 채팅 메뉴에서 진행 후기를 쓸 수 있어요.'
            : `10회가 되면 진행 후기에 ‘앱 기록으로 확인한 회차’가 함께 표시돼요.`}
      </p>
    </div>
  )
}

function AnswerChip({ answer, member }: { answer: VisitItem['member_answer']; member?: boolean }) {
  const s =
    answer === 'confirmed'
      ? { t: member ? '✓ 확인했어요' : '✓ 회원 확인', bg: GREEN_LIGHT, c: GREEN_DARK }
      : answer === 'change'
        ? { t: '변경 요청', bg: '#FFF4E5', c: '#B45309' }
        : { t: '확인 전', bg: '#F2F4F6', c: '#6B7280' }
  return (
    <span className="inline-flex items-center min-h-[28px] px-2.5 rounded-md text-[13px] font-bold shrink-0 whitespace-nowrap" style={{ background: s.bg, color: s.c }}>
      {s.t}
    </span>
  )
}

function ResultChip({ result, expertDone }: { result: VisitItem['member_result']; expertDone: boolean }) {
  const s =
    result === 'done'
      ? { t: '✓ 진행 완료', bg: GREEN_LIGHT, c: GREEN_DARK }
      : result === 'missed'
        ? { t: '진행 안 함', bg: '#F2F4F6', c: '#6B7280' }
        : expertDone
          ? { t: '전문가 완료 표시 · 회원 확인 전', bg: '#FFF4E5', c: '#B45309' }
          : { t: '진행 확인 전', bg: '#F2F4F6', c: '#6B7280' }
  return (
    <span className="inline-flex items-center min-h-[28px] px-2.5 rounded-md text-[13px] font-bold whitespace-nowrap" style={{ background: s.bg, color: s.c }}>
      {s.t}
    </span>
  )
}

function ChangeSheet({ item, onClose, onSent }: { item: VisitItem; onClose: () => void; onSent: (messageId: number | null) => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const send = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    const { data, error: e } = await supabase.rpc('answer_visit', { p_id: item.id, p_answer: 'change', p_note: note.trim() })
    setBusy(false)
    if (e) return setError(visitError(e))
    onSent(typeof data === 'number' ? data : null)
  }
  return (
    <Sheet
      title="시간을 바꾸고 싶어요"
      onClose={onClose}
      footer={
        <button type="button" onClick={send} disabled={busy} className="w-full min-h-[52px] rounded-xl text-[16px] font-bold text-white disabled:opacity-60" style={{ background: GREEN }}>
          {busy ? '보내는 중...' : '전문가에게 보내기'}
        </button>
      }
    >
      <p className="text-[15px] text-gray-700">
        <b>{visitWhen(item.starts_at)}</b> {visitKindLabel(item.kind)}
      </p>
      <p className="text-[14px] text-gray-500 mt-1">채팅으로 전문가에게 전달돼요. 편한 시간을 함께 적어 주시면 빨라요.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {['오전이 좋아요', '오후가 좋아요', '다른 요일이 좋아요', '이번 주는 쉬고 싶어요'].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setNote((n) => (n.includes(q) ? n : (n ? n + ' ' : '') + q))}
            className="min-h-[44px] px-3 rounded-full border-2 text-[14px] font-semibold"
            style={{ borderColor: GREEN_LIGHT, background: GREEN_LIGHT, color: GREEN_DARK }}
          >
            {q}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 200))}
        rows={3}
        placeholder="예: 목요일 오후 3시 이후면 좋아요"
        className="mt-3 w-full p-3 border border-gray-200 rounded-xl text-[15px] leading-relaxed focus:outline-none focus:border-[#0A8A7B] resize-none"
      />
      {error && <p className="text-[14px] text-red-500 mt-2">{error}</p>}
    </Sheet>
  )
}
