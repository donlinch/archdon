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

// ★ 新增：遊戲全域設定
const GAME_SETTINGS = {
    COOK_TIME_DEFAULT: 10000, // 預設烹飪時間 (ms)
    ORDER_GENERATION_INTERVAL: 15000, // 訂單生成間隔 (ms)
    MAX_ORDERS: 5, // 最大訂單數量
};

module.exports = function(pool) { // <-- 接收傳入的 pool
    const cookGameApp = express();

    // =================================================================
    // ★ 新增：資料庫查詢輔助函數 (V2 遊戲邏輯)
    // =================================================================

    /**
     * 根據物品的字串ID從 cook_items 表中獲取詳細資料
     * @param {string} itemId - 物品的唯一字串 ID (e.g., 'beef_patty')
     * @returns {Promise<object|null>} 物品的資料物件或 null
     */
    async function getItemData(itemId) {
        const result = await pool.query('SELECT * FROM cook_items WHERE item_id = $1', [itemId]);
        return result.rows[0] || null;
    }

    /**
     * 根據生的食材和使用的烹飪站，查找對應的烹飪食譜
     * @param {string} rawItemId - 原料物品的字串 ID (e.g., 'beef_patty')
     * @param {string} stationType - 工作站類型 (e.g., 'grill')
     * @returns {Promise<object|null>} 完整的食譜物件或 null
     */
    async function findCookingRecipe(rawItemId, stationType) {
        const query = `
            SELECT r.*, i_out.item_id as output_item_id_str
            FROM cook_recipes_v2 r
            JOIN cook_recipe_requirements_v2 req ON r.id = req.recipe_id
            JOIN cook_items i_in ON req.required_item_id = i_in.id
            JOIN cook_items i_out ON r.output_item_id = i_out.id
            WHERE r.station_type = $1
              AND i_in.item_id = $2
              AND req.quantity = 1
        `;
        const result = await pool.query(query, [stationType, rawItemId]);
        // 假設一個原料只會對應一個烹飪食譜
        return result.rows[0] || null;
    }

    /**
     * 根據一組原料，查找對應的組合食譜
     * @param {string[]} ingredientItemTypes - 參與組合的物品類型ID陣列
     * @returns {Promise<object|null>} 匹配的食譜或 null
     */
    async function findAssemblyRecipe(ingredientItemTypes) {
        // 1. 計算每種原料的數量
        const providedCounts = ingredientItemTypes.reduce((acc, type) => {
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        const providedTypes = Object.keys(providedCounts);

        // 2. 查找所有組合食譜
        const recipesResult = await pool.query(`
            SELECT r.id, r.recipe_id, i_out.item_id as output_item_id_str, r.description 
            FROM cook_recipes_v2 r
            JOIN cook_items i_out ON r.output_item_id = i_out.id
            WHERE r.station_type = 'assembly'
        `);
        const allAssemblyRecipes = recipesResult.rows;

        // 3. 遍歷每個食譜，檢查其需求是否與提供的原料完全匹配
        for (const recipe of allAssemblyRecipes) {
            const requirementsResult = await pool.query(`
                SELECT i.item_id, req.quantity 
                FROM cook_recipe_requirements_v2 req
                JOIN cook_items i ON req.required_item_id = i.id
                WHERE req.recipe_id = $1
            `, [recipe.id]);
            
            const requiredItems = requirementsResult.rows;
            
            // 如果原料種類數量不匹配，則跳過
            if (requiredItems.length !== providedTypes.length) {
                continue;
            }

            const requiredCounts = requiredItems.reduce((acc, item) => {
                acc[item.item_id] = item.quantity;
                return acc;
            }, {});

            // 比較提供的原料和需求的原料
            const isMatch = providedTypes.every(type => providedCounts[type] === requiredCounts[type]);

            if (isMatch) {
                return recipe; // 找到匹配的食譜
            }
        }

        return null; // 沒有找到匹配的食譜
    }

    /**
     * ★ V2新增：根據食譜的字串ID獲取其組裝需求
     * @param {string} recipeId - 食譜的唯一字串 ID (e.g., 'burger_basic')
     * @returns {Promise<Array<object>>} 需求列表 e.g. [{item_id: 'bread', quantity: 2}, ...]
     */
    async function getRecipeRequirements(recipeId) {
        const query = `
            SELECT i.item_id, req.quantity
            FROM cook_recipe_requirements_v2 req
            JOIN cook_items i ON req.required_item_id = i.id
            JOIN cook_recipes_v2 r ON req.recipe_id = r.id
            WHERE r.recipe_id = $1 AND r.station_type = 'assembly'
        `;
        const result = await pool.query(query, [recipeId]);
        return result.rows;
    }

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

    // ★ 新增：遊戲計時器管理函數
    async function startGameTimer(roomId, initialTime) {
        // 如果已有計時器，先清除
        if (gameTimers.has(roomId)) {
            clearInterval(gameTimers.get(roomId));
        }

        let timeRemaining = initialTime;
        let lastDbUpdate = Date.now();
        let orderGenerationTicker = 0;

        const gameLoop = async () => {
            try {
                // 減少剩餘時間
                timeRemaining--;
                
                // ★ 新增：更新烹飪進度
                await updateCookingProgress(roomId);
                
                // ★ 新增：定期生成新訂單
                orderGenerationTicker += 1000;
                if (orderGenerationTicker >= GAME_SETTINGS.ORDER_GENERATION_INTERVAL) {
                    await generateOrder(roomId);
                    orderGenerationTicker = 0;
                }
                
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
        };
        
        const timerId = setInterval(gameLoop, 1000);
        
        gameTimers.set(roomId, timerId);
        console.log(`[COOK-GAME] 房間 ${roomId} 的遊戲計時器已啟動，初始時間: ${initialTime}秒`);
    }

    // ★ 新增：處理烹飪進度的函數
    async function updateCookingProgress(roomId) {
        const roomStateQuery = await pool.query('SELECT game_state FROM cook_game_rooms WHERE room_id = $1', [roomId]);
        if (roomStateQuery.rows.length === 0) return;
        
        const gameState = roomStateQuery.rows[0].game_state;
        if (!gameState || !gameState.players) return;

        let stateChanged = false;
        const now = Date.now();

        for (const player of gameState.players) {
            if (!player.inventory) continue;

            for (let i = 0; i < player.inventory.length; i++) {
                const item = player.inventory[i];
                if (item && item.isCooking && !item.isCooked) {
                    const elapsedTime = now - item.cookingStartTime;
                    
                    // 廣播進度
                    broadcastToRoom(roomId, {
                        type: 'cooking_progress',
                        playerId: player.id,
                        slotIndex: i,
                        progress: Math.min(100, (elapsedTime / item.cookTime) * 100)
                    });

                    if (elapsedTime >= item.cookTime) {
                        item.isCooking = false;
                        item.isCooked = true;
                        item.type = item.resultType; // 將物品類型變為烹飪結果
                        
                        stateChanged = true;

                        // 廣播烹飪完成
                        broadcastToRoom(roomId, {
                            type: 'item_cooked',
                            playerId: player.id,
                            slotIndex: i,
                            resultType: item.type,
                            message: `${getItemName(item.type)} 烹飪完成！`
                        });
                    }
                }
            }
        }

        if (stateChanged) {
            await pool.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
        }
    }

    // ★ 新增：遊戲結束處理函數
    async function endGame(roomId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const roomResult = await client.query('SELECT * FROM cook_game_rooms WHERE room_id = $1 FOR UPDATE', [roomId]);
            if (roomResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return;
            }
            
            const room = roomResult.rows[0];
            const gameState = room.game_state;

            if (room.status === 'finished') {
                console.log(`[COOK-GAME] 房間 ${roomId} 遊戲已結束，跳過 endGame 邏輯。`);
                await client.query('ROLLBACK');
                return;
            }
            
            await client.query("UPDATE cook_game_rooms SET status = 'finished' WHERE room_id = $1", [roomId]);
            
            // ★ 新增：更新玩家統計數據與任務進度
            await updatePlayerStatsAndQuests(roomId, gameState);

            const finalStats = {
                totalScore: gameState.score || 0,
                completedOrders: gameState.completedOrders || 0,
                playerScores: {},
                rewards: {} // ★ 新增：用於存放獎勵資訊
            };
            
            if (gameState.players) {
                gameState.players.forEach(player => {
                    finalStats.playerScores[player.id] = player.score || 0;
                    // ★ 新增：將獎勵資訊加入 finalStats
                    finalStats.rewards[player.id] = {
                        pointsEarned: player.pointsEarned || 0,
                        questReward: player.questReward || 0,
                    };
                });
            }
            
            // ★ 修改：廣播包含獎勵資訊的遊戲結束消息
            broadcastToRoom(roomId, {
                type: 'game_over',
                finalScore: finalStats.totalScore,
                completedOrders: finalStats.completedOrders,
                playerScores: finalStats.playerScores,
                rewards: finalStats.rewards, // ★ 新增
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

    // ★ 新增：更新玩家統計數據與任務進度的函數
    async function updatePlayerStatsAndQuests(roomId, gameState) {
        try {
            // 確保有玩家和分數
            if (!gameState.players || !gameState.score) {
                console.log(`[COOK-GAME] 房間 ${roomId} 沒有玩家或分數資料，跳過更新。`);
                return;
            }

            // 計算每個玩家的基礎獎勵
            const basePoints = Math.floor(gameState.score / gameState.players.length);
            const completedOrders = gameState.completedOrders || 0;
            
            // 為每個玩家更新統計數據
            for (const player of gameState.players) {
                const userId = player.id;
                if (!userId) continue;

                // 計算玩家獲得的經驗值和點數
                let pointsEarned = basePoints;
                let questReward = 0;
                let expGained = Math.floor(basePoints / 10) + completedOrders; // 基礎經驗值
                
                // 檢查玩家是否有進行中的任務
                const questResult = await pool.query(
                    'SELECT * FROM cook_player_quests WHERE user_id = $1 AND status = $2',
                    [userId, 'active']
                );
                
                // 處理任務進度
                if (questResult.rows.length > 0) {
                    for (const quest of questResult.rows) {
                        let questUpdated = false;
                        
                        // 根據任務類型更新進度
                        switch (quest.quest_type) {
                            case 'complete_games':
                                await pool.query(
                                    'UPDATE cook_player_quests SET progress = progress + 1 WHERE id = $1',
                                    [quest.id]
                                );
                                questUpdated = true;
                                break;
                                
                            case 'earn_points':
                                await pool.query(
                                    'UPDATE cook_player_quests SET progress = progress + $1 WHERE id = $2',
                                    [basePoints, quest.id]
                                );
                                questUpdated = true;
                                break;
                                
                            case 'complete_orders':
                                await pool.query(
                                    'UPDATE cook_player_quests SET progress = progress + $1 WHERE id = $2',
                                    [completedOrders, quest.id]
                                );
                                questUpdated = true;
                                break;
                        }
                        
                        // 檢查任務是否完成
                        if (questUpdated) {
                            const updatedQuestResult = await pool.query(
                                'SELECT * FROM cook_player_quests WHERE id = $1',
                                [quest.id]
                            );
                            
                            if (updatedQuestResult.rows.length > 0) {
                                const updatedQuest = updatedQuestResult.rows[0];
                                if (updatedQuest.progress >= updatedQuest.target) {
                                    // 任務完成，更新狀態並給予獎勵
                                    await pool.query(
                                        'UPDATE cook_player_quests SET status = $1 WHERE id = $2',
                                        ['completed', quest.id]
                                    );
                                    
                                    // 根據任務難度給予額外獎勵
                                    const questRewardPoints = getQuestReward(updatedQuest.difficulty);
                                    questReward += questRewardPoints;
                                    expGained += Math.floor(questRewardPoints / 5);
                                    
                                    console.log(`[COOK-GAME] 玩家 ${userId} 完成了任務 ${quest.id}，獲得 ${questRewardPoints} 點額外獎勵`);
                                }
                            }
                        }
                    }
                }
                
                // 更新玩家統計數據
                const totalPointsEarned = pointsEarned + questReward;
                
                // 更新玩家資料
                await pool.query(
                    `UPDATE cook_players 
                     SET 
                        points = points + $1, 
                        exp = exp + $2, 
                        games_played = games_played + 1,
                        orders_completed = orders_completed + $3,
                        last_game_at = NOW()
                     WHERE user_id = $4`,
                    [totalPointsEarned, expGained, completedOrders, userId]
                );
                
                // 檢查經驗值是否足夠升級
                await checkAndUpdatePlayerLevel(userId);
                
                // 將獎勵資訊保存到遊戲狀態中，以便傳送給前端
                player.pointsEarned = totalPointsEarned;
                player.questReward = questReward;
                player.expGained = expGained;
                
                console.log(`[COOK-GAME] 玩家 ${userId} 獲得了 ${totalPointsEarned} 點數和 ${expGained} 經驗值`);
            }
            
            // 更新遊戲狀態中的已完成訂單數量
            if (typeof gameState.completedOrders === 'undefined') {
                // 如果沒有記錄完成訂單數，根據分數估算
                gameState.completedOrders = Math.floor(gameState.score / 50); // 假設平均每單50分
            }
            
            console.log(`[COOK-GAME] 房間 ${roomId} 的玩家統計數據已更新`);
        } catch (error) {
            console.error(`[COOK-GAME] 更新玩家統計數據時出錯:`, error);
        }
    }
    
    // ★ 新增：根據任務難度獲取獎勵點數
    function getQuestReward(difficulty) {
        switch (difficulty) {
            case 'easy': return 50;
            case 'medium': return 100;
            case 'hard': return 200;
            case 'epic': return 500;
            default: return 50;
        }
    }
    
    // ★ 新增：檢查並更新玩家等級
    async function checkAndUpdatePlayerLevel(userId) {
        try {
            const playerResult = await pool.query('SELECT exp, level FROM cook_players WHERE user_id = $1', [userId]);
            
            if (playerResult.rows.length === 0) return;
            
            const player = playerResult.rows[0];
            const currentExp = player.exp;
            const currentLevel = player.level;
            
            // 計算升級所需經驗值 (簡單公式：level * 100)
            const expNeededForNextLevel = currentLevel * 100;
            
            if (currentExp >= expNeededForNextLevel) {
                // 玩家可以升級
                const newLevel = currentLevel + 1;
                
                await pool.query(
                    'UPDATE cook_players SET level = $1, exp = $2 WHERE user_id = $3',
                    [newLevel, currentExp - expNeededForNextLevel, userId]
                );
                
                console.log(`[COOK-GAME] 玩家 ${userId} 升級到 ${newLevel} 級！`);
                
                // 如果有連線中的玩家，發送升級通知
                const playerWs = activeConnections.get(userId);
                if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                    playerWs.send(JSON.stringify({
                        type: 'level_up',
                        newLevel: newLevel,
                        message: `恭喜！你升到了 ${newLevel} 級！`
                    }));
                }
            }
        } catch (error) {
            console.error(`[COOK-GAME] 檢查玩家等級時出錯:`, error);
        }
    }

    // WebSocket連接處理函數 (V3 - 增強日誌與流程控制)
    async function handleAuthenticatedMessage(ws, data, userId, username, userProfile) {
        // ★ 新增日誌: 記錄收到的原始訊息
        console.log(`[COOK-WS] 收到來自使用者 ${username} (ID: ${userId}) 的訊息:`, data);
    
        const { type, roomId } = data;
    
        switch (type) {
            case 'join_room': {
                // 驗證 roomId 是否存在
                if (!roomId) {
                    console.error(`[COOK-WS] [ERROR] join_room 請求缺少 roomId。 使用者: ${userId}`);
                    ws.send(JSON.stringify({ type: 'error', message: '未提供房間ID' }));
                    return;
                }
    
                // 檢查並清除斷線計時器
                if (disconnectionTimers.has(userId)) {
                    console.log(`[COOK-WS] 玩家 ${username} (ID: ${userId}) 在緩衝時間內重新連線，清除離開計時器。`);
                    clearTimeout(disconnectionTimers.get(userId));
                    disconnectionTimers.delete(userId);
                }
    
                // 使用資料庫連接池進行交易
                const client = await pool.connect();
                try {
                    console.log(`[COOK-WS] 開始處理玩家 ${userId} 加入房間 ${roomId} 的請求。`);
                    await client.query('BEGIN');
    
                    // 查詢房間並鎖定該行以防止競爭條件
                    const roomResult = await client.query('SELECT * FROM cook_game_rooms WHERE room_id = $1 FOR UPDATE', [roomId]);
                    if (roomResult.rows.length === 0) {
                        console.warn(`[COOK-WS] 玩家 ${userId} 嘗試加入一個不存在的房間 ${roomId}。`);
                        ws.send(JSON.stringify({ type: 'error', message: '找不到對應的遊戲房間，將返回大廳。' }));
                        await client.query('ROLLBACK');
                        return; // 結束執行
                    }
    
                    let room = roomResult.rows[0];
                    let gameState = room.game_state || { players: [], status: 'waiting', score: 0 };
                    let playerJustJoined = false;
    
                    // 檢查是否可以加入房間
                    if (room.status === 'playing' && !gameState.players.some(p => p.id === userId)) {
                        console.log(`[COOK-WS] 玩家 ${userId} 無法加入已在進行中的房間 ${roomId}。`);
                        ws.send(JSON.stringify({ type: 'error', message: '遊戲已經開始，無法加入。' }));
                        await client.query('ROLLBACK');
                        return;
                    }
    
                    if (room.status === 'waiting' && gameState.players.length >= 4 && !gameState.players.some(p => p.id === userId)) {
                        console.log(`[COOK-WS] 玩家 ${userId} 無法加入已滿員的房間 ${roomId}。`);
                        ws.send(JSON.stringify({ type: 'error', message: '房間已滿' }));
                        await client.query('ROLLBACK');
                        return;
                    }
    
                    // 如果玩家不在房間內，則將其加入
                    if (!gameState.players.some(p => p.id === userId)) {
                        playerJustJoined = true;
                        // ★ 邏輯修正：使用 userProfile.player_level
                        const newPlayer = {
                            id: userId,
                            username: userProfile.display_name || username,
                            level: userProfile.player_level || 1, // 使用 /profile API 一致的欄位
                            avatar: userProfile.user_profile_image_url || '/images/default-avatar.png',
                            ready: false
                        };
                        gameState.players.push(newPlayer);
                        console.log(`[COOK-WS] 新玩家 ${newPlayer.username} (等級 ${newPlayer.level}) 已加入 gameState。`);
                    } else {
                        console.log(`[COOK-WS] 玩家 ${username} 重新連接至房間 ${roomId}。`);
                    }
                    
                    // 更新 WebSocket 連接的上下文資訊
                    ws.currentRoomId = roomId;
                    ws.userId = userId;
                    
                    // 將更新後的遊戲狀態寫回資料庫
                    await client.query('UPDATE cook_game_rooms SET game_state = $1, updated_at = NOW() WHERE room_id = $2', [gameState, roomId]);
                    console.log(`[COOK-WS] 已更新資料庫中房間 ${roomId} 的 gameState。`);
                    
                    // 提交資料庫交易
                    await client.query('COMMIT');
                    console.log(`[COOK-WS] 資料庫交易已提交。`);
    
                    // --- 交易結束，開始向客戶端發送訊息 ---
                    
                    // 如果是遊戲中重連，發送完整的遊戲狀態
                    if (room.status === 'playing') {
                        const gameStatePayload = { type: 'game_state', gameState: gameState };
                        console.log(`[COOK-WS] 向重連玩家 ${username} 發送完整遊戲狀態:`, gameStatePayload);
                        ws.send(JSON.stringify(gameStatePayload));
                    } else {
                        // 如果是在大廳等待，發送房間資訊
                        const roomInfoPayload = {
                            type: 'room_info',
                            room: {
                                id: room.room_id,
                                name: room.room_name,
                                status: room.status,
                                difficulty: room.difficulty,
                                creator: room.creator_name,
                                creatorId: room.creator_id,
                                players: gameState.players, // 直接使用更新後的 gameState
                            }
                        };
                        console.log(`[COOK-WS] 向玩家 ${username} 發送房間資訊:`, roomInfoPayload);
                        ws.send(JSON.stringify(roomInfoPayload));
    
                        // 向房間內所有人廣播玩家列表更新
                        const playerListPayload = { type: 'player_list', players: gameState.players };
                        console.log(`[COOK-WS] 向房間 ${roomId} 廣播玩家列表:`, playerListPayload);
                        broadcastToRoom(roomId, playerListPayload);
    
                        // 如果是新玩家加入，額外廣播加入訊息
                        if (playerJustJoined) {
                            const playerJoinedPayload = { type: 'player_joined', playerName: userProfile.display_name || username };
                            console.log(`[COOK-WS] 向房間 ${roomId} 廣播新玩家加入訊息:`, playerJoinedPayload);
                            broadcastToRoom(roomId, playerJoinedPayload, ws); // 排除自己
                        }
                    }
    
                } catch (error) {
                    console.error(`[COOK-WS] [ERROR] 處理 join_room 請求時發生嚴重錯誤 (使用者: ${userId}, 房間: ${roomId}):`, error);
                    // 確保在出錯時回滾交易
                    await client.query('ROLLBACK');
                    ws.send(JSON.stringify({ type: 'error', message: '加入房間時發生後端錯誤' }));
                } finally {
                    // 釋放資料庫連接
                    client.release();
                    console.log(`[COOK-WS] 已釋放資料庫連接。請求處理完畢。`);
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
                                const initialOrder = await generateInitialOrderObject();
                                if (!initialOrder) {
                                    console.error(`[COOK-GAME] 房間 ${roomId} 無法生成初始訂單，遊戲無法開始。`);
                                    broadcastToRoom(roomId, { type: 'error', message: '無法生成初始訂單，請稍後再試。' });
                                    // 將房間狀態重設為 'waiting'
                                    await pool.query("UPDATE cook_game_rooms SET status = 'waiting' WHERE room_id = $1", [roomId]);
                                    return;
                                }

                                const requirements = await getRecipeRequirements(initialOrder.recipe);
                                const assembly_puzzle = {
                                    orderId: initialOrder.id,
                                    recipe: initialOrder.recipe,
                                    status: 'pending',
                                    slots: requirements.flatMap(req => 
                                        Array(req.quantity).fill(null).map(() => ({
                                            required_item_id: req.item_id,
                                            filled_by: null,
                                            item: null
                                        }))
                                    )
                                };

                                // 產生初始遊戲狀態，包含訂單和中央組合盤
                                const initialGameState = {
                                    timeRemaining: 180, // 3 minutes
                                    score: 0,
                                    orders: [initialOrder], 
                                    assembly_puzzle: assembly_puzzle, // ★ V2 設計核心
                                    stations: {}, 
                                    players: gameState.players.map(p => ({ ...p, inventory: Array(8).fill(null), activeSlot: 0, score: 0 }))
                                };

                                await pool.query("UPDATE cook_game_rooms SET status = 'playing', game_state = $2, updated_at = NOW() WHERE room_id = $1", [roomId, initialGameState]);
                                console.log(`[COOK-GAME] 遊戲 ${roomId} 已正式開始，訂單: ${initialOrder.recipe}`);
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
                                playerId: userId,
                                slotIndex: slotIndex,
                                itemId: newItem.id,
                                ingredientType: ingredientType
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

                            // ★ V2 修改：使用 findCookingRecipe 查找食譜
                            const recipe = await findCookingRecipe(item.type, cookingMethod || 'grill');

                            if (!recipe) {
                                ws.send(JSON.stringify({ type: 'error', message: '此物品無法在此烹飪站處理' }));
                                break;
                            }
                            
                            // 更新物品狀態
                            player.inventory[slotIndex] = {
                                ...item,
                                type: recipe.output_item_id_str, // 使用食譜的產出
                                state: 'cooked' // 狀態可根據食譜定義，此處簡化
                            };
                            
                            gameState.players[playerIndex] = player;

                            // 保存遊戲狀態
                            await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                            await client.query('COMMIT');

                            // 通知玩家烹飪成功
                            ws.send(JSON.stringify({
                                type: 'item_cooked',
                                slotIndex,
                                resultType: recipe.output_item_id_str
                            }));

                            // 廣播給其他玩家
                            broadcastToRoom(roomId, {
                                type: 'player_action',
                                playerId: userId,
                                playerName: username,
                                action: 'cook_item',
                                data: { slotIndex, resultType: recipe.output_item_id_str }
                            }, ws);
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 根據食譜 ${recipe.recipe_id} 將 ${item.type} 烹飪成 ${recipe.output_item_id_str}`);
                            break;
                        }
                        case 'place_on_assembly_plate': {
                            const { itemSlotIndex, puzzleSlotIndex } = actionData;
                            if (typeof itemSlotIndex === 'undefined' || typeof puzzleSlotIndex === 'undefined') {
                                ws.send(JSON.stringify({ type: 'error', message: '無效的參數' }));
                                await client.query('ROLLBACK'); return;
                            }

                            const itemInHand = player.inventory[itemSlotIndex];
                            let puzzle = gameState.assembly_puzzle;

                            if (!itemInHand) {
                                ws.send(JSON.stringify({ type: 'error', message: '你的手上沒有物品' }));
                                await client.query('ROLLBACK'); return;
                            }

                            if (!puzzle || puzzle.status !== 'pending' || !puzzle.slots[puzzleSlotIndex]) {
                                ws.send(JSON.stringify({ type: 'error', message: '無效的組合盤或位置' }));
                                await client.query('ROLLBACK'); return;
                            }
                            
                            const targetSlot = puzzle.slots[puzzleSlotIndex];

                            if (targetSlot.filled_by) {
                                ws.send(JSON.stringify({ type: 'error', message: '這個位置已經被放置物品了' }));
                                await client.query('ROLLBACK'); return;
                            }

                            if (targetSlot.required_item_id !== itemInHand.type) {
                                ws.send(JSON.stringify({ type: 'error', message: `物品類型不符！需要 ${getItemName(targetSlot.required_item_id)}` }));
                                await client.query('ROLLBACK'); return;
                            }

                            // 放置物品
                            targetSlot.item = { ...itemInHand };
                            targetSlot.filled_by = userId;
                            player.inventory[itemSlotIndex] = null;
                            gameState.players[playerIndex] = player;
                            gameState.assembly_puzzle = puzzle;

                            const isComplete = puzzle.slots.every(slot => slot.filled_by);
                            if (isComplete) {
                                puzzle.status = 'completed';
                                const order = gameState.orders.find(o => o.id === puzzle.orderId);
                                if (order) {
                                    const itemData = await getItemData(order.recipe);
                                    let points = itemData.base_points || 50;
                                    const timeTaken = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
                                    const timePercent = Math.max(0, (order.totalTime - timeTaken) / order.totalTime);
                                    if (timePercent > 0.7) points += Math.floor(points * 0.5);
                                    else if (timePercent > 0.4) points += Math.floor(points * 0.2);
                                    
                                    gameState.score += points;
                                    gameState.completedOrders = (gameState.completedOrders || 0) + 1;

                                    const contributors = [...new Set(puzzle.slots.map(s => s.filled_by))];
                                    const pointsPerContributor = Math.floor(points / contributors.length) || points;
                                    contributors.forEach(contribId => {
                                        const pIdx = gameState.players.findIndex(p => p.id === contribId);
                                        if (pIdx > -1) {
                                            gameState.players[pIdx].score = (gameState.players[pIdx].score || 0) + pointsPerContributor;
                                        }
                                    });

                                    broadcastToRoom(roomId, { type: 'order_completed', orderId: order.id, points, newScore: gameState.score, playerName: username, completedRecipe: order.recipe });
                                }

                                gameState.orders = gameState.orders.filter(o => o.id !== puzzle.orderId);
                                const newOrder = await generateInitialOrderObject();
                                if (newOrder) {
                                    gameState.orders.push(newOrder);
                                    const newRequirements = await getRecipeRequirements(newOrder.recipe);
                                    gameState.assembly_puzzle = {
                                        orderId: newOrder.id, recipe: newOrder.recipe, status: 'pending',
                                        slots: newRequirements.flatMap(req => Array(req.quantity).fill(null).map(() => ({ required_item_id: req.item_id, filled_by: null, item: null })))
                                    };
                                } else {
                                    gameState.assembly_puzzle = null;
                                }
                            }
                            
                            await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);

                            broadcastToRoom(roomId, { type: 'assembly_puzzle_update', puzzle: gameState.assembly_puzzle, newScore: gameState.score });
                            
                            ws.send(JSON.stringify({ type: 'inventory_update', inventory: player.inventory }));
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 將 ${itemInHand.type} 放置到組合盤的 ${puzzleSlotIndex} 位置`);
                            
                            await client.query('COMMIT');
                            break;
                        }
                        case 'assemble_items': {
                            // ★ V2 修改: 此操作已棄用
                            ws.send(JSON.stringify({ type: 'error', message: '此操作已過時，請將物品直接放置到中央組合盤上。' }));
                            await client.query('ROLLBACK');
                            return;
                        }
                        case 'serve_dish': {
                            const { slotIndex } = actionData;
                            if (slotIndex < 0 || slotIndex >= player.inventory.length) {
                                ws.send(JSON.stringify({ type: 'error', message: '無效的庫存槽位' }));
                                await client.query('ROLLBACK'); return;
                            }

                            const dish = player.inventory[slotIndex];
                             if (!dish) {
                                ws.send(JSON.stringify({ type: 'error', message: '庫存槽為空' }));
                                await client.query('ROLLBACK'); return;
                            }
                            const itemData = await getItemData(dish.type);

                            if (!itemData || !itemData.is_dish) {
                                ws.send(JSON.stringify({ type: 'error', message: '此物品不是完整的料理' }));
                                await client.query('ROLLBACK'); return;
                            }
                            const orderIndex = gameState.orders.findIndex(order => order.recipe === dish.type);
                            if (orderIndex === -1) {
                                ws.send(JSON.stringify({ type: 'error', message: '沒有匹配的訂單' }));
                                await client.query('ROLLBACK'); return;
                            }

                            const order = gameState.orders.splice(orderIndex, 1)[0];
                            player.inventory[slotIndex] = null;
                            
                            let points = itemData.base_points || 20;
                            
                            gameState.score += points;
                            gameState.completedOrders = (gameState.completedOrders || 0) + 1;
                            player.score = (player.score || 0) + points;
                            gameState.players[playerIndex] = player;

                            await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);

                            ws.send(JSON.stringify({ type: 'dish_served', success: true, slotIndex, orderId: order.id, points, newScore: gameState.score }));
                            broadcastToRoom(roomId, { type: 'order_completed', orderId: order.id, points, newScore: gameState.score, playerName: username });
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 完成了訂單 ${order.id}，獲得 ${points} 分`);
                            
                            if (gameState.orders.length < 3) {
                                setTimeout(() => {
                                    generateOrder(roomId);
                                }, 2000);
                            }
                            await client.query('COMMIT');
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
                        case 'start_cooking': {
                            const { slotIndex, cookingMethod } = actionData;
                            const item = player.inventory[slotIndex];

                            if (item && !item.isCooking && !item.isCooked) {
                                // 使用 V2 邏輯查找食譜
                                const recipe = await findCookingRecipe(item.type, cookingMethod);
                                
                                if (recipe) {
                                    item.isCooking = true;
                                    item.cookingStartTime = Date.now();
                                    item.cookTime = recipe.time_required * 1000 || GAME_SETTINGS.COOK_TIME_DEFAULT;
                                    item.resultType = recipe.output_item_id_str; // 儲存烹飪結果的類型
                                    gameState.players[playerIndex] = player;

                                    // 廣播烹飪開始
                                    broadcastToRoom(roomId, {
                                        type: 'cooking_started',
                                        playerId: userId,
                                        slotIndex: slotIndex,
                                        cookTime: item.cookTime
                                    });
                                } else {
                                     ws.send(JSON.stringify({ type: 'error', message: `找不到 ${getItemName(item.type)} 的烹飪方法` }));
                                }
                            }
                            break;
                        }
                        default:
                            ws.send(JSON.stringify({ type: 'error', message: '未知的玩家動作' }));
                    }

                } catch (error) {
                    if (!client.destroyed) { // Check if client connection is still valid before trying to rollback
                        await client.query('ROLLBACK');
                    }
                    console.error(`[COOK-GAME] 處理玩家動作錯誤:`, error);
                    ws.send(JSON.stringify({ type: 'error', message: '處理玩家動作時發生後端錯誤' }));
                } finally {
                     if (!client.destroyed) {
                        client.release();
                    }
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
        // 定期檢查所有 WebSocket 連接的活躍狀態
        const interval = setInterval(function ping() {
            wss.clients.forEach(function each(ws) {
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

    // =================================================================
    // 遊戲邏輯輔助函數 (V1 - 可能已部分棄用或需重構)
    // =================================================================
    
    /**
     * 計算訂單完成時獲得的分數
     * @param {object} order - 訂單物件
     * @returns {number} 分數
     */
    function calculateOrderPoints(order) {
        // 基礎分數 + 時間獎勵
        const basePoints = 50;
        const timeBonus = Math.floor(order.timeRemaining / 10);
        return basePoints + timeBonus;
    }

    /**
     * ★ V2新增：隨機生成一個新的遊戲訂單物件 (不寫入資料庫)
     * @returns {Promise<object|null>} 新的訂單物件或在錯誤時返回 null
     */
    async function generateInitialOrderObject() {
        // 從資料庫隨機選擇一個可以生成的食譜 (組合類，且為最終菜品)
        const possibleRecipesResult = await pool.query(
            "SELECT r.recipe_id FROM cook_recipes_v2 r JOIN cook_items i ON r.output_item_id = i.id WHERE r.station_type = 'assembly' AND i.is_dish = true"
        );
        
        if (possibleRecipesResult.rows.length > 0) {
            const possibleRecipes = possibleRecipesResult.rows.map(r => r.recipe_id);
            const randomRecipeId = possibleRecipes[Math.floor(Math.random() * possibleRecipes.length)];
            
            const newOrder = {
                id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                recipe: randomRecipeId,
                totalTime: 120, // 單位：秒, 未來可以根據食譜難度調整
                createdAt: new Date().toISOString() // 使用 ISO 格式確保時區一致
            };
            return newOrder;
        }
        return null;
    }

    /**
     * 隨機生成一個新的遊戲訂單 (此函數現在主要在遊戲過程中生成額外訂單)
     * @returns {Promise<void>}
     */
    async function generateOrder(roomId) {
        const roomStateQuery = await pool.query('SELECT game_state FROM cook_game_rooms WHERE room_id = $1', [roomId]);
        if (roomStateQuery.rows.length === 0) return;

        const gameState = roomStateQuery.rows[0].game_state;

        if (gameState.orders.length < GAME_SETTINGS.MAX_ORDERS) {
            const newOrder = await generateInitialOrderObject();
            
            if (newOrder) {
                gameState.orders.push(newOrder);
                await pool.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
    
                broadcastToRoom(roomId, {
                    type: 'new_order',
                    order: newOrder
                });
            }
        }
    }

    // ★ 新增：重設玩家烹飪狀態的函數
    async function resetPlayerCooking(userId) {
        const client = await pool.connect();
        try {
            // 找到該玩家所在的 active 房間
            const roomResult = await client.query(
                `SELECT room_id, game_state FROM cook_game_rooms 
                 WHERE status = 'in_progress' AND game_state->'players' @> jsonb_build_array(jsonb_build_object('id', $1))`,
                [userId]
            );

            if (roomResult.rows.length > 0) {
                const room = roomResult.rows[0];
                const gameState = room.game_state;
                const player = gameState.players.find(p => p.id === userId);

                if (player && player.inventory) {
                    let changed = false;
                    player.inventory.forEach(item => {
                        if (item && item.isCooking) {
                            item.isCooking = false;
                            item.cookingStartTime = null;
                            item.cookTime = null;
                            item.resultType = null;
                            changed = true;
                        }
                    });

                    if (changed) {
                        await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, room.room_id]);
                        console.log(`[COOK-GAME] 已重設重新連線的玩家 ${userId} 在房間 ${room.room_id} 的烹飪狀態。`);
                    }
                }
            }
        } catch (error) {
            console.error(`[COOK-GAME] 重設玩家 ${userId} 烹飪狀態時出錯:`, error);
        } finally {
            client.release();
        }
    }

    // 最後，返回 Express app 和 WebSocket 處理函數
    return {
        cookGameApp,
        initCookGameWss
    };
};