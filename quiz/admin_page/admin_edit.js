let currentDbName = null;
let currentQuestions = [];

document.addEventListener('DOMContentLoaded', loadQuizList);

// 1. 왼쪽 사이드바에 퀴즈 목록 불러오기
async function loadQuizList() {
    const container = document.getElementById('quiz-list-container');
    try {
        const res = await fetch('/api/admin/list-quizzes');
        const list = await res.json();

        container.innerHTML = '';
        list.forEach(quiz => {
            const div = document.createElement('div');
            div.className = 'quiz-item';
            div.innerHTML = `
                <div style="font-size:1rem;">${quiz.title}</div>
                <div style="font-size:0.8rem; color:#666;">DB: ${quiz.target_db_name}</div>
            `;
            div.onclick = () => loadQuizDetail(quiz.target_db_name, quiz.title, div);
            container.appendChild(div);
        });
    } catch (err) {
        container.innerHTML = '목록 로드 실패';
    }
}

// 2. 퀴즈 클릭 시 상세 내용 에디터에 로드
async function loadQuizDetail(dbName, title, clickedElement) {
    currentDbName = dbName;
    
    // UI 활성화 (선택 표시)
    document.querySelectorAll('.quiz-item').forEach(el => el.classList.remove('active'));
    clickedElement.classList.add('active');
    
    document.getElementById('current-quiz-title').innerText = `Editing: ${title}`;
    document.getElementById('editor-area').style.display = 'block';

    const container = document.getElementById('questions-container');
    container.innerHTML = '⏳ 문제 불러오는 중...';

    try {
        const res = await fetch(`/api/admin/get-quiz-detail?dbName=${dbName}`);
        currentQuestions = await res.json();
        renderEditor(currentQuestions);
    } catch (err) {
        container.innerHTML = '❌ 불러오기 오류';
        console.error(err);
    }
}

// 3. 에디터 화면 그리기 (문제/정답/이미지 입력칸)
function renderEditor(questions) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    if (questions.length === 0) {
        container.innerHTML = '<p>등록된 문제가 없습니다.</p>';
        return;
    }

    questions.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'q-card';
        div.innerHTML = `
            <div style="font-weight:bold; margin-bottom:5px;">Q${q.quiz_no} (ID: ${q.id})</div>
            
            <div class="row-group">
                <input type="text" id="q_text_${index}" value="${q.question}" placeholder="문제 내용">
                <input type="text" id="a_text_${index}" value="${q.answer}" placeholder="정답">
            </div>

            <div class="img-control">
                <div style="margin-bottom:5px;">🖼️ 이미지 설정</div>
                
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
                    <span style="font-size:0.8rem; width:60px;">파일:</span>
                    <input type="file" id="q_file_${index}" accept="image/*">
                    <span style="font-size:0.75rem; color:blue;">${q.image_type ? '(현재 이미지 있음)' : '(이미지 없음)'}</span>
                </div>

                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:0.8rem; width:60px;">URL:</span>
                    <input type="text" id="q_url_${index}" value="${q.image_url || ''}" placeholder="https://..." style="font-size:0.85rem;">
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

// 4. 저장하기 (변경된 내용 업데이트)
async function saveChanges() {
    if (!currentDbName) return;
    if (!confirm("수정사항을 DB에 반영하시겠습니까?")) return;

    const formData = new FormData();
    formData.append('dbName', currentDbName);

    const updatedData = currentQuestions.map((q, index) => {
        // 입력값 가져오기
        const newQ = document.getElementById(`q_text_${index}`).value;
        const newA = document.getElementById(`a_text_${index}`).value;
        const newUrl = document.getElementById(`q_url_${index}`).value;
        const fileInput = document.getElementById(`q_file_${index}`);

        // 파일이 선택되었으면 FormData에 추가 (식별자는 ID 사용)
        if (fileInput.files[0]) {
            formData.append(`file_${q.id}`, fileInput.files[0]);
        }

        return {
            id: q.id, // 업데이트 기준 (WHERE id = ...)
            question: newQ,
            answer: newA,
            image_url: newUrl
        };
    });

    formData.append('quizData', JSON.stringify(updatedData));

    try {
        const res = await fetch('/api/admin/update-quiz', {
            method: 'POST',
            body: formData
        });
        const result = await res.json();

        if (res.ok) {
            alert(result.message);
            // 최신 상태 다시 로드
            loadQuizDetail(currentDbName, document.getElementById('current-quiz-title').innerText.replace('Editing: ', ''), document.querySelector('.quiz-item.active'));
        } else {
            alert("오류: " + result.error);
        }
    } catch (err) {
        alert("서버 통신 오류");
    }
}
