'use client'

// 전문가 모드 '크루' — 물리치료사 동료 모임 (최대 10명, 대표 1 · 리더 2)
// · 크루가 없으면: 초대 코드로 합류 / 새 크루 만들기 / 크루 찾아 가입 신청
// · 크루가 있으면: 채팅(공지·케이스 공유) · 크루원(역할·가입 신청·초대 코드) · 스코어

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthUser } from '@/lib/auth'
import { useAppMode } from '@/lib/mode'
import { refreshNavBadges } from '@/lib/consult'
import { crewError, CREW_MAX, type CrewSearchItem, type MyCrew, type NoCrew } from '@/lib/crew'
import { findBannedPhrase, bannedMessage } from '@/lib/practitioner'
import BottomNav from '@/components/BottomNav'
import Sheet from '@/components/Sheet'
import { LoginNeeded, Spinner, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'
import { PrimaryButton, TextField, TierChip } from '@/components/crew/CrewParts'
import CrewHome from '@/components/crew/CrewHome'

export default function CrewPage() {
  const user = useAuthUser()
  const { ready, expert } = useAppMode()

  let body
  if (user === null) body = <LoginNeeded title={'로그인하면\n크루를 쓸 수 있어요'} desc="승인된 물리치료사 회원만 쓸 수 있어요." next="/crew" />
  else if (user === undefined || !ready) body = <Spinner />
  else if (!expert || !expert.verified)
    body = (
      <section className="px-6 pt-14 text-center">
        <p className="text-[20px] font-extrabold text-gray-900">면허 확인이 끝나면 열려요</p>
        <p className="text-[15px] text-gray-600 mt-2 leading-relaxed">크루는 승인된 물리치료사끼리만 함께할 수 있어요. 승인은 보통 1~2일 걸려요.</p>
      </section>
    )
  else return <CrewRoot />

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <Header />
      {body}
      <BottomNav />
    </main>
  )
}

function Header() {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-3">
      <h1 className="text-[22px] font-extrabold text-gray-900">크루</h1>
    </div>
  )
}

function CrewRoot() {
  const [data, setData] = useState<MyCrew | NoCrew | null | undefined>(undefined)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc('my_crew')
    if (e || !d) {
      setError(crewError(e, '크루 정보를 불러오지 못했어요.'))
      setData((cur) => (cur === undefined ? null : cur))
      return
    }
    setError('')
    setData(d as MyCrew | NoCrew)
  }, [])

  useEffect(() => {
    let alive = true
    supabase.rpc('my_crew').then(({ data: d, error: e }) => {
      if (!alive) return
      if (e || !d) {
        setError(crewError(e, '크루 정보를 불러오지 못했어요.'))
        setData(null)
      } else setData(d as MyCrew | NoCrew)
    })
    return () => {
      alive = false
    }
  }, [])

  if (data && data.crew) return <CrewHome data={data as MyCrew} reload={load} />

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <Header />
      {data === undefined ? (
        <Spinner />
      ) : data === null ? (
        <section className="px-6 pt-14 text-center">
          <p className="text-[17px] font-bold text-gray-900">{error}</p>
          <button type="button" onClick={load} className="mt-5 min-h-[48px] px-6 rounded-xl border border-gray-200 bg-white text-[15px] font-semibold text-gray-700">
            다시 불러오기
          </button>
        </section>
      ) : (
        <NoCrewView data={data as NoCrew} reload={load} />
      )}
      <BottomNav />
    </main>
  )
}

