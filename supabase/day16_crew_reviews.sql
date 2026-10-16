-- ============================================================
-- Day 16 · 크루 + 진행 후기 (전문가가 쓰고 회원이 공개에 동의)
-- Supabase → SQL Editor → New query → 이 파일 전체 붙여 넣기 → Run
-- ※ day13 · day14 · day15 SQL 을 먼저 실행해 두세요. 여러 번 실행해도 안전해요.
-- ============================================================


-- ── 0. 신고 '위반 확인' 표시 (크루 스코어 감점에만 사용) ─────────────
alter table public.chat_reports add column if not exists upheld boolean not null default false;
-- 크루 스코어 '신뢰' 계산에 쓰는 칸 (없으면 만들어 둠)
alter table public.therapists add column if not exists certifications text[];
alter table public.therapists add column if not exists intro text;


-- ════════════════════════════════════════════════════════════
-- 1. 진행 후기
--    10회 이상 진행한 전문가가 사진 2~5장 + 양식으로 작성 → 회원이 공개에 동의해야 공개
--    회원 이름은 '김OO님'·'김 **님' 형식만, 얼굴은 모자이크 확인 필수
-- ════════════════════════════════════════════════════════════
create table if not exists public.case_reviews (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.chat_rooms(id) on delete set null,
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  expert_user_id uuid not null references auth.users(id) on delete cascade,
  guardian_id uuid references auth.users(id) on delete set null,
  member_label text not null,
  age_band text not null,
  sessions int not null,
  purpose text not null default '',
  first_state text not null,
  approach text not null,
  changes text not null,
  photos text[] not null,
  status text not null default 'pending' check (status in ('pending', 'published', 'declined', 'hidden')),
  hidden_by text check (hidden_by in ('member', 'expert', 'admin')),
  member_rating int check (member_rating between 1 and 5),
  member_comment text not null default '' check (char_length(member_comment) <= 100),
  decline_reason text not null default '' check (char_length(decline_reason) <= 200),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  published_at timestamptz,
  pushed_at timestamptz,
  decided_pushed_at timestamptz,
  submit_count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists case_reviews_room_key on public.case_reviews (room_id) where room_id is not null;
create index if not exists case_reviews_public_idx on public.case_reviews (therapist_id, published_at desc) where status = 'published';
create index if not exists case_reviews_expert_idx on public.case_reviews (expert_user_id, created_at desc);

alter table public.case_reviews enable row level security;
revoke all on public.case_reviews from anon, authenticated;
-- 공개된 후기만, 공개해도 되는 칸만 (회원 계정·대화방 연결 정보는 보이지 않음)
grant select (id, therapist_id, member_label, age_band, sessions, purpose, first_state, approach, changes, photos,
              status, member_rating, member_comment, published_at) on public.case_reviews to anon, authenticated;
drop policy if exists "case reviews published read" on public.case_reviews;
create policy "case reviews published read" on public.case_reviews for select to anon, authenticated
  using (status = 'published');

-- 사진 보관함 (공개 주소, 본인 폴더에만 올리고 지우기)
insert into storage.buckets (id, name, public) values ('case-reviews', 'case-reviews', true) on conflict (id) do nothing;
drop policy if exists "case review photos upload own folder" on storage.objects;
create policy "case review photos upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'case-reviews' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "case review photos delete own folder" on storage.objects;
create policy "case review photos delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'case-reviews' and (storage.foldername(name))[1] = auth.uid()::text);

-- 후기 내기 (새로 쓰기·고쳐서 다시 내기) → 회원에게 공개 동의 요청
create or replace function public.submit_case_review(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c chat_rooms;
  t record;
  v_id uuid;
  v_photos text[];
  v_prefix text := '/storage/v1/object/public/case-reviews/' || auth.uid()::text || '/';
  v_label text := btrim(coalesce(p->>'member_label', ''));
  v_age text := coalesce(p->>'age_band', '');
  v_sessions int := coalesce((p->>'sessions')::int, 0);
  v_first text := btrim(coalesce(p->>'first_state', ''));
  v_approach text := btrim(coalesce(p->>'approach', ''));
  v_changes text := btrim(coalesce(p->>'changes', ''));
  v_purpose text := left(btrim(coalesce(p->>'purpose', '')), 30);
  existing case_reviews;
begin
  select * into c from chat_rooms where id = (p->>'room_id')::uuid and expert_user_id = auth.uid();
  if c.id is null then raise exception 'not_found'; end if;
  if c.blocked_by is not null or c.admin_blocked then raise exception 'closed'; end if;
  select id, verification_status into t from therapists where user_id = auth.uid() limit 1;
  if t.id is null or t.verification_status <> 'verified' then raise exception 'not_expert'; end if;
  if coalesce((p->>'face_checked')::boolean, false) is not true then raise exception 'face_check_required'; end if;
  if v_label !~ '^[가-힣]{1,2} ?(OO|\*\*) ?님$' then raise exception 'bad_label'; end if;
  if v_age not in ('40대 이하', '50대', '60대', '70대', '80대', '90대 이상') then raise exception 'bad_input'; end if;
  if v_sessions < 10 or v_sessions > 300 then raise exception 'too_few_sessions'; end if;
  if char_length(v_first) not between 10 and 500 or char_length(v_approach) not between 10 and 800
     or char_length(v_changes) not between 10 and 500 then
    raise exception 'text_length';
  end if;
  select array_agg(x) into v_photos
  from jsonb_array_elements_text(case when jsonb_typeof(p->'photos') = 'array' then p->'photos' else '[]'::jsonb end) as x;
  if coalesce(cardinality(v_photos), 0) not between 2 and 5
     or exists (select 1 from unnest(v_photos) u where u !~ '^https://' or position(v_prefix in u) = 0) then
    raise exception 'bad_photos';
  end if;

  select * into existing from case_reviews where room_id = c.id;
  if existing.id is not null then
    if existing.status = 'published' then raise exception 'already_published'; end if;
    if existing.status = 'hidden' and existing.hidden_by = 'member' then raise exception 'withdrawn'; end if;
    -- 회원이 거절한 뒤 고쳐 내기는 2번까지 (같은 회원에게 반복 요청하지 않도록)
    if existing.submit_count >= 3 then raise exception 'too_many_submits'; end if;
    update case_reviews set
      member_label = v_label, age_band = v_age, sessions = v_sessions, purpose = v_purpose,
      first_state = v_first, approach = v_approach, changes = v_changes, photos = v_photos,
      status = 'pending', hidden_by = null, decline_reason = '', submitted_at = now(), decided_at = null,
      pushed_at = null, decided_pushed_at = null, submit_count = existing.submit_count + 1, updated_at = now()
    where id = existing.id
    returning id into v_id;
  else
    insert into case_reviews (room_id, therapist_id, expert_user_id, guardian_id, member_label, age_band, sessions, purpose,
                              first_state, approach, changes, photos)
    values (c.id, t.id, auth.uid(), c.guardian_id, v_label, v_age, v_sessions, v_purpose, v_first, v_approach, v_changes, v_photos)
    returning id into v_id;
  end if;
  insert into chat_messages (room_id, sender_id, kind, body)
  values (c.id, auth.uid(), 'system', '전문가가 진행 후기를 올리려고 해요. 내용을 확인하고 공개해도 될지 골라 주세요.');
  return v_id;
end $$;

-- 회원: 공개 동의 / 거절 (동의할 때 만족도 별점·한마디는 선택)
create or replace function public.decide_case_review(p_id uuid, p_approve boolean, p_rating int default null,
                                                     p_comment text default '', p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare r case_reviews;
begin
  select * into r from case_reviews where id = p_id and guardian_id = auth.uid() for update;
  if r.id is null then raise exception 'not_found'; end if;
  if r.status <> 'pending' then raise exception 'already_decided'; end if;
  if p_approve then
    update case_reviews set status = 'published', published_at = now(), decided_at = now(),
      member_rating = case when p_rating between 1 and 5 then p_rating else null end,
      member_comment = left(btrim(coalesce(p_comment, '')), 100), updated_at = now()
    where id = p_id;
  else
    update case_reviews set status = 'declined', decided_at = now(),
      decline_reason = left(btrim(coalesce(p_reason, '')), 200), updated_at = now()
    where id = p_id;
  end if;
  if r.room_id is not null then
    insert into chat_messages (room_id, sender_id, kind, body)
    values (r.room_id, auth.uid(), 'system',
            case when p_approve then '회원님이 진행 후기 공개에 동의했어요. 고맙습니다!' else '회원님이 진행 후기를 공개하지 않기로 했어요.' end);
  end if;
end $$;

-- 회원: 공개했던 후기 내리기 (언제든)
create or replace function public.withdraw_case_review(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update case_reviews set status = 'hidden', hidden_by = 'member', updated_at = now()
  where id = p_id and guardian_id = auth.uid() and status = 'published'
$$;

-- 전문가: 내 후기 숨기기 / 다시 보이기 (회원이 내린 후기는 다시 올릴 수 없음)
create or replace function public.set_case_review_hidden(p_id uuid, p_hidden boolean) returns void
language sql security definer set search_path = public as $$
  update case_reviews set
    status = case when p_hidden then 'hidden' else 'published' end,
    hidden_by = case when p_hidden then 'expert' else null end,
    updated_at = now()
  where id = p_id and expert_user_id = auth.uid()
    and ((p_hidden and status = 'published') or (not p_hidden and status = 'hidden' and hidden_by = 'expert'))
$$;

-- 전문가: 내 후기 지우기
create or replace function public.delete_case_review(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from case_reviews where id = p_id and expert_user_id = auth.uid()
$$;

-- 후기 한 편 보기 (공개 후기는 누구나, 확인 전 후기는 쓴 전문가와 해당 회원만)
create or replace function public.get_case_review(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', case when r.expert_user_id = auth.uid() then 'expert' when r.guardian_id = auth.uid() then 'member' else 'public' end,
    'review', to_jsonb(r) - 'expert_user_id' - 'guardian_id' - 'pushed_at' - 'decided_pushed_at'
              - case when r.expert_user_id = auth.uid() or r.guardian_id = auth.uid() then 'x' else 'room_id' end,
    'therapist', jsonb_build_object('id', t.id, 'name', t.name, 'photo', coalesce(t.photo_urls[1], t.profile_image_url),
                                    'years', t.years_experience, 'studio', t.studio_name)
  )
  from case_reviews r join therapists t on t.id = r.therapist_id
  where r.id = p_id and (r.status = 'published' or r.expert_user_id = auth.uid() or r.guardian_id = auth.uid())
$$;

-- 전문가: 내가 쓴 후기 목록 / 회원: 나에게 온 공개 동의 요청
create or replace function public.my_case_reviews() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'role', case when r.expert_user_id = auth.uid() then 'expert' else 'member' end,
    'member_label', r.member_label, 'age_band', r.age_band, 'sessions', r.sessions, 'status', r.status, 'hidden_by', r.hidden_by,
    'photo', r.photos[1], 'member_rating', r.member_rating, 'therapist_name', t.name,
    'submitted_at', r.submitted_at, 'published_at', r.published_at, 'room_id', r.room_id
  ) order by r.submitted_at desc), '[]'::jsonb)
  from case_reviews r join therapists t on t.id = r.therapist_id
  where r.expert_user_id = auth.uid() or r.guardian_id = auth.uid()
$$;


-- ════════════════════════════════════════════════════════════
-- 2. 크루 — 최대 10명, 대표 1 · 리더 2, 한 사람은 한 크루만
-- ════════════════════════════════════════════════════════════
create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 20),
  intro text not null default '' check (char_length(intro) <= 200),
  region text not null default '' check (char_length(region) <= 30),
  notice text not null default '' check (char_length(notice) <= 500),
  notice_at timestamptz,
  invite_code text not null unique,
  is_open boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists crews_name_key on public.crews (lower(btrim(name)));

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'leader', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create unique index if not exists crew_members_one_crew on public.crew_members (user_id);
create unique index if not exists crew_members_one_owner on public.crew_members (crew_id) where role = 'owner';

create table if not exists public.crew_join_requests (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  message text not null default '' check (char_length(message) <= 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'canceled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
create unique index if not exists crew_join_pending_key on public.crew_join_requests (crew_id, user_id) where status = 'pending';

create table if not exists public.crew_messages (
  id bigint generated always as identity primary key,
  crew_id uuid not null references public.crews(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'case', 'system', 'notice')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists crew_messages_crew_idx on public.crew_messages (crew_id, id);

-- 추천 연결: 일정이 안 되는 상담을 같은 크루원에게 추천 → 회원이 수락해야 새 대화방이 열림 (돈은 오가지 않음)
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.chat_rooms(id) on delete cascade,
  consult_id uuid references public.consult_requests(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  guardian_id uuid references auth.users(id) on delete cascade,
  from_user_id uuid references auth.users(id) on delete set null,
  from_therapist_id uuid references public.therapists(id) on delete set null,
  to_user_id uuid references auth.users(id) on delete set null,
  to_therapist_id uuid references public.therapists(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 200),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'canceled')),
  new_room_id uuid references public.chat_rooms(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  pushed_at timestamptz,
  decided_pushed_at timestamptz
);
create unique index if not exists referrals_pending_room on public.referrals (room_id) where status = 'pending';

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crew_join_requests enable row level security;
alter table public.crew_messages enable row level security;
alter table public.referrals enable row level security;
revoke all on public.crews, public.crew_members, public.crew_join_requests, public.crew_messages, public.referrals from anon, authenticated;
-- 크루 채팅만 화면에서 직접 읽고 씀 (실시간). 나머지는 함수로만
grant select, insert on public.crew_messages to authenticated;

create or replace function public.my_crew_id() returns uuid
language sql stable security definer set search_path = public as $$
  select crew_id from crew_members where user_id = auth.uid()
$$;

drop policy if exists "crew messages members read" on public.crew_messages;
create policy "crew messages members read" on public.crew_messages for select to authenticated
  using (crew_id = public.my_crew_id());
drop policy if exists "crew messages members send" on public.crew_messages;
create policy "crew messages members send" on public.crew_messages for insert to authenticated
  with check (sender_id = auth.uid() and kind in ('text', 'case') and crew_id = public.my_crew_id());

create or replace function public.crew_messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  new.body := btrim(new.body);
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if (select count(*) from crew_messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
      raise exception 'too_fast';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists crew_messages_before_insert on public.crew_messages;
create trigger crew_messages_before_insert before insert on public.crew_messages
  for each row execute function public.crew_messages_before_insert();

-- 크루 안내 메시지 (함수 안에서만)
create or replace function public.crew_say(p_crew uuid, p_kind text, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into crew_messages (crew_id, sender_id, kind, body) values (p_crew, auth.uid(), p_kind, left(p_body, 1000))
$$;

create or replace function public.new_invite_code() returns text
language plpgsql volatile set search_path = public as $$
declare v text;
begin
  loop
    v := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from crews where invite_code = v);
  end loop;
  return v;
end $$;

-- ── 스코어: 크루원 1인 100점 = 응답 30 + 만족 30 + 협업 20 + 신뢰 20 − 감점 (최근 90일) ──
create or replace function public.expert_score(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t record;
  v_total int; v_replied int;
  v_n int; v_sum numeric;
  v_sent int; v_recv int; v_cases int; v_reports int;
  s_resp numeric; s_sat numeric; s_collab numeric; s_trust numeric; s_pen numeric; s_all numeric;
begin
  select years_experience, certifications, photo_urls, profile_image_url, intro into t from therapists where user_id = p_user limit 1;

  -- 응답 30: 최근 90일 대화방 중 24시간 안에 내가 답한 비율 (기록이 없으면 절반, 24시간이 안 지난 방은 답했을 때만 셈)
  select count(*) filter (where x.replied or x.created_at < now() - interval '24 hours'), count(*) filter (where x.replied)
    into v_total, v_replied
  from (
    select c.created_at, exists (
             select 1 from chat_messages m where m.room_id = c.id and m.sender_id = p_user and m.kind = 'text'
               and m.created_at <= c.created_at + interval '24 hours') as replied
    from chat_rooms c where c.expert_user_id = p_user and c.created_at > now() - interval '90 days'
  ) x;
  s_resp := case when v_total = 0 then 15 else 30.0 * v_replied / v_total end;

  -- 만족 30: 회원 만족도 별점 (후기가 적으면 4점 쪽으로 당겨서 계산)
  select count(member_rating), coalesce(sum(member_rating), 0) into v_n, v_sum
  from case_reviews where expert_user_id = p_user and status = 'published' and member_rating is not null;
  s_sat := 30.0 * (((v_sum + 4.0 * 3) / (v_n + 3)) - 1) / 4;

  -- 협업 20: 추천이 회원 수락까지 이어짐(보냄 4점·받음 2점) + 크루 채팅 '케이스' 공유 1점
  select count(*) into v_sent from referrals where from_user_id = p_user and status = 'accepted' and decided_at > now() - interval '90 days';
  select count(*) into v_recv from referrals where to_user_id = p_user and status = 'accepted' and decided_at > now() - interval '90 days';
  select count(*) into v_cases from crew_messages where sender_id = p_user and kind = 'case' and created_at > now() - interval '90 days';
  s_collab := least(20, v_sent * 4 + v_recv * 2 + v_cases);

  -- 신뢰 20: 경력(최대 10) + 보유 자격(최대 5) + 사진 2 + 소개 30자 이상 3
  s_trust := least(10, coalesce(t.years_experience, 0))
           + least(5, case when jsonb_typeof(to_jsonb(t.certifications)) = 'array' then jsonb_array_length(to_jsonb(t.certifications)) else 0 end)
           + case when coalesce(cardinality(t.photo_urls), 0) > 0 or t.profile_image_url is not null then 2 else 0 end
           + case when char_length(coalesce(t.intro, '')) >= 30 then 3 else 0 end;

  -- 감점: 운영팀이 '위반 확인'한 회원 신고 1건당 5점 (최대 20)
  select count(*) into v_reports
  from chat_reports r join chat_rooms c on c.id = r.room_id
  where c.expert_user_id = p_user and r.reporter_role = 'guardian' and r.upheld and r.created_at > now() - interval '90 days';
  s_pen := least(20, v_reports * 5);

  s_all := greatest(0, least(100, s_resp + s_sat + s_collab + s_trust - s_pen));
  return jsonb_build_object(
    'total', round(s_all, 1), 'response', round(s_resp, 1), 'satisfaction', round(s_sat, 1),
    'collab', round(s_collab, 1), 'trust', round(s_trust, 1), 'penalty', round(s_pen, 1),
    'points', (select count(*) * 10 from referrals where from_user_id = p_user and status = 'accepted')
            + (select count(*) * 5 from referrals where to_user_id = p_user and status = 'accepted')
            + (select count(*) * 2 from crew_messages where sender_id = p_user and kind = 'case')
  );
end $$;

create or replace function public.crew_tier(p_score numeric) returns text
language sql immutable as $$
  select case when p_score >= 80 then '으뜸' when p_score >= 60 then '든든' else '새싹' end
$$;

create or replace function public.crew_score(p_crew uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select round(avg((expert_score(user_id)->>'total')::numeric), 1) from crew_members where crew_id = p_crew
$$;

-- 내 크루 (없으면 내가 보낸 가입 신청)
create or replace function public.my_crew() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m crew_members;
  c crews;
  v_members jsonb;
  v_score numeric;
  v_requests jsonb;
begin
  select * into m from crew_members where user_id = auth.uid();
  if m.crew_id is null then
    return jsonb_build_object('crew', null, 'my_requests', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'crew_id', r.crew_id, 'crew_name', cr.name, 'created_at', r.created_at)), '[]'::jsonb)
      from crew_join_requests r join crews cr on cr.id = r.crew_id
      where r.user_id = auth.uid() and r.status = 'pending'));
  end if;
  select * into c from crews where id = m.crew_id;

  select coalesce(jsonb_agg(x.j order by x.ord, x.joined_at), '[]'::jsonb), round(avg(x.total), 1)
    into v_members, v_score
  from (
    select cm.joined_at,
      case cm.role when 'owner' then 0 when 'leader' then 1 else 2 end as ord,
      (s->>'total')::numeric as total,
      jsonb_build_object(
        'user_id', cm.user_id, 'therapist_id', t.id, 'name', t.name, 'photo', coalesce(t.photo_urls[1], t.profile_image_url),
        'years', t.years_experience, 'role', cm.role, 'joined_at', cm.joined_at, 'verified', t.verification_status = 'verified',
        'score', case when cm.user_id = auth.uid() then s else s - 'penalty' end, 'me', cm.user_id = auth.uid()
      ) as j
    from crew_members cm
    join therapists t on t.id = cm.therapist_id
    cross join lateral (select expert_score(cm.user_id) as s) sc
    where cm.crew_id = c.id
  ) x;

  if m.role in ('owner', 'leader') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', t.name, 'photo', coalesce(t.photo_urls[1], t.profile_image_url), 'years', t.years_experience,
      'message', r.message, 'created_at', r.created_at
    ) order by r.created_at), '[]'::jsonb) into v_requests
    from crew_join_requests r join therapists t on t.id = r.therapist_id
    where r.crew_id = c.id and r.status = 'pending';
  end if;

  return jsonb_build_object(
    'crew', jsonb_build_object(
      'id', c.id, 'name', c.name, 'intro', c.intro, 'region', c.region, 'notice', c.notice, 'notice_at', c.notice_at,
      'is_open', c.is_open, 'created_at', c.created_at,
      'invite_code', case when m.role in ('owner', 'leader') then c.invite_code else null end
    ),
    'my_role', m.role,
    'members', v_members,
    'score', coalesce(v_score, 0),
    'tier', crew_tier(coalesce(v_score, 0)),
    'requests', coalesce(v_requests, '[]'::jsonb),
    'unread', (select count(*) from crew_messages where crew_id = c.id and created_at > m.last_read_at and sender_id is distinct from auth.uid())
  );
