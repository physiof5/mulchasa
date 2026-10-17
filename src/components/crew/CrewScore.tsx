'use client'

// 스코어 탭 — 크루 점수(크루원 합산 + 크루 활동) · 월간 미션 배지 · 내 점수
import { BADGES, MISSION_PARTS, SCORE_PARTS, badgeInfo, type MyCrew } from '@/lib/crew'
import { GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'
import { BadgeChip, BadgeIcon, HeartCount } from '@/components/crew/CrewParts'

function daysLeftInMonth(monthIso: string): number {
  const [y, m] = monthIso.split('-').map(Number)
  const end = new Date(y, m, 1) // 다음 달 1일 (이 기기 시간대)
  const today = new Date()
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000))
}

export default function CrewScore({ data }: { data: MyCrew }) {
  const mine = data.members.find((m) => m.me)
  const level = data.crew.badge_level
  const { target, actual } = data.mission
  const parts = MISSION_PARTS.map((p) => ({ ...p, t: target[p.key], a: actual[p.key], r: Math.min(1, actual[p.key] / Math.max(1, target[p.key])) }))
  const progress = parts.reduce((n, p) => n + p.r, 0) / parts.length
  const pct = Math.round(progress * 100)
  const goal = badgeInfo(target.level)
  const left = daysLeftInMonth(data.mission.month)
  const status =
    progress >= 1
      ? level === 1
        ? '이번 달 미션 달성! 보라 배지를 지켜요.'
        : `이번 달 미션 달성! 다음 달 1일에 ${goal?.label} 배지로 올라가요.`
      : progress >= 0.5
        ? level === 0
          ? `절반을 넘었어요. 끝까지 달성하면 ${goal?.label} 배지를 받아요.`
          : '지금 배지는 지킬 수 있어요. 끝까지 달성하면 한 단계 올라가요.'
        : level === 0
          ? `목표를 모두 채우면 ${goal?.label} 배지를 받아요.`
          : '절반을 넘기지 못하면 다음 달에 한 단계 내려가요.'

  return (
    <div className="pb-8">
      {/* 크루 점수 */}
      <section className="mx-5 mt-4 rounded-2xl p-5 text-white" style={{ background: GREEN }}>
        <p className="text-[14px] font-semibold text-white/85">크루 점수</p>
        <p className="text-[44px] font-extrabold leading-none mt-1">{Math.round(Number(data.score.total))}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/15 px-3 py-2">
            <p className="text-[12px] text-white/80">크루원 점수 합산</p>
            <p className="text-[18px] font-extrabold">{Math.round(Number(data.score.members))}</p>
          </div>
          <div className="rounded-xl bg-white/15 px-3 py-2">
            <p className="text-[12px] text-white/80">크루 활동 (90일)</p>
            <p className="text-[18px] font-extrabold">{Math.round(Number(data.score.activity))}</p>
          </div>
        </div>
        <p className="text-[13px] text-white/90 mt-3 leading-relaxed">평균이 아니라 합산이에요. 함께하는 크루원이 늘고 서로 도울수록 올라가요. 크루를 떠난 분의 활동 기록도 크루에 남아요.</p>
      </section>

      {/* 월간 미션 */}
      <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-5">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-[17px] font-extrabold text-gray-900">이번 달 미션</h2>
          <span className="text-[13px] text-gray-500">{left}일 남음</span>
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-[14px] text-gray-600">지금</span>
          <BadgeChip level={level} />
          {goal && level !== 1 && (
            <>
              <span className="text-gray-300">→</span>
              <span className="text-[14px] text-gray-600">목표</span>
              <BadgeChip level={goal.level} />
            </>
          )}
        </div>
        <ul className="mt-4 space-y-3.5">
          {parts.map((p) => (
            <li key={p.key}>
              <div className="flex items-baseline justify-between">
                <span className="text-[16px] font-bold text-gray-800">{p.label}</span>
                <span className="text-[15px] font-bold" style={{ color: p.a >= p.t ? GREEN_DARK : '#374151' }}>
                  {p.a} / {p.t}
                  {p.a >= p.t && ' ✓'}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
                <div className="h-full rounded-full" style={{ width: `${p.r * 100}%`, background: p.a >= p.t ? GREEN : goal?.color ?? GREEN }} />
              </div>
              <p className="text-[12px] text-gray-500 mt-1">{p.how}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-xl px-4 py-3" style={{ background: progress >= 0.5 ? GREEN_LIGHT : '#FFF7ED' }}>
          <p className="text-[15px] font-bold" style={{ color: progress >= 0.5 ? GREEN_DARK : '#B45309' }}>
            달성률 {pct}%
          </p>
          <p className="text-[13px] text-gray-700 mt-0.5 leading-snug">{status}</p>
        </div>
        <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">
          매달 1일에 정산해요 · 100% 달성 → 한 단계 위 · 50% 이상 → 그대로 · 50% 미만 → 한 단계 아래. 목표는 단계가 오를수록 늘고, 크루원이 5명 이상이면 1.5배, 8명 이상이면 2배예요.
        </p>
      </section>

      {/* 배지 단계 */}
      <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-5">
        <h2 className="text-[17px] font-extrabold text-gray-900">배지 단계</h2>
        <div className="mt-4 flex flex-col items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((lv, i) => {
            const b = BADGES[lv]
            const on = lv === level
            return (
              <div
                key={lv}
                className="min-h-[44px] rounded-lg flex items-center justify-center gap-1.5 text-white text-[14px] font-bold px-2"
                style={{ width: `${44 + i * 14}%`, background: b.color, outline: on ? '3px solid #111827' : undefined, outlineOffset: 2, opacity: level === 0 || lv >= level ? 1 : 0.45 }}
              >
                <span className="text-[15px] font-extrabold">{lv}</span>
                {b.label}
                {on && <span className="text-[12px] font-bold bg-white/25 rounded px-1">지금</span>}
              </div>
            )
          })}
        </div>
        <ul className="mt-4 space-y-1.5">
          {[5, 4, 3, 2, 1].map((lv) => (
            <li key={lv} className="flex items-center gap-2 text-[14px] text-gray-700">
              <BadgeIcon level={lv} size={18} />
              <b style={{ color: BADGES[lv].color }}>{BADGES[lv].label}</b>
              <span className="text-gray-500">{BADGES[lv].rule}</span>
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-gray-500 mt-3 leading-relaxed">배지는 크루원 모두의 프로필에 함께 보이고, 단계가 높은 크루가 크루 찾기 맨 위에 보여요. 돈이나 단가와는 관계없어요.</p>
        {data.mission.history.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-[14px] font-bold text-gray-700">지난 미션</p>
            <ul className="mt-1.5 space-y-1">
              {data.mission.history.map((h) => (
                <li key={h.month} className="flex items-center gap-2 text-[14px] text-gray-600">
                  <span className="w-[64px] tabular-nums">{h.month.slice(0, 7).replace('-', '.')}</span>
                  <span className="w-[48px]">{Math.round(Number(h.progress) * 100)}%</span>
                  <span className="flex-1">{h.result === 'up' ? '⬆ 올라감' : h.result === 'keep' ? '유지' : h.result === 'down' ? '⬇ 내려감' : '—'}</span>
                  <BadgeChip level={h.level_after} plain />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 내 점수 */}
      {mine && (
        <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-extrabold text-gray-900">내 점수</h2>
            <span className="text-[22px] font-extrabold" style={{ color: GREEN_DARK }}>
              {Number(mine.score.total).toFixed(1)}
              <span className="text-[14px] text-gray-400 font-bold"> /100</span>
            </span>
          </div>
          <ul className="mt-3 space-y-4">
            {SCORE_PARTS.map((p) => {
              const v = Number(mine.score[p.key]) || 0
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
            {!!mine.score.penalty && mine.score.penalty > 0 && (
              <li className="rounded-xl px-3 py-2.5" style={{ background: '#FEF2F2' }}>
                <p className="text-[15px] font-bold" style={{ color: '#B91C1C' }}>
                  감점 −{Number(mine.score.penalty).toFixed(0)}
                </p>
                <p className="text-[13px] text-gray-600 mt-0.5 leading-snug">운영팀이 위반을 확인한 회원 신고 1건당 5점 (최근 90일, 최대 20점)</p>
              </li>
            )}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl px-3 py-3" style={{ background: GREEN_LIGHT }}>
              <p className="text-[13px] text-gray-600">🤝 협력 포인트</p>
              <p className="text-[20px] font-extrabold" style={{ color: GREEN_DARK }}>
                {mine.score.points}
              </p>
            </div>
            <div className="rounded-xl px-3 py-3 bg-rose-50">
              <p className="text-[13px] text-gray-600">받은 좋아요</p>
              <p className="text-[20px]">
                <HeartCount n={mine.hearts} size={18} />
              </p>
            </div>
          </div>
          <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">협력 포인트는 추천 연결(보냄 10 · 받음 5) · 도움 채택 4 · 버디 성장 6 · 케이스 공유 2로 쌓여요. 돈으로 바꿀 수 없어요.</p>
        </section>
      )}

      <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-5">
        <h2 className="text-[17px] font-extrabold text-gray-900">점수 올리는 법</h2>
        <ul className="mt-2 space-y-2 text-[15px] text-gray-700 leading-relaxed">
          <li>💬 새 대화가 열리면 24시간 안에 먼저 인사해요</li>
          <li>📝 회원의 처음 상태 → 운동 지도 → 변화를 진실하게 기록해요 (회원이 ‘진행 완료’를 누른 10회가 있으면 더 좋아요)</li>
          <li>🙋 크루원의 ‘도와주세요’ 질문에 경험을 나눠요</li>
          <li>🤝 일정이 안 맞는 요청은 크루원을 추천해요</li>
          <li>🧑‍🤝‍🧑 신입 크루원의 버디가 되어 요청을 넘겨주고, 인수인계 메모·질문 답으로 첫 상담·첫 후기까지 도와요</li>
        </ul>
      </section>
    </div>
  )
}
