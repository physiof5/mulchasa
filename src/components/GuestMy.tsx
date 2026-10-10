'use client'

// MY — 일반 회원(보호자) 화면. 맨 위에 '전문가로 가입하기' 띠 (숨고 '고수로 가입하기' 참고)
// 전문가 회원은 이 화면을 '보호자 화면'으로 볼 수 있고, 띠에서 전문가 화면으로 돌아간다.

import { useMemo } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { avatarOf, displayName, loginMethod } from '@/lib/auth'
import { LAST_RESULT_KEYS, parseLastResult } from '@/lib/checks'
import { useLocalStorageItem } from '@/lib/useDeviceStorage'

const GREEN_DARK = '#0F6E56'
const GREEN_LIGHT = '#E8F6F4'
const CONTACT_EMAIL = 'spacex2025@naver.com'

export default function GuestMy({
  user,
  isExpert,
  onExpertMode,
  onLogout,
}: {
  user: User
  isExpert: boolean
  onExpertMode?: () => void
  onLogout: () => void
}) {
  const avatar = avatarOf(user)
  const fall = useLocalStorageItem(LAST_RESULT_KEYS.fall)
  const ltc = useLocalStorageItem(LAST_RESULT_KEYS.ltc)
  const cost = useLocalStorageItem(LAST_RESULT_KEYS.cost)
  const results = useMemo(
    () =>
      [
        { label: '넘어질 위험', href: '/check/fall', r: parseLastResult(fall) },
        { label: '장기요양등급', href: '/check/ltc', r: parseLastResult(ltc) },
        { label: '돌봄 비용', href: '/check/cost', r: parseLastResult(cost) },
      ].filter((x) => x.r),
    [fall, ltc, cost]
  )

  return (
    <div className="pb-6">
      {/* 전문가 가입 / 전문가 화면으로 */}
      {isExpert ? (
        <button
          type="button"
          onClick={onExpertMode}
          className="w-full min-h-[56px] px-5 flex items-center justify-between bg-gray-800 text-white text-[16px] font-bold"
        >
          전문가 화면으로 돌아가기
          <span aria-hidden="true">›</span>
        </button>
      ) : (
        <Link href="/register" className="w-full min-h-[56px] px-5 flex items-center justify-between bg-gray-800 text-white text-[16px] font-bold">
          <span>
            물리치료사이신가요? <span className="text-[#5EEAD4]">전문가로 가입하기</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      )}

      {/* 내 계정 */}
      <section className="px-5 pt-6">
        <div className="flex items-center gap-4">
          <span className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
            {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl">👤</span>}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[21px] font-extrabold text-gray-900 truncate">{displayName(user)}님</p>
            <p className="text-[14px] text-gray-500 mt-0.5 flex items-center gap-1.5 min-w-0">
              {user.app_metadata?.provider === 'kakao' && (
                <span className="w-4 h-4 rounded-full shrink-0" style={{ background: '#FEE500' }} aria-hidden="true" />
              )}
              <span className="truncate">{user.email || loginMethod(user)}</span>
            </p>
          </div>
          <button type="button" onClick={onLogout} className="min-h-[40px] px-3 rounded-lg border border-gray-200 text-[13px] text-gray-500 shrink-0">
            로그아웃
          </button>
        </div>
      </section>

      {/* 지난 자가진단 */}
      <section className="px-5 pt-6">
        <div className="rounded-2xl p-4" style={{ background: GREEN_LIGHT }}>
          <p className="text-[16px] font-bold" style={{ color: GREEN_DARK }}>
            지난 자가진단 결과
          </p>
          {results.length === 0 ? (
            <p className="text-[15px] text-gray-600 mt-1">아직 해 본 자가진단이 없어요. 1분이면 끝나요.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {results.map((x) => (
                <li key={x.label}>
                  <Link href={x.href} className="flex items-center justify-between gap-2 text-[15px] text-gray-700 min-h-[36px]">
                    <span className="min-w-0">
                      <b className="text-gray-900">{x.label}</b> · {x.r!.summary}
                    </span>
                    <span className="text-gray-400 shrink-0" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/check" className="mt-3 min-h-[44px] rounded-xl bg-white flex items-center justify-center text-[15px] font-bold" style={{ color: GREEN_DARK }}>
            1분 자가진단 하러 가기
          </Link>
          <p className="text-[12px] text-gray-500 mt-2">결과는 이 기기에만 남아요.</p>
        </div>
      </section>

      <Menu
        title="부모님 돌봄"
        items={[
          { href: '/find', label: '부모님 상황 맞춤 찾기' },
          { href: '/request', label: '방문 운동 지도 요청서 남기기' },
          { href: '/check/cost', label: '돌봄 비용 모의 계산' },
          { href: '/settings/forms', label: '장기요양 서식자료실' },
        ]}
      />
      <Menu
        title="도움말"
        items={[
          { href: `mailto:${CONTACT_EMAIL}`, label: '문의하기' },
          { href: '/privacy', label: '개인정보처리방침' },
          { href: '/settings', label: '설정' },
        ]}
      />
      <p className="px-5 pt-6 text-[13px] text-gray-400">회원 탈퇴는 문의하기({CONTACT_EMAIL})로 요청해 주세요.</p>
    </div>
  )
}

function Menu({ title, items }: { title: string; items: { href: string; label: string }[] }) {
  return (
    <section className="px-5 pt-7">
      <h2 className="text-[15px] font-bold text-gray-500 mb-1">{title}</h2>
      <ul className="divide-y divide-gray-100">
        {items.map((i) => (
          <li key={i.label}>
            {i.href.startsWith('/') ? (
              <Link href={i.href} className="min-h-[54px] flex items-center justify-between text-[17px] text-gray-800">
                {i.label}
                <span className="text-gray-300" aria-hidden="true">
                  ›
                </span>
              </Link>
            ) : (
              <a href={i.href} className="min-h-[54px] flex items-center justify-between text-[17px] text-gray-800">
                {i.label}
                <span className="text-gray-300" aria-hidden="true">
                  ›
                </span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
