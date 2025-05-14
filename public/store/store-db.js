// store-db.js - 封裝商店數據庫操作的模組
const { Pool } = require('pg');

// 使用與 main 應用程序相同的數據庫連接池配置
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * 初始化商店所需的資料表
 * 這個函數可以在應用啟動時調用
 */
async function initStoreDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 創建獨立的 schema
        await client.query('CREATE SCHEMA IF NOT EXISTS store_schema');

        // 在獨立 schema 中創建產品表
        await client.query(`
            CREATE TABLE IF NOT EXISTS store_schema.products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                image VARCHAR(255),
                stock INT DEFAULT 0,
                category VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 在獨立 schema 中創建類別表
        await client.query(`
            CREATE TABLE IF NOT EXISTS store_schema.categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE
            )
        `);

        // 檢查是否有預設類別
        const categoryResult = await client.query('SELECT COUNT(*) FROM store_schema.categories');
        if (parseInt(categoryResult.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO store_schema.categories (name)
                VALUES ('飲品'), ('食品'), ('禮盒'), ('有機')
                ON CONFLICT (name) DO NOTHING
            `);
        }

        await client.query('COMMIT');
        console.log('[Store] 數據庫初始化完成');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Store] 數據庫初始化失敗:', err);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * 獲取所有商品
 * @param {string} category - 可選，按類別過濾
 * @returns {Promise<Array>} 商品列表
 */
async function getAllProducts(category = null) {
    let query = 'SELECT id, name, description, price, image, stock, category, created_at, updated_at, expiration_type, start_date, end_date FROM store_schema.products';
    const values = [];

    if (category) {
        query += ' WHERE category = $1';
        values.push(category);
    }

    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, values);
    return rows;
}

/**
 * 獲取單個商品
 * @param {number} id - 商品 ID
 * @returns {Promise<Object|null>} 商品詳情
 */
async function getProductById(id) {
    const query = 'SELECT * FROM store_schema.products WHERE id = $1';
    const { rows } = await pool.query(query, [id]);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * 添加新商品
 * @param {Object} productData - 商品資料
 * @returns {Promise<Object>} 創建的商品
 */
async function createProduct(productData) {
    const { name, description, price, image, stock, category, expiration_type, start_date, end_date } = productData;

    const query = `
        INSERT INTO store_schema.products (name, description, price, image, stock, category, expiration_type, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    `;

    const values = [name, description, price, image, stock || 0, category, expiration_type, start_date, end_date];
    const { rows } = await pool.query(query, values);
    return rows[0];
}

/**
 * 更新商品
 * @param {number} id - 商品 ID
 * @param {Object} productData - 更新的商品資料
 * @returns {Promise<Object|null>} 更新後的商品
 */
async function updateProduct(id, productData) {
    const { name, description, price, image, stock, category, expiration_type, start_date, end_date } = productData;

    const query = `
        UPDATE store_schema.products
        SET name = $1, description = $2, price = $3, image = $4, stock = $5, category = $6,
            expiration_type = $7, start_date = $8, end_date = $9, updated_at = NOW()
        WHERE id = $10
        RETURNING *
    `;

    const values = [name, description, price, image, stock, category, expiration_type, start_date, end_date, id];
    const { rows } = await pool.query(query, values);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * 刪除商品
 * @param {number} id - 商品 ID
 * @returns {Promise<boolean>} 是否刪除成功
 */
async function deleteProduct(id) {
    const query = 'DELETE FROM store_schema.products WHERE id = $1 RETURNING id';
    const { rows } = await pool.query(query, [id]);
    return rows.length > 0;
}

/**
 * 獲取所有類別
 * @returns {Promise<Array>} 類別列表
 */
async function getAllCategories() {
    const query = 'SELECT * FROM store_schema.categories ORDER BY name';
    const { rows } = await pool.query(query);
    return rows;
}

module.exports = {
    initStoreDatabase,
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    getAllCategories
};
