require('dotenv').config();




const http = require('http'); // <--- Need http module
const https = require('https');
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const WebSocket = require('ws'); // <--- Import the ws library
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const multer = require('multer');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { TranslationServiceClient } = require('@google-cloud/translate');
const fs = require('fs');
const sharp = require('sharp')
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dbClient = require('./dbclient');
const createReportRateLimiter = require('./report-ip-limiter');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const adminRouter = express.Router();
const app = express();
// --- CORS (Cross-Origin Resource Sharing) Setup ---
const cors = require('cors');

if (process.env.NODE_ENV !== 'production') {
    console.log('[CORS] 開發模式下，啟用 CORS 並允許 http://localhost:5173 和 http://localhost:3000');
    app.use(cors({
        origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:9000'], // <-- 把 9000 加進來
        credentials: true // 允許傳遞 cookie 等憑證
    }));
}
// --- End of CORS Setup ---
const PORT = process.env.PORT || 3000;
const unboxingAiRouter = express.Router();
const boxRoutes = require('./boxRoutes');
const youtubeLotteryRouter = express.Router();
const initializeVueGameApi = require('./vue-game.js');




if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}



// --- 資料庫連接池設定 (最終除錯確認版) ---

// 強制使用 .env 檔案中的 URL，並且強制啟用 SSL
// 這段程式碼專門為你的本地開發環境設計


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // 強制啟用 SSL
    }
});

// 添加一個測試連線，以便在啟動時立即知道是否成功
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('[DB] 資料庫連接失敗！請檢查錯誤訊息:', err ? err.message : '未知錯誤');
        console.error('[DB] 你的 DATABASE_URL 是:', process.env.DATABASE_URL);
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    } else {
        console.log('[DB] ★★★ 資料庫連接成功！★★★ 伺服器時間:', res.rows[0].now);
    }
});




// --- 圖片代理 API ---
app.get('/proxy-image', (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) {
        return res.status(400).send('Missing image URL');
    }

    try {
        const url = new URL(imageUrl);
        const protocol = url.protocol === 'https:' ? https : http;

        const proxyReq = protocol.get(url, (proxyRes) => {
            if (proxyRes.statusCode !== 200) {
                console.error(`[Proxy] Error fetching image: Status code ${proxyRes.statusCode} for ${imageUrl}`);
                res.status(proxyRes.statusCode).send(`Error fetching image: ${proxyRes.statusMessage}`);
                return;
            }

            // 將遠端圖片的回應標頭複製過來，特別是 Content-Type
            res.writeHead(proxyRes.statusCode, {
                'Content-Type': proxyRes.headers['content-type'],
                'Content-Length': proxyRes.headers['content-length']
            });

            // 將圖片數據流直接傳給客戶端
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error(`[Proxy] Request error: ${err.message}`);
            res.status(502).send('Bad Gateway'); // 502 Bad Gateway 表示代理出錯
        });

    } catch (error) {
        console.error(`[Proxy] Invalid URL: ${imageUrl}`, error);
        res.status(400).send('Invalid image URL');
    }
});
// --- 結束圖片代理 API ---




app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Session Middleware Setup ---
app.use(session({
    name: 'myadminsession.sid',
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));







// --- API for Pet Game  QUASAR ---
app.get('/api/pet/initial-state', (req, res) => {
    console.log('[API] /api/pet/initial-state 被呼叫了！');

    const petData = {
        name: '後端來的寶寶',
        hunger: 0.7, // 70%
        mood: 0.4,   // 40%
    };

    res.json(petData); // 用 JSON 格式回傳資料
});

app.get('/api/pet/states', async (req, res) => {
    console.log('[API] /api/pet/states 被呼叫了！');
    try {
        // 從 'cook_cooking_states' 資料表中查詢所有狀態
        const { rows } = await pool.query('SELECT id, state_name, state_symbol FROM cook_cooking_states ORDER BY id');

        // 把資料庫回傳的資料直接以 JSON 格式送給前端
        res.json(rows);

    } catch (error) {
        console.error('[API Error] 獲取寵物狀態列表失敗:', error);
        res.status(500).json({ error: '無法從資料庫獲取狀態列表' });
    }
});





const { initializeCookGame } = require('./cook-kitchen-rush'); // 从对象中解构 initializeCookGame
const cookGameApp = initializeCookGame(pool); // 调用函数获取 Express 路由器


// =================================================================
// ★★★ HTTP Server & WebSocket Server Setup ★★★
// =================================================================

// 創建 HTTP 服務器
const server = http.createServer(app);

// 將廚房遊戲的 Express 路由掛載到 /cook-api
app.use('/cook-api', cookGameApp);



// 創建三個使用 noServer: true 的 WebSocket 服務器實例
const wssSimpleWalker = new WebSocket.Server({ noServer: true });
const wssCookGame = new WebSocket.Server({ noServer: true });
const wssChatRoom = new WebSocket.Server({ noServer: true });

initializeVueGameApi(app, pool, wssChatRoom);
console.log('[WS] 已創建 Simple Walker、Cook Game 和 Chat Room 的 WebSocket 服務實例 (未附加)');

// =================================================================
// ★★★ WebSocket Upgrade Router ★★★
// =================================================================
// This is the crucial part that routes incoming WebSocket connection
// requests to the correct service.
server.on('upgrade', (request, socket, head) => {
    // Use URL constructor for robust parsing
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname;

    console.log(`[WS Upgrade] Received upgrade request for path: ${pathname}`);

    if (pathname === '/simple-walker') {
        console.log('[WS Upgrade] Routing to Simple Walker...');
        wssSimpleWalker.handleUpgrade(request, socket, head, (ws) => {
            wssSimpleWalker.emit('connection', ws, request);
        });
    } else if (pathname === '/cook-game') {
        console.log('[WS Upgrade] Routing to Cook Game...');
        wssCookGame.handleUpgrade(request, socket, head, (ws) => {
            wssCookGame.emit('connection', ws, request);
        });
    } else if (pathname === '/chat') {
        console.log('[WS Upgrade] Routing to Chat Room...');
        wssChatRoom.handleUpgrade(request, socket, head, (ws) => {
            wssChatRoom.emit('connection', ws, request);
        });
    } else {
        console.warn(`[WS Upgrade] No WebSocket service for path ${pathname}, destroying socket.`);
        socket.destroy();
    }
});
 
// 暂时注释掉 WebSocket 初始化，因为该功能尚未实现
// initCookGameWss(wssCookGame);


// =================================================================
// ★★★ YouTube Lottery System (HTTP-based) ★★★
// =================================================================
const YoutubeLottery = require('./youtubeLottery');
const UserProfile = require('./userProfile');
const ChatResponder = require('./chatResponder');

const youtubeLottery = new YoutubeLottery(pool);
const userProfile = new UserProfile(pool);
const chatResponder = new ChatResponder();

// 向所有WebSocket客戶端廣播消息 (如果還有其他通用WS需求)
function broadcastToAll(message) {
    const messageStr = JSON.stringify(message);
    // 注意：這裡需要決定廣播給哪個遊戲的玩家，或所有玩家
    // 遍歷 wssSimpleWalker.clients 和 wssCookGame.clients
    for (const client of [...wssSimpleWalker.clients, ...wssCookGame.clients]) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    }
}

// =================================================================
// ★★★ Authentication Middlewares ★★★
// =================================================================

// 管理後台專用認證中介軟體 (Admin - Session-based)


const isAdminAuthenticated = (req, res, next) => {
    // ★★★ 新增的白名單邏輯 ★★★
    // 如果是開箱文相關的 API，直接跳過管理員檢查，交給後續的專用中介軟體處理
    if (req.path.startsWith('/api/unboxing-ai') || req.path.startsWith('/api/generate-unboxing-post')) {
        return next();
    }

    // --- 原有的管理員檢查邏輯 ---
    if (req.session.isAdmin) {
        next();
    } else {
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
            // 如果是 API 請求 (AJAX/XHR)，返回 JSON 錯誤
            console.warn(`[Admin Auth] Unauthorized API access attempt to: ${req.path}`);
            return res.status(401).json({ error: '未授權：請先登入。', loginUrl: '/admin-login.html' });
        }
        // 如果是普通頁面請求，重新導向到管理員登入頁
        console.warn(`[Admin Auth] Unauthorized page access attempt to: ${req.path}, redirecting.`);
        return res.redirect('/admin-login.html');
    }
};




 

// =================================================================
// ★★★ BOX 前台會員專用認證中介軟體 (Member Authentication) ★★★
// =================================================================
// 說明：此中介軟體用於保護 "Box Organizer" 前台應用的 API 路由 (例如 /api/box/users/me)。
//       這是給一般會員或使用者登入時使用的。
// 機制：它採用基於 Token 的認證 (JWT - JSON Web Token)。
//       會員登入後，客戶端 (瀏覽器) 會收到一個 JWT。
//       對於每個需要保護的 API 請求，客戶端必須在 HTTP 的 `Authorization` 標頭中
//       以 `Bearer <token>` 的形式附上這個 JWT。
//       伺服器會驗證此 token 的簽名和時效性，如果合法，則允許訪問。
//       這種方式是無狀態的 (stateless)，適合現代 Web 應用和 API。
// =================================================================


// --- START OF BOX ORGANIZER AUTHENTICATION MIDDLEWARE ---
const authenticateBoxUser = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // "Bearer " is 7 chars
        jwt.verify(token, process.env.BOX_JWT_SECRET, (err, decoded) => {
            if (err) {
                console.warn('[Box Auth] Token verification failed:', err.message);
                return res.status(403).json({ error: 'Forbidden: Invalid or expired token.' });
            }

            // CRITICAL CHECK: Ensure the decoded token has user_id or userId.
            if (!decoded || (typeof decoded.user_id === 'undefined' && typeof decoded.userId === 'undefined')) {
                console.error('[Box Auth] Invalid token payload: user_id/userId is missing.', decoded);
                return res.status(403).json({ error: 'Forbidden: Invalid token payload.' });
            }

            // Normalize to user_id for consistency
            if (decoded.userId && !decoded.user_id) {
                decoded.user_id = decoded.userId;
            }

            // Attach user info to the request object
            req.boxUser = decoded; // decoded now reliably contains user_id
            next();
        });
    } else {
        console.warn('[Box Auth] Authorization header missing or format incorrect.');
        res.status(401).json({ error: 'Unauthorized: Please provide a valid token.' });
    }
};
// --- END OF BOX ORGANIZER AUTHENTICATION MIDDLEWARE ---



const requireVipOrAdmin = async (req, res, next) => {
    // 這個中介軟體必須在 authenticateBoxUser 之後執行
    console.log(`[AuthZ] 開始檢查用戶 VIP/管理員權限...`);

    if (!req.boxUser || !req.boxUser.user_id) {
        // 理論上這個情況會先被 authenticateBoxUser 攔截
        console.error(`[AuthZ] 錯誤：找不到用戶會話資訊！`);
        return res.status(401).json({ error: '未經授權：找不到用戶會話。' });
    }

    const userId = req.boxUser.user_id;
    console.log(`[AuthZ] 檢查用戶 ID: ${userId} 的角色權限`);

    try {
        const query = `
            SELECT r.role_id, r.role_name
            FROM user_role_assignments ura
            JOIN user_roles r ON ura.role_id = r.role_id
            WHERE ura.user_id = $1 AND ura.is_active = TRUE;
        `;
        console.log(`[AuthZ] 執行資料庫查詢: ${query.replace(/\s+/g, ' ')}`);
        console.log(`[AuthZ] 查詢參數: userId = ${userId}`);

        const { rows } = await pool.query(query, [userId]);
        console.log(`[AuthZ] 查詢結果: 找到 ${rows.length} 個角色`);

        if (rows.length === 0) {
            console.warn(`[AuthZ] 用戶 ${userId} 沒有任何有效角色`);
            return res.status(403).json({ error: '禁止訪問：您沒有任何已分配的角色。' });
        }

        // 詳細記錄每個角色
        rows.forEach((row, index) => {
            console.log(`[AuthZ] 角色 #${index + 1}: role_id = ${row.role_id}, role_name = ${row.role_name || '未知'}`);
        });

        // 檢查使用者是否有任何一個角色的 role_id >= 2
        const hasVipOrAdminRole = rows.some(row => parseInt(row.role_id, 10) >= 2);
        console.log(`[AuthZ] 權限檢查結果: hasVipOrAdminRole = ${hasVipOrAdminRole}`);

        // 找出最高角色等級，用於日誌
        const highestRoleId = Math.max(...rows.map(row => parseInt(row.role_id, 10)));
        console.log(`[AuthZ] 用戶 ${userId} 的最高角色等級: ${highestRoleId}`);

        if (hasVipOrAdminRole) {
            console.log(`[AuthZ] 用戶 ${userId} 通過權限檢查，允許訪問`);
            return next(); // 使用者擁有權限，繼續執行
        } else {
            console.log(`[AuthZ] 用戶 ${userId} 權限不足，拒絕訪問。最高角色等級 ${highestRoleId} < 2`);
            return res.status(403).json({ error: '禁止訪問：此功能需要 VIP 或更高等級的角色。' });
        }
    } catch (err) {
        console.error(`[AuthZ] 檢查用戶 ${userId} 角色時發生錯誤:`, err);
        console.error(`[AuthZ] 錯誤詳情:`, err.stack || '無堆疊追蹤');
        return res.status(500).json({ error: '伺服器內部錯誤：授權檢查失敗。' });
    }
};


const authenticateGeneralUser = (req, res, next) => {
    console.log(`[General Auth] 開始處理請求: ${req.method} ${req.originalUrl}`);
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // "Bearer " is 7 chars long
        console.log(`[General Auth] 發現 Bearer token, 準備驗證...`);
        jwt.verify(token, process.env.BOX_JWT_SECRET, (err, decoded) => {
            if (err) {
                // Token 無效或過期，導向到會員登入頁面
                console.warn('[General Auth] Token verification failed, redirecting. Error:', err.message);
                const redirectUrl = `/member-login.html?redirect=${encodeURIComponent(req.originalUrl)}`;
                return res.redirect(redirectUrl);
            }

            // 檢查 token 內容是否有效
            if (!decoded || (typeof decoded.user_id === 'undefined' && typeof decoded.userId === 'undefined')) {
                console.error('[General Auth] Invalid token payload, redirecting.');
                const redirectUrl = `/member-login.html?redirect=${encodeURIComponent(req.originalUrl)}`;
                return res.redirect(redirectUrl);
            }

            // 統一 user ID 格式
            if (decoded.userId && !decoded.user_id) {
                decoded.user_id = decoded.userId;
            }

            // 將使用者資訊附加到請求中，供後續的中介軟體 (如 requireVipOrAdmin) 使用
            req.boxUser = decoded;
            next();
        });
    } else {
        // 如果請求中沒有 token，將使用者導向到會員登入頁面
        console.warn('[General Auth] No token provided, redirecting to member login.');
        const redirectUrl = `/member-login.html?redirect=${encodeURIComponent(req.originalUrl)}`;
        res.redirect(redirectUrl);
    }
};





