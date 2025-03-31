// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;

// 資料庫連接池設定
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 基本認證中間件
const basicAuthMiddleware = (req, res, next) => {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'password';
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send('需要認證才能訪問管理區域。');
    }
    
    try {
        const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const user = auth[0];
        const pass = auth[1];
        
        if (user === adminUser && pass === adminPass) {
            next();
        } else {
            res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
            return res.status(401).send('認證失敗。');
        }
    } catch (error) {
        console.error("認證標頭解析錯誤:", error);
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send('認證失敗 (格式錯誤)。');
    }
};

// 中間件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 記錄 Page View 中間件
app.use(async (req, res, next) => {
    const pathsToLog = ['/', '/index.html', '/music.html', '/news.html'];
    const shouldLog = pathsToLog.includes(req.path) && req.method === 'GET';

    if (shouldLog) {
        try {
            await pool.query(`
                INSERT INTO page_views (page, view_date, view_count)
                VALUES ($1, CURRENT_DATE, 1)
                ON CONFLICT (page, view_date)
                DO UPDATE SET view_count = page_views.view_count + 1
            `, [req.path]);
        } catch (err) {
            if (!(err.code === '23505' || err.message.includes('ON CONFLICT DO UPDATE'))) {
                console.error('記錄頁面瀏覽錯誤:', err);
            }
        }
    }
    next();
});

// --- 公開 API Routes ---

// 商品API
app.get('/api/products', async (req, res) => {
    try {
        const sortBy = req.query.sort || 'latest';
        const orderBy = sortBy === 'popular' 
            ? 'ORDER BY click_count DESC, created_at DESC' 
            : 'ORDER BY created_at DESC';
        
        const result = await pool.query(`
            SELECT id, name, description, price, image_url, seven_eleven_url, click_count 
            FROM products ${orderBy}
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取商品列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, description, price, image_url, seven_eleven_url, click_count FROM products WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到商品。' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('獲取商品時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.post('/api/products/:id/click', async (req, res) => {
    try {
        await pool.query('UPDATE products SET click_count = click_count + 1 WHERE id = $1', [req.params.id]);
        res.status(204).send();
    } catch (err) {
        console.error('記錄點擊時出錯:', err);
        res.status(204).send();
    }
});

// 音樂API
app.get('/api/music', async (req, res) => {
    try {
        const artist = req.query.artist;
        let query = `
            SELECT id, title, artist, cover_art_url, platform_url, release_date, description 
            FROM music
        `;
        const params = [];
        
        if (artist) {
            query += ' WHERE artist = $1';
            params.push(artist);
        }
        
        query += ' ORDER BY release_date DESC, id DESC';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取音樂列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.get('/api/music/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, title, artist, cover_art_url, platform_url, release_date, description FROM music WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到音樂項目。' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('獲取音樂時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 消息API
app.get('/api/news', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const countResult = await pool.query('SELECT COUNT(*) FROM news');
        const newsResult = await pool.query(
            `SELECT id, title, event_date, summary, thumbnail_url, like_count, updated_at 
             FROM news 
             ORDER BY updated_at DESC 
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        
        res.json({
            totalItems: parseInt(countResult.rows[0].count),
            totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
            currentPage: page,
            news: newsResult.rows
        });
    } catch (err) {
        console.error('獲取消息列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.get('/api/news/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, title, event_date, summary, content, thumbnail_url, image_url, like_count, updated_at FROM news WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到消息。' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('獲取消息時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.post('/api/news/:id/like', async (req, res) => {
    try {
        const result = await pool.query(
            'UPDATE news SET like_count = like_count + 1 WHERE id = $1 RETURNING like_count',
            [req.params.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到消息。' });
        }
        res.json({ like_count: result.rows[0].like_count });
    } catch (err) {
        console.error('按讚時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// Banner API
app.get('/api/banners', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, image_url, link_url, alt_text FROM banners ORDER BY display_order ASC, id ASC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('獲取Banner時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// --- 受保護的管理API路由 ---
app.use(['/admin*', '/api/admin*', '/banner-admin*', '/music-admin*', '/news-admin*'], basicAuthMiddleware);

// 管理商品API
app.get('/api/admin/products', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, description, price, image_url, seven_eleven_url, click_count FROM products ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('獲取管理商品列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 管理音樂API
app.get('/api/admin/music', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, title, artist, cover_art_url, platform_url, release_date, description FROM music ORDER BY release_date DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('獲取管理音樂列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 管理消息API
app.get('/api/admin/news', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 999;
        const result = await pool.query(
            'SELECT id, title, event_date, summary, thumbnail_url, like_count, updated_at FROM news ORDER BY updated_at DESC LIMIT $1',
            [limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('獲取管理消息列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// Banner管理API
app.get('/api/admin/banners', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, image_url, link_url, display_order, alt_text, updated_at FROM banners ORDER BY display_order ASC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('獲取管理Banner列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 流量統計API
app.get('/api/analytics/traffic', async (req, res) => {
    try {
        const days = 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const result = await pool.query(
            `SELECT view_date, SUM(view_count)::bigint AS count 
             FROM page_views 
             WHERE view_date >= $1 
             GROUP BY view_date 
             ORDER BY view_date ASC`,
            [startDate.toISOString().split('T')[0]]
        );
        
        res.json(result.rows.map(row => ({
            date: new Date(row.view_date).toISOString().split('T')[0],
            count: parseInt(row.count)
        })));
    } catch (err) {
        console.error('獲取流量數據時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 其他管理API (POST, PUT, DELETE) 保持不變...

// 404 處理
app.use((req, res) => {
    if (req.accepts('html')) {
        res.status(404).send('抱歉，找不到您要訪問的頁面。');
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// 全局錯誤處理
app.use((err, req, res, next) => {
    console.error("全局錯誤處理:", err.stack);
    res.status(500).send('伺服器發生了一些問題！');
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`伺服器正在監聽 port ${PORT}`);
    pool.query('SELECT NOW()', (err) => {
        if (err) console.error('資料庫連接錯誤:', err);
        else console.log('資料庫連接成功');
    });
});