'use client'

// 전문가로 가입하기 — 카카오로 가입한 '일반 회원'이 물리치료사(전문가)로 전환하는 화면
// 숨고 '고수가입' 흐름을 참고(그대로 베끼지 않음): 분야 → 활동 형태 → 활동 지역·거리 → 기본 정보 → 동의 → 프로필 작성 안내
// 자기소개·사진·오픈채팅·가능한 시간·질문답변은 가입 뒤 MY '프로필 수정'에서 채운다(프로필 완성도로 안내).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { findMyTherapistId, useAuthUser } from '@/lib/auth'
import {
  WORK_TYPES, PURPOSE_OPTIONS, PURPOSE_INFO, BODY_PART_OPTIONS, PRACTICE_RULES,
  hasCenterWork, hasVisitWork, hasPlaceWork, deriveServiceMode,
} from '@/lib/practitioner'

const GREEN = '#0A8A7B'
const GREEN_DARK = '#0F6E56'
const GREEN_LIGHT = '#E8F6F4'
const VISIT_RADIUS_OPTIONS = [3, 5, 10, 20, 30]
const TOTAL = 5

const TITLES: Record<number, string> = {
  1: '어떤 운동 지도를\n하실 건가요?',
  2: '어떤 형태로\n활동하세요?',
  3: '어디에서\n활동하세요?',
  4: '면허 확인을 위한\n기본 정보를 알려 주세요',
  5: '마지막으로\n활동 원칙을 확인해 주세요',
}

