const express = require('express');
const { Client } = require('pg');
const multer = require('multer');

// [변경점 1] 라우터만 쓰는 게 아니라 앱(app)을 생성합니다.
const app = express();
const router = express.Router();

// 이미지를 메모리에 임시 저장
const upload = multer({ storage: multer.memoryStorage() });

const getClient = () => {
    return new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
};

// ==========================================
// API 기능 정의 (기존 로직 그대로 유지)
// ==========================================

// 1. 관리자 비밀번호 검증
router.post('/verify-password', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "비밀번호 불일치" });
    }
});

// 2. 퀴즈 생성
router.post('/create-quiz', upload.single('thumbnail'), async (req, res) => {
    const client = getClient();
    let isConnected = false;

    try {
        const { title, dbName, creator, description, quizData } = req.body;
        const imageFile = req.file;

        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        if (safeDbName !== dbName) {
            return res.status(400).json({ error: "DB명 오류" });
        }

        await client.connect();
        isConnected = true;
        await client.query('BEGIN');

        await client.query(`
            CREATE TABLE IF NOT EXISTS quiz_bundles (
                uid uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                title text NOT NULL,
                target_db_name text NOT NULL,
                creator text,
                description text,
                image_data bytea,
                image_type text,
                created_at timestamptz DEFAULT now()
            )
        `);

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

        const quizzes = JSON.parse(quizData); 
        for (const q of quizzes) {
            await client.query(
                `INSERT INTO ${safeDbName} (quiz_no, question, answer, image_data, image_type, image_url) 
                 VALUES ($1, $2, $3, NULL, NULL, NULL)`,
                [q.no, q.question, q.answer]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "✅ 생성 완료!" });

    } catch (error) {
        if (isConnected) await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (isConnected) await client.end();
    }
});

// 3. 목록 불러오기 (여기가 문제였음)
router.get('/list-quizzes', async (req, res) => {
    const client = getClient();
    try {
        await client.connect();
        const result = await client.query(`
            SELECT title, target_db_name, creator, created_at, image_type 
            FROM quiz_bundles 
            ORDER BY created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// 4. 상세 내용
router.get('/get-quiz-detail', async (req, res) => {
    const client = getClient();
    try {
        const { dbName } = req.query;
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, ''); 
        await client.connect();
        const query = `SELECT id, quiz_no, question, answer, image_url, image_type FROM ${safeDbName} ORDER BY quiz_no ASC`;
        const result = await client.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// 5. 업데이트
router.post('/update-quiz', upload.any(), async (req, res) => {
    const client = getClient();
    let isConnected = false;
    try {
        const { dbName, quizData } = req.body;
        const quizzes = JSON.parse(quizData);
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');

        await client.connect();
        isConnected = true;
        await client.query('BEGIN');

        for (const q of quizzes) {
            const newFile = req.files.find(f => f.fieldname === `file_${q.id}`);
            let updateQuery = '';
            let params = [];

            if (newFile) {
                updateQuery = `UPDATE ${safeDbName} SET question=$1, answer=$2, image_url=$3, image_data=$4, image_type=$5 WHERE id=$6`;
                params = [q.question, q.answer, q.image_url, newFile.buffer, newFile.mimetype, q.id];
            } else {
                updateQuery = `UPDATE ${safeDbName} SET question=$1, answer=$2, image_url=$3 WHERE id=$4`;
                params = [q.question, q.answer, q.image_url, q.id];
            }
            await client.query(updateQuery, params);
        }

        await client.query('COMMIT');
        res.json({ message: "✅ 수정 완료!" });
    } catch (error) {
        if (isConnected) await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        if (isConnected) await client.end();
    }
});

// ==========================================
// [핵심 수정] 주소 문제 해결
// ==========================================
// 들어오는 모든 요청주소(/api/admin_api/...)를 
// 라우터가 처리할 수 있게 연결해줍니다.
app.use('/api/admin_api', router);

module.exports = app;
