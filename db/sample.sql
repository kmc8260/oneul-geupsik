-- ===================================================================
-- 오늘의 급식 · 샘플 데이터
-- 실행 순서: db/reset.sql → db/schema.sql → db/sample.sql (Workbench에서 각각 ⚡ 전체 실행)
-- 들어가는 것: 학교 1 · 회원 3 · 회원 알레르기 · 메뉴 23 · 식단 10끼(지난주·이번 주 중식) · 메뉴별 알레르기 · 평가 · 동기화 기록
-- 날짜는 실행한 날 기준으로 "이번 주"와 "지난주"가 되도록 계산해서, 언제 실행해도 메인 화면에 식단이 보입니다.
-- 샘플 계정 비밀번호는 모두 mirim1234 (DB에는 bcrypt 해시로만 저장)
-- 학교 코드는 샘플용 가짜 코드라서, 나이스에서 새로 받아오지 않고 이 파일의 식단이 그대로 보입니다.
-- ===================================================================
SET NAMES utf8mb4;
USE oneul_geupsik;

-- 이번 주 월요일 (토·일에 실행하면 다음 주 월요일 — 메인 화면도 주말엔 다음 주를 보여주기 때문)
SET @mon  = CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY + INTERVAL IF(WEEKDAY(CURDATE()) >= 5, 7, 0) DAY;
SET @prev = @mon - INTERVAL 7 DAY;   -- 지난주 월요일

-- 학교: 교육청 코드 + 학교 코드 (샘플용 코드)
INSERT INTO school (office_code, school_code, school_name, school_kind, region, address)
VALUES ('B10', '9990001', '미림마이스터고등학교 (샘플)', '고등학교', '서울특별시', '서울특별시 관악구 호암로 546');
SET @school = LAST_INSERT_ID();

-- 회원 3명 (비밀번호 mirim1234 의 bcrypt 해시)
INSERT INTO member (login_id, password_hash, name, school_id, notify_allergy, notify_tomorrow) VALUES ('mirim01', '$2a$10$rqinA/9vreXNLT8mIKZ/5.oKu9DeYm.SMis2LP3..gQ833pVYwh0u', '김미림', @school, 1, 0);
INSERT INTO member (login_id, password_hash, name, school_id, notify_allergy, notify_tomorrow) VALUES ('mirim02', '$2a$10$rqinA/9vreXNLT8mIKZ/5.oKu9DeYm.SMis2LP3..gQ833pVYwh0u', '이급식', @school, 1, 1);
INSERT INTO member (login_id, password_hash, name, school_id, notify_allergy, notify_tomorrow) VALUES ('mirim03', '$2a$10$rqinA/9vreXNLT8mIKZ/5.oKu9DeYm.SMis2LP3..gQ833pVYwh0u', '박알레', @school, 0, 0);

-- 회원 알레르기: 급식표 번호(mark_no)로 알레르기를 찾아서 연결 (2 우유, 6 밀 / 1 난류, 9 새우)
INSERT INTO member_allergy (member_id, allergy_id)
  SELECT m.member_id, a.allergy_id FROM member m JOIN allergy a ON a.mark_no IN (2, 6) WHERE m.login_id = 'mirim01';
INSERT INTO member_allergy (member_id, allergy_id)
  SELECT m.member_id, a.allergy_id FROM member m JOIN allergy a ON a.mark_no IN (1, 9) WHERE m.login_id = 'mirim02';

-- 메뉴 이름 사전 (같은 메뉴가 여러 날 나와도 한 번만 저장)
INSERT INTO menu (menu_name) VALUES
  ('잡곡밥'),
  ('소고기미역국'),
  ('제육볶음'),
  ('계란말이'),
  ('배추김치'),
  ('요구르트'),
  ('기장밥'),
  ('순두부찌개'),
  ('돈까스&소스'),
  ('마카로니샐러드'),
  ('깍두기'),
  ('카레라이스'),
  ('유부장국'),
  ('치킨너겟'),
  ('단무지무침'),
  ('흑미밥'),
  ('된장찌개'),
  ('고등어구이'),
  ('감자조림'),
  ('우유'),
  ('김치볶음밥'),
  ('짬뽕국'),
  ('탕수육');

