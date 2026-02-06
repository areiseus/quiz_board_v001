let currentDbName = null;
let currentQuestions = [];
let currentThumbnailSrc = null; // 현재 대문 이미지 저장용

document.addEventListener('DOMContentLoaded', () => {
    console.log("🔧 수정 페이지 로드됨");
    loadQuizList();
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
                <div style="font-size:0.75rem; color:#aaa; margin-top:4px;">
                     ${quiz.quiz_activate ? '🟢 활성' : '⚪ 준비중'} | 📅 ${new Date(quiz.created_at).toLocaleDateString()}
                </div>
            `;
            
            // 클릭 시 에디터 로드
            // (참고: 목록 API 최적화로 인해 quiz.thumbnail(이미지)은 없을 수 있음 -> null 처리)
            div.onclick = () => loadQuizDetail(quiz.target_db_name, quiz.title, quiz.thumbnail || null, div);
            
            container.appendChild(div);
        });

    } catch (err) {
        container.innerHTML = `<div style="color:red; padding:10px;">로드 실패: ${err.message}</div>`;
    }
}

// 2. 상세 내용 가져오기
async function loadQuizDetail(dbName, title, thumbnail, clickedElement) {
    currentDbName = dbName;
    currentThumbnailSrc = thumbnail; 
    
    // UI 활성화 효과
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
        container.innerHTML = '<div style="text-align:center; color:red;">❌ 로드 오류</div>';
    }
}

// 3. 에디터 렌더링 (대문 이미지 설정 포함 ✨)
function renderEditor(questions) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    // ==========================================
    // [A] 대문(표지) 이미지 수정 영역 (최상단 배치)
    // ==========================================
    const coverDiv = document.createElement('div');
    coverDiv.style.marginBottom = "30px";
    coverDiv.style.padding = "20px";
    coverDiv.style.border = "2px dashed #007bff";
    coverDiv.style.borderRadius = "10px";
    coverDiv.style.background = "#f8fbff";

    // ※ 주의: 목록 로딩 속도를 위해 이미지를 제외하고 가져왔다면 currentThumbnailSrc가 없을 수 있음.
    // 그럴 경우를 대비해 안내 문구를 띄워줌.
    let thumbDisplay = currentThumbnailSrc 
        ? `<img src="${currentThumbnailSrc}" style="height:120px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">` 
        : `<div style="height:120px; width:120px; background:#e9ecef; color:#888; display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:0.8rem; text-align:center; padding:10px;">
             현재 이미지<br>(미리보기 없음)
           </div>`;

    coverDiv.innerHTML = `
        <h3 style="margin-top:0; color:#007bff; display:flex; align-items:center; gap:8px;">
            🏠 대문(표지) 이미지 설정
        </h3>
        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:20px;">
            <div style="text-align:center;">
                <div style="font-size:0.8rem; font-weight:bold; margin-bottom:5px; color:#555;">현재 상태</div>
                ${thumbDisplay}
            </div>
            <div style="flex:1; min-width:250px;">
                <label style="display:block; margin-bottom:8px; font-weight:bold;">변경할 이미지 선택:</label>
                <input type="file" id="bundle_thumbnail" accept="image/*" 
                       style="padding:10px; background:white; border:1px solid #ccc; border-radius:5px; width:100%;">
                <p style="font-size:0.8rem; color:#666; margin-top:8px; line-height:1.4;">
                    ※ 파일을 선택해도 즉시 바뀌지 않습니다.<br>
                    ※ 하단의 <strong>[수정사항 저장]</strong> 버튼을 눌러야 서버에 반영됩니다.<br>
                    (최대 30MB, 자동 최적화됨)
                </p>
            </div>
        </div>
    `;
    container.appendChild(coverDiv);

    // ==========================================
    // [B] 개별 문제 렌더링
    // ==========================================
    if (questions.length === 0) {
        container.innerHTML += '<p style="padding:20px; text-align:center;">등록된 문제가 없습니다.</p>';
        return;
    }

    questions.forEach((q, index) => {
        const isStrictChecked = (q.is_strict !== false);
        const hasImage = (q.image_type || (q.image_url && q.image_url.trim() !== ''));

        const div = document.createElement('div');
        div.className = 'q-card'; // CSS 클래스 활용
        // (스타일은 CSS 파일에 맡기거나, 필요한 경우 여기에 인라인으로 유지)
        div.style.marginBottom = "20px";
        div.style.padding = "15px";
        div.style.border = "1px solid #ddd";
        div.style.borderRadius = "8px";
        div.style.background = "#fff";

        div.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                Q${q.quiz_no} <span style="font-size:0.7rem; color:#999;">(ID: ${q.id})</span>
            </div>
            
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <input type="text" id="q_text_${index}" value="${q.question}" placeholder="문제 내용" style="flex:2; padding:8px; border:1px solid #ccc; border-radius:4px;">
                <input type="text" id="a_text_${index}" value="${q.answer}" placeholder="정답" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px;">
            </div>

            <div style="margin-bottom:10px; padding:10px; background:#f8f9fa; border-radius:6px;">
                <div style="display:flex; gap:15px; margin-bottom:5px; align-items:center;">
                    <label style="font-size:0.85rem;">필요 정답 수: 
                        <input type="number" id="q_count_${index}" value="${q.required_count || 1}" min="1" style="width:50px;">
                    </label>
                    <label style="font-size:0.85rem; cursor:pointer; color:#d63384;">
                        <input type="checkbox" id="q_strict_${index}" ${isStrictChecked ? 'checked' : ''}> 🔒 완전 일치
                    </label>
                </div>
                <textarea id="q_exp_${index}" placeholder="📖 부연설명" 
                    style="width:100%; height:50px; padding:5px; border:1px solid #ccc; border-radius:4px; resize:vertical;">${q.explanation || ''}</textarea>
            </div>

            <div style="background:#fff0f0; padding:10px; border-radius:6px; border:1px solid #ffcccc;">
                <div style="font-size:0.85rem; font-weight:bold; margin-bottom:5px;">🖼️ 문제 이미지 설정</div>
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <input type="file" id="q_file_${index}" accept="image/*">
                    <span style="font-size:0.75rem; color:${hasImage ? 'blue' : '#999'};">
                        ${hasImage ? '✅ 현재 이미지 있음' : '❌ 없음'}
                    </span>
                    ${hasImage ? `
                        <label style="font-size:0.8rem; color:red; cursor:pointer; margin-left:auto;">
                            <input type="checkbox" id="q_del_img_${index}"> 🗑️ 삭제하기
                        </label>
                    ` : ''}
                </div>
                <div style="margin-top:5px;">
                    <input type="text" id="q_url_${index}" value="${q.image_url || ''}" placeholder="또는 이미지 URL 입력" style="width:100%; padding:5px; font-size:0.8rem; border:1px solid #ccc; border-radius:4px;">
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

// 4. 저장하기 (여기서 대문 이미지도 같이 전송됨! 🚀)
async function saveChanges() {
    if (!currentDbName) return;
    if (!confirm("모든 수정사항(대문 이미지 포함)을 저장하시겠습니까?")) return;

    const formData = new FormData();
    formData.append('dbName', currentDbName);

    // [핵심] 대문 이미지 파일이 선택되었으면 formData에 태워 보냄
    const bundleThumbnail = document.getElementById('bundle_thumbnail');
    if (bundleThumbnail && bundleThumbnail.files[0]) {
        console.log("📸 대문 이미지 파일 발견! 전송 준비 완료.");
        formData.append('thumbnail', bundleThumbnail.files[0]); // 서버가 'thumbnail' 이름으로 받음
    }

    // 개별 문제 데이터 수집
    const updatedData = currentQuestions.map((q, index) => {
        const fileInput = document.getElementById(`q_file_${index}`);
        const deleteCheckbox = document.getElementById(`q_del_img_${index}`);

        // 문제별 이미지가 있으면 각각의 ID 이름으로 첨부
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

    // JSON 데이터도 문자열로 변환해서 첨부
    formData.append('quizData', JSON.stringify(updatedData));

    try {
        const res = await fetch('/api/admin_api/update-quiz', {
            method: 'POST',
            body: formData
        });
        
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "알 수 없는 오류");
        }

        alert("✅ 모든 수정이 완료되었습니다!");
        
        // 성공 후 목록 새로고침 (변경된 썸네일 등을 확인하기 위해)
        location.reload(); 

    } catch (err) {
        console.error(err);
        alert("❌ 저장 실패: " + err.message);
    }
}
