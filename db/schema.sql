-- ===================================================================
-- 오늘의 급식 · 전체 DB 스키마 (MySQL 8.0)
-- MySQL Workbench에서 이 파일을 열고 번개(⚡) 버튼으로 전체 실행합니다.
-- 여러 번 실행해도 안전합니다. (IF NOT EXISTS / INSERT IGNORE: 이미 있으면 건너뜀)
-- ※ 이전 버전(회원·알레르기만 있던 버전)에서 올라온 경우에는 db/reset.sql을 먼저 한 번 실행하세요.
-- ===================================================================

-- 한글이 깨지지 않도록 접속 문자셋 지정
SET NAMES utf8mb4;

-- 데이터베이스(테이블들을 담는 그릇) 만들기
CREATE DATABASE IF NOT EXISTS oneul_geupsik
  DEFAULT CHARACTER SET utf8mb4            -- 한글·이모지까지 저장할 수 있는 문자셋
  DEFAULT COLLATE utf8mb4_unicode_ci;      -- 문자 비교·정렬 규칙 (대소문자 구분 안 함)

USE oneul_geupsik;                         -- 아래에서 만드는 테이블은 모두 이 DB 안에 생김

-- =========================================================
-- 학교 (school) : 나이스에서 검색해 고른 학교만 저장
-- =========================================================
CREATE TABLE IF NOT EXISTS school (
  school_id   INT AUTO_INCREMENT PRIMARY KEY,  -- 학교 번호 (1, 2, 3… 자동으로 매겨짐)
  office_code VARCHAR(10)  NOT NULL,                 -- 시도교육청코드 (ATPT_OFCDC_SC_CODE)
  school_code VARCHAR(10)  NOT NULL,                 -- 행정표준코드 (SD_SCHUL_CODE)
  school_name VARCHAR(100) NOT NULL,                 -- 학교 이름
  school_kind VARCHAR(20)  NULL,                     -- 초등학교 / 중학교 / 고등학교 …
  region      VARCHAR(20)  NULL,                     -- 서울특별시 …
  address     VARCHAR(200) NULL,                     -- 도로명 주소
  CONSTRAINT uq_school_code UNIQUE (office_code, school_code)  -- 같은 학교가 두 번 저장되지 않게 (교육청+학교코드 조합은 하나뿐)
);

-- =========================================================
-- 회원 (member)
-- =========================================================
CREATE TABLE IF NOT EXISTS member (
  member_id       INT AUTO_INCREMENT PRIMARY KEY,    -- 회원 번호
  login_id        VARCHAR(20)  NOT NULL,             -- 로그인 아이디
  password_hash   VARCHAR(100) NOT NULL,             -- bcrypt 해시 (평문 저장 금지: 원래 비밀번호는 DB에 남지 않음)
  name            VARCHAR(20)  NOT NULL,             -- 이름
  role            VARCHAR(10)  NOT NULL DEFAULT '학생',  -- 역할 (지금은 모두 학생, 나중에 관리자 기능용으로 남겨둠)
  school_id       INT          NULL,                 -- 내 학교 (아직 안 골랐으면 NULL)
  notify_allergy  BOOLEAN      NOT NULL DEFAULT TRUE,  -- 내 알레르기 메뉴 알림
  notify_tomorrow BOOLEAN      NOT NULL DEFAULT FALSE, -- 내일 식단 미리 보기
  joined_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 가입 시각 (값을 안 넣으면 지금 시각이 자동으로 들어감)
  CONSTRAINT uq_member_login_id UNIQUE (login_id),                   -- 같은 아이디로 두 번 가입할 수 없음
  CONSTRAINT ck_member_role CHECK (role IN ('학생', '관리자')),       -- 역할은 두 가지 값만 허용
  CONSTRAINT fk_member_school FOREIGN KEY (school_id) REFERENCES school(school_id) ON DELETE SET NULL  -- 학교가 지워지면 회원의 학교만 NULL로 (회원은 남김)
);

-- =========================================================
-- 알레르기 (allergy) : 급식 표기 기준 19종
-- =========================================================
CREATE TABLE IF NOT EXISTS allergy (
  allergy_id   INT AUTO_INCREMENT PRIMARY KEY,   -- 알레르기 번호 (DB 내부용)
  allergy_name VARCHAR(20) NOT NULL,             -- 알레르기 이름 (예: 우유)
  mark_no      TINYINT     NOT NULL,                 -- 급식표에 붙는 번호
  CONSTRAINT uq_allergy_name UNIQUE (allergy_name),                    -- 이름 중복 불가
  CONSTRAINT uq_allergy_mark_no UNIQUE (mark_no),                      -- 번호 중복 불가
  CONSTRAINT ck_allergy_mark_no CHECK (mark_no BETWEEN 1 AND 19)       -- 급식표 번호는 1~19만 허용
);

