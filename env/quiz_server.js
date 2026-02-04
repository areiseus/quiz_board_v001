
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); 
// 같은 폴더(env) 안에 있는 .dbenv 파일 로드
require('dotenv').config({ path: path.join(__dirname, '.dbenv') }); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// [경로 수정] env 폴더에서 한 단계 위(../)로 가서 quiz 폴더를 찾아 정적 파일로 연결
app.use(express.static(path.join(__dirname, '../quiz')));

// [경로 수정] env 폴더에서 한 단계 위(../)로 가서 api 폴더 안의 파일 로드
const adminApi = require('../api/admin_api');
const userApi = require('../api/user_api');

// API 경로 연결
app.use('/api/admin', adminApi);
app.use('/api/user', userApi);

// 메인 접속 시 사용자 퀴즈 선택 페이지로 리다이렉트
app.get('/', (req, res) => {
    res.redirect('/user_page/select_page/user_main.html');
});

app.listen(PORT, () => {
        console.log(`서버 가동: http://localhost:${PORT}`);
    // 보여주신 파일명 구조에 맞게 로그 출력
    console.log(`관리자: http://localhost:${PORT}/admin_page/admin_main.html`);
});
// [필수 추가] Vercel이 이 앱을 실행할 수 있도록 내보내기
module.exports = app;
