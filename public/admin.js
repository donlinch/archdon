// public/admin.js (基礎版本 - 無銷售/庫存追蹤)
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
    const addImagePreview = document.getElementById('add-image-preview');
    const addProductSevenElevenUrl = document.getElementById('add-product-seven-eleven-url');
    const addFormError = document.getElementById('add-form-error');

    // --- 流量圖表相關元素 ---
    const trafficChartCanvas = document.getElementById('traffic-chart');
    const chartLoadingMsg = document.getElementById('chart-loading-msg');
    const chartErrorMsg = document.getElementById('chart-error-msg');
    const btnDaily = document.getElementById('btn-daily');
    const btnMonthly = document.getElementById('btn-monthly');
    let trafficChartInstance = null; // 使用 trafficChartInstance 變數名
    let currentGranularity = 'daily';

    // --- 檢查必要元素是否存在 ---
     function checkElements(...elements) {
        const missingElementIds = [];
        for (let i = 0; i < elements.length; i++) { if (!elements[i]) { missingElementIds.push(`索引 ${i}`); } }
        if (missingElementIds.length > 0) {
             const errorMessage = `初始化錯誤：缺少必要的 DOM 元素。請檢查 HTML ID 是否正確。缺失的元素可能在以下索引位置: ${missingElementIds.join(', ')}`; console.error(errorMessage);
             if(document.body) { /* ... 顯示頁面錯誤 ... */ } return false;
        } return true;
    }
    const coreElementsExist = checkElements(
        productListBody, productListContainer, productTable,
        editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError, // Edit Modal
        addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addImagePreview, addProductSevenElevenUrl, addFormError, // Add Modal
        trafficChartCanvas, chartLoadingMsg, chartErrorMsg, btnDaily, btnMonthly // Traffic Chart
    );
    if (!coreElementsExist) { console.error("停止執行 admin.js，缺少核心元件。"); return; }


    // --- Function to Fetch and Display ALL Products in the Table ---
    async function fetchAndDisplayProducts() {
        if (!productListBody || !productListContainer || !productTable) return;
        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (productTable) productTable.style.display = 'none';

            const response = await fetch('/api/products'); // API 只需返回 products 表欄位
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

    // --- Function to Open and Populate the Edit Modal ---
    async function openEditModal(id) {
        if (!checkElements(editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError)) return;

        editFormError.textContent = ''; editForm.reset(); editImagePreview.style.display = 'none'; editImagePreview.src = '';

        try {
            const response = await fetch(`/api/products/${id}`);
            if (!response.ok) { /* ... error handling ... */ }
            const product = await response.json();

            editProductId.value = product.id; editProductName.value = product.name || ''; editProductDescription.value = product.description || ''; editProductPrice.value = product.price !== null ? product.price : ''; editProductImageUrl.value = product.image_url || ''; editProductSevenElevenUrl.value = product.seven_eleven_url || ''; editProductClickCount.textContent = product.click_count !== null ? product.click_count : '0';
            if (product.image_url) { editImagePreview.src = product.image_url; editImagePreview.style.display = 'block'; } else { editImagePreview.style.display = 'none'; }

            // 沒有加載規格的邏輯
            editModal.style.display = 'flex';
        } catch (error) { console.error(`獲取商品 ${id} 編輯資料出錯:`, error); alert(`無法載入編輯資料： ${error.message}`); }
    }

    // --- Handle Edit Form Submission (Only Basic Product Data) ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
             event.preventDefault();
             if(!checkElements(editFormError, editProductId, editProductName, editProductPrice)) return;
             editFormError.textContent = '';
             const productId = editProductId.value;
             if (!productId) { editFormError.textContent = '錯誤：找不到商品 ID。'; return; }

             let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value);
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

    // --- Handle Add Form Submission (Only Basic Product Data) ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault();
             if(!checkElements(addFormError, addProductName, addProductPrice)) return;
             addFormError.textContent = '';

             let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value);
             const newProductData = { name: addProductName.value.trim(), description: addProductDescription.value.trim(), price: priceValue, image_url: addProductImageUrl.value.trim() || null, seven_eleven_url: addProductSevenElevenUrl.value.trim() || null };
             if (!newProductData.name) { addFormError.textContent = '商品名稱不能為空。'; return; }
             if (newProductData.price === null || isNaN(newProductData.price) || newProductData.price < 0) { addFormError.textContent = '請輸入有效的商品價格。'; return; }

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
        if (trafficChartInstance) { trafficChartInstance.destroy(); trafficChartInstance = null; } // 使用 trafficChartInstance
        trafficChartCanvas.style.display = 'none';
        let apiUrl = '/api/analytics/traffic'; if (granularity === 'monthly') { apiUrl = '/api/analytics/monthly-traffic'; }
        try {
            const response = await fetch(apiUrl);
             if (!response.ok) { let errorMsg = `無法獲取流量數據 (HTTP ${response.status})`; try { const data = await response.json(); errorMsg = data.error || errorMsg; } catch(e){} throw new Error(errorMsg); }
            const trafficData = await response.json();
            chartLoadingMsg.style.display = 'none'; trafficChartCanvas.style.display = 'block';
            if (trafficData.length === 0) { if (chartErrorMsg) { chartErrorMsg.textContent='（尚無流量數據）'; chartErrorMsg.style.display='block'; chartErrorMsg.style.color='#888';} return; }
            const labels = trafficData.map(item => item.date || item.month); const dataPoints = trafficData.map(item => item.count);
            trafficChartInstance = new Chart(ctx, { // 使用 trafficChartInstance
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
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) { // 基礎版本無需警告規格
            try {
                const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
                 if (response.status === 204 || response.ok) {
                    await fetchAndDisplayProducts();
                 } else { let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const data = await response.json(); errorMsg = data.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
             } catch (error) { alert(`刪除時發生錯誤：${error.message}`); }
        }
    };
    window.showAddForm = function() {
        const requiredAddElements = [addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addProductSevenElevenUrl, addFormError, addImagePreview];
        if (requiredAddElements.some(el => !el)) { alert("新增視窗元件錯誤"); return; }
        addFormError.textContent = ''; addForm.reset();
        addImagePreview.src = ''; addImagePreview.style.display = 'none';
        // 沒有規格容器需要清空
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
            console.log("Admin page initialized (Basic Version).");
        } catch (error) { console.error("頁面初始化過程中發生錯誤:", error); }
    }

    initializePage();

}); // --- End of DOMContentLoaded ---