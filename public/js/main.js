// ===================================================================
// main.js — 메인 화면(오늘의 급식, home.html) 동작
//  1) GET /api/meals?from=월요일&to=금요일 로 한 주 식단을 받아옴
//     (서버가 DB에 없으면 나이스 급식 API에서 가져와 저장한 뒤 돌려줌)
//  2) 주간 날짜 버튼 · 끼니 탭(조식/중식/석식) · 메뉴 카드 · 알레르기 경고 · 영양 합계 · 인기 메뉴를 그림
//  3) 메뉴 카드를 누르면: 모바일 → /menu 화면으로 이동, 데스크톱 → 오른쪽 패널에 상세 표시
//  * 학교를 아직 안 골랐으면(NO_SCHOOL) "학교 선택하기" 화면을 보여줌
// ===================================================================
// 화면 요소와 기본값
const bodyEl = document.getElementById('home-body');
const panel = document.getElementById('detail-panel');
const schoolLine = document.getElementById('school-line');
const desktopQuery = window.matchMedia('(min-width: 1024px)');
const MEAL_TYPES = ['조식', '중식', '석식'];

// ---------- 상태 ----------
const mondayOf = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), d.getDay() === 0 ? -6 : 1 - d.getDay());
function defaultDate() {
  const now = new Date();
  if (now.getDay() === 6) return toYmd(addDays(now, 2));
  if (now.getDay() === 0) return toYmd(addDays(now, 1));
  return toYmd(now);
}
const params = new URLSearchParams(location.search);
let selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : defaultDate();
let selectedType = MEAL_TYPES.includes(params.get('type')) ? params.get('type') : null;
let weekStart = mondayOf(parseYmd(selectedDate));
let data = null;
let myAllergies = [];
let selectedMenu = null;
let loadSeq = 0;

window.mePromise.then((me) => { myAllergies = me.allergies.map((a) => a.name); }).catch(() => {});

// 지금 보는 날짜·끼니를 주소(?date=...&type=...)에 저장 → 새로고침·뒤로 가기에도 그대로 유지
function saveState() {
  const q = new URLSearchParams({ date: selectedDate });
  if (selectedType) q.set('type', selectedType);
  history.replaceState(null, '', `/?${q}`);
}

// ---------- 불러오기 ----------
// 한 주(월~금) 식단을 서버에서 받아와 그리기. 빨리 여러 번 눌러도 마지막 요청 결과만 씀(loadSeq)
async function loadWeek() {
  const seq = ++loadSeq;
  const from = toYmd(weekStart);
  const to = toYmd(addDays(weekStart, 4));
  if (!data) bodyEl.innerHTML = '<p class="muted pad">불러오는 중…</p>';
  try {
    const res = await api(`/api/meals?from=${from}&to=${to}`);
    if (seq !== loadSeq) return;
    data = res;
    await window.mePromise.catch(() => {});
    render();
  } catch (err) {
    if (handleAuthError(err)) return;
    if (err.code === 'NO_SCHOOL') return renderNoSchool();
    bodyEl.innerHTML = `<div class="empty"><p>${esc(err.message)}</p><button class="btn btn-secondary" id="retry">다시 시도</button></div>`;
    document.getElementById('retry').addEventListener('click', loadWeek);
  }
}

// ---------- 학교를 아직 안 고른 경우 ----------
function renderNoSchool() {
  schoolLine.textContent = '학교를 선택해 주세요';
  panel.innerHTML = '';
  bodyEl.innerHTML = `
    <div class="empty">
      <span class="empty-icon">${icon('school', 28)}</span>
      <h2>학교를 선택하면 급식을 볼 수 있어요</h2>
      <p class="muted">나이스(NEIS)에 공개된 우리 학교 급식 식단을 불러와요.</p>
      <button class="btn btn-primary" id="pick-school">학교 선택하기</button>
    </div>`;
  document.getElementById('pick-school').addEventListener('click', () => openSchoolPicker(selectSchool));
}

// 학교를 고르면 내 학교로 저장하고 식단을 다시 불러옴
async function selectSchool(s) {
  try {
    await api('/api/me/school', { method: 'PUT', body: { officeCode: s.officeCode, schoolCode: s.schoolCode } });
    toast(`${s.name}(으)로 설정했어요`);
    document.getElementById('sidebar-school').textContent = s.name;
    data = null;
    loadWeek();
  } catch (err) {
    if (!handleAuthError(err)) toast(err.message, 3000);
  }
}

// ---------- 그리기 ----------
const mealsOn = (date) => data.meals.filter((m) => m.date === date);

