let parsedQuizData = [];

// 1. 텍스트 파일 읽기 및 미리보기
async function processFile() {
    const fileInput = document.getElementById('quiz-file');
    const file = fileInput.files[0];
    
    if (!file) {
        alert("텍스트 파일을 선택해주세요.");
        return;
    }

    const text = await file.text();
    const lines = text.split('\n');
    parsedQuizData = [];

    const preview = document.getElementById('preview-area');
    preview.innerHTML = ''; // 초기화

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // 형식: [문제 1] 질문 | 정답
        const match = line.match(/^\[문제\s*(\d+)\]\s*(.+?)\s*\|\s*(.+)$/);
        
        if (match) {
            const no = match[1];
            const question = match[2].trim();
            const answer = match[3].trim();
            
            parsedQuizData.push({ no, question, answer });

            // 미리보기 추가
            const p = document.createElement('p');
            p.innerHTML = `<b>Q${no}.</b> ${question} <br> <span style="color:blue">A. ${answer}</span>`;
            p.style.borderBottom = "1px solid #eee";
            p.style.padding = "5px";
            preview.appendChild(p);
        }
    });

    if (parsedQuizData.length === 0) {
        preview.innerHTML = "<span style='color:red; font-weight:bold;'>⚠️ 파싱된 문제가 없습니다. 파일 형식을 확인해주세요.<br>예: [문제 1] 질문 | 정답</span>";
    } else {
        const countInfo = document.createElement('div');
        countInfo.innerHTML = `<br><b>✅ 총 ${parsedQuizData.length}개 문제 인식됨</b>`;
        preview.prepend(countInfo);
    }
}

// 2. 서버로 전송 (DB 생성)
async function uploadQuiz() {
    // 데이터 검증
    if (parsedQuizData.length === 0) {
        alert("먼저 텍스트 파일을 선택하고 미리보기를 확인해주세요.");
        return;
    }

    const title = document.getElementById('quiz-title').value.trim();
    const dbName = document.getElementById('db-name').value.trim();
    const creator = document.getElementById('creator-name').value.trim();
    const pw = document.getElementById('admin-pw').value.trim();
    const thumbnailInput = document.getElementById('thumbnail-file');

    if (!title || !dbName || !pw) {
        alert("제목, DB명, 관리자 비밀번호는 필수입니다.");
        return;
    }

    // DB명 유효성 검사 (영어 소문자, 숫자, 언더바만 허용)
    const dbNameRegex = /^[a-z0-9_]+$/;
    if (!dbNameRegex.test(dbName)) {
        alert("DB 이름은 '영어 소문자', '숫자', '언더바(_)'만 사용할 수 있습니다. (공백/한글 불가)");
        return;
    }

    try {
        // (1) 비밀번호 확인
        const verifyRes = await fetch('/api/admin_api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
        
        if (!verifyRes.ok) {
            alert("관리자 비밀번호가 틀렸습니다.");
            return;
        }

        // (2) 데이터 전송 (FormData)
        const formData = new FormData();
        formData.append('title', title);
        formData.append('dbName', dbName);
        formData.append('creator', creator);
        formData.append('description', '설명 없음'); 
        formData.append('quizData', JSON.stringify(parsedQuizData));

        if (thumbnailInput && thumbnailInput.files[0]) {
            formData.append('thumbnail', thumbnailInput.files[0]);
        }

        // 로딩 표시 (선택사항)
        const btn = document.querySelector('button[onclick="uploadQuiz()"]');
        const originalText = btn.innerText;
        btn.innerText = "생성 중...";
        btn.disabled = true;

        const res = await fetch('/api/admin_api/create-quiz', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            alert(data.message);
            location.reload(); // 성공 시 새로고침
        } else {
            // 에러 처리
            const errText = await res.text();
            try {
                const errJson = JSON.parse(errText);
                alert("오류: " + errJson.error);
            } catch (e) {
                console.error("서버 에러(HTML):", errText);
                alert("서버 내부 오류가 발생했습니다. (DB 생성 실패)\n이미 존재하는 DB명이거나 서버 로그를 확인하세요.");
            }
        }
        
        // 버튼 복구
        btn.innerText = originalText;
        btn.disabled = false;

    } catch (err) {
        alert("전송 중 오류 발생: " + err.message);
    }
}
