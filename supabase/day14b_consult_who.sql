-- ============================================================
-- Day 14b · 상담 요청 대상에 '배우자'·'본인' 추가
-- Supabase → SQL Editor → New query → 이 파일 전체 붙여 넣기 → Run (여러 번 실행해도 안전)
-- ※ day13_phase2.sql 을 먼저 실행해 두세요.
-- ============================================================

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

revoke execute on function public.create_consult(jsonb) from public, anon;
grant execute on function public.create_consult(jsonb) to authenticated;
