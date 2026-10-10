import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// 매거진 대표 이미지 올리기 (공개 버킷 magazine) — 관리자만
const MAX = 5 * 1024 * 1024
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function POST(req: NextRequest) {
  const token = req.cookies.get('mulchasa_admin')?.value
  if (!token || token !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '파일이 없어요' }, { status: 400 })
  const ext = TYPES[file.type]
  if (!ext) return NextResponse.json({ error: 'JPG·PNG·WEBP만 올릴 수 있어요' }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: '5MB 이하로 올려 주세요' }, { status: 400 })

  const path = `covers/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabaseAdmin.storage.from('magazine').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type })
  if (error) return NextResponse.json({ error: '올리지 못했어요 (magazine 버킷이 있는지 확인)' }, { status: 500 })
  return NextResponse.json({ url: supabaseAdmin.storage.from('magazine').getPublicUrl(path).data.publicUrl })
}
