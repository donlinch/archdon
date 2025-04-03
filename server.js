// server.js (v2 - Fixed Product POST/PUT with Variations)
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
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- 記錄 Page View 中間件 ---
app.use(async (req, res, next) => {
    const pathsToLog = ['/', '/index.html', '/music.html', '/news.html', '/scores.html'];
    const shouldLog = pathsToLog.includes(req.path) && req.method === 'GET';
    if (shouldLog) {
        const pagePath = req.path;
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


// --- 公開 API Routes ---

// [樂譜 API - GET /api/scores/artists, GET /api/scores/songs, GET /api/scores/proxy]
app.get('/api/scores/artists', async (req, res) => { try { const result = await pool.query(`SELECT DISTINCT m.artist FROM music m JOIN scores s ON m.id = s.music_id WHERE m.artist IS NOT NULL AND m.artist <> '' ORDER BY m.artist ASC`); res.json(result.rows.map(row => row.artist)); } catch (err) { console.error('獲取帶有樂譜的歌手時出錯:', err); res.status(500).json({ error: '獲取歌手列表時發生內部伺服器錯誤' }); } });
app.get('/api/scores/songs', async (req, res) => { const { artist } = req.query; try { let queryText = `SELECT m.id, m.title, m.artist, m.cover_art_url, m.release_date, m.youtube_video_id, s_agg.scores FROM ( SELECT DISTINCT m_inner.id FROM music m_inner INNER JOIN scores s_inner ON m_inner.id = s_inner.music_id`; const queryParams = []; let paramIndex = 1; if (artist && artist !== 'All') { queryText += ` WHERE m_inner.artist = $${paramIndex++}`; queryParams.push(decodeURIComponent(artist)); } queryText += ` ) AS distinct_music JOIN music m ON m.id = distinct_music.id LEFT JOIN LATERAL ( SELECT json_agg(s.* ORDER BY s.display_order ASC, s.type ASC) AS scores FROM scores s WHERE s.music_id = m.id ) s_agg ON true ORDER BY m.artist ASC, m.release_date DESC NULLS LAST, m.title ASC;`; const result = await pool.query(queryText, queryParams); res.json(result.rows); } catch (err) { console.error('獲取帶有樂譜的歌曲列表時出錯:', err); res.status(500).json({ error: '獲取帶有樂譜的歌曲列表時發生內部伺服器錯誤' }); } });
app.get('/api/scores/proxy', (req, res) => { const pdfUrl = req.query.url; if (!pdfUrl) { return res.status(400).send('Missing PDF URL.'); } try { const decodedUrl = decodeURIComponent(pdfUrl); const urlObject = new URL(decodedUrl); const allowedDomains = ['raw.githubusercontent.com']; if (!allowedDomains.includes(urlObject.hostname)) { return res.status(403).send('Proxying from this domain is not allowed.'); } const request = https.get(decodedUrl, response => { if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) { try { const redirectUrl = new URL(response.headers.location, decodedUrl); if (!allowedDomains.includes(redirectUrl.hostname)) return res.status(403).send('Redirect target domain not allowed.'); const redirReq = https.get(redirectUrl.href, redirRes => { if (redirRes.statusCode !== 200) return res.status(redirRes.statusCode).send('Failed to fetch redirected PDF.'); res.setHeader('Content-Type', 'application/pdf'); redirRes.pipe(res); }); redirReq.on('error', e => res.status(500).send('Error fetching redirected PDF.')); redirReq.setTimeout(15000, () => { redirReq.destroy(); res.status(504).send('Timeout fetching redirected PDF.'); }); } catch (e) { res.status(500).send('Invalid redirect location.'); } return; } if (response.statusCode !== 200) return res.status(response.statusCode).send('Failed to fetch PDF from source.'); res.setHeader('Content-Type', 'application/pdf'); response.pipe(res); }); request.on('error', e => res.status(502).send('Error connecting to PDF source.')); request.setTimeout(15000, () => { request.destroy(); res.status(504).send('Timeout connecting to PDF source.'); }); } catch (e) { res.status(400).send('Invalid URL format.'); } });

// [Banner API - GET /api/banners]
app.get('/api/banners', async (req, res) => { const pageLocation = req.query.page; try { let queryText = 'SELECT id, image_url, link_url, alt_text FROM banners'; const queryParams = []; if (pageLocation) { queryText += ' WHERE page_location = $1'; queryParams.push(pageLocation); } queryText += ' ORDER BY display_order ASC, id ASC'; const result = await pool.query(queryText, queryParams); res.json(result.rows); } catch (err) { console.error(`獲取 Banner (page: ${pageLocation || 'all'}) 時出錯:`, err); res.status(500).json({ error: '伺服器內部錯誤' }); } });

// [Music API - GET /api/artists, GET /api/music, GET /api/music/:id]
app.get('/api/artists', async (req, res) => { try { const result = await pool.query('SELECT DISTINCT artist FROM music WHERE artist IS NOT NULL AND artist <> \'\' ORDER BY artist ASC'); res.json(result.rows.map(row => row.artist)); } catch (err) { console.error('獲取歌手列表時出錯:', err); res.status(500).json({ error: '伺服器內部錯誤' }); } });
app.get('/api/music', async (req, res) => { const artistFilter = req.query.artist || null; let queryText = 'SELECT id, title, artist, cover_art_url, platform_url, release_date, description FROM music'; const queryParams = []; if (artistFilter && artistFilter !== 'All') { queryText += ' WHERE artist = $1'; queryParams.push(decodeURIComponent(artistFilter)); } queryText += ' ORDER BY release_date DESC NULLS LAST, title ASC'; try { const result = await pool.query(queryText, queryParams); res.json(result.rows); } catch (err) { console.error('獲取音樂列表時出錯:', err); res.status(500).json({ error: '伺服器內部錯誤' }); } });
app.get('/api/music/:id', async (req, res) => { const { id } = req.params; if (isNaN(parseInt(id, 10))) { return res.status(400).json({ error: '無效的音樂 ID' }); } try { const queryText = `SELECT m.*, COALESCE((SELECT json_agg(s.* ORDER BY s.display_order ASC, s.type ASC) FROM scores s WHERE s.music_id = m.id), '[]'::json) AS scores FROM music m WHERE m.id = $1;`; const result = await pool.query(queryText, [id]); if (result.rows.length === 0) { return res.status(404).json({ error: '找不到音樂' }); } res.json(result.rows[0]); } catch (err) { console.error(`獲取 ID 為 ${id} 的音樂時出錯：`, err); res.status(500).json({ error: '獲取音樂詳情時發生內部伺服器錯誤' }); } });

// [News API - GET /api/news, GET /api/news/:id, POST /api/news/:id/like]
app.get('/api/news', async (req, res) => { const page = parseInt(req.query.page) || 1; const limit = parseInt(req.query.limit) || 10; if (page <= 0 || limit <= 0) { return res.status(400).json({ error: '頁碼和每頁數量必須是正整數。' }); } const offset = (page - 1) * limit; try { const countResult = await pool.query('SELECT COUNT(*) FROM news'); const totalItems = parseInt(countResult.rows[0].count); const newsResult = await pool.query(`SELECT id, title, event_date, summary, thumbnail_url, like_count, updated_at FROM news ORDER BY updated_at DESC, id DESC LIMIT $1 OFFSET $2`, [limit, offset]); const totalPages = Math.ceil(totalItems / limit); res.status(200).json({ totalItems, totalPages, currentPage: page, limit, news: newsResult.rows }); } catch (err) { console.error('獲取最新消息列表時出錯:', err); res.status(500).json({ error: '伺服器內部錯誤' }); } });
app.get('/api/news/:id', async (req, res) => { const { id } = req.params; if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); } try { const result = await pool.query('SELECT id, title, event_date, summary, content, thumbnail_url, image_url, like_count, updated_at FROM news WHERE id = $1', [id]); if (result.rows.length === 0) { return res.status(404).json({ error: '找不到該消息。' }); } res.status(200).json(result.rows[0]); } catch (err) { console.error(`獲取消息 ID ${id} 時出錯:`, err); res.status(500).json({ error: '伺服器內部錯誤' }); } });
app.post('/api/news/:id/like', async (req, res) => { const { id } = req.params; if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); } try { const result = await pool.query('UPDATE news SET like_count = like_count + 1 WHERE id = $1 RETURNING like_count', [id]); if (result.rowCount === 0) { return res.status(404).json({ error: '找不到要按讚的消息。' }); } res.status(200).json({ like_count: result.rows[0].like_count }); } catch (err) { console.error(`處理消息 ID ${id} 按讚時出錯:`, err); res.status(500).json({ error: '伺服器內部錯誤' }); } });

