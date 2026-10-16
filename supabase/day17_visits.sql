-- ============================================================
-- Day 17 · 다음 방문 카드 + 회차 세기
--  · 전문가가 스케줄에서 상담 대화와 연결한 일정(방문·센터·상담)을 그 회원도 볼 수 있게
--  · 회원: 방문 확인 / 시간 바꾸고 싶어요(채팅으로 전달) / 지난 방문 '진행 완료·진행 안 했어요'
--  · 회원이 '진행 완료'를 누른 방문 = 확인된 회차 → 진행 후기에 '앱 기록 n회'로 표시
--  · 알림: 일정이 잡히거나 바뀌면(화면이 서버에 알림), 매일 저녁 8시(한국) 내일 방문 안내·오늘 방문 진행 확인
-- Supabase → SQL Editor → New query → 이 파일 전체 붙여 넣기 → Run
-- ※ day15 · day16 SQL 을 먼저 실행해 두세요. 여러 번 실행해도 안전해요.
-- ============================================================


-- ── 1. 일정에 회원 답·진행 기록 칸 ───────────────────────────────
alter table public.expert_schedule add column if not exists member_answer text not null default 'none';
alter table public.expert_schedule add column if not exists member_answered_at timestamptz;
alter table public.expert_schedule add column if not exists member_result text;
alter table public.expert_schedule add column if not exists member_result_at timestamptz;
alter table public.expert_schedule add column if not exists expert_done_at timestamptz;
alter table public.expert_schedule add column if not exists notified_starts_at timestamptz;
alter table public.expert_schedule add column if not exists reminded_at timestamptz;
alter table public.expert_schedule add column if not exists done_asked_at timestamptz;

do $$
begin
  alter table public.expert_schedule add constraint expert_schedule_member_answer_check check (member_answer in ('none', 'confirmed', 'change'));
exception when duplicate_object then null;
end $$;
do $$
begin
  alter table public.expert_schedule add constraint expert_schedule_member_result_check check (member_result is null or member_result in ('done', 'missed'));
exception when duplicate_object then null;
end $$;
create index if not exists expert_schedule_room_idx on public.expert_schedule (room_id, starts_at) where room_id is not null;

-- 회원 답·알림 표시 칸은 전문가 화면에서 직접 못 바꿈 (함수·서버만)
-- 날짜·시간이나 연결한 대화가 바뀌면 회원 확인을 처음부터 다시 받음
create or replace function public.expert_schedule_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') then
      new.member_answer := 'none';
      new.member_answered_at := null;
      new.member_result := null;
      new.member_result_at := null;
      new.notified_starts_at := null;
      new.reminded_at := null;
      new.done_asked_at := null;
      -- '진행 완료' 표시는 시작한 뒤에만
      if new.expert_done_at is not null then
        new.expert_done_at := case when new.starts_at <= now() then now() else null end;
      end if;
    end if;
    return new;
  end if;

  if current_user in ('authenticated', 'anon') then
    new.member_answer := old.member_answer;
    new.member_answered_at := old.member_answered_at;
    new.member_result := old.member_result;
    new.member_result_at := old.member_result_at;
    new.notified_starts_at := old.notified_starts_at;
    new.reminded_at := old.reminded_at;
    new.done_asked_at := old.done_asked_at;
    if new.expert_done_at is not null then
      if new.starts_at > now() then
        new.expert_done_at := null;
      elsif old.expert_done_at is null then
        new.expert_done_at := now();
      else
        new.expert_done_at := old.expert_done_at;
      end if;
    end if;
  end if;
  if new.starts_at is distinct from old.starts_at or new.room_id is distinct from old.room_id then
    new.member_answer := 'none';
    new.member_answered_at := null;
    new.reminded_at := null;
    new.done_asked_at := null;
    if new.starts_at > now() then
      new.member_result := null;
      new.member_result_at := null;
      new.expert_done_at := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists expert_schedule_guard on public.expert_schedule;
create trigger expert_schedule_guard before insert or update on public.expert_schedule
  for each row execute function public.expert_schedule_guard();


