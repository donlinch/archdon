// public/admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const productListBody = document.querySelector('#product-list-table tbody');
    const productListContainer = document.getElementById('product-list-container');
    const productTable = document.getElementById('product-list-table');
    const loadingMessage = productListContainer ? productListContainer.querySelector('p') : null; // Safer access

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
    const editProductClickCount = document.getElementById('edit-product-click-count'); // <<< 獲取點擊次數的元素
    const editFormError = document.getElementById('edit-form-error');

    // --- Add Modal elements ---
    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-product-form');
    const addProductName = document.getElementById('add-product-name');
    const addProductDescription = document.getElementById('add-product-description');
    const addProductPrice = document.getElementById('add-product-price');
    const addProductImageUrl = document.getElementById('add-product-image-url');
    // const addImagePreview = document.getElementById('add-image-preview'); // Add modal doesn't have preview in provided HTML
    const addProductSevenElevenUrl = document.getElementById('add-product-seven-eleven-url');
    const addFormError = document.getElementById('add-form-error');

    // --- Function to Fetch and Display ALL Products in the Table ---
    async function fetchAndDisplayProducts() {
        // Ensure crucial elements exist before proceeding
        if (!productListBody || !productListContainer || !productTable) {
            console.error("Admin page table elements not found.");
            if(loadingMessage) loadingMessage.textContent = '頁面結構錯誤，無法載入列表。';
            return;
        }

        try {
            if (loadingMessage) loadingMessage.style.display = 'block'; // Show loading message
            if (productTable) productTable.style.display = 'none';  // Hide table while loading

            const response = await fetch('/api/products'); // Default fetch (latest)
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            }
            const products = await response.json();

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (productTable) productTable.style.display = 'table';

            productListBody.innerHTML = ''; // Clear existing rows

            if (products.length === 0) {
                productListBody.innerHTML = '<tr><td colspan="5">目前沒有商品。</td></tr>';
                return;
            }

            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id; // Store product ID on the row
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td>${product.name || ''}</td>
                    <td>${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
                    <td><img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="width: 50px; height: auto; border: 1px solid #eee;"></td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editProduct(${product.id})">編輯</button>
                        <button class="action-btn delete-btn" onclick="deleteProduct(${product.id})">刪除</button>
                    </td>
                `;
                productListBody.appendChild(row);
            });

        } catch (error) {
            console.error("獲取管理商品列表失敗:", error);
            if (loadingMessage) loadingMessage.textContent = '無法載入商品列表。';
            if (productTable) productTable.style.display = 'none'; // Hide table on error
        }
    }


    // --- Function to Open and Populate the Edit Modal ---
    async function openEditModal(id) {
        // Check if all required edit modal elements exist
        const requiredEditElements = [editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError];
        if (requiredEditElements.some(el => !el)) {
             console.error("一個或多個編輯 Modal 元件在 HTML 中缺失。");
             alert("編輯視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。");
             return;
         }

         editFormError.textContent = ''; // Clear previous errors
         editForm.reset();             // Clear previous form data
         editImagePreview.style.display = 'none'; // Hide preview initially
         editImagePreview.src = '';               // Clear preview src

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
             editProductPrice.value = product.price !== null ? product.price : ''; // Use original value for editing decimals
             editProductImageUrl.value = product.image_url || '';
             editProductSevenElevenUrl.value = product.seven_eleven_url || '';
             editProductClickCount.textContent = product.click_count !== null ? product.click_count : '0'; // <<< 填充點擊次數

             // Show image preview if URL exists
             if (product.image_url) {
                 editImagePreview.src = product.image_url;
                 editImagePreview.style.display = 'block';
             } else {
                 editImagePreview.style.display = 'none';
             }

             editModal.style.display = 'flex'; // Show the modal using flex for centering

         } catch (error) {
              console.error(`獲取商品 ${id} 進行編輯時出錯:`, error);
              alert(`無法載入編輯資料： ${error.message}`);
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
        console.log('嘗試編輯商品 ID:', id);
        openEditModal(id);
    };

    // --- Attach Delete Function to Global Scope ---
    window.deleteProduct = async function(id) {
        console.log('嘗試刪除商品 ID:', id);
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) {
            try {
                const response = await fetch(`/api/products/${id}`, {
                    method: 'DELETE',
                });
                if (response.status === 204 || response.ok) {
                    console.log(`商品 ID: ${id} 已成功刪除。`);
                    await fetchAndDisplayProducts(); // 刷新列表
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorMsg;
                    } catch (e) {
                        errorMsg = `${errorMsg}: ${response.statusText}`;
                    }
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error('刪除商品時出錯:', error);
                alert(`刪除時發生錯誤：${error.message}`);
            }
        } else {
            console.log('用戶取消刪除。');
        }
    };

    // --- Attach Show Add Form Function to Global Scope ---
    window.showAddForm = function() {
        // Check if all required add modal elements exist
        const requiredAddElements = [addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addProductSevenElevenUrl, addFormError];
        if (requiredAddElements.some(el => !el)) {
             console.error("一個或多個新增 Modal 元件在 HTML 中缺失。");
             alert("新增視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。");
             return;
         }
        addFormError.textContent = ''; // 清空之前的錯誤訊息
        addForm.reset();             // 重置表單
        addModal.style.display = 'flex'; // 顯示 Modal (用 flex 居中)
    }

    // --- Close Modals if User Clicks Outside of Modal Content ---
    window.onclick = function(event) {
        if (event.target == editModal) { // 點擊背景
            closeModal();
        } else if (event.target == addModal) { // 點擊背景
            closeAddModal();
        }
    }

    // --- Edit Form Submission Listener ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // 阻止表單默認提交
            editFormError.textContent = ''; // 清空錯誤訊息
            const productId = editProductId.value;
            if (!productId) {
                editFormError.textContent = '錯誤：找不到商品 ID。';
                return;
            }

            // 收集表單數據
            let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value);
            const updatedData = {
                 name: editProductName.value.trim(),
                 description: editProductDescription.value.trim(),
                 price: priceValue,
                 image_url: editProductImageUrl.value.trim() || null,
                 seven_eleven_url: editProductSevenElevenUrl.value.trim() || null
            };

            // 前端驗證
             if (!updatedData.name) { editFormError.textContent = '商品名稱不能為空。'; return; }
             if (updatedData.price !== null && isNaN(updatedData.price)) { editFormError.textContent = '價格必須是有效的數字。'; return; }
             if (updatedData.price !== null && updatedData.price < 0) { editFormError.textContent = '價格不能是負數。'; return; }
             const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
             if (!isBasicUrlValid(updatedData.seven_eleven_url)) { editFormError.textContent = '7-11 連結格式不正確 (應為 http/https 開頭)。'; return; }

            // 發送 PUT 請求
            try {
                const response = await fetch(`/api/products/${productId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });
                if (!response.ok) {
                     let errorMsg = `儲存失敗 (HTTP ${response.status})`;
                     try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {}
                     throw new Error(errorMsg);
                }
                console.log('商品更新成功！');
                closeModal(); // 關閉 Modal
                await fetchAndDisplayProducts(); // 刷新列表
            } catch (error) {
                console.error('更新商品時出錯:', error);
                editFormError.textContent = `儲存錯誤：${error.message}`;
            }
        });
    } else {
        console.error("編輯表單元素未找到。");
    }

    // --- Add Form Submission Listener ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            addFormError.textContent = '';
            let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value);
            const newProductData = {
                name: addProductName.value.trim(),
                description: addProductDescription.value.trim(),
                price: priceValue,
                image_url: addProductImageUrl.value.trim() || null,
                seven_eleven_url: addProductSevenElevenUrl.value.trim() || null
            };

            // 前端驗證
             if (!newProductData.name) { addFormError.textContent = '商品名稱不能為空。'; return; }
             if (newProductData.price !== null && isNaN(newProductData.price)) { addFormError.textContent = '價格必須是有效的數字。'; return; }
             if (newProductData.price !== null && newProductData.price < 0) { addFormError.textContent = '價格不能是負數。'; return; }
             const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
             if (!isBasicUrlValid(newProductData.seven_eleven_url)) { addFormError.textContent = '7-11 連結格式不正確 (應為 http/https 開頭)。'; return; }

            // 發送 POST 請求
            try {
                const response = await fetch(`/api/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newProductData)
                });
                if (!response.ok) { // 檢查非 2xx 狀態碼
                     let errorMsg = `新增失敗 (HTTP ${response.status})`;
                     try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {}
                     throw new Error(errorMsg);
                }
                console.log('商品新增成功！');
                closeAddModal(); // 關閉 Modal
                await fetchAndDisplayProducts(); // 刷新列表
            } catch (error) {
                console.error('新增商品時出錯:', error);
                addFormError.textContent = `新增錯誤：${error.message}`;
            }
        });
    } else {
        console.error("新增表單元素未找到。");
    }

    // --- Initial Load ---
    fetchAndDisplayProducts(); // 頁面載入時獲取並顯示商品列表

}); // End of DOMContentLoaded