-- 지난주 월요일 중식
INSERT INTO meal (school_id, meal_date, meal_type, calories, carbs, protein, fat) VALUES (@school, @prev + INTERVAL 0 DAY, '중식', 812.4, 115.2, 32.1, 22.4);
SET @meal = LAST_INSERT_ID();
INSERT INTO meal_menu (meal_id, menu_id, sort_order) SELECT @meal, menu_id, CASE menu_name WHEN '잡곡밥' THEN 0 WHEN '소고기미역국' THEN 1 WHEN '제육볶음' THEN 2 WHEN '계란말이' THEN 3 WHEN '배추김치' THEN 4 WHEN '요구르트' THEN 5 END FROM menu WHERE menu_name IN ('잡곡밥', '소고기미역국', '제육볶음', '계란말이', '배추김치', '요구르트');
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 6, 16) WHERE mn.menu_name = '소고기미역국';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 6, 10, 13) WHERE mn.menu_name = '제육볶음';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (1) WHERE mn.menu_name = '계란말이';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (9, 13) WHERE mn.menu_name = '배추김치';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (2) WHERE mn.menu_name = '요구르트';

-- 지난주 화요일 중식
INSERT INTO meal (school_id, meal_date, meal_type, calories, carbs, protein, fat) VALUES (@school, @prev + INTERVAL 1 DAY, '중식', 845.0, 118.6, 30.5, 27.3);
SET @meal = LAST_INSERT_ID();
INSERT INTO meal_menu (meal_id, menu_id, sort_order) SELECT @meal, menu_id, CASE menu_name WHEN '기장밥' THEN 0 WHEN '순두부찌개' THEN 1 WHEN '돈까스&소스' THEN 2 WHEN '마카로니샐러드' THEN 3 WHEN '깍두기' THEN 4 END FROM menu WHERE menu_name IN ('기장밥', '순두부찌개', '돈까스&소스', '마카로니샐러드', '깍두기');
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 9, 18) WHERE mn.menu_name = '순두부찌개';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (1, 2, 5, 6, 10, 12) WHERE mn.menu_name = '돈까스&소스';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (1, 5, 6) WHERE mn.menu_name = '마카로니샐러드';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (9, 13) WHERE mn.menu_name = '깍두기';

-- 지난주 수요일 중식
INSERT INTO meal (school_id, meal_date, meal_type, calories, carbs, protein, fat) VALUES (@school, @prev + INTERVAL 2 DAY, '중식', 798.2, 121.0, 28.4, 20.8);
SET @meal = LAST_INSERT_ID();
INSERT INTO meal_menu (meal_id, menu_id, sort_order) SELECT @meal, menu_id, CASE menu_name WHEN '카레라이스' THEN 0 WHEN '유부장국' THEN 1 WHEN '치킨너겟' THEN 2 WHEN '단무지무침' THEN 3 WHEN '배추김치' THEN 4 END FROM menu WHERE menu_name IN ('카레라이스', '유부장국', '치킨너겟', '단무지무침', '배추김치');
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (2, 5, 6, 10, 13) WHERE mn.menu_name = '카레라이스';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 6) WHERE mn.menu_name = '유부장국';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (1, 5, 6, 15) WHERE mn.menu_name = '치킨너겟';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (13) WHERE mn.menu_name = '단무지무침';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (9, 13) WHERE mn.menu_name = '배추김치';

-- 지난주 목요일 중식
INSERT INTO meal (school_id, meal_date, meal_type, calories, carbs, protein, fat) VALUES (@school, @prev + INTERVAL 3 DAY, '중식', 760.7, 108.3, 34.9, 19.6);
SET @meal = LAST_INSERT_ID();
INSERT INTO meal_menu (meal_id, menu_id, sort_order) SELECT @meal, menu_id, CASE menu_name WHEN '흑미밥' THEN 0 WHEN '된장찌개' THEN 1 WHEN '고등어구이' THEN 2 WHEN '감자조림' THEN 3 WHEN '깍두기' THEN 4 WHEN '우유' THEN 5 END FROM menu WHERE menu_name IN ('흑미밥', '된장찌개', '고등어구이', '감자조림', '깍두기', '우유');
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 6, 9) WHERE mn.menu_name = '된장찌개';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (7) WHERE mn.menu_name = '고등어구이';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 6) WHERE mn.menu_name = '감자조림';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (9, 13) WHERE mn.menu_name = '깍두기';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (2) WHERE mn.menu_name = '우유';

