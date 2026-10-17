-- ============================================================
-- Day 18 · 크루 2판
--  · 개인 점수 = 응답 30 · 기록 30 · 협업 20 · 프로필 20 − 감점
--  · 크루 점수 = 크루원 개인 점수 합산 + 크루 활동 점수(최근 90일) → 평균을 쓰지 않아 내보낼 이유가 없음
--  · 가입 하한: 프로필 4항목(경력·보유 자격·사진·소개 30자) 모두 필수 + 크루별 최소 점수(선택 40·50)
--  · 가입 방식: '승인 후 합류' / '바로 참여'
--  · 내보내기 보호: 사유 필수 · 한 달 2명까지 · 내보낸 크루원의 활동 기록은 크루에 남음
--  · 월간 미션 배지 5단계(파랑→초록→노랑→빨강→보라), 달성하면 한 단계 위, 절반 이상이면 유지, 미만이면 한 단계 아래
--  · '도와주세요' 질문과 답 채택 · 좋아요(하트) · 신입 버디(요청을 넘겨주며 인수인계·질문으로 돕기, 방문은 신입이 직접)
--  · 회원 요청서에 '경력 3년 이상 선생님만' 선택 · 추천할 때 인수인계 메모
-- Supabase → SQL Editor → New query → 이 파일 전체 붙여 넣기 → Run
-- ※ day16 · day17 SQL 을 먼저 실행해 두세요. 여러 번 실행해도 안전해요.
-- ============================================================


-- ── 1. 크루 설정·배지 칸 ─────────────────────────────────────
alter table public.crews add column if not exists join_mode text not null default 'approval';
alter table public.crews add column if not exists min_score int not null default 0;
alter table public.crews add column if not exists badge_level int not null default 0;   -- 0 없음, 5(파랑) … 1(보라)
alter table public.crews add column if not exists settled_month date;                    -- 정산을 마친 마지막 달(1일)
do $$ begin
  alter table public.crews add constraint crews_join_mode_check check (join_mode in ('approval', 'open'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.crews add constraint crews_min_score_check check (min_score in (0, 40, 50));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.crews add constraint crews_badge_level_check check (badge_level between 0 and 5);
exception when duplicate_object then null; end $$;

-- 버디(신입 버디): 크루원마다 선배 1명, 90일
alter table public.crew_members add column if not exists buddy_id uuid references auth.users(id) on delete set null;
alter table public.crew_members add column if not exists buddy_until timestamptz;


-- ── 2. 크루 활동 기록 (내보내거나 나가도 크루에 남음) ──────────────────
create table if not exists public.crew_events (
  id bigint generated always as identity primary key,
  crew_id uuid references public.crews(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('case', 'help', 'review', 'referral', 'referral_recv', 'buddy_match', 'buddy_review')),
  ref text,
  created_at timestamptz not null default now()
);
create unique index if not exists crew_events_once on public.crew_events (kind, ref, user_id) where ref is not null;
create index if not exists crew_events_crew_idx on public.crew_events (crew_id, created_at);
create index if not exists crew_events_user_idx on public.crew_events (user_id, created_at);
alter table public.crew_events enable row level security;
revoke all on public.crew_events from anon, authenticated;

create or replace function public.log_crew_event(p_crew uuid, p_user uuid, p_kind text, p_ref text) returns void
language sql security definer set search_path = public as $$
  insert into crew_events (crew_id, user_id, kind, ref) values (p_crew, p_user, p_kind, p_ref) on conflict do nothing
$$;

-- 월간 미션 정산 기록
create table if not exists public.crew_missions (
  crew_id uuid not null references public.crews(id) on delete cascade,
  month date not null,
  target jsonb not null,
  actual jsonb not null,
  progress numeric not null,
  result text not null check (result in ('up', 'keep', 'down', 'none')),
  level_before int not null,
  level_after int not null,
  created_at timestamptz not null default now(),
  primary key (crew_id, month)
);
alter table public.crew_missions enable row level security;
revoke all on public.crew_missions from anon, authenticated;

-- 내보내기 기록 (사유 · 한 달 2명 제한)
create table if not exists public.crew_removals (
  id bigint generated always as identity primary key,
  crew_id uuid references public.crews(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  removed_by uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 2 and 200),
  created_at timestamptz not null default now()
);
alter table public.crew_removals enable row level security;
revoke all on public.crew_removals from anon, authenticated;

-- 좋아요(하트): 같은 크루원에게, 한 사람에게 한 달 1번, 한 달 5개까지
create table if not exists public.expert_hearts (
  id bigint generated always as identity primary key,
  from_user uuid references auth.users(id) on delete cascade,
  to_user uuid references auth.users(id) on delete cascade,
  to_therapist_id uuid not null references public.therapists(id) on delete cascade,
  month date not null,
  created_at timestamptz not null default now()
);
create unique index if not exists expert_hearts_once on public.expert_hearts (from_user, to_user, month);
create index if not exists expert_hearts_to_idx on public.expert_hearts (to_therapist_id);
alter table public.expert_hearts enable row level security;
revoke all on public.expert_hearts from anon, authenticated;

-- 도와주세요 질문 · 답
create table if not exists public.crew_questions (
  id bigint generated always as identity primary key,
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 5 and 500),
  accepted_answer_id bigint,
  created_at timestamptz not null default now()
);
create table if not exists public.crew_answers (
  id bigint generated always as identity primary key,
  question_id bigint not null references public.crew_questions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 2 and 500),
  created_at timestamptz not null default now()
);
create index if not exists crew_questions_crew_idx on public.crew_questions (crew_id, id desc);
create index if not exists crew_answers_q_idx on public.crew_answers (question_id, id);
alter table public.crew_questions enable row level security;
alter table public.crew_answers enable row level security;
revoke all on public.crew_questions, public.crew_answers from anon, authenticated;
grant select, insert, delete on public.crew_questions, public.crew_answers to authenticated;

