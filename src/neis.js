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
    this.status = 502;
    this.expose = true;
  }
}

// 나이스 결과 코드 → 사람이 읽을 메시지
function resultMessage(result) {
  const code = result && result.CODE;
  if (code === 'ERROR-290') return '나이스 API 인증키가 올바르지 않아요. .env의 NEIS_API_KEY를 확인해 주세요.';
  if (code === 'ERROR-337') return '오늘 나이스 API 호출 한도를 넘었어요. 내일 다시 시도해 주세요.';
  if (code === 'ERROR-300' || code === 'ERROR-333') return '나이스에 보낸 요청 값이 올바르지 않아요.';
  return `나이스 서버 오류예요. (${code || '알 수 없음'})`;
}

/**
 * 나이스 서비스 호출. 데이터가 없으면 빈 배열을 돌려줍니다.
 * @param {string} service  예: 'schoolInfo', 'mealServiceDietInfo'
 * @param {object} params   검색 조건
 */
async function call(service, params) {
  const url = new URL(`${BASE_URL}/${service}`);
  const query = { Type: 'json', pIndex: 1, pSize: 100, ...params };
  if (process.env.NEIS_API_KEY) query.KEY = process.env.NEIS_API_KEY;
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw new NeisError('나이스 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
  }
  if (!res.ok) throw new NeisError(`나이스 서버 응답 오류예요. (${res.status})`);

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new NeisError('나이스 서버 응답을 읽지 못했어요.');
  }

  // 데이터가 없거나 오류일 때: { "RESULT": { "CODE": "INFO-200", ... } }
  if (data.RESULT) {
    if (data.RESULT.CODE === 'INFO-200') return [];
    throw new NeisError(resultMessage(data.RESULT));
  }

  // 정상: { "<service>": [ { "head": [ {list_total_count}, {RESULT} ] }, { "row": [ ... ] } ] }
  const body = data[service];
  if (!Array.isArray(body)) throw new NeisError('나이스 서버 응답 형식이 달라요.');
  const head = (body[0] && body[0].head) || [];
  const result = (head.find((h) => h.RESULT) || {}).RESULT;
  if (result && result.CODE !== 'INFO-000') {
    if (result.CODE === 'INFO-200') return [];
    throw new NeisError(resultMessage(result));
  }
  return (body[1] && body[1].row) || [];
}

// ---------- 학교 ----------
// 나이스 학교 정보 한 줄을 우리 프로그램에서 쓰는 모양으로 바꿈
const toSchool = (r) => ({
  officeCode: r.ATPT_OFCDC_SC_CODE,
  schoolCode: r.SD_SCHUL_CODE,
  name: r.SCHUL_NM,
  kind: r.SCHUL_KND_SC_NM || null,
  region: r.LCTN_SC_NM || null,
  address: r.ORG_RDNMA || null,
});

// 학교 이름으로 검색 (회원가입·마이페이지의 학교 검색 창에서 사용)
async function searchSchools(keyword) {
  const rows = await call('schoolInfo', { SCHUL_NM: keyword, pSize: 30 });
  return rows.map(toSchool);
}

// 교육청코드 + 학교코드로 학교 하나를 정확히 조회 (화면에서 보낸 학교가 진짜인지 확인용)
async function getSchool(officeCode, schoolCode) {
  const rows = await call('schoolInfo', { ATPT_OFCDC_SC_CODE: officeCode, SD_SCHUL_CODE: schoolCode, pSize: 1 });
  return rows[0] ? toSchool(rows[0]) : null;
}

// ---------- 급식 ----------
const BR = /<br\s*\/?>/i;

/**
 * "소고기미역국 (5.6.16.)" → { name: '소고기미역국', marks: [5, 6, 16] }
 * 학교마다 "닭갈비5.6.13." 처럼 괄호 없이 쓰기도 해서 둘 다 처리
 */
function parseDish(text) {
  const raw = String(text).replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  // 정규식: (메뉴 이름)(괄호가 있을 수도 있는 "숫자." 반복) 으로 나눔
  const m = raw.match(/^(.*?)\s*\(?\s*((?:\d{1,2}\s*\.\s*)+\d{0,2})\s*\)?\s*$/);
  let name = raw;
  let marks = [];
  if (m && m[1].trim()) {
    name = m[1];
    marks = m[2].split('.').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 1 && n <= 19);
  }
  name = name.replace(/[*#@]+$/g, '').replace(/^[*#@]+/g, '').trim();
  return { name, marks: [...new Set(marks)] };
}

// 급식표 한 칸(DDISH_NM)을 메뉴 목록으로 쪼갬
function parseDishes(ddish) {
  return String(ddish || '')
    .split(BR)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseDish)
    .filter((d) => d.name);
}

// "탄수화물(g) : 120.5<br/>단백질(g) : 35.2<br/>지방(g) : 20.1<br/>…"
// 영양 정보 글자에서 탄수화물·단백질·지방 숫자만 뽑음
function parseNutrition(ntr) {
  const pick = (label) => {
    const m = String(ntr || '').match(new RegExp(`${label}\\s*\\([^)]*\\)\\s*:\\s*([\\d.]+)`));
    return m ? Number(m[1]) : null;
  };
  return { carbs: pick('탄수화물'), protein: pick('단백질'), fat: pick('지방') };
}

// "20261102" → "2026-11-02" (DB DATE 형식으로)
const ymdToDate = (ymd) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

/** 기간 안의 급식을 받아 우리 형식으로 바꿔 돌려줌 */
async function getMeals(officeCode, schoolCode, fromYmd, toYmd) {
  const rows = await call('mealServiceDietInfo', {
    ATPT_OFCDC_SC_CODE: officeCode,
    SD_SCHUL_CODE: schoolCode,
    MLSV_FROM_YMD: fromYmd,
    MLSV_TO_YMD: toYmd,
  });
  return rows
    .filter((r) => ['조식', '중식', '석식'].includes(r.MMEAL_SC_NM))
    .map((r) => ({
      date: ymdToDate(r.MLSV_YMD),
      type: r.MMEAL_SC_NM,
      calories: parseFloat(r.CAL_INFO) || null,
      ...parseNutrition(r.NTR_INFO),
      dishes: parseDishes(r.DDISH_NM),
    }));
}

module.exports = { searchSchools, getSchool, getMeals, parseDish, parseNutrition, NeisError };
