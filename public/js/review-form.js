// ===================================================================
// review-form.js — 별점 + 한 줄 평 작성 폼 (공통)
//  - 모바일: /review 화면(review.js)에 그림
//  - 데스크톱: 메인 화면에서 팝업(openReviewModal)으로 띄움
//  - 저장: POST /api/reviews → 이미 쓴 평가가 있으면 서버가 알아서 "수정"으로 처리
// ===================================================================
const RATING_WORDS = ['', '별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요'];

/**
 * @param {HTMLElement} el
 * @param {object} d        메뉴 상세 응답 (myReview가 있으면 수정 모드)
 * @param {object} opts     { onDone: () => void, onCancel?: () => void }
 */
// 평가 폼 그리기. 이미 쓴 평가가 있으면 그 별점·의견을 채운 '수정' 모드로 시작
function mountReviewForm(el, d, opts) {
  let rating = d.myReview ? d.myReview.rating : 0;
  const editing = Boolean(d.myReview);

  // 폼 구조: 메뉴 요약 → 별 5개(star-buttons) → 별점 말 → 한 줄 의견 칸(100자) → 글자 수 → 안내 → 버튼
  el.innerHTML = `
    <form class="review-form" novalidate>
      <div class="detail-card menu-summary">
        <strong>${esc(d.name)}</strong>
        <span class="muted">${esc(dateLabel(d.date))} ${esc(d.type)}</span>
      </div>
      <fieldset class="rating-pick">
        <legend>이 메뉴 어떠셨나요?</legend>
        <div class="star-buttons" role="radiogroup" aria-label="별점"></div>
        <p class="rating-word" aria-live="polite"></p>
      </fieldset>
      <div class="field">
        <label for="rv-comment">한 줄 의견 <small class="muted">(선택)</small></label>
        <textarea class="input textarea" id="rv-comment" maxlength="100" rows="4" placeholder="맛, 양, 온도 등 느낀 점을 남겨 주세요">${esc(d.myReview?.comment || '')}</textarea>
        <div class="counter"><span>100자 이내</span><span data-count>0 / 100</span></div>
      </div>
      <p class="note">같은 날 같은 메뉴에는 한 번만 평가할 수 있어요.${editing ? ' 이미 남긴 평가를 고치는 중이에요.' : ''}</p>
      <p class="form-error" role="alert"></p>
      <div class="form-actions">
        ${opts.onCancel ? '<button type="button" class="btn btn-secondary" data-cancel>취소</button>' : ''}
        <button type="submit" class="btn btn-primary">${editing ? '수정하기' : '등록하기'}</button>
      </div>
    </form>`;

  const form = el.querySelector('form');
  const starsWrap = el.querySelector('.star-buttons');
  const word = el.querySelector('.rating-word');
  const textarea = el.querySelector('textarea');
  const count = el.querySelector('[data-count]');
  const errorEl = el.querySelector('.form-error');
  const submit = form.querySelector('[type="submit"]');

  // 별 5개 버튼 그리기: 누르거나 방향키로 별점을 고르면 다시 그림 (키보드·화면 낭독기 지원)
  function drawStars() {
    starsWrap.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'star-btn';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(i === rating));
      b.setAttribute('aria-label', `${i}점 ${RATING_WORDS[i]}`);
      b.tabIndex = i === (rating || 1) ? 0 : -1;
      b.innerHTML = starSvg(i <= rating, 36);
      b.addEventListener('click', () => { rating = i; errorEl.textContent = ''; drawStars(); starsWrap.children[i - 1].focus(); });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); rating = Math.min(5, (rating || 0) + 1); drawStars(); starsWrap.children[rating - 1].focus(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); rating = Math.max(1, (rating || 2) - 1); drawStars(); starsWrap.children[rating - 1].focus(); }
      });
      starsWrap.appendChild(b);
    }
    word.textContent = rating ? `${rating}점 · ${RATING_WORDS[rating]}` : '별을 눌러 점수를 골라 주세요';
    word.classList.toggle('muted', !rating);
  }
  const updateCount = () => { count.textContent = `${textarea.value.length} / 100`; };

  drawStars();
  updateCount();
  textarea.addEventListener('input', updateCount);
  if (opts.onCancel) form.querySelector('[data-cancel]').addEventListener('click', opts.onCancel);

  // 등록: 별점 확인 → POST /api/reviews 로 저장 → 알림 → 저장 후 할 일(onDone)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    if (!rating) {
      errorEl.textContent = '별점을 골라 주세요.';
      starsWrap.children[0].focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = '저장하는 중…';
    try {
      await api('/api/reviews', { method: 'POST', body: { mealId: d.mealId, menuId: d.menuId, rating, comment: textarea.value } });
      toast(editing ? '평가를 고쳤어요' : '평가를 남겼어요');
      opts.onDone();
    } catch (err) {
      if (handleAuthError(err)) return;
      errorEl.textContent = err.message;
      submit.disabled = false;
      submit.textContent = editing ? '수정하기' : '등록하기';
    }
  });
}

// 데스크톱용: 팝업으로 평가 폼 띄우기
function openReviewModal(d, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="sheet modal" role="dialog" aria-modal="true" aria-labelledby="rv-title">
      <div class="picker-head">
        <h2 id="rv-title">${d.myReview ? '평가 수정' : '평가 작성'}</h2>
        <button type="button" class="icon-btn" data-close aria-label="닫기">${icon('close', 22)}</button>
      </div>
      <div class="modal-body"></div>
    </div>`;
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-close]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  mountReviewForm(overlay.querySelector('.modal-body'), d, {
    onDone: () => { close(); onDone(); },
    onCancel: close,
  });
}
