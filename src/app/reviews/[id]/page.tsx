'use client'

// 진행 후기 한 편
// · 누구나: 공개된 후기 보기
// · 회원(해당 대화의 회원): 공개 동의 / 공개 안 함 (동의할 때 만족도 별점·한마디는 선택) · 공개한 뒤에도 언제든 내리기
// · 전문가(쓴 사람): 상태 확인 · 숨기기/다시 보이기 · 고쳐서 다시 요청 · 지우기

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { notifyPush } from '@/lib/push'
import { refreshNavBadges } from '@/lib/consult'
import {
  FIELDS, REVIEW_BUCKET, REVIEW_DISCLAIMER, photoPath, reviewError, stars, statusInfo, type CaseReviewView, type TextKey,
} from '@/lib/reviews'
import Sheet from '@/components/Sheet'
import { TopBar, Avatar, Spinner, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [view, setView] = useState<CaseReviewView | null | undefined>(undefined)
  const [photo, setPhoto] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_case_review', { p_id: id })
    setView((data as CaseReviewView | null) ?? null)
  }, [id])

  useEffect(() => {
    let alive = true
    supabase.rpc('get_case_review', { p_id: id }).then(({ data }) => {
      if (alive) setView((data as CaseReviewView | null) ?? null)
    })
    // 로그인 상태가 바뀌면 (로그인하고 돌아온 경우) 다시 읽기
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') load()
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [id, load])

  const act = async (fn: string, args: Record<string, unknown>, ask?: string) => {
    if (ask && !confirm(ask)) return false
    setBusy(true)
    const { error } = await supabase.rpc(fn, args)
    setBusy(false)
    if (error) {
      alert(reviewError(error))
      return false
    }
    await load()
    return true
  }

  const remove = async () => {
    if (!view) return
    if (!confirm('이 후기를 지울까요? 사진도 함께 지워지고 되돌릴 수 없어요.')) return
    setBusy(true)
    const { error } = await supabase.rpc('delete_case_review', { p_id: id })
    if (error) {
      setBusy(false)
      return alert(reviewError(error))
    }
    const paths = view.review.photos.map(photoPath).filter((x): x is string => !!x)
    if (paths.length > 0) await supabase.storage.from(REVIEW_BUCKET).remove(paths)
    router.replace('/reviews/mine')
  }

  if (view === undefined) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white">
        <TopBar title="진행 후기" backHref="/" />
        <Spinner />
      </main>
    )
  }
  if (view === null) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white">
        <TopBar title="진행 후기" backHref="/" />
        <section className="px-6 pt-16 text-center">
          <p className="text-[19px] font-bold text-gray-900">후기를 볼 수 없어요</p>
          <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">공개되지 않았거나 내려간 후기예요.</p>
          <Link href="/" className="mt-6 inline-flex min-h-[52px] px-6 rounded-xl text-white text-[16px] font-bold items-center" style={{ background: GREEN }}>
            홈으로
          </Link>
        </section>
      </main>
    )
  }

  const { role, review: r, therapist: t } = view
  const st = statusInfo(r.status, r.hidden_by)
  const back = role === 'public' ? `/therapist/${t.id}` : r.room_id ? `/chat/${r.room_id}` : '/reviews/mine'

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      <TopBar title="진행 후기" sub={`${t.name} 물리치료사`} backHref={back} />

      {role !== 'public' && (
        <div className="mx-5 mt-4 flex items-center gap-2">
          <span className="inline-flex items-center min-h-[28px] px-2.5 rounded-md text-[14px] font-bold" style={{ background: st.bg, color: st.color }}>
            {st.label}
          </span>
          <span className="flex-1 text-[13px] text-gray-500">{role === 'member' ? '나에게 공개 동의를 요청한 후기예요' : '내가 쓴 후기예요'}</span>
          {role === 'member' && r.status === 'pending' && (
            <button
              type="button"
              onClick={() => document.getElementById('decide')?.scrollIntoView({ behavior: 'smooth' })}
              className="min-h-[40px] px-3 rounded-lg text-[14px] font-bold text-white shrink-0"
              style={{ background: GREEN }}
            >
              답하기 ↓
            </button>
          )}
        </div>
      )}

      {/* 사진 */}
      <section className="mt-4">
        <div className="flex gap-2 overflow-x-auto px-5 snap-x snap-mandatory pb-1">
          {r.photos.map((u, i) => (
            <button key={u} type="button" onClick={() => setPhoto(i)} className="shrink-0 w-[78%] aspect-[4/3] rounded-2xl overflow-hidden bg-gray-200 snap-center" aria-label={`사진 ${i + 1} 크게 보기`}>
              <img src={u} alt={`진행 사진 ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        <p className="px-5 mt-1.5 text-[12px] text-gray-400">사진 {r.photos.length}장 · 얼굴 등은 전문가가 가린 뒤 올렸어요</p>
      </section>

      {/* 요약 */}
      <section className="mx-5 mt-3 rounded-2xl bg-white border border-gray-100 p-5">
        <p className="text-[21px] font-extrabold text-gray-900 leading-snug">
          {r.member_label} <span className="text-gray-500 font-bold">· {r.age_band}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip>{r.sessions}회 함께함</Chip>
          {!!r.verified_sessions && r.verified_sessions > 0 && <Chip>✓ 앱 기록 {r.verified_sessions}회 (회원 확인)</Chip>}
          {r.purpose && <Chip>{r.purpose}</Chip>}
        </div>
        {r.status === 'published' && r.member_rating && (
          <div className="mt-4 rounded-xl px-4 py-3" style={{ background: '#FFFBEB' }}>
            <p className="text-[15px] font-bold text-gray-800">
              <span className="text-[#F59E0B] tracking-wider" aria-label={`회원 만족도 5점 중 ${r.member_rating}점`}>
                {stars(r.member_rating)}
              </span>{' '}
              회원 만족도
            </p>
            {r.member_comment && <p className="text-[15px] text-gray-700 mt-1 leading-relaxed">“{r.member_comment}”</p>}
          </div>
        )}
      </section>

      {(Object.keys(FIELDS) as TextKey[]).map((k) => (
        <section key={k} className="mx-5 mt-3 rounded-2xl bg-white border border-gray-100 p-5">
          <h2 className="text-[15px] font-bold" style={{ color: GREEN_DARK }}>
            {FIELDS[k].label}
          </h2>
          <p className="text-[16px] text-gray-800 mt-1.5 leading-relaxed whitespace-pre-line break-words">{r[k]}</p>
        </section>
      ))}

      {/* 쓴 전문가 */}
      <Link href={`/therapist/${t.id}`} className="mx-5 mt-3 flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-4">
        <Avatar src={t.photo} name={t.name} size={48} />
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] font-bold text-gray-900 truncate">{t.name} 물리치료사</span>
          <span className="block text-[13px] text-gray-500 truncate">
            {t.years ? `경력 ${t.years}년` : ''}
            {t.studio ? ` · ${t.studio}` : ''} · 프로필 보기
          </span>
        </span>
        <span className="text-gray-300 text-xl shrink-0" aria-hidden="true">
          ›
        </span>
      </Link>

      <p className="mx-5 mt-4 text-[12px] text-gray-400 leading-relaxed">{REVIEW_DISCLAIMER}</p>

      {/* 회원: 공개 동의 */}
      {role === 'member' && r.status === 'pending' && <Decide id={id} label={r.member_label} sessions={r.sessions} verified={r.verified_sessions ?? 0} onDone={load} />}
      {role === 'member' && r.status === 'published' && (
        <section className="mx-5 mt-5">
          <button
            type="button"
            disabled={busy}
            onClick={() => act('withdraw_case_review', { p_id: id }, '이 후기를 내릴까요? 내리면 더는 공개되지 않고, 전문가도 다시 올릴 수 없어요.')}
            className="w-full min-h-[52px] rounded-xl border border-gray-200 bg-white text-[16px] font-semibold text-gray-600"
          >
            후기 내리기
          </button>
          <p className="text-[13px] text-gray-500 mt-2 text-center">공개에 동의했던 후기도 언제든 내릴 수 있어요.</p>
        </section>
      )}

      {/* 전문가: 관리 */}
      {role === 'expert' && (
        <section className="mx-5 mt-5 space-y-2">
          {r.status === 'pending' && <Info text="회원이 확인하고 있어요. 동의하면 내 프로필에 공개돼요." />}
          {r.status === 'declined' && (
            <>
              <Info text={`회원이 공개하지 않기로 했어요${r.decline_reason ? ` · “${r.decline_reason}”` : ''}`} />
              {r.room_id && r.submit_count < 3 && (
                <Link href={`/reviews/write?room=${r.room_id}`} className="flex min-h-[52px] rounded-xl text-white text-[16px] font-bold items-center justify-center" style={{ background: GREEN }}>
                  고쳐서 다시 요청하기 ({3 - r.submit_count}번 남음)
                </Link>
              )}
            </>
          )}
          {r.status === 'published' && (
            <button type="button" disabled={busy} onClick={() => act('set_case_review_hidden', { p_id: id, p_hidden: true }, '프로필에서 숨길까요? 나중에 다시 보이게 할 수 있어요.')} className="w-full min-h-[52px] rounded-xl border border-gray-200 bg-white text-[16px] font-semibold text-gray-700">
              프로필에서 숨기기
            </button>
          )}
          {r.status === 'hidden' && r.hidden_by === 'expert' && (
            <>
              <button type="button" disabled={busy} onClick={() => act('set_case_review_hidden', { p_id: id, p_hidden: false })} className="w-full min-h-[52px] rounded-xl text-white text-[16px] font-bold" style={{ background: GREEN }}>
                다시 보이게 하기
              </button>
              {r.room_id && (
                <Link href={`/reviews/write?room=${r.room_id}`} className="flex min-h-[52px] rounded-xl border border-gray-200 bg-white text-[16px] font-semibold text-gray-700 items-center justify-center">
                  고쳐서 다시 동의 받기
                </Link>
              )}
            </>
          )}
          {r.status === 'hidden' && r.hidden_by === 'member' && <Info text="회원이 후기를 내렸어요. 다시 올릴 수 없어요." />}
          {r.status === 'hidden' && r.hidden_by === 'admin' && <Info text="운영 정책에 따라 숨겨진 후기예요. 궁금한 점은 문의해 주세요." />}
          <button type="button" disabled={busy} onClick={remove} className="w-full min-h-[48px] text-[15px] font-semibold" style={{ color: '#E5484D' }}>
            후기 지우기
          </button>
        </section>
      )}

      {role === 'public' && (
        <section className="mx-5 mt-5">
          <Link href={`/therapist/${t.id}`} className="flex min-h-[52px] rounded-xl text-white text-[16px] font-bold items-center justify-center" style={{ background: GREEN }}>
            {t.name} 물리치료사 프로필 보기
          </Link>
        </section>
      )}

      {photo !== null && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" role="dialog" aria-modal="true" aria-label="사진 크게 보기">
          <div className="flex items-center justify-between px-2 py-1.5 text-white">
            <span className="px-3 text-[15px]">
              {photo + 1} / {r.photos.length}
            </span>
            <button type="button" onClick={() => setPhoto(null)} className="min-h-[48px] px-4 text-[16px] font-semibold">
              닫기
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <img src={r.photos[photo]} alt={`진행 사진 ${photo + 1}`} className="max-w-full max-h-full object-contain" />
          </div>
          <div className="flex gap-2 p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            <button type="button" disabled={photo === 0} onClick={() => setPhoto((p) => (p ?? 0) - 1)} className="flex-1 min-h-[52px] rounded-xl bg-white/15 text-white text-[16px] font-semibold disabled:opacity-30">
              이전
            </button>
            <button type="button" disabled={photo === r.photos.length - 1} onClick={() => setPhoto((p) => (p ?? 0) + 1)} className="flex-1 min-h-[52px] rounded-xl bg-white/15 text-white text-[16px] font-semibold disabled:opacity-30">
              다음
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center min-h-[30px] px-3 rounded-full text-[14px] font-semibold" style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
      {children}
    </span>
  )
}

function Info({ text }: { text: string }) {
  return <p className="rounded-xl bg-white border border-gray-100 px-4 py-3 text-[15px] text-gray-700 leading-relaxed">{text}</p>
}

// 회원: 공개해도 될까요?
function Decide({ id, label, sessions, verified, onDone }: { id: string; label: string; sessions: number; verified: number; onDone: () => Promise<void> }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const decide = async (approve: boolean) => {
    if (busy) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('decide_case_review', {
      p_id: id,
      p_approve: approve,
      p_rating: approve && rating > 0 ? rating : null,
      p_comment: approve ? comment.trim() : '',
      p_reason: approve ? '' : reason.trim(),
    })
    setBusy(false)
    if (e) return setError(reviewError(e))
    notifyPush({ type: 'review_decided', review_id: id })
    refreshNavBadges()
    setDeclining(false)
    await onDone()
  }

  return (
    <section id="decide" className="mx-5 mt-5 rounded-2xl bg-white border-2 p-5 scroll-mt-20" style={{ borderColor: GREEN }}>
      <h2 className="text-[19px] font-extrabold text-gray-900">이 후기를 공개해도 될까요?</h2>
      <ul className="mt-2 space-y-1.5 text-[15px] text-gray-700 leading-relaxed">
        <li>· 위 내용이 전문가 프로필에 공개돼요. 이름 대신 <b>{label}</b>으로 보여요.</li>
        <li>· 사진에서 얼굴 등 알아볼 수 있는 부분이 가려졌는지 꼭 확인해 주세요.</li>
        <li>
          · 함께한 횟수({sessions}회)가 맞는지도 봐 주세요.
          {verified > 0 && ` (앱 기록: 회원님이 ‘진행 완료’를 누른 방문 ${verified}회)`}
        </li>
        <li>· 공개한 뒤에도 언제든 이 화면에서 내릴 수 있어요.</li>
      </ul>

      <div className="mt-4">
        <p className="text-[15px] font-bold text-gray-800">
          만족도 <span className="font-normal text-gray-500">(선택)</span>
        </p>
        <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label="만족도">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n}점`}
              onClick={() => setRating(rating === n ? 0 : n)}
              className="w-12 h-12 text-[30px] leading-none"
              style={{ color: n <= rating ? '#F59E0B' : '#D1D5DB' }}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 100))}
          rows={2}
          placeholder="전문가에게 한마디 (선택, 100자)"
          className="mt-2 w-full p-3 border border-gray-200 rounded-xl text-[15px] leading-relaxed focus:outline-none focus:border-[#0A8A7B] resize-none"
        />
      </div>

      {error && <p className="text-[14px] text-red-500 mt-2">{error}</p>}
      <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
        <button type="button" disabled={busy} onClick={() => setDeclining(true)} className="min-h-[52px] rounded-xl border border-gray-200 text-[15px] font-semibold text-gray-600">
          공개 안 함
        </button>
        <button type="button" disabled={busy} onClick={() => decide(true)} className="min-h-[52px] rounded-xl text-[16px] font-bold text-white" style={{ background: GREEN }}>
          {busy ? '저장 중...' : '공개에 동의해요'}
        </button>
      </div>
      <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">동의하지 않아도 상담·채팅은 그대로 이어져요.</p>

      {declining && (
        <Sheet
          title="공개하지 않을게요"
          onClose={() => setDeclining(false)}
          footer={
            <button type="button" disabled={busy} onClick={() => decide(false)} className="w-full min-h-[52px] rounded-xl text-[16px] font-bold text-white" style={{ background: '#4B5563' }}>
              {busy ? '저장 중...' : '공개 안 함으로 답하기'}
            </button>
          }
        >
          <p className="text-[15px] text-gray-600 leading-relaxed">이유를 남기면 전문가가 고쳐서 다시 물어볼 수 있어요. (선택)</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {['얼굴이 더 가려졌으면 해요', '사진을 바꿔 주세요', '내용이 사실과 달라요', '공개하고 싶지 않아요'].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setReason(q)}
                aria-pressed={reason === q}
                className="min-h-[44px] px-3 rounded-full border-2 text-[14px] font-semibold"
                style={reason === q ? { borderColor: GREEN, background: GREEN_LIGHT, color: GREEN_DARK } : { borderColor: '#E5E7EB', color: '#4B5563' }}
              >
                {q}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            rows={2}
            placeholder="직접 적기 (선택)"
            className="mt-3 w-full p-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#0A8A7B] resize-none"
          />
        </Sheet>
      )}
    </section>
  )
}
