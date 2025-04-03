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
    // recordSalesBtn 在 openEditModal 中獲取
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

    // --- 檢查必要元素是否存在 ---
    function checkElements(...elements) {
        for (const el of elements) {
            if (!el) {
                console.error("初始化錯誤：缺少必要的 DOM 元素。請檢查 HTML ID 是否正確。缺失的元素可能為:", elements.map(e => e ? e.id : '未找到').join(', '));
                // 可以選擇在此處禁用相關功能或顯示錯誤訊息給使用者
                return false;
            }
        }
        return true;
    }
    // 執行檢查
    const coreElementsExist = checkElements(
        productListBody, productListContainer, productTable, editModal, editForm, addModal, addForm,
        salesReportSection, salesReportTitle, salesReportChartCanvas, salesReportLoading, salesReportError, salesReportNoData,
        trafficChartCanvas, chartLoadingMsg, chartErrorMsg, btnDaily, btnMonthly
    );
    if (!coreElementsExist) {
        console.error("頁面核心元件缺失，部分功能可能無法運作。");
        // 可以顯示一個更明顯的錯誤訊息給使用者
        if(document.body) document.body.insertAdjacentHTML('afterbegin', '<p style="background:red; color:white; padding:10px; text-align:center; font-weight:bold;">頁面載入錯誤，缺少核心元件，請聯繫管理員檢查HTML結構！</p>');
    }


    // --- Function to Fetch and Display ALL Products in the Table ---
    async function fetchAndDisplayProducts() {
        if (!productListBody || !productListContainer || !productTable) return; // 依賴檢查已在前面完成
        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (productTable) productTable.style.display = 'none';

            const response = await fetch('/api/products'); // API 應返回包含 total_inventory 的數據
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
        // 檢查 Edit Modal 內部必要的元素
        const requiredEditElements = [editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError, editVariationListDiv, recordSalesError, recordSalesSuccess];
        if (requiredEditElements.some(el => !el)) { console.error("編輯 Modal 元件缺失"); alert("編輯視窗元件錯誤"); return; }

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
                // Use cloneNode trick to remove potential previous listeners
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
            editVariationListDiv.innerHTML = '<p style="color: #888; text-align: center;">此商品尚未設定規格。請聯絡管理員在資料庫中添加。</p>'; // Adjusted message
            // Button disable/enable is handled in openEditModal
            return;
        }

        variations.forEach(variation => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('variation-item');
            itemDiv.dataset.variationId = variation.id;

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('variation-name');
            nameSpan.textContent = variation.name || '未命名規格';

            const inventoryDisplaySpan = document.createElement('span');
            inventoryDisplaySpan.classList.add('variation-inventory-display');
            inventoryDisplaySpan.textContent = `庫存: ${variation.inventory_count !== undefined ? variation.inventory_count : 'N/A'}`;

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
            inventoryInput.dataset.variationId = variation.id;
            inventoryInput.value = variation.inventory_count !== undefined ? variation.inventory_count : '';
            inventoryInputDiv.appendChild(inventoryLabel);
            inventoryInputDiv.appendChild(inventoryInput);

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
            salesInput.dataset.variationId = variation.id;
            salesInputDiv.appendChild(salesLabel);
            salesInputDiv.appendChild(salesInput);

            itemDiv.appendChild(nameSpan);
            itemDiv.appendChild(inventoryDisplaySpan);
            itemDiv.appendChild(inventoryInputDiv);
            itemDiv.appendChild(salesInputDiv);

            editVariationListDiv.appendChild(itemDiv);
        });
    }

    // --- Handle "Record Sales" Button Click ---
    async function handleRecordSalesClick() {
        const recordSalesBtn = document.getElementById('record-sales-btn'); // Re-get the button just in case
        if (!editVariationListDiv || !recordSalesBtn) {
             console.error("無法執行記錄銷售：缺少必要元素。");
             return;
        }
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

            // Refresh sales report chart and product list
            const currentProductId = editProductId.value;
             if (currentReportProductId === currentProductId) {
                const currentProductName = editProductName.value;
                await displayProductVariationSalesChart(currentProductId, currentProductName);
             } else {
                await displayOverallSalesChart(currentGranularity === 'monthly' ? 'monthly' : 'daily');
             }
             await fetchAndDisplayProducts(); // Refresh product list

        } catch (error) { console.error('記錄銷售時出錯:', error); recordSalesError.textContent = `記錄失敗: ${error.message || error}`;
        } finally {
            // Ensure button is re-enabled even if errors occur before fetch or during chart refresh
             if(recordSalesBtn) {
                 recordSalesBtn.disabled = false;
                 recordSalesBtn.textContent = '記錄本次銷售';
             }
        }
    }

    // --- Handle Edit Form Submission (Save Product + Inventory) ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            editFormError.textContent = '';
            const productId = editProductId.value;
            if (!productId) { editFormError.textContent = '錯誤：找不到商品 ID。'; return; }

            // 1. Collect basic product data
            let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value);
            const productData = {
                name: editProductName.value.trim(), description: editProductDescription.value.trim(), price: priceValue, image_url: editProductImageUrl.value.trim() || null, seven_eleven_url: editProductSevenElevenUrl.value.trim() || null
            };
            if (!productData.name) { editFormError.textContent = '商品名稱不能為空。'; return; }
            // ... other product data validation ...

            // 2. Collect inventory data
            const inventoryUpdates = [];
            const inventoryInputs = editVariationListDiv.querySelectorAll('.variation-inventory-input input');
            let inventoryValidationError = false;
            inventoryInputs.forEach(input => {
                if(inventoryValidationError) return;
                const variationId = input.dataset.variationId;
                const inventoryCountStr = input.value.trim();
                 // **修正: 允許空值 (代表不更新)，但輸入非數字或負數則報錯**
                if (variationId && inventoryCountStr !== '') {
                    const inventoryCount = parseInt(inventoryCountStr);
                    if (isNaN(inventoryCount) || inventoryCount < 0) {
                        // Try to get variation name for better error message
                         const nameElement = input.closest('.variation-item')?.querySelector('.variation-name');
                         const variationName = nameElement ? nameElement.textContent : `ID ${variationId}`;
                        editFormError.textContent = `規格 "${variationName}" 的庫存數量必須是非負整數。`;
                        inventoryValidationError = true;
                        input.focus();
                    } else {
                        inventoryUpdates.push({ variationId: variationId, inventory_count: inventoryCount });
                    }
                }
                 // Removed validation requiring input if variation exists - allow no change
            });

            if (inventoryValidationError) return;

            const saveButton = editForm.querySelector('.save-btn');
            if(saveButton) saveButton.disabled = true;

            try {
                // 3. Update basic product info
                const productResponse = await fetch(`/api/products/${productId}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productData)
                });
                 if (!productResponse.ok) {
                     let errorMsg = `商品資料儲存失敗 (HTTP ${productResponse.status})`;
                     try{ const data = await productResponse.json(); errorMsg += `: ${data.error || ''}`;} catch(e){}
                     throw new Error(errorMsg);
                 }

                // 4. Update inventory counts
                if (inventoryUpdates.length > 0) {
                    console.log("準備更新庫存:", inventoryUpdates);
                    const inventoryPromises = inventoryUpdates.map(update =>
                        fetch(`/api/admin/variations/${update.variationId}`, {
                            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inventory_count: update.inventory_count })
                        }).then(async res => { // Make inner function async to use await
                            if (!res.ok) {
                                console.error(`更新規格 ${update.variationId} 庫存失敗 (HTTP ${res.status})`);
                                // Try to get error message from response body
                                let detailError = `HTTP ${res.status}`;
                                try {
                                    const errData = await res.json();
                                    detailError = errData.error || detailError;
                                } catch(e) { /* Ignore parsing error */ }
                                // Throw a more specific error to be caught by Promise.all catch
                                throw new Error(`庫存更新失敗 (規格ID ${update.variationId}): ${detailError}`);
                            }
                            // Optionally return something, or just resolve
                            // return res.json();
                        })
                    );
                     // Wait for all inventory updates to finish
                     await Promise.all(inventoryPromises);
                     console.log("所有請求的庫存更新已完成。");
                }

                // 5. Close modal and refresh list on overall success
                closeModal();
                await fetchAndDisplayProducts(); // Refresh product list

            } catch (error) {
                console.error('儲存商品或庫存時出錯:', error);
                editFormError.textContent = `儲存錯誤：${error.message || '請檢查網絡或聯繫管理員'}`;
            } finally {
                 if(saveButton) saveButton.disabled = false;
            }
        });
    } else { console.error("編輯表單元素 (#edit-product-form) 未找到。"); }


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
             if (!response.ok) {
                 let errorMsg = `無法獲取趨勢數據 (HTTP ${response.status})`;
                 try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){}
                 throw new Error(errorMsg);
             }
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
             if (!response.ok) {
                 let errorMsg = `無法獲取規格銷售數據 (HTTP ${response.status})`;
                 try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){}
                 throw new Error(errorMsg);
             }
            const variationSales = await response.json();
            salesReportLoading.style.display = 'none';

            if (!variationSales || variationSales.length === 0 || variationSales.every(v => v.total_sold === 0)) {
                salesReportNoData.textContent = `商品「${productName}」尚無銷售記錄。`; salesReportNoData.style.display = 'block'; return;
            }
            salesReportChartCanvas.style.display = 'block';
            const labels = variationSales.map(item => item.variation_name || '未命名');
            const data = variationSales.map(item => item.total_sold);
             const backgroundColors = variationSales.map((_, i) => `hsl(${(i * (360 / (variationSales.length || 1)) + 30) % 360}, 75%, 65%)`); // Adjusted HSL calculation


            const ctx = salesReportChartCanvas.getContext('2d');
            salesReportChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{ label: '銷售數量', data: data, backgroundColor: backgroundColors, borderColor: '#fff', borderWidth: 1 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, title: { display: false } } }
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
            // Edit and Delete buttons still rely on global onclick functions
        });
    }

    // --- Helper Functions and Global Scope Attachments ---
    window.closeModal = function() { if (editModal) { editModal.style.display = 'none'; } }
    window.closeAddModal = function() { if (addModal) { addModal.style.display = 'none'; } }
    window.editProduct = function(id) { openEditModal(id); };
    window.deleteProduct = async function(id) {
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？相關規格和銷售記錄將無法恢復！`)) {
            try {
                 // Consider backend constraint or cascade for related data
                const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
                 if (response.status === 204 || response.ok) {
                    await fetchAndDisplayProducts();
                    if (currentReportProductId === id.toString()) { // Use toString for comparison
                        await displayOverallSalesChart();
                    }
                 } else { let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const data = await response.json(); errorMsg = data.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
             } catch (error) { alert(`刪除時發生錯誤：${error.message}`); }
        }
    };
    window.showAddForm = function() {
        const requiredAddElements = [addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addProductSevenElevenUrl, addFormError, addImagePreview];
        if (requiredAddElements.some(el => !el)) { alert("新增視窗元件錯誤"); return; }
        addFormError.textContent = ''; addForm.reset();
        addImagePreview.src = ''; addImagePreview.style.display = 'none';
        addModal.style.display = 'flex';
    };
    // Close modal on outside click
    window.onclick = function(event) {
        if (event.target == editModal) { closeModal(); }
        else if (event.target == addModal) { closeAddModal(); }
    }

    // --- Add Product Form Submission ---
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
                 if (!response.ok) {
                     let errorMsg = `新增失敗 (HTTP ${response.status})`;
                     try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){}
                     throw new Error(errorMsg);
                 }
                closeAddModal();
                await fetchAndDisplayProducts();
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
            trafficChartInstance = new Chart(ctx, {
                type: 'line', data: { labels: labels, datasets: [{ label: granularity === 'daily' ? '每日瀏覽量' : '每月瀏覽量', data: dataPoints, borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.1)', fill: true, tension: 0.2 }] },
                options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true }, title: { display: false } } }
            });
        } catch (error) { console.error(`繪製 ${granularity} 流量圖表失敗:`, error); chartLoadingMsg.style.display = 'none'; chartErrorMsg.textContent=`無法載入流量圖: ${error.message}`; chartErrorMsg.style.display='block'; }
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
    } else { console.warn("找不到流量圖表切換按鈕。"); }

    // --- Initial Page Load ---
    async function initializePage() {
        // Ensure core elements exist before proceeding
        if (!coreElementsExist) return;

        try {
            await fetchAndDisplayProducts();    // Load product list
            await displayTrafficChart('daily'); // Load traffic chart
            await displayOverallSalesChart();   // Load overall sales report chart
            console.log("Admin page initialized.");
        } catch (error) {
            console.error("頁面初始化過程中發生錯誤:", error);
            // Optionally display a general error message on the page
        }
    }

    initializePage();

}); // --- End of DOMContentLoaded ---