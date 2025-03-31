// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 資料庫連接池設定 ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// --- 基本認證中間件 ---
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

// --- 中間件 ---
app.use(express.json());

// --- 記錄 Page View 中間件 ---
app.use(async (req, res, next) => {
    const pathsToLog = ['/', '/index.html', '/music.html', '/news.html'];
    const shouldLog = pathsToLog.includes(req.path) && req.method === 'GET';

    if (shouldLog) {
        const pagePath = req.path;
        console.log(`[PV Mid] Should Log: YES for ${pagePath}`);
        
        try {
            const sql = `
                INSERT INTO page_views (page, view_date, view_count)
                VALUES ($1, CURRENT_DATE, 1)
                ON CONFLICT (page, view_date)
                DO UPDATE SET view_count = page_views.view_count + 1
                RETURNING *;
            `;
            const result = await pool.query(sql, [pagePath]);
            
            if (result.rowCount === 0) {
                console.warn(`[PV Mid] WARN: Query executed for ${pagePath} but rowCount is 0.`);
            }
        } catch (err) {
            if (err.code === '23505' || err.message.includes('ON CONFLICT DO UPDATE command cannot affect row a second time')) {
                console.warn(`[PV Mid] CONFLICT/Race condition for ${pagePath}. Handled.`);
            } else {
                console.error('[PV Mid] Error logging page view:', err);
            }
        }
    }
    next();
});

// 靜態文件服務
app.use(express.static(path.join(__dirname, 'public')));

// --- 公開 API Routes ---

// GET all Banners
app.get('/api/banners', async (req, res) => {
    console.log("[API] Received GET /api/banners request");
    try {
        const queryText = 'SELECT id, image_url, link_url, alt_text, page_location FROM banners ORDER BY display_order ASC, id ASC';
        const result = await pool.query(queryText);
        console.log(`[API] Found ${result.rowCount} banners for public display.`);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('[API Error] 獲取公開 Banner 列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取輪播圖。' });
    }
});

// ... (其他公開API路由保持不變) ...

// --- 受保護的管理頁面 ---
app.use(['/admin.html', '/music-admin.html', '/news-admin.html', '/banner-admin.html'], basicAuthMiddleware);

// --- Banner 管理 API (受保護) ---

// GET all Banners for Admin
app.get('/api/admin/banners', basicAuthMiddleware, async (req, res) => {
    console.log("[Admin API] Received GET /api/admin/banners request");
    try {
        const queryText = 'SELECT id, image_url, link_url, display_order, alt_text, page_location, updated_at FROM banners ORDER BY display_order ASC, id ASC';
        const result = await pool.query(queryText);
        console.log(`[Admin API] Found ${result.rowCount} banners for admin list.`);
        res.json(result.rows);
    } catch (err) {
        console.error('[Admin API Error] 獲取管理 Banners 時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// CREATE a new Banner
app.post('/api/admin/banners', basicAuthMiddleware, async (req, res) => {
    console.log("[Admin API] Received POST /api/admin/banners request");
    const { image_url, link_url, display_order, alt_text, page_location } = req.body;

    // 驗證
    if (typeof image_url !== 'string' || image_url.trim() === '') {
        return res.status(400).json({ error: '圖片網址不能為空。' });
    }
    
    if (!['home', 'music', 'news'].includes(page_location)) {
        return res.status(400).json({ error: '無效的頁面位置。' });
    }
    
    const order = (display_order !== undefined && display_order !== null && display_order !== '') ? parseInt(display_order) : 0;
    if (isNaN(order)) {
        return res.status(400).json({ error: '排序必須是有效的數字。' });
    }
    
    const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');
    if (!isValidUrl(image_url)) {
        return res.status(400).json({ error: '圖片網址格式不正確。' });
    }
    
    if (link_url && !isValidUrl(link_url)) {
        return res.status(400).json({ error: '連結網址格式不正確。' });
    }

    console.log("[Admin API] Creating banner with data:", { 
        image_url, 
        link_url, 
        alt_text, 
        display_order: order,
        page_location
    });

    try {
        const queryText = `
            INSERT INTO banners 
            (image_url, link_url, display_order, alt_text, page_location, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING *;
        `;
        const params = [
            image_url.trim(),
            link_url ? link_url.trim() : null,
            order,
            alt_text ? alt_text.trim() : null,
            page_location
        ];
        
        const result = await pool.query(queryText, params);
        console.log("[Admin API] Banner created successfully:", result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[Admin API Error] 新增 Banner 時出錯:', err);
        res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' });
    }
});

// UPDATE a Banner by ID
app.put('/api/admin/banners/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] Received PUT /api/admin/banners/${id} request`);
    
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的 Banner ID 格式。' });
    }
    
    const { image_url, link_url, display_order, alt_text, page_location } = req.body;

    // 驗證
    if (typeof image_url !== 'string' || image_url.trim() === '') {
        return res.status(400).json({ error: '圖片網址不能為空。' });
    }
    
    if (!['home', 'music', 'news'].includes(page_location)) {
        return res.status(400).json({ error: '無效的頁面位置。' });
    }
    
    const order = (display_order !== undefined && display_order !== null && display_order !== '') ? parseInt(display_order) : 0;
    if (isNaN(order)) {
        return res.status(400).json({ error: '排序必須是有效的數字。' });
    }
    
    const isValidUrl = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');
    if (!isValidUrl(image_url)) {
        return res.status(400).json({ error: '圖片網址格式不正確。' });
    }
    
    if (link_url && !isValidUrl(link_url)) {
        return res.status(400).json({ error: '連結網址格式不正確。' });
    }

    console.log(`[Admin API] Updating banner ID ${id} with data:`, { 
        image_url, 
        link_url, 
        alt_text, 
        display_order: order,
        page_location
    });

    try {
        const queryText = `
            UPDATE banners
            SET image_url = $1, 
                link_url = $2, 
                display_order = $3, 
                alt_text = $4,
                page_location = $5,
                updated_at = NOW()
            WHERE id = $6
            RETURNING *;
        `;
        const params = [
            image_url.trim(),
            link_url ? link_url.trim() : null,
            order,
            alt_text ? alt_text.trim() : null,
            page_location,
            id
        ];
        
        const result = await pool.query(queryText, params);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到 Banner，無法更新。' });
        }
        
        console.log("[Admin API] Banner updated successfully:", result.rows[0]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`[Admin API Error] 更新 Banner ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' });
    }
});

// DELETE a Banner by ID
app.delete('/api/admin/banners/:id', basicAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin API] Received DELETE /api/admin/banners/${id} request`);
    
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的 Banner ID 格式。' });
    }

    try {
        const result = await pool.query('DELETE FROM banners WHERE id = $1', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到 Banner，無法刪除。' });
        }
        
        console.log(`[Admin API] Banner ID ${id} deleted successfully.`);
        res.status(204).send();
    } catch (err) {
        console.error(`[Admin API Error] 刪除 Banner ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' });
    }
});

// ... (其他管理API路由保持不變) ...

// --- 錯誤處理 ---
app.use((req, res, next) => {
    res.status(404).send('抱歉，找不到您要訪問的頁面。');
});

app.use((err, req, res, next) => {
    console.error("全局錯誤處理:", err.stack);
    res.status(500).send('伺服器發生了一些問題！');
});

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