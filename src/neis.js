// ===================================================================
// 나이스 교육정보 개방 포털(open.neis.go.kr) API 호출과 응답 해석
// 인증키는 .env의 NEIS_API_KEY에서만 읽습니다. (코드에 직접 적지 마세요)
// 쓰는 서비스: schoolInfo(학교 기본정보), mealServiceDietInfo(급식 식단정보)
// ===================================================================

// 나이스 API 기본 주소 (테스트용으로 .env의 NEIS_BASE_URL로 바꿀 수 있음, 끝의 / 는 제거)
const BASE_URL = (process.env.NEIS_BASE_URL || 'https://open.neis.go.kr/hub').replace(/\/$/, '');

// 나이스 관련 오류를 표시하는 전용 오류 클래스
class NeisError extends Error {
  constructor(message) {
    super(message);
    this.status = 502;  // 502 = 외부 서버(나이스) 문제
    this.expose = true; // 화면에 이 메시지를 그대로 보여줘도 됨
  }
}

// 나이스 결과 코드 → 사람이 읽을 메시지
function resultMessage(result) {
  const code = result && result.CODE;
  if (code === 'ERROR-290') return '나이스 API 인증키가 올바르지 않아요. .env의 NEIS_API_KEY를 확인해 주세요.'; // 키 틀림
  if (code === 'ERROR-337') return '오늘 나이스 API 호출 한도를 넘었어요. 내일 다시 시도해 주세요.';           // 하루 호출 한도 초과
  if (code === 'ERROR-300' || code === 'ERROR-333') return '나이스에 보낸 요청 값이 올바르지 않아요.';           // 필수값 누락·형식 오류
  return `나이스 서버 오류예요. (${code || '알 수 없음'})`;
}

/**
 * 나이스 서비스 호출. 데이터가 없으면 빈 배열을 돌려줍니다.
 * @param {string} service  예: 'schoolInfo', 'mealServiceDietInfo'
 * @param {object} params   검색 조건
 */
async function call(service, params) {
  const url = new URL(`${BASE_URL}/${service}`);                         // 예: https://open.neis.go.kr/hub/schoolInfo
  const query = { Type: 'json', pIndex: 1, pSize: 100, ...params };     // JSON으로, 1페이지, 최대 100개 + 검색 조건
  if (process.env.NEIS_API_KEY) query.KEY = process.env.NEIS_API_KEY;   // 인증키가 있으면 붙임
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v)); // 주소 뒤에 ?Type=json&... 형태로 붙임

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });      // 나이스에 요청 (8초 안에 응답 없으면 포기)
  } catch (err) {
    throw new NeisError('나이스 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
  }
  if (!res.ok) throw new NeisError(`나이스 서버 응답 오류예요. (${res.status})`); // HTTP 오류 (404, 500 등)

  let data;
  try {
    data = await res.json();                                           // 응답을 JSON으로 읽기
  } catch (err) {
    throw new NeisError('나이스 서버 응답을 읽지 못했어요.');
  }

  // 데이터가 없거나 오류일 때: { "RESULT": { "CODE": "INFO-200", ... } }
  if (data.RESULT) {
    if (data.RESULT.CODE === 'INFO-200') return [];                     // INFO-200 = 해당하는 데이터 없음 → 빈 배열
    throw new NeisError(resultMessage(data.RESULT));
  }

  // 정상: { "<service>": [ { "head": [ {list_total_count}, {RESULT} ] }, { "row": [ ... ] } ] }
  const body = data[service];
  if (!Array.isArray(body)) throw new NeisError('나이스 서버 응답 형식이 달라요.');
  const head = (body[0] && body[0].head) || [];                          // 첫 번째 칸: 머리말(전체 개수, 결과 코드)
  const result = (head.find((h) => h.RESULT) || {}).RESULT;
  if (result && result.CODE !== 'INFO-000') {                            // INFO-000 = 정상 처리
    if (result.CODE === 'INFO-200') return [];
    throw new NeisError(resultMessage(result));
  }
  return (body[1] && body[1].row) || [];                                 // 두 번째 칸: 실제 데이터 목록(row)
}

// ---------- 학교 ----------
// 나이스 학교 정보 한 줄을 우리 프로그램에서 쓰는 모양으로 바꿈
const toSchool = (r) => ({
  officeCode: r.ATPT_OFCDC_SC_CODE,   // 시도교육청코드
  schoolCode: r.SD_SCHUL_CODE,        // 행정표준코드 (학교코드)
  name: r.SCHUL_NM,                   // 학교명
  kind: r.SCHUL_KND_SC_NM || null,    // 학교종류명 (고등학교 등)
  region: r.LCTN_SC_NM || null,       // 시도명 (서울특별시 등)
  address: r.ORG_RDNMA || null,       // 도로명주소
});

