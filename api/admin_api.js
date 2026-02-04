// ... (기존 create-quiz 코드 위쪽 생략) ...

// ==========================================
// [신규 기능] 퀴즈 수정 페이지용 API
// ==========================================

// 1. 수정 가능한 퀴즈 목록 불러오기 (제목, DB명만 가볍게)
router.get('/list-quizzes', async (req, res) => {
    const client = getClient();
    try {
        await client.connect();
        // quiz_bundles 테이블에서 목록 조회
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

// 2. 특정 퀴즈의 상세 문제들 불러오기
router.get('/get-quiz-detail', async (req, res) => {
    const client = getClient();
    try {
        const { dbName } = req.query;
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, ''); // 보안 처리

        await client.connect();
        
        // 해당 테이블의 모든 문제 조회 (ID 포함)
        const query = `SELECT id, quiz_no, question, answer, image_url, image_type FROM ${safeDbName} ORDER BY quiz_no ASC`;
        const result = await client.query(query);

        // 이미지 데이터(BLOB)가 있는지 여부만 알려줌 (데이터 자체가 크니까)
        // 실제로는 텍스트와 URL 위주로 편집
        res.json(result.rows);
    } catch (error) {
        console.error("상세 로드 실패:", error);
        res.status(500).json({ error: "문제 내용을 불러오지 못했습니다." });
    } finally {
        await client.end();
    }
});

// 3. 퀴즈 업데이트 (텍스트 수정 + 이미지 파일/URL 변경)
router.post('/update-quiz', upload.any(), async (req, res) => {
    const client = getClient();
    
    try {
        const { dbName, quizData } = req.body;
        const quizzes = JSON.parse(quizData); // 수정된 문제 리스트
        
        const safeDbName = dbName.replace(/[^a-z0-9_]/g, '');

        await client.connect();
        await client.query('BEGIN');

        for (const q of quizzes) {
            // 1. 파일이 새로 업로드되었는지 확인
            // 프론트에서 file input의 name을 "file_문제ID" 형식으로 보낼 예정
            const newFile = req.files.find(f => f.fieldname === `file_${q.id}`);
            
            let updateQuery = '';
            let params = [];

            if (newFile) {
                // A. 파일이 있는 경우: 이미지 데이터까지 업데이트
                updateQuery = `
                    UPDATE ${safeDbName}
                    SET question = $1, answer = $2, image_url = $3, 
                        image_data = $4, image_type = $5
                    WHERE id = $6
                `;
                params = [q.question, q.answer, q.image_url, newFile.buffer, newFile.mimetype, q.id];
            } else {
                // B. 파일이 없는 경우: 텍스트와 URL만 업데이트 (기존 이미지 유지)
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
        res.json({ message: "✅ 수정 내용이 저장되었습니다!" });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("수정 실패:", error);
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

module.exports = router;
