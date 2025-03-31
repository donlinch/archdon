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

// --- 中間件 (Middleware) ---
app.use(express.static(path.join(__dirname, 'public'))); // 提供 public 目錄下的靜態檔案
app.use(express.json()); // 解析請求主體中的 JSON 資料

// --- *** 將基本認證中間件函數定義移到這裡 (所有路由之前) *** ---
const basicAuthMiddleware = (req, res, next) => {
    const adminUser = process.env.ADMIN_USERNAME || 'admin'; // 從 .env 讀取帳號
    const adminPass = process.env.ADMIN_PASSWORD || 'password'; // 從 .env 讀取密碼 (務必修改!)
    const authHeader = req.headers.authorization; // 獲取 Authorization 標頭
    if (!authHeader) { /* 要求認證 */ res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).send('需要認證才能訪問管理區域。'); }
    try { const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':'); const user = auth[0]; const pass = auth[1]; if (user === adminUser && pass === adminPass) { next(); } else { /* 認證失敗 */ res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).send('認證失敗。'); } } catch (error) { console.error("認證標頭解析錯誤:", error); res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).send('認證失敗 (格式錯誤)。'); }
};


// --- 記錄 Page View 中間件 ---
app.use(async (req, res, next) => {
  const isPageRequest = !req.path.startsWith('/api/') && req.path.indexOf('.') === -1 && req.method === 'GET';
  if (isPageRequest) {
      const pagePath = req.path;
      console.log(`[Page View Middleware] Checking request for: ${pagePath}`); // [除錯]
      try {
          await pool.query( `INSERT INTO page_views (page, view_date, view_count) VALUES ($1, CURRENT_DATE, 1) ON CONFLICT (page, view_date) DO UPDATE SET view_count = page_views.view_count + 1`, [pagePath] );
          console.log(`[Page View Middleware] Page view recorded/updated for: ${pagePath}`); // [除錯]
      } catch (err) {
          if (err.code === '23505' || err.message.includes('duplicate key value violates unique constraint')) { console.warn(`[Page View Middleware] Duplicate key for ${pagePath}`); }
          else if (err.message.includes('ON CONFLICT DO UPDATE command cannot affect row a second time')) { console.warn(`[Page View Middleware] ON CONFLICT race condition for ${pagePath}`); }
          else { console.error('[Page View Middleware] Error logging page view:', err); }
      }
  } else {
       console.log(`[Page View Middleware] Skipping log for: ${req.method} ${req.path}`); // [除錯]
  }
  next(); // *** 確保總是調用 next() ***
});



// --- 公開 API Routes (不需要認證) ---

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
    queryText += ' ORDER BY release_date DESC';
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
        const result = await pool.query('SELECT id, title, event_date, content, image_url, like_count, updated_at FROM news WHERE id = $1', [id]);
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
// --- *** 新增: 獲取每日流量數據 API *** ---




// --- *** Traffic API 定義 (現在肯定在 basicAuthMiddleware 定義之後) *** ---
// GET daily traffic data (受保護)
app.get('/api/analytics/traffic', basicAuthMiddleware, async (req, res) => { // <-- 使用 basicAuthMiddleware
  console.log("接收到 /api/analytics/traffic 請求");
  const daysToFetch = 30; const startDate = new Date(); startDate.setDate(startDate.getDate() - daysToFetch); const startDateString = startDate.toISOString().split('T')[0]; console.log(`計算起始日期: ${startDateString}`);
  try {
      const queryText = `SELECT view_date, SUM(view_count)::bigint AS count FROM page_views WHERE view_date >= $1 GROUP BY view_date ORDER BY view_date ASC`;
      console.log("執行的 SQL:", queryText, "參數:", [startDateString]);
      const result = await pool.query(queryText, [startDateString]);
      console.log("資料庫查詢結果行數:", result.rowCount);
      const trafficData = result.rows.map(row => ({ date: new Date(row.view_date).toISOString().split('T')[0], count: parseInt(row.count) }));
      console.log("準備回傳的流量數據:", trafficData);
      res.status(200).json(trafficData);
  } catch (err) { console.error('獲取流量數據時發生嚴重錯誤:', err); console.error('錯誤堆疊:', err.stack); res.status(500).json({ error: '伺服器內部錯誤，無法獲取流量數據。' }); }
});





// --- 受保護的管理頁面和 API Routes ---

