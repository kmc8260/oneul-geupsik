// ===================================================================
// 공지사항 API
// server.js에서 /api/notices 주소에 연결됨
// ===================================================================
const express = require('express');
const pool = require('../db');
const { wrap } = require('../middleware');

const router = express.Router();

// ---------- GET /api/notices ----------
// 공지 목록을 최신순으로 (DATE_FORMAT: 날짜를 "2026-11-02" 모양 문자열로)
router.get('/', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT notice_id, title, body, DATE_FORMAT(created_at, '%Y-%m-%d') AS created_at
       FROM notice ORDER BY created_at DESC, notice_id DESC`
  );
  res.json({ notices: rows.map((n) => ({ noticeId: n.notice_id, title: n.title, body: n.body, date: n.created_at })) }); // 화면에서 쓰기 편한 이름으로 바꿈
}));

module.exports = router;
