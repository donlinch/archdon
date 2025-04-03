// public/inventory-admin.js (v9 - Fixed Syntax Error in variations check)
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
            const response = await fetch('/api/products?sort=latest');
            if (!response.ok) { let errorMsg = `獲取商品資料失敗 (HTTP ${response.status})`; try { const data = await response.json(); errorMsg += `: ${data.error || ''}`; } catch(e){} throw new Error(errorMsg); }
            const products = await response.json();
            loadingMessage.style.display = 'none'; productTable.style.display = 'table';
            if (products.length === 0) { productListBody.innerHTML = '<tr><td colspan="5">目前沒有商品資料。</td></tr>'; return; }

            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;
                row.dataset.productName = product.name || '';

                let inventoryHtml = 'N/A';
                // **修正: 補上右括號 ')'**
                if (product.variations && Array.isArray(product.variations)) { // <<<< 修正處
                    if (product.variations.length > 0) {
                        inventoryHtml = product.variations
                            .map(variation => {
                                const count = variation.inventory_count !== undefined ? variation.inventory_count : '未知';
                                const lowStock = (count !== '未知' && count <= 5);
                                const variationId = variation.id;
                                return `
                                    <div class="variation-display-item" data-variation-id="${variationId}" data-current-inventory="${count}" style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0;">
                                        <span style="font-weight: ${lowStock ? 'bold' : 'normal'}; color: ${lowStock ? 'red' : 'inherit'};">
                                            ${variation.name || '未命名'}: <span class="inventory-count-text">${count}</span>
                                        </span>
                                        <button class="action-btn edit-inventory-btn" style="padding: 2px 6px; font-size: 0.8em; background-color:#6c757d; color:white; border:none;" title="編輯此規格庫存">編輯</button>
                                    </div>
                                    <div class="variation-edit-item" data-variation-id="${variationId}" style="display: none; padding: 3px 0;">
                                        <input type="number" class="inventory-edit-input" value="${count}" min="0" style="width: 60px; text-align: center; padding: 4px; border: 1px solid #ccc; border-radius: 3px; margin-right: 5px;">
                                        <button class="action-btn save-inventory-btn" style="padding: 2px 6px; font-size: 0.8em; background-color:#28a745; color:white; border:none;">保存</button>
                                        <button class="action-btn cancel-inventory-btn" style="padding: 2px 6px; font-size: 0.8em; background-color:#dc3545; color:white; border:none; margin-left: 3px;">取消</button>
                                        <span class="edit-inventory-status" style="font-size: 0.8em; margin-left: 5px; color: grey;"></span>
                                    </div>
                                `;
                            })
                            .join('');
                    }
                } else if (product.total_inventory !== undefined) { // 保持對舊 API 返回值的兼容 (如果需要)
                    const lowStock = (product.total_inventory <= 5);
                    inventoryHtml = `<div class="variation-display-item" data-current-inventory="${product.total_inventory}"><span style="font-weight: ${lowStock ? 'bold' : 'normal'}; color: ${lowStock ? 'red' : 'inherit'};">總庫存: ${product.total_inventory}</span></div>`;
                }

                row.innerHTML = `
                    <td>${product.id}</td>
                    <td title="${product.name || ''}">${product.name || '未命名商品'}</td>
                    <td style="text-align:center;"><img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="max-width: 60px; max-height: 60px; border: 1px solid #eee; object-fit: contain; vertical-align: middle;"></td>
                    <td style="text-align:center;">${product.click_count !== null ? product.click_count : '0'}</td>
                    <td class="inventory-cell" style="text-align:left; line-height: 1.5; padding-left: 15px; white-space: normal; vertical-align: top;">${inventoryHtml}</td>
                `;
                productListBody.appendChild(row);
            });
        } catch (error) { console.error("獲取商品庫存列表失敗:", error); if (loadingMessage) loadingMessage.textContent = `無法載入商品資料: ${error.message}`; if (productTable) productTable.style.display = 'none'; productListBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center; padding: 1rem;">加載失敗...</td></tr>`; }
    }

    // --- 庫存編輯相關功能 ---
    function showEditInventoryInput(displayItem) { const editItem = displayItem.nextElementSibling; if (editItem && editItem.classList.contains('variation-edit-item')) { displayItem.style.display = 'none'; editItem.style.display = 'flex'; editItem.querySelector('.inventory-edit-input').focus(); editItem.querySelector('.edit-inventory-status').textContent = ''; } }
    function hideEditInventoryInput(editItem) { const displayItem = editItem.previousElementSibling; if (displayItem && displayItem.classList.contains('variation-display-item')) { editItem.style.display = 'none'; displayItem.style.display = 'flex'; const currentInventory = displayItem.dataset.currentInventory; editItem.querySelector('.inventory-edit-input').value = currentInventory; } }
    async function saveInventoryChange(editItem) { const input = editItem.querySelector('.inventory-edit-input'); const statusSpan = editItem.querySelector('.edit-inventory-status'); const variationId = editItem.dataset.variationId; const displayItem = editItem.previousElementSibling; const countTextSpan = displayItem ? displayItem.querySelector('.inventory-count-text') : null; if (!input || !variationId || !statusSpan) return; const newInventoryStr = input.value.trim(); const newInventoryCount = parseInt(newInventoryStr); if (isNaN(newInventoryCount) || newInventoryCount < 0) { statusSpan.textContent = '無效!'; statusSpan.style.color = 'red'; input.focus(); return; } const saveButton = editItem.querySelector('.save-inventory-btn'); const cancelButton = editItem.querySelector('.cancel-inventory-btn'); if(saveButton) saveButton.disabled = true; if(cancelButton) cancelButton.disabled = true; statusSpan.textContent = '保存中...'; statusSpan.style.color = 'grey'; try { const response = await fetch(`/api/admin/variations/${variationId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inventory_count: newInventoryCount }) }); if (!response.ok) { let errorMsg = `保存失敗(${response.status})`; try{ const data = await response.json(); errorMsg += `: ${data.error || ''}`;} catch(e){} throw new Error(errorMsg); } const updatedVariation = await response.json(); if (countTextSpan) countTextSpan.textContent = updatedVariation.inventory_count; if (displayItem) displayItem.dataset.currentInventory = updatedVariation.inventory_count; const lowStock = (updatedVariation.inventory_count !== undefined && updatedVariation.inventory_count <= 5); const nameAndCountSpan = displayItem?.querySelector('span:first-child'); if(nameAndCountSpan) { nameAndCountSpan.style.fontWeight = lowStock ? 'bold' : 'normal'; nameAndCountSpan.style.color = lowStock ? 'red' : 'inherit'; } statusSpan.textContent = '已保存!'; statusSpan.style.color = 'green'; setTimeout(() => hideEditInventoryInput(editItem), 1500); } catch (error) { console.error(`保存規格 ${variationId} 庫存失敗:`, error); statusSpan.textContent = `錯誤!`; statusSpan.style.color = 'red'; } finally { if(saveButton) saveButton.disabled = false; if(cancelButton) cancelButton.disabled = false; } }

    // --- 事件監聽器 ---
    if (productListBody) {
        productListBody.addEventListener('click', async (event) => { const target = event.target; if (target.classList.contains('edit-inventory-btn')) { const displayItem = target.closest('.variation-display-item'); if (displayItem) { showEditInventoryInput(displayItem); } } else if (target.classList.contains('save-inventory-btn')) { const editItem = target.closest('.variation-edit-item'); if (editItem) { await saveInventoryChange(editItem); } } else if (target.classList.contains('cancel-inventory-btn')) { const editItem = target.closest('.variation-edit-item'); if (editItem) { hideEditInventoryInput(editItem); } } });
        productListBody.addEventListener('keypress', async (event) => { if (event.key === 'Enter' && event.target.classList.contains('inventory-edit-input')) { event.preventDefault(); const editItem = event.target.closest('.variation-edit-item'); if (editItem) { await saveInventoryChange(editItem); } } });
    }

    // --- Initial Page Load ---
    async function initializeInventoryPage() { if (!coreElementsExist) return; try { await fetchAndDisplayInventoryProducts(); console.log("Inventory admin page initialized (v9 - Fixed Syntax Error)."); } catch (error) { console.error("庫存頁面初始化過程中發生錯誤:", error); if (loadingMessage) loadingMessage.textContent = `頁面初始化錯誤: ${error.message}`; if (productTable) productTable.style.display = 'none'; if (productListBody) productListBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center; padding: 1rem;">頁面初始化失敗。</td></tr>`; } }
    initializeInventoryPage();

}); // --- End of DOMContentLoaded ---