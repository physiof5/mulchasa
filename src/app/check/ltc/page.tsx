'use client'

// 장기요양등급 1분 예상 (참고용 간이 점검)
// 일상생활 8가지 + 치매·행동·간호 → 공단 등급 설명과 가장 가까운 '예상 범위'와 신청 방법을 안내
// 답변은 이 기기 화면에서만 쓰고, 결과 요약만 기기(localStorage)에 남긴다.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FlowShell, Question, OptionButton, StepCard, GREEN, GREEN_DARK } from '@/components/QuestionFlow'
import ShareButton from '@/components/ShareButton'
import {
  ELIGIBILITY_OPTIONS, ADL_ITEMS, DEMENTIA_OPTIONS, BEHAVIOR_ITEM, NURSING_OPTIONS, LTC_BAND_TEXT,
  OFFICIAL_GRADES, LTC_DISCLAIMER, ltcBand, saveLastResult,
  type Eligibility, type Dementia, type LtcBand, type LtcInput,
} from '@/lib/checks'
import { LINKS, PHONES } from '@/lib/care'

const STEP_KEYS = ['eligibility', ...ADL_ITEMS.map((i) => i.id), 'dementia', 'behavior', 'nursing']
const TOTAL = STEP_KEYS.length

const SHORT: Record<LtcBand, string> = {
  g12: '1~2등급 범위',
  g23: '2~3등급 범위',
  g34: '3~4등급 범위',
  g45: '4~5등급·인지지원 범위',
  g4: '4등급 근처',
  g5c: '5등급·인지지원 범위',
  memory_check: '치매 검진 먼저',
  none: '등급 외 가능성',
  not_eligible: '다른 제도 안내',
}

const tel = (n: string) => `tel:${n.replace(/-/g, '')}`

export default function LtcCheckPage() {
  const router = useRouter()
  const [idx, setIdx] = useState(0)
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [adl, setAdl] = useState<Record<string, number>>({})
  const [dementia, setDementia] = useState<Dementia | null>(null)
  const [behavior, setBehavior] = useState<number | null>(null)
  const [nursing, setNursing] = useState<boolean | null>(null)
  const [done, setDone] = useState(false)
  const advancing = useRef(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [idx, done])

  const next = (finish = false) => {
    window.setTimeout(() => {
      if (finish) setDone(true)
      else setIdx((i) => i + 1)
      advancing.current = false
    }, 180)
  }
  const guard = () => {
    if (advancing.current) return false
    advancing.current = true
    return true
  }

  const goBack = () => {
    if (idx === 0) router.push('/check')
    else setIdx((i) => i - 1)
  }

  const restart = () => {
    setIdx(0)
    setEligibility(null)
    setAdl({})
    setDementia(null)
    setBehavior(null)
    setNursing(null)
    setDone(false)
  }

  if (done && eligibility) {
    const input: LtcInput = {
      eligibility,
      adl,
      dementia: dementia ?? 'none',
      behavior: behavior ?? 0,
      nursing: nursing ?? false,
    }
    return <LtcResult input={input} onRestart={restart} />
  }

  const key = STEP_KEYS[idx]
  const shell = (children: ReactNode) => (
    <FlowShell title="장기요양등급 1분 예상" step={idx + 1} total={TOTAL} onBack={goBack}>
      {children}
    </FlowShell>
  )

  if (key === 'eligibility') {
    return shell(
      <>
        <p className="text-[15px] text-gray-500 mb-4 leading-relaxed">
          부모님의 평소 모습을 떠올리며 답해 주세요. 답변은 저장되지 않아요.
        </p>
        <Question title={'부모님은\n어떤 경우인가요?'} sub="장기요양은 소득과 상관없이 신청할 수 있어요" />
        <div className="flex flex-col gap-2.5">
          {ELIGIBILITY_OPTIONS.map((o) => (
            <OptionButton
              key={o.value}
              label={o.label}
              desc={o.desc}
              selected={eligibility === o.value}
              onClick={() => {
                if (!guard()) return
                setEligibility(o.value)
                // 65세 미만이고 노인성 질병이 없으면 바로 다른 제도 안내로
                next(o.value === 'under65_none')
              }}
            />
          ))}
        </div>
      </>
    )
  }

  const adlItem = ADL_ITEMS.find((i) => i.id === key)
  if (adlItem) {
    const n = ADL_ITEMS.indexOf(adlItem) + 1
    return shell(
      <>
        <p className="text-[15px] font-semibold mb-2" style={{ color: GREEN_DARK }}>
          일상생활 {n}/{ADL_ITEMS.length}
        </p>
        <Question title={adlItem.title} sub="평소 모습을 기준으로 골라 주세요" />
        <div className="flex flex-col gap-2.5">
          {adlItem.options.map((label, score) => (
            <OptionButton
              key={label}
              label={label}
              selected={adl[adlItem.id] === score}
              onClick={() => {
                if (!guard()) return
                setAdl((a) => ({ ...a, [adlItem.id]: score }))
                next()
              }}
            />
          ))}
        </div>
      </>
    )
  }

  if (key === 'dementia') {
    return shell(
      <>
        <Question title={'치매 진단을\n받으셨나요?'} />
        <div className="flex flex-col gap-2.5">
          {DEMENTIA_OPTIONS.map((o) => (
            <OptionButton
              key={o.value}
              label={o.label}
              selected={dementia === o.value}
              onClick={() => {
                if (!guard()) return
                setDementia(o.value)
                next()
              }}
            />
          ))}
        </div>
      </>
    )
  }

  if (key === 'behavior') {
    return shell(
      <>
        <Question title={BEHAVIOR_ITEM.title} sub="돌보기 힘든 행동이 있는지 여쭤봐요" />
        <div className="flex flex-col gap-2.5">
          {BEHAVIOR_ITEM.options.map((label, score) => (
            <OptionButton
              key={label}
              label={label}
              selected={behavior === score}
              onClick={() => {
                if (!guard()) return
                setBehavior(score)
                next()
              }}
            />
          ))}
        </div>
      </>
    )
  }

  // 마지막: 간호가 필요한 일
  return shell(
    <>
      <Question title={'욕창, 콧줄·소변줄, 산소, 투석처럼\n간호가 필요한 일이 있나요?'} />
      <div className="flex flex-col gap-2.5">
        {NURSING_OPTIONS.map((o) => (
          <OptionButton
            key={o.label}
            label={o.label}
            selected={nursing === o.value}
            onClick={() => {
              if (!guard()) return
              setNursing(o.value)
              next(true)
            }}
          />
        ))}
      </div>
    </>
  )
}

