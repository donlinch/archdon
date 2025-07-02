// cook-kitchen-rush.js

/**
 * 廚房急先鋒 - 多人協作料理遊戲服務器
 * 基於BBS風格的會員制文字遊戲
 * 針對行動裝置優化的多人協作料理遊戲
 * 
 * 注意：此服務將作為主服務器(server.js)的一部分運行，不再獨立運行
 */

const express = require('express');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

module.exports = function(pool) { // <-- 接收傳入的 pool
    const cookGameApp = express();

    // 中間件設置
    cookGameApp.use(cors());
    cookGameApp.use(express.json());

    // JWT密鑰
    const JWT_SECRET = process.env.COOK_JWT_SECRET || 'cook-kitchen-rush-secret-key';

    // 遊戲認證中介軟體
    const authenticateToken = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
      
        if (!token) {
            return res.status(401).json({ success: false, error: '未提供認證令牌' });
        }

        jwt.verify(token, JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ success: false, error: '令牌無效或已過期' });
            }

            try {
                const result = await pool.query(
                    'SELECT user_id, username FROM box_users WHERE user_id = $1',
                    [decoded.userId] 
                );

                if (result.rows.length === 0) {
                    return res.status(403).json({ success: false, error: '找不到對應的使用者' });
                }

                req.user = {
                    userId: result.rows[0].user_id,
                    username: result.rows[0].username
                };
                
                next();
            } catch (error) {
                console.error('驗證使用者時出錯:', error);
                res.status(500).json({ success: false, error: '伺服器錯誤' });
            }
        });
    };

    const activeConnections = new Map(); // 用於追蹤 userId -> ws 的對應關係

    // 輔助函數：廣播訊息到指定房間
    async function broadcastToRoom(roomId, message, excludeWs = null) {
        try {
            const roomStateQuery = await pool.query('SELECT game_state FROM cook_game_rooms WHERE room_id = $1', [roomId]);
            if (roomStateQuery.rows.length === 0) return;
            
            const gameState = roomStateQuery.rows[0].game_state;
            if (!gameState || !gameState.players) return;

            const messageString = JSON.stringify(message);
            
            gameState.players.forEach(player => {
                const playerWs = activeConnections.get(player.id);
                if (playerWs && playerWs.readyState === WebSocket.OPEN && playerWs !== excludeWs) {
                    try {
                        playerWs.send(messageString);
                    } catch (sendError) {
                        console.error(`[Broadcast Error] 發送訊息給玩家 ${player.id} 失敗:`, sendError);
                    }
                }
            });
        } catch (error) {
            console.error(`[Broadcast Error] 廣播到房間 ${roomId} 失敗:`, error);
        }
    }

    // 輔助函數：處理玩家離開房間
    async function handlePlayerLeave(roomId, userId) {
        if (!roomId || !userId) return;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const roomResult = await client.query('SELECT * FROM cook_game_rooms WHERE room_id = $1 FOR UPDATE', [roomId]);
            if (roomResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return;
            }

            let room = roomResult.rows[0];
            let gameState = room.game_state || { players: [] };
            
            const playerIndex = gameState.players.findIndex(p => p.id === userId);
            if (playerIndex === -1) {
                await client.query('ROLLBACK');
                return;
            }

            const [leftPlayer] = gameState.players.splice(playerIndex, 1);
            console.log(`[COOK-GAME] 玩家 ${leftPlayer.username} (ID: ${userId}) 已從房間 ${roomId} 狀態中移除`);

            if (gameState.players.length === 0) {
                await client.query('DELETE FROM cook_game_rooms WHERE room_id = $1', [roomId]);
                console.log(`[COOK-GAME] 房間 ${roomId} 因無玩家而從資料庫中刪除`);
            } else {
                let newCreatorName = room.creator_name;
                let broadcastNewCreator = false;
                if (room.creator_id === userId) {
                    room.creator_id = gameState.players[0].id;
                    newCreatorName = gameState.players[0].username;
                    console.log(`[COOK-GAME] 房主已轉移給 ${newCreatorName}`);
                    broadcastNewCreator = true;
                }
                
                await client.query(
                    'UPDATE cook_game_rooms SET game_state = $1, creator_id = $2, creator_name = $3 WHERE room_id = $4',
                    [gameState, room.creator_id, newCreatorName, roomId]
                );
                
                const leaveMessage = {
                    type: 'player_left',
                    playerName: leftPlayer.username,
                    newCreator: broadcastNewCreator ? newCreatorName : undefined,
                    players: gameState.players
                };
                broadcastToRoom(roomId, leaveMessage);
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`[Player Leave Error] 處理玩家 ${userId} 離開房間 ${roomId} 失敗:`, error);
        } finally {
            client.release();
        }
    }

    // WebSocket連接處理函數 (修正版本，使用資料庫)
    async function handleAuthenticatedMessage(ws, data, userId, username, userProfile) {
        const { type, roomId } = data;

        switch (type) {
            case 'join_room': {
                if (!roomId) {
                    ws.send(JSON.stringify({ type: 'error', message: '未提供房間ID' }));
                    return;
                }
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');

                    const roomResult = await client.query('SELECT * FROM cook_game_rooms WHERE room_id = $1 FOR UPDATE', [roomId]);

                    if (roomResult.rows.length === 0) {
                        ws.send(JSON.stringify({ type: 'error', message: '找不到對應的遊戲房間，將返回大廳。' }));
                        await client.query('ROLLBACK');
                        return;
                    }

                    let room = roomResult.rows[0];
                    let gameState = room.game_state || { players: [], status: 'waiting' };

                    if (gameState.players.length >= 4 && !gameState.players.some(p => p.id === userId)) {
                        ws.send(JSON.stringify({ type: 'error', message: '房間已滿' }));
                        await client.query('ROLLBACK');
                        return;
                    }

                    if (!gameState.players.some(p => p.id === userId)) {
                        const newPlayer = {
                            id: userId,
                            username: userProfile.display_name || username,
                            level: userProfile.level || 1,
                            avatar: userProfile.user_profile_image_url || '/images/default-avatar.png',
                            ready: false
                        };
                        gameState.players.push(newPlayer);
                        await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                    }

                    ws.currentRoomId = roomId;
                    ws.userId = userId;

                    await client.query('COMMIT');
                    
                    const finalRoomDataResult = await pool.query('SELECT * FROM cook_game_rooms WHERE room_id = $1', [roomId]);
                    const finalRoomData = finalRoomDataResult.rows[0];

                    const roomInfoPayload = {
                        id: finalRoomData.room_id,
                        name: finalRoomData.room_name,
                        status: finalRoomData.status,
                        difficulty: finalRoomData.difficulty,
                        creatorName: finalRoomData.creator_name,
                        creatorId: finalRoomData.creator_id,
                        players: finalRoomData.game_state.players,
                    };

                    ws.send(JSON.stringify({ type: 'room_info', room: roomInfoPayload }));
                    
                    broadcastToRoom(roomId, { type: 'player_list_update', players: gameState.players });
                    console.log(`[COOK-GAME] 玩家 ${username} (ID: ${userId}) 已加入房間 ${roomId}`);

                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error(`[COOK-GAME] 加入房間錯誤:`, error);
                    ws.send(JSON.stringify({ type: 'error', message: '加入房間時發生後端錯誤' }));
                } finally {
                    client.release();
                }
                break;
            }
            case 'leave_room':
                if (roomId) {
                    await handlePlayerLeave(roomId, userId);
                    ws.currentRoomId = null;
                }
                break;
            case 'player_ready':
            case 'player_unready':
                if (roomId) {
                    const room = gameRooms.get(roomId);
                    if (room) {
                        const player = room.players.find(p => p.id === userId);
                        if (player) {
                            player.ready = (type === 'player_ready');
                            broadcastToRoom(roomId, { type: type, playerName: username });
                            broadcastToRoom(roomId, { type: 'player_list', players: room.players });
                        }
                    }
                }
                break;
            case 'chat_message':
                if (roomId) {
                    const room = gameRooms.get(roomId);
                    if (room) {
                        const player = room.players.find(p => p.id === userId);
                        const avatar = player ? player.username.charAt(0).toUpperCase() : '?';
                        broadcastToRoom(roomId, {
                            type: 'chat_message',
                            sender: username,
                            text: data.message,
                            avatar: avatar
                        });
                    }
                }
                break;
            case 'start_game':
                if (roomId) {
                    const room = gameRooms.get(roomId);
                    if (room && room.creatorId === userId) {
                        // 檢查是否所有玩家都已準備
                        const allReady = room.players.every(p => p.ready);
                        if (allReady && room.players.length > 1) { // 至少需要2人
                            broadcastToRoom(roomId, { type: 'game_starting', countdown: 3 });
                            setTimeout(() => startGame(roomId), 3000);
                        } else {
                            ws.send(JSON.stringify({ type: 'error', message: '所有玩家都必須準備好才能開始遊戲（至少2人）' }));
                        }
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: '只有房主可以開始遊戲' }));
                    }
                }
                break;
        }
    }
    
    // ... 其他路由和函數 ...
    
    cookGameApp.get(`/games/rooms`, authenticateToken, async (req, res) => {
        try {
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            const result = await pool.query(
                `SELECT room_id, room_name, difficulty, status, game_state, creator_name 
                 FROM cook_game_rooms 
                 WHERE updated_at > $1 AND status = 'waiting'
                 ORDER BY created_at DESC`
                , [thirtyMinutesAgo]
            );
            
            const rooms = result.rows.map(room => ({
                id: room.room_id,
                name: room.room_name,
                creator: room.creator_name,
                players: room.game_state.players?.length || 0,
                maxPlayers: 4,
                difficulty: room.difficulty,
                status: room.status
            }));
            
            res.json(rooms);
        } catch (error) {
            console.error('[COOK-GAME] 獲取房間列表錯誤:', error);
            res.status(500).json({ message: '獲取房間列表時服務器發生錯誤' });
        }
    });

    cookGameApp.post(`/games/rooms`, authenticateToken, async (req, res) => {
        try {
            const userId = req.user.userId;
            const username = req.user.username;
            const { name, difficulty } = req.body;
            
            const roomId = `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const roomName = name || `${username}的房間`;
            const roomDifficulty = difficulty || 'normal';

            const initialGameState = {
                players: [],
                score: 0,
                status: 'waiting'
            };
            
            await pool.query(
                `INSERT INTO cook_game_rooms (room_id, room_name, difficulty, status, creator_id, creator_name, game_state) 
                 VALUES ($1, $2, $3, 'waiting', $4, $5, $6)`,
                [roomId, roomName, roomDifficulty, userId, username, initialGameState]
            );

            res.status(201).json({ id: roomId, name: roomName, status: 'waiting' });
            console.log(`[COOK-GAME] 房間 ${roomId} 已創建並存入資料庫`);

        } catch (error) {
            console.error('[COOK-GAME] 創建房間錯誤:', error);
            res.status(500).json({ message: '創建房間時服務器發生錯誤' });
        }
    });

    // API: 快速登入
    cookGameApp.post(`/auth/quick-login`, async (req, res) => {
      try {
        const { username } = req.body;
        
        if (!username) {
          return res.status(400).json({ success: false, error: '請提供使用者名稱' });
        }
        
        // 1. 從主系統的會員表查詢用戶
        const result = await pool.query(
          'SELECT user_id, username FROM box_users WHERE username = $1',
          [username]
        );
        
        if (result.rows.length === 0) {
          return res.status(401).json({ success: false, error: '無效的使用者' });
        }
        
        const user = result.rows[0];
        
        // 2. 生成遊戲專用的 JWT
        const token = jwt.sign(
          { userId: user.user_id, username: user.username },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        // 3. 查詢或創建遊戲玩家資料 (與正常登入邏輯相同)
        let playerResult = await pool.query(
          'SELECT * FROM cook_players WHERE user_id = $1',
          [user.user_id]
        );
        
        if (playerResult.rows.length === 0) {
          // 如果是第一次玩遊戲，創建玩家資料
          await pool.query(
            'INSERT INTO cook_players (user_id, username, level, points, created_at, last_login) VALUES ($1, $2, 1, 0, NOW(), NOW())',
            [user.user_id, user.username]
          );
        } else {
          // 更新最後登入時間
          await pool.query(
            'UPDATE cook_players SET last_login = NOW() WHERE user_id = $1',
            [user.user_id]
          );
        }
        
        // 4. 返回成功的響應
        res.json({
          success: true,
          token
        });
        
      } catch (error) {
        console.error('快速登入處理出錯:', error);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
      }
    });
    
    // ... 其他遊戲邏輯函數 ...

    function initCookGameWss(server) {
        const wssCookGame = new WebSocket.Server({ noServer: true });

        wssCookGame.on('connection', (ws, req) => {
            console.log('[COOK-GAME WS] 收到一個新連接');
            ws.isAlive = true;

            ws.on('pong', () => {
                ws.isAlive = true;
            });

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    if (data.type === 'authenticate') {
                        // 使用 authenticateToken 函數來驗證，但我們需要的是解碼後的使用者資料
                        const decoded = await jwt.verify(data.token, process.env.JWT_SECRET);
                        if (decoded) {
                            const userId = decoded.userId;
                            ws.userId = userId;
                            activeConnections.set(userId, ws);
                            
                            const userRes = await pool.query(`
                                SELECT u.user_id, u.username, u.display_name, u.user_profile_image_url, COALESCE(p.level, 1) as level
                                FROM box_users u
                                LEFT JOIN cook_players p ON u.user_id = p.user_id
                                WHERE u.user_id = $1
                            `, [userId]);

                            const userProfile = userRes.rows[0];

                            ws.send(JSON.stringify({ type: 'auth_success' }));
                            console.log(`[COOK-GAME WS] 使用者 ${userProfile.display_name || userProfile.username} (ID: ${userId}) 認證成功`);
                            ws.userProfile = userProfile;
                        } else {
                            throw new Error('Token verification failed');
                        }
                    } else if (ws.userId && ws.userProfile) {
                        await handleAuthenticatedMessage(ws, data, ws.userId, ws.userProfile.username, ws.userProfile);
                    } else {
                        console.log("[COOK-GAME WS] 收到未認證的訊息:", data.type);
                    }
                } catch (err) {
                    console.error('[COOK-GAME WS] 處理訊息錯誤:', err);
                    ws.send(JSON.stringify({ type: 'error', message: '伺服器處理訊息時發生錯誤' }));
                    if(err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
                        ws.terminate();
                    }
                }
            });

            ws.on('close', () => {
                console.log('[COOK-GAME WS] 連接關閉');
                if (ws.userId) {
                    handlePlayerLeave(ws.currentRoomId, ws.userId);
                    activeConnections.delete(ws.userId);
                }
            });

            ws.on('error', (error) => {
                console.error('[COOK-GAME WS] 連接發生錯誤:', error);
            });
        });
      
        const interval = setInterval(() => {
            wssCookGame.clients.forEach(ws => {
                if (ws.isAlive === false) {
                    console.log('[COOK-GAME WS] 心跳超時，終止連接');
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        wssCookGame.on('close', () => {
            clearInterval(interval);
        });

        return wssCookGame;
    }

    return {
        cookGameApp,
        initCookGameWss
    };
};