// server.js (Minimal Version for SPA Rebuild)

require('dotenv').config();
const { Pool } = require('pg');
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// --- Database Connection ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render's free tier DBs might require SSL but not reject unauthorized certs
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testDbConnection() {
  // Keep this function to verify DB connection on startup
  try {
    const client = await pool.connect();
    console.log("成功連接到 PostgreSQL 資料庫！");
    client.release();
  } catch (err) {
    console.error("!!! 連接資料庫時發生錯誤:", err.message);
    process.exit(1); // Exit if DB connection fails on startup
  }
}
// --- End Database Connection ---

// --- Middleware ---
// Serve static files from the 'public' directory (index.html, app.js, style.css, images)
app.use(express.static(path.join(__dirname, 'public')));
// Parse JSON request bodies (needed for future POST/PUT requests)
app.use(express.json());
// --- End Middleware ---


// --- API Routes (Minimal) ---

// GET all products
app.get('/api/products', async (req, res) => {
    console.log("API: Received request for all products.");
    try {
      const client = await pool.connect();
      // Simple query, order by creation time perhaps? Or ID?
      const result = await client.query('SELECT * FROM products ORDER BY id ASC');
      client.release();
      res.json(result.rows);
    } catch (err) {
      console.error("API Error fetching products:", err);
      res.status(500).json({ error: '無法從資料庫獲取商品列表' });
    }
});

// GET all music
app.get('/api/music', async (req, res) => {
    console.log("API: Received request for all music.");
    try {
      const client = await pool.connect();
      // Order by release date or ID
      const result = await client.query('SELECT * FROM music ORDER BY id ASC');
      client.release();
      res.json(result.rows);
    } catch (err) {
      console.error("API Error fetching music:", err);
      res.status(500).json({ error: '無法從資料庫獲取音樂列表' });
    }
});

// --- End API Routes ---


// --- SPA Fallback Route ---
// This should be the LAST route defined before the error handlers/server start.
// It sends 'index.html' for any GET request that hasn't been handled yet (i.e., not an API route and not a static file).
app.get('*', (req, res, next) => {
  // We only want to fallback for GET requests that are likely page loads
  if (req.method !== 'GET') {
    return next();
  }
  // Basic check to avoid falling back for things that look like files
  if (req.originalUrl.includes('.')) {
      return next();
  }
  // If it's not an API route, serve the main HTML file for the SPA
  if (!req.originalUrl.startsWith('/api')) {
    console.log(`SPA Fallback: Serving index.html for ${req.originalUrl}`);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    // If it starts with /api but wasn't matched by an API route, let it 404
    next();
  }
});
// --- End SPA Fallback Route ---


// --- Basic Error Handling (Optional but Recommended) ---
app.use((req, res, next) => {
  // If route wasn't found by this point
  res.status(404).json({ error: "Not Found" }); // Respond with JSON for API-like consistency
});

app.use((err, req, res, next) => {
  // General error handler
  console.error("Unhandled Server Error:", err.stack);
  res.status(500).json({ error: '伺服器內部錯誤' });
});
// --- End Error Handling ---


// --- Server Start ---
app.listen(port, () => {
  console.log(`Minimal server listening on port ${port}`);
  testDbConnection(); // Test DB connection when server starts
});
// --- End Server Start ---