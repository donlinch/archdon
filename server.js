// server.js (完整版 - 支援前台 SPA 和獨立 admin.html)

require('dotenv').config();
const { Pool } = require('pg');
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const app = express();
const port = process.env.PORT || 3000;

// --- Database Connection ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testDbConnection() {
  try {
    const client = await pool.connect();
    console.log("成功連接到 PostgreSQL 資料庫！");
    const timeResult = await client.query('SELECT NOW()');
    console.log("資料庫目前時間:", timeResult.rows[0].now);
    client.release();
  } catch (err) {
    console.error("!!! 連接資料庫時發生錯誤:", err.message);
    if (!process.env.DATABASE_URL) {
        console.error("錯誤原因：DATABASE_URL 環境變數未設定。");
    }
  }
}
// --- End Database Connection ---

// --- Middleware ---
// 提供 public 資料夾中的靜態檔案 (index.html, admin.html, app.js, admin.js, style.css, images 等)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // 解析 JSON body
app.use(express.urlencoded({ extended: true })); // 解析 URL-encoded body

// Session Middleware
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions', // 確保此表格存在
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'a_very_secret_key_for_dev_12345', // 建議使用更強的密鑰
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // 正式環境應為 true (需要 HTTPS)
      httpOnly: true, // 增加安全性
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax' // 建議添加 SameSite 屬性
    }
}));
// --- End Middleware ---

// --- Authentication Middleware ---
function requireAdmin(req, res, next) {
  // 保護 API 路由
  if (req.session && req.session.isAdmin === true) {
    next();
  } else {
    console.log("[requireAdmin] API 驗證失敗 for:", req.originalUrl);
    res.status(401).json({ success: false, message: '未授權或 Session 過期，請重新登入' });
  }
}
// --- End Authentication Middleware ---

// --- API Routes ---

// === Auth APIs ===
app.post('/api/login', (req, res) => {
    console.log('Received request for /api/login'); // 添加日誌方便除錯
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
         console.error("錯誤：ADMIN_PASSWORD 環境變數未設定！");
         return res.status(500).json({ success: false, message: '伺服器設定錯誤' });
    }

    if (password && password === adminPassword) {
        req.session.isAdmin = true;
        console.log("管理員登入成功 via API, Session ID:", req.sessionID);
        res.json({ success: true, message: '登入成功' });
    } else {
        console.log("管理員登入失敗 via API：密碼錯誤或未提供");
        res.status(401).json({ success: false, message: '密碼錯誤' });
    }
});

app.post('/api/logout', (req, res) => {
    const sessionID = req.sessionID;
    if (req.session) {
        req.session.destroy(err => {
            res.clearCookie('connect.sid'); // 清除 cookie
            if (err) {
                console.error(`登出時 Session (ID: ${sessionID}) 銷毀錯誤:`, err);
                res.status(500).json({ success: false, message: '登出時發生錯誤' });
            } else {
                console.log(`管理員已登出 via API，Session (ID: ${sessionID}) 已銷毀`);
                res.json({ success: true, message: '登出成功' });
            }
        });
    } else {
        console.log("登出請求 via API，但沒有找到 Session");
        res.json({ success: true, message: '已登出或 Session 不存在' });
    }
});

app.get('/api/auth/status', (req, res) => {
    if (req.session && req.session.isAdmin === true) {
        res.json({ success: true, isAdmin: true });
    } else {
        res.json({ success: true, isAdmin: false });
    }
});


