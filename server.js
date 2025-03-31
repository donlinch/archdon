// server.js (完整替換)
require('dotenv').config();
const express = require('express');
const path = path = require('path'); // 修正 path 載入
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// 資料庫連接池設定
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// --- 中間件 ---
// 基礎認證 (放在需要保護的路由之前)
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
        const user = auth[0];
        const pass = auth[1];

        if (user === adminUser && pass === adminPass) {
            next(); // 認證成功
        } else {
            res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
            return res.status(401).send('認證失敗。');
        }
    } catch (error) {
        console.error("認證標頭解析錯誤:", error);
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send('認證失敗 (格式錯誤)。');
    }
};

// 解析 JSON body (必須放在 API 路由之前)
app.use(express.json());

// 記錄 Page View 中間件 (放前面，但在 static/json 解析之後)
app.use(async (req, res, next) => {
    const pathsToLog = ['/', '/index.html', '/music.html', '/news.html']; // 指定要記錄的路徑
    // 判斷是否為 GET 請求且路徑在列表中
    const shouldLog = pathsToLog.includes(req.path.toLowerCase()) && req.method === 'GET';

    if (shouldLog) {
        const pagePath = req.path.toLowerCase() === '/index.html' ? '/' : req.path.toLowerCase(); // 將 /index.html 統一為 /
        console.log(`[PV Mid] Logging view for: ${pagePath}`);
        try {
            const sql = `
                INSERT INTO page_views (page, view_date, view_count)
                VALUES ($1, CURRENT_DATE, 1)
                ON CONFLICT (page, view_date)
                DO UPDATE SET view_count = page_views.view_count + 1
                RETURNING *;
            `;
            const params = [pagePath];
            const result = await pool.query(sql, params);
            if (result.rowCount > 0) {
                 console.log(`[PV Mid] SUCCESS: Page view recorded/updated for: ${pagePath}. Result:`, result.rows[0]);
            } else {
                 console.warn(`[PV Mid] WARN: Query executed for ${pagePath} but rowCount is 0.`);
            }
        } catch (err) {
             // 忽略唯一性衝突和 ON CONFLICT 更新衝突，記錄其他錯誤
            if (!(err.code === '23505' || err.message.includes('ON CONFLICT DO UPDATE command cannot affect row a second time'))) {
                console.error('[PV Mid] Error logging page view:', err);
            } else {
                 console.warn(`[PV Mid] Handled conflict for ${pagePath}.`);
            }
        }
    } else {
        // 只記錄非 GET 或不在列表中的 GET 請求的跳過信息
        if (req.method === 'GET') {
            console.log(`[PV Mid] Skipping log for non-tracked page: ${req.method} ${req.path}`);
        }
    }
    next();
});


// 靜態文件服務 (指定 public 資料夾)
// path.join 會正確處理 server.js 在上一層的情況
app.use(express.static(path.join(__dirname, 'public')));


// --- 公開 API Routes (不需要認證) ---

// 商品 API (保持不變)
app.get('/api/products', async (req, res) => { /* ... */ });
app.get('/api/products/:id', async (req, res) => { /* ... */ });
app.post('/api/products/:id/click', async (req, res) => { /* ... */ });

// 音樂 API (保持不變)
app.get('/api/artists', async (req, res) => { /* ... */ }); // 获取歌手列表
app.get('/api/music', async (req, res) => { /* ... */ });
app.get('/api/music/:id', async (req, res) => { /* ... */ });

// 消息 API (保持不變)
app.get('/api/news', async (req, res) => { /* ... */ });
app.get('/api/news/:id', async (req, res) => { /* ... */ });
app.post('/api/news/:id/like', async (req, res) => { /* ... */ });

