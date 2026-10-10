-- ============================================================
-- Day 13 · 2단계: 상담 요청 · 무료 채팅 · 구독(운영자가 켜기)
-- Supabase → SQL Editor → New query → 이 파일 전체 붙여 넣기 → Run
-- ※ day12_phase1.sql 을 먼저 실행해 두세요. 이 파일은 여러 번 실행해도 안전해요.
-- ============================================================


-- ── 0. 전문가 표: 구독 칸 + 운영자만 바꾸는 칸 보호 ─────────────
alter table public.therapists add column if not exists subscribed_until date;
-- (앞 단계 칸이 빠져 있어도 아래 함수가 만들어지도록 한 번 더 확인)
alter table public.therapists add column if not exists photo_urls text[];
alter table public.therapists add column if not exists center_lat double precision;
alter table public.therapists add column if not exists center_lng double precision;
alter table public.therapists add column if not exists license_photo_path text;
alter table public.therapists add column if not exists license_checked_at timestamptz;
grant select (photo_urls, center_lat, center_lng) on public.therapists to anon, authenticated;

-- 승인 상태·구독 기간·면허 확인 시각·계정 연결은 운영자(서버)만 바꿀 수 있게.
-- 회원 화면에서 이 칸을 보내면 조용히 원래 값으로 되돌린다(나머지 프로필 저장은 그대로 됨).
create or replace function public.therapists_guard_admin_fields() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.verification_status := 'pending';
      new.subscribed_until := null;
      new.license_checked_at := null;
    else
      new.verification_status := old.verification_status;
      new.subscribed_until := old.subscribed_until;
      new.license_checked_at := old.license_checked_at;
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists therapists_guard_admin_fields on public.therapists;
create trigger therapists_guard_admin_fields
  before insert or update on public.therapists
  for each row execute function public.therapists_guard_admin_fields();


-- ── 1. 거리 계산 (km) ─────────────────────────────────────────
create or replace function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))
$$;

-- 정해진 선택지만 남기기 (배열 아닌 값·모르는 값은 버림)
create or replace function public.pick_values(p jsonb, allowed text[])
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(distinct v), '[]'::jsonb)
  from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) as v
  where v = any (allowed)
$$;


-- ── 2. 표 ────────────────────────────────────────────────────
-- 상담 요청서: 보호자가 낸 상태 설문. 위치는 동네 수준(소수 둘째 자리, 약 1km)으로만 보관
create table if not exists public.consult_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null,
  note text not null default '',
  area_label text not null default '',
  lat double precision not null,
  lng double precision not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  accepted_count int not null default 0,
  sensitive_agreed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);
create index if not exists consult_requests_user_idx on public.consult_requests (user_id, created_at desc);
create index if not exists consult_requests_open_idx on public.consult_requests (created_at desc) where status = 'open';

-- 대화방: 전문가가 수락하면 1개 생김 (요청서 1건에 최대 3개)
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  consult_id uuid references public.consult_requests(id) on delete cascade,
  guardian_id uuid not null references auth.users(id) on delete cascade,
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  expert_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_message text not null default '',
  last_sender uuid,
  guardian_read_at timestamptz not null default to_timestamp(0),
  expert_read_at timestamptz not null default to_timestamp(0),
  blocked_by uuid,
  admin_blocked boolean not null default false
);
create unique index if not exists chat_rooms_consult_therapist_key on public.chat_rooms (consult_id, therapist_id);
create index if not exists chat_rooms_guardian_idx on public.chat_rooms (guardian_id, last_message_at desc);
create index if not exists chat_rooms_expert_idx on public.chat_rooms (expert_user_id, last_message_at desc);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'system')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_room_idx on public.chat_messages (room_id, id);

-- 신고: 신고 시점의 최근 대화 50개를 함께 보관(대화가 지워져도 확인할 수 있게)
create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.chat_rooms(id) on delete set null,
  reporter_id uuid references auth.users(id) on delete set null,
  reporter_role text not null,
  reason text not null,
  detail text not null default '',
  snapshot jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);


-- ── 3. 접근 규칙 (RLS) ───────────────────────────────────────
alter table public.consult_requests enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reports enable row level security;

revoke all on public.consult_requests, public.chat_rooms, public.chat_messages, public.chat_reports from anon, authenticated;
grant select, delete on public.consult_requests to authenticated;
grant select on public.chat_rooms to authenticated;
grant select, insert on public.chat_messages to authenticated;
-- chat_reports: 회원은 직접 읽기·쓰기 없음 (신고 함수로만 저장, 관리자는 서버에서 확인)

