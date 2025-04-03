// public/admin.js (基礎版本 + Add Modal 規格輸入)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References (商品列表和 Modal) ---
    const productListBody = document.querySelector('#product-list-table tbody');
    const productListContainer = document.getElementById('product-list-container');
    const productTable = document.getElementById('product-list-table');
    const loadingMessage = productListContainer ? productListContainer.querySelector('p') : null;

    // --- Edit Modal Elements (基礎版本) ---
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-product-form');
    const editProductId = document.getElementById('edit-product-id');
    const editProductName = document.getElementById('edit-product-name');
    const editProductDescription = document.getElementById('edit-product-description');
    const editProductPrice = document.getElementById('edit-product-price');
    const editProductImageUrl = document.getElementById('edit-product-image-url');
    const editImagePreview = document.getElementById('edit-image-preview');
    const editProductSevenElevenUrl = document.getElementById('edit-product-seven-eleven-url');
    const editProductClickCount = document.getElementById('edit-product-click-count');
    const editFormError = document.getElementById('edit-form-error');

    // --- Add Modal Elements (包含規格容器) ---
    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-product-form');
    const addProductName = document.getElementById('add-product-name');
    const addProductDescription = document.getElementById('add-product-description');
    const addProductPrice = document.getElementById('add-product-price');
    const addProductImageUrl = document.getElementById('add-product-image-url');
    const addImagePreview = document.getElementById('add-image-preview');
    const addProductSevenElevenUrl = document.getElementById('add-product-seven-eleven-url');
    const addFormError = document.getElementById('add-form-error');
    const addVariationsContainer = document.getElementById('add-variations-container'); // << Add Modal 規格容器

    // --- 流量圖表相關元素 ---
    const trafficChartCanvas = document.getElementById('traffic-chart');
    const chartLoadingMsg = document.getElementById('chart-loading-msg');
    const chartErrorMsg = document.getElementById('chart-error-msg');
    const btnDaily = document.getElementById('btn-daily');
    const btnMonthly = document.getElementById('btn-monthly');
    let trafficChartInstance = null;
    let currentGranularity = 'daily';

    // --- 檢查必要元素是否存在 ---
    function checkElements(...elements) {
        const missingElementIds = [];
        let allExist = true;
        for (let i = 0; i < elements.length; i++) {
            if (!elements[i]) {
                // 嘗試獲取與該變數相關的ID (這只是一個猜測，可能不準確)
                const potentialId = Object.keys(window).find(key => window[key] === elements[i]) || `元素索引 ${i}`;
                missingElementIds.push(potentialId);
                allExist = false;
            }
        }
        if (!allExist) {
             const errorMessage = `初始化錯誤：缺少必要的 DOM 元素。請檢查 HTML ID 是否正確。缺失的元素可能包括: ${missingElementIds.join(', ')}`;
             console.error(errorMessage);
             if(document.body) {
                 const errorDiv = document.createElement('div');
                 errorDiv.style.backgroundColor = 'red'; errorDiv.style.color = 'white'; errorDiv.style.padding = '10px';
                 errorDiv.style.textAlign = 'center'; errorDiv.style.fontWeight = 'bold'; errorDiv.style.position = 'fixed';
                 errorDiv.style.top = '0'; errorDiv.style.left = '0'; errorDiv.style.right = '0'; errorDiv.style.zIndex = '2000';
                 errorDiv.textContent = `頁面載入錯誤：${errorMessage}，部分功能可能無法運作。`;
                 document.body.insertBefore(errorDiv, document.body.firstChild);
             }
        }
        return allExist;
    }
    // 執行核心元素檢查
    const coreElementsExist = checkElements(
        productListBody, productListContainer, productTable, // 列表
        editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError, // Edit Modal (基礎)
        addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addImagePreview, addProductSevenElevenUrl, addFormError, addVariationsContainer, // Add Modal (含規格容器)
        trafficChartCanvas, chartLoadingMsg, chartErrorMsg, btnDaily, btnMonthly // 流量圖表
    );
    if (!coreElementsExist) { console.error("停止執行 admin.js，因缺少核心頁面元件。"); return; }


    // --- 動態添加商品規格輸入列的函數 ---
    window.addVariationInputRow = function(modalPrefix) { // 掛載到 window
        const containerId = `${modalPrefix}-variations-container`;
        const container = document.getElementById(containerId);
        if (!container) { console.error(`找不到規格容器 #${containerId}`); alert(`錯誤：無法找到規格輸入區域 (ID: ${containerId})`); return; }

        const variationIndex = container.querySelectorAll('.variation-input-row').length;
        const div = document.createElement('div');
        div.classList.add('variation-input-row');
        div.style.display = 'flex'; div.style.gap = '10px'; div.style.marginBottom = '10px'; div.style.alignItems = 'center';

        // 只包含 name, inventory, sku 和移除按鈕
        div.innerHTML = `
            <input type="text" name="variations[${variationIndex}][name]" placeholder="規格名稱 (例: S)" style="flex: 2;" required>
            <input type="number" name="variations[${variationIndex}][inventory_count]" min="0" value="0" placeholder="初始庫存" style="flex: 1; text-align: center;" required>
            <input type="text" name="variations[${variationIndex}][sku]" placeholder="SKU (選填)" style="flex: 1;">
            <button type="button" class="action-btn delete-btn" onclick="this.closest('.variation-input-row').remove()" title="移除此規格" style="flex-shrink: 0; padding: 5px 8px; background-color:#dc3545; color:white; border-color:#dc3545;">移除</button>
            `; // 移除了 hidden id input
        div.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
             input.style.padding = '8px'; input.style.border = '1px solid #ccc'; input.style.borderRadius = '3px'; input.style.fontSize = '0.9em';
        });

        container.appendChild(div);
    };


    // --- Function to Fetch and Display ALL Products in the Table ---
    async function fetchAndDisplayProducts() {
        if (!productListBody || !productListContainer || !productTable) return;
        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (productTable) productTable.style.display = 'none';

            const response = await fetch('/api/products'); // API 只需返回基礎 products 表欄位
            if (!response.ok) { throw new Error(`HTTP 錯誤！狀態: ${response.status}`); }
            const products = await response.json();

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (productTable) productTable.style.display = 'table';
            productListBody.innerHTML = '';

            if (products.length === 0) {
                productListBody.innerHTML = '<tr><td colspan="6">目前沒有商品。</td></tr>'; // Colspan 6
                return;
            }

            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;
                // 基礎版本表格行 (6個 td)
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td title="${product.name || ''}">${product.name || ''}</td>
                    <td style="text-align:right; padding-right: 15px;">${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
                    <td style="text-align:center;">${product.click_count !== null ? product.click_count : '0'}</td>
                    <td style="text-align:center;">
                        <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="max-width: 50px; max-height: 50px; height: auto; border: 1px solid #eee; display: inline-block; vertical-align: middle;">
                    </td>
                    <td style="text-align:center;">
                        <button class="action-btn edit-btn" onclick="window.editProduct(${product.id})">編輯</button>
                        <button class="action-btn delete-btn" onclick="window.deleteProduct(${product.id})">刪除</button>
                        <!-- 沒有查看銷售按鈕 -->
                    </td>
                `;
                productListBody.appendChild(row);
            });
        } catch (error) {
            console.error("獲取管理商品列表失敗:", error);
            if (loadingMessage) loadingMessage.textContent = '無法載入商品列表。';
            if (productTable) productTable.style.display = 'none';
        }
    }

    // --- Function to Open and Populate the Edit Modal (Basic Version) ---
    async function openEditModal(id) {
        // 只檢查基礎 Edit Modal 元素
        if (!checkElements(editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError)) return;

        editFormError.textContent = ''; editForm.reset(); editImagePreview.style.display = 'none'; editImagePreview.src = '';

        try {
            const response = await fetch(`/api/products/${id}`); // API 只需返回基礎商品資料
            if (!response.ok) {
                 let errorMsg = `無法獲取商品資料 (HTTP ${response.status})`;
                 if (response.status === 404) errorMsg = '找不到該商品。';
                 else { try { const data = await response.json(); errorMsg += `: ${data.error || ''}`; } catch(e){} }
                 throw new Error(errorMsg);
             }
            const product = await response.json();

            // Fill basic product data ONLY
            editProductId.value = product.id; editProductName.value = product.name || ''; editProductDescription.value = product.description || ''; editProductPrice.value = product.price !== null ? product.price : ''; editProductImageUrl.value = product.image_url || ''; editProductSevenElevenUrl.value = product.seven_eleven_url || ''; editProductClickCount.textContent = product.click_count !== null ? product.click_count : '0';
            if (product.image_url) { editImagePreview.src = product.image_url; editImagePreview.style.display = 'block'; } else { editImagePreview.style.display = 'none'; }

            // **不**處理規格相關的渲染或事件綁定

            editModal.style.display = 'flex';
        } catch (error) { console.error(`獲取商品 ${id} 編輯資料出錯:`, error); alert(`無法載入編輯資料： ${error.message}`); }
    }

    // --- Handle Edit Form Submission (Basic Version) ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
             event.preventDefault();
             if(!checkElements(editFormError, editProductId, editProductName, editProductPrice)) return;
             editFormError.textContent = '';
             const productId = editProductId.value;
             if (!productId) { editFormError.textContent = '錯誤：找不到商品 ID。'; return; }

             let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value);
             // 只包含基礎欄位
             const updatedData = {
                 name: editProductName.value.trim(),
                 description: editProductDescription.value.trim(),
                 price: priceValue,
                 image_url: editProductImageUrl.value.trim() || null,
                 seven_eleven_url: editProductSevenElevenUrl.value.trim() || null
             };
             if (!updatedData.name) { editFormError.textContent = '商品名稱不能為空。'; return; }
             if (updatedData.price !== null && isNaN(updatedData.price)) { editFormError.textContent = '價格必須是數字。'; return; }

             const saveButton = editForm.querySelector('.save-btn');
             if(saveButton) saveButton.disabled = true;

             try {
                 // API 只需處理基礎欄位更新
                 const response = await fetch(`/api/products/${productId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) });
                  if (!response.ok) {
                      let errorMsg = `商品資料儲存失敗 (HTTP ${response.status})`;
                      try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){}
                      throw new Error(errorMsg);
                  }
                 closeModal();
                 await fetchAndDisplayProducts();
             } catch (error) { console.error('儲存商品時出錯:', error); editFormError.textContent = `儲存錯誤：${error.message || '請檢查網絡或聯繫管理員'}`;
             } finally { if(saveButton) saveButton.disabled = false; }
        });
    } // else handled by initial check

    // --- Handle Add Form Submission (With Variations) ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
             event.preventDefault();
             // 檢查 Add Modal 的核心元素
             if(!checkElements(addFormError, addProductName, addProductPrice, addVariationsContainer)) return;
             addFormError.textContent = '';

             // 1. Collect basic product data
             let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value);
             const newProductData = {
                 name: addProductName.value.trim(),
                 description: addProductDescription.value.trim(),
                 price: priceValue,
                 image_url: addProductImageUrl.value.trim() || null,
                 seven_eleven_url: addProductSevenElevenUrl.value.trim() || null,
                 variations: [] // Initialize variations array
             };
             if (!newProductData.name) { addFormError.textContent = '商品名稱不能為空。'; return; }
             if (newProductData.price === null || isNaN(newProductData.price) || newProductData.price < 0) { addFormError.textContent = '請輸入有效的商品價格。'; return; }

             // 2. Collect variations data
             let variationValidationError = false;
             const variationRows = addVariationsContainer.querySelectorAll('.variation-input-row');
             variationRows.forEach((row, index) => {
                 if (variationValidationError) return;
                 const nameInput = row.querySelector(`input[name="variations[${index}][name]"]`);
                 const inventoryInput = row.querySelector(`input[name="variations[${index}][inventory_count]"]`);
                 const skuInput = row.querySelector(`input[name="variations[${index}][sku]"]`);
                 const name = nameInput ? nameInput.value.trim() : '';
                 const inventoryStr = inventoryInput ? inventoryInput.value.trim() : '';
                 const sku = skuInput ? skuInput.value.trim() : null;

                 if (!name) { addFormError.textContent = `第 ${index + 1} 個規格的名稱不能為空。`; variationValidationError = true; if (nameInput) nameInput.focus(); return; }
                 if (inventoryStr === '') { addFormError.textContent = `第 ${index + 1} 個規格「${name}」的庫存不能為空。`; variationValidationError = true; if (inventoryInput) inventoryInput.focus(); return; }
                 const inventoryCount = parseInt(inventoryStr);
                 if (isNaN(inventoryCount) || inventoryCount < 0) { addFormError.textContent = `第 ${index + 1} 個規格「${name}」的庫存必須是非負整數。`; variationValidationError = true; if (inventoryInput) inventoryInput.focus(); return; }
                 // 只收集 name, inventory_count, sku
                 newProductData.variations.push({ name: name, inventory_count: inventoryCount, sku: sku || null });
             });
             if (variationValidationError) return;

             // 3. Send request (Backend needs to handle variations array)
             const addButton = addForm.querySelector('.save-btn');
             if(addButton) addButton.disabled = true;
             try {
                 const response = await fetch(`/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProductData) });
                  if (!response.ok) {
                      let errorMsg = `新增失敗 (HTTP ${response.status})`;
                      try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){}
                      throw new Error(errorMsg);
                  }
                 closeAddModal();
                 await fetchAndDisplayProducts();
             } catch (error) { addFormError.textContent = `新增錯誤：${error.message}`;
             } finally { if(addButton) addButton.disabled = false; }
        });
    } // else handled by initial check

    // --- Display Traffic Chart ---
    async function displayTrafficChart(granularity = 'daily') {
        if (!trafficChartCanvas || !chartLoadingMsg || !chartErrorMsg) return;
        const ctx = trafficChartCanvas.getContext('2d'); currentGranularity = granularity;
        chartLoadingMsg.style.display = 'block'; chartErrorMsg.style.display = 'none';
        if (trafficChartInstance) { trafficChartInstance.destroy(); trafficChartInstance = null; }
        trafficChartCanvas.style.display = 'none';
        let apiUrl = '/api/analytics/traffic'; if (granularity === 'monthly') { apiUrl = '/api/analytics/monthly-traffic'; }
        try {
            const response = await fetch(apiUrl);
             if (!response.ok) { let errorMsg = `無法獲取流量數據 (HTTP ${response.status})`; try { const data = await response.json(); errorMsg = data.error || errorMsg; } catch(e){} throw new Error(errorMsg); }
            const trafficData = await response.json();
            chartLoadingMsg.style.display = 'none'; trafficChartCanvas.style.display = 'block';
            if (trafficData.length === 0) { if (chartErrorMsg) { chartErrorMsg.textContent='（尚無流量數據）'; chartErrorMsg.style.display='block'; chartErrorMsg.style.color='#888';} return; }
            const labels = trafficData.map(item => item.date || item.month); const dataPoints = trafficData.map(item => item.count);
            trafficChartInstance = new Chart(ctx, {
                type: 'line', data: { labels: labels, datasets: [{ label: granularity === 'daily' ? '每日瀏覽量' : '每月瀏覽量', data: dataPoints, borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.1)', fill: true, tension: 0.2 }] },
                options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true }, title: { display: false } } }
            });
        } catch (error) { console.error(`繪製 ${granularity} 流量圖表失敗:`, error); chartLoadingMsg.style.display = 'none'; chartErrorMsg.textContent=`無法載入流量圖: ${error.message}`; chartErrorMsg.style.display='block'; }
    }
    // --- Traffic Chart Button Listeners ---
    if (btnDaily && btnMonthly) {
        const toggleButtons = [btnDaily, btnMonthly];
        toggleButtons.forEach(button => { button.addEventListener('click', () => { const newGranularity = button.dataset.granularity; if (newGranularity !== currentGranularity) { toggleButtons.forEach(btn => btn.classList.remove('active')); button.classList.add('active'); displayTrafficChart(newGranularity); } }); });
    } // else handled by initial check

    // --- Helper Functions and Global Scope Attachments ---
    window.closeModal = function() { if (editModal) { editModal.style.display = 'none'; } }
    window.closeAddModal = function() { if (addModal) { addModal.style.display = 'none'; } }
    window.editProduct = function(id) { openEditModal(id); };
    window.deleteProduct = async function(id) {
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) {
            try {
                const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
                 if (response.status === 204 || response.ok) {
                    await fetchAndDisplayProducts();
                 } else { let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const data = await response.json(); errorMsg = data.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
             } catch (error) { alert(`刪除時發生錯誤：${error.message}`); }
        }
    };
    window.showAddForm = function() {
        // 檢查 Add Modal 相關元素
        if(!checkElements(addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addProductSevenElevenUrl, addFormError, addImagePreview, addVariationsContainer)) return;

        addFormError.textContent = ''; addForm.reset();
        addImagePreview.src = ''; addImagePreview.style.display = 'none';
        // 清空規格容器
        if (addVariationsContainer) addVariationsContainer.innerHTML = '';
        // 可以選擇預設添加一或多行空白規格
        // addVariationInputRow('add');
        addModal.style.display = 'flex';
    };
    window.onclick = function(event) { if (event.target == editModal) { closeModal(); } else if (event.target == addModal) { closeAddModal(); } }

    // --- Image Preview Setup ---
    function setupImagePreview(inputElement, previewElement) {
        if (inputElement && previewElement) {
            inputElement.addEventListener('input', () => { const url = inputElement.value.trim(); previewElement.src = url; previewElement.style.display = url ? 'block' : 'none'; });
            const initialUrl = inputElement.value.trim(); if (initialUrl) { previewElement.src = initialUrl; previewElement.style.display = 'block'; } else { previewElement.style.display = 'none'; }
        }
    }
    setupImagePreview(editProductImageUrl, editImagePreview);
    setupImagePreview(addProductImageUrl, addImagePreview);


    // --- Initial Page Load ---
    async function initializePage() {
        if (!coreElementsExist) return;
        try {
            await fetchAndDisplayProducts();
            await displayTrafficChart('daily');
            console.log("Admin page initialized (Basic + Add Variation Inputs).");
        } catch (error) { console.error("頁面初始化過程中發生錯誤:", error); }
    }

    initializePage();

}); // --- End of DOMContentLoaded ---