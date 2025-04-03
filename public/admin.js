const express = require('express');
const { Pool } = require('pg');  // 用於與 PostgreSQL 進行連接
const app = express();
const bodyParser = require('body-parser');

// 設置解析 JSON 請求的 middleware
app.use(bodyParser.json());

// 設定 PostgreSQL 連接池
const pool = new Pool({
    user: 'your-db-user',         // 替換為你的資料庫使用者
    host: 'localhost',            // 資料庫主機
    database: 'your-database',    // 替換為你的資料庫名稱
    password: 'your-db-password', // 替換為你的資料庫密碼
    port: 5432,                   // PostgreSQL 默認端口
});

// 新增商品及規格的 API 路由
app.post('/api/products', async (req, res) => {
    const { name, description, price, image_url, seven_eleven_url, variations } = req.body;

    // 驗證必填欄位
    if (!name || !price) {
        return res.status(400).json({ error: '商品名稱和價格是必填項目' });
    }

    const client = await pool.connect(); // 獲取資料庫連線
    try {
        // 開始一個交易，確保資料的一致性
        await client.query('BEGIN');
        
        // 插入商品資料
        const productInsertQuery = `INSERT INTO products (name, description, price, image_url, seven_eleven_url)
                                    VALUES ($1, $2, $3, $4, $5) RETURNING id`;
        const productResult = await client.query(productInsertQuery, [name, description, price, image_url, seven_eleven_url]);
        const productId = productResult.rows[0].id;

        // 插入規格資料 (product_variations)
        for (let variation of variations) {
            const { name, inventory_count, sku } = variation;
            const variationInsertQuery = `INSERT INTO product_variations (product_id, name, inventory_count, sku)
                                          VALUES ($1, $2, $3, $4)`;
            await client.query(variationInsertQuery, [productId, name, inventory_count, sku || null]);
        }

        // 提交交易
        await client.query('COMMIT');
        res.status(201).json({ message: '商品新增成功', productId });
    } catch (error) {
        // 若有錯誤，回滾交易
        await client.query('ROLLBACK');
        console.error('新增商品或規格失敗:', error);
        res.status(500).json({ error: '新增商品時發生錯誤' });
    } finally {
        // 釋放資料庫連線
        client.release();
    }
});

// 取得所有商品資料 API
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products');
        res.json(result.rows);
    } catch (error) {
        console.error('獲取商品列表失敗:', error);
        res.status(500).json({ error: '無法獲取商品列表' });
    }
});

// 取得特定商品資料 API
app.get('/api/products/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: '商品未找到' });
        }
        const product = productResult.rows[0];

        // 取得該商品的規格
        const variationsResult = await pool.query('SELECT * FROM product_variations WHERE product_id = $1', [productId]);
        product.variations = variationsResult.rows;

        res.json(product);
    } catch (error) {
        console.error('獲取商品資料失敗:', error);
        res.status(500).json({ error: '無法獲取商品資料' });
    }
});

// 更新商品 API
app.put('/api/products/:id', async (req, res) => {
    const productId = req.params.id;
    const { name, description, price, image_url, seven_eleven_url } = req.body;

    try {
        const result = await pool.query(
            `UPDATE products SET name = $1, description = $2, price = $3, image_url = $4, seven_eleven_url = $5
            WHERE id = $6 RETURNING *`,
            [name, description, price, image_url, seven_eleven_url, productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '商品未找到' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('更新商品資料失敗:', error);
        res.status(500).json({ error: '無法更新商品資料' });
    }
});

// 刪除商品 API
app.delete('/api/products/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [productId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '商品未找到' });
        }
        res.json({ message: `商品 ID: ${productId} 已刪除` });
    } catch (error) {
        console.error('刪除商品資料失敗:', error);
        res.status(500).json({ error: '無法刪除商品資料' });
    }
});

// 設置伺服器監聽端口
app.listen(3000, () => {
    console.log('伺服器已啟動，端口：3000');
});
