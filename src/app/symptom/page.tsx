'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const BRAND = '#0A8A7B'

// ── 0. 대상 ────────────────────────────────────────────────
const SUBJECTS = [
  { id: 'self', label: '제가 직접 받으려고 해요', emoji: '🙋' },
  { id: 'family', label: '가족을 위해 알아보는 중이에요', emoji: '👨‍👩‍👧' },
]

// ── 1. 부위 ────────────────────────────────────────────────
const PARTS = [
  { id: '목', emoji: '😣' },
  { id: '어깨', emoji: '💪' },
  { id: '허리', emoji: '🧘' },
  { id: '무릎', emoji: '🦵' },
  { id: '손목', emoji: '✋' },
  { id: '발목', emoji: '🦶' },
  { id: '골반', emoji: '🚶' },
  { id: '기타', emoji: '➕' },
]

// ── 2. 기간 ────────────────────────────────────────────────
const DURATIONS = [
  { id: 'acute', label: '3일 이내 — 갑자기 생겼어요', emoji: '⚡' },
  { id: 'weeks', label: '1주 ~ 1개월 정도 됐어요', emoji: '📅' },
  { id: 'chronic', label: '3개월 이상 — 오래됐어요', emoji: '⏳' },
  { id: 'prevent', label: '아프진 않아요 · 예방·관리 목적', emoji: '🌱' },
]

// ── 3. 양상 ────────────────────────────────────────────────
const NATURES = [
  { id: 'rest', label: '가만히 있어도 욱신거려요', emoji: '🔥' },
  { id: 'motion', label: '특정 동작·자세에서 아파요', emoji: '🤸' },
  { id: 'stiff', label: '뻣뻣하고 결리는 느낌이에요', emoji: '🪵' },
  { id: 'numb', label: '저리거나 찌릿한 느낌이 있어요', emoji: '⚡' },
  { id: 'postop', label: '수술·부상 후 회복 중이에요', emoji: '🩹' },
  { id: 'posture', label: '아프진 않지만 자세·체형이 걱정돼요', emoji: '🧍' },
]

// ── 5. 장소 ────────────────────────────────────────────────
const PLACES = [
  { id: 'center', label: '가까운 운동센터로 갈게요', emoji: '🏢', desc: '직접 찾아가서 받는 방식' },
  { id: 'visit', label: '집으로 와주셨으면 해요', emoji: '🏠', desc: '거동이 불편하거나 외출이 어려울 때' },
]

// ── 6. 목표 → 전문가 태그(purpose)로 변환 ──────────────────
// tag 값은 가입/검색에서 쓰는 태그 문자열과 정확히 일치해야 함
const GOALS = [
  { id: 'neuro', label: '뇌졸중·파킨슨 등으로 일상생활이 불편해요', tag: '신경계 재활 운동' },
  { id: 'daily', label: '혼자 일어나고 걷는 힘을 되찾고 싶어요', tag: '일상생활 동작 회복' },
  { id: 'fall', label: '넘어지지 않게 걷기·균형을 키우고 싶어요', tag: '보행·균형(낙상 예방)' },
  { id: 'exercise', label: '불편한 곳을 운동으로 관리하고 싶어요', tag: '근골격 재활 운동' },
  { id: 'postop', label: '수술·부상 후 재활 운동을 하고 싶어요', tag: '수술 후 재활 운동' },
  { id: 'postnatal', label: '출산 후 몸을 회복하고 싶어요', tag: '산후 재활 운동' },
  { id: 'posture', label: '자세·체형을 바로잡고 싶어요', tag: '자세교정 운동' },
  { id: 'fitness', label: '꾸준히 운동하며 관리하고 싶어요', tag: '필라테스' },
]

type StepKey = 'subject' | 'part' | 'duration' | 'nature' | 'intensity' | 'place' | 'goal' | 'result'

interface Answers {
  subject: string | null
  part: string | null
  duration: string | null
  nature: string | null
  intensity: number
  place: string | null
  goal: string | null
}

