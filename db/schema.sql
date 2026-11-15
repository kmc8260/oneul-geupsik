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
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE oneul_geupsik;

-- =========================================================
-- 학교 (school) : 나이스에서 검색해 고른 학교만 저장
-- =========================================================
-- 교육청 코드 + 학교 코드는 나이스의 학교 식별값 → 둘을 묶어 UNIQUE (같은 학교 중복 저장 방지)
CREATE TABLE IF NOT EXISTS school (
  school_id   INT AUTO_INCREMENT PRIMARY KEY,
  office_code VARCHAR(10)  NOT NULL,
  school_code VARCHAR(10)  NOT NULL,
  school_name VARCHAR(100) NOT NULL,
  school_kind VARCHAR(20)  NULL,
  region      VARCHAR(20)  NULL,
  address     VARCHAR(200) NULL,
  CONSTRAINT uq_school_code UNIQUE (office_code, school_code)
);

-- =========================================================
-- 회원 (member)
-- =========================================================
-- 비밀번호는 bcrypt 해시로만 저장, login_id는 UNIQUE(중복 가입 불가), role은 CHECK로 '학생'/'관리자'만
-- school_id는 학교를 아직 안 골랐으면 NULL, 학교가 지워지면 NULL로 (ON DELETE SET NULL)
-- notify_* 는 마이페이지 알림 설정(켜짐 1 / 꺼짐 0)
CREATE TABLE IF NOT EXISTS member (
  member_id       INT AUTO_INCREMENT PRIMARY KEY,
  login_id        VARCHAR(20)  NOT NULL,
  password_hash   VARCHAR(100) NOT NULL,
  name            VARCHAR(20)  NOT NULL,
  role            VARCHAR(10)  NOT NULL DEFAULT '학생',
  school_id       INT          NULL,
  notify_allergy  BOOLEAN      NOT NULL DEFAULT TRUE,
  notify_tomorrow BOOLEAN      NOT NULL DEFAULT FALSE,
  joined_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_member_login_id UNIQUE (login_id),
  CONSTRAINT ck_member_role CHECK (role IN ('학생', '관리자')),
  CONSTRAINT fk_member_school FOREIGN KEY (school_id) REFERENCES school(school_id) ON DELETE SET NULL
);

-- =========================================================
-- 알레르기 (allergy) : 급식 표기 기준 19종
-- =========================================================
-- mark_no = 급식표에 붙는 번호(1~19, CHECK), 번호와 이름 모두 UNIQUE
CREATE TABLE IF NOT EXISTS allergy (
  allergy_id   INT AUTO_INCREMENT PRIMARY KEY,
  allergy_name VARCHAR(20) NOT NULL,
  mark_no      TINYINT     NOT NULL,
  CONSTRAINT uq_allergy_name UNIQUE (allergy_name),
  CONSTRAINT uq_allergy_mark_no UNIQUE (mark_no),
  CONSTRAINT ck_allergy_mark_no CHECK (mark_no BETWEEN 1 AND 19)
);

-- 알레르기 19종을 미리 넣어둠 (INSERT IGNORE: 이미 있으면 오류 없이 건너뜀)
INSERT IGNORE INTO allergy (mark_no, allergy_name) VALUES
  (1, '난류'), (2, '우유'), (3, '메밀'), (4, '땅콩'), (5, '대두'),
  (6, '밀'), (7, '고등어'), (8, '게'), (9, '새우'), (10, '돼지고기'),
  (11, '복숭아'), (12, '토마토'), (13, '아황산류'), (14, '호두'), (15, '닭고기'),
  (16, '쇠고기'), (17, '오징어'), (18, '조개류'), (19, '잣');

-- 회원_알레르기 (member_allergy) : 회원 N:M 알레르기
-- 회원 한 명이 알레르기 여러 개를 가질 수 있고, 알레르기 하나도 여러 회원이 가질 수 있어서 연결 테이블로 풂
-- PK가 (회원, 알레르기) 두 칸 → 같은 알레르기를 두 번 등록할 수 없음
-- 회원 탈퇴하면 함께 삭제(CASCADE), 누가 쓰는 알레르기는 지울 수 없음(RESTRICT)
CREATE TABLE IF NOT EXISTS member_allergy (
  member_id  INT NOT NULL,
  allergy_id INT NOT NULL,
  PRIMARY KEY (member_id, allergy_id),
  CONSTRAINT fk_ma_member  FOREIGN KEY (member_id)  REFERENCES member(member_id)   ON DELETE CASCADE,
  CONSTRAINT fk_ma_allergy FOREIGN KEY (allergy_id) REFERENCES allergy(allergy_id) ON DELETE RESTRICT
);

-- =========================================================
-- 메뉴 (menu) : 메뉴 이름만 한 번씩 저장 (같은 메뉴가 여러 날 나와도 1행)
-- =========================================================
-- menu_name UNIQUE → 같은 이름은 한 번만 저장
CREATE TABLE IF NOT EXISTS menu (
  menu_id   INT AUTO_INCREMENT PRIMARY KEY,
  menu_name VARCHAR(100) NOT NULL,
  CONSTRAINT uq_menu_name UNIQUE (menu_name)
);

