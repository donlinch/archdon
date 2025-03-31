// server.js (完整替換)
require('dotenv').config();
const express = require('express');
const path = require('path'); // 確保 path 被正確 require
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const basicAuthMiddleware = (req, res, next) => {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'password';
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).send('需要認證才能訪問管理區域。'); }
    try { const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':'); const user = auth[0]; const pass = auth[1]; if (user === adminUser && pass === adminPass) { next(); } else { res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).send('認證失敗。'); } } catch (error) { console.error("認證標頭解析錯誤:", error); res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).send('認證失敗 (格式錯誤)。'); }
};

app.use(express.json());

// 頁面瀏覽量記錄... (保持不變)
app.use(async (req, res, next) => {
  const pathsToLog = ['/', '/index.html', '/music.html', '/news.html'];
  const shouldLog = pathsToLog.includes(req.path.toLowerCase()) && req.method === 'GET';
  if (shouldLog) {
      const pagePath = req.path.toLowerCase() === '/index.html' ? '/' : req.path.toLowerCase();
      try {
          await pool.query(`INSERT INTO page_views (page, view_date, view_count) VALUES ($1, CURRENT_DATE, 1) ON CONFLICT (page, view_date) DO UPDATE SET view_count = page_views.view_count + 1`, [pagePath]);
      } catch (err) { if (!(err.code === '23505' || err.message.includes('ON CONFLICT DO UPDATE'))) { console.error('記錄頁面瀏覽錯誤:', err); } }
  }
  next();
});


app.use(express.static(path.join(__dirname, 'public')));

