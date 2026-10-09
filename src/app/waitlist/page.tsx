'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Role = 'guardian' | 'pt'

const NEEDS: Record<Role, string[]> = {
  guardian: [
    '집으로 오는 운동 지도',
    '낙상 예방 운동',
    '집 안 안전 점검',
    '장기요양·복지 제도 상담',
    '방문요양 센터 정보',
  ],
  pt: ['방문 운동 지도', '낙상 예방 운동', '주거환경 점검', '보호자 운동 교육'],
}

const COPY: Record<Role, {
  title: string; desc: string; regionLabel: string; regionPh: string
  needLabel: string; noteLabel: string; notePh: string
}> = {
  guardian: {
    title: '부모님 댁으로 찾아가는\n운동 선생님을 연결해 드려요',
    desc: '물리치료사 면허를 가진 선생님이 집으로 찾아가 운동을 지도해 드려요. 오픈하면 가장 먼저 연락드릴게요.',
    regionLabel: '사시는 지역',
    regionPh: '예: 서울 송파구',
    needLabel: '어떤 도움이 필요하세요? (여러 개 선택)',
    noteLabel: '하고 싶은 말 (선택)',
    notePh: '궁금한 점을 편하게 적어 주세요. 질병명 같은 건강 정보는 적지 않으셔도 돼요.',
  },
  pt: {
    title: '집으로 찾아가는\n운동 지도 선생님을 모집해요',
    desc: '사전 등록하신 선생님께 오픈 소식과 첫 매칭 기회를 가장 먼저 드려요.',
    regionLabel: '활동 가능한 지역',
    regionPh: '예: 서울 강남구, 서초구',
    needLabel: '가능한 서비스 (여러 개 선택)',
    noteLabel: '경력·자신 있는 분야 (선택)',
    notePh: '예: 임상 7년, 뇌졸중 어르신 보행 운동 지도 경험이 많아요',
  },
}

const GREEN = '#0A8A7B'

