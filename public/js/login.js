// ===================================================================
// login.js — 로그인 화면(login.html) 동작
//  - 아이디·비밀번호를 POST /api/auth/login 으로 보냄
//  - 성공하면 서버가 세션(로그인 상태)을 만들고 쿠키(sid)를 줌 → 메인(/)으로 이동
// ===================================================================
// 화면 요소 가져오기
const form = document.getElementById('login-form');
const formError = document.getElementById('form-error');
const submitBtn = form.querySelector('button[type="submit"]');

// 로그인 버튼: 빈칸 검사 → 서버에 로그인 요청 → 성공하면 메인으로, 실패하면 오류 문구 표시
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';
  const loginId = form.loginId.value.trim();
  const password = form.password.value;

  if (!loginId || !password) {
    formError.textContent = '아이디와 비밀번호를 입력해 주세요.';
    (loginId ? form.password : form.loginId).focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '로그인 중…';
  try {
    await api('/api/auth/login', { method: 'POST', body: { loginId, password } });
    location.href = '/';
  } catch (err) {
    formError.textContent = err.message;
    form.password.value = '';
    form.password.focus();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '로그인';
  }
});
