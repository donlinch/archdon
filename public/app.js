// public/app.js
document.addEventListener('DOMContentLoaded', () => {

    // --- Function to Display Products ---
    function displayProducts(productList) {
        const grid = document.getElementById('product-grid');
        if (!grid) {
            console.error("Product grid element not found!");
            return;
        }

        grid.innerHTML = ''; // Clear the "Loading..." message or old content

        if (!productList || productList.length === 0) {
            grid.innerHTML = '<p>目前沒有商品可顯示。</p>';
            return;
        }

        productList.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card'; // Apply CSS class

            // Image - Use image_url from the database
            const img = document.createElement('img');
            // Assuming image_url stores paths like '/images/myimage.jpg'
            // express.static will serve them correctly from the public folder
            img.src = product.image_url;
            img.alt = product.name; // Alt text is important

            // Name
            const name = document.createElement('h3');
            name.textContent = product.name;

            // Description
            const description = document.createElement('p');
            // Handle potentially missing description
            description.textContent = product.description || '暫無描述';

            // Price
            const price = document.createElement('p');
            price.className = 'price';
             // Handle potentially missing price
            price.textContent = product.price !== null ? `NT$ ${product.price}` : '價格未定';

            // Append elements to the card
            card.appendChild(img);
            card.appendChild(name);
            card.appendChild(description);
            card.appendChild(price);

            // Append the card to the grid
            grid.appendChild(card);
        });
    }

    // --- Function to Fetch Products from API ---
    async function fetchProducts() {
        const grid = document.getElementById('product-grid');
        try {
            const response = await fetch('/api/products'); // Fetch from our backend API
            if (!response.ok) {
                // Handle HTTP errors (like 404, 500)
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const products = await response.json(); // Parse JSON response
            displayProducts(products); // Display the fetched products
        } catch (error) {
            console.error("Failed to fetch products:", error);
            if (grid) {
                grid.innerHTML = '<p>無法加載商品，請稍後再試。</p>'; // Show error message to user
            }
        }
    }

    // --- Initial Load ---
    fetchProducts(); // Call the fetch function when the page loads

}); // End of DOMContentLoaded