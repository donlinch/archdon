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
        console.log(`[findCookingRecipe] 開始查找烹飪食譜，原料: ${rawItemId}, 工作站: ${stationType}`);
        
        if (!rawItemId || !stationType) {
            console.error('[findCookingRecipe] 錯誤: 缺少必要參數');
            return null;
        }
        
        try {
            const query = `
                SELECT r.*, i_out.item_id as output_item_id_str, i_out.item_name as output_item_name
                FROM cook_recipes_v2 r
                JOIN cook_recipe_requirements_v2 req ON r.id = req.recipe_id
                JOIN cook_items i_in ON req.required_item_id = i_in.id
                JOIN cook_items i_out ON r.output_item_id = i_out.id
                WHERE r.station_type = $1
                  AND i_in.item_id = $2
                  AND req.quantity = 1
            `;
            
            console.log(`[findCookingRecipe] 執行查詢，參數: [${stationType}, ${rawItemId}]`);
            const result = await pool.query(query, [stationType, rawItemId]);
            
            if (result.rows.length > 0) {
                console.log(`[findCookingRecipe] 找到匹配的食譜: ${result.rows[0].recipe_id}, 產出: ${result.rows[0].output_item_id_str}`);
                return result.rows[0];
            } else {
                console.log(`[findCookingRecipe] 未找到匹配的食譜，原料: ${rawItemId}, 工作站: ${stationType}`);
                return null;
            }
        } catch (error) {
            console.error(`[findCookingRecipe] 查詢過程中發生錯誤:`, error);
            return null;
        }
    }

    /**
     * 根據一組原料，查找對應的組合食譜
     * @param {string[]} ingredientItemTypes - 參與組合的物品類型ID陣列
     * @returns {Promise<object|null>} 匹配的食譜或 null
     */
    async function findAssemblyRecipe(ingredientItemTypes) {
        console.log(`[findAssemblyRecipe] 開始查找組合食譜，輸入材料: ${JSON.stringify(ingredientItemTypes)}`);
        
        if (!ingredientItemTypes || ingredientItemTypes.length < 2) {
            console.error('[findAssemblyRecipe] 錯誤: 輸入材料不足，至少需要兩種材料');
            return null;
        }
        
        try {
            // 1. 計算每種原料的數量
            const providedCounts = ingredientItemTypes.reduce((acc, type) => {
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {});
            const providedTypes = Object.keys(providedCounts);
            
            console.log(`[findAssemblyRecipe] 提供的材料類型: ${providedTypes.join(', ')}`);
            console.log(`[findAssemblyRecipe] 提供的材料數量: ${JSON.stringify(providedCounts)}`);

            // 2. 查找所有組合食譜
            const recipesResult = await pool.query(`
                SELECT r.id, r.recipe_id, r.recipe_name, r.difficulty, r.is_orderable, 
                       i_out.item_id as output_item_id_str, i_out.item_name as output_item_name,
                       r.description 
                FROM cook_recipes_v2 r
                JOIN cook_items i_out ON r.output_item_id = i_out.id
                WHERE r.station_type = 'assembly'
            `);
            const allAssemblyRecipes = recipesResult.rows;
            
            console.log(`[findAssemblyRecipe] 找到 ${allAssemblyRecipes.length} 個組合食譜`);

            // 3. 遍歷每個食譜，檢查其需求是否與提供的原料完全匹配
            for (const recipe of allAssemblyRecipes) {
                console.log(`[findAssemblyRecipe] 檢查食譜: ${recipe.recipe_id} (${recipe.recipe_name || '未命名'}), 可訂單: ${recipe.is_orderable ? '是' : '否'}, 難度: ${recipe.difficulty || 1}`);
                
                const requirementsResult = await pool.query(`
                    SELECT i.item_id, i.item_name, req.quantity 
                    FROM cook_recipe_requirements_v2 req
                    JOIN cook_items i ON req.required_item_id = i.id
                    WHERE req.recipe_id = $1
                `, [recipe.id]);
                
                const requiredItems = requirementsResult.rows;
                console.log(`[findAssemblyRecipe] 食譜 ${recipe.recipe_id} 需要 ${requiredItems.length} 種材料`);
                
                // 如果原料種類數量不匹配，則跳過
                if (requiredItems.length !== providedTypes.length) {
                    console.log(`[findAssemblyRecipe] 材料數量不匹配，跳過: 需要 ${requiredItems.length}，提供 ${providedTypes.length}`);
                    continue;
                }

                const requiredCounts = requiredItems.reduce((acc, item) => {
                    acc[item.item_id] = item.quantity;
                    return acc;
                }, {});
                
                console.log(`[findAssemblyRecipe] 需要的材料: ${JSON.stringify(requiredCounts)}`);

                // 比較提供的原料和需求的原料
                const isMatch = providedTypes.every(type => {
                    const match = providedCounts[type] === requiredCounts[type];
                    if (!match) {
                        console.log(`[findAssemblyRecipe] 材料不匹配: ${type} 提供 ${providedCounts[type]}，需要 ${requiredCounts[type] || 0}`);
                    }
                    return match;
                });

                if (isMatch) {
                    console.log(`[findAssemblyRecipe] 找到匹配的食譜: ${recipe.recipe_id} (${recipe.output_item_id_str}), 可訂單: ${recipe.is_orderable ? '是' : '否'}, 難度: ${recipe.difficulty || 1}`);
                    
                    // 確保返回的食譜對象包含完整信息
                    return {
                        ...recipe,
                        is_orderable: !!recipe.is_orderable, // 確保是布爾值
                        difficulty: recipe.difficulty || 1,   // 確保有難度值
                    };
                }
            }

            console.log(`[findAssemblyRecipe] 沒有找到匹配的食譜`);
            return null; // 沒有找到匹配的食譜
        } catch (error) {
            console.error(`[findAssemblyRecipe] 查詢過程中發生錯誤:`, error);
            return null;
        }
    }

    // =================================================================
    // 每日任務系統
    // =================================================================
    
    /**
     * 為指定用戶生成每日任務
     * @param {string} userId - 用戶ID
     * @returns {Promise<Array>} 生成的每日任務列表
     */
    async function generateDailyQuests(userId) {
        const client = await pool.connect();
        try {
            // 檢查用戶是否已有今天的每日任務
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const existingQuestsResult = await client.query(`
                SELECT * FROM cook_daily_quests 
                WHERE user_id = $1 AND created_at >= $2
            `, [userId, today]);
            
            // 如果已有今天的任務，直接返回
            if (existingQuestsResult.rows.length > 0) {
                console.log(`[每日任務] 用戶 ${userId} 已有今天的每日任務`);
                return existingQuestsResult.rows;
            }
            
            // 從任務模板中選擇3個任務
            const questTemplatesResult = await client.query(`
                SELECT * FROM cook_quest_templates 
                WHERE is_daily = TRUE
                ORDER BY RANDOM() 
                LIMIT 3
            `);
            
            if (questTemplatesResult.rows.length === 0) {
                console.warn('[每日任務] 沒有找到可用的每日任務模板');
                return [];
            }
            
            // 生成每日任務
            const dailyQuests = [];
            
            for (const template of questTemplatesResult.rows) {
                // 根據難度調整目標數量
                let target = template.base_target;
                
                // 插入新的每日任務
                const questResult = await client.query(`
                    INSERT INTO cook_daily_quests 
                    (user_id, quest_type, description, target, progress, status, reward_points, created_at)
                    VALUES ($1, $2, $3, $4, 0, 'active', $5, NOW())
                    RETURNING *
                `, [userId, template.quest_type, template.description, target, template.reward_points]);
                
                dailyQuests.push(questResult.rows[0]);
            }
            
            console.log(`[每日任務] 為用戶 ${userId} 生成了 ${dailyQuests.length} 個每日任務`);
            return dailyQuests;
            
        } catch (error) {
            console.error('[每日任務] 生成每日任務時出錯:', error);
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * 更新用戶的每日任務進度
     * @param {string} userId - 用戶ID
     * @param {string} questType - 任務類型
     * @param {number} progress - 進度增量
     * @returns {Promise<boolean>} 是否有任務完成
     */
    async function updateDailyQuestProgress(userId, questType, progress) {
        const updatedQuestsInfo = [];
        try {
            // 獲取今天的日期
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // 獲取任務更新前的狀態
            const beforeUpdateResult = await pool.query(`
                SELECT id, progress FROM cook_daily_quests
                WHERE user_id = $1
                  AND quest_type = $2
                  AND status = 'active'
                  AND created_at >= $3
            `, [userId, questType, today]);
            const initialProgressMap = new Map(beforeUpdateResult.rows.map(q => [q.id, q.progress]));
            
            // 更新指定類型的活躍每日任務
            const updateResult = await pool.query(`
                UPDATE cook_daily_quests
                SET progress = progress + $1
                WHERE user_id = $2 
                  AND quest_type = $3 
                  AND status = 'active'
                  AND created_at >= $4
                RETURNING *
            `, [progress, userId, questType, today]);
            
            if (updateResult.rows.length === 0) {
                return [];
            }
            
            // 檢查任務是否完成
            const updatedQuests = updateResult.rows;
            
            for (const quest of updatedQuests) {
                const initialProgress = initialProgressMap.get(quest.id) || 0;
                let questCompleted = false;

                // 將更新資訊加入陣列
                const questUpdateInfo = {
                    description: quest.description,
                    oldProgress: initialProgress,
                    newProgress: quest.progress,
                    target: quest.target,
                    completed: false,
                    rewardPoints: quest.reward_points
                };

                if (quest.progress >= quest.target && quest.status === 'active') {
                    // 將任務標記為完成
                    await pool.query(`
                        UPDATE cook_daily_quests
                        SET status = 'completed'
                        WHERE id = $1
                    `, [quest.id]);
                    
                    // 獎勵玩家積分
                    await pool.query(`
                        UPDATE cook_players
                        SET points = points + $1
                        WHERE user_id = $2
                    `, [quest.reward_points, userId]);
                    
                    questCompleted = true;
                    questUpdateInfo.completed = true;
                    
                    console.log(`[每日任務] 用戶 ${userId} 完成了每日任務 ${quest.id}，獲得 ${quest.reward_points} 點獎勵`);
                    
                    // 通知用戶任務完成
                    const userWs = activeConnections.get(userId);
                    if (userWs && userWs.readyState === WebSocket.OPEN) {
                        userWs.send(JSON.stringify({
                            type: 'daily_quest_completed',
                            questId: quest.id,
                            description: quest.description,
                            rewardPoints: quest.reward_points
                        }));
                    }
                }
                updatedQuestsInfo.push(questUpdateInfo);
            }
            
            return updatedQuestsInfo;
            
        } catch (error) {
            console.error('[每日任務] 更新每日任務進度時出錯:', error);
            return [];
        }
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

   // 輔助中介軟體：檢查管理員權限 (基於角色系統)
const isAdmin = async (req, res, next) => {
    try {
        // 從 authenticateToken 中介軟體獲取 userId
        const userId = req.user.userId;
        const ADMIN_ROLE_ID = 6; // 定義系統管理員的角色 ID

        // 查詢 cook_user_roles 表，檢查用戶是否擁有指定的管理員角色
        const roleResult = await pool.query(
            'SELECT 1 FROM cook_user_roles WHERE user_id = $1 AND role_id = $2',
            [userId, ADMIN_ROLE_ID]
        );

        // 如果查詢結果的行數為 0，表示該用戶沒有管理員角色
        if (roleResult.rowCount === 0) {
            console.warn(`[權限檢查] 使用者 ID: ${userId} 嘗試訪問管理員資源，但缺少 role_id = ${ADMIN_ROLE_ID} 的角色。`);
            return res.status(403).json({ success: false, error: '權限不足，需要系統管理員身份' });
        }

        // 權限檢查通過，繼續下一個處理程序
        console.log(`[權限檢查] 使用者 ID: ${userId} 已通過管理員權限驗證 (role_id = ${ADMIN_ROLE_ID})。`);
        next();

    } catch (error) {
        console.error(`[權限檢查] 檢查使用者 ID: ${req.user.userId} 的管理員權限時出錯:`, error);
        res.status(500).json({ success: false, error: '伺服器權限檢查時發生錯誤' });
    }
};
    
    // =================================================================
    // ★ 新增：管理後台 API
    // =================================================================
    
    // API: 獲取所有物品
    // 使用 authenticateToken 先驗證令牌，再用 isAdmin 檢查權限
    cookGameApp.get('/admin/all-items', authenticateToken, isAdmin, async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM cook_items ORDER BY id ASC');
            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching all items:', error);
            res.status(500).json({ success: false, message: '獲取物品列表失敗' });
        }
    });

    // 增強版：獲取所有食譜，包含其組成成分
    cookGameApp.get('/admin/all-recipes', authenticateToken, isAdmin, async (req, res) => {
        try {
            const query = `
                SELECT 
                    r.id, 
                    r.recipe_id, 
                    r.recipe_name, 
                    r.station_type, 
                    r.output_item_id,
                    out_item.item_name as output_item_name,
                    out_item.item_id as output_item_id_str,
                    r.cooking_time_ms, 
                    r.is_orderable, 
                    r.difficulty,
                    r.description,
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'required_item_id', req.required_item_id,
                            'item_id_str', req_item.item_id,
                            'item_name', req_item.item_name,
                            'quantity', req.quantity
                        ))
                        FROM cook_recipe_requirements_v2 req
                        JOIN cook_items req_item ON req.required_item_id = req_item.id
                        WHERE req.recipe_id = r.id),
                        '[]'::json
                    ) as requirements
                FROM 
                    cook_recipes_v2 r
                JOIN 
                    cook_items out_item ON r.output_item_id = out_item.id
                ORDER BY 
                    r.id ASC;
            `;
            const result = await pool.query(query);
            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching all recipes with requirements:', error);
            res.status(500).json({ success: false, message: '獲取食譜列表失敗' });
        }
    });

    // 新增：根據食譜類型過濾食譜的API
    cookGameApp.get('/api/recipes/filter', authenticateToken, async (req, res) => {
        const { station_type, is_orderable, difficulty_min, difficulty_max } = req.query;
        
        try {
            // 構建查詢條件
            let queryConditions = [];
            let queryParams = [];
            let paramIndex = 1;
            
            // 根據工作站類型過濾
            if (station_type) {
                // 支持多個工作站類型，用逗號分隔
                const stationTypes = station_type.split(',');
                if (stationTypes.length > 0) {
                    const stationPlaceholders = stationTypes.map((_, idx) => `$${paramIndex + idx}`).join(',');
                    queryConditions.push(`r.station_type IN (${stationPlaceholders})`);
                    queryParams.push(...stationTypes);
                    paramIndex += stationTypes.length;
                }
            }
            
            // 根據是否可訂單過濾
            if (is_orderable !== undefined) {
                const isOrderableBool = is_orderable === 'true' || is_orderable === '1';
                queryConditions.push(`r.is_orderable = $${paramIndex}`);
                queryParams.push(isOrderableBool);
                paramIndex++;
            }
            
            // 根據難度範圍過濾
            if (difficulty_min !== undefined) {
                queryConditions.push(`r.difficulty >= $${paramIndex}`);
                queryParams.push(parseInt(difficulty_min, 10));
                paramIndex++;
            }
            
            if (difficulty_max !== undefined) {
                queryConditions.push(`r.difficulty <= $${paramIndex}`);
                queryParams.push(parseInt(difficulty_max, 10));
                paramIndex++;
            }
            
            // 構建完整的SQL查詢
            let query = `
                SELECT 
                    r.id AS recipe_db_id,
                    r.recipe_id, 
                    r.station_type, 
                    r.output_item_id,
                    r.cook_time_seconds,
                    r.is_orderable, 
                    r.difficulty,
                    r.recipe_name,
                    i_out.item_name AS output_item_name,
                    i_out.item_id AS output_item_id_str
                FROM cook_recipes_v2 r
                JOIN cook_items i_out ON r.output_item_id = i_out.id
            `;
            
            // 添加WHERE子句（如果有條件）
            if (queryConditions.length > 0) {
                query += ` WHERE ${queryConditions.join(' AND ')}`;
            }
            
            // 添加排序
            query += ` ORDER BY r.difficulty ASC, r.recipe_name ASC`;
            
            console.log(`[API] 過濾食譜查詢: ${query.replace(/\s+/g, ' ')}`);
            console.log(`[API] 查詢參數: ${JSON.stringify(queryParams)}`);
            
            // 執行查詢
            const recipesResult = await pool.query(query, queryParams);
            const recipes = recipesResult.rows;
            
            // 獲取食譜需求
            const recipeIds = recipes.map(r => r.recipe_db_id);
            let requirementsQuery = `
                SELECT 
                    req.recipe_id, 
                    req.required_item_id, 
                    req.quantity,
                    i.item_id,
                    i.item_name
                        FROM cook_recipe_requirements_v2 req
                JOIN cook_items i ON req.required_item_id = i.id
            `;
            
            // 如果有食譜，添加ID過濾
            if (recipeIds.length > 0) {
                const recipePlaceholders = recipeIds.map((_, idx) => `$${idx + 1}`).join(',');
                requirementsQuery += ` WHERE req.recipe_id IN (${recipePlaceholders})`;
            } else {
                // 如果沒有符合條件的食譜，直接返回空數組
                return res.json([]);
            }
            
            const requirementsResult = await pool.query(requirementsQuery, recipeIds);
            
            // 將需求資料映射到對應的食譜
            const recipesWithRequirements = recipes.map(recipe => {
                const requirements = requirementsResult.rows
                    .filter(req => req.recipe_id === recipe.recipe_db_id)
                    .map(req => ({
                        item_id: req.item_id,
                        item_name: req.item_name,
                        quantity: req.quantity
                    }));

                return {
                    ...recipe,
                    requirements
                };
            });
            
            res.json(recipesWithRequirements);
        } catch (error) {
            console.error('過濾食譜時出錯:', error);
            res.status(500).json({ success: false, error: '無法獲取過濾後的食譜列表' });
        }
    });

    // 新增：獲取可訂單食譜的API
    cookGameApp.get('/api/recipes/orderable', authenticateToken, async (req, res) => {
        try {
            const query = `
                SELECT 
                    r.id AS recipe_db_id,
                    r.recipe_id, 
                    r.station_type, 
                    r.output_item_id, 
                    r.cook_time_seconds,
                    r.difficulty,
                    r.recipe_name,
                    i_out.item_name AS output_item_name,
                    i_out.item_id AS output_item_id_str
                FROM cook_recipes_v2 r
                JOIN cook_items i_out ON r.output_item_id = i_out.id
                WHERE r.is_orderable = true
                ORDER BY r.difficulty ASC, r.recipe_name ASC
            `;
            
            const recipesResult = await pool.query(query);
            const recipes = recipesResult.rows;
            
            res.json(recipes);
        } catch (error) {
            console.error('獲取可訂單食譜時出錯:', error);
            res.status(500).json({ success: false, error: '無法獲取可訂單食譜列表' });
        }
    });

    const activeConnections = new Map(); // 用於追蹤 userId -> ws 的對應關係

    /**
     * 向所有已連接的用戶廣播系統消息
     * @param {string} message - 要廣播的消息內容
     * @param {string} type - 消息類型，默認為 'system_broadcast'
     */
    async function broadcastSystemMessage(message, type = 'system_broadcast') {
        try {
            console.log(`[COOK-GAME WS] 廣播系統消息: ${message}`);
            
            // 構建廣播消息
            const broadcastMessage = JSON.stringify({
                type: type,
                text: message,
                timestamp: Date.now()
            });
            
            // 向所有已連接的用戶發送消息
            for (const [userId, ws] of activeConnections.entries()) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(broadcastMessage);
                }
            }
        } catch (error) {
            console.error('[COOK-GAME WS] 廣播系統消息時出錯:', error);
        }
    }
    
    /**
     * 向指定用戶發送個人資料更新通知
     * @param {string} userId - 用戶ID
     * @param {object} updates - 更新的資料
     */
    async function notifyUserProfileUpdate(userId, updates) {
        try {
            const ws = activeConnections.get(userId);
            if (ws && ws.readyState === WebSocket.OPEN) {
                console.log(`[COOK-GAME WS] 向用戶 ${userId} 發送資料更新通知`);
                
                ws.send(JSON.stringify({
                    type: 'user_profile_updated',
                    ...updates,
                    timestamp: Date.now()
                }));
            }
        } catch (error) {
            console.error(`[COOK-GAME WS] 向用戶 ${userId} 發送資料更新通知時出錯:`, error);
        }
    }
    
    /**
     * 向所有已連接的用戶廣播房間列表更新通知
     */
    async function notifyRoomListUpdated() {
        try {
            console.log(`[COOK-GAME WS] 廣播房間列表更新通知`);
            
            // 構建廣播消息
            const broadcastMessage = JSON.stringify({
                type: 'room_list_updated',
                timestamp: Date.now()
            });
            
            // 向所有已連接的用戶發送消息
            for (const [userId, ws] of activeConnections.entries()) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(broadcastMessage);
                }
            }
        } catch (error) {
            console.error('[COOK-GAME WS] 廣播房間列表更新通知時出錯:', error);
        }
    }

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
            
            // 新增：通知所有連接的用戶房間列表已更新
            notifyRoomListUpdated();
            
            // 新增：向所有用戶廣播系統消息
            if (leftPlayer && leftPlayer.username) {
                broadcastSystemMessage(`玩家 ${leftPlayer.username} 已離開房間 ${room.room_name}`);
            }
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
                        dailyQuestUpdates: player.dailyQuestUpdates || [] // 附上每日任務進度更新
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
            
            // 獲取已完成的訂單詳情，用於計算難度獎勵
            const completedOrdersDetails = gameState.completedOrdersDetails || [];
            
            // 為每個玩家更新統計數據
            for (const player of gameState.players) {
                const userId = player.id;
                if (!userId) continue;

                // ★ 新增：更新每日任務進度並收集結果
                console.log(`[每日任務] 正在為玩家 ${userId} 更新遊戲結束後的每日任務進度...`);
                player.dailyQuestUpdates = [];
                const gameUpdates = await updateDailyQuestProgress(userId, 'complete_games', 1);
                player.dailyQuestUpdates.push(...gameUpdates);
                const pointUpdates = await updateDailyQuestProgress(userId, 'earn_points', basePoints);
                player.dailyQuestUpdates.push(...pointUpdates);
                const orderUpdates = await updateDailyQuestProgress(userId, 'complete_orders', completedOrders);
                player.dailyQuestUpdates.push(...orderUpdates);

                // ★ 待辦：處理 'complete_difficulty_orders' 類型的每日任務。
                // 目前 cook_daily_quests 表缺少 target_difficulty 欄位，因此暫時無法處理。
                // 未來可考慮擴充資料庫欄位以支援此功能。


                // 計算玩家獲得的經驗值和點數
                let pointsEarned = basePoints;
                let questReward = 0;
                
                // 基礎經驗值計算
                let expGained = Math.floor(basePoints / 10); // 基礎經驗值
                
                // 根據完成的訂單難度計算額外經驗值
                if (completedOrdersDetails.length > 0) {
                    let difficultyExpBonus = 0;
                    
                    // 遍歷所有完成的訂單，根據難度給予經驗值獎勵
                    for (const order of completedOrdersDetails) {
                        const orderDifficulty = order.difficulty || 1;
                        
                        // 難度越高，獲得的經驗值越多
                        switch (orderDifficulty) {
                            case 1: // 簡單
                                difficultyExpBonus += 5;
                                break;
                            case 2: // 中等
                                difficultyExpBonus += 10;
                                break;
                            case 3: // 困難
                                difficultyExpBonus += 20;
                                break;
                            case 4: // 專家
                                difficultyExpBonus += 35;
                                break;
                            case 5: // 大師
                                difficultyExpBonus += 50;
                                break;
                            default:
                                difficultyExpBonus += 5;
                        }
                        
                        console.log(`[COOK-GAME] 訂單 ${order.id} 難度為 ${orderDifficulty}，獎勵經驗值 +${difficultyExpBonus}`);
                    }
                    
                    // 將難度獎勵加入總經驗值
                    expGained += difficultyExpBonus;
                    console.log(`[COOK-GAME] 玩家 ${userId} 因完成不同難度的訂單獲得額外 ${difficultyExpBonus} 經驗值`);
                } else {
                    // 如果沒有詳細訂單資料，使用完成訂單數量作為基礎獎勵
                    expGained += completedOrders * 5;
                    console.log(`[COOK-GAME] 玩家 ${userId} 完成了 ${completedOrders} 個訂單，獲得額外 ${completedOrders * 5} 經驗值`);
                }
                
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
                                
                            // 新增：完成特定難度的訂單
                            case 'complete_difficulty_orders':
                                if (completedOrdersDetails.length > 0) {
                                    // 計算符合要求難度的訂單數量
                                    const targetDifficulty = quest.target_difficulty || 1;
                                    const matchingOrders = completedOrdersDetails.filter(
                                        order => (order.difficulty || 1) >= targetDifficulty
                                    ).length;
                                    
                                    if (matchingOrders > 0) {
                                        await pool.query(
                                            'UPDATE cook_player_quests SET progress = progress + $1 WHERE id = $2',
                                            [matchingOrders, quest.id]
                                        );
                                        questUpdated = true;
                                        console.log(`[COOK-GAME] 玩家 ${userId} 完成了 ${matchingOrders} 個難度 ${targetDifficulty} 或以上的訂單，更新任務 ${quest.id}`);
                                    }
                                }
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
                                    
                                    // 任務完成也給予額外經驗值，難度越高獎勵越多
                                    const questExpReward = Math.floor(questRewardPoints / 4);
                                    expGained += questExpReward;
                                    
                                    console.log(`[COOK-GAME] 玩家 ${userId} 完成了任務 ${quest.id}，獲得 ${questRewardPoints} 點額外獎勵和 ${questExpReward} 經驗值`);
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

        const newUnlockedTitles = await checkTitleUnlocks(userId);
        if (newUnlockedTitles.length > 0) {
            console.log(`[COOK-GAME] 玩家 ${userId} 解鎖了 ${newUnlockedTitles.length} 個新稱號`);
            
            // 向玩家發送稱號解鎖通知
            const playerWs = activeConnections.get(userId);
            if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                playerWs.send(JSON.stringify({
                    type: 'titles_unlocked',
                    titles: newUnlockedTitles.map(title => ({
                        title_id: title.title_id,
                        title_name: title.title_name,
                        rarity: title.rarity
                    }))
                }));
            }
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
                
                // 檢查是否有解鎖新物品
                const unlockedItems = await checkLevelUnlocks(newLevel);
                
                // 如果有連線中的玩家，發送升級通知
                const playerWs = activeConnections.get(userId);
                if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                    playerWs.send(JSON.stringify({
                        type: 'level_up',
                        newLevel: newLevel,
                        message: `恭喜！你升到了 ${newLevel} 級！`,
                        unlockedItems: unlockedItems,
                        expProgress: {
                            current: 0,  // 升級後經驗值重置為0
                            next: newLevel * 100  // 下一級所需經驗值
                        }
                    }));
                }
                
                // 使用系統廣播通知其他玩家
                const playerDataResult = await pool.query('SELECT username, display_name FROM box_users WHERE user_id = $1', [userId]);                if (playerDataResult.rows.length > 0) {
                    const playerName = playerDataResult.rows[0].display_name || playerDataResult.rows[0].username;
                    broadcastSystemMessage(`恭喜玩家 ${playerName} 升級到 ${newLevel} 級！`);
                }
                
                // 檢查是否需要繼續升級（如果獲得的經驗值足夠連升多級）
                if ((currentExp - expNeededForNextLevel) >= (newLevel * 100)) {
                    await checkAndUpdatePlayerLevel(userId);
                }
            }
        } catch (error) {
            console.error(`[COOK-GAME] 檢查玩家等級時出錯:`, error);
        }
    }
    
    /**
     * 檢查玩家升級後是否有解鎖新物品
     * @param {number} level - 玩家的新等級
     * @returns {Promise<Array>} 解鎖的物品列表
     */
    async function checkLevelUnlocks(level) {
        try {
            // 查詢該等級解鎖的物品
            const unlocksResult = await pool.query(`
                SELECT i.id, i.item_id, i.item_name, i.item_type, i.symbol 
                FROM cook_items i
                WHERE i.unlock_level = $1
                ORDER BY i.item_type, i.item_name
            `, [level]);
            
            if (unlocksResult.rows.length > 0) {
                console.log(`[COOK-GAME] 等級 ${level} 解鎖了 ${unlocksResult.rows.length} 個新物品`);
                return unlocksResult.rows.map(item => ({
                    id: item.item_id,
                    name: item.item_name,
                    type: item.item_type,
                    symbol: item.symbol
                }));
            }
            
            return [];
        } catch (error) {
            console.error(`[COOK-GAME] 檢查等級解鎖時出錯:`, error);
            return [];
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
                            username: username,
                            display_name: userProfile.display_name || username,
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
                                    orders: [await generateOrder(roomId)], // 產生1個初始訂單
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

                const { action, payload } = data;
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
                            const { ingredientType, slotIndex } = payload;
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
                                payload: { ingredientType, slotIndex }
                            }, ws);
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 拿取了 ${ingredientType}`);
                            break;
                        }
                        case 'cook_item': {
                            const { slotIndex, stationType } = payload;
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
                            // 使用前端傳來的 stationType 作為烹飪方法
                            const recipe = await findCookingRecipe(item.type, stationType || 'grill');
                        
                            if (!recipe) {
                                ws.send(JSON.stringify({ type: 'error', message: '此物品無法在此烹飪站處理' }));
                                break;
                            }
                            
                            // 根據食譜更新物品狀態
                            player.inventory[slotIndex] = {
                                ...item,
                                type: recipe.output_item_id_str, // 使用食譜的產出物 ID
                                state: 'cooked' // 狀態可根據食譜定義，此處簡化
                            };
                            
                            gameState.players[playerIndex] = player;
                        
                            // 保存遊戲狀態
                            await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                            await client.query('COMMIT');
                        
                            // 通知操作的玩家烹飪成功
                            ws.send(JSON.stringify({
                                type: 'item_cooked',
                                slotIndex,
                                resultType: recipe.output_item_id_str
                            }));
                        
                            // 廣播給房間內其他玩家
                            broadcastToRoom(roomId, {
                                type: 'player_action',
                                playerId: userId,
                                playerName: username,
                                action: 'cook_item',
                                payload: { slotIndex, resultType: recipe.output_item_id_str }
                            }, ws);
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 根據食譜 ${recipe.recipe_id} 將 ${item.type} 烹飪成 ${recipe.output_item_id_str}`);
                            break;
                        }
                        case 'assemble_items': {
                            // payload.ingredientItemTypes 應該是像 ['beef_patty_cooked', 'bread_slice_toasted'] 這樣的陣列
                            const { ingredientItemTypes } = payload;
                            
                            if (!ingredientItemTypes || !Array.isArray(ingredientItemTypes) || ingredientItemTypes.length === 0) {
                                ws.send(JSON.stringify({ type: 'error', message: '未提供用於組裝的物品' }));
                                break;
                            }
                        
                            // 查找匹配的組合食譜
                            const recipe = await findAssemblyRecipe(ingredientItemTypes);
                            
                            if (!recipe) {
                                ws.send(JSON.stringify({ type: 'error', message: '這些物品無法組合在一起' }));
                                break;
                            }
                        
                            // 從庫存中移除已使用的食材
                            let inventoryCopy = [...player.inventory];
                            let itemsToRemove = [...ingredientItemTypes];
                        
                            for (let i = 0; i < inventoryCopy.length; i++) {
                                if (inventoryCopy[i] && itemsToRemove.includes(inventoryCopy[i].type)) {
                                    // 從移除列表中刪除一個匹配項
                                    const indexToRemove = itemsToRemove.indexOf(inventoryCopy[i].type);
                                    itemsToRemove.splice(indexToRemove, 1);
                                    // 將庫存槽清空
                                    inventoryCopy[i] = null;
                                }
                            }
                            
                            // 在第一個空槽位放入組裝好的料理
                            const emptySlot = inventoryCopy.findIndex(item => item === null);
                            if (emptySlot === -1) {
                                ws.send(JSON.stringify({ type: 'error', message: '沒有空的庫存槽來放置組裝好的料理' }));
                                // 注意：理論上不應該發生，因為我們剛移除了原料。但作為防呆。
                                break;
                            }
                        
                            inventoryCopy[emptySlot] = {
                                id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                                type: recipe.output_item_id_str, // 來自食譜的產出物
                                state: 'assembled'
                            };
                        
                            player.inventory = inventoryCopy;
                            gameState.players[playerIndex] = player;
                        
                            // 保存遊戲狀態
                            await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                            await client.query('COMMIT');
                        
                            // 通知玩家組裝成功
                            ws.send(JSON.stringify({
                                type: 'items_assembled',
                                newInventory: player.inventory,
                                resultType: recipe.output_item_id_str
                            }));
                        
                            // 廣播給其他玩家
                            broadcastToRoom(roomId, {
                                type: 'player_action',
                                playerId: userId,
                                playerName: username,
                                action: 'assemble_items',
                                payload: { resultType: recipe.output_item_id_str }
                            }, ws);
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 根據食譜 ${recipe.recipe_id} 組裝了 ${recipe.output_item_id_str}`);
                            break;
                        }
                        case 'serve_dish': {
                            const { slotIndex } = payload;
                            if (slotIndex < 0 || slotIndex >= player.inventory.length) {
                                ws.send(JSON.stringify({ type: 'error', message: '無效的庫存槽位' }));
                                break;
                            }

                            const dish = player.inventory[slotIndex];
                            if (!dish) {
                                ws.send(JSON.stringify({ type: 'error', message: '庫存槽為空，無法上菜' }));
                                break;
                            }

                            // 1. 驗證物品是否為可上菜的料理
                            const itemData = await getItemData(dish.type);
                            if (!itemData || !itemData.is_dish) {
                                ws.send(JSON.stringify({ type: 'error', message: '這不是一道完整的料理' }));
                                break;
                            }

                            // 2. 尋找匹配的訂單
                            const orderIndex = gameState.orders.findIndex(order => order.recipe === dish.type);
                            if (orderIndex === -1) {
                                ws.send(JSON.stringify({ type: 'error', message: `這道'${itemData.item_name}'沒有對應的訂單` }));
                                break;
                            }

                            // 3. 計算分數並更新狀態
                            const order = gameState.orders.splice(orderIndex, 1)[0];
                            player.inventory[slotIndex] = null;
                            
                            let points = itemData.base_points || 20;
                            const timePercent = order.timeRemaining / order.totalTime;
                            if (timePercent > 0.7) points += Math.floor(points * 0.5); // 50% 獎勵
                            else if (timePercent > 0.4) points += Math.floor(points * 0.2); // 20% 獎勵
                            
                            gameState.score += points;
                            gameState.completedOrders = (gameState.completedOrders || 0) + 1;
                            player.score = (player.score || 0) + points;
                            gameState.players[playerIndex] = player;

                            // 4. 保存遊戲狀態
                            await client.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [gameState, roomId]);
                            
                            // 5. 廣播訂單完成
                            broadcastToRoom(roomId, {
                                type: 'order_completed',
                                orderId: order.id,
                                points,
                                newScore: gameState.score,
                                playerName: username
                            });
                            
                            console.log(`[COOK-GAME] 玩家 ${username} 完成了訂單 ${order.id} (${itemData.item_name})，獲得 ${points} 分`);

                            // 6. 異步生成新訂單 (如果需要)
                            if (gameState.orders.length < 3) { // 保持場上最少有3個訂單
                                setTimeout(async () => {
                                    try {
                                        const newOrder = await generateOrder(roomId);
                                        if (newOrder) {
                                            const updateResult = await pool.query('SELECT game_state FROM cook_game_rooms WHERE room_id = $1', [roomId]);
                                            if (updateResult.rows.length > 0) {
                                                let updatedGameState = updateResult.rows[0].game_state;
                                                updatedGameState.orders.push(newOrder);
                                                await pool.query('UPDATE cook_game_rooms SET game_state = $1 WHERE room_id = $2', [updatedGameState, roomId]);
                                                broadcastToRoom(roomId, { type: 'new_order', order: newOrder });
                                                console.log(`[COOK-GAME] 房間 ${roomId} 已生成新訂單: ${newOrder.recipe}`);
                                            }
                                        }
                                    } catch (error) {
                                        console.error(`[COOK-GAME] 自動生成新訂單失敗:`, error);
                                    }
                                }, 2000); // 延遲2秒生成
                            }

                            // 7. COMMIT 事務
                            await client.query('COMMIT');
                            break;
                        }
                        case 'select_slot': {
                            const { slotIndex } = payload;
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
                            const { fromSlot, toPlayerId } = payload;
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

            // 獲取用戶顯示名稱
            const userResult = await pool.query(
                'SELECT display_name FROM box_users WHERE user_id = $1',
                [userId]
            );
            const displayName = userResult.rows[0]?.display_name || username;
            
            // 將難度轉換為中文
            let difficultyText = '簡單';
            if (roomDifficulty === 'normal') difficultyText = '普通';
            if (roomDifficulty === 'hard') difficultyText = '困難';
            
            // 通知所有用戶房間列表已更新
            notifyRoomListUpdated();
            
            // 使用系統廣播通知所有用戶新房間已創建
            broadcastSystemMessage(`${displayName} 創建了一個新的${difficultyText}難度房間「${roomName}」`);

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
            

            const titleQuery = `
            SELECT t.title_id, t.title_name, t.rarity, t.color_code, t.icon_url
            FROM cook_titles t
            JOIN cook_user_titles ut ON t.id = ut.title_id
            WHERE ut.user_id = $1 AND ut.is_equipped = TRUE
            LIMIT 1
        `;
        
        const titleResult = await pool.query(titleQuery, [req.user.userId]);
        if (titleResult.rows.length > 0) {
            user.equipped_title = titleResult.rows[0];
        }



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
        console.log(`[Quick Login] 使用者 ${user.username} (ID: ${user.user_id}) 嘗試登入...`); // 新增日誌
        
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
          // 更新最後登入時間和用戶名，確保與主表同步
          await pool.query(
            'UPDATE cook_players SET last_login = NOW(), username = $2 WHERE user_id = $1',
            [user.user_id, user.username]
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

                            // 修改：在 auth_success 回應中包含用戶資料
                            ws.send(JSON.stringify({ 
                                type: 'auth_success',
                                userData: {
                                    user_id: userProfile.user_id,
                                    username: userProfile.username,
                                    display_name: userProfile.display_name,
                                    user_profile_image_url: userProfile.user_profile_image_url,
                                    level: userProfile.level
                                }
                            }));
                            console.log(`[COOK-GAME WS] 使用者 ${userProfile.display_name || userProfile.username} (ID: ${userId}) 認證成功`);
                            ws.userProfile = userProfile;
                            
                            // 新增：向新連接的用戶發送個人歡迎消息
                            notifyUserProfileUpdate(userId, {
                                welcome_message: `歡迎回來，${userProfile.display_name || userProfile.username}！`,
                                last_login: new Date().toISOString()
                            });
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

    // =================================================================
    // 遊戲邏輯輔助函數 (V1 - 可能已部分棄用或需重構)
    // =================================================================
    
    /**
     * 計算訂單完成時獲得的分數
     * @param {object} order - 訂單物件
     * @returns {number} 分數
     */
    function calculateOrderPoints(order) {
        // 獲取基礎分數，如果沒有設定則使用預設值50
        const basePoints = order.basePoints || 50;
        
        // 計算時間獎勵
        // 根據訂單的總時間和剩餘時間計算時間獎勵百分比
        const totalTime = order.totalTime || 120;
        const timeRemaining = order.timeRemaining || 0;
        const timePercentage = timeRemaining / totalTime;
        
        // 時間獎勵：最多可獲得基礎分數的100%額外獎勵
        const timeBonus = Math.floor(basePoints * timePercentage);
        
        // 難度獎勵：根據訂單難度提供額外獎勵
        const difficulty = order.difficulty || 1;
        const difficultyMultiplier = 1 + (difficulty - 1) * 0.2; // 難度每增加1，獎勵增加20%
        
        // 計算總分
        const totalPoints = Math.floor((basePoints + timeBonus) * difficultyMultiplier);
        
        console.log(`[COOK-GAME] 訂單完成計分: 基礎分數=${basePoints}, 時間獎勵=${timeBonus}, 難度=${difficulty}, 難度乘數=${difficultyMultiplier.toFixed(2)}, 總分=${totalPoints}`);
        
        return totalPoints;
    }

    /**
     * 隨機生成一個新的遊戲訂單，根據房間難度調整訂單難度範圍
     * @param {string} roomId - 房間ID，用於獲取房間難度設置
     * @returns {Promise<object|null>} 新的訂單物件或在錯誤時返回 null
     */
    async function generateOrder(roomId) {
        try {
            // 獲取房間難度設置
            let minDifficulty = 1;
            let maxDifficulty = 5;
            
            if (roomId) {
                const roomResult = await pool.query(
                    'SELECT difficulty FROM cook_game_rooms WHERE id = $1',
                    [roomId]
                );
                
                if (roomResult.rows.length > 0) {
                    const roomDifficulty = roomResult.rows[0].difficulty;
                    
                    // 根據房間難度設置訂單難度範圍
                    switch (roomDifficulty) {
                        case 'easy':
                            minDifficulty = 1;
                            maxDifficulty = 2;
                            break;
                        case 'normal':
                            minDifficulty = 2;
                            maxDifficulty = 4;
                            break;
                        case 'hard':
                            minDifficulty = 3;
                            maxDifficulty = 5;
                            break;
                        default:
                            // 使用默認範圍
                            break;
                    }
                    
                    console.log(`[COOK-GAME] 房間 ${roomId} 難度為 ${roomDifficulty}，訂單難度範圍: ${minDifficulty}-${maxDifficulty}`);
                }
            }
            
            // 修改查詢，只選擇可訂單(is_orderable=true)的食譜，並根據難度範圍過濾
            const recipeResult = await pool.query(
                `SELECT r.recipe_id, r.difficulty, i.item_id, i.item_name 
                 FROM cook_recipes_v2 r
                 JOIN cook_items i ON i.id = r.output_item_id
                 WHERE r.is_orderable = TRUE 
                   AND r.difficulty BETWEEN $1 AND $2
                 ORDER BY RANDOM() LIMIT 1`,
                [minDifficulty, maxDifficulty]
            );

            if (recipeResult.rows.length === 0) {
                console.warn(`[COOK-GAME] 資料庫中沒有難度在 ${minDifficulty}-${maxDifficulty} 範圍內的可訂購食譜`);
                
                // 如果找不到符合難度範圍的食譜，嘗試獲取任何可訂單食譜
                const fallbackResult = await pool.query(
                    `SELECT r.recipe_id, r.difficulty, i.item_id, i.item_name 
                     FROM cook_recipes_v2 r
                     JOIN cook_items i ON i.id = r.output_item_id
                     WHERE r.is_orderable = TRUE 
                     ORDER BY RANDOM() LIMIT 1`
                );
                
                if (fallbackResult.rows.length === 0) {
                    console.error('[COOK-GAME] 資料庫中沒有任何可訂購的食譜');
                    return null;
                }
                
                console.log('[COOK-GAME] 使用備用食譜生成訂單');
                recipeResult.rows = fallbackResult.rows;
            }
            
            const recipe = recipeResult.rows[0];
            const dishItemId = recipe.item_id;
            
            // 根據食譜難度調整訂單時間限制
            let timeLimit;
            let basePoints;
            
            // 根據難度設置時間和基礎分數
            switch (recipe.difficulty) {
                case 1: // 簡單
                    timeLimit = 150; // 2分30秒
                    basePoints = 50;
                    break;
                case 2: // 中等
                    timeLimit = 120; // 2分鐘
                    basePoints = 80;
                    break;
                case 3: // 困難
                    timeLimit = 90; // 1分30秒
                    basePoints = 120;
                    break;
                case 4: // 專家
                    timeLimit = 75; // 1分15秒
                    basePoints = 180;
                    break;
                case 5: // 大師
                    timeLimit = 60; // 1分鐘
                    basePoints = 250;
                    break;
                default:
                    timeLimit = 120; // 預設2分鐘
                    basePoints = 50;
            }

            console.log(`[COOK-GAME] 生成新訂單: ${recipe.item_name} (ID:${dishItemId}), 難度:${recipe.difficulty}, 時間:${timeLimit}秒, 基礎分數:${basePoints}`);

            return {
                id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                recipe: dishItemId,
                recipeName: recipe.item_name,
                difficulty: recipe.difficulty,
                basePoints: basePoints,
                totalTime: timeLimit,
                timeRemaining: timeLimit,
                createdAt: Date.now()
            };
        } catch (error) {
            console.error('[COOK-GAME] 生成新訂單時發生資料庫錯誤:', error);
            return null;
        }
    }

    /**
     * 重置玩家的烹飪相關狀態 (例如，當他們完成一個動作後)
     * @param {object} player - 玩家物件
     */
    function resetPlayerCooking(player) {
        player.isCooking = false;
        player.cookingProgress = 0;
        player.cookingStartTime = null;
    }

    // 添加每日任務相關的API端點
    
    // API: 獲取用戶的每日任務
    cookGameApp.get('/api/daily-quests', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.userId;
            
            // 獲取今天的日期
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // 檢查用戶是否已有今天的每日任務
            const existingQuestsResult = await pool.query(`
                SELECT * FROM cook_daily_quests 
                WHERE user_id = $1 AND created_at >= $2
                ORDER BY id ASC
            `, [userId, today]);
            
            // 如果沒有今天的任務，生成新的每日任務
            if (existingQuestsResult.rows.length === 0) {
                const dailyQuests = await generateDailyQuests(userId);
                res.json({ success: true, quests: dailyQuests });
            } else {
                res.json({ success: true, quests: existingQuestsResult.rows });
            }
            
        } catch (error) {
            console.error('獲取每日任務時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤' });
        }
    });
    
    // API: 手動領取每日任務獎勵
    cookGameApp.post('/api/daily-quests/:questId/claim', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.userId;
            const questId = req.params.questId;
            
            // 檢查任務是否存在且屬於該用戶
            const questResult = await pool.query(`
                SELECT * FROM cook_daily_quests
                WHERE id = $1 AND user_id = $2
            `, [questId, userId]);
            
            if (questResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: '找不到指定的任務' });
            }
            
            const quest = questResult.rows[0];
            
            // 檢查任務是否已完成但尚未領取獎勵
            if (quest.progress >= quest.target && quest.status === 'active') {
                // 更新任務狀態
                await pool.query(`
                    UPDATE cook_daily_quests
                    SET status = 'completed'
                    WHERE id = $1
                `, [questId]);
                
                // 獎勵玩家積分
                const pointsResult = await pool.query(`
                    UPDATE cook_players
                    SET points = points + $1
                    WHERE user_id = $2
                    RETURNING points
                `, [quest.reward_points, userId]);
                
                console.log(`[每日任務] 用戶 ${userId} 領取了任務 ${questId} 的獎勵: ${quest.reward_points} 點`);
                
                // 使用notifyUserProfileUpdate通知用戶獲得獎勵
                notifyUserProfileUpdate(userId, {
                    questCompleted: {
                        questId: quest.id,
                        questTitle: quest.title,
                        rewardPoints: quest.reward_points,
                        newTotalPoints: pointsResult.rows[0]?.points || 0
                    },
                    message: `恭喜完成任務「${quest.title}」，獲得 ${quest.reward_points} 點獎勵！`
                });
                
                // 返回更新後的積分
                res.json({
                    success: true, 
                    message: '成功領取獎勵', 
                    rewardPoints: quest.reward_points,
                    totalPoints: pointsResult.rows[0]?.points || 0
                });
            } else if (quest.status === 'completed') {
                res.status(400).json({ success: false, error: '此任務獎勵已領取' });
            } else {
                res.status(400).json({ success: false, error: '任務尚未完成，無法領取獎勵' });
            }
            
        } catch (error) {
            console.error('領取任務獎勵時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤' });
        }
    });

    /**
     * 獲取排行榜數據
     * 支持分頁和排序參數
     */
    cookGameApp.get('/api/leaderboard', async (req, res) => {
        try {
            // 獲取查詢參數
            const limit = parseInt(req.query.limit) || 10; // 默認顯示10名玩家
            const offset = parseInt(req.query.offset) || 0;
            const sortBy = req.query.sort_by || 'points'; // 默認按積分排序
            const sortOrder = req.query.sort_order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'; // 默認降序

            // 驗證並過濾排序欄位，防止SQL注入
            const validSortFields = ['points', 'level', 'games_played', 'orders_completed', 'created_at', 'last_login'];
            const safeSort = validSortFields.includes(sortBy) ? sortBy : 'points';

            // 構建SQL查詢
            const query = `
                SELECT 
                    cp.player_id, 
                    cp.username, 
                    cp.level, 
                    cp.points, 
                    cp.games_played,
                    cp.orders_completed,
                    cp.achievements, 
                    cp.created_at, 
                    cp.last_login,
                    bu.display_name,
                    bu.user_profile_image_url as profile_image
                FROM 
                    cook_players cp
                LEFT JOIN 
                    box_users bu ON cp.user_id = bu.user_id
                ORDER BY 
                    cp.${safeSort} ${sortOrder}
                LIMIT $1 OFFSET $2
            `;

            // 執行查詢
            const result = await pool.query(query, [limit, offset]);

            // 獲取總記錄數
            const countResult = await pool.query('SELECT COUNT(*) as total FROM cook_players');
            const total = parseInt(countResult.rows[0].total);

            // 處理結果
            const leaderboard = result.rows.map(player => {
                // 優先使用display_name，如果為空則使用username
                const displayName = player.display_name || player.username;
                
                return {
                    player_id: player.player_id,
                    username: displayName, // 使用顯示名稱
                    level: player.level,
                    points: player.points,
                    achievements: player.achievements,
                    profile_image: player.profile_image || '/images/default-avatar.png', // 提供默認頭像
                    joined_at: player.created_at,
                    last_active: player.last_login
                };
            });

            // 返回結果，包含分頁信息
            res.json({
                leaderboard,
                pagination: {
                    total,
                    limit,
                    offset,
                    has_more: offset + limit < total
                }
            });
        } catch (error) {
            console.error('[API ERROR] GET /api/leaderboard:', error);
            res.status(500).json({ error: '獲取排行榜數據失敗' });
        }
    });

    // 新增：獲取當前用戶在特定排行榜上的排名
    cookGameApp.get('/api/leaderboard/my-rank', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.userId;
            const sortBy = req.query.sort_by || 'points';

            // 驗證排序欄位
            const validSortFields = ['points', 'level', 'games_played', 'orders_completed'];
            const safeSort = validSortFields.includes(sortBy) ? sortBy : 'points';

            // 使用窗口函數 RANK() 來計算排名
            const query = `
                WITH user_ranks AS (
                    SELECT 
                        cp.user_id,
                        RANK() OVER (ORDER BY cp.${safeSort} DESC) as rank
                    FROM 
                        cook_players cp
                )
                SELECT 
                    ur.rank,
                    cp.level,
                    cp.points,
                    cp.games_played,
                    cp.orders_completed,
                    bu.display_name,
                    bu.user_profile_image_url as profile_image
                FROM 
                    cook_players cp
                JOIN 
                    user_ranks ur ON cp.user_id = ur.user_id
                LEFT JOIN 
                    box_users bu ON cp.user_id = bu.user_id
                WHERE 
                    cp.user_id = $1
            `;

            const result = await pool.query(query, [userId]);

            if (result.rows.length > 0) {
                res.json({ success: true, myRank: result.rows[0] });
            } else {
                // 如果玩家在 cook_players 中沒有記錄
                res.status(404).json({ success: false, message: '找不到玩家排名數據' });
            }
        } catch (error) {
            console.error('[API ERROR] GET /api/leaderboard/my-rank:', error);
            res.status(500).json({ success: false, error: '獲取個人排名失敗' });
        }
    });

// 獲取用戶稱號列表
cookGameApp.get('/api/user/titles', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.userId;
        
        // 獲取用戶解鎖的所有稱號
        const result = await pool.query(`
            SELECT ct.*, cut.is_equipped, cut.unlocked_at
            FROM cook_titles ct
            JOIN cook_user_titles cut ON ct.id = cut.title_id
            WHERE cut.user_id = $1
            ORDER BY cut.is_equipped DESC, ct.rarity DESC, ct.title_name ASC
        `, [userId]);
        
        res.json({ success: true, titles: result.rows });
        } catch (error) {
        console.error('獲取用戶稱號時出錯:', error);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// 設置當前使用的稱號
cookGameApp.post('/api/user/titles/:titleId/equip', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const userId = req.user.userId;
        const titleId = req.params.titleId;
        
        // 先將用戶所有稱號設為未裝備
        await client.query(`
            UPDATE cook_user_titles
            SET is_equipped = FALSE
            WHERE user_id = $1
        `, [userId]);
        
        // 設置選中的稱號為裝備中
        const result = await client.query(`
            UPDATE cook_user_titles
            SET is_equipped = TRUE
            WHERE user_id = $1 AND title_id = $2
            RETURNING *
        `, [userId, titleId]);
        
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: '找不到指定稱號或您尚未解鎖該稱號' });
        }
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: '稱號已成功設置' });
        } catch (error) {
        await client.query('ROLLBACK');
        console.error('設置用戶稱號時出錯:', error);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    } finally {
        client.release();
    }
});

// 管理員API - 獲取所有稱號
cookGameApp.get('/admin/titles', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cook_titles ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('獲取稱號列表時出錯:', error);
        res.status(500).json({ success: false, error: '無法獲取稱號列表' });
    }
});

// 管理員API - 新增或更新稱號
cookGameApp.post('/admin/titles', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id, title_id, title_name, title_description, rarity, unlock_condition, unlock_value, icon_url, color_code, is_active } = req.body;
        
        let result;
        
        if (id) {
            result = await pool.query(`
                UPDATE cook_titles
                SET title_id = $1, title_name = $2, title_description = $3, rarity = $4, 
                    unlock_condition = $5, unlock_value = $6, icon_url = $7, color_code = $8, is_active = $9
                WHERE id = $10
                RETURNING *
            `, [title_id, title_name, title_description, rarity, unlock_condition, unlock_value, icon_url, color_code, is_active, id]);
        } else {
            result = await pool.query(`
                INSERT INTO cook_titles (title_id, title_name, title_description, rarity, unlock_condition, unlock_value, icon_url, color_code)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [title_id, title_name, title_description, rarity, unlock_condition, unlock_value, icon_url, color_code]);
        }
        
        res.json({ success: true, title: result.rows[0] });
    } catch (error) {
        console.error('新增或更新稱號時出錯:', error);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});



