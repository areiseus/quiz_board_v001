document.addEventListener('DOMContentLoaded', () => {
    loadQuizList();
});

async function loadQuizList() {
    const container = document.getElementById('quiz-list-container');
    
    try {
        // 아까 admin_api.js에 만들어둔 '목록 불러오기' API를 재활용합니다.
        // (사용자용 API를 따로 만들어도 되지만, 지금은 이게 제일 빠릅니다)
        const response = await fetch('/api/admin/list-quizzes');
        
        if (!response.ok) {
            throw new Error('서버 응답 오류');
        }

        const quizzes = await response.json();

        container.innerHTML = ''; // "로딩 중" 문구 삭제

        if (quizzes.length === 0) {
            container.innerHTML = '<p>등록된 퀴즈가 없습니다. 관리자 페이지에서 만들어주세요!</p>';
            return;
        }

        // 받아온 퀴즈 데이터로 카드 만들기
        quizzes.forEach(quiz => {
            const card = document.createElement('div');
            card.className = 'quiz-card';
            
            // 퀴즈 클릭 시 플레이 화면으로 이동 (DB명을 주소에 붙여서 보냄)
            // 경로는 폴더 구조에 맞춰 조정하세요 (보통 solve_page/solve_main.html)
            card.onclick = () => {
                location.href = `../solve_page/solve_main.html?db=${quiz.target_db_name}`;
            };

            // 날짜 포맷팅
            const date = new Date(quiz.created_at).toLocaleDateString();

            card.innerHTML = `
                <div style="height:150px; background:#ddd; display:flex; align-items:center; justify-content:center; color:#888;">
                    ${quiz.image_type ? '이미지 있음(구현필요)' : 'NO IMAGE'}
                </div>
                <div class="card-body">
                    <h3 class="card-title">${quiz.title}</h3>
                    <p class="card-desc">${quiz.description || '설명 없음'}</p>
                    <div class="card-meta">
                        <span>👤 ${quiz.creator || '익명'}</span> | <span>📅 ${date}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error('에러 발생:', error);
        container.innerHTML = `<p style="color:red;">목록을 불러오지 못했습니다.<br>(${error.message})</p>`;
    }
}
