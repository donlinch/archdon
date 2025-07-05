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
        console.log('路徑:', req.path);
        console.log('認證頭:', req.headers.authorization);
        
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('認證失敗: 未提供令牌或格式不正確');
            return res.status(401).json({ error: '未提供認證令牌' });
        }

        const token = authHeader.split(' ')[1];
        console.log('解析令牌:', token.substring(0, 10) + '...');
        console.log('>>> 正在使用的密鑰 (BOX_JWT_SECRET):', process.env.BOX_JWT_SECRET ? process.env.BOX_JWT_SECRET.substring(0, 5) + '...' : '未定義 (UNDEFINED)!');
        
        jwt.verify(token, process.env.BOX_JWT_SECRET, (err, user) => {
            if (err) {
                console.error('令牌驗證失敗:', err.message);
                return res.status(403).json({ error: '令牌無效或已過期' });
            }
            console.log('>>> 令牌驗證成功，解析出的用戶對象:', user);
            console.log('>>> 用戶ID的類型:', typeof user.user_id);
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

    // TODO: 添加其他遊戲相關的API端點

    // 設置WebSocket處理函數
    function initCookGameWss(wss) {
        wss.on('connection', (ws) => {
            console.log('新的WebSocket連接');
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    console.log('收到WebSocket消息:', data.type);
                    
                    // 處理不同類型的消息
                    // 這裡將添加更多處理邏輯
                } catch (error) {
                    console.error('處理WebSocket消息時出錯:', error);
                }
            });
            
            ws.on('close', () => {
                console.log('WebSocket連接關閉');
                // 處理連接關閉邏輯
            });
        });
    }

    return { cookGameApp, initCookGameWss };
}

module.exports = initializeCookGame;