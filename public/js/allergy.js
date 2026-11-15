// ===================================================================
// allergy.js — 알레르기 선택 화면(allergy.html) 동작
//  - GET /api/allergies : 알레르기 19종 + 내가 이미 고른 것(selected) 받기
//  - 칩을 눌러 고르기/풀기 → "저장하기" → PUT /api/allergies/mine { allergyIds: [1, 5, 6] }
//  - 서버는 member_allergy 테이블에서 내 것을 지우고 새로 넣음 (트랜잭션)
// ===================================================================
// 화면 요소와 상태: 알레르기 목록(allergies)과 지금 고른 것(selected, 중복 없는 Set)
const chipsEl = document.getElementById('chips');
const summaryEl = document.getElementById('summary');
const saveBtn = document.getElementById('save');
const formError = document.getElementById('form-error');

let allergies = [];
const selected = new Set();

// 저장 후 돌아갈 곳 (?next=/mypage 처럼 넘겨받을 수 있음, 기본은 메인)
const params = new URLSearchParams(location.search);
const next = /^\/[a-z]*$/.test(params.get('next') || '') ? params.get('next') : '/';
document.getElementById('back').href = next;
document.getElementById('cancel').href = next;

// 칩 목록 그리기: 알레르기마다 버튼을 만들고, 누르면 고름↔풀림을 바꾼 뒤 다시 그림
// 아래 요약 문구("선택됨: 우유, 밀")도 함께 갱신
function render() {
  chipsEl.innerHTML = '';
  for (const a of allergies) {
    const on = selected.has(a.allergyId);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (on ? ' on' : '');
    chip.setAttribute('aria-pressed', String(on));
    chip.textContent = `${a.markNo} ${a.name}`;
    chip.addEventListener('click', () => {
      if (selected.has(a.allergyId)) selected.delete(a.allergyId);
      else selected.add(a.allergyId);
      render();
    });
    chipsEl.appendChild(chip);
  }
  const names = allergies.filter((a) => selected.has(a.allergyId)).map((a) => a.name);
  summaryEl.textContent = names.length ? `선택됨: ${names.join(', ')}` : '선택한 알레르기가 없어요.';
  summaryEl.classList.toggle('none', names.length === 0);
}

// 처음 열 때: 서버에서 19종 + 이미 등록한 알레르기를 받아 미리 골라 둠
async function load() {
  try {
    const data = await api('/api/allergies');
    allergies = data.allergies;
    for (const a of allergies) if (a.selected) selected.add(a.allergyId);
    render();
    saveBtn.disabled = false;
  } catch (err) {
    if (err.status === 401) return (location.href = '/login');
    chipsEl.innerHTML = '';
    formError.textContent = err.message;
  }
}

// 저장: 고른 알레르기 번호 배열을 PUT으로 보내고, 잠깐 알림을 띄운 뒤 돌아갈 화면으로 이동
saveBtn.addEventListener('click', async () => {
  formError.textContent = '';
  saveBtn.disabled = true;
  saveBtn.textContent = '저장하는 중…';
  try {
    await api('/api/allergies/mine', { method: 'PUT', body: { allergyIds: [...selected] } });
    toast(selected.size ? `알레르기 ${selected.size}개를 저장했어요` : '알레르기를 모두 해제했어요');
    setTimeout(() => (location.href = next), 900);
  } catch (err) {
    if (err.status === 401) return (location.href = '/login');
    formError.textContent = err.message;
    saveBtn.disabled = false;
    saveBtn.textContent = '저장하기';
  }
});

load();
