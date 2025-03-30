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
// If// API endpoint to UPDATE a product by ID
 app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  // Get updated data from the request body
  const { name, description, price, image_url, seven_eleven_url } = req.body;

  // --- Basic Input Validation ---
  if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid product ID format.' });
  }
  if (typeof name !== 'string' || name.trim() === '') {
       return res.status(400).json({ error: 'Product name cannot be empty.' });
  }
  // Price validation: check if it's a number or null/empty string (allow clearing price)
  let priceValue = null; // Default to null if not provided or invalid
  if (price !== undefined && price !== null && price !== '') {
      priceValue = parseFloat(price);
      if (isNaN(priceValue)) {
          return res.status(400).json({ error: 'Invalid price format. Must be a number.' });
      }
      if (priceValue < 0) {
          return res.status(400).json({ error: 'Price cannot be negative.'})
      }
  }

// API endpoint to CREATE a new product
app.post('/api/products', async (req, res) => {
  // Get data from the request body
  const { name, description, price, image_url, seven_eleven_url } = req.body;

  // --- Basic Input Validation (Similar to PUT) ---
  if (typeof name !== 'string' || name.trim() === '') {
       return res.status(400).json({ error: 'Product name cannot be empty.' });
  }
  let priceValue = null;
  if (price !== undefined && price !== null && price !== '') {
      priceValue = parseFloat(price);
      if (isNaN(priceValue)) {
          return res.status(400).json({ error: 'Invalid price format. Must be a number.' });
      }
       if (priceValue < 0) {
          return res.status(400).json({ error: 'Price cannot be negative.'})
      }
  }
  const isValidUrl = (urlString) => { /* ... (same validation function as in PUT) ... */
     if (!urlString) return true; try { new URL(urlString); return true; } catch (_) { return false; }
  };
  // if (!isValidUrl(image_url)) { /* ... (optional check) ... */ }
  if (!isValidUrl(seven_eleven_url)) {
      return res.status(400).json({ error: 'Invalid 7-11 link URL format.' });
  }
  // --- End Validation ---

  try {
      // Construct the INSERT query
      const result = await pool.query(
          `INSERT INTO products (name, description, price, image_url, seven_eleven_url, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           RETURNING *`, // Return the newly created row (including its ID)
          [
              name,
              description || null,
              priceValue,
              image_url || null,
              seven_eleven_url || null
          ]
      );

      // Send back the newly created product data with status 201 (Created)
      res.status(201).json(result.rows[0]);

  } catch (err) {
      console.error('Error adding new product:', err);
      res.status(500).json({ error: 'Internal Server Error during insert.' });
  }
});

  // Validate URLs (optional but good practice)
  const isValidUrl = (urlString) => {
     if (!urlString) return true; // Allow empty URLs
     try { new URL(urlString); return true; } catch (_) { return false; }
  };
 //  if (!isValidUrl(image_url)) { // Assuming image_url is relative, skip this check? Or adjust.
 //      // If image_url MUST be absolute:
 //      // return res.status(400).json({ error: 'Invalid image URL format.' });
 //  }
  if (!isValidUrl(seven_eleven_url)) {
      return res.status(400).json({ error: 'Invalid 7-11 link URL format.' });
  }
  // --- End Validation ---


  try {
      // Construct the UPDATE query
      const result = await pool.query(
          `UPDATE products
           SET name = $1,
               description = $2,
               price = $3,
               image_url = $4,
               seven_eleven_url = $5,
               updated_at = NOW()
           WHERE id = $6
           RETURNING *`, // Return the updated row
          [
              name,
              description || null, // Use null if description is empty/undefined
              priceValue,          // Use the validated/parsed price
              image_url || null,   // Use null if image_url is empty
              seven_eleven_url || null, // Use null if 7-11 url is empty
              id
          ]
      );

      if (result.rowCount === 0) {
          // If rowCount is 0, it means no row with that ID was found to update
          return res.status(404).json({ error: 'Product not found, cannot update.' });
      }

      // Send back the updated product data
      res.status(200).json(result.rows[0]);

  } catch (err) {
      console.error(`Error updating product with ID ${id}:`, err);
      res.status(500).json({ error: 'Internal Server Error during update.' });
  }
});

// ... (existing code like app.listen) ... you have client-side routing later, uncomment this:
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