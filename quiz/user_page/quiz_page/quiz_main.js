let quizData = [];
let currentIndex = 0;
let score = 0;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. URL주소에서 db 파라미터 가져오기 (?db=이름)
    const params = new URLSearchParams(window.location.search);
    const dbName = params.get('db');

    if (!dbName) {
        alert("잘못된 접근입니다.");
        location.href = '../select_page/user_main.html';
        return;
    }

    // 2. 서버 API로 문제 데이터 요청
    try {
        const res = await fetch(`/api/admin_api/get-quiz-detail?dbName=${dbName}`);
        if (!res.ok) throw new Error("문제 로드 실패");
        
        quizData = await res.json();
        
        if (!quizData || quizData.length === 0) {
            alert("등록된 문제가 없습니다.");
            location.href = '../select_page/user_main.html';
            return;
        }

        renderQuestion(); // 첫 문제 화면에 그리기

    } catch (err) {
        alert("오류 발생: " + err.message);
    }

    // 엔터키 누르면 제출되게 하기
    document.getElementById('answer-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
});

// 화면 그리기 함수
function renderQuestion() {
    // 마지막 문제까지 다 풀었으면 결과 화면 보여주기
    if (currentIndex >= quizData.length) {
        showResult();
        return;
    }

    const q = quizData[currentIndex];
    
    // 진행바 채우기
    const percent = ((currentIndex) / quizData.length) * 100;
    document.getElementById('progress').style.width = `${percent}%`;
    
    // 텍스트 넣기
    document.getElementById('q-num').innerText = `Q. ${currentIndex + 1} / ${quizData.length}`;
    document.getElementById('q-text').innerText = q.question;
    
    // 입력창 초기화
    const input = document.getElementById('answer-input');
    input.value = '';
    input.focus();
    document.getElementById('result-msg').innerText = '';

    // 이미지 처리
    const mediaArea = document.getElementById('media-area');
    mediaArea.innerHTML = ''; 

    // URL 이미지가 있으면 보여줌
    if (q.image_url && q.image_url.trim() !== '') {
        mediaArea.innerHTML = `<img src="${q.image_url}" alt="문제 이미지">`;
    } 
    // 직접 올린 이미지(Base64)가 있으면 보여줌
    else if (q.image_data) {
        mediaArea.innerHTML = `<img src="${q.image_data}" alt="문제 이미지">`;
    }
}

// 정답 확인 함수
function checkAnswer() {
    const input = document.getElementById('answer-input');
    const msg = document.getElementById('result-msg');
    const userAns = input.value.trim();
    const correctAns = quizData[currentIndex].answer;

    if (!userAns) return; // 빈칸이면 반응 안 함

    // 대소문자 상관없이 비교
    if (userAns.toLowerCase() === correctAns.toLowerCase()) {
        msg.innerHTML = "<span class='correct'>⭕ 정답!</span>";
        score++;
        // 0.8초 뒤 다음 문제로 자동 이동
        setTimeout(() => {
            currentIndex++;
            renderQuestion();
        }, 800);
    } else {
        msg.innerHTML = `<span class='wrong'>❌ 땡! 정답은 '${correctAns}'</span>`;
        // 1.5초 뒤 다음 문제로 이동
        setTimeout(() => {
            currentIndex++;
            renderQuestion();
        }, 1500);
    }
}

// 최종 결과 화면 함수
function showResult() {
    const container = document.querySelector('.container');
    // 결과 화면 HTML로 교체
    container.innerHTML = `
        <h1 style="margin-bottom:20px;">🎉 퀴즈 종료!</h1>
        <div style="font-size:3rem; font-weight:bold; color:#007bff; margin:30px 0;">
            ${score} / ${quizData.length}
        </div>
        <p>수고하셨습니다!</p>
        <button class="btn-submit" style="margin:0; width:100%;" onclick="location.href='../select_page/user_main.html'">
            목록으로 돌아가기
        </button>
    `;
}