// 화면 전체 그리기: 날짜 버튼 → 끼니 탭 → 알레르기 경고 → 메뉴 카드 → 영양 합계 → 인기 메뉴
// 날짜·끼니·메뉴를 바꿀 때마다 다시 부름
function render() {
  const end = addDays(weekStart, 4);
  const range = weekStart.getMonth() === end.getMonth()
    ? `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${end.getDate()}일`
    : `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${end.getMonth() + 1}월 ${end.getDate()}일`;
  schoolLine.textContent = `${data.school.name} · ${range}`;

  const dayMeals = mealsOn(selectedDate);
  const types = dayMeals.map((m) => m.type);
  if (!types.includes(selectedType)) selectedType = types.includes('중식') ? '중식' : types[0] || null;
  saveState();
  const meal = dayMeals.find((m) => m.type === selectedType);

  // 주간 날짜 버튼
  let week = `<div class="week-nav">
    <button class="icon-btn week-arrow" data-week="-1" aria-label="지난주">${icon('back', 20)}</button>
    <div class="week-days">`;
  for (let i = 0; i < 5; i++) {
    const ymd = toYmd(addDays(weekStart, i));
    const d = parseYmd(ymd);
    const has = mealsOn(ymd).length > 0;
    week += `<button class="day ${ymd === selectedDate ? 'on' : ''} ${has ? '' : 'empty-day'}" data-date="${ymd}" aria-pressed="${ymd === selectedDate}">
        <span>${WEEKDAYS[d.getDay()]}</span><strong>${d.getDate()}</strong>${ymd === data.today ? '<i class="today-dot" aria-label="오늘"></i>' : ''}
      </button>`;
  }
  week += `</div><button class="icon-btn week-arrow" data-week="1" aria-label="다음주">${icon('chevron', 20)}</button></div>`;

  // 끼니 탭: 그날 없는 끼니는 disabled(누를 수 없음)
  const tabs = `<div class="meal-tabs" role="tablist">${MEAL_TYPES.map((t) => {
    const has = types.includes(t);
    return `<button role="tab" class="tab ${t === selectedType ? 'on' : ''}" data-type="${t}" aria-selected="${t === selectedType}" ${has ? '' : 'disabled'}>${t}</button>`;
  }).join('')}</div>`;

  let content = '';
  if (data.warning) content += `<div class="info-box warn-soft">${esc(data.warning)} 저장된 식단만 보여드려요.</div>`;

  if (!meal) {
    content += `<div class="empty"><p><strong>${esc(dateLabel(selectedDate))}</strong>에는 급식 정보가 없어요.</p><p class="muted">방학·휴일이거나 학교가 아직 나이스에 올리지 않았을 수 있어요.</p></div>`;
    panel.innerHTML = '';
  } else {
    // 내 알레르기 안내
    const warnMenus = meal.menus.filter((m) => m.allergies.some((a) => a.mine));
    if (warnMenus.length) {
      const names = [...new Set(warnMenus.flatMap((m) => m.allergies.filter((a) => a.mine).map((a) => a.name)))];
      content += `<div class="alert-banner"><span class="alert-dot">!</span><span>내 알레르기(${esc(names.join(', '))})가 들어간 메뉴가 ${warnMenus.length}개 있어요</span></div>`;
    } else if (!myAllergies.length) {
      content += `<a class="info-box" href="/allergy"><span>내 알레르기를 등록하면 주의할 메뉴를 알려드려요</span><b>등록하기 ›</b></a>`;
    }

    // 메뉴 카드
    content += '<div class="menu-grid">';
    for (const m of meal.menus) {
      const warn = m.allergies.some((a) => a.mine);
      const picked = selectedMenu && selectedMenu.mealId === meal.mealId && selectedMenu.menuId === m.menuId;
      const tags = m.allergies.length
        ? m.allergies.map((a) => `<span class="tag ${a.mine ? 'warn' : ''}">${esc(a.name)}</span>`).join('')
        : '<span class="muted small">알레르기 유발 식품 없음</span>';
      const rating = m.reviewCount ? `<span class="mini-rating">${starSvg(true, 13)}${fmtNum(m.avgRating)}<small>(${m.reviewCount})</small></span>` : '';
      content += `<button class="menu-card ${warn ? 'warn' : ''} ${picked ? 'picked' : ''}" data-meal="${meal.mealId}" data-menu="${m.menuId}">
          <span class="menu-card-head"><strong>${esc(m.name)}</strong>${rating}</span>
          <span class="tags">${tags}</span>
        </button>`;
    }
    content += '</div>';

    content += `<div class="meal-sum"><span class="muted">${esc(meal.type)} 합계</span><strong>${fmtNum(meal.calories)} kcal · 탄 ${fmtNum(meal.carbs)}g · 단 ${fmtNum(meal.protein)}g · 지 ${fmtNum(meal.fat)}g</strong></div>`;
  }

  // 이번 주 인기 메뉴
  if (data.popular.length) {
    content += `<section class="popular"><h2 class="section-title">이번 주 인기 메뉴</h2><div class="popular-row">${data.popular
      .map((p, i) => `<button class="popular-card" data-meal="${p.mealId}" data-menu="${p.menuId}" data-date="${p.date}" data-type="${esc(p.type)}">
          <span class="rank ${i === 0 ? 'first' : ''}">${i + 1}</span>
          <span class="popular-text"><strong>${esc(p.name)}</strong><span>${starSvg(true, 12)} ${fmtNum(p.avgRating)} · ${esc(p.date.slice(5).replace('-', '/'))} ${esc(p.type)}</span></span>
        </button>`)
      .join('')}</div></section>`;
  }

  bodyEl.innerHTML = week + tabs + content;
  bindEvents(meal);
  renderPanel(meal);
}

