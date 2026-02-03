async function uploadQuiz() {
    const title = document.getElementById('title').value.trim();
    const creator = document.getElementById('creator').value.trim();
    const dbName = document.getElementById('dbName').value.trim();
    const description = document.getElementById('description').value.trim();
    const rawText = document.getElementById('content').value.trim();
    const fileInput = document.getElementById('thumbnail');
    const statusDiv = document.getElementById('status');

    // 1. 필수 입력값 검사
    if (!title || !dbName || !rawText) {
        alert("제목, DB명, 문제 내용은 필수입니다!");
        return;
    }

    // 2. 텍스트 파싱 (문제 | 정답 -> 객체 변환)
    const lines = rawText.split('\n');
    const quizzes = [];
    
    lines.forEach((line, index) => {
        if (line.includes('|')) {
            const [q, a] = line.split('|');
            if (q.trim() && a.trim()) {
                quizzes.push({
                    no: index + 1,
                    question: q.trim(),
                    answer: a.trim()
                });
            }
        }
    });

    if (quizzes.length === 0) {
        alert("파싱된 문제가 없습니다. '문제 | 정답' 형식을 확인해주세요.");
        return;
    }

    // 3. 데이터 전송 준비 (FormData 사용 - 이미지 때문)
    const formData = new FormData();
    formData.append('title', title);
    formData.append('creator', creator);
    formData.append('dbName', dbName);
    formData.append('description', description);
    formData.append('quizData', JSON.stringify(quizzes)); // 배열은 문자열로 변환해서 보냄
    
    if (fileInput.files[0]) {
        formData.append('thumbnail', fileInput.files[0]);
    }

    // 4. 서버로 전송
    try {
        statusDiv.innerText = "⏳ 저장 중입니다... 잠시만 기다려주세요.";
        statusDiv.style.color = "blue";

        const response = await fetch('/api/admin/create-quiz', {
            method: 'POST',
            body: formData // JSON이 아니라 formData 자체를 보냄
        });

        const result = await response.json();

        if (response.ok) {
            statusDiv.innerText = "✅ 성공: " + result.message;
            statusDiv.style.color = "green";
            alert("퀴즈가 성공적으로 저장되었습니다!");
            // 입력창 초기화
            location.reload(); 
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        statusDiv.innerText = "❌ 오류 발생: " + error.message;
        statusDiv.style.color = "red";
    }
}
