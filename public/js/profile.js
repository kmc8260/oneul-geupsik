// ===================================================================
// profile.js — 회원정보 수정 화면(profile.html) 동작. 폼 3개를 각각 처리
//  ① 이름 변경      → PATCH  /api/me/profile
//  ② 비밀번호 변경  → PUT    /api/me/password  (현재 비밀번호 확인 필요)
//  ③ 회원 탈퇴      → DELETE /api/me           (비밀번호 + 확인 창)
// ===================================================================
// 회원정보 수정: 이름 · 비밀번호 변경 · 탈퇴
const nameForm = document.getElementById('name-form');   // ① 이름 폼
const pwForm = document.getElementById('pw-form');   // ② 비밀번호 폼
const leaveForm = document.getElementById('leave-form');   // ③ 탈퇴 폼
const nameInput = document.getElementById('name');   // 이름 입력칸

window.mePromise.then(({ member }) => {   // layout.js가 받아 둔 내 정보로 입력칸 채우기
  document.getElementById('loginIdView').value = member.loginId;   // 아이디 (보기 전용)
  nameInput.value = member.name;   // 지금 이름
});

async function withBusy(button, busyText, fn) {   // 버튼을 "처리 중" 상태로 바꿔 놓고 fn을 실행한 뒤 원래대로 되돌리는 도우미
  const text = button.textContent;   // 원래 버튼 글자 기억
  button.disabled = true;   // 두 번 누르기 방지
  button.textContent = busyText;
  try { await fn(); } finally { button.disabled = false; button.textContent = text; }   // finally: 성공하든 실패하든 마지막에 꼭 실행 → 버튼 원래대로
}

// ---------- 이름 ----------
nameForm.addEventListener('submit', (e) => {   // 이름 저장 버튼을 누르면
  e.preventDefault();   // 페이지 새로고침 막기
  const name = nameInput.value.trim();   // 앞뒤 공백 뺀 이름
  setFieldMsg('name', '');   // 이전 오류 메시지 지우기
  if (!name) return setFieldMsg('name', '이름을 입력해 주세요.');   // 비어 있으면 오류 표시하고 멈춤
  withBusy(nameForm.querySelector('[type=submit]'), '저장하는 중…', async () => {
    try {
      await api('/api/me/profile', { method: 'PATCH', body: { name } });   // 서버에 이름 변경 요청 (routes/me.js)
      document.getElementById('sidebar-name').textContent = name;   // 사이드바 이름도 바로 바꿈
      document.getElementById('sidebar-avatar').textContent = name.slice(0, 1);   // 사이드바 동그라미 첫 글자도
      toast('이름을 바꿨어요');
    } catch (err) {
      if (!handleAuthError(err)) setFieldMsg('name', err.message);   // 실패하면 이름칸 아래 오류 표시
    }
  });
});

// ---------- 비밀번호 ----------
const pwFields = ['currentPassword', 'newPassword', 'newPasswordConfirm'];   // 비밀번호 폼의 입력칸 id 3개
pwFields.forEach((f) => document.getElementById(f).addEventListener('input', () => setFieldMsg(f, '')));   // 입력하면 그 칸의 오류 메시지 지우기

pwForm.addEventListener('submit', (e) => {   // 비밀번호 변경 버튼을 누르면
  e.preventDefault();
  const v = Object.fromEntries(pwFields.map((f) => [f, document.getElementById(f).value]));   // { currentPassword: '...', newPassword: '...', newPasswordConfirm: '...' } 객체 만들기
  pwFields.forEach((f) => setFieldMsg(f, ''));   // 이전 오류 메시지 모두 지우기
  if (!v.currentPassword) return setFieldMsg('currentPassword', '현재 비밀번호를 입력해 주세요.');   // 현재 비밀번호를 안 넣었으면
  if (v.newPassword.length < 8 || !/[A-Za-z]/.test(v.newPassword) || !/\d/.test(v.newPassword)) {   // 새 비밀번호 규칙: 8자 이상 + 영문 + 숫자 (서버도 같은 규칙으로 한 번 더 검사)
    return setFieldMsg('newPassword', '8자 이상, 영문과 숫자를 모두 넣어 주세요.');
  }
  if (v.newPassword !== v.newPasswordConfirm) return setFieldMsg('newPasswordConfirm', '비밀번호가 서로 달라요.');   // 새 비밀번호 두 칸이 다르면

  withBusy(pwForm.querySelector('[type=submit]'), '바꾸는 중…', async () => {
    try {
      await api('/api/me/password', { method: 'PUT', body: v });   // 서버에 변경 요청 (세 값을 그대로 보냄)
      pwForm.reset();   // 성공하면 입력칸 비우기
      toast('비밀번호를 바꿨어요');
    } catch (err) {
      if (handleAuthError(err)) return;
      const entries = Object.entries(err.errors || {});   // 서버가 칸별 오류를 보냈으면 (예: 현재 비밀번호 틀림)
      if (entries.length) entries.forEach(([f, msg]) => setFieldMsg(f, msg));   // 각 칸 아래에 표시
      else toast(err.message, 3000);   // 아니면 알림으로
    }
  });
});

// ---------- 탈퇴 ----------
leaveForm.addEventListener('submit', async (e) => {   // 탈퇴 버튼을 누르면
  e.preventDefault();
  const password = document.getElementById('leavePassword').value;   // 확인용 비밀번호
  setFieldMsg('leavePassword', '');
  if (!password) return setFieldMsg('leavePassword', '비밀번호를 입력해 주세요.');   // 비어 있으면 멈춤
  const ok = await confirmDialog({   // "정말 탈퇴할까요?" 확인 창 (빨간 버튼)
    title: '정말 탈퇴할까요?',
    message: '내 알레르기 설정과 남긴 평가가 모두 지워지고 되돌릴 수 없어요.',
    confirmText: '탈퇴하기',
    danger: true,
  });
  if (!ok) return;   // 취소하면 멈춤
  try {
    await api('/api/me', { method: 'DELETE', body: { password } });   // 서버에 탈퇴 요청 → member 삭제 (내 알레르기·평가도 CASCADE로 같이 삭제)
    location.href = '/login';   // 로그인 화면으로
  } catch (err) {
    if (!handleAuthError(err)) setFieldMsg('leavePassword', err.message);   // 비밀번호가 틀리면 오류 표시
  }
});
