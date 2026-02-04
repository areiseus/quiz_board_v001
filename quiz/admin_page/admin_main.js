document.addEventListener('DOMContentLoaded', () => {
    // 1. 파일 불러오기: 슬래시(/)를 파이프(|)로 자동 변환 (사용자님 코드 복구)
    const fileInput = document.getElementById('text-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                // 변환 함수 호출
                const convertedText = convertSlashToPipe(text);
                
                const textarea = document.getElementById('content');
                if (textarea.value.trim() !== "") {
                    if(!confirm("기존 내용을 지우고 파일 내용으로 덮어쓰시겠습니까?")) {
                         e.target.value = ''; // 취소 시 파일 입력 초기화
                         return;
                    }
                }
                textarea.value = convertedText;
                // alert("✅ 불러오기 완료! 구분자가 '|'로 잘 들어갔는지 확인하세요.");
            };
            reader.readAsText(file, 'UTF-8');
        });
    }
});

// 2. 저장 함수 (화면의 텍스트박스 내용을 읽어서 서버로 전송)
async function uploadQuiz() {
    const title = document.getElementById('title').value.trim();
    const creator = document.getElementById('creator').value.trim();
    const dbName = document.getElementById('dbName').value.trim();
    // description이 없을 경우를 대비해 예외처리
    const descEl = document.getElementById('description');
    const description = descEl ? descEl.value.trim() : "";
    
    // ★ 화면에 보이는 텍스트박스 값 가져오기
    const rawText = document.getElementById('content').value.trim();
    const fileInput = document.getElementById('thumbnail');
    
    // 비밀번호 필드 (HTML에 id="admin-pw"가 있다고 가정)
    const pwInput = document.getElementById('admin-pw');
    const pw = pwInput ? pwInput.value.trim() : "";

    if (!title || !dbName || !rawText || !pw) {
        alert("필수 항목(제목, DB명, 문제내용, 관리자비번)을 입력해주세요.");
        return;
    }

    // 파이프(|) 기준으로 파싱
    const lines = rawText.split('\n');
    const quizzes = [];
    
    lines.forEach((line) => {
        line = line.trim();
        if (!line) return;

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
    
    if (fileInput && fileInput.files[0]) {
        formData.append('thumbnail', fileInput.files[0]);
    }

    // 버튼 잠금
    const btn = document.querySelector('button[onclick="uploadQuiz()"]');
    if(btn) { btn.innerText = "생성 중..."; btn.disabled = true; }

    try {
        // 1. 비밀번호 검증
        const verifyRes = await fetch('/api/admin_api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });

        if (!verifyRes.ok) {
            throw new Error("관리자 비밀번호가 틀렸습니다.");
        }

        // 2. 퀴즈 생성 요청
        const response = await fetch('/api/admin_api/create-quiz', {
            method: 'POST',
            body: formData 
        });
        
        const result = await response.json();

        if (response.ok) {
            alert("✅ 저장 완료!");
            location.reload(); 
        } else {
            throw new Error(result.error || "서버 에러 발생");
        }
    } catch (error) {
        alert("❌ 오류: " + error.message);
    } finally {
        if(btn) { btn.innerText = "DB 생성 및 저장하기"; btn.disabled = false; }
    }
}

// [유틸] 파일 내용 변환기 ( / -> | ) : 사용자님 코드 원본 그대로 유지
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
        let safeLine = line.replace(/\\\//g, '###SLASH###');

        // ' / ' (공백 포함) 우선 찾고, 없으면 마지막 '/' 찾기
        let splitIndex = safeLine.indexOf(' / ');
        if (splitIndex === -1) {
            splitIndex = safeLine.lastIndexOf('/');
        }

        if (splitIndex !== -1) {
            let q = safeLine.substring(0, splitIndex).trim();
            // 구분자 오프셋 처리
            let offset = 1;
            if (safeLine.substr(splitIndex, 3) === ' / ') {
                offset = 3;
            }
            let a = safeLine.substring(splitIndex + offset).trim();

            // 임시 문자 복원
            q = q.replace(/###SLASH###/g, '/');
            a = a.replace(/###SLASH###/g, '/');

            result += `${q} | ${a}\n`;
        } else {
            // 구분자 못 찾음 -> 원본 유지
            result += safeLine.replace(/###SLASH###/g, '/') + "\n";
        }
    });

    return result;
}
