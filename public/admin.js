// public/admin.js
document.addEventListener('DOMContentLoaded', () => {
    const productListBody = document.querySelector('#product-list-table tbody');
    const productListContainer = document.getElementById('product-list-container');
    const productTable = document.getElementById('product-list-table');
    const loadingMessage = productListContainer.querySelector('p');

    // --- Edit Modal elements ---
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-product-form');
    const editProductId = document.getElementById('edit-product-id');
    const editProductName = document.getElementById('edit-product-name');
    const editProductDescription = document.getElementById('edit-product-description');
    const editProductPrice = document.getElementById('edit-product-price');
    const editProductImageUrl = document.getElementById('edit-product-image-url');
    const editImagePreview = document.getElementById('edit-image-preview');
    const editProductSevenElevenUrl = document.getElementById('edit-product-seven-eleven-url');
    const editFormError = document.getElementById('edit-form-error');

    // --- Add Modal elements ---
    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-product-form');
    const addProductName = document.getElementById('add-product-name');
    const addProductDescription = document.getElementById('add-product-description');
    const addProductPrice = document.getElementById('add-product-price');
    const addProductImageUrl = document.getElementById('add-product-image-url');
    const addProductSevenElevenUrl = document.getElementById('add-product-seven-eleven-url');
    const addFormError = document.getElementById('add-form-error');

    // --- Function to Fetch and Display ALL Products in the Table ---
    async function fetchAndDisplayProducts() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const products = await response.json();

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (productTable) productTable.style.display = 'table';

            productListBody.innerHTML = '';

            if (products.length === 0) {
                productListBody.innerHTML = '<tr><td colspan="5">目前沒有商品。</td></tr>';
                return;
            }

            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td>${product.name || ''}</td>
                    <td>${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
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
        if (!editModal || !editForm || !editProductId || !editProductName || !editProductDescription || !editProductPrice || !editProductImageUrl || !editImagePreview || !editProductSevenElevenUrl || !editFormError) {
             console.error("One or more edit modal elements are missing in the HTML.");
             alert("編輯視窗元件錯誤，無法開啟。");
             return;
         }
         editFormError.textContent = '';
         editForm.reset();
         editImagePreview.style.display = 'none';
         editImagePreview.src = '';

         try {
             const response = await fetch(`/api/products/${id}`);
             if (!response.ok) {
                 if (response.status === 404) throw new Error('找不到該商品。');
                 throw new Error(`無法獲取商品資料 (HTTP ${response.status})`);
             }
             const product = await response.json();

             editProductId.value = product.id;
             editProductName.value = product.name || '';
             editProductDescription.value = product.description || '';
             editProductPrice.value = product.price !== null ? product.price : '';
             editProductImageUrl.value = product.image_url || '';
             editProductSevenElevenUrl.value = product.seven_eleven_url || '';

             if (product.image_url) {
                 editImagePreview.src = product.image_url;
                 editImagePreview.style.display = 'block';
             } else {
                 editImagePreview.style.display = 'none';
             }
             editModal.style.display = 'block';

         } catch (error) {
              console.error(`Error fetching product ${id} for edit:`, error);
              alert(`無法加載編輯資料： ${error.message}`);
         }
    }

    // --- Function to Close the Edit Modal ---
    window.closeModal = function() {
         if (editModal) {
            editModal.style.display = 'none';
         }
    }

    // --- Function to Close the Add Modal ---
    window.closeAddModal = function() {
        if (addModal) {
           addModal.style.display = 'none';
        }
    }

    // --- Attach Edit Function to Global Scope ---
    window.editProduct = function(id) {
        console.log('Attempting to edit product with ID:', id);
        openEditModal(id);
    };

    // --- *** CORRECTED Delete Function *** ---
    window.deleteProduct = async function(id) { // <<< Added async keyword
        console.log('Attempting to delete product with ID:', id); // <<< Corrected 'onsole' to 'console'
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) {
            try {
                const response = await fetch(`/api/products/${id}`, { // <<< Added await
                    method: 'DELETE',
                });
                if (response.status === 204 || response.ok) {
                    console.log(`Product with ID: ${id} deleted successfully.`);
                    await fetchAndDisplayProducts(); // <<< Added await
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`;
                    try {
                        const errorData = await response.json(); // <<< Added await
                        errorMsg = errorData.error || errorMsg;
                    } catch (e) {
                        errorMsg = `${errorMsg}: ${response.statusText}`;
                    }
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error('Error deleting product:', error);
                alert(`刪除時發生錯誤：${error.message}`);
            }
        } else {
            console.log('Deletion cancelled by user.');
        } // <<< Corrected closing brace for if
    }; // <<< Corrected closing brace for function

    // --- Attach Show Add Form Function to Global Scope ---
    window.showAddForm = function() {
        if (!addModal || !addForm || !addFormError) {
            console.error("Add modal elements not found.");
            alert("新增視窗元件錯誤，無法開啟。");
            return;
        }
        addFormError.textContent = '';
        addForm.reset();
        addModal.style.display = 'block';
    }

    // --- Close Modal if User Clicks Outside of It ---
    window.onclick = function(event) {
        if (event.target == editModal) {
            closeModal();
        } else if (event.target == addModal) {
            closeAddModal();
        }
    }

    // --- Edit Form Submission Listener ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            editFormError.textContent = '';
            const productId = editProductId.value;
            if (!productId) {
                editFormError.textContent = '錯誤：找不到商品 ID。';
                return;
            }
            let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value);
            const updatedData = { /* ... (Gather data like before) ... */
                 name: editProductName.value.trim(),
                 description: editProductDescription.value.trim(),
                 price: priceValue,
                 image_url: editProductImageUrl.value.trim() || null,
                 seven_eleven_url: editProductSevenElevenUrl.value.trim() || null
            };
            // --- Validation (like before) ---
             if (!updatedData.name) { editFormError.textContent = '商品名稱不能為空。'; return; }
             if (updatedData.price !== null && isNaN(updatedData.price)) { editFormError.textContent = '價格必須是有效的數字。'; return; }
             if (updatedData.price !== null && updatedData.price < 0) { editFormError.textContent = '價格不能是負數。'; return; }
             const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
             if (!isBasicUrlValid(updatedData.seven_eleven_url)) { editFormError.textContent = '7-11 連結格式不正確 (應為 http/https 開頭)。'; return; }

            try { // --- Send PUT request (like before) ---
                const response = await fetch(`/api/products/${productId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });
                if (!response.ok) { /* ... (Handle error response like before) ... */
                     let errorMsg = `儲存失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg);
                }
                console.log('Product updated successfully!');
                closeModal();
                await fetchAndDisplayProducts();
            } catch (error) { // --- Handle fetch error (like before) ---
                console.error('Error updating product:', error);
                editFormError.textContent = `儲存錯誤：${error.message}`;
            }
        });
    } else {
        console.error("Edit form element not found.");
    }

    // --- Add Form Submission Listener ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            addFormError.textContent = '';
            let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value);
            const newProductData = { /* ... (Gather data like before) ... */
                name: addProductName.value.trim(),
                description: addProductDescription.value.trim(),
                price: priceValue,
                image_url: addProductImageUrl.value.trim() || null,
                seven_eleven_url: addProductSevenElevenUrl.value.trim() || null
            };
            // --- Validation (like before) ---
             if (!newProductData.name) { addFormError.textContent = '商品名稱不能為空。'; return; }
             if (newProductData.price !== null && isNaN(newProductData.price)) { addFormError.textContent = '價格必須是有效的數字。'; return; }
             if (newProductData.price !== null && newProductData.price < 0) { addFormError.textContent = '價格不能是負數。'; return; }
             const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
             if (!isBasicUrlValid(newProductData.seven_eleven_url)) { addFormError.textContent = '7-11 連結格式不正確 (應為 http/https 開頭)。'; return; }

            try { // --- Send POST request (like before) ---
                const response = await fetch(`/api/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newProductData)
                });
                if (!response.ok) { /* ... (Handle error response like before) ... */
                     let errorMsg = `新增失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg);
                }
                console.log('Product added successfully!');
                closeAddModal();
                await fetchAndDisplayProducts();
            } catch (error) { // --- Handle fetch error (like before) ---
                console.error('Error adding product:', error);
                addFormError.textContent = `新增錯誤：${error.message}`;
            }
        });
    } else {
        console.error("Add form element not found.");
    }

    // --- Initial Load ---
    fetchAndDisplayProducts();

}); // End of DOMContentLoaded