// ===================================================================
// school-picker.js — 학교 검색 창 (회원가입·마이페이지·메인에서 사용)
//  - 학교 이름을 입력하고 검색 → GET /api/schools?q=이름 → 서버가 나이스 학교정보 API로 검색
//  - 결과 목록에서 학교를 누르면 onSelect(학교정보)를 불러 줌 (저장은 부른 쪽에서 함)
// ===================================================================
// openSchoolPicker(school => { ... })  : 고르면 school {officeCode, schoolCode, name, kind, region, address} 전달
function openSchoolPicker(onSelect) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="sheet picker" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div class="picker-head">
        <h2 id="picker-title">학교 선택</h2>
        <button type="button" class="icon-btn" data-close aria-label="닫기">${icon('close', 22)}</button>
      </div>
      <form class="picker-search" role="search">
        <input class="input" name="q" placeholder="학교 이름 (예: 미림)" autocomplete="off" maxlength="30" aria-label="학교 이름">
        <button class="btn btn-primary" type="submit">${icon('search', 18)}<span>검색</span></button>
      </form>
      <div class="picker-results" aria-live="polite">
        <p class="picker-hint">학교 이름을 2글자 이상 입력하고 검색해 주세요.</p>
      </div>
    </div>`;

  const form = overlay.querySelector('form');
  const input = form.elements.q;
  const results = overlay.querySelector('.picker-results');
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  // 검색: 2글자 이상이면 서버(나이스)로 검색해서 학교마다 버튼을 만듦. 누르면 창을 닫고 onSelect로 알려줌
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q.length < 2) {
      results.innerHTML = '<p class="picker-hint">학교 이름을 2글자 이상 입력해 주세요.</p>';
      return;
    }
    results.innerHTML = '<p class="picker-hint">나이스에서 찾는 중…</p>';
    try {
      const { schools } = await api(`/api/schools?q=${encodeURIComponent(q)}`);
      if (!schools.length) {
        results.innerHTML = `<p class="picker-hint">"${esc(q)}"(으)로 찾은 학교가 없어요.<br>학교 이름을 다시 확인해 주세요.</p>`;
        return;
      }
      results.innerHTML = '';
      for (const s of schools) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'picker-item';
        btn.innerHTML = `
          <strong>${esc(s.name)}</strong>
          <span>${esc([s.region, s.kind].filter(Boolean).join(' · '))}</span>
          ${s.address ? `<small>${esc(s.address)}</small>` : ''}`;
        btn.addEventListener('click', () => {
          close();
          onSelect(s);
        });
        results.appendChild(btn);
      }
    } catch (err) {
      results.innerHTML = `<p class="picker-hint error">${esc(err.message)}</p>`;
    }
  });

  // 닫기: 바깥 배경 클릭, X 버튼, Esc 키
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-close]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  input.focus();
}