// GET /api/admin/password-reset-requests/pending - 獲取待處理的密碼重設請求
app.get('/api/admin/password-reset-requests/pending', isAdminAuthenticated, async (req, res) => {
    try {
        const query = `
            SELECT 
                prr.id, prr.user_id, u.username, u.email, 
                prr.reset_token, prr.token_expires_at, prr.created_at
            FROM password_reset_requests prr
            JOIN BOX_Users u ON prr.user_id = u.user_id
            WHERE prr.status = 'pending'
            ORDER BY prr.created_at ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('[API GET /api/admin/password-reset-requests/pending] Error:', err);
        res.status(500).json({ error: '無法獲取待處理的密碼重設請求' });
    }
});

// GET /api/admin/password-reset-requests/pending-count - 獲取待處理請求數量
app.get('/api/admin/password-reset-requests/pending-count', isAdminAuthenticated, async (req, res) => {
    try {
        const result = await pool.query("SELECT COUNT(*) FROM password_reset_requests WHERE status = 'pending'");
        const count = parseInt(result.rows[0].count, 10);
        res.json({ count });
    } catch (err) {
        console.error('[API GET /api/admin/password-reset-requests/pending-count] Error:', err);
        res.status(500).json({ error: '無法獲取請求數量' });
    }
});

// DELETE /api/admin/password-reset-requests/:id - 刪除一個指定的密碼重設請求
app.delete('/api/admin/password-reset-requests/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM password_reset_requests WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            // 如果沒有行被刪除，可能是因為該 ID 不存在
            return res.status(404).json({ error: '找不到指定的請求' });
        }

        // 成功刪除
        res.status(204).send(); // 204 No Content 是成功的刪除操作的標準回應

    } catch (err) {
        console.error(`[API DELETE /api/admin/password-reset-requests/${id}] Error:`, err);
        res.status(500).json({ error: '刪除請求失敗' });
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







// --- START OF OPTIONAL BOX ORGANIZER AUTHENTICATION MIDDLEWARE ---
const optionalAuthenticateBoxUser = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // "Bearer " is 7 chars
        jwt.verify(token, process.env.BOX_JWT_SECRET, (err, decoded) => {
            // 如果 token 有效，就附加使用者資訊
            if (!err && decoded && (decoded.user_id || decoded.userId)) {
                // 為了統一，將 userId 轉換為 user_id
                if (decoded.userId && !decoded.user_id) {
                    decoded.user_id = decoded.userId;
                }
                req.boxUser = decoded;
            }
            // 對於選擇性認證，無論 token 是否有效，我們都繼續處理請求
            // 路由處理器後續需要自行檢查 req.boxUser 是否存在
            next();
        });
    } else {
        // 沒有 token，也直接繼續
        next();
    }
};
// --- END OF OPTIONAL BOX ORGANIZER AUTHENTICATION MIDDLEWARE ---


// =================================================================
// ★★★ 管理後台登入/登出 API (Admin Login/Logout API) ★★★
// =================================================================
// 說明：這些是專門處理管理員登入和登出請求的 API 端點。
//       前端的 admin-login.html 會向 /api/admin/login 發送 POST 請求。
//       成功後，伺服器會設定 session 並回傳 JSON。
// =================================================================
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
        const returnTo = req.session.returnTo || '/admin-main.html';
        delete req.session.returnTo;

        // 保存 session 然後再發送回應
        req.session.save(err => {
            if (err) {
                console.error("Session 保存失敗:", err);
                return res.status(500).json({ success: false, error: 'Session 保存失敗，無法登入。' });
            }
            console.log(`[Login Success] Session saved. Responding with JSON. Session ID: ${req.sessionID}`);
            res.json({ success: true, message: '登入成功。', redirectTo: returnTo });
        });
    } else {
        console.warn(`[Admin Login] 使用者 '${username}' 登入失敗：帳號或密碼錯誤。`);
        res.status(401).json({ success: false, error: '帳號或密碼錯誤。' });
    }
});

// Admin Logout Route
app.post('/api/admin/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                console.error('Session 銷毀失敗:', err);
                return res.status(500).json({ success: false, error: '登出失敗。' });
            }
            // 使用你的 session cookie 名稱，你的設定是 'myadminsession.sid'
            res.clearCookie('myadminsession.sid');
            console.log("[Admin Logout] Session 已成功銷毀。");
            res.json({ success: true, message: '已成功登出。' });
        });
    } else {
        console.log("[Admin Logout] 沒有活動的 session，無需銷毀。");
        res.json({ success: true, message: '已登出 (無活動 session)。' });
    }
});

// =================================================================
// ★★★ END OF Admin Login/Logout API ★★★
// =================================================================


// --- Multer Configuration for Product Images (used by adminRouter) ---
const productStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 注意：這裡的路徑是相對於 server.js 所在的位置
        const uploadDir = path.join(__dirname, 'public/uploads/storemarket');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const productUpload = multer({
    storage: productStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
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


    '/guestbook-admin.html',
    '/advertisement.html',
    '/product-views.html',
    '/admin-identities.html',
    '/box-admin.html',  // 添加倉庫管理員頁面

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





// --- START OF MODIFIED SECTION 1: Google Cloud Credentials Handling ---
let googleProjectId = null;
let googleCredentialsPath = null;

// Render 會自動設定 NODE_ENV 為 'production'
if (process.env.NODE_ENV === 'production') {
    // 在 Render 環境中，使用 Secret File 的固定路徑
    googleCredentialsPath = '/etc/secrets/google-vision-credentials.json';
    console.log('[Cloud AI] Production environment detected. Using secret file path:', googleCredentialsPath);
} else {
    // 在本機開發環境中，使用你 .env 檔案裡設定的路徑
    googleCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    console.log('[Cloud AI] Development environment detected. Using GOOGLE_APPLICATION_CREDENTIALS:', googleCredentialsPath);
}

// 根據得到的路徑來初始化客戶端和讀取 Project ID
if (googleCredentialsPath && fs.existsSync(googleCredentialsPath)) {
    try {
        // --- 初始化 Vision 和 Translation 客戶端 ---
        // 注意：我們將初始化移到這裡，以確保使用正確的路徑
        visionClient = new ImageAnnotatorClient({ keyFilename: googleCredentialsPath });
        translationClient = new TranslationServiceClient({ keyFilename: googleCredentialsPath });
        console.log("[Cloud Vision & Translation AI] Clients re-initialized successfully with path:", googleCredentialsPath);

        // --- 讀取 Project ID ---
        const credentialsFileContent = fs.readFileSync(googleCredentialsPath, 'utf8');
        const parsedCredentials = JSON.parse(credentialsFileContent);
        googleProjectId = parsedCredentials.project_id;
        console.log("[Cloud AI] Successfully obtained Google Cloud Project ID from credentials:", googleProjectId);
    } catch (error) {
        console.error("[Cloud AI] Error processing credentials file at", googleCredentialsPath, ":", error.message);
        visionClient = null; // 初始化失敗，設為 null
        translationClient = null;
    }
} else {
    // 之前在上面部分的 try-catch 已經處理了日誌，這裡可以保持原樣或添加額外日誌
    console.error("[Cloud AI] Credentials file not found at path:", googleCredentialsPath, ". AI features depending on it will be disabled.");
    // 確保 client 確實為 null
    visionClient = null;
    translationClient = null;
}
// --- END OF MODIFIED SECTION 1 ---

const BOX_JWT_SECRET = process.env.BOX_JWT_SECRET;
if (!BOX_JWT_SECRET) {
    console.error("嚴重錯誤: BOX_JWT_SECRET 環境變數未設定！紙箱系統認證將無法工作。");
    // process.exit(1); // 或者其他錯誤處理
}


const dependenciesForBoxRoutes = {
    pool,
    visionClient,
    translationClient,
    BOX_JWT_SECRET,
    uploadDir: '/data/uploads',
    authenticateBoxUser,
    isAdminAuthenticated,
    googleProjectId // <--- 确保这里真的把获取到的值传进去了
};

app.use('/api/box', boxRoutes(dependenciesForBoxRoutes));






// --- END OF Cloud Vision AI Integration ---



// GET /api/voit/campaigns - 獲取所有活躍的投票活動列表
voitRouter.get('/campaigns', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.campaign_id, c.title, c.description, c.status, c.creator_id,
                    COALESCE(u.display_name, u.username) as creator_name
             FROM voit_Campaigns c
             LEFT JOIN box_users u ON c.creator_id = u.user_id
             WHERE c.status = 'active'
             ORDER BY c.created_at DESC`
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

// POST /api/voit/campaigns - 新增投票活動
voitRouter.post('/campaigns', authenticateBoxUser, async (req, res) => {
    const { title, description, options } = req.body;
    const userId = req.boxUser.user_id; // 从认证中间件获取用户ID

    if (!title || title.trim() === '') {
        return res.status(400).json({ error: 'Campaign title is required.' });
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

        // 插入投票活動，添加creator_id字段
        const campaignResult = await client.query(
            "INSERT INTO voit_Campaigns (title, description, status, creator_id) VALUES ($1, $2, $3, $4) RETURNING campaign_id, title, description, status, created_at",
            [title.trim(), description || null, 'active', userId]
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
        res.status(500).json({ error: 'Failed to create campaign' });
    } finally {
        client.release();
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
voitRouter.post('/campaigns/:campaignId/verify-password', optionalAuthenticateBoxUser, async (req, res) => {
    const { campaignId } = req.params;
    const { password } = req.body;
    const currentUserId = req.boxUser ? req.boxUser.user_id : null;

    try {
        const result = await pool.query("SELECT edit_password, creator_id FROM voit_Campaigns WHERE campaign_id = $1", [campaignId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ verified: false, error: '找不到指定的投票活動。' });
        }

        const campaign = result.rows[0];
        const storedPassword = campaign.edit_password;
        const creatorId = campaign.creator_id;

        // 检查是否为创建者
        const isCreator = currentUserId && creatorId && parseInt(currentUserId) === parseInt(creatorId);

        // 如果是创建者，直接验证通过，无需密码
        if (isCreator) {
            return res.json({ verified: true });
        }

        // 非创建者需要检查密码
        if (!password) {
            return res.status(400).json({ verified: false, error: '請提供編輯密碼。' });
        }

        // 管理员密码检查
        const masterPassword = process.env.VOIT_MASTER_PASSWORD;
        const isPasswordCorrect = password === storedPassword || (masterPassword && password === masterPassword);

        if (isPasswordCorrect) {
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
voitRouter.put('/campaigns/:campaignId', optionalAuthenticateBoxUser, async (req, res) => {
    const { campaignId } = req.params;
    const { title, description, options } = req.body; // 編輯時不應更新 edit_password
    const currentUserId = req.boxUser ? req.boxUser.user_id : null;

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

        // 首先检查活动是否存在以及当前用户是否为创建者
        const campaignCheckResult = await client.query(
            "SELECT creator_id FROM voit_Campaigns WHERE campaign_id = $1",
            [campaignId]
        );

        if (campaignCheckResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到要更新的投票活動。' });
        }

        const creatorId = campaignCheckResult.rows[0].creator_id;

        // 检查当前用户是否为创建者
        if (!currentUserId || parseInt(currentUserId) !== parseInt(creatorId)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: '只有活動創建者可以更新此活動。' });
        }

        // 1. 更新 voit_Campaigns 表
        const updatedCampaignResult = await client.query(
            "UPDATE voit_Campaigns SET title = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE campaign_id = $3 RETURNING campaign_id, title, description",
            [title.trim(), description || null, campaignId]
        );

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
voitRouter.post('/campaigns', authenticateBoxUser, async (req, res) => {
    const { title, description, options } = req.body;
    const userId = req.boxUser.user_id; // 从认证中间件获取用户ID

    if (!title || title.trim() === '') {
        return res.status(400).json({ error: 'Campaign title is required.' });
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

        // 插入投票活動，添加creator_id字段
        const campaignResult = await client.query(
            "INSERT INTO voit_Campaigns (title, description, status, creator_id) VALUES ($1, $2, $3, $4) RETURNING campaign_id, title, description, status, created_at",
            [title.trim(), description || null, 'active', userId]
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
        res.status(500).json({ error: 'Failed to create campaign' });
    } finally {
        client.release();
    }
});

// DELETE /api/voit/campaigns/:campaignId - 刪除投票活動及其相關數據
voitRouter.delete('/campaigns/:campaignId', optionalAuthenticateBoxUser, async (req, res) => {
    const { campaignId } = req.params;
    const currentUserId = req.boxUser ? req.boxUser.user_id : null;

    // 基本的 ID 驗證 (例如，檢查是否為數字或有效的 UUID 格式，取決於您的 campaign_id 類型)
    // 假設 campaign_id 是數字類型
    const id = parseInt(campaignId, 10);
    if (isNaN(id)) {
        return res.status(400).json({ error: '無效的活動 ID 格式。' });
    }

    console.log(`[API DELETE /voit/campaigns] 請求刪除活動 ID: ${id}`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 首先检查活动是否存在以及当前用户是否为创建者
        const campaignResult = await client.query(
            "SELECT creator_id FROM voit_Campaigns WHERE campaign_id = $1",
            [id]
        );

        if (campaignResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到指定的投票活動。' });
        }

        const creatorId = campaignResult.rows[0].creator_id;

        // 检查当前用户是否为创建者
        if (!currentUserId || parseInt(currentUserId) !== parseInt(creatorId)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: '只有活動創建者可以刪除此活動。' });
        }

        // 1. 刪除相關的投票記錄 (voit_Votes)
        const deleteVotesResult = await client.query("DELETE FROM voit_Votes WHERE campaign_id = $1", [id]);
        console.log(`[DB] 從 voit_Votes 刪除了 ${deleteVotesResult.rowCount} 條與活動 ID ${id} 相關的投票記錄。`);

        // 2. 刪除相關的投票選項 (voit_Options)
        const deleteOptionsResult = await client.query("DELETE FROM voit_Options WHERE campaign_id = $1", [id]);
        console.log(`[DB] 從 voit_Options 刪除了 ${deleteOptionsResult.rowCount} 條與活動 ID ${id} 相關的選項記錄。`);

        // 3. 刪除投票活動本身 (voit_Campaigns)
        const deleteCampaignResult = await client.query("DELETE FROM voit_Campaigns WHERE campaign_id = $1", [id]);

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






// YouTube抽獎系統API路由
app.use('/api/admin/lottery', youtubeLotteryRouter);


// 設置監控的直播
youtubeLotteryRouter.post('/set-video', async (req, res) => {
    try {
        const { videoId, keyword, apiRateLimit, forceLiveMode } = req.body;
        const result = await youtubeLottery.setTargetVideo(videoId, keyword, apiRateLimit, forceLiveMode);
        res.json(result); // 直接返回結果對象，包括videoTitle、isLive等信息
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// 刪除指定參與者
youtubeLotteryRouter.post('/remove-participant', async (req, res) => {
    try {
        const { channelId } = req.body;
        if (!channelId) {
            return res.status(400).json({ error: '缺少必要的參數 channelId' });
        }

        const result = await youtubeLottery.removeParticipant(channelId);
        res.json(result);
    } catch (error) {
        console.error('刪除參與者時出錯:', error);
        res.status(500).json({ error: error.message });
    }
});

// 獲取當前參與者
youtubeLotteryRouter.get('/participants', async (req, res) => {
    try {
        const participants = await youtubeLottery.getParticipants();
        res.json({ participants });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});








// 執行抽獎
youtubeLotteryRouter.post('/draw', async (req, res) => {
    try {
        const { animationMode, duration } = req.body;
        const winner = await youtubeLottery.drawWinner(animationMode, duration);
        res.json({ winner });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// 停止監控
youtubeLotteryRouter.post('/stop-monitoring', async (req, res) => {
    try {
        const result = youtubeLottery.stopMonitoring();
        res.json({ success: true, message: result.message });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// 獲取抽獎歷史
youtubeLotteryRouter.get('/history', async (req, res) => {
    try {
        const history = await youtubeLottery.getLotteryHistory();
        res.json({ history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 用戶畫像相關API
youtubeLotteryRouter.get('/user-profiles', async (req, res) => {
    try {
        const userProfiles = await userProfile.getAllProfiles();
        res.json({ userProfiles });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 獲取用戶參與統計
youtubeLotteryRouter.get('/stats', async (req, res) => {
    try {
        const stats = await userProfile.getParticipationStats();
        res.json({ stats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



youtubeLotteryRouter.post('/history', async (req, res) => {
    try {
        const winnerData = req.body;
        if (!youtubeLottery) {
            return res.status(400).json({ error: '抽獎系統尚未初始化' });
        }
        const result = await youtubeLottery.saveLotteryHistory(winnerData);
        res.status(201).json(result);
    } catch (error) {
        console.error('API /api/admin/lottery/history error:', error);
        res.status(500).json({ error: error.message });
    }
});



// 向所有WebSocket客戶端廣播消息
function broadcastToAll(message) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(messageStr);
        }
    });
}








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
            // 記錄基本頁面訪問
            const sql = `
                INSERT INTO page_views (page, view_date, view_count)
                VALUES ($1, CURRENT_DATE, 1)
                ON CONFLICT (page, view_date) DO UPDATE SET
                    view_count = page_views.view_count + 1;
            `;
            const params = [pagePath];
            await pool.query(sql, params);

            // --- 記錄來源資訊 ---
            const referer = req.get('Referer') || '';
            const userAgent = req.get('User-Agent') || '';

            // 判斷來源類型
            let sourceType = 'direct';
            let sourceName = '';
            let sourceUrl = referer;

            if (referer) {
                try {
                    const refererUrl = new URL(referer);

                    // 搜尋引擎檢測
                    if (refererUrl.hostname.includes('google.') ||
                        refererUrl.hostname.includes('bing.') ||
                        refererUrl.hostname.includes('yahoo.') ||
                        refererUrl.hostname.includes('baidu.')) {
                        sourceType = 'search_engine';
                        sourceName = refererUrl.hostname.split('.')[1];
                    }
                    // 社交媒體檢測
                    else if (refererUrl.hostname.includes('facebook.') ||
                        refererUrl.hostname.includes('instagram.') ||
                        refererUrl.hostname.includes('twitter.') ||
                        refererUrl.hostname.includes('linkedin.') ||
                        refererUrl.hostname.includes('line.me')) {
                        sourceType = 'social';
                        sourceName = refererUrl.hostname.split('.')[0];
                    }
                    // 其他外部連結
                    else if (!refererUrl.hostname.includes(req.hostname)) {
                        sourceType = 'referral';
                        sourceName = refererUrl.hostname;
                    } else {
                        sourceType = 'internal';
                        sourceName = 'internal';
                    }
                } catch (urlError) {
                    console.warn('Invalid referer URL:', referer);
                    sourceType = 'other';
                    sourceName = 'invalid_url';
                }
            }

            // 為會話創建ID（如果不存在）
            if (!req.session.visitor_id) {
                req.session.visitor_id = uuidv4(); // 需要引入 uuid 包
                req.session.page_views = [];
            }

            const visitorId = req.session.visitor_id;

            // 記錄此訪客瀏覽的頁面
            if (!req.session.page_views.includes(pagePath)) {
                req.session.page_views.push(pagePath);
            }

            // 更新 is_bounce 狀態
            const isBounce = req.session.page_views.length <= 1;

            // 將來源資訊寫入資料庫
            const sourceSql = `
                INSERT INTO source_page_views (page, view_date, source_type, source_name, source_url, view_count, is_bounce)
                VALUES ($1, CURRENT_DATE, $2, $3, $4, 1, $5)
                ON CONFLICT (page, view_date, source_type, source_name) DO UPDATE SET
                    view_count = source_page_views.view_count + 1,
                    is_bounce = $5;
            `;
            await pool.query(sourceSql, [pagePath, sourceType, sourceName, sourceUrl, isBounce]);

        } catch (err) {
            console.error('記錄頁面訪問或來源數據時出錯:', err);
            // 但不中斷用戶體驗，繼續處理請求
        }
    }

    next();
});

// 記錄轉換事件
app.post('/api/track/conversion', async (req, res) => {
    try {
        const { conversionType, sourcePath } = req.body;

        if (!req.session.visitor_id) {
            return res.status(400).json({ error: '無法識別訪客' });
        }

        // 更新訪客來源的轉換狀態
        const updateQuery = `
            UPDATE source_page_views 
            SET has_conversion = TRUE 
            WHERE source_type IN (
                SELECT source_type FROM source_page_views 
                WHERE page = $1
                ORDER BY view_date DESC
                LIMIT 1
            )
            AND view_date >= CURRENT_DATE - INTERVAL '30 days';
        `;

        await pool.query(updateQuery, [sourcePath || '/']);
        res.status(200).json({ success: true });
    } catch (err) {
        console.error('記錄轉換事件失敗:', err);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});









app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.status(200).send("Server is running and healthy!");
});


// --- 第二個跳出率更新中間件已被移除，因為其功能已包含在上面的「記錄 Page View 中間件」中 ---

// --- 重複的 /api/track/conversion 路由已被移除 ---





// =================================================================
// ★★★ WebSocket Connection Handlers ★★★
// =================================================================

// 5. 處理 Simple Walker 的連接邏輯
wssSimpleWalker.on('connection', async (ws, req) => {
    const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for']?.split(',').shift();
    console.log(`[WS Simple Walker] 新的 WebSocket 客戶端已連接！IP: ${clientIp}`);
    console.log(`[WS Simple Walker DEBUG] 新連接嘗試. URL完整信息:`, req.url);

    const url = new URL(req.url, `http://${req.headers.host}`);
    const clientType = url.searchParams.get('clientType');
    const roomId = url.searchParams.get('roomId');
    const playerName = url.searchParams.get('playerName');

    console.log(`[WS Simple Walker] Connection attempt: Type=${clientType}, Room=${roomId}, Player=${playerName}`);

    if (!roomId || !clientType || !playerName) {
        console.warn(`[WS Simple Walker DEBUG] 連接被拒絕: 缺少參數.`);
        ws.close(1008, "缺少房間 ID、客戶端類型或玩家名稱");
        return;
    }

    if (clientType === 'controller') {
        let roomData;
        let playerId;

        try {
            roomData = await dbClient.getRoom(roomId);
            if (!roomData || !roomData.game_state) {
                console.warn(`[WS Simple Walker DEBUG] 房間 ${roomId} 未找到或狀態無效.`);
                ws.close(1011, "找不到房間或房間無效");
                return;
            }
            console.log(`[WS Simple Walker] Room ${roomId} found in DB.`);

            playerId = uuidv4();
            console.log(`[WS Simple Walker DEBUG] 為玩家 ${playerName} 生成 ID: ${playerId}`);

            const updatedRoomResult = await dbClient.addPlayerToRoom(roomId, playerId, playerName);

            if (!updatedRoomResult || !updatedRoomResult.game_state) {
                console.error(`[WS Simple Walker DEBUG] 加入房間失敗.`);
                throw new Error("加入房間到資料庫失敗");
            }

            ws.playerId = playerId;
            ws.roomId = roomId;
            ws.clientType = clientType;
            console.log(`[WS Simple Walker] Player ${playerName} (ID: ${playerId}) added to room ${roomId} in DB.`);

            if (!simpleWalkerConnections.has(roomId)) {
                simpleWalkerConnections.set(roomId, new Set());
            }
            simpleWalkerConnections.get(roomId).add(ws);
            console.log(`[WS Simple Walker] Connection added. Room ${roomId} active connections: ${simpleWalkerConnections.get(roomId).size}`);

            ws.send(JSON.stringify({ type: 'playerInfo', playerId: playerId }));
            console.log(`[WS Simple Walker] Sent playerInfo to ${playerName}`);

            const currentGameState = updatedRoomResult.game_state;
            const currentRoomName = updatedRoomResult.room_name;
            ws.send(JSON.stringify({ type: 'gameStateUpdate', roomName: currentRoomName, gameState: currentGameState }));
            console.log(`[WS Simple Walker] Sent initial gameStateUpdate to ${playerName}`);

            broadcastToSimpleWalkerRoom(roomId, {
                type: 'gameStateUpdate',
                roomName: currentRoomName,
                gameState: currentGameState
            }, ws);
            console.log(`[WS Simple Walker] Broadcasted gameStateUpdate to other players in room ${roomId}.`);

        } catch (error) {
            console.error(`[WS Simple Walker DEBUG] 連接設置錯誤: ${error.message}`);
            let closeReason = "加入房間失敗";
            if (error.message.includes('房間已滿') || error.message.includes('玩家名稱已被使用')) {
                closeReason = error.message;
            }
            try {
                ws.send(JSON.stringify({ type: 'error', message: closeReason }));
            } catch (sendErr) {
                console.error(`[WS Simple Walker DEBUG] 無法發送錯誤消息: ${sendErr.message}`);
            }
            ws.close(4000, closeReason);
            return;
        }

        ws.on('message', (message) => {
            handleSimpleWalkerMessage(ws, message);
        });
        ws.on('close', (code, reason) => {
            console.log(`[WS Simple Walker DEBUG] 玩家 ${playerName} (ID: ${playerId}) 連接關閉. 代碼: ${code}, 原因: ${reason}`);
            handleSimpleWalkerClose(ws);
        });
        ws.on('error', (error) => {
            console.error(`[WS Simple Walker DEBUG] 玩家 ${playerName} (ID: ${playerId}) 連接錯誤: ${error.message}`);
            handleSimpleWalkerError(ws, error);
        });

    } else {
        console.warn(`[WS Simple Walker DEBUG] 未知的客戶端類型: '${clientType}'，連接被拒絕`);
        ws.close(1008, "未知的客戶端類型");
    }
});

// Simple Walker 的 WebSocket 邏輯已經準備好處理連接
console.log('[Simple Walker] WebSocket 邏輯初始化完成。');

// =================================================================
// ★★★ Chat Room WebSocket Logic ★★★
// =================================================================

// 廣播訊息到聊天室
const broadcastToChatRoom = (roomId, message, excludeWs = null) => {
    if (!chatRoomConnections.has(roomId)) {
        return;
    }

    const messageStr = JSON.stringify(message);
    const connections = chatRoomConnections.get(roomId);

    connections.forEach(client => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            try {
                client.send(messageStr);
            } catch (error) {
                console.error(`[WS Chat Room] 廣播訊息失敗: ${error.message}`);
                connections.delete(client);
            }
        }
    });
};

// 存儲聊天室連接
const chatRoomConnections = new Map(); // roomId -> Set of WebSocket connections
const chatUserConnections = new Map(); // NEW: userId -> { userInfo, connections: Set<ws> }
// 儲存聊天訊息到資料庫並廣播
async function handleChatMessage(ws, message) {
    try {
        const data = JSON.parse(message);
        
        // 只處理 chat_message 和 announcement 類型
        if (data.type !== 'chat_message' && data.type !== 'announcement') {
            return;
        }

        // 如果是公告，檢查權限
        if (data.type === 'announcement') {
            const userRole = ws.roleName; 
            if (userRole !== '系統管理員') {
                 ws.send(JSON.stringify({ type: 'error', message: '你沒有發布公告的權限。' }));
                 return;
            }
        }
        
        const userId = ws.userId;
        const roomId = ws.roomId;
        const content = data.content.trim();
        const ipAddress = ws.ip;
        console.log(`[DB Write] 準備將訊息寫入資料庫，IP 位址為: ${ipAddress}`); // <-- 新增日誌

        if (!content) return;
        
          // 1. 將訊息存入資料庫 (公告或一般訊息)，包含 IP
          const insertResult = await pool.query(
            `INSERT INTO chat_messages (user_id, room_id, message, message_type, ip_address) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
            [userId, roomId, content, data.type === 'announcement' ? 'announcement' : 'text', ipAddress]
        );

        const dbMessage = insertResult.rows[0];

        // 2. 準備廣播用的訊息物件
        const broadcastMessage = {
            type: data.type, // 'chat_message' or 'announcement'
            id: dbMessage.id,
            content: content,
            timestamp: new Date(dbMessage.created_at).getTime(),
            userId: ws.userId,
            username: ws.username,
            avatar: ws.avatar,
            roleName: ws.roleName,
            roomId: ws.roomId
        };

        // 3. 廣播給房間內的所有人
        broadcastToChatRoom(roomId, broadcastMessage);

    } catch (error) {
        console.error('[WS Chat Room] Error handling chat message:', error);
        ws.send(JSON.stringify({ type: 'error', message: '訊息處理失敗' }));
    }
}
function handleChatClose(ws) {
    const userId = ws.userId;
    const roomId = ws.roomId;
    const username = ws.username; // 先把名字存起來

    if (!userId || !chatUserConnections.has(userId)) {
        return;
    }

    const userData = chatUserConnections.get(userId);
    userData.connections.delete(ws);
    
    // 同時從房間連線集合中移除
    if (chatRoomConnections.has(roomId)) {
        chatRoomConnections.get(roomId).delete(ws);
    }

    // 如果這是該使用者的最後一個連線，則將其標記為離線
    if (userData.connections.size === 0) {
        chatUserConnections.delete(userId);
        console.log(`[WS Chat Room] 用戶 ${ws.username} (ID: ${userId}) 的最後一個連線已關閉，標記為離線。`);

        // 廣播使用者離開事件 (給前端更新列表)
        broadcastToChatRoom(roomId, {
            type: 'user_left',
            userId: userId
        });

        // 廣播系統訊息
        broadcastToChatRoom(roomId, {
            type: 'system_message',
            content: `${username} 離開了。`
        });

        // 廣播更新後的在線使用者列表
        const onlineUsers = Array.from(chatUserConnections.values()).map(data => data.userInfo);
        broadcastToChatRoom(roomId, {
            type: 'online_users',
            users: onlineUsers
        });
    } else {
        console.log(`[WS Chat Room] 用戶 ${ws.username} (ID: ${userId}) 關閉了一個連線，但仍有 ${userData.connections.size} 個連線在線。`);
    }
}

// 處理連線錯誤
function handleChatError(ws, error) {
    console.error(`[WS Chat Room] 用戶 ${ws.userId} 的 WebSocket 發生錯誤:`, error);
    // 錯誤事件通常會觸發 close 事件，所以清理邏輯會在 handleChatClose 中處理
}

    // 聊天室 WebSocket 連接處理
    wssChatRoom.on('connection', async (ws, req) => {
        const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for']?.split(',').shift();
        
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const userIdFromQuery = url.searchParams.get('userId'); // 從查詢參數獲取

        if (!token || !userIdFromQuery) {
            console.warn(`[WS Chat Room] 連接被拒絕: 缺少認證參數`);
            ws.close(1008, "缺少認證參數");
            return;
        }

        try {
            // 1. 驗證 JWT Token
            const decoded = jwt.verify(token, process.env.BOX_JWT_SECRET);
            if (!decoded || decoded.user_id != userIdFromQuery) {
                console.warn(`[WS Chat Room] Token 驗證失敗或 Token 中的 user_id (${decoded.user_id}) 與查詢參數 (${userIdFromQuery}) 不符`);
                ws.close(1008, "認證失敗");
                return;
            }
            
            const userId = decoded.user_id;
            console.log(`[WS Chat Room] 新客戶端嘗試連接... IP: ${clientIp}, UserID: ${userId}`);

            // 2. 獲取用戶詳細資訊
            const userResult = await pool.query(`
                SELECT 
                    bu.user_id, bu.username, bu.display_name, bu.user_profile_image_url, 
                    ur.role_name
                FROM box_users bu
                LEFT JOIN user_role_assignments ura ON bu.user_id = ura.user_id AND ura.is_active = true
                LEFT JOIN user_roles ur ON ura.role_id = ur.role_id
                WHERE bu.user_id = $1
            `, [userId]);

            if (userResult.rows.length === 0) {
                console.warn(`[WS Chat Room] 用戶不存在: ${userId}`);
                ws.close(1008, "用戶不存在");
                return;
            }

            const userInfo = userResult.rows[0];
            const displayName = userInfo.display_name || userInfo.username;
            const avatar = userInfo.user_profile_image_url || 'images/a01girlmove.gif';
            const roleName = userInfo.role_name;

            // 3. 將用戶資訊附加到 WebSocket 連線物件上
            ws.userId = userId;
            ws.username = displayName;
            ws.avatar = avatar;
            ws.roleName = roleName;
            ws.roomId = 1; // 目前所有使用者都在同一個通用房間 (ID: 1)
            ws.ip = clientIp; 
            // 4. --- 處理多重連線邏輯 ---
            const isFirstConnection = !chatUserConnections.has(userId);

            if (isFirstConnection) {
                console.log(`[WS Chat Room] 用戶 ${displayName} (ID: ${userId}) 首次連接。`);
                chatUserConnections.set(userId, {
                    userInfo: { userId, username: displayName, avatar, roleName },
                    connections: new Set()
                });
            } else {
                console.log(`[WS Chat Room] 用戶 ${displayName} (ID: ${userId}) 建立新的連線。`);
            }
            
            chatUserConnections.get(userId).connections.add(ws);

            if (!chatRoomConnections.has(ws.roomId)) {
                chatRoomConnections.set(ws.roomId, new Set());
            }
            chatRoomConnections.get(ws.roomId).add(ws);

            // 5. 發送私人的歡迎訊息給新連線的客戶端
            ws.send(JSON.stringify({
                type: 'system_message',
                content: '歡迎來到SunnyYummy聊天室！在這裡，你可以與其他人交流心得，分享你的趣事。請保持友善、尊重他人，並遵守社群規範。'
            }));

            // 6. 如果是使用者的第一個連線，廣播 "使用者加入" 事件和 "系統訊息"
            if (isFirstConnection) {
                // 廣播 user_joined 事件，讓前端更新在線列表
                broadcastToChatRoom(ws.roomId, {
                    type: 'user_joined',
                    user: chatUserConnections.get(userId).userInfo
                }, ws); // 廣播給除了自己以外的人

                // 廣播系統訊息，通知所有人有新使用者加入
                broadcastToChatRoom(ws.roomId, {
                    type: 'system_message',
                    content: `歡迎 ${displayName} 進入了聊天室！`
                });
            }

            // 7. 發送更新後的在線使用者列表給所有人
            const onlineUsers = Array.from(chatUserConnections.values()).map(data => data.userInfo);
            broadcastToChatRoom(ws.roomId, {
                type: 'online_users',
                users: onlineUsers
            });
            
            console.log(`[WS Chat Room] 房間 '${ws.roomId}' 當前獨立在線用戶數: ${onlineUsers.length}，總連線數: ${chatRoomConnections.get(ws.roomId).size}`);

            // 8. 設置事件監聽器
            ws.on('message', (message) => handleChatMessage(ws, message));
            ws.on('close', () => handleChatClose(ws));
            ws.on('error', (error) => handleChatError(ws, error));

        } catch (error) {
            console.error(`[WS Chat Room] 連接設定過程中發生錯誤: ${error.message}`);
            ws.close(4000, "連接設定失敗");
        }
    });

console.log('[Chat Room] WebSocket 邏輯初始化完成。');

 






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


// --- WebSocket 服務器設置 ---


app.get('/api/admin/products', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 設定到今天開始
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1); // 設定到明天開始

        const sqlQuery = `
            WITH product_daily_clicks AS (
                SELECT
                    product_id,
                    COUNT(*) AS calculated_today_clicks
                FROM product_click_events
                WHERE clicked_at >= $1 AND clicked_at < $2
                GROUP BY product_id
            )
            SELECT
                p.*, -- 選擇 products 表的所有欄位
                p.click_count AS historical_click_count, -- 將 products.click_count 明確命名為歷史點擊
                (SELECT array_agg(t.tag_name) FROM tags t
                 JOIN product_tags pt ON t.tag_id = pt.tag_id
                 WHERE pt.product_id = p.id) as tags,
                COALESCE(pdc.calculated_today_clicks, 0) AS today_click_increment -- 今日新增的點擊
            FROM products p
            LEFT JOIN product_daily_clicks pdc ON p.id = pdc.product_id
            ORDER BY p.id DESC;
        `;

        const result = await pool.query(sqlQuery, [today.toISOString(), tomorrow.toISOString()]);

        // 現在 API 會返回包含 historical_click_count 和 today_click_increment 的數據
        // 前端將負責組合顯示
        const productsData = result.rows.map(product => {
            return {
                ...product, // 保留所有原始欄位
                // historical_click_count 已經是 p.click_count 的值
                // today_click_increment 已經是計算出的今日點擊
                // 前端將使用這兩個欄位來組合顯示
                // 如果需要一個 "總點擊數" 欄位 (歷史+今日) 也可以在這裡計算
                // total_clicks_combined: (product.historical_click_count || 0) + (parseInt(product.today_click_increment, 10) || 0)
            };
        });

        res.json(productsData);
    } catch (err) {
        console.error('Error fetching admin products with today clicks:', err.stack || err);
        res.status(500).json({ error: '無法獲取商品列表', detail: err.message });
    }
});

app.put('/api/admin/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, category, image_url, seven_eleven_url, expiration_type, start_date, end_date, tags } = req.body;

        // Update product
        await pool.query(
            'UPDATE products SET name = $1, description = $2, price = $3, category = $4, image_url = $5, seven_eleven_url = $6, expiration_type = $7, start_date = $8, end_date = $9, updated_at = NOW() WHERE id = $10',
            [name, description, price, category, image_url, seven_eleven_url, expiration_type || 0, start_date, end_date, id]
        );

        // Handle tags if provided
        if (tags && Array.isArray(tags)) {
            // Delete existing tag associations
            await pool.query('DELETE FROM product_tags WHERE product_id = $1', [id]);

            // Add new tag associations if any
            if (tags.length > 0) {
                const tagValues = tags.map((tagId) => `(${id}, ${tagId})`).join(',');
                await pool.query(`INSERT INTO product_tags (product_id, tag_id) VALUES ${tagValues}`);
            }
        }

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Error updating product:', err);
        res.status(500).json({ error: '更新商品失敗' });
    }
});

app.delete('/api/admin/products/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        // 在刪除商品之前，先刪除與 product_tags 表的關聯
        await pool.query('DELETE FROM product_tags WHERE product_id = $1', [id]);
        // 然後再刪除商品本身
        const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到該商品' });
        }
        res.status(204).send();
    } catch (error) {
        console.error(`刪除商品 ID ${id} 時出錯:`, error);
        res.status(500).json({ error: '數據庫錯誤，無法刪除商品' });
    }
});

// POST /api/admin/products - 新增一個商品
app.post('/api/admin/products', isAdminAuthenticated, productUpload.single('image'), async (req, res) => {
    const { name, description, price, category, seven_eleven_url, expiration_type, start_date, end_date, tags } = req.body;
    const image_url = req.file ? `/uploads/storemarket/${req.file.filename}` : (req.body.image_url || null);

    if (!name) {
        return res.status(400).json({ error: '商品名稱是必填項。' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const productResult = await client.query(
            `INSERT INTO products (name, description, price, category, image_url, seven_eleven_url, expiration_type, start_date, end_date, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            [name, description || null, price || null, category || null, image_url, seven_eleven_url || null, expiration_type || 0, start_date || null, end_date || null]
        );
        const newProductId = productResult.rows[0].id;

        if (tags) {
            const tagArray = JSON.parse(tags);
            if (Array.isArray(tagArray) && tagArray.length > 0) {
                for (const tagId of tagArray) {
                    await client.query(
                        'INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [newProductId, tagId]
                    );
                }
            }
        }

        await client.query('COMMIT');

        const newProduct = await client.query('SELECT * FROM products WHERE id = $1', [newProductId]);
        res.status(201).json(newProduct.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('新增商品時的資料庫事務錯誤:', error);
        res.status(500).json({ error: '處理請求時發生資料庫錯誤' });
    } finally {
        client.release();
    }
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

                // 3. 廣播模板更新消息給房間内所有玩家
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
        } catch (sendErr) { /* 忽略 */ }
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
















// --- START OF MODIFIED SECTION 2: Upload Directory Handling (修正後) ---
let uploadDir;

if (process.env.NODE_ENV === 'production') {
    uploadDir = '/data/uploads';
    console.log(`[Uploads] Production environment detected. Using persistent disk path: ${uploadDir}`);
} else {
    // ★★★ 確保這裡是使用 path.join 來組合本地路徑 ★★★
    uploadDir = path.join(__dirname, 'public', 'uploads');
    console.log(`[Uploads] 本機開發環境中 Development environment detected. Using local path: ${uploadDir}`);
}

// 確保這個目錄存在 (如果不存在則創建)
// 這個邏輯對本地和 Render 都適用
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`[Uploads] Upload directory created at: ${uploadDir}`);
    }
} catch (err) {
    console.error(`[Uploads] Failed to create upload directory at ${uploadDir}:`, err);
    // 在 Render 環境中，如果這步失敗，通常意味著 Persistent Disk 沒有正確掛載。
    // 在本地環境，通常是權限問題。
}
// --- END OF MODIFIED SECTION 2 ---



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
        const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.html', '.pdf'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
            return cb(new Error('只允許上傳圖片 (png, jpg, gif) 或 PDF 檔案！'));
        }
        cb(null, true);
    },
    limits: { fileSize: 4 * 1024 * 1024 } // 限制 4MB
});

// --- 新增：專用於 PNG/GIF 直接上傳的 Multer 設定 ---
// 這個設定會保留原始檔案格式
const directImageStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e5) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const directImageUpload = multer({
    storage: directImageStorage,
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/png', 'image/gif'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('只允許上傳 PNG 或 GIF 檔案！'), false);
        }
    },
    limits: { fileSize: 4 * 1024 * 1024 } // 同樣限制 4MB
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
        const ip_address = req.ip || 'unknown'; await pool.query(
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
            catch (e) { templateData.cell_data = []; }
        } else if (!templateData.cell_data) {
            templateData.cell_data = [];
        }

        // 確保 style_data 是物件 (如果 DB 是 NULL 或解析失敗)
        if (templateData.style_data && typeof templateData.style_data === 'string') {
            try { templateData.style_data = JSON.parse(templateData.style_data); }
            catch (e) { templateData.style_data = {}; }
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








// --- 洞洞樂遊戲 API (Card Game APIs) ---

// 1. 獲取所有擁有公開模板的創作者列表
app.get('/api/card-game/creators', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT u.user_id, u.username, u.user_profile_image_url
            FROM box_users u
            JOIN card_game_templates t ON u.user_id = t.creator_id
            WHERE t.is_public = TRUE
            ORDER BY u.username;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('[API ERROR] /api/card-game/creators:', err.stack);
        res.status(500).json({ error: '無法獲取創作者列表' });
    }
});

// 2. 獲取模板列表 (支持篩選、排序、搜尋)
app.get('/api/card-game/templates', optionalAuthenticateBoxUser, async (req, res) => {
    const { creatorId, sortBy, search, searchBy = 'template_name' } = req.query;
    const userIdFromToken = req.boxUser ? req.boxUser.user_id : null; // 從 req.boxUser 獲取

    let query = `
        SELECT 
            t.id, 
            t.template_name, 
            t.creator_id, 
            COALESCE(u.display_name, u.username) AS creator_name, 
            t.is_public, 
            t.play_count, 
            t.copy_count,
            CASE WHEN t.creator_id = $1 THEN true ELSE false END AS is_owner
        FROM 
            card_game_templates t
        LEFT JOIN 
            box_users u ON t.creator_id = u.user_id
        WHERE 1=1
    `;
    const params = [userIdFromToken || null];

    try {
        if (creatorId) {
            if (creatorId === 'mine' && userIdFromToken) {
                query += ` AND t.creator_id = $${params.length + 1}`;
                params.push(userIdFromToken);
            } else if (creatorId !== 'mine') {
                query += ` AND t.creator_id = $${params.length + 1} AND t.is_public = true`;
                params.push(creatorId);
            } else {
                // 如果 creatorId 是 'mine' 但用戶未登入，返回空陣列
                return res.json([]);
            }
        } else {
            // 預設只顯示公開模板
            query += ' AND t.is_public = true';
        }

        if (search) {
            if (searchBy === 'creator_name') {
                query += ` AND COALESCE(u.display_name, u.username) ILIKE $${params.length + 1}`;
            } else {
                query += ` AND t.template_name ILIKE $${params.length + 1}`;
            }
            params.push(`%${search}%`);
        }

        if (sortBy === 'popular') {
            query += ' ORDER BY t.play_count DESC, t.copy_count DESC';
        } else {
            query += ' ORDER BY t.created_at DESC'; // 預設為最新
        }

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// 3. 獲取單一模板的完整內容 (用於遊玩或編輯)
app.get('/api/card-game/templates/:id', optionalAuthenticateBoxUser, async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.boxUser ? req.boxUser.user_id : null; // 從 req.boxUser 獲取

    try {
        const result = await pool.query(`
            SELECT t.*, COALESCE(u.display_name, u.username) AS creator_name,
                   CASE WHEN t.creator_id = $2 THEN TRUE ELSE FALSE END AS is_owner
            FROM card_game_templates t
            LEFT JOIN box_users u ON t.creator_id = u.user_id
            WHERE t.id = $1
        `, [id, currentUserId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到該模板' });
        }

        const template = result.rows[0];
        // 如果模板是私有的，只有擁有者可以訪問
        if (!template.is_public && template.creator_id !== currentUserId) {
            return res.status(403).json({ error: '無權訪問此模板' });
        }

        res.json(template);
    } catch (err) {
        console.error(`[API ERROR] /api/card-game/templates/${id}:`, err.stack);
        res.status(500).json({ error: '無法獲取模板' });
    }
});

// 4. 新增模板 (需要會員登入)
app.post('/api/card-game/templates', authenticateBoxUser, async (req, res) => {
    const { template_name, content_data, is_public } = req.body;
    const creatorId = req.boxUser.user_id; // ★★★ FIX: 從 req.boxUser.user_id 獲取

    if (!template_name || !content_data || !Array.isArray(content_data.items) || content_data.items.length !== 20) {
        return res.status(400).json({ error: '參數無效，請檢查模板名稱和內容 (需為20個項目的陣列)。' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO card_game_templates (creator_id, template_name, content_data, is_public) VALUES ($1, $2, $3, $4) RETURNING *',
            [creatorId, template_name, content_data, is_public]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[API ERROR] POST /api/card-game/templates:', err.stack);
        res.status(500).json({ error: '無法新增模板' });
    }
});

// 5. 更新模板 (需要會員登入且為擁有者)
app.put('/api/card-game/templates/:id', authenticateBoxUser, async (req, res) => {
    const { id } = req.params;
    const { template_name, content_data, is_public } = req.body;
    const creatorId = req.boxUser.user_id; // ★★★ FIX: 從 req.boxUser.user_id 獲取

    if (!template_name || !content_data || !Array.isArray(content_data.items) || content_data.items.length !== 20) {
        return res.status(400).json({ error: '參數無效' });
    }

    try {
        const result = await pool.query(
            'UPDATE card_game_templates SET template_name = $1, content_data = $2, is_public = $3, updated_at = NOW() WHERE id = $4 AND creator_id = $5 RETURNING *',
            [template_name, content_data, is_public, id, creatorId]
        );
        if (result.rowCount === 0) {
            return res.status(403).json({ error: '無權更新此模板或模板不存在' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`[API ERROR] PUT /api/card-game/templates/${id}:`, err.stack);
        res.status(500).json({ error: '無法更新模板' });
    }
});

// 6. 刪除模板 (需要會員登入且為擁有者)
app.delete('/api/card-game/templates/:id', authenticateBoxUser, async (req, res) => {
    const { id } = req.params;
    const creatorId = req.boxUser.user_id; // ★★★ FIX: 從 req.boxUser.user_id 獲取
    try {
        const result = await pool.query(
            'DELETE FROM card_game_templates WHERE id = $1 AND creator_id = $2',
            [id, creatorId]
        );
        if (result.rowCount === 0) {
            return res.status(403).json({ error: '無權刪除此模板或模板不存在' });
        }
        res.status(204).send();
    } catch (err) {
        console.error(`[API ERROR] DELETE /api/card-game/templates/${id}:`, err.stack);
        res.status(500).json({ error: '無法刪除模板' });
    }
});

// 7. 追蹤遊玩次數 (任何人都可以觸發)
app.post('/api/card-game/templates/:id/play', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE card_game_templates SET play_count = play_count + 1 WHERE id = $1', [id]);
        res.status(200).json({ message: 'Play count updated.' });
    } catch (err) {
        // 即使出錯也不要影響前端遊戲體驗，所以只在後端紀錄
        console.error(`[API ERROR] Failed to increment play count for template ${id}:`, err.stack);
        res.status(500).json({ error: 'Failed to update play count.' });
    }
});

// 8. 複製 (Clone) 模板 (需要會員登入)
app.post('/api/card-game/templates/:id/copy', authenticateBoxUser, async (req, res) => {
    const { id } = req.params; // 原始模板 ID
    const newOwnerId = req.boxUser.user_id; // ★★★ FIX: 從 req.boxUser.user_id 獲取

    try {
        // 使用 transaction 確保資料一致性
        await pool.query('BEGIN');

        // 獲取原始模板
        const originalTemplateResult = await pool.query('SELECT * FROM card_game_templates WHERE id = $1', [id]);
        if (originalTemplateResult.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: '原始模板不存在' });
        }
        const originalTemplate = originalTemplateResult.rows[0];

        // 檢查使用者是否在複製自己的模板
        if (originalTemplate.creator_id === newOwnerId) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ error: '無法複製自己的模板。' });
        }

        // 增加原始模板的 copy_count
        await pool.query('UPDATE card_game_templates SET copy_count = copy_count + 1 WHERE id = $1', [id]);

        // 創建一個新的模板給目前使用者
        const newTemplateName = `副本: ${originalTemplate.template_name}`.slice(0, 100);
        const newTemplateResult = await pool.query(
            'INSERT INTO card_game_templates (creator_id, template_name, content_data, is_public) VALUES ($1, $2, $3, $4) RETURNING *',
            [newOwnerId, newTemplateName, originalTemplate.content_data, false] // 複製後預設為私有
        );

        // 提交 transaction
        await pool.query('COMMIT');

        res.status(201).json(newTemplateResult.rows[0]);

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(`[API ERROR] POST /api/card-game/templates/${id}/copy:`, err.stack);
        res.status(500).json({ error: '無法複製模板' });
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
    // 新增：支援多檔案類型篩選，格式為逗號分隔的副檔名，例如 "png,gif"
    const extensions = req.query.extensions?.trim().toLowerCase().split(',').filter(Boolean) || [];

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

    // 如果有指定副檔名篩選
    if (extensions.length > 0) {
        const extensionClauses = extensions.map(ext => {
            queryParams.push(`%.${ext}`);
            return `LOWER(original_filename) LIKE LOWER($${paramIndex++})`;
        });
        whereClauses.push(`(${extensionClauses.join(' OR ')})`);
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




app.post('/api/upload-safe-image', publicSafeUpload.single('image'), async (req, res) => {
    // 'image' 是前端 input file 元素的 name 屬性

    if (!visionClient) { // 確保 Vision API 客戶端已初始化
        console.error('[API /upload-safe-image] Vision API client not available.');
        return res.status(503).json({ success: false, error: "圖片分析服務目前不可用。" });
    }

    if (!req.file) {
        // multer fileFilter 拒絕或沒有檔案上傳
        return res.status(400).json({ success: false, error: '沒有上傳有效的圖片檔案或欄位名稱不符 (應為 "image")' });
    }

    const file = req.file;
    // 因為您使用 multer.diskStorage，檔案已寫入磁碟，需要讀取回來處理
    const imageBuffer = fs.readFileSync(file.path);

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
            // 您可以根據需求調整嚴格度，例如加入 'POSSIBLE'
            if (['LIKELY', 'VERY_LIKELY'].includes(safeSearch.adult)) {
                isImageSafe = false; unsafeCategoriesDetected.push('成人');
            }
            if (['LIKELY', 'VERY_LIKELY'].includes(safeSearch.violence)) {
                isImageSafe = false; unsafeCategoriesDetected.push('暴力');
            }
            if (['LIKELY', 'VERY_LIKELY'].includes(safeSearch.racy)) {
                isImageSafe = false; unsafeCategoriesDetected.push('煽情');
            }
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

        // --- 2. 如果圖片安全，則進行 Sharp 處理 ---
        const originalFilePath = file.path;

        // 使用從檔案讀取的 buffer 初始化 sharp
        let sharpInstance = sharp(imageBuffer)
            .rotate(); // 自動根據 EXIF 資訊旋轉圖片

        // 獲取旋轉後的 buffer 和元數據
        const rotatedBuffer = await sharpInstance.toBuffer({ resolveWithObject: true });
        const { data: processedBuffer, info } = rotatedBuffer;

        console.log(`[API /upload-safe-image] Metadata for ${file.originalname} (after auto-rotate): width=${info.width}, height=${info.height}`);

        const originalWidth = info.width;
        let targetWidth = originalWidth;
        let needsResize = false;

        // 根據寬度決定是否縮放
        if (originalWidth > 1500) { targetWidth = 1200; needsResize = true; }
        else if (originalWidth > 800) { targetWidth = 800; needsResize = true; }

        let finalBuffer = processedBuffer;

        if (needsResize) {
            console.log(`[API /upload-safe-image] Resizing image ${file.originalname} from ${originalWidth}px to ${targetWidth}px`);
            finalBuffer = await sharp(processedBuffer)
                .resize({ width: targetWidth, withoutEnlargement: true })
                .jpeg({ quality: 85, chromaSubsampling: '4:2:0' }) // 在縮放後統一轉為優化的JPG
                .toBuffer();
        } else {
            // 即使不縮放，也統一轉為優化的JPG，以確保格式和大小一致性
            finalBuffer = await sharp(processedBuffer)
                .jpeg({ quality: 90 })
                .toBuffer();
        }

        // 將最終處理過的 buffer 寫回原始檔案路徑
        await fs.promises.writeFile(originalFilePath, finalBuffer);

        const finalImageUrl = '/uploads/' + file.filename;
        console.log(`[API /upload-safe-image] Successfully processed and saved ${file.originalname}. URL: ${finalImageUrl}`);

        // 返回成功的回應
        res.json({ success: true, url: finalImageUrl });

    } catch (err) {
        console.error(`[API /upload-safe-image] Error processing file ${file.originalname}:`, err);
        // 確保在任何錯誤發生時都刪除已上傳的檔案
        if (file && file.path && fs.existsSync(file.path)) {
            try {
                fs.unlinkSync(file.path);
                console.warn(`[API /upload-safe-image] Cleaned up file due to error: ${file.path}`);
            } catch (cleanupErr) {
                console.error(`[API /upload-safe-image] Error cleaning up file ${file.path} after error:`, cleanupErr);
            }
        }

        // 處理 multer 自身的錯誤
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ success: false, error: `檔案超過限制大小。` });
            }
            return res.status(400).json({ success: false, error: `上傳錯誤: ${err.message}` });
        }

        // 處理其他錯誤
        return res.status(500).json({ success: false, error: '圖片上傳及處理過程中發生伺服器錯誤。' });
    }
});
// --- END OF PUBLIC SAFE IMAGE UPLOAD API ---



// --- Report Templates API ---
const reportTemplatesRouter = express.Router();



// 引入IP限制器
const reportRateLimiter = createReportRateLimiter(10);

// POST /api/reports - 新增報告模板
reportTemplatesRouter.post('/', optionalAuthenticateBoxUser, reportRateLimiter, async (req, res) => {
    const { title, html_content } = req.body;
    const creator_id = (req.boxUser && req.boxUser.user_id) ? req.boxUser.user_id.toString() : 'guest';
    const creatorIp = req.ip || 'unknown';
    const reportUUID = uuidv4();

    let finalTitle;
    if (!title || title.trim() === '') {
        // 無論是訪客還是登入用戶，都給一個預設標題
        const currentDate = new Date().toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        finalTitle = creator_id === 'guest'
            ? `訪客報告 - ${currentDate}`
            : `未命名報告 - ${currentDate}`;
    } else {
        finalTitle = title.trim();
    }
    if (typeof html_content !== 'string') {
        return res.status(400).json({ error: '報告內容為必填項且必須是字串。' });
    }

    // 根據用戶登入狀態決定內容大小限制
    const MAX_CONTENT_BYTES = creator_id !== 'guest' ? 100000 : 50000;
    const contentSizeBytes = Buffer.byteLength(html_content, 'utf8');
    if (contentSizeBytes > MAX_CONTENT_BYTES) {
        return res.status(413).json({
            error: '報告內容超過大小限制',
            detail: `最大允許 ${MAX_CONTENT_BYTES.toLocaleString()} 字節，當前 ${contentSizeBytes.toLocaleString()} 字節`,
        });
    }

    try {
        const query = `
            INSERT INTO report_templates (id, title, html_content, size_bytes, creator_ip, creator_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, title, created_at, size_bytes;
        `;
        const result = await pool.query(query, [
            reportUUID, finalTitle, html_content, contentSizeBytes, creatorIp, creator_id
        ]);
        console.log(`[API POST /api/reports] 新增報告成功，ID: ${result.rows[0].id}，創建者ID: ${creator_id}`);
        res.status(201).json({ success: true, ...result.rows[0] });
    } catch (err) {
        console.error('[API POST /api/reports] 新增報告時發生錯誤:', err);
        res.status(500).json({ error: '伺服器內部錯誤，無法儲存報告。' });
    }
});

// GET /api/reports/user/:userId - 獲取特定用戶的報告列表
reportTemplatesRouter.get('/user/:userId', authenticateBoxUser, async (req, res) => {
    const { userId } = req.params;
    if (req.boxUser.user_id.toString() !== userId) {
        return res.status(403).json({ error: '權限不足，無法訪問此資源。' });
    }
    try {
        const query = `
            SELECT id, title, created_at, updated_at, size_bytes 
            FROM report_templates 
            WHERE creator_id = $1 
            ORDER BY updated_at DESC;
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(`[API GET /api/reports/user/${userId}] 獲取報告列表時出錯:`, err);
        res.status(500).json({ error: '伺服器錯誤，無法獲取報告列表。' });
    }
});

// GET /api/reports/report/:id - 獲取單一報告的完整資訊 (用於編輯)
reportTemplatesRouter.get('/report/:id', authenticateBoxUser, async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT id, title, html_content, creator_id 
            FROM report_templates 
            WHERE id = $1;
        `;
        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到指定的報告。' });
        }
        const report = result.rows[0];
        if (report.creator_id !== req.boxUser.user_id.toString()) {
            return res.status(403).json({ error: '權限不足，無法編輯此報告。' });
        }
        res.json(report);
    } catch (err) {
        console.error(`[API GET /api/reports/report/${id}] 獲取報告詳情時出錯:`, err);
        res.status(500).json({ error: '伺服器錯誤，無法獲取報告。' });
    }
});

// PUT /api/reports/report/:id - 更新報告 (*** 新增的路由 ***)
reportTemplatesRouter.put('/report/:id', authenticateBoxUser, async (req, res) => {
    const { id } = req.params;
    const { title, html_content } = req.body;
    const userId = req.boxUser.user_id.toString();

    // 驗證
    if (!title || title.trim() === '') {
        return res.status(400).json({ error: '報告標題為必填項。' });
    }
    if (typeof html_content !== 'string') {
        return res.status(400).json({ error: '報告內容為必填項且必須是字串。' });
    }

    // 登入用戶的內容大小限制為 100KB
    const MAX_CONTENT_BYTES = 100000;
    const contentSizeBytes = Buffer.byteLength(html_content, 'utf8');
    if (contentSizeBytes > MAX_CONTENT_BYTES) {
        return res.status(413).json({
            error: '報告內容超過大小限制',
            detail: `最大允許 ${MAX_CONTENT_BYTES.toLocaleString()} 字節，當前 ${contentSizeBytes.toLocaleString()} 字節`,
        });
    }

    try {
        // 1. 檢查報告是否存在以及所有權
        const checkQuery = `SELECT creator_id FROM report_templates WHERE id = $1;`;
        const checkResult = await pool.query(checkQuery, [id]);

        if (checkResult.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的報告。' });
        }
        if (checkResult.rows[0].creator_id !== userId) {
            return res.status(403).json({ error: '權限不足，無法更新此報告。' });
        }

        // 2. 更新報告
        const updateQuery = `
            UPDATE report_templates
            SET title = $1, html_content = $2, size_bytes = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING id, title, updated_at, size_bytes;
        `;
        const result = await pool.query(updateQuery, [title.trim(), html_content, contentSizeBytes, id]);

        console.log(`[API PUT /api/reports/report/${id}] 報告已成功更新。`);
        res.status(200).json({ success: true, ...result.rows[0] });

    } catch (err) {
        console.error(`[API PUT /api/reports/report/${id}] 更新報告時出錯:`, err);
        res.status(500).json({ error: '伺服器錯誤，無法更新報告。' });
    }
});


// DELETE /api/reports/report/:id - 刪除報告
reportTemplatesRouter.delete('/report/:id', authenticateBoxUser, async (req, res) => {
    const { id } = req.params;
    try {
        const checkQuery = `SELECT creator_id FROM report_templates WHERE id = $1;`;
        const checkResult = await pool.query(checkQuery, [id]);
        if (checkResult.rowCount === 0) {
            return res.status(404).json({ error: '找不到要刪除的報告。' });
        }
        if (checkResult.rows[0].creator_id !== req.boxUser.user_id.toString()) {
            return res.status(403).json({ error: '權限不足，無法刪除此報告。' });
        }
        const deleteQuery = `DELETE FROM report_templates WHERE id = $1 RETURNING id;`;
        const deleteResult = await pool.query(deleteQuery, [id]);
        if (deleteResult.rowCount > 0) {
            console.log(`[API DELETE /api/reports/report/${id}] 報告已成功刪除。`);
            res.status(200).json({ success: true, id: deleteResult.rows[0].id });
        } else {
            res.status(404).json({ error: '刪除操作失敗，找不到報告。' });
        }
    } catch (err) {
        console.error(`[API DELETE /api/reports/report/${id}] 刪除報告時出錯:`, err);
        res.status(500).json({ error: '伺服器錯誤，無法刪除報告。' });
    }
});

// GET /api/reports/:id - 獲取單一報告內容 (用於公開查看，無須驗證)
reportTemplatesRouter.get('/:id', async (req, res) => {
    const { id } = req.params;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: '無效的報告 ID 格式。' });
    }
    try {
        const query = `SELECT html_content FROM report_templates WHERE id = $1;`;
        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到指定的報告。' });
        }
        res.json({ html_content: result.rows[0].html_content });
    } catch (err) {
        console.error(`[API GET /api/reports/${id}] 獲取單一報告時發生錯誤:`, err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取報告內容。' });
    }
});

// 將定義好的 Router 掛載到 Express App 上
app.use('/api/reports', reportTemplatesRouter);

// --- 結束 Report Templates API ---















// POST /api/admin/files/upload - 上傳檔案
app.post('/api/admin/files/upload', isAdminAuthenticated, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: '沒有上傳檔案或欄位名稱不符 (應為 "file")' });
    }
    const file = req.file;
    let fileToSave = { ...file }; // 複製一份檔案資訊
    const originalFilePath = fileToSave.path; // Multer 儲存的檔案路徑
    const fileUrlPath = '/uploads/' + fileToSave.filename; // Multer 產生的 URL 路徑

    let fileType = 'other';
    const originalFileExt = path.extname(fileToSave.originalname).toLowerCase(); // 獲取原始副檔名
    // 注意：fileToSave.mimetype 可能已被 Multer 修改，所以原始副檔名更可靠

    // 判斷是否為圖片 (PNG, JPG, JPEG)
    if (['.png', '.jpg', '.jpeg'].includes(originalFileExt)) {
        fileType = 'image';
        console.log(`[Admin Upload] 檔案 ${fileToSave.originalname} (${originalFileExt}) 被識別為圖片，準備處理。`);
        try {
            // 1. 讀取 Multer 儲存的檔案到 Buffer
            const imageBuffer = await fs.promises.readFile(originalFilePath);

            // 2. 使用 Sharp 載入 Buffer
            let sharpInstance = sharp(imageBuffer);

            // 3. 定義 JPEG 輸出選項 (您可以根據需求調整品質)
            const jpegOutputOptions = {
                quality: 80, // 例如，設定為 80
                chromaSubsampling: '4:2:0' // 可選的進一步壓縮
            };

            // 4. 強制轉換/重新壓縮
            // 無論原始是 PNG 還是 JPG，都統一處理成指定品質的 JPG
            // 這樣可以確保 Multer 偽裝的 JPG (實為PNG數據) 被正確轉換
            console.log(`[Admin Upload] 準備將 ${fileToSave.originalname} 轉換/重新壓縮為 JPG (品質: ${jpegOutputOptions.quality})。`);
            sharpInstance = sharpInstance.jpeg(jpegOutputOptions);

            // 5. 進行旋轉 (修正方向)
            sharpInstance = sharpInstance.rotate();

            // 6. 獲取處理後 (已是JPG格式並旋轉後) 的 Buffer，以便獲取正確的元數據
            const processedBufferBeforeResize = await sharpInstance.toBuffer();

            // 7. 從這個 Buffer 獲取元數據
            const metadata = await sharp(processedBufferBeforeResize).metadata();
            const currentWidth = metadata.width;
            let targetWidth = currentWidth;
            let needsResize = false;

            // 決定是否需要縮放
            if (currentWidth > 1500) {
                targetWidth = Math.round(currentWidth * 0.25);
                needsResize = true;
            } else if (currentWidth > 800) {
                targetWidth = Math.round(currentWidth * 0.50);
                needsResize = true;
            } else if (currentWidth > 500) {
                targetWidth = Math.round(currentWidth * 0.75);
                needsResize = true;
            }

            let finalBuffer;
            if (needsResize) {
                console.log(`[Admin Upload] 圖片 ${fileToSave.originalname} (處理後寬度: ${currentWidth}px) 需要縮放至 ${targetWidth}px。`);
                finalBuffer = await sharp(processedBufferBeforeResize) // 從已是JPG的Buffer開始縮放
                    .resize({ width: targetWidth, withoutEnlargement: true })
                    .toBuffer();
            } else {
                console.log(`[Admin Upload] 圖片 ${fileToSave.originalname} (處理後寬度: ${currentWidth}px) 無需縮放。`);
                finalBuffer = processedBufferBeforeResize; // 直接使用已轉換/壓縮/旋轉的 Buffer
            }

            // 8. 將最終的 Buffer 寫回 Multer 指定的原始路徑
            //    Multer 已經將 PNG 的副檔名改為 .jpg，所以 originalFilePath 副檔名是對的。
            await fs.promises.writeFile(originalFilePath, finalBuffer);

            // 更新 fileToSave 中的檔案大小資訊
            const newStats = fs.statSync(originalFilePath);
            fileToSave.size = newStats.size;
            fileToSave.mimetype = 'image/jpeg'; // 確保 mimetype 也是正確的 JPG

            console.log(`[Admin Upload] 圖片 ${fileToSave.originalname} 已成功處理為 JPG 並儲存。新路徑: ${originalFilePath}, 新大小: ${fileToSave.size} bytes`);

        } catch (sharpError) {
            console.error(`[Admin Upload] Sharp 處理圖片 ${fileToSave.originalname} 失敗:`, sharpError);
            try {
                if (fs.existsSync(originalFilePath)) {
                    fs.unlinkSync(originalFilePath);
                    console.warn(`[Admin Upload] 已刪除處理失敗的原始檔案: ${originalFilePath}`);
                }
            } catch (unlinkErr) {
                console.error(`[Admin Upload] 刪除處理失敗的原始檔案 ${originalFilePath} 時再次出錯:`, unlinkErr);
            }
            return res.status(500).json({ success: false, error: `圖片處理失敗: ${sharpError.message}` });
        }
    } else if (originalFileExt === '.gif' || (fileToSave.mimetype && fileToSave.mimetype.toLowerCase() === 'image/gif')) {
        fileType = 'image';
        console.log(`[Admin Upload] 檔案 ${fileToSave.originalname} 是 GIF，不進行轉換或縮放。`);
        // GIF 通常不建議轉換為 JPG，除非有特殊需求，因為會失去動畫。
        // 如果需要，也可以加入 Sharp 處理 GIF 的邏輯（例如優化或轉為靜態圖）。
    } else if (originalFileExt === '.pdf' || (fileToSave.mimetype && fileToSave.mimetype.toLowerCase() === 'application/pdf')) {
        fileType = 'pdf';
        console.log(`[Admin Upload] 檔案 ${fileToSave.originalname} 是 PDF，不進行圖片處理。`);
    } else if (['.webp', '.svg'].includes(originalFileExt) || (fileToSave.mimetype && (fileToSave.mimetype.toLowerCase() === 'image/webp' || fileToSave.mimetype.toLowerCase() === 'image/svg+xml'))) {
        fileType = 'image';
        console.log(`[Admin Upload] 檔案 ${fileToSave.originalname} 是 ${originalFileExt}，不進行特定轉換或縮放 (除非您添加針對性處理)。`);
        // WebP 和 SVG 的處理可以根據需求添加。SVG通常不需要柵格化壓縮。WebP本身壓縮效率很高。
    } else {
        fileType = 'other';
        console.log(`[Admin Upload] 檔案 ${fileToSave.originalname} 是其他類型 (${fileToSave.mimetype || originalFileExt})，不進行圖片處理。`);
    }

    // --- 資料庫儲存邏輯 (保持不變) ---
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
        console.log(`[Admin Upload] 檔案 ${fileToSave.originalname} (處理後) 上傳成功並記錄到資料庫 ID: ${insertResult.rows[0].id}`);
        res.status(201).json({ success: true, file: insertResult.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Admin Upload] Error inserting file record:', err);
        const fullDiskPathToClean = path.join(uploadDir, fileToSave.filename);
        try {
            if (fs.existsSync(fullDiskPathToClean)) {
                fs.unlinkSync(fullDiskPathToClean);
                console.warn(`[Admin Upload] 因資料庫儲存失敗，已刪除磁碟上的檔案: ${fullDiskPathToClean}`);
            }
        } catch (unlinkErr) {
            console.error(`[Admin Upload] 因資料庫儲存失敗後，嘗試刪除磁碟檔案 ${fullDiskPathToClean} 時再次出錯:`, unlinkErr);
        }
        res.status(500).json({ success: false, error: '儲存檔案記錄到資料庫失敗', detail: err.message });
    } finally {
        client.release();
    }
});



// --- 新增：專用於 PNG/GIF 直接上傳的 API 端點 ---
app.post('/api/admin/files/upload-image-direct', isAdminAuthenticated, directImageUpload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: '沒有上傳檔案或欄位名稱不符 (應為 "file")' });
    }

    const file = { ...req.file };
    const originalFilePath = file.path;
    const fileUrlPath = '/uploads/' + file.filename;
    const fileType = 'image'; // 此路由固定為 image 類型

    try {
        const imageBuffer = await fs.promises.readFile(originalFilePath);

        // 使用 sharp 處理圖片，animated: true 確保 GIF 動畫能被處理
        let sharpInstance = sharp(imageBuffer, { animated: true }).rotate(); // 自動旋轉

        const metadata = await sharpInstance.metadata();
        const currentWidth = metadata.width;
        let targetWidth = currentWidth;
        let needsResize = false;

        // 與主要上傳器相同的縮放邏輯
        if (currentWidth > 1500) {
            targetWidth = Math.round(currentWidth * 0.25);
            needsResize = true;
        } else if (currentWidth > 800) {
            targetWidth = Math.round(currentWidth * 0.50);
            needsResize = true;
        } else if (currentWidth > 500) {
            targetWidth = Math.round(currentWidth * 0.75);
            needsResize = true;
        }

        let finalBuffer;
        if (needsResize) {
            console.log(`[Direct Upload] 正在縮放圖片 ${file.originalname} 從 ${currentWidth}px 到 ${targetWidth}px.`);
            // 縮放並保留原始格式 (PNG/GIF)
            finalBuffer = await sharpInstance.resize({ width: targetWidth, withoutEnlargement: true }).toBuffer();
        } else {
            console.log(`[Direct Upload] 圖片 ${file.originalname} (寬度: ${currentWidth}px) 無需縮放.`);
            finalBuffer = imageBuffer; // 如果不需縮放，直接使用原始 buffer
        }

        // 將處理後的 buffer 寫回檔案
        await fs.promises.writeFile(originalFilePath, finalBuffer);

        // 更新檔案大小資訊
        const newStats = await fs.promises.stat(originalFilePath);
        file.size = newStats.size;

        // 將檔案資訊存入資料庫
        const client = await pool.connect();
        try {
            const insertResult = await client.query(
                `INSERT INTO uploaded_files (file_path, original_filename, mimetype, size_bytes, file_type)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, file_path, original_filename, mimetype, size_bytes, file_type, uploaded_at`,
                [fileUrlPath, file.originalname, file.mimetype, file.size, fileType]
            );
            console.log(`[Direct Upload] 檔案 ${file.originalname} 已成功上傳並記錄到資料庫，ID: ${insertResult.rows[0].id}`);
            res.status(201).json({ success: true, file: insertResult.rows[0] });
        } catch (dbError) {
            console.error('[Direct Upload] 資料庫寫入錯誤:', dbError);
            throw dbError; // 拋出錯誤由外層 catch 處理
        } finally {
            client.release();
        }

    } catch (error) {
        console.error(`[Direct Upload] 處理檔案 ${file.originalname} 時發生錯誤:`, error);
        // 如果過程中發生任何錯誤，刪除已上傳的暫存檔案
        if (fs.existsSync(originalFilePath)) {
            try {
                fs.unlinkSync(originalFilePath);
                console.warn(`[Direct Upload] 已刪除處理失敗的檔案: ${originalFilePath}`);
            } catch (unlinkErr) {
                console.error(`[Direct Upload] 刪除失敗檔案 ${originalFilePath} 時再次出錯:`, unlinkErr);
            }
        }
        res.status(500).json({ success: false, error: `處理檔案失敗: ${error.message}` });
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



// ===============================================
// Unit Editor/Viewer Database API
// ===============================================

// GET /api/units/all - 讀取所有元件和放置資料
app.get('/api/units/all', async (req, res) => {
    const client = await pool.connect();
    try {
        // 1. 獲取所有元件資料，並透過 JOIN 合併相關表格
        const componentsQuery = `
            SELECT
                c.id, c.name, c.type, c.width, c.height, c.category, c.subcategory, c.scale, c.display_scale, c.anchor, c.spritesheet_url, c.created_at,
                s.source_rect_x, s.source_rect_y, s.source_rect_w, s.source_rect_h,
                a.speed, a.loop,
                f.id as frame_id, f.frame_index, f.source_rect_x as frame_x, f.source_rect_y as frame_y, f.source_rect_w as frame_w, f.source_rect_h as frame_h
            FROM
                unit_components c
            LEFT JOIN
                unit_static_components s ON c.id = s.component_id
            LEFT JOIN
                unit_animations a ON c.id = a.component_id
            LEFT JOIN
                unit_animation_frames f ON a.component_id = f.animation_id
            ORDER BY
                c.created_at DESC, c.id, f.frame_index;
        `;
        const componentsResult = await client.query(componentsQuery);

        // 2. 處理查詢結果，將扁平的資料重新組合成前端所需的巢狀結構
        const componentsMap = new Map();
        for (const row of componentsResult.rows) {
            if (!componentsMap.has(row.id)) {
                const component = {
                    id: row.id,
                    name: row.name,
                    type: row.type,
                    width: row.width,
                    height: row.height,
                    category: row.category,
                    subcategory: row.subcategory,
                    scale: row.scale,
                    displayScale: row.display_scale,
                    anchor: row.anchor,
                    createdAt: row.created_at,
                };

                if (row.type === 'static') {
                    component.spritesheetUrl = row.spritesheet_url;
                    component.sourceRect = {
                        x: row.source_rect_x,
                        y: row.source_rect_y,
                        w: row.source_rect_w,
                        h: row.source_rect_h,
                    };
                } else if (row.type === 'animation') {
                    component.animation = {
                        spritesheetUrl: row.spritesheet_url,
                        speed: row.speed,
                        loop: row.loop,
                        frames: [],
                    };
                }
                componentsMap.set(row.id, component);
            }

            if (row.type === 'animation' && row.frame_id) {
                const component = componentsMap.get(row.id);
                component.animation.frames.push({
                    x: row.frame_x,
                    y: row.frame_y,
                    w: row.frame_w,
                    h: row.frame_h,
                });
            }
        }

        const savedComponents = Array.from(componentsMap.values());

        // 3. 獲取所有放置的元件資料
        const placedResult = await client.query('SELECT * FROM unit_placed_components ORDER BY z_index');

        // 4. 將 component_id (資料庫 ID) 轉換回 savedComponents 的索引
        //    這是為了與前端舊有的邏輯相容
        const componentIdToIndexMap = new Map();
        savedComponents.forEach((comp, index) => {
            componentIdToIndexMap.set(comp.id, index);
        });

        const placedComponents = placedResult.rows.map(p => ({
            id: p.id,
            componentId: componentIdToIndexMap.get(p.component_id),
            width: p.width, // 注意：寬高可能需要從原元件獲取，此處暫用DB值
            height: p.height,
            positionX: p.position_x,
            positionY: p.position_y,
            gridX: p.grid_x,
            gridY: p.grid_y,
            zIndex: p.z_index,
            isDragging: false,
        })).filter(p => p.componentId !== undefined);


        res.json({
            savedComponents: savedComponents,
            placedComponents: placedComponents,
        });

    } catch (error) {
        console.error('[API Get All Units] Error fetching units data:', error);
        res.status(500).json({ error: 'Failed to fetch units data' });
    } finally {
        client.release();
    }
});

// POST /api/units/all - 儲存所有元件和放置資料 (採用完全取代策略)
app.post('/api/units/all', async (req, res) => {
    const { savedComponents, placedComponents } = req.body;

    if (!Array.isArray(savedComponents) || !Array.isArray(placedComponents)) {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 清空所有相關表格
        await client.query('DELETE FROM unit_placed_components;');
        await client.query('DELETE FROM unit_animation_frames;');
        await client.query('DELETE FROM unit_animations;');
        await client.query('DELETE FROM unit_static_components;');
        await client.query('DELETE FROM unit_components;');

        const componentIndexToIdMap = new Map();

        // 2. 重新插入所有元件
        for (const [index, component] of savedComponents.entries()) {
            // All component types have a top-level spritesheetUrl
            const spritesheetUrl = component.spritesheetUrl || (component.animation ? component.animation.spritesheetUrl : null);

            const compRes = await client.query(
                `INSERT INTO unit_components (name, type, width, height, category, subcategory, scale, display_scale, anchor, spritesheet_url, file_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
                [
                    component.name,
                    component.type,
                    component.width,
                    component.height,
                    component.category,
                    component.subcategory || '',
                    component.scale,
                    component.displayScale,
                    component.anchor,
                    spritesheetUrl,
                    component.fileType || 'png' // Add file_type, default to 'png'
                ]
            );
            const newComponentId = compRes.rows[0].id;
            componentIndexToIdMap.set(index, newComponentId);

            // For 'static' type, also insert into the static components table, but NOT for GIFs
            if (component.type === 'static' && component.fileType !== 'gif') {
                if (!component.sourceRect) {
                    console.warn(`[API Save All Units] Static component without sourceRect, skipping insert into unit_static_components. Component:`, component);
                } else {
                    await client.query(
                        `INSERT INTO unit_static_components (component_id, source_rect_x, source_rect_y, source_rect_w, source_rect_h)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [newComponentId, component.sourceRect.x, component.sourceRect.y, component.sourceRect.w, component.sourceRect.h]
                    );
                }
            } else if (component.type === 'animation') {
                // For 'animation' type, insert animation-specific data
                await client.query(
                    `INSERT INTO unit_animations (component_id, speed, loop) VALUES ($1, $2, $3)`,
                    [newComponentId, component.animation.speed, component.animation.loop]
                );
                for (const [frameIndex, frame] of component.animation.frames.entries()) {
                    await client.query(
                        `INSERT INTO unit_animation_frames (animation_id, frame_index, source_rect_x, source_rect_y, source_rect_w, source_rect_h)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [newComponentId, frameIndex, frame.x, frame.y, frame.w, frame.h]
                    );
                }
            }
        }

        // 3. 重新插入所有放置的元件
        for (const pComponent of placedComponents) {
            const dbComponentId = componentIndexToIdMap.get(pComponent.componentId);
            if (dbComponentId) {
                await client.query(
                    `INSERT INTO unit_placed_components (id, component_id, width, height, position_x, position_y, grid_x, grid_y, z_index)
                     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
                    [dbComponentId, pComponent.width, pComponent.height, pComponent.positionX, pComponent.positionY, pComponent.gridX, pComponent.gridY, pComponent.zIndex]
                );
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: 'All units saved successfully.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[API Save All Units] Error saving units data:', error);
        res.status(500).json({ error: 'Failed to save units data' });
    } finally {
        client.release();
    }
});




// ===== 地圖模板 API 路由 =====

// 獲取所有地圖模板
app.get('/api/map-templates', authenticateBoxUser, async (req, res) => {
    try {
        const query = `
        SELECT id, name, description, grid_cols, grid_rows, created_at, updated_at
        FROM unit_map_templates
        ORDER BY updated_at DESC
      `;

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('獲取地圖模板列表失敗:', error);
        res.status(500).json({ error: '獲取地圖模板列表失敗', details: error.message });
    }
});

// 獲取特定地圖模板的詳細資訊
app.get('/api/map-templates/:id', authenticateBoxUser, async (req, res) => {
    try {
        const templateId = req.params.id;

        // 獲取模板基本信息
        const templateQuery = `
        SELECT id, name, description, grid_cols, grid_rows, created_at, updated_at
        FROM unit_map_templates
        WHERE id = $1
      `;

        const templateResult = await pool.query(templateQuery, [templateId]);

        if (templateResult.rows.length === 0) {
            return res.status(404).json({ error: '找不到指定的模板' });
        }

        const template = templateResult.rows[0];

        // 獲取模板的區域
        const areasQuery = `
        SELECT a.id, a.name, a.color, a.show_name
        FROM unit_map_areas a
        WHERE a.template_id = $1
      `;

        const areasResult = await pool.query(areasQuery, [templateId]);
        template.areas = [];

        // 獲取每個區域的單元格
        for (const area of areasResult.rows) {
            const cellsQuery = `
          SELECT cell_index
          FROM unit_map_area_cells
          WHERE area_id = $1
        `;

            const cellsResult = await pool.query(cellsQuery, [area.id]);
            area.cells = cellsResult.rows.map(row => row.cell_index);
            template.areas.push(area);
        }

        // 獲取模板的元件
        const componentsQuery = `
        SELECT component_id, position_x, position_y, grid_x, grid_y, z_index
        FROM unit_map_components
        WHERE template_id = $1
      `;

        const componentsResult = await pool.query(componentsQuery, [templateId]);
        template.components = componentsResult.rows;

        res.json(template);
    } catch (error) {
        console.error('獲取地圖模板詳情失敗:', error);
        res.status(500).json({ error: '獲取地圖模板詳情失敗', details: error.message });
    }
});

// 創建新的地圖模板
app.post('/api/map-templates', authenticateBoxUser, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { name, description, grid_cols, grid_rows, areas, components } = req.body;
        const userId = req.user.id;

        // 檢查是否已存在同名模板
        const checkQuery = 'SELECT id FROM unit_map_templates WHERE name = $1';
        const checkResult = await client.query(checkQuery, [name]);

        let templateId;

        if (checkResult.rows.length > 0) {
            // 更新現有模板
            templateId = checkResult.rows[0].id;

            const updateQuery = `
          UPDATE unit_map_templates
          SET description = $1, grid_cols = $2, grid_rows = $3, updated_at = NOW()
          WHERE id = $4
          RETURNING id
        `;

            await client.query(updateQuery, [description, grid_cols, grid_rows, templateId]);

            // 刪除現有的區域和元件，以便重新創建
            await client.query('DELETE FROM unit_map_areas WHERE template_id = $1', [templateId]);
            await client.query('DELETE FROM unit_map_components WHERE template_id = $1', [templateId]);
        } else {
            // 創建新模板
            const insertQuery = `
          INSERT INTO unit_map_templates (name, description, grid_cols, grid_rows, created_by)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `;

            const result = await client.query(insertQuery, [name, description, grid_cols, grid_rows, userId]);
            templateId = result.rows[0].id;
        }

        // 添加區域
        if (areas && areas.length > 0) {
            for (const area of areas) {
                // 插入區域
                const areaQuery = `
            INSERT INTO unit_map_areas (template_id, name, color, show_name)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `;

                const areaResult = await client.query(areaQuery, [
                    templateId,
                    area.name,
                    area.color,
                    area.show_name || false
                ]);

                const areaId = areaResult.rows[0].id;

                // 插入區域單元格
                if (area.cells && area.cells.length > 0) {
                    for (const cellIndex of area.cells) {
                        const cellQuery = `
                INSERT INTO unit_map_area_cells (area_id, cell_index)
                VALUES ($1, $2)
              `;

                        await client.query(cellQuery, [areaId, cellIndex]);
                    }
                }
            }
        }

        // 添加元件
        if (components && components.length > 0) {
            for (const component of components) {
                const componentQuery = `
            INSERT INTO unit_map_components (
              template_id, component_id, position_x, position_y, grid_x, grid_y, z_index
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `;

                await client.query(componentQuery, [
                    templateId,
                    component.component_id,
                    component.position_x || 0,
                    component.position_y || 0,
                    component.grid_x || 0,
                    component.grid_y || 0,
                    component.z_index || 0
                ]);
            }
        }

        await client.query('COMMIT');

        res.status(201).json({
            id: templateId,
            name,
            message: '地圖模板已保存'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('保存地圖模板失敗:', error);
        res.status(500).json({ error: '保存地圖模板失敗', details: error.message });
    } finally {
        client.release();
    }
});

// 刪除地圖模板
app.delete('/api/map-templates/:id', authenticateBoxUser, async (req, res) => {
    try {
        const templateId = req.params.id;

        // 檢查模板是否存在
        const checkQuery = 'SELECT id FROM unit_map_templates WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [templateId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: '找不到指定的模板' });
        }

        // 刪除模板 (因為設置了 ON DELETE CASCADE，相關的區域和元件會自動刪除)
        const deleteQuery = 'DELETE FROM unit_map_templates WHERE id = $1';
        await pool.query(deleteQuery, [templateId]);

        res.json({ message: '地圖模板已刪除' });
    } catch (error) {
        console.error('刪除地圖模板失敗:', error);
        res.status(500).json({ error: '刪除地圖模板失敗', details: error.message });
    }
});



// ===============================================
// 新增 API: 記錄商品點擊事件 pool.query
// ===============================================
app.post('/api/product-clicks', async (req, res) => {
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).json({ error: '需要提供商品 ID' });
    }

    try {
        // 將點擊事件記錄到 product_click_events 表
        const result = await pool.query( // Changed db.query to pool.query
            'INSERT INTO product_click_events (product_id) VALUES ($1) RETURNING *',
            [productId]
        );
        // console.log('Product click recorded:', result.rows[0]); // 可選：用於偵錯
        res.status(201).json({ message: '點擊記錄成功', clickEvent: result.rows[0] });

    } catch (error) {
        console.error('記錄商品點擊失敗:', error);
        res.status(500).json({ error: '記錄商品點擊時發生錯誤' });
    }
});

// ===============================================
// 新增 API: 提供商品點擊統計數據
// 建議放在處理 analytics 或 admin API 的區塊
// 可能需要管理員權限認證 (isAdminAuthenticated)
// ===============================================
// 使用你現有的 isAdminAuthenticated 中介軟體來保護這個路由
app.get('/api/analytics/product-clicks-by-date', async (req, res) => {
    const { startDate, endDate, granularity, productId } = req.query;

    // 日期和粒度驗證
    if (!startDate || !endDate) {
        return res.status(400).json({ error: '需要提供開始日期和結束日期' });
    }
    if (granularity !== 'daily' && granularity !== 'monthly') {
        return res.status(400).json({ error: '粒度參數無效，請使用 "daily" 或 "monthly"' });
    }

    let dateFormat, groupByClause;
    if (granularity === 'daily') {
        dateFormat = 'YYYY-MM-DD';
        groupByClause = "date_trunc('day', clicked_at)";
    } else {
        dateFormat = 'YYYY-MM';
        groupByClause = "date_trunc('month', clicked_at)";
    }

    // 構建查詢和參數
    let query = `
        SELECT
            to_char(${groupByClause}, '${dateFormat}') AS period,
            COUNT(*) AS total_clicks,
            p.name AS product_name
        FROM
            product_click_events pce
        JOIN
            products p ON pce.product_id = p.id
        WHERE
            clicked_at >= $1 AND clicked_at < ($2::date + INTERVAL '1 day')
    `;

    const queryParams = [startDate, endDate];
    let paramIndex = 3; // Start from 3 since $1 and $2 are used

    if (productId) {
        query += ` AND pce.product_id = $${paramIndex}`; // <<--- 直接使用 paramIndex
        queryParams.push(productId);
        paramIndex++; // <<--- 在這裡遞增以備將來可能的更多參數
    }

    query += `
        GROUP BY ${groupByClause}, p.name
        ORDER BY ${groupByClause}, p.name
    `;

    try {
        const result = await pool.query(query, queryParams);
        const formattedData = result.rows.map(row => ({
            [granularity === 'daily' ? 'date' : 'month']: row.period,
            clicks: parseInt(row.total_clicks, 10),
            product_name: row.product_name
        }));
        res.json(formattedData);
    } catch (error) {
        console.error('獲取商品點擊統計失敗:', error);
        res.status(500).json({ error: '獲取商品點擊統計時發生錯誤' });
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
app.post('/api/samegame/templates', async (req, res) => {
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
app.put('/api/samegame/templates/:id', async (req, res) => {
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
app.delete('/api/samegame/templates/:id', async (req, res) => {
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
app.post('/api/samegame/templates/:templateId/levels', async (req, res) => {
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
app.put('/api/samegame/levels/:id', async (req, res) => {
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
app.delete('/api/samegame/levels/:id', async (req, res) => {
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
            try { templateData.cell_data = JSON.parse(templateData.cell_data); } catch (e) { templateData.cell_data = []; }
        } else if (!templateData.cell_data) {
            templateData.cell_data = [];
        }
        // ★ 確保 style_data 是物件 (如果 DB 是 NULL 或解析失敗) ★
        if (templateData.style_data && typeof templateData.style_data === 'string') {
            try { templateData.style_data = JSON.parse(templateData.style_data); } catch (e) { templateData.style_data = {}; }
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
    } catch (e) { return res.status(400).json({ error: 'Invalid style_data JSON format' }); }


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
    } catch (e) { return res.status(400).json({ error: 'Invalid style_data JSON format' }); }

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
 
// 在開發環境中重定向 /uploads 到生產環境
if (process.env.NODE_ENV !== 'production') {
    app.use('/uploads', (req, res) => {
        const targetUrl = `https://sunnyyummy.onrender.com/uploads${req.url}`;
        res.redirect(targetUrl);
    });
} else {
    app.use('/uploads', express.static(uploadDir));
    console.log(`設定靜態檔案服務: /uploads 將映射到 ${uploadDir}`);
}
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














// --- 遊戲管理 API (將此代碼添加到 server.js) ---

// GET /api/games - 獲取前端遊戲列表
app.get('/api/games', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, description, image_url, play_url, play_count 
             FROM games 
             WHERE is_active = TRUE 
             ORDER BY sort_order ASC, id ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('獲取遊戲列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// POST /api/games/:id/play - 增加遊戲遊玩次數
app.post('/api/games/:id/play', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的遊戲 ID 格式。' });
    }
    try {
        // 增加遊戲遊玩計數
        const result = await pool.query(
            'UPDATE games SET play_count = play_count + 1 WHERE id = $1 RETURNING play_count',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要計數的遊戲。' });
        }

        // 記錄遊戲遊玩日誌
        const ip_address = req.ip || 'unknown';
        await pool.query(
            'INSERT INTO game_play_logs (game_id, ip_address, play_date) VALUES ($1, $2, NOW())',
            [id, ip_address]
        );

        res.status(200).json({ play_count: result.rows[0].play_count });
    } catch (err) {
        console.error(`處理遊戲 ID ${id} 遊玩計數時出錯:`, err);
        // 靜默處理錯誤，不要阻止使用者繼續遊玩
        res.status(204).send();
    }
});








// GET /api/guestbook - 獲取留言列表 (分頁, 最新活動排序)
app.get('/api/guestbook', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sort = req.query.sort || 'latest'; // 預設最新活動

    let orderByClause = 'ORDER BY m.last_activity_at DESC'; // 預設
    if (sort === 'popular') {
        orderByClause = 'ORDER BY m.view_count DESC, m.last_activity_at DESC';
    } else if (sort === 'most_replies') {
        orderByClause = 'ORDER BY m.reply_count DESC, m.last_activity_at DESC';
    }

    try {
        // 1. 獲取總留言數
        const totalResult = await pool.query('SELECT COUNT(*) FROM guestbook_messages WHERE is_visible = TRUE');
        const totalItems = parseInt(totalResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limit);

        // 2. 獲取當前頁面的留言 (加入 like_count, view_count, 限制 content preview)
        const messagesResult = await pool.query(
            `SELECT
                m.id,
                m.author_name,
                substring(m.content for 80) || (CASE WHEN length(m.content) > 80 THEN '...' ELSE '' END) AS content_preview,
                m.reply_count,
                m.view_count,
                m.like_count,
                m.last_activity_at,
                m.is_admin_post,
                (m.edit_password IS NOT NULL) AS has_edit_password,
                m.image_url,
                m.is_reported,      -- 新增
                m.can_be_reported   -- 新增
             FROM guestbook_messages m
             WHERE m.is_visible = TRUE  -- 公開API暫時只獲取 is_visible = TRUE 的
                                        -- 前端可以根據 is_reported 決定是否渲染或如何提示
             ${orderByClause}
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        res.json({
            messages: messagesResult.rows, // 現在 messages 陣列中的每個物件會多一個 is_admin_post 屬性
            currentPage: page,
            totalPages: totalPages,
            totalItems: totalItems,
            limit: limit,
            sort: sort
        });
    } catch (err) {
        console.error('[API GET /guestbook] Error:', err);
        res.status(500).json({ error: '無法獲取留言列表' });
    }
});

// GET /api/guestbook/message/:id - 獲取單一留言詳情及回覆
app.get('/api/guestbook/message/:id', async (req, res) => {
    const { id } = req.params;
    const messageId = parseInt(id, 10);
    if (isNaN(messageId)) return res.status(400).json({ error: '無效的留言 ID' });

    const client = await pool.connect();
    try {
        // 1. 獲取主留言 (加入 view_count, like_count, has_edit_password, image_url, is_reported, can_be_reported)
        const messageResult = await client.query(
            `SELECT id, author_name, content, reply_count, view_count, like_count, created_at, last_activity_at,
                    is_admin_post, (edit_password IS NOT NULL) AS has_edit_password, image_url,
                    is_reported, can_be_reported
             FROM guestbook_messages
             WHERE id = $1 AND is_visible = TRUE`,
            [messageId]
        );
        if (messageResult.rowCount === 0) return res.status(404).json({ error: '找不到或無法查看此留言' });
        const message = messageResult.rows[0];

        // 2. 獲取回覆 (加入 like_count, parent_reply_id)
        const repliesResult = await client.query(
            `SELECT
                r.id, r.message_id, r.parent_reply_id, -- 需要 parent_reply_id 用於前端嵌套
                r.author_name, r.content, r.created_at,
                r.is_admin_reply, r.like_count, (r.edit_password IS NOT NULL) AS has_edit_password, r.image_url,
                r.is_reported,      -- 新增
                r.can_be_reported,  -- 新增
                ai.name AS admin_identity_name
             FROM guestbook_replies r
             LEFT JOIN admin_identities ai ON r.admin_identity_id = ai.id
             WHERE r.message_id = $1 AND r.is_visible = TRUE -- 公開API暫時只獲取 is_visible = TRUE 的
             ORDER BY r.created_at ASC`,
            [messageId]
        );

        res.json({
            message: message,
            replies: repliesResult.rows
        });
    } catch (err) { console.error(`[API GET /guestbook/message/${id}] Error:`, err); res.status(500).json({ error: '無法獲取留言詳情' }); } finally { client.release(); }
});

// POST /api/guestbook - 新增主留言
app.post('/api/guestbook', async (req, res) => {
    const { author_name, content, edit_password, image_url } = req.body; // 新增 image_url

    let authorNameToSave = '匿名';
    if (author_name && author_name.trim() !== '') { authorNameToSave = author_name.trim().substring(0, 100); }
    if (!content || content.trim() === '') return res.status(400).json({ error: '留言內容不能為空' });
    const trimmedContent = content.trim();
    const editPasswordToSave = edit_password && edit_password.trim() !== '' ? edit_password.trim() : null; // 處理 edit_password
    const imageUrlToSave = image_url && image_url.trim() !== '' ? image_url.trim() : null; // 處理 image_url

    try {
        const result = await pool.query(
            `INSERT INTO guestbook_messages (author_name, content, edit_password, image_url, last_activity_at, is_visible, like_count, view_count)
             VALUES ($1, $2, $3, $4, NOW(), TRUE, 0, 0)
             RETURNING id, author_name, substring(content for 80) || (CASE WHEN length(content) > 80 THEN '...' ELSE '' END) AS content_preview, reply_count, last_activity_at, like_count, view_count, (edit_password IS NOT NULL) AS has_edit_password, image_url`,
            [authorNameToSave, trimmedContent, editPasswordToSave, imageUrlToSave] // 新增 imageUrlToSave
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { console.error('[API POST /guestbook] Error:', err); res.status(500).json({ error: '無法新增留言' }); }
});

// POST /api/guestbook/replies - 新增公開回覆
app.post('/api/guestbook/replies', async (req, res) => {
    const { message_id, parent_reply_id, author_name, content, edit_password, image_url } = req.body; // 新增 image_url
    const messageIdInt = parseInt(message_id, 10);
    const parentIdInt = parent_reply_id ? parseInt(parent_reply_id, 10) : null;

    if (isNaN(messageIdInt) || (parentIdInt !== null && isNaN(parentIdInt))) return res.status(400).json({ error: '無效的留言或父回覆 ID' });

    let authorNameToSave = '匿名';
    if (author_name && author_name.trim() !== '') { authorNameToSave = author_name.trim().substring(0, 100); }
    if (!content || content.trim() === '') return res.status(400).json({ error: '回覆內容不能為空' });
    const trimmedContent = content.trim();
    const editPasswordToSave = edit_password && edit_password.trim() !== '' ? edit_password.trim() : null; // 處理 edit_password
    const imageUrlToSave = image_url && image_url.trim() !== '' ? image_url.trim() : null; // 處理 image_url

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const replyResult = await client.query(
            `INSERT INTO guestbook_replies (message_id, parent_reply_id, author_name, content, edit_password, image_url, is_admin_reply, admin_identity_id, is_visible, like_count)
             VALUES ($1, $2, $3, $4, $5, $6, FALSE, NULL, TRUE, 0)
             RETURNING id, message_id, parent_reply_id, author_name, content, created_at, is_admin_reply, like_count, (edit_password IS NOT NULL) AS has_edit_password, image_url`,
            [messageIdInt, parentIdInt, authorNameToSave, trimmedContent, editPasswordToSave, imageUrlToSave] // 新增 imageUrlToSave
        );
        await client.query('COMMIT');
        res.status(201).json(replyResult.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[API POST /guestbook/replies] Error:', err);
        if (err.code === '23503') {
            return res.status(404).json({ error: '找不到要回覆的留言或父回覆。' });
        }
        res.status(500).json({ error: '無法新增回覆' });
    } finally {
        client.release();
    }
});


// POST /api/guestbook/message/:id/view - 增加瀏覽數
app.post('/api/guestbook/message/:id/view', async (req, res) => {
    const { id } = req.params;
    const messageId = parseInt(id, 10);
    if (isNaN(messageId)) return res.status(400).json({ error: '無效的留言 ID' });

    try {
        await pool.query(
            'UPDATE guestbook_messages SET view_count = view_count + 1 WHERE id = $1',
            [messageId]
        );
        res.status(204).send(); // No Content
    } catch (err) {
        console.error(`[API POST /guestbook/message/${id}/view] Error:`, err);
        res.status(204).send();
    }
});


// POST /api/guestbook/message/:id/like - 增加主留言讚數
app.post('/api/guestbook/message/:id/like', async (req, res) => {
    const { id } = req.params;
    const messageId = parseInt(id, 10);
    if (isNaN(messageId)) return res.status(400).json({ error: '無效的留言 ID' });

    try {
        const result = await pool.query(
            'UPDATE guestbook_messages SET like_count = like_count + 1 WHERE id = $1 RETURNING like_count',
            [messageId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: '找不到要按讚的留言' });
        res.status(200).json({ like_count: result.rows[0].like_count });
    } catch (err) {
        console.error(`[API POST /guestbook/message/${id}/like] Error:`, err);
        res.status(500).json({ error: '按讚失敗' });
    }
});


// POST /api/guestbook/replies/:id/like - 增加回覆讚數
app.post('/api/guestbook/replies/:id/like', async (req, res) => {
    const { id } = req.params;
    const replyId = parseInt(id, 10);
    if (isNaN(replyId)) return res.status(400).json({ error: '無效的回覆 ID' });

    try {
        const result = await pool.query(
            'UPDATE guestbook_replies SET like_count = like_count + 1 WHERE id = $1 RETURNING like_count',
            [replyId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: '找不到要按讚的回覆' });
        res.status(200).json({ like_count: result.rows[0].like_count });
    } catch (err) {
        console.error(`[API POST /guestbook/replies/${id}/like] Error:`, err);
        res.status(500).json({ error: '按讚失敗' });
    }
});

// POST /api/guestbook/message/:id/verify-password - 驗證主留言編輯密碼
app.post('/api/guestbook/message/:id/verify-password', async (req, res) => {
    const { id } = req.params;
    const { edit_password } = req.body;
    const messageId = parseInt(id, 10);

    if (isNaN(messageId)) return res.status(400).json({ error: '無效的留言 ID' });
    if (!edit_password) return res.status(400).json({ error: '請提供編輯密碼' });

    try {
        const result = await pool.query(
            'SELECT edit_password FROM guestbook_messages WHERE id = $1 AND is_visible = TRUE',
            [messageId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: '找不到留言或留言不可編輯' });

        const storedPassword = result.rows[0].edit_password;
        if (storedPassword === null) return res.status(403).json({ verified: false, error: '此留言未設定編輯密碼，無法編輯。' });
        if (storedPassword === edit_password) {
            res.json({ verified: true });
        } else {
            res.status(401).json({ verified: false, error: '編輯密碼錯誤。' });
        }
    } catch (err) {
        console.error(`[API POST /guestbook/message/${id}/verify-password] Error:`, err);
        res.status(500).json({ error: '密碼驗證失敗' });
    }
});

// PUT /api/guestbook/message/:id/content - 更新主留言內容
app.put('/api/guestbook/message/:id/content', async (req, res) => {
    const { id } = req.params;
    const { content, edit_password } = req.body;
    const messageId = parseInt(id, 10);

    if (isNaN(messageId)) return res.status(400).json({ error: '無效的留言 ID' });
    if (!content || content.trim() === '') return res.status(400).json({ error: '留言內容不能為空' });
    if (!edit_password) return res.status(400).json({ error: '請提供編輯密碼以進行更新' });

    const trimmedContent = content.trim();

    try {
        // 再次驗證密碼
        const passResult = await pool.query(
            'SELECT edit_password FROM guestbook_messages WHERE id = $1 AND is_visible = TRUE',
            [messageId]
        );
        if (passResult.rowCount === 0) return res.status(404).json({ error: '找不到留言或留言不可編輯' });
        const storedPassword = passResult.rows[0].edit_password;
        if (storedPassword === null) return res.status(403).json({ error: '此留言未設定編輯密碼，無法編輯。' });
        if (storedPassword !== edit_password) return res.status(401).json({ error: '編輯密碼錯誤，無法更新。' });

        // 更新內容
        const updateResult = await pool.query(
            `UPDATE guestbook_messages
             SET content = $1, last_activity_at = NOW()
             WHERE id = $2
             RETURNING id, author_name, content, reply_count, view_count, like_count, created_at, last_activity_at, is_admin_post, (edit_password IS NOT NULL) AS has_edit_password`,
            [trimmedContent, messageId]
        );
        res.json(updateResult.rows[0]);
    } catch (err) {
        console.error(`[API PUT /guestbook/message/${id}/content] Error:`, err);
        res.status(500).json({ error: '更新留言失敗' });
    }
});

// POST /api/guestbook/reply/:id/verify-password - 驗證回覆編輯密碼
app.post('/api/guestbook/reply/:id/verify-password', async (req, res) => {
    const { id } = req.params;
    const { edit_password } = req.body;
    const replyId = parseInt(id, 10);

    if (isNaN(replyId)) return res.status(400).json({ error: '無效的回覆 ID' });
    if (!edit_password) return res.status(400).json({ error: '請提供編輯密碼' });

    try {
        const result = await pool.query(
            'SELECT edit_password FROM guestbook_replies WHERE id = $1 AND is_visible = TRUE',
            [replyId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: '找不到回覆或回覆不可編輯' });

        const storedPassword = result.rows[0].edit_password;
        if (storedPassword === null) return res.status(403).json({ verified: false, error: '此回覆未設定編輯密碼，無法編輯。' });
        if (storedPassword === edit_password) {
            res.json({ verified: true });
        } else {
            res.status(401).json({ verified: false, error: '編輯密碼錯誤。' });
        }
    } catch (err) {
        console.error(`[API POST /guestbook/reply/${id}/verify-password] Error:`, err);
        res.status(500).json({ error: '密碼驗證失敗' });
    }
});

// PUT /api/guestbook/reply/:id/content - 更新回覆內容
app.put('/api/guestbook/reply/:id/content', async (req, res) => {
    const { id } = req.params;
    const { content, edit_password } = req.body;
    const replyId = parseInt(id, 10);

    if (isNaN(replyId)) return res.status(400).json({ error: '無效的回覆 ID' });
    if (!content || content.trim() === '') return res.status(400).json({ error: '回覆內容不能為空' });
    if (!edit_password) return res.status(400).json({ error: '請提供編輯密碼以進行更新' });

    const trimmedContent = content.trim();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // 再次驗證密碼
        const passResult = await client.query(
            'SELECT edit_password, message_id FROM guestbook_replies WHERE id = $1 AND is_visible = TRUE',
            [replyId]
        );
        if (passResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到回覆或回覆不可編輯' });
        }
        const storedPassword = passResult.rows[0].edit_password;
        const messageId = passResult.rows[0].message_id;

        if (storedPassword === null) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: '此回覆未設定編輯密碼，無法編輯。' });
        }
        if (storedPassword !== edit_password) {
            await client.query('ROLLBACK');
            return res.status(401).json({ error: '編輯密碼錯誤，無法更新。' });
        }

        // 更新內容
        const updateResult = await client.query(
            `UPDATE guestbook_replies
             SET content = $1
             WHERE id = $2
             RETURNING id, message_id, parent_reply_id, author_name, content, created_at, is_admin_reply, like_count, (edit_password IS NOT NULL) AS has_edit_password`,
            [trimmedContent, replyId]
        );

        // 更新主留言的 last_activity_at
        await client.query(
            'UPDATE guestbook_messages SET last_activity_at = NOW() WHERE id = $1',
            [messageId]
        );

        await client.query('COMMIT');
        res.json(updateResult.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[API PUT /guestbook/reply/${id}/content] Error:`, err);
        res.status(500).json({ error: '更新回覆失敗' });
    } finally {
        client.release();
    }
});

// POST /api/guestbook/message/:id/report - 檢舉主留言
app.post('/api/guestbook/message/:id/report', async (req, res) => {
    const { id } = req.params;
    const messageId = parseInt(id, 10);

    if (isNaN(messageId)) {
        return res.status(400).json({ error: '無效的留言 ID' });
    }

    try {
        const checkResult = await pool.query(
            'SELECT can_be_reported FROM guestbook_messages WHERE id = $1 AND is_visible = TRUE',
            [messageId]
        );

        if (checkResult.rowCount === 0) {
            return res.status(404).json({ error: '找不到留言或留言已被隱藏' });
        }

        if (!checkResult.rows[0].can_be_reported) {
            return res.status(403).json({ error: '此留言目前不允許被檢舉' });
        }

        await pool.query(
            'UPDATE guestbook_messages SET is_reported = TRUE, updated_at = NOW(), last_activity_at = NOW() WHERE id = $1',
            [messageId]
        );
        res.status(200).json({ success: true, message: '留言已成功檢舉' });
    } catch (err) {
        console.error(`[API POST /guestbook/message/${id}/report] Error:`, err);
        res.status(500).json({ error: '檢舉留言失敗' });
    }
});

// POST /api/guestbook/reply/:id/report - 檢舉回覆
app.post('/api/guestbook/reply/:id/report', async (req, res) => {
    const { id } = req.params;
    const replyId = parseInt(id, 10);

    if (isNaN(replyId)) {
        return res.status(400).json({ error: '無效的回覆 ID' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const checkResult = await client.query(
            'SELECT can_be_reported, message_id FROM guestbook_replies WHERE id = $1 AND is_visible = TRUE',
            [replyId]
        );

        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到回覆或回覆已被隱藏' });
        }

        if (!checkResult.rows[0].can_be_reported) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: '此回覆目前不允許被檢舉' });
        }

        const messageId = checkResult.rows[0].message_id;

        await client.query(
            'UPDATE guestbook_replies SET is_reported = TRUE, updated_at = NOW() WHERE id = $1',
            [replyId]
        );

        // 當回覆被檢舉時，也更新主留言的 last_activity_at
        await client.query(
            'UPDATE guestbook_messages SET last_activity_at = NOW() WHERE id = $1',
            [messageId]
        );

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: '回覆已成功檢舉' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[API POST /guestbook/reply/${id}/report] Error:`, err);
        res.status(500).json({ error: '檢舉回覆失敗' });
    } finally {
        client.release();
    }
});






// 在 server.js 中修改 /api/generate-guestbook-reply
app.post('/api/generate-guestbook-reply', async (req, res) => {
    if (!geminiModel) {
        console.warn("[API /api/generate-guestbook-reply] AI service not available.");
        return res.status(503).json({ error: "AI 服務目前不可用。" });
    }

    const {
        mainMessageAuthor,     // 主留言作者 (可選)
        mainMessageContent,    // 主留言內容 (可選，但通常會有)
        quotedReplyContent,    // 被引用的回覆內容 (可選)
        currentReplyDraft,     // 回覆框中已有的草稿 (可選)
        targetCommentForReply  // AI 主要針對這則留言進行回覆 (必填)
    } = req.body;

    if (!targetCommentForReply || typeof targetCommentForReply !== 'string' || targetCommentForReply.trim() === '') {
        return res.status(400).json({ error: "目標回覆留言內容為必填項。" });
    }

    // 清理和準備上下文變數
    const author = (mainMessageAuthor && typeof mainMessageAuthor === 'string') ? mainMessageAuthor.trim() : "某位用戶";
    const mainMsg = (mainMessageContent && typeof mainMessageContent === 'string') ? mainMessageContent.trim() : null;
    const quotedMsg = (quotedReplyContent && typeof quotedReplyContent === 'string') ? quotedReplyContent.trim() : null;
    const draft = (currentReplyDraft && typeof currentReplyDraft === 'string') ? currentReplyDraft.trim() : null;

    try {
        let contextForPrompt = "";

        if (mainMsg) {
            contextForPrompt += `這是整個討論串的背景，由「${author}」發起的主留言：\n"""\n${mainMsg}\n"""\n\n`;
        }

        if (quotedMsg && quotedMsg !== mainMsg) { // 如果引用了且不是主留言本身
            contextForPrompt += `你正在回覆的（或引用的）是這則留言：\n"""\n${quotedMsg}\n"""\n\n`;
        } else if (!quotedMsg && mainMsg === targetCommentForReply) { // 如果沒有引用，且目標是主留言
            contextForPrompt += `你正在直接回覆上述由「${author}」發起的主留言。\n\n`;
        } else if (quotedMsg && quotedMsg === mainMsg && mainMsg === targetCommentForReply) { // 如果引用了主留言
            contextForPrompt += `你正在回覆（或引用）上述由「${author}」發起的主留言。\n\n`;
        }


        let taskInstruction = `現在，請針對以下這則留言內容，草擬一個回覆：\n"""\n${targetCommentForReply}\n"""\n\n`;

        if (draft) {
            taskInstruction += `我已經寫了開頭：「${draft}」，請你接著這個開頭繼續撰寫，或者以此為基礎提供一個更完整的建議。\n\n`;
        }

        const prompt = `
            你是一位專業且友善的網站 (名為 Sunnyyummy) 客服小編。
            以下是留言板上的一些對話上下文：
            ${contextForPrompt}
            你的任務：
            ${taskInstruction}
            請遵循以下指示來生成回覆建議：
            - 回覆應針對「${targetCommentForReply.substring(0, 50)}...」這則留言。
            - 如果有提供「我已經寫了開頭...」，請盡量自然地延續或優化該開頭。
            - 保持專業、有禮貌、簡潔且具體的風格。
            - 如果留言是問題，嘗試提供有用的資訊或引導。
            - 如果是意見或讚美，請表示感謝。
            - 如果是不滿或抱怨，請先表達歉意，並說明會如何處理或了解情況。
            - 回覆應保持正面和建設性的語氣。
            - 回覆內容盡量在 2-5 句話之間。

            建議回覆：
        `;

        console.log(`[API /generate-guestbook-reply] Sending prompt to Gemini. Target: "${targetCommentForReply.substring(0, 50)}...", Draft: "${draft ? draft.substring(0, 30) + '...' : 'N/A'}"`);

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const suggestedReplyText = response.text();

        console.log(`[API /generate-guestbook-reply] Received reply from Gemini: "${suggestedReplyText.substring(0, 70)}..."`);
        res.json({ suggestedReply: suggestedReplyText.trim() }); // 返回的鍵名改為 suggestedReply

    } catch (error) {
        console.error('[API /generate-guestbook-reply] Error generating AI reply:', error.response ? error.response.data : error.message, error.stack);
        res.status(500).json({ error: 'AI 回覆建議生成失敗。' });
    }
});






// --- Multer 配置，用於新的開箱文上傳端點 ---
const unboxingUploadStorage = multer.memoryStorage();
const unboxingUpload = multer({
    storage: unboxingUploadStorage,
    limits: {
        fileSize: 20 * 1024 * 1024, // 每張圖片最大 20MB
        files: 3                    // 最多上傳 3 張圖片
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            // 將錯誤傳遞給 multer，它會將其附加到 req.fileValidationError
            cb(new Error('只允許上傳圖片檔案 (jpeg, png, gif, webp)！'), false);
        }
    }
});







// GET /api/unboxing-ai/schemes - 獲取所有 AI 提示詞方案
unboxingAiRouter.get('/schemes', async (req, res) => {
    try {
        // 只獲取啟用的方案，並按名稱排序
        const result = await pool.query(
            "SELECT id, name, intent_key, description, prompt_template, is_active, created_at, updated_at FROM unboxingAI_prompt_schemes WHERE is_active = TRUE ORDER BY name ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[API GET /unboxing-ai/schemes] Error fetching AI schemes:', err.stack || err);
        res.status(500).json({ error: '無法獲取 AI 提示詞方案列表' });
    }
});

// POST /api/unboxing-ai/schemes - 新增一個 AI 提示詞方案
unboxingAiRouter.post('/schemes', async (req, res) => {
    const { name, intent_key, prompt_template, description, is_active = true } = req.body;

    if (!name || !intent_key || !prompt_template) {
        return res.status(400).json({ error: '方案名稱 (name), 唯一鍵 (intent_key), 和提示詞模板 (prompt_template) 為必填項。' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(intent_key)) {
        return res.status(400).json({ error: '唯一鍵 (intent_key) 只能包含英文字母、數字和底線。' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO unboxingAI_prompt_schemes (name, intent_key, prompt_template, description, is_active)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, intent_key, description, prompt_template, is_active, created_at, updated_at`,
            [name.trim(), intent_key.trim(), prompt_template.trim(), description || null, is_active]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[API POST /unboxing-ai/schemes] Error creating AI scheme:', err.stack || err);
        if (err.code === '23505') { // Unique constraint violation
            if (err.constraint === 'unboxingai_prompt_schemes_intent_key_key') {
                return res.status(409).json({ error: '此唯一鍵 (intent_key) 已存在。' });
            }
        }
        res.status(500).json({ error: '新增 AI 提示詞方案失敗' });
    }
});

// PUT /api/unboxing-ai/schemes/:id - 更新一個 AI 提示詞方案
unboxingAiRouter.put('/schemes/:id', async (req, res) => {
    const { id } = req.params;
    const schemeId = parseInt(id, 10);
    const { name, intent_key, prompt_template, description, is_active } = req.body;

    if (isNaN(schemeId)) {
        return res.status(400).json({ error: '無效的方案 ID。' });
    }
    if (!name || !intent_key || !prompt_template) {
        return res.status(400).json({ error: '方案名稱, 唯一鍵, 和提示詞模板為必填項。' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(intent_key)) {
        return res.status(400).json({ error: '唯一鍵 (intent_key) 只能包含英文字母、數字和底線。' });
    }

    try {
        const result = await pool.query(
            `UPDATE unboxingAI_prompt_schemes
             SET name = $1, intent_key = $2, prompt_template = $3, description = $4, is_active = $5, updated_at = NOW()
             WHERE id = $6
             RETURNING id, name, intent_key, description, prompt_template, is_active, created_at, updated_at`,
            [name.trim(), intent_key.trim(), prompt_template.trim(), description || null, is_active, schemeId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的 AI 提示詞方案。' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`[API PUT /unboxing-ai/schemes/${id}] Error updating AI scheme:`, err.stack || err);
        if (err.code === '23505') {
            if (err.constraint === 'unboxingai_prompt_schemes_intent_key_key') {
                return res.status(409).json({ error: '此唯一鍵 (intent_key) 已被其他方案使用。' });
            }
        }
        res.status(500).json({ error: '更新 AI 提示詞方案失敗' });
    }
});

// DELETE /api/unboxing-ai/schemes/:id - 刪除一個 AI 提示詞方案
unboxingAiRouter.delete('/schemes/:id', async (req, res) => {
    const { id } = req.params;
    const schemeId = parseInt(id, 10);

    if (isNaN(schemeId)) {
        return res.status(400).json({ error: '無效的方案 ID。' });
    }

    try {
        // 檢查是否為預設方案 (如果你的預設方案 ID 是 1 和 2)
        if (schemeId === 1 || schemeId === 2) {
            // 或者你可以檢查 intent_key 是否為 'generate_introduction' 或 'identify_content'
            // const schemeCheck = await pool.query("SELECT intent_key FROM unboxingAI_prompt_schemes WHERE id = $1", [schemeId]);
            // if (schemeCheck.rows.length > 0 && (schemeCheck.rows[0].intent_key === 'generate_introduction' || schemeCheck.rows[0].intent_key === 'identify_content')) {
            //     return res.status(403).json({ error: '預設的 AI 提示詞方案不能被刪除。' });
            // }
            return res.status(403).json({ error: '預設的 AI 提示詞方案 (ID 1 和 2) 不能被刪除。您可以將其 is_active 設為 false 來停用。' });
        }

        const result = await pool.query(
            "DELETE FROM unboxingAI_prompt_schemes WHERE id = $1",
            [schemeId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要刪除的 AI 提示詞方案。' });
        }
        res.status(204).send(); // No Content
    } catch (err) {
        console.error(`[API DELETE /unboxing-ai/schemes/${id}] Error deleting AI scheme:`, err.stack || err);
        res.status(500).json({ error: '刪除 AI 提示詞方案失敗' });
    }
});

// 將新的路由掛載到主應用程式
app.use('/api/ai-assistant', authenticateGeneralUser, unboxingAiRouter);// --- END OF Unboxing AI Prompt Schemes API ---









// --- 新的 API 端點：產生開箱文或識別圖片內容 ---
app.post('/api/generate-ai-post', authenticateGeneralUser, unboxingUpload.array('images', 3), async (req, res) => {
    // Removed: console.log(`[DEBUG /api/generate-unboxing-post] Received request. Intent: ${req.body.scheme_intent_key}, Files: ${req.files ? req.files.length : 0}`);

    if (!visionClient || !geminiModel) {
        return res.status(503).json({ error: "AI 服務目前不可用。" });
    }

    // 檢查 multer 的 fileFilter 是否產生錯誤
    if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
    }

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: '請至少上傳一張圖片。' });
    }

    const userDescription = req.body.description || "";
    const schemeIntentKey = req.body.scheme_intent_key; // <--- 從 scheme_intent_key 讀取

    if (!schemeIntentKey) {
        return res.status(400).json({ error: '未提供 AI 方案意圖 (scheme_intent_key)。' });
    }

    try {
        // 1. 根據 schemeIntentKey 從資料庫獲取 prompt_template
        const schemeResult = await pool.query(
            "SELECT prompt_template FROM unboxingAI_prompt_schemes WHERE intent_key = $1 AND is_active = TRUE",
            [schemeIntentKey]
        );

        if (schemeResult.rows.length === 0) {
            console.warn(`[Content Gen] 無效或未啟用的 AI 方案意圖: ${schemeIntentKey}`);
            return res.status(400).json({ error: '無效的請求意圖或指定的 AI 方案未啟用。' });
        }
        const promptTemplate = schemeResult.rows[0].prompt_template;

        // 2. 圖片分析 (與之前相同)
        let visionResults = [];
        console.log(`[Content Gen] Received ${req.files.length} images. Intent Key: ${schemeIntentKey}.`);

        for (const file of req.files) {
            const imageBuffer = file.buffer;
            console.log(`[Content Gen] Analyzing image: ${file.originalname} (Size: ${imageBuffer.length} bytes) with Cloud Vision.`);

            try {
                const [result] = await visionClient.annotateImage({
                    image: { content: imageBuffer },
                    features: [
                        { type: 'LABEL_DETECTION', maxResults: 10 },
                        { type: 'TEXT_DETECTION' },
                        { type: 'OBJECT_LOCALIZATION', maxResults: 5 },

                    ],
                });

                // Removed: console.log(`[Cloud Vision API Raw Response for ${file.originalname}]: ${JSON.stringify(result, null, 2)}`);

                const labels = result.labelAnnotations ? result.labelAnnotations.map(label => label.description) : [];
                const texts = result.textAnnotations ? result.textAnnotations.map(text => text.description) : [];
                const fullTextAnnotation = texts.length > 0 ? texts[0].replace(/\n/g, ' ').trim() : "";
                const objects = result.localizedObjectAnnotations ? result.localizedObjectAnnotations.map(obj => obj.name) : [];

                visionResults.push({
                    filename: file.originalname,
                    labels: labels,
                    detectedText: fullTextAnnotation,
                    detectedObjects: objects,
                });
            } catch (visionError) {
                console.error(`[Content Gen] Error analyzing image ${file.originalname} with Cloud Vision:`, visionError.message);
                visionResults.push({
                    filename: file.originalname,
                    error: "圖片分析失敗",
                    labels: [], detectedText: "", detectedObjects: []
                });
            }
        }

        let imageInsights = "從上傳的圖片中，我觀察到以下內容：\n";
        if (visionResults.length === 0 || visionResults.every(vr => vr.error)) {
            imageInsights = "- 未能成功分析任何圖片，或者所有圖片分析均失敗。\n";
        } else {
            visionResults.forEach((vr, index) => {
                imageInsights += `關於圖片 ${index + 1} (${vr.filename}):\n`;
                if (vr.error) {
                    imageInsights += `  - 分析時遇到問題: ${vr.error}\n`;
                } else {
                    let hasAnyVisionData = false;
                    const labelsText = (vr.labels && vr.labels.length > 0) ? vr.labels.join('、') : '無';
                    imageInsights += `  - 標籤分析結果：${labelsText}\n`;
                    if (labelsText !== '無') hasAnyVisionData = true;

                    const detectedTextContent = vr.detectedText || '無';
                    imageInsights += `  - 文字識別結果：「${detectedTextContent}」\n`;
                    if (detectedTextContent !== '無') hasAnyVisionData = true;

                    const objectsText = (vr.detectedObjects && vr.detectedObjects.length > 0) ? vr.detectedObjects.join('、') : '無';
                    imageInsights += `  - 物件偵測結果：${objectsText}\n`;
                    if (objectsText !== '無') hasAnyVisionData = true;

                    if (!hasAnyVisionData) {
                        imageInsights += `  - (綜合來看，未能從此圖片中提取到具體的標籤、文字或物件資訊。)\n`;
                    }
                }
                imageInsights += "\n";
            });
        }

        // Removed: console.log("[DEBUG] Constructed imageInsights string:", imageInsights);

        // 3. 構造最終的 geminiPrompt，通過拼接方式組合
        // promptTemplate 現在被視為基礎指令框架

        let userDescriptionBlock = "\n\n--- 使用者描述 ---\n";
        if (userDescription && userDescription.trim() !== "") {
            userDescriptionBlock += `"${userDescription.trim()}"\n`;
        } else {
            userDescriptionBlock += "使用者未提供額外描述。\n";
        }

        // imageInsights 變數本身已包含引導文字 "從上傳的圖片中，我觀察到以下內容：" 和詳細格式
        // 我們在這裡確保它作為一個獨立的資訊塊被添加
        const imageInsightsBlock = `\n--- 圖片分析結果 ---\n${imageInsights}\n`;

        // 拼接：基礎模板 + 使用者描述塊 + 圖片分析塊
        // 確保 promptTemplate 不以過多換行結束，也不以 userDescriptionBlock/imageInsightsBlock 以過多換行開始
        const finalGeminiPrompt = `${promptTemplate.trim()}\n${userDescriptionBlock.trim()}\n${imageInsightsBlock.trim()}`;

        // Removed: console.log("[DEBUG] Final geminiPrompt to be sent (concatenated):", finalGeminiPrompt);

        // 確保 prompt 不為空
        if (!finalGeminiPrompt || finalGeminiPrompt.trim() === "") {
            console.error(`[Content Gen] Error: Concatenated prompt for ${schemeIntentKey} resulted in an empty prompt.`);
            return res.status(500).json({ error: 'AI 提示詞構造失敗。' });
        }

        console.log(`[Content Gen] Sending concatenated prompt to Gemini for intent key: ${schemeIntentKey}.`);
        const result = await geminiModel.generateContent(finalGeminiPrompt);
        const response = await result.response;
        const generatedText = response.text();

        console.log("[Content Gen] Received text from Gemini.");
        res.json({ success: true, generatedText: generatedText.trim() });

    } catch (error) {
        console.error(`[Content Gen API] Error with intent '${intent}':`, error.message, error.stack);
        res.status(500).json({ error: 'AI 內容產生失敗，請稍後再試。' });
    }



});




// --- 樂譜 API ---
app.get('/api/scores/artists', async (req, res) => {
    try {
        // 從新的 artists 表查詢，並只選擇那些其歌曲有關聯樂譜的歌手
        const queryText = `
            SELECT DISTINCT a.name
            FROM artists a
            JOIN music_artists ma ON a.id = ma.artist_id
            JOIN music m ON ma.music_id = m.id
            JOIN scores s ON m.id = s.music_id
            WHERE a.name IS NOT NULL AND a.name <> ''
            ORDER BY a.name ASC;
        `;
        const result = await pool.query(queryText);
        const artists = result.rows.map(row => row.name); // 返回歌手名稱的陣列
        res.json(artists);
    } catch (err) {
        console.error('獲取帶有樂譜的歌手時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取歌手列表時發生內部伺服器錯誤' });
    }
});
app.get('/api/scores/songs', async (req, res) => {
    const { artist: artistNameFilter } = req.query; // Rename for clarity
    try {
        let subQueryMusicIds = `
            SELECT DISTINCT m_inner.id
            FROM music m_inner
            INNER JOIN scores s_inner ON m_inner.id = s_inner.music_id
        `;
        const queryParams = [];
        let paramIndex = 1;

        if (artistNameFilter && artistNameFilter !== 'All') {
            subQueryMusicIds += `
            WHERE EXISTS (
                SELECT 1
                FROM music_artists ma_filter
                JOIN artists a_filter ON ma_filter.artist_id = a_filter.id
                WHERE ma_filter.music_id = m_inner.id AND a_filter.name = $${paramIndex++}
            )
            `;
            queryParams.push(decodeURIComponent(artistNameFilter));
        }

        let queryText = `
            SELECT
                m.id,
                m.title,
                m.cover_art_url,
                m.release_date,
                m.youtube_video_id,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name ASC)
                     FROM artists a
                     JOIN music_artists ma ON ma.artist_id = a.id
                     WHERE ma.music_id = m.id),
                    '[]'::json
                ) AS artists,
                s_agg.scores
            FROM (${subQueryMusicIds}) AS distinct_music_with_scores
            JOIN music m ON m.id = distinct_music_with_scores.id
            LEFT JOIN LATERAL (
                SELECT json_agg(s_lat.* ORDER BY s_lat.display_order ASC, s_lat.type ASC) AS scores
                FROM scores s_lat
                WHERE s_lat.music_id = m.id
            ) s_agg ON true
            ORDER BY m.title ASC;
            -- Consider a more stable sort, e.g., by first artist then title, or by release_date
            -- ORDER BY (SELECT MIN(a_sort.name) FROM artists a_sort JOIN music_artists ma_sort ON a_sort.id = ma_sort.artist_id WHERE ma_sort.music_id = m.id) ASC, m.release_date DESC NULLS LAST, m.title ASC;
        `;

        const result = await pool.query(queryText, queryParams);
        res.json(result.rows);

    } catch (err) {
        console.error('獲取帶有樂譜的歌曲列表時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取帶有樂譜的歌曲列表時發生內部伺服器錯誤' });
    }
});




app.get('/api/scores/proxy', (req, res) => {
    const pdfUrl = req.query.url;

    if (!pdfUrl || typeof pdfUrl !== 'string') {
        console.warn('代理請求被拒：缺少或無效的 URL 參數。');
        return res.status(400).send('缺少或無效的 PDF URL。');
    }

    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(pdfUrl);
        const allowedDomains = ['raw.githubusercontent.com']; // Add other allowed domains if needed
        const urlObject = new URL(decodedUrl);

        if (!allowedDomains.includes(urlObject.hostname)) {
            console.warn(`代理請求被阻止，不允許的網域：${urlObject.hostname} (URL: ${decodedUrl})`);
            return res.status(403).send('不允許從此網域進行代理。');
        }

    } catch (e) {
        console.error(`代理請求被拒：無效的 URL 編碼或格式：${pdfUrl}`, e);
        return res.status(400).send('無效的 URL 格式或編碼。');
    }

    console.log(`正在代理 PDF 請求：${decodedUrl}`);

    const pdfRequest = https.get(decodedUrl, (pdfRes) => {
        if (pdfRes.statusCode >= 300 && pdfRes.statusCode < 400 && pdfRes.headers.location) {
            console.log(`正在跟隨從 ${decodedUrl} 到 ${pdfRes.headers.location} 的重定向`);
            try {
                const redirectUrlObject = new URL(pdfRes.headers.location, decodedUrl);
                const allowedDomains = ['raw.githubusercontent.com'];
                if (!allowedDomains.includes(redirectUrlObject.hostname)) {
                    console.warn(`代理重定向被阻止，不允許的網域：${redirectUrlObject.hostname}`);
                    return res.status(403).send('重定向目標網域不被允許。');
                }
                const redirectedRequest = https.get(redirectUrlObject.href, (redirectedRes) => {
                    if (redirectedRes.statusCode !== 200) {
                        console.error(`獲取重定向 PDF 時出錯：狀態碼：${redirectedRes.statusCode}，URL：${redirectUrlObject.href}`);
                        const statusCodeToSend = redirectedRes.statusCode >= 400 ? redirectedRes.statusCode : 502;
                        return res.status(statusCodeToSend).send(`無法獲取重定向的 PDF：${redirectedRes.statusMessage}`);
                    }
                    res.setHeader('Content-Type', redirectedRes.headers['content-type'] || 'application/pdf');
                    redirectedRes.pipe(res);
                }).on('error', (err) => {
                    console.error(`重定向 PDF 請求至 ${redirectUrlObject.href} 時發生錯誤：`, err.message);
                    if (!res.headersSent) res.status(500).send('透過代理獲取重定向 PDF 時出錯。');
                });
                redirectedRequest.setTimeout(15000, () => {
                    console.error(`重定向 PDF 請求至 ${redirectUrlObject.href} 時超時`);
                    redirectedRequest.destroy();
                    if (!res.headersSent) res.status(504).send('透過代理獲取重定向 PDF 時超時。');
                });
                return;
            } catch (e) {
                console.error(`無效的重定向 URL：${pdfRes.headers.location}`, e);
                return res.status(500).send('從來源收到無效的重定向位置。');
            }
        }

        if (pdfRes.statusCode !== 200) {
            console.error(`獲取 PDF 時出錯：狀態碼：${pdfRes.statusCode}，URL：${decodedUrl}`);
            const statusCodeToSend = pdfRes.statusCode >= 400 ? pdfRes.statusCode : 502;
            return res.status(statusCodeToSend).send(`無法從來源獲取 PDF：狀態 ${pdfRes.statusCode}`);
        }

        console.log(`從來源 ${decodedUrl} 獲取的 Content-Type 為: ${pdfRes.headers['content-type']}，強制設為 application/pdf`);
        res.setHeader('Content-Type', 'application/pdf'); // Force PDF type
        pdfRes.pipe(res);

    }).on('error', (err) => {
        console.error(`向 ${decodedUrl} 發起 PDF 請求期間發生網路或連線錯誤：`, err.message);
        if (!res.headersSent) {
            res.status(502).send('錯誤的網關：連接 PDF 來源時出錯。');
        } else {
            res.end();
        }
    });
    pdfRequest.setTimeout(15000, () => { // 15 seconds timeout
        console.error(`向 ${decodedUrl} 發起初始 PDF 請求時超時`);
        pdfRequest.destroy();
        if (!res.headersSent) {
            res.status(504).send('網關超時：連接 PDF 來源時超時。');
        }
    });
});



// 輔助函數：清理 Banner 排序欄位
function sanitizeSortField(field) {
    const allowedFields = ['display_order', 'created_at', 'name', 'page_location', 'id', 'random'];
    if (allowedFields.includes(field)) {
        return field;
    }
    return 'display_order'; // 預設
}

// GET /api/banners?page=...&sort=... (已更新包含隨機排序)
app.get('/api/banners', async (req, res) => {
    const pageLocation = req.query.page || 'all';
    const sort = req.query.sort || 'display_order'; // Default sort
    const limit = parseInt(req.query.limit) || 5; // Default limit

    let queryText = 'SELECT id, image_url, link_url, alt_text FROM banners';
    const queryParams = [];
    let paramIndex = 1;

    if (pageLocation !== 'all') {
        queryText += ` WHERE page_location = $${paramIndex++}`;
        queryParams.push(pageLocation);
    }

    // Handle sorting, random is a special case
    if (sort === 'random') {
        queryText += ' ORDER BY RANDOM()';
    } else {
        queryText += ` ORDER BY ${sanitizeSortField(sort)} ASC, id ASC`; // Add id for stable sort
    }

    queryText += ` LIMIT $${paramIndex++}`; // Add limit
    queryParams.push(limit);

    try {
        const result = await pool.query(queryText, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取 Banner 時出錯:', err);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});



// 新增：獲取所有可用標籤
app.get('/api/tags', async (req, res) => {
    try {
        const queryText = 'SELECT tag_id, tag_name FROM tags ORDER BY tag_id ASC'; // 或按 tag_name 排序
        const result = await pool.query(queryText);
        res.json(result.rows); // 回傳包含 tag_id 和 tag_name 的陣列
    } catch (err) {
        console.error('獲取標籤列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取標籤列表。' });
    }
});

// --- 商品 API ---


// 新增：建立新標籤
app.post('/api/tags', async (req, res) => {
    const { tag_name } = req.body; // 從請求 body 獲取 tag_name

    // 驗證輸入
    if (!tag_name || tag_name.trim() === '') {
        return res.status(400).json({ error: '標籤名稱不能為空。' });
    }

    try {
        // 插入新標籤到資料庫，並返回插入的記錄
        const queryText = 'INSERT INTO tags (tag_name) VALUES ($1) RETURNING *';
        const result = await pool.query(queryText, [tag_name.trim()]);

        // 成功，回傳 201 Created 和新標籤物件
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error('新增標籤時出錯:', err);
        // 處理可能的錯誤，例如名稱重複
        if (err.code === '23505') { // PostgreSQL unique violation code
            return res.status(409).json({ error: '此標籤名稱已存在。' }); // 409 Conflict
        }
        // 其他伺服器錯誤
        res.status(500).json({ error: '伺服器內部錯誤，無法新增標籤。' });
    }
});


// 新增：更新標籤名稱
app.put('/api/tags/:tag_id', async (req, res) => {
    const { tag_id } = req.params; // 從路徑參數獲取 tag_id
    const { tag_name } = req.body; // 從請求 body 獲取新的 tag_name

    // 驗證輸入
    if (isNaN(parseInt(tag_id))) {
        return res.status(400).json({ error: '無效的標籤 ID 格式。' });
    }
    if (!tag_name || tag_name.trim() === '') {
        return res.status(400).json({ error: '標籤名稱不能為空。' });
    }

    try {
        // 更新資料庫中的標籤名稱，並返回更新後的記錄
        const queryText = 'UPDATE tags SET tag_name = $1 WHERE tag_id = $2 RETURNING *';
        const result = await pool.query(queryText, [tag_name.trim(), tag_id]);

        // 檢查是否有記錄被更新
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的標籤。' }); // 404 Not Found
        }

        // 成功，回傳 200 OK 和更新後的標籤物件
        res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error(`更新標籤 ID ${tag_id} 時出錯:`, err);
        // 處理可能的錯誤，例如名稱重複
        if (err.code === '23505') { // PostgreSQL unique violation code
            return res.status(409).json({ error: '此標籤名稱已存在。' }); // 409 Conflict
        }
        // 其他伺服器錯誤
        res.status(500).json({ error: '伺服器內部錯誤，無法更新標籤。' });
    }
});



// --- 標籤 API ---
// ... (GET, POST, PUT /api/tags) ...
// 新增：刪除標籤
app.delete('/api/tags/:tag_id', async (req, res) => {
    const { tag_id } = req.params; // 從路徑參數獲取 tag_id

    // 驗證輸入
    if (isNaN(parseInt(tag_id))) {
        return res.status(400).json({ error: '無效的標籤 ID 格式。' });
    }

    // --- 使用交易 (可選但推薦，保持一致性) ---
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // **重要說明:** 
        // 由於我們在建立 product_tags 表時設定了 FOREIGN KEY(tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE
        // 當我們從 tags 表刪除一個標籤時，資料庫會自動幫我們刪除 product_tags 表中所有引用了該 tag_id 的記錄。
        // 所以我們 *不需要* 在這裡手動執行 "DELETE FROM product_tags WHERE tag_id = $1"。
        // 如果當時沒有設定 ON DELETE CASCADE，則需要先執行手動刪除關聯。

        // 嘗試從 tags 表刪除記錄
        const deleteTagQuery = 'DELETE FROM tags WHERE tag_id = $1';
        const result = await client.query(deleteTagQuery, [tag_id]);

        // 檢查是否有記錄被刪除
        if (result.rowCount === 0) {
            // 雖然沒找到，但刪除操作本身是成功的（目標狀態已達成），所以可以返回成功
            // 如果您希望更嚴格，可以返回 404
            console.log(`嘗試刪除不存在的標籤 ID: ${tag_id}`);
            // return res.status(404).json({ error: '找不到要刪除的標籤。' });
        }

        await client.query('COMMIT'); // 提交交易

        // 成功，回傳 204 No Content
        res.status(204).send();

    } catch (err) {
        await client.query('ROLLBACK'); // 出錯時回滾
        console.error(`刪除標籤 ID ${tag_id} 時出錯:`, err);
        // 這裡不太可能遇到 23503 (外鍵錯誤)，因為是先刪 tags。
        // 如果有關聯的其他表（除了 product_tags）且沒有設定 CASCADE，才可能出錯。
        res.status(500).json({ error: '伺服器內部錯誤，無法刪除標籤。' });
    } finally {
        client.release(); // 釋放連接
    }
});

// --- 商品 API ---
// ...


// 新增：更新標籤名稱
app.put('/api/tags/:tag_id', async (req, res) => {
    const { tag_id } = req.params;
    const { tag_name } = req.body;

    if (isNaN(parseInt(tag_id))) {
        return res.status(400).json({ error: '無效的標籤 ID 格式。' });
    }
    if (!tag_name || tag_name.trim() === '') {
        return res.status(400).json({ error: '標籤名稱不能為空。' });
    }

    try {
        const queryText = 'UPDATE tags SET tag_name = $1 WHERE tag_id = $2 RETURNING *';
        const result = await pool.query(queryText, [tag_name.trim(), tag_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的標籤。' });
        }

        res.status(200).json(result.rows[0]); // 回傳更新後的標籤
    } catch (err) {
        console.error(`更新標籤 ID ${tag_id} 時出錯:`, err);
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ error: '此標籤名稱已存在。' });
        }
        res.status(500).json({ error: '伺服器內部錯誤，無法更新標籤。' });
    }
});


// ... (繼續放置 PUT /api/products/:id, DELETE /api/products/:id 等路由) ...





app.get('/api/products/categories', async (req, res) => {
    try {
        const queryText = 'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> \'\' ORDER BY category ASC';
        const result = await pool.query(queryText);
        const categories = result.rows.map(row => row.category);
        res.json(categories);
    } catch (err) {
        console.error('獲取商品分類列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});
app.get('/api/products', async (req, res) => {
    // 同時讀取 sort 和 category 參數
    const sortBy = req.query.sort || 'latest';
    const category = req.query.category || null; // 獲取分類參數

    // *** 修改 SQL 查詢以包含標籤 ***
    // 使用 LEFT JOIN 以確保即使商品沒有標籤也能被選出
    // 使用 COALESCE(json_agg(...) FILTER (...), '[]'::json) 來處理沒有標籤的情況，返回空JSON數組
    let queryText = `
        SELECT
            p.id, p.name, p.description, p.price, p.image_url,
            p.seven_eleven_url, p.click_count, p.category,
            p.expiration_type, p.start_date, p.end_date, -- 新增欄位
            CASE
                WHEN p.expiration_type = 0 THEN '有效'
                WHEN p.expiration_type = 1 AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE) AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE) THEN '有效'
                ELSE '已過期'
            END as product_status, -- 新增狀態計算
            COALESCE(json_agg(t.tag_name) FILTER (WHERE t.tag_id IS NOT NULL), '[]'::json) AS tags
        FROM products p
        LEFT JOIN product_tags pt ON p.id = pt.product_id
        LEFT JOIN tags t ON pt.tag_id = t.tag_id
    `;

    const queryParams = [];
    let paramIndex = 1;
    let whereClauses = [];

    // 構建 WHERE 子句 (處理分類篩選)
    if (category && category !== 'All') { // 如果提供了分類且不是 'All'
        // *** 重要：因為 JOIN 了多張表，欄位需要指定來自哪個表，例如 p.category ***
        whereClauses.push(`p.category = $${paramIndex++}`);
        queryParams.push(category);
    }
    // 可以添加其他篩選條件，例如 WHERE p.name LIKE $... 等

    if (whereClauses.length > 0) {
        queryText += ' WHERE ' + whereClauses.join(' AND ');
    }

    // *** GROUP BY 子句，確保每個商品只出現一次 ***
    // 必須 GROUP BY products 表中所有被 SELECT 的非聚合欄位
    queryText += ` GROUP BY p.id, p.name, p.description, p.price, p.image_url, p.seven_eleven_url, p.click_count, p.category, p.expiration_type, p.start_date, p.end_date`;

    // 構建 ORDER BY 子句
    // *** 重要：排序欄位也需要指定表別名 ***
    let orderByClause = ' ORDER BY p.created_at DESC, p.id DESC'; // 指定 p.id
    if (sortBy === 'popular') {
        orderByClause = ' ORDER BY p.click_count DESC, p.created_at DESC, p.id DESC'; // 指定 p.click_count, p.created_at
    }
    queryText += orderByClause;

    // (可選) 添加分頁邏輯 (如果需要，也要調整 GROUP BY 和 ORDER BY 的處理)
    // const limit = parseInt(req.query.limit) || 20; 
    // const page = parseInt(req.query.page) || 1;
    // const offset = (page - 1) * limit;
    // queryText += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    // queryParams.push(limit, offset);


    try {
        const result = await pool.query(queryText, queryParams);
        // json_agg 會返回 JSON 數組字符串，前端 JS可以直接 JSON.parse() 或直接使用
        res.json(result.rows);
    } catch (err) {
        console.error('獲取商品列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});





app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的商品 ID 格式。' });
    }
    try {
        // 修改查詢以包含所有需要的字段和標籤
        const queryText = `
            SELECT 
                p.id, p.name, p.description, p.price, p.category, p.image_url, 
                p.seven_eleven_url, p.click_count, p.expiration_type, p.start_date, p.end_date,
                COALESCE(
                  (SELECT json_agg(t.tag_id) 
                   FROM product_tags pt 
                   JOIN tags t ON pt.tag_id = t.tag_id 
                   WHERE pt.product_id = p.id), 
                  '[]'::json
                ) AS tags
            FROM products p
            WHERE p.id = $1
        `;
        const result = await pool.query(queryText, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到商品。' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`獲取商品 ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});





app.post('/api/products/:id/click', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { console.warn(`收到無效商品 ID (${id}) 的點擊記錄請求`); return res.status(204).send(); }
    try {
        // 更新商品點擊計數
        await pool.query('UPDATE products SET click_count = click_count + 1 WHERE id = $1', [id]);

        // 記錄點擊事件到 product_click_events 表
        await pool.query('INSERT INTO product_click_events (product_id) VALUES ($1)', [id]);

        res.status(204).send();
    } catch (err) {
        console.error(`記錄商品 ID ${id} 點擊時出錯:`, err);
        res.status(204).send(); // 出錯也靜默處理
    }
});

// --- 音樂 API ---
app.get('/api/artists', async (req, res) => {
    try {
        // 從新的 artists 表獲取歌手列表
        const result = await pool.query('SELECT id, name FROM artists ORDER BY name ASC');
        res.json(result.rows); // 直接返回 {id, name} 對象的陣列
    } catch (err) {
        console.error('獲取歌手列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.get('/api/music', async (req, res) => {
    const artistNameFilter = req.query.artist || null; // 前端可能會傳遞歌手名稱作為篩選條件
    let queryText = `
        SELECT
            m.id, m.title, m.cover_art_url, m.platform_url, m.release_date, m.description, m.youtube_video_id,
            m.created_at, m.updated_at,
            COALESCE(
                (SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name ASC)
                 FROM artists a
                 JOIN music_artists ma ON ma.artist_id = a.id
                 WHERE ma.music_id = m.id),
                '[]'::json
            ) AS artists,
            COALESCE(
                (SELECT json_agg(s.* ORDER BY s.display_order ASC, s.type ASC)
                 FROM scores s
                 WHERE s.music_id = m.id),
                '[]'::json
            ) AS scores
        FROM music m
    `;
    const queryParams = [];

    if (artistNameFilter && artistNameFilter !== 'All') {
        queryText += `
        WHERE EXISTS (
            SELECT 1
            FROM music_artists ma_filter
            JOIN artists a_filter ON ma_filter.artist_id = a_filter.id
            WHERE ma_filter.music_id = m.id AND a_filter.name = $1
        )
        `;
        queryParams.push(decodeURIComponent(artistNameFilter));
    }

    queryText += ' ORDER BY m.release_date DESC NULLS LAST, m.title ASC';

    try {
        const result = await pool.query(queryText, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取音樂列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.get('/api/music/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) {
        return res.status(400).json({ error: '無效的音樂 ID' });
    }
    try {
        const queryText = `
            SELECT
                m.id, m.title, m.cover_art_url, m.platform_url, m.release_date, m.description, m.youtube_video_id,
                m.created_at, m.updated_at,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name ASC)
                     FROM artists a
                     JOIN music_artists ma ON ma.artist_id = a.id
                     WHERE ma.music_id = m.id),
                    '[]'::json
                ) AS artists,
                COALESCE(
                    (SELECT json_agg(s.* ORDER BY s.display_order ASC, s.type ASC)
                     FROM scores s
                     WHERE s.music_id = m.id),
                    '[]'::json
                ) AS scores
            FROM music m
            WHERE m.id = $1;
        `;
        const result = await pool.query(queryText, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到音樂' });
        }
        // 從 music 表中移除舊的 artist 欄位後，這裡就不需要 m.artist 了
        const musicData = result.rows[0];
        delete musicData.artist; // 如果 music 表中還存在 artist 欄位，確保不在回應中返回

        res.json(musicData);
    } catch (err) {
        console.error(`獲取 ID 為 ${id} 的音樂時出錯：`, err.stack || err);
        res.status(500).json({ error: '獲取音樂詳情時發生內部伺服器錯誤' });
    }
});

// POST /api/music - 新增音樂
app.post('/api/music', async (req, res) => {
    const { title, artist_names, release_date, description, cover_art_url, platform_url, youtube_video_id, scores } = req.body;

    // 基本驗證
    if (!title || !artist_names || !Array.isArray(artist_names) || artist_names.length === 0) {
        return res.status(400).json({ error: '標題和至少一位歌手名稱為必填項。' });
    }
    if (scores && !Array.isArray(scores)) {
        return res.status(400).json({ error: '樂譜資料格式不正確，應為陣列。' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 插入音樂基本資訊
        const musicInsertQuery = `
            INSERT INTO music (title, release_date, description, cover_art_url, platform_url, youtube_video_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id;
        `;
        console.log('[新增音樂日誌] 準備插入 music 表，資料:', { title, release_date, description, cover_art_url, platform_url, youtube_video_id });
        const musicResult = await client.query(musicInsertQuery, [
            title,
            release_date || null,
            description || null,
            cover_art_url || null,
            platform_url || null,
            youtube_video_id || null
        ]);
        const musicId = musicResult.rows[0].id;
        console.log(`[新增音樂日誌] music 表插入成功，musicId: ${musicId}`);

        // 2. 處理歌手
        console.log('[新增音樂日誌] 準備處理歌手，原始 artist_names:', artist_names);
        for (const artistName of artist_names) {
            const trimmedArtistName = artistName.trim();
            console.log(`[新增音樂日誌] 正在處理歌手: "${artistName}", trim 後: "${trimmedArtistName}"`);

            if (!trimmedArtistName) {
                console.warn(`[新增音樂日誌] 警告: 發現 trim 後的空歌手名稱，將跳過此歌手。原始名稱: "${artistName}"`);
                continue; // 如果 trim 後是空字串，則跳過
            }

            let artistResult = await client.query('SELECT id FROM artists WHERE name = $1', [trimmedArtistName]);
            let artistId;
            if (artistResult.rows.length > 0) {
                artistId = artistResult.rows[0].id;
                console.log(`[新增音樂日誌] 歌手 "${trimmedArtistName}" 已存在於 artists 表，ID: ${artistId}`);
            } else {
                console.log(`[新增音樂日誌] 歌手 "${trimmedArtistName}" 不在 artists 表中，準備插入新歌手。`);
                artistResult = await client.query('INSERT INTO artists (name) VALUES ($1) RETURNING id', [trimmedArtistName]);
                artistId = artistResult.rows[0].id;
                console.log(`[新增音樂日誌] 新歌手 "${trimmedArtistName}" 插入 artists 表成功，ID: ${artistId}`);
            }
            console.log(`[新增音樂日誌] 準備將 musicId: ${musicId} 與 artistId: ${artistId} 關聯到 music_artists 表。`);
            await client.query('INSERT INTO music_artists (music_id, artist_id) VALUES ($1, $2)', [musicId, artistId]);
            console.log(`[新增音樂日誌] music_artists 表關聯成功。`);
        }
        console.log('[新增音樂日誌] 所有歌手處理完畢。');

        // 3. 處理樂譜 (如果提供)
        if (scores && scores.length > 0) {
            for (const score of scores) {
                const { type, pdf_url, display_order } = score;
                if (type && pdf_url) { // 確保基本樂譜資訊存在
                    await client.query(
                        'INSERT INTO scores (music_id, type, pdf_url, display_order) VALUES ($1, $2, $3, $4)',
                        [musicId, type, pdf_url, display_order || 0]
                    );
                }
            }
        }

        await client.query('COMMIT');

        const newMusicQuery = `
            SELECT
                m.id, m.title, m.cover_art_url, m.platform_url, m.release_date, m.description, m.youtube_video_id,
                m.created_at, m.updated_at,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name ASC)
                     FROM artists a
                     JOIN music_artists ma ON ma.artist_id = a.id
                     WHERE ma.music_id = m.id),
                    '[]'::json
                ) AS artists,
                COALESCE(
                    (SELECT json_agg(s.* ORDER BY s.display_order ASC, s.type ASC)
                     FROM scores s
                     WHERE s.music_id = m.id),
                    '[]'::json
                ) AS scores
            FROM music m
            WHERE m.id = $1;
        `;
        const newMusicResult = await pool.query(newMusicQuery, [musicId]);
        res.status(201).json(newMusicResult.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('新增音樂時出錯:', err.stack || err, 'Code:', err.code, 'Column:', err.column, 'Table:', err.table, 'Constraint:', err.constraint);

        // SQLSTATE '23502' for not_null_violation
        if (err.code === '23502') {
            const columnName = err.column || (err.message && err.message.match(/column "([^"]+)"/) ? err.message.match(/column "([^"]+)"/)[1] : '未知欄位');
            const tableName = err.table || '未知表';
            let userFriendlyMessage = `欄位 "${columnName}" (在表 "${tableName}" 中) 為必填項。`;

            if (columnName === 'artist' && tableName === 'music') {
                userFriendlyMessage = `資料庫 music 表中的 "artist" 欄位設定為必填，但目前新增邏輯已改用 "music_artists" 關聯表處理歌手。請檢查 music 表的結構定義，考慮將 "artist" 欄位設為允許 NULL，或如果不再需要則將其移除。`;
            } else if (columnName === 'release_date' && tableName === 'music') {
                userFriendlyMessage = '發行日期為必填項，請提供有效的日期。';
            } else if (columnName === 'name' && tableName === 'artists') {
                userFriendlyMessage = '歌手名稱為必填項，請確保已正確輸入。';
            } else if (columnName === 'title' && tableName === 'music') {
                userFriendlyMessage = '專輯標題為必填項。';
            }
            return res.status(400).json({ error: userFriendlyMessage });
        }
        // SQLSTATE '23505' for unique_violation
        else if (err.code === '23505') {
            let userFriendlyMessage = '提交的資料與現有記錄衝突。';
            const constraintName = err.constraint || '';
            const tableName = err.table || '';

            if (constraintName.includes('title') && tableName === 'music') {
                userFriendlyMessage = `音樂標題已存在，請使用不同的標題。`;
            } else if (constraintName.includes('name') && tableName === 'artists') {
                userFriendlyMessage = `歌手名稱已存在。`;
            } else if (err.detail) { // 嘗試從 detail 獲取更多資訊
                const detailMatch = err.detail.match(/Key \(([^)]+)\)=\(([^)]+)\) already exists/);
                if (detailMatch) {
                    userFriendlyMessage = `欄位 "${detailMatch[1]}" 的值 "${detailMatch[2]}" 已存在。`;
                }
            }
            return res.status(409).json({ error: userFriendlyMessage });
        }

        res.status(500).json({ error: '新增音樂時發生未知的內部伺服器錯誤，請稍後再試。' });
    } finally {
        client.release();
    }
});

// PUT /api/music/:id - 更新音樂
app.put('/api/music/:id', async (req, res) => {
    const { id } = req.params;
    const musicId = parseInt(id, 10);
    if (isNaN(musicId)) {
        return res.status(400).json({ error: '無效的音樂 ID' });
    }

    const { title, artist_names, release_date, description, cover_art_url, platform_url, youtube_video_id, scores } = req.body;

    if (!title || !artist_names || !Array.isArray(artist_names) || artist_names.length === 0) {
        return res.status(400).json({ error: '標題和至少一位歌手名稱為必填項。' });
    }
    if (scores && !Array.isArray(scores)) {
        return res.status(400).json({ error: '樂譜資料格式不正確，應為陣列。' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const musicUpdateQuery = `
            UPDATE music
            SET title = $1, release_date = $2, description = $3, cover_art_url = $4, platform_url = $5, youtube_video_id = $6, updated_at = NOW()
            WHERE id = $7;
        `;
        await client.query(musicUpdateQuery, [
            title,
            release_date || null,
            description || null,
            cover_art_url || null,
            platform_url || null,
            youtube_video_id || null,
            musicId
        ]);

        await client.query('DELETE FROM music_artists WHERE music_id = $1', [musicId]);
        for (const artistName of artist_names) {
            let artistResult = await client.query('SELECT id FROM artists WHERE name = $1', [artistName.trim()]);
            let artistId;
            if (artistResult.rows.length > 0) {
                artistId = artistResult.rows[0].id;
            } else {
                artistResult = await client.query('INSERT INTO artists (name) VALUES ($1) RETURNING id', [artistName.trim()]);
                artistId = artistResult.rows[0].id;
            }
            await client.query('INSERT INTO music_artists (music_id, artist_id) VALUES ($1, $2)', [musicId, artistId]);
        }

        await client.query('DELETE FROM scores WHERE music_id = $1', [musicId]);
        if (scores && scores.length > 0) {
            for (const score of scores) {
                const { type, pdf_url, display_order } = score;
                if (type && pdf_url) {
                    await client.query(
                        'INSERT INTO scores (music_id, type, pdf_url, display_order) VALUES ($1, $2, $3, $4)',
                        [musicId, type, pdf_url, display_order || 0]
                    );
                }
            }
        }

        await client.query('COMMIT');

        const updatedMusicQuery = `
            SELECT
                m.id, m.title, m.cover_art_url, m.platform_url, m.release_date, m.description, m.youtube_video_id,
                m.created_at, m.updated_at,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name ASC)
                     FROM artists a
                     JOIN music_artists ma ON ma.artist_id = a.id
                     WHERE ma.music_id = m.id),
                    '[]'::json
                ) AS artists,
                COALESCE(
                    (SELECT json_agg(s.* ORDER BY s.display_order ASC, s.type ASC)
                     FROM scores s
                     WHERE s.music_id = m.id),
                    '[]'::json
                ) AS scores
            FROM music m
            WHERE m.id = $1;
        `;
        const updatedMusicResult = await pool.query(updatedMusicQuery, [musicId]);
        if (updatedMusicResult.rows.length === 0) {
            return res.status(404).json({ error: '更新後找不到音樂' });
        }
        res.status(200).json(updatedMusicResult.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`更新音樂 ID ${musicId} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '更新音樂時發生內部伺服器錯誤' });
    } finally {
        client.release();
    }
});

// DELETE /api/music/:id - 刪除音樂
app.delete('/api/music/:id', async (req, res) => {
    const { id } = req.params;
    const musicId = parseInt(id, 10);

    if (isNaN(musicId)) {
        return res.status(400).json({ error: '無效的音樂 ID' });
    }

    try {
        const result = await pool.query('DELETE FROM music WHERE id = $1 RETURNING id', [musicId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要刪除的音樂' });
        }

        res.status(204).send();
    } catch (err) {
        console.error(`刪除音樂 ID ${musicId} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '刪除音樂時發生內部伺服器錯誤' });
    }
});

// --- 新聞 API ---
app.get('/api/news', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category || null;

    if (page <= 0 || limit <= 0) {
        return res.status(400).json({ error: '頁碼和每頁數量必須是正整數。' });
    }

    const offset = (page - 1) * limit;
    try {
        let whereClause = '';
        const queryParams = [];
        let paramIndex = 1;

        // 添加分類過濾條件 - 修改這部分
        if (category) {
            // 檢查是否為數字類型
            if (!isNaN(category)) {
                // 數字類型，與 ID 比較，使用整數比較
                whereClause = `WHERE c.id = $${paramIndex}`;
                queryParams.push(parseInt(category));
            } else {
                // 非數字，與 slug 比較，使用字符串比較
                whereClause = `WHERE c.slug = $${paramIndex}`;
                queryParams.push(category);
            }
            paramIndex++;
        }

        // 首先查詢總數
        const countQuery = `
            SELECT COUNT(*) 
            FROM news n
            LEFT JOIN news_categories c ON n.category_id = c.id
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);

        // 複製查詢參數，添加limit和offset
        const dataQueryParams = [...queryParams];
        dataQueryParams.push(limit, offset);

        // 獲取新聞列表，包含分類信息
        const newsQuery = `
            SELECT n.id, n.title, n.event_date, n.summary, n.thumbnail_url, 
                   n.like_count, n.updated_at,
                   c.id AS category_id, c.name AS category_name, c.slug AS category_slug
            FROM news n
            LEFT JOIN news_categories c ON n.category_id = c.id
            ${whereClause}
            ORDER BY n.event_date DESC, n.id DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        const newsResult = await pool.query(newsQuery, dataQueryParams);

        const totalPages = Math.ceil(totalItems / limit);
        res.status(200).json({
            totalItems,
            totalPages,
            currentPage: page,
            limit,
            news: newsResult.rows
        });
    } catch (err) {
        console.error('獲取最新消息列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 修改獲取單個新聞API，添加分類信息
app.get('/api/news/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的消息 ID 格式。' });
    }

    try {
        const result = await pool.query(`
            SELECT n.id, n.title, n.event_date, n.summary, n.content, 
                   n.thumbnail_url, n.image_url, n.like_count, n.updated_at,
                   c.id AS category_id, c.name AS category_name, c.slug AS category_slug
            FROM news n
            LEFT JOIN news_categories c ON n.category_id = c.id
            WHERE n.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到該消息。' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`獲取消息 ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.post('/api/news/:id/like', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); }
    try {
        const result = await pool.query('UPDATE news SET like_count = like_count + 1 WHERE id = $1 RETURNING like_count', [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到要按讚的消息。' }); }
        res.status(200).json({ like_count: result.rows[0].like_count });
    } catch (err) {
        console.error(`處理消息 ID ${id} 按讚時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});





// --- 分類 API (非管理，用於前台展示) ---
app.get('/api/news-categories', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, slug, description, display_order 
            FROM news_categories 
            WHERE is_active = TRUE
            ORDER BY display_order ASC, name ASC
        `);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('獲取新聞分類時出錯:', err.stack || err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});






// 修改：更新商品 (包含處理標籤更新)
app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    // 從 req.body 接收商品資料，假設 tags 是 tag_id 的陣列，例如 [1, 3] 或 [] 或 null
    const { name, description, price, image_url, category, seven_eleven_url, tags } = req.body;

    // --- 基本驗證 ---
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的商品 ID 格式。' });
    }
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: '商品名稱不能為空。' });
    }
    if (tags && !Array.isArray(tags)) {
        return res.status(400).json({ error: '標籤資料格式不正確，應為陣列。' });
    }
    if (tags && tags.some(tag => typeof tag !== 'number' || !Number.isInteger(tag))) {
        return res.status(400).json({ error: '標籤 ID 必須是整數。' });
    }
    // ... 其他驗證 ...

    // --- 資料庫交易 ---
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // 開始交易

        // 1. 更新 products 表的基本資料
        const productUpdateQuery = `
            UPDATE products 
            SET name = $1, 
                description = $2, 
                price = $3, 
                image_url = $4, 
                category = $5, 
                seven_eleven_url = $6,
                updated_at = NOW() 
            WHERE id = $7`;

        await client.query(productUpdateQuery, [
            name.trim(),
            description || null,
            price,
            image_url || null,
            category || null,
            seven_eleven_url || null,
            id
        ]);

        // 2. 刪除該商品所有舊的標籤關聯
        const deleteTagsQuery = 'DELETE FROM product_tags WHERE product_id = $1';
        await client.query(deleteTagsQuery, [id]);

        // 3. 如果新的 tags 陣列存在且不為空，則插入新的關聯
        const validTags = tags ? tags.filter(tagId => typeof tagId === 'number' && Number.isInteger(tagId)) : []; // 再次驗證
        if (validTags.length > 0) {
            const insertTagsQuery = `
                INSERT INTO product_tags (product_id, tag_id)
                SELECT $1, tag_id FROM UNNEST($2::int[]) AS t(tag_id)
                ON CONFLICT (product_id, tag_id) DO NOTHING`; // 忽略可能的重複 (理論上不會，因為先刪了)
            await client.query(insertTagsQuery, [id, validTags]);
        }

        await client.query('COMMIT'); // 提交交易

        // 4. 查詢更新後的完整商品資料 (包含最新的標籤) 回傳給前端
        //    使用我們之前修改好的 GET /api/products/:id 的查詢邏輯
        const getUpdatedProductQuery = `
            SELECT 
                p.id, p.name, p.description, p.price, p.image_url, 
                p.seven_eleven_url, p.click_count, p.category,
                COALESCE(json_agg(t.tag_name) FILTER (WHERE t.tag_id IS NOT NULL), '[]'::json) AS tags
            FROM products p
            LEFT JOIN product_tags pt ON p.id = pt.product_id
            LEFT JOIN tags t ON pt.tag_id = t.tag_id
            WHERE p.id = $1
            GROUP BY p.id, p.name, p.description, p.price, p.image_url, p.seven_eleven_url, p.click_count, p.category
        `;
        const updatedResult = await pool.query(getUpdatedProductQuery, [id]); // 注意：這裡用 pool 查詢即可，交易已提交

        if (updatedResult.rows.length === 0) {
            // 理論上不應該發生，因為我們是先更新再查詢
            return res.status(404).json({ error: '更新後找不到商品。' });
        }

        res.status(200).json(updatedResult.rows[0]); // 回傳更新後的商品資料

    } catch (err) {
        await client.query('ROLLBACK'); // 出錯時回滾
        console.error(`更新商品 ID ${id} 時出錯 (交易已回滾):`, err);
        if (err.code === '23503') { // Foreign key violation on insert
            return res.status(400).json({ error: '提交的標籤 ID 無效或不存在。' });
        }
        res.status(500).json({ error: '伺服器內部錯誤，無法更新商品。' });
    } finally {
        client.release(); // 釋放連接
    }
});





// --- 頁面分析相關的 API ---
app.get('/api/analytics/page-list', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT page 
            FROM page_views 
            ORDER BY page ASC
        `);
        const pages = result.rows.map(row => row.page);
        res.json(pages);
    } catch (err) {
        console.error('獲取頁面列表失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.get('/api/analytics/page-views', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const query = `
            SELECT page, view_date, SUM(view_count)::int AS count 
            FROM page_views 
            WHERE view_date BETWEEN $1 AND $2
            GROUP BY page, view_date 
            ORDER BY view_date ASC, page ASC
        `;
        const result = await pool.query(query, [
            startDate || '2023-01-01',
            endDate || 'CURRENT_DATE'
        ]);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取頁面訪問數據失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.get('/api/analytics/page-views/ranking', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        let query = `
            SELECT page, SUM(view_count)::int AS total_count 
            FROM page_views 
        `;

        const queryParams = [];
        if (startDate && endDate) {
            query += `WHERE view_date BETWEEN $1 AND $2 `;
            queryParams.push(startDate, endDate);
        }

        query += `GROUP BY page ORDER BY total_count DESC`;

        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取頁面排名數據失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// --- 流量分析 API 修正 ---
app.get('/api/analytics/traffic', async (req, res) => {
    // 添加日期範圍參數支持
    const { startDate, endDate } = req.query;

    let queryText = `
        SELECT view_date AS date, SUM(view_count)::bigint AS count 
        FROM page_views
    `;

    const queryParams = [];
    if (startDate && endDate) {
        queryText += ` WHERE view_date BETWEEN $1 AND $2`;
        queryParams.push(startDate, endDate);
    } else {
        // 默認返回最近30天
        const daysToFetch = 30;
        const defaultStartDate = new Date();
        defaultStartDate.setDate(defaultStartDate.getDate() - daysToFetch);
        const startDateString = defaultStartDate.toISOString().split('T')[0];

        queryText += ` WHERE view_date >= $1`;
        queryParams.push(startDateString);
    }

    queryText += ` GROUP BY view_date ORDER BY view_date ASC`;

    try {
        const result = await pool.query(queryText, queryParams);
        const trafficData = result.rows.map(row => ({
            date: new Date(row.date).toISOString().split('T')[0],
            count: parseInt(row.count)
        }));
        res.status(200).json(trafficData);
    } catch (err) {
        console.error('獲取流量數據時發生錯誤:', err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取流量數據。' });
    }
});

app.get('/api/analytics/monthly-traffic', async (req, res) => {
    // 添加日期範圍參數支持
    const { startDate, endDate, year } = req.query;
    const targetYear = year ? parseInt(year) : null;

    let queryText = `
        SELECT to_char(date_trunc('month', view_date), 'YYYY-MM') AS month, 
               SUM(view_count)::bigint AS count 
        FROM page_views
    `;

    const queryParams = [];
    let paramIndex = 1;

    // 條件邏輯
    if (startDate && endDate) {
        queryText += ` WHERE view_date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
        queryParams.push(startDate, endDate);
    } else if (targetYear && !isNaN(targetYear)) {
        queryText += ` WHERE date_part('year', view_date) = $${paramIndex++}`;
        queryParams.push(targetYear);
    }

    queryText += ` GROUP BY month ORDER BY month ASC`;

    try {
        const result = await pool.query(queryText, queryParams);
        const monthlyTrafficData = result.rows.map(row => ({
            month: row.month,
            count: parseInt(row.count)
        }));
        res.status(200).json(monthlyTrafficData);
    } catch (err) {
        console.error('獲取月度流量數據時發生錯誤:', err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取月度流量數據。' });
    }
});

// --- 新增來源分析相關的 API 端點 ---
app.get('/api/analytics/source-traffic', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const query = `
            SELECT 
                source_type,
                source_name,
                SUM(view_count) as total_views,
                COUNT(DISTINCT page) as unique_pages
            FROM source_page_views
            WHERE view_date BETWEEN $1 AND $2
            GROUP BY source_type, source_name
            ORDER BY total_views DESC;
        `;
        const result = await pool.query(query, [
            startDate || '2023-01-01',
            endDate || 'CURRENT_DATE'
        ]);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取來源分析數據失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.get('/api/analytics/source-pages', async (req, res) => {
    const { sourceType, sourceName, startDate, endDate } = req.query;
    try {
        const query = `
            SELECT 
                page,
                SUM(view_count) as views
            FROM source_page_views
            WHERE source_type = $1
            AND source_name = $2
            AND view_date BETWEEN $3 AND $4
            GROUP BY page
            ORDER BY views DESC;
        `;
        const result = await pool.query(query, [
            sourceType,
            sourceName,
            startDate || '2023-01-01',
            endDate || 'CURRENT_DATE'
        ]);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取來源頁面數據失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.get('/api/analytics/source-trend', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const query = `
            SELECT 
                view_date,
                source_type,
                SUM(view_count) as views
            FROM source_page_views
            WHERE view_date BETWEEN $1 AND $2
            GROUP BY view_date, source_type
            ORDER BY view_date ASC, source_type;
        `;
        const result = await pool.query(query, [
            startDate || '2023-01-01',
            endDate || 'CURRENT_DATE'
        ]);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取來源趨勢數據失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// --- 新增缺少的來源分析 API 端點 ---
app.get('/api/analytics/source-details', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const query = `
            SELECT 
                source_type,
                source_name,
                source_url,
                SUM(view_count) as total_views,
                COUNT(DISTINCT page) as unique_pages,
                AVG(time_on_site) as avg_time_on_site,
                AVG(CASE WHEN is_bounce THEN 1 ELSE 0 END) as bounce_rate,
                AVG(CASE WHEN has_conversion THEN 1 ELSE 0 END) as conversion_rate
            FROM source_page_views
            WHERE view_date BETWEEN $1 AND $2
            GROUP BY source_type, source_name, source_url
            ORDER BY total_views DESC;
        `;
        const result = await pool.query(query, [
            startDate || '2023-01-01',
            endDate || 'CURRENT_DATE'
        ]);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取來源詳細數據失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.get('/api/analytics/source-ranking', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const query = `
            SELECT 
                source_type,
                source_name,
                SUM(view_count) as total_views
            FROM source_page_views
            WHERE view_date BETWEEN $1 AND $2
            GROUP BY source_type, source_name
            ORDER BY total_views DESC
            LIMIT 20;
        `;
        const result = await pool.query(query, [
            startDate || '2023-01-01',
            endDate || 'CURRENT_DATE'
        ]);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取來源排名數據失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.get('/api/analytics/source-conversion', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const query = `
            SELECT 
                source_type,
                SUM(view_count) as total_views,
                AVG(CASE WHEN has_conversion THEN 1 ELSE 0 END) as conversion_rate
            FROM source_page_views
            WHERE view_date BETWEEN $1 AND $2
            GROUP BY source_type
            ORDER BY conversion_rate DESC;
        `;
        const result = await pool.query(query, [
            startDate || '2023-01-01',
            endDate || 'CURRENT_DATE'
        ]);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取來源轉換率數據失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.get('/api/analytics/source-geo', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const query = `
            SELECT 
                region,
                SUM(view_count) as views
            FROM source_page_views
            WHERE view_date BETWEEN $1 AND $2
            GROUP BY region
            ORDER BY views DESC;
        `;
        const result = await pool.query(query, [
            startDate || '2023-01-01',
            endDate || 'CURRENT_DATE'
        ]);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取來源地理數據失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});


// --- ★★★ 留言板管理 API (Admin Guestbook API) ★★★ ---


// --- 身份管理 (Identities Management) ---
adminRouter.get('/identities', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, description FROM admin_identities ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) { console.error('[API GET /admin/identities] Error:', err); res.status(500).json({ error: '無法獲取身份列表' }); }
});
adminRouter.post('/identities', async (req, res) => {
    const { name, description } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: '身份名稱為必填項。' });
    try {
        const result = await pool.query('INSERT INTO admin_identities (name, description) VALUES ($1, $2) RETURNING *', [name.trim(), description ? description.trim() : null]);
        res.status(201).json(result.rows[0]);
    } catch (err) { if (err.code === '23505') return res.status(409).json({ error: '身份名稱已存在' }); console.error('[API POST /admin/identities] Error:', err); res.status(500).json({ error: '無法新增身份' }); }
});
adminRouter.put('/identities/:id', async (req, res) => {
    const { id } = req.params; const identityId = parseInt(id, 10); const { name, description } = req.body; if (isNaN(identityId)) return res.status(400).json({ error: '無效的 ID' }); if (!name || name.trim() === '') return res.status(400).json({ error: '身份名稱為必填項。' });
    try {
        const result = await pool.query('UPDATE admin_identities SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *', [name.trim(), description ? description.trim() : null, identityId]);
        if (result.rowCount === 0) return res.status(404).json({ error: '找不到要更新的身份' }); res.json(result.rows[0]);
    } catch (err) { if (err.code === '23505') return res.status(409).json({ error: '身份名稱已存在' }); console.error(`[API PUT /admin/identities/${id}] Error:`, err); res.status(500).json({ error: '無法更新身份' }); }
});
adminRouter.delete('/identities/:id', async (req, res) => {
    const { id } = req.params; const identityId = parseInt(id, 10); if (isNaN(identityId)) return res.status(400).json({ error: '無效的 ID' });
    try {
        const result = await pool.query('DELETE FROM admin_identities WHERE id = $1', [identityId]);
        if (result.rowCount === 0) return res.status(404).json({ error: '找不到要刪除的身份' }); res.status(204).send();
    } catch (err) { console.error(`[API DELETE /admin/identities/${id}] Error:`, err); res.status(500).json({ error: '無法刪除身份' }); }
});






// [voitRouter code moved to an earlier position in the file]



// --- 在 server.js 的 adminRouter 部分添加 ---


// GET /api/admin/news-categories/:id - 獲取單個分類進行編輯
adminRouter.get('/news-categories/:id', async (req, res) => {
    const { id } = req.params;
    const categoryId = parseInt(id);

    // 驗證 ID 是否為有效數字
    if (isNaN(categoryId)) {
        return res.status(400).json({ error: '無效的分類 ID 格式。' });
    }

    try {
        // 從資料庫查詢特定 ID 的分類
        const result = await pool.query(
            `SELECT id, name, slug, description, display_order, is_active 
                 FROM news_categories 
                 WHERE id = $1`,
            [categoryId]
        );

        // 檢查是否找到分類
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到該分類。' }); // 返回 404
        }

        // 返回找到的分類數據
        res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error(`[受保護 API 錯誤] 獲取管理分類 ID ${id} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取分類詳情' });
    }
});







// --- 新增: 管理員發表新留言 API (已更新處理 image_url) ---
adminRouter.post('/guestbook/messages', async (req, res) => {
    // 從請求 body 中獲取 image_url
    const { admin_identity_id, content, image_url } = req.body;
    const identityIdInt = parseInt(admin_identity_id, 10);
    // 驗證 image_url (如果是提供的)
    const imageUrlToSave = (image_url && typeof image_url === 'string' && image_url.trim() !== '') ? image_url.trim() : null;

    if (isNaN(identityIdInt)) { return res.status(400).json({ error: '無效的管理員身份 ID。' }); }
    if (!content || content.trim() === '') { return res.status(400).json({ error: '留言內容不能為空。' }); }
    const trimmedContent = content.trim();

    const client = await pool.connect();
    try {
        const identityResult = await client.query('SELECT name FROM admin_identities WHERE id = $1', [identityIdInt]);
        if (identityResult.rowCount === 0) { return res.status(400).json({ error: '找不到指定的管理員身份。' }); }
        const adminIdentityName = identityResult.rows[0].name;

        const insertQuery = `
            INSERT INTO guestbook_messages (
                author_name, content, image_url, 
                is_admin_post, admin_identity_id,
                last_activity_at, created_at, is_visible,
                reply_count, view_count, like_count
            )
            VALUES ($1, $2, $3, TRUE, $4, NOW(), NOW(), TRUE, 0, 0, 0) 
            RETURNING id, author_name, content, image_url, is_admin_post, admin_identity_id, created_at, last_activity_at, reply_count, view_count, like_count, is_visible;
        `;
        // 調整參數順序以匹配 SQL
        const insertParams = [adminIdentityName, trimmedContent, imageUrlToSave, identityIdInt];
        const newMessageResult = await client.query(insertQuery, insertParams);

        console.log('[API POST /admin/guestbook/messages] 管理員留言已新增:', newMessageResult.rows[0]);
        res.status(201).json(newMessageResult.rows[0]);

    } catch (err) {
        console.error('[API POST /admin/guestbook/messages] Error:', err.stack || err);
        if (err.code === '23503') { return res.status(400).json({ error: '內部錯誤：關聯的管理員身份無效。' }); }
        res.status(500).json({ error: '無法新增管理員留言' });
    } finally { client.release(); }
});


// --- 留言板管理 (Guestbook Management) ---
adminRouter.get('/guestbook', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;
    const filter = req.query.filter || 'all';
    const search = req.query.search?.trim() || '';
    const sort = req.query.sort || 'latest';

    let orderByClause = 'ORDER BY m.last_activity_at DESC';
    if (sort === 'popular') orderByClause = 'ORDER BY m.view_count DESC, m.last_activity_at DESC';
    else if (sort === 'most_replies') orderByClause = 'ORDER BY m.reply_count DESC, m.last_activity_at DESC';

    let whereClauses = [];
    let countParams = [];
    let mainParams = [];
    let paramIndex = 1;

    if (filter === 'visible') whereClauses.push('m.is_visible = TRUE');
    else if (filter === 'hidden') whereClauses.push('m.is_visible = FALSE');
    else if (filter === 'reported') whereClauses.push('m.is_reported = TRUE'); // 新增對 reported 的篩選

    if (search) {
        whereClauses.push(`(m.author_name ILIKE $${paramIndex} OR m.content ILIKE $${paramIndex})`);
        const searchParam = `%${search}%`;
        countParams.push(searchParam);
        mainParams.push(searchParam);
        paramIndex++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const limitParamIndex = paramIndex++;
    const offsetParamIndex = paramIndex++;
    mainParams.push(limit);
    mainParams.push(offset);

    try {
        const countSql = `SELECT COUNT(*) FROM guestbook_messages m ${whereSql}`;
        const totalResult = await pool.query(countSql, countParams);
        const totalItems = parseInt(totalResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limit);

        const mainSql = `
            SELECT m.id, m.author_name,
                   substring(m.content for 50) || (CASE WHEN length(m.content) > 50 THEN '...' ELSE '' END) AS content_preview,
                   m.reply_count, m.view_count, m.like_count, m.last_activity_at, m.created_at, m.is_visible,
                   m.is_reported, m.can_be_reported
            FROM guestbook_messages m
            ${whereSql} ${orderByClause}
            LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
        const messagesResult = await pool.query(mainSql, mainParams);

        res.json({
            messages: messagesResult.rows,
            currentPage: page,
            totalPages: totalPages,
            totalItems: totalItems,
            limit: limit,
            sort: sort
        });
    } catch (err) { console.error('[API GET /admin/guestbook] Error:', err); res.status(500).json({ error: '無法獲取管理留言列表' }); }
});
adminRouter.get('/guestbook/message/:id', async (req, res) => {
    const { id } = req.params; const messageId = parseInt(id, 10); if (isNaN(messageId)) return res.status(400).json({ error: '無效的 ID' });
    const client = await pool.connect();
    try {
        const messageResult = await client.query('SELECT *, like_count, view_count FROM guestbook_messages WHERE id = $1', [messageId]);
        if (messageResult.rowCount === 0) return res.status(404).json({ error: '找不到留言' });

        const repliesResult = await client.query(
            `SELECT r.*, r.like_count, r.parent_reply_id, ai.name AS admin_identity_name,
                    r.is_reported, r.can_be_reported -- 新增 is_reported 和 can_be_reported for replies
             FROM guestbook_replies r
             LEFT JOIN admin_identities ai ON r.admin_identity_id = ai.id
             WHERE r.message_id = $1 ORDER BY r.created_at ASC`,
            [messageId]
        );
        res.json({ message: messageResult.rows[0], replies: repliesResult.rows });
    } catch (err) { console.error(`[API GET /admin/guestbook/message/${id}] Error:`, err); res.status(500).json({ error: '無法獲取留言詳情' }); } finally { client.release(); }
});


adminRouter.post('/guestbook/replies', async (req, res) => {
    // 從請求 body 中獲取 image_url
    const { message_id, parent_reply_id, content, admin_identity_id, image_url } = req.body;
    const messageIdInt = parseInt(message_id, 10);
    const identityIdInt = parseInt(admin_identity_id, 10);
    const parentIdInt = parent_reply_id ? parseInt(parent_reply_id, 10) : null;
    // 驗證 image_url (如果是提供的)
    const imageUrlToSave = (image_url && typeof image_url === 'string' && image_url.trim() !== '') ? image_url.trim() : null;

    if (isNaN(messageIdInt) || isNaN(identityIdInt) || (parentIdInt !== null && isNaN(parentIdInt))) {
        return res.status(400).json({ error: '無效的留言/父回覆/身份 ID' });
    }
    if (!content || content.trim() === '') {
        return res.status(400).json({ error: '回覆內容不能為空' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // 獲取管理員身份的名稱，用於 author_name
        const identityCheck = await client.query('SELECT name FROM admin_identities WHERE id = $1', [identityIdInt]);
        if (identityCheck.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: '無效的管理員身份' });
        }
        const adminAuthorName = identityCheck.rows[0].name; // 使用管理員身份的名稱作為作者

        // 插入回覆，包含 author_name 和 image_url
        const replyResult = await client.query(
            `INSERT INTO guestbook_replies (message_id, parent_reply_id, author_name, content, is_admin_reply, admin_identity_id, image_url, is_visible, like_count)
             VALUES ($1, $2, $3, $4, TRUE, $5, $6, TRUE, 0)
             RETURNING *, (SELECT name FROM admin_identities WHERE id = $5) AS admin_identity_name, image_url`, // 確保返回 image_url
            [messageIdInt, parentIdInt, adminAuthorName, content.trim(), identityIdInt, imageUrlToSave] // 傳入 adminAuthorName 和 imageUrlToSave
        );

        // 更新主留言的 reply_count 和 last_activity_at
        await client.query(
            'UPDATE guestbook_messages SET last_activity_at = NOW(), reply_count = reply_count + 1 WHERE id = $1',
            [messageIdInt]
        );

        await client.query('COMMIT');
        res.status(201).json(replyResult.rows[0]); // 返回新增的回覆
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[API POST /admin/guestbook/replies] Error:', err);
        // 更細緻的錯誤判斷
        if (err.code === '23503') { // 外鍵約束失敗
            if (err.constraint && (err.constraint.includes('message_id_fkey') || err.constraint.includes('parent_reply_id_fkey'))) {
                return res.status(404).json({ error: '找不到要回覆的留言或父回覆。' });
            }
            if (err.constraint && err.constraint.includes('admin_identity_id_fkey')) {
                return res.status(400).json({ error: '指定的管理員身份無效。' });
            }
        }
        res.status(500).json({ error: '無法新增管理員回覆' });
    } finally {
        client.release();
    }
});




adminRouter.put('/guestbook/messages/:id/visibility', async (req, res) => {
    const { id } = req.params; const messageId = parseInt(id, 10); const { is_visible } = req.body; if (isNaN(messageId) || typeof is_visible !== 'boolean') return res.status(400).json({ error: '無效的請求參數' });
    try {
        const result = await pool.query('UPDATE guestbook_messages SET is_visible = $1 WHERE id = $2 RETURNING id, is_visible', [is_visible, messageId]); if (result.rowCount === 0) return res.status(404).json({ error: '找不到留言' }); res.json(result.rows[0]);
    } catch (err) { console.error(`[API PUT /admin/guestbook/messages/${id}/visibility] Error:`, err); res.status(500).json({ error: '無法更新留言狀態' }); }
});
adminRouter.put('/guestbook/replies/:id/visibility', async (req, res) => {
    const { id } = req.params; const replyId = parseInt(id, 10); const { is_visible } = req.body; if (isNaN(replyId) || typeof is_visible !== 'boolean') return res.status(400).json({ error: '無效的請求參數' });
    try {
        const result = await pool.query('UPDATE guestbook_replies SET is_visible = $1 WHERE id = $2 RETURNING id, is_visible', [is_visible, replyId]); if (result.rowCount === 0) return res.status(404).json({ error: '找不到回覆' }); res.json(result.rows[0]);
    } catch (err) { console.error(`[API PUT /admin/guestbook/replies/${id}/visibility] Error:`, err); res.status(500).json({ error: '無法更新回覆狀態' }); }
});
adminRouter.delete('/guestbook/messages/:id', async (req, res) => {
    const { id } = req.params; const messageId = parseInt(id, 10); if (isNaN(messageId)) return res.status(400).json({ error: '無效的 ID' });
    try {
        const result = await pool.query('DELETE FROM guestbook_messages WHERE id = $1', [messageId]); if (result.rowCount === 0) return res.status(404).json({ error: '找不到要刪除的留言' }); res.status(204).send();
    } catch (err) { console.error(`[API DELETE /admin/guestbook/messages/${id}] Error:`, err); res.status(500).json({ error: '無法刪除留言' }); }
});
adminRouter.delete('/guestbook/replies/:id', async (req, res) => {
    const { id } = req.params; const replyId = parseInt(id, 10); if (isNaN(replyId)) return res.status(400).json({ error: '無效的 ID' });
    const client = await pool.connect(); try {
        await client.query('BEGIN'); const deleteResult = await client.query('DELETE FROM guestbook_replies WHERE id = $1', [replyId]); if (deleteResult.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: '找不到要刪除的回覆' }); } await client.query('COMMIT'); res.status(204).send();
    } catch (err) { await client.query('ROLLBACK'); console.error(`[API DELETE /admin/guestbook/replies/${id}] Error:`, err); res.status(500).json({ error: '無法刪除回覆' }); } finally { client.release(); }
});

// 新增：GET /api/admin/guestbook/reported-content - 獲取所有已檢舉的內容
adminRouter.get('/guestbook/reported-content', async (req, res) => {
    try {
        const query = `
            SELECT
                id,
                author_name,
                substring(content for 100) as content_preview,
                created_at,
                updated_at,
                is_visible,
                is_reported,
                can_be_reported,
                'message' AS type,
                NULL AS message_id,
                NULL AS parent_reply_id,
                NULL AS admin_identity_name
            FROM guestbook_messages
            WHERE is_reported = TRUE

            UNION ALL

            SELECT
                r.id,
                r.author_name,
                substring(r.content for 100) as content_preview,
                r.created_at,
                r.updated_at,
                r.is_visible,
                r.is_reported,
                r.can_be_reported,
                'reply' AS type,
                r.message_id,
                r.parent_reply_id,
                ai.name AS admin_identity_name
            FROM guestbook_replies r
            LEFT JOIN admin_identities ai ON r.admin_identity_id = ai.id
            WHERE r.is_reported = TRUE
            
            ORDER BY created_at DESC;
        `;
        const result = await pool.query(query);
        res.json({
            reportedItems: result.rows,
            totalReported: result.rowCount
        });
    } catch (err) {
        console.error('[API GET /admin/guestbook/reported-content] Error:', err);
        res.status(500).json({ error: '無法獲取已檢舉內容列表' });
    }
});

// PUT /api/admin/guestbook/messages/:id/status - 更新主留言的狀態 (is_visible, is_reported, can_be_reported)
adminRouter.put('/guestbook/messages/:id/status', async (req, res) => {
    const { id } = req.params;
    const messageId = parseInt(id, 10);
    const { is_visible, is_reported, can_be_reported } = req.body;

    if (isNaN(messageId)) {
        return res.status(400).json({ error: '無效的留言 ID' });
    }

    const updateFields = [];
    const queryParams = [];
    let paramIndex = 1;

    if (typeof is_visible === 'boolean') {
        updateFields.push(`is_visible = $${paramIndex++}`);
        queryParams.push(is_visible);
    }
    if (typeof is_reported === 'boolean') {
        updateFields.push(`is_reported = $${paramIndex++}`);
        queryParams.push(is_reported);
    }
    if (typeof can_be_reported === 'boolean') {
        updateFields.push(`can_be_reported = $${paramIndex++}`);
        queryParams.push(can_be_reported);
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ error: '沒有提供要更新的狀態欄位' });
    }

    updateFields.push(`updated_at = NOW()`); // 總是更新 updated_at
    updateFields.push(`last_activity_at = NOW()`); // 操作也視為活動

    queryParams.push(messageId); // 最後一個參數是 ID

    try {
        const query = `UPDATE guestbook_messages SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await pool.query(query, queryParams);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的留言' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`[API PUT /admin/guestbook/messages/${id}/status] Error:`, err);
        res.status(500).json({ error: '更新留言狀態失敗' });
    }
});

// PUT /api/admin/guestbook/replies/:id/status - 更新回覆的狀態 (is_visible, is_reported, can_be_reported)
adminRouter.put('/guestbook/replies/:id/status', async (req, res) => {
    const { id } = req.params;
    const replyId = parseInt(id, 10);
    const { is_visible, is_reported, can_be_reported } = req.body;

    if (isNaN(replyId)) {
        return res.status(400).json({ error: '無效的回覆 ID' });
    }

    const updateFields = [];
    const queryParams = [];
    let paramIndex = 1;

    if (typeof is_visible === 'boolean') {
        updateFields.push(`is_visible = $${paramIndex++}`);
        queryParams.push(is_visible);
    }
    if (typeof is_reported === 'boolean') {
        updateFields.push(`is_reported = $${paramIndex++}`);
        queryParams.push(is_reported);
    }
    if (typeof can_be_reported === 'boolean') {
        updateFields.push(`can_be_reported = $${paramIndex++}`);
        queryParams.push(can_be_reported);
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ error: '沒有提供要更新的狀態欄位' });
    }

    updateFields.push(`updated_at = NOW()`); // 總是更新 updated_at
    queryParams.push(replyId); // 最後一個參數是 ID

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const query = `UPDATE guestbook_replies SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await client.query(query, queryParams);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到要更新的回覆' });
        }

        // 如果回覆狀態改變，也更新主留言的 last_activity_at
        const messageIdResult = await client.query('SELECT message_id FROM guestbook_replies WHERE id = $1', [replyId]);
        if (messageIdResult.rowCount > 0) {
            await client.query('UPDATE guestbook_messages SET last_activity_at = NOW() WHERE id = $1', [messageIdResult.rows[0].message_id]);
        }

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[API PUT /admin/guestbook/replies/${id}/status] Error:`, err);
        res.status(500).json({ error: '更新回覆狀態失敗' });
    } finally {
        client.release();
    }
});


// --- 新聞管理 API (Admin News API) ---
adminRouter.get('/news', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, event_date, summary, content, thumbnail_url, image_url, like_count, created_at, updated_at
             FROM news
             ORDER BY updated_at DESC, id DESC`
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('[受保護 API 錯誤] 獲取管理消息列表時出錯:', err.stack || err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取消息列表' });
    }
});
adminRouter.get('/news/:id', async (req, res) => {
    const { id } = req.params;
    const newsId = parseInt(id);
    if (isNaN(newsId)) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); }
    try {
        const result = await pool.query(
            `SELECT id, title, event_date, summary, content, thumbnail_url, image_url, like_count, created_at, updated_at
             FROM news WHERE id = $1`,
            [newsId]
        );
        if (result.rows.length === 0) { return res.status(404).json({ error: '找不到該消息。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`[受保護 API 錯誤] 獲取管理消息 ID ${id} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取消息詳情' });
    }
});
adminRouter.post('/news', async (req, res) => {
    const { title, event_date, summary, content, thumbnail_url, image_url, category_id } = req.body;

    if (!title || title.trim() === '') {
        return res.status(400).json({ error: '消息標題為必填項。' });
    }

    try {
        // 如果提供了category_id，檢查該分類是否存在
        if (category_id) {
            const categoryCheck = await pool.query('SELECT 1 FROM news_categories WHERE id = $1', [category_id]);
            if (categoryCheck.rowCount === 0) {
                return res.status(400).json({ error: '所選分類不存在。' });
            }
        }

        const result = await pool.query(`
            INSERT INTO news (title, event_date, summary, content, thumbnail_url, image_url, category_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING *
        `, [
            title.trim(),
            event_date || null,
            summary ? summary.trim() : null,
            content ? content.trim() : null,
            thumbnail_url ? thumbnail_url.trim() : null,
            image_url ? image_url.trim() : null,
            category_id || null
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[受保護 API 錯誤] 新增消息時出錯:', err.stack || err);
        res.status(500).json({ error: '新增消息過程中發生伺服器內部錯誤。' });
    }
});
adminRouter.put('/news/:id', async (req, res) => {
    const { id } = req.params;
    const newsId = parseInt(id);
    if (isNaN(newsId)) {
        return res.status(400).json({ error: '無效的消息 ID 格式。' });
    }

    const { title, event_date, summary, content, thumbnail_url, image_url, category_id } = req.body;

    if (!title || title.trim() === '') {
        return res.status(400).json({ error: '消息標題為必填項。' });
    }

    try {
        // 如果提供了category_id，檢查該分類是否存在
        if (category_id) {
            const categoryCheck = await pool.query('SELECT 1 FROM news_categories WHERE id = $1', [category_id]);
            if (categoryCheck.rowCount === 0) {
                return res.status(400).json({ error: '所選分類不存在。' });
            }
        }

        const result = await pool.query(`
            UPDATE news
            SET title = $1, event_date = $2, summary = $3, content = $4, 
                thumbnail_url = $5, image_url = $6, category_id = $7, updated_at = NOW()
            WHERE id = $8
            RETURNING *
        `, [
            title.trim(),
            event_date || null,
            summary ? summary.trim() : null,
            content ? content.trim() : null,
            thumbnail_url ? thumbnail_url.trim() : null,
            image_url ? image_url.trim() : null,
            category_id || null,
            newsId
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的消息。' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`[受保護 API 錯誤] 更新消息 ID ${id} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '更新消息過程中發生伺服器內部錯誤。' });
    }
});
adminRouter.delete('/news/:id', async (req, res) => {
    const { id } = req.params;
    const newsId = parseInt(id);
    if (isNaN(newsId)) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); }
    try {
        const result = await pool.query('DELETE FROM news WHERE id = $1', [newsId]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到要刪除的消息。' }); }
        res.status(204).send();
    } catch (err) {
        console.error(`[受保護 API 錯誤] 刪除消息 ID ${id} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '刪除消息過程中發生伺服器內部錯誤。' });
    }
});









// --- 遊戲管理 API (Admin) ---

// GET /api/admin/games - 獲取所有遊戲列表 (供管理頁面使用)
adminRouter.get('/games', async (req, res) => {
    try {
        // 管理頁面可能需要看到所有遊戲，包括未啟用的
        const result = await pool.query(
            `SELECT id, title, description, image_url, play_url, play_count, sort_order, is_active, created_at, updated_at 
             FROM games 
             ORDER BY sort_order ASC, id ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[Admin API Error] 獲取管理遊戲列表時出錯:', err.stack || err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取遊戲列表' });
    }
});

// GET /api/admin/games/:id - 獲取特定遊戲詳情 (供編輯表單使用)
adminRouter.get('/games/:id', async (req, res) => {
    const { id } = req.params;
    const gameId = parseInt(id);
    if (isNaN(gameId)) {
        return res.status(400).json({ error: '無效的遊戲 ID 格式。' });
    }
    try {
        const result = await pool.query(
            // games-admin.js 的 editGame 函數需要 title, description, play_url, image_url, sort_order, is_active, play_count
            `SELECT id, title, description, play_url, image_url, sort_order, is_active, play_count 
             FROM games 
             WHERE id = $1`,
            [gameId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到指定的遊戲。' });
        }
        res.json(result.rows[0]); // 返回找到的遊戲資料
    } catch (err) {
        console.error(`[Admin API Error] 獲取遊戲 ID ${id} 詳情時出錯:`, err.stack || err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取遊戲詳情' });
    }
});

// POST /api/admin/games - 新增一個遊戲
adminRouter.post('/games', async (req, res) => {
    // 從 games-admin.js 的 add-game-form 提交事件中得知需要這些欄位
    const { name, description, play_url, image_url, sort_order, is_active } = req.body;

    if (!name || !play_url) {
        return res.status(400).json({ error: '遊戲名稱和遊戲連結為必填項。' });
    }
    // 提供預設值或進行類型轉換
    const sortOrderInt = parseInt(sort_order) || 0;
    const isActiveBool = typeof is_active === 'boolean' ? is_active : (is_active === 'true' || is_active === '1'); // 處理前端傳來的可能是字串 'true'/'1'

    try {
        const result = await pool.query(
            `INSERT INTO games (title, description, play_url, image_url, sort_order, is_active, play_count, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), NOW()) 
             RETURNING *`, // 返回新增的完整記錄
            [name.trim(), description ? description.trim() : null, play_url.trim(), image_url ? image_url.trim() : null, sortOrderInt, isActiveBool]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[Admin API Error] 新增遊戲時出錯:', err.stack || err);
        res.status(500).json({ error: '新增遊戲過程中發生伺服器內部錯誤。' });
    }
});

// PUT /api/admin/games/:id - 更新一個現有遊戲
adminRouter.put('/games/:id', async (req, res) => {
    const { id } = req.params;
    const gameId = parseInt(id);
    if (isNaN(gameId)) {
        return res.status(400).json({ error: '無效的遊戲 ID 格式。' });
    }
    // 從 games-admin.js 的 edit-game-form 提交事件中得知需要這些欄位
    const { name, description, play_url, image_url, sort_order, is_active } = req.body;

    if (!name || !play_url) {
        return res.status(400).json({ error: '遊戲名稱和遊戲連結為必填項。' });
    }
    const sortOrderInt = parseInt(sort_order) || 0;
    const isActiveBool = typeof is_active === 'boolean' ? is_active : (is_active === 'true' || is_active === '1'); // 同上

    try {
        const result = await pool.query(
            `UPDATE games 
             SET title = $1, description = $2, play_url = $3, image_url = $4, sort_order = $5, is_active = $6, updated_at = NOW() 
             WHERE id = $7 
             RETURNING *`, // 返回更新後的完整記錄
            [name.trim(), description ? description.trim() : null, play_url.trim(), image_url ? image_url.trim() : null, sortOrderInt, isActiveBool, gameId]
        );
        if (result.rowCount === 0) {
            // 如果沒有任何行被更新，表示找不到該 ID
            return res.status(404).json({ error: '找不到要更新的遊戲。' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`[Admin API Error] 更新遊戲 ID ${id} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '更新遊戲過程中發生伺服器內部錯誤。' });
    }
});

// DELETE /api/admin/games/:id - 刪除一個遊戲
adminRouter.delete('/games/:id', async (req, res) => {
    const { id } = req.params;
    const gameId = parseInt(id);
    if (isNaN(gameId)) {
        return res.status(400).json({ error: '無效的遊戲 ID 格式。' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // 先刪除相關的遊玩記錄 (如果表格有外鍵約束且設置了 ON DELETE CASCADE，這步可能非必需，但明確刪除更安全)
        await client.query('DELETE FROM game_play_logs WHERE game_id = $1', [gameId]);
        // 再刪除遊戲本身
        const result = await client.query('DELETE FROM games WHERE id = $1', [gameId]);

        if (result.rowCount === 0) {
            // 如果沒有任何行被刪除，表示找不到該 ID
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '找不到要刪除的遊戲。' });
        }

        await client.query('COMMIT');
        res.status(204).send(); // 成功刪除，無內容返回
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Admin API Error] 刪除遊戲 ID ${id} 時出錯:`, err.stack || err);
        // 可能需要處理外鍵約束等錯誤
        res.status(500).json({ error: '刪除遊戲過程中發生伺服器內部錯誤。', detail: err.message });
    } finally {
        client.release();
    }
});

// GET /api/admin/games/stats/today - 獲取今日遊玩次數統計
adminRouter.get('/games/stats/today', async (req, res) => {
    try {
        // 計算 game_play_logs 表中今天 (從午夜開始) 的記錄數量
        const result = await pool.query(
            `SELECT COUNT(*)::integer AS today_count 
             FROM game_play_logs 
             WHERE play_date >= CURRENT_DATE` // CURRENT_DATE 代表今天的開始 (00:00:00)
        );
        // 確保返回的是一個物件，即使計數為 0
        res.json(result.rows[0] || { today_count: 0 });
    } catch (err) {
        console.error('[Admin API Error] 獲取今日遊戲遊玩統計時出錯:', err.stack || err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取今日統計' });
    }
});









// GET /api/admin/disk-files - 列出 /data/uploads 目錄下的實體檔案 (支持排序和分頁)
adminRouter.get('/disk-files', isAdminAuthenticated, async (req, res) => {
    try {
        const directoryPath = uploadDir;
        if (!fs.existsSync(directoryPath)) {
            console.error(`[API GET /admin/disk-files] 上傳目錄 ${directoryPath} 不存在。`);
            return res.status(500).json({ error: '伺服器配置錯誤：上傳目錄找不到。' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15; // 與資料庫檔案列表的預設值一致
        const sortBy = req.query.sortBy || 'date_desc'; // 預設按修改日期倒序

        const files = fs.readdirSync(directoryPath);
        let fileDetails = [];

        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            try {
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    const ext = path.extname(file).toLowerCase();
                    let type = 'other';
                    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
                        type = 'image';
                    } else if (ext === '.pdf') {
                        type = 'pdf';
                    }
                    fileDetails.push({
                        filename: file,
                        size: stats.size,
                        type: type,
                        urlPath: `/uploads/${file}`,
                        modifiedTimeMs: stats.mtimeMs, // 用於排序
                        modifiedTimeString: stats.mtime.toLocaleString() // 用於顯示
                    });
                }
            } catch (statErr) {
                console.warn(`[API GET /admin/disk-files] 無法獲取檔案 ${file} 的狀態:`, statErr.message);
            }
        }

        // 排序邏輯
        switch (sortBy) {
            case 'size_asc':
                fileDetails.sort((a, b) => a.size - b.size);
                break;
            case 'size_desc':
                fileDetails.sort((a, b) => b.size - a.size);
                break;
            case 'name_asc':
                fileDetails.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' }));
                break;
            case 'name_desc':
                fileDetails.sort((a, b) => b.filename.localeCompare(a.filename, undefined, { sensitivity: 'base' }));
                break;
            case 'date_asc':
                fileDetails.sort((a, b) => a.modifiedTimeMs - b.modifiedTimeMs);
                break;
            case 'date_desc':
            default: // 預設按修改時間倒序
                fileDetails.sort((a, b) => b.modifiedTimeMs - a.modifiedTimeMs);
                break;
        }

        // 分頁邏輯
        const totalItems = fileDetails.length;
        const totalPages = Math.ceil(totalItems / limit);
        const offset = (page - 1) * limit;
        const paginatedFiles = fileDetails.slice(offset, offset + limit);

        // 移除用於排序的 modifiedTimeMs，只保留 modifiedTimeString 給前端顯示
        const filesForResponse = paginatedFiles.map(({ modifiedTimeMs, ...rest }) => rest);

        res.json({
            files: filesForResponse,
            currentPage: page,
            totalPages: totalPages,
            totalItems: totalItems,
            limit: limit,
            sortBy: sortBy
        });

    } catch (err) {
        console.error('[API GET /admin/disk-files] 讀取磁碟檔案列表時出錯:', err);
        res.status(500).json({ error: '無法讀取伺服器上的檔案列表', detail: err.message });
    }
});

// DELETE /api/admin/disk-files/:filename - 刪除 /data/uploads 目錄下的指定實體檔案
adminRouter.delete('/disk-files/:filename', isAdminAuthenticated, async (req, res) => {
    const unsafeFilename = req.params.filename;

    // 安全性：清理檔名，只取基本名稱部分，防止路徑遍歷
    const filename = path.basename(unsafeFilename);

    // 再次驗證檔名，確保沒有惡意字元或路徑操作符
    if (filename !== unsafeFilename || filename.includes('..') || filename.includes('/')) {
        console.warn(`[API DELETE /admin/disk-files] 偵測到潛在不安全的檔名: ${unsafeFilename}`);
        return res.status(400).json({ error: '無效的檔案名稱。' });
    }

    const filePath = path.join(uploadDir, filename);

    // 安全性：再次確認解析後的路徑是否仍在 uploadDir 之下
    if (!filePath.startsWith(path.resolve(uploadDir) + path.sep)) {
        console.error(`[API DELETE /admin/disk-files] 嘗試刪除 uploadDir 之外的檔案: ${filePath}`);
        return res.status(400).json({ error: '試圖存取無效的檔案路徑。' });
    }

    try {
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath); // 使用異步 unlink
            console.log(`[API DELETE /admin/disk-files] 實體檔案已刪除: ${filePath}`);

            // 可選：如果此檔案也存在於 uploaded_files 資料庫中，也一併刪除記錄
            // 這需要根據檔名（或相對路徑 /uploads/filename）去查詢資料庫
            // 例如: const dbFilePath = '/uploads/' + filename;
            // await pool.query('DELETE FROM uploaded_files WHERE file_path = $1', [dbFilePath]);
            // console.log(`[API DELETE /admin/disk-files] 已嘗試從資料庫刪除對應記錄 (如果存在): ${dbFilePath}`);

            res.status(204).send(); // No Content, 表示成功刪除
        } else {
            console.warn(`[API DELETE /admin/disk-files] 嘗試刪除的檔案不存在: ${filePath}`);
            res.status(404).json({ error: '找不到要刪除的檔案。' });
        }
    } catch (err) {
        console.error(`[API DELETE /admin/disk-files] 刪除檔案 ${filePath} 時出錯:`, err);
        res.status(500).json({ error: '刪除檔案時發生伺服器內部錯誤。', detail: err.message });
    }
});

app.use('/api/admin', adminRouter); // 將 adminRouter 掛載到 /api/admin 路徑下


// --- 流量分析 API ---
app.get('/api/analytics/traffic', async (req, res) => {
    const daysToFetch = 30; const startDate = new Date(); startDate.setDate(startDate.getDate() - daysToFetch); const startDateString = startDate.toISOString().split('T')[0];
    try {
        const queryText = `SELECT view_date, SUM(view_count)::bigint AS count FROM page_views WHERE view_date >= $1 GROUP BY view_date ORDER BY view_date ASC`;
        const result = await pool.query(queryText, [startDateString]);
        const trafficData = result.rows.map(row => ({ date: new Date(row.view_date).toISOString().split('T')[0], count: parseInt(row.count) }));
        res.status(200).json(trafficData);
    } catch (err) { console.error('獲取流量數據時發生嚴重錯誤:', err); res.status(500).json({ error: '伺服器內部錯誤，無法獲取流量數據。' }); }
});
app.get('/api/analytics/monthly-traffic', async (req, res) => {
    const targetYear = req.query.year ? parseInt(req.query.year) : null;
    let queryText = `SELECT to_char(date_trunc('month', view_date), 'YYYY-MM') AS view_month, SUM(view_count)::bigint AS count FROM page_views`;
    const queryParams = [];
    if (targetYear && !isNaN(targetYear)) {
        queryText += ` WHERE date_part('year', view_date) = $1`;
        queryParams.push(targetYear);
    }
    queryText += ` GROUP BY view_month ORDER BY view_month ASC`;
    try {
        const result = await pool.query(queryText, queryParams);
        const monthlyTrafficData = result.rows.map(row => ({ month: row.view_month, count: parseInt(row.count) }));
        res.status(200).json(monthlyTrafficData);
    } catch (err) { console.error('獲取月度流量數據時發生嚴重錯誤:', err); res.status(500).json({ error: '伺服器內部錯誤，無法獲取月度流量數據。' }); }
});



// 添加到server.js
app.get('/api/analytics/page-views/ranking', async (req, res) => {
    try {
        const query = `
        SELECT page, SUM(view_count)::int AS total_count 
        FROM page_views 
        GROUP BY page 
        ORDER BY total_count DESC
      `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('获取页面排名数据失败:', err);
        res.status(500).json({ error: '服务器内部错误' });
    }
});



// 服务器端 - 新增API端点
app.get('/api/analytics/page-views', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const query = `
        SELECT page, view_date, SUM(view_count)::int AS count 
        FROM page_views 
        WHERE view_date BETWEEN $1 AND $2
        GROUP BY page, view_date 
        ORDER BY view_date ASC, page ASC
      `;
        const result = await pool.query(query, [startDate || '2023-01-01', endDate || 'CURRENT_DATE']);
        res.json(result.rows);
    } catch (err) {
        console.error('获取页面访问数据失败:', err);
        res.status(500).json({ error: '服务器内部错误' });
    }
});







// --- Banner 管理 API ---
app.get('/api/admin/banners', async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, image_url, link_url, display_order, alt_text, page_location, updated_at FROM banners ORDER BY display_order ASC, id ASC`);
        res.json(result.rows);
    } catch (err) { console.error('[Admin API Error] 獲取管理 Banners 時出錯:', err); res.status(500).json({ error: '伺服器內部錯誤' }); }
});
app.get('/api/admin/banners/:id', async (req, res) => {
    const { id } = req.params; if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    try {
        const result = await pool.query(`SELECT id, image_url, link_url, display_order, alt_text, page_location FROM banners WHERE id = $1`, [id]);
        if (result.rows.length === 0) { return res.status(404).json({ error: '找不到指定的 Banner。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) { console.error(`[Admin API Error] 獲取 Banner ID ${id} 時出錯:`, err); res.status(500).json({ error: '伺服器內部錯誤' }); }
});
app.post('/api/admin/banners', async (req, res) => {
    const { image_url, link_url, display_order, alt_text, page_location } = req.body;
    if (!image_url) return res.status(400).json({ error: '圖片網址不能為空。' }); if (!page_location) return res.status(400).json({ error: '必須指定顯示頁面。' });
    const order = (display_order !== undefined && display_order !== null) ? parseInt(display_order) : 0; if (isNaN(order)) return res.status(400).json({ error: '排序必須是數字。' });
    try {
        const result = await pool.query(`INSERT INTO banners (image_url, link_url, display_order, alt_text, page_location, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`, [image_url.trim(), link_url ? link_url.trim() : null, order, alt_text ? alt_text.trim() : null, page_location]);
        res.status(201).json(result.rows[0]);
    } catch (err) { console.error('[Admin API Error] 新增 Banner 時出錯:', err); res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' }); }
});
app.put('/api/admin/banners/:id', async (req, res) => {
    const { id } = req.params; if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    const { image_url, link_url, display_order, alt_text, page_location } = req.body; if (!image_url) return res.status(400).json({ error: '圖片網址不能為空。' }); if (!page_location) return res.status(400).json({ error: '必須指定顯示頁面。' });
    const order = (display_order !== undefined && display_order !== null) ? parseInt(display_order) : 0; if (isNaN(order)) return res.status(400).json({ error: '排序必須是數字。' });
    try {
        const result = await pool.query(`UPDATE banners SET image_url = $1, link_url = $2, display_order = $3, alt_text = $4, page_location = $5, updated_at = NOW() WHERE id = $6 RETURNING *`, [image_url.trim(), link_url ? link_url.trim() : null, order, alt_text ? alt_text.trim() : null, page_location, id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到 Banner，無法更新。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) { console.error(`[Admin API Error] 更新 Banner ID ${id} 時出錯:`, err); res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' }); }
});
app.delete('/api/admin/banners/:id', async (req, res) => {
    const { id } = req.params; if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    try {
        const result = await pool.query('DELETE FROM banners WHERE id = $1', [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到 Banner，無法刪除。' }); }
        res.status(204).send();
    } catch (err) { console.error(`[Admin API Error] 刪除 Banner ID ${id} 時出錯:`, err); res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' }); }
});




// ... rest of the code ...


// 新增: POST /api/admin/sales - 新增一筆銷售紀錄
app.post('/api/admin/sales', async (req, res) => {
    const { product_name, quantity_sold, sale_timestamp } = req.body;

    // 基本驗證
    if (!product_name || !quantity_sold || !sale_timestamp) {
        return res.status(400).json({ error: '請填寫所有必填欄位 (商品名稱, 銷售數量, 銷售時間)。' });
    }

    const quantity = parseInt(quantity_sold);
    if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ error: '銷售數量必須是有效的正整數。' });
    }

    let timestampToSave;
    try {
        // 確保時間戳有效並轉換為 ISO 字符串存入數據庫
        timestampToSave = new Date(sale_timestamp).toISOString();
    } catch (e) {
        return res.status(400).json({ error: '銷售時間格式無效。' });
    }

    try {
        // 假設 sales_log 表有 product_name, quantity_sold, sale_timestamp 和一個自動遞增的 id。
        // 如果您的表結構不同（例如，需要 figure_variation_id），請調整此查詢。
        const queryText = `
            INSERT INTO sales_log (product_name, quantity_sold, sale_timestamp)
            VALUES ($1, $2, $3)
            RETURNING *;  -- 返回新增的紀錄
        `;
        // 如果您的數據庫設計是通過 figure_variation_id 關聯的，
        // 您需要修改表單讓用戶選擇公仔/規格，然後在這裡傳入 figure_variation_id。
        // 目前根據表單，我們只有 product_name。
        const result = await pool.query(queryText, [product_name.trim(), quantity, timestampToSave]);

        console.log('[Admin API POST /sales] 新增銷售紀錄成功:', result.rows[0]);
        res.status(201).json(result.rows[0]); // 201 Created

    } catch (err) {
        console.error('[Admin API POST /sales] 新增銷售紀錄時出錯:', err.stack || err);
        res.status(500).json({ error: '新增銷售紀錄時發生伺服器內部錯誤。', detail: err.message });
    }
});

// 新增: PUT /api/admin/sales/:id - 更新現有的銷售紀錄
app.put('/api/admin/sales/:id', async (req, res) => {
    const { id } = req.params;
    const saleId = parseInt(id);
    if (isNaN(saleId)) {
        return res.status(400).json({ error: '無效的銷售紀錄 ID。' });
    }

    const { product_name, quantity_sold, sale_timestamp } = req.body;

    if (!product_name || !quantity_sold || !sale_timestamp) {
        return res.status(400).json({ error: '請填寫所有必填欄位 (商品名稱, 銷售數量, 銷售時間)。' });
    }
    const quantity = parseInt(quantity_sold);
    if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ error: '銷售數量必須是有效的正整數。' });
    }
    let timestampToSave;
    try {
        timestampToSave = new Date(sale_timestamp).toISOString();
    } catch (e) {
        return res.status(400).json({ error: '銷售時間格式無效。' });
    }

    try {
        // 假設有一個 `updated_at` 欄位需要更新為 NOW()
        const queryText = `
            UPDATE sales_log
            SET product_name = $1, quantity_sold = $2, sale_timestamp = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING *; -- 返回更新後的紀錄
        `;
        const result = await pool.query(queryText, [product_name.trim(), quantity, timestampToSave, saleId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的銷售紀錄。' });
        }
        console.log('[Admin API PUT /sales/:id] 更新銷售紀錄成功:', result.rows[0]);
        res.status(200).json(result.rows[0]); // 200 OK

    } catch (err) {
        console.error(`[Admin API PUT /sales/${id}] 更新銷售紀錄時出錯:`, err.stack || err);
        res.status(500).json({ error: '更新銷售紀錄時發生伺服器內部錯誤。', detail: err.message });
    }
});

// 新增: DELETE /api/admin/sales/:id - 刪除一筆銷售紀錄
app.delete('/api/admin/sales/:id', async (req, res) => {
    const { id } = req.params;
    const saleId = parseInt(id);
    if (isNaN(saleId)) {
        return res.status(400).json({ error: '無效的銷售紀錄 ID。' });
    }

    try {
        const queryText = `DELETE FROM sales_log WHERE id = $1 RETURNING id;`; // RETURNING id 可以確認確實刪除了
        const result = await pool.query(queryText, [saleId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要刪除的銷售紀錄。' });
        }
        console.log(`[Admin API DELETE /sales/:id] 刪除銷售紀錄 ID ${saleId} 成功。`);
        res.status(204).send(); // 204 No Content，表示成功，無響應體

    } catch (err) {
        console.error(`[Admin API DELETE /sales/${id}] 刪除銷售紀錄時出錯:`, err.stack || err);
        res.status(500).json({ error: '刪除銷售紀錄時發生伺服器內部錯誤。', detail: err.message });
    }
});






adminRouter.delete('/news-categories/:id', async (req, res) => {
    const { id } = req.params;
    const categoryId = parseInt(id);
    if (isNaN(categoryId)) {
        return res.status(400).json({ error: '無效的分類 ID 格式。' });
    }

    try {
        // 首先檢查該分類是否有關聯的新聞
        const checkResult = await pool.query('SELECT COUNT(*) FROM news WHERE category_id = $1', [categoryId]);
        if (parseInt(checkResult.rows[0].count) > 0) {
            return res.status(400).json({
                error: '無法刪除此分類，因為有新聞正在使用它。請先變更這些新聞的分類，或考慮停用而非刪除該分類。'
            });
        }

        const result = await pool.query('DELETE FROM news_categories WHERE id = $1', [categoryId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要刪除的分類。' });
        }

        res.status(204).send();
    } catch (err) {
        console.error(`[受保護 API 錯誤] 刪除分類 ID ${id} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '伺服器內部錯誤，無法刪除分類。' });
    }
});


// --- Graceful Shutdown ---
function gracefulShutdown() {
    console.log('收到關閉訊號，正在優雅關閉...');

    // 停止 YouTube 抽獎輪詢
    if (youtubeLottery) {
        console.log('正在停止 YouTube Lottery 監控...');
        youtubeLottery.stopMonitoring();
    }

    // 關閉 HTTP 伺服器
    server.close(() => {
        console.log('已關閉剩餘的連線。');

        // 關閉資料庫連接池
        if (pool) {
            pool.end(() => {
                console.log('資料庫連接池已關閉。');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });

    // 如果伺服器在 10 秒內沒有關閉，強制退出
    setTimeout(() => {
        console.error('無法在時限內關閉連線，強制關閉。');
        process.exit(1);
    }, 10000); // 10 秒
}

// 監聽來自 pm2 或其他工具的 SIGTERM 訊號
process.on('SIGTERM', gracefulShutdown);

// 監聽來自 Ctrl+C 的 SIGINT 訊號
process.on('SIGINT', gracefulShutdown);



server.listen(PORT, () => {
    console.log(`伺服器正在監聽端口 ${PORT}`);
});


