const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); 
require('dotenv').config({ path: path.join(__dirname, '.dbenv') }); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../quiz')));

const adminApi = require('../api/admin_api');
// const userApi = require('../api/user_api'); 

// [수정] 프론트엔드 요청에 맞춰 주소 이름 변경 (/api/admin -> /api/admin_api)
app.use('/api/admin_api', adminApi);
// app.use('/api/user', userApi);

app.get('/', (req, res) => {
    res.redirect('/user_page/select_page/user_main.html');
});

app.listen(PORT, () => {
    console.log(`서버 가동: http://localhost:${PORT}`);
});

module.exports = app;
