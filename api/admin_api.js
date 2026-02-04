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

// 1. 비밀번호 검증
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
    try {
        const { title, dbName, creator, description, quizData } = req.body;
        const imageFile = req.file;
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');

        await client.connect();
        await client.query('BEGIN');

        // 테이블 생성 (created_at 포함)
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
        await client.query(insertBundleQuery, [title, safeDbName, creator, description, imgBuffer, imgType]);

        await client.query(`
            CREATE TABLE IF NOT EXISTS ${safeDbName} (
                id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                quiz_no int NOT NULL,
                question text NOT NULL,
                answer text NOT NULL,
                image_data bytea,
                image_type text,
                image_url text
            )
        `);

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
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============================================================
// 3. 목록 불러오기 (여기가 핵심 수정됨!)
// ============================================================
router.get('/list-quizzes', async (req, res) => {
    const client = getClient();
    try {
        await client.connect();
        
        // 1) created_at(날짜)과 image_data(이미지)를 다 가져옵니다.
        const result = await client.query(`
            SELECT uid, title, target_db_name, creator, created_at, image_data, image_type
            FROM quiz_bundles 
            ORDER BY created_at DESC
        `);

        // 2) 이미지 데이터를 화면에서 쓸 수 있게 변환(Base64)해서 보냅니다.
        const quizzes = result.rows.map(row => {
            let thumbnail = null;
            if (row.image_data && row.image_type) {
                // 바이너리 데이터를 Base64 문자열로 변환
                const base64 = Buffer.from(row.image_data).toString('base64');
                thumbnail = `data:${row.image_type};base64,${base64}`;
            }

            return {
                title: row.title,
                target_db_name: row.target_db_name,
                creator: row.creator,
                created_at: row.created_at, // 이제 날짜가 정상적으로 나갑니다.
                thumbnail: thumbnail        // 변환된 이미지 주소
            };
        });

        res.json(quizzes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// 4. 상세 내용 가져오기
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
    try {
        const { dbName, quizData } = req.body;
        const quizzes = JSON.parse(quizData);
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');

        await client.connect();
        await client.query('BEGIN');

        for (const q of quizzes) {
            const newFile = req.files.find(f => f.fieldname === `file_${q.id}`);
            let updateQuery = '', params = [];

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
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

module.exports = router;
