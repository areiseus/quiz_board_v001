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
    
    // UI 초기화 (숨겼던 문제 영역 다시 보여주기)
    document.getElementById('quiz-content-area').style.display = 'block';
    document.getElementById('next-btn-area').style.display = 'none'; // 다음 버튼 숨김
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
            handleTimeOut(); // 시간 초과 처리
        }
    }, 1000);
}

// [기능 2 & 3] 시간 초과 시: 문제 숨기고 '실패' 출력
function handleTimeOut() {
    const input = document.getElementById('answer-input');
    input.disabled = true; // 제출 불가

    // 문제 영역 숨기기
    document.getElementById('quiz-content-area').style.display = 'none';

    // 실패 메시지 크게 출력
    const msgDiv = document.getElementById('result-msg');
    msgDiv.innerHTML = `<div class="fail-text">실패!</div><p style="color:#666;">시간이 초과되었습니다.</p>`;

    // 다음 문제 버튼 표시
    document.getElementById('next-btn-area').style.display = 'block';
}

// [기능 4] 정답 확인 (유연한 매칭)
function checkAnswer() {
    const input = document.getElementById('answer-input');
    const msg = document.getElementById('result-msg');
    
    // 이미 제출했으면 중복 실행 방지
    if (input.disabled) return;

    const userAns = input.value.trim();
    if (!userAns) return; // 빈칸 제출 방지

    // 타이머 멈춤
    clearInterval(timerInterval);
    input.disabled = true; // 수정 불가

    const correctAns = quizData[currentIndex].answer;
    
    // ★ 공백 제거 후 비교 (ex: "50 개" == "50개")
    const cleanUser = userAns.replace(/\s+/g, '').toLowerCase();
    const cleanCorrect = correctAns.replace(/\s+/g, '').toLowerCase();

    if (cleanUser === cleanCorrect) {
        msg.innerHTML = "<span class='correct'>⭕ 정답입니다!</span>";
        score++;
    } else {
        msg.innerHTML = `<span class='wrong'>❌ 땡! 정답은 <b>'${correctAns}'</b> 입니다.</span>`;
    }

    // [기능 5 & 6] 바로 넘어가지 않고 버튼 표시
    document.getElementById('next-btn-area').style.display = 'block';
}

// [기능 6] 다음 문제로 넘어가기 (버튼 클릭 시 실행)
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
