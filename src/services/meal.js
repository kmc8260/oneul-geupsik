// ===================================================================
// 급식 식단: 나이스에서 받아와 DB에 저장(동기화)하고, DB에서 읽어 화면용으로 만듦
// routes/meal.js 의 GET /api/meals 에서 사용
// ===================================================================
const pool = require('../db');
const neis = require('../neis');

const RESYNC_HOURS = 3; // 오늘 이후가 포함된 기간은 3시간마다 다시 받아옴

const toYmd = (date) => date.replace(/-/g, ''); // "2026-11-02" → "20261102" (나이스가 쓰는 날짜 형식)
// 오늘 날짜를 "YYYY-MM-DD" 문자열로 (padStart: 한 자리 수 앞에 0 붙이기)
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** 다시 받아와야 하는지 판단 */
async function needsSync(schoolId, from, to) {
  const [rows] = await pool.query(
    'SELECT synced_at FROM meal_sync WHERE school_id = ? AND from_date = ? AND to_date = ?',
    [schoolId, from, to]
  );
  if (!rows.length) return true;                 // 한 번도 받아온 적 없으면 받아와야 함
  const syncedAt = rows[0].synced_at;            // 마지막으로 받아온 시각
  // 기간이 다 지났고, 그 뒤에 받아온 적이 있으면 더는 바뀌지 않음
  const syncedDay = `${syncedAt.getFullYear()}-${String(syncedAt.getMonth() + 1).padStart(2, '0')}-${String(syncedAt.getDate()).padStart(2, '0')}`;
  if (to < todayStr() && syncedDay > to) return false;
  return Date.now() - syncedAt.getTime() > RESYNC_HOURS * 3600 * 1000; // 마지막으로 받은 지 3시간 넘었으면 다시
}

/** 나이스 → DB 저장 (한 기간을 하나의 트랜잭션으로) */
async function syncMeals(school, from, to) {
  const meals = await neis.getMeals(school.office_code, school.school_code, toYmd(from), toYmd(to)); // 나이스에서 기간 급식 받기

  const conn = await pool.getConnection();       // 트랜잭션용 연결 하나 빌림
  try {
    await conn.beginTransaction();               // 중간에 실패하면 전부 되돌리기 위해 트랜잭션 시작
    const [allergyRows] = await conn.query('SELECT allergy_id, mark_no FROM allergy');
    const allergyByMark = new Map(allergyRows.map((a) => [a.mark_no, a.allergy_id])); // 급식표 번호 → allergy_id 빠르게 찾는 표

    for (const meal of meals) {                  // 받아온 끼니 하나씩
      // 1) 식단 (있으면 영양 정보만 갱신)
      const [mealResult] = await conn.query(
        `INSERT INTO meal (school_id, meal_date, meal_type, calories, carbs, protein, fat)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE calories = VALUES(calories), carbs = VALUES(carbs),
           protein = VALUES(protein), fat = VALUES(fat), meal_id = LAST_INSERT_ID(meal_id)`,
        [school.school_id, meal.date, meal.type, meal.calories, meal.carbs, meal.protein, meal.fat]
      );
      const mealId = mealResult.insertId;        // 새로 만들었거나 이미 있던 식단 번호

      const keepMenuIds = [];                    // 이번 급식표에 있는 메뉴 번호들 (빠진 메뉴를 찾기 위해)
      for (const [i, dish] of meal.dishes.entries()) {  // i = 급식표 순서, dish = { name, marks }
        // 2) 메뉴 (이름이 같으면 같은 메뉴)
        const [menuResult] = await conn.query(
          `INSERT INTO menu (menu_name) VALUES (?)
           ON DUPLICATE KEY UPDATE menu_id = LAST_INSERT_ID(menu_id)`,
          [dish.name.slice(0, 100)]              // 컬럼 길이(100자)를 넘지 않게 자름
        );
        const menuId = menuResult.insertId;
        if (keepMenuIds.includes(menuId)) continue; // 한 끼에 같은 메뉴가 두 번 적힌 경우
        keepMenuIds.push(menuId);

        // 3) 식단_메뉴
        await conn.query(
          `INSERT INTO meal_menu (meal_id, menu_id, sort_order) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)`,
          [mealId, menuId, i]
        );

        // 4) 그날 메뉴의 알레르기 (새로 받은 값으로 교체)
        await conn.query('DELETE FROM meal_menu_allergy WHERE meal_id = ? AND menu_id = ?', [mealId, menuId]);
        const allergyIds = dish.marks.map((n) => allergyByMark.get(n)).filter(Boolean); // 급식표 번호 → allergy_id
        if (allergyIds.length) {
          await conn.query(
            'INSERT INTO meal_menu_allergy (meal_id, menu_id, allergy_id) VALUES ?',   // 여러 줄 한 번에 넣기
            [allergyIds.map((aid) => [mealId, menuId, aid])]
          );
        }
      }

      // 5) 급식표에서 빠진 메뉴는 지움 (단, 평가가 달린 메뉴는 기록 보존을 위해 남김)
      if (keepMenuIds.length) {
        await conn.query(
          `DELETE mm FROM meal_menu mm
            WHERE mm.meal_id = ? AND mm.menu_id NOT IN (?)
              AND NOT EXISTS (SELECT 1 FROM review r WHERE r.meal_id = mm.meal_id AND r.menu_id = mm.menu_id)`,
          [mealId, keepMenuIds]
        );
      }
    }

    // 6) 이 기간을 언제 받아왔는지 기록 (있으면 시각만 갱신)
    await conn.query(
      `INSERT INTO meal_sync (school_id, from_date, to_date, synced_at) VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE synced_at = NOW()`,
      [school.school_id, from, to]
    );
    await conn.commit();                         // 전부 성공 → 확정
  } catch (err) {
    await conn.rollback();                       // 하나라도 실패 → 전부 되돌림
    throw err;
  } finally {
    conn.release();                              // 연결 반납
  }
}

