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
    const reqCount = q.required_count ? parseInt(q.required_count) : 1;
    
    // UI 초기화
    document.getElementById('result-overlay').style.display = 'none';
    document.getElementById('input-group').style.display = 'flex';
    document.getElementById('user-answer-display').style.display = 'none'; // 내 답 숨김
    document.getElementById('btn-next').style.display = 'none';
    
    // 진행바 & 텍스트
    const percent = ((currentIndex) / quizData.length) * 100;
    document.getElementById('progress').style.width = `${percent}%`;
    document.getElementById('q-num').innerText = `Q. ${currentIndex + 1} / ${quizData.length}`;
    document.getElementById('q-text').innerText = q.question || "내용 없음"; 
    
    // placeholder 설정
    const input = document.getElementById('answer-input');
    if (reqCount > 1) {
        input.placeholder = `정답 ${reqCount}개가 필요합니다 (쉼표 ','로 구분)`;
    } else {
        input.placeholder = "정답 입력";
    }

    // [수정] 미디어 영역 처리: 이미지가 없으면 '완전 공백'
    const mediaArea = document.getElementById('media-area');
    mediaArea.innerHTML = ''; // 깨끗하게 비움

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
    
    // 시간 초과 시에는 "시간 초과"라고 표시하거나, 입력하다 만 값을 표시
    const userValue = input.value.trim() || "(입력 못함)";
    showResultOverlay(false, 0, userValue, true);
}

// 문자열 정제
function cleanString(str) {
    if (!str) return "";
    return str
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/정답[:\s]*/g, '')
        .replace(/[:\s]/g, '')
        .toLowerCase();
}

// 정답 확인
function checkAnswer() {
    const input = document.getElementById('answer-input');
    if (input.disabled) return;
    const userAns = input.value.trim();
    if (!userAns) return; 

    clearInterval(timerInterval);
    input.disabled = true; 

    const q = quizData[currentIndex];
    const requiredCount = parseInt(q.required_count) || 1;
    
    const dbAnswers = q.answer.split(',').map(s => cleanString(s)).filter(s => s.length > 0);
    const userInputs = userAns.split(',').map(s => cleanString(s)).filter(s => s.length > 0);

    let matchCount = 0;
    const uniqueUserInputs = [...new Set(userInputs)];

    uniqueUserInputs.forEach(uInput => {
        const isHit = dbAnswers.some(dbAns => {
            return dbAns === uInput || (dbAns.includes(uInput) && uInput.length >= 1);
        });
        if (isHit) matchCount++;
    });

    const isSuccess = matchCount >= requiredCount;
    if (isSuccess) score++;

    // 결과 화면 호출 (성공여부, 맞춘개수, 유저입력값)
    showResultOverlay(isSuccess, matchCount, userAns, false);
}

// [핵심] 결과 오버레이 및 하단 내 답 표시 통합 함수
function showResultOverlay(isSuccess, matchCount, userAnsText, isTimeout) {
    const q = quizData[currentIndex];
    const requiredCount = parseInt(q.required_count) || 1;
    const explanation = q.explanation || "";
    // 원본 정답 (대괄호만 제거하고 보여줌)
    const rawCleanAnswer = q.answer.replace(/\[.*?\]/g, '').trim();

    const overlay = document.getElementById('result-overlay');
    const content = document.getElementById('overlay-content');

    let titleHtml = '';
    let subHtml = '';
    let bgClass = '';

    if (isTimeout) {
        titleHtml = `<div class="overlay-msg wro-color">⏰ 시간 초과!</div>`;
        bgClass = '#fff3cd'; // 노란색 배경
    } else if (isSuccess) {
        titleHtml = `<div class="overlay-msg cor-color">⭕ 정답입니다!</div>`;
        bgClass = '#d4edda'; // 초록색 배경
    } else {
        titleHtml = `<div class="overlay-msg wro-color">❌ 틀렸습니다!</div>`;
        bgClass = '#fff3cd'; // 노란색 배경
    }

    // [수정] 정답을 아주 크게 표시 (.overlay-big-answer)
    content.innerHTML = `
        ${titleHtml}
        <div class="overlay-sub">정답은?</div>
        <div class="overlay-big-answer">${rawCleanAnswer}</div>
        
        <div style="font-size:1.2rem; color:#555; margin-bottom:10px;">
            (맞춘 개수: ${matchCount} / 필요: ${requiredCount})
        </div>

        <div class="exp-box" style="background:${bgClass};">
            ${explanation ? "💡 " + explanation : "부연 설명이 없습니다."}
        </div>
    `;

    // 하단: 입력창 숨기고 -> [내가 쓴 답] + [다음 버튼] 보이기
    document.getElementById('input-group').style.display = 'none';
    
    // 내가 쓴 답 표시
    const myAnswerBox = document.getElementById('user-answer-display');
    const myAnswerText = document.getElementById('my-answer-text');
    
    myAnswerText.innerText = userAnsText;
    if(isSuccess) {
        myAnswerText.style.color = '#28a745'; // 내 답이 맞았으면 초록색
    } else {
        myAnswerText.style.color = '#dc3545'; // 틀렸으면 빨간색
    }
    
    myAnswerBox.style.display = 'flex';
    document.getElementById('btn-next').style.display = 'block';

    overlay.style.display = 'flex';
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
