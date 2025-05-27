// boxRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

module.exports = function(dependencies) {
    const { pool, visionClient, BOX_JWT_SECRET, uploadDir, authenticateBoxUser, isAdminAuthenticated } = dependencies;
    const router = express.Router();

    // ---- Multer 配置 ----
    const boxImageStorage = multer.memoryStorage();
    const boxImageUpload = multer({
        storage: boxImageStorage,
        limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
        fileFilter: (req, file, cb) => {
            const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (allowedMimes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('只允許上傳圖片檔案 (jpeg, png, gif, webp)!'), false);
            }
        }
    });




    router.post('/users/register', boxImageUpload.single('profileImage'), async (req, res) => { // 使用 multer 中間件處理名為 'profileImage' 的文件字段
        const { username, password, confirmPassword } = req.body;
        // user_profile_image_url 不再從 req.body 直接獲取，而是通過上傳的文件處理

        // ... (輸入驗證如前) ...
        if (!username || !password || !confirmPassword) { /* ... */ }
        // ...

        let profileImageUrlToSave = '/images/default_avatar.png'; // 預設頭像

        try {
            // 步驟 0: 如果有上傳頭像文件，則處理它
            if (req.file) {
                const imageBuffer = req.file.buffer;
                const originalFilename = req.file.originalname;
                const tempUserIdForFilename = 'pending_user'; // 因為此時還沒有 user_id

                console.log(`[Register] Processing profile image: ${originalFilename}`);
                let sharpInstance = sharp(imageBuffer).rotate();
                const processedImageBuffer = await sharpInstance
                    .resize({ width: 200, height: 200, fit: 'cover', withoutEnlargement: true }) // 頭像通常較小
                    .jpeg({ quality: 75 })
                    .toBuffer();

                // 文件名可以使用一個臨時標識或等待用戶創建後再更新文件名包含真實userID
                // 這裡先用一個通用前綴，或者你可以在用戶記錄創建後再更新這個文件名
                const filename = `profile-${Date.now()}-${uuidv4().substring(0, 8)}.jpg`;
                const diskPath = path.join(uploadDir, filename);
                const urlPath = `/uploads/${filename}`;

                await fs.writeFile(diskPath, processedImageBuffer);
                profileImageUrlToSave = urlPath; // 更新要保存到數據庫的URL
                console.log(`[Register] Profile image saved to: ${diskPath}`);

                // 注意：此時還沒有 user_id，所以 uploaded_files.owner_user_id 不能立即設置
                // 可以在用戶記錄創建成功後，再更新 uploaded_files 表的 owner_user_id
                // 或者，如果 uploaded_files 允許 owner_user_id 為 NULL，可以先插入，之後更新
                const uploadedFileResult = await pool.query(
                    `INSERT INTO uploaded_files (file_path, original_filename, mimetype, size_bytes, file_type, owner_user_id)
                     VALUES ($1, $2, 'image/jpeg', $3, $4, NULL) RETURNING id`, // owner_user_id 暫時為 NULL
                    [urlPath, originalFilename, processedImageBuffer.length, 'profile_image_pending']
                );
                const tempUploadedFileId = uploadedFileResult.rows[0]?.id;
                console.log(`[Register] Profile image metadata saved to uploaded_files (pending owner), ID: ${tempUploadedFileId}`);
                // 你需要在下方用戶創建成功後，用真實的 newUser.user_id 回填這個 tempUploadedFileId 的 owner_user_id
            }


            // ... (檢查用戶名是否已存在，哈希密碼 - 如之前的代碼) ...
            const userCheck = await pool.query('SELECT 1 FROM BOX_Users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
            if (userCheck.rows.length > 0) {
                 // 如果之前上傳了圖片但用戶名衝突，需要考慮是否刪除已上傳的臨時圖片
                if (req.file && profileImageUrlToSave !== '/images/default_avatar.png') {
                    try { await fs.unlink(path.join(uploadDir, path.basename(profileImageUrlToSave))); } catch (e) { console.error("Error deleting temp profile image on user conflict:", e); }
                }
                return res.status(409).json({ error: '此用戶名已被註冊，請選擇其他名稱。' });
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);


            // 插入新用戶到數據庫，使用 profileImageUrlToSave
            const newUserResult = await pool.query(
                `INSERT INTO BOX_Users (username, password_hash, user_profile_image_url)
                 VALUES ($1, $2, $3)
                 RETURNING user_id, username, user_profile_image_url, created_at`,
                [username.trim(), hashedPassword, profileImageUrlToSave]
            );
            const newUser = newUserResult.rows[0];

            // (重要) 如果之前上傳了圖片並記錄到 uploaded_files，現在用 newUser.user_id 更新 owner_user_id
            if (req.file && typeof tempUploadedFileId !== 'undefined') {
                await pool.query('UPDATE uploaded_files SET owner_user_id = $1, file_type = $2 WHERE id = $3', [newUser.user_id, 'profile_image', tempUploadedFileId]);
                console.log(`[Register] Updated owner_user_id for uploaded_files ID: ${tempUploadedFileId} to user ${newUser.user_id}`);
            }


            const tokenPayload = { userId: newUser.user_id, username: newUser.username };
            const token = jwt.sign(tokenPayload, BOX_JWT_SECRET, { expiresIn: '7d' });

            res.status(201).json({
                success: true, message: '註冊成功！', token: token,
                user: { userId: newUser.user_id, username: newUser.username, profileImageUrl: newUser.user_profile_image_url }
            });

        } catch (err) {
            console.error('[API POST /box/users/register] Error:', err);
             // 如果出錯，且之前上傳了圖片，嘗試刪除它
            if (req.file && profileImageUrlToSave !== '/images/default_avatar.png' && err.code !== '23505' /* 不是因為用戶名衝突 */) {
                try { await fs.unlink(path.join(uploadDir, path.basename(profileImageUrlToSave))); } catch (e) { console.error("Error deleting profile image on registration error:", e); }
            }
            res.status(500).json({ error: '註冊過程中發生錯誤，請稍後再試。' });
        }
    });



    // ---- 輔助函數：檢查實體所有權 ----
    async function checkWarehouseOwnership(warehouseId, userId) {
        const result = await pool.query('SELECT user_id FROM BOX_Warehouses WHERE warehouse_id = $1', [warehouseId]);
        if (result.rows.length === 0) return { owned: false, found: false, message: '找不到指定的倉庫。' };
        if (result.rows[0].user_id !== userId) return { owned: false, found: true, message: '無權訪問此倉庫。' };
        return { owned: true, found: true };
    }

    async function checkBoxOwnership(boxId, userId) {
        const query = `
            SELECT b.box_id, w.user_id
            FROM BOX_Boxes b
            JOIN BOX_Warehouses w ON b.warehouse_id = w.warehouse_id
            WHERE b.box_id = $1;
        `;
        const result = await pool.query(query, [boxId]);
        if (result.rows.length === 0) return { owned: false, found: false, message: '找不到指定的紙箱。' };
        if (result.rows[0].user_id !== userId) return { owned: false, found: true, message: '無權訪問此紙箱。' };
        return { owned: true, found: true, warehouseId: result.rows[0].warehouse_id /* 可能有用 */ };
    }

    async function checkItemOwnership(itemId, userId) {
        const query = `
            SELECT i.item_id, w.user_id
            FROM BOX_Items i
            JOIN BOX_Boxes b ON i.box_id = b.box_id
            JOIN BOX_Warehouses w ON b.warehouse_id = w.warehouse_id
            WHERE i.item_id = $1;
        `;
        const result = await pool.query(query, [itemId]);
        if (result.rows.length === 0) return { owned: false, found: false, message: '找不到指定的物品。' };
        if (result.rows[0].user_id !== userId) return { owned: false, found: true, message: '無權訪問此物品。' };
        return { owned: true, found: true };
    }


    // =============================================
    // ==       用戶認證與管理 API                 ==
    // =============================================
    router.get('/users', async (req, res) => {
        try {
            const result = await pool.query('SELECT user_id, username, user_profile_image_url FROM BOX_Users ORDER BY username ASC');
            res.json(result.rows);
        } catch (err) {
            console.error('[API GET /box/users] Error:', err);
            res.status(500).json({ error: '無法獲取用戶列表' });
        }
    });







// POST /api/box/users/register - 新用戶註冊
router.post('/users/register', async (req, res) => {
    const { username, password, confirmPassword, user_profile_image_url } = req.body;

    // 1. 輸入驗證
    if (!username || !password || !confirmPassword) {
        return res.status(400).json({ error: '用戶名、密碼和確認密碼為必填項。' });
    }
    if (username.trim().length < 3) {
        return res.status(400).json({ error: '用戶名長度至少需要3位。' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: '密碼長度至少需要6位。' });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ error: '兩次輸入的密碼不一致。' });
    }

    try {
        // 2. 檢查用戶名是否已存在 (不區分大小寫)
        const userCheck = await pool.query('SELECT 1 FROM BOX_Users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
        if (userCheck.rows.length > 0) {
            return res.status(409).json({ error: '此用戶名已被註冊，請選擇其他名稱。' }); // 409 Conflict
        }

        // 3. 哈希密碼
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. 插入新用戶到數據庫
        const defaultProfileImage = user_profile_image_url || '/images/default_avatar.png'; // 可以設置一個預設頭像路徑
        const newUserResult = await pool.query(
            `INSERT INTO BOX_Users (username, password_hash, user_profile_image_url)
             VALUES ($1, $2, $3)
             RETURNING user_id, username, user_profile_image_url, created_at`,
            [username.trim(), hashedPassword, defaultProfileImage]
        );

        const newUser = newUserResult.rows[0];

        // 5. (可選) 註冊成功後自動為用戶登入並返回Token
        const tokenPayload = { userId: newUser.user_id, username: newUser.username };
        const token = jwt.sign(tokenPayload, BOX_JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            success: true,
            message: '註冊成功！',
            token: token, // 讓前端可以直接使用此token登入
            user: {
                userId: newUser.user_id,
                username: newUser.username,
                profileImageUrl: newUser.user_profile_image_url
            }
        });

    } catch (err) {
        console.error('[API POST /box/users/register] Error:', err);
        // 避免暴露詳細的數據庫錯誤給前端
        res.status(500).json({ error: '註冊過程中發生錯誤，請稍後再試。' });
    }
});









    router.post('/users/login', async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: '請提供用戶名和密碼。' });
        }
        try {
            const result = await pool.query('SELECT user_id, username, password_hash, user_profile_image_url FROM BOX_Users WHERE LOWER(username) = LOWER($1)', [username]);
            if (result.rows.length === 0) {
                return res.status(401).json({ error: '用戶名或密碼錯誤。' });
            }
            const user = result.rows[0];
            const passwordIsValid = await bcrypt.compare(password, user.password_hash);

            if (!passwordIsValid) {
                return res.status(401).json({ error: '用戶名或密碼錯誤。' });
            }

            const tokenPayload = { userId: user.user_id, username: user.username };
            const token = jwt.sign(tokenPayload, BOX_JWT_SECRET, { expiresIn: '7d' });

            res.json({
                success: true, message: '登入成功', token: token,
                user: { userId: user.user_id, username: user.username, profileImageUrl: user.user_profile_image_url }
            });
        } catch (err) {
            console.error('[API POST /box/users/login] Error:', err);
            res.status(500).json({ error: '登入失敗，請稍後再試。' });
        }
    });

    router.post('/admin/create-user', isAdminAuthenticated, async (req, res) => {
        const { username, password, user_profile_image_url } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: '用戶名和密碼為必填項。' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: '密碼長度至少需要6位。' });
        }
        try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const newUser = await pool.query(
                `INSERT INTO BOX_Users (username, password_hash, user_profile_image_url) VALUES ($1, $2, $3)
                 RETURNING user_id, username, user_profile_image_url, created_at`,
                [username, hashedPassword, user_profile_image_url || null]
            );
            res.status(201).json({ success: true, message: '用戶創建成功。', user: newUser.rows[0] });
        } catch (err) {
            console.error('[API POST /box/admin/create-user] Error:', err);
            if (err.code === '23505') { return res.status(409).json({ error: '用戶名已存在。' }); }
            res.status(500).json({ error: '創建用戶失敗。' });
        }
    });

    router.get('/users/me', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.userId;
        try {
            const result = await pool.query('SELECT user_id, username, user_profile_image_url, created_at FROM BOX_Users WHERE user_id = $1', [userId]);
            if (result.rows.length === 0) { return res.status(404).json({ error: '找不到用戶信息。' });}
            res.json(result.rows[0]);
        } catch (err) {
            console.error(`[API GET /users/me] User ${userId} Error:`, err);
            res.status(500).json({ error: '無法獲取用戶信息。' });
        }
    });

    router.put('/users/me/password', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.userId;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: '請提供當前密碼和新密碼。' });
        if (newPassword.length < 6) return res.status(400).json({ error: '新密碼長度至少需要6位。' });
        try {
            const userResult = await pool.query('SELECT password_hash FROM BOX_Users WHERE user_id = $1', [userId]);
            if (userResult.rows.length === 0) return res.status(404).json({ error: '找不到用戶。' });
            const passwordIsValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
            if (!passwordIsValid) return res.status(401).json({ error: '當前密碼不正確。' });
            const salt = await bcrypt.genSalt(10);
            const hashedNewPassword = await bcrypt.hash(newPassword, salt);
            await pool.query('UPDATE BOX_Users SET password_hash = $1 WHERE user_id = $2', [hashedNewPassword, userId]);
            res.json({ success: true, message: '密碼更新成功。' });
        } catch (err) {
            console.error(`[API PUT /users/me/password] User ${userId} Error:`, err);
            res.status(500).json({ error: '密碼更新失敗。' });
        }
    });

    router.put('/users/me/profile-image', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.userId;
        const { user_profile_image_url } = req.body;
        if (!user_profile_image_url || !user_profile_image_url.startsWith('/uploads/')) {
            return res.status(400).json({ error: '請提供有效的頭像圖片URL。' });
        }
        try {
            await pool.query('UPDATE BOX_Users SET user_profile_image_url = $1 WHERE user_id = $2', [user_profile_image_url, userId]);
            res.json({ success: true, message: '頭像更新成功。', user_profile_image_url });
        } catch (err) {
            console.error(`[API PUT /users/me/profile-image] User ${userId} Error:`, err);
            res.status(500).json({ error: '頭像更新失敗。' });
        }
    });

    // GET /api/box/auth/check - 驗證當前用戶的 Token 是否有效
    router.get('/auth/check', authenticateBoxUser, (req, res) => {
        // 如果 authenticateBoxUser 中間件成功執行 (即 Token 有效),
        // 就代表用戶已通過驗證。直接回應成功。
        // req.boxUser 中會包含已驗證的用戶信息。
        res.status(200).json({ 
            success: true, 
            message: 'Token is valid.', 
            user: { // 可以選擇性地返回一些用戶信息
                userId: req.boxUser.userId,
                username: req.boxUser.username 
            }
        });
    });

    // ====================================================================
    // ==       統一圖片上傳與分析 API                             ==
    // ====================================================================
    router.post('/upload-analyze-then-process-image', authenticateBoxUser, boxImageUpload.single('image'), async (req, res) => {
        // ... (已提供較完整的實現) ...
        if (!visionClient) {
            console.error('[Box Upload API] Vision AI client is not available.');
            return res.status(503).json({ error: "圖片分析服務目前不可用。" });
        }
        if (req.fileValidationError) { return res.status(400).json({ error: req.fileValidationError }); }
        if (!req.file) { return res.status(400).json({ error: '沒有上傳有效的圖片檔案。' }); }

        const imageBuffer = req.file.buffer;
        const originalFilename = req.file.originalname;
        const userId = req.boxUser.userId;
        const fileType = req.body.fileType || 'box_organizer_image';
        let diskPathForCleanup;

        try {
            const [visionAnalysisResult] = await visionClient.annotateImage({
                image: { content: imageBuffer },
                features: [ { type: 'LABEL_DETECTION', maxResults: 10 }, { type: 'OBJECT_LOCALIZATION', maxResults: 5 }],
            });
            let aiKeywords = [...new Set([...(visionAnalysisResult.labelAnnotations || []).map(l => l.description), ...(visionAnalysisResult.localizedObjectAnnotations || []).map(o => o.name)])];

            // --- 開始新增翻譯邏輯 ---
            if (dependencies.translationClient && aiKeywords.length > 0) {
                try {
                    console.log(`[Box Upload API] Translating keywords: ${aiKeywords.join(', ')}`);
                    // Google Cloud Translation API requires an array of strings
                    // The second argument 'zh' is the target language code for Chinese
                    const [translations] = await dependencies.translationClient.translate(aiKeywords, 'zh');
                    if (translations && translations.length === aiKeywords.length) {
                         aiKeywords = translations; // Replace English keywords with Chinese translations
                         console.log(`[Box Upload API] Translated keywords: ${aiKeywords.join(', ')}`);
                    } else {
                        console.warn("[Box Upload API] Translation result length mismatch or empty, using original keywords.");
                        // If translation fails or result is unexpected, keep original English keywords
                    }
                } catch (translateError) {
                    console.error("[Box Upload API] Error during translation:", translateError);
                    // If translation fails, keep original English keywords
                }
            } else if (aiKeywords.length === 0) {
                 console.log("[Box Upload API] No keywords detected, skipping translation.");
            } else {
                 console.warn("[Box Upload API] translationClient dependency not available, skipping translation.");
            }
            // --- 結束新增翻譯邏輯 ---

            const processedImageBuffer = await sharp(imageBuffer).rotate()
                .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer();

            const filename = `${userId}-${Date.now()}-${uuidv4().substring(0, 8)}.jpg`;
            const diskPath = path.join(uploadDir, filename);
            diskPathForCleanup = diskPath;
            const urlPath = `/uploads/${filename}`;
            await fs.writeFile(diskPath, processedImageBuffer);

            const uploadedFileResult = await pool.query(
                `INSERT INTO uploaded_files (file_path, original_filename, mimetype, size_bytes, file_type, owner_user_id)
                 VALUES ($1, $2, 'image/jpeg', $3, $4, $5) RETURNING id`,
                [urlPath, originalFilename, processedImageBuffer.length, fileType, userId]
            );
            const uploadedFileId = uploadedFileResult.rows[0]?.id;

            res.json({ success: true, ai_keywords: aiKeywords, image_url: urlPath, uploaded_file_id: uploadedFileId });
        } catch (error) {
            console.error(`[Box Upload API] Error for user ${userId}, file ${originalFilename}:`, error);
            if (diskPathForCleanup) {
                try {
                    if (await fs.access(diskPathForCleanup).then(() => true).catch(() => false)) {
                        await fs.unlink(diskPathForCleanup);
                    }
                } catch (cleanupError) { console.error(`[Box Upload API] Cleanup Error:`, cleanupError); }
            }
            res.status(500).json({ error: '圖片上傳與分析失敗。' });
        }
    });

    // ====================================================================
    // ==              倉庫、紙箱、物品、搜尋 API                     ==
    // ====================================================================

    // --- 倉庫管理 (Warehouses) ---
 router.post('/my-warehouses', authenticateBoxUser, async (req, res) => {
        const { warehouse_name, warehouse_description } = req.body;
        const userId = req.boxUser.userId;

        if (!warehouse_name || warehouse_name.trim() === '') {
            return res.status(400).json({ error: '倉庫名稱為必填項。' });
        }
        try {
            const checkQuery = 'SELECT 1 FROM BOX_Warehouses WHERE user_id = $1 AND LOWER(warehouse_name) = LOWER($2)';
            const checkResult = await pool.query(checkQuery, [userId, warehouse_name.trim()]);
            if (checkResult.rows.length > 0) {
                return res.status(409).json({ error: '您已擁有同名的倉庫。' });
            }
            const insertQuery = `
                INSERT INTO BOX_Warehouses (user_id, warehouse_name, warehouse_description)
                VALUES ($1, $2, $3)
                RETURNING *;`;
            const result = await pool.query(insertQuery, [userId, warehouse_name.trim(), warehouse_description || null]);
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error(`[API POST /my-warehouses] User ${userId} Error:`, err);
            res.status(500).json({ error: '創建倉庫失敗。' });
        }
    });
    
  router.get('/my-warehouses', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.userId;
        try {
            const query = `
                SELECT w.*, 
                       (SELECT COUNT(*) FROM BOX_Boxes b WHERE b.warehouse_id = w.warehouse_id) as box_count
                FROM BOX_Warehouses w
                WHERE w.user_id = $1
                ORDER BY w.warehouse_name ASC;`;
            const result = await pool.query(query, [userId]);
            res.json(result.rows);
        } catch (err) {
            console.error(`[API GET /my-warehouses] User ${userId} Error:`, err);
            res.status(500).json({ error: '無法獲取倉庫列表。' });
        }
    });
    

    router.get('/warehouses/:warehouseId', authenticateBoxUser, async (req, res) => {
        const { warehouseId } = req.params;
        const userId = req.boxUser.userId;
        try {
            const ownership = await checkWarehouseOwnership(warehouseId, userId);
            if (!ownership.found) return res.status(404).json({ error: '找不到指定的倉庫。' });
            if (!ownership.owned) return res.status(403).json({ error: '無權訪問此倉庫。' });

            const result = await pool.query('SELECT * FROM BOX_Warehouses WHERE warehouse_id = $1', [warehouseId]);
            res.json(result.rows[0]);
        } catch (err) {
            console.error(`[API GET /warehouses/:warehouseId] User ${userId} Error:`, err);
            res.status(500).json({ error: '獲取倉庫詳情失敗。' });
        }
    });
    
    router.put('/warehouses/:warehouseId', authenticateBoxUser, async (req, res) => {
        const { warehouseId } = req.params;
        const userId = req.boxUser.userId;
        const { warehouse_name, warehouse_description } = req.body;

        if (!warehouse_name || warehouse_name.trim() === '') {
            return res.status(400).json({ error: '倉庫名稱為必填項。' });
        }
        try {
            const ownership = await checkWarehouseOwnership(warehouseId, userId);
            if (!ownership.found) return res.status(404).json({ error: '找不到指定的倉庫。' });
            if (!ownership.owned) return res.status(403).json({ error: '無權修改此倉庫。' });

            // 檢查新名稱是否與該用戶的其他倉庫衝突 (排除當前倉庫)
            const nameCheckQuery = 'SELECT 1 FROM BOX_Warehouses WHERE user_id = $1 AND LOWER(warehouse_name) = LOWER($2) AND warehouse_id != $3';
            const nameCheckResult = await pool.query(nameCheckQuery, [userId, warehouse_name.trim(), warehouseId]);
            if (nameCheckResult.rows.length > 0) {
                return res.status(409).json({ error: '您已擁有同名的倉庫。' });
            }

            const updateQuery = `
                UPDATE BOX_Warehouses
                SET warehouse_name = $1, warehouse_description = $2, updated_at = NOW()
                WHERE warehouse_id = $3
                RETURNING *;`;
            const result = await pool.query(updateQuery, [warehouse_name.trim(), warehouse_description || null, warehouseId]);
            res.json(result.rows[0]);
        } catch (err) {
            console.error(`[API PUT /warehouses/:warehouseId] User ${userId} Error:`, err);
            res.status(500).json({ error: '更新倉庫失敗。' });
        }
    });
    

    router.delete('/warehouses/:warehouseId', authenticateBoxUser, async (req, res) => {
        const { warehouseId } = req.params;
        const userId = req.boxUser.userId;
        try {
            const ownership = await checkWarehouseOwnership(warehouseId, userId);
            if (!ownership.found) return res.status(404).json({ error: '找不到指定的倉庫。' });
            if (!ownership.owned) return res.status(403).json({ error: '無權刪除此倉庫。' });

            // ON DELETE CASCADE 會處理關聯的 BOX_Boxes 和 BOX_Items
            const result = await pool.query('DELETE FROM BOX_Warehouses WHERE warehouse_id = $1', [warehouseId]);
            if (result.rowCount === 0) { // 應該不會發生，因為上面檢查過了
                return res.status(404).json({ error: '找不到要刪除的倉庫。' });
            }
            res.status(204).send();
        } catch (err) {
            console.error(`[API DELETE /warehouses/:warehouseId] User ${userId} Error:`, err);
            res.status(500).json({ error: '刪除倉庫失敗。' });
        }
    });


    // --- 紙箱管理 (Boxes) ---
 // POST /api/box/warehouses/:warehouseId/boxes
    router.post('/warehouses/:warehouseId/boxes', authenticateBoxUser, async (req, res) => {
        const { warehouseId } = req.params;
        const userId = req.boxUser.userId;
        const { box_number, box_name, cover_image_url, ai_box_keywords, manual_notes } = req.body;

        if (!box_number || box_number.trim() === '' || !box_name || box_name.trim() === '') {
            return res.status(400).json({ error: '紙箱編號和紙箱名稱為必填項。' });
        }

        try {
            const ownership = await checkWarehouseOwnership(warehouseId, userId);
            if (!ownership.found) return res.status(404).json({ error: '找不到指定的倉庫。' });
            if (!ownership.owned) return res.status(403).json({ error: '無權在此倉庫下新增紙箱。' });

            // 檢查該倉庫下紙箱編號是否唯一
            const boxNumCheck = await pool.query('SELECT 1 FROM BOX_Boxes WHERE warehouse_id = $1 AND LOWER(box_number) = LOWER($2)', [warehouseId, box_number.trim()]);
            if (boxNumCheck.rows.length > 0) {
                return res.status(409).json({ error: `倉庫 ${warehouseId} 下已存在編號為 ${box_number} 的紙箱。` });
            }

            const insertQuery = `
                INSERT INTO BOX_Boxes (warehouse_id, box_number, box_name, cover_image_url, ai_box_keywords, manual_notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *;`;
            const result = await pool.query(insertQuery, [
                warehouseId,
                box_number.trim(),
                box_name.trim(),
                cover_image_url || null,
                Array.isArray(ai_box_keywords) ? ai_box_keywords : [],
                manual_notes || null
            ]);
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error(`[API POST /boxes] User ${userId}, Warehouse ${warehouseId} Error:`, err);
            res.status(500).json({ error: '新增紙箱失敗。' });
        }
    });
    
