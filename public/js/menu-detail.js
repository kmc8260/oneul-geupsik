// ===================================================================
// menu-detail.js — 메뉴 상세 화면을 그리는 "공통 그리기 함수"
//  - 모바일: /menu 화면(menu.js)에서 화면 전체로 그림
//  - 데스크톱: 메인 화면(main.js) 오른쪽 패널에 그림
//  - 보여주는 것: 날짜·끼니, 메뉴 이름, 평균 별점, 내 알레르기 경고(빨간 상자),
//    영양 정보, 알레르기 유발 식품 목록, 한 줄 평 목록, 평가 버튼
// ===================================================================

// 서버에서 메뉴 상세(알레르기·영양·별점·한 줄 평·내 평가) 받기
function fetchMenuDetail(mealId, menuId) {
  return api(`/api/meals/${Number(mealId)}/menus/${Number(menuId)}`);
}

/**
 * @param {HTMLElement} el     그릴 곳
 * @param {object} d           /api/meals/:mealId/menus/:menuId 응답
 * @param {object} opts        { onReview: () => void }  평가 버튼을 눌렀을 때
 */
// 받은 상세를 화면에 그리기: 별점 줄·알레르기 경고·알레르기 목록·한 줄 평·버튼을 조각으로 만든 뒤 한 번에 넣음
// 평가 버튼은 상황에 따라 '평가 남기기' / '내 평가 수정하기' / '아직 제공되지 않은 급식' 중 하나
function renderMenuDetail(el, d, opts = {}) {
  const mine = d.allergies.filter((a) => a.mine);
  const n = d.nutrition;

  const ratingLine = d.reviewCount
    ? `${starSvg(true, 18)}<strong>${fmtNum(d.avgRating)}</strong><span>${d.reviewCount}명 평가</span>`
    : '<span>아직 평가가 없어요</span>';

  const warning = mine.length
    ? `<div class="alert-box">
         <strong>내 알레르기 주의 · ${esc(mine.map((a) => a.name).join(', '))}</strong>
         <span>급식표에 내 알레르기 번호(${esc(mine.map((a) => a.markNo).join(', '))}번)가 표시된 메뉴예요. 꼭 확인하세요.</span>
       </div>`
    : '';

  const allergyList = d.allergies.length
    ? `<div class="detail-card allergy-rows">${d.allergies
        .map((a) => `<div class="allergy-row"><span class="tag ${a.mine ? 'warn' : ''}">${esc(a.name)}</span><span>급식표 ${a.markNo}번${a.mine ? ' · 내 알레르기' : ''}</span></div>`)
        .join('')}</div>`
    : '<p class="muted">급식표에 표시된 알레르기 유발 식품이 없어요.</p>';

  const reviews = d.reviews.length
    ? d.reviews
        .map((r) => `
          <article class="review-card">
            <div class="review-top">${starsHtml(r.rating)}<span>${esc(r.writer)}${r.mine ? ' <b class="mine-badge">내 평가</b>' : ''} · ${esc(r.date.slice(5).replace('-', '/'))}</span></div>
            ${r.comment ? `<p>${esc(r.comment)}</p>` : '<p class="muted">별점만 남겼어요</p>'}
          </article>`)
        .join('')
    : '<p class="muted">첫 번째로 평가를 남겨 보세요.</p>';

  let action;
  if (!d.canReview) action = '<button class="btn btn-primary btn-block" disabled>아직 제공되지 않은 급식이에요</button>';
  else if (d.myReview) action = '<button class="btn btn-secondary btn-block" data-review>내 평가 수정하기</button>';
  else action = '<button class="btn btn-primary btn-block" data-review>평가 남기기</button>';

  // 화면 구조: detail-head(날짜·이름·별점) → 경고 → 영양 정보 4칸 → 알레르기 목록 → 한 줄 평 → 버튼
  el.innerHTML = `
    <div class="detail">
      <header class="detail-head">
        <p class="muted">${esc(dateLabel(d.date))} ${esc(d.type)}</p>
        <h1>${esc(d.name)}</h1>
        <div class="rating-line">${ratingLine}</div>
      </header>
      ${warning}
      <section>
        <h2 class="section-title">영양 정보 <small>이 끼니 전체 기준</small></h2>
        <div class="stat-row">
          <div class="stat"><strong>${fmtNum(n.calories)}</strong><span>열량 kcal</span></div>
          <div class="stat"><strong>${fmtNum(n.carbs)}g</strong><span>탄수화물</span></div>
          <div class="stat"><strong>${fmtNum(n.protein)}g</strong><span>단백질</span></div>
          <div class="stat"><strong>${fmtNum(n.fat)}g</strong><span>지방</span></div>
        </div>
      </section>
      <section>
        <h2 class="section-title">알레르기 유발 식품</h2>
        ${allergyList}
      </section>
      <section>
        <h2 class="section-title">한 줄 평 <small>${d.reviewCount ? `${d.reviewCount}개` : ''}</small></h2>
        <div class="review-list">${reviews}</div>
      </section>
      <div class="detail-action">${action}</div>
    </div>`;

  const btn = el.querySelector('[data-review]');
  if (btn && opts.onReview) btn.addEventListener('click', opts.onReview);
}
