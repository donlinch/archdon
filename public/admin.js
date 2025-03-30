// public/admin.js
document.addEventListener('DOMContentLoaded', () => {
    const productListBody = document.querySelector('#product-list-table tbody');
    const productListContainer = document.getElementById('product-list-container');
    const productTable = document.getElementById('product-list-table');
    const loadingMessage = productListContainer.querySelector('p');

    async function fetchAndDisplayProducts() {
        try {
            const response = await fetch('/api/products'); // Reuse the existing API endpoint
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const products = await response.json();

            if (loadingMessage) loadingMessage.style.display = 'none'; // Hide loading message
            if (productTable) productTable.style.display = 'table';   // Show table

            productListBody.innerHTML = ''; // Clear existing rows

            if (products.length === 0) {
                productListBody.innerHTML = '<tr><td colspan="5">目前沒有商品。</td></tr>';
                return;
            }

            products.forEach(product => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td>${product.name || ''}</td>
                    <td>${product.price !== null ? `NT$ ${product.price.toLocaleString()}` : 'N/A'}</td>
                    <td><img src="${product.image_url || ''}" alt="${product.name || ''}" style="width: 50px; height: auto;"></td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editProduct(${product.id})">編輯</button>
                        <button class="action-btn delete-btn" onclick="deleteProduct(${product.id})">刪除</button>
                    </td>
                `;
                productListBody.appendChild(row);
            });

        } catch (error) {
            console.error("Failed to fetch products for admin:", error);
             if (loadingMessage) loadingMessage.textContent = '無法加載商品列表。';
        }
    }

    // --- Placeholder functions for actions (to be implemented later) ---
    window.editProduct = function(id) {
        console.log('Attempting to edit product with ID:', id);
        alert(`編輯功能尚未實作 (商品 ID: ${id})`);
        // Later: Show an edit form/modal, pre-fill with data for this product ID
    };

    window.deleteProduct = function(id) {
        console.log('Attempting to delete product with ID:', id);
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) {
            alert(`刪除功能尚未實作 (商品 ID: ${id})`);
            // Later: Send a DELETE request to the backend API
        }
    };

    window.showAddForm = function() {
        alert('新增商品表單功能尚未實作');
        // Later: Show a form/modal for adding a new product
    }


    // --- Initial Load ---
    fetchAndDisplayProducts();

});