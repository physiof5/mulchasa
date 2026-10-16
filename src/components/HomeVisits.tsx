'use client'

// 회원 모드 홈 맨 위 '다음 방문' 카드 — 전문가가 잡은 일정을 바로 확인하고, 지난 방문은 진행 여부를 한 번에 기록
// 로그인하지 않았거나 잡힌 일정이 없으면 아무것도 보이지 않는다.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuthUser } from '@/lib/auth'
import { VISIT_GOAL, dayGap, visitError, visitKindLabel, visitWhen, visitColor, type VisitCard } from '@/lib/visits'
import { useNow } from '@/components/VisitBar'
import { Avatar, GREEN, GREEN_DARK } from '@/components/ConsultParts'

export default function HomeVisits() {
  const user = useAuthUser()
  const [cards, setCards] = useState<VisitCard[]>([])
  const [busy, setBusy] = useState(false)
  const now = useNow()

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_visit_cards')
    if (!error) setCards(Array.isArray(data) ? (data as VisitCard[]) : [])
  }, [])

  useEffect(() => {
    if (!user) return
    let alive = true
    supabase.rpc('my_visit_cards').then(({ data, error }) => {
      if (alive && !error) setCards(Array.isArray(data) ? (data as VisitCard[]) : [])
    })
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      window.removeEventListener('focus', onFocus)
    }
  }, [user, load])

  const run = async (fn: string, args: Record<string, unknown>) => {
    if (busy) return
    setBusy(true)
    const { error } = await supabase.rpc(fn, args)
    setBusy(false)
    if (error) return alert(visitError(error))
    load()
  }

  if (!user || cards.length === 0) return null

  return (
    <section className="px-5 pt-2 space-y-2.5">
      {cards.map((c) => (
        <div key={c.room_id} className="rounded-2xl bg-white border-2 p-4" style={{ borderColor: '#D5EFEB' }}>
          <div className="flex items-center gap-2.5">
            <Avatar src={c.therapist.photo} name={c.therapist.name} size={36} />
            <p className="flex-1 min-w-0 text-[15px] font-bold text-gray-800 truncate">{c.therapist.name} 물리치료사</p>
            <span className="text-[13px] font-bold shrink-0" style={{ color: GREEN_DARK }}>
              진행 완료 {c.verified}/{VISIT_GOAL}회
            </span>
          </div>

          {c.next && (
            <Link href={`/chat/${c.room_id}`} className="mt-3 flex items-center gap-3">
              <span className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0" style={{ background: visitColor(c.next.kind).bg, color: visitColor(c.next.kind).color }}>
                <span className="text-[11px] font-bold leading-none">{new Date(c.next.starts_at).getMonth() + 1}월</span>
                <span className="text-[19px] font-extrabold leading-tight">{new Date(c.next.starts_at).getDate()}</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold" style={{ color: GREEN }}>
                  {new Date(c.next.starts_at).getTime() <= now ? '지금 진행 중' : `다음 ${c.next.kind === 'consult' ? '상담' : '방문'} · ${dayGap(c.next.starts_at, now)}`}
                </span>
                <span className="block text-[17px] font-extrabold text-gray-900 truncate">{visitWhen(c.next.starts_at).replace(/^\d+월 \d+일 /, '')}</span>
                <span className="block text-[13px] text-gray-500 truncate">
                  {visitKindLabel(c.next.kind)}
                  {c.next.place ? ` · ${c.next.place}` : ''}
                </span>
              </span>
              <span className="text-gray-300 text-xl shrink-0" aria-hidden="true">
                ›
              </span>
            </Link>
          )}
          {c.next && new Date(c.next.starts_at).getTime() > now && (
            <div className="mt-3">
              {c.next.member_answer === 'none' ? (
                <div className="grid grid-cols-[1fr_1.4fr] gap-2">
                  <Link href={`/chat/${c.room_id}`} className="min-h-[48px] rounded-xl border border-gray-200 text-[15px] font-semibold text-gray-600 flex items-center justify-center">
                    시간 바꾸기
                  </Link>
                  <button type="button" disabled={busy} onClick={() => run('answer_visit', { p_id: c.next!.id, p_answer: 'confirmed', p_note: '' })} className="min-h-[48px] rounded-xl text-[16px] font-bold text-white" style={{ background: GREEN }}>
                    확인했어요
                  </button>
                </div>
              ) : (
                <p className="text-[14px] font-semibold" style={{ color: c.next.member_answer === 'confirmed' ? GREEN_DARK : '#B45309' }}>
                  {c.next.member_answer === 'confirmed' ? '✓ 일정을 확인했어요' : '시간 변경을 요청했어요 · 전문가 답을 기다리는 중'}
                </p>
              )}
            </div>
          )}

          {c.ask && (
            <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: '#FFFBEB' }}>
              <p className="text-[15px] text-gray-800">
                <b>{visitWhen(c.ask.starts_at).replace(/ (오전|오후).*/, '')}</b> 방문, 진행하셨나요?
              </p>
              <div className="mt-2 grid grid-cols-[1fr_1.4fr] gap-2">
                <button type="button" disabled={busy} onClick={() => run('record_visit_result', { p_id: c.ask!.id, p_result: 'missed' })} className="min-h-[44px] rounded-lg border border-gray-200 bg-white text-[14px] font-semibold text-gray-600">
                  안 했어요
                </button>
                <button type="button" disabled={busy} onClick={() => run('record_visit_result', { p_id: c.ask!.id, p_result: 'done' })} className="min-h-[44px] rounded-lg text-[15px] font-bold text-white" style={{ background: GREEN }}>
                  진행 완료
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
