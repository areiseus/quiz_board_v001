let quizData = [];
let currentIndex = 0;
let score = 0;
let timerInterval = null;
const TIME_LIMIT = 15;
let isDataLoaded = false; 

document.addEventListener('DOMContentLoaded', async () => {
    // 1. URL 파라미터 읽기
    const params = new URLSearchParams(window.location.search);
    const dbName = params.get('db');
    const title = params.get('title') || "퀴즈 제목";
    const creator = params.get('creator') || "알 수 없음";

    // 2. 잘못된 접근 차단
    if (!dbName) {
        alert("잘못된 접근입니다. (DB 정보가 없습니다)");
        // 파일 구조에 맞게 경로 수정 (필요시)
        location.href = '../select_page/user_main.html';
        return;
    }

    // 3. UI 초기 세팅
    const introTitle = document.getElementById('intro-title');
    const introCreator = document.getElementById('intro-creator');
    if (introTitle) introTitle.innerText = title;
    if (introCreator) introCreator.innerText = `Created by ${creator}`;
    
    const startBtn = document.querySelector('.btn-start'); // 클래스명 .btn-start 확인
    const loadStatus = document.getElementById('loading-status'); // ID loading-status 확인
    
    // 버튼 잠시 비활성화
    if (startBtn) startBtn.disabled = true;
    if (loadStatus) loadStatus.innerText = "로딩 중...";

    try {
        // [핵심] 서버 연결 (파일 구조에 맞춘 경로)
        const res = await fetch(`/api/admin_api/get-quiz-detail?dbName=${dbName}`);
        
        // 서버 에러(HTML 응답 등) 체크
        if (!res.ok) {
            const errText = await res.text();
            console.error("서버 에러 내용:", errText);
            throw new Error("서버 연결 실패 (관리자 페이지에서 DB가 제대로 생성되었는지 확인해주세요)");
        }
        
        quizData = await res.json();
        
        // 데이터 없음 체크
        if (!quizData || quizData.length === 0) {
            alert("불러올 문제가 없습니다.");
            location.href = '../select_page/user_main.html';
            return;
        }

        // 로딩 성공 처리
        isDataLoaded = true;
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = "도전하기!";
            // 클릭 이벤트 연결 (HTML에 onclick이 없으면 여기서 연결)
            startBtn.onclick = startQuiz;
        }
        if (loadStatus) {
            loadStatus.innerText = ""; // 로딩 문구 삭제
        }

    } catch (err) {
        console.error(err);
        if (loadStatus) {
            // [Image 6] 화면처럼 에러 메시지 표시
            loadStatus.innerText = "로딩 실패: " + err.message;
            loadStatus.style.color = "red";
        }
    }

    // 엔터키 입력 시 정답 제출
    const answerInput = document.getElementById('answer-input');
    if (answerInput) {
        answerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkAnswer();
        });
    }
});

// 퀴즈 시작 (인트로 숨김 -> 퀴즈 보임)
function startQuiz() {
    if (!isDataLoaded) return;
    
    const introLayer = document.getElementById('intro-layer');
    const quizLayer = document.getElementById('quiz-layer');
    
    if (introLayer) introLayer.style.display = 'none';
    if (quizLayer) quizLayer.style.display = 'flex';
    
    renderQuestion();
}

// 문제 렌더링
function renderQuestion() {
    clearInterval(timerInterval);

    if (currentIndex >= quizData.length) {
        showFinalResult();
        return;
    }

    const q = quizData[currentIndex];
    const reqCount = q.required_count ? parseInt(q.required_count) : 1;
    
    // 화면 요소 초기화
    const resultOverlay = document.getElementById('result-overlay');
    const inputGroup = document.getElementById('input-group');
    const userAnswerDisplay = document.getElementById('user-answer-display');
    const btnNext = document.getElementById('btn-next');

    if(resultOverlay) resultOverlay.style.display = 'none';
    if(inputGroup) inputGroup.style.display = 'flex';
    if(userAnswerDisplay) userAnswerDisplay.style.display = 'none'; 
    if(btnNext) btnNext.style.display = 'none';
    
    // 진행바 및 텍스트
    const percent = ((currentIndex) / quizData.length) * 100;
    const progress = document.getElementById('progress');
    const qNum = document.getElementById('q-num');
    const qText = document.getElementById('q-text');

    if(progress) progress.style.width = `${percent}%`;
    if(qNum) qNum.innerText = `Q. ${currentIndex + 1} / ${quizData.length}`;
    if(qText) qText.innerText = q.question || "내용 없음"; 
    
    const input = document.getElementById('answer-input');
    
    // 힌트 텍스트 설정
    let placeholderText = "정답 입력";
    if (q.is_strict) placeholderText += " (★정확히 입력)";
    if (reqCount > 1) placeholderText += ` / ${reqCount}개 필요 (쉼표 구분)`;
    if(input) input.placeholder = placeholderText;

    // 미디어(유튜브/비디오/이미지) 처리
    const mediaArea = document.getElementById('media-area');
    if (mediaArea) {
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
            // 서버에서 받아온 base64 이미지
            mediaArea.innerHTML = `<img src="${q.image_data}" alt="문제 이미지">`;
        }
    }

    if(input) {
        input.value = '';
        input.disabled = false;
        input.focus();
    }

    startTimer();
}

