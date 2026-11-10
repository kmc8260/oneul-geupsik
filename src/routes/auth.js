// ===================================================================
// 회원가입 · 로그인 · 로그아웃 · 아이디 중복 확인 API
// server.js에서 /api/auth 주소에 연결됨 → 예: POST /api/auth/login
// ===================================================================
const express = require('express');
const bcrypt = require('bcryptjs');                          // 비밀번호 해시 라이브러리
const pool = require('../db');                               // MySQL 연결
const { ensureSchool } = require('../services/school');     // 고른 학교를 나이스로 확인하고 저장하는 함수

const router = express.Router(); // 이 파일의 주소들을 묶는 라우터

// ---------- 입력값 검사 (화면에서도 같은 규칙으로 검사하지만, 서버에서 한 번 더 확인) ----------
// 화면 검사는 사용자가 우회할 수 있으므로 서버에서도 반드시 검사해야 함
const LOGIN_ID_RULE = /^[A-Za-z0-9]{4,20}$/; // 정규식: 영문·숫자만 4~20자

// 아이디 형식 검사. 문제가 있으면 오류 문구, 없으면 null
function checkLoginId(loginId) {
  if (!loginId) return '아이디를 입력해 주세요.';
  if (!LOGIN_ID_RULE.test(loginId)) return '아이디는 영문과 숫자 4~20자로 입력해 주세요.';
  return null;
}

// 회원가입 입력값 전체 검사. { 칸이름: 오류문구 } 형태로 돌려줌 (비어 있으면 통과)
function checkSignup({ name, loginId, password, passwordConfirm, officeCode, schoolCode }) {
  const errors = {};
  if (!officeCode || !schoolCode) errors.school = '학교를 선택해 주세요.';           // 학교를 안 골랐음
  if (!name || name.length > 20) errors.name = '이름을 1~20자로 입력해 주세요.';     // 이름 길이
  const idError = checkLoginId(loginId);
  if (idError) errors.loginId = idError;                                             // 아이디 형식
  if (!password || password.length < 8 || password.length > 64) {
    errors.password = '비밀번호는 8자 이상 입력해 주세요.';                           // 비밀번호 길이
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = '비밀번호에 영문과 숫자를 모두 넣어 주세요.';                   // 영문과 숫자가 둘 다 있어야 함
  }
  if (password !== passwordConfirm) errors.passwordConfirm = '비밀번호가 서로 달라요.'; // 확인칸과 일치
  return errors;
}

// 세션에 넣을 회원 정보 (비밀번호 해시는 절대 넣지 않음)
// DB 컬럼 이름(snake_case)을 화면에서 쓰기 편한 이름(camelCase)으로 바꿈
const toSessionMember = (row) => ({
  memberId: row.member_id,
  loginId: row.login_id,
  name: row.name,
  role: row.role,
});

// 로그인 상태로 만들기. 세션 ID를 새로 발급해 세션 고정 공격을 막습니다.
// (세션 고정 공격: 공격자가 미리 알고 있는 세션 ID로 피해자가 로그인하게 만드는 수법)
function startSession(req, member) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {          // 새 세션 ID 발급
      if (err) return reject(err);
      req.session.member = member;             // 세션에 회원 정보 저장 = 로그인 상태
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve())); // 저장 끝날 때까지 기다림
    });
  });
}

// ---------- GET /api/auth/check-id?loginId=abc ----------
// 회원가입 화면의 "중복 확인" 버튼이 부르는 주소
router.get('/check-id', async (req, res, next) => {
  try {
    const loginId = String(req.query.loginId || '').trim();  // 주소의 ?loginId= 값 (앞뒤 공백 제거)
    const error = checkLoginId(loginId);
    if (error) return res.status(400).json({ available: false, message: error }); // 형식부터 틀리면 400

    const [rows] = await pool.query('SELECT 1 FROM member WHERE login_id = ?', [loginId]); // 같은 아이디가 있는지 조회 (? 자리에 값을 안전하게 넣어 SQL 인젝션 방지)
    if (rows.length > 0) {
      return res.json({ available: false, message: '이미 사용 중인 아이디예요.' });
    }
    res.json({ available: true, message: '사용할 수 있는 아이디예요.' });
  } catch (err) {
    next(err); // 오류는 server.js의 오류 처리기로
  }
});

