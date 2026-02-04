let quizData = [];
let currentIndex = 0;
let score = 0;
let timerInterval = null;

// [수정] DB 설정값에 따라 변하는 변수로 변경 (기본값 설정)
let timeLimit = 15;     // DB의 time_limit 값
let useTimeLimit = true; // DB의 use_time_limit 값

let isDataLoaded = false; 

document.addEventListener('DOMContentLoaded', async () => {
    // 1. URL 파라미터 읽기
    const params = new URLSearchParams(window.location.search);
    const dbName = params.get('db');
    const title = params.get('title') || "퀴즈 제목";
    const creator = params.get('creator') || "알 수 없음";

    if (!dbName) {
        alert("잘못된 접근입니다. (DB 정보가 없습니다)");
        location.href = '../select_page/user_main.html';
        return;
    }

    // UI 초기 세팅
    const introTitle = document.getElementById('intro-title');
    const introCreator = document.getElementById('intro-creator');
    if (introTitle) introTitle.innerText = title;
    if (introCreator) introCreator.innerText = `Created by ${creator}`;
    
    const startBtn = document.querySelector('.btn-start');
    const loadStatus = document.getElementById('loading-status');
    
    if (startBtn) startBtn.disabled = true;
    if (loadStatus) loadStatus.innerText = "로딩 중...";

    try {
        // [1] 문제 데이터 가져오기
        const qRes = await fetch(`/api/admin_api/get-quiz-detail?dbName=${dbName}`);
        
        // 정밀 에러 검출
        if (!qRes.ok) {
            const errText = await qRes.text();
            let finalMsg = "서버 연결 실패";
            try {
                const jsonErr = JSON.parse(errText);
                finalMsg = jsonErr.error || jsonErr.message || errText;
            } catch (e) {
                finalMsg = errText.substring(0, 300); 
            }
            alert(`[문제 로딩 실패]\n${finalMsg}`);
            throw new Error(finalMsg);
        }
        quizData = await qRes.json();

        // [2] ★ 설정 데이터(Settings DB) 가져오기 ★
        // (Settings DB에서 time_limit, use_time_limit 값을 가져옵니다)
        try {
            const sRes = await fetch(`/api/admin_api/get-quiz-settings?dbName=${dbName}`);
            if (sRes.ok) {
                const settings = await sRes.json();
                
                // ★ DB 값 적용 (필드가 존재할 경우에만 덮어쓰기)
                if (settings.time_limit !== undefined && settings.time_limit !== null) {
                    timeLimit = parseInt(settings.time_limit);
                }
                if (settings.use_time_limit !== undefined && settings.use_time_limit !== null) {
                    // DB에서 1/0 혹은 true/false로 올 수 있으므로 boolean 변환
                    useTimeLimit = (settings.use_time_limit === true || settings.use_time_limit === 'true' || settings.use_time_limit === 1);
                }
                
                console.log(`[설정 적용] 시간제한: ${timeLimit}초, 사용여부: ${useTimeLimit}`);
            }
        } catch (settingErr) {
            console.warn("설정 로드 실패 (기본값 사용):", settingErr);
        }

        // 데이터 검증
        if (!quizData || quizData.length === 0) {
            alert("불러올 문제가 없습니다.");
            location.href = '../select_page/user_main.html';
            return;
        }

        // 로딩 완료
        isDataLoaded = true;
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = "도전하기!";
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
    
    // UI 초기화
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
    
    // 힌트 텍스트
    let placeholderText = "정답 입력";
    if (q.is_strict) placeholderText += " (★정확히 입력)";
    if (reqCount > 1) placeholderText += ` / ${reqCount}개 필요 (쉼표 구분)`;
    input.placeholder = placeholderText;

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

    input.value = '';
    input.disabled = false;
    input.focus();

    // ★ [핵심] use_time_limit 값에 따라 타이머 작동 결정
    const timerElement = document.getElementById('timer-sec');
    const timerContainer = timerElement ? timerElement.parentElement : null; // 타이머 감싸는 박스 찾기 (구조에 따라 다름)

    if (useTimeLimit) {
        // 타이머 사용
        if (timerContainer) timerContainer.style.display = 'block';
        if (timerElement) timerElement.style.display = 'inline'; // 혹은 block
        startTimer();
    } else {
        // 타이머 미사용 (숨김)
        if (timerContainer) timerContainer.style.display = 'none';
        else if (timerElement) timerElement.style.display = 'none';
        // startTimer() 호출 안 함 -> 무제한 시간
    }
}

function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// [수정] timeLimit 변수 사용
function startTimer() {
    let timeLeft = timeLimit; 
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

// 문자열 정제 (공백, 콤마 등 제거)
function cleanString(str) {
    if (!str) return "";
    return str.replace(/\[.*?\]/g, '')
              .replace(/\(.*?\)/g, '')
              .replace(/정답[:\s]*/g, '')
              .replace(/[\s,.]/g, '') // 공백, 콤마, 점 제거
              .toLowerCase();
}

function checkAnswer() {
    const input = document.getElementById('answer-input');
    if (!input || input.disabled) return;
    const userAns = input.value.trim();
    if (!userAns) return; 

    // 타이머가 돌고 있었다면 멈춤
    if (timerInterval) clearInterval(timerInterval);
    
    input.disabled = true; 

    const q = quizData[currentIndex];
    const requiredCount = parseInt(q.required_count) || 1;
    const isStrict = q.is_strict; 
    
    const dbAnswers = q.answer.split('|').map(s => cleanString(s)).filter(s => s.length > 0);
    const userInputs = userAns.split(',').map(s => cleanString(s)).filter(s => s.length > 0);

    let matchCount = 0;
    const uniqueUserInputs = [...new Set(userInputs)];

    uniqueUserInputs.forEach(uInput => {
        const isHit = dbAnswers.some(dbAns => {
            if (isStrict) {
                return dbAns === uInput;
            } else {
                // 양방향 포함 체크
                return (dbAns === uInput) || 
                       (dbAns.includes(uInput) && uInput.length > 0) || 
                       (uInput.includes(dbAns) && dbAns.length > 0);
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
    
    // 원본 정답 보여주기 (파이프 -> 콤마로 보기 좋게)
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
            <div style="font-size:1rem; color:#555; margin-bottom:10px;">(맞춘 개수: ${matchCount} / 필요: ${requiredCount})</div>
            ${explanationHtml} 
        `;
    }

    const inputGroup = document.getElementById('input-group');
    const myAnswerText = document.getElementById('my-answer-text');
    const btnNext = document.getElementById('btn-next');
    const myAnswerBox = document.getElementById('user-answer-display');

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
    container.innerHTML = `
        <div style="text-align:center; margin-top:50px;">
            <h1>🎉 퀴즈 종료!</h1>
            <div style="font-size:4rem; color:#007bff; margin:20px;">${finalScore}점</div>
            <p>(정답 ${score}개 / 전체 ${quizData.length}문제)</p>
            <button onclick="location.href='../select_page/user_main.html'" style="padding:15px; background:#007bff; color:white; border-radius:10px; margin-top:20px;">목록으로</button>
        </div>`;
}
