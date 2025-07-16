const express = require('express');

// JWT authentication middleware for chat room API
const jwt = require('jsonwebtoken');

const authenticateGameUser = (pool) => async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ error: 'Authentication token required.' });
    }

    try {
        // 驗證 JWT Token
        const decoded = jwt.verify(token, process.env.BOX_JWT_SECRET);
        
        if (!decoded || !decoded.user_id) {
            return res.status(403).json({ error: 'Invalid token payload.' });
        }

        // 從資料庫獲取用戶資訊
        const userResult = await pool.query(`
            SELECT 
                bu.user_id, bu.username, bu.display_name, bu.user_profile_image_url,
                ur.role_id, ur.role_name
            FROM box_users bu
            LEFT JOIN user_role_assignments ura ON bu.user_id = ura.user_id AND ura.is_active = true
            LEFT JOIN user_roles ur ON ura.role_id = ur.role_id
            WHERE bu.user_id = $1
        `, [decoded.user_id]);

        if (userResult.rows.length === 0) {
            return res.status(403).json({ error: 'User not found.' });
        }

        // 將用戶資訊附加到請求對象
        req.user = {
            user_id: userResult.rows[0].user_id,
            username: userResult.rows[0].username,
            display_name: userResult.rows[0].display_name,
            profile_image_url: userResult.rows[0].user_profile_image_url,  
            role_id: userResult.rows[0].role_id,
            role_name: userResult.rows[0].role_name
        };

        console.log(`[vue-game-api] User authenticated: ${req.user.username} (ID: ${req.user.user_id})`);
        next();
    } catch (error) {
        console.error('[vue-game-api] Auth error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ error: 'Invalid token.' });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Token expired.' });
        }
        return res.status(500).json({ error: 'Internal server error during authentication.' });
    }
};

