// public/admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
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
    const editVariationListDiv = document.getElementById('edit-variation-list');
    const recordSalesError = document.getElementById('record-sales-error');
    const recordSalesSuccess = document.getElementById('record-sales-success');

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

    // --- 銷售報告區塊元素 ---
    const salesReportSection = document.getElementById('sales-report-section');
    const salesReportTitle = document.getElementById('sales-report-title');
    const salesReportChartContainer = document.getElementById('sales-report-chart-container');
    const salesReportChartCanvas = document.getElementById('sales-report-chart');
    const salesReportLoading = document.getElementById('sales-report-loading');
    const salesReportError = document.getElementById('sales-report-error');
    const salesReportNoData = document.getElementById('sales-report-nodata');
    let salesReportChartInstance = null;
    let currentReportProductId = null;

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
        for (let i = 0; i < elements.length; i++) {
            if (!elements[i]) {
                // 嘗試從調用棧或已知 ID 列表推斷缺失元素的 ID (這比較困難且不準確)
                // 簡單起見，我們先記錄索引
                missingElementIds.push(`索引 ${i} (需要手動檢查對應的變數)`);
            }
        }

        if (missingElementIds.length > 0) {
             const errorMessage = `初始化錯誤：缺少必要的 DOM 元素。請檢查 HTML ID 是否正確。缺失的元素可能在以下索引位置: ${missingElementIds.join(', ')}`;
            console.error(errorMessage);
             // 在頁面頂部顯示錯誤訊息
             if(document.body) {
                 const errorDiv = document.createElement('div');
                 errorDiv.style.backgroundColor = 'red';
                 errorDiv.style.color = 'white';
                 errorDiv.style.padding = '10px';
                 errorDiv.style.textAlign = 'center';
                 errorDiv.style.fontWeight = 'bold';
                 errorDiv.textContent = `頁面載入錯誤：${errorMessage}，部分功能可能無法運作。`;
                 document.body.insertBefore(errorDiv, document.body.firstChild);
             }
            return false; // 表示有元素缺失
        }
        return true; // 所有元素都存在
    }
    // 執行核心元素檢查
    const coreElementsExist = checkElements(
        productListBody, productListContainer, productTable,
        editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError, editVariationListDiv, recordSalesError, recordSalesSuccess, // Edit Modal 核心
        addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addImagePreview, addProductSevenElevenUrl, addFormError, addVariationsContainer, // Add Modal 核心
        salesReportSection, salesReportTitle, salesReportChartCanvas, salesReportLoading, salesReportError, salesReportNoData, // 銷售報告區塊
        trafficChartCanvas, chartLoadingMsg, chartErrorMsg, btnDaily, btnMonthly // 流量圖表區塊
    );

    // 如果核心元素缺失，則停止後續 JS 執行，避免更多錯誤
    if (!coreElementsExist) {
        console.error("停止執行 admin.js，因為缺少核心頁面元件。");
        return; // 退出整個 DOMContentLoaded 回調
    }


    // --- 動態添加商品規格輸入列的函數 ---
    window.addVariationInputRow = function(modalPrefix) { // 掛載到 window
        const containerId = `${modalPrefix}-variations-container`;
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`找不到規格容器 #${containerId}`);
            alert(`錯誤：無法找到規格輸入區域 (ID: ${containerId})`);
            return;
        }

        const variationIndex = container.querySelectorAll('.variation-input-row').length;
        const div = document.createElement('div');
        div.classList.add('variation-input-row');
        div.style.display = 'flex'; div.style.gap = '10px'; div.style.marginBottom = '10px'; div.style.alignItems = 'center';

        // 生成輸入欄位的 HTML
        // 注意：name 屬性使用了陣列語法，方便後端接收
        div.innerHTML = `
            <input type="text" name="variations[${variationIndex}][name]" placeholder="規格名稱 (例: S)" style="flex: 2;" required>
            <input type="number" name="variations[${variationIndex}][inventory_count]" min="0" value="0" placeholder="庫存" style="flex: 1; text-align: center;" required>
            <input type="text" name="variations[${variationIndex}][sku]" placeholder="SKU (選填)" style="flex: 1;">
            <button type="button" class="action-btn delete-btn" onclick="this.closest('.variation-input-row').remove()" title="移除此規格" style="flex-shrink: 0; padding: 5px 8px; background-color:#dc3545; color:white; border-color:#dc3545;">移除</button>
            ${ modalPrefix === 'edit' ? `<input type="hidden" name="variations[${variationIndex}][id]" value="">` : '' }
        `;
        // 為新生成的輸入框應用基本樣式
        div.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
             input.style.padding = '8px';
             input.style.border = '1px solid #ccc';
             input.style.borderRadius = '3px';
             input.style.fontSize = '0.9em'; // 稍微縮小字體
        });

        container.appendChild(div);
    }

    // --- Function to Fetch and Display ALL Products in the Table ---
    async function fetchAndDisplayProducts() {
        // 檢查元素是否真的存在（雖然前面檢查過，雙重保險）
        if (!productListBody || !productListContainer || !productTable) {
            console.error("fetchAndDisplayProducts: Table elements missing!"); return;
        }
        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (productTable) productTable.style.display = 'none';

            const response = await fetch('/api/products'); // API 應包含 total_inventory
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
                const lowStock = (inventory !== 'N/A' && inventory <= 5);
                // 確保 td 數量和順序正確 (7個)
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td title="${product.name || ''}">${product.name || ''}</td>
                    <td style="text-align:right; padding-right: 10px;">${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
                    <td style="text-align:center;">${product.click_count !== null ? product.click_count : '0'}</td>
                    <td style="text-align:center; font-weight: ${lowStock ? 'bold' : 'normal'}; color: ${lowStock ? 'red' : 'inherit'};" title="總庫存">${inventory}</td>
                    <td style="text-align:center;"> <!-- 圖片預覽欄 -->
                        <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="max-width: 50px; max-height: 50px; height: auto; border: 1px solid #eee; display: inline-block; vertical-align: middle;">
                    </td>
                    <td style="text-align:center;"> <!-- 操作欄 -->
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
        // 再次檢查 Edit Modal 相關元素
        if (!checkElements(editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError, editVariationListDiv, recordSalesError, recordSalesSuccess)) return;

        editFormError.textContent = ''; editForm.reset(); editImagePreview.style.display = 'none'; editImagePreview.src = '';
        editVariationListDiv.innerHTML = '<p style="color: #888; text-align: center;">正在載入規格...</p>';
        recordSalesError.textContent = ''; recordSalesSuccess.textContent = '';

        try {
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

            renderVariationsForEditing(product.variations || []);

            // Attach event listener for record sales button *after* modal content is ready
            const recordSalesBtn = document.getElementById('record-sales-btn'); // Get button inside modal
            if (recordSalesBtn) {
                recordSalesBtn.replaceWith(recordSalesBtn.cloneNode(true));
                const newRecordSalesBtn = document.getElementById('record-sales-btn');
                newRecordSalesBtn.addEventListener('click', handleRecordSalesClick);
                newRecordSalesBtn.disabled = !(product.variations && product.variations.length > 0);
            } else {
                console.error("無法在 Modal 中找到 #record-sales-btn");
            }

            editModal.style.display = 'flex';
        } catch (error) { console.error(`獲取商品 ${id} 編輯資料出錯:`, error); alert(`無法載入編輯資料： ${error.message}`); }
    }

    // --- Render Variations in Edit Modal ---
    function renderVariationsForEditing(variations) {
        if (!editVariationListDiv) return;
        editVariationListDiv.innerHTML = '';

        if (!variations || variations.length === 0) {
            editVariationListDiv.innerHTML = '<p style="color: #888; text-align: center;">此商品尚未設定規格。請在資料庫中為此商品添加規格資料。</p>';
             // 按鈕禁用狀態在 openEditModal 中處理
            return;
        }

        variations.forEach(variation => {
            const itemDiv = document.createElement('div'); itemDiv.classList.add('variation-item'); itemDiv.dataset.variationId = variation.id;
            const nameSpan = document.createElement('span'); nameSpan.classList.add('variation-name'); nameSpan.textContent = variation.name || '未命名規格';
            const inventoryDisplaySpan = document.createElement('span'); inventoryDisplaySpan.classList.add('variation-inventory-display'); inventoryDisplaySpan.textContent = `庫存: ${variation.inventory_count !== undefined ? variation.inventory_count : 'N/A'}`;
            const inventoryInputDiv = document.createElement('div'); inventoryInputDiv.classList.add('variation-inventory-input'); const inventoryLabel = document.createElement('label'); inventoryLabel.htmlFor = `inventory-input-${variation.id}`; inventoryLabel.textContent = '更新庫存:'; const inventoryInput = document.createElement('input'); inventoryInput.type = 'number'; inventoryInput.id = `inventory-input-${variation.id}`; inventoryInput.min = '0'; inventoryInput.placeholder = '數量'; inventoryInput.dataset.variationId = variation.id; inventoryInput.value = variation.inventory_count !== undefined ? variation.inventory_count : ''; inventoryInputDiv.appendChild(inventoryLabel); inventoryInputDiv.appendChild(inventoryInput);
            const salesInputDiv = document.createElement('div'); salesInputDiv.classList.add('variation-sales-input'); const salesLabel = document.createElement('label'); salesLabel.htmlFor = `sales-input-${variation.id}`; salesLabel.textContent = '本次售出:'; const salesInput = document.createElement('input'); salesInput.type = 'number'; salesInput.id = `sales-input-${variation.id}`; salesInput.min = '0'; salesInput.placeholder = '數量'; salesInput.dataset.variationId = variation.id; salesInputDiv.appendChild(salesLabel); salesInputDiv.appendChild(salesInput);
            itemDiv.appendChild(nameSpan); itemDiv.appendChild(inventoryDisplaySpan); itemDiv.appendChild(inventoryInputDiv); itemDiv.appendChild(salesInputDiv);
            editVariationListDiv.appendChild(itemDiv);
        });
    }

    // --- Handle "Record Sales" Button Click ---
    async function handleRecordSalesClick() {
        const recordSalesBtn = document.getElementById('record-sales-btn');
        if (!editVariationListDiv || !recordSalesBtn || !recordSalesError || !recordSalesSuccess) { console.error("記錄銷售時缺少元素"); return; }
        recordSalesError.textContent = ''; recordSalesSuccess.textContent = '';
        const salesEntries = [];
        const salesInputs = editVariationListDiv.querySelectorAll('.variation-sales-input input');
        salesInputs.forEach(input => { const quantity = parseInt(input.value); const variationId = input.dataset.variationId; if (!isNaN(quantity) && quantity > 0 && variationId) { salesEntries.push({ variationId: variationId, quantity: quantity }); } });
        if (salesEntries.length === 0) { recordSalesError.textContent = '請至少輸入一個規格的售出數量。'; return; }
        recordSalesBtn.disabled = true; recordSalesBtn.textContent = '記錄中...';
        try {
            const response = await fetch('/api/admin/sales-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: salesEntries }) });
            if (!response.ok) { let errorMsg = `記錄銷售失敗 (HTTP ${response.status})`; try{ const data = await response.json(); errorMsg += `: ${data.error || '請重試'}`;} catch(e){} throw new Error(errorMsg); }
            const result = await response.json(); recordSalesSuccess.textContent = result.message || '銷售記錄成功！'; salesInputs.forEach(input => input.value = ''); setTimeout(() => { recordSalesSuccess.textContent = ''; }, 3000);
            const currentProductId = document.getElementById('edit-product-id').value; // Re-get ID
            if (currentReportProductId === currentProductId) { const currentProductName = document.getElementById('edit-product-name').value; await displayProductVariationSalesChart(currentProductId, currentProductName); } else { await displayOverallSalesChart(currentGranularity); }
            await fetchAndDisplayProducts();
        } catch (error) { console.error('記錄銷售時出錯:', error); recordSalesError.textContent = `記錄失敗: ${error.message || error}`; } finally { if(recordSalesBtn) { recordSalesBtn.disabled = false; recordSalesBtn.textContent = '記錄本次銷售'; } }
    }

    // --- Handle Edit Form Submission (Save Product + Inventory) ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if(!checkElements(editFormError, editProductId, editProductName, editProductPrice, editVariationListDiv)) return; // Check required elements for this function
            editFormError.textContent = '';
            const productId = editProductId.value;
            if (!productId) { editFormError.textContent = '錯誤：找不到商品 ID。'; return; }

            // 1. Collect basic product data
            let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value);
            const productData = { name: editProductName.value.trim(), description: editProductDescription.value.trim(), price: priceValue, image_url: editProductImageUrl.value.trim() || null, seven_eleven_url: editProductSevenElevenUrl.value.trim() || null };
            if (!productData.name) { editFormError.textContent = '商品名稱不能為空。'; return; }
            if (productData.price !== null && isNaN(productData.price)) { editFormError.textContent = '價格必須是數字。'; return; }

            // 2. Collect inventory data
            const inventoryUpdates = [];
            const inventoryInputs = editVariationListDiv.querySelectorAll('.variation-inventory-input input');
            let inventoryValidationError = false;
            inventoryInputs.forEach(input => {
                if(inventoryValidationError) return; const variationId = input.dataset.variationId; const inventoryCountStr = input.value.trim();
                if (variationId && inventoryCountStr !== '') {
                    const inventoryCount = parseInt(inventoryCountStr);
                    if (isNaN(inventoryCount) || inventoryCount < 0) { const nameElement = input.closest('.variation-item')?.querySelector('.variation-name'); const variationName = nameElement ? nameElement.textContent : `ID ${variationId}`; editFormError.textContent = `規格 "${variationName}" 的庫存數量必須是非負整數。`; inventoryValidationError = true; input.focus(); }
                    else { inventoryUpdates.push({ variationId: variationId, inventory_count: inventoryCount }); }
                }
                // Removed validation requiring input
            });
            if (inventoryValidationError) return;

            const saveButton = editForm.querySelector('.save-btn');
            if(saveButton) saveButton.disabled = true;

            try {
                // 3. Update basic product info
                const productResponse = await fetch(`/api/products/${productId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productData) });
                 if (!productResponse.ok) { let errorMsg = `商品資料儲存失敗 (HTTP ${productResponse.status})`; try{ const data = await productResponse.json(); errorMsg += `: ${data.error || ''}`;} catch(e){} throw new Error(errorMsg); }

                // 4. Update inventory counts
                if (inventoryUpdates.length > 0) {
                    console.log("準備更新庫存:", inventoryUpdates);
                    const inventoryPromises = inventoryUpdates.map(update => fetch(`/api/admin/variations/${update.variationId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inventory_count: update.inventory_count }) }).then(async res => { if (!res.ok) { console.error(`更新規格 ${update.variationId} 庫存失敗 (HTTP ${res.status})`); let detailError = `HTTP ${res.status}`; try { const errData = await res.json(); detailError = errData.error || detailError; } catch(e) {} throw new Error(`庫存更新失敗 (規格ID ${update.variationId}): ${detailError}`); } }));
                     await Promise.all(inventoryPromises);
                     console.log("所有請求的庫存更新已完成。");
                }

                // 5. Close modal and refresh list
                closeModal(); await fetchAndDisplayProducts();
            } catch (error) { console.error('儲存商品或庫存時出錯:', error); editFormError.textContent = `儲存錯誤：${error.message || '請檢查網絡或聯繫管理員'}`; } finally { if(saveButton) saveButton.disabled = false; }
        });
    } // else handled by initial check

    // --- Handle Add Form Submission ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
             event.preventDefault();
             if(!checkElements(addFormError, addProductName, addProductPrice, addVariationsContainer)) return; // Check required elements
             addFormError.textContent = '';

             // 1. Collect basic product data
             let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value);
             const newProductData = { name: addProductName.value.trim(), description: addProductDescription.value.trim(), price: priceValue, image_url: addProductImageUrl.value.trim() || null, seven_eleven_url: addProductSevenElevenUrl.value.trim() || null, variations: [] };
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

                 newProductData.variations.push({ name: name, inventory_count: inventoryCount, sku: sku || null });
             });
             if (variationValidationError) return;
             // Removed validation requiring at least one variation

             // 3. Send request
             const addButton = addForm.querySelector('.save-btn');
             if(addButton) addButton.disabled = true;
             try {
                 const response = await fetch(`/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProductData) });
                 if (!response.ok) { let errorMsg = `新增失敗 (HTTP ${response.status})`; try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){} throw new Error(errorMsg); }
                 closeAddModal(); await fetchAndDisplayProducts();
             } catch (error) { addFormError.textContent = `新增錯誤：${error.message}`; } finally { if(addButton) addButton.disabled = false; }
        });
    } // else handled by initial check

    // --- Display Overall Sales Chart ---
    async function displayOverallSalesChart(timeframe = 'daily') {
        if (!salesReportChartCanvas || !salesReportLoading || !salesReportError || !salesReportNoData || !salesReportTitle) return;
        currentReportProductId = null;
        salesReportTitle.textContent = timeframe === 'monthly' ? '整體月銷售趨勢' : '整體日銷售趨勢';
        salesReportLoading.style.display = 'block'; salesReportError.style.display = 'none'; salesReportNoData.style.display = 'none';
        if (salesReportChartInstance) { salesReportChartInstance.destroy(); salesReportChartInstance = null; }
        salesReportChartCanvas.style.display = 'none';
        try {
            const apiUrl = `/api/admin/analytics/overall-sales-trend?timeframe=${timeframe}`;
            const response = await fetch(apiUrl);
             if (!response.ok) { let errorMsg = `無法獲取趨勢數據 (HTTP ${response.status})`; try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){} throw new Error(errorMsg); }
            const salesData = await response.json();
            salesReportLoading.style.display = 'none';
            if (!salesData || salesData.length === 0) { salesReportNoData.style.display = 'block'; return; }
            salesReportChartCanvas.style.display = 'block';
            const labels = salesData.map(item => item.date_period); const data = salesData.map(item => item.total_quantity);
            const ctx = salesReportChartCanvas.getContext('2d');
            salesReportChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: '總銷售數量', data: data, borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgba(75, 192, 192, 0.2)', fill: true, tension: 0.1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks:{ stepSize: 1 } } }, plugins: { legend: { display: true }, title: { display: false } } } });
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
             if (!response.ok) { let errorMsg = `無法獲取規格銷售數據 (HTTP ${response.status})`; try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){} throw new Error(errorMsg); }
            const variationSales = await response.json();
            salesReportLoading.style.display = 'none';
            if (!variationSales || variationSales.length === 0 || variationSales.every(v => v.total_sold === 0)) { salesReportNoData.textContent = `商品「${productName}」尚無銷售記錄。`; salesReportNoData.style.display = 'block'; return; }
            salesReportChartCanvas.style.display = 'block';
            const labels = variationSales.map(item => item.variation_name || '未命名'); const data = variationSales.map(item => item.total_sold);
            const backgroundColors = variationSales.map((_, i) => `hsl(${(i * 360 / (variationSales.length || 1)) % 360}, 70%, 60%)`);
            const ctx = salesReportChartCanvas.getContext('2d');
            salesReportChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ label: '銷售數量', data: data, backgroundColor: backgroundColors, borderColor: '#fff', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, title: { display: false } } } });
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
    } // else handled by initial check

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
                    // Use === for strict comparison, ensure types match (string vs number)
                    if (currentReportProductId && currentReportProductId.toString() === id.toString()) {
                        await displayOverallSalesChart();
                    }
                 } else { let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const data = await response.json(); errorMsg = data.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
             } catch (error) { alert(`刪除時發生錯誤：${error.message}`); }
        }
    };
    window.showAddForm = function() {
        const requiredAddElements = [addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addProductSevenElevenUrl, addFormError, addImagePreview, addVariationsContainer];
        if (requiredAddElements.some(el => !el)) { alert("新增視窗元件錯誤"); return; }
        addFormError.textContent = ''; addForm.reset();
        addImagePreview.src = ''; addImagePreview.style.display = 'none';
        if (addVariationsContainer) addVariationsContainer.innerHTML = ''; // Clear variations on open
        // addVariationInputRow('add'); // Optional: Add one empty row by default
        addModal.style.display = 'flex';
    };
    // Close modal on outside click
    window.onclick = function(event) {
        if (event.target == editModal) { closeModal(); }
        else if (event.target == addModal) { closeAddModal(); }
    }

    // --- Image Preview Setup ---
    function setupImagePreview(inputElement, previewElement) {
        if (inputElement && previewElement) {
            inputElement.addEventListener('input', () => { const url = inputElement.value.trim(); previewElement.src = url; previewElement.style.display = url ? 'block' : 'none'; });
            const initialUrl = inputElement.value.trim();
            if (initialUrl) { previewElement.src = initialUrl; previewElement.style.display = 'block'; }
             else { previewElement.style.display = 'none'; }
        }
    }
    setupImagePreview(editProductImageUrl, editImagePreview);
    setupImagePreview(addProductImageUrl, addImagePreview);

    // --- Traffic Chart Logic ---
    async function displayTrafficChart(granularity = 'daily') {
        if (!trafficChartCanvas || !chartLoadingMsg || !chartErrorMsg) return;
        const ctx = trafficChartCanvas.getContext('2d'); currentGranularity = granularity;
        chartLoadingMsg.style.display = 'block'; chartErrorMsg.style.display = 'none';
        if (trafficChartInstance) { trafficChartInstance.destroy(); trafficChartInstance = null; }
        trafficChartCanvas.style.display = 'none';
        let apiUrl = '/api/analytics/traffic'; if (granularity === 'monthly') { apiUrl = '/api/analytics/monthly-traffic'; }
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) { /* ... */ throw new Error(`HTTP ${response.status}`); }
            const trafficData = await response.json();
            chartLoadingMsg.style.display = 'none'; trafficChartCanvas.style.display = 'block';
            if (trafficData.length === 0) { chartErrorMsg.textContent='（尚無流量數據）'; chartErrorMsg.style.display='block'; chartErrorMsg.style.color='#888'; return; }
            const labels = trafficData.map(item => item.date || item.month); const dataPoints = trafficData.map(item => item.count);
            trafficChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: granularity === 'daily' ? '每日瀏覽量' : '每月瀏覽量', data: dataPoints, borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.1)', fill: true, tension: 0.2 }] }, options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true }, title: { display: false } } } });
        } catch (error) { console.error(`繪製 ${granularity} 流量圖表失敗:`, error); chartLoadingMsg.style.display = 'none'; chartErrorMsg.textContent=`無法載入流量圖: ${error.message}`; chartErrorMsg.style.display='block'; }
    }
    // --- Traffic Chart Button Listeners ---
    if (btnDaily && btnMonthly) {
        const toggleButtons = [btnDaily, btnMonthly];
        toggleButtons.forEach(button => { button.addEventListener('click', () => { const newGranularity = button.dataset.granularity; if (newGranularity !== currentGranularity) { toggleButtons.forEach(btn => btn.classList.remove('active')); button.classList.add('active'); displayTrafficChart(newGranularity); } }); });
    } else { console.warn("找不到流量圖表切換按鈕。"); }

    // --- Initial Page Load ---
    async function initializePage() {
        if (!coreElementsExist) return; // Stop if core elements are missing
        try {
            await fetchAndDisplayProducts();
            await displayTrafficChart('daily');
            await displayOverallSalesChart();
            console.log("Admin page initialized.");
        } catch (error) { console.error("頁面初始化過程中發生錯誤:", error); }
    }

    initializePage();

}); // --- End of DOMContentLoaded ---