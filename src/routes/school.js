// ===================================================================
// 학교 검색 · 내 학교 설정 API
// server.js에서 /api 주소에 연결됨 → GET /api/schools, PUT /api/me/school
// ===================================================================
const express = require('express');
const pool = require('../db');
const neis = require('../neis');                           // 나이스 학교 검색
const { ensureSchool } = require('../services/school');   // 학교 확인 후 저장
const { requireLoginApi, wrap } = require('../middleware');

const router = express.Router();

// ---------- GET /api/schools?q=미림 ---------- (회원가입 전에도 써야 해서 로그인 없이 허용)
// 학교 검색 창에서 입력한 이름으로 나이스를 검색해 목록을 돌려줌
router.get('/schools', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();       // 검색어
  if (q.length < 2 || q.length > 30) {              // 너무 짧거나 긴 검색어는 막음
    return res.status(400).json({ message: '학교 이름을 2글자 이상 입력해 주세요.' });
  }
  const schools = await neis.searchSchools(q);
  res.json({ schools });
}));

// ---------- PUT /api/me/school ---------- body: { officeCode, schoolCode }
// 마이페이지에서 학교를 바꿀 때 (로그인 필요)
router.put('/me/school', requireLoginApi, wrap(async (req, res) => {
  const schoolId = await ensureSchool(req.body.officeCode, req.body.schoolCode);   // 나이스로 확인하고 school 테이블에 저장
  await pool.query('UPDATE member SET school_id = ? WHERE member_id = ?', [schoolId, req.session.member.memberId]); // 내 학교 바꾸기
  const [rows] = await pool.query('SELECT school_name FROM school WHERE school_id = ?', [schoolId]);
  res.json({ ok: true, schoolName: rows[0].school_name });
}));

module.exports = router;
