const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const router = express.Router();

// 파일 업로드 설정
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

// 2. 퀴즈 생성 (DB 충돌 방지 로직 추가)
router.post('/create-quiz', upload.single('thumbnail'), async (req, res) => {
    const client = getClient();
    try {
        const { title, dbName, creator, description, quizData, quizMode = 'input' } = req.body;
        const imageFile = req.file;
        
        // DB 이름 정제
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        if (!safeDbName) throw new Error("DB 이름이 비어있거나 잘못되었습니다.");

        await client.connect();
        await client.query('BEGIN'); // 트랜잭션 시작

        // (1) 메인 묶음 테이블 생성 (없을 경우)
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

        // (2) 퀴즈 묶음 정보 등록
        // 중복된 DB명이면 에러 발생
        const checkExist = await client.query('SELECT 1 FROM quiz_bundles WHERE target_db_name = $1', [safeDbName]);
        if (checkExist.rowCount > 0) {
            throw new Error("이미 존재하는 DB 이름입니다. 다른 이름을 사용해주세요.");
        }

        const insertBundleQuery = `
            INSERT INTO quiz_bundles 
            (title, target_db_name, creator, description, image_data, image_type, quiz_mode, use_pause)
            VALUES ($1, $2, $3, $4, $5, $6, $7, false)
        `;
        const imgBuffer = imageFile ? imageFile.buffer : null;
        const imgType = imageFile ? imageFile.mimetype : null;
        
        await client.query(insertBundleQuery, [title, safeDbName, creator, description, imgBuffer, imgType, quizMode]);

        // (3) [핵심 수정] 개별 퀴즈 테이블 생성
        // ★ 만약 이전에 만들다 만 찌꺼기 테이블이 있으면 삭제하고 다시 만듦 (에러 방지)
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

        // (4) 데이터 파싱 및 삽입
        let quizzes = [];
        try {
            quizzes = JSON.parse(quizData);
        } catch (e) {
            throw new Error("전송된 데이터(JSON) 형식이 깨졌습니다.");
        }

        for (const q of quizzes) {
            // 새 컬럼들(explanation, required_count, is_strict) 기본값 포함해서 넣기
            await client.query(
                `INSERT INTO ${safeDbName} (quiz_no, question, answer, explanation, required_count, is_strict) 
                 VALUES ($1, $2, $3, '', 1, true)`,
                [q.no, q.question, q.answer]
            );
        }

        await client.query('COMMIT'); 
        res.json({ message: "✅ 퀴즈 등록 성공!" });

    } catch (error) {
        await client.query('ROLLBACK'); 
        console.error("DB 생성 에러:", error);
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

        // use_pause 컬럼이 없어서 에러나는 경우를 대비해 예외처리 쿼리 사용 가능하지만
        // 위 SQL을 실행했다고 가정하고 조회
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
        console.error("목록 에러:", error);
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
