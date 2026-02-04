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
    
    // UI 초기화 (오버레이 숨기기, 입력창 보이기)
    document.getElementById('result-overlay').style.display = 'none';
    document.getElementById('input-group').style.display = 'flex';
    document.getElementById('btn-next').style.display = 'none';
    
    // 진행바 & 텍스트
    const percent = ((currentIndex) / quizData.length) * 100;
    document.getElementById('progress').style.width = `${percent}%`;
    document.getElementById('q-num').innerText = `Q. ${currentIndex + 1} / ${quizData.length}`;
    document.getElementById('q-text').innerText = q.question || "내용 없음"; 
    
    // [이미지 처리] 항상 고정된 media-area 안에 넣음
    const mediaArea = document.getElementById('media-area');
    mediaArea.innerHTML = '<span class="no-media-text">No Media</span>'; // 기본값

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

// [시간 초과 처리] -> 오버레이 띄움
function handleTimeOut() {
    const input = document.getElementById('answer-input');
    input.disabled = true; 

    // 정답 텍스트 정제
    const cleanAnswerText = cleanString(quizData[currentIndex].answer);
    
    // 오버레이에 내용 넣고 표시
    const overlay = document.getElementById('result-overlay');
    const content = document.getElementById('overlay-content');
    
    content.innerHTML = `
        <div class="overlay-msg wro-color">⏰ 시간 초과!</div>
        <div class="overlay-sub">정답은 '${cleanAnswerText}' 입니다</div>
    `;
    overlay.style.display = 'flex';

    // 입력창 숨기고 다음 버튼 표시
    document.getElementById('input-group').style.display = 'none';
    document.getElementById('btn-next').style.display = 'block';
}

// 정제 함수
function cleanString(str) {
    if (!str) return "";
    return str
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/정답[:\s]*/g, '')
        .replace(/[:\s]/g, '')
        .toLowerCase();
}

// [정답 확인] -> 오버레이 띄움
function checkAnswer() {
    const input = document.getElementById('answer-input');
    
    if (input.disabled) return;
    const userAns = input.value.trim();
    if (!userAns) return; 

    clearInterval(timerInterval);
    input.disabled = true; 

    const rawCorrectAns = quizData[currentIndex].answer;
    const cleanUser = cleanString(userAns);
    const cleanCorrect = cleanString(rawCorrectAns);

    let isCorrect = false;
    if (cleanUser === cleanCorrect) {
        isCorrect = true;
    } else if (cleanCorrect.includes(cleanUser) && cleanUser.length >= 1) {
        isCorrect = true;
    }

    // 오버레이 준비
    const overlay = document.getElementById('result-overlay');
    const content = document.getElementById('overlay-content');

    if (isCorrect) {
        score++;
        content.innerHTML = `
            <div class="overlay-msg cor-color">⭕ 정답입니다!</div>
        `;
    } else {
        content.innerHTML = `
            <div class="overlay-msg wro-color">❌ 틀렸습니다!</div>
            <div class="overlay-sub">정답: ${cleanString(rawCorrectAns)}</div>
        `;
    }
    
    // 오버레이 표시
    overlay.style.display = 'flex';

    // 입력창 숨기고 다음 버튼 표시
    document.getElementById('input-group').style.display = 'none';
    document.getElementById('btn-next').style.display = 'block';
}

function goNextQuestion() {
    currentIndex++;
    renderQuestion();
}

function showFinalResult() {
    // 최종 결과도 오버레이 스타일을 활용하지 않고 컨테이너 전체를 덮어씁니다.
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
