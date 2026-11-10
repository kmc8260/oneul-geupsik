// ===================================================================
// school-picker.js — 학교 검색 창 (회원가입·마이페이지·메인에서 사용)
//  - 학교 이름을 입력하고 검색 → GET /api/schools?q=이름 → 서버가 나이스 학교정보 API로 검색
//  - 결과 목록에서 학교를 누르면 onSelect(학교정보)를 불러 줌 (저장은 부른 쪽에서 함)
// ===================================================================
// 학교 검색 창 (나이스 학교 정보 검색)
// openSchoolPicker(school => { ... })  : 고르면 school {officeCode, schoolCode, name, kind, region, address} 전달
function openSchoolPicker(onSelect) {   // onSelect = 학교를 골랐을 때 실행할 함수 (부르는 쪽에서 넘겨줌)
  const overlay = document.createElement('div');   // 화면을 덮는 반투명 배경 + 그 위의 창
  overlay.className = 'overlay';
  // · 창 제목 + 닫기(X) 버튼
  // · 검색 입력칸 + 검색 버튼
  // · 검색 결과가 그려질 자리 (aria-live: 바뀌면 화면 낭독기가 읽음)
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

  const form = overlay.querySelector('form');   // 검색 폼
  const input = form.elements.q;   // name="q" 인 입력칸
  const results = overlay.querySelector('.picker-results');   // 결과 자리
  const close = () => {   // 창 닫기 = 화면에서 지우고 키보드 감시도 끝냄
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };   // Esc 키로 닫기

  form.addEventListener('submit', async (e) => {   // 검색 버튼(또는 엔터)을 누르면
    e.preventDefault();   // 폼 기본 동작(페이지 새로고침) 막기
    const q = input.value.trim();   // 앞뒤 공백 뺀 검색어
    if (q.length < 2) {   // 2글자 미만이면 검색하지 않음 (서버도 같은 규칙으로 막음)
      results.innerHTML = '<p class="picker-hint">학교 이름을 2글자 이상 입력해 주세요.</p>';
      return;
    }
    results.innerHTML = '<p class="picker-hint">나이스에서 찾는 중…</p>';   // 기다리는 동안 보일 문구
    try {
      const { schools } = await api(`/api/schools?q=${encodeURIComponent(q)}`);   // encodeURIComponent: 한글·특수문자를 주소에 넣을 수 있게 바꿈
      if (!schools.length) {   // 결과가 0개면
        results.innerHTML = `<p class="picker-hint">"${esc(q)}"(으)로 찾은 학교가 없어요.<br>학교 이름을 다시 확인해 주세요.</p>`;
        return;
      }
      results.innerHTML = '';   // 이전 결과 지우기
      for (const s of schools) {   // 학교마다 버튼 하나씩 만들기
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'picker-item';
        // · 학교 이름 (esc로 안전하게)
        // · 지역 · 학교 종류 (값이 있는 것만 · 로 이어 붙임)
        btn.innerHTML = `
          <strong>${esc(s.name)}</strong>
          <span>${esc([s.region, s.kind].filter(Boolean).join(' · '))}</span>
          ${s.address ? `<small>${esc(s.address)}</small>` : ''}`;   // 주소가 있으면 작게 표시
        btn.addEventListener('click', () => {   // 학교를 누르면 창을 닫고 부른 쪽에 알려줌
          close();
          onSelect(s);
        });
        results.appendChild(btn);
      }
    } catch (err) {   // 나이스 연결 실패 등 오류면 빨간 문구로 표시
      results.innerHTML = `<p class="picker-hint error">${esc(err.message)}</p>`;
    }
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });   // 바깥 배경 누르면 닫기
  overlay.querySelector('[data-close]').addEventListener('click', close);   // X 버튼 누르면 닫기
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);   // 화면에 붙여서 보이게
  input.focus();   // 바로 입력할 수 있게 커서를 검색칸에
}
