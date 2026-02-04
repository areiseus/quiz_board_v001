const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const router = express.Router();

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } 
});

const getClient = () => {
    return new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
};

// 1. 관리자 비밀번호 검증
router.post('/verify-password', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "비밀번호 불일치" });
    }
});

// 2. 퀴즈 생성 (자가 치유 로직 포함)
router.post('/create-quiz', upload.single('thumbnail'), async (req, res) => {
    const client = getClient();
    try {
        const { title, dbName, creator, description, quizData, quizMode = 'input' } = req.body;
        const imageFile = req.file;
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');

        if (!safeDbName) throw new Error("DB 이름이 잘못되었습니다.");

        await client.connect();
        await client.query('BEGIN');

        // (1) 메인 테이블 생성 (없으면 생성)
        await client.query(`
            CREATE TABLE IF NOT EXISTS quiz_bundles (
                uid uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                title text NOT NULL,
                target_db_name text NOT NULL UNIQUE, 
                creator text,
                description text,
                image_data bytea,
                image_type text,
                quiz_mode text DEFAULT 'input',
                use_pause boolean DEFAULT false,
                created_at timestamptz DEFAULT now()
            )
        `);

        // (2) 퀴즈 묶음 정보 삽입 (실패 시 컬럼 추가 후 재시도)
        const insertQuery = `
            INSERT INTO quiz_bundles 
            (title, target_db_name, creator, description, image_data, image_type, quiz_mode, use_pause)
            VALUES ($1, $2, $3, $4, $5, $6, $7, false)
        `;
        const insertParams = [title, safeDbName, creator, description, imageFile ? imageFile.buffer : null, imageFile ? imageFile.mimetype : null, quizMode];

        try {
            await client.query(insertQuery, insertParams);
        } catch (err) {
            // ★ [핵심] use_pause 컬럼이 없다는 에러가 나면, 알아서 추가하고 재시도
            if (err.message.includes('use_pause')) {
                await client.query('ALTER TABLE quiz_bundles ADD COLUMN IF NOT EXISTS use_pause boolean DEFAULT false');
                await client.query(insertQuery, insertParams); // 재시도
            } else {
                throw err; // 다른 에러면 던짐
            }
        }

        // (3) 개별 퀴즈 테이블 생성 (기존꺼 있으면 밀어버림 - 안전장치)
        await client.query(`DROP TABLE IF EXISTS ${safeDbName}`);
        await client.query(`
            CREATE TABLE ${safeDbName} (
                id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                quiz_no int NOT NULL,
                question text NOT NULL,
                answer text NOT NULL,
                explanation text,
                required_count int DEFAULT 1,
                is_strict boolean DEFAULT true, 
                image_data bytea,
                image_type text,
                image_url text
            )
        `);

        // (4) 데이터 삽입
        const quizzes = JSON.parse(quizData);
        for (const q of quizzes) {
            await client.query(
                `INSERT INTO ${safeDbName} (quiz_no, question, answer, explanation, required_count, is_strict) 
                 VALUES ($1, $2, $3, '', 1, true)`,
                [q.no, q.question, q.answer]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "✅ 퀴즈 생성 성공!" });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("생성 실패:", error);
        // JSON으로 에러 응답 (HTML 500 에러 방지)
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// 3. 목록 불러오기 (숨김 처리 적용)
router.get('/list-quizzes', async (req, res) => {
    const client = getClient();
    try {
        await client.connect();
        // use_pause가 true인 것은 제외
        const result = await client.query(`
            SELECT uid, title, target_db_name, creator, created_at, image_data, image_type, quiz_mode
            FROM quiz_bundles 
            WHERE use_pause IS NOT TRUE
            ORDER BY created_at DESC
        `);

        const quizzes = result.rows.map(row => {
            let thumbnail = null;
            if (row.image_data && row.image_type) {
                const base64 = Buffer.from(row.image_data).toString('base64');
                thumbnail = `data:${row.image_type};base64,${base64}`;
            }
            return { ...row, thumbnail: thumbnail };
        });

        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ... (나머지 get-quiz-detail, update-quiz 등 기존 코드는 그대로 유지하거나 필요하면 추가) ...
// (위 코드까지만 덮어씌우셔도 '생성'과 '목록'은 해결됩니다. update-quiz는 이전 답변 참고)
module.exports = router;
