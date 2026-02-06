let quizData = [];
let currentIndex = 0;
let score = 0;
let timerInterval = null;

// [설정 변수]
let timeLimit = 15;      // 제한 시간
let useTimeLimit = true; // 타이머 사용 여부
let isInputMode = true;  // ★ quiz_mode (true: 입력/채점, false: 관람전용)

let isDataLoaded = false; 

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const dbName = params.get('db');
    const title = params.get('title') || "퀴즈 제목";
    const creator = params.get('creator') || "알 수 없음";

    if (!dbName) {
        alert("잘못된 접근입니다. (DB 정보 없음)");
        location.href = '../select_page/user_main.html';
        return;
    }

    // UI 초기화
    document.getElementById('intro-title').innerText = title;
    document.getElementById('intro-creator').innerText = `Created by ${creator}`;
    
    const startBtn = document.querySelector('.btn-start');
    const loadStatus = document.getElementById('loading-status');
    if (startBtn) startBtn.disabled = true;
    if (loadStatus) loadStatus.innerText = "로딩 중...";

    try {
        // 1. 문제 데이터 가져오기
        const qRes = await fetch(`/api/admin_api/get-quiz-detail?dbName=${dbName}`);
        if (!qRes.ok) throw new Error("문제 로딩 실패");
        quizData = await qRes.json();

        // 2. 설정 데이터 가져오기 (모드, 시간 등)
        try {
            const sRes = await fetch(`/api/admin_api/get-quiz-quiz_bundles?dbName=${dbName}`);
            if (sRes.ok) {
                const quiz_bundles = await sRes.json();

                // HTML에 id="intro-description" 인 태그가 있다고 가정할게!
                const descEl = document.getElementById('intro-description'); 
                if (descEl) {
                    descEl.innerText = quiz_bundles.description || ""; // 내용 없으면 빈칸
                }
                
                // 시간 설정
                if (quiz_bundles.time_limit) timeLimit = parseInt(quiz_bundles.time_limit);
                if (quiz_bundles.use_time_limit !== undefined) {
                    useTimeLimit = (String(quiz_bundles.use_time_limit) === 'true');
                }

                // ★ [핵심] 퀴즈 모드 설정 (true: 입력형, false: 관람형)
                if (quiz_bundles.quiz_mode !== undefined) {
                    isInputMode = (String(quiz_bundles.quiz_mode) === 'true');
                }
                
                // ※ 관람 모드(false)라면 타이머는 무조건 켜져야 진행이 됨
                if (!isInputMode) {
                    useTimeLimit = true; 
                    if(timeLimit < 3) timeLimit = 10; // 너무 짧으면 안되니 기본값 보정
                }

                console.log(`[설정] 모드: ${isInputMode ? '입력형' : '관람형'}, 시간: ${timeLimit}초`);
            }
        } catch (e) { console.warn("설정 로드 실패, 기본값 사용"); }

        if (!quizData || quizData.length === 0) {
            alert("불러올 문제가 없습니다.");
            location.href = '../select_page/user_main.html';
            return;
        }

        isDataLoaded = true;
        if (startBtn) {
            startBtn.disabled = false;
            // 모드에 따라 버튼 텍스트 변경
            startBtn.innerHTML = isInputMode ? "도전하기!" : "관람 시작";
            startBtn.onclick = startQuiz;
        }
        if (loadStatus) loadStatus.innerText = ""; 

    } catch (err) {
        console.error(err);
        if (loadStatus) {
            loadStatus.innerText = "로딩 실패: " + err.message;
            loadStatus.style.color = "red";
        }
    }

    // 엔터키 입력 (입력 모드일 때만 동작)
    const answerInput = document.getElementById('answer-input');
    if (answerInput) {
        answerInput.addEventListener('keypress', (e) => {
            if (isInputMode && e.key === 'Enter') checkAnswer();
        });
    }
});

