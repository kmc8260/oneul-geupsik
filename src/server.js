// ===================================================================
// 서버 시작 파일 (npm start 하면 가장 먼저 실행되는 파일)
// 하는 일: 설정 읽기 → 로그인 세션 준비 → API 주소 연결 → 화면 주소 연결 → 오류 처리 → 서버 켜기
// ===================================================================
require('dotenv').config();                       // .env 파일을 읽어서 process.env 에 넣음 (DB 비밀번호, 나이스 키 등)
const path = require('path');                     // 파일 경로를 운영체제에 맞게 합쳐 주는 Node 기본 모듈
const express = require('express');               // 웹 서버 라이브러리
const session = require('express-session');       // 로그인 상태를 기억하는 세션 라이브러리
const { requireLoginPage, guestOnlyPage } = require('./middleware'); // 로그인 검사 함수

const app = express();                                                // 웹 서버(앱) 만들기
const PUBLIC = path.join(__dirname, '..', 'public');                  // public 폴더 위치 (HTML·CSS·JS 화면 파일)
const page = (name) => (req, res) => res.sendFile(path.join(PUBLIC, 'pages', name)); // public/pages 안의 HTML 파일을 그대로 보내주는 도우미

app.set('trust proxy', 1);                       // 배포 사이트는 앞단(프록시)에서 HTTPS를 처리함 → 그 정보를 믿어야 아래 secure 쿠키가 동작
app.use(express.json());                          // 요청 본문의 JSON을 읽어서 req.body 로 만들어 줌
app.use(
  session({
    name: 'sid',                                  // 브라우저에 저장될 쿠키 이름
    secret: process.env.SESSION_SECRET || 'dev-only-secret', // 쿠키 위조를 막는 비밀 문자열 (.env)
    resave: false,                                // 바뀐 게 없으면 세션을 다시 저장하지 않음
    saveUninitialized: false,                     // 로그인 전(빈 세션)에는 쿠키를 만들지 않음
    cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7일 (httpOnly: 자바스크립트로 쿠키를 못 읽게 함, secure 'auto': https로 접속하면 https에서만 쿠키 전송)
  })
);
app.use('/static', express.static(PUBLIC, { index: false })); // /static/css/style.css 처럼 요청하면 public 폴더의 파일을 보내줌

// ---------- API ----------
// 화면의 자바스크립트가 fetch로 부르는 주소들. 응답은 모두 JSON.
// API 응답은 브라우저가 저장해 두지 않게 함 (뒤로가기 했을 때 옛날 평가가 보이는 문제 방지)
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/auth', require('./routes/auth'));          // 회원가입·로그인·로그아웃·아이디 중복 확인
app.use('/api', require('./routes/school'));          // /api/schools, /api/me/school
app.use('/api/me', require('./routes/me'));              // 내 정보·알림 설정·비밀번호 변경·탈퇴
app.use('/api/allergies', require('./routes/allergy'));  // 알레르기 목록·내 알레르기 저장
app.use('/api', require('./routes/meal'));            // /api/meals …
app.use('/api/reviews', require('./routes/review'));     // 평가 등록·목록·삭제
app.use('/api/notices', require('./routes/notice'));     // 공지사항
app.use('/api', (req, res) => res.status(404).json({ message: '없는 주소예요.' })); // 위에서 아무것도 안 걸리면 404

// ---------- 화면 ----------
// 주소마다 어떤 HTML을 보여줄지. 가운데 함수는 먼저 실행되는 로그인 검사.
app.get('/login', guestOnlyPage, page('login.html'));          // 로그인 (이미 로그인했으면 메인으로)
app.get('/signup', guestOnlyPage, page('signup.html'));        // 회원가입
app.get('/welcome', requireLoginPage, page('welcome.html'));   // 가입 완료 + 알레르기 선택 안내
app.get('/', requireLoginPage, page('home.html'));             // 메인: 오늘의 급식
app.get('/menu', requireLoginPage, page('menu.html'));         // 메뉴 상세 (휴대폰)
app.get('/review', requireLoginPage, page('review.html'));     // 평가 작성·수정
app.get('/reviews', requireLoginPage, page('reviews.html'));   // 내가 쓴 평가
app.get('/allergy', requireLoginPage, page('allergy.html'));   // 알레르기 선택
app.get('/mypage', requireLoginPage, page('mypage.html'));     // 마이페이지
app.get('/profile', requireLoginPage, page('profile.html'));   // 회원정보 수정
app.get('/notices', requireLoginPage, page('notices.html'));   // 공지사항

// ---------- 오류 처리 ----------
// 어디서든 오류가 나면 마지막에 여기로 옴 (매개변수가 4개인 함수 = Express 오류 처리기)
app.use((err, req, res, next) => {
  if (err.expose) return res.status(err.status || 400).json({ message: err.message }); // 화면에 보여줘도 되는 오류(나이스 오류 등)는 그 메시지 그대로
  console.error(err);                                                                  // 그 밖의 오류는 터미널에 자세히 출력
  if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') {          // 테이블이나 컬럼이 없음 = schema.sql이 옛날 것
    return res.status(500).json({ message: 'DB 구조가 최신이 아니에요. README의 "DB 다시 만들기"를 따라 해 주세요.' });
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_BAD_DB_ERROR') { // MySQL 꺼짐 / 비밀번호 틀림 / DB 없음
    return res.status(500).json({ message: 'DB에 연결할 수 없어요. .env 설정과 MySQL 실행 여부를 확인해 주세요.' });
  }
  res.status(500).json({ message: '잠시 후 다시 시도해 주세요.' });                     // 그 밖의 알 수 없는 오류
});

const PORT = Number(process.env.PORT || 3000);     // 서버 포트 (.env의 PORT, 없으면 3000. 배포 사이트는 PORT를 알아서 넣어 줌)
require('./init-db')()                             // DB_AUTO_INIT=true면 schema.sql로 테이블 자동 생성 (배포용)
  .catch((err) => console.error('DB 자동 생성 실패:', err.message)) // 실패해도 서버는 켜서 화면에 DB 오류 안내가 나오게 함
  .then(() => {
    app.listen(PORT, () => {                       // 서버 켜기: 이제부터 요청을 받기 시작
      console.log(`오늘의 급식 서버 실행 중: http://localhost:${PORT}`);
      if (!process.env.NEIS_API_KEY) {             // 나이스 키가 없으면 경고 출력
        console.log('※ .env에 NEIS_API_KEY가 없어요. 나이스 키 없이 호출하면 결과가 5개까지만 나와요.');
      }
    });
  });
