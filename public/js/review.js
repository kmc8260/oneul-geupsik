// ===================================================================
// review.js — 평가 작성 화면(review.html, 주로 모바일) 동작
//  - 주소 /review?meal=12&menu=4 (&from=reviews) 에서 번호를 읽음
//  - 메뉴 상세를 받아 review-form.js의 mountReviewForm()으로 폼을 그림
//  - 저장이 끝나면 들어왔던 화면(메뉴 상세 또는 내 평가 목록)으로 돌아감
// ===================================================================
// 주소에서 번호 읽기, 저장 후 돌아갈 화면 정하기 (내 평가 목록에서 왔으면 목록으로)
const params = new URLSearchParams(location.search);
const mealId = Number(params.get('meal'));
const menuId = Number(params.get('menu'));
const from = params.get('from');
const el = document.getElementById('form-area');
const backTo = from === 'reviews' ? '/reviews' : `/menu?meal=${mealId}&menu=${menuId}`;
document.getElementById('back').href = backTo;

// 메뉴 상세를 받아 평가 폼을 그림. 미래 급식이면 평가 불가 안내
async function load() {
  try {
    const d = await fetchMenuDetail(mealId, menuId);
    if (!d.canReview) {
      el.innerHTML = '<div class="empty"><p>아직 제공되지 않은 급식은 평가할 수 없어요.</p></div>';
      return;
    }
    document.querySelector('#back span').textContent = d.myReview ? '평가 수정' : '평가 작성';
    mountReviewForm(el, d, {
      // 들어온 화면으로 되돌아감 (기록에 같은 화면이 두 번 쌓이지 않게)
      onDone: () => setTimeout(() => {
        if (document.referrer.startsWith(location.origin) && history.length > 1) history.back();
        else location.replace(backTo);
      }, 600),
      onCancel: matchMedia('(min-width: 1024px)').matches ? () => location.assign(backTo) : null,
    });
  } catch (err) {
    if (!handleAuthError(err)) el.innerHTML = `<p class="muted pad">${esc(err.message)}</p>`;
  }
}

load();
