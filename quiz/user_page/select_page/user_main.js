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
            container.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">등록된 퀴즈가 없습니다.</p>';
            return;
        }

        quizzes.forEach(quiz => {
            // view_act가 false면 건너뛰기
            if (quiz.view_act === false) {
                return; 
            }

            const card = document.createElement('div');
            card.className = 'quiz-card';
            
            // 클릭 이벤트 (상세 페이지 이동)
            card.onclick = () => {
                const title = encodeURIComponent(quiz.title);
                const creator = encodeURIComponent(quiz.creator || '관리자');
                const desc = encodeURIComponent(quiz.description || ''); // 설명도 같이 전달!
                location.href = `../quiz_page/quiz_main.html?db=${quiz.target_db_name}&title=${title}&creator=${creator}&description=${desc}`;
            };

            const dateObj = quiz.created_at ? new Date(quiz.created_at) : new Date();
            const dateStr = dateObj.toLocaleDateString();

            // ★ [핵심 수정] image_type이 있을 때만 <img> 태그 생성 (없으면 바로 회색 박스)
            let imageHtml = '';
            
            if (quiz.image_type) {
                // 이미지가 있는 경우: Lazy Loading 적용된 img 태그
                const imageUrl = `/api/admin_api/thumbnail?dbName=${quiz.target_db_name}`;
                // 혹시라도 로딩 실패하면(onerror) 회색박스로 대체하는 안전장치 포함
                imageHtml = `<img src="${imageUrl}" 
                    loading="lazy" 
                    onerror="this.parentNode.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;background:#eee;color:#aaa;font-weight:bold;font-size:2rem;\\'>${quiz.title.substring(0,1)}</div>'"
                    style="width:100%; height:100%; object-fit:cover;" alt="표지">`;
            } else {
                // 이미지가 없는 경우: 아예 처음부터 깔끔한 회색 박스 렌더링
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

            // [비활성화(준비중) 처리 로직]
            if (quiz.quiz_activate === false) {
                card.style.opacity = '0.6';
                card.style.filter = 'grayscale(100%)';
                card.style.backgroundColor = '#e0e0e0'; 
                card.style.pointerEvents = 'none';
                card.style.cursor = 'default';

                const titleEl = card.querySelector('.card-title'); 
                if (titleEl) {
                    titleEl.innerText = "[준비중] " + titleEl.innerText;
                    titleEl.style.color = "#555";
                }
                card.onclick = null;
            }
            
            container.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = `<p style="color:red; font-weight:bold; padding:20px;">⚠️ 목록 로드 실패</p>`;
    }
}
