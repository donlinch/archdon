// server.js
require('dotenv').config();
const https = require('https');
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 資料庫連接池設定 ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// --- 基本認證中間件 ---
const basicAuthMiddleware = (req, res, next) => {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'password';
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send('需要認證才能訪問管理區域。');
    }
    try {
        const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const user = auth[0]; const pass = auth[1];
        if (user === adminUser && pass === adminPass) {
            next();
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

// --- 中間件 ---
app.use(express.json()); // 解析 JSON 請求體

// --- 記錄 Page View 中間件 ---
app.use(async (req, res, next) => {
    const pathsToLog = ['/', '/index.html', '/music.html', '/news.html', '/scores.html'];
    const shouldLog = pathsToLog.includes(req.path) && req.method === 'GET';
    if (shouldLog) {
        const pagePath = req.path;
        // console.log(`[PV Mid] Logging view for: ${pagePath}`); // 詳細日誌
        try {
            const sql = `INSERT INTO page_views (page, view_date, view_count) VALUES ($1, CURRENT_DATE, 1) ON CONFLICT (page, view_date) DO UPDATE SET view_count = page_views.view_count + 1;`;
            await pool.query(sql, [pagePath]);
        } catch (err) {
            if (err.code === '23505' || err.message.includes('ON CONFLICT DO UPDATE command cannot affect row a second time')) {
                console.warn(`[PV Mid] CONFLICT/Race condition for ${pagePath}. Handled.`);
            } else { console.error('[PV Mid] Error logging page view:', err.stack || err); }
        }
    }
    next();
});

// --- 靜態文件服務 ---
app.use(express.static(path.join(__dirname, 'public')));

// --- 公開 API Routes ---

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
    const pageLocation = req.query.page;
    console.log(`[Public API] GET /api/banners requested for page: ${pageLocation || 'all'}`);
    try {
        let queryText = 'SELECT id, image_url, link_url, alt_text FROM banners';
        const queryParams = [];
        if (pageLocation) {
            queryText += ' WHERE page_location = $1';
            queryParams.push(pageLocation);
        }
        queryText += ' ORDER BY display_order ASC, id ASC';
        const result = await pool.query(queryText, queryParams);
        console.log(`[Public API] Found ${result.rowCount} banners for page: ${pageLocation || 'all'}`);
        res.json(result.rows);
    } catch (err) {
        console.error(`[Public API Error] 獲取 Banner (page: ${pageLocation || 'all'}) 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET /api/products?sort=...
// 修改: GET /api/products (獲取列表，包含規格名稱和庫存)
app.get('/api/products', async (req, res) => {
    const sortBy = req.query.sort || 'latest';
    let orderByClause = 'ORDER BY p.created_at DESC, p.id DESC';
    if (sortBy === 'popular') {
        orderByClause = 'ORDER BY p.click_count DESC, p.created_at DESC, p.id DESC';
    }

    try {
        // 使用 LEFT JOIN 和 JSON_AGG 來聚合每個商品的規格資訊
        const queryText = `
            SELECT
                p.id,
                p.name,
                p.description,
                p.price,
                p.image_url,
                p.seven_eleven_url,
                p.click_count,
                -- **修改: 使用 JSON_AGG 聚合規格物件**
                COALESCE(
                    (SELECT json_agg(json_build_object('name', pv.name, 'inventory_count', pv.inventory_count) ORDER BY pv.name ASC)
                     FROM product_variations pv
                     WHERE pv.product_id = p.id),
                    '[]'::json
                ) AS variations
            FROM products p
            ${orderByClause};
        `;
        // json_build_object('name', pv.name, 'inventory_count', pv.inventory_count) 創建包含名稱和庫存的 JSON 物件
        // json_agg(...) 將這些物件聚合成一個 JSON 陣列
        // ORDER BY pv.name ASC 確保規格按名稱排序
        // COALESCE(..., '[]'::json) 如果沒有規格，返回一個空 JSON 陣列

        const result = await pool.query(queryText);
        res.json(result.rows); // 返回的每筆商品數據現在會包含 variations 陣列 [{name: 'S', inventory_count: 10}, ...]
    } catch (err) {
        console.error('獲取商品列表 (含規格詳情) 時出錯:', err);
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

// GET /api/news?page=...&limit=...
app.get('/api/news', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    if (page <= 0 || limit <= 0) { return res.status(400).json({ error: '頁碼和每頁數量必須是正整數。' }); }
    const offset = (page - 1) * limit;
    try {
        const countResult = await pool.query('SELECT COUNT(*) FROM news');
        const totalItems = parseInt(countResult.rows[0].count);
        const newsResult = await pool.query(`SELECT id, title, event_date, summary, thumbnail_url, like_count, updated_at FROM news ORDER BY updated_at DESC, id DESC LIMIT $1 OFFSET $2`, [limit, offset]); // 添加 id 排序
        const totalPages = Math.ceil(totalItems / limit);
        res.status(200).json({ totalItems, totalPages, currentPage: page, limit, news: newsResult.rows });
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
app.use(['/admin.html', '/music-admin.html', '/news-admin.html', '/banner-admin.html', '/inventory-admin.html', '/figures-admin.html'], basicAuthMiddleware);
app.use(['/api/admin', '/api/analytics'], basicAuthMiddleware); // 保護 /api/admin/*

// --- START: server.js modification for GET /api/admin/figures ---
// GET /api/admin/figures - 獲取所有公仔列表 (包含規格和顯示狀態，並排序)
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
                f.is_displayed, -- <--- 加入 is_displayed
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
            ORDER BY f.is_displayed DESC, f.created_at DESC; -- <--- 修改排序: 顯示優先，再按創建時間
        `;
        const result = await pool.query(queryText);
        console.log(`[Admin API] Found ${result.rowCount} figures.`);
        res.json(result.rows);
    } catch (err) {
        console.error('[Admin API Error] 獲取公仔列表時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取公仔列表時發生伺服器內部錯誤' });
    }
});
// --- END: server.js modification for GET /api/admin/figures ---