-- 알레르기 19종을 미리 넣어둠 (INSERT IGNORE: 이미 있으면 오류 없이 건너뜀)
INSERT IGNORE INTO allergy (mark_no, allergy_name) VALUES
  (1, '난류'), (2, '우유'), (3, '메밀'), (4, '땅콩'), (5, '대두'),
  (6, '밀'), (7, '고등어'), (8, '게'), (9, '새우'), (10, '돼지고기'),
  (11, '복숭아'), (12, '토마토'), (13, '아황산류'), (14, '호두'), (15, '닭고기'),
  (16, '쇠고기'), (17, '오징어'), (18, '조개류'), (19, '잣');

-- 회원_알레르기 (member_allergy) : 회원 N:M 알레르기
-- 회원 한 명이 알레르기 여러 개를 가질 수 있고, 알레르기 하나도 여러 회원이 가질 수 있어서 연결 테이블로 풂
CREATE TABLE IF NOT EXISTS member_allergy (
  member_id  INT NOT NULL,                       -- 누가
  allergy_id INT NOT NULL,                       -- 어떤 알레르기가 있는지
  PRIMARY KEY (member_id, allergy_id),           -- 복합 기본키: 같은 회원이 같은 알레르기를 두 번 등록할 수 없음
  CONSTRAINT fk_ma_member  FOREIGN KEY (member_id)  REFERENCES member(member_id)   ON DELETE CASCADE,   -- 회원이 탈퇴하면 그 회원의 알레르기도 함께 삭제
  CONSTRAINT fk_ma_allergy FOREIGN KEY (allergy_id) REFERENCES allergy(allergy_id) ON DELETE RESTRICT   -- 누가 쓰고 있는 알레르기는 삭제 못 하게 막음
);

-- =========================================================
-- 메뉴 (menu) : 메뉴 이름만 한 번씩 저장 (같은 메뉴가 여러 날 나와도 1행)
-- =========================================================
CREATE TABLE IF NOT EXISTS menu (
  menu_id   INT AUTO_INCREMENT PRIMARY KEY,      -- 메뉴 번호
  menu_name VARCHAR(100) NOT NULL,               -- 메뉴 이름 (예: 제육볶음)
  CONSTRAINT uq_menu_name UNIQUE (menu_name)     -- 같은 이름은 한 번만 저장
);

-- =========================================================
-- 식단 (meal) : 어느 학교의 어느 날 한 끼
-- 나이스는 영양 정보를 메뉴별이 아니라 "한 끼 전체" 기준으로 주므로 여기에 저장
-- =========================================================
CREATE TABLE IF NOT EXISTS meal (
  meal_id   INT AUTO_INCREMENT PRIMARY KEY,      -- 식단 번호
  school_id INT          NOT NULL,               -- 어느 학교의 급식인지
  meal_date DATE         NOT NULL,               -- 급식 날짜
  meal_type VARCHAR(4)   NOT NULL,                   -- 조식 / 중식 / 석식
  calories  DECIMAL(6,1) NULL,                       -- kcal
  carbs     DECIMAL(6,1) NULL,                       -- 탄수화물 g
  protein   DECIMAL(6,1) NULL,                       -- 단백질 g
  fat       DECIMAL(6,1) NULL,                       -- 지방 g
  CONSTRAINT uq_meal UNIQUE (school_id, meal_date, meal_type),          -- 같은 학교·같은 날·같은 끼니는 하나뿐
  CONSTRAINT ck_meal_type CHECK (meal_type IN ('조식', '중식', '석식')),  -- 끼니는 세 가지만 허용
  CONSTRAINT ck_meal_nutrition CHECK (calories >= 0 AND carbs >= 0 AND protein >= 0 AND fat >= 0),  -- 영양값은 음수 불가
  CONSTRAINT fk_meal_school FOREIGN KEY (school_id) REFERENCES school(school_id) ON DELETE CASCADE   -- 학교가 지워지면 그 학교 식단도 삭제
);

-- 식단_메뉴 (meal_menu) : 식단 N:M 메뉴 (그날 그 끼니에 나온 메뉴)
-- 한 끼에 메뉴가 여러 개, 한 메뉴도 여러 날 나오므로 연결 테이블로 풂
CREATE TABLE IF NOT EXISTS meal_menu (
  meal_id    INT     NOT NULL,                   -- 어느 끼니에
  menu_id    INT     NOT NULL,                   -- 어떤 메뉴가 나왔는지
  sort_order TINYINT NOT NULL DEFAULT 0,             -- 급식표에 적힌 순서
  PRIMARY KEY (meal_id, menu_id),                -- 한 끼에 같은 메뉴가 두 번 들어가지 않게
  CONSTRAINT fk_mm_meal FOREIGN KEY (meal_id) REFERENCES meal(meal_id) ON DELETE CASCADE,    -- 식단이 지워지면 연결도 삭제
  CONSTRAINT fk_mm_menu FOREIGN KEY (menu_id) REFERENCES menu(menu_id) ON DELETE RESTRICT    -- 식단에 쓰이는 메뉴는 삭제 불가
);

