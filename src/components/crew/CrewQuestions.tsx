'use client'

// 크루 '질문' 탭 — 도와주세요 질문 → 크루원 답 → 질문한 사람이 '도움 됐어요'로 채택
// 채택된 답을 쓴 크루원에게 협업 점수(2)·협력 포인트(4), 크루에는 월간 미션 '도움 채택' 1회
// 질문은 1년 뒤 자동 삭제. 회원을 알아볼 수 있는 내용은 쓰지 않기.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { QA_MAX, ROLE_LABEL, crewError, crewTime, type MyCrew } from '@/lib/crew'
import Sheet from '@/components/Sheet'
import { Avatar, Spinner, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'

interface Question {
  id: number
  crew_id: string
  user_id: string | null
  body: string
  accepted_answer_id: number | null
  created_at: string
}
interface Answer {
  id: number
  question_id: number
  user_id: string | null
  body: string
  created_at: string
}

const Q_FIELDS = 'id, crew_id, user_id, body, accepted_answer_id, created_at'
const A_FIELDS = 'id, question_id, user_id, body, created_at'

export default function CrewQuestions({ data, reload }: { data: MyCrew; reload: () => Promise<void> }) {
  const crewId = data.crew.id
  const me = data.members.find((m) => m.me)?.user_id ?? ''
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'open'>('all')

  const fetchAll = useCallback(async () => {
    const { data: qs, error: e } = await supabase.from('crew_questions').select(Q_FIELDS).eq('crew_id', crewId).order('id', { ascending: false }).limit(50)
    if (e) {
      setError(crewError(e, '질문을 불러오지 못했어요. (운영자: day18 SQL 실행 필요)'))
      setQuestions([])
      return
    }
    const list = (qs as Question[]) ?? []
    const ids = list.map((q) => q.id)
    const { data: as } = ids.length ? await supabase.from('crew_answers').select(A_FIELDS).in('question_id', ids).order('id', { ascending: true }) : { data: [] }
    setQuestions(list)
    setAnswers((as as Answer[]) ?? [])
  }, [crewId])

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (alive) await fetchAll()
    }
    run()
    const channel = supabase
      .channel(`crew-qa-${crewId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crew_questions', filter: `crew_id=eq.${crewId}` }, () => fetchAll())
      .subscribe()
    const onFocus = () => fetchAll()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
    }
  }, [crewId, fetchAll])

  const ask = async () => {
    const body = text.trim()
    if (body.length < 5 || busy) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.from('crew_questions').insert({ crew_id: crewId, user_id: me, body })
    setBusy(false)
    if (e) return setError(crewError(e, '올리지 못했어요. 잠시 후 다시 시도해 주세요.'))
    setText('')
    fetchAll()
  }

  const byId = new Map(data.members.map((m) => [m.user_id, m]))
  const shown = (questions ?? []).filter((q) => filter === 'all' || q.accepted_answer_id === null)
  const opened = questions?.find((q) => q.id === openId) ?? null

  return (
    <div className="pb-8">
      <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-4">
        <h2 className="text-[17px] font-extrabold text-gray-900">🙋 도와주세요</h2>
        <p className="text-[14px] text-gray-500 mt-0.5">막히는 케이스·운동 지도 방법을 크루에게 물어보세요. 도움이 된 답을 채택하면 답한 분에게 점수가 쌓여요.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, QA_MAX))}
          rows={3}
          placeholder="예: 파킨슨 70대 남성, 보행 시작이 어려우세요. 집에서 할 수 있는 신호(구령) 연습 방법이 있을까요?"
          aria-label="질문 내용"
          className="mt-3 w-full p-3 border border-gray-200 rounded-xl text-[16px] leading-relaxed focus:outline-none focus:border-[#0A8A7B] resize-none"
        />
        <div className="flex items-center gap-2 mt-2">
          <p className="flex-1 text-[12px] text-gray-400">회원 이름·연락처·사진 등 알아볼 수 있는 내용은 빼 주세요 · {text.length}/{QA_MAX}</p>
          <button
            type="button"
            onClick={ask}
            disabled={text.trim().length < 5 || busy}
            className="min-h-[44px] px-4 rounded-xl text-[15px] font-bold text-white disabled:bg-gray-200 disabled:text-gray-400 shrink-0"
            style={{ background: text.trim().length < 5 || busy ? undefined : GREEN }}
          >
            질문 올리기
          </button>
        </div>
        {error && <p className="text-[14px] text-red-500 mt-2">{error}</p>}
      </section>

      <div className="mx-5 mt-5 flex gap-2">
        {(
          [
            ['all', '전체'],
            ['open', '답을 기다려요'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className="min-h-[40px] px-4 rounded-full text-[14px] font-bold"
            style={filter === k ? { background: '#111827', color: '#fff' } : { background: '#fff', color: '#6B7280', border: '1px solid #E5E7EB' }}
          >
            {label}
          </button>
        ))}
      </div>

      {questions === null ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <p className="text-[15px] text-gray-500 text-center py-12">{filter === 'open' ? '답을 기다리는 질문이 없어요.' : '첫 질문을 올려 보세요.'}</p>
      ) : (
        <ul className="mx-5 mt-3 space-y-2">
          {shown.map((q) => {
            const who = q.user_id ? byId.get(q.user_id) : undefined
            const n = answers.filter((a) => a.question_id === q.id).length
            const solved = q.accepted_answer_id !== null
            return (
              <li key={q.id}>
                <button type="button" onClick={() => setOpenId(q.id)} className="w-full text-left rounded-2xl bg-white border border-gray-100 p-4 active:bg-gray-50">
                  <span className="flex items-center gap-2">
                    <Avatar src={who?.photo} name={who?.name ?? '?'} size={28} />
                    <span className="flex-1 min-w-0 text-[14px] font-bold text-gray-700 truncate">{who?.name ?? '지난 크루원'}</span>
                    <span className="text-[12px] text-gray-400 shrink-0">{crewTime(q.created_at)}</span>
                  </span>
                  <span className="block text-[16px] text-gray-900 mt-2 leading-relaxed line-clamp-3 whitespace-pre-line">{q.body}</span>
                  <span className="mt-2 flex items-center gap-2">
                    {solved ? (
                      <span className="text-[13px] font-bold px-2 py-0.5 rounded-md" style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
                        ✓ 해결됐어요
                      </span>
                    ) : (
                      <span className="text-[13px] font-bold px-2 py-0.5 rounded-md" style={{ background: '#FFF4E5', color: '#B45309' }}>
                        답을 기다려요
                      </span>
                    )}
                    <span className="text-[13px] text-gray-500">답 {n}개</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {opened && (
        <QuestionSheet
          q={opened}
          answers={answers.filter((a) => a.question_id === opened.id)}
          data={data}
          me={me}
          onClose={() => setOpenId(null)}
          onChanged={async (closeSheet) => {
            if (closeSheet) setOpenId(null)
            await fetchAll()
            reload()
          }}
        />
      )}
    </div>
  )
}

function QuestionSheet({
  q, answers, data, me, onClose, onChanged,
}: {
  q: Question
  answers: Answer[]
  data: MyCrew
  me: string
  onClose: () => void
  onChanged: (closeSheet?: boolean) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const byId = new Map(data.members.map((m) => [m.user_id, m]))
  const asker = q.user_id ? byId.get(q.user_id) : undefined
  const mine = q.user_id === me
  const solved = q.accepted_answer_id !== null

  const run = async (fn: () => PromiseLike<{ error: { message?: string; code?: string } | null }>, close = false) => {
    if (busy) return
    setBusy(true)
    setError('')
    const { error: e } = await fn()
    setBusy(false)
    if (e) return setError(crewError(e))
    await onChanged(close)
  }

  const answer = () => {
    const body = text.trim()
    if (body.length < 2) return
    run(() => supabase.from('crew_answers').insert({ question_id: q.id, user_id: me, body })).then(() => setText(''))
  }

  return (
    <Sheet
      title="도와주세요"
      onClose={onClose}
      footer={
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, QA_MAX))}
            rows={2}
            placeholder="경험을 나눠 주세요"
            aria-label="답 쓰기"
            className="flex-1 min-w-0 p-3 border border-gray-200 rounded-xl text-[15px] leading-relaxed focus:outline-none focus:border-[#0A8A7B] resize-none"
          />
          <button
            type="button"
            onClick={answer}
            disabled={text.trim().length < 2 || busy}
            className="min-h-[52px] px-4 rounded-xl text-[15px] font-bold text-white disabled:bg-gray-200 disabled:text-gray-400 shrink-0"
            style={{ background: text.trim().length < 2 || busy ? undefined : GREEN }}
          >
            답하기
          </button>
        </div>
      }
    >
      <div className="flex items-center gap-2">
        <Avatar src={asker?.photo} name={asker?.name ?? '?'} size={32} />
        <p className="flex-1 text-[15px] font-bold text-gray-800">
          {asker?.name ?? '지난 크루원'}
          {asker && asker.role !== 'member' && <span className="text-[13px] font-semibold" style={{ color: GREEN_DARK }}> · {ROLE_LABEL[asker.role]}</span>}
        </p>
        <span className="text-[12px] text-gray-400">{crewTime(q.created_at)}</span>
      </div>
      <p className="mt-2 text-[17px] text-gray-900 leading-relaxed whitespace-pre-wrap break-words">{q.body}</p>
      {mine && !solved && <p className="mt-2 text-[13px] leading-snug" style={{ color: GREEN_DARK }}>도움이 된 답에서 ‘이 답이 도움 됐어요’를 눌러 주세요.</p>}

      <h3 className="mt-5 text-[15px] font-extrabold text-gray-900">답 {answers.length}</h3>
      {answers.length === 0 && <p className="text-[14px] text-gray-500 mt-2">아직 답이 없어요. 경험을 나눠 주세요.</p>}
      <ul className="mt-2 space-y-2">
        {answers.map((a) => {
          const who = a.user_id ? byId.get(a.user_id) : undefined
          const accepted = q.accepted_answer_id === a.id
          return (
            <li key={a.id} className="rounded-xl p-3" style={accepted ? { background: GREEN_LIGHT, border: `2px solid ${GREEN}` } : { background: '#F9FAFB' }}>
              <div className="flex items-center gap-2">
                <Avatar src={who?.photo} name={who?.name ?? '?'} size={26} />
                <span className="flex-1 min-w-0 text-[14px] font-bold text-gray-700 truncate">{who?.name ?? '지난 크루원'}</span>
                {accepted && <span className="text-[12px] font-bold" style={{ color: GREEN_DARK }}>👍 도움 됐어요</span>}
                <span className="text-[12px] text-gray-400 shrink-0">{crewTime(a.created_at)}</span>
              </div>
              <p className="mt-1.5 text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{a.body}</p>
              <div className="mt-2 flex flex-wrap gap-2 justify-end">
                {mine && !solved && a.user_id !== me && (
                  <button type="button" disabled={busy} onClick={() => run(() => supabase.rpc('accept_answer', { p_answer: a.id }))} className="min-h-[40px] px-3 rounded-lg text-[14px] font-bold text-white" style={{ background: GREEN }}>
                    이 답이 도움 됐어요
                  </button>
                )}
                {who && !who.me && !who.hearted && data.hearts_left > 0 && (
                  <button type="button" disabled={busy} onClick={() => run(() => supabase.rpc('give_heart', { p_user: who.user_id }))} className="min-h-[40px] px-3 rounded-lg border border-rose-100 bg-rose-50 text-[14px] font-bold text-rose-600">
                    ❤ 좋아요
                  </button>
                )}
                {a.user_id === me && !accepted && (
                  <button type="button" disabled={busy} onClick={() => confirm('내 답을 지울까요?') && run(() => supabase.from('crew_answers').delete().eq('id', a.id))} className="min-h-[40px] px-2 text-[13px] font-semibold text-gray-400 underline underline-offset-2">
                    지우기
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {mine && !solved && (
        <button type="button" disabled={busy} onClick={() => confirm('질문을 지울까요? 달린 답도 함께 지워져요.') && run(() => supabase.from('crew_questions').delete().eq('id', q.id), true)} className="mt-4 min-h-[44px] text-[14px] font-semibold text-gray-400 underline underline-offset-2">
          질문 지우기
        </button>
      )}
      {error && <p className="text-[14px] text-red-500 mt-2">{error}</p>}
      <div className="h-2" />
    </Sheet>
  )
}