// 방금 그린 버튼들(주 이동, 날짜, 끼니 탭, 메뉴 카드, 인기 메뉴)에 클릭 동작 연결
function bindEvents(meal) {
  bodyEl.querySelectorAll('[data-week]').forEach((b) =>
    b.addEventListener('click', () => {
      weekStart = addDays(weekStart, Number(b.dataset.week) * 7);
      selectedDate = toYmd(weekStart);
      selectedMenu = null;
      loadWeek();
    })
  );
  bodyEl.querySelectorAll('.day').forEach((b) =>
    b.addEventListener('click', () => { selectedDate = b.dataset.date; selectedMenu = null; render(); })
  );
  bodyEl.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => { selectedType = b.dataset.type; selectedMenu = null; render(); })
  );
  bodyEl.querySelectorAll('.menu-card').forEach((b) =>
    b.addEventListener('click', () => openMenu(Number(b.dataset.meal), Number(b.dataset.menu)))
  );
  bodyEl.querySelectorAll('.popular-card').forEach((b) =>
    b.addEventListener('click', () => {
      selectedDate = b.dataset.date;
      selectedType = b.dataset.type;
      openMenu(Number(b.dataset.meal), Number(b.dataset.menu));
    })
  );
}

// 메뉴 열기: 데스크톱은 오른쪽 패널에 표시, 모바일은 메뉴 상세 화면으로 이동
function openMenu(mealId, menuId) {
  if (desktopQuery.matches) {
    selectedMenu = { mealId, menuId };
    render();
  } else {
    saveState();
    location.href = `/menu?meal=${mealId}&menu=${menuId}`;
  }
}

// ---------- 데스크톱 오른쪽 패널 ----------
// 고른 메뉴가 없으면 (내 알레르기 메뉴 우선으로) 자동으로 하나 고르고 상세를 받아 패널에 그림
async function renderPanel(meal) {
  if (!desktopQuery.matches || !meal) return;
  if (!selectedMenu || selectedMenu.mealId !== meal.mealId) {
    const first = meal.menus.find((m) => m.allergies.some((a) => a.mine)) || meal.menus[0];
    selectedMenu = { mealId: meal.mealId, menuId: first.menuId };
    const card = bodyEl.querySelector(`.menu-card[data-menu="${first.menuId}"]`);
    if (card) card.classList.add('picked');
  }
  const { mealId, menuId } = selectedMenu;
  try {
    const d = await fetchMenuDetail(mealId, menuId);
    if (!selectedMenu || selectedMenu.menuId !== menuId || selectedMenu.mealId !== mealId) return;
    renderMenuDetail(panel, d, { onReview: () => openReviewModal(d, loadWeek) });
  } catch (err) {
    if (!handleAuthError(err)) panel.innerHTML = `<p class="muted pad">${esc(err.message)}</p>`;
  }
}

// 창 크기가 바뀌면 다시 그리기 / 오늘 버튼 / 처음 불러오기
desktopQuery.addEventListener('change', () => data && render());

document.getElementById('today-btn').addEventListener('click', () => {
  selectedDate = defaultDate();
  weekStart = mondayOf(parseYmd(selectedDate));
  selectedType = null;
  selectedMenu = null;
  loadWeek();
});

loadWeek();