// ── 크루가 없을 때 ──────────────────────────────────────────
function NoCrewView({ data, reload }: { data: NoCrew; reload: () => Promise<void> }) {
  const [code, setCode] = useState('')
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')
  const [list, setList] = useState<CrewSearchItem[] | null>(null)
  const [joining, setJoining] = useState<CrewSearchItem | null>(null)

  // 크루 찾기 (입력이 멈추고 0.3초 뒤)
  useEffect(() => {
    let alive = true
    const timer = window.setTimeout(() => {
      supabase.rpc('search_crews', { p_q: q }).then(({ data: d }) => {
        if (alive) setList(Array.isArray(d) ? (d as CrewSearchItem[]) : [])
      })
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [q, data])

  const joinByCode = async () => {
    const c = code.trim().toUpperCase()
    if (c.length !== 6 || codeBusy) return
    setCodeBusy(true)
    setCodeError('')
    const { error } = await supabase.rpc('join_by_code', { p_code: c })
    setCodeBusy(false)
    if (error) return setCodeError(crewError(error))
    refreshNavBadges()
    reload()
  }

  const cancel = async (id: string) => {
    const { error } = await supabase.rpc('cancel_join', { p_request: id })
    if (error) return alert(crewError(error))
    reload()
  }

  return (
    <div className="pb-6">
      <section className="mx-5 mt-5 rounded-2xl p-5" style={{ background: GREEN_LIGHT }}>
        <p className="text-[21px] font-extrabold leading-snug" style={{ color: GREEN_DARK }}>
          혼자보다 든든하게,
          <br />
          동료 물리치료사와 크루로 일해요
        </p>
        <ul className="mt-3 space-y-2">
          {[
            '일정이 안 맞는 요청은 크루원을 추천해 회원과 이어 드려요 (회원이 수락해야 연결)',
            '크루 채팅에서 케이스를 나누고 서로 조언해요',
            `최대 ${CREW_MAX}명 · 대표 1명과 리더 2명이 크루를 이끌어요`,
            '함께 활동할수록 크루 스코어가 올라 크루 배지를 받아요',
          ].map((t) => (
            <li key={t} className="flex gap-2 text-[15px] text-gray-700 leading-relaxed">
              <span className="mt-[9px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GREEN }} aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-gray-500 mt-3">추천·연결로 돈이 오가지 않아요. 협력 포인트와 크루 배지로 기록돼요.</p>
      </section>

      <section className="mx-5 mt-4 rounded-2xl bg-white border border-gray-100 p-5">
        <h2 className="text-[17px] font-extrabold text-gray-900">초대 코드로 합류</h2>
        <p className="text-[14px] text-gray-500 mt-1">크루 대표·리더에게 받은 6자리 코드를 넣어 주세요.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 6).toUpperCase())}
            placeholder="예: 7F3A2C"
            aria-label="초대 코드"
            autoCapitalize="characters"
            className="flex-1 min-w-0 min-h-[52px] px-4 border border-gray-200 rounded-xl text-[18px] font-bold tracking-[0.2em] focus:outline-none focus:border-[#0A8A7B]"
          />
          <button
            type="button"
            onClick={joinByCode}
            disabled={code.length !== 6 || codeBusy}
            className="min-h-[52px] px-5 rounded-xl text-[16px] font-bold text-white disabled:bg-gray-200 disabled:text-gray-400 shrink-0"
            style={{ background: code.length !== 6 || codeBusy ? undefined : GREEN }}
          >
            합류
          </button>
        </div>
        {codeError && <p className="text-[14px] text-red-500 mt-2">{codeError}</p>}
      </section>

      <div className="mx-5 mt-4">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full min-h-[56px] rounded-2xl text-[17px] font-bold text-white flex items-center justify-center gap-2"
          style={{ background: GREEN }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          새 크루 만들기
        </button>
      </div>

      {data.my_requests.length > 0 && (
        <section className="mx-5 mt-6">
          <h2 className="text-[17px] font-extrabold text-gray-900">보낸 가입 신청</h2>
          <ul className="mt-2 space-y-2">
            {data.my_requests.map((r) => (
              <li key={r.id} className="rounded-2xl bg-white border border-gray-100 px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-bold text-gray-900 truncate">{r.crew_name}</p>
                  <p className="text-[13px] text-gray-500">대표·리더가 확인하고 있어요</p>
                </div>
                <button type="button" onClick={() => cancel(r.id)} className="min-h-[44px] px-3 rounded-lg border border-gray-200 text-[14px] font-semibold text-gray-600 shrink-0">
                  신청 취소
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-5 mt-6">
        <h2 className="text-[17px] font-extrabold text-gray-900">크루 찾기</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 20))}
          placeholder="크루 이름이나 지역 (예: 송파)"
          aria-label="크루 찾기"
          className="mt-2 w-full min-h-[52px] px-4 border border-gray-200 rounded-xl text-[16px] bg-white focus:outline-none focus:border-[#0A8A7B]"
        />
        {list === null ? (
          <Spinner />
        ) : list.length === 0 ? (
          <p className="text-[15px] text-gray-500 text-center py-10 leading-relaxed">
            {q ? '찾는 크루가 없어요.' : '아직 가입을 받는 크루가 없어요.'}
            <br />첫 크루를 만들어 보세요!
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setJoining(c)} className="w-full text-left rounded-2xl bg-white border border-gray-100 p-4 active:bg-gray-50">
                  <span className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-[17px] font-extrabold text-gray-900 truncate">{c.name}</span>
                    <TierChip tier={c.tier} suffix="" />
                  </span>
                  <span className="block text-[14px] text-gray-500 mt-0.5">
                    {c.region || '지역 미정'} · 크루원 {c.members}/{CREW_MAX}
                    {c.score != null && ` · ${Math.round(Number(c.score))}점`}
                  </span>
                  {c.intro && <span className="block text-[15px] text-gray-700 mt-1.5 line-clamp-2 leading-relaxed">{c.intro}</span>}
                  {c.requested && (
                    <span className="inline-block mt-2 text-[13px] font-bold" style={{ color: GREEN_DARK }}>
                      가입 신청함
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {creating && <CreateSheet onClose={() => setCreating(false)} onDone={reload} />}
      {joining && (
        <JoinSheet
          crew={joining}
          onClose={() => setJoining(null)}
          onDone={() => {
            setJoining(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function CreateSheet({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [region, setRegion] = useState('')
  const [intro, setIntro] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bannedName = findBannedPhrase(name)
  const bannedIntro = findBannedPhrase(intro)
  const ok = name.trim().length >= 2 && !bannedName && !bannedIntro

  const submit = async () => {
    if (!ok || busy) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('create_crew', { p_name: name.trim(), p_intro: intro.trim(), p_region: region.trim() })
    setBusy(false)
    if (e) return setError(crewError(e))
    await onDone()
  }

  return (
    <Sheet title="새 크루 만들기" onClose={onClose} footer={<PrimaryButton label={busy ? '만드는 중...' : '크루 만들기'} onClick={submit} disabled={!ok || busy} />}>
      <div className="space-y-4 pt-1">
        <TextField label="크루 이름" value={name} onChange={setName} max={20} placeholder="예: 송파 방문 재활 크루" error={bannedName ? bannedMessage(bannedName) : null} hint="2~20자, 다른 크루와 겹치지 않게" />
        <TextField label="주 활동 지역 (선택)" value={region} onChange={setRegion} max={30} placeholder="예: 서울 송파구·강동구" />
        <TextField
          label="크루 소개 (선택)"
          value={intro}
          onChange={setIntro}
          max={200}
          multiline
          placeholder="예: 낙상 예방·보행 운동 지도를 주로 하는 방문 물리치료사 모임이에요."
          error={bannedIntro ? bannedMessage(bannedIntro) : null}
        />
        <p className="text-[13px] text-gray-500 leading-relaxed">만든 사람이 대표가 돼요. 만든 뒤 초대 코드로 동료를 부를 수 있어요.</p>
        {error && <p className="text-[14px] text-red-500">{error}</p>}
      </div>
    </Sheet>
  )
}

function JoinSheet({ crew, onClose, onDone }: { crew: CrewSearchItem; onClose: () => void; onDone: () => void }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (busy || crew.requested) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('request_join', { p_crew: crew.id, p_message: message.trim() })
    setBusy(false)
    if (e) return setError(crewError(e))
    onDone()
  }

  return (
    <Sheet
      title={crew.name}
      onClose={onClose}
      footer={<PrimaryButton label={crew.requested ? '이미 신청했어요' : busy ? '보내는 중...' : '가입 신청하기'} onClick={submit} disabled={busy || crew.requested} />}
    >
      <div className="flex items-center gap-2">
        <TierChip tier={crew.tier} />
        <span className="text-[14px] text-gray-500">
          {crew.region || '지역 미정'} · 크루원 {crew.members}/{CREW_MAX}
        </span>
      </div>
      {crew.intro && <p className="text-[16px] text-gray-700 mt-3 leading-relaxed whitespace-pre-line">{crew.intro}</p>}
      <div className="mt-4">
        <TextField label="하고 싶은 말 (선택)" value={message} onChange={setMessage} max={200} multiline rows={3} placeholder="예: 송파에서 방문 운동 지도 3년 차예요. 함께 하고 싶어요!" />
      </div>
      <p className="text-[13px] text-gray-500 mt-3 leading-relaxed">대표·리더가 수락하면 크루 채팅에 들어갈 수 있어요. 내 프로필(이름·경력·사진)이 함께 전달돼요.</p>
      {error && <p className="text-[14px] text-red-500 mt-2">{error}</p>}
    </Sheet>
  )
}
