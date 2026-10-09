'use client'

// 낙상 위험 1분 체크 — CDC STEADI 점검표 12문항 + 집 안 환경 점검
// 답변은 이 기기 화면에서만 쓰고, 결과 요약만 기기(localStorage)에 남긴다.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FlowShell, Question, OptionButton, PrimaryButton, StepCard, GREEN, GREEN_DARK } from '@/components/QuestionFlow'
import ShareButton from '@/components/ShareButton'
import {
  FALL_QUESTIONS, FALL_MAX_SCORE, FALL_RISK_THRESHOLD, HOME_HAZARDS, fallScore, saveLastResult,
} from '@/lib/checks'
import { useSavedCoords } from '@/lib/useDeviceStorage'

const FALL_PURPOSE = '보행·균형(낙상 예방)'
const TOTAL = FALL_QUESTIONS.length + 1 // + 집 안 점검

export default function FallCheckPage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, boolean>>({})
  const [hazards, setHazards] = useState<string[]>([])
  const [noHazard, setNoHazard] = useState(false)
  const [idx, setIdx] = useState(0)
  const advancing = useRef(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [idx])

  const goBack = () => {
    if (idx === 0) router.push('/check')
    else setIdx((i) => i - 1)
  }

  const answer = (id: string, value: boolean) => {
    if (advancing.current) return
    advancing.current = true
    setAnswers((a) => ({ ...a, [id]: value }))
    window.setTimeout(() => {
      setIdx((i) => i + 1)
      advancing.current = false
    }, 180)
  }

  const toggleHazard = (id: string) => {
    setNoHazard(false)
    setHazards((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]))
  }

  const restart = () => {
    setAnswers({})
    setHazards([])
    setNoHazard(false)
    setIdx(0)
  }

  if (idx > FALL_QUESTIONS.length) {
    return <FallResult answers={answers} hazards={hazards} onRestart={restart} />
  }

  // 마지막: 집 안 점검 (여러 개 선택)
  if (idx === FALL_QUESTIONS.length) {
    return (
      <FlowShell
        title="낙상 위험 1분 체크"
        step={TOTAL}
        total={TOTAL}
        onBack={goBack}
        footer={
          <PrimaryButton onClick={() => setIdx((i) => i + 1)} disabled={hazards.length === 0 && !noHazard}>
            결과 보기
          </PrimaryButton>
        }
      >
        <Question title={'집 안에 이런 곳이\n있나요?'} sub="해당하는 곳을 모두 골라 주세요" />
        <div className="flex flex-col gap-2.5">
          {HOME_HAZARDS.map((h) => (
            <OptionButton key={h.id} multi label={h.text} selected={hazards.includes(h.id)} onClick={() => toggleHazard(h.id)} />
          ))}
          <OptionButton
            multi
            label="해당하는 곳이 없어요"
            selected={noHazard}
            onClick={() => {
              setHazards([])
              setNoHazard((v) => !v)
            }}
          />
        </div>
      </FlowShell>
    )
  }

  const q = FALL_QUESTIONS[idx]
  return (
    <FlowShell title="낙상 위험 1분 체크" step={idx + 1} total={TOTAL} onBack={goBack}>
      {idx === 0 && (
        <p className="text-[15px] text-gray-500 mb-4 leading-relaxed">
          부모님의 평소 모습을 떠올리며 답해 주세요. 답변은 저장되지 않아요.
        </p>
      )}
      <Question title={q.text} />
      <div className="flex flex-col gap-2.5">
        <OptionButton label="네" selected={answers[q.id] === true} onClick={() => answer(q.id, true)} />
        <OptionButton label="아니요" selected={answers[q.id] === false} onClick={() => answer(q.id, false)} />
      </div>
    </FlowShell>
  )
}

