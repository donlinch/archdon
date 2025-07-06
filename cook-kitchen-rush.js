// cook-kitchen-rush.js
// 料理急先鋒遊戲伺服器模組

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// 創建遊戲的Express應用實例
function initializeCookGame(pool) {
    const cookGameApp = express.Router();
    
    // 身份驗證中間件
    const authenticateToken = (req, res, next) => {
        console.log('\n=== 認證請求 ===');
          
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('認證失敗: 未提供令牌或格式不正確');
            return res.status(401).json({ error: '未提供認證令牌' });
        }

        const token = authHeader.split(' ')[1];
          
        jwt.verify(token, process.env.BOX_JWT_SECRET, (err, user) => {
            if (err) {
                console.error('令牌驗證失敗:', err.message);
                return res.status(403).json({ error: '令牌無效或已過期' });
            }
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

    // #region 任務管理 API
    // GET all quest templates
    cookGameApp.get('/admin/quest-templates', authenticateToken, isAdmin, async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM cook_quest_templates ORDER BY id ASC');
            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching quest templates:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch quest templates' });
        }
    });

    // POST (Create/Update) a quest template
    cookGameApp.post('/admin/quest-templates', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { id, quest_type, description, base_target, reward_points, is_daily } = req.body;
            let result;
            if (id) {
                // Update
                result = await pool.query(
                    'UPDATE cook_quest_templates SET quest_type = $1, description = $2, base_target = $3, reward_points = $4, is_daily = $5 WHERE id = $6 RETURNING *',
                    [quest_type, description, base_target, reward_points, is_daily, id]
                );
            } else {
                // Create
                result = await pool.query(
                    'INSERT INTO cook_quest_templates (quest_type, description, base_target, reward_points, is_daily) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                    [quest_type, description, base_target, reward_points, is_daily]
                );
            }
            res.json({ success: true, quest: result.rows[0] });
        } catch (error) {
            console.error('Error saving quest template:', error);
            res.status(500).json({ success: false, error: 'Failed to save quest template' });
        }
    });

    // DELETE a quest template
    cookGameApp.delete('/admin/quest-templates/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            await pool.query('DELETE FROM cook_quest_templates WHERE id = $1', [id]);
            res.json({ success: true, message: 'Quest template deleted successfully.' });
        } catch (error) {
            console.error('Error deleting quest template:', error);
            res.status(500).json({ success: false, error: 'Failed to delete quest template' });
        }
    });
    // #endregion

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

    // 玩家登入API
    cookGameApp.post('/player/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            
            const userResult = await pool.query('SELECT * FROM box_users WHERE username = $1', [username]);
            if (userResult.rows.length === 0) {
                return res.status(401).json({ error: '用戶名或密碼錯誤' });
            }
            
            const user = userResult.rows[0];
            
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (!isPasswordValid) {
                return res.status(401).json({ error: '用戶名或密碼錯誤' });
            }

            // 檢查玩家是否存在於cook_players，如果不存在則創建
            let playerResult = await pool.query('SELECT * FROM cook_players WHERE user_id = $1', [user.user_id]);
            if (playerResult.rows.length === 0) {
                await pool.query('INSERT INTO cook_players (user_id) VALUES ($1)', [user.user_id]);
            }
            
            const token = jwt.sign({ user_id: user.user_id, username: user.username }, process.env.BOX_JWT_SECRET, { expiresIn: '24h' });

            // 登入後立即檢查稱號解鎖
            const unlockedTitles = await checkTitleUnlocks(user.user_id);

            // --- DEBUG: 追蹤角色問題 ---
            console.log('>>> [角色追蹤] 準備查詢角色，完整使用者物件:', JSON.stringify(user, null, 2));

            // 查詢用戶角色
            const roleResult = await pool.query(`
                SELECT role_id 
                FROM public.user_role_assignments 
                WHERE user_id = $1
            `, [user.user_id]);

            console.log('>>> [角色追蹤] 資料庫角色查詢結果 (roleResult):', JSON.stringify(roleResult, null, 2));

            const userRole = roleResult.rows.length > 0 ? roleResult.rows[0].role_id : null;
            
            console.log('>>> [角色追蹤] 最終解析出的 userRole:', userRole);
            // --- END DEBUG ---

            res.json({
                message: '登入成功',
                token,
                userId: user.user_id,
                username: user.username,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
                role: userRole,  // 返回數據庫中的角色ID
                unlockedTitles: unlockedTitles
            });
        } catch (error) {
            console.error('登入時出錯:', error);
            res.status(500).json({ error: '伺服器錯誤' });
        }
    });

    // 獲取當前登入玩家的個人資料
    cookGameApp.get('/player/profile', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.user_id;
            const result = await pool.query(`
                SELECT 
                    p.user_id, 
                    p.level, 
                    p.points, 
                    p.games_played, 
                    p.orders_completed,
                    u.username,
                    u.avatar_url,
                    (SELECT array_agg(r.role_id) FROM user_roles r WHERE r.user_id = p.user_id) as roles
                FROM cook_players p
                JOIN box_users u ON p.user_id = u.user_id
                WHERE p.user_id = $1
            `, [userId]);

            if (result.rows.length === 0) {
                // Fallback to check box_users directly if no player data
                const userResult = await pool.query(`
                    SELECT 
                        u.user_id, 
                        u.username, 
                        u.avatar_url,
                        (SELECT array_agg(r.role_id) FROM user_roles r WHERE r.user_id = u.user_id) as roles
                    FROM box_users u 
                    WHERE u.user_id = $1
                `, [userId]);
                if (userResult.rows.length === 0) {
                     return res.status(404).json({ error: '玩家資料不存在' });
                }
                const basicProfile = userResult.rows[0];
                // return basic profile with default game stats
                return res.json({
                    user_id: basicProfile.user_id,
                    level: 1,
                    points: 0,
                    games_played: 0,
                    orders_completed: 0,
                    username: basicProfile.username,
                    avatar_url: basicProfile.avatar_url,
                    roles: basicProfile.roles || []
                });
            }
            
            res.json(result.rows[0]);
        } catch (error) {
            console.error('獲取玩家資料時出錯:', error);
            res.status(500).json({ error: '伺服器錯誤' });
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

            if (hasT1Item) {
                if (cookingMethod !== 'assembly') {
                    return res.json({ 
                        success: false, 
                        ruleViolation: '規則錯誤: 包含 T1 半成品的食譜必須使用「組合」方法。' 
                    });
                }
            } else if (allAreT0Items) {
                if (cookingMethod === 'assembly') {
                    return res.json({ 
                        success: false, 
                        ruleViolation: '規則錯誤: 只包含 T0 基礎食材的食譜不能使用「組合」方法。' 
                    });
                }
            }

            const inputItemsMap = items.reduce((acc, itemId) => {
                acc[itemId] = (acc[itemId] || 0) + 1;
                return acc;
            }, {});
            
            const recipesResult = await client.query(`
                SELECT recipe_id, output_item_id, requirements 
                FROM cook_recipes_v3 
                WHERE cooking_method = $1
            `, [cookingMethod]);

            let matchedRecipe = null;

            for (const recipe of recipesResult.rows) {
                if (!recipe.requirements) continue;

                const recipeReqsMap = recipe.requirements.reduce((acc, req) => {
                    acc[req.item_id] = (acc[req.item_id] || 0) + req.quantity;
                    return acc;
                }, {});

                const inputKeys = Object.keys(inputItemsMap);
                const recipeKeys = Object.keys(recipeReqsMap);

                if (inputKeys.length !== recipeKeys.length) continue;

                const isMatch = recipeKeys.every(key => inputItemsMap[key] === recipeReqsMap[key]);

                if (isMatch) {
                    matchedRecipe = recipe;
                    break;
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
                res.json({ success: true, outputItem: outputItemResult.rows[0] });
            } else {
                await client.query('COMMIT');
                res.json({ success: false, error: '找不到匹配的食譜。請檢查食材組合和烹飪方法。' });
            }
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[V3] 模擬烹飪時出錯:', error);
            res.status(500).json({ success: false, error: '伺服器錯誤', details: error.message });
        } finally {
            client.release();
        }
    });

    return cookGameApp;
}

