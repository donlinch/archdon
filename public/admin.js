// public/admin.js
document.addEventListener('DOMContentLoaded', () => {
    const productListBody = document.querySelector('#product-list-table tbody');
    const productListContainer = document.getElementById('product-list-container');
    const productTable = document.getElementById('product-list-table');
    const loadingMessage = productListContainer.querySelector('p');

    // --- Modal elements ---
    // Make sure your admin.html has elements with these IDs
    const modal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-product-form');
    const editProductId = document.getElementById('edit-product-id');
    const editProductName = document.getElementById('edit-product-name');
    const editProductDescription = document.getElementById('edit-product-description');
    const editProductPrice = document.getElementById('edit-product-price');
    const editProductImageUrl = document.getElementById('edit-product-image-url');
    const editImagePreview = document.getElementById('edit-image-preview');
    const editProductSevenElevenUrl = document.getElementById('edit-product-seven-eleven-url');
    const editFormError = document.getElementById('edit-form-error'); // Added error paragraph reference


    // --- Function to Fetch and Display ALL Products in the Table ---
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
                row.dataset.productId = product.id; // Add ID to row for easy access later if needed
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


    // --- Function to Open and Populate the Edit Modal ---
    async function openEditModal(id) {
        // Check if modal elements exist before proceeding
        if (!modal || !editForm || !editProductId || !editProductName || !editProductDescription || !editProductPrice || !editProductImageUrl || !editImagePreview || !editProductSevenElevenUrl || !editFormError) {
             console.error("One or more modal elements are missing in the HTML.");
             alert("編輯視窗元件錯誤，無法開啟。");
             return;
         }

         editFormError.textContent = ''; // Clear previous errors
         editForm.reset(); // Clear previous form data
         editImagePreview.style.display = 'none'; // Hide preview
         editImagePreview.src = '';

         try {
             const response = await fetch(`/api/products/${id}`); // Fetch SINGLE product data
             if (!response.ok) {
                 if (response.status === 404) throw new Error('找不到該商品。');
                 throw new Error(`無法獲取商品資料 (HTTP ${response.status})`);
             }
             const product = await response.json();

             // Populate the form fields
             editProductId.value = product.id;
             editProductName.value = product.name || '';
             editProductDescription.value = product.description || '';
             editProductPrice.value = product.price !== null ? product.price : '';
             editProductImageUrl.value = product.image_url || '';
             editProductSevenElevenUrl.value = product.seven_eleven_url || '';

             // Show image preview if URL exists
             if (product.image_url) {
                 editImagePreview.src = product.image_url;
                 editImagePreview.style.display = 'block';
             } else {
                 editImagePreview.style.display = 'none';
             }

             modal.style.display = 'block'; // Show the modal

         } catch (error) {
              console.error(`Error fetching product ${id} for edit:`, error);
              alert(`無法加載編輯資料： ${error.message}`);
         }
    }

    // --- Function to Close the Edit Modal ---
    window.closeModal = function() {
         if (modal) {
            modal.style.display = 'none';
         }
    }

    // --- Attach Function to Global Scope for Edit Button ---
    // This function is called by the "onclick" attribute in the table rows
    window.editProduct = function(id) {
        console.log('Attempting to edit product with ID:', id);
        openEditModal(id); // Call the function to fetch data and open modal
    };


    // --- Placeholder Delete Function (Keep as is for now) ---
    window.deleteProduct = function(id) {
        console.log('Attempting to delete product with ID:', id);
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) {
            alert(`刪除功能尚未實作 (商品 ID: ${id})`);
            // Later: Send a DELETE request to the backend API
        }
    };

    // --- Placeholder Add Function (Keep as is for now) ---
    window.showAddForm = function() {
        alert('新增商品表單功能尚未實作');
        // Later: Show a form/modal for adding a new product
    }

    // --- Close Modal if User Clicks Outside of It ---
    window.onclick = function(event) {
        if (event.target == modal) { // Check if the click was directly on the modal background
            closeModal();
        }
    }

     // --- Add Event Listener for Edit Form Submission ---
 if (editForm) {
    editForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default page reload
        editFormError.textContent = ''; // Clear previous errors

        const productId = editProductId.value;
        if (!productId) {
            editFormError.textContent = '錯誤：找不到商品 ID。';
            return;
        }

        // --- 1. Get updated data from form fields ---
        let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value);
        const updatedData = {
            name: editProductName.value.trim(),
            description: editProductDescription.value.trim(),
            price: priceValue, // Send parsed number or null
            image_url: editProductImageUrl.value.trim() || null, // Send null if empty
            seven_eleven_url: editProductSevenElevenUrl.value.trim() || null // Send null if empty
        };

        // --- 2. Basic Frontend Validation (Optional, mirror backend) ---
        if (!updatedData.name) {
            editFormError.textContent = '商品名稱不能為空。';
            return;
        }
         if (updatedData.price !== null && isNaN(updatedData.price)) {
            editFormError.textContent = '價格必須是有效的數字。';
            return;
        }
        if (updatedData.price !== null && updatedData.price < 0) {
             editFormError.textContent = '價格不能是負數。';
            return;
        }
        // Simple URL validation (very basic) - can be improved
        const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
        // if (!isBasicUrlValid(updatedData.image_url)) {
        //     editFormError.textContent = '圖片路徑格式不正確 (應為相對路徑或 http/https 開頭)。';
        //     return;
        // }
        if (!isBasicUrlValid(updatedData.seven_eleven_url)) {
            editFormError.textContent = '7-11 連結格式不正確 (應為 http/https 開頭)。';
            return;
        }

        // --- 3. Send PUT request to backend ---
        try {
            const response = await fetch(`/api/products/${productId}`, {
                method: 'PUT', // Use PUT for replacing the entire resource (or PATCH for partial updates)
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedData) // Convert JS object to JSON string
            });

            // --- 4. Handle response ---
            if (!response.ok) {
                // Try to parse error message from backend
                let errorMsg = `儲存失敗 (HTTP ${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg; // Use backend error if available
                } catch (e) { /* Ignore parsing error */ }
                throw new Error(errorMsg);
            }

            // --- 5. If success ---
            console.log('Product updated successfully!');
            closeModal(); // Close the modal
            // Refresh the entire list to show changes
            // This is simpler than updating just one row, suitable for now
            await fetchAndDisplayProducts();

        } catch (error) {
            // --- 6. If error ---
            console.error('Error updating product:', error);
            editFormError.textContent = `儲存錯誤：${error.message}`; // Display error message
        }
    });
} else {
    console.error("Edit form element not found. Submission listener not added.");
}

// ... (rest of the code: initial load etc.) ...

    // --- Initial Load ---
    fetchAndDisplayProducts(); // Load the product list when the page is ready

});