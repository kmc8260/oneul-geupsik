// ===================================================================
// profile.js — 회원정보 수정 화면(profile.html) 동작. 폼 3개를 각각 처리
//  ① 이름 변경      → PATCH  /api/me/profile
//  ② 비밀번호 변경  → PUT    /api/me/password  (현재 비밀번호 확인 필요)
//  ③ 회원 탈퇴      → DELETE /api/me           (비밀번호 + 확인 창)
// ===================================================================
// 폼 3개와 이름 칸 가져오기, 내 정보로 아이디·이름 칸 채우기
const nameForm = document.getElementById('name-form');
const pwForm = document.getElementById('pw-form');
const leaveForm = document.getElementById('leave-form');
const nameInput = document.getElementById('name');

window.mePromise.then(({ member }) => {
  document.getElementById('loginIdView').value = member.loginId;
  nameInput.value = member.name;
});

// 버튼을 '처리 중'으로 잠갔다가 작업이 끝나면 원래대로 되돌리는 도우미 (두 번 누르기 방지)
async function withBusy(button, busyText, fn) {
  const text = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  try { await fn(); } finally { button.disabled = false; button.textContent = text; }
}

// ---------- 이름 ----------
nameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  setFieldMsg('name', '');
  if (!name) return setFieldMsg('name', '이름을 입력해 주세요.');
  withBusy(nameForm.querySelector('[type=submit]'), '저장하는 중…', async () => {
    try {
      await api('/api/me/profile', { method: 'PATCH', body: { name } });
      document.getElementById('sidebar-name').textContent = name;
      document.getElementById('sidebar-avatar').textContent = name.slice(0, 1);
      toast('이름을 바꿨어요');
    } catch (err) {
      if (!handleAuthError(err)) setFieldMsg('name', err.message);
    }
  });
});

// ---------- 비밀번호 ----------
const pwFields = ['currentPassword', 'newPassword', 'newPasswordConfirm'];
pwFields.forEach((f) => document.getElementById(f).addEventListener('input', () => setFieldMsg(f, '')));

pwForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = Object.fromEntries(pwFields.map((f) => [f, document.getElementById(f).value]));
  pwFields.forEach((f) => setFieldMsg(f, ''));
  if (!v.currentPassword) return setFieldMsg('currentPassword', '현재 비밀번호를 입력해 주세요.');
  if (v.newPassword.length < 8 || !/[A-Za-z]/.test(v.newPassword) || !/\d/.test(v.newPassword)) {
    return setFieldMsg('newPassword', '8자 이상, 영문과 숫자를 모두 넣어 주세요.');
  }
  if (v.newPassword !== v.newPasswordConfirm) return setFieldMsg('newPasswordConfirm', '비밀번호가 서로 달라요.');

  withBusy(pwForm.querySelector('[type=submit]'), '바꾸는 중…', async () => {
    try {
      await api('/api/me/password', { method: 'PUT', body: v });
      pwForm.reset();
      toast('비밀번호를 바꿨어요');
    } catch (err) {
      if (handleAuthError(err)) return;
      const entries = Object.entries(err.errors || {});
      if (entries.length) entries.forEach(([f, msg]) => setFieldMsg(f, msg));
      else toast(err.message, 3000);
    }
  });
});

// ---------- 탈퇴 ----------
leaveForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('leavePassword').value;
  setFieldMsg('leavePassword', '');
  if (!password) return setFieldMsg('leavePassword', '비밀번호를 입력해 주세요.');
  const ok = await confirmDialog({
    title: '정말 탈퇴할까요?',
    message: '내 알레르기 설정과 남긴 평가가 모두 지워지고 되돌릴 수 없어요.',
    confirmText: '탈퇴하기',
    danger: true,
  });
  if (!ok) return;
  try {
    await api('/api/me', { method: 'DELETE', body: { password } });
    location.href = '/login';
  } catch (err) {
    if (!handleAuthError(err)) setFieldMsg('leavePassword', err.message);
  }
});
