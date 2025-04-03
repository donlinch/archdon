// public/inventory-admin.js (v4 - Show Total Inventory, Click Handler Prep)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const productListBody = document.querySelector('#inventory-product-list-table tbody');
    const productListContainer = document.getElementById('inventory-product-list-container');
    const productTable = document.getElementById('inventory-product-list-table');
    const loadingMessage = productListContainer ? productListContainer.querySelector('p') : null;

    // --- 檢查元素是否存在 ---
    function checkElements(...elements) { /* ... (同上次) ... */ return true; }
    if (!checkElements(productListBody, productListContainer, productTable, loadingMessage)) {
        console.error("停止執行 inventory-admin.js，因缺少核心頁面元件。");
        return;
    }

    // --- Function to Fetch and Display Products in the Inventory Table ---
    async function fetchAndDisplayInventoryProducts() {
        if (!checkElements(productListBody, productListContainer, productTable, loadingMessage)) return;

        try {
            loadingMessage.style.display = 'block'; productTable.style.display = 'none'; productListBody.innerHTML = '';
            const response = await fetch('/api/products?sort=latest'); // 獲取包含 total_inventory 的數據
            if (!response.ok) { throw new Error(`HTTP ${response.status}`); }
            const products = await response.json();
            loadingMessage.style.display = 'none'; productTable.style.display = 'table';

            if (products.length === 0) { productListBody.innerHTML = '<tr><td colspan="5">目前沒有商品資料。</td></tr>'; return; }

            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;
                row.dataset.productName = product.name || ''; // 儲存名稱供點擊使用
                row.style.cursor = 'pointer'; // 添加手型指標提示可點擊

                const inventory = product.total_inventory !== undefined ? product.total_inventory : 'N/A';
                const lowStock = (inventory !== 'N/A' && inventory <= 5);

                // **顯示 total_inventory**
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td title="${product.name || ''}">${product.name || '未命名商品'}</td>
                    <td style="text-align:center;">
                        <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="max-width: 60px; max-height: 60px; border: 1px solid #eee; object-fit: contain; vertical-align: middle;">
                    </td>
                    <td style="text-align:center;">${product.click_count !== null ? product.click_count : '0'}</td>
                    <td style="text-align:center; font-weight: ${lowStock ? 'bold' : 'normal'}; color: ${lowStock ? 'red' : 'inherit'};">
                        ${inventory} <!-- 顯示總庫存 -->
                    </td>
                `;
                productListBody.appendChild(row);
            });

    } catch (error) {
        console.error(`處理商品 ${productId} 點擊時出錯:`, error);
        alert(`無法獲取商品詳情：${error.message}`);
    }

}
// --- 為表}格 tbody 添加事件委派監聽器 ---
if (productListBody) {
    productListBody.addEventListener('click', handleProductRowClick);
}

// --- Initial Page Load ---
async function initializeInventoryPage() {
    if (!checkElements(productListBody, productListContainer, productTable, loadingMessage)) return;
    try {
        await fetchAndDisplayInventoryProducts();
        console.log("Inventory admin page initialized (v4 - Show Total Inventory, Click Handler Prep).");
    } catch (error) { console.error("庫存頁面初始化過程中發生錯誤:", error); }
}

initializeInventoryPage();

}); // --- End of DOMContentLoaded ---