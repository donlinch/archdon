// server.js
require('dotenv').config(); // 從 .env 載入環境變數
const https = require('https'); // <--- 確保引入 https
const express = require('express');
const path = require('path');
const { Pool } = require('pg'); // PostgreSQL 客戶端

const app = express();
const PORT = process.env.PORT || 3000; // 使用 Render 提供的 PORT 或本地的 3000




// --- 資料庫連接池設定 ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // 從環境變數讀取資料庫 URL
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false // 生產環境需要 SSL (Render 提供)
});

// --- 基本認證中間件函數定義 ---
const basicAuthMiddleware = (req, res, next) => {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'password'; // *** 強烈建議在 .env 中設定一個強密碼 ***
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send('需要認證才能訪問管理區域。');
    }

    try {
        const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const user = auth[0];
        const pass = auth[1];

        if (user === adminUser && pass === adminPass) {
            next(); // 認證成功，繼續下一個中間件或路由處理
        } else {
            console.warn(`認證失敗 - 使用者名稱或密碼錯誤: User='${user}'`);
            res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
            return res.status(401).send('認證失敗。');
        }
    } catch (error) {
        console.error("認證標頭解析錯誤:", error);
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send('認證失敗 (格式錯誤)。');
    }
};

// --- JSON 請求體解析中間件 ---
// 必須放在所有需要讀取 req.body 的路由之前
app.use(express.json());

// --- 記錄 Page View 中間件 ---
app.use(async (req, res, next) => {
    const pathsToLog = ['/', '/index.html', '/music.html', '/news.html', '/scores.html']; // 添加 scores.html
    // 確保只記錄 'GET' 請求且路徑在列表中
    const shouldLog = pathsToLog.includes(req.path) && req.method === 'GET';

    if (shouldLog) {
        const pagePath = req.path;
        console.log(`[PV Mid] Logging view for: ${pagePath}`);
        try {
            const sql = `
                INSERT INTO page_views (page, view_date, view_count)
                VALUES ($1, CURRENT_DATE, 1)
                ON CONFLICT (page, view_date)
                DO UPDATE SET view_count = page_views.view_count + 1;
                -- 移除 RETURNING * 除非確實需要回傳值
            `;
            const params = [pagePath];
            await pool.query(sql, params);
            // console.log(`[PV Mid] Page view recorded/updated for: ${pagePath}`); // 僅在需要時啟用詳細日誌
        } catch (err) {
            // 處理可能的並發衝突 (ON CONFLICT 應該能處理大部分情況)
            if (err.code === '23505' || err.message.includes('ON CONFLICT DO UPDATE command cannot affect row a second time')) {
                console.warn(`[PV Mid] CONFLICT/Race condition during view count update for ${pagePath}. Handled.`);
            } else {
                console.error('[PV Mid] Error logging page view:', err.stack || err);
            }
        }
    }
    next(); // 確保總是調用 next()
});

// --- 靜態文件服務 ---
app.use(express.static(path.join(__dirname, 'public')));

// --- 公開 API Routes ---




// POST 冷卻機制中間件 (簡易範例 - 生產環境建議使用 Redis 或資料庫)
const postCooldowns = new Map(); // 使用 Map 儲存最後發文/回覆時間
const REPLY_COOLDOWN_MS = 15 * 1000; // 15 秒冷卻

function checkPostCooldown(req, res, next) {
    const identifier = req.ip; // 使用 IP 作為標識 (可被偽造，若有登入機制可用 session/user ID)
    const now = Date.now();
    const lastPostTime = postCooldowns.get(identifier);

    if (lastPostTime && (now - lastPostTime < REPLY_COOLDOWN_MS)) {
        const timeLeft = Math.ceil((REPLY_COOLDOWN_MS - (now - lastPostTime)) / 1000);
        return res.status(429).json({ error: `操作太頻繁，請稍候 ${timeLeft} 秒再試。` });
    }
    next(); // 不在冷卻期，繼續處理
}

function updatePostCooldown(req) {
    const identifier = req.ip;
    postCooldowns.set(identifier, Date.now());
    // 可選：定期清理 Map 中的舊記錄
}





// GET /api/guestbook - 取得留言列表 (分頁、排序)
app.get('/api/guestbook', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'latest'; // 'latest', 'popular', 'most_replies'

    if (page <= 0 || limit <= 0) {
        return res.status(400).json({ error: '頁碼和每頁數量必須是正整數。' });
    }
    const offset = (page - 1) * limit;

    let orderByClause;
    switch (sort) {
        case 'popular':
            orderByClause = 'ORDER BY view_count DESC, last_activity_at DESC';
            break;
        case 'most_replies':
            orderByClause = 'ORDER BY reply_count DESC, last_activity_at DESC';
            break;
        case 'latest':
        default:
            orderByClause = 'ORDER BY last_activity_at DESC';
            break;
    }

    const client = await pool.connect();
    try {
        // 查詢符合條件的總留言數
        const countResult = await client.query(
            'SELECT COUNT(*) FROM guestbook_messages WHERE is_visible = TRUE'
        );
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / limit);

        // 查詢當前頁面的留言 (僅基本資訊)
        const messagesResult = await client.query(
            `SELECT id, author_name, title, view_count, reply_count, last_activity_at
             FROM guestbook_messages
             WHERE is_visible = TRUE
             ${orderByClause}
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        res.status(200).json({
            messages: messagesResult.rows,
            currentPage: page,
            totalPages,
            totalItems,
            limit,
            currentSort: sort
        });
    } catch (err) {
        console.error('獲取留言列表時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取留言列表時發生內部伺服器錯誤' });
    } finally {
        client.release();
    }
});

// GET /api/guestbook/message/:id - 取得單一留言詳情及回覆
app.get('/api/guestbook/message/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的留言 ID 格式。' });
    }

    const client = await pool.connect();
    try {
        // 查詢主留言
        const messageResult = await client.query(
            'SELECT * FROM guestbook_messages WHERE id = $1 AND is_visible = TRUE',
            [id]
        );

        if (messageResult.rows.length === 0) {
            return res.status(404).json({ error: '找不到指定的留言或留言已被隱藏。' });
        }
        const message = messageResult.rows[0];

        // 查詢可見的回覆，並連接 admin_identities 取得身份名稱
        const repliesResult = await client.query(
            `SELECT r.*, ai.name AS admin_identity_name
             FROM guestbook_replies r
             LEFT JOIN admin_identities ai ON r.admin_identity_id = ai.id
             WHERE r.message_id = $1 AND r.is_visible = TRUE
             ORDER BY r.created_at ASC`, // 按建立時間排序以方便前端處理層級
            [id]
        );

        res.status(200).json({
            message: message,
            replies: repliesResult.rows // 前端需要處理 replies 的層級結構
        });
    } catch (err) {
        console.error(`獲取留言 ID ${id} 詳情時出錯:`, err.stack || err);
        res.status(500).json({ error: '獲取留言詳情時發生內部伺服器錯誤' });
    } finally {
        client.release();
    }
});

// POST /api/guestbook - 發表新留言 (應用冷卻機制)
app.post('/api/guestbook', checkPostCooldown, async (req, res) => {
    const { author_name, title, content } = req.body;

    const finalAuthorName = (author_name || '').trim() === '' ? '匿名' : author_name.trim().substring(0, 100); // 限制長度
    const finalTitle = (title || '').trim();
    const finalContent = (content || '').trim();

    if (!finalTitle) {
        return res.status(400).json({ error: '留言標題不能為空。' });
    }
     if (finalTitle.length > 255) {
         return res.status(400).json({ error: '留言標題過長 (最多 255 字元)。' });
     }
    if (!finalContent) {
        return res.status(400).json({ error: '留言內容不能為空。' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO guestbook_messages (author_name, title, content, view_count, reply_count, is_visible, created_at, updated_at, last_activity_at)
             VALUES ($1, $2, $3, 0, 0, TRUE, NOW(), NOW(), NOW()) -- 假設預設可見
             RETURNING id, author_name, title, created_at`, // 回傳基本資訊
            [finalAuthorName, finalTitle, finalContent]
        );

        updatePostCooldown(req); // 成功發表後更新冷卻時間戳
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error('新增留言時出錯:', err.stack || err);
        res.status(500).json({ error: '新增留言時發生內部伺服器錯誤' });
    }
});

// POST /api/guestbook/replies - 發表新回覆 (應用冷卻機制)
app.post('/api/guestbook/replies', checkPostCooldown, async (req, res) => {
    const { message_id, parent_reply_id, author_name, content } = req.body;

    const finalAuthorName = (author_name || '').trim() === '' ? '匿名' : author_name.trim().substring(0, 100);
    const finalContent = (content || '').trim();
    const messageIdInt = parseInt(message_id);
    const parentReplyIdInt = parent_reply_id ? parseInt(parent_reply_id) : null; // 可以是 null

    // --- 基本驗證 ---
    if (isNaN(messageIdInt)) {
        return res.status(400).json({ error: '無效的留言 ID。' });
    }
    if (parent_reply_id && isNaN(parentReplyIdInt)) {
         return res.status(400).json({ error: '無效的父回覆 ID。' });
    }
    if (!finalContent) {
        return res.status(400).json({ error: '回覆內容不能為空。' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // 開始交易

        // 檢查主留言是否存在且可見
        const msgCheck = await client.query('SELECT 1 FROM guestbook_messages WHERE id = $1 AND is_visible = TRUE', [messageIdInt]);
        if (msgCheck.rowCount === 0) {
             await client.query('ROLLBACK');
             return res.status(404).json({ error: '找不到對應的主留言或留言已被隱藏。' });
        }
        // 如果有父回覆 ID，檢查父回覆是否存在且可見
        if (parentReplyIdInt) {
            const replyCheck = await client.query('SELECT 1 FROM guestbook_replies WHERE id = $1 AND message_id = $2 AND is_visible = TRUE', [parentReplyIdInt, messageIdInt]);
             if (replyCheck.rowCount === 0) {
                 await client.query('ROLLBACK');
                 return res.status(404).json({ error: '找不到要回覆的回覆或該回覆已被隱藏。' });
             }
        }

        // 插入新回覆
        const result = await client.query(
            `INSERT INTO guestbook_replies (message_id, parent_reply_id, author_name, content, is_visible, is_admin_reply, admin_identity_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, TRUE, FALSE, NULL, NOW(), NOW()) -- 預設：可見、非管理員
             RETURNING *`, // 回傳完整的回覆資料
            [messageIdInt, parentReplyIdInt, finalAuthorName, finalContent]
        );

        // 資料庫觸發器 update_message_activity_and_count 會自動處理主留言的 last_activity_at 和 reply_count 更新
        await client.query('COMMIT'); // 提交交易

        updatePostCooldown(req); // 成功回覆後更新冷卻時間戳
        res.status(201).json(result.rows[0]); // 回傳新增的回覆物件

    } catch (err) {
        await client.query('ROLLBACK'); // 出錯時回滾
        console.error('新增回覆時出錯:', err.stack || err);
        res.status(500).json({ error: '新增回覆時發生內部伺服器錯誤' });
    } finally {
        client.release(); // 釋放連線
    }
});

// POST /api/guestbook/message/:id/view - 增加留言瀏覽次數
app.post('/api/guestbook/message/:id/view', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(204).send(); // 靜默忽略無效 ID
    }
    try {
        // 直接嘗試更新，不檢查是否存在
        await pool.query(
            'UPDATE guestbook_messages SET view_count = view_count + 1 WHERE id = $1',
            [id]
        );
        res.status(204).send(); // 成功，無內容返回
    } catch (err) {
        // 記錄錯誤，但仍對前端返回成功，避免影響使用者體驗
        console.error(`增加留言 ID ${id} 瀏覽次數時出錯:`, err.stack || err);
        res.status(204).send();
    }
});







