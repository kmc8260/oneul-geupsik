// ===================================================================
// notices.js — 공지사항 화면(notices.html) 동작
//  - GET /api/notices 로 공지를 최신순으로 받아 <details>(누르면 펼쳐지는 상자)로 그림
//  - 첫 번째(가장 최근) 공지만 펼쳐진 상태로 시작
// ===================================================================
// 공지사항
const el = document.getElementById('notices');   // 공지 목록이 그려질 자리

api('/api/notices')   // 서버에 공지 목록 요청 (routes/notice.js)
  .then(({ notices }) => {   // 받으면 notices 배열을 꺼내서
    if (!notices.length) {   // 공지가 없으면 안내 문구
      el.innerHTML = '<p class="muted pad">등록된 공지가 없어요.</p>';
      return;
    }
    // · i === 0 ? 'open' : 첫 번째 공지는 펼친 상태 / n.date.replace(/-/g, '.') : 2026-11-02 → 2026.11.02
    el.innerHTML = notices   // 공지마다 펼침 상자 하나씩
      .map((n, i) => `
        <details class="notice" ${i === 0 ? 'open' : ''}>
          <summary><strong>${esc(n.title)}</strong><span class="muted small">${esc(n.date.replace(/-/g, '.'))}</span></summary>
          <p>${esc(n.body)}</p>
        </details>`)
      .join('');   // 배열을 한 덩어리 글자로 이어 붙임
  })
  .catch((err) => {   // 실패하면 오류 문구
    if (!handleAuthError(err)) el.innerHTML = `<p class="muted pad">${esc(err.message)}</p>`;
  });