export default function WaitlistPage() {
  const [role, setRole] = useState<Role>('guardian')
  const [source, setSource] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [region, setRegion] = useState('')
  const [needs, setNeeds] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 링크 뒤의 ?role=pt&from=insta 를 읽어 탭과 유입 경로를 정함
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('role') === 'pt') setRole('pt')
    setSource(params.get('from'))
  }, [])

  const switchRole = (r: Role) => {
    setRole(r)
    setNeeds([])
    setError(null)
  }

  const toggleNeed = (n: string) =>
    setNeeds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))

  const phoneDigits = phone.replace(/[^0-9]/g, '')
  const canSubmit =
    name.trim().length > 0 &&
    phoneDigits.length >= 10 &&
    phoneDigits.length <= 11 &&
    region.trim().length > 0 &&
    needs.length > 0 &&
    agreed &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.from('waitlist').insert({
      role,
      name: name.trim(),
      phone: phoneDigits,
      region: region.trim(),
      needs,
      note: note.trim() || null,
      source,
      agreed_privacy: agreed,
    })
    setSubmitting(false)
    if (error) {
      console.error(error)
      setError('신청이 저장되지 않았어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    setDone(true)
  }

  const c = COPY[role]

  if (done) {
    return (
      <main className="max-w-md mx-auto min-h-screen bg-white px-5 pt-20 text-center">
        <div className="text-5xl mb-4">🌿</div>
        <h1 className="text-[24px] font-extrabold text-gray-900 leading-snug">
          신청이 완료됐어요
        </h1>
        <p className="text-[17px] text-gray-600 mt-3 leading-relaxed">
          보필이 문을 열면 남겨주신 연락처로<br />가장 먼저 알려드릴게요.
        </p>
        <a
          href="https://blog.naver.com/spacex_2025"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full mt-10 py-4 rounded-2xl font-bold text-[17px] border-2"
          style={{ borderColor: GREEN, color: GREEN }}
        >
          그동안 블로그 글 읽어보기
        </a>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white px-5 pb-16">
      {/* 탭 */}
      <div className="flex gap-2 pt-5">
        {(['guardian', 'pt'] as Role[]).map((r) => (
          <button
            key={r}
            onClick={() => switchRole(r)}
            className="flex-1 py-3 rounded-xl text-[16px] font-bold border-2 transition-all"
            style={
              role === r
                ? { background: GREEN, borderColor: GREEN, color: 'white' }
                : { background: 'white', borderColor: '#E5E7EB', color: '#6B7280' }
            }
          >
            {r === 'guardian' ? '보호자예요' : '물리치료사예요'}
          </button>
        ))}
      </div>

      {/* 소개 */}
      <h1 className="text-[24px] font-extrabold text-gray-900 leading-snug mt-8 whitespace-pre-line">
        {c.title}
      </h1>
      <p className="text-[17px] text-gray-600 mt-3 leading-relaxed">{c.desc}</p>

      {/* 입력 */}
      <div className="mt-8 flex flex-col gap-6">
        <Field label="이름">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            className="w-full p-4 border border-gray-200 rounded-xl text-[17px] focus:outline-none focus:border-[#0A8A7B]"
          />
        </Field>

        <Field label="연락처">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            placeholder="010-1234-5678"
            className="w-full p-4 border border-gray-200 rounded-xl text-[17px] focus:outline-none focus:border-[#0A8A7B]"
          />
        </Field>

        <Field label={c.regionLabel}>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder={c.regionPh}
            className="w-full p-4 border border-gray-200 rounded-xl text-[17px] focus:outline-none focus:border-[#0A8A7B]"
          />
        </Field>

        <Field label={c.needLabel}>
          <div className="flex flex-col gap-2">
            {NEEDS[role].map((n) => {
              const on = needs.includes(n)
              return (
                <button
                  key={n}
                  onClick={() => toggleNeed(n)}
                  className="w-full text-left p-4 rounded-xl border-2 text-[17px] font-medium transition-all"
                  style={
                    on
                      ? { borderColor: GREEN, background: '#E8F6F4', color: '#0F6E56' }
                      : { borderColor: '#E5E7EB', background: 'white', color: '#374151' }
                  }
                >
                  {on ? '✓ ' : ''}{n}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label={c.noteLabel}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={c.notePh}
            rows={3}
            maxLength={300}
            className="w-full p-4 border border-gray-200 rounded-xl text-[16px] leading-relaxed focus:outline-none focus:border-[#0A8A7B]"
          />
        </Field>

        {/* 개인정보 동의 */}
        <div className="rounded-xl bg-gray-50 p-4 text-[14px] text-gray-600 leading-relaxed">
          <p className="font-bold text-gray-800 mb-1">개인정보 수집·이용 동의 (필수)</p>
          <p>· 수집 항목: 이름, 연락처, 지역, 선택한 도움 항목, 남기신 메모</p>
          <p>· 이용 목적: 보필 오픈 소식 및 서비스 연결 안내 연락</p>
          <p>· 보관 기간: 오픈 안내 후 1년, 또는 철회 요청 시 즉시 삭제</p>
          <p>· 동의하지 않으실 수 있으며, 이 경우 사전 신청이 어려워요.</p>
          <label className="flex items-center gap-3 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-6 h-6 accent-[#0A8A7B]"
            />
            <span className="text-[16px] font-bold text-gray-900">위 내용에 동의해요</span>
          </label>
        </div>

        {error && <p className="text-[15px] text-red-500 text-center">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-4 rounded-2xl font-bold text-[18px] text-white transition-all"
          style={{ background: canSubmit ? GREEN : '#B8D9D4' }}
        >
          {submitting ? '저장하는 중...' : '사전 신청하기'}
        </button>
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[16px] font-bold text-gray-900 mb-2">{label}</div>
      {children}
    </div>
  )
}