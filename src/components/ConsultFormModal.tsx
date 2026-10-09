'use client'

// 전문가에게 보낼 '상담 요약 메시지' 만들기
// 메시지는 서버에 저장하지 않고, 보호자가 복사해서 전문가의 카카오 오픈채팅에 직접 붙여넣는다.
// 맞춤 찾기(/find)에서 고른 상황이 있으면 보호자가 동의할 때만 함께 넣는다.

import { useState } from 'react'
import Link from 'next/link'
import { situationLines } from '@/lib/care'
import { useStoredSituation } from '@/lib/useStoredSituation'
import { toOpenChatUrl } from '@/lib/practitioner'

interface Props {
  isOpen: boolean
  onClose: () => void
  therapistName: string
  kakaoLink: string
  purpose: string | null
}

const WHO_CHIPS = ['어머님', '아버님', '다른 가족', '본인']

// 숨고 '빠른 질문'처럼 자주 묻는 것을 눌러서 넣기
const QUICK_QUESTIONS = ['진행 방식', '비용', '가능한 요일·시간', '집으로 와 주실 수 있는지', '처음 만나기 전 준비할 것']

const TIMINGS = ['오늘 중', '이번 주 안에', '천천히 괜찮아요']


export default function ConsultFormModal({ isOpen, onClose, therapistName, kakaoLink, purpose }: Props) {
  const [who, setWho] = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [timing, setTiming] = useState('')
  const [note, setNote] = useState('')
  const [includeSituation, setIncludeSituation] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  // 맞춤 찾기에서 고른 내용 (이 기기 sessionStorage에만 있음)
  const stored = useStoredSituation()

  if (!isOpen) return null

  const lines = stored ? situationLines(stored) : []

  const toggleQuestion = (q: string) =>
    setQuestions((prev) => (prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]))

  const generateMessage = () => {
    const rows: string[] = []
    if (stored && includeSituation) {
      lines.forEach((l) => rows.push(`${l.icon} ${l.label}: ${l.value}`))
    } else if (who) {
      rows.push(`👤 대상: ${who}`)
    }
    if (purpose) rows.push(`🎯 관심 분야: ${purpose}`)
    if (questions.length > 0) rows.push(`❓ 궁금한 점: ${questions.join(', ')}`)
    if (timing) rows.push(`🕐 상담 희망: ${timing}`)

    return [
      `안녕하세요, ${therapistName}님.`,
      `'보호가 필요해'에서 프로필을 보고 운동 지도 상담을 요청드려요.`,
      '',
      ...rows,
      ...(note.trim() ? ['', '💬 전달사항:', note.trim()] : []),
      '',
      '편하실 때 답장 부탁드립니다.',
    ].join('\n')
  }

  const handleCopyAndOpen = async () => {
    setError('')
    const url = toOpenChatUrl(kakaoLink)
    if (!url) {
      setError('이 전문가의 오픈채팅 주소를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    try {
      await navigator.clipboard.writeText(generateMessage())
      setCopied(true)
    } catch {
      // 복사가 막힌 기기여도 오픈채팅은 열어 줌 (미리보기 글을 길게 눌러 복사 가능)
    }
    window.setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), 400)
  }

  const isValid = timing !== ''

  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={
        'min-h-[44px] px-4 rounded-full text-[15px] font-semibold transition-all ' +
        (on ? 'bg-[#0A8A7B] text-white' : 'bg-gray-50 text-gray-600 border border-gray-200')
      }
    >
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${therapistName}님께 상담 요청`}
      >
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-[19px] font-bold text-gray-900">{therapistName}님께 상담 요청</h2>
            <p className="text-[14px] text-gray-500 mt-0.5">상황을 정리해 카톡으로 보내 드려요</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="w-11 h-11 flex items-center justify-center text-gray-400 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {stored ? (
            <div className="rounded-2xl bg-[#E8F6F4] p-4">
              <p className="text-[15px] font-bold text-[#0F6E56] mb-2">맞춤 찾기에서 고른 상황</p>
              <ul className="space-y-1 mb-3">
                {lines.map((l) => (
                  <li key={l.label} className="text-[15px] text-gray-700">
                    {l.icon} {l.label}: {l.value}
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2.5 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={includeSituation}
                  onChange={(e) => setIncludeSituation(e.target.checked)}
                  className="w-6 h-6 accent-[#0A8A7B]"
                />
                <span className="text-[15px] font-semibold text-gray-800">이 상황을 메시지에 함께 넣기</span>
              </label>
            </div>
          ) : (
            <div>
              <p className="text-[16px] font-bold text-gray-800 mb-2.5">누구를 위한 상담인가요? (선택)</p>
              <div className="flex flex-wrap gap-2">{WHO_CHIPS.map((w) => chip(w, who === w, () => setWho(who === w ? '' : w)))}</div>
              <Link href="/find" className="inline-flex items-center min-h-[44px] mt-2 text-[15px] font-semibold text-[#0F6E56]">
                1분 맞춤 찾기로 상황 정리하기 ›
              </Link>
            </div>
          )}

          <div>
            <p className="text-[16px] font-bold text-gray-800 mb-2.5">궁금한 점 (여러 개 선택)</p>
            <div className="flex flex-wrap gap-2">{QUICK_QUESTIONS.map((q) => chip(q, questions.includes(q), () => toggleQuestion(q)))}</div>
          </div>

          <div>
            <p className="text-[16px] font-bold text-gray-800 mb-2.5">언제쯤 상담받고 싶으세요? *</p>
            <div className="flex flex-wrap gap-2">{TIMINGS.map((t) => chip(t, timing === t, () => setTiming(t)))}</div>
          </div>

          <div>
            <p className="text-[16px] font-bold text-gray-800 mb-2.5">더 전하실 말 (선택)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 오른쪽 다리에 힘이 약해 지팡이를 쓰세요. 평일 오전이 편해요."
              maxLength={300}
              className="w-full p-3 border border-gray-200 rounded-xl text-[16px] resize-none focus:outline-none focus:border-[#0A8A7B]"
              rows={3}
            />
          </div>

          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-[14px] font-bold text-gray-500 mb-2">📋 보낼 메시지 미리보기</p>
            <pre className="text-[14px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{generateMessage()}</pre>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-gray-100">
          {error && <p className="text-[14px] text-red-500 text-center mb-2">{error}</p>}
          <button
            onClick={handleCopyAndOpen}
            disabled={!isValid}
            className={
              'w-full min-h-[56px] rounded-2xl text-[17px] font-bold transition-all ' +
              (isValid ? 'bg-[#FEE500] text-gray-900 active:scale-[0.98]' : 'bg-gray-100 text-gray-300 cursor-not-allowed')
            }
          >
            {copied ? '✓ 복사 완료! 카톡 여는 중...' : '💬 메시지 복사하고 카톡 열기'}
          </button>
          <p className="text-[13px] text-gray-400 text-center mt-2.5 leading-relaxed">
            메시지는 저장되지 않아요. 오픈채팅에 붙여넣으면 전문가에게만 전달돼요.
          </p>
        </div>
      </div>
    </div>
  )
}
