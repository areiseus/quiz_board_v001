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
            
            // 클릭 시 인트로 화면으로 정보 전달
            card.onclick = () => {
                const title = encodeURIComponent(quiz.title);
                const creator = encodeURIComponent(quiz.creator || '관리자');
                // DB 이름은 링크 생성용으로만 사용하고 화면엔 안 보여줌
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

            // [수정] DB 이름 표시 부분 삭제
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

            /// 직접 추가부분
if (item.quiz_activate === false) {
    // 1. 반투명 회색 처리
    card.style.opacity = '0.5';
    card.style.filter = 'grayscale(100%)';
    card.style.backgroundColor = '#e0e0e0'; // 배경 회색

    // 2. 클릭 방지 (pointer-events: none)
    card.style.pointerEvents = 'none';
    card.style.cursor = 'default';

    // 3. 제목에 [준비중] 태그 추가
    // (카드 안에 .title 클래스나 h3 등이 있다고 가정)
    const titleEl = card.querySelector('.quiz-title') || card.querySelector('h3') || card.querySelector('div');
    if (titleEl) {
        titleEl.innerText = "[준비중] " + titleEl.innerText;
        titleEl.style.color = "#555";
    }

    // 4. 혹시 모를 onclick 이벤트 제거
    card.onclick = null;
    const btn = card.querySelector('button');
    if(btn) btn.disabled = true;
}

/// 직접 추가부분
            
            container.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = `<p style="color:red; font-weight:bold;">⚠️ 목록 로드 실패</p>`;
    }
}
