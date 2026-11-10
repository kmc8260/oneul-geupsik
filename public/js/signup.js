// ===================================================================
// signup.js — 회원가입 화면(signup.html) 동작
//  1) 학교 선택: school-picker.js 검색 창으로 나이스에서 학교를 고름
//  2) 아이디 중복 확인: GET /api/auth/check-id?loginId=...
//  3) 입력값 검사(서버와 같은 규칙) → POST /api/auth/signup → 성공하면 /welcome
// ===================================================================
const form = document.getElementById('signup-form');   // 회원가입 폼
const formError = document.getElementById('form-error');   // 폼 전체 오류 문구 자리
const submitBtn = form.querySelector('button[type="submit"]');   // 가입하기 버튼
const checkBtn = document.getElementById('check-id');   // 중복 확인 버튼
// form.name은 폼 자체의 name 속성과 겹치므로 입력칸은 elements로 가져옴
const field = (name) => form.elements.namedItem(name);   // 이름으로 입력칸 찾기 (예: field('name'))

const LOGIN_ID_RULE = /^[A-Za-z0-9]{4,20}$/;   // 아이디 규칙: 영문·숫자만 4~20자 (^ 처음, $ 끝)
let checkedId = null; // 중복 확인을 통과한 아이디
let selectedSchool = null; // 나이스에서 고른 학교

// ---------- 학교 선택 ----------
document.getElementById('school').addEventListener('click', () =>   // 학교 선택 버튼을 누르면 검색 창 열기
  openSchoolPicker((s) => {   // 학교를 고르면 아래 함수 실행
    selectedSchool = s;   // 고른 학교 기억 (가입할 때 교육청 코드·학교 코드를 보냄)
    const text = document.getElementById('school-text');
    text.textContent = `${s.name} (${[s.region, s.kind].filter(Boolean).join(' · ')})`;   // 버튼 글자를 "미림여자정보과학고등학교 (서울 · 고등학교)" 처럼
    text.classList.remove('placeholder-text');   // 회색 안내 글씨 → 검정 글씨
    setFieldMsg('school', '');   // 학교 오류 메시지 지우기
  })
);

// ---------- 입력값 검사 (서버와 같은 규칙) ----------
function validate(values) {   // 입력값을 검사해서 { 칸이름: '오류 문구' } 로 돌려줌 (빈 객체면 통과)
  const errors = {};
  if (!values.name) errors.name = '이름을 입력해 주세요.';   // 이름 비었는지
  if (!values.officeCode) errors.school = '학교를 선택해 주세요.';   // 학교 골랐는지
  if (!values.loginId) errors.loginId = '아이디를 입력해 주세요.';   // 아이디 비었는지
  else if (!LOGIN_ID_RULE.test(values.loginId)) errors.loginId = '아이디는 영문과 숫자 4~20자로 입력해 주세요.';   // 아이디 규칙
  if (!values.password || values.password.length < 8) errors.password = '비밀번호는 8자 이상 입력해 주세요.';   // 비밀번호 8자 이상
  else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) errors.password = '비밀번호에 영문과 숫자를 모두 넣어 주세요.';   // 영문과 숫자가 모두 들어 있는지
  if (!values.passwordConfirm) errors.passwordConfirm = '비밀번호를 한 번 더 입력해 주세요.';   // 비밀번호 확인 칸
  else if (values.password !== values.passwordConfirm) errors.passwordConfirm = '비밀번호가 서로 달라요.';   // 두 비밀번호가 같은지
  return errors;
}

function readValues() {   // 입력칸 값들을 객체 하나로 모으기 (서버로 보낼 모양)
  return {
    name: field('name').value.trim(),
    loginId: field('loginId').value.trim(),
    password: field('password').value,
    passwordConfirm: field('passwordConfirm').value,
    officeCode: selectedSchool ? selectedSchool.officeCode : '',   // 고른 학교의 교육청 코드 (예: B10 = 서울)
    schoolCode: selectedSchool ? selectedSchool.schoolCode : '',   // 고른 학교의 학교 코드
  };
}

