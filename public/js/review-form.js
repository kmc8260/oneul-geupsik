// ===================================================================
// review-form.js — 별점 + 한 줄 평 작성 폼 (공통)
//  - 모바일: /review 화면(review.js)에 그림
//  - 데스크톱: 메인 화면에서 팝업(openReviewModal)으로 띄움
//  - 저장: POST /api/reviews → 이미 쓴 평가가 있으면 서버가 알아서 "수정"으로 처리
// ===================================================================
// 평가 작성 폼 (모바일 /review 화면과 데스크톱 팝업에서 함께 사용)
const RATING_WORDS = ['', '별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요'];   // 별점 숫자 → 말 (0번은 비워 둠: 1점 = 별로예요 … 5점 = 최고예요)

/**
 * @param {HTMLElement} el
 * @param {object} d        메뉴 상세 응답 (myReview가 있으면 수정 모드)
 * @param {object} opts     { onDone: () => void, onCancel?: () => void }
 */
function mountReviewForm(el, d, opts) {   // el = 그릴 곳, d = 메뉴 상세 응답, opts.onDone = 저장 후 할 일, opts.onCancel = 취소 버튼 동작(있을 때만)
  let rating = d.myReview ? d.myReview.rating : 0;   // 지금 고른 별점 (수정 모드면 예전 별점부터 시작, 새로 쓰면 0 = 아직 안 고름)
  const editing = Boolean(d.myReview);   // 이미 쓴 평가가 있으면 수정 모드

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

  const form = el.querySelector('form');   // 위에서 그린 요소들을 변수로 잡아 둠
  const starsWrap = el.querySelector('.star-buttons');
  const word = el.querySelector('.rating-word');
  const textarea = el.querySelector('textarea');
  const count = el.querySelector('[data-count]');
  const errorEl = el.querySelector('.form-error');
  const submit = form.querySelector('[type="submit"]');

  function drawStars() {   // 별 5개 버튼을 (다시) 그리는 함수 — 별점이 바뀔 때마다 부름
    starsWrap.innerHTML = '';   // 기존 별 지우기
    for (let i = 1; i <= 5; i++) {   // 1점 ~ 5점 버튼
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'star-btn';
      b.setAttribute('role', 'radio');   // 키보드·화면 낭독기용: 라디오 버튼처럼 "하나만 고르는" 버튼임을 알림
      b.setAttribute('aria-checked', String(i === rating));   // 지금 고른 별인지
      b.setAttribute('aria-label', `${i}점 ${RATING_WORDS[i]}`);
      b.tabIndex = i === (rating || 1) ? 0 : -1;   // Tab 키로는 고른 별(없으면 1번 별)에만 들어감 (roving tabindex)
      b.innerHTML = starSvg(i <= rating, 36);   // 고른 점수 이하의 별은 노란색
      b.addEventListener('click', () => { rating = i; errorEl.textContent = ''; drawStars(); starsWrap.children[i - 1].focus(); });   // 별을 누르면 그 점수로 바꾸고 다시 그림
      b.addEventListener('keydown', (e) => {   // 방향키로도 별점 조절 (→↑ 올리기, ←↓ 내리기)
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); rating = Math.min(5, (rating || 0) + 1); drawStars(); starsWrap.children[rating - 1].focus(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); rating = Math.max(1, (rating || 2) - 1); drawStars(); starsWrap.children[rating - 1].focus(); }
      });
      starsWrap.appendChild(b);
    }
    word.textContent = rating ? `${rating}점 · ${RATING_WORDS[rating]}` : '별을 눌러 점수를 골라 주세요';   // 별점 아래 문구 ("4점 · 좋아요")
    word.classList.toggle('muted', !rating);   // 아직 안 골랐으면 회색 글씨
  }
  const updateCount = () => { count.textContent = `${textarea.value.length} / 100`; };   // 글자 수 표시 "23 / 100"

  drawStars();   // 처음 한 번 그리기
  updateCount();
  textarea.addEventListener('input', updateCount);   // 글자를 입력할 때마다 글자 수 갱신
  if (opts.onCancel) form.querySelector('[data-cancel]').addEventListener('click', opts.onCancel);   // 취소 버튼이 있으면 연결

  form.addEventListener('submit', async (e) => {   // 등록/수정 버튼을 누르면
    e.preventDefault();   // 페이지 새로고침 막기
    errorEl.textContent = '';
    if (!rating) {   // 별점을 안 골랐으면 막고 첫 번째 별로 초점 이동
      errorEl.textContent = '별점을 골라 주세요.';
      starsWrap.children[0].focus();
      return;
    }
    submit.disabled = true;   // 두 번 눌러 두 번 저장되지 않게 버튼 잠그기
    submit.textContent = '저장하는 중…';
    try {
      await api('/api/reviews', { method: 'POST', body: { mealId: d.mealId, menuId: d.menuId, rating, comment: textarea.value } });   // 서버에 저장 (routes/review.js) — 메뉴 번호·별점·의견을 보냄
      toast(editing ? '평가를 고쳤어요' : '평가를 남겼어요');   // 성공 알림
      opts.onDone();   // 저장 후 할 일 (모바일: 이전 화면으로, 데스크톱: 팝업 닫고 새로고침)
    } catch (err) {
      if (handleAuthError(err)) return;   // 로그인이 풀렸으면 로그인 화면으로
      errorEl.textContent = err.message;   // 서버가 보낸 오류 문구 표시
      submit.disabled = false;   // 다시 누를 수 있게 버튼 풀기
      submit.textContent = editing ? '수정하기' : '등록하기';
    }
  });
}

// 데스크톱용: 팝업으로 평가 폼 띄우기
function openReviewModal(d, onDone) {   // 데스크톱 전용: 화면 가운데 팝업으로 폼을 띄움. onDone = 저장 후 할 일
  const overlay = document.createElement('div');   // 반투명 배경 + 팝업 창
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="sheet modal" role="dialog" aria-modal="true" aria-labelledby="rv-title">
      <div class="picker-head">
        <h2 id="rv-title">${d.myReview ? '평가 수정' : '평가 작성'}</h2>
        <button type="button" class="icon-btn" data-close aria-label="닫기">${icon('close', 22)}</button>
      </div>
      <div class="modal-body"></div>
    </div>`;
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };   // 팝업 닫기
  const onKey = (e) => { if (e.key === 'Escape') close(); };   // Esc 키로 닫기
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });   // 바깥 배경을 누르면 닫기
  overlay.querySelector('[data-close]').addEventListener('click', close);   // X 버튼
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);   // 화면에 붙이기
  mountReviewForm(overlay.querySelector('.modal-body'), d, {   // 팝업 안쪽(.modal-body)에 공통 폼을 그림
    onDone: () => { close(); onDone(); },   // 저장하면 팝업을 닫고 메인 화면 새로 불러오기
    onCancel: close,   // 취소하면 팝업만 닫기
  });
}
