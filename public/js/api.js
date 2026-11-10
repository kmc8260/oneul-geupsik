// ===================================================================
// api.js — 모든 화면이 함께 쓰는 "공통 도구 상자"
//  - HTML에서 가장 먼저 불러와서, 다른 JS 파일들이 여기 함수를 그냥 가져다 씀
//  - api()        : 서버(/api/...)에 요청 보내고 JSON 결과 받기
//  - esc()        : 화면에 넣을 글자를 안전하게 바꾸기 (XSS 공격 방지)
//  - 날짜·숫자·별점·아이콘 만들기, toast(잠깐 뜨는 알림), confirmDialog(확인 창)
// ===================================================================
// 공통 도우미: 서버 호출, 글자 이스케이프, 날짜, 별점, 토스트, 확인 창

// 뒤로가기로 돌아온 화면은 브라우저가 예전 모습을 그대로 보여주므로 새로 불러옴 (평가·별점 최신화)
window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });   // e.persisted = 브라우저 캐시(뒤로가기 저장본)에서 꺼낸 화면이면 true → 새로고침

// ---------- 서버 API 호출 ----------
// url: '/api/...' 주소, options: { method: 'POST', body: {보낼 데이터} }
async function api(url, options = {}) {   // async = 서버 응답을 기다렸다가(await) 결과를 돌려주는 함수
  const res = await fetch(url, {   // fetch = 브라우저가 서버에 HTTP 요청을 보내는 기본 함수
    method: options.method || 'GET',   // 방식을 안 주면 GET(조회)
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,   // 보낼 데이터가 있으면 "JSON으로 보낸다"고 알림
    body: options.body ? JSON.stringify(options.body) : undefined,   // 자바스크립트 객체 → JSON 글자로 바꿔서 보냄
    credentials: 'same-origin',   // 같은 사이트 요청에는 로그인 쿠키(sid)를 함께 보냄
  });
  let data = {};
  try { data = await res.json(); } catch (_) { /* 본문 없음 */ }   // 응답 본문(JSON)을 객체로 바꿈. 본문이 비었으면 그냥 빈 객체
  if (!res.ok) {   // res.ok = 상태코드가 200번대(성공)인지
    const err = new Error(data.message || '잠시 후 다시 시도해 주세요.');   // 서버가 보낸 오류 문구를 담은 오류 객체 만들기
    err.status = res.status;   // 상태코드 (401=로그인 필요, 404=없음, 400=입력 오류 …)
    err.code = data.code;   // 서버가 보낸 추가 코드 (예: NO_SCHOOL = 학교 미선택)
    err.errors = data.errors || {};   // 칸별 오류 메시지 { loginId: '...', password: '...' }
    throw err;   // 오류를 던짐 → 부른 쪽의 try/catch에서 받음
  }
  return data;   // 성공하면 서버가 보낸 데이터를 돌려줌
}

// 로그인이 풀렸으면 로그인 화면으로
function handleAuthError(err) {
  if (err && err.status === 401) {   // 401 = 로그인 안 됨(세션 만료)
    location.href = '/login';   // 로그인 화면으로 이동
    return true;   // 처리했으면 true
  }
  return false;
}

// ---------- 입력칸 아래 메시지 (type: 'error' | 'ok') ----------
// name: 입력칸 id, text: 보여줄 문구(비우면 지움), type: 'error'(빨강) 또는 'ok'(초록)
function setFieldMsg(name, text, type = 'error') {
  const msg = document.querySelector(`.field-msg[data-for="${name}"]`);   // data-for 가 name인 메시지 자리 찾기
  const input = document.getElementById(name);   // 해당 입력칸
  if (msg) {
    msg.textContent = text || '';
    msg.className = `field-msg ${text ? type : ''}`;   // 문구가 있으면 색깔 클래스도 붙임
  }
  if (input) input.setAttribute('aria-invalid', text && type === 'error' ? 'true' : 'false');   // 화면 낭독기에게 "이 칸이 잘못됨"을 알림
}

