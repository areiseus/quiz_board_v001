const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const router = express.Router();

// 1. 이미지를 메모리에 임시 저장하는 설정 (DB에 바로 넣기 위함)
const upload = multer({ storage: multer.memoryStorage() });

// DB 연결 함수
const getClient = () => {
    return new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
};

// 2. 퀴즈 묶음 생성 및 이미지/데이터 저장 API
// (관리자 화면에서 '저장' 누르면 여기로 옴)
router.post('/create-quiz', upload.single('thumbnail'), async (req, res) => {
    const client = getClient();
    
    try {
        // 프론트에서 보낸 데이터 받기
        const { title, dbName, creator, description, quizData } = req.body;
        const imageFile = req.file; // 업로드된 이미지 파일

        // DB명 유효성 검사 (영어 소문자, 숫자, _ 만 허용)
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');
        if (safeDbName !== dbName) {
            return res.status(400).json({ error: "DB명은 영문 소문자, 숫자, 언더바(_)만 가능합니다." });
        }

        await client.connect();
        await client.query('BEGIN'); // 트랜잭션 시작

        // A. 퀴즈 묶음 리스트(quiz_bundles)에 정보 등록 (이미지 포함)
        const insertBundleQuery = `
            INSERT INTO quiz_bundles 
            (title, target_db_name, creator, description, image_data, image_type)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        // 이미지가 있으면 바이너리 데이터, 없으면 null
        const imgBuffer = imageFile ? imageFile.buffer : null;
        const imgType = imageFile ? imageFile.mimetype : null;

        await client.query(insertBundleQuery, [
            title, 
            safeDbName, 
            creator, 
            description, 
            imgBuffer, 
            imgType
        ]);

        // B. 실제 퀴즈 데이터를 담을 테이블 동적 생성
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS ${safeDbName} (
                id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                quiz_no int NOT NULL,
                question text NOT NULL,
                answer text NOT NULL
            )
        `;
        await client.query(createTableQuery);

        // C. 퀴즈 문제들 삽입
        // quizData는 JSON 문자열로 넘어오므로 파싱 필요
        const quizzes = JSON.parse(quizData); 
        
        for (const q of quizzes) {
            await client.query(
                `INSERT INTO ${safeDbName} (quiz_no, question, answer) VALUES ($1, $2, $3)`,
                [q.no, q.question, q.answer]
            );
        }

        await client.query('COMMIT'); // 최종 저장
        res.json({ message: "퀴즈 DB 생성 및 저장 완료!" });

    } catch (error) {
        await client.query('ROLLBACK'); // 실패 시 취소
        console.error("에러 발생:", error);
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

module.exports = router;
