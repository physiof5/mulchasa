'use client'

// 보호자용 '부모님 상황 맞춤 찾기'
// 질문 7개(한 화면에 하나) → 추천 운동 지도 분야 + 전문가 연결 + 제도 '다음 할 일'
// 답변은 이 기기 화면에서만 쓰고 서버로 보내지 않는다.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FlowShell, Question, OptionButton, PrimaryButton, StepCard, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/QuestionFlow'
import {
  WHO_OPTIONS, AGE_OPTIONS, MOBILITY_OPTIONS, CONDITION_OPTIONS, EXCLUSIVE_CONDITION, FALL_OPTIONS,
  GRADE_OPTIONS, PLACE_OPTIONS, honorific, eulReul, recommendPurposes, nextSteps, safetyNotes, saveSituation,
  situationLines, type Situation, type Condition,
} from '@/lib/care'
import { PURPOSE_INFO } from '@/lib/practitioner'
import { useSavedCoords } from '@/lib/useDeviceStorage'

const STEPS = ['who', 'age', 'mobility', 'conditions', 'fell', 'grade', 'place'] as const
type StepKey = (typeof STEPS)[number]

type Draft = Partial<Omit<Situation, 'conditions'>> & { conditions: Condition[] }

function isComplete(d: Draft): d is Situation {
  return !!(d.who && d.age && d.mobility && d.conditions.length > 0 && d.fell && d.grade && d.place)
}

export default function FindPage() {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>({ conditions: [] })
  const [stepIdx, setStepIdx] = useState(0)
  // 홈에서 정해 둔 위치가 있으면 거리순 찾기에 사용 (기기에만 저장된 값)
  const coords = useSavedCoords()
  const advancing = useRef(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [stepIdx])

  const h = honorific(draft.who)
  const step: StepKey | 'result' = stepIdx < STEPS.length ? STEPS[stepIdx] : 'result'

  const goBack = () => {
    if (stepIdx === 0) router.push('/')
    else setStepIdx((i) => i - 1)
  }

  // 하나만 고르는 질문: 고른 표시가 잠깐 보이도록 살짝 기다렸다 다음으로
  const choose = <K extends 'who' | 'age' | 'mobility' | 'fell' | 'grade' | 'place'>(key: K, value: Situation[K]) => {
    if (advancing.current) return
    advancing.current = true
    setDraft((d) => ({ ...d, [key]: value }))
    window.setTimeout(() => {
      setStepIdx((i) => i + 1)
      advancing.current = false
    }, 180)
  }

  const toggleCondition = (c: Condition) => {
    setDraft((d) => {
      const on = d.conditions.includes(c)
      if (on) return { ...d, conditions: d.conditions.filter((x) => x !== c) }
      if (c === EXCLUSIVE_CONDITION) return { ...d, conditions: [c] }
      return { ...d, conditions: [...d.conditions.filter((x) => x !== EXCLUSIVE_CONDITION), c] }
    })
  }

  if (step === 'result' && isComplete(draft)) {
    return <Result situation={draft} coords={coords} onRestart={() => { setDraft({ conditions: [] }); setStepIdx(0) }} />
  }

  const total = STEPS.length
  const shell = (children: ReactNode, footer?: ReactNode) => (
    <FlowShell title="부모님 상황 맞춤 찾기" step={stepIdx + 1} total={total} onBack={goBack} footer={footer}>
      {children}
    </FlowShell>
  )

  switch (step) {
    case 'who':
      return shell(
        <>
          <Question title={'누구를 위해\n알아보세요?'} sub="상황에 맞는 운동 지도와 제도를 함께 찾아 드려요. 답변은 저장되지 않아요." />
          <div className="flex flex-col gap-2.5">
            {WHO_OPTIONS.map((o) => (
              <OptionButton key={o.value} label={o.label} desc={o.desc} selected={draft.who === o.value} onClick={() => choose('who', o.value)} />
            ))}
          </div>
        </>
      )
    case 'age':
      return shell(
        <>
          <Question title={`${h} 연세는요?`} sub="장기요양 신청 대상인지 확인할 때 필요해요" />
          <div className="flex flex-col gap-2.5">
            {AGE_OPTIONS.map((o) => (
              <OptionButton key={o.value} label={o.label} selected={draft.age === o.value} onClick={() => choose('age', o.value)} />
            ))}
          </div>
        </>
      )
    case 'mobility':
      return shell(
        <>
          <Question title={`${h}은 지금\n어떻게 움직이세요?`} />
          <div className="flex flex-col gap-2.5">
            {MOBILITY_OPTIONS.map((o) => (
              <OptionButton key={o.value} label={o.label} desc={o.desc} selected={draft.mobility === o.value} onClick={() => choose('mobility', o.value)} />
            ))}
          </div>
        </>
      )
    case 'conditions':
      return shell(
        <>
          <Question title="어떤 일이 있으셨나요?" sub="해당하는 것을 모두 골라 주세요" />
          <div className="flex flex-col gap-2.5">
            {CONDITION_OPTIONS.map((o) => (
              <OptionButton key={o.value} multi label={o.label} selected={draft.conditions.includes(o.value)} onClick={() => toggleCondition(o.value)} />
            ))}
          </div>
        </>,
        <PrimaryButton onClick={() => setStepIdx((i) => i + 1)} disabled={draft.conditions.length === 0}>
          다음
        </PrimaryButton>
      )
    case 'fell':
      return shell(
        <>
          <Question title={'최근 1년 안에\n넘어지신 적이 있나요?'} sub="한 번이라도 넘어지셨다면 다시 넘어질 위험이 높아요" />
          <div className="flex flex-col gap-2.5">
            {FALL_OPTIONS.map((o) => (
              <OptionButton key={o.value} label={o.label} selected={draft.fell === o.value} onClick={() => choose('fell', o.value)} />
            ))}
          </div>
        </>
      )
    case 'grade':
      return shell(
        <>
          <Question title={'장기요양등급이\n있으세요?'} sub="국민건강보험공단이 정하는 돌봄 등급이에요 (1~5등급, 인지지원등급)" />
          <div className="flex flex-col gap-2.5">
            {GRADE_OPTIONS.map((o) => (
              <OptionButton key={o.value} label={o.label} desc={o.desc} selected={draft.grade === o.value} onClick={() => choose('grade', o.value)} />
            ))}
          </div>
        </>
      )
    case 'place': {
      const hardToGoOut = draft.mobility === 'assist' || draft.mobility === 'bed'
      return shell(
        <>
          <Question
            title={'운동 지도는\n어디서 받으실까요?'}
            sub={hardToGoOut ? '거동이 불편하시면 ‘집으로 와 주세요’를 추천해요' : '집으로 찾아가는 방문과 운동센터 모두 있어요'}
          />
          <div className="flex flex-col gap-2.5">
            {PLACE_OPTIONS.map((o) => (
              <OptionButton key={o.value} label={o.label} desc={o.desc} selected={draft.place === o.value} onClick={() => choose('place', o.value)} />
            ))}
          </div>
        </>
      )
    }
    default:
      // 답이 빠진 채 결과로 넘어온 경우(뒤로 가기 등) → 처음 질문으로
      return shell(
        <div className="text-center pt-16">
          <p className="text-[18px] text-gray-600 mb-6">빠진 답이 있어요. 처음부터 다시 골라 주세요.</p>
          <PrimaryButton onClick={() => setStepIdx(0)}>처음부터 다시</PrimaryButton>
        </div>
      )
  }
}

