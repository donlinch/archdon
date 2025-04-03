// public/inventory-admin.js (v9 - Inline Inventory Editing Implemented)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const productListBody = document.querySelector('#inventory-product-list-table tbody');
    const productListContainer = document.getElementById('inventory-product-list-container');
    const productTable = document.getElementById('inventory-product-list-table');
    const loadingMessage = productListContainer ? productListContainer.querySelector('p') : null;

    // --- 檢查元素是否存在 ---
    function checkElements(...elements) {
        const missingElementDetails = []; let allExist = true;
        const elementMap = { [productListBody]: '#inventory-product-list-table tbody', [productListContainer]: '#inventory-product-list-container', [productTable]: '#inventory-product-list-table', [loadingMessage]: '#inventory-product-list-container p' };
        elements.forEach((el, index) => { if (!el) { const elementDesc = Object.entries(elementMap).find(([keyRef]) => keyRef === el)?.[1] || `未知元素 (索引 ${index})`; missingElementDetails.push(elementDesc); allExist = false; } });
        if (!allExist) { const errorMessage = `初始化錯誤：缺少必要的 DOM 元素: ${missingElementDetails.join(', ')}。請檢查 inventory-admin.html。`; console.error(errorMessage); if (document.body) { const errorDiv = document.createElement('div'); errorDiv.id = 'init-error-banner'; errorDiv.style.backgroundColor = 'red'; errorDiv.style.color = 'white'; errorDiv.style.padding = '15px'; errorDiv.style.textAlign = 'center'; errorDiv.style.fontWeight = 'bold'; errorDiv.style.position = 'fixed'; errorDiv.style.top = '0'; errorDiv.style.left = '0'; errorDiv.style.right = '0'; errorDiv.style.zIndex = '2000'; errorDiv.style.fontSize = '14px'; errorDiv.textContent = `頁面載入錯誤：${errorMessage}`; if (!document.getElementById('init-error-banner')) { document.body.insertBefore(errorDiv, document.body.firstChild); } } }
        return allExist;
    }
    const coreElementsExist = checkElements(productListBody, productListContainer, productTable, loadingMessage);
    if (!coreElementsExist) { console.error("停止執行 inventory-admin.js，因缺少核心頁面元件。"); return; }

    // --- Function to Fetch and Display Products in the Inventory Table ---
    async function fetchAndDisplayInventoryProducts() {
        if (!checkElements(productListBody, productListContainer, productTable, loadingMessage)) return;

        try {
            loadingMessage.style.display = 'block'; productTable.style.display = 'none'; productListBody.innerHTML = '';
            const response = await fetch('/api/products?sort=latest'); // API 應返回 variations 數組 [{id, name, inventory_count}]
            if (!response.ok) { let errorMsg = `獲取商品資料失敗 (HTTP ${response.status})`; try { const data = await response.json(); errorMsg += `: ${data.error || ''}`; } catch(e){} throw new Error(errorMsg); }
            const products = await response.json();
            loadingMessage.style.display = 'none'; productTable.style.display = 'table';

            if (products.length === 0) { productListBody.innerHTML = '<tr><td colspan="5">目前沒有商品資料。</td></tr>'; return; } // Colspan 5

            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;

                // --- 渲染規格和庫存，並加入編輯功能 ---
                let inventoryHtml = 'N/A';
                if (product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
                    inventoryHtml = product.variations
                        .map(variation => {
                            const count = variation.inventory_count !== undefined ? variation.inventory_count : '未知';
                            const lowStock = (count !== '未知' && count <= 5);
                            const variationId = variation.id;

                            // 為每個規格創建一個容器 div
                            // data-variation-id 和 data-current-inventory 用於 JS 操作
                            return `
                                <div class="variation-row-container" style="margin-bottom: 5px;"> <!-- 包裹顯示和編輯區 -->
                                    <div class="variation-display-item" data-variation-id="${variationId}" data-current-inventory="${count}" style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0;">
                                        <span style="font-weight: ${lowStock ? 'bold' : 'normal'}; color: ${lowStock ? 'red' : 'inherit'};">
                                            ${variation.name || '未命名'}: <span class="inventory-count-text">${count}</span>
                                        </span>
                                        <button class="action-btn edit-inventory-btn" style="padding: 2px 6px; font-size: 0.8em; background-color:#6c757d; color:white; border:none;" title="編輯此規格庫存">編輯</button>
                                    </div>
                                    <div class="variation-edit-item" data-variation-id="${variationId}" style="display: none; padding: 3px 0; align-items: center; gap: 5px;"> <!-- 使用 flex 佈局編輯區 -->
                                        <span style="font-weight: bold;">${variation.name || '未命名'}:</span>
                                        <input type="number" class="inventory-edit-input" value="${count}" min="0" style="width: 60px; text-align: center; padding: 4px; border: 1px solid #ccc; border-radius: 3px;">
                                        <button class="action-btn save-inventory-btn" style="padding: 2px 6px; font-size: 0.8em; background-color:#28a745; color:white; border:none;">保存</button>
                                        <button class="action-btn cancel-inventory-btn" style="padding: 2px 6px; font-size: 0.8em; background-color:#dc3545; color:white; border:none;">取消</button>
                                        <span class="edit-inventory-status" style="font-size: 0.8em; margin-left: 5px; color: grey; flex-grow: 1; text-align: right;"></span> <!-- 狀態訊息 -->
                                    </div>
                                </div>
                            `;
                        })
                        .join('');
                }

                // 渲染表格行 (5個 td)
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td title="${product.name || ''}">${product.name || '未命名商品'}</td>
                    <td style="text-align:center;">
                        <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="max-width: 60px; max-height: 60px; border: 1px solid #eee; object-fit: contain; vertical-align: middle;">
                    </td>
                    <td style="text-align:center;">${product.click_count !== null ? product.click_count : '0'}</td>
                    <td class="inventory-cell" style="text-align:left; line-height: 1.5; padding-left: 15px; white-space: normal; vertical-align: top;">
                        ${inventoryHtml}
                    </td>
                `;
                productListBody.appendChild(row);
            });
        } catch (error) {
            console.error("獲取商品庫存列表失敗:", error);
            if (loadingMessage) loadingMessage.textContent = `無法載入商品資料: ${error.message}`;
            if (productTable) productTable.style.display = 'none';
            productListBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center; padding: 1rem;">加載失敗，請檢查網絡或聯繫管理員。</td></tr>`;
        }
    }

    // --- 庫存編輯相關功能 ---
    function showEditInventoryInput(displayItem) {
        const container = displayItem.closest('.variation-row-container');
        if (!container) return;
        const editItem = container.querySelector('.variation-edit-item');
        if (editItem) {
            displayItem.style.display = 'none';
            editItem.style.display = 'flex'; // 確保編輯區是 flex 佈局
            const input = editItem.querySelector('.inventory-edit-input');
            if (input) {
                input.focus(); // 聚焦輸入框
                input.select(); // 全選內容方便修改
            }
            const statusSpan = editItem.querySelector('.edit-inventory-status');
            if(statusSpan) statusSpan.textContent = ''; // 清除舊狀態
        }
    }

    function hideEditInventoryInput(editItem) {
        const container = editItem.closest('.variation-row-container');
        if (!container) return;
        const displayItem = container.querySelector('.variation-display-item');
        if (displayItem) {
            editItem.style.display = 'none';
            displayItem.style.display = 'flex'; // 恢復顯示
            const currentInventory = displayItem.dataset.currentInventory; // 從 data 屬性恢復
            const input = editItem.querySelector('.inventory-edit-input');
            if(input) input.value = currentInventory; // 重置輸入框的值
        }
    }

    async function saveInventoryChange(editItem) {
        const input = editItem.querySelector('.inventory-edit-input');
        const statusSpan = editItem.querySelector('.edit-inventory-status');
        const variationId = editItem.dataset.variationId;
        const container = editItem.closest('.variation-row-container');
        const displayItem = container ? container.querySelector('.variation-display-item') : null;
        const countTextSpan = displayItem ? displayItem.querySelector('.inventory-count-text') : null;

        if (!input || !variationId || !statusSpan || !displayItem || !countTextSpan) {
            console.error("保存庫存時缺少必要的元素引用");
            if(statusSpan) { statusSpan.textContent = '內部錯誤'; statusSpan.style.color = 'red'; }
            return;
        }

        const newInventoryStr = input.value.trim();
        const newInventoryCount = parseInt(newInventoryStr);

        if (isNaN(newInventoryCount) || newInventoryCount < 0) { statusSpan.textContent = '無效數量!'; statusSpan.style.color = 'red'; input.focus(); return; }

        const saveButton = editItem.querySelector('.save-inventory-btn');
        const cancelButton = editItem.querySelector('.cancel-inventory-btn');
        if(saveButton) saveButton.disabled = true; if(cancelButton) cancelButton.disabled = true;
        statusSpan.textContent = '保存中...'; statusSpan.style.color = 'grey';

        try {
            const response = await fetch(`/api/admin/variations/${variationId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inventory_count: newInventoryCount }) });
            if (!response.ok) { let errorMsg = `保存失敗(${response.status})`; try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){} throw new Error(errorMsg); }
            const updatedVariation = await response.json();

            // 更新成功
            countTextSpan.textContent = updatedVariation.inventory_count; // 更新顯示的數字
            displayItem.dataset.currentInventory = updatedVariation.inventory_count; // 更新 data 屬性

            // 更新低庫存樣式
            const lowStock = (updatedVariation.inventory_count !== undefined && updatedVariation.inventory_count <= 5);
            const nameAndCountSpan = displayItem.querySelector('span:first-child');
            if(nameAndCountSpan) { nameAndCountSpan.style.fontWeight = lowStock ? 'bold' : 'normal'; nameAndCountSpan.style.color = lowStock ? 'red' : 'inherit'; }

            statusSpan.textContent = '已保存!'; statusSpan.style.color = 'green';
            setTimeout(() => hideEditInventoryInput(editItem), 1500); // 延遲後自動隱藏編輯

            // **需要重新計算並更新該商品的總庫存**
            const productId = displayItem.closest('tr')?.dataset.productId;
            if (productId) {
                 await updateProductTotalInventoryInRow(productId);
            }


        } catch (error) { console.error(`保存規格 ${variationId} 庫存失敗:`, error); statusSpan.textContent = `錯誤!`; statusSpan.style.color = 'red'; }
         finally { if(saveButton) saveButton.disabled = false; if(cancelButton) cancelButton.disabled = false; }
    }

    // --- **新增: 更新指定商品行的總庫存顯示** ---
    async function updateProductTotalInventoryInRow(productId) {
        if (!productListBody) return;
        const row = productListBody.querySelector(`tr[data-product-id="${productId}"]`);
        if (!row) return;

        const inventoryCell = row.querySelector('td:nth-child(5)'); // 第 5 個單元格是庫存欄 (根據 HTML 結構)
        if (!inventoryCell) return;

        try {
            // 重新從 API 獲取該商品的最新資料 (包含 total_inventory)
            // 或者，如果 API 能只返回總庫存會更高效
            const response = await fetch(`/api/products/${productId}`); // 假設此 API 返回的 product 對象中有 total_inventory
            if (!response.ok) { console.error(`無法重新獲取商品 ${productId} 資料以更新總庫存`); return; }
            const product = await response.json();

            const totalInventory = product.total_inventory !== undefined ? product.total_inventory : 'N/A';
            const lowStock = (totalInventory !== 'N/A' && totalInventory <= 5);

             inventoryCell.textContent = totalInventory;
             inventoryCell.style.fontWeight = lowStock ? 'bold' : 'normal';
             inventoryCell.style.color = lowStock ? 'red' : 'inherit';
             console.log(`商品 ${productId} 的總庫存已更新為 ${totalInventory}`);

        } catch(error) {
            console.error(`更新商品 ${productId} 總庫存顯示時出錯:`, error);
            if(inventoryCell) inventoryCell.textContent = '錯誤'; // 標示更新失敗
        }
    }


    // --- 事件監聽器 ---
    if (productListBody) {
        productListBody.addEventListener('click', async (event) => {
            const target = event.target;
            if (target.classList.contains('edit-inventory-btn')) { const displayItem = target.closest('.variation-display-item'); if (displayItem) { showEditInventoryInput(displayItem); } }
            else if (target.classList.contains('save-inventory-btn')) { const editItem = target.closest('.variation-edit-item'); if (editItem) { await saveInventoryChange(editItem); } }
            else if (target.classList.contains('cancel-inventory-btn')) { const editItem = target.closest('.variation-edit-item'); if (editItem) { hideEditInventoryInput(editItem); } }
            // 可以移除之前的行點擊 alert 邏輯
            // else { const row = target.closest('tr'); if (row && row.dataset.productId) { /* handleProductRowClick(event); */ } }
        });
        productListBody.addEventListener('keypress', async (event) => { if (event.key === 'Enter' && event.target.classList.contains('inventory-edit-input')) { event.preventDefault(); const editItem = event.target.closest('.variation-edit-item'); if (editItem) { await saveInventoryChange(editItem); } } });
    }

    // --- Initial Page Load ---
    async function initializeInventoryPage() { if (!coreElementsExist) return; try { await fetchAndDisplayInventoryProducts(); console.log("Inventory admin page initialized (v9 - Inline Inventory Editing)."); } catch (error) { console.error("庫存頁面初始化過程中發生錯誤:", error); /* ... */ } }
    initializeInventoryPage();

}); // --- End of DOMContentLoaded ---