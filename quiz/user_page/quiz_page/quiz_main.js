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

    // [UI] 제목 및 제작자 표시
    const introTitle = document.getElementById('intro-title');
    const introCreator = document.getElementById('intro-creator');
    if (introTitle) introTitle.innerText = title;
    if (introCreator) introCreator.innerText = `Created by ${creator}`;
    
    const startBtn = document.querySelector('.btn-start');
    const loadStatus = document.getElementById('loading-status');
    if (startBtn) startBtn.disabled = true;

    try {
        // [서버 통신] HTML 에러(Unexpected token <) 방지를 위한 경로 확인
        const res = await fetch(`/api/admin_api/get-quiz-detail?dbName=${dbName}`);
        
        // 서버가 에러(500, 404 등)를 HTML로 줄 경우를 대비해 text로 먼저 확인
        if (!res.ok) {
            const errText = await res.text();
            console.error("서버 에러 응답:", errText);
            throw new Error("서버 연결 실패 (관리자 페이지에서 DB가 생성되었는지 확인하세요)");
        }
        
        quizData = await res.json();
        
        if (!quizData || quizData.length === 0) {
            alert("문제가 없습니다.");
            location.href = '../select_page/user_main.html';
            return;
        }

        isDataLoaded = true;
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = "도전하기! 🚀";
        }
        if (loadStatus) {
            loadStatus.innerText = "로딩 완료! 준비되셨나요?";
            loadStatus.style.color = "#28a745";
        }

    } catch (err) {
        console.error(err);
        if (loadStatus) {
            loadStatus.innerText = "로딩 실패: " + err.message;
            loadStatus.style.color = "red";
        }
    }

    // 엔터키 정답 제출
    const answerInput = document.getElementById('answer-input');
    if (answerInput) {
        answerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkAnswer();
        });
    }
});

function startQuiz() {
    if (!isDataLoaded) return;
    const introLayer = document.getElementById('intro-layer');
    const quizLayer = document.getElementById('quiz-layer');
    if (introLayer) introLayer.style.display = 'none';
    if (quizLayer) quizLayer.style.display = 'flex';
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
    
    // 화면 초기화
    document.getElementById('result-overlay').style.display = 'none';
    document.getElementById('input-group').style.display = 'flex';
    document.getElementById('user-answer-display').style.display = 'none'; 
    document.getElementById('btn-next').style.display = 'none';
    
    // 진행바
    const percent = ((currentIndex) / quizData.length) * 100;
    document.getElementById('progress').style.width = `${percent}%`;
    document.getElementById('q-num').innerText = `Q. ${currentIndex + 1} / ${quizData.length}`;
    document.getElementById('q-text').innerText = q.question || "내용 없음"; 
    
    const input = document.getElementById('answer-input');
    
    // 힌트 표시
    let placeholderText = "정답 입력";
    if (q.is_strict) placeholderText += " (★정확히 입력)";
    if (reqCount > 1) placeholderText += ` / ${reqCount}개 (쉼표 구분)`;
    input.placeholder = placeholderText;

    // 미디어(유튜브/비디오/이미지) 처리
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
            mediaArea.innerHTML = `<video controls name="media"><source src="${url}" type="video/mp4"></video>`;
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
    if(timerElement) timerElement.innerText = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        if(timerElement) timerElement.innerText = timeLeft;
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

// [핵심] 정답 체크 로직 (원본 유지)
function checkAnswer() {
    const input = document.getElementById('answer-input');
    if (input.disabled) return;
    const userAns = input.value.trim();
    if (!userAns) return; 

    clearInterval(timerInterval);
    input.disabled = true; 

    const q = quizData[currentIndex];
    const requiredCount = parseInt(q.required_count) || 1;
    const isStrict = q.is_strict; 
    
    const dbAnswers = q.answer.split(',').map(s => cleanString(s)).filter(s => s.length > 0);
    const userInputs = userAns.split(',').map(s => cleanString(s)).filter(s => s.length > 0);

    let matchCount = 0;
    const uniqueUserInputs = [...new Set(userInputs)];

    uniqueUserInputs.forEach(uInput => {
        const isHit = dbAnswers.some(dbAns => {
            if (isStrict) {
                return dbAns === uInput;
            } else {
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
