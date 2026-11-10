# 오늘의 급식

학교를 고르면 나이스(NEIS)에 공개된 급식 식단을 날짜별로 보여주고, 내 알레르기가 들어간 메뉴를 표시하고, 메뉴마다 별점과 한 줄 평을 남길 수 있는 반응형 웹 서비스입니다. 휴대폰에서는 모바일 화면(하단 탭)으로, 노트북(가로 1024px 이상)에서는 왼쪽 사이드바 화면으로 보입니다.

- 서버: Node.js + Express
- DB: MySQL 8.0 (mysql2로 SQL 직접 작성, 모든 쿼리는 `?` 자리표시자로 SQL 인젝션 방지)
- 급식·학교 데이터: 나이스 교육정보 개방 포털 API (`schoolInfo`, `mealServiceDietInfo`)
- 비밀번호: bcrypt 해시로 저장, 로그인 유지: 세션 쿠키 (7일)

## 실행 방법

### 1. 준비물
- [Node.js](https://nodejs.org) 18 이상 (LTS 추천)
- MySQL 8.0 + MySQL Workbench
- 나이스 API 인증키 (https://open.neis.go.kr 에서 발급)

### 2. DB 만들기
MySQL Workbench에서 서버에 접속한 뒤 `db/schema.sql`을 열어 번개 버튼으로 전체 실행합니다.

- 여러 번 실행해도 안전합니다. 1007, 1050 같은 노란 경고는 "이미 있어서 건너뜀"이라는 뜻이니 무시하세요.
- **이전 버전(로그인·알레르기만 있던 버전)을 쓰고 있었다면** 회원 테이블 구조가 바뀌었으므로 `db/reset.sql`을 먼저 실행한 뒤 `db/schema.sql`을 실행하세요. reset.sql은 DB를 통째로 지우므로 테스트로 가입한 계정도 사라집니다.

### 3. 설정 파일 (.env)
`.env.example`을 복사해 `.env`를 만들고 아래 두 줄을 채웁니다.

```
DB_PASSWORD=내 MySQL 비밀번호
NEIS_API_KEY=나이스에서 받은 인증키
```

> ⚠ `.env`에는 비밀번호와 API 키가 들어가므로 **깃허브에 올리거나 친구에게 파일째 보내지 마세요.** `.gitignore`에 `.env`가 들어 있어서 git을 쓰면 자동으로 빠집니다. 키는 코드 어디에도 직접 적지 않고 `.env`에서만 읽습니다.

### 4. 설치하고 실행
```bash
npm install
npm start
```
`오늘의 급식 서버 실행 중: http://localhost:3000`이 나오면 브라우저에서 http://localhost:3000 을 엽니다.

`.env`를 고친 뒤에는 터미널에서 `Ctrl + C`로 서버를 끄고 `npm start`로 다시 켜야 반영됩니다.

## 배포하기 (인터넷 주소로 공개)

배포 사이트에서는 Workbench로 SQL을 돌리기 어려워요. 그래서 환경변수에 `DB_AUTO_INIT=true`를 넣으면
**서버가 켜질 때 `db/schema.sql`을 자동으로 실행해서 테이블을 만들어요.** 여러 번 켜져도 안전해요.

### 0. GitHub에 올리기
- `.env`와 `node_modules`는 `.gitignore`에 있어서 올라가지 않아요. **나이스 키는 절대 GitHub에 올리지 마세요.**
- 저장소는 Private(비공개)로 만들어도 배포할 수 있어요.

### A. 클라우드타입 (국내 서버)
1. https://cloudtype.io 가입 → GitHub 연결 → 새 프로젝트 만들기
2. 프로젝트에 **MariaDB** 추가 → root 비밀번호와 DB 이름(`oneul_geupsik`) 설정 → 배포
3. 프로젝트에 **Node.js** 서비스 추가 → GitHub 저장소 선택
   - Node 버전 22, 포트 `3000`, 시작 명령 `npm start`
4. Node.js 서비스의 **환경변수**에 아래 값 입력 → 배포

| 이름 | 값 |
| --- | --- |
| `DB_HOST` | MariaDB 서비스의 연결 정보에 나오는 **내부 호스트** |
| `DB_PORT` | `3306` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | 2번에서 정한 비밀번호 |
| `DB_NAME` | `oneul_geupsik` |
| `SESSION_SECRET` | 아무 긴 문자열 (영문·숫자 섞어 30자 이상) |
| `NEIS_API_KEY` | 나이스 인증키 |
| `DB_AUTO_INIT` | `true` |

- 무료 플랜: 카드 등록 필요, 하루 1번 자동 정지(대시보드에서 다시 시작), 디스크가 임시라 DB 데이터가 지워질 수 있음
  → 발표·시연용으로는 충분하지만 데이터를 오래 보관하려면 유료(하비) 플랜 필요

### B. Render + TiDB Cloud (카드 없이 무료, 해외 서버)
1. https://tidbcloud.com 가입 → Starter(무료) 클러스터 만들기 → Connect 화면에서 host·port(4000)·user·password 확인
2. https://render.com 가입 → New → Web Service → GitHub 저장소 선택
   - Build Command `npm install`, Start Command `npm start`, Instance Type `Free`
3. 환경변수: 위 표와 같고 아래만 다르게
   - `DB_HOST` / `DB_PORT`(4000) / `DB_USER` / `DB_PASSWORD` = TiDB Connect 화면의 값
   - `DB_SSL` = `true` (TiDB는 암호화 연결만 받음)
- 무료 플랜은 15분 동안 접속이 없으면 잠들어서, 다음 첫 접속이 30초~1분 정도 느려요.

### 배포 후 확인
- 배포 로그에 `DB 준비 완료`와 `오늘의 급식 서버 실행 중`이 나오면 성공
- 로그인 상태는 서버 메모리에 저장돼서 **서버가 다시 켜지면 다시 로그인**해야 해요 (회원·평가 데이터는 DB에 그대로)
- 코드를 고친 뒤 GitHub에 push하면 배포 사이트가 새 코드로 다시 배포해요

## 화면

| 주소 | 화면 | 하는 일 |
| --- | --- | --- |
| `/login` | 로그인 | |
| `/signup` | 회원가입 | 학교 검색(나이스)·아이디 중복 확인 |
| `/welcome` | 가입 완료 | "지금 바로 알레르기를 선택하러 갈까요?" |
| `/allergy` | 알레르기 선택 | 급식표 번호 1~19 중 선택·저장 |
| `/` | 오늘의 급식 | 주간 날짜, 조식·중식·석식, 메뉴 카드(내 알레르기 빨간 표시), 끼니 영양 합계, 이번 주 인기 메뉴. 데스크톱은 오른쪽에 메뉴 상세 |
| `/menu` | 메뉴 상세 | 영양 정보, 알레르기, 평균 별점, 한 줄 평 (모바일) |
| `/review` | 평가 작성·수정 | 별점 1~5, 100자 의견 (데스크톱은 팝업) |
| `/reviews` | 내가 쓴 평가 | 수정·삭제 |
| `/mypage` | 마이페이지 | 프로필, 내 학교 변경, 활동 요약, 내 알레르기, 알림 설정, 계정 메뉴 |
| `/profile` | 회원정보 수정 | 이름·비밀번호 변경, 회원 탈퇴 |
| `/notices` | 공지사항 | |

## 나이스 데이터 처리 방식

- 처음 보는 주의 식단은 나이스에서 받아와 DB(`meal`, `menu`, `meal_menu`, `meal_menu_allergy`)에 저장하고, 그다음부터는 DB에서 읽습니다. 오늘 이후가 포함된 주는 3시간마다 다시 받아오고, 이미 지난 주는 다시 부르지 않습니다(`meal_sync`). 덕분에 나이스 하루 호출 한도를 거의 쓰지 않습니다.
- 급식표의 `소고기미역국 (5.6.16.)` 같은 메뉴 이름에서 알레르기 번호를 떼어 내 알레르기 테이블과 연결합니다.
- 나이스가 영양 정보를 **메뉴별이 아니라 한 끼 전체 기준**으로 주기 때문에, 열량·탄수화물·단백질·지방은 `meal`(식단) 테이블에 저장합니다.
- 나이스 연결이 안 되거나 키가 틀리면, 이미 저장된 식단은 그대로 보여주고 화면 위에 노란 안내를 띄웁니다.

## DB 테이블

| 테이블 | 설명 | 주요 제약조건 |
| --- | --- | --- |
| `school` | 나이스에서 고른 학교 | (교육청코드, 학교코드) UNIQUE |
| `member` | 회원 | 로그인ID UNIQUE, 역할 CHECK, school_id FK (학교 삭제 시 SET NULL) |
| `allergy` | 알레르기 19종 | 이름·번호 UNIQUE, 번호 1~19 CHECK |
| `member_allergy` | 회원 N:M 알레르기 | 복합 PK, 회원 탈퇴 시 CASCADE |
| `menu` | 메뉴 이름 (중복 없이 1번만) | 메뉴명 UNIQUE |
| `meal` | 학교의 날짜별 한 끼 + 영양 정보 | (학교, 날짜, 식사구분) UNIQUE, 식사구분 CHECK |
| `meal_menu` | 식단 N:M 메뉴 | 복합 PK |
| `meal_menu_allergy` | 그날 나온 메뉴의 알레르기 | 복합 PK, (식단, 메뉴) 복합 FK |
| `review` | 그날 나온 메뉴 평가 | (회원, 식단, 메뉴) UNIQUE = 같은 날 같은 메뉴 1번, 별점 1~5 CHECK |
| `notice` | 공지사항 | |
| `meal_sync` | 나이스에서 받아온 기록 | |

## API

| 메서드 | 주소 | 하는 일 |
| --- | --- | --- |
| GET | `/api/auth/check-id?loginId=` | 아이디 중복 확인 |
| POST | `/api/auth/signup` | 회원가입 (학교 코드 포함, 나이스로 재확인) |
| POST | `/api/auth/login` · `/api/auth/logout` | 로그인 · 로그아웃 |
| GET | `/api/schools?q=` | 나이스 학교 검색 |
| PUT | `/api/me/school` | 내 학교 변경 |
| GET | `/api/me` | 내 정보·학교·활동 요약·알레르기·알림 설정 |
| PATCH | `/api/me/settings` · `/api/me/profile` | 알림 설정 · 이름 변경 |
| PUT | `/api/me/password` | 비밀번호 변경 |
| DELETE | `/api/me` | 회원 탈퇴 |
| GET / PUT | `/api/allergies` · `/api/allergies/mine` | 알레르기 목록 · 내 알레르기 저장 |
| GET | `/api/meals?from=&to=` | 기간 식단 (최대 2주) |
| GET | `/api/meals/:mealId/menus/:menuId` | 메뉴 상세 |
| POST | `/api/reviews` | 평가 등록·수정 |
| GET | `/api/reviews/mine` | 내 평가 목록 |
| DELETE | `/api/reviews/:id` | 내 평가 삭제 |
| GET | `/api/notices` | 공지사항 |

## 폴더 구조 (파일별 역할)

> 모든 파일 안에 한국어 주석이 달려 있어요. 파일 맨 위 머리 주석에 "무슨 파일인지·어디와 연결되는지"가 있고,
> 줄 옆 주석에 "이 줄이 무엇을 하는지"가 있어요. (주석만 추가했고 코드 동작은 그대로예요.)

```
.env.example             설정 파일 견본 (복사해서 .env로 만들고 비밀번호·나이스 키 입력)
package.json             프로젝트 정보와 사용하는 라이브러리 목록 ("//" 칸에 설명)

db/schema.sql            전체 테이블 11개 생성 SQL (여러 번 실행해도 안전)
db/reset.sql             DB 통째로 지우기 (처음부터 다시 만들 때만)

src/server.js            서버 시작 · 세션(로그인 상태) · 화면 주소 · API 연결 · 오류 처리
src/db.js                MySQL 연결 풀 (모든 SQL이 이걸 통해 실행됨, DB_SSL 설정)
src/init-db.js           배포용: DB_AUTO_INIT=true면 서버 시작 때 schema.sql 자동 실행
src/middleware.js        로그인 확인(requireLogin) · 비동기 오류 처리(wrap)
src/neis.js              나이스 API 호출 (학교 검색 · 급식 식단) 과 응답 해석
src/services/meal.js     식단 동기화(나이스 → DB 저장) · 한 주 식단 조회 · 인기 메뉴
src/services/school.js   학교 확인 후 school 테이블에 저장

src/routes/auth.js       회원가입 · 로그인 · 로그아웃 · 아이디 중복 확인     /api/auth/...
src/routes/school.js     학교 검색 · 내 학교 변경                             /api/schools, /api/me/school
src/routes/meal.js       한 주 식단 · 메뉴 상세                               /api/meals/...
src/routes/allergy.js    알레르기 목록 · 내 알레르기 저장                     /api/allergies/...
src/routes/review.js     평가 남기기·수정 · 내 평가 목록 · 삭제               /api/reviews/...
src/routes/me.js         마이페이지 정보 · 알림 설정 · 이름/비밀번호 변경 · 탈퇴  /api/me/...
src/routes/notice.js     공지사항 목록                                        /api/notices

public/pages/*.html      화면 11개 (login, signup, welcome, allergy, home, menu, review, reviews, mypage, profile, notices)
public/js/api.js         공통 도구: 서버 요청 · 글자 안전 처리(esc) · 날짜 · 별점 · 알림 · 확인 창
public/js/layout.js      공통 틀: 데스크톱 사이드바 / 모바일 하단 탭
public/js/school-picker.js  학교 검색 창
public/js/menu-detail.js 메뉴 상세 그리기 (모바일 화면 + 데스크톱 오른쪽 패널 공용)
public/js/review-form.js 별점·한 줄 평 폼 (모바일 화면 + 데스크톱 팝업 공용)
public/js/그 밖의 .js    화면 이름과 같은 파일이 그 화면의 동작 (main.js = home.html)
public/css/style.css     반응형 디자인 (기본 모바일, 1024px 이상 데스크톱)
```

## 자주 나는 문제

| 증상 | 해결 |
| --- | --- |
| "DB 구조가 최신이 아니에요" | 2단계의 reset.sql → schema.sql 순서로 실행 |
| "나이스 API 인증키가 올바르지 않아요" | `.env`의 `NEIS_API_KEY` 확인 후 서버 재시작 |
| 학교 검색 결과가 5개까지만 나옴 | `.env`에 `NEIS_API_KEY`가 비어 있음 |
| "DB에 연결할 수 없어요" | MySQL 실행 여부와 `.env`의 `DB_PASSWORD` 확인 |
| 급식이 안 나옴 | 방학·휴일이거나 학교가 아직 나이스에 올리지 않은 날 |