/**
 * 檢查用戶是否符合稱號解鎖條件並自動解鎖
 * @param {string} userId - 用戶ID
 * @returns {Promise<Array>} 新解鎖的稱號列表
 */
async function checkTitleUnlocks(userId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 獲取用戶遊戲數據
        const playerResult = await client.query(`
            SELECT level, points, games_played, orders_completed
            FROM cook_players 
            WHERE user_id = $1
        `, [userId]);
        
        if (playerResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return [];
        }
        
        const player = playerResult.rows[0];
        
        // 獲取用戶尚未解鎖的稱號
        const titlesResult = await client.query(`
            SELECT t.* 
            FROM cook_titles t
            LEFT JOIN cook_user_titles ut ON t.id = ut.title_id AND ut.user_id = $1
            WHERE ut.id IS NULL AND t.is_active = TRUE
        `, [userId]);
        
        const unlockedTitles = [];
        
        // 檢查每個稱號的解鎖條件
        for (const title of titlesResult.rows) {
            let isUnlocked = false;
            
            switch (title.unlock_condition) {
                case 'level':
                    isUnlocked = player.level >= title.unlock_value;
                    break;
                case 'points':
                    isUnlocked = player.points >= title.unlock_value;
                    break;
                case 'games_played':
                    isUnlocked = player.games_played >= title.unlock_value;
                    break;
                case 'orders_completed':
                    isUnlocked = player.orders_completed >= title.unlock_value;
                    break;
                // 可以添加更多解鎖條件
            }
            
            if (isUnlocked) {
                // 解鎖稱號
                await client.query(`
                    INSERT INTO cook_user_titles (user_id, title_id, unlocked_at)
                    VALUES ($1, $2, NOW())
                `, [userId, title.id]);
                
                unlockedTitles.push(title);
            }
        }
        
        await client.query('COMMIT');
        return unlockedTitles;
        } catch (error) {
        await client.query('ROLLBACK');
        console.error('檢查稱號解鎖時出錯:', error);
        return [];
    } finally {
        client.release();
    }
}

    
    
    // 後台管理 API - 任務模板管理
    cookGameApp.get('/admin/quest-templates', authenticateToken, isAdmin, async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM cook_quest_templates ORDER BY id ASC');
            res.json(result.rows);
        } catch (error) {
            console.error('獲取任務模板列表時出錯:', error);
            res.status(500).json({ success: false, error: '無法獲取任務模板列表' });
        }
    });
    
    // API: 新增或更新任務模板 (管理員專用)
    cookGameApp.post('/admin/quest-templates', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { id, quest_type, description, base_target, reward_points, is_daily } = req.body;
            
            if (!quest_type || !description || !base_target || !reward_points) {
                return res.status(400).json({ success: false, error: '缺少必要參數' });
            }
            
            let result;
            
            // 如果提供了ID，則更新現有模板
            if (id) {
                result = await pool.query(`
                    UPDATE cook_quest_templates
                    SET quest_type = $1, description = $2, base_target = $3, reward_points = $4, is_daily = $5
                    WHERE id = $6
                    RETURNING *
                `, [quest_type, description, base_target, reward_points, is_daily || false, id]);
                
                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, error: '找不到指定的任務模板' });
                }
            } 
            // 否則創建新模板
            else {
                result = await pool.query(`
                    INSERT INTO cook_quest_templates (quest_type, description, base_target, reward_points, is_daily)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING *
                `, [quest_type, description, base_target, reward_points, is_daily || false]);
            }
            
            res.json({ success: true, template: result.rows[0] });
            
        } catch (error) {
            console.error('新增或更新任務模板時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤' });
        }
    });

    // 管理員API - 獲取所有食譜
    cookGameApp.get('/cook-api/admin/all-recipes', isAdmin, async (req, res) => {
        try {
            const query = `
                SELECT r.*, i.item_name as output_item_name
                FROM cook_recipes_v2 r
                JOIN cook_items i ON r.output_item_id = i.id
                ORDER BY r.id ASC
            `;
            const recipesResult = await pool.query(query);
            const recipes = recipesResult.rows;

            // 為每個食譜添加需求物品
            for (let recipe of recipes) {
                const reqQuery = `
                    SELECT rr.*, i.item_name, i.item_id
                    FROM cook_recipe_requirements_v2 rr
                    JOIN cook_items i ON rr.required_item_id = i.id
                    WHERE rr.recipe_id = $1
                `;
                const reqResult = await pool.query(reqQuery, [recipe.id]);
                recipe.requirements = reqResult.rows;
                recipe.recipe_db_id = recipe.id; // 添加一個明確的數據庫ID字段
            }

            res.json(recipes);
        } catch (error) {
            console.error('Error fetching all recipes:', error);
            res.status(500).json({ error: 'Failed to fetch recipes' });
        }
    });
     


