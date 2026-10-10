'use client'

// MY — 로그인한 전문가가 처음 보는 '내 프로필' (숨고 고수 프로필 화면 참고, 그대로 베끼지 않음)
// 위: 사진·이름·한 줄 정보 / 소개 / 탭(정보·사진·전문분야·질문답변) / 아래: 프로필 수정 버튼

import { useState } from 'react'
import Link from 'next/link'
import PhotoTriplet from '@/components/PhotoTriplet'
import { PHOTO_MAX } from '@/lib/squareImage'
import {
  FAQ_QUESTIONS, practitionerLabel, workTypeLabels, summarizeAvailability, hasCenterWork, hasVisitWork,
} from '@/lib/practitioner'

export interface MyProfileData {
  id: string
  name: string
  years_experience: number
  practitioner_type: string
  studio_name: string | null
  hospital_name: string | null
  intro: string
  kakao_link: string
  verification_status: string
  profile_image_url: string | null
  certifications: string[] | null
  visit_radius_km: number | null
}

const GREEN = '#0A8A7B'
const GREEN_DARK = '#0F6E56'

export default function MyProfileView({
  therapist,
  photos,
  workTypes,
  bodyParts,
  purposes,
  availability,
  faq,
  rating,
  notice,
  onEdit,
}: {
  therapist: MyProfileData
  photos: string[]
  workTypes: string[]
  bodyParts: string[]
  purposes: string[]
  availability: string[]
  faq: Record<string, string>
  rating: { avg: number; count: number } | null
  notice?: string
  onEdit: () => void
}) {
  const [tab, setTab] = useState('info')
  const verified = therapist.verification_status === 'verified'
  const place = therapist.studio_name || therapist.hospital_name
  const workLabels = workTypeLabels(workTypes)
  const availText = summarizeAvailability(availability)
  const faqItems = FAQ_QUESTIONS.filter((f) => faq[f.key]).map((f) => ({ q: f.q, a: faq[f.key] }))
  const certs = therapist.certifications ?? []

  // 프로필 완성도 — 보호자가 연락하기 전에 보는 것 위주
  const checklist = [
    { label: `대표 사진 ${PHOTO_MAX}장`, done: photos.length >= PHOTO_MAX },
    { label: '자기소개 30자 이상', done: (therapist.intro ?? '').trim().length >= 30 },
    { label: '활동 형태', done: workLabels.length > 0 },
    { label: '가능한 시간', done: availability.length > 0 },
    { label: '운동 지도 분야', done: purposes.length > 0 },
    { label: '질문답변 1개 이상', done: faqItems.length > 0 },
    { label: '카카오 오픈채팅 주소', done: !!therapist.kakao_link },
  ]
  const doneCount = checklist.filter((c) => c.done).length
  const percent = Math.round((doneCount / checklist.length) * 100)

  const tabs = [
    { id: 'info', label: '정보' },
    { id: 'photos', label: `사진 ${photos.length}` },
    { id: 'specialty', label: '전문분야' },
    { id: 'faq', label: '질문답변' },
  ]
  const go = (id: string) => {
    setTab(id)
    const el = document.getElementById(`my-${id}`)
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 112, behavior: 'smooth' })
  }

  return (
    <div className="pb-6">
      {notice && (
        <div className="mx-5 mt-4 rounded-xl px-4 py-3 text-[15px] font-semibold" style={{ background: '#E8F6F4', color: GREEN_DARK }}>
          {notice}
        </div>
      )}

      {/* 머리: 사진 · 이름 · 한 줄 정보 */}
      <section className="px-5 pt-6">
        <div className="flex items-center gap-4">
          <div className="w-[76px] h-[76px] rounded-full overflow-hidden bg-gray-100 flex items-center justify-center shrink-0 border border-gray-100">
            {therapist.profile_image_url || photos[0] ? (
              <img src={therapist.profile_image_url || photos[0]} alt={therapist.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl" aria-hidden="true">👤</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[24px] font-extrabold text-gray-900 leading-tight">{therapist.name}</h2>
            <p className="text-[15px] text-gray-600 mt-1 flex items-center gap-1 flex-wrap">
              {rating ? (
                <>
                  <span style={{ color: '#E0A100' }}>★</span>
                  <b className="text-gray-900">{rating.avg.toFixed(1)}</b>
                  <span className="text-gray-400">({rating.count})</span>
                  <span className="text-gray-300">·</span>
                </>
              ) : null}
              <span>경력 {therapist.years_experience}년</span>
              <span className="text-gray-300">·</span>
              <span>{practitionerLabel(therapist.practitioner_type)}</span>
            </p>
            <span
              className="inline-block mt-1.5 text-[13px] font-bold px-2.5 py-1 rounded-full"
              style={verified ? { background: '#E8F6F4', color: GREEN_DARK } : { background: '#FEF3C7', color: '#92400E' }}
            >
              {verified ? '✓ 면허 인증 · 보호자에게 공개 중' : '승인 대기 중 · 승인되면 공개돼요'}
            </span>
          </div>
        </div>
        {therapist.intro && (
          <p className="text-[15px] text-gray-600 leading-relaxed mt-4 line-clamp-3 whitespace-pre-wrap">{therapist.intro}</p>
        )}
      </section>

      {/* 프로필 완성도 */}
      <section className="px-5 pt-5">
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[16px] font-bold text-gray-900">프로필 완성도</p>
            <p className="text-[16px] font-extrabold tabular-nums" style={{ color: GREEN_DARK }}>
              {percent}%
            </p>
          </div>
          <div className="h-2 rounded-full bg-white overflow-hidden mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <div className="h-full rounded-full" style={{ width: `${percent}%`, background: GREEN }} />
          </div>
          {doneCount < checklist.length && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {checklist
                .filter((c) => !c.done)
                .map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={onEdit}
                    className="min-h-[36px] px-3 rounded-full bg-white border border-gray-200 text-[13px] font-semibold text-gray-600"
                  >
                    + {c.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* 탭 */}
      <nav className="sticky top-[57px] z-10 bg-white border-b border-gray-100 mt-5 flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => go(t.id)}
            className={'flex-1 min-h-[48px] text-[15px] font-bold relative ' + (tab === t.id ? 'text-gray-900' : 'text-gray-400')}
          >
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full" style={{ background: GREEN }} />}
          </button>
        ))}
      </nav>

      {/* 정보 */}
      <section id="my-info" className="px-5 pt-5">
        <div className="space-y-3">
          <Row icon="🛡️" text={verified ? '물리치료사 면허 확인 완료' : '물리치료사 면허 확인 중'} />
          {workLabels.length > 0 ? <Row icon="🧭" text={workLabels.join(' · ')} /> : <Row icon="🧭" text="활동 형태를 골라 주세요" muted />}
          {hasCenterWork(workTypes) && place && <Row icon="🏢" text={place} />}
          {hasVisitWork(workTypes) && therapist.visit_radius_km != null && (
            <Row icon="🏠" text={`집으로 방문 · ${therapist.visit_radius_km}km 이내`} />
          )}
          <Row icon="🕐" text={availText || '가능한 시간을 골라 주세요'} muted={!availText} />
          <Row icon="💬" text={therapist.kakao_link ? '카카오톡 오픈채팅으로 상담 (전화번호 비공개)' : '오픈채팅 주소를 넣어 주세요'} muted={!therapist.kakao_link} />
          {certs.length > 0 && <Row icon="🏅" text={`보유 자격 ${certs.length}개 · ${certs.slice(0, 2).join(', ')}${certs.length > 2 ? ' 외' : ''}`} />}
        </div>

        <h3 className="text-[18px] font-extrabold text-gray-900 mt-7">서비스 상세 설명</h3>
        <p className="text-[15px] text-gray-700 leading-relaxed mt-2 whitespace-pre-wrap">
          {therapist.intro || '자기소개를 적어 주세요.'}
        </p>
      </section>

      {/* 사진 */}
      <section id="my-photos" className="px-5 pt-8">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-extrabold text-gray-900">
            대표 사진 <span className="text-gray-400 font-bold">{photos.length}/{PHOTO_MAX}</span>
          </h3>
          <button type="button" onClick={onEdit} className="min-h-[40px] text-[14px] font-bold" style={{ color: GREEN_DARK }}>
            사진 바꾸기 ›
          </button>
        </div>
        <p className="text-[14px] text-gray-500 mt-1">검색 목록에 이 순서대로 정사각형으로 보여요.</p>
        <div className="mt-3">
          <PhotoTriplet urls={photos} name={therapist.name} gap={6} linkable />
        </div>
      </section>

      {/* 전문분야 */}
      <section id="my-specialty" className="px-5 pt-8">
        <h3 className="text-[18px] font-extrabold text-gray-900">전문분야</h3>
        {purposes.length + bodyParts.length === 0 ? (
          <p className="text-[15px] text-gray-400 mt-2">운동 지도 분야를 골라 주세요.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-3">
            {purposes.map((p) => (
              <span key={p} className="px-3 py-1.5 rounded-full text-[14px] font-semibold" style={{ background: '#E8F6F4', color: GREEN_DARK }}>
                {p}
              </span>
            ))}
            {bodyParts.map((p) => (
              <span key={p} className="px-3 py-1.5 rounded-full text-[14px] font-semibold bg-gray-100 text-gray-600">
                {p}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 질문답변 */}
      <section id="my-faq" className="px-5 pt-8">
        <h3 className="text-[18px] font-extrabold text-gray-900">질문답변</h3>
        {faqItems.length === 0 ? (
          <p className="text-[15px] text-gray-400 mt-2">답을 적은 질문만 보호자에게 보여요. 프로필 수정에서 적어 주세요.</p>
        ) : (
          <div className="space-y-5 mt-3">
            {faqItems.map((item) => (
              <div key={item.q}>
                <p className="text-[16px] font-bold text-gray-900 leading-snug">Q. {item.q}</p>
                <p className="text-[15px] text-gray-600 mt-1.5 leading-relaxed whitespace-pre-wrap">{item.a}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {verified && (
        <div className="px-5 pt-8">
          <Link
            href={`/therapist/${therapist.id}`}
            className="w-full min-h-[52px] rounded-xl border border-gray-200 bg-white text-[16px] font-semibold text-gray-700 flex items-center justify-center"
          >
            보호자에게 보이는 화면 보기 ›
          </Link>
        </div>
      )}
    </div>
  )
}

function Row({ icon, text, muted }: { icon: string; text: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-6 text-center text-[17px] leading-6 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className={'text-[16px] leading-6 ' + (muted ? 'text-gray-400' : 'text-gray-800')}>{text}</span>
    </div>
  )
}