// --- 樂譜 API ---
// GET /api/scores/artists - 取得擁有樂譜的獨立歌手列表
app.get('/api/scores/artists', async (req, res) => {
    try {
        const queryText = `
            SELECT DISTINCT m.artist
            FROM music m
            JOIN scores s ON m.id = s.music_id
            WHERE m.artist IS NOT NULL AND m.artist <> ''
            ORDER BY m.artist ASC
        `;
        const result = await pool.query(queryText);
        const artists = result.rows.map(row => row.artist);
        res.json(artists);
    } catch (err) {
        console.error('獲取帶有樂譜的歌手時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取歌手列表時發生內部伺服器錯誤' });
    }
});

// GET /api/scores/songs?artist=... - 取得包含樂譜的歌曲列表，可選依歌手過濾
app.get('/api/scores/songs', async (req, res) => {
    const { artist } = req.query;
    try {
        // *** 修改後的 SQL 查詢 ***
        let queryText = `
            SELECT
                m.id,
                m.title,
                m.artist,
                m.cover_art_url,
                m.release_date,
                m.youtube_video_id,
                s_agg.scores
            FROM (
                -- 先選出符合條件且有樂譜的獨立歌曲 ID
                SELECT DISTINCT m_inner.id
                FROM music m_inner
                INNER JOIN scores s_inner ON m_inner.id = s_inner.music_id
        `;
        const queryParams = [];
        let paramIndex = 1; // 用於參數化查詢

        if (artist && artist !== 'All') {
            queryText += ` WHERE m_inner.artist = $${paramIndex++}`;
            queryParams.push(decodeURIComponent(artist));
        }

        // 將子查詢的 DISTINCT 結果與 music 和聚合後的 scores JOIN
        queryText += `
            ) AS distinct_music
            JOIN music m ON m.id = distinct_music.id
            LEFT JOIN LATERAL ( -- 使用 LATERAL JOIN 和子查詢來聚合 scores
                SELECT json_agg(s.* ORDER BY s.display_order ASC, s.type ASC) AS scores
                FROM scores s
                WHERE s.music_id = m.id
            ) s_agg ON true
            ORDER BY m.artist ASC, m.release_date DESC NULLS LAST, m.title ASC;
        `;
        // *** SQL 查詢修改結束 ***

        console.log("Executing query:", queryText.replace(/\s+/g, ' '), "with params:", queryParams); // 打印查詢語句和參數

        const result = await pool.query(queryText, queryParams);
        res.json(result.rows); // 返回包含 scores 陣列的歌曲列表

    } catch (err) {
        console.error('獲取帶有樂譜的歌曲列表時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取帶有樂譜的歌曲列表時發生內部伺服器錯誤' });
    }
});

// GET /api/scores/proxy?url=ENCODED_PDF_URL - PDF 代理
app.get('/api/scores/proxy', (req, res) => {
    const pdfUrl = req.query.url;

    if (!pdfUrl || typeof pdfUrl !== 'string') {
        console.warn('代理請求被拒：缺少或無效的 URL 參數。');
        return res.status(400).send('缺少或無效的 PDF URL。');
    }

    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(pdfUrl);
        const allowedDomains = ['raw.githubusercontent.com'];
        const urlObject = new URL(decodedUrl);

        if (!allowedDomains.includes(urlObject.hostname)) {
           console.warn(`代理請求被阻止，不允許的網域：${urlObject.hostname} (URL: ${decodedUrl})`);
           return res.status(403).send('不允許從此網域進行代理。');
        }

    } catch (e) {
        console.error(`代理請求被拒：無效的 URL 編碼或格式：${pdfUrl}`, e);
        return res.status(400).send('無效的 URL 格式或編碼。');
    }

    console.log(`正在代理 PDF 請求：${decodedUrl}`);

    const pdfRequest = https.get(decodedUrl, (pdfRes) => {
        // 處理重定向
        if (pdfRes.statusCode >= 300 && pdfRes.statusCode < 400 && pdfRes.headers.location) {
            console.log(`正在跟隨從 ${decodedUrl} 到 ${pdfRes.headers.location} 的重定向`);
            try {
                const redirectUrlObject = new URL(pdfRes.headers.location, decodedUrl);
                const allowedDomains = ['raw.githubusercontent.com'];
                 if (!allowedDomains.includes(redirectUrlObject.hostname)) {
                   console.warn(`代理重定向被阻止，不允許的網域：${redirectUrlObject.hostname}`);
                   return res.status(403).send('重定向目標網域不被允許。');
                }
                const redirectedRequest = https.get(redirectUrlObject.href, (redirectedRes) => {
                     if (redirectedRes.statusCode !== 200) {
                        console.error(`獲取重定向 PDF 時出錯：狀態碼：${redirectedRes.statusCode}，URL：${redirectUrlObject.href}`);
                        const statusCodeToSend = redirectedRes.statusCode >= 400 ? redirectedRes.statusCode : 502;
                        return res.status(statusCodeToSend).send(`無法獲取重定向的 PDF：${redirectedRes.statusMessage}`);
                    }
                     res.setHeader('Content-Type', redirectedRes.headers['content-type'] || 'application/pdf');
                     redirectedRes.pipe(res);
                }).on('error', (err) => {
                     console.error(`重定向 PDF 請求至 ${redirectUrlObject.href} 時發生錯誤：`, err.message);
                     if (!res.headersSent) res.status(500).send('透過代理獲取重定向 PDF 時出錯。');
                });
                redirectedRequest.setTimeout(15000, () => {
                    console.error(`重定向 PDF 請求至 ${redirectUrlObject.href} 時超時`);
                    redirectedRequest.destroy();
                    if (!res.headersSent) res.status(504).send('透過代理獲取重定向 PDF 時超時。');
                });
                return;
             } catch (e) {
                console.error(`無效的重定向 URL：${pdfRes.headers.location}`, e);
                return res.status(500).send('從來源收到無效的重定向位置。');
             }
        }

        if (pdfRes.statusCode !== 200) {
            console.error(`獲取 PDF 時出錯：狀態碼：${pdfRes.statusCode}，URL：${decodedUrl}`);
            const statusCodeToSend = pdfRes.statusCode >= 400 ? pdfRes.statusCode : 502;
             return res.status(statusCodeToSend).send(`無法從來源獲取 PDF：狀態 ${pdfRes.statusCode}`);
        }

        console.log(`從來源 ${decodedUrl} 獲取的 Content-Type 為: ${pdfRes.headers['content-type']}，強制設為 application/pdf`);
        res.setHeader('Content-Type', 'application/pdf');

        pdfRes.pipe(res);

    }).on('error', (err) => {
        console.error(`向 ${decodedUrl} 發起 PDF 請求期間發生網路或連線錯誤：`, err.message);
         if (!res.headersSent) {
             res.status(502).send('錯誤的網關：連接 PDF 來源時出錯。');
         } else {
             res.end();
         }
    });
     pdfRequest.setTimeout(15000, () => {
         console.error(`向 ${decodedUrl} 發起初始 PDF 請求時超時`);
         pdfRequest.destroy();
         if (!res.headersSent) {
             res.status(504).send('網關超時：連接 PDF 來源時超時。');
         }
     });
});