end $$;

create or replace function public.my_crew_unread() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select count(*)::int from crew_messages x where x.crew_id = m.crew_id and x.created_at > m.last_read_at
                     and x.sender_id is distinct from auth.uid()), 0)
  from crew_members m where m.user_id = auth.uid()
$$;

create or replace function public.mark_crew_read() returns void
language sql security definer set search_path = public as $$
  update crew_members set last_read_at = now() where user_id = auth.uid()
$$;

-- 크루 찾기 (가입을 받는 크루, 자리 있는 곳)
create or replace function public.search_crews(p_q text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.score desc nulls last, x.created_at desc), '[]'::jsonb)
  from (
    select c.created_at, s.score, jsonb_build_object(
      'id', c.id, 'name', c.name, 'region', c.region, 'intro', c.intro, 'members', n.cnt,
      'score', s.score, 'tier', crew_tier(coalesce(s.score, 0)),
      'requested', exists (select 1 from crew_join_requests r where r.crew_id = c.id and r.user_id = auth.uid() and r.status = 'pending')
    ) as j
    from crews c
    cross join lateral (select count(*) as cnt from crew_members m where m.crew_id = c.id) n
    cross join lateral (select crew_score(c.id) as score) s
    where c.is_open and n.cnt < 10
      and (coalesce(btrim(p_q), '') = '' or c.name ilike '%' || btrim(p_q) || '%' or c.region ilike '%' || btrim(p_q) || '%')
    order by c.created_at desc
    limit 30
  ) x