// 학교 이름으로 검색 (회원가입·마이페이지의 학교 검색 창에서 사용)
async function searchSchools(keyword) {
  const rows = await call('schoolInfo', { SCHUL_NM: keyword, pSize: 30 }); // 이름에 keyword가 들어간 학교 최대 30개
  return rows.map(toSchool);
}

// 교육청코드 + 학교코드로 학교 하나를 정확히 조회 (화면에서 보낸 학교가 진짜인지 확인용)
async function getSchool(officeCode, schoolCode) {
  const rows = await call('schoolInfo', { ATPT_OFCDC_SC_CODE: officeCode, SD_SCHUL_CODE: schoolCode, pSize: 1 });
  return rows[0] ? toSchool(rows[0]) : null; // 없으면 null
}

// ---------- 급식 ----------
const BR = /<br\s*\/?>/i; // 나이스는 메뉴 사이를 <br/> 로 구분해서 줌

/**
 * "소고기미역국 (5.6.16.)" → { name: '소고기미역국', marks: [5, 6, 16] }
 * 학교마다 "닭갈비5.6.13." 처럼 괄호 없이 쓰기도 해서 둘 다 처리
 */
function parseDish(text) {
  const raw = String(text).replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); // &amp; → &, 연속 공백 정리
  // 정규식: (메뉴 이름)(괄호가 있을 수도 있는 "숫자." 반복) 으로 나눔
  const m = raw.match(/^(.*?)\s*\(?\s*((?:\d{1,2}\s*\.\s*)+\d{0,2})\s*\)?\s*$/);
  let name = raw;
  let marks = [];
  if (m && m[1].trim()) {                     // 끝에 알레르기 번호가 붙어 있으면
    name = m[1];                              // 앞부분 = 메뉴 이름
    marks = m[2].split('.').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 1 && n <= 19); // "5.6.16." → [5, 6, 16] (1~19만)
  }
  name = name.replace(/[*#@]+$/g, '').replace(/^[*#@]+/g, '').trim(); // 학교가 붙이는 *, #, @ 표시 제거
  return { name, marks: [...new Set(marks)] }; // 같은 번호 중복 제거
}

// 급식표 한 칸(DDISH_NM)을 메뉴 목록으로 쪼갬
function parseDishes(ddish) {
  return String(ddish || '')
    .split(BR)                 // <br/> 기준으로 나누기
    .map((s) => s.trim())      // 앞뒤 공백 제거
    .filter(Boolean)           // 빈 줄 제거
    .map(parseDish)            // 각 줄을 { name, marks } 로
    .filter((d) => d.name);    // 이름이 빈 것 제거
}

// "탄수화물(g) : 120.5<br/>단백질(g) : 35.2<br/>지방(g) : 20.1<br/>…"
// 영양 정보 글자에서 탄수화물·단백질·지방 숫자만 뽑음
function parseNutrition(ntr) {
  const pick = (label) => {
    const m = String(ntr || '').match(new RegExp(`${label}\\s*\\([^)]*\\)\\s*:\\s*([\\d.]+)`)); // "라벨(단위) : 숫자" 찾기
    return m ? Number(m[1]) : null;
  };
  return { carbs: pick('탄수화물'), protein: pick('단백질'), fat: pick('지방') };
}

// "20261102" → "2026-11-02" (DB DATE 형식으로)
const ymdToDate = (ymd) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

/** 기간 안의 급식을 받아 우리 형식으로 바꿔 돌려줌 */
async function getMeals(officeCode, schoolCode, fromYmd, toYmd) {
  const rows = await call('mealServiceDietInfo', {
    ATPT_OFCDC_SC_CODE: officeCode,  // 교육청코드
    SD_SCHUL_CODE: schoolCode,       // 학교코드
    MLSV_FROM_YMD: fromYmd,          // 시작일 (YYYYMMDD)
    MLSV_TO_YMD: toYmd,              // 종료일
  });
  return rows
    .filter((r) => ['조식', '중식', '석식'].includes(r.MMEAL_SC_NM)) // 끼니 이름이 이 셋인 것만 (간식 등 제외)
    .map((r) => ({
      date: ymdToDate(r.MLSV_YMD),                // 급식일자
      type: r.MMEAL_SC_NM,                        // 끼니
      calories: parseFloat(r.CAL_INFO) || null,   // "803.4 Kcal" → 803.4
      ...parseNutrition(r.NTR_INFO),              // carbs, protein, fat
      dishes: parseDishes(r.DDISH_NM),            // 메뉴 목록 [{ name, marks }]
    }));
}

module.exports = { searchSchools, getSchool, getMeals, parseDish, parseNutrition, NeisError };