-- ── 2. 대화방의 방문 일정 (회원·전문가 함께) ─────────────────────
-- 회원에게는 종류·날짜·시간·장소만 (전문가 메모·제목은 보이지 않음)
create or replace function public.room_visits(p_room uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c chat_rooms;
  v_role text;
  v_items jsonb;
  v_verified int;
begin
  select * into c from chat_rooms where id = p_room and (guardian_id = auth.uid() or expert_user_id = auth.uid());
  if c.id is null then return null; end if;
  v_role := case when c.guardian_id = auth.uid() then 'member' else 'expert' end;

  select count(*) into v_verified
  from expert_schedule where room_id = c.id and kind in ('visit', 'center') and member_result = 'done';

  select coalesce(jsonb_agg(x.j order by x.starts_at), '[]'::jsonb) into v_items
  from (
    select s.starts_at, jsonb_build_object(
      'id', s.id, 'kind', s.kind, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'place', s.place,
      'title', case when v_role = 'expert' then s.title else null end,
      'member_answer', s.member_answer, 'member_result', s.member_result,
      'expert_done', s.expert_done_at is not null,
      'session_no', case when s.kind in ('visit', 'center') and coalesce(s.member_result, '') <> 'missed' then
          (select count(*) from expert_schedule z
            where z.room_id = c.id and z.kind in ('visit', 'center') and coalesce(z.member_result, '') <> 'missed'
              and (z.starts_at < s.starts_at or (z.starts_at = s.starts_at and z.id <= s.id)))
        else null end
    ) as j
    from expert_schedule s
    where s.room_id = c.id and s.user_id = c.expert_user_id and s.kind in ('visit', 'center', 'consult')
      and s.ends_at > now() - interval '60 days'
  ) x;

  return jsonb_build_object('role', v_role, 'verified', v_verified, 'items', v_items);
end $$;

-- 회원 홈: 대화별 다음 방문 + 진행 확인이 필요한 지난 방문
create or replace function public.my_visit_cards() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.sort_at), '[]'::jsonb)
  from (
    select coalesce(ask.starts_at, nxt.starts_at) as sort_at, jsonb_build_object(
      'room_id', c.id,
      'therapist', jsonb_build_object('name', t.name, 'photo', coalesce(t.photo_urls[1], t.profile_image_url)),
      'next', case when nxt.id is null then null else jsonb_build_object(
        'id', nxt.id, 'kind', nxt.kind, 'starts_at', nxt.starts_at, 'ends_at', nxt.ends_at, 'place', nxt.place,
        'member_answer', nxt.member_answer) end,
      'ask', case when ask.id is null then null else jsonb_build_object('id', ask.id, 'kind', ask.kind, 'starts_at', ask.starts_at) end,
      'verified', (select count(*) from expert_schedule v where v.room_id = c.id and v.kind in ('visit', 'center') and v.member_result = 'done')
    ) as j
    from chat_rooms c
    join therapists t on t.id = c.therapist_id
    left join lateral (
      select * from expert_schedule s
      where s.room_id = c.id and s.user_id = c.expert_user_id and s.kind in ('visit', 'center', 'consult') and s.ends_at > now()
      order by s.starts_at limit 1
    ) nxt on true
    left join lateral (
      select * from expert_schedule s
      where s.room_id = c.id and s.user_id = c.expert_user_id and s.kind in ('visit', 'center')
        and s.starts_at <= now() and s.ends_at > now() - interval '14 days' and s.member_result is null
      order by s.starts_at desc limit 1
    ) ask on true
    where c.guardian_id = auth.uid() and c.blocked_by is null and not c.admin_blocked
      and (nxt.id is not null or ask.id is not null)
    limit 5
  ) x
$$;

