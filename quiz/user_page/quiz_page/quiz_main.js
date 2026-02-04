let quizData = [];
let currentIndex = 0;
let score = 0;
let timerInterval = null;
const TIME_LIMIT = 15;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const dbName = params.get('db');

    if (!dbName) {
        alert("잘못된 접근입니다.");
        location.href = '../select_page/user_main.html';
        return;
    }

    try {
        const res = await fetch(`/api/admin_api/get-quiz-detail?dbName=${dbName}`);
        if (!res.ok) throw new Error("문제 로드 실패");
        
        quizData = await res.json();
        
        if (!quizData || quizData.length === 0) {
            alert("문제가 없습니다.");
            location.href = '../select_page/user_main.html';
            return;
        }

        renderQuestion();

    } catch (err) {
        alert("오류: " + err.message);
    }

    document.getElementById('answer-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
});

function renderQuestion() {
    clearInterval(timerInterval);

    if (currentIndex >= quizData.length) {
        showFinalResult();
        return;
    }

    const q = quizData[currentIndex];
    // [안전장치] DB에서 문자로 올 수 있으므로 숫자로 확실히 변환
    const reqCount = q.required_count ? parseInt(q.required_count) : 1;
    
    // UI 초기화
    document.getElementById('result-overlay').style.display = 'none';
    document.getElementById('input-group').style.display = 'flex';
    document.getElementById('btn-next').style.display = 'none';
    
    // 진행바 & 텍스트
    const percent = ((currentIndex) / quizData.length) * 100;
    document.getElementById('progress').style.width = `${percent}%`;
    document.getElementById('q-num').innerText = `Q. ${currentIndex + 1} / ${quizData.length}`;
    document.getElementById('q-text').innerText = q.question || "내용 없음"; 
    
    // [안내 문구] 2개 이상 필요하면 쉼표 안내
    const input = document.getElementById('answer-input');
    if (reqCount > 1) {
        input.placeholder = `정답 ${reqCount}개가 필요합니다 (쉼표 ','로 구분)`;
    } else {
        input.placeholder = "정답 입력";
    }

    // 미디어 영역
    const mediaArea = document.getElementById('media-area');
    mediaArea.innerHTML = '<span class="no-media-text">No Media</span>';

    if (q.image_url && q.image_url.trim() !== '') {
        mediaArea.innerHTML = `<img src="${q.image_url}" alt="문제 이미지">`;
    } else if (q.image_data) {
        mediaArea.innerHTML = `<img src="${q.image_data}" alt="문제 이미지">`;
    }

    // 입력창 초기화
    input.value = '';
    input.disabled = false;
    input.focus();

    startTimer();
}

function startTimer() {
    let timeLeft = TIME_LIMIT;
    const timerElement = document.getElementById('timer-sec');
    timerElement.innerText = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.innerText = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeOut(); 
        }
    }, 1000);
}

// 시간 초과 처리
function handleTimeOut() {
    const input = document.getElementById('answer-input');
    input.disabled = true; 

    const q = quizData[currentIndex];
    const explanation = q.explanation || ""; // 부연설명
    const rawCleanAnswer = q.answer.replace(/\[.*?\]/g, '').trim();
    
    const content = document.getElementById('overlay-content');
    
    // [결과 화면] 시간 초과 시에도 부연설명 출력
    content.innerHTML = `
        <div class="overlay-msg wro-color">⏰ 시간 초과!</div>
        <div class="overlay-sub" style="font-size:1.8rem;">정답: ${rawCleanAnswer}</div>
        <div style="margin-top:20px; font-size:1.4rem; color:#333; background:#fff3cd; padding:15px; border-radius:10px; width:80%; margin-left:auto; margin-right:auto;">
            ${explanation ? "💡 " + explanation : ""}
        </div>
    `;
    
    document.getElementById('result-overlay').style.display = 'flex';
    document.getElementById('input-group').style.display = 'none';
    document.getElementById('btn-next').style.display = 'block';
}