// GET /api/banners?page=... (已更新過濾邏輯)
app.get('/api/banners', async (req, res) => {
    const pageLocation = req.query.page || 'all'; // 默認為 'all'，如果是首頁則用 'home'
    let queryText = 'SELECT id, image_url, link_url, alt_text FROM banners';
    const queryParams = [];
    
    if (pageLocation !== 'all') {
        queryText += ' WHERE page_location = $1';
        queryParams.push(pageLocation);
    }

    queryText += ' ORDER BY RANDOM() LIMIT 5';  // 隨機選擇 5 張圖片
    try {
        const result = await pool.query(queryText, queryParams);
        res.json(result.rows); // 返回隨機圖片資料
    } catch (err) {
        console.error('獲取 Banner 時出錯:', err);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});








// GET /api/products?sort=...
app.get('/api/products', async (req, res) => {
    const sortBy = req.query.sort || 'latest';
    let orderByClause = 'ORDER BY created_at DESC, id DESC'; // 添加 id 排序確保穩定
    if (sortBy === 'popular') {
        orderByClause = 'ORDER BY click_count DESC, created_at DESC, id DESC'; // 添加 id 排序確保穩定
    }
    try {
        const queryText = `SELECT id, name, description, price, image_url, seven_eleven_url, click_count FROM products ${orderByClause}`;
        const result = await pool.query(queryText);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取商品列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET /api/products/:id
app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的商品 ID 格式。' }); }
    try {
        const result = await pool.query('SELECT id, name, description, price, image_url, seven_eleven_url, click_count FROM products WHERE id = $1', [id]);
        if (result.rows.length === 0) { return res.status(404).json({ error: '找不到商品。' }); }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`獲取商品 ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// POST /api/products/:id/click
app.post('/api/products/:id/click', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { console.warn(`收到無效商品 ID (${id}) 的點擊記錄請求`); return res.status(204).send(); }
    try {
        await pool.query('UPDATE products SET click_count = click_count + 1 WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error(`記錄商品 ID ${id} 點擊時出錯:`, err);
        res.status(204).send(); // 出錯也靜默處理
    }
});

// GET /api/artists
app.get('/api/artists', async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT artist FROM music WHERE artist IS NOT NULL AND artist <> \'\' ORDER BY artist ASC');
        const artists = result.rows.map(row => row.artist);
        res.json(artists);
    } catch (err) {
        console.error('獲取歌手列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET /api/music?artist=...
app.get('/api/music', async (req, res) => {
    const artistFilter = req.query.artist || null;
    let queryText = 'SELECT id, title, artist, cover_art_url, platform_url, release_date, description FROM music';
    const queryParams = [];
    if (artistFilter && artistFilter !== 'All') { // 修改: 不等於 'All' 才加入條件
         queryText += ' WHERE artist = $1';
         queryParams.push(decodeURIComponent(artistFilter)); // 解碼
    }
    queryText += ' ORDER BY release_date DESC NULLS LAST, title ASC'; // 處理可能的 null 日期，並添加標題排序
    try {
        const result = await pool.query(queryText, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取音樂列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET /api/music/:id (已更新包含 scores 和 youtube_video_id)
app.get('/api/music/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) {
         return res.status(400).json({ error: '無效的音樂 ID' });
    }
    try {
        const queryText = `
            SELECT
                m.*,
                COALESCE(
                    (SELECT json_agg(s.* ORDER BY s.display_order ASC, s.type ASC)
                     FROM scores s
                     WHERE s.music_id = m.id),
                    '[]'::json
                ) AS scores
            FROM music m
            WHERE m.id = $1;
        `;
        const result = await pool.query(queryText, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到音樂' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`獲取 ID 為 ${id} 的音樂時出錯：`, err.stack || err);
        res.status(500).json({ error: '獲取音樂詳情時發生內部伺服器錯誤' });
    }
});



// 獲取新聞列表 API
app.get('/api/news', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    if (page <= 0 || limit <= 0) { return res.status(400).json({ error: '頁碼和每頁數量必須是正整數。' }); }
    const offset = (page - 1) * limit;
    try {
        const countResult = await pool.query('SELECT COUNT(*) FROM news');
        const totalItems = parseInt(countResult.rows[0].count);

        // 修改排序條件：根據 event_date 排序
        const newsResult = await pool.query(`
            SELECT id, title, event_date, summary, thumbnail_url, like_count, updated_at
            FROM news
            ORDER BY event_date DESC, id DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const totalPages = Math.ceil(totalItems / limit);
        res.status(200).json({
            totalItems,
            totalPages,
            currentPage: page,
            limit,
            news: newsResult.rows
        });
    } catch (err) {
        console.error('獲取最新消息列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});




// GET /api/news/:id (單一新聞)
app.get('/api/news/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); }
    try {
        const result = await pool.query('SELECT id, title, event_date, summary, content, thumbnail_url, image_url, like_count, updated_at FROM news WHERE id = $1', [id]);
        if (result.rows.length === 0) { return res.status(404).json({ error: '找不到該消息。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`獲取消息 ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// POST /api/news/:id/like
app.post('/api/news/:id/like', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); }
    try {
        const result = await pool.query('UPDATE news SET like_count = like_count + 1 WHERE id = $1 RETURNING like_count', [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到要按讚的消息。' }); }
        res.status(200).json({ like_count: result.rows[0].like_count });
    } catch (err) {
        console.error(`處理消息 ID ${id} 按讚時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// --- 受保護的管理頁面和 API Routes ---

// 保護管理 HTML 頁面
app.use(['/admin.html', '/music-admin.html', '/news-admin.html', '/banner-admin.html','/sales-report.html ','figures-admin.html'], basicAuthMiddleware);
// 保護所有 /api/admin 和 /api/analytics 開頭的 API
app.use(['/api/admin', '/api/analytics'], basicAuthMiddleware);
app.use('/api/admin/guestbook', basicAuthMiddleware); // 保護所有 /api/admin/guestbook/...
app.use('/api/admin/identities', basicAuthMiddleware); // 保護身份管理 API







// GET /api/admin/identities - 取得所有管理員身份
app.get('/api/admin/identities', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, description FROM admin_identities ORDER BY name ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('獲取管理員身份列表時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取身份列表時發生錯誤' });
    }
});

// POST /api/admin/identities - 新增管理員身份
app.post('/api/admin/identities', async (req, res) => {
    const { name, description } = req.body;
    const finalName = (name || '').trim();
    if (!finalName) {
        return res.status(400).json({ error: '身份名稱不能為空。' });
    }
    if (finalName.length > 50) {
         return res.status(400).json({ error: '身份名稱過長 (最多 50 字元)。' });
     }
    try {
        const result = await pool.query(
            'INSERT INTO admin_identities (name, description) VALUES ($1, $2) RETURNING *',
            [finalName, description || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // UNIQUE key violation
            return res.status(409).json({ error: '該身份名稱已被使用。' });
        }
        console.error('新增管理員身份時出錯:', err.stack || err);
        res.status(500).json({ error: '新增身份時發生錯誤' });
    }
});

// PUT /api/admin/identities/:id - 更新管理員身份
app.put('/api/admin/identities/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    const identityId = parseInt(id);
    const finalName = (name || '').trim();

    if (isNaN(identityId)) { return res.status(400).json({ error: '無效的 ID 格式。' }); }
    if (!finalName) { return res.status(400).json({ error: '身份名稱不能為空。' }); }
    if (finalName.length > 50) { return res.status(400).json({ error: '身份名稱過長 (最多 50 字元)。' }); }

    try {
        const result = await pool.query(
            'UPDATE admin_identities SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [finalName, description || null, identityId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的身份。' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // UNIQUE key violation
            return res.status(409).json({ error: '該身份名稱已被使用。' });
        }
        console.error(`更新身份 ID ${identityId} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '更新身份時發生錯誤' });
    }
});

// DELETE /api/admin/identities/:id - 刪除管理員身份
app.delete('/api/admin/identities/:id', async (req, res) => {
    const { id } = req.params;
    const identityId = parseInt(id);
    if (isNaN(identityId)) { return res.status(400).json({ error: '無效的 ID 格式。' }); }

    try {
        // ON DELETE SET NULL 約束會自動處理 guestbook_replies 中的 admin_identity_id
        const result = await pool.query('DELETE FROM admin_identities WHERE id = $1', [identityId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要刪除的身份。' });
        }
        res.status(204).send(); // 成功刪除，無內容返回
    } catch (err) {
        console.error(`刪除身份 ID ${identityId} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '刪除身份時發生錯誤' });
    }
});

// GET /api/admin/guestbook - 管理後台取得留言列表 (含篩選、搜尋)
app.get('/api/admin/guestbook', async (req, res) => { // 已受 basicAuthMiddleware 保護
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'latest'; // 'latest', 'created_at'
    const filter = req.query.filter || 'all'; // 'all', 'visible', 'hidden'
    const search = (req.query.search || '').trim();

    if (page <= 0 || limit <= 0) { return res.status(400).json({ error: '頁碼和每頁數量必須是正整數。' }); }
    const offset = (page - 1) * limit;

    // 排序邏輯
    let orderByClause;
    switch (sort) {
        case 'created_at':
             orderByClause = 'ORDER BY created_at DESC';
             break;
        case 'latest':
        default:
            orderByClause = 'ORDER BY last_activity_at DESC';
            break;
    }

    // 篩選和搜尋條件
    let whereClauses = [];
    const queryParams = [];
    let paramIndex = 1;

    if (filter === 'visible') {
        whereClauses.push(`is_visible = TRUE`);
    } else if (filter === 'hidden') {
        whereClauses.push(`is_visible = FALSE`);
    } // 'all' 不加條件

    if (search) {
        // 搜尋標題、作者、內容 (ILIKE 不區分大小寫)
        whereClauses.push(`(title ILIKE $${paramIndex} OR author_name ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
    }

    const whereCondition = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const client = await pool.connect();
    try {
        // 計算符合條件的總數
        const countQuery = `SELECT COUNT(*) FROM guestbook_messages ${whereCondition}`;
        const countResult = await client.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / limit);

        // 取得當頁資料
        queryParams.push(limit); // 為主查詢添加 limit 和 offset 參數
        queryParams.push(offset);
        const messagesQuery = `
            SELECT id, author_name, title, view_count, reply_count, is_visible, created_at, last_activity_at
            FROM guestbook_messages
            ${whereCondition}
            ${orderByClause}
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}`; // 使用正確的參數索引
        const messagesResult = await client.query(messagesQuery, queryParams);

        res.status(200).json({
            messages: messagesResult.rows,
            currentPage: page,
            totalPages,
            totalItems,
            limit,
            currentSort: sort,
            currentFilter: filter,
            currentSearch: search
        });
    } catch (err) {
        console.error('獲取管理留言列表時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取管理留言列表時發生內部伺服器錯誤' });
    } finally {
        client.release();
    }
});

// GET /api/admin/guestbook/message/:id - 管理後台取得單一留言詳情 (含所有回覆)
app.get('/api/admin/guestbook/message/:id', async (req, res) => { // 已受 basicAuthMiddleware 保護
    const { id } = req.params;
    const messageId = parseInt(id);
    if (isNaN(messageId)) { return res.status(400).json({ error: '無效的留言 ID 格式。' }); }

    const client = await pool.connect();
    try {
        // 取得主留言 (無論是否可見)
        const messageResult = await client.query('SELECT * FROM guestbook_messages WHERE id = $1', [messageId]);
        if (messageResult.rows.length === 0) {
            return res.status(404).json({ error: '找不到指定的留言。' });
        }
        const message = messageResult.rows[0];

        // 取得所有回覆 (無論是否可見)，並連接身份名稱
        const repliesResult = await client.query(
            `SELECT r.*, ai.name AS admin_identity_name
             FROM guestbook_replies r
             LEFT JOIN admin_identities ai ON r.admin_identity_id = ai.id
             WHERE r.message_id = $1
             ORDER BY r.created_at ASC`,
            [messageId]
        );

        res.status(200).json({ message: message, replies: repliesResult.rows });
    } catch (err) {
        console.error(`管理員獲取留言 ID ${messageId} 詳情時出錯:`, err.stack || err);
        res.status(500).json({ error: '管理員獲取留言詳情時發生內部伺服器錯誤' });
    } finally {
        client.release();
    }
});

// PUT /api/admin/guestbook/messages/:id/visibility - 切換主留言可見狀態
app.put('/api/admin/guestbook/messages/:id/visibility', async (req, res) => { // 已受 basicAuthMiddleware 保護
    const { id } = req.params;
    const { is_visible } = req.body; // 預期接收 { "is_visible": true/false }
    const messageId = parseInt(id);

    if (isNaN(messageId)) { return res.status(400).json({ error: '無效的留言 ID 格式。' }); }
    if (typeof is_visible !== 'boolean') { return res.status(400).json({ error: 'is_visible 參數必須是布林值。' }); }

    try {
        const result = await pool.query(
            'UPDATE guestbook_messages SET is_visible = $1 WHERE id = $2 RETURNING id, is_visible',
            [is_visible, messageId]
        );
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到要更新的留言。' }); }
        res.status(200).json(result.rows[0]); // 回傳更新後的狀態
    } catch (err) {
        console.error(`更新留言 ID ${messageId} 可見性時出錯:`, err.stack || err);
        res.status(500).json({ error: '更新留言可見性時發生錯誤' });
    }
});

// PUT /api/admin/guestbook/replies/:id/visibility - 切換回覆可見狀態
app.put('/api/admin/guestbook/replies/:id/visibility', async (req, res) => { // 已受 basicAuthMiddleware 保護
    const { id } = req.params;
    const { is_visible } = req.body;
    const replyId = parseInt(id);

    if (isNaN(replyId)) { return res.status(400).json({ error: '無效的回覆 ID 格式。' }); }
    if (typeof is_visible !== 'boolean') { return res.status(400).json({ error: 'is_visible 參數必須是布林值。' }); }

    try {
        const result = await pool.query(
            'UPDATE guestbook_replies SET is_visible = $1 WHERE id = $2 RETURNING id, is_visible',
            [is_visible, replyId]
        );
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到要更新的回覆。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`更新回覆 ID ${replyId} 可見性時出錯:`, err.stack || err);
        res.status(500).json({ error: '更新回覆可見性時發生錯誤' });
    }
});

// DELETE /api/admin/guestbook/messages/:id - 刪除主留言 (會級聯刪除回覆)
app.delete('/api/admin/guestbook/messages/:id', async (req, res) => { // 已受 basicAuthMiddleware 保護
    const { id } = req.params;
    const messageId = parseInt(id);
    if (isNaN(messageId)) { return res.status(400).json({ error: '無效的留言 ID 格式。' }); }

    try {
        // ON DELETE CASCADE 會處理 guestbook_replies
        const result = await pool.query('DELETE FROM guestbook_messages WHERE id = $1', [messageId]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到要刪除的留言。' }); }
        res.status(204).send();
    } catch (err) {
        console.error(`刪除留言 ID ${messageId} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '刪除留言時發生錯誤' });
    }
});

// DELETE /api/admin/guestbook/replies/:id - 刪除單個回覆 (會級聯刪除其下的回覆)
app.delete('/api/admin/guestbook/replies/:id', async (req, res) => { // 已受 basicAuthMiddleware 保護
    const { id } = req.params;
    const replyId = parseInt(id);
    if (isNaN(replyId)) { return res.status(400).json({ error: '無效的回覆 ID 格式。' }); }

    try {
        // AFTER DELETE 觸發器會處理主留言的 reply_count 更新
        const result = await pool.query('DELETE FROM guestbook_replies WHERE id = $1', [replyId]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到要刪除的回覆。' }); }
        res.status(204).send();
    } catch (err) {
        console.error(`刪除回覆 ID ${replyId} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '刪除回覆時發生錯誤' });
    }
});

// POST /api/admin/guestbook/replies - 管理員發表回覆
app.post('/api/admin/guestbook/replies', async (req, res) => { // 已受 basicAuthMiddleware 保護
    const { message_id, parent_reply_id, content, admin_identity_id } = req.body;

    const finalContent = (content || '').trim();
    const messageIdInt = parseInt(message_id);
    const parentReplyIdInt = parent_reply_id ? parseInt(parent_reply_id) : null;
    const adminIdentityIdInt = parseInt(admin_identity_id);

    // --- 驗證 ---
    if (isNaN(messageIdInt)) { return res.status(400).json({ error: '無效的留言 ID。' }); }
    if (parent_reply_id && isNaN(parentReplyIdInt)) { return res.status(400).json({ error: '無效的父回覆 ID。' }); }
    if (!finalContent) { return res.status(400).json({ error: '回覆內容不能為空。' }); }
    if (isNaN(adminIdentityIdInt)) { return res.status(400).json({ error: '必須選擇一個管理員身份。' }); }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 檢查管理員身份是否存在
        const identityCheck = await client.query('SELECT name FROM admin_identities WHERE id = $1', [adminIdentityIdInt]);
        if (identityCheck.rowCount === 0) {
             await client.query('ROLLBACK');
             return res.status(400).json({ error: '選擇的管理員身份無效。' });
        }
        const adminIdentityName = identityCheck.rows[0].name; // 用於儲存和回傳

        // 檢查主留言是否存在 (管理員可回覆隱藏的)
        const msgCheck = await client.query('SELECT 1 FROM guestbook_messages WHERE id = $1', [messageIdInt]);
        if (msgCheck.rowCount === 0) {
            await client.query('ROLLBACK');
             return res.status(404).json({ error: '找不到對應的主留言。' });
        }
         // 檢查父回覆是否存在 (管理員可回覆隱藏的)
        if (parentReplyIdInt) {
            const replyCheck = await client.query('SELECT 1 FROM guestbook_replies WHERE id = $1 AND message_id = $2', [parentReplyIdInt, messageIdInt]);
             if (replyCheck.rowCount === 0) {
                 await client.query('ROLLBACK');
                 return res.status(404).json({ error: '找不到要回覆的回覆。' });
             }
        }

        // 插入管理員回覆，注意 author_name 欄位也存入身份名
        const result = await client.query(
            `INSERT INTO guestbook_replies (message_id, parent_reply_id, author_name, content, is_admin_reply, admin_identity_id, is_visible, created_at, updated_at)
             VALUES ($1, $2, $3, $4, TRUE, $5, TRUE, NOW(), NOW()) -- 預設可見
             RETURNING *`,
            [messageIdInt, parentReplyIdInt, adminIdentityName, finalContent, adminIdentityIdInt]
        );

        // 觸發器會更新主留言計數和時間
        await client.query('COMMIT');

        const newReply = result.rows[0];
        newReply.admin_identity_name = adminIdentityName; // 方便前端顯示，附加名稱

        res.status(201).json(newReply);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('管理員新增回覆時出錯:', err.stack || err);
        res.status(500).json({ error: '管理員新增回覆時發生內部伺服器錯誤' });
    } finally {
        client.release();
    }
});







// --- 新增前端頁面路由 ---
// 公開留言板頁面
app.get('/guestbook', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'guestbook.html'));
});

// 管理後台留言板頁面 (需要認證)
app.get('/guestbook-admin.html', basicAuthMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'guestbook-admin.html'));
});







// 處理留言板 API 路徑
app.get('/api/guestbook', async (req, res) => {
    const { page = 1, limit = 10, sort = 'latest' } = req.query;
    
    try {
        const offset = (page - 1) * limit;
        let queryText = 'SELECT * FROM guestbook ORDER BY created_at DESC LIMIT $1 OFFSET $2';
        const queryParams = [limit, offset];

        if (sort === 'popular') {
            queryText = 'SELECT * FROM guestbook ORDER BY reply_count DESC LIMIT $1 OFFSET $2';
        }

        const result = await pool.query(queryText, queryParams);
        const messages = result.rows;

        // 回傳留言資料
        res.json({
            currentPage: page,
            totalPages: Math.ceil(messages.length / limit),
            currentSort: sort,
            messages: messages
        });
    } catch (err) {
        console.error('獲取留言板資料時出錯:', err);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});









// --- 流量分析 API ---
// GET /api/analytics/traffic
app.get('/api/analytics/traffic', async (req, res) => { // basicAuthMiddleware 已在上面 app.use 中應用
  console.log("接收到 /api/analytics/traffic 請求");
  const daysToFetch = 30; const startDate = new Date(); startDate.setDate(startDate.getDate() - daysToFetch); const startDateString = startDate.toISOString().split('T')[0]; console.log(`計算起始日期: ${startDateString}`);
  try {
      const queryText = `SELECT view_date, SUM(view_count)::bigint AS count FROM page_views WHERE view_date >= $1 GROUP BY view_date ORDER BY view_date ASC`;
      const result = await pool.query(queryText, [startDateString]);
      const trafficData = result.rows.map(row => ({ date: new Date(row.view_date).toISOString().split('T')[0], count: parseInt(row.count) }));
      res.status(200).json(trafficData);
  } catch (err) { console.error('獲取流量數據時發生嚴重錯誤:', err); res.status(500).json({ error: '伺服器內部錯誤，無法獲取流量數據。' }); }
});

// GET /api/analytics/monthly-traffic
app.get('/api/analytics/monthly-traffic', async (req, res) => { // basicAuthMiddleware 已在上面 app.use 中應用
  console.log("接收到 /api/analytics/monthly-traffic 請求");
  const targetYear = req.query.year ? parseInt(req.query.year) : null;
  let queryText = `SELECT to_char(date_trunc('month', view_date), 'YYYY-MM') AS view_month, SUM(view_count)::bigint AS count FROM page_views`;
  const queryParams = [];
  if (targetYear && !isNaN(targetYear)) { // 驗證年份
      queryText += ` WHERE date_part('year', view_date) = $1`;
      queryParams.push(targetYear);
  }
  queryText += ` GROUP BY view_month ORDER BY view_month ASC`;
  try {
      const result = await pool.query(queryText, queryParams);
      const monthlyTrafficData = result.rows.map(row => ({ month: row.view_month, count: parseInt(row.count) }));
      res.status(200).json(monthlyTrafficData);
  } catch (err) { console.error('獲取月度流量數據時發生嚴重錯誤:', err); res.status(500).json({ error: '伺服器內部錯誤，無法獲取月度流量數據。' }); }
});



// --- 保護的管理頁面和 API Routes ---




// --- 新增: 銷售報告 API (受保護) ---
app.get('/api/analytics/sales-report', async (req, res) => {
    const { startDate, endDate } = req.query; // 從查詢參數獲取日期範圍

    // 基本日期驗證 (範例，可以做得更完善)
    let queryStartDate = startDate ? new Date(startDate) : null;
    let queryEndDate = endDate ? new Date(endDate) : null;

    // 設置預設日期範圍 (例如：過去 30 天)
    if (!queryStartDate || !queryEndDate || isNaN(queryStartDate) || isNaN(queryEndDate)) {
        queryEndDate = new Date(); // 今天結束
        queryStartDate = new Date();
        queryStartDate.setDate(queryEndDate.getDate() - 30); // 30 天前開始
    } else {
        // 確保結束日期包含當天結束時間
         queryEndDate.setHours(23, 59, 59, 999);
    }

    // 將日期轉換為 ISO 格式給 SQL 使用
    const startDateISO = queryStartDate.toISOString();
    const endDateISO = queryEndDate.toISOString();

    console.log(`[Sales Report API] Fetching data from ${startDateISO} to ${endDateISO}`);

    const client = await pool.connect();
    try {
        // 1. 總銷售件數
        const totalItemsResult = await client.query(
            `SELECT COALESCE(SUM(quantity_sold), 0)::integer AS total_items
             FROM sales_log
             WHERE sale_timestamp BETWEEN $1 AND $2`,
            [startDateISO, endDateISO]
        );
        const totalItemsSold = totalItemsResult.rows[0].total_items;

        // 2. 銷售趨勢 (按日)
        const trendResult = await client.query(
            `SELECT DATE(sale_timestamp AT TIME ZONE 'Asia/Taipei') AS sale_date, -- 按台北時間分組日期
                    SUM(quantity_sold)::integer AS daily_quantity
             FROM sales_log
             WHERE sale_timestamp BETWEEN $1 AND $2
             GROUP BY sale_date
             ORDER BY sale_date ASC`,
            [startDateISO, endDateISO]
        );
        const salesTrend = trendResult.rows.map(row => ({
            date: row.sale_date.toISOString().split('T')[0], // 格式化為 YYYY-MM-DD
            quantity: row.daily_quantity
        }));

        // 3. 熱銷商品排行 (依數量, 包含公仔和規格名稱)
        const topProductsResult = await client.query(
            `SELECT
                f.name AS figure_name,
                fv.name AS variation_name,
                SUM(sl.quantity_sold)::integer AS total_quantity
             FROM sales_log sl
             JOIN figure_variations fv ON sl.figure_variation_id = fv.id
             JOIN figures f ON fv.figure_id = f.id
             WHERE sl.sale_timestamp BETWEEN $1 AND $2
             GROUP BY f.name, fv.name
             ORDER BY total_quantity DESC
             LIMIT 10`, // 例如限制前 10 名
            [startDateISO, endDateISO]
        );
        const topSellingProducts = topProductsResult.rows;

        // 4. 詳細銷售紀錄
        const detailedLogResult = await client.query(
            `SELECT
                sl.sale_timestamp,
                f.name AS figure_name,
                fv.name AS variation_name,
                sl.quantity_sold
             FROM sales_log sl
             JOIN figure_variations fv ON sl.figure_variation_id = fv.id
             JOIN figures f ON fv.figure_id = f.id
             WHERE sl.sale_timestamp BETWEEN $1 AND $2
             ORDER BY sl.sale_timestamp DESC`,
            [startDateISO, endDateISO]
        );
        // 格式化時間戳
        const detailedLog = detailedLogResult.rows.map(row => ({
             timestamp: row.sale_timestamp, // 前端可以再格式化
             figureName: row.figure_name,
             variationName: row.variation_name,
             quantity: row.quantity_sold
         }));

        res.status(200).json({
            summary: {
                totalItemsSold: totalItemsSold,
                startDate: startDateISO.split('T')[0], // 回傳實際使用的日期範圍
                endDate: endDateISO.split('T')[0]
            },
            trend: salesTrend,
            topProducts: topSellingProducts,
            details: detailedLog
        });

    } catch (err) {
        console.error('[Sales Report API Error] 獲取銷售報告數據時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取銷售報告數據時發生伺服器內部錯誤' });
    } finally {
        client.release();
    }
});





// GET /api/admin/sales - 獲取銷售紀錄 (可篩選)
app.get('/api/admin/sales', async (req, res) => {
    console.log("[Admin API] GET /api/admin/sales requested with query:", req.query);
    const { startDate, endDate, productName } = req.query;
    let queryText = `
        SELECT id, product_name, quantity_sold, sale_timestamp
        FROM sales_log
    `;
    const queryParams = [];
    const conditions = [];
    let paramIndex = 1;

    if (startDate) {
        conditions.push(`sale_timestamp >= $${paramIndex++}`);
        queryParams.push(startDate);
    }
    if (endDate) {
        // 包含 endDate 當天，所以用 < 第二天的 00:00
        const nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        conditions.push(`sale_timestamp < $${paramIndex++}`);
        queryParams.push(nextDay.toISOString().split('T')[0]);
    }
    if (productName) {
        conditions.push(`product_name ILIKE $${paramIndex++}`); // ILIKE 不區分大小寫
        queryParams.push(`%${productName}%`); // 模糊匹配
    }

    if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY sale_timestamp DESC, id DESC'; // 預設按銷售時間降序排列

    try {
        const result = await pool.query(queryText, queryParams);
        console.log(`[Admin API] Found ${result.rowCount} sales records.`);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('[Admin API Error] 獲取銷售紀錄時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取銷售紀錄時發生伺服器內部錯誤' });
    }
});

// GET /api/admin/sales/summary - 獲取銷售彙總數據 (可篩選)
app.get('/api/admin/sales/summary', async (req, res) => {
    console.log("[Admin API] GET /api/admin/sales/summary requested with query:", req.query);
    const { startDate, endDate } = req.query;

    // 基本 WHERE 條件子句生成
    let whereClause = '';
    const queryParams = [];
    let paramIndex = 1;
    if (startDate) {
        whereClause += `WHERE sale_timestamp >= $${paramIndex++} `;
        queryParams.push(startDate);
    }
    if (endDate) {
        const nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        whereClause += (whereClause ? 'AND ' : 'WHERE ') + `sale_timestamp < $${paramIndex++} `;
        queryParams.push(nextDay.toISOString().split('T')[0]);
    }

    try {
        // 1. 總銷售件數
        const totalItemsQuery = `SELECT COALESCE(SUM(quantity_sold)::integer, 0) as total_items FROM sales_log ${whereClause}`;
        const totalItemsResult = await pool.query(totalItemsQuery, queryParams);
        const totalItems = totalItemsResult.rows[0].total_items;

        // 2. 熱銷商品 Top 5
        const topProductsQuery = `
            SELECT product_name, SUM(quantity_sold)::integer as total_sold
            FROM sales_log
            ${whereClause}
            GROUP BY product_name
            ORDER BY total_sold DESC
            LIMIT 5;
        `;
        const topProductsResult = await pool.query(topProductsQuery, queryParams);
        const topProducts = topProductsResult.rows;

        // 3. 每日銷售趨勢 (按日期分組)
        const salesTrendQuery = `
            SELECT DATE(sale_timestamp) as sale_date, SUM(quantity_sold)::integer as daily_total
            FROM sales_log
            ${whereClause}
            GROUP BY sale_date
            ORDER BY sale_date ASC;
        `;
        const salesTrendResult = await pool.query(salesTrendQuery, queryParams);
        // 格式化日期為 YYYY-MM-DD
        const salesTrend = salesTrendResult.rows.map(row => ({
            date: new Date(row.sale_date).toISOString().split('T')[0],
            quantity: row.daily_total
        }));


        res.status(200).json({
            totalItems,
            topProducts,
            salesTrend
        });

    } catch (err) {
        console.error('[Admin API Error] 獲取銷售彙總數據時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取銷售彙總數據時發生伺服器內部錯誤' });
    }
});