// ---------- POST /api/auth/signup ----------
// 회원가입: 입력 검사 → 학교 확인 → 비밀번호 해시 → DB 저장 → 바로 로그인
router.post('/signup', async (req, res, next) => {
  try {
    // 화면에서 보낸 값 꺼내기 (없으면 빈 문자열)
    const input = {
      name: String(req.body.name || '').trim(),
      loginId: String(req.body.loginId || '').trim(),
      password: String(req.body.password || ''),
      passwordConfirm: String(req.body.passwordConfirm || ''),
      officeCode: String(req.body.officeCode || ''),   // 학교의 교육청코드
      schoolCode: String(req.body.schoolCode || ''),   // 학교코드
    };
    const errors = checkSignup(input);
    if (Object.keys(errors).length > 0) {              // 오류가 하나라도 있으면 400과 함께 칸별 오류 전달
      return res.status(400).json({ message: '입력한 내용을 확인해 주세요.', errors });
    }

    // 고른 학교가 나이스에 실제로 있는지 확인하고 school 테이블에 저장
    let schoolId;
    try {
      schoolId = await ensureSchool(input.officeCode, input.schoolCode);
    } catch (err) {
      if (!err.expose) throw err;                     // 예상 못 한 오류는 위로 던짐
      return res.status(err.status === 400 ? 400 : 502).json({ message: err.message, errors: { school: err.message } }); // 학교 오류는 학교 칸에 표시
    }

    const passwordHash = await bcrypt.hash(input.password, 10); // 비밀번호를 해시로 바꿈 (10 = 계산 강도)
    let result;
    try {
      [result] = await pool.query(
        'INSERT INTO member (login_id, password_hash, name, school_id) VALUES (?, ?, ?, ?)',
        [input.loginId, passwordHash, input.name, schoolId]
      );
    } catch (err) {
      // login_id UNIQUE 제약조건 위반 = 이미 있는 아이디
      // (중복 확인 후 가입 버튼을 누르기 전에 다른 사람이 같은 아이디로 가입한 경우)
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          message: '이미 사용 중인 아이디예요.',
          errors: { loginId: '이미 사용 중인 아이디예요.' },
        });
      }
      throw err;
    }

    // 방금 저장한 회원을 다시 읽어서 세션에 넣음 (result.insertId = 새로 만들어진 member_id)
    const [rows] = await pool.query(
      'SELECT member_id, login_id, name, role FROM member WHERE member_id = ?',
      [result.insertId]
    );
    const member = toSessionMember(rows[0]);
    await startSession(req, member); // 가입하면 바로 로그인 상태로
    res.status(201).json({ member }); // 201 = 새로 만들어짐
  } catch (err) {
    next(err);
  }
});

// ---------- POST /api/auth/login ----------
// 로그인: 아이디로 회원 찾기 → 비밀번호 해시 비교 → 세션 시작
router.post('/login', async (req, res, next) => {
  try {
    const loginId = String(req.body.loginId || '').trim();
    const password = String(req.body.password || '');
    if (!loginId || !password) {
      return res.status(400).json({ message: '아이디와 비밀번호를 입력해 주세요.' });
    }

    const [rows] = await pool.query(
      'SELECT member_id, login_id, password_hash, name, role FROM member WHERE login_id = ?',
      [loginId]
    );
    const row = rows[0]; // 찾은 회원 (없으면 undefined)
    const ok = row ? await bcrypt.compare(password, row.password_hash) : false; // 입력한 비밀번호와 저장된 해시가 맞는지 비교
    if (!ok) {
      // 아이디가 없는지, 비밀번호가 틀렸는지 구분해서 알려주지 않음 (보안)
      return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않아요.' });
    }

    const member = toSessionMember(row);
    await startSession(req, member);
    res.json({ member });
  } catch (err) {
    next(err);
  }
});

// ---------- POST /api/auth/logout ----------
// 로그아웃: 세션을 지우고 쿠키도 삭제
router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sid');   // 브라우저의 세션 쿠키 삭제
    res.json({ ok: true });
  });
});

// ---------- GET /api/auth/me ----------
// 지금 로그인한 회원 정보 (세션에 있는 값)
router.get('/me', (req, res) => {
  if (!req.session.member) return res.status(401).json({ message: '로그인이 필요해요.' });
  res.json({ member: req.session.member });
});

module.exports = router; // server.js에서 app.use('/api/auth', ...)로 연결