-- 지난주 금요일 중식
INSERT INTO meal (school_id, meal_date, meal_type, calories, carbs, protein, fat) VALUES (@school, @prev + INTERVAL 4 DAY, '중식', 880.5, 124.7, 31.2, 28.9);
SET @meal = LAST_INSERT_ID();
INSERT INTO meal_menu (meal_id, menu_id, sort_order) SELECT @meal, menu_id, CASE menu_name WHEN '김치볶음밥' THEN 0 WHEN '짬뽕국' THEN 1 WHEN '탕수육' THEN 2 WHEN '단무지무침' THEN 3 WHEN '요구르트' THEN 4 END FROM menu WHERE menu_name IN ('김치볶음밥', '짬뽕국', '탕수육', '단무지무침', '요구르트');
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (1, 5, 6, 9, 10, 13) WHERE mn.menu_name = '김치볶음밥';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 6, 9, 17, 18) WHERE mn.menu_name = '짬뽕국';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (1, 5, 6, 10, 12) WHERE mn.menu_name = '탕수육';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (13) WHERE mn.menu_name = '단무지무침';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (2) WHERE mn.menu_name = '요구르트';

-- 이번 주 월요일 중식
INSERT INTO meal (school_id, meal_date, meal_type, calories, carbs, protein, fat) VALUES (@school, @mon + INTERVAL 0 DAY, '중식', 812.4, 115.2, 32.1, 22.4);
SET @meal = LAST_INSERT_ID();
INSERT INTO meal_menu (meal_id, menu_id, sort_order) SELECT @meal, menu_id, CASE menu_name WHEN '잡곡밥' THEN 0 WHEN '소고기미역국' THEN 1 WHEN '제육볶음' THEN 2 WHEN '계란말이' THEN 3 WHEN '배추김치' THEN 4 WHEN '요구르트' THEN 5 END FROM menu WHERE menu_name IN ('잡곡밥', '소고기미역국', '제육볶음', '계란말이', '배추김치', '요구르트');
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 6, 16) WHERE mn.menu_name = '소고기미역국';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 6, 10, 13) WHERE mn.menu_name = '제육볶음';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (1) WHERE mn.menu_name = '계란말이';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (9, 13) WHERE mn.menu_name = '배추김치';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (2) WHERE mn.menu_name = '요구르트';

-- 이번 주 화요일 중식
INSERT INTO meal (school_id, meal_date, meal_type, calories, carbs, protein, fat) VALUES (@school, @mon + INTERVAL 1 DAY, '중식', 845.0, 118.6, 30.5, 27.3);
SET @meal = LAST_INSERT_ID();
INSERT INTO meal_menu (meal_id, menu_id, sort_order) SELECT @meal, menu_id, CASE menu_name WHEN '기장밥' THEN 0 WHEN '순두부찌개' THEN 1 WHEN '돈까스&소스' THEN 2 WHEN '마카로니샐러드' THEN 3 WHEN '깍두기' THEN 4 END FROM menu WHERE menu_name IN ('기장밥', '순두부찌개', '돈까스&소스', '마카로니샐러드', '깍두기');
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 9, 18) WHERE mn.menu_name = '순두부찌개';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (1, 2, 5, 6, 10, 12) WHERE mn.menu_name = '돈까스&소스';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (1, 5, 6) WHERE mn.menu_name = '마카로니샐러드';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (9, 13) WHERE mn.menu_name = '깍두기';

-- 이번 주 수요일 중식
INSERT INTO meal (school_id, meal_date, meal_type, calories, carbs, protein, fat) VALUES (@school, @mon + INTERVAL 2 DAY, '중식', 798.2, 121.0, 28.4, 20.8);
SET @meal = LAST_INSERT_ID();
INSERT INTO meal_menu (meal_id, menu_id, sort_order) SELECT @meal, menu_id, CASE menu_name WHEN '카레라이스' THEN 0 WHEN '유부장국' THEN 1 WHEN '치킨너겟' THEN 2 WHEN '단무지무침' THEN 3 WHEN '배추김치' THEN 4 END FROM menu WHERE menu_name IN ('카레라이스', '유부장국', '치킨너겟', '단무지무침', '배추김치');
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (2, 5, 6, 10, 13) WHERE mn.menu_name = '카레라이스';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 6) WHERE mn.menu_name = '유부장국';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (1, 5, 6, 15) WHERE mn.menu_name = '치킨너겟';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (13) WHERE mn.menu_name = '단무지무침';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (9, 13) WHERE mn.menu_name = '배추김치';