create or replace function public.is_room_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_rooms where id = p_room and (guardian_id = auth.uid() or expert_user_id = auth.uid()))
$$;

create or replace function public.can_send(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from chat_rooms
    where id = p_room and (guardian_id = auth.uid() or expert_user_id = auth.uid())
      and blocked_by is null and not admin_blocked
  )
$$;

drop policy if exists "consult owner read" on public.consult_requests;
create policy "consult owner read" on public.consult_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists "consult owner delete" on public.consult_requests;
create policy "consult owner delete" on public.consult_requests for delete to authenticated using (user_id = auth.uid());

drop policy if exists "room members read" on public.chat_rooms;
create policy "room members read" on public.chat_rooms for select to authenticated
  using (guardian_id = auth.uid() or expert_user_id = auth.uid());

drop policy if exists "messages members read" on public.chat_messages;
create policy "messages members read" on public.chat_messages for select to authenticated
  using (public.is_room_member(room_id));
drop policy if exists "messages members send" on public.chat_messages;
create policy "messages members send" on public.chat_messages for insert to authenticated
  with check (sender_id = auth.uid() and kind = 'text' and public.can_send(room_id));


-- ── 4. 메시지 저장 전후 처리 ─────────────────────────────────
create or replace function public.chat_messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  new.body := btrim(new.body);
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if (select count(*) from chat_messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
      raise exception 'too_fast';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists chat_messages_before_insert on public.chat_messages;
create trigger chat_messages_before_insert before insert on public.chat_messages
  for each row execute function public.chat_messages_before_insert();

create or replace function public.chat_messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update chat_rooms set
    last_message_at = new.created_at,
    last_message = left(new.body, 100),
    last_sender = new.sender_id,
    guardian_read_at = case when new.sender_id = guardian_id then new.created_at else guardian_read_at end,
    expert_read_at = case when new.sender_id = expert_user_id then new.created_at else expert_read_at end
  where id = new.room_id;
  return null;
end $$;
drop trigger if exists chat_messages_after_insert on public.chat_messages;
create trigger chat_messages_after_insert after insert on public.chat_messages
  for each row execute function public.chat_messages_after_insert();


-- ── 5. 화면에서 부르는 함수 ──────────────────────────────────
-- 내 전문가 상태 (승인·구독) — 전문가가 아니면 null
create or replace function public.my_expert() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'verified', t.verification_status = 'verified',
    'subscribed_until', t.subscribed_until,
    'subscribed', t.subscribed_until is not null and t.subscribed_until >= (now() at time zone 'Asia/Seoul')::date
  )
  from therapists t where t.user_id = auth.uid() limit 1
$$;

-- 상담 요청서 내기 (정해진 선택지만 저장, 하루 3건·진행 중 3건까지)
create or replace function public.create_consult(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_answers jsonb;
  v_conditions jsonb := pick_values(p->'conditions', array['stroke','parkinson','dementia','surgery','joint','frail']);
  v_wants jsonb := pick_values(p->'wants', array['home_exercise','fall_safety','visit','center','cost_schedule','welfare']);
  v_lat double precision := round(((p->>'lat')::numeric), 2);
  v_lng double precision := round(((p->>'lng')::numeric), 2);
  v_id uuid;
begin
  if v_uid is null then raise exception 'login_required'; end if;
  if coalesce((p->>'agree')::boolean, false) is not true then raise exception 'consent_required'; end if;
  if coalesce(p->>'who', '') not in ('mother','father','spouse','self','other')
    or coalesce(p->>'age', '') not in ('65plus','under65')
    or coalesce(p->>'mobility', '') not in ('independent','aid','assist','bed')
    or coalesce(p->>'fell', '') not in ('yes','no','unknown')
    or coalesce(p->>'place', '') not in ('home','center','both')
    or jsonb_array_length(v_conditions) = 0
    or jsonb_array_length(v_wants) = 0 then
    raise exception 'bad_input';
  end if;
  if v_lat is null or v_lng is null or v_lat not between 33 and 39 or v_lng not between 124 and 132 then
    raise exception 'bad_location';
  end if;
  if (select count(*) from consult_requests where user_id = v_uid and created_at > now() - interval '1 day') >= 3 then
    raise exception 'too_many_today';
  end if;
  if (select count(*) from consult_requests where user_id = v_uid and status = 'open' and expires_at > now()) >= 3 then
    raise exception 'too_many_open';
  end if;

  v_answers := jsonb_build_object(
    'who', p->>'who', 'age', p->>'age', 'mobility', p->>'mobility', 'fell', p->>'fell', 'place', p->>'place',
    'conditions', v_conditions, 'wants', v_wants
  );
  insert into consult_requests (user_id, answers, note, area_label, lat, lng, sensitive_agreed_at)
  values (v_uid, v_answers, left(btrim(coalesce(p->>'note', '')), 500), left(btrim(coalesce(p->>'area', '')), 30), v_lat, v_lng, now())
  returning id into v_id;
  return v_id;
end $$;

-- 전문가에게 보이는 요청 목록: 승인된 전문가 + 방문 기준·센터 주소 중 가까운 쪽에서
-- (이동 거리와 20km 중 큰 값) 안. 내가 수락한 요청은 마감돼도 계속 보임
create or replace function public.consult_feed() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t record;
  v jsonb;
begin
  select id, verification_status, latitude, longitude, center_lat, center_lng, visit_radius_km into t
  from therapists where user_id = auth.uid() limit 1;
  if t.id is null or t.verification_status <> 'verified' then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) into v
  from (
    select r.created_at, jsonb_build_object(
      'id', r.id, 'answers', r.answers, 'note', r.note, 'area_label', r.area_label,
      'created_at', r.created_at, 'expires_at', r.expires_at, 'status', r.status,
      'accepted_count', r.accepted_count, 'distance_km', round(d.km::numeric, 1), 'my_room_id', c.id
    ) as j
    from consult_requests r
    cross join lateral (
      select least(km_between(t.latitude, t.longitude, r.lat, r.lng), km_between(t.center_lat, t.center_lng, r.lat, r.lng)) as km
    ) d
    left join chat_rooms c on c.consult_id = r.id and c.therapist_id = t.id
    where r.user_id <> auth.uid()
      and (c.id is not null
           or (r.status = 'open' and r.expires_at > now() and d.km <= greatest(coalesce(t.visit_radius_km, 0), 20)))
    order by r.created_at desc
    limit 100
  ) x;
  return v;