// WebSocket 相关功能
function initializeCookGameWss(wss, pool) {
    // 存储所有连接的客户端
    const clients = new Map();
    // 存储游戏房间
    const gameRooms = new Map();

    wss.on('connection', async (ws, req) => {
        console.log('\n=== 新的 WebSocket 连接 ===');
        
        // 解析token和用户信息
        const token = req.url.split('token=')[1];
        if (!token) {
            ws.close(1008, '未提供认证令牌');
            return;
        }

        try {
            const user = jwt.verify(token, process.env.BOX_JWT_SECRET);
            ws.userId = user.user_id;
            ws.username = user.username;
            clients.set(ws.userId, ws);
            console.log(`玩家 ${ws.username}(${ws.userId}) 已连接`);

            // 新增：为玩家生成或加载每日任务
            await generateDailyQuests(pool, ws.userId);

            // 发送初始数据（包含任务）
            const playerData = await getPlayerData(ws.userId);
            ws.send(JSON.stringify({
                type: 'init',
                data: playerData
            }));

            // 处理消息
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await handleGameMessage(ws, data);
                } catch (error) {
                    console.error('处理消息时出错:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: '消息处理失败'
                    }));
                }
            });

            // 处理连接关闭
            ws.on('close', () => {
                console.log(`玩家 ${ws.username}(${ws.userId}) 已断开连接`);
                clients.delete(ws.userId);
                handlePlayerDisconnect(ws);
            });

        } catch (error) {
            console.error('WebSocket 认证失败:', error);
            ws.close(1008, '认证失败');
        }
    });

    // 获取玩家数据
    async function getPlayerData(userId) {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    p.*, 
                    u.username,
                    u.display_name,
                    u.avatar_url,
                    i.items,
                    t.titles,
                    q.quests
                FROM cook_players p
                JOIN box_users u ON p.user_id = u.user_id
                LEFT JOIN LATERAL (
                    SELECT json_agg(json_build_object(
                        'item_id', i.item_id,
                        'quantity', i.quantity
                    )) as items
                    FROM cook_player_inventory i
                    WHERE i.user_id = p.user_id
                ) i ON true
                LEFT JOIN LATERAL (
                    SELECT json_agg(json_build_object(
                        'title_id', t.title_id,
                        'title_name', ct.title_name,
                        'is_selected', t.is_selected
                    )) as titles
                    FROM cook_user_titles t
                    JOIN cook_titles ct ON t.title_id = ct.id
                    WHERE t.user_id = p.user_id
                ) t ON true
                LEFT JOIN LATERAL (
                    SELECT json_agg(json_build_object(
                        'id', q.id,
                        'quest_type', q.quest_type,
                        'target_value', q.target_value,
                        'current_progress', q.current_progress,
                        'reward_points', q.reward_points,
                        'completed', q.completed,
                        'quest_data', q.quest_data
                    )) as quests
                    FROM cook_player_quests q
                    WHERE q.user_id = p.user_id AND q.completed = false AND q.created_at >= CURRENT_DATE
                ) q ON true
                WHERE p.user_id = $1
            `, [userId]);

            if (result.rows.length > 0) {
                return result.rows[0];
            }
            return null;
        } finally {
            client.release();
        }
    }

    // 处理游戏消息
    async function handleGameMessage(ws, data) {
        switch (data.type) {
            case 'cook':
                await handleCookingAction(ws, data);
                break;
            case 'join_room':
                await handleJoinRoom(ws, data);
                break;
            case 'leave_room':
                await handleLeaveRoom(ws, data);
                break;
            case 'chat':
                await handleChatMessage(ws, data);
                break;
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    error: '未知的消息类型'
                }));
        }
    }

    // 处理烹饪动作
    async function handleCookingAction(ws, data) {
        const { ingredients, method, cookingTime } = data; // 假设客户端会发送 cookingTime
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // 验证玩家拥有所需材料
            const hasIngredients = await checkPlayerIngredients(client, ws.userId, ingredients);
            if (!hasIngredients) {
                throw new Error('缺少所需材料');
            }

            // 查找匹配的食谱
            const recipe = await findMatchingRecipe(client, ingredients, method);
            if (!recipe) {
                throw new Error('找不到匹配的食谱');
            }

            // 扣除材料
            await removePlayerIngredients(client, ws.userId, ingredients);

            // 添加产出物品
            await addPlayerItem(client, ws.userId, recipe.output_item_id, 1);

            // 更新玩家经验值
            await updatePlayerExperience(client, ws.userId, recipe.exp_reward || 10);

            await client.query('COMMIT');

            // --- 新增: 烹饪后系统逻辑 ---
            const score = await calculateCookingScore(client, recipe, cookingTime || 30);
            await client.query('UPDATE cook_players SET points = points + $1 WHERE user_id = $2', [score, ws.userId]);
            
            const newAchievements = await checkAchievements(client, ws.userId, 'total_dishes', 1);

            const completedQuests = [];
            const q1 = await checkQuestProgress(client, ws.userId, 'COOK_DISHES', 1);
            const q2 = await checkQuestProgress(client, ws.userId, 'USE_INGREDIENTS', ingredients.length);
            const q3 = await checkQuestProgress(client, ws.userId, 'ACHIEVE_SCORE', score);
            if(q1) completedQuests.push(...q1);
            if(q2) completedQuests.push(...q2);
            if(q3) completedQuests.push(...q3);

            // 发送结果给玩家
            ws.send(JSON.stringify({
                type: 'cook_result',
                success: true,
                recipe: recipe,
                inventory: await getPlayerInventory(client, ws.userId),
                score,
                newAchievements,
                completedQuests
            }));

        } catch (error) {
            await client.query('ROLLBACK');
            ws.send(JSON.stringify({
                type: 'cook_result',
                success: false,
                error: error.message
            }));
        } finally {
            client.release();
        }
    }

    // 处理加入房间
    async function handleJoinRoom(ws, data) {
        const { roomId } = data;
        let room = gameRooms.get(roomId);
        
        if (!room) {
            room = {
                id: roomId,
                players: new Map(),
                state: 'waiting'
            };
            gameRooms.set(roomId, room);
        }

        room.players.set(ws.userId, {
            ws,
            username: ws.username,
            ready: false
        });

        // 广播房间信息
        broadcastToRoom(room, {
            type: 'room_update',
            players: Array.from(room.players.values()).map(p => ({
                userId: p.ws.userId,
                username: p.username,
                ready: p.ready
            }))
        });
    }

    // 处理离开房间
    async function handleLeaveRoom(ws, data) {
        const { roomId } = data;
        const room = gameRooms.get(roomId);
        
        if (room) {
            room.players.delete(ws.userId);
            
            if (room.players.size === 0) {
                gameRooms.delete(roomId);
            } else {
                broadcastToRoom(room, {
                    type: 'room_update',
                    players: Array.from(room.players.values()).map(p => ({
                        userId: p.ws.userId,
                        username: p.username,
                        ready: p.ready
                    }))
                });
            }
        }
    }

    // 处理聊天消息
    async function handleChatMessage(ws, data) {
        const { roomId, message } = data;
        const room = gameRooms.get(roomId);
        
        if (room) {
            broadcastToRoom(room, {
                type: 'chat',
                userId: ws.userId,
                username: ws.username,
                message: message
            });
        }
    }

    // 处理玩家断开连接
    function handlePlayerDisconnect(ws) {
        // 从所有房间中移除玩家
        for (const [roomId, room] of gameRooms) {
            if (room.players.has(ws.userId)) {
                room.players.delete(ws.userId);
                
                if (room.players.size === 0) {
                    gameRooms.delete(roomId);
                } else {
                    broadcastToRoom(room, {
                        type: 'room_update',
                        players: Array.from(room.players.values()).map(p => ({
                            userId: p.ws.userId,
                            username: p.username,
                            ready: p.ready
                        }))
                    });
                }
            }
        }
    }

    // 广播消息给房间内所有玩家
    function broadcastToRoom(room, message) {
        const messageStr = JSON.stringify(message);
        for (const player of room.players.values()) {
            if (player.ws.readyState === 1) { // WebSocket.OPEN
                player.ws.send(messageStr);
            }
        }
    }

    // 定期清理断开连接的客户端
    setInterval(() => {
        for (const [userId, ws] of clients) {
            if (ws.readyState !== 1) { // 不是 OPEN 状态
                clients.delete(userId);
                handlePlayerDisconnect(ws);
            }
        }
    }, 30000); // 每30秒清理一次
}

// 检查玩家是否拥有所需材料
async function checkPlayerIngredients(client, userId, ingredients) {
    const result = await client.query(`
        SELECT item_id, quantity 
        FROM cook_player_inventory 
        WHERE user_id = $1 AND item_id = ANY($2)
    `, [userId, ingredients.map(i => i.item_id)]);

    const inventory = result.rows.reduce((acc, row) => {
        acc[row.item_id] = row.quantity;
        return acc;
    }, {});

    return ingredients.every(ing => 
        inventory[ing.item_id] && inventory[ing.item_id] >= ing.quantity
    );
}

// 查找匹配的食谱
async function findMatchingRecipe(client, ingredients, method) {
    // 获取所有使用指定烹饪方法的食谱
    const recipesResult = await client.query(`
        SELECT r.*, json_agg(
            json_build_object(
                'item_id', rr.required_item_id,
                'quantity', rr.quantity
            )
        ) as requirements
        FROM cook_recipes_v2 r
        JOIN cook_recipe_requirements_v2 rr ON r.recipe_id = rr.recipe_id
        WHERE r.cooking_method = $1
        GROUP BY r.recipe_id
    `, [method]);

    // 创建输入材料的映射
    const inputMap = ingredients.reduce((acc, ing) => {
        acc[ing.item_id] = ing.quantity;
        return acc;
    }, {});

    // 查找完全匹配的食谱
    return recipesResult.rows.find(recipe => {
        const recipeMap = recipe.requirements.reduce((acc, req) => {
            acc[req.item_id] = req.quantity;
            return acc;
        }, {});

        // 检查材料数量是否完全匹配
        return Object.keys(inputMap).length === Object.keys(recipeMap).length &&
            Object.entries(inputMap).every(([id, qty]) => recipeMap[id] === qty);
    });
}

// 从玩家库存中移除材料
async function removePlayerIngredients(client, userId, ingredients) {
    for (const ing of ingredients) {
        await client.query(`
            UPDATE cook_player_inventory
            SET quantity = quantity - $1
            WHERE user_id = $2 AND item_id = $3
        `, [ing.quantity, userId, ing.item_id]);

        // 如果数量为0，删除记录
        await client.query(`
            DELETE FROM cook_player_inventory
            WHERE user_id = $1 AND item_id = $2 AND quantity <= 0
        `, [userId, ing.item_id]);
    }
}

// 添加物品到玩家库存
async function addPlayerItem(client, userId, itemId, quantity) {
    // 检查是否已有该物品
    const existingResult = await client.query(`
        SELECT quantity 
        FROM cook_player_inventory 
        WHERE user_id = $1 AND item_id = $2
    `, [userId, itemId]);

    if (existingResult.rows.length > 0) {
        // 更新现有数量
        await client.query(`
            UPDATE cook_player_inventory
            SET quantity = quantity + $1
            WHERE user_id = $2 AND item_id = $3
        `, [quantity, userId, itemId]);
    } else {
        // 新增记录
        await client.query(`
            INSERT INTO cook_player_inventory (user_id, item_id, quantity)
            VALUES ($1, $2, $3)
        `, [userId, itemId, quantity]);
    }
}

// 更新玩家经验值和等级
async function updatePlayerExperience(client, userId, expGained) {
    // 获取当前等级和经验值
    const playerResult = await client.query(`
        SELECT level, exp_current, exp_required
        FROM cook_players
        WHERE user_id = $1
    `, [userId]);

    if (playerResult.rows.length === 0) return;

    let { level, exp_current, exp_required } = playerResult.rows[0];
    exp_current += expGained;

    // 检查是否升级
    while (exp_current >= exp_required) {
        exp_current -= exp_required;
        level += 1;
        exp_required = calculateExpRequired(level); // 计算新等级所需经验
    }

    // 更新玩家数据
    await client.query(`
        UPDATE cook_players
        SET level = $1, exp_current = $2, exp_required = $3
        WHERE user_id = $4
    `, [level, exp_current, exp_required, userId]);

    // 检查新的称号解锁
    await checkTitleUnlocks(userId);

    return { level, exp_current, exp_required };
}

// 计算升级所需经验值
function calculateExpRequired(level) {
    // 使用常见的RPG经验计算公式
    return Math.floor(100 * Math.pow(1.5, level - 1));
}

// 获取玩家库存
async function getPlayerInventory(client, userId) {
    const result = await client.query(`
        SELECT i.item_id, i.quantity, items.item_name, items.ascii_symbol
        FROM cook_player_inventory i
        JOIN cook_items items ON i.item_id = items.id
        WHERE i.user_id = $1
        ORDER BY items.item_name
    `, [userId]);
    return result.rows;
}

// 新增: 烹饪评分系统
async function calculateCookingScore(client, recipe, cookingTime) {
    const baseScore = 100;
    let finalScore = baseScore;
    
    // 1. 时间评分 (理想时间 ±20% 内获得满分)
    const idealTime = recipe.ideal_cooking_time || 30; // 默认30秒
    const timeDiff = Math.abs(cookingTime - idealTime);
    const timeScore = Math.max(0, 100 - (timeDiff / idealTime * 100));
    finalScore *= (timeScore * 0.3 + 0.7); // 时间影响30%的总分

    // 2. 食谱难度加成
    const difficultyBonus = (recipe.requirements?.length || 1) * 0.1;
    finalScore *= (1 + difficultyBonus);

    // 3. 稀有度加成
    const rarityBonus = recipe.rarity_multiplier || 1;
    finalScore *= rarityBonus;

    return Math.round(finalScore);
}

// 新增: 成就系统
async function checkAchievements(client, userId, action, value) {
    const achievements = {
        COOKING_MASTER: { type: 'total_dishes', threshold: 100 },
        SPEED_CHEF: { type: 'fast_cooking', threshold: 50 },
        PERFECTIONIST: { type: 'perfect_score', threshold: 10 },
        INGREDIENT_COLLECTOR: { type: 'unique_ingredients', threshold: 30 }
    };

    const stats = await client.query(`
        SELECT achievement_progress
        FROM cook_players
        WHERE user_id = $1
    `, [userId]);

    const progress = stats.rows[0]?.achievement_progress || {};
    progress[action] = (progress[action] || 0) + value;

    // 检查是否达成新成就
    const newAchievements = [];
    for (const [id, achievement] of Object.entries(achievements)) {
        if (progress[achievement.type] >= achievement.threshold) {
            const isNew = await unlockAchievement(client, userId, id);
            if (isNew) newAchievements.push(id);
        }
    }

    // 更新进度
    await client.query(`
        UPDATE cook_players
        SET achievement_progress = $1
        WHERE user_id = $2
    `, [JSON.stringify(progress), userId]);

    return newAchievements;
}

// 新增: 解锁成就
async function unlockAchievement(client, userId, achievementId) {
    const result = await client.query(`
        INSERT INTO cook_player_achievements (user_id, achievement_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, achievement_id) DO NOTHING
        RETURNING id
    `, [userId, achievementId]);

    return result.rowCount > 0;
}

// 新增: 每日任务系统
async function generateDailyQuests(pool, userId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 清除昨天的未完成任务
        await client.query(`
            DELETE FROM cook_player_quests
            WHERE user_id = $1 AND completed = false AND created_at < CURRENT_DATE
        `, [userId]);

        // 检查今天是否已经生成过任务
        const existingQuests = await client.query(`
            SELECT id FROM cook_player_quests
            WHERE user_id = $1 AND created_at = CURRENT_DATE
        `, [userId]);

        if (existingQuests.rowCount > 0) {
            console.log(`玩家 ${userId} 的每日任务已存在。`);
            await client.query('COMMIT');
            return; // 已生成，无需重复操作
        }

        const questTemplates = await client.query('SELECT * FROM cook_quest_templates WHERE is_daily = TRUE ORDER BY RANDOM() LIMIT 3');
        
        if (questTemplates.rows.length === 0) {
            console.log('没有可用的每日任务模板。');
            await client.query('COMMIT');
            return;
        }

        for (const template of questTemplates.rows) {
            await client.query(`
                INSERT INTO cook_player_quests (user_id, quest_type, target_value, reward_points, quest_data, description)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId, template.quest_type, template.base_target, template.reward_points, template.quest_data, template.description]);
        }
        
        console.log(`已为玩家 ${userId} 生成 ${questTemplates.rowCount} 个新的每日任务。`);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`为玩家 ${userId} 生成每日任务时出错:`, error);
    } finally {
        client.release();
    }
}

// 新增: 检查任务完成情况
async function checkQuestProgress(client, userId, action, value) {
    const quests = await client.query(`
        SELECT * FROM cook_player_quests
        WHERE user_id = $1 AND completed = false
    `, [userId]);

    const completedQuests = [];
    for (const quest of quests.rows) {
        if (quest.quest_type === action) {
            const progress = quest.current_progress + value;
            if (progress >= quest.target_value) {
                // 完成任务
                await client.query(`
                    UPDATE cook_player_quests
                    SET completed = true, completed_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [quest.id]);
                
                // 发放奖励
                await client.query(`
                    UPDATE cook_players
                    SET points = points + $1
                    WHERE user_id = $2
                `, [quest.reward_points, userId]);

                completedQuests.push(quest);
            } else {
                // 更新进度
                await client.query(`
                    UPDATE cook_player_quests
                    SET current_progress = $1
                    WHERE id = $2
                `, [progress, quest.id]);
            }
        }
    }

    return completedQuests;
}

// 导出模块
module.exports = { 
    initializeCookGame,
    initializeCookGameWss
};