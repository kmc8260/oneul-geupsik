// ===================================================================
// mypage.js — 마이페이지(mypage.html) 동작
//  - GET /api/me 로 회원·학교·활동 요약·알레르기·알림 설정을 한 번에 받아 카드로 그림
//  - 학교 변경(PUT /api/me/school), 알림 토글(PATCH /api/me/settings), 로그아웃(POST /api/auth/logout)
//  - 데스크톱은 my-grid로 2열, 모바일은 1열 (CSS)
// ===================================================================
const root = document.getElementById('mypage');

// key: 서버에 보낼 설정 이름, on: 지금 켜짐 여부, title/desc: 제목과 설명
function toggleHtml(key, on, title, desc) {
  return `
    <div class="toggle-row">
      <div><strong>${title}</strong><span class="muted small">${desc}</span></div>
      <button type="button" class="toggle" role="switch" aria-checked="${on}" aria-label="${title}" data-setting="${key}"><span></span></button>
    </div>`;
}

// 마이페이지 전체 그리기: /api/me 로 받은 정보로 왼쪽(프로필·학교·활동·알레르기), 오른쪽(알림·메뉴) 카드를 만듦
async function render() {
  let me;
  try {
    me = await api('/api/me');
  } catch (err) {
    if (!handleAuthError(err)) root.innerHTML = `<p class="muted pad">${esc(err.message)}</p>`;
    return;
  }
  const { member, school, stats, allergies, settings } = me;

  // 왼쪽 열: 프로필 카드 · 내 학교 카드 · 활동 요약 3칸 · 내 알레르기 카드
  // 오른쪽 열: 알림 설정 · 계정 메뉴(내가 쓴 평가, 공지사항, 회원정보 수정, 로그아웃)
  root.innerHTML = `
    <div class="my-grid">
      <div class="my-col">
        <section class="card profile-card">
          <span class="avatar">${esc(member.name.slice(0, 1))}</span>
          <div class="grow"><strong class="big">${esc(member.name)}</strong><span class="muted small">${esc(member.role)} · ${esc(member.loginId)} · ${esc(member.joinedAt.slice(0, 7).replace('-', '년 '))}월 가입</span></div>
          <a class="link-btn" href="/profile">수정</a>
        </section>

        <section class="card school-card">
          <span class="school-icon">${icon('school', 22)}</span>
          <div class="grow">
            <span class="muted small">내 학교</span>
            <strong>${school ? esc(school.name) : '아직 선택하지 않았어요'}</strong>
            ${school ? `<span class="muted small">${esc([school.region, school.kind].filter(Boolean).join(' · '))}</span>` : ''}
          </div>
          <button class="btn btn-soft small-btn" type="button" id="change-school">${school ? '변경' : '선택'}</button>
        </section>

        <section class="stat-row">
          <div class="stat card"><strong>${stats.reviewCount}</strong><span>작성한 평가</span></div>
          <div class="stat card"><strong>${stats.avgRating === null ? '-' : fmtNum(stats.avgRating)}</strong><span>평균 별점</span></div>
          <div class="stat card"><strong>${stats.thisMonth}</strong><span>이번 달 평가</span></div>
        </section>

        <section class="card">
          <div class="card-head"><strong>내 알레르기</strong><span class="muted small">${allergies.length ? `${allergies.length}개 등록됨` : '등록 안 함'}</span></div>
          <div class="tags">${allergies.length ? allergies.map((a) => `<span class="tag warn">${esc(a.name)}</span>`).join('') : '<span class="muted small">등록한 알레르기가 없어요</span>'}</div>
          <a class="go-row" href="/allergy?next=/mypage"><span>알레르기 선택하러 가기</span>${icon('chevron', 18)}</a>
        </section>
      </div>

      <div class="my-col">
        <section class="card">
          <strong class="card-title">알림 설정</strong>
          ${toggleHtml('notifyAllergy', settings.notifyAllergy, '내 알레르기 메뉴 알림', '주의할 메뉴가 있는 날 아침에 알려드려요')}
          ${toggleHtml('notifyTomorrow', settings.notifyTomorrow, '내일 식단 미리 보기', '전날 저녁 7시에 다음 날 식단을 알려드려요')}
          <p class="muted tiny">알림 발송은 앱(PWA) 버전에서 지원할 예정이에요. 지금은 설정만 저장돼요.</p>
        </section>

        <nav class="card menu-list" aria-label="계정 메뉴">
          <a href="/reviews"><span>내가 쓴 평가</span><span class="muted">${stats.reviewCount}개 ${icon('chevron', 16)}</span></a>
          <a href="/notices"><span>공지사항</span>${icon('chevron', 16)}</a>
          <a href="/profile"><span>회원정보 수정</span>${icon('chevron', 16)}</a>
          <button type="button" id="logout"><span class="muted">로그아웃</span></button>
        </nav>
      </div>
    </div>`;

  // 학교 변경: 검색 창에서 고르면 저장하고 다시 그림
  document.getElementById('change-school').addEventListener('click', () =>
    openSchoolPicker(async (s) => {
      try {
        await api('/api/me/school', { method: 'PUT', body: { officeCode: s.officeCode, schoolCode: s.schoolCode } });
        toast(`${s.name}(으)로 바꿨어요`);
        document.getElementById('sidebar-school').textContent = s.name;
        render();
      } catch (err) {
        if (!handleAuthError(err)) toast(err.message, 3000);
      }
    })
  );

  // 알림 토글: 화면을 먼저 바꾸고 서버에 저장, 실패하면 원래대로 되돌림
  root.querySelectorAll('[data-setting]').forEach((sw) =>
    sw.addEventListener('click', async () => {
      const next = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(next));
      try {
        await api('/api/me/settings', { method: 'PATCH', body: { [sw.dataset.setting]: next } });
      } catch (err) {
        sw.setAttribute('aria-checked', String(!next));
        if (!handleAuthError(err)) toast(err.message, 3000);
      }
    })
  );

  // 로그아웃: 확인 창 → 서버 세션 삭제 → 로그인 화면
  document.getElementById('logout').addEventListener('click', async () => {
    const ok = await confirmDialog({ title: '로그아웃할까요?', confirmText: '로그아웃' });
    if (!ok) return;
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/login';
  });
}

render();
