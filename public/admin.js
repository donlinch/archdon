// public/admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References (商品列表和 Modal) ---
    const productListBody = document.querySelector('#product-list-table tbody');
    const productListContainer = document.getElementById('product-list-container');
    const productTable = document.getElementById('product-list-table');
    const loadingMessage = productListContainer ? productListContainer.querySelector('p') : null;

    // --- Edit/Add Modal Elements ---
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
    // Modal 內的銷售區塊元素
    const editVariationListDiv = document.getElementById('edit-variation-list');
    const recordSalesBtn = document.getElementById('record-sales-btn');
    const recordSalesError = document.getElementById('record-sales-error');
    const recordSalesSuccess = document.getElementById('record-sales-success');

    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-product-form');
    const addProductName = document.getElementById('add-product-name');
    const addProductDescription = document.getElementById('add-product-description'); // 確保存在
    const addProductPrice = document.getElementById('add-product-price');       // 確保存在
    const addProductImageUrl = document.getElementById('add-product-image-url'); // 確保存在
    const addImagePreview = document.getElementById('add-image-preview');
    const addProductSevenElevenUrl = document.getElementById('add-product-seven-eleven-url'); // 確保存在
    const addFormError = document.getElementById('add-form-error');

    // --- 銷售報告區塊元素 ---
    const salesReportSection = document.getElementById('sales-report-section');
    const salesReportTitle = document.getElementById('sales-report-title');
    const salesReportChartContainer = document.getElementById('sales-report-chart-container');
    const salesReportChartCanvas = document.getElementById('sales-report-chart');
    const salesReportLoading = document.getElementById('sales-report-loading');
    const salesReportError = document.getElementById('sales-report-error');
    const salesReportNoData = document.getElementById('sales-report-nodata');
    let salesReportChartInstance = null; // 儲存銷售報告圖表實例
    let currentReportProductId = null; // 追蹤當前報告的商品ID (null 代表總覽)

    // --- 流量圖表相關元素 ---
    const trafficChartCanvas = document.getElementById('traffic-chart');
    const chartLoadingMsg = document.getElementById('chart-loading-msg');
    const chartErrorMsg = document.getElementById('chart-error-msg');
    const btnDaily = document.getElementById('btn-daily');
    const btnMonthly = document.getElementById('btn-monthly');
    let trafficChartInstance = null; // 儲存流量圖表實例
    let currentGranularity = 'daily';

    // --- Function to Fetch and Display ALL Products in the Table ---
    async function fetchAndDisplayProducts() {
        if (!productListBody || !productListContainer || !productTable) {
            console.error("Admin page table elements not found.");
            if(loadingMessage) loadingMessage.textContent='頁面結構錯誤，無法載入列表。';
            return;
        }
        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (productTable) productTable.style.display = 'none';

            // API 需要返回包含 total_inventory 的數據
            const response = await fetch('/api/products');
            if (!response.ok) { throw new Error(`HTTP 錯誤！狀態: ${response.status}`); }
            const products = await response.json();

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (productTable) productTable.style.display = 'table';
            productListBody.innerHTML = '';

            if (products.length === 0) {
                productListBody.innerHTML = '<tr><td colspan="7">目前沒有商品。</td></tr>'; // Colspan 7
                return;
            }

            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;
                const inventory = product.total_inventory !== undefined ? product.total_inventory : 'N/A';
                const lowStock = (inventory !== 'N/A' && inventory <= 5); // 假設庫存 <= 5 為低庫存
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td title="${product.name || ''}">${product.name || ''}</td>
                    <td style="text-align:right; padding-right: 10px;">${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
                    <td style="text-align:center;">${product.click_count !== null ? product.click_count : '0'}</td>
                    <td style="text-align:center; font-weight: ${lowStock ? 'bold' : 'normal'}; color: ${lowStock ? 'red' : 'inherit'};" title="總庫存">${inventory}</td>
                    <td><img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="max-width: 50px; height: auto; border: 1px solid #eee; display: block; margin: 0 auto;"></td>
                    <td style="text-align:center;">
                        <button class="action-btn edit-btn" onclick="window.editProduct(${product.id})">編輯</button>
                        <button class="action-btn delete-btn" onclick="window.deleteProduct(${product.id})">刪除</button>
                        <button class="action-btn view-sales-btn" data-product-id="${product.id}" data-product-name="${product.name || '商品'}">查看銷售</button>
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

    // --- Function to Open and Populate the Edit Modal ---
    async function openEditModal(id) {
        const requiredEditElements = [editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError, editVariationListDiv, recordSalesBtn, recordSalesError, recordSalesSuccess];
        if (requiredEditElements.some(el => !el)) { console.error("編輯 Modal 元件缺失"); alert("編輯視窗元件錯誤"); return; }
        editFormError.textContent = ''; editForm.reset(); editImagePreview.style.display = 'none'; editImagePreview.src = '';
        editVariationListDiv.innerHTML = '<p style="color: #888; text-align: center;">正在載入規格...</p>';
        recordSalesError.textContent = ''; recordSalesSuccess.textContent = '';

        try {
            // API 需要返回商品及其 variations (含 inventory_count)
            const response = await fetch(`/api/products/${id}`);
            if (!response.ok) {
                 let errorMsg = `無法獲取商品資料 (HTTP ${response.status})`;
                 if (response.status === 404) errorMsg = '找不到該商品。';
                 else { try { const data = await response.json(); errorMsg += `: ${data.error || ''}`; } catch(e){} }
                 throw new Error(errorMsg);
             }
            const product = await response.json();

            // Fill basic product data
            editProductId.value = product.id; editProductName.value = product.name || ''; editProductDescription.value = product.description || ''; editProductPrice.value = product.price !== null ? product.price : ''; editProductImageUrl.value = product.image_url || ''; editProductSevenElevenUrl.value = product.seven_eleven_url || ''; editProductClickCount.textContent = product.click_count !== null ? product.click_count : '0';
            if (product.image_url) { editImagePreview.src = product.image_url; editImagePreview.style.display = 'block'; } else { editImagePreview.style.display = 'none'; }

            // Fill variations, inventory inputs, and sales inputs
            renderVariationsForEditing(product.variations || []);

            editModal.style.display = 'flex';
        } catch (error) { console.error(`獲取商品 ${id} 編輯資料出錯:`, error); alert(`無法載入編輯資料： ${error.message}`); }
    }

    // --- Render Variations in Edit Modal ---
    function renderVariationsForEditing(variations) {
        if (!editVariationListDiv) return;
        editVariationListDiv.innerHTML = '';

        if (!variations || variations.length === 0) {
            editVariationListDiv.innerHTML = '<p style="color: #888; text-align: center;">此商品沒有設定規格。請先新增商品，再編輯以添加規格。</p>';
            if(recordSalesBtn) recordSalesBtn.disabled = true;
            return;
        }

        if(recordSalesBtn) recordSalesBtn.disabled = false;

        variations.forEach(variation => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('variation-item');
            itemDiv.dataset.variationId = variation.id;

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('variation-name');
            nameSpan.textContent = variation.name || '未命名規格';

            // Display current inventory
            const inventoryDisplaySpan = document.createElement('span');
            inventoryDisplaySpan.classList.add('variation-inventory-display');
            inventoryDisplaySpan.textContent = `庫存: ${variation.inventory_count !== undefined ? variation.inventory_count : 'N/A'}`;

            // Input for updating inventory
            const inventoryInputDiv = document.createElement('div');
            inventoryInputDiv.classList.add('variation-inventory-input');
            const inventoryLabel = document.createElement('label');
            inventoryLabel.htmlFor = `inventory-input-${variation.id}`;
            inventoryLabel.textContent = '更新庫存:';
            const inventoryInput = document.createElement('input');
            inventoryInput.type = 'number';
            inventoryInput.id = `inventory-input-${variation.id}`;
            inventoryInput.min = '0';
            inventoryInput.placeholder = '數量';
            inventoryInput.dataset.variationId = variation.id; // Store ID for saving
            inventoryInput.value = variation.inventory_count !== undefined ? variation.inventory_count : ''; // Pre-fill
            inventoryInputDiv.appendChild(inventoryLabel);
            inventoryInputDiv.appendChild(inventoryInput);


            // Input for recording sales quantity
            const salesInputDiv = document.createElement('div');
            salesInputDiv.classList.add('variation-sales-input');
            const salesLabel = document.createElement('label');
            salesLabel.htmlFor = `sales-input-${variation.id}`;
            salesLabel.textContent = '本次售出:';
            const salesInput = document.createElement('input');
            salesInput.type = 'number';
            salesInput.id = `sales-input-${variation.id}`;
            salesInput.min = '0';
            salesInput.placeholder = '數量';
            salesInput.dataset.variationId = variation.id; // Store ID for recording sales
            salesInputDiv.appendChild(salesLabel);
            salesInputDiv.appendChild(salesInput);

            itemDiv.appendChild(nameSpan);
            itemDiv.appendChild(inventoryDisplaySpan);
            itemDiv.appendChild(inventoryInputDiv);
            itemDiv.appendChild(salesInputDiv);

            editVariationListDiv.appendChild(itemDiv);
        });
    }

    // --- Handle "Record Sales" Button Click in Modal ---
    if (recordSalesBtn) {
        recordSalesBtn.addEventListener('click', async () => {
            if (!editVariationListDiv) return;
            recordSalesError.textContent = ''; recordSalesSuccess.textContent = '';

            const salesEntries = [];
            const salesInputs = editVariationListDiv.querySelectorAll('.variation-sales-input input');

            salesInputs.forEach(input => {
                const quantity = parseInt(input.value);
                const variationId = input.dataset.variationId;
                if (!isNaN(quantity) && quantity > 0 && variationId) {
                    salesEntries.push({ variationId: variationId, quantity: quantity });
                }
            });

            if (salesEntries.length === 0) { recordSalesError.textContent = '請至少輸入一個規格的售出數量。'; return; }

            recordSalesBtn.disabled = true; recordSalesBtn.textContent = '記錄中...';

            try {
                const response = await fetch('/api/admin/sales-log', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: salesEntries })
                });
                if (!response.ok) {
                    let errorMsg = `記錄銷售失敗 (HTTP ${response.status})`; try{ const data = await response.json(); errorMsg += `: ${data.error || '請重試'}`;} catch(e){} throw new Error(errorMsg);
                }
                const result = await response.json();
                recordSalesSuccess.textContent = result.message || '銷售記錄成功！';
                salesInputs.forEach(input => input.value = ''); // Clear inputs
                setTimeout(() => { recordSalesSuccess.textContent = ''; }, 3000);

                // Refresh the sales report chart
                const currentProductId = editProductId.value;
                if (currentReportProductId === currentProductId) {
                    const currentProductName = editProductName.value;
                    await displayProductVariationSalesChart(currentProductId, currentProductName);
                } else {
                    await displayOverallSalesChart(currentGranularity === 'monthly' ? 'monthly' : 'daily');
                }
                 // Refresh product list to show updated inventory potentially (if backend auto-decrements)
                 // Even if not, good to keep list fresh in case other changes happened
                 await fetchAndDisplayProducts();


            } catch (error) { console.error('記錄銷售時出錯:', error); recordSalesError.textContent = `記錄失敗: ${error.message || error}`;
            } finally { recordSalesBtn.disabled = false; recordSalesBtn.textContent = '記錄本次銷售'; }
        });
    } else { console.error("找不到記錄銷售按鈕 (#record-sales-btn)"); }

    // --- Handle Edit Form Submission (Save Product + Inventory) ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            editFormError.textContent = '';
            const productId = editProductId.value;
            if (!productId) { editFormError.textContent = '錯誤：找不到商品 ID。'; return; }

            // 1. Collect basic product data
            let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value);
            const productData = { /* ... name, description, etc ... */
                name: editProductName.value.trim(), description: editProductDescription.value.trim(), price: priceValue, image_url: editProductImageUrl.value.trim() || null, seven_eleven_url: editProductSevenElevenUrl.value.trim() || null
            };
            if (!productData.name) { editFormError.textContent = '商品名稱不能為空。'; return; }
            // ... other product data validation ...

            // 2. Collect inventory data
            const inventoryUpdates = [];
            const inventoryInputs = editVariationListDiv.querySelectorAll('.variation-inventory-input input');
            let inventoryValidationError = false;
            inventoryInputs.forEach(input => {
                const variationId = input.dataset.variationId;
                const inventoryCountStr = input.value.trim();
                if (variationId && inventoryCountStr !== '') { // Only process if ID exists and input is not empty
                    const inventoryCount = parseInt(inventoryCountStr);
                    if (isNaN(inventoryCount) || inventoryCount < 0) {
                        editFormError.textContent = `規格 #${variationId} 的庫存數量無效。`;
                        inventoryValidationError = true;
                        input.focus(); // Highlight the problematic input
                        return; // Stop processing further inputs
                    }
                    inventoryUpdates.push({ variationId: variationId, inventory_count: inventoryCount });
                } else if (variationId && inventoryCountStr === ''){
                     editFormError.textContent = `請為規格 #${variationId} 輸入庫存數量。`;
                     inventoryValidationError = true;
                     input.focus();
                     return;
                }
            });

            if (inventoryValidationError) return; // Stop if validation failed

            const saveButton = editForm.querySelector('.save-btn');
            if(saveButton) saveButton.disabled = true;

            try {
                // 3. Update basic product info
                const productResponse = await fetch(`/api/products/${productId}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productData)
                });
                if (!productResponse.ok) { /* ... error handling ... */ throw new Error(`商品資料儲存失敗 (HTTP ${productResponse.status})`); }

                // 4. Update inventory counts (using Promise.all for concurrent updates)
                if (inventoryUpdates.length > 0) {
                    console.log("準備更新庫存:", inventoryUpdates);
                    const inventoryPromises = inventoryUpdates.map(update =>
                        fetch(`/api/admin/variations/${update.variationId}`, {
                            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inventory_count: update.inventory_count })
                        }).then(res => {
                            if (!res.ok) {
                                // Log error but don't stop other updates immediately
                                console.error(`更新規格 ${update.variationId} 庫存失敗 (HTTP ${res.status})`);
                                return res.json().catch(() => ({ error: `HTTP ${res.status}` })).then(errData => Promise.reject(errData)); // Propagate error
                            }
                            return res.json(); // Or just return true/status code if no body expected
                        })
                    );
                     // Wait for all inventory updates to finish
                     await Promise.all(inventoryPromises);
                     console.log("所有庫存更新請求已發送。");
                }

                // 5. Close modal and refresh list on overall success
                closeModal();
                await fetchAndDisplayProducts(); // Refresh product list

            } catch (error) {
                console.error('儲存商品或庫存時出錯:', error);
                editFormError.textContent = `儲存錯誤：${error.error || error.message || '未知錯誤'}`;
            } finally {
                 if(saveButton) saveButton.disabled = false;
            }
        });
    } else { console.error("編輯表單元素 (#edit-product-form) 未找到。"); }

    // --- Display Overall Sales Chart ---
    async function displayOverallSalesChart(timeframe = 'daily') {
        if (!salesReportChartCanvas || !salesReportLoading || !salesReportError || !salesReportNoData || !salesReportTitle) return;
        currentReportProductId = null;
        salesReportTitle.textContent = timeframe === 'monthly' ? '整體月銷售趨勢' : '整體日銷售趨勢'; // 更新標題
        salesReportLoading.style.display = 'block'; salesReportError.style.display = 'none'; salesReportNoData.style.display = 'none';
        if (salesReportChartInstance) { salesReportChartInstance.destroy(); salesReportChartInstance = null; }
        salesReportChartCanvas.style.display = 'none';

        try {
            const apiUrl = `/api/admin/analytics/overall-sales-trend?timeframe=${timeframe}`;
            const response = await fetch(apiUrl);
            if (!response.ok) { throw new Error(`獲取趨勢數據失敗 (HTTP ${response.status})`); }
            const salesData = await response.json();
            salesReportLoading.style.display = 'none';

            if (!salesData || salesData.length === 0) { salesReportNoData.style.display = 'block'; return; }
            salesReportChartCanvas.style.display = 'block';
            const labels = salesData.map(item => item.date_period);
            const data = salesData.map(item => item.total_quantity);
            const ctx = salesReportChartCanvas.getContext('2d');
            salesReportChartInstance = new Chart(ctx, {
                type: 'line', data: { labels: labels, datasets: [{ label: '總銷售數量', data: data, borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgba(75, 192, 192, 0.2)', fill: true, tension: 0.1 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks:{ stepSize: 1 } } }, plugins: { legend: { display: true }, title: { display: false } } }
            });
        } catch (error) { console.error('繪製整體銷售趨勢圖失敗:', error); salesReportLoading.style.display = 'none'; salesReportError.textContent = `無法載入趨勢圖: ${error.message}`; salesReportError.style.display = 'block'; }
    }

    // --- Display Product Variation Sales Chart ---
    async function displayProductVariationSalesChart(productId, productName) {
         if (!salesReportChartCanvas || !salesReportLoading || !salesReportError || !salesReportNoData || !salesReportTitle) return;
         currentReportProductId = productId;
         salesReportTitle.textContent = `商品「${productName}」各規格銷售統計`;
         salesReportLoading.style.display = 'block'; salesReportError.style.display = 'none'; salesReportNoData.style.display = 'none';
         if (salesReportChartInstance) { salesReportChartInstance.destroy(); salesReportChartInstance = null; }
         salesReportChartCanvas.style.display = 'none';

         try {
             const apiUrl = `/api/admin/products/${productId}/variation-sales-summary`;
             const response = await fetch(apiUrl);
             if (!response.ok) { throw new Error(`獲取規格銷售數據失敗 (HTTP ${response.status})`); }
             const variationSales = await response.json();
             salesReportLoading.style.display = 'none';

             if (!variationSales || variationSales.length === 0 || variationSales.every(v => v.total_sold === 0)) {
                 salesReportNoData.textContent = `商品「${productName}」尚無銷售記錄。`; salesReportNoData.style.display = 'block'; return;
             }
             salesReportChartCanvas.style.display = 'block';
             const labels = variationSales.map(item => item.variation_name || '未命名');
             const data = variationSales.map(item => item.total_sold);
             const backgroundColors = variationSales.map((_, i) => `hsl(${(i * 360 / variationSales.length) % 360}, 70%, 60%)`); // Use HSL for more distinct colors

             const ctx = salesReportChartCanvas.getContext('2d');
             salesReportChartInstance = new Chart(ctx, {
                 type: 'doughnut', // Changed to doughnut for better label display potentially
                 data: {
                     labels: labels,
                     datasets: [{ label: '銷售數量', data: data, backgroundColor: backgroundColors, borderColor: '#fff', borderWidth: 1 }]
                 },
                 options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, title: { display: false } } } // Legend on the right
             });
         } catch (error) { console.error(`繪製商品 ${productId} 規格銷售圖失敗:`, error); salesReportLoading.style.display = 'none'; salesReportError.textContent = `無法載入商品銷售圖: ${error.message}`; salesReportError.style.display = 'block'; }
    }

    // --- Event Listener for Product List ---
    if (productListBody) {
        productListBody.addEventListener('click', async (event) => {
            if (event.target.classList.contains('view-sales-btn')) {
                const button = event.target;
                const productId = button.dataset.productId;
                const productName = button.dataset.productName || '商品';
                if (productId) {
                    if (salesReportSection) { salesReportSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                    await displayProductVariationSalesChart(productId, productName);
                }
            }
            // Edit and Delete still use onclick attributes for simplicity here
        });
    }

    // --- Helper Functions and Global Scope Attachments ---
    window.closeModal = function() { if (editModal) { editModal.style.display = 'none'; } }
    window.closeAddModal = function() { if (addModal) { addModal.style.display = 'none'; } }
    window.editProduct = function(id) { openEditModal(id); }; // Expose edit function
    window.deleteProduct = async function(id) { // Expose delete function
         if (confirm(`確定要刪除商品 ID: ${id} 嗎？相關規格和銷售記錄也會被處理或可能 orphaned，請謹慎操作！`)) { // Added warning
             try {
                 // Note: Backend should ideally handle cascading deletes or restrict deletion if variations/logs exist.
                 // Simple deletion for now:
                 const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
                 if (response.status === 204 || response.ok) {
                    await fetchAndDisplayProducts(); // Refresh list
                    // Reset sales report if it was showing the deleted product
                    if (currentReportProductId === id.toString()) {
                        await displayOverallSalesChart();
                    }
                 } else { let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
             } catch (error) { alert(`刪除時發生錯誤：${error.message}`); }
         }
    };
    window.showAddForm = function() { // Expose add function
         const requiredAddElements = [addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addProductSevenElevenUrl, addFormError, addImagePreview];
         if (requiredAddElements.some(el => !el)) { alert("新增視窗元件錯誤"); return; }
         addFormError.textContent = ''; addForm.reset();
         addImagePreview.src = ''; addImagePreview.style.display = 'none';
         addModal.style.display = 'flex';
    };
    window.onclick = function(event) { if (event.target == editModal) { closeModal(); } else if (event.target == addModal) { closeAddModal(); } }

    // Add Product Form Submission (remains mostly the same, does not handle variations)
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault(); addFormError.textContent = '';
            let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value);
            const newProductData = { name: addProductName.value.trim(), description: addProductDescription.value.trim(), price: priceValue, image_url: addProductImageUrl.value.trim() || null, seven_eleven_url: addProductSevenElevenUrl.value.trim() || null };
            // Basic validation
            if (!newProductData.name) { addFormError.textContent = '商品名稱不能為空。'; return; }
            if (newProductData.price !== null && isNaN(newProductData.price)) { addFormError.textContent = '價格必須是有效的數字。'; return; }
            // ... more validation ...
            try {
                const response = await fetch(`/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProductData) });
                if (!response.ok) { /* ... error handling ... */ throw new Error(`新增失敗 (HTTP ${response.status})`); }
                closeAddModal();
                await fetchAndDisplayProducts(); // Refresh list
            } catch (error) { addFormError.textContent = `新增錯誤：${error.message}`; }
        });
    } else { console.error("新增表單元素 (#add-product-form) 未找到。"); }

    // --- Image Preview Setup ---
    function setupImagePreview(inputElement, previewElement) {
        if (inputElement && previewElement) {
            inputElement.addEventListener('input', () => {
                const url = inputElement.value.trim();
                previewElement.src = url; previewElement.style.display = url ? 'block' : 'none';
            });
            const initialUrl = inputElement.value.trim(); // Check on load
            if (initialUrl) { previewElement.src = initialUrl; previewElement.style.display = 'block'; }
             else { previewElement.style.display = 'none'; }
        }
    }
    setupImagePreview(editProductImageUrl, editImagePreview);
    setupImagePreview(addProductImageUrl, addImagePreview);

    // --- Traffic Chart Logic (using trafficChartInstance) ---
    async function displayTrafficChart(granularity = 'daily') {
        if (!trafficChartCanvas) { console.warn("找不到 traffic-chart canvas 元素。"); return; }
        const ctx = trafficChartCanvas.getContext('2d'); currentGranularity = granularity;
        if (chartLoadingMsg) chartLoadingMsg.style.display = 'block'; if (chartErrorMsg) chartErrorMsg.style.display = 'none';
        if (trafficChartInstance) { trafficChartInstance.destroy(); trafficChartInstance = null; } // Use correct variable
        trafficChartCanvas.style.display = 'none';
        let apiUrl = '/api/analytics/traffic'; if (granularity === 'monthly') { apiUrl = '/api/analytics/monthly-traffic'; }
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) { /* ... error handling ... */ }
            const trafficData = await response.json();
            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none'; trafficChartCanvas.style.display = 'block';
            if (trafficData.length === 0) { if (chartErrorMsg) { chartErrorMsg.textContent='...';} return; }
            const labels = trafficData.map(item => item.date || item.month); const dataPoints = trafficData.map(item => item.count);
            trafficChartInstance = new Chart(ctx, { // Use correct variable
                type: 'line', data: { labels: labels, datasets: [{ label: granularity === 'daily' ? '每日瀏覽量' : '每月瀏覽量', data: dataPoints, borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.1)', fill: true, tension: 0.2 }] },
                options: { /* ... options ... */ }
            });
        } catch (error) { console.error(`繪製 ${granularity} 流量圖表失敗:`, error); /* ... error handling ... */ }
    }
    // --- Traffic Chart Button Listeners ---
    if (btnDaily && btnMonthly) {
        const toggleButtons = [btnDaily, btnMonthly];
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const newGranularity = button.dataset.granularity;
                if (newGranularity !== currentGranularity) {
                    toggleButtons.forEach(btn => btn.classList.remove('active')); button.classList.add('active');
                    displayTrafficChart(newGranularity);
                }
            });
        });
    } else { console.warn("找不到圖表切換按鈕。"); }

    // --- Initial Page Load ---
    async function initializePage() {
        await fetchAndDisplayProducts();    // Load product list (includes total inventory)
        await displayTrafficChart('daily'); // Load traffic chart
        await displayOverallSalesChart();   // Load overall sales report chart
        console.log("Admin page initialized.");
    }

    initializePage();

}); // --- End of DOMContentLoaded ---