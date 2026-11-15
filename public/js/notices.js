// ===================================================================
// notices.js — 공지사항 화면(notices.html) 동작
//  - GET /api/notices 로 공지를 최신순으로 받아 <details>(누르면 펼쳐지는 상자)로 그림
//  - 첫 번째(가장 최근) 공지만 펼쳐진 상태로 시작
// ===================================================================
const el = document.getElementById('notices');

// 공지 목록을 받아 펼침 상자(<details>)로 그림. 가장 최근 공지만 펼친 상태로 시작
api('/api/notices')
  .then(({ notices }) => {
    if (!notices.length) {
      el.innerHTML = '<p class="muted pad">등록된 공지가 없어요.</p>';
      return;
    }
    el.innerHTML = notices
      .map((n, i) => `
        <details class="notice" ${i === 0 ? 'open' : ''}>
          <summary><strong>${esc(n.title)}</strong><span class="muted small">${esc(n.date.replace(/-/g, '.'))}</span></summary>
          <p>${esc(n.body)}</p>
        </details>`)
      .join('');
  })
  .catch((err) => {
    if (!handleAuthError(err)) el.innerHTML = `<p class="muted pad">${esc(err.message)}</p>`;
  });
