'use client'

// 전문가 모드 '스케줄' — 한 주 달력 + 고른 날의 일정
// · 일정 추가·수정·삭제 (방문 지도 / 센터 지도 / 상담 / 개인 일정 / 휴무)
// · 수락한 상담 대화와 연결할 수 있음 (채팅 메뉴 '스케줄에 일정 잡기' → ?room=대화방)
// · 일정은 나만 볼 수 있음. 지난 일정은 1년 뒤 자동 삭제.

import { use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuthUser } from '@/lib/auth'
import { useIsClient } from '@/lib/useDeviceStorage'
import BottomNav from '@/components/BottomNav'
import { LoginNeeded, Spinner, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'
import { consultTitle, type ConsultAnswers } from '@/lib/consult'
import {
  MEMO_MAX, PLACE_MAX, SCHEDULE_FIELDS, SCHEDULE_KINDS, TITLE_MAX, addDays, dateKey, dateLabel, dayName, fromDateKey, hhmm, itemState, kindInfo,
  toIso, todayKey, weekStart, type ScheduleItem, type ScheduleKind,
} from '@/lib/schedule'

interface RoomOption {
  id: string
  label: string
  /** 일정 제목 기본값 (예: '어머님 방문 운동 지도') */
  suggest: string
}

interface RoomRow {
  id: string
  role: 'guardian' | 'expert'
  consult: { id: string; who: ConsultAnswers['who']; age: ConsultAnswers['age']; area_label: string } | null
}

type Draft = {
  id?: string
  kind: ScheduleKind
  title: string
  day: string
  start: string
  end: string
  place: string
  memo: string
  room_id: string
}

const PLACEHOLDER: Record<ScheduleKind, string> = {
  visit: '예: 어머님 방문 운동 지도',
  center: '예: 센터 1:1 운동 지도',
  consult: '예: 첫 상담 통화',
  personal: '예: 보수 교육',
  off: '휴무',
}

function friendly(err: { code?: string; message?: string } | null): string {
  if (!err) return '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
  if (err.code === '42P01' || err.code === 'PGRST205' || err.message?.includes('expert_schedule')) return '스케줄 준비 중이에요. (운영자: day15 SQL 실행 필요)'
  if (err.message?.includes('time_check')) return '끝나는 시간을 시작보다 뒤로 맞춰 주세요. (하루 안에서만)'
  if (err.message?.includes('row-level security')) return '전문가 계정만 일정을 저장할 수 있어요.'
  return '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

export default function SchedulePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = use(searchParams)
  const room = typeof params.room === 'string' ? params.room : null
  const user = useAuthUser()
  const isClient = useIsClient()

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      {user === null ? (
        <>
          <Header />
          <LoginNeeded title={'로그인하면\n스케줄을 관리할 수 있어요'} desc="전문가 회원만 쓸 수 있어요." next="/schedule" />
        </>
      ) : user === undefined || !isClient ? (
        <>
          <Header />
          <Spinner />
        </>
      ) : (
        <Schedule roomParam={room} />
      )}
      <BottomNav />
    </main>
  )
}

function Header({ right }: { right?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-3 flex items-center">
      <h1 className="flex-1 text-[22px] font-extrabold text-gray-900">스케줄</h1>
      {right}
    </div>
  )
}

