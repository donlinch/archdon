// --- START OF FILE server.js ---
 
// server.js
require('dotenv').config();
const https = require('https'); // Keep this if you were explicitly using it, but usually not needed directly with Express + ws
const http = require('http'); // <--- Need http module
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const WebSocket = require('ws'); // <--- Import the ws library
// const GameWebSocketServer = require('./rich-websocket.js'); // <--- Import your class (optional, can implement directly)
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session); 
const multer = require('multer');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const fs = require('fs');
const sharp = require('sharp')
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dbClient = require('./dbclient'); // <--- 把這一行加在這裡
const createReportRateLimiter = require('./report-ip-limiter');

const app = express();
const PORT = process.env.PORT || 3000;
const unboxingAiRouter = express.Router();


if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1); // 信任第一個代理 (Render 通常是這樣)
}
// Session Middleware Setup





 

// --- 資料庫連接池設定 ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // 從環境變數讀取資料庫 URL
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false // 生產環境需要 SSL (Render 提供)
});


app.use(express.json({ limit: '10mb' }));

 
app.use(express.urlencoded({ extended: true }));

// --- 記錄 Page View 和 Traffic Source 中間件 ---
app.use(async (req, res, next) => {
    const pathsToLog = [
        '/', '/index.html', '/music.html', '/news.html', '/scores.html',
        '/guestbook.html', '/message-detail.html',
        '/game/card-game.html',
        '/game/wheel-game.html',
        '/game/brige-game.html', // Consider if this is a typo for bridge-game
        '/games.html',
        '/game/text-display.html',
        '/game/voit-game.html',
        '/game/text-game.html',
        '/game/same-game.html', 
        '/rich/index.html'
        // Add other specific paths you want to track for source analytics
    ];

    // Only log GET requests for specified paths
    const shouldLog = pathsToLog.includes(req.path) && req.method === 'GET';

    if (shouldLog) {
        const pagePath = req.path;
         try {
            // Log basic page view (ensure page_views table exists)
            const pageViewSql = `
                INSERT INTO page_views (page, view_date, view_count)
                VALUES ($1, CURRENT_DATE, 1)
                ON CONFLICT (page, view_date) DO UPDATE SET
                    view_count = page_views.view_count + 1;
            `;
            await pool.query(pageViewSql, [pagePath]);

            // --- Log traffic source information (ensure source_page_views table exists) ---
            const referer = req.get('Referer') || '';
            const userAgent = req.get('User-Agent') || '';
            
            let sourceType = 'direct';
            let sourceName = '';
            let sourceUrl = referer; 

            if (referer) {
                try {
                    const refererUrl = new URL(referer);
                    const currentHostname = req.hostname; 
                    
                    if (['google.', 'bing.', 'yahoo.', 'baidu.', 'duckduckgo.'].some(se => refererUrl.hostname.includes(se))) {
                        sourceType = 'search_engine';
                        sourceName = refererUrl.hostname.split('.')[refererUrl.hostname.split('.').length -2] || refererUrl.hostname;
                    }
                    else if (['facebook.', 'instagram.', 'twitter.', 'linkedin.', 'line.me', 't.co'].some(sm => refererUrl.hostname.includes(sm))) {
                        sourceType = 'social';
                        sourceName = refererUrl.hostname.split('.')[0];
                         if (refererUrl.hostname === 't.co') sourceName = 'twitter';
                    }
                    else if (refererUrl.hostname !== currentHostname && !refererUrl.hostname.includes(currentHostname) && !currentHostname.includes(refererUrl.hostname)) {
                        sourceType = 'referral';
                        sourceName = refererUrl.hostname;
                    } 
                    else {
                        sourceType = 'internal';
                        sourceName = 'internal'; 
                    }
                } catch (urlError) {
                    console.warn(`[Traffic Source Mid] Invalid referer URL: '${referer}', Error: ${urlError.message}`);
                    sourceType = 'other'; 
                    sourceName = 'invalid_url';
                }
            }

            const sourceSQL = `
                INSERT INTO source_page_views 
                (page, view_date, source_type, source_name, source_url, user_agent, view_count)
                VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, 1)
                ON CONFLICT (page, view_date, source_type, source_name) 
                DO UPDATE SET 
                    view_count = source_page_views.view_count + 1,
                    last_user_agent = EXCLUDED.user_agent; 
            `;
            await pool.query(sourceSQL, [pagePath, sourceType, sourceName, sourceUrl, userAgent]);

         } catch (err) {
             if (err.code === '23505' || (err.message && err.message.includes('ON CONFLICT DO UPDATE command cannot affect row a second time'))) {
                console.warn(`[Traffic Source Mid] CONFLICT/Race condition for ${pagePath}. Source: ${sourceName}. Handled.`);
             } else if (err.message && err.message.includes("relation \"source_page_views\" does not exist")) {
                console.error('[Traffic Source Mid] CRITICAL: Table "source_page_views" does not exist. Traffic source logging is disabled.');
             } else if (err.message && err.message.includes("relation \"page_views\" does not exist")) {
                console.error('[Traffic Source Mid] CRITICAL: Table "page_views" does not exist. Page view logging is disabled.');
             } else {
                console.error('[Traffic Source Mid] Error logging page/source view:', err.stack || err);
             }
        }
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    name: 'myadminsession.sid', // 給你的 session cookie 一個獨特的名稱
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        path: '/', // ★★★ 確保 cookie 對整個域名下的所有路徑都有效 ★★★
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax' // 嘗試 'lax'
    }
}));



// --- START OF AUTHENTICATION MIDDLEWARE AND ROUTES ---
const isAdminAuthenticated = (req, res, next) => { // ★★★ 您新的認證中介軟體
    if (req.session && req.session.isAdmin) {      // (之前叫 isAdmin，建議改名)
        return next();
    }
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(401).json({ error: '未授權：請先登入。', loginUrl: '/admin-login.html' });
    } else {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/admin-login.html'); // 確保這是您的登入頁面檔案名
    }
};
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const adminUsername = process.env.ADMIN_LOGIN;
    const adminPassword = process.env.ADMIN_LOGIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
        console.error('ADMIN_LOGIN or ADMIN_LOGIN_PASSWORD 環境變數未設定。');
        return res.status(500).json({ success: false, error: '伺服器認證配置錯誤。' });
    }

    if (username === adminUsername && password === adminPassword) {
        if (!req.session) {
            console.error('錯誤：在 /api/admin/login 中 req.session 未定義！');
            return res.status(500).json({ success: false, error: 'Session 初始化錯誤，無法登入。' });
        }
        req.session.isAdmin = true;
        const returnTo = req.session.returnTo || '/admin-main.html'; // ★★★ 登入成功後去 admin-main.html ★★★
        delete req.session.returnTo;
        console.log('[Login Success] Session isAdmin set. Attempting to save session. redirectTo:', returnTo); // 新日誌


        // 保存 session 然後再發送回應
        req.session.save(err => {
            if (err) {
                console.error("Session 保存失敗:", err);
                return res.status(500).json({ success: false, error: 'Session 保存失敗，無法登入。' });
            }
            console.log(`[Login Success] Session saved. Responding with JSON. Session ID: ${req.sessionID}`); // 新日誌
            res.json({ success: true, message: '登入成功。', redirectTo: returnTo });
        });
    } else {
        console.warn(`[Admin Login] 使用者 '${username}' 登入失敗：帳號或密碼錯誤。`);
        res.status(401).json({ success: false, error: '帳號或密碼錯誤。' });
    }
});
// Admin Logout Route
app.post('/api/admin/logout', (req, res) => { // ★★★ 建議路徑為 /api/admin/logout 且為 POST
    if (req.session) { // 先檢查 req.session 是否存在
        req.session.destroy(err => {
            if (err) {
                console.error('Session 銷毀失敗:', err);
                return res.status(500).json({ success: false, error: '登出失敗。' });
            }
            res.clearCookie('connect.sid'); // 假設 'connect.sid' 是您的 session cookie 名稱
            console.log("[Admin Logout] Session 已成功銷毀。");
            res.json({ success: true, message: '已成功登出。' });
        });
    } else {
        // 如果沒有 session，也算登出成功
        console.log("[Admin Logout] 沒有活動的 session，無需銷毀。");
        res.json({ success: true, message: '已登出 (無活動 session)。' });
    }
});
// Example of a protected admin route
app.get('/admin/dashboard', isAdminAuthenticated, (req, res) => { // ★★★ 使用新的中介軟體
    res.send(`
        <h1>Admin Dashboard</h1>
        <p>Welcome, admin!</p>
        <p><a href="#" onclick="logout()">Logout</a></p> <!-- 改為 JS 登出 -->
        <p>Protected content here.</p>
        <script>
            async function logout() {
                const response = await fetch('/api/admin/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/admin-login.html';
                } else {
                    alert('登出失敗');
                }
            }
        </script>
    `);
});









// --- Multer Configuration for Product Images (used by adminRouter) ---
const productStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        // 注意：這裡的路徑是相對於 server.js 所在的位置
        const uploadDir = path.join(__dirname, 'public/uploads/storemarket');
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const productUpload = multer({
    storage: productStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            return cb(new Error('只能上傳圖片文件 (jpg, jpeg, png, gif)!'), false);
        }
        cb(null, true);
    }
});
// --- End of Multer Configuration ---









 

const sessionProtectedAdminPages = [
    // 注意：admin-main.html 和 admin-nav.html 已有特定處理，這裡僅為示例結構
    '/admin-main.html',
    '/admin-nav.html',
    '/figures-admin.html',
    '/admin.html',
    '/sales-report.html',
    '/blacklist.html',
    '/music-admin.html',
    '/rich/rich-admin.html',
    '/game-admin-same.html',
    '/news-admin.html',
    '/banner-admin.html',
    '/file-admin.html',
    '/admin-nav-manager.html',
    '/store/report/report-admin.html',
    '/unboxing.html',
    '/unboxing-ai-admin.html',
    '/guestbook-admin.html',
    '/advertisement.html',
    '/admin-identities.html',
   

    // 把其他需要 session 保護的 HTML 檔案路徑加到這裡
    // 例如: '/inventory-admin.html', (如果它需要 session 保護而不是 basic auth)
    // 注意：你有一些頁面是用 basicAuthMiddleware 保護的，不要混淆
];

sessionProtectedAdminPages.forEach(pagePath => {
    // 假設檔案都在 public 資料夾的根目錄下
    // 如果路徑是像 /store/report/report-admin.html 這樣的巢狀結構，
    // 則 path.join(__dirname, 'public', pagePath) 需要相應調整。
    // 例如： path.join(__dirname, 'public', 'store', 'report', 'report-admin.html')
    app.get(pagePath, isAdminAuthenticated, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', pagePath));
    });
});



// --- Voit (投票系統) API Router ---
const voitRouter = express.Router();






// --- START OF Gemini AI Integration ---
// 從環境變數讀取 API Key (你在 Render 環境設定中設定的是 google_api_key)
const GEMINI_API_KEY = process.env.google_api_key;  
let genAI;
let geminiModel;

if (GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        // 選擇你的模型，例如 "gemini-pro" 或 "gemini-1.5-pro-latest"
        // 你之前截圖顯示 "gemini-2.5-pro-exp-03-25"，如果你確定它可用，可以在此處指定
        geminiModel = genAI.getGenerativeModel({ model: "models/gemini-2.5-pro-preview-03-25" }); // <--- 根據錯誤訊息建議修改模型名稱
        console.log("[Gemini AI] Service initialized successfully with model 'models/gemini-2.5-pro-preview-03-25'.");
    } catch (error) {
        console.error("[Gemini AI] Failed to initialize GoogleGenerativeAI. Error:", error.message);
        console.error("[Gemini AI] AI reply generation will be disabled. Check your API key and model name in environment variables.");
        geminiModel = null; // 確保模型未定義
    }
} else {
    console.warn("[Gemini AI] GOOGLE_API_KEY (or your specific key name) not found in environment variables. AI reply generation will be disabled.");
    geminiModel = null;
}
// --- END OF Gemini AI Initialization ---


// --- START OF Cloud Vision AI Integration ---
let visionClient;




// --- 臨時調試程式碼 START ---
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
console.log(`[Cloud Vision AI Debug] GOOGLE_APPLICATION_CREDENTIALS path from env: ${credentialsPath}`);
if (credentialsPath) {
    try {
        const credentialsFileContent = fs.readFileSync(credentialsPath, 'utf8');
        console.log("[Cloud Vision AI Debug] Successfully read credentials file content.");
        try {
            const parsedCredentials = JSON.parse(credentialsFileContent);
            console.log("[Cloud Vision AI Debug] Successfully parsed JSON credentials. Project ID:", parsedCredentials.project_id);
        } catch (parseError) {
            console.error("[Cloud Vision AI Debug] Failed to parse JSON credentials file:", parseError.message);
        }
    } catch (readError) {
        console.error(`[Cloud Vision AI Debug] Failed to read credentials file at ${credentialsPath}:`, readError.message);
    }
} else {
    console.warn("[Cloud Vision AI Debug] GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.");
}
// --- 臨時調試程式碼 END ---

try {





    visionClient = new ImageAnnotatorClient();

    console.log("[Cloud Vision AI] Client initialized successfully.");
} catch (error) {
    console.error("[Cloud Vision AI] Failed to initialize ImageAnnotatorClient. Error:", error.message);
    console.error("[Cloud Vision AI] Image analysis features will be disabled. Check your GOOGLE_APPLICATION_CREDENTIALS setup in Render Environment and Secret Files.");
    visionClient = null;
}
// --- END OF Cloud Vision AI Integration ---



// GET /api/voit/campaigns - 獲取所有活躍的投票活動列表
voitRouter.get('/campaigns', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT campaign_id, title, description, status FROM voit_Campaigns WHERE status = 'active' ORDER BY created_at DESC"
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching voit campaigns:', err.stack || err);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

// GET /api/voit/campaigns/:campaignId - 獲取特定投票活動的詳細信息及其選項
voitRouter.get('/campaigns/:campaignId', async (req, res) => {
    const { campaignId } = req.params;
    const ipAddress = req.ip || req.socket.remoteAddress || req.headers['x-forwarded-for']?.split(',').shift();

    try {
        const campaignResult = await pool.query("SELECT campaign_id, title, description, status FROM voit_Campaigns WHERE campaign_id = $1", [campaignId]);
        if (campaignResult.rows.length === 0) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        const campaign = campaignResult.rows[0];
        
        const optionsResult = await pool.query("SELECT option_id, name, image_url, display_order FROM voit_Options WHERE campaign_id = $1 ORDER BY display_order ASC, name ASC", [campaignId]);
        campaign.options = optionsResult.rows;

        // 檢查當前 IP 是否已投票
        let currentUserHasVoted = false;
        if (ipAddress) {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const existingVote = await pool.query(
                "SELECT vote_id FROM voit_Votes WHERE campaign_id = $1 AND ip_address = $2 AND voted_at > $3",
                [campaignId, ipAddress, twentyFourHoursAgo]
            );
            if (existingVote.rows.length > 0) {
                currentUserHasVoted = true;
            }
        }
        campaign.currentUserHasVoted = currentUserHasVoted;

        res.status(200).json(campaign);
    } catch (err) {
        console.error(`Error fetching campaign ${campaignId}:`, err.stack || err);
        res.status(500).json({ error: 'Failed to fetch campaign details' });
    }
});

// POST /api/voit/campaigns/:campaignId/vote - 提交投票
voitRouter.post('/campaigns/:campaignId/vote', async (req, res) => {
    const { campaignId } = req.params;
    const { option_id } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || req.headers['x-forwarded-for']?.split(',').shift();

    if (!option_id) return res.status(400).json({ error: 'Option ID is required' });

    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existingVote = await pool.query(
            "SELECT vote_id FROM voit_Votes WHERE campaign_id = $1 AND ip_address = $2 AND voted_at > $3",
            [campaignId, ipAddress, twentyFourHoursAgo]
        );
        if (existingVote.rows.length > 0) {
            return res.status(429).json({ error: '您最近已使用此 IP 位址對此活動投過票。' });
        }
        await pool.query(
            "INSERT INTO voit_Votes (campaign_id, option_id, ip_address) VALUES ($1, $2, $3)",
            [campaignId, option_id, ipAddress]
        );
        res.status(201).json({ message: 'Vote cast successfully' });
    } catch (err) {
        console.error(`Error casting vote for campaign ${campaignId}:`, err.stack || err);
        // 更具體的錯誤判斷，例如外鍵約束失敗
        if (err.code === '23503') { // PostgreSQL foreign key violation
             return res.status(400).json({ error: 'Invalid campaign or option ID provided.' });
        }
        res.status(500).json({ error: 'Failed to cast vote' });
    }
});

// GET /api/voit/campaigns/:campaignId/results - 獲取特定投票活動的結果
voitRouter.get('/campaigns/:campaignId/results', async (req, res) => {
    const { campaignId } = req.params;
    try {
        const result = await pool.query(
            "SELECT option_id, COUNT(*) as vote_count FROM voit_Votes WHERE campaign_id = $1 GROUP BY option_id",
            [campaignId]
        );
        const resultsData = {};
        result.rows.forEach(row => {
            resultsData[row.option_id] = parseInt(row.vote_count, 10);
        });
        res.status(200).json(resultsData);
    } catch (err) {
        console.error(`Error fetching results for campaign ${campaignId}:`, err.stack || err);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
});

// 新增 API 端點：驗證活動編輯密碼
voitRouter.post('/campaigns/:campaignId/verify-password', async (req, res) => {
    const { campaignId } = req.params;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ verified: false, error: '請提供編輯密碼。' });
    }

    try {
        const result = await pool.query("SELECT edit_password FROM voit_Campaigns WHERE campaign_id = $1", [campaignId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ verified: false, error: '找不到指定的投票活動。' });
        }
        const storedPassword = result.rows[0].edit_password;
        // 這裡假設密碼是明文存儲的，實際應用中應使用哈希比較
        const masterPassword = process.env.VOIT_MASTER_PASSWORD;

        if (password === storedPassword || (masterPassword && password === masterPassword)) {
            res.json({ verified: true });
        } else {
            res.status(401).json({ verified: false, error: '編輯密碼錯誤，請重試。' });
        }
    } catch (err) {
        console.error(`Error verifying password for campaign ${campaignId}:`, err.stack || err);
        res.status(500).json({ verified: false, error: '密碼驗證失敗，請稍後再試。' });
    }
});

