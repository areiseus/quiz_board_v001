let quizData = [];
let currentIndex = 0;
let score = 0;
let timerInterval = null;
const TIME_LIMIT = 15;
let isDataLoaded = false; 

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const dbName = params.get('db');
    const title = params.get('title') || "퀴즈 제목";
    const creator = params.get('creator') || "알 수 없음";

    if (!dbName) {
        alert("잘못된 접근입니다.");
        location.href = '../select_page/user_main.html';
        return;
    }

    document.getElementById('intro-title').innerText = title;
    document.getElementById('intro-creator').innerText = `Created by ${creator}`;
    
    const startBtn = document.querySelector('.btn-start');
    const loadStatus = document.getElementById('loading-status');
    startBtn.disabled = true;

    try {
        const res = await fetch(`/api/admin_api/get-quiz-detail?dbName=${dbName}`);
        if (!res.ok) throw new Error("문제 로드 실패");
        
        quizData = await res.json();
        
        if (!quizData || quizData.length === 0) {
            alert("문제가 없습니다.");
            location.href = '../select_page/user_main.html';
            return;
        }

        isDataLoaded = true;
        startBtn.disabled = false;
        startBtn.innerHTML = "도전하기! 🚀";
        loadStatus.innerText = "로딩 완료! 준비되셨나요?";
        loadStatus.style.color = "#28a745";

    } catch (err) {
        alert("오류: " + err.message);
        loadStatus.innerText = "로딩 실패";
        loadStatus.style.color = "red";
    }

    document.getElementById('answer-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
});

function startQuiz() {
    if (!isDataLoaded) return;
    document.getElementById('intro-layer').style.display = 'none';
    const quizLayer = document.getElementById('quiz-layer');
    quizLayer.style.display = 'flex';
    renderQuestion();
}

function renderQuestion() {
    clearInterval(timerInterval);

    if (currentIndex >= quizData.length) {
        showFinalResult();
        return;
    }

    const q = quizData[currentIndex];
    const reqCount = q.required_count ? parseInt(q.required_count) : 1;
    
    document.getElementById('result-overlay').style.display = 'none';
    document.getElementById('input-group').style.display = 'flex';
    document.getElementById('user-answer-display').style.display = 'none'; 
    document.getElementById('btn-next').style.display = 'none';
    
    const percent = ((currentIndex) / quizData.length) * 100;
    document.getElementById('progress').style.width = `${percent}%`;
    document.getElementById('q-num').innerText = `Q. ${currentIndex + 1} / ${quizData.length}`;
    document.getElementById('q-text').innerText = q.question || "내용 없음"; 
    
    const input = document.getElementById('answer-input');
    
    // placeholder에 '완전 일치' 여부 힌트 추가
    let placeholderText = "정답 입력";
    if (q.is_strict) {
        placeholderText = "정답 입력 (★정확히 입력하세요)";
    }
    if (reqCount > 1) {
        placeholderText += ` / ${reqCount}개 필요 (쉼표 구분)`;
    }
    input.placeholder = placeholderText;

    const mediaArea = document.getElementById('media-area');
    mediaArea.innerHTML = ''; 

    if (q.image_url && q.image_url.trim() !== '') {
        const url = q.image_url.trim();
        const youtubeId = getYouTubeId(url);

        if (youtubeId) {
            mediaArea.innerHTML = `
                <iframe id="yt-player" 
                src="https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0&enablejsapi=1" 
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen></iframe>`;
        } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
            mediaArea.innerHTML = `
                <video controls name="media">
                    <source src="${url}" type="video/mp4">
                </video>`;
        } else {
            mediaArea.innerHTML = `<img src="${url}" alt="문제 이미지" onerror="this.style.display='none'">`;
        }
    } else if (q.image_data) {
        mediaArea.innerHTML = `<img src="${q.image_data}" alt="문제 이미지">`;
    }

    input.value = '';
    input.disabled = false;
    input.focus();

    startTimer();
}

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

