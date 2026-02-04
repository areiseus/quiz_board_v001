document.addEventListener('DOMContentLoaded', () => {
    loadQuizList();
});

async function loadQuizList() {
    const container = document.getElementById('quiz-list-container');
    
    try {
        const response = await fetch('/api/admin_api/list-quizzes');
        
        if (!response.ok) throw new Error("서버 연결 실패");

        const quizzes = await response.json();
        container.innerHTML = ''; 

        if (!quizzes || quizzes.length === 0) {
            container.innerHTML = '<p>등록된 퀴즈가 없습니다.</p>';
            return;
        }

        quizzes.forEach(quiz => {
            const card = document.createElement('div');
            card.className = 'quiz-card';
            
            card.onclick = () => {
                location.href = `../solve_page/solve_main.html?db=${quiz.target_db_name}`;
            };

            // [날짜 처리] DB에 날짜가 있으면 변환, 없으면 현재 날짜 표시
            const dateObj = quiz.created_at ? new Date(quiz.created_at) : new Date();
            const dateStr = dateObj.toLocaleDateString();

            // [이미지 처리] 썸네일이 있으면 <img> 태그, 없으면 글자 아이콘
            let imageHtml = '';
            if (quiz.thumbnail) {
                imageHtml = `<img src="${quiz.thumbnail}" style="width:100%; height:100%; object-fit:cover;" alt="표지">`;
            } else {
                // 이미지가 없을 때 보여줄 기본 화면
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