// 문자열 정제 (공백, 특수문자 제거)
function cleanString(str) {
    if (!str) return "";
    return str
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/정답[:\s]*/g, '')
        .replace(/[:\s]/g, '')
        .toLowerCase();
}

// [핵심 로직] 다답형 채점 및 개수 카운트
function checkAnswer() {
    const input = document.getElementById('answer-input');
    if (input.disabled) return;
    const userAns = input.value.trim();
    if (!userAns) return; 

    clearInterval(timerInterval);
    input.disabled = true; 

    const q = quizData[currentIndex];
    const requiredCount = parseInt(q.required_count) || 1; // 목표 개수
    
    // 1. DB 정답들을 쉼표로 분리 (예: "사과, 배, 포도")
    const dbAnswers = q.answer.split(',').map(s => cleanString(s)).filter(s => s.length > 0);
    
    // 2. 사용자 입력도 쉼표로 분리
    const userInputs = userAns.split(',').map(s => cleanString(s)).filter(s => s.length > 0);

    // 3. 맞춘 개수 카운트
    let matchCount = 0;
    const uniqueUserInputs = [...new Set(userInputs)]; // 중복 입력 제거

    uniqueUserInputs.forEach(uInput => {
        // DB 정답 중 하나라도 포함하거나 일치하면 인정
        const isHit = dbAnswers.some(dbAns => {
            return dbAns === uInput || (dbAns.includes(uInput) && uInput.length >= 1);
        });
        if (isHit) matchCount++;
    });

    // 4. 성공 여부 판정 (맞춘 개수 >= 필요 개수)
    const isSuccess = matchCount >= requiredCount;
    
    const explanation = q.explanation || "";
    const rawCleanAnswer = q.answer.replace(/\[.*?\]/g, '').trim();

    const content = document.getElementById('overlay-content');

    if (isSuccess) {
        score++;
        content.innerHTML = `
            <div class="overlay-msg cor-color">⭕ 정답입니다!</div>
            <div style="font-size:1.5rem; color:#555;">(맞춘 개수: ${matchCount} / 필요: ${requiredCount})</div>
            <div style="margin-top:20px; font-size:1.4rem; color:#333; background:#d4edda; padding:15px; border-radius:10px; width:80%; margin-left:auto; margin-right:auto;">
                ${explanation ? "💡 " + explanation : ""}
            </div>
        `;
    } else {
        content.innerHTML = `
            <div class="overlay-msg wro-color">❌ 틀렸습니다!</div>
            <div style="font-size:1.8rem; font-weight:bold;">정답: ${rawCleanAnswer}</div>
            <div style="font-size:1.2rem; color:#666;">(맞춘 개수: ${matchCount} / 필요: ${requiredCount})</div>
            <div style="margin-top:20px; font-size:1.4rem; color:#333; background:#fff3cd; padding:15px; border-radius:10px; width:80%; margin-left:auto; margin-right:auto;">
                ${explanation ? "💡 " + explanation : ""}
            </div>
        `;
    }
    
    document.getElementById('result-overlay').style.display = 'flex';
    document.getElementById('input-group').style.display = 'none';
    document.getElementById('btn-next').style.display = 'block';
}

function goNextQuestion() {
    currentIndex++;
    renderQuestion();
}

function showFinalResult() {
    const container = document.querySelector('.fixed-container');
    container.innerHTML = `
        <div style="text-align:center; margin-top:100px;">
            <h1 style="font-size:4rem; margin-bottom:30px;">🎉 퀴즈 종료!</h1>
            <div style="font-size:6rem; font-weight:bold; color:#007bff; margin:50px 0;">
                ${score} / ${quizData.length}
            </div>
            <p style="font-size:2rem; color:#666;">수고하셨습니다!</p>
            <button class="btn-next" style="margin-top:50px;" onclick="location.href='../select_page/user_main.html'">
                목록으로 돌아가기
            </button>
        </div>
    `;
}
