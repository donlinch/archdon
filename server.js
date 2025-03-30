// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- API Routes ---

// GET all products (已修改以支持排序)
app.get('/api/products', async (req, res) => {
    // 從查詢參數獲取排序方式，預設為 'latest' (最新)
    const sortBy = req.query.sort || 'latest';

    let orderByClause = 'ORDER BY created_at DESC'; // 預設按最新排序

    if (sortBy === 'popular') {
        orderByClause = 'ORDER BY click_count DESC, created_at DESC'; // 按點擊數降冪，點擊數相同則按最新
    }
    // 如果將來有手動排序: else if (sortBy === 'manual') { orderByClause = 'ORDER BY sort_order ASC, created_at DESC'; }

    try {
        // 在 SQL 查詢中動態插入排序子句，並選取 click_count
        const queryText = `SELECT id, name, description, price, image_url, seven_eleven_url, click_count FROM products ${orderByClause}`;
        const result = await pool.query(queryText);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取商品列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET a single product by ID (已修改以包含 click_count)
app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的商品 ID 格式。' });
    }
    try {
        // 確保查詢包含 click_count
        const result = await pool.query(
            'SELECT id, name, description, price, image_url, seven_eleven_url, click_count FROM products WHERE id = $1',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到商品。' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`獲取商品 ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});


// --- 新增: 音樂相關 API Routes ---

// GET 所有歌手列表 (用於篩選)
app.get('/api/artists', async (req, res) => {
  try {
      // 從 music 表中選取不重複的 artist，並按字母排序
      const result = await pool.query('SELECT DISTINCT artist FROM music WHERE artist IS NOT NULL ORDER BY artist ASC');
      // 將結果轉換成簡單的字串陣列
      const artists = result.rows.map(row => row.artist);
      res.json(artists);
  } catch (err) {
      console.error('獲取歌手列表時出錯:', err);
      res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// GET 音樂列表 (支持按歌手篩選，預設按發行日期最新排序)
app.get('/api/music', async (req, res) => {
  // 從查詢參數獲取歌手名稱
  const artistFilter = req.query.artist || null; // 例如 /api/music?artist=林莉C亞米

  let queryText = 'SELECT id, title, artist, cover_art_url, platform_url, release_date, description FROM music';
  const queryParams = [];

  // 如果有提供歌手篩選條件
  if (artistFilter) {
      queryText += ' WHERE artist = $1'; // 添加 WHERE 子句
      queryParams.push(artistFilter); // 將歌手名稱加入參數陣列
  }

  queryText += ' ORDER BY release_date DESC'; // 按發行日期降冪排序 (最新在前)

  try {
      const result = await pool.query(queryText, queryParams); // 執行查詢
      res.json(result.rows);
  } catch (err) {
      console.error('獲取音樂列表時出錯:', err);
      res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// GET 單一音樂項目 (給編輯頁面用)
app.get('/api/music/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: '無效的音樂 ID 格式。' });
  }
  try {
      // 查詢特定 ID 的音樂資料
      const result = await pool.query(
          'SELECT id, title, artist, cover_art_url, platform_url, release_date, description FROM music WHERE id = $1',
          [id]
      );
      if (result.rows.length === 0) {
          return res.status(404).json({ error: '找不到該音樂項目。' });
      }
      res.json(result.rows[0]);
  } catch (err) {
      console.error(`獲取音樂 ID ${id} 時出錯:`, err);
      res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// --- 音樂管理的 CRUD API (之後再添加) ---
// POST /api/music   (新增)
// PUT /api/music/:id (更新)
// DELETE /api/music/:id (刪除)



// UPDATE a product by ID
app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, price, image_url, seven_eleven_url } = req.body;

    // --- Validation for PUT (與之前相同) ---
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的商品 ID 格式。' }); }
    if (typeof name !== 'string' || name.trim() === '') { return res.status(400).json({ error: '商品名稱不能為空。' }); }
    let priceValue = null;
    if (price !== undefined && price !== null && price !== '') {
        priceValue = parseFloat(price);
        if (isNaN(priceValue)) { return res.status(400).json({ error: '無效的價格格式。必須是數字。' }); }
        if (priceValue < 0) { return res.status(400).json({ error: '價格不能為負數。' }); }
    }
    const isValidUrl = (urlString) => { if (!urlString) return true; return urlString.startsWith('/') || urlString.startsWith('http://') || urlString.startsWith('https://'); };
    if (seven_eleven_url && !isValidUrl(seven_eleven_url)) { return res.status(400).json({ error: '無效的 7-11 連結格式。' }); }
    // --- End Validation for PUT ---

    try {
        const result = await pool.query(
            `UPDATE products
             SET name = $1, description = $2, price = $3, image_url = $4, seven_eleven_url = $5, updated_at = NOW()
             WHERE id = $6
             RETURNING *`, // RETURNING * 會包含所有欄位，包括 click_count
            [ name, description || null, priceValue, image_url || null, seven_eleven_url || null, id ]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到商品，無法更新。' });
        }
        res.status(200).json(result.rows[0]); // 回傳更新後的商品資料
    } catch (err) {
        console.error(`更新商品 ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' });
    }
});

// CREATE a new product
app.post('/api/products', async (req, res) => {
    const { name, description, price, image_url, seven_eleven_url } = req.body;

    // --- Validation for POST (與之前相同) ---
    if (typeof name !== 'string' || name.trim() === '') { return res.status(400).json({ error: '商品名稱不能為空。' }); }
    let priceValue = null;
    if (price !== undefined && price !== null && price !== '') {
        priceValue = parseFloat(price);
        if (isNaN(priceValue)) { return res.status(400).json({ error: '無效的價格格式。必須是數字。' }); }
        if (priceValue < 0) { return res.status(400).json({ error: '價格不能為負數。' }); }
    }
    const isValidUrl = (urlString) => { if (!urlString) return true; return urlString.startsWith('/') || urlString.startsWith('http://') || urlString.startsWith('https://'); };
    if (seven_eleven_url && !isValidUrl(seven_eleven_url)) { return res.status(400).json({ error: '無效的 7-11 連結格式。' }); }
    // --- End Validation for POST ---

    try {
        // click_count 會使用資料庫預設值 0
        const result = await pool.query(
            `INSERT INTO products (name, description, price, image_url, seven_eleven_url, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING *`, // RETURNING * 會包含新生成的 ID 和預設的 click_count
            [ name, description || null, priceValue, image_url || null, seven_eleven_url || null ]
        );
        res.status(201).json(result.rows[0]); // 回傳新建立的商品資料
    } catch (err) {
        console.error('新增商品時出錯:', err);
        res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' });
    }
});

// DELETE a product by ID
app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的商品 ID 格式。' });
    }
    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到商品，無法刪除。' });
        }
        res.status(204).send(); // 成功刪除，無內容返回
    } catch (err) {
        console.error(`刪除商品 ID ${id} 時出錯:`, err);
        if (err.code === '23503') {
             return res.status(409).json({ error: '無法刪除商品，因為它被其他資料引用。' });
        }
        res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' });
    }
});

// --- 新增: API 端點來記錄商品點擊 ---
app.post('/api/products/:id/click', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        // 即使 ID 無效，我們也靜默處理，不影響前端跳轉
        console.warn(`收到無效 ID (${id}) 的點擊記錄請求`);
        return res.status(204).send(); // 返回成功，但不做任何事
    }
    try {
        // 更新點擊次數，不關心結果是否找到 (找不到也沒關係)
        await pool.query('UPDATE products SET click_count = click_count + 1 WHERE id = $1', [id]);
        res.status(204).send(); // 成功記錄，無內容返回
    } catch (err) {
        console.error(`記錄商品 ID ${id} 點擊時出錯:`, err);
        // 出錯也返回成功，避免影響前端用戶體驗
        res.status(204).send(); // 或者可以返回 500，但前端可能需要處理
    }
});



// --- 新增: 音樂管理 API Routes ---

// POST /api/music - 新增音樂項目
app.post('/api/music', async (req, res) => {
  // 從請求主體獲取資料
  const { title, artist, cover_art_url, platform_url, release_date, description } = req.body;

  // --- 基本輸入驗證 ---
  if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: '音樂標題不能為空。' });
  }
  if (typeof artist !== 'string' || artist.trim() === '') {
      return res.status(400).json({ error: '歌手名稱不能為空。' });
  }
  // 驗證 release_date 是否是有效的日期格式 (YYYY-MM-DD) 或可被 JS Date 解析
  let formattedReleaseDate = null;
  if (release_date) {
      try {
          // 嘗試轉換為 Date 物件再轉回 ISO 字串 (YYYY-MM-DD) 來標準化/驗證
          formattedReleaseDate = new Date(release_date).toISOString().split('T')[0];
      } catch (e) {
          return res.status(400).json({ error: '無效的發行日期格式。請使用 YYYY-MM-DD。' });
      }
  } else {
      // 如果沒提供發行日期，是否允許？或是設為必填？這裡先設為 null
      // return res.status(400).json({ error: '發行日期不能為空。' });
  }

  const isValidUrl = (urlString) => { if (!urlString) return true; return urlString.startsWith('/') || urlString.startsWith('http://') || urlString.startsWith('https://'); };
  if (cover_art_url && !isValidUrl(cover_art_url)) { return res.status(400).json({ error: '無效的封面圖片路徑格式。' }); }
  if (platform_url && !isValidUrl(platform_url)) { return res.status(400).json({ error: '無效的平台連結格式。' }); }
  // --- 結束驗證 ---

  try {
      // 執行 INSERT 語句
      const result = await pool.query(
          `INSERT INTO music (title, artist, cover_art_url, platform_url, release_date, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING *`, // 返回新插入的行
          [
              title,
              artist,
              cover_art_url || null,
              platform_url || null,
              formattedReleaseDate, // 使用格式化/驗證過的日期
              description || null
          ]
      );
      // 以 201 Created 狀態回傳新建立的音樂資料
      res.status(201).json(result.rows[0]);
  } catch (err) {
      console.error('新增音樂時出錯:', err);
      res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' });
  }
});

// PUT /api/music/:id - 更新音樂項目
app.put('/api/music/:id', async (req, res) => {
  const { id } = req.params;
  // 從請求主體獲取要更新的資料
  const { title, artist, cover_art_url, platform_url, release_date, description } = req.body;

  // --- 輸入驗證 ---
  if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的音樂 ID 格式。' }); }
  if (typeof title !== 'string' || title.trim() === '') { return res.status(400).json({ error: '音樂標題不能為空。' }); }
  if (typeof artist !== 'string' || artist.trim() === '') { return res.status(400).json({ error: '歌手名稱不能為空。' }); }

  let formattedReleaseDate = null;
  if (release_date) {
      try { formattedReleaseDate = new Date(release_date).toISOString().split('T')[0]; }
      catch (e) { return res.status(400).json({ error: '無效的發行日期格式。請使用 YYYY-MM-DD。' }); }
  }
  // else { return res.status(400).json({ error: '發行日期不能為空。' }); } // 如果要求必填

  const isValidUrl = (urlString) => { if (!urlString) return true; return urlString.startsWith('/') || urlString.startsWith('http://') || urlString.startsWith('https://'); };
  if (cover_art_url && !isValidUrl(cover_art_url)) { return res.status(400).json({ error: '無效的封面圖片路徑格式。' }); }
  if (platform_url && !isValidUrl(platform_url)) { return res.status(400).json({ error: '無效的平台連結格式。' }); }
  // --- 結束驗證 ---

  try {
      // 執行 UPDATE 語句
      const result = await pool.query(
          `UPDATE music
           SET title = $1, artist = $2, cover_art_url = $3, platform_url = $4, release_date = $5, description = $6, updated_at = NOW()
           WHERE id = $7
           RETURNING *`, // 返回更新後的行
          [
              title,
              artist,
              cover_art_url || null,
              platform_url || null,
              formattedReleaseDate,
              description || null,
              id // WHERE 條件的 ID
          ]
      );

      if (result.rowCount === 0) {
          // 如果沒有找到對應 ID 的記錄
          return res.status(404).json({ error: '找不到音樂項目，無法更新。' });
      }
      // 以 200 OK 狀態回傳更新後的音樂資料
      res.status(200).json(result.rows[0]);
  } catch (err) {
      console.error(`更新音樂 ID ${id} 時出錯:`, err);
      res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' });
  }
});

// DELETE /api/music/:id - 刪除音樂項目
app.delete('/api/music/:id', async (req, res) => {
  const { id } = req.params;

  // --- 驗證 ---
  if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: '無效的音樂 ID 格式。' });
  }
  // --- 結束驗證 ---

  try {
      // 執行 DELETE 語句
      const result = await pool.query('DELETE FROM music WHERE id = $1', [id]);

      if (result.rowCount === 0) {
          // 如果沒有找到對應 ID 的記錄
          return res.status(404).json({ error: '找不到音樂項目，無法刪除。' });
      }
      // 成功刪除，返回 204 No Content
      res.status(204).send();
  } catch (err) {
      console.error(`刪除音樂 ID ${id} 時出錯:`, err);
      // 如果 music 表有被其他表引用，這裡可以添加外鍵錯誤檢查 (err.code === '23503')
      res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' });
  }
});
// --- 可選的 SPA Catch-all 路由 (目前註解掉) ---
/*
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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