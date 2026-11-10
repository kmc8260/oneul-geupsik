// ===================================================================
// 급식 식단 조회 · 메뉴 상세 API
// server.js에서 /api 주소에 연결됨 → GET /api/meals, GET /api/meals/:mealId/menus/:menuId
// ===================================================================
const express = require('express');
const pool = require('../db');
const { getMealsForRange, todayStr } = require('../services/meal'); // 나이스 동기화 + 식단 조회
const { requireLoginApi, wrap } = require('../middleware');

const router = express.Router();
router.use(requireLoginApi); // 모든 식단 API는 로그인한 회원만

const DATE_RULE = /^\d{4}-\d{2}-\d{2}$/; // 날짜 형식 YYYY-MM-DD

// 로그인한 회원의 학교 정보 가져오기 (학교를 아직 안 골랐으면 null)
async function loadMySchool(memberId) {
  const [rows] = await pool.query(
    `SELECT s.* FROM member m JOIN school s ON s.school_id = m.school_id WHERE m.member_id = ?`,
    [memberId]
  );
  return rows[0] || null;
}

// 이름 가운데를 가림: 홍길동 → 홍*동, 김민 → 김*
// (한 줄 평에 작성자 이름을 그대로 보여주지 않기 위한 개인정보 보호)
function maskName(name) {
  if (!name) return '';
  if (name.length <= 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

// ---------- GET /api/meals?from=2026-11-02&to=2026-11-06 ----------
// 메인 화면이 한 주(월~금) 식단을 받아갈 때 쓰는 주소
router.get('/meals', wrap(async (req, res) => {
  const { from, to } = req.query;                                   // 주소의 ?from=...&to=...
  if (!DATE_RULE.test(from || '') || !DATE_RULE.test(to || '') || from > to) {
    return res.status(400).json({ message: '날짜가 올바르지 않아요.' });
  }
  const days = (new Date(to) - new Date(from)) / 86400000;          // 기간 일수 (86400000ms = 하루)
  if (days > 13) return res.status(400).json({ message: '한 번에 2주까지만 조회할 수 있어요.' }); // 너무 긴 기간은 막음

  const school = await loadMySchool(req.session.member.memberId);
  if (!school) return res.status(409).json({ code: 'NO_SCHOOL', message: '학교를 먼저 선택해 주세요.' }); // 화면은 code를 보고 "학교 선택" 안내를 띄움

  const data = await getMealsForRange(req.session.member, school, from, to);
  res.json({ school: { name: school.school_name }, today: todayStr(), ...data }); // ...data = meals, popular, warning 을 그대로 펼쳐 넣음
}));

// ---------- GET /api/meals/:mealId/menus/:menuId ---------- 메뉴 상세
// :mealId, :menuId 자리에 숫자가 들어옴 → 예: /api/meals/12/menus/4
router.get('/meals/:mealId/menus/:menuId', wrap(async (req, res) => {
  const mealId = Number(req.params.mealId);
  const menuId = Number(req.params.menuId);
  const memberId = req.session.member.memberId;

  // 그날 나온 메뉴 + 식단 정보 (내 학교 급식만 볼 수 있음)
  // JOIN member: 로그인한 회원의 학교와 식단의 학교가 같을 때만 결과가 나옴
  const [rows] = await pool.query(
    `SELECT m.meal_id, DATE_FORMAT(m.meal_date, '%Y-%m-%d') AS meal_date, m.meal_type,
            m.calories, m.carbs, m.protein, m.fat, m.school_id,
            mn.menu_id, mn.menu_name
       FROM meal_menu mm
       JOIN meal m  ON m.meal_id = mm.meal_id
       JOIN menu mn ON mn.menu_id = mm.menu_id
       JOIN member me ON me.member_id = ? AND me.school_id = m.school_id
      WHERE mm.meal_id = ? AND mm.menu_id = ?`,
    [memberId, mealId, menuId]
  );
  const row = rows[0];
  if (!row) return res.status(404).json({ message: '메뉴를 찾을 수 없어요.' });

  // 이 메뉴의 알레르기 + 내 알레르기인지(mine)
  const [allergies] = await pool.query(
    `SELECT a.allergy_id, a.mark_no, a.allergy_name, (ma.member_id IS NOT NULL) AS mine
       FROM meal_menu_allergy mma
       JOIN allergy a ON a.allergy_id = mma.allergy_id
       LEFT JOIN member_allergy ma ON ma.allergy_id = a.allergy_id AND ma.member_id = ?
      WHERE mma.meal_id = ? AND mma.menu_id = ?
      ORDER BY a.mark_no`,
    [memberId, mealId, menuId]
  );

  // 이 학교에서 이 메뉴에 남긴 평가 (다른 날 나왔을 때 평가도 포함)
  // 평균 별점과 평가 수
  const [stats] = await pool.query(
    `SELECT ROUND(AVG(r.rating), 1) AS avg_rating, COUNT(*) AS review_count
       FROM review r JOIN meal m ON m.meal_id = r.meal_id
      WHERE r.menu_id = ? AND m.school_id = ?`,
    [menuId, row.school_id]
  );
  // 한 줄 평 목록 (최근 날짜 순, 최대 30개). (r.member_id = ?) AS mine → 내가 쓴 평가인지 1/0
  const [reviews] = await pool.query(
    `SELECT r.review_id, r.rating, r.comment, DATE_FORMAT(m.meal_date, '%Y-%m-%d') AS meal_date,
            mb.name, (r.member_id = ?) AS mine
       FROM review r
       JOIN meal m    ON m.meal_id = r.meal_id
       JOIN member mb ON mb.member_id = r.member_id
      WHERE r.menu_id = ? AND m.school_id = ?
      ORDER BY m.meal_date DESC, r.created_at DESC
      LIMIT 30`,
    [memberId, menuId, row.school_id]
  );
  // 이 날 이 메뉴에 내가 이미 쓴 평가가 있는지 (있으면 "내 평가 수정하기" 버튼)
  const [myReviewRows] = await pool.query(
    'SELECT review_id, rating, comment FROM review WHERE member_id = ? AND meal_id = ? AND menu_id = ?',
    [memberId, mealId, menuId]
  );

  // 화면(menu-detail.js)이 쓰는 모양으로 묶어서 보냄
  res.json({
    mealId: row.meal_id,
    menuId: row.menu_id,
    name: row.menu_name,
    date: row.meal_date,
    type: row.meal_type,
    nutrition: {                                   // 한 끼 전체 영양 정보
      calories: row.calories === null ? null : Number(row.calories),
      carbs: row.carbs === null ? null : Number(row.carbs),
      protein: row.protein === null ? null : Number(row.protein),
      fat: row.fat === null ? null : Number(row.fat),
    },
    allergies: allergies.map((a) => ({ allergyId: a.allergy_id, markNo: a.mark_no, name: a.allergy_name, mine: Boolean(a.mine) })),
    avgRating: stats[0].avg_rating === null ? null : Number(stats[0].avg_rating),
    reviewCount: stats[0].review_count,
    reviews: reviews.map((r) => ({
      reviewId: r.review_id,
      rating: r.rating,
      comment: r.comment,
      date: r.meal_date,
      writer: maskName(r.name),                    // 이름 가리기
      mine: Boolean(r.mine),
    })),
    myReview: myReviewRows[0] ? { reviewId: myReviewRows[0].review_id, rating: myReviewRows[0].rating, comment: myReviewRows[0].comment } : null,
    canReview: row.meal_date <= todayStr(),        // 오늘 이전(포함) 급식만 평가 가능
  });
}));

module.exports = router;
