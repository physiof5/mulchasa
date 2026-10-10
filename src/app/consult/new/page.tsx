'use client'

// 무료 상담 요청 — 5화면
//  ① 누구·연세  ② 거동  ③ 상황(질환 + 최근 낙상)  ④ 궁금한 점 + 받고 싶은 곳  ⑤ 동네 + 남긴 글 + 동의·보내기
// 주 사용자는 자녀 세대라 한 화면에 질문 두 개까지 묶는다(끝까지 보내는 비율을 높이려고).
// 보내기 직전에만 로그인(카카오). 로그인하러 다녀오는 동안 답은 이 기기(sessionStorage)에 잠시 보관.
// 서버에는 정해진 선택지 값 + 남긴 글 + 동네 이름 + 대략 위치(약 1km)만 저장한다. 정확한 주소는 보내지 않는다.

import { use, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthUser } from '@/lib/auth'
import { useIsClient } from '@/lib/useDeviceStorage'
import { FlowShell, Question, OptionButton, PrimaryButton, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/QuestionFlow'
import AddressSearch, { type GeoResult } from '@/components/AddressSearch'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import { notifyPush } from '@/lib/push'
import {
  AGE_OPTIONS, MOBILITY_OPTIONS, CONDITION_OPTIONS, EXCLUSIVE_CONDITION, FALL_OPTIONS, PLACE_OPTIONS,
  parseSituation, readSituationRaw, type Condition,
} from '@/lib/care'
import {
  CONSULT_WHO_OPTIONS, WANT_OPTIONS, MAX_ACCEPT, CONSULT_DAYS, CHAT_KEEP_DAYS, NOTE_MAX, answerLines, consultSubject, friendlyError,
  saveConsultDraft, takeConsultDraft, clearConsultDraft, type ConsultAnswers, type Want,
} from '@/lib/consult'

const STEPS = ['who', 'mobility', 'situation', 'wants', 'send'] as const
type StepKey = (typeof STEPS)[number]

type Draft = Partial<Pick<ConsultAnswers, 'who' | 'age' | 'mobility' | 'fell' | 'place'>> & {
  conditions: Condition[]
  wants: Want[]
  note: string
  area: GeoResult | null
  agree: boolean
}

const EMPTY: Draft = { conditions: [], wants: [], note: '', area: null, agree: false }

/** 답이 다 찼는지 (동네 제외) */
function answersDone(d: Draft): boolean {
  return !!(d.who && d.age && d.mobility && d.conditions.length > 0 && d.fell && d.wants.length > 0 && d.place)
}

function isComplete(d: Draft): d is Draft & ConsultAnswers & { area: GeoResult } {
  return answersDone(d) && !!d.area
}

/** 동네 이름: 서버가 준 '시·도 시·군·구', 없으면 주소 앞 두 낱말 */
function areaLabel(a: GeoResult | null): string {
  if (!a) return ''
  return a.region || a.address.split(' ').slice(0, 2).join(' ')
}

/** '어머님은 지금' / (본인) '지금' */
function subjectWith(who: Draft['who'], particle: '은' | '이'): string {
  const s = consultSubject(who)
  return s ? `${s}${particle} ` : ''
}

function initialState(resume: boolean, fromFind: boolean): { draft: Draft; step: number } {
  if (resume) {
    const d = takeConsultDraft<Draft>()
    if (d && Array.isArray(d.conditions) && Array.isArray(d.wants)) {
      const draft = { ...EMPTY, ...d }
      return { draft, step: answersDone(draft) ? STEPS.indexOf('send') : 0 }
    }
  }
  if (fromFind) {
    // '맞춤 찾기'에서 고른 답을 이어받아 '궁금한 점'부터
    const s = parseSituation(readSituationRaw())
    if (s) {
      return {
        draft: { ...EMPTY, who: s.who, age: s.age, mobility: s.mobility, conditions: s.conditions, fell: s.fell, place: s.place },
        step: STEPS.indexOf('wants'),
      }
    }
  }
  return { draft: EMPTY, step: 0 }
}

export default function ConsultNewPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = use(searchParams)
  const isClient = useIsClient()
  // 기기에 보관한 답을 읽어야 해서 브라우저에서만 그린다
  if (!isClient) return <main className="max-w-md mx-auto min-h-screen bg-white" />
  return <ConsultFlow resume={params.resume === '1'} fromFind={params.from === 'find'} />
}

