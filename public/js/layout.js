// ===================================================================
// layout.js — 로그인 후 화면들(메인·평가·마이)의 공통 틀을 자동으로 그려 줌
//  - 데스크톱(1024px 이상): 왼쪽 사이드바 / 모바일: 화면 아래 탭 메뉴 (CSS가 둘 중 하나만 보이게 함)
//  - body의 data-nav 값으로 지금 있는 메뉴를 강조
//  - GET /api/me 로 내 이름·학교를 받아 사이드바 아래에 표시 (window.mePromise로 다른 파일과 공유)
// ===================================================================
// 앱 공통 틀: 모바일 하단 탭 + 데스크톱 왼쪽 사이드바
// 사용법: <body class="app" data-nav="meal|review|my">
(function () {   // (function(){ ... })() = 불러오자마자 바로 한 번 실행되는 함수 (변수가 밖으로 새지 않음)
  const active = document.body.dataset.nav;   // <body data-nav="meal"> 의 값 → 'meal'
  const items = [   // 메뉴 3개: key(구분 이름), label(글자), href(이동 주소), icon(아이콘 이름)
    { key: 'meal', label: '식단', href: '/', icon: 'calendar' },
    { key: 'review', label: '평가', href: '/reviews', icon: 'star' },
    { key: 'my', label: '마이', desktopLabel: '마이페이지', href: '/mypage', icon: 'user' },
  ];
  // · 메뉴 하나를 <a> 링크 글자로 만듦 (desktop이면 아이콘 크기·글자가 조금 다름)
  // · 지금 화면 메뉴면 active 클래스 + aria-current (강조 표시)
  const link = (it, desktop) => `
    <a href="${it.href}" class="nav-item ${it.key === active ? 'active' : ''}" ${it.key === active ? 'aria-current="page"' : ''}>
      ${icon(it.icon, desktop ? 20 : 22)}<span>${desktop && it.desktopLabel ? it.desktopLabel : it.label}</span>
    </a>`;

  const sidebar = document.createElement('nav');   // 데스크톱 왼쪽 사이드바 만들기
  sidebar.className = 'sidebar';
  sidebar.setAttribute('aria-label', '메뉴');
  // · 맨 위 로고 + 앱 이름
  // · 메뉴 3개 링크
  // · 맨 아래 내 정보 (누르면 마이페이지)
  // · 이름 첫 글자가 들어갈 동그라미
  sidebar.innerHTML = `
    <a href="/" class="sidebar-brand"><span class="logo-sm">${icon('calendar', 20)}</span>오늘의 급식</a>
    ${items.map((it) => link(it, true)).join('')}
    <a href="/mypage" class="sidebar-me" id="sidebar-me">
      <span class="avatar sm" id="sidebar-avatar">·</span>
      <span class="sidebar-me-text"><strong id="sidebar-name">&nbsp;</strong><small id="sidebar-school">&nbsp;</small></span>
    </a>`;

  const bottom = document.createElement('nav');   // 모바일 하단 탭 메뉴 만들기
  bottom.className = 'bottom-nav';
  bottom.setAttribute('aria-label', '메뉴');
  bottom.innerHTML = items.map((it) => link(it, false)).join('');

  document.body.prepend(sidebar);   // body 맨 앞에 사이드바 붙이기
  document.body.appendChild(bottom);   // body 맨 뒤에 하단 탭 붙이기

  // 내 정보는 여러 화면에서 쓰므로 한 번만 불러와 공유
  window.mePromise = api('/api/me');   // 요청 결과(Promise)를 저장해 두면 main.js·mypage.js 등이 다시 요청하지 않고 같이 씀
  window.mePromise
    .then(({ member, school }) => {   // 받은 데이터 중 member(회원), school(학교)만 꺼냄
      document.getElementById('sidebar-avatar').textContent = member.name.slice(0, 1);   // 이름 첫 글자 (예: 김민 → 김)
      document.getElementById('sidebar-name').textContent = member.name;
      document.getElementById('sidebar-school').textContent = school ? school.name : '학교 미선택';   // 학교가 없으면 '학교 미선택'
    })
    .catch((err) => handleAuthError(err));   // 로그인이 풀려 있으면 로그인 화면으로
})();