-- 한국 시간 '10월 20일(화) 오전 10:00'
create or replace function public.visit_when(p timestamptz) returns text
language sql immutable as $$
  select to_char(p at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"')
    || '(' || (array['일','월','화','수','목','금','토'])[extract(dow from p at time zone 'Asia/Seoul')::int + 1] || ') '
    || case when extract(hour from p at time zone 'Asia/Seoul') < 12 then '오전 ' else '오후 ' end
    || to_char(p at time zone 'Asia/Seoul', 'FMHH12:MI')
$$;

-- 회원: 다가오는 일정 확인 / 시간 바꾸고 싶어요 (바꾸기는 채팅 메시지로 전문가에게 전달 → 메시지 번호를 돌려줌)
create or replace function public.answer_visit(p_id uuid, p_answer text, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  s expert_schedule;
  c chat_rooms;
  v_msg bigint;
  v_note text := left(btrim(coalesce(p_note, '')), 200);
begin
  if p_answer not in ('confirmed', 'change') then raise exception 'bad_input'; end if;
  select * into s from expert_schedule where id = p_id for update;
  if s.id is null or s.room_id is null or s.kind not in ('visit', 'center', 'consult') then raise exception 'not_found'; end if;
  select * into c from chat_rooms where id = s.room_id and guardian_id = auth.uid() and expert_user_id = s.user_id;
  if c.id is null then raise exception 'not_found'; end if;
  if s.starts_at <= now() then raise exception 'already_started'; end if;
  if p_answer = 'change' and (c.blocked_by is not null or c.admin_blocked) then raise exception 'closed'; end if;

  update expert_schedule set member_answer = p_answer, member_answered_at = now() where id = s.id;
  if p_answer = 'change' then
    insert into chat_messages (room_id, sender_id, kind, body)
    values (c.id, auth.uid(), 'text',
            '[일정 변경 요청] ' || visit_when(s.starts_at) || ' 일정의 시간을 바꾸고 싶어요.' || case when v_note <> '' then E'\n' || v_note else '' end)
    returning id into v_msg;
  end if;
  return v_msg;
end $$;

-- 회원: 지난 방문 '진행 완료' / '진행 안 했어요' / 되돌리기(null)
create or replace function public.record_visit_result(p_id uuid, p_result text) returns void
language plpgsql security definer set search_path = public as $$
declare s expert_schedule;
begin
  if p_result is not null and p_result not in ('done', 'missed') then raise exception 'bad_input'; end if;
  select * into s from expert_schedule where id = p_id for update;
  if s.id is null or s.room_id is null or s.kind not in ('visit', 'center') then raise exception 'not_found'; end if;
  if not exists (select 1 from chat_rooms where id = s.room_id and guardian_id = auth.uid() and expert_user_id = s.user_id) then
    raise exception 'not_found';
  end if;
  if s.starts_at > now() then raise exception 'not_started'; end if;
  update expert_schedule set member_result = p_result, member_result_at = case when p_result is null then null else now() end where id = s.id;
end $$;


-- ── 3. 진행 후기에 '앱 기록 회차' 남기기 (후기를 낼 때의 회원 확인 회차) ──
alter table public.case_reviews add column if not exists verified_sessions int not null default 0;
grant select (verified_sessions) on public.case_reviews to anon, authenticated;

create or replace function public.case_reviews_verified() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.room_id is not null then
      select count(*) into new.verified_sessions
      from expert_schedule where room_id = new.room_id and kind in ('visit', 'center') and member_result = 'done';
    end if;
    return new;
  end if;
  if new.room_id is not null and new.submitted_at is distinct from old.submitted_at then
    select count(*) into new.verified_sessions
    from expert_schedule where room_id = new.room_id and kind in ('visit', 'center') and member_result = 'done';
  else
    new.verified_sessions := old.verified_sessions;
  end if;
  return new;
end $$;
drop trigger if exists case_reviews_verified on public.case_reviews;
create trigger case_reviews_verified before insert or update on public.case_reviews
  for each row execute function public.case_reviews_verified();


-- ── 4. 매일 저녁 알림 대상 (서버 예약 작업만) — 한 번만 보내도록 표시하면서 꺼냄 ──
create or replace function public.claim_visit_pushes() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_rem jsonb;
  v_ask jsonb;
begin
  with t as (
    update expert_schedule s set reminded_at = now()
    from chat_rooms c
    where c.id = s.room_id and s.user_id = c.expert_user_id and s.kind in ('visit', 'center', 'consult')
      and s.reminded_at is null and s.starts_at > now()
      and (s.starts_at at time zone 'Asia/Seoul')::date = v_today + 1
      and c.blocked_by is null and not c.admin_blocked
    returning s.id, s.kind, s.starts_at, s.room_id, c.guardian_id, c.therapist_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'when', visit_when(t.starts_at), 'room_id', t.room_id,
                                               'user_id', t.guardian_id, 'name', th.name)), '[]'::jsonb)
    into v_rem
  from t join therapists th on th.id = t.therapist_id;

  with t as (
    update expert_schedule s set done_asked_at = now()
    from chat_rooms c
    where c.id = s.room_id and s.user_id = c.expert_user_id and s.kind in ('visit', 'center')
      and s.done_asked_at is null and s.member_result is null and s.ends_at <= now()
      and (s.starts_at at time zone 'Asia/Seoul')::date = v_today
      and c.blocked_by is null and not c.admin_blocked
    returning s.id, s.room_id, c.guardian_id, c.therapist_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'room_id', t.room_id, 'user_id', t.guardian_id, 'name', th.name)), '[]'::jsonb)
    into v_ask
  from t join therapists th on th.id = t.therapist_id;

  return jsonb_build_object('reminders', v_rem, 'asks', v_ask);
end $$;


-- ── 5. 실행 권한 ─────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['room_visits(uuid)', 'my_visit_cards()', 'answer_visit(uuid, text, text)', 'record_visit_result(uuid, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.claim_visit_pushes() from public, anon, authenticated;
grant execute on function public.claim_visit_pushes() to service_role;


-- ── 6. 일정이 잡히거나 바뀌었을 때 회원 알림 대상 (서버만) — 같은 시간이면 다시 보내지 않음 ──
create or replace function public.claim_visit_notice(p_id uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s expert_schedule;
  c chat_rooms;
  v_name text;
  v_changed boolean;
begin
  select * into s from expert_schedule where id = p_id and user_id = p_user for update;
  if s.id is null or s.room_id is null or s.kind not in ('visit', 'center', 'consult') or s.starts_at <= now()
     or s.updated_at < now() - interval '10 minutes' then
    return null;
  end if;
  if s.notified_starts_at is not distinct from s.starts_at then return null; end if;
  select * into c from chat_rooms where id = s.room_id and expert_user_id = p_user and blocked_by is null and not admin_blocked;
  if c.id is null then return null; end if;
  v_changed := s.notified_starts_at is not null;
  update expert_schedule set notified_starts_at = s.starts_at where id = s.id;
  select name into v_name from therapists where id = c.therapist_id;
  return jsonb_build_object('user_id', c.guardian_id, 'room_id', c.id, 'kind', s.kind, 'when', visit_when(s.starts_at), 'name', v_name, 'changed', v_changed);
end $$;
revoke execute on function public.claim_visit_notice(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_visit_notice(uuid, uuid) to service_role;
