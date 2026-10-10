'use client'

// 알림 켜기 안내 — 홈 '진행 중인 상담', 요청 보낸 직후, 채팅 목록, 받은 요청, 설정에서 같이 씀
// 브라우저 허용 창은 사용자가 '알림 켜기'를 눌렀을 때만 띄운다(갑자기 띄우면 대부분 거절함).

import { useState } from 'react'
import { usePushState } from '@/lib/push'
import { setDeviceItem, useLocalStorageItem } from '@/lib/useDeviceStorage'

const GREEN = '#0A8A7B'
const GREEN_DARK = '#0F6E56'
const DISMISS_KEY = 'push_prompt_hidden_until'
const HIDE_DAYS = 7

function hiddenNow(until: string | null): boolean {
  return !!until && Number(until) > Date.now()
}

function hideForAWhile() {
  setDeviceItem(DISMISS_KEY, String(Date.now() + HIDE_DAYS * 86_400_000))
}

function BellIcon({ color = GREEN }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 20.5a2 2 0 0 0 4 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** 띠 모양 안내. message: 이 화면에서 알림이 왜 좋은지 한 줄 */
export function PushPrompt({ message, dismissible = true, className = '' }: { message: string; dismissible?: boolean; className?: string }) {
  const { state, busy, error, turnOn } = usePushState()
  const hiddenUntil = useLocalStorageItem(DISMISS_KEY)
  const [justOn, setJustOn] = useState(false)

  if (state === 'checking' || state === 'unsupported' || state === 'no-key') return null
  if (state === 'on') {
    return justOn ? (
      <p className={'rounded-xl px-4 py-3 text-[14px] font-semibold flex items-center gap-2 ' + className} style={{ background: '#E8F6F4', color: GREEN_DARK }}>
        <BellIcon color={GREEN_DARK} /> 알림을 켰어요. 답이 오면 바로 알려 드릴게요.
      </p>
    ) : null
  }
  if (dismissible && hiddenNow(hiddenUntil)) return null

  const close = dismissible ? (
    <button type="button" onClick={hideForAWhile} aria-label="닫기" className="w-9 h-9 -mr-1 -mt-1 flex items-center justify-center text-gray-400 shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </button>
  ) : null

  if (state === 'ios-install') {
    return (
      <div className={'rounded-xl border border-gray-200 bg-white px-4 py-3 flex gap-3 ' + className}>
        <BellIcon />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-gray-900">아이폰은 홈 화면에 추가하면 알림을 받을 수 있어요</p>
          <p className="text-[14px] text-gray-600 mt-0.5 leading-relaxed">
            사파리 아래 <b>공유 버튼</b>(네모에 위쪽 화살표) → <b>홈 화면에 추가</b> → 홈 화면의 앱으로 열고 알림을 켜 주세요.
          </p>
        </div>
        {close}
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className={'rounded-xl border border-gray-200 bg-white px-4 py-3 flex gap-3 ' + className}>
        <BellIcon color="#9CA3AF" />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-gray-900">알림이 꺼져 있어요</p>
          <p className="text-[14px] text-gray-600 mt-0.5 leading-relaxed">브라우저 주소창 왼쪽 자물쇠(또는 설정) → 알림 → 허용으로 바꾸면 받을 수 있어요.</p>
        </div>
        {close}
      </div>
    )
  }

  return (
    <div className={'rounded-xl border px-4 py-3 ' + className} style={{ borderColor: '#BFE3DC', background: '#F6FBFA' }}>
      <div className="flex gap-3">
        <BellIcon />
        <p className="flex-1 min-w-0 text-[15px] font-bold text-gray-900 leading-snug pt-0.5">{message}</p>
        {close}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          await turnOn()
          setJustOn(true)
        }}
        className="mt-2.5 w-full min-h-[48px] rounded-xl text-white text-[16px] font-bold disabled:opacity-60"
        style={{ background: GREEN }}
      >
        {busy ? '켜는 중...' : '알림 켜기'}
      </button>
      {error && <p className="text-[14px] text-red-500 mt-2">{error}</p>}
    </div>
  )
}

/** 설정 화면 한 줄 (켜기·끄기) */
export function PushSettingRow() {
  const { state, busy, error, turnOn, turnOff } = usePushState()
  const sub: Record<string, string> = {
    checking: '확인 중...',
    unsupported: '이 브라우저는 알림을 지원하지 않아요',
    'ios-install': '아이폰은 사파리 공유 → 홈 화면에 추가 뒤 켤 수 있어요',
    'no-key': '알림 준비 중이에요',
    denied: '브라우저 설정에서 알림을 허용해 주세요',
    off: '상담 수락·새 메시지·근처 새 요청을 알려 드려요',
    on: '이 기기에서 알림을 받고 있어요',
  }
  const canToggle = state === 'on' || state === 'off'
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[64px]">
      <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#E8F6F4' }} aria-hidden="true">
        <BellIcon />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[17px] font-bold text-gray-900">알림</span>
        <span className="block text-[14px] text-gray-500 mt-0.5">{sub[state]}</span>
        {error && <span className="block text-[13px] text-red-500 mt-0.5">{error}</span>}
      </span>
      {canToggle && (
        <button
          type="button"
          role="switch"
          aria-checked={state === 'on'}
          aria-label="알림 받기"
          disabled={busy}
          onClick={() => (state === 'on' ? turnOff() : turnOn())}
          className="relative w-[52px] h-[32px] rounded-full shrink-0 transition-colors disabled:opacity-60"
          style={{ background: state === 'on' ? GREEN : '#D1D5DB' }}
        >
          <span className="absolute top-[3px] w-[26px] h-[26px] rounded-full bg-white shadow transition-all" style={{ left: state === 'on' ? 23 : 3 }} />
        </button>
      )}
    </div>
  )
}