function Schedule({ roomParam }: { roomParam: string | null }) {
  const [selected, setSelected] = useState<string>(todayKey)
  const [items, setItems] = useState<ScheduleItem[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [rooms, setRooms] = useState<RoomOption[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [reload, setReload] = useState(0)
  const roomOpened = useRef(false)

  const ws = useMemo(() => weekStart(fromDateKey(selected)), [selected])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(ws, i)), [ws])
  const wsKey = dateKey(ws)

  // 이번 주 일정
  useEffect(() => {
    let alive = true
    const from = fromDateKey(wsKey)
    supabase
      .from('expert_schedule')
      .select(SCHEDULE_FIELDS)
      .gte('starts_at', from.toISOString())
      .lt('starts_at', addDays(from, 7).toISOString())
      .order('starts_at', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return
        setLoadError(error ? friendly(error) : '')
        setItems((data as ScheduleItem[]) ?? [])
      })
    return () => {
      alive = false
    }
  }, [wsKey, reload])

  // 연결할 수 있는 대화 (내가 수락한 상담)
  useEffect(() => {
    let alive = true
    supabase.rpc('my_chat_rooms').then(({ data }) => {
      if (!alive) return
      const list = (Array.isArray(data) ? (data as RoomRow[]) : [])
        .filter((r) => r.role === 'expert')
        .map((r) => ({
          id: r.id,
          label: r.consult ? `${consultTitle(r.consult)} · ${r.consult.area_label}` : '상담 대화',
          suggest: r.consult ? `${consultTitle(r.consult).replace(/ 상담$/, '')} 방문 운동 지도` : '방문 운동 지도',
        }))
      setRooms(list)
      // 채팅에서 '스케줄에 일정 잡기'로 들어온 경우: 그 대화를 연결한 새 일정 창을 연다
      if (roomParam && !roomOpened.current) {
        roomOpened.current = true
        const target = list.find((r) => r.id === roomParam)
        setDraft(newDraft(todayKey(), target ? { room_id: target.id, title: target.suggest } : {}))
      }
    })
    return () => {
      alive = false
    }
  }, [roomParam])

  const byDay = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {}
    ;(items ?? []).forEach((it) => {
      const k = dateKey(new Date(it.starts_at))
      ;(map[k] ||= []).push(it)
    })
    return map
  }, [items])

  const today = todayKey()
  const sel = fromDateKey(selected)
  const dayItems = byDay[selected] ?? []
  const roomLabel = (id: string | null) => rooms.find((r) => r.id === id)?.label

  return (
    <>
      <Header
        right={
          selected !== today && (
            <button type="button" onClick={() => setSelected(today)} className="min-h-[40px] px-3 rounded-lg border border-gray-200 text-[14px] font-semibold text-gray-600">
              오늘
            </button>
          )
        }
      />

      {/* 한 주 */}
      <section className="bg-white px-3 pt-3 pb-4 border-b border-gray-100">
        <div className="flex items-center px-2">
          <p className="flex-1 text-[16px] font-bold text-gray-800">
            {sel.getFullYear()}년 {sel.getMonth() + 1}월
          </p>
          <button type="button" aria-label="지난주" onClick={() => setSelected(dateKey(addDays(sel, -7)))} className="w-11 h-11 flex items-center justify-center text-gray-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" aria-label="다음 주" onClick={() => setSelected(dateKey(addDays(sel, 7)))} className="w-11 h-11 flex items-center justify-center text-gray-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const k = dateKey(d)
            const isSel = k === selected
            const isToday = k === today
            const count = byDay[k]?.length ?? 0
            const sunday = d.getDay() === 0
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                aria-pressed={isSel}
                aria-label={`${dateLabel(d)}${count ? `, 일정 ${count}개` : ''}`}
                className="min-h-[68px] rounded-2xl flex flex-col items-center justify-center gap-1"
                style={isSel ? { background: GREEN, color: '#fff' } : isToday ? { background: GREEN_LIGHT, color: GREEN_DARK } : { color: sunday ? '#DC2626' : '#374151' }}
              >
                <span className="text-[12px] font-semibold opacity-80">{dayName(d)}</span>
                <span className="text-[18px] font-extrabold leading-none">{d.getDate()}</span>
                <span className="h-1.5 flex gap-0.5" aria-hidden="true">
                  {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: isSel ? '#fff' : GREEN }} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* 고른 날 */}
      <section className="px-5 pt-5 pb-6">
        <div className="flex items-center">
          <h2 className="flex-1 text-[18px] font-extrabold text-gray-900">
            {dateLabel(sel)}
            {selected === today && <span className="ml-1.5 text-[14px] font-bold" style={{ color: GREEN }}>오늘</span>}
          </h2>
          <button
            type="button"
            onClick={() => setDraft(newDraft(selected))}
            className="min-h-[44px] px-4 rounded-xl text-white text-[15px] font-bold"
            style={{ background: GREEN }}
          >
            + 일정 추가
          </button>
        </div>

        {loadError && <p className="mt-4 rounded-xl bg-amber-50 text-amber-900 text-[14px] px-4 py-3">{loadError}</p>}

        <div className="mt-4 space-y-2.5">
          {items === null ? (
            <div className="h-[84px] rounded-2xl bg-white animate-pulse" />
          ) : dayItems.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center">
              <p className="text-[16px] font-bold text-gray-700">일정이 없어요</p>
              <p className="text-[14px] text-gray-500 mt-1">방문·센터 지도, 상담, 휴무를 적어 두면 한눈에 볼 수 있어요.</p>
            </div>
          ) : (
            dayItems.map((it) => {
              const k = kindInfo(it.kind)
              const st = itemState(it)
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setDraft(toDraft(it))}
                  className="w-full text-left rounded-2xl bg-white border p-4 flex gap-3 active:scale-[0.99] transition-all"
                  style={{ borderColor: st === 'now' ? GREEN : '#F3F4F6', opacity: st === 'past' ? 0.6 : 1 }}
                >
                  <span className="w-[52px] shrink-0 text-center">
                    <span className="block text-[16px] font-extrabold text-gray-900 tabular-nums">{hhmm(it.starts_at)}</span>
                    <span className="block text-[13px] text-gray-400 tabular-nums">{hhmm(it.ends_at)}</span>
                  </span>
                  <span className="w-1 rounded-full shrink-0" style={{ background: k.color }} aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[12px] font-bold px-2 py-0.5 rounded-md" style={{ background: k.bg, color: k.color }}>
                        {k.label}
                      </span>
                      {st === 'now' && <span className="text-[12px] font-bold" style={{ color: GREEN }}>진행 중</span>}
                    </span>
                    <span className="block text-[16px] font-bold text-gray-900 mt-1 truncate">{it.title}</span>
                    {it.place && <span className="block text-[14px] text-gray-500 truncate">📍 {it.place}</span>}
                    {it.room_id && <span className="block text-[13px] mt-0.5 truncate" style={{ color: GREEN_DARK }}>💬 {roomLabel(it.room_id) ?? '연결된 대화'}</span>}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <Link href="/mypage?edit=1" className="mt-6 flex items-center min-h-[52px] px-4 rounded-xl bg-white border border-gray-100 text-[15px] text-gray-700">
          <span className="flex-1">회원에게 보이는 &lsquo;활동 가능 시간&rsquo; 바꾸기</span>
          <span className="text-gray-300" aria-hidden="true">
            ›
          </span>
        </Link>
        <p className="mt-3 text-[13px] text-gray-400 leading-relaxed">일정은 나만 볼 수 있어요. 지난 일정은 1년 뒤 자동으로 지워져요.</p>
      </section>

      {draft && (
        <ScheduleSheet
          draft={draft}
          rooms={rooms}
          onClose={() => setDraft(null)}
          onSaved={(day) => {
            setDraft(null)
            setSelected(day)
            setReload((n) => n + 1)
          }}
        />
      )}
    </>
  )
}

