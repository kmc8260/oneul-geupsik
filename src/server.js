// ===================================================================
// 서버 시작 파일 (npm start 하면 가장 먼저 실행되는 파일)
// 하는 일: 설정 읽기 → 로그인 세션 준비 → API 주소 연결 → 화면 주소 연결 → 오류 처리 → 서버 켜기
// ===================================================================
require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const { requireLoginPage, guestOnlyPage } = require("./middleware");

const app = express();
const PUBLIC = path.join(__dirname, "..", "public");
const page = (name) => (req, res) =>
  res.sendFile(path.join(PUBLIC, "pages", name));

// 공통 준비: 요청 본문(JSON) 읽기 → 로그인 세션(쿠키 이름 sid, 7일 유지) → /static 주소로 CSS·JS 파일 제공
app.use(express.json());
// express-session: 로그인 세션 준비
app.use(
  session({
    //이름
    name: "sid",
    //비밀키
    secret: process.env.SESSION_SECRET || "dev-only-secret",
    //세션을 수정하지 않아도 항상 저장할지 여부
    resave: false,
    //세션이 저장되기 전에 초기화되지 않은 세션을 강제로 저장할지 여부
    saveUninitialized: false,
    //쿠키 설정
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);
app.use("/static", express.static(PUBLIC, { index: false }));

// API 주소 연결
// 화면의 자바스크립트가 fetch로 부르는 주소들. 응답은 모두 JSON.
// API 응답은 브라우저가 저장해 두지 않게 함 (뒤로가기 했을 때 옛날 평가가 보이는 문제 방지)
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
// API 주소 연결: /api/auth, /api/school, /api/me, /api/allergies, /api/meal, /api/reviews, /api/notices
app.use("/api/auth", require("./routes/auth"));
app.use("/api", require("./routes/school"));
app.use("/api/me", require("./routes/me"));
app.use("/api/allergies", require("./routes/allergy"));
app.use("/api", require("./routes/meal"));
app.use("/api/reviews", require("./routes/review"));
app.use("/api/notices", require("./routes/notice"));
app.use("/api", (req, res) =>
  res.status(404).json({ message: "없는 주소예요." }),
);

// 화면
// 주소마다 어떤 HTML을 보여줄지. 가운데 함수는 먼저 실행되는 로그인 검사.
app.get("/login", guestOnlyPage, page("login.html"));
app.get("/signup", guestOnlyPage, page("signup.html"));
app.get("/welcome", requireLoginPage, page("welcome.html"));
app.get("/", requireLoginPage, page("home.html"));
app.get("/menu", requireLoginPage, page("menu.html"));
app.get("/review", requireLoginPage, page("review.html"));
app.get("/reviews", requireLoginPage, page("reviews.html"));
app.get("/allergy", requireLoginPage, page("allergy.html"));
app.get("/mypage", requireLoginPage, page("mypage.html"));
app.get("/profile", requireLoginPage, page("profile.html"));
app.get("/notices", requireLoginPage, page("notices.html"));

// 오류 처리
// 어디서든 오류가 나면 마지막에 여기로 옴 (매개변수가 4개인 함수 = Express 오류 처리기)
app.use((err, req, res, next) => {
  // 화면에서 보낸 요청이 잘못된 경우: 400
  if (err.expose)
    return res.status(err.status || 400).json({ message: err.message });
  console.error(err);
  // DB 구조 오류: 테이블이 없거나, 컬럼이 없거나, 제약조건이 없거나
  if (err.code === "ER_NO_SUCH_TABLE" || err.code === "ER_BAD_FIELD_ERROR") {
    return res.status(500).json({
      message:
        'DB 구조가 최신이 아니에요. README의 "DB 다시 만들기"를 따라 해 주세요.',
    });
  }
  // MySQL 연결 오류: DB 서버가 안 켜져 있거나, .env 설정이 잘못됐거나, DB 이름이 틀렸거나
  if (
    err.code === "ECONNREFUSED" ||
    err.code === "ER_ACCESS_DENIED_ERROR" ||
    err.code === "ER_BAD_DB_ERROR"
  ) {
    return res.status(500).json({
      message:
        "DB에 연결할 수 없어요. .env 설정과 MySQL 실행 여부를 확인해 주세요.",
    });
  }
  res.status(500).json({ message: "잠시 후 다시 시도해 주세요." });
});

//서버 켜기
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`오늘의 급식 서버 실행 중: http://localhost:${PORT}`);
  if (!process.env.NEIS_API_KEY) {
    console.log(
      "※ .env에 NEIS_API_KEY가 없어요. 나이스 키 없이 호출하면 결과가 5개까지만 나와요.",
    );
  }
});
