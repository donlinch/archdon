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
                const potentialId = Object.keys(window).find(key => window[key] === elements[i]) || `元素索引 ${i}`;
                missingElementIds.push(potentialId);
                allExist = false;
            }
        }
        if (!allExist) {
            const errorMessage = `初始化錯誤：缺少必要的 DOM 元素。請檢查 HTML ID 是否正確。缺失的元素可能包括: ${missingElementIds.join(', ')}`;
            console.error(errorMessage);
            if (document.body) {
                const errorDiv = document.createElement('div');
                errorDiv.style.backgroundColor = 'red';
                errorDiv.style.color = 'white';
                errorDiv.style.padding = '10px';
                errorDiv.style.textAlign = 'center';
                errorDiv.style.fontWeight = 'bold';
                errorDiv.style.position = 'fixed';
                errorDiv.style.top = '0';
                errorDiv.style.left = '0';
                errorDiv.style.right = '0';
                errorDiv.style.zIndex = '2000';
                errorDiv.textContent = `頁面載入錯誤：${errorMessage}，部分功能可能無法運作。`;
                document.body.insertBefore(errorDiv, document.body.firstChild);
            }
        }
        return allExist;
    }

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
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (productTable) productTable.style.display = 'none';

            const response = await fetch('/api/products'); // API 只需返回基礎 products 表欄位
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
                    <td style="text-align:center;">
                        <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="max-width: 50px; max-height: 50px; height: auto; border: 1px solid #eee; display: inline-block; vertical-align: middle;">
                    </td>
                    <td style="text-align:center;">
                        <button class="action-btn edit-btn" onclick="window.editProduct(${product.id})">編輯</button>
                        <button class="action-btn delete-btn" onclick="window.deleteProduct(${product.id})">刪除</button>
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

    // --- Handle Add Form Submission (With Variations) ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!checkElements(addFormError, addProductName, addProductPrice, addVariationsContainer)) return;
            addFormError.textContent = '';

            // Collect basic product data
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

            // Collect variations data
            const variationRows = addVariationsContainer.querySelectorAll('.variation-input-row');
            variationRows.forEach((row, index) => {
                const name = row.querySelector(`input[name="variations[${index}][name]"]`).value.trim();
                const inventoryCount = parseInt(row.querySelector(`input[name="variations[${index}][inventory_count]"]`).value.trim());
                const sku = row.querySelector(`input[name="variations[${index}][sku]"]`).value.trim();

                if (name && !isNaN(inventoryCount)) {
                    newProductData.variations.push({ name, inventory_count: inventoryCount, sku });
                }
            });

            // Send request to backend
            const addButton = addForm.querySelector('.save-btn');
            if (addButton) addButton.disabled = true;
            try {
                const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newProductData)
                });
                if (!response.ok) {
                    let errorMsg = `新增失敗 (HTTP ${response.status})`;
                    try { const data = await response.json(); errorMsg += `: ${data.error || ''}`; } catch (e) {}
                    throw new Error(errorMsg);
                }
                closeAddModal();
                await fetchAndDisplayProducts();
            } catch (error) {
                addFormError.textContent = `新增錯誤：${error.message}`;
            } finally {
                if (addButton) addButton.disabled = false;
            }
        });
    }

    // --- Initial Page Load ---
    async function initializePage() {
        if (!coreElementsExist) return;
        try {
            await fetchAndDisplayProducts();
            console.log("Admin page initialized.");
        } catch (error) {
            console.error("頁面初始化過程中發生錯誤:", error);
        }
    }

    initializePage();
}); // --- End of DOMContentLoaded ---
