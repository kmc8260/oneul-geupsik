// ===================================================================
// signup.js — 회원가입 화면(signup.html) 동작
//  1) 학교 선택: school-picker.js 검색 창으로 나이스에서 학교를 고름
//  2) 아이디 중복 확인: GET /api/auth/check-id?loginId=...
//  3) 입력값 검사(서버와 같은 규칙) → POST /api/auth/signup → 성공하면 /welcome
// ===================================================================
// 화면 요소와 상태 (중복 확인을 통과한 아이디, 고른 학교)
const form = document.getElementById('signup-form');
const formError = document.getElementById('form-error');
const submitBtn = form.querySelector('button[type="submit"]');
const checkBtn = document.getElementById('check-id');
// form.name은 폼 자체의 name 속성과 겹치므로 입력칸은 elements로 가져옴
const field = (name) => form.elements.namedItem(name);

const LOGIN_ID_RULE = /^[A-Za-z0-9]{4,20}$/;
let checkedId = null;
let selectedSchool = null;

// ---------- 학교 선택 ----------
document.getElementById('school').addEventListener('click', () =>
  openSchoolPicker((s) => {
    selectedSchool = s;
    const text = document.getElementById('school-text');
    text.textContent = `${s.name} (${[s.region, s.kind].filter(Boolean).join(' · ')})`;
    text.classList.remove('placeholder-text');
    setFieldMsg('school', '');
  })
);

// ---------- 입력값 검사 (서버와 같은 규칙) ----------
function validate(values) {
  const errors = {};
  if (!values.name) errors.name = '이름을 입력해 주세요.';
  if (!values.officeCode) errors.school = '학교를 선택해 주세요.';
  if (!values.loginId) errors.loginId = '아이디를 입력해 주세요.';
  else if (!LOGIN_ID_RULE.test(values.loginId)) errors.loginId = '아이디는 영문과 숫자 4~20자로 입력해 주세요.';
  if (!values.password || values.password.length < 8) errors.password = '비밀번호는 8자 이상 입력해 주세요.';
  else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) errors.password = '비밀번호에 영문과 숫자를 모두 넣어 주세요.';
  if (!values.passwordConfirm) errors.passwordConfirm = '비밀번호를 한 번 더 입력해 주세요.';
  else if (values.password !== values.passwordConfirm) errors.passwordConfirm = '비밀번호가 서로 달라요.';
  return errors;
}

// 입력칸 값과 고른 학교 코드를 서버에 보낼 모양의 객체로 모으기
function readValues() {
  return {
    name: field('name').value.trim(),
    loginId: field('loginId').value.trim(),
    password: field('password').value,
    passwordConfirm: field('passwordConfirm').value,
    officeCode: selectedSchool ? selectedSchool.officeCode : '',
    schoolCode: selectedSchool ? selectedSchool.schoolCode : '',
  };
}

// ---------- 아이디 중복 확인 ----------
async function checkId() {
  const loginId = field('loginId').value.trim();
  if (!LOGIN_ID_RULE.test(loginId)) {
    setFieldMsg('loginId', loginId ? '아이디는 영문과 숫자 4~20자로 입력해 주세요.' : '아이디를 입력해 주세요.');
    return false;
  }
  checkBtn.disabled = true;
  try {
    const data = await api(`/api/auth/check-id?loginId=${encodeURIComponent(loginId)}`);
    setFieldMsg('loginId', data.message, data.available ? 'ok' : 'error');
    checkedId = data.available ? loginId : null;
    return data.available;
  } catch (err) {
    setFieldMsg('loginId', err.message);
    return false;
  } finally {
    checkBtn.disabled = false;
  }
}

checkBtn.addEventListener('click', checkId);

// 아이디를 바꾸면 중복 확인을 다시 해야 함
field('loginId').addEventListener('input', () => {
  if (checkedId !== null) {
    checkedId = null;
    setFieldMsg('loginId', '');
  }
});

// 입력하면 그 칸의 오류 메시지를 지움
for (const name of ['name', 'password', 'passwordConfirm']) {
  field(name).addEventListener('input', () => setFieldMsg(name, ''));
}

// ---------- 가입하기 ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';
  const values = readValues();
  const errors = validate(values);

  for (const name of ['name', 'school', 'loginId', 'password', 'passwordConfirm']) {
    if (name === 'loginId' && !errors.loginId && checkedId === values.loginId) continue;
    setFieldMsg(name, errors[name] || '');
  }
  const firstError = Object.keys(errors)[0];
  if (firstError) {
    field(firstError).focus();
    return;
  }

  // 중복 확인을 안 했으면 자동으로 확인
  if (checkedId !== values.loginId && !(await checkId())) {
    field('loginId').focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '가입하는 중…';
  try {
    await api('/api/auth/signup', { method: 'POST', body: values });
    location.href = '/welcome';
  } catch (err) {
    const fieldErrors = Object.entries(err.errors || {});
    if (fieldErrors.length) {
      for (const [name, text] of fieldErrors) setFieldMsg(name, text);
      if (err.errors.loginId) checkedId = null;
      field(fieldErrors[0][0]).focus();
    } else {
      formError.textContent = err.message;
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '가입하기';
  }
});
