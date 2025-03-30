// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- API Routes ---

// GET all products
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, description, price, image_url, seven_eleven_url FROM products ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET a single product by ID
app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid product ID format.' });
    }
    try {
        const result = await pool.query(
            'SELECT id, name, description, price, image_url, seven_eleven_url FROM products WHERE id = $1',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Error fetching product with ID ${id}:`, err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// UPDATE a product by ID
app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, price, image_url, seven_eleven_url } = req.body;

    // --- Validation for PUT ---
    if (isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid product ID format.' }); }
    if (typeof name !== 'string' || name.trim() === '') { return res.status(400).json({ error: 'Product name cannot be empty.' }); }

    let priceValue = null;
    if (price !== undefined && price !== null && price !== '') {
        priceValue = parseFloat(price);
        if (isNaN(priceValue)) { return res.status(400).json({ error: 'Invalid price format. Must be a number.' }); }
        if (priceValue < 0) { return res.status(400).json({ error: 'Price cannot be negative.' }); }
    }

    const isValidUrl = (urlString) => {
        if (!urlString) return true;
        // Basic check for relative or absolute URLs
        return urlString.startsWith('/') || urlString.startsWith('http://') || urlString.startsWith('https://');
        // Stricter check below (might reject relative URLs like /images/...)
        // try { new URL(urlString); return true; } catch (_) { return false; }
    };
    // Optional: Re-enable image_url check if needed and adjust validation
    // if (!isValidUrl(image_url)) { return res.status(400).json({ error: 'Invalid image URL format.' }); }
    if (seven_eleven_url && !isValidUrl(seven_eleven_url)) { // Check only if 7-11 URL is provided
        return res.status(400).json({ error: 'Invalid 7-11 link URL format.' });
    }
    // --- End Validation for PUT ---

    try {
        const result = await pool.query(
            `UPDATE products
             SET name = $1, description = $2, price = $3, image_url = $4, seven_eleven_url = $5, updated_at = NOW()
             WHERE id = $6
             RETURNING *`,
            [
                name,
                description || null,
                priceValue,
                image_url || null,
                seven_eleven_url || null,
                id
            ]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found, cannot update.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`Error updating product with ID ${id}:`, err);
        res.status(500).json({ error: 'Internal Server Error during update.' });
    }
});

// CREATE a new product
app.post('/api/products', async (req, res) => {
    const { name, description, price, image_url, seven_eleven_url } = req.body;

    // --- Validation for POST ---
    if (typeof name !== 'string' || name.trim() === '') { return res.status(400).json({ error: 'Product name cannot be empty.' }); }

    let priceValue = null;
    if (price !== undefined && price !== null && price !== '') {
        priceValue = parseFloat(price);
        if (isNaN(priceValue)) { return res.status(400).json({ error: 'Invalid price format. Must be a number.' }); }
        if (priceValue < 0) { return res.status(400).json({ error: 'Price cannot be negative.' }); }
    }

    const isValidUrl = (urlString) => {
        if (!urlString) return true;
        return urlString.startsWith('/') || urlString.startsWith('http://') || urlString.startsWith('https://');
    };
    // Optional: Re-enable image_url check if needed and adjust validation
    // if (!isValidUrl(image_url)) { return res.status(400).json({ error: 'Invalid image URL format.' }); }
    if (seven_eleven_url && !isValidUrl(seven_eleven_url)) { // Check only if 7-11 URL is provided
        return res.status(400).json({ error: 'Invalid 7-11 link URL format.' });
    }
    // --- End Validation for POST ---

    try {
        const result = await pool.query(
            `INSERT INTO products (name, description, price, image_url, seven_eleven_url, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING *`,
            [
                name,
                description || null,
                priceValue,
                image_url || null,
                seven_eleven_url || null
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding new product:', err);
        res.status(500).json({ error: 'Internal Server Error during insert.' });
    }
});


// --- Optional Catch-all for SPA ---
/*
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
*/

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    pool.query('SELECT NOW()', (err, result) => { // Corrected 'res' to 'result' to avoid conflict
        if (err) {
            console.error('Database connection error:', err);
        } else if (result && result.rows.length > 0) { // Check if result and rows exist
            console.log('Database connected successfully at', result.rows[0].now);
        } else {
             console.log('Database connected, but no time returned?');
        }
    });
});