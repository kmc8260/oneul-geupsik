// ===================================================================
// menu-detail.js — 메뉴 상세 화면을 그리는 "공통 그리기 함수"
//  - 모바일: /menu 화면(menu.js)에서 화면 전체로 그림
//  - 데스크톱: 메인 화면(main.js) 오른쪽 패널에 그림
//  - 보여주는 것: 날짜·끼니, 메뉴 이름, 평균 별점, 내 알레르기 경고(빨간 상자),
//    영양 정보, 알레르기 유발 식품 목록, 한 줄 평 목록, 평가 버튼
// ===================================================================
// 메뉴 상세 그리기 (모바일 /menu 화면과 데스크톱 메인 오른쪽 패널에서 함께 사용)

function fetchMenuDetail(mealId, menuId) {   // 서버에서 메뉴 상세 정보 받아오기 (routes/meal.js의 GET /api/meals/:mealId/menus/:menuId)
  return api(`/api/meals/${Number(mealId)}/menus/${Number(menuId)}`);   // Number(): 숫자로 바꿔서 주소에 이상한 글자가 들어가지 않게
}

/**
 * @param {HTMLElement} el     그릴 곳
 * @param {object} d           /api/meals/:mealId/menus/:menuId 응답
 * @param {object} opts        { onReview: () => void }  평가 버튼을 눌렀을 때
 */
function renderMenuDetail(el, d, opts = {}) {   // el = 그릴 위치, d = 서버 응답, opts.onReview = 평가 버튼을 눌렀을 때 할 일
  const mine = d.allergies.filter((a) => a.mine);   // 이 메뉴 알레르기 중 "내 알레르기"인 것만 (mine = true)
  const n = d.nutrition;   // 영양 정보 { calories, carbs, protein, fat }

  const ratingLine = d.reviewCount   // 별점 줄: 평가가 있으면 "★ 4.3 12명 평가", 없으면 안내 문구
    ? `${starSvg(true, 18)}<strong>${fmtNum(d.avgRating)}</strong><span>${d.reviewCount}명 평가</span>`
    : '<span>아직 평가가 없어요</span>';

  const warning = mine.length   // 내 알레르기가 들어 있으면 빨간 경고 상자, 없으면 빈 글자
    ? `<div class="alert-box">
         <strong>내 알레르기 주의 · ${esc(mine.map((a) => a.name).join(', '))}</strong>
         <span>급식표에 내 알레르기 번호(${esc(mine.map((a) => a.markNo).join(', '))}번)가 표시된 메뉴예요. 꼭 확인하세요.</span>
       </div>`
    : '';

  const allergyList = d.allergies.length   // 알레르기 유발 식품 목록 (내 알레르기면 빨간 태그 warn)
    ? `<div class="detail-card allergy-rows">${d.allergies
        .map((a) => `<div class="allergy-row"><span class="tag ${a.mine ? 'warn' : ''}">${esc(a.name)}</span><span>급식표 ${a.markNo}번${a.mine ? ' · 내 알레르기' : ''}</span></div>`)
        .join('')}</div>`
    : '<p class="muted">급식표에 표시된 알레르기 유발 식품이 없어요.</p>';

  const reviews = d.reviews.length   // 한 줄 평 카드 목록 (작성자 이름은 서버에서 홍*동 처럼 가려서 옴)
    ? d.reviews
        // · · ${esc(...)}: 사용자가 쓴 글은 반드시 esc()로 감싸서 태그가 실행되지 않게 함 / r.date.slice(5): '2026-11-09' → '11-09' → '11/09'
        .map((r) => `
          <article class="review-card">
            <div class="review-top">${starsHtml(r.rating)}<span>${esc(r.writer)}${r.mine ? ' <b class="mine-badge">내 평가</b>' : ''} · ${esc(r.date.slice(5).replace('-', '/'))}</span></div>
            ${r.comment ? `<p>${esc(r.comment)}</p>` : '<p class="muted">별점만 남겼어요</p>'}
          </article>`)
        .join('')
    : '<p class="muted">첫 번째로 평가를 남겨 보세요.</p>';

  let action;   // 아래쪽 버튼: 상황에 따라 3가지 중 하나
  if (!d.canReview) action = '<button class="btn btn-primary btn-block" disabled>아직 제공되지 않은 급식이에요</button>';   // 미래 급식 → 누를 수 없는 버튼
  else if (d.myReview) action = '<button class="btn btn-secondary btn-block" data-review>내 평가 수정하기</button>';   // 이미 평가했으면 → 수정 버튼
  else action = '<button class="btn btn-primary btn-block" data-review>평가 남기기</button>';   // 아직 안 했으면 → 평가 남기기

  // 화면 구조: detail-head(날짜·이름·별점) → 경고 → 영양 정보 4칸 → 알레르기 목록 → 한 줄 평 → 버튼
  // · 위에서 만든 조각들을 모아 화면에 한 번에 그림
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

  const btn = el.querySelector('[data-review]');   // data-review 속성이 있는 버튼 (평가 버튼) 찾기
  if (btn && opts.onReview) btn.addEventListener('click', opts.onReview);   // 버튼이 있고 할 일이 넘어왔으면 클릭할 때 실행
}
