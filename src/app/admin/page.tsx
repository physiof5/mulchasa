'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminMagazine from '@/components/AdminMagazine'
import AdminReports from '@/components/AdminReports'
import { practitionerLabel, workTypeLabels } from '@/lib/practitioner'

interface Therapist {
  id: string
  name: string
  license_number: string
  years_experience: number
  practitioner_type: string
  hospital_name: string | null
  studio_name: string | null
  phone: string
  kakao_link: string
  intro: string
  verification_status: string
  created_at: string
  work_types?: string[] | null
  license_photo_url?: string | null
  license_checked_at?: string | null
  subscribed_until?: string | null
}

/** 구독 중인지 (한국 날짜 기준) */
function subscribedNow(until?: string | null): boolean {
  if (!until) return false
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  return until >= today
}

// 관리자 목록은 서버(관리자 쿠키 확인)에서만 가져옴
async function loadList(status: string): Promise<Therapist[]> {
  try {
    const res = await fetch(`/api/admin-action?status=${status}`, { cache: 'no-store' })
    if (!res.ok) return []
    const json = await res.json()
    return json.therapists ?? []
  } catch {
    return []
  }
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [loading, setLoading] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'pending' | 'verified' | 'rejected'>('pending')
  const [section, setSection] = useState<'experts' | 'magazine' | 'reports'>('experts')
  const onAuthLost = useCallback(() => {
    alert('세션이 만료되었습니다. 다시 로그인해주세요.')
    setAuthenticated(false)
  }, [])
  // 면허증 사진 속 이름·번호를 가입 정보와 맞춰 봤는지 (체크해야 승인 버튼이 켜짐)
  const [matched, setMatched] = useState<Record<string, boolean>>({})

  // 진입 시 기존 쿠키 세션 확인 (sessionStorage 같은 조작 가능한 플래그 사용 안 함)
  useEffect(() => {
    fetch('/api/admin-login')
      .then(r => r.json())
      .then(d => setAuthenticated(!!d.authenticated))
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

  const handleLogin = async () => {
    if (!password) return
    setLoggingIn(true)
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        setAuthenticated(true)
        setPassword('')
      } else {
        alert('비밀번호가 올바르지 않습니다.')
      }
    } catch {
      alert('로그인 중 오류가 발생했습니다.')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin-login', { method: 'DELETE' }).catch(() => {})
    setAuthenticated(false)
    setPassword('')
  }

  useEffect(() => {
    if (!authenticated) return
    async function fetchTherapists() {
      setLoading(true)
      setTherapists(await loadList(tab))
      setLoading(false)
    }
    fetchTherapists()
  }, [authenticated, tab])

  const refresh = async () => {
    setTherapists(await loadList(tab))
  }

  // 모든 관리자 쓰기는 서버 라우트(service_role + 쿠키 인증)를 통해서만 수행
  const callAdminAction = async (id: string, action: 'approve' | 'reject' | 'revert' | 'resend_sms' | 'subscription', days?: number) => {
    const res = await fetch('/api/admin-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, days }),
    })
    if (res.status === 401) {
      alert('세션이 만료되었습니다. 다시 로그인해주세요.')
      setAuthenticated(false)
      return null
    }
    return res
  }

  const handleApprove = async (id: string, name: string) => {
    if (!confirm(name + ' 전문가의 면허 확인을 승인하시겠습니까?\n승인 시 해당 전문가에게 안내 문자가 발송됩니다.')) return
    setActingId(id)
    try {
      const res = await callAdminAction(id, 'approve')
      if (!res) return
      const result = await res.json()
      if (!res.ok) {
        alert('승인 처리 실패: ' + (result.error || '알 수 없는 오류'))
        return
      }
      if (result.smsSent) {
        alert('승인 완료 · 안내 문자 발송됨: ' + name)
      } else if (result.alreadyVerified) {
        alert('이미 승인된 전문가입니다: ' + name)
      } else {
        alert('승인은 완료됐지만 문자 발송에 실패했습니다: ' + name + '\n사유: ' + (result.smsError || '알 수 없음'))
      }
      refresh()
    } catch {
      alert('요청 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.')
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (id: string, name: string) => {
    if (!confirm(name + ' 전문가의 신청을 거부하시겠습니까?')) return
    setActingId(id)
    try {
      const res = await callAdminAction(id, 'reject')
      if (!res) return
      if (!res.ok) { alert('거부 처리 실패'); return }
      alert('거부 완료: ' + name)
      refresh()
    } finally {
      setActingId(null)
    }
  }

  const handleRevert = async (id: string, name: string) => {
    if (!confirm(name + ' 전문가를 대기 중으로 되돌리시겠습니까?')) return
    setActingId(id)
    try {
      const res = await callAdminAction(id, 'revert')
      if (!res) return
      if (!res.ok) { alert('변경 실패'); return }
      alert('변경 완료: ' + name)
      refresh()
    } finally {
      setActingId(null)
    }
  }

  const handleResendSms = async (id: string, name: string) => {
    setActingId(id)
    try {
      const res = await callAdminAction(id, 'resend_sms')
      if (!res) return
      const result = await res.json()
      if (!res.ok) { alert('보내지 못했어요: ' + (result.error || '알 수 없는 오류')); return }
      alert(result.smsSent ? '승인 안내 문자를 다시 보냈어요: ' + name : '문자 발송 실패: ' + (result.smsError || '알 수 없음'))
    } finally {
      setActingId(null)
    }
  }

  const handleSubscription = async (id: string, name: string, days: number) => {
    const msg = days > 0 ? `${name} 전문가의 구독을 ${days}일 켤까요?\n(남은 구독이 있으면 그 뒤로 이어 붙여요)` : `${name} 전문가의 구독을 끌까요?\n이미 시작한 채팅은 그대로 이어갈 수 있어요.`
    if (!confirm(msg)) return
    setActingId(id)
    try {
      const res = await callAdminAction(id, 'subscription', days)
      if (!res) return
      const result = await res.json()
      if (!res.ok) { alert('변경 실패: ' + (result.error || '알 수 없는 오류')); return }
      alert(result.subscribed_until ? `구독 켜짐: ${result.subscribed_until}까지` : '구독을 껐어요')
      refresh()
    } finally {
      setActingId(null)
    }
  }

  const getTypeLabel = (type: string) => practitionerLabel(type)

  if (checking) {
    return <main className="max-w-md mx-auto min-h-screen bg-white" />
  }

  if (!authenticated) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white flex items-center justify-center px-5">
        <div className="w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🔐</div>
            <h1 className="text-2xl font-extrabold text-gray-900">관리자 페이지</h1>
            <p className="text-sm text-gray-400 mt-2">운영자 전용</p>
          </div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="비밀번호 입력" className="w-full p-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B] mb-3" />
          <button onClick={handleLogin} disabled={loggingIn} className="w-full py-4 bg-[#0A8A7B] text-white rounded-xl font-bold disabled:opacity-60">{loggingIn ? '확인 중...' : '로그인'}</button>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900">관리자</h1>
          <div className="flex gap-3 mt-1">
            <button onClick={() => setSection('experts')} className={'text-sm font-bold ' + (section === 'experts' ? 'text-[#0A8A7B]' : 'text-gray-400')}>전문가 승인</button>
            <button onClick={() => setSection('magazine')} className={'text-sm font-bold ' + (section === 'magazine' ? 'text-[#0A8A7B]' : 'text-gray-400')}>매거진</button>
            <button onClick={() => setSection('reports')} className={'text-sm font-bold ' + (section === 'reports' ? 'text-[#0A8A7B]' : 'text-gray-400')}>채팅 신고</button>
          </div>
        </div>
        <button onClick={handleLogout} className="text-xs text-gray-400">로그아웃</button>
      </div>

      {section === 'magazine' ? (
        <AdminMagazine onAuthLost={onAuthLost} />
      ) : section === 'reports' ? (
        <AdminReports onAuthLost={onAuthLost} />
      ) : (
      <>
      <div className="px-5 pt-4 flex gap-2 border-b border-gray-100 sticky bg-white z-10" style={{ top: 73 }}>
        <button onClick={() => setTab('pending')} className={'px-4 py-2 text-sm font-bold ' + (tab === 'pending' ? 'border-b-2 border-[#0A8A7B] text-[#0A8A7B]' : 'text-gray-400')}>🟡 대기 중</button>
        <button onClick={() => setTab('verified')} className={'px-4 py-2 text-sm font-bold ' + (tab === 'verified' ? 'border-b-2 border-[#0A8A7B] text-[#0A8A7B]' : 'text-gray-400')}>✅ 승인됨</button>
        <button onClick={() => setTab('rejected')} className={'px-4 py-2 text-sm font-bold ' + (tab === 'rejected' ? 'border-b-2 border-[#0A8A7B] text-[#0A8A7B]' : 'text-gray-400')}>❌ 거부됨</button>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <p className="text-center text-gray-400 py-12">불러오는 중...</p>
        ) : therapists.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-gray-400">데이터가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">총 {therapists.length}명</p>
            {therapists.map((t) => (
              <div key={t.id} className="border border-gray-200 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{t.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">신청일: {new Date(t.created_at).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">{getTypeLabel(t.practitioner_type)}</span>
                </div>

                {/* 면허증 사진 ↔ 가입 정보 대조 */}
                {tab === 'pending' && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-900 mb-2">면허증 사진 확인</p>
                    {t.license_photo_url ? (
                      <a href={t.license_photo_url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-amber-200 bg-white">
                        <img src={t.license_photo_url} alt={t.name + ' 면허증'} className="w-full max-h-[360px] object-contain" />
                      </a>
                    ) : (
                      <p className="text-sm text-amber-800">올린 면허증 사진이 없어요. (예전 가입자 — 면허증 사진을 따로 받아 확인해 주세요)</p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-white p-2.5">
                        <p className="text-xs text-gray-400">가입 이름</p>
                        <p className="font-bold text-gray-900">{t.name}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2.5">
                        <p className="text-xs text-gray-400">가입 면허번호</p>
                        <p className="font-bold text-gray-900">{t.license_number}</p>
                      </div>
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-amber-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!matched[t.id]}
                        onChange={(e) => setMatched((m) => ({ ...m, [t.id]: e.target.checked }))}
                        className="w-5 h-5 accent-[#0A8A7B]"
                      />
                      사진 속 성함·면허번호가 가입 정보와 같아요 (생년월일도 눈으로 확인)
                    </label>
                    <p className="text-xs text-amber-800/80 mt-2">승인·거부하면 면허증 사진은 바로 삭제돼요. 사진을 아무 곳에도 저장하지 마세요.</p>
                  </div>
                )}
                {tab !== 'pending' && t.license_checked_at && (
                  <p className="mb-3 text-xs text-gray-400">면허증 사진 확인·삭제: {new Date(t.license_checked_at).toLocaleString('ko-KR')}</p>
                )}

                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
                  <div className="flex items-center">
                    <span className="text-gray-400 w-24 shrink-0">면허번호</span>
                    <span className="font-bold text-gray-900 flex-1">{t.license_number}</span>
                    <a href="https://lic.mohw.go.kr/" target="_blank" rel="noopener noreferrer" className="text-xs text-[#0A8A7B] underline">🔍 조회</a>
                  </div>
                  <div className="flex">
                    <span className="text-gray-400 w-24 shrink-0">경력</span>
                    <span className="text-gray-700">{t.years_experience}년</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-400 w-24 shrink-0">활동 형태</span>
                    <span className="text-gray-700">{workTypeLabels(t.work_types).join(' · ') || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-400 w-24 shrink-0">운동센터</span>
                    <span className="text-gray-700">{t.studio_name || t.hospital_name || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-400 w-24 shrink-0">연락처</span>
                    <span className="text-gray-700">{t.phone}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-400 w-24 shrink-0">카톡</span>
                    <a href={t.kakao_link} target="_blank" rel="noopener noreferrer" className="text-[#0A8A7B] underline text-xs truncate flex-1">{t.kakao_link}</a>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-1">자기소개</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{t.intro}</p>
                </div>

                {tab === 'pending' ? (
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(t.id, t.name)} disabled={actingId === t.id || !matched[t.id]} className={'flex-1 py-3 rounded-xl font-bold text-sm ' + (actingId === t.id || !matched[t.id] ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#0A8A7B] text-white')}>{actingId === t.id ? '처리 중...' : matched[t.id] ? '✅ 승인' : '사진 대조 후 승인'}</button>
                    <button onClick={() => handleReject(t.id, t.name)} disabled={actingId === t.id} className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm border border-red-100 disabled:opacity-50">❌ 거부</button>
                  </div>
                ) : (
                  <>
                  {tab === 'verified' && (
                    <div className="mb-3 rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2">
                        <p className="flex-1 text-sm font-bold text-gray-900">상담 수락 구독</p>
                        {subscribedNow(t.subscribed_until) ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#E8F6F4] text-[#0F6E56]">켜짐 · {t.subscribed_until}까지</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">{t.subscribed_until ? `끝남 (${t.subscribed_until})` : '꺼짐'}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">켜져 있어야 상담 요청을 수락할 수 있어요. 시범 기간에는 무료로 켜 주세요.</p>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => handleSubscription(t.id, t.name, 30)} disabled={actingId === t.id} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#0A8A7B] text-white disabled:opacity-50">
                          {subscribedNow(t.subscribed_until) ? '30일 연장' : '30일 켜기'}
                        </button>
                        {subscribedNow(t.subscribed_until) && (
                          <button onClick={() => handleSubscription(t.id, t.name, 0)} disabled={actingId === t.id} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 disabled:opacity-50">
                            끄기
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {tab === 'verified' && (
                    <button onClick={() => handleResendSms(t.id, t.name)} disabled={actingId === t.id} className="w-full mb-2 py-3 bg-[#E8F6F4] text-[#0F6E56] rounded-xl font-bold text-sm disabled:opacity-50">📩 승인 안내 문자 다시 보내기</button>
                  )}
                  <button onClick={() => handleRevert(t.id, t.name)} disabled={actingId === t.id} className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm disabled:opacity-50">🔄 대기 중으로 되돌리기</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </main>
  )
}
