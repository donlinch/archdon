const express = require('express');

// A placeholder for authentication middleware.
// In a real scenario, this would verify a JWT or session token.
const authenticateGameUser = (pool) => async (req, res, next) => {
    // For this game-specific API, we'll implement a simple token check.
    // This assumes the token is sent in the 'Authorization: Bearer <token>' header.
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        // No token provided
        return res.status(401).json({ error: 'Authentication token required.' });
    }

    // Here you would typically verify the token (e.g., using jwt.verify)
    // and look up the user in the database.
    // As a stand-in, we'll just check if a user session matches.
    // NOTE: This is a simplified auth check for demonstration.
    try {
        // A real implementation would be more robust, perhaps using JWT.
        // This is a placeholder for your actual user authentication logic.
        // For now, we allow any request that provides any token.
        // In your real app, replace this with actual token verification.
        console.log(`[vue-game-api] Authenticating with token: ${token ? 'found' : 'missing'}`);
        // Let's assume the token is a user ID for simplicity of this example
        // const userResult = await pool.query('SELECT id, username FROM users WHERE api_token = $1', [token]);
        // if (userResult.rowCount === 0) {
        //     return res.status(403).json({ error: 'Invalid token.' });
        // }
        // req.user = userResult.rows[0];
        next();
    } catch (e) {
        console.error('[vue-game-api] Auth error:', e);
        return res.status(500).json({ error: 'Internal server error during authentication.' });
    }
};

function initializeVueGameApi(app, pool) {
    const router = express.Router();

    const authMiddleware = authenticateGameUser(pool);

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

            // Fetch associated areas and components
            const areasRes = await pool.query('SELECT * FROM unit_map_areas WHERE template_id = $1', [id]);
            const componentsRes = await pool.query('SELECT * FROM unit_map_components WHERE template_id = $1', [id]);

            template.areas = areasRes.rows;
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
                    await client.query('INSERT INTO unit_map_components (template_id, component_id, grid_x, grid_y) VALUES ($1, $2, $3, $4)', [templateId, comp.component_id, comp.grid_x, comp.grid_y]);
                }
            }

            await client.query('COMMIT');
            res.status(201).json({ message: 'Template saved successfully.', id: templateId, name });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[vue-game-api] Error saving map template:', error);
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

    // Mount the router onto the main Express app
    app.use('/api/vue-game', router);
    console.log('✅ Vue Game API initialized and mounted at /api/vue-game');
}

module.exports = initializeVueGameApi; 