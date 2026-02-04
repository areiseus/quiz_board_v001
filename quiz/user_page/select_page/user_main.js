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
            
            // [수정완료] 사용자님이 만드신 'quiz_page' 폴더로 이동하게 변경
            card.onclick = () => {
                location.href = `../quiz_page/quiz_main.html?db=${quiz.target_db_name}`;
            };

            // 날짜 처리 (없으면 현재 시간)
            const dateObj = quiz.created_at ? new Date(quiz.created_at) : new Date();
            const dateStr = dateObj.toLocaleDateString();

            // 이미지 처리
            let imageHtml = '';
            if (quiz.thumbnail) {
                imageHtml = `<img src="${quiz.thumbnail}" style="width:100%; height:100%; object-fit:cover;" alt="표지">`;
            } else {
                imageHtml = `<div style="display:flex; align-items:center; justify-content:center; height:100%; background:#eee; color:#aaa; font-size:2rem; font-weight:bold;">
                    ${quiz.title.substring(0, 1)}
                </div>`;
            }

            card.innerHTML = `
                <div style="height:150px; background:#f9f9f9; overflow:hidden;">
                    ${imageHtml}
                </div>
                <div class="card-body">
                    <h3 class="card-title">${quiz.title}</h3>
                    <p class="card-desc">DB: ${quiz.target_db_name}</p>
                    <div class="card-meta">
                        <span>👤 ${quiz.creator || '관리자'}</span> | 
                        <span>📅 ${dateStr}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = `<p style="color:red; font-weight:bold;">⚠️ 목록 로드 실패<br><span style="font-size:0.8rem; color:#555;">(${error.message})</span></p>`;
    }
}