function startQuiz() {
    if (!isDataLoaded) return;
    document.getElementById('intro-layer').style.display = 'none';
    document.getElementById('quiz-layer').style.display = 'flex';
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
    
    // UI 초기화
    document.getElementById('result-overlay').style.display = 'none';
    document.getElementById('input-group').style.display = 'flex';
    document.getElementById('user-answer-display').style.display = 'none'; 
    document.getElementById('btn-next').style.display = 'none';
    
    // 진행상태
    const percent = ((currentIndex) / quizData.length) * 100;
    document.getElementById('progress').style.width = `${percent}%`;
    document.getElementById('q-num').innerText = `Q. ${currentIndex + 1} / ${quizData.length}`;
    document.getElementById('q-text').innerText = q.question || "내용 없음"; 
    
    const input = document.getElementById('answer-input');
    
    // ★ [핵심] 모드에 따른 입력창 처리
    if (isInputMode) {
        // [입력 모드] 기존 로직
        input.disabled = false;
        let placeholderText = "정답 입력";
        if (q.is_strict) placeholderText += " (★정확히 입력)";
        if (reqCount > 1) placeholderText += ` / ${reqCount}개 필요`;
        input.placeholder = placeholderText;
        input.value = '';
        input.focus();
    } else {
        // [관람 모드] 입력 막고 안내 문구 표시
        input.disabled = true;
        input.value = '';
        input.placeholder = "⏳ 제한시간이 끝나면 정답이 공개됩니다...";
    }

    // 미디어 처리
    const mediaArea = document.getElementById('media-area');
    if (mediaArea) {
        mediaArea.innerHTML = ''; 
        if (q.image_url && q.image_url.trim() !== '') {
            const url = q.image_url.trim();
            const youtubeId = getYouTubeId(url);
            if (youtubeId) {
                mediaArea.innerHTML = `<iframe id="yt-player" src="https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0&enablejsapi=1" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
                mediaArea.innerHTML = `<video controls name="media"><source src="${url}" type="video/mp4"></video>`;
            } else {
                mediaArea.innerHTML = `<img src="${url}" alt="문제 이미지" onerror="this.style.display='none'">`;
            }
        } else if (q.image_data) {
            mediaArea.innerHTML = `<img src="${q.image_data}" alt="문제 이미지">`;
        }
    }

    // 타이머 시작 (관람 모드는 강제로 실행됨)
    if (useTimeLimit) {
        document.getElementById('timer-box').style.display = 'block';
        startTimer();
    } else {
        document.getElementById('timer-box').style.display = 'none';
    }
}

function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function startTimer() {
    let timeLeft = timeLimit; 
    const timerElement = document.getElementById('timer-sec');
    if(timerElement) timerElement.innerText = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        if(timerElement) timerElement.innerText = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // ★ [핵심] 시간 종료 시 처리 분기
            if (isInputMode) {
                handleTimeOutInputMode(); // 입력 모드: 오답 처리
            } else {
                handleTimeOutViewMode();  // 관람 모드: 정답 공개
            }
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

// [입력 모드용] 시간 초과 -> 오답 처리
function handleTimeOutInputMode() {
    const input = document.getElementById('answer-input');
    if(input) input.disabled = true; 
    const userValue = input ? (input.value.trim() || "(입력 못함)") : "";
    // false = 오답, true = 타임아웃 메시지용 플래그
    showResultOverlay(false, 0, userValue, true);
}

// [관람 모드용] 시간 초과 -> 그냥 정답 공개 (채점 X)
function handleTimeOutViewMode() {
    showResultOverlayViewMode();
}

function cleanString(str) {
    if (!str) return "";
    return str.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/정답[:\s]*/g, '').replace(/[\s,.]/g, '').toLowerCase();
}

// [입력 모드용] 정답 체크 로직
function checkAnswer() {
    if (!isInputMode) return; // 관람 모드면 실행 안 함

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
            if (isStrict) return dbAns === uInput;
            else return (dbAns === uInput) || (dbAns.includes(uInput) && uInput.length > 0) || (uInput.includes(dbAns) && dbAns.length > 0);
        });
        if (isHit) matchCount++;
    });

    const isSuccess = matchCount >= requiredCount;
    if (isSuccess) score++;
    showResultOverlay(isSuccess, matchCount, userAns, false);
}

// [입력 모드용] 결과 오버레이 (정답/오답 표시)
function showResultOverlay(isSuccess, matchCount, userAnsText, isTimeout) {
    stopMediaPlayback();
    const q = quizData[currentIndex];
    const explanation = q.explanation ? q.explanation.trim() : "";
    const rawCleanAnswer = q.answer.replace(/\|/g, ', ').replace(/\[.*?\]/g, '').trim();

    const overlay = document.getElementById('result-overlay');
    const content = document.getElementById('overlay-content');

    let titleHtml = isTimeout ? `<div class="overlay-msg" style="color:#dc3545">⏰ 시간 초과!</div>` :
                    isSuccess ? `<div class="overlay-msg" style="color:#28a745">⭕ 정답입니다!</div>` :
                                `<div class="overlay-msg" style="color:#dc3545">❌ 틀렸습니다!</div>`;
    let bgClass = isSuccess ? '#d4edda' : '#fff3cd';
    let explanationHtml = explanation ? `<div class="exp-box" style="background:${bgClass}; padding:10px; margin-top:10px; border-radius:5px;">💡 ${explanation}</div>` : '';

    if(content) {
        content.innerHTML = `
            ${titleHtml}
            <div class="overlay-sub" style="margin-top:10px; color:#666;">정답은?</div>
            <div class="overlay-big-answer" style="font-size:1.8rem; font-weight:bold; margin:10px 0;">${rawCleanAnswer}</div>
            ${explanationHtml} 
        `;
    }

    displayOverlayCommon(userAnsText, isSuccess);
}

// [관람 모드용] 결과 오버레이 (단순 정답 공개)
function showResultOverlayViewMode() {
    stopMediaPlayback();
    const q = quizData[currentIndex];
    const explanation = q.explanation ? q.explanation.trim() : "";
    const rawCleanAnswer = q.answer.replace(/\|/g, ', ').replace(/\[.*?\]/g, '').trim();

    const overlay = document.getElementById('result-overlay');
    const content = document.getElementById('overlay-content');

    // 맞고 틀림 표시 없음
    let titleHtml = `<div class="overlay-msg" style="color:#007bff">📢 정답 공개</div>`;
    let explanationHtml = explanation ? `<div class="exp-box" style="background:#e2e3e5; padding:10px; margin-top:10px; border-radius:5px;">💡 ${explanation}</div>` : '';

    if(content) {
        content.innerHTML = `
            ${titleHtml}
            <div class="overlay-big-answer" style="font-size:2rem; font-weight:bold; margin:15px 0; color:#333;">${rawCleanAnswer}</div>
            ${explanationHtml} 
        `;
    }
    
    // 유저 입력값 표시 부분은 숨기거나 비움
    displayOverlayCommon("", true); // true로 보내서 색상 초록색 등 처리 (하지만 텍스트는 없음)
    const myAnswerBox = document.getElementById('user-answer-display');
    if(myAnswerBox) myAnswerBox.style.display = 'none'; // 입력값 박스 아예 숨김
}

// 오버레이 공통 처리 (버튼 보이기 등)
function displayOverlayCommon(userAnsText, isSuccess) {
    const inputGroup = document.getElementById('input-group');
    const myAnswerText = document.getElementById('my-answer-text');
    const btnNext = document.getElementById('btn-next');
    const myAnswerBox = document.getElementById('user-answer-display');
    const overlay = document.getElementById('result-overlay');

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
    
    // ★ [핵심] 모드에 따른 결과창 분기
    if (isInputMode) {
        // [입력 모드] 점수판 보여주기
        const finalScore = Math.round((score / quizData.length) * 100);
        container.innerHTML = `
            <div style="text-align:center; margin-top:50px;">
                <h1>🎉 퀴즈 종료!</h1>
                <div style="font-size:4rem; color:#007bff; margin:20px;">${finalScore}점</div>
                <p>(정답 ${score}개 / 전체 ${quizData.length}문제)</p>
                <button onclick="location.href='../select_page/user_main.html'" style="padding:15px; background:#007bff; color:white; border-radius:10px; margin-top:20px; cursor:pointer;">목록으로</button>
            </div>`;
    } else {
        // [관람 모드] 점수 없음, 그냥 종료 메시지
        container.innerHTML = `
            <div style="text-align:center; margin-top:50px;">
                <h1>🎬 퀴즈 종료</h1>
                <p style="font-size:1.5rem; color:#555; margin:30px 0;">모든 정답이 공개되었습니다.</p>
                <button onclick="location.href='../select_page/user_main.html'" style="padding:15px; background:#6c757d; color:white; border-radius:10px; margin-top:20px; cursor:pointer;">목록으로</button>
            </div>`;
    }
}
