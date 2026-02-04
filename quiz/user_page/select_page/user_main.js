document.addEventListener('DOMContentLoaded', loadQuizList);

async function loadQuizList() {
    const listContainer = document.getElementById('quiz-list');

    try {
        // 1. API 호출 (퀴즈 목록 달라고 요청)
        const response = await fetch('/api/user/quiz-list');
        const quizzes = await response.json();

        // 2. 목록 비우기 (로딩 메시지 삭제)
        listContainer.innerHTML = '';

        if (quizzes.length === 0) {
            listContainer.innerHTML = '<p>등록된 퀴즈가 없습니다.</p>';
            return;
        }

        // 3. 카드 생성 및 배치
        quizzes.forEach(quiz => {
            const card = document.createElement('div');
            card.className = 'quiz-card';
            
            // 이미지가 없으면 기본 회색박스 처리
            const imgSrc = quiz.thumbnail ? quiz.thumbnail : 'https://via.placeholder.com/300x180?text=No+Image';

            card.innerHTML = `
                <img src="${imgSrc}" class="card-img" alt="thumbnail">
                <div class="card-body">
                    <div class="card-title">${quiz.title}</div>
                    <div class="card-desc">${quiz.description || '설명 없음'}</div>
                    <div class="card-footer">제작: ${quiz.creator || '익명'}</div>
                </div>
            `;

            // 4. 클릭 이벤트: 실제 게임 페이지로 이동 (중요: dbName을 가지고 이동)
            card.addEventListener('click', () => {
                // 상위 폴더(../)로 나가서 quiz_page로 진입
                window.location.href = `../quiz_page/quiz_main.html?dbName=${quiz.dbName}`;
            });

            listContainer.appendChild(card);
        });

    } catch (error) {
        console.error("로딩 실패:", error);
        listContainer.innerHTML = '<p>목록을 불러오는데 실패했습니다.</p>';
    }
}

// [추가] 관리자 버튼 클릭 이벤트
document.getElementById('admin-btn').addEventListener('click', async () => {
    const password = prompt("관리자 비밀번호를 입력하세요:");
    
    if (!password) return; // 취소하면 중단

    try {
        // 서버에 비밀번호 맞는지 물어보기
        const response = await fetch('/api/admin/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // 비밀번호 맞으면 관리자 페이지로 이동
            // (경로는 현재 폴더 위치에 따라 다를 수 있으니 주의)
            window.location.href = '../../admin_page/admin_main.html';
        } else {
            alert("⛔ 비밀번호가 틀렸습니다!");
        }
    } catch (error) {
        console.error("인증 오류:", error);
        alert("서버 오류가 발생했습니다.");
    }
});
