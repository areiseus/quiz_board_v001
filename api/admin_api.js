const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const router = express.Router();

// 파일 업로드 설정 (메모리 저장)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB 제한
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

// 2. 퀴즈 생성 (에러 처리 강화됨)
router.post('/create-quiz', upload.single('thumbnail'), async (req, res) => {
    const client = getClient();
    try {
        const { title, dbName, creator, description, quizData, quizMode = 'input' } = req.body;
        const imageFile = req.file;
        
        // DB 이름 유효성 재검사 (서버측)
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        if (!safeDbName) throw new Error("유효하지 않은 DB 이름입니다.");

        await client.connect();
        await client.query('BEGIN'); // 트랜잭션 시작

        // (1) 퀴즈 묶음 정보 저장 (quiz_bundles)
        // use_pause 컬럼도 고려 (기본값 false)
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

        // 중복 DB명 체크를 위해 INSERT 시도
        const insertBundleQuery = `
            INSERT INTO quiz_bundles 
            (title, target_db_name, creator, description, image_data, image_type, quiz_mode)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        const imgBuffer = imageFile ? imageFile.buffer : null;
        const imgType = imageFile ? imageFile.mimetype : null;
        
        await client.query(insertBundleQuery, [title, safeDbName, creator, description, imgBuffer, imgType, quizMode]);

        // (2) 개별 퀴즈 테이블 생성
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

        // (3) 데이터 파싱 및 삽입
        let quizzes = [];
        try {
            quizzes = JSON.parse(quizData);
        } catch (e) {
            throw new Error("전송된 데이터(JSON) 형식이 잘못되었습니다.");
        }

        for (const q of quizzes) {
            await client.query(
                `INSERT INTO ${safeDbName} (quiz_no, question, answer, explanation, required_count, is_strict) 
                 VALUES ($1, $2, $3, '', 1, true)`,
                [q.no, q.question, q.answer]
            );
        }

        await client.query('COMMIT'); // 성공 시 반영
        res.json({ message: "✅ 퀴즈 DB가 성공적으로 생성되었습니다!" });

    } catch (error) {
        await client.query('ROLLBACK'); // 실패 시 되돌리기
        console.error("DB 생성 에러:", error); // 서버 로그 출력

        // 클라이언트에 구체적인 에러 메시지 전달
        if (error.code === '23505') { // Postgres Unique Violation Code
            res.status(400).json({ error: "이미 존재하는 DB 이름입니다. 다른 이름을 써주세요." });
        } else {
            res.status(500).json({ error: "서버 오류: " + error.message });
        }
    } finally {
        await client.end();
    }
});

// 3. 목록 불러오기 (★ use_pause가 true면 숨김 처리)
router.get('/list-quizzes', async (req, res) => {
    const client = getClient();
    try {
        await client.connect();

        // use_pause가 true인 것은 제외하고 가져오기
        // (컬럼이 없을 수도 있으니 에러 방지를 위해 테이블 확인 후 쿼리하거나, 단순하게 처리)
        // 여기서는 위 SQL에서 컬럼을 추가했다고 가정하고 필터링합니다.
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
        console.error("목록 로드 에러:", error);
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
        if(!dbName) throw new Error("DB명이 없습니다.");

        const safeDbName = dbName.replace(/[^a-z0-9_]/g, ''); 
        await client.connect();
        
        // 테이블 존재 여부 확인 (안전장치)
        const checkTable = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            );
        `, [safeDbName]);

        if (!checkTable.rows[0].exists) {
            throw new Error("해당 퀴즈 테이블을 찾을 수 없습니다.");
        }

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