// PUT /api/voit/campaigns/:campaignId - 更新現有投票活動
voitRouter.put('/campaigns/:campaignId', async (req, res) => {
    const { campaignId } = req.params;
    const { title, description, options } = req.body; // 編輯時不應更新 edit_password

    if (!title || title.trim() === '') {
        return res.status(400).json({ error: '活動標題為必填項。' });
    }
    if (!options || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ error: '至少需要一個投票選項。' });
    }
    for (const opt of options) {
        if (!opt.name || opt.name.trim() === '') {
            return res.status(400).json({ error: '所有選項都必須有名稱。' });
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 更新 voit_Campaigns 表
        const updatedCampaignResult = await client.query(
            "UPDATE voit_Campaigns SET title = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE campaign_id = $3 RETURNING campaign_id, title, description",
            [title.trim(), description || null, campaignId]
        );

        if (updatedCampaignResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到要更新的投票活動。' });
        }

        // 2. 刪除與該 campaign_id 相關的所有現有選項
        await client.query("DELETE FROM voit_Votes WHERE campaign_id = $1", [campaignId]); // 同時刪除相關投票記錄
        await client.query("DELETE FROM voit_Options WHERE campaign_id = $1", [campaignId]);


        // 3. 重新插入提交上來的新的選項列表
        const insertedOptions = [];
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const optionResult = await client.query(
                "INSERT INTO voit_Options (campaign_id, name, image_url, display_order) VALUES ($1, $2, $3, $4) RETURNING option_id, name, image_url, display_order",
                [campaignId, opt.name.trim(), opt.image_url || null, i + 1]
            );
            insertedOptions.push(optionResult.rows[0]);
        }

        await client.query('COMMIT');
        
        const responseCampaign = updatedCampaignResult.rows[0];
        responseCampaign.options = insertedOptions;
        res.status(200).json(responseCampaign);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error updating campaign ${campaignId}:`, err.stack || err);
        res.status(500).json({ error: '更新投票活動失敗。' });
    } finally {
        client.release();
    }
});


// POST /api/voit/campaigns - 新增投票活動
voitRouter.post('/campaigns', async (req, res) => {
    const { title, description, edit_password, options } = req.body;

    if (!title || title.trim() === '') {
        return res.status(400).json({ error: 'Campaign title is required.' });
    }
    if (!edit_password || edit_password.length < 4 || edit_password.length > 6) {
        return res.status(400).json({ error: 'Edit password must be 4-6 characters long.' });
    }
    if (!options || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ error: 'At least one option is required.' });
    }
    for (const opt of options) {
        if (!opt.name || opt.name.trim() === '') { // 移除了對 image_url 的強制要求
            return res.status(400).json({ error: 'All options must have a name.' });
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 插入投票活動
        // 考慮到 edit_password 的安全性，這裡僅為示例，實際應用中應哈希存儲
        const campaignResult = await client.query(
            "INSERT INTO voit_Campaigns (title, description, status, edit_password) VALUES ($1, $2, $3, $4) RETURNING campaign_id, title, description, status, created_at",
            [title.trim(), description || null, 'active', edit_password] // 示例：直接存儲密碼
        );
        const newCampaign = campaignResult.rows[0];
        const campaignId = newCampaign.campaign_id;

        // 插入投票選項
        const insertedOptions = [];
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const optionResult = await client.query(
                "INSERT INTO voit_Options (campaign_id, name, image_url, display_order) VALUES ($1, $2, $3, $4) RETURNING option_id, name, image_url, display_order",
                [campaignId, opt.name.trim(), opt.image_url ? opt.image_url.trim() : null, i] // 如果 image_url 為空則存儲 NULL
            );
            insertedOptions.push(optionResult.rows[0]);
        }
        
        await client.query('COMMIT');
        
        newCampaign.options = insertedOptions; // 將選項附加到返回的活動對象中
        res.status(201).json(newCampaign);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating new voit campaign:', err.stack || err);
        // 檢查是否為唯一約束衝突 (例如 title) - 根據您的資料庫設計
        // if (err.code === '23505' && err.constraint === 'your_unique_title_constraint_name') {
        //    return res.status(409).json({ error: 'A campaign with this title already exists.' });
        // }
        res.status(500).json({ error: 'Failed to create campaign' });
    } finally {
        client.release();
    }
});

// DELETE /api/voit/campaigns/:campaignId - 刪除投票活動及其相關數據
voitRouter.delete('/campaigns/:campaignId', async (req, res) => {
    const { campaignId } = req.params;

    // 基本的 ID 驗證 (例如，檢查是否為數字或有效的 UUID 格式，取決於您的 campaign_id 類型)
    // 假設 campaign_id 是數字類型
    const id = parseInt(campaignId, 10);
    if (isNaN(id)) {
        return res.status(400).json({ error: '無效的活動 ID 格式。' });
    }

    console.log(`[API DELETE /voit/campaigns] 請求刪除活動 ID: ${id}`);
    // 注意：此處未直接處理密碼驗證，依賴前端在調用此端點前已通過 /verify-password 驗證。
    // 更安全的做法是在此 DELETE 請求中也包含密碼或一個有時效性的 token。

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 刪除相關的投票記錄 (voit_Votes)
        // 由於 voit_Votes 中的 option_id 外鍵關聯到 voit_Options, 且 voit_Options 中的 campaign_id 外鍵關聯到 voit_Campaigns,
        // 並且這些外鍵可能設置了 ON DELETE CASCADE，理論上直接刪除 voit_Campaigns 中的記錄會級聯刪除相關的 voit_Options 和 voit_Votes。
        // 但為了明確和安全，以及如果沒有設定級聯刪除，我們按順序刪除。
        // 首先刪除依賴性最強的 voit_Votes。
        const deleteVotesResult = await client.query("DELETE FROM voit_Votes WHERE campaign_id = $1", [id]);
        console.log(`[DB] 從 voit_Votes 刪除了 ${deleteVotesResult.rowCount} 條與活動 ID ${id} 相關的投票記錄。`);

        // 2. 刪除相關的投票選項 (voit_Options)
        const deleteOptionsResult = await client.query("DELETE FROM voit_Options WHERE campaign_id = $1", [id]);
        console.log(`[DB] 從 voit_Options 刪除了 ${deleteOptionsResult.rowCount} 條與活動 ID ${id} 相關的選項記錄。`);

        // 3. 刪除投票活動本身 (voit_Campaigns)
        const deleteCampaignResult = await client.query("DELETE FROM voit_Campaigns WHERE campaign_id = $1", [id]);
        
        if (deleteCampaignResult.rowCount === 0) {
            // 如果活動本身就找不到，可能已經被刪除，或者ID錯誤
            await client.query('ROLLBACK');
            console.warn(`[API DELETE /voit/campaigns] 找不到要刪除的活動 ID: ${id}。事務已回滾。`);
            return res.status(404).json({ error: '找不到要刪除的投票活動。' });
        }
        console.log(`[DB] 從 voit_Campaigns 成功刪除了活動 ID: ${id}。`);

        await client.query('COMMIT');
        console.log(`[API DELETE /voit/campaigns] 活動 ID: ${id} 及其相關數據已成功刪除。事務已提交。`);
        res.status(204).send(); // No Content, 表示成功刪除

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[API DELETE /voit/campaigns] 刪除活動 ID ${id} 時發生錯誤:`, err.stack || err);
        res.status(500).json({ error: '刪除投票活動失敗。', detail: err.message });
    } finally {
        client.release();
    }
});
// --- END OF Voit Router Definitions ---














 
   
   
// --- 基本 Express 設定 ---








// --- 記錄 Page View 中間件 ---
app.use(async (req, res, next) => {
    const pathsToLog = [
        '/', '/index.html', '/music.html', '/news.html', '/scores.html',
        '/guestbook.html', '/message-detail.html',
        '/game/card-game.html',
        '/game/wheel-game.html',
        '/game/brige-game.html',
        '/games.html',
        '/game/text-display.html',
        '/game/voit-game.html',
        '/game/text-game.html',
        '/game/same-game.html', 
        '/rich/index.html', 
        



        '/games.html'
    ];

    const shouldLog = pathsToLog.includes(req.path) && req.method === 'GET';

    if (shouldLog) {
        const pagePath = req.path;
         try {
            // --- ↓↓↓ 關鍵修改在這裡 ↓↓↓ ---
            const sql = `
                INSERT INTO page_views (page, view_date, view_count)
                VALUES ($1, CURRENT_DATE, 1)
                ON CONFLICT (page, view_date) DO UPDATE SET
                    view_count = page_views.view_count + 1;
            `;
            // 如果你的 page_views 表有 last_updated_at 欄位，並且你想更新它，可以使用下面這個版本：
            /*
            const sql = `
                INSERT INTO page_views (page, view_date, view_count, last_updated_at)
                VALUES ($1, CURRENT_DATE, 1, NOW())
                ON CONFLICT (page, view_date) DO UPDATE SET
                    view_count = page_views.view_count + 1,
                    last_updated_at = NOW();
            `;
            */
            // --- ↑↑↑ 關鍵修改在這裡 ↑↑↑ ---

            const params = [pagePath];
            await pool.query(sql, params);
         } catch (err) {
             if (err.code === '23505' || (err.message && err.message.includes('ON CONFLICT DO UPDATE command cannot affect row a second time'))) {
             } else {
             }
        }
    }
    next();
});

 
app.use(express.static(path.join(__dirname, 'public')));




// --- 遊戲房間 WebSocket 相關 ---
 
const simpleWalkerConnections = new Map();











// --- 正確的 Simple Walker 創建房間 API ---
app.post('/api/game-rooms', async (req, res) => {
    const { roomName, maxPlayers } = req.body;

    console.log('[API POST /api/game-rooms] Received create room request:', { roomName, maxPlayers });

    if (!roomName || !roomName.trim()) {
        console.error('[API POST /api/game-rooms] Bad Request: Missing roomName');
        return res.status(400).json({ error: '房間名稱為必填項' });
    }

    const maxPlayersInt = parseInt(maxPlayers, 10);
    if (isNaN(maxPlayersInt) || maxPlayersInt < 2 || maxPlayersInt > 20) {
        return res.status(400).json({ error: '無效的最大玩家數 (需介於 2-20 之間)' });
    }

    try {
        // 使用 dbClient.js 中的函數來創建房間
        const roomId = uuidv4(); // 生成唯一的房間 ID
        console.log(`[API POST /api/game-rooms] Attempting to create room with ID: ${roomId}`);

        // 注意：dbClient.createRoom 返回的結構可能需要調整以匹配前端期望
        const createdDbRoom = await dbClient.createRoom(roomId, roomName.trim(), maxPlayersInt);

        if (!createdDbRoom || !createdDbRoom.game_state) {
             console.error(`[API POST /api/game-rooms] dbClient.createRoom failed for roomId: ${roomId}`);
             throw new Error('資料庫創建房間失敗或返回格式不正確');
        }

        console.log(`[API POST /api/game-rooms] Room created successfully in DB: ${roomId}`);

        // 構造返回給客戶端的數據，確保包含 id, roomName, maxPlayers
        const responseData = {
            id: createdDbRoom.room_id, // 使用資料庫返回的 ID
            roomName: createdDbRoom.room_name,
            maxPlayers: createdDbRoom.game_state.maxPlayers // 從 game_state 中讀取
        };

        res.status(201).json(responseData);

    } catch (err) {
        console.error('[API POST /api/game-rooms] Error creating room:', err.stack || err);
        res.status(500).json({
            error: '建立房間失敗',
            detail: err.message
        });
    }
});

// 在 Express 路由設定區域添加
// app.use('/api/storemarket', storeRoutes); // Removed as storeRoutes is deleted
app.use('/api/voit', voitRouter);

// --- 管理後台導覽連結 API ---
app.get('/api/admin/nav-links', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, name, url, parent_id, display_order
             FROM admin_nav_links
             ORDER BY display_order ASC, name ASC`
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error('[API GET /api/admin/nav-links] 獲取導覽連結失敗:', err.stack || err);
        res.status(500).json({ error: '無法獲取導覽連結' });
    }
});

// POST /api/admin/nav-links - 新增導覽連結
app.post('/api/admin/nav-links', isAdminAuthenticated, async (req, res) => {
    const { name, url, parent_id, display_order } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: '連結名稱為必填項' });
    }
    // parent_id 可以是 null 或數字
    const parentId = parent_id ? parseInt(parent_id, 10) : null;
    if (parent_id && isNaN(parentId)) {
         return res.status(400).json({ error: '無效的父層級 ID' });
    }
    const displayOrder = display_order ? parseInt(display_order, 10) : 0;
     if (isNaN(displayOrder)) {
         return res.status(400).json({ error: '無效的顯示順序' });
     }
     // URL 可以是空字串或 null，代表是父層級選單
     const linkUrl = url && url.trim() !== '' ? url.trim() : null;


    try {
        const { rows } = await pool.query(
            `INSERT INTO admin_nav_links (name, url, parent_id, display_order)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name.trim(), linkUrl, parentId, displayOrder]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[API POST /api/admin/nav-links] 新增導覽連結失敗:', err.stack || err);
        // 檢查外鍵約束錯誤
        if (err.code === '23503') {
             return res.status(400).json({ error: '指定的父層級 ID 不存在' });
        }
        res.status(500).json({ error: '新增導覽連結時發生錯誤' });
    }
});

// PUT /api/admin/nav-links/:id - 更新導覽連結
app.put('/api/admin/nav-links/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { name, url, parent_id, display_order } = req.body;
    const linkId = parseInt(id, 10);

     if (isNaN(linkId)) {
        return res.status(400).json({ error: '無效的連結 ID' });
    }
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: '連結名稱為必填項' });
    }
    const parentId = parent_id ? parseInt(parent_id, 10) : null;
     if (parent_id && isNaN(parentId)) {
         return res.status(400).json({ error: '無效的父層級 ID' });
     }
     // 防止將連結設置為自己的父級
     if (parentId === linkId) {
         return res.status(400).json({ error: '不能將連結設置為自己的父層級' });
     }
    const displayOrder = display_order ? parseInt(display_order, 10) : 0;
     if (isNaN(displayOrder)) {
         return res.status(400).json({ error: '無效的顯示順序' });
     }
     const linkUrl = url && url.trim() !== '' ? url.trim() : null;

    try {
        // 可選：檢查 parent_id 是否會造成循環引用 (更複雜的檢查)

        const { rows } = await pool.query(
            `UPDATE admin_nav_links
             SET name = $1, url = $2, parent_id = $3, display_order = $4
             WHERE id = $5
             RETURNING *`,
            [name.trim(), linkUrl, parentId, displayOrder, linkId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: '找不到要更新的導覽連結' });
        }
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error(`[API PUT /api/admin/nav-links/${id}] 更新導覽連結失敗:`, err.stack || err);
         if (err.code === '23503') {
             return res.status(400).json({ error: '指定的父層級 ID 不存在' });
         }
        res.status(500).json({ error: '更新導覽連結時發生錯誤' });
    }
});

// DELETE /api/admin/nav-links/:id - 刪除導覽連結
app.delete('/api/admin/nav-links/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
     const linkId = parseInt(id, 10);

     if (isNaN(linkId)) {
        return res.status(400).json({ error: '無效的連結 ID' });
    }

    try {
        // 由於設置了 ON DELETE CASCADE，刪除父連結會自動刪除子連結
        const result = await pool.query('DELETE FROM admin_nav_links WHERE id = $1', [linkId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要刪除的導覽連結' });
        }
        res.status(204).send(); // No Content, 表示成功刪除
    } catch (err) {
        console.error(`[API DELETE /api/admin/nav-links/${id}] 刪除導覽連結失敗:`, err.stack || err);
        res.status(500).json({ error: '刪除導覽連結時發生錯誤' });
    }
});