drop policy if exists "crew questions read" on public.crew_questions;
create policy "crew questions read" on public.crew_questions for select to authenticated using (crew_id = public.my_crew_id());
drop policy if exists "crew questions write" on public.crew_questions;
create policy "crew questions write" on public.crew_questions for insert to authenticated
  with check (user_id = auth.uid() and crew_id = public.my_crew_id() and accepted_answer_id is null);
drop policy if exists "crew questions delete own" on public.crew_questions;
create policy "crew questions delete own" on public.crew_questions for delete to authenticated
  using (user_id = auth.uid() and accepted_answer_id is null);

create or replace function public.question_in_my_crew(p_q bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crew_questions q where q.id = p_q and q.crew_id = (select crew_id from crew_members where user_id = auth.uid()))
$$;
drop policy if exists "crew answers read" on public.crew_answers;
create policy "crew answers read" on public.crew_answers for select to authenticated using (public.question_in_my_crew(question_id));
drop policy if exists "crew answers write" on public.crew_answers;
create policy "crew answers write" on public.crew_answers for insert to authenticated
  with check (user_id = auth.uid() and public.question_in_my_crew(question_id));
drop policy if exists "crew answers delete own" on public.crew_answers;
create policy "crew answers delete own" on public.crew_answers for delete to authenticated
  using (user_id = auth.uid() and not exists (select 1 from crew_questions q where q.accepted_answer_id = crew_answers.id));

