document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 (新增 Sales Report 相關元素) ---
    const tableBody = document.getElementById('figure-table-body');
    const addFigureBtn = document.getElementById('add-figure-btn');
    const modal = document.getElementById('figure-modal');
    const modalTitle = document.getElementById('modal-title');
    const figureForm = document.getElementById('figure-form');
    const figureIdInput = document.getElementById('figure-id');
    const figureNameInput = document.getElementById('figure-name');
    const figureImageUrlInput = document.getElementById('figure-image-url');
    const figurePurchasePriceInput = document.getElementById('figure-purchase-price');
    const figureSellingPriceInput = document.getElementById('figure-selling-price');
    const figureOrderingMethodInput = document.getElementById('figure-ordering-method');
    const figureIsSellingInput = document.getElementById('figure-is-selling'); // 新增 Checkbox
    const variationsContainer = document.getElementById('variations-container');
    const addVariationBtn = document.getElementById('add-variation-btn');
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');

    // Sales Report Elements
    const salesTableBody = document.getElementById('sales-table-body');
    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');
    const filterSalesBtn = document.getElementById('filter-sales-btn');
    const resetFilterBtn = document.getElementById('reset-filter-btn');
    const salesPagination = document.getElementById('sales-pagination');


    let allFiguresData = []; // 儲存公仔列表數據
    let currentSalesReport = { // 儲存銷售報告分頁狀態
        logs: [],
        pagination: {},
        filters: {}
    };

    // --- CRUD 函數 (修改 displayFigures) ---

    async function fetchAndDisplayFigures() { /* ... fetch 邏輯不變 ... */
        tableBody.innerHTML = '<tr><td colspan="7">正在載入公仔資料...</td></tr>'; // 修改 colspan
        try {
            const response = await fetch('/api/admin/figures');
            if (!response.ok) { throw new Error(`HTTP 錯誤！狀態: ${response.status}`); }
            allFiguresData = await response.json();
            displayFigures(allFiguresData);
        } catch (error) { /* ... 錯誤處理不變 ... */
             console.error("獲取公仔列表失敗:", error);
             tableBody.innerHTML = '<tr><td colspan="7">無法載入公仔資料，請稍後再試。</td></tr>'; // 修改 colspan
        }
    }

    function displayFigures(figures) {
        tableBody.innerHTML = '';
        if (!figures || figures.length === 0) {
             tableBody.innerHTML = '<tr><td colspan="7">目前沒有公仔資料。</td></tr>'; // 修改 colspan
            return;
        }

        figures.forEach(figure => {
            const row = tableBody.insertRow();
            row.setAttribute('data-id', figure.id);

            // 圖片
            /* ... 圖片邏輯不變 ... */
            const cellImage = row.insertCell();
            const img = document.createElement('img');
            img.src = figure.image_url || '/images/placeholder.png';
            img.alt = figure.name;
            img.style.maxWidth = '80px'; img.style.height = 'auto';
            cellImage.appendChild(img);


            // 商品名 & 販售狀態
            const cellName = row.insertCell();
            cellName.textContent = figure.name;
            const sellingStatusSpan = document.createElement('span');
            sellingStatusSpan.className = `is-selling-label ${figure.is_selling ? 'selling-true' : 'selling-false'}`;
            sellingStatusSpan.textContent = figure.is_selling ? ' (是)' : ' (否)';
            cellName.appendChild(sellingStatusSpan);


            // 規格 & 數量 & 售出按鈕
            const cellVariations = row.insertCell();
            const variationsList = document.createElement('ul');
            variationsList.className = 'variations-list';
            if (figure.variations && figure.variations.length > 0) {
                figure.variations.forEach(v => {
                    const listItem = document.createElement('li');
                    listItem.setAttribute('data-variation-id', v.id);

                    const infoSpan = document.createElement('span');
                    infoSpan.className = 'variation-info';
                    infoSpan.textContent = `${v.name}: ${v.quantity}`;
                    listItem.appendChild(infoSpan);

                    // *** 新增售出按鈕 ***
                    const sellBtn = document.createElement('button');
                    sellBtn.textContent = '售出';
                    sellBtn.className = 'sell-btn';
                    sellBtn.onclick = (e) => {
                         e.stopPropagation(); // 防止觸發行的其他事件 (如果有的話)
                         openSellPrompt(v.id, v.name, v.quantity);
                    };
                    // 如果庫存為 0 或商品未販售，禁用售出按鈕
                    if (v.quantity <= 0 || !figure.is_selling) {
                        sellBtn.disabled = true;
                        sellBtn.style.opacity = 0.5;
                        sellBtn.style.cursor = 'not-allowed';
                        sellBtn.title = v.quantity <= 0 ? "庫存為 0" : "商品未販售";
                    }
                    listItem.appendChild(sellBtn);

                    variationsList.appendChild(listItem);
                });
            } else {
                variationsList.innerHTML = '<li>無規格</li>';
            }
            cellVariations.appendChild(variationsList);


            // 買入價格
            row.insertCell().textContent = formatCurrency(figure.purchase_price);
            // 賣出價格
            row.insertCell().textContent = formatCurrency(figure.selling_price);
            // 叫貨方法
            row.insertCell().textContent = figure.ordering_method || '-';

            // 編輯/刪除按鈕 (分到新的一欄)
            const cellActions = row.insertCell();
            cellActions.className = 'actions';
            const editBtn = document.createElement('button');
            editBtn.textContent = '編輯';
            editBtn.className = 'edit-btn';
            editBtn.onclick = () => openEditModal(figure.id);
            cellActions.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '刪除';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = () => deleteFigure(figure.id, figure.name);
            cellActions.appendChild(deleteBtn);
        });
    }

     function formatCurrency(amount) { /* ... 不變 ... */
         const num = parseFloat(amount);
         if (isNaN(num)) { return '-'; }
         return `NT$ ${Math.round(num)}`;
     }

    // --- Modal 操作 (修改 open/save) ---

    function openAddModal() {
        modalTitle.textContent = '新增公仔';
        figureForm.reset();
        figureIdInput.value = '';
        figureIsSellingInput.checked = true; // 新增時預設勾選販售中
        variationsContainer.innerHTML = '';
        addVariationInput();
        modal.style.display = 'block';
    }

    function openEditModal(id) {
        const figure = allFiguresData.find(f => f.id === id);
        if (!figure) { /* ... 找不到的處理 ... */
             alert('找不到要編輯的公仔資料！'); return;
        }
        modalTitle.textContent = '編輯公仔';
        figureForm.reset();
        // 填入基本資料
        figureIdInput.value = figure.id;
        figureNameInput.value = figure.name;
        figureImageUrlInput.value = figure.image_url || '';
        figurePurchasePriceInput.value = figure.purchase_price || 0;
        figureSellingPriceInput.value = figure.selling_price || 0;
        figureOrderingMethodInput.value = figure.ordering_method || '';
        figureIsSellingInput.checked = figure.is_selling; // *** 設定 Checkbox 狀態 ***

        // 填入規格資料
        /* ... 規格邏輯不變 ... */
         variationsContainer.innerHTML = '';
         if (figure.variations && figure.variations.length > 0) {
             figure.variations.forEach(v => addVariationInput(v.id, v.name, v.quantity));
         } else {
             addVariationInput();
         }

        modal.style.display = 'block';
    }

    function closeModal() { /* ... 不變 ... */
         modal.style.display = 'none';
    }

    function addVariationInput(id = '', name = '', quantity = 0) { /* ... 不變 ... */
         const variationItem = document.createElement('div');
         variationItem.className = 'variation-item';
         const idInput = document.createElement('input'); idInput.type = 'hidden'; idInput.className = 'variation-id'; idInput.value = id || '';
         const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.className = 'variation-name'; nameInput.placeholder = '規格名稱 (例: 大號)'; nameInput.value = name; nameInput.required = true;
         const quantityInput = document.createElement('input'); quantityInput.type = 'number'; quantityInput.className = 'variation-quantity'; quantityInput.placeholder = '數量'; quantityInput.min = '0'; quantityInput.value = quantity; quantityInput.required = true;
         const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.textContent = '移除'; removeBtn.onclick = () => variationItem.remove();
         variationItem.appendChild(idInput); variationItem.appendChild(nameInput); variationItem.appendChild(quantityInput); variationItem.appendChild(removeBtn);
         variationsContainer.appendChild(variationItem);
     }

    async function saveFigure(event) {
        event.preventDefault();
        // --- 收集規格資料 (邏輯不變) ---
        /* ... variations 收集邏輯 ... */
        const variations = [];
        const variationItems = variationsContainer.querySelectorAll('.variation-item');
        let hasInvalidVariation = false;
        variationItems.forEach(item => {
             const id = item.querySelector('.variation-id').value;
             const name = item.querySelector('.variation-name').value.trim();
             const quantity = item.querySelector('.variation-quantity').value;
              if (!name || quantity === '' || quantity === null) {
                  if(variationItems.length > 1 || (variationItems.length === 1 && (name || quantity))) {
                      alert('每個規格都必須填寫名稱和數量。'); hasInvalidVariation = true; return;
                  } else { return; }
              }
             const quantityInt = parseInt(quantity);
             if (isNaN(quantityInt) || quantityInt < 0) { alert(`規格 "${name}" 的數量必須是非負整數。`); hasInvalidVariation = true; return; }
             variations.push({ id: id ? parseInt(id) : null, name: name, quantity: quantityInt });
         });
          if (hasInvalidVariation) { return; }


        // --- 準備請求資料 (加入 is_selling) ---
        const figureData = {
            name: figureNameInput.value.trim(),
            image_url: figureImageUrlInput.value.trim() || null,
            purchase_price: parseFloat(figurePurchasePriceInput.value) || 0,
            selling_price: parseFloat(figureSellingPriceInput.value) || 0,
            ordering_method: figureOrderingMethodInput.value.trim() || null,
            is_selling: figureIsSellingInput.checked, // *** 獲取 Checkbox 的值 ***
            variations: variations
        };

        const figureId = figureIdInput.value;
        const method = figureId ? 'PUT' : 'POST';
        const url = figureId ? `/api/admin/figures/${figureId}` : '/api/admin/figures';

        // --- 發送請求 (邏輯不變) ---
        /* ... fetch 請求和錯誤處理 ... */
         console.log(`Saving figure... Method: ${method}, URL: ${url}, Data:`, figureData);
         try {
             const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(figureData) });
             if (!response.ok) {
                  const errorData = await response.json();
                  // *** 特別處理後端返回的 409 錯誤 (例如: 無法刪除帶銷售紀錄的規格) ***
                 if (response.status === 409) {
                      throw new Error(`操作衝突 (${response.status}): ${errorData.error || '請檢查相關數據是否存在關聯。'}`);
                 } else {
                      throw new Error(`儲存失敗 (${response.status}): ${errorData.error || '未知錯誤'}`);
                 }
             }
             closeModal();
             await fetchAndDisplayFigures();
              alert(`公仔 ${method === 'POST' ? '新增' : '更新'} 成功！`);
         } catch (error) {
             console.error("儲存公仔失敗:", error);
             alert(`儲存公仔失敗: ${error.message}`); // 顯示更詳細的錯誤
         }

    }

    async function deleteFigure(id, name) { /* ... 確認和 fetch 邏輯不變，但錯誤處理可能需要更新 */
         if (!confirm(`確定要刪除公仔 "${name}" 嗎？\n（注意：如果其規格有關聯的銷售記錄，將無法刪除！）`)) { return; }
         try {
             const response = await fetch(`/api/admin/figures/${id}`, { method: 'DELETE' });
             if (!response.ok) {
                 if (response.status === 404) { throw new Error('找不到要刪除的公仔。'); }
                 else if (response.status === 409) { // *** 處理 409 Conflict ***
                     const errorData = await response.json();
                     throw new Error(`刪除失敗 (${response.status}): ${errorData.error || '有關聯的銷售記錄。'}`);
                 }
                 else { throw new Error(`刪除失敗 (${response.status})`); }
             }
             alert(`公仔 "${name}" 已成功刪除。`);
             await fetchAndDisplayFigures();
         } catch (error) {
             console.error("刪除公仔失敗:", error);
             alert(`刪除公仔失敗: ${error.message}`); // 顯示更詳細的錯誤
         }
    }


    // --- 新增: 銷售相關函數 ---

    /** 打開售出數量輸入提示框 */
    function openSellPrompt(variationId, variationName, currentQuantity) {
        const quantitySoldStr = prompt(`要售出幾個 "${variationName}"？ (目前庫存: ${currentQuantity})`, "1");

        if (quantitySoldStr === null) return; // 用戶取消

        const quantitySold = parseInt(quantitySoldStr);

        if (isNaN(quantitySold) || quantitySold <= 0) {
            alert("請輸入有效的正整數數量。");
            return;
        }
        if (quantitySold > currentQuantity) {
            alert(`售出數量 (${quantitySold}) 不能超過目前庫存 (${currentQuantity})。`);
            return;
        }

        // 確認後執行銷售記錄
        logSale(variationId, quantitySold, variationName);
    }

    /** 調用後端 API 記錄銷售 */
    async function logSale(variationId, quantity_sold, variationName) {
        console.log(`Logging sale for variation ${variationId}, quantity: ${quantity_sold}`);
        try {
            const response = await fetch(`/api/admin/variations/${variationId}/sell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity_sold: quantity_sold })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`記錄銷售失敗 (${response.status}): ${errorData.error || '未知錯誤'}`);
            }

            const result = await response.json();
            alert(`"${variationName}" 成功售出 ${quantity_sold} 個！\n新的庫存: ${result.new_stock}`);
            await fetchAndDisplayFigures(); // 刷新列表以顯示更新後的庫存

        } catch (error) {
            console.error("記錄銷售失敗:", error);
            alert(`記錄銷售失敗: ${error.message}`);
        }
    }


    // --- 新增: 銷售報表相關函數 ---

    /** 根據過濾條件獲取銷售紀錄 */
    async function fetchSalesReport(page = 1) {
        const startDate = filterStartDate.value;
        const endDate = filterEndDate.value;
        currentSalesReport.filters = { startDate, endDate }; // 儲存當前過濾條件

        let url = `/api/admin/sales-report?page=${page}&limit=20`; // 每頁顯示 20 筆
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        // TODO: Add figureId/variationId filters if needed

        salesTableBody.innerHTML = `<tr><td colspan="4">正在載入銷售紀錄...</td></tr>`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                 const errorData = await response.json();
                throw new Error(`獲取銷售紀錄失敗 (${response.status}): ${errorData.error || '未知錯誤'}`);
            }
            const data = await response.json();
            currentSalesReport.logs = data.salesLogs;
            currentSalesReport.pagination = data.pagination;
            displaySalesReport(currentSalesReport.logs);
            displaySalesPagination(currentSalesReport.pagination);

        } catch (error) {
            console.error("獲取銷售紀錄失敗:", error);
            salesTableBody.innerHTML = `<tr><td colspan="4">無法載入銷售紀錄: ${error.message}</td></tr>`;
            salesPagination.innerHTML = ''; // 清空分頁
        }
    }

    /** 將銷售紀錄顯示在表格中 */
    function displaySalesReport(logs) {
        salesTableBody.innerHTML = '';
        if (!logs || logs.length === 0) {
            salesTableBody.innerHTML = `<tr><td colspan="4">在此日期範圍內沒有銷售紀錄。</td></tr>`;
            return;
        }

        logs.forEach(log => {
            const row = salesTableBody.insertRow();
            const saleDate = new Date(log.sale_timestamp);
            // 格式化日期時間 (例如: YYYY-MM-DD HH:mm)
            const formattedTimestamp = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}-${String(saleDate.getDate()).padStart(2, '0')} ${String(saleDate.getHours()).padStart(2, '0')}:${String(saleDate.getMinutes()).padStart(2, '0')}`;

            row.insertCell().textContent = formattedTimestamp;
            row.insertCell().textContent = log.figure_name;
            row.insertCell().textContent = log.variation_name;
            row.insertCell().textContent = log.quantity_sold;
        });
    }

     /** 顯示分頁控制 */
     function displaySalesPagination(pagination) {
         salesPagination.innerHTML = ''; // 清空舊的分頁
         if (!pagination || pagination.totalPages <= 1) {
             return; // 如果只有一頁或沒有數據，則不顯示分頁
         }

         const { currentPage, totalPages } = pagination;

         // 上一頁按鈕
         const prevButton = document.createElement('button');
         prevButton.textContent = '上一頁';
         prevButton.disabled = currentPage <= 1;
         prevButton.onclick = () => fetchSalesReport(currentPage - 1);
         salesPagination.appendChild(prevButton);

         // 頁碼信息
         const pageInfo = document.createElement('span');
         pageInfo.textContent = `第 ${currentPage} / ${totalPages} 頁`;
         salesPagination.appendChild(pageInfo);

         // 下一頁按鈕
         const nextButton = document.createElement('button');
         nextButton.textContent = '下一頁';
         nextButton.disabled = currentPage >= totalPages;
         nextButton.onclick = () => fetchSalesReport(currentPage + 1);
         salesPagination.appendChild(nextButton);
     }


    // --- 事件監聽器 (新增 Sales Report) ---
    addFigureBtn.addEventListener('click', openAddModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => { if (event.target == modal) { closeModal(); } });
    figureForm.addEventListener('submit', saveFigure);
    addVariationBtn.addEventListener('click', () => addVariationInput());

    // Sales Report Listeners
    filterSalesBtn.addEventListener('click', () => fetchSalesReport(1)); // 點擊查詢時，從第 1 頁開始
     resetFilterBtn.addEventListener('click', () => {
         filterStartDate.value = '';
         filterEndDate.value = '';
         salesTableBody.innerHTML = `<tr><td colspan="4">請設定日期範圍並查詢。</td></tr>`; // 清空表格內容
         salesPagination.innerHTML = ''; // 清空分頁
         currentSalesReport = { logs: [], pagination: {}, filters: {} }; // 重置數據
     });


    // --- 初始載入 ---
    fetchAndDisplayFigures(); // 載入公仔列表
    // 初始不載入銷售紀錄，等待用戶查詢
    // fetchSalesReport(); // 或者可以預設載入最近一個月的紀錄

});