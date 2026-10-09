'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const BRAND = '#0A8A7B'

const DAYS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
]

const SLOTS = [
  { value: 'morning', label: '오전', desc: '09-12시' },
  { value: 'afternoon', label: '오후', desc: '12-18시' },
  { value: 'evening', label: '저녁', desc: '18-21시' },
]

const DURATION_LABELS: Record<string, string> = {
  acute: '3일 이내',
  weeks: '1주 ~ 1개월',
  chronic: '3개월 이상',
  prevent: '예방·관리 목적',
}

const NATURE_LABELS: Record<string, string> = {
  rest: '가만히 있어도 욱신거림',
  motion: '특정 동작에서 아픔',
  stiff: '뻣뻣하고 결림',
  numb: '저리거나 찌릿함',
  postop: '수술·부상 후 회복 중',
  posture: '자세·체형 걱정',
}

// 주소에서 "시/구" 수준까지만 뽑아 치료사에게 보여줄 지역 라벨 생성
function toAreaLabel(address: string): string {
  const parts = address.trim().split(/\s+/)
  return parts.slice(0, 3).join(' ')
}

function RequestForm() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // 설문에서 넘어온 증상 정보
  const bodyPart = searchParams.get('part')
  const purpose = searchParams.get('purpose')
  const subject = searchParams.get('subject')
  const duration = searchParams.get('duration')
  const nature = searchParams.get('nature')
  const intensityParam = searchParams.get('intensity')
  const intensity = intensityParam ? Number(intensityParam) : null

  const [nickname, setNickname] = useState('')
  const [contactType, setContactType] = useState<'phone' | 'kakao'>('phone')
  const [contact, setContact] = useState('')
  const [address, setAddress] = useState('')
  const [addressResult, setAddressResult] = useState<{ latitude: number; longitude: number; address: string } | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [agreeCollect, setAgreeCollect] = useState(false)
  const [agreeSensitive, setAgreeSensitive] = useState(false)
  const [agreeShare, setAgreeShare] = useState(false)
  // 스팸 방지: 화면을 연 시각 + 사람에게는 안 보이는 칸(허니팟)
  const [startedAt] = useState(() => Date.now())
  const [website, setWebsite] = useState('')
  const allAgreed = agreeCollect && agreeSensitive && agreeShare
  const toggleAll = () => {
    const next = !allAgreed
    setAgreeCollect(next)
    setAgreeSensitive(next)
    setAgreeShare(next)
  }

  const toggleSlot = (day: number, slot: string) => {
    const key = `${day}-${slot}`
    setSlots(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
  }

  const handleAddressSearch = async () => {
    if (!address.trim()) return
    setAddressLoading(true)
    setAddressError('')
    setAddressResult(null)
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`)
      const data = await res.json()
      if (res.ok) setAddressResult(data)
      else setAddressError('주소를 찾을 수 없습니다. 더 자세히 입력해보세요.')
    } catch {
      setAddressError('주소 검색 중 오류가 발생했습니다.')
    } finally {
      setAddressLoading(false)
    }
  }

  const canSubmit =
    nickname.trim() && contact.trim() && addressResult && slots.length > 0 && allAgreed && !submitting

  const handleSubmit = async () => {
    if (!addressResult) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname,
          contactType,
          contact,
          subject,
          bodyPart,
          duration,
          nature,
          intensity,
          purpose,
          note,
          latitude: addressResult.latitude,
          longitude: addressResult.longitude,
          areaLabel: toAreaLabel(addressResult.address),
          addressDetail,
          preferredSlots: slots,
          agreeCollect,
          agreeSensitive,
          agreeShare,
          startedAt,
          website,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        alert(result.error || '요청서 등록에 실패했습니다.')
        setSubmitting(false)
        return
      }
      // 본인 확인용 토큰 저장 (계정 없이 내 요청을 다시 열어보기 위함)
      try {
        localStorage.setItem('mulchasa_request_token', result.token)
        localStorage.setItem('mulchasa_request_id', result.id)
      } catch {
        // 저장 실패해도 등록 자체는 완료됨
      }
      setDone(true)
    } catch {
      alert('요청 중 오류가 발생했습니다. 네트워크를 확인해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white px-5 py-16 text-center">
        <div className="text-6xl mb-6">📮</div>
        <h1 className="text-xl font-extrabold text-gray-900 mb-3">요청서가 등록됐어요</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">
          주변의 면허 검증된 방문 전문가에게<br />
          요청서가 전달됐습니다.<br />
          제안이 오면 확인하실 수 있어요.
        </p>
        <div className="bg-[#E8F6F4] rounded-2xl p-5 mb-8 text-left">
          <p className="text-sm font-bold text-[#067A6C] mb-2">📋 다음 단계</p>
          <ol className="text-sm text-gray-700 space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>방문 가능 지역의 전문가들이 요청서를 확인합니다</li>
            <li>관심 있는 전문가가 제안을 보내드려요</li>
            <li>제안을 비교하고 마음에 드는 분을 선택하세요</li>
          </ol>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed mb-6">
          상세 주소와 연락처는 제안을 수락한 전문가에게만 공개됩니다.
        </p>
        <button onClick={() => router.push('/')} className="px-8 py-3 text-white rounded-xl font-semibold" style={{ background: BRAND }}>
          홈으로
        </button>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white pb-28">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3 z-10">
        <button onClick={() => router.back()} className="text-gray-600 text-xl">←</button>
        <div>
          <p className="text-xs text-gray-400">방문 요청</p>
          <h1 className="text-base font-bold text-gray-900">요청서 작성</h1>
        </div>
      </div>

      <div className="px-5 py-6 space-y-7">
        {/* 증상 요약 (설문 결과) */}
        {(bodyPart || purpose) && (
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-400 mb-2">설문에서 알려주신 내용</p>
            <div className="space-y-1.5 text-sm text-gray-700">
              {bodyPart && <div>· 부위: <b>{bodyPart}</b></div>}
              {duration && <div>· 기간: {DURATION_LABELS[duration] || duration}</div>}
              {nature && <div>· 상태: {NATURE_LABELS[nature] || nature}</div>}
              {intensity !== null && <div>· 통증 강도: {intensity} / 10</div>}
              {purpose && <div>· 원하는 도움: <b>{purpose}</b></div>}
            </div>
          </div>
        )}

        {/* 스팸 방지용 숨은 칸 — 사람에게는 보이지 않아요 */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] w-px h-px opacity-0"
        />

        {/* 호칭 */}
        <div>
          <label className="text-sm font-bold text-gray-700 block mb-2">
            어떻게 불러드릴까요? *
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="예: 김OO, 어머니"
            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]"
          />
          <p className="text-xs text-gray-400 mt-2">실명이 아니어도 괜찮아요</p>
        </div>

        {/* 방문 주소 */}
        <div>
          <label className="text-sm font-bold text-gray-700 block mb-2">방문 받으실 주소 *</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setAddressResult(null) }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
              placeholder="예: 성남시 분당구 판교역로 100"
              className="flex-1 p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]"
            />
            <button
              onClick={handleAddressSearch}
              disabled={addressLoading || !address.trim()}
              className="px-4 py-3 text-white rounded-xl text-sm font-bold shrink-0 disabled:bg-gray-200 disabled:text-gray-400"
              style={{ background: addressLoading || !address.trim() ? undefined : BRAND }}
            >
              {addressLoading ? '검색 중' : '검색'}
            </button>
          </div>

          {addressResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-2">
              <p className="text-xs font-bold text-green-700 mb-1">✅ 위치 확인됨</p>
              <p className="text-xs text-green-600">{addressResult.address}</p>
            </div>
          )}
          {addressError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
              <p className="text-xs text-red-600">{addressError}</p>
            </div>
          )}

          <input
            type="text"
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
            placeholder="상세주소 (동·호수 등)"
            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]"
          />
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            🔒 전문가에게는 <b>&lsquo;성남시 분당구&rsquo;</b> 정도만 보여요.
            정확한 주소는 제안을 수락하신 후에만 공개됩니다.
          </p>
        </div>

        {/* 희망 시간 */}
        <div>
          <label className="text-sm font-bold text-gray-700 block mb-1">언제 방문받고 싶으세요? *</label>
          <p className="text-xs text-gray-400 mb-3">가능한 시간을 모두 골라주시면 매칭이 쉬워져요</p>
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 bg-gray-50">
              <div className="p-2.5 text-xs font-bold text-gray-400">요일</div>
              {SLOTS.map(s => (
                <div key={s.value} className="p-2.5 text-center">
                  <div className="text-xs font-bold text-gray-600">{s.label}</div>
                  <div className="text-[10px] text-gray-400">{s.desc}</div>
                </div>
              ))}
            </div>
            {DAYS.map(day => (
              <div key={day.value} className="grid grid-cols-4 border-t border-gray-100">
                <div className="p-2.5 flex items-center">
                  <span className={'text-sm font-bold ' + (day.value === 0 ? 'text-red-400' : day.value === 6 ? 'text-blue-400' : 'text-gray-700')}>
                    {day.label}
                  </span>
                </div>
                {SLOTS.map(s => {
                  const active = slots.includes(`${day.value}-${s.value}`)
                  return (
                    <button key={s.value} onClick={() => toggleSlot(day.value, s.value)}
                      className="p-2.5 flex items-center justify-center border-l border-gray-100">
                      <span className={'w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all ' +
                        (active ? 'text-white font-bold' : 'bg-gray-50 text-gray-300')}
                        style={active ? { background: BRAND } : undefined}>
                        {active ? '✓' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {slots.length > 0 ? `${slots.length}개 시간대 선택됨` : '최소 1개 이상 선택해주세요'}
          </p>
        </div>

        {/* 연락 방법 */}
        <div>
          <label className="text-sm font-bold text-gray-700 block mb-2">연락 방법 *</label>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setContactType('phone')}
              className={'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ' +
                (contactType === 'phone' ? 'text-white' : 'bg-gray-50 text-gray-500 border border-gray-100')}
              style={contactType === 'phone' ? { background: BRAND } : undefined}
            >
              📞 전화번호
            </button>
            <button
              onClick={() => setContactType('kakao')}
              className={'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ' +
                (contactType === 'kakao' ? 'text-white' : 'bg-gray-50 text-gray-500 border border-gray-100')}
              style={contactType === 'kakao' ? { background: BRAND } : undefined}
            >
              💬 카톡 오픈채팅
            </button>
          </div>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={contactType === 'phone' ? '010-0000-0000' : 'https://open.kakao.com/o/...'}
            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0A8A7B]"
          />
          <p className="text-xs text-gray-400 mt-2">
            🔒 제안을 수락하신 전문가에게만 공개됩니다
          </p>
        </div>

        {/* 추가 내용 */}
        <div>
          <label className="text-sm font-bold text-gray-700 block mb-2">
            더 전하고 싶은 내용 <span className="text-xs text-gray-400 font-normal">(선택)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 계단이 있어 거동이 어려워요 / 오전에 특히 뻣뻣합니다"
            rows={4}
            className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-[#0A8A7B]"
          />
        </div>

        {/* 개인정보 동의 */}
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <button
            onClick={toggleAll}
            className="w-full flex items-center gap-3 p-4 text-left"
            style={allAgreed ? { background: '#E8F6F4' } : { background: '#F9FAFB' }}
          >
            <span
              className="w-6 h-6 rounded-md flex items-center justify-center text-white text-sm shrink-0"
              style={{ background: allAgreed ? BRAND : '#D1D5DB' }}
            >
              ✓
            </span>
            <span className="text-[16px] font-bold text-gray-900">아래 내용에 모두 동의해요</span>
          </button>

          <div className="p-4 space-y-4 border-t border-gray-100">
            <ConsentRow
              checked={agreeCollect}
              onChange={setAgreeCollect}
              title="[필수] 개인정보 수집·이용"
              lines={[
                '항목: 호칭·연락처·주소·시간·메모',
                '목적: 운동 전문가 연결·연락',
                '보관: 마감 후 6개월, 요청 시 삭제',
              ]}
            />

            <ConsentRow
              checked={agreeSensitive}
              onChange={setAgreeSensitive}
              title="[필수] 건강 정보(민감정보) 처리"
              lines={[
                '항목: 부위·기간·상태·통증·메모',
                '목적: 알맞은 운동 지도 제안',
                '보관: 위와 같음',
              ]}
            />

            <ConsentRow
              checked={agreeShare}
              onChange={setAgreeShare}
              title="[필수] 개인정보 제3자 제공"
              lines={[
                '전문가들: 지역·건강 정보·시간 열람',
                '수락한 전문가: 연락처·상세 주소',
                '목적: 일정 조율·운동 지도',
                '보관: 서비스 종료 시까지',
              ]}
            />

            <p className="text-[13px] text-gray-500 leading-relaxed">
              동의하지 않으실 수 있지만, 이 경우 요청서를 보낼 수 없어요.{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
                개인정보처리방침 보기
              </a>
            </p>
          </div>
        </div>

        <p className="text-[12px] text-gray-400 leading-relaxed text-center">
          모든 전문가는 물리치료사 면허를 확인했어요 🛡️<br />
          방문 서비스는 운동 지도 중심이며, 의료기관의 치료를 대신하지 않아요.
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-5 py-4 bg-white border-t border-gray-100">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={'w-full py-4 rounded-2xl text-base font-bold transition-all ' +
            (canSubmit ? 'text-white active:scale-[0.98]' : 'bg-gray-100 text-gray-300 cursor-not-allowed')}
          style={canSubmit ? { background: BRAND } : undefined}
        >
          {submitting ? '등록 중...' : '요청서 보내기'}
        </button>
      </div>
    </main>
  )
}

export default function RequestPage() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    }>
      <RequestForm />
    </Suspense>
  )
}
function ConsentRow({
  checked,
  onChange,
  title,
  lines,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  lines: string[]
}) {
  return (
    <label className="flex gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-6 h-6 mt-0.5 shrink-0 accent-[#0A8A7B]"
      />
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-gray-900 mb-1">{title}</span>
        {lines.map((line) => (
          <span key={line} className="block text-[13px] text-gray-500 leading-relaxed">
            · {line}
          </span>
        ))}
      </span>
    </label>
  )
}
