'use client'

// 1분 자가진단 첫 화면 — 블로그·유튜브 링크의 첫 도착지 (설치·로그인 없이 바로)
import { useMemo } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import ShareButton from '@/components/ShareButton'
import { LAST_RESULT_KEYS, parseLastResult } from '@/lib/checks'
import { useLocalStorageItem } from '@/lib/useDeviceStorage'

const GREEN = '#0A8A7B'

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function CheckHubPage() {
  // 지난 결과 요약 (이 기기에만 저장된 값)
  const fallRaw = useLocalStorageItem(LAST_RESULT_KEYS.fall)
  const ltcRaw = useLocalStorageItem(LAST_RESULT_KEYS.ltc)
  const last = useMemo(() => ({ fall: parseLastResult(fallRaw), ltc: parseLastResult(ltcRaw) }), [fallRaw, ltcRaw])

  const cards = [
    {
      href: '/check/fall',
      title: '넘어질 위험 체크',
      sub: '낙상 위험',
      desc: '12가지 질문 + 집 안 점검',
      emoji: '🧓',
      last: last.fall,
    },
    {
      href: '/check/ltc',
      title: '장기요양등급 예상',
      sub: '1~5등급·인지지원등급',
      desc: '12가지 질문 + 신청 방법 안내',
      emoji: '📋',
      last: last.ltc,
    },
  ]

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <div className="bg-white px-5 pt-8 pb-6">
        <p className="text-[15px] font-semibold" style={{ color: '#0F6E56' }}>
          물리치료사·사회복지사가 만든
        </p>
        <h1 className="text-[26px] font-extrabold text-gray-900 leading-snug mt-1">1분 자가진단</h1>
        <p className="text-[17px] text-gray-600 mt-2 leading-relaxed">
          부모님 상태를 1분 만에 살펴보고,
          <br />
          다음에 무엇을 하면 좋을지 알려 드려요.
        </p>
      </div>

      <div className="px-5 pt-5 flex flex-col gap-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 active:scale-[0.99] transition-all"
          >
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-[30px] shrink-0" style={{ background: '#E8F6F4' }}>
              {c.emoji}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[19px] font-bold text-gray-900">{c.title}</span>
              <span className="block text-[14px] font-semibold mt-0.5" style={{ color: '#0F6E56' }}>
                {c.sub}
              </span>
              <span className="block text-[15px] text-gray-500 mt-0.5">약 1분 · {c.desc}</span>
              {c.last && (
                <span className="inline-block mt-2 text-[13px] px-2.5 py-1 rounded-md bg-gray-100 text-gray-600">
                  지난 결과({formatDate(c.last.at)}): {c.last.summary}
                </span>
              )}
            </span>
            <span className="text-gray-300 text-2xl shrink-0" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </div>

      <div className="px-5 pt-5">
        <div className="rounded-2xl bg-white border border-gray-100 p-4">
          <p className="text-[15px] text-gray-600 leading-relaxed">
            🔒 답변과 결과는 이 기기에만 남고, 서버로 보내지 않아요.
          </p>
          <p className="text-[15px] text-gray-600 leading-relaxed mt-1">
            ⓘ 자가진단은 참고용이에요. 진료나 공단의 공식 판정을 대신하지 않아요.
          </p>
        </div>
      </div>

      <div className="px-5 pt-4">
        <Link
          href="/find"
          className="w-full min-h-[56px] rounded-2xl text-[17px] font-bold text-white flex items-center justify-center"
          style={{ background: GREEN }}
        >
          부모님 운동 지도 맞춤 찾기 →
        </Link>
      </div>

      <div className="px-5 pt-3 pb-6">
        <ShareButton path="/check" title="1분 자가진단" text="부모님 낙상 위험·장기요양등급을 1분 만에 살펴볼 수 있어요" />
      </div>

      <BottomNav />
    </main>
  )
}