// POST /api/admin/sales - 新增銷售紀錄
app.post('/api/admin/sales', async (req, res) => {
    const { product_name, quantity_sold, sale_timestamp } = req.body;
    console.log("[Admin API] POST /api/admin/sales received:", req.body);

    if (!product_name || !quantity_sold) {
        return res.status(400).json({ error: '商品名稱和銷售數量為必填項。' });
    }
    const quantity = parseInt(quantity_sold);
    if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ error: '銷售數量必須是正整數。' });
    }
    // 驗證 sale_timestamp 格式 (如果提供的話)
    let timestampToInsert = sale_timestamp ? new Date(sale_timestamp) : new Date();
    if (isNaN(timestampToInsert.getTime())) {
        console.warn("無效的銷售時間格式，將使用目前時間:", sale_timestamp);
        timestampToInsert = new Date(); // 無效則使用現在時間
    }


    try {
        const queryText = `
            INSERT INTO sales_log (product_name, quantity_sold, sale_timestamp)
            VALUES ($1, $2, $3)
            RETURNING id, product_name, quantity_sold, sale_timestamp;
        `;
        const result = await pool.query(queryText, [
            product_name.trim(),
            quantity,
            timestampToInsert
        ]);
        console.log("[Admin API] Sales record added:", result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[Admin API Error] 新增銷售紀錄時出錯:', err.stack || err);
        res.status(500).json({ error: '新增銷售紀錄過程中發生伺服器內部錯誤。' });
    }
});