// --- START: server.js modification for POST /api/admin/figures ---
// POST /api/admin/figures - 新增公仔及其規格 (包含顯示狀態)
app.post('/api/admin/figures', async (req, res) => {
    // 從 request body 解構出 is_displayed
    const { name, image_url, purchase_price, selling_price, ordering_method, variations, is_displayed } = req.body;
    console.log("[Admin API] POST /api/admin/figures received:", req.body);

    // 基本驗證... (保持不變)
    if (!name) { return res.status(400).json({ error: '公仔名稱為必填項。' }); }
    if (variations && !Array.isArray(variations)) { return res.status(400).json({ error: '規格資料格式必須是陣列。' }); }
    // 驗證 is_displayed (可選，但建議確保是布林值)
    const displayStatus = typeof is_displayed === 'boolean' ? is_displayed : true; // 預設為 true

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // 開始交易

        // 1. 插入公仔基本資料 (加入 is_displayed)
        const figureInsertQuery = `
            INSERT INTO figures (name, image_url, purchase_price, selling_price, ordering_method, is_displayed)
            VALUES ($1, $2, $3, $4, $5, $6) -- <--- 增加 $6
            RETURNING *; -- 返回插入的整筆資料
        `;
        const figureResult = await client.query(figureInsertQuery, [
            name,
            image_url || null,
            purchase_price || 0,
            selling_price || 0,
            ordering_method || null,
            displayStatus // <--- 傳入 is_displayed 值
        ]);
        const newFigure = figureResult.rows[0];
        const newFigureId = newFigure.id;
        console.log(`[Admin API] Inserted figure with ID: ${newFigureId}, Displayed: ${displayStatus}`);

        // 2. 插入公仔規格資料 (如果有的話) ... (保持不變)
        let insertedVariations = [];
        if (variations && variations.length > 0) {
            // ... (規格插入邏輯不變) ...
             const variationInsertQuery = `
                INSERT INTO figure_variations (figure_id, name, quantity)
                VALUES ($1, $2, $3)
                RETURNING *; -- 返回插入的規格資料
            `;
            for (const variation of variations) {
                if (!variation.name || variation.quantity === undefined || variation.quantity === null) { throw new Error(`規格 "${variation.name || '未命名'}" 缺少名稱或數量。`); }
                const quantity = parseInt(variation.quantity);
                if (isNaN(quantity) || quantity < 0) { throw new Error(`規格 "${variation.name}" 的數量必須是非負整數。`); }
                console.log(`[Admin API] Inserting variation for figure ${newFigureId}: Name=${variation.name}, Quantity=${quantity}`);
                const variationResult = await client.query(variationInsertQuery, [ newFigureId, variation.name.trim(), quantity ]);
                insertedVariations.push(variationResult.rows[0]);
            }
        }

        await client.query('COMMIT'); // 提交交易
        console.log(`[Admin API] Transaction committed for new figure ID: ${newFigureId}`);

        newFigure.variations = insertedVariations; // 將新增的規格附加到回傳的公仔物件
        res.status(201).json(newFigure); // 回傳 201 Created 和新增的公仔資料

    } catch (err) {
        // ... (錯誤處理和回滾邏輯不變) ...
         await client.query('ROLLBACK'); // 出錯時回滾交易
         console.error('[Admin API Error] 新增公仔及其規格時出錯:', err.stack || err);
         if (err.code === '23505' && err.constraint === 'figure_variations_figure_id_name_key') {
              res.status(409).json({ error: `新增失敗：同一個公仔下不能有重複的規格名稱。錯誤詳情: ${err.detail}` });
         } else {
             res.status(500).json({ error: `新增公仔過程中發生錯誤: ${err.message}` });
         }
    } finally {
        client.release(); // 釋放客戶端連接回連接池
    }
});
// --- END: server.js modification for POST /api/admin/figures ---


