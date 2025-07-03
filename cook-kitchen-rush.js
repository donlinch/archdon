// cook-kitchen-rush.js

/**
 * 料理急先鋒 - 多人協作料理遊戲服務器
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

// ★ 新增：用於管理斷線計時器
const disconnectionTimers = new Map();
// ★ 新增：用於管理遊戲計時器
const gameTimers = new Map();

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
                // 檢查用戶是否存在
                const userResult = await pool.query(
                    'SELECT * FROM box_users WHERE user_id = $1',
                    [decoded.userId]
                );

                if (userResult.rows.length === 0) {
                    return res.status(404).json({ success: false, error: '找不到用戶' });
                }

                // 將用戶信息添加到請求對象
                req.user = {
                    userId: decoded.userId,
                    username: decoded.username,
                    // 其他需要的用戶信息
                };
                next();
            } catch (error) {
                console.error('驗證用戶時出錯:', error);
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
                // ★ 新增：如果房間沒有玩家了，清除遊戲計時器
                if (gameTimers.has(roomId)) {
                    clearInterval(gameTimers.get(roomId));
                    gameTimers.delete(roomId);
                    console.log(`[COOK-GAME] 房間 ${roomId} 的遊戲計時器已清除（無玩家）`);
                }
                
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
                };
                broadcastToRoom(roomId, leaveMessage);
                // After broadcasting leave, broadcast the new player list
                broadcastToRoom(roomId, { type: 'player_list', players: gameState.players });
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

                // ★ 修改：檢查並清除斷線計時器
                if (disconnectionTimers.has(userId)) {
                    console.log(`[COOK-GAME] 玩家 ${username} (ID: ${userId}) 在緩衝時間內重新連線，取消離開操作。`);
                    clearTimeout(disconnectionTimers.get(userId));
                    disconnectionTimers.delete(userId);
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
                    let playerJustJoined = false;

                    // 當遊戲已經開始時，允許已在房間列表中的玩家重新加入
                    if (room.status === 'playing' && !gameState.players.some(p => p.id === userId)) {
                         ws.send(JSON.stringify({ type: 'error', message: '遊戲已經開始，無法加入。' }));
                         await client.query('ROLLBACK');
                         return;
                    }

                    if (room.status === 'waiting' && gameState.players.length >= 4 && !gameState.players.some(p => p.id === userId)) {
                        ws.send(JSON.stringify({ type: 'error', message: '房間已滿' }));
                        await client.query('ROLLBACK');
                        return;
                    }

                    if (!gameState.players.some(p => p.id === userId)) {
                        playerJustJoined = true;
                        const newPlayer = {
                            id: userId,
                            username: userProfile.display_name || username,
                            level: userProfile.level || 1,
                            avatar: userProfile.user_profile_image_url || '/images/default-avatar.png',
                            ready: false
                        };
                        gameState.players.push(newPlayer);
                    }
                    
                    // 無論是新加入還是重連，都更新遊戲狀態和連線資訊
                    ws.currentRoomId = roomId;
                    ws.userId = userId;
                    
                    await client.query('UPDATE cook_game_rooms SET game_state = $1, updated_at = NOW() WHERE room_id = $2', [gameState, roomId]);
                    await client.query('COMMIT');

                    console.log(`[COOK-GAME] 玩家 ${username} (ID: ${userId}) 已成功加入/重連至房間 ${roomId}`);
                    
                    // 如果是從遊戲中頁面加入，伺服器應發送完整的遊戲狀態
                    if (room.status === 'playing') {
                        // 這裡應該發送 'game_state' 而非 'room_info'
                        ws.send(JSON.stringify({ type: 'game_state', gameState: gameState }));
                        console.log(`[COOK-GAME] 向重連玩家 ${username} 發送完整遊戲狀態。`);
                    } else {
                        // 否則，正常發送房間資訊
                        const finalRoomDataResult = await pool.query('SELECT * FROM cook_game_rooms WHERE room_id = $1', [roomId]);
                        const finalRoomData = finalRoomDataResult.rows[0];

                        const roomInfoPayload = {
                            id: finalRoomData.room_id,
                            name: finalRoomData.room_name,
                            status: finalRoomData.status,
                            difficulty: finalRoomData.difficulty,
                            creator: finalRoomData.creator_name,
                            creatorId: finalRoomData.creator_id,
                            players: finalRoomData.game_state.players,
                        };
                        ws.send(JSON.stringify({ type: 'room_info', room: roomInfoPayload }));

                        if (playerJustJoined) {
                           broadcastToRoom(roomId, { type: 'player_joined', playerName: userProfile.display_name || username }, ws);
                        }
                        broadcastToRoom(roomId, { type: 'player_list', players: gameState.players });
                    }
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
            case 'player_unready': {
                if (!roomId) {
                    ws.send(JSON.stringify({ type: 'error', message: '未提供房間ID' }));
                    return;
                }
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    const roomResult = await client.query('SELECT * FROM cook_game_rooms WHERE room_id = $1 FOR UPDATE', [roomId]);
                    if (roomResult.rows.length === 0) {
                        ws.send(JSON.stringify({ type: 'error', message: '找不到房間' }));
                        await client.query('ROLLBACK');
                        return;
                    }

                    let room = roomResult.rows[0];
                    let gameState = room.game_state || { players: [] };

                    const player = gameState.players.find(p => p.id === userId);
                    if (!player) {
                        ws.send(JSON.stringify({ type: 'error', message: '找不到玩家資料' }));
                        await client.query('ROLLBACK');
                        return;
                    }

                    player.ready = (type === 'player_ready');
                    
                    await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                    await client.query('COMMIT');
                    
                    broadcastToRoom(roomId, { type: type, playerName: username });
                    broadcastToRoom(roomId, { type: 'player_list', players: gameState.players });
                    console.log(`[COOK-GAME] 玩家 ${username} 在房間 ${roomId} 狀態已更新為 ${type}`);

                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error(`[COOK-GAME] 更新玩家準備狀態錯誤:`, error);
                    ws.send(JSON.stringify({ type: 'error', message: '更新準備狀態時發生後端錯誤' }));
                } finally {
                    client.release();
                }
                break;
            }
            case 'chat_message': {
                if (!roomId || !data.message) {
                    ws.send(JSON.stringify({ type: 'error', message: '無效的聊天訊息' }));
                    return;
                }
                
                try {
                    const roomResult = await pool.query('SELECT game_state FROM cook_game_rooms WHERE room_id = $1', [roomId]);
                    if (roomResult.rows.length === 0) return; // Room doesn't exist, do nothing.

                    const gameState = roomResult.rows[0].game_state;
                    const player = gameState.players.find(p => p.id === userId);
                    const avatar = player ? (player.username ? player.username.charAt(0).toUpperCase() : '?') : '?';

                    broadcastToRoom(roomId, {
                        type: 'chat_message',
                        sender: username,
                        text: data.message,
                        avatar: avatar
                    });
                } catch (error) {
                    console.error(`[COOK-GAME] 處理聊天訊息錯誤:`, error);
                }
                break;
            }
            case 'start_game': {
                 if (!roomId) {
                    ws.send(JSON.stringify({ type: 'error', message: '未提供房間ID' }));
                    return;
                }
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    const roomResult = await client.query('SELECT * FROM cook_game_rooms WHERE room_id = $1 FOR UPDATE', [roomId]);

                    if (roomResult.rows.length === 0) {
                        ws.send(JSON.stringify({ type: 'error', message: '找不到房間' }));
                        await client.query('ROLLBACK');
                        return;
                    }

                    const room = roomResult.rows[0];
                    if (room.creator_id !== userId) {
                         ws.send(JSON.stringify({ type: 'error', message: '只有房主可以開始遊戲' }));
                         await client.query('ROLLBACK');
                         return;
                    }
                    
                    const gameState = room.game_state;
                    const allReady = gameState.players.every(p => p.ready);
                    
                    if (allReady && gameState.players.length >= 1) { 
                        
                        await client.query("UPDATE cook_game_rooms SET status = 'starting' WHERE room_id = $1", [roomId]);
                        await client.query('COMMIT');
                        
                        broadcastToRoom(roomId, { type: 'game_starting', countdown: 3 });
                        
                        setTimeout(async () => {
                            try {
                                // 修改: 產生初始遊戲狀態，包含訂單
                                const initialGameState = {
                                    timeRemaining: 180, // 3 minutes
                                    score: 0,
                                    orders: [generateOrder(), generateOrder()], // 產生2個初始訂單
                                    stations: {}, 
                                    players: gameState.players.map(p => ({ ...p, inventory: Array(8).fill(null), activeSlot: 0 }))
                                };

                                await pool.query("UPDATE cook_game_rooms SET status = 'playing', game_state = $2, updated_at = NOW() WHERE room_id = $1", [roomId, initialGameState]);
                                console.log(`[COOK-GAME] 遊戲 ${roomId} 已正式開始`);
                                broadcastToRoom(roomId, { type: 'game_started', gameState: initialGameState });
                                
                                // ★ 新增：啟動遊戲計時器
                                startGameTimer(roomId, initialGameState.timeRemaining);
                            } catch (startError) {
                                console.error(`[COOK-GAME] 開始遊戲 ${roomId} 失敗:`, startError);
                            }
                        }, 3000);

                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: '所有玩家都必須準備好才能開始遊戲' }));
                        await client.query('ROLLBACK');
                    }
                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error(`[COOK-GAME] 開始遊戲錯誤:`, error);
                    ws.send(JSON.stringify({ type: 'error', message: '開始遊戲時發生後端錯誤' }));
                } finally {
                    client.release();
                }
                break;
            }
            case 'player_action': {
                if (!roomId) {
                    ws.send(JSON.stringify({ type: 'error', message: '未提供房間ID' }));
                    return;
                }

                const { action, data: actionData } = data;
                const client = await pool.connect();
                
                try {
                    await client.query('BEGIN');
                    const roomResult = await client.query('SELECT * FROM cook_game_rooms WHERE room_id = $1 FOR UPDATE', [roomId]);
                    
                    if (roomResult.rows.length === 0) {
                        ws.send(JSON.stringify({ type: 'error', message: '找不到房間' }));
                        await client.query('ROLLBACK');
                        return;
                    }

                    const room = roomResult.rows[0];
                    if (room.status !== 'playing') {
                        ws.send(JSON.stringify({ type: 'error', message: '遊戲尚未開始' }));
                        await client.query('ROLLBACK');
                        return;
                    }

                    let gameState = room.game_state;
                    const playerIndex = gameState.players.findIndex(p => p.id === userId);
                    
                    if (playerIndex === -1) {
                        ws.send(JSON.stringify({ type: 'error', message: '找不到玩家資料' }));
                        await client.query('ROLLBACK');
                        return;
                    }

                    const player = gameState.players[playerIndex];

                    // 處理不同類型的玩家動作
                    switch (action) {
                        case 'pick_ingredient': {
                            const { ingredientType, slotIndex } = actionData;
                            if (slotIndex < 0 || slotIndex >= player.inventory.length) {
                                ws.send(JSON.stringify({ type: 'error', message: '無效的庫存槽位' }));
                                break;
                            }

                            if (player.inventory[slotIndex] !== null) {
                                ws.send(JSON.stringify({ type: 'error', message: '庫存槽已有物品' }));
                                break;
                            }

                            // 創建食材物品
                            const newItem = {
                                id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                                type: ingredientType,
                                state: 'raw'
                            };

                            // 更新玩家庫存
                            player.inventory[slotIndex] = newItem;
                            gameState.players[playerIndex] = player;

                            // 保存遊戲狀態
                            await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                            await client.query('COMMIT');

                            // 通知玩家拿取食材成功
                            ws.send(JSON.stringify({
                                type: 'ingredient_picked',
                                ingredientType,
                                slotIndex,
                                itemId: newItem.id
                            }));

                            // 廣播給其他玩家
                            broadcastToRoom(roomId, {
                                type: 'player_action',
                                playerId: userId,
                                playerName: username,
                                action: 'pick_ingredient',
                                data: { ingredientType, slotIndex }
                            }, ws);
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 拿取了 ${ingredientType}`);
                            break;
                        }
                        case 'cook_item': {
                            const { slotIndex, cookingMethod } = actionData;
                            if (slotIndex < 0 || slotIndex >= player.inventory.length) {
                                ws.send(JSON.stringify({ type: 'error', message: '無效的庫存槽位' }));
                                break;
                            }

                            const item = player.inventory[slotIndex];
                            if (!item) {
                                ws.send(JSON.stringify({ type: 'error', message: '庫存槽為空' }));
                                break;
                            }

                            // 檢查食材是否可烹飪
                            if (!isCookable(item.type)) {
                                ws.send(JSON.stringify({ type: 'error', message: '此食材不可烹飪' }));
                                break;
                            }

                            // 開始烹飪過程
                            // 在實際應用中，可能需要一個定時器來模擬烹飪時間
                            // 這裡為了簡化，我們直接完成烹飪
                            const resultType = getCookedType(item.type);
                            
                            // 更新物品狀態
                            player.inventory[slotIndex] = {
                                ...item,
                                type: resultType,
                                state: 'cooked'
                            };
                            
                            gameState.players[playerIndex] = player;

                            // 保存遊戲狀態
                            await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                            await client.query('COMMIT');

                            // 通知玩家烹飪成功
                            ws.send(JSON.stringify({
                                type: 'item_cooked',
                                slotIndex,
                                resultType
                            }));

                            // 廣播給其他玩家
                            broadcastToRoom(roomId, {
                                type: 'player_action',
                                playerId: userId,
                                playerName: username,
                                action: 'cook_item',
                                data: { slotIndex, resultType }
                            }, ws);
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 烹飪了 ${item.type} 變成 ${resultType}`);
                            break;
                        }
                        case 'assemble_items': {
                            // 檢查庫存中是否有足夠的食材進行組裝
                            const inventory = player.inventory;
                            const recipeResult = canAssembleRecipe(inventory);
                            
                            if (!recipeResult.canAssemble) {
                                ws.send(JSON.stringify({ type: 'error', message: '缺少必要的食材' }));
                                break;
                            }

                            // 從庫存中移除用於組裝的食材
                            recipeResult.usedSlots.forEach(slotIndex => {
                                inventory[slotIndex] = null;
                            });

                            // 在第一個空槽位放入組裝好的料理
                            const emptySlot = inventory.findIndex(item => item === null);
                            if (emptySlot === -1) {
                                ws.send(JSON.stringify({ type: 'error', message: '沒有空的庫存槽來放置組裝好的料理' }));
                                break;
                            }

                            inventory[emptySlot] = {
                                id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                                type: recipeResult.resultType,
                                state: 'assembled'
                            };

                            player.inventory = inventory;
                            gameState.players[playerIndex] = player;

                            // 保存遊戲狀態
                            await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                            await client.query('COMMIT');

                            // 通知玩家組裝成功
                            ws.send(JSON.stringify({
                                type: 'items_assembled',
                                newInventory: inventory,
                                resultType: recipeResult.resultType
                            }));

                            // 廣播給其他玩家
                            broadcastToRoom(roomId, {
                                type: 'player_action',
                                playerId: userId,
                                playerName: username,
                                action: 'assemble_items',
                                data: { resultType: recipeResult.resultType }
                            }, ws);
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 組裝了 ${recipeResult.resultType}`);
                            break;
                        }
                        case 'serve_dish': {
                            const { slotIndex, dishType } = actionData;
                            if (slotIndex < 0 || slotIndex >= player.inventory.length) {
                                ws.send(JSON.stringify({ type: 'error', message: '無效的庫存槽位' }));
                                break;
                            }

                            const dish = player.inventory[slotIndex];
                            if (!dish || !isCompleteDish(dish.type)) {
                                ws.send(JSON.stringify({ type: 'error', message: '此物品不是完整的料理' }));
                                break;
                            }

                            // 檢查是否有匹配的訂單
                            const orderIndex = gameState.orders.findIndex(order => order.recipe === dish.type);
                            if (orderIndex === -1) {
                                ws.send(JSON.stringify({ type: 'error', message: '沒有匹配的訂單' }));
                                break;
                            }

                            // 移除訂單和料理
                            const order = gameState.orders.splice(orderIndex, 1)[0];
                            player.inventory[slotIndex] = null;
                            
                            // 計算得分
                            const points = calculateOrderPoints(order);
                            gameState.score += points;
                            
                            gameState.players[playerIndex] = player;

                            // 保存遊戲狀態
                            await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                            await client.query('COMMIT');

                            // 通知玩家上菜成功
                            ws.send(JSON.stringify({
                                type: 'dish_served',
                                success: true,
                                slotIndex,
                                orderId: order.id,
                                points,
                                newScore: gameState.score
                            }));

                            // 廣播給所有玩家
                            broadcastToRoom(roomId, {
                                type: 'order_completed',
                                orderId: order.id,
                                points,
                                newScore: gameState.score,
                                playerName: username
                            });
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 完成了訂單 ${order.id}，獲得 ${points} 分`);
                            
                            // 如果訂單數量不足，生成新訂單
                            if (gameState.orders.length < 3) {
                                setTimeout(async () => {
                                    try {
                                        const newOrder = generateOrder();
                                        
                                        // 更新遊戲狀態
                                        const updateResult = await pool.query('SELECT game_state FROM cook_game_rooms WHERE room_id = $1', [roomId]);
                                        if (updateResult.rows.length > 0) {
                                            let updatedGameState = updateResult.rows[0].game_state;
                                            updatedGameState.orders.push(newOrder);
                                            
                                            await pool.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [updatedGameState, roomId]);
                                            
                                            // 廣播新訂單
                                            broadcastToRoom(roomId, {
                                                type: 'new_order',
                                                order: newOrder
                                            });
                                            
                                            console.log(`[COOK-GAME] 房間 ${roomId} 生成了新訂單 ${newOrder.id}`);
                                        }
                                    } catch (error) {
                                        console.error(`[COOK-GAME] 生成新訂單錯誤:`, error);
                                    }
                                }, 2000);
                            }
                            break;
                        }
                        case 'select_slot': {
                            const { slotIndex } = actionData;
                            if (slotIndex < 0 || slotIndex >= player.inventory.length) {
                                ws.send(JSON.stringify({ type: 'error', message: '無效的庫存槽位' }));
                                break;
                            }

                            // 更新玩家當前選中的槽位
                            player.activeSlot = slotIndex;
                            gameState.players[playerIndex] = player;

                            // 保存遊戲狀態
                            await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                            await client.query('COMMIT');

                            // 通知玩家選擇槽位成功
                            ws.send(JSON.stringify({
                                type: 'slot_selected',
                                slotIndex
                            }));
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 選擇了庫存槽 ${slotIndex}`);
                            break;
                        }
                        case 'transfer_item': {
                            const { fromSlot, toPlayerId } = actionData;
                            if (fromSlot < 0 || fromSlot >= player.inventory.length) {
                                ws.send(JSON.stringify({ type: 'error', message: '無效的庫存槽位' }));
                                break;
                            }

                            const item = player.inventory[fromSlot];
                            if (!item) {
                                ws.send(JSON.stringify({ type: 'error', message: '庫存槽為空' }));
                                break;
                            }

                            // 找到目標玩家
                            const toPlayerIndex = gameState.players.findIndex(p => p.id === toPlayerId);
                            if (toPlayerIndex === -1) {
                                ws.send(JSON.stringify({ type: 'error', message: '找不到目標玩家' }));
                                break;
                            }

                            const toPlayer = gameState.players[toPlayerIndex];
                            
                            // 找到目標玩家的空槽位
                            const toSlot = toPlayer.inventory.findIndex(item => item === null);
                            if (toSlot === -1) {
                                ws.send(JSON.stringify({ type: 'error', message: '目標玩家沒有空的庫存槽' }));
                                break;
                            }

                            // 轉移物品
                            toPlayer.inventory[toSlot] = item;
                            player.inventory[fromSlot] = null;
                            
                            gameState.players[playerIndex] = player;
                            gameState.players[toPlayerIndex] = toPlayer;

                            // 保存遊戲狀態
                            await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                            await client.query('COMMIT');

                            // 通知雙方玩家
                            ws.send(JSON.stringify({
                                type: 'item_transferred',
                                success: true,
                                fromSlot,
                                toPlayerId,
                                toPlayerName: toPlayer.username
                            }));

                            const toPlayerWs = activeConnections.get(toPlayerId);
                            if (toPlayerWs && toPlayerWs.readyState === WebSocket.OPEN) {
                                toPlayerWs.send(JSON.stringify({
                                    type: 'item_transferred',
                                    success: true,
                                    fromPlayerId: userId,
                                    fromPlayerName: username,
                                    toSlot,
                                    itemType: item.type,
                                    itemId: item.id
                                }));
                            }
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 將物品 ${item.type} 傳給了玩家 ${toPlayer.username}`);
                            break;
                        }
                        default:
                            ws.send(JSON.stringify({ type: 'error', message: '未知的玩家動作' }));
                            await client.query('ROLLBACK');
                            return;
                    }

                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error(`[COOK-GAME] 處理玩家動作錯誤:`, error);
                    ws.send(JSON.stringify({ type: 'error', message: '處理玩家動作時發生後端錯誤' }));
                } finally {
                    client.release();
                }
                break;
            }
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

    // API: 獲取當前登入用戶的遊戲資料
    cookGameApp.get('/users/profile', authenticateToken, async (req, res) => {
        try {
            // 從主表獲取用戶基本資料
            const userQuery = `
                SELECT u.user_id, u.username, u.display_name, u.email, u.user_profile_image_url, 
                       u.created_at, u.default_role_id
                FROM box_users u
                WHERE u.user_id = $1
            `;
            
            const userResult = await pool.query(userQuery, [req.user.userId]);
            
            if (userResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: '找不到用戶資料' });
            }
            
            const userData = userResult.rows[0];
            
            // 從遊戲玩家表獲取遊戲相關資料
            const playerQuery = `
                SELECT
                    player_id,
                    level,
                    points,
                    achievements,
                    last_login
                FROM cook_players
                WHERE user_id = $1
            `;
            
            const playerResult = await pool.query(playerQuery, [req.user.userId]);
            
            // 合併用戶資料與遊戲資料
            let user = { ...userData };
            
            if (playerResult.rows.length > 0) {
                const playerData = playerResult.rows[0];
                // 使用您資料庫中實際的欄位名稱
                user.player_level = playerData.level;
                user.player_points = playerData.points;
                user.achievements = playerData.achievements;
                user.player_last_login = playerData.last_login;
            } else {
                // 如果用戶沒有遊戲資料，提供默認值
                user.player_level = 1;
                user.player_points = 0;
                user.achievements = [];
            }
            
            res.json({ success: true, user });
            
        } catch (error) {
            console.error('獲取用戶資料時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤' });
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

    function initCookGameWss(wss) { // 參數是 wss
 
        wss.on('connection', (ws, req) => { // <-- 從 wssCookGame.on 改為 wss.on
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
                        const decoded = await jwt.verify(data.token, JWT_SECRET);
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
                console.log(`[COOK-GAME WS] 連接關閉，使用者 ID: ${ws.userId}`);
                // ★ 修改：不要立即移除玩家，而是啟動一個計時器
                if (ws.userId && ws.currentRoomId) {
                    // 如果此玩家已有計時器，先清除
                    if (disconnectionTimers.has(ws.userId)) {
                        clearTimeout(disconnectionTimers.get(ws.userId));
                    }

                    console.log(`[COOK-GAME] 玩家 ${ws.userProfile ? ws.userProfile.username : ws.userId} 斷線，啟動 10 秒緩衝計時器。`);
                    
                    const timerId = setTimeout(() => {
                        console.log(`[COOK-GAME] 玩家 ${ws.userProfile ? ws.userProfile.username : ws.userId} 斷線緩衝時間到，執行離開房間操作。`);
                        handlePlayerLeave(ws.currentRoomId, ws.userId);
                        disconnectionTimers.delete(ws.userId);
                    }, 10000); // 10 秒緩衝時間

                    disconnectionTimers.set(ws.userId, timerId);
                }
                
                if (ws.userId) {
                    activeConnections.delete(ws.userId);
                }
            });

            ws.on('error', (error) => {
                console.error('[COOK-GAME WS] 連接發生錯誤:', error);
            });
        });
      
        const interval = setInterval(() => {
            wss.clients.forEach(ws => { // <-- 從 wssCookGame.clients 改為 wss.clients
                if (ws.isAlive === false) {
                    console.log('[COOK-GAME WS] 心跳超時，終止連接');
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        wss.on('close', () => { // <-- 從 wssCookGame.on 改為 wss.on
            clearInterval(interval);
        });

     }

    return {
        cookGameApp,
        initCookGameWss
    };
};

// 輔助函數：判斷食材是否可烹飪
function isCookable(itemType) {
    return ['beef', 'bread', 'onion', 'tomato'].includes(itemType);
}

// 輔助函數：獲取烹飪後的食材類型
function getCookedType(itemType) {
    switch (itemType) {
        case 'beef': return 'beef_cooked';
        case 'bread': return 'bread_toasted';
        case 'onion': return 'onion_grilled';
        case 'tomato': return 'tomato_grilled';
        default: return itemType;
    }
}

// 輔助函數：判斷是否為完整料理
function isCompleteDish(itemType) {
    return ['burger_basic', 'burger_cheese', 'burger_deluxe'].includes(itemType);
}

// 輔助函數：檢查是否可以組裝食譜
function canAssembleRecipe(inventory) {
    // 檢查是否有足夠的材料做基本漢堡
    const hasBread = inventory.some(item => item && (item.type === 'bread' || item.type === 'bread_toasted'));
    const hasCookedBeef = inventory.some(item => item && item.type === 'beef_cooked');
    
    if (hasBread && hasCookedBeef) {
        // 檢查是否有足夠的材料做起司漢堡
        const hasCheese = inventory.some(item => item && item.type === 'cheese');
        
        if (hasCheese) {
            // 檢查是否有足夠的材料做豪華漢堡
            const hasLettuce = inventory.some(item => item && item.type === 'lettuce');
            const hasTomato = inventory.some(item => item && (item.type === 'tomato' || item.type === 'tomato_grilled'));
            const hasOnion = inventory.some(item => item && (item.type === 'onion' || item.type === 'onion_grilled'));
            
            if (hasLettuce && hasTomato && hasOnion) {
                // 可以做豪華漢堡
                const usedSlots = [];
                inventory.forEach((item, index) => {
                    if (item && (
                        (item.type === 'bread' || item.type === 'bread_toasted') ||
                        item.type === 'beef_cooked' ||
                        item.type === 'cheese' ||
                        item.type === 'lettuce' ||
                        (item.type === 'tomato' || item.type === 'tomato_grilled') ||
                        (item.type === 'onion' || item.type === 'onion_grilled')
                    )) {
                        usedSlots.push(index);
                    }
                });
                
                return {
                    canAssemble: true,
                    resultType: 'burger_deluxe',
                    usedSlots: usedSlots.slice(0, 6) // 最多使用6個食材
                };
            }
            
            // 可以做起司漢堡
            const usedSlots = [];
            inventory.forEach((item, index) => {
                if (item && (
                    (item.type === 'bread' || item.type === 'bread_toasted') ||
                    item.type === 'beef_cooked' ||
                    item.type === 'cheese'
                )) {
                    usedSlots.push(index);
                }
            });
            
            return {
                canAssemble: true,
                resultType: 'burger_cheese',
                usedSlots: usedSlots.slice(0, 3) // 最多使用3個食材
            };
        }
        
        // 可以做基本漢堡
        const usedSlots = [];
        inventory.forEach((item, index) => {
            if (item && (
                (item.type === 'bread' || item.type === 'bread_toasted') ||
                item.type === 'beef_cooked'
            )) {
                usedSlots.push(index);
            }
        });
        
        return {
            canAssemble: true,
            resultType: 'burger_basic',
            usedSlots: usedSlots.slice(0, 2) // 最多使用2個食材
        };
    }
    
    return { canAssemble: false };
}

// 輔助函數：計算訂單得分
function calculateOrderPoints(order) {
    // 基礎分數
    let points = 50;
    
    // 根據剩餘時間獎勵額外分數
    const timePercent = order.timeRemaining / order.totalTime;
    if (timePercent > 0.7) {
        points += 30; // 很快完成
    } else if (timePercent > 0.4) {
        points += 15; // 一般速度
    }
    
    // 根據料理類型獎勵額外分數
    switch (order.recipe) {
        case 'burger_deluxe':
            points += 30;
            break;
        case 'burger_cheese':
            points += 15;
            break;
        case 'burger_basic':
            points += 5;
            break;
    }
    
    return points;
}

// 輔助函數：生成新訂單
function generateOrder() {
    const recipes = ['burger_basic', 'burger_cheese', 'burger_deluxe'];
    const recipeWeights = [0.5, 0.3, 0.2]; // 基本漢堡出現機率最高，豪華漢堡最低
    
    // 根據權重隨機選擇食譜
    let random = Math.random();
    let recipeIndex = 0;
    let cumulativeWeight = 0;
    
    for (let i = 0; i < recipeWeights.length; i++) {
        cumulativeWeight += recipeWeights[i];
        if (random < cumulativeWeight) {
            recipeIndex = i;
            break;
        }
    }
    
    const recipe = recipes[recipeIndex];
    
    // 根據食譜類型設置不同的時間限制
    let totalTime;
    switch (recipe) {
        case 'burger_deluxe':
            totalTime = 180; // 3分鐘
            break;
        case 'burger_cheese':
            totalTime = 120; // 2分鐘
            break;
        case 'burger_basic':
            totalTime = 90; // 1.5分鐘
            break;
        default:
            totalTime = 120;
    }
    
    return {
        id: `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        recipe,
        totalTime,
        timeRemaining: totalTime,
        createdAt: Date.now()
    };
}

// ★ 新增：遊戲計時器管理函數
async function startGameTimer(roomId, initialTime) {
    // 如果已有計時器，先清除
    if (gameTimers.has(roomId)) {
        clearInterval(gameTimers.get(roomId));
    }

    let timeRemaining = initialTime;
    let lastDbUpdate = Date.now();

    const timerId = setInterval(async () => {
        try {
            // 減少剩餘時間
            timeRemaining--;
            
            // 檢查遊戲是否應該結束
            if (timeRemaining <= 0) {
                clearInterval(timerId);
                gameTimers.delete(roomId);
                await endGame(roomId);
                return;
            }
            
            // 每秒廣播時間更新
            broadcastToRoom(roomId, { 
                type: 'game_tick', 
                timeRemaining: timeRemaining 
            });
            
            // 每5秒或時間結束時更新資料庫
            const now = Date.now();
            if (now - lastDbUpdate >= 5000 || timeRemaining <= 0) {
                const roomResult = await pool.query('SELECT game_state FROM cook_game_rooms WHERE room_id = $1', [roomId]);
                if (roomResult.rows.length === 0) {
                    // 房間已不存在，停止計時器
                    clearInterval(timerId);
                    gameTimers.delete(roomId);
                    return;
                }
                
                const gameState = roomResult.rows[0].game_state;
                gameState.timeRemaining = timeRemaining;
                
                await pool.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                lastDbUpdate = now;
            }
        } catch (error) {
            console.error(`[COOK-GAME] 遊戲計時器錯誤 (房間 ${roomId}):`, error);
        }
    }, 1000);
    
    gameTimers.set(roomId, timerId);
    console.log(`[COOK-GAME] 房間 ${roomId} 的遊戲計時器已啟動，初始時間: ${initialTime}秒`);
}

// ★ 新增：遊戲結束處理函數
async function endGame(roomId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 獲取房間資訊
        const roomResult = await client.query('SELECT * FROM cook_game_rooms WHERE room_id = $1 FOR UPDATE', [roomId]);
        if (roomResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return;
        }
        
        const room = roomResult.rows[0];
        const gameState = room.game_state;
        
        // 更新房間狀態為已完成
        await client.query("UPDATE cook_game_rooms SET status = 'finished' WHERE room_id = $1", [roomId]);
        
        // 計算最終統計數據
        const finalStats = {
            totalScore: gameState.score || 0,
            completedOrders: gameState.completedOrders || 0,
            playerScores: {}
        };
        
        // 如果有玩家貢獻分數的記錄，計算每個玩家的分數
        if (gameState.players) {
            gameState.players.forEach(player => {
                finalStats.playerScores[player.id] = player.score || Math.floor(finalStats.totalScore / gameState.players.length);
            });
        }
        
        // 廣播遊戲結束消息
        broadcastToRoom(roomId, {
            type: 'game_over',
            finalScore: finalStats.totalScore,
            completedOrders: finalStats.completedOrders,
            playerScores: finalStats.playerScores,
            message: '遊戲時間結束！'
        });
        
        console.log(`[COOK-GAME] 房間 ${roomId} 的遊戲已結束，最終分數: ${finalStats.totalScore}`);
        
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[COOK-GAME] 結束遊戲錯誤 (房間 ${roomId}):`, error);
    } finally {
        client.release();
    }
}