let parsedQuizData = [];

// [핵심 기능 1] 텍스트 파일에서 문제와 정답 추출하기
async function processFile() {
    const fileInput = document.getElementById('quiz-file');
    const file = fileInput.files[0];
    
    if (!file) {
        alert("텍스트 파일을 선택해주세요.");
        return;
    }

    // 파일을 텍스트로 읽어옴
    const text = await file.text();
    const lines = text.split('\n');
    parsedQuizData = []; // 데이터 초기화

    const preview = document.getElementById('preview-area');
    preview.innerHTML = ''; // 미리보기창 초기화

    // 한 줄씩 분석 시작
    lines.forEach(line => {
        line = line.trim();
        if (!line) return; // 빈 줄 무시

        // ★ 정규식: "[문제 숫자] 질문 | 정답" 패턴을 찾음
        const match = line.match(/^\[문제\s*(\d+)\]\s*(.+?)\s*\|\s*(.+)$/);
        
        if (match) {
            const no = match[1];          // 문제 번호
            const question = match[2].trim(); // 질문
            const answer = match[3].trim();   // 정답
            
            // 추출한 데이터를 배열에 저장
            parsedQuizData.push({ no, question, answer });

            // 화면에 미리보기 출력
            const p = document.createElement('p');
            p.innerHTML = `<b>Q${no}.</b> ${question} <br> <span style="color:blue">A. ${answer}</span>`;
            p.style.borderBottom = "1px solid #eee";
            p.style.padding = "5px";
            preview.appendChild(p);
        }
    });

    // 결과 확인
    if (parsedQuizData.length === 0) {
        preview.innerHTML = "<span style='color:red; font-weight:bold;'>⚠️ 파싱 실패: 형식을 확인해주세요.<br>예: [문제 1] 질문 | 정답</span>";
    } else {
        const countInfo = document.createElement('div');
        countInfo.innerHTML = `<br><b>✅ 총 ${parsedQuizData.length}개 문제 추출 성공!</b>`;
        preview.prepend(countInfo);
    }
}

// [핵심 기능 2] 추출한 데이터를 서버로 보내서 DB 생성하기
async function uploadQuiz() {
    // 1. 추출된 데이터가 있는지 확인
    if (parsedQuizData.length === 0) {
        alert("먼저 텍스트 파일을 선택해서 문제를 추출해야 합니다.");
        return;
    }

    // 2. 입력값 가져오기
    const title = document.getElementById('quiz-title').value.trim();
    const dbName = document.getElementById('db-name').value.trim();
    const creator = document.getElementById('creator-name').value.trim();
    const pw = document.getElementById('admin-pw').value.trim();
    const thumbnailInput = document.getElementById('thumbnail-file');

    if (!title || !dbName || !pw) {
        alert("제목, DB명, 관리자 비밀번호는 필수입니다.");
        return;
    }

    // DB명 유효성 검사
    const dbNameRegex = /^[a-z0-9_]+$/;
    if (!dbNameRegex.test(dbName)) {
        alert("DB 이름 오류: 영어 소문자, 숫자, 언더바(_)만 가능합니다.");
        return;
    }

    try {
        // 3. 비밀번호 확인
        const verifyRes = await fetch('/api/admin_api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
        
        if (!verifyRes.ok) {
            alert("관리자 비밀번호가 틀렸습니다.");
            return;
        }

        // 4. 데이터 전송 (FormData)
        const formData = new FormData();
        formData.append('title', title);
        formData.append('dbName', dbName);
        formData.append('creator', creator);
        formData.append('description', '설명 없음'); 
        // ★ 추출한 문제 데이터를 JSON 문자열로 변환해서 전송
        formData.append('quizData', JSON.stringify(parsedQuizData));

        if (thumbnailInput && thumbnailInput.files[0]) {
            formData.append('thumbnail', thumbnailInput.files[0]);
        }

        // 로딩 표시
        const btn = document.querySelector('button[onclick="uploadQuiz()"]');
        const originalText = btn.innerText;
        btn.innerText = "생성 중...";
        btn.disabled = true;

        // 5. 서버 요청
        const res = await fetch('/api/admin_api/create-quiz', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            alert(data.message);
            location.reload(); 
        } else {
            const errText = await res.text();
            try {
                const errJson = JSON.parse(errText);
                alert("오류: " + errJson.error);
            } catch (e) {
                console.error(errText);
                alert("서버 오류가 발생했습니다. (DB 이름 중복 등 확인 필요)");
            }
        }
        
        btn.innerText = originalText;
        btn.disabled = false;

    } catch (err) {
        alert("전송 중 오류 발생: " + err.message);
    }
}
