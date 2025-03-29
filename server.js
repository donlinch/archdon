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
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'a_very_secret_key_for_dev',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // 保持為 false 以便測試
        maxAge: 1000 * 60 * 60 * 24 * 7
        // httpOnly: true
    }
}));
// --- End Middleware ---

// --- Authentication Middleware ---
function requireAdmin(req, res, next) {
  console.log(`[requireAdmin] 檢查路徑: ${req.originalUrl}`);
  console.log(`[requireAdmin] Session 存在嗎?: ${!!req.session}`);
  if (req.session) {
      console.log(`[requireAdmin] Session ID: ${req.sessionID}`);
      console.log(`[requireAdmin] Session.isAdmin 值: ${req.session.isAdmin}`);
  }

  if (req.session && req.session.isAdmin === true) { // 使用嚴格比較
    console.log("[requireAdmin] 驗證通過，呼叫 next()");
    next();
  } else {
    console.log("[requireAdmin] 驗證失敗，重新導向到 /login");
    if (req.session) {
        req.session.destroy(err => { // 嘗試銷毀無效 session
            if(err) console.error("[requireAdmin] 銷毀無效 session 時出錯:", err);
            res.clearCookie('connect.sid'); // 再次嘗試清除 cookie
            res.redirect('/login');
        });
    } else {
        res.clearCookie('connect.sid'); // 再次嘗試清除 cookie
        res.redirect('/login');
    }
  }
}
// --- End Authentication Middleware ---


// --- API Routes ---
app.get('/api/hello', (req, res) => {
  res.json({ message: '來自後端的 SunnyYummy API 回應！' });
});

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

app.get('/api/music', async (req, res) => {
  console.log("收到獲取所有音樂作品的請求");
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM music ORDER BY release_date DESC, created_at DESC');
    client.release();
    res.json(result.rows);
    console.log("成功獲取並回傳音樂列表，數量:", result.rows.length);
  } catch (err) {
    console.error("查詢音樂列表時發生錯誤:", err);
    res.status(500).json({ error: '無法從資料庫獲取音樂列表' });
  }
});
// --- End API Routes ---

// --- Page & Auth Routes ---
// 顯示登入頁面
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 處理登入表單提交
app.post('/login', (req, res) => {
  const enteredPassword = req.body.password;
  const adminPassword = process.env.ADMIN_PASSWORD;
  console.log("收到登入嘗試");

  if (enteredPassword && enteredPassword === adminPassword) {
      req.session.isAdmin = true;
      console.log("管理員登入成功，Session 即將儲存");
      req.session.save(err => {
          if (err) {
              console.error("Session 儲存錯誤:", err);
              return res.redirect('/login?error=SessionSaveError');
          }
          console.log("Session 儲存成功，重新導向到 /admin");
          res.redirect('/admin'); // 導向後台主頁
      });
  } else {
      console.log("管理員登入失敗：密碼錯誤");
       res.redirect('/login?error=InvalidPassword');
  }
});

// 處理登出 <-- ***移到這裡***
app.get('/logout', (req, res) => {
  const sessionID = req.sessionID;
  if (req.session) {
      req.session.destroy(err => {
        res.clearCookie('connect.sid');
        if (err) {
          console.error(`登出時 Session (ID: ${sessionID}) 銷毀錯誤:`, err);
        } else {
          console.log(`管理員已登出，Session (ID: ${sessionID}) 已銷毀`);
        }
        res.redirect('/login');
      });
  } else {
      res.clearCookie('connect.sid');
      console.log("登出請求，但沒有找到 Session");
      res.redirect('/login');
  }
});

// --- End Page & Auth Routes ---


// --- Protected Admin Routes ---
// 顯示後台管理主頁
app.get('/admin', requireAdmin, (req, res) => {
  console.log("正在提供受保護的 /admin 頁面");
  res.sendFile(path.join(__dirname, 'views', 'admin.html')); // <--- 改成 'views'
});

// 顯示後台商品管理列表頁面
app.get('/admin/products', requireAdmin, (req, res) => {
  console.log("正在提供受保護的 /admin/products 頁面");
  res.sendFile(path.join(__dirname, 'views', 'admin-products.html')); // <--- 改成 'views'
});
// --- End Protected Admin Routes ---


// --- Server Start ---
app.listen(port, () => {
  console.log(`伺服器正在監聽 port ${port}`);
  testDbConnection();
});
// --- End Server Start ---