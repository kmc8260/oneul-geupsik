// ===================================================================
// layout.js — 로그인 후 화면들(메인·평가·마이)의 공통 틀을 자동으로 그려 줌
//  - 데스크톱(1024px 이상): 왼쪽 사이드바 / 모바일: 화면 아래 탭 메뉴 (CSS가 둘 중 하나만 보이게 함)
//  - body의 data-nav 값으로 지금 있는 메뉴를 강조
//  - GET /api/me 로 내 이름·학교를 받아 사이드바 아래에 표시 (window.mePromise로 다른 파일과 공유)
// ===================================================================
// 사용법: <body class="app" data-nav="meal|review|my">
(function () {
  const active = document.body.dataset.nav;
  // 메뉴 3개(식단·평가·마이)를 정하고, 지금 화면(data-nav)의 메뉴를 강조한 링크로 만듦
  const items = [
    { key: 'meal', label: '식단', href: '/', icon: 'calendar' },
    { key: 'review', label: '평가', href: '/reviews', icon: 'star' },
    { key: 'my', label: '마이', desktopLabel: '마이페이지', href: '/mypage', icon: 'user' },
  ];
  const link = (it, desktop) => `
    <a href="${it.href}" class="nav-item ${it.key === active ? 'active' : ''}" ${it.key === active ? 'aria-current="page"' : ''}>
      ${icon(it.icon, desktop ? 20 : 22)}<span>${desktop && it.desktopLabel ? it.desktopLabel : it.label}</span>
    </a>`;

  // 데스크톱용 왼쪽 사이드바와 모바일용 하단 탭을 만들어 화면에 붙임 (CSS가 화면 크기에 따라 하나만 보여줌)
  const sidebar = document.createElement('nav');
  sidebar.className = 'sidebar';
  sidebar.setAttribute('aria-label', '메뉴');
  sidebar.innerHTML = `
    <a href="/" class="sidebar-brand"><span class="logo-sm">${icon('calendar', 20)}</span>오늘의 급식</a>
    ${items.map((it) => link(it, true)).join('')}
    <a href="/mypage" class="sidebar-me" id="sidebar-me">
      <span class="avatar sm" id="sidebar-avatar">·</span>
      <span class="sidebar-me-text"><strong id="sidebar-name">&nbsp;</strong><small id="sidebar-school">&nbsp;</small></span>
    </a>`;

  const bottom = document.createElement('nav');
  bottom.className = 'bottom-nav';
  bottom.setAttribute('aria-label', '메뉴');
  bottom.innerHTML = items.map((it) => link(it, false)).join('');

  document.body.prepend(sidebar);
  document.body.appendChild(bottom);

  // 내 정보는 여러 화면에서 쓰므로 한 번만 불러와 공유
  window.mePromise = api('/api/me');
  window.mePromise
    .then(({ member, school }) => {
      document.getElementById('sidebar-avatar').textContent = member.name.slice(0, 1);
      document.getElementById('sidebar-name').textContent = member.name;
      document.getElementById('sidebar-school').textContent = school ? school.name : '학교 미선택';
    })
    .catch((err) => handleAuthError(err));
})();
