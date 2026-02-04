document.addEventListener('DOMContentLoaded', () => {
    loadQuizList();
});

async function loadQuizList() {
    const container = document.getElementById('quiz-list-container');
    
    try {
        // API 요청 (admin_api.js 파일로 요청)
        const response = await fetch('/api/admin_api/list-quizzes');
        
        if (!response.ok) throw new Error("서버 연결 실패");

        const quizzes = await response.json();
        container.innerHTML = ''; // 로딩 문구 삭제

        if (!quizzes || quizzes.length === 0) {
            container.innerHTML = '<p>등록된 퀴즈가 없습니다.</p>';
            return;
        }

        quizzes.forEach(quiz => {
            const card = document.createElement('div');
            card.className = 'quiz-card';
            
            // 클릭 시 문제 풀기 페이지로 이동
            card.onclick = () => {
                location.href = `../solve_page/solve_main.html?db=${quiz.target_db_name}`;
            };

            const date = new Date(quiz.created_at).toLocaleDateString();

            card.innerHTML = `
                <div style="height:120px; background:#eee; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:bold; color:#aaa;">
                    ${quiz.title.substring(0, 1)}
                </div>
                <div class="card-body">
                    <h3 class="card-title">${quiz.title}</h3>
                    <p class="card-desc">DB: ${quiz.target_db_name}</p>
                    <div class="card-meta">👤 ${quiz.creator || '관리자'} | 📅 ${date}</div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = `<p style="color:red; font-weight:bold;">⚠️ 목록을 불러오지 못했습니다.<br><span style="font-size:0.8rem; color:#555;">(새로고침 하거나 관리자 페이지를 확인하세요)</span></p>`;
    }
}
