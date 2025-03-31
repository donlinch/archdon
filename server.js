// server.js
require('dotenv').config(); // 從 .env 載入環境變數
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

// --- *** 基本認證中間件函數定義 (所有路由之前) *** ---
const basicAuthMiddleware = (req, res, next) => {
    const adminUser = process.env.ADMIN_USERNAME || 'admin'; // 從 .env 讀取帳號
    const adminPass = process.env.ADMIN_PASSWORD || 'password'; // 從 .env 讀取密碼 (務必修改!)
    const authHeader = req.headers.authorization; // 獲取 Authorization 標頭
    if (!authHeader) { /* 要求認證 */ res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).send('需要認證才能訪問管理區域。'); }
    try { const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':'); const user = auth[0]; const pass = auth[1]; if (user === adminUser && pass === adminPass) { next(); } else { /* 認證失敗 */ res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).send('認證失敗。'); } } catch (error) { console.error("認證標頭解析錯誤:", error); res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).send('認證失敗 (格式錯誤)。'); }
};

// --- *** 新增：使用 express.json() 來解析 JSON 請求體 *** ---
// 必須放在所有需要讀取 req.body 的路由之前
app.use(express.json());

// --- 記錄 Page View 中間件 ---
app.use(async (req, res, next) => {
  // *** 修改: 明確指定要記錄的路徑 ***
  const pathsToLog = ['/', '/index.html', '/music.html', '/news.html'];
  const shouldLog = pathsToLog.includes(req.path) && req.method === 'GET';

  if (shouldLog) {
      const pagePath = req.path;
      console.log(`[PV Mid] Should Log: YES for ${pagePath}`);
      try {
          const sql = `
              INSERT INTO page_views (page, view_date, view_count)
              VALUES ($1, CURRENT_DATE, 1)
              ON CONFLICT (page, view_date)
              DO UPDATE SET view_count = page_views.view_count + 1
              RETURNING *;
          `;
          const params = [pagePath];
          // console.log(`[PV Mid] Executing SQL: ${sql.replace(/\s+/g, ' ')} with params:`, params); // 日誌可能過多，需要時取消註解
          const result = await pool.query(sql, params);
          if (result.rowCount > 0) {
              // console.log(`[PV Mid] SUCCESS: Page view recorded/updated for: ${pagePath}. Result:`, result.rows[0]); // 日誌可能過多
          } else {
              console.warn(`[PV Mid] WARN: Query executed for ${pagePath} but rowCount is 0.`);
          }
      } catch (err) {
          // 針對常見的並發衝突進行更溫和的處理
          if (err.code === '23505' || err.message.includes('ON CONFLICT DO UPDATE command cannot affect row a second time')) {
              console.warn(`[PV Mid] CONFLICT/Race condition for ${pagePath}. Handled.`);
          }
          else {
              console.error('[PV Mid] Error logging page view:', err);
          }
      }
  } else {
      // 只有當 method 不是 GET 或 path 不在列表中時才跳過
      // if (req.method === 'GET' && !req.path.startsWith('/api/')) { // 只打印非 API 的 GET 請求跳過信息
      //      console.log(`[PV Mid] Skipping log for non-tracked page: ${req.method} ${req.path}`);
      // }
  }
  next();
});

// 靜態文件服務 (放在記錄和 json 解析之後)
app.use(express.static(path.join(__dirname, 'public')));

// --- 公開 API Routes (不需要認證) ---

// GET all Banners (Sorted for public display)
app.get('/api/banners', async (req, res) => {
    console.log("[API] Received GET /api/banners request");
    try {
        // 按照 display_order 升序排列 (數字小的優先)，相同排序值則按 ID 升序
        const queryText = 'SELECT id, image_url, link_url, alt_text FROM banners ORDER BY display_order ASC, id ASC';
        const result = await pool.query(queryText);
        console.log(`[API] Found ${result.rowCount} banners for public display.`);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('[API Error] 獲取公開 Banner 列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取輪播圖。' });
    }
});

