require('dotenv').config(); // 讀取 .env 檔案中的環境變數 (僅限本地)
const { Pool } = require('pg'); // 引入 pg 的 Pool
const express = require('express');
const path = require('path'); // Node.js 內建模組，用來處理檔案路徑
const session = require('express-session'); // 引入 express-session

const app = express();
const port = process.env.PORT || 3000; // Render 會設定 PORT 環境變數，本地測試用 3000

// --- 資料庫連接設定 ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 異步函數：測試資料庫連接
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
        console.error("錯誤原因：DATABASE_URL 環境變數未設定。請檢查 .env 檔案或 Render 環境變數。");
    }
  }
}
// --- 資料庫連接設定結束 ---

// --- 中介軟體設定 ---
// **重要：中介軟體需要在路由定義之前設定**

// 設定靜態檔案目錄
app.use(express.static(path.join(__dirname, 'public')));

// 解析 POST 請求的 body (用於登入表單)
app.use(express.json()); // 解析 application/json
app.use(express.urlencoded({ extended: true })); // 解析 application/x-www-form-urlencoded

// 設定 Session 中介軟體
app.use(session({
    secret: process.env.SESSION_SECRET || 'a_very_secret_key_for_dev', // 用環境變數或預設值
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // 生產環境要求 HTTPS
        maxAge: 1000 * 60 * 60 * 24 // 24 小時
        // httpOnly: true // 建議開啟以增加安全性
    }
}));
// --- 中介軟體設定結束 ---



// --- 驗證中介軟體 ---
// 這個函數會檢查使用者是否已登入 (Session 中是否有 isAdmin 標記)
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    // 如果已登入 (isAdmin 為 true)，則允許繼續處理請求
    console.log("管理員已驗證，Session ID:", req.sessionID); // 可以在日誌中看到 Session ID
    next();
  } else {
    // 如果未登入，重新導向到登入頁面
    console.log("未授權的訪問，重新導向到登入頁");
    res.redirect('/login');
  }
}
// --- 驗證中介軟體結束 ---


// --- API 路由設定 ---
// API 路由：測試基本回應
app.get('/api/hello', (req, res) => {
  // 檢查 session 是否存在 (測試用)
  // console.log('Session in /api/hello:', req.session);
  res.json({ message: '來自後端的 SunnyYummy API 回應！' });
});

// API 路由：測試從資料庫讀取時間
app.get('/api/db-time', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    res.json({ dbTime: result.rows[0].now });
  } catch (err) {
    console.error("查詢資料庫時間失敗:", err);
    res.status(500).json({ error: '無法查詢資料庫' });
  }
});

// API 路由：獲取所有商品列表
app.get('/api/products', async (req, res) => {
  console.log("收到獲取所有商品的請求");
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM products ORDER BY created_at DESC');
    client.release();
    res.json(result.rows);
    console.log("成功獲取並回傳商品列表，數量:", result.rows.length);
  } catch (err) {
    console.error("查詢商品列表時發生錯誤:", err);
    res.status(500).json({ error: '無法從資料庫獲取商品列表' });
  } 
});

// API 路由：獲取所有音樂作品列表
app.get('/api/music', async (req, res) => {
  console.log("收到獲取所有音樂作品的請求");
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM music ORDER BY release_date DESC, created_at DESC');
    client.release();
    res.json(result.rows); // 回傳音樂資料陣列
    console.log("成功獲取並回傳音樂列表，數量:", result.rows.length);
  } catch (err) {
    console.error("查詢音樂列表時發生錯誤:", err);
    res.status(500).json({ error: '無法從資料庫獲取音樂列表' });
  }
});

// 路由：顯示登入頁面
app.get('/login', (req, res) => {
  // 直接發送 public/login.html 檔案
  // 我們可以假設如果使用者已經登入，訪問 /login 就直接跳轉到後台 (之後再加)
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 路由：處理登入表單提交 (POST 請求)
app.post('/login', (req, res) => {
  const enteredPassword = req.body.password; // 獲取表單提交的密碼
  const adminPassword = process.env.ADMIN_PASSWORD; // 從環境變數獲取正確的密碼

  console.log("收到登入嘗試"); // 日誌記錄

  // 檢查密碼是否正確
  if (enteredPassword && enteredPassword === adminPassword) {
    // 密碼正確！在 Session 中設定登入標記
    req.session.isAdmin = true;
    console.log("管理員登入成功，Session 即將儲存");

    // --- 修改這裡：確保 Session 儲存後再重新導向 ---
    req.session.save(err => {
        if (err) {
            // 如果儲存 Session 出錯
            console.error("Session 儲存錯誤:", err);
            // 可以導向到錯誤頁面或登入頁
            return res.redirect('/login?error=SessionSaveError');
        }
        // Session 儲存成功，現在可以安全地重新導向
        console.log("Session 儲存成功，重新導向到 /admin");
        res.redirect('/admin');
    });
    // --- 修改結束 ---

} else {
    // 密碼錯誤
    // ... (保持不變) ...
    res.redirect('/login?error=InvalidPassword');
}
});



  

// --- API 路由設定結束 ---



// --- 受保護的後台路由 ---
// 顯示後台管理頁面 - 在這個路由前加上 requireAdmin 中介軟體
app.get('/admin', requireAdmin, (req, res) => {
  console.log("正在提供受保護的 /admin 頁面");
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
// --- 受保護的後台路由結束 ---



// --- 伺服器啟動 ---
app.listen(port, () => {
  console.log(`伺服器正在監聽 port ${port}`);
  // 在伺服器啟動後測試資料庫連接
  testDbConnection();
});
// --- 伺服器啟動結束 ---