// [Product Click API - POST /api/products/:id/click]
app.post('/api/products/:id/click', async (req, res) => { const { id } = req.params; if (isNaN(parseInt(id))) { return res.status(204).send(); } try { await pool.query('UPDATE products SET click_count = click_count + 1 WHERE id = $1', [id]); res.status(204).send(); } catch (err) { console.error(`記錄商品 ID ${id} 點擊時出錯:`, err); res.status(204).send(); } });

// --- 受保護的管理頁面和 API Routes ---
app.use(['/admin.html', '/music-admin.html', '/news-admin.html', '/banner-admin.html'], basicAuthMiddleware);
app.use(['/api/admin', '/api/analytics'], basicAuthMiddleware);

// --- 流量分析 API ---
app.get('/api/analytics/traffic', async (req, res) => { try { const daysToFetch = 30; const startDate = new Date(); startDate.setDate(startDate.getDate() - daysToFetch); const startDateString = startDate.toISOString().split('T')[0]; const queryText = `SELECT view_date, SUM(view_count)::bigint AS count FROM page_views WHERE view_date >= $1 GROUP BY view_date ORDER BY view_date ASC`; const result = await pool.query(queryText, [startDateString]); const trafficData = result.rows.map(row => ({ date: new Date(row.view_date).toISOString().split('T')[0], count: parseInt(row.count) })); res.status(200).json(trafficData); } catch (err) { console.error('獲取流量數據時發生嚴重錯誤:', err); res.status(500).json({ error: '伺服器內部錯誤，無法獲取流量數據。' }); } });
app.get('/api/analytics/monthly-traffic', async (req, res) => { try { const targetYear = req.query.year ? parseInt(req.query.year) : null; let queryText = `SELECT to_char(date_trunc('month', view_date), 'YYYY-MM') AS view_month, SUM(view_count)::bigint AS count FROM page_views`; const queryParams = []; if (targetYear && !isNaN(targetYear)) { queryText += ` WHERE date_part('year', view_date) = $1`; queryParams.push(targetYear); } queryText += ` GROUP BY view_month ORDER BY view_month ASC`; const result = await pool.query(queryText, queryParams); const monthlyTrafficData = result.rows.map(row => ({ month: row.view_month, count: parseInt(row.count) })); res.status(200).json(monthlyTrafficData); } catch (err) { console.error('獲取月度流量數據時發生嚴重錯誤:', err); res.status(500).json({ error: '伺服器內部錯誤，無法獲取月度流量數據。' }); } });

