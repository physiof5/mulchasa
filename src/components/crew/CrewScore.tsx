'use client'

// 스코어 탭 — 크루 스코어(크루원 평균)·등급·혜택 / 내 점수 나눠 보기 / 점수 올리는 법
import { SCORE_PARTS, TIERS, nextTier, type MyCrew } from '@/lib/crew'
import { GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'
import { TierIcon } from '@/components/crew/CrewParts'

export default function CrewScore({ data }: { data: MyCrew }) {
  const score = Number(data.score) || 0
  const next = nextTier(score)
  const mine = data.members.find((m) => m.me)?.score

  return (
    <div className="pb-8">
      <section className="mx-5 mt-4 rounded-2xl p-5 text-white" style={{ background: GREEN }}>
        <p className="text-[14px] font-semibold text-white/85">크루 스코어 (크루원 {data.members.length}명 평균)</p>
        <p className="mt-1 flex items-end gap-1">
          <span className="text-[44px] font-extrabold leading-none">{score.toFixed(1)}</span>
          <span className="text-[17px] font-bold text-white/80 pb-1">/ 100</span>
        </p>
        <div className="mt-3 h-2.5 rounded-full bg-white/25 overflow-hidden" role="img" aria-label={`100점 중 ${score.toFixed(1)}점`}>
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, score)}%` }} />
        </div>
        <p className="text-[15px] mt-3 text-white/95">
          지금 <b>{data.tier} 크루</b>
          {next ? ` · ${next.key}까지 ${(next.min - score).toFixed(1)}점` : ' · 가장 높은 등급이에요!'}
        </p>
      </section>

      <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-5">
        <h2 className="text-[17px] font-extrabold text-gray-900">등급과 혜택</h2>
        <ul className="mt-3 space-y-2.5">
          {TIERS.map((t) => {
            const on = t.key === data.tier
            return (
              <li key={t.key} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ background: on ? t.bg : undefined, outline: on ? `2px solid ${t.color}` : undefined }}>
                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: t.bg }}>
                  <TierIcon tier={t.key} size={20} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] font-bold" style={{ color: t.color }}>
                    {t.key} 크루 <span className="text-[13px] font-semibold text-gray-500">{t.min === 0 ? '시작' : `${t.min}점 이상`}</span>
                  </span>
                  <span className="block text-[14px] text-gray-600 leading-snug mt-0.5">{t.perk}</span>
                </span>
              </li>
            )
          })}
        </ul>
        <p className="text-[13px] text-gray-500 mt-3 leading-relaxed">배지는 크루원 모두의 프로필에 함께 보여요. 돈이나 수수료와는 관계없어요.</p>
      </section>

      {mine && (
        <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-extrabold text-gray-900">내 점수</h2>
            <span className="text-[22px] font-extrabold" style={{ color: GREEN_DARK }}>
              {mine.total.toFixed(1)}
              <span className="text-[14px] text-gray-400 font-bold"> /100</span>
            </span>
          </div>
          <ul className="mt-3 space-y-4">
            {SCORE_PARTS.map((p) => {
              const v = Number(mine[p.key]) || 0
              return (
                <li key={p.key}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[16px] font-bold text-gray-800">{p.label}</span>
                    <span className="text-[15px] font-bold text-gray-700">
                      {v.toFixed(1)} <span className="text-gray-400 font-semibold">/ {p.max}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (v / p.max) * 100)}%`, background: GREEN }} />
                  </div>
                  <p className="text-[13px] text-gray-500 mt-1 leading-snug">{p.how}</p>
                </li>
              )
            })}
            {!!mine.penalty && mine.penalty > 0 && (
              <li className="rounded-xl px-3 py-2.5" style={{ background: '#FEF2F2' }}>
                <p className="text-[15px] font-bold" style={{ color: '#B91C1C' }}>
                  감점 −{mine.penalty.toFixed(0)}
                </p>
                <p className="text-[13px] text-gray-600 mt-0.5 leading-snug">운영팀이 위반을 확인한 회원 신고 1건당 5점 (최근 90일, 최대 20점)</p>
              </li>
            )}
          </ul>
          <div className="mt-4 rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: GREEN_LIGHT }}>
            <span className="text-[26px]" aria-hidden="true">🤝</span>
            <span className="flex-1">
              <span className="block text-[15px] font-bold" style={{ color: GREEN_DARK }}>
                협력 포인트 {mine.points}
              </span>
              <span className="block text-[13px] text-gray-600 leading-snug">추천 연결(보냄 10 · 받음 5)과 케이스 공유(2)로 쌓여요. 돈으로 바꿀 수는 없어요.</span>
            </span>
          </div>
        </section>
      )}

      <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-5">
        <h2 className="text-[17px] font-extrabold text-gray-900">점수 올리는 법</h2>
        <ul className="mt-2 space-y-2 text-[15px] text-gray-700 leading-relaxed">
          <li>💬 새 대화가 열리면 24시간 안에 먼저 인사해요</li>
          <li>📝 10회 이상 진행한 회원에게 진행 후기 공개 동의를 받아요</li>
          <li>🤝 일정이 안 맞는 요청은 크루원을 추천해요</li>
          <li>📌 크루 채팅에 케이스를 나눠요</li>
          <li>🪪 프로필 사진·자기소개·보유 자격을 채워요</li>
        </ul>
        <p className="text-[13px] text-gray-500 mt-3 leading-relaxed">최근 90일 활동으로 매번 새로 계산해요. 기록이 없는 항목은 중간 점수로 시작해요.</p>
      </section>
    </div>
  )
}
