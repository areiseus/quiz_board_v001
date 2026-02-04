document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 페이지 로드됨. 퀴즈 목록 요청 시작...");
    loadQuizList();
});

async function loadQuizList() {
    const container = document.getElementById('quiz-list-container');
    
    try {
        // [중요] API 주소 수정: /api/admin -> /api/admin_api (파일 이름 기준)
        const apiUrl = '/api/admin_api/list-quizzes';
        console.log(`📡 요청 보냄: ${apiUrl}`);

        const response = await fetch(apiUrl);
        
        // 응답 상태 확인 (404, 500 등)
        if (!response.ok) {
            const errorText = await response.text(); // 서버가 보낸 에러 메시지 원본 읽기
            throw new Error(`서버 응답 오류 (${response.status}): ${errorText}`);
        }

        const quizzes = await response.json();
        console.log("✅ 데이터 수신 완료:", quizzes);

        container.innerHTML = ''; // "로딩 중" 문구 삭제

        if (!quizzes || quizzes.length === 0) {
            container.innerHTML = '<p>📭 등록된 퀴즈가 없습니다. 관리자 페이지에서 만들어주세요!</p>';
            return;
        }

        // 카드 생성 로직
        quizzes.forEach(quiz => {
            const card = document.createElement('div');
            card.className = 'quiz-card';
            
            // 클릭 시 이동 (경로는 본인 폴더 구조에 맞게 수정 필요)
            card.onclick = () => {
                const targetUrl = `../solve_page/solve_main.html?db=${quiz.target_db_name}`;
                console.log(`🏃 이동: ${targetUrl}`);
                location.href = targetUrl;
            };

            const date = new Date(quiz.created_at).toLocaleDateString();

            card.innerHTML = `
                <div style="height:150px; background:#eee; display:flex; align-items:center; justify-content:center; color:#888; font-weight:bold;">
                    ${quiz.title.substring(0, 1)}
                </div>
                <div class="card-body">
                    <h3 class="card-title">${quiz.title}</h3>
                    <p class="card-desc">DB: ${quiz.target_db_name}</p>
                    <div class="card-meta">
                        <span>👤 ${quiz.creator || '관리자'}</span> | <span>📅 ${date}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error('❌ 에러 발생:', error);
        // 화면에 에러를 빨간 글씨로 출력 (사용자가 볼 수 있게)
        container.innerHTML = `
            <div style="color: red; padding: 20px; border: 1px solid red; background: #ffeeee;">
                <h3>❌ 목록을 불러오지 못했습니다.</h3>
                <p><b>원인:</b> ${error.message}</p>
                <p><b>확인할 점:</b><br>
                1. api/admin_api.js 파일이 존재하는지<br>
                2. DB 연결이 끊기지 않았는지</p>
            </div>
        `;
    }
}
