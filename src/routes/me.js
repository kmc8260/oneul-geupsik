// ===================================================================
// 마이페이지: 내 정보 · 활동 요약 · 알림 설정 · 회원정보 수정 · 비밀번호 변경 · 탈퇴
// server.js에서 /api/me 주소에 연결됨
// ===================================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireLoginApi, wrap } = require('../middleware');

const router = express.Router();
router.use(requireLoginApi); // 모두 로그인 필요

// ---------- GET /api/me ----------
// 마이페이지·사이드바·메인에서 쓰는 "내 정보 묶음"
router.get('/', wrap(async (req, res) => {
  const memberId = req.session.member.memberId;
  // 회원 정보 + 학교 (학교가 없어도 회원은 나오도록 LEFT JOIN)
  const [rows] = await pool.query(
    `SELECT m.member_id, m.login_id, m.name, m.role, m.notify_allergy, m.notify_tomorrow,
            DATE_FORMAT(m.joined_at, '%Y-%m-%d') AS joined_at,
            s.office_code, s.school_code, s.school_name, s.school_kind, s.region
       FROM member m
       LEFT JOIN school s ON s.school_id = m.school_id
      WHERE m.member_id = ?`,
    [memberId]
  );
  const me = rows[0];
  if (!me) {
    // 탈퇴 등으로 회원이 없어진 세션
    return req.session.destroy(() => res.status(401).json({ message: '로그인이 필요해요.' }));
  }

  // 활동 요약: 평가 수, 평균 별점, 이번 달 평가 수
  // SUM(조건): 조건이 참인 줄은 1, 거짓은 0으로 더해져서 "조건에 맞는 개수"가 됨
  const [statRows] = await pool.query(
    `SELECT COUNT(*) AS review_count,
            ROUND(AVG(rating), 1) AS avg_rating,
            SUM(created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS this_month
       FROM review WHERE member_id = ?`,
    [memberId]
  );
  // 내 알레르기 목록
  const [allergyRows] = await pool.query(
    `SELECT a.mark_no, a.allergy_name
       FROM member_allergy ma JOIN allergy a ON a.allergy_id = ma.allergy_id
      WHERE ma.member_id = ? ORDER BY a.mark_no`,
    [memberId]
  );

  res.json({
    member: { memberId: me.member_id, loginId: me.login_id, name: me.name, role: me.role, joinedAt: me.joined_at },
    school: me.school_name                                   // 학교가 있으면 객체, 없으면 null
      ? { officeCode: me.office_code, schoolCode: me.school_code, name: me.school_name, kind: me.school_kind, region: me.region }
      : null,
    stats: {
      reviewCount: statRows[0].review_count,
      avgRating: statRows[0].avg_rating === null ? null : Number(statRows[0].avg_rating),
      thisMonth: Number(statRows[0].this_month || 0),       // 평가가 하나도 없으면 SUM이 NULL이라 0으로
    },
    allergies: allergyRows.map((a) => ({ markNo: a.mark_no, name: a.allergy_name })),
    settings: { notifyAllergy: Boolean(me.notify_allergy), notifyTomorrow: Boolean(me.notify_tomorrow) },
  });
}));

// ---------- PATCH /api/me/settings ---------- body: { notifyAllergy?, notifyTomorrow? }
// 알림 설정 토글. 보낸 항목만 바꿈 (PATCH = 일부만 수정)
router.patch('/settings', wrap(async (req, res) => {
  const columns = { notifyAllergy: 'notify_allergy', notifyTomorrow: 'notify_tomorrow' }; // 화면 이름 → DB 컬럼 이름 (허용된 것만)
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(columns)) {
    if (typeof req.body[key] === 'boolean') {     // true/false로 온 값만 반영
      sets.push(`${column} = ?`);
      values.push(req.body[key]);
    }
  }
  if (!sets.length) return res.status(400).json({ message: '바꿀 설정이 없어요.' });
  await pool.query(`UPDATE member SET ${sets.join(', ')} WHERE member_id = ?`, [...values, req.session.member.memberId]); // 컬럼 이름은 위 목록에서만 오므로 안전
  res.json({ ok: true });
}));

// ---------- PATCH /api/me/profile ---------- body: { name }
// 이름 변경
router.patch('/profile', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 20) return res.status(400).json({ message: '이름을 1~20자로 입력해 주세요.' });
  await pool.query('UPDATE member SET name = ? WHERE member_id = ?', [name, req.session.member.memberId]);
  req.session.member.name = name;                  // 세션에 있는 이름도 바꿈
  res.json({ ok: true });
}));

// 비밀번호가 맞는지 확인하는 도우미 (비밀번호 변경·탈퇴에서 사용)
async function checkPassword(memberId, password) {
  const [rows] = await pool.query('SELECT password_hash FROM member WHERE member_id = ?', [memberId]);
  return rows[0] ? bcrypt.compare(String(password || ''), rows[0].password_hash) : false;
}

// ---------- PUT /api/me/password ---------- body: { currentPassword, newPassword, newPasswordConfirm }
// 비밀번호 변경: 현재 비밀번호 확인 → 새 비밀번호 규칙 검사 → 해시로 저장
router.put('/password', wrap(async (req, res) => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;
  const memberId = req.session.member.memberId;
  if (!(await checkPassword(memberId, currentPassword))) {
    return res.status(400).json({ message: '현재 비밀번호가 맞지 않아요.', errors: { currentPassword: '현재 비밀번호가 맞지 않아요.' } });
  }
  const pw = String(newPassword || '');
  if (pw.length < 8 || pw.length > 64 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return res.status(400).json({ message: '새 비밀번호를 확인해 주세요.', errors: { newPassword: '8자 이상, 영문과 숫자를 모두 넣어 주세요.' } });
  }
  if (pw !== newPasswordConfirm) {
    return res.status(400).json({ message: '새 비밀번호를 확인해 주세요.', errors: { newPasswordConfirm: '비밀번호가 서로 달라요.' } });
  }
  const hash = await bcrypt.hash(pw, 10);
  await pool.query('UPDATE member SET password_hash = ? WHERE member_id = ?', [hash, memberId]);
  res.json({ ok: true });
}));

// ---------- DELETE /api/me ---------- body: { password } 회원 탈퇴
// member를 지우면 ON DELETE CASCADE로 내 알레르기·평가도 함께 지워짐
router.delete('/', wrap(async (req, res) => {
  const memberId = req.session.member.memberId;
  if (!(await checkPassword(memberId, req.body.password))) {
    return res.status(400).json({ message: '비밀번호가 맞지 않아요.' });
  }
  await pool.query('DELETE FROM member WHERE member_id = ?', [memberId]);
  req.session.destroy(() => {                      // 로그인 상태도 끝냄
    res.clearCookie('sid');
    res.json({ ok: true });
  });
}));

module.exports = router;
