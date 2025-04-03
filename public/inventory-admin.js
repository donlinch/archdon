// public/inventory-admin.js (v2 - Fixed scope issue for coreElementsExist)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const productListBody = document.querySelector('#inventory-product-list-table tbody');
    const productListContainer = document.getElementById('inventory-product-list-container');
    const productTable = document.getElementById('inventory-product-list-table');
    const loadingMessage = productListContainer ? productListContainer.querySelector('p') : null;

    // --- 檢查元素是否存在 ---
    function checkElements(...elements) {
        const missingElementDetails = [];
        let allExist = true;
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
                 const errorDiv = document.createElement('div'); errorDiv.id = 'init-error-banner'; errorDiv.style.backgroundColor = 'red'; errorDiv.style.color = 'white'; errorDiv.style.padding = '15px'; errorDiv.style.textAlign = 'center'; errorDiv.style.fontWeight = 'bold'; errorDiv.style.position = 'fixed'; errorDiv.style.top = '0'; errorDiv.style.left = '0'; errorDiv.style.right = '0'; errorDiv.style.zIndex = '2000'; errorDiv.style.fontSize = '14px'; errorDiv.textContent = `頁面載入錯誤：${errorMessage}`; if (!document.getElementById('init-error-banner')) { document.body.insertBefore(errorDiv, document.body.firstChild); }
            }
        }
        return allExist;
    }

    // --- Function to Fetch and Display Products in the Inventory Table ---
    async function fetchAndDisplayInventoryProducts() {
        // **在函數內部再次檢查依賴的元素**
        if (!checkElements(productListBody, productListContainer, productTable, loadingMessage)) {
             console.error("無法獲取商品列表，缺少必要的 HTML 元素。");
             // 可以在此處更新 UI 狀態，例如顯示永久性錯誤訊息
             if(loadingMessage) loadingMessage.textContent = '頁面元素錯誤，無法載入列表。';
             if(productTable) productTable.style.display = 'none';
             return;
        }

        try {
            loadingMessage.style.display = 'block';
            productTable.style.display = 'none';
            productListBody.innerHTML = '';

            const response = await fetch('/api/products?sort=latest');
            if (!response.ok) {
                let errorMsg = `獲取商品資料失敗 (HTTP ${response.status})`;
                try { const data = await response.json(); errorMsg += `: ${data.error || ''}`; } catch(e){}
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
                const inventory = product.total_inventory !== undefined ? product.total_inventory : 'N/A';
                const lowStock = (inventory !== 'N/A' && inventory <= 5);

                row.innerHTML = `
                    <td>${product.id}</td>
                    <td title="${product.name || ''}">${product.name || '未命名商品'}</td>
                    <td style="text-align:center;">
                        <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="max-width: 60px; max-height: 60px; height: auto; border: 1px solid #eee; display: inline-block; vertical-align: middle; object-fit: contain;">
                    </td>
                    <td style="text-align:center;">${product.click_count !== null ? product.click_count : '0'}</td>
                    <td style="text-align:center; font-weight: ${lowStock ? 'bold' : 'normal'}; color: ${lowStock ? 'red' : 'inherit'};">
                        ${inventory}
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
        // **將核心元素檢查移到這裡**
        const coreElementsExist = checkElements(
            productListBody, productListContainer, productTable, loadingMessage
        );

        if (!coreElementsExist) {
            console.error("停止執行 inventory-admin.js 初始化，因缺少核心頁面元件。");
            return; // 如果核心元素缺失，不執行初始化
        }

        try {
            await fetchAndDisplayInventoryProducts(); // 獲取並顯示商品列表
            console.log("Inventory admin page initialized.");
        } catch (error) {
            console.error("庫存頁面初始化過程中發生錯誤:", error);
        }
    }

    initializeInventoryPage();

}); // --- End of DOMContentLoaded ---