-- 식단_메뉴_알레르기 : 그날 나온 메뉴에 붙은 알레르기 번호
-- (같은 이름의 메뉴라도 날마다 레시피가 달라 알레르기가 다를 수 있으므로 "그날 나온 메뉴" 기준)
CREATE TABLE IF NOT EXISTS meal_menu_allergy (
  meal_id    INT NOT NULL,                       -- 어느 끼니의
  menu_id    INT NOT NULL,                       -- 어떤 메뉴에
  allergy_id INT NOT NULL,                       -- 어떤 알레르기가 표시됐는지
  PRIMARY KEY (meal_id, menu_id, allergy_id),    -- 같은 번호가 두 번 들어가지 않게
  CONSTRAINT fk_mma_meal_menu FOREIGN KEY (meal_id, menu_id) REFERENCES meal_menu(meal_id, menu_id) ON DELETE CASCADE,  -- 복합 외래키: 실제로 그날 나온 메뉴에만 붙일 수 있음
  CONSTRAINT fk_mma_allergy   FOREIGN KEY (allergy_id) REFERENCES allergy(allergy_id) ON DELETE RESTRICT
);

-- =========================================================
-- 평가 (review) : 그날 나온 메뉴에 대한 별점과 한 줄 평
-- =========================================================
CREATE TABLE IF NOT EXISTS review (
  review_id  INT AUTO_INCREMENT PRIMARY KEY,     -- 평가 번호
  member_id  INT          NOT NULL,              -- 누가 썼는지
  meal_id    INT          NOT NULL,              -- 어느 끼니의
  menu_id    INT          NOT NULL,              -- 어떤 메뉴에 대한 평가인지
  rating     TINYINT      NOT NULL,              -- 별점
  comment    VARCHAR(100) NULL,                  -- 한 줄 평 (100자까지, 안 써도 됨)
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,                              -- 작성 시각
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,  -- 수정 시각 (행이 바뀌면 자동 갱신)
  CONSTRAINT uq_review_once UNIQUE (member_id, meal_id, menu_id),   -- 같은 날 같은 메뉴는 한 번만
  CONSTRAINT ck_review_rating CHECK (rating BETWEEN 1 AND 5),       -- 별점은 1~5점만
  CONSTRAINT fk_review_member    FOREIGN KEY (member_id) REFERENCES member(member_id) ON DELETE CASCADE,                -- 회원 탈퇴 시 평가도 삭제
  CONSTRAINT fk_review_meal_menu FOREIGN KEY (meal_id, menu_id) REFERENCES meal_menu(meal_id, menu_id) ON DELETE RESTRICT  -- 실제로 나온 메뉴에만 평가 가능, 평가가 있으면 그 메뉴 기록은 못 지움
);

-- =========================================================
-- 공지사항 (notice)
-- =========================================================
CREATE TABLE IF NOT EXISTS notice (
  notice_id  INT AUTO_INCREMENT PRIMARY KEY,     -- 공지 번호
  title      VARCHAR(100) NOT NULL,              -- 제목
  body       TEXT         NOT NULL,              -- 내용 (긴 글이라 TEXT)
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP  -- 작성 시각
);

-- 처음 실행할 때만 공지 3개를 넣음 (WHERE NOT EXISTS: 공지가 하나라도 있으면 안 넣음)
INSERT INTO notice (title, body, created_at)
SELECT * FROM (
  SELECT '오늘의 급식 서비스를 시작해요' AS title,
         '학교를 고르면 나이스(NEIS)에 공개된 급식 식단을 날짜별로 볼 수 있어요. 내 알레르기를 등록하면 주의해야 할 메뉴를 빨간색으로 알려드려요.' AS body,
         '2026-11-02 09:00:00' AS created_at
  UNION ALL
  SELECT '알레르기 정보는 참고용이에요',
         '알레르기 번호는 학교가 나이스에 올린 급식표를 그대로 보여줍니다. 심한 알레르기가 있다면 영양사 선생님께 꼭 다시 확인해 주세요.',
         '2026-11-02 09:10:00'
  UNION ALL
  SELECT '평가는 하루에 메뉴당 한 번만 남길 수 있어요',
         '같은 날 같은 메뉴에는 한 번만 평가할 수 있고, 이미 남긴 평가는 다시 들어가서 고칠 수 있어요. 아직 제공되지 않은 급식은 평가할 수 없어요.',
         '2026-11-02 09:20:00'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM notice);

-- =========================================================
-- 식단 동기화 기록 (meal_sync) : 나이스를 너무 자주 부르지 않도록 언제 받아왔는지 기록
-- =========================================================
CREATE TABLE IF NOT EXISTS meal_sync (
  school_id INT      NOT NULL,                   -- 어느 학교의
  from_date DATE     NOT NULL,                   -- 어느 기간(시작일)부터
  to_date   DATE     NOT NULL,                   -- 어느 기간(종료일)까지를
  synced_at DATETIME NOT NULL,                   -- 언제 나이스에서 받아왔는지
  PRIMARY KEY (school_id, from_date, to_date),   -- 학교+기간마다 기록 하나
  CONSTRAINT fk_sync_school FOREIGN KEY (school_id) REFERENCES school(school_id) ON DELETE CASCADE
);