export default function SymptomPage() {
  const router = useRouter()

  const [answers, setAnswers] = useState<Answers>({
    subject: null,
    part: null,
    duration: null,
    nature: null,
    intensity: 4,
    place: null,
    goal: null,
  })
  const [current, setCurrent] = useState<StepKey>('subject')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)

  // 위치는 홈에서 저장한 값을 재사용 (여기서 다시 GPS를 부르지 않음)
  useEffect(() => {
    try {
      const lat = localStorage.getItem('mulchasa_lat')
      const lng = localStorage.getItem('mulchasa_lng')
      if (lat && lng) {
        setUserLat(Number(lat))
        setUserLng(Number(lng))
      }
    } catch {
      // 위치 없이 진행
    }
  }, [])

  // 통증이 없는 경우 강도 단계를 건너뜀
  const buildFlow = (a: Answers): StepKey[] => {
    const noPain = a.nature === 'posture' || a.duration === 'prevent'
    return [
      'subject',
      'part',
      'duration',
      'nature',
      ...(noPain ? [] : (['intensity'] as StepKey[])),
      'place',
      'goal',
      'result',
    ]
  }

  const flow = buildFlow(answers)
  const idx = flow.indexOf(current)
  const totalQuestions = flow.length - 1 // result 제외
  const progress = Math.min(idx + 1, totalQuestions)

  const goNext = (next: Partial<Answers>) => {
    const updated = { ...answers, ...next }
    setAnswers(updated)
    const f = buildFlow(updated)
    const i = f.indexOf(current)
    setCurrent(f[Math.min(i + 1, f.length - 1)])
  }

  const goBack = () => {
    if (idx <= 0) {
      router.push('/')
      return
    }
    setCurrent(flow[idx - 1])
  }

  const isVisit = answers.place === 'visit'
  const isFamily = answers.subject === 'family'
  const noPain = answers.nature === 'posture' || answers.duration === 'prevent'
  const goalObj = GOALS.find((g) => g.id === answers.goal)
  // 위험 신호: 저림 증상이거나 통증이 매우 심한 경우
  const redFlag = answers.nature === 'numb' || (!noPain && answers.intensity >= 8)

  // 대상에 따라 문구를 자연스럽게 조정
  const who = isFamily ? '가족분' : ''
  const partTitle = isFamily ? '가족분은 어디가\n불편하신가요?' : '어디가\n불편하신가요?'

  const buildParams = () => {
    const params = new URLSearchParams()
    // '기타'는 해당 태그가 없으므로 부위 필터에서 제외
    if (answers.part && answers.part !== '기타') params.set('part', answers.part)
    if (goalObj) params.set('purpose', goalObj.tag)
    if (answers.place) params.set('mode', answers.place)
    if (answers.subject) params.set('subject', answers.subject)
    if (answers.duration) params.set('duration', answers.duration)
    if (answers.nature) params.set('nature', answers.nature)
    if (!noPain) params.set('intensity', String(answers.intensity))
    if (userLat !== null) params.set('lat', userLat.toString())
    if (userLng !== null) params.set('lng', userLng.toString())
    return params
  }

  // 센터 방문: 바로 검색 / 집으로 방문: 요청서 작성
  const handleGo = () => {
    const qs = buildParams().toString()
    router.push(isVisit ? `/request?${qs}` : `/search?${qs}`)
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white flex flex-col">
      {/* 상단: 뒤로가기 + 진행바 */}
      <div className="px-5 pt-4 pb-2 flex items-center gap-3">
        <button onClick={goBack} aria-label="이전" className="text-gray-400 -ml-1 p-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {current !== 'result' && (
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(progress / totalQuestions) * 100}%`, background: BRAND }}
            />
          </div>
        )}
        {current !== 'result' && (
          <span className="text-xs text-gray-400 font-semibold tabular-nums">
            {progress}/{totalQuestions}
          </span>
        )}
      </div>

      <div className="flex-1 px-5 pt-6">
        {/* STEP 0 — 대상 */}
        {current === 'subject' && (
          <Step title={'누구를 위해\n찾고 계신가요?'} sub="답변에 맞춰 질문을 조정해드릴게요">
            <OptionList options={SUBJECTS} onSelect={(id) => goNext({ subject: id })} />
          </Step>
        )}

        {/* STEP 1 — 부위 */}
        {current === 'part' && (
          <Step title={partTitle} sub="가장 불편한 부위 하나를 골라주세요">
            <div className="grid grid-cols-4 gap-3">
              {PARTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => goNext({ part: p.id })}
                  className="py-5 rounded-2xl text-center bg-gray-50 text-gray-700 border border-gray-100 active:scale-[0.97] transition-all"
                >
                  <div className="text-xl mb-1">{p.emoji}</div>
                  <div className="text-sm font-bold">{p.id}</div>
                </button>
              ))}
            </div>
          </Step>
        )}

        {/* STEP 2 — 기간 */}
        {current === 'duration' && (
          <Step title={`${answers.part}, 언제부터\n그러셨어요?`} sub="증상이 시작된 시점을 알려주세요">
            <OptionList options={DURATIONS} onSelect={(id) => goNext({ duration: id })} />
          </Step>
        )}

        {/* STEP 3 — 양상 */}
        {current === 'nature' && (
          <Step title={'지금 상태와\n가장 가까운 건?'} sub="느껴지는 그대로 골라주세요">
            <OptionList options={NATURES} onSelect={(id) => goNext({ nature: id })} />
          </Step>
        )}

        {/* STEP 4 — 통증 강도 */}
        {current === 'intensity' && (
          <Step title={'통증이\n얼마나 심한가요?'} sub="0은 거의 없음, 10은 참기 힘든 정도예요">
            <div className="pt-4">
              <div className="text-center mb-6">
                <span className="text-5xl font-extrabold" style={{ color: BRAND }}>
                  {answers.intensity}
                </span>
                <span className="text-lg text-gray-300 font-bold"> / 10</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={answers.intensity}
                onChange={(e) =>
                  setAnswers({ ...answers, intensity: Number(e.target.value) })
                }
                className="w-full accent-[#0A8A7B]"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-2 px-0.5">
                <span>거의 없음</span>
                <span>참기 힘듦</span>
              </div>
              <button
                onClick={() => goNext({})}
                className="w-full py-4 rounded-2xl text-base font-bold text-white mt-10 active:scale-[0.98] transition-all"
                style={{ background: BRAND }}
              >
                다음
              </button>
            </div>
          </Step>
        )}

        {/* STEP 5 — 장소 */}
        {current === 'place' && (
          <Step
            title={'어디에서\n받고 싶으세요?'}
            sub={isFamily ? '가족분이 편하신 방식으로 골라주세요' : '편하신 방식을 골라주세요'}
          >
            <div className="space-y-2.5">
              {PLACES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => goNext({ place: p.id, goal: null })}
                  className="w-full flex items-start gap-3 px-4 py-4 rounded-2xl bg-gray-50 border border-gray-100 text-left active:scale-[0.98] transition-all"
                >
                  <span className="text-xl mt-0.5">{p.emoji}</span>
                  <span>
                    <span className="block text-[15px] font-semibold text-gray-700">{p.label}</span>
                    <span className="block text-xs text-gray-400 mt-0.5">{p.desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4 leading-relaxed">
              집으로 방문해도, 운동센터에서도 운동 지도를 해 드려요. 도수치료 같은
              치료가 필요하면 병원·의원 진료를 먼저 받아 주세요.
            </p>
          </Step>
        )}

        {/* STEP 6 — 목표 */}
        {current === 'goal' && (
          <Step
            title={'어떤 도움을\n받고 싶으세요?'}
            sub="원하시는 방향에 맞춰 전문가를 찾아드려요"
          >
            <div className="space-y-2.5">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => goNext({ goal: g.id })}
                  className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl border text-left transition-all bg-gray-50 border-gray-100 active:scale-[0.98]"
                >
                  <span className="text-[15px] font-semibold text-gray-700">{g.label}</span>
                </button>
              ))}
            </div>
          </Step>
        )}

        {/* RESULT — 매칭 안내 */}
        {current === 'result' && (
          <div className="pt-4">
            <div className="text-center mb-8">
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                style={{ background: '#E1F5EE' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="m5 13 4 4L19 7" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 leading-snug">
                {isVisit
                  ? <>방문 요청서를<br />보내드릴게요</>
                  : <>{answers.part} 증상에 맞는<br />전문가를 찾았어요</>}
              </h1>
              <p className="text-sm text-gray-400 mt-3 leading-relaxed">
                {isVisit
                  ? <>주소와 희망 시간만 알려주시면<br />근처 {goalObj?.tag} 전문가들이 제안을 보내드려요</>
                  : <>답변을 바탕으로 면허 검증된<br />{goalObj?.tag} 전문가를 연결해드릴게요</>}
              </p>
            </div>

            {/* 답변 요약 */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-2.5">
              {isFamily && <SummaryRow label="대상" value="가족" />}
              <SummaryRow label="부위" value={answers.part ?? '-'} />
              <SummaryRow
                label="기간"
                value={DURATIONS.find((d) => d.id === answers.duration)?.label.split(' — ')[0].split(' · ')[0] ?? '-'}
              />
              <SummaryRow
                label="상태"
                value={NATURES.find((n) => n.id === answers.nature)?.label ?? '-'}
              />
              {!noPain && <SummaryRow label="통증 강도" value={`${answers.intensity} / 10`} />}
              <SummaryRow
                label="희망 방식"
                value={isVisit ? '🏠 집으로 방문' : '🏢 운동센터 방문'}
              />
              <SummaryRow label="원하는 도움" value={goalObj?.label ?? '-'} />
            </div>

            {/* 위험 신호 안내 */}
            {redFlag && (
              <div className="rounded-2xl p-4 mb-4 border" style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}>
                <p className="text-sm font-bold text-amber-800 mb-1">잠깐, 먼저 확인해주세요</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  저린 느낌이 있거나 통증이 심한 경우, 먼저 병원에서 진료를 받아보시는 것을 권해요.
                  진단 후 재활이 필요하시면 그때 전문가를 연결해드릴게요.
                </p>
              </div>
            )}

            <button
              onClick={handleGo}
              className="w-full py-4 rounded-2xl text-base font-bold text-white active:scale-[0.98] transition-all shadow-lg"
              style={{ background: BRAND }}
            >
              {isVisit ? '요청서 작성하기' : `${answers.part} 전문가 보기`}
            </button>

            <button
              onClick={() => {
                setAnswers({ subject: null, part: null, duration: null, nature: null, intensity: 4, place: null, goal: null })
                setCurrent('subject')
              }}
              className="w-full py-3 text-gray-400 font-semibold text-sm mt-1"
            >
              처음부터 다시 하기
            </button>

            <p className="text-[11px] text-gray-300 leading-relaxed text-center mt-4">
              이 결과는 의학적 진단이 아니라, 더 잘 맞는 전문가를
              연결해드리기 위한 안내예요.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

/* ── 보조 컴포넌트 ───────────────────────────────────────── */

function Step({
  title,
  sub,
  children,
}: {
  title: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-gray-900 leading-snug whitespace-pre-line">
        {title}
      </h1>
      <p className="text-sm text-gray-400 mt-2 mb-7 leading-relaxed">{sub}</p>
      {children}
    </div>
  )
}

function OptionList({
  options,
  onSelect,
}: {
  options: { id: string; label: string; emoji?: string }[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-2.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onSelect(o.id)}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-gray-50 border border-gray-100 text-left active:scale-[0.98] transition-all"
        >
          {o.emoji && <span className="text-xl">{o.emoji}</span>}
          <span className="text-[15px] font-semibold text-gray-700">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-gray-400 font-semibold shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-semibold text-right">{value}</span>
    </div>
  )
}
