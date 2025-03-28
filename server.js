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
    // 可以在這裡加上更詳細的錯誤處理，例如檢查是否 DATABASE_URL 未設定
    if (!process.env.DATABASE_URL) {
        console.error("錯誤原因：DATABASE_URL 環境變數未設定。請檢查 .env 檔案或 Render 環境變數。");
    }
  }
}
// --- 資料庫連接設定結束 ---

// --- 中介軟體設定 ---
// 設定靜態檔案目錄 (重要！)
// 告訴 Express 去哪裡找 HTML, CSS, JS 檔案
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
    // 從連接池獲取連接，執行查詢，然後釋放連接
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release(); // 確保釋放連接
    res.json({ dbTime: result.rows[0].now });
  } catch (err) {
    console.error("查詢資料庫時間失敗:", err);
    res.status(500).json({ error: '無法查詢資料庫' });
  }
});
// --- API 路由設定結束 ---

// API 路由：獲取所有商品列表
app.get('/api/products', async (req, res) => {
  console.log("收到獲取所有商品的請求"); // 在後端日誌中加個標記，方便追蹤
  try {
    // 從連接池獲取連接，執行查詢，然後釋放連接
    const client = await pool.connect();
    // 執行 SQL 查詢，選取 products 表格中的所有欄位 (*)
    const result = await client.query('SELECT * FROM products ORDER BY created_at DESC'); // 按建立時間降冪排序，新的在前
    client.release(); // 確保釋放連接

    // 將查詢結果 (result.rows 是一個包含所有商品物件的陣列) 以 JSON 格式回傳
    res.json(result.rows);
    console.log("成功獲取並回傳商品列表，數量:", result.rows.length);

  } catch (err) {
    // 如果查詢過程中發生錯誤
    console.error("查詢商品列表時發生錯誤:", err);
    // 回傳 500 伺服器內部錯誤狀態碼，並附帶錯誤訊息
    res.status(500).json({ error: '無法從資料庫獲取商品列表' });
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