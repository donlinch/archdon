// cook-kitchen-rush.js
// 料理急先鋒遊戲伺服器模組

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const cors = require('cors');
const { Pool } = require('pg');

// =================================================================
//  診斷函數：查詢特定食譜的結構 (新增於 2025-07-08)
// =================================================================
async function diagnoseRecipeStructure(pool) {
    
    
    try {
        const client = await pool.connect();
        const recipeNameToFind = 'make_seafood_pasta';
        
 
        const query = 'SELECT * FROM cook_recipes_v3 WHERE recipe_id = $1 LIMIT 1';
        const result = await client.query(query, [recipeNameToFind]);

        if (result.rows.length > 0) {
            const recipeData = result.rows[0];
            
            for (const key in recipeData) {
                const value = recipeData[key];
                const valueType = typeof value;
                const valueContent = JSON.stringify(value);
             }
         } else {
            console.log(`[DIAGNOSE] ⚠️ 警告: 未找到 recipe_id 為 '${recipeNameToFind}' 的食譜。`);
        }
        client.release();
    } catch (error) {
        console.error(`[DIAGNOSE] ❌ 診斷過程中發生錯誤: ${error.message}`);
        if (error.code === '42P01') {
             console.error('[DIAGNOSE] 錯誤提示: "cook_recipes_v3" 資料表不存在。');
        }
    } finally {
       
    }
}