function initializeVueGameApi(app, pool, wss) {
    const router = express.Router();





    const authMiddleware = authenticateGameUser(pool);

    /**
     * --- Food Running Game Routes ---
     */

    // GET /food-running/templates - Fetch all map template names and IDs
    router.get('/food-running/templates', async (req, res) => {
        try {
            const result = await pool.query('SELECT id, name FROM food_running_map_templates ORDER BY name ASC');
            res.json(result.rows);
        } catch (error) {
            console.error('[vue-game-api] Error fetching food running templates:', error);
            res.status(500).json({ error: 'Failed to fetch map templates.' });
        }
    });

    // GET /food-running/templates/:id - Fetch a single, detailed map template
    router.get('/food-running/templates/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const result = await pool.query('SELECT id, name, obstacles, background_image_url FROM food_running_map_templates WHERE id = $1', [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Template not found.' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error(`[vue-game-api] Error fetching food running template ${id}:`, error);
            res.status(500).json({ error: 'Failed to fetch template details.' });
        }
    });


    router.get('/chat/online-count', (req, res) => {
        if (wss && wss.clients) {
            const onlineCount = wss.clients.size;
            res.json({ onlineCount });
          } else {
            // 提供一个更明确的错误信息
            console.error('[vue-game-api] /chat/online-count error: wss is not available or initialized.');
            res.status(500).json({ error: 'WebSocket server is not ready.' });
          }
      });

    // POST /food-running/templates - Create or Update a map template (Protected)
    router.post('/food-running/templates', authMiddleware, async (req, res) => {
        const { name, obstacles, background_image_url } = req.body;
        if (!name || !obstacles) {
            return res.status(400).json({ error: 'Template name and obstacles data are required.' });
        }

        try {
            // Using ON CONFLICT to handle both insert and update (upsert)
            const query = `
                INSERT INTO food_running_map_templates (name, obstacles, background_image_url)
                VALUES ($1, $2, $3)
                ON CONFLICT (name)
                DO UPDATE SET
                    obstacles = EXCLUDED.obstacles,
                    background_image_url = EXCLUDED.background_image_url,
                    updated_at = NOW()
                RETURNING id, name;
            `;
            const result = await pool.query(query, [name, JSON.stringify(obstacles), background_image_url]);
            res.status(201).json({ message: 'Template saved successfully.', template: result.rows[0] });
        } catch (error) {
            console.error('[vue-game-api] Error saving food running template:', error);
            res.status(500).json({ error: 'Failed to save template.' });
        }
    });

    // DELETE /food-running/templates/:id - Delete a map template (Protected)
    router.delete('/food-running/templates/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        try {
            const result = await pool.query('DELETE FROM food_running_map_templates WHERE id = $1', [id]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Template not found.' });
            }
            res.status(200).json({ message: 'Template deleted successfully.' });
        } catch (error) {
            console.error(`[vue-game-api] Error deleting food running template ${id}:`, error);
            res.status(500).json({ error: 'Failed to delete template.' });
        }
    });

    /**
     * --- Map Template Routes ---
     * Manages loading and saving of map layouts.
     */

    // GET /map-templates - Fetch all map template names and IDs (Publicly accessible)
    router.get('/map-templates', async (req, res) => {
        try {
            const result = await pool.query('SELECT id, name FROM unit_map_templates ORDER BY updated_at DESC');
            res.json(result.rows);
        } catch (error) {
            console.error('[vue-game-api] Error fetching map templates:', error);
            res.status(500).json({ error: 'Failed to fetch map templates.' });
        }
    });

    // GET /map-templates/:id - Fetch a single, detailed map template (Publicly accessible)
    router.get('/map-templates/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const templateRes = await pool.query('SELECT * FROM unit_map_templates WHERE id = $1', [id]);
            if (templateRes.rows.length === 0) {
                return res.status(404).json({ error: 'Template not found.' });
            }
            const template = templateRes.rows[0];

            // Fetch associated areas
            const areasRes = await pool.query('SELECT * FROM unit_map_areas WHERE template_id = $1', [id]);
            const areas = areasRes.rows;

            // For each area, fetch its cells
            await Promise.all(areas.map(async (area) => {
                const cellsRes = await pool.query('SELECT cell_index FROM unit_map_area_cells WHERE area_id = $1', [area.id]);
                area.cells = cellsRes.rows.map(r => r.cell_index);
            }));

            // Fetch associated components
            const componentsRes = await pool.query('SELECT * FROM unit_map_components WHERE template_id = $1', [id]);

            template.areas = areas;
            template.components = componentsRes.rows;

            res.json(template);
        } catch (error) {
            console.error(`[vue-game-api] Error fetching map template ${id}:`, error);
            res.status(500).json({ error: 'Failed to fetch template details.' });
        }
    });

    // POST /map-templates - Create or Update a map template (Protected)
    router.post('/map-templates', authMiddleware, async (req, res) => {
        const { name, grid_cols, grid_rows, areas, components } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Template name is required.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let templateRes = await client.query('SELECT id FROM unit_map_templates WHERE name = $1', [name]);
            let templateId;

            if (templateRes.rows.length > 0) { // Template exists, so update it
                templateId = templateRes.rows[0].id;
                await client.query('UPDATE unit_map_templates SET grid_cols = $1, grid_rows = $2, updated_at = NOW() WHERE id = $3', [grid_cols, grid_rows, templateId]);
                
                // --- FIX START ---
                // Manually delete cells from child table before deleting from the parent table
                await client.query(`
                    DELETE FROM unit_map_area_cells 
                    WHERE area_id IN (SELECT id FROM unit_map_areas WHERE template_id = $1)
                `, [templateId]);
                // --- FIX END ---
                
                // Clear old associated data
                await client.query('DELETE FROM unit_map_areas WHERE template_id = $1', [templateId]);
                await client.query('DELETE FROM unit_map_components WHERE template_id = $1', [templateId]);
            } else { // Template doesn't exist, so create it
                templateRes = await client.query('INSERT INTO unit_map_templates (name, grid_cols, grid_rows) VALUES ($1, $2, $3) RETURNING id', [name, grid_cols, grid_rows]);
                templateId = templateRes.rows[0].id;
            }

            // Insert new areas
            if (areas && areas.length > 0) {
                for (const area of areas) {
                    const areaRes = await client.query('INSERT INTO unit_map_areas (template_id, name, color, show_name) VALUES ($1, $2, $3, $4) RETURNING id', 
                        [templateId, area.name, area.color, area.showName || false]);
                    const areaId = areaRes.rows[0].id;
                    
                    // Insert area cells
                    if (area.cells && area.cells.length > 0) {
                        for (const cell of area.cells) {
                            await client.query('INSERT INTO unit_map_area_cells (area_id, cell_index) VALUES ($1, $2)', 
                                [areaId, cell]);
                        }
                    }
                }
            }
            
            // Insert new components
            if (components && components.length > 0) {
                for (const comp of components) {
                    await client.query('INSERT INTO unit_map_components (template_id, component_id, position_x, position_y) VALUES ($1, $2, $3, $4)', [templateId, comp.component_id, comp.grid_x, comp.grid_y]);
                }
            }

            await client.query('COMMIT');
            res.status(201).json({ message: 'Template saved successfully.', id: templateId, name });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[vue-game-api] Error saving map template. Transaction rolled back.', error);
            res.status(500).json({ error: 'Failed to save template.' });
        } finally {
            client.release();
        }
    });

    // DELETE /map-templates/:id - Delete a map template (Protected)
    router.delete('/map-templates/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        try {
            // The database schema should have "ON DELETE CASCADE" for foreign keys
            // to automatically delete associated areas and components.
            const result = await pool.query('DELETE FROM unit_map_templates WHERE id = $1', [id]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Template not found.' });
            }
            res.status(200).json({ message: 'Template deleted successfully.' });
        } catch (error) {
            console.error(`[vue-game-api] Error deleting map template ${id}:`, error);
            res.status(500).json({ error: 'Failed to delete template.' });
        }
    });

    /**
     * --- Chat Room API Routes ---
     */

    // GET /chat/rooms - 獲取聊天室列表
    router.get('/chat/rooms', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    id, name, description, created_at, is_active,
                    (SELECT COUNT(*) FROM chat_messages WHERE room_id = chat_rooms.id AND created_at > NOW() - INTERVAL '2 days') as recent_message_count,
                    (SELECT COUNT(DISTINCT user_id) FROM chat_room_members WHERE room_id = chat_rooms.id AND is_online = true) as online_users
                FROM chat_rooms 
                WHERE is_active = true 
                ORDER BY created_at DESC
            `);
            res.json(result.rows);
        } catch (error) {
            console.error('[vue-game-api] Error fetching chat rooms:', error);
            res.status(500).json({ error: 'Failed to fetch chat rooms.' });
        }
    });

    // GET /chat/history/:roomId - 獲取聊天歷史
    router.get('/chat/history/:roomId', async (req, res) => {
        const { roomId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        try {
            const result = await pool.query(`
                SELECT 
                    cm.id, cm.message, cm.message_type, cm.created_at,
                    bu.user_id, bu.username, bu.display_name, bu.user_profile_image_url,
                    ur.role_name
                FROM chat_messages cm
                JOIN box_users bu ON cm.user_id = bu.user_id
                LEFT JOIN user_role_assignments ura ON bu.user_id = ura.user_id AND ura.is_active = true
                LEFT JOIN user_roles ur ON ura.role_id = ur.role_id
                WHERE cm.room_id = $1 AND cm.is_deleted = false AND cm.created_at > NOW() - INTERVAL '2 days'
                ORDER BY cm.created_at DESC
                LIMIT $2 OFFSET $3
            `, [roomId, limit, offset]);
            
            // 反轉順序，讓最新的訊息在最後
            res.json(result.rows.reverse());
        } catch (error) {
            console.error(`[vue-game-api] Error fetching chat history for room ${roomId}:`, error);
            res.status(500).json({ error: 'Failed to fetch chat history.' });
        }
    });





 

 





    // GET /chat/notifications - 獲取離線訊息通知 (需要認證)
    router.get('/chat/notifications', authMiddleware, async (req, res) => {
        try {
            const userId = req.user.user_id || req.user.id;
            const result = await pool.query(`
                SELECT 
                    con.id as notification_id,
                    cm.id as message_id, cm.message, cm.created_at,
                    bu.username, bu.display_name, bu.profile_image_url,
                    ur.role_name,
                    cr.name as room_name
                FROM chat_offline_notifications con
                JOIN chat_messages cm ON con.message_id = cm.id
                JOIN box_users bu ON cm.user_id = bu.user_id
                JOIN chat_rooms cr ON cm.room_id = cr.id
                LEFT JOIN user_role_assignments ura ON bu.user_id = ura.user_id AND ura.is_active = true
                LEFT JOIN user_roles ur ON ura.role_id = ur.role_id
                WHERE con.user_id = $1 AND con.is_read = false
                ORDER BY cm.created_at DESC
                LIMIT 20
            `, [userId]);
            
            res.json(result.rows);
        } catch (error) {
            console.error('[vue-game-api] Error fetching notifications:', error);
            res.status(500).json({ error: 'Failed to fetch notifications.' });
        }
    });

    // POST /chat/notifications/mark-read - 標記通知為已讀 (需要認證)
    router.post('/chat/notifications/mark-read', authMiddleware, async (req, res) => {
        const { notificationIds } = req.body;
        
        if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
            return res.status(400).json({ error: 'Notification IDs are required.' });
        }

        try {
            const userId = req.user.user_id || req.user.id;
            const result = await pool.query(`
                UPDATE chat_offline_notifications 
                SET is_read = true 
                WHERE id = ANY($1::int[]) AND user_id = $2
            `, [notificationIds, userId]);
            
            res.json({ 
                message: 'Notifications marked as read.', 
                updated_count: result.rowCount 
            });
        } catch (error) {
            console.error('[vue-game-api] Error marking notifications as read:', error);
            res.status(500).json({ error: 'Failed to mark notifications as read.' });
        }
    });

    // GET /chat/user-settings - 獲取用戶聊天設定 (需要認證)
    router.get('/chat/user-settings', authMiddleware, async (req, res) => {
        try {
            const userId = req.user.user_id || req.user.id;
            let result = await pool.query(`
                SELECT * FROM chat_user_settings WHERE user_id = $1
            `, [userId]);
            
            // 如果用戶沒有設定記錄，創建預設設定
            if (result.rows.length === 0) {
                result = await pool.query(`
                    INSERT INTO chat_user_settings (user_id)
                    VALUES ($1)
                    RETURNING *
                `, [userId]);
            }
            
            res.json(result.rows[0]);
        } catch (error) {
            console.error('[vue-game-api] Error fetching user settings:', error);
            res.status(500).json({ error: 'Failed to fetch user settings.' });
        }
    });

    // PUT /chat/user-settings - 更新用戶聊天設定 (需要認證)
    router.put('/chat/user-settings', authMiddleware, async (req, res) => {
        const { enable_notifications, enable_sound } = req.body;
        
        try {
            const userId = req.user.user_id || req.user.id;
            const result = await pool.query(`
                INSERT INTO chat_user_settings (user_id, enable_notifications, enable_sound)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id) 
                DO UPDATE SET 
                    enable_notifications = EXCLUDED.enable_notifications,
                    enable_sound = EXCLUDED.enable_sound,
                    updated_at = NOW()
                RETURNING *
            `, [userId, enable_notifications, enable_sound]);
            
            res.json(result.rows[0]);
        } catch (error) {
            console.error('[vue-game-api] Error updating user settings:', error);
            res.status(500).json({ error: 'Failed to update user settings.' });
        }
    });

    // DELETE /chat/messages/:messageId - 刪除訊息 (管理員功能)
    router.delete('/chat/messages/:messageId', authMiddleware, async (req, res) => {
        const { messageId } = req.params;
        
        try {
            const userId = req.user.user_id || req.user.id;
            
            // 檢查用戶是否為管理員
            const roleResult = await pool.query(`
                SELECT ur.role_id, ur.role_name
                FROM user_role_assignments ura
                JOIN user_roles ur ON ura.role_id = ur.role_id
                WHERE ura.user_id = $1 AND ura.is_active = true AND ur.role_id >= 2
            `, [userId]);
            
            const isAdmin = roleResult.rows.length > 0;
            
            // 檢查訊息是否存在以及是否為訊息作者
            const messageResult = await pool.query(`
                SELECT user_id FROM chat_messages WHERE id = $1 AND is_deleted = false
            `, [messageId]);
            
            if (messageResult.rows.length === 0) {
                return res.status(404).json({ error: 'Message not found.' });
            }
            
            const isOwner = messageResult.rows[0].user_id == userId;
            
            if (!isAdmin && !isOwner) {
                return res.status(403).json({ error: 'Permission denied.' });
            }
            
            // 軟刪除訊息
            await pool.query(`
                UPDATE chat_messages 
                SET is_deleted = true 
                WHERE id = $1
            `, [messageId]);
            
            res.json({ message: 'Message deleted successfully.' });
        } catch (error) {
            console.error('[vue-game-api] Error deleting message:', error);
            res.status(500).json({ error: 'Failed to delete message.' });
        }
    });

    // POST /chat/rooms - 創建聊天室 (管理員功能)
    router.post('/chat/rooms', authMiddleware, async (req, res) => {
        const { name, description } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Room name is required.' });
        }

        try {
            const userId = req.user.user_id || req.user.id;
            
            // 檢查用戶是否為管理員
            const roleResult = await pool.query(`
                SELECT ur.role_id
                FROM user_role_assignments ura
                JOIN user_roles ur ON ura.role_id = ur.role_id
                WHERE ura.user_id = $1 AND ura.is_active = true AND ur.role_id >= 2
            `, [userId]);
            
            if (roleResult.rows.length === 0) {
                return res.status(403).json({ error: 'Permission denied. Admin access required.' });
            }
            
            const result = await pool.query(`
                INSERT INTO chat_rooms (name, description, created_by)
                VALUES ($1, $2, $3)
                RETURNING id, name, description, created_at
            `, [name.trim(), description || '', userId]);
            
            res.status(201).json({ 
                message: 'Chat room created successfully.', 
                room: result.rows[0] 
            });
        } catch (error) {
            console.error('[vue-game-api] Error creating chat room:', error);
            if (error.code === '23505') { // unique violation
                res.status(409).json({ error: 'A room with this name already exists.' });
            } else {
                res.status(500).json({ error: 'Failed to create chat room.' });
            }
        }
    });

    // Mount the router onto the main Express app
    app.use('/api/vue-game', router);
    console.log('✅ Vue Game API initialized and mounted at /api/vue-game');
}

module.exports = initializeVueGameApi; 