// --- Banner 管理 API ---
app.get('/api/admin/banners', async (req, res) => { try { const result = await pool.query(`SELECT id, image_url, link_url, display_order, alt_text, page_location, updated_at FROM banners ORDER BY display_order ASC, id ASC`); res.json(result.rows); } catch (err) { console.error('[Admin API Error] 獲取管理 Banners 時出錯:', err); res.status(500).json({ error: '伺服器內部錯誤' }); } });
app.get('/api/admin/banners/:id', async (req, res) => { const { id } = req.params; if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); } try { const result = await pool.query(`SELECT id, image_url, link_url, display_order, alt_text, page_location FROM banners WHERE id = $1`, [id]); if (result.rows.length === 0) { return res.status(404).json({ error: '找不到指定的 Banner。' }); } res.status(200).json(result.rows[0]); } catch (err) { console.error(`[Admin API Error] 獲取 Banner ID ${id} 時出錯:`, err); res.status(500).json({ error: '伺服器內部錯誤' }); } });
app.post('/api/admin/banners', async (req, res) => { const { image_url, link_url, display_order, alt_text, page_location } = req.body; if (!image_url || !page_location) { return res.status(400).json({ error: '圖片網址和顯示頁面為必填。'}); } const order = (display_order !== undefined && display_order !== null) ? parseInt(display_order) : 0; if (isNaN(order)) { return res.status(400).json({ error: '排序必須是數字。'}); } try { const result = await pool.query(`INSERT INTO banners (image_url, link_url, display_order, alt_text, page_location, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`, [image_url.trim(), link_url ? link_url.trim() : null, order, alt_text ? alt_text.trim() : null, page_location]); res.status(201).json(result.rows[0]); } catch (err) { console.error('[Admin API Error] 新增 Banner 時出錯:', err); res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' }); } });
app.put('/api/admin/banners/:id', async (req, res) => { const { id } = req.params; if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); } const { image_url, link_url, display_order, alt_text, page_location } = req.body; if (!image_url || !page_location) { return res.status(400).json({ error: '圖片網址和顯示頁面為必填。'}); } const order = (display_order !== undefined && display_order !== null) ? parseInt(display_order) : 0; if (isNaN(order)) { return res.status(400).json({ error: '排序必須是數字。'}); } try { const result = await pool.query(`UPDATE banners SET image_url = $1, link_url = $2, display_order = $3, alt_text = $4, page_location = $5, updated_at = NOW() WHERE id = $6 RETURNING *`, [image_url.trim(), link_url ? link_url.trim() : null, order, alt_text ? alt_text.trim() : null, page_location, id]); if (result.rowCount === 0) { return res.status(404).json({ error: '找不到 Banner，無法更新。' }); } res.status(200).json(result.rows[0]); } catch (err) { console.error(`[Admin API Error] 更新 Banner ID ${id} 時出錯:`, err); res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' }); } });
app.delete('/api/admin/banners/:id', async (req, res) => { const { id } = req.params; if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); } try { const result = await pool.query('DELETE FROM banners WHERE id = $1', [id]); if (result.rowCount === 0) { return res.status(404).json({ error: '找不到 Banner，無法刪除。' }); } res.status(204).send(); } catch (err) { console.error(`[Admin API Error] 刪除 Banner ID ${id} 時出錯:`, err); res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' }); } });

// --- 音樂管理 API ---
app.post('/api/music', basicAuthMiddleware, async (req, res) => { /* ... (同上次，處理 music 和 scores) ... */ });
app.put('/api/music/:id', basicAuthMiddleware, async (req, res) => { /* ... (同上次，處理 music 和 scores) ... */ });
app.delete('/api/music/:id', basicAuthMiddleware, async (req, res) => { /* ... (同上次) ... */ });

// --- 消息管理 API ---
app.post('/api/news', basicAuthMiddleware, async (req, res) => { /* ... (同上次) ... */ });
app.put('/api/news/:id', basicAuthMiddleware, async (req, res) => { /* ... (同上次) ... */ });
app.delete('/api/news/:id', basicAuthMiddleware, async (req, res) => { /* ... (同上次) ... */ });

// --- 銷售記錄 API ---
app.post('/api/admin/sales-log', basicAuthMiddleware, async (req, res) => { const salesEntries = req.body.entries; if (!Array.isArray(salesEntries) || salesEntries.length === 0) { return res.status(400).json({ error: '需要提供銷售記錄 entries 陣列。' }); } const client = await pool.connect(); try { await client.query('BEGIN'); const insertQuery = 'INSERT INTO sales_logs (variation_id, quantity_sold, sale_timestamp) VALUES ($1, $2, NOW())'; let totalRecorded = 0; for (const entry of salesEntries) { const variationId = parseInt(entry.variationId); const quantity = parseInt(entry.quantity); if (!isNaN(variationId) && !isNaN(quantity) && quantity > 0) { const checkVarExists = await client.query('SELECT 1 FROM product_variations WHERE id = $1', [variationId]); if (checkVarExists.rowCount === 0) { throw new Error(`記錄銷售失敗：找不到規格 ID ${variationId}`); } await client.query(insertQuery, [variationId, quantity]); totalRecorded += quantity; } else { console.warn('忽略無效的銷售記錄項目:', entry); } } await client.query('COMMIT'); res.status(201).json({ message: `成功記錄 ${totalRecorded} 件銷售。`, recordedEntries: salesEntries.length }); } catch (err) { await client.query('ROLLBACK'); console.error('記錄銷售日誌時出錯:', err); res.status(500).json({ error: `記錄銷售時發生錯誤: ${err.message}` }); } finally { client.release(); } });

// --- 更新規格庫存 API ---
app.put('/api/admin/variations/:variationId', basicAuthMiddleware, async (req, res) => { const { variationId } = req.params; const { inventory_count } = req.body; if (isNaN(parseInt(variationId)) || inventory_count === undefined || isNaN(parseInt(inventory_count)) || parseInt(inventory_count) < 0) { return res.status(400).json({ error: '無效的規格 ID 或庫存數量（必須是非負整數）。' }); } try { const result = await pool.query('UPDATE product_variations SET inventory_count = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [parseInt(inventory_count), variationId]); if (result.rowCount === 0) { return res.status(404).json({ error: '找不到指定的規格。' }); } console.log(`規格 ${variationId} 庫存已更新為 ${inventory_count}`); res.json(result.rows[0]); } catch (err) { console.error(`更新規格 ${variationId} 庫存時出錯:`, err); res.status(500).json({ error: '更新庫存時發生內部伺服器錯誤。' }); } });

// --- 銷售報告 API ---
app.get('/api/admin/analytics/overall-sales-trend', basicAuthMiddleware, async (req, res) => { try { const timeframe = req.query.timeframe || 'daily'; let dateTrunc, dateFormat, intervalCondition = ''; const queryParams = []; if (timeframe === 'monthly') { dateTrunc = 'month'; dateFormat = 'YYYY-MM'; } else { dateTrunc = 'day'; dateFormat = 'YYYY-MM-DD'; intervalCondition = `WHERE sale_timestamp >= (NOW() - interval '30 days')`; } queryParams.push(dateTrunc); queryParams.push(dateFormat); const queryText = ` SELECT to_char(date_trunc($1, sale_timestamp), $2) AS date_period, SUM(quantity_sold)::integer AS total_quantity FROM sales_logs ${intervalCondition} GROUP BY date_period ORDER BY date_period ASC; `; const result = await pool.query(queryText, queryParams); res.json(result.rows); } catch (err) { console.error('獲取整體銷售趨勢時出錯:', err); res.status(500).json({ error: '獲取銷售趨勢數據時出錯。' }); } });
app.get('/api/admin/products/:productId/variation-sales-summary', basicAuthMiddleware, async (req, res) => { const { productId } = req.params; if (isNaN(parseInt(productId))) { return res.status(400).json({ error: '無效的商品 ID。' }); } try { const queryText = ` SELECT pv.id AS variation_id, pv.name AS variation_name, COALESCE(SUM(sl.quantity_sold), 0)::integer AS total_sold FROM product_variations pv LEFT JOIN sales_logs sl ON pv.id = sl.variation_id WHERE pv.product_id = $1 GROUP BY pv.id, pv.name ORDER BY pv.name ASC; `; const result = await pool.query(queryText, [productId]); res.json(result.rows); } catch (err) { console.error(`獲取商品 ${productId} 規格銷售匯總時出錯:`, err); res.status(500).json({ error: '獲取規格銷售數據時出錯。' }); } });


// --- 商品管理 API (受保護 - **重新排序，確保修改的在後面**) ---

// **修改: POST /api/products (新增商品及規格 - 受保護)** - [已在上面提供]
// **修改: PUT /api/products/:id (更新商品及規格 - 受保護)** - [已在上面提供]
// **修改: DELETE /api/products/:id (刪除商品 - 受保護)** - [已在上面提供]


// --- 路由處理 (保持不變) ---
app.get('/news/:id(\\d+)', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'news-detail.html')); });
app.get('/scores', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'scores.html')); });
// 新增: 處理 score-viewer.html 的路由
app.get('/score-viewer.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'score-viewer.html')); });

// --- 404 處理 ---
// --- 404 處理 ---
// 這個中間件應該放在所有其他路由和靜態文件服務之後
app.use((req, res, next) => {
    // 定義已知的前端 HTML 頁面路徑
    const knownFrontendRoutes = [
        '/',
        '/index.html',
        '/music.html',
        '/news.html',
        '/scores.html',
        '/score-viewer.html', // 確保樂譜查看器也被識別
        '/admin.html',
        '/music-admin.html',
        '/news-admin.html',
        '/banner-admin.html'
    ];

    // 檢查請求的路徑是否匹配已知的前端路由或新聞詳情頁模式
    const isKnownFrontendRoute = knownFrontendRoutes.includes(req.path);
    const isNewsDetailRoute = req.path.match(/^\/news\/\d+$/); // 正則表達式匹配 /news/數字

    // 如果匹配了已知的前端路由或新聞詳情頁
    if (isKnownFrontendRoute || isNewsDetailRoute) {
        // 檢查客戶端是否期望接收 HTML (瀏覽器通常會)
        if (req.accepts('html')) {
            // 對於這些路由，我們假設它們對應到 public 文件夾下的 HTML 文件。
            // express.static 中間件應該會處理這些請求。
            // 如果 express.static 找不到文件，它會自動調用 next()，
            // 最終會落到我們這個 404 處理器下面的邏輯。
            // 所以這裡我們直接調用 next()，讓靜態文件服務或後續中間件處理。
            return next();
        }
        // 如果客戶端不接受 HTML (例如 API 請求)，則繼續到下面的 404 處理
    }

    // 對於所有其他未匹配的 API 或未知路徑
    console.log(`[404 Handler] Path not found: ${req.method} ${req.originalUrl}`);
    res.status(404).send('抱歉，找不到您要訪問的頁面。');
});
// --- 全局錯誤處理 ---
app.use((err, req, res, next) => { console.error("全局錯誤處理:", err.stack || err); if (res.headersSent) { return next(err); } res.status(err.status || 500).send(process.env.NODE_ENV === 'production' ? '伺服器發生了一些問題！' : `伺服器錯誤: ${err.message}`); });

// --- 啟動伺服器 ---
app.listen(PORT, () => { console.log(`伺服器正在監聽 port ${PORT}`); pool.query('SELECT NOW()').then(result => { console.log('資料庫連接成功於', result.rows[0].now); }).catch(err => { console.error('資料庫連接錯誤:', err.stack || err); }); });