// 保護管理 HTML 頁面的訪問
app.use(['/admin.html', '/music-admin.html', '/news-admin.html'], basicAuthMiddleware);

// --- 商品管理 API (受保護) ---
// CREATE a new product
app.post('/api/products', basicAuthMiddleware, async (req, res) => { // <-- 添加 basicAuthMiddleware
    const { name, description, price, image_url, seven_eleven_url } = req.body;
    // ... (驗證邏輯) ...
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
app.put('/api/products/:id', basicAuthMiddleware, async (req, res) => { // <-- 添加 basicAuthMiddleware
    const { id } = req.params;
    const { name, description, price, image_url, seven_eleven_url } = req.body;
    // ... (驗證邏輯) ...
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的商品 ID 格式。' }); } if (typeof name !== 'string' || name.trim() === '') { return res.status(400).json({ error: '商品名稱不能為空。' }); } let priceValue = null; if (price !== undefined && price !== null && price !== '') { priceValue = parseFloat(price); if (isNaN(priceValue)) { return res.status(400).json({ error: '無效的價格格式。' }); } if (priceValue < 0) { return res.status(400).json({ error: '價格不能為負數。' }); } } const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'); if (seven_eleven_url && !isValidUrl(seven_eleven_url)) { return res.status(400).json({ error: '無效的 7-11 連結格式。' }); }
    try {
        const result = await pool.query(`UPDATE products SET name = $1, description = $2, price = $3, image_url = $4, seven_eleven_url = $5, updated_at = NOW() WHERE id = $6 RETURNING *`, [ name, description || null, priceValue, image_url || null, seven_eleven_url || null, id ]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到商品，無法更新。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) { console.error(`更新商品 ID ${id} 時出錯:`, err); res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' }); }
});
// DELETE a product by ID
app.delete('/api/products/:id', basicAuthMiddleware, async (req, res) => { // <-- 添加 basicAuthMiddleware
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
app.post('/api/music', basicAuthMiddleware, async (req, res) => { // <-- 添加 basicAuthMiddleware
    const { title, artist, cover_art_url, platform_url, release_date, description } = req.body;
    // ... (驗證邏輯) ...
    if (typeof title !== 'string' || title.trim() === '') { return res.status(400).json({ error: '音樂標題不能為空。' }); } if (typeof artist !== 'string' || artist.trim() === '') { return res.status(400).json({ error: '歌手名稱不能為空。' }); } let formattedReleaseDate = null; if (release_date) { try { formattedReleaseDate = new Date(release_date).toISOString().split('T')[0]; } catch (e) { return res.status(400).json({ error: '無效的發行日期格式。' }); } } const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'); if (cover_art_url && !isValidUrl(cover_art_url)) { return res.status(400).json({ error: '無效的封面路徑格式。' }); } if (platform_url && !isValidUrl(platform_url)) { return res.status(400).json({ error: '無效的平台連結格式。' }); }
    try {
        const result = await pool.query(`INSERT INTO music (title, artist, cover_art_url, platform_url, release_date, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`, [ title, artist, cover_art_url || null, platform_url || null, formattedReleaseDate, description || null ]);
        res.status(201).json(result.rows[0]);
    } catch (err) { console.error('新增音樂時出錯:', err); res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' }); }
});
// UPDATE a music item by ID
app.put('/api/music/:id', basicAuthMiddleware, async (req, res) => { // <-- 添加 basicAuthMiddleware
    const { id } = req.params;
    const { title, artist, cover_art_url, platform_url, release_date, description } = req.body;
    // ... (驗證邏輯) ...
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的音樂 ID 格式。' }); } if (typeof title !== 'string' || title.trim() === '') { return res.status(400).json({ error: '音樂標題不能為空。' }); } if (typeof artist !== 'string' || artist.trim() === '') { return res.status(400).json({ error: '歌手名稱不能為空。' }); } let formattedReleaseDate = null; if (release_date) { try { formattedReleaseDate = new Date(release_date).toISOString().split('T')[0]; } catch (e) { return res.status(400).json({ error: '無效的發行日期格式。' }); } } const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'); if (cover_art_url && !isValidUrl(cover_art_url)) { return res.status(400).json({ error: '無效的封面路徑格式。' }); } if (platform_url && !isValidUrl(platform_url)) { return res.status(400).json({ error: '無效的平台連結格式。' }); }
    try {
        const result = await pool.query(`UPDATE music SET title = $1, artist = $2, cover_art_url = $3, platform_url = $4, release_date = $5, description = $6, updated_at = NOW() WHERE id = $7 RETURNING *`, [ title, artist, cover_art_url || null, platform_url || null, formattedReleaseDate, description || null, id ]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到音樂項目，無法更新。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) { console.error(`更新音樂 ID ${id} 時出錯:`, err); res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' }); }
});
// DELETE a music item by ID
app.delete('/api/music/:id', basicAuthMiddleware, async (req, res) => { // <-- 添加 basicAuthMiddleware
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
app.post('/api/news', basicAuthMiddleware, async (req, res) => { // <-- 添加 basicAuthMiddleware
    const { title, event_date, summary, content, thumbnail_url, image_url } = req.body;
    // ... (驗證邏輯) ...
    if (typeof title !== 'string' || title.trim() === '') { return res.status(400).json({ error: '消息標題不能為空。' }); } let formattedEventDate = null; if (event_date) { try { formattedEventDate = new Date(event_date).toISOString().split('T')[0]; } catch (e) { return res.status(400).json({ error: '無效的活動日期格式。' }); } } const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'); if (thumbnail_url && !isValidUrl(thumbnail_url)) { return res.status(400).json({ error: '無效的縮圖路徑格式。' }); } if (image_url && !isValidUrl(image_url)) { return res.status(400).json({ error: '無效的大圖路徑格式。' }); }
    try {
        const result = await pool.query(`INSERT INTO news (title, event_date, summary, content, thumbnail_url, image_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`, [ title, formattedEventDate, summary || null, content || null, thumbnail_url || null, image_url || null ]);
        res.status(201).json(result.rows[0]);
    } catch (err) { console.error('新增消息時出錯:', err); res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' }); }
});
// UPDATE a news item by ID
app.put('/api/news/:id', basicAuthMiddleware, async (req, res) => { // <-- 添加 basicAuthMiddleware
    const { id } = req.params;
    const { title, event_date, summary, content, thumbnail_url, image_url } = req.body;
    // ... (驗證邏輯) ...
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); } if (typeof title !== 'string' || title.trim() === '') { return res.status(400).json({ error: '消息標題不能為空。' }); } let formattedEventDate = null; if (event_date) { try { formattedEventDate = new Date(event_date).toISOString().split('T')[0]; } catch (e) { return res.status(400).json({ error: '無效的活動日期格式。' }); } } const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'); if (thumbnail_url && !isValidUrl(thumbnail_url)) { return res.status(400).json({ error: '無效的縮圖路徑格式。' }); } if (image_url && !isValidUrl(image_url)) { return res.status(400).json({ error: '無效的大圖路徑格式。' }); }
    try {
        const result = await pool.query(`UPDATE news SET title = $1, event_date = $2, summary = $3, content = $4, thumbnail_url = $5, image_url = $6, updated_at = NOW() WHERE id = $7 RETURNING *`, [ title, formattedEventDate, summary || null, content || null, thumbnail_url || null, image_url || null, id ]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到消息，無法更新。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) { console.error(`更新消息 ID ${id} 時出錯:`, err); res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' }); }
});
// DELETE a news item by ID
app.delete('/api/news/:id', basicAuthMiddleware, async (req, res) => { // <-- 添加 basicAuthMiddleware
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); }
    try {
        const result = await pool.query('DELETE FROM news WHERE id = $1', [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到消息，無法刪除。' }); }
        res.status(204).send();
    } catch (err) { console.error(`刪除消息 ID ${id} 時出錯:`, err); res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' }); }
});


// --- 可選的 SPA Catch-all 路由 ---
// 如果你的前端用了路由庫(如 React Router, Vue Router)並且設置了 history 模式，
// 你可能需要取消這個註解，讓所有未匹配 API 的 GET 請求都返回 index.html
/*
app.get('*', (req, res) => {
  // 確保請求不是指向 API 或現有靜態文件
  if (!req.path.startsWith('/api/') && req.path.indexOf('.') === -1) {
     res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
     // 如果是 API 或靜態文件請求但未匹配，讓 Express 處理 (通常是 404)
     // 或者你可以在這裡明確返回 404
     res.status(404).send('資源未找到');
  }
});
*/

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