// --- 公開 API ---
// GET /api/banners (修改為可選的頁面過濾)
app.get('/api/banners', async (req, res) => {
    const pageLocation = req.query.page; // 獲取 page 查詢參數
    console.log(`[Public API] GET /api/banners requested for page: ${pageLocation || 'all'}`);
    try {
        let queryText = 'SELECT id, image_url, link_url, alt_text FROM banners';
        const queryParams = [];
        if (pageLocation) {
            queryText += ' WHERE page_location = $1';
            queryParams.push(pageLocation);
        }
        queryText += ' ORDER BY display_order ASC, id ASC'; // 統一用 display_order

        const result = await pool.query(queryText, queryParams);
        console.log(`[Public API] Found ${result.rowCount} banners for page: ${pageLocation || 'all'}`);
        res.json(result.rows);
    } catch (err) {
        console.error(`[Public API Error] 獲取 Banner (page: ${pageLocation || 'all'}) 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});
app.get('/api/products', async (req, res) => { /* 商品列表 */ });
app.get('/api/products/:id', async (req, res) => { /* 單一商品 */ });
app.post('/api/products/:id/click', async (req, res) => { /* 商品點擊 */ });
app.get('/api/artists', async (req, res) => { /* 歌手列表 */ });
app.get('/api/music', async (req, res) => { /* 音樂列表 */ });
app.get('/api/music/:id', async (req, res) => { /* 單一音樂 */ });
app.get('/api/news', async (req, res) => { /* 消息列表 */ });
app.get('/api/news/:id', async (req, res) => { /* 單一消息 */ });
app.post('/api/news/:id/like', async (req, res) => { /* 消息按讚 */ });


// --- 受保護的管理頁面和 API ---
app.use(['/admin.html', '/music-admin.html', '/news-admin.html', '/banner-admin.html'], basicAuthMiddleware);
app.use('/api/admin/*', basicAuthMiddleware); // 保護所有 /api/admin/ 開頭的 API
app.use('/api/analytics/*', basicAuthMiddleware); // 保護分析 API


// 流量統計 API ... (保持不變)
app.get('/api/analytics/traffic', async (req, res) => { /* ... */ });
app.get('/api/analytics/monthly-traffic', async (req, res) => { /* ... */ });

// 商品管理 API... (保持不變, 假設是 /api/admin/products/*)
app.get('/api/admin/products', async (req, res) => { /* ... */ });
app.post('/api/admin/products', async (req, res) => { /* ... */ });
app.put('/api/admin/products/:id', async (req, res) => { /* ... */ });
app.delete('/api/admin/products/:id', async (req, res) => { /* ... */ });

// 音樂管理 API... (保持不變, 假設是 /api/admin/music/*)
app.get('/api/admin/music', async (req, res) => { /* ... */ });
app.post('/api/admin/music', async (req, res) => { /* ... */ });
app.put('/api/admin/music/:id', async (req, res) => { /* ... */ });
app.delete('/api/admin/music/:id', async (req, res) => { /* ... */ });

// 消息管理 API... (保持不變, 假設是 /api/admin/news/*)
app.get('/api/admin/news', async (req, res) => { /* ... */ });
app.post('/api/admin/news', async (req, res) => { /* ... */ });
app.put('/api/admin/news/:id', async (req, res) => { /* ... */ });
app.delete('/api/admin/news/:id', async (req, res) => { /* ... */ });


// --- Banner 管理 API ---
// GET /api/admin/banners (獲取列表)
app.get('/api/admin/banners', async (req, res) => {
    console.log("[Admin API] GET /api/admin/banners request received");
    try {
        const result = await pool.query(
            `SELECT id, image_url, link_url, display_order, alt_text, page_location, updated_at
             FROM banners ORDER BY display_order ASC, id ASC` // 包含 page_location
        );
        console.log(`[Admin API] Found ${result.rowCount} banners for admin list.`);
        res.json(result.rows);
    } catch (err) {
        console.error('[Admin API Error] 獲取管理 Banners 時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// *** 新增這個路由 ***
// GET /api/admin/banners/:id (獲取單一 Banner 用於編輯)
app.get('/api/admin/banners/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] GET /api/admin/banners/${id} request received`);
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的 Banner ID 格式。' });
    }
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
app.post('/api/admin/banners', async (req, res) => {
    console.log("[Admin API] POST /api/admin/banners request received");
    const { image_url, link_url, display_order, alt_text, page_location } = req.body; // 包含 page_location
    // 驗證... (省略以保持簡潔)
    if (!image_url) return res.status(400).json({ error: '圖片網址不能為空。'});
    if (!page_location) return res.status(400).json({ error: '必須指定顯示頁面。'});
    const order = display_order !== null ? parseInt(display_order) : 0;
    if (isNaN(order)) return res.status(400).json({ error: '排序必須是數字。'});
    // URL 驗證...

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

// PUT /api/admin/banners/:id (更新 Banner)
app.put('/api/admin/banners/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] PUT /api/admin/banners/${id} request received`);
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    const { image_url, link_url, display_order, alt_text, page_location } = req.body; // 包含 page_location
    // 驗證... (省略以保持簡潔)
    if (!image_url) return res.status(400).json({ error: '圖片網址不能為空。'});
    if (!page_location) return res.status(400).json({ error: '必須指定顯示頁面。'});
    const order = display_order !== null ? parseInt(display_order) : 0;
    if (isNaN(order)) return res.status(400).json({ error: '排序必須是數字。'});
    // URL 驗證...

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

// DELETE /api/admin/banners/:id (刪除 Banner)
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


// --- 404 和錯誤處理 ---
app.use((req, res, next) => {
    console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    // 只返回文本 404，避免複雜的 HTML 文件處理
    res.status(404).type('text').send('Not Found');
});

app.use((err, req, res, next) => {
    console.error("===== Global Error Handler Caught =====");
    console.error("Time:", new Date().toISOString());
    console.error("URL:", req.originalUrl);
    console.error("Method:", req.method);
    console.error(err.stack); // 顯示完整錯誤堆疊
    console.error("=======================================");
    if (res.headersSent) { return next(err); }
    res.status(500).send('伺服器發生了一些問題！');
});


// --- 啟動伺服器 ---
app.listen(PORT, () => {
    console.log(`伺服器正在監聽 port ${PORT}`);
    pool.query('SELECT NOW()', (err) => {
        if (err) console.error('!!!!!!!! 資料庫連接錯誤 !!!!!!!!', err.message);
        else console.log('資料庫連接成功');
    });
});