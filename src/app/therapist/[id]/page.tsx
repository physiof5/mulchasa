'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ConsultFormModal from '@/components/ConsultFormModal'
import PhotoTriplet from '@/components/PhotoTriplet'
import { pickPhotos } from '@/lib/squareImage'
import { practitionerLabel, workTypeLabels, summarizeAvailability, PRACTICE_RULES, FAQ_QUESTIONS, cleanFaq } from '@/lib/practitioner'
import { PUBLIC_FIELDS, REVIEW_DISCLAIMER, stars, type PublicReview } from '@/lib/reviews'
import { BadgeIcon } from '@/components/crew/CrewParts'
import { badgeInfo } from '@/lib/crew'

interface Therapist {
  id: string
  name: string
  years_experience: number
  practitioner_type: string
  hospital_name: string | null
  studio_name: string | null
  kakao_link: string
  intro: string
  verification_status: string
  profile_image_url: string | null
  certifications: string[] | null
  service_mode: string | null
  visit_radius_km: number | null
  work_types: string[] | null
}

interface Tag {
  category: string
  label: string
}


export default function TherapistDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [therapist, setTherapist] = useState<Therapist | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [crew, setCrew] = useState<{ crew: string | null; badge_level: number; hearts: number } | null>(null)
  const [availability, setAvailability] = useState<string[]>([])
  const [faq, setFaq] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showAllCerts, setShowAllCerts] = useState(false)
  const [activeTab, setActiveTab] = useState('intro')
  // 진행 후기: 전문가가 쓰고 회원이 공개에 동의한 것만
  const fetchReviews = async (therapistId: string) => {
    const { data } = await supabase
      .from('case_reviews')
      .select(PUBLIC_FIELDS)
      .eq('therapist_id', therapistId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(30)
    setReviews((data as PublicReview[] | null) ?? [])
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const id = params.id as string

      const { data: tData } = await supabase
        .from('therapists')
        // 공개 프로필에 필요한 칸만 (면허번호·이메일·휴대폰은 가져오지 않음)
        .select('id, name, years_experience, practitioner_type, hospital_name, studio_name, kakao_link, intro, verification_status, profile_image_url, certifications, service_mode, visit_radius_km, work_types')
        .eq('id', id)
        .eq('verification_status', 'verified')
        .single()

      if (!tData) { setLoading(false); return }
      setTherapist(tData)

      const { data: ttData } = await supabase
        .from('therapist_tags')
        .select('tag_id')
        .eq('therapist_id', id)

      if (ttData && ttData.length > 0) {
        const tagIds = ttData.map(t => t.tag_id)
        const { data: tagData } = await supabase
          .from('tags')
          .select('category, label')
          .in('id', tagIds)
        setTags(tagData || [])
      }

      const { data: avData } = await supabase
        .from('therapist_availability')
        .select('day_of_week, slot')
        .eq('therapist_id', id)
      setAvailability((avData || []).map(a => `${a.day_of_week}-${a.slot}`))

      // 질문답변은 따로 읽음 (칸이 없거나 막혀 있어도 프로필은 그대로 보이게)
      const { data: faqRow } = await supabase.from('therapists').select('faq').eq('id', id).single()
      setFaq(cleanFaq(faqRow?.faq))

      // 대표 사진 3장도 따로 읽음
      const { data: photoRow, error: photoError } = await supabase.from('therapists').select('photo_urls').eq('id', id).single()
      if (!photoError) setPhotos(pickPhotos(photoRow?.photo_urls))

      await fetchReviews(id)
      // 크루 배지 (없거나 준비 전이면 표시 안 함)
      const { data: badges } = await supabase.rpc('crew_badges', { p_ids: [id] })
      const b = Array.isArray(badges) ? (badges as { crew: string | null; badge_level: number; hearts: number }[])[0] : null
      setCrew(b ?? null)
      setLoading(false)
    }
    fetchData()
  }, [params.id])

  // 평점 = 회원이 공개에 동의하며 남긴 만족도 별점 평균 (별점을 남긴 후기만)
  const rated = reviews.filter((r) => r.member_rating != null)
  const averageRating = rated.length > 0
    ? (rated.reduce((sum, r) => sum + (r.member_rating ?? 0), 0) / rated.length).toFixed(1)
    : null

  const getTypeInfo = (type: string) => ({ label: practitionerLabel(type), color: 'bg-emerald-50 text-emerald-700' })

  const bodyParts = tags.filter(t => t.category === 'body_part')
  const purposes = tags.filter(t => t.category === 'purpose')

  // 데이터에 따라 탭 구성을 동적으로 만든다
  // 답을 적은 질문만 보여 줌
  const faqItems = FAQ_QUESTIONS.filter(f => faq[f.key]).map(f => ({ q: f.q, a: faq[f.key] }))

  const tabList = [
    { id: 'intro', label: '정보', show: true },
    { id: 'photos', label: '사진', show: photos.length > 0 },
    { id: 'specialty', label: '전문분야', show: bodyParts.length > 0 || purposes.length > 0 },
    { id: 'faq', label: '질문답변', show: faqItems.length > 0 },
    { id: 'certs', label: '자격', show: !!(therapist?.certifications && therapist.certifications.length > 0) },
    { id: 'reviews', label: '진행 후기', show: true },
  ].filter(t => t.show)

  // 스크롤 위치에 따라 활성 탭 갱신
  useEffect(() => {
    if (loading || !therapist) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          const topMost = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          )
          setActiveTab(topMost.target.id)
        }
      },
      { rootMargin: '-110px 0px -70% 0px', threshold: 0 }
    )
    tabList.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, therapist, tags.length, faqItems.length, photos.length])

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 100
    window.scrollTo({ top, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white">
        <div className="h-[420px] bg-gray-100 animate-pulse" />
        <div className="px-5 py-6 space-y-3">
          <div className="h-6 w-1/2 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
          <div className="h-20 w-full bg-gray-100 rounded-2xl animate-pulse mt-4" />
        </div>
      </main>
    )
  }

  if (!therapist) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white flex items-center justify-center px-5">
        <div className="text-center">
          <div className="text-5xl mb-4">😔</div>
          <p className="text-base font-bold text-gray-700 mb-2">전문가를 찾을 수 없어요</p>
          <button onClick={() => router.push('/')} className="px-6 py-3 bg-[#0A8A7B] text-white rounded-xl font-semibold">홈으로</button>
        </div>
      </main>
    )
  }

  const typeInfo = getTypeInfo(therapist.practitioner_type)
  const certList = therapist.certifications || []
  const workLabels = workTypeLabels(therapist.work_types)
  const availText = summarizeAvailability(availability)
  const canVisit = therapist.service_mode === 'visit' || therapist.service_mode === 'both'
  const visibleCerts = showAllCerts ? certList : certList.slice(0, 5)

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-28">
      {/* ===== 히어로 ===== */}
      <section className="relative w-full" style={{ height: 420 }}>
        {therapist.profile_image_url ? (
          <img
            src={therapist.profile_image_url}
            alt={therapist.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#0A8A7B] to-[#065249] flex items-center justify-center">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" fill="rgba(255,255,255,0.5)" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {/* 상단 그라디언트 + 하단 그라디언트 */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />

        {/* 상단 컨트롤 */}
        <div className="absolute top-0 left-0 right-0 px-4 pt-4 flex items-center justify-between z-10">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-black/25 backdrop-blur text-white text-xl active:scale-95 transition"
            aria-label="뒤로"
          >
            ←
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-black/25 backdrop-blur text-white text-lg active:scale-95 transition"
            aria-label="홈"
          >
            ⌂
          </button>
        </div>

        {/* 하단 정보 오버레이 */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 z-10 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/95 text-green-700 text-[11px] font-bold rounded-full">
              ✓ 면허 인증
            </span>
            <span className={'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ' + typeInfo.color}>
              {typeInfo.label}
            </span>
            {crew?.crew && badgeInfo(crew.badge_level) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/95 text-[11px] font-bold rounded-full" style={{ color: badgeInfo(crew.badge_level)!.color }}>
                <BadgeIcon level={crew.badge_level} size={12} />
                {crew.crew} · {badgeInfo(crew.badge_level)!.label} 배지
              </span>
            )}
          </div>

          <h1 className="text-[26px] font-extrabold leading-tight drop-shadow">{therapist.name}</h1>
          {(therapist.studio_name || therapist.hospital_name) && (
            <p className="text-sm text-white/90 mt-0.5 drop-shadow">
              {therapist.studio_name || therapist.hospital_name}
            </p>
          )}

          {/* 통계 라인 */}
          <div className="flex items-center gap-2 mt-2 text-sm font-semibold text-white/95 flex-wrap">
            {averageRating && (
              <span className="flex items-center gap-1">
                <span className="text-yellow-400">★</span>
                {averageRating}
                <span className="text-white/70 font-normal">진행 후기 {reviews.length}</span>
              </span>
            )}
            {certList.length > 0 && (
              <>
                <span className="text-white/40">·</span>
                <span>보유 자격 {certList.length}</span>
              </>
            )}
            <span className="text-white/40">·</span>
            <span>경력 {therapist.years_experience}년</span>
            {!!crew?.hearts && crew.hearts > 0 && (
              <>
                <span className="text-white/40">·</span>
                <span className="flex items-center gap-0.5" aria-label={`동료에게 받은 좋아요 ${crew.hearts}개`}>
                  <span className="text-[#FF6B7A]">❤</span>
                  {crew.hearts}
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ===== 스티키 탭 ===== */}
      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100 flex items-stretch">
        <button
          onClick={() => router.back()}
          className="px-3 flex items-center text-gray-700 text-xl shrink-0"
          aria-label="뒤로"
        >
          ←
        </button>
        <div className="flex-1 flex">
          {tabList.map(tab => (
            <button
              key={tab.id}
              onClick={() => scrollToSection(tab.id)}
              className={
                'flex-1 py-3.5 text-sm font-bold relative transition-colors ' +
                (activeTab === tab.id ? 'text-gray-900' : 'text-gray-400')
              }
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#0A8A7B] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ===== 정보 (소속 + 자기소개) ===== */}
      <section id="intro" className="bg-white px-5 py-5 mb-2 scroll-mt-28">
        {/* 한눈에 보는 정보 */}
        <div className="mb-5 space-y-2.5">
          <InfoRow icon="🛡️" text="물리치료사 면허 확인 완료" />
          {workLabels.length > 0 && <InfoRow icon="🧭" text={workLabels.join(' · ')} />}
          {(therapist.studio_name || therapist.hospital_name) && (
            <InfoRow icon="🏢" text={(therapist.studio_name || therapist.hospital_name) as string} />
          )}
          {canVisit && therapist.visit_radius_km != null && (
            <InfoRow icon="🏠" text={`집으로 방문 · 활동 지역에서 ${therapist.visit_radius_km}km 이내`} />
          )}
          {availText && <InfoRow icon="🕐" text={availText} />}
          <InfoRow icon="💬" text="카카오톡 오픈채팅으로 상담 (전화번호 비공개)" />
        </div>

        <h3 className="text-sm font-bold text-gray-900 mb-3">💬 자기소개</h3>
        <p className="text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap">{therapist.intro}</p>

        <div className="mt-5 rounded-xl bg-gray-50 p-4">
          <p className="text-[13px] font-bold text-gray-700 mb-1">이 전문가의 활동 원칙</p>
          {PRACTICE_RULES.map(rule => (
            <p key={rule} className="text-[13px] text-gray-500 leading-relaxed">· {rule}</p>
          ))}
          <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">진단이나 치료가 필요하면 병원·의원 진료를 먼저 받아 주세요.</p>
        </div>
      </section>

      {/* ===== 대표 사진 ===== */}
      {photos.length > 0 && (
        <section id="photos" className="bg-white px-5 py-5 mb-2 scroll-mt-28">
          <h3 className="text-sm font-bold text-gray-900 mb-3">📷 사진 {photos.length}</h3>
          <PhotoTriplet urls={photos} name={therapist.name} gap={6} linkable />
        </section>
      )}

      {/* ===== 전문분야 ===== */}
      {(bodyParts.length > 0 || purposes.length > 0) && (
        <section id="specialty" className="bg-white px-5 py-5 mb-2 scroll-mt-28">
          {bodyParts.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">🦴 전문 부위</h3>
              <div className="flex flex-wrap gap-2">
                {bodyParts.map(tag => (
                  <span key={tag.label} className="px-3 py-1.5 bg-[#E8F6F4] text-[#0A8A7B] text-sm font-semibold rounded-full">{tag.label}</span>
                ))}
              </div>
            </div>
          )}
          {purposes.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">🎯 전문 분야</h3>
              <div className="flex flex-wrap gap-2">
                {purposes.map(tag => (
                  <span key={tag.label} className="px-3 py-1.5 bg-violet-50 text-violet-600 text-sm font-semibold rounded-full">{tag.label}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===== 질문답변 (숨고 참고) ===== */}
      {faqItems.length > 0 && (
        <section id="faq" className="bg-white px-5 py-5 mb-2 scroll-mt-28">
          <h3 className="text-sm font-bold text-gray-900 mb-4">🙋 질문답변</h3>
          <div className="space-y-5">
            {faqItems.map(item => (
              <div key={item.q}>
                <p className="text-[16px] font-bold text-gray-900 leading-snug">Q. {item.q}</p>
                <p className="text-[15px] text-gray-600 mt-1.5 leading-relaxed whitespace-pre-wrap">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== 자격 (리스트형) ===== */}
      {certList.length > 0 && (
        <section id="certs" className="bg-white px-5 py-5 mb-2 scroll-mt-28">
          <h3 className="text-sm font-bold text-gray-900 mb-4">🏅 보유 자격 {certList.length}</h3>
          <p className="text-xs text-gray-400 -mt-2 mb-3">전문가가 직접 입력한 자격이에요. 물리치료사 면허는 운영팀이 확인했어요.</p>
          <div className="divide-y divide-gray-100">
            {visibleCerts.map(cert => (
              <div key={cert} className="flex items-center gap-3 py-3 first:pt-0">
                <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0 border border-yellow-100">
                  <span className="text-base">🏅</span>
                </div>
                <span className="text-sm font-medium text-gray-800 leading-snug">{cert}</span>
              </div>
            ))}
          </div>
          {certList.length > 5 && (
            <button
              onClick={() => setShowAllCerts(!showAllCerts)}
              className="w-full mt-3 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 active:bg-gray-50 transition"
            >
              {showAllCerts ? '접기' : `더보기 (${certList.length - 5}개)`}
            </button>
          )}
        </section>
      )}

      {/* ===== 진행 후기 (전문가가 쓰고 회원이 공개에 동의) ===== */}
      <section id="reviews" className="bg-white px-5 py-5 mb-2 scroll-mt-28">
        <div className="flex items-end justify-between mb-1">
          <h3 className="text-base font-bold text-gray-900">📝 진행 후기 {reviews.length}</h3>
          {averageRating && (
            <p className="text-[13px] text-gray-500">
              <span className="text-[#F59E0B]">★</span> 회원 만족도 {averageRating} ({rated.length})
            </p>
          )}
        </div>
        <p className="text-[12px] text-gray-400 leading-relaxed mb-4">{REVIEW_DISCLAIMER}</p>

        {reviews.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-[15px]">아직 공개된 진행 후기가 없어요</p>
            <p className="text-gray-400 text-[13px] mt-1">10회 이상 함께한 회원이 공개에 동의하면 여기에 보여요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <Link key={r.id} href={`/reviews/${r.id}`} className="block border border-gray-100 rounded-2xl overflow-hidden active:bg-gray-50">
                <div className="flex gap-1 h-28 bg-gray-100">
                  {r.photos.slice(0, 3).map((u, i) => (
                    <img key={u} src={u} alt={`진행 사진 ${i + 1}`} className="flex-1 min-w-0 h-full object-cover" />
                  ))}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-bold text-gray-900 truncate">
                      {r.member_label} · {r.age_band} · {r.sessions}회
                    </span>
                    {r.member_rating != null && (
                      <span className="text-[#F59E0B] text-[13px] shrink-0" aria-label={`만족도 ${r.member_rating}점`}>
                        {stars(r.member_rating)}
                      </span>
                    )}
                  </div>
                  {r.purpose && <span className="inline-block mt-1.5 px-2 py-0.5 bg-[#E8F6F4] text-[#0F6E56] text-[12px] font-semibold rounded-md">{r.purpose}</span>}
                  <p className="text-[14px] text-gray-600 leading-relaxed mt-2 line-clamp-2">{r.changes}</p>
                  {r.member_comment && <p className="text-[13px] text-gray-500 mt-1.5 line-clamp-1">회원: “{r.member_comment}”</p>}
                  <p className="text-[13px] font-semibold text-[#0A8A7B] mt-2">자세히 보기 ›</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ===== 하단 고정 CTA ===== */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 py-3 bg-white border-t border-gray-100 z-40 flex items-center gap-3">
        <button
          onClick={() => setShowModal(true)}
          className="flex-1 py-4 bg-[#FEE500] text-gray-900 text-center rounded-2xl font-bold text-base active:scale-[0.98] transition-all"
        >
          💬 카톡 상담하기
        </button>
      </div>

      <ConsultFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        therapistName={therapist.name}
        kakaoLink={therapist.kakao_link}
        purpose={purposes.length > 0 ? purposes[0].label : null}
      />
    </main>
  )
}

// 프로필 '한눈에 보는 정보' 한 줄
function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-[15px] leading-6 w-5 text-center shrink-0">{icon}</span>
      <span className="text-[15px] text-gray-700 leading-6">{text}</span>
    </div>
  )
}
