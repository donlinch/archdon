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

// 新增：API 路由：獲取單一商品資料
app.get('/api/products/:id', async (req, res) => {
  const productId = req.params.id; // 從 URL 路徑中獲取 :id 參數
  console.log(`收到獲取商品 (ID: ${productId}) 的請求`);
  try {
    const client = await pool.connect();
    // 使用參數化查詢，只選取特定 ID 的商品
    const result = await client.query('SELECT * FROM products WHERE id = $1', [productId]);
    client.release();

    if (result.rows.length === 0) {
      // 如果找不到該 ID 的商品
      console.log(`找不到商品 (ID: ${productId})`);
      return res.status(404).json({ error: '找不到該商品' });
    }

    // 回傳找到的第一個 (也是唯一一個) 商品物件
    res.json(result.rows[0]);
    console.log(`成功獲取並回傳商品 (ID: ${productId})`);

  } catch (err) {
    console.error(`查詢商品 (ID: ${productId}) 時發生錯誤:`, err);
    res.status(500).json({ error: '無法從資料庫獲取商品資料' });
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

// 新增：顯示「新增商品」的表單頁面
app.get('/admin/products/new', requireAdmin, (req, res) => {
  console.log("正在提供受保護的 /admin/products/new 頁面");
  res.sendFile(path.join(__dirname, 'views', 'admin-product-new.html')); // 發送新建立的 HTML
});

// 新增：顯示「編輯商品」的表單頁面
app.get('/admin/products/edit/:id', requireAdmin, (req, res) => {
  // :id 參數在這裡只是用來構成 URL，實際的資料獲取由前端 JS 完成
  console.log(`正在提供受保護的 /admin/products/edit/${req.params.id} 頁面`);
  res.sendFile(path.join(__dirname, 'views', 'admin-product-edit.html'));
});


// 新增：處理「新增商品」表單的提交 (POST)
app.post('/admin/products', requireAdmin, async (req, res) => {
  console.log("收到新增商品請求，資料:", req.body);
  // 從表單提交的 req.body 中獲取資料
  const { name, description, price, image_url, seven_eleven_url } = req.body;

  // 基本的後端驗證 (例如檢查名稱是否為空)
  if (!name) {
    console.error("新增商品失敗：缺少商品名稱");
    // TODO: 可以導回新增頁面並顯示錯誤訊息
    return res.status(400).send("錯誤：必須提供商品名稱。 <a href='/admin/products/new'>返回</a>");
  }

  try {
    const client = await pool.connect();
    // 準備 SQL INSERT 語句
    // 使用 $1, $2... 作為參數佔位符，防止 SQL 注入攻擊
    const sql = `
      INSERT INTO products (name, description, price, image_url, seven_eleven_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *; -- (可選) 返回剛剛插入的資料
    `;
    const values = [
      name,
      description || null, // 如果沒填描述，傳入 null
      price || null,       // 如果沒填價格，傳入 null (資料庫欄位允許 NULL)
      image_url || null,
      seven_eleven_url || null
    ];

    const result = await client.query(sql, values);
    client.release();

    console.log("成功新增商品:", result.rows[0]); // 顯示插入的資料

    // 新增成功後，重新導向回商品列表頁面
    res.redirect('/admin/products');

  } catch (err) {
    console.error("新增商品到資料庫時發生錯誤:", err);
    // TODO: 更友善的錯誤處理頁面
    res.status(500).send("伺服器錯誤，無法新增商品。 <a href='/admin/products'>返回列表</a>");
  }
});

// 新增：處理「編輯商品」表單的提交 (POST)
app.post('/admin/products/edit/:id', requireAdmin, async (req, res) => {
  const productId = req.params.id; // 從 URL 獲取要編輯的商品 ID
  // 從表單提交的 req.body 中獲取更新後的資料
  const { name, description, price, image_url, seven_eleven_url } = req.body;

  console.log(`收到更新商品 (ID: ${productId}) 請求，資料:`, req.body);

  // 基本的後端驗證
  if (!name) {
    console.error("更新商品失敗：缺少商品名稱");
    // TODO: 可以導回編輯頁面並顯示錯誤訊息
    return res.status(400).send(`錯誤：必須提供商品名稱。 <a href='/admin/products/edit/${productId}'>返回編輯</a>`);
  }

  try {
    const client = await pool.connect();
    // 準備 SQL UPDATE 語句
    // 使用 $1, $2... 佔位符，並用 WHERE id = $N 來指定更新哪一筆
    const sql = `
      UPDATE products
      SET name = $1, description = $2, price = $3, image_url = $4, seven_eleven_url = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *; -- (可選) 返回更新後的資料
    `;
    const values = [
      name,
      description || null,
      price || null,
      image_url || null,
      seven_eleven_url || null,
      productId // 將 productId 作為 WHERE 條件的值
    ];

    const result = await client.query(sql, values);
    client.release();

    if (result.rowCount === 0) {
       // 如果沒有任何行被更新 (可能該 ID 不存在)
       console.log(`更新商品失敗：找不到商品 (ID: ${productId})`);
       return res.status(404).send(`錯誤：找不到要更新的商品 (ID: ${productId})。 <a href='/admin/products'>返回列表</a>`);
    }

    console.log("成功更新商品:", result.rows[0]);

    // 更新成功後，重新導向回商品列表頁面
    res.redirect('/admin/products');

  } catch (err) {
    console.error(`更新商品 (ID: ${productId}) 到資料庫時發生錯誤:`, err);
    res.status(500).send(`伺服器錯誤，無法更新商品。 <a href='/admin/products/edit/${productId}'>返回編輯</a>`);
  }
});

// 新增：處理「刪除商品」的請求 (DELETE)
app.delete('/admin/products/:id', requireAdmin, async (req, res) => {
  const productId = req.params.id; // 從 URL 獲取要刪除的商品 ID
  console.log(`收到刪除商品 (ID: ${productId}) 的請求`);

  try {
    const client = await pool.connect();
    // 準備 SQL DELETE 語句
    const sql = `DELETE FROM products WHERE id = $1 RETURNING *;`; // 返回被刪除的資料 (可選)
    const values = [productId];

    const result = await client.query(sql, values);
    client.release();

    if (result.rowCount === 0) {
       // 如果沒有任何行被刪除 (可能該 ID 不存在)
       console.log(`刪除商品失敗：找不到商品 (ID: ${productId})`);
       // 可以回傳 404 錯誤
       return res.status(404).json({ success: false, message: '找不到該商品' });
    }

    console.log("成功刪除商品:", result.rows[0]);

    // 刪除成功後，回傳成功的 JSON 訊息
    // 前端 JS 收到成功訊息後，會負責重新整理頁面或移除表格行
    res.json({ success: true, message: '商品已成功刪除' });

  } catch (err) {
    console.error(`刪除商品 (ID: ${productId}) 時發生錯誤:`, err);
    // 回傳 500 錯誤
    res.status(500).json({ success: false, message: '伺服器錯誤，無法刪除商品' });
  }
});


// --- Server Start ---
app.listen(port, () => {
  console.log(`伺服器正在監聽 port ${port}`);
  testDbConnection();
});
// --- End Server Start ---