// ===================================================================
// 평가 남기기 · 내 평가 목록 · 삭제 API
// server.js에서 /api/reviews 주소에 연결됨
// ===================================================================
const express = require('express');
const pool = require('../db');
const { todayStr } = require('../services/meal');   // 오늘 날짜 문자열 (미래 급식 평가 막기용)
const { requireLoginApi, wrap } = require('../middleware');

const router = express.Router();
router.use(requireLoginApi); // 평가 API는 모두 로그인 필요

// ---------- POST /api/reviews ---------- body: { mealId, menuId, rating, comment }
// 이미 남긴 평가가 있으면 고침 (같은 날 같은 메뉴는 한 번만: UNIQUE 제약조건)
router.post('/', wrap(async (req, res) => {
  const mealId = Number(req.body.mealId);
  const menuId = Number(req.body.menuId);
  const rating = Number(req.body.rating);
  const comment = String(req.body.comment || '').trim();
  const memberId = req.session.member.memberId;

  // 입력값 검사
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: '별점을 1~5점 중에서 골라 주세요.' });
  }
  if (comment.length > 100) return res.status(400).json({ message: '한 줄 의견은 100자 이내로 써 주세요.' });

  // 내 학교에서 실제로 나온 메뉴인지, 이미 제공된 급식인지 확인
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(m.meal_date, '%Y-%m-%d') AS meal_date
       FROM meal_menu mm
       JOIN meal m ON m.meal_id = mm.meal_id
       JOIN member me ON me.member_id = ? AND me.school_id = m.school_id
      WHERE mm.meal_id = ? AND mm.menu_id = ?`,
    [memberId, mealId, menuId]
  );
  if (!rows[0]) return res.status(404).json({ message: '평가할 메뉴를 찾을 수 없어요.' });  // 없는 메뉴이거나 다른 학교 급식
  if (rows[0].meal_date > todayStr()) {                                                     // 날짜 문자열은 크기 비교가 곧 날짜 비교
    return res.status(400).json({ message: '아직 제공되지 않은 급식은 평가할 수 없어요.' });
  }

  // 평가 저장. UNIQUE(member_id, meal_id, menu_id)가 겹치면 INSERT 대신 별점·의견만 UPDATE
  const [result] = await pool.query(
    `INSERT INTO review (member_id, meal_id, menu_id, rating, comment)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
    [memberId, mealId, menuId, rating, comment || null]   // 의견이 비어 있으면 NULL로 저장
  );
  // affectedRows: 1 = 새로 등록, 2 = 기존 평가 수정
  res.status(result.affectedRows === 1 ? 201 : 200).json({ ok: true, updated: result.affectedRows !== 1 });
}));

// ---------- GET /api/reviews/mine ----------
// "내가 쓴 평가" 화면: 내 평가를 메뉴 이름·날짜와 함께 최신순으로
router.get('/mine', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.review_id, r.meal_id, r.menu_id, r.rating, r.comment,
            DATE_FORMAT(m.meal_date, '%Y-%m-%d') AS meal_date, m.meal_type, mn.menu_name, s.school_name
       FROM review r
       JOIN meal m   ON m.meal_id = r.meal_id
       JOIN menu mn  ON mn.menu_id = r.menu_id
       JOIN school s ON s.school_id = m.school_id
      WHERE r.member_id = ?
      ORDER BY m.meal_date DESC, r.updated_at DESC`,
    [req.session.member.memberId]
  );
  res.json({
    reviews: rows.map((r) => ({
      reviewId: r.review_id,
      mealId: r.meal_id,
      menuId: r.menu_id,
      rating: r.rating,
      comment: r.comment,
      date: r.meal_date,
      type: r.meal_type,
      menuName: r.menu_name,
      schoolName: r.school_name,
    })),
  });
}));

// ---------- DELETE /api/reviews/:id ---------- (내 평가만)
// WHERE에 member_id도 넣어서 다른 사람 평가는 지울 수 없게 함
router.delete('/:id', wrap(async (req, res) => {
  const [result] = await pool.query('DELETE FROM review WHERE review_id = ? AND member_id = ?', [
    Number(req.params.id),
    req.session.member.memberId,
  ]);
  if (!result.affectedRows) return res.status(404).json({ message: '평가를 찾을 수 없어요.' }); // 지워진 줄이 0개 = 없거나 내 것이 아님
  res.json({ ok: true });
}));

module.exports = router;