-- =========================================================
-- 식단 (meal) : 어느 학교의 어느 날 한 끼
-- 나이스는 영양 정보를 메뉴별이 아니라 "한 끼 전체" 기준으로 주므로 여기에 저장
-- =========================================================
-- (학교, 날짜, 끼니) UNIQUE → 같은 끼니가 두 번 저장되지 않음, 끼니는 CHECK로 조식/중식/석식만
-- 영양값(열량·탄수화물·단백질·지방)은 0 이상만 허용, 학교가 지워지면 식단도 삭제(CASCADE)
CREATE TABLE IF NOT EXISTS meal (
  meal_id   INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT          NOT NULL,
  meal_date DATE         NOT NULL,
  meal_type VARCHAR(4)   NOT NULL,
  calories  DECIMAL(6,1) NULL,
  carbs     DECIMAL(6,1) NULL,
  protein   DECIMAL(6,1) NULL,
  fat       DECIMAL(6,1) NULL,
  CONSTRAINT uq_meal UNIQUE (school_id, meal_date, meal_type),
  CONSTRAINT ck_meal_type CHECK (meal_type IN ('조식', '중식', '석식')),
  CONSTRAINT ck_meal_nutrition CHECK (calories >= 0 AND carbs >= 0 AND protein >= 0 AND fat >= 0),
  CONSTRAINT fk_meal_school FOREIGN KEY (school_id) REFERENCES school(school_id) ON DELETE CASCADE
);

-- 식단_메뉴 (meal_menu) : 식단 N:M 메뉴 (그날 그 끼니에 나온 메뉴)
-- 한 끼에 메뉴가 여러 개, 한 메뉴도 여러 날 나오므로 연결 테이블로 풂
-- PK (식단, 메뉴) → 한 끼에 같은 메뉴가 두 번 들어가지 않음. 식단이 지워지면 함께 삭제
CREATE TABLE IF NOT EXISTS meal_menu (
  meal_id    INT     NOT NULL,
  menu_id    INT     NOT NULL,
  sort_order TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (meal_id, menu_id),
  CONSTRAINT fk_mm_meal FOREIGN KEY (meal_id) REFERENCES meal(meal_id) ON DELETE CASCADE,
  CONSTRAINT fk_mm_menu FOREIGN KEY (menu_id) REFERENCES menu(menu_id) ON DELETE RESTRICT
);

-- 식단_메뉴_알레르기 : 그날 나온 메뉴에 붙은 알레르기 번호
-- (같은 이름의 메뉴라도 날마다 레시피가 달라 알레르기가 다를 수 있으므로 "그날 나온 메뉴" 기준)
-- (meal_id, menu_id)를 묶어서 meal_menu를 가리키는 복합 외래키
CREATE TABLE IF NOT EXISTS meal_menu_allergy (
  meal_id    INT NOT NULL,
  menu_id    INT NOT NULL,
  allergy_id INT NOT NULL,
  PRIMARY KEY (meal_id, menu_id, allergy_id),
  CONSTRAINT fk_mma_meal_menu FOREIGN KEY (meal_id, menu_id) REFERENCES meal_menu(meal_id, menu_id) ON DELETE CASCADE,
  CONSTRAINT fk_mma_allergy   FOREIGN KEY (allergy_id) REFERENCES allergy(allergy_id) ON DELETE RESTRICT
);

-- =========================================================
-- 평가 (review) : 그날 나온 메뉴에 대한 별점과 한 줄 평
-- =========================================================
-- (회원, 식단, 메뉴) UNIQUE → 같은 날 같은 메뉴는 한 번만 평가 (다시 쓰면 수정), 별점은 CHECK 1~5
-- (meal_id, menu_id) 복합 외래키 → 실제로 나온 메뉴에만 평가 가능
-- updated_at은 수정할 때마다 자동으로 지금 시각 (ON UPDATE CURRENT_TIMESTAMP)
CREATE TABLE IF NOT EXISTS review (
  review_id  INT AUTO_INCREMENT PRIMARY KEY,
  member_id  INT          NOT NULL,
  meal_id    INT          NOT NULL,
  menu_id    INT          NOT NULL,
  rating     TINYINT      NOT NULL,
  comment    VARCHAR(100) NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_review_once UNIQUE (member_id, meal_id, menu_id),
  CONSTRAINT ck_review_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_review_member    FOREIGN KEY (member_id) REFERENCES member(member_id) ON DELETE CASCADE,
  CONSTRAINT fk_review_meal_menu FOREIGN KEY (meal_id, menu_id) REFERENCES meal_menu(meal_id, menu_id) ON DELETE RESTRICT
);

-- =========================================================
-- 공지사항 (notice)
-- =========================================================
-- 다른 테이블과 연결되지 않은 독립 테이블
CREATE TABLE IF NOT EXISTS notice (
  notice_id  INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(100) NOT NULL,
  body       TEXT         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
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
-- (학교, 시작일, 종료일)마다 마지막으로 받아온 시각(synced_at)을 기록 → 최근에 받았으면 나이스를 다시 부르지 않음
CREATE TABLE IF NOT EXISTS meal_sync (
  school_id INT      NOT NULL,
  from_date DATE     NOT NULL,
  to_date   DATE     NOT NULL,
  synced_at DATETIME NOT NULL,
  PRIMARY KEY (school_id, from_date, to_date),
  CONSTRAINT fk_sync_school FOREIGN KEY (school_id) REFERENCES school(school_id) ON DELETE CASCADE
);
