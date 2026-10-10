import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ARTICLE_CATEGORIES, cleanSources } from '@/lib/articles'

// 매거진(제도·복지 소식) 관리 — 관리자 쿠키 확인 후 service role로만 쓰기
function authed(req: NextRequest) {
  const token = req.cookies.get('mulchasa_admin')?.value
  return !!token && token === process.env.ADMIN_PASSWORD
}

const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  const { data, error } = await supabaseAdmin.from('articles').select('*').order('updated_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: '목록을 불러오지 못했어요 (articles 표가 있는지 확인)' }, { status: 500 })
  return NextResponse.json({ articles: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  const b = await req.json().catch(() => null)
  if (!b) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })

  const title = String(b.title ?? '').trim().slice(0, 120)
  const category = String(b.category ?? '')
  if (!title) return NextResponse.json({ error: '제목을 넣어 주세요' }, { status: 400 })
  if (!(ARTICLE_CATEGORIES as readonly string[]).includes(category)) return NextResponse.json({ error: '분류를 골라 주세요' }, { status: 400 })
  const status = b.status === 'published' ? 'published' : 'draft'

  const row = {
    title,
    category,
    summary: String(b.summary ?? '').trim().slice(0, 300),
    body: String(b.body ?? '').slice(0, 20000),
    cover_url: typeof b.cover_url === 'string' && /^https:\/\//.test(b.cover_url) ? b.cover_url : null,
    sources: cleanSources(b.sources),
    effective_date: isDate(b.effective_date) ? b.effective_date : null,
    checked_at: isDate(b.checked_at) ? b.checked_at : null,
    status,
    updated_at: new Date().toISOString(),
  }

  if (b.id) {
    // 처음 공개할 때만 공개일을 찍음
    const { data: prev } = await supabaseAdmin.from('articles').select('published_at').eq('id', b.id).single()
    const published_at = status === 'published' ? prev?.published_at ?? new Date().toISOString() : prev?.published_at ?? null
    const { error } = await supabaseAdmin.from('articles').update({ ...row, published_at }).eq('id', b.id)
    if (error) return NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 })
    return NextResponse.json({ ok: true, id: b.id })
  }
  const { data, error } = await supabaseAdmin
    .from('articles')
    .insert({ ...row, published_at: status === 'published' ? new Date().toISOString() : null })
    .select('id')
    .single()
  if (error || !data) return NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  const { error } = await supabaseAdmin.from('articles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: '삭제하지 못했어요' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
