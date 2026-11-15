// ===================================================================
// welcome.js — 가입 완료 화면(welcome.html) 동작
//  - GET /api/auth/me 로 방금 가입한 내 이름을 받아 "가입을 환영해요, 홍길동님!" 표시
//  - 알레르기 등록 안내 팝업: 선택하러 가기(/allergy) 또는 나중에(/ 메인)
// ===================================================================
// 내 이름을 받아 환영 문구에 넣고, 알레르기 안내 팝업의 버튼에 초점
const overlay = document.getElementById('allergy-prompt');
const goBtn = document.getElementById('go-allergy');

api('/api/auth/me')
  .then(({ member }) => {
    document.getElementById('member-name').textContent = `, ${member.name}님`;
  })
  .catch(() => { location.href = '/login'; });

goBtn.focus();

// Esc 키 = 나중에 할게요
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') location.href = '/';
});

// 바깥(어두운 부분)을 누르면 닫고 메인으로
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) location.href = '/';
});
