let currentQuizData = []; // 가져온 문제들 저장
let currentIndex = 0;     // 현재 문제 번호 (0부터 시작)

document.addEventListener('DOMContentLoaded', initQuiz);

async function initQuiz() {
    // 1. URL에서 dbName 파라미터 추출
    const params = new URLSearchParams(window.location.search);
    const dbName = params.get('dbName');

    if (!dbName) {
        alert("잘못된 접근입니다. 퀴즈를 선택해주세요.");
        goHome();
        return;
    }

    try {
        // 2. 서버에서 해당 DB의 문제들 가져오기
        const response = await fetch(`/api/user/get-questions?dbName=${dbName}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        currentQuizData = data;
        
        if (currentQuizData.length > 0) {
            renderQuestion(); // 첫 번째 문제 표시
        } else {
            document.getElementById('question-text').innerText = "등록된 문제가 없습니다.";
        }

    } catch (error) {
        console.error(error);
        alert("문제를 불러오는데 실패했습니다: " + error.message);
    }
}

// 화면에 문제와 진행상황 표시
function renderQuestion() {
    const quiz = currentQuizData[currentIndex];
    const total = currentQuizData.length;

    // 진행 상황 업데이트 (예: Q. 1 / 10)
    document.getElementById('quiz-progress').innerText = `Q. ${currentIndex + 1} / ${total}`;
    
    // 문제 텍스트 적용
    document.getElementById('question-text').innerText = quiz.question;
    
    // 정답 텍스트 적용 (일단 숨김 상태)
    document.getElementById('answer-text').innerText = quiz.answer;
    
    // 화면 초기화 (정답 가리기, 버튼 설정)
    document.getElementById('answer-box').classList.add('hidden');
    document.getElementById('show-answer-btn').style.display = 'inline-block';
    document.getElementById('next-btn').style.display = 'none';
}

// 정답 보기 버튼 클릭 시
function showAnswer() {
    document.getElementById('answer-box').classList.remove('hidden'); // 정답 보이기
    document.getElementById('show-answer-btn').style.display = 'none'; // 정답 버튼 숨김
    document.getElementById('next-btn').style.display = 'inline-block'; // 다음 버튼 표시
}

// 다음 문제 버튼 클릭 시
function nextQuestion() {
    currentIndex++; // 다음 번호로

    if (currentIndex < currentQuizData.length) {
        renderQuestion(); // 다음 문제 렌더링
    } else {
        // 모든 문제가 끝났을 때
        alert("모든 문제를 다 풀었습니다! 👏👏👏");
        goHome();
    }
}

function goHome() {
    // 한 단계 위 폴더(../)의 select_page로 이동
    window.location.href = '../select_page/user_main.html';
}