// GET /api/box/warehouses/:warehouseId/boxes
router.get('/warehouses/:warehouseId/boxes', authenticateBoxUser, async (req, res) => {
    const { warehouseId } = req.params;
    const userId = req.boxUser.userId;
    // 分頁參數
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // 每頁數量
    const offset = (page - 1) * limit;

    try {
        const ownership = await checkWarehouseOwnership(warehouseId, userId);
        if (!ownership.found) return res.status(404).json({ error: '找不到指定的倉庫。' });
        if (!ownership.owned) return res.status(403).json({ error: '無權訪問此倉庫的紙箱。' });

        const countResult = await pool.query('SELECT COUNT(*) FROM BOX_Boxes WHERE warehouse_id = $1', [warehouseId]);
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / limit);

        const query = `
            SELECT b.*,
                   (SELECT COUNT(*) FROM BOX_Items bi WHERE bi.box_id = b.box_id) as item_count
            FROM BOX_Boxes b
            WHERE b.warehouse_id = $1
            ORDER BY b.box_number ASC
            LIMIT $2 OFFSET $3;`;
        const result = await pool.query(query, [warehouseId, limit, offset]);
        res.json({
            boxes: result.rows,
            currentPage: page,
            totalPages: totalPages,
            totalItems: totalItems
        });
    } catch (err) {
        console.error(`[API GET /boxes] User ${userId}, Warehouse ${warehouseId} Error:`, err);
        res.status(500).json({ error: '獲取紙箱列表失敗。' });
    }
});


  // GET /api/box/warehouses/:warehouseId/boxes/:boxId - 獲取特定紙箱詳情 (包含物品列表)
  router.get('/warehouses/:warehouseId/boxes/:boxId', authenticateBoxUser, async (req, res) => {
    const { warehouseId, boxId } = req.params;
    const userId = req.boxUser.userId; // 從已認證的 Token 中獲取用戶 ID

    // 驗證輸入的 ID 是否為有效數字
    const numWarehouseId = parseInt(warehouseId);
    const numBoxId = parseInt(boxId);

    if (isNaN(numWarehouseId) || isNaN(numBoxId)) {
        return res.status(400).json({ error: '倉庫ID和紙箱ID必須是有效的數字。' });
    }

    try {
        // 1. 驗證用戶是否有權限訪問此倉庫
        const warehouseOwnership = await checkWarehouseOwnership(numWarehouseId, userId);
        if (!warehouseOwnership.found) {
            return res.status(404).json({ error: '找不到指定的倉庫。' });
        }
        if (!warehouseOwnership.owned) {
            return res.status(403).json({ error: '無權訪問此倉庫。' });
        }

        // 2. 獲取紙箱基本信息，並確認它屬於指定的倉庫
        const boxQuery = `
            SELECT box_id, warehouse_id, box_number, box_name, cover_image_url, ai_box_keywords, manual_notes, created_at, updated_at
            FROM BOX_Boxes
            WHERE box_id = $1 AND warehouse_id = $2;
        `;
        const boxResult = await pool.query(boxQuery, [numBoxId, numWarehouseId]);

        if (boxResult.rows.length === 0) {
            return res.status(404).json({ error: '找不到指定的紙箱，或該紙箱不屬於此倉庫。' });
        }
        const boxData = boxResult.rows[0];

        // 3. 獲取該紙箱下的所有物品列表
        const itemsQuery = `
            SELECT item_id, box_id, item_name, item_image_url, ai_item_keywords, item_description, quantity, created_at, updated_at
            FROM BOX_Items
            WHERE box_id = $1
            ORDER BY item_name ASC; -- 或按 created_at 排序
        `;
        const itemsResult = await pool.query(itemsQuery, [numBoxId]);

        // 4. 將物品列表附加到紙箱數據中
        boxData.items = itemsResult.rows;

        res.json(boxData);

    } catch (err) {
        console.error(`[API GET /warehouses/:warehouseId/boxes/:boxId] User ${userId}, Warehouse ${warehouseId}, Box ${boxId} Error:`, err);
        res.status(500).json({ error: '獲取紙箱詳情失敗。' });
    }
});



    router.put('/warehouses/:warehouseId/boxes/:boxId', authenticateBoxUser, async (req, res) => {
        const { warehouseId, boxId } = req.params;
        const userId = req.boxUser.userId;
        const { box_number, box_name, cover_image_url, ai_box_keywords, manual_notes } = req.body;

        if (!box_number || box_number.trim() === '' || !box_name || box_name.trim() === '') {
            return res.status(400).json({ error: '紙箱編號和紙箱名稱為必填項。' });
        }
        try {
            const warehouseOwnership = await checkWarehouseOwnership(warehouseId, userId);
            if (!warehouseOwnership.found || !warehouseOwnership.owned) return res.status(warehouseOwnership.found ? 403 : 404).json({ error: warehouseOwnership.message });

            const boxCheck = await pool.query('SELECT 1 FROM BOX_Boxes WHERE box_id = $1 AND warehouse_id = $2', [boxId, warehouseId]);
            if (boxCheck.rows.length === 0) return res.status(404).json({ error: '找不到要更新的紙箱或不屬於此倉庫。'});

            const boxNumCheck = await pool.query('SELECT 1 FROM BOX_Boxes WHERE warehouse_id = $1 AND LOWER(box_number) = LOWER($2) AND box_id != $3', [warehouseId, box_number.trim(), boxId]);
            if (boxNumCheck.rows.length > 0) {
                return res.status(409).json({ error: `倉庫 ${warehouseId} 下已存在編號為 ${box_number} 的紙箱。` });
            }

            const updateQuery = `
                UPDATE BOX_Boxes
                SET box_number = $1, box_name = $2, cover_image_url = $3, ai_box_keywords = $4, manual_notes = $5, updated_at = NOW()
                WHERE box_id = $6 AND warehouse_id = $7
                RETURNING *;`;
            const result = await pool.query(updateQuery, [
                box_number.trim(), box_name.trim(), cover_image_url || null,
                Array.isArray(ai_box_keywords) ? ai_box_keywords : [], manual_notes || null,
                boxId, warehouseId
            ]);
            res.json(result.rows[0]);
        } catch (err) {
            console.error(`[API PUT /boxes/:boxId] User ${userId} Error:`, err);
            res.status(500).json({ error: '更新紙箱失敗。' });
        }
    });

    router.delete('/warehouses/:warehouseId/boxes/:boxId', authenticateBoxUser, async (req, res) => {
        const { warehouseId, boxId } = req.params;
        const userId = req.boxUser.userId;
        try {
            const warehouseOwnership = await checkWarehouseOwnership(warehouseId, userId);
            if (!warehouseOwnership.found || !warehouseOwnership.owned) return res.status(warehouseOwnership.found ? 403 : 404).json({ error: warehouseOwnership.message });

            // ON DELETE CASCADE 會處理關聯的 BOX_Items
            const result = await pool.query('DELETE FROM BOX_Boxes WHERE box_id = $1 AND warehouse_id = $2', [boxId, warehouseId]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: '找不到要刪除的紙箱或不屬於此倉庫。' });
            }
            res.status(204).send();
        } catch (err) {
            console.error(`[API DELETE /boxes/:boxId] User ${userId} Error:`, err);
            res.status(500).json({ error: '刪除紙箱失敗。' });
        }
    });


    // --- 物品管理 (Items) ---
    // POST /api/box/warehouses/:warehouseId/boxes/:boxId/items
    router.post('/warehouses/:warehouseId/boxes/:boxId/items', authenticateBoxUser, async (req, res) => {
        const { warehouseId, boxId } = req.params;
        const userId = req.boxUser.userId;
        const { item_name, item_image_url, ai_item_keywords, item_description, quantity } = req.body;

        // 輸入驗證
        if (!item_name || item_name.trim() === '') {
            return res.status(400).json({ error: '物品名稱為必填項。' });
        }
        const itemQuantity = quantity !== undefined ? parseInt(quantity) : 1;
        if (isNaN(itemQuantity) || itemQuantity < 0) {
            return res.status(400).json({ error: '物品數量必須是非負整數。'});
        }

        try {
            // 1. 驗證用戶對倉庫的所有權
            const warehouseOwnership = await checkWarehouseOwnership(warehouseId, userId);
            if (!warehouseOwnership.found || !warehouseOwnership.owned) return res.status(warehouseOwnership.found ? 403 : 404).json({ error: warehouseOwnership.message });

            // 2. 驗證紙箱存在且屬於該倉庫 (通過 warehouseId)
            const boxCheck = await pool.query('SELECT 1 FROM BOX_Boxes WHERE box_id = $1 AND warehouse_id = $2', [boxId, warehouseId]);
            if (boxCheck.rows.length === 0) return res.status(404).json({ error: '找不到指定的紙箱或該紙箱不屬於此倉庫。'});

            // 3. 插入新物品到數據庫
            const insertQuery = `
                INSERT INTO BOX_Items (box_id, item_name, item_image_url, ai_item_keywords, item_description, quantity)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *;`;
            const result = await pool.query(insertQuery, [
                boxId,
                item_name.trim(),
                item_image_url || null, // 如果沒有圖片 URL，存儲 NULL
                Array.isArray(ai_item_keywords) ? ai_item_keywords : [], // 確保存儲為數組
                item_description || null,
                itemQuantity
            ]);

            // (可選) 更新相關紙箱的 updated_at 字段，以便前端知道內容有更新
            await pool.query('UPDATE BOX_Boxes SET updated_at = NOW() WHERE box_id = $1', [boxId]);

            res.status(201).json(result.rows[0]); // 返回新創建的物品數據

        } catch (err) {
            console.error(`[API POST /warehouses/:warehouseId/boxes/:boxId/items] User ${userId}, Warehouse ${warehouseId}, Box ${boxId} Error:`, err);
            res.status(500).json({ error: '新增物品失敗。' });
        }
    });

    router.get('/warehouses/:warehouseId/boxes/:boxId/items', authenticateBoxUser, async (req, res) => {
        const { warehouseId, boxId } = req.params;
        const userId = req.boxUser.userId;
        try {
            const warehouseOwnership = await checkWarehouseOwnership(warehouseId, userId);
            if (!warehouseOwnership.found || !warehouseOwnership.owned) return res.status(warehouseOwnership.found ? 403 : 404).json({ error: warehouseOwnership.message });

            const boxCheck = await pool.query('SELECT 1 FROM BOX_Boxes WHERE box_id = $1 AND warehouse_id = $2', [boxId, warehouseId]);
            if (boxCheck.rows.length === 0) return res.status(404).json({ error: '找不到指定的紙箱或該紙箱不屬於此倉庫。'});

            const result = await pool.query('SELECT * FROM BOX_Items WHERE box_id = $1 ORDER BY item_name ASC', [boxId]);
            res.json(result.rows);
        } catch (err) {
            console.error(`[API GET /items] User ${userId}, Box ${boxId} Error:`, err);
            res.status(500).json({ error: '獲取物品列表失敗。' });
        }
    });

    router.put('/warehouses/:warehouseId/items/:itemId', authenticateBoxUser, async (req, res) => {
        const { warehouseId, itemId } = req.params;
        const userId = req.boxUser.userId;
        const { item_name, item_image_url, ai_item_keywords, item_description, quantity, box_id } = req.body; // box_id for moving item

        if (!item_name || item_name.trim() === '') {
            return res.status(400).json({ error: '物品名稱為必填項。' });
        }
        const itemQuantity = quantity !== undefined ? parseInt(quantity) : 1;
        if (isNaN(itemQuantity) || itemQuantity < 0) {
            return res.status(400).json({ error: '物品數量必須是非負整數。'});
        }

        try {
            const itemOwnership = await checkItemOwnership(itemId, userId); // Verifies item belongs to user via warehouse
            if (!itemOwnership.found || !itemOwnership.owned) return res.status(itemOwnership.found ? 403 : 404).json({ error: itemOwnership.message });

            let targetBoxId = box_id ? parseInt(box_id) : null;
            let originalBoxId;

            // Get current box_id of the item
            const currentItemBoxResult = await pool.query('SELECT box_id FROM BOX_Items WHERE item_id = $1', [itemId]);
            if (currentItemBoxResult.rows.length === 0) return res.status(404).json({ error: '找不到要更新的物品。' }); // Should not happen if checkItemOwnership passed
            originalBoxId = currentItemBoxResult.rows[0].box_id;

            if (targetBoxId && targetBoxId !== originalBoxId) { // If moving to a new box
                const targetBoxOwnership = await checkBoxOwnership(targetBoxId, userId);
                if (!targetBoxOwnership.found || !targetBoxOwnership.owned) {
                    return res.status(targetBoxOwnership.found ? 403 : 404).json({ error: '目標紙箱無效或無權訪問。' });
                }
            } else {
                targetBoxId = originalBoxId; // Not moving or moving to the same box
            }

            const updateQuery = `
                UPDATE BOX_Items
                SET item_name = $1, item_image_url = $2, ai_item_keywords = $3, item_description = $4, quantity = $5, box_id = $6, updated_at = NOW()
                WHERE item_id = $7
                RETURNING *;`;
            const result = await pool.query(updateQuery, [
                item_name.trim(), item_image_url || null, Array.isArray(ai_item_keywords) ? ai_item_keywords : [],
                item_description || null, itemQuantity, targetBoxId, itemId
            ]);

            // Update updated_at for original and target boxes if item moved
            await pool.query('UPDATE BOX_Boxes SET updated_at = NOW() WHERE box_id = $1', [originalBoxId]);
            if (targetBoxId !== originalBoxId) {
                await pool.query('UPDATE BOX_Boxes SET updated_at = NOW() WHERE box_id = $1', [targetBoxId]);
            }

            res.json(result.rows[0]);
        } catch (err) {
            console.error(`[API PUT /items/:itemId] User ${userId} Error:`, err);
            res.status(500).json({ error: '更新物品失敗。' });
        }
    });

    router.delete('/warehouses/:warehouseId/items/:itemId', authenticateBoxUser, async (req, res) => {
        const { warehouseId, itemId } = req.params; // warehouseId for permission check context
        const userId = req.boxUser.userId;
        try {
            const itemOwnership = await checkItemOwnership(itemId, userId);
            if (!itemOwnership.found || !itemOwnership.owned) return res.status(itemOwnership.found ? 403 : 404).json({ error: itemOwnership.message });

            // Get box_id before deleting item to update box's updated_at
            const itemBoxResult = await pool.query('SELECT box_id FROM BOX_Items WHERE item_id = $1', [itemId]);
            const boxId = itemBoxResult.rows[0]?.box_id;

            const result = await pool.query('DELETE FROM BOX_Items WHERE item_id = $1', [itemId]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: '找不到要刪除的物品。' });
            }

            if (boxId) {
                await pool.query('UPDATE BOX_Boxes SET updated_at = NOW() WHERE box_id = $1', [boxId]);
            }
            res.status(204).send();
        } catch (err) {
            console.error(`[API DELETE /items/:itemId] User ${userId} Error:`, err);
            res.status(500).json({ error: '刪除物品失敗。' });
        }
    });

    // --- 搜尋 API ---
    router.get('/warehouses/:warehouseId/search-items', authenticateBoxUser, async (req, res) => {
        const { warehouseId } = req.params;
        const userId = req.boxUser.userId;
        const searchTerm = req.query.q?.trim() || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        if (!searchTerm) {
            return res.json({ results: [], currentPage: 1, totalPages: 0, totalItems: 0 });
        }
        const likePattern = `%${searchTerm}%`;
        const arraySearchTerm = searchTerm;

        try {
            const ownership = await checkWarehouseOwnership(warehouseId, userId);
            if (!ownership.found || !ownership.owned) return res.status(ownership.found ? 403 : 404).json({ error: ownership.message });

            // CTE for combined search and ranking
            const searchQuery = `
                WITH search_base AS (
                    -- Search Items
                    SELECT
                        i.item_id, i.item_name AS name, i.item_image_url AS image_url, i.ai_item_keywords AS keywords, i.item_description AS description,
                        b.box_id, b.box_number, b.box_name,
                        'item' AS type,
                        (i.item_name ILIKE $2) AS name_match,
                        ($3 = ANY(i.ai_item_keywords)) AS keyword_match,
                        (i.item_description ILIKE $2) AS description_match
                    FROM BOX_Items i
                    JOIN BOX_Boxes b ON i.box_id = b.box_id
                    WHERE b.warehouse_id = $1
                    AND (i.item_name ILIKE $2 OR i.item_description ILIKE $2 OR $3 = ANY(i.ai_item_keywords))

                    UNION ALL

                    -- Search Boxes
                    SELECT
                        NULL AS item_id, b.box_name AS name, b.cover_image_url AS image_url, b.ai_box_keywords AS keywords, b.manual_notes AS description,
                        b.box_id, b.box_number, b.box_name AS original_box_name,
                        'box' AS type,
                        (b.box_name ILIKE $2) AS name_match,
                        ($3 = ANY(b.ai_box_keywords)) AS keyword_match,
                        (b.manual_notes ILIKE $2) AS description_match
                    FROM BOX_Boxes b
                    WHERE b.warehouse_id = $1
                    AND (b.box_name ILIKE $2 OR b.manual_notes ILIKE $2 OR $3 = ANY(b.ai_box_keywords) OR b.box_number ILIKE $2)
                ),
                ranked_search AS (
                    SELECT *,
                        (CASE WHEN name_match THEN 3 ELSE 0 END) +
                        (CASE WHEN keyword_match THEN 2 ELSE 0 END) +
                        (CASE WHEN description_match THEN 1 ELSE 0 END) as relevance_score
                    FROM search_base
                ),
                total_count AS (
                    SELECT COUNT(*) as total FROM ranked_search
                )
                SELECT rs.*, tc.total
                FROM ranked_search rs, total_count tc
                ORDER BY rs.relevance_score DESC, rs.name ASC
                LIMIT $4 OFFSET $5;
            `;

            const result = await pool.query(searchQuery, [warehouseId, likePattern, arraySearchTerm, limit, offset]);

            const totalItems = result.rows[0]?.total || 0; // Get total from the first row if exists
            const totalPages = Math.ceil(totalItems / limit);

            res.json({
                results: result.rows.map(({ total, ...item }) => item), // Remove total from each item
                currentPage: page,
                totalPages: totalPages,
                totalItems: parseInt(totalItems)
            });

        } catch (err) {
            console.error(`[API Search] User ${userId}, Warehouse ${warehouseId}, Term "${searchTerm}" Error:`, err);
            res.status(500).json({ error: '搜尋失敗。' });
        }
    });




