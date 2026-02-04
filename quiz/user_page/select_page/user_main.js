// 여기에 HTML 태그가 있으면 안 됩니다!
document.addEventListener('DOMContentLoaded', () => {
    loadQuizList();
});

async function loadQuizList() {
    const container = document.getElementById('quiz-list-container');
    try {
        const response = await fetch('/api/admin_api/list-quizzes'); // 주소 확인!
        if (!response.ok) throw new Error("서버 응답 실패");
        
        const quizzes = await response.json();
        container.innerHTML = '';
        
        if (!quizzes.length) {
            container.innerHTML = '<p>등록된 퀴즈가 없습니다.</p>';
            return;
        }

        quizzes.forEach(quiz => {
            const div = document.createElement('div');
            div.className = 'quiz-card';
            div.innerHTML = `<h3>${quiz.title}</h3><p>제작: ${quiz.creator}</p>`;
            // 클릭 시 이동
            div.onclick = () => location.href = `../solve_page/solve_main.html?db=${quiz.target_db_name}`;
            container.appendChild(div);
        });
    } catch (e) {
        container.innerHTML = `<p style="color:red">에러: ${e.message}</p>`;
    }
}