export default function RegisterPage() {
  const router = useRouter()
  const user = useAuthUser()
  const [already, setAlready] = useState<boolean | null>(null)
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState(false)

  const [purposes, setPurposes] = useState<string[]>([])
  const [bodyParts, setBodyParts] = useState<string[]>([])
  const [showBodyParts, setShowBodyParts] = useState(false)
  const [workTypes, setWorkTypes] = useState<string[]>([])
  const [studioName, setStudioName] = useState('')
  const [address, setAddress] = useState('')
  const [addressResult, setAddressResult] = useState<{ latitude: number; longitude: number; address: string } | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [radiusIndex, setRadiusIndex] = useState(2) // 10km
  const [name, setName] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [years, setYears] = useState('')
  const [phone, setPhone] = useState('')
  const [agreeCollect, setAgreeCollect] = useState(false)
  const [agreePublic, setAgreePublic] = useState(false)
  const [agreeRules, setAgreeRules] = useState(false)

  // 로그인 안 했으면 로그인부터, 이미 전문가면 MY로
  useEffect(() => {
    if (user === null) {
      router.replace('/login?next=/register&reason=expert')
      return
    }
    if (!user) return
    let alive = true
    findMyTherapistId(user.id).then((id) => {
      if (alive) setAlready(!!id)
    })
    return () => {
      alive = false
    }
  }, [user, router])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step, done])

  const hasCenter = hasCenterWork(workTypes)
  const canVisit = hasVisitWork(workTypes)
  const radius = VISIT_RADIUS_OPTIONS[radiusIndex]
  const phoneDigits = phone.replace(/\D/g, '')
  const yearsNum = Number(years)
  const allAgreed = agreeCollect && agreePublic && agreeRules

  const canNext: Record<number, boolean> = {
    1: purposes.length > 0,
    2: hasPlaceWork(workTypes) && (!hasCenter || studioName.trim().length > 0),
    // 방문은 기준 주소가 있어야 거리 검색에 나와서 필수, 센터만이면 선택
    3: !canVisit || !!addressResult,
    4: name.trim().length >= 2 && licenseNumber.trim().length >= 3 && years !== '' && yearsNum >= 0 && yearsNum <= 60 && /^01\d{8,9}$/.test(phoneDigits),
    5: allAgreed,
  }

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const searchAddress = async () => {
    if (!address.trim()) return
    setAddressLoading(true)
    setAddressError('')
    setAddressResult(null)
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`)
      const data = await res.json()
      if (res.ok) setAddressResult(data)
      else setAddressError('주소를 찾지 못했어요. 도로명이나 동 이름까지 넣어 보세요.')
    } catch {
      setAddressError('주소를 찾는 중 문제가 생겼어요. 다시 시도해 주세요.')
    } finally {
      setAddressLoading(false)
    }
  }

  const submit = async () => {
    if (!user) return
    setSubmitting(true)
    setSubmitError('')
    const phoneFormatted = phoneDigits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3')
    const { data: row, error } = await supabase
      .from('therapists')
      .insert({
        name: name.trim(),
        user_id: user.id,
        email: user.email ?? null,
        license_number: licenseNumber.trim(),
        years_experience: yearsNum,
        practitioner_type: 'physical_therapist',
        work_types: workTypes,
        service_mode: deriveServiceMode(workTypes),
        visit_radius_km: canVisit ? radius : null,
        hospital_name: null,
        studio_name: hasCenter ? studioName.trim() : null,
        phone: phoneFormatted,
        // 소개·오픈채팅은 가입 뒤 프로필 작성에서 채운다
        kakao_link: '',
        intro: '',
        verification_status: 'pending',
        latitude: addressResult?.latitude ?? null,
        longitude: addressResult?.longitude ?? null,
        certifications: [],
        consented_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !row) {
      console.error('therapist insert error:', error)
      setSubmitError(
        error?.code === '23505'
          ? '이미 이 계정으로 전문가 가입 신청을 했어요. MY에서 확인해 주세요.'
          : '가입 신청을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
      )
      setSubmitting(false)
      return
    }

    const { data: tagData } = await supabase.from('tags').select('id, label').in('label', [...purposes, ...bodyParts])
    if (tagData && tagData.length > 0) {
      await supabase.from('therapist_tags').insert(tagData.map((t) => ({ therapist_id: row.id, tag_id: t.id })))
    }
    setSubmitting(false)
    setDone(true)
  }

  // ── 상태별 화면 ──
  if (user === undefined || (user && already === null)) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[#0A8A7B] animate-spin" aria-label="확인 중" />
      </main>
    )
  }
  if (!user) return null

  if (already) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[22px] font-extrabold text-gray-900">이미 전문가로 가입했어요</p>
        <p className="text-[16px] text-gray-600 mt-2">MY에서 프로필을 확인하고 채울 수 있어요.</p>
        <Link href="/mypage" className="mt-6 min-h-[52px] px-8 rounded-xl text-white font-bold flex items-center" style={{ background: GREEN }}>
          내 프로필로 가기
        </Link>
      </main>
    )
  }

  if (done) return <ProfileTips name={name.trim()} />

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white pb-28">
      {/* 머리: 뒤로 · 제목 · 닫기 + 진행 막대 */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="px-4 h-14 flex items-center">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : router.back())}
            aria-label="이전"
            className="w-12 h-12 -ml-2 flex items-center justify-center text-gray-600"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="flex-1 text-center text-[17px] font-bold text-gray-900">전문가 가입</p>
          <Link href="/mypage" aria-label="닫기" className="w-12 h-12 -mr-2 flex items-center justify-center text-gray-500 text-[26px]">
            ×
          </Link>
        </div>
        <div className="px-5 pb-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={step}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(step / TOTAL) * 100}%`, background: GREEN }} />
          </div>
          <span className="text-[13px] font-bold tabular-nums" style={{ color: GREEN_DARK }}>
            {Math.round((step / TOTAL) * 100)}%
          </span>
        </div>
      </div>

      <div className="px-5 pt-4">
        <h1 className="text-[24px] font-extrabold text-gray-900 leading-snug whitespace-pre-line">{TITLES[step]}</h1>

        {/* 1. 운동 지도 분야 */}
        {step === 1 && (
          <div className="mt-5">
            <p className="text-[15px] text-gray-500 mb-4">해당하는 분야를 모두 골라 주세요. 보호자 검색에 이 분야로 나와요.</p>
            <div className="flex flex-col gap-2">
              {PURPOSE_OPTIONS.map((p) => {
                const on = purposes.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggle(purposes, setPurposes, p)}
                    aria-pressed={on}
                    className="w-full min-h-[60px] px-4 py-3 rounded-2xl border-2 text-left flex items-center gap-3"
                    style={on ? { borderColor: GREEN, background: GREEN_LIGHT } : { borderColor: '#EEF0F2', background: '#fff' }}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[17px] font-bold" style={{ color: on ? GREEN_DARK : '#1F2937' }}>
                        {p}
                      </span>
                      {PURPOSE_INFO[p] && <span className="block text-[13px] text-gray-500 mt-0.5 leading-snug">{PURPOSE_INFO[p]}</span>}
                    </span>
                    <span
                      aria-hidden="true"
                      className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[13px] font-bold"
                      style={on ? { background: GREEN, color: '#fff' } : { border: '2px solid #D1D5DB', color: 'transparent' }}
                    >
                      ✓
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowBodyParts((v) => !v)}
              aria-expanded={showBodyParts}
              className="mt-5 min-h-[48px] text-[15px] font-semibold"
              style={{ color: GREEN_DARK }}
            >
              전문 부위도 고르기 (선택) {showBodyParts ? '▴' : '▾'}
            </button>
            {showBodyParts && (
              <div className="flex flex-wrap gap-2 mt-2">
                {BODY_PART_OPTIONS.map((b) => {
                  const on = bodyParts.includes(b)
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggle(bodyParts, setBodyParts, b)}
                      aria-pressed={on}
                      className="min-h-[44px] px-4 rounded-full text-[15px] font-semibold border"
                      style={on ? { background: GREEN, borderColor: GREEN, color: '#fff' } : { background: '#fff', borderColor: '#E5E7EB', color: '#4B5563' }}
                    >
                      {b}
                    </button>
                  )
                })}
              </div>
            )}

            {purposes.length > 0 && (
              <div className="mt-6 rounded-2xl bg-gray-50 p-4">
                <p className="text-[14px] font-bold text-gray-700">
                  선택한 분야 <span style={{ color: GREEN_DARK }}>{purposes.length}</span>/{PURPOSE_OPTIONS.length}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {purposes.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggle(purposes, setPurposes, p)}
                      className="min-h-[36px] pl-3 pr-2 rounded-full bg-gray-800 text-white text-[13px] font-semibold flex items-center gap-1"
                      aria-label={`${p} 빼기`}
                    >
                      {p} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. 활동 형태 */}
        {step === 2 && (
          <div className="mt-5">
            <p className="text-[15px] text-gray-500 mb-4">해당하는 것을 모두 골라 주세요.</p>
            <div className="flex flex-col gap-2">
              {WORK_TYPES.map((w) => {
                const on = workTypes.includes(w.value)
                return (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => toggle(workTypes, setWorkTypes, w.value)}
                    aria-pressed={on}
                    className="w-full min-h-[64px] px-4 py-3 rounded-2xl border-2 text-left flex items-center gap-3"
                    style={on ? { borderColor: GREEN, background: GREEN_LIGHT } : { borderColor: '#EEF0F2', background: '#fff' }}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[17px] font-bold" style={{ color: on ? GREEN_DARK : '#1F2937' }}>
                        {w.label}
                      </span>
                      <span className="block text-[13px] text-gray-500 mt-0.5">{w.desc}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[13px] font-bold"
                      style={on ? { background: GREEN, color: '#fff' } : { border: '2px solid #D1D5DB', color: 'transparent' }}
                    >
                      ✓
                    </span>
                  </button>
                )
              })}
            </div>
            {workTypes.length > 0 && !hasPlaceWork(workTypes) && (
              <p className="text-[14px] text-red-500 mt-3">운영·소속·방문 중 하나는 꼭 골라 주세요.</p>
            )}
            {hasCenter && (
              <div className="mt-5">
                <label htmlFor="studio" className="text-[15px] font-bold text-gray-800 block mb-2">
                  운동센터 이름
                </label>
                <input
                  id="studio"
                  type="text"
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  maxLength={40}
                  placeholder="예: 바른걸음 운동센터"
                  className="w-full min-h-[52px] px-4 border border-gray-200 rounded-xl text-[16px] focus:outline-none focus:border-[#0A8A7B]"
                />
              </div>
            )}
            <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-100">
              <p className="text-[14px] text-amber-800 leading-relaxed">
                ⚠️ 이 서비스는 <b>운동 지도</b>예요. 방문·운동센터 모두 도수·기기 치료 같은 의료행위는 할 수 없어요.
              </p>
            </div>
          </div>
        )}

        {/* 3. 활동 지역 + 이동 가능 거리 */}
        {step === 3 && (
          <div className="mt-5">
            <p className="text-[15px] text-gray-500 mb-4">
              {canVisit ? '방문 거리를 재는 기준 주소예요. 집·센터 주소 모두 괜찮아요.' : '운동센터 주소를 넣으면 가까운 보호자에게 거리순으로 보여요. (선택)'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value)
                  setAddressResult(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && searchAddress()}
                placeholder="예: 하남시 신장로 101"
                aria-label="활동 기준 주소"
                className="flex-1 min-w-0 min-h-[52px] px-4 border border-gray-200 rounded-xl text-[16px] focus:outline-none focus:border-[#0A8A7B]"
              />
              <button
                type="button"
                onClick={searchAddress}
                disabled={addressLoading || !address.trim()}
                className="min-h-[52px] px-5 rounded-xl text-[16px] font-bold text-white shrink-0 disabled:bg-gray-200 disabled:text-gray-400"
                style={{ background: addressLoading || !address.trim() ? undefined : GREEN }}
              >
                {addressLoading ? '찾는 중' : '찾기'}
              </button>
            </div>
            {addressResult && (
              <div className="mt-3 rounded-xl p-4 border" style={{ background: GREEN_LIGHT, borderColor: '#BFE3DC' }}>
                <p className="text-[14px] font-bold" style={{ color: GREEN_DARK }}>
                  📍 위치를 확인했어요
                </p>
                <p className="text-[15px] text-gray-700 mt-0.5">{addressResult.address}</p>
              </div>
            )}
            {addressError && <p className="text-[14px] text-red-500 mt-3">{addressError}</p>}
            <p className="text-[13px] text-gray-400 mt-3">주소는 공개되지 않고, 거리 계산에만 쓰여요.</p>

            {canVisit && (
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <p className="text-[16px] font-bold text-gray-800">이동 가능 거리</p>
                  <p className="text-[18px] font-extrabold" style={{ color: GREEN_DARK }}>
                    {radius}km 이내
                  </p>
                </div>
                <input
                  type="range"
                  min={0}
                  max={VISIT_RADIUS_OPTIONS.length - 1}
                  step={1}
                  value={radiusIndex}
                  onChange={(e) => setRadiusIndex(Number(e.target.value))}
                  aria-label="이동 가능 거리"
                  aria-valuetext={`${radius}km 이내`}
                  className="w-full mt-4 accent-[#0A8A7B] h-8"
                />
                <div className="flex justify-between text-[13px] text-gray-400 mt-1">
                  {VISIT_RADIUS_OPTIONS.map((km) => (
                    <span key={km}>{km}km</span>
                  ))}
                </div>
                <p className="text-[14px] text-gray-500 mt-3">이 거리 안에 사는 보호자에게 &lsquo;집으로 방문&rsquo; 전문가로 보여요.</p>
              </div>
            )}
          </div>
        )}

        {/* 4. 기본 정보 (비공개) */}
        {step === 4 && (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl p-4" style={{ background: GREEN_LIGHT }}>
              <p className="text-[15px] font-bold" style={{ color: GREEN_DARK }}>
                🛡️ 물리치료사 면허 소지자만 가입할 수 있어요
              </p>
              <p className="text-[14px] text-gray-600 mt-1 leading-relaxed">운영팀이 면허를 확인한 뒤 프로필을 공개해요. 면허번호·휴대폰은 공개되지 않아요.</p>
            </div>
            <Field label="이름 (실명)" hint="면허에 적힌 이름과 같아야 해요">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="홍길동" autoComplete="name" className={inputCls} />
            </Field>
            <Field label="물리치료사 면허번호">
              <input type="text" inputMode="numeric" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} maxLength={20} placeholder="예: 12345" className={inputCls} />
            </Field>
            <Field label="경력 (년)">
              <input type="number" inputMode="numeric" min={0} max={60} value={years} onChange={(e) => setYears(e.target.value)} placeholder="예: 8" className={inputCls} />
            </Field>
            <Field label="휴대폰 번호" hint="승인 안내 문자에만 써요">
              <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" autoComplete="tel" className={inputCls} />
              {phone.trim() !== '' && !/^01\d{8,9}$/.test(phoneDigits) && <p className="text-[13px] text-red-500 mt-1.5">휴대폰 번호를 확인해 주세요.</p>}
            </Field>
          </div>
        )}

        {/* 5. 동의 */}
        {step === 5 && (
          <div className="mt-5">
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  const v = !allAgreed
                  setAgreeCollect(v)
                  setAgreePublic(v)
                  setAgreeRules(v)
                }}
                className="w-full flex items-center gap-3 p-4 text-left min-h-[60px]"
                style={{ background: allAgreed ? GREEN_LIGHT : '#F9FAFB' }}
              >
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-sm shrink-0" style={{ background: allAgreed ? GREEN : '#D1D5DB' }}>
                  ✓
                </span>
                <span className="text-[17px] font-bold text-gray-900">모두 동의해요</span>
              </button>
              <div className="p-4 space-y-4 border-t border-gray-100">
                <Consent
                  checked={agreeCollect}
                  onChange={setAgreeCollect}
                  title="[필수] 전문가 개인정보 수집·이용"
                  lines={['항목: 이름·휴대폰·면허번호·경력, 활동 형태·지역·좌표, 소개·사진·자격·가능한 시간', '목적: 면허 확인, 프로필 공개, 승인 안내 문자', '보관: 전문가 탈퇴 시까지']}
                />
                <Consent
                  checked={agreePublic}
                  onChange={setAgreePublic}
                  title="[필수] 프로필 공개"
                  lines={['공개: 이름·경력·활동 형태·센터·분야·소개·자격·사진·시간·오픈채팅 주소', '비공개: 휴대폰·면허번호·이메일·주소']}
                />
                <Consent checked={agreeRules} onChange={setAgreeRules} title="[필수] 활동 원칙 확인" lines={PRACTICE_RULES} />
              </div>
            </div>
            <p className="text-[14px] text-gray-500 mt-3 leading-relaxed">
              동의하지 않으면 전문가로 가입할 수 없어요.{' '}
              <Link href="/privacy" target="_blank" className="underline">
                개인정보처리방침
              </Link>
            </p>
            {submitError && <p className="text-[15px] text-red-500 mt-3">{submitError}</p>}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20">
        <div className="max-w-md mx-auto px-5 py-4 bg-white border-t border-gray-100">
          <button
            type="button"
            onClick={() => (step < TOTAL ? setStep(step + 1) : submit())}
            disabled={!canNext[step] || submitting}
            className="w-full min-h-[56px] rounded-2xl text-[17px] font-bold text-white transition-all active:scale-[0.99]"
            style={{ background: canNext[step] && !submitting ? GREEN : '#B8D9D4' }}
          >
            {step < TOTAL ? '다음' : submitting ? '신청하는 중...' : '전문가 가입 신청하기'}
          </button>
        </div>
      </div>
    </main>
  )
}

