// public/inventory-admin.js (v7 - Fixed Syntax Error in initialize function)
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
    // 在頂層檢查一次，以便後續函數可以假設元素存在 (如果檢查通過)
    const coreElementsExist = checkElements(productListBody, productListContainer, productTable, loadingMessage);
    // 如果核心列表元素缺失，則不繼續執行任何操作
    if (!coreElementsExist) {
         console.error("停止執行 inventory-admin.js，因缺少核心列表元件。");
         return;
     }

    // --- Function to Fetch and Display Products in the Inventory Table ---
    async function fetchAndDisplayInventoryProducts() {
        // 函數內不再重複檢查核心列表元素，假設頂層檢查已通過
        try {
            loadingMessage.style.display = 'block';
            productTable.style.display = 'none';
            productListBody.innerHTML = '';

            const response = await fetch('/api/products?sort=latest'); // API 應返回 variations 數組
            if (!response.ok) { let errorMsg = `獲取商品資料失敗 (HTTP ${response.status})`; try { const data = await response.json(); errorMsg += `: ${data.error || ''}`; } catch(e){} throw new Error(errorMsg); }
            const products = await response.json();

            loadingMessage.style.display = 'none';
            productTable.style.display = 'table';

            if (products.length === 0) {
                productListBody.innerHTML = '<tr><td colspan="5">目前沒有商品資料。</td></tr>';
                return;
            }

            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;

                let inventoryHtml = 'N/A'; // 預設
                if (product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
                    inventoryHtml = product.variations
                        .map(variation => {
                            const count = variation.inventory_count !== undefined ? variation.inventory_count : '未知';
                            const lowStock = (count !== '未知' && count <= 5);
                            return `<span style="font-weight: ${lowStock ? 'bold' : 'normal'}; color: ${lowStock ? 'red' : 'inherit'}; display: block;">${variation.name || '未命名'}: ${count}</span>`; // 使用 display: block 確保換行
                        })
                        .join(''); // 不需要 <br> 了，因為 span 是 block
                }

                row.innerHTML = `
                    <td>${product.id}</td>
                    <td title="${product.name || ''}">${product.name || '未命名商品'}</td>
                    <td style="text-align:center;">
                        <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="max-width: 60px; max-height: 60px; border: 1px solid #eee; object-fit: contain; vertical-align: middle;">
                    </td>
                    <td style="text-align:center;">${product.click_count !== null ? product.click_count : '0'}</td>
                    <td style="text-align:left; line-height: 1.5; padding-left: 15px; white-space: normal;"> <!-- white-space:normal 配合 display:block -->
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

    // --- Initial Page Load ---
    async function initializeInventoryPage() {
        // 頂層檢查已完成，這裡無需重複
        // if (!coreElementsExist) return;
        try {
            await fetchAndDisplayInventoryProducts();
            console.log("Inventory admin page initialized (v7 - Fixed Syntax Error).");
        } catch (error) {
            console.error("庫存頁面初始化過程中發生錯誤:", error);
            // 可以考慮在這裡也顯示一個錯誤訊息給用戶，以防 fetch 失敗
             if (loadingMessage) loadingMessage.textContent = `頁面初始化錯誤: ${error.message}`;
             if (productTable) productTable.style.display = 'none';
             if (productListBody) productListBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center; padding: 1rem;">頁面初始化失敗。</td></tr>`;
        }
        // **移除多餘的 '}'**
    } // <--- initializeInventoryPage 函數結束括號

    initializeInventoryPage();

}); // --- End of DOMContentLoaded ---