// ── 짧은 선택지(대상·연세·낙상·받을 곳)는 칩 모양 ──
function Chip({ label, desc, selected, onClick }: { label: string; desc?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="min-h-[56px] px-2 py-2.5 rounded-2xl border-2 text-center flex flex-col items-center justify-center active:scale-[0.98] transition-all"
      style={selected ? { borderColor: GREEN, background: GREEN_LIGHT } : { borderColor: '#E5E7EB', background: '#fff' }}
    >
      <span className="text-[16px] font-bold leading-snug whitespace-nowrap" style={{ color: selected ? GREEN_DARK : '#1F2937' }}>
        {label}
      </span>
      {desc && <span className="text-[13px] text-gray-500 leading-snug mt-0.5">{desc}</span>}
    </button>
  )
}

function SubTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[19px] font-extrabold text-gray-900 leading-snug">{children}</h2>
      {sub && <p className="text-[14px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function ConsultFlow({ resume, fromFind }: { resume: boolean; fromFind: boolean }) {
  const router = useRouter()
  const user = useAuthUser()
  const [init] = useState(() => initialState(resume, fromFind))
  const [draft, setDraft] = useState<Draft>(init.draft)
  const [stepIdx, setStepIdx] = useState(init.step)
  const [needLogin, setNeedLogin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const advancing = useRef(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [stepIdx])

  const step: StepKey = STEPS[Math.min(stepIdx, STEPS.length - 1)]
  const goTo = (key: StepKey) => setStepIdx(STEPS.indexOf(key))
  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const goBack = () => {
    if (stepIdx === 0) router.push('/')
    else setStepIdx((i) => i - 1)
  }

  // 거동처럼 한 가지만 고르는 화면: 고른 표시가 잠깐 보이도록 살짝 기다렸다 다음으로
  const chooseAndNext = (value: ConsultAnswers['mobility']) => {
    if (advancing.current) return
    advancing.current = true
    set('mobility', value)
    window.setTimeout(() => {
      next()
      advancing.current = false
    }, 180)
  }

  const toggleCondition = (c: Condition) =>
    setDraft((d) => {
      const on = d.conditions.includes(c)
      if (on) return { ...d, conditions: d.conditions.filter((x) => x !== c) }
      if (c === EXCLUSIVE_CONDITION) return { ...d, conditions: [c] }
      return { ...d, conditions: [...d.conditions.filter((x) => x !== EXCLUSIVE_CONDITION), c] }
    })

  const toggleWant = (w: Want) => setDraft((d) => ({ ...d, wants: d.wants.includes(w) ? d.wants.filter((x) => x !== w) : [...d.wants, w] }))

  const submit = async () => {
    if (!isComplete(draft) || !draft.agree || busy) return
    if (!user) {
      saveConsultDraft(draft)
      setNeedLogin(true)
      return
    }
    setBusy(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('create_consult', {
      p: {
        who: draft.who,
        age: draft.age,
        mobility: draft.mobility,
        conditions: draft.conditions,
        fell: draft.fell,
        place: draft.place,
        wants: draft.wants,
        note: draft.note.trim(),
        area: areaLabel(draft.area),
        lat: draft.area.latitude,
        lng: draft.area.longitude,
        agree: true,
      },
    })
    if (rpcError || typeof data !== 'string') {
      setError(friendlyError(rpcError, '요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'))
      setBusy(false)
      return
    }
    clearConsultDraft()
    // 근처 전문가에게 '새 상담 요청' 알림
    notifyPush({ type: 'consult', consult_id: data })
    router.replace(`/consult/${data}?new=1`)
  }

  const shell = (children: ReactNode, footer?: ReactNode) => (
    <FlowShell title="무료 상담 요청" step={stepIdx + 1} total={STEPS.length} onBack={goBack} footer={footer}>
      {children}
    </FlowShell>
  )

  switch (step) {
    // ① 누구·연세
    case 'who':
      return shell(
        <>
          <Question title={'누구를 위한\n상담인가요?'} sub={`몇 가지만 고르면 가까운 물리치료사 최대 ${MAX_ACCEPT}명이 수락하고, 채팅으로 무료 상담해 드려요.`} />
          <div className="grid grid-cols-3 gap-2">
            {CONSULT_WHO_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={draft.who === o.value} onClick={() => set('who', o.value)} />
            ))}
          </div>
          <div className="mt-8">
            <SubTitle>{draft.who === 'self' ? '나이는요?' : '연세는요?'}</SubTitle>
            <div className="grid grid-cols-2 gap-2">
              {AGE_OPTIONS.map((o) => (
                <Chip key={o.value} label={o.value === '65plus' ? '65세 이상' : '65세 미만'} selected={draft.age === o.value} onClick={() => set('age', o.value)} />
              ))}
            </div>
          </div>
        </>,
        <PrimaryButton onClick={next} disabled={!draft.who || !draft.age}>
          다음
        </PrimaryButton>
      )

    // ② 거동 (하나 고르면 바로 다음)
    case 'mobility':
      return shell(
        <>
          <Question title={draft.who === 'self' ? '지금 어떻게\n움직이세요?' : `${subjectWith(draft.who, '은')}지금\n어떻게 움직이세요?`} />
          <div className="flex flex-col gap-2.5">
            {MOBILITY_OPTIONS.map((o) => (
              <OptionButton key={o.value} label={o.label} desc={o.desc} selected={draft.mobility === o.value} onClick={() => chooseAndNext(o.value)} />
            ))}
          </div>
        </>
      )

    // ③ 상황 + 최근 낙상
    case 'situation':
      return shell(
        <>
          <Question title="어떤 일이 있으셨나요?" sub="해당하는 것을 모두 골라 주세요" />
          <div className="flex flex-col gap-2.5">
            {CONDITION_OPTIONS.map((o) => (
              <OptionButton key={o.value} multi label={o.label} selected={draft.conditions.includes(o.value)} onClick={() => toggleCondition(o.value)} />
            ))}
          </div>
          <div className="mt-8">
            <SubTitle sub="한 번이라도 넘어졌다면 다시 넘어질 위험이 높아요">최근 1년 안에 넘어진 적이 있나요?</SubTitle>
            <div className="grid grid-cols-3 gap-2">
              {FALL_OPTIONS.map((o) => (
                <Chip key={o.value} label={o.value === 'yes' ? '있어요' : o.value === 'no' ? '없어요' : '모르겠어요'} selected={draft.fell === o.value} onClick={() => set('fell', o.value)} />
              ))}
            </div>
          </div>
        </>,
        <PrimaryButton onClick={next} disabled={draft.conditions.length === 0 || !draft.fell}>
          다음
        </PrimaryButton>
      )

    // ④ 궁금한 점 + 받고 싶은 곳
    case 'wants':
      return shell(
        <>
          <Question title={'무엇이 가장\n궁금하세요?'} sub="여러 개 골라도 돼요. 전문가가 이 부분부터 답해 드려요." />
          <div className="flex flex-col gap-2.5">
            {WANT_OPTIONS.map((o) => (
              <OptionButton key={o.value} multi label={o.label} desc={o.desc} selected={draft.wants.includes(o.value)} onClick={() => toggleWant(o.value)} />
            ))}
          </div>
          <div className="mt-8">
            <SubTitle sub="아직 정하지 않았다면 '둘 다'를 골라 주세요">운동 지도는 어디서 받고 싶으세요?</SubTitle>
            <div className="grid grid-cols-3 gap-2">
              {PLACE_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.value === 'home' ? '집으로' : o.value === 'center' ? '운동센터' : '둘 다'}
                  desc={o.value === 'home' ? '방문 지도' : o.value === 'center' ? '가까운 센터' : '괜찮아요'}
                  selected={draft.place === o.value}
                  onClick={() => set('place', o.value)}
                />
              ))}
            </div>
          </div>
        </>,
        <PrimaryButton onClick={next} disabled={draft.wants.length === 0 || !draft.place}>
          다음
        </PrimaryButton>
      )

    // ⑤ 동네 + 남긴 글 + 확인·동의 → 보내기
    case 'send': {
      if (!answersDone(draft)) {
        return shell(
          <div className="text-center pt-16">
            <p className="text-[18px] text-gray-600 mb-6">빠진 답이 있어요. 처음부터 다시 골라 주세요.</p>
            <PrimaryButton onClick={() => setStepIdx(0)}>처음부터 다시</PrimaryButton>
          </div>
        )
      }
      const editStep: Record<string, StepKey> = { 대상: 'who', 거동: 'mobility', 상황: 'situation', '최근 1년 낙상': 'situation', '궁금한 점': 'wants', '받고 싶은 곳': 'wants' }
      return (
        <>
          {shell(
            <>
              <Question title={`${draft.who === 'self' ? '지금 계신' : `${consultSubject(draft.who)}이 계신`}\n동네를 알려 주세요`} sub="가까운 전문가에게 요청을 보낼 때 써요" />
              <AddressSearch
                label="동네 찾기"
                placeholder="예: 송파구 잠실동"
                value={draft.area}
                onChange={(v) => set('area', v)}
                hint="동 이름까지만 넣어도 돼요. 정확한 주소는 저장하지 않아요."
              />
              {draft.area && (
                <p className="mt-3 rounded-xl px-4 py-3 text-[15px] leading-relaxed" style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
                  전문가에게는 <b>&lsquo;{areaLabel(draft.area)}&rsquo;</b>과 대략적인 거리만 보여요.
                </p>
              )}

              <label className="block mt-7">
                <span className="text-[17px] font-bold text-gray-900">전문가에게 하고 싶은 말 (선택)</span>
                <textarea
                  value={draft.note}
                  onChange={(e) => set('note', e.target.value.slice(0, NOTE_MAX))}
                  rows={3}
                  placeholder="예: 지난달 퇴원하셨어요. 집에 계단이 있고, 밤에 화장실 가실 때 불안해요."
                  className="mt-2 w-full p-4 border border-gray-200 rounded-xl text-[16px] leading-relaxed focus:outline-none focus:border-[#0A8A7B] resize-none"
                />
                <span className="flex justify-between text-[13px] text-gray-400 mt-1">
                  <span>이름·전화번호·자세한 주소는 적지 마세요</span>
                  <span className="tabular-nums">
                    {draft.note.length}/{NOTE_MAX}
                  </span>
                </span>
              </label>

              <details className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-1 group">
                <summary className="min-h-[48px] flex items-center text-[16px] font-bold text-gray-800 cursor-pointer list-none">
                  <span className="flex-1">보낼 내용 확인하기</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform" aria-hidden="true">
                    ▾
                  </span>
                </summary>
                <div className="pb-2">
                  {answerLines(draft as ConsultAnswers).map((l) => (
                    <div key={l.label} className="flex items-start gap-3 py-2.5 border-t border-gray-100">
                      <span className="w-[86px] shrink-0 text-[14px] text-gray-500 pt-0.5">{l.label}</span>
                      <span className="flex-1 min-w-0 text-[15px] font-semibold text-gray-800 leading-snug">{l.value}</span>
                      <button type="button" onClick={() => goTo(editStep[l.label] ?? 'who')} className="shrink-0 min-h-[32px] px-2 text-[14px] font-semibold" style={{ color: GREEN_DARK }}>
                        고치기
                      </button>
                    </div>
                  ))}
                </div>
              </details>

              <div className="mt-4 rounded-2xl border-2 p-4" style={{ borderColor: draft.agree ? GREEN : '#E5E7EB' }}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={draft.agree} onChange={(e) => set('agree', e.target.checked)} className="w-6 h-6 mt-0.5 shrink-0 accent-[#0A8A7B]" />
                  <span className="text-[16px] font-bold text-gray-900 leading-snug">[필수] 건강 정보(민감정보) 수집·이용·제공에 동의해요</span>
                </label>
                <ul className="mt-3 space-y-1.5 text-[14px] text-gray-600 leading-relaxed list-disc pl-5">
                  <li>
                    <b>항목</b>: 거동, 질환·수술 여부, 낙상 경험, 궁금한 점, 남긴 글, 동네(시·군·구)와 대략적인 위치(약 1km 단위)
                  </li>
                  <li>
                    <b>목적</b>: 상담할 전문가 찾기, 채팅 상담
                  </li>
                  <li>
                    <b>받는 사람</b>: 동네 근처(약 20km)의 승인된 물리치료사가 요청서를 볼 수 있고, 수락한 최대 {MAX_ACCEPT}명과 채팅해요
                  </li>
                  <li>
                    <b>보관</b>: 요청은 {CONSULT_DAYS}일 동안 받아요. 연결되지 않은 요청서는 그 뒤 30일 안에, 대화는 마지막 메시지 후 {CHAT_KEEP_DAYS}일이 지나면 지워져요. 언제든 직접 지울 수 있어요.
                  </li>
                  {draft.who !== 'self' && <li>가족 정보를 대신 적는 것이라면, 당사자께도 알리고 동의를 받아 주세요.</li>}
                  <li>동의하지 않을 수 있지만, 그러면 상담 요청을 보낼 수 없어요.</li>
                </ul>
              </div>

              {error && <p className="mt-4 text-[15px] text-red-500">{error}</p>}
              <p className="mt-4 text-[13px] text-gray-400 leading-relaxed">
                운동 지도 상담은 진료를 대신하지 않아요. 갑자기 생긴 마비·말 어눌함·심한 어지럼은 먼저 병원에 가 주세요. 위급하면 119.
              </p>
            </>,
            <PrimaryButton onClick={submit} disabled={!draft.area || !draft.agree || busy || user === undefined}>
              {busy ? '보내는 중...' : !draft.area ? '동네를 먼저 찾아 주세요' : !draft.agree ? '동의에 체크해 주세요' : '무료 상담 요청 보내기'}
            </PrimaryButton>
          )}
          {needLogin && <LoginSheet onClose={() => setNeedLogin(false)} />}
        </>
      )
    }
  }
}

function LoginSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="login-sheet-title">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl px-5 pt-6 pb-8" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        <p id="login-sheet-title" className="text-[21px] font-extrabold text-gray-900">
          보내기 전에 로그인해 주세요
        </p>
        <p className="text-[16px] text-gray-600 mt-2 leading-relaxed">수락한 전문가와 채팅하려면 로그인이 필요해요. 고르신 답은 그대로 남아 있어요.</p>
        <div className="mt-5">
          <KakaoLoginButton next="/consult/new?resume=1" label="카카오로 로그인하고 보내기" />
        </div>
        <button type="button" onClick={onClose} className="w-full min-h-[48px] mt-2 text-[15px] font-semibold text-gray-500">
          다음에 할게요
        </button>
        <p className="text-[13px] text-gray-400 text-center">카카오 닉네임·프로필 사진은 전문가에게 보이지 않아요</p>
      </div>
    </div>
  )
}
