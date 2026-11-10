// ===================================================================
// mypage.js — 마이페이지(mypage.html) 동작
//  - GET /api/me 로 회원·학교·활동 요약·알레르기·알림 설정을 한 번에 받아 카드로 그림
//  - 학교 변경(PUT /api/me/school), 알림 토글(PATCH /api/me/settings), 로그아웃(POST /api/auth/logout)
//  - 데스크톱은 my-grid로 2열, 모바일은 1열 (CSS)
// ===================================================================
// 마이페이지
const root = document.getElementById('mypage');   // 마이페이지 내용이 그려질 자리

// key: 서버에 보낼 설정 이름, on: 지금 켜짐 여부, title/desc: 제목과 설명
function toggleHtml(key, on, title, desc) {   // 알림 설정 한 줄 (켜기/끄기 스위치) HTML 만들기
  return `
    <div class="toggle-row">
      <div><strong>${title}</strong><span class="muted small">${desc}</span></div>
      <button type="button" class="toggle" role="switch" aria-checked="${on}" aria-label="${title}" data-setting="${key}"><span></span></button>
    </div>`;
}

async function render() {   // 마이페이지 전체 그리기 (학교를 바꾸면 다시 부름)
  let me;
  try {
    me = await api('/api/me');   // 서버에서 내 정보 묶음 받기 (routes/me.js)
  } catch (err) {
    if (!handleAuthError(err)) root.innerHTML = `<p class="muted pad">${esc(err.message)}</p>`;   // 실패하면 오류 문구
    return;
  }
  const { member, school, stats, allergies, settings } = me;   // 받은 데이터를 이름별로 꺼냄 (구조 분해 할당)

  // 왼쪽 열: 프로필 카드 · 내 학교 카드 · 활동 요약 3칸 · 내 알레르기 카드
  // 오른쪽 열: 알림 설정 · 계정 메뉴(내가 쓴 평가, 공지사항, 회원정보 수정, 로그아웃)
  // · member.joinedAt.slice(0, 7).replace('-', '년 ') : '2026-11-09' → '2026-11' → '2026년 11' (+ '월 가입')
  // · /allergy?next=/mypage : 알레르기 저장 후 다시 마이페이지로 돌아오게 함
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

  document.getElementById('change-school').addEventListener('click', () =>   // 학교 변경 버튼 → 학교 검색 창 열기
    openSchoolPicker(async (s) => {   // 학교를 고르면
      try {
        await api('/api/me/school', { method: 'PUT', body: { officeCode: s.officeCode, schoolCode: s.schoolCode } });   // 내 학교로 저장 (routes/school.js)
        toast(`${s.name}(으)로 바꿨어요`);
        document.getElementById('sidebar-school').textContent = s.name;   // 사이드바 학교 이름도 바로 바꿈
        render();   // 마이페이지 다시 그리기
      } catch (err) {
        if (!handleAuthError(err)) toast(err.message, 3000);
      }
    })
  );

  root.querySelectorAll('[data-setting]').forEach((sw) =>   // 알림 토글 스위치들
    sw.addEventListener('click', async () => {
      const next = sw.getAttribute('aria-checked') !== 'true';   // 지금 상태의 반대 (켜짐 → 꺼짐)
      sw.setAttribute('aria-checked', String(next)); // 먼저 바꿔 보여주고   // 화면 먼저 바꾸고 (빠르게 반응하는 느낌)
      try {
        await api('/api/me/settings', { method: 'PATCH', body: { [sw.dataset.setting]: next } });   // 서버에 저장. [sw.dataset.setting] = 'notifyAllergy' 같은 이름을 키로 사용
      } catch (err) {
        sw.setAttribute('aria-checked', String(!next)); // 실패하면 되돌림   // 저장 실패하면 화면도 원래대로
        if (!handleAuthError(err)) toast(err.message, 3000);
      }
    })
  );

  document.getElementById('logout').addEventListener('click', async () => {   // 로그아웃 버튼
    const ok = await confirmDialog({ title: '로그아웃할까요?', confirmText: '로그아웃' });   // 확인 창
    if (!ok) return;
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});   // 서버에 로그아웃 요청 (세션 삭제). 실패해도 그냥 넘어감
    location.href = '/login';   // 로그인 화면으로
  });
}

render();   // 화면이 열리면 바로 실행
