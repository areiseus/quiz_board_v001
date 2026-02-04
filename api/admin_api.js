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

// 1. 관리자 비밀번호 검증 (원본 유지)
router.post('/verify-password', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "비밀번호 불일치" });
    }
});

// 2. 퀴즈 생성 (원본 유지)
router.post('/create-quiz', upload.single('thumbnail'), async (req, res) => {
    const client = getClient();
    try {
        const { title, dbName, creator, description, quizData, quizMode = 'input' } = req.body;
        const imageFile = req.file;
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');

        if (!safeDbName) throw new Error("DB 이름이 잘못되었습니다.");

        await client.connect();
        await client.query('BEGIN');

        // (1) 메인 테이블 생성
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

        // (2) 퀴즈 묶음 정보 삽입
        const insertQuery = `
            INSERT INTO quiz_bundles 
            (title, target_db_name, creator, description, image_data, image_type, quiz_mode, use_pause)
            VALUES ($1, $2, $3, $4, $5, $6, $7, false)
        `;
        const insertParams = [title, safeDbName, creator, description, imageFile ? imageFile.buffer : null, imageFile ? imageFile.mimetype : null, quizMode];

        try {
            await client.query(insertQuery, insertParams);
        } catch (err) {
            if (err.message.includes('use_pause')) {
                await client.query('ALTER TABLE quiz_bundles ADD COLUMN IF NOT EXISTS use_pause boolean DEFAULT false');
                await client.query(insertQuery, insertParams); 
            } else {
                throw err; 
            }
        }

        // (3) 개별 퀴즈 테이블 생성
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
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// 3. 목록 불러오기 (원본 유지)
router.get('/list-quizzes', async (req, res) => {
    const client = getClient();
    try {
        await client.connect();
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

// ==========================================================
// ▼ 여기부터 추가됨: 에러 검출용 상세 조회 API & 수정 API ▼
// ==========================================================

// 4. 상세 내용 가져오기 (디버깅용 로그 포함)
router.get('/get-quiz-detail', async (req, res) => {
    const client = getClient();
    const { dbName } = req.query;
    
    // [로그] 요청 들어옴
    console.log(`[DEBUG] get-quiz-detail 요청: ${dbName}`);

    if(!dbName) {
        return res.status(400).json({ error: "DB 이름이 없습니다." });
    }

    try {
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        await client.connect();
        
        // [로그] 테이블 존재 확인
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            );
        `, [safeDbName]);

        if (!tableCheck.rows[0].exists) {
            console.error(`[DEBUG] 테이블 없음: ${safeDbName}`);
            throw new Error(`DB에 '${safeDbName}' 테이블이 없습니다. 생성 과정을 확인하세요.`);
        }

        // [로그] 데이터 조회
        const query = `
            SELECT id, quiz_no, question, answer, explanation, required_count, is_strict, image_url, image_type, image_data 
            FROM ${safeDbName} 
            ORDER BY quiz_no ASC
        `;
        const result = await client.query(query);
        console.log(`[DEBUG] 조회 성공. 데이터 개수: ${result.rows.length}`);

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
        console.error("[DEBUG] 조회 중 에러:", error);
        // ★ 중요: HTML 대신 JSON 에러 반환 (Unexpected token < 해결)
        res.status(500).json({ error: error.message, stack: error.stack });
    } finally {
        await client.end();
    }
});

// 5. 업데이트 (수정 기능 필수 포함)
router.post('/update-quiz', upload.any(), async (req, res) => {
    const client = getClient();
    try {
        const { dbName, quizData } = req.body;
        const quizzes = JSON.parse(quizData);
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');

        await client.connect();
        await client.query('BEGIN');

        // 대문 이미지 업데이트
        const thumbnailFile = req.files.find(f => f.fieldname === 'thumbnail');
        if (thumbnailFile) {
            await client.query(`
                UPDATE quiz_bundles 
                SET image_data = $1, image_type = $2 
                WHERE target_db_name = $3
            `, [thumbnailFile.buffer, thumbnailFile.mimetype, safeDbName]);
        }

        // 개별 문제 업데이트
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

// 6. 퀴즈 설정값 가져오기 (이 부분이 없어서 시간이 15초로 고정됐던 것입니다)
router.get('/get-quiz-quiz_bundles', async (req, res) => {
    const client = getClient();
    const { dbName } = req.query;
    
    if (!dbName) return res.status(400).json({ error: "No DB Name" });

    try {
        await client.connect();
        
        // quiz_bundles 테이블에서 설정값(시간, 모드 등)을 조회합니다.
        const result = await client.query(`
            SELECT quiz_mode, time_limit, use_time_limit
            FROM quiz_bundles
            WHERE target_db_name = $1
        `, [dbName]);

        if (result.rows.length > 0) {
            const row = result.rows[0];
            
            // DB에 있는 값을 그대로 클라이언트에 보냅니다.
            res.json({
                quiz_mode: row.quiz_mode,
                time_limit: row.time_limit,          // DB에 20이라고 있으면 20이 나갑니다.
                use_time_limit: row.use_time_limit
            });
        } else {
            res.status(404).json({ error: "quiz_bundles DB not found" });
        }
    } catch (e) {
        console.error("설정 로드 실패:", e.message);
        // 에러 시 빈 객체 반환 (클라이언트가 기본값 쓰도록)
        res.json({});
    } finally {
        await client.end();
    }
});

