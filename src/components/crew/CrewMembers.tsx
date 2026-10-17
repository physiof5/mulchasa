'use client'

// 크루원 탭 — 크루원 목록·역할·좋아요·버디 / 가입 신청 처리 / 초대 코드 / 크루 설정 · 나가기 · 해체
//  · 대표: 리더 지정·해제(최대 2명), 대표 넘기기, 내보내기, 크루 설정(가입 방식·최소 점수), 해체
//  · 리더: 가입 신청 처리, 초대 코드, 공지, 버디 정하기, 크루원 내보내기
//  · 내보내기는 사유 필수 · 한 달 2명까지 (내보낸 분의 활동 기록은 크루에 남음)
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { refreshNavBadges } from '@/lib/consult'
import { CREW_MAX, HEARTS_PER_MONTH, LEADER_MAX, MIN_SCORE_OPTIONS, ROLE_LABEL, crewError, type CrewMember, type JoinMode, type MyCrew } from '@/lib/crew'
import { findBannedPhrase, bannedMessage } from '@/lib/practitioner'
import Sheet, { SheetAction } from '@/components/Sheet'
import { Avatar, GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'
import { HeartCount, PrimaryButton, RoleChip, TextField } from '@/components/crew/CrewParts'

export default function CrewMembers({ data, reload }: { data: MyCrew; reload: () => Promise<void> }) {
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<CrewMember | null>(null)
  const [buddyFor, setBuddyFor] = useState<CrewMember | null>(null)
  const picked = data.members.find((m) => m.user_id === pickedId) ?? null
  const setPicked = (m: CrewMember | null) => setPickedId(m?.user_id ?? null)
  const [settings, setSettings] = useState(false)
  const [freshCode, setFreshCode] = useState<string | null>(null)
  const code = freshCode ?? data.crew.invite_code
  const [copied, setCopied] = useState(false)
  const isOwner = data.my_role === 'owner'
  const isLead = isOwner || data.my_role === 'leader'
  const leaders = data.members.filter((m) => m.role === 'leader').length

  const run = async (fn: string, args: Record<string, unknown>, ask?: string) => {
    if (ask && !confirm(ask)) return false
    const { error } = await supabase.rpc(fn, args)
    if (error) {
      alert(crewError(error))
      return false
    }
    await reload()
    refreshNavBadges()
    return true
  }

  const shareCode = async () => {
    if (!code) return
    const text = `우리 크루 「${data.crew.name}」에 함께해요! 앱 전문가 모드 › 크루 › 초대 코드에 ${code} 를 넣어 주세요.`
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(code)
        setCopied(true)
      }
    } catch {
      // 공유 창을 닫은 경우
    }
  }

  const newCode = async () => {
    if (!confirm('새 초대 코드를 만들까요? 지금 코드는 더 쓸 수 없어요.')) return
    const { data: c, error } = await supabase.rpc('regen_invite_code')
    if (error) return alert(crewError(error))
    setFreshCode(c as string)
    setCopied(false)
  }

  return (
    <div className="pb-8">
      {isLead && data.requests.length > 0 && (
        <section className="mx-5 mt-4">
          <h2 className="text-[17px] font-extrabold text-gray-900">가입 신청 {data.requests.length}</h2>
          <ul className="mt-2 space-y-2">
            {data.requests.map((r) => (
              <li key={r.id} className="rounded-2xl bg-white border-2 p-4" style={{ borderColor: GREEN_LIGHT }}>
                <div className="flex items-center gap-3">
                  <Avatar src={r.photo} name={r.name} size={48} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[17px] font-bold text-gray-900 truncate">{r.name}</p>
                    <p className="text-[14px] text-gray-500">
                      물리치료사{r.years ? ` · 경력 ${r.years}년` : ''} · {Math.round(Number(r.score))}점
                    </p>
                  </div>
                </div>
                {r.message && <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-[15px] text-gray-700 leading-relaxed whitespace-pre-line">{r.message}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => run('decide_join', { p_request: r.id, p_approve: false }, `${r.name}님의 가입 신청을 거절할까요?`)} className="min-h-[48px] rounded-xl border border-gray-200 text-[15px] font-semibold text-gray-600">
                    거절
                  </button>
                  <button
                    type="button"
                    onClick={() => run('decide_join', { p_request: r.id, p_approve: true })}
                    disabled={data.members.length >= CREW_MAX}
                    className="min-h-[48px] rounded-xl text-[15px] font-bold text-white disabled:bg-gray-200"
                    style={{ background: data.members.length >= CREW_MAX ? undefined : GREEN }}
                  >
                    {data.members.length >= CREW_MAX ? '정원이 찼어요' : '수락'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-5 mt-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-extrabold text-gray-900">
            크루원 {data.members.length}/{CREW_MAX}
          </h2>
          <span className="text-[13px] text-gray-500">눌러서 프로필·역할 보기</span>
        </div>
        <ul className="mt-2 rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100">
          {data.members.map((m) => (
            <li key={m.user_id}>
              <button type="button" onClick={() => setPicked(m)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
                <Avatar src={m.photo} name={m.name} size={48} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[17px] font-bold text-gray-900 truncate">{m.name}</span>
                    <RoleChip role={m.role} />
                    {m.me && <span className="text-[13px] text-gray-400">나</span>}
                  </span>
                  <span className="flex items-center gap-1.5 text-[14px] text-gray-500">
                    경력 {m.years ? `${m.years}년` : '-'} · <HeartCount n={m.hearts} size={13} />
                  </span>
                  {m.buddy && <span className="block text-[13px] truncate" style={{ color: GREEN_DARK }}>🧑‍🤝‍🧑 버디 {m.buddy.name}</span>}
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-[18px] font-extrabold" style={{ color: GREEN_DARK }}>
                    {Math.round(m.score.total)}
                  </span>
                  <span className="block text-[12px] text-gray-400 -mt-0.5">점</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-gray-500 mt-2">
          {data.members.length < CREW_MAX ? `${CREW_MAX - data.members.length}자리 남았어요 · ` : ''}이번 달 보낼 수 있는 좋아요 {data.hearts_left}/{HEARTS_PER_MONTH}
        </p>
      </section>

      {isLead && code && (
        <section className="mx-5 mt-5 rounded-2xl bg-white border border-gray-100 p-5">
          <h2 className="text-[17px] font-extrabold text-gray-900">초대 코드</h2>
          <p className="text-[14px] text-gray-500 mt-1">이 코드를 받은 물리치료사는 바로 합류할 수 있어요.</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="flex-1 min-h-[56px] rounded-xl flex items-center justify-center text-[26px] font-extrabold tracking-[0.25em]" style={{ background: GREEN_LIGHT, color: GREEN_DARK }}>
              {code}
            </span>
            <button type="button" onClick={shareCode} className="min-h-[56px] px-4 rounded-xl text-[15px] font-bold text-white shrink-0" style={{ background: GREEN }}>
              {copied ? '복사됨' : '보내기'}
            </button>
          </div>
          <button type="button" onClick={newCode} className="mt-2 min-h-[44px] text-[14px] font-semibold text-gray-500 underline underline-offset-2">
            코드가 퍼졌다면 새 코드 만들기
          </button>
        </section>
      )}

      <section className="mx-5 mt-5 rounded-2xl bg-white border border-gray-100 p-5">
        <h2 className="text-[17px] font-extrabold text-gray-900">역할</h2>
        <ul className="mt-2 space-y-1.5 text-[15px] text-gray-700 leading-relaxed">
          <li>
            <b>대표</b> · 리더 지정, 대표 넘기기, 크루 설정·해체
          </li>
          <li>
            <b>리더</b> (최대 {LEADER_MAX}명) · 가입 신청 처리, 초대 코드, 공지, 신입 버디 정하기, 크루원 내보내기
          </li>
          <li>
            <b>크루원</b> · 채팅·케이스 공유, 도와주세요 질문·답, 좋아요, 크루원 추천
          </li>
        </ul>
      </section>

      <div className="mx-5 mt-5 space-y-2">
        {isOwner && (
          <button type="button" onClick={() => setSettings(true)} className="w-full min-h-[52px] rounded-xl bg-white border border-gray-200 text-[16px] font-semibold text-gray-700">
            크루 설정 (이름·소개·가입 방식·최소 점수)
          </button>
        )}
        {isOwner && data.members.length > 1 ? (
          <p className="text-[13px] text-gray-500 text-center pt-1">대표는 다른 크루원에게 대표를 넘긴 뒤 나갈 수 있어요.</p>
        ) : (
          <button
            type="button"
            onClick={() =>
              run('leave_crew', {}, isOwner ? '혼자 남은 크루예요. 나가면 크루가 닫히고 채팅도 지워져요. 나갈까요?' : '크루에서 나갈까요? 크루 채팅을 더는 볼 수 없어요.')
            }
            className="w-full min-h-[52px] rounded-xl text-[16px] font-semibold"
            style={{ color: '#E5484D' }}
          >
            크루 나가기
          </button>
        )}
        {isOwner && data.members.length > 1 && (
          <button
            type="button"
            onClick={() => run('disband_crew', {}, `「${data.crew.name}」 크루를 해체할까요? 모든 크루원이 빠지고 채팅도 지워져요. 되돌릴 수 없어요.`)}
            className="w-full min-h-[52px] rounded-xl text-[16px] font-semibold"
            style={{ color: '#E5484D' }}
          >
            크루 해체하기
          </button>
        )}
      </div>

      {picked && (
        <Sheet title={`${picked.name}${picked.me ? ' (나)' : ''}`} onClose={() => setPicked(null)}>
          <p className="text-[15px] text-gray-500 -mt-1 mb-2 flex items-center gap-1.5 flex-wrap">
            {ROLE_LABEL[picked.role]} · 경력 {picked.years ? `${picked.years}년` : '-'} · {Math.round(picked.score.total)}점 · <HeartCount n={picked.hearts} />
          </p>
          {picked.buddy && (
            <p className="text-[14px] mb-2 px-4" style={{ color: GREEN_DARK }}>
              🧑‍🤝‍🧑 버디 {picked.buddy.name} · {new Date(picked.buddy.until).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}까지
            </p>
          )}
          {!picked.me && (
            <SheetAction
              label={picked.hearted ? '❤ 이번 달 좋아요를 보냈어요' : '❤ 좋아요 보내기'}
              desc={picked.hearted ? '한 사람에게 한 달에 한 번 보낼 수 있어요' : `친절하고 든든한 동료에게 · 이번 달 ${data.hearts_left}개 남음`}
              disabled={picked.hearted || data.hearts_left <= 0}
              onClick={() => run('give_heart', { p_user: picked.user_id })}
            />
          )}
          <Link href={`/therapist/${picked.therapist_id}`} className="flex items-center min-h-[56px] px-4 rounded-xl text-[17px] font-semibold text-gray-800 active:bg-gray-50">
            프로필 보기
          </Link>
          {isLead && (
            <SheetAction
              label={picked.buddy ? '버디 바꾸기·해제' : '버디 정하기'}
              desc="선배가 90일 동안 요청 추천·인수인계로 첫 상담까지 도와요 (방문은 신입이 직접)"
              onClick={() => {
                setBuddyFor(picked)
                setPicked(null)
              }}
            />
          )}
          {!picked.me && isOwner && picked.role === 'member' && (
            <SheetAction
              label="리더로 정하기"
              desc={leaders >= LEADER_MAX ? `리더는 ${LEADER_MAX}명까지예요. 먼저 한 분을 해제해 주세요.` : '가입 신청 처리·초대 코드·공지를 함께 맡아요'}
              disabled={leaders >= LEADER_MAX}
              onClick={async () => (await run('set_member_role', { p_user: picked.user_id, p_role: 'leader' })) && setPicked(null)}
            />
          )}
          {!picked.me && isOwner && picked.role === 'leader' && (
            <SheetAction label="리더 해제" onClick={async () => (await run('set_member_role', { p_user: picked.user_id, p_role: 'member' })) && setPicked(null)} />
          )}
          {!picked.me && isOwner && (
            <SheetAction
              label="대표 넘기기"
              desc="넘기면 나는 리더(자리가 없으면 크루원)가 돼요"
              onClick={async () =>
                (await run('set_member_role', { p_user: picked.user_id, p_role: 'owner' }, `${picked.name}님에게 대표를 넘길까요?`)) && setPicked(null)
              }
            />
          )}
          {!picked.me && (isOwner || (data.my_role === 'leader' && picked.role === 'member')) && (
            <SheetAction
              label="크루에서 내보내기"
              desc={`사유를 남겨야 하고, 한 달에 2명까지예요 (이번 달 ${data.removals_left}명 남음)`}
              danger
              disabled={data.removals_left <= 0}
              onClick={() => {
                setRemoving(picked)
                setPicked(null)
              }}
            />
          )}
        </Sheet>
      )}
      {removing && <RemoveSheet member={removing} onClose={() => setRemoving(null)} reload={reload} />}
      {buddyFor && <BuddySheet member={buddyFor} data={data} onClose={() => setBuddyFor(null)} reload={reload} />}
      {settings && <SettingsSheet data={data} onClose={() => setSettings(false)} onDone={reload} />}
    </div>
  )
}

const REMOVE_REASONS = ['오랫동안 활동이 없어요', '크루 규칙을 지키지 않았어요', '본인이 나가길 원했어요']

function RemoveSheet({ member, onClose, reload }: { member: CrewMember; onClose: () => void; reload: () => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    if (reason.trim().length < 2 || busy) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('remove_member', { p_user: member.user_id, p_reason: reason.trim() })
    setBusy(false)
    if (e) return setError(crewError(e))
    await reload()
    refreshNavBadges()
    onClose()
  }
  return (
    <Sheet title={`${member.name}님 내보내기`} onClose={onClose} footer={<PrimaryButton label={busy ? '처리 중...' : '내보내기'} danger onClick={submit} disabled={reason.trim().length < 2 || busy} />}>
      <p className="text-[15px] text-gray-600 leading-relaxed">
        점수가 낮다는 이유로는 내보내지 말아 주세요. 크루 점수는 합산이라 함께할수록 올라가요. 내보내도 이분이 쌓은 활동 기록은 크루에 남아요.
      </p>
      <p className="text-[15px] font-bold text-gray-800 mt-4">사유</p>
      <div className="mt-2 flex flex-col gap-2">
        {REMOVE_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-3 min-h-[52px] px-4 rounded-xl border-2 cursor-pointer" style={reason === r ? { borderColor: GREEN, background: GREEN_LIGHT } : { borderColor: '#E5E7EB' }}>
            <input type="radio" name="remove-reason" checked={reason === r} onChange={() => setReason(r)} className="w-5 h-5 accent-[#0A8A7B]" />
            <span className="text-[16px] font-semibold text-gray-800">{r}</span>
          </label>
        ))}
      </div>
      <textarea
        value={REMOVE_REASONS.includes(reason) ? '' : reason}
        onChange={(e) => setReason(e.target.value.slice(0, 200))}
        rows={2}
        placeholder="직접 적기"
        className="mt-2 w-full p-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#0A8A7B] resize-none"
      />
      <p className="text-[12px] text-gray-400 mt-1">사유는 운영팀이 확인할 수 있어요. 내보내기는 한 달에 2명까지예요.</p>
      {error && <p className="text-[14px] text-red-500 mt-2">{error}</p>}
    </Sheet>
  )
}

function BuddySheet({ member, data, onClose, reload }: { member: CrewMember; data: MyCrew; onClose: () => void; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const choose = async (buddy: string | null) => {
    if (busy) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('set_buddy', { p_user: member.user_id, p_buddy: buddy })
    setBusy(false)
    if (e) return setError(crewError(e))
    await reload()
    onClose()
  }
  const candidates = data.members.filter((m) => m.user_id !== member.user_id)
  return (
    <Sheet title={`${member.name}님의 버디`} onClose={onClose}>
      <p className="text-[15px] text-gray-600 leading-relaxed">
        선배 크루원이 90일 동안 도와요. 함께 방문하는 게 아니라, 일정이 안 맞는 요청을 신입에게 추천하고 인수인계 메모·질문 답으로 회원 연결까지 돕는 역할이에요. 방문·운동 지도는 신입이 직접 해요. 신입이 첫 상담 연결·첫 진행 후기 공개를 해내면 버디에게 협업 점수와 협력 포인트가 쌓이고, 크루 활동 점수도 올라가요.
      </p>
      <ul className="mt-3 space-y-2">
        {candidates.map((c) => {
          const on = member.buddy?.user_id === c.user_id
          return (
            <li key={c.user_id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => choose(c.user_id)}
                className="w-full flex items-center gap-3 min-h-[60px] px-3 rounded-xl border-2 text-left"
                style={on ? { borderColor: GREEN, background: GREEN_LIGHT } : { borderColor: '#E5E7EB' }}
              >
                <Avatar src={c.photo} name={c.name} size={40} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] font-bold text-gray-900 truncate">
                    {c.name} {c.role !== 'member' && <span className="text-[13px] font-semibold" style={{ color: GREEN_DARK }}>{ROLE_LABEL[c.role]}</span>}
                  </span>
                  <span className="block text-[13px] text-gray-500">경력 {c.years ? `${c.years}년` : '-'} · {Math.round(c.score.total)}점</span>
                </span>
                {on && <span className="text-[13px] font-bold" style={{ color: GREEN_DARK }}>지금 버디</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {member.buddy && (
        <button type="button" disabled={busy} onClick={() => choose(null)} className="mt-3 min-h-[44px] text-[14px] font-semibold text-gray-500 underline underline-offset-2">
          버디 해제
        </button>
      )}
      {error && <p className="text-[14px] text-red-500 mt-2">{error}</p>}
    </Sheet>
  )
}

function SettingsSheet({ data, onClose, onDone }: { data: MyCrew; onClose: () => void; onDone: () => Promise<void> }) {
  const [name, setName] = useState(data.crew.name)
  const [region, setRegion] = useState(data.crew.region)
  const [intro, setIntro] = useState(data.crew.intro)
  const [open, setOpen] = useState(data.crew.is_open)
  const [mode, setMode] = useState<JoinMode>(data.crew.join_mode ?? 'approval')
  const [minScore, setMinScore] = useState<number>(data.crew.min_score ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bannedName = findBannedPhrase(name)
  const bannedIntro = findBannedPhrase(intro)
  const ok = name.trim().length >= 2 && !bannedName && !bannedIntro

  const save = async () => {
    if (!ok || busy) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('update_crew', {
      p_name: name.trim(),
      p_intro: intro.trim(),
      p_region: region.trim(),
      p_is_open: open,
      p_join_mode: mode,
      p_min_score: minScore,
    })
    setBusy(false)
    if (e) return setError(crewError(e))
    await onDone()
    onClose()
  }

  return (
    <Sheet title="크루 설정" onClose={onClose} footer={<PrimaryButton label={busy ? '저장 중...' : '저장하기'} onClick={save} disabled={!ok || busy} />}>
      <div className="space-y-4 pt-1">
        <TextField label="크루 이름" value={name} onChange={setName} max={20} error={bannedName ? bannedMessage(bannedName) : null} />
        <TextField label="주 활동 지역" value={region} onChange={setRegion} max={30} placeholder="예: 서울 송파구·강동구" />
        <TextField label="크루 소개" value={intro} onChange={setIntro} max={200} multiline error={bannedIntro ? bannedMessage(bannedIntro) : null} />
        <label className="flex items-center gap-3 min-h-[56px] px-4 rounded-xl border border-gray-200 cursor-pointer">
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} className="w-6 h-6 accent-[#0A8A7B]" />
          <span className="flex-1">
            <span className="block text-[16px] font-semibold text-gray-800">크루 찾기에 보이기</span>
            <span className="block text-[13px] text-gray-500">끄면 초대 코드로만 합류할 수 있어요</span>
          </span>
        </label>
        <div>
          <p className="text-[15px] font-bold text-gray-800">가입 방식</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ['approval', '승인 후 합류', '대표·리더가 수락해야 들어와요'],
                ['open', '바로 참여', '조건이 맞으면 누르는 즉시 들어와요'],
              ] as const
            ).map(([v, label, desc]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMode(v)}
                aria-pressed={mode === v}
                className="min-h-[72px] rounded-xl border-2 px-3 py-2 text-left"
                style={mode === v ? { borderColor: GREEN, background: GREEN_LIGHT } : { borderColor: '#E5E7EB' }}
              >
                <span className="block text-[15px] font-bold text-gray-900">{label}</span>
                <span className="block text-[12px] text-gray-500 leading-snug mt-0.5">{desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[15px] font-bold text-gray-800">가입 최소 조건</p>
          <p className="text-[13px] text-gray-500">프로필 4항목(경력·보유 자격·사진·소개 30자)은 모든 크루에 꼭 필요해요.</p>
          <div className="mt-2 flex flex-col gap-2">
            {MIN_SCORE_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-3 min-h-[56px] px-4 rounded-xl border-2 cursor-pointer" style={minScore === o.value ? { borderColor: GREEN, background: GREEN_LIGHT } : { borderColor: '#E5E7EB' }}>
                <input type="radio" name="min-score" checked={minScore === o.value} onChange={() => setMinScore(o.value)} className="w-5 h-5 accent-[#0A8A7B]" />
                <span className="flex-1">
                  <span className="block text-[15px] font-bold text-gray-800">{o.label}</span>
                  <span className="block text-[12px] text-gray-500">{o.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-[14px] text-red-500">{error}</p>}
      </div>
    </Sheet>
  )
}
