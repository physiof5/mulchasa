-- day19 보안 점검 수정 (2026-10-17)
-- 1) therapists: RLS 켜기 · 공개 읽기는 승인된 전문가만 · 수정은 본인만 · 삭제 불가
-- 2) therapist_tags / tags / reviews: RLS 켜기 · 비로그인 쓰기 회수
-- 3) Storage: profiles 버킷 '누구나 올리기·덮어쓰기' 정책 삭제 → 본인 전문가 사진만
--            (기존 'therapist photos …' 정책의 name 칸 오류도 바로잡음) · reviews 버킷 익명 올리기 삭제
-- 4) 트리거 함수 직접 호출 막기 · search_path 고정

-- 1) therapists ----------------------------------------------------------
alter table public.therapists enable row level security;

revoke insert, update, delete, truncate, references, trigger on public.therapists from anon;
revoke delete, truncate, references, trigger on public.therapists from authenticated;

drop policy if exists "therapists public read verified" on public.therapists;
create policy "therapists public read verified" on public.therapists
  for select to anon, authenticated
  using (verification_status = 'verified');

drop policy if exists "therapists owner update" on public.therapists;
create policy "therapists owner update" on public.therapists
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- 기존 유지: "therapists owner read"(본인 읽기) · "therapists owner insert"(본인 등록, pending)

-- 관리 칸 보호 트리거: id·created_at도 고정 + search_path 고정
create or replace function public.therapists_guard_admin_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.verification_status := 'pending';
      new.subscribed_until := null;
      new.license_checked_at := null;
    else
      new.id := old.id;
      new.created_at := old.created_at;
      new.verification_status := old.verification_status;
      new.subscribed_until := old.subscribed_until;
      new.license_checked_at := old.license_checked_at;
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end $$;

-- 2) therapist_tags / tags / reviews -------------------------------------
alter table public.therapist_tags enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.therapist_tags from anon;
revoke update, truncate, references, trigger on public.therapist_tags from authenticated;

drop policy if exists "therapist_tags public read" on public.therapist_tags;
create policy "therapist_tags public read" on public.therapist_tags
  for select to anon, authenticated using (true);

drop policy if exists "therapist_tags owner insert" on public.therapist_tags;
create policy "therapist_tags owner insert" on public.therapist_tags
  for insert to authenticated
  with check (exists (select 1 from public.therapists t where t.id = therapist_id and t.user_id = auth.uid()));

drop policy if exists "therapist_tags owner delete" on public.therapist_tags;
create policy "therapist_tags owner delete" on public.therapist_tags
  for delete to authenticated
  using (exists (select 1 from public.therapists t where t.id = therapist_id and t.user_id = auth.uid()));

alter table public.tags enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.tags from anon, authenticated;
drop policy if exists "tags public read" on public.tags;
create policy "tags public read" on public.tags
  for select to anon, authenticated using (true);

-- reviews: 예전 후기 표(사용 안 함, 0건) — 읽기만 남기고 쓰기 회수
alter table public.reviews enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.reviews from anon, authenticated;
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews
  for select to anon, authenticated using (true);

-- 3) Storage --------------------------------------------------------------
drop policy if exists "Public Upload" on storage.objects;
drop policy if exists "Public Update" on storage.objects;
drop policy if exists "reviews anon upload" on storage.objects;

-- 대표 사진: profiles/<전문가id>.<확장자> (본인만, 덮어쓰기 포함)
drop policy if exists "profile image insert own" on storage.objects;
create policy "profile image insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profiles'
    and position('/' in objects.name) = 0
    and exists (select 1 from public.therapists t
                where t.user_id = auth.uid() and t.id::text = split_part(objects.name, '.', 1))
  );

drop policy if exists "profile image update own" on storage.objects;
create policy "profile image update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profiles'
    and position('/' in objects.name) = 0
    and exists (select 1 from public.therapists t
                where t.user_id = auth.uid() and t.id::text = split_part(objects.name, '.', 1))
  );

-- 활동 사진: profiles/photos/<전문가id>/... (기존 정책이 t.name을 읽던 오류 수정)
drop policy if exists "therapist photos insert own" on storage.objects;
create policy "therapist photos insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profiles'
    and (storage.foldername(objects.name))[1] = 'photos'
    and exists (select 1 from public.therapists t
                where t.user_id = auth.uid() and t.id::text = (storage.foldername(objects.name))[2])
  );

drop policy if exists "therapist photos update own" on storage.objects;
create policy "therapist photos update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profiles'
    and (storage.foldername(objects.name))[1] = 'photos'
    and exists (select 1 from public.therapists t
                where t.user_id = auth.uid() and t.id::text = (storage.foldername(objects.name))[2])
  );

drop policy if exists "therapist photos delete own" on storage.objects;
create policy "therapist photos delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profiles'
    and (storage.foldername(objects.name))[1] = 'photos'
    and exists (select 1 from public.therapists t
                where t.user_id = auth.uid() and t.id::text = (storage.foldername(objects.name))[2])
  );

-- 4) 함수 정리 ------------------------------------------------------------
-- 트리거 함수는 /rest/v1/rpc 로 직접 부를 이유가 없음 (트리거 실행에는 영향 없음)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- search_path 고정 (보안 점검 경고)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_distance_km','km_between','pick_values','touch_updated_at',
                        'crew_tier','visit_when','crew_mission_target','mission_progress')
  loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;
