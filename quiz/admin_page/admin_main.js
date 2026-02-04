let parsedQuizData = [];

document.addEventListener('DOMContentLoaded', () => {
    // 페이지 로드 시 이벤트 연결
    const fileInput = document.getElementById('quiz-file');
    const textArea = document.getElementById('quiz-text-area');

    if (fileInput) {
        fileInput.addEventListener('change', loadFileToTextarea);
    }
    if (textArea) {
        textArea.addEventListener('input', parseTextFromArea);
    }
});

// [기능 1] 파일을 읽어서 텍스트 박스에 '뿌려주는' 함수 (이게 빠져있었음!)
async function loadFileToTextarea() {
    const fileInput = document.getElementById('quiz-file');
    const file = fileInput.files[0];
    
    if (!file) return;

    // 파일을 텍스트로 읽음
    const text = await file.text();
    
    // ★ 핵심: 읽은 내용을 화면의 텍스트 박스에 집어넣음
    const textArea = document.getElementById('quiz-text-area');
    textArea.value = text;
    
    // 넣은 즉시 미리보기 갱신
    parseTextFromArea();
}

// [기능 2] 텍스트 박스의 내용을 분석해서 미리보기 만들기
function parseTextFromArea() {
    const textArea = document.getElementById('quiz-text-area');
    const text = textArea.value;
    const lines = text.split('\n');
    
    parsedQuizData = []; // 초기화
    const preview = document.getElementById('preview-area');
    preview.innerHTML = ''; // 미리보기 초기화

    let questionCount = 0;

    lines.forEach((line) => {
        line = line.trim();
        if (!line) return;

        // [형식 유연하게 변경] 
        // 기존: [문제 1] 질문 | 정답
        // 변경: 질문 | 정답 (앞에 번호 없어도 됨)
        
        // 파이프(|)로 질문과 정답을 나눔
        const parts = line.split('|');
        
        if (parts.length >= 2) {
            questionCount++;
            // 앞부분은 질문, 뒷부분은 정답 (혹시 파이프가 여러개면 뒤는 다 합침)
            const question = parts[0].trim();
            const answer = parts.slice(1).join('|').trim(); // 정답에 |가 있을 수도 있으니

            // 번호는 자동으로 매김
            parsedQuizData.push({ 
                no: questionCount, 
                question: question, 
                answer: answer 
            });

            // 미리보기 한 줄 추가
            const p = document.createElement('div');
            p.style.borderBottom = "1px solid #eee";
            p.style.padding = "5px";
            p.innerHTML = `
                <span style="font-weight:bold; color:#007bff;">Q${questionCount}.</span> ${question} <br> 
                <span style="font-weight:bold; color:#28a745;">A.</span> ${answer}
            `;
            preview.appendChild(p);
        }
    });

    // 결과 메시지
    if (parsedQuizData.length === 0 && text.trim().length > 0) {
        // 글자는 있는데 파싱이 안 된 경우
        const warning = document.createElement('div');
        warning.innerHTML = `<span style='color:red;'>⚠️ 형식이 올바르지 않습니다.<br>"질문 | 정답" 형식으로 작성해주세요. (가운데 | 기호 필수)</span>`;
        preview.prepend(warning);
    } else if (parsedQuizData.length > 0) {
        const info = document.createElement('div');
        info.innerHTML = `<b>✅ 총 ${parsedQuizData.length}문제 인식 완료</b>`;
        info.style.marginBottom = "10px";
        preview.prepend(info);
    }
}

// [기능 3] 서버로 전송 (DB 생성)
async function uploadQuiz() {
    // 현재 텍스트 박스 내용을 기준으로 최종 파싱 (수정사항 반영 위해)
    parseTextFromArea();

    if (parsedQuizData.length === 0) {
        alert("입력된 문제가 없습니다. '질문 | 정답' 형식으로 입력해주세요.");
        return;
    }

    const title = document.getElementById('quiz-title').value.trim();
    const dbName = document.getElementById('db-name').value.trim();
    const creator = document.getElementById('creator-name').value.trim();
    const pw = document.getElementById('admin-pw').value.trim();
    const thumbnailInput = document.getElementById('thumbnail-file');

    if (!title || !dbName || !pw) {
        alert("제목, DB명, 관리자 비밀번호를 모두 입력해주세요.");
        return;
    }

    const dbNameRegex = /^[a-z0-9_]+$/;
    if (!dbNameRegex.test(dbName)) {
        alert("DB 이름은 영어 소문자, 숫자, 언더바(_)만 가능합니다.");
        return;
    }

    // 로딩 표시
    const btn = document.querySelector('button[onclick="uploadQuiz()"]');
    const originalText = btn.innerText;
    btn.innerText = "업로드 중... ⏳";
    btn.disabled = true;

    try {
        // 1. 비밀번호 확인
        const verifyRes = await fetch('/api/admin_api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
        
        if (!verifyRes.ok) {
            throw new Error("비밀번호가 틀렸습니다.");
        }

        // 2. 데이터 전송
        const formData = new FormData();
        formData.append('title', title);
        formData.append('dbName', dbName);
        formData.append('creator', creator);
        formData.append('description', '설명 없음'); 
        formData.append('quizData', JSON.stringify(parsedQuizData)); // 파싱된 데이터 전송

        if (thumbnailInput && thumbnailInput.files[0]) {
            formData.append('thumbnail', thumbnailInput.files[0]);
        }

        const res = await fetch('/api/admin_api/create-quiz', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            alert("🎉 퀴즈 등록 성공!");
            location.reload(); 
        } else {
            const err = await res.json();
            throw new Error(err.error || "서버 오류");
        }

    } catch (err) {
        alert("❌ 오류: " + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
