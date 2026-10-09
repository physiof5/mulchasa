'use client'

// 사진을 고르면 바로 뜨는 '정사각형 맞추기' 화면
// 한 손가락(마우스) 끌기 = 위치 옮기기 / 두 손가락 벌리기·아래 막대·마우스 휠 = 확대
// 확인을 누르면 보이는 정사각형 그대로 1080px JPEG로 만든다.

import { useCallback, useEffect, useRef, useState } from 'react'
import { PHOTO_SIZE } from '@/lib/squareImage'

const MAX_ZOOM = 4
const MAX_INPUT_BYTES = 20 * 1024 * 1024

/** 처음 모습: 사진이 틀을 꽉 채우고 가운데 */
function centered(bmp: ImageBitmap, frame: number): View {
  const s = frame / Math.min(bmp.width, bmp.height)
  return { zoom: 1, x: (frame - bmp.width * s) / 2, y: (frame - bmp.height * s) / 2 }
}

interface View {
  zoom: number
  x: number // 사진 왼쪽 위 모서리의 틀 안 위치(px)
  y: number
}

export default function SquareCropper({
  file,
  round = false,
  title = '정사각형으로 맞추기',
  step,
  onCancel,
  onDone,
}: {
  file: File
  /** 프로필 사진처럼 동그랗게 보일 때 안내 원 표시 */
  round?: boolean
  title?: string
  /** 여러 장일 때 '1/3' 표시 */
  step?: string
  onCancel: () => void
  onDone: (blob: Blob) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [frame, setFrame] = useState(() => (typeof window === 'undefined' ? 320 : Math.min(window.innerWidth - 32, 400)))
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)

  // 사진 읽기 (휴대폰 사진의 회전 정보 반영)
  useEffect(() => {
    let alive = true
    const url = URL.createObjectURL(file)
    if (!file.type.startsWith('image/') || file.size > MAX_INPUT_BYTES) {
      Promise.resolve().then(() => alive && setError(file.size > MAX_INPUT_BYTES ? '사진이 너무 커요. 20MB 이하로 골라 주세요.' : '사진 파일만 올릴 수 있어요.'))
    } else {
      createImageBitmap(file, { imageOrientation: 'from-image' })
        .then((bmp) => {
          if (!alive) return bmp.close()
          setBitmap(bmp)
          setSrc(url)
          setView(centered(bmp, Math.min(window.innerWidth - 32, 400)))
        })
        .catch(() => alive && setError('이 사진 형식은 열 수 없어요. JPG나 PNG로 골라 주세요.'))
    }
    return () => {
      alive = false
      URL.revokeObjectURL(url)
    }
  }, [file])

  // 화면 폭이 바뀌면 틀 크기를 다시 맞추고 가운데로
  useEffect(() => {
    const measure = () => {
      const f = Math.min(window.innerWidth - 32, 400)
      setFrame(f)
      if (bitmap) setView(centered(bitmap, f))
    }
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [bitmap])

  const base = bitmap ? frame / Math.min(bitmap.width, bitmap.height) : 1

  // 사진이 틀을 늘 꽉 채우도록 위치를 묶어 둔다
  const clamp = useCallback(
    (v: View): View => {
      if (!bitmap) return v
      const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom))
      const s = base * zoom
      const w = bitmap.width * s
      const h = bitmap.height * s
      return { zoom, x: Math.min(0, Math.max(frame - w, v.x)), y: Math.min(0, Math.max(frame - h, v.y)) }
    },
    [bitmap, base, frame]
  )

  // 틀 안의 한 점(cx, cy)을 기준으로 확대·축소
  const zoomAt = useCallback(
    (nextZoom: number, cx = frame / 2, cy = frame / 2) => {
      setView((v) => {
        const z = Math.min(MAX_ZOOM, Math.max(1, nextZoom))
        const k = z / v.zoom
        return clamp({ zoom: z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k })
      })
    },
    [clamp, frame]
  )

  const local = (e: React.PointerEvent) => {
    const r = frameRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, local(e))
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const now = local(e)
    pointers.current.set(e.pointerId, now)
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values())
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      zoomAt((pinch.current.zoom * dist) / pinch.current.dist, (a.x + b.x) / 2, (a.y + b.y) / 2)
    } else if (pointers.current.size === 1) {
      setView((v) => clamp({ ...v, x: v.x + now.x - prev.x, y: v.y + now.y - prev.y }))
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  const onWheel = (e: React.WheelEvent) => {
    const r = frameRef.current!.getBoundingClientRect()
    zoomAt(view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top)
  }

  const confirm = async () => {
    if (!bitmap) return
    setBusy(true)
    const s = base * view.zoom
    const side = frame / s
    const sx = -view.x / s
    const sy = -view.y / s
    const out = Math.round(Math.min(PHOTO_SIZE, side))
    const canvas = document.createElement('canvas')
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('사진을 처리하지 못했어요.')
      setBusy(false)
      return
    }
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, out, out)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out)
    canvas.toBlob(
      (b) => {
        setBusy(false)
        if (b) onDone(b)
        else setError('사진을 처리하지 못했어요.')
      },
      'image/jpeg',
      0.88
    )
  }

  const s = base * view.zoom

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-w-md w-full mx-auto flex items-center justify-between px-4 h-14 text-white">
        <button type="button" onClick={onCancel} className="min-w-[48px] min-h-[48px] text-[16px] text-white/80">
          취소
        </button>
        <p className="text-[16px] font-bold">
          {title}
          {step && <span className="text-white/60 font-semibold ml-1.5">{step}</span>}
        </p>
        <button
          type="button"
          onClick={confirm}
          disabled={!bitmap || busy}
          className="min-w-[48px] min-h-[48px] text-[16px] font-bold disabled:opacity-40"
          style={{ color: '#5EEAD4' }}
        >
          {busy ? '처리 중' : '완료'}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {error ? (
          <div className="text-center">
            <p className="text-white text-[16px] leading-relaxed">{error}</p>
            <button type="button" onClick={onCancel} className="mt-4 min-h-[48px] px-6 rounded-xl bg-white text-gray-900 font-bold">
              다른 사진 고르기
            </button>
          </div>
        ) : (
          <>
            <div
              ref={frameRef}
              className="relative overflow-hidden bg-gray-800 touch-none select-none cursor-grab active:cursor-grabbing"
              style={{ width: frame, height: frame }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
            >
              {src && bitmap && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className="absolute max-w-none pointer-events-none"
                  style={{ left: view.x, top: view.y, width: bitmap.width * s, height: bitmap.height * s }}
                />
              )}
              {/* 3×3 안내선 */}
              <div className="absolute inset-0 pointer-events-none border-2 border-white/90">
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
              </div>
              {round && (
                <div
                  className="absolute inset-0 pointer-events-none rounded-full"
                  style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)', border: '2px solid rgba(255,255,255,0.9)' }}
                />
              )}
            </div>

            <p className="text-white/70 text-[14px] mt-4 text-center leading-relaxed">
              끌어서 위치를 옮기고, 두 손가락이나 아래 막대로 확대해 주세요
            </p>

            <div className="w-full max-w-[400px] flex items-center gap-3 mt-4">
              <button type="button" aria-label="축소" onClick={() => zoomAt(view.zoom - 0.25)} className="w-12 h-12 rounded-full bg-white/15 text-white text-2xl">
                −
              </button>
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={view.zoom}
                onChange={(e) => zoomAt(Number(e.target.value))}
                aria-label="확대"
                className="flex-1 accent-teal-400"
              />
              <button type="button" aria-label="확대" onClick={() => zoomAt(view.zoom + 0.25)} className="w-12 h-12 rounded-full bg-white/15 text-white text-2xl">
                +
              </button>
            </div>
          </>
        )}
      </div>

      <div className="max-w-md w-full mx-auto px-4 pb-6 pt-2">
        <button
          type="button"
          onClick={confirm}
          disabled={!bitmap || busy || !!error}
          className="w-full min-h-[56px] rounded-2xl text-[17px] font-bold text-white disabled:opacity-40"
          style={{ background: '#0A8A7B' }}
        >
          {busy ? '처리 중...' : '이대로 사용하기'}
        </button>
      </div>
    </div>
  )
}
