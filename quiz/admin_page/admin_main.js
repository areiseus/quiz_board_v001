document.addEventListener('DOMContentLoaded', () => {
    // [1] 파일 불러오기 이벤트 (오직 텍스트창에 뿌리기만 함)
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
                
                // 기존 내용이 있으면 확인 후 덮어쓰기
                if (textarea.value.trim() !== "") {
                    if(!confirm("기존 내용을 지우고 파일 내용으로 덮어쓰시겠습니까?")) {
                        e.target.value = ''; // 취소 시 파일 선택 초기화
                        return;
                    }
                }
                
                // ★ 서버 전송 절대 안 함. 오직 화면(textarea)에 표시만 함.
                textarea.value = convertedText;
            };
            reader.readAsText(file, 'UTF-8');
        });
    }
});

// [2] 저장 버튼 클릭 시 실행 (이때 서버로 전송)
async function uploadQuiz() {
    // HTML 요소 가져오기
    const title = document.getElementById('title').value.trim();
    const creator = document.getElementById('creator').value.trim();
    const dbName = document.getElementById('dbName').value.trim();
    const description = document.getElementById('description') ? document.getElementById('description').value.trim() : "";
    const pw = document.getElementById('admin-pw').value.trim(); 
    const thumbnailInput = document.getElementById('thumbnail');
    
    // ★ 중요: 사용자가 수정했을 수도 있는 '텍스트창(#content)'의 내용을 가져옴
    const rawText = document.getElementById('content').value.trim();
    
    // 유효성 검사
    if (!title || !dbName || !rawText || !pw) {
        alert("필수 항목(제목, DB명, 비밀번호, 문제내용)을 모두 입력해주세요.");
        return;
    }

    const dbNameRegex = /^[a-z0-9_]+$/;
    if (!dbNameRegex.test(dbName)) {
        alert("DB 이름은 영어 소문자, 숫자, 언더바(_)만 가능합니다.");
        return;
    }

    // ★ 텍스트창 내용을 줄 단위로 잘라서 파싱 (파이프 | 기준)
    const lines = rawText.split('\n');
    const quizzes = [];
    
    lines.forEach((line) => {
        line = line.trim();
        if (!line) return;

        // 사용자가 텍스트창에서 | 로 잘 수정해놨다고 가정하고 파싱
        if (line.includes('|')) {
            const parts = line.split('|');
            const q = parts[0].trim();
            const a = parts.slice(1).join('|').trim(); // 정답에 |가 있을 수 있으므로

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
        alert("저장할 문제가 없습니다. 텍스트 박스 내용이 '문제 | 정답' 형식인지 확인해주세요.");
        return;
    }

    if (!confirm(`텍스트창에 있는 총 ${quizzes.length}개의 문제를 저장하시겠습니까?`)) return;

    // 전송 시작 UI 처리
    const btn = document.querySelector('button[onclick="uploadQuiz()"]');
    const originalBtnText = btn ? btn.innerText : "저장";
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

        // 2. 데이터 전송
        const formData = new FormData();
        formData.append('title', title);
        formData.append('creator', creator);
        formData.append('dbName', dbName);
        formData.append('description', description);
        formData.append('quizData', JSON.stringify(quizzes)); // 텍스트창에서 파싱한 데이터
        
        if (thumbnailInput && thumbnailInput.files[0]) {
            formData.append('thumbnail', thumbnailInput.files[0]);
        }

        const response = await fetch('/api/admin_api/create-quiz', {
            method: 'POST',
            body: formData 
        });

        if (response.ok) {
            alert("✅ 저장 완료! DB가 생성되었습니다.");
            location.reload(); 
        } else {
            const result = await response.json();
            throw new Error(result.error || "서버 오류");
        }
    } catch (error) {
        alert("❌ 오류: " + error.message);
    } finally {
        if(btn) { btn.innerText = originalBtnText; btn.disabled = false; }
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
