// boxRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const crypto = require('crypto');

module.exports = function(dependencies) {
    const { pool, visionClient, translationClient, BOX_JWT_SECRET, uploadDir, authenticateBoxUser, isAdminAuthenticated, googleProjectId } = dependencies;
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
        const { username, email, password, confirmPassword } = req.body;
        // user_profile_image_url 不再從 req.body 直接獲取，而是通過上傳的文件處理

        // ... (輸入驗證如前) ...
        if (!username || !email || !password || !confirmPassword) {
            return res.status(400).json({ error: '用戶名、Email、密碼和確認密碼為必填項。' });
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

        let profileImageUrlToSave = '/images/a01girlmove.gif'; // 預設頭像

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


            // 檢查用戶名或Email是否已存在
            const userCheck = await pool.query(
                'SELECT 1 FROM BOX_Users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)',
                [username.trim(), email.trim()]
            );

            if (userCheck.rows.length > 0) {
                 // 如果之前上傳了圖片但用戶名或Email衝突，需要考慮是否刪除已上傳的臨時圖片
                if (req.file && profileImageUrlToSave !== '/images/a01girlmove.gif') {
                    try { await fs.unlink(path.join(uploadDir, path.basename(profileImageUrlToSave))); } catch (e) { console.error("Error deleting temp profile image on user conflict:", e); }
                }
                return res.status(409).json({ error: '此用戶名或Email已被註冊，請選擇其他名稱或Email。' });
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);


            // 插入新用戶到數據庫，使用 profileImageUrlToSave
            const newUserResult = await pool.query(
                `INSERT INTO BOX_Users (username, email, password_hash, user_profile_image_url, display_name)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING user_id, username, email, user_profile_image_url, display_name, created_at`,
                [username.trim(), email.trim(), hashedPassword, profileImageUrlToSave, username.trim()]
            );
            const newUser = newUserResult.rows[0];

            // 為新用戶分配預設角色 (role_id = 1)
            try {
                const defaultRoleId = 1;
                await pool.query(
                    `INSERT INTO user_role_assignments (user_id, role_id, is_active) VALUES ($1, $2, true)`,
                    [newUser.user_id, defaultRoleId]
                );
                console.log(`[Register] Assigned default role (ID: ${defaultRoleId}) to user ${newUser.user_id}`);
            } catch (roleError) {
                console.error(`[Register] Failed to assign default role to user ${newUser.user_id}:`, roleError);
                // 根據策略，這裡可以選擇是否要因此而讓註冊失敗
                // 目前選擇僅記錄錯誤，不中斷註冊流程
            }

            // (重要) 如果之前上傳了圖片並記錄到 uploaded_files，現在用 newUser.user_id 更新 owner_user_id
            if (req.file && typeof tempUploadedFileId !== 'undefined') {
                await pool.query('UPDATE uploaded_files SET owner_user_id = $1, file_type = $2 WHERE id = $3', [newUser.user_id, 'profile_image', tempUploadedFileId]);
                console.log(`[Register] Updated owner_user_id for uploaded_files ID: ${tempUploadedFileId} to user ${newUser.user_id}`);
            }


            // --- JWT Token Generation ---
            const tokenPayload = {
                user_id: newUser.user_id, // Use 'user_id' for consistency
                username: newUser.username,
                // Add any other non-sensitive data you might need client-side
            };
            const token = jwt.sign(tokenPayload, BOX_JWT_SECRET, { expiresIn: '7d' });

            res.status(201).json({
                success: true, message: '註冊成功！', token: token,
                user: { userId: newUser.user_id, username: newUser.username, email: newUser.email, profileImageUrl: newUser.user_profile_image_url, display_name: newUser.display_name, avatar_url: newUser.avatar_url }
            });

            console.log(`[Box Register] User ${newUser.username} registered successfully with ID ${newUser.user_id}.`);

        } catch (err) {
            console.error('[API POST /box/users/register] Error:', err);
             // 如果出錯，且之前上傳了圖片，嘗試刪除它
            if (req.file && profileImageUrlToSave !== '/images/a01girlmove.gif' && err.code !== '23505' /* 不是因為用戶名衝突 */) {
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







    router.post('/users/login', async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: '請提供用戶名和密碼。' });
        }
        try {
            const result = await pool.query('SELECT user_id, username, password_hash, user_profile_image_url, display_name FROM BOX_Users WHERE LOWER(username) = LOWER($1)', [username]);
            if (result.rows.length === 0) {
                return res.status(401).json({ error: '用戶名或密碼錯誤。' });
            }
            const user = result.rows[0];
            const passwordIsValid = await bcrypt.compare(password, user.password_hash);

            if (!passwordIsValid) {
                return res.status(401).json({ error: '用戶名或密碼錯誤。' });
            }

            const tokenPayload = {
                user_id: user.user_id, // Use 'user_id' for consistency
                username: user.username,
                // Add any other non-sensitive data you might need client-side
            };
            const token = jwt.sign(tokenPayload, BOX_JWT_SECRET, { expiresIn: '7d' });

            res.json({
                success: true, message: '登入成功', token: token,
                user: { userId: user.user_id, username: user.username, profileImageUrl: user.user_profile_image_url, displayName: user.display_name }
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
        const userId = req.boxUser.user_id; // 修改：使用 user_id 而不是 userId
        try {
            const result = await pool.query('SELECT user_id, username, email, user_profile_image_url, display_name, created_at FROM BOX_Users WHERE user_id = $1', [userId]);
            if (result.rows.length === 0) { return res.status(404).json({ error: '找不到用戶信息。' });}
            res.json(result.rows[0]);
        } catch (err) {
            console.error(`[API GET /users/me] User ${userId} Error:`, err);
            res.status(500).json({ error: '無法獲取用戶信息。' });
        }
    });

    router.put('/users/me/password', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.user_id; // 修改：使用 user_id 而不是 userId
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

    router.put('/users/me/email', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.user_id; // 修改：使用 user_id 而不是 userId
        const { email } = req.body;

        if (!email || email.trim() === '') {
            return res.status(400).json({ error: 'Email不能為空。' });
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: '請輸入有效的Email格式。' });
        }

        try {
            // 檢查 email 是否已被其他用戶使用
            const emailCheck = await pool.query(
                'SELECT user_id FROM BOX_Users WHERE LOWER(email) = LOWER($1) AND user_id != $2',
                [email.trim(), userId]
            );

            if (emailCheck.rows.length > 0) {
                return res.status(409).json({ error: '此Email已被其他用戶註冊。' });
            }

            // 更新用戶的 email
            await pool.query(
                'UPDATE BOX_Users SET email = $1 WHERE user_id = $2',
                [email.trim(), userId]
            );

            res.json({ success: true, message: 'Email更新成功。' });
        } catch (err) {
            console.error(`[API PUT /users/me/email] User ${userId} Error:`, err);
            res.status(500).json({ error: 'Email更新失敗。' });
        }
    });

    router.put('/users/me/display-name', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.user_id; // 修改：使用 user_id 而不是 userId
        const { display_name } = req.body;

        if (!display_name || display_name.trim() === '') {
            return res.status(400).json({ error: '顯示名稱不能為空。' });
        }
        
        try {
            await pool.query(
                'UPDATE BOX_Users SET display_name = $1 WHERE user_id = $2',
                [display_name.trim(), userId]
            );

            res.json({ success: true, message: '顯示名稱更新成功。' });
        } catch (err) {
            console.error(`[API PUT /users/me/display-name] User ${userId} Error:`, err);
            res.status(500).json({ error: '顯示名稱更新失敗。' });
        }
    });

    router.put('/users/me/profile-image', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.user_id; // 修改：使用 user_id 而不是 userId
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

    router.post('/users/forgot-password', async (req, res) => {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: '請提供電子郵件地址。' });
        }

        try {
            const userResult = await pool.query('SELECT user_id FROM BOX_Users WHERE LOWER(email) = LOWER($1)', [email.trim()]);

            if (userResult.rows.length > 0) {
                const userId = userResult.rows[0].user_id;

                // 1. Generate a secure, random token
                const resetToken = crypto.randomBytes(32).toString('hex');

                // 2. Set an expiration date (e.g., 3 days from now)
                const expires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

                // 3. Store the token and expiration in the new table
                await pool.query(
                    'INSERT INTO password_reset_requests (user_id, reset_token, token_expires_at, status) VALUES ($1, $2, $3, $4)',
                    [userId, resetToken, expires, 'pending']
                );
                
                // Note: The actual email sending is manual per user's plan.
                // The token is now in the DB for the admin to use.
            }
            
            // 4. ALWAYS return a generic success message to prevent user enumeration
            res.json({
                success: true,
                message: '您的請求已成功送出。我們會手動處理，並在24小時內將密碼重設連結寄至您的信箱，請耐心等候。'
            });

        } catch (err) {
            console.error('[API POST /users/forgot-password] Error:', err);
            // Don't reveal internal errors to the user in this flow
            res.status(500).json({ error: '處理請求時發生錯誤，請稍後再試。' });
        }
    });

    router.post('/users/reset-password', async (req, res) => {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: '缺少重設權杖或新密碼。' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: '新密碼長度至少需要6位。' });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Find the request by token, ensuring it's pending and not expired
            const requestQuery = `
                SELECT user_id, token_expires_at 
                FROM password_reset_requests 
                WHERE reset_token = $1 AND status = 'pending' FOR UPDATE`;
            const requestResult = await client.query(requestQuery, [token]);

            if (requestResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: '此重設連結無效或已被使用。' });
            }

            const request = requestResult.rows[0];
            const now = new Date();

            if (now > new Date(request.token_expires_at)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: '此重設連結已過期，請重新申請。' });
            }

            // 2. Hash the new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // 3. Update the user's password
            await client.query(
                'UPDATE BOX_Users SET password_hash = $1 WHERE user_id = $2',
                [hashedPassword, request.user_id]
            );

            // 4. Mark the reset request as 'used'
            await client.query(
                "UPDATE password_reset_requests SET status = 'used' WHERE reset_token = $1",
                [token]
            );

            await client.query('COMMIT');

            res.json({ success: true, message: '密碼已成功更新。' });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('[API POST /users/reset-password] Error:', err);
            res.status(500).json({ error: '更新密碼時發生錯誤。' });
        } finally {
            client.release();
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
                userId: req.boxUser.user_id,
                username: req.boxUser.username 
            }
        });
    });







    // ====================================================================
    // ==       統一圖片上傳與分析 API                             ==
    // ====================================================================
    router.post('/upload-analyze-then-process-image', authenticateBoxUser, boxImageUpload.single('image'), async (req, res) => {
        if (!visionClient) {
            console.error('[Box Upload API] Vision AI client is not available.');
            return res.status(503).json({ error: "圖片分析服務目前不可用。" });
        }
        if (req.fileValidationError) { return res.status(400).json({ error: req.fileValidationError }); }
        if (!req.file) { return res.status(400).json({ error: '沒有上傳有效的圖片檔案。' }); }

        const imageBuffer = req.file.buffer;
        const originalFilename = req.file.originalname;
        const userId = req.boxUser.user_id;
        const fileType = req.body.fileType || 'box_organizer_image';
        let diskPathForCleanup;

        try {
            const [visionAnalysisResult] = await visionClient.annotateImage({
                image: { content: imageBuffer },
                features: [
                    { type: 'LABEL_DETECTION', maxResults: 10 },
                    { type: 'TEXT_DETECTION' },
                    { type: 'OBJECT_LOCALIZATION', maxResults: 5 }
                ],
            });

 
            const visionResult = visionAnalysisResult;

            const labels = visionResult.labelAnnotations ? visionResult.labelAnnotations.map(label => label.description) : [];
            const objects = visionResult.localizedObjectAnnotations ? visionResult.localizedObjectAnnotations.map(obj => obj.name) : [];
            
            let detectedTextsFromImage = [];
            if (visionResult.textAnnotations && visionResult.textAnnotations.length > 0) {
                const fullText = visionResult.textAnnotations[0].description.replace(/\n/g, ' ').trim();
                const wordsFromText = fullText.split(' ')
                                           .map(word => word.trim())
                                           .filter(word => word.length > 1 && !/^\W+$/.test(word));
                detectedTextsFromImage = wordsFromText.slice(0, 10);
             } else {
             }
           
            let initialAiKeywords = [...new Set([
                ...labels,
                ...objects,
                ...detectedTextsFromImage
            ])].filter(keyword => keyword && keyword.trim() !== '');
           
            // *** 修正日誌中的變數名 ***
 
            const MAX_CHARACTERS_TO_TRANSLATE = 300;
            let currentCharacterCount = 0;
            let aiKeywordsForTranslation = []; // 這是送去翻譯的英文關鍵字列表 (經過字元限制)

            for (const keyword of initialAiKeywords) {
                if (currentCharacterCount + keyword.length <= MAX_CHARACTERS_TO_TRANSLATE) {
                    aiKeywordsForTranslation.push(keyword);
                    currentCharacterCount += keyword.length;
                } else {
                    console.log(`[Box Upload API] Character limit (${MAX_CHARACTERS_TO_TRANSLATE}) reached. Keyword "${keyword}" (length ${keyword.length}) and subsequent keywords not included for translation.`);
                    break;
                }
            }
 
            // -------- 方案二：構建扁平化的中英文混合列表 --------
            let finalKeywordsForResponse = []; // 最終返回給前端的列表

            if (dependencies.translationClient && aiKeywordsForTranslation.length > 0) {
                if (!googleProjectId) {
                    console.error("[Box Upload API] CRITICAL: googleProjectId is undefined. Skipping translation.");
                    finalKeywordsForResponse = [...new Set(aiKeywordsForTranslation)]; // 去重後的英文關鍵字
                } else {
                    try {
                        console.log(`[Box Upload API] Translating for mixed list: ${aiKeywordsForTranslation.join(', ')}`);
                        const request = {
                            contents: aiKeywordsForTranslation,
                            targetLanguageCode: 'zh-TW',
                            parent: `projects/${googleProjectId}/locations/global`
                        };

                        const [response] = await dependencies.translationClient.translateText(request);
                        const translatedItems = response.translations;

                        if (translatedItems && translatedItems.length === aiKeywordsForTranslation.length) {
                            console.log(`[Box Upload API] Translation successful for mixed list.`);
                            let mixedKeywordsTemp = [];
                            for (let i = 0; i < aiKeywordsForTranslation.length; i++) {
                                mixedKeywordsTemp.push(aiKeywordsForTranslation[i]); // 1. 添加原始英文
                                const translatedText = translatedItems[i].translatedText;
                                // 2. 如果譯文與原文不同（忽略大小寫），則添加譯文
                                if (translatedText.toLowerCase() !== aiKeywordsForTranslation[i].toLowerCase()) {
                                    mixedKeywordsTemp.push(translatedText);
                                }
                            }
                            finalKeywordsForResponse = [...new Set(mixedKeywordsTemp)]; // 對混合列表去重
                        } else {
                            console.warn("[Box Upload API] Translation result mismatch. Using original English (char-limited) keywords.");
                            finalKeywordsForResponse = [...new Set(aiKeywordsForTranslation)];
                        }
                    } catch (translateError) {
                        console.error("[Box Upload API] Error during translation call for mixed list:", translateError);
                        finalKeywordsForResponse = [...new Set(aiKeywordsForTranslation)];
                    }
                }
            } else if (aiKeywordsForTranslation.length === 0) {
                 console.log("[Box Upload API] No keywords for translation after char limit (for mixed list).");
                 finalKeywordsForResponse = [];
            } else if (!dependencies.translationClient) {
                 console.warn("[Box Upload API] translationClient dependency not available, skipping translation (for mixed list).");
                 finalKeywordsForResponse = [...new Set(aiKeywordsForTranslation)];
            }
            console.log(`[Box Upload API] Final keywords for response/storage (mixed): ${finalKeywordsForResponse.join(', ')}`);
            // -------- 結束方案二的處理邏輯 --------

            // Sharp 圖片處理 (保持不變)
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

            // *** 修正：返回 finalKeywordsForResponse ***
            res.json({ success: true, ai_keywords: finalKeywordsForResponse, image_url: urlPath, uploaded_file_id: uploadedFileId });
        
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
        const userId = req.boxUser.user_id;

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
        const userId = req.boxUser.user_id;
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
        const userId = req.boxUser.user_id;
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
        const userId = req.boxUser.user_id;
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
        const userId = req.boxUser.user_id;
        try {
            const ownership = await checkWarehouseOwnership(warehouseId, userId);
            if (!ownership.found || !ownership.owned) return res.status(ownership.found ? 403 : 404).json({ error: ownership.message });

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
        const userId = req.boxUser.user_id;
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
    const userId = req.boxUser.user_id;
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
    const userId = req.boxUser.user_id; // 從已認證的 Token 中獲取用戶 ID

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

        // 2. 獲取紙箱基本信息，並確認它屬於指定的倉庫，同時獲取倉庫名稱
        const boxQuery = `
            SELECT b.box_id, b.warehouse_id, b.box_number, b.box_name, b.cover_image_url, 
                   b.ai_box_keywords, b.manual_notes, b.created_at, b.updated_at,
                   w.warehouse_name
            FROM BOX_Boxes b
            JOIN BOX_Warehouses w ON b.warehouse_id = w.warehouse_id
            WHERE b.box_id = $1 AND b.warehouse_id = $2;
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
    const { warehouseId: originalWarehouseIdParam, boxId } = req.params; // 原始倉庫ID來自URL參數
    const userId = req.boxUser.user_id;
    const {
        box_number,
        box_name,
        cover_image_url,
        ai_box_keywords,
        manual_notes,
        warehouse_id: targetWarehouseIdBody // 目標倉庫ID來自請求body
    } = req.body;

    if (!box_number || box_number.trim() === '' || !box_name || box_name.trim() === '') {
        return res.status(400).json({ error: '紙箱編號和紙箱名稱為必填項。' });
    }
    if (!targetWarehouseIdBody) {
        return res.status(400).json({ error: '必須指定目標倉庫 (warehouse_id)。'});
    }
    
    const originalWarehouseId = parseInt(originalWarehouseIdParam);
    const targetWarehouseId = parseInt(targetWarehouseIdBody);
    const numericBoxId = parseInt(boxId);

    if (isNaN(originalWarehouseId) || isNaN(targetWarehouseId) || isNaN(numericBoxId)) {
        return res.status(400).json({ error: '無效的倉庫或紙箱 ID 格式。' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 檢查使用者對原始倉庫的操作權限
        const originalWarehouseOwnership = await checkWarehouseOwnership(originalWarehouseId, userId);
        if (!originalWarehouseOwnership.owned) {
            await client.query('ROLLBACK');
            return res.status(originalWarehouseOwnership.found ? 403 : 404).json({ error: originalWarehouseOwnership.message + " (原始倉庫)" });
        }

        // 2. 驗證紙箱確實存在，並且屬於聲稱的原始倉庫
        const boxCheckResult = await client.query(
            'SELECT warehouse_id FROM BOX_Boxes WHERE box_id = $1', 
            [numericBoxId]
        );
        if (boxCheckResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到要更新的紙箱。'});
        }
        const currentDbWarehouseId = boxCheckResult.rows[0].warehouse_id;
        if (currentDbWarehouseId !== originalWarehouseId) {
             await client.query('ROLLBACK');
             // 這通常意味著前端狀態和後端數據不一致，或者 API 被錯誤調用
             return res.status(409).json({ error: '紙箱的原始倉庫資訊與請求不符，請刷新頁面後重試。'});
        }

        // 3. 如果倉庫ID發生變更，檢查使用者對目標倉庫的操作權限
        if (targetWarehouseId !== originalWarehouseId) {
            const targetWarehouseOwnership = await checkWarehouseOwnership(targetWarehouseId, userId);
            if (!targetWarehouseOwnership.owned) {
                await client.query('ROLLBACK');
                // 使用者可能嘗試移動到一個他沒有權限的倉庫
                return res.status(targetWarehouseOwnership.found ? 403 : 404).json({ error: targetWarehouseOwnership.message + " (目標倉庫)" });
            }
        }
        
        // 4. 在目標倉庫中檢查紙箱編號的唯一性 (排除當前正在編輯的紙箱本身)
        const boxNumCheckQuery = `
            SELECT 1 FROM BOX_Boxes 
            WHERE warehouse_id = $1 AND LOWER(box_number) = LOWER($2) AND box_id != $3`;
        const boxNumCheckResult = await client.query(boxNumCheckQuery, [
            targetWarehouseId,      // 在目標倉庫中檢查
            box_number.trim(),
            numericBoxId            // 排除自己
        ]);

        if (boxNumCheckResult.rows.length > 0) {
            await client.query('ROLLBACK');
            // 為了提供更友好的錯誤訊息，可以查詢目標倉庫的名稱
            const targetWarehouseNameRes = await client.query('SELECT warehouse_name from BOX_Warehouses WHERE warehouse_id = $1', [targetWarehouseId]);
            const targetWarehouseName = targetWarehouseNameRes.rows.length > 0 ? targetWarehouseNameRes.rows[0].warehouse_name : `ID ${targetWarehouseId}`;
            return res.status(409).json({ error: `倉庫 "${targetWarehouseName}" 下已存在編號為 "${box_number.trim()}" 的紙箱。` });
        }

        // 5. 更新紙箱數據 (包括 warehouse_id)
        const updateQuery = `
            UPDATE BOX_Boxes
            SET box_number = $1, 
                box_name = $2, 
                cover_image_url = $3, 
                ai_box_keywords = $4, 
                manual_notes = $5, 
                warehouse_id = $6,  -- 更新為目標倉庫ID
                updated_at = NOW()
            WHERE box_id = $7 
            RETURNING *;`; // box_id 是主鍵，用它來定位記錄
        const result = await client.query(updateQuery, [
            box_number.trim(),
            box_name.trim(),
            cover_image_url || null,
            Array.isArray(ai_box_keywords) ? ai_box_keywords : [],
            manual_notes || null,
            targetWarehouseId, // 使用來自請求 body 的目標倉庫 ID
            numericBoxId
        ]);
        
        if (result.rowCount === 0) { 
            // 理論上這不應該發生，因為前面已經檢查過 box 是否存在
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '更新紙箱時出錯，紙箱未找到。' });
        }
        
        await client.query('COMMIT');
        res.json(result.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[API PUT /warehouses/:wId/boxes/:bId] User ${userId}, Box ${numericBoxId}, Error:`, err);
         if (err.code === '23503' && err.constraint === 'box_boxes_warehouse_id_fkey') { // PostgreSQL特定錯誤碼
             return res.status(400).json({ error: '指定的目標倉庫不存在。' });
        }
        res.status(500).json({ error: '更新紙箱失敗。', detail: err.message });
    } finally {
        client.release();
    }
});

    router.delete('/warehouses/:warehouseId/boxes/:boxId', authenticateBoxUser, async (req, res) => {
        const { warehouseId, boxId } = req.params;
        const userId = req.boxUser.user_id;
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
        const userId = req.boxUser.user_id;
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
        const userId = req.boxUser.user_id;
    
        const numWarehouseId = parseInt(warehouseId);
        const numBoxId = parseInt(boxId);
    
        if (isNaN(numWarehouseId) || isNaN(numBoxId)) {
            return res.status(400).json({ error: '倉庫ID和紙箱ID必須是有效的數字。' });
        }
    
        try {
            const queryText = `
                SELECT
                    i.item_id,
                    i.box_id,
                    i.item_name,
                    i.item_image_url,
                    i.ai_item_keywords,
                    i.item_description,
                    i.quantity,
                    i.created_at AS item_created_at,
                    i.updated_at AS item_updated_at,
                    b.box_name,
                    b.box_number,
                    w.warehouse_id,
                    w.warehouse_name
                FROM BOX_Items i
                JOIN BOX_Boxes b ON i.box_id = b.box_id
                JOIN BOX_Warehouses w ON b.warehouse_id = w.warehouse_id
                WHERE
                    i.box_id = $1
                    AND b.warehouse_id = $2
                    AND w.user_id = $3
                ORDER BY i.item_name ASC;
            `;
    
            const result = await pool.query(queryText, [numBoxId, numWarehouseId, userId]);
            // 這裡不需要額外檢查結果是否為空，如果沒有符合條件的物品，result.rows 會是空陣列，
            // 前端應該能處理這種情況（例如顯示 "此紙箱內沒有物品"）。
            res.json(result.rows);
    
        } catch (err) {
            console.error(`[API GET /warehouses/:warehouseId/boxes/:boxId/items] User ${userId}, Warehouse ${numWarehouseId}, Box ${numBoxId} Error:`, err);
            res.status(500).json({ error: '獲取物品列表失敗。' });
        }
    });


    router.put('/warehouses/:warehouseId/items/:itemId', authenticateBoxUser, async (req, res) => {
        // 日誌點 1: 請求入口
        console.log(`[API PUT /items/:itemId] Request received for warehouseId: ${req.params.warehouseId}, itemId: ${req.params.itemId}, UserID: ${req.boxUser.user_id}`);
        console.log('[API PUT /items/:itemId] Request body:', JSON.stringify(req.body, null, 2));

        const { warehouseId, itemId } = req.params;
        const userId = req.boxUser.user_id;
        const { item_name, item_image_url, ai_item_keywords, item_description, quantity, box_id } = req.body; // box_id for moving item

        if (!item_name || item_name.trim() === '') {
            console.log('[API PUT /items/:itemId] Validation Error: item_name is required.');
            return res.status(400).json({ error: '物品名稱為必填項。' });
        }
        const itemQuantity = quantity !== undefined ? parseInt(quantity) : 1;
        if (isNaN(itemQuantity) || itemQuantity < 0) {
            console.log('[API PUT /items/:itemId] Validation Error: quantity must be a non-negative integer.');
            return res.status(400).json({ error: '物品數量必須是非負整數。'});
        }

        try {
            const itemOwnership = await checkItemOwnership(itemId, userId); // Verifies item belongs to user via warehouse
            console.log('[API PUT /items/:itemId] checkItemOwnership result:', itemOwnership);
            if (!itemOwnership.found || !itemOwnership.owned) return res.status(itemOwnership.found ? 403 : 404).json({ error: itemOwnership.message });

            let targetBoxId = box_id ? parseInt(box_id) : null;
            let originalBoxId;

            // Get current box_id of the item
            const currentItemBoxResult = await pool.query('SELECT box_id FROM BOX_Items WHERE item_id = $1', [itemId]);
            if (currentItemBoxResult.rows.length === 0) {
                console.log(`[API PUT /items/:itemId] Error: Item with ID ${itemId} not found in BOX_Items.`);
                return res.status(404).json({ error: '找不到要更新的物品。' }); // Should not happen if checkItemOwnership passed
            }
            originalBoxId = currentItemBoxResult.rows[0].box_id;
            console.log(`[API PUT /items/:itemId] Original box_id: ${originalBoxId}, Target box_id from body: ${box_id} (parsed as ${targetBoxId})`);

            if (targetBoxId && targetBoxId !== originalBoxId) { // If moving to a new box
                const targetBoxOwnership = await checkBoxOwnership(targetBoxId, userId);
                console.log('[API PUT /items/:itemId] checkBoxOwnership result for targetBoxId:', targetBoxOwnership);
                if (!targetBoxOwnership.found || !targetBoxOwnership.owned) {
                    return res.status(targetBoxOwnership.found ? 403 : 404).json({ error: '目標紙箱無效或無權訪問。' });
                }
            } else {
                targetBoxId = originalBoxId; // Not moving or moving to the same box
                console.log(`[API PUT /items/:itemId] Item not moving or moving to the same box. Target box_id set to original: ${targetBoxId}`);
            }

            const valuesToUpdate = [
                item_name.trim(),
                item_image_url || null, // 確保傳遞 null 而不是 undefined
                Array.isArray(ai_item_keywords) ? ai_item_keywords : [],
                item_description || null,
                itemQuantity,
                targetBoxId,
                itemId
            ];
            console.log('[API PUT /items/:itemId] Values for DB update query:', JSON.stringify(valuesToUpdate, null, 2));

            const updateQuery = `
                UPDATE BOX_Items
                SET item_name = $1, item_image_url = $2, ai_item_keywords = $3, item_description = $4, quantity = $5, box_id = $6, updated_at = NOW()
                WHERE item_id = $7
                RETURNING *;`;
            const result = await pool.query(updateQuery, valuesToUpdate);
            console.log(`[API PUT /items/:itemId] DB update result rowCount: ${result.rowCount}`);
            if (result.rowCount > 0) {
                console.log('[API PUT /items/:itemId] Updated item data:', JSON.stringify(result.rows[0], null, 2));
            }

            // Update updated_at for original and target boxes if item moved
            console.log(`[API PUT /items/:itemId] Updating timestamp for originalBoxId: ${originalBoxId}`);
            await pool.query('UPDATE BOX_Boxes SET updated_at = NOW() WHERE box_id = $1', [originalBoxId]);
            if (targetBoxId !== originalBoxId) {
                console.log(`[API PUT /items/:itemId] Item moved. Updating timestamp for targetBoxId: ${targetBoxId}`);
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
        const userId = req.boxUser.user_id;
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
        const userId = req.boxUser.user_id;
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
                    w.warehouse_id, w.warehouse_name, -- <<< 新增這一行
                    'item' AS type,
                    (i.item_name ILIKE $2) AS name_match,
                    ($3 = ANY(i.ai_item_keywords)) AS keyword_match,
                    (i.item_description ILIKE $2) AS description_match
                FROM BOX_Items i
                JOIN BOX_Boxes b ON i.box_id = b.box_id
                JOIN BOX_Warehouses w ON b.warehouse_id = w.warehouse_id -- <<< 新增 JOIN
                WHERE b.warehouse_id = $1
                AND (i.item_name ILIKE $2 OR i.item_description ILIKE $2 OR $3 = ANY(i.ai_item_keywords))

                UNION ALL

                -- Search Boxes
                SELECT
                    NULL AS item_id, b.box_name AS name, b.cover_image_url AS image_url, b.ai_box_keywords AS keywords, b.manual_notes AS description,
                    b.box_id, b.box_number, b.box_name AS original_box_name,
                    w.warehouse_id, w.warehouse_name, -- <<< 新增這一行
                    'box' AS type,
                    (b.box_name ILIKE $2) AS name_match,
                    ($3 = ANY(b.ai_box_keywords)) AS keyword_match,
                    (b.manual_notes ILIKE $2) AS description_match
                FROM BOX_Boxes b
                JOIN BOX_Warehouses w ON b.warehouse_id = w.warehouse_id -- <<< 新增 JOIN
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
    const userId = req.boxUser.user_id;
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
            SELECT warehouse_id, warehouse_name FROM BOX_Warehouses WHERE user_id = $1 -- <<< 在這裡添加 warehouse_name
        ),
        search_base AS (
            -- Search Items in user's warehouses
            SELECT
                i.item_id, i.item_name AS name, i.item_image_url AS image_url, i.ai_item_keywords AS keywords, i.item_description AS description,
                b.box_id, b.box_number, b.box_name,
                w.warehouse_id, w.warehouse_name, -- 現在可以正確獲取
                'item' AS type,
                (i.item_name ILIKE $2) AS name_match,
                ($3 = ANY(i.ai_item_keywords)) AS keyword_match,
                (i.item_description ILIKE $2) AS description_match
            FROM BOX_Items i
            JOIN BOX_Boxes b ON i.box_id = b.box_id
            JOIN user_warehouses w ON b.warehouse_id = w.warehouse_id 
            WHERE (i.item_name ILIKE $2 OR i.item_description ILIKE $2 OR $3 = ANY(i.ai_item_keywords))

            UNION ALL

            -- Search Boxes in user's warehouses
            SELECT
                NULL AS item_id, b.box_name AS name, b.cover_image_url AS image_url, b.ai_box_keywords AS keywords, b.manual_notes AS description,
                b.box_id, b.box_number, b.box_name AS original_box_name,
                w.warehouse_id, w.warehouse_name, -- 現在可以正確獲取
                'box' AS type,
                (b.box_name ILIKE $2) AS name_match,
                ($3 = ANY(b.ai_box_keywords)) AS keyword_match,
                (b.manual_notes ILIKE $2) AS description_match
            FROM BOX_Boxes b
            JOIN user_warehouses w ON b.warehouse_id = w.warehouse_id 
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
        ORDER BY rs.relevance_score DESC, rs.warehouse_name ASC, rs.box_number ASC, rs.name ASC 
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
        res.json({ message: `你好, ${req.boxUser.username} (ID: ${req.boxUser.user_id})! 你的Token有效。` });
    });

    // GET /api/box/warehouses/:warehouseId/items/:itemId - 獲取特定物品詳情
    router.get('/warehouses/:warehouseId/items/:itemId', authenticateBoxUser, async (req, res) => {
        const { warehouseId, itemId } = req.params;
        const userId = req.boxUser.user_id;

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

    // =============================================
    // ==       管理員 API                        ==
    // =============================================
    
    // 檢查管理員權限
    router.get('/admin/auth/check', isAdminAuthenticated, (req, res) => {
        res.status(200).json({ 
            success: true, 
            message: 'Admin token is valid.'
        });
    });

    // 獲取所有使用者列表（管理員用）
    router.get('/admin/users', isAdminAuthenticated, async (req, res) => {
        try {
            const query = `
                SELECT 
                    user_id, 
                    username, 
                    display_name,
                    user_profile_image_url,
                    created_at
                FROM box_users
                ORDER BY username ASC`;
            
            const result = await pool.query(query);
            res.json(result.rows);
        } catch (err) {
            console.error('[API GET /box/admin/users] Error:', err);
            res.status(500).json({ error: '無法獲取使用者列表' });
        }
    });

    // 刪除使用者（管理員用）
    router.delete('/admin/users/:userId', isAdminAuthenticated, async (req, res) => {
        const { userId } = req.params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. 檢查使用者是否存在
            const userCheck = await client.query('SELECT username FROM BOX_Users WHERE user_id = $1', [userId]);
            if (userCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: '找不到指定的使用者' });
            }

            // 2. 刪除用戶的角色分配
            await client.query('DELETE FROM user_role_assignments WHERE user_id = $1', [userId]);
            
            // 3. 刪除用戶的徽章分配
            await client.query('DELETE FROM user_badges WHERE user_id = $1', [userId]);
            
            // 4. 刪除用戶的頭銜分配
            await client.query('DELETE FROM user_titles WHERE user_id = $1', [userId]);
            
            // 5. 刪除用戶的成就記錄
            await client.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);

            // 6. 刪除使用者的所有倉庫（這會級聯刪除所有紙箱和物品）
            await client.query('DELETE FROM BOX_Warehouses WHERE user_id = $1', [userId]);

            // 7. 刪除使用者本身
            await client.query('DELETE FROM BOX_Users WHERE user_id = $1', [userId]);

            await client.query('COMMIT');
            res.status(200).json({ success: true, message: '使用者已成功刪除' });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(`[API DELETE /box/admin/users/${userId}] Error:`, err);
            res.status(500).json({ error: '刪除使用者失敗' });
        } finally {
            client.release();
        }
    });

    // --- 角色、徽章和成就相關 API ---
    
    // 獲取用戶角色
    router.get('/users/me/roles', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.user_id;
        try {
            const query = `
                SELECT r.role_id, r.role_name, r.role_description, ura.assigned_at
                FROM user_roles r
                JOIN user_role_assignments ura ON r.role_id = ura.role_id
                WHERE ura.user_id = $1 AND ura.is_active = true
                ORDER BY r.role_id ASC
            `;
            const result = await pool.query(query, [userId]);
            res.json(result.rows);
        } catch (err) {
            console.error(`[API GET /users/me/roles] User ${userId} Error:`, err);
            res.status(500).json({ error: '無法獲取用戶角色信息。' });
        }
    });
    
    // 獲取用戶徽章
    router.get('/users/me/badges', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.user_id;
        try {
            const query = `
                SELECT b.badge_id, b.badge_name, b.badge_description, b.badge_image_url,
                       b.badge_category, ub.assigned_at, ub.is_displayed
                FROM badges b
                JOIN user_badges ub ON b.badge_id = ub.badge_id
                WHERE ub.user_id = $1
                ORDER BY ub.assigned_at DESC
            `;
            const result = await pool.query(query, [userId]);
            res.json(result.rows);
        } catch (err) {
            console.error(`[API GET /users/me/badges] User ${userId} Error:`, err);
            res.status(500).json({ error: '無法獲取用戶徽章信息。' });
        }
    });
    
    // 獲取用戶成就
    router.get('/users/me/achievements', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.user_id;
        try {
            const query = `
                SELECT a.achievement_id, a.achievement_name, a.achievement_description,
                       a.achievement_category, a.achievement_icon_url,
                       ua.achieved_at, ua.progress, ua.is_completed
                FROM achievements a
                LEFT JOIN user_achievements ua ON a.achievement_id = ua.achievement_id AND ua.user_id = $1
                ORDER BY a.achievement_category, a.achievement_id
            `;
            const result = await pool.query(query, [userId]);
            res.json(result.rows);
        } catch (err) {
            console.error(`[API GET /users/me/achievements] User ${userId} Error:`, err);
            res.status(500).json({ error: '無法獲取用戶成就信息。' });
        }
    });
    
    // 獲取用戶頭銜
    router.get('/users/me/titles', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.user_id;
        try {
            const query = `
                SELECT t.title_id, t.title_name, t.title_description, t.title_image_url,
                       ut.assigned_at, ut.is_current
                FROM titles t
                JOIN user_titles ut ON t.title_id = ut.title_id
                WHERE ut.user_id = $1
                ORDER BY ut.is_current DESC, ut.assigned_at DESC
            `;
            const result = await pool.query(query, [userId]);
            res.json(result.rows);
        } catch (err) {
            console.error(`[API GET /users/me/titles] User ${userId} Error:`, err);
            res.status(500).json({ error: '無法獲取用戶頭銜信息。' });
        }
    });
    
    // 設置當前頭銜
    router.put('/users/me/current-title', authenticateBoxUser, async (req, res) => {
        const userId = req.boxUser.user_id;
        const { titleId } = req.body;
        
        if (!titleId) {
            return res.status(400).json({ error: '請提供頭銜ID。' });
        }
        
        try {
            // 開始事務
            await pool.query('BEGIN');
            
            // 檢查用戶是否擁有此頭銜
            const checkQuery = 'SELECT 1 FROM user_titles WHERE user_id = $1 AND title_id = $2';
            const checkResult = await pool.query(checkQuery, [userId, titleId]);
            
            if (checkResult.rows.length === 0) {
                await pool.query('ROLLBACK');
                return res.status(403).json({ error: '您沒有權限使用此頭銜。' });
            }
            
            // 清除當前頭銜
            await pool.query(
                'UPDATE user_titles SET is_current = false WHERE user_id = $1',
                [userId]
            );
            
            // 設置新的當前頭銜
            await pool.query(
                'UPDATE user_titles SET is_current = true WHERE user_id = $1 AND title_id = $2',
                [userId, titleId]
            );
            
            // 提交事務
            await pool.query('COMMIT');
            
            res.json({ success: true, message: '頭銜已更新。' });
        } catch (err) {
            await pool.query('ROLLBACK');
            console.error(`[API PUT /users/me/current-title] User ${userId} Error:`, err);
            res.status(500).json({ error: '無法更新頭銜。' });
        }
    });
    
    // 為管理員提供的API
    
    // 獲取所有角色
    router.get('/admin/roles', isAdminAuthenticated, async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM user_roles ORDER BY role_id');
            res.json(result.rows);
        } catch (err) {
            console.error('[API GET /admin/roles] Error:', err);
            res.status(500).json({ error: '無法獲取角色列表。' });
        }
    });
    
    // 獲取所有徽章
    router.get('/admin/badges', isAdminAuthenticated, async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM badges ORDER BY badge_id');
            res.json(result.rows);
        } catch (err) {
            console.error('[API GET /admin/badges] Error:', err);
            res.status(500).json({ error: '無法獲取徽章列表。' });
        }
    });
    
    // 獲取所有頭銜
    router.get('/admin/titles', isAdminAuthenticated, async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM titles ORDER BY title_id');
            res.json(result.rows);
        } catch (err) {
            console.error('[API GET /admin/titles] Error:', err);
            res.status(500).json({ error: '無法獲取頭銜列表。' });
        }
    });

    // --- 新增：角色 CRUD ---
    // 創建新角色
    router.post('/admin/roles', isAdminAuthenticated, async (req, res) => {
        const { role_name, role_description } = req.body;
        if (!role_name) {
            return res.status(400).json({ error: '角色名稱為必填項。' });
        }
        try {
            const newRole = await pool.query(
                'INSERT INTO user_roles (role_name, role_description) VALUES ($1, $2) RETURNING *',
                [role_name, role_description || null]
            );
            res.status(201).json(newRole.rows[0]);
        } catch (err) {
            if (err.code === '23505') { // unique_violation
                return res.status(409).json({ error: '該角色名稱已存在。' });
            }
            console.error('[API POST /admin/roles] Error:', err);
            res.status(500).json({ error: '創建角色失敗。' });
        }
    });

    // 更新角色
    router.put('/admin/roles/:roleId', isAdminAuthenticated, async (req, res) => {
        const { roleId } = req.params;
        const { role_name, role_description } = req.body;
        if (!role_name) {
            return res.status(400).json({ error: '角色名稱為必填項。' });
        }
        try {
            const updatedRole = await pool.query(
                'UPDATE user_roles SET role_name = $1, role_description = $2, updated_at = NOW() WHERE role_id = $3 RETURNING *',
                [role_name, role_description || null, roleId]
            );
            if (updatedRole.rows.length === 0) {
                return res.status(404).json({ error: '找不到要更新的角色。' });
            }
            res.json(updatedRole.rows[0]);
        } catch (err) {
            if (err.code === '23505') {
                return res.status(409).json({ error: '該角色名稱已存在。' });
            }
            console.error(`[API PUT /admin/roles/${roleId}] Error:`, err);
            res.status(500).json({ error: '更新角色失敗。' });
        }
    });

    // 刪除角色
    router.delete('/admin/roles/:roleId', isAdminAuthenticated, async (req, res) => {
        const { roleId } = req.params;
        try {
            // 檢查此角色是否仍被任何用戶使用
            const assignmentCheck = await pool.query(
                'SELECT 1 FROM user_role_assignments WHERE role_id = $1 AND is_active = true LIMIT 1',
                [roleId]
            );

            if (assignmentCheck.rows.length > 0) {
                return res.status(409).json({ error: '無法刪除，仍有用戶被指派此角色。請先移除所有用戶的此角色。' });
            }

            const result = await pool.query('DELETE FROM user_roles WHERE role_id = $1', [roleId]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: '找不到要刪除的角色。' });
            }
            res.status(204).send();
        } catch (err) {
            console.error(`[API DELETE /admin/roles/${roleId}] Error:`, err);
            // 處理外鍵約束錯誤
            if (err.code === '23503') {
                return res.status(409).json({ error: '無法刪除，此角色仍被系統其他部分使用。' });
            }
            res.status(500).json({ error: '刪除角色失敗。' });
        }
    });

    // --- 新增：徽章 CRUD ---
    // 更新徽章
    router.put('/admin/badges/:badgeId', isAdminAuthenticated, boxImageUpload.single('badgeImage'), async (req, res) => {
        const { badgeId } = req.params;
        const { badgeName, badgeDescription } = req.body;
        
        if (!badgeName) {
            return res.status(400).json({ error: '徽章名稱為必填項。' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const oldBadgeResult = await client.query('SELECT badge_image_url FROM badges WHERE badge_id = $1', [badgeId]);
            if (oldBadgeResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: '找不到要更新的徽章。'});
            }
            const oldImageUrl = oldBadgeResult.rows[0].badge_image_url;
            
            let newUrlPath = oldImageUrl;

            // 如果有新圖片上傳
            if (req.file) {
                const imageBuffer = req.file.buffer;
                const processedImageBuffer = await sharp(imageBuffer).rotate()
                    .resize({ width: 200, height: 200, fit: 'cover', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                
                const filename = `badge-${Date.now()}-${uuidv4().substring(0, 8)}.jpg`;
                const diskPath = path.join(uploadDir, filename);
                newUrlPath = `/uploads/${filename}`;
                
                await fs.writeFile(diskPath, processedImageBuffer);

                // 如果舊圖片存在，刪除它
                if (oldImageUrl) {
                    const oldFilename = path.basename(oldImageUrl);
                    try {
                        await fs.unlink(path.join(uploadDir, oldFilename));
                    } catch (e) {
                        console.error(`刪除舊徽章圖片失敗: ${oldImageUrl}`, e);
                    }
                }
            }

            const query = `
                UPDATE badges SET badge_name = $1, badge_description = $2, badge_image_url = $3, updated_at = NOW()
                WHERE badge_id = $4 RETURNING *
            `;
            const result = await client.query(query, [badgeName, badgeDescription || null, newUrlPath, badgeId]);
            
            await client.query('COMMIT');
            res.json(result.rows[0]);

        } catch (err) {
            await client.query('ROLLBACK');
            console.error(`[API PUT /admin/badges/${badgeId}] Error:`, err);
            res.status(500).json({ error: '更新徽章失敗。' });
        } finally {
            client.release();
        }
    });

    // 刪除徽章
    router.delete('/admin/badges/:badgeId', isAdminAuthenticated, async (req, res) => {
        const { badgeId } = req.params;
        try {
            // 檢查徽章是否仍被使用
            const assignmentCheck = await pool.query('SELECT 1 FROM user_badges WHERE badge_id = $1 LIMIT 1', [badgeId]);
            if (assignmentCheck.rows.length > 0) {
                return res.status(409).json({ error: '無法刪除，仍有用戶擁有此徽章。' });
            }

            // 刪除前先獲取圖片 URL
            const badgeResult = await pool.query('SELECT badge_image_url FROM badges WHERE badge_id = $1', [badgeId]);
            
            const result = await pool.query('DELETE FROM badges WHERE badge_id = $1', [badgeId]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: '找不到要刪除的徽章。' });
            }

            // 如果有圖片，則從文件系統中刪除
            if (badgeResult.rows.length > 0 && badgeResult.rows[0].badge_image_url) {
                const imageUrl = badgeResult.rows[0].badge_image_url;
                const filename = path.basename(imageUrl);
                try {
                    await fs.unlink(path.join(uploadDir, filename));
                } catch (e) {
                    console.error(`刪除徽章圖片文件失敗: ${imageUrl}`, e);
                }
            }
            
            res.status(204).send();
        } catch (err) {
            console.error(`[API DELETE /admin/badges/${badgeId}] Error:`, err);
            res.status(500).json({ error: '刪除徽章失敗。' });
        }
    });

    // --- 新增：頭銜 CRUD ---
    // 更新頭銜
    router.put('/admin/titles/:titleId', isAdminAuthenticated, boxImageUpload.single('titleImage'), async (req, res) => {
        const { titleId } = req.params;
        const { titleName, titleDescription } = req.body;
        
        if (!titleName) {
            return res.status(400).json({ error: '頭銜名稱為必填項。' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const oldTitleResult = await client.query('SELECT title_image_url FROM titles WHERE title_id = $1', [titleId]);
            if (oldTitleResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: '找不到要更新的頭銜。'});
            }
            const oldImageUrl = oldTitleResult.rows[0].title_image_url;
            
            let newUrlPath = oldImageUrl;

            if (req.file) {
                const imageBuffer = req.file.buffer;
                const processedImageBuffer = await sharp(imageBuffer).rotate()
                    .resize({ width: 200, height: 200, fit: 'cover', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                
                const filename = `title-${Date.now()}-${uuidv4().substring(0, 8)}.jpg`;
                const diskPath = path.join(uploadDir, filename);
                newUrlPath = `/uploads/${filename}`;
                
                await fs.writeFile(diskPath, processedImageBuffer);

                if (oldImageUrl) {
                    const oldFilename = path.basename(oldImageUrl);
                    try {
                        await fs.unlink(path.join(uploadDir, oldFilename));
                    } catch (e) {
                        console.error(`刪除舊頭銜圖片失敗: ${oldImageUrl}`, e);
                    }
                }
            }

            const query = `
                UPDATE titles SET title_name = $1, title_description = $2, title_image_url = $3, updated_at = NOW()
                WHERE title_id = $4 RETURNING *
            `;
            const result = await client.query(query, [titleName, titleDescription || null, newUrlPath, titleId]);
            
            await client.query('COMMIT');
            res.json(result.rows[0]);

        } catch (err) {
            await client.query('ROLLBACK');
            console.error(`[API PUT /admin/titles/${titleId}] Error:`, err);
            res.status(500).json({ error: '更新頭銜失敗。' });
        } finally {
            client.release();
        }
    });

    // 刪除頭銜
    router.delete('/admin/titles/:titleId', isAdminAuthenticated, async (req, res) => {
        const { titleId } = req.params;
        try {
            const assignmentCheck = await pool.query('SELECT 1 FROM user_titles WHERE title_id = $1 LIMIT 1', [titleId]);
            if (assignmentCheck.rows.length > 0) {
                return res.status(409).json({ error: '無法刪除，仍有用戶擁有此頭銜。' });
            }

            const titleResult = await pool.query('SELECT title_image_url FROM titles WHERE title_id = $1', [titleId]);
            
            const result = await pool.query('DELETE FROM titles WHERE title_id = $1', [titleId]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: '找不到要刪除的頭銜。' });
            }

            if (titleResult.rows.length > 0 && titleResult.rows[0].title_image_url) {
                const imageUrl = titleResult.rows[0].title_image_url;
                const filename = path.basename(imageUrl);
                try {
                    await fs.unlink(path.join(uploadDir, filename));
                } catch (e) {
                    console.error(`刪除頭銜圖片文件失敗: ${imageUrl}`, e);
                }
            }
            
            res.status(204).send();
        } catch (err) {
            console.error(`[API DELETE /admin/titles/${titleId}] Error:`, err);
            res.status(500).json({ error: '刪除頭銜失敗。' });
        }
    });

    // 創建新徽章
    router.post('/admin/badges', isAdminAuthenticated, async (req, res) => {
        const { badgeName, badgeDescription, badgeImageUrl, badgeCategory } = req.body;
        
        if (!badgeName) {
            return res.status(400).json({ error: '徽章名稱為必填項。' });
        }
        
        try {
            const query = `
                INSERT INTO badges (badge_name, badge_description, badge_image_url, badge_category)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
            const result = await pool.query(query, [
                badgeName, 
                badgeDescription || null, 
                badgeImageUrl || null,
                badgeCategory || null
            ]);
            
            res.status(201).json({
                success: true,
                message: '徽章創建成功。',
                badge: result.rows[0]
            });
        } catch (err) {
            console.error('[API POST /admin/badges] Error:', err);
            res.status(500).json({ error: '創建徽章失敗。' });
        }
    });

    // 上傳徽章圖片
    router.post('/admin/badges/upload', isAdminAuthenticated, boxImageUpload.single('badgeImage'), async (req, res) => {
        const { badgeName, badgeDescription, badgeCategory } = req.body;
        
        if (!badgeName) {
            return res.status(400).json({ error: '徽章名稱為必填項。' });
        }

        let diskPath;
        let urlPath = null; // Default to null if no image is uploaded

        try {
            // 如果有上傳圖片，處理圖片
            if (req.file) {
                const imageBuffer = req.file.buffer;
                const originalFilename = req.file.originalname;
                
                // 處理圖片
                const processedImageBuffer = await sharp(imageBuffer).rotate()
                    .resize({ width: 200, height: 200, fit: 'cover', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                
                // 生成檔案名稱
                const filename = `badge-${Date.now()}-${uuidv4().substring(0, 8)}.jpg`;
                diskPath = path.join(uploadDir, filename);
                urlPath = `/uploads/${filename}`;
                
                // 保存圖片到磁碟
                await fs.writeFile(diskPath, processedImageBuffer);
                
                // 記錄檔案到 uploaded_files 表
                const uploadedFileResult = await pool.query(
                    `INSERT INTO uploaded_files (file_path, original_filename, mimetype, size_bytes, file_type, owner_user_id)
                     VALUES ($1, $2, 'image/jpeg', $3, $4, $5) RETURNING id`,
                    [urlPath, originalFilename, processedImageBuffer.length, 'badge_image', req.boxUser?.user_id || null]
                );
            }
            
            // 創建徽章
            const query = `
                INSERT INTO badges (badge_name, badge_description, badge_image_url, badge_category)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
            const result = await pool.query(query, [
                badgeName, 
                badgeDescription || null, 
                urlPath, // 如果沒有上傳圖片，這裡會是 null
                badgeCategory || null
            ]);
            
            res.status(201).json({
                success: true,
                message: '徽章創建成功。',
                badge: result.rows[0],
                image_url: urlPath
            });
        } catch (err) {
            console.error('[API POST /admin/badges/upload] Error:', err);
            
            // 如果上傳過程中出錯，嘗試刪除已上傳的圖片
            if (diskPath) {
                try {
                    await fs.unlink(diskPath).catch(e => console.error('Error deleting badge image:', e));
                } catch (cleanupErr) {
                    console.error('Error during cleanup:', cleanupErr);
                }
            }
            
            res.status(500).json({ error: '創建徽章失敗。' });
        }
    });

    // 授予徽章給用戶
    router.post('/admin/users/:userId/badges', authenticateBoxUser, isAdminAuthenticated, async (req, res) => {
        const targetUserId = req.params.userId;
        const { badgeId } = req.body;
        const assignedBy = req.boxUser.user_id;
        
        if (!badgeId) {
            return res.status(400).json({ error: '徽章ID為必填項。' });
        }
        
        try {
            // 檢查用戶是否存在
            const userCheck = await pool.query('SELECT 1 FROM box_users WHERE user_id = $1', [targetUserId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({ error: '找不到指定用戶。' });
            }
            
            // 檢查徽章是否存在
            const badgeCheck = await pool.query('SELECT 1 FROM badges WHERE badge_id = $1', [badgeId]);
            if (badgeCheck.rows.length === 0) {
                return res.status(404).json({ error: '找不到指定徽章。' });
            }
            
            // 檢查用戶是否已擁有該徽章
            const existingBadge = await pool.query(
                'SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_id = $2',
                [targetUserId, badgeId]
            );
            
            if (existingBadge.rows.length > 0) {
                return res.status(409).json({ error: '該用戶已擁有此徽章。' });
            }
            
            // 授予徽章
            const query = `
                INSERT INTO user_badges (user_id, badge_id, assigned_by)
                VALUES ($1, $2, $3)
                RETURNING *
            `;
            const result = await pool.query(query, [targetUserId, badgeId, assignedBy]);
            
            res.status(201).json({
                success: true,
                message: '徽章授予成功。',
                userBadge: result.rows[0]
            });
        } catch (err) {
            console.error(`[API POST /admin/users/${targetUserId}/badges] Error:`, err);
            res.status(500).json({ error: '授予徽章失敗。' });
        }
    });

    // 授予角色給用戶
    router.post('/admin/users/:userId/roles', authenticateBoxUser, isAdminAuthenticated, async (req, res) => {
        const targetUserId = req.params.userId;
        const { roleId } = req.body;
        const assignedBy = req.boxUser.user_id;
        
        if (!roleId) {
            return res.status(400).json({ error: '角色ID為必填項。' });
        }
        
        try {
            // 檢查用戶是否存在
            const userCheck = await pool.query('SELECT 1 FROM box_users WHERE user_id = $1', [targetUserId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({ error: '找不到指定用戶。' });
            }
            
            // 檢查角色是否存在
            const roleCheck = await pool.query('SELECT 1 FROM user_roles WHERE role_id = $1', [roleId]);
            if (roleCheck.rows.length === 0) {
                return res.status(404).json({ error: '找不到指定角色。' });
            }
            
            // 檢查用戶是否已有該角色
            const existingRole = await pool.query(
                'SELECT 1 FROM user_role_assignments WHERE user_id = $1 AND role_id = $2 AND is_active = true',
                [targetUserId, roleId]
            );
            
            if (existingRole.rows.length > 0) {
                return res.status(409).json({ error: '該用戶已擁有此角色。' });
            }
            
            // 取消之前的相同角色（如果有）
            await pool.query(
                'UPDATE user_role_assignments SET is_active = false WHERE user_id = $1 AND role_id = $2',
                [targetUserId, roleId]
            );
            
            // 授予新角色
            const query = `
                INSERT INTO user_role_assignments (user_id, role_id, assigned_by)
                VALUES ($1, $2, $3)
                RETURNING *
            `;
            const result = await pool.query(query, [targetUserId, roleId, assignedBy]);
            
            res.status(201).json({
                success: true,
                message: '角色授予成功。',
                userRole: result.rows[0]
            });
        } catch (err) {
            console.error(`[API POST /admin/users/${targetUserId}/roles] Error:`, err);
            res.status(500).json({ error: '授予角色失敗。' });
        }
    });
    
    // 授予頭銜給用戶
    router.post('/admin/users/:userId/titles', authenticateBoxUser, isAdminAuthenticated, async (req, res) => {
        const targetUserId = req.params.userId;
        const { titleId } = req.body;
        const assignedBy = req.boxUser.user_id;
        
        if (!titleId) {
            return res.status(400).json({ error: '頭銜ID為必填項。' });
        }
        
        try {
            // 檢查用戶是否存在
            const userCheck = await pool.query('SELECT 1 FROM box_users WHERE user_id = $1', [targetUserId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({ error: '找不到指定用戶。' });
            }
            
            // 檢查頭銜是否存在
            const titleCheck = await pool.query('SELECT 1 FROM titles WHERE title_id = $1', [titleId]);
            if (titleCheck.rows.length === 0) {
                return res.status(404).json({ error: '找不到指定頭銜。' });
            }
            
            // 檢查用戶是否已擁有該頭銜
            const existingTitle = await pool.query(
                'SELECT 1 FROM user_titles WHERE user_id = $1 AND title_id = $2',
                [targetUserId, titleId]
            );
            
            if (existingTitle.rows.length > 0) {
                return res.status(409).json({ error: '該用戶已擁有此頭銜。' });
            }
            
            // 授予頭銜
            const query = `
                INSERT INTO user_titles (user_id, title_id, assigned_by)
                VALUES ($1, $2, $3)
                RETURNING *
            `;
            const result = await pool.query(query, [targetUserId, titleId, assignedBy]);
            
            res.status(201).json({
                success: true,
                message: '頭銜授予成功。',
                userTitle: result.rows[0]
            });
        } catch (err) {
            console.error(`[API POST /admin/users/${targetUserId}/titles] Error:`, err);
            res.status(500).json({ error: '授予頭銜失敗。' });
        }
    });
    
    // 創建新頭銜
    router.post('/admin/titles', isAdminAuthenticated, async (req, res) => {
        const { titleName, titleDescription, titleImageUrl, achievementId, isManual } = req.body;
        
        if (!titleName) {
            return res.status(400).json({ error: '頭銜名稱為必填項。' });
        }
        
        try {
            const query = `
                INSERT INTO titles (title_name, title_description, title_image_url, achievement_id, is_manual)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
            const result = await pool.query(query, [
                titleName,
                titleDescription || null,
                titleImageUrl || null,
                achievementId || null,
                isManual !== undefined ? isManual : true
            ]);
            
            res.status(201).json({
                success: true,
                message: '頭銜創建成功。',
                title: result.rows[0]
            });
        } catch (err) {
            console.error('[API POST /admin/titles] Error:', err);
            res.status(500).json({ error: '創建頭銜失敗。' });
        }
    });
    
    // 創建新成就
    router.post('/admin/achievements', isAdminAuthenticated, async (req, res) => {
        const { achievementName, achievementDescription, achievementCategory, requirementDescription, requirementCode, achievementIconUrl } = req.body;
        
        if (!achievementName) {
            return res.status(400).json({ error: '成就名稱為必填項。' });
        }
        
        try {
            const query = `
                INSERT INTO achievements (achievement_name, achievement_description, achievement_category, requirement_description, requirement_code, achievement_icon_url)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;
            const result = await pool.query(query, [
                achievementName,
                achievementDescription || null,
                achievementCategory || null,
                requirementDescription || null,
                requirementCode || null,
                achievementIconUrl || null
            ]);
            
            res.status(201).json({
                success: true,
                message: '成就創建成功。',
                achievement: result.rows[0]
            });
        } catch (err) {
            console.error('[API POST /admin/achievements] Error:', err);
            res.status(500).json({ error: '創建成就失敗。' });
        }
    });

    // --- 新增：管理員獲取特定用戶的資訊 ---

    // 獲取特定用戶的角色
    router.get('/users/:userId/roles', authenticateBoxUser, async (req, res) => {
        try {
            // 確保用戶只能訪問自己的角色信息，除非是管理員
            const requestedUserId = req.params.userId;
            const currentUserId = req.boxUser.user_id;
            
            // 檢查是否是訪問自己的角色信息
            if (requestedUserId != currentUserId) {
                // 檢查當前用戶是否是管理員
                const adminCheck = await pool.query(
                    `SELECT 1 FROM user_roles r
                     JOIN user_role_assignments ura ON r.role_id = ura.role_id
                     WHERE ura.user_id = $1 AND ura.is_active = true AND r.role_name = 'admin'`,
                    [currentUserId]
                );
                
                if (adminCheck.rows.length === 0) {
                    return res.status(403).json({ error: '無權訪問其他用戶的角色信息。' });
                }
            }
            
            const result = await pool.query(
                `SELECT r.role_id, r.role_name FROM user_roles r
                 JOIN user_role_assignments ura ON r.role_id = ura.role_id
                 WHERE ura.user_id = $1 AND ura.is_active = true`,
                [requestedUserId]
            );
            res.json(result.rows);
        } catch (error) {
            console.error('[API GET /users/:userId/roles] Error:', error);
            res.status(500).json({ error: '無法獲取用戶角色信息。' });
        }
    });

    // 管理員專用 API - 獲取特定用戶的角色
    router.get('/admin/users/:userId/roles', isAdminAuthenticated, async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT r.role_id, r.role_name FROM user_roles r
                 JOIN user_role_assignments ura ON r.role_id = ura.role_id
                 WHERE ura.user_id = $1 AND ura.is_active = true`,
                [req.params.userId]
            );
            res.json(result.rows);
        } catch (error) {
            console.error('[API GET /admin/users/:userId/roles] Error:', error);
            res.status(500).json({ error: '無法獲取用戶角色信息。' });
        }
    });

    // 獲取特定用戶的徽章
    router.get('/users/:userId/badges', isAdminAuthenticated, async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT b.badge_id, b.badge_name FROM badges b
                 JOIN user_badges ub ON b.badge_id = ub.badge_id
                 WHERE ub.user_id = $1`,
                [req.params.userId]
            );
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: '無法獲取用戶徽章信息。' });
        }
    });

    // 管理員專用 API - 獲取特定用戶的徽章
    router.get('/admin/users/:userId/badges', isAdminAuthenticated, async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT b.badge_id, b.badge_name FROM badges b
                 JOIN user_badges ub ON b.badge_id = ub.badge_id
                 WHERE ub.user_id = $1`,
                [req.params.userId]
            );
            res.json(result.rows);
        } catch (error) {
            console.error('[API GET /admin/users/:userId/badges] Error:', error);
            res.status(500).json({ error: '無法獲取用戶徽章信息。' });
        }
    });

    // 獲取特定用戶的頭銜
    router.get('/users/:userId/titles', isAdminAuthenticated, async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT t.title_id, t.title_name FROM titles t
                 JOIN user_titles ut ON t.title_id = ut.title_id
                 WHERE ut.user_id = $1`,
                [req.params.userId]
            );
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: '無法獲取用戶頭銜信息。' });
        }
    });

    // 管理員專用 API - 獲取特定用戶的頭銜
    router.get('/admin/users/:userId/titles', isAdminAuthenticated, async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT t.title_id, t.title_name FROM titles t
                 JOIN user_titles ut ON t.title_id = ut.title_id
                 WHERE ut.user_id = $1`,
                [req.params.userId]
            );
            res.json(result.rows);
        } catch (error) {
            console.error('[API GET /admin/users/:userId/titles] Error:', error);
            res.status(500).json({ error: '無法獲取用戶頭銜信息。' });
        }
    });

    // 移除用戶角色
    router.delete('/admin/users/:userId/roles/:roleId', isAdminAuthenticated, async (req, res) => {
        const { userId, roleId } = req.params;
        try {
            await pool.query(
                'UPDATE user_role_assignments SET is_active = false WHERE user_id = $1 AND role_id = $2',
                [userId, roleId]
            );
            res.status(204).send();
        } catch (err) {
            console.error(`[API DELETE /admin/users/:userId/roles/:roleId] Error:`, err);
            res.status(500).json({ error: '移除角色失敗。' });
        }
    });

    // 移除用戶徽章
    router.delete('/admin/users/:userId/badges/:badgeId', isAdminAuthenticated, async (req, res) => {
        const { userId, badgeId } = req.params;
        try {
            await pool.query(
                'DELETE FROM user_badges WHERE user_id = $1 AND badge_id = $2',
                [userId, badgeId]
            );
            res.status(204).send();
        } catch (err) {
            console.error(`[API DELETE /admin/users/:userId/badges/:badgeId] Error:`, err);
            res.status(500).json({ error: '移除徽章失敗。' });
        }
    });

    // 移除用戶頭銜
    router.delete('/admin/users/:userId/titles/:titleId', isAdminAuthenticated, async (req, res) => {
        const { userId, titleId } = req.params;
        try {
            await pool.query(
                'DELETE FROM user_titles WHERE user_id = $1 AND title_id = $2',
                [userId, titleId]
            );
            res.status(204).send();
        } catch (err) {
            console.error(`[API DELETE /admin/users/:userId/titles/:titleId] Error:`, err);
            res.status(500).json({ error: '移除頭銜失敗。' });
        }
    });

    // 創建新頭銜
    router.post('/admin/titles', isAdminAuthenticated, async (req, res) => {
        const { titleName, titleDescription, titleImageUrl, achievementId, isManual } = req.body;
        
        if (!titleName) {
            return res.status(400).json({ error: '頭銜名稱為必填項。' });
        }
        
        try {
            const query = `
                INSERT INTO titles (title_name, title_description, title_image_url, achievement_id, is_manual)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
            const result = await pool.query(query, [
                titleName,
                titleDescription || null,
                titleImageUrl || null,
                achievementId || null,
                isManual !== undefined ? isManual : true
            ]);
            
            res.status(201).json({
                success: true,
                message: '頭銜創建成功。',
                title: result.rows[0]
            });
        } catch (err) {
            console.error('[API POST /admin/titles] Error:', err);
            res.status(500).json({ error: '創建頭銜失敗。' });
        }
    });
    
    // 上傳頭銜圖片
    router.post('/admin/titles/upload', isAdminAuthenticated, boxImageUpload.single('titleImage'), async (req, res) => {
        const { titleName, titleDescription, achievementId, isManual } = req.body;
        
        if (!titleName) {
            return res.status(400).json({ error: '頭銜名稱為必填項。' });
        }

        let diskPath;
        let urlPath = null; // Default to null if no image is uploaded

        try {
            // 如果有上傳圖片，處理圖片
            if (req.file) {
                const imageBuffer = req.file.buffer;
                const originalFilename = req.file.originalname;
                
                // 處理圖片
                const processedImageBuffer = await sharp(imageBuffer).rotate()
                    .resize({ width: 200, height: 200, fit: 'cover', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                
                // 生成檔案名稱
                const filename = `title-${Date.now()}-${uuidv4().substring(0, 8)}.jpg`;
                diskPath = path.join(uploadDir, filename);
                urlPath = `/uploads/${filename}`;
                
                // 保存圖片到磁碟
                await fs.writeFile(diskPath, processedImageBuffer);
                
                // 記錄檔案到 uploaded_files 表
                const uploadedFileResult = await pool.query(
                    `INSERT INTO uploaded_files (file_path, original_filename, mimetype, size_bytes, file_type, owner_user_id)
                     VALUES ($1, $2, 'image/jpeg', $3, $4, $5) RETURNING id`,
                    [urlPath, originalFilename, processedImageBuffer.length, 'title_image', req.boxUser?.user_id || null]
                );
            }
            
            // 創建頭銜
            const query = `
                INSERT INTO titles (title_name, title_description, title_image_url, achievement_id, is_manual)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
            const result = await pool.query(query, [
                titleName,
                titleDescription || null,
                urlPath, // 如果沒有上傳圖片，這裡會是 null
                achievementId || null,
                isManual !== undefined ? isManual : true
            ]);
            
            res.status(201).json({
                success: true,
                message: '頭銜創建成功。',
                title: result.rows[0],
                image_url: urlPath
            });
        } catch (err) {
            console.error('[API POST /admin/titles/upload] Error:', err);
            
            // 如果上傳過程中出錯，嘗試刪除已上傳的圖片
            if (diskPath) {
                try {
                    await fs.unlink(diskPath).catch(e => console.error('Error deleting title image:', e));
                } catch (cleanupErr) {
                    console.error('Error during cleanup:', cleanupErr);
                }
            }
            
            res.status(500).json({ error: '創建頭銜失敗。' });
        }
    });

    // 獲取特定用戶的詳細資料（管理員用）
    router.get('/admin/users/:userId/details', isAdminAuthenticated, async (req, res) => {
        const { userId } = req.params;
        
        try {
            const query = `
                SELECT 
                    user_id, 
                    username, 
                    email,
                    display_name,
                    user_profile_image_url,
                    created_at
                FROM box_users 
                WHERE user_id = $1
            `;
            
            const result = await pool.query(query, [userId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: '找不到指定的用戶' });
            }
            
            res.json(result.rows[0]);
        } catch (err) {
            console.error(`[API GET /box/admin/users/${userId}/details] Error:`, err);
            res.status(500).json({ error: '無法獲取用戶詳細資料' });
        }
    });

    // 為沒有角色的用戶分配默認角色（管理員用）
    router.post('/admin/users/assign-default-roles', isAdminAuthenticated, async (req, res) => {
        try {
            // 開始事務
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // 1. 找出所有沒有角色的用戶
                const usersWithoutRolesQuery = `
                    SELECT u.user_id 
                    FROM box_users u
                    LEFT JOIN user_role_assignments ra ON u.user_id = ra.user_id AND ra.is_active = true
                    WHERE ra.user_id IS NULL
                `;
                const usersWithoutRoles = await client.query(usersWithoutRolesQuery);
                
                // 如果沒有找到任何用戶，直接返回
                if (usersWithoutRoles.rows.length === 0) {
                    await client.query('COMMIT');
                    return res.json({ 
                        success: true, 
                        message: '沒有找到需要分配角色的用戶。', 
                        updatedCount: 0 
                    });
                }
                
                // 2. 為每個用戶分配默認角色（role_id = 1）
                const defaultRoleId = 1;
                let successCount = 0;
                let errorCount = 0;
                
                for (const user of usersWithoutRoles.rows) {
                    try {
                        await client.query(
                            `INSERT INTO user_role_assignments (user_id, role_id, is_active) VALUES ($1, $2, true)`,
                            [user.user_id, defaultRoleId]
                        );
                        successCount++;
                    } catch (err) {
                        console.error(`Failed to assign default role to user ${user.user_id}:`, err);
                        errorCount++;
                    }
                }
                
                // 提交事務
                await client.query('COMMIT');
                
                res.json({ 
                    success: true, 
                    message: `成功為 ${successCount} 個用戶分配了默認角色。${errorCount > 0 ? `有 ${errorCount} 個用戶分配失敗。` : ''}`, 
                    updatedCount: successCount,
                    errorCount: errorCount
                });
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        } catch (err) {
            console.error('[API POST /admin/users/assign-default-roles] Error:', err);
            res.status(500).json({ error: '分配默認角色時發生錯誤。' });
        }
    });

    return router;
};