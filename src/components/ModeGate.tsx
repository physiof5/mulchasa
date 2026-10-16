'use client'

// 모드에 맞지 않는 화면을 열었을 때 안내 (모든 화면을 감쌈)
// · 전문가 모드 + 회원 전용 화면(자가진단·서식자료·제도 소식·전문가 찾기 등) → '회원 모드로 전환해서 보기'
// · 회원 모드 + 전문가 전용 화면(스케줄·크루·구독·후기 쓰기) → '전문가 모드로 전환' (전문가가 아니면 '전문가로 가입하기')

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import BottomNav from '@/components/BottomNav'
import { EXPERT_ONLY_PATHS, MEMBER_ONLY_PATHS, matchPath, setAppMode, useAppMode } from '@/lib/mode'

const GREEN = '#0A8A7B'
const GREEN_DARK = '#0F6E56'
const GREEN_LIGHT = '#E8F6F4'

export default function ModeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/'
  const { mode, ready, canExpert } = useAppMode()

  if (mode === 'expert' && matchPath(pathname, MEMBER_ONLY_PATHS)) return <Gate kind="member" />
  if (ready && mode !== 'expert' && matchPath(pathname, EXPERT_ONLY_PATHS)) return <Gate kind={canExpert ? 'expert' : 'join'} />
  return <>{children}</>
}

function Gate({ kind }: { kind: 'member' | 'expert' | 'join' }) {
  const text = {
    member: {
      title: '회원 모드 화면이에요',
      body: '전문가 모드에서는 업무 화면만 보여요. 자가진단·서식자료·제도 소식·전문가 찾기는 회원 모드에서 볼 수 있어요.',
    },
    expert: {
      title: '전문가 모드 화면이에요',
      body: '스케줄·크루·구독 관리와 진행 후기 쓰기는 전문가 모드에서 쓸 수 있어요.',
    },
    join: {
      title: '전문가 회원만 쓸 수 있어요',
      body: '물리치료사라면 카카오 로그인 뒤 전문가로 가입해 주세요. 면허 확인 후 쓸 수 있어요.',
    },
  }[kind]

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <section className="px-6 pt-20 text-center">
        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{ background: GREEN_LIGHT }} aria-hidden="true">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            <path d="M7 7h11l-3-3M17 17H6l3 3" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-[22px] font-extrabold text-gray-900 mt-5">{text.title}</h1>
        <p className="text-[16px] text-gray-600 mt-2 leading-relaxed">{text.body}</p>
        <div className="mt-8 flex flex-col gap-2.5">
          {kind === 'join' ? (
            <Link href="/register" className="min-h-[56px] rounded-2xl text-white text-[17px] font-bold flex items-center justify-center" style={{ background: GREEN }}>
              전문가로 가입하기
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setAppMode(kind === 'member' ? 'member' : 'expert')}
              className="min-h-[56px] rounded-2xl text-white text-[17px] font-bold"
              style={{ background: GREEN }}
            >
              {kind === 'member' ? '회원 모드로 전환해서 보기' : '전문가 모드로 전환'}
            </button>
          )}
          <Link href="/" className="min-h-[52px] rounded-2xl bg-white border border-gray-200 text-[16px] font-semibold flex items-center justify-center" style={{ color: GREEN_DARK }}>
            홈으로
          </Link>
        </div>
      </section>
      <BottomNav />
    </main>
  )
}
