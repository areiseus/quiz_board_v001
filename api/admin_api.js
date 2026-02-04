const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

const getClient = () => {
    return new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
};

// 비밀번호 검증 API
router.post('/verify-password', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "비밀번호가 일치하지 않습니다." });
    }
});

// 퀴즈 생성 API
router.post('/create-quiz', upload.single('thumbnail'), async (req, res) => {
    const client = getClient();
    let isConnected = false; // [추가] 연결 상태 확인용 변수

    try {
        const { title, dbName, creator, description, quizData } = req.body;
        const imageFile = req.file;

        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        if (safeDbName !== dbName) {
            return res.status(400).json({ error: "DB명은 영문 소문자, 숫자, 언더바(_)만 가능합니다." });
        }

        // 1. DB 연결 시도
        await client.connect();
        isConnected = true; // [추가] 연결 성공 표시
        
        await client.query('BEGIN');

        // 2. 퀴즈 묶음 저장
        const insertBundleQuery = `
            INSERT INTO quiz_bundles 
            (title, target_db_name, creator, description, image_data, image_type)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        const imgBuffer = imageFile ? imageFile.buffer : null;
        const imgType = imageFile ? imageFile.mimetype : null;

        await client.query(insertBundleQuery, [
            title, safeDbName, creator, description, imgBuffer, imgType
        ]);

        // 3. 테이블 생성
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS ${safeDbName} (
                id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                quiz_no int NOT NULL,
                question text NOT NULL,
                answer text NOT NULL,
                image_data bytea,
                image_type text,
                image_url text
            )
        `;
        await client.query(createTableQuery);

        // 4. 데이터 삽입
        const quizzes = JSON.parse(quizData);
        for (const q of quizzes) {
            await client.query(
                `INSERT INTO ${safeDbName} (quiz_no, question, answer, image_data, image_type, image_url) 
                 VALUES ($1, $2, $3, NULL, NULL, NULL)`,
                [q.no, q.question, q.answer]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "퀴즈 DB 생성 완료!" });

    } catch (error) {
        // [수정] 연결이 되어 있을 때만 ROLLBACK 시도
        if (isConnected) {
            try { await client.query('ROLLBACK'); } catch (e) { console.error("Rollback failed:", e); }
        }
        console.error("에러 발생:", error);
        // 에러 내용을 화면으로 확실하게 보냄
        res.status(500).json({ error: "DB 오류: " + error.message });
    } finally {
        // [수정] 연결이 되어 있을 때만 종료
        if (isConnected) {
            try { await client.end(); } catch (e) {}
        }
    }
});

module.exports = router;
