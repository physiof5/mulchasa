'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  WORK_TYPES, PURPOSE_OPTIONS, BODY_PART_OPTIONS, FAQ_QUESTIONS, FAQ_MAX,
  hasCenterWork, hasVisitWork, hasPlaceWork, deriveServiceMode,
  cleanFaq, findBannedPhrase, bannedMessage, toOpenChatUrl,
} from '@/lib/practitioner'
import MyProfileView from '@/components/MyProfileView'
import GuestMy from '@/components/GuestMy'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import type { User } from '@supabase/supabase-js'
import SquareCropper from '@/components/SquareCropper'
import { PHOTO_MAX, pickPhotos } from '@/lib/squareImage'

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

// 대표 사진 한 칸: 이미 올린 사진(url) 또는 새로 고른 사진(blob)
interface PhotoSlot {
  url: string | null
  blob: Blob | null
  preview: string
  /** 새로 고른 사진의 원본 (다시 자르기용) */
  source?: File
}

// 정사각형 맞추기 화면에 차례로 띄울 사진
interface CropJob {
  file: File
  target: 'photo' | 'profile'
  /** 이미 넣은 대표 사진을 다시 자를 때 그 자리 */
  replaceIndex?: number
}

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
  // 로그인 안 함 → login / 일반 회원 → guest / 전문가 → '내 프로필'(view) 먼저, 수정은 버튼으로(edit)
  const [step, setStep] = useState<'login' | 'guest' | 'view' | 'edit'>('login')
  const [checking, setChecking] = useState(true)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [therapist, setTherapist] = useState<Therapist | null>(null)
  const [saving, setSaving] = useState(false)

  const [kakaoLink, setKakaoLink] = useState('')
  const [intro, setIntro] = useState('')
  // 질문답변: { process: '...', price: '...' } 형태 (답한 것만 저장)
  const [faq, setFaq] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState('')
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
  // 대표 사진 3장 (정사각형)
  const [savedPhotos, setSavedPhotos] = useState<string[]>([])
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([])
  const [photoError, setPhotoError] = useState('')
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null)
  const [notice, setNotice] = useState('')
  const [cropQueue, setCropQueue] = useState<CropJob[]>([])
  const [cropTotal, setCropTotal] = useState(0)
  // 활동 형태 · 방문 범위 · 일정
  const [workTypes, setWorkTypes] = useState<string[]>([])
  const [visitRadius, setVisitRadius] = useState<number>(10)
  const [availability, setAvailability] = useState<string[]>([])

  const hasCenter = hasCenterWork(workTypes)
  const canVisit = hasVisitWork(workTypes)
  // 금지 표현(치료·완치·효과 보장 등) 검사 — 자기소개와 질문답변 모두
  const introBanned = findBannedPhrase(intro)
  const faqBanned = FAQ_QUESTIONS.some(f => findBannedPhrase(faq[f.key] ?? '') !== null)
  const kakaoValid = toOpenChatUrl(kakaoLink) !== null
  const canSave =
    intro.trim().length >= 30 &&
    hasPlaceWork(workTypes) &&
    (!hasCenter || studioName.trim().length > 0) &&
    !introBanned && !faqBanned && kakaoValid
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

  // 사진을 고르면 바로 '정사각형 맞추기' 화면으로
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCropTotal(1)
    setCropQueue([{ file, target: 'profile' }])
  }

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    setPhotoError('')
    const room = PHOTO_MAX - photoSlots.length
    if (files.length > room) setPhotoError(`대표 사진은 ${PHOTO_MAX}장까지예요. 앞의 ${room}장만 넣을게요.`)
    const jobs = files.slice(0, room).map(file => ({ file, target: 'photo' as const }))
    if (jobs.length === 0) return
    setCropTotal(jobs.length)
    setCropQueue(jobs)
  }

  const recropPhoto = (index: number) => {
    const source = photoSlots[index]?.source
    if (!source) return
    setCropTotal(1)
    setCropQueue([{ file: source, target: 'photo', replaceIndex: index }])
  }

  const finishCrop = (blob: Blob | null) => {
    const job = cropQueue[0]
    if (job && blob) {
      const preview = URL.createObjectURL(blob)
      if (job.target === 'profile') {
        setProfileImage(new File([blob], 'profile.jpg', { type: 'image/jpeg' }))
        setProfileImagePreview(preview)
      } else if (job.replaceIndex !== undefined) {
        const at = job.replaceIndex
        setPhotoSlots(prev => prev.map((s, i) => (i === at ? { url: null, blob, preview, source: job.file } : s)))
      } else {
        setPhotoSlots(prev => (prev.length >= PHOTO_MAX ? prev : [...prev, { url: null, blob, preview, source: job.file }]))
      }
    }
    setCropQueue(q => q.slice(1))
  }

  const removePhoto = (index: number) => setPhotoSlots(prev => prev.filter((_, i) => i !== index))

  // 고른 사진을 맨 앞(검색 목록 첫 칸)으로
  const makeFirstPhoto = (index: number) =>
    setPhotoSlots(prev => [prev[index], ...prev.filter((_, i) => i !== index)])

  // 새로 고른 사진만 올리고, 최종 순서대로 주소 목록을 만든다
  const uploadPhotos = async (therapistId: string): Promise<string[] | null> => {
    const urls: string[] = []
    for (let i = 0; i < photoSlots.length; i++) {
      const slot = photoSlots[i]
      if (slot.url) { urls.push(slot.url); continue }
      if (!slot.blob) continue
      const path = `photos/${therapistId}/${Date.now()}_${i}.jpg`
      const { error } = await supabase.storage.from('profiles').upload(path, slot.blob, { contentType: 'image/jpeg', upsert: false })
      if (error) {
        console.error('대표 사진 업로드 실패:', error)
        return null
      }
      urls.push(supabase.storage.from('profiles').getPublicUrl(path).data.publicUrl)
    }
    return urls
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

    // 질문답변은 따로 읽음 (칸이 아직 없어도 나머지 화면은 그대로 열리게)
    const { data: faqRow } = await supabase.from('therapists').select('faq').eq('id', data.id).single()
    setFaq(cleanFaq(faqRow?.faq))

    // 대표 사진도 따로 읽음 (칸이 아직 없으면 빈 목록)
    const { data: photoRow, error: photoReadError } = await supabase.from('therapists').select('photo_urls').eq('id', data.id).single()
    const saved = photoReadError ? [] : pickPhotos(photoRow?.photo_urls)
    setSavedPhotos(saved)
    setPhotoSlots(saved.map(url => ({ url, blob: null, preview: url })))

    // 후기 평점 (내 프로필 머리에 표시)
    const { data: rv } = await supabase.from('reviews').select('rating').eq('therapist_id', data.id)
    setRating(rv && rv.length > 0 ? { avg: rv.reduce((s, r) => s + r.rating, 0) / rv.length, count: rv.length } : null)
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

  // 진입 시 로그인 확인: 전문가면 내 프로필(가입 직후 ?edit=1이면 바로 수정), 아니면 일반 회원 MY
  useEffect(() => {
    let active = true
    async function restore() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (session?.user) {
        setAuthUser(session.user)
        const ok = await loadTherapist(session.user.id)
        if (!active) return
        const wantsEdit = new URLSearchParams(window.location.search).get('edit') === '1'
        setStep(ok ? (wantsEdit ? 'edit' : 'view') : 'guest')
      }
      setChecking(false)
    }
    restore()
    return () => { active = false }
  }, [loadTherapist])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setTherapist(null)
    setAuthUser(null)
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

    setSaveError('')
    const { error: updateError } = await supabase
      .from('therapists')
      .update({
        kakao_link: toOpenChatUrl(kakaoLink) ?? kakaoLink.trim(),
        intro,
        faq: cleanFaq(faq),
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

    // 저장이 안 됐는데 '완료'로 넘어가지 않도록
    if (updateError) {
      console.error('profile update error:', updateError)
      setSaveError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setSaving(false)
      return
    }

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

    // 대표 사진 (따로 저장 — 칸이 없거나 실패해도 나머지 수정은 그대로 남게)
    let photoMessage = ''
    const photoUrls = await uploadPhotos(therapist.id)
    if (photoUrls === null) {
      photoMessage = ' 대표 사진은 올리지 못했어요. 잠시 후 다시 시도해 주세요.'
    } else if (photoUrls.join('|') !== savedPhotos.join('|')) {
      const { error: photoSaveError } = await supabase.from('therapists').update({ photo_urls: photoUrls }).eq('id', therapist.id)
      if (photoSaveError) {
        console.error('photo_urls update error:', photoSaveError)
        photoMessage = ' 대표 사진은 저장하지 못했어요. (DB에 photo_urls 칸이 있는지 확인해 주세요)'
      }
    }

    if (therapist.user_id) await loadTherapist(therapist.user_id)
    setSaving(false)
    setNotice('✅ 프로필을 저장했어요.' + photoMessage)
    setStep('view')
    window.scrollTo(0, 0)
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white pb-24">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3 z-10">
        <button
          onClick={() => (step === 'edit' ? (setStep('view'), window.scrollTo(0, 0)) : step === 'guest' && therapist ? setStep('view') : router.back())}
          aria-label="뒤로"
          className="text-gray-600 text-xl"
        >
          ←
        </button>
        <h1 className="text-base font-bold text-gray-900 flex-1">
          {(step === 'login' || step === 'guest') && '마이페이지'}
          {step === 'view' && '내 프로필'}
          {step === 'edit' && '프로필 수정'}
        </h1>
        {step === 'view' && (
          <button onClick={() => { setStep('guest'); window.scrollTo(0, 0) }} className="text-xs font-semibold text-[#0F6E56] mr-2">보호자 화면</button>
        )}
        {(step === 'view' || step === 'edit') && (
          <button onClick={handleLogout} className="text-xs text-gray-400">로그아웃</button>
        )}
      </div>

      {!checking && step === 'view' && therapist && (
        <MyProfileView
          therapist={{ ...therapist, intro, kakao_link: kakaoLink }}
          photos={savedPhotos}
          workTypes={workTypes}
          bodyParts={selectedBodyParts}
          purposes={selectedPurposes}
          availability={availability}
          faq={faq}
          rating={rating}
          notice={notice}
          onEdit={() => { setNotice(''); setStep('edit'); window.scrollTo(0, 0) }}
        />
      )}

      {!checking && step === 'guest' && authUser && (
        <GuestMy
          user={authUser}
          isExpert={!!therapist}
          onExpertMode={() => { setStep('view'); window.scrollTo(0, 0) }}
          onLogout={handleLogout}
        />
      )}

      <div className={'px-5 py-6' + (step === 'view' || step === 'guest' ? ' hidden' : '')}>
        {checking && (
          <p className="text-center text-gray-400 py-20">확인 중...</p>
        )}

        {!checking && step === 'login' && (
          <div className="pt-6">
            <h2 className="text-[24px] font-extrabold text-gray-900 leading-snug">
              로그인하고
              <br />
              부모님 돌봄을 이어 가세요
            </h2>
            <p className="text-[16px] text-gray-600 mt-2 leading-relaxed">
              모두 카카오로 가입해요. 물리치료사는 가입한 뒤 &lsquo;전문가로 가입하기&rsquo;로 전환할 수 있어요.
            </p>
            <div className="mt-8">
              <KakaoLoginButton next="/mypage" />
            </div>
            <button
              onClick={() => router.push('/login?next=/mypage')}
              className="w-full min-h-[48px] mt-4 text-[15px] font-semibold text-gray-500"
            >
              예전에 이메일로 가입한 전문가 로그인 ›
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

            {/* 대표 사진 3장 — 검색 목록에 정사각형으로 보임 */}
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1">
                대표 사진 <span className="text-xs text-gray-400 font-normal">({photoSlots.length}/{PHOTO_MAX} · 정사각형)</span>
              </label>
              <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                검색 목록에 3장이 나란히 보여요. 사진을 고르면 정사각형으로 위치·크기를 맞출 수 있어요. 운동 지도 모습·센터·도구 사진을 추천해요.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {photoSlots.map((slot, i) => (
                  <div key={slot.preview} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-100">
                    <img src={slot.preview} alt={`대표 사진 ${i + 1}`} className="w-full h-full object-cover" />
                    {slot.source && (
                      <button type="button" onClick={() => recropPhoto(i)}
                        className="absolute right-1.5 bottom-1.5 px-2 py-1 rounded-md bg-white/90 text-[11px] font-bold text-gray-700">
                        편집
                      </button>
                    )}
                    {i === 0 ? (
                      <span className="absolute left-1.5 top-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[11px] font-bold">대표</span>
                    ) : (
                      <button type="button" onClick={() => makeFirstPhoto(i)}
                        className="absolute left-1.5 bottom-1.5 px-2 py-1 rounded-md bg-white/90 text-[11px] font-bold text-gray-700">
                        맨 앞으로
                      </button>
                    )}
                    <button type="button" onClick={() => removePhoto(i)} aria-label={`대표 사진 ${i + 1} 빼기`}
                      className="absolute right-1 top-1 w-8 h-8 rounded-full bg-black/60 text-white text-base leading-none flex items-center justify-center">
                      ×
                    </button>
                  </div>
                ))}
                {photoSlots.length < PHOTO_MAX && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-[#0A8A7B] hover:text-[#0A8A7B] transition">
                    <span className="text-2xl leading-none">＋</span>
                    <span className="text-xs font-semibold mt-1">사진 추가</span>
                    <input type="file" accept="image/*" multiple onChange={handlePhotoAdd} className="hidden" />
                  </label>
                )}
              </div>
              {photoError && <p className="text-xs text-red-500 mt-2">{photoError}</p>}
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 block mb-3">프로필 사진 <span className="text-xs text-gray-400 font-normal">(동그란 얼굴 사진)</span></label>
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
                  <p className="text-xs text-gray-400 mt-1.5 text-center">고른 뒤 정사각형으로 맞춰요</p>
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
              {kakaoLink.trim() !== '' && !kakaoValid && (
                <p className="text-xs text-red-500 mt-1.5">카카오 오픈채팅 주소(https://open.kakao.com/...)를 넣어 주세요</p>
              )}
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
              {introBanned && <p className="text-xs text-red-500 mt-1 leading-relaxed">{bannedMessage(introBanned)}</p>}
            </div>

            {/* 질문답변 (숨고 참고) */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm font-bold text-gray-900 pt-4">
                질문답변 <span className="text-xs text-gray-400 font-normal">(선택)</span>
              </p>
              <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed">
                보호자가 연락하기 전에 자주 묻는 것들이에요. 답을 적은 질문만 프로필 &lsquo;질문답변&rsquo;에 보여요.
              </p>
              <div className="space-y-4">
                {FAQ_QUESTIONS.map(f => {
                  const value = faq[f.key] ?? ''
                  const banned = findBannedPhrase(value)
                  return (
                    <div key={f.key}>
                      <p className="text-sm font-bold text-gray-800 mb-1.5">Q. {f.q}</p>
                      <textarea
                        value={value}
                        onChange={(e) => setFaq(prev => ({ ...prev, [f.key]: e.target.value }))}
                        maxLength={FAQ_MAX}
                        rows={3}
                        placeholder={f.ph}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B] resize-none"
                      />
                      <div className="flex justify-between gap-2 mt-1">
                        <p className="text-xs text-red-500 leading-relaxed">{banned ? bannedMessage(banned) : ''}</p>
                        <p className="text-xs text-gray-400 shrink-0">{value.length} / {FAQ_MAX}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {step === 'view' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-5 py-4 bg-white border-t border-gray-100 z-20">
          <button onClick={() => { setNotice(''); setStep('edit'); window.scrollTo(0, 0) }}
            className="w-full py-4 rounded-2xl font-bold text-base bg-[#0A8A7B] text-white active:scale-[0.98] transition-all">
            프로필 수정
          </button>
        </div>
      )}

      {step === 'edit' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-5 py-4 bg-white border-t border-gray-100 z-20">
          {saveError && <p className="text-sm text-red-500 text-center mb-2">{saveError}</p>}
          {!saveError && (introBanned || faqBanned) && (
            <p className="text-xs text-red-500 text-center mb-2">쓸 수 없는 표현이 있어 저장할 수 없어요. 빨간 안내를 확인해 주세요.</p>
          )}
          <button onClick={handleSave} disabled={saving || uploadingImage || !canSave}
            className={'w-full py-4 rounded-2xl font-bold text-base transition-all ' + (!saving && !uploadingImage && canSave ? 'bg-[#0A8A7B] text-white active:scale-[0.98]' : 'bg-gray-100 text-gray-300 cursor-not-allowed')}>
            {uploadingImage ? '사진 업로드 중...' : saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      )}
      {cropQueue.length > 0 && (
        <SquareCropper
          key={`${cropQueue[0].file.name}-${cropQueue.length}`}
          file={cropQueue[0].file}
          round={cropQueue[0].target === 'profile'}
          title={cropQueue[0].target === 'profile' ? '프로필 사진 맞추기' : '대표 사진 맞추기'}
          step={cropTotal > 1 ? `${cropTotal - cropQueue.length + 1}/${cropTotal}` : undefined}
          onCancel={() => finishCrop(null)}
          onDone={finishCrop}
        />
      )}
    </main>
  )
}
