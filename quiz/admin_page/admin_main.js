// 1. 파일 불러오기: 슬래시(/)를 파이프(|)로 자동 변환
document.getElementById('text-file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        // 변환 함수 호출
        const convertedText = convertSlashToPipe(text);
        
        const textarea = document.getElementById('content');
        if (textarea.value.trim() !== "") {
            if(!confirm("기존 내용을 지우고 파일 내용으로 덮어쓰시겠습니까?")) return;
        }
        textarea.value = convertedText;
        alert("✅ 불러오기 완료! 구분자가 '|'로 잘 들어갔는지 확인하세요.");
    };
    reader.readAsText(file, 'UTF-8');
});

// 2. 저장 함수 (기존 방식 유지)
async function uploadQuiz() {
    const title = document.getElementById('title').value.trim();
    const creator = document.getElementById('creator').value.trim();
    const dbName = document.getElementById('dbName').value.trim();
    const description = document.getElementById('description').value.trim();
    const rawText = document.getElementById('content').value.trim();
    const fileInput = document.getElementById('thumbnail');
    const statusDiv = document.getElementById('status');

    if (!title || !dbName || !rawText) {
        alert("필수 항목(제목, DB명, 문제)을 입력해주세요.");
        return;
    }

    // 파이프(|) 기준으로 파싱
    const lines = rawText.split('\n');
    const quizzes = [];
    
    lines.forEach((line) => {
        if (line.includes('|')) {
            const parts = line.split('|');
            // 첫 번째 파이프만 구분자로 사용
            const q = parts[0].trim();
            const a = parts.slice(1).join('|').trim();

            if (q && a) {
                quizzes.push({
                    no: quizzes.length + 1,
                    question: q,
                    answer: a
                });
            }
        }
    });

    if (quizzes.length === 0) {
        alert("저장할 문제가 없습니다. '문제 | 정답' 형식을 확인해주세요.");
        return;
    }

    if (!confirm(`총 ${quizzes.length}개의 문제를 저장하시겠습니까?`)) return;

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
        statusDiv.innerText = "⏳ DB 생성 중...";
        statusDiv.style.color = "blue";
        
        const response = await fetch('/api/admin/create-quiz', {
            method: 'POST',
            body: formData 
        });
        const result = await response.json();

        if (response.ok) {
            statusDiv.innerText = "✅ 성공!";
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

// [유틸] 파일 내용 변환기 ( / -> | )
function convertSlashToPipe(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
    let result = "";

    lines.forEach(line => {
        // 이미 파이프가 있으면 건드리지 않음
        if (line.includes('|') && !line.includes('/')) {
            result += line + "\n";
            return;
        }

        // 구분자 '/' 찾기 (문제 안의 \/ 는 제외)
        // 안전하게 처리하기 위해 임시 문자로 치환
        let safeLine = line.replace(/\\\//g, '###SLASH###');

        // ' / ' (공백 포함) 우선 찾고, 없으면 마지막 '/' 찾기
        let splitIndex = safeLine.indexOf(' / ');
        if (splitIndex === -1) {
            splitIndex = safeLine.lastIndexOf('/');
        }

        if (splitIndex !== -1) {
            let q = safeLine.substring(0, splitIndex).trim();
            // 구분자가 ' / ' 였으면 3칸 뒤, '/' 였으면 1칸 뒤
            let offset = safeLine[splitIndex] === ' ' ? 3 : 1; 
            let a = safeLine.substring(splitIndex + offset).trim();

            // 임시 문자 복원
            q = q.replace(/###SLASH###/g, '/');
            a = a.replace(/###SLASH###/g, '/');

            result += `${q} | ${a}\n`;
        } else {
            // 구분자 못 찾음 -> 원본 유지 (사용자가 직접 수정하도록)
            result += safeLine.replace(/###SLASH###/g, '/') + "\n";
        }
    });

    return result;
}