function FallResult({
  answers,
  hazards,
  onRestart,
}: {
  answers: Record<string, boolean>
  hazards: string[]
  onRestart: () => void
}) {
  const score = fallScore(answers)
  const risk = score >= FALL_RISK_THRESHOLD
  const yesItems = FALL_QUESTIONS.filter((q) => answers[q.id])
  const pickedHazards = HOME_HAZARDS.filter((h) => hazards.includes(h.id))
  const needsEquipment = pickedHazards.some((h) => h.welfareEquipment)
  const coords = useSavedCoords()

  // 결과 요약만 기기에 남김 (답변은 남기지 않음)
  useEffect(() => {
    saveLastResult('fall', risk ? `주의 필요 (${score}점)` : `낮은 편 (${score}점)`)
  }, [risk, score])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const searchHref = (() => {
    const p = new URLSearchParams({ purpose: FALL_PURPOSE })
    if (coords) {
      p.set('lat', coords.lat)
      p.set('lng', coords.lng)
    }
    return `/search?${p.toString()}`
  })()

  const pct = Math.min(100, (score / FALL_MAX_SCORE) * 100)
  const thresholdPct = (FALL_RISK_THRESHOLD / FALL_MAX_SCORE) * 100

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-12">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-1">
        <button onClick={onRestart} aria-label="처음부터 다시" className="w-12 h-12 -ml-2 flex items-center justify-center text-gray-500">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="text-[16px] font-bold text-gray-900">낙상 위험 체크 결과</p>
      </div>

      <section className="bg-white px-5 pt-6 pb-6">
        <span
          className="inline-block text-[14px] font-bold px-3 py-1 rounded-full"
          style={risk ? { background: '#FEF3C7', color: '#92400E' } : { background: '#E8F6F4', color: GREEN_DARK }}
        >
          {risk ? '주의가 필요해요' : '낮은 편이에요'}
        </span>
        <h1 className="text-[24px] font-extrabold text-gray-900 leading-snug mt-3">
          {risk ? '넘어질 위험이 있을 수 있어요' : '지금은 넘어질 위험이 높지 않은 편이에요'}
        </h1>
        <p className="text-[17px] text-gray-600 mt-2 leading-relaxed">
          {risk
            ? '점검표 기준 4점 이상이에요. 다음 진료 때 이 결과를 의사와 상의해 보세요.'
            : '그래도 다리 힘과 균형을 꾸준히 기르면 넘어짐을 예방하는 데 도움이 돼요.'}
        </p>

        {/* 점수 막대 */}
        <div className="mt-5">
          <div className="flex justify-between text-[14px] text-gray-500 mb-1.5">
            <span>
              점수 <b className="text-gray-900 text-[17px]">{score}</b> / {FALL_MAX_SCORE}
            </span>
            <span>4점부터 주의</span>
          </div>
          <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: risk ? '#F59E0B' : GREEN }} />
            <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400" style={{ left: `${thresholdPct}%` }} aria-hidden="true" />
          </div>
        </div>
      </section>

      {yesItems.length > 0 && (
        <section className="px-5 pt-6">
          <h2 className="text-[18px] font-bold text-gray-900 mb-3">이런 점을 살펴보세요</h2>
          <div className="flex flex-col gap-2.5">
            {yesItems.map((q) => (
              <div key={q.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-[16px] font-bold text-gray-900 leading-snug">{q.text.replace(/\n/g, ' ')}</p>
                <p className="text-[15px] text-gray-600 mt-1 leading-relaxed">{q.why}</p>
                <p className="text-[15px] mt-1 leading-relaxed" style={{ color: GREEN_DARK }}>
                  👉 {q.tip}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="px-5 pt-6">
        <h2 className="text-[18px] font-bold text-gray-900 mb-3">집 안 점검</h2>
        {pickedHazards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-[16px] text-gray-600">
            고르신 위험한 곳이 없어요 👍 지금 상태를 잘 유지해 주세요.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {pickedHazards.map((h) => (
              <div key={h.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-[16px] font-bold text-gray-900 leading-snug">{h.text}</p>
                <p className="text-[15px] mt-1 leading-relaxed" style={{ color: GREEN_DARK }}>
                  👉 {h.tip}
                </p>
              </div>
            ))}
            {needsEquipment && (
              <div className="rounded-2xl p-4" style={{ background: '#E8F6F4' }}>
                <p className="text-[15px] text-gray-700 leading-relaxed">
                  장기요양등급이 있으면 <b>안전손잡이·미끄럼방지용품·경사로</b>를 복지용구로, 정해진 한도 안에서 비용 일부만 내고 마련할 수 있어요.
                </p>
                <Link href="/check/ltc" className="inline-flex items-center min-h-[44px] mt-1 text-[15px] font-bold" style={{ color: GREEN_DARK }}>
                  등급이 없다면 1분 등급 예상 ›
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="px-5 pt-7">
        <h2 className="text-[18px] font-bold text-gray-900 mb-3">다음 할 일</h2>
        <div className="flex flex-col gap-3">
          {(risk || answers.fell) && (
            <StepCard
              title="다음 진료 때 결과를 보여 주세요"
              body={['넘어진 적이 있거나 4점 이상이면, 드시는 약·시력·혈압처럼 넘어짐과 관련된 것을 의사와 함께 확인하는 게 좋아요.']}
              actions={[]}
            />
          )}
          <StepCard
            title="보행·균형 운동을 시작해 보세요"
            body={['물리치료사가 다리 힘과 균형을 기르는 운동을 부모님 상태에 맞춰 안전하게 지도해 드려요.']}
            actions={[
              { label: '보행·균형 운동 전문가 보기', href: searchHref },
              { label: '부모님 상황 맞춤 찾기', href: '/find' },
            ]}
          />
          {pickedHazards.length > 0 && (
            <StepCard
              title="집 안 안전 점검을 받아 보세요"
              body={['물리치료사가 집으로 방문해 위험한 곳과 생활 동선을 함께 살펴볼 수 있어요.']}
              actions={[{ label: '방문 요청서 쓰기', href: `/request?purpose=${encodeURIComponent(FALL_PURPOSE)}` }]}
            />
          )}
        </div>
      </section>

      <section className="px-5 pt-6">
        <p className="text-[14px] text-gray-500 leading-relaxed">
          ⓘ 이 점검은 의학적 진단이 아니에요. 미국 질병통제예방센터(CDC)의 STEADI &lsquo;Stay Independent&rsquo; 점검표(12문항)를 우리말로 옮겨 만들었고, 집 안 점검을 더했어요. 결과 요약만 이 기기에 남아요.
        </p>
      </section>

      <div className="px-5 pt-5 flex flex-col gap-2.5">
        <ShareButton path="/check/fall" title="낙상 위험 1분 체크" text="부모님 낙상 위험을 1분 만에 점검해 볼 수 있어요" />
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={onRestart} className="min-h-[52px] rounded-xl bg-white border border-gray-200 text-[16px] font-semibold text-gray-600">
            다시 하기
          </button>
          <Link href="/check" className="min-h-[52px] rounded-xl bg-white border border-gray-200 text-[16px] font-semibold text-gray-600 flex items-center justify-center">
            다른 자가진단
          </Link>
        </div>
        <Link
          href="/"
          className="min-h-[52px] rounded-xl text-[16px] font-bold text-white flex items-center justify-center"
          style={{ background: GREEN }}
        >
          홈으로
        </Link>
      </div>
    </main>
  )
}
