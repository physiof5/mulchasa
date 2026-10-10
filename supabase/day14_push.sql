-- ============================================================
-- Day 14 · 알림(웹 푸시): 상담 수락 · 새 메시지 · 근처 새 상담 요청
-- Supabase → SQL Editor → New query → 이 파일 전체 붙여 넣기 → Run
-- ※ day13_phase2.sql 을 먼저 실행해 두세요. 여러 번 실행해도 안전해요.
-- ============================================================

-- ── 1. 알림 받을 기기 (브라우저·홈 화면 앱마다 1줄) ─────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

drop policy if exists "push own read" on public.push_subscriptions;
create policy "push own read" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists "push own delete" on public.push_subscriptions;
create policy "push own delete" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- 이 기기를 내 알림 기기로 저장 (같은 기기를 다른 계정이 쓰던 경우 내 것으로 옮김, 계정당 최근 10대까지)
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000
     or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'bad_input';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, left(p_p256dh, 200), left(p_auth, 100), left(coalesce(p_ua, ''), 200));
  delete from push_subscriptions
   where user_id = auth.uid()
     and id not in (select id from push_subscriptions where user_id = auth.uid() order by created_at desc limit 10);
end $$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;


-- ── 2. 같은 알림을 두 번 보내지 않도록 표시 칸 (서버만 씀) ─────────
alter table public.chat_messages add column if not exists pushed_at timestamptz;
alter table public.chat_rooms add column if not exists accept_pushed_at timestamptz;
alter table public.consult_requests add column if not exists push_sent_at timestamptz;


-- ── 3. 새 상담 요청을 알릴 전문가 (받은 요청 목록과 같은 기준: 승인 + 거리) ──
create or replace function public.consult_push_targets(p_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select t.user_id
  from consult_requests r
  join therapists t on t.verification_status = 'verified' and t.user_id is not null and t.user_id <> r.user_id
  where r.id = p_id
    and r.status = 'open'
    and least(km_between(t.latitude, t.longitude, r.lat, r.lng), km_between(t.center_lat, t.center_lng, r.lat, r.lng))
        <= greatest(coalesce(t.visit_radius_km, 0), 20)
$$;


-- ── 4. 실행 권한 ─────────────────────────────────────────────
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
revoke execute on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.remove_push_subscription(text) to authenticated;
-- 알림 대상 찾기는 서버(service_role)만
revoke execute on function public.consult_push_targets(uuid) from public, anon, authenticated;
grant execute on function public.consult_push_targets(uuid) to service_role;
