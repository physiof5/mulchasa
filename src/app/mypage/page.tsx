'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  WORK_TYPES, PURPOSE_OPTIONS, BODY_PART_OPTIONS,
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

interface Therapist {
  id: string
  name: string
  license_number: string
  years_experience: number
  practitioner_type: string
  hospital_name: string | null
  studio_name: string | null
  phone: string
  kakao_link: string
  intro: string
  verification_status: string
  latitude: number | null
  longitude: number | null
  profile_image_url: string | null
  certifications: string[] | null
  service_mode: string | null
  work_types: string[] | null
  visit_radius_km: number | null
  user_id: string | null
  email: string | null
}

export default function MyPage() {
  const router = useRouter()
  const [step, setStep] = useState<'login' | 'edit' | 'done'>('login')
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [therapist, setTherapist] = useState<Therapist | null>(null)
  const [saving, setSaving] = useState(false)

  const [kakaoLink, setKakaoLink] = useState('')
  const [intro, setIntro] = useState('')
  const [studioName, setStudioName] = useState('')
  const [address, setAddress] = useState('')
  const [addressResult, setAddressResult] = useState<{ latitude: number; longitude: number; address: string } | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [selectedBodyParts, setSelectedBodyParts] = useState<string[]>([])
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([])
  const [selectedCerts, setSelectedCerts] = useState<string[]>([])
  const [profileImage, setProfileImage] = useState<File | null>(null)
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  // 활동 형태 · 방문 범위 · 일정
  const [workTypes, setWorkTypes] = useState<string[]>([])
  const [visitRadius, setVisitRadius] = useState<number>(10)
  const [availability, setAvailability] = useState<string[]>([])

  const hasCenter = hasCenterWork(workTypes)
  const canVisit = hasVisitWork(workTypes)
  const canSave =
    intro.trim().length >= 30 &&
    hasPlaceWork(workTypes) &&
    (!hasCenter || studioName.trim().length > 0)
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProfileImage(file)
    const reader = new FileReader()
    reader.onloadend = () => setProfileImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  // 로그인한 계정의 치료사 프로필을 불러옴
  const loadTherapist = useCallback(async (userId: string) => {
    // 휴대폰·면허번호·이메일은 공개 조회가 막혀 있어서, 본인 것만 전용 함수로 따로 가져옴
    const { data: pub } = await supabase
      .from('therapists')
      .select('id, name, years_experience, practitioner_type, hospital_name, studio_name, kakao_link, intro, verification_status, latitude, longitude, profile_image_url, certifications, service_mode, visit_radius_km, work_types, user_id')
      .eq('user_id', userId)
      .single()

    if (!pub) return false

    const { data: priv } = await supabase.rpc('get_my_therapist_private')
    const mine = Array.isArray(priv) ? priv[0] : priv
    const data = { ...pub, ...(mine ?? {}) }

    setTherapist(data)
    setKakaoLink(data.kakao_link || '')
    setIntro(data.intro || '')
    setStudioName(data.studio_name || '')
    setSelectedCerts(data.certifications || [])
    // 예전 가입자는 활동 형태가 비어 있을 수 있어, 방문 여부만 옮겨 담고 나머지는 직접 고르게 함
    const savedTypes: string[] =
      data.work_types && data.work_types.length > 0
        ? data.work_types
        : data.service_mode === 'visit' || data.service_mode === 'both' ? ['freelance_visit'] : []
    setWorkTypes(savedTypes)
    if (data.visit_radius_km) setVisitRadius(data.visit_radius_km)
    if (data.profile_image_url) setProfileImagePreview(data.profile_image_url)

    const { data: ttData } = await supabase
      .from('therapist_tags')
      .select('tag_id')
      .eq('therapist_id', data.id)

    if (ttData && ttData.length > 0) {
      const tagIds = ttData.map(t => t.tag_id)
      const { data: tagData } = await supabase
        .from('tags')
        .select('category, label')
        .in('id', tagIds)

      if (tagData) {
        setSelectedBodyParts(tagData.filter(t => t.category === 'body_part').map(t => t.label))
        setSelectedPurposes(tagData.filter(t => t.category === 'purpose').map(t => t.label))
      }
    }

    const { data: avData } = await supabase
      .from('therapist_availability')
      .select('day_of_week, slot')
      .eq('therapist_id', data.id)

    if (avData && avData.length > 0) {
      setAvailability(avData.map(a => `${a.day_of_week}-${a.slot}`))
    }

    return true
  }, [])

  // 진입 시 기존 세션 확인 (로그인 상태면 바로 편집 화면)
  useEffect(() => {
    let active = true
    async function restore() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (session?.user) {
        const ok = await loadTherapist(session.user.id)
        if (!active) return
        if (ok) setStep('edit')
        else setLoginError('이 계정에 연결된 전문가 프로필이 없습니다. 가입 신청을 먼저 진행해주세요.')
      }
      setChecking(false)
    }
    restore()
    return () => { active = false }
  }, [loadTherapist])

  const handleLogin = async () => {
    if (!email.trim() || !password) return
    setLoggingIn(true)
    setLoginError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('email not confirmed')) {
        setLoginError('이메일 확인이 아직 안 됐어요. 받은 메일의 링크를 눌러주세요.')
      } else if (msg.includes('invalid login')) {
        setLoginError('이메일 또는 비밀번호가 올바르지 않습니다.')
      } else {
        setLoginError('로그인에 실패했습니다: ' + error.message)
      }
      setLoggingIn(false)
      return
    }

    const userId = data.user?.id
    if (!userId) {
      setLoginError('로그인 정보를 확인할 수 없습니다.')
      setLoggingIn(false)
      return
    }

    const ok = await loadTherapist(userId)
    if (!ok) {
      setLoginError('이 계정에 연결된 전문가 프로필이 없습니다. 가입 신청을 먼저 진행해주세요.')
      await supabase.auth.signOut()
      setLoggingIn(false)
      return
    }

    setLoggingIn(false)
    setStep('edit')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setTherapist(null)
    setEmail('')
    setPassword('')
    setStep('login')
  }

  const handleAddressSearch = async () => {
    if (!address.trim()) return
    setAddressLoading(true)
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`)
      const data = await res.json()
      if (res.ok) setAddressResult(data)
    } catch {
      console.error('주소 검색 오류')
    } finally {
      setAddressLoading(false)
    }
  }

  const uploadProfileImage = async (therapistId: string): Promise<string | null> => {
    if (!profileImage) return null
    setUploadingImage(true)
    const fileExt = profileImage.name.split('.').pop()
    const fileName = `${therapistId}.${fileExt}`
    const { error } = await supabase.storage
      .from('profiles')
      .upload(fileName, profileImage, { upsert: true })

    if (error) {
      console.error('이미지 업로드 실패:', error)
      setUploadingImage(false)
      return null
    }

    const { data } = supabase.storage.from('profiles').getPublicUrl(fileName)
    setUploadingImage(false)
    return data.publicUrl
  }

  const handleSave = async () => {
    if (!therapist) return
    setSaving(true)

    let profileImageUrl = therapist.profile_image_url
    if (profileImage) {
      const uploadedUrl = await uploadProfileImage(therapist.id)
      if (uploadedUrl) profileImageUrl = uploadedUrl
    }

    await supabase
      .from('therapists')
      .update({
        kakao_link: kakaoLink,
        intro,
        studio_name: hasCenter ? studioName.trim() || null : null,
        latitude: addressResult?.latitude ?? therapist.latitude,
        longitude: addressResult?.longitude ?? therapist.longitude,
        profile_image_url: profileImageUrl,
        certifications: selectedCerts,
        work_types: workTypes,
        service_mode: deriveServiceMode(workTypes),
        visit_radius_km: canVisit ? visitRadius : null,
      })
      .eq('id', therapist.id)

    await supabase.from('therapist_tags').delete().eq('therapist_id', therapist.id)

    const allTags = [...selectedBodyParts, ...selectedPurposes]
    const { data: tagData } = await supabase.from('tags').select('id, label').in('label', allTags)
    if (tagData && tagData.length > 0) {
      await supabase.from('therapist_tags').insert(
        tagData.map(tag => ({ therapist_id: therapist.id, tag_id: tag.id }))
      )
    }

    // 가용 시간표 저장 (전체 교체)
    await supabase.from('therapist_availability').delete().eq('therapist_id', therapist.id)
    if (availability.length > 0) {
      await supabase.from('therapist_availability').insert(
        availability.map(key => {
          const [day, slot] = key.split('-')
          return { therapist_id: therapist.id, day_of_week: Number(day), slot }
        })
      )
    }

    setSaving(false)
    setStep('done')
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white pb-24">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3 z-10">
        <button onClick={() => router.back()} className="text-gray-600 text-xl">←</button>
        <h1 className="text-base font-bold text-gray-900 flex-1">
          {step === 'login' && '전문가 로그인'}
          {step === 'edit' && '프로필 수정'}
          {step === 'done' && '수정 완료'}
        </h1>
        {step === 'edit' && (
          <button onClick={handleLogout} className="text-xs text-gray-400">로그아웃</button>
        )}
      </div>

      <div className="px-5 py-6">
        {checking && (
          <p className="text-center text-gray-400 py-20">확인 중...</p>
        )}

        {!checking && step === 'login' && (
          <div className="space-y-5">
            <div className="bg-[#E8F6F4] rounded-2xl p-4 mb-6">
              <p className="text-sm font-bold text-[#067A6C] mb-1">🔐 전문가 로그인</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                가입 시 등록한 이메일과 비밀번호로 로그인해주세요.
              </p>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-2">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-2">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="비밀번호"
                autoComplete="current-password"
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]"
              />
            </div>
            {loginError && <p className="text-sm text-red-500 leading-relaxed">{loginError}</p>}
            <button
              onClick={handleLogin}
              disabled={loggingIn || !email.trim() || !password}
              className={'w-full py-4 rounded-2xl font-bold text-base transition-all ' + (!loggingIn && email.trim() && password ? 'bg-[#0A8A7B] text-white active:scale-[0.98]' : 'bg-gray-100 text-gray-300 cursor-not-allowed')}
            >
              {loggingIn ? '로그인 중...' : '로그인'}
            </button>
            <button
              onClick={() => router.push('/register')}
              className="w-full py-3 text-gray-400 font-semibold text-sm"
            >
              아직 가입하지 않으셨나요? 전문가 가입 →
            </button>
          </div>
        )}

        {step === 'edit' && therapist && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-sm font-bold text-gray-900">{therapist.name}님</p>
              <p className="text-xs text-gray-400 mt-1">경력 {therapist.years_experience}년{therapist.license_number ? ` · 면허번호 ${therapist.license_number}` : ''}</p>
            </div>

            {/* 활동 형태 */}
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1">활동 형태 <span className="text-xs text-gray-400 font-normal">(복수 선택)</span></label>
              {!hasPlaceWork(workTypes) && (
                <p className="text-xs text-red-400">운영·소속·방문 중 하나는 꼭 골라 주세요</p>
              )}
              <div className="space-y-2 mt-3">
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
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-800 leading-relaxed">
                  ⚠️ 이 서비스는 <b>운동 지도</b>예요. 방문·운동센터 모두 도수·기기 치료 같은 의료행위는 할 수 없어요.
                </p>
              </div>
            </div>

            {hasCenter && (
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">운동센터 이름 *</label>
                <input type="text" value={studioName} onChange={(e) => setStudioName(e.target.value)} maxLength={40} placeholder="예: 바른걸음 운동센터" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]" />
              </div>
            )}

            {/* 방문 범위 */}
            {canVisit && (
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-3">방문 가능 범위</label>
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

            {/* 가능한 시간 */}
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1">가능한 시간</label>
              <p className="text-xs text-gray-400 mb-3">가능한 요일과 시간대를 선택해주세요</p>
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
                        <button key={s.value} onClick={() => toggleSlot(day.value, s.value)}
                          className="p-2.5 flex items-center justify-center border-l border-gray-100">
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
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setAvailability(DAYS.filter(d => d.value >= 1 && d.value <= 5).map(d => `${d.value}-morning`))}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-100">
                  평일 오전 전체
                </button>
                <button
                  onClick={() => setAvailability(DAYS.filter(d => d.value >= 1 && d.value <= 5).map(d => `${d.value}-afternoon`))}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-100">
                  평일 오후 전체
                </button>
                <button onClick={() => setAvailability([])}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-100">
                  초기화
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                {availability.length > 0 ? `${availability.length}개 시간대 선택됨` : '아직 선택된 시간이 없어요'}
              </p>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 block mb-3">프로필 사진</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
                  {profileImagePreview ? (
                    <img src={profileImagePreview} alt="프로필" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">👤</span>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm text-center font-semibold text-gray-600 cursor-pointer hover:border-[#0A8A7B] transition-all">
                    {profileImagePreview ? '사진 변경' : '사진 업로드'}
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                  <p className="text-xs text-gray-400 mt-1.5 text-center">JPG, PNG (최대 5MB)</p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 block mb-3">
                자격증 <span className="text-xs text-gray-400 font-normal">(복수 선택)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CERTIFICATION_OPTIONS.map(cert => (
                  <button key={cert} onClick={() => toggleCert(cert)}
                    className={'px-3 py-2 rounded-full text-xs font-semibold transition-all ' + (selectedCerts.includes(cert) ? 'bg-[#0A8A7B] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100')}>
                    {cert}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 block mb-2">카카오톡 오픈채팅 링크</label>
              <input type="text" value={kakaoLink} onChange={(e) => setKakaoLink(e.target.value)} placeholder="https://open.kakao.com/o/..." className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]" />
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 block mb-2">
                {canVisit ? '활동 기준 주소 변경' : '운동센터 주소 변경'}
              </label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()} placeholder="새 주소 입력" className="flex-1 p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]" />
                <button onClick={handleAddressSearch} disabled={addressLoading || !address.trim()} className="px-4 py-3 bg-[#0A8A7B] text-white rounded-xl text-sm font-bold shrink-0 disabled:bg-gray-200 disabled:text-gray-400">
                  {addressLoading ? '검색 중' : '검색'}
                </button>
              </div>
              {addressResult && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-green-700 mb-1">✅ 위치 확인됨</p>
                  <p className="text-xs text-green-600">{addressResult.address}</p>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 block mb-3">전문 부위 <span className="text-xs text-gray-400 font-normal">(선택 · 복수 선택)</span></label>
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
              <label className="text-sm font-bold text-gray-700 block mb-3">운동 지도 분야 <span className="text-xs text-gray-400 font-normal">(복수 선택)</span></label>
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
              <label className="text-sm font-bold text-gray-700 block mb-2">자기소개 <span className="text-xs text-gray-400 font-normal">(최소 30자)</span></label>
              <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={6} className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B] resize-none" />
              <p className="text-xs text-gray-400 mt-1 text-right">{intro.length}자</p>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-16">
            <div className="text-6xl mb-6">✅</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-3">수정 완료!</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-8">프로필이 성공적으로 업데이트되었습니다.</p>
            <button onClick={() => router.push('/')} className="px-8 py-3 bg-[#0A8A7B] text-white rounded-xl font-semibold">홈으로</button>
          </div>
        )}
      </div>

      {step === 'edit' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-5 py-4 bg-white border-t border-gray-100">
          <button onClick={handleSave} disabled={saving || uploadingImage || !canSave}
            className={'w-full py-4 rounded-2xl font-bold text-base transition-all ' + (!saving && !uploadingImage && canSave ? 'bg-[#0A8A7B] text-white active:scale-[0.98]' : 'bg-gray-100 text-gray-300 cursor-not-allowed')}>
            {uploadingImage ? '사진 업로드 중...' : saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      )}
    </main>
  )
}
