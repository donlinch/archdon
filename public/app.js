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
            const cardLink = document.createElement('a');
            cardLink.className = 'product-card'; // Apply CSS class to the link

            // *** 設定連結屬性 ***
            // Use seven_eleven_url if available, otherwise link nowhere safely
            cardLink.href = product.seven_eleven_url || '#'; // Link to '#' if URL is missing
            if (product.seven_eleven_url) {
               cardLink.target = '_blank'; // Open in new tab if URL exists
               cardLink.rel = 'noopener noreferrer'; // Security measure for target="_blank"
            }


            // --- Create internal elements (Image Container, Image, Content Div, etc.) ---
            // Image container (optional but good for consistent image sizing)
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';

            const img = document.createElement('img');
            img.src = product.image_url;
            img.alt = product.name;
            imageContainer.appendChild(img); // Add image to its container

            // Content container
            const contentDiv = document.createElement('div');
            contentDiv.className = 'card-content';

            const name = document.createElement('h3');
            name.textContent = product.name;

            const description = document.createElement('p');
            description.textContent = product.description || ' '; // Use space if no description

            const price = document.createElement('p');
            price.className = 'price';
            price.textContent = product.price !== null ? `NT$ ${Math.floor(product.price)}` : '價格洽詢'; // Format price

            // Append content elements to the content div
            contentDiv.appendChild(name);
            contentDiv.appendChild(description);
            contentDiv.appendChild(price);

            // *** 將內部元素附加到 <a> 連結卡片 ***
         cardLink.appendChild(imageContainer); // Add image container first
         cardLink.appendChild(contentDiv);     // Add content div after

         // *** Create and APPEND the cart icon ***
         const cartIcon = document.createElement('img'); 
         cartIcon.src = '/images/shop.png'; 
         cartIcon.alt = '購物車';

         cardLink.appendChild(cartIcon);  // <<< --- THIS LINE WAS MISSING! Add it here.

         // *** 將連結卡片附加到 Grid ***
         grid.appendChild(cardLink);
     }); // End of productList.forEach
} // End of displayProducts function
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