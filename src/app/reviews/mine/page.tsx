'use client'

// 내 진행 후기
// · 전문가: 내가 쓴 후기 (회원 확인 중 · 공개 중 · 공개 안 함 · 숨김)
// · 회원: 나에게 온 공개 동의 요청

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuthUser } from '@/lib/auth'
import { useAppMode } from '@/lib/mode'
import { reviewError, statusInfo, type MyReviewItem } from '@/lib/reviews'
import BottomNav from '@/components/BottomNav'
import { TopBar, LoginNeeded, Spinner, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'

export default function MyReviewsPage() {
  const user = useAuthUser()
  const { mode } = useAppMode()
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <TopBar title={mode === 'expert' ? '진행 후기 관리' : '받은 후기 요청'} backHref={mode === 'expert' ? '/' : '/mypage'} />
      {user === null ? (
        <LoginNeeded title={'로그인하면\n진행 후기를 볼 수 있어요'} desc="내가 쓴 후기와 나에게 온 공개 요청을 모아 보여 드려요." next="/reviews/mine" />
      ) : user === undefined ? (
        <Spinner />
      ) : (
        <List expertMode={mode === 'expert'} />
      )}
      <BottomNav />
    </main>
  )
}

function List({ expertMode }: { expertMode: boolean }) {
  const [items, setItems] = useState<MyReviewItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    supabase.rpc('my_case_reviews').then(({ data, error: e }) => {
      if (!alive) return
      if (e) setError(reviewError(e, '불러오지 못했어요.'))
      setItems(Array.isArray(data) ? (data as MyReviewItem[]) : [])
    })
    return () => {
      alive = false
    }
  }, [])

  if (items === null) return <Spinner />

  const mine = items.filter((i) => i.role === 'expert')
  const asked = items.filter((i) => i.role === 'member')
  const pendingAsked = asked.filter((i) => i.status === 'pending').length
  const groups = expertMode
    ? [
        { title: '내가 쓴 후기', list: mine, empty: true },
        { title: '나에게 온 공개 요청', list: asked, empty: false },
      ]
    : [
        { title: '나에게 온 공개 요청', list: asked, empty: true },
        { title: '내가 쓴 후기', list: mine, empty: false },
      ]

  return (
    <div className="pb-6">
      {error && <p className="mx-5 mt-4 text-[14px] text-red-500">{error}</p>}
      {expertMode && (
        <section className="mx-5 mt-4 rounded-2xl p-4" style={{ background: GREEN_LIGHT }}>
          <p className="text-[16px] font-bold" style={{ color: GREEN_DARK }}>
            진행 후기는 이렇게 써요
          </p>
          <ol className="mt-1.5 space-y-1 text-[14px] text-gray-700 leading-relaxed list-decimal pl-5">
            <li>회원과 10회 이상 운동 지도를 진행해요</li>
            <li>그 회원과의 채팅방 › 오른쪽 위 메뉴 › ‘진행 후기 쓰기’</li>
            <li>양식을 채우고 사진 2~5장을 모자이크해서 올려요</li>
            <li>회원이 공개에 동의하면 내 프로필에 보여요</li>
          </ol>
        </section>
      )}
      {!expertMode && pendingAsked > 0 && (
        <p className="mx-5 mt-4 rounded-xl px-4 py-3 text-[15px] font-semibold" style={{ background: '#FFF4E5', color: '#B45309' }}>
          확인을 기다리는 후기가 {pendingAsked}건 있어요
        </p>
      )}

      {groups.map((g) =>
        g.list.length === 0 && !g.empty ? null : (
          <section key={g.title} className="mx-5 mt-5">
            <h2 className="text-[17px] font-extrabold text-gray-900">
              {g.title} {g.list.length > 0 && <span className="text-gray-400">{g.list.length}</span>}
            </h2>
            {g.list.length === 0 ? (
              <p className="text-[15px] text-gray-500 text-center py-10 leading-relaxed">
                {g.title === '내가 쓴 후기' ? '아직 쓴 후기가 없어요.' : '아직 받은 요청이 없어요.'}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {g.list.map((it) => {
                  const st = statusInfo(it.status, it.hidden_by)
                  return (
                    <li key={it.id}>
                      <Link href={`/reviews/${it.id}`} className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-3 active:bg-gray-50">
                        <span className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                          {it.photo && <img src={it.photo} alt="" className="w-full h-full object-cover" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[16px] font-bold text-gray-900 truncate">
                            {it.member_label} · {it.age_band}
                          </span>
                          <span className="block text-[14px] text-gray-500 truncate">
                            {it.role === 'member' ? `${it.therapist_name} 물리치료사 · ` : ''}
                            {it.sessions}회 · {new Date(it.published_at ?? it.submitted_at).toLocaleDateString('ko-KR')}
                          </span>
                          <span className="inline-flex mt-1 items-center min-h-[24px] px-2 rounded-md text-[12px] font-bold" style={{ background: st.bg, color: st.color }}>
                            {it.role === 'member' && it.status === 'pending' ? '내 확인이 필요해요' : st.label}
                          </span>
                        </span>
                        <span className="text-gray-300 text-xl shrink-0" aria-hidden="true">
                          ›
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      )}
      {expertMode && (
        <div className="mx-5 mt-6">
          <Link href="/chat" className="flex min-h-[52px] rounded-xl text-white text-[16px] font-bold items-center justify-center" style={{ background: GREEN }}>
            채팅방에서 후기 쓰기
          </Link>
        </div>
      )}
    </div>
  )
}
