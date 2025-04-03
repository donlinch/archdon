// public/admin.js
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

    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-product-form');
    const addProductName = document.getElementById('add-product-name');
    const addProductDescription = document.getElementById('add-product-description');
    const addProductPrice = document.getElementById('add-product-price');
    const addProductImageUrl = document.getElementById('add-product-image-url');
    const addImagePreview = document.getElementById('add-image-preview'); // HTML 中有此 ID
    const addProductSevenElevenUrl = document.getElementById('add-product-seven-eleven-url');
    const addFormError = document.getElementById('add-form-error');

    // --- *** 新增: 商品銷售詳情區塊元素 *** ---
    const salesDetailSection = document.getElementById('product-sales-details');
    const salesDetailProductName = document.getElementById('sales-detail-product-name');
    const variationListUl = document.getElementById('variation-list');
    const variationListLoading = document.getElementById('variation-list-loading');
    const variationListError = document.getElementById('variation-list-error');
    const salesChartContainer = document.getElementById('sales-chart-container');
    const salesChartCanvas = document.getElementById('variation-sales-chart');
    const salesChartLoading = document.getElementById('sales-chart-loading');
    const salesChartError = document.getElementById('sales-chart-error');
    const salesChartNoData = document.getElementById('sales-chart-nodata');
    let variationChartInstance = null; // 用於儲存銷售圖表實例
    let currentSalesProductId = null; // 追蹤當前顯示詳情的商品ID

    // --- 流量圖表相關元素 ---
    const trafficChartCanvas = document.getElementById('traffic-chart');
    const chartLoadingMsg = document.getElementById('chart-loading-msg');
    const chartErrorMsg = document.getElementById('chart-error-msg');
    const btnDaily = document.getElementById('btn-daily');
    const btnMonthly = document.getElementById('btn-monthly');
    let trafficChartInstance = null; // 儲存流量圖表實例 (原 currentChart)
    let currentGranularity = 'daily';

    // --- Function to Fetch and Display ALL Products in the Table ---
    async function fetchAndDisplayProducts() {
        if (!productListBody || !productListContainer || !productTable) {
            console.error("Admin page table elements not found.");
            if(loadingMessage) loadingMessage.textContent = '頁面結構錯誤，無法載入列表。';
            return;
        }
        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (productTable) productTable.style.display = 'none';
            // 確保關閉銷售詳情區塊
            if (salesDetailSection) salesDetailSection.style.display = 'none';
            currentSalesProductId = null;

            const response = await fetch('/api/products'); // 預設獲取所有商品
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            }
            const products = await response.json();

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (productTable) productTable.style.display = 'table';
            productListBody.innerHTML = '';

            if (products.length === 0) {
                productListBody.innerHTML = '<tr><td colspan="6">目前沒有商品。</td></tr>'; // Colspan 仍為 6
                return;
            }

            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;
                // *** 修改: 在操作欄加入 "查看銷售" 按鈕 ***
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td title="${product.name || ''}">${product.name || ''}</td>
                    <td>${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
                    <td style="text-align:center;">${product.click_count !== null ? product.click_count : '0'}</td>
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

    // --- *** 新增: 載入並顯示商品銷售詳情 *** ---
    async function loadSalesDetails(productId, productName) {
        if (!salesDetailSection || !salesDetailProductName || !variationListUl || !variationListLoading || !variationListError || !salesChartContainer) {
            console.error("銷售詳情區塊的 DOM 元素缺失。");
            return;
        }

        // 顯示區塊並設定標題
        salesDetailSection.style.display = 'block';
        salesDetailProductName.textContent = productName;
        currentSalesProductId = productId; // 記錄當前商品ID

        // 重置狀態
        variationListUl.innerHTML = '';
        variationListLoading.style.display = 'block';
        variationListError.textContent = '';
        salesChartLoading.style.display = 'block';
        salesChartError.textContent = '';
        salesChartNoData.style.display = 'none';
        if (variationChartInstance) {
            variationChartInstance.destroy();
            variationChartInstance = null;
        }
        salesChartCanvas.style.display = 'none';

        try {
            // 呼叫 API 獲取規格數據
            const response = await fetch(`/api/admin/products/${productId}/variations`);
            if (!response.ok) {
                let errorMsg = `獲取規格失敗 (HTTP ${response.status})`;
                try { const data = await response.json(); errorMsg += `: ${data.error || '未知錯誤'}`;} catch(e){}
                throw new Error(errorMsg);
            }
            const variations = await response.json();

            variationListLoading.style.display = 'none';
            salesChartLoading.style.display = 'none';

            renderVariationList(variations, productId); // 傳入 productId
            renderSalesChart(variations);

        } catch (error) {
            console.error(`載入商品 ${productId} 的銷售詳情時出錯:`, error);
            variationListLoading.style.display = 'none';
            variationListError.textContent = `無法載入規格列表: ${error.message}`;
            salesChartLoading.style.display = 'none';
            salesChartError.textContent = `無法載入圖表數據: ${error.message}`;
        }
    }

    // --- *** 新增: 渲染規格列表 *** ---
    function renderVariationList(variations, productId) { // 接收 productId
        variationListUl.innerHTML = '';
        if (!variations || variations.length === 0) {
            variationListUl.innerHTML = '<li style="padding: 1rem; text-align: center; color: #888;">此商品尚無規格資料或銷售紀錄。</li>';
            return;
        }

        variations.forEach(variation => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '10px 15px';
            li.style.borderBottom = '1px solid #eee';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = variation.name || '未命名規格';
            nameSpan.style.fontWeight = '500';
            nameSpan.style.flexGrow = '1';
            nameSpan.style.marginRight = '10px';

            const countSpan = document.createElement('span');
            countSpan.textContent = `已售: ${variation.sales_count || 0}`;
            countSpan.id = `sales-count-${variation.id}`; // 給計數器一個 ID 以便更新
            countSpan.style.color = '#E57373';
            countSpan.style.fontWeight = 'bold';
            countSpan.style.minWidth = '60px';
            countSpan.style.textAlign = 'right';

            const recordButton = document.createElement('button');
            recordButton.textContent = '+1 銷售';
            recordButton.classList.add('action-btn', 'record-sale-btn');
            recordButton.dataset.variationId = variation.id;
            recordButton.dataset.productId = productId; // 將 productId 也存起來
            recordButton.style.marginLeft = '15px';
            recordButton.style.padding = '4px 8px';
            recordButton.style.fontSize = '0.8em';
            recordButton.style.backgroundColor = '#28a745';
            recordButton.style.color = 'white';
            recordButton.style.border = 'none';

            li.appendChild(nameSpan);
            li.appendChild(countSpan);
            li.appendChild(recordButton);
            variationListUl.appendChild(li);
        });

        // 移除最後一個元素的底線
        if (variationListUl.lastChild) {
            variationListUl.lastChild.style.borderBottom = 'none';
        }
    }

    // --- *** 新增: 渲染銷售圖表 *** ---
    function renderSalesChart(variations) {
        if (!salesChartCanvas || !salesChartContainer || !salesChartNoData) return;

        // 銷毀舊圖表
        if (variationChartInstance) {
            variationChartInstance.destroy();
            variationChartInstance = null;
        }

        if (!variations || variations.length === 0 || variations.every(v => (v.sales_count || 0) === 0)) {
            salesChartNoData.style.display = 'block'; // 顯示無數據提示
            salesChartCanvas.style.display = 'none'; // 隱藏畫布
            salesChartError.textContent = '';
            return;
        }

        salesChartNoData.style.display = 'none';
        salesChartCanvas.style.display = 'block';
        salesChartError.textContent = '';

        const labels = variations.map(v => v.name || '未命名');
        const data = variations.map(v => v.sales_count || 0);

        // 可以隨機生成顏色或使用預定義的顏色列表
        const backgroundColors = variations.map(() => `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.6)`);
        const borderColors = backgroundColors.map(color => color.replace('0.6', '1'));

        const ctx = salesChartCanvas.getContext('2d');
        variationChartInstance = new Chart(ctx, {
            type: 'bar', // 或 'pie'
            data: {
                labels: labels,
                datasets: [{
                    label: '銷售數量',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1 // 強制 Y 軸刻度為整數
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // 只有一個數據集時可以隱藏圖例
                    },
                    title: {
                        display: false // 標題已在 HTML 中
                    }
                }
            }
        });
    }

    // --- *** 新增: 處理記錄銷售按鈕點擊 *** ---
    if (variationListUl) {
        variationListUl.addEventListener('click', async (event) => {
            if (event.target.classList.contains('record-sale-btn')) {
                const button = event.target;
                const variationId = button.dataset.variationId;
                const productId = button.dataset.productId; // 從按鈕獲取 productId

                if (!variationId || !productId) {
                    console.error("記錄銷售按鈕缺少 variationId 或 productId");
                    return;
                }

                button.disabled = true; // 防止重複點擊
                button.textContent = '記錄中...';

                try {
                    const response = await fetch(`/api/admin/variations/${variationId}/record-sale`, {
                        method: 'POST',
                    });

                    if (!response.ok) {
                        let errorMsg = `記錄銷售失敗 (HTTP ${response.status})`;
                        try { const data = await response.json(); errorMsg += `: ${data.error || '請重試'}`;} catch(e){}
                        throw new Error(errorMsg);
                    }

                    // 記錄成功，重新載入該商品的銷售詳情以更新列表和圖表
                    console.log(`規格 ${variationId} 銷售記錄成功`);
                    const productName = salesDetailProductName.textContent; // 從標題獲取名稱
                    await loadSalesDetails(productId, productName); // 重新載入

                    // 注意：如果 loadSalesDetails 執行時間很長，按鈕會保持 disabled 狀態。
                    // 如果希望按鈕更快恢復，可以在 loadSalesDetails 完成後再處理按鈕狀態，
                    // 或者不重新載入，僅手動更新當前畫面的數字和圖表數據。
                    // 目前選擇重新載入以確保數據一致性。

                } catch (error) {
                    console.error(`記錄規格 ${variationId} 銷售時出錯:`, error);
                    alert(`記錄銷售出錯: ${error.message}`);
                    // 出錯時恢復按鈕狀態
                    button.disabled = false;
                    button.textContent = '+1 銷售';
                }
                // 不論成功失敗，最後都確保按鈕恢復 (如果 loadSalesDetails 失敗)
                // 但因為成功時會重新渲染，所以這裡可以不用明確恢復
                // finally {
                //     // 如果 loadSalesDetails 沒跑，確保按鈕恢復
                //     if (button.disabled) {
                //        button.disabled = false;
                //        button.textContent = '+1 銷售';
                //     }
                // }
            }
        });
    }

    // --- *** 修改: 為商品列表添加事件委派處理 "查看銷售" 按鈕 *** ---
    if (productListBody) {
        productListBody.addEventListener('click', async (event) => {
            // 處理查看銷售按鈕
            if (event.target.classList.contains('view-sales-btn')) {
                const button = event.target;
                const productId = button.dataset.productId;
                const productName = button.dataset.productName || '商品';

                if (productId) {
                    // 滾動到銷售詳情區塊
                    if (salesDetailSection) {
                         salesDetailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    await loadSalesDetails(productId, productName);
                }
            }
            // 注意：原有的 onclick="editProduct(...)" 和 onclick="deleteProduct(...)" 仍然有效，
            // 但更現代的做法是也將它們改為事件委派。不過為了減少改動，暫時保留 onclick。
        });
    }


    // --- Function to Open and Populate the Edit Modal ---
    async function openEditModal(id) {
        // ... (這個函數的內部邏輯保持不變, 確保包含填充點擊數) ...
        const requiredEditElements = [editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError]; if (requiredEditElements.some(el => !el)) { console.error("一個或多個編輯 Modal 元件在 HTML 中缺失。"); alert("編輯視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。"); return; } editFormError.textContent = ''; editForm.reset(); editImagePreview.style.display = 'none'; editImagePreview.src = ''; try { const response = await fetch(`/api/products/${id}`); if (!response.ok) { if (response.status === 404) throw new Error('找不到該商品。'); throw new Error(`無法獲取商品資料 (HTTP ${response.status})`); } const product = await response.json(); editProductId.value = product.id; editProductName.value = product.name || ''; editProductDescription.value = product.description || ''; editProductPrice.value = product.price !== null ? product.price : ''; editProductImageUrl.value = product.image_url || ''; editProductSevenElevenUrl.value = product.seven_eleven_url || ''; editProductClickCount.textContent = product.click_count !== null ? product.click_count : '0'; if (product.image_url) { editImagePreview.src = product.image_url; editImagePreview.style.display = 'block'; } else { editImagePreview.style.display = 'none'; } editModal.style.display = 'flex'; } catch (error) { console.error(`獲取商品 ${id} 進行編輯時出錯:`, error); alert(`無法載入編輯資料： ${error.message}`); }
    }

    // --- Function to Close the Edit Modal ---
    window.closeModal = function() { if (editModal) { editModal.style.display = 'none'; } }

    // --- Function to Close the Add Modal ---
    window.closeAddModal = function() { if (addModal) { addModal.style.display = 'none'; } }

    // --- Attach Edit Function to Global Scope ---
    window.editProduct = function(id) { openEditModal(id); };

    // --- Attach Delete Function to Global Scope ---
    window.deleteProduct = async function(id) {
        // ... (這個函數的內部邏輯保持不變) ...
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) { try { const response = await fetch(`/api/products/${id}`, { method: 'DELETE' }); if (response.status === 204 || response.ok) { await fetchAndDisplayProducts(); } else { let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${response.statusText}`; } throw new Error(errorMsg); } } catch (error) { alert(`刪除時發生錯誤：${error.message}`); } }
    };

    // --- Attach Show Add Form Function to Global Scope ---
    window.showAddForm = function() {
         // ... (這個函數的內部邏輯保持不變) ...
         const requiredAddElements = [addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addProductSevenElevenUrl, addFormError]; if (requiredAddElements.some(el => !el)) { alert("新增視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。"); return; } addFormError.textContent = ''; addForm.reset(); addModal.style.display = 'flex';
    }

    // --- Close Modals if User Clicks Outside of Modal Content ---
    window.onclick = function(event) { if (event.target == editModal) { closeModal(); } else if (event.target == addModal) { closeAddModal(); } }

    // --- Edit Form Submission Listener ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
             // ... (這個函數的內部邏輯保持不變) ...
             event.preventDefault(); editFormError.textContent = ''; const productId = editProductId.value; if (!productId) { editFormError.textContent = '錯誤：找不到商品 ID。'; return; } let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value); const updatedData = { name: editProductName.value.trim(), description: editProductDescription.value.trim(), price: priceValue, image_url: editProductImageUrl.value.trim() || null, seven_eleven_url: editProductSevenElevenUrl.value.trim() || null }; if (!updatedData.name) { editFormError.textContent = '商品名稱不能為空。'; return; } if (updatedData.price !== null && isNaN(updatedData.price)) { editFormError.textContent = '價格必須是有效的數字。'; return; } if (updatedData.price !== null && updatedData.price < 0) { editFormError.textContent = '價格不能是負數。'; return; } const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'); if (!isBasicUrlValid(updatedData.seven_eleven_url)) { editFormError.textContent = '7-11 連結格式不正確 (應為 http/https 開頭)。'; return; } try { const response = await fetch(`/api/products/${productId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) }); if (!response.ok) { let errorMsg = `儲存失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); } closeModal(); await fetchAndDisplayProducts(); } catch (error) { editFormError.textContent = `儲存錯誤：${error.message}`; }
        });
    } else { console.error("編輯表單元素未找到。"); }

    // --- Add Form Submission Listener ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
             // ... (這個函數的內部邏輯保持不變) ...
             event.preventDefault(); addFormError.textContent = ''; let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value); const newProductData = { name: addProductName.value.trim(), description: addProductDescription.value.trim(), price: priceValue, image_url: addProductImageUrl.value.trim() || null, seven_eleven_url: addProductSevenElevenUrl.value.trim() || null }; if (!newProductData.name) { addFormError.textContent = '商品名稱不能為空。'; return; } if (newProductData.price !== null && isNaN(newProductData.price)) { addFormError.textContent = '價格必須是有效的數字。'; return; } if (newProductData.price !== null && newProductData.price < 0) { addFormError.textContent = '價格不能是負數。'; return; } const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'); if (!isBasicUrlValid(newProductData.seven_eleven_url)) { addFormError.textContent = '7-11 連結格式不正確 (應為 http/https 開頭)。'; return; } try { const response = await fetch(`/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProductData) }); if (!response.ok) { let errorMsg = `新增失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); } closeAddModal(); await fetchAndDisplayProducts(); } catch (error) { addFormError.textContent = `新增錯誤：${error.message}`; }
        });
    } else { console.error("新增表單元素未找到。"); }


    // --- *** 圖表相關邏輯 *** ---

    /**
     * 獲取並繪製流量圖表
     * @param {string} granularity - 'daily' 或 'monthly'
     */
    async function displayTrafficChart(granularity = 'daily') {
        if (!trafficChartCanvas) { console.warn("找不到 traffic-chart canvas 元素。"); return; }
        const ctx = trafficChartCanvas.getContext('2d');
        currentGranularity = granularity;

        if (chartLoadingMsg) chartLoadingMsg.style.display = 'block';
        if (chartErrorMsg) chartErrorMsg.style.display = 'none';
        if (currentChart) { currentChart.destroy(); currentChart = null; }
        trafficChartCanvas.style.display = 'none';

        let apiUrl = '/api/analytics/traffic';
        if (granularity === 'monthly') { apiUrl = '/api/analytics/monthly-traffic'; }

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) { let errorMsg = `無法獲取流量數據 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch(e){} throw new Error(errorMsg); }
            const trafficData = await response.json();

            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
            trafficChartCanvas.style.display = 'block';

            if (trafficData.length === 0) {
                if (chartErrorMsg) { chartErrorMsg.textContent = '（尚無流量數據）'; chartErrorMsg.style.display = 'block'; chartErrorMsg.style.color = '#888'; }
                return;
            }

            const labels = trafficData.map(item => item.date || item.month);
            const dataPoints = trafficData.map(item => item.count);

            currentChart = new Chart(ctx, {
                type: 'line',
                data: { labels: labels, datasets: [{ label: granularity === 'daily' ? '每日頁面瀏覽量' : '每月頁面瀏覽量', data: dataPoints, borderColor: granularity === 'daily' ? 'rgb(54, 162, 235)' : 'rgb(255, 159, 64)', backgroundColor: granularity === 'daily' ? 'rgba(54, 162, 235, 0.1)' : 'rgba(255, 159, 64, 0.1)', fill: true, tension: 0.2 }] },
                options: { scales: { y: { beginAtZero: true, ticks: { stepSize: granularity === 'daily' ? 1 : undefined } } }, responsive: true, maintainAspectRatio: false, plugins: { title: { display: false }, legend: { display: true, position: 'top' } } }
            });
        } catch (error) {
            console.error(`繪製 ${granularity} 流量圖表失敗:`, error);
            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
            if (chartErrorMsg) { chartErrorMsg.textContent = `無法載入圖表: ${error.message}`; chartErrorMsg.style.display = 'block'; chartErrorMsg.style.color = 'red'; }
        }
    }

    // --- 為切換按鈕添加事件監聽器 ---
    if (btnDaily && btnMonthly) {
        const toggleButtons = [btnDaily, btnMonthly];
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const newGranularity = button.dataset.granularity;
                if (newGranularity !== currentGranularity) {
                    toggleButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    displayTrafficChart(newGranularity);
                }
            });
        });
    } else { console.warn("找不到圖表切換按鈕。"); }

    // --- Initial Load ---
    fetchAndDisplayProducts(); // 載入商品列表
    displayTrafficChart('daily'); // 預設載入每日流量圖表

}); // --- End of DOMContentLoaded ---