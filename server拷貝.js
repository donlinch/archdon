// --- START OF FILE server.js ---
 
// server.js
require('dotenv').config();
// const https = require('https'); // Keep this if you were explicitly using it, but usually not needed directly with Express + ws
const http = require('http'); // <--- Need http module
const express = require('express');
const path = require('path');
const { Pool } = require('pg'); // <--- dbClient handles this now
const WebSocket = require('ws'); // <--- Import the ws library
const dbClient = require('./dbclient'); // <--- Use the dbClient module
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 3000;

const multer = require('multer');
const fs = require('fs');

const disconnectedPlayers = new Map(); // key: roomId_playerId, value: { timeoutId, player }









//--- 資料庫連接池設定 ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // 從環境變數讀取資料庫 URL
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false // 生產環境需要 SSL (Render 提供)
 });


   
   
// --- 基本 Express 設定 ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));




// --- 遊戲房間 WebSocket 相關 ---
 
const simpleWalkerConnections = new Map();









// GET /api/admin/rooms - 獲取所有房間列表 (Admin)
app.get('/api/admin/rooms', async (req, res) => {
    console.log('[API GET /api/admin/rooms] Request received');
    try {
        const allDbRooms = await dbClient.getAllRooms(); // Use new dbClient function

        const rooms = allDbRooms.map(room => ({
            id: room.room_id,
            roomName: room.room_name,
            playerCount: Object.keys(room.game_state?.players || {}).length,
            maxPlayers: room.game_state?.maxPlayers || 0,
            createdAt: room.created_at,
            lastActive: room.last_active,
            isStale: new Date() - new Date(room.last_active) > 30 * 60 * 1000 // 超過 30 分鐘未活動
        }));
        console.log(`[API GET /api/admin/rooms] Found ${rooms.length} rooms`);
        res.json(rooms);
    } catch (error) {
        console.error('[API GET /api/admin/rooms] Error fetching rooms:', error);
        res.status(500).json({ error: '無法獲取房間列表' });
    }
});

// GET /api/admin/rooms/:roomId - 獲取特定房間詳情 (Admin)
app.get('/api/admin/rooms/:roomId', async (req, res) => {
    const { roomId } = req.params;
     console.log(`[API GET /api/admin/rooms/:roomId] Request received for room: ${roomId}`);
    try {
        const room = await dbClient.getRoom(roomId); // Use existing dbClient function
        if (!room) {
            console.warn(`[API GET /api/admin/rooms/:roomId] Room not found: ${roomId}`);
            return res.status(404).json({ error: '找不到指定的房間' });
        }
        console.log(`[API GET /api/admin/rooms/:roomId] Room found: ${roomId}`);
        res.json({
             id: room.room_id,
             roomName: room.room_name,
             createdAt: room.created_at,
             lastActive: room.last_active,
             gameState: room.game_state // 發送完整的遊戲狀態供除錯
        });
    } catch (error) {
        console.error(`[API GET /api/admin/rooms/:roomId] Error fetching details for room ${roomId}:`, error);
        res.status(500).json({ error: '無法獲取房間詳情' });
    }
});

// DELETE /api/admin/rooms/:roomId - 刪除特定房間 (Admin)
app.delete('/api/admin/rooms/:roomId', async (req, res) => {
    const { roomId } = req.params;
    console.log(`[API DELETE /api/admin/rooms/:roomId] Request received for room: ${roomId}`);
    try {
        const deleted = await dbClient.deleteRoom(roomId); // Use new dbClient function

        if (deleted) {
            console.log(`[API DELETE /api/admin/rooms/:roomId] Room deleted successfully: ${roomId}`);
            // Optional: Notify players in the room via WebSocket if the connection map is accessible here
            // broadcastToSimpleWalkerRoom(roomId, { type: 'error', message: '房間已被管理員關閉' });
            // Consider removing connections if broadcasting:
            // if (simpleWalkerConnections.has(roomId)) {
            //     simpleWalkerConnections.get(roomId).forEach(ws => ws.close(1000, '房間已關閉'));
            //     simpleWalkerConnections.delete(roomId);
            //     console.log(`[API DELETE /api/admin/rooms/:roomId] Closed active connections for room ${roomId}`);
            // }
            res.status(200).json({ success: true, message: `房間 ${roomId} 已成功刪除。` });
        } else {
            console.warn(`[API DELETE /api/admin/rooms/:roomId] Room not found for deletion: ${roomId}`);
            res.status(404).json({ error: '找不到要刪除的房間，可能已被刪除。' });
        }
    } catch (error) {
        console.error(`[API DELETE /api/admin/rooms/:roomId] Error deleting room ${roomId}:`, error);
        res.status(500).json({ error: '刪除房間時發生錯誤' });
    }
});