// 創建遊戲的Express應用實例
function initializeCookGame(pool) {
    // 在伺服器初始化時，立即執行診斷函數
    diagnoseRecipeStructure(pool).catch(err => {
        console.error('[DIAGNOSE] 執行診斷函數時發生未處理的錯誤:', err);
    });

    const cookGameApp = express();
    cookGameApp.use(express.json());
    cookGameApp.use(cors());
    
    // 身份驗證中間件
    const authenticateToken = (req, res, next) => {
        console.log(`\n[LOG] >>> authenticateToken --- 收到請求: ${req.method} ${req.originalUrl}`);
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('[LOG] authenticateToken - 認證失敗: 未提供令牌或格式不正確。');
            return res.status(401).json({ error: '未提供認證令牌' });
        }

        const token = authHeader.split(' ')[1];
        console.log(`[LOG] authenticateToken - 收到令牌: ${token.substring(0, 15)}...`);
          
        jwt.verify(token, process.env.BOX_JWT_SECRET, (err, user) => {
            if (err) {
                console.error(`[LOG] authenticateToken - 令牌驗證失敗: ${err.message}`);
                return res.status(403).json({ error: '令牌無效或已過期' });
            }
            console.log('[LOG] authenticateToken - 令牌驗證成功，用戶:', user);
            req.user = user;
            next();
        });
    };

    // 管理員權限中間件
    const isAdmin = async (req, res, next) => {
        // =================================================================
        //            ★★★ 緊急覆蓋：暫時跳過所有權限檢查 ★★★
        // =================================================================
        // 說明：為了除錯 Render 部署問題，此函式已被臨時修改。
        //       它現在會無條件地允許所有通過 authenticateToken 的請求，
        //       並在日誌中印出一條獨特的訊息以供識別。
        //       問題解決後，請務必恢復原有的權限檢查邏輯。
        // =================================================================

        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.log('>>> NEW isAdmin DEPLOYED! SKIPPING ALL CHECKS! <<<');
        console.log(`> Request for user: ${req.user?.user_id} (${req.user?.username}) to path: ${req.path}`);
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');

        // 無條件放行
        next();
    };

    // 管理員API - 獲取所有稱號
    cookGameApp.get('/admin/titles', authenticateToken, isAdmin, async (req, res) => {
        try {
            console.log('\n=== 獲取稱號列表 ===');
            console.log('執行SQL查詢: SELECT * FROM cook_titles ORDER BY id ASC');
            
            const result = await pool.query('SELECT * FROM cook_titles ORDER BY id ASC');
            
            console.log('查詢結果:', {
                rowCount: result.rowCount,
                firstRow: result.rows.length > 0 ? result.rows[0] : null,
                lastRow: result.rows.length > 0 ? result.rows[result.rows.length - 1] : null
            });
            
            res.json(result.rows);
        } catch (error) {
            console.error('獲取稱號列表時出錯:', error);
            console.error('錯誤詳情:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
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

    // 管理員API - 獲取稱號詳情
    cookGameApp.get('/admin/titles/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query('SELECT * FROM cook_titles WHERE id = $1', [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: '找不到指定的稱號' });
            }
            
            res.json(result.rows[0]);
        } catch (error) {
            console.error('獲取稱號詳情時出錯:', error);
            res.status(500).json({ success: false, error: '無法獲取稱號詳情' });
        }
    });

    // 管理員API - 刪除稱號
    cookGameApp.delete('/admin/titles/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query('DELETE FROM cook_titles WHERE id = $1 RETURNING *', [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: '找不到指定的稱號' });
            }
            
            res.json({ success: true, message: '稱號已成功刪除' });
        } catch (error) {
            console.error('刪除稱號時出錯:', error);
            res.status(500).json({ success: false, error: '無法刪除稱號' });
        }
    });

    // 管理員API - 獲取指定玩家資料
    cookGameApp.get('/admin/player/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            console.log(`\n=== 獲取玩家 ${id} 的資料 ===`);

            const result = await pool.query(`
                SELECT 
                    p.player_id,
                    p.user_id, 
                    p.level, 
                    p.points, 
                    p.games_played, 
                    p.orders_completed,
                    u.username,
                    u.display_name
                FROM cook_players p
                JOIN box_users u ON p.user_id = u.user_id
                WHERE p.player_id = $1
            `, [id]);

            if (result.rows.length === 0) {
                console.log(`找不到 player_id 為 ${id} 的玩家`);
                return res.status(404).json({ success: false, error: '找不到指定的玩家' });
            }
            
            console.log('查詢結果:', result.rows[0]);
            res.json(result.rows[0]);
        } catch (error) {
            console.error(`獲取玩家 ${id} 資料時出錯:`, error);
            res.status(500).json({ success: false, error: '無法獲取玩家資料' });
        }
    });

    // #region V3 API
    // 獲取所有 V3 物品
    cookGameApp.get('/v3/items', authenticateToken, isAdmin, async (req, res) => {
        try {
            console.log('\n=== [V3] 獲取物品列表 ===');
            const result = await pool.query('SELECT * FROM cook_items_v3 ORDER BY item_tier, item_name');
            res.json(result.rows);
        } catch (error) {
            console.error('[V3] 獲取物品列表時出錯:', error);
            res.status(500).json({ success: false, message: '伺服器錯誤' });
        }
    });

    // 新增 V3 物品
    cookGameApp.post('/v3/items', authenticateToken, isAdmin, async (req, res) => {
        const { item_id, item_name, ascii_symbol, item_tier, base_points, category } = req.body;
        try {
            const result = await pool.query(`
                INSERT INTO cook_items_v3 (item_id, item_name, ascii_symbol, item_tier, base_points, category)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *;
            `, [item_id, item_name, ascii_symbol, item_tier, base_points, category]);
            
            res.status(201).json({ success: true, item: result.rows[0] });
        } catch (error) {
            console.error('[V3] 新增物品時出錯:', error);
            if (error.code === '23505') { // unique_violation
                return res.status(409).json({ success: false, message: `物品ID '${item_id}' 已存在。` });
            }
            res.status(500).json({ success: false, message: '伺服器錯誤', details: error.message });
        }
    });

    // 更新 V3 物品
    cookGameApp.put('/v3/items/:itemId', authenticateToken, isAdmin, async (req, res) => {
        const { itemId } = req.params;
        const { item_name, ascii_symbol, base_points, category } = req.body;
        try {
            const result = await pool.query(`
                UPDATE cook_items_v3 SET
                    item_name = $1,
                    ascii_symbol = $2,
                    base_points = $3,
                    category = $4
                WHERE item_id = $5
                RETURNING *;
            `, [item_name, ascii_symbol, base_points, category, itemId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: '找不到要更新的物品' });
            }
            res.json({ success: true, item: result.rows[0] });
        } catch (error) {
            console.error(`[V3] 更新物品 ${itemId} 時出錯:`, error);
            res.status(500).json({ success: false, message: '伺服器錯誤', details: error.message });
        }
    });

    // 獲取所有 V3 食譜
    cookGameApp.get('/v3/recipes', authenticateToken, isAdmin, async (req, res) => {
        try {
            console.log('\n=== [V3] 獲取食譜列表 ===');
            const result = await pool.query(`
                SELECT 
                    r.id,
                    r.recipe_id,
                    r.recipe_name,
                    i.item_id AS output_item_id,
                    r.cooking_method,
                    r.requirements,
                    r.cook_time_sec
                FROM cook_recipes_v3 r
                JOIN cook_items_v3 i ON r.output_item_id = i.id
                ORDER BY r.recipe_name
            `);
            res.json(result.rows);
        } catch (error) {
            console.error('[V3] 獲取食譜列表時出錯:', error);
            res.status(500).json({ success: false, message: '伺服器錯誤' });
        }
    });

    // 新增 V3 食譜
    cookGameApp.post('/v3/recipes', authenticateToken, isAdmin, async (req, res) => {
        const { recipe_id, recipe_name, output_item_id, cooking_method, requirements, cook_time_sec } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // --- V3 規則驗證 ---
            const outputItemRes = await client.query('SELECT id, item_tier FROM cook_items_v3 WHERE item_id = $1', [output_item_id]);
            if (outputItemRes.rows.length === 0) throw new Error(`產出物品 ID '${output_item_id}' 不存在。`);
            const outputDbId = outputItemRes.rows[0].id;
            const outputTier = outputItemRes.rows[0].item_tier;
            if (outputTier === 0) throw new Error('T0 基礎食材不能作為食譜的產出。');

            if (requirements && requirements.length > 0) {
                const requirementIds = requirements.map(r => r.item_id);
                const reqItemsRes = await client.query('SELECT item_id, item_tier FROM cook_items_v3 WHERE item_id = ANY($1::text[])', [requirementIds]);
                const reqItemsMap = new Map(reqItemsRes.rows.map(item => [item.item_id, item.item_tier]));

                for (const req of requirements) {
                    const reqTier = reqItemsMap.get(req.item_id);
                    if (reqTier === undefined) throw new Error(`需求物品 ID '${req.item_id}' 不存在。`);
                    if (outputTier === 1 && reqTier !== 0) throw new Error(`T1 食譜只能使用 T0 材料。`);
                    if (reqTier >= outputTier) throw new Error(`食譜 "${recipe_name}" 不符合層級規則：T${outputTier} 產出的需求物(T${reqTier})層級不能更高或相等。`);
                }
            }
            // --- 驗證結束 ---

            const requirementsJson = JSON.stringify(requirements || []);

            const result = await client.query(`
                INSERT INTO cook_recipes_v3 (recipe_id, recipe_name, output_item_id, cooking_method, requirements, cook_time_sec)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *;
            `, [recipe_id, recipe_name, outputDbId, cooking_method, requirementsJson, cook_time_sec]);

            await client.query('COMMIT');
            res.status(201).json({ success: true, recipe: result.rows[0] });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[V3] 新增食譜時出錯:', error);
            if (error.code === '23505') { // unique_violation for recipe_id
                return res.status(409).json({ success: false, message: `食譜ID '${recipe_id}' 已存在。` });
            }
            res.status(400).json({ success: false, message: error.message });
        } finally {
            client.release();
        }
    });

    // 更新 V3 食譜
    cookGameApp.put('/v3/recipes/:recipeId', authenticateToken, isAdmin, async (req, res) => {
        const { recipeId } = req.params;
        const { recipe_name, output_item_id, cooking_method, requirements, cook_time_sec } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // --- V3 規則驗證 ---
            const outputItemRes = await client.query('SELECT item_tier FROM cook_items_v3 WHERE item_id = $1', [output_item_id]);
            if (outputItemRes.rows.length === 0) throw new Error(`產出物品 ID '${output_item_id}' 不存在。`);
            const outputTier = outputItemRes.rows[0].item_tier;

            if (requirements && requirements.length > 0) {
                const requirementIds = requirements.map(r => r.item_id);
                const reqItemsRes = await client.query('SELECT item_id, item_tier FROM cook_items_v3 WHERE item_id = ANY($1::text[])', [requirementIds]);
                const reqItemsMap = new Map(reqItemsRes.rows.map(item => [item.item_id, item.item_tier]));

                for (const req of requirements) {
                    const reqTier = reqItemsMap.get(req.item_id);
                    if (reqTier === undefined) throw new Error(`需求物品 ID '${req.item_id}' 不存在。`);
                    if (outputTier === 1 && reqTier !== 0) throw new Error(`T1 食譜只能使用 T0 材料。`);
                    if (reqTier >= outputTier) throw new Error(`食譜 "${recipe_name}" 不符合層級規則：T${outputTier} 產出的需求物(T${reqTier})層級不能更高或相等。`);
                }
            }
            // --- 驗證結束 ---

            const requirementsJson = JSON.stringify(requirements || []);

            const result = await client.query(`
                UPDATE cook_recipes_v3 SET
                    recipe_name = $1,
                    cooking_method = $2,
                    requirements = $3,
                    cook_time_sec = $4
                WHERE recipe_id = $5
                RETURNING *;
            `, [recipe_name, cooking_method, requirementsJson, cook_time_sec, recipeId]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: '找不到要更新的食譜' });
            }

            await client.query('COMMIT');
            res.json({ success: true, recipe: result.rows[0] });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`[V3] 更新食譜 ${recipeId} 時出錯:`, error);
            res.status(400).json({ success: false, message: error.message });
        } finally {
            client.release();
        }
    });
    // #endregion V3 API

    // 管理員API - 初始化稱號資料表
    cookGameApp.post('/admin/initialize-titles', authenticateToken, isAdmin, async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 檢查資料表是否已存在
            const checkResult = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'cook_titles'
                );
            `);
            const tableExists = checkResult.rows[0].exists;

            let titlesCreated = 0;

            // 如果資料表不存在，創建它並插入初始資料
            if (!tableExists) {
                await client.query(`
                    CREATE TABLE cook_titles (
                        id SERIAL PRIMARY KEY,
                        title_id VARCHAR(255) UNIQUE NOT NULL,
                        title_name VARCHAR(255) NOT NULL,
                        title_description TEXT,
                        rarity VARCHAR(50) NOT NULL DEFAULT 'common',
                        unlock_condition VARCHAR(100) NOT NULL,
                        unlock_value INTEGER NOT NULL,
                        icon_url TEXT,
                        color_code VARCHAR(20) DEFAULT '#FFFFFF',
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
                
                // 創建關聯表
                await client.query(`
                    CREATE TABLE IF NOT EXISTS cook_user_titles (
                        id SERIAL PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        title_id INTEGER NOT NULL REFERENCES cook_titles(id) ON DELETE CASCADE,
                        is_selected BOOLEAN DEFAULT FALSE,
                        unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, title_id)
                    );
                `);

                console.log('成功創建稱號相關資料表');

                // 插入 10 筆初始的稱號資料
                const insertResult = await client.query(`
                    INSERT INTO cook_titles (title_id, title_name, title_description, rarity, unlock_condition, unlock_value, color_code)
                    VALUES
                        ('novice_chef', '新手廚師', '剛開始學習烹飪的新手', 'common', 'level', 1, '#AAAAAA'),
                        ('apprentice_chef', '學徒廚師', '已有一定烹飪經驗的學徒', 'common', 'level', 5, '#FFFFFF'),
                        ('line_cook', '廚房小廚', '能夠熟練處理基本料理的廚師', 'uncommon', 'level', 10, '#77CCFF'),
                        ('sous_chef', '副主廚', '能夠協助管理廚房的資深廚師', 'rare', 'level', 20, '#AA77FF'),
                        ('head_chef', '主廚', '廚房的指揮官，擁有卓越的烹飪技巧', 'epic', 'level', 30, '#FFCC00'),
                        ('master_chef', '大廚師長', '頂尖的廚藝大師，無人能敵', 'legendary', 'level', 50, '#FF5522'),
                        ('kitchen_rookie', '廚房新秀', '剛開始在廚房工作的新手', 'common', 'games_played', 5, '#AAFFAA'),
                        ('kitchen_veteran', '廚房老手', '在廚房工作多年的資深廚師', 'rare', 'games_played', 100, '#AA77FF'),
                        ('order_expert', '訂單專家', '完成大量訂單的專家', 'epic', 'orders_completed', 500, '#FFAA22'),
                        ('point_collector', '積分收集者', '累積大量積分的玩家', 'rare', 'points', 10000, '#22CCFF');
                `);
                titlesCreated = insertResult.rowCount;
            }

            await client.query('COMMIT');
            res.json({ success: true, message: `成功初始化資料庫。${titlesCreated > 0 ? `已創建 ${titlesCreated} 個預設稱號。` : '資料表已存在，未作變更。'}` });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('初始化稱號資料表時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤', details: error.message });
        } finally {
            client.release();
        }
    });

    // 管理員API - 獲取 V2 食譜列表
    cookGameApp.get('/admin/recipes-v2', authenticateToken, isAdmin, async (req, res) => {
        try {
            console.log('\n=== 獲取 V2 食譜列表 (cook_recipes_v2) ===');

            // 查詢食譜，並JOIN cook_items 以獲取產出物品的名稱
            const recipesResult = await pool.query(`
                SELECT
                    r.recipe_id,
                    r.recipe_name,
                    r.output_item_id,
                    i.item_name AS output_item_name,
                    r.cooking_method
                FROM cook_recipes_v2 r
                LEFT JOIN cook_items i ON r.output_item_id = i.id
                ORDER BY r.recipe_id ASC
            `);
            console.log('食譜查詢結果:', recipesResult.rows);

            // 查詢所有需求，並JOIN cook_items 以獲取需求物品的名稱
            const requirementsResult = await pool.query(`
                SELECT 
                    req.recipe_id,
                    req.required_item_id,
                    req.quantity,
                    i.item_name AS required_item_name
                FROM cook_recipe_requirements_v2 req
                JOIN cook_items i ON req.required_item_id = i.id
            `);
            console.log('需求查詢結果:', requirementsResult.rows);

            const requirementsMap = {};
            for (const req of requirementsResult.rows) {
                if (!requirementsMap[req.recipe_id]) {
                    requirementsMap[req.recipe_id] = [];
                }
                requirementsMap[req.recipe_id].push({
                    item_id: req.required_item_id,
                    item_name: req.required_item_name,
                    quantity: req.quantity
                });
            }
            console.log('需求映射:', requirementsMap);

            const recipes = recipesResult.rows.map(recipe => {
                const recipeWithReqs = {
                    ...recipe,
                    requirements: requirementsMap[recipe.recipe_id] || []
                };
                console.log(`食譜 ${recipe.recipe_id} 的需求:`, recipeWithReqs.requirements);
                return recipeWithReqs;
            });

            console.log(`查詢到 ${recipes.length} 個 V2 食譜`);
            res.json(recipes);
        } catch (error) {
            console.error('獲取 V2 食譜列表時出錯:', error);
            res.status(500).json({ success: false, error: '無法獲取 V2 食譜列表' });
        }
    });

    // 管理員API - 新增或更新 V2 食譜
    cookGameApp.post('/admin/recipes-v2', authenticateToken, isAdmin, async (req, res) => {
        const { recipe_id, recipe_name, output_item_id, cooking_method, requirements } = req.body;
        console.log('\n=== 新增/更新 V2 食譜 ===');
        console.log('請求數據:', req.body);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let recipeResult;

            // 檢查是否已存在相同的 recipe_id
            const existingRecipe = await client.query(
                'SELECT recipe_id FROM cook_recipes_v2 WHERE recipe_id = $1',
                [recipe_id]
            );

            if (existingRecipe.rows.length > 0) {
                // 更新現有食譜
                console.log(`更新食譜 ID: ${recipe_id}`);
                recipeResult = await client.query(`
                    UPDATE cook_recipes_v2
                    SET recipe_name = $1, output_item_id = $2, cooking_method = $3
                    WHERE recipe_id = $4
                    RETURNING *
                `, [recipe_name, output_item_id, cooking_method, recipe_id]);

                // 刪除舊的需求
                await client.query('DELETE FROM cook_recipe_requirements_v2 WHERE recipe_id = $1', [recipe_id]);
                console.log(`已刪除食譜 ID ${recipe_id} 的舊需求`);
            } else {
                // 新增食譜
                console.log('創建新食譜');
                if (!recipe_id) {
                    throw new Error('缺少必要的 recipe_id');
                }
                recipeResult = await client.query(`
                    INSERT INTO cook_recipes_v2 (recipe_id, recipe_name, output_item_id, cooking_method)
                    VALUES ($1, $2, $3, $4)
                    RETURNING *
                `, [recipe_id, recipe_name, output_item_id, cooking_method]);
            }

            // 插入新的需求
            let insertedRequirements = [];
            if (requirements && requirements.length > 0) {
                console.log(`為食譜 ${recipe_id} 插入 ${requirements.length} 個新需求`);
                for (const req of requirements) {
                    const reqResult = await client.query(`
                        INSERT INTO cook_recipe_requirements_v2 (recipe_id, required_item_id, quantity)
                        VALUES ($1, $2, $3)
                        RETURNING *
                    `, [recipe_id, req.item_id, req.quantity]);
                    insertedRequirements.push({
                        item_id: reqResult.rows[0].required_item_id,
                        quantity: reqResult.rows[0].quantity
                    });
                }
            }

            await client.query('COMMIT');
            console.log('事務已提交');

            const finalRecipe = {
                ...recipeResult.rows[0],
                requirements: insertedRequirements
            };
            
            res.status(201).json({ success: true, recipe: finalRecipe });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('新增/更新食譜時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤', details: error.message });
        } finally {
            client.release();
        }
    });

    // 管理員API - 獲取所有烹飪方法
    cookGameApp.get('/admin/cooking-methods', authenticateToken, isAdmin, async (req, res) => {
        try {
            console.log('\n=== 獲取所有烹飪方法 ===');
            const result = await pool.query('SELECT DISTINCT cooking_method FROM cook_recipes_v2 WHERE cooking_method IS NOT NULL AND cooking_method <> \'\'');
            const methods = result.rows.map(row => row.cooking_method);
            res.json(methods);
        } catch (error) {
            console.error('獲取烹飪方法時出錯:', error);
            res.status(500).json({ success: false, error: '無法獲取烹飪方法列表' });
        }
    });

    // 管理員API - 獲取所有物品
    cookGameApp.get('/admin/all-items', authenticateToken, isAdmin, async (req, res) => {
        try {
            console.log('\n=== 獲取所有物品列表 (cook_items) ===');
            const result = await pool.query('SELECT * FROM cook_items ORDER BY id ASC');
            console.log(`查詢到 ${result.rowCount} 個物品`);
            res.json(result.rows);
        } catch (error) {
            console.error('獲取物品列表時出錯:', error);
            res.status(500).json({ success: false, error: '無法獲取物品列表' });
        }
    });

    // 管理員API - 自動更新物品圖標
    cookGameApp.post('/admin/update-item-symbols', authenticateToken, isAdmin, async (req, res) => {
        console.log('\n=== 開始自動更新物品圖標 ===');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { rows: items } = await client.query('SELECT id, item_name FROM cook_items');
            console.log(`從資料庫讀取到 ${items.length} 個物品`);

            const emojiMap = {
                // 精確匹配
                '蛋': '🥚', '飯': '🍚', '糖': '🍬', '鹽': '🧂', '水': '💧', '醋': '🍾',
                '薑': '🌿', '油': '🛢️', '米': '🍚', '麵': '🍜', '茶': '🍵',
                // 肉類
                '牛': '🐮', '雞': '🐔', '豬': '🐷', '魚': '🐟', '蝦': '🦐', '肉': '🥩', '排': '🥩', '柳': '🥓',
                '漢堡': '🍔', '香腸': '🌭',
                // 蔬菜
                '菜': '🥬', '番茄': '🍅', '洋蔥': '🧅', '蘑菇': '🍄', '馬鈴薯': '🥔', '薯條': '🍟',
                '青椒': '🫑', '辣椒': '🌶️', '大蒜': '🧄', '蒜末': '🧄', '玉米': '🌽', '沙拉': '🥗',
                '生菜': '🥬', '豆': '🫘', '豆腐': '🍲',
                // 水果
                '鳳梨': '🍍', '檸檬': '🍋', '蘋果': '🍎', '橘子': '🍊', '草莓': '🍓',
                // 穀物和麵包
                '麵粉': '🌾', '麵包': '🍞', '吐司': '🍞', '麵糰': ' dough ', '義大利麵': '🍝', '麵條': '🍜',
                '鬆餅': '🥞', '餅': '🍪', '餅皮': '🍕', '披薩': '🍕',
                // 乳製品
                '奶': '🥛', '奶油': '🧈', '起司': '🧀', '乳酪': '🧀',
                // 醬料和調味
                '醬': '🥫', '醬油': '🍾', '咖哩': '🍛', '巧克力': '🍫', '蜂蜜': '🍯',
                // 飲料和湯
                '湯': '🥣', '椰奶': '🥥',
                // 菜餚
                '三明治': '🥪', '燉飯': '🥘', '炒飯': '🍚', '丼': '🍚'
            };

            let updatedCount = 0;
            const updatePromises = items.map(async (item) => {
                let bestMatch = '?';
                let longestMatch = 0;

                for (const [key, emoji] of Object.entries(emojiMap)) {
                    if (item.item_name.includes(key) && key.length > longestMatch) {
                        bestMatch = emoji;
                        longestMatch = key.length;
                    }
                }
                
                if (bestMatch !== '?') {
                    await client.query('UPDATE cook_items SET ascii_symbol = $1 WHERE id = $2 AND (ascii_symbol IS NULL OR ascii_symbol = \'?\')', [bestMatch, item.id]);
                    updatedCount++;
                }
            });

            await Promise.all(updatePromises);
            
            await client.query('COMMIT');
            console.log(`圖標更新完成。共更新了 ${updatedCount} 個物品。`);
            res.json({ success: true, message: `成功更新 ${updatedCount} 個物品圖標。` });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('更新物品圖標時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤', details: error.message });
        } finally {
            client.release();
        }
    });

    // 管理員API - 自動更新烹飪方法
    cookGameApp.post('/admin/update-cooking-methods', authenticateToken, isAdmin, async (req, res) => {
        console.log('\n=== 開始自動更新烹飪方法 ===');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 只查詢當前方法為 'assembly' 的食譜
            const { rows: recipes } = await client.query("SELECT id, recipe_name FROM cook_recipes_v2 WHERE cooking_method = 'assembly'");
            console.log(`從資料庫讀取到 ${recipes.length} 個需要檢查的食譜`);

            const methodMap = {
                'grill': ['烤'],
                'pan_fry': ['煎', '炒'],
                'deep_fry': ['炸'],
                'boil': ['煮', '水煮', '燉']
            };

            let updatedCount = 0;
            const updatePromises = recipes.map(async (recipe) => {
                let foundMethod = null;
                for (const [method, keywords] of Object.entries(methodMap)) {
                    for (const keyword of keywords) {
                        if (recipe.recipe_name.includes(keyword)) {
                            foundMethod = method;
                            break;
                        }
                    }
                    if (foundMethod) break;
                }
                
                if (foundMethod) {
                    const result = await client.query(
                        'UPDATE cook_recipes_v2 SET cooking_method = $1 WHERE id = $2',
                        [foundMethod, recipe.id]
                    );
                    if (result.rowCount > 0) {
                        updatedCount++;
                        console.log(`食譜 "${recipe.recipe_name}" (ID: ${recipe.id}) 的烹飪方法已更新為 -> ${foundMethod}`);
                    }
                }
            });

            await Promise.all(updatePromises);
            
            await client.query('COMMIT');
            console.log(`烹飪方法更新完成。共更新了 ${updatedCount} 個食譜。`);
            res.json({ success: true, message: `成功更新 ${updatedCount} 個食譜的烹飪方法。` });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('更新烹飪方法時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤', details: error.message });
        } finally {
            client.release();
        }
    });

    // 管理員API - 分析並建議缺少的食譜
    cookGameApp.post('/admin/suggest-missing-recipes', authenticateToken, isAdmin, async (req, res) => {
        console.log('\n=== 開始分析缺失的食譜鏈 ===');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 步驟 0: 確保 is_base_ingredient 欄位存在
            try {
                await client.query('ALTER TABLE cook_items ADD COLUMN is_base_ingredient BOOLEAN DEFAULT FALSE');
                console.log('成功新增 is_base_ingredient 欄位。');
                // 根據 item_type 木更新現有數據
                await client.query("UPDATE cook_items SET is_base_ingredient = TRUE WHERE item_type = 'raw_ingredient'");
                console.log('已根據 item_type 更新 is_base_ingredient 的值。');
            } catch (err) {
                if (err.code === '42701') { // 'duplicate_column'
                    console.log('is_base_ingredient 欄位已存在，跳過新增。');
                    await client.query('ROLLBACK'); // 回滾ALTER TABLE的隱式事務
                    await client.query('BEGIN'); // 開始一個新的事務
                } else {
                    throw err;
                }
            }

            // 步驟 1: 獲取所有物品和食譜數據
            const { rows: allItems } = await client.query('SELECT item_id, item_name, is_base_ingredient FROM cook_items');
            const { rows: allRecipes } = await client.query('SELECT recipe_id, recipe_name, output_item_id FROM cook_recipes_v2');
            
            // 步驟 2: 創建一個包含所有可被產出物品ID的集合，以提高查找效率
            const producedItemIds = new Set(allRecipes.map(r => r.output_item_id));

            // 步驟 3: 找出所有「孤兒」加工品 (即非基礎食材，且沒有任何食譜能產出它)
            const orphanItems = allItems.filter(item => {
                const isProcessedGood = !item.is_base_ingredient;
                const isNotProducible = !producedItemIds.has(item.item_id);
                return isProcessedGood && isNotProducible;
            });

            console.log(`找到 ${orphanItems.length} 個孤兒加工品:`, orphanItems.map(i => i.item_name));

            // 步驟 4: 為孤兒物品推斷食譜
            const suggestedRecipes = [];
            const baseIngredients = allItems.filter(item => item.is_base_ingredient);

            const methodMap = {
                '烤': 'grill', '焗': 'grill',
                '煎': 'pan_fry', '炒': 'pan_fry',
                '炸': 'deep_fry',
                '煮': 'boil', '燉': 'boil', '滷': 'boil'
            };

            // 獲取最大的 recipe_id
            const { rows: maxIdResult } = await client.query('SELECT MAX(recipe_id) as max_id FROM cook_recipes_v2');
            let nextRecipeId = maxIdResult[0].max_id || 'recipe_1';

            for (const orphan of orphanItems) {
                // 推斷烹飪方法
                let cookingMethod = 'assembly'; // 默認是組合
                for (const [key, method] of Object.entries(methodMap)) {
                    if (orphan.item_name.includes(key)) {
                        cookingMethod = method;
                        break;
                    }
                }

                // 推斷基礎食材 (尋找名稱匹配度最高的)
                let bestMatchIngredient = null;
                let longestMatch = 0;
                
                // 移除烹飪關鍵字，尋找核心食材名稱
                const coreName = orphan.item_name.replace(/(烤|煎|炒|炸|煮|燉|滷)/, '');
                
                baseIngredients.forEach(base => {
                    if (coreName.includes(base.item_name) && base.item_name.length > longestMatch) {
                        bestMatchIngredient = base;
                        longestMatch = base.item_name.length;
                    }
                });

                if (bestMatchIngredient) {
                    const recipeId = `recipe_${Date.now()}_${orphan.item_id}`;  // 使用時間戳和物品ID生成唯一的recipe_id
                    suggestedRecipes.push({
                        recipe_id: recipeId,
                        recipe_name: `製作 ${orphan.item_name}`,
                        output_item_id: orphan.item_id,  // 使用 item_id 而不是 id
                        output_item_name: orphan.item_name,
                        cooking_method: cookingMethod,
                        requirements: [{
                            item_id: bestMatchIngredient.item_id,  // 使用 item_id 而不是 id
                            item_name: bestMatchIngredient.item_name,
                            quantity: 1
                        }]
                    });
                }
            }
            
            await client.query('COMMIT');
            console.log(`成功生成 ${suggestedRecipes.length} 條建議食譜。`);
            res.json({ success: true, suggestions: suggestedRecipes });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('分析缺失食譜時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤', details: error.message });
        } finally {
            client.release();
        }
    });

    // 管理員API - 模擬烹飪
    cookGameApp.post('/admin/simulate-cooking', authenticateToken, isAdmin, async (req, res) => {
        const { itemIds, cookingMethod } = req.body;

        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0 || !cookingMethod) {
            return res.status(400).json({ success: false, error: '請求參數無效' });
        }

        try {
            // 1. 獲取所有食譜及其以JSON格式聚合的需求
            const recipesResult = await pool.query(`
                SELECT
                    r.id,
                    r.output_item_id,
                    r.cooking_method,
                    json_agg(json_build_object('item_id', rr.required_item_id, 'quantity', rr.quantity)) as requirements
                FROM cook_recipes_v2 r
                JOIN cook_recipe_requirements_v2 rr ON r.id = rr.recipe_id
                GROUP BY r.id
            `);

            // 2. 創建一個來自使用者輸入的物品頻率對照表
            const inputItemsMap = itemIds.reduce((acc, id) => {
                acc[id] = (acc[id] || 0) + 1;
                return acc;
            }, {});

            // 3. 尋找匹配的食譜
            const matchedRecipe = recipesResult.rows.find(recipe => {
                // 步驟 A: 檢查烹飪方法是否匹配
                if (recipe.cooking_method !== cookingMethod) {
                    return false;
                }

                // 步驟 B: 根據食譜需求創建頻率對照表
                const recipeReqsMap = recipe.requirements.reduce((acc, req) => {
                    // 確保item_id是字串以進行一致的鍵比較
                    acc[String(req.item_id)] = (acc[String(req.item_id)] || 0) + req.quantity;
                    return acc;
                }, {});
                
                // 步驟 C: 深度比較兩個對照表
                const inputKeys = Object.keys(inputItemsMap);
                const recipeKeys = Object.keys(recipeReqsMap);

                if (inputKeys.length !== recipeKeys.length) {
                    return false;
                }

                return recipeKeys.every(key => String(inputItemsMap[key]) === String(recipeReqsMap[key]));
            });

            if (matchedRecipe) {
                // 如果找到匹配的食譜，查詢產出物品的詳細信息
                const outputItemResult = await pool.query('SELECT * FROM cook_items WHERE id = $1', [matchedRecipe.output_item_id]);
                if (outputItemResult.rows.length > 0) {
                    res.json({ success: true, outputItem: outputItemResult.rows[0] });
                } else {
                    res.status(404).json({ success: false, error: '食譜的產出物品已不存在' });
                }
            } else {
                res.status(404).json({ success: false, error: '找不到匹配的食譜。請檢查食材組合和烹飪方法是否正確。' });
            }

        } catch (error) {
            console.error('模擬烹飪時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤', details: error.message });
        }
    });

    // 管理員API - 儀表板數據
    cookGameApp.get('/admin/dashboard', authenticateToken, isAdmin, async (req, res) => {
        try {
            console.log('\n=== 獲取儀表板數據 ===');
            
            // 修正數據來源表格
            const userCountPromise = pool.query('SELECT COUNT(*) FROM cook_players');
            const titleCountPromise = pool.query('SELECT COUNT(*) FROM cook_user_titles');
            const itemCountPromise = pool.query('SELECT COUNT(*) FROM cook_items');
            const roomCountPromise = pool.query('SELECT COUNT(*) FROM cook_game_rooms');

            const [userResult, titleResult, itemResult, roomResult] = await Promise.all([
                userCountPromise,
                titleCountPromise,
                itemCountPromise,
                roomCountPromise
            ]);

            const dashboardData = {
                userCount: parseInt(userResult.rows[0].count, 10),
                titleCount: parseInt(titleResult.rows[0].count, 10),
                itemCount: parseInt(itemResult.rows[0].count, 10),
                roomCount: parseInt(roomResult.rows[0].count, 10) || 0,
                recentActivities: [] // 目前暫不提供最近活動
            };

            console.log('儀表板數據:', dashboardData);
            res.json(dashboardData);

        } catch (error) {
            console.error('獲取儀表板數據時出錯:', error);
            res.status(500).json({ success: false, error: '無法獲取儀表板數據' });
        }
    });

    // 快速登入API (用於已在主系統登入的用戶)
    cookGameApp.post('/auth/quick-login', async (req, res) => {
        console.log('\n[LOG] >>> /auth/quick-login --- 收到請求');
        console.log('[LOG] /auth/quick-login - Request Body:', req.body);
        try {
            const { username } = req.body;

            // 1. 查找 box_users 表，確認用戶存在
            console.log(`[LOG] /auth/quick-login - 正在查詢主用戶表: ${username}`);
            const userResult = await pool.query('SELECT user_id, username, display_name FROM box_users WHERE username = $1', [username]);
            if (userResult.rows.length === 0) {
                console.warn(`[LOG] /auth/quick-login - 用戶名 ${username} 不存在於主系統。`);
                return res.status(404).json({ success: false, error: '用戶不存在' });
            }
            const user = userResult.rows[0];
            console.log(`[LOG] /auth/quick-login - 找到主用戶:`, user);

            // 2. 檢查 cook_players 表，如果不存在則創建
            console.log(`[LOG] /auth/quick-login - 正在檢查玩家是否存在: ${user.user_id}`);
            let playerResult = await pool.query('SELECT * FROM cook_players WHERE user_id = $1', [user.user_id]);
            if (playerResult.rows.length === 0) {
                console.log(`[LOG] /auth/quick-login - 玩家記錄不存在，正在為用戶 ${username} (ID: ${user.user_id}) 創建...`);
                await pool.query('INSERT INTO cook_players (user_id) VALUES ($1)', [user.user_id]);
                console.log(`[LOG] /auth/quick-login - 玩家記錄創建成功。`);
            } else {
                console.log(`[LOG] /auth/quick-login - 玩家記錄已存在。`);
            }

            // 3. 簽發遊戲令牌
            const token = jwt.sign({ user_id: user.user_id, username: user.username }, process.env.BOX_JWT_SECRET, { expiresIn: '24h' });
            console.log(`[LOG] /auth/quick-login - 為用戶 ${username} 簽發令牌成功。`);

            res.json({
                success: true,
                message: '快速登入成功',
                token,
                userId: user.user_id,
                username: user.username,
                displayName: user.display_name || user.username // 確保有 display_name
            });

        } catch (error) {
            console.error('[LOG] /auth/quick-login - 快速登入時發生錯誤:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤' });
        }
    });

    // 玩家登入API
    cookGameApp.post('/player/login', async (req, res) => {
        console.log('\n[LOG] >>> /player/login --- 收到登入請求');
        console.log('[LOG] /player/login - Request Body:', req.body);
        try {
            const { username, password } = req.body;
            
            console.log(`[LOG] /player/login - 正在查詢用戶: ${username}`);
            const userResult = await pool.query('SELECT * FROM box_users WHERE username = $1', [username]);
            if (userResult.rows.length === 0) {
                console.log(`[LOG] /player/login - 登入失敗: 用戶名 ${username} 不存在。`);
                return res.status(401).json({ error: '用戶名或密碼錯誤' });
            }
            
            const user = userResult.rows[0];
            console.log(`[LOG] /player/login - 找到用戶，正在驗證密碼...`);
            
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (!isPasswordValid) {
                console.log(`[LOG] /player/login - 登入失敗: 用戶 ${username} 的密碼錯誤。`);
                return res.status(401).json({ error: '用戶名或密碼錯誤' });
            }
            console.log(`[LOG] /player/login - 密碼驗證成功。`);

            // 檢查玩家是否存在於cook_players，如果不存在則創建
            console.log(`[LOG] /player/login - 正在檢查玩家是否存在: ${user.user_id}`);
            let playerResult = await pool.query('SELECT * FROM cook_players WHERE user_id = $1', [user.user_id]);
            if (playerResult.rows.length === 0) {
                console.log(`[LOG] /player/login - 玩家記錄不存在，正在為用戶 ${username} (ID: ${user.user_id}) 創建...`);
                await pool.query('INSERT INTO cook_players (user_id) VALUES ($1)', [user.user_id]);
                console.log(`[LOG] /player/login - 玩家記錄創建成功。`);
            } else {
                console.log(`[LOG] /player/login - 玩家記錄已存在。`);
            }
            
            const token = jwt.sign({ user_id: user.user_id, username: user.username }, process.env.BOX_JWT_SECRET, { expiresIn: '24h' });
            console.log(`[LOG] /player/login - 為用戶 ${username} 簽發令牌成功。`);

            // 登入後立即檢查稱號解鎖
            console.log(`[LOG] /player/login - 正在為用戶 ${user.user_id} 檢查稱號解鎖...`);
            const unlockedTitles = await checkTitleUnlocks(user.user_id);
            console.log(`[LOG] /player/login - 新解鎖 ${unlockedTitles.length} 個稱號。`);

            // 查詢用戶角色
            console.log(`[LOG] /player/login - 正在查詢用戶角色: ${user.user_id}`);
            const roleResult = await pool.query('SELECT role_id FROM public.user_role_assignments WHERE user_id = $1', [user.user_id]);
            console.log('[LOG] /player/login - 角色查詢結果:', roleResult.rows);

            const userRole = roleResult.rows.length > 0 ? roleResult.rows[0].role_id : null;
            console.log(`[LOG] /player/login - 解析出的用戶角色為: ${userRole}`);

            res.json({
                success: true, // 添加 success 標記以匹配前端邏輯
                message: '登入成功',
                token,
                userId: user.user_id,
                username: user.username,
                displayName: user.display_name,
                role: userRole,
                unlockedTitles: unlockedTitles
            });
        } catch (error) {
            console.error('[LOG] /player/login - 登入時發生錯誤:', error);
            res.status(500).json({ error: '伺服器錯誤' });
        }
    });

    // 獲取當前登入玩家的個人資料
    cookGameApp.get('/player/profile', authenticateToken, async (req, res) => {
        console.log('\n[LOG] >>> /player/profile --- 收到請求');
        try {
            const userId = req.user.user_id;
            console.log(`[LOG] /player/profile - 正在查詢用戶 ${userId} 的個人資料...`);
            const result = await pool.query(`
                SELECT 
                    p.user_id, 
                    p.level, 
                    p.points, 
                    p.games_played, 
                    p.orders_completed,
                    u.username,
                    u.display_name
                FROM cook_players p
                JOIN box_users u ON p.user_id = u.user_id
                WHERE p.user_id = $1
            `, [userId]);

            if (result.rows.length === 0) {
                console.log(`[LOG] /player/profile - 在 cook_players 中找不到用戶 ${userId} 的資料，嘗試從 box_users 回退。`);
                // Fallback to check box_users directly if no player data
                const userResult = await pool.query(`
                    SELECT 
                        u.user_id, 
                        u.username, 
                        u.display_name
                    FROM box_users u 
                    WHERE u.user_id = $1
                `, [userId]);
                if (userResult.rows.length === 0) {
                     console.log(`[LOG] /player/profile - 在 box_users 中也找不到用戶 ${userId} 的資料。`);
                     return res.status(404).json({ error: '玩家資料不存在' });
                }
                const basicProfile = userResult.rows[0];
                console.log(`[LOG] /player/profile - 找到基本用戶資料，返回預設遊戲數據。`, basicProfile);
                // return basic profile with default game stats
                return res.json({
                    user_id: basicProfile.user_id,
                    level: 1,
                    points: 0,
                    games_played: 0,
                    orders_completed: 0,
                    username: basicProfile.username,
                    display_name: basicProfile.display_name,
                    roles: [] // Temporarily return empty array
                });
            }
            
            console.log(`[LOG] /player/profile - 成功查詢到玩家資料:`, result.rows[0]);
            res.json(result.rows[0]);
        } catch (error) {
            console.error('[LOG] /player/profile - 獲取玩家資料時發生嚴重錯誤:', error);
            res.status(500).json({ error: '伺服器錯誤，詳情請查看後台日誌' });
        }
    });

    // 獲取玩家擁有的稱號
    cookGameApp.get('/player/titles', authenticateToken, async (req, res) => {
        console.log('\n[LOG] >>> /player/titles --- 收到請求');
        try {
            const userId = req.user.user_id;
            console.log(`[LOG] /player/titles - 正在查詢用戶 ${userId} 的稱號...`);
            const result = await pool.query(`
                SELECT 
                    t.id, 
                    t.title_id, 
                    t.title_name, 
                    t.title_description, 
                    t.rarity, 
                    t.icon_url, 
                    t.color_code,
                    ut.is_selected as is_equipped
                FROM cook_user_titles ut
                JOIN cook_titles t ON ut.title_id = t.id
                WHERE ut.user_id = $1
                ORDER BY t.rarity, t.id
            `, [userId]);
            
            console.log(`[LOG] /player/titles - 查詢到 ${result.rows.length} 個稱號。`);
            res.json({ titles: result.rows });
        } catch (error) {
            console.error('[LOG] /player/titles - 獲取玩家稱號時發生錯誤:', error);
            res.status(500).json({ error: '無法獲取玩家稱號' });
        }
    });

    // 裝備稱號
    cookGameApp.post('/player/titles/:titleId/equip', authenticateToken, async (req, res) => {
        console.log('\n[LOG] >>> /player/titles/:titleId/equip --- 收到請求');
        const { titleId } = req.params;
        const userId = req.user.user_id;
        console.log(`[LOG] /player/titles/:titleId/equip - 用戶 ${userId} 嘗試裝備稱號 ${titleId}`);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            console.log(`[LOG] /player/titles/:titleId/equip - 開始事務，正在移除用戶 ${userId} 的其他稱號裝備狀態...`);
            // 移除其他稱號的裝備狀態
            await client.query('UPDATE cook_user_titles SET is_selected = false WHERE user_id = $1', [userId]);
            console.log(`[LOG] /player/titles/:titleId/equip - 正在為用戶 ${userId} 裝備新稱號 ${titleId}...`);
            // 裝備新稱號
            const result = await client.query('UPDATE cook_user_titles SET is_selected = true WHERE user_id = $1 AND title_id = $2 RETURNING *', [userId, titleId]);
            
            if (result.rowCount === 0) {
                console.log(`[LOG] /player/titles/:titleId/equip - 裝備失敗: 用戶 ${userId} 不擁有稱號 ${titleId}。正在回滾事務...`);
                await client.query('ROLLBACK');
                return res.status(404).json({ error: '你尚未擁有此稱號' });
            }
            
            console.log(`[LOG] /player/titles/:titleId/equip - 裝備成功，正在提交事務...`);
            await client.query('COMMIT');
            res.json({ success: true, message: '稱號已裝備' });
        } catch (error) {
            console.error(`[LOG] /player/titles/:titleId/equip - 裝備稱號時發生錯誤:`, error);
            await client.query('ROLLBACK');
            res.status(500).json({ error: '裝備稱號失敗' });
        } finally {
            console.log(`[LOG] /player/titles/:titleId/equip - 釋放資料庫連接。`);
            client.release();
        }
    });

    // 檢查玩家權限
    cookGameApp.get('/player/role', authenticateToken, async (req, res) => {
        console.log('\n[LOG] >>> /player/role --- 收到請求');
        try {
            const userId = req.user.user_id;
            console.log(`[LOG] /player/role - 正在檢查用戶 ${userId} 的權限...`);
            const result = await pool.query('SELECT role_id FROM user_role_assignments WHERE user_id = $1', [userId]);
            
            if (result.rows.length > 0) {
                // 假設 role_id 為 6 是管理員
                const isAdmin = result.rows[0].role_id === 6;
                console.log(`[LOG] /player/role - 用戶 ${userId} 的角色ID為 ${result.rows[0].role_id}，管理員狀態: ${isAdmin}`);
                res.json({ isAdmin });
            } else {
                console.log(`[LOG] /player/role - 用戶 ${userId} 沒有分配任何角色。`);
                res.json({ isAdmin: false });
            }
        } catch (error) {
            console.error('[LOG] /player/role - 檢查玩家權限時發生錯誤:', error);
            res.status(500).json({ error: '無法檢查玩家權限' });
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
                        INSERT INTO cook_user_titles (user_id, title_id)
                        VALUES ($1, $2)
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

    // V3 API 路由
    // 獲取所有物品
    cookGameApp.get('/cook-api/v3/items', authenticateToken, isAdmin, async (req, res) => {
        try {
            console.log('\n=== 獲取 V3 物品列表 ===');
            const result = await pool.query(`
                SELECT * FROM cook_items_v3 
                ORDER BY item_tier ASC, item_name ASC
            `);
            console.log(`查詢到 ${result.rowCount} 個物品`);
            res.json(result.rows);
        } catch (error) {
            console.error('獲取 V3 物品列表時出錯:', error);
            res.status(500).json({ success: false, error: '無法獲取物品列表' });
        }
    });

    // 新增或更新物品
    cookGameApp.post('/cook-api/v3/items', authenticateToken, isAdmin, async (req, res) => {
        const { item_id, item_name, ascii_symbol, item_tier, base_points } = req.body;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 檢查是否已存在
            const existingItem = await client.query(
                'SELECT item_id FROM cook_items_v3 WHERE item_id = $1',
                [item_id]
            );

            let result;
            if (existingItem.rows.length > 0) {
                // 更新現有物品
                result = await client.query(`
                    UPDATE cook_items_v3
                    SET item_name = $1, ascii_symbol = $2, item_tier = $3, base_points = $4
                    WHERE item_id = $5
                    RETURNING *
                `, [item_name, ascii_symbol, item_tier, base_points, item_id]);
                console.log(`更新物品: ${item_id}`);
            } else {
                // 新增物品
                result = await client.query(`
                    INSERT INTO cook_items_v3 (item_id, item_name, ascii_symbol, item_tier, base_points)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING *
                `, [item_id, item_name, ascii_symbol, item_tier, base_points]);
                console.log(`新增物品: ${item_id}`);
            }

            await client.query('COMMIT');
            res.json({ success: true, item: result.rows[0] });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('新增/更新物品時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤', details: error.message });
        } finally {
            client.release();
        }
    });

    // 刪除物品
    cookGameApp.delete('/cook-api/v3/items/:itemId', authenticateToken, isAdmin, async (req, res) => {
        const { itemId } = req.params;
        try {
            // 檢查物品是否被食譜使用
            const usageCheck = await pool.query(`
                SELECT recipe_id FROM cook_recipes_v3 WHERE output_item_id = $1
                UNION
                SELECT recipe_id FROM cook_recipe_requirements_v3 WHERE required_item_id = $1
            `, [itemId]);

            if (usageCheck.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: '無法刪除：此物品正在被食譜使用'
                });
            }

            const result = await pool.query(
                'DELETE FROM cook_items_v3 WHERE item_id = $1 RETURNING *',
                [itemId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: '找不到指定的物品' });
            }

            res.json({ success: true, message: '物品已成功刪除' });
        } catch (error) {
            console.error('刪除物品時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤' });
        }
    });

    // 獲取所有食譜
    cookGameApp.get('/cook-api/v3/recipes', authenticateToken, isAdmin, async (req, res) => {
        try {
            console.log('\n=== 獲取 V3 食譜列表 ===');

            const recipesResult = await pool.query(`
                SELECT r.*, 
                       json_agg(
                           json_build_object(
                               'item_id', rr.required_item_id,
                               'quantity', rr.quantity
                           )
                       ) as requirements
                FROM cook_recipes_v3 r
                LEFT JOIN cook_recipe_requirements_v3 rr ON r.recipe_id = rr.recipe_id
                GROUP BY r.recipe_id
                ORDER BY r.recipe_name ASC
            `);

            console.log(`查詢到 ${recipesResult.rowCount} 個食譜`);
            res.json(recipesResult.rows);
        } catch (error) {
            console.error('獲取 V3 食譜列表時出錯:', error);
            res.status(500).json({ success: false, error: '無法獲取食譜列表' });
        }
    });

    // 新增或更新食譜
    cookGameApp.post('/cook-api/v3/recipes', authenticateToken, isAdmin, async (req, res) => {
        const { recipe_id, recipe_name, output_item_id, cooking_method, requirements, cook_time_sec } = req.body;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 驗證產出物品存在且為有效的目標層級
            const outputItemCheck = await client.query(
                'SELECT item_tier FROM cook_items_v3 WHERE item_id = $1',
                [output_item_id]
            );

            if (outputItemCheck.rows.length === 0) {
                throw new Error('產出物品不存在');
            }

            const outputTier = outputItemCheck.rows[0].item_tier;
            if (outputTier === 0) {
                throw new Error('基礎食材 (T0) 不能作為食譜產出');
            }

            // 驗證所有需求物品存在且層級合理
            for (const req of requirements) {
                const reqItemCheck = await client.query(
                    'SELECT item_tier FROM cook_items_v3 WHERE item_id = $1',
                    [req.item_id]
                );

                if (reqItemCheck.rows.length === 0) {
                    throw new Error(`需求物品 ${req.item_id} 不存在`);
                }

                const reqTier = reqItemCheck.rows[0].item_tier;
                if (reqTier >= outputTier) {
                    throw new Error(`需求物品的層級 (T${reqTier}) 不能大於或等於產出物品的層級 (T${outputTier})`);
                }
            }

            // 檢查是否已存在
            const existingRecipe = await client.query(
                'SELECT recipe_id FROM cook_recipes_v3 WHERE recipe_id = $1',
                [recipe_id]
            );

            let recipeResult;
            if (existingRecipe.rows.length > 0) {
                // 更新現有食譜
                recipeResult = await client.query(`
                    UPDATE cook_recipes_v3
                    SET recipe_name = $1, output_item_id = $2, cooking_method = $3, cook_time_sec = $4
                    WHERE recipe_id = $5
                    RETURNING *
                `, [recipe_name, output_item_id, cooking_method, cook_time_sec, recipe_id]);

                // 刪除舊的需求
                await client.query('DELETE FROM cook_recipe_requirements_v3 WHERE recipe_id = $1', [recipe_id]);
            } else {
                // 新增食譜
                recipeResult = await client.query(`
                    INSERT INTO cook_recipes_v3 (recipe_id, recipe_name, output_item_id, cooking_method, cook_time_sec)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING *
                `, [recipe_id, recipe_name, output_item_id, cooking_method, cook_time_sec]);
            }

            // 插入新的需求
            for (const req of requirements) {
                await client.query(`
                    INSERT INTO cook_recipe_requirements_v3 (recipe_id, required_item_id, quantity)
                    VALUES ($1, $2, $3)
                `, [recipe_id, req.item_id, req.quantity]);
            }

            await client.query('COMMIT');
            
            // 重新查詢完整的食譜資料（包含需求）
            const finalResult = await client.query(`
                SELECT r.*, 
                       json_agg(
                           json_build_object(
                               'item_id', rr.required_item_id,
                               'quantity', rr.quantity
                           )
                       ) as requirements
                FROM cook_recipes_v3 r
                LEFT JOIN cook_recipe_requirements_v3 rr ON r.recipe_id = rr.recipe_id
                WHERE r.recipe_id = $1
                GROUP BY r.recipe_id
            `, [recipe_id]);

            res.json({ success: true, recipe: finalResult.rows[0] });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('新增/更新食譜時出錯:', error);
            res.status(500).json({ success: false, error: error.message });
        } finally {
            client.release();
        }
    });

    // 刪除食譜
    cookGameApp.delete('/cook-api/v3/recipes/:recipeId', authenticateToken, isAdmin, async (req, res) => {
        const { recipeId } = req.params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 先刪除食譜的需求
            await client.query('DELETE FROM cook_recipe_requirements_v3 WHERE recipe_id = $1', [recipeId]);

            // 再刪除食譜本身
            const result = await client.query(
                'DELETE FROM cook_recipes_v3 WHERE recipe_id = $1 RETURNING *',
                [recipeId]
            );

            if (result.rows.length === 0) {
                throw new Error('找不到指定的食譜');
            }

            await client.query('COMMIT');
            res.json({ success: true, message: '食譜已成功刪除' });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('刪除食譜時出錯:', error);
            res.status(500).json({ success: false, error: error.message });
        } finally {
            client.release();
        }
    });

    // V3 烹飪模擬器 API
    cookGameApp.post('/v3/simulate', authenticateToken, isAdmin, async (req, res) => {
        const { items, cookingMethod } = req.body;

        if (!items || !Array.isArray(items) || !cookingMethod) {
            return res.status(400).json({ success: false, error: '請求參數無效' });
        }

        // 如果組合區是空的，直接返回
        if (items.length === 0) {
            return res.json({ success: false, error: '組合區內沒有物品' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const itemDetailsResult = await client.query(
                'SELECT item_id, item_tier FROM cook_items_v3 WHERE item_id = ANY($1::text[])',
                [items]
            );
            
            // 修正驗證邏輯：比對唯一物品ID的數量
            const uniqueInputIds = new Set(items);
            if (itemDetailsResult.rows.length !== uniqueInputIds.size) {
                const foundIds = new Set(itemDetailsResult.rows.map(row => row.item_id));
                const missingIds = [...uniqueInputIds].filter(id => !foundIds.has(id));
                throw new Error(`一個或多個輸入物品ID無效: ${missingIds.join(', ')}`);
            }

            const inputItemTiers = items.map(itemId => {
                return itemDetailsResult.rows.find(row => row.item_id === itemId).item_tier;
            });

            const hasT1Item = inputItemTiers.some(tier => tier === 1);
            const allAreT0Items = inputItemTiers.every(tier => tier === 0);

            // 根據烹飪方法和輸入物品查找匹配的食譜
            let matchedRecipe;

            if (cookingMethod === 'assembly' && hasT1Item) {
                // 組合方法：允許 T0+T1 或 T1+T1 組合
                // 查詢可能匹配的 T2 食譜
                matchedRecipe = await findMatchingRecipe(client, items, cookingMethod, 2);
            } else if ((cookingMethod === 'grill' || cookingMethod === 'pan_fry' || 
                        cookingMethod === 'deep_fry' || cookingMethod === 'boil') && 
                        allAreT0Items) {
                // 烹飪方法：僅允許 T0 輸入，產出 T1
                matchedRecipe = await findMatchingRecipe(client, items, cookingMethod, 1);
            } else {
                // 不符合基本規則
                if (hasT1Item && cookingMethod !== 'assembly') {
                    await client.query('COMMIT');
                    return res.json({ 
                        success: false, 
                        ruleViolation: 'T1 半成品只能使用「組合」方法進行烹飪。' 
                    });
                }
                
                if (!allAreT0Items && cookingMethod !== 'assembly') {
                    await client.query('COMMIT');
                    return res.json({ 
                        success: false, 
                        ruleViolation: '烹飪方法（烤製、煎炒、油炸、水煮）只能使用 T0 基礎食材。' 
                    });
                }
            }

            if (matchedRecipe) {
                const outputItemResult = await client.query(
                    'SELECT * FROM cook_items_v3 WHERE id = $1',
                    [matchedRecipe.output_item_id]
                );

                if (outputItemResult.rows.length === 0) {
                    throw new Error(`食譜 "${matchedRecipe.recipe_id}" 的產出物品 "${matchedRecipe.output_item_id}" 已不存在。`);
                }

                await client.query('COMMIT');
                res.json({ 
                    success: true, 
                    outputItem: outputItemResult.rows[0],
                    recipe: {
                        recipe_id: matchedRecipe.recipe_id,
                        recipe_name: matchedRecipe.recipe_name,
                        cooking_method: matchedRecipe.cooking_method,
                        cook_time_sec: matchedRecipe.cook_time_sec || 3
                    }
                });
            } else {
                await client.query('COMMIT');
                res.json({ success: false, error: '失敗' });
            }
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[V3] 模擬烹飪時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤', details: error.message });
        } finally {
            client.release();
        }
    });

    /**
     * 手動獲取下一個可用的 room_id
     * @returns {Promise<number>} 下一個房間 ID
     */
    async function getNextRoomId() {
        const result = await pool.query('SELECT MAX(room_id) as max_id FROM cook_game_rooms');
        const maxId = result.rows[0].max_id || 0;
        return maxId + 1;
    }

    cookGameApp.post('/games/rooms', authenticateToken, async (req, res) => {
        const { name, difficulty } = req.body;
        const userId = req.user.user_id;
        const creatorUsername = req.user.username;

        if (!name) {
            return res.status(400).json({ success: false, message: '房間名稱為必填項' });
        }

        try {
            // 修正：使用 userId 從 cook_players 表中查找對應的 player_id (整數)
            const playerResult = await pool.query('SELECT player_id FROM cook_players WHERE user_id = $1', [userId]);

            if (playerResult.rows.length === 0) {
                // 如果在遊戲玩家表中找不到記錄，這是一個問題
                console.error(`[LOG] /games/rooms - 嚴重錯誤: 用戶 ${userId} 已通過認證，但在 cook_players 中沒有記錄。`);
                return res.status(404).json({ success: false, message: '找不到玩家資料，無法創建房間' });
            }
            const creatorPlayerId = playerResult.rows[0].player_id; // 這應該是整數

            // 新增：手動獲取下一個 room_id
            const nextRoomId = await getNextRoomId();

            const initialGameState = {
                status: 'waiting',
                difficulty: difficulty || 'normal',
                max_players: 4,
                players: [{
                    user_id: userId,
                    username: creatorUsername,
                    ready: false,
                    player_id: creatorPlayerId // 在遊戲狀態中也包含 player_id 以方便後續使用
                }]
            };

            // 修正：手動插入 room_id
            const newRoom = await pool.query(`
                INSERT INTO cook_game_rooms (room_id, room_name, creator_id, status, game_state)
                VALUES ($1, $2, $3, 'waiting', $4)
                RETURNING room_id, room_name, game_state;
            `, [nextRoomId, name, creatorPlayerId, initialGameState]);

            const room = newRoom.rows[0];
            console.log(`[LOG] /games/rooms - 房間創建成功:`, room);

            res.status(201).json({ success: true, id: room.room_id, message: '房間創建成功' });

        } catch (error) {
            console.error('[LOG] /games/rooms - 創建房間時發生錯誤:', error);
            res.status(500).json({ success: false, message: '無法創建房間' });
        }
    });

    // 獲取遊戲房間列表
    cookGameApp.get('/games/rooms', authenticateToken, async (req, res) => {
        console.log('\n[LOG] >>> /games/rooms --- 收到獲取房間列表請求');
        try {
            const result = await pool.query(`
                SELECT 
                    room_id,
                    room_name,
                    status,
                    game_state->>'difficulty' AS difficulty,
                    (game_state->>'max_players')::int AS "maxPlayers",
                    jsonb_array_length(game_state->'players') AS players
                FROM cook_game_rooms
                WHERE status = 'waiting' 
                  AND jsonb_array_length(game_state->'players') < (game_state->>'max_players')::int
            `);
            
            console.log(`[LOG] /games/rooms - 查詢到 ${result.rows.length} 個可加入的房間。`);
            res.json(result.rows);
        } catch (error) {
            console.error('[LOG] /games/rooms - 獲取房間列表時發生錯誤:', error);
            res.status(500).json({ error: '無法獲取遊戲房間列表' });
        }
    });

    // 新增：清理所有無效房間
    cookGameApp.delete('/games/rooms/cleanup', authenticateToken, async (req, res) => {
        console.log('\n[LOG] >>> /games/rooms/cleanup --- 收到清理房間請求');
        try {
            // 簡單的清理邏輯：刪除所有狀態為 'waiting' 或 'playing' 的房間
            // 未來可以增加更複雜的邏輯，例如檢查最後活動時間
            const result = await pool.query("DELETE FROM cook_game_rooms");
            console.log(`[LOG] /games/rooms/cleanup - 成功刪除 ${result.rowCount} 個房間。`);
            res.status(200).json({ message: `成功清理了 ${result.rowCount} 個房間。` });
        } catch (error) {
            console.error('[LOG] /games/rooms/cleanup - 清理房間時發生錯誤:', error);
            res.status(500).json({ message: '伺服器內部錯誤' });
        }
    });

    // [WebSocket 伺服器設定]
    const wss = new WebSocket.Server({ noServer: true });

    // ===================================
    // V3 RECIPE ADMIN API
    // ===================================
    const v3Router = express.Router();
    
    // 添加一個測試路由，不需要認證
    v3Router.get('/test', (req, res) => {
        res.json({ message: 'Cook Game V3 API is working!' });
    });
    
    // 添加一個臨時的測試路由，返回一些模擬數據，不需要認證
    v3Router.get('/test-data', (req, res) => {
        // 模擬一些基本的遊戲數據
        const mockItems = [
            { id: 1, item_id: 'tomato', item_name: '番茄', ascii_symbol: '🍅', item_tier: 0, base_points: 10, category: '蔬菜' },
            { id: 2, item_id: 'lettuce', item_name: '生菜', ascii_symbol: '🥬', item_tier: 0, base_points: 10, category: '蔬菜' },
            { id: 3, item_id: 'beef', item_name: '牛肉', ascii_symbol: '🥩', item_tier: 0, base_points: 20, category: '肉類' },
            { id: 4, item_id: 'bun', item_name: '麵包', ascii_symbol: '🍞', item_tier: 0, base_points: 15, category: '加工品' },
            { id: 5, item_id: 'cut_tomato', item_name: '切片番茄', ascii_symbol: '🍅', item_tier: 1, base_points: 15 },
            { id: 6, item_id: 'cut_lettuce', item_name: '切片生菜', ascii_symbol: '🥬', item_tier: 1, base_points: 15 },
            { id: 7, item_id: 'cooked_beef', item_name: '煎牛肉', ascii_symbol: '🍖', item_tier: 1, base_points: 25 },
            { id: 8, item_id: 'hamburger', item_name: '漢堡', ascii_symbol: '🍔', item_tier: 2, base_points: 50 }
        ];
        
        const mockRecipes = [
            { 
                id: 1, 
                recipe_id: 'cut_tomato', 
                recipe_name: '切片番茄', 
                cooking_method: 'cut', 
                cook_time_sec: 2, 
                output_item_id: 5, 
                output_item_id_str: 'cut_tomato',
                requirements: [{ item_id_str: 'tomato', quantity: 1 }]
            },
            { 
                id: 2, 
                recipe_id: 'cut_lettuce', 
                recipe_name: '切片生菜', 
                cooking_method: 'cut', 
                cook_time_sec: 2, 
                output_item_id: 6, 
                output_item_id_str: 'cut_lettuce',
                requirements: [{ item_id_str: 'lettuce', quantity: 1 }]
            },
            { 
                id: 3, 
                recipe_id: 'cooked_beef', 
                recipe_name: '煎牛肉', 
                cooking_method: 'pan_fry', 
                cook_time_sec: 5, 
                output_item_id: 7, 
                output_item_id_str: 'cooked_beef',
                requirements: [{ item_id_str: 'beef', quantity: 1 }]
            },
            { 
                id: 4, 
                recipe_id: 'hamburger', 
                recipe_name: '漢堡', 
                cooking_method: 'assembly', 
                cook_time_sec: 0, 
                output_item_id: 8, 
                output_item_id_str: 'hamburger',
                requirements: [
                    { item_id_str: 'bun', quantity: 1 },
                    { item_id_str: 'cut_tomato', quantity: 1 },
                    { item_id_str: 'cut_lettuce', quantity: 1 },
                    { item_id_str: 'cooked_beef', quantity: 1 }
                ]
            }
        ];
        
        res.json({
            success: true,
            items: mockItems,
            recipes: mockRecipes
        });
    });
    
    // 中介軟體: 檢查是否為管理員
    const ensureAdmin = async (req, res, next) => {
        try {
            const user = await getPlayerProfileFromToken(req.token);
            if (user && user.role === 'admin') {
                next();
            } else {
                res.status(403).json({ error: '權限不足，需要管理員身份' });
            }
        } catch (error) {
            res.status(401).json({ error: '無效的令牌' });
        }
    };

    // V3 API for Game Client - No admin required
    v3Router.get('/game-data', authenticateToken, async (req, res) => {
        try {
            console.log(`[API][V3] /game-data - 收到來自 user_id: ${req.user.user_id} 的遊戲資料請求`);
            const itemsPromise = pool.query('SELECT * FROM cook_items_v3 ORDER BY item_tier, item_id');
            const recipesPromise = pool.query('SELECT * FROM cook_recipes_v3 ORDER BY recipe_id');

            const [itemsResult, recipesResult] = await Promise.all([itemsPromise, recipesPromise]);

            console.log(`[API][V3] /game-data - 成功查詢到 ${itemsResult.rows.length} 個物品和 ${recipesResult.rows.length} 個食譜`);

            res.json({
                success: true,
                items: itemsResult.rows,
                recipes: recipesResult.rows,
            });
        } catch (error) {
            console.error('[API][V3] /game-data - 獲取遊戲資料時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器內部錯誤，無法獲取遊戲資料' });
        }
    });

    // GET all items (admin only)
    v3Router.get('/items', authenticateToken, ensureAdmin, async (req, res) => {
        try {
            console.log('\n=== 獲取 V3 物品列表 ===');
            const result = await pool.query(`
                SELECT * FROM cook_items_v3 
                ORDER BY item_tier ASC, item_name ASC
            `);
            console.log(`查詢到 ${result.rowCount} 個物品`);
            res.json(result.rows);
        } catch (error) {
            console.error('獲取 V3 物品列表時出錯:', error);
            res.status(500).json({ success: false, error: '無法獲取物品列表' });
        }
    });

    // 確保 v3Router 被正確註冊
    cookGameApp.use('/v3', v3Router);
    
    // 添加一個測試路由，不需要認證
    cookGameApp.get('/test', (req, res) => {
        res.json({ message: 'Cook Game API is working!' });
    });

    // 其他路由和中間件...

    // 模擬烹飪過程
    cookGameApp.post('/v3/simulate', authenticateToken, async (req, res) => {
        try {
            const { items, cookingMethod } = req.body;
            
            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ success: false, error: '請提供有效的物品列表' });
            }
            
            if (!cookingMethod) {
                return res.status(400).json({ success: false, error: '請提供烹飪方法' });
            }
            
            // 獲取物品詳情
            const itemIds = items.map(id => `'${id}'`).join(',');
            const itemsQuery = `SELECT * FROM cook_items_v3 WHERE item_id IN (${itemIds})`;
            const itemsResult = await pool.query(itemsQuery);
            
            if (itemsResult.rows.length !== items.length) {
                return res.status(400).json({ success: false, error: '提供的物品ID中有無效項目' });
            }
            
            // 檢查是否有符合條件的食譜
            const inputItems = itemsResult.rows;
            const outputTier = Math.min(2, Math.max(...inputItems.map(item => item.item_tier)) + 1);
            
            // 使用 findMatchingRecipe 函數查找匹配的食譜
            const recipe = await findMatchingRecipe(pool, items, cookingMethod, outputTier);
            
            if (!recipe) {
                return res.json({ 
                    success: false, 
                    error: '無法找到匹配的食譜',
                    ruleViolation: '這些食材無法用此方式烹飪成功。請嘗試其他組合或烹飪方法。'
                });
            }
            
            // 獲取輸出物品詳情
            const outputItemQuery = `SELECT * FROM cook_items_v3 WHERE item_id = $1`;
            const outputItemResult = await pool.query(outputItemQuery, [recipe.output_item_id]);
            
            if (outputItemResult.rows.length === 0) {
                return res.status(500).json({ success: false, error: '無法獲取輸出物品詳情' });
            }
            
            const outputItem = outputItemResult.rows[0];
            
            // 返回模擬結果
            res.json({
                success: true,
                outputItem,
                recipe: {
                    id: recipe.id,
                    output_item_id: recipe.output_item_id,
                    cooking_method: recipe.cooking_method,
                    cook_time_sec: recipe.cook_time_sec
                }
            });
            
        } catch (error) {
            console.error('模擬烹飪過程時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤' });
        }
    });
    
    // 根據輸出物品獲取單個食譜
    cookGameApp.post('/v3/recipe-by-output', authenticateToken, async (req, res) => {
        const { outputItemId } = req.body;
        if (!outputItemId) {
            return res.status(400).json({ success: false, error: '缺少 outputItemId' });
        }
        
        console.log(`[DEBUG] recipe-by-output 接收到請求，outputItemId: ${outputItemId}, 類型: ${typeof outputItemId}`);

        let client;
        try {
            client = await pool.connect();
            
            // 優先使用 item_id 查詢
            let query = `SELECT * FROM cook_recipes_v3 WHERE output_item_id::text = $1::text LIMIT 1`;
            let params = [outputItemId];
            console.log(`[DEBUG] 執行查詢 (by item_id): `, query, ', 參數:', params);
            let result = await client.query(query, params);

            // 如果用 item_id 查不到，再嘗試用 item_name 查詢
            if (result.rows.length === 0) {
                console.log(`[DEBUG] 使用 item_id 未找到食譜，嘗試使用 item_name 查詢...`);
                // 修正：在 cook_recipes_v3 中查找中文名，或者先在 cook_items_v3 找到 item_id
                // 這裡我們假設 output_item_id 欄位可能存的是中文名
                query = `
                    SELECT r.* 
                    FROM cook_recipes_v3 r
                    JOIN cook_items_v3 i ON r.output_item_id = i.item_name
                    WHERE i.item_id = $1 OR i.item_name = $1
                    LIMIT 1
                `;
                params = [outputItemId];
                console.log(`[DEBUG] 執行查詢 (by item_name or item_id in items table): `, query, ', 參數:', params);
                result = await client.query(query, params);

                // 如果還是找不到，最後直接在 recipes 表的 output_item_id 裡 fuzzy search 中文名
                if (result.rows.length === 0) {
                   console.log(`[DEBUG] 使用 item_name JOIN 查詢仍未找到食譜，嘗試直接在 recipe 表中模糊搜尋...`);
                   query = `SELECT * FROM cook_recipes_v3 WHERE output_item_id LIKE $1 LIMIT 1`;
                   params = [`%${outputItemId}%`];
                   console.log(`[DEBUG] 執行模糊查詢: `, query, ', 參數:', params);
                   result = await client.query(query, params);
                }
            }
            
            console.log(`[DEBUG] 查詢結果: ${result.rows.length} 行`);

            if (result.rows.length > 0) {
                const recipe = result.rows[0];
                // 將 JSON 字符串的 requirements 解析為對象
                if (typeof recipe.requirements === 'string') {
                    try {
                        recipe.requirements = JSON.parse(recipe.requirements);
                    } catch (e) {
                        console.error('解析食譜需求失敗:', e);
                        recipe.requirements = [];
                    }
                }
                res.json({ success: true, recipe });
            } else {
                console.log(`[DEBUG] 未找到 outputItemId 為 ${outputItemId} 的食譜`);
                res.status(404).json({ success: false, error: `未找到食譜: ${outputItemId}` });
            }
        } catch (error) {
            console.error('獲取食譜失敗:', error);
            res.status(500).json({ success: false, error: '內部伺服器錯誤' });
        } finally {
            if (client) client.release();
        }
    });

    // 根據輸出物品獲取多個可能的食譜
    cookGameApp.post('/v3/recipes-by-output', authenticateToken, async (req, res) => {
        try {
            const { outputItemId } = req.body;
            
            console.log(`[DEBUG] /v3/recipes-by-output: 接收到請求，outputItemId: ${outputItemId}`);
            
            if (!outputItemId) {
                return res.status(400).json({ success: false, error: '缺少必要參數: outputItemId' });
            }

            // 根據物品的 item_id (字串)，JOIN 食譜表，找出能產出此物品的食譜
            const query = `
                SELECT r.* 
                FROM cook_recipes_v3 r
                JOIN cook_items_v3 i ON r.output_item_id = i.id
                WHERE i.item_id = $1
            `;

            console.log(`[DEBUG] 執行 JOIN 查詢: ${query.replace(/\s+/g, ' ')}, 參數: [${outputItemId}]`);
            const result = await pool.query(query, [outputItemId]);
            
            if (result.rows.length === 0) {
                console.log(`[DEBUG] 未找到產出物為 ${outputItemId} 的食譜`);
                return res.status(404).json({ success: false, error: '未找到對應的食譜' });
            }
            
            // 查詢成功，直接使用資料庫返回的 requirements 欄位
            const recipes = result.rows.map(recipe => ({
                id: recipe.id,
                output_item_id: recipe.output_item_id,
                cooking_method: recipe.cooking_method,
                cook_time_sec: recipe.cook_time_sec || 3,
                requirements: recipe.requirements || [] // 使用 'requirements' 欄位，如果為 null 則返回空陣列
            }));
            
            console.log(`[DEBUG] JOIN查詢成功，返回 ${recipes.length} 個食譜`);
            res.json({ success: true, recipes });

        } catch (error) {
            console.error('[/v3/recipes-by-output] 獲取食譜列表失敗:', error);
            res.status(500).json({ 
                success: false, 
                error: `伺服器內部錯誤: ${error.message}`
            });
        }
    });

    // 從數據庫直接查詢食譜（後備方法）
    cookGameApp.post('/v3/db-recipes-by-output', authenticateToken, async (req, res) => {
        try {
            const { outputItemId, isStringId } = req.body;
            
            console.log(`[DEBUG] db-recipes-by-output 接收到請求，outputItemId: ${outputItemId}, 類型: ${typeof outputItemId}, isStringId: ${isStringId}`);
            
            if (!outputItemId) {
                return res.status(400).json({ success: false, error: '缺少必要參數' });
            }
            
            // 簡化：直接查詢 cook_recipes_v3，不再檢查不存在的表
            console.log(`[DEBUG] 檢查資料庫表結構...`);
            
            // 檢查 cook_recipes_v3 表是否存在
            const tableCheckQuery = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'cook_recipes_v3'
                );
            `;
            const tableCheckResult = await pool.query(tableCheckQuery);
            const recipesTableExists = tableCheckResult.rows[0].exists;
            
            console.log(`[DEBUG] cook_recipes_v3 表存在: ${recipesTableExists}`);
            
            if (!recipesTableExists) {
                return res.status(500).json({ 
                    success: false, 
                    error: '數據庫表結構不完整: cook_recipes_v3 表不存在',
                    table_status: { cook_recipes_v3: false }
                });
            }
            
            // 簡化：移除對 cook_recipe_requirements_v3 的檢查
            
            // 檢查 cook_items_v3 表是否存在
            const itemsTableCheckQuery = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'cook_items_v3'
                );
            `;
            const itemsTableCheckResult = await pool.query(itemsTableCheckQuery);
            const itemsTableExists = itemsTableCheckResult.rows[0].exists;
            
            console.log(`[DEBUG] cook_items_v3 表存在: ${itemsTableExists}`);
            
            // 簡化查詢邏輯，不再引用 cook_recipe_requirements_v3
            let query;
            let params;
            
            if (isStringId === true && itemsTableExists) {
                // 如果前端明確指出這是字符串ID，則使用JOIN查詢通過item_id查找
                query = `
                    SELECT r.id, r.output_item_id, r.cooking_method, r.cook_time_sec
                    FROM cook_recipes_v3 r
                    LEFT JOIN cook_items_v3 i ON r.output_item_id = i.id
                    WHERE i.item_id = $1
                `;
                params = [outputItemId];
                console.log(`[DEBUG] 使用JOIN查詢通過item_id查找: ${outputItemId}`);
            } else {
                // 嘗試多種方式查找匹配的食譜
                query = `
                    SELECT r.id, r.output_item_id, r.cooking_method, r.cook_time_sec
                    FROM cook_recipes_v3 r
                    WHERE r.output_item_id::text = $1::text
                       OR r.output_item_id = $1::integer
                `;
                params = [outputItemId];
            }
            
            console.log(`[DEBUG] 執行查詢: ${query.replace(/\s+/g, ' ')}, 參數: [${params}]`);
            
            const result = await pool.query(query, params);
            
            console.log(`[DEBUG] 查詢結果: ${result.rowCount} 行`);
            
            if (result.rows.length === 0) {
                console.log(`[DEBUG] 未找到 outputItemId 為 ${outputItemId} 的食譜`);
                
                // 簡化備用查詢，不再引用 cook_recipe_requirements_v3
                if (!isStringId && itemsTableExists) {
                    const fallbackQuery = `
                        SELECT r.id, r.output_item_id, r.cooking_method, r.cook_time_sec
                        FROM cook_recipes_v3 r
                        LEFT JOIN cook_items_v3 i ON r.output_item_id = i.id
                        WHERE i.item_id = $1
                    `;
                    
                    console.log(`[DEBUG] 嘗試備用查詢: ${fallbackQuery.replace(/\s+/g, ' ')}, 參數: [${outputItemId}]`);
                    
                    const fallbackResult = await pool.query(fallbackQuery, [outputItemId]);
                    
                    if (fallbackResult.rows.length > 0) {
                        console.log(`[DEBUG] 備用查詢成功，找到 ${fallbackResult.rowCount} 行`);
                        
                        // 簡化：返回結果，不再查詢需求
                        const formattedRecipes = fallbackResult.rows.map(recipe => ({
                            id: recipe.id,
                            output_item_id: recipe.output_item_id,
                            cooking_method: recipe.cooking_method,
                            cook_time_sec: recipe.cook_time_sec || 3,
                            requirements: []
                        }));
                        
                        return res.json({ success: true, recipes: formattedRecipes });
                    }
                } else if (isStringId === true) {
                    // 如果isStringId為true但第一次查詢失敗，嘗試反向查詢
                    const reverseQuery = `
                        SELECT r.id, r.output_item_id, r.cooking_method, r.cook_time_sec
                        FROM cook_recipes_v3 r
                        WHERE r.output_item_id::text = $1::text
                    `;
                    
                    console.log(`[DEBUG] isStringId為true但JOIN查詢失敗，嘗試直接比較: ${reverseQuery.replace(/\s+/g, ' ')}, 參數: [${outputItemId}]`);
                    
                    const reverseResult = await pool.query(reverseQuery, [outputItemId]);
                    
                    if (reverseResult.rows.length > 0) {
                        console.log(`[DEBUG] 反向查詢成功，找到 ${reverseResult.rowCount} 行`);
                        
                        // 簡化：返回結果，不再查詢需求
                        const formattedRecipes = reverseResult.rows.map(recipe => ({
                            id: recipe.id,
                            output_item_id: recipe.output_item_id,
                            cooking_method: recipe.cooking_method,
                            cook_time_sec: recipe.cook_time_sec || 3,
                            requirements: []
                        }));
                        
                        return res.json({ success: true, recipes: formattedRecipes });
                    }
                }
                
                return res.status(404).json({ 
                    success: false, 
                    error: '未找到對應的食譜',
                    table_status: {
                        cook_recipes_v3: recipesTableExists,
                        cook_items_v3: itemsTableExists
                    }
                });
            }
            
            // 簡化：返回結果，不再查詢需求
            const formattedRecipes = result.rows.map(recipe => ({
                id: recipe.id,
                output_item_id: recipe.output_item_id,
                cooking_method: recipe.cooking_method,
                cook_time_sec: recipe.cook_time_sec || 3,
                requirements: []
            }));
            
            console.log(`[DEBUG] 返回格式化食譜列表: ${JSON.stringify(formattedRecipes)}`);
            
            res.json({ success: true, recipes: formattedRecipes });
        } catch (error) {
            console.error('從數據庫查詢食譜失敗:', error);
            console.error(`[DEBUG] 錯誤詳情: ${JSON.stringify({
                message: error.message,
                code: error.code,
                stack: error.stack
            })}`);
            res.status(500).json({ 
                success: false, 
                error: `從數據庫查詢食譜失敗: ${error.message}`,
                details: `錯誤碼: ${error.code}, 位置: ${error.position || 'N/A'}, 例程: ${error.routine || 'N/A'}`
            });
        }
    });
    
    // 輔助函數：處理食譜查詢結果
    function processRecipeResults(rows) {
        const recipesMap = {};
        
        rows.forEach(row => {
            if (!recipesMap[row.id]) {
                recipesMap[row.id] = {
                    id: row.id,
                    output_item_id: row.output_item_id,
                    cooking_method: row.cooking_method,
                    cook_time_sec: row.cook_time_sec || 3,
                    requirements: []
                };
            }
            
            if (row.item_id) {
                recipesMap[row.id].requirements.push({
                    item_id: row.item_id,
                    quantity: row.quantity
                });
            }
        });
        
        return recipesMap;
    }

    // 獲取所有食譜數據的新端點
    cookGameApp.get('/v3/all-recipes', authenticateToken, async (req, res) => {
        try {
            console.log(`[DEBUG] /v3/all-recipes: 接收到獲取所有食譜的請求`);
            
            // 直接查詢所有食譜，並包含 'requirements' 欄位
            const query = `
                SELECT id, recipe_name, output_item_id, cooking_method, cook_time_sec, requirements
                FROM cook_recipes_v3
                ORDER BY id
            `;
            
            console.log(`[DEBUG] 執行查詢所有食譜: ${query.replace(/\s+/g, ' ')}`);
            const result = await pool.query(query);
            
            console.log(`[DEBUG] 查詢結果: ${result.rowCount} 行`);
            
            // 將查詢結果直接映射，包含完整的 requirements
            const recipes = result.rows.map(row => ({
                id: row.id,
                recipe_name: row.recipe_name,
                output_item_id: row.output_item_id,
                cooking_method: row.cooking_method,
                cook_time_sec: row.cook_time_sec || 3,
                requirements: row.requirements || []
            }));
            
            console.log(`[DEBUG] 返回所有食譜 (包含需求資訊): ${recipes.length} 個`);
            res.json({ success: true, recipes });

        } catch (error) {
            console.error('[/v3/all-recipes] 獲取所有食譜失敗:', error);
            res.status(500).json({ success: false, error: `伺服器內部錯誤: ${error.message}` });
        }
    });

    // 返回Express應用實例
    return cookGameApp;
}

