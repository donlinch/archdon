// public/admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References (商品列表和 Modal) ---
    const productListBody = document.querySelector('#product-list-table tbody');
    const productListContainer = document.getElementById('product-list-container');
    const productTable = document.getElementById('product-list-table');
    const loadingMessage = productListContainer ? productListContainer.querySelector('p') : null;

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
    const addProductSevenElevenUrl = document.getElementById('add-product-seven-eleven-url');
    const addFormError = document.getElementById('add-form-error');
    const addVariationsContainer = document.getElementById('add-variations-container');
    const addVariationBtn = document.getElementById('add-variation-btn');

    const editVariationsContainer = document.getElementById('edit-variations-container');
    const editVariationBtn = document.getElementById('edit-variation-btn');
    const recordSaleBtn = document.getElementById('record-sale-btn');

    // --- 圖表相關元素 ---
    const trafficChartCanvas = document.getElementById('traffic-chart');
    const chartLoadingMsg = document.getElementById('chart-loading-msg');
    const chartErrorMsg = document.getElementById('chart-error-msg');
    const btnDaily = document.getElementById('btn-daily');
    const btnMonthly = document.getElementById('btn-monthly');
    let currentChart = null;
    let currentGranularity = 'daily';

    // --- Function to Fetch and Display ALL Products in the Table ---
    async function fetchAndDisplayProducts() {
        if (!productListBody || !productListContainer || !productTable) {
            console.error("Admin page table elements not found.");
            if (loadingMessage) loadingMessage.textContent = '頁面結構錯誤，無法載入列表。';
            return;
        }

        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (productTable) productTable.style.display = 'none';

            const response = await fetch('/api/products');
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            }

            const products = await response.json();
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (productTable) productTable.style.display = 'table';

            productListBody.innerHTML = '';

            if (products.length === 0) {
                productListBody.innerHTML = '<tr><td colspan="7">目前沒有商品。</td></tr>';
                return;
            }

            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;
                
                // 計算總庫存
                const totalInventory = product.variations && product.variations.length > 0 
                    ? product.variations.reduce((sum, v) => sum + (v.inventory_count || 0), 0)
                    : 0;

                row.innerHTML = `
                    <td>${product.id}</td>
                    <td>${product.name || ''}</td>
                    <td>${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
                    <td>${totalInventory}</td>
                    <td>${product.click_count !== null ? product.click_count : '0'}</td>
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
            if (productTable) productTable.style.display = 'none';
        }
    }

    // --- Function to Open and Populate the Edit Modal ---
    async function openEditModal(id) {
        const requiredEditElements = [
            editModal, editForm, editProductId, editProductName, 
            editProductDescription, editProductPrice, editProductImageUrl, 
            editImagePreview, editProductSevenElevenUrl, editProductClickCount, 
            editFormError, editVariationsContainer
        ];

        if (requiredEditElements.some(el => !el)) {
            console.error("一個或多個編輯 Modal 元件在 HTML 中缺失。");
            alert("編輯視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。");
            return;
        }

        editFormError.textContent = '';
        editForm.reset();
        editImagePreview.style.display = 'none';
        editImagePreview.src = '';
        editVariationsContainer.innerHTML = '<p>正在載入規格...</p>';

        try {
            const response = await fetch(`/api/products/${id}`);
            if (!response.ok) {
                if (response.status === 404) throw new Error('找不到該商品。');
                throw new Error(`無法獲取商品資料 (HTTP ${response.status})`);
            }

            const product = await response.json();
            
            // 填充基本資料
            editProductId.value = product.id;
            editProductName.value = product.name || '';
            editProductDescription.value = product.description || '';
            editProductPrice.value = product.price !== null ? product.price : '';
            editProductImageUrl.value = product.image_url || '';
            editProductSevenElevenUrl.value = product.seven_eleven_url || '';
            editProductClickCount.textContent = product.click_count !== null ? product.click_count : '0';

            if (product.image_url) {
                editImagePreview.src = product.image_url;
                editImagePreview.style.display = 'block';
            } else {
                editImagePreview.style.display = 'none';
            }

            // 填充規格資料
            editVariationsContainer.innerHTML = '';
            if (product.variations && product.variations.length > 0) {
                product.variations.forEach(variation => {
                    addVariationRowToEditForm(
                        variation.id,
                        variation.name,
                        variation.inventory_count,
                        variation.sku
                    );
                });
            } else {
                editVariationsContainer.innerHTML = '<p>此商品尚未設定規格。</p>';
            }

            editModal.style.display = 'flex';
        } catch (error) {
            console.error(`獲取商品 ${id} 進行編輯時出錯:`, error);
            alert(`無法載入編輯資料： ${error.message}`);
        }
    }

    // --- Function to Add Variation Row to Edit Form ---
    function addVariationRowToEditForm(id, name = '', inventory = 0, sku = '') {
        const variationRow = document.createElement('div');
        variationRow.className = 'variation-row';
        variationRow.dataset.variationId = id || 'new';
        
        variationRow.innerHTML = `
            <input type="text" placeholder="規格名稱" value="${name || ''}" class="variation-name" required>
            <input type="number" placeholder="庫存數量" value="${inventory || 0}" min="0" class="variation-inventory" required>
            <input type="text" placeholder="SKU" value="${sku || ''}" class="variation-sku">
            <button type="button" class="remove-variation-btn" onclick="this.parentNode.remove()">移除</button>
            ${id ? `<button type="button" class="record-sale-btn" onclick="recordSale(${id})">記錄銷售</button>` : ''}
        `;
        
        editVariationsContainer.appendChild(variationRow);
    }

    // --- Function to Add Variation Row to Add Form ---
    function addVariationRowToAddForm() {
        const variationRow = document.createElement('div');
        variationRow.className = 'variation-row';
        
        variationRow.innerHTML = `
            <input type="text" placeholder="規格名稱" class="variation-name" required>
            <input type="number" placeholder="庫存數量" min="0" value="0" class="variation-inventory" required>
            <input type="text" placeholder="SKU" class="variation-sku">
            <button type="button" class="remove-variation-btn" onclick="this.parentNode.remove()">移除</button>
        `;
        
        addVariationsContainer.appendChild(variationRow);
    }

    // --- Function to Record Sale ---
    window.recordSale = async function(variationId) {
        const quantity = prompt('請輸入銷售數量:', '1');
        if (quantity === null) return;
        
        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) {
            alert('請輸入有效的正數數量');
            return;
        }

        try {
            const response = await fetch(`/api/products/variations/${variationId}/sales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    quantity: qty
                })
            });

            if (!response.ok) {
                throw new Error(`記錄銷售失敗 (HTTP ${response.status})`);
            }

            alert('銷售記錄成功！');
            // 刷新編輯表單以更新庫存
            const productId = editProductId.value;
            if (productId) {
                await openEditModal(productId);
            }
        } catch (error) {
            console.error('記錄銷售時出錯:', error);
            alert(`記錄銷售時發生錯誤: ${error.message}`);
        }
    };

    // --- Function to Close the Edit Modal ---
    window.closeModal = function() {
        if (editModal) {
            editModal.style.display = 'none';
        }
    };

    // --- Function to Close the Add Modal ---
    window.closeAddModal = function() {
        if (addModal) {
            addModal.style.display = 'none';
        }
    };

    // --- Attach Edit Function to Global Scope ---
    window.editProduct = function(id) {
        openEditModal(id);
    };

    // --- Attach Delete Function to Global Scope ---
    window.deleteProduct = async function(id) {
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) {
            try {
                const response = await fetch(`/api/products/${id}`, {
                    method: 'DELETE'
                });

                if (response.status === 204 || response.ok) {
                    await fetchAndDisplayProducts();
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
                alert(`刪除時發生錯誤：${error.message}`);
            }
        }
    };

    // --- Attach Show Add Form Function to Global Scope ---
    window.showAddForm = function() {
        const requiredAddElements = [
            addModal, addForm, addProductName, addProductDescription, 
            addProductPrice, addProductImageUrl, addProductSevenElevenUrl, 
            addFormError, addVariationsContainer
        ];

        if (requiredAddElements.some(el => !el)) {
            alert("新增視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。");
            return;
        }

        addFormError.textContent = '';
        addForm.reset();
        addVariationsContainer.innerHTML = '';
        addModal.style.display = 'flex';
    };

    // --- Attach Add Variation Function to Global Scope ---
    window.addVariation = function(isEditForm = false) {
        if (isEditForm) {
            addVariationRowToEditForm();
        } else {
            addVariationRowToAddForm();
        }
    };

    // --- Close Modals if User Clicks Outside of Modal Content ---
    window.onclick = function(event) {
        if (event.target == editModal) {
            closeModal();
        } else if (event.target == addModal) {
            closeAddModal();
        }
    };

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

            // 收集基本資料
            let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value);
            const updatedData = {
                name: editProductName.value.trim(),
                description: editProductDescription.value.trim(),
                price: priceValue,
                image_url: editProductImageUrl.value.trim() || null,
                seven_eleven_url: editProductSevenElevenUrl.value.trim() || null,
                variations: []
            };

            // 驗證基本資料
            if (!updatedData.name) {
                editFormError.textContent = '商品名稱不能為空。';
                return;
            }
            if (updatedData.price !== null && isNaN(updatedData.price)) {
                editFormError.textContent = '價格必須是有效的數字。';
                return;
            }
            if (updatedData.price !== null && updatedData.price < 0) {
                editFormError.textContent = '價格不能是負數。';
                return;
            }

            // 收集規格資料
            const variationRows = editVariationsContainer.querySelectorAll('.variation-row');
            variationRows.forEach(row => {
                const name = row.querySelector('.variation-name').value.trim();
                const inventory = parseInt(row.querySelector('.variation-inventory').value);
                const sku = row.querySelector('.variation-sku').value.trim();
                const variationId = row.dataset.variationId;

                if (name) {  // 只有名稱不為空的規格才會被提交
                    updatedData.variations.push({
                        id: variationId !== 'new' ? variationId : undefined,
                        name: name,
                        inventory_count: isNaN(inventory) ? 0 : inventory,
                        sku: sku || null
                    });
                }
            });

            try {
                const response = await fetch(`/api/products/${productId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updatedData)
                });

                if (!response.ok) {
                    let errorMsg = `儲存失敗 (HTTP ${response.status})`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorMsg;
                    } catch (e) {
                        // 忽略 JSON 解析錯誤
                    }
                    throw new Error(errorMsg);
                }

                closeModal();
                await fetchAndDisplayProducts();
            } catch (error) {
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

            // 收集基本資料
            let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value);
            const newProductData = {
                name: addProductName.value.trim(),
                description: addProductDescription.value.trim(),
                price: priceValue,
                image_url: addProductImageUrl.value.trim() || null,
                seven_eleven_url: addProductSevenElevenUrl.value.trim() || null,
                variations: []
            };

            // 驗證基本資料
            if (!newProductData.name) {
                addFormError.textContent = '商品名稱不能為空。';
                return;
            }
            if (newProductData.price !== null && isNaN(newProductData.price)) {
                addFormError.textContent = '價格必須是有效的數字。';
                return;
            }
            if (newProductData.price !== null && newProductData.price < 0) {
                addFormError.textContent = '價格不能是負數。';
                return;
            }

            // 收集規格資料
            const variationRows = addVariationsContainer.querySelectorAll('.variation-row');
            variationRows.forEach(row => {
                const name = row.querySelector('.variation-name').value.trim();
                const inventory = parseInt(row.querySelector('.variation-inventory').value);
                const sku = row.querySelector('.variation-sku').value.trim();

                if (name) {  // 只有名稱不為空的規格才會被提交
                    newProductData.variations.push({
                        name: name,
                        inventory_count: isNaN(inventory) ? 0 : inventory,
                        sku: sku || null
                    });
                }
            });

            try {
                const response = await fetch(`/api/products`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(newProductData)
                });

                if (!response.ok) {
                    let errorMsg = `新增失敗 (HTTP ${response.status})`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorMsg;
                    } catch (e) {
                        // 忽略 JSON 解析錯誤
                    }
                    throw new Error(errorMsg);
                }

                closeAddModal();
                await fetchAndDisplayProducts();
            } catch (error) {
                addFormError.textContent = `新增錯誤：${error.message}`;
            }
        });
    } else {
        console.error("新增表單元素未找到。");
    }

    // --- 圖表相關邏輯 ---

    /**
     * 獲取並繪製流量圖表
     * @param {string} granularity - 'daily' 或 'monthly'
     */
    async function displayTrafficChart(granularity = 'daily') {
        if (!trafficChartCanvas) {
            console.warn("找不到 traffic-chart canvas 元素。");
            return;
        }
        const ctx = trafficChartCanvas.getContext('2d');
        currentGranularity = granularity;

        if (chartLoadingMsg) chartLoadingMsg.style.display = 'block';
        if (chartErrorMsg) chartErrorMsg.style.display = 'none';
        if (currentChart) {
            currentChart.destroy();
            currentChart = null;
        }
        trafficChartCanvas.style.display = 'none';

        let apiUrl = '/api/analytics/traffic';
        if (granularity === 'monthly') {
            apiUrl = '/api/analytics/monthly-traffic';
        }

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                let errorMsg = `無法獲取流量數據 (HTTP ${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) {
                    // 忽略 JSON 解析錯誤
                }
                throw new Error(errorMsg);
            }

            const trafficData = await response.json();

            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
            trafficChartCanvas.style.display = 'block';

            if (trafficData.length === 0) {
                if (chartErrorMsg) {
                    chartErrorMsg.textContent = '（尚無流量數據）';
                    chartErrorMsg.style.display = 'block';
                    chartErrorMsg.style.color = '#888';
                }
                return;
            }

            const labels = trafficData.map(item => item.date || item.month);
            const dataPoints = trafficData.map(item => item.count);

            currentChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: granularity === 'daily' ? '每日頁面瀏覽量' : '每月頁面瀏覽量',
                        data: dataPoints,
                        borderColor: granularity === 'daily' ? 'rgb(54, 162, 235)' : 'rgb(255, 159, 64)',
                        backgroundColor: granularity === 'daily' ? 'rgba(54, 162, 235, 0.1)' : 'rgba(255, 159, 64, 0.1)',
                        fill: true,
                        tension: 0.2
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: granularity === 'daily' ? 1 : undefined
                            }
                        }
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: false
                        },
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    }
                }
            });
        } catch (error) {
            console.error(`繪製 ${granularity} 流量圖表失敗:`, error);
            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
            if (chartErrorMsg) {
                chartErrorMsg.textContent = `無法載入圖表: ${error.message}`;
                chartErrorMsg.style.display = 'block';
                chartErrorMsg.style.color = 'red';
            }
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
    } else {
        console.warn("找不到圖表切換按鈕。");
    }

    // --- Initial Load ---
    fetchAndDisplayProducts(); // 載入商品列表
    displayTrafficChart('daily'); // 預設載入每日流量圖表

    // 為新增規格按鈕添加事件監聽器
    if (addVariationBtn) {
        addVariationBtn.addEventListener('click', () => addVariation(false));
    }
    if (editVariationBtn) {
        editVariationBtn.addEventListener('click', () => addVariation(true));
    }
});