// 유튜브 ID 추출
function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 타이머 로직
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
    if (!mediaArea) return;
    const iframe = mediaArea.querySelector('iframe');
    const video = mediaArea.querySelector('video');
    if (video) video.pause();
    if (iframe) iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'stopVideo' }), '*');
}

function handleTimeOut() {
    const input = document.getElementById('answer-input');
    if(input) input.disabled = true; 
    const userValue = input ? (input.value.trim() || "(입력 못함)") : "";
    showResultOverlay(false, 0, userValue, true);
}

// 문자열 정제
function cleanString(str) {
    if (!str) return "";
    return str.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/정답[:\s]*/g, '').replace(/[:\s]/g, '').toLowerCase();
}

// [핵심] 정답 체크 로직 (원본 유지)
function checkAnswer() {
    const input = document.getElementById('answer-input');
    if (!input || input.disabled) return;
    
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

// 결과 오버레이 표시
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
        titleHtml = `<div class="overlay-msg wro-color" style="color:#dc3545; font-weight:bold; font-size:1.5rem;">⏰ 시간 초과!</div>`;
        bgClass = '#fff3cd'; 
    } else if (isSuccess) {
        titleHtml = `<div class="overlay-msg cor-color" style="color:#28a745; font-weight:bold; font-size:1.5rem;">⭕ 정답입니다!</div>`;
        bgClass = '#d4edda'; 
    } else {
        titleHtml = `<div class="overlay-msg wro-color" style="color:#dc3545; font-weight:bold; font-size:1.5rem;">❌ 틀렸습니다!</div>`;
        bgClass = '#fff3cd'; 
    }

    let explanationHtml = '';
    if (explanation) {
        explanationHtml = `<div class="exp-box" style="background:${bgClass}; padding:10px; border-radius:5px; margin-top:10px;">💡 ${explanation}</div>`;
    }

    if(content) {
        content.innerHTML = `
            ${titleHtml}
            <div class="overlay-sub" style="margin-top:10px; color:#666;">정답은?</div>
            <div class="overlay-big-answer" style="font-size:1.8rem; font-weight:bold; margin:10px 0;">${rawCleanAnswer}</div>
            <div style="font-size:1rem; color:#555; margin-bottom:10px;">(맞춘 개수: ${matchCount} / 필요: ${requiredCount})</div>
            ${explanationHtml} 
        `;
    }

    const inputGroup = document.getElementById('input-group');
    const myAnswerBox = document.getElementById('user-answer-display');
    const myAnswerText = document.getElementById('my-answer-text');
    const btnNext = document.getElementById('btn-next');

    if(inputGroup) inputGroup.style.display = 'none';
    if(myAnswerText) {
        myAnswerText.innerText = userAnsText;
        myAnswerText.style.color = isSuccess ? '#28a745' : '#dc3545';
    }
    
    if(myAnswerBox) myAnswerBox.style.display = 'flex';
    if(btnNext) btnNext.style.display = 'block';
    if(overlay) overlay.style.display = 'flex';
}

function goNextQuestion() {
    currentIndex++;
    renderQuestion();
}

function showFinalResult() {
    const container = document.querySelector('.fixed-container') || document.body;
    const finalScore = Math.round((score / quizData.length) * 100);
    
    // 기존 내용 지우고 결과창 띄우기
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
            <button class="btn-next" style="width:300px; margin:0 auto; padding:15px; background:#007bff; color:white; border:none; border-radius:10px; font-size:1.2rem; cursor:pointer;" onclick="location.href='../select_page/user_main.html'">
                목록으로 돌아가기
            </button>
        </div>
    `;
}
