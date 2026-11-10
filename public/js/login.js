// ===================================================================
// login.js — 로그인 화면(login.html) 동작
//  - 아이디·비밀번호를 POST /api/auth/login 으로 보냄
//  - 성공하면 서버가 세션(로그인 상태)을 만들고 쿠키(sid)를 줌 → 메인(/)으로 이동
// ===================================================================
const form = document.getElementById('login-form');   // 로그인 폼
const formError = document.getElementById('form-error');   // 오류 문구 자리
const submitBtn = form.querySelector('button[type="submit"]');   // 로그인 버튼

form.addEventListener('submit', async (e) => {   // 로그인 버튼(또는 엔터)을 누르면
  e.preventDefault();   // 폼 기본 동작(페이지 새로고침) 막기
  formError.textContent = '';   // 이전 오류 지우기
  const loginId = form.loginId.value.trim();   // name="loginId" 입력칸 값 (앞뒤 공백 제거)
  const password = form.password.value;   // 비밀번호는 공백도 글자일 수 있어서 그대로

  if (!loginId || !password) {   // 둘 중 하나라도 비었으면
    formError.textContent = '아이디와 비밀번호를 입력해 주세요.';
    (loginId ? form.password : form.loginId).focus();   // 비어 있는 칸으로 커서 이동
    return;
  }

  submitBtn.disabled = true;   // 기다리는 동안 버튼 잠그기
  submitBtn.textContent = '로그인 중…';
  try {
    await api('/api/auth/login', { method: 'POST', body: { loginId, password } });   // 서버에 로그인 요청 (routes/auth.js — bcrypt로 비밀번호 비교)
    location.href = '/';   // 성공 → 메인 화면
  } catch (err) {
    formError.textContent = err.message;   // 실패 → "아이디 또는 비밀번호가 맞지 않아요" 등 서버 문구 표시
    form.password.value = '';   // 비밀번호 칸 비우고
    form.password.focus();   // 다시 입력하게 커서 이동
  } finally {   // 성공이든 실패든 버튼 원래대로
    submitBtn.disabled = false;
    submitBtn.textContent = '로그인';
  }
});
