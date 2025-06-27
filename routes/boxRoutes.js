// ... existing code ...
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


        // 檢查用戶名或Email是否已存在
        const userCheck = await pool.query(
            'SELECT 1 FROM BOX_Users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)', 
            [username.trim(), email.trim()]
        );
        if (userCheck.rows.length > 0) {
             // 如果之前上傳了圖片但用戶名或Email衝突，需要考慮是否刪除已上傳的臨時圖片
            if (req.file && profileImageUrlToSave !== '/images/default_avatar.png') {
                try { await fs.unlink(path.join(uploadDir, path.basename(profileImageUrlToSave))); } catch (e) { console.error("Error deleting temp profile image on user conflict:", e); }
            }
            // 這裡可以返回更精確的錯誤，但為了安全，通常返回一個模糊的訊息
            return res.status(409).json({ error: '此用戶名或Email已被註冊，請選擇其他名稱或Email。' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);


        // 插入新用戶到數據庫，使用 profileImageUrlToSave
        const newUserResult = await pool.query(
            `INSERT INTO BOX_Users (username, email, password_hash, user_profile_image_url)
             VALUES ($1, $2, $3, $4)
             RETURNING user_id, username, email, user_profile_image_url, created_at`,
            [username.trim(), email.trim(), hashedPassword, profileImageUrlToSave]
        );
        const newUser = newUserResult.rows[0];

        // (重要) 如果之前上傳了圖片並記錄到 uploaded_files，現在用 newUser.user_id 更新 owner_user_id
        const tokenPayload = { userId: newUser.user_id, username: newUser.username, email: newUser.email };
        const token = jwt.sign(tokenPayload, BOX_JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            success: true, message: '註冊成功！', token: token,
            user: { userId: newUser.user_id, username: newUser.username, email: newUser.email, profileImageUrl: newUser.user_profile_image_url }
        });

    } catch (err) {
        console.error('[API POST /box/users/register] Error:', err);
        res.status(500).json({ error: '伺服器錯誤，請稍後再試。' });
    }

// ... existing code ...
