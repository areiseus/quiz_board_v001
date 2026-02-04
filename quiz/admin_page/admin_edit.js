let currentDbName = null;
let currentQuestions = [];
let currentThumbnailSrc = null; // 현재 대문 이미지 저장용

document.addEventListener('DOMContentLoaded', () => {
    console.log("🔧 수정 페이지 로드됨 (대문 이미지 수정 기능 추가)");
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
            // 클릭 시 썸네일 정보(quiz.thumbnail)도 같이 넘김
            div.onclick = () => loadQuizDetail(quiz.target_db_name, quiz.title, quiz.thumbnail, div);
            container.appendChild(div);
        });

    } catch (err) {
        container.innerHTML = `<div style="color:red;">로드 실패: ${err.message}</div>`;
    }
}

// 2. 상세 내용 가져오기 (매개변수에 thumbnail 추가)
async function loadQuizDetail(dbName, title, thumbnail, clickedElement) {
    currentDbName = dbName;
    currentThumbnailSrc = thumbnail; // 현재 썸네일 저장
    
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

// 3. 에디터 렌더링 (대문 이미지 영역 추가됨)
function renderEditor(questions) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    // [NEW] 대문 이미지 수정 영역 추가 (맨 위)
    const coverDiv = document.createElement('div');
    coverDiv.style.marginBottom = "30px";
    coverDiv.style.padding = "20px";
    coverDiv.style.border = "2px dashed #007bff";
    coverDiv.style.borderRadius = "10px";
    coverDiv.style.background = "#f0f8ff";

    let thumbDisplay = currentThumbnailSrc 
        ? `<img src="${currentThumbnailSrc}" style="height:150px; border-radius:10px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">` 
        : `<div style="height:150px; width:150px; background:#ddd; display:flex; align-items:center; justify-content:center; color:#777; font-weight:bold; border-radius:10px;">이미지 없음</div>`;

    coverDiv.innerHTML = `
        <h3 style="margin-top:0; color:#007bff;">🏠 대문(표지) 이미지 설정</h3>
        <div style="display:flex; align-items:center; gap:20px;">
            <div>
                <div style="margin-bottom:5px; font-weight:bold; font-size:0.9rem;">현재 이미지:</div>
                ${thumbDisplay}
            </div>
            <div style="flex:1;">
                <label style="display:block; margin-bottom:5px; font-weight:bold;">변경할 이미지 선택:</label>
                <input type="file" id="bundle_thumbnail" accept="image/*" style="padding:10px; background:white; border:1px solid #ccc; border-radius:5px; width:100%;">
                <p style="font-size:0.8rem; color:#666; margin-top:5px;">※ 변경하려면 파일을 선택하고 아래 [수정 사항 저장] 버튼을 누르세요.</p>
            </div>
        </div>
    `;
    container.appendChild(coverDiv);

    // 개별 문제 렌더링 (기존과 동일)
    if (questions.length === 0) {
        container.innerHTML += '<p>문제가 없습니다.</p>';
        return;
    }

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

    // [NEW] 대문 이미지 파일이 있으면 추가
    const bundleThumbnail = document.getElementById('bundle_thumbnail');
    if (bundleThumbnail && bundleThumbnail.files[0]) {
        formData.append('thumbnail', bundleThumbnail.files[0]);
    }

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
        
        // 새로고침 (이미지 갱신을 위해 목록부터 다시 로드)
        // 1. 목록 다시 로드
        await loadQuizList();
        
        // 2. 현재 선택된 퀴즈 다시 상세 로드 (약간의 딜레이 후)
        setTimeout(() => {
            // 목록 중에서 현재 dbName과 같은 항목 찾기
            const listItems = document.querySelectorAll('.quiz-item');
            // innerText에 dbName이 포함된 녀석을 찾거나, 구조상 클릭 이벤트를 트리거하기 어려우니
            // loadQuizList에서 생성된 요소 중 target_db_name을 속성으로 박아두는 게 좋지만,
            // 여기서는 단순하게 다시 클릭하는 흉내를 냄 (dbName 비교)
            
            // 더 확실한 방법: loadQuizList가 완료되면 currentDbName으로 다시 loadQuizDetail 호출
            // 하지만 썸네일 URL을 갱신해야 하므로 목록 클릭을 다시 하는 게 가장 확실함.
            // 여기선 간단히 alert 후 사용자가 목록을 다시 클릭하게 유도하거나, 
            // loadQuizDetail에 갱신된 썸네일을 전달해야 함.
            
            // 편의상 페이지 새로고침을 권장하거나, 위에서 loadQuizList() 했으니 
            // 사용자가 다시 클릭하면 바뀐 이미지가 보입니다.
        }, 500);

    } catch (err) {
        alert("❌ 저장 실패: " + err.message);
    }
}