end $$;

-- 요청서 하나 보기 (보호자 본인 = 수락한 전문가 목록 포함 / 전문가 = 볼 수 있는 범위일 때만)
create or replace function public.get_consult(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r consult_requests;
  t record;
  v_room uuid;
  v_dist double precision;
  v_rooms jsonb;
begin
  select * into r from consult_requests where id = p_id;
  if r.id is null then return null; end if;

  if r.user_id = auth.uid() then
    select coalesce(jsonb_agg(jsonb_build_object(
      'room_id', c.id, 'therapist_id', th.id, 'name', th.name, 'years', th.years_experience,
      'photo', coalesce(th.photo_urls[1], th.profile_image_url), 'studio', th.studio_name,
      'rating', rv.avg, 'reviews', coalesce(rv.n, 0),
      'last_message', c.last_message, 'last_message_at', c.last_message_at,
      'unread', (select count(*) from chat_messages m
                 where m.room_id = c.id and m.created_at > c.guardian_read_at and m.sender_id is distinct from auth.uid())
    ) order by c.created_at), '[]'::jsonb) into v_rooms
    from chat_rooms c
    join therapists th on th.id = c.therapist_id
    left join lateral (select round(avg(rating)::numeric, 1) as avg, count(*) as n from reviews where therapist_id = th.id) rv on true
    where c.consult_id = r.id;
    return jsonb_build_object('role', 'owner', 'consult', to_jsonb(r) - 'user_id' - 'lat' - 'lng', 'rooms', v_rooms);
  end if;

  select id, verification_status, latitude, longitude, center_lat, center_lng, visit_radius_km, subscribed_until into t
  from therapists where user_id = auth.uid() limit 1;
  if t.id is null or t.verification_status <> 'verified' then return null; end if;

  select id into v_room from chat_rooms where consult_id = r.id and therapist_id = t.id;
  v_dist := least(km_between(t.latitude, t.longitude, r.lat, r.lng), km_between(t.center_lat, t.center_lng, r.lat, r.lng));
  if v_room is null and (r.status <> 'open' or r.expires_at < now() or v_dist is null
                         or v_dist > greatest(coalesce(t.visit_radius_km, 0), 20)) then
    return null;
  end if;
  return jsonb_build_object(
    'role', 'expert',
    'consult', to_jsonb(r) - 'user_id' - 'lat' - 'lng',
    'distance_km', round(v_dist::numeric, 1),
    'my_room_id', v_room,
    'subscribed', t.subscribed_until is not null and t.subscribed_until >= (now() at time zone 'Asia/Seoul')::date
  );
end $$;

-- 상담 수락 → 대화방 열기 (승인 + 구독 중인 전문가만, 요청서 1건에 최대 3명, 동시에 눌러도 3명을 넘지 않게 잠금)
create or replace function public.accept_consult(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t record;
  r consult_requests;
  v_room uuid;
  v_dist double precision;
begin
  select id, user_id, name, verification_status, latitude, longitude, center_lat, center_lng, visit_radius_km, subscribed_until into t
  from therapists where user_id = auth.uid() limit 1;
  if t.id is null or t.verification_status <> 'verified' then raise exception 'not_expert'; end if;

  select * into r from consult_requests where id = p_id for update;
  if r.id is null then raise exception 'not_found'; end if;

  select id into v_room from chat_rooms where consult_id = p_id and therapist_id = t.id;
  if v_room is not null then return v_room; end if;

  if t.subscribed_until is null or t.subscribed_until < (now() at time zone 'Asia/Seoul')::date then raise exception 'not_subscribed'; end if;
  if r.user_id = auth.uid() then raise exception 'own_request'; end if;
  if r.status <> 'open' or r.expires_at < now() then raise exception 'closed'; end if;
  if r.accepted_count >= 3 then raise exception 'full'; end if;
  v_dist := least(km_between(t.latitude, t.longitude, r.lat, r.lng), km_between(t.center_lat, t.center_lng, r.lat, r.lng));
  if v_dist is null or v_dist > greatest(coalesce(t.visit_radius_km, 0), 20) then raise exception 'too_far'; end if;

  insert into chat_rooms (consult_id, guardian_id, therapist_id, expert_user_id)
  values (p_id, r.user_id, t.id, t.user_id)
  returning id into v_room;
  update consult_requests set accepted_count = accepted_count + 1 where id = p_id;
  insert into chat_messages (room_id, sender_id, kind, body)
  values (v_room, t.user_id, 'system', t.name || '님이 상담 요청을 수락했어요. 궁금한 점을 편하게 물어보세요.');
  return v_room;
end $$;

-- 보호자가 요청 마감 (더는 수락받지 않음, 이미 열린 대화는 그대로)
create or replace function public.close_consult(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update consult_requests set status = 'closed' where id = p_id and user_id = auth.uid()
$$;

-- 내 대화방 목록
create or replace function public.my_chat_rooms() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(s.j order by s.last_at desc), '[]'::jsonb)
  from (
    select c.last_message_at as last_at, jsonb_build_object(
      'id', c.id,
      'role', case when c.guardian_id = auth.uid() then 'guardian' else 'expert' end,
      'therapist', jsonb_build_object('id', th.id, 'name', th.name, 'photo', coalesce(th.photo_urls[1], th.profile_image_url), 'years', th.years_experience),
      'consult', case when cr.id is null then null
                 else jsonb_build_object('id', cr.id, 'who', cr.answers->>'who', 'age', cr.answers->>'age', 'area_label', cr.area_label) end,
      'last_message', c.last_message,
      'last_message_at', c.last_message_at,
      'unread', (select count(*) from chat_messages m
                 where m.room_id = c.id and m.sender_id is distinct from auth.uid()
                   and m.created_at > case when c.guardian_id = auth.uid() then c.guardian_read_at else c.expert_read_at end),
      'blocked', c.blocked_by is not null or c.admin_blocked
    ) as j
    from chat_rooms c
    join therapists th on th.id = c.therapist_id
    left join consult_requests cr on cr.id = c.consult_id
    where c.guardian_id = auth.uid() or c.expert_user_id = auth.uid()
  ) s
$$;

-- 안 읽은 메시지 수 (하단 '채팅' 배지)
create or replace function public.my_unread_total() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from chat_messages m
  join chat_rooms c on c.id = m.room_id
  where m.sender_id is distinct from auth.uid()
    and ((c.guardian_id = auth.uid() and m.created_at > c.guardian_read_at)
         or (c.expert_user_id = auth.uid() and m.created_at > c.expert_read_at))
$$;

-- 대화방 정보 (상대 정보·요청서·차단 상태)
create or replace function public.get_room(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id,
    'role', case when c.guardian_id = auth.uid() then 'guardian' else 'expert' end,
    'therapist', jsonb_build_object(
      'id', th.id, 'name', th.name, 'photo', coalesce(th.photo_urls[1], th.profile_image_url),
      'years', th.years_experience, 'studio', th.studio_name, 'rating', rv.avg, 'reviews', coalesce(rv.n, 0)
    ),
    'consult', case when cr.id is null then null
               else jsonb_build_object('id', cr.id, 'answers', cr.answers, 'note', cr.note, 'area_label', cr.area_label, 'created_at', cr.created_at) end,
    'blocked', c.blocked_by is not null,
    'blocked_by_me', coalesce(c.blocked_by = auth.uid(), false),
    'admin_blocked', c.admin_blocked,
    'partner_read_at', case when c.guardian_id = auth.uid() then c.expert_read_at else c.guardian_read_at end
  )
  from chat_rooms c
  join therapists th on th.id = c.therapist_id
  left join consult_requests cr on cr.id = c.consult_id
  left join lateral (select round(avg(rating)::numeric, 1) as avg, count(*) as n from reviews where therapist_id = th.id) rv on true
  where c.id = p_id and (c.guardian_id = auth.uid() or c.expert_user_id = auth.uid())
$$;

create or replace function public.mark_room_read(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update chat_rooms set
    guardian_read_at = case when guardian_id = auth.uid() then now() else guardian_read_at end,
    expert_read_at = case when expert_user_id = auth.uid() then now() else expert_read_at end
  where id = p_id and (guardian_id = auth.uid() or expert_user_id = auth.uid())
$$;

-- 차단 / 차단 풀기 (차단하면 두 사람 모두 보낼 수 없음, 푸는 건 차단한 사람만)
create or replace function public.set_room_block(p_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_on then
    update chat_rooms set blocked_by = auth.uid()
    where id = p_id and blocked_by is null and (guardian_id = auth.uid() or expert_user_id = auth.uid());
  else
    update chat_rooms set blocked_by = null where id = p_id and blocked_by = auth.uid();
  end if;
end $$;

-- 신고 (최근 대화 50개를 함께 보관, 하루 10건까지)
create or replace function public.report_room(p_id uuid, p_reason text, p_detail text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c chat_rooms;
  v_snap jsonb;
begin
  select * into c from chat_rooms where id = p_id and (guardian_id = auth.uid() or expert_user_id = auth.uid());
  if c.id is null then raise exception 'not_found'; end if;
  if coalesce(p_reason, '') not in ('abuse','sexual','spam','money','medical','privacy','other') then raise exception 'bad_input'; end if;
  if (select count(*) from chat_reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many_today';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'who', case when m.kind = 'system' then 'system' when m.sender_id = c.guardian_id then 'guardian' when m.sender_id = c.expert_user_id then 'expert' else 'unknown' end,
    'body', m.body, 'at', m.created_at
  ) order by m.id), '[]'::jsonb) into v_snap
  from (select * from chat_messages where room_id = p_id order by id desc limit 50) m;
  insert into chat_reports (room_id, reporter_id, reporter_role, reason, detail, snapshot)
  values (p_id, auth.uid(), case when c.guardian_id = auth.uid() then 'guardian' else 'expert' end,
          p_reason, left(btrim(coalesce(p_detail, '')), 500), v_snap);
end $$;

-- 보관 기간이 지난 대화·요청서 지우기
--  · 대화방: 마지막 메시지 후 180일   · 연결 안 된 요청서: 받는 기간(14일) 끝나고 30일
--  · 처리 끝난 신고: 처리 후 1년
create or replace function public.purge_old_chats() returns void
language sql security definer set search_path = public as $$
  delete from chat_rooms where last_message_at < now() - interval '180 days';
  delete from consult_requests r
   where r.expires_at < now() - interval '30 days'
     and not exists (select 1 from chat_rooms c where c.consult_id = r.id);
  delete from chat_reports where status = 'done' and handled_at < now() - interval '365 days';
$$;


-- ── 6. 함수 실행 권한: 로그인한 회원만 (지우기 함수는 서버·예약 작업만) ──
do $$
declare f text;
begin
  foreach f in array array[
    'my_expert()', 'create_consult(jsonb)', 'consult_feed()', 'get_consult(uuid)', 'accept_consult(uuid)',
    'close_consult(uuid)', 'my_chat_rooms()', 'my_unread_total()', 'get_room(uuid)', 'mark_room_read(uuid)',
    'set_room_block(uuid, boolean)', 'report_room(uuid, text, text)', 'is_room_member(uuid)', 'can_send(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.purge_old_chats() from public, anon, authenticated;


-- ── 7. 실시간 대화 (새 메시지가 바로 보이게) ──────────────────
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then raise notice 'supabase_realtime 발행이 없어요 — Database → Publications 확인';
end $$;


-- ── 8. 매일 새벽 3시 30분(한국 시간) 자동 지우기 예약 ───────────
-- pg_cron 을 켤 수 없는 환경이면 건너뜀 (관리자 화면을 열 때도 한 번씩 지움)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('purge-old-chats', '30 18 * * *', 'select public.purge_old_chats()');
exception when others then
  raise notice '자동 지우기 예약을 건너뛰었어요: %', sqlerrm;
end $$;