-- 이번 주 목요일 중식
INSERT INTO meal (school_id, meal_date, meal_type, calories, carbs, protein, fat) VALUES (@school, @mon + INTERVAL 3 DAY, '중식', 760.7, 108.3, 34.9, 19.6);
SET @meal = LAST_INSERT_ID();
INSERT INTO meal_menu (meal_id, menu_id, sort_order) SELECT @meal, menu_id, CASE menu_name WHEN '흑미밥' THEN 0 WHEN '된장찌개' THEN 1 WHEN '고등어구이' THEN 2 WHEN '감자조림' THEN 3 WHEN '깍두기' THEN 4 WHEN '우유' THEN 5 END FROM menu WHERE menu_name IN ('흑미밥', '된장찌개', '고등어구이', '감자조림', '깍두기', '우유');
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 6, 9) WHERE mn.menu_name = '된장찌개';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (7) WHERE mn.menu_name = '고등어구이';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 6) WHERE mn.menu_name = '감자조림';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (9, 13) WHERE mn.menu_name = '깍두기';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (2) WHERE mn.menu_name = '우유';

-- 이번 주 금요일 중식
INSERT INTO meal (school_id, meal_date, meal_type, calories, carbs, protein, fat) VALUES (@school, @mon + INTERVAL 4 DAY, '중식', 880.5, 124.7, 31.2, 28.9);
SET @meal = LAST_INSERT_ID();
INSERT INTO meal_menu (meal_id, menu_id, sort_order) SELECT @meal, menu_id, CASE menu_name WHEN '김치볶음밥' THEN 0 WHEN '짬뽕국' THEN 1 WHEN '탕수육' THEN 2 WHEN '단무지무침' THEN 3 WHEN '요구르트' THEN 4 END FROM menu WHERE menu_name IN ('김치볶음밥', '짬뽕국', '탕수육', '단무지무침', '요구르트');
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (1, 5, 6, 9, 10, 13) WHERE mn.menu_name = '김치볶음밥';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (5, 6, 9, 17, 18) WHERE mn.menu_name = '짬뽕국';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (1, 5, 6, 10, 12) WHERE mn.menu_name = '탕수육';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (13) WHERE mn.menu_name = '단무지무침';
INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) SELECT @meal, mn.menu_id, a.allergy_id FROM menu mn JOIN allergy a ON a.mark_no IN (2) WHERE mn.menu_name = '요구르트';

-- 나이스 동기화 기록: 두 주 모두 방금 받아온 것으로 기록
INSERT INTO meal_sync (school_id, from_date, to_date, synced_at) VALUES
  (@school, @prev, @prev + INTERVAL 4 DAY, NOW()),
  (@school, @mon,  @mon  + INTERVAL 4 DAY, NOW());

-- 평가: 지난주 급식에 남긴 별점과 한 줄 평 (회원·날짜·메뉴로 식단을 찾아서 넣음)
INSERT INTO review (member_id, meal_id, menu_id, rating, comment)
  SELECT m.member_id, ml.meal_id, mn.menu_id, 5, '양념이 딱 좋아서 밥이랑 먹기 좋았어요'
    FROM member m, meal ml, menu mn
   WHERE m.login_id = 'mirim01' AND ml.school_id = @school AND ml.meal_date = @prev + INTERVAL 0 DAY AND ml.meal_type = '중식' AND mn.menu_name = '제육볶음';
INSERT INTO review (member_id, meal_id, menu_id, rating, comment)
  SELECT m.member_id, ml.meal_id, mn.menu_id, 4, '바삭했는데 소스가 조금 짰어요'
    FROM member m, meal ml, menu mn
   WHERE m.login_id = 'mirim01' AND ml.school_id = @school AND ml.meal_date = @prev + INTERVAL 1 DAY AND ml.meal_type = '중식' AND mn.menu_name = '돈까스&소스';