// WebSocket 相关功能
// ... existing code ...

/**
 * 查找匹配的食譜
 * @param {Object} client - 數據庫客戶端
 * @param {Array<string>} items - 輸入物品ID列表
 * @param {string} cookingMethod - 烹飪方法
 * @param {number} expectedOutputTier - 預期產出物品的層級
 * @returns {Promise<Object|null>} 匹配的食譜或null
 */
async function findMatchingRecipe(client, items, cookingMethod, expectedOutputTier) {
    // 創建輸入物品的頻率對照表
    const inputItemsMap = items.reduce((acc, itemId) => {
        acc[itemId] = (acc[itemId] || 0) + 1;
        return acc;
    }, {});
    
    // 查詢可能匹配的食譜
    const recipesResult = await client.query(`
        SELECT r.*, i.item_tier
        FROM cook_recipes_v3 r
        JOIN cook_items_v3 i ON r.output_item_id = i.id
        WHERE r.cooking_method = $1 AND i.item_tier = $2
    `, [cookingMethod, expectedOutputTier]);
    
    // 遍歷食譜尋找匹配的
    for (const recipe of recipesResult.rows) {
        if (!recipe.requirements) continue;
        
        // 創建食譜需求的頻率對照表
        const recipeReqsMap = recipe.requirements.reduce((acc, req) => {
            acc[req.item_id] = (acc[req.item_id] || 0) + req.quantity;
            return acc;
        }, {});
        
        // 比較輸入物品和食譜需求
        const inputKeys = Object.keys(inputItemsMap);
        const recipeKeys = Object.keys(recipeReqsMap);
        
        // 物品數量必須相同
        if (inputKeys.length !== recipeKeys.length) continue;
        
        // 每個物品的數量必須匹配
        const isMatch = recipeKeys.every(key => inputItemsMap[key] === recipeReqsMap[key]);
        
        if (isMatch) {
            return recipe;
        }
    }
    
    return null;
}

module.exports = { 
    initializeCookGame
};