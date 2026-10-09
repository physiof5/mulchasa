'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  WORK_TYPES, PURPOSE_OPTIONS, BODY_PART_OPTIONS, PRACTICE_RULES,
  hasCenterWork, hasVisitWork, hasPlaceWork, deriveServiceMode,
} from '@/lib/practitioner'

const VISIT_RADIUS_OPTIONS = [3, 5, 10, 20, 30]

const DAYS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
]

const SLOTS = [
  { value: 'morning', label: '오전', desc: '09-12시' },
  { value: 'afternoon', label: '오후', desc: '12-18시' },
  { value: 'evening', label: '저녁', desc: '18-21시' },
]

const CERTIFICATION_OPTIONS = [
  '물리치료사 면허',
  '생활스포츠지도사 1급',
  '생활스포츠지도사 2급',
  '건강운동관리사',
  '필라테스 지도자',
  '요가 지도자',
  'PNF',
  '보바스',
  'NSCA-CSCS',
  'NASM-CPT',
  'ACSM',
]

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)
  const [licenseNumber, setLicenseNumber] = useState('')
  const [yearsExperience, setYearsExperience] = useState<number>(1)
  // 활동 형태 (운동센터 운영·소속 / 프리랜서 방문 / 파트타임) — 여러 개 선택
  const [workTypes, setWorkTypes] = useState<string[]>([])
  const [visitRadius, setVisitRadius] = useState<number>(10)
  const [studioName, setStudioName] = useState('')
  const [address, setAddress] = useState('')
  const [addressResult, setAddressResult] = useState<{ latitude: number; longitude: number; address: string } | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [phone, setPhone] = useState('')
  const [kakaoLink, setKakaoLink] = useState('')
  const [intro, setIntro] = useState('')
  const [selectedBodyParts, setSelectedBodyParts] = useState<string[]>([])
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([])
  const [selectedCerts, setSelectedCerts] = useState<string[]>([])
  // "요일-시간대" 형태로 저장 (예: "1-morning")
  const [availability, setAvailability] = useState<string[]>([])
  // 동의 (3가지 모두 필수: 개인정보 수집·이용 / 프로필 공개 / 활동 원칙)
  const [agreeCollect, setAgreeCollect] = useState(false)
  const [agreePublic, setAgreePublic] = useState(false)
  const [agreeRules, setAgreeRules] = useState(false)
  const allAgreed = agreeCollect && agreePublic && agreeRules
  const toggleAll = () => {
    const next = !allAgreed
    setAgreeCollect(next)
    setAgreePublic(next)
    setAgreeRules(next)
  }

  const hasCenter = hasCenterWork(workTypes)
  const canVisit = hasVisitWork(workTypes)
  const toggleWorkType = (value: string) =>
    setWorkTypes(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]))

  const toggleBodyPart = (part: string) => {
    setSelectedBodyParts(prev =>
      prev.includes(part) ? prev.filter(p => p !== part) : [...prev, part]
    )
  }

  const togglePurpose = (purpose: string) => {
    setSelectedPurposes(prev =>
      prev.includes(purpose) ? prev.filter(p => p !== purpose) : [...prev, purpose]
    )
  }

  const toggleCert = (cert: string) => {
    setSelectedCerts(prev =>
      prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]
    )
  }

  const toggleSlot = (day: number, slot: string) => {
    const key = `${day}-${slot}`
    setAvailability(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleAddressSearch = async () => {
    if (!address.trim()) return
    setAddressLoading(true)
    setAddressError('')
    setAddressResult(null)
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`)
      const data = await res.json()
      if (res.ok) {
        setAddressResult(data)
      } else {
        setAddressError('주소를 찾을 수 없습니다. 더 자세히 입력해보세요.')
      }
    } catch {
      setAddressError('주소 검색 중 오류가 발생했습니다.')
    } finally {
      setAddressLoading(false)
    }
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const passwordValid = password.length >= 8
  const passwordMatch = password.length > 0 && password === passwordConfirm

  const canProceedStep1 =
    name.trim() && licenseNumber.trim() && phone.trim() &&
    emailValid && passwordValid && passwordMatch
  // 운영·소속·방문 중 하나는 필수, 운동센터를 골랐다면 센터 이름도 필수
  const canProceedStep2 =
    hasPlaceWork(workTypes) &&
    (!hasCenter || studioName.trim().length > 0)
  // 전문 부위는 선택 사항 (신경계 재활 전문가는 부위 대신 분야로 고를 수 있음)
  const canProceedStep3 = selectedPurposes.length > 0
  const canProceedStep4 = availability.length > 0
  const canSubmit = intro.trim().length >= 30 && kakaoLink.trim() && allAgreed

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      // 1) 로그인 계정 먼저 생성
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

      if (authError) {
        const msg = authError.message || ''
        if (msg.toLowerCase().includes('already')) {
          alert('이미 가입된 이메일입니다.\n다른 이메일을 사용하시거나, 마이페이지에서 로그인해주세요.')
        } else {
          alert('계정 생성에 실패했습니다: ' + msg)
        }
        setSubmitting(false)
        return
      }

      const userId = authData.user?.id ?? null
      // 세션이 없으면 이메일 확인이 켜져 있다는 뜻
      setNeedsEmailConfirm(!authData.session)

      // 2) 치료사 프로필 저장
      const { data: therapistData, error: therapistError } = await supabase
        .from('therapists')
        .insert({
          name,
          user_id: userId,
          email: email.trim(),
          license_number: licenseNumber,
          years_experience: yearsExperience,
          practitioner_type: 'physical_therapist',
          work_types: workTypes,
          service_mode: deriveServiceMode(workTypes),
          visit_radius_km: canVisit ? visitRadius : null,
          hospital_name: null,
          studio_name: hasCenter ? studioName.trim() || null : null,
          phone,
          kakao_link: kakaoLink,
          intro,
          verification_status: 'pending',
          latitude: addressResult?.latitude || null,
          longitude: addressResult?.longitude || null,
          certifications: selectedCerts,
          consented_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (therapistError) throw therapistError

      const allTags = [...selectedBodyParts, ...selectedPurposes]
      const { data: tagData } = await supabase
        .from('tags')
        .select('id, label')
        .in('label', allTags)

      if (tagData && tagData.length > 0) {
        const therapistTags = tagData.map(tag => ({
          therapist_id: therapistData.id,
          tag_id: tag.id,
        }))
        await supabase.from('therapist_tags').insert(therapistTags)
      }

      // 가용 시간표 저장
      if (availability.length > 0) {
        const rows = availability.map(key => {
          const [day, slot] = key.split('-')
          return {
            therapist_id: therapistData.id,
            day_of_week: Number(day),
            slot,
          }
        })
        await supabase.from('therapist_availability').insert(rows)
      }

      setStep(6)
    } catch (error) {
      console.error('Error:', error)
      alert('가입 신청 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white pb-24">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3 z-10">
        {step > 1 && step < 6 && (
          <button onClick={() => setStep(step - 1)} className="text-gray-600 text-xl">←</button>
        )}
        <div className="flex-1">
          <p className="text-xs text-gray-400">전문가 가입 {step < 6 ? `${step}/5` : ''}</p>
          <h1 className="text-base font-bold text-gray-900">
            {step === 1 && '기본 정보'}
            {step === 2 && '활동 정보'}
            {step === 3 && '전문 분야'}
            {step === 4 && '가능한 시간'}
            {step === 5 && '자기소개'}
            {step === 6 && '가입 신청 완료'}
          </h1>
        </div>
      </div>

      {step < 6 && (
        <div className="px-5 pt-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-[#0A8A7B]' : 'bg-gray-100'}`} />
            ))}
          </div>
        </div>
      )}

      <div className="px-5 py-6">
        {step === 1 && (
          <div className="space-y-5">
            <div className="rounded-2xl p-4 bg-[#E8F6F4]">
              <p className="text-[15px] font-bold text-[#067A6C]">🛡️ 물리치료사 면허 소지자만 가입해요</p>
              <p className="text-[13px] text-gray-600 mt-1 leading-relaxed">
                운동센터를 운영하거나 소속된 분, 프리랜서로 방문하실 분, 육아·본업과 함께 짧게 활동하실 분 모두 환영해요.
              </p>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-2">이름 *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="실명 입력" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]" />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-2">물리치료사 면허번호 *</label>
              <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="예: 12345" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]" />
              <p className="text-xs text-gray-400 mt-2">🛡️ 면허번호는 공개되지 않고, 면허 확인에만 쓰여요</p>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-2">경력 (년) *</label>
              <input type="number" value={yearsExperience} onChange={(e) => setYearsExperience(Number(e.target.value))} min="0" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]" />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-2">연락처 *</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]" />
              <p className="text-xs text-gray-400 mt-2">* 보호자에게 공개되지 않으며, 승인 안내에만 쓰여요</p>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm font-bold text-gray-900 mb-1 pt-4">로그인 정보</p>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                프로필 수정과 방문 요청 확인에 사용할 계정이에요
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">이메일 *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    autoComplete="email"
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]"
                  />
                  {email.length > 0 && !emailValid && (
                    <p className="text-xs text-red-400 mt-1.5">이메일 형식을 확인해주세요</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">비밀번호 *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8자 이상"
                    autoComplete="new-password"
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]"
                  />
                  {password.length > 0 && !passwordValid && (
                    <p className="text-xs text-red-400 mt-1.5">8자 이상 입력해주세요</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">비밀번호 확인 *</label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="다시 한 번 입력"
                    autoComplete="new-password"
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]"
                  />
                  {passwordConfirm.length > 0 && !passwordMatch && (
                    <p className="text-xs text-red-400 mt-1.5">비밀번호가 일치하지 않아요</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1">어떤 형태로 활동하세요? *</label>
              <p className="text-xs text-gray-400 mb-3">해당하는 것을 모두 골라 주세요</p>
              <div className="space-y-2">
                {WORK_TYPES.map(w => {
                  const on = workTypes.includes(w.value)
                  return (
                    <button key={w.value} type="button" onClick={() => toggleWorkType(w.value)} aria-pressed={on}
                      className={'w-full min-h-[64px] p-4 rounded-xl text-left flex items-center gap-3 border-2 transition-all ' +
                        (on ? 'border-[#0A8A7B] bg-[#E8F6F4]' : 'border-gray-100 bg-gray-50')}>
                      <span className="flex-1 min-w-0">
                        <span className={'block font-bold ' + (on ? 'text-[#067A6C]' : 'text-gray-800')}>{w.label}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">{w.desc}</span>
                      </span>
                      <span className={'w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ' +
                        (on ? 'bg-[#0A8A7B] text-white' : 'bg-white border border-gray-200 text-transparent')}>✓</span>
                    </button>
                  )
                })}
              </div>
              {workTypes.length > 0 && !hasPlaceWork(workTypes) && (
                <p className="text-xs text-red-400 mt-2">운영·소속·방문 중 하나는 꼭 골라 주세요</p>
              )}
            </div>

            {hasCenter && (
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">운동센터 이름 *</label>
                <input type="text" value={studioName} onChange={(e) => setStudioName(e.target.value)} maxLength={40} placeholder="예: 바른걸음 운동센터" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]" />
              </div>
            )}

            {canVisit && (
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-3">방문 가능 범위 *</label>
                <div className="flex flex-wrap gap-2">
                  {VISIT_RADIUS_OPTIONS.map(km => (
                    <button key={km} type="button" onClick={() => setVisitRadius(km)}
                      className={'px-4 py-2.5 rounded-full text-sm font-semibold transition-all ' + (visitRadius === km ? 'bg-[#0A8A7B] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100')}>
                      {km}km 이내
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">📍 아래 주소에서 이 거리 안에 사는 보호자에게 보여요</p>
              </div>
            )}

            {workTypes.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-800 leading-relaxed">
                  ⚠️ 이 서비스는 <b>운동 지도</b>예요. 방문·운동센터 모두 도수·기기 치료 같은 의료행위는 할 수 없어요.
                </p>
              </div>
            )}

            {hasPlaceWork(workTypes) && (
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-2">
                {canVisit ? '활동 기준 주소' : '운동센터 주소'}
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setAddressResult(null) }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                  placeholder="예: 서울시 강남구 테헤란로 123"
                  className="flex-1 p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]"
                />
                <button
                  type="button"
                  onClick={handleAddressSearch}
                  disabled={addressLoading || !address.trim()}
                  className="px-4 py-3 bg-[#0A8A7B] text-white rounded-xl text-sm font-bold shrink-0 disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {addressLoading ? '검색 중' : '검색'}
                </button>
              </div>

              {addressResult && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-green-700 mb-1">✅ 위치 확인됨</p>
                  <p className="text-xs text-green-600">{addressResult.address}</p>
                </div>
              )}

              {addressError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs text-red-600">{addressError}</p>
                </div>
              )}

              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                {canVisit
                  ? '📍 방문 범위를 재는 기준점이에요 (집·사무실 주소도 괜찮아요). 넣지 않으면 ‘집으로 방문’ 검색에 나오지 않아요'
                  : '📍 넣으면 가까운 보호자에게 거리순으로 보여요 (선택)'}
              </p>
            </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-3">전문 부위 <span className="text-xs text-gray-400 font-normal">(선택 · 복수 선택)</span></label>
              <p className="text-xs text-gray-400 -mt-1 mb-3">신경계 재활처럼 특정 부위가 아니라면 건너뛰어도 괜찮아요</p>
              <div className="flex flex-wrap gap-2">
                {BODY_PART_OPTIONS.map(part => (
                  <button key={part} onClick={() => toggleBodyPart(part)}
                    className={'px-4 py-2.5 rounded-full text-sm font-semibold transition-all ' + (selectedBodyParts.includes(part) ? 'bg-[#0A8A7B] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100')}>
                    {part}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-3">운동 지도 분야 * <span className="text-xs text-gray-400 font-normal">(복수 선택)</span></label>
              <div className="flex flex-wrap gap-2">
                {PURPOSE_OPTIONS.map(purpose => (
                  <button key={purpose} type="button" onClick={() => togglePurpose(purpose)}
                    className={'px-4 py-2.5 rounded-full text-sm font-semibold transition-all ' +
                      (selectedPurposes.includes(purpose) ? 'bg-[#0A8A7B] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100')}>
                    {purpose}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-3">자격증 <span className="text-xs text-gray-400 font-normal">(선택 · 복수 선택)</span></label>
              <div className="flex flex-wrap gap-2">
                {CERTIFICATION_OPTIONS.map(cert => (
                  <button key={cert} onClick={() => toggleCert(cert)}
                    className={'px-3 py-2 rounded-full text-xs font-semibold transition-all ' + (selectedCerts.includes(cert) ? 'bg-[#0A8A7B] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100')}>
                    {cert}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">🏅 보유한 자격증을 선택하면 프로필에 표시됩니다. 가입 후 마이페이지에서도 수정할 수 있어요.</p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="text-sm font-bold text-gray-700 mb-1">언제 매칭이 가능하세요? *</p>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              가능한 요일과 시간대를 모두 선택해주세요.<br />
              보호자에게 이 일정이 보이고, 가입 후에도 언제든 바꿀 수 있어요.
            </p>

            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-4 bg-gray-50">
                <div className="p-2.5 text-xs font-bold text-gray-400">요일</div>
                {SLOTS.map(s => (
                  <div key={s.value} className="p-2.5 text-center">
                    <div className="text-xs font-bold text-gray-600">{s.label}</div>
                    <div className="text-[10px] text-gray-400">{s.desc}</div>
                  </div>
                ))}
              </div>
              {DAYS.map(day => (
                <div key={day.value} className="grid grid-cols-4 border-t border-gray-100">
                  <div className="p-2.5 flex items-center">
                    <span className={'text-sm font-bold ' + (day.value === 0 ? 'text-red-400' : day.value === 6 ? 'text-blue-400' : 'text-gray-700')}>
                      {day.label}
                    </span>
                  </div>
                  {SLOTS.map(s => {
                    const active = availability.includes(`${day.value}-${s.value}`)
                    return (
                      <button
                        key={s.value}
                        onClick={() => toggleSlot(day.value, s.value)}
                        className="p-2.5 flex items-center justify-center border-l border-gray-100"
                      >
                        <span className={'w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all ' +
                          (active ? 'bg-[#0A8A7B] text-white font-bold' : 'bg-gray-50 text-gray-300')}>
                          {active ? '✓' : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setAvailability(DAYS.filter(d => d.value >= 1 && d.value <= 5).map(d => `${d.value}-morning`))}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-100"
              >
                평일 오전 전체
              </button>
              <button
                onClick={() => setAvailability(DAYS.filter(d => d.value >= 1 && d.value <= 5).map(d => `${d.value}-afternoon`))}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-100"
              >
                평일 오후 전체
              </button>
              <button
                onClick={() => setAvailability([])}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-100"
              >
                초기화
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-3 text-center">
              {availability.length > 0 ? `${availability.length}개 시간대 선택됨` : '최소 1개 이상 선택해주세요'}
            </p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-2">카카오톡 오픈채팅 링크 *</label>
              <input type="text" value={kakaoLink} onChange={(e) => setKakaoLink(e.target.value)} placeholder="https://open.kakao.com/o/..." className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]" />
              <p className="text-xs text-gray-400 mt-2">보호자가 상담을 원하면 이 링크로 연결돼요 (전화번호는 공개되지 않아요)</p>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-2">자기소개 * <span className="text-xs text-gray-400 font-normal">(최소 30자)</span></label>
              <textarea value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="보호자에게 보여질 소개예요. 경력, 자신 있는 운동 지도, 진행 방식을 적어 주세요." rows={6} className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B] resize-none" />
              <p className="text-xs text-gray-400 mt-2 text-right">{intro.length} / 최소 30자</p>
            </div>

            {/* 개인정보 동의 */}
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={toggleAll}
                className="w-full flex items-center gap-3 p-4 text-left"
                style={{ background: allAgreed ? '#E8F6F4' : '#F9FAFB' }}
              >
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white text-sm shrink-0"
                  style={{ background: allAgreed ? '#0A8A7B' : '#D1D5DB' }}
                >
                  ✓
                </span>
                <span className="text-[16px] font-bold text-gray-900">아래 내용에 모두 동의해요</span>
              </button>
              <div className="p-4 space-y-4 border-t border-gray-100">
                <ConsentRow
                  checked={agreeCollect}
                  onChange={setAgreeCollect}
                  title="[필수] 개인정보 수집·이용"
                  lines={[
                    '항목: 이름·이메일·휴대폰·면허번호',
                    '경력·활동 정보·소개·사진·시간',
                    '목적: 면허 확인, 프로필, 안내 문자',
                    '보관: 탈퇴 시까지',
                  ]}
                />
                <ConsentRow
                  checked={agreePublic}
                  onChange={setAgreePublic}
                  title="[필수] 프로필 공개"
                  lines={[
                    '공개: 이름·경력·활동 형태·센터·지역',
                    '전문 분야·소개·자격증·사진·시간',
                    '공개: 카카오 오픈채팅 링크',
                    '비공개: 이메일·휴대폰·면허번호',
                  ]}
                />
                <ConsentRow
                  checked={agreeRules}
                  onChange={setAgreeRules}
                  title="[필수] 활동 원칙 확인"
                  lines={PRACTICE_RULES}
                />
                <p className="text-[13px] text-gray-500 leading-relaxed">
                  동의하지 않으실 수 있지만, 이 경우 가입할 수 없어요.{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
                    개인정보처리방침 보기
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-3">가입 신청 완료!</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-8">
              {name}님의 신청이 접수되었어요.<br />
              면허 확인이 끝나면<br />
              연락처({phone})로 안내드릴게요.
            </p>

            {needsEmailConfirm && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 text-left">
                <p className="text-sm font-bold text-amber-800 mb-1">📧 이메일 확인이 필요해요</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {email.trim()} 으로 확인 메일을 보냈어요.
                  메일의 링크를 눌러야 로그인할 수 있습니다.
                  메일이 안 보이면 스팸함도 확인해주세요.
                </p>
              </div>
            )}
            <div className="bg-[#E8F6F4] rounded-2xl p-5 mb-8 text-left">
              <p className="text-sm font-bold text-[#067A6C] mb-2">📋 다음 단계</p>
              <ol className="text-sm text-gray-700 space-y-1.5 list-decimal list-inside">
                <li>운영팀이 면허번호를 확인하고 검토합니다</li>
                <li>승인 완료 시 등록하신 연락처로 안내 문자가 발송됩니다</li>
                <li>승인 후 검색 결과에 프로필이 노출됩니다</li>
              </ol>
            </div>
            <button onClick={() => router.push('/')} className="px-8 py-3 bg-[#0A8A7B] text-white rounded-xl font-semibold">홈으로</button>
          </div>
        )}
      </div>

      {step < 6 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-5 py-4 bg-white border-t border-gray-100">
          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2) ||
                (step === 3 && !canProceedStep3) ||
                (step === 4 && !canProceedStep4)
              }
              className={'w-full py-4 rounded-2xl text-base font-bold transition-all ' +
                (((step === 1 && canProceedStep1) ||
                  (step === 2 && canProceedStep2) ||
                  (step === 3 && canProceedStep3) ||
                  (step === 4 && canProceedStep4))
                  ? 'bg-[#0A8A7B] text-white active:scale-[0.98]'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed')}
            >
              다음
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={'w-full py-4 rounded-2xl text-base font-bold transition-all ' + (canSubmit && !submitting ? 'bg-[#0A8A7B] text-white active:scale-[0.98]' : 'bg-gray-100 text-gray-300 cursor-not-allowed')}
            >
              {submitting ? '신청 중...' : '가입 신청하기'}
            </button>
          )}
        </div>
      )}
    </main>
  )
}

function ConsentRow({
  checked,
  onChange,
  title,
  lines,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  lines: string[]
}) {
  return (
    <label className="flex gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-6 h-6 mt-0.5 shrink-0 accent-[#0A8A7B]"
      />
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-gray-900 mb-1">{title}</span>
        {lines.map((line) => (
          <span key={line} className="block text-[13px] text-gray-500 leading-relaxed">
            · {line}
          </span>
        ))}
      </span>
    </label>
  )
}