function newDraft(day: string, extra: Partial<Draft> = {}): Draft {
  return { kind: 'visit', title: '', day, start: '10:00', end: '11:00', place: '', memo: '', room_id: '', ...extra }
}

function toDraft(it: ScheduleItem): Draft {
  return {
    id: it.id,
    kind: it.kind,
    title: it.title,
    day: dateKey(new Date(it.starts_at)),
    start: hhmm(it.starts_at),
    end: hhmm(it.ends_at),
    place: it.place,
    memo: it.memo,
    room_id: it.room_id ?? '',
  }
}

function ScheduleSheet({ draft: init, rooms, onClose, onSaved }: { draft: Draft; rooms: RoomOption[]; onClose: () => void; onSaved: (day: string) => void }) {
  const [d, setD] = useState<Draft>(init)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const title = d.title.trim() || (d.kind === 'off' ? '휴무' : '')
  const timeOk = d.end > d.start
  const canSave = !!title && !!d.day && timeOk && !busy

  const save = useCallback(async () => {
    if (!canSave) return
    setBusy(true)
    setError('')
    const { data: s } = await supabase.auth.getSession()
    const uid = s.session?.user.id
    if (!uid) {
      setError('로그인이 필요해요.')
      setBusy(false)
      return
    }
    const row = {
      kind: d.kind,
      title: title.slice(0, TITLE_MAX),
      starts_at: toIso(d.day, d.start),
      ends_at: toIso(d.day, d.end),
      place: d.place.trim().slice(0, PLACE_MAX),
      memo: d.memo.trim().slice(0, MEMO_MAX),
      room_id: d.room_id || null,
    }
    const { error: e } = d.id
      ? await supabase.from('expert_schedule').update(row).eq('id', d.id)
      : await supabase.from('expert_schedule').insert({ ...row, user_id: uid })
    setBusy(false)
    if (e) return setError(friendly(e))
    onSaved(d.day)
  }, [canSave, d, title, onSaved])

  const remove = async () => {
    if (!d.id || !confirm('이 일정을 지울까요?')) return
    setBusy(true)
    const { error: e } = await supabase.from('expert_schedule').delete().eq('id', d.id)
    setBusy(false)
    if (e) return setError(friendly(e))
    onSaved(d.day)
  }

  const input = 'w-full min-h-[48px] px-4 border border-gray-200 rounded-xl text-[16px] focus:outline-none focus:border-[#0A8A7B] bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={d.id ? '일정 고치기' : '일정 추가'}>
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center">
          <p className="flex-1 text-[20px] font-extrabold text-gray-900">{d.id ? '일정 고치기' : '일정 추가'}</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-10 h-10 -mr-2 flex items-center justify-center text-gray-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SCHEDULE_KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={d.kind === k.value}
              onClick={() => set('kind', k.value)}
              className="min-h-[40px] px-3.5 rounded-full border-2 text-[14px] font-bold"
              style={d.kind === k.value ? { borderColor: k.color, background: k.bg, color: k.color } : { borderColor: '#E5E7EB', color: '#6B7280' }}
            >
              {k.label}
            </button>
          ))}
        </div>

        <label className="block mt-4">
          <span className="text-[14px] font-bold text-gray-700">제목</span>
          <input value={d.title} onChange={(e) => set('title', e.target.value.slice(0, TITLE_MAX))} placeholder={PLACEHOLDER[d.kind]} className={input + ' mt-1'} />
        </label>

        <label className="block mt-3">
          <span className="text-[14px] font-bold text-gray-700">날짜</span>
          <input type="date" value={d.day} onChange={(e) => e.target.value && set('day', e.target.value)} className={input + ' mt-1'} />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[14px] font-bold text-gray-700">시작</span>
            <input type="time" step={600} value={d.start} onChange={(e) => e.target.value && set('start', e.target.value)} className={input + ' mt-1 px-2'} />
          </label>
          <label className="block">
            <span className="text-[14px] font-bold text-gray-700">끝</span>
            <input type="time" step={600} value={d.end} onChange={(e) => e.target.value && set('end', e.target.value)} className={input + ' mt-1 px-2'} />
          </label>
        </div>
        {!timeOk && <p className="text-[13px] text-red-500 mt-1">끝나는 시간을 시작보다 뒤로 맞춰 주세요.</p>}

        <label className="block mt-3">
          <span className="text-[14px] font-bold text-gray-700">장소 (선택)</span>
          <input value={d.place} onChange={(e) => set('place', e.target.value.slice(0, PLACE_MAX))} placeholder="예: 송파구 잠실동 · 센터" className={input + ' mt-1'} />
        </label>

        {rooms.length > 0 && (
          <label className="block mt-3">
            <span className="text-[14px] font-bold text-gray-700">연결할 상담 대화 (선택)</span>
            <select value={d.room_id} onChange={(e) => set('room_id', e.target.value)} className={input + ' mt-1'}>
              <option value="">연결 안 함</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block mt-3">
          <span className="text-[14px] font-bold text-gray-700">메모 (선택)</span>
          <textarea value={d.memo} onChange={(e) => set('memo', e.target.value.slice(0, MEMO_MAX))} rows={2} className="mt-1 w-full p-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#0A8A7B] resize-none" />
        </label>
        <p className="text-[13px] text-gray-400 mt-1 leading-relaxed">회원의 이름·연락처·건강 정보는 꼭 필요한 만큼만 적어 주세요. 일정은 나만 볼 수 있어요.</p>

        {error && <p className="text-[14px] text-red-500 mt-3">{error}</p>}

        <div className="mt-4 flex gap-2">
          {d.id && (
            <button type="button" onClick={remove} disabled={busy} className="min-h-[52px] px-5 rounded-xl border border-red-100 bg-red-50 text-red-600 text-[16px] font-bold disabled:opacity-50">
              삭제
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="flex-1 min-h-[52px] rounded-xl text-white text-[17px] font-bold disabled:bg-gray-200 disabled:text-gray-400"
            style={{ background: canSave ? GREEN : undefined }}
          >
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