// ---------- HTML에 넣을 글자는 반드시 이스케이프 (평가 글 등에 태그가 섞여도 안전하게) ----------
// 예: '<b>' → '&lt;b&gt;' 로 바뀌어서 태그가 아니라 글자로 보임
function esc(value) {
  return String(value ?? '')   // null/undefined면 빈 글자 (?? = 왼쪽이 없을 때 오른쪽 값)
    .replace(/&/g, '&amp;')   // & 를 가장 먼저 바꿔야 아래에서 만든 &lt; 등이 다시 망가지지 않음
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- 날짜 ----------
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];   // getDay() 0=일요일 ~ 6=토요일 순서
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };   // '2026-11-09' → Date 객체 (월은 0부터 시작이라 -1)
const toYmd = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;   // Date 객체 → '2026-11-09' (padStart: 한 자리면 앞에 0 붙이기)
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };   // n일 뒤(음수면 n일 전) 날짜
function dateLabel(ymd, withYear = false) {   // '2026-11-09' → '11월 9일 (월)' 모양 글자. withYear면 '2026년 ' 도 붙임
  const d = parseYmd(ymd);
  return `${withYear ? d.getFullYear() + '년 ' : ''}${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

// ---------- 숫자 ----------
const fmtNum = (n, digits = 1) => (n === null || n === undefined ? '-' : Number(n).toLocaleString('ko-KR', { maximumFractionDigits: digits }));   // 숫자를 한국식 쉼표 표기로 (값이 없으면 '-'), digits = 소수점 자리 수

// ---------- 아이콘 ----------
const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z';   // 별 모양 SVG 경로 데이터
const starSvg = (on, size = 14) =>   // 별 하나 그리기 (on이면 노란 별)
  `<svg class="star ${on ? 'on' : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
function starsHtml(rating, size = 14) {   // 별점(1~5)만큼 노란 별 + 나머지 회색 별, 총 5개
  let html = `<span class="stars" role="img" aria-label="별점 ${rating}점">`;   // role=img + aria-label: 화면 낭독기가 "별점 4점"으로 읽음
  for (let i = 1; i <= 5; i++) html += starSvg(i <= rating, size);
  return html + '</span>';
}
const ICONS = {   // 화면에서 쓰는 선(stroke) 아이콘 모음 (SVG 경로)
  back: '<path d="m15 18-6-6 6-6"/>',   // < 뒤로
  chevron: '<path d="m9 18 6-6-6-6"/>',   // > 오른쪽 화살표
  close: '<path d="M18 6 6 18M6 6l12 12"/>',   // X 닫기
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',   // 돋보기
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',   // 달력
  star: `<path d="${STAR_PATH}"/>`,   // 별
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',   // 사람
  school: '<path d="M3 10 12 5l9 5-9 5-9-5Z"/><path d="M7 12v5c0 1 2.5 3 5 3s5-2 5-3v-5"/>',   // 학교(학사모)
};
const icon = (name, size = 20) =>   // icon('search', 18) 처럼 이름과 크기로 SVG 아이콘 글자 만들기
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// ---------- 토스트 (잠깐 떴다 사라지는 안내) ----------
function toast(text, ms = 1800) {   // text: 보여줄 문구, ms: 보이는 시간(1.8초)
  let el = document.getElementById('toast');   // 화면에 toast 자리가 있으면 그걸 쓰고
  if (!el) {   // 없으면 새로 만들어 body에 붙임
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');   // role=status: 화면 낭독기가 문구를 읽어줌
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.hidden = false;   // 보이게
  clearTimeout(el._timer);   // 이전 타이머가 남아 있으면 취소 (연속으로 띄울 때 바로 꺼지지 않게)
  el._timer = setTimeout(() => { el.hidden = true; }, ms);   // ms 뒤에 숨김
}

// ---------- 확인 창 (모바일: 아래에서 올라옴, 데스크톱: 가운데) ----------
function confirmDialog({ title, message = '', confirmText = '확인', cancelText = '취소', danger = false }) {   // 사용: if (await confirmDialog({ title: '삭제할까요?' })) { ... }
  return new Promise((resolve) => {   // Promise: 사용자가 버튼을 누를 때까지 기다렸다가 true/false를 돌려줌
    const overlay = document.createElement('div');   // 화면 전체를 덮는 반투명 배경
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="cd-title">
        <div class="handle"></div>
        <h2 id="cd-title">${esc(title)}</h2>
        ${message ? `<p>${esc(message)}</p>` : ''}
        <div class="sheet-actions">
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block" data-ok>${esc(confirmText)}</button>
          <button class="btn btn-text btn-block" data-cancel>${esc(cancelText)}</button>
        </div>
      </div>`;
    const close = (value) => {   // 창을 닫고 결과 전달 (확인=true, 취소=false)
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };   // Esc 키 = 취소
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });   // 바깥 배경을 누르면 취소
    overlay.querySelector('[data-ok]').addEventListener('click', () => close(true));   // 확인 버튼
    overlay.querySelector('[data-cancel]').addEventListener('click', () => close(false));   // 취소 버튼
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);   // 화면에 붙여서 보이게
    overlay.querySelector('[data-cancel]').focus();   // 실수로 엔터를 쳐도 지워지지 않게 처음엔 "취소"에 초점
  });
}