INSERT INTO review (member_id, meal_id, menu_id, rating, comment)
  SELECT m.member_id, ml.meal_id, mn.menu_id, 3, NULL
    FROM member m, meal ml, menu mn
   WHERE m.login_id = 'mirim01' AND ml.school_id = @school AND ml.meal_date = @prev + INTERVAL 3 DAY AND ml.meal_type = '중식' AND mn.menu_name = '고등어구이';
INSERT INTO review (member_id, meal_id, menu_id, rating, comment)
  SELECT m.member_id, ml.meal_id, mn.menu_id, 4, '조금 매웠지만 맛있었어요'
    FROM member m, meal ml, menu mn
   WHERE m.login_id = 'mirim02' AND ml.school_id = @school AND ml.meal_date = @prev + INTERVAL 0 DAY AND ml.meal_type = '중식' AND mn.menu_name = '제육볶음';
INSERT INTO review (member_id, meal_id, menu_id, rating, comment)
  SELECT m.member_id, ml.meal_id, mn.menu_id, 5, '건더기가 많아서 좋았어요!'
    FROM member m, meal ml, menu mn
   WHERE m.login_id = 'mirim02' AND ml.school_id = @school AND ml.meal_date = @prev + INTERVAL 2 DAY AND ml.meal_type = '중식' AND mn.menu_name = '카레라이스';
INSERT INTO review (member_id, meal_id, menu_id, rating, comment)
  SELECT m.member_id, ml.meal_id, mn.menu_id, 5, '이번 주 최고 메뉴'
    FROM member m, meal ml, menu mn
   WHERE m.login_id = 'mirim02' AND ml.school_id = @school AND ml.meal_date = @prev + INTERVAL 4 DAY AND ml.meal_type = '중식' AND mn.menu_name = '탕수육';
INSERT INTO review (member_id, meal_id, menu_id, rating, comment)
  SELECT m.member_id, ml.meal_id, mn.menu_id, 5, '양이 많아서 든든했어요'
    FROM member m, meal ml, menu mn
   WHERE m.login_id = 'mirim03' AND ml.school_id = @school AND ml.meal_date = @prev + INTERVAL 1 DAY AND ml.meal_type = '중식' AND mn.menu_name = '돈까스&소스';
INSERT INTO review (member_id, meal_id, menu_id, rating, comment)
  SELECT m.member_id, ml.meal_id, mn.menu_id, 4, NULL
    FROM member m, meal ml, menu mn
   WHERE m.login_id = 'mirim03' AND ml.school_id = @school AND ml.meal_date = @prev + INTERVAL 2 DAY AND ml.meal_type = '중식' AND mn.menu_name = '치킨너겟';
INSERT INTO review (member_id, meal_id, menu_id, rating, comment)
  SELECT m.member_id, ml.meal_id, mn.menu_id, 3, '국물이 조금 식어 있었어요'
    FROM member m, meal ml, menu mn
   WHERE m.login_id = 'mirim03' AND ml.school_id = @school AND ml.meal_date = @prev + INTERVAL 4 DAY AND ml.meal_type = '중식' AND mn.menu_name = '짬뽕국';

-- 확인용: 테이블마다 몇 줄 들어갔는지
SELECT 'school' AS 테이블, COUNT(*) AS 줄수 FROM school
UNION ALL SELECT 'member', COUNT(*) FROM member
UNION ALL SELECT 'allergy', COUNT(*) FROM allergy
UNION ALL SELECT 'member_allergy', COUNT(*) FROM member_allergy
UNION ALL SELECT 'menu', COUNT(*) FROM menu
UNION ALL SELECT 'meal', COUNT(*) FROM meal
UNION ALL SELECT 'meal_menu', COUNT(*) FROM meal_menu
UNION ALL SELECT 'meal_menu_allergy', COUNT(*) FROM meal_menu_allergy
UNION ALL SELECT 'review', COUNT(*) FROM review
UNION ALL SELECT 'notice', COUNT(*) FROM notice
UNION ALL SELECT 'meal_sync', COUNT(*) FROM meal_sync;