// ---------- 아이디 중복 확인 ----------
async function checkId() {   // 아이디 중복 확인 (사용 가능하면 true)
  const loginId = field('loginId').value.trim();
  if (!LOGIN_ID_RULE.test(loginId)) {   // 규칙에 안 맞으면 서버에 묻지도 않음
    setFieldMsg('loginId', loginId ? '아이디는 영문과 숫자 4~20자로 입력해 주세요.' : '아이디를 입력해 주세요.');
    return false;
  }
  checkBtn.disabled = true;   // 확인하는 동안 버튼 잠금
  try {
    const data = await api(`/api/auth/check-id?loginId=${encodeURIComponent(loginId)}`);   // 서버에 "이 아이디 써도 돼?" 질문 (routes/auth.js)
    setFieldMsg('loginId', data.message, data.available ? 'ok' : 'error');   // 사용 가능하면 초록 문구, 아니면 빨간 문구
    checkedId = data.available ? loginId : null;   // 통과한 아이디를 기억
    return data.available;
  } catch (err) {
    setFieldMsg('loginId', err.message);
    return false;
  } finally {
    checkBtn.disabled = false;
  }
}

checkBtn.addEventListener('click', checkId);   // 중복 확인 버튼 연결

// 아이디를 바꾸면 중복 확인을 다시 해야 함
field('loginId').addEventListener('input', () => {   // 아이디 칸에 입력할 때마다
  if (checkedId !== null) {   // 이미 확인했던 아이디를 고치면 확인 기록 지움
    checkedId = null;
    setFieldMsg('loginId', '');
  }
});

// 입력하면 그 칸의 오류 메시지를 지움
for (const name of ['name', 'password', 'passwordConfirm']) {   // 이 칸들은 입력하면 오류 메시지 지우기
  field(name).addEventListener('input', () => setFieldMsg(name, ''));
}

// ---------- 가입하기 ----------
form.addEventListener('submit', async (e) => {   // 가입하기 버튼을 누르면
  e.preventDefault();
  formError.textContent = '';
  const values = readValues();   // 입력값 모으기
  const errors = validate(values);   // 검사

  for (const name of ['name', 'school', 'loginId', 'password', 'passwordConfirm']) {   // 칸마다 오류 문구 표시 (없으면 지움)
    if (name === 'loginId' && !errors.loginId && checkedId === values.loginId) continue;   // 아이디가 이미 "사용 가능" 초록 문구로 확인된 경우는 그대로 둠
    setFieldMsg(name, errors[name] || '');
  }
  const firstError = Object.keys(errors)[0];   // 첫 번째 오류 칸
  if (firstError) {   // 오류가 있으면 그 칸으로 커서 옮기고 멈춤
    field(firstError).focus();
    return;
  }

  // 중복 확인을 안 했으면 자동으로 확인
  if (checkedId !== values.loginId && !(await checkId())) {   // 아직 중복 확인을 안 했으면 지금 자동으로 확인 (사용 불가면 멈춤)
    field('loginId').focus();
    return;
  }

  submitBtn.disabled = true;   // 두 번 누르기 방지
  submitBtn.textContent = '가입하는 중…';
  try {
    await api('/api/auth/signup', { method: 'POST', body: values });   // 서버에 가입 요청 — 서버가 비밀번호를 bcrypt로 암호화해 member 테이블에 저장
    location.href = '/welcome';   // 성공 → 가입 완료 화면 (서버가 바로 로그인 상태로 만들어 줌)
  } catch (err) {
    const fieldErrors = Object.entries(err.errors || {});   // 서버가 칸별 오류를 보냈으면 (예: 그 사이 누가 같은 아이디로 가입)
    if (fieldErrors.length) {
      for (const [name, text] of fieldErrors) setFieldMsg(name, text);   // 각 칸 아래에 표시
      if (err.errors.loginId) checkedId = null;   // 아이디 오류면 중복 확인 다시 해야 함
      field(fieldErrors[0][0]).focus();   // 첫 오류 칸으로 커서
    } else {
      formError.textContent = err.message;   // 그 밖의 오류 (DB 연결 실패 등)
    }
  } finally {   // 버튼 원래대로
    submitBtn.disabled = false;
    submitBtn.textContent = '가입하기';
  }
});
