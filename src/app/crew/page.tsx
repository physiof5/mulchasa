// 전문가 모드 '크루' — 설계 확정 전 안내 화면
// 계획: 크루 만들기·가입(최대 10명, 대표 1·부대표 2) / 크루 채팅·케이스 공유 / 일정이 안 될 때 크루원 추천 연결 / 크루 스코어·혜택

import ComingSoon from '@/components/ComingSoon'

export default function CrewPage() {
  return (
    <ComingSoon
      title="크루"
      headline={'함께 일하는 물리치료사 모임,\n크루가 곧 열려요'}
      lines={[
        '최대 10명이 한 크루가 되고, 대표 1명과 부대표 2명이 크루를 이끌어요.',
        '크루 채팅에서 케이스를 나누고, 일정이 안 맞는 요청은 크루원을 추천해 회원과 이어 줄 수 있어요.',
        '크루 활동이 쌓이면 크루 스코어가 올라가고, 크루원 모두 혜택을 받아요.',
      ]}
      action={{ label: '스케줄 관리하기', href: '/schedule' }}
      icon={
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3" stroke="#0A8A7B" strokeWidth="1.8" />
          <path d="M6.5 20c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" stroke="#0A8A7B" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M5 11.5a2.2 2.2 0 1 1 .6-4.3M19 11.5a2.2 2.2 0 1 0-.6-4.3" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      }
    />
  )
}
