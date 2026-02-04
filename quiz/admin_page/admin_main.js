// [전역 변수] 로그인 성공한 비밀번호 저장용
let verifiedPassword = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. 비밀번호 입력창에서 엔터 치면 로그인 되게 하기
    const entryInput = document.getElementById('entry-password');
    if (entryInput) {
        entryInput.focus();
        entryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkAdminLogin();
        });
    }

    // 2. 텍스트 파일 불러오기 기능 (사용자님 원본 기능 100% 유지)
    const fileInput = document.getElementById('text-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                
                // 슬래시 -> 파이프 변환 함수 호출
                const convertedText = convertSlashToPipe(text);
                
                const textarea = document.getElementById('content');
                
                // 이미 내용이 있으면 덮어쓸지 확인
                if (textarea.value.trim() !== "") {
                    if(!confirm("기존 내용을 지우고 파일 내용으로 덮어쓰시겠습니까?")) {
                        e.target.value = ''; // 취소 시 파일 선택 초기화
                        return;
                    }
                }
                
                // 화면에 뿌려줌 (서버 전송 아님)
                textarea.value = convertedText;
            };
            reader.readAsText(file, 'UTF-8');
        });
    }
});

// [기능 1] 관리자 로그인 체크 (모달창에서 실행)
async function checkAdminLogin() {
    const inputPw = document.getElementById('entry-password').value.trim();
    if (!inputPw) {
        alert("비밀번호를 입력해주세요.");
        return;
    }

    try {
        // 서버의 환경변수와 일치하는지 확인
        const res = await fetch('/api/admin_api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: inputPw })
        });

        if (res.ok) {
            // 성공 시 비밀번호 저장 후 모달 닫기
            verifiedPassword = inputPw;
            document.getElementById('login-overlay').style.display = 'none';
        } else {
            alert("❌ 비밀번호가 틀렸습니다.");
            document.getElementById('entry-password').value = '';
            document.getElementById('entry-password').focus();
        }
    } catch (err) {
        alert("서버 연결 오류: " + err.message);
    }
}

// [기능 2] 퀴즈 DB 생성 및 저장 (저장 버튼 클릭 시)
async function uploadQuiz() {
    // 로그인이 안 된 상태면 차단
    if (!verifiedPassword) {
        alert("관리자 인증이 필요합니다. 새로고침 후 로그인해주세요.");
        location.reload();
        return;
    }

    const title = document.getElementById('title').value.trim();
    const creator = document.getElementById('creator').value.trim();
    const dbName = document.getElementById('dbName').value.trim();
    const description = document.getElementById('description').value.trim();
    const rawText = document.getElementById('content').value.trim();
    const thumbnailInput = document.getElementById('thumbnail');
    const statusDiv = document.getElementById('status'); // 상태 표시용

    // 유효성 검사
    if (!title || !dbName || !rawText) {
        alert("필수 항목(제목, DB명, 문제내용)을 입력해주세요.");
        return;
    }

    const dbNameRegex = /^[a-z0-9_]+$/;
    if (!dbNameRegex.test(dbName)) {
        alert("DB 이름은 영어 소문자, 숫자, 언더바(_)만 가능합니다.");
        return;
    }

    // 텍스트 내용 파싱 (파이프 | 기준)
    const lines = rawText.split('\n');
    const quizzes = [];
    
    lines.forEach((line) => {
        line = line.trim();
        if (!line) return;
        
        if (line.includes('|')) {
            const parts = line.split('|');
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

    // UI 상태 업데이트
    const btn = document.querySelector('.save-btn');
    if (btn) { btn.innerText = "생성 중..."; btn.disabled = true; }
    if (statusDiv) { statusDiv.innerText = "⏳ 업로드 진행 중..."; statusDiv.style.color = "blue"; }

    try {
        // 데이터 준비
        const formData = new FormData();
        formData.append('title', title);
        formData.append('creator', creator);
        formData.append('dbName', dbName);
        formData.append('description', description);
        formData.append('quizData', JSON.stringify(quizzes));
        
        if (thumbnailInput && thumbnailInput.files[0]) {
            formData.append('thumbnail', thumbnailInput.files[0]);
        }

        // 1. 저장 직전 비밀번호 재검증 (보안)
        const verifyRes = await fetch('/api/admin_api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: verifiedPassword }) 
        });

        if (!verifyRes.ok) throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");

        // 2. 실제 생성 요청
        const response = await fetch('/api/admin_api/create-quiz', {
            method: 'POST',
            body: formData 
        });

        if (response.ok) {
            if (statusDiv) { statusDiv.innerText = "✅ 성공!"; statusDiv.style.color = "green"; }
            alert("🎉 저장 완료! DB가 생성되었습니다.");
            location.reload(); 
        } else {
            const result = await response.json();
            throw new Error(result.error || "서버 오류");
        }

    } catch (error) {
        if (statusDiv) { statusDiv.innerText = "❌ 오류: " + error.message; statusDiv.style.color = "red"; }
        alert("오류 발생: " + error.message);
    } finally {
        if (btn) { btn.innerText = "💾 DB 생성 및 저장하기"; btn.disabled = false; }
    }
}

// [유틸] 변환기 (사용자님 코드 원본)
function convertSlashToPipe(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
    let result = "";

    lines.forEach(line => {
        if (line.includes('|') && !line.includes('/')) {
            result += line + "\n";
            return;
        }
        let safeLine = line.replace(/\\\//g, '###SLASH###');
        let splitIndex = safeLine.indexOf(' / ');
        if (splitIndex === -1) {
            splitIndex = safeLine.lastIndexOf('/');
        }

        if (splitIndex !== -1) {
            let q = safeLine.substring(0, splitIndex).trim();
            let offset = 1;
            if (safeLine.substr(splitIndex, 3) === ' / ') {
                offset = 3;
            }
            let a = safeLine.substring(splitIndex + offset).trim();

            q = q.replace(/###SLASH###/g, '/');
            a = a.replace(/###SLASH###/g, '/');

            result += `${q} | ${a}\n`;
        } else {
            result += safeLine.replace(/###SLASH###/g, '/') + "\n";
        }
    });

    return result;
}
