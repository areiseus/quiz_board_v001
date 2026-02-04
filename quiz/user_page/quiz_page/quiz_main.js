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

    // 엔터키 제출
    document.getElementById('answer-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
});

// 문제 화면 그리기
function renderQuestion() {
    clearInterval(timerInterval); // 기존 타이머 정지

    if (currentIndex >= quizData.length) {
        showFinalResult();
        return;
    }

    const q = quizData[currentIndex];
    
    // UI 초기화
    document.getElementById('quiz-content-area').style.display = 'block';
    document.getElementById('next-btn-area').style.display = 'none';
    document.getElementById('result-msg').innerHTML = '';
    
    // 진행바
    const percent = ((currentIndex) / quizData.length) * 100;
    document.getElementById('progress').style.width = `${percent}%`;
    document.getElementById('q-num').innerText = `Q. ${currentIndex + 1} / ${quizData.length}`;
    
    // 텍스트 & 이미지
    document.getElementById('q-text').innerText = q.question || "내용 없음"; 
    const mediaArea = document.getElementById('media-area');
    mediaArea.innerHTML = ''; 
    if (q.image_url && q.image_url.trim() !== '') {
        mediaArea.innerHTML = `<img src="${q.image_url}" alt="문제 이미지">`;
    } else if (q.image_data) {
        mediaArea.innerHTML = `<img src="${q.image_data}" alt="문제 이미지">`;
    }

    // 입력창 초기화
    const input = document.getElementById('answer-input');
    input.value = '';
    input.disabled = false;
    input.focus();

    // 타이머 시작
    startTimer();
}

// 타이머
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

    document.getElementById('quiz-content-area').style.display = 'none';

    // 정답 깨끗하게 보여주기 (불필요한 태그 제거 후 표시)
    const cleanAnswerText = cleanString(quizData[currentIndex].answer);
    
    const msgDiv = document.getElementById('result-msg');
    msgDiv.innerHTML = `<div class="fail-text">실패!</div><p style="color:#666;">정답은 <b>'${cleanAnswerText}'</b> 입니다.</p>`;

    document.getElementById('next-btn-area').style.display = 'block';
}

// ★ [핵심] 정답 문자열 청소 함수
function cleanString(str) {
    if (!str) return "";
    return str
        .replace(/\[.*?\]/g, '')   // [정답] 같은 대괄호 내용 삭제
        .replace(/\(.*?\)/g, '')   // (정답) 같은 소괄호 내용 삭제
        .replace(/정답[:\s]*/g, '') // '정답:' 또는 '정답 ' 삭제
        .replace(/[:\s]/g, '')     // 콜론, 공백 삭제
        .toLowerCase();            // 소문자로 통일
}

// 정답 확인
function checkAnswer() {
    const input = document.getElementById('answer-input');
    const msg = document.getElementById('result-msg');
    
    if (input.disabled) return;

    const userAns = input.value.trim();
    if (!userAns) return; 

    // 타이머 멈춤
    clearInterval(timerInterval);
    input.disabled = true; 

    const rawCorrectAns = quizData[currentIndex].answer; // 원본 정답 (화면 표시용)
    
    // 1. 둘 다 청소합니다 (공백, [정답] 태그 등 제거)
    const cleanUser = cleanString(userAns);
    const cleanCorrect = cleanString(rawCorrectAns);

    // 2. 비교 로직 (정확히 일치하거나, 정답이 유저 답을 포함하고 있을 때)
    // 예: 정답이 "50개"이고 유저가 "50"을 입력 -> "50개".includes("50") === true -> 정답 인정!
    let isCorrect = false;

    if (cleanUser === cleanCorrect) {
        isCorrect = true;
    } else if (cleanCorrect.includes(cleanUser) && cleanUser.length >= 1) {
        // "50개" 안에 "50"이 포함되면 정답 처리
        // (단, 너무 짧은 글자 방지를 위해 길이 체크)
        isCorrect = true;
    }

    if (isCorrect) {
        msg.innerHTML = "<span class='correct'>⭕ 정답입니다!</span>";
        score++;
    } else {
        // 틀렸을 때 보여주는 정답도 깔끔하게 ([정답] 떼고) 보여줍니다.
        msg.innerHTML = `<span class='wrong'>❌ 땡! 정답은 <b>'${cleanString(rawCorrectAns)}'</b> 입니다.</span>`;
    }

    document.getElementById('next-btn-area').style.display = 'block';
}

// 다음 문제로 이동
function goNextQuestion() {
    currentIndex++;
    renderQuestion();
}

// 최종 결과
function showFinalResult() {
    const container = document.querySelector('.container');
    container.innerHTML = `
        <h1 style="margin-bottom:20px;">🎉 퀴즈 종료!</h1>
        <div style="font-size:3rem; font-weight:bold; color:#007bff; margin:30px 0;">
            ${score} / ${quizData.length}
        </div>
        <p>수고하셨습니다!</p>
        <button class="btn-submit" style="width:100%; margin:0;" onclick="location.href='../select_page/user_main.html'">
            목록으로 돌아가기
        </button>
    `;
}