// API: 獲取管理後台儀表板數據
cookGameApp.get('/admin/dashboard', authenticateToken, isAdmin, async (req, res) => {
    try {
        // 獲取用戶數量
        const userCountResult = await pool.query('SELECT COUNT(*) as count FROM cook_players');
        const userCount = parseInt(userCountResult.rows[0].count);
        
        // 獲取遊戲場次數量
        const gameCountResult = await pool.query(`
            SELECT COUNT(*) as count 
            FROM cook_game_rooms 
            WHERE status = 'finished'
        `);
        const gameCount = parseInt(gameCountResult.rows[0].count);
        
        // 獲取稱號數量
        const titleCountResult = await pool.query('SELECT COUNT(*) as count FROM cook_titles');
        const titleCount = parseInt(titleCountResult.rows[0].count);
        
        // 獲取物品數量
        const itemCountResult = await pool.query('SELECT COUNT(*) as count FROM cook_items');
        const itemCount = parseInt(itemCountResult.rows[0].count);
        
        // 獲取最近活動
        const recentActivitiesResult = await pool.query(`
            SELECT * FROM (
                SELECT 'user_login' as type, 'User login' as description, last_login as timestamp, username
                FROM cook_players
                WHERE last_login IS NOT NULL
                UNION ALL
                SELECT 'game_completed' as type, 'Game completed' as description, updated_at as timestamp, creator_name as username
                FROM cook_game_rooms
                WHERE status = 'finished'
                UNION ALL
                SELECT 'title_unlocked' as type, 'Title unlocked' as description, unlocked_at as timestamp, u.username
                FROM cook_user_titles ut
                JOIN box_users u ON ut.user_id = u.user_id
                ORDER BY timestamp DESC
                LIMIT 10
            ) as activities
            ORDER BY timestamp DESC
            LIMIT 10
        `);
        
        // 格式化活動數據
        const recentActivities = recentActivitiesResult.rows.map(activity => {
            let description = '';
            
            switch (activity.type) {
                case 'user_login':
                    description = `${activity.username} 登入了遊戲`;
                    break;
                case 'game_completed':
                    description = `${activity.username} 完成了一場遊戲`;
                    break;
                case 'title_unlocked':
                    description = `${activity.username} 解鎖了一個稱號`;
                    break;
                default:
                    description = activity.description;
            }
            
            return {
                type: activity.type,
                description: description,
                timestamp: activity.timestamp
            };
        });
        
        res.json({
            userCount,
            gameCount,
            titleCount,
            itemCount,
            recentActivities
        });
        } catch (error) {
        console.error('獲取儀表板數據時出錯:', error);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

    // =================================================================
    // ★ 新增管理後端 API (Admin Backend API) V3 - for new recipe admin
    // =================================================================

    // 新增：創建新物品
    cookGameApp.post('/admin/items', authenticateToken, isAdmin, async (req, res) => {
        const { item_id, item_name, item_type, description, icon, is_sellable, sell_price, is_base_ingredient } = req.body;

        if (!item_id || !item_name || !item_type) {
            return res.status(400).json({ success: false, message: '物品ID、名稱和類型為必填項' });
        }

        try {
            const newItem = await pool.query(
                `INSERT INTO cook_items (item_id, item_name, item_type, description, icon, is_sellable, sell_price, is_base_ingredient)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [item_id, item_name, item_type, description, icon, is_sellable || false, sell_price || 0, is_base_ingredient || false]
            );
            res.status(201).json({ success: true, message: '物品創建成功', item: newItem.rows[0] });
        } catch (error) {
            console.error('Error creating new item:', error);
            if (error.code === '23505') { // Unique violation
                return res.status(409).json({ success: false, message: '物品ID已存在' });
            }
            res.status(500).json({ success: false, message: '創建物品時發生內部錯誤' });
        }
    });

    // 新增：創建新食譜 (Wizard)
    cookGameApp.post('/admin/recipes', authenticateToken, isAdmin, async (req, res) => {
        const {
            recipe_id,
            recipe_name,
            station_type,
            output_item_id,
            cooking_time_ms,
            is_orderable,
            difficulty,
            description,
            requirements
        } = req.body;

        if (!recipe_id || !recipe_name || !station_type || !output_item_id || !requirements || requirements.length === 0) {
            return res.status(400).json({ success: false, message: '缺少必要的食譜信息' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const recipeInsertQuery = `
                INSERT INTO cook_recipes_v2 (recipe_id, recipe_name, station_type, output_item_id, cooking_time_ms, is_orderable, difficulty, description)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `;
            const recipeResult = await client.query(recipeInsertQuery, [
                recipe_id, recipe_name, station_type, output_item_id, cooking_time_ms || 0, is_orderable, difficulty, description
            ]);
            const newRecipeId = recipeResult.rows[0].id;

            const requirementInsertQuery = `
                INSERT INTO cook_recipe_requirements_v2 (recipe_id, required_item_id, quantity)
                VALUES ($1, $2, $3)
            `;
            for (const req of requirements) {
                await client.query(requirementInsertQuery, [newRecipeId, req.required_item_id, req.quantity]);
            }

            await client.query('COMMIT');
            res.status(201).json({ success: true, message: '食譜創建成功', recipe_id: newRecipeId });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error creating new recipe:', error);
             if (error.code === '23505') { // Unique violation on recipe_id
                return res.status(409).json({ success: false, message: '食譜ID已存在' });
            }
            res.status(500).json({ success: false, message: '創建食譜時發生內部錯誤' });
        } finally {
            client.release();
        }
    });

    // 更新食譜 (增強版，使用 PUT 和 :id)
    cookGameApp.put('/admin/recipes/:id', authenticateToken, isAdmin, async (req, res) => {
        const recipeId = parseInt(req.params.id, 10);
        const {
            recipe_name,
            difficulty,
            is_orderable,
            description,
            station_type,
            output_item_id,
            cooking_time_ms,
            requirements
        } = req.body;

        if (isNaN(recipeId)) {
            return res.status(400).json({ success: false, message: '無效的食譜ID' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. 更新 cook_recipes_v2 表
            const updateRecipeQuery = `
                UPDATE cook_recipes_v2
                SET 
                    recipe_name = $1, 
                    difficulty = $2, 
                    is_orderable = $3,
                    description = $4,
                    station_type = $5,
                    output_item_id = $6,
                    cooking_time_ms = $7
                WHERE id = $8
            `;
            await client.query(updateRecipeQuery, [
                recipe_name, difficulty, is_orderable, description, station_type, output_item_id, cooking_time_ms, recipeId
            ]);

            // 2. 刪除舊的 requirements
            await client.query('DELETE FROM cook_recipe_requirements_v2 WHERE recipe_id = $1', [recipeId]);

            // 3. 插入新的 requirements
            if (requirements && requirements.length > 0) {
                const requirementInsertQuery = `
                    INSERT INTO cook_recipe_requirements_v2 (recipe_id, required_item_id, quantity)
                    VALUES ($1, $2, $3)
                `;
                for (const req of requirements) {
                    await client.query(requirementInsertQuery, [recipeId, req.required_item_id, req.quantity]);
                }
            }

            await client.query('COMMIT');
            res.json({ success: true, message: '食譜更新成功' });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error updating recipe ${recipeId}:`, error);
            res.status(500).json({ success: false, message: '更新食譜失敗' });
        } finally {
            client.release();
        }
    });

    // 刪除食譜 (安全版，使用 DELETE 和 :id，並使用事務)
    cookGameApp.delete('/admin/recipes/:id', authenticateToken, isAdmin, async (req, res) => {
        const recipeId = parseInt(req.params.id, 10);
        if (isNaN(recipeId)) {
            return res.status(400).json({ success: false, message: '無效的食譜ID' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // First, delete dependencies in cook_recipe_requirements_v2
            await client.query('DELETE FROM cook_recipe_requirements_v2 WHERE recipe_id = $1', [recipeId]);
            
            // Then, delete the recipe from cook_recipes_v2
            const deleteResult = await client.query('DELETE FROM cook_recipes_v2 WHERE id = $1', [recipeId]);

            if (deleteResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: '找不到要刪除的食譜' });
            }

            await client.query('COMMIT');
            res.json({ success: true, message: '食譜已成功刪除' });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error deleting recipe ${recipeId}:`, error);
            res.status(500).json({ success: false, message: '刪除食譜失敗' });
        } finally {
            client.release();
        }
    });


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

    // =================================================================
    // ★★★ API 路由 ★★★
    // =================================================================

    // 最後，返回 Express app 和 WebSocket 處理函數
    return {
        cookGameApp,
        initCookGameWss
    };
};

// =================================================================
// 遊戲公開資訊 API (無需驗證)
// =================================================================

// 新增：獲取等級獎勵列表
cookGameApp.get('/cook-api/level-rewards', async (req, res) => {
    try {
        // 從資料庫獲取所有等級設定
        const levelsResult = await pool.query('SELECT * FROM cook_level_settings ORDER BY level ASC');
        if (levelsResult.rows.length === 0) {
            return res.status(404).json({ message: '找不到等級設定資訊' });
        }

        const rewardsByLevel = [];
        for (const levelSetting of levelsResult.rows) {
            const unlockedItems = [];
            // 獲取該等級解鎖的物品
            if (levelSetting.unlocks && levelSetting.unlocks.item_ids) {
                for (const itemId of levelSetting.unlocks.item_ids) {
                    const itemResult = await pool.query('SELECT item_id, item_name, symbol FROM cook_items WHERE item_id = $1', [itemId]);
                    if (itemResult.rows[0]) {
                        unlockedItems.push({ ...itemResult.rows[0], type: 'item' });
                    }
                }
            }
            // 獲取該等級解鎖的食譜
            if (levelSetting.unlocks && levelSetting.unlocks.recipe_ids) {
                 for (const recipeId of levelSetting.unlocks.recipe_ids) {
                    const recipeResult = await pool.query(
                        `SELECT 
                            r.recipe_id, 
                            r.recipe_name, 
                            i.symbol
                         FROM cook_recipes_v2 r
                         LEFT JOIN cook_items i ON r.output_item_id = i.id
                         WHERE r.recipe_id = $1`, [recipeId]
                    );
                    if (recipeResult.rows[0]) {
                        unlockedItems.push({ 
                            id: recipeResult.rows[0].recipe_id,
                            name: recipeResult.rows[0].recipe_name,
                            symbol: recipeResult.rows[0].symbol,
                            type: 'recipe'
                        });
                    }
                }
            }
            rewardsByLevel.push({
                level: levelSetting.level,
                exp_required: levelSetting.exp_required,
                unlocks: unlockedItems
            });
        }
        res.json(rewardsByLevel);
    } catch (error) {
        console.error('獲取等級獎勵時出錯:', error);
        res.status(500).json({ message: '伺服器內部錯誤' });
    }
});

// =================================================================
// 管理員專用 API (需要管理員權限)
// =================================================================