function stopMediaPlayback() {
    const mediaArea = document.getElementById('media-area');
    const iframe = mediaArea.querySelector('iframe');
    const video = mediaArea.querySelector('video');
    if (video) video.pause();
    if (iframe) iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'stopVideo' }), '*');
}

function handleTimeOut() {
    const input = document.getElementById('answer-input');
    input.disabled = true; 
    const userValue = input.value.trim() || "(입력 못함)";
    showResultOverlay(false, 0, userValue, true);
}

function cleanString(str) {
    if (!str) return "";
    return str.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/정답[:\s]*/g, '').replace(/[:\s]/g, '').toLowerCase();
}

// [핵심 로직] 정답 체크
function checkAnswer() {
    const input = document.getElementById('answer-input');
    if (input.disabled) return;
    const userAns = input.value.trim();
    if (!userAns) return; 

    clearInterval(timerInterval);
    input.disabled = true; 

    const q = quizData[currentIndex];
    const requiredCount = parseInt(q.required_count) || 1;
    const isStrict = q.is_strict; // 완전 일치 모드 여부
    
    const dbAnswers = q.answer.split(',').map(s => cleanString(s)).filter(s => s.length > 0);
    const userInputs = userAns.split(',').map(s => cleanString(s)).filter(s => s.length > 0);

    let matchCount = 0;
    const uniqueUserInputs = [...new Set(userInputs)];

    uniqueUserInputs.forEach(uInput => {
        const isHit = dbAnswers.some(dbAns => {
            if (isStrict) {
                // [완전 일치 모드] 정확히 같아야 함 ('집행' == '집행유예' -> False)
                return dbAns === uInput;
            } else {
                // [일반 모드] 포함되어 있으면 인정 ('집행' -> '집행유예' 포함 -> True)
                return dbAns === uInput || (dbAns.includes(uInput) && uInput.length >= 1);
            }
        });
        if (isHit) matchCount++;
    });

    const isSuccess = matchCount >= requiredCount;
    if (isSuccess) score++;

    showResultOverlay(isSuccess, matchCount, userAns, false);
}

function showResultOverlay(isSuccess, matchCount, userAnsText, isTimeout) {
    stopMediaPlayback();
    const q = quizData[currentIndex];
    const requiredCount = parseInt(q.required_count) || 1;
    const explanation = q.explanation ? q.explanation.trim() : "";
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

    let explanationHtml = '';
    if (explanation) {
        explanationHtml = `<div class="exp-box" style="background:${bgClass};">💡 ${explanation}</div>`;
    }

    content.innerHTML = `
        ${titleHtml}
        <div class="overlay-sub">정답은?</div>
        <div class="overlay-big-answer">${rawCleanAnswer}</div>
        <div style="font-size:1.2rem; color:#555; margin-bottom:10px;">(맞춘 개수: ${matchCount} / 필요: ${requiredCount})</div>
        ${explanationHtml} 
    `;

    document.getElementById('input-group').style.display = 'none';
    const myAnswerBox = document.getElementById('user-answer-display');
    const myAnswerText = document.getElementById('my-answer-text');
    myAnswerText.innerText = userAnsText;
    myAnswerText.style.color = isSuccess ? '#28a745' : '#dc3545';
    
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
    const finalScore = Math.round((score / quizData.length) * 100);
    
    container.innerHTML = `
        <div style="text-align:center; margin-top:50px; display:flex; flex-direction:column; justify-content:center; height:100%;">
            <h1 style="font-size:4rem; margin-bottom:10px;">🎉 퀴즈 종료!</h1>
            <p style="font-size:2rem; color:#666;">모든 문제를 풀었습니다.</p>
            <div style="margin: 40px 0;">
                <div style="font-size:8rem; font-weight:900; color:#007bff;">${finalScore}점</div>
                <div style="font-size:2.5rem; color:#333; font-weight:bold; margin-top:20px;">
                    (정답 ${score}개 / 전체 ${quizData.length}문제)
                </div>
            </div>
            <button class="btn-next" style="width:300px; margin:0 auto;" onclick="location.href='../select_page/user_main.html'">
                목록으로 돌아가기
            </button>
        </div>
    `;
}
