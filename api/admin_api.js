const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const sharp = require('sharp'); // 이미지 최적화 도구
const router = express.Router();

// ★ [설정] 용량 제한 30MB (서버 안전 + 고화질 충분)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 } 
});


// ★ [핵심 변경] 매번 연결하지 말고, 미리 만들어둔 수영장(Pool)을 쓰자!
// (이 코드가 router.get 안에 있으면 안 되고, 이렇게 바깥에 있어야 해!)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20, // 최대 연결 수 (동시 접속자가 많아도 버팀)
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});



// 1. 관리자 비밀번호 검증
router.post('/verify-password', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "비밀번호 불일치" });
    }
});

// ==========================================================
// 2. 퀴즈 생성 (WebP 변환 + 리사이징 ✨)
// ==========================================================
router.post('/create-quiz', upload.single('thumbnail'), async (req, res) => {
    const client = getClient();
    try {
        const { 
            title, dbName, creator, description, quizData, 
            quizMode, timeLimit, useTimeLimit 
        } = req.body;

        // [이미지 처리] 썸네일: WebP 변환 + 800px 리사이징
        let thumbnailBuffer = null;
        let mimeType = 'image/webp'; // 무조건 WebP로 저장됨

        if (req.file) {
            thumbnailBuffer = await sharp(req.file.buffer)
                .resize({ width: 800, withoutEnlargement: true }) 
                .toFormat('webp', { quality: 85 }) 
                .toBuffer();
            
            console.log(`[썸네일 생성] ${req.file.size} -> ${thumbnailBuffer.length} bytes`);
        }

        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        if (!safeDbName) throw new Error("DB 이름이 잘못되었습니다.");

        // 데이터 타입 안전 변환
        const safeTimeLimit = timeLimit ? parseInt(timeLimit, 10) : 20; 
        const safeUseTimeLimit = (String(useTimeLimit) === 'true');
        const safeQuizMode = (String(quizMode) === 'true' || String(quizMode) === 'input');

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
                quiz_mode boolean DEFAULT true,
                time_limit int DEFAULT 20,
                use_time_limit boolean DEFAULT true,
                quiz_activate boolean DEFAULT true,
                view_act boolean DEFAULT true,
                created_at timestamptz DEFAULT now()
            )
        `);

        // (2) 퀴즈 묶음 정보 삽입
        const insertQuery = `
            INSERT INTO quiz_bundles 
            (title, target_db_name, creator, description, image_data, image_type, quiz_mode, time_limit, use_time_limit, quiz_activate)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        `;
        
        const insertParams = [
            title, 
            safeDbName, 
            creator, 
            description, 
            thumbnailBuffer, 
            req.file ? mimeType : null, 
            safeQuizMode,
            safeTimeLimit, 
            safeUseTimeLimit 
        ];

        await client.query(insertQuery, insertParams);

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

        // (4) 문제 데이터 삽입
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

// ==========================================================
// 3. 목록 불러오기 (★ image_data 제거됨 -> 로딩 속도 10배 UP!)
// ==========================================================
router.get('/list-quizzes', async (req, res) => {
    const client = getClient();
    try {
        await client.connect();
        // ★ 여기서 'image_data'를 뺐기 때문에 목록이 깃털처럼 가벼워짐!
        const result = await client.query(`
            SELECT uid, title, target_db_name, creator, description, created_at, 
            image_type, quiz_mode, quiz_activate, view_act
            FROM quiz_bundles 
            ORDER BY created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// 4. 상세 조회 (문제 풀 때 사용)
router.get('/get-quiz-detail', async (req, res) => {
    const client = getClient();
    const { dbName } = req.query;
    if(!dbName) return res.status(400).json({ error: "DB 이름이 없습니다." });

    try {
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        await client.connect();
        
        const query = `
            SELECT id, quiz_no, question, answer, explanation, required_count, is_strict, image_url, image_type, image_data
            FROM ${safeDbName} 
            ORDER BY quiz_no ASC
        `;
        const result = await client.query(query);

        // 상세 조회는 문제 이미지가 필요하므로 Base64로 변환해서 줌
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

// ==========================================================
// 5. 업데이트 (WebP + 리사이징 적용 ✨)
// ==========================================================
router.post('/update-quiz', upload.any(), async (req, res) => {
    const client = getClient();
    try {
        const { dbName, quizData } = req.body;
        const quizzes = JSON.parse(quizData);
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');

        await client.connect();
        await client.query('BEGIN');

        // [1] 썸네일 업데이트 (WebP + 800px)
        const thumbnailFile = req.files.find(f => f.fieldname === 'thumbnail');
        if (thumbnailFile) {
            const resizedThumb = await sharp(thumbnailFile.buffer)
                .resize({ width: 800, withoutEnlargement: true })
                .toFormat('webp', { quality: 85 }) 
                .toBuffer();
            
            await client.query(`
                UPDATE quiz_bundles 
                SET image_data = $1, image_type = $2 
                WHERE target_db_name = $3
            `, [resizedThumb, 'image/webp', safeDbName]);
        }

        // [2] 개별 문제 업데이트 (WebP + 1440px)
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
                // ★ 문제 이미지 WebP 변환 + 1440px
                const resizedImage = await sharp(newFile.buffer)
                    .resize({ width: 1440, withoutEnlargement: true })
                    .toFormat('webp', { quality: 85 })
                    .toBuffer();
                
                console.log(`[문제 이미지 변환] ${newFile.size} -> ${resizedImage.length}`);

                updateQuery = `UPDATE ${safeDbName} SET question=$1, answer=$2, explanation=$3, required_count=$4, is_strict=$5, image_url=$6, image_data=$7, image_type=$8 WHERE id=$9`;
                params = [q.question, q.answer, q.explanation, q.required_count, isStrict, q.image_url, resizedImage, 'image/webp', q.id];
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

// ==========================================================
// 6. [NEW] 썸네일 전용 API (이게 있어서 미리보기가 가능해짐!)
// ==========================================================
router.get('/thumbnail', async (req, res) => {
    const { dbName } = req.query;
    if (!dbName) return res.status(404).send('No DB Name');

    try {
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        
        // ★ [변경 1] client.connect() 없이 바로 pool 사용 (엄청 빠름)
        const result = await pool.query(`
            SELECT image_data, image_type 
            FROM quiz_bundles 
            WHERE target_db_name = $1
        `, [safeDbName]);

        if (result.rows.length > 0 && result.rows[0].image_data) {
            const row = result.rows[0];
            
            // ★ [변경 2] 브라우저 캐싱 적용! (이게 대박임)
            // "야 브라우저야, 이 이미지는 1년(31536000초) 동안 안 바뀌니까 또 요청하지 말고 저장해놔!"
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            
            res.writeHead(200, {
                'Content-Type': row.image_type || 'image/webp',
                'Content-Length': row.image_data.length
            });
            res.end(row.image_data);
        } else {
            res.status(404).send('No Image');
        }
    } catch (e) {
        console.error(e);
        res.status(500).send(e.message);
    } 
    // ★ pool은 닫지 않아! (계속 재사용)
});

// 7. 퀴즈 설정값 가져오기 (게임 시작 전용)
router.get('/get-quiz-quiz_bundles', async (req, res) => {
    const client = getClient();
    const { dbName } = req.query;
    
    if (!dbName) return res.status(400).json({ error: "No DB Name" });

   try {
        await client.connect();
        const result = await client.query(`
            SELECT quiz_mode, time_limit, use_time_limit, description 
            FROM quiz_bundles
            WHERE target_db_name = $1
        `, [dbName]);

        if (result.rows.length > 0) {
            const row = result.rows[0];
            res.json({
                quiz_mode: row.quiz_mode,
                time_limit: row.time_limit,
                use_time_limit: row.use_time_limit,
                description: row.description 
            });
        } else {
            res.status(404).json({ error: "quiz_bundles DB not found" });
        }
    } catch (e) {
        console.error("설정 로드 실패:", e.message);
        res.json({});
    } finally {
        await client.end();
    }
});

module.exports = router;