// GET /api/box/my-warehouses/search-all-items - 搜尋當前用戶所有倉庫的物品和紙箱
router.get('/my-warehouses/search-all-items', authenticateBoxUser, async (req, res) => {
    const userId = req.boxUser.userId;
    const searchTerm = req.query.q?.trim() || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // 可以調整預設值
    const offset = (page - 1) * limit;

    if (!searchTerm) {
        return res.json({ results: [], currentPage: 1, totalPages: 0, totalItems: 0 });
    }
    const likePattern = `%${searchTerm}%`;
    // 對於數組搜索，如果關鍵字是單個詞，可以直接用 = ANY()
    // 如果 searchTerm 可能包含多個詞，需要更複雜的處理，或依賴全文搜索的 plainto_tsquery
    const arraySearchTerm = searchTerm;

    try {
        // 1. 獲取該用戶的所有倉庫 ID
        const warehousesResult = await pool.query(
            'SELECT warehouse_id FROM BOX_Warehouses WHERE user_id = $1',
            [userId]
        );
        const warehouseIds = warehousesResult.rows.map(w => w.warehouse_id);

        if (warehouseIds.length === 0) {
            // 如果用戶沒有任何倉庫，直接返回空結果
            return res.json({ results: [], currentPage: 1, totalPages: 0, totalItems: 0 });
        }

        // 2. 構建搜尋查詢 (在用戶的所有倉庫中進行)
        //    使用 CTE 合併物品和紙箱的搜尋，並計算相關性，然後分頁
        const searchQuery = `
            WITH user_warehouses AS (
                SELECT warehouse_id FROM BOX_Warehouses WHERE user_id = $1
            ),
            search_base AS (
                -- Search Items in user's warehouses
                SELECT
                    i.item_id, i.item_name AS name, i.item_image_url AS image_url, i.ai_item_keywords AS keywords, i.item_description AS description,
                    b.box_id, b.box_number, b.box_name,
                    w.warehouse_id, w.warehouse_name, -- 添加倉庫信息
                    'item' AS type,
                    (i.item_name ILIKE $2) AS name_match,
                    ($3 = ANY(i.ai_item_keywords)) AS keyword_match,
                    (i.item_description ILIKE $2) AS description_match
                FROM BOX_Items i
                JOIN BOX_Boxes b ON i.box_id = b.box_id
                JOIN user_warehouses w ON b.warehouse_id = w.warehouse_id -- 只搜尋用戶的倉庫
                WHERE (i.item_name ILIKE $2 OR i.item_description ILIKE $2 OR $3 = ANY(i.ai_item_keywords))

                UNION ALL

                -- Search Boxes in user's warehouses
                SELECT
                    NULL AS item_id, b.box_name AS name, b.cover_image_url AS image_url, b.ai_box_keywords AS keywords, b.manual_notes AS description,
                    b.box_id, b.box_number, b.box_name AS original_box_name,
                    w.warehouse_id, w.warehouse_name, -- 添加倉庫信息
                    'box' AS type,
                    (b.box_name ILIKE $2) AS name_match,
                    ($3 = ANY(b.ai_box_keywords)) AS keyword_match,
                    (b.manual_notes ILIKE $2) AS description_match
                FROM BOX_Boxes b
                JOIN user_warehouses w ON b.warehouse_id = w.warehouse_id -- 只搜尋用戶的倉庫
                WHERE (b.box_name ILIKE $2 OR b.manual_notes ILIKE $2 OR $3 = ANY(b.ai_box_keywords) OR b.box_number ILIKE $2)
            ),
            ranked_search AS (
                SELECT *,
                    (CASE WHEN name_match THEN 3 ELSE 0 END) +
                    (CASE WHEN keyword_match THEN 2 ELSE 0 END) +
                    (CASE WHEN description_match THEN 1 ELSE 0 END) as relevance_score
                FROM search_base
            ),
            total_count AS (
                SELECT COUNT(*) as total FROM ranked_search
            )
            SELECT rs.*, tc.total
            FROM ranked_search rs, total_count tc
            ORDER BY rs.relevance_score DESC, rs.warehouse_name ASC, rs.box_number ASC, rs.name ASC -- 添加倉庫和紙箱排序
            LIMIT $4 OFFSET $5;
        `;

        // 參數：$1 = userId, $2 = likePattern, $3 = arraySearchTerm, $4 = limit, $5 = offset
        const result = await pool.query(searchQuery, [userId, likePattern, arraySearchTerm, limit, offset]);

        const totalItems = result.rows[0]?.total || 0;
        const totalPages = Math.ceil(totalItems / limit);

        res.json({
            results: result.rows.map(({ total, ...item }) => item), // 從每個結果項中移除 total 字段
            currentPage: page,
            totalPages: totalPages,
            totalItems: parseInt(totalItems)
        });

    } catch (err) {
        console.error(`[API Search All] User ${userId}, Term "${searchTerm}" Error:`, err);
        res.status(500).json({ error: '跨倉庫搜尋失敗。' });
    }
});



    // (測試用)
    router.get('/test-auth', authenticateBoxUser, (req, res) => {
        res.json({ message: `你好, ${req.boxUser.username} (ID: ${req.boxUser.userId})! 你的Token有效。` });
    });

    // GET /api/box/warehouses/:warehouseId/items/:itemId - 獲取特定物品詳情
    router.get('/warehouses/:warehouseId/items/:itemId', authenticateBoxUser, async (req, res) => {
        const { warehouseId, itemId } = req.params;
        const userId = req.boxUser.userId;

        const numWarehouseId = parseInt(warehouseId);
        const numItemId = parseInt(itemId);

        if (isNaN(numWarehouseId) || isNaN(numItemId)) {
            return res.status(400).json({ error: '倉庫ID和物品ID必須是有效的數字。' });
        }

        try {
            // 使用輔助函數檢查物品所有權 (會自動檢查倉庫權限)
            const itemOwnership = await checkItemOwnership(numItemId, userId);

            if (!itemOwnership.found) {
                return res.status(404).json({ error: '找不到指定的物品。' });
            }
            if (!itemOwnership.owned) {
                return res.status(403).json({ error: '無權訪問此物品。' });
            }

            // 獲取物品詳情
            const itemQuery = `
                SELECT item_id, box_id, item_name, item_image_url, ai_item_keywords, item_description, quantity, created_at, updated_at
                FROM BOX_Items
                WHERE item_id = $1;
            `;
            const result = await pool.query(itemQuery, [numItemId]);

            if (result.rows.length === 0) {
                 // 理論上不會發生，因為 checkItemOwnership 已經驗證存在性
                 console.error(`[API GET /items/:itemId] User ${userId}: Item ${numItemId} owned, but DB query returned no rows.`);
                 return res.status(500).json({ error: '獲取物品詳情失敗 (內部錯誤)。' });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(`[API GET /warehouses/:warehouseId/items/:itemId] User ${userId}, Warehouse ${warehouseId}, Item ${itemId} Error:`, err);
            res.status(500).json({ error: '獲取物品詳情失敗。' });
        }
    });




    return router;
};