// 修正後的排序 API 端點 - 正確處理傳入的數據
app.put('/api/admin/nav-links/reorder', isAdminAuthenticated, async (req, res) => {
    try {
        const updates = req.body;
        
        console.log('[REORDER] 收到原始請求數據:', JSON.stringify(updates, null, 2));
        console.log('[REORDER] 請求數據類型:', typeof updates);
        console.log('[REORDER] 是否為陣列:', Array.isArray(updates));
        
        // 驗證輸入
        if (!Array.isArray(updates)) {
            console.error('[REORDER] 錯誤：數據不是陣列格式');
            return res.status(400).json({ error: '請求數據必須是陣列格式' });
        }
        
        if (updates.length === 0) {
            console.error('[REORDER] 錯誤：陣列為空');
            return res.status(400).json({ error: '更新數據不能為空' });
        }
        
        // 驗證並解析每個更新項目
        const parsedUpdates = [];
        for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            console.log(`[REORDER] 處理第 ${i + 1} 項:`, update);
            
            if (!update || typeof update !== 'object') {
                const msg = `第 ${i + 1} 項數據不是有效的物件`;
                console.error('[REORDER] ' + msg);
                return res.status(400).json({ error: msg });
            }
            
            // 檢查 id 字段
            let id;
            if (update.id === undefined || update.id === null) {
                const msg = `第 ${i + 1} 項缺少 ID 字段`;
                console.error('[REORDER] ' + msg);
                return res.status(400).json({ error: msg });
            }
            
            // 確保 id 是數字
            id = parseInt(update.id, 10);
            if (isNaN(id)) {
                const msg = `第 ${i + 1} 項 ID 無法轉換為數字: ${update.id}`;
                console.error('[REORDER] ' + msg);
                return res.status(400).json({ error: msg });
            }
            
            // 檢查 display_order 字段
            let order;
            if (update.display_order === undefined || update.display_order === null) {
                const msg = `第 ${i + 1} 項缺少 display_order 字段`;
                console.error('[REORDER] ' + msg);
                return res.status(400).json({ error: msg });
            }
            
            // 確保 display_order 是數字
            order = parseInt(update.display_order, 10);
            if (isNaN(order)) {
                const msg = `第 ${i + 1} 項 display_order 無法轉換為數字: ${update.display_order}`;
                console.error('[REORDER] ' + msg);
                return res.status(400).json({ error: msg });
            }
            
            parsedUpdates.push({ id, display_order: order });
            console.log(`[REORDER] 第 ${i + 1} 項解析完成: id=${id}, order=${order}`);
        }
        
        console.log('[REORDER] 所有數據解析完成:', parsedUpdates);
        
        // 使用事務處理
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            console.log('[REORDER] 開始事務');
            
            // 逐一更新每個項目
            for (const update of parsedUpdates) {
                const { id, display_order } = update;
                
                console.log(`[REORDER] 正在更新 ID ${id} 為順序 ${display_order}`);
                
                const result = await client.query(
                    'UPDATE admin_nav_links SET display_order = $1 WHERE id = $2',
                    [display_order, id]
                );
                
                console.log(`[REORDER] 更新結果: 影響行數 ${result.rowCount}`);
                
                if (result.rowCount === 0) {
                    throw new Error(`找不到 ID 為 ${id} 的連結`);
                }
            }
            
            await client.query('COMMIT');
            console.log('[REORDER] 事務提交成功');
            res.status(200).json({ 
                message: '排序更新成功', 
                updated: parsedUpdates.length,
                updates: parsedUpdates
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[REORDER] 事務回滾:', error);
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('[API PUT /api/admin/nav-links/reorder] 排序失敗:', error.stack || error);
        res.status(500).json({ 
            error: `排序失敗: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 其他 API 保持不變
// GET /api/admin/nav-links
app.get('/api/admin/nav-links', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, name, url, parent_id, display_order
             FROM admin_nav_links
             ORDER BY display_order ASC, name ASC`
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error('[API GET /api/admin/nav-links] 獲取導覽連結失敗:', err.stack || err);
        res.status(500).json({ error: '無法獲取導覽連結' });
    }
});

// POST /api/admin/nav-links - 新增導覽連結
app.post('/api/admin/nav-links', isAdminAuthenticated, async (req, res) => {
    const { name, url, parent_id, display_order } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: '連結名稱為必填項' });
    }
    // parent_id 可以是 null 或數字
    const parentId = parent_id ? parseInt(parent_id, 10) : null;
    if (parent_id && isNaN(parentId)) {
         return res.status(400).json({ error: '無效的父層級 ID' });
    }
    const displayOrder = display_order ? parseInt(display_order, 10) : 0;
     if (isNaN(displayOrder)) {
         return res.status(400).json({ error: '無效的顯示順序' });
     }
     // URL 可以是空字串或 null，代表是父層級選單
     const linkUrl = url && url.trim() !== '' ? url.trim() : null;


    try {
        const { rows } = await pool.query(
            `INSERT INTO admin_nav_links (name, url, parent_id, display_order)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name.trim(), linkUrl, parentId, displayOrder]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[API POST /api/admin/nav-links] 新增導覽連結失敗:', err.stack || err);
        // 檢查外鍵約束錯誤
        if (err.code === '23503') {
             return res.status(400).json({ error: '指定的父層級 ID 不存在' });
        }
        res.status(500).json({ error: '新增導覽連結時發生錯誤' });
    }
});

// PUT /api/admin/nav-links/:id - 更新導覽連結
app.put('/api/admin/nav-links/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { name, url, parent_id, display_order } = req.body;
    const linkId = parseInt(id, 10);

     if (isNaN(linkId)) {
        return res.status(400).json({ error: '無效的連結 ID' });
    }
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: '連結名稱為必填項' });
    }
    const parentId = parent_id ? parseInt(parent_id, 10) : null;
     if (parent_id && isNaN(parentId)) {
         return res.status(400).json({ error: '無效的父層級 ID' });
     }
     // 防止將連結設置為自己的父級
     if (parentId === linkId) {
         return res.status(400).json({ error: '不能將連結設置為自己的父層級' });
     }
    const displayOrder = display_order ? parseInt(display_order, 10) : 0;
     if (isNaN(displayOrder)) {
         return res.status(400).json({ error: '無效的顯示順序' });
     }
     const linkUrl = url && url.trim() !== '' ? url.trim() : null;

    try {
        // 可選：檢查 parent_id 是否會造成循環引用 (更複雜的檢查)

        const { rows } = await pool.query(
            `UPDATE admin_nav_links
             SET name = $1, url = $2, parent_id = $3, display_order = $4
             WHERE id = $5
             RETURNING *`,
            [name.trim(), linkUrl, parentId, displayOrder, linkId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: '找不到要更新的導覽連結' });
        }
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error(`[API PUT /api/admin/nav-links/${id}] 更新導覽連結失敗:`, err.stack || err);
         if (err.code === '23503') {
             return res.status(400).json({ error: '指定的父層級 ID 不存在' });
         }
        res.status(500).json({ error: '更新導覽連結時發生錯誤' });
    }
});

// DELETE /api/admin/nav-links/:id - 刪除導覽連結
app.delete('/api/admin/nav-links/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
     const linkId = parseInt(id, 10);

     if (isNaN(linkId)) {
        return res.status(400).json({ error: '無效的連結 ID' });
    }

    try {
        // 由於設置了 ON DELETE CASCADE，刪除父連結會自動刪除子連結
        const result = await pool.query('DELETE FROM admin_nav_links WHERE id = $1', [linkId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要刪除的導覽連結' });
        }
        res.status(204).send(); // No Content, 表示成功刪除
    } catch (err) {
        console.error(`[API DELETE /api/admin/nav-links/${id}] 刪除導覽連結失敗:`, err.stack || err);
        res.status(500).json({ error: '刪除導覽連結時發生錯誤' });
    }
});

// --- 黑名單管理 API Router ---
const blacklistRouter = express.Router();

// 獲取所有黑名單項目
blacklistRouter.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM black_list_items ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('[API GET /api/blacklist] 獲取黑名單失敗:', err.stack || err);
        res.status(500).json({ error: '獲取黑名單時發生錯誤' });
    }
});

// 新增黑名單項目
blacklistRouter.post('/', async (req, res) => {
    const { name, phone, email, location } = req.body;
    
    if (!name && !phone && !email && !location) {
        return res.status(400).json({ error: '請至少提供姓名、電話、Email或地點其中一項' });
    }

    try {
        const { rows } = await pool.query(
            'INSERT INTO black_list_items (name, phone, email, location) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, phone, email, location]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[API POST /api/blacklist] 新增黑名單失敗:', err.stack || err);
        res.status(500).json({ error: '新增黑名單時發生錯誤' });
    }
});

// 更新黑名單項目
blacklistRouter.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, phone, email, location } = req.body;

    try {
        const { rows } = await pool.query(
            'UPDATE black_list_items SET name = $1, phone = $2, email = $3, location = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
            [name, phone, email, location, id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: '找不到指定的黑名單項目' });
        }
        
        res.json(rows[0]);
    } catch (err) {
        console.error(`[API PUT /api/blacklist/${id}] 更新黑名單失敗:`, err.stack || err);
        res.status(500).json({ error: '更新黑名單時發生錯誤' });
    }
});

// 刪除黑名單項目
blacklistRouter.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { rowCount } = await pool.query(
            'DELETE FROM black_list_items WHERE id = $1',
            [id]
        );
        
        if (rowCount === 0) {
            return res.status(404).json({ error: '找不到指定的黑名單項目' });
        }
        
        res.status(204).send();
    } catch (err) {
        console.error(`[API DELETE /api/blacklist/${id}] 刪除黑名單失敗:`, err.stack || err);
        res.status(500).json({ error: '刪除黑名單時發生錯誤' });
    }
});

app.use('/api/blacklist', blacklistRouter);
// --- 獲取活躍房間列表 API ---
app.get('/api/game-rooms', async (req, res) => {
    try {
        // 從資料庫獲取最近活躍的房間
        const { rows } = await pool.query(
            `SELECT room_id, room_name, created_at, last_active, game_state
             FROM game_rooms
             WHERE last_active > NOW() - INTERVAL '30 minutes'
             ORDER BY last_active DESC`
        );
        
        // 格式化回應
        const roomsData = rows.map(room => {
            const gameState = room.game_state;
            const playerCount = Object.keys(gameState.players || {}).length;
            
            return {
                id: room.room_id,
                roomName: room.room_name,
                playerCount,
                maxPlayers: gameState.maxPlayers,
                createdAt: room.created_at
            };
        });
        
        res.json(roomsData);
    } catch (err) {
        console.error('[API ERROR] 獲取房間列表失敗:', err);
        res.status(500).json({ error: '獲取房間列表時發生伺服器錯誤' });
    }
});

// --- 加入房間 API (可選，主要通過 WebSocket 連接) ---
app.post('/api/game-rooms/:roomId/join', async (req, res) => {
    const { roomId } = req.params;
    const { playerName } = req.body;
    
    if (!playerName || !playerName.trim() || playerName.length > 10) {
        return res.status(400).json({ error: '玩家名稱必須在 1-10 個字元之間' });
    }
    
    try {
        // 檢查房間是否存在
        const roomResult = await pool.query(
            'SELECT game_state FROM game_rooms WHERE room_id = $1',
            [roomId]
        );
        
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ error: '找不到指定房間' });
        }
        
        const trimmedPlayerName = playerName.trim();
        const gameState = roomResult.rows[0].game_state;
        
        // 檢查房間人數是否已滿
        if (Object.keys(gameState.players).length >= gameState.maxPlayers) {
            return res.status(409).json({ error: '房間已滿' });
        }
        
        // 檢查名稱是否重複
        for (const playerId in gameState.players) {
            if (gameState.players[playerId].name === trimmedPlayerName) {
                return res.status(409).json({ error: '該名稱已被使用' });
            }
        }
        
        res.status(200).json({ message: '可以加入房間', roomId, playerName: trimmedPlayerName });
    } catch (err) {
        console.error('[API ERROR] 檢查房間失敗:', err);
        res.status(500).json({ error: '檢查房間時發生伺服器錯誤' });
    }
});

// --- 定期清理不活躍房間 ---
async function cleanInactiveRooms() {
    try {
        const { rowCount } = await pool.query(
            `DELETE FROM game_rooms WHERE last_active < NOW() - INTERVAL '1 hour'`
        );
        
        if (rowCount > 0) {
            console.log(`[Cleanup] 已刪除 ${rowCount} 個不活躍房間`);
        }
    } catch (err) {
        console.error('[Cleanup ERROR] 清理不活躍房間失敗:', err);
    }
}

// 每小時清理一次不活躍房間
setInterval(cleanInactiveRooms, 60 * 60 * 1000);

// --- HTTP 服務器設置 ---
const server = http.createServer(app);

// --- WebSocket 服務器設置 ---
const wss = new WebSocket.Server({ server });






// --- ★★★ 修改 wss.on('connection') ★★★ ---
wss.on('connection', async (ws, req) => { // <--- 改成 async 函數
    // 解析URL參數
    const url = new URL(req.url, `http://${req.headers.host}`);
    const clientType = url.searchParams.get('clientType');
    const roomId = url.searchParams.get('roomId');
    const playerName = url.searchParams.get('playerName'); // 從 game.js 的 wsUrl 獲取

    console.log(`[WS] Connection attempt: Type=${clientType}, Room=${roomId}, Player=${playerName}`);

    // --- 基本驗證 ---
    if (!roomId || !clientType || !playerName) {
        console.warn(`[WS] Connection rejected: Missing roomId, clientType, or playerName.`);
        ws.close(1008, "缺少房間 ID、客戶端類型或玩家名稱");
        return;
    }

    // -------------------------------------------------------------
    // --- Simple Walker (clientType = 'controller') 處理邏輯 ---
    // -------------------------------------------------------------
    if (clientType === 'controller') {
        let roomData;
        let playerId; // 在 try 外部定義 playerId

        try {
            // 1. 使用資料庫查找房間是否存在
            roomData = await dbClient.getRoom(roomId);
            if (!roomData || !roomData.game_state) { // 確保 game_state 存在
                console.warn(`[WS Simple Walker] Room ${roomId} not found in DB or invalid state. Terminating.`);
                ws.close(1011, "找不到房間或房間無效");
                return;
            }
            console.log(`[WS Simple Walker] Room ${roomId} found in DB.`);

            // 2. 生成唯一的玩家 ID
            playerId = uuidv4();

            // 3. 嘗試將玩家加入資料庫中的房間狀態
            //    *** 注意：這裡假設你已經修改了 dbclient.js 的 addPlayerToRoom
            //    *** 移除了名稱重複檢查（根據你的要求） ***
            const updatedRoomResult = await dbClient.addPlayerToRoom(roomId, playerId, playerName);

            // 檢查 addPlayerToRoom 是否成功 (例如，是否因房間滿了而失敗)
            if (!updatedRoomResult || !updatedRoomResult.game_state) {
                 // addPlayerToRoom 內部應該拋出錯誤，理論上不太會到這裡，但做個保險
                throw new Error("加入房間到資料庫失敗");
            }

            // 4. 玩家成功加入 - 更新 WebSocket 連接狀態
            ws.playerId = playerId;
            ws.roomId = roomId;
            ws.clientType = clientType; // 保存類型方便後續處理
            console.log(`[WS Simple Walker] Player ${playerName} (ID: ${playerId}) added to room ${roomId} in DB.`);

            // 5. 將此 WebSocket 連接加入 simpleWalkerConnections 管理
            if (!simpleWalkerConnections.has(roomId)) {
                simpleWalkerConnections.set(roomId, new Set());
            }
            simpleWalkerConnections.get(roomId).add(ws);
            console.log(`[WS Simple Walker] Connection added. Room ${roomId} active connections: ${simpleWalkerConnections.get(roomId).size}`);

            // 6. 發送玩家信息給當前客戶端
            ws.send(JSON.stringify({ type: 'playerInfo', playerId: playerId }));
            console.log(`[WS Simple Walker] Sent playerInfo to ${playerName}`);

            // 7. 發送**最新的**遊戲狀態給當前客戶端
            //    (使用 addPlayerToRoom 返回的最新狀態)
            const currentGameState = updatedRoomResult.game_state;
            const currentRoomName = updatedRoomResult.room_name;
            ws.send(JSON.stringify({ type: 'gameStateUpdate', roomName: currentRoomName, gameState: currentGameState }));
            console.log(`[WS Simple Walker] Sent initial gameStateUpdate to ${playerName}`);

            // 8. 廣播**最新的**遊戲狀態給房間內所有**其他**客戶端
            broadcastToSimpleWalkerRoom(roomId, {
                type: 'gameStateUpdate',
                roomName: currentRoomName, // 包含房間名
                gameState: currentGameState
            }, ws); // 傳入 ws，避免重複發送給自己
            console.log(`[WS Simple Walker] Broadcasted gameStateUpdate to other players in room ${roomId}.`);

        } catch (error) {
            // 處理加入房間過程中可能發生的錯誤 (房間滿、資料庫錯誤等)
            console.error(`[WS Simple Walker] Error during connection setup for player ${playerName} in room ${roomId}:`, error.stack || error);
            let closeReason = "加入房間失敗";
            if (error.message.includes('房間已滿')) {
                closeReason = "房間已滿";
            }
            // 注意：名稱重複的錯誤假設已被移除，如果未移除，可以在這裡添加判斷
            // else if (error.message.includes('名稱已被使用')) {
            //     closeReason = "玩家名稱已被使用";
            // }
            try {
                // 嘗試發送錯誤給客戶端，告知失敗原因
                ws.send(JSON.stringify({ type: 'error', message: closeReason }));
            } catch (sendErr) { /* 如果發送也失敗，忽略 */}
            ws.close(4000, closeReason); // 使用自定義錯誤碼 4000
            return; // 結束處理
        }

        // --- 為這個 Simple Walker 連接設置消息、關閉、錯誤處理器 ---
        ws.on('message', (message) => handleSimpleWalkerMessage(ws, message)); // <--- 使用新的處理函數
        ws.on('close', () => handleSimpleWalkerClose(ws));          // <--- 使用新的處理函數
        ws.on('error', (error) => handleSimpleWalkerError(ws, error));      // <--- 使用新的處理函數

    }
    // -
    // 
   
});








/**
 * 處理來自 Simple Walker 客戶端 (控制器) 的消息
 * @param {WebSocket} ws WebSocket 連接對象
 * @param {string} message 收到的消息 (JSON 字串)
 */
async function handleSimpleWalkerMessage(ws, message) {
    // 確保連接有必要的屬性
    if (!ws.roomId || !ws.playerId || !ws.clientType || ws.clientType !== 'controller') {
        console.warn(`[WS Simple Walker] 收到來自無效連接的消息，忽略。`);
        return;
    }

    const roomId = ws.roomId;
    const playerId = ws.playerId;
    // 獲取玩家名稱以便日誌記錄 (如果需要，可以在連接時保存 ws.playerName = playerName)
    // const playerName = ws.playerName || playerId; // 假設連接時保存了 playerName

    try {
        const parsedMessage = JSON.parse(message);
        console.log(`[WS Simple Walker] Received message from ${playerId} in room ${roomId}:`, parsedMessage);



// 處理模板應用請求 - 添加到 handleSimpleWalkerMessage 函數中 "// ← INSERT HERE" 位置
if (parsedMessage.type === 'applyTemplate') {
    const { templateId } = parsedMessage;
    
    if (!templateId) {
      console.warn(`[WS Simple Walker] 收到無效的模板應用請求: ${JSON.stringify(parsedMessage)}`);
      return;
    }
    
    console.log(`[WS Simple Walker] 玩家 ${playerId} 請求應用模板 ${templateId} 到房間 ${roomId}`);
    
    try {
      // 1. 從資料庫獲取模板詳情
      const templateResult = await pool.query(
        'SELECT template_id, template_name, description, style_data, cell_data FROM walk_map_templates WHERE template_id = $1',
        [templateId]
      );
      
      if (templateResult.rows.length === 0) {
        ws.send(JSON.stringify({
          type: 'error',
          message: '找不到指定的模板'
        }));
        return;
      }
      
      const templateData = templateResult.rows[0];
      
      // 2. 更新房間狀態 - 添加模板 ID (可選，如果你想追蹤每個房間使用的模板)
      const roomData = await dbClient.getRoom(roomId);
      if (!roomData || !roomData.game_state) {
        ws.send(JSON.stringify({
          type: 'error',
          message: '無法更新房間：找不到房間狀態'
        }));
        return;
      }
      
      // 將模板 ID 添加到房間狀態（假設 gameState 有個 templateId 屬性）
      const gameState = roomData.game_state;
      gameState.templateId = templateId;
      
      // 更新資料庫中的房間狀態
      const updatedRoom = await dbClient.updateRoomState(roomId, gameState);
      
      // 3. 廣播模板更新消息給房間內所有玩家
      broadcastToSimpleWalkerRoom(roomId, {
        type: 'templateUpdate',
        templateId: templateId,
        templateData: templateData
      });
     
      console.log(`[WS Simple Walker] 已將模板 ${templateId} 應用到房間 ${roomId}`);
    } catch (err) {
      console.error(`[WS Simple Walker] 應用模板 ${templateId} 到房間 ${roomId} 時出錯:`, err.stack || err);
      ws.send(JSON.stringify({
        type: 'error',
        message: '應用模板時發生錯誤'
      }));
    }
    
    return; // 處理完畢，結束函數
  }





        // 根據消息類型進行不同處理
        if (parsedMessage.type === 'moveCommand' && parsedMessage.direction) {
            const direction = parsedMessage.direction; // 'forward' 或 'backward'

            // --- 執行移動邏輯 ---
            // 1. 獲取當前遊戲狀態
            const roomData = await dbClient.getRoom(roomId);
            if (!roomData || !roomData.game_state) {
                console.warn(`[WS Simple Walker Move] 找不到房間 ${roomId} 的狀態`);
                return;
            }
            const gameState = roomData.game_state;
            const mapSize = gameState.mapLoopSize || 10; // 獲取地圖大小

            // 2. 確保玩家存在於狀態中
            if (!gameState.players || !gameState.players[playerId]) {
                console.warn(`[WS Simple Walker Move] 玩家 ${playerId} 不在房間 ${roomId} 的狀態中`);
                // 可能需要關閉這個無效的連接或發送錯誤
                ws.send(JSON.stringify({ type: 'error', message: '伺服器狀態錯誤，找不到您的玩家資料' }));
                ws.close(1011, "玩家資料不同步");
                return;
            }

            // 3. 計算新位置
            let currentPosition = gameState.players[playerId].position;
            let newPosition;
            if (direction === 'forward') {
                newPosition = (currentPosition + 1) % mapSize;
            } else if (direction === 'backward') {
                newPosition = (currentPosition - 1 + mapSize) % mapSize;
            } else {
                console.warn(`[WS Simple Walker Move] 無效的移動方向: ${direction}`);
                return; // 忽略無效方向
            }

            // 4. 更新資料庫中的玩家位置
            console.log(`[WS Simple Walker Move] Updating position for ${playerId} in ${roomId} from ${currentPosition} to ${newPosition}`);
            const updatedRoomResult = await dbClient.updatePlayerPosition(roomId, playerId, newPosition);

            if (!updatedRoomResult || !updatedRoomResult.game_state) {
                console.error(`[WS Simple Walker Move] 更新玩家 ${playerId} 位置失敗`);
                ws.send(JSON.stringify({ type: 'error', message: '更新位置失敗' }));
                return;
            }

            // 5. 獲取更新後的完整狀態並廣播
            const latestGameState = updatedRoomResult.game_state;
            const latestRoomName = updatedRoomResult.room_name; // 確保返回了 room_name

            console.log(`[WS Simple Walker Move] Player ${playerId} moved to ${newPosition}. Broadcasting update.`);
            broadcastToSimpleWalkerRoom(roomId, {
                type: 'gameStateUpdate',
                roomName: latestRoomName,
                gameState: latestGameState
            }); // 廣播給所有人 (包括自己，以便確認)

        } 
        // 處理 toggleVisibility 消息
        else if (parsedMessage.type === 'toggleVisibility' && parsedMessage.visible !== undefined) {
            // 1. 獲取當前遊戲狀態
            const roomData = await dbClient.getRoom(roomId);
            if (!roomData || !roomData.game_state) {
                console.warn(`[WS Simple Walker] 找不到房間 ${roomId} 的狀態`);
                return;
            }
            const gameState = roomData.game_state;

            // 2. 確保玩家存在於狀態中
            if (!gameState.players || !gameState.players[playerId]) {
                console.warn(`[WS Simple Walker] 玩家 ${playerId} 不在房間 ${roomId} 的狀態中`);
                ws.send(JSON.stringify({ type: 'error', message: '伺服器狀態錯誤，找不到您的玩家資料' }));
                return;
            }

            // 3. 更新玩家的可見性狀態
            const newVisibility = parsedMessage.visible;
            console.log(`[WS Simple Walker] 更新玩家 ${playerId} 的可見性為: ${newVisibility}`);
            
            // 設置玩家的 visible 屬性
            gameState.players[playerId].visible = newVisibility;
            
            // 4. 更新資料庫中的遊戲狀態
            const updatedRoomResult = await dbClient.updateRoomState(roomId, gameState);
            
            if (!updatedRoomResult || !updatedRoomResult.game_state) {
                console.error(`[WS Simple Walker] 更新玩家 ${playerId} 可見性失敗`);
                ws.send(JSON.stringify({ type: 'error', message: '更新可見性失敗' }));
                return;
            }
            
            // 5. 獲取更新後的完整狀態並廣播
            const latestGameState = updatedRoomResult.game_state;
            const latestRoomName = updatedRoomResult.room_name;
            
            console.log(`[WS Simple Walker] Player ${playerId} visibility changed to ${newVisibility}. Broadcasting update.`);
            broadcastToSimpleWalkerRoom(roomId, {
                type: 'gameStateUpdate',
                roomName: latestRoomName,
                gameState: latestGameState
            });
        } else {
            console.warn(`[WS Simple Walker] 收到未知類型的消息，忽略: ${parsedMessage.type}`);
        }

    } catch (error) {
        console.error(`[WS Simple Walker] 處理來自 ${playerId} 的消息時出錯:`, error.stack || error);
        try {
            ws.send(JSON.stringify({ type: 'error', message: '處理您的請求時發生錯誤' }));
        } catch (sendErr) { /* 忽略 */}
    }
}

/**
 * 處理 Simple Walker 客戶端 (控制器) 的斷開連接
 * @param {WebSocket} ws 斷開的 WebSocket 連接對象
 */
async function handleSimpleWalkerClose(ws) {
    const roomId = ws.roomId;
    const playerId = ws.playerId;
    const clientType = ws.clientType;

    // 確保是 Simple Walker 的連接
    if (!roomId || !playerId || !clientType || clientType !== 'controller') {
        console.warn(`[WS Simple Walker Close] 無效連接斷開，無法清理。`);
        return;
    }

    console.log(`[WS Simple Walker Close] Player ${playerId} disconnected from room ${roomId}.`);

    // 1. 從 simpleWalkerConnections 中移除此連接
    const connections = simpleWalkerConnections.get(roomId);
    if (connections) {
        connections.delete(ws);
        console.log(`[WS Simple Walker Close] Connection removed. Room ${roomId} remaining connections: ${connections.size}`);
        // 如果房間沒有連接了，從 Map 中移除這個房間的 Set
        if (connections.size === 0) {
            simpleWalkerConnections.delete(roomId);
            console.log(`[WS Simple Walker Close] Room ${roomId} removed from active connections map as it's empty.`);
            // 注意：這裡不刪除資料庫中的房間，讓定期清理任務去做
        }
    } else {
         console.warn(`[WS Simple Walker Close] Room ${roomId} not found in active connections map during cleanup.`);
    }


    try {
        // 2. 從資料庫的遊戲狀態中移除玩家
        console.log(`[WS Simple Walker Close] Attempting to remove player ${playerId} from DB state in room ${roomId}...`);
        const updatedRoomResult = await dbClient.removePlayerFromRoom(roomId, playerId);

        if (updatedRoomResult && updatedRoomResult.game_state) {
            console.log(`[WS Simple Walker Close] Player ${playerId} removed from DB state. Broadcasting update.`);
            // 3. 廣播最新的遊戲狀態給剩餘的玩家
             if (simpleWalkerConnections.has(roomId) && simpleWalkerConnections.get(roomId).size > 0) {
                 broadcastToSimpleWalkerRoom(roomId, {
                     type: 'gameStateUpdate',
                     roomName: updatedRoomResult.room_name, // 確保返回了 room_name
                     gameState: updatedRoomResult.game_state
                 });
             }
        } else if (updatedRoomResult === null) {
            console.warn(`[WS Simple Walker Close] Room ${roomId} not found in DB when trying to remove player ${playerId}.`);
        } else {
             console.warn(`[WS Simple Walker Close] Player ${playerId} might not have been in the DB state or removal failed.`);
        }

    } catch (error) {
        console.error(`[WS Simple Walker Close] 移除玩家 ${playerId} 或廣播更新時出錯:`, error.stack || error);
    }
}

/**
 * 處理 Simple Walker 客戶端 (控制器) 的 WebSocket 錯誤
 * @param {WebSocket} ws 發生錯誤的 WebSocket 連接對象
 * @param {Error} error 錯誤對象
 */
function handleSimpleWalkerError(ws, error) {
    const roomId = ws.roomId || '未知房間';
    const playerId = ws.playerId || '未知玩家';
    const clientType = ws.clientType || '未知類型';

    console.error(`[WS Simple Walker Error] WebSocket error for ${clientType} ${playerId} in room ${roomId}:`, error.message);

    // 錯誤發生時，通常連接也會關閉，確保執行清理邏輯
    // handleSimpleWalkerClose(ws); // onclose 會自動調用，這裡調用可能重複

    // 強制終止可能卡住的連接
    if (ws.readyState !== WebSocket.CLOSED) {
        ws.terminate();
    }
}










/**
 * 向指定 Simple Walker 房間內的所有客戶端廣播消息
 * @param {string} roomId 房間 ID
 * @param {object} message 要發送的消息對象 (會被 JSON.stringify)
 * @param {WebSocket} [senderWs=null] 可選，要排除的發送者連接，避免發送給自己
 */
function broadcastToSimpleWalkerRoom(roomId, message, senderWs = null) {
    const connections = simpleWalkerConnections.get(roomId);

    if (!connections || connections.size === 0) {
        // console.log(`[WS Broadcast] Room ${roomId} has no active connections to broadcast to.`);
        return; // 沒有連接，無需廣播
    }

    const messageString = JSON.stringify(message);
    let broadcastCount = 0;

    connections.forEach(client => {
        // 檢查是否要排除發送者，以及連接是否開啟
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            try {
                client.send(messageString);
                broadcastCount++;
            } catch (sendError) {
                console.error(`[WS Broadcast Error] Failed to send message to client ${client.playerId || ''} in room ${roomId}:`, sendError.message);
                // 如果發送失敗，可能需要從 Set 中移除這個客戶端並關閉它
                connections.delete(client);
                client.terminate();
            }
        }
    });

    if (broadcastCount > 0 || (connections.size === 1 && senderWs === null)) { // 如果只有一人且沒排除發送者，也算廣播成功
         const excludingSender = senderWs ? ` (excluding sender ${senderWs.playerId})` : '';
         console.log(`[WS Broadcast] Broadcasted message to ${broadcastCount} client(s) in room ${roomId}${excludingSender}. Message type: ${message.type}`);
    }
}














 








// --- 指向 Render 的持久化磁碟 /data 下的 uploads 子目錄 ---
const uploadDir = '/data/uploads'; // <-- 直接使用絕對路徑

// 確保這個目錄存在 (如果不存在則創建)
if (!fs.existsSync(uploadDir)) {
  try {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`持久化上傳目錄已創建: ${uploadDir}`);
  } catch (err) {
      console.error(`無法創建持久化上傳目錄 ${uploadDir}:`, err);
      // 根據你的需求，這裡可能需要拋出錯誤或有後備方案
      // 例如，如果無法創建 /data/uploads，可能退回使用臨時目錄？
      // 但最好的方式是確保 /data 磁碟已正確掛載且應用有權限寫入
  }
}

 
 

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // 檢查是否為 PNG 文件
    const originalExt = path.extname(file.originalname).toLowerCase();
    const isPNG = originalExt === '.png' || file.mimetype.toLowerCase() === 'image/png';
    
    // 如果是 PNG，保存為 JPG
    const ext = isPNG ? '.jpg' : originalExt;
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e5) + ext;
    
    if (isPNG) {
      // 如果是 PNG，修改 mimetype
      file.mimetype = 'image/jpeg';
    }
    
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif','.html', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
        return cb(new Error('只允許上傳圖片 (png, jpg, gif) 或 PDF 檔案！'));
    }
    cb(null, true);
  },
  limits: { fileSize: 4 * 1024 * 1024 } // 限制 4MB
});

