// ===================================================================
// menu.js — 메뉴 상세 화면(menu.html, 주로 모바일) 동작
//  - 주소 /menu?meal=12&menu=4 에서 식단 번호·메뉴 번호를 읽음
//  - 서버에서 상세를 받아 menu-detail.js의 renderMenuDetail()로 그림
//  - "평가 남기기"를 누르면 /review 화면으로 이동
// ===================================================================
// 메뉴 상세 화면 (주로 모바일)
const params = new URLSearchParams(location.search);   // 주소의 ? 뒤 값들 (meal, menu) 읽기
const mealId = Number(params.get('meal'));   // 식단(meal) 번호
const menuId = Number(params.get('menu'));   // 메뉴(menu) 번호
const el = document.getElementById('detail');   // 상세가 그려질 자리

// 메인에서 들어왔으면 뒤로가기로 원래 날짜·끼니 그대로 돌아감
document.getElementById('back').addEventListener('click', (e) => {   // 뒤로 가기를 누르면
  if (document.referrer.startsWith(location.origin) && history.length > 1) {   // 우리 사이트에서 왔고 이전 기록이 있으면
    e.preventDefault();   // 링크로 이동하지 않고
    history.back();   // 브라우저 뒤로 가기 (메인에서 보던 날짜·끼니 그대로)
  }
});

async function load() {   // 메뉴 상세 불러와서 그리기
  if (!mealId || !menuId) {   // 번호가 없거나 잘못되면 (Number가 0 또는 NaN)
    el.innerHTML = '<p class="muted pad">메뉴를 찾을 수 없어요.</p>';
    return;
  }
  try {
    const d = await fetchMenuDetail(mealId, menuId);   // 서버에 메뉴 상세 요청
    document.title = `${d.name} · 오늘의 급식`;   // 브라우저 탭 제목을 메뉴 이름으로
    renderMenuDetail(el, d, {   // 화면 그리기 (공통 함수)
      onReview: () => { location.href = `/review?meal=${mealId}&menu=${menuId}`; },   // 평가 버튼 → 평가 작성 화면으로
    });
  } catch (err) {
    if (!handleAuthError(err)) el.innerHTML = `<p class="muted pad">${esc(err.message)}</p>`;   // 오류면 문구 표시 (로그인 풀림이면 로그인 화면으로)
  }
}

load();   // 화면이 열리면 바로 실행
