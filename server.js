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

const app = express();
const PORT = process.env.PORT || 3000;

// --- 資料庫連接池設定 ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // 從環境變數讀取資料庫 URL
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false // 生產環境需要 SSL (Render 提供)
});


   
const multer = require('multer');
const fs = require('fs');
 



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
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e5) + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
        return cb(new Error('只允許上傳圖片 (png, jpg, gif) 或 PDF 檔案！'));
    }
    cb(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 } // 限制 2MB
});
app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) { // 增加一個檢查，以防沒有檔案上傳
          return res.status(400).json({ success: false, error: '沒有上傳檔案' });
      }
      const imageUrl = '/uploads/' + file.filename;
  
      /* // <--- 開始註解
      // 可選：儲存圖片記錄進資料庫 (暫時移除，因為 table 不存在)
      if (pool) {
        await pool.query(
          'INSERT INTO uploaded_images (url, original_filename) VALUES ($1, $2)',
          [imageUrl, file.originalname]
        );
      }
      */ // <--- 結束註解
  
      res.json({ success: true, url: imageUrl });
    } catch (err) {
      console.error('上傳圖片錯誤:', err); // 這裡的錯誤現在應該不會是 "relation does not exist" 了
      res.status(500).json({ success: false, error: err.message || '伺服器錯誤' });
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

// --- JSON 請求體解析中間件 ---
// 必須放在所有需要讀取 req.body 的路由之前
app.use(express.json());

// --- 記錄 Page View 中間件 ---
app.use(async (req, res, next) => {
    const pathsToLog = [
        '/', '/index.html', '/music.html', '/news.html', '/scores.html',
        '/guestbook.html', '/message-detail.html',
        '/game/card-game.html', // <-- 新增
        '/game/wheel-game.html', // <-- 新增
        '/game/brige-game.html',  // <-- 新增
        '/rich.html', // <-- Log rich.html
        '/rich-control.html', // <-- Log rich-control.html
'/games.html'


    ]; // 添加 scores.html
    // 確保只記錄 'GET' 請求且路徑在列表中
    const shouldLog = pathsToLog.includes(req.path) && req.method === 'GET';

    if (shouldLog) {
        const pagePath = req.path;
        try {
            const sql = `
                INSERT INTO page_views (page, view_date, view_count)
                VALUES ($1, CURRENT_DATE, 1)
                ON CONFLICT (page, view_date)
                DO UPDATE SET view_count = page_views.view_count + 1;
            `;
            const params = [pagePath];
            await pool.query(sql, params);
        } catch (err) {
            if (err.code === '23505' || err.message.includes('ON CONFLICT DO UPDATE command cannot affect row a second time')) {
                console.warn(`[PV Mid] CONFLICT/Race condition during view count update for ${pagePath}. Handled.`);
            } else {
                console.error('[PV Mid] Error logging page view:', err.stack || err);
            }
        }
    }
    next(); // 確保總是調用 next()
});










app.get("/api/rich-map/templates", async (req, res) => {
    // 這邊你要從資料庫撈出 rich_map_templates 的 template_name
    const result = await pool.query("SELECT id, template_name FROM rich_map_templates");
    res.json(result.rows);
  });




app.get('/api/rich-map/templates/:id/full', async (req, res) => {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId)) return res.status(400).json({ error: 'Invalid template ID' });
  
    try {
      const client = await pool.connect();
  
      const templateQuery = `
        SELECT id, template_name, logo_url, background_color
        FROM rich_map_templates
        WHERE id = $1
      `;
      const { rows: templateRows } = await client.query(templateQuery, [templateId]);
      if (templateRows.length === 0) {
        client.release();
        return res.status(404).json({ error: 'Template not found' });
      }
  
      const cellQuery = `
        SELECT position, x, y, title, description, color, image_url
        FROM rich_map_cells
        WHERE template_id = $1
        ORDER BY position ASC
      `;
      const playerQuery = `
        SELECT player_number, name, avatar_url
        FROM rich_players_config
        WHERE template_id = $1
        ORDER BY player_number ASC
      `;
  
      const [cellResult, playerResult] = await Promise.all([
        client.query(cellQuery, [templateId]),
        client.query(playerQuery, [templateId])
      ]);
  
      client.release();
  
      res.json({
        ...templateRows[0],
        players: playerResult.rows,
        cells: cellResult.rows
      });
    } catch (err) {
      console.error('Error fetching template:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  







// ▼▼▼ 新增：處理新建或另存模板的 POST 請求 ▼▼▼
app.post('/api/rich-map/templates', async (req, res) => {
    const { template_name, background_color, logo_url, cells, players } = req.body;
    const DEFAULT_TEMPLATE_ID = 1; // 假設 ID=1 是你的預設模板 (例如 "美食地圖1")

    // 1. 驗證必要欄位
    if (!template_name || !template_name.trim()) {
        return res.status(400).json({ error: '模板名稱不能為空' });
    }
    const trimmedName = template_name.trim();

    const client = await pool.connect();
    try {
        // 2. 檢查名稱是否重複
        const checkResult = await client.query(
            'SELECT 1 FROM rich_map_templates WHERE template_name = $1',
            [trimmedName]
        );
        if (checkResult.rowCount > 0) {
            client.release();
            return res.status(409).json({ error: `模板名稱 "${trimmedName}" 已存在` });
        }

        await client.query('BEGIN'); // --- 開始事務 ---

        let bgColorToUse = '#fff0f5'; // 預設背景色
        let logoUrlToUse = null;
        let cellsToUse = [];
        let playersToUse = [ // 預設玩家結構 (如果預設模板沒有玩家資料)
            { player_number: 1, name: null, avatar_url: null },
            { player_number: 2, name: null, avatar_url: null },
            { player_number: 3, name: null, avatar_url: null },
        ];

        // 3. 判斷是 "新建" 還是 "另存"
        if (cells && Array.isArray(cells)) {
            // --- 情況：另存為新版本 (使用請求 body 中的資料) ---
            console.log(`正在處理 "另存為" 請求: ${trimmedName}`);
            bgColorToUse = (typeof background_color === 'string' && background_color.trim()) ? background_color.trim() : '#fff0f5';
            logoUrlToUse = (typeof logo_url === 'string' && logo_url.trim()) ? logo_url.trim() : null;
            cellsToUse = cells; // 直接使用傳入的格子資料
            // 處理傳入的玩家資料，如果沒有或格式不對，使用預設值
            if (players && Array.isArray(players) && players.length > 0) {
                 playersToUse = players.slice(0, 3).map((p, i) => ({ // 最多取3個
                     player_number: p.player_number || (i + 1), // 確保有 player_number
                     name: (typeof p.name === 'string') ? p.name.trim() : null,
                     avatar_url: (typeof p.avatar_url === 'string' && p.avatar_url.trim()) ? p.avatar_url.trim() : null
                 }));
                 // 補足到 3 個 (如果需要)
                 while (playersToUse.length < 3) {
                     playersToUse.push({ player_number: playersToUse.length + 1, name: null, avatar_url: null });
                 }
            }
        } else {
            // --- 情況：新建地圖 (從預設模板 ID=1 複製資料) ---
            console.log(`正在處理 "新建" 請求: ${trimmedName} (基於模板 ID ${DEFAULT_TEMPLATE_ID})`);
            // 獲取預設模板的基本資料
            const defaultTemplateResult = await client.query(
                'SELECT background_color, logo_url FROM rich_map_templates WHERE id = $1',
                [DEFAULT_TEMPLATE_ID]
            );
            if (defaultTemplateResult.rowCount > 0) {
                bgColorToUse = defaultTemplateResult.rows[0].background_color || bgColorToUse;
                logoUrlToUse = defaultTemplateResult.rows[0].logo_url || logoUrlToUse;
            } else {
                console.warn(`預設模板 ID ${DEFAULT_TEMPLATE_ID} 未找到，將使用硬編碼的預設值。`);
                // 如果預設模板不存在，可以使用硬編碼的預設值
                 bgColorToUse = '#fff0f5';
                 logoUrlToUse = null;
                 // 也可以在這裡生成一個標準的空白地圖格子結構
                 // cellsToUse = generateStandardEmptyCells();
                 // 目前 cellsToUse 保持空陣列，需要手動編輯
            }

            // 獲取預設模板的格子資料
            const defaultCellsResult = await client.query(
                'SELECT position, x, y, title, description, color, image_url FROM rich_map_cells WHERE template_id = $1 ORDER BY position ASC',
                [DEFAULT_TEMPLATE_ID]
            );
            // 移除 id 和 template_id，因為要插入新的
            cellsToUse = defaultCellsResult.rows.map(({ id, template_id, ...cellData }) => cellData);

             // 獲取預設模板的玩家資料
             const defaultPlayersResult = await client.query(
                 'SELECT player_number, name, avatar_url FROM rich_players_config WHERE template_id = $1 ORDER BY player_number ASC',
                 [DEFAULT_TEMPLATE_ID]
             );
              // 移除 id 和 template_id
             if (defaultPlayersResult.rowCount > 0) {
                 playersToUse = defaultPlayersResult.rows.map(({ id, template_id, ...playerData }) => playerData);
                 // 確保有 3 個玩家記錄
                 while (playersToUse.length < 3) {
                     playersToUse.push({ player_number: playersToUse.length + 1, name: null, avatar_url: null });
                 }
                 playersToUse = playersToUse.slice(0, 3); // 最多取3個
             }
             // 如果預設模板沒有玩家資料，playersToUse 會保持上面的預設值
        }
// ▼▼▼ 修正後的第 4 步 ▼▼▼
const newTemplateResult = await client.query(
    `INSERT INTO rich_map_templates (template_name, background_color, logo_url)
     VALUES ($1, $2, $3) RETURNING id`, // <-- 只插入需要的欄位，不指定 id
    [trimmedName, bgColorToUse, logoUrlToUse] // <-- 參數列表也不包含 id
);
const newTemplateId = newTemplateResult.rows[0].id; // <-- 正確獲取自動生成的 ID
// ▲▲▲ 修正後的第 4 步 ▲▲▲
        console.log(`新模板基礎資料已插入，ID: ${newTemplateId}`);

        // 5. 插入格子資料 (如果有)
        if (cellsToUse.length > 0) {
            const cellInsertPromises = cellsToUse.map(cell => {
                const position = parseInt(cell.position);
                if (isNaN(position)) return Promise.resolve();
                return client.query(
                    `INSERT INTO rich_map_cells (template_id, position, x, y, title, description, color, image_url)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        newTemplateId, // <-- 使用新 ID
                        position,
                        cell.x, cell.y,
                        cell.title || '',
                        cell.description || '',
                        (cell.color && cell.color.startsWith('#')) ? cell.color : '#ffffff',
                        cell.image_url || null
                    ]
                );
            });
            await Promise.all(cellInsertPromises);
            console.log(`為模板 ID ${newTemplateId} 插入了 ${cellsToUse.length} 個格子`);
        }

        // 6. 插入玩家設定資料
        if (playersToUse.length > 0) {
             const playerInsertPromises = playersToUse.map(player => {
                 return client.query(
                     `INSERT INTO rich_players_config (template_id, player_number, name, avatar_url)
                      VALUES ($1, $2, $3, $4)`, // 這裡不需要 ON CONFLICT，因為是全新插入
                     [newTemplateId, player.player_number, player.name, player.avatar_url]
                 );
             });
             await Promise.all(playerInsertPromises);
             console.log(`為模板 ID ${newTemplateId} 插入了 ${playersToUse.length} 個玩家設定`);
         }

        await client.query('COMMIT'); // --- 提交事務 ---
        console.log(`模板 "${trimmedName}" (ID: ${newTemplateId}) 已成功創建/另存`);
        res.status(201).json({
            success: true,
            message: `模板 "${trimmedName}" 已成功創建/另存`,
            newTemplate: { // 回傳新模板的 ID 和名稱，方便前端使用
                id: newTemplateId,
                template_name: trimmedName
            }
        });

    } catch (err) {
        await client.query('ROLLBACK'); // --- 出錯時回滾事務 ---
        console.error(`創建/另存模板 "${trimmedName}" 時發生錯誤:`, err);
        res.status(500).json({ error: '伺服器錯誤，操作失敗', detail: err.message });
    } finally {
        client.release(); // --- 確保釋放連接 ---
    }
});
// ▲▲▲ 新增：處理新建或另存模板的 POST 請求 ▲▲▲



  

// --- 在它後面加上這段新的 PUT 路由 ---

app.put('/api/rich-map/templates/:id/full', async (req, res) => {
    const templateId = parseInt(req.params.id);
    
    const { background_color, logo_url, cells } = req.body;
   
    // --- 基本驗證 ---
    if (isNaN(templateId)) {
        return res.status(400).json({ error: '無效的模板 ID' });
    }
    if (!Array.isArray(cells)) {
        return res.status(400).json({ error: '格子資料必須是陣列' });
    }
    const bgColorToSave = (typeof background_color === 'string' && background_color.trim())
                           ? background_color.trim()
                           : '#fff0f5';
    // ▼▼▼ 處理 logo_url，允許空值 ▼▼▼
    const logoUrlToSave = (typeof logo_url === 'string' && logo_url.trim()) ? logo_url.trim() : null;
    // ▲▲▲ 處理 logo_url ▲▲▲

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 更新模板背景色、Logo 和時間戳
        const templateUpdateResult = await client.query(
            `UPDATE rich_map_templates
             SET background_color = $1, logo_url = $2, updated_at = NOW()
             WHERE id = $3`, // <-- 加入 logo_url = $2
            [bgColorToSave, logoUrlToSave, templateId] // <-- 加入 logoUrlToSave
        );

        // 檢查模板是否存在 (不變)
        if (templateUpdateResult.rowCount === 0) {
            await client.query('ROLLBACK'); // 回滾事務
            client.release();
            return res.status(404).json({ error: '找不到要更新的模板' });
        }

        // 2. 逐一更新格子資料 (使用 Promise.all 提高效率)
        const cellUpdatePromises = cells.map(cell => {
            // 對每個格子資料進行基本驗證和處理
            const position = parseInt(cell.position);
            if (isNaN(position)) {
                // 如果 position 無效，可以選擇拋出錯誤或跳過此格子
                console.warn(`模板 ${templateId} 中發現無效 position 的格子資料:`, cell);
                return Promise.resolve(); // 跳過此格子，或者你可以改成 Promise.reject() 來中斷整個更新
            }
            const title = cell.title || '';
            const description = cell.description || '';
            const color = (cell.color && cell.color.startsWith('#')) ? cell.color : '#ffffff'; // 提供預設格子顏色
            const imageUrl = cell.image_url || null; // 允許圖片為 null

            return client.query(
                `UPDATE rich_map_cells
                 SET title = $1, description = $2, color = $3, image_url = $4
                 WHERE template_id = $5 AND position = $6`,
                [title, description, color, imageUrl, templateId, position]
            );
        });

        // 等待所有格子更新完成
        await Promise.all(cellUpdatePromises);


 // ▼▼▼ 加入這段：更新玩家設定資料 ▼▼▼
 const { players } = req.body; // 從請求體中獲取 players 陣列
 if (players && Array.isArray(players)) {
      const playerUpdatePromises = players.map(player => {
          const playerNumber = parseInt(player.player_number);
          if (isNaN(playerNumber) || playerNumber < 1 || playerNumber > 3) {
              console.warn(`更新模板 ${templateId} 時發現無效 player_number:`, player);
              return Promise.resolve();
          }
          const name = (typeof player.name === 'string') ? player.name.trim() : null;
          const avatarUrl = (typeof player.avatar_url === 'string' && player.avatar_url.trim()) ? player.avatar_url.trim() : null;
          // 使用 Upsert 更新或插入玩家資料
          return client.query(
              `INSERT INTO rich_players_config (template_id, player_number, name, avatar_url)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (template_id, player_number)
               DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url`,
              [templateId, playerNumber, name, avatarUrl]
          );
      });
      await Promise.all(playerUpdatePromises); // 等待所有玩家設定更新完成
      console.log(`模板 ID ${templateId} 的玩家設定已更新`);
  }
 // ▲▲▲ 加入這段：更新玩家設定資料 ▲▲▲



        await client.query('COMMIT');
        console.log(`模板 ID ${templateId} (含Logo) 已成功更新`); // <-- 更新日誌訊息
        res.status(200).json({ success: true, message: '模板 (含Logo) 已成功更新' }); // <-- 更新回應訊息

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`更新模板 ${templateId} (含Logo) 時發生錯誤:`, err);
        res.status(500).json({ error: '伺服器錯誤，更新模板失敗', detail: err.message });
    } finally {
        client.release();
    }
});






// ▼▼▼ 新增：處理刪除模板的 DELETE 請求 ▼▼▼
app.delete('/api/rich-map/templates/:id', async (req, res) => {
    const templateId = parseInt(req.params.id);

    if (isNaN(templateId)) {
        return res.status(400).json({ error: '無效的模板 ID' });
    }
    if (templateId === 1) { // 保護預設模板
         return res.status(403).json({ error: '不允許刪除預設模板 (ID=1)' });
     }

    console.log(`準備刪除模板 ID: ${templateId}`);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const deleteResult = await client.query(
            'DELETE FROM rich_map_templates WHERE id = $1',
            [templateId]
        );
        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ error: `找不到要刪除的模板 (ID: ${templateId})` });
        }
        await client.query('COMMIT');
        console.log(`模板 ID ${templateId} 已成功刪除`);
        res.status(204).send(); // 成功，無內容返回
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`刪除模板 ID ${templateId} 時發生錯誤:`, err);
        res.status(500).json({ error: '伺服器錯誤，刪除模板失敗', detail: err.message });
    } finally {
        client.release();
    }
});
// ▲▲▲ 新增：處理刪除模板的 DELETE 請求 ▲▲▲






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
app.get('/api/admin/files', basicAuthMiddleware, async (req, res) => { // <-- 添加 basicAuthMiddleware
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

// POST /api/admin/files/upload - 上傳檔案
app.post('/api/admin/files/upload', basicAuthMiddleware, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: '沒有上傳檔案或欄位名稱不符 (應為 "file")' });
    }
    const file = req.file;
    const fileUrlPath = '/uploads/' + file.filename; // ★ 使用 fileUrlPath 作為 URL 路徑 ★

    let fileType = 'other';
    const lowerExt = path.extname(file.originalname).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(lowerExt)) { fileType = 'image'; }
    else if (lowerExt === '.pdf') { fileType = 'pdf'; }
    else if (file.mimetype?.startsWith('image/')) { fileType = 'image'; }
    else if (file.mimetype === 'application/pdf') { fileType = 'pdf'; }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertResult = await client.query(
            `INSERT INTO uploaded_files (file_path, original_filename, mimetype, size_bytes, file_type)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, file_path, original_filename, mimetype, size_bytes, file_type, uploaded_at`,
            // ★ 存入資料庫的是 URL 路徑 ★
            [fileUrlPath, file.originalname, file.mimetype, file.size, fileType]
        );
        await client.query('COMMIT');
        console.log(`檔案 ${file.originalname} 上傳成功並記錄到資料庫 ID: ${insertResult.rows[0].id}`);
        res.status(201).json({ success: true, file: insertResult.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[API POST /admin/files/upload] Error inserting file record:', err);
        // 嘗試刪除已上傳但記錄失敗的檔案
        const fullDiskPath = path.join(uploadDir, file.filename); // ★ 實際磁碟路徑 ★
        try {
            if (fs.existsSync(fullDiskPath)) {
                 await fs.promises.unlink(fullDiskPath);
                 console.warn(`已刪除記錄失敗的持久化檔案: ${fullDiskPath}`);
            }
        } catch (unlinkErr) {
            console.error(`刪除記錄失敗的檔案時出錯 (${fullDiskPath}):`, unlinkErr);
        }
        res.status(500).json({ success: false, error: '儲存檔案記錄失敗', detail: err.message });
    } finally {
        client.release();
    }
});
// DELETE /api/admin/files/:id - 刪除檔案
app.delete('/api/admin/files/:id', basicAuthMiddleware, async (req, res) => {
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


















// --- 受保護的管理頁面和 API Routes ---
app.use([
    '/admin.html',
    '/music-admin.html',
    '/news-admin.html',
    '/banner-admin.html',
    '/sales-report.html',
    '/figures-admin.html',
    '/guestbook-admin.html',
    '/admin-identities.html',
    '/admin-message-detail.html',
    '/inventory-admin.html'
], basicAuthMiddleware);
// 保護所有 /api/admin 和 /api/analytics 開頭的 API
app.use(['/api/admin', '/api/analytics'], basicAuthMiddleware);

// --- 靜態文件服務 ---
app.use(express.static(path.join(__dirname, 'public')));

app.use('/uploads', express.static(uploadDir)); // uploadDir 的值是 '/data/uploads'
console.log(`設定靜態檔案服務: /uploads 將映射到 ${uploadDir}`);

// --- 公開 API Routes (保持不變) ---
// ... (保留所有其他的公開 API，如 guestbook, scores, news, products, music, banners 等) ...
// --- ★★★ 留言板公開 API (Public Guestbook API) ★★★ ---
















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
                m.is_admin_post  -- ★★★ 新增此行 ★★★
             FROM guestbook_messages m
             WHERE m.is_visible = TRUE
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
        // 1. 獲取主留言 (加入 view_count, like_count)
        const messageResult = await client.query(
            'SELECT id, author_name, content, reply_count, view_count, like_count, created_at, last_activity_at FROM guestbook_messages WHERE id = $1 AND is_visible = TRUE',
            [messageId]
        );
        if (messageResult.rowCount === 0) return res.status(404).json({ error: '找不到或無法查看此留言' });
        const message = messageResult.rows[0];

        // 2. 獲取回覆 (加入 like_count, parent_reply_id)
        const repliesResult = await client.query(
            `SELECT
                r.id, r.message_id, r.parent_reply_id, -- 需要 parent_reply_id 用於前端嵌套
                r.author_name, r.content, r.created_at,
                r.is_admin_reply, r.like_count, -- 加入 like_count
                ai.name AS admin_identity_name
             FROM guestbook_replies r
             LEFT JOIN admin_identities ai ON r.admin_identity_id = ai.id
             WHERE r.message_id = $1 AND r.is_visible = TRUE
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
    const { author_name, content } = req.body;

    let authorNameToSave = '匿名';
    if (author_name && author_name.trim() !== '') { authorNameToSave = author_name.trim().substring(0, 100); }
    if (!content || content.trim() === '') return res.status(400).json({ error: '留言內容不能為空' });
    const trimmedContent = content.trim();
    try {
        const result = await pool.query(
            `INSERT INTO guestbook_messages (author_name, content, last_activity_at, is_visible, like_count, view_count)
             VALUES ($1, $2, NOW(), TRUE, 0, 0)
             RETURNING id, author_name, substring(content for 80) || (CASE WHEN length(content) > 80 THEN '...' ELSE '' END) AS content_preview, reply_count, last_activity_at, like_count, view_count`, // 返回新欄位
            [authorNameToSave, trimmedContent]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { console.error('[API POST /guestbook] Error:', err); res.status(500).json({ error: '無法新增留言' }); }
});

// POST /api/guestbook/replies - 新增公開回覆
app.post('/api/guestbook/replies', async (req, res) => {
    const { message_id, parent_reply_id, author_name, content } = req.body;
    const messageIdInt = parseInt(message_id, 10);
    const parentIdInt = parent_reply_id ? parseInt(parent_reply_id, 10) : null;

    if (isNaN(messageIdInt) || (parentIdInt !== null && isNaN(parentIdInt))) return res.status(400).json({ error: '無效的留言或父回覆 ID' });

    let authorNameToSave = '匿名';
    if (author_name && author_name.trim() !== '') { authorNameToSave = author_name.trim().substring(0, 100); }
    if (!content || content.trim() === '') return res.status(400).json({ error: '回覆內容不能為空' });
    const trimmedContent = content.trim();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const replyResult = await client.query(
            `INSERT INTO guestbook_replies (message_id, parent_reply_id, author_name, content, is_admin_reply, admin_identity_id, is_visible, like_count)
             VALUES ($1, $2, $3, $4, FALSE, NULL, TRUE, 0)
             RETURNING id, message_id, parent_reply_id, author_name, content, created_at, is_admin_reply, like_count`, // 返回新欄位
            [messageIdInt, parentIdInt, authorNameToSave, trimmedContent]
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

// --- 樂譜 API ---
app.get('/api/scores/artists', async (req, res) => {
    try {
        const queryText = `
            SELECT DISTINCT m.artist
            FROM music m
            JOIN scores s ON m.id = s.music_id
            WHERE m.artist IS NOT NULL AND m.artist <> ''
            ORDER BY m.artist ASC
        `;
        const result = await pool.query(queryText);
        const artists = result.rows.map(row => row.artist);
        res.json(artists);
    } catch (err) {
        console.error('獲取帶有樂譜的歌手時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取歌手列表時發生內部伺服器錯誤' });
    }
});
app.get('/api/scores/songs', async (req, res) => {
    const { artist } = req.query;
    try {
        let queryText = `
            SELECT
                m.id,
                m.title,
                m.artist,
                m.cover_art_url,
                m.release_date,
                m.youtube_video_id,
                s_agg.scores
            FROM (
                SELECT DISTINCT m_inner.id
                FROM music m_inner
                INNER JOIN scores s_inner ON m_inner.id = s_inner.music_id
        `;
        const queryParams = [];
        let paramIndex = 1;

        if (artist && artist !== 'All') {
            queryText += ` WHERE m_inner.artist = $${paramIndex++}`;
            queryParams.push(decodeURIComponent(artist));
        }

        queryText += `
            ) AS distinct_music
            JOIN music m ON m.id = distinct_music.id
            LEFT JOIN LATERAL (
                SELECT json_agg(s.* ORDER BY s.display_order ASC, s.type ASC) AS scores
                FROM scores s
                WHERE s.music_id = m.id
            ) s_agg ON true
            ORDER BY m.artist ASC, m.release_date DESC NULLS LAST, m.title ASC;
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

// --- 商品 API ---
app.get('/api/products', async (req, res) => {
    const sortBy = req.query.sort || 'latest';
    let orderByClause = 'ORDER BY created_at DESC, id DESC';
    if (sortBy === 'popular') {
        orderByClause = 'ORDER BY click_count DESC, created_at DESC, id DESC';
    }
    try {
        const queryText = `SELECT id, name, description, price, image_url, seven_eleven_url, click_count FROM products ${orderByClause}`;
        const result = await pool.query(queryText);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取商品列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});
app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的商品 ID 格式。' }); }
    try {
        const result = await pool.query('SELECT id, name, description, price, image_url, seven_eleven_url, click_count FROM products WHERE id = $1', [id]);
        if (result.rows.length === 0) { return res.status(404).json({ error: '找不到商品。' }); }
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
        await pool.query('UPDATE products SET click_count = click_count + 1 WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error(`記錄商品 ID ${id} 點擊時出錯:`, err);
        res.status(204).send(); // 出錯也靜默處理
    }
});

// --- 音樂 API ---
app.get('/api/artists', async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT artist FROM music WHERE artist IS NOT NULL AND artist <> \'\' ORDER BY artist ASC');
        const artists = result.rows.map(row => row.artist);
        res.json(artists);
    } catch (err) {
        console.error('獲取歌手列表時出錯:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});
app.get('/api/music', async (req, res) => {
    const artistFilter = req.query.artist || null;
    let queryText = 'SELECT id, title, artist, cover_art_url, platform_url, release_date, description FROM music';
    const queryParams = [];
    if (artistFilter && artistFilter !== 'All') {
         queryText += ' WHERE artist = $1';
         queryParams.push(decodeURIComponent(artistFilter));
    }
    queryText += ' ORDER BY release_date DESC NULLS LAST, title ASC';
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
                m.*,
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
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`獲取 ID 為 ${id} 的音樂時出錯：`, err.stack || err);
        res.status(500).json({ error: '獲取音樂詳情時發生內部伺服器錯誤' });
    }
});

// --- 新聞 API ---
app.get('/api/news', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    if (page <= 0 || limit <= 0) { return res.status(400).json({ error: '頁碼和每頁數量必須是正整數。' }); }
    const offset = (page - 1) * limit;
    try {
        const countResult = await pool.query('SELECT COUNT(*) FROM news');
        const totalItems = parseInt(countResult.rows[0].count);

        const newsResult = await pool.query(`
            SELECT id, title, event_date, summary, thumbnail_url, like_count, updated_at
            FROM news
            ORDER BY event_date DESC, id DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

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
app.get('/api/news/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); }
    try {
        const result = await pool.query('SELECT id, title, event_date, summary, content, thumbnail_url, image_url, like_count, updated_at FROM news WHERE id = $1', [id]);
        if (result.rows.length === 0) { return res.status(404).json({ error: '找不到該消息。' }); }
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


// --- ★★★ 留言板管理 API (Admin Guestbook API) ★★★ ---
const adminRouter = express.Router();

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

// --- ★ 新增: 管理員發表新留言 API ---
adminRouter.post('/guestbook/messages', async (req, res) => {
    const { admin_identity_id, content } = req.body;
    const identityIdInt = parseInt(admin_identity_id, 10);

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
                author_name, content, is_admin_post, admin_identity_id,
                last_activity_at, created_at, is_visible,
                reply_count, view_count, like_count
            )
            VALUES ($1, $2, TRUE, $3, NOW(), NOW(), TRUE, 0, 0, 0)
            RETURNING id, author_name, content, is_admin_post, admin_identity_id, created_at, last_activity_at, reply_count, view_count, like_count, is_visible;
        `;
        const insertParams = [adminIdentityName, trimmedContent, identityIdInt];
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
                   m.reply_count, m.view_count, m.like_count, m.last_activity_at, m.created_at, m.is_visible
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
            `SELECT r.*, r.like_count, r.parent_reply_id, ai.name AS admin_identity_name
             FROM guestbook_replies r
             LEFT JOIN admin_identities ai ON r.admin_identity_id = ai.id
             WHERE r.message_id = $1 ORDER BY r.created_at ASC`,
            [messageId]
        );
        res.json({ message: messageResult.rows[0], replies: repliesResult.rows });
    } catch (err) { console.error(`[API GET /admin/guestbook/message/${id}] Error:`, err); res.status(500).json({ error: '無法獲取留言詳情' }); } finally { client.release(); }
});
adminRouter.post('/guestbook/replies', async (req, res) => {
    const { message_id, parent_reply_id, content, admin_identity_id } = req.body;
    const messageIdInt = parseInt(message_id, 10);
    const identityIdInt = parseInt(admin_identity_id, 10);
    const parentIdInt = parent_reply_id ? parseInt(parent_reply_id, 10) : null;

    if (isNaN(messageIdInt) || isNaN(identityIdInt) || (parentIdInt !== null && isNaN(parentIdInt))) return res.status(400).json({ error: '無效的留言/父回覆/身份 ID' });
    if (!content || content.trim() === '') return res.status(400).json({ error: '回覆內容不能為空' });

    const client = await pool.connect(); try { await client.query('BEGIN');
        const identityCheck = await client.query('SELECT 1 FROM admin_identities WHERE id = $1', [identityIdInt]);
        if (identityCheck.rowCount === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: '無效的管理員身份' }); }

        const replyResult = await client.query(
            `INSERT INTO guestbook_replies (message_id, parent_reply_id, author_name, content, is_admin_reply, admin_identity_id, is_visible, like_count)
             VALUES ($1, $2, '匿名', $3, TRUE, $4, TRUE, 0)
             RETURNING *, (SELECT name FROM admin_identities WHERE id = $4) AS admin_identity_name`,
            [messageIdInt, parentIdInt, content.trim(), identityIdInt]
        );
        await client.query('COMMIT'); res.status(201).json(replyResult.rows[0]);
    } catch (err) { await client.query('ROLLBACK'); console.error('[API POST /admin/guestbook/replies] Error:', err); if (err.code === '23503') return res.status(404).json({ error: '找不到要回覆的留言或父回覆。' }); res.status(500).json({ error: '無法新增管理員回覆' }); } finally { client.release(); }
});
adminRouter.put('/guestbook/messages/:id/visibility', async (req, res) => {
    const { id } = req.params; const messageId = parseInt(id, 10); const { is_visible } = req.body; if (isNaN(messageId) || typeof is_visible !== 'boolean') return res.status(400).json({ error: '無效的請求參數' });
    try { const result = await pool.query('UPDATE guestbook_messages SET is_visible = $1 WHERE id = $2 RETURNING id, is_visible', [is_visible, messageId]); if (result.rowCount === 0) return res.status(404).json({ error: '找不到留言' }); res.json(result.rows[0]);
    } catch (err) { console.error(`[API PUT /admin/guestbook/messages/${id}/visibility] Error:`, err); res.status(500).json({ error: '無法更新留言狀態' }); }
});
adminRouter.put('/guestbook/replies/:id/visibility', async (req, res) => {
    const { id } = req.params; const replyId = parseInt(id, 10); const { is_visible } = req.body; if (isNaN(replyId) || typeof is_visible !== 'boolean') return res.status(400).json({ error: '無效的請求參數' });
    try { const result = await pool.query('UPDATE guestbook_replies SET is_visible = $1 WHERE id = $2 RETURNING id, is_visible', [is_visible, replyId]); if (result.rowCount === 0) return res.status(404).json({ error: '找不到回覆' }); res.json(result.rows[0]);
    } catch (err) { console.error(`[API PUT /admin/guestbook/replies/${id}/visibility] Error:`, err); res.status(500).json({ error: '無法更新回覆狀態' }); }
});
adminRouter.delete('/guestbook/messages/:id', async (req, res) => {
    const { id } = req.params; const messageId = parseInt(id, 10); if (isNaN(messageId)) return res.status(400).json({ error: '無效的 ID' });
    try { const result = await pool.query('DELETE FROM guestbook_messages WHERE id = $1', [messageId]); if (result.rowCount === 0) return res.status(404).json({ error: '找不到要刪除的留言' }); res.status(204).send();
    } catch (err) { console.error(`[API DELETE /admin/guestbook/messages/${id}] Error:`, err); res.status(500).json({ error: '無法刪除留言' }); }
});
adminRouter.delete('/guestbook/replies/:id', async (req, res) => {
    const { id } = req.params; const replyId = parseInt(id, 10); if (isNaN(replyId)) return res.status(400).json({ error: '無效的 ID' });
    const client = await pool.connect(); try { await client.query('BEGIN'); const deleteResult = await client.query('DELETE FROM guestbook_replies WHERE id = $1', [replyId]); if (deleteResult.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: '找不到要刪除的回覆' }); } await client.query('COMMIT'); res.status(204).send();
    } catch (err) { await client.query('ROLLBACK'); console.error(`[API DELETE /admin/guestbook/replies/${id}] Error:`, err); res.status(500).json({ error: '無法刪除回覆' }); } finally { client.release(); }
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
    const { title, event_date, summary, content, thumbnail_url, image_url } = req.body;
    if (!title || title.trim() === '') { return res.status(400).json({ error: '消息標題為必填項。' }); }
    try {
        const result = await pool.query(
            `INSERT INTO news (title, event_date, summary, content, thumbnail_url, image_url, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
             RETURNING *`,
            [ title.trim(), event_date || null, summary ? summary.trim() : null, content ? content.trim() : null, thumbnail_url ? thumbnail_url.trim() : null, image_url ? image_url.trim() : null ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[受保護 API 錯誤] 新增消息時出錯:', err.stack || err);
        res.status(500).json({ error: '新增消息過程中發生伺服器內部錯誤。' });
    }
});
adminRouter.put('/news/:id', async (req, res) => {
    const { id } = req.params;
    const newsId = parseInt(id);
    if (isNaN(newsId)) { return res.status(400).json({ error: '無效的消息 ID 格式。' }); }
    const { title, event_date, summary, content, thumbnail_url, image_url } = req.body;
    if (!title || title.trim() === '') { return res.status(400).json({ error: '消息標題為必填項。' }); }
    try {
        const result = await pool.query(
            `UPDATE news
             SET title = $1, event_date = $2, summary = $3, content = $4, thumbnail_url = $5, image_url = $6, updated_at = NOW()
             WHERE id = $7
             RETURNING *`,
            [ title.trim(), event_date || null, summary ? summary.trim() : null, content ? content.trim() : null, thumbnail_url ? thumbnail_url.trim() : null, image_url ? image_url.trim() : null, newsId ]
        );
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到要更新的消息。' }); }
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




// --- 銷售報告 API (受保護) ---
app.get('/api/analytics/sales-report', async (req, res) => {
    const { startDate, endDate } = req.query;
    let queryStartDate = startDate ? new Date(startDate) : null;
    let queryEndDate = endDate ? new Date(endDate) : null;
    if (!queryStartDate || !queryEndDate || isNaN(queryStartDate) || isNaN(queryEndDate)) {
        queryEndDate = new Date();
        queryStartDate = new Date();
        queryStartDate.setDate(queryEndDate.getDate() - 30);
    } else {
         queryEndDate.setHours(23, 59, 59, 999);
    }
    const startDateISO = queryStartDate.toISOString();
    const endDateISO = queryEndDate.toISOString();

    const client = await pool.connect();
    try {
        const totalItemsResult = await client.query(`SELECT COALESCE(SUM(quantity_sold), 0)::integer AS total_items FROM sales_log WHERE sale_timestamp BETWEEN $1 AND $2`, [startDateISO, endDateISO]);
        const totalItemsSold = totalItemsResult.rows[0].total_items;

        const trendResult = await client.query(`SELECT DATE(sale_timestamp AT TIME ZONE 'Asia/Taipei') AS sale_date, SUM(quantity_sold)::integer AS daily_quantity FROM sales_log WHERE sale_timestamp BETWEEN $1 AND $2 GROUP BY sale_date ORDER BY sale_date ASC`, [startDateISO, endDateISO]);
        const salesTrend = trendResult.rows.map(row => ({ date: row.sale_date.toISOString().split('T')[0], quantity: row.daily_quantity }));

        const topProductsResult = await client.query(`SELECT f.name AS figure_name, fv.name AS variation_name, SUM(sl.quantity_sold)::integer AS total_quantity FROM sales_log sl JOIN figure_variations fv ON sl.figure_variation_id = fv.id JOIN figures f ON fv.figure_id = f.id WHERE sl.sale_timestamp BETWEEN $1 AND $2 GROUP BY f.name, fv.name ORDER BY total_quantity DESC LIMIT 10`, [startDateISO, endDateISO]);
        const topSellingProducts = topProductsResult.rows;

        const detailedLogResult = await client.query(`SELECT sl.sale_timestamp, f.name AS figure_name, fv.name AS variation_name, sl.quantity_sold FROM sales_log sl JOIN figure_variations fv ON sl.figure_variation_id = fv.id JOIN figures f ON fv.figure_id = f.id WHERE sl.sale_timestamp BETWEEN $1 AND $2 ORDER BY sl.sale_timestamp DESC`, [startDateISO, endDateISO]);
        const detailedLog = detailedLogResult.rows.map(row => ({ timestamp: row.sale_timestamp, figureName: row.figure_name, variationName: row.variation_name, quantity: row.quantity_sold }));

        res.status(200).json({
            summary: { totalItemsSold, startDate: startDateISO.split('T')[0], endDate: endDateISO.split('T')[0] },
            trend: salesTrend,
            topProducts: topSellingProducts,
            details: detailedLog
        });
    } catch (err) {
        console.error('[Sales Report API Error] 獲取銷售報告數據時出錯:', err.stack || err);
        res.status(500).json({ error: '獲取銷售報告數據時發生伺服器內部錯誤' });
    } finally {
        client.release();
    }
});

// --- 銷售紀錄管理 API (受保護) ---
app.get('/api/admin/sales', async (req, res) => {
    const { startDate, endDate, productName } = req.query;
    let queryText = `SELECT id, product_name, quantity_sold, sale_timestamp FROM sales_log`;
    const queryParams = [];
    const conditions = [];
    let paramIndex = 1;
    if (startDate) { conditions.push(`sale_timestamp >= $${paramIndex++}`); queryParams.push(startDate); }
    if (endDate) { const nextDay = new Date(endDate); nextDay.setDate(nextDay.getDate() + 1); conditions.push(`sale_timestamp < $${paramIndex++}`); queryParams.push(nextDay.toISOString().split('T')[0]); }
    if (productName) { conditions.push(`product_name ILIKE $${paramIndex++}`); queryParams.push(`%${productName}%`); }
    if (conditions.length > 0) { queryText += ' WHERE ' + conditions.join(' AND '); }
    queryText += ' ORDER BY sale_timestamp DESC, id DESC';
    try {
        const result = await pool.query(queryText, queryParams);
        res.status(200).json(result.rows);
    } catch (err) { console.error('[Admin API Error] 獲取銷售紀錄時出錯:', err.stack || err); res.status(500).json({ error: '獲取銷售紀錄時發生伺服器內部錯誤' }); }
});
app.get('/api/admin/sales/summary', async (req, res) => {
    const { startDate, endDate } = req.query;
    let whereClause = ''; const queryParams = []; let paramIndex = 1;
    if (startDate) { whereClause += `WHERE sale_timestamp >= $${paramIndex++} `; queryParams.push(startDate); }
    if (endDate) { const nextDay = new Date(endDate); nextDay.setDate(nextDay.getDate() + 1); whereClause += (whereClause ? 'AND ' : 'WHERE ') + `sale_timestamp < $${paramIndex++} `; queryParams.push(nextDay.toISOString().split('T')[0]); }
    try {
        const totalItemsQuery = `SELECT COALESCE(SUM(quantity_sold)::integer, 0) as total_items FROM sales_log ${whereClause}`;
        const totalItemsResult = await pool.query(totalItemsQuery, queryParams);
        const totalItems = totalItemsResult.rows[0].total_items;
        const topProductsQuery = `SELECT product_name, SUM(quantity_sold)::integer as total_sold FROM sales_log ${whereClause} GROUP BY product_name ORDER BY total_sold DESC LIMIT 5;`;
        const topProductsResult = await pool.query(topProductsQuery, queryParams);
        const topProducts = topProductsResult.rows;
        const salesTrendQuery = `SELECT DATE(sale_timestamp) as sale_date, SUM(quantity_sold)::integer as daily_total FROM sales_log ${whereClause} GROUP BY sale_date ORDER BY sale_date ASC;`;
        const salesTrendResult = await pool.query(salesTrendQuery, queryParams);
        const salesTrend = salesTrendResult.rows.map(row => ({ date: new Date(row.sale_date).toISOString().split('T')[0], quantity: row.daily_total }));
        res.status(200).json({ totalItems, topProducts, salesTrend });
    } catch (err) { console.error('[Admin API Error] 獲取銷售彙總數據時出錯:', err.stack || err); res.status(500).json({ error: '獲取銷售彙總數據時發生伺服器內部錯誤' }); }
});
app.post('/api/admin/sales', async (req, res) => {
    const { product_name, quantity_sold, sale_timestamp } = req.body;
    if (!product_name || !quantity_sold) { return res.status(400).json({ error: '商品名稱和銷售數量為必填項。' }); }
    const quantity = parseInt(quantity_sold);
    if (isNaN(quantity) || quantity <= 0) { return res.status(400).json({ error: '銷售數量必須是正整數。' }); }
    let timestampToInsert = sale_timestamp ? new Date(sale_timestamp) : new Date();
    if (isNaN(timestampToInsert.getTime())) { timestampToInsert = new Date(); }
    try {
        const queryText = `INSERT INTO sales_log (product_name, quantity_sold, sale_timestamp) VALUES ($1, $2, $3) RETURNING id, product_name, quantity_sold, sale_timestamp;`;
        const result = await pool.query(queryText, [ product_name.trim(), quantity, timestampToInsert ]);
        res.status(201).json(result.rows[0]);
    } catch (err) { console.error('[Admin API Error] 新增銷售紀錄時出錯:', err.stack || err); res.status(500).json({ error: '新增銷售紀錄過程中發生伺服器內部錯誤。' }); }
});
app.put('/api/admin/sales/:id', async (req, res) => {
    const { id } = req.params; const { product_name, quantity_sold, sale_timestamp } = req.body;
    const recordId = parseInt(id); if (isNaN(recordId)) { return res.status(400).json({ error: '無效的銷售紀錄 ID 格式。' }); }
    if (!product_name || !quantity_sold) { return res.status(400).json({ error: '商品名稱和銷售數量為必填項。' }); }
    const quantity = parseInt(quantity_sold); if (isNaN(quantity) || quantity <= 0) { return res.status(400).json({ error: '銷售數量必須是正整數。' }); }
    let timestampToUpdate = new Date(sale_timestamp); if (isNaN(timestampToUpdate.getTime())) { return res.status(400).json({ error: '無效的銷售時間格式。' }); }
    try {
        const queryText = `UPDATE sales_log SET product_name = $1, quantity_sold = $2, sale_timestamp = $3, updated_at = NOW() WHERE id = $4 RETURNING id, product_name, quantity_sold, sale_timestamp;`;
        const result = await pool.query(queryText, [ product_name.trim(), quantity, timestampToUpdate, recordId ]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到要更新的銷售紀錄。' }); }
        res.status(200).json(result.rows[0]);
    } catch (err) { console.error(`[Admin API Error] 更新銷售紀錄 ID ${id} 時出錯:`, err.stack || err); res.status(500).json({ error: '更新銷售紀錄過程中發生伺服器內部錯誤。' }); }
});
app.delete('/api/admin/sales/:id', async (req, res) => {
    const { id } = req.params; const recordId = parseInt(id); if (isNaN(recordId)) { return res.status(400).json({ error: '無效的銷售紀錄 ID 格式。' }); }
    try {
        const queryText = 'DELETE FROM sales_log WHERE id = $1';
        const result = await pool.query(queryText, [recordId]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到要刪除的銷售紀錄。' }); }
        res.status(204).send();
    } catch (err) { console.error(`[Admin API Error] 刪除銷售紀錄 ID ${id} 時出錯:`, err.stack || err); res.status(500).json({ error: '刪除銷售紀錄過程中發生伺服器內部錯誤。' }); }
});

// --- 公仔庫存管理 API (受保護) ---
app.get('/api/admin/figures', async (req, res) => {
    try {
        const queryText = ` SELECT f.id, f.name, f.image_url, f.purchase_price, f.selling_price, f.ordering_method, f.created_at, f.updated_at, COALESCE( (SELECT json_agg( json_build_object( 'id', v.id, 'name', v.name, 'quantity', v.quantity ) ORDER BY v.name ASC ) FROM figure_variations v WHERE v.figure_id = f.id), '[]'::json ) AS variations FROM figures f ORDER BY f.created_at DESC; `;
        const result = await pool.query(queryText);
        res.json(result.rows);
    } catch (err) { console.error('[Admin API Error] 獲取公仔列表時出錯:', err.stack || err); res.status(500).json({ error: '獲取公仔列表時發生伺服器內部錯誤' }); }
});
app.post('/api/admin/figures', async (req, res) => {
    const { name, image_url, purchase_price, selling_price, ordering_method, variations } = req.body;
    if (!name) { return res.status(400).json({ error: '公仔名稱為必填項。' }); }
    if (variations && !Array.isArray(variations)) { return res.status(400).json({ error: '規格資料格式必須是陣列。' }); }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const figureInsertQuery = ` INSERT INTO figures (name, image_url, purchase_price, selling_price, ordering_method) VALUES ($1, $2, $3, $4, $5) RETURNING *; `;
        const figureResult = await client.query(figureInsertQuery, [ name, image_url || null, purchase_price || 0, selling_price || 0, ordering_method || null ]);
        const newFigure = figureResult.rows[0]; const newFigureId = newFigure.id;
        let insertedVariations = [];
        if (variations && variations.length > 0) {
            const variationInsertQuery = ` INSERT INTO figure_variations (figure_id, name, quantity) VALUES ($1, $2, $3) RETURNING *; `;
            for (const variation of variations) {
                if (!variation.name || variation.quantity === undefined || variation.quantity === null) { throw new Error(`規格 "${variation.name || '未命名'}" 缺少名稱或數量。`); }
                const quantity = parseInt(variation.quantity); if (isNaN(quantity) || quantity < 0) { throw new Error(`規格 "${variation.name}" 的數量必須是非負整數。`); }
                const variationResult = await client.query(variationInsertQuery, [ newFigureId, variation.name.trim(), quantity ]);
                insertedVariations.push(variationResult.rows[0]);
            }
        }
        await client.query('COMMIT'); newFigure.variations = insertedVariations; res.status(201).json(newFigure);
    } catch (err) {
        await client.query('ROLLBACK'); console.error('[Admin API Error] 新增公仔及其規格時出錯:', err.stack || err);
        if (err.code === '23505' && err.constraint === 'figure_variations_figure_id_name_key') { res.status(409).json({ error: `新增失敗：同一個公仔下不能有重複的規格名稱。錯誤詳情: ${err.detail}` }); }
        else { res.status(500).json({ error: `新增公仔過程中發生錯誤: ${err.message}` }); }
    } finally { client.release(); }
});
app.put('/api/admin/figures/:id', async (req, res) => {
    const { id } = req.params; const { name, image_url, purchase_price, selling_price, ordering_method, variations } = req.body;
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的公仔 ID 格式。' }); }
    if (!name) { return res.status(400).json({ error: '公仔名稱為必填項。' }); }
    if (variations && !Array.isArray(variations)) { return res.status(400).json({ error: '規格資料格式必須是陣列。' }); }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const figureUpdateQuery = ` UPDATE figures SET name = $1, image_url = $2, purchase_price = $3, selling_price = $4, ordering_method = $5, updated_at = NOW() WHERE id = $6 RETURNING *; `;
        const figureResult = await client.query(figureUpdateQuery, [ name, image_url || null, purchase_price || 0, selling_price || 0, ordering_method || null, id ]);
        if (figureResult.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: '找不到要更新的公仔。' }); }
        const updatedFigure = figureResult.rows[0];
        const variationsToProcess = variations || []; const incomingVariationIds = new Set(variationsToProcess.filter(v => v.id).map(v => parseInt(v.id)));
        const existingVariationsResult = await client.query('SELECT id FROM figure_variations WHERE figure_id = $1', [id]); const existingVariationIds = new Set(existingVariationsResult.rows.map(r => r.id));
        const variationIdsToDelete = [...existingVariationIds].filter(existingId => !incomingVariationIds.has(existingId));
        if (variationIdsToDelete.length > 0) { const deleteQuery = `DELETE FROM figure_variations WHERE id = ANY($1::int[])`; await client.query(deleteQuery, [variationIdsToDelete]); }
        const variationUpdateQuery = `UPDATE figure_variations SET name = $1, quantity = $2, updated_at = NOW() WHERE id = $3 AND figure_id = $4`;
        const variationInsertQuery = `INSERT INTO figure_variations (figure_id, name, quantity) VALUES ($1, $2, $3) RETURNING *`;
        let finalVariations = [];
        for (const variation of variationsToProcess) {
            if (!variation.name || variation.quantity === undefined || variation.quantity === null) { throw new Error(`規格 "${variation.name || '未提供'}" 缺少名稱或數量。`); }
            const quantity = parseInt(variation.quantity); if (isNaN(quantity) || quantity < 0) { throw new Error(`規格 "${variation.name}" 的數量必須是非負整數。`); }
            const variationId = variation.id ? parseInt(variation.id) : null;
            if (variationId && existingVariationIds.has(variationId)) { await client.query(variationUpdateQuery, [variation.name.trim(), quantity, variationId, id]); finalVariations.push({ id: variationId, name: variation.name.trim(), quantity: quantity }); }
            else { const insertResult = await client.query(variationInsertQuery, [id, variation.name.trim(), quantity]); finalVariations.push(insertResult.rows[0]); }
        }
        await client.query('COMMIT'); updatedFigure.variations = finalVariations.sort((a, b) => a.name.localeCompare(b.name)); res.status(200).json(updatedFigure);
    } catch (err) {
        await client.query('ROLLBACK'); console.error(`[Admin API Error] 更新公仔 ID ${id} 時出錯:`, err.stack || err);
        if (err.code === '23505' && err.constraint === 'figure_variations_figure_id_name_key') { res.status(409).json({ error: `更新失敗：同一個公仔下不能有重複的規格名稱。錯誤詳情: ${err.detail}` }); }
        else { res.status(500).json({ error: `更新公仔過程中發生錯誤: ${err.message}` }); }
    } finally { client.release(); }
});
app.delete('/api/admin/figures/:id', async (req, res) => {
    const { id } = req.params; if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的公仔 ID 格式。' }); }
    try {
        const result = await pool.query('DELETE FROM figures WHERE id = $1', [id]);
        if (result.rowCount === 0) { return res.status(404).json({ error: '找不到要刪除的公仔。' }); }
        res.status(204).send();
    } catch (err) { console.error(`[Admin API Error] 刪除公仔 ID ${id} 時出錯:`, err.stack || err); res.status(500).json({ error: '刪除公仔過程中發生伺服器內部錯誤。' }); }
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
    if (!image_url) return res.status(400).json({ error: '圖片網址不能為空。'}); if (!page_location) return res.status(400).json({ error: '必須指定顯示頁面。'});
    const order = (display_order !== undefined && display_order !== null) ? parseInt(display_order) : 0; if (isNaN(order)) return res.status(400).json({ error: '排序必須是數字。'});
    try {
        const result = await pool.query(`INSERT INTO banners (image_url, link_url, display_order, alt_text, page_location, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`, [image_url.trim(), link_url ? link_url.trim() : null, order, alt_text ? alt_text.trim() : null, page_location]);
        res.status(201).json(result.rows[0]);
    } catch (err) { console.error('[Admin API Error] 新增 Banner 時出錯:', err); res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' }); }
});
app.put('/api/admin/banners/:id', async (req, res) => {
    const { id } = req.params; if (isNaN(parseInt(id))) { return res.status(400).json({ error: '無效的 Banner ID 格式。' }); }
    const { image_url, link_url, display_order, alt_text, page_location } = req.body; if (!image_url) return res.status(400).json({ error: '圖片網址不能為空。'}); if (!page_location) return res.status(400).json({ error: '必須指定顯示頁面。'});
    const order = (display_order !== undefined && display_order !== null) ? parseInt(display_order) : 0; if (isNaN(order)) return res.status(400).json({ error: '排序必須是數字。'});
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

// --- 商品管理 API (受保護) ---
app.post('/api/admin/products', async (req, res) => {
    const { name, description, price, image_url, seven_eleven_url } = req.body;
    try { const result = await pool.query(`INSERT INTO products (name, description, price, image_url, seven_eleven_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`, [ name, description || null, price, image_url || null, seven_eleven_url || null ]); res.status(201).json(result.rows[0]); }
    catch (err) { console.error('新增商品時出錯:', err); res.status(500).json({ error: '新增過程中發生伺服器內部錯誤。' }); }
});
app.put('/api/admin/products/:id', async (req, res) => {
    const { id } = req.params; const { name, description, price, image_url, seven_eleven_url } = req.body;
    try { const result = await pool.query(`UPDATE products SET name = $1, description = $2, price = $3, image_url = $4, seven_eleven_url = $5, updated_at = NOW() WHERE id = $6 RETURNING *`, [ name, description || null, price, image_url || null, seven_eleven_url || null, id ]); if (result.rowCount === 0) { return res.status(404).json({ error: '找不到商品，無法更新。' }); } res.status(200).json(result.rows[0]); }
    catch (err) { console.error(`更新商品 ID ${id} 時出錯:`, err); res.status(500).json({ error: '更新過程中發生伺服器內部錯誤。' }); }
});
app.delete('/api/admin/products/:id', async (req, res) => {
    const { id } = req.params;
    try { const result = await pool.query('DELETE FROM products WHERE id = $1', [id]); if (result.rowCount === 0) { return res.status(404).json({ error: '找不到商品，無法刪除。' }); } res.status(204).send(); }
    catch (err) { console.error(`刪除商品 ID ${id} 時出錯:`, err); res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' }); }
});

// --- 音樂管理 API (受保護 - POST/PUT/DELETE) ---
app.post('/api/admin/music', async (req, res) => {
    const { title, artist, release_date, description, cover_art_url, platform_url, youtube_video_id, scores } = req.body;
    if (!title || !artist) { return res.status(400).json({ error: '標題和歌手為必填項。' }); }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const musicInsertQuery = `INSERT INTO music (title, artist, release_date, description, cover_art_url, platform_url, youtube_video_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`;
        const musicResult = await client.query(musicInsertQuery, [title, artist, release_date || null, description || null, cover_art_url || null, platform_url || null, youtube_video_id || null]);
        const newMusic = musicResult.rows[0];
        if (scores && Array.isArray(scores) && scores.length > 0) {
            const scoreInsertQuery = `INSERT INTO scores (music_id, type, pdf_url, display_order) VALUES ($1, $2, $3, $4);`;
            for (const score of scores) { if (score.type && score.pdf_url) await client.query(scoreInsertQuery, [newMusic.id, score.type, score.pdf_url, score.display_order || 0]); }
        }
        await client.query('COMMIT'); newMusic.scores = scores || []; res.status(201).json(newMusic);
    } catch (err) { await client.query('ROLLBACK'); console.error('新增音樂時出錯:', err.stack || err); res.status(500).json({ error: '新增音樂時發生內部伺服器錯誤' });
    } finally { client.release(); }
});
app.put('/api/admin/music/:id', async (req, res) => {
    const { id } = req.params; if (isNaN(parseInt(id, 10))) { return res.status(400).json({ error: '無效的音樂 ID' }); }
    const { title, artist, release_date, description, cover_art_url, platform_url, youtube_video_id, scores } = req.body;
    if (!title || !artist) { return res.status(400).json({ error: '標題和歌手為必填項。' }); }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const musicUpdateQuery = `UPDATE music SET title = $1, artist = $2, release_date = $3, description = $4, cover_art_url = $5, platform_url = $6, youtube_video_id = $7, updated_at = NOW() WHERE id = $8 RETURNING *;`;
        const musicResult = await client.query(musicUpdateQuery, [title, artist, release_date || null, description || null, cover_art_url || null, platform_url || null, youtube_video_id || null, id]);
        if (musicResult.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: '找不到音樂' }); }
        const updatedMusic = musicResult.rows[0];
        const incomingScoreIds = new Set(); const scoresToUpdate = []; const scoresToInsert = [];
        if (scores && Array.isArray(scores)) {
             scores.forEach(score => {
                 if (score.type && score.pdf_url) {
                     if (score.id) { const scoreIdInt = parseInt(score.id, 10); if (!isNaN(scoreIdInt)) { incomingScoreIds.add(scoreIdInt); scoresToUpdate.push(score); } else { scoresToInsert.push(score); } }
                     else { scoresToInsert.push(score); }
                 }
             });
         }
         const existingScoresResult = await client.query('SELECT id FROM scores WHERE music_id = $1', [id]);
         const existingScoreIds = new Set(existingScoresResult.rows.map(r => r.id));
         const scoreIdsToDelete = [...existingScoreIds].filter(existingId => !incomingScoreIds.has(existingId));
         if (scoreIdsToDelete.length > 0) { const deleteQuery = `DELETE FROM scores WHERE id = ANY($1::int[])`; await client.query(deleteQuery, [scoreIdsToDelete]); }
         if (scoresToUpdate.length > 0) {
             const updateQuery = `UPDATE scores SET type = $1, pdf_url = $2, display_order = $3, updated_at = NOW() WHERE id = $4 AND music_id = $5;`;
             for (const score of scoresToUpdate) { if (existingScoreIds.has(parseInt(score.id, 10))) { await client.query(updateQuery, [score.type, score.pdf_url, score.display_order || 0, score.id, id]); } }
         }
         if (scoresToInsert.length > 0) {
             const insertQuery = `INSERT INTO scores (music_id, type, pdf_url, display_order) VALUES ($1, $2, $3, $4);`;
             for (const score of scoresToInsert) { await client.query(insertQuery, [id, score.type, score.pdf_url, score.display_order || 0]); }
         }
        await client.query('COMMIT');
         const finalScoresResult = await pool.query('SELECT id, type, pdf_url, display_order FROM scores WHERE music_id = $1 ORDER BY display_order ASC, type ASC', [id]);
         updatedMusic.scores = finalScoresResult.rows; res.json(updatedMusic);
    } catch (err) {
         if (!res.headersSent) { await client.query('ROLLBACK'); res.status(500).json({ error: '更新音樂時發生內部伺服器錯誤' }); }
         console.error(`[DEBUG PUT /api/music/${id}] Error occurred, rolling back transaction. Error:`, err.stack || err);
    } finally { client.release(); }
});
app.delete('/api/admin/music/:id', async (req, res) => {
    const { id } = req.params;
    try { const result = await pool.query('DELETE FROM music WHERE id = $1', [id]); if (result.rowCount === 0) { return res.status(404).json({ error: '找不到音樂項目，無法刪除。' }); } res.status(204).send(); }
    catch (err) { console.error(`刪除音樂 ID ${id} 時出錯：`, err.stack || err); res.status(500).json({ error: '刪除過程中發生伺服器內部錯誤。' }); }
});



// --- 路由 ---
app.get('/news/:id(\\d+)', (req, res) => res.sendFile(path.join(__dirname, 'public', 'news-detail.html')));
app.get('/scores', (req, res) => res.sendFile(path.join(__dirname, 'public', 'scores.html')));
app.get('/guestbook', (req, res) => res.sendFile(path.join(__dirname, 'public', 'guestbook.html')));
app.get('/message-detail.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'message-detail.html')));
app.get('/rich.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'rich.html')));
app.get('/rich-control.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'rich-control.html')));

// --- Create HTTP Server ---
const server = http.createServer(app);

// --- WebSocket Server Setup ---
const wss = new WebSocket.Server({ server });

let gameClient = null;
const controllerClients = new Set();

wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');

    let clientType = 'unknown'; // Default client type
    try {
        // Extract clientType from URL query parameter, handle potential errors
        const requestUrl = new URL(req.url, `ws://${req.headers.host}`); // Need a base URL
        clientType = requestUrl.searchParams.get('clientType') || 'unknown';
    } catch (e) {
        console.error('Error parsing client connection URL:', e);
        // Keep clientType as 'unknown' or handle appropriately
    }

    console.log(`Identified client type: ${clientType}`); // Log identified type

    ws.clientType = clientType; // Assign type to the WebSocket object

    if (clientType === 'game') {
        console.log('Game client identified');
        if (gameClient && gameClient.readyState === WebSocket.OPEN) {
            console.log('Existing game client found, terminating previous.');
            try { gameClient.terminate(); } catch (e) { console.error("Error terminating previous game client:", e); }
        }
        gameClient = ws;
        broadcastToControllers({ type: 'gameStatus', status: 'connected' });
    } else if (clientType === 'controller') {
        console.log('Controller client identified');
        controllerClients.add(ws);
        // Send current game status to the new controller immediately
        try {
             ws.send(JSON.stringify({ type: 'gameStatus', status: gameClient && gameClient.readyState === WebSocket.OPEN ? 'connected' : 'disconnected' }));
         } catch (e) { console.error("Error sending initial status to controller:", e); }
    } else {
        console.log('Unknown client type connected');
    }

    ws.on('message', (message) => {
        let messageString;
        // --- START: Buffer Handling ---
        if (message instanceof Buffer) {
            messageString = message.toString('utf8'); // Convert Buffer to UTF-8 string
// console.log('Controller sent message, but game is not connected.');        } else if (typeof message === 'string') {
            messageString = message; // Already a string
           // console.log(`Received string message: ${messageString}`);
        } else {
            // Handle or ignore other types if necessary (e.g., ArrayBuffer)
// console.log(`Received string message: ${messageString}`);     
//        return; // Ignore non-string/buffer messages for now
        }
        // --- END: Buffer Handling ---

        let parsedMessage;
        try {
            parsedMessage = JSON.parse(messageString); // Parse the string version
        } catch (e) {
            // Log the string that failed parsing for debugging

            // Optionally notify the sender about the error
            // ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format received' }));
            return; // Stop processing this invalid message
        }

        // Route messages using parsedMessage
        if (ws.clientType === 'controller' && gameClient && gameClient.readyState === WebSocket.OPEN) {
 
            try {
                 gameClient.send(JSON.stringify(parsedMessage)); // Forward the valid JSON object
             } catch (e) { console.error("Error sending message to game client:", e); }
        } else if (ws.clientType === 'game') {


            broadcastToControllers(parsedMessage); // Broadcast the valid JSON object
        } else if (ws.clientType === 'controller' && (!gameClient || gameClient.readyState !== WebSocket.OPEN)) {

            try {
                 ws.send(JSON.stringify({ type: 'error', message: 'Game is not connected.' }));
             } catch (e) { console.error("Error sending 'game not connected' to controller:", e); }
        }
    });

    ws.on('close', () => {
        console.log(`WebSocket client disconnected (Type: ${ws.clientType})`);
        if (ws === gameClient) {
            gameClient = null;
            console.log('Game client disconnected');
            broadcastToControllers({ type: 'gameStatus', status: 'disconnected' });
        } else if (controllerClients.has(ws)) {
            controllerClients.delete(ws);
            console.log('Controller client disconnected');
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error (Client Type: ${ws.clientType}):`, error);
        // Clean up resources if an error occurs
        if (ws === gameClient) {
            gameClient = null;
             broadcastToControllers({ type: 'gameStatus', status: 'disconnected' });
        } else if (controllerClients.has(ws)) {
            controllerClients.delete(ws);
        }
        // Optionally try to close the connection if it's still open
        try { if (ws.readyState === WebSocket.OPEN) ws.close(); } catch (e) {}
    });
});

function broadcastToControllers(message) {
    if (controllerClients.size === 0) return; // No controllers connected

    try {
        const messageString = JSON.stringify(message);
         // ↓↓↓ 找到這一行 (或類似的) ↓↓↓
         // console.log(`Broadcasting to ${controllerClients.size} controllers: ${messageString}`);
         // ↓↓↓ 將其刪除或在前面加上 // 註解掉 ↓↓↓
         // // console.log(`Broadcasting to ${controllerClients.size} controllers: ${messageString}`);
         controllerClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                 try {
                     client.send(messageString);
                 } catch (e) {
                     console.error("Error sending message to a controller:", e);
                 }
            }
        });
    } catch (e) {
         console.error("Error stringifying message for broadcast:", e, message);
     }
}


// --- 404 Handler ---
app.use((req, res, next) => {
    console.log(`[404 Handler] Path not found: ${req.method} ${req.originalUrl}`);
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error("全局錯誤處理:", err.stack || err);
    if (res.headersSent) { return next(err); }
    res.status(err.status || 500).send(process.env.NODE_ENV === 'production' ? '伺服器發生了一些問題！' : `伺服器錯誤: ${err.message}`);
});

// --- Start Server ---
server.listen(PORT, () => { // <--- Use server.listen instead of app.listen
    console.log(`伺服器 (HTTP + WebSocket) 正在監聽 port ${PORT}`);
    pool.query('SELECT NOW()')
        .then(result => console.log('資料庫連接成功於', result.rows[0].now))
        .catch(err => console.error('資料庫連接錯誤:', err.stack || err));
});

// --- END OF FILE server.js ---