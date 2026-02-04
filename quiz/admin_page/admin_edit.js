let currentDbName = null;
let currentQuestions = [];

document.addEventListener('DOMContentLoaded', () => {
    console.log("🔧 수정 페이지 로드됨 (기능 추가 버전)");
    loadQuizList();
});

// 1. 왼쪽 사이드바 목록 불러오기
async function loadQuizList() {
    const container = document.getElementById('quiz-list-container');
    container.innerHTML = '⏳ 목록 로딩 중...';

    try {
        const apiUrl = '/api/admin_api/list-quizzes';
        console.log(`📡 목록 요청: ${apiUrl}`);

        const res = await fetch(apiUrl);
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`(${res.status}) ${errText}`);
        }

        const list = await res.json();
        console.log("✅ 목록 수신:", list);

        container.innerHTML = '';
        if (list.length === 0) {
            container.innerHTML = '<div>등록된 퀴즈가 없습니다.</div>';
            return;
        }

        list.forEach(quiz => {
            const div = document.createElement('div');
            div.className = 'quiz-item';
            
            // [추가됨] 퀴즈 모드(input/view) 정보 표시
            const modeText = quiz.quiz_mode === 'view' ? '👁️ 관전형' : '📝 제출형';
            
            div.innerHTML = `
                <div style="font-size:1rem; font-weight:bold;">${quiz.title}</div>
                <div style="font-size:0.8rem; color:#666;">DB: ${quiz.target_db_name}</div>
                <div style="font-size:0.75rem; color:#007bff; margin-top:3px;">${modeText}</div>
            `;
            div.onclick = () => loadQuizDetail(quiz.target_db_name, quiz.title, div);
            container.appendChild(div);
        });

    } catch (err) {
        console.error("❌ 목록 로드 실패:", err);
        container.innerHTML = `<div style="color:red; font-size:0.8rem;">로드 실패:<br>${err.message}</div>`;
    }
}

// 2. 상세 내용 가져오기
async function loadQuizDetail(dbName, title, clickedElement) {
    currentDbName = dbName;
    
    // 선택 효과
    document.querySelectorAll('.quiz-item').forEach(el => el.classList.remove('active'));
    clickedElement.classList.add('active');
    
    document.getElementById('current-quiz-title').innerText = `수정 중: ${title}`;
    document.getElementById('editor-area').style.display = 'block';

    const container = document.getElementById('questions-container');
    container.innerHTML = '⏳ 문제 데이터를 불러오는 중...';

    try {
        const apiUrl = `/api/admin_api/get-quiz-detail?dbName=${dbName}`;
        const res = await fetch(apiUrl);
        
        if (!res.ok) throw new Error("데이터 로드 실패");

        currentQuestions = await res.json();
        renderEditor(currentQuestions);

    } catch (err) {
        alert("문제를 불러오지 못했습니다: " + err.message);
        container.innerHTML = '❌ 불러오기 오류';
    }
}

// 3. 에디터 렌더링 (여기가 많이 늘어났습니다!)
function renderEditor(questions) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    if (questions.length === 0) {
        container.innerHTML = '<p>이 퀴즈에는 문제가 없습니다.</p>';
        return;
    }

    questions.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'q-card';
        
        div.innerHTML = `
            <div style="font-weight:bold; margin-bottom:5px;">
                Q${q.quiz_no} <span style="font-size:0.7rem; color:#999;">(ID: ${q.id})</span>
            </div>
            
            <div class="row-group">
                <input type="text" id="q_text_${index}" value="${q.question}" placeholder="문제 내용" style="flex:2;">
                <input type="text" id="a_text_${index}" value="${q.answer}" placeholder="정답 (여러 개는 쉼표 ','로 구분)" style="flex:1;">
            </div>

            <div style="margin-bottom:10px; padding:10px; background:#f1f3f5; border-radius:5px; border:1px solid #e9ecef;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                    <span style="font-size:0.85rem; font-weight:bold;">✅ 필요 정답 수:</span>
                    <input type="number" id="q_count_${index}" value="${q.required_count || 1}" min="1" style="width:60px; padding:5px; text-align:center;">
                    <span style="font-size:0.75rem; color:#d63384;">(※ 답이 여러 개일 때, 이 숫자만큼 맞춰야 정답 처리)</span>
                </div>
                
                <textarea id="q_exp_${index}" placeholder="📖 부연설명 (정답 공개 시 함께 표시됩니다)" 
                style="width:95%; height:60px; padding:8px; border:1px solid #ddd; resize:vertical;">${q.explanation || ''}</textarea>
            </div>

            <div class="img-control">
                <div style="margin-bottom:5px; font-size:0.85rem;">🖼️ 이미지 설정</div>
                
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
                    <span style="font-size:0.8rem; width:50px;">파일:</span>
                    <input type="file" id="q_file_${index}" accept="image/*">
                    <span style="font-size:0.75rem; color:blue;">${q.image_type ? '✅ 이미지 있음' : '❌ 없음'}</span>
                </div>

                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:0.8rem; width:50px;">URL:</span>
                    <input type="text" id="q_url_${index}" value="${q.image_url || ''}" placeholder="https://이미지주소..." style="font-size:0.85rem; flex:1;">
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

// 4. 저장하기
async function saveChanges() {
    if (!currentDbName) return;
    if (!confirm("정말 수정하시겠습니까?")) return;

    const formData = new FormData();
    formData.append('dbName', currentDbName);

    const updatedData = currentQuestions.map((q, index) => {
        const fileInput = document.getElementById(`q_file_${index}`);
        if (fileInput.files[0]) {
            formData.append(`file_${q.id}`, fileInput.files[0]);
        }

        return {
            id: q.id,
            question: document.getElementById(`q_text_${index}`).value,
            answer: document.getElementById(`a_text_${index}`).value,
            image_url: document.getElementById(`q_url_${index}`).value,
            
            // [추가됨] 새로 만든 입력값들도 수집해서 보냄
            explanation: document.getElementById(`q_exp_${index}`).value,
            required_count: document.getElementById(`q_count_${index}`).value
        };
    });

    formData.append('quizData', JSON.stringify(updatedData));

    try {
        const res = await fetch('/api/admin_api/update-quiz', {
            method: 'POST',
            body: formData
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "저장 실패");
        }

        alert("✅ 수정 완료!");
        
        // 현재 보고 있는 퀴즈 다시 로드 (화면 갱신)
        const activeItem = document.querySelector('.quiz-item.active');
        const title = document.getElementById('current-quiz-title').innerText.replace('수정 중: ', '');
        loadQuizDetail(currentDbName, title, activeItem);

    } catch (err) {
        alert("❌ 오류 발생: " + err.message);
    }
}
