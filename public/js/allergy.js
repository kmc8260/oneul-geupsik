// ===================================================================
// allergy.js — 알레르기 선택 화면(allergy.html) 동작
//  - GET /api/allergies : 알레르기 19종 + 내가 이미 고른 것(selected) 받기
//  - 칩을 눌러 고르기/풀기 → "저장하기" → PUT /api/allergies/mine { allergyIds: [1, 5, 6] }
//  - 서버는 member_allergy 테이블에서 내 것을 지우고 새로 넣음 (트랜잭션)
// ===================================================================
// 알레르기 선택 화면: 칩을 눌러 고르고 저장
const chipsEl = document.getElementById('chips');   // 칩들이 그려질 자리
const summaryEl = document.getElementById('summary');   // 고른 결과 요약 문구 자리
const saveBtn = document.getElementById('save');   // 저장 버튼
const formError = document.getElementById('form-error');   // 오류 문구 자리

let allergies = [];          // 서버에서 받은 19종   // [{ allergyId, markNo, name, selected }, ...]
const selected = new Set();  // 지금 고른 알레르기ID   // Set = 중복 없는 모음 (같은 알레르기를 두 번 넣지 않음)

// 저장 후 돌아갈 곳 (?next=/mypage 처럼 넘겨받을 수 있음, 기본은 메인)
const params = new URLSearchParams(location.search);   // 주소의 ?next= 읽기
const next = /^\/[a-z]*$/.test(params.get('next') || '') ? params.get('next') : '/';   // 우리 사이트 안 주소(/mypage 같은 모양)만 허용 — 다른 사이트로 튕기는 것 방지
document.getElementById('back').href = next;   // 뒤로 가기 링크도 같은 곳으로
document.getElementById('cancel').href = next;   // 취소 버튼도 같은 곳으로

function render() {   // 칩 목록 다시 그리기 (누를 때마다 부름)
  chipsEl.innerHTML = '';   // 기존 칩 지우기
  for (const a of allergies) {   // 알레르기마다 칩 버튼 하나
    const on = selected.has(a.allergyId);   // 지금 골라져 있는지
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (on ? ' on' : '');   // 골라져 있으면 on 클래스 (색칠)
    chip.setAttribute('aria-pressed', String(on));   // 화면 낭독기에게 눌림 상태 알림
    chip.textContent = `${a.markNo} ${a.name}`;   // "5 대두" 처럼 급식표 번호 + 이름
    chip.addEventListener('click', () => {   // 누르면 고름 ↔ 풀림 바꾸고 다시 그림
      if (selected.has(a.allergyId)) selected.delete(a.allergyId);
      else selected.add(a.allergyId);
      render();
    });
    chipsEl.appendChild(chip);
  }
  const names = allergies.filter((a) => selected.has(a.allergyId)).map((a) => a.name);   // 고른 알레르기 이름들
  summaryEl.textContent = names.length ? `선택됨: ${names.join(', ')}` : '선택한 알레르기가 없어요.';   // 요약 문구
  summaryEl.classList.toggle('none', names.length === 0);   // 하나도 없으면 회색 글씨 (none 클래스)
}

async function load() {   // 처음 화면을 열 때 목록 받아오기
  try {
    const data = await api('/api/allergies');   // 서버에 알레르기 목록 요청 (routes/allergy.js)
    allergies = data.allergies;
    for (const a of allergies) if (a.selected) selected.add(a.allergyId);   // 이미 등록해 둔 알레르기는 미리 골라 둠
    render();
    saveBtn.disabled = false;   // 목록을 받은 뒤에야 저장 버튼 활성화
  } catch (err) {
    if (err.status === 401) return (location.href = '/login');   // 로그인이 풀렸으면 로그인 화면으로
    chipsEl.innerHTML = '';
    formError.textContent = err.message;
  }
}

saveBtn.addEventListener('click', async () => {   // 저장 버튼을 누르면
  formError.textContent = '';
  saveBtn.disabled = true;   // 두 번 누르기 방지
  saveBtn.textContent = '저장하는 중…';
  try {
    await api('/api/allergies/mine', { method: 'PUT', body: { allergyIds: [...selected] } });   // [...selected] = Set을 배열로 바꿔서 보냄
    toast(selected.size ? `알레르기 ${selected.size}개를 저장했어요` : '알레르기를 모두 해제했어요');   // 저장 결과 알림
    setTimeout(() => (location.href = next), 900);   // 0.9초 뒤 돌아갈 화면으로 이동
  } catch (err) {
    if (err.status === 401) return (location.href = '/login');
    formError.textContent = err.message;
    saveBtn.disabled = false;   // 실패하면 버튼 원래대로
    saveBtn.textContent = '저장하기';
  }
});

load();   // 화면이 열리면 바로 목록 불러오기
