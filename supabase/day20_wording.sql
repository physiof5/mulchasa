-- day20 운동 지도 분야 이름 정리 (2026-10-27)
-- '재활'·'교정'은 의료기사법 시행령의 물리치료사 업무('기능훈련·신체교정운동 및 재활훈련')와 겹쳐
-- 의료행위로 보일 수 있어 이름을 바꾼다. 태그 id·slug는 그대로 → 전문가가 고른 분야(therapist_tags)도 그대로 이어짐.
-- 화면 코드(src/lib/practitioner.ts PURPOSE_OPTIONS)와 글자 하나까지 같아야 검색된다.

update public.tags set label = '뇌졸중·파킨슨 운동' where category = 'purpose' and label = '신경계 재활 운동';
update public.tags set label = '수술 후 회복 운동'       where category = 'purpose' and label = '수술 후 재활 운동';
update public.tags set label = '관절·근력 운동'          where category = 'purpose' and label = '근골격 재활 운동';
update public.tags set label = '스포츠 복귀 운동'        where category = 'purpose' and label = '스포츠 재활 운동';
update public.tags set label = '산후 회복 운동'          where category = 'purpose' and label = '산후 재활 운동';
update public.tags set label = '바른 자세 운동'          where category = 'purpose' and label = '자세교정 운동';

-- 진행 후기의 '운동 목표'에 예전 이름이 있으면 함께 바꿈
update public.case_reviews set purpose = '수술 후 회복 운동' where purpose = '수술 후 재활 운동';

-- 2026-10-27 추가: '뇌졸중·파킨슨 생활 운동'으로 먼저 바꾼 DB는 한 번 더 줄임
update public.tags set label = '뇌졸중·파킨슨 운동' where category = 'purpose' and label = '뇌졸중·파킨슨 생활 운동';
