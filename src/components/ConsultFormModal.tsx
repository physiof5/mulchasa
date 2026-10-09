'use client'

import { useState } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  therapistName: string
  kakaoLink: string
  bodyPart: string | null
  purpose: string | null
  initialDuration?: string
  initialPainLevel?: number
}

const SYMPTOM_DURATION = [
  { value: '1주 이내', label: '1주 이내' },
  { value: '1개월 이내', label: '1개월 이내' },
  { value: '3개월 이내', label: '3개월 이내' },
  { value: '3개월 이상', label: '3개월 이상' },
]

const CONSULT_TIMING = [
  { value: 'immediate', label: '⚡ 즉시 상담' },
  { value: 'today', label: '🌞 오늘 중' },
  { value: 'scheduled', label: '📅 예약 상담' },
]

export default function ConsultFormModal({
  isOpen,
  onClose,
  therapistName,
  kakaoLink,
  bodyPart,
  purpose,
  initialDuration,
  initialPainLevel,
}: Props) {
  // 설문에서 넘어온 값을 초기값으로 사용 (없으면 기존 기본값)
  const [duration, setDuration] = useState<string>(initialDuration ?? '')
  const [painLevel, setPainLevel] = useState<number>(initialPainLevel ?? 5)
  const [timing, setTiming] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const timingLabel = CONSULT_TIMING.find(t => t.value === timing)?.label || ''

  const generateMessage = () => {
    return `안녕하세요, 물찾사를 통해 연락드립니다.

📍 부위: ${bodyPart || '-'}
🎯 목적: ${purpose || '-'}
⏰ 증상 시작: ${duration || '-'}
💢 통증 강도: ${painLevel}/10
🕐 상담 방식: ${timingLabel.replace(/[⚡🌞📅]\s/, '') || '-'}${note ? `\n\n💬 전달사항:\n${note}` : ''}

편하신 시간에 답장 부탁드립니다.`
  }

  const handleCopyAndOpen = async () => {
    const message = generateMessage()
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => {
        window.open(kakaoLink, '_blank')
      }, 500)
    } catch (err) {
      console.error('복사 실패:', err)
      window.open(kakaoLink, '_blank')
    }
  }

  const isValid = duration && timing

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{therapistName}님께 상담 요청</h2>
            <p className="text-xs text-gray-400 mt-1">증상 정보를 전달하면 빠른 답변을 받을 수 있어요</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        <div className="px-5 py-5 space-y-6">
          <div>
            <p className="text-sm font-bold text-gray-700 mb-3">⏰ 증상이 언제부터 시작되었나요?</p>
            <div className="grid grid-cols-2 gap-2">
              {SYMPTOM_DURATION.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={
                    'py-3 rounded-xl text-sm font-semibold transition-all ' +
                    (duration === d.value
                      ? 'bg-[#0A8A7B] text-white'
                      : 'bg-gray-50 text-gray-600 border border-gray-100')
                  }
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-700">💢 통증 강도는 어느 정도인가요?</p>
              <span className="text-lg font-bold text-[#0A8A7B]">{painLevel}/10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={painLevel}
              onChange={(e) => setPainLevel(Number(e.target.value))}
              className="w-full accent-[#0A8A7B]"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>약함</span>
              <span>보통</span>
              <span>심함</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-gray-700 mb-3">🕐 언제 상담받고 싶으세요?</p>
            <div className="space-y-2">
              {CONSULT_TIMING.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTiming(t.value)}
                  className={
                    'w-full py-3 rounded-xl text-sm font-semibold transition-all text-left px-4 ' +
                    (timing === t.value
                      ? 'bg-[#0A8A7B] text-white'
                      : 'bg-gray-50 text-gray-600 border border-gray-100')
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-gray-700 mb-3">💬 추가로 전하실 내용 (선택)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 오전에 특히 뻣뻣해요, 운동 후에 더 심해집니다 등"
              className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-[#0A8A7B]"
              rows={3}
            />
          </div>

          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-500 mb-2">📋 미리보기</p>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
              {generateMessage()}
            </pre>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleCopyAndOpen}
            disabled={!isValid}
            className={
              'w-full py-4 rounded-2xl text-base font-bold transition-all ' +
              (isValid
                ? 'bg-[#FEE500] text-gray-900 active:scale-[0.98]'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed')
            }
          >
            {copied ? '✓ 복사 완료! 카톡 여는 중...' : '💬 메시지 복사하고 카톡 열기'}
          </button>
          <p className="text-xs text-gray-400 text-center mt-3">
            카톡 오픈채팅에 들어가서 붙여넣기만 하시면 돼요
          </p>
        </div>
      </div>
    </div>
  )
}