// --- 新增 publicSafeUpload 的定義 ---
const publicSafeUpload = multer({
  storage, // 重用相同的儲存設定
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ['.png', '.jpg', '.jpeg', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedImageTypes.includes(ext)) {
        return cb(new Error('只允許上傳圖片檔案 (png, jpg, jpeg, gif)！'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 4 * 1024 * 1024 } // 限制 4MB，與 upload 相同
});
// --- END OF publicSafeUpload 定義 ---
app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, error: '沒有上傳檔案或欄位名稱不符 (應為 "image")' });
        }

        let fileToProcess = { ...file };
        const originalFilePath = fileToProcess.path;
        const imageBuffer = await fs.promises.readFile(originalFilePath); // 讀取為 buffer
        const lowerMimetype = fileToProcess.mimetype.toLowerCase();
        const lowerExt = path.extname(fileToProcess.originalname).toLowerCase();
        let finalImageUrl = '/uploads/' + fileToProcess.filename;

        // 只對 JPG/PNG 進行處理
        if (['.jpg', '.jpeg', '.png'].includes(lowerExt) || ['image/jpeg', 'image/png'].includes(lowerMimetype)) {
            console.log(`[API /api/upload] 檔案 ${fileToProcess.originalname} 被識別為 JPEG/PNG，準備進行處理。`);
            try {
                console.log(`[API /api/upload] Reading metadata for: ${originalFilePath}`);

                // 檢查是否為 PNG 格式
                const isPNG = lowerMimetype === 'image/png' || lowerExt === '.png';
                
                // 初始化 sharp 實例（使用 buffer）
                let sharpInstance = sharp(imageBuffer);
                
                // 設置基本的壓縮選項
                const compressionOptions = {
                    quality: 85,            // 較低的質量設置
                    chromaSubsampling: '4:2:0'  // 更積極的色度抽樣
                };

                // 如果是 PNG，設置輸出格式為 JPEG
                if (isPNG) {
                    sharpInstance = sharpInstance.jpeg(compressionOptions);
                    console.log(`[API /api/upload] Converting PNG to JPG for file: ${file.originalname}`);
                } else {
                    // 如果已經是 JPEG，仍然應用壓縮設置
                    sharpInstance = sharpInstance.jpeg(compressionOptions);
                }

                // 自動旋轉
                const rotatedImageBuffer = await sharpInstance.rotate().toBuffer();
                sharpInstance = sharp(rotatedImageBuffer);

                const metadata = await sharpInstance.metadata();
                console.log(`[API /api/upload] Metadata for ${fileToProcess.originalname}: width=${metadata.width}, height=${metadata.height}, format=${metadata.format}`);

                const originalWidth = metadata.width;
                let targetWidth = originalWidth;
                let needsResize = false;

                if (originalWidth > 1500) {
                    targetWidth = Math.round(originalWidth * 0.25); // 縮小到25%
                    needsResize = true;
                } else if (originalWidth > 800) {
                    targetWidth = Math.round(originalWidth * 0.50); // 縮小到50%
                    needsResize = true;
                } else if (originalWidth > 500) {
                    targetWidth = Math.round(originalWidth * 0.75); // 縮小到75%
                    needsResize = true;
                }

                let finalBuffer;
                if (needsResize) {
                    console.log(`[API /api/upload] 圖片 ${fileToProcess.originalname} (寬度: ${originalWidth}px) 需要縮放至 ${targetWidth}px`);
                    finalBuffer = await sharpInstance
                        .resize({ 
                            width: targetWidth,
                            withoutEnlargement: true  // 防止小圖被放大
                        })
                        .toBuffer();
                } else {
                    finalBuffer = rotatedImageBuffer;
                     console.log(`[API /api/upload] 圖片 ${fileToProcess.originalname} (寬度: ${originalWidth}px) 無需縮放。`);
                }

                // 最終的壓縮處理
                const finalImage = sharp(finalBuffer).jpeg(compressionOptions);
                const processedBuffer = await finalImage.toBuffer();
                
                await fs.promises.writeFile(originalFilePath, processedBuffer);
                const newStats = fs.statSync(originalFilePath);
                console.log(`[API /api/upload] 圖片 ${fileToProcess.originalname} 已成功處理並覆蓋原檔案，新大小: ${newStats.size} bytes`);

            } catch (sharpError) {
                console.error(`[API /api/upload] Sharp processing FAILED for ${fileToProcess.originalname}. Error Name: ${sharpError.name}, Message: ${sharpError.message}`);
                console.error("[API /api/upload] Full Sharp Error Object:", sharpError);
                console.error("[API /api/upload] Sharp Error Stack:", sharpError.stack);
                
                try {
                    if (fs.existsSync(originalFilePath)) {
                        fs.unlinkSync(originalFilePath);
                        console.warn(`[API /api/upload] 已刪除處理失敗的原始檔案: ${originalFilePath}`);
                    }
                } catch (unlinkErr) {
                    console.error(`[API /api/upload] 刪除處理失敗的原始檔案 ${originalFilePath} 時再次出錯:`, unlinkErr);
                }
                return res.status(500).json({ success: false, error: `圖片處理失敗: ${sharpError.message}` });
            }
        } else {
            console.log(`[API /api/upload] 檔案 ${fileToProcess.originalname} (${lowerMimetype}) 不進行處理。`);
        }

        console.log(`[API /api/upload] Successfully processed ${fileToProcess.originalname}. Responding with URL: ${finalImageUrl}`);
        res.json({ success: true, url: finalImageUrl });

    } catch (err) {
        console.error('[API /api/upload] Outer catch block error:', err);
        console.error('[API /api/upload] 上傳圖片錯誤:', err);
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
                console.warn(`[API /api/upload] 因上傳過程錯誤，已清理檔案: ${req.file.path}`);
            } catch (cleanupErr) {
                console.error(`[API /api/upload] 清理錯誤檔案 ${req.file.path} 時再次出錯:`, cleanupErr);
            }
        }
        res.status(500).json({ success: false, error: err.message || '伺服器錯誤' });
    }
});





// [app.use for voitRouter moved to an earlier position in the file]