// --- ★★★ Simple Walker Public API Routes ★★★ ---

// POST /api/game-rooms - 創建房間 (Public)
app.post('/api/game-rooms', async (req, res) => {
    // ... (your existing code for this route, using dbClient.createRoom) ...
    const { roomName, maxPlayers } = req.body;

    console.log('[API POST /api/game-rooms] Received create room request:', { roomName, maxPlayers });

    if (!roomName || !roomName.trim()) {
        console.error('[API POST /api/game-rooms] Bad Request: Missing roomName');
        return res.status(400).json({ error: '房間名稱為必填項' });
    }

    const maxPlayersInt = parseInt(maxPlayers, 10);
    if (isNaN(maxPlayersInt) || maxPlayersInt < 2 || maxPlayersInt > 5) {
        console.error('[API POST /api/game-rooms] Bad Request: Invalid maxPlayers', maxPlayers);
        return res.status(400).json({ error: '無效的最大玩家數 (需介於 2-5 之間)' });
    }

    try {
        const roomId = uuidv4().substring(0, 8); // Use shorter UUID part for roomId
        console.log(`[API POST /api/game-rooms] Attempting to create room with ID: ${roomId}`);

        const createdDbRoom = await dbClient.createRoom(roomId, roomName.trim(), maxPlayersInt);

        if (!createdDbRoom || !createdDbRoom.game_state) {
             console.error(`[API POST /api/game-rooms] dbClient.createRoom failed for roomId: ${roomId}`);
             throw new Error('資料庫創建房間失敗或返回格式不正確');
        }

        console.log(`[API POST /api/game-rooms] Room created successfully in DB: ${roomId}`);

        const responseData = {
            id: createdDbRoom.room_id,
            roomName: createdDbRoom.room_name,
            maxPlayers: createdDbRoom.game_state.maxPlayers
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

// GET /api/game-rooms - 獲取活躍房間列表 (Public)
app.get('/api/game-rooms', async (req, res) => {
    // ... (your existing code using dbClient.getActiveRooms or pool query) ...
    try {
        // Use dbClient for consistency, although direct pool query is also fine
        const activeDbRooms = await dbClient.getActiveRooms(30); // Get rooms active in last 30 mins

        const roomsData = activeDbRooms.map(room => {
            const gameState = room.game_state || {}; // Default to empty object
            const playerCount = Object.keys(gameState.players || {}).length;

            return {
                id: room.room_id,
                roomName: room.room_name,
                playerCount,
                maxPlayers: gameState.maxPlayers || 0, // Default if missing
                createdAt: room.created_at
            };
        });

        res.json(roomsData);
    } catch (err) {
        console.error('[API GET /api/game-rooms] Error fetching active rooms:', err);
        res.status(500).json({ error: '獲取房間列表時發生伺服器錯誤' });
    }
});

// GET /api/game-rooms - 獲取活躍房間列表 (Public)
// ★★★ MODIFIED to use dbClient ★★★
app.get('/api/game-rooms', async (req, res) => {
    try {
        // Use dbClient to get active rooms
        const activeDbRooms = await dbClient.getActiveRooms(30); // Get rooms active in last 30 mins

        const roomsData = activeDbRooms.map(room => {
            const gameState = room.game_state || {}; // Default to empty object
            const playerCount = Object.keys(gameState.players || {}).length;

            return {
                id: room.room_id,
                roomName: room.room_name,
                playerCount,
                maxPlayers: gameState.maxPlayers || 0, // Default if missing
                createdAt: room.created_at // Keep createdAt if needed by frontend
            };
        });

        res.json(roomsData);
    } catch (err) {
        console.error('[API GET /api/game-rooms] Error fetching active rooms:', err);
        res.status(500).json({ error: '獲取房間列表時發生伺服器錯誤' });
    }
});


// GET /api/game-rooms/:roomId (Public - needed for join check/display)
// ★★★ MODIFIED to use dbClient ★★★
app.get('/api/game-rooms/:roomId', async (req, res) => {
    const { roomId } = req.params;
    try {
        const room = await dbClient.getRoom(roomId); // Use dbClient
        if (!room) {
            return res.status(404).json({ error: '找不到指定的房間' });
        }
         const gameState = room.game_state || {};
         const playerCount = Object.keys(gameState.players || {}).length;
         res.json({
             id: room.room_id,
             roomName: room.room_name,
             maxPlayers: gameState.maxPlayers || 0,
             playerCount: playerCount // Return current player count
         });
    } catch (error) {
        console.error(`[API GET /api/game-rooms/:roomId] Error fetching room ${roomId}:`, error);
        res.status(500).json({ error: '獲取房間信息時發生錯誤' });
    }
});







// POST /api/game-rooms/:roomId/join (Public - Pre-join check)
// ★★★ MODIFIED to use dbClient ★★★
app.post('/api/game-rooms/:roomId/join', async (req, res) => {
    const { roomId } = req.params;
    const { playerName } = req.body;

    if (!playerName || !playerName.trim() || playerName.length > 10) {
        return res.status(400).json({ error: '玩家名稱必須在 1-10 個字元之間' });
    }

    try {
        const room = await dbClient.getRoom(roomId); // Use dbClient

        if (!room || !room.game_state) {
            return res.status(404).json({ error: '找不到指定房間' });
        }

        const trimmedPlayerName = playerName.trim();
        const gameState = room.game_state;

        if (Object.keys(gameState.players || {}).length >= gameState.maxPlayers) {
            return res.status(409).json({ error: '房間已滿' });
        }

        for (const playerId in gameState.players) {
            if (gameState.players[playerId].name === trimmedPlayerName) {
                return res.status(409).json({ error: '該名稱已被使用' });
            }
        }

        res.status(200).json({ message: '可以加入房間', roomId, playerName: trimmedPlayerName });
    } catch (err) {
        console.error('[API POST /api/game-rooms/:roomId/join] Error checking room:', err);
        res.status(500).json({ error: '檢查房間時發生伺服器錯誤' });
    }
});





// --- ★★★ 定期清理不活躍房間 (using dbClient) ★★★ ---
const CLEANUP_INTERVAL_MINUTES = 60; // 每 60 分鐘清理一次
const INACTIVE_HOURS = 1; // 清理超過 1 小時未活動的房間

async function runCleanup() {
    try {
        console.log(`[Cleanup Task] 開始清理 ${INACTIVE_HOURS} 小時前不活躍的 Simple Walker 房間...`);
        const cleanedCount = await dbClient.cleanInactiveRooms(INACTIVE_HOURS); // Use dbClient function
        if (cleanedCount > 0) {
            console.log(`[Cleanup Task] 清理完成，移除了 ${cleanedCount} 個不活躍的房間。`);
        } else {
         //   console.log(`[Cleanup Task] 清理完成，沒有需要清理的不活躍房間。`);
        }
    } catch (error) {
        console.error('[Cleanup Task] 自動清理房間時發生錯誤:', error);
    }
}

// 設定定時器
setInterval(runCleanup, CLEANUP_INTERVAL_MINUTES * 60 * 1000);
// 伺服器啟動後延遲一點時間執行第一次清理
console.log(`[Cleanup Task] 已設定排程任務：每 ${CLEANUP_INTERVAL_MINUTES} 分鐘清理 ${INACTIVE_HOURS} 小時前不活躍的房間。`);
setTimeout(() => {
    console.log("[Cleanup Task] 伺服器啟動，執行首次清理任務...");
    runCleanup();
}, 45 * 1000); // 延遲 45 秒執行


// --- HTTP 服務器設置 ---
const server = http.createServer(app);

// --- WebSocket 服務器設置 ---
const wss = new WebSocket.Server({ server });

// --- WebSocket 連接處理 ---
wss.on('connection', async (ws, req) => {
    // ... (Keep your existing wss.on('connection') logic for Simple Walker) ...
    // Ensure it uses dbClient functions like getRoom, addPlayerToRoom etc.
    // Make sure the catch block in connection setup handles errors correctly
    // e.g., ws.close(4000, 'Room full') or ws.close(4000, 'Name taken')
    const url = new URL(req.url, `http://${req.headers.host}`);
    const clientType = url.searchParams.get('clientType');
    const roomId = url.searchParams.get('roomId');
    const playerName = url.searchParams.get('playerName'); // 假設playerName是唯一的標識符
  //  console.log(`[WS] Connection attempt: Type=${clientType}, Room=${roomId}, Player=${playerName}`);

    if (!roomId || !clientType || !playerName) {
        console.warn(`[WS] Connection rejected: Missing roomId, clientType, or playerName.`);
        ws.close(1008, "缺少房間 ID、客戶端類型或玩家名稱");
        return;
    }










    if (clientType === 'controller') {
        let roomData;
        let gameState;
        let playerToUseId = null; // 用於存儲找到的或新生成的玩家ID
        let isReconnecting = false;

        try {
            // 1. 獲取當前房間數據
            roomData = await dbClient.getRoom(roomId);
            if (!roomData || !roomData.game_state) {
                console.warn(`[WS Simple Walker] Room ${roomId} not found or invalid state. Terminating.`);
                ws.close(1011, "找不到房間或房間無效");
                return;
            }
            gameState = roomData.game_state; // 直接使用從DB獲取的最新狀態
            console.log(`[WS Simple Walker] Room ${roomId} found. Checking for player: ${playerName}`);

            // 2. 檢查玩家是否已存在 (基於 playerName)
            let existingPlayerEntry = null;
            if (gameState.players) {
                existingPlayerEntry = Object.entries(gameState.players).find(
                    ([id, player]) => player.name === playerName
                );
            }

            if (existingPlayerEntry) {
                // --- 玩家已存在，視為重連 ---
                isReconnecting = true;
                playerToUseId = existingPlayerEntry[0]; // 獲取已存在的 playerId
                const existingPlayer = existingPlayerEntry[1];
                console.log(`[WS Simple Walker] Player ${playerName} (ID: ${playerToUseId}) is reconnecting. Position: ${existingPlayer.position}`);

                // *** 不需要調用 addPlayerToRoom ***
                // *** 也不需要修改 gameState 或數據庫 ***

                ws.playerId = playerToUseId;
                ws.roomId = roomId;
                ws.clientType = clientType;
                ws.playerName = playerName;

                if (!simpleWalkerConnections.has(roomId)) {
                    simpleWalkerConnections.set(roomId, new Set());
                }
                // 注意：如果舊的 ws 連接還在 map 中，這裡會替換掉它嗎？
                // 最好在 handleSimpleWalkerClose 中確保舊 ws 被移除
                simpleWalkerConnections.get(roomId).add(ws);
                console.log(`[WS Simple Walker] Reconnection added. Room ${roomId} active connections: ${simpleWalkerConnections.get(roomId).size}`);

                // 發送玩家信息 (使用現有ID)
                ws.send(JSON.stringify({ type: 'playerInfo', playerId: playerToUseId }));

                // 發送當前的遊戲狀態 (包含玩家的正確位置)
                ws.send(JSON.stringify({ type: 'gameStateUpdate', roomName: roomData.room_name, gameState: gameState }));
                 // 可選：如果需要，可以廣播一個 playerReconnected 消息，但gameStateUpdate已包含最新狀態

            } else {
                // --- 玩家不存在，視為新加入 ---
                console.log(`[WS Simple Walker] Player ${playerName} is joining as a new player.`);

                // 檢查房間是否已滿 (使用當前從DB讀取的狀態)
                if (Object.keys(gameState.players || {}).length >= gameState.maxPlayers) {
                     console.warn(`[WS Simple Walker] Room ${roomId} is full. Rejecting player ${playerName}.`);
                     throw new Error("房間已滿"); // 拋出錯誤，會在catch中處理
                }

                // 生成新 Player ID
                playerToUseId = uuidv4();
                console.log(`[WS Simple Walker] Generated new Player ID ${playerToUseId} for ${playerName}.`);

                // *** 調用 addPlayerToRoom 將新玩家加入數據庫 (預設位置為 0) ***
                const updatedRoomResult = await dbClient.addPlayerToRoom(roomId, playerToUseId, playerName);
                if (!updatedRoomResult || !updatedRoomResult.game_state) {
                    throw new Error("加入房間到資料庫失敗");
                }
                const latestGameState = updatedRoomResult.game_state; // 使用加入後的最新狀態
                const latestRoomName = updatedRoomResult.room_name;
                console.log(`[WS Simple Walker] Player ${playerName} (ID: ${playerToUseId}) added to room ${roomId} state in DB.`);

                ws.playerId = playerToUseId;
                ws.roomId = roomId;
                ws.clientType = clientType;
                ws.playerName = playerName;

                if (!simpleWalkerConnections.has(roomId)) {
                    simpleWalkerConnections.set(roomId, new Set());
                }
                simpleWalkerConnections.get(roomId).add(ws);
                console.log(`[WS Simple Walker] New connection added. Room ${roomId} active connections: ${simpleWalkerConnections.get(roomId).size}`);

                // 發送玩家信息 (使用新ID)
                ws.send(JSON.stringify({ type: 'playerInfo', playerId: playerToUseId }));

                // 發送最新的遊戲狀態 (來自 addPlayerToRoom 的結果)
                ws.send(JSON.stringify({ type: 'gameStateUpdate', roomName: latestRoomName, gameState: latestGameState }));

                // 廣播最新的遊戲狀態給房間內的其他玩家
                broadcastToSimpleWalkerRoom(roomId, {
                    type: 'gameStateUpdate',
                    roomName: latestRoomName,
                    gameState: latestGameState
                }, ws); // 排除自己
            }

            // 為這個 ws 連接綁定事件處理器 (無論是新連還是重連)
            ws.on('message', (message) => handleSimpleWalkerMessage(ws, message));
            ws.on('close', () => handleSimpleWalkerClose(ws));
            ws.on('error', (error) => handleSimpleWalkerError(ws, error));

        } catch (error) {
            console.error(`[WS Simple Walker] Error during connection setup for player ${playerName} in room ${roomId}:`, error.message);
            let closeReason = "加入房間失敗";
            let closeCode = 4000;

            if (error.message.includes('房間已滿')) {
                closeReason = "房間已滿";
                closeCode = 4001;
            } else if (error.message.includes('玩家名稱已被使用')) { // 如果 addPlayerToRoom 拋出此錯誤
                closeReason = "玩家名稱已被使用";
                 closeCode = 4002;
            } else if (error.message.includes('找不到房間')) {
                 closeReason = "找不到房間";
                 closeCode = 1011;
            }

            try { ws.send(JSON.stringify({ type: 'error', message: closeReason })); } catch (sendErr) { /* Ignore */ }
            ws.close(closeCode, closeReason);
            return; // 停止處理此連接
        }

    } else {
        console.warn(`[WS] Unknown clientType: ${clientType}. Closing connection.`);
        ws.close(1003, "不支持的客戶端類型");
    }
});

// 同時，確保 handleSimpleWalkerClose 會正確移除玩家數據
async function handleSimpleWalkerClose(ws) {
    const roomId = ws.roomId;
    const playerId = ws.playerId;
    const clientType = ws.clientType;
    const playerName = ws.playerName || playerId;

    if (!roomId || !playerId || !clientType || clientType !== 'controller') {
        return;
    }
    console.log(`[WS Simple Walker Close] Player ${playerName} (${playerId}) disconnected from room ${roomId}.`);

    const connections = simpleWalkerConnections.get(roomId);
    if (connections) {
        connections.delete(ws); // 從內存連接池中移除
        console.log(`[WS Simple Walker Close] Connection removed from memory map. Room ${roomId} remaining: ${connections.size}`);
        if (connections.size === 0) {
            simpleWalkerConnections.delete(roomId);
            console.log(`[WS Simple Walker Close] Room ${roomId} removed from active connections map as it's empty.`);
            // 注意：這裡不刪除資料庫中的房間，讓 cleanup job 來處理
        }
    }

    // *** 這裡很重要：從數據庫狀態中移除玩家 ***
    // 這樣即使玩家意外斷線，狀態也會被清理
    try {
        console.log(`[WS Simple Walker Close] Removing player ${playerName} (${playerId}) from DB state in room ${roomId}...`);
        const updatedRoomResult = await dbClient.removePlayerFromRoom(roomId, playerId); // <--- 確認這會更新DB

        if (updatedRoomResult && updatedRoomResult.game_state && simpleWalkerConnections.has(roomId)) {
            // 如果移除玩家後房間還有其他人，廣播更新後的狀態
             const remainingPlayersCount = Object.keys(updatedRoomResult.game_state.players || {}).length;
             console.log(`[WS Simple Walker Close] Player removed from DB. Remaining: ${remainingPlayersCount}. Broadcasting update.`);
             if (remainingPlayersCount > 0 && connections && connections.size > 0) { // 確保還有連接可以廣播
                 broadcastToSimpleWalkerRoom(roomId, {
                     type: 'gameStateUpdate',
                     roomName: updatedRoomResult.room_name,
                     gameState: updatedRoomResult.game_state
                 });
             }
        } else if (!updatedRoomResult) {
            console.warn(`[WS Simple Walker Close] Room ${roomId} not found in DB during player removal, maybe already cleaned up.`);
        } else {
            // console.log(`[WS Simple Walker Close] Player removed, no remaining connections in room ${roomId} to broadcast to.`);
        }
    } catch (error) {
        console.error(`[WS Simple Walker Close] Error removing player ${playerName} (${playerId}) from DB or broadcasting:`, error.stack || error);
    }
}


    



// 新增: 獲取玩家位置
app.get('/api/player-position', async (req, res) => {
    const { roomId, playerName } = req.query;

    if (!roomId || !playerName) {
        return res.status(400).json({ error: '缺少房間ID或玩家名稱' });
    }

    try {
        const room = await dbClient.getRoom(roomId);
        if (!room) {
            return res.status(404).json({ error: '找不到房間' });
        }

        const player = room.game_state.players && Object.values(room.game_state.players).find(player => player.name === playerName);
        if (!player) {
            return res.status(404).json({ error: '玩家未找到' });
        }

        res.json({ success: true, position: player.position });
    } catch (err) {
        console.error('獲取玩家位置錯誤:', err);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});











// --- WebSocket Message/Close/Error Handlers (Keep your existing handlers) ---
// Make sure handleSimpleWalkerMessage uses dbClient.updatePlayerPosition
// Make sure handleSimpleWalkerClose uses dbClient.removePlayerFromRoom
// Make sure broadcastToSimpleWalkerRoom is defined and works correctly

// ★★★ 添加或恢復這個函數定義 ★★★
async function handleSimpleWalkerMessage(ws, message) {
    if (!ws.roomId || !ws.playerId || !ws.clientType || ws.clientType !== 'controller') {
       console.warn(`[WS Simple Walker Msg] Received message from invalid connection. Ignoring.`);
       return;
   }
   const roomId = ws.roomId;
   const playerId = ws.playerId;
   const playerName = ws.playerName || playerId; // Use stored name

   try {
       let parsedMessage; // <--- 確保解析發生在 try 內部
       try {
           parsedMessage = JSON.parse(message);
       } catch (parseError) {
            console.error(`[WS Simple Walker Msg] Failed to parse message from ${playerName} (${playerId}):`, message, parseError);
            return; // 無法解析的消息，直接忽略
       }

       console.log(`[WS Simple Walker Msg] Received from ${playerName} (${playerId}) in ${roomId}:`, parsedMessage.type);

       if (parsedMessage.type === 'moveCommand' && parsedMessage.direction) {
           const direction = parsedMessage.direction;

           // 1. 獲取最新房間數據 (確保拿到最新狀態來計算)
           const roomData = await dbClient.getRoom(roomId); // Use dbClient
           if (!roomData || !roomData.game_state || !roomData.game_state.players) {
               console.warn(`[WS Simple Walker Move] Invalid room state for ${roomId}. Cannot process move.`);
               // 可選：發送錯誤回客戶端
               // ws.send(JSON.stringify({ type: 'error', message: '伺服器房間狀態錯誤' }));
               return;
           }
           const gameState = roomData.game_state;
           const mapSize = gameState.mapLoopSize || 10; // 從遊戲狀態獲取地圖大小

           // 2. 檢查玩家是否存在於當前狀態
           if (!gameState.players[playerId]) {
               console.warn(`[WS Simple Walker Move] Player ${playerName} (${playerId}) not found in current state for room ${roomId}. Connection might be stale.`);
               // 玩家數據可能因某些原因丟失，強制斷開或提示錯誤
               ws.send(JSON.stringify({ type: 'error', message: '伺服器狀態錯誤，找不到您的資料，請嘗試重新加入' }));
               ws.close(1011, "玩家資料不同步");
               return;
           }

           // 3. 計算新位置
           let currentPosition = gameState.players[playerId].position;
           let newPosition;
           if (direction === 'forward') {
               newPosition = (currentPosition + 1) % mapSize;
           } else if (direction === 'backward') {
               newPosition = (currentPosition - 1 + mapSize) % mapSize; // 確保負數取模正確
           } else {
               console.warn(`[WS Simple Walker Move] Invalid direction received: ${direction}`);
               return; // 忽略無效方向
           }

           console.log(`[WS Simple Walker Move] Updating ${playerName} (${playerId}) in ${roomId} from ${currentPosition} to ${newPosition}`);

           // 4. 更新資料庫中的玩家位置
           const updatedRoomResult = await dbClient.updatePlayerPosition(roomId, playerId, newPosition); // Use dbClient

           if (!updatedRoomResult || !updatedRoomResult.game_state) {
               console.error(`[WS Simple Walker Move] Failed to update position in DB for ${playerName} (${playerId})`);
               ws.send(JSON.stringify({ type: 'error', message: '更新位置時伺服器發生錯誤' }));
               return; // 更新失敗，不廣播
           }

           // 5. 廣播最新的遊戲狀態給房間內所有玩家
           const latestGameState = updatedRoomResult.game_state;
           const latestRoomName = updatedRoomResult.room_name;

           console.log(`[WS Simple Walker Move] Player ${playerName} moved. Broadcasting update to room ${roomId}.`);
           broadcastToSimpleWalkerRoom(roomId, {
               type: 'gameStateUpdate',
               roomName: latestRoomName,
               gameState: latestGameState
           }); // 廣播給所有人，包括自己，以確保狀態同步

       } else {
           console.warn(`[WS Simple Walker Msg] Received unknown or malformed message type from ${playerName} (${playerId}): ${parsedMessage.type}`);
           // 可以選擇忽略或發送錯誤提示
           // ws.send(JSON.stringify({ type: 'error', message: `未知的命令類型: ${parsedMessage.type}` }));
       }

   } catch (error) {
       // 這個 catch 處理 JSON.parse 之外的其他異步錯誤 (如 DB 操作錯誤)
       console.error(`[WS Simple Walker Msg] Error processing message from ${playerName} (${playerId}):`, error.stack || error);
       try {
           // 嘗試發送通用錯誤給客戶端
           ws.send(JSON.stringify({ type: 'error', message: '處理您的請求時伺服器發生錯誤' }));
       } catch (sendErr) {
           console.error(`[WS Simple Walker Msg] Failed to send error message to ${playerName} (${playerId}):`, sendErr);
       }
   }
}

// --- 你的 handleSimpleWalkerClose, handleSimpleWalkerError, broadcastToSimpleWalkerRoom 函數定義應該在這裡 ---
async function handleSimpleWalkerClose(ws) {
   // ... (你之前的 handleSimpleWalkerClose 程式碼) ...
   const roomId = ws.roomId;
   const playerId = ws.playerId;
   const clientType = ws.clientType;
   const playerName = ws.playerName || playerId;

   if (!roomId || !playerId || !clientType || clientType !== 'controller') {
       return;
   }
   console.log(`[WS Simple Walker Close] Player ${playerName} (${playerId}) disconnected from room ${roomId}.`);

   const connections = simpleWalkerConnections.get(roomId);
   if (connections) {
       connections.delete(ws); // 從內存連接池中移除
       console.log(`[WS Simple Walker Close] Connection removed from memory map. Room ${roomId} remaining: ${connections.size}`);
       if (connections.size === 0) {
           simpleWalkerConnections.delete(roomId);
           console.log(`[WS Simple Walker Close] Room ${roomId} removed from active connections map as it's empty.`);
           // 注意：這裡不刪除資料庫中的房間，讓 cleanup job 來處理
       }
   }

   // *** 這裡很重要：從數據庫狀態中移除玩家 ***
   // 這樣即使玩家意外斷線，狀態也會被清理
   try {
       console.log(`[WS Simple Walker Close] Removing player ${playerName} (${playerId}) from DB state in room ${roomId}...`);
       const updatedRoomResult = await dbClient.removePlayerFromRoom(roomId, playerId); // <--- 確認這會更新DB

       if (updatedRoomResult && updatedRoomResult.game_state && simpleWalkerConnections.has(roomId)) {
           // 如果移除玩家後房間還有其他人，廣播更新後的狀態
            const remainingPlayersCount = Object.keys(updatedRoomResult.game_state.players || {}).length;
            console.log(`[WS Simple Walker Close] Player removed from DB. Remaining: ${remainingPlayersCount}. Broadcasting update.`);
            if (remainingPlayersCount > 0 && connections && connections.size > 0) { // 確保還有連接可以廣播
                broadcastToSimpleWalkerRoom(roomId, {
                    type: 'gameStateUpdate',
                    roomName: updatedRoomResult.room_name,
                    gameState: updatedRoomResult.game_state
                });
            }
       } else if (!updatedRoomResult) {
           console.warn(`[WS Simple Walker Close] Room ${roomId} not found in DB during player removal, maybe already cleaned up.`);
       } else {
           // console.log(`[WS Simple Walker Close] Player removed, no remaining connections in room ${roomId} to broadcast to.`);
       }
   } catch (error) {
       console.error(`[WS Simple Walker Close] Error removing player ${playerName} (${playerId}) from DB or broadcasting:`, error.stack || error);
   }
}


function handleSimpleWalkerError(ws, error) {
   // ... (你之前的 handleSimpleWalkerError 程式碼) ...
    const roomId = ws.roomId || 'unknown_room';
   const playerId = ws.playerId || 'unknown_player';
   const playerName = ws.playerName || playerId;
   const clientType = ws.clientType || 'unknown_type';

   console.error(`[WS Simple Walker Error] WebSocket error for ${clientType} ${playerName} (${playerId}) in room ${roomId}:`, error.message);

   // Ensure close handler runs if connection didn't close gracefully
   if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
       console.log(`[WS Simple Walker Error] Terminating connection due to error.`);
       handleSimpleWalkerClose(ws); // Attempt cleanup
       ws.terminate(); // Force close
   }
}

function broadcastToSimpleWalkerRoom(roomId, message, senderWs = null) {
   // ... (你之前的 broadcastToSimpleWalkerRoom 程式碼) ...
   const connections = simpleWalkerConnections.get(roomId);

   if (!connections || connections.size === 0) {
       return;
   }

   const messageString = JSON.stringify(message);
   let broadcastCount = 0;

   connections.forEach(client => {
       // 確保 client 有 playerId 和 playerName 屬性 (增加健壯性)
       const clientName = client.playerName || client.playerId || 'unknown';
       if (client !== senderWs && client.readyState === WebSocket.OPEN) {
           try {
               client.send(messageString);
               broadcastCount++;
           } catch (sendError) {
               console.error(`[WS Broadcast Error] Failed to send to ${clientName} in room ${roomId}:`, sendError.message);
               // 從 Set 中移除失敗的客戶端並終止連接
               connections.delete(client);
               client.terminate();
                console.log(`[WS Broadcast Error] Terminated connection for ${clientName} in room ${roomId}.`);
           }
       }
   });

   if (broadcastCount > 0) {
        const senderName = senderWs ? (senderWs.playerName || senderWs.playerId || 'sender') : '';
        const excludingSender = senderWs ? ` (excluding sender ${senderName})` : '';
        // 日誌可以稍微簡化，避免每次都打印消息類型
        // console.log(`[WS Broadcast] Sent gameStateUpdate to ${broadcastCount} client(s) in room ${roomId}${excludingSender}.`);
   }
}






function handleSimpleWalkerError(ws, error) {
    // ... (Your existing logic) ...
     const roomId = ws.roomId || 'unknown_room';
    const playerId = ws.playerId || 'unknown_player';
    const playerName = ws.playerName || playerId;
    const clientType = ws.clientType || 'unknown_type';

    console.error(`[WS Simple Walker Error] WebSocket error for ${clientType} ${playerName} (${playerId}) in room ${roomId}:`, error.message);

    // Ensure close handler runs if connection didn't close gracefully
    if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        console.log(`[WS Simple Walker Error] Terminating connection due to error.`);
        handleSimpleWalkerClose(ws); // Attempt cleanup
        ws.terminate(); // Force close
    }
}

function broadcastToSimpleWalkerRoom(roomId, message, senderWs = null) {
    // ... (Your existing logic) ...
    const connections = simpleWalkerConnections.get(roomId);

    if (!connections || connections.size === 0) {
        return;
    }

    const messageString = JSON.stringify(message);
    let broadcastCount = 0;

    connections.forEach(client => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            try {
                client.send(messageString);
                broadcastCount++;
            } catch (sendError) {
                console.error(`[WS Broadcast Error] Failed to send to ${client.playerName || client.playerId} in room ${roomId}:`, sendError.message);
                connections.delete(client);
                client.terminate();
            }
        }
    });

    if (broadcastCount > 0) {
         const excludingSender = senderWs ? ` (excluding sender ${senderWs.playerName || senderWs.playerId})` : '';
         // console.log(`[WS Broadcast] Sent to ${broadcastCount} client(s) in room ${roomId}${excludingSender}. Type: ${message.type}`);
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

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`✅ Server is running and listening on port ${PORT}`);
    console.log(`🎮 Simple Walker Game Entry: http://localhost:${PORT}/`); // Assuming index.html is the entry
    console.log(`🛠️ Simple Walker Admin: http://localhost:${PORT}/rich/admin`); // Admin page URL
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('收到 SIGINT，準備關閉...');
    wss.close(() => {
         console.log('WebSocket 伺服器已關閉');
         server.close(async () => {
             console.log('HTTP 伺服器已關閉');
             await dbClient.close(); // Close DB connection using dbClient
             console.log('資料庫連接已關閉。');
             process.exit(0);
         });
    });
});
process.on('SIGTERM', async () => {
     console.log('收到 SIGTERM，準備關閉...');
     wss.close(() => {
          console.log('WebSocket 伺服器已關閉');
          server.close(async () => {
              console.log('HTTP 伺服器已關閉');
              await dbClient.close(); // Close DB connection using dbClient
              console.log('資料庫連接已關閉。');
              process.exit(0);
          });
     });
});
