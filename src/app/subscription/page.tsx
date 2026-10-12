'use client'

// 전문가 모드 '구독 관리' — 지금 상태와 구독으로 할 수 있는 것
// 시범 기간: 운영자가 관리자 화면에서 켜 줌(무료). 정기결제는 시범 오픈 뒤.

import BottomNav from '@/components/BottomNav'
import { TopBar, Spinner, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'
import { CONTACT_EMAIL, MAX_ACCEPT, untilLabel } from '@/lib/consult'
import { useAppMode } from '@/lib/mode'

export default function SubscriptionPage() {
  const { ready, expert } = useAppMode()
  const on = !!expert?.subscribed
  const mail = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('[구독 신청] ' + (expert?.name ?? ''))}&body=${encodeURIComponent('성함:\n활동 지역:\n연락받을 방법:\n')}`

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <TopBar title="구독 관리" backHref="/" />
      {!ready ? (
        <Spinner />
      ) : (
        <>
          <section className="mx-5 mt-5 rounded-2xl p-5" style={{ background: on ? GREEN : '#1F2937' }}>
            <p className="text-[14px] font-semibold text-white/80">지금 상태</p>
            <p className="text-[24px] font-extrabold text-white mt-1">{on ? '구독 중' : '구독이 꺼져 있어요'}</p>
            <p className="text-[15px] text-white/90 mt-1">
              {on
                ? expert?.subscribed_until
                  ? `${untilLabel(expert.subscribed_until)}까지 이용할 수 있어요`
                  : '이용할 수 있어요'
                : expert?.subscribed_until
                  ? `${untilLabel(expert.subscribed_until)}에 끝났어요`
                  : '구독하면 근처 상담 요청을 수락할 수 있어요'}
            </p>
          </section>

          <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-5">
            <h2 className="text-[17px] font-extrabold text-gray-900">구독하면</h2>
            <ul className="mt-3 space-y-2.5">
              {[
                `근처 무료 상담 요청을 수락하고 채팅을 시작해요 (요청서 1건에 ${MAX_ACCEPT}명까지)`,
                '새 상담 요청이 오면 알림으로 받아요',
                '구독이 끝나도 이미 시작한 채팅은 계속할 수 있어요',
              ].map((t) => (
                <li key={t} className="flex gap-2.5 text-[15px] text-gray-700 leading-relaxed">
                  <span className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0" style={{ background: GREEN_LIGHT, color: GREEN_DARK }} aria-hidden="true">
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-gray-400 mt-4 leading-relaxed">
              요청 연결·성사 건마다 수수료를 받지 않아요. 구독은 정해진 기간 단위로만 운영해요.
            </p>
          </section>

          <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-5">
            <h2 className="text-[17px] font-extrabold text-gray-900">시범 기간 안내</h2>
            <p className="text-[15px] text-gray-600 mt-2 leading-relaxed">
              지금은 시범 기간이라 운영팀이 직접 구독을 켜 드려요(무료). 정기결제는 시범 오픈 뒤에 열려요.
            </p>
            <a href={mail} className="mt-4 flex min-h-[52px] rounded-xl text-white text-[16px] font-bold items-center justify-center" style={{ background: GREEN }}>
              {on ? '구독 연장 문의하기' : '구독 신청하기 (메일)'}
            </a>
            <p className="text-[13px] text-gray-400 mt-2 text-center">{CONTACT_EMAIL}</p>
          </section>
        </>
      )}
      <BottomNav />
    </main>
  )
}
