'use client'

// 사진 모자이크 — 손가락으로 네모를 그리면 그 부분이 모자이크돼요 (얼굴·이름표·주소 등)
// · 긴 변 1600px 이하 JPEG로 다시 만들어 올리므로 사진 속 촬영 정보(위치·기기)는 지워져요
// · 모두 이 기기 안에서 처리하고, 원본 사진은 어디에도 올리지 않아요

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GREEN, GREEN_DARK, GREEN_LIGHT } from '@/components/ConsultParts'

const MAX_SIDE = 1600
const MAX_INPUT_BYTES = 20 * 1024 * 1024

type Rect = { x: number; y: number; w: number; h: number }

export default function MosaicEditor({ file, onDone, onCancel }: { file: File; onDone: (blob: Blob, preview: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const original = useRef<ImageData | null>(null)
  const history = useRef<ImageData[]>([])
  const start = useRef<{ x: number; y: number } | null>(null)
  const [drag, setDrag] = useState<{ img: Rect; screen: Rect } | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [count, setCount] = useState(0)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)

  // 사진 읽기 → 줄여서 캔버스에
  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!file.type.startsWith('image/')) throw new Error('사진 파일만 올릴 수 있어요.')
      if (file.size > MAX_INPUT_BYTES) throw new Error('사진이 너무 커요. 20MB 이하로 골라 주세요.')
      let bitmap: ImageBitmap
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      } catch {
        throw new Error('이 사진 형식은 열 수 없어요. JPG나 PNG로 골라 주세요.')
      }
      const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
      const w = Math.round(bitmap.width * k)
      const h = Math.round(bitmap.height * k)
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d', { willReadFrequently: true })
      if (!canvas || !ctx) throw new Error('사진을 처리하지 못했어요.')
      canvas.width = w
      canvas.height = h
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(bitmap, 0, 0, w, h)
      bitmap.close()
      original.current = ctx.getImageData(0, 0, w, h)
    }
    load()
      .then(() => alive && setReady(true))
      .catch((e: Error) => alive && setError(e.message || '사진을 열지 못했어요.'))
    return () => {
      alive = false
    }
  }, [file])

  // 화면 좌표 → 사진 좌표
  const toImage = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(canvas.width, ((clientX - r.left) / r.width) * canvas.width)),
      y: Math.max(0, Math.min(canvas.height, ((clientY - r.top) / r.height) * canvas.height)),
    }
  }
  const toScreen = (rect: Rect): Rect => {
    const canvas = canvasRef.current
    if (!canvas) return rect
    const k = canvas.getBoundingClientRect().width / canvas.width
    return { x: rect.x * k, y: rect.y * k, w: rect.w * k, h: rect.h * k }
  }

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!ready || busy) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = toImage(e.clientX, e.clientY)
    const r = { ...start.current, w: 0, h: 0 }
    setDrag({ img: r, screen: toScreen(r) })
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current) return
    const p = toImage(e.clientX, e.clientY)
    const s = start.current
    const r = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }
    setDrag({ img: r, screen: toScreen(r) })
  }
  const onUp = () => {
    const rect = drag?.img
    start.current = null
    setDrag(null)
    if (!rect || rect.w < 8 || rect.h < 8) return
    pixelate(rect)
  }

  const pixelate = (rect: Rect) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !ctx) return
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (history.current.length > 15) history.current.shift()
    // 네모 크기에 맞춰 칸을 크게 (가린 얼굴을 알아보기 어렵게)
    const block = Math.max(14, Math.round(Math.max(canvas.width, canvas.height) / 40), Math.round(Math.min(rect.w, rect.h) / 7))
    const x0 = Math.floor(rect.x)
    const y0 = Math.floor(rect.y)
    const w = Math.ceil(rect.w)
    const h = Math.ceil(rect.h)
    const img = ctx.getImageData(x0, y0, w, h)
    const d = img.data
    for (let by = 0; by < h; by += block) {
      for (let bx = 0; bx < w; bx += block) {
        let r = 0, g = 0, b = 0, n = 0
        const ex = Math.min(bx + block, w)
        const ey = Math.min(by + block, h)
        for (let y = by; y < ey; y++) {
          for (let x = bx; x < ex; x++) {
            const i = (y * w + x) * 4
            r += d[i]
            g += d[i + 1]
            b += d[i + 2]
            n++
          }
        }
        r = Math.round(r / n)
        g = Math.round(g / n)
        b = Math.round(b / n)
        for (let y = by; y < ey; y++) {
          for (let x = bx; x < ex; x++) {
            const i = (y * w + x) * 4
            d[i] = r
            d[i + 1] = g
            d[i + 2] = b
            d[i + 3] = 255
          }
        }
      }
    }
    ctx.putImageData(img, x0, y0)
    setCount((c) => c + 1)
  }

  const undo = () => {
    const canvas = canvasRef.current
    const prev = history.current.pop()
    if (!canvas || !prev) return
    canvas.getContext('2d')?.putImageData(prev, 0, 0)
    setCount((c) => Math.max(0, c - 1))
  }

  const reset = () => {
    const canvas = canvasRef.current
    if (!canvas || !original.current) return
    canvas.getContext('2d')?.putImageData(original.current, 0, 0)
    history.current = []
    setCount(0)
  }

  const finish = () => {
    const canvas = canvasRef.current
    if (!canvas || !checked || busy) return
    setBusy(true)
    canvas.toBlob(
      (b) => {
        setBusy(false)
        if (!b) return setError('사진을 처리하지 못했어요.')
        onDone(b, URL.createObjectURL(b))
      },
      'image/jpeg',
      0.86
    )
  }

  const shown = drag?.screen ?? null

  return (
    <div className="fixed inset-0 z-[60] bg-gray-950 flex flex-col" role="dialog" aria-modal="true" aria-label="사진 모자이크">
      <div className="flex items-center px-2 py-1.5 text-white shrink-0">
        <button type="button" onClick={onCancel} className="min-h-[48px] px-3 text-[16px] font-semibold text-white/80">
          취소
        </button>
        <p className="flex-1 text-center text-[17px] font-bold">얼굴 가리기</p>
        <button type="button" onClick={undo} disabled={count === 0} className="min-h-[48px] px-3 text-[16px] font-semibold disabled:text-white/30">
          되돌리기
        </button>
      </div>
      <p className="px-5 pb-2 text-[14px] text-white/80 leading-snug shrink-0">
        얼굴·이름표·주소·집 안 사진처럼 누구인지 알 수 있는 부분을 <b className="text-white">손가락으로 네모 그려</b> 가려 주세요. 여러 번 그릴 수 있어요.
      </p>

      <div className="flex-1 min-h-0 flex items-center justify-center px-3 overflow-hidden">
        {error ? (
          <p className="text-[16px] text-white text-center px-6">{error}</p>
        ) : (
          <div
            ref={boxRef}
            className="relative max-w-full max-h-full select-none"
            style={{ touchAction: 'none' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <canvas ref={canvasRef} className="block max-w-full max-h-[calc(100dvh-300px)] w-auto h-auto" />
            {!ready && <p className="absolute inset-0 flex items-center justify-center text-white/80 text-[15px]">사진을 여는 중...</p>}
            {shown && <span className="absolute border-2 border-white bg-white/25 pointer-events-none" style={{ left: shown.x, top: shown.y, width: shown.w, height: shown.h }} />}
          </div>
        )}
      </div>

      <div className="bg-white rounded-t-3xl px-5 pt-4 shrink-0" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 w-6 h-6 accent-[#0A8A7B] shrink-0" />
          <span className="text-[15px] text-gray-800 leading-snug">
            얼굴을 가렸어요 <span className="text-gray-500">(또는 얼굴·이름표 등이 나오지 않은 사진이에요)</span>
          </span>
        </label>
        <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
          <button type="button" onClick={reset} disabled={count === 0} className="min-h-[52px] rounded-xl border border-gray-200 text-[15px] font-semibold text-gray-600 disabled:text-gray-300">
            처음부터
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={!ready || !checked || busy}
            className="min-h-[52px] rounded-xl text-[16px] font-bold text-white disabled:bg-gray-200 disabled:text-gray-400"
            style={{ background: !ready || !checked || busy ? undefined : GREEN }}
          >
            {busy ? '만드는 중...' : count > 0 ? `${count}곳 가림 · 이 사진 쓰기` : '이 사진 쓰기'}
          </button>
        </div>
        <p className="text-[12px] mt-2 text-center leading-snug" style={{ color: GREEN_DARK, background: GREEN_LIGHT, borderRadius: 8, padding: '6px 8px' }}>
          사진 속 촬영 위치·기기 정보는 지우고 올려요
        </p>
      </div>
    </div>
  )
}
