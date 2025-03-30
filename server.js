// server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const path = require('path');
const { Pool } = require('pg'); // PostgreSQL client

const app = express();
const PORT = process.env.PORT || 3000; // Use Render's port or 3000 for local

// --- Database Connection ---
// Use DATABASE_URL from environment variables (Render injects this)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false // Required for Render connections
});

// --- Middleware ---
// Serve static files (HTML, CSS, JS, Images) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
// Parse JSON request bodies (useful for future POST requests, good practice)
app.use(express.json());

// --- API Routes ---
// API endpoint to get all products
app.get('/api/products', async (req, res) => {
    try {
        // Query the database for products, selecting only necessary columns
        const result = await pool.query(
            'SELECT id, name, description, price, image_url, seven_eleven_url FROM products ORDER BY created_at DESC' // Order by creation date, newest first
        );
        res.json(result.rows); // Send the products array as JSON
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: 'Internal Server Error' }); // Send an error response
    }
});

// API endpoint to get a SINGLE product by ID

app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params; // Get the ID from the URL parameter
  // Input validation: Ensure ID is a number
  if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid product ID format.' });
  }

  try {
      const result = await pool.query(
          // Select all relevant fields for editing
          'SELECT id, name, description, price, image_url, seven_eleven_url FROM products WHERE id = $1',
          [id] // Use parameterized query to prevent SQL injection
      );

      if (result.rows.length === 0) {
          // No product found with that ID
          return res.status(404).json({ error: 'Product not found.' });
      }

      res.json(result.rows[0]); // Send the single product object
  } catch (err) {
      console.error(`Error fetching product with ID ${id}:`, err);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

//-- Catch-all for SPA (Single Page Application) - Optional for now ---
// If you have client-side routing later, uncomment this:
/*
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
*/

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    // Verify database connection on startup (optional but helpful)
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('Database connection error:', err);
        } else {
            console.log('Database connected successfully at', res.rows[0].now);
        }
    });
});