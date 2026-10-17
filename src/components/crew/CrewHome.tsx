'use client'

// 내 크루 화면 — 위: 크루 이름·미션 배지·크루 점수 / 탭: 채팅 · 질문 · 크루원 · 스코어
import { useState } from 'react'
import { CREW_MAX, type MyCrew } from '@/lib/crew'
import BottomNav from '@/components/BottomNav'
import { GREEN, GREEN_DARK } from '@/components/ConsultParts'
import { BadgeChip } from '@/components/crew/CrewParts'
import CrewChat, { NoticeBar } from '@/components/crew/CrewChat'
import CrewQuestions from '@/components/crew/CrewQuestions'
import CrewMembers from '@/components/crew/CrewMembers'
import CrewScore from '@/components/crew/CrewScore'

type Tab = 'chat' | 'qa' | 'members' | 'score'

export default function CrewHome({ data, reload }: { data: MyCrew; reload: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>('chat')
  const isLead = data.my_role === 'owner' || data.my_role === 'leader'
  const tabs: { key: Tab; label: string; badge?: number; badgeLabel?: string }[] = [
    { key: 'chat', label: '채팅' },
    { key: 'qa', label: '질문' },
    { key: 'members', label: `크루원 ${data.members.length}`, badge: isLead ? data.requests.length : 0, badgeLabel: '건의 가입 신청' },
    { key: 'score', label: '스코어' },
  ]

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="px-5 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <h1 className="flex-1 min-w-0 text-[21px] font-extrabold text-gray-900 truncate">{data.crew.name}</h1>
            <BadgeChip level={data.crew.badge_level} />
          </div>
          <p className="text-[14px] text-gray-500 mt-0.5 truncate">
            {data.crew.region ? `${data.crew.region} · ` : ''}크루원 {data.members.length}/{CREW_MAX} · 크루 점수{' '}
            <b style={{ color: GREEN_DARK }}>{Math.round(Number(data.score.total))}점</b>
          </p>
        </div>
        <div className="flex px-1" role="tablist" aria-label="크루 메뉴">
          {tabs.map((t) => {
            const on = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setTab(t.key)
                  if (t.key !== 'chat') window.scrollTo({ top: 0 })
                }}
                className="flex-1 min-h-[48px] text-[15px] font-bold border-b-[3px] flex items-center justify-center gap-1 whitespace-nowrap"
                style={{ color: on ? GREEN : '#8B95A1', borderColor: on ? GREEN : 'transparent' }}
              >
                {t.label}
                {!!t.badge && t.badge > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#F04452] text-white text-[12px] leading-5 text-center">
                    {t.badge}
                    <span className="sr-only">{t.badgeLabel}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {tab === 'chat' && <NoticeBar data={data} reload={reload} />}
      </div>

      {tab === 'chat' && <CrewChat data={data} reload={reload} />}
      {tab === 'qa' && <CrewQuestions data={data} reload={reload} />}
      {tab === 'members' && <CrewMembers data={data} reload={reload} />}
      {tab === 'score' && <CrewScore data={data} />}
      <BottomNav />
    </main>
  )
}
