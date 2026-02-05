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
        // view_act가 false면 아예 화면에 그리지 않고 스킵합니다.
        if (quiz.view_act === false) {
            return; 
        }


            
            
            const card = document.createElement('div');
            card.className = 'quiz-card';
            
            // 기본 클릭 이벤트 (활성화 상태일 때만 동작하도록 나중에 덮어씌워짐)
            card.onclick = () => {
                const title = encodeURIComponent(quiz.title);
                const creator = encodeURIComponent(quiz.creator || '관리자');
                location.href = `../quiz_page/quiz_main.html?db=${quiz.target_db_name}&title=${title}&creator=${creator}`;
            };

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
                    <div class="card-meta" style="margin-top:10px;">
                        <span>👤 ${quiz.creator || '관리자'}</span> | 
                        <span>📅 ${dateStr}</span>
                    </div>
                </div>
            `;

            // ▼▼▼ [수정된 부분] 비활성화(준비중) 처리 로직 ▼▼▼
            // (변수명을 item -> quiz 로 변경했습니다)
            if (quiz.quiz_activate === false) {
                // 1. 반투명 회색 처리
                card.style.opacity = '0.6';
                card.style.filter = 'grayscale(100%)';
                card.style.backgroundColor = '#e0e0e0'; 

                // 2. 클릭 방지 (CSS)
                card.style.pointerEvents = 'none';
                card.style.cursor = 'default';

                // 3. 제목에 [준비중] 태그 추가
                // (위 HTML에서 class="card-title"을 썼으므로 맞춰줍니다)
                const titleEl = card.querySelector('.card-title'); 
                if (titleEl) {
                    titleEl.innerText = "[준비중] " + titleEl.innerText;
                    titleEl.style.color = "#555";
                }

                // 4. 클릭 이벤트 제거 (확실하게 null 처리)
                card.onclick = null;
            }
            // ▲▲▲ [수정 끝] ▲▲▲
            
            container.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = `<p style="color:red; font-weight:bold;">⚠️ 목록 로드 실패</p>`;
    }
}
