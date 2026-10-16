'use client'

// 진행 후기 쓰기 (전문가) — 상담을 수락한 대화방에서만, 10회 이상 진행한 뒤
// 양식: 회원 표시(성만) · 나이대 · 진행 횟수 · 운동 목표 · 첫 만남 때 상황 · 운동 지도 방법 · 변화 · 사진 2~5장(모자이크)
// 내면 회원에게 '공개해도 될까요?' 요청이 가고, 회원이 동의해야 프로필에 공개돼요.

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthUser } from '@/lib/auth'
import { consultTitle, type ConsultAnswers } from '@/lib/consult'
import { notifyPush } from '@/lib/push'
import {
  AGE_BANDS, FIELDS, PHOTO_MAX, PHOTO_MIN, PURPOSE_CHIPS, REVIEW_BUCKET, SESSIONS_MAX, SESSIONS_MIN, SURNAME_RE,
  memberLabel, parseLabel, photoPath, reviewError, textProblem, type CaseReview, type CaseReviewView, type LabelStyle, type TextKey,
} from '@/lib/reviews'
import MosaicEditor from '@/components/MosaicEditor'
import type { RoomVisits } from '@/lib/visits'
import { TopBar, LoginNeeded, Spinner, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'

interface RoomLite {
  id: string
  role: 'guardian' | 'expert'
  consult: { answers: ConsultAnswers; area_label: string } | null
  review?: { id: string; status: string } | null
}

type Photo = { key: string; url?: string; blob?: Blob; preview: string }

export default function ReviewWritePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = use(searchParams)
  const room = typeof params.room === 'string' ? params.room : null
  const user = useAuthUser()

  if (user === null) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white">
        <TopBar title="진행 후기 쓰기" backHref="/chat" />
        <LoginNeeded title={'로그인하면\n진행 후기를 쓸 수 있어요'} desc="상담을 수락한 전문가만 쓸 수 있어요." next={`/reviews/write${room ? `?room=${room}` : ''}`} />
      </main>
    )
  }
  if (user === undefined) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white">
        <TopBar title="진행 후기 쓰기" backHref="/chat" />
        <Spinner />
      </main>
    )
  }
  return <Loader room={room} me={user.id} />
}

function Loader({ room, me }: { room: string | null; me: string }) {
  const [state, setState] = useState<{ info: RoomLite; existing: CaseReview | null; verified: number } | { error: string } | undefined>(undefined)

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!room) return { error: '어느 대화의 후기인지 알 수 없어요. 채팅방 메뉴에서 ‘진행 후기 쓰기’를 눌러 주세요.' }
      const { data, error } = await supabase.rpc('get_room', { p_id: room })
      const info = data as RoomLite | null
      if (error || !info) return { error: '대화방을 찾지 못했어요. 지워졌거나 보관 기간이 지났을 수 있어요.' }
      if (info.role !== 'expert') return { error: '상담을 수락한 전문가만 진행 후기를 쓸 수 있어요.' }
      let existing: CaseReview | null = null
      if (info.review?.id) {
        const { data: v } = await supabase.rpc('get_case_review', { p_id: info.review.id })
        existing = (v as CaseReviewView | null)?.review ?? null
      }
      // 앱 기록: 회원이 '진행 완료'를 누른 방문 수 (day17 전이면 0)
      const { data: vis } = await supabase.rpc('room_visits', { p_room: room })
      const verified = (vis as RoomVisits | null)?.verified ?? 0
      return { info, existing, verified }
    }
    run().then((s) => alive && setState(s))
    return () => {
      alive = false
    }
  }, [room])

  if (state === undefined) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white">
        <TopBar title="진행 후기 쓰기" backHref={room ? `/chat/${room}` : '/chat'} />
        <Spinner />
      </main>
    )
  }
  if ('error' in state) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white">
        <TopBar title="진행 후기 쓰기" backHref={room ? `/chat/${room}` : '/chat'} />
        <p className="px-6 pt-16 text-center text-[17px] text-gray-700 leading-relaxed">{state.error}</p>
      </main>
    )
  }
  const ex = state.existing
  const blocked =
    ex?.status === 'published'
      ? '이미 공개된 후기예요. 고치려면 후기 화면에서 먼저 숨겨 주세요.'
      : ex?.status === 'hidden' && ex.hidden_by === 'member'
        ? '회원이 내린 후기는 다시 올릴 수 없어요.'
        : ex?.status === 'pending'
          ? null
          : ex && ex.submit_count >= 3
            ? '같은 회원에게는 3번까지만 공개를 요청할 수 있어요.'
            : null
  if (blocked && ex) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white">
        <TopBar title="진행 후기 쓰기" backHref={`/chat/${room}`} />
        <section className="px-6 pt-16 text-center">
          <p className="text-[17px] text-gray-700 leading-relaxed">{blocked}</p>
          <Link href={`/reviews/${ex.id}`} className="mt-6 inline-flex min-h-[52px] px-6 rounded-xl text-white text-[16px] font-bold items-center" style={{ background: GREEN }}>
            후기 보기
          </Link>
        </section>
      </main>
    )
  }
  return <Form room={room!} me={me} info={state.info} existing={ex} verified={state.verified} />
}

