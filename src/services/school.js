// ===================================================================
// 학교 정보: 나이스에서 확인한 뒤 school 테이블에 저장
// 회원가입(routes/auth.js)과 학교 변경(routes/school.js)에서 사용
// ===================================================================
const pool = require('../db');
const neis = require('../neis');

const CODE_RULE = /^[A-Z0-9]{2,10}$/; // 학교코드 형식: 영문 대문자·숫자 2~10자

/**
 * 나이스에 실제로 있는 학교인지 확인하고 school 테이블에 넣은 뒤 school_id를 돌려줌
 * (화면에서 보낸 학교 이름을 그대로 믿지 않고, 코드로 나이스에 다시 물어봄)
 */
async function ensureSchool(officeCode, schoolCode, conn = pool) {
  // 1) 코드 형식부터 검사 (이상한 값이면 나이스에 묻지도 않음)
  if (!CODE_RULE.test(String(officeCode || '')) || !CODE_RULE.test(String(schoolCode || ''))) {
    const err = new Error('학교를 다시 선택해 주세요.');
    err.status = 400;
    err.expose = true;   // 화면에 보여줘도 되는 오류
    throw err;
  }
  // 2) 나이스에 그 코드의 학교가 있는지 확인
  const school = await neis.getSchool(officeCode, schoolCode);
  if (!school) {
    const err = new Error('나이스에서 학교를 찾지 못했어요. 다시 검색해 주세요.');
    err.status = 400;
    err.expose = true;
    throw err;
  }
  // 3) school 테이블에 저장 (이미 있으면 이름·주소 등만 최신으로 갱신)
  //    ON DUPLICATE KEY UPDATE: UNIQUE(교육청코드, 학교코드)가 겹치면 INSERT 대신 UPDATE
  //    LAST_INSERT_ID(school_id): 갱신된 경우에도 그 학교 번호를 insertId로 돌려받기 위한 방법
  const [result] = await conn.query(
    `INSERT INTO school (office_code, school_code, school_name, school_kind, region, address)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       school_name = VALUES(school_name), school_kind = VALUES(school_kind),
       region = VALUES(region), address = VALUES(address),
       school_id = LAST_INSERT_ID(school_id)`,
    [school.officeCode, school.schoolCode, school.name, school.kind, school.region, school.address]
  );
  return result.insertId; // 학교 번호 (school_id)
}

module.exports = { ensureSchool };
