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

// 1. 관리자 비밀번호 검증
router.post('/verify-password', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "비밀번호 불일치" });
    }
});

// 2. 퀴즈 생성 (★여기가 문제였음 - 완벽 수정)
router.post('/create-quiz', upload.single('thumbnail'), async (req, res) => {
    const client = getClient();
    try {
        const { title, dbName, creator, description, quizData, quizMode = 'input' } = req.body;
        const imageFile = req.file;
        // DB 이름 안전하게 변환 (특수문자 제거)
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');

        await client.connect();
        await client.query('BEGIN');

        // (1) 퀴즈 묶음 정보 저장
        await client.query(`
            CREATE TABLE IF NOT EXISTS quiz_bundles (
                uid uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                title text NOT NULL,
                target_db_name text NOT NULL,
                creator text,
                description text,
                image_data bytea,
                image_type text,
                quiz_mode text DEFAULT 'input',
                created_at timestamptz DEFAULT now()
            )
        `);

        const insertBundleQuery = `
            INSERT INTO quiz_bundles 
            (title, target_db_name, creator, description, image_data, image_type, quiz_mode)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        const imgBuffer = imageFile ? imageFile.buffer : null;
        const imgType = imageFile ? imageFile.mimetype : null;
        await client.query(insertBundleQuery, [title, safeDbName, creator, description, imgBuffer, imgType, quizMode]);

        // (2) 개별 퀴즈 테이블 생성 (★새 컬럼들 포함!)
        // is_strict: 기본값 true (완전일치)
        // required_count: 기본값 1
        // explanation: 텍스트
        await client.query(`
            CREATE TABLE IF NOT EXISTS ${safeDbName} (
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

        // (3) 데이터 삽입 (텍스트 파일로 올린 데이터 넣기)
        const quizzes = JSON.parse(quizData); 
        for (const q of quizzes) {
            // 기본값으로 INSERT (설명='', 개수=1, 완전일치=true)
            await client.query(
                `INSERT INTO ${safeDbName} (quiz_no, question, answer, explanation, required_count, is_strict) 
                 VALUES ($1, $2, $3, '', 1, true)`,
                [q.no, q.question, q.answer]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "✅ 생성 완료!" });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("퀴즈 생성 오류:", error); // 서버 로그에 에러 출력
        res.status(500).json({ error: "생성 실패: " + error.message });
    } finally {
        await client.end();
    }
});

// 3. 목록 불러오기
router.get('/list-quizzes', async (req, res) => {
    const client = getClient();
    try {
        await client.connect();
        const result = await client.query(`
            SELECT uid, title, target_db_name, creator, created_at, image_data, image_type, quiz_mode
            FROM quiz_bundles 
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

// 4. 상세 내용 가져오기
router.get('/get-quiz-detail', async (req, res) => {
    const client = getClient();
    try {
        const { dbName } = req.query;
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, ''); 
        await client.connect();
        
        const query = `
            SELECT id, quiz_no, question, answer, explanation, required_count, is_strict, image_url, image_type, image_data 
            FROM ${safeDbName} 
            ORDER BY quiz_no ASC
        `;
        const result = await client.query(query);

        const questions = result.rows.map(row => {
            let convertedImage = null;
            if (row.image_data && row.image_type) {
                const base64 = Buffer.from(row.image_data).toString('base64');
                convertedImage = `data:${row.image_type};base64,${base64}`;
            }
            return { ...row, image_data: convertedImage };
        });

        res.json(questions);
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

        // 1. 대문 이미지 업데이트
        const thumbnailFile = req.files.find(f => f.fieldname === 'thumbnail');
        if (thumbnailFile) {
            await client.query(`
                UPDATE quiz_bundles 
                SET image_data = $1, image_type = $2 
                WHERE target_db_name = $3
            `, [thumbnailFile.buffer, thumbnailFile.mimetype, safeDbName]);
        }

        // 2. 문제 업데이트
        for (const q of quizzes) {
            const newFile = req.files.find(f => f.fieldname === `file_${q.id}`);
            const isStrict = (String(q.is_strict) === 'true');
            const deleteImage = (String(q.delete_image) === 'true');

            let updateQuery = '';
            let params = [];

            if (deleteImage) {
                updateQuery = `UPDATE ${safeDbName} SET question=$1, answer=$2, explanation=$3, required_count=$4, is_strict=$5, image_url=NULL, image_data=NULL, image_type=NULL WHERE id=$6`;
                params = [q.question, q.answer, q.explanation, q.required_count, isStrict, q.id];
            } else if (newFile) {
                updateQuery = `UPDATE ${safeDbName} SET question=$1, answer=$2, explanation=$3, required_count=$4, is_strict=$5, image_url=$6, image_data=$7, image_type=$8 WHERE id=$9`;
                params = [q.question, q.answer, q.explanation, q.required_count, isStrict, q.image_url, newFile.buffer, newFile.mimetype, q.id];
            } else {
                updateQuery = `UPDATE ${safeDbName} SET question=$1, answer=$2, explanation=$3, required_count=$4, is_strict=$5, image_url=$6 WHERE id=$7`;
                params = [q.question, q.answer, q.explanation, q.required_count, isStrict, q.image_url, q.id];
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