// PUT /api/admin/sales/:id - 更新銷售紀錄
app.put('/api/admin/sales/:id', async (req, res) => {
    const { id } = req.params;
    const { product_name, quantity_sold, sale_timestamp } = req.body;
    console.log(`[Admin API] PUT /api/admin/sales/${id} received:`, req.body);

    const recordId = parseInt(id);
    if (isNaN(recordId)) {
        return res.status(400).json({ error: '無效的銷售紀錄 ID 格式。' });
    }
    if (!product_name || !quantity_sold) {
        return res.status(400).json({ error: '商品名稱和銷售數量為必填項。' });
    }
    const quantity = parseInt(quantity_sold);
    if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ error: '銷售數量必須是正整數。' });
    }
     // 驗證 sale_timestamp 格式
    let timestampToUpdate = new Date(sale_timestamp);
    if (isNaN(timestampToUpdate.getTime())) {
        console.warn(`無效的銷售時間格式 (ID: ${id})，將保持原時間或更新為現在? 這裡選擇更新為現在:`, sale_timestamp);
        // 或者你可以決定不更新時間欄位如果格式錯誤
        // timestampToUpdate = undefined; // 如果不想更新時間
        return res.status(400).json({ error: '無效的銷售時間格式。' }); // 更嚴格，要求有效時間
    }


    try {
        const queryText = `
            UPDATE sales_log
            SET product_name = $1, quantity_sold = $2, sale_timestamp = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING id, product_name, quantity_sold, sale_timestamp;
        `;
        const result = await pool.query(queryText, [
            product_name.trim(),
            quantity,
            timestampToUpdate, // 使用驗證過的 Date 物件
            recordId
        ]);

        if (result.rowCount === 0) {
            console.warn(`[Admin API] Sales record ID ${id} not found for update.`);
            return res.status(404).json({ error: '找不到要更新的銷售紀錄。' });
        }

        console.log(`[Admin API] Sales record ID ${id} updated:`, result.rows[0]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`[Admin API Error] 更新銷售紀錄 ID ${id} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '更新銷售紀錄過程中發生伺服器內部錯誤。' });
    }
});

// DELETE /api/admin/sales/:id - 刪除銷售紀錄
app.delete('/api/admin/sales/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] DELETE /api/admin/sales/${id} requested`);

    const recordId = parseInt(id);
    if (isNaN(recordId)) {
        return res.status(400).json({ error: '無效的銷售紀錄 ID 格式。' });
    }

    try {
        const queryText = 'DELETE FROM sales_log WHERE id = $1';
        const result = await pool.query(queryText, [recordId]);

        if (result.rowCount === 0) {
            console.warn(`[Admin API] Sales record ID ${id} not found for deletion.`);
            return res.status(404).json({ error: '找不到要刪除的銷售紀錄。' });
        }

        console.log(`[Admin API] Deleted sales record ID: ${id}`);
        res.status(204).send(); // 成功刪除，回傳 204 No Content
    } catch (err) {
        console.error(`[Admin API Error] 刪除銷售紀錄 ID ${id} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '刪除銷售紀錄過程中發生伺服器內部錯誤。' });
    }
});










// GET /api/admin/figures - 獲取所有公仔列表 (包含規格)
app.get('/api/admin/figures', async (req, res) => {
    console.log("[Admin API] GET /api/admin/figures requested");
    try {
        // 使用 LEFT JOIN 和 JSON_AGG 來聚合每個公仔的規格資訊
        const queryText = `
            SELECT
                f.id,
                f.name,
                f.image_url,
                f.purchase_price,
                f.selling_price,
                f.ordering_method,
                f.created_at,
                f.updated_at,
                COALESCE(
                    (SELECT json_agg(
                        json_build_object(
                            'id', v.id,
                            'name', v.name,
                            'quantity', v.quantity
                        ) ORDER BY v.name ASC -- 確保規格按名稱排序
                    )
                     FROM figure_variations v
                     WHERE v.figure_id = f.id),
                    '[]'::json -- 如果沒有規格，返回空 JSON 陣列
                ) AS variations
            FROM figures f
            ORDER BY f.created_at DESC; -- 按創建時間降序排列
        `;
        const result = await pool.query(queryText);
        console.log(`[Admin API] Found ${result.rowCount} figures.`);
        res.json(result.rows);
    } catch (err) {
        console.error('[Admin API Error] 獲取公仔列表時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取公仔列表時發生伺服器內部錯誤' });
    }
});

// POST /api/admin/figures - 新增公仔及其規格
app.post('/api/admin/figures', async (req, res) => {
    const { name, image_url, purchase_price, selling_price, ordering_method, variations } = req.body;
    console.log("[Admin API] POST /api/admin/figures received:", req.body);

    // 基本驗證
    if (!name) {
        return res.status(400).json({ error: '公仔名稱為必填項。' });
    }
    if (variations && !Array.isArray(variations)) {
        return res.status(400).json({ error: '規格資料格式必須是陣列。' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // 開始交易

        // 1. 插入公仔基本資料
        const figureInsertQuery = `
            INSERT INTO figures (name, image_url, purchase_price, selling_price, ordering_method)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *; -- 返回插入的整筆資料
        `;
        const figureResult = await client.query(figureInsertQuery, [
            name,
            image_url || null,
            purchase_price || 0,
            selling_price || 0,
            ordering_method || null
        ]);
        const newFigure = figureResult.rows[0];
        const newFigureId = newFigure.id;
        console.log(`[Admin API] Inserted figure with ID: ${newFigureId}`);

        // 2. 插入公仔規格資料 (如果有的話)
        let insertedVariations = [];
        if (variations && variations.length > 0) {
            const variationInsertQuery = `
                INSERT INTO figure_variations (figure_id, name, quantity)
                VALUES ($1, $2, $3)
                RETURNING *; -- 返回插入的規格資料
            `;
            for (const variation of variations) {
                if (!variation.name || variation.quantity === undefined || variation.quantity === null) {
                    throw new Error(`規格 "${variation.name || '未命名'}" 缺少名稱或數量。`);
                }
                const quantity = parseInt(variation.quantity);
                if (isNaN(quantity) || quantity < 0) {
                    throw new Error(`規格 "${variation.name}" 的數量必須是非負整數。`);
                }
                // 檢查規格名稱是否重複 (在同一個公仔下) - 可選，因為有 UNIQUE 約束
                console.log(`[Admin API] Inserting variation for figure ${newFigureId}: Name=${variation.name}, Quantity=${quantity}`);
                const variationResult = await client.query(variationInsertQuery, [
                    newFigureId, variation.name.trim(), quantity
                ]);
                insertedVariations.push(variationResult.rows[0]);
            }
        }

        await client.query('COMMIT'); // 提交交易
        console.log(`[Admin API] Transaction committed for new figure ID: ${newFigureId}`);

        newFigure.variations = insertedVariations; // 將新增的規格附加到回傳的公仔物件
        res.status(201).json(newFigure); // 回傳 201 Created 和新增的公仔資料

    } catch (err) {
        await client.query('ROLLBACK'); // 出錯時回滾交易
        console.error('[Admin API Error] 新增公仔及其規格時出錯:', err.stack || err);
        // 檢查是否是唯一性約束錯誤 (重複的規格名稱)
        if (err.code === '23505' && err.constraint === 'figure_variations_figure_id_name_key') {
             res.status(409).json({ error: `新增失敗：同一個公仔下不能有重複的規格名稱。錯誤詳情: ${err.detail}` });
        } else {
            res.status(500).json({ error: `新增公仔過程中發生錯誤: ${err.message}` });
        }
    } finally {
        client.release(); // 釋放客戶端連接回連接池
    }
});

// PUT /api/admin/figures/:id - 更新公仔及其規格
app.put('/api/admin/figures/:id', async (req, res) => {
    const { id } = req.params;
    const { name, image_url, purchase_price, selling_price, ordering_method, variations } = req.body;
    console.log(`[Admin API] PUT /api/admin/figures/${id} received:`, req.body);

    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的公仔 ID 格式。' }); }
    if (!name) { return res.status(400).json({ error: '公仔名稱為必填項。' }); }
    if (variations && !Array.isArray(variations)) { return res.status(400).json({ error: '規格資料格式必須是陣列。' }); }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 更新公仔基本資料
        const figureUpdateQuery = `
            UPDATE figures
            SET name = $1, image_url = $2, purchase_price = $3, selling_price = $4, ordering_method = $5, updated_at = NOW()
            WHERE id = $6
            RETURNING *;
        `;
        const figureResult = await client.query(figureUpdateQuery, [
            name, image_url || null, purchase_price || 0, selling_price || 0, ordering_method || null, id
        ]);

        if (figureResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到要更新的公仔。' });
        }
        const updatedFigure = figureResult.rows[0];
        console.log(`[Admin API] Updated figure basics for ID: ${id}`);

        // 2. 處理規格 (更新、新增、刪除)
        const variationsToProcess = variations || [];
        const incomingVariationIds = new Set(variationsToProcess.filter(v => v.id).map(v => parseInt(v.id)));

        // 獲取目前資料庫中的規格 ID
        const existingVariationsResult = await client.query('SELECT id FROM figure_variations WHERE figure_id = $1', [id]);
        const existingVariationIds = new Set(existingVariationsResult.rows.map(r => r.id));
        console.log(`[Admin API] Figure ${id}: Existing variation IDs:`, [...existingVariationIds]);
        console.log(`[Admin API] Figure ${id}: Incoming variation IDs:`, [...incomingVariationIds]);

        // 找出需要刪除的規格 (存在於 DB 但不在請求中)
        const variationIdsToDelete = [...existingVariationIds].filter(existingId => !incomingVariationIds.has(existingId));
        if (variationIdsToDelete.length > 0) {
            const deleteQuery = `DELETE FROM figure_variations WHERE id = ANY($1::int[])`;
            console.log(`[Admin API] Figure ${id}: Deleting variation IDs:`, variationIdsToDelete);
            await client.query(deleteQuery, [variationIdsToDelete]);
        }

        // 遍歷請求中的規格進行更新或新增
        const variationUpdateQuery = `UPDATE figure_variations SET name = $1, quantity = $2, updated_at = NOW() WHERE id = $3 AND figure_id = $4`;
        const variationInsertQuery = `INSERT INTO figure_variations (figure_id, name, quantity) VALUES ($1, $2, $3) RETURNING *`;
        let finalVariations = []; // 用於收集最終的規格資料

        for (const variation of variationsToProcess) {
            // 驗證規格資料
            if (!variation.name || variation.quantity === undefined || variation.quantity === null) { throw new Error(`規格 "${variation.name || '未提供'}" 缺少名稱或數量。`); }
            const quantity = parseInt(variation.quantity);
            if (isNaN(quantity) || quantity < 0) { throw new Error(`規格 "${variation.name}" 的數量必須是非負整數。`); }
            const variationId = variation.id ? parseInt(variation.id) : null;

            if (variationId && existingVariationIds.has(variationId)) {
                // 更新現有規格
                console.log(`[Admin API] Figure ${id}: Updating variation ID ${variationId} with Name=${variation.name}, Quantity=${quantity}`);
                await client.query(variationUpdateQuery, [variation.name.trim(), quantity, variationId, id]);
                // 從 DB 重新獲取更新後的數據，或者直接構造（這裡選擇後者）
                 finalVariations.push({ id: variationId, name: variation.name.trim(), quantity: quantity });
            } else {
                // 新增規格 (可能是前端新加的，或 ID 無效/不匹配)
                console.log(`[Admin API] Figure ${id}: Inserting new variation with Name=${variation.name}, Quantity=${quantity}`);
                const insertResult = await client.query(variationInsertQuery, [id, variation.name.trim(), quantity]);
                 finalVariations.push(insertResult.rows[0]); // 使用插入後返回的資料
            }
        }

        await client.query('COMMIT');
        console.log(`[Admin API] Transaction committed for updating figure ID: ${id}`);

        // 整理返回的數據
        updatedFigure.variations = finalVariations.sort((a, b) => a.name.localeCompare(b.name)); // 按名稱排序
        res.status(200).json(updatedFigure);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Admin API Error] 更新公仔 ID ${id} 時出錯:`, err.stack || err);
         // 檢查是否是唯一性約束錯誤 (重複的規格名稱)
        if (err.code === '23505' && err.constraint === 'figure_variations_figure_id_name_key') {
             res.status(409).json({ error: `更新失敗：同一個公仔下不能有重複的規格名稱。錯誤詳情: ${err.detail}` });
        } else {
            res.status(500).json({ error: `更新公仔過程中發生錯誤: ${err.message}` });
        }
    } finally {
        client.release();
    }
});


