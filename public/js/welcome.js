// ===================================================================
// welcome.js — 가입 완료 화면(welcome.html) 동작
//  - GET /api/auth/me 로 방금 가입한 내 이름을 받아 "가입을 환영해요, 홍길동님!" 표시
//  - 알레르기 등록 안내 팝업: 선택하러 가기(/allergy) 또는 나중에(/ 메인)
// ===================================================================
// 가입 완료 화면: 이름을 표시하고 알레르기 등록 안내 팝업을 띄움
const overlay = document.getElementById('allergy-prompt');   // 알레르기 안내 팝업 배경
const goBtn = document.getElementById('go-allergy');   // "선택하러 가기" 버튼

api('/api/auth/me')   // 로그인한 내 정보 요청 (routes/auth.js)
  .then(({ member }) => {
    document.getElementById('member-name').textContent = `, ${member.name}님`;   // 제목 옆에 ", 이름님" 넣기
  })
  .catch(() => { location.href = '/login'; });   // 로그인이 안 되어 있으면 로그인 화면으로

goBtn.focus();   // 엔터만 쳐도 바로 이동할 수 있게 버튼에 초점

// Esc 키 = 나중에 할게요
document.addEventListener('keydown', (e) => {   // 키보드를 누르면
  if (e.key === 'Escape') location.href = '/';   // Esc면 메인으로
});

// 바깥(어두운 부분)을 누르면 닫고 메인으로
overlay.addEventListener('click', (e) => {   // 팝업 바깥을 누르면
  if (e.target === overlay) location.href = '/';   // e.target === overlay: 팝업 창이 아닌 어두운 배경을 눌렀을 때만
});