// === Product APIs ===
app.get('/api/products', async (req, res) => {
    console.log("收到獲取所有商品的請求 (API)");
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM products ORDER BY created_at DESC');
      client.release();
      res.json(result.rows);
    } catch (err) {
      console.error("查詢商品列表時發生錯誤:", err);
      res.status(500).json({ error: '無法從資料庫獲取商品列表' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    const productId = req.params.id;
    console.log(`收到獲取商品 (ID: ${productId}) 的請求 (API)`);
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM products WHERE id = $1', [productId]);
      client.release();
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '找不到該商品' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(`查詢商品 (ID: ${productId}) 時發生錯誤:`, err);
      res.status(500).json({ error: '無法從資料庫獲取商品資料' });
    }
});

app.post('/api/products', requireAdmin, async (req, res) => {
    console.log("收到 API 新增商品請求，資料:", req.body);
    const { name, description, price, image_url, seven_eleven_url } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: '必須提供商品名稱' });
    }
    try {
        const client = await pool.connect();
        const sql = `INSERT INTO products (name, description, price, image_url, seven_eleven_url) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
        const values = [name, description || null, price || null, image_url || null, seven_eleven_url || null];
        const result = await client.query(sql, values);
        client.release();
        console.log("API 成功新增商品:", result.rows[0]);
        res.status(201).json({ success: true, message: '商品新增成功', product: result.rows[0] });
    } catch (err) {
        console.error("API 新增商品到資料庫時發生錯誤:", err);
        res.status(500).json({ success: false, message: '伺服器錯誤，無法新增商品' });
    }
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
    const productId = req.params.id;
    const { name, description, price, image_url, seven_eleven_url } = req.body;
    console.log(`收到 API 更新商品 (ID: ${productId}) 請求，資料:`, req.body);
    if (!name) {
        return res.status(400).json({ success: false, message: '必須提供商品名稱' });
    }
    try {
        const client = await pool.connect();
        const sql = `UPDATE products SET name = $1, description = $2, price = $3, image_url = $4, seven_eleven_url = $5, updated_at = NOW() WHERE id = $6 RETURNING *;`;
        const values = [name, description || null, price || null, image_url || null, seven_eleven_url || null, productId];
        const result = await client.query(sql, values);
        client.release();
        if (result.rowCount === 0) {
           return res.status(404).json({ success: false, message: `找不到要更新的商品 (ID: ${productId})` });
        }
        console.log("API 成功更新商品:", result.rows[0]);
        res.json({ success: true, message: '商品更新成功', product: result.rows[0] });
    } catch (err) {
        console.error(`API 更新商品 (ID: ${productId}) 到資料庫時發生錯誤:`, err);
        res.status(500).json({ success: false, message: '伺服器錯誤，無法更新商品' });
    }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
    const productId = req.params.id;
    console.log(`收到 API 刪除商品 (ID: ${productId}) 的請求`);
    try {
        const client = await pool.connect();
        const sql = `DELETE FROM products WHERE id = $1 RETURNING *;`;
        const result = await client.query(sql, [productId]);
        client.release();
        if (result.rowCount === 0) {
           return res.status(404).json({ success: false, message: '找不到該商品' });
        }
        console.log("API 成功刪除商品:", result.rows[0]);
        res.json({ success: true, message: '商品已成功刪除' });
    } catch (err) {
        console.error(`API 刪除商品 (ID: ${productId}) 時發生錯誤:`, err);
        res.status(500).json({ success: false, message: '伺服器錯誤，無法刪除商品' });
    }
});


// === Music APIs ===
app.get('/api/music', async (req, res) => {
    console.log("收到獲取所有音樂作品的請求 (API)");
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM music ORDER BY release_date DESC, created_at DESC');
      client.release();
      res.json(result.rows);
    } catch (err) {
      console.error("查詢音樂列表時發生錯誤:", err);
      res.status(500).json({ error: '無法從資料庫獲取音樂列表' });
    }
});

app.get('/api/music/:id', async (req, res) => {
    const musicId = req.params.id;
    console.log(`收到獲取音樂 (ID: ${musicId}) 的請求 (API)`);
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM music WHERE id = $1', [musicId]);
      client.release();
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '找不到該音樂作品' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(`查詢音樂 (ID: ${musicId}) 時發生錯誤:`, err);
      res.status(500).json({ error: '無法從資料庫獲取音樂資料' });
    }
});

app.post('/api/music', requireAdmin, async (req, res) => {
    console.log("收到 API 新增音樂請求，資料:", req.body);
    const { title, artist, description, release_date, cover_art_url, platform_url } = req.body;
    if (!title || !artist) {
        return res.status(400).json({ success: false, message: '必須提供標題和演出者' });
    }
    try {
        const client = await pool.connect();
        const sql = `INSERT INTO music (title, artist, description, release_date, cover_art_url, platform_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`;
        const values = [title, artist, description || null, release_date || null, cover_art_url || null, platform_url || null];
        const result = await client.query(sql, values);
        client.release();
        console.log("API 成功新增音樂:", result.rows[0]);
        res.status(201).json({ success: true, message: '音樂新增成功', music: result.rows[0] });
    } catch (err) {
        console.error("API 新增音樂到資料庫時發生錯誤:", err);
        res.status(500).json({ success: false, message: '伺服器錯誤，無法新增音樂' });
    }
});

app.put('/api/music/:id', requireAdmin, async (req, res) => {
    const musicId = req.params.id;
    const { title, artist, description, release_date, cover_art_url, platform_url } = req.body;
    console.log(`收到 API 更新音樂 (ID: ${musicId}) 請求，資料:`, req.body);
     if (!title || !artist) {
        return res.status(400).json({ success: false, message: '必須提供標題和演出者' });
    }
    try {
        const client = await pool.connect();
        const sql = `UPDATE music SET title = $1, artist = $2, description = $3, release_date = $4, cover_art_url = $5, platform_url = $6, updated_at = NOW() WHERE id = $7 RETURNING *;`;
        const values = [title, artist, description || null, release_date || null, cover_art_url || null, platform_url || null, musicId];
        const result = await client.query(sql, values);
        client.release();
        if (result.rowCount === 0) {
           return res.status(404).json({ success: false, message: `找不到要更新的音樂 (ID: ${musicId})` });
        }
        console.log("API 成功更新音樂:", result.rows[0]);
        res.json({ success: true, message: '音樂更新成功', music: result.rows[0] });
    } catch (err) {
        console.error(`API 更新音樂 (ID: ${musicId}) 到資料庫時發生錯誤:`, err);
        res.status(500).json({ success: false, message: '伺服器錯誤，無法更新音樂' });
    }
});

app.delete('/api/music/:id', requireAdmin, async (req, res) => {
    const musicId = req.params.id;
    console.log(`收到 API 刪除音樂 (ID: ${musicId}) 的請求`);
    try {
        const client = await pool.connect();
        const sql = `DELETE FROM music WHERE id = $1 RETURNING *;`;
        const result = await client.query(sql, [musicId]);
        client.release();
        if (result.rowCount === 0) {
           return res.status(404).json({ success: false, message: '找不到該音樂作品' });
        }
        console.log("API 成功刪除音樂:", result.rows[0]);
        res.json({ success: true, message: '音樂已成功刪除' });
    } catch (err) {
        console.error(`API 刪除音樂 (ID: ${musicId}) 時發生錯誤:`, err);
        res.status(500).json({ success: false, message: '伺服器錯誤，無法刪除音樂' });
    }
});
// --- End API Routes ---


// --- Page Serving Routes ---

// **新增**: 提供獨立的 admin.html
app.get('/admin', (req, res) => {
    console.log("Serving /admin request with admin.html");
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// **修改**: SPA 回退路由，處理所有其他非 API、非 /admin 的 GET 請求
app.get('*', (req, res, next) => { // 添加 next
  // 只處理 GET 請求
  if (req.method !== 'GET') {
    return next(); // 交給下一個處理器或 Express 預設處理
  }

  // 排除 API 和 /admin 路徑
  if (req.originalUrl.startsWith('/api') || req.originalUrl === '/admin') {
    return next(); // 不是我們要處理的 SPA 頁面請求，交給下一個
  }

  // 檢查是否請求靜態檔案 (雖然 express.static 應該先處理，但以防萬一)
  // 簡單檢查常見副檔名
  if (req.originalUrl.includes('.')) {
      // 假設是請求靜態檔案，讓 express.static 處理或最終 404
      return next();
  }


  // 如果是其他 GET 請求，則發送前台 SPA 的 index.html
  console.log(`Serving SPA fallback for: ${req.originalUrl}`);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- End Page Serving Routes ---


// --- Server Start ---
app.listen(port, () => {
  console.log(`伺服器正在監聽 port ${port}`);
  testDbConnection(); // 測試資料庫連接
});
// --- End Server Start ---