// --- START: server.js modification for PUT /api/admin/figures/:id ---
// PUT /api/admin/figures/:id - 更新公仔及其規格 (包含顯示狀態)
app.put('/api/admin/figures/:id', async (req, res) => {
    const { id } = req.params;
    // 從 request body 解構出 is_displayed
    const { name, image_url, purchase_price, selling_price, ordering_method, variations, is_displayed } = req.body;
    console.log(`[Admin API] PUT /api/admin/figures/${id} received:`, req.body);

    // 基本驗證... (保持不變)
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的公仔 ID 格式。' }); }
    if (!name) { return res.status(400).json({ error: '公仔名稱為必填項。' }); }
    if (variations && !Array.isArray(variations)) { return res.status(400).json({ error: '規格資料格式必須是陣列。' }); }
    // 驗證 is_displayed (同上)
    const displayStatus = typeof is_displayed === 'boolean' ? is_displayed : true; // 更新時也給個預設，雖然前端應該會傳

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 更新公仔基本資料 (加入 is_displayed)
        const figureUpdateQuery = `
            UPDATE figures
            SET name = $1, image_url = $2, purchase_price = $3, selling_price = $4, ordering_method = $5, is_displayed = $6, updated_at = NOW() -- <--- 加入 is_displayed = $6
            WHERE id = $7 -- <--- WHERE 子句的參數索引 +1
            RETURNING *;
        `;
        const figureResult = await client.query(figureUpdateQuery, [
            name, image_url || null, purchase_price || 0, selling_price || 0, ordering_method || null, displayStatus, id // <--- 加入 displayStatus 參數
        ]);

        if (figureResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到要更新的公仔。' });
        }
        const updatedFigure = figureResult.rows[0];
        console.log(`[Admin API] Updated figure basics for ID: ${id}, Displayed: ${displayStatus}`);

        // 2. 處理規格 (更新、新增、刪除) ... (保持不變)
        // ... (規格處理邏輯不變) ...
        const variationsToProcess = variations || [];
        const incomingVariationIds = new Set(variationsToProcess.filter(v => v.id).map(v => parseInt(v.id)));
        const existingVariationsResult = await client.query('SELECT id FROM figure_variations WHERE figure_id = $1', [id]);
        const existingVariationIds = new Set(existingVariationsResult.rows.map(r => r.id));
        const variationIdsToDelete = [...existingVariationIds].filter(existingId => !incomingVariationIds.has(existingId));
        if (variationIdsToDelete.length > 0) {
            const deleteQuery = `DELETE FROM figure_variations WHERE id = ANY($1::int[])`;
            await client.query(deleteQuery, [variationIdsToDelete]);
        }
        const variationUpdateQuery = `UPDATE figure_variations SET name = $1, quantity = $2, updated_at = NOW() WHERE id = $3 AND figure_id = $4`;
        const variationInsertQuery = `INSERT INTO figure_variations (figure_id, name, quantity) VALUES ($1, $2, $3) RETURNING *`;
        let finalVariations = [];
        for (const variation of variationsToProcess) {
            if (!variation.name || variation.quantity === undefined || variation.quantity === null) { throw new Error(`規格 "${variation.name || '未提供'}" 缺少名稱或數量。`); }
            const quantity = parseInt(variation.quantity);
            if (isNaN(quantity) || quantity < 0) { throw new Error(`規格 "${variation.name}" 的數量必須是非負整數。`); }
            const variationId = variation.id ? parseInt(variation.id) : null;
             if (variationId && existingVariationIds.has(variationId)) {
                await client.query(variationUpdateQuery, [variation.name.trim(), quantity, variationId, id]);
                 finalVariations.push({ id: variationId, name: variation.name.trim(), quantity: quantity });
            } else {
                const insertResult = await client.query(variationInsertQuery, [id, variation.name.trim(), quantity]);
                 finalVariations.push(insertResult.rows[0]);
            }
        }

        await client.query('COMMIT');
        console.log(`[Admin API] Transaction committed for updating figure ID: ${id}`);

        // 整理返回的數據
        updatedFigure.variations = finalVariations.sort((a, b) => a.name.localeCompare(b.name)); // 按名稱排序
        res.status(200).json(updatedFigure);

    } catch (err) {
        // ... (錯誤處理和回滾邏輯不變) ...
         await client.query('ROLLBACK');
        console.error(`[Admin API Error] 更新公仔 ID ${id} 時出錯:`, err.stack || err);
        if (err.code === '23505' && err.constraint === 'figure_variations_figure_id_name_key') {
             res.status(409).json({ error: `更新失敗：同一個公仔下不能有重複的規格名稱。錯誤詳情: ${err.detail}` });
        } else {
            res.status(500).json({ error: `更新公仔過程中發生錯誤: ${err.message}` });
        }
    } finally {
        client.release();
    }
});
// --- END: server.js modification for PUT /api/admin/figures/:id ---



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