create or replace function public.crew_qa_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  new.body := btrim(new.body);
  if tg_table_name = 'crew_questions' then
    new.accepted_answer_id := null;
    if (select count(*) from crew_questions where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
      raise exception 'too_fast';
    end if;
  elsif (select count(*) from crew_answers where user_id = new.user_id and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'too_fast';
  end if;
  return new;
end $$;
drop trigger if exists crew_questions_before_insert on public.crew_questions;
create trigger crew_questions_before_insert before insert on public.crew_questions for each row execute function public.crew_qa_before_insert();
drop trigger if exists crew_answers_before_insert on public.crew_answers;
create trigger crew_answers_before_insert before insert on public.crew_answers for each row execute function public.crew_qa_before_insert();

-- 새 질문은 크루 채팅에도 한 줄 알림
create or replace function public.crew_question_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select t.name into v_name from therapists t where t.user_id = new.user_id limit 1;
  insert into crew_messages (crew_id, sender_id, kind, body)
  values (new.crew_id, new.user_id, 'system', coalesce(v_name, '크루원') || '님이 도움을 요청했어요: ' || left(new.body, 60) || case when char_length(new.body) > 60 then '…' else '' end);
  return null;
end $$;
drop trigger if exists crew_question_after_insert on public.crew_questions;
create trigger crew_question_after_insert after insert on public.crew_questions for each row execute function public.crew_question_after_insert();


-- ── 3. 활동 기록 자동으로 남기기 ────────────────────────────────
-- 케이스 공유
create or replace function public.crew_messages_log_case() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'case' then perform log_crew_event(new.crew_id, new.sender_id, 'case', 'msg:' || new.id); end if;
  return null;
end $$;
drop trigger if exists crew_messages_log_case on public.crew_messages;
create trigger crew_messages_log_case after insert on public.crew_messages for each row execute function public.crew_messages_log_case();

-- 진행 후기 공개 (+ 버디의 첫 후기)
create or replace function public.case_reviews_log_publish() returns trigger
language plpgsql security definer set search_path = public as $$
declare m crew_members;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select * into m from crew_members where user_id = new.expert_user_id;
    if m.crew_id is not null then
      perform log_crew_event(m.crew_id, new.expert_user_id, 'review', 'review:' || new.id);
      if m.buddy_id is not null and m.buddy_until > now() then
        perform log_crew_event(m.crew_id, m.buddy_id, 'buddy_review', 'mentee:' || new.expert_user_id);
      end if;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists case_reviews_log_publish on public.case_reviews;
create trigger case_reviews_log_publish after insert or update on public.case_reviews for each row execute function public.case_reviews_log_publish();

-- 추천 연결 (보낸 사람 · 받은 사람)
create or replace function public.referrals_log_accept() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform log_crew_event(new.crew_id, new.from_user_id, 'referral', 'ref:' || new.id);
    perform log_crew_event(new.crew_id, new.to_user_id, 'referral_recv', 'ref:' || new.id);
  end if;
  return null;
end $$;
drop trigger if exists referrals_log_accept on public.referrals;
create trigger referrals_log_accept after update on public.referrals for each row execute function public.referrals_log_accept();

-- 버디의 첫 상담 연결
create or replace function public.chat_rooms_log_buddy() returns trigger
language plpgsql security definer set search_path = public as $$
declare m crew_members;
begin
  select * into m from crew_members where user_id = new.expert_user_id;
  if m.crew_id is not null and m.buddy_id is not null and m.buddy_until > now()
     and not exists (select 1 from chat_rooms c where c.expert_user_id = new.expert_user_id and c.id <> new.id) then
    perform log_crew_event(m.crew_id, m.buddy_id, 'buddy_match', 'mentee:' || new.expert_user_id);
  end if;
  return null;
end $$;
drop trigger if exists chat_rooms_log_buddy on public.chat_rooms;
create trigger chat_rooms_log_buddy after insert on public.chat_rooms for each row execute function public.chat_rooms_log_buddy();


-- ── 4. 개인 점수: 응답 30 · 기록 30 · 협업 20 · 프로필 20 − 감점 ──────────
-- 프로필 20 = 경력 5 + 보유 자격 5 + 프로필 사진 5 + 자기소개 30자 이상 5 (모두 채워야 크루 가입)
create or replace function public.expert_profile_check(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'years', t.years_experience is not null,
    'certs', case when jsonb_typeof(to_jsonb(t.certifications)) = 'array' then jsonb_array_length(to_jsonb(t.certifications)) > 0 else false end,
    'photo', coalesce(cardinality(t.photo_urls), 0) > 0 or coalesce(t.profile_image_url, '') <> '',
    'intro', char_length(btrim(coalesce(t.intro, ''))) >= 30
  )
  from therapists t where t.user_id = p_user limit 1
$$;

create or replace function public.expert_score(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pc jsonb := coalesce(expert_profile_check(p_user), '{}'::jsonb);
  v_total int; v_replied int;
  v_sent int; v_recv int; v_cases int; v_help int; v_buddy int; v_reports int;
  s_resp numeric; s_rec numeric; s_collab numeric; s_prof numeric; s_pen numeric; s_all numeric;
begin
  -- 응답 30: 최근 90일 대화방 중 24시간 안에 답한 비율 (기록이 없으면 15)
  select count(*) filter (where x.replied or x.created_at < now() - interval '24 hours'), count(*) filter (where x.replied)
    into v_total, v_replied
  from (
    select c.created_at, exists (
             select 1 from chat_messages m where m.room_id = c.id and m.sender_id = p_user and m.kind = 'text'
               and m.created_at <= c.created_at + interval '24 hours') as replied
    from chat_rooms c where c.expert_user_id = p_user and c.created_at > now() - interval '90 days'
  ) x;
  s_resp := case when v_total = 0 then 15 else 30.0 * v_replied / v_total end;

  -- 기록 30: 최근 1년 공개된 진행 후기 중 좋은 3편 (편당 공개 5 + 앱 기록 10회 확인 3 + 꼼꼼함 2)
  select coalesce(sum(p), 0) into s_rec
  from (
    select 5
         + case when coalesce(verified_sessions, 0) >= 10 then 3 else 0 end
         + case when cardinality(photos) >= 3 and char_length(first_state) >= 100 and char_length(approach) >= 100 and char_length(changes) >= 100 then 2 else 0 end as p
    from case_reviews
    where expert_user_id = p_user and status = 'published' and published_at > now() - interval '365 days'
    order by 1 desc limit 3
  ) r;

  -- 협업 20 (최근 90일): 추천 연결 보냄 4·받음 2 · 도움 채택 2 · 버디 성장 3 · 케이스 공유 1
  select count(*) into v_sent from referrals where from_user_id = p_user and status = 'accepted' and decided_at > now() - interval '90 days';
  select count(*) into v_recv from referrals where to_user_id = p_user and status = 'accepted' and decided_at > now() - interval '90 days';
  select count(*) filter (where kind = 'case'), count(*) filter (where kind = 'help'), count(*) filter (where kind in ('buddy_match', 'buddy_review'))
    into v_cases, v_help, v_buddy
  from crew_events where user_id = p_user and created_at > now() - interval '90 days';
  s_collab := least(20, v_sent * 4 + v_recv * 2 + v_help * 2 + v_buddy * 3 + v_cases);

  -- 프로필 20
  s_prof := 5 * ((case when (pc->>'years')::boolean then 1 else 0 end) + (case when (pc->>'certs')::boolean then 1 else 0 end)
               + (case when (pc->>'photo')::boolean then 1 else 0 end) + (case when (pc->>'intro')::boolean then 1 else 0 end));

  -- 감점: 운영팀이 '위반 확인'한 회원 신고 1건당 5점 (최근 90일, 최대 20)
  select count(*) into v_reports
  from chat_reports r join chat_rooms c on c.id = r.room_id
  where c.expert_user_id = p_user and r.reporter_role = 'guardian' and r.upheld and r.created_at > now() - interval '90 days';
  s_pen := least(20, v_reports * 5);

  s_all := greatest(0, least(100, s_resp + s_rec + s_collab + s_prof - s_pen));
  return jsonb_build_object(
    'total', round(s_all, 1), 'response', round(s_resp, 1), 'record', round(s_rec, 1),
    'collab', round(s_collab, 1), 'profile', s_prof, 'penalty', round(s_pen, 1), 'profile_check', pc,
    'points', (select count(*) * 10 from referrals where from_user_id = p_user and status = 'accepted')
            + (select count(*) * 5 from referrals where to_user_id = p_user and status = 'accepted')
            + (select count(*) * 2 from crew_events where user_id = p_user and kind = 'case')
            + (select count(*) * 4 from crew_events where user_id = p_user and kind = 'help')
            + (select count(*) * 6 from crew_events where user_id = p_user and kind in ('buddy_match', 'buddy_review'))
  );
end $$;

-- 크루 활동 점수 (최근 90일, 지금 크루원이 아니어도 크루에 남음)
create or replace function public.crew_activity(p_crew uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case kind when 'case' then 1 when 'help' then 2 when 'review' then 3 when 'referral' then 4
                                when 'referral_recv' then 2 else 5 end), 0)
  from crew_events where crew_id = p_crew and created_at > now() - interval '90 days'
$$;

-- 크루 점수 = 크루원 개인 점수 합산 + 크루 활동 점수
create or replace function public.crew_score(p_crew uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select round(coalesce((select sum((expert_score(user_id)->>'total')::numeric) from crew_members where crew_id = p_crew), 0)
               + crew_activity(p_crew), 1)
$$;


-- ── 5. 월간 미션 ─────────────────────────────────────────────
-- 다음 단계 목표 (크루원 4명 이하 기준, 5~7명 1.5배, 8~10명 2배)
create or replace function public.crew_mission_target(p_level int, p_members int) returns jsonb
language sql immutable as $$
  with goal as (
    select case when p_level <= 1 and p_level > 0 then 1 when p_level = 0 then 5 else p_level - 1 end as g
  ), base as (
    select case g when 5 then array[3, 2, 1] when 4 then array[4, 3, 2] when 3 then array[5, 4, 3] when 2 then array[6, 5, 4] else array[8, 6, 5] end as b, g from goal
  ), mult as (
    select case when p_members <= 4 then 1.0 when p_members <= 7 then 1.5 else 2.0 end as k
  )
  select jsonb_build_object('level', g, 'case', ceil(b[1] * k)::int, 'help', ceil(b[2] * k)::int, 'review', ceil(b[3] * k)::int)
  from base, mult
$$;

-- 그 달 실제 활동
create or replace function public.crew_month_actual(p_crew uuid, p_month date) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'case', count(*) filter (where kind = 'case'),
    'help', count(*) filter (where kind = 'help'),
    'review', count(*) filter (where kind = 'review'))
  from crew_events
  where crew_id = p_crew
    and created_at >= (p_month::timestamp at time zone 'Asia/Seoul')
    and created_at < ((p_month + interval '1 month')::timestamp at time zone 'Asia/Seoul')
$$;

create or replace function public.mission_progress(p_target jsonb, p_actual jsonb) returns numeric
language sql immutable as $$
  select round((least(1.0, (p_actual->>'case')::numeric / greatest(1, (p_target->>'case')::int))
              + least(1.0, (p_actual->>'help')::numeric / greatest(1, (p_target->>'help')::int))
              + least(1.0, (p_actual->>'review')::numeric / greatest(1, (p_target->>'review')::int))) / 3, 3)
$$;

-- 지난달까지 정산 (달성 → 한 단계 위 / 절반 이상 → 유지 / 미만 → 한 단계 아래)
create or replace function public.crew_settle(p_crew uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c crews;
  v_cur date := date_trunc('month', now() at time zone 'Asia/Seoul')::date;
  v_m date;
  v_members int;
  v_target jsonb; v_actual jsonb; v_prog numeric; v_after int; v_result text;
begin
  select * into c from crews where id = p_crew for update;
  if c.id is null then return; end if;
  v_m := coalesce((c.settled_month + interval '1 month')::date, date_trunc('month', c.created_at at time zone 'Asia/Seoul')::date);
  select count(*) into v_members from crew_members where crew_id = c.id;
  while v_m < v_cur loop
    v_target := crew_mission_target(c.badge_level, v_members);
    v_actual := crew_month_actual(c.id, v_m);
    v_prog := mission_progress(v_target, v_actual);
    if v_prog >= 1 then
      v_after := case when c.badge_level = 0 then 5 else greatest(1, c.badge_level - 1) end;
      v_result := 'up';
    elsif v_prog >= 0.5 then
      v_after := c.badge_level;
      v_result := case when c.badge_level = 0 then 'none' else 'keep' end;
    else
      v_after := case when c.badge_level = 0 then 0 when c.badge_level = 5 then 0 else c.badge_level + 1 end;
      v_result := case when c.badge_level = 0 then 'none' else 'down' end;
    end if;
    insert into crew_missions (crew_id, month, target, actual, progress, result, level_before, level_after)
    values (c.id, v_m, v_target, v_actual, v_prog, v_result, c.badge_level, v_after)
    on conflict (crew_id, month) do nothing;
    c.badge_level := v_after;
    v_m := (v_m + interval '1 month')::date;
  end loop;
  update crews set badge_level = c.badge_level, settled_month = (v_cur - interval '1 month')::date where id = c.id;
end $$;

create or replace function public.settle_all_crews() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from crews loop perform crew_settle(r.id); end loop;
end $$;


-- ── 6. 가입 조건 ─────────────────────────────────────────────
create or replace function public.crew_join_check(p_crew uuid, p_user uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare pc jsonb := expert_profile_check(p_user); v_min int;
begin
  if pc is null or not ((pc->>'years')::boolean and (pc->>'certs')::boolean and (pc->>'photo')::boolean and (pc->>'intro')::boolean) then
    raise exception 'profile_incomplete';
  end if;
  if p_crew is not null then
    select min_score into v_min from crews where id = p_crew;
    if coalesce(v_min, 0) > 0 and (expert_score(p_user)->>'total')::numeric < v_min then raise exception 'score_too_low'; end if;
  end if;
end $$;

create or replace function public.crew_add_member(p_crew uuid, p_user uuid, p_tid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from crews where id = p_crew for update;
  if (select count(*) from crew_members where crew_id = p_crew) >= 10 then raise exception 'crew_full'; end if;
  if exists (select 1 from crew_members where user_id = p_user) then raise exception 'already_in_crew'; end if;
  perform crew_join_check(p_crew, p_user);
  insert into crew_members (crew_id, user_id, therapist_id, role) values (p_crew, p_user, p_tid, 'member');
  update crew_join_requests set status = 'canceled', decided_at = now() where user_id = p_user and status = 'pending' and crew_id <> p_crew;
end $$;

create or replace function public.create_crew(p_name text, p_intro text, p_region text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := require_verified_expert(); v_id uuid;
begin
  if exists (select 1 from crew_members where user_id = auth.uid()) then raise exception 'already_in_crew'; end if;
  perform crew_join_check(null, auth.uid());
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

-- 가입: '바로 참여' 크루면 바로 합류, '승인 후 합류' 크루면 신청 → 'joined' | 'requested'
drop function if exists public.request_join(uuid, text);
create or replace function public.join_crew(p_crew uuid, p_message text) returns text
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := require_verified_expert(); c crews; v_name text;
begin
  if exists (select 1 from crew_members where user_id = auth.uid()) then raise exception 'already_in_crew'; end if;
  select * into c from crews where id = p_crew;
  if c.id is null then raise exception 'not_found'; end if;
  if not c.is_open then raise exception 'crew_closed'; end if;
  if (select count(*) from crew_members where crew_id = c.id) >= 10 then raise exception 'crew_full'; end if;
  perform crew_join_check(c.id, auth.uid());
  if c.join_mode = 'open' then
    perform crew_add_member(c.id, auth.uid(), v_tid);
    select name into v_name from therapists where id = v_tid;
    perform crew_say(c.id, 'system', v_name || '님이 크루에 참여했어요. 반갑게 맞아 주세요!');
    return 'joined';
  end if;
  if (select count(*) from crew_join_requests where user_id = auth.uid() and status = 'pending') >= 3 then raise exception 'too_many_requests'; end if;
  if exists (select 1 from crew_join_requests where crew_id = c.id and user_id = auth.uid() and status = 'pending') then raise exception 'already_requested'; end if;
  insert into crew_join_requests (crew_id, user_id, therapist_id, message)
  values (c.id, auth.uid(), v_tid, left(btrim(coalesce(p_message, '')), 200));
  return 'requested';
end $$;

-- 내보내기: 사유 필수 · 한 달 2명까지 · 활동 기록은 크루에 남음
drop function if exists public.remove_member(uuid);
create or replace function public.remove_member(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare me crew_members; target crew_members; v_name text; v_reason text := left(btrim(coalesce(p_reason, '')), 200);
begin
  select * into me from crew_members where user_id = auth.uid();
  select * into target from crew_members where crew_id = me.crew_id and user_id = p_user;
  if me.crew_id is null or target.user_id is null or p_user = auth.uid() then raise exception 'not_found'; end if;
  if not (me.role = 'owner' or (me.role = 'leader' and target.role = 'member')) then raise exception 'not_allowed'; end if;
  if char_length(v_reason) < 2 then raise exception 'reason_required'; end if;
  if (select count(*) from crew_removals where crew_id = me.crew_id
        and created_at >= (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) >= 2 then
    raise exception 'too_many_removals';
  end if;
  insert into crew_removals (crew_id, user_id, removed_by, reason) values (me.crew_id, p_user, auth.uid(), v_reason);
  delete from crew_members where crew_id = me.crew_id and user_id = p_user;
  update crew_members set buddy_id = null, buddy_until = null where crew_id = me.crew_id and buddy_id = p_user;
  select name into v_name from therapists where id = target.therapist_id;
  perform crew_say(me.crew_id, 'system', v_name || '님이 크루에서 빠졌어요.');
end $$;

-- 크루 설정 (대표): 이름·소개·지역·찾기 노출·가입 방식·최소 점수
drop function if exists public.update_crew(text, text, text, boolean);
create or replace function public.update_crew(p_name text, p_intro text, p_region text, p_is_open boolean, p_join_mode text, p_min_score int)
returns void language plpgsql security definer set search_path = public as $$
declare me crew_members;
begin
  select * into me from crew_members where user_id = auth.uid();
  if me.crew_id is null or me.role <> 'owner' then raise exception 'not_allowed'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 20 then raise exception 'bad_name'; end if;
  if exists (select 1 from crews where lower(btrim(name)) = lower(btrim(p_name)) and id <> me.crew_id) then raise exception 'name_taken'; end if;
  if coalesce(p_join_mode, 'approval') not in ('approval', 'open') or coalesce(p_min_score, 0) not in (0, 40, 50) then raise exception 'bad_input'; end if;
  update crews set name = btrim(p_name), intro = left(btrim(coalesce(p_intro, '')), 200), region = left(btrim(coalesce(p_region, '')), 30),
                   is_open = coalesce(p_is_open, true), join_mode = coalesce(p_join_mode, 'approval'), min_score = coalesce(p_min_score, 0)
  where id = me.crew_id;
end $$;

-- 대표가 승인할 때도 조건 확인 (crew_add_member 안에서)
-- leave_crew: 나가면 버디 연결도 정리
create or replace function public.leave_crew() returns void
language plpgsql security definer set search_path = public as $$
declare m crew_members; v_name text;
begin
  select * into m from crew_members where user_id = auth.uid();
  if m.crew_id is null then raise exception 'not_found'; end if;
  if m.role = 'owner' then
    if exists (select 1 from crew_members where crew_id = m.crew_id and user_id <> auth.uid()) then raise exception 'owner_must_transfer'; end if;
    delete from crews where id = m.crew_id;
    return;
  end if;
  delete from crew_members where crew_id = m.crew_id and user_id = auth.uid();
  update crew_members set buddy_id = null, buddy_until = null where crew_id = m.crew_id and buddy_id = auth.uid();
  select name into v_name from therapists where id = m.therapist_id;
  perform crew_say(m.crew_id, 'system', v_name || '님이 크루를 떠났어요.');
end $$;


-- ── 7. 질문 답 채택 · 좋아요 · 버디 ────────────────────────────
create or replace function public.accept_answer(p_answer bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a crew_answers; q crew_questions; v_name text;
begin
  select * into a from crew_answers where id = p_answer;
  if a.id is null then raise exception 'not_found'; end if;
  select * into q from crew_questions where id = a.question_id for update;
  if q.user_id is distinct from auth.uid() then raise exception 'not_allowed'; end if;
  if q.accepted_answer_id is not null then raise exception 'already_decided'; end if;
  if a.user_id = auth.uid() then raise exception 'own_answer'; end if;
  update crew_questions set accepted_answer_id = a.id where id = q.id;
  perform log_crew_event(q.crew_id, a.user_id, 'help', 'answer:' || a.id);
  select t.name into v_name from therapists t where t.user_id = a.user_id limit 1;
  insert into crew_messages (crew_id, sender_id, kind, body)
  values (q.crew_id, auth.uid(), 'system', coalesce(v_name, '크루원') || '님의 답이 도움이 됐어요 👍');
end $$;

create or replace function public.give_heart(p_user uuid) returns int
language plpgsql security definer set search_path = public as $$
declare me crew_members; target crew_members; v_month date := date_trunc('month', now() at time zone 'Asia/Seoul')::date;
begin
  select * into me from crew_members where user_id = auth.uid();
  select * into target from crew_members where user_id = p_user;
  if me.crew_id is null or target.crew_id is distinct from me.crew_id or p_user = auth.uid() then raise exception 'not_allowed'; end if;
  if exists (select 1 from expert_hearts where from_user = auth.uid() and to_user = p_user and month = v_month) then raise exception 'already_hearted'; end if;
  if (select count(*) from expert_hearts where from_user = auth.uid() and month = v_month) >= 5 then raise exception 'no_hearts_left'; end if;
  insert into expert_hearts (from_user, to_user, to_therapist_id, month) values (auth.uid(), p_user, target.therapist_id, v_month);
  return 5 - (select count(*)::int from expert_hearts where from_user = auth.uid() and month = v_month);
end $$;

create or replace function public.set_buddy(p_user uuid, p_buddy uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me crew_members; v_name text; v_bname text;
begin
  select * into me from crew_members where user_id = auth.uid();
  if me.crew_id is null or me.role not in ('owner', 'leader') then raise exception 'not_allowed'; end if;
  if not exists (select 1 from crew_members where crew_id = me.crew_id and user_id = p_user) then raise exception 'not_found'; end if;
  if p_buddy is null then
    update crew_members set buddy_id = null, buddy_until = null where crew_id = me.crew_id and user_id = p_user;
    return;
  end if;
  if p_buddy = p_user or not exists (select 1 from crew_members where crew_id = me.crew_id and user_id = p_buddy) then raise exception 'bad_input'; end if;
  update crew_members set buddy_id = p_buddy, buddy_until = now() + interval '90 days' where crew_id = me.crew_id and user_id = p_user;
  select t.name into v_name from crew_members m join therapists t on t.id = m.therapist_id where m.crew_id = me.crew_id and m.user_id = p_user;
  select t.name into v_bname from crew_members m join therapists t on t.id = m.therapist_id where m.crew_id = me.crew_id and m.user_id = p_buddy;
  perform crew_say(me.crew_id, 'system', v_bname || '님이 ' || v_name || '님의 버디가 됐어요. 일정이 안 맞는 요청은 추천해 주고, 인수인계 메모와 질문 답으로 첫 상담·첫 진행 후기까지 도와주세요!');
end $$;


-- ── 8. 화면에서 읽는 함수 다시 만들기 ──────────────────────────
drop function if exists public.my_crew();
create or replace function public.my_crew() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m crew_members;
  c crews;
  v_members jsonb;
  v_sum numeric;
  v_requests jsonb;
  v_month date := date_trunc('month', now() at time zone 'Asia/Seoul')::date;
  v_count int;
begin
  select * into m from crew_members where user_id = auth.uid();
  if m.crew_id is null then
    return jsonb_build_object('crew', null,
      'my_score', expert_score(auth.uid()),
      'my_requests', (
        select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'crew_id', r.crew_id, 'crew_name', cr.name, 'created_at', r.created_at)), '[]'::jsonb)
        from crew_join_requests r join crews cr on cr.id = r.crew_id
        where r.user_id = auth.uid() and r.status = 'pending'));
  end if;
  perform crew_settle(m.crew_id);
  select * into c from crews where id = m.crew_id;

  select coalesce(jsonb_agg(x.j order by x.ord, x.joined_at), '[]'::jsonb), coalesce(sum(x.total), 0), count(*)
    into v_members, v_sum, v_count
  from (
    select cm.joined_at,
      case cm.role when 'owner' then 0 when 'leader' then 1 else 2 end as ord,
      (s->>'total')::numeric as total,
      jsonb_build_object(
        'user_id', cm.user_id, 'therapist_id', t.id, 'name', t.name, 'photo', coalesce(t.photo_urls[1], t.profile_image_url),
        'years', t.years_experience, 'role', cm.role, 'joined_at', cm.joined_at, 'verified', t.verification_status = 'verified',
        'score', case when cm.user_id = auth.uid() then s else s - 'penalty' - 'profile_check' end,
        'me', cm.user_id = auth.uid(),
        'hearts', (select count(*) from expert_hearts h where h.to_user = cm.user_id),
        'hearted', exists (select 1 from expert_hearts h where h.from_user = auth.uid() and h.to_user = cm.user_id and h.month = v_month),
        'buddy', case when cm.buddy_id is not null and cm.buddy_until > now() then
          (select jsonb_build_object('user_id', b.user_id, 'name', bt.name, 'until', cm.buddy_until)
           from crew_members b join therapists bt on bt.id = b.therapist_id where b.crew_id = cm.crew_id and b.user_id = cm.buddy_id) else null end
      ) as j
    from crew_members cm
    join therapists t on t.id = cm.therapist_id
    cross join lateral (select expert_score(cm.user_id) as s) sc
    where cm.crew_id = c.id
  ) x;

  if m.role in ('owner', 'leader') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', t.name, 'photo', coalesce(t.photo_urls[1], t.profile_image_url), 'years', t.years_experience,
      'message', r.message, 'created_at', r.created_at, 'score', (expert_score(r.user_id)->>'total')::numeric
    ) order by r.created_at), '[]'::jsonb) into v_requests
    from crew_join_requests r join therapists t on t.id = r.therapist_id
    where r.crew_id = c.id and r.status = 'pending';
  end if;

  return jsonb_build_object(
    'crew', jsonb_build_object(
      'id', c.id, 'name', c.name, 'intro', c.intro, 'region', c.region, 'notice', c.notice, 'notice_at', c.notice_at,
      'is_open', c.is_open, 'join_mode', c.join_mode, 'min_score', c.min_score, 'created_at', c.created_at,
      'invite_code', case when m.role in ('owner', 'leader') then c.invite_code else null end,
      'badge_level', c.badge_level
    ),
    'my_role', m.role,
    'members', v_members,
    'score', jsonb_build_object('members', round(v_sum, 1), 'activity', crew_activity(c.id), 'total', round(v_sum + crew_activity(c.id), 1)),
    'mission', jsonb_build_object(
      'month', v_month,
      'target', crew_mission_target(c.badge_level, v_count),
      'actual', crew_month_actual(c.id, v_month),
      'history', (select coalesce(jsonb_agg(jsonb_build_object('month', month, 'result', result, 'level_after', level_after, 'progress', progress) order by month desc), '[]'::jsonb)
                  from (select * from crew_missions where crew_id = c.id order by month desc limit 6) h)
    ),
    'requests', coalesce(v_requests, '[]'::jsonb),
    'removals_left', greatest(0, 2 - (select count(*) from crew_removals where crew_id = c.id
                        and created_at >= (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'))),
    'hearts_left', greatest(0, 5 - (select count(*) from expert_hearts where from_user = auth.uid() and month = v_month)),
    'unread', (select count(*) from crew_messages where crew_id = c.id and created_at > m.last_read_at and sender_id is distinct from auth.uid())
  );
end $$;

-- 크루 찾기: 배지 단계 높은 크루 먼저, 그다음 크루 점수
create or replace function public.search_crews(p_q text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.lv, x.score desc nulls last, x.created_at desc), '[]'::jsonb)
  from (
    select c.created_at, case when c.badge_level = 0 then 9 else c.badge_level end as lv, s.score, jsonb_build_object(
      'id', c.id, 'name', c.name, 'region', c.region, 'intro', c.intro, 'members', n.cnt,
      'score', s.score, 'badge_level', c.badge_level, 'join_mode', c.join_mode, 'min_score', c.min_score,
      'requested', exists (select 1 from crew_join_requests r where r.crew_id = c.id and r.user_id = auth.uid() and r.status = 'pending')
    ) as j
    from crews c
    cross join lateral (select count(*) as cnt from crew_members m where m.crew_id = c.id) n
    cross join lateral (select crew_score(c.id) as score) s
    where c.is_open and n.cnt < 10
      and (coalesce(btrim(p_q), '') = '' or c.name ilike '%' || btrim(p_q) || '%' or c.region ilike '%' || btrim(p_q) || '%')
    order by c.badge_level = 0, c.badge_level, c.created_at desc
    limit 30
  ) x
$$;

-- 프로필·목록 배지: 크루 이름 · 미션 배지 단계 · 받은 좋아요 수 (누구나)
create or replace function public.crew_badges(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'therapist_id', t.id, 'crew', c.name, 'badge_level', coalesce(c.badge_level, 0),
    'hearts', (select count(*) from expert_hearts h where h.to_therapist_id = t.id)
  )), '[]'::jsonb)
  from therapists t
  left join crew_members m on m.therapist_id = t.id
  left join crews c on c.id = m.crew_id
  where t.id = any (p_ids)
$$;


-- ── 9. 보관·정리 + 예약 + 권한 ──────────────────────────────────
create or replace function public.purge_old_chats() returns void
language sql security definer set search_path = public as $$
  delete from chat_rooms where last_message_at < now() - interval '180 days';
  delete from consult_requests r
   where r.expires_at < now() - interval '30 days'
     and not exists (select 1 from chat_rooms c where c.consult_id = r.id);
  delete from chat_reports where status = 'done' and handled_at < now() - interval '365 days';
  delete from expert_schedule where ends_at < now() - interval '365 days';
  delete from crew_messages where created_at < now() - interval '365 days';
  delete from crew_questions where created_at < now() - interval '365 days';
  delete from case_reviews where status = 'declined' and decided_at < now() - interval '90 days';
  delete from crew_join_requests where status <> 'pending' and created_at < now() - interval '180 days';
  delete from crew_events where created_at < now() - interval '400 days';
  delete from crew_removals where created_at < now() - interval '365 days';
$$;
revoke execute on function public.purge_old_chats() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('settle-crew-missions', '20 15 * * *', 'select public.settle_all_crews()');
exception when others then
  raise notice 'pg_cron 을 쓸 수 없어 월간 미션은 크루 화면을 열 때 정산돼요 (%).', sqlerrm;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'my_crew()', 'join_crew(uuid, text)', 'remove_member(uuid, text)', 'update_crew(text, text, text, boolean, text, integer)',
    'accept_answer(bigint)', 'give_heart(uuid)', 'set_buddy(uuid, uuid)', 'question_in_my_crew(bigint)', 'leave_crew()', 'create_crew(text, text, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array[
    'log_crew_event(uuid, uuid, text, text)', 'expert_profile_check(uuid)', 'expert_score(uuid)', 'crew_activity(uuid)', 'crew_score(uuid)',
    'crew_month_actual(uuid, date)', 'crew_settle(uuid)', 'settle_all_crews()', 'crew_join_check(uuid, uuid)', 'crew_add_member(uuid, uuid, uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public.crew_badges(uuid[]) to anon, authenticated;
grant execute on function public.crew_mission_target(integer, integer) to anon, authenticated;
grant execute on function public.mission_progress(jsonb, jsonb) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.crew_questions;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ════════════════════════════════════════════════════════════
-- 10. 회원이 고르는 조건: '경력 3년 이상 선생님만' + 버디(선배)의 인수인계
--  · 요청서에 min_years(0 또는 3) → 조건에 못 미치는 전문가에게는 요청이 보이지 않고, 수락·추천도 안 됨
--  · 크루원 추천 때 '인수인계 메모'(500자)를 남기면, 회원이 연결을 수락한 뒤 새 대화방에서 받은 전문가에게만 보임
--    (버디는 방문을 함께 가지 않고, 요청을 넘겨주며 인수인계·질문으로 돕는 역할)
-- ════════════════════════════════════════════════════════════
alter table public.consult_requests add column if not exists min_years int not null default 0;
do $$ begin
  alter table public.consult_requests add constraint consult_requests_min_years_check check (min_years in (0, 3));
exception when duplicate_object then null; end $$;
alter table public.referrals add column if not exists handover text not null default '';
do $$ begin
  alter table public.referrals add constraint referrals_handover_check check (char_length(handover) <= 500);
exception when duplicate_object then null; end $$;

create or replace function public.create_consult(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_answers jsonb;
  v_conditions jsonb := pick_values(p->'conditions', array['stroke','parkinson','dementia','surgery','joint','frail']);
  v_wants jsonb := pick_values(p->'wants', array['home_exercise','fall_safety','visit','center','cost_schedule','welfare']);
  v_lat double precision := round(((p->>'lat')::numeric), 2);
  v_lng double precision := round(((p->>'lng')::numeric), 2);
  v_min int := coalesce(nullif(p->>'min_years', '')::int, 0);
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
    or jsonb_array_length(v_wants) = 0
    or v_min not in (0, 3) then
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
  insert into consult_requests (user_id, answers, note, area_label, lat, lng, sensitive_agreed_at, min_years)
  values (v_uid, v_answers, left(btrim(coalesce(p->>'note', '')), 500), left(btrim(coalesce(p->>'area', '')), 30), v_lat, v_lng, now(), v_min)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.consult_feed() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t record;
  v jsonb;
begin
  select id, verification_status, latitude, longitude, center_lat, center_lng, visit_radius_km, years_experience into t
  from therapists where user_id = auth.uid() limit 1;
  if t.id is null or t.verification_status <> 'verified' then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) into v
  from (
    select r.created_at, jsonb_build_object(
      'id', r.id, 'answers', r.answers, 'note', r.note, 'area_label', r.area_label,
      'created_at', r.created_at, 'expires_at', r.expires_at, 'status', r.status,
      'accepted_count', r.accepted_count, 'distance_km', round(d.km::numeric, 1), 'my_room_id', c.id, 'min_years', r.min_years
    ) as j
    from consult_requests r
    cross join lateral (
      select least(km_between(t.latitude, t.longitude, r.lat, r.lng), km_between(t.center_lat, t.center_lng, r.lat, r.lng)) as km
    ) d
    left join chat_rooms c on c.consult_id = r.id and c.therapist_id = t.id
    where r.user_id <> auth.uid()
      and (c.id is not null
           or (r.status = 'open' and r.expires_at > now() and d.km <= greatest(coalesce(t.visit_radius_km, 0), 20)
               and coalesce(t.years_experience, 0) >= r.min_years))
    order by r.created_at desc
    limit 100
  ) x;
  return v;
end $$;

create or replace function public.accept_consult(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t record;
  r consult_requests;
  v_room uuid;
  v_dist double precision;
begin
  select id, user_id, name, verification_status, latitude, longitude, center_lat, center_lng, visit_radius_km, subscribed_until, years_experience into t
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
  if coalesce(t.years_experience, 0) < r.min_years then raise exception 'min_years'; end if;
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

  select id, verification_status, latitude, longitude, center_lat, center_lng, visit_radius_km, subscribed_until, years_experience into t
  from therapists where user_id = auth.uid() limit 1;
  if t.id is null or t.verification_status <> 'verified' then return null; end if;

  select id into v_room from chat_rooms where consult_id = r.id and therapist_id = t.id;
  v_dist := least(km_between(t.latitude, t.longitude, r.lat, r.lng), km_between(t.center_lat, t.center_lng, r.lat, r.lng));
  if v_room is null and (r.status <> 'open' or r.expires_at < now() or v_dist is null
                         or v_dist > greatest(coalesce(t.visit_radius_km, 0), 20)
                         or coalesce(t.years_experience, 0) < r.min_years) then
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

create or replace function public.consult_push_targets(p_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select t.user_id
  from consult_requests r
  join therapists t on t.verification_status = 'verified' and t.user_id is not null and t.user_id <> r.user_id
  where r.id = p_id
    and r.status = 'open'
    and least(km_between(t.latitude, t.longitude, r.lat, r.lng), km_between(t.center_lat, t.center_lng, r.lat, r.lng))
        <= greatest(coalesce(t.visit_radius_km, 0), 20)
    and coalesce(t.years_experience, 0) >= r.min_years
$$;

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
      'my_buddy', m.buddy_id = auth.uid() and m.buddy_until > now(),
      'meets', r.id is null or coalesce(t.years_experience, 0) >= r.min_years,
      'distance_km', case when r.id is null then null
                     else round(least(km_between(t.latitude, t.longitude, r.lat, r.lng), km_between(t.center_lat, t.center_lng, r.lat, r.lng))::numeric, 1) end
    ) order by (m.buddy_id = auth.uid() and m.buddy_until > now()) desc, t.name), '[]'::jsonb)
    from crew_members m join therapists t on t.id = m.therapist_id
    where m.crew_id = v_crew and m.user_id <> auth.uid() and t.verification_status = 'verified'
      and not exists (select 1 from chat_rooms x where x.consult_id = c.consult_id and x.therapist_id = t.id)
  );
end $$;

drop function if exists public.create_referral(uuid, uuid, text);
create or replace function public.create_referral(p_room uuid, p_to_user uuid, p_note text, p_handover text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c chat_rooms; v_crew uuid; v_from uuid; tt record; v_from_name text; v_id uuid; v_min int;
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
  select min_years into v_min from consult_requests where id = c.consult_id;
  if coalesce(tt.years_experience, 0) < coalesce(v_min, 0) then raise exception 'min_years'; end if;
  if exists (select 1 from referrals where room_id = c.id and status = 'pending') then raise exception 'already_requested'; end if;
  select id, name into v_from, v_from_name from therapists where user_id = auth.uid() limit 1;
  insert into referrals (room_id, consult_id, crew_id, guardian_id, from_user_id, from_therapist_id, to_user_id, to_therapist_id, note, handover)
  values (c.id, c.consult_id, v_crew, c.guardian_id, auth.uid(), v_from, p_to_user, tt.id, left(btrim(coalesce(p_note, '')), 200), left(btrim(coalesce(p_handover, '')), 500))
  returning id into v_id;
  insert into chat_messages (room_id, sender_id, kind, body)
  values (c.id, auth.uid(), 'system', v_from_name || '님이 같은 크루의 ' || tt.name || '님(물리치료사' ||
          case when tt.years_experience is not null then ' · 경력 ' || tt.years_experience || '년' else '' end ||
          ')을 추천했어요. 연결할지 골라 주세요.');
  return v_id;
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
    ),
    -- 추천으로 연결된 대화방이면: 추천한 크루원의 인수인계 메모 (이 방의 전문가에게만)
    'handover', case when c.expert_user_id = auth.uid() then (
      select jsonb_build_object('from_name', ft.name, 'from_user_id', f.from_user_id, 'text', f.handover, 'at', f.decided_at)
      from referrals f left join therapists ft on ft.id = f.from_therapist_id
      where f.new_room_id = c.id and f.status = 'accepted' and f.handover <> ''
      order by f.decided_at desc limit 1) else null end
  )
  from chat_rooms c
  join therapists th on th.id = c.therapist_id
  left join consult_requests cr on cr.id = c.consult_id
  left join lateral (select round(avg(member_rating)::numeric, 1) as avg, count(*) as n
                     from case_reviews where therapist_id = th.id and status = 'published') rv on true
  where c.id = p_id and (c.guardian_id = auth.uid() or c.expert_user_id = auth.uid())
$$;

revoke execute on function public.create_referral(uuid, uuid, text, text) from public, anon;
grant execute on function public.create_referral(uuid, uuid, text, text) to authenticated;
revoke execute on function public.consult_push_targets(uuid) from public, anon, authenticated;
grant execute on function public.consult_push_targets(uuid) to service_role;