// --- 新的公開安全圖片上傳端點 ---
app.post('/api/upload-safe-image', publicSafeUpload.single('image'), async (req, res) => {
    // 'image' 是前端 input file 元素的 name 屬性

    if (!visionClient) { // 確保 Vision API 客戶端已初始化
        console.error('[API /upload-safe-image] Vision API client not available.');
        return res.status(503).json({ success: false, error: "圖片分析服務目前不可用。" });
    }

    if (!req.file) {
        // multer fileFilter 拒絕或沒有檔案上傳
        // multer 的錯誤處理應該在下面捕獲，但這裡可以作為一個保險
        return res.status(400).json({ success: false, error: '沒有上傳有效的圖片檔案或欄位名稱不符 (應為 "image")' });
    }
    
    const file = req.file;
    const imageBuffer = fs.readFileSync(file.path); // 如果用 diskStorage，需要讀取檔案
                                                  // 如果 publicSafeUploadStorage 用 memoryStorage, 則用 file.buffer

    console.log(`[API /upload-safe-image] Received file: ${file.originalname}, size: ${file.size}, mimetype: ${file.mimetype}`);

    try {
        // --- 1. 安全搜尋偵測 ---
        console.log(`[API /upload-safe-image] Performing Safe Search detection for ${file.originalname}`);
        const [safeSearchResult] = await visionClient.annotateImage({
            image: { content: imageBuffer },
            features: [{ type: 'SAFE_SEARCH_DETECTION' }],
        });

        const safeSearch = safeSearchResult.safeSearchAnnotation;
        let isImageSafe = true;
        let unsafeCategoriesDetected = [];

        if (safeSearch) {
            if (['LIKELY', 'VERY_LIKELY'].includes(safeSearch.adult)) {
                isImageSafe = false; unsafeCategoriesDetected.push('成人');
            }
            if (['LIKELY', 'VERY_LIKELY'].includes(safeSearch.violence)) {
                isImageSafe = false; unsafeCategoriesDetected.push('暴力');
            }
            if (['LIKELY', 'VERY_LIKELY'].includes(safeSearch.racy)) {
                isImageSafe = false; unsafeCategoriesDetected.push('煽情');
            }
            // 你可以根據需要添加對 spoof, medical 的檢查
        }

        if (!isImageSafe) {
            console.warn(`[API /upload-safe-image] Unsafe content detected in ${file.originalname}. Categories: ${unsafeCategoriesDetected.join(', ')}.`);
            // 刪除已上傳的不安全圖片
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
                console.log(`[API /upload-safe-image] Deleted unsafe image: ${file.path}`);
            }
            return res.status(400).json({
                success: false,
                error: `上傳的圖片內容不適宜 (${unsafeCategoriesDetected.join(', ')})，已被拒絕。`
            });
        }
        console.log(`[API /upload-safe-image] Image ${file.originalname} passed Safe Search.`);

        // --- 2. 如果圖片安全，則進行 Sharp 處理 (與你現有 /api/upload 類似) ---
        let fileToProcess = { ...file }; // file.path 仍然是 multer 保存的路徑
        const originalFilePath = fileToProcess.path; // multer儲存的原始檔案路徑
        const lowerMimetype = fileToProcess.mimetype.toLowerCase();
        const lowerExt = path.extname(fileToProcess.originalname).toLowerCase();
        
        // 檢查是否為 PNG 格式
        const isPNG = lowerMimetype === 'image/png' || lowerExt === '.png';
        
        // 自動旋轉（如果需要，基於之前的討論）
        let sharpInstance = sharp(imageBuffer); // 使用 buffer 初始化 sharp
        
        // 如果是 PNG，設置輸出格式為 JPEG
        if (isPNG) {
            sharpInstance = sharpInstance.jpeg({ quality: 90 });
            console.log(`[API /upload-safe-image] Converting PNG to JPG for file: ${file.originalname}`);
        }
        
        const rotatedImageBuffer = await sharpInstance.rotate().toBuffer();
        sharpInstance = sharp(rotatedImageBuffer);
        
        const metadata = await sharpInstance.metadata();
        console.log(`[API /upload-safe-image] Metadata for ${file.originalname} (after auto-rotate): width=${metadata.width}, height=${metadata.height}`);

        const originalWidth = metadata.width;
        let targetWidth = originalWidth;
        let needsResize = false;
        if (originalWidth > 1500) { targetWidth = Math.round(originalWidth * 0.25); needsResize = true; }
        else if (originalWidth > 800) { targetWidth = Math.round(originalWidth * 0.50); needsResize = true; }
        else if (originalWidth > 500) { targetWidth = Math.round(originalWidth * 0.75); needsResize = true; }

        let processedBuffer;
        let finalFilename = fileToProcess.filename; // Ensure filename is defined, it should be from multer
        let finalImageUrl;

        if (needsResize) {
            console.log(`[API /upload-safe-image] Resizing image ${file.originalname} from ${originalWidth}px to ${targetWidth}px`);
            processedBuffer = await sharpInstance
                .resize({ width: targetWidth })
                .toBuffer();
            await fs.promises.writeFile(originalFilePath, processedBuffer);
            const newStats = fs.statSync(originalFilePath);
            console.log(`[API /upload-safe-image] Image ${file.originalname} successfully resized. New size: ${newStats.size} bytes`);
        } else {
            // 如果不需要縮放，但進行了旋轉或格式轉換(PNG->JPG)，也需要保存更新後的 buffer
            // For PNGs converted to JPG, rotatedImageBuffer would have been passed through .jpeg()
            // For JPGs only rotated, rotatedImageBuffer is the one to save.
            // The key is that sharpInstance was updated if a conversion happened.
            const bufferToSave = (isPNG || sharpInstance !== sharp(rotatedImageBuffer)) ? await sharpInstance.toBuffer() : rotatedImageBuffer;
            await fs.promises.writeFile(originalFilePath, bufferToSave);
            console.log(`[API /upload-safe-image] Image ${file.originalname} saved (no resize, but potential rotation/conversion).`);
        }
        
        finalImageUrl = '/uploads/' + finalFilename; // Use the filename from multer
        console.log(`[API /upload-safe-image] Successfully processed and saved ${file.originalname}. URL: ${finalImageUrl}`);
        res.json({ success: true, url: finalImageUrl }); // 返回最終的 URL

    } catch (err) {
        console.error(`[API /upload-safe-image] Error processing file ${file ? file.originalname : 'N/A'}:`, err);
        // 確保在錯誤時刪除已上傳的檔案
        if (file && file.path && fs.existsSync(file.path)) {
            try {
                fs.unlinkSync(file.path);
                console.warn(`[API /upload-safe-image] Cleaned up file due to error: ${file.path}`);
            } catch (cleanupErr) {
                console.error(`[API /upload-safe-image] Error cleaning up file ${file.path} after error:`, cleanupErr);
            }
        }
        // 使用你修改後的全局錯誤處理器，它會返回 JSON
        // 但在這裡我們可以直接返回 JSON 錯誤
        if (err instanceof multer.MulterError) { // 捕獲 multer 自身的錯誤
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ success: false, error: `檔案超過限制大小 (${publicSafeUpload.opts.limits.fileSize / 1024 / 1024}MB)。` });
            }
            return res.status(400).json({ success: false, error: `上傳錯誤: ${err.message}` });
        }
        return res.status(500).json({ success: false, error: err.message || '圖片上傳及處理失敗。' });
    }
});






// --- 基本認證中間件函數定義 ---
const basicAuthMiddleware = (req, res, next) => {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'password'; // *** 強烈建議在 .env 中設定一個強密碼 ***
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
            next(); // 認證成功，繼續下一個中間件或路由處理
        } else {
            console.warn(`認證失敗 - 使用者名稱或密碼錯誤: User='${user}'`);
            res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
            return res.status(401).send('認證失敗。');
        }
    } catch (error) {
        console.error("認證標頭解析錯誤:", error);
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send('認證失敗 (格式錯誤)。');
    }
};

 


 

