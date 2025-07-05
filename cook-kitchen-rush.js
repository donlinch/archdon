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
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: '未提供認證令牌' });
        }

        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.COOK_JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ error: '令牌無效或已過期' });
            }
            req.user = user;
            next();
        });
    };

    // 管理員權限中間件
    const isAdmin = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const result = await pool.query(`
                SELECT is_admin FROM cook_players WHERE user_id = $1
            `, [userId]);

            if (result.rows.length > 0 && result.rows[0].is_admin) {
                next();
            } else {
                res.status(403).json({ error: '需要管理員權限' });
            }
        } catch (error) {
            console.error('驗證管理員權限時出錯:', error);
            res.status(500).json({ error: '服務器錯誤' });
        }
    };

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
    cookGameApp.post('/cook-api/admin/initialize-titles', authenticateToken, isAdmin, async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 檢查資料表是否已存在
            let tableExists = false;
            try {
                const checkResult = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'cook_titles'
                    );
                `);
                tableExists = checkResult.rows[0].exists;
            } catch (err) {
                console.error('檢查資料表時出錯:', err);
            }

            // 如果資料表不存在，創建它
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
            }

            // 添加預設稱號
            const defaultTitles = [
                {
                    title_id: 'novice_chef',
                    title_name: '新手廚師',
                    title_description: '剛開始學習烹飪的新手',
                    rarity: 'common',
                    unlock_condition: 'level',
                    unlock_value: 1,
                    color_code: '#AAAAAA'
                },
                {
                    title_id: 'apprentice_chef',
                    title_name: '學徒廚師',
                    title_description: '已有一定烹飪經驗的學徒',
                    rarity: 'common',
                    unlock_condition: 'level',
                    unlock_value: 5,
                    color_code: '#FFFFFF'
                },
                {
                    title_id: 'line_cook',
                    title_name: '廚房小廚',
                    title_description: '能夠熟練處理基本料理的廚師',
                    rarity: 'uncommon',
                    unlock_condition: 'level',
                    unlock_value: 10,
                    color_code: '#77CCFF'
                },
                {
                    title_id: 'sous_chef',
                    title_name: '副主廚',
                    title_description: '能夠協助管理廚房的資深廚師',
                    rarity: 'rare',
                    unlock_condition: 'level',
                    unlock_value: 20,
                    color_code: '#AA77FF'
                },
                {
                    title_id: 'head_chef',
                    title_name: '主廚',
                    title_description: '廚房的指揮官，擁有卓越的烹飪技巧',
                    rarity: 'epic',
                    unlock_condition: 'level',
                    unlock_value: 30,
                    color_code: '#FFCC00'
                },
                {
                    title_id: 'master_chef',
                    title_name: '大廚師長',
                    title_description: '頂尖的廚藝大師，無人能敵',
                    rarity: 'legendary',
                    unlock_condition: 'level',
                    unlock_value: 50,
                    color_code: '#FF5522'
                },
                {
                    title_id: 'kitchen_rookie',
                    title_name: '廚房新秀',
                    title_description: '剛開始在廚房工作的新手',
                    rarity: 'common',
                    unlock_condition: 'games_played',
                    unlock_value: 5,
                    color_code: '#AAFFAA'
                },
                {
                    title_id: 'kitchen_veteran',
                    title_name: '廚房老手',
                    title_description: '在廚房工作多年的資深廚師',
                    rarity: 'rare',
                    unlock_condition: 'games_played',
                    unlock_value: 100,
                    color_code: '#AA77FF'
                },
                {
                    title_id: 'order_expert',
                    title_name: '訂單專家',
                    title_description: '完成大量訂單的專家',
                    rarity: 'epic',
                    unlock_condition: 'orders_completed',
                    unlock_value: 500,
                    color_code: '#FFAA22'
                },
                {
                    title_id: 'point_collector',
                    title_name: '積分收集者',
                    title_description: '累積大量積分的玩家',
                    rarity: 'rare',
                    unlock_condition: 'points',
                    unlock_value: 10000,
                    color_code: '#22CCFF'
                }
            ];

            let titlesCreated = 0;
            for (const title of defaultTitles) {
                // 檢查稱號是否已存在
                const checkTitle = await client.query('SELECT * FROM cook_titles WHERE title_id = $1', [title.title_id]);
                
                if (checkTitle.rows.length === 0) {
                    await client.query(`
                        INSERT INTO cook_titles (
                            title_id, title_name, title_description, rarity, 
                            unlock_condition, unlock_value, color_code
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        title.title_id, 
                        title.title_name, 
                        title.title_description, 
                        title.rarity, 
                        title.unlock_condition, 
                        title.unlock_value, 
                        title.color_code
                    ]);
                    titlesCreated++;
                }
            }

            await client.query('COMMIT');
            
            res.status(200).json({ 
                success: true, 
                message: '稱號資料表初始化成功', 
                titlesCreated,
                tableCreated: !tableExists
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('初始化稱號資料表時出錯:', error);
            res.status(500).json({ success: false, error: '初始化稱號資料表失敗', details: error.message });
        } finally {
            client.release();
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