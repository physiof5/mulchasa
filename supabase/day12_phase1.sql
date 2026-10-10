-- ===== Day 12 (1단계) — Supabase SQL Editor에서 이 파일 전체를 한 번에 실행 =====

-- 1) 운동센터 위치 (센터 찾기 지도용) — 방문 기준 주소(집일 수 있음)와 분리
alter table public.therapists add column if not exists center_address text;
alter table public.therapists add column if not exists center_lat double precision;
alter table public.therapists add column if not exists center_lng double precision;
grant select (center_address, center_lat, center_lng) on public.therapists to anon, authenticated;

-- 기존 '센터만'(방문 안 함) 전문가는 지금 좌표가 곧 센터 주소 → 옮겨 둠
update public.therapists
   set center_lat = latitude, center_lng = longitude
 where center_lat is null and latitude is not null
   and work_types && array['center_owner','center_staff']::text[]
   and not (work_types && array['freelance_visit']::text[]);

-- 2) 매거진 (둘러보기 > 커뮤니티 '제도·복지 소식') — 읽기는 누구나(공개 글만), 쓰기는 관리자 서버만
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  summary text not null default '',
  body text not null default '',
  cover_url text,
  sources jsonb not null default '[]'::jsonb,
  effective_date date,
  checked_at date,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.articles enable row level security;
drop policy if exists "articles public read" on public.articles;
create policy "articles public read" on public.articles for select to anon, authenticated using (status = 'published');
grant select on public.articles to anon, authenticated;

-- 매거진 대표 이미지 (공개 버킷, 올리기는 관리자 서버만)
insert into storage.buckets (id, name, public) values ('magazine', 'magazine', true) on conflict (id) do nothing;