// --- 玻璃橋遊戲排行榜 API ---
// GET /api/bridge-game/leaderboard - 獲取排行榜數據
app.get('/api/bridge-game/leaderboard', async (req, res) => {
    const playerCount = parseInt(req.query.player_count) || 8;
    try {
        const result = await pool.query(
            'SELECT player_name, completion_time, created_at FROM bridge_game_leaderboard WHERE player_count = $1 ORDER BY completion_time ASC LIMIT 10',
            [playerCount]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('獲取橋遊戲排行榜數據錯誤:', err);
        res.status(500).json({ error: '獲取排行榜數據失敗' });
    }
});

// POST /api/bridge-game/submit-score - 提交分數
app.post('/api/bridge-game/submit-score', async (req, res) => {
    try {
        const { player_name, player_count, completion_time } = req.body;
        if (!player_name || !player_count || !completion_time) {
            return res.status(400).json({ error: '缺少必要參數' });
        }
        const ip_address = req.ip || 'unknown';        await pool.query(
            'INSERT INTO bridge_game_leaderboard (player_name, player_count, completion_time, ip_address) VALUES ($1, $2, $3, $4)',
            [player_name, player_count, completion_time, ip_address]
        );
        res.json({ success: true, message: '成績提交成功' });
    } catch (err) {
        console.error('提交橋遊戲分數錯誤:', err);
        res.status(500).json({ error: '提交分數失敗' });
    }
});







// --- 命運轉輪主題 API ---
// GET /api/wheel-game/themes - 獲取所有主題
app.get('/api/wheel-game/themes', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, created_at FROM wheel_themes ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('獲取轉輪主題失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET /api/wheel-game/themes/:id - 獲取特定主題
app.get('/api/wheel-game/themes/:id', async (req, res) => {
    const { id } = req.params;
    const themeId = parseInt(id, 10);
    if (isNaN(themeId)) {
        return res.status(400).json({ error: '無效的主題 ID' });
    }

    try {
        // 獲取主題基本信息
        const themeResult = await pool.query(
            'SELECT id, name, description, created_at, updated_at FROM wheel_themes WHERE id = $1',
            [themeId]
        );

        if (themeResult.rows.length === 0) {
            return res.status(404).json({ error: '找不到主題' });
        }

        // 獲取主題的選項
        const optionsResult = await pool.query(
            'SELECT id, text, color, display_order FROM wheel_options WHERE theme_id = $1 ORDER BY display_order ASC',
            [themeId]
        );

        // 組合返回數據
        const theme = themeResult.rows[0];
        theme.options = optionsResult.rows;

        res.json(theme);
    } catch (err) {
        console.error(`獲取轉輪主題 ${id} 失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// POST /api/wheel-game/themes - 創建新主題
app.post('/api/wheel-game/themes', async (req, res) => {
    const { name, description, options } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: '主題名稱不能為空' });
    }
    
    if (!options || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ error: '必須提供至少一個有效的選項' });
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 插入主題
        const ip_address = req.ip || 'unknown';
        const themeResult = await client.query(
            `INSERT INTO wheel_themes (name, description, creator_ip) 
             VALUES ($1, $2, $3) 
             RETURNING id, name, description, created_at, updated_at`,
            [name, description || null, ip_address]
        );
        
        const themeId = themeResult.rows[0].id;
        
        // 插入選項
        for (const option of options) {
            if (!option.text) continue; // 跳過空文字的選項
            
            await client.query(
                `INSERT INTO wheel_options (theme_id, text, color, display_order) 
                 VALUES ($1, $2, $3, $4)`,
                [themeId, option.text, option.color || '#cccccc', option.display_order || 0]
            );
        }
        
        await client.query('COMMIT');
        
        // 獲取選項
        const optionsResult = await client.query(
            'SELECT id, text, color, display_order FROM wheel_options WHERE theme_id = $1 ORDER BY display_order ASC',
            [themeId]
        );
        
        // 組合返回數據
        const result = themeResult.rows[0];
        result.options = optionsResult.rows;
        
        res.status(201).json(result);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('創建轉輪主題失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤', detail: err.message });
    } finally {
        client.release();
    }
});

// DELETE /api/wheel-game/themes/:id - 刪除主題
app.delete('/api/wheel-game/themes/:id', async (req, res) => {
    const { id } = req.params;
    const themeId = parseInt(id, 10);
    if (isNaN(themeId)) {
        return res.status(400).json({ error: '無效的主題 ID' });
    }

    try {
        const result = await pool.query(
            'DELETE FROM wheel_themes WHERE id = $1',
            [themeId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要刪除的主題' });
        }

        res.status(204).send();
    } catch (err) {
        console.error(`刪除轉輪主題 ${id} 失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});




 // 創建公開的模板 API 路由（這段代碼應該添加到 server.js 中 "// ← INSERT HERE" 的位置）
// 公開的模板 API 路由
app.get('/api/walk_map/templates', async (req, res) => {
    try {
      // 從資料庫獲取模板列表
      const result = await pool.query('SELECT template_id, template_name, description FROM walk_map_templates ORDER BY template_name');
      res.json(result.rows);
    } catch (err) {
      console.error('[API GET /api/walk_map/templates] Error:', err.stack || err);
      res.status(500).json({ error: '取得模板列表失敗' });
    }
  });
  
  // 獲取單個模板詳情
  app.get('/api/walk_map/templates/:templateId', async (req, res) => {
    const { templateId } = req.params;
    try {
      // 同時選取 style_data 和 cell_data
      const result = await pool.query(
        'SELECT template_id, template_name, description, style_data, cell_data FROM walk_map_templates WHERE template_id = $1',
        [templateId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '找不到模板' });
      }
      
      const templateData = result.rows[0];
      
      // 確保 cell_data 是陣列 (如果 DB 是 NULL 或解析失敗)
      if (templateData.cell_data && typeof templateData.cell_data === 'string') {
        try { templateData.cell_data = JSON.parse(templateData.cell_data); } 
        catch(e) { templateData.cell_data = []; }
      } else if (!templateData.cell_data) {
        templateData.cell_data = [];
      }
      
      // 確保 style_data 是物件 (如果 DB 是 NULL 或解析失敗)
      if (templateData.style_data && typeof templateData.style_data === 'string') {
        try { templateData.style_data = JSON.parse(templateData.style_data); } 
        catch(e) { templateData.style_data = {}; }
      } else if (!templateData.style_data) {
        templateData.style_data = {};
      }
  
      res.json(templateData); // 回傳包含 style 和 cell 資料的完整模板
    } catch (err) {
      console.error(`[API GET /api/walk_map/templates/${templateId}] Error:`, err.stack || err);
      res.status(500).json({ error: '取得模板詳情失敗' });
    }
  });













// 獲取隨機關卡
app.get('/api/diffrent-game/levels/random', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM diffrent_game_levels WHERE active = TRUE ORDER BY RANDOM() LIMIT 3'
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching random levels:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // 獲取特定關卡的差異點
  app.get('/api/diffrent-game/differences/:levelId', async (req, res) => {
    try {
      const { levelId } = req.params;
      const result = await pool.query(
        'SELECT * FROM diffrent_game_differences WHERE level_id = $1',
        [levelId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching differences:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // 保存新的差異點 (用於編輯器)
  app.post('/api/diffrent-game/differences', async (req, res) => {
    try {
      const { levelId, differences } = req.body;
      
      // 先刪除該關卡現有的差異點
      await pool.query('DELETE FROM diffrent_game_differences WHERE level_id = $1', [levelId]);
      
      // 插入新的差異點
      for (const diff of differences) {
        // --- 開始修改 ---
        // 將座標值轉換為浮點數並四捨五入到兩位小數
        const topValue = parseFloat(diff.position_top).toFixed(2);
        const leftValue = parseFloat(diff.position_left).toFixed(2);
        // --- 結束修改 ---

        await pool.query(
          'INSERT INTO diffrent_game_differences (level_id, position_top, position_left, description) VALUES ($1, $2, $3, $4)',
          // --- 開始修改 ---
          [levelId, topValue, leftValue, diff.description] // 使用處理過的值
          // --- 結束修改 ---
        );
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving differences:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // 獲取排行榜
  app.get('/api/diffrent-game/leaderboard', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT player_name, time_seconds, completion_date as created_at FROM diffrent_game_leaderboard ORDER BY time_seconds ASC LIMIT 50'
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // 提交排行榜成績
  app.post('/api/diffrent-game/leaderboard', async (req, res) => {
    try {
      const { player_name, time_seconds } = req.body;
      await pool.query(
        'INSERT INTO diffrent_game_leaderboard (player_name, time_seconds) VALUES ($1, $2)',
        [player_name, time_seconds]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving leaderboard entry:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });






// 獲取所有關卡
app.get('/api/diffrent-game/levels', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM diffrent_game_levels ORDER BY id');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching all levels:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // 獲取特定關卡
  app.get('/api/diffrent-game/levels/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM diffrent_game_levels WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Level not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching specific level:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });






























// --- 洞洞樂模板 API (Card Game Templates API) - 使用資料庫 ---




// 新增關卡
app.post('/api/diffrent-game/levels', async (req, res) => {
    try {
      const { level_name, left_image_url, right_image_url, active } = req.body;
      
      // 驗證數據
      if (!level_name || !left_image_url || !right_image_url) {
        return res.status(400).json({ error: '必須提供所有必要欄位' });
      }
      
      const result = await pool.query(
        'INSERT INTO diffrent_game_levels (level_name, left_image_url, right_image_url, active) VALUES ($1, $2, $3, $4) RETURNING id',
        [level_name, left_image_url, right_image_url, active || true]
      );
      
      res.status(201).json({ 
        success: true, 
        id: result.rows[0].id,
        message: '關卡已成功新增' 
      });
    } catch (error) {
      console.error('新增關卡錯誤:', error);
      res.status(500).json({ error: '伺服器錯誤' });
    }
  });



// --- 洞洞樂模板 API (Card Game Templates API) - 使用資料庫 ---

// GET /api/card-game/templates - 獲取所有公開模板
app.get('/api/card-game/templates', async (req, res) => {
    try {
        // 查詢 ID, 名稱和內容數據
        const result = await pool.query(
            `SELECT id, template_name, content_data, created_at, updated_at
             FROM card_game_templates
             WHERE is_public = TRUE
             ORDER BY updated_at DESC`
        );
        // 直接返回查詢結果的 rows (包含 id, template_name, content_data)
        res.json(result.rows);
    } catch (err) {
        console.error('獲取洞洞樂模板失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET /api/card-game/templates/:id - 獲取特定模板 (保留，雖然前端目前可能不直接用)
app.get('/api/card-game/templates/:id', async (req, res) => {
    const { id } = req.params;
    const templateId = parseInt(id, 10); // 確保是整數
    if (isNaN(templateId)) {
        return res.status(400).json({ error: '無效的模板 ID' });
    }

    try {
        const result = await pool.query(
            'SELECT id, template_name, content_data, created_at, updated_at FROM card_game_templates WHERE id = $1 AND is_public = TRUE', // 假設只能獲取公開的
            [templateId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到模板或模板不公開' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(`獲取洞洞樂模板 ${id} 失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});
// POST /api/card-game/templates - 创建新模板 (修正版)
app.post('/api/card-game/templates', async (req, res) => {
    const { template_name, content_data, is_public = true } = req.body;
    
    console.log('收到模板創建請求:', {
        template_name,
        content_data_type: typeof content_data,
        is_array: Array.isArray(content_data),
        content_sample: Array.isArray(content_data) ? content_data.slice(0, 3) : content_data
    });
    
    if (!template_name) {
        return res.status(400).json({ error: '模板名称不能为空' });
    }
    
    // 数据验证和处理
    let validContentData;
    try {
        // 確保我們有一個有效的陣列
        if (Array.isArray(content_data)) {
            validContentData = content_data;
        } 
        // 如果是字符串，尝试解析
        else if (typeof content_data === 'string') {
            const parsed = JSON.parse(content_data);
            // 解析後確保它是陣列
            validContentData = Array.isArray(parsed) ? parsed : [parsed];
        } 
        // 其他类型，包装成数组
        else if (content_data !== null && content_data !== undefined) {
            validContentData = [content_data];
        }
        // 兜底：如果都不是，使用空陣列
        else {
            validContentData = [];
        }
        
        // 再次验证是否為有效 JSON，確保可序列化
        console.log('處理後的 content_data:', {
            is_array: Array.isArray(validContentData),
            length: Array.isArray(validContentData) ? validContentData.length : 0,
            sample: Array.isArray(validContentData) ? validContentData.slice(0, 3) : validContentData
        });
        
        // 測試是否可序列化
        JSON.stringify(validContentData); 
    } catch (error) {
        console.error('内容数据格式错误:', error, '收到的数据:', content_data);
        return res.status(400).json({ 
            error: '内容数据格式错误，必须是有效的JSON',
            detail: error.message,
            received: typeof content_data
        });
    }
    
    try {
        // 检查模板名称是否已存在
        const existingCheck = await pool.query(
            'SELECT 1 FROM card_game_templates WHERE template_name = $1',
            [template_name]
        );
        
        if (existingCheck.rows.length > 0) {
            return res.status(409).json({ error: '此模板名称已存在' });
        }
        
        // 插入新模板，使用验证过的数据
        const ip_address = req.ip || 'unknown';        
        const result = await pool.query(
            `INSERT INTO card_game_templates (template_name, content_data, creator_ip, is_public) 
             VALUES ($1, $2::json, $3, $4) 
             RETURNING id, template_name, content_data, created_at, updated_at`,
            [template_name, JSON.stringify(validContentData), ip_address, is_public]
          );
        
        console.log('模板創建成功:', {
            id: result.rows[0].id,
            template_name: result.rows[0].template_name
        });
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('创建洞洞乐模板失败:', err);
        res.status(500).json({ 
            error: '服务器内部错误',
            detail: err.message,
            code: err.code
        });
    }
});

// DELETE /api/card-game/templates/:id - 刪除模板 (使用 ID)
app.delete('/api/card-game/templates/:id', async (req, res) => {
    const { id } = req.params;
    const templateId = parseInt(id, 10); // 確保是整數
    if (isNaN(templateId)) {
        return res.status(400).json({ error: '無效的模板 ID' });
    }

    try {
        const result = await pool.query(
            'DELETE FROM card_game_templates WHERE id = $1',
            [templateId]
        );

        if (result.rowCount === 0) {
            // 如果沒有刪除任何行，表示找不到該 ID
            return res.status(404).json({ error: '找不到要刪除的模板' });
        }

        console.log(`模板 ID ${templateId} 已成功刪除`);
        res.status(204).send(); // 成功刪除，無內容返回

    } catch (err) {
        console.error(`刪除洞洞樂模板 ${id} 失敗:`, err);
        // 可以根據錯誤碼判斷是否是外鍵約束等問題
        res.status(500).json({ error: '伺服器內部錯誤，無法刪除模板' });
    }
});











// GET /api/admin/files - 獲取檔案列表 (分頁、篩選、排序)
app.get('/api/admin/files', isAdminAuthenticated, async (req, res) => { // <-- 添加 basicAuthMiddleware
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15; // 每頁數量
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'newest'; // newest, oldest, name_asc, name_desc, size_asc, size_desc
    const fileType = req.query.fileType || 'all'; // all, image, pdf, other
    const search = req.query.search?.trim() || '';

    let orderByClause = 'ORDER BY uploaded_at DESC'; // 預設最新
    switch (sortBy) {
        case 'oldest': orderByClause = 'ORDER BY uploaded_at ASC'; break;
        case 'name_asc': orderByClause = 'ORDER BY original_filename ASC'; break;
        case 'name_desc': orderByClause = 'ORDER BY original_filename DESC'; break;
        case 'size_asc': orderByClause = 'ORDER BY size_bytes ASC NULLS FIRST'; break; // NULLS FIRST 讓無大小的排前面
        case 'size_desc': orderByClause = 'ORDER BY size_bytes DESC NULLS LAST'; break; // NULLS LAST 讓無大小的排後面
    }

    let whereClauses = [];
    const queryParams = [];
    let paramIndex = 1;

    if (fileType !== 'all' && ['image', 'pdf', 'other'].includes(fileType)) {
        whereClauses.push(`file_type = $${paramIndex++}`);
        queryParams.push(fileType);
    }
    if (search) {
        // 使用 LOWER() 進行不區分大小寫搜尋
        whereClauses.push(`LOWER(original_filename) LIKE LOWER($${paramIndex++})`);
        queryParams.push(`%${search}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const client = await pool.connect();
    try {
        // 查詢總數
        const totalResult = await client.query(`SELECT COUNT(*) FROM uploaded_files ${whereSql}`, queryParams);
        const totalItems = parseInt(totalResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limit);

        // 查詢當前頁面數據
        // 添加 limit 和 offset 的參數索引
        const limitParamIdx = paramIndex++;
        const offsetParamIdx = paramIndex++;
        queryParams.push(limit);
        queryParams.push(offset);

        const filesResult = await client.query(
            `SELECT id, file_path, original_filename, mimetype, size_bytes, file_type, uploaded_at
             FROM uploaded_files
             ${whereSql}
             ${orderByClause}
             LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
            queryParams
        );

        res.json({
            files: filesResult.rows,
            currentPage: page,
            totalPages: totalPages,
            totalItems: totalItems,
            limit: limit,
            sortBy: sortBy,
            fileType: req.query.fileType || 'all', // 返回實際使用的 fileType
            search: req.query.search || ''       // 返回實際使用的 search
        });

    } catch (err) {
        console.error('[API GET /admin/files] Error fetching file list:', err);
        res.status(500).json({ error: '無法獲取檔案列表', detail: err.message });
    } finally {
        client.release();
    }
});











// 2. 創建 IP 限制器實例（設置每日每IP最大報告數為10）
const reportTemplatesRouter = express.Router();
const reportRateLimiter = createReportRateLimiter(3);

// 3. 將這段代碼加入到報告路由處理部分

// 處理報告提交時添加大小限制
reportTemplatesRouter.post('/', reportRateLimiter, async (req, res) => {
    const { title, html_content } = req.body;
    const creatorIp = req.ip || 'unknown'; // 獲取 IP
    const reportUUID = uuidv4(); // 生成 UUID

    // 基本驗證
    if (!title || title.trim() === '') {
        return res.status(400).json({ error: '報告標題為必填項。' });
    }
    // 檢查 html_content 是否存在 (允許空字串)
    if (typeof html_content !== 'string') {
        return res.status(400).json({ error: '報告內容為必填項且必須是字串。' });
    }

    // 檢查內容大小限制 (最大 50,000 字節)
    const MAX_CONTENT_BYTES = 50000;
    const contentSizeBytes = Buffer.byteLength(html_content, 'utf8');
    
    if (contentSizeBytes > MAX_CONTENT_BYTES) {
        return res.status(413).json({ 
            error: '報告內容超過大小限制', 
            detail: `最大允許 ${MAX_CONTENT_BYTES.toLocaleString()} 字節，當前 ${contentSizeBytes.toLocaleString()} 字節`,
            maxBytes: MAX_CONTENT_BYTES,
            currentBytes: contentSizeBytes
        });
    }

    try {
        // 使用修改後的 SQL 查詢，加入 size_bytes 欄位
        const query = `
            INSERT INTO report_templates (id, title, html_content, size_bytes, creator_ip)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, title, created_at, updated_at, size_bytes;
        `;
        // 現在提供5個參數，與SQL查詢對應
        const result = await pool.query(query, [
            reportUUID, 
            title.trim(), 
            html_content,
            contentSizeBytes,
            creatorIp
        ]);

        console.log(`[API POST /api/reports] 新增報告成功，ID: ${result.rows[0].id}，大小: ${contentSizeBytes} 字節`);

        // 回傳包含 UUID 和大小資訊的成功訊息給前端
        res.status(201).json({
            success: true,
            id: result.rows[0].id, // 返回 UUID
            title: result.rows[0].title,
            created_at: result.rows[0].created_at,
            size_bytes: result.rows[0].size_bytes
        });

    } catch (err) {
        console.error('[API POST /api/reports] 新增報告時發生錯誤:', err);
        res.status(500).json({ error: '伺服器內部錯誤，無法儲存報告。', detail: err.message });
    }
});





















// POST /api/reports - 新增報告模板

// POST /api/reports - 新增報告模板 (更新版本，支持字節大小計算)
reportTemplatesRouter.post('/', async (req, res) => {
    const { title, html_content } = req.body;
    const creatorIp = req.ip || 'unknown'; // 獲取 IP
    const reportUUID = uuidv4(); // 生成 UUID

    // 基本驗證
    if (!title || title.trim() === '') {
        return res.status(400).json({ error: '報告標題為必填項。' });
    }
    // 檢查 html_content 是否存在 (允許空字串)
    if (typeof html_content !== 'string') {
        return res.status(400).json({ error: '報告內容為必填項且必須是字串。' });
    }

    // 計算內容大小（字節數）
    const contentSizeBytes = Buffer.byteLength(html_content, 'utf8');

    try {
        // 使用修改後的 SQL 查詢，加入 size_bytes 欄位
        const query = `
            INSERT INTO report_templates (id, title, html_content, size_bytes, creator_ip)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, title, created_at, updated_at, size_bytes;
        `;
        // 現在提供5個參數，與SQL查詢對應
        const result = await pool.query(query, [
            reportUUID, 
            title.trim(), 
            html_content,
            contentSizeBytes,
            creatorIp
        ]);

        console.log(`[API POST /api/reports] 新增報告成功，ID: ${result.rows[0].id}，大小: ${contentSizeBytes} 字節`);

        // 回傳包含 UUID 和大小資訊的成功訊息給前端
        res.status(201).json({
            success: true,
            id: result.rows[0].id, // 返回 UUID
            title: result.rows[0].title,
            created_at: result.rows[0].created_at,
            size_bytes: result.rows[0].size_bytes
        });

    } catch (err) {
        console.error('[API POST /api/reports] 新增報告時發生錯誤:', err);
        res.status(500).json({ error: '伺服器內部錯誤，無法儲存報告。', detail: err.message });
    }
});

// GET /api/reports - 獲取報告列表 (用於 Report.html 管理區)
reportTemplatesRouter.get('/', async (req, res) => {
    try {
        const query = `
            SELECT id, title, updated_at -- 只選擇列表需要的欄位
            FROM report_templates
            ORDER BY updated_at DESC; -- 通常按最新修改排序
        `;
        const result = await pool.query(query);
        res.json(result.rows); // 直接回傳結果陣列

    } catch (err) {
        console.error('[API GET /api/reports] 獲取報告列表時發生錯誤:', err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取報告列表。', detail: err.message });
    }
});

// GET /api/reports/:id - 獲取單一報告內容 (用於 report-view.html 和編輯加載)
reportTemplatesRouter.get('/:id', async (req, res) => {
    const { id } = req.params; // 這個 id 現在是 UUID 格式的字串

    // UUID 格式的基礎驗證 (確保它看起來像 UUID)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
         return res.status(400).json({ error: '無效的報告 ID 格式 (非 UUID)。' });
    }

    try {
        const query = `
            SELECT html_content -- 檢視頁面只需要 HTML 內容
            FROM report_templates
            WHERE id = $1;
        `;
        const result = await pool.query(query, [id]); // 使用 UUID 查詢

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到指定的報告。' });
        }
        // *** 只回傳 html_content ***
        res.json({ html_content: result.rows[0].html_content });

    } catch (err) {
        console.error(`[API GET /api/reports/${id}] 獲取單一報告時發生錯誤:`, err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取報告內容。', detail: err.message });
    }
});

// PUT /api/reports/:id - 更新報告模板
reportTemplatesRouter.put('/:id', async (req, res) => {
    const { id } = req.params;
    const reportId = parseInt(id, 10);
    const { title, html_content } = req.body; // 從請求體獲取更新的資料

    // 驗證 ID
    if (isNaN(reportId)) {
        return res.status(400).json({ error: '無效的報告 ID 格式。' });
    }
    // 驗證輸入資料
    if (!title || title.trim() === '') {
        return res.status(400).json({ error: '報告標題為必填項。' });
    }
    if (typeof html_content !== 'string') {
        return res.status(400).json({ error: '報告內容為必填項且必須是字串。' });
    }

    try {
        // updated_at 會由資料庫觸發器自動處理
        const query = `
            UPDATE report_templates
            SET title = $1, html_content = $2
            WHERE id = $3
            RETURNING id, title, updated_at; -- 回傳更新後的資訊
        `;
        const result = await pool.query(query, [title.trim(), html_content, reportId]);

        // 檢查是否有資料被更新
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的報告。' });
        }

        console.log(`[API PUT /api/reports] 更新報告成功，ID: ${reportId}`);
        res.json(result.rows[0]); // 回傳更新後的報告資訊

    } catch (err) {
        console.error(`[API PUT /api/reports/${id}] 更新報告時發生錯誤:`, err);
        res.status(500).json({ error: '伺服器內部錯誤，無法更新報告。', detail: err.message });
    }
});

// DELETE /api/reports/:id - 刪除報告模板
reportTemplatesRouter.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const reportId = parseInt(id, 10);

    // 驗證 ID
    if (isNaN(reportId)) {
        return res.status(400).json({ error: '無效的報告 ID 格式。' });
    }

    try {
        const query = 'DELETE FROM report_templates WHERE id = $1;';
        const result = await pool.query(query, [reportId]);

        // 檢查是否有資料被刪除
        if (result.rowCount === 0) {
            // 通常不視為錯誤，可能已經被刪除
            console.warn(`[API DELETE /api/reports] 嘗試刪除報告 ID ${reportId}，但資料庫中找不到。`);
        } else {
             console.log(`[API DELETE /api/reports] 報告 ID ${reportId} 已從資料庫刪除。`);
        }

        res.status(204).send(); // 狀態 204 No Content，表示成功處理但無內容返回

    } catch (err) {
        console.error(`[API DELETE /api/reports/${id}] 刪除報告時發生錯誤:`, err);
        res.status(500).json({ error: '伺服器內部錯誤，無法刪除報告。', detail: err.message });
    }
});

// *** 非常重要：將定義好的 Router 掛載到 Express App 上 ***
// 這行告訴 Express，所有指向 /api/reports 的請求都由 reportTemplatesRouter 來處理
app.use('/store/api/reports', reportTemplatesRouter);
app.use('/api/reports', reportTemplatesRouter);

// --- 結束 Report Templates API ---


















// POST /api/admin/files/upload - 上傳檔案
app.post('/api/admin/files/upload', isAdminAuthenticated, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: '沒有上傳檔案或欄位名稱不符 (應為 "file")' });
    }
    const file = req.file;
    let fileToSave = { ...file }; // 複製一份檔案資訊，以便修改
    const originalFilePath = fileToSave.path; // multer 儲存的原始檔案路徑

    const fileUrlPath = '/uploads/' + fileToSave.filename;

    let fileType = 'other';
    const lowerMimetype = fileToSave.mimetype.toLowerCase();
    const lowerExt = path.extname(fileToSave.originalname).toLowerCase();

    if (['.png', '.jpg', '.jpeg'].includes(lowerExt) || ['image/jpeg', 'image/png'].includes(lowerMimetype)) {
        fileType = 'image'; // 明確標記為可處理的圖片
        console.log(`檔案 ${fileToSave.originalname} 被識別為 JPEG/PNG，準備進行縮放檢查。`);
        try {
            const metadata = await sharp(originalFilePath).metadata();
            const originalWidth = metadata.width;
            let targetWidth = originalWidth;
            let needsResize = false;

            if (originalWidth > 1500) {
                targetWidth = Math.round(originalWidth * 0.25);
                needsResize = true;
            } else if (originalWidth > 800) {
                targetWidth = Math.round(originalWidth * 0.50);
                needsResize = true;
            } else if (originalWidth > 500) {
                targetWidth = Math.round(originalWidth * 0.75); // 縮小到75%
                needsResize = true;
            }

            if (needsResize) {
                console.log(`圖片 ${fileToSave.originalname} (寬度: ${originalWidth}px) 需要縮放至 ${targetWidth}px`);
                const tempResizedPath = originalFilePath + '_resized_temp' + lowerExt;
                
                await sharp(originalFilePath)
                    .resize({ width: targetWidth })
                    .toFile(tempResizedPath);
                
                console.log(`圖片已縮放至臨時路徑: ${tempResizedPath}`);

                // 刪除 multer 最初上傳的原始檔案
                if (fs.existsSync(originalFilePath)) {
                    fs.unlinkSync(originalFilePath);
                    console.log(`已刪除原始 multer 檔案: ${originalFilePath}`);
                }

                // 將縮放後的臨時檔案重命名為 multer 原本使用的檔案路徑
                fs.renameSync(tempResizedPath, originalFilePath);
                fileToSave.path = originalFilePath; // 更新 fileToSave 中的路徑
                
                // 更新檔案大小
                const newStats = fs.statSync(fileToSave.path);
                fileToSave.size = newStats.size;
                console.log(`圖片 ${fileToSave.originalname} 已成功縮放並覆蓋原檔案，新路徑: ${fileToSave.path}, 新大小: ${fileToSave.size} bytes`);
            } else {
                console.log(`圖片 ${fileToSave.originalname} (寬度: ${originalWidth}px) 無需縮放。`);
            }
        } catch (sharpError) {
            console.error(`Sharp 處理圖片 ${fileToSave.originalname} 失敗:`, sharpError);
            // 如果縮放失敗，刪除已上傳的原始檔案並回報錯誤
            try {
                if (fs.existsSync(originalFilePath)) {
                    fs.unlinkSync(originalFilePath);
                    console.warn(`已刪除處理失敗的原始檔案: ${originalFilePath}`);
                }
            } catch (unlinkErr) {
                console.error(`刪除處理失敗的原始檔案 ${originalFilePath} 時再次出錯:`, unlinkErr);
            }
            return res.status(500).json({ success: false, error: `圖片處理失敗: ${sharpError.message}` });
        }
    } else if (lowerExt === '.gif' || lowerMimetype === 'image/gif') {
        fileType = 'image'; // 仍然是圖片類型
        console.log(`檔案 ${fileToSave.originalname} 是 GIF，不進行縮放。`);
    } else if (lowerExt === '.pdf' || lowerMimetype === 'application/pdf') {
        fileType = 'pdf';
        console.log(`檔案 ${fileToSave.originalname} 是 PDF，不進行縮放。`);
    } else if (['.webp', '.svg'].includes(lowerExt) || ['image/webp', 'image/svg+xml'].includes(lowerMimetype)) {
        fileType = 'image'; // 其他可被視為圖片的類型
        console.log(`檔案 ${fileToSave.originalname} 是 ${lowerExt}，不進行縮放。`);
    } else {
        fileType = 'other';
        console.log(`檔案 ${fileToSave.originalname} 是其他類型 (${fileToSave.mimetype})，不進行縮放。`);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertResult = await client.query(
            `INSERT INTO uploaded_files (file_path, original_filename, mimetype, size_bytes, file_type)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, file_path, original_filename, mimetype, size_bytes, file_type, uploaded_at`,
            [fileUrlPath, fileToSave.originalname, fileToSave.mimetype, fileToSave.size, fileType]
        );
        await client.query('COMMIT');
        console.log(`檔案 ${fileToSave.originalname} (處理後) 上傳成功並記錄到資料庫 ID: ${insertResult.rows[0].id}`);
        res.status(201).json({ success: true, file: insertResult.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[API POST /admin/files/upload] Error inserting file record (after potential resize):', err);
        // 如果資料庫儲存失敗，此時檔案可能已經被縮放並覆蓋了原始檔案
        // 由於我們策略是縮放失敗時就已刪除檔案並返回，這裡主要是處理資料庫錯誤
        // 如果需要，可以考慮是否要刪除已處理的檔案，但通常資料庫錯誤更應關注
        const fullDiskPathToClean = path.join(uploadDir, fileToSave.filename);
         try {
            if (fs.existsSync(fullDiskPathToClean)) {
                 fs.unlinkSync(fullDiskPathToClean); // 使用同步删除，因为在错误处理流程中
                 console.warn(`因資料庫儲存失敗，已刪除磁碟上的檔案: ${fullDiskPathToClean}`);
            }
        } catch (unlinkErr) {
            console.error(`因資料庫儲存失敗後，嘗試刪除磁碟檔案 ${fullDiskPathToClean} 時再次出錯:`, unlinkErr);
        }
        res.status(500).json({ success: false, error: '儲存檔案記錄到資料庫失敗', detail: err.message });
    } finally {
        client.release();
    }
});
// DELETE /api/admin/files/:id - 刪除檔案
app.delete('/api/admin/files/:id', isAdminAuthenticated, async (req, res) => {
    const fileId = parseInt(req.params.id);
    if (isNaN(fileId)) {
        return res.status(400).json({ error: '無效的檔案 ID' });
    }

    console.log(`準備刪除檔案 ID: ${fileId}`);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 先從資料庫查詢檔案路徑
        const fileResult = await client.query(
            'SELECT file_path FROM uploaded_files WHERE id = $1',
            [fileId]
        );

        if (fileResult.rowCount === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ error: `找不到檔案 ID: ${fileId}` });
        }
        const filePath = fileResult.rows[0].file_path; // 例如: /uploads/xyz.png

        // ★★★ 組合出實際的磁碟路徑 (移動到這裡) ★★★
        const filename = path.basename(filePath);
        const fullDiskPath = path.join(uploadDir, filename); // 指向 /data/uploads/xyz.png

        // 2. 刪除資料庫記錄
        const deleteDbResult = await client.query('DELETE FROM uploaded_files WHERE id = $1', [fileId]);
        if (deleteDbResult.rowCount === 0) {
           await client.query('ROLLBACK');
            client.release();
           console.warn(`嘗試刪除資料庫記錄時未找到 ID ${fileId} (可能已被刪除)`);
           return res.status(404).json({ error: `找不到要刪除的檔案記錄 (ID: ${fileId})` });
       }
        console.log(`資料庫記錄 ID ${fileId} 已刪除`);

        // 3. 嘗試刪除實際檔案 (★ 只保留這一段使用 fullDiskPath 的邏輯 ★)
        try {
            if (fs.existsSync(fullDiskPath)) {
                 await fs.promises.unlink(fullDiskPath);
                 console.log(`實際檔案已刪除: ${fullDiskPath}`);
            } else {
                console.warn(`嘗試刪除檔案，但檔案不存在: ${fullDiskPath}`);
            }
        } catch (unlinkErr) {
            console.error(`刪除檔案 ID ${fileId} 的實際檔案 (${fullDiskPath}) 時發生錯誤:`, unlinkErr);
            // 即使檔案刪除失敗，仍然 Commit 資料庫的刪除
        }

        await client.query('COMMIT');
        res.status(204).send();

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`刪除檔案 ID ${fileId} 時發生資料庫錯誤:`, err);
        res.status(500).json({ error: '伺服器錯誤，刪除檔案失敗', detail: err.message });
    } finally {
        client.release();
    }
});














// --- 翻牌對對碰遊戲API路由 ---
// 將這段代碼添加到你的 server.js 文件中

// 獲取所有遊戲模板
app.get('/api/samegame/templates', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.id, t.name, t.description, t.difficulty, t.is_active, 
                   t.created_at, t.updated_at,
                   COUNT(DISTINCT l.id) AS level_count,
                   COUNT(DISTINCT lb.id) AS play_count
            FROM samegame_templates t
            LEFT JOIN samegame_levels l ON t.id = l.template_id
            LEFT JOIN samegame_leaderboard lb ON t.id = lb.template_id
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取翻牌遊戲模板列表失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 獲取單個遊戲模板詳情及其關卡
app.get('/api/samegame/templates/:id', async (req, res) => {
    const { id } = req.params;
    const templateId = parseInt(id, 10);
    
    if (isNaN(templateId)) {
        return res.status(400).json({ error: '無效的模板 ID' });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 獲取模板詳情
        const templateResult = await client.query(`
            SELECT id, name, description, difficulty, is_active, created_at, updated_at
            FROM samegame_templates
            WHERE id = $1
        `, [templateId]);
        
        if (templateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到指定的模板' });
        }
        
        // 獲取關卡信息
        const levelsResult = await client.query(`
            SELECT l.id, l.level_number, l.grid_rows, l.grid_columns, l.created_at, l.updated_at
            FROM samegame_levels l
            WHERE l.template_id = $1
            ORDER BY l.level_number ASC
        `, [templateId]);
        
        // 獲取每個關卡的圖片
        const levelImages = {};
        for (const level of levelsResult.rows) {
            const imagesResult = await client.query(`
                SELECT id, image_url, image_order
                FROM samegame_level_images
                WHERE level_id = $1
                ORDER BY image_order ASC
            `, [level.id]);
            
            levelImages[level.id] = imagesResult.rows;
        }
        
        await client.query('COMMIT');
        
        // 構建響應數據
        const template = templateResult.rows[0];
        template.levels = levelsResult.rows.map(level => ({
            ...level,
            images: levelImages[level.id] || []
        }));
        
        res.json(template);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`獲取翻牌遊戲模板 ${id} 詳情失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    } finally {
        client.release();
    }
});

// 創建新的遊戲模板
app.post('/api/samegame/templates', isAdminAuthenticated, async (req, res) => {
    const { name, description, difficulty, is_active } = req.body;
    
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: '模板名稱為必填項' });
    }
    
    try {
        const result = await pool.query(`
            INSERT INTO samegame_templates (name, description, difficulty, is_active, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [name.trim(), description || null, difficulty || '簡單', is_active !== undefined ? is_active : true, 'admin']);
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('創建翻牌遊戲模板失敗:', err);
        if (err.code === '23505') { // 唯一約束違反
            return res.status(409).json({ error: '模板名稱已存在' });
        }
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 更新遊戲模板
app.put('/api/samegame/templates/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    const templateId = parseInt(id, 10);
    
    if (isNaN(templateId)) {
        return res.status(400).json({ error: '無效的模板 ID' });
    }
    
    const { name, description, difficulty, is_active } = req.body;
    
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: '模板名稱為必填項' });
    }
    
    try {
        const result = await pool.query(`
            UPDATE samegame_templates
            SET name = $1, description = $2, difficulty = $3, is_active = $4
            WHERE id = $5
            RETURNING *
        `, [name.trim(), description || null, difficulty || '簡單', is_active !== undefined ? is_active : true, templateId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到指定的模板' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`更新翻牌遊戲模板 ${id} 失敗:`, err);
        if (err.code === '23505') { // 唯一約束違反
            return res.status(409).json({ error: '模板名稱已存在' });
        }
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 刪除遊戲模板
app.delete('/api/samegame/templates/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    const templateId = parseInt(id, 10);
    
    if (isNaN(templateId)) {
        return res.status(400).json({ error: '無效的模板 ID' });
    }
    
    try {
        const result = await pool.query('DELETE FROM samegame_templates WHERE id = $1', [templateId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到指定的模板' });
        }
        
        res.status(204).send();
    } catch (err) {
        console.error(`刪除翻牌遊戲模板 ${id} 失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 創建新的關卡
app.post('/api/samegame/templates/:templateId/levels', isAdminAuthenticated, async (req, res) => {
    const { templateId } = req.params;
    const tplId = parseInt(templateId, 10);
    
    if (isNaN(tplId)) {
        return res.status(400).json({ error: '無效的模板 ID' });
    }
    
    const { level_number, grid_rows, grid_columns, images } = req.body;
    
    if (!level_number || isNaN(parseInt(level_number, 10))) {
        return res.status(400).json({ error: '關卡號碼為必填項且必須是數字' });
    }
    
    if (!grid_rows || isNaN(parseInt(grid_rows, 10)) || !grid_columns || isNaN(parseInt(grid_columns, 10))) {
        return res.status(400).json({ error: '網格行數和列數為必填項且必須是數字' });
    }
    
    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: '關卡圖片為必填項且必須是陣列' });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 檢查模板是否存在
        const templateCheck = await client.query('SELECT 1 FROM samegame_templates WHERE id = $1', [tplId]);
        
        if (templateCheck.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到指定的模板' });
        }
        
        // 檢查關卡號碼是否已存在
        const levelCheck = await client.query(
            'SELECT 1 FROM samegame_levels WHERE template_id = $1 AND level_number = $2',
            [tplId, level_number]
        );
        
        if (levelCheck.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `關卡 ${level_number} 已存在` });
        }
        
        // 插入新關卡
        const levelResult = await client.query(`
            INSERT INTO samegame_levels (template_id, level_number, grid_rows, grid_columns)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [tplId, level_number, grid_rows, grid_columns]);
        
        const newLevelId = levelResult.rows[0].id;
        
        // 插入關卡圖片
        for (let i = 0; i < images.length; i++) {
            const { image_url } = images[i];
            
            if (!image_url || typeof image_url !== 'string' || image_url.trim() === '') {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `第 ${i + 1} 張圖片的 URL 無效` });
            }
            
            await client.query(`
                INSERT INTO samegame_level_images (level_id, image_url, image_order)
                VALUES ($1, $2, $3)
            `, [newLevelId, image_url.trim(), i + 1]);
        }
        
        await client.query('COMMIT');
        
        // 獲取關卡的完整信息，包括圖片
        const levelData = await client.query(`
            SELECT l.id, l.level_number, l.grid_rows, l.grid_columns, l.created_at, l.updated_at
            FROM samegame_levels l
            WHERE l.id = $1
        `, [newLevelId]);
        
        const imagesResult = await client.query(`
            SELECT id, image_url, image_order
            FROM samegame_level_images
            WHERE level_id = $1
            ORDER BY image_order ASC
        `, [newLevelId]);
        
        const responseData = {
            ...levelData.rows[0],
            images: imagesResult.rows
        };
        
        res.status(201).json(responseData);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`創建關卡失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    } finally {
        client.release();
    }
});

// 更新關卡
app.put('/api/samegame/levels/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    const levelId = parseInt(id, 10);
    
    if (isNaN(levelId)) {
        return res.status(400).json({ error: '無效的關卡 ID' });
    }
    
    const { grid_rows, grid_columns, images } = req.body;
    
    if ((!grid_rows && grid_rows !== 0) || isNaN(parseInt(grid_rows, 10)) ||
        (!grid_columns && grid_columns !== 0) || isNaN(parseInt(grid_columns, 10))) {
        return res.status(400).json({ error: '網格行數和列數必須是數字' });
    }
    
    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: '關卡圖片為必填項且必須是陣列' });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 檢查關卡是否存在
        const levelCheck = await client.query('SELECT template_id FROM samegame_levels WHERE id = $1', [levelId]);
        
        if (levelCheck.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到指定的關卡' });
        }
        
        const templateId = levelCheck.rows[0].template_id;
        
        // 更新關卡
        await client.query(`
            UPDATE samegame_levels
            SET grid_rows = $1, grid_columns = $2
            WHERE id = $3
        `, [grid_rows, grid_columns, levelId]);
        
        // 刪除現有圖片
        await client.query('DELETE FROM samegame_level_images WHERE level_id = $1', [levelId]);
        
        // 插入新圖片
        for (let i = 0; i < images.length; i++) {
            const { image_url } = images[i];
            
            if (!image_url || typeof image_url !== 'string' || image_url.trim() === '') {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `第 ${i + 1} 張圖片的 URL 無效` });
            }
            
            await client.query(`
                INSERT INTO samegame_level_images (level_id, image_url, image_order)
                VALUES ($1, $2, $3)
            `, [levelId, image_url.trim(), i + 1]);
        }
        
        await client.query('COMMIT');
        
        // 獲取更新後的關卡信息
        const levelData = await client.query(`
            SELECT l.id, l.level_number, l.grid_rows, l.grid_columns, l.created_at, l.updated_at
            FROM samegame_levels l
            WHERE l.id = $1
        `, [levelId]);
        
        const imagesResult = await client.query(`
            SELECT id, image_url, image_order
            FROM samegame_level_images
            WHERE level_id = $1
            ORDER BY image_order ASC
        `, [levelId]);
        
        const responseData = {
            ...levelData.rows[0],
            images: imagesResult.rows
        };
        
        res.json(responseData);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`更新關卡 ${id} 失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    } finally {
        client.release();
    }
});

// 刪除關卡
app.delete('/api/samegame/levels/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    const levelId = parseInt(id, 10);
    
    if (isNaN(levelId)) {
        return res.status(400).json({ error: '無效的關卡 ID' });
    }
    
    try {
        const result = await pool.query('DELETE FROM samegame_levels WHERE id = $1', [levelId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到指定的關卡' });
        }
        
        res.status(204).send();
    } catch (err) {
        console.error(`刪除關卡 ${id} 失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 獲取排行榜數據
app.get('/api/samegame/leaderboard', async (req, res) => {
    const { template_id } = req.query;
    const templateId = template_id ? parseInt(template_id, 10) : null;
    
    try {
        let query = `
            SELECT lb.id, lb.player_name, lb.total_moves, lb.completion_time, lb.created_at,
                   t.name AS template_name
            FROM samegame_leaderboard lb
            JOIN samegame_templates t ON lb.template_id = t.id
        `;
        
        const queryParams = [];
        
        if (templateId && !isNaN(templateId)) {
            query += ' WHERE lb.template_id = $1';
            queryParams.push(templateId);
        }
        
        query += ' ORDER BY lb.total_moves ASC, lb.completion_time ASC NULLS LAST LIMIT 20';
        
        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取翻牌遊戲排行榜失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 提交排行榜
app.post('/api/samegame/leaderboard', async (req, res) => {
    const { template_id, player_name, total_moves, completion_time } = req.body;
    const templateId = parseInt(template_id, 10);
    
    if (isNaN(templateId)) {
        return res.status(400).json({ error: '無效的模板 ID' });
    }
    
    if (!player_name || player_name.trim() === '') {
        return res.status(400).json({ error: '玩家名稱為必填項' });
    }
    
    if (isNaN(parseInt(total_moves, 10)) || parseInt(total_moves, 10) <= 0) {
        return res.status(400).json({ error: '步數必須是正整數' });
    }
    
    // 完成時間可以為空，但如果提供了，必須是正整數
    if (completion_time !== null && completion_time !== undefined && 
        (isNaN(parseInt(completion_time, 10)) || parseInt(completion_time, 10) <= 0)) {
        return res.status(400).json({ error: '完成時間必須是正整數' });
    }
    
    const ipAddress = req.ip || 'unknown';
    
    try {
        // 檢查模板是否存在
        const templateCheck = await pool.query('SELECT 1 FROM samegame_templates WHERE id = $1', [templateId]);
        
        if (templateCheck.rowCount === 0) {
            return res.status(404).json({ error: '找不到指定的模板' });
        }
        
        const result = await pool.query(`
            INSERT INTO samegame_leaderboard (template_id, player_name, total_moves, completion_time, ip_address)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [templateId, player_name.trim(), total_moves, completion_time || null, ipAddress]);
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('提交翻牌遊戲排行榜記錄失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 獲取前台使用的活躍模板
app.get('/api/samegame/active-templates', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, description, difficulty
            FROM samegame_templates
            WHERE is_active = TRUE
            ORDER BY updated_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取活躍翻牌遊戲模板失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 獲取前台使用的模板詳情(關卡和圖片)
app.get('/api/samegame/play/:templateId', async (req, res) => {
    const { templateId } = req.params;
    const tplId = parseInt(templateId, 10);
    
    if (isNaN(tplId)) {
        return res.status(400).json({ error: '無效的模板 ID' });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 獲取模板詳情
        const templateResult = await client.query(`
            SELECT id, name, description, difficulty
            FROM samegame_templates
            WHERE id = $1 AND is_active = TRUE
        `, [tplId]);
        
        if (templateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到指定的模板或模板未啟用' });
        }
        
        // 獲取關卡信息
        const levelsResult = await client.query(`
            SELECT l.id, l.level_number, l.grid_rows, l.grid_columns
            FROM samegame_levels l
            WHERE l.template_id = $1
            ORDER BY l.level_number ASC
        `, [tplId]);
        
        if (levelsResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '該模板尚未設置關卡' });
        }
        
        // 獲取每個關卡的圖片
        const allLevelImages = {};
        for (const level of levelsResult.rows) {
            const imagesResult = await client.query(`
                SELECT image_url
                FROM samegame_level_images
                WHERE level_id = $1
                ORDER BY image_order ASC
            `, [level.id]);
            
            allLevelImages[level.level_number] = imagesResult.rows.map(row => row.image_url);
        }
        
        await client.query('COMMIT');
        
        // 構建遊戲所需的數據結構
        const template = templateResult.rows[0];
        const levels = levelsResult.rows.map(level => ({
            level: level.level_number,
            rows: level.grid_rows,
            columns: level.grid_columns,
            images: allLevelImages[level.level_number] || []
        }));
        
        // 獲取排行榜
        const leaderboardResult = await pool.query(`
            SELECT player_name, total_moves, completion_time, created_at
            FROM samegame_leaderboard
            WHERE template_id = $1
            ORDER BY total_moves ASC, completion_time ASC NULLS LAST
            LIMIT 10
        `, [tplId]);
        
        // 構建前端所需的完整響應
        const responseData = {
            template: {
                id: template.id,
                name: template.name,
                description: template.description,
                difficulty: template.difficulty
            },
            levels: levels,
            leaderboard: leaderboardResult.rows
        };
        
        res.json(responseData);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`獲取翻牌遊戲模板 ${templateId} 遊戲數據失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    } finally {
        client.release();
    }
});







const walkMapAdminRouter = express.Router();
// walkMapAdminRouter.use(basicAuthMiddleware);


// GET /api/admin/walk_map/templates - List all templates
walkMapAdminRouter.get('/templates', async (req, res) => {
    try {
        const result = await pool.query('SELECT template_id, template_name FROM walk_map_templates ORDER BY template_name');
        res.json(result.rows);
    } catch (err) {
        console.error('[API GET /admin/walk_map/templates] Error:', err.stack || err);
        res.status(500).json({ error: 'Failed to retrieve templates' });
    }
});
// GET /api/admin/walk_map/templates/:templateId - Get single template details (★ 修改 ★)
walkMapAdminRouter.get('/templates/:templateId', async (req, res) => {
    const { templateId } = req.params;
    try {
        // ★ 同時選取 style_data 和 cell_data ★
        const result = await pool.query(
            'SELECT template_id, template_name, description, style_data, cell_data FROM walk_map_templates WHERE template_id = $1',
            [templateId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }
        const templateData = result.rows[0];
        // ★ 確保 cell_data 是陣列 (如果 DB 是 NULL 或解析失敗) ★
        if (templateData.cell_data && typeof templateData.cell_data === 'string') {
             try { templateData.cell_data = JSON.parse(templateData.cell_data); } catch(e) { templateData.cell_data = []; }
        } else if (!templateData.cell_data) {
            templateData.cell_data = [];
        }
        // ★ 確保 style_data 是物件 (如果 DB 是 NULL 或解析失敗) ★
        if (templateData.style_data && typeof templateData.style_data === 'string') {
             try { templateData.style_data = JSON.parse(templateData.style_data); } catch(e) { templateData.style_data = {}; }
        } else if (!templateData.style_data) {
            templateData.style_data = {};
        }

        res.json(templateData); // 回傳包含 style 和 cell 資料的完整模板
    } catch (err) {
        console.error(`[API GET /admin/walk_map/templates/${templateId}] Error:`, err.stack || err);
        res.status(500).json({ error: 'Failed to retrieve template details' });
    }
});

// POST /api/admin/walk_map/templates - Create new template (★ 修改 ★)
walkMapAdminRouter.post('/templates', async (req, res) => {
    // ★ 從請求中獲取 cell_data ★
    const { template_id, template_name, description, style_data, cell_data } = req.body;

    if (!template_id || !template_name || !style_data || !cell_data) { // ★ 檢查 cell_data ★
        return res.status(400).json({ error: 'Missing required fields: template_id, template_name, style_data, cell_data' });
    }
    // ★ 驗證 cell_data 格式 ★
     if (!Array.isArray(cell_data) || cell_data.length !== 24) {
         return res.status(400).json({ error: 'Invalid cell_data format. Expected an array of 24 cell objects.' });
     }
    // ... (保留 style_data 的 JSON 驗證邏輯) ...
    let styleJson;
    try {
        if (typeof style_data === 'string') { styleJson = JSON.parse(style_data); }
        else if (typeof style_data === 'object') { styleJson = style_data; }
        else { throw new Error('style_data must be JSON object or string'); }
    } catch(e) { return res.status(400).json({ error: 'Invalid style_data JSON format' }); }


    try {
        // ★ 在 INSERT 中加入 cell_data ★
        const result = await pool.query(
            'INSERT INTO walk_map_templates (template_id, template_name, description, style_data, cell_data) VALUES ($1, $2, $3, $4, $5) RETURNING template_id, template_name',
            [template_id, template_name, description || null, styleJson, JSON.stringify(cell_data)] // ★ 將 cell_data 轉為字串儲存 ★
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[API POST /admin/walk_map/templates] Error:', err.stack || err);
         if (err.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Template ID or Name already exists' });
        }
        res.status(500).json({ error: 'Failed to create template', detail: err.message });
    }
});

// PUT /api/admin/walk_map/templates/:templateId - Update existing template (★ 修改 ★)
walkMapAdminRouter.put('/templates/:templateId', async (req, res) => {
    const { templateId } = req.params;
    // ★ 從請求中獲取 cell_data ★
    const { template_name, description, style_data, cell_data } = req.body;

    if (!template_name || !style_data || !cell_data) { // ★ 檢查 cell_data ★
        return res.status(400).json({ error: 'Missing required fields: template_name, style_data, cell_data' });
    }
    // ★ 驗證 cell_data 格式 ★
    if (!Array.isArray(cell_data) || cell_data.length !== 24) {
        return res.status(400).json({ error: 'Invalid cell_data format. Expected an array of 24 cell objects.' });
    }
     // ... (保留 style_data 的 JSON 驗證邏輯) ...
     let styleJson;
     try {
         if (typeof style_data === 'string') { styleJson = JSON.parse(style_data); }
         else if (typeof style_data === 'object') { styleJson = style_data; }
         else { throw new Error('style_data must be JSON object or string'); }
     } catch(e) { return res.status(400).json({ error: 'Invalid style_data JSON format' }); }

    try {
        // ★ 在 UPDATE 中加入 cell_data ★
        const result = await pool.query(
            'UPDATE walk_map_templates SET template_name = $1, description = $2, style_data = $3, cell_data = $4, updated_at = NOW() WHERE template_id = $5 RETURNING template_id, template_name',
            [template_name, description || null, styleJson, JSON.stringify(cell_data), templateId] // ★ 將 cell_data 轉為字串儲存 ★
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`[API PUT /admin/walk_map/templates/${templateId}] Error:`, err.stack || err);
        if (err.code === '23505') { // Unique violation on name
           return res.status(409).json({ error: 'Template Name already exists for another template' });
       }
        res.status(500).json({ error: 'Failed to update template', detail: err.message });
    }
});

// DELETE /api/admin/walk_map/templates/:templateId - Delete template
walkMapAdminRouter.delete('/templates/:templateId', async (req, res) => {
    const { templateId } = req.params;
    try {
        const result = await pool.query('DELETE FROM walk_map_templates WHERE template_id = $1', [templateId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.status(204).send(); // No content on successful delete
    } catch (err) {
        console.error(`[API DELETE /admin/walk_map/templates/${templateId}] Error:`, err.stack || err);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

// --- Map Cell API Endpoints ---
 
 


app.use('/api/admin/walk_map', walkMapAdminRouter); // <-- Add this line








app.get('/rich-admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'rich-admin.html'));
  });
  app.use('/rich-admin.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'rich-admin.js'));
  });
  app.use('/admin-style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-style.css'));
  });










 


// isAdminAuthenticated （ basicAuthMiddleware ）



// 保護所有 /api/admin 和 /api/analytics 開頭的 API
app.use(['/api/admin', '/api/analytics'], isAdminAuthenticated);

// --- 靜態文件服務 ---
 
app.use('/uploads', express.static(uploadDir)); // uploadDir 的值是 '/data/uploads'
console.log(`設定靜態檔案服務: /uploads 將映射到 ${uploadDir}`);

// --- 公開 API Routes (保持不變) ---
// ... (保留所有其他的公開 API，如 guestbook, scores, news, products, music, banners 等) ...
// --- ★★★ 留言板公開 API (Public Guestbook API) ★★★ ---










// 伺服器端示例代碼
const gameStates = {}; // 存儲不同遊戲房間的狀態

// 創建或獲取遊戲房間
function getGameRoom(roomId) {
    if (!gameStates[roomId]) {
        gameStates[roomId] = {
            currentTemplateId: null,
            players: {},
            playerPositions: [0, 0, 0],
            activePlayer: 1,
            isMoving: false,
            highlightedCell: null,
            connectedClients: [],
            lastUpdateTime: Date.now()
        };
    }
    return gameStates[roomId];
}

// 更新遊戲狀態並通知所有連接的客戶端
function updateGameState(roomId, updates) {
    const gameState = getGameRoom(roomId);
    
    // 應用更新
    Object.assign(gameState, updates);
    gameState.lastUpdateTime = Date.now();
    
    // 通知所有連接的客戶端
    const updateMessage = JSON.stringify({
        type: 'gameStateUpdate',
        data: gameState
    });
    
    gameState.connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(updateMessage);
        }
    });
}























// --- 新增 Admin API 路由 (受保護的管理 API) ---

// GET /api/admin/reports - 獲取報告列表 (包含分頁和搜尋功能)
app.get('/api/admin/reports', isAdminAuthenticated, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';

    // 構造 WHERE 子句和參數
    let whereClause = '';
    const queryParams = [];
    let paramIndex = 1;

    if (search) {
        whereClause = `WHERE title ILIKE $${paramIndex++}`;
        queryParams.push(`%${search}%`);
    }

    try {
        // 獲取總記錄數
        const countQuery = `SELECT COUNT(*) FROM report_templates ${whereClause}`;
        const totalResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(totalResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / limit);

        // 複製查詢參數陣列並添加新的參數
        const pageParams = [...queryParams];
        pageParams.push(limit);
        pageParams.push(offset);

        // 獲取當前頁面的記錄
        const dataQuery = `
            SELECT id, title, created_at, updated_at, size_bytes
            FROM report_templates
            ${whereClause}
            ORDER BY updated_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        const dataResult = await pool.query(dataQuery, pageParams);

        res.json({
            reports: dataResult.rows,
            current_page: page,
            total_pages: totalPages,
            total_items: totalItems,
            limit: limit,
            search: search
        });
    } catch (err) {
        console.error('[API GET /admin/reports] 獲取報告列表時發生錯誤:', err);
        res.status(500).json({ error: '獲取報告列表失敗', detail: err.message });
    }
});

// GET /api/admin/reports/:id - 獲取單一報告詳情 (用於編輯)
app.get('/api/admin/reports/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    
    // 驗證 ID 格式 (UUID 格式)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: '無效的報告 ID 格式。' });
    }

    try {
        const query = `
            SELECT id, title, html_content, created_at, updated_at, size_bytes
            FROM report_templates
            WHERE id = $1;
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到指定的報告。' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(`[API GET /admin/reports/${id}] 獲取單一報告時發生錯誤:`, err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取報告。', detail: err.message });
    }
});

// POST /api/admin/reports - 新增報告
app.post('/api/admin/reports', isAdminAuthenticated, async (req, res) => {
    const { title, html_content, size_bytes } = req.body;
    const creatorIp = req.ip || 'unknown'; // 獲取 IP
    const reportUUID = uuidv4(); // 生成 UUID

    // 基本驗證
    if (!title || title.trim() === '') {
        return res.status(400).json({ error: '報告標題為必填項。' });
    }
    
    if (!html_content || typeof html_content !== 'string') {
        return res.status(400).json({ error: '報告內容為必填項且必須是字串。' });
    }

    // 處理大小參數
    let contentSizeBytes = size_bytes;
    if (!contentSizeBytes || isNaN(contentSizeBytes)) {
        // 如果沒有提供有效的大小，則計算之
        contentSizeBytes = Buffer.byteLength(html_content, 'utf8');
    }

    try {
        const query = `
            INSERT INTO report_templates (id, title, html_content, size_bytes, creator_ip)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, title, created_at, updated_at, size_bytes;
        `;
        const result = await pool.query(query, [
            reportUUID, 
            title.trim(), 
            html_content, 
            contentSizeBytes,
            creatorIp
        ]);

        console.log(`[API POST /api/admin/reports] 新增報告成功，ID: ${result.rows[0].id}, 大小: ${contentSizeBytes} 字節`);

        res.status(201).json({
            success: true,
            ...result.rows[0]
        });
    } catch (err) {
        console.error('[API POST /api/admin/reports] 新增報告時發生錯誤:', err);
        res.status(500).json({ error: '伺服器內部錯誤，無法儲存報告。', detail: err.message });
    }
});

// PUT /api/admin/reports/:id - 更新報告
app.put('/api/admin/reports/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { title, html_content, size_bytes } = req.body;

    // 驗證 ID 格式 (UUID 格式)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: '無效的報告 ID 格式。' });
    }

    // 驗證輸入資料
    if (!title || title.trim() === '') {
        return res.status(400).json({ error: '報告標題為必填項。' });
    }
    
    if (!html_content || typeof html_content !== 'string') {
        return res.status(400).json({ error: '報告內容為必填項且必須是字串。' });
    }

    // 處理大小參數
    let contentSizeBytes = size_bytes;
    if (!contentSizeBytes || isNaN(contentSizeBytes)) {
        // 如果沒有提供有效的大小，則計算之
        contentSizeBytes = Buffer.byteLength(html_content, 'utf8');
    }

    try {
        const query = `
            UPDATE report_templates
            SET title = $1, html_content = $2, size_bytes = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING id, title, updated_at, size_bytes;
        `;
        const result = await pool.query(query, [
            title.trim(), 
            html_content, 
            contentSizeBytes,
            id
        ]);

        // 檢查是否有資料被更新
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的報告。' });
        }

        console.log(`[API PUT /api/admin/reports] 更新報告成功，ID: ${id}, 大小: ${contentSizeBytes} 字節`);
        res.json(result.rows[0]); // 回傳更新後的報告資訊
    } catch (err) {
        console.error(`[API PUT /api/admin/reports/${id}] 更新報告時發生錯誤:`, err);
        res.status(500).json({ error: '伺服器內部錯誤，無法更新報告。', detail: err.message });
    }
});

// DELETE /api/admin/reports/:id - 刪除報告
app.delete('/api/admin/reports/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;

    // 驗證 ID 格式 (UUID 格式)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: '無效的報告 ID 格式。' });
    }

    try {
        const query = 'DELETE FROM report_templates WHERE id = $1;';
        const result = await pool.query(query, [id]);

        // 檢查是否有資料被刪除
        if (result.rowCount === 0) {
            // 通常不視為錯誤，可能已經被刪除
            console.warn(`[API DELETE /api/admin/reports] 嘗試刪除報告 ID ${reportId}，但資料庫中找不到。`);
        } else {
             console.log(`[API DELETE /api/admin/reports] 報告 ID ${reportId} la成功從資料庫刪除。`);
        }

        res.status(204).send(); // 成功刪除，無內容返回
    } catch (err) {
        console.error(`[API DELETE /api/admin/reports/${id}] 刪除報告時發生錯誤:`, err);
        res.status(500).json({ error: '伺服器內部錯誤，無法刪除報告。', detail: err.message });
    }
});





























// --- UI元素管理API ---

// GET /api/ui-elements - 獲取所有UI元素
app.get('/api/ui-elements', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, element_type, is_visible, image_url, alt_text, 
                   position_top, position_left, position_right, 
                   animation_type, speech_phrases, settings, 
                   created_at, updated_at
            FROM ui_elements
            ORDER BY element_type, id
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取UI元素列表失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET /api/ui-elements?type=back_to_top - 獲取指定類型的UI元素
app.get('/api/ui-elements/type/:type', async (req, res) => {
    const { type } = req.params;
    if (!type) {
        return res.status(400).json({ error: '未指定元素類型' });
    }
    
    try {
        const result = await pool.query(
            `SELECT id, element_type, is_visible, image_url, alt_text, 
                    position_top, position_left, position_right, 
                    animation_type, speech_phrases, settings, 
                    created_at, updated_at
             FROM ui_elements
             WHERE element_type = $1
             LIMIT 1`,
            [type]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到指定類型的UI元素' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`獲取UI元素類型 ${type} 失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// GET /api/ui-elements/:id - 獲取特定ID的UI元素
app.get('/api/ui-elements/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的UI元素ID格式' });
    }
    
    try {
        const result = await pool.query(
            `SELECT id, element_type, is_visible, image_url, alt_text, 
                    position_top, position_left, position_right, 
                    animation_type, speech_phrases, settings, 
                    created_at, updated_at
             FROM ui_elements
             WHERE id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到指定的UI元素' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`獲取UI元素ID ${id} 失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// POST /api/ui-elements - 創建新UI元素
app.post('/api/ui-elements', isAdminAuthenticated, async (req, res) => {
    const { 
        element_type, is_visible, image_url, alt_text,
        position_top, position_left, position_right,
        animation_type, speech_phrases, settings,
        custom_css
    } = req.body;
    
    if (!element_type) {
        return res.status(400).json({ error: '元素類型為必填項' });
    }
    
    try {
        const result = await pool.query(
            `INSERT INTO ui_elements 
             (element_type, is_visible, image_url, alt_text, 
              position_top, position_left, position_right, 
              animation_type, speech_phrases, settings, custom_css)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                element_type, 
                is_visible !== undefined ? is_visible : true, 
                image_url || null, 
                alt_text || null,
                position_top || null, 
                position_left || null, 
                position_right || null,
                animation_type || null, 
                speech_phrases || null, 
                settings || null,
                custom_css || null
            ]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('新增UI元素失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤', detail: err.message });
    }
});

// PUT /api/ui-elements/:id - 更新UI元素
app.put('/api/ui-elements/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的UI元素ID格式' });
    }
    
    const { 
        is_visible, image_url, alt_text,
        position_top, position_left, position_right,
        animation_type, speech_phrases, settings,
        custom_css
    } = req.body;
    
    // 生成動態更新欄位
    const updateFields = [];
    const queryParams = [id]; // 先放入ID
    let paramIndex = 2;
    
    if (is_visible !== undefined) {
        updateFields.push(`is_visible = $${paramIndex++}`);
        queryParams.push(is_visible);
    }
    
    if (image_url !== undefined) {
        updateFields.push(`image_url = $${paramIndex++}`);
        queryParams.push(image_url);
    }
    
    if (alt_text !== undefined) {
        updateFields.push(`alt_text = $${paramIndex++}`);
        queryParams.push(alt_text);
    }
    
    if (position_top !== undefined) {
        updateFields.push(`position_top = $${paramIndex++}`);
        queryParams.push(position_top);
    }
    
    if (position_left !== undefined) {
        updateFields.push(`position_left = $${paramIndex++}`);
        queryParams.push(position_left);
    }
    
    if (position_right !== undefined) {
        updateFields.push(`position_right = $${paramIndex++}`);
        queryParams.push(position_right);
    }
    
    if (animation_type !== undefined) {
        updateFields.push(`animation_type = $${paramIndex++}`);
        queryParams.push(animation_type);
    }
    
    if (speech_phrases !== undefined) {
        updateFields.push(`speech_phrases = $${paramIndex++}`);
        queryParams.push(speech_phrases);
    }
    
    if (settings !== undefined) {
        updateFields.push(`settings = $${paramIndex++}`);
        queryParams.push(settings);
    }
    
    if (custom_css !== undefined) {
        updateFields.push(`custom_css = $${paramIndex++}`);
        queryParams.push(custom_css);
    }
    
    // 添加更新時間
    updateFields.push(`updated_at = NOW()`);
    
    if (updateFields.length === 0) {
        return res.status(400).json({ error: '沒有提供任何要更新的欄位' });
    }
    
    try {
        const query = `
            UPDATE ui_elements 
            SET ${updateFields.join(', ')}
            WHERE id = $1
            RETURNING *
        `;
        
        const result = await pool.query(query, queryParams);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的UI元素' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`更新UI元素ID ${id} 失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤', detail: err.message });
    }
});

// PUT /api/ui-elements/:id/visibility - 更新UI元素顯示狀態
app.put('/api/ui-elements/:id/visibility', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { is_visible } = req.body;
    
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的UI元素ID格式' });
    }
    
    if (typeof is_visible !== 'boolean') {
        return res.status(400).json({ error: 'is_visible必須是布爾值' });
    }
    
    try {
        const result = await pool.query(
            `UPDATE ui_elements 
             SET is_visible = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, element_type, is_visible`,
            [is_visible, id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的UI元素' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`更新UI元素ID ${id} 顯示狀態失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤', detail: err.message });
    }
});

// DELETE /api/ui-elements/:id - 刪除UI元素
app.delete('/api/ui-elements/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的UI元素ID格式' });
    }
    
    try {
        const result = await pool.query('DELETE FROM ui_elements WHERE id = $1', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要刪除的UI元素' });
        }
        
        res.status(204).send();
    } catch (err) {
        console.error(`刪除UI元素ID ${id} 失敗:`, err);
        res.status(500).json({ error: '伺服器內部錯誤', detail: err.message });
    }
});






// GET /api/floating-characters - 獲取所有浮動角色 (專門為前端頁面提供的API)
app.get('/api/floating-characters', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, element_type AS character_type, is_visible, image_url, alt_text, 
                   position_top, position_left, position_right, 
                   animation_type, speech_phrases 
            FROM ui_elements
            WHERE element_type IN ('pink', 'blue', 'yellow')
            ORDER BY element_type
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取浮動角色列表失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});