// --- Banner 管理 API ---


// *** 新增：GET /api/admin/banners/:id (獲取單一 Banner) ***
app.get('/api/admin/banners/:id', basicAuthMiddleware, async (req, res) => { // <-- 添加 middleware
    const { id } = req.params;
    console.log(`[Admin API] GET /api/admin/banners/${id} request received`);
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    try {
        const result = await pool.query(
            `SELECT id, image_url, link_url, display_order, alt_text, page_location
             FROM banners WHERE id = $1`, // 包含 page_location
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

// POST /api/admin/banners (新增 Banner)
app.post('/api/admin/banners', basicAuthMiddleware, async (req, res) => { // <-- 添加 middleware
    console.log("[Admin API] POST /api/admin/banners request received");
    // *** 修改：包含 page_location ***
    const { image_url, link_url, display_order, alt_text, page_location } = req.body;
    // 驗證...
    if (!image_url) return res.status(400).json({ error: '圖片網址不能為空。'});
    if (!page_location) return res.status(400).json({ error: '必須指定顯示頁面。'});
    const order = display_order !== null ? parseInt(display_order) : 0;
    if (isNaN(order)) return res.status(400).json({ error: '排序必須是數字。'});
    // URL 驗證...
    try {
        // *** 修改：加入 page_location ***
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

// PUT /api/admin/banners/:id (更新 Banner)
app.put('/api/admin/banners/:id', basicAuthMiddleware, async (req, res) => { // <-- 添加 middleware
    const { id } = req.params;
    console.log(`[Admin API] PUT /api/admin/banners/${id} request received`);
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    // *** 修改：包含 page_location ***
    const { image_url, link_url, display_order, alt_text, page_location } = req.body;
    // 驗證...
    if (!image_url) return res.status(400).json({ error: '圖片網址不能為空。'});
    if (!page_location) return res.status(400).json({ error: '必須指定顯示頁面。'});
    const order = display_order !== null ? parseInt(display_order) : 0;
    if (isNaN(order)) return res.status(400).json({ error: '排序必須是數字。'});
    // URL 驗證...
    try {
        // *** 修改：加入 page_location ***
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

// DELETE /api/admin/banners/:id (刪除 Banner)
app.delete('/api/admin/banners/:id', basicAuthMiddleware, async (req, res) => { // <-- 添加 middleware
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







// GET /api/admin/products (獲取列表，包含總庫存和規格 ID)
app.get('/api/admin/products', async (req, res) => { // basicAuthMiddleware 由上面的 app.use 保護
    const sortBy = req.query.sort || 'latest';
    let orderByClause = 'ORDER BY p.created_at DESC, p.id DESC';
    if (sortBy === 'popular') {
        orderByClause = 'ORDER BY p.click_count DESC, p.created_at DESC, p.id DESC';
    }
    try {
        const queryText = `
            SELECT
                p.id, p.name, p.description, p.price, p.image_url, p.seven_eleven_url, p.click_count,
                COALESCE(SUM(pv.inventory_count), 0)::integer AS total_inventory,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', pv.id, 
                            'name', pv.name, 
                            'inventory_count', pv.inventory_count
                        ) ORDER BY pv.name ASC
                    ) FILTER (WHERE pv.id IS NOT NULL),
                    '[]'::json
                ) AS variations
            FROM products p
            LEFT JOIN product_variations pv ON p.id = pv.product_id
            GROUP BY p.id
            ${orderByClause}
        `;
        const result = await pool.query(queryText);
        res.json(result.rows); 
    } catch (err) {
        console.error('獲取商品列表 (管理員) 時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET /api/admin/products/:id (獲取單一商品，包含規格和總庫存)
app.get('/api/admin/products/:id', async (req, res) => { // basicAuthMiddleware 由上面的 app.use 保護
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的商品 ID 格式。' }); }
    try {
        // 先獲取商品基本資料
        const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        if (productResult.rows.length === 0) { return res.status(404).json({ error: '找不到商品。' }); }
        const product = productResult.rows[0];
        
        // 再獲取規格資料
        const variationsResult = await pool.query(
            'SELECT id, name, sku, inventory_count FROM product_variations WHERE product_id = $1 ORDER BY name ASC',
            [id]
        );
        product.variations = variationsResult.rows;

        // 計算總庫存
        let totalInventory = 0;
        if (product.variations && product.variations.length > 0) {
            totalInventory = product.variations.reduce((sum, variation) => {
                const count = Number(variation.inventory_count); 
                return sum + (isNaN(count) ? 0 : count);
            }, 0);
        }
        product.total_inventory = totalInventory; 

        res.json(product);
    } catch (err) { 
        console.error(`獲取商品 ID ${id} (管理員) 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});


// **修改: POST /api/products (新增商品及規格 - 受保護)**
app.post('/api/products', basicAuthMiddleware, async (req, res) => {
    const { name, description, price, image_url, seven_eleven_url, variations } = req.body;

    // 基本驗證
    if (!name || price === undefined || price === null) {
        return res.status(400).json({ error: '商品名稱和價格為必填項。' });
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
        return res.status(400).json({ error: '價格必須是非負數字。' });
    }
    if (variations && !Array.isArray(variations)) {
        return res.status(400).json({ error: '規格資料格式必須是陣列。' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 插入商品基本資料
        const productInsertQuery = `
            INSERT INTO products (name, description, price, image_url, seven_eleven_url, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING id;
        `;
        const productResult = await client.query(productInsertQuery, [
            name, description || null, price, image_url || null, seven_eleven_url || null
        ]);
        const newProductId = productResult.rows[0].id;
        console.log(`新增商品成功，ID: ${newProductId}`);

        // 2. 插入商品規格資料 (如果有的話)
        let insertedVariations = [];
        if (variations && variations.length > 0) {
            const variationInsertQuery = `
                INSERT INTO product_variations (product_id, name, inventory_count, sku, created_at, updated_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                RETURNING *;
            `;
            for (const variation of variations) {
                // 規格驗證
                if (!variation.name || variation.inventory_count === undefined || variation.inventory_count === null) {
                    throw new Error(`規格 "${variation.name || '未命名'}" 缺少名稱或初始庫存。`);
                }
                const inventoryCount = parseInt(variation.inventory_count);
                if (isNaN(inventoryCount) || inventoryCount < 0) {
                    throw new Error(`規格 "${variation.name}" 的庫存必須是非負整數。`);
                }
                const sku = variation.sku ? variation.sku.trim() : null;

                const variationResult = await client.query(variationInsertQuery, [
                    newProductId, variation.name.trim(), inventoryCount, sku
                ]);
                insertedVariations.push(variationResult.rows[0]);
                console.log(`新增規格 "${variation.name}" for product ${newProductId}`);
            }
        }

        await client.query('COMMIT');
        console.log(`交易成功提交 for product ${newProductId}`);

        // 返回新增的商品資料及規格
        const finalProductResult = await client.query('SELECT * FROM products WHERE id = $1', [newProductId]);
        const finalProduct = finalProductResult.rows[0];
        finalProduct.variations = insertedVariations; // 使用插入時返回的規格資料

        res.status(201).json(finalProduct);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('新增商品及規格時出錯:', err);
        res.status(500).json({ error: `新增過程中發生錯誤: ${err.message}` }); // 返回更詳細的錯誤
    } finally {
        client.release();
    }
});

// **修改: PUT /api/products/:id (更新商品及規格 - 受保護)**
app.put('/api/products/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, description, price, image_url, seven_eleven_url, variations } = req.body;

    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的商品 ID 格式。' }); }
    // 基本驗證
    if (!name || price === undefined || price === null) { return res.status(400).json({ error: '商品名稱和價格為必填項。' }); }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) { return res.status(400).json({ error: '價格必須是非負數字。' }); }
    if (variations && !Array.isArray(variations)) { return res.status(400).json({ error: '規格資料格式必須是陣列。' }); }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 更新商品基本資料
        const productUpdateQuery = `
            UPDATE products SET name = $1, description = $2, price = $3, image_url = $4, seven_eleven_url = $5, updated_at = NOW()
            WHERE id = $6
            RETURNING *;
        `;
        const productResult = await client.query(productUpdateQuery, [ name, description || null, price, image_url || null, seven_eleven_url || null, id ]);

        if (productResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到商品，無法更新。' });
        }
        console.log(`商品 ${id} 基本資料更新成功`);

        // 2. 處理規格 (更新、新增、刪除)
        const variationsToProcess = variations || [];
        const incomingVariationIds = new Set(variationsToProcess.filter(v => v.id).map(v => parseInt(v.id)));

        // 獲取目前資料庫中的規格 ID
        const existingVariationsResult = await client.query('SELECT id FROM product_variations WHERE product_id = $1', [id]);
        const existingVariationIds = new Set(existingVariationsResult.rows.map(r => r.id));
        console.log(`Product ${id}: Existing variation IDs:`, [...existingVariationIds]);
        console.log(`Product ${id}: Incoming variation IDs:`, [...incomingVariationIds]);


        // 找出需要刪除的規格 (存在於 DB 但不在請求中)
        const variationIdsToDelete = [...existingVariationIds].filter(existingId => !incomingVariationIds.has(existingId));
        if (variationIdsToDelete.length > 0) {
             // 在刪除前檢查是否有銷售記錄關聯 (如果 ON DELETE RESTRICT)
             const checkSalesQuery = `SELECT 1 FROM sales_logs WHERE variation_id = ANY($1::int[]) LIMIT 1`;
             const salesCheckResult = await client.query(checkSalesQuery, [variationIdsToDelete]);
             if (salesCheckResult.rowCount > 0) {
                 await client.query('ROLLBACK');
                 return res.status(409).json({ error: `無法刪除規格，因為其有關聯的銷售記錄。請先處理銷售記錄。涉及的規格 ID: ${variationIdsToDelete.join(', ')}` });
             }

            const deleteQuery = `DELETE FROM product_variations WHERE id = ANY($1::int[])`;
            console.log(`Product ${id}: Deleting variation IDs:`, variationIdsToDelete);
            await client.query(deleteQuery, [variationIdsToDelete]);
        }

        // 遍歷請求中的規格進行更新或新增
        const variationUpdateQuery = `UPDATE product_variations SET name = $1, inventory_count = $2, sku = $3, updated_at = NOW() WHERE id = $4 AND product_id = $5`;
        const variationInsertQuery = `INSERT INTO product_variations (product_id, name, inventory_count, sku, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())`;

        for (const variation of variationsToProcess) {
            // 驗證規格資料
            if (!variation.name || variation.inventory_count === undefined || variation.inventory_count === null) { throw new Error(`規格 "${variation.name || '未提供'}" 缺少名稱或庫存。`); }
            const inventoryCount = parseInt(variation.inventory_count);
            if (isNaN(inventoryCount) || inventoryCount < 0) { throw new Error(`規格 "${variation.name}" 的庫存必須是非負整數。`); }
            const sku = variation.sku ? variation.sku.trim() : null;
            const variationId = variation.id ? parseInt(variation.id) : null;

            if (variationId && existingVariationIds.has(variationId)) {
                // 更新現有規格
                 console.log(`Product ${id}: Updating variation ID ${variationId} with name=${variation.name}, inv=${inventoryCount}`);
                await client.query(variationUpdateQuery, [variation.name.trim(), inventoryCount, sku, variationId, id]);
            } else {
                // 新增規格
                 console.log(`Product ${id}: Inserting new variation with name=${variation.name}, inv=${inventoryCount}`);
                await client.query(variationInsertQuery, [id, variation.name.trim(), inventoryCount, sku]);
            }
        }

        await client.query('COMMIT');
        console.log(`商品 ${id} 及規格更新交易成功提交`);

        // 重新獲取更新後的商品及規格資料返回
        const finalProductResult = await client.query('SELECT * FROM products WHERE id = $1', [id]);
        const finalVariationsResult = await client.query('SELECT * FROM product_variations WHERE product_id = $1 ORDER BY name ASC', [id]);
        const updatedProduct = finalProductResult.rows[0];
        updatedProduct.variations = finalVariationsResult.rows;

        res.status(200).json(updatedProduct);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`更新商品 ID ${id} 及規格時出錯:`, err);
        res.status(500).json({ error: `更新過程中發生錯誤: ${err.message}` });
    } finally {
        client.release();
    }
});


// **修改: DELETE /api/products/:id (刪除商品 - 受保護)**
app.delete('/api/products/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的商品 ID 格式。' }); }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // 由於 product_variations 表設置了 ON DELETE CASCADE，刪除 products 會自動刪除關聯的 variations
        // 但 sales_logs 設置了 ON DELETE RESTRICT，如果有關聯記錄，刪除 variations 會失敗
        // 所以需要先檢查 sales_logs
        const checkSalesQuery = `SELECT 1 FROM sales_logs sl JOIN product_variations pv ON sl.variation_id = pv.id WHERE pv.product_id = $1 LIMIT 1`;
        const salesCheckResult = await client.query(checkSalesQuery, [id]);
        if (salesCheckResult.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `無法刪除商品，因為其規格有關聯的銷售記錄。請先處理銷售記錄。` });
        }

        // 先刪除 product_variations (如果沒有設定 CASCADE，或者想手動控制)
        // await client.query('DELETE FROM product_variations WHERE product_id = $1', [id]);

        // 然後刪除 products
        const result = await client.query('DELETE FROM products WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到商品，無法刪除。' });
        }

        await client.query('COMMIT');
        console.log(`商品 ${id} 及關聯規格 (如果設置了 CASCADE) 已刪除`);
        res.status(204).send();

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`刪除商品 ID ${id} 時出錯:`, err);
        // 檢查是否是外鍵約束錯誤
        if (err.code === '23503') { // Foreign key violation
             res.status(409).json({ error: '無法刪除，可能存在關聯數據（例如銷售記錄）。' });
        } else {
             res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' });
        }
    } finally {
        client.release();
    }
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


app.put('/api/admin/variations/:variationId', basicAuthMiddleware, async (req, res) => {
    const { variationId } = req.params;
    const { inventory_count } = req.body; // 只接受 inventory_count
    // 嚴格驗證輸入
    if (isNaN(parseInt(variationId)) || inventory_count === undefined || inventory_count === null || isNaN(parseInt(inventory_count)) || parseInt(inventory_count) < 0) {
        return res.status(400).json({ error: '無效的規格 ID 或庫存數量（必須是非負整數）。' });
    }
    const newInventoryCount = parseInt(inventory_count); // 確保是整數

    try {
        const result = await pool.query(
            'UPDATE product_variations SET inventory_count = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, inventory_count', // 返回更新後的資料
            [newInventoryCount, variationId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到指定的規格。' });
        }
        console.log(`規格 ${variationId} 庫存已更新為 ${newInventoryCount}`);
        res.json(result.rows[0]); // 返回更新後的規格資料
    } catch (err) {
        console.error(`更新規格 ${variationId} 庫存時出錯:`, err);
        res.status(500).json({ error: '更新庫存時發生內部伺服器錯誤。' });
    }
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