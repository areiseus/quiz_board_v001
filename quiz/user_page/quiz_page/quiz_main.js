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
    const reqCount = q.required_count || 1; // 필요 정답 수 (기본값 1)
    
    // UI 초기화
    document.getElementById('result-overlay').style.display = 'none';
    document.getElementById('input-group').style.display = 'flex';
    document.getElementById('btn-next').style.display = 'none';
    
    // 진행바 & 텍스트
    const percent = ((currentIndex) / quizData.length) * 100;
    document.getElementById('progress').style.width = `${percent}%`;
    document.getElementById('q-num').innerText = `Q. ${currentIndex + 1} / ${quizData.length}`;
    document.getElementById('q-text').innerText = q.question || "내용 없음"; 
    
    // [기능 추가] 다답형 안내 문구 표시
    const input = document.getElementById('answer-input');
    if (reqCount > 1) {
        input.placeholder = `정답 ${reqCount}개가 필요합니다 (쉼표 ','로 구분)`;
    } else {
        input.placeholder = "정답 입력";
    }

    // 미디어 영역 처리
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

    // 부연설명 가져오기
    const explanation = quizData[currentIndex].explanation || "";
    const cleanAnswerText = cleanString(quizData[currentIndex].answer);
    
    const overlay = document.getElementById('result-overlay');
    const content = document.getElementById('overlay-content');
    
    // [수정] 결과 화면에 부연설명 추가
    content.innerHTML = `
        <div class="overlay-msg wro-color">⏰ 시간 초과!</div>
        <div class="overlay-sub" style="font-size:1.5rem;">정답: ${cleanAnswerText}</div>
        <div style="margin-top:20px; font-size:1.2rem; color:#444; background:#f8f9fa; padding:10px; border-radius:10px;">
            ${explanation ? "💡 " + explanation : ""}
        </div>
    `;
    overlay.style.display = 'flex';

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

// [핵심 기능] 정답 확인 (다중 정답 로직 적용)
function checkAnswer() {
    const input = document.getElementById('answer-input');
    
    if (input.disabled) return;
    const userAns = input.value.trim();
    if (!userAns) return; 

    clearInterval(timerInterval);
    input.disabled = true; 

    const q = quizData[currentIndex];
    const requiredCount = q.required_count || 1; // 목표 개수
    
    // 1. DB 정답들을 쉼표로 분리해서 배열로 만듦
    // 예: "사과, 배, 포도" -> ["사과", "배", "포도"]
    const dbAnswers = q.answer.split(',').map(s => cleanString(s)).filter(s => s.length > 0);
    
    // 2. 사용자 입력도 쉼표로 분리
    const userInputs = userAns.split(',').map(s => cleanString(s)).filter(s => s.length > 0);

    // 3. 맞춘 개수 카운트
    let matchCount = 0;
    
    // 중복 정답 방지용 (사용자가 "사과, 사과" 입력 시 1개로 처리)
    const uniqueUserInputs = [...new Set(userInputs)];

    uniqueUserInputs.forEach(uInput => {
        // DB 정답 배열 중에 일치하는 게 있는지 확인
        const isHit = dbAnswers.some(dbAns => {
            return dbAns === uInput || (dbAns.includes(uInput) && uInput.length >= 1);
        });
        if (isHit) matchCount++;
    });

    const isSuccess = matchCount >= requiredCount;
    const explanation = q.explanation || "";

    // 결과 오버레이 표시
    const overlay = document.getElementById('result-overlay');
    const content = document.getElementById('overlay-content');

    if (isSuccess) {
        score++;
        content.innerHTML = `
            <div class="overlay-msg cor-color">⭕ 정답입니다!</div>
            <div style="font-size:1.5rem; color:#555;">(${matchCount}개 성공 / 필요 ${requiredCount}개)</div>
            <div style="margin-top:20px; font-size:1.2rem; color:#444; background:#e3f2fd; padding:10px; border-radius:10px;">
                ${explanation ? "💡 " + explanation : ""}
            </div>
        `;
    } else {
        // 보기 좋게 원본 정답 표시
        const rawCleanAnswer = q.answer.replace(/\[.*?\]/g, '').trim(); 
        content.innerHTML = `
            <div class="overlay-msg wro-color">❌ 아까워요!</div>
            <div style="font-size:1.5rem; font-weight:bold;">정답: ${rawCleanAnswer}</div>
            <div style="font-size:1.2rem; color:#666;">(맞춘 개수: ${matchCount} / 필요: ${requiredCount})</div>
            <div style="margin-top:20px; font-size:1.2rem; color:#444; background:#fff0f3; padding:10px; border-radius:10px;">
                ${explanation ? "💡 " + explanation : ""}
            </div>
        `;
    }
    
    overlay.style.display = 'flex';
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
