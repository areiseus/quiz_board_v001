let currentDbName = null;
let currentQuestions = [];

document.addEventListener('DOMContentLoaded', () => {
    console.log("🔧 수정 페이지 로드됨 (이미지 삭제 기능 추가)");
    loadQuizList();
});

// 1. 목록 불러오기
async function loadQuizList() {
    const container = document.getElementById('quiz-list-container');
    container.innerHTML = '⏳ 목록 로딩 중...';

    try {
        const res = await fetch('/api/admin_api/list-quizzes');
        if (!res.ok) throw new Error(await res.text());

        const list = await res.json();
        container.innerHTML = '';
        
        if (list.length === 0) {
            container.innerHTML = '<div>등록된 퀴즈가 없습니다.</div>';
            return;
        }

        list.forEach(quiz => {
            const div = document.createElement('div');
            div.className = 'quiz-item';
            div.innerHTML = `
                <div style="font-size:1rem; font-weight:bold;">${quiz.title}</div>
                <div style="font-size:0.8rem; color:#666;">DB: ${quiz.target_db_name}</div>
            `;
            div.onclick = () => loadQuizDetail(quiz.target_db_name, quiz.title, div);
            container.appendChild(div);
        });

    } catch (err) {
        container.innerHTML = `<div style="color:red;">로드 실패: ${err.message}</div>`;
    }
}

// 2. 상세 내용 가져오기
async function loadQuizDetail(dbName, title, clickedElement) {
    currentDbName = dbName;
    
    document.querySelectorAll('.quiz-item').forEach(el => el.classList.remove('active'));
    clickedElement.classList.add('active');
    
    document.getElementById('current-quiz-title').innerText = `수정 중: ${title}`;
    document.getElementById('editor-area').style.display = 'block';

    const container = document.getElementById('questions-container');
    container.innerHTML = '⏳ 데이터 로딩 중...';

    try {
        const res = await fetch(`/api/admin_api/get-quiz-detail?dbName=${dbName}`);
        if (!res.ok) throw new Error("로드 실패");

        currentQuestions = await res.json();
        renderEditor(currentQuestions);

    } catch (err) {
        alert("오류: " + err.message);
        container.innerHTML = '❌ 로드 오류';
    }
}

// 3. 에디터 렌더링
function renderEditor(questions) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    questions.forEach((q, index) => {
        const isStrictChecked = (q.is_strict !== false);
        const hasImage = (q.image_type || (q.image_url && q.image_url.trim() !== ''));

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

            <div style="margin-bottom:10px; padding:15px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;">
                <div style="display:flex; align-items:center; gap:15px; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:5px;">
                        <span style="font-size:0.9rem; font-weight:bold;">✅ 필요 정답 수:</span>
                        <input type="number" id="q_count_${index}" value="${q.required_count || 1}" min="1" style="width:50px; padding:5px; text-align:center; font-weight:bold;">
                    </div>
                    <div style="display:flex; align-items:center; gap:5px; background:#fff; padding:3px 8px; border-radius:4px; border:1px solid #ccc;">
                        <input type="checkbox" id="q_strict_${index}" ${isStrictChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
                        <label for="q_strict_${index}" style="font-size:0.85rem; cursor:pointer; font-weight:bold; color:#d63384;">🔒 완전 일치 필요</label>
                    </div>
                </div>
                <textarea id="q_exp_${index}" placeholder="📖 부연설명 (정답/오답 결과 화면에 표시됩니다)" 
                style="width:95%; height:60px; padding:8px; border:1px solid #ccc; resize:vertical;">${q.explanation || ''}</textarea>
            </div>

            <div class="img-control">
                <div style="margin-bottom:5px; font-size:0.85rem; font-weight:bold;">🖼️ 이미지 설정</div>
                
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
                    <span style="font-size:0.8rem; width:50px;">파일:</span>
                    <input type="file" id="q_file_${index}" accept="image/*">
                    <span style="font-size:0.75rem; color:blue;">${q.image_type ? '✅ 이미지 있음' : '❌ 없음'}</span>
                    
                    ${hasImage ? `
                        <div style="margin-left:auto; display:flex; align-items:center; gap:5px; border:1px solid #dc3545; padding:2px 8px; border-radius:4px; background:#fff0f0;">
                            <input type="checkbox" id="q_del_img_${index}" style="cursor:pointer;">
                            <label for="q_del_img_${index}" style="font-size:0.75rem; color:#dc3545; font-weight:bold; cursor:pointer;">🗑️ 이미지 삭제</label>
                        </div>
                    ` : ''}
                </div>

                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:0.8rem; width:50px;">URL:</span>
                    <input type="text" id="q_url_${index}" value="${q.image_url || ''}" placeholder="https://..." style="font-size:0.85rem; flex:1;">
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

// 4. 저장하기
async function saveChanges() {
    if (!currentDbName) return;
    if (!confirm("수정사항을 저장하시겠습니까?")) return;

    const formData = new FormData();
    formData.append('dbName', currentDbName);

    const updatedData = currentQuestions.map((q, index) => {
        const fileInput = document.getElementById(`q_file_${index}`);
        const deleteCheckbox = document.getElementById(`q_del_img_${index}`);

        if (fileInput.files[0]) {
            formData.append(`file_${q.id}`, fileInput.files[0]);
        }

        return {
            id: q.id,
            question: document.getElementById(`q_text_${index}`).value,
            answer: document.getElementById(`a_text_${index}`).value,
            image_url: document.getElementById(`q_url_${index}`).value,
            explanation: document.getElementById(`q_exp_${index}`).value,
            required_count: document.getElementById(`q_count_${index}`).value,
            is_strict: document.getElementById(`q_strict_${index}`).checked,
            
            // [NEW] 삭제 여부 전송 (체크박스가 존재하고 체크되었을 때만 true)
            delete_image: deleteCheckbox ? deleteCheckbox.checked : false
        };
    });

    formData.append('quizData', JSON.stringify(updatedData));

    try {
        const res = await fetch('/api/admin_api/update-quiz', {
            method: 'POST',
            body: formData
        });
        
        if (!res.ok) throw new Error((await res.json()).error);

        alert("✅ 수정 완료!");
        const activeItem = document.querySelector('.quiz-item.active');
        const title = document.getElementById('current-quiz-title').innerText.replace('수정 중: ', '');
        loadQuizDetail(currentDbName, title, activeItem);

    } catch (err) {
        alert("❌ 저장 실패: " + err.message);
    }
}
