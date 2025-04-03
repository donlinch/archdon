// public/admin.js (v5 - FINAL - Full code, no omissions)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const productListBody = document.querySelector('#product-list-table tbody');
    const productListContainer = document.getElementById('product-list-container');
    const productTable = document.getElementById('product-list-table');
    const loadingMessage = productListContainer ? productListContainer.querySelector('p') : null;

    // --- Edit Modal Elements ---
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
    const editVariationListDiv = document.getElementById('edit-variation-list');
    const recordSalesError = document.getElementById('record-sales-error');
    const recordSalesSuccess = document.getElementById('record-sales-success');

    // --- Add Modal Elements ---
    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-product-form');
    const addProductName = document.getElementById('add-product-name');
    const addProductDescription = document.getElementById('add-product-description');
    const addProductPrice = document.getElementById('add-product-price');
    const addProductImageUrl = document.getElementById('add-product-image-url');
    const addImagePreview = document.getElementById('add-image-preview');
    const addProductSevenElevenUrl = document.getElementById('add-product-seven-eleven-url');
    const addFormError = document.getElementById('add-form-error');
    const addVariationsContainer = document.getElementById('add-variations-container');

    // --- Sales Report Elements ---
    const salesReportSection = document.getElementById('sales-report-section');
    const salesReportTitle = document.getElementById('sales-report-title');
    const salesReportChartContainer = document.getElementById('sales-report-chart-container');
    const salesReportChartCanvas = document.getElementById('sales-report-chart');
    const salesReportLoading = document.getElementById('sales-report-loading');
    const salesReportError = document.getElementById('sales-report-error');
    const salesReportNoData = document.getElementById('sales-report-nodata');
    let salesReportChartInstance = null;
    let currentReportProductId = null;

    // --- Traffic Chart Elements ---
    const trafficChartCanvas = document.getElementById('traffic-chart');
    const chartLoadingMsg = document.getElementById('chart-loading-msg');
    const chartErrorMsg = document.getElementById('chart-error-msg');
    const btnDaily = document.getElementById('btn-daily');
    const btnMonthly = document.getElementById('btn-monthly');
    let trafficChartInstance = null;
    let currentGranularity = 'daily';

    // --- 檢查必要元素是否存在 ---
    function checkElements(...elements) {
        const missingElementIds = []; let allExist = true;
        for (let i = 0; i < elements.length; i++) {
            if (!elements[i]) {
                const potentialId = `Element at index ${i} (check variable assignment)`;
                missingElementIds.push(potentialId); allExist = false;
            }
        }
        if (!allExist) {
             const errorMessage = `Initialization Error: Missing required DOM elements. Check HTML IDs. Missing elements might be related to: ${missingElementIds.join(', ')}`;
             console.error(errorMessage);
             if(document.body) {
                 const errorDiv = document.createElement('div'); errorDiv.style.backgroundColor = 'red'; errorDiv.style.color = 'white'; errorDiv.style.padding = '10px'; errorDiv.style.textAlign = 'center'; errorDiv.style.fontWeight = 'bold'; errorDiv.style.position = 'fixed'; errorDiv.style.top = '0'; errorDiv.style.left = '0'; errorDiv.style.right = '0'; errorDiv.style.zIndex = '2000'; errorDiv.textContent = `Page Load Error: ${errorMessage}. Some functionalities might be broken.`; document.body.insertBefore(errorDiv, document.body.firstChild);
             }
        }
        return allExist;
    }
    const coreElementsExist = checkElements(
        productListBody, productListContainer, productTable, // List
        editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError, editVariationListDiv, recordSalesError, recordSalesSuccess, // Edit Modal
        addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addImagePreview, addProductSevenElevenUrl, addFormError, addVariationsContainer, // Add Modal
        salesReportSection, salesReportTitle, salesReportChartCanvas, salesReportLoading, salesReportError, salesReportNoData, // Sales Report
        trafficChartCanvas, chartLoadingMsg, chartErrorMsg, btnDaily, btnMonthly // Traffic Chart
    );
    if (!coreElementsExist) { console.error("Stopping admin.js execution due to missing core elements."); return; }

    // --- 動態添加商品規格輸入列的函數 ---
    window.addVariationInputRow = function(modalPrefix) {
        const containerId = modalPrefix === 'add' ? 'add-variations-container' : 'edit-variation-list';
        const container = document.getElementById(containerId);
        if (!container) { console.error(`Cannot find variation container #${containerId}`); alert(`Error: Cannot find variation input area (ID: ${containerId})`); return; }

        const variationIndex = container.querySelectorAll('.variation-input-row, .variation-item').length;
        const div = document.createElement('div');
        div.classList.add('variation-input-row'); // Use this class for newly added rows in both modals
        div.style.display = 'flex'; div.style.gap = '10px'; div.style.marginBottom = '10px'; div.style.alignItems = 'center';

        div.innerHTML = `
            ${ modalPrefix === 'edit' ? `<input type="hidden" name="variations[${variationIndex}][id]" value="">` : '' }
            <input type="text" name="variations[${variationIndex}][name]" placeholder="規格名稱 (例: XL)" style="flex: 2;" required>
            <input type="number" name="variations[${variationIndex}][inventory_count]" min="0" value="0" placeholder="庫存" style="flex: 1; text-align: center;" required>
            <input type="text" name="variations[${variationIndex}][sku]" placeholder="SKU (選填)" style="flex: 1;">
            <button type="button" class="action-btn delete-btn" onclick="this.closest('.variation-input-row').remove()" title="移除此新規格" style="flex-shrink: 0; padding: 5px 8px;">移除</button>
        `;
        div.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
             input.style.padding = '8px'; input.style.border = '1px solid #ccc'; input.style.borderRadius = '3px'; input.style.fontSize = '0.9em';
        });
        container.appendChild(div);
    };

    // --- Function to Fetch and Display ALL Products in the Table ---
    async function fetchAndDisplayProducts() {
        if (!productListBody || !productListContainer || !productTable) return;
        try {
            if (loadingMessage) loadingMessage.style.display = 'block'; if (productTable) productTable.style.display = 'none';
            const response = await fetch('/api/products'); if (!response.ok) { throw new Error(`HTTP Error! status: ${response.status}`); } const products = await response.json();
            if (loadingMessage) loadingMessage.style.display = 'none'; if (productTable) productTable.style.display = 'table'; productListBody.innerHTML = '';
            if (products.length === 0) { productListBody.innerHTML = '<tr><td colspan="7">目前沒有商品。</td></tr>'; return; }
            products.forEach(product => {
                const row = document.createElement('tr'); row.dataset.productId = product.id; const inventory = product.total_inventory !== undefined ? product.total_inventory : 'N/A'; const lowStock = (inventory !== 'N/A' && inventory <= 5);
                row.innerHTML = ` <td>${product.id}</td> <td title="${product.name || ''}">${product.name || ''}</td> <td style="text-align:right; padding-right: 10px;">${product.price !== null ? Math.floor(product.price) : 'N/A'}</td> <td style="text-align:center;">${product.click_count !== null ? product.click_count : '0'}</td> <td style="text-align:center;"><img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="max-width: 50px; max-height: 50px; height: auto; border: 1px solid #eee; display: inline-block; vertical-align: middle;"></td> <td style="text-align:center; font-weight: ${lowStock ? 'bold' : 'normal'}; color: ${lowStock ? 'red' : 'inherit'};" title="總庫存">${inventory}</td> <td style="text-align:center;"><button class="action-btn edit-btn" onclick="window.editProduct(${product.id})">編輯</button> <button class="action-btn delete-btn" onclick="window.deleteProduct(${product.id})">刪除</button> <button class="action-btn view-sales-btn" data-product-id="${product.id}" data-product-name="${product.name || '商品'}">查看銷售</button></td> `;
                productListBody.appendChild(row);
            });
        } catch (error) { console.error("獲取管理商品列表失敗:", error); if (loadingMessage) loadingMessage.textContent = '無法載入商品列表。'; if (productTable) productTable.style.display = 'none'; }
    }

    // --- Function to Open and Populate the Edit Modal ---
    async function openEditModal(id) {
        if (!checkElements(editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError, editVariationListDiv, recordSalesError, recordSalesSuccess)) return;
        editFormError.textContent = ''; editForm.reset(); editImagePreview.style.display = 'none'; editImagePreview.src = ''; editVariationListDiv.innerHTML = '<p style="color: #888; text-align: center;">正在載入規格...</p>'; recordSalesError.textContent = ''; recordSalesSuccess.textContent = '';
        try {
            const response = await fetch(`/api/products/${id}`);
            if (!response.ok) { let errorMsg = `無法獲取商品資料 (HTTP ${response.status})`; if (response.status === 404) errorMsg = '找不到該商品。'; else { try { const data = await response.json(); errorMsg += `: ${data.error || ''}`; } catch(e){} } throw new Error(errorMsg); }
            const product = await response.json();
            editProductId.value = product.id; editProductName.value = product.name || ''; editProductDescription.value = product.description || ''; editProductPrice.value = product.price !== null ? product.price : ''; editProductImageUrl.value = product.image_url || ''; editProductSevenElevenUrl.value = product.seven_eleven_url || ''; editProductClickCount.textContent = product.click_count !== null ? product.click_count : '0';
            if (product.image_url) { editImagePreview.src = product.image_url; editImagePreview.style.display = 'block'; } else { editImagePreview.style.display = 'none'; }
            renderVariationsForEditing(product.variations || []);
            const recordSalesBtn = document.getElementById('record-sales-btn');
            if (recordSalesBtn) { recordSalesBtn.replaceWith(recordSalesBtn.cloneNode(true)); const newRecordSalesBtn = document.getElementById('record-sales-btn'); newRecordSalesBtn.addEventListener('click', handleRecordSalesClick); newRecordSalesBtn.disabled = !(product.variations && product.variations.length > 0); } else { console.error("無法在 Modal 中找到 #record-sales-btn"); }
            editModal.style.display = 'flex';
        } catch (error) { console.error(`獲取商品 ${id} 編輯資料出錯:`, error); alert(`無法載入編輯資料： ${error.message}`); }
    }

    // --- Render EXISTING Variations in Edit Modal ---
    function renderVariationsForEditing(variations) {
        if (!editVariationListDiv) return; editVariationListDiv.innerHTML = '';
        if (!variations || variations.length === 0) { editVariationListDiv.innerHTML = '<p style="color: #888; text-align: center;">此商品尚未設定規格。點擊下方按鈕新增。</p>'; return; }
        variations.forEach((variation, index) => {
            const itemDiv = document.createElement('div'); itemDiv.classList.add('variation-item'); itemDiv.dataset.variationId = variation.id;
            itemDiv.innerHTML = ` <input type="hidden" name="variations[${index}][id]" value="${variation.id || ''}"> <span class="variation-name">${variation.name || '未命名'}</span> <span class="variation-inventory-display">庫存: ${variation.inventory_count !== undefined ? variation.inventory_count : 'N/A'}</span> <div class="variation-inventory-input"> <label for="inventory-input-${variation.id}">更新庫存:</label> <input type="number" id="inventory-input-${variation.id}" name="variations[${index}][inventory_count]" min="0" placeholder="數量" value="${variation.inventory_count !== undefined ? variation.inventory_count : ''}" data-variation-id="${variation.id}"> </div> <div class="variation-sales-input"> <label for="sales-input-${variation.id}">本次售出:</label> <input type="number" id="sales-input-${variation.id}" name="variations[${index}][quantity_sold]" min="0" placeholder="數量" data-variation-id="${variation.id}"> </div> <button type="button" class="action-btn delete-btn" onclick="if(confirm('確定移除此規格？儲存後生效。')) { this.closest('.variation-item').remove(); }" title="標記移除此規格" style="flex-shrink: 0; padding: 5px 8px;">移除</button> `;
            itemDiv.querySelectorAll('input[type="number"]').forEach(input => { input.style.padding = '5px'; input.style.border = '1px solid #ccc'; input.style.borderRadius = '3px'; input.style.textAlign = 'center'; input.style.width = '70px'; });
            editVariationListDiv.appendChild(itemDiv);
        });
    }

    // --- Handle "Record Sales" Button Click ---
    async function handleRecordSalesClick() {
        const recordSalesBtn = document.getElementById('record-sales-btn'); if (!editVariationListDiv || !recordSalesBtn || !recordSalesError || !recordSalesSuccess) { console.error("記錄銷售時缺少元素"); return; } recordSalesError.textContent = ''; recordSalesSuccess.textContent = ''; const salesEntries = [];
        const salesInputs = editVariationListDiv.querySelectorAll('.variation-item .variation-sales-input input');
        salesInputs.forEach(input => { const quantity = parseInt(input.value); const variationId = input.dataset.variationId; if (!isNaN(quantity) && quantity > 0 && variationId) { salesEntries.push({ variationId: variationId, quantity: quantity }); } });
        if (salesEntries.length === 0) { recordSalesError.textContent = '請至少輸入一個**現有**規格的售出數量。'; return; }
        recordSalesBtn.disabled = true; recordSalesBtn.textContent = '記錄中...';
        try {
            const response = await fetch('/api/admin/sales-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: salesEntries }) });
            if (!response.ok) { let errorMsg = `記錄銷售失敗 (HTTP ${response.status})`; try{ const data = await response.json(); errorMsg += `: ${data.error || '請重試'}`;} catch(e){} throw new Error(errorMsg); } const result = await response.json(); recordSalesSuccess.textContent = result.message || '銷售記錄成功！'; salesInputs.forEach(input => input.value = ''); setTimeout(() => { recordSalesSuccess.textContent = ''; }, 3000);
            const currentProductId = document.getElementById('edit-product-id').value; if (currentReportProductId === currentProductId) { const currentProductName = document.getElementById('edit-product-name').value; await displayProductVariationSalesChart(currentProductId, currentProductName); } else { await displayOverallSalesChart(currentGranularity); }
            await fetchAndDisplayProducts();
        } catch (error) { console.error('記錄銷售時出錯:', error); recordSalesError.textContent = `記錄失敗: ${error.message || error}`; } finally { if(recordSalesBtn) { recordSalesBtn.disabled = false; recordSalesBtn.textContent = '記錄本次銷售'; } }
    }

    // --- Handle Edit Form Submission (Save Product + Variations/Inventory) ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault(); if(!checkElements(editFormError, editProductId, editProductName, editProductPrice, editVariationListDiv)) return; editFormError.textContent = ''; const productId = editProductId.value; if (!productId) { editFormError.textContent = '錯誤：找不到商品 ID。'; return; }
            let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value); const productData = { name: editProductName.value.trim(), description: editProductDescription.value.trim(), price: priceValue, image_url: editProductImageUrl.value.trim() || null, seven_eleven_url: editProductSevenElevenUrl.value.trim() || null };
            if (!productData.name) { editFormError.textContent = '商品名稱不能為空。'; return; } if (productData.price !== null && isNaN(productData.price)) { editFormError.textContent = '價格必須是數字。'; return; }
            const variationsData = []; const variationItems = editVariationListDiv.querySelectorAll('.variation-item, .variation-input-row'); let validationError = false;
            variationItems.forEach((item, index) => {
                 if(validationError) return;
                 const idInput = item.querySelector(`input[name="variations[${index}][id]"]`) || item.querySelector('input[type=hidden]');
                 const nameInput = item.querySelector(`input[name="variations[${index}][name]"]`) || item.querySelector('.variation-name');
                 const inventoryInput = item.querySelector(`input[name="variations[${index}][inventory_count]"]`) || item.querySelector(`#inventory-input-${item.dataset.variationId}`);
                 const skuInput = item.querySelector(`input[name="variations[${index}][sku]"]`);
                 const variationId = idInput ? idInput.value : undefined; const name = nameInput ? (nameInput.value || nameInput.textContent).trim() : ''; const inventoryStr = inventoryInput ? inventoryInput.value.trim() : ''; const sku = skuInput ? skuInput.value.trim() : null;
                 if (!name) { editFormError.textContent = `第 ${index + 1} 行規格名稱不能為空。`; validationError = true; if(nameInput) nameInput.focus(); return; }
                 if (inventoryStr === '') { editFormError.textContent = `第 ${index + 1} 行規格「${name}」庫存不能為空。`; validationError = true; if(inventoryInput) inventoryInput.focus(); return; }
                 const inventoryCount = parseInt(inventoryStr); if (isNaN(inventoryCount) || inventoryCount < 0) { editFormError.textContent = `第 ${index + 1} 行規格「${name}」庫存必須是非負整數。`; validationError = true; if(inventoryInput) inventoryInput.focus(); return; }
                 variationsData.push({ id: variationId, name: name, inventory_count: inventoryCount, sku: sku || null });
            });
            if (validationError) return;
            const saveButton = editForm.querySelector('.save-btn'); if(saveButton) saveButton.disabled = true;
            try {
                 const response = await fetch(`/api/products/${productId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...productData, variations: variationsData }) });
                 if (!response.ok) { let errorMsg = `儲存失敗 (HTTP ${response.status})`; try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){} throw new Error(errorMsg); }
                 closeModal(); await fetchAndDisplayProducts();
            } catch (error) { console.error('儲存商品或庫存時出錯:', error); editFormError.textContent = `儲存錯誤：${error.message || '請檢查網絡或聯繫管理員'}`; } finally { if(saveButton) saveButton.disabled = false; }
        });
    }

    // --- Handle Add Form Submission (With Variations) ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault(); if(!checkElements(addFormError, addProductName, addProductPrice, addVariationsContainer)) return; addFormError.textContent = '';
            let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value); const newProductData = { name: addProductName.value.trim(), description: addProductDescription.value.trim(), price: priceValue, image_url: addProductImageUrl.value.trim() || null, seven_eleven_url: addProductSevenElevenUrl.value.trim() || null, variations: [] };
            if (!newProductData.name) { addFormError.textContent = '商品名稱不能為空。'; return; } if (newProductData.price === null || isNaN(newProductData.price) || newProductData.price < 0) { addFormError.textContent = '請輸入有效的商品價格。'; return; }
            let variationValidationError = false; const variationRows = addVariationsContainer.querySelectorAll('.variation-input-row');
            variationRows.forEach((row, index) => {
                if (variationValidationError) return; const nameInput = row.querySelector(/*...*/); const inventoryInput = row.querySelector(/*...*/); const skuInput = row.querySelector(/*...*/); const name = nameInput ? nameInput.value.trim() : ''; const inventoryStr = inventoryInput ? inventoryInput.value.trim() : ''; const sku = skuInput ? skuInput.value.trim() : null;
                if (!name) { addFormError.textContent = `第 ${index + 1} 個規格的名稱不能為空。`; variationValidationError = true; if (nameInput) nameInput.focus(); return; }
                if (inventoryStr === '') { addFormError.textContent = `第 ${index + 1} 個規格「${name}」的庫存不能為空。`; variationValidationError = true; if (inventoryInput) inventoryInput.focus(); return; }
                const inventoryCount = parseInt(inventoryStr); if (isNaN(inventoryCount) || inventoryCount < 0) { addFormError.textContent = `第 ${index + 1} 個規格「${name}」的庫存必須是非負整數。`; variationValidationError = true; if (inventoryInput) inventoryInput.focus(); return; }
                newProductData.variations.push({ name: name, inventory_count: inventoryCount, sku: sku || null });
            });
            if (variationValidationError) return;
            const addButton = addForm.querySelector('.save-btn'); if(addButton) addButton.disabled = true;
            try {
                const response = await fetch(`/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProductData) });
                if (!response.ok) { let errorMsg = `新增失敗 (HTTP ${response.status})`; try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){} throw new Error(errorMsg); }
                closeAddModal(); await fetchAndDisplayProducts();
            } catch (error) { addFormError.textContent = `新增錯誤：${error.message}`; } finally { if(addButton) addButton.disabled = false; }
        });
    }

    // --- Display Overall Sales Chart ---
    async function displayOverallSalesChart(timeframe = 'daily') {
        if (!salesReportChartCanvas || !salesReportLoading || !salesReportError || !salesReportNoData || !salesReportTitle) return; currentReportProductId = null; salesReportTitle.textContent = timeframe === 'monthly' ? '整體月銷售趨勢' : '整體日銷售趨勢'; salesReportLoading.style.display = 'block'; salesReportError.style.display = 'none'; salesReportNoData.style.display = 'none'; if (salesReportChartInstance) { salesReportChartInstance.destroy(); salesReportChartInstance = null; } salesReportChartCanvas.style.display = 'none';
        try {
            const apiUrl = `/api/admin/analytics/overall-sales-trend?timeframe=${timeframe}`; const response = await fetch(apiUrl); if (!response.ok) { let errorMsg = `無法獲取趨勢數據 (HTTP ${response.status})`; try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){} throw new Error(errorMsg); } const salesData = await response.json(); salesReportLoading.style.display = 'none'; if (!salesData || salesData.length === 0) { salesReportNoData.style.display = 'block'; return; } salesReportChartCanvas.style.display = 'block'; const labels = salesData.map(item => item.date_period); const data = salesData.map(item => item.total_quantity); const ctx = salesReportChartCanvas.getContext('2d'); salesReportChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: '總銷售數量', data: data, borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgba(75, 192, 192, 0.2)', fill: true, tension: 0.1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks:{ stepSize: 1 } } }, plugins: { legend: { display: true }, title: { display: false } } } });
        } catch (error) { console.error('繪製整體銷售趨勢圖失敗:', error); salesReportLoading.style.display = 'none'; salesReportError.textContent = `無法載入趨勢圖: ${error.message}`; salesReportError.style.display = 'block'; }
    }

    // --- Display Product Variation Sales Chart ---
    async function displayProductVariationSalesChart(productId, productName) {
        if (!salesReportChartCanvas || !salesReportLoading || !salesReportError || !salesReportNoData || !salesReportTitle) return; currentReportProductId = productId; salesReportTitle.textContent = `商品「${productName}」各規格銷售統計`; salesReportLoading.style.display = 'block'; salesReportError.style.display = 'none'; salesReportNoData.style.display = 'none'; if (salesReportChartInstance) { salesReportChartInstance.destroy(); salesReportChartInstance = null; } salesReportChartCanvas.style.display = 'none';
        try {
            const apiUrl = `/api/admin/products/${productId}/variation-sales-summary`; const response = await fetch(apiUrl); if (!response.ok) { let errorMsg = `無法獲取規格銷售數據 (HTTP ${response.status})`; try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){} throw new Error(errorMsg); } const variationSales = await response.json(); salesReportLoading.style.display = 'none'; if (!variationSales || variationSales.length === 0 || variationSales.every(v => v.total_sold === 0)) { salesReportNoData.textContent = `商品「${productName}」尚無銷售記錄。`; salesReportNoData.style.display = 'block'; return; } salesReportChartCanvas.style.display = 'block'; const labels = variationSales.map(item => item.variation_name || '未命名'); const data = variationSales.map(item => item.total_sold); const backgroundColors = variationSales.map((_, i) => `hsl(${(i * 360 / (variationSales.length || 1)) % 360}, 70%, 60%)`); const ctx = salesReportChartCanvas.getContext('2d'); salesReportChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ label: '銷售數量', data: data, backgroundColor: backgroundColors, borderColor: '#fff', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, title: { display: false } } } });
        } catch (error) { console.error(`繪製商品 ${productId} 規格銷售圖失敗:`, error); salesReportLoading.style.display = 'none'; salesReportError.textContent = `無法載入商品銷售圖: ${error.message}`; salesReportError.style.display = 'block'; }
    }

    // --- Event Listener for Product List (View Sales Button) ---
    if (productListBody) {
        productListBody.addEventListener('click', async (event) => {
            if (event.target.classList.contains('view-sales-btn')) {
                const button = event.target; const productId = button.dataset.productId; const productName = button.dataset.productName || '商品';
                if (productId) { if (salesReportSection) { salesReportSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); } await displayProductVariationSalesChart(productId, productName); }
            }
        });
    }

    // --- Helper Functions and Global Scope Attachments ---
    window.closeModal = function() { if (editModal) { editModal.style.display = 'none'; } }
    window.closeAddModal = function() { if (addModal) { addModal.style.display = 'none'; } }
    window.editProduct = function(id) { openEditModal(id); };
    window.deleteProduct = async function(id) {
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？相關規格和銷售記錄將無法恢復！`)) {
            try {
                const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
                 if (response.status === 204 || response.ok) {
                    await fetchAndDisplayProducts();
                    if (currentReportProductId && currentReportProductId.toString() === id.toString()) { await displayOverallSalesChart(); }
                 } else { let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const data = await response.json(); errorMsg = data.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
             } catch (error) { alert(`刪除時發生錯誤：${error.message}`); }
        }
    };
    window.showAddForm = function() {
        if(!checkElements(addModal, addForm, addVariationsContainer)) return;
        addFormError.textContent = ''; addForm.reset(); addImagePreview.src = ''; addImagePreview.style.display = 'none';
        if (addVariationsContainer) addVariationsContainer.innerHTML = '';
        addModal.style.display = 'flex';
    };
    window.onclick = function(event) { if (event.target == editModal) { closeModal(); } else if (event.target == addModal) { closeAddModal(); } }

    // --- Image Preview Setup ---
    function setupImagePreview(inputElement, previewElement) {
        if (inputElement && previewElement) { inputElement.addEventListener('input', () => { const url = inputElement.value.trim(); previewElement.src = url; previewElement.style.display = url ? 'block' : 'none'; }); const initialUrl = inputElement.value.trim(); if (initialUrl) { previewElement.src = initialUrl; previewElement.style.display = 'block'; } else { previewElement.style.display = 'none'; } }
    }
    setupImagePreview(editProductImageUrl, editImagePreview);
    setupImagePreview(addProductImageUrl, addImagePreview);

    // --- Traffic Chart Logic ---
    async function displayTrafficChart(granularity = 'daily') {
        if (!trafficChartCanvas || !chartLoadingMsg || !chartErrorMsg) return; const ctx = trafficChartCanvas.getContext('2d'); currentGranularity = granularity; chartLoadingMsg.style.display = 'block'; chartErrorMsg.style.display = 'none'; if (trafficChartInstance) { trafficChartInstance.destroy(); trafficChartInstance = null; } trafficChartCanvas.style.display = 'none'; let apiUrl = '/api/analytics/traffic'; if (granularity === 'monthly') { apiUrl = '/api/analytics/monthly-traffic'; }
        try {
            const response = await fetch(apiUrl); if (!response.ok) { let errorMsg = `無法獲取流量數據 (HTTP ${response.status})`; try { const data = await response.json(); errorMsg = data.error || errorMsg; } catch(e){} throw new Error(errorMsg); } const trafficData = await response.json(); chartLoadingMsg.style.display = 'none'; trafficChartCanvas.style.display = 'block'; if (trafficData.length === 0) { if (chartErrorMsg) { chartErrorMsg.textContent='（尚無流量數據）'; chartErrorMsg.style.display='block'; chartErrorMsg.style.color='#888';} return; } const labels = trafficData.map(item => item.date || item.month); const dataPoints = trafficData.map(item => item.count); trafficChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: granularity === 'daily' ? '每日瀏覽量' : '每月瀏覽量', data: dataPoints, borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.1)', fill: true, tension: 0.2 }] }, options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true }, title: { display: false } } } });
        } catch (error) { console.error(`繪製 ${granularity} 流量圖表失敗:`, error); chartLoadingMsg.style.display = 'none'; chartErrorMsg.textContent=`無法載入流量圖: ${error.message}`; chartErrorMsg.style.display='block'; }
    }
    // --- Traffic Chart Button Listeners ---
    if (btnDaily && btnMonthly) { const toggleButtons = [btnDaily, btnMonthly]; toggleButtons.forEach(button => { button.addEventListener('click', () => { const newGranularity = button.dataset.granularity; if (newGranularity !== currentGranularity) { toggleButtons.forEach(btn => btn.classList.remove('active')); button.classList.add('active'); displayTrafficChart(newGranularity); } }); }); }

    // --- Initial Page Load ---
    async function initializePage() {
        if (!coreElementsExist) return;
        try {
            await fetchAndDisplayProducts();
            await displayTrafficChart('daily');
            await displayOverallSalesChart(); // Load overall sales chart on init
            console.log("Admin page initialized (v5 - Full Features).");
        } catch (error) { console.error("頁面初始化過程中發生錯誤:", error); }
    }

    initializePage();

}); // --- End of DOMContentLoaded ---