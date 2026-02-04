const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const router = express.Router();

// 이미지를 메모리에 임시 저장 (썸네일 + 문제 이미지 공용)
const upload = multer({ storage: multer.memoryStorage() });

// DB 클라이언트 생성 함수
const getClient = () => {
    return new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
};

// ==========================================
// 1. 관리자 인증 API
// ==========================================
router.post('/verify-password', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "비밀번호 불일치" });
    }
});

// ==========================================
// 2. 퀴즈 생성 API (자동 테이블 생성 포함)
// ==========================================
router.post('/create-quiz', upload.single('thumbnail'), async (req, res) => {
    const client = getClient();
    let isConnected = false;

    try {
        const { title, dbName, creator, description, quizData } = req.body;
        const imageFile = req.file;

        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        if (safeDbName !== dbName) {
            return res.status(400).json({ error: "DB명은 영문 소문자, 숫자, 언더바(_)만 가능합니다." });
        }

        await client.connect();
        isConnected = true;
        await client.query('BEGIN');

        // 퀴즈 목록 테이블이 없으면 자동 생성
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

        // 퀴즈 묶음 정보 저장
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

        // 개별 퀴즈 문제용 테이블 생성
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

        // 문제 데이터 삽입
        const quizzes = JSON.parse(quizData); 
        for (const q of quizzes) {
            await client.query(
                `INSERT INTO ${safeDbName} (quiz_no, question, answer, image_data, image_type, image_url) 
                 VALUES ($1, $2, $3, NULL, NULL, NULL)`,
                [q.no, q.question, q.answer]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "✅ 퀴즈 DB 생성 및 저장 완료!" });

    } catch (error) {
        if (isConnected) {
            try { await client.query('ROLLBACK'); } catch (e) {}
        }
        console.error("에러 발생:", error);
        res.status(500).json({ error: "DB 오류: " + error.message });
    } finally {
        if (isConnected) {
            try { await client.end(); } catch (e) {}
        }
    }
});

// ==========================================
// 3. 퀴즈 수정 페이지용 API (신규 기능)
// ==========================================

// 목록 불러오기
router.get('/list-quizzes', async (req, res) => {
    const client = getClient();
    try {
        await client.connect();
        const result = await client.query(`
            SELECT title, target_db_name, creator, created_at 
            FROM quiz_bundles 
            ORDER BY created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error("목록 로드 실패:", error);
        res.status(500).json({ error: "목록을 불러오지 못했습니다." });
    } finally {
        await client.end();
    }
});

// 상세 내용 불러오기
router.get('/get-quiz-detail', async (req, res) => {
    const client = getClient();
    try {
        const { dbName } = req.query;
        // DB명 유효성 검사 (보안)
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, ''); 

        await client.connect();
        
        // 해당 테이블의 문제 조회
        const query = `SELECT id, quiz_no, question, answer, image_url, image_type FROM ${safeDbName} ORDER BY quiz_no ASC`;
        const result = await client.query(query);

        res.json(result.rows);
    } catch (error) {
        console.error("상세 로드 실패:", error);
        res.status(500).json({ error: "문제 내용을 불러오지 못했습니다." });
    } finally {
        await client.end();
    }
});

// 퀴즈 업데이트
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
            // 파일 확인 (name="file_ID")
            const newFile = req.files.find(f => f.fieldname === `file_${q.id}`);
            
            let updateQuery = '';
            let params = [];

            if (newFile) {
                // 이미지 포함 업데이트
                updateQuery = `
                    UPDATE ${safeDbName}
                    SET question = $1, answer = $2, image_url = $3, 
                        image_data = $4, image_type = $5
                    WHERE id = $6
                `;
                params = [q.question, q.answer, q.image_url, newFile.buffer, newFile.mimetype, q.id];
            } else {
                // 텍스트/URL만 업데이트
                updateQuery = `
                    UPDATE ${safeDbName}
                    SET question = $1, answer = $2, image_url = $3
                    WHERE id = $4
                `;
                params = [q.question, q.answer, q.image_url, q.id];
            }

            await client.query(updateQuery, params);
        }

        await client.query('COMMIT');
        res.json({ message: "✅ 수정 완료!" });

    } catch (error) {
        if (isConnected) {
            try { await client.query('ROLLBACK'); } catch (e) {}
        }
        console.error("수정 실패:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (isConnected) {
            try { await client.end(); } catch (e) {}
        }
    }
});

module.exports = router;
