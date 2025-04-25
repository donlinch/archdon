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
const dbClient = require('./dbclient'); // <--- 把這一行加在這裡
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 3000;
const createReportRateLimiter = require('./report-ip-limiter'); //限制器 html生成器
const reportTemplatesRouter = express.Router();   //做 html 網頁用的 report-view.html
const storeDb = require('./public/store/store-db');
const storeRoutes = require('./public/store/store-routes');




const multer = require('multer');
const fs = require('fs');










// --- 資料庫連接池設定 ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // 從環境變數讀取資料庫 URL
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false // 生產環境需要 SSL (Render 提供)
});


   
   
// --- 基本 Express 設定 ---
app.use(express.json());
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
app.use('/api/storemarket', storeRoutes);
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





        // 只處理 'moveCommand' 類型的消息
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
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e5) + ext;
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

 

// --- 記錄 Page View 中間件 ---
app.use(async (req, res, next) => {
    const pathsToLog = [
        '/', '/index.html', '/music.html', '/news.html', '/scores.html',
        '/guestbook.html', '/message-detail.html',
        '/game/card-game.html', // <-- 新增
        '/game/wheel-game.html', // <-- 新增
        '/game/brige-game.html',  // <-- 新增
        
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











// 2. 創建 IP 限制器實例（設置每日每IP最大報告數為10）
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
            ORDER BY name ASC
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
    '/inventory-admin.html',
    '/store/report/report-admin.html'
], basicAuthMiddleware);







// 保護所有 /api/admin 和 /api/analytics 開頭的 API
app.use(['/api/admin', '/api/analytics'], basicAuthMiddleware);

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
app.get('/api/admin/reports', basicAuthMiddleware, async (req, res) => {
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
app.get('/api/admin/reports/:id', basicAuthMiddleware, async (req, res) => {
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
app.post('/api/admin/reports', basicAuthMiddleware, async (req, res) => {
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
app.put('/api/admin/reports/:id', basicAuthMiddleware, async (req, res) => {
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
app.delete('/api/admin/reports/:id', basicAuthMiddleware, async (req, res) => {
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
app.post('/api/ui-elements', basicAuthMiddleware, async (req, res) => {
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
app.put('/api/ui-elements/:id', basicAuthMiddleware, async (req, res) => {
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
app.put('/api/ui-elements/:id/visibility', basicAuthMiddleware, async (req, res) => {
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
app.delete('/api/ui-elements/:id', basicAuthMiddleware, async (req, res) => {
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










// --- 更新商品 API (這應該要放在你的 server.js 中) ---
app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, price, image_url, seven_eleven_url } = req.body;
    
    if (isNaN(parseInt(id))) { 
        return res.status(400).json({ error: '無效的商品 ID 格式。' }); 
    }
    
    // 驗證必填欄位
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: '商品名稱不能為空。' });
    }

    try {
        const result = await pool.query(
            `UPDATE products 
             SET name = $1, 
                 description = $2, 
                 price = $3, 
                 image_url = $4, 
                 seven_eleven_url = $5, 
                 updated_at = NOW() 
             WHERE id = $6 
             RETURNING *`,
            [
                name.trim(), 
                description || null, 
                price, 
                image_url || null, 
                seven_eleven_url || null, 
                id
            ]
        );
        
        if (result.rowCount === 0) { 
            return res.status(404).json({ error: '找不到商品，無法更新。' }); 
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`更新商品 ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});





// 在 server.js 中添加以下代碼，放在適當的位置（比如在留言板 API 相關程式碼後面）

// --- 產品 API 路徑 ---
app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) { 
        return res.status(400).json({ error: '無效的商品 ID 格式。' }); 
    }
    try {
        const result = await pool.query('SELECT id, name, description, price, image_url, seven_eleven_url, click_count FROM products WHERE id = $1', [id]);
        if (result.rows.length === 0) { 
            return res.status(404).json({ error: '找不到商品。' }); 
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`獲取商品 ID ${id} 時出錯:`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
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
 
// --- WebSocket Server Setup ---
 
let gameClient = null;
const controllerClients = new Set();





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
 
// --- END OF FILE server.js ---

 
server.listen(PORT, async () => { // <--- 注意這裡可能需要加上 async
    console.log(`Server running on port ${PORT}`);
    // 可能還有其他現有的啟動代碼

    // ---> 添加以下代碼來初始化商店數據庫 <---
    try {
        await storeDb.initStoreDatabase();
        // 初始化成功日誌已在 storeDb.initStoreDatabase 內部處理
    } catch (err) {
        // 錯誤日誌已在 storeDb.initStoreDatabase 內部處理
        // 您可以選擇在這裡添加額外的錯誤處理，例如退出應用
        console.error('*** 商店數據庫初始化失敗，應用可能無法正常運行商店功能 ***');
    }
    // ---> 添加結束 <---

});




console.log('註冊路由: /api/news-categories');

// 修改API處理函數
app.get('/api/news-categories', async (req, res) => {
    console.log('收到請求: GET /api/news-categories'); // 添加此行
    try {
        const result = await pool.query(`
            SELECT id, name, slug, description, display_order 
            FROM news_categories 
            WHERE is_active = TRUE
            ORDER BY display_order ASC, name ASC
        `);
        console.log('查詢成功，返回分類數據'); // 添加此行
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('獲取新聞分類時出錯:', err.stack || err);
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

// --- 分類管理 API (需要身份驗證) ---
adminRouter.get('/news-categories', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, slug, description, display_order, is_active, created_at, updated_at
            FROM news_categories 
            ORDER BY display_order ASC, name ASC
        `);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('[受保護 API 錯誤] 獲取管理新聞分類時出錯:', err.stack || err);
        res.status(500).json({ error: '伺服器內部錯誤，無法獲取分類列表' });
    }
});

adminRouter.post('/news-categories', async (req, res) => {
    const { name, slug, description, display_order, is_active } = req.body;
    
    // 必填驗證
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: '分類名稱為必填項。' });
    }
    if (!slug || slug.trim() === '') {
        return res.status(400).json({ error: '分類標識符為必填項。' });
    }
    
    try {
        const result = await pool.query(`
            INSERT INTO news_categories (name, slug, description, display_order, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING *
        `, [name.trim(), slug.trim(), description ? description.trim() : null, 
            display_order || 0, is_active !== false]);
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[受保護 API 錯誤] 新增分類時出錯:', err.stack || err);
        if (err.code === '23505') { // 唯一約束衝突
            return res.status(400).json({ error: '該分類標識符已存在，請使用其他標識符。' });
        }
        res.status(500).json({ error: '伺服器內部錯誤，無法新增分類。' });
    }
});

adminRouter.put('/news-categories/:id', async (req, res) => {
    const { id } = req.params;
    const categoryId = parseInt(id);
    if (isNaN(categoryId)) {
        return res.status(400).json({ error: '無效的分類 ID 格式。' });
    }
    
    const { name, slug, description, display_order, is_active } = req.body;
    
    // 必填驗證
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: '分類名稱為必填項。' });
    }
    if (!slug || slug.trim() === '') {
        return res.status(400).json({ error: '分類標識符為必填項。' });
    }
    
    try {
        const result = await pool.query(`
            UPDATE news_categories
            SET name = $1, slug = $2, description = $3, display_order = $4, is_active = $5, updated_at = NOW()
            WHERE id = $6
            RETURNING *
        `, [name.trim(), slug.trim(), description ? description.trim() : null, 
            display_order || 0, is_active !== false, categoryId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到要更新的分類。' });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`[受保護 API 錯誤] 更新分類 ID ${id} 時出錯:`, err.stack || err);
        if (err.code === '23505') { // 唯一約束衝突
            return res.status(400).json({ error: '該分類標識符已存在，請使用其他標識符。' });
        }
        res.status(500).json({ error: '伺服器內部錯誤，無法更新分類。' });
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

