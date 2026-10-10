'use client'

// 하단 탭 '채팅' — 상담을 수락한 전문가(보호자 화면) / 수락한 상담의 보호자(전문가 화면)와의 대화 목록
// 새 메시지가 오면 실시간으로 목록을 다시 읽고, 창으로 돌아올 때도 다시 읽는다.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuthUser } from '@/lib/auth'
import BottomNav from '@/components/BottomNav'
import { PushPrompt } from '@/components/PushPrompt'
import { Avatar, GuardianAvatar, LoginNeeded, Spinner, GREEN } from '@/components/ConsultParts'
import { MAX_ACCEPT, ageText, consultTitle, listTime, type ConsultAnswers } from '@/lib/consult'

interface RoomRow {
  id: string
  role: 'guardian' | 'expert'
  therapist: { id: string; name: string; photo: string | null; years: number | null }
  consult: { id: string; who: ConsultAnswers['who']; age: ConsultAnswers['age']; area_label: string } | null
  last_message: string
  last_message_at: string
  unread: number
  blocked: boolean
}

export default function ChatListPage() {
  const user = useAuthUser()
  const [rooms, setRooms] = useState<RoomRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [onlyUnread, setOnlyUnread] = useState(false)

  useEffect(() => {
    if (!user) return
    let alive = true
    const load = () =>
      supabase.rpc('my_chat_rooms').then(({ data, error }) => {
        if (!alive) return
        setFailed(!!error)
        setRooms(Array.isArray(data) ? (data as RoomRow[]) : [])
      })
    load()
    // 내 대화방의 새 메시지만 전달됨 (읽기 권한 규칙)
    const channel = supabase
      .channel(`chat-list-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => load())
      .subscribe()
    window.addEventListener('focus', load)
    const timer = window.setInterval(load, 30_000)
    return () => {
      alive = false
      supabase.removeChannel(channel)
      window.removeEventListener('focus', load)
      window.clearInterval(timer)
    }
  }, [user])

  const shown = (rooms ?? []).filter((r) => !onlyUnread || r.unread > 0)
  const unreadRooms = (rooms ?? []).filter((r) => r.unread > 0).length

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white px-5 pt-3 pb-2">
        <div className="flex items-center">
          <h1 className="flex-1 text-[22px] font-extrabold text-gray-900">채팅</h1>
          <Link href="/mypage" aria-label="내 프로필" className="w-12 h-12 -mr-2 flex items-center justify-center text-gray-700">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
              <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
        {user && rooms && rooms.length > 0 && (
          <div className="flex gap-2 pt-2">
            {[
              { on: false, label: '전체' },
              { on: true, label: `안 읽음${unreadRooms ? ` ${unreadRooms}` : ''}` },
            ].map((c) => (
              <button
                key={c.label}
                type="button"
                aria-pressed={onlyUnread === c.on}
                onClick={() => setOnlyUnread(c.on)}
                className="min-h-[40px] px-4 rounded-full border text-[15px] font-semibold"
                style={onlyUnread === c.on ? { background: '#1F2937', borderColor: '#1F2937', color: '#fff' } : { background: '#fff', borderColor: '#E5E7EB', color: '#4B5563' }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {user === null ? (
        <LoginNeeded
          title={'로그인하면\n전문가와 채팅할 수 있어요'}
          desc={`상담 요청을 보내면 가까운 전문가 최대 ${MAX_ACCEPT}명이 수락하고, 여기서 무료로 대화해요. 전화번호를 알려 주지 않아도 돼요.`}
          next="/chat"
        />
      ) : user === undefined || rooms === null ? (
        <Spinner />
      ) : failed ? (
        <p className="px-5 pt-10 text-center text-[15px] text-gray-500">대화 목록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
      ) : rooms.length === 0 ? (
        <section className="px-6 pt-14 text-center">
          <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#E8F6F4' }} aria-hidden="true">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5v-9Z" stroke={GREEN} strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-[20px] font-extrabold text-gray-900 mt-5">아직 대화가 없어요</p>
          <p className="text-[15px] text-gray-600 mt-2 leading-relaxed">
            상담 요청을 보내면 수락한 전문가와의 대화방이 여기에 생겨요.
            <br />
            전문가라면 &lsquo;받은 요청&rsquo;에서 상담을 수락해 보세요.
          </p>
          <Link href="/consult/new" className="mt-7 inline-flex min-h-[52px] px-6 rounded-xl text-white text-[16px] font-bold items-center" style={{ background: GREEN }}>
            무료 상담 요청하기
          </Link>
        </section>
      ) : shown.length === 0 ? (
        <p className="px-5 pt-10 text-center text-[15px] text-gray-500">안 읽은 대화가 없어요.</p>
      ) : (
        <>
        <PushPrompt className="mx-5 mt-2" message="새 메시지가 오면 알림으로 알려 드릴까요?" />
        <ul className="pt-1">
          {shown.map((r) => {
            const isGuardian = r.role === 'guardian'
            const title = isGuardian ? r.therapist.name : r.consult ? `${consultTitle(r.consult)} (${ageText(r.consult.age)})` : '보호자'
            const sub = isGuardian
              ? `물리치료사${r.therapist.years ? ` · 경력 ${r.therapist.years}년` : ''}${r.consult ? ` · ${consultTitle(r.consult)}` : ''}`
              : `보호자${r.consult?.area_label ? ` · ${r.consult.area_label}` : ''}`
            return (
              <li key={r.id}>
                <Link href={`/chat/${r.id}`} className="flex gap-3.5 px-5 py-4 active:bg-gray-50">
                  {isGuardian ? <Avatar src={r.therapist.photo} name={r.therapist.name} size={56} /> : <GuardianAvatar size={56} />}
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="flex-1 min-w-0 text-[17px] font-extrabold text-gray-900 truncate">{title}</span>
                      <span className="text-[13px] text-gray-400 shrink-0">{listTime(r.last_message_at)}</span>
                    </span>
                    <span className="block text-[14px] text-gray-500 truncate">{sub}</span>
                    <span className="flex items-center gap-2 mt-1">
                      <span className="flex-1 min-w-0 text-[15px] truncate" style={{ color: r.unread > 0 ? '#111827' : '#6B7280' }}>
                        {r.blocked ? '차단된 대화예요' : r.last_message}
                      </span>
                      {r.unread > 0 && (
                        <span className="min-w-[24px] h-[24px] px-1.5 rounded-full bg-[#F04452] text-white text-[13px] font-bold flex items-center justify-center shrink-0">
                          {r.unread > 99 ? '99+' : r.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        </>
      )}
      {rooms && rooms.length > 0 && (
        <p className="px-5 pt-6 pb-2 text-[13px] text-gray-400 text-center">대화는 마지막 메시지 후 180일이 지나면 자동으로 지워져요.</p>
      )}
      <BottomNav />
    </main>
  )
}
