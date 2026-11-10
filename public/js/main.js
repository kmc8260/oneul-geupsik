// ===================================================================
// main.js — 메인 화면(오늘의 급식, home.html) 동작
//  1) GET /api/meals?from=월요일&to=금요일 로 한 주 식단을 받아옴
//     (서버가 DB에 없으면 나이스 급식 API에서 가져와 저장한 뒤 돌려줌)
//  2) 주간 날짜 버튼 · 끼니 탭(조식/중식/석식) · 메뉴 카드 · 알레르기 경고 · 영양 합계 · 인기 메뉴를 그림
//  3) 메뉴 카드를 누르면: 모바일 → /menu 화면으로 이동, 데스크톱 → 오른쪽 패널에 상세 표시
//  * 학교를 아직 안 골랐으면(NO_SCHOOL) "학교 선택하기" 화면을 보여줌
// ===================================================================
// 메인: 주간 식단 · 끼니 탭 · 메뉴 카드 · (데스크톱) 오른쪽 메뉴 상세
const bodyEl = document.getElementById('home-body');   // 식단이 그려질 자리
const panel = document.getElementById('detail-panel');   // 데스크톱 오른쪽 메뉴 상세 자리
const schoolLine = document.getElementById('school-line');   // 화면 위 "학교 이름 · 날짜 범위" 줄
const desktopQuery = window.matchMedia('(min-width: 1024px)');   // 화면 너비가 1024px 이상인지 (데스크톱 판단) — CSS의 기준과 같음
const MEAL_TYPES = ['조식', '중식', '석식'];   // 끼니 종류 (나이스의 MMEAL_SC_NM 값과 같은 글자)

// 상태 = 지금 화면이 무엇을 보여주고 있는지 기억하는 변수들
// ---------- 상태 ----------
const mondayOf = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), d.getDay() === 0 ? -6 : 1 - d.getDay());   // 어떤 날짜가 속한 주의 월요일 구하기 (일요일이면 6일 전, 나머지는 요일만큼 앞으로)
function defaultDate() {   // 처음 열었을 때 보여줄 날짜 (주말이면 다음 주 월요일)
  const now = new Date();
  if (now.getDay() === 6) return toYmd(addDays(now, 2)); // 토요일 → 다음 월요일
  if (now.getDay() === 0) return toYmd(addDays(now, 1)); // 일요일 → 다음 월요일
  return toYmd(now);   // 평일이면 오늘
}
const params = new URLSearchParams(location.search);   // 주소의 ?date=...&type=... 읽기 (뒤로 가기로 돌아와도 보던 날짜 유지)
let selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : defaultDate();   // 주소에 올바른 날짜가 있으면 그 날짜, 없으면 기본 날짜
let selectedType = MEAL_TYPES.includes(params.get('type')) ? params.get('type') : null;   // 주소에 끼니가 있으면 그 끼니 (없으면 render에서 중식을 기본으로 고름)
let weekStart = mondayOf(parseYmd(selectedDate));   // 지금 보고 있는 주의 월요일
let data = null;          // /api/meals 응답
let myAllergies = [];     // 내 알레르기 이름
let selectedMenu = null;  // 데스크톱에서 고른 메뉴 { mealId, menuId }
let loadSeq = 0;   // 요청 번호 (빨리 여러 번 눌렀을 때 마지막 요청 결과만 쓰기 위함)

window.mePromise.then((me) => { myAllergies = me.allergies.map((a) => a.name); }).catch(() => {});   // layout.js가 받아 둔 내 정보에서 알레르기 이름만 꺼냄 (등록 안내 문구에 사용)

function saveState() {   // 지금 보는 날짜·끼니를 주소에 저장 (새로고침·뒤로 가기에도 유지)
  const q = new URLSearchParams({ date: selectedDate });
  if (selectedType) q.set('type', selectedType);
  history.replaceState(null, '', `/?${q}`);   // replaceState: 페이지 이동 없이 주소만 바꿈 (방문 기록도 늘지 않음)
}

// ---------- 불러오기 ----------
async function loadWeek() {   // 한 주(월~금) 식단 불러오기
  const seq = ++loadSeq;   // 이번 요청 번호
  const from = toYmd(weekStart);   // 월요일
  const to = toYmd(addDays(weekStart, 4));   // 금요일 (월요일 + 4일)
  if (!data) bodyEl.innerHTML = '<p class="muted pad">불러오는 중…</p>';   // 처음 불러올 때만 "불러오는 중" 표시 (주를 바꿀 땐 화면 깜빡임 없이)
  try {
    const res = await api(`/api/meals?from=${from}&to=${to}`);   // 서버에 한 주 식단 요청 → { school, today, meals, popular, warning }
    if (seq !== loadSeq) return; // 그 사이 다른 주를 눌렀으면 무시
    data = res;   // 받은 데이터 저장
    await window.mePromise.catch(() => {});   // 내 정보(알레르기)도 다 받아질 때까지 기다림
    render();   // 화면 그리기
  } catch (err) {
    if (handleAuthError(err)) return;
    if (err.code === 'NO_SCHOOL') return renderNoSchool();   // 학교 미선택이면 학교 선택 안내 화면
    bodyEl.innerHTML = `<div class="empty"><p>${esc(err.message)}</p><button class="btn btn-secondary" id="retry">다시 시도</button></div>`;   // 그 밖의 오류는 문구 + "다시 시도" 버튼
    document.getElementById('retry').addEventListener('click', loadWeek);
  }
}

// ---------- 학교를 아직 안 고른 경우 ----------
function renderNoSchool() {   // 학교를 아직 안 고른 회원에게 보여주는 화면
  schoolLine.textContent = '학교를 선택해 주세요';
  panel.innerHTML = '';
  bodyEl.innerHTML = `
    <div class="empty">
      <span class="empty-icon">${icon('school', 28)}</span>
      <h2>학교를 선택하면 급식을 볼 수 있어요</h2>
      <p class="muted">나이스(NEIS)에 공개된 우리 학교 급식 식단을 불러와요.</p>
      <button class="btn btn-primary" id="pick-school">학교 선택하기</button>
    </div>`;
  document.getElementById('pick-school').addEventListener('click', () => openSchoolPicker(selectSchool));   // 버튼을 누르면 학교 검색 창을 열고, 고르면 selectSchool 실행
}

async function selectSchool(s) {   // 학교를 골랐을 때: 내 학교로 저장하고 식단 다시 불러오기
  try {
    await api('/api/me/school', { method: 'PUT', body: { officeCode: s.officeCode, schoolCode: s.schoolCode } });   // routes/school.js의 PUT /api/me/school — 교육청 코드 + 학교 코드를 보냄
    toast(`${s.name}(으)로 설정했어요`);
    document.getElementById('sidebar-school').textContent = s.name;   // 사이드바의 학교 이름도 바로 바꿈
    data = null;   // 예전 데이터 지우고
    loadWeek();   // 새 학교 식단 불러오기
  } catch (err) {
    if (!handleAuthError(err)) toast(err.message, 3000);   // 오류면 3초 동안 알림
  }
}

// ---------- 그리기 ----------
const mealsOn = (date) => data.meals.filter((m) => m.date === date);   // 특정 날짜의 식단만 골라내기 (조식·중식·석식 최대 3개)