const inputCls = 'w-full min-h-[52px] px-4 border border-gray-200 rounded-xl text-[16px] focus:outline-none focus:border-[#0A8A7B]'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[15px] font-bold text-gray-800 mb-2">
        {label} {hint && <span className="text-[13px] font-normal text-gray-400">· {hint}</span>}
      </p>
      {children}
    </div>
  )
}

function Consent({ checked, onChange, title, lines }: { checked: boolean; onChange: (v: boolean) => void; title: string; lines: string[] }) {
  return (
    <label className="flex gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-6 h-6 mt-0.5 shrink-0 accent-[#0A8A7B]" />
      <span className="min-w-0">
        <span className="block text-[16px] font-bold text-gray-900">{title}</span>
        {lines.map((l) => (
          <span key={l} className="block text-[14px] text-gray-500 leading-relaxed mt-0.5">
            · {l}
          </span>
        ))}
      </span>
    </label>
  )
}

/** 가입 신청 뒤 — 프로필 작성 안내 (숨고 '프로필 작성 Tip' 참고) */
function ProfileTips({ name }: { name: string }) {
  const tips = [
    { n: '01', title: '얼굴이 보이는 사진 + 대표 사진 3장', body: '보호자는 사진으로 첫인상을 정해요. 밝은 얼굴 사진, 운동 지도 모습·센터·도구 사진을 올려 주세요.' },
    { n: '02', title: '구체적인 서비스 설명', body: '어떤 분을 주로 지도했는지, 첫 만남은 어떻게 진행하는지, 한 번에 몇 분 정도인지 적어 주세요.' },
    { n: '03', title: '질문답변과 오픈채팅', body: '비용 안내·준비물 같은 자주 묻는 질문에 미리 답해 두면 보호자가 편하게 연락해요.' },
  ]
  return (
    <main className="max-w-md mx-auto min-h-screen bg-white pb-28">
      <section className="px-6 pt-14 pb-8" style={{ background: 'linear-gradient(180deg, #E8F6F4 0%, #fff 100%)' }}>
        <p className="text-[28px] font-extrabold text-gray-900 leading-snug">
          반가워요,
          <br />
          <span style={{ color: GREEN_DARK }}>{name} 전문가님</span> 👋
        </p>
        <p className="text-[17px] text-gray-600 mt-3 leading-relaxed">
          가입 신청을 받았어요. 운영팀이 면허를 확인하는 동안 보호자가 보는 첫인상, 프로필을 완성해 주세요.
        </p>
      </section>

      <section className="px-6">
        <p className="text-[19px] font-extrabold text-gray-900">보호자가 연락하는 프로필은 달라요</p>
        <div className="mt-4 space-y-3">
          {tips.map((t) => (
            <div key={t.n} className="rounded-2xl border border-gray-100 p-5">
              <p className="text-[14px] font-extrabold" style={{ color: GREEN }}>
                {t.n}
              </p>
              <p className="text-[18px] font-bold text-gray-900 mt-1">{t.title}</p>
              <p className="text-[15px] text-gray-600 mt-1.5 leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl bg-gray-50 p-5">
          <p className="text-[16px] font-bold text-gray-900">다음 순서</p>
          <ol className="mt-2 space-y-1.5 text-[15px] text-gray-600 list-decimal list-inside leading-relaxed">
            <li>운영팀이 물리치료사 면허를 확인해요</li>
            <li>승인되면 입력한 휴대폰으로 안내 문자를 보내요</li>
            <li>승인 뒤 보호자 검색에 프로필이 보여요</li>
          </ol>
        </div>
      </section>

      <div className="fixed bottom-0 inset-x-0 z-20">
        <div className="max-w-md mx-auto px-5 py-4 bg-white border-t border-gray-100">
          <Link
            href="/mypage?edit=1"
            className="w-full min-h-[56px] rounded-2xl text-[17px] font-bold text-white flex items-center justify-center"
            style={{ background: GREEN }}
          >
            프로필 작성하기
          </Link>
        </div>
      </div>
    </main>
  )
}