$$;

-- 승인된 전문가인지 확인하고 내 전문가 정보 돌려주기 (크루 함수 공통)
create or replace function public.require_verified_expert() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  select id into v from therapists where user_id = auth.uid() and verification_status = 'verified' limit 1;
  if v is null then raise exception 'not_expert'; end if;
  return v;
end $$;

create or replace function public.create_crew(p_name text, p_intro text, p_region text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := require_verified_expert(); v_id uuid;
begin
  if exists (select 1 from crew_members where user_id = auth.uid()) then raise exception 'already_in_crew'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 20 then raise exception 'bad_name'; end if;
  if exists (select 1 from crews where lower(btrim(name)) = lower(btrim(p_name))) then raise exception 'name_taken'; end if;
  insert into crews (name, intro, region, invite_code, created_by)
  values (btrim(p_name), left(btrim(coalesce(p_intro, '')), 200), left(btrim(coalesce(p_region, '')), 30), new_invite_code(), auth.uid())
  returning id into v_id;
  insert into crew_members (crew_id, user_id, therapist_id, role) values (v_id, auth.uid(), v_tid, 'owner');
  update crew_join_requests set status = 'canceled', decided_at = now() where user_id = auth.uid() and status = 'pending';
  perform crew_say(v_id, 'system', '크루가 만들어졌어요. 초대 코드로 동료를 불러 보세요.');
  return v_id;
end $$;

create or replace function public.request_join(p_crew uuid, p_message text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := require_verified_expert(); c crews; v_id uuid;
begin
  if exists (select 1 from crew_members where user_id = auth.uid()) then raise exception 'already_in_crew'; end if;
  select * into c from crews where id = p_crew;
  if c.id is null then raise exception 'not_found'; end if;
  if not c.is_open then raise exception 'crew_closed'; end if;
  if (select count(*) from crew_members where crew_id = c.id) >= 10 then raise exception 'crew_full'; end if;
  if (select count(*) from crew_join_requests where user_id = auth.uid() and status = 'pending') >= 3 then raise exception 'too_many_requests'; end if;
  if exists (select 1 from crew_join_requests where crew_id = c.id and user_id = auth.uid() and status = 'pending') then raise exception 'already_requested'; end if;
  insert into crew_join_requests (crew_id, user_id, therapist_id, message)
  values (c.id, auth.uid(), v_tid, left(btrim(coalesce(p_message, '')), 200))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.cancel_join(p_request uuid) returns void
language sql security definer set search_path = public as $$
  update crew_join_requests set status = 'canceled', decided_at = now()
  where id = p_request and user_id = auth.uid() and status = 'pending'
$$;

-- 크루에 넣기 (공통: 자리 확인은 크루 행을 잠근 뒤)
create or replace function public.crew_add_member(p_crew uuid, p_user uuid, p_tid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from crews where id = p_crew for update;
  if (select count(*) from crew_members where crew_id = p_crew) >= 10 then raise exception 'crew_full'; end if;
  if exists (select 1 from crew_members where user_id = p_user) then raise exception 'already_in_crew'; end if;
  insert into crew_members (crew_id, user_id, therapist_id, role) values (p_crew, p_user, p_tid, 'member');
  update crew_join_requests set status = 'canceled', decided_at = now() where user_id = p_user and status = 'pending' and crew_id <> p_crew;
end $$;

create or replace function public.join_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := require_verified_expert(); c crews; v_name text;
begin
  select * into c from crews where invite_code = upper(btrim(coalesce(p_code, '')));
  if c.id is null then raise exception 'bad_code'; end if;
  perform crew_add_member(c.id, auth.uid(), v_tid);
  update crew_join_requests set status = 'approved', decided_at = now() where crew_id = c.id and user_id = auth.uid() and status = 'pending';
  select name into v_name from therapists where id = v_tid;
  perform crew_say(c.id, 'system', v_name || '님이 초대 코드로 합류했어요. 반갑게 맞아 주세요!');
  return c.id;
end $$;

create or replace function public.decide_join(p_request uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r crew_join_requests; v_role text; v_name text;
begin
  select * into r from crew_join_requests where id = p_request and status = 'pending' for update;
  if r.id is null then raise exception 'not_found'; end if;
  select role into v_role from crew_members where crew_id = r.crew_id and user_id = auth.uid();
  if v_role is null or v_role not in ('owner', 'leader') then raise exception 'not_allowed'; end if;
  if p_approve then
    perform crew_add_member(r.crew_id, r.user_id, r.therapist_id);
    update crew_join_requests set status = 'approved', decided_at = now(), decided_by = auth.uid() where id = r.id;
    select name into v_name from therapists where id = r.therapist_id;
    perform crew_say(r.crew_id, 'system', v_name || '님이 크루에 합류했어요. 반갑게 맞아 주세요!');
  else
    update crew_join_requests set status = 'rejected', decided_at = now(), decided_by = auth.uid() where id = r.id;
  end if;
end $$;

create or replace function public.leave_crew() returns void
language plpgsql security definer set search_path = public as $$
declare m crew_members; v_name text;
begin
  select * into m from crew_members where user_id = auth.uid();
  if m.crew_id is null then raise exception 'not_found'; end if;
  if m.role = 'owner' then
    if exists (select 1 from crew_members where crew_id = m.crew_id and user_id <> auth.uid()) then raise exception 'owner_must_transfer'; end if;
    delete from crews where id = m.crew_id; -- 혼자 남은 대표가 나가면 크루를 닫음
    return;
  end if;
  delete from crew_members where crew_id = m.crew_id and user_id = auth.uid();
  select name into v_name from therapists where id = m.therapist_id;
  perform crew_say(m.crew_id, 'system', v_name || '님이 크루를 떠났어요.');
end $$;

-- 역할 바꾸기 (대표만): 리더 지정·해제(리더는 최대 2명), 대표 넘기기
create or replace function public.set_member_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare me crew_members; target crew_members; v_leaders int; v_name text;
begin
  select * into me from crew_members where user_id = auth.uid();
  if me.crew_id is null or me.role <> 'owner' then raise exception 'not_allowed'; end if;
  select * into target from crew_members where crew_id = me.crew_id and user_id = p_user;
  if target.user_id is null or p_user = auth.uid() then raise exception 'not_found'; end if;
  if p_role not in ('owner', 'leader', 'member') then raise exception 'bad_input'; end if;
  select name into v_name from therapists where id = target.therapist_id;
  select count(*) into v_leaders from crew_members where crew_id = me.crew_id and role = 'leader';

  if p_role = 'leader' then
    if target.role <> 'leader' and v_leaders >= 2 then raise exception 'too_many_leaders'; end if;
    update crew_members set role = 'leader' where crew_id = me.crew_id and user_id = p_user;
    perform crew_say(me.crew_id, 'system', v_name || '님이 리더가 됐어요.');
  elsif p_role = 'member' then
    update crew_members set role = 'member' where crew_id = me.crew_id and user_id = p_user;
  else
    -- 대표 넘기기: 나는 리더(자리가 없으면 크루원)로
    update crew_members set role = case when v_leaders - (case when target.role = 'leader' then 1 else 0 end) < 2 then 'leader' else 'member' end
    where crew_id = me.crew_id and user_id = auth.uid();
    update crew_members set role = 'owner' where crew_id = me.crew_id and user_id = p_user;
    perform crew_say(me.crew_id, 'system', v_name || '님이 새 대표가 됐어요.');
  end if;
end $$;

-- 내보내기 (대표: 누구나 / 리더: 크루원만)
create or replace function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me crew_members; target crew_members; v_name text;
begin
  select * into me from crew_members where user_id = auth.uid();
  select * into target from crew_members where crew_id = me.crew_id and user_id = p_user;
  if me.crew_id is null or target.user_id is null or p_user = auth.uid() then raise exception 'not_found'; end if;
  if not (me.role = 'owner' or (me.role = 'leader' and target.role = 'member')) then raise exception 'not_allowed'; end if;
  delete from crew_members where crew_id = me.crew_id and user_id = p_user;
  select name into v_name from therapists where id = target.therapist_id;
  perform crew_say(me.crew_id, 'system', v_name || '님이 크루에서 빠졌어요.');
end $$;

create or replace function public.update_crew(p_name text, p_intro text, p_region text, p_is_open boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me crew_members;
begin
  select * into me from crew_members where user_id = auth.uid();
  if me.crew_id is null or me.role <> 'owner' then raise exception 'not_allowed'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 20 then raise exception 'bad_name'; end if;
  if exists (select 1 from crews where lower(btrim(name)) = lower(btrim(p_name)) and id <> me.crew_id) then raise exception 'name_taken'; end if;
  update crews set name = btrim(p_name), intro = left(btrim(coalesce(p_intro, '')), 200), region = left(btrim(coalesce(p_region, '')), 30),
                   is_open = coalesce(p_is_open, true)
  where id = me.crew_id;
end $$;

create or replace function public.set_crew_notice(p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare me crew_members; v text := left(btrim(coalesce(p_text, '')), 500);
begin
  select * into me from crew_members where user_id = auth.uid();
  if me.crew_id is null or me.role not in ('owner', 'leader') then raise exception 'not_allowed'; end if;
  update crews set notice = v, notice_at = case when v = '' then null else now() end where id = me.crew_id;
  if v <> '' then perform crew_say(me.crew_id, 'notice', v); end if;
end $$;

create or replace function public.regen_invite_code() returns text
language plpgsql security definer set search_path = public as $$
declare me crew_members; v text;
begin
  select * into me from crew_members where user_id = auth.uid();
  if me.crew_id is null or me.role not in ('owner', 'leader') then raise exception 'not_allowed'; end if;
  v := new_invite_code();
  update crews set invite_code = v where id = me.crew_id;
  return v;
end $$;

create or replace function public.disband_crew() returns void
language plpgsql security definer set search_path = public as $$
declare me crew_members;
begin
  select * into me from crew_members where user_id = auth.uid();
  if me.crew_id is null or me.role <> 'owner' then raise exception 'not_allowed'; end if;
  delete from crews where id = me.crew_id;
end $$;

-- 크루 등급 배지 (프로필·전문가 목록) — 누구나
create or replace function public.crew_badges(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('therapist_id', m.therapist_id, 'crew', c.name, 'tier', crew_tier(coalesce(crew_score(c.id), 0)))), '[]'::jsonb)
  from crew_members m join crews c on c.id = m.crew_id
  where m.therapist_id = any (p_ids)
$$;


-- ── 3. 추천 연결 (회원이 수락해야 새 대화방) ─────────────────────
-- 추천할 수 있는 크루원 (승인된 전문가, 이 상담에 아직 대화방이 없는 사람)
create or replace function public.crew_referral_candidates(p_room uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c chat_rooms; r consult_requests; v_crew uuid;
begin
  select * into c from chat_rooms where id = p_room and expert_user_id = auth.uid();
  if c.id is null then return '[]'::jsonb; end if;
  select * into r from consult_requests where id = c.consult_id;
  select crew_id into v_crew from crew_members where user_id = auth.uid();
  if v_crew is null then return '[]'::jsonb; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'name', t.name, 'photo', coalesce(t.photo_urls[1], t.profile_image_url), 'years', t.years_experience,
      'role', m.role,
      'distance_km', case when r.id is null then null
                     else round(least(km_between(t.latitude, t.longitude, r.lat, r.lng), km_between(t.center_lat, t.center_lng, r.lat, r.lng))::numeric, 1) end
    ) order by t.name), '[]'::jsonb)
    from crew_members m join therapists t on t.id = m.therapist_id
    where m.crew_id = v_crew and m.user_id <> auth.uid() and t.verification_status = 'verified'
      and not exists (select 1 from chat_rooms x where x.consult_id = c.consult_id and x.therapist_id = t.id)
  );
end $$;

create or replace function public.create_referral(p_room uuid, p_to_user uuid, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c chat_rooms; v_crew uuid; v_from uuid; tt record; v_from_name text; v_id uuid;
begin
  select * into c from chat_rooms where id = p_room and expert_user_id = auth.uid();
  if c.id is null or c.consult_id is null then raise exception 'not_found'; end if;
  if c.blocked_by is not null or c.admin_blocked then raise exception 'closed'; end if;
  select crew_id into v_crew from crew_members where user_id = auth.uid();
  if v_crew is null then raise exception 'no_crew'; end if;
  select t.id, t.name, t.years_experience into tt
  from crew_members m join therapists t on t.id = m.therapist_id
  where m.crew_id = v_crew and m.user_id = p_to_user and p_to_user <> auth.uid() and t.verification_status = 'verified';
  if tt.id is null then raise exception 'not_found'; end if;
  if exists (select 1 from chat_rooms where consult_id = c.consult_id and therapist_id = tt.id) then raise exception 'already_connected'; end if;
  if exists (select 1 from referrals where room_id = c.id and status = 'pending') then raise exception 'already_requested'; end if;
  select id, name into v_from, v_from_name from therapists where user_id = auth.uid() limit 1;
  insert into referrals (room_id, consult_id, crew_id, guardian_id, from_user_id, from_therapist_id, to_user_id, to_therapist_id, note)
  values (c.id, c.consult_id, v_crew, c.guardian_id, auth.uid(), v_from, p_to_user, tt.id, left(btrim(coalesce(p_note, '')), 200))
  returning id into v_id;
  insert into chat_messages (room_id, sender_id, kind, body)
  values (c.id, auth.uid(), 'system', v_from_name || '님이 같은 크루의 ' || tt.name || '님(물리치료사' ||
          case when tt.years_experience is not null then ' · 경력 ' || tt.years_experience || '년' else '' end ||
          ')을 추천했어요. 연결할지 골라 주세요.');
  return v_id;
end $$;

create or replace function public.cancel_referral(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare f referrals;
begin
  update referrals set status = 'canceled', decided_at = now()
  where id = p_id and from_user_id = auth.uid() and status = 'pending'
  returning * into f;
  if f.id is not null then
    insert into chat_messages (room_id, sender_id, kind, body) values (f.room_id, auth.uid(), 'system', '전문가가 추천을 거두었어요.');
  end if;
end $$;

-- 회원: 추천 연결 수락(새 대화방) / 사양
create or replace function public.answer_referral(p_id uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare f referrals; v_room uuid; v_to_name text; v_from_name text;
begin
  select * into f from referrals where id = p_id and guardian_id = auth.uid() for update;
  if f.id is null then raise exception 'not_found'; end if;
  if f.status <> 'pending' then raise exception 'already_decided'; end if;
  select name into v_to_name from therapists where id = f.to_therapist_id;
  select name into v_from_name from therapists where id = f.from_therapist_id;
  if not p_accept then
    update referrals set status = 'declined', decided_at = now() where id = f.id;
    insert into chat_messages (room_id, sender_id, kind, body) values (f.room_id, auth.uid(), 'system', '회원님이 추천을 사양했어요.');
    return null;
  end if;
  if not exists (select 1 from therapists where id = f.to_therapist_id and verification_status = 'verified') then raise exception 'not_expert'; end if;
  select id into v_room from chat_rooms where consult_id = f.consult_id and therapist_id = f.to_therapist_id;
  if v_room is null then
    insert into chat_rooms (consult_id, guardian_id, therapist_id, expert_user_id)
    values (f.consult_id, f.guardian_id, f.to_therapist_id, f.to_user_id)
    returning id into v_room;
    insert into chat_messages (room_id, sender_id, kind, body)
    values (v_room, f.to_user_id, 'system', coalesce(v_from_name, '크루원') || '님의 추천으로 ' || coalesce(v_to_name, '전문가') || '님과 연결됐어요. 궁금한 점을 편하게 물어보세요.');
  end if;
  update referrals set status = 'accepted', decided_at = now(), new_room_id = v_room where id = f.id;
  insert into chat_messages (room_id, sender_id, kind, body)
  values (f.room_id, auth.uid(), 'system', '회원님이 추천받은 ' || coalesce(v_to_name, '전문가') || '님과 연결했어요.');
  return v_room;
end $$;


-- ── 4. 대화방·요청서 정보 다시 만들기 (평점 = 공개 후기의 회원 만족도, 추천·후기 상태 추가) ──
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
    left join lateral (select round(avg(member_rating)::numeric, 1) as avg, count(*) as n
                       from case_reviews where therapist_id = th.id and status = 'published') rv on true
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
    'partner_read_at', case when c.guardian_id = auth.uid() then c.expert_read_at else c.guardian_read_at end,
    'has_crew', c.expert_user_id = auth.uid() and exists (select 1 from crew_members where user_id = auth.uid()),
    'review', (select jsonb_build_object('id', v.id, 'status', v.status) from case_reviews v where v.room_id = c.id),
    'referral', (
      select jsonb_build_object(
        'id', f.id, 'note', f.note, 'mine', f.from_user_id = auth.uid(),
        'from_name', ft.name,
        'to', jsonb_build_object('therapist_id', tt.id, 'name', tt.name, 'photo', coalesce(tt.photo_urls[1], tt.profile_image_url), 'years', tt.years_experience)
      )
      from referrals f
      join therapists tt on tt.id = f.to_therapist_id
      left join therapists ft on ft.id = f.from_therapist_id
      where f.room_id = c.id and f.status = 'pending'
      order by f.created_at desc limit 1
    )
  )
  from chat_rooms c
  join therapists th on th.id = c.therapist_id
  left join consult_requests cr on cr.id = c.consult_id
  left join lateral (select round(avg(member_rating)::numeric, 1) as avg, count(*) as n
                     from case_reviews where therapist_id = th.id and status = 'published') rv on true
  where c.id = p_id and (c.guardian_id = auth.uid() or c.expert_user_id = auth.uid())
$$;


-- ── 5. 보관 기간 정리 + 실행 권한 + 실시간 ─────────────────────────
create or replace function public.purge_old_chats() returns void
language sql security definer set search_path = public as $$
  delete from chat_rooms where last_message_at < now() - interval '180 days';
  delete from consult_requests r
   where r.expires_at < now() - interval '30 days'
     and not exists (select 1 from chat_rooms c where c.consult_id = r.id);
  delete from chat_reports where status = 'done' and handled_at < now() - interval '365 days';
  delete from expert_schedule where ends_at < now() - interval '365 days';
  delete from crew_messages where created_at < now() - interval '365 days';
  delete from case_reviews where status = 'declined' and decided_at < now() - interval '90 days';
  delete from crew_join_requests where status <> 'pending' and created_at < now() - interval '180 days';
$$;
revoke execute on function public.purge_old_chats() from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'submit_case_review(jsonb)', 'decide_case_review(uuid, boolean, integer, text, text)', 'withdraw_case_review(uuid)',
    'set_case_review_hidden(uuid, boolean)', 'delete_case_review(uuid)', 'my_case_reviews()',
    'my_crew_id()', 'my_crew()', 'my_crew_unread()', 'mark_crew_read()', 'search_crews(text)', 'create_crew(text, text, text)',
    'request_join(uuid, text)', 'cancel_join(uuid)', 'join_by_code(text)', 'decide_join(uuid, boolean)', 'leave_crew()',
    'set_member_role(uuid, text)', 'remove_member(uuid)', 'update_crew(text, text, text, boolean)', 'set_crew_notice(text)',
    'regen_invite_code()', 'disband_crew()', 'crew_referral_candidates(uuid)', 'create_referral(uuid, uuid, text)',
    'cancel_referral(uuid)', 'answer_referral(uuid, boolean)', 'get_consult(uuid)', 'get_room(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- 함수 안에서만 쓰는 것
  foreach f in array array[
    'crew_say(uuid, text, text)', 'crew_add_member(uuid, uuid, uuid)', 'new_invite_code()', 'require_verified_expert()',
    'expert_score(uuid)', 'crew_score(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
-- 누구나 보는 것 (공개 후기·크루 배지)
grant execute on function public.get_case_review(uuid) to anon, authenticated;
grant execute on function public.crew_badges(uuid[]) to anon, authenticated;
grant execute on function public.crew_tier(numeric) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.crew_messages;
exception
  when duplicate_object then null;
  when undefined_object then raise notice 'supabase_realtime 발행이 없어요 — Database → Publications 확인';
end $$;
