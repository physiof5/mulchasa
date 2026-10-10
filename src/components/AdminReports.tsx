'use client'

// 관리자 — 채팅 신고 (신고 시점 최근 대화 50개와 함께 확인 → 대화 중지 / 처리 완료)

import { useCallback, useEffect, useState } from 'react'

const REASON: Record<string, string> = {
  abuse: '욕설·비방·괴롭힘',
  sexual: '성적인 말·행동',
  spam: '광고·스팸',
  money: '선입금 등 돈 요구',
  medical: '의료행위·효과 보장 약속',
  privacy: '개인정보 요구·유출',
  other: '기타',
}
const WHO: Record<string, string> = { guardian: '보호자', expert: '전문가', system: '안내', unknown: '알 수 없음' }

interface Report {
  id: string
  room_id: string | null
  reporter_role: string
  reason: string
  detail: string
  snapshot: { who: string; body: string; at: string }[]
  status: 'new' | 'done'
  created_at: string
  handled_at: string | null
  chat_rooms: { id: string; admin_blocked: boolean; blocked_by: string | null; therapists: { name: string } | null } | null
}

export default function AdminReports({ onAuthLost }: { onAuthLost: () => void }) {
  const [status, setStatus] = useState<'new' | 'done'>('new')
  const [list, setList] = useState<Report[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (s: 'new' | 'done') => {
      const res = await fetch(`/api/admin-reports?status=${s}`, { cache: 'no-store' })
      if (res.status === 401) return onAuthLost()
      const j = await res.json().catch(() => ({}))
      setError(res.ok ? '' : j.error || '불러오지 못했어요')
      setList(j.reports ?? [])
    },
    [onAuthLost]
  )

  useEffect(() => {
    let alive = true
    fetch(`/api/admin-reports?status=${status}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!alive) return
        if (res.status === 401) return onAuthLost()
        const j = await res.json().catch(() => ({}))
        setError(res.ok ? '' : j.error || '불러오지 못했어요')
        setList(j.reports ?? [])
      })
      .catch(() => alive && setList([]))
    return () => {
      alive = false
    }
  }, [status, onAuthLost])

  const act = async (id: string, action: 'done' | 'reopen' | 'stop_room' | 'resume_room') => {
    const confirmText: Record<string, string> = {
      stop_room: '이 대화방을 중지할까요? 두 사람 모두 메시지를 보낼 수 없게 돼요.',
      resume_room: '중지한 대화방을 다시 열까요?',
      done: '처리 완료로 옮길까요? (처리 후 1년 뒤 자동 삭제)',
      reopen: '다시 확인 필요로 옮길까요?',
    }
    if (!confirm(confirmText[action])) return
    setBusy(true)
    const res = await fetch('/api/admin-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    setBusy(false)
    if (res.status === 401) return onAuthLost()
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return alert(j.error || '처리하지 못했어요')
    }
    load(status)
  }

  return (
    <div className="px-5 py-4">
      <div className="flex gap-2 mb-4">
        {(
          [
            ['new', '확인 필요'],
            ['done', '처리 완료'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              setList(null)
              setStatus(k)
            }}
            className={'px-4 py-2 rounded-full text-sm font-bold ' + (status === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500')}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-3 leading-relaxed">
        신고 내용은 운영 목적에만 써 주세요. 이 화면을 열 때 보관 기간이 지난 대화·요청서도 함께 정리돼요.
      </p>
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      {list === null ? (
        <p className="text-center text-gray-400 py-12">불러오는 중...</p>
      ) : list.length === 0 ? (
        <p className="text-center text-gray-400 py-12">{status === 'new' ? '확인할 신고가 없어요' : '처리한 신고가 없어요'}</p>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const room = r.chat_rooms
            return (
              <div key={r.id} className="border border-gray-200 rounded-2xl p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleString('ko-KR')} · {WHO[r.reporter_role] ?? r.reporter_role}가 신고
                      {room?.therapists?.name ? ` · 전문가 ${room.therapists.name}` : ''}
                    </p>
                    <p className="font-bold text-gray-900 mt-0.5">{REASON[r.reason] ?? r.reason}</p>
                    {r.detail && <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{r.detail}</p>}
                  </div>
                  {room?.admin_blocked && <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 shrink-0">대화 중지됨</span>}
                  {!room && <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 shrink-0">대화방 삭제됨</span>}
                </div>

                <button onClick={() => setOpen(open === r.id ? null : r.id)} className="mt-2 text-sm font-semibold text-[#0A8A7B]">
                  {open === r.id ? '대화 접기' : `신고 당시 대화 보기 (${r.snapshot.length}개)`}
                </button>
                {open === r.id && (
                  <div className="mt-2 rounded-xl bg-gray-50 p-3 space-y-1.5 max-h-[420px] overflow-y-auto">
                    {r.snapshot.map((m, i) => (
                      <p key={i} className="text-sm leading-relaxed">
                        <span className={'font-bold ' + (m.who === 'expert' ? 'text-[#0F6E56]' : m.who === 'guardian' ? 'text-blue-700' : 'text-gray-400')}>{WHO[m.who] ?? m.who}</span>{' '}
                        <span className="text-xs text-gray-400">{new Date(m.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <br />
                        <span className="text-gray-800 whitespace-pre-wrap">{m.body}</span>
                      </p>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  {room &&
                    (room.admin_blocked ? (
                      <button disabled={busy} onClick={() => act(r.id, 'resume_room')} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 disabled:opacity-50">
                        대화 다시 열기
                      </button>
                    ) : (
                      <button disabled={busy} onClick={() => act(r.id, 'stop_room')} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-100 disabled:opacity-50">
                        대화 중지
                      </button>
                    ))}
                  {r.status === 'new' ? (
                    <button disabled={busy} onClick={() => act(r.id, 'done')} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#0A8A7B] text-white disabled:opacity-50">
                      처리 완료
                    </button>
                  ) : (
                    <button disabled={busy} onClick={() => act(r.id, 'reopen')} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 disabled:opacity-50">
                      다시 확인 필요
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
