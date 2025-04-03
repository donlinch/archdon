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

    // --- 商品銷售詳情區塊元素 ---
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
    let variationChartInstance = null; // 儲存銷售圖表實例
    let currentSalesProductId = null; // 追蹤當前顯示詳情的商品ID

    // --- 流量圖表相關元素 ---
    const trafficChartCanvas = document.getElementById('traffic-chart');
    const chartLoadingMsg = document.getElementById('chart-loading-msg');
    const chartErrorMsg = document.getElementById('chart-error-msg');
    const btnDaily = document.getElementById('btn-daily');
    const btnMonthly = document.getElementById('btn-monthly');
    let trafficChartInstance = null; // *** 更正: 儲存流量圖表實例 ***
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
            if (salesDetailSection) salesDetailSection.style.display = 'none';
            currentSalesProductId = null;

            const response = await fetch('/api/products');
            if (!response.ok) { throw new Error(`HTTP 錯誤！狀態: ${response.status}`); }
            const products = await response.json();

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (productTable) productTable.style.display = 'table';
            productListBody.innerHTML = '';

            if (products.length === 0) {
                productListBody.innerHTML = '<tr><td colspan="6">目前沒有商品。</td></tr>';
                return;
            }

            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td title="${product.name || ''}">${product.name || ''}</td>
                    <td style="text-align:right; padding-right: 15px;">${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
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

    // --- 載入並顯示商品銷售詳情 ---
    async function loadSalesDetails(productId, productName) {
        if (!salesDetailSection || !salesDetailProductName || !variationListUl || !variationListLoading || !variationListError || !salesChartContainer) {
            console.error("銷售詳情區塊的 DOM 元素缺失。");
            return;
        }
        salesDetailSection.style.display = 'block';
        salesDetailProductName.textContent = productName;
        currentSalesProductId = productId;

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
            const response = await fetch(`/api/admin/products/${productId}/variations`);
            if (!response.ok) {
                let errorMsg = `獲取規格失敗 (HTTP ${response.status})`;
                try { const data = await response.json(); errorMsg += `: ${data.error || '未知錯誤'}`;} catch(e){}
                throw new Error(errorMsg);
            }
            const variations = await response.json();

            variationListLoading.style.display = 'none';
            salesChartLoading.style.display = 'none';

            renderVariationList(variations, productId);
            renderSalesChart(variations);

        } catch (error) {
            console.error(`載入商品 ${productId} 的銷售詳情時出錯:`, error);
            variationListLoading.style.display = 'none';
            variationListError.textContent = `無法載入規格列表: ${error.message}`;
            salesChartLoading.style.display = 'none';
            salesChartError.textContent = `無法載入圖表數據: ${error.message}`;
        }
    }

    // --- 渲染規格列表 ---
    function renderVariationList(variations, productId) {
        variationListUl.innerHTML = '';
        if (!variations || variations.length === 0) {
            variationListUl.innerHTML = '<li style="padding: 1rem; text-align: center; color: #888;">此商品尚無規格資料或銷售紀錄。</li>';
            return;
        }
        variations.forEach(variation => {
            const li = document.createElement('li');
            li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.padding = '10px 15px'; li.style.borderBottom = '1px solid #eee';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = variation.name || '未命名規格'; nameSpan.style.fontWeight = '500'; nameSpan.style.flexGrow = '1'; nameSpan.style.marginRight = '10px';
            const countSpan = document.createElement('span');
            countSpan.textContent = `已售: ${variation.sales_count || 0}`; countSpan.id = `sales-count-${variation.id}`; countSpan.style.color = '#E57373'; countSpan.style.fontWeight = 'bold'; countSpan.style.minWidth = '60px'; countSpan.style.textAlign = 'right';
            const recordButton = document.createElement('button');
            recordButton.textContent = '+1 銷售'; recordButton.classList.add('action-btn', 'record-sale-btn'); recordButton.dataset.variationId = variation.id; recordButton.dataset.productId = productId; recordButton.style.marginLeft = '15px'; recordButton.style.padding = '4px 8px'; recordButton.style.fontSize = '0.8em'; recordButton.style.backgroundColor = '#28a745'; recordButton.style.color = 'white'; recordButton.style.border = 'none';
            li.appendChild(nameSpan); li.appendChild(countSpan); li.appendChild(recordButton);
            variationListUl.appendChild(li);
        });
        if (variationListUl.lastChild) { variationListUl.lastChild.style.borderBottom = 'none'; }
    }

    // --- 渲染銷售圖表 ---
    function renderSalesChart(variations) {
        if (!salesChartCanvas || !salesChartContainer || !salesChartNoData) return;
        if (variationChartInstance) { variationChartInstance.destroy(); variationChartInstance = null; }

        if (!variations || variations.length === 0 || variations.every(v => (v.sales_count || 0) === 0)) {
            salesChartNoData.style.display = 'block'; salesChartCanvas.style.display = 'none'; salesChartError.textContent = ''; return;
        }
        salesChartNoData.style.display = 'none'; salesChartCanvas.style.display = 'block'; salesChartError.textContent = '';

        const labels = variations.map(v => v.name || '未命名');
        const data = variations.map(v => v.sales_count || 0);
        const backgroundColors = variations.map(() => `rgba(${Math.floor(Math.random() * 200 + 55)}, ${Math.floor(Math.random() * 200 + 55)}, ${Math.floor(Math.random() * 200 + 55)}, 0.6)`);
        const borderColors = backgroundColors.map(color => color.replace('0.6', '1'));

        const ctx = salesChartCanvas.getContext('2d');
        variationChartInstance = new Chart(ctx, {
            type: 'bar', data: { labels: labels, datasets: [{ label: '銷售數量', data: data, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false }, title: { display: false } } }
        });
    }

    // --- 處理記錄銷售按鈕點擊 ---
    if (variationListUl) {
        variationListUl.addEventListener('click', async (event) => {
            if (event.target.classList.contains('record-sale-btn')) {
                const button = event.target;
                const variationId = button.dataset.variationId;
                const productId = button.dataset.productId;
                if (!variationId || !productId) { console.error("記錄銷售按鈕缺少 variationId 或 productId"); return; }
                button.disabled = true; button.textContent = '記錄中...';
                try {
                    const response = await fetch(`/api/admin/variations/${variationId}/record-sale`, { method: 'POST' });
                    if (!response.ok) {
                        let errorMsg = `記錄銷售失敗 (HTTP ${response.status})`; try { const data = await response.json(); errorMsg += `: ${data.error || '請重試'}`;} catch(e){} throw new Error(errorMsg);
                    }
                    console.log(`規格 ${variationId} 銷售記錄成功`);
                    const productName = salesDetailProductName.textContent;
                    await loadSalesDetails(productId, productName); // 成功後重新載入詳情
                } catch (error) {
                    console.error(`記錄規格 ${variationId} 銷售時出錯:`, error); alert(`記錄銷售出錯: ${error.message}`);
                    button.disabled = false; button.textContent = '+1 銷售'; // 出錯時恢復按鈕
                }
            }
        });
    }

    // --- 為商品列表添加事件委派 ---
    if (productListBody) {
        productListBody.addEventListener('click', async (event) => {
            if (event.target.classList.contains('view-sales-btn')) { // 處理查看銷售
                const button = event.target;
                const productId = button.dataset.productId;
                const productName = button.dataset.productName || '商品';
                if (productId) {
                    if (salesDetailSection) { salesDetailSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                    await loadSalesDetails(productId, productName);
                }
            }
            // 編輯和刪除仍然使用 onclick 屬性觸發 window 上的函數
        });
    }

    // --- Edit/Add Modal/Form Functions (部分保持不變) ---
    async function openEditModal(id) {
        const requiredEditElements = [editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError];
        if (requiredEditElements.some(el => !el)) { console.error("一個或多個編輯 Modal 元件在 HTML 中缺失。"); alert("編輯視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。"); return; }
        editFormError.textContent = ''; editForm.reset(); editImagePreview.style.display = 'none'; editImagePreview.src = '';
        try {
            const response = await fetch(`/api/products/${id}`);
            if (!response.ok) { if (response.status === 404) throw new Error('找不到該商品。'); throw new Error(`無法獲取商品資料 (HTTP ${response.status})`); }
            const product = await response.json();
            editProductId.value = product.id; editProductName.value = product.name || ''; editProductDescription.value = product.description || ''; editProductPrice.value = product.price !== null ? product.price : ''; editProductImageUrl.value = product.image_url || ''; editProductSevenElevenUrl.value = product.seven_eleven_url || ''; editProductClickCount.textContent = product.click_count !== null ? product.click_count : '0';
            if (product.image_url) { editImagePreview.src = product.image_url; editImagePreview.style.display = 'block'; } else { editImagePreview.style.display = 'none'; }
            editModal.style.display = 'flex';
        } catch (error) { console.error(`獲取商品 ${id} 進行編輯時出錯:`, error); alert(`無法載入編輯資料： ${error.message}`); }
    }
    window.closeModal = function() { if (editModal) { editModal.style.display = 'none'; } }
    window.closeAddModal = function() { if (addModal) { addModal.style.display = 'none'; } }
    window.editProduct = function(id) { openEditModal(id); }; // 暴露到全局
    window.deleteProduct = async function(id) {
         if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) {
             try {
                 const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
                 if (response.status === 204 || response.ok) { await fetchAndDisplayProducts(); } // 成功後刷新列表
                 else { let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${response.statusText}`; } throw new Error(errorMsg); }
             } catch (error) { alert(`刪除時發生錯誤：${error.message}`); }
         }
    }; // 暴露到全局
    window.showAddForm = function() {
         const requiredAddElements = [addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addProductSevenElevenUrl, addFormError, addImagePreview]; // 加上預覽
         if (requiredAddElements.some(el => !el)) { alert("新增視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。"); return; }
         addFormError.textContent = ''; addForm.reset();
         addImagePreview.src = ''; addImagePreview.style.display = 'none'; // 清空預覽
         addModal.style.display = 'flex';
    }; // 暴露到全局
    window.onclick = function(event) { if (event.target == editModal) { closeModal(); } else if (event.target == addModal) { closeAddModal(); } }

    // --- 表單提交監聽器 (部分保持不變) ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault(); editFormError.textContent = ''; const productId = editProductId.value; if (!productId) { editFormError.textContent = '錯誤：找不到商品 ID。'; return; }
            let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value); const updatedData = { name: editProductName.value.trim(), description: editProductDescription.value.trim(), price: priceValue, image_url: editProductImageUrl.value.trim() || null, seven_eleven_url: editProductSevenElevenUrl.value.trim() || null };
            if (!updatedData.name) { editFormError.textContent = '商品名稱不能為空。'; return; } if (updatedData.price !== null && isNaN(updatedData.price)) { editFormError.textContent = '價格必須是有效的數字。'; return; } if (updatedData.price !== null && updatedData.price < 0) { editFormError.textContent = '價格不能是負數。'; return; }
            const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'); if (updatedData.seven_eleven_url && !isBasicUrlValid(updatedData.seven_eleven_url)) { editFormError.textContent = '7-11 連結格式不正確 (應為 http/https 或 / 開頭)。'; return; } // 稍微放寬驗證
            try {
                const response = await fetch(`/api/products/${productId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) });
                if (!response.ok) { let errorMsg = `儲存失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
                closeModal(); await fetchAndDisplayProducts();
            } catch (error) { editFormError.textContent = `儲存錯誤：${error.message}`; }
        });
    } else { console.error("編輯表單元素 (#edit-product-form) 未找到。"); }

    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault(); addFormError.textContent = '';
            let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value); const newProductData = { name: addProductName.value.trim(), description: addProductDescription.value.trim(), price: priceValue, image_url: addProductImageUrl.value.trim() || null, seven_eleven_url: addProductSevenElevenUrl.value.trim() || null };
            if (!newProductData.name) { addFormError.textContent = '商品名稱不能為空。'; return; } if (newProductData.price !== null && isNaN(newProductData.price)) { addFormError.textContent = '價格必須是有效的數字。'; return; } if (newProductData.price !== null && newProductData.price < 0) { addFormError.textContent = '價格不能是負數。'; return; }
            const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'); if (newProductData.seven_eleven_url && !isBasicUrlValid(newProductData.seven_eleven_url)) { addFormError.textContent = '7-11 連結格式不正確 (應為 http/https 或 / 開頭)。'; return; } // 稍微放寬驗證
            try {
                const response = await fetch(`/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProductData) });
                if (!response.ok) { let errorMsg = `新增失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
                closeAddModal(); await fetchAndDisplayProducts();
            } catch (error) { addFormError.textContent = `新增錯誤：${error.message}`; }
        });
    } else { console.error("新增表單元素 (#add-product-form) 未找到。"); }

    // --- 圖片預覽功能 ---
    function setupImagePreview(inputElement, previewElement) {
        if (inputElement && previewElement) {
            inputElement.addEventListener('input', () => {
                const url = inputElement.value.trim();
                previewElement.src = url;
                previewElement.style.display = url ? 'block' : 'none';
            });
            const initialUrl = inputElement.value.trim();
            if (initialUrl) { previewElement.src = initialUrl; previewElement.style.display = 'block'; }
            else { previewElement.style.display = 'none';} // 確保初始是隱藏的
        }
    }
    setupImagePreview(editProductImageUrl, editImagePreview);
    setupImagePreview(addProductImageUrl, addImagePreview);

    // --- 流量圖表邏輯 (修正變數名) ---
    async function displayTrafficChart(granularity = 'daily') {
        if (!trafficChartCanvas) { console.warn("找不到 traffic-chart canvas 元素。"); return; }
        const ctx = trafficChartCanvas.getContext('2d');
        currentGranularity = granularity;

        if (chartLoadingMsg) chartLoadingMsg.style.display = 'block';
        if (chartErrorMsg) chartErrorMsg.style.display = 'none';
        // *** 修正: 使用 trafficChartInstance ***
        if (trafficChartInstance) {
            trafficChartInstance.destroy();
            trafficChartInstance = null;
        }
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

            // *** 修正: 使用 trafficChartInstance ***
            trafficChartInstance = new Chart(ctx, {
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
    // --- 流量圖表按鈕監聽 ---
    if (btnDaily && btnMonthly) {
        const toggleButtons = [btnDaily, btnMonthly];
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const newGranularity = button.dataset.granularity;
                if (newGranularity !== currentGranularity) {
                    toggleButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    displayTrafficChart(newGranularity); // 使用正確的函數名
                }
            });
        });
    } else { console.warn("找不到圖表切換按鈕。"); }

    // --- Initial Load ---
    fetchAndDisplayProducts(); // 載入商品列表
    displayTrafficChart('daily'); // 預設載入每日流量圖表

}); // --- End of DOMContentLoaded ---