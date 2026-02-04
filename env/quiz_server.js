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

// [정적 파일 연결]
app.use(express.static(path.join(__dirname, '../quiz')));

// [파일 로드]
const adminApi = require('../api/admin_api');
// const userApi = require('../api/user_api'); // 필요시 주석 해제

// [핵심 수정] 프론트엔드가 /api/admin_api/... 로 요청하므로 여기도 이름을 맞춰줍니다.
app.use('/api/admin_api', adminApi);
// app.use('/api/user', userApi);

// 메인 접속 시 리다이렉트
app.get('/', (req, res) => {
    res.redirect('/user_page/select_page/user_main.html');
});

app.listen(PORT, () => {
    console.log(`서버 가동: http://localhost:${PORT}`);
});

// Vercel용 내보내기
module.exports = app;