/**
 * 기간 식단 조회. 필요하면 먼저 나이스에서 받아옴.
 * 나이스가 안 될 때는 DB에 있는 것만 보여주고 warning을 붙임.
 * 돌려주는 값: { meals: [끼니들], popular: [인기 메뉴 3개], warning: 안내 문구 또는 null }
 */
async function getMealsForRange(member, school, from, to) {
  let warning = null;
  if (await needsSync(school.school_id, from, to)) {
    try {
      await syncMeals(school, from, to);
    } catch (err) {
      if (!err.expose) throw err;                // 나이스 오류가 아닌 진짜 오류는 위로 던짐
      warning = err.message;                     // 나이스 오류면 저장된 데이터만 보여주고 안내 문구를 붙임
    }
  }

  // 기간 안의 끼니와 메뉴 (끼니마다 메뉴가 여러 줄로 나옴)
  // FIELD(...): 조식 → 중식 → 석식 순서로 정렬
  const [rows] = await pool.query(
    `SELECT m.meal_id, DATE_FORMAT(m.meal_date, '%Y-%m-%d') AS meal_date, m.meal_type,
            m.calories, m.carbs, m.protein, m.fat,
            mn.menu_id, mn.menu_name
       FROM meal m
       JOIN meal_menu mm ON mm.meal_id = m.meal_id
       JOIN menu mn      ON mn.menu_id = mm.menu_id
      WHERE m.school_id = ? AND m.meal_date BETWEEN ? AND ?
      ORDER BY m.meal_date, FIELD(m.meal_type, '조식', '중식', '석식'), mm.sort_order`,
    [school.school_id, from, to]
  );

  // 메뉴별 알레르기 + 내 알레르기인지
  // LEFT JOIN member_allergy: 내가 등록한 알레르기면 ma.member_id가 채워져서 mine = 1
  const [allergyRows] = await pool.query(
    `SELECT mma.meal_id, mma.menu_id, a.allergy_id, a.mark_no, a.allergy_name,
            (ma.member_id IS NOT NULL) AS mine
       FROM meal_menu_allergy mma
       JOIN meal m    ON m.meal_id = mma.meal_id
       JOIN allergy a ON a.allergy_id = mma.allergy_id
       LEFT JOIN member_allergy ma ON ma.allergy_id = a.allergy_id AND ma.member_id = ?
      WHERE m.school_id = ? AND m.meal_date BETWEEN ? AND ?
      ORDER BY a.mark_no`,
    [member.memberId, school.school_id, from, to]
  );

  // 메뉴별 평균 별점 (이 학교에서 이 메뉴에 남긴 모든 평가 기준)
  const menuIds = [...new Set(rows.map((r) => r.menu_id))];   // 이번 기간에 나온 메뉴 번호들 (중복 제거)
  const ratingByMenu = new Map();                             // 메뉴 번호 → { avg, count }
  if (menuIds.length) {
    const [ratingRows] = await pool.query(
      `SELECT r.menu_id, ROUND(AVG(r.rating), 1) AS avg_rating, COUNT(*) AS review_count
         FROM review r
         JOIN meal m ON m.meal_id = r.meal_id
        WHERE m.school_id = ? AND r.menu_id IN (?)
        GROUP BY r.menu_id`,
      [school.school_id, menuIds]
    );
    for (const r of ratingRows) ratingByMenu.set(r.menu_id, { avg: Number(r.avg_rating), count: r.review_count });
  }

  // 알레르기를 "끼니번호:메뉴번호" 별로 모아 두기
  const allergyKey = (mealId, menuId) => `${mealId}:${menuId}`;
  const allergiesBy = new Map();
  for (const a of allergyRows) {
    const key = allergyKey(a.meal_id, a.menu_id);
    if (!allergiesBy.has(key)) allergiesBy.set(key, []);
    allergiesBy.get(key).push({ allergyId: a.allergy_id, markNo: a.mark_no, name: a.allergy_name, mine: Boolean(a.mine) });
  }

  // 줄 단위 결과를 "끼니 → 메뉴 목록" 모양으로 묶기
  const mealsById = new Map();
  for (const r of rows) {
    if (!mealsById.has(r.meal_id)) {             // 처음 보는 끼니면 새로 만듦
      mealsById.set(r.meal_id, {
        mealId: r.meal_id,
        date: r.meal_date,
        type: r.meal_type,
        calories: r.calories === null ? null : Number(r.calories), // DECIMAL은 문자열로 오므로 숫자로 변환
        carbs: r.carbs === null ? null : Number(r.carbs),
        protein: r.protein === null ? null : Number(r.protein),
        fat: r.fat === null ? null : Number(r.fat),
        menus: [],
      });
    }
    const rating = ratingByMenu.get(r.menu_id) || { avg: null, count: 0 }; // 평가가 없으면 평균 없음, 0개
    mealsById.get(r.meal_id).menus.push({
      menuId: r.menu_id,
      name: r.menu_name,
      allergies: allergiesBy.get(allergyKey(r.meal_id, r.menu_id)) || [],
      avgRating: rating.avg,
      reviewCount: rating.count,
    });
  }

  const meals = [...mealsById.values()];         // Map → 배열

  // 이번 기간 인기 메뉴 TOP 3 (평가가 있는 메뉴만)
  const seen = new Set();                        // 같은 메뉴가 여러 날 나와도 한 번만 넣기 위해
  const popular = [];
  for (const meal of meals) {
    for (const menu of meal.menus) {
      if (!menu.reviewCount || seen.has(menu.menuId)) continue;
      seen.add(menu.menuId);
      popular.push({ mealId: meal.mealId, menuId: menu.menuId, name: menu.name, date: meal.date, type: meal.type, avgRating: menu.avgRating, reviewCount: menu.reviewCount });
    }
  }
  popular.sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount); // 평균 별점 높은 순, 같으면 평가 많은 순

  return { meals, popular: popular.slice(0, 3), warning }; // 상위 3개만
}

module.exports = { getMealsForRange, todayStr };
