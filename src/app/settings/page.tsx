// 설정 — 홈 오른쪽 위 삼선(☰) 메뉴
// 자가진단 · 돌봄 비용 · 서식자료실 · 서비스 · 도움·정보를 한곳에 모아 보여 준다. (로그인 없이 누구나)

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { LINKS, PHONES } from '@/lib/care'
import { FORMS, FORM_CATEGORIES } from '@/lib/forms'
import { MONTHLY_LIMIT, GRADE_OPTIONS, COPAY_OPTIONS, COST_BASIS, won, percent } from '@/lib/cost'

export const metadata: Metadata = {
  title: '설정',
  description: '자가진단, 돌봄 비용 모의 계산, 장기요양 서식자료실을 한곳에서 찾아보세요.',
}

// 서버 화면이라 QuestionFlow(클라이언트 파일)의 색 상수 대신 같은 값을 둔다
const GREEN_DARK = '#0F6E56'
const GREEN_LIGHT = '#E8F6F4'

const CONTACT_EMAIL = 'spacex2025@naver.com'
const tel = (n: string) => `tel:${n.replace(/-/g, '')}`

export default function SettingsPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-1">
        <Link href="/" aria-label="홈으로" className="w-12 h-12 -ml-2 flex items-center justify-center text-gray-500">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-[18px] font-bold text-gray-900">설정</h1>
      </div>

      <Group title="자가진단">
        <Row href="/check/fall" icon="🧓" title="넘어질 위험 체크" sub="낙상 위험 12가지 질문 + 집 안 점검" />
        <Row href="/check/ltc" icon="📋" title="장기요양등급 예상" sub="1~5등급·인지지원등급 범위와 신청 방법" />
        <Row href="/check/cost" icon="💰" title="돌봄 비용 모의 계산" sub="방문요양·주야간보호·요양원 한 달 비용" />
      </Group>

      <Group title="돌봄 비용">
        <Row href="/check/cost" icon="🧮" title="모의 계산" sub="한 달에 본인이 내는 돈 미리 보기" />
        <details className="group">
          <summary className="flex items-center gap-3 px-4 py-3 min-h-[64px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <Icon>📊</Icon>
            <span className="flex-1 min-w-0">
              <span className="block text-[17px] font-bold text-gray-900">2026년 월 한도액·본인부담률</span>
              <span className="block text-[14px] text-gray-500 mt-0.5">눌러서 한눈에 보기</span>
            </span>
            <span className="text-gray-300 text-xl shrink-0 transition-transform group-open:rotate-90" aria-hidden="true">
              ›
            </span>
          </summary>
          <div className="px-4 pb-4">
            <p className="text-[15px] font-bold text-gray-800 mt-1">집에서 받는 서비스(재가급여) 월 한도액</p>
            <dl className="mt-1.5 rounded-xl border border-gray-100 divide-y divide-gray-100">
              {GRADE_OPTIONS.map((g) => (
                <div key={g.value} className="flex items-center justify-between px-3 py-2">
                  <dt className="text-[15px] text-gray-600">{g.label}</dt>
                  <dd className="text-[15px] font-semibold text-gray-900 tabular-nums">{won(MONTHLY_LIMIT[g.value])}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[15px] font-bold text-gray-800 mt-4">본인부담률 (집 · 요양원)</p>
            <dl className="mt-1.5 rounded-xl border border-gray-100 divide-y divide-gray-100">
              {COPAY_OPTIONS.filter((o) => o.value !== 'unknown').map((o) => (
                <div key={o.value} className="flex items-center justify-between px-3 py-2">
                  <dt className="text-[15px] text-gray-600">{o.label}</dt>
                  <dd className="text-[15px] font-semibold text-gray-900 tabular-nums">
                    {percent(o.home)} · {percent(o.facility)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-[14px] text-gray-500 mt-3 leading-relaxed">
              한도를 넘는 금액과 식비 같은 비급여는 전부 본인이 내요. 요양원은 월 한도액 없이 1일 비용으로 계산해요.
            </p>
            <p className="text-[13px] text-gray-400 mt-1.5">
              기준: {COST_BASIS.notice}({COST_BASIS.effective}) · 최종 확인 {COST_BASIS.checkedAt}
            </p>
          </div>
        </details>
      </Group>

      <Group title="서식자료실">
        <Row href="/settings/forms" icon="📂" title="서식자료실" sub={`장기요양 신청서·의사소견서 등 ${FORMS.length}종 내려받기`} />
        <div className="px-4 py-3 flex flex-wrap gap-2">
          {FORM_CATEGORIES.map((c) => (
            <Link
              key={c.key}
              href={`/settings/forms?cat=${c.key}`}
              className="min-h-[44px] px-3.5 rounded-full border text-[15px] font-semibold flex items-center"
              style={{ borderColor: '#CFE7E2', color: GREEN_DARK, background: '#F6FBFA' }}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </Group>

      <Group title="서비스">
        <Row href="/find" icon="🔎" title="부모님 상황 맞춤 찾기" sub="상황을 고르면 맞는 운동 지도를 찾아 드려요" />
        <Row href="/request" icon="📝" title="방문 요청서 남기기" sub="운영자가 가까운 전문가를 연결해 드려요" />
        <Row href="/waitlist" icon="🔔" title="사전 신청" sub="오픈 소식을 가장 먼저 받아 보세요" />
        <Row href="/mypage" icon="🧑‍⚕️" title="전문가 로그인·등록" sub="물리치료사 프로필 관리" />
      </Group>

      <Group title="도움·정보">
        <Row href={tel(PHONES.nhis.number)} icon="📞" title={`국민건강보험공단 ${PHONES.nhis.number}`} sub="장기요양 신청·등급·본인부담 상담" />
        <Row href={LINKS.blog} icon="📰" title="블로그 '보호가 필요해'" sub="장기요양·복지 제도 글 모음" external />
        <Row href={`mailto:${CONTACT_EMAIL}`} icon="✉️" title="문의하기" sub={CONTACT_EMAIL} />
        <Row href="/privacy" icon="🔒" title="개인정보처리방침" />
      </Group>

      <p className="px-6 pt-6 pb-8 text-center text-[14px] text-gray-400 leading-relaxed">
        보호가 필요해
        <br />
        몸은 물리치료사로,
        <br />
        제도는 사회복지사로 함께 봐 드립니다.
      </p>

      <BottomNav />
    </main>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-5 pt-6">
      <h2 className="text-[15px] font-bold text-gray-500 mb-2 px-1">{title}</h2>
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">{children}</div>
    </section>
  )
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px] shrink-0" style={{ background: GREEN_LIGHT }} aria-hidden="true">
      {children}
    </span>
  )
}

function Row({ href, icon, title, sub, external }: { href: string; icon: string; title: string; sub?: string; external?: boolean }) {
  const cls = 'flex items-center gap-3 px-4 py-3 min-h-[64px] active:bg-gray-50 transition-colors'
  const inner = (
    <>
      <Icon>{icon}</Icon>
      <span className="flex-1 min-w-0">
        <span className="block text-[17px] font-bold text-gray-900">{title}</span>
        {sub && <span className="block text-[14px] text-gray-500 mt-0.5">{sub}</span>}
      </span>
      <span className="text-gray-300 text-xl shrink-0" aria-hidden="true">
        {external ? '↗' : '›'}
      </span>
    </>
  )
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    )
  }
  // 내부 화면은 Link, 전화·메일은 a
  return href.startsWith('/') ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {inner}
    </a>
  )
}
