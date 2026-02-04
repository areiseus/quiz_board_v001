let parsedQuizData = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. 파일 선택 시 -> 변환 후 textarea에 넣기
    const fileInput = document.getElementById('quiz-file');
    if (fileInput) {
        fileInput.addEventListener('change', loadFileToTextarea);
    }

    // 2. textarea 수정 시 -> 미리보기 갱신
    const textArea = document.getElementById('quiz-text-area');
    if (textArea) {
        textArea.addEventListener('input', parseTextFromArea);
    }
});

// [기능 1] 파일 불러오기 + 슬래시(/)를 파이프(|)로 변환 (기존 로직 복구)
function loadFileToTextarea(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        
        // ★ 기존 코드의 변환 로직 적용
        const convertedText = convertSlashToPipe(text);
        
        const textarea = document.getElementById('quiz-text-area');
        
        // 내용이 있으면 덮어쓸지 물어봄
        if (textarea.value.trim() !== "") {
            if(!confirm("기존 내용을 지우고 파일 내용으로 덮어쓰시겠습니까?")) return;
        }
        
        textarea.value = convertedText;
        
        // 변환된 내용으로 미리보기 갱신
        parseTextFromArea();
        
        alert("✅ 파일 불러오기 완료! 구분자가 '|'로 잘 들어갔는지 확인하세요.");
    };
    reader.readAsText(file, 'UTF-8');
}

// [기능 2] 텍스트 박스 내용을 분석해서 미리보기 만들기 (파이프 | 기준)
function parseTextFromArea() {
    const textArea = document.getElementById('quiz-text-area');
    const text = textArea.value;
    const lines = text.split('\n');
    
    parsedQuizData = []; 
    const preview = document.getElementById('preview-area');
    preview.innerHTML = ''; 

    let questionCount = 0;

    lines.forEach((line) => {
        line = line.trim();
        if (!line) return;

        // ★ 파이프(|) 기준으로 문제와 정답 분리 (기존 로직)
        if (line.includes('|')) {
            const parts = line.split('|');
            // 첫 번째 파이프만 구분자로 사용, 나머지는 정답에 포함
            const q = parts[0].trim();
            const a = parts.slice(1).join('|').trim();

            if (q && a) {
                questionCount++;
                parsedQuizData.push({ 
                    no: questionCount, 
                    question: q, 
                    answer: a 
                });

                // 미리보기 출력
                const p = document.createElement('div');
                p.style.borderBottom = "1px solid #eee";
                p.style.padding = "5px";
                p.innerHTML = `
                    <span style="font-weight:bold; color:#007bff;">Q${questionCount}.</span> ${q} <br> 
                    <span style="font-weight:bold; color:#28a745;">A.</span> ${a}
                `;
                preview.appendChild(p);
            }
        }
    });

    // 상태 메시지
    if (parsedQuizData.length === 0 && text.trim().length > 0) {
        const warning = document.createElement('div');
        warning.innerHTML = `<span style='color:red;'>⚠️ 형식이 올바르지 않습니다.<br>"문제 | 정답" 형식이어야 합니다. ('|' 기호 확인)</span>`;
        preview.prepend(warning);
    } else if (parsedQuizData.length > 0) {
        const info = document.createElement('div');
        info.innerHTML = `<b>✅ 총 ${parsedQuizData.length}개 문제 인식됨</b>`;
        info.style.marginBottom = "10px";
        preview.prepend(info);
    }
}

// [유틸] 파일 내용 변환기 ( / -> | ) : 기존 코드 그대로 사용
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
        
        // 만약 ' / '가 없으면 그냥 맨 뒤의 '/'를 찾음 (기존 로직)
        if (splitIndex === -1) {
            splitIndex = safeLine.lastIndexOf('/');
        }

        if (splitIndex !== -1) {
            let q = safeLine.substring(0, splitIndex).trim();
            // 구분자 길이에 따라 정답 시작 위치 조정
            // (indexOf로 찾은게 ' / '이면 3글자 뒤, 아니면 1글자 뒤라고 가정하되 정확히 처리)
            // 기존 로직: safeLine[splitIndex] === ' ' ? 3 : 1; 
            // -> indexOf는 시작점 반환하므로 ' '면 공백시작임.
            
            // 더 정확한 오프셋 계산 (기존 로직 보완)
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

// [기능 3] 서버로 업로드 (DB 생성)
async function uploadQuiz() {
    // 최종적으로 텍스트 박스 내용을 한 번 더 파싱 (수정사항 반영)
    parseTextFromArea();

    if (parsedQuizData.length === 0) {
        alert("저장할 문제가 없습니다. '문제 | 정답' 형식을 확인해주세요.");
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

    const dbNameRegex = /^[a-z0-9_]+$/;
    if (!dbNameRegex.test(dbName)) {
        alert("DB 이름 오류: 영어 소문자, 숫자, 언더바(_)만 가능합니다.");
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
            throw new Error("관리자 비밀번호가 틀렸습니다.");
        }

        // 2. 데이터 전송
        const formData = new FormData();
        formData.append('title', title);
        formData.append('dbName', dbName);
        formData.append('creator', creator);
        formData.append('description', '설명 없음'); 
        formData.append('quizData', JSON.stringify(parsedQuizData));

        if (thumbnailInput && thumbnailInput.files[0]) {
            formData.append('thumbnail', thumbnailInput.files[0]);
        }

        const res = await fetch('/api/admin_api/create-quiz', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            alert("✅ 저장 완료! DB가 생성되었습니다.");
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
