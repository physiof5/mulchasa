-- ============================================================
-- Day 15 · 전문가 모드: 스케줄 관리
-- Supabase → SQL Editor → New query → 이 파일 전체 붙여 넣기 → Run
-- ※ day13_phase2.sql 을 먼저 실행해 두세요. 여러 번 실행해도 안전해요.
-- ============================================================

-- ── 1. 전문가 일정 (본인만 보고 고침) ──────────────────────────
create table if not exists public.expert_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'visit' check (kind in ('visit', 'center', 'consult', 'personal', 'off')),
  title text not null check (char_length(title) between 1 and 60),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  place text not null default '' check (char_length(place) <= 60),
  memo text not null default '' check (char_length(memo) <= 300),
  room_id uuid references public.chat_rooms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expert_schedule_time_check check (ends_at > starts_at and ends_at - starts_at <= interval '24 hours')
);
create index if not exists expert_schedule_user_time_idx on public.expert_schedule (user_id, starts_at);

-- 전문가 프로필이 있는 계정인지 (승인 대기 포함)
create or replace function public.i_am_expert() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from therapists where user_id = auth.uid())
$$;

-- 내가 전문가로 참여한 대화방인지 (일정에 대화를 연결할 때)
create or replace function public.my_expert_room(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_room is null or exists (select 1 from chat_rooms where id = p_room and expert_user_id = auth.uid())
$$;

alter table public.expert_schedule enable row level security;
revoke all on public.expert_schedule from anon, authenticated;
grant select, insert, update, delete on public.expert_schedule to authenticated;

drop policy if exists "schedule own read" on public.expert_schedule;
create policy "schedule own read" on public.expert_schedule for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "schedule own insert" on public.expert_schedule;
create policy "schedule own insert" on public.expert_schedule for insert to authenticated
  with check (user_id = auth.uid() and public.i_am_expert() and public.my_expert_room(room_id));
drop policy if exists "schedule own update" on public.expert_schedule;
create policy "schedule own update" on public.expert_schedule for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.my_expert_room(room_id));
drop policy if exists "schedule own delete" on public.expert_schedule;
create policy "schedule own delete" on public.expert_schedule for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists expert_schedule_touch on public.expert_schedule;
create trigger expert_schedule_touch before update on public.expert_schedule
  for each row execute function public.touch_updated_at();

revoke execute on function public.i_am_expert() from public, anon;
grant execute on function public.i_am_expert() to authenticated;
revoke execute on function public.my_expert_room(uuid) from public, anon;
grant execute on function public.my_expert_room(uuid) to authenticated;


-- ── 2. 보관 기간 정리에 '지난 일정 1년' 추가 ──────────────────────
create or replace function public.purge_old_chats() returns void
language sql security definer set search_path = public as $$
  delete from chat_rooms where last_message_at < now() - interval '180 days';
  delete from consult_requests r
   where r.expires_at < now() - interval '30 days'
     and not exists (select 1 from chat_rooms c where c.consult_id = r.id);
  delete from chat_reports where status = 'done' and handled_at < now() - interval '365 days';
  delete from expert_schedule where ends_at < now() - interval '365 days';
$$;
revoke execute on function public.purge_old_chats() from public, anon, authenticated;
