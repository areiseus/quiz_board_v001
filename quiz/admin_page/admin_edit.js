let currentDbName = null;
let currentQuestions = [];

document.addEventListener('DOMContentLoaded', () => {
    loadQuizList();
    
    // [NEW] 파일 선택 시 즉시 미리보기 기능 추가!
    const thumbInput = document.getElementById('bundle_thumbnail'); // 나중에 동적으로 생기지만 이벤트 위임 혹은 생성 후 연결 필요
    // 동적 생성 요소라 아래 renderEditor 안에서 이벤트 연결함
});

// 1. 목록 불러오기
async function loadQuizList() {
    const container = document.getElementById('quiz-list-container');
    container.innerHTML = '<div style="padding:10px; color:#666;">⏳ 목록 로딩 중...</div>';

    try {
        const res = await fetch('/api/admin_api/list-quizzes');
        if (!res.ok) throw new Error(await res.text());

        const list = await res.json();
        container.innerHTML = '';
        
        if (list.length === 0) {
            container.innerHTML = '<div style="padding:10px;">등록된 퀴즈가 없습니다.</div>';
            return;
        }

        list.forEach(quiz => {
            const div = document.createElement('div');
            div.className = 'quiz-item';
            div.innerHTML = `
                <div style="font-size:1rem; font-weight:bold;">${quiz.title}</div>
                <div style="font-size:0.8rem; color:#666;">DB: ${quiz.target_db_name}</div>
            `;
            // 여기선 이미지가 안 보여도 됨 (클릭하면 상세에서 보이니까)
            div.onclick = () => loadQuizDetail(quiz.target_db_name, quiz.title, div);
            container.appendChild(div);
        });

    } catch (err) {
        container.innerHTML = `<div style="color:red; padding:10px;">로드 실패: ${err.message}</div>`;
    }
}

// 2. 상세 내용 가져오기
async function loadQuizDetail(dbName, title, clickedElement) {
    currentDbName = dbName;
    
    // UI 활성화
    document.querySelectorAll('.quiz-item').forEach(el => el.classList.remove('active'));
    clickedElement.classList.add('active');
    
    document.getElementById('current-quiz-title').innerText = `수정 중: ${title}`;
    document.getElementById('editor-area').style.display = 'block';

    const container = document.getElementById('questions-container');
    container.innerHTML = '<div style="text-align:center; padding:20px;">⏳ 데이터 로딩 중...</div>';

    try {
        const res = await fetch(`/api/admin_api/get-quiz-detail?dbName=${dbName}`);
        if (!res.ok) throw new Error("로드 실패");

        currentQuestions = await res.json();
        renderEditor(currentQuestions);

    } catch (err) {
        alert("오류: " + err.message);
    }
}

// 3. 에디터 렌더링 (미리보기 기능 완벽 구현 ✨)
function renderEditor(questions) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    // [A] 대문 이미지 영역
    const coverDiv = document.createElement('div');
    coverDiv.style.cssText = "margin-bottom:30px; padding:20px; border:2px dashed #007bff; border-radius:10px; background:#f8fbff;";

    // ★ 핵심: 이미지를 URL로 불러옴! (타임스탬프 붙여서 캐시 방지)
    const imageUrl = `/api/admin_api/thumbnail?dbName=${currentDbName}&t=${new Date().getTime()}`;

    coverDiv.innerHTML = `
        <h3 style="margin-top:0; color:#007bff;">🏠 대문(표지) 이미지 설정</h3>
        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:20px;">
            <div style="text-align:center;">
                <div style="font-size:0.8rem; font-weight:bold; margin-bottom:5px; color:#555;">현재/변경 이미지</div>
                <img id="thumb-preview" src="${imageUrl}" 
                     onerror="this.src='https://via.placeholder.com/150?text=No+Image'" 
                     style="height:150px; width:auto; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.2); object-fit:contain;">
            </div>
            <div style="flex:1; min-width:250px;">
                <label style="display:block; margin-bottom:8px; font-weight:bold;">이미지 변경:</label>
                <input type="file" id="bundle_thumbnail" accept="image/*" onchange="previewThumbnail(this)"
                       style="padding:10px; background:white; border:1px solid #ccc; border-radius:5px; width:100%;">
                <p style="font-size:0.8rem; color:#666; margin-top:8px;">
                    ※ 파일을 선택하면 바로 미리보기가 바뀝니다.<br>
                    ※ <strong>[수정사항 저장]</strong>을 눌러야 최종 반영됩니다.
                </p>
            </div>
        </div>
    `;
    container.appendChild(coverDiv);

    // [B] 문제 목록 렌더링 (기존과 동일)
    if (questions.length === 0) {
        container.innerHTML += '<p>등록된 문제가 없습니다.</p>';
        return;
    }

    questions.forEach((q, index) => {
        // ... (기존 문제 렌더링 코드와 동일)
        const hasImage = (q.image_type || (q.image_url && q.image_url.trim() !== ''));
        const div = document.createElement('div');
        div.className = 'q-card';
        div.style.cssText = "margin-bottom:20px; padding:15px; border:1px solid #ddd; border-radius:8px; background:#fff;";
        
        div.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px;">Q${q.quiz_no}</div>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <input type="text" id="q_text_${index}" value="${q.question}" placeholder="문제" style="flex:2; padding:5px;">
                <input type="text" id="a_text_${index}" value="${q.answer}" placeholder="정답" style="flex:1; padding:5px;">
            </div>
            <div style="margin-bottom:10px;">
                <textarea id="q_exp_${index}" placeholder="설명" style="width:100%; height:50px;">${q.explanation || ''}</textarea>
            </div>
            <div style="background:#fff0f0; padding:10px; border-radius:5px;">
                <div style="font-size:0.8rem; font-weight:bold;">이미지 설정</div>
                <input type="file" id="q_file_${index}" accept="image/*">
                ${hasImage ? `<label><input type="checkbox" id="q_del_img_${index}"> 이미지 삭제</label>` : ''}
            </div>
        `;
        container.appendChild(div);
    });
}

// ★ [NEW] 파일 선택 시 즉시 미리보기 함수
function previewThumbnail(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('thumb-preview').src = e.target.result; // 이미지 src 교체
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// 4. 저장하기
async function saveChanges() {
    if (!currentDbName) return;
    if (!confirm("저장하시겠습니까?")) return;

    const formData = new FormData();
    formData.append('dbName', currentDbName);

    // 대문 이미지
    const thumbInput = document.getElementById('bundle_thumbnail');
    if (thumbInput && thumbInput.files[0]) {
        formData.append('thumbnail', thumbInput.files[0]);
    }

    // 문제 데이터 수집
    const updatedData = currentQuestions.map((q, index) => {
        const fileInput = document.getElementById(`q_file_${index}`);
        const delCheck = document.getElementById(`q_del_img_${index}`);
        
        if (fileInput && fileInput.files[0]) {
            formData.append(`file_${q.id}`, fileInput.files[0]);
        }
        
        return {
            id: q.id,
            question: document.getElementById(`q_text_${index}`).value,
            answer: document.getElementById(`a_text_${index}`).value,
            explanation: document.getElementById(`q_exp_${index}`).value,
            delete_image: delCheck ? delCheck.checked : false,
            // ... 나머지 필드 (required_count 등) 필요시 추가
        };
    });

    formData.append('quizData', JSON.stringify(updatedData));

    try {
        const res = await fetch('/api/admin_api/update-quiz', { method: 'POST', body: formData });
        if (!res.ok) throw new Error("저장 실패");
        alert("✅ 저장 완료!");
        location.reload();
    } catch (e) {
        alert(e.message);
    }
}
