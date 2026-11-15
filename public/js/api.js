// ===================================================================
// api.js — 모든 화면이 함께 쓰는 "공통 도구 상자"
//  - HTML에서 가장 먼저 불러와서, 다른 JS 파일들이 여기 함수를 그냥 가져다 씀
//  - api()        : 서버(/api/...)에 요청 보내고 JSON 결과 받기
//  - esc()        : 화면에 넣을 글자를 안전하게 바꾸기 (XSS 공격 방지)
//  - 날짜·숫자·별점·아이콘 만들기, toast(잠깐 뜨는 알림), confirmDialog(확인 창)
// ===================================================================

// 뒤로가기로 돌아온 화면은 브라우저가 예전 모습을 그대로 보여주므로 새로 불러옴 (평가·별점 최신화)
window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

// ---------- 서버 API 호출 ----------
// url: '/api/...' 주소, options: { method: 'POST', body: {보낼 데이터} }
async function api(url, options = {}) {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await res.json(); } catch (_) { /* 본문 없음 */ }
  if (!res.ok) {
    const err = new Error(data.message || '잠시 후 다시 시도해 주세요.');
    err.status = res.status;
    err.code = data.code;
    err.errors = data.errors || {};
    throw err;
  }
  return data;
}

// 로그인이 풀렸으면 로그인 화면으로
function handleAuthError(err) {
  if (err && err.status === 401) {
    location.href = '/login';
    return true;
  }
  return false;
}

// ---------- 입력칸 아래 메시지 (type: 'error' | 'ok') ----------
// name: 입력칸 id, text: 보여줄 문구(비우면 지움), type: 'error'(빨강) 또는 'ok'(초록)
function setFieldMsg(name, text, type = 'error') {
  const msg = document.querySelector(`.field-msg[data-for="${name}"]`);
  const input = document.getElementById(name);
  if (msg) {
    msg.textContent = text || '';
    msg.className = `field-msg ${text ? type : ''}`;
  }
  if (input) input.setAttribute('aria-invalid', text && type === 'error' ? 'true' : 'false');
}

// ---------- HTML에 넣을 글자는 반드시 이스케이프 (평가 글 등에 태그가 섞여도 안전하게) ----------
// 예: '<b>' → '&lt;b&gt;' 로 바뀌어서 태그가 아니라 글자로 보임
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- 날짜 ----------
// parseYmd: '2026-11-09' → Date, toYmd: Date → '2026-11-09', addDays: n일 더하기, dateLabel: '11월 9일 (월)'
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const toYmd = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
function dateLabel(ymd, withYear = false) {
  const d = parseYmd(ymd);
  return `${withYear ? d.getFullYear() + '년 ' : ''}${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

// ---------- 숫자 ----------
const fmtNum = (n, digits = 1) => (n === null || n === undefined ? '-' : Number(n).toLocaleString('ko-KR', { maximumFractionDigits: digits }));

// ---------- 아이콘 ----------
// 별점(★)과 선 아이콘을 SVG 글자로 만들어 주는 함수들
const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z';
const starSvg = (on, size = 14) =>
  `<svg class="star ${on ? 'on' : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
function starsHtml(rating, size = 14) {
  let html = `<span class="stars" role="img" aria-label="별점 ${rating}점">`;
  for (let i = 1; i <= 5; i++) html += starSvg(i <= rating, size);
  return html + '</span>';
}
const ICONS = {
  back: '<path d="m15 18-6-6 6-6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  star: `<path d="${STAR_PATH}"/>`,
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  school: '<path d="M3 10 12 5l9 5-9 5-9-5Z"/><path d="M7 12v5c0 1 2.5 3 5 3s5-2 5-3v-5"/>',
};
const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// ---------- 토스트 (잠깐 떴다 사라지는 안내) ----------
function toast(text, ms = 1800) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------- 확인 창 (모바일: 아래에서 올라옴, 데스크톱: 가운데) ----------
function confirmDialog({ title, message = '', confirmText = '확인', cancelText = '취소', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
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
    const close = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.querySelector('[data-ok]').addEventListener('click', () => close(true));
    overlay.querySelector('[data-cancel]').addEventListener('click', () => close(false));
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-cancel]').focus();
  });
}
