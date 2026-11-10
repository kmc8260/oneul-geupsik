// ===================================================================
// review.js — 평가 작성 화면(review.html, 주로 모바일) 동작
//  - 주소 /review?meal=12&menu=4 (&from=reviews) 에서 번호를 읽음
//  - 메뉴 상세를 받아 review-form.js의 mountReviewForm()으로 폼을 그림
//  - 저장이 끝나면 들어왔던 화면(메뉴 상세 또는 내 평가 목록)으로 돌아감
// ===================================================================
// 평가 작성 화면
const params = new URLSearchParams(location.search);   // 주소의 ? 뒤 값들
const mealId = Number(params.get('meal'));   // 식단 번호
const menuId = Number(params.get('menu'));   // 메뉴 번호
const from = params.get('from'); // 'reviews'면 내 평가 목록에서 들어온 것
const el = document.getElementById('form-area');   // 폼이 그려질 자리
const backTo = from === 'reviews' ? '/reviews' : `/menu?meal=${mealId}&menu=${menuId}`;   // 돌아갈 주소: 내 평가 목록에서 왔으면 /reviews, 아니면 그 메뉴 상세
document.getElementById('back').href = backTo;   // 뒤로 가기 링크 주소 설정

async function load() {
  try {
    const d = await fetchMenuDetail(mealId, menuId);   // 메뉴 상세 정보 (메뉴 이름·날짜·내 기존 평가) 받기
    if (!d.canReview) {   // 미래 급식이면 평가 불가 안내
      el.innerHTML = '<div class="empty"><p>아직 제공되지 않은 급식은 평가할 수 없어요.</p></div>';
      return;
    }
    document.querySelector('#back span').textContent = d.myReview ? '평가 수정' : '평가 작성';   // 이미 평가했으면 제목을 "평가 수정"으로
    mountReviewForm(el, d, {   // 폼 그리기 (공통 함수)
      // 들어온 화면으로 되돌아감 (기록에 같은 화면이 두 번 쌓이지 않게)
      onDone: () => setTimeout(() => {   // 저장 0.6초 뒤(알림을 볼 시간) 이전 화면으로
        if (document.referrer.startsWith(location.origin) && history.length > 1) history.back();   // 기록이 있으면 뒤로 가기
        else location.replace(backTo);   // 없으면 돌아갈 주소로 이동 (replace: 지금 화면을 기록에서 지움)
      }, 600),
      onCancel: matchMedia('(min-width: 1024px)').matches ? () => location.assign(backTo) : null,   // 데스크톱 너비에서만 취소 버튼 보이기 (모바일은 상단 뒤로 가기 사용)
    });
  } catch (err) {
    if (!handleAuthError(err)) el.innerHTML = `<p class="muted pad">${esc(err.message)}</p>`;   // 오류 문구 표시
  }
}

load();   // 화면이 열리면 바로 실행
