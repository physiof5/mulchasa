'use client'

// 돌봄 비용 모의 계산 (참고용)
// 서비스·등급·이용량·본인부담 유형을 고르면 한 달에 본인이 내는 돈을 바로 보여 준다.
// 입력값은 이 화면에서만 쓰고, 결과 요약만 이 기기(localStorage)에 남긴다.

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { OptionButton, StepCard, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/QuestionFlow'
import ShareButton from '@/components/ShareButton'
import { saveLastResult } from '@/lib/checks'
import { PHONES } from '@/lib/care'
import {
  SERVICE_OPTIONS, GRADE_OPTIONS, DAYCARE_BANDS, HOMECARE_FEE, COPAY_OPTIONS, COST_BASIS, COUNT_LIMIT,
  calcCost, homecareMinutesFor, manwon, won, wonRange, percent, serviceLabel, gradeLabel,
  type CostService, type CostGrade, type CopayType, type DaycareBand,
} from '@/lib/cost'

const tel = (n: string) => `tel:${n.replace(/-/g, '')}`

// 한 달 횟수 빠른 선택 (한 달 ≒ 4.3주)
const WEEKLY_PRESETS = [
  { label: '주 2회', count: 9 },
  { label: '주 3회', count: 13 },
  { label: '주 5회', count: 22 },
  { label: '매일', count: 30 },
]

const minutesLabel = (m: number) => (m % 60 === 0 ? `${m}분(${m / 60}시간)` : `${m}분`)

export default function CostCheckPage() {
  const router = useRouter()
  const [service, setService] = useState<CostService | null>(null)
  const [grade, setGrade] = useState<CostGrade | null>(null)
  const [facilityDays, setFacilityDays] = useState(30)
  const [daycareDays, setDaycareDays] = useState(22)
  const [band, setBand] = useState<DaycareBand>('h8')
  const [minutes, setMinutes] = useState(180)
  const [visits, setVisits] = useState(22)
  const [copay, setCopay] = useState<CopayType>('general')
  const [extraMan, setExtraMan] = useState('')

  const allowedMinutes = grade ? homecareMinutesFor(grade) : HOMECARE_FEE.map((r) => r.minutes)
  // 등급을 바꿔서 고른 시간이 안 되면, 그 등급에서 가장 긴 시간으로 보여 준다
  const shownMinutes = allowedMinutes.includes(minutes) ? minutes : allowedMinutes[allowedMinutes.length - 1] ?? minutes

  // 계산이 가벼워서 화면을 그릴 때마다 바로 계산한다
  const result =
    service && grade
      ? calcCost({
          service,
          grade,
          copay,
          days: service === 'facility' ? facilityDays : daycareDays,
          band,
          minutes: shownMinutes,
          visits,
          extra: (Number(extraMan) || 0) * 10000,
        })
      : null

  const usageText = !service
    ? ''
    : service === 'facility'
      ? `한 달 ${facilityDays}일`
      : service === 'daycare'
        ? `하루 ${DAYCARE_BANDS.find((b) => b.value === band)?.label} · 한 달 ${daycareDays}일`
        : `1회 ${shownMinutes}분 · 한 달 ${visits}회`

  const summary = result && !result.blocked && service && grade ? `${serviceLabel(service)}·${gradeLabel(grade)} 월 ${manwon(result.monthly)}` : null

  // 결과 요약만 이 기기에 남겨서 '자가진단' 첫 화면에 보여 준다
  useEffect(() => {
    if (summary) saveLastResult('cost', summary)
  }, [summary])

  const goBack = () => {
    if (window.history.length > 1) router.back()
    else router.push('/check')
  }

  const scrollToResult = () => {
    document.getElementById('cost-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const reset = () => {
    setService(null)
    setGrade(null)
    setFacilityDays(30)
    setDaycareDays(22)
    setBand('h8')
    setMinutes(180)
    setVisits(22)
    setCopay('general')
    setExtraMan('')
    window.scrollTo(0, 0)
  }

  const copayOption = COPAY_OPTIONS.find((o) => o.value === copay) ?? COPAY_OPTIONS[0]
  const daycareExtraRule =
    service === 'daycare' && grade !== 'cog' && daycareDays >= 15 && (band === 'h8' || band === 'h10' || band === 'h13')

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-32">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-1">
        <button onClick={goBack} aria-label="뒤로" className="w-12 h-12 -ml-2 flex items-center justify-center text-gray-500">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="text-[16px] font-bold text-gray-900">돌봄 비용 모의 계산</p>
      </div>

      <section className="bg-white px-5 pt-6 pb-6">
        <span className="inline-block text-[14px] font-bold px-3 py-1 rounded-full" style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
          2026년 공식 수가 기준
        </span>
        <h1 className="text-[24px] font-extrabold text-gray-900 leading-snug mt-3">
          장기요양 서비스,
          <br />
          한 달에 얼마 낼까요?
        </h1>
        <p className="text-[17px] text-gray-600 mt-2 leading-relaxed">
          서비스와 등급, 이용량을 고르면 본인이 내는 돈을 바로 계산해 드려요.
        </p>
      </section>

      <Block n={1} title="어떤 서비스를 생각하세요?">
        <div className="flex flex-col gap-2.5">
          {SERVICE_OPTIONS.map((o) => (
            <OptionButton
              key={o.value}
              label={`${o.emoji} ${o.label}`}
              desc={o.desc}
              selected={service === o.value}
              onClick={() => setService(o.value)}
            />
          ))}
        </div>
      </Block>

      {service && (
        <Block n={2} title="부모님 장기요양등급은요?">
          <div className="grid grid-cols-5 gap-2">
            {GRADE_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                selected={grade === o.value}
                onClick={() => setGrade(o.value)}
                className={o.value === 'cog' ? 'col-span-5' : undefined}
              />
            ))}
          </div>
          <Link href="/check/ltc" className="mt-3 min-h-[48px] flex items-center text-[16px] font-semibold" style={{ color: GREEN_DARK }}>
            등급이 아직 없나요? 장기요양등급 1분 예상 ›
          </Link>
        </Block>
      )}

      {service && grade && (
        <>
          <Block n={3} title={service === 'facility' ? '한 달에 며칠 계시나요?' : service === 'daycare' ? '얼마나 다니실 건가요?' : '얼마나 이용하실 건가요?'}>
            {service === 'facility' && (
              <Stepper label="이용 일수" unit="일" value={facilityDays} min={1} max={COUNT_LIMIT.days} onChange={setFacilityDays} />
            )}

            {service === 'daycare' && (
              <>
                <p className="text-[16px] font-semibold text-gray-700 mb-2">하루 이용 시간</p>
                <div className="grid grid-cols-3 gap-2">
                  {DAYCARE_BANDS.map((b) => (
                    <Chip key={b.value} label={b.label} selected={band === b.value} onClick={() => setBand(b.value)} />
                  ))}
                </div>
                <p className="text-[16px] font-semibold text-gray-700 mt-5 mb-2">한 달 이용 일수</p>
                <Stepper label="이용 일수" unit="일" value={daycareDays} min={1} max={COUNT_LIMIT.days} onChange={setDaycareDays} />
                <Presets value={daycareDays} onPick={setDaycareDays} />
              </>
            )}

            {service === 'homecare' && allowedMinutes.length > 0 && (
              <>
                <p className="text-[16px] font-semibold text-gray-700 mb-2">1회 이용 시간</p>
                <div className="grid grid-cols-2 gap-2">
                  {allowedMinutes.map((m) => (
                    <Chip key={m} label={minutesLabel(m)} selected={shownMinutes === m} onClick={() => setMinutes(m)} />
                  ))}
                </div>
                <p className="text-[14px] text-gray-500 mt-2 leading-relaxed">
                  1회 이용 시간은 1~2등급 최대 240분, 3~5등급 최대 180분으로 안내되고 있어요.
                </p>
                <p className="text-[16px] font-semibold text-gray-700 mt-5 mb-2">한 달 이용 횟수</p>
                <Stepper label="이용 횟수" unit="회" value={visits} min={1} max={COUNT_LIMIT.visits} onChange={setVisits} />
                <Presets value={visits} onPick={setVisits} />
              </>
            )}
            {service === 'homecare' && allowedMinutes.length === 0 && (
              <p className="text-[16px] text-gray-600 leading-relaxed">인지지원등급은 방문요양을 이용할 수 없어요. 아래 결과에서 다른 서비스를 골라 보세요.</p>
            )}
          </Block>

          <Block n={4} title="본인부담 유형은요?" sub="장기요양인정서나 이용계획서에 적힌 본인부담률을 보면 정확해요.">
            <div className="flex flex-col gap-2.5">
              {COPAY_OPTIONS.map((o) => (
                <OptionButton key={o.value} label={o.label} desc={o.desc} selected={copay === o.value} onClick={() => setCopay(o.value)} />
              ))}
            </div>
          </Block>

          <Block
            n={5}
            title="식비 같은 비급여도 넣어 볼까요? (선택)"
            sub={
              service === 'facility'
                ? '요양원은 식비·간식비·이미용비·상급침실료 등을 따로 내요. 기관마다 달라서 상담할 때 한 달 비급여 합계를 물어보고 넣어 보세요.'
                : service === 'daycare'
                  ? '주야간보호는 식비·간식비 등을 따로 내요. 센터에 한 달 비급여 합계를 물어보고 넣어 보세요.'
                  : '기관에서 따로 받는 비용이 있다면 넣어 보세요.'
            }
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={extraMan}
                onChange={(e) => setExtraMan(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="0"
                aria-label="한 달 비급여 금액 (만 원)"
                className="flex-1 min-w-0 min-h-[56px] rounded-2xl border-2 border-gray-200 bg-white px-4 text-[20px] font-bold text-gray-900 focus:outline-none"
                style={{ borderColor: extraMan ? GREEN : undefined }}
              />
              <span className="text-[18px] font-semibold text-gray-600 shrink-0">만 원</span>
            </div>
          </Block>

          {/* ── 결과 ── */}
          <section id="cost-result" className="px-5 pt-8 scroll-mt-16">
            <h2 className="text-[20px] font-extrabold text-gray-900 mb-3">계산 결과</h2>

            {result?.blocked ? (
              <div className="rounded-2xl p-5" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <p className="text-[17px] font-bold text-amber-900 leading-relaxed">{result.blocked}</p>
                <button
                  type="button"
                  onClick={() => setService('daycare')}
                  className="mt-4 w-full min-h-[52px] rounded-xl text-[16px] font-bold text-white"
                  style={{ background: GREEN }}
                >
                  주야간보호로 계산해 보기
                </button>
              </div>
            ) : (
              result && (
                <>
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-[15px] font-semibold text-gray-500">
                      {serviceLabel(service)} · {gradeLabel(grade)} · {usageText}
                    </p>
                    <p className="text-[16px] text-gray-700 mt-3">한 달에 본인이 내는 돈 (예상)</p>
                    <p className="text-[34px] font-extrabold leading-tight mt-0.5" style={{ color: GREEN_DARK }}>
                      {manwon(result.monthly)}
                    </p>
                    {result.extra > 0 && (
                      <p className="text-[15px] text-gray-500 mt-1">
                        장기요양 본인부담 {manwon([result.copay[0] + result.over[0], result.copay[1] + result.over[1]])} + 비급여{' '}
                        {manwon([result.extra, result.extra])}
                      </p>
                    )}

                    {result.limit !== null && result.usagePct !== null && (
                      <div className="mt-5">
                        <div className="flex items-center justify-between text-[15px]">
                          <span className="font-semibold text-gray-700">월 한도액 사용</span>
                          <span className="font-bold tabular-nums" style={{ color: result.usagePct > 100 ? '#B45309' : GREEN_DARK }}>
                            {result.usagePct}%
                          </span>
                        </div>
                        <div
                          className="h-3 rounded-full bg-gray-100 overflow-hidden mt-1.5"
                          role="progressbar"
                          aria-label="월 한도액 사용률"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.min(100, result.usagePct)}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, result.usagePct)}%`, background: result.usagePct > 100 ? '#F59E0B' : GREEN }}
                          />
                        </div>
                        <p className="text-[14px] text-gray-500 mt-1.5 leading-relaxed">
                          {gradeLabel(grade)} 월 한도액 {won(result.limit)}
                          {result.maxCount !== null && ` · 한도 안에서 한 달 최대 ${result.maxCount}${result.unitLabel}`}
                        </p>
                      </div>
                    )}

                    <dl className="mt-5 divide-y divide-gray-100 border-t border-gray-100">
                      <Row label={`1${result.unitLabel} 비용`} value={wonRange(result.unitFee)} />
                      <Row label="이용" value={`${result.count}${result.unitLabel}`} />
                      <Row label="전체 비용 (공단 몫 포함)" value={wonRange(result.totalFee)} />
                      <Row label="공단이 내는 돈" value={wonRange(result.nhis)} />
                      <Row label={`본인부담 (${percent(result.copayRate)})`} value={wonRange(result.copay)} />
                      {result.over[1] > 0 && <Row label="한도를 넘은 금액 (전액 본인)" value={wonRange(result.over)} warn />}
                      {result.extra > 0 && <Row label="비급여 (직접 입력)" value={won(result.extra)} />}
                      <Row label="합계 (본인이 내는 돈)" value={wonRange(result.monthly)} strong />
                    </dl>
                  </div>

                  {result.over[1] > 0 && (
                    <div className="mt-3 rounded-2xl p-4" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <p className="text-[16px] font-bold text-amber-900 leading-relaxed">
                        월 한도액을 {won(result.over[1])} 넘어요. 넘는 금액은 전부 본인이 내요.
                      </p>
                      {result.maxCount !== null && (
                        <p className="text-[15px] text-amber-900/80 mt-1 leading-relaxed">
                          한도 안에서는 한 달 최대 {result.maxCount}
                          {result.unitLabel}까지 이용할 수 있어요.
                        </p>
                      )}
                      {daycareExtraRule && (
                        <p className="text-[15px] text-amber-900/80 mt-1 leading-relaxed">
                          주야간보호를 한 달 15일 이상(하루 8시간 이상) 다니면 한도액을 조금 더 인정받을 수 있다는 안내가 있어요. 적용 여부는 센터나 공단에 확인해 보세요.
                        </p>
                      )}
                    </div>
                  )}

                  {result.notes.length > 0 && (
                    <div className="mt-3 rounded-2xl bg-white border border-gray-100 p-4 space-y-1.5">
                      {result.notes.map((n) => (
                        <p key={n} className="text-[15px] text-gray-600 leading-relaxed">
                          · {n}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )
            )}

            <div className="mt-3 rounded-2xl p-4" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <p className="text-[15px] font-bold text-amber-900">ⓘ 모의 계산이에요. 실제 금액은 기관과 계약 내용에 따라 달라요.</p>
              <ul className="mt-1.5 space-y-1 text-[14px] text-amber-900/80 leading-relaxed">
                <li>· 야간·휴일 가산, 차량 이동(송영), 목욕 같은 추가 서비스가 더해질 수 있어요.</li>
                <li>· 방문요양과 주야간보호를 함께 쓰면 월 한도액을 나눠 써요.</li>
                {service === 'facility' && <li>· 작은 요양원(노인요양공동생활가정)은 1일 비용이 조금 더 낮아요.</li>}
                <li>· 계약 전에 기관에 한 달 예상 청구 금액을 꼭 물어보세요.</li>
              </ul>
              <p className="text-[13px] text-amber-900/70 mt-2">
                기준: {COST_BASIS.notice}({COST_BASIS.effective}) 장기요양급여비용 · 최종 확인 {COST_BASIS.checkedAt}
              </p>
            </div>
          </section>

          <section className="px-5 pt-7">
            <h2 className="text-[18px] font-bold text-gray-900 mb-3">다음 할 일</h2>
            <div className="flex flex-col gap-3">
              <StepCard
                title="기관 상담 때 꼭 물어보세요"
                body={[
                  '한 달 비급여(식비·간식비 등) 합계는 얼마인가요?',
                  '야간·휴일 가산이나 차량 이동 비용이 더해지나요?',
                  '본인부담금을 깎아 주거나 면제해 준다는 곳은 조심하세요. 법으로 금지된 일이에요.',
                ]}
                actions={[]}
              />
              <StepCard
                title="본인부담을 줄일 수 있는지 확인해요"
                body={[
                  `지금은 '${copayOption.label}' 기준으로 계산했어요.`,
                  '건강보험료·재산 기준에 따라 본인부담금이 40% 또는 60% 줄어들 수 있어요. 감경 신청서는 서식자료실에 있어요.',
                ]}
                actions={[
                  { label: '서식자료실에서 감경신청서 보기', href: '/settings/forms?cat=cost' },
                  { label: `공단 상담 ${PHONES.nhis.number}`, href: tel(PHONES.nhis.number) },
                ]}
              />
              <StepCard
                title="등급을 아직 못 받으셨다면"
                body={['장기요양등급이 있어야 공단 지원을 받을 수 있어요. 어느 등급 범위일지 먼저 살펴보세요.']}
                actions={[{ label: '장기요양등급 1분 예상', href: '/check/ltc' }]}
              />
              <StepCard
                title="운동으로 생활 동작을 지켜요"
                body={['물리치료사가 일어나기·걷기 같은 생활 동작을 운동으로 지도해 드려요.']}
                actions={[{ label: '부모님 상황 맞춤 찾기', href: '/find' }]}
              />
            </div>
          </section>

          <section className="px-5 pt-6">
            <p className="text-[14px] text-gray-500 leading-relaxed">🔒 입력한 내용은 저장되지 않고, 결과 요약만 이 기기에 남아요.</p>
          </section>

          <div className="px-5 pt-5 flex flex-col gap-2.5">
            <ShareButton path="/check/cost" title="돌봄 비용 모의 계산" text="방문요양·주야간보호·요양원 한 달 비용을 미리 계산해 볼 수 있어요" />
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={reset} className="min-h-[52px] rounded-xl bg-white border border-gray-200 text-[16px] font-semibold text-gray-600">
                처음부터 다시
              </button>
              <Link href="/check" className="min-h-[52px] rounded-xl bg-white border border-gray-200 text-[16px] font-semibold text-gray-600 flex items-center justify-center">
                다른 자가진단
              </Link>
            </div>
          </div>
        </>
      )}

      {/* 아래에 늘 보이는 계산 결과 요약 */}
      {result && !result.blocked && (
        <div className="fixed bottom-0 inset-x-0 z-20">
          <div className="max-w-md mx-auto bg-white border-t border-gray-200 px-5 py-3 flex items-center gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
            <div className="flex-1 min-w-0" aria-live="polite">
              <p className="text-[14px] text-gray-500">한 달 예상 (본인 부담)</p>
              <p className="text-[22px] font-extrabold leading-tight truncate" style={{ color: GREEN_DARK }}>
                {manwon(result.monthly)}
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToResult}
              className="min-h-[48px] px-5 rounded-xl text-[16px] font-bold text-white shrink-0"
              style={{ background: GREEN }}
            >
              자세히 보기
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

function Block({ n, title, sub, children }: { n: number; title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="px-5 pt-7">
      <h2 className="text-[19px] font-extrabold text-gray-900 leading-snug flex items-start gap-2">
        <span
          className="w-7 h-7 rounded-full text-[15px] font-bold text-white flex items-center justify-center shrink-0 mt-px"
          style={{ background: GREEN }}
          aria-hidden="true"
        >
          {n}
        </span>
        <span>{title}</span>
      </h2>
      {sub && <p className="text-[15px] text-gray-500 mt-1.5 leading-relaxed">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Chip({ label, selected, onClick, className }: { label: string; selected: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={'min-h-[52px] px-1.5 rounded-xl border-2 text-[16px] font-bold whitespace-nowrap active:scale-[0.98] transition-all ' + (className ?? '')}
      style={selected ? { borderColor: GREEN, background: GREEN_LIGHT, color: GREEN_DARK } : { borderColor: '#E5E7EB', background: '#fff', color: '#374151' }}
    >
      {label}
    </button>
  )
}

function Stepper({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const btn = 'w-14 h-14 rounded-xl text-[26px] font-bold flex items-center justify-center disabled:opacity-30'
  return (
    <div className="flex items-center justify-between rounded-2xl border-2 border-gray-200 bg-white p-1.5">
      <button type="button" aria-label={`${label} 줄이기`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className={btn} style={{ background: '#F3F4F6', color: '#374151' }}>
        −
      </button>
      <span className="text-[24px] font-extrabold text-gray-900 tabular-nums" aria-live="polite">
        {value}
        <span className="text-[17px] font-semibold text-gray-500 ml-1">{unit}</span>
      </span>
      <button type="button" aria-label={`${label} 늘리기`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className={btn} style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
        +
      </button>
    </div>
  )
}

function Presets({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2 mt-2">
      {WEEKLY_PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          aria-pressed={value === p.count}
          onClick={() => onPick(p.count)}
          className="min-h-[48px] rounded-xl border text-[15px] font-semibold"
          style={value === p.count ? { borderColor: GREEN, background: GREEN_LIGHT, color: GREEN_DARK } : { borderColor: '#E5E7EB', background: '#fff', color: '#4B5563' }}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function Row({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className={'min-w-0 text-[15px] ' + (strong ? 'font-bold text-gray-900' : 'text-gray-600')}>{label}</dt>
      <dd
        className={'shrink-0 whitespace-nowrap text-[15px] text-right tabular-nums ' + (strong ? 'font-extrabold' : 'font-semibold')}
        style={{ color: warn ? '#B45309' : strong ? GREEN_DARK : '#1F2937' }}
      >
        {value}
      </dd>
    </div>
  )
}