// GET all products (支持排序: latest, popular)
app.get('/api/products', async (req, res) => {
    const sortBy = req.query.sort || 'latest';
    let orderByClause = 'ORDER BY created_at DESC';
    if (sortBy === 'popular') {
        orderByClause = 'ORDER BY click_count DESC, created_at DESC';
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

// GET a single product by ID (包含點擊數)
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

// POST record product click
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

// GET all artists
app.get('/api/artists', async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT artist FROM music WHERE artist IS NOT NULL ORDER BY artist ASC');
        const artists = result.rows.map(row => row.artist);
        res.json(artists);
    } catch (err) {
        console.error('獲取歌手列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET music list (支持按歌手篩選)
app.get('/api/music', async (req, res) => {
    const artistFilter = req.query.artist || null;
    let queryText = 'SELECT id, title, artist, cover_art_url, platform_url, release_date, description FROM music';
    const queryParams = [];
    if (artistFilter) { queryText += ' WHERE artist = $1'; queryParams.push(artistFilter); }
    queryText += ' ORDER BY release_date DESC, id DESC'; // 添加 id 排序確保穩定
    try {
        const result = await pool.query(queryText, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取音樂列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET a single music item by ID
app.get('/api/music/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的音樂 ID 格式。' }); }
    try {
        const result = await pool.query('SELECT id, title, artist, cover_art_url, platform_url, release_date, description FROM music WHERE id = $1', [id]);
        if (result.rows.length === 0) { return res.status(404).json({ error: '找不到該音樂項目。' }); }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`獲取音樂 ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET news list (支持分頁)
app.get('/api/news', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    if (page <= 0 || limit <= 0) { return res.status(400).json({ error: '頁碼和每頁數量必須是正整數。' }); }
    const offset = (page - 1) * limit;
    try {
        const countResult = await pool.query('SELECT COUNT(*) FROM news');
        const totalItems = parseInt(countResult.rows[0].count);
        const newsResult = await pool.query(`SELECT id, title, event_date, summary, thumbnail_url, like_count, updated_at FROM news ORDER BY updated_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
        const totalPages = Math.ceil(totalItems / limit);
        res.status(200).json({ totalItems, totalPages, currentPage: page, limit, news: newsResult.rows });
    } catch (err) {
        console.error('獲取最新消息列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET a single news item by ID
app.get('/api/news/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); }
    try {
        // 在 SELECT 中也獲取 summary 和 thumbnail_url，以便管理介面可能需要
        const result = await pool.query('SELECT id, title, event_date, summary, content, thumbnail_url, image_url, like_count, updated_at FROM news WHERE id = $1', [id]);
        if (result.rows.length === 0) { return res.status(404).json({ error: '找不到該消息。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`獲取消息 ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// POST like a news item
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

// 保護管理 HTML 頁面的訪問 (*** 確保包含 banner-admin.html ***)
app.use(['/admin.html', '/music-admin.html', '/news-admin.html', '/banner-admin.html'], basicAuthMiddleware);


// --- *** Traffic API 定義 *** ---
// GET daily traffic data (受保護)
app.get('/api/analytics/traffic', basicAuthMiddleware, async (req, res) => {
  console.log("接收到 /api/analytics/traffic 請求");
  const daysToFetch = 30; const startDate = new Date(); startDate.setDate(startDate.getDate() - daysToFetch); const startDateString = startDate.toISOString().split('T')[0]; console.log(`計算起始日期: ${startDateString}`);
  try {
      const queryText = `SELECT view_date, SUM(view_count)::bigint AS count FROM page_views WHERE view_date >= $1 GROUP BY view_date ORDER BY view_date ASC`;
      const result = await pool.query(queryText, [startDateString]);
      const trafficData = result.rows.map(row => ({ date: new Date(row.view_date).toISOString().split('T')[0], count: parseInt(row.count) }));
      res.status(200).json(trafficData);
  } catch (err) { console.error('獲取流量數據時發生嚴重錯誤:', err); res.status(500).json({ error: '伺服器內部錯誤，無法獲取流量數據。' }); }
});

// GET monthly traffic data (受保護)
app.get('/api/analytics/monthly-traffic', basicAuthMiddleware, async (req, res) => {
  console.log("接收到 /api/analytics/monthly-traffic 請求");
  const targetYear = req.query.year ? parseInt(req.query.year) : null;
  let queryText = `SELECT to_char(date_trunc('month', view_date), 'YYYY-MM') AS view_month, SUM(view_count)::bigint AS count FROM page_views`;
  const queryParams = [];
  if (targetYear) { queryText += ` WHERE date_part('year', view_date) = $1`; queryParams.push(targetYear); }
  queryText += ` GROUP BY view_month ORDER BY view_month ASC`;
  try {
      const result = await pool.query(queryText, queryParams);
      const monthlyTrafficData = result.rows.map(row => ({ month: row.view_month, count: parseInt(row.count) }));
      res.status(200).json(monthlyTrafficData);
  } catch (err) { console.error('獲取月度流量數據時發生嚴重錯誤:', err); res.status(500).json({ error: '伺服器內部錯誤，無法獲取月度流量數據。' }); }
});


// --- *** Banner 管理 API (受保護) *** ---

// GET all Banners for Admin (includes display_order)
app.get('/api/admin/banners', basicAuthMiddleware, async (req, res) => {
    console.log("[Admin API] Received GET /api/admin/banners request");
    try {
        // 按 display_order 升序，再按 id 升序
        const queryText = 'SELECT id, image_url, link_url, display_order, alt_text, updated_at FROM banners ORDER BY display_order ASC, id ASC';
        const result = await pool.query(queryText);
        console.log(`[Admin API] Found ${result.rowCount} banners for admin list.`);
        res.json(result.rows);
    } catch (err) {
        console.error('[Admin API Error] 獲取管理 Banners 時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET a single banner by ID (for editing form population - optional but good practice)
// Note: banner-admin.js currently fetches all and finds, which is okay too.
// If you prefer fetching single, uncomment this and adjust banner-admin.js's openEditBannerModal
/*
app.get('/api/admin/banners/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
     console.log(`[Admin API] Received GET /api/admin/banners/${id} request`);
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    try {
        const result = await pool.query('SELECT id, image_url, link_url, alt_text, display_order FROM banners WHERE id = $1', [id]);
        if (result.rows.length === 0) { return res.status(404).json({ error: '找不到指定的 Banner。' }); }
        console.log(`[Admin API] Found banner for ID ${id}:`, result.rows[0]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`[Admin API Error] 獲取 Banner ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});
*/


// CREATE a new Banner
app.post('/api/admin/banners', basicAuthMiddleware, async (req, res) => {
    console.log("[Admin API] Received POST /api/admin/banners request");
    const { image_url, link_url, display_order, alt_text } = req.body;

    // 驗證
    if (typeof image_url !== 'string' || image_url.trim() === '') {
        return res.status(400).json({ error: '圖片網址不能為空。' });
    }
    const order = (display_order !== undefined && display_order !== null && display_order !== '') ? parseInt(display_order) : 0;
    if (isNaN(order)) {
        return res.status(400).json({ error: '排序必須是有效的數字。' });
    }
    const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');
    if (!isValidUrl(image_url)) { return res.status(400).json({ error: '圖片網址格式不正確。' }); }
    if (link_url && !isValidUrl(link_url)) { return res.status(400).json({ error: '連結網址格式不正確。' }); }

    console.log("[Admin API] Creating banner with data:", { image_url, link_url, alt_text, display_order: order });

    try {
        const queryText = `
            INSERT INTO banners (image_url, link_url, display_order, alt_text, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING *;
        `;
        const params = [
            image_url.trim(),
            link_url ? link_url.trim() : null,
            order,
            alt_text ? alt_text.trim() : null
        ];
        const result = await pool.query(queryText, params);
        console.log("[Admin API] Banner created successfully:", result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[Admin API Error] 新增 Banner 時出錯:', err);
        res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' });
    }
});

// UPDATE a Banner by ID
app.put('/api/admin/banners/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] Received PUT /api/admin/banners/${id} request`);
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    const { image_url, link_url, display_order, alt_text } = req.body;

    // 驗證 (同 POST)
    if (typeof image_url !== 'string' || image_url.trim() === '') { return res.status(400).json({ error: '圖片網址不能為空。' }); }
    const order = (display_order !== undefined && display_order !== null && display_order !== '') ? parseInt(display_order) : 0;
    if (isNaN(order)) { return res.status(400).json({ error: '排序必須是有效的數字。' }); }
    const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');
    if (!isValidUrl(image_url)) { return res.status(400).json({ error: '圖片網址格式不正確。' }); }
    if (link_url && !isValidUrl(link_url)) { return res.status(400).json({ error: '連結網址格式不正確。' }); }

    console.log(`[Admin API] Updating banner ID ${id} with data:`, { image_url, link_url, alt_text, display_order: order });

    try {
        const queryText = `
            UPDATE banners
            SET image_url = $1, link_url = $2, display_order = $3, alt_text = $4, updated_at = NOW()
            WHERE id = $5
            RETURNING *;
        `;
         const params = [
            image_url.trim(),
            link_url ? link_url.trim() : null,
            order,
            alt_text ? alt_text.trim() : null,
            id
        ];
        const result = await pool.query(queryText, params);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到 Banner，無法更新。' });
        }
         console.log("[Admin API] Banner updated successfully:", result.rows[0]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`[Admin API Error] 更新 Banner ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' });
    }
});

// DELETE a Banner by ID
app.delete('/api/admin/banners/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] Received DELETE /api/admin/banners/${id} request`);
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }

    try {
        const result = await pool.query('DELETE FROM banners WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到 Banner，無法刪除。' });
        }
        console.log(`[Admin API] Banner ID ${id} deleted successfully.`);
        res.status(204).send(); // 成功，無內容返回
    } catch (err) {
        console.error(`[Admin API Error] 刪除 Banner ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' });
    }
});
// --- Banner 管理 API 結束 ---


// --- 商品管理 API (受保護) ---
// CREATE a new product
app.post('/api/products', basicAuthMiddleware, async (req, res) => {
    const { name, description, price, image_url, seven_eleven_url } = req.body;
    if (typeof name !== 'string' || name.trim() === '') { return res.status(400).json({ error: '商品名稱不能為空。' }); }
    let priceValue = null; if (price !== undefined && price !== null && price !== '') { priceValue = parseFloat(price); if (isNaN(priceValue)) { return res.status(400).json({ error: '無效的價格格式。' }); } if (priceValue < 0) { return res.status(400).json({ error: '價格不能為負數。' }); } }
    const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');
    if (seven_eleven_url && !isValidUrl(seven_eleven_url)) { return res.status(400).json({ error: '無效的 7-11 連結格式。' }); }
    try {
        const result = await pool.query(`INSERT INTO products (name, description, price, image_url, seven_eleven_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`, [ name, description || null, priceValue, image_url || null, seven_eleven_url || null ]);
        res.status(201).json(result.rows[0]);
    } catch (err) { console.error('新增商品時出錯:', err); res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' }); }
});
// UPDATE a product by ID
app.put('/api/products/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, description, price, image_url, seven_eleven_url } = req.body;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的商品 ID 格式。' }); } if (typeof name !== 'string' || name.trim() === '') { return res.status(400).json({ error: '商品名稱不能為空。' }); } let priceValue = null; if (price !== undefined && price !== null && price !== '') { priceValue = parseFloat(price); if (isNaN(priceValue)) { return res.status(400).json({ error: '無效的價格格式。' }); } if (priceValue < 0) { return res.status(400).json({ error: '價格不能為負數。' }); } } const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'); if (seven_eleven_url && !isValidUrl(seven_eleven_url)) { return res.status(400).json({ error: '無效的 7-11 連結格式。' }); }
    try {
        const result = await pool.query(`UPDATE products SET name = $1, description = $2, price = $3, image_url = $4, seven_eleven_url = $5, updated_at = NOW() WHERE id = $6 RETURNING *`, [ name, description || null, priceValue, image_url || null, seven_eleven_url || null, id ]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到商品，無法更新。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) { console.error(`更新商品 ID ${id} 時出錯:`, err); res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' }); }
});
// DELETE a product by ID
app.delete('/api/products/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的商品 ID 格式。' }); }
    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到商品，無法刪除。' }); }
        res.status(204).send();
    } catch (err) { console.error(`刪除商品 ID ${id} 時出錯:`, err); if (err.code === '23503') { return res.status(409).json({ error: '無法刪除商品，因為它被其他資料引用。' }); } res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' }); }
});


// --- 音樂管理 API (受保護) ---
// CREATE a new music item
app.post('/api/music', basicAuthMiddleware, async (req, res) => {
    const { title, artist, cover_art_url, platform_url, release_date, description } = req.body;
    if (typeof title !== 'string' || title.trim() === '') { return res.status(400).json({ error: '音樂標題不能為空。' }); } if (typeof artist !== 'string' || artist.trim() === '') { return res.status(400).json({ error: '歌手名稱不能為空。' }); } let formattedReleaseDate = null; if (release_date) { try { formattedReleaseDate = new Date(release_date).toISOString().split('T')[0]; } catch (e) { return res.status(400).json({ error: '無效的發行日期格式。' }); } } const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'); if (cover_art_url && !isValidUrl(cover_art_url)) { return res.status(400).json({ error: '無效的封面路徑格式。' }); } if (platform_url && !isValidUrl(platform_url)) { return res.status(400).json({ error: '無效的平台連結格式。' }); }
    try {
        const result = await pool.query(`INSERT INTO music (title, artist, cover_art_url, platform_url, release_date, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`, [ title, artist, cover_art_url || null, platform_url || null, formattedReleaseDate, description || null ]);
        res.status(201).json(result.rows[0]);
    } catch (err) { console.error('新增音樂時出錯:', err); res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' }); }
});
// UPDATE a music item by ID
app.put('/api/music/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    const { title, artist, cover_art_url, platform_url, release_date, description } = req.body;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的音樂 ID 格式。' }); } if (typeof title !== 'string' || title.trim() === '') { return res.status(400).json({ error: '音樂標題不能為空。' }); } if (typeof artist !== 'string' || artist.trim() === '') { return res.status(400).json({ error: '歌手名稱不能為空。' }); } let formattedReleaseDate = null; if (release_date) { try { formattedReleaseDate = new Date(release_date).toISOString().split('T')[0]; } catch (e) { return res.status(400).json({ error: '無效的發行日期格式。' }); } } const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'); if (cover_art_url && !isValidUrl(cover_art_url)) { return res.status(400).json({ error: '無效的封面路徑格式。' }); } if (platform_url && !isValidUrl(platform_url)) { return res.status(400).json({ error: '無效的平台連結格式。' }); }
    try {
        const result = await pool.query(`UPDATE music SET title = $1, artist = $2, cover_art_url = $3, platform_url = $4, release_date = $5, description = $6, updated_at = NOW() WHERE id = $7 RETURNING *`, [ title, artist, cover_art_url || null, platform_url || null, formattedReleaseDate, description || null, id ]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到音樂項目，無法更新。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) { console.error(`更新音樂 ID ${id} 時出錯:`, err); res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' }); }
});
// DELETE a music item by ID
app.delete('/api/music/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的音樂 ID 格式。' }); }
    try {
        const result = await pool.query('DELETE FROM music WHERE id = $1', [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到音樂項目，無法刪除。' }); }
        res.status(204).send();
    } catch (err) { console.error(`刪除音樂 ID ${id} 時出錯:`, err); res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' }); }
});


// --- 消息管理 API (受保護) ---
// CREATE a new news item
app.post('/api/news', basicAuthMiddleware, async (req, res) => {
    const { title, event_date, summary, content, thumbnail_url, image_url } = req.body;
    if (typeof title !== 'string' || title.trim() === '') { return res.status(400).json({ error: '消息標題不能為空。' }); } let formattedEventDate = null; if (event_date) { try { formattedEventDate = new Date(event_date).toISOString().split('T')[0]; } catch (e) { return res.status(400).json({ error: '無效的活動日期格式。' }); } } const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'); if (thumbnail_url && !isValidUrl(thumbnail_url)) { return res.status(400).json({ error: '無效的縮圖路徑格式。' }); } if (image_url && !isValidUrl(image_url)) { return res.status(400).json({ error: '無效的大圖路徑格式。' }); }
    try {
        const result = await pool.query(`INSERT INTO news (title, event_date, summary, content, thumbnail_url, image_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`, [ title, formattedEventDate, summary || null, content || null, thumbnail_url || null, image_url || null ]);
        res.status(201).json(result.rows[0]);
    } catch (err) { console.error('新增消息時出錯:', err); res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' }); }
});
// UPDATE a news item by ID
app.put('/api/news/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    const { title, event_date, summary, content, thumbnail_url, image_url } = req.body;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); } if (typeof title !== 'string' || title.trim() === '') { return res.status(400).json({ error: '消息標題不能為空。' }); } let formattedEventDate = null; if (event_date) { try { formattedEventDate = new Date(event_date).toISOString().split('T')[0]; } catch (e) { return res.status(400).json({ error: '無效的活動日期格式。' }); } } const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'); if (thumbnail_url && !isValidUrl(thumbnail_url)) { return res.status(400).json({ error: '無效的縮圖路徑格式。' }); } if (image_url && !isValidUrl(image_url)) { return res.status(400).json({ error: '無效的大圖路徑格式。' }); }
    try {
        const result = await pool.query(`UPDATE news SET title = $1, event_date = $2, summary = $3, content = $4, thumbnail_url = $5, image_url = $6, updated_at = NOW() WHERE id = $7 RETURNING *`, [ title, formattedEventDate, summary || null, content || null, thumbnail_url || null, image_url || null, id ]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到消息，無法更新。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) { console.error(`更新消息 ID ${id} 時出錯:`, err); res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' }); }
});
// DELETE a news item by ID
app.delete('/api/news/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); }
    try {
        const result = await pool.query('DELETE FROM news WHERE id = $1', [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到消息，無法刪除。' }); }
        res.status(204).send();
    } catch (err) { console.error(`刪除消息 ID ${id} 時出錯:`, err); res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' }); }
});


// --- 可選的 SPA Catch-all 路由 ---
// ... (保持不變) ...
/*
app.get('*', (req, res, next) => {
  // 排除 API 請求和已知文件擴展名的請求
  if (req.path.startsWith('/api/') || req.path.includes('.')) {
    return next(); // 讓其他路由或靜態文件處理
  }
  // 其他 GET 請求返回 index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
*/

// --- 404 處理 (放在所有路由之後) ---
app.use((req, res, next) => {
    // 註解掉或刪除這行:
    // res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  
    // 改成直接發送文字:
    res.status(404).send('抱歉，找不到您要訪問的頁面。');
  });
  
  // --- 全局錯誤處理 (這個保持不變) ---
  app.use((err, req, res, next) => {
      console.error("全局錯誤處理:", err.stack);
      res.status(500).send('伺服器發生了一些問題！');
  });

// --- 啟動伺服器 ---
app.listen(PORT, () => {
    console.log(`伺服器正在監聽 port ${PORT}`);
    pool.query('SELECT NOW()', (err, result) => {
        if (err) {
            console.error('資料庫連接錯誤:', err);
        } else if (result && result.rows.length > 0) {
            console.log('資料庫連接成功於', result.rows[0].now);
        } else {
             console.log('資料庫已連接，但無法獲取時間。');
        }
    });
});