function Form({ room, me, info, existing, verified }: { room: string; me: string; info: RoomLite; existing: CaseReview | null; verified: number }) {
  const router = useRouter()
  const init = existing ? parseLabel(existing.member_label) : { surname: '', style: 'OO' as LabelStyle }
  const [surname, setSurname] = useState(init.surname)
  const [style, setStyle] = useState<LabelStyle>(init.style)
  const [age, setAge] = useState<string>(existing?.age_band ?? '')
  const [sessions, setSessions] = useState<number>(existing?.sessions ?? Math.max(SESSIONS_MIN, verified))
  const [purpose, setPurpose] = useState(existing?.purpose ?? '')
  const [texts, setTexts] = useState<Record<TextKey, string>>({
    first_state: existing?.first_state ?? '',
    approach: existing?.approach ?? '',
    changes: existing?.changes ?? '',
  })
  const [photos, setPhotos] = useState<Photo[]>(() => (existing?.photos ?? []).map((url, i) => ({ key: `old-${i}`, url, preview: url })))
  const [editing, setEditing] = useState<File | null>(null)
  const [faceChecked, setFaceChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)

  // 미리보기 주소 정리
  useEffect(
    () => () => {
      photos.forEach((p) => p.blob && URL.revokeObjectURL(p.preview))
    },
    // 화면을 떠날 때 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const surnameOk = SURNAME_RE.test(surname.trim())
  const problems: Partial<Record<TextKey, string>> = {}
  ;(Object.keys(FIELDS) as TextKey[]).forEach((k) => {
    const v = texts[k].trim()
    const p = textProblem(v)
    if (p) problems[k] = p
    else if (v.length < FIELDS[k].min) problems[k] = `${FIELDS[k].min}자 이상 적어 주세요.`
  })
  const missing: string[] = []
  if (!surnameOk) missing.push('회원 성')
  if (!age) missing.push('나이대')
  if (sessions < SESSIONS_MIN) missing.push(`진행 횟수(${SESSIONS_MIN}회 이상)`)
  if (Object.keys(problems).length > 0) missing.push('양식 내용')
  if (photos.length < PHOTO_MIN) missing.push(`사진 ${PHOTO_MIN}장 이상`)
  if (!faceChecked) missing.push('얼굴 가림 확인')
  const ready = missing.length === 0

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) setEditing(f)
  }

  const submit = async () => {
    setTried(true)
    if (!ready || busy) return
    setBusy(true)
    setError('')
    const batch = crypto.randomUUID()
    const uploaded: string[] = []
    try {
      const urls: string[] = []
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i]
        if (p.url) {
          urls.push(p.url)
          continue
        }
        const path = `${me}/${batch}/${i + 1}.jpg`
        const { error: upErr } = await supabase.storage.from(REVIEW_BUCKET).upload(path, p.blob!, { contentType: 'image/jpeg', upsert: false })
        if (upErr) throw new Error(upErr.message?.includes('Bucket') ? '사진 보관함 준비 중이에요. (운영자: day16 SQL 실행 필요)' : '사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.')
        uploaded.push(path)
        urls.push(supabase.storage.from(REVIEW_BUCKET).getPublicUrl(path).data.publicUrl)
      }
      const { data, error: e } = await supabase.rpc('submit_case_review', {
        p: {
          room_id: room,
          member_label: memberLabel(surname, style),
          age_band: age,
          sessions,
          purpose: purpose.trim(),
          first_state: texts.first_state.trim(),
          approach: texts.approach.trim(),
          changes: texts.changes.trim(),
          photos: urls,
          face_checked: faceChecked,
        },
      })
      if (e || typeof data !== 'string') throw new Error(reviewError(e))
      // 고쳐 낼 때 뺀 예전 사진은 보관함에서도 지움
      const kept = new Set(urls)
      const removed = (existing?.photos ?? []).filter((u) => !kept.has(u)).map(photoPath).filter((x): x is string => !!x)
      if (removed.length > 0) supabase.storage.from(REVIEW_BUCKET).remove(removed)
      notifyPush({ type: 'review_request', review_id: data })
      router.replace(`/reviews/${data}`)
    } catch (err) {
      if (uploaded.length > 0) supabase.storage.from(REVIEW_BUCKET).remove(uploaded)
      setError((err as Error).message || '보내지 못했어요. 잠시 후 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  const who = info.consult ? `${consultTitle(info.consult.answers)} · ${info.consult.area_label}` : '회원'

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      <TopBar title={existing ? '진행 후기 고치기' : '진행 후기 쓰기'} sub={who} backHref={`/chat/${room}`} />

      <section className="mx-5 mt-4 rounded-2xl p-4" style={{ background: GREEN_LIGHT }}>
        <p className="text-[16px] font-bold" style={{ color: GREEN_DARK }}>
          회원이 공개에 동의하면 내 프로필에 보여요
        </p>
        <ul className="mt-1.5 space-y-1 text-[14px] text-gray-700 leading-relaxed">
          <li>· {SESSIONS_MIN}회 이상 함께한 회원만 쓸 수 있어요</li>
          <li>· 회원 이름은 쓰지 않아요 — ‘김OO님’처럼 성만</li>
          <li>· 얼굴·이름표 등 알아볼 수 있는 부분은 모자이크해요</li>
          <li>· 관찰한 변화만 사실대로 — ‘치료·완치·효과 보장’ 같은 말은 쓸 수 없어요</li>
        </ul>
        {existing?.status === 'declined' && (
          <p className="mt-2 text-[14px] font-semibold" style={{ color: '#B45309' }}>
            회원이 공개하지 않기로 했어요{existing.decline_reason ? ` (${existing.decline_reason})` : ''}. 고쳐서 한 번 더 요청할 수 있어요.
          </p>
        )}
      </section>

      {/* 1. 회원 표시 */}
      <Section n={1} title="회원 표시">
        <div className="flex items-center gap-2">
          <input
            value={surname}
            onChange={(e) => setSurname(e.target.value.replace(/\s/g, '').slice(0, 2))}
            placeholder="성"
            aria-label="회원 성 (1~2자)"
            className="w-20 min-h-[52px] px-3 border border-gray-200 rounded-xl text-[18px] font-bold text-center focus:outline-none focus:border-[#0A8A7B]"
          />
          {(['OO', '**'] as LabelStyle[]).map((s) => {
            const on = style === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                aria-pressed={on}
                className="flex-1 min-h-[52px] rounded-xl border-2 text-[16px] font-bold"
                style={on ? { borderColor: GREEN, background: GREEN_LIGHT, color: GREEN_DARK } : { borderColor: '#E5E7EB', color: '#4B5563' }}
              >
                {memberLabel(surname.trim() || '김', s)}
              </button>
            )
          })}
        </div>
        <p className="text-[13px] mt-2" style={{ color: tried && !surnameOk ? '#EF4444' : '#6B7280' }}>
          성만 한글 1~2자로 적어 주세요. 이름은 공개되지 않아요.
        </p>
      </Section>

      {/* 2. 나이대 · 횟수 · 목표 */}
      <Section n={2} title="나이대">
        <div className="grid grid-cols-3 gap-2">
          {AGE_BANDS.map((a) => {
            const on = age === a
            return (
              <button
                key={a}
                type="button"
                onClick={() => setAge(a)}
                aria-pressed={on}
                className="min-h-[48px] rounded-xl border-2 text-[15px] font-bold whitespace-nowrap"
                style={on ? { borderColor: GREEN, background: GREEN_LIGHT, color: GREEN_DARK } : { borderColor: '#E5E7EB', color: '#4B5563' }}
              >
                {a}
              </button>
            )
          })}
        </div>
        {tried && !age && <p className="text-[13px] text-red-500 mt-2">나이대를 골라 주세요.</p>}
      </Section>

      <Section n={3} title="함께한 횟수">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSessions((n) => Math.max(SESSIONS_MIN, n - 1))}
            aria-label="1회 줄이기"
            className="w-12 h-12 rounded-xl border border-gray-200 text-[22px] font-bold text-gray-600"
          >
            −
          </button>
          <label className="flex items-baseline gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={SESSIONS_MIN}
              max={SESSIONS_MAX}
              value={sessions}
              onChange={(e) => setSessions(Math.min(SESSIONS_MAX, Math.max(0, Number(e.target.value) || 0)))}
              aria-label="진행 횟수"
              className="w-20 min-h-[48px] text-center text-[22px] font-extrabold border-b-2 border-gray-200 focus:outline-none focus:border-[#0A8A7B]"
            />
            <span className="text-[17px] font-bold text-gray-700">회</span>
          </label>
          <button type="button" onClick={() => setSessions((n) => Math.min(SESSIONS_MAX, n + 1))} aria-label="1회 늘리기" className="w-12 h-12 rounded-xl border border-gray-200 text-[22px] font-bold text-gray-600">
            +
          </button>
        </div>
        <p className="text-[13px] mt-2" style={{ color: sessions < SESSIONS_MIN ? '#EF4444' : '#6B7280' }}>
          {SESSIONS_MIN}회 이상부터 쓸 수 있어요. 회원이 공개 동의할 때 함께 확인해요.
          {verified > 0 && ` 앱 기록: 회원이 ‘진행 완료’를 누른 방문 ${verified}회 (후기에 함께 표시돼요).`}
        </p>
      </Section>

      <Section n={4} title="운동 목표 (선택)">
        <div className="flex flex-wrap gap-2">
          {PURPOSE_CHIPS.map((p) => {
            const on = purpose === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPurpose(on ? '' : p)}
                aria-pressed={on}
                className="min-h-[44px] px-3.5 rounded-full border-2 text-[15px] font-semibold"
                style={on ? { borderColor: GREEN, background: GREEN_LIGHT, color: GREEN_DARK } : { borderColor: '#E5E7EB', color: '#4B5563' }}
              >
                {p}
              </button>
            )
          })}
        </div>
      </Section>

      {(Object.keys(FIELDS) as TextKey[]).map((k, i) => {
        const f = FIELDS[k]
        const v = texts[k]
        const showErr = !!problems[k] && (tried || (v.trim().length > 0 && !!textProblem(v)))
        return (
          <Section key={k} n={5 + i} title={f.label}>
            <textarea
              value={v}
              onChange={(e) => setTexts((t) => ({ ...t, [k]: e.target.value.slice(0, f.max) }))}
              rows={k === 'approach' ? 5 : 4}
              placeholder={f.placeholder}
              aria-label={f.label}
              className={'w-full p-3.5 border rounded-xl text-[16px] leading-relaxed focus:outline-none focus:border-[#0A8A7B] resize-none ' + (showErr ? 'border-red-300' : 'border-gray-200')}
            />
            <div className="flex justify-between gap-3 mt-1">
              <p className="text-[13px] text-red-500 leading-snug">{showErr ? problems[k] : ''}</p>
              <p className="text-[12px] text-gray-400 shrink-0">
                {v.trim().length}/{f.max}
              </p>
            </div>
            {k === 'changes' && <p className="text-[13px] text-gray-500 leading-snug">결과는 사람마다 달라요. 과장 없이 직접 본 변화만 적어 주세요.</p>}
          </Section>
        )
      })}

      {/* 사진 */}
      <Section n={8} title={`사진 ${PHOTO_MIN}~${PHOTO_MAX}장`}>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p.key} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
              <img src={p.preview} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  if (p.blob) URL.revokeObjectURL(p.preview)
                  setPhotos((list) => list.filter((x) => x.key !== p.key))
                }}
                aria-label={`사진 ${i + 1} 빼기`}
                className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/60 text-white text-[16px] flex items-center justify-center"
              >
                ×
              </button>
              {i === 0 && <span className="absolute bottom-1 left-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white">대표</span>}
            </div>
          ))}
          {photos.length < PHOTO_MAX && (
            <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-500 cursor-pointer bg-white">
              <span className="text-[26px] leading-none">＋</span>
              <span className="text-[13px] font-semibold mt-1">사진 추가</span>
              <input type="file" accept="image/*" onChange={pickFile} className="sr-only" />
            </label>
          )}
        </div>
        <p className="text-[13px] mt-2 leading-snug" style={{ color: tried && photos.length < PHOTO_MIN ? '#EF4444' : '#6B7280' }}>
          운동하는 모습·변화를 보여 주는 사진이 좋아요. 고른 사진은 바로 모자이크 화면으로 열려요.
        </p>
      </Section>

      <section className="mx-5 mt-5">
        <label className="flex items-start gap-3 rounded-2xl bg-white border-2 p-4 cursor-pointer" style={{ borderColor: faceChecked ? GREEN : tried ? '#FCA5A5' : '#E5E7EB' }}>
          <input type="checkbox" checked={faceChecked} onChange={(e) => setFaceChecked(e.target.checked)} className="mt-0.5 w-6 h-6 accent-[#0A8A7B] shrink-0" />
          <span className="text-[15px] text-gray-800 leading-relaxed">
            모든 사진에서 <b>회원의 얼굴·이름표·주소</b>처럼 누구인지 알 수 있는 부분을 가렸어요. 글에도 회원 이름·연락처를 적지 않았어요.
          </span>
        </label>
      </section>

      <section className="mx-5 mt-5">
        {error && <p className="text-[14px] text-red-500 mb-2">{error}</p>}
        {tried && !ready && <p className="text-[14px] text-red-500 mb-2">아직 남았어요: {missing.join(' · ')}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="w-full min-h-[56px] rounded-2xl text-[17px] font-bold text-white disabled:opacity-60"
          style={{ background: ready ? GREEN : '#9CA3AF' }}
        >
          {busy ? '올리는 중...' : '회원에게 공개 동의 요청하기'}
        </button>
        <p className="text-[13px] text-gray-500 mt-2 text-center leading-relaxed">회원이 동의하기 전에는 아무에게도 보이지 않아요.</p>
      </section>

      {editing && (
        <MosaicEditor
          file={editing}
          onCancel={() => setEditing(null)}
          onDone={(blob, preview) => {
            setPhotos((list) => [...list, { key: `new-${preview}`, blob, preview }].slice(0, PHOTO_MAX))
            setEditing(null)
          }}
        />
      )}
    </main>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-4">
      <h2 className="flex items-center gap-2 text-[17px] font-extrabold text-gray-900 mb-3">
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-bold text-white shrink-0" style={{ background: GREEN }}>
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}
