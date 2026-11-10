// ===================================================================
// 미들웨어: 요청이 실제 처리 함수에 닿기 전에 먼저 거치는 검사 함수들
// (req: 들어온 요청, res: 보낼 응답, next(): 다음 단계로 넘기기)
// ===================================================================

// API용: 로그인 안 했으면 401(인증 필요) 오류를 JSON으로 돌려줌
function requireLoginApi(req, res, next) {
  if (!req.session.member) return res.status(401).json({ message: '로그인이 필요해요.' }); // 세션에 회원 정보가 없으면 = 로그인 안 함
  next(); // 로그인했으면 통과
}

// 화면용: 로그인 안 했으면 로그인 화면으로 보냄
function requireLoginPage(req, res, next) {
  if (!req.session.member) return res.redirect('/login'); // redirect: 브라우저를 다른 주소로 이동시킴
  next();
}

// 화면용: 이미 로그인했으면 로그인·회원가입 화면 대신 메인으로 보냄
function guestOnlyPage(req, res, next) {
  if (req.session.member) return res.redirect('/');
  next();
}

// async 함수에서 난 오류를 Express 오류 처리기(server.js 맨 아래)로 넘겨주는 도우미
// 이걸로 감싸지 않으면 await 중에 난 오류가 처리되지 않고 서버가 멈출 수 있음
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { requireLoginApi, requireLoginPage, guestOnlyPage, wrap }; // 다른 파일에서 쓸 수 있게 내보냄