function LtcResult({ input, onRestart }: { input: LtcInput; onRestart: () => void }) {
  const band = ltcBand(input)
  const text = LTC_BAND_TEXT[band]
  const eligible = band !== 'not_eligible'

  useEffect(() => {
    saveLastResult('ltc', SHORT[band])
  }, [band])

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-12">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-1">
        <button onClick={onRestart} aria-label="처음부터 다시" className="w-12 h-12 -ml-2 flex items-center justify-center text-gray-500">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="text-[16px] font-bold text-gray-900">장기요양등급 예상 결과</p>
      </div>

      <section className="bg-white px-5 pt-6 pb-6">
        <span className="inline-block text-[14px] font-bold px-3 py-1 rounded-full" style={{ background: '#E8F6F4', color: GREEN_DARK }}>
          참고용 예상
        </span>
        <h1 className="text-[24px] font-extrabold text-gray-900 leading-snug mt-3 whitespace-pre-line">{text.headline}</h1>
        <p className="text-[17px] text-gray-600 mt-2 leading-relaxed">{text.detail}</p>

        {/* 문서 01·02에서 정한 고지 — 문구 그대로 */}
        <div className="mt-5 rounded-xl p-4" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <p className="text-[15px] font-bold text-amber-900">ⓘ {LTC_DISCLAIMER}</p>
          <p className="text-[14px] text-amber-900/80 mt-1 leading-relaxed">
            이 점검은 공단 조사 항목 가운데 일상생활 위주로 몇 가지만 물어본 간이 점검이에요. 실제 등급은 방문조사(신체·인지·행동·간호·재활)와 의사소견서를 바탕으로 정해져서 결과가 다를 수 있어요.
          </p>
        </div>

        <details className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
          <summary className="text-[15px] font-semibold text-gray-600 cursor-pointer min-h-[32px] flex items-center">공단의 등급 기준 보기</summary>
          <div className="mt-2 divide-y divide-gray-200">
            {OFFICIAL_GRADES.map((g) => (
              <div key={g.grade} className="py-2.5">
                <p className="text-[15px] font-bold text-gray-800">
                  {g.grade} <span className="font-normal text-gray-500">· {g.score}</span>
                </p>
                <p className="text-[14px] text-gray-600 leading-relaxed">{g.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-gray-400 mt-2">출처: 국민건강보험공단 (2026년 10월 확인)</p>
        </details>
      </section>

      <section className="px-5 pt-7">
        <h2 className="text-[18px] font-bold text-gray-900 mb-3">다음 할 일</h2>
        <div className="flex flex-col gap-3">
          {eligible ? (
            <>
              <StepCard
                title="장기요양 신청은 이렇게 해요"
                body={[
                  '신청서와 의사소견서가 필요해요. 65세 이상은 의사소견서를 등급판정 전까지 내도 돼요.',
                  '공단 지사에 방문하거나 우편·팩스로 신청해요. 65세 이상은 노인장기요양보험 누리집에서도 신청할 수 있어요.',
                  '가족이 대신 신청할 수 있어요. 대리인 지정서와 신분증 등이 필요해요.',
                ]}
                actions={[
                  { label: '신청 방법 자세히 (건강보험공단)', href: LINKS.ltcApplyGuide, external: true },
                  { label: '노인장기요양보험 누리집', href: LINKS.ltcHome, external: true },
                  { label: `공단 상담 ${PHONES.nhis.number}`, href: tel(PHONES.nhis.number) },
                ]}
              />
              <StepCard
                title="방문조사 때는 평소 모습 그대로"
                body={[
                  '신청하면 공단 직원이 집으로 와서 몸 상태와 생활 모습을 살펴봐요.',
                  '밤에 화장실 가기, 옷 입기처럼 평소 힘들어하시는 순간을 미리 적어 두면 빠뜨리지 않고 말씀드릴 수 있어요.',
                ]}
                actions={[]}
              />
              {(input.dementia === 'memory' || input.dementia === 'diagnosed') && (
                <StepCard
                  title={input.dementia === 'memory' ? '치매안심센터에서 검진을 받아 보세요' : '치매안심센터에서 상담을 받을 수 있어요'}
                  body={[
                    '가까운 보건소의 치매안심센터에서 치매 검진과 가족 상담을 받을 수 있어요.',
                    '5등급·인지지원등급은 치매가 있는 분이 받는 등급이라, 진단 여부가 중요해요.',
                  ]}
                  actions={[{ label: `치매상담콜센터 ${PHONES.dementia.number}`, href: tel(PHONES.dementia.number) }]}
                />
              )}
              {input.eligibility === 'under65_disease' && (
                <StepCard
                  tone="warn"
                  title="장애인 활동지원을 받고 계신가요?"
                  body={['장애인 활동지원을 받고 있거나 받을 예정이라면, 장기요양등급을 받은 뒤 활동지원 신청이 제한될 수 있어요. 신청 전에 국민연금공단에 먼저 물어보세요.']}
                  actions={[{ label: `국민연금공단 ${PHONES.nps.number}`, href: tel(PHONES.nps.number) }]}
                />
              )}
            </>
          ) : (
            <StepCard
              title="다른 제도를 함께 살펴봐요"
              body={[
                '장애가 있다면 장애인 활동지원 같은 제도가 맞을 수 있어요.',
                '보건복지상담센터(129)나 복지로에서 받을 수 있는 지원을 찾아볼 수 있어요.',
              ]}
              actions={[
                { label: '복지로에서 찾아보기', href: LINKS.bokjiro, external: true },
                { label: `보건복지상담 ${PHONES.welfare.number}`, href: tel(PHONES.welfare.number) },
              ]}
            />
          )}
          <StepCard
            title="운동으로 생활 동작을 지켜요"
            body={['등급과 상관없이, 물리치료사가 일어나기·걷기 같은 생활 동작을 운동으로 지도해 드려요.']}
            actions={[{ label: '부모님 상황 맞춤 찾기', href: '/find' }]}
          />
        </div>
      </section>

      <section className="px-5 pt-6">
        <p className="text-[14px] text-gray-500 leading-relaxed">
          🔒 답변은 저장되지 않고, 결과 요약({SHORT[band]})만 이 기기에 남아요.
        </p>
      </section>

      <div className="px-5 pt-5 flex flex-col gap-2.5">
        <ShareButton path="/check/ltc" title="장기요양등급 1분 예상" text="부모님 장기요양등급 범위를 1분 만에 미리 살펴볼 수 있어요" />
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
