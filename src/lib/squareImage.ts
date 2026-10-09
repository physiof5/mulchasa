// 대표 사진을 정사각형으로 맞추는 도우미 (브라우저에서만 실행)
// 가운데를 기준으로 정사각형으로 자르고, 긴 변 1080px 이하 JPEG로 줄여 올린다.

export const PHOTO_MAX = 3
export const PHOTO_SIZE = 1080
const MAX_INPUT_BYTES = 20 * 1024 * 1024

export async function toSquareJpeg(file: File, size = PHOTO_SIZE): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 올릴 수 있어요.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('사진이 너무 커요. 20MB 이하로 골라 주세요.')

  let bitmap: ImageBitmap
  try {
    // 휴대폰 사진의 회전 정보(EXIF)를 반영해서 읽는다
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('이 사진 형식은 열 수 없어요. JPG나 PNG로 골라 주세요.')
  }

  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  const out = Math.min(size, side)

  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('사진을 처리하지 못했어요.')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out, out)
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('사진을 처리하지 못했어요.'))), 'image/jpeg', 0.86)
  })
}

/** 저장된 대표 사진 목록 정리 — 비어 있으면 예전 프로필 사진 1장을 대신 쓴다 */
export function pickPhotos(photoUrls: unknown, fallback?: string | null): string[] {
  const list = Array.isArray(photoUrls)
    ? photoUrls.filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, PHOTO_MAX)
    : []
  if (list.length === 0 && fallback) return [fallback]
  return list
}