// DELETE /api/admin/figures/:id - 刪除公仔 (及其規格，因為 ON DELETE CASCADE)
app.delete('/api/admin/figures/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] DELETE /api/admin/figures/${id} requested`);

    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的公仔 ID 格式。' }); }

    try {
        // 因為設定了 ON DELETE CASCADE，只需要刪除 figures 表中的記錄
        const result = await pool.query('DELETE FROM figures WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要刪除的公仔。' });
        }

        console.log(`[Admin API] Deleted figure ID: ${id} and its variations (due to CASCADE)`);
        res.status(204).send(); // 成功刪除，回傳 204 No Content

    } catch (err) {
        console.error(`[Admin API Error] 刪除公仔 ID ${id} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '刪除公仔過程中發生伺服器內部錯誤。' });
    }
});




// --- Banner 管理 API ---
// GET /api/admin/banners
app.get('/api/admin/banners', async (req, res) => {
    console.log("[Admin API] GET /api/admin/banners request received");
    try {
        const result = await pool.query(
            `SELECT id, image_url, link_url, display_order, alt_text, page_location, updated_at
             FROM banners ORDER BY display_order ASC, id ASC`
        );
        console.log(`[Admin API] Found ${result.rowCount} banners for admin list.`);
        res.json(result.rows);
    } catch (err) {
        console.error('[Admin API Error] 獲取管理 Banners 時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET /api/admin/banners/:id
app.get('/api/admin/banners/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] GET /api/admin/banners/${id} request received`);
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    try {
        const result = await pool.query(
            `SELECT id, image_url, link_url, display_order, alt_text, page_location
             FROM banners WHERE id = $1`,
            [id]
        );
        if (result.rows.length === 0) {
            console.warn(`[Admin API] Banner with ID ${id} not found.`);
            return res.status(404).json({ error: '找不到指定的 Banner。' });
        }
        console.log(`[Admin API] Found banner for ID ${id}:`, result.rows[0]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`[Admin API Error] 獲取 Banner ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// POST /api/admin/banners
app.post('/api/admin/banners', async (req, res) => {
    console.log("[Admin API] POST /api/admin/banners request received");
    const { image_url, link_url, display_order, alt_text, page_location } = req.body;
    if (!image_url) return res.status(400).json({ error: '圖片網址不能為空。'});
    if (!page_location) return res.status(400).json({ error: '必須指定顯示頁面。'});
    const order = (display_order !== undefined && display_order !== null) ? parseInt(display_order) : 0; // 處理 0
    if (isNaN(order)) return res.status(400).json({ error: '排序必須是數字。'});
    try {
        const result = await pool.query(
            `INSERT INTO banners (image_url, link_url, display_order, alt_text, page_location, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
            [image_url.trim(), link_url ? link_url.trim() : null, order, alt_text ? alt_text.trim() : null, page_location]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[Admin API Error] 新增 Banner 時出錯:', err);
        res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' });
    }
});

// PUT /api/admin/banners/:id
app.put('/api/admin/banners/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] PUT /api/admin/banners/${id} request received`);
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    const { image_url, link_url, display_order, alt_text, page_location } = req.body;
    if (!image_url) return res.status(400).json({ error: '圖片網址不能為空。'});
    if (!page_location) return res.status(400).json({ error: '必須指定顯示頁面。'});
    const order = (display_order !== undefined && display_order !== null) ? parseInt(display_order) : 0;
    if (isNaN(order)) return res.status(400).json({ error: '排序必須是數字。'});
    try {
        const result = await pool.query(
            `UPDATE banners SET image_url = $1, link_url = $2, display_order = $3, alt_text = $4, page_location = $5, updated_at = NOW()
             WHERE id = $6 RETURNING *`,
            [image_url.trim(), link_url ? link_url.trim() : null, order, alt_text ? alt_text.trim() : null, page_location, id]
        );
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到 Banner，無法更新。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`[Admin API Error] 更新 Banner ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' });
    }
});

// DELETE /api/admin/banners/:id
app.delete('/api/admin/banners/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] DELETE /api/admin/banners/${id} request received`);
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    try {
        const result = await pool.query('DELETE FROM banners WHERE id = $1', [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到 Banner，無法刪除。' }); }
        res.status(204).send();
    } catch (err) {
        console.error(`[Admin API Error] 刪除 Banner ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' });
    }
});


// 在 server.js 的 /api/banners 路由中增加排序參數
app.get('/api/banners', async (req, res) => {
    const pageLocation = req.query.page;
    const sort = req.query.sort || 'display_order'; // 新增排序參數
    
    try {
        let query = 'SELECT * FROM banners';
        const params = [];
        
        if (pageLocation) {
            query += ' WHERE page_location = $1';
            params.push(pageLocation);
        }
        
        // 根據排序參數調整
        query += ` ORDER BY ${sanitizeSortField(sort)} ASC, id ASC`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});


// --- 商品管理 API (受保護) ---
// POST /api/products
app.post('/api/products', async (req, res) => { // basicAuthMiddleware 已在上面 app.use 中應用
    const { name, description, price, image_url, seven_eleven_url } = req.body;
    // 驗證邏輯 ... (省略以保持簡潔)
    try {
        const result = await pool.query(`INSERT INTO products (name, description, price, image_url, seven_eleven_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`, [ name, description || null, price, image_url || null, seven_eleven_url || null ]);
        res.status(201).json(result.rows[0]);
    } catch (err) { console.error('新增商品時出錯:', err); res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' }); }
});
// PUT /api/products/:id
app.put('/api/products/:id', async (req, res) => { // basicAuthMiddleware 已在上面 app.use 中應用
    const { id } = req.params;
    const { name, description, price, image_url, seven_eleven_url } = req.body;
    // 驗證邏輯 ... (省略以保持簡潔)
    try {
        const result = await pool.query(`UPDATE products SET name = $1, description = $2, price = $3, image_url = $4, seven_eleven_url = $5, updated_at = NOW() WHERE id = $6 RETURNING *`, [ name, description || null, price, image_url || null, seven_eleven_url || null, id ]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到商品，無法更新。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) { console.error(`更新商品 ID ${id} 時出錯:`, err); res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' }); }
});
// DELETE /api/products/:id
app.delete('/api/products/:id', async (req, res) => { // basicAuthMiddleware 已在上面 app.use 中應用
    const { id } = req.params;
    // 驗證邏輯 ... (省略以保持簡潔)
    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到商品，無法刪除。' }); }
        res.status(204).send();
    } catch (err) { console.error(`刪除商品 ID ${id} 時出錯:`, err); /* ... 其他錯誤處理 ... */ res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' }); }
});


// --- 音樂管理 API (受保護 - POST/PUT/DELETE) ---
// POST /api/music (已更新包含 scores 和 youtube_video_id)
app.post('/api/music', async (req, res) => { // basicAuthMiddleware 已在上面 app.use 中應用
    const { title, artist, release_date, description, cover_art_url, platform_url, youtube_video_id, scores } = req.body;
    if (!title || !artist) { return res.status(400).json({ error: '標題和歌手為必填項。' }); }
    // 可以在此處添加更多驗證
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const musicInsertQuery = `INSERT INTO music (title, artist, release_date, description, cover_art_url, platform_url, youtube_video_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`;
        const musicResult = await client.query(musicInsertQuery, [title, artist, release_date || null, description || null, cover_art_url || null, platform_url || null, youtube_video_id || null]);
        const newMusic = musicResult.rows[0];
        if (scores && Array.isArray(scores) && scores.length > 0) {
            const scoreInsertQuery = `INSERT INTO scores (music_id, type, pdf_url, display_order) VALUES ($1, $2, $3, $4);`;
            for (const score of scores) { if (score.type && score.pdf_url) await client.query(scoreInsertQuery, [newMusic.id, score.type, score.pdf_url, score.display_order || 0]); }
        }
        await client.query('COMMIT');
        newMusic.scores = scores || [];
        res.status(201).json(newMusic);
    } catch (err) { await client.query('ROLLBACK'); console.error('新增音樂時出錯:', err.stack || err); res.status(500).json({ error: '新增音樂時發生內部伺服器錯誤' });
    } finally { client.release(); }
});

// PUT /api/music/:id (已更新包含 scores 和 youtube_video_id，並包含詳細日誌)
app.put('/api/music/:id', async (req, res) => { // basicAuthMiddleware 已在上面 app.use 中應用
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) { return res.status(400).json({ error: '無效的音樂 ID' }); }
    const { title, artist, release_date, description, cover_art_url, platform_url, youtube_video_id, scores } = req.body;
    console.log(`[DEBUG PUT /api/music/${id}] Received data:`, JSON.stringify(req.body, null, 2)); // Log 1

    if (!title || !artist) { return res.status(400).json({ error: '標題和歌手為必填項。' }); }

    const client = await pool.connect();
    try {
        console.log(`[DEBUG PUT /api/music/${id}] Starting transaction...`); // Log 2
        await client.query('BEGIN');
        const musicUpdateQuery = `UPDATE music SET title = $1, artist = $2, release_date = $3, description = $4, cover_art_url = $5, platform_url = $6, youtube_video_id = $7, updated_at = NOW() WHERE id = $8 RETURNING *;`;
        const musicParams = [title, artist, release_date || null, description || null, cover_art_url || null, platform_url || null, youtube_video_id || null, id];
        console.log(`[DEBUG PUT /api/music/${id}] Executing music update query with params:`, musicParams); // Log 3
        const musicResult = await client.query(musicUpdateQuery, musicParams);

        if (musicResult.rowCount === 0) {
             console.warn(`[DEBUG PUT /api/music/${id}] Music not found, rolling back.`); // Log 4
             await client.query('ROLLBACK');
             return res.status(404).json({ error: '找不到音樂' });
         }
        const updatedMusic = musicResult.rows[0];
        console.log(`[DEBUG PUT /api/music/${id}] Music table updated successfully.`); // Log 5

        const incomingScoreIds = new Set();
        const scoresToUpdate = [];
        const scoresToInsert = [];
        if (scores && Array.isArray(scores)) {
             console.log(`[DEBUG PUT /api/music/${id}] Processing ${scores.length} incoming scores.`); // Log 6
             scores.forEach(score => {
                 if (score.type && score.pdf_url) {
                     if (score.id) {
                         const scoreIdInt = parseInt(score.id, 10);
                         if (!isNaN(scoreIdInt)) { incomingScoreIds.add(scoreIdInt); scoresToUpdate.push(score); }
                         else { console.warn(`[DEBUG PUT /api/music/${id}] Invalid score ID received: ${score.id}, treating as new.`); scoresToInsert.push(score); }
                     } else { scoresToInsert.push(score); }
                 } else { console.warn(`[DEBUG PUT /api/music/${id}] Skipping incomplete score data:`, score); }
             });
         } else { console.log(`[DEBUG PUT /api/music/${id}] No valid scores array received or array is empty.`); } // Log 7

         const existingScoresResult = await client.query('SELECT id FROM scores WHERE music_id = $1', [id]);
         const existingScoreIds = new Set(existingScoresResult.rows.map(r => r.id));
         console.log(`[DEBUG PUT /api/music/${id}] Existing score IDs in DB:`, [...existingScoreIds]); // Log 8
         console.log(`[DEBUG PUT /api/music/${id}] Incoming score IDs from request:`, [...incomingScoreIds]); // Log 9

         const scoreIdsToDelete = [...existingScoreIds].filter(existingId => !incomingScoreIds.has(existingId));
         if (scoreIdsToDelete.length > 0) {
             const deleteQuery = `DELETE FROM scores WHERE id = ANY($1::int[])`;
             console.log(`[DEBUG PUT /api/music/${id}] Deleting score IDs:`, scoreIdsToDelete); // Log 10
             await client.query(deleteQuery, [scoreIdsToDelete]);
         }
         if (scoresToUpdate.length > 0) {
             const updateQuery = `UPDATE scores SET type = $1, pdf_url = $2, display_order = $3, updated_at = NOW() WHERE id = $4 AND music_id = $5;`;
             console.log(`[DEBUG PUT /api/music/${id}] Updating ${scoresToUpdate.length} scores.`); // Log 11
             for (const score of scoresToUpdate) {
                 if (existingScoreIds.has(parseInt(score.id, 10))) {
                     console.log(`[DEBUG PUT /api/music/${id}] Updating score ID ${score.id} with data:`, score); // Log 12
                     await client.query(updateQuery, [score.type, score.pdf_url, score.display_order || 0, score.id, id]);
                 } else { console.warn(`[DEBUG PUT /api/music/${id}] Attempted to update score ID ${score.id} which does not belong to music ID ${id} or was marked for deletion. Skipping.`); } // Log 13
             }
         }
         if (scoresToInsert.length > 0) {
             const insertQuery = `INSERT INTO scores (music_id, type, pdf_url, display_order) VALUES ($1, $2, $3, $4);`;
              console.log(`[DEBUG PUT /api/music/${id}] Inserting ${scoresToInsert.length} new scores.`); // Log 14
             for (const score of scoresToInsert) {
                  console.log(`[DEBUG PUT /api/music/${id}] Inserting new score with data:`, score); // Log 15
                 await client.query(insertQuery, [id, score.type, score.pdf_url, score.display_order || 0]);
             }
         }
        console.log(`[DEBUG PUT /api/music/${id}] Attempting to COMMIT transaction.`); // Log 16
        await client.query('COMMIT');
        console.log(`[DEBUG PUT /api/music/${id}] Transaction COMMITTED successfully.`); // Log 17
         const finalScoresResult = await pool.query('SELECT id, type, pdf_url, display_order FROM scores WHERE music_id = $1 ORDER BY display_order ASC, type ASC', [id]);
         updatedMusic.scores = finalScoresResult.rows;
        res.json(updatedMusic);
    } catch (err) {
        console.error(`[DEBUG PUT /api/music/${id}] Error occurred, rolling back transaction. Error:`, err.stack || err); // Log 18
         if (!res.headersSent) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: '更新音樂時發生內部伺服器錯誤' });
        }
    } finally {
         console.log(`[DEBUG PUT /api/music/${id}] Releasing client.`); // Log 19
        client.release();
    }
});

// DELETE /api/music/:id
app.delete('/api/music/:id', async (req, res) => { // basicAuthMiddleware 已在上面 app.use 中應用
    const { id } = req.params;
    // 驗證邏輯 ... (省略以保持簡潔)
    try {
        const result = await pool.query('DELETE FROM music WHERE id = $1', [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到音樂項目，無法刪除。' }); }
        res.status(204).send();
    } catch (err) { console.error(`刪除音樂 ID ${id} 時出錯：`, err.stack || err); res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' }); }
});

// --- 消息管理 API (受保護) ---
// POST /api/news
app.post('/api/news', async (req, res) => { // basicAuthMiddleware 已在上面 app.use 中應用
    const { title, event_date, summary, content, thumbnail_url, image_url } = req.body;
    // 驗證邏輯 ... (省略以保持簡潔)
    try {
        const result = await pool.query(`INSERT INTO news (title, event_date, summary, content, thumbnail_url, image_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`, [ title, event_date || null, summary || null, content || null, thumbnail_url || null, image_url || null ]);
        res.status(201).json(result.rows[0]);
    } catch (err) { console.error('新增消息時出錯:', err); res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' }); }
});
// PUT /api/news/:id
app.put('/api/news/:id', async (req, res) => { // basicAuthMiddleware 已在上面 app.use 中應用
    const { id } = req.params;
    const { title, event_date, summary, content, thumbnail_url, image_url } = req.body;
    // 驗證邏輯 ... (省略以保持簡潔)
    try {
        const result = await pool.query(`UPDATE news SET title = $1, event_date = $2, summary = $3, content = $4, thumbnail_url = $5, image_url = $6, updated_at = NOW() WHERE id = $7 RETURNING *`, [ title, event_date || null, summary || null, content || null, thumbnail_url || null, image_url || null, id ]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到消息，無法更新。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) { console.error(`更新消息 ID ${id} 時出錯:`, err); res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' }); }
});
// DELETE /api/news/:id
app.delete('/api/news/:id', async (req, res) => { // basicAuthMiddleware 已在上面 app.use 中應用
    const { id } = req.params;
    // 驗證邏輯 ... (省略以保持簡潔)
    try {
        const result = await pool.query('DELETE FROM news WHERE id = $1', [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到消息，無法刪除。' }); }
        res.status(204).send();
    } catch (err) { console.error(`刪除消息 ID ${id} 時出錯:`, err); res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' }); }
});


// --- 新聞詳情頁面路由 ---
app.get('/news/:id(\\d+)', (req, res, next) => {
    // 可以在這裡先檢查 ID 是否存在，如果不存在可以提前返回 404
    // 但目前讓 news-detail.js 去處理 API 請求的 404 也可以
    res.sendFile(path.join(__dirname, 'public', 'news-detail.html'));
});

// --- 樂譜中心頁面路由 ---
app.get('/scores', (req, res) => {
     res.sendFile(path.join(__dirname, 'public', 'scores.html'));
});


// --- 404 處理 ---
// 這個應該是最後的路由處理
app.use((req, res, next) => {
    // 檢查請求是否是針對已知的前端路由
    const knownFrontendRoutes = ['/', '/index.html', '/music.html', '/news.html', '/scores.html', '/admin.html', '/music-admin.html', '/news-admin.html', '/banner-admin.html'];
    if (knownFrontendRoutes.includes(req.path) || req.path.match(/^\/news\/\d+$/)) {
        // 如果是已知前端路由但前面沒有匹配到（例如直接訪問 /music），
        // 並且請求 accept html，則返回對應的 html 文件
        // 這裡的邏輯可能需要根據你的具體需求調整，目前是假設靜態服務會處理 .html 結尾的
         if (req.accepts('html')) {
             // 嘗試找到對應的 html 文件，如果找不到，則最終還是 404
             const filePath = path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path);
             // 注意：這裡不直接 sendFile，讓 express.static 處理或最終落到下面的 404
             return next();
         }
    }

    // 對於 API 或其他未匹配的請求，返回 404
    console.log(`[404 Handler] Path not found: ${req.method} ${req.originalUrl}`);
    res.status(404).send('抱歉，找不到您要訪問的頁面。');
});


// --- 全局錯誤處理 ---
app.use((err, req, res, next) => {
    console.error("全局錯誤處理:", err.stack || err);
    // 避免在已經發送標頭後再次發送
    if (res.headersSent) {
        return next(err); // 交給 Express 預設處理
    }
    res.status(err.status || 500).send(process.env.NODE_ENV === 'production' ? '伺服器發生了一些問題！' : `伺服器錯誤: ${err.message}`);
});

// --- 啟動伺服器 ---
app.listen(PORT, () => {
    console.log(`伺服器正在監聽 port ${PORT}`);
    pool.query('SELECT NOW()')
        .then(result => {
            if (result && result.rows.length > 0) {
                console.log('資料庫連接成功於', result.rows[0].now);
            } else {
                 console.log('資料庫已連接，但無法獲取時間。');
            }
        })
        .catch(err => {
             console.error('資料庫連接錯誤:', err.stack || err);
        });
});