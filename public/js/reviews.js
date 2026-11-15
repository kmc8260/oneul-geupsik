// ===================================================================
// reviews.js — 내가 쓴 평가 목록 화면(reviews.html) 동작
//  - GET /api/reviews/mine 로 내 평가를 최신순으로 받아 카드 목록으로 그림
//  - 카드 누르기 → 메뉴 상세 / 수정 → 평가 작성 화면 / 삭제 → 확인 후 DELETE /api/reviews/:id
// ===================================================================
const listEl = document.getElementById('list');
const countLine = document.getElementById('count-line');

// 내 평가 목록을 받아 카드로 그림 (없으면 안내 화면)
// 삭제 버튼: 확인 창 → DELETE 요청 → 목록 다시 그리기
async function load() {
  try {
    const { reviews } = await api('/api/reviews/mine');
    countLine.textContent = reviews.length ? `${reviews.length}개의 평가를 남겼어요` : '';
    if (!reviews.length) {
      listEl.innerHTML = `
        <div class="empty">
          <span class="empty-icon">${icon('star', 28)}</span>
          <h2>아직 남긴 평가가 없어요</h2>
          <p class="muted">급식을 먹고 메뉴를 눌러 별점과 한 줄 평을 남겨 보세요.</p>
          <a class="btn btn-primary" href="/">식단 보러 가기</a>
        </div>`;
      return;
    }
    // 평가 하나당 카드 하나: 메뉴 이름·날짜·끼니·별점·의견 + 수정/삭제 버튼
    listEl.innerHTML = `<div class="my-review-list">${reviews
      .map((r) => `
        <article class="my-review" data-id="${r.reviewId}">
          <a class="my-review-main" href="/menu?meal=${r.mealId}&menu=${r.menuId}">
            <span class="my-review-head"><strong>${esc(r.menuName)}</strong><span class="muted small">${esc(dateLabel(r.date))} ${esc(r.type)}</span></span>
            ${starsHtml(r.rating, 15)}
            ${r.comment ? `<p>${esc(r.comment)}</p>` : '<p class="muted">별점만 남겼어요</p>'}
          </a>
          <div class="my-review-actions">
            <a class="link-btn" href="/review?meal=${r.mealId}&menu=${r.menuId}&from=reviews">수정</a>
            <button class="link-btn danger" type="button" data-delete="${r.reviewId}" data-name="${esc(r.menuName)}">삭제</button>
          </div>
        </article>`)
      .join('')}</div>`;

    listEl.querySelectorAll('[data-delete]').forEach((b) =>
      b.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: '평가를 삭제할까요?',
          message: `${b.dataset.name}에 남긴 평가가 지워져요.`,
          confirmText: '삭제',
          danger: true,
        });
        if (!ok) return;
        try {
          await api(`/api/reviews/${b.dataset.delete}`, { method: 'DELETE' });
          toast('평가를 삭제했어요');
          load();
        } catch (err) {
          if (!handleAuthError(err)) toast(err.message, 3000);
        }
      })
    );
  } catch (err) {
    if (!handleAuthError(err)) listEl.innerHTML = `<p class="muted pad">${esc(err.message)}</p>`;
  }
}

load();
