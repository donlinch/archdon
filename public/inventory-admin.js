// public/inventory-admin.js (整合版 - 顯示 Variations 列表並保留點擊功能)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const productListBody = document.querySelector('#inventory-product-list-table tbody');
    const productListContainer = document.getElementById('inventory-product-list-container');
    const productTable = document.getElementById('inventory-product-list-table');
    const loadingMessage = productListContainer ? productListContainer.querySelector('p') : null;

    // --- 檢查元素是否存在 ---
    function checkElements(...elements) {
        const missingElementDetails = []; let allExist = true;
        const elementMap = { 
            [productListBody]: '#inventory-product-list-table tbody', 
            [productListContainer]: '#inventory-product-list-container', 
            [productTable]: '#inventory-product-list-table', 
            [loadingMessage]: '#inventory-product-list-container p' 
        };
        
        elements.forEach((el, index) => { 
            if (!el) { 
                const elementDesc = Object.entries(elementMap).find(([keyRef]) => keyRef === el)?.[1] || `未知元素 (索引 ${index})`; 
                missingElementDetails.push(elementDesc); 
                allExist = false; 
            } 
        });
        
        if (!allExist) { 
            const errorMessage = `初始化錯誤：缺少必要的 DOM 元素: ${missingElementDetails.join(', ')}。請檢查 inventory-admin.html。`; 
            console.error(errorMessage); 
            if (document.body) { 
                const errorDiv = document.createElement('div'); 
                errorDiv.id = 'init-error-banner'; 
                errorDiv.style.backgroundColor = 'red'; 
                errorDiv.style.color = 'white'; 
                errorDiv.style.padding = '15px'; 
                errorDiv.style.textAlign = 'center'; 
                errorDiv.style.fontWeight = 'bold'; 
                errorDiv.style.position = 'fixed'; 
                errorDiv.style.top = '0'; 
                errorDiv.style.left = '0'; 
                errorDiv.style.right = '0'; 
                errorDiv.style.zIndex = '2000'; 
                errorDiv.style.fontSize = '14px'; 
                errorDiv.textContent = `頁面載入錯誤：${errorMessage}`; 
                if (!document.getElementById('init-error-banner')) { 
                    document.body.insertBefore(errorDiv, document.body.firstChild); 
                } 
            } 
        }
        return allExist;
    }
    
    // 執行核心元素檢查
    const coreElementsExist = checkElements(productListBody, productListContainer, productTable, loadingMessage);
    if (!coreElementsExist) { 
        console.error("停止執行 inventory-admin.js，因缺少核心頁面元件。"); 
        return; 
    }

    // --- Function to Fetch and Display Products in the Inventory Table ---
    async function fetchAndDisplayInventoryProducts() {
        if (!checkElements(productListBody, productListContainer, productTable, loadingMessage)) return;

        try {
            loadingMessage.style.display = 'block'; 
            productTable.style.display = 'none'; 
            productListBody.innerHTML = '';

            // API 現在應該返回 variations 陣列 [{name: 'S', inventory_count: 10}, ...]
            const response = await fetch('/api/products?sort=latest');
            if (!response.ok) { 
                let errorMsg = `獲取商品資料失敗 (HTTP ${response.status})`; 
                try { 
                    const data = await response.json(); 
                    errorMsg += `: ${data.error || ''}`; 
                } catch(e){}
                throw new Error(errorMsg); 
            }
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
                row.dataset.productName = product.name || '';
                row.style.cursor = 'pointer';

                // 處理規格和庫存顯示
                let inventoryHtml = 'N/A'; // 預設值
                if (product.variations && Array.isArray(product.variations) {
                    if (product.variations.length > 0) {
                        inventoryHtml = product.variations
                            .map(variation => {
                                const count = variation.inventory_count !== undefined ? variation.inventory_count : '未知';
                                const lowStock = (count !== '未知' && count <= 5); // 低庫存判斷
                                // 返回 HTML 字串，低庫存時加粗和紅色
                                return `<span style="font-weight: ${lowStock ? 'bold' : 'normal'}; color: ${lowStock ? 'red' : 'inherit'};">${variation.name || '未命名'}: ${count}</span>`;
                            })
                            .join('<br>'); // 使用 <br> 換行
                    }
                } else if (product.total_inventory !== undefined) {
                    // 保留舊版單一庫存顯示的兼容性
                    const lowStock = (product.total_inventory <= 5);
                    inventoryHtml = `<span style="font-weight: ${lowStock ? 'bold' : 'normal'}; color: ${lowStock ? 'red' : 'inherit'};">${product.total_inventory}</span>`;
                }

                // 渲染表格行 (5個 td)
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td title="${product.name || ''}">${product.name || '未命名商品'}</td>
                    <td style="text-align:center;">
                        <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="max-width: 60px; max-height: 60px; border: 1px solid #eee; object-fit: contain; vertical-align: middle;">
                    </td>
                    <td style="text-align:center;">${product.click_count !== null ? product.click_count : '0'}</td>
                    <td style="text-align:left; white-space: normal; line-height: 1.5; padding-left: 15px;">
                        ${inventoryHtml} <!-- 顯示規格名稱和庫存 -->
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

    // --- 處理商品行點擊事件 ---
    async function handleProductRowClick(event) {
        const row = event.target.closest('tr');
        if (!row || !row.dataset.productId) return;

        const productId = row.dataset.productId;
        const productName = row.dataset.productName;

        console.log(`點擊了商品 ID: ${productId}, 名稱: ${productName}`);

        // 顯示載入提示或禁用點擊，防止重複觸發
        row.style.opacity = '0.7'; // 視覺提示
        const originalCursor = row.style.cursor;
        row.style.cursor = 'wait';

        try {
            const response = await fetch(`/api/products/${productId}`); // API 應包含 variations
            if (!response.ok) { 
                throw new Error(`獲取商品 ${productId} 詳情失敗 (HTTP ${response.status})`); 
            }
            const productDetails = await response.json();
            console.log('獲取的規格詳情:', productDetails.variations);

            // 用 Alert 顯示 (暫時)
            if (productDetails.variations && productDetails.variations.length > 0) {
                alert(`商品 "${productName}" 的規格與庫存：\n${productDetails.variations.map(v => `${v.name}: ${v.inventory_count}`).join('\n')}`);
            } else {
                alert(`商品 "${productName}" 尚無規格資料。`);
            }

        } catch (error) {
            console.error(`處理商品 ${productId} 點擊時出錯:`, error);
            alert(`無法獲取商品詳情：${error.message}`);
        } finally {
            // 恢復行的外觀和可點擊狀態
            row.style.opacity = '1';
            row.style.cursor = originalCursor;
        }
    }

    // --- 為表格 tbody 添加事件委派監聽器 ---
    if (productListBody) {
        productListBody.addEventListener('click', handleProductRowClick);
    }

    // --- Initial Page Load ---
    async function initializeInventoryPage() {
        if (!coreElementsExist) return;
        try {
            await fetchAndDisplayInventoryProducts();
            console.log("Inventory admin page initialized (整合版 - 顯示 Variations 列表並保留點擊功能)");
        } catch (error) {
            console.error("庫存頁面初始化過程中發生錯誤:", error);
        }
    }

    initializeInventoryPage();
}); // --- End of DOMContentLoaded ---