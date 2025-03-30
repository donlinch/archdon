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