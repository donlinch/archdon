require('dotenv').config(); // 讀取 .env 檔案中的環境變數 (僅限本地)
const { Pool } = require('pg'); // 引入 pg 的 Pool
const express = require('express');
const path = require('path'); // Node.js 內建模組，用來處理檔案路徑

const app = express();
const port = process.env.PORT || 3000; // Render 會設定 PORT 環境變數，本地測試用 3000

// --- 資料庫連接設定 ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 如果在 Render 上部署，建議加上 SSL 連接設定
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 異步函數：測試資料庫連接
async function testDbConnection() {
  try {
    const client = await pool.connect(); // 嘗試從連接池獲取一個連接
    console.log("成功連接到 PostgreSQL 資料庫！");
    const timeResult = await client.query('SELECT NOW()'); // 執行一個簡單的 SQL 查詢
    console.log("資料庫目前時間:", timeResult.rows[0].now);
    client.release(); // 將連接釋放回連接池
  } catch (err) {
    console.error("!!! 連接資料庫時發生錯誤:", err.message); // 顯示更簡潔的錯誤訊息
    if (!process.env.DATABASE_URL) {
        console.error("錯誤原因：DATABASE_URL 環境變數未設定。請檢查 .env 檔案或 Render 環境變數。");
    }
  }
}
// --- 資料庫連接設定結束 ---

// --- 中介軟體設定 ---
app.use(express.static(path.join(__dirname, 'public')));
// --- 中介軟體設定結束 ---


// --- API 路由設定 ---
// API 路由：測試基本回應
app.get('/api/hello', (req, res) => {
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
    // 查詢 music 表格，按發行日期降冪排序 (如果 release_date 是 NULL 會排在後面)
    const result = await client.query('SELECT * FROM music ORDER BY release_date DESC, created_at DESC');
    client.release();

    res.json(result.rows); // 回傳音樂資料陣列
    console.log("成功獲取並回傳音樂列表，數量:", result.rows.length);

  } catch (err) {
    console.error("查詢音樂列表時發生錯誤:", err);
    res.status(500).json({ error: '無法從資料庫獲取音樂列表' });
  }
});

// --- API 路由設定結束 ---


// --- 伺服器啟動 ---
app.listen(port, () => {
  console.log(`伺服器正在監聽 port ${port}`);
  // 在伺服器啟動後測試資料庫連接
  testDbConnection();
});
// --- 伺服器啟動結束 ---