function render() {   // 화면 전체 그리기 (데이터나 선택이 바뀔 때마다 다시 부름)
  const end = addDays(weekStart, 4);   // 금요일
  const range = weekStart.getMonth() === end.getMonth()   // 화면 위 날짜 범위 글자: 같은 달이면 "11월 9일 ~ 13일", 달이 넘어가면 "10월 30일 ~ 11월 3일"
    ? `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${end.getDate()}일`
    : `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${end.getMonth() + 1}월 ${end.getDate()}일`;
  schoolLine.textContent = `${data.school.name} · ${range}`;   // "미림여자정보과학고등학교 · 11월 9일 ~ 13일"

  const dayMeals = mealsOn(selectedDate);   // 고른 날짜의 식단들
  const types = dayMeals.map((m) => m.type);   // 그날 있는 끼니 종류들
  if (!types.includes(selectedType)) selectedType = types.includes('중식') ? '중식' : types[0] || null;   // 고른 끼니가 그날 없으면 → 중식 우선, 없으면 첫 번째 끼니
  saveState();   // 주소에 저장
  const meal = dayMeals.find((m) => m.type === selectedType);   // 지금 보여줄 한 끼

  // 화면에 그릴 HTML 글자를 조각조각 만들어 마지막에 한 번에 넣음 (week + tabs + content)
  // 주간 날짜 버튼
  let week = `<div class="week-nav">
    <button class="icon-btn week-arrow" data-week="-1" aria-label="지난주">${icon('back', 20)}</button>
    <div class="week-days">`;
  for (let i = 0; i < 5; i++) {   // 월~금 5일 버튼
    const ymd = toYmd(addDays(weekStart, i));   // 그날 날짜 글자
    const d = parseYmd(ymd);
    const has = mealsOn(ymd).length > 0;   // 그날 급식이 있는지 (없으면 흐리게)
    // · on = 고른 날짜(파란색), empty-day = 급식 없는 날(흐리게), today-dot = 오늘 표시 점
    week += `<button class="day ${ymd === selectedDate ? 'on' : ''} ${has ? '' : 'empty-day'}" data-date="${ymd}" aria-pressed="${ymd === selectedDate}">
        <span>${WEEKDAYS[d.getDay()]}</span><strong>${d.getDate()}</strong>${ymd === data.today ? '<i class="today-dot" aria-label="오늘"></i>' : ''}
      </button>`;
  }
  week += `</div><button class="icon-btn week-arrow" data-week="1" aria-label="다음주">${icon('chevron', 20)}</button></div>`;

  // 끼니 탭
  // 끼니 탭: 그날 없는 끼니는 disabled(누를 수 없음)
  // · 그날 이 끼니가 있는지
  const tabs = `<div class="meal-tabs" role="tablist">${MEAL_TYPES.map((t) => {
    const has = types.includes(t);
    return `<button role="tab" class="tab ${t === selectedType ? 'on' : ''}" data-type="${t}" aria-selected="${t === selectedType}" ${has ? '' : 'disabled'}>${t}</button>`;
  }).join('')}</div>`;

  let content = '';   // 탭 아래 본문 내용
  if (data.warning) content += `<div class="info-box warn-soft">${esc(data.warning)} 저장된 식단만 보여드려요.</div>`;   // 나이스 연결이 안 될 때 서버가 보낸 경고 (DB에 저장된 것만 보여준다고 알림)

  if (!meal) {   // 그날 그 끼니 급식이 없으면 안내 문구
    content += `<div class="empty"><p><strong>${esc(dateLabel(selectedDate))}</strong>에는 급식 정보가 없어요.</p><p class="muted">방학·휴일이거나 학교가 아직 나이스에 올리지 않았을 수 있어요.</p></div>`;
    panel.innerHTML = '';   // 오른쪽 패널도 비움
  } else {
    // 내 알레르기 안내
    const warnMenus = meal.menus.filter((m) => m.allergies.some((a) => a.mine));   // 내 알레르기가 들어간 메뉴들
    if (warnMenus.length) {   // 하나라도 있으면 빨간 경고 띠
      const names = [...new Set(warnMenus.flatMap((m) => m.allergies.filter((a) => a.mine).map((a) => a.name)))];   // 겹치는 알레르기 이름을 한 번씩만 (Set = 중복 제거)
      content += `<div class="alert-banner"><span class="alert-dot">!</span><span>내 알레르기(${esc(names.join(', '))})가 들어간 메뉴가 ${warnMenus.length}개 있어요</span></div>`;
    } else if (!myAllergies.length) {   // 알레르기를 아직 등록 안 했으면 → 등록하러 가기 안내
      content += `<a class="info-box" href="/allergy"><span>내 알레르기를 등록하면 주의할 메뉴를 알려드려요</span><b>등록하기 ›</b></a>`;
    }

    // 메뉴 카드
    content += '<div class="menu-grid">';   // 메뉴 카드 목록 시작
    for (const m of meal.menus) {   // 메뉴마다 카드 하나
      const warn = m.allergies.some((a) => a.mine);   // 이 메뉴에 내 알레르기가 있으면 빨간 테두리 카드
      const picked = selectedMenu && selectedMenu.mealId === meal.mealId && selectedMenu.menuId === m.menuId;   // 데스크톱에서 지금 고른 메뉴인지 (파란 테두리)
      const tags = m.allergies.length   // 알레르기 태그들 (내 알레르기면 빨간 태그)
        ? m.allergies.map((a) => `<span class="tag ${a.mine ? 'warn' : ''}">${esc(a.name)}</span>`).join('')
        : '<span class="muted small">알레르기 유발 식품 없음</span>';
      const rating = m.reviewCount ? `<span class="mini-rating">${starSvg(true, 13)}${fmtNum(m.avgRating)}<small>(${m.reviewCount})</small></span>` : '';   // 평가가 있으면 "★4.3(12)" 작은 별점
      // · data-meal / data-menu: 카드를 눌렀을 때 어떤 메뉴인지 알기 위한 번호
      content += `<button class="menu-card ${warn ? 'warn' : ''} ${picked ? 'picked' : ''}" data-meal="${meal.mealId}" data-menu="${m.menuId}">
          <span class="menu-card-head"><strong>${esc(m.name)}</strong>${rating}</span>
          <span class="tags">${tags}</span>
        </button>`;
    }
    content += '</div>';

    content += `<div class="meal-sum"><span class="muted">${esc(meal.type)} 합계</span><strong>${fmtNum(meal.calories)} kcal · 탄 ${fmtNum(meal.carbs)}g · 단 ${fmtNum(meal.protein)}g · 지 ${fmtNum(meal.fat)}g</strong></div>`;   // 한 끼 영양 합계 (열량·탄수화물·단백질·지방)
  }

  // 이번 주 인기 메뉴
  if (data.popular.length) {   // 이번 주 인기 메뉴 (서버가 평균 별점 높은 순으로 최대 3개 보내줌)
    // · 1등은 first 클래스로 강조, 누르면 그 날짜·끼니로 이동하면서 메뉴 열기
    content += `<section class="popular"><h2 class="section-title">이번 주 인기 메뉴</h2><div class="popular-row">${data.popular
      .map((p, i) => `<button class="popular-card" data-meal="${p.mealId}" data-menu="${p.menuId}" data-date="${p.date}" data-type="${esc(p.type)}">
          <span class="rank ${i === 0 ? 'first' : ''}">${i + 1}</span>
          <span class="popular-text"><strong>${esc(p.name)}</strong><span>${starSvg(true, 12)} ${fmtNum(p.avgRating)} · ${esc(p.date.slice(5).replace('-', '/'))} ${esc(p.type)}</span></span>
        </button>`)
      .join('')}</div></section>`;
  }

  bodyEl.innerHTML = week + tabs + content;   // 만든 조각들을 화면에 한 번에 넣기
  bindEvents(meal);   // 버튼들에 클릭 동작 연결
  renderPanel(meal);   // 데스크톱이면 오른쪽 상세 패널 그리기
}

