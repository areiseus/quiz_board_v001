const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const sharp = require('sharp');
const router = express.Router();

// ★ [수정 포인트] 용량 제한을 500MB로 대폭 상향! 
// (사진 한 장에 500MB 넘는 건 세상에 거의 없으니 사실상 무제한이야!)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 } // 500MB (서버 안전을 위한 최소한의 안전벨트)
});

const getClient = () => {
    return new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
};

router.post('/verify-password', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "비밀번호 불일치" });
    }
});

// ==========================================================
// 2. 퀴즈 생성 (픽셀 제한 없음! 용량만 넉넉하게!)
// ==========================================================
router.post('/create-quiz', upload.single('thumbnail'), async (req, res) => {
    const client = getClient();
    try {
        const { 
            title, dbName, creator, description, quizData, 
            quizMode, timeLimit, useTimeLimit 
        } = req.body;

        // ★ 썸네일: WebP 변환 + 800px (용량 최적화)
        let thumbnailBuffer = null;
        let mimeType = 'image/webp'; 

        if (req.file) {
            thumbnailBuffer = await sharp(req.file.buffer)
                .resize({ width: 800, withoutEnlargement: true }) 
                .toFormat('webp', { quality: 85 }) 
                .toBuffer();
            
            console.log(`[썸네일 변환] ${req.file.size} -> ${thumbnailBuffer.length} bytes`);
        }

        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        if (!safeDbName) throw new Error("DB 이름이 잘못되었습니다.");

        const safeTimeLimit = timeLimit ? parseInt(timeLimit, 10) : 20; 
        const safeUseTimeLimit = (String(useTimeLimit) === 'true');
        const safeQuizMode = (String(quizMode) === 'true' || String(quizMode) === 'input');

        await client.connect();
        await client.query('BEGIN');

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

// 3. 목록 불러오기 (이미지 데이터 제외 -> 로딩 속도 UP)
router.get('/list-quizzes', async (req, res) => {
    const client = getClient();
    try {
        await client.connect();
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

// 4. 상세 조회
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
// 5. 업데이트 (WebP + 리사이징 적용)
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

module.exports = router;
