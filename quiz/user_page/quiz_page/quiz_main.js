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
    document.getElementById('user-answer-display').style.display = 'none'; 
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

    // [핵심 수정] 미디어 처리 (이미지 vs 유튜브 vs 비디오)
    const mediaArea = document.getElementById('media-area');
    mediaArea.innerHTML = ''; // 초기화 (완전 공백)

    if (q.image_url && q.image_url.trim() !== '') {
        const url = q.image_url.trim();
        
        // 1. 유튜브 링크인지 확인
        const youtubeId = getYouTubeId(url);
        if (youtubeId) {
            // 유튜브는 iframe으로 임베드 (자동재생, 음소거 해제 시도)
            mediaArea.innerHTML = `
                <iframe src="https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen></iframe>`;
        } 
        // 2. 비디오 파일인지 확인 (.mp4, .webm 등)
        else if (url.match(/\.(mp4|webm|ogg)$/i)) {
            mediaArea.innerHTML = `
                <video controls autoplay name="media">
                    <source src="${url}" type="video/mp4">
                </video>`;
        } 
        // 3. 아니면 이미지로 처리
        else {
            mediaArea.innerHTML = `<img src="${url}" alt="문제 이미지" onerror="this.style.display='none'">`;
        }

    } else if (q.image_data) {
        // 직접 업로드한 이미지 파일
        mediaArea.innerHTML = `<img src="${q.image_data}" alt="문제 이미지">`;
    }

    // 입력창 초기화
    input.value = '';
    input.disabled = false;
    input.focus();

    startTimer();
}

// [NEW] 유튜브 ID 추출 함수 (짧은 주소, 긴 주소 모두 대응)
function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
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

    showResultOverlay(isSuccess, matchCount, userAns, false);
}

// 결과 오버레이 함수 (지난번 요청하신 '내 답 표시' + '큰 정답' 유지)
function showResultOverlay(isSuccess, matchCount, userAnsText, isTimeout) {
    const q = quizData[currentIndex];
    const requiredCount = parseInt(q.required_count) || 1;
    const explanation = q.explanation || "";
    const rawCleanAnswer = q.answer.replace(/\[.*?\]/g, '').trim();

    const overlay = document.getElementById('result-overlay');
    const content = document.getElementById('overlay-content');

    let titleHtml = '';
    let bgClass = '';

    if (isTimeout) {
        titleHtml = `<div class="overlay-msg wro-color">⏰ 시간 초과!</div>`;
        bgClass = '#fff3cd'; 
    } else if (isSuccess) {
        titleHtml = `<div class="overlay-msg cor-color">⭕ 정답입니다!</div>`;
        bgClass = '#d4edda'; 
    } else {
        titleHtml = `<div class="overlay-msg wro-color">❌ 틀렸습니다!</div>`;
        bgClass = '#fff3cd'; 
    }

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

    document.getElementById('input-group').style.display = 'none';
    
    const myAnswerBox = document.getElementById('user-answer-display');
    const myAnswerText = document.getElementById('my-answer-text');
    
    myAnswerText.innerText = userAnsText;
    if(isSuccess) {
        myAnswerText.style.color = '#28a745'; 
    } else {
        myAnswerText.style.color = '#dc3545'; 
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