function bindEvents(meal) {   // 방금 그린 버튼들에 클릭하면 할 일을 연결
  bodyEl.querySelectorAll('[data-week]').forEach((b) =>   // ‹ › 지난주/다음주 버튼: 7일씩 이동 후 그 주의 월요일 선택, 새로 불러오기
    b.addEventListener('click', () => {
      weekStart = addDays(weekStart, Number(b.dataset.week) * 7);
      selectedDate = toYmd(weekStart);
      selectedMenu = null;
      loadWeek();
    })
  );
  bodyEl.querySelectorAll('.day').forEach((b) =>   // 날짜 버튼: 고른 날짜만 바꾸고 다시 그림 (이미 받은 주 데이터라 요청 없음)
    b.addEventListener('click', () => { selectedDate = b.dataset.date; selectedMenu = null; render(); })
  );
  bodyEl.querySelectorAll('.tab').forEach((b) =>   // 끼니 탭: 끼니만 바꾸고 다시 그림
    b.addEventListener('click', () => { selectedType = b.dataset.type; selectedMenu = null; render(); })
  );
  bodyEl.querySelectorAll('.menu-card').forEach((b) =>   // 메뉴 카드: 메뉴 열기
    b.addEventListener('click', () => openMenu(Number(b.dataset.meal), Number(b.dataset.menu)))
  );
  bodyEl.querySelectorAll('.popular-card').forEach((b) =>   // 인기 메뉴: 그 메뉴가 나온 날짜·끼니로 바꾸고 메뉴 열기
    b.addEventListener('click', () => {
      selectedDate = b.dataset.date;
      selectedType = b.dataset.type;
      openMenu(Number(b.dataset.meal), Number(b.dataset.menu));
    })
  );
}

function openMenu(mealId, menuId) {   // 메뉴 열기 (화면 크기에 따라 다르게)
  if (desktopQuery.matches) {   // 데스크톱이면 오른쪽 패널에 상세 표시
    selectedMenu = { mealId, menuId };
    render();
  } else {
    saveState();   // 모바일이면 지금 상태를 주소에 저장하고
    location.href = `/menu?meal=${mealId}&menu=${menuId}`;   // 메뉴 상세 화면으로 이동 (/menu?meal=12&menu=4)
  }
}

// ---------- 데스크톱 오른쪽 패널 ----------
async function renderPanel(meal) {   // 데스크톱 오른쪽 패널에 메뉴 상세 그리기
  if (!desktopQuery.matches || !meal) return;   // 모바일이거나 급식이 없으면 안 그림
  if (!selectedMenu || selectedMenu.mealId !== meal.mealId) {   // 아직 고른 메뉴가 없거나 다른 끼니의 메뉴면 → 자동으로 하나 고르기
    const first = meal.menus.find((m) => m.allergies.some((a) => a.mine)) || meal.menus[0];   // 내 알레르기 메뉴가 있으면 그것부터, 없으면 첫 번째 메뉴
    selectedMenu = { mealId: meal.mealId, menuId: first.menuId };
    const card = bodyEl.querySelector(`.menu-card[data-menu="${first.menuId}"]`);   // 고른 카드에 파란 테두리
    if (card) card.classList.add('picked');
  }
  const { mealId, menuId } = selectedMenu;
  try {
    const d = await fetchMenuDetail(mealId, menuId);   // 메뉴 상세 요청 (menu-detail.js)
    if (!selectedMenu || selectedMenu.menuId !== menuId || selectedMenu.mealId !== mealId) return;   // 기다리는 사이 다른 메뉴를 눌렀으면 이 결과는 버림
    renderMenuDetail(panel, d, { onReview: () => openReviewModal(d, loadWeek) });   // 상세를 그리고, 평가 버튼을 누르면 팝업 폼 → 저장 후 한 주 다시 불러오기
  } catch (err) {
    if (!handleAuthError(err)) panel.innerHTML = `<p class="muted pad">${esc(err.message)}</p>`;
  }
}

desktopQuery.addEventListener('change', () => data && render());   // 창 크기를 바꿔 데스크톱 ↔ 모바일이 바뀌면 다시 그림

document.getElementById('today-btn').addEventListener('click', () => {   // "오늘" 버튼: 오늘(주말이면 다음 월요일)로 돌아가기
  selectedDate = defaultDate();
  weekStart = mondayOf(parseYmd(selectedDate));
  selectedType = null;
  selectedMenu = null;
  loadWeek();
});

loadWeek();   // 화면이 열리면 바로 이번 주 식단 불러오기