// *** 公開 Banner API ***
// GET /api/banners?page=home  (或其他 page_location)
app.get('/api/banners', async (req, res) => {
    const pageLocation = req.query.page || 'home'; // 預設獲取首頁的 banner
    console.log(`[Public API] GET /api/banners requested for page: ${pageLocation}`);
    try {
        const result = await pool.query(
            // 統一使用 display_order，並加入 page_location 篩選
            `SELECT id, image_url, link_url, alt_text
             FROM banners
             WHERE page_location = $1
             ORDER BY display_order ASC, id ASC`,
             [pageLocation]
        );
        console.log(`[Public API] Found ${result.rowCount} banners for page: ${pageLocation}`);
        res.json(result.rows);
    } catch (err) {
        console.error(`[Public API Error] 獲取 Banner (page: ${pageLocation}) 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// --- 受保護的管理頁面和 API Routes ---

// 保護管理 HTML 頁面的訪問
app.use(['/admin.html', '/music-admin.html', '/news-admin.html', '/banner-admin.html'], basicAuthMiddleware);

// 保護所有 /api/admin/ 和 /api/analytics/ 路由
app.use(['/api/admin/*', '/api/analytics/*'], basicAuthMiddleware);


// --- 商品管理 API (受保護 - 假設路由為 /api/admin/products/*) ---
app.get('/api/admin/products', async (req, res) => { /* ... */ }); // 獲取列表
app.post('/api/admin/products', async (req, res) => { /* ... */ }); // 新增
app.put('/api/admin/products/:id', async (req, res) => { /* ... */ }); // 更新
app.delete('/api/admin/products/:id', async (req, res) => { /* ... */ }); // 刪除

// --- 音樂管理 API (受保護 - 假設路由為 /api/admin/music/*) ---
app.get('/api/admin/music', async (req, res) => { /* ... */ }); // 獲取列表
app.post('/api/admin/music', async (req, res) => { /* ... */ }); // 新增
app.put('/api/admin/music/:id', async (req, res) => { /* ... */ }); // 更新
app.delete('/api/admin/music/:id', async (req, res) => { /* ... */ }); // 刪除

// --- 消息管理 API (受保護 - 假設路由為 /api/admin/news/*) ---
app.get('/api/admin/news', async (req, res) => { /* ... */ }); // 獲取列表
app.post('/api/admin/news', async (req, res) => { /* ... */ }); // 新增
app.put('/api/admin/news/:id', async (req, res) => { /* ... */ }); // 更新
app.delete('/api/admin/news/:id', async (req, res) => { /* ... */ }); // 刪除

// --- 流量統計 API (受保護) ---
app.get('/api/analytics/traffic', async (req, res) => { /* ... */ });
app.get('/api/analytics/monthly-traffic', async (req, res) => { /* ... */ });

// --- *** Banner管理 API (受保護) *** ---

// GET all banners for admin
app.get('/api/admin/banners', async (req, res) => {
    console.log("[Admin API] GET /api/admin/banners request received");
    try {
        const result = await pool.query(
            // *** 修正: 加入 page_location, 統一用 display_order ***
            `SELECT id, image_url, link_url, display_order, alt_text, page_location, updated_at
             FROM banners
             ORDER BY display_order ASC, id ASC`
        );
        console.log(`[Admin API] Found ${result.rowCount} banners for admin list.`);
        res.json(result.rows);
    } catch (err) {
        console.error('[Admin API Error] 獲取管理 Banner 列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// *** 新增: GET a single banner by ID for admin ***
app.get('/api/admin/banners/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] GET /api/admin/banners/${id} request received`);
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }

    try {
        const result = await pool.query(
            // *** 修正: 加入 page_location, 統一用 display_order ***
            `SELECT id, image_url, link_url, display_order, alt_text, page_location
             FROM banners
             WHERE id = $1`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到指定的 Banner。' });
        }
        console.log(`[Admin API] Found banner for ID ${id}:`, result.rows[0]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`[Admin API Error] 獲取 Banner ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});


// CREATE a new banner
app.post('/api/admin/banners', async (req, res) => {
    console.log("[Admin API] POST /api/admin/banners request received");
    // *** 統一使用 display_order, 加入 page_location ***
    const { image_url, link_url, alt_text, display_order, page_location } = req.body;

    if (!image_url || typeof image_url !== 'string' || image_url.trim() === '') { return res.status(400).json({ error: '圖片路徑不能為空。' }); }
    if (!page_location) { return res.status(400).json({ error: '必須指定顯示頁面。'}); }

    const order = (display_order !== undefined && display_order !== null && display_order !== '') ? parseInt(display_order) : 0;
    if (isNaN(order)) { return res.status(400).json({ error: '排序必須是數字。' }); }

    const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');
    if (!isValidUrl(image_url)) { return res.status(400).json({ error: '無效的圖片路徑格式。' }); }
    if (link_url && !isValidUrl(link_url)) { return res.status(400).json({ error: '無效的連結格式。' }); }

    console.log("[Admin API] Creating banner with data:", { image_url, link_url, alt_text, display_order: order, page_location });

    try {
        const result = await pool.query(
            // *** 修正: 加入 page_location, 使用 display_order ***
            `INSERT INTO banners (image_url, link_url, alt_text, display_order, page_location, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING *`,
            [image_url.trim(), link_url ? link_url.trim() : null, alt_text ? alt_text.trim() : null, order, page_location]
        );
        console.log("[Admin API] Banner created successfully:", result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[Admin API Error] 新增 Banner 時出錯:', err);
        res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' });
    }
});

// *** 新增: UPDATE a banner by ID ***
app.put('/api/admin/banners/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] PUT /api/admin/banners/${id} request received`);
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }

    // *** 統一使用 display_order, 加入 page_location ***
    const { image_url, link_url, alt_text, display_order, page_location } = req.body;

    // 驗證 (同 POST)
    if (!image_url || typeof image_url !== 'string' || image_url.trim() === '') { return res.status(400).json({ error: '圖片路徑不能為空。' }); }
    if (!page_location) { return res.status(400).json({ error: '必須指定顯示頁面。'}); }
    const order = (display_order !== undefined && display_order !== null && display_order !== '') ? parseInt(display_order) : 0;
    if (isNaN(order)) { return res.status(400).json({ error: '排序必須是數字。' }); }
    const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');
    if (!isValidUrl(image_url)) { return res.status(400).json({ error: '無效的圖片路徑格式。' }); }
    if (link_url && !isValidUrl(link_url)) { return res.status(400).json({ error: '無效的連結格式。' }); }

    console.log(`[Admin API] Updating banner ID ${id} with data:`, { image_url, link_url, alt_text, display_order: order, page_location });

    try {
        const result = await pool.query(
             // *** 修正: 加入 page_location, 使用 display_order ***
            `UPDATE banners
             SET image_url = $1, link_url = $2, alt_text = $3, display_order = $4, page_location = $5, updated_at = NOW()
             WHERE id = $6
             RETURNING *`,
            [image_url.trim(), link_url ? link_url.trim() : null, alt_text ? alt_text.trim() : null, order, page_location, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的 Banner。' });
        }
        console.log("[Admin API] Banner updated successfully:", result.rows[0]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`[Admin API Error] 更新 Banner ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' });
    }
});

// *** 新增: DELETE a banner by ID ***
app.delete('/api/admin/banners/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] DELETE /api/admin/banners/${id} request received`);
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    try {
        const result = await pool.query('DELETE FROM banners WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要刪除的 Banner。' });
        }
        console.log(`[Admin API] Banner ID ${id} deleted successfully.`);
        res.status(204).send(); // No Content
    } catch (err) {
        console.error(`[Admin API Error] 刪除 Banner ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' });
    }
});


// --- 可選的 SPA Catch-all (如果前端是 SPA) ---
/*
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/') && req.path.indexOf('.') === -1) {
     res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
     // Let Express handle 404 for unmatched API/file routes
     next();
  }
});
*/

// --- 404 處理 (放在所有路由之後) ---
app.use((req, res, next) => {
    console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    if (req.accepts('html')) {
        // 判斷是否可能是管理頁面路徑，給更友善提示
        if (req.originalUrl.startsWith('/admin') || req.originalUrl.includes('admin')) {
            res.status(404).send('抱歉，找不到您要訪問的管理頁面。請檢查路徑是否正確。');
        } else {
            res.status(404).sendFile(path.join(__dirname, 'public', '404.html'), (err) => {
                // 如果 404.html 文件不存在或發送失敗，則發送純文本
                if (err) {
                    res.status(404).send('抱歉，找不到您要訪問的頁面。');
                }
            });
        }
    } else if (req.accepts('json')) {
        res.status(404).json({ error: 'Not Found' });
    } else {
        res.status(404).type('txt').send('Not Found');
    }
});


// --- 全局錯誤處理 (放在最後) ---
app.use((err, req, res, next) => {
    console.error("===== Global Error Handler Caught =====");
    console.error("Error Time:", new Date().toISOString());
    console.error("Request URL:", req.originalUrl);
    console.error("Request Method:", req.method);
    console.error("Error Stack:", err.stack);
    console.error("=======================================");

    // 避免在已經發送響應後再次嘗試發送
    if (res.headersSent) {
        return next(err);
    }

    res.status(err.status || 500); // 使用錯誤對象的狀態碼或預設為 500

    // 根據請求類型返回錯誤信息
    if (req.accepts('html')) {
        res.send('<h1>伺服器發生錯誤</h1><p>抱歉，伺服器處理您的請求時發生了一些問題。</p>');
    } else if (req.accepts('json')) {
        res.json({ error: 'Internal Server Error', message: err.message }); // 開發模式可以傳遞 err.message
    } else {
        res.type('txt').send('Internal Server Error');
    }
});


// --- 啟動伺服器 ---
app.listen(PORT, () => {
    console.log(`伺服器正在監聽 port ${PORT}`);
    // 測試資料庫連接
    pool.query('SELECT NOW()', (err, result) => {
        if (err) {
            console.error('!!!!!!!! 資料庫連接錯誤 !!!!!!!!');
            console.error(err.message); // 只顯示關鍵錯誤信息
            // 你可能希望在這裡退出應用程序，如果資料庫連接是必須的
            // process.exit(1);
        } else if (result && result.rows.length > 0) {
            console.log('資料庫連接成功於', result.rows[0].now);
        } else {
             console.log('資料庫已連接，但無法獲取時間。');
        }
    });
});