document.addEventListener('DOMContentLoaded', () => {
    // 1. 파일 불러오기 이벤트 연결
    // (사용자님 원본 로직: 파일을 읽어서 변환 후 텍스트창에 덮어쓰기)
    const fileInput = document.getElementById('text-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                
                // 변환 함수 호출 (/ -> |)
                const convertedText = convertSlashToPipe(text);
                
                const textarea = document.getElementById('content');
                
                // 기존 내용이 있으면 확인
                if (textarea.value.trim() !== "") {
                    if(!confirm("기존 내용을 지우고 파일 내용으로 덮어쓰시겠습니까?")) {
                        e.target.value = ''; // 취소 시 파일 선택 초기화
                        return;
                    }
                }
                
                // 화면에 변환된 내용 출력
                textarea.value = convertedText;
                alert("✅ 불러오기 완료! 구분자가 '|'로 잘 들어갔는지 확인하세요.");
            };
            reader.readAsText(file, 'UTF-8');
        });
    }
});

// 2. 저장 함수 (사용자님 원본 로직 + 상태 메시지 기능 복구)
async function uploadQuiz() {
    // HTML 요소 가져오기
    const title = document.getElementById('title').value.trim();
    const creator = document.getElementById('creator').value.trim();
    const dbName = document.getElementById('dbName').value.trim();
    const description = document.getElementById('description') ? document.getElementById('description').value.trim() : "";
    const rawText = document.getElementById('content').value.trim();
    const fileInput = document.getElementById('thumbnail');
    
    // [복구] 상태 메시지 표시용 div
    const statusDiv = document.getElementById('status'); 
    
    // [필수] 관리자 비밀번호 (서버 보안을 위해 필요)
    const pwInput = document.getElementById('admin-pw');
    const pw = pwInput ? pwInput.value.trim() : "";

    // 유효성 검사
    if (!title || !dbName || !rawText) {
        alert("필수 항목(제목, DB명, 문제)을 입력해주세요.");
        return;
    }
    
    if (!pw) {
        alert("관리자 비밀번호를 입력해주세요.");
        return;
    }

    // 파이프(|) 기준으로 파싱 (사용자님 원본 로직)
    const lines = rawText.split('\n');
    const quizzes = [];
    
    lines.forEach((line) => {
        line = line.trim();
        if (!line) return; // 빈 줄 무시

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

    // 데이터 준비
    const formData = new FormData();
    formData.append('title', title);
    formData.append('creator', creator);
    formData.append('dbName', dbName);
    formData.append('description', description);
    formData.append('quizData', JSON.stringify(quizzes));
    
    if (fileInput && fileInput.files[0]) {
        formData.append('thumbnail', fileInput.files[0]);
    }

    // [복구] 상태 메시지 업데이트 UI 로직
    if (statusDiv) {
        statusDiv.innerText = "⏳ DB 생성 및 저장 중...";
        statusDiv.style.color = "blue";
    }

    // 버튼 잠금
    const btn = document.querySelector('button[onclick="uploadQuiz()"]');
    if(btn) { btn.disabled = true; }

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

        // 2. 서버 전송 (경로 수정됨: /api/admin_api/create-quiz)
        const response = await fetch('/api/admin_api/create-quiz', {
            method: 'POST',
            body: formData 
        });
        
        const result = await response.json();

        if (response.ok) {
            // [복구] 성공 메시지 처리
            if (statusDiv) {
                statusDiv.innerText = "✅ 성공!";
                statusDiv.style.color = "green";
            }
            alert("저장 완료! DB가 생성되었습니다.");
            location.reload(); 
        } else {
            throw new Error(result.error || "알 수 없는 서버 오류");
        }

    } catch (error) {
        // [복구] 에러 메시지 처리
        if (statusDiv) {
            statusDiv.innerText = "❌ 오류: " + error.message;
            statusDiv.style.color = "red";
        }
        alert("오류 발생: " + error.message);
    } finally {
        if(btn) { btn.disabled = false; }
    }
}

// [유틸] 파일 내용 변환기 ( / -> | ) 
// 사용자님 원본 로직 그대로 유지
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
            // 구분자 못 찾음 -> 원본 유지 (사용자가 직접 수정하도록)
            result += safeLine.replace(/###SLASH###/g, '/') + "\n";
        }
    });

    return result;
}
