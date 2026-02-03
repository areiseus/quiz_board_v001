const express = require('express');
const { Client } = require('pg');
const router = express.Router();

// DB 연결 함수
const getClient = () => {
    return new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
};

// 1. 퀴즈 목록 조회 API (메인 화면용)
// 설명: DB에 저장된 이미지(Binary)를 꺼내서 웹에서 볼 수 있는 문자열(Base64)로 바꿔서 보내줍니다.
router.get('/quiz-list', async (req, res) => {
    const client = getClient();
    try {
        await client.connect();

        // 퀴즈 묶음 리스트 전체 조회
        const result = await client.query(`
            SELECT uid, title, creator, description, target_db_name, image_data, image_type 
            FROM quiz_bundles 
            ORDER BY created_at DESC
        `);

        // 이미지 데이터 변환 작업 (Buffer -> Base64 URL)
        const quizzes = result.rows.map(row => {
            let imageUrl = null;
            if (row.image_data) {
                // 이미지가 있으면: "data:image/png;base64,....." 형태로 변환
                const base64Image = row.image_data.toString('base64');
                imageUrl = `data:${row.image_type};base64,${base64Image}`;
            }
            
            return {
                title: row.title,
                creator: row.creator,
                description: row.description,
                dbName: row.target_db_name,
                thumbnail: imageUrl // 변환된 이미지 주소
            };
        });

        res.json(quizzes);

    } catch (error) {
        console.error("목록 조회 실패:", error);
        res.status(500).json({ error: "퀴즈 목록을 불러오지 못했습니다." });
    } finally {
        await client.end();
    }
});

// 2. 특정 퀴즈 문제 불러오기 API (게임 시작용)
router.get('/get-questions', async (req, res) => {
    const client = getClient();
    try {
        // URL 파라미터로 dbName을 받음 (예: ?dbName=quiz_set_001)
        const { dbName } = req.query;

        // 보안 검사 (영어 소문자, 숫자, _ 만 허용)
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        if (!safeDbName) {
            return res.status(400).json({ error: "잘못된 DB 요청입니다." });
        }

        await client.connect();

        // 해당 테이블이 진짜 있는지 확인 (안 하면 에러 남)
        const checkTable = await client.query(`
            SELECT to_regclass('${safeDbName}') as exists
        `);
        
        if (!checkTable.rows[0].exists) {
            return res.status(404).json({ error: "존재하지 않는 퀴즈입니다." });
        }

        // 실제 문제 데이터 조회 (번호 순서대로)
        const query = `SELECT quiz_no, question, answer FROM ${safeDbName} ORDER BY quiz_no ASC`;
        const result = await client.query(query);

        res.json(result.rows);

    } catch (error) {
        console.error("문제 로드 실패:", error);
        res.status(500).json({ error: "문제를 불러오는 중 오류가 발생했습니다." });
    } finally {
        await client.end();
    }
});

module.exports = router;