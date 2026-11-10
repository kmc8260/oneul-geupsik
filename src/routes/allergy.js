// ===================================================================
// 알레르기 목록 조회 · 내 알레르기 저장 API
// server.js에서 /api/allergies 주소에 연결됨
// ===================================================================
const express = require('express');
const pool = require('../db');

const router = express.Router();

// API는 로그인한 회원만 사용
// router.use: 이 파일의 모든 주소에 먼저 적용되는 검사
router.use((req, res, next) => {
  if (!req.session.member) return res.status(401).json({ message: '로그인이 필요해요.' });
  next();
});

// ---------- GET /api/allergies ----------
// 19종 전체 목록 + 내가 등록했는지(selected) 함께 반환
// LEFT JOIN: 내가 등록하지 않은 알레르기도 빠짐없이 나오고, 등록한 것만 ma.member_id 값이 채워짐
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.allergy_id, a.mark_no, a.allergy_name,
              (ma.member_id IS NOT NULL) AS selected
         FROM allergy a
         LEFT JOIN member_allergy ma
                ON ma.allergy_id = a.allergy_id
               AND ma.member_id = ?
        ORDER BY a.mark_no`,
      [req.session.member.memberId]                // ? 자리에 로그인한 회원 번호
    );
    // DB 결과를 화면에서 쓰기 편한 모양으로 바꿔서 보냄
    res.json({
      allergies: rows.map((r) => ({
        allergyId: r.allergy_id,
        markNo: r.mark_no,                         // 급식표 번호
        name: r.allergy_name,
        selected: Boolean(r.selected),             // MySQL은 true/false를 1/0으로 주므로 Boolean으로 변환
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------- PUT /api/allergies/mine ----------
// body: { allergyIds: [2, 11] } → 내 알레르기를 이 목록으로 통째로 바꿈 (빈 배열 = 없음)
router.put('/mine', async (req, res, next) => {
  const ids = req.body.allergyIds;
  // 배열인지, 모두 양의 정수인지, 19개 이하인지 검사
  if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id) && id > 0) || ids.length > 19) {
    return res.status(400).json({ message: '알레르기 선택값이 올바르지 않아요.' });
  }
  const unique = [...new Set(ids)];                // 같은 번호가 두 번 오면 하나로 (Set = 중복 없는 모음)
  const memberId = req.session.member.memberId;

  const conn = await pool.getConnection();         // 트랜잭션은 같은 연결에서 해야 하므로 연결 하나를 빌림
  try {
    // 지우고 다시 넣는 두 작업을 하나로 묶어, 중간에 실패하면 원래대로 되돌림
    await conn.beginTransaction();                 // 트랜잭션 시작
    await conn.query('DELETE FROM member_allergy WHERE member_id = ?', [memberId]); // 1) 내 알레르기 전부 지우기
    if (unique.length > 0) {
      await conn.query(
        'INSERT INTO member_allergy (member_id, allergy_id) VALUES ?',             // 2) 새로 고른 것 한 번에 넣기
        [unique.map((id) => [memberId, id])]                                       //    [[1,2],[1,11]] → (1,2),(1,11)
      );
    }
    await conn.commit();                           // 둘 다 성공하면 확정
    res.json({ ok: true, count: unique.length });
  } catch (err) {
    await conn.rollback();                         // 하나라도 실패하면 처음 상태로 되돌림
    // 없는 알레르기ID → 외래키 제약조건 위반
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: '없는 알레르기가 포함되어 있어요.' });
    }
    next(err);
  } finally {
    conn.release();                                // 빌린 연결 반납 (성공·실패 상관없이 항상)
  }
});

module.exports = router;