function Result({
  situation: s,
  coords,
  onRestart,
}: {
  situation: Situation
  coords: { lat: string; lng: string } | null
  onRestart: () => void
}) {
  const router = useRouter()
  const h = honorific(s.who)
  const purposes = recommendPurposes(s)
  const primary = purposes[0]
  const others = purposes.slice(1)
  const steps = nextSteps(s)
  const notes = safetyNotes(s)

  const searchHref = (purpose: string, mode?: 'visit' | 'center') => {
    const p = new URLSearchParams()
    p.set('purpose', purpose)
    // 방문 검색은 위치가 있어야 반경 계산이 되므로, 위치가 없으면 방식 조건 없이 보여줌
    if (mode && (mode === 'center' || coords)) p.set('mode', mode)
    if (coords) {
      p.set('lat', coords.lat)
      p.set('lng', coords.lng)
    }
    return `/search?${p.toString()}`
  }

  const goRequest = () => {
    saveSituation({ ...s, purpose: primary })
    router.push(`/request?purpose=${encodeURIComponent(primary)}`)
  }

  const requestBtn = (primaryStyle: boolean) => (
    <button
      type="button"
      onClick={goRequest}
      className="w-full min-h-[56px] rounded-2xl text-[17px] font-bold transition-all active:scale-[0.99]"
      style={primaryStyle ? { background: GREEN, color: '#fff' } : { background: '#fff', color: GREEN_DARK, border: `2px solid ${GREEN}` }}
    >
      🏠 방문 요청서 쓰기
    </button>
  )
  const searchBtn = (label: string, href: string, primaryStyle: boolean) => (
    <Link
      href={href}
      className="w-full min-h-[56px] rounded-2xl text-[17px] font-bold flex items-center justify-center transition-all active:scale-[0.99]"
      style={primaryStyle ? { background: GREEN, color: '#fff' } : { background: '#fff', color: GREEN_DARK, border: `2px solid ${GREEN}` }}
    >
      {label}
    </Link>
  )

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-12">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-1">
        <button onClick={onRestart} aria-label="처음부터 다시" className="w-12 h-12 -ml-2 flex items-center justify-center text-gray-500">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="text-[16px] font-bold text-gray-900">맞춤 찾기 결과</p>
      </div>

      {/* 추천 분야 */}
      <section className="bg-white px-5 pt-6 pb-6">
        <p className="text-[15px] font-semibold" style={{ color: GREEN_DARK }}>🛡️ 물리치료사의 운동 지도</p>
        <h1 className="text-[24px] font-extrabold text-gray-900 leading-snug mt-1">
          {h}께는
          <br />‘{primary}’{eulReul(primary)} 추천해요
        </h1>
        <p className="text-[17px] text-gray-600 mt-2 leading-relaxed">{PURPOSE_INFO[primary]}</p>
        {others.length > 0 && (
          <div className="mt-4">
            <p className="text-[14px] font-semibold text-gray-500 mb-2">함께 보면 좋아요</p>
            <div className="flex flex-wrap gap-2">
              {others.map((p) => (
                <Link
                  key={p}
                  href={searchHref(p)}
                  className="min-h-[44px] px-4 rounded-full flex items-center text-[15px] font-semibold"
                  style={{ background: GREEN_LIGHT, color: GREEN_DARK }}
                >
                  {p}
                </Link>
              ))}
            </div>
          </div>
        )}

        <details className="mt-5 rounded-xl bg-gray-50 px-4 py-3">
          <summary className="text-[15px] font-semibold text-gray-600 cursor-pointer min-h-[32px] flex items-center">알려주신 내용 보기</summary>
          <ul className="mt-2 space-y-1">
            {situationLines(s).map((l) => (
              <li key={l.label} className="text-[15px] text-gray-600">
                {l.icon} {l.label}: {l.value}
              </li>
            ))}
          </ul>
        </details>
      </section>

      {/* 다음 할 일 ① 운동 지도 */}
      <section className="px-5 pt-6">
        <h2 className="text-[18px] font-bold text-gray-900 mb-3">다음 할 일 ① 운동 지도 전문가 만나기</h2>
        <div className="flex flex-col gap-2.5">
          {s.place === 'home' && (
            <>
              {requestBtn(true)}
              {searchBtn('이 분야 전문가 둘러보기', searchHref(primary, 'visit'), false)}
            </>
          )}
          {s.place === 'center' && searchBtn('🏢 가까운 운동센터 전문가 보기', searchHref(primary, 'center'), true)}
          {s.place === 'both' && (
            <>
              {searchBtn('이 분야 전문가 둘러보기', searchHref(primary), true)}
              {requestBtn(false)}
            </>
          )}
        </div>
        {s.place !== 'center' && (
          <p className="text-[14px] text-gray-500 mt-3 leading-relaxed">
            방문 요청서를 남기시면 운영팀이 확인하고, 연결할 수 있는 전문가가 있으면 연락드려요. 지금은 시범 운영을 준비하고 있어 지역에 따라 연결이 늦을 수 있어요.
          </p>
        )}
      </section>

      {/* 다음 할 일 ② 제도 */}
      <section className="px-5 pt-7">
        <h2 className="text-[18px] font-bold text-gray-900 mb-3">다음 할 일 ② 함께 챙기면 좋은 제도</h2>
        <div className="flex flex-col gap-3">
          {steps.length > 0 ? (
            steps.map((st) => <StepCard key={st.id} title={st.title} body={st.body} actions={st.actions} />)
          ) : (
            <StepCard
              title="궁금한 제도가 생기면 먼저 확인해 보세요"
              body={['장기요양·장애인 복지·정부지원금·복지용구 소식을 물리치료사·사회복지사가 쉽게 풀어 두었어요.']}
              actions={[{ label: '‘보호가 필요해’ 블로그 보기', href: 'https://blog.naver.com/spacex_2025', external: true }]}
            />
          )}
        </div>
      </section>

      {/* 안전 안내 */}
      <section className="px-5 pt-6">
        <div className="rounded-2xl p-4" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          {notes.map((n) => (
            <p key={n} className="text-[15px] text-amber-900 leading-relaxed">
              ⚠️ {n}
            </p>
          ))}
        </div>
      </section>

      <div className="px-5 pt-6 text-center">
        <p className="text-[14px] text-gray-400">고르신 답변은 이 기기에만 잠시 쓰이고 저장되지 않아요.</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button onClick={onRestart} className="min-h-[52px] rounded-xl bg-white border border-gray-200 text-[16px] font-semibold text-gray-600">
            처음부터 다시
          </button>
          <Link href="/" className="min-h-[52px] rounded-xl bg-white border border-gray-200 text-[16px] font-semibold text-gray-600 flex items-center justify-center">
            홈으로
          </Link>
        </div>
      </div>
    </main>
  )
}
