const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const router = express.Router();

// 이미지를 메모리에 임시 저장 (썸네일용)
const upload = multer({ storage: multer.memoryStorage() });

const getClient = () => {
    return new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
};

// 퀴즈 생성 및 DB 테이블 생성 API
router.post('/create-quiz', upload.single('thumbnail'), async (req, res) => {
    const client = getClient();
    
    try {
        const { title, dbName, creator, description, quizData } = req.body;
        const imageFile = req.file; // 썸네일 파일

        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        if (safeDbName !== dbName) {
            return res.status(400).json({ error: "DB명은 영문 소문자, 숫자, 언더바(_)만 가능합니다." });
        }

        await client.connect();
        await client.query('BEGIN');

        // 1. 퀴즈 묶음(표지) 저장
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

        // 2. [수정됨] 문제 테이블 생성 (이미지/URL 컬럼 추가)
        // 나중에 이미지를 넣을 수 있게 'image_data', 'image_type', 'image_url' 컬럼을 미리 생성합니다.
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS ${safeDbName} (
                id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                quiz_no int NOT NULL,
                question text NOT NULL,
                answer text NOT NULL,
                image_data bytea,       -- [추가] 파일 업로드용
                image_type text,        -- [추가] 파일 타입
                image_url text          -- [추가] 이미지 링크용
            )
        `;
        await client.query(createTableQuery);

        // 3. 문제 데이터 삽입
        const quizzes = JSON.parse(quizData); 
        
        for (const q of quizzes) {
            // 지금은 텍스트만 넣지만, 나중을 위해 이미지 컬럼 자리에는 NULL을 넣어줍니다.
            await client.query(
                `INSERT INTO ${safeDbName} (quiz_no, question, answer, image_data, image_type, image_url) 
                 VALUES ($1, $2, $3, NULL, NULL, NULL)`,
                [q.no, q.question, q.answer]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "퀴즈 DB 생성 완료! (이미지 속성 포함됨)" });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("에러 발생:", error);
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

module.exports = router;
