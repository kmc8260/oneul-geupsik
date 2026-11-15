// ===================================================================
// menu.js — 메뉴 상세 화면(menu.html, 주로 모바일) 동작
//  - 주소 /menu?meal=12&menu=4 에서 식단 번호·메뉴 번호를 읽음
//  - 서버에서 상세를 받아 menu-detail.js의 renderMenuDetail()로 그림
//  - "평가 남기기"를 누르면 /review 화면으로 이동
// ===================================================================
// 주소(?meal=..&menu=..)에서 식단 번호와 메뉴 번호 읽기
const params = new URLSearchParams(location.search);
const mealId = Number(params.get('meal'));
const menuId = Number(params.get('menu'));
const el = document.getElementById('detail');

// 메인에서 들어왔으면 뒤로가기로 원래 날짜·끼니 그대로 돌아감
document.getElementById('back').addEventListener('click', (e) => {
  if (document.referrer.startsWith(location.origin) && history.length > 1) {
    e.preventDefault();
    history.back();
  }
});

// 메뉴 상세를 받아 공통 함수로 그리고, 평가 버튼을 누르면 평가 작성 화면으로 이동
async function load() {
  if (!mealId || !menuId) {
    el.innerHTML = '<p class="muted pad">메뉴를 찾을 수 없어요.</p>';
    return;
  }
  try {
    const d = await fetchMenuDetail(mealId, menuId);
    document.title = `${d.name} · 오늘의 급식`;
    renderMenuDetail(el, d, {
      onReview: () => { location.href = `/review?meal=${mealId}&menu=${menuId}`; },
    });
  } catch (err) {
    if (!handleAuthError(err)) el.innerHTML = `<p class="muted pad">${esc(err.message)}</p>`;
  }
}

load();
