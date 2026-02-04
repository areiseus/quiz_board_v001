// 파일 선택 시 자동으로 처리하는 이벤트 리스너 등록
document.getElementById('text-file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        // 1. 텍스트를 분석해서 표준 형식(문제 | 정답)으로 변환
        const convertedText = convertToStandardFormat(text);
        
        // 2. 변환된 내용을 입력창에 채워넣기
        const textarea = document.getElementById('content');
        if (textarea.value.trim() !== "") {
            if(!confirm("기존에 입력된 내용이 있습니다. 덮어쓰시겠습니까?")) return;
        }
        textarea.value = convertedText;
        alert("✅ 파일 내용을 불러왔습니다! 오타가 없는지 확인해주세요.");
    };
    reader.readAsText(file, 'UTF-8'); // 한글 깨짐 방지
});

// [저장 버튼 클릭 시 실행] - 이제는 입력창에 있는 내용만 믿고 저장하면 됩니다.
async function uploadQuiz() {
    const title = document.getElementById('title').value.trim();
    const creator = document.getElementById('creator').value.trim();
    const dbName = document.getElementById('dbName').value.trim();
    const description = document.getElementById('description').value.trim();
    const rawText = document.getElementById('content').value.trim();
    const fileInput = document.getElementById('thumbnail');
    const statusDiv = document.getElementById('status');

    if (!title || !dbName || !rawText) {
        alert("제목, DB명, 문제 내용은 필수입니다!");
        return;
    }

    // 입력창 내용을 파싱 (이제는 무조건 '문제 | 정답' 형식만 처리하면 됨)
    const lines = rawText.split('\n');
    const quizzes = [];
    
    lines.forEach((line, index) => {
        if (line.includes('|')) {
            const [q, a] = line.split('|');
            if (q.trim() && a.trim()) {
                quizzes.push({
                    no: quizzes.length + 1,
                    question: q.trim(),
                    answer: a.trim()
                });
            }
        }
    });

    if (quizzes.length === 0) {
        alert("저장할 문제가 없습니다. '문제 | 정답' 형식을 확인해주세요.");
        return;
    }

    // 서버 전송 로직 (기존과 동일)
    const formData = new FormData();
    formData.append('title', title);
    formData.append('creator', creator);
    formData.append('dbName', dbName);
    formData.append('description', description);
    formData.append('quizData', JSON.stringify(quizzes));
    
    if (fileInput.files[0]) {
        formData.append('thumbnail', fileInput.files[0]);
    }

    try {
        statusDiv.innerText = "⏳ 저장 중입니다...";
        statusDiv.style.color = "blue";

        const response = await fetch('/api/admin/create-quiz', {
            method: 'POST',
            body: formData 
        });

        const result = await response.json();

        if (response.ok) {
            statusDiv.innerText = "✅ 성공: " + result.message;
            statusDiv.style.color = "green";
            alert("저장 완료!");
            location.reload(); 
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        statusDiv.innerText = "❌ 오류: " + error.message;
        statusDiv.style.color = "red";
    }
}

// [스마트 변환 함수] 어떤 형식이든 '문제 | 정답'으로 바꿔주는 번역기
function convertToStandardFormat(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
    let resultString = "";

    // 전략 1: 이미 '문제 | 정답' 형식이면 그대로 둠
    if (lines.some(l => l.includes('|'))) {
        return lines.join('\n'); 
    }

    // 전략 2: Q. / A. 키워드 감지
    const hasKeywords = lines.some(l => /^(Q|q|문|질문)[\.:\s]/.test(l));
    if (hasKeywords) {
        let currentQ = null;
        lines.forEach(line => {
            if (/^(Q|q|문|질문|[0-9]+)[\.:\)\s]/.test(line)) {
                currentQ = line.replace(/^(Q|q|문|질문|[0-9]+)[\.:\)\s]+/, '').trim();
            } else if (/^(A|a|답|정답)[\.:\s]/.test(line) && currentQ) {
                const ans = line.replace(/^(A|a|답|정답)[\.:\s]+/, '').trim();
                resultString += `${currentQ} | ${ans}\n`;
                currentQ = null;
            }
        });
        return resultString;
    }

    // 전략 3: 그냥 줄바꿈 (홀수줄: 문제, 짝수줄: 답)
    for (let i = 0; i < lines.length - 1; i += 2) {
        resultString += `${lines[i]} | ${lines[i+1]}\n`;
    }

    return resultString;
}
