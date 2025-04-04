document.addEventListener('DOMContentLoaded', () => {
    // --- 獲取元素 (保持大部分不變) ---
    const tableBody = document.getElementById('figure-table-body');
    const addFigureBtn = document.getElementById('add-figure-btn');

    // Figure Modal Elements
    const figureModal = document.getElementById('figure-modal');
    const figureModalTitle = document.getElementById('modal-title');
    const figureForm = document.getElementById('figure-form');
    const figureIdInput = document.getElementById('figure-id');
    const figureNameInput = document.getElementById('figure-name');
    const figureImageUrlInput = document.getElementById('figure-image-url');
    const figurePurchasePriceInput = document.getElementById('figure-purchase-price');
    const figureSellingPriceInput = document.getElementById('figure-selling-price');
    const figureOrderingMethodInput = document.getElementById('figure-ordering-method');
    const figureIsSellingInput = document.getElementById('figure-is-selling'); // *** 新增: is_selling checkbox ***
    const variationsContainer = document.getElementById('variations-container');
    const addVariationBtn = document.getElementById('add-variation-btn');
    const figureCloseBtn = figureModal.querySelector('.close-btn');
    const figureCancelBtn = figureModal.querySelector('.cancel-btn');

    // *** 新增: Sale Modal Elements ***
    const saleModal = document.getElementById('record-sale-modal');
    const saleForm = document.getElementById('record-sale-form');
    const saleVariationIdInput = document.getElementById('sale-variation-id');
    const saleVariationNameInput = document.getElementById('sale-variation-name');
    const saleCurrentStockInput = document.getElementById('sale-current-stock');
    const saleQuantitySoldInput = document.getElementById('sale-quantity-sold');
    const saleTimestampInput = document.getElementById('sale-timestamp');
    const saleNotesInput = document.getElementById('sale-notes');
    const saleCloseBtn = saleModal.querySelector('.close-btn');
    const saleCancelBtn = saleModal.querySelector('.cancel-btn');


    let allFiguresData = [];

    // --- CRUD & Display 函數 (修改) ---

    /** 獲取並顯示所有公仔 */
    async function fetchAndDisplayFigures() {
        tableBody.innerHTML = '<tr><td colspan="8">正在載入公仔資料...</td></tr>'; // *** colspan 改為 8 ***
        try {
            const response = await fetch('/api/admin/figures');
            if (!response.ok) { throw new Error(`HTTP 錯誤！狀態: ${response.status}`); }
            allFiguresData = await response.json();
            displayFigures(allFiguresData);
        } catch (error) {
            console.error("獲取公仔列表失敗:", error);
            tableBody.innerHTML = '<tr><td colspan="8">無法載入公仔資料，請稍後再試。</td></tr>'; // *** colspan 改為 8 ***
        }
    }

    /** 將公仔列表渲染到表格 (修改) */
    function displayFigures(figures) {
        tableBody.innerHTML = '';
        if (!figures || figures.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8">目前沒有公仔資料。</td></tr>'; // *** colspan 改為 8 ***
            return;
        }

        figures.forEach(figure => {
            const row = tableBody.insertRow();
            row.setAttribute('data-id', figure.id);

            // 圖片
            const cellImage = row.insertCell();
            const img = document.createElement('img');
            img.src = figure.image_url || '/images/placeholder.png';
            img.alt = figure.name;
            img.style.maxWidth = '80px'; img.style.height = 'auto';
            cellImage.appendChild(img);

            // 商品名
            row.insertCell().textContent = figure.name;

            // *** 新增: 販售中? ***
             const cellIsSelling = row.insertCell();
             cellIsSelling.textContent = figure.is_selling ? '是' : '否';
             cellIsSelling.style.color = figure.is_selling ? 'green' : 'red';
             cellIsSelling.style.fontWeight = 'bold';


            // 規格 & 數量 & 售出按鈕
            const cellVariations = row.insertCell();
            const variationsList = document.createElement('ul');
            variationsList.className = 'variations-list';
            if (figure.variations && figure.variations.length > 0) {
                figure.variations.forEach(v => {
                    const listItem = document.createElement('li');
                    listItem.setAttribute('data-variation-id', v.id);

                    const textSpan = document.createElement('span');
                    textSpan.textContent = `${v.name}: ${v.quantity}`;
                    listItem.appendChild(textSpan);

                    // *** 新增: 售出按鈕 ***
                    const sellBtn = document.createElement('button');
                    sellBtn.textContent = '售出';
                    sellBtn.className = 'sell-btn';
                    sellBtn.setAttribute('data-variation-id', v.id);
                    sellBtn.setAttribute('data-variation-name', v.name);
                    sellBtn.setAttribute('data-current-stock', v.quantity);
                    // 只有當公仔販售中且庫存大於 0 時才啟用售出按鈕
                    sellBtn.disabled = !figure.is_selling || v.quantity <= 0;
                    if (sellBtn.disabled) {
                        sellBtn.style.opacity = '0.5';
                        sellBtn.style.cursor = 'not-allowed';
                    }
                    // sellBtn.onclick = () => openSaleModal(v.id, v.name, v.quantity); // 改用事件代理
                    listItem.appendChild(sellBtn);

                    variationsList.appendChild(listItem);
                });
            } else {
                variationsList.innerHTML = '<li>無規格</li>';
            }
            cellVariations.appendChild(variationsList);

            // 買入價格, 賣出價格, 叫貨方法 (保持不變)
            row.insertCell().textContent = formatCurrency(figure.purchase_price);
            row.insertCell().textContent = formatCurrency(figure.selling_price);
            row.insertCell().textContent = figure.ordering_method || '-';

            // 操作按鈕 (保持不變)
            const cellActions = row.insertCell();
            cellActions.className = 'actions';
            const editBtn = document.createElement('button');
            editBtn.textContent = '編輯'; editBtn.className = 'edit-btn';
            editBtn.onclick = () => openEditModal(figure.id);
            cellActions.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '刪除'; deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = () => deleteFigure(figure.id, figure.name);
            cellActions.appendChild(deleteBtn);
        });
    }

    /** 格式化貨幣 */
    function formatCurrency(amount) { /* ... (保持不變) ... */
         const num = parseFloat(amount);
         if (isNaN(num)) { return '-'; }
         return `NT$ ${Math.round(num)}`;
    }


    // --- Modal 控制 (修改/新增) ---

    /** 打開新增 Modal */
    function openAddModal() {
        figureModalTitle.textContent = '新增公仔';
        figureForm.reset();
        figureIdInput.value = '';
        figureIsSellingInput.checked = true; // *** 預設勾選 ***
        variationsContainer.innerHTML = '';
        addVariationInput();
        figureModal.style.display = 'block';
    }

    /** 打開編輯 Modal (修改) */
    function openEditModal(id) {
        const figure = allFiguresData.find(f => f.id === id);
        if (!figure) { alert('找不到要編輯的公仔資料！'); return; }

        figureModalTitle.textContent = '編輯公仔';
        figureForm.reset();

        figureIdInput.value = figure.id;
        figureNameInput.value = figure.name;
        figureImageUrlInput.value = figure.image_url || '';
        figurePurchasePriceInput.value = figure.purchase_price || 0;
        figureSellingPriceInput.value = figure.selling_price || 0;
        figureOrderingMethodInput.value = figure.ordering_method || '';
        figureIsSellingInput.checked = figure.is_selling; // *** 設定 checkbox 狀態 ***

        variationsContainer.innerHTML = '';
        if (figure.variations && figure.variations.length > 0) {
            figure.variations.forEach(v => addVariationInput(v.id, v.name, v.quantity));
        } else {
            addVariationInput();
        }
        figureModal.style.display = 'block';
    }

    /** 關閉 Figure Modal */
    function closeFigureModal() { figureModal.style.display = 'none'; }

    /** 動態新增規格輸入欄位到 Figure 表單 */
    function addVariationInput(id = '', name = '', quantity = 0) { /* ... (保持不變) ... */
        const variationItem = document.createElement('div');
        variationItem.className = 'variation-item';
        const idInput = document.createElement('input'); idInput.type = 'hidden'; idInput.className = 'variation-id'; idInput.value = id || '';
        const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.className = 'variation-name'; nameInput.placeholder = '規格名稱'; nameInput.value = name; nameInput.required = true;
        const quantityInput = document.createElement('input'); quantityInput.type = 'number'; quantityInput.className = 'variation-quantity'; quantityInput.placeholder = '數量'; quantityInput.min = '0'; quantityInput.value = quantity; quantityInput.required = true;
        const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.textContent = '移除'; removeBtn.onclick = () => variationItem.remove();
        variationItem.appendChild(idInput); variationItem.appendChild(nameInput); variationItem.appendChild(quantityInput); variationItem.appendChild(removeBtn);
        variationsContainer.appendChild(variationItem);
    }

    /** 儲存 (新增或更新) 公仔 (修改) */
    async function saveFigure(event) {
        event.preventDefault();
        const variations = [];
        const variationItems = variationsContainer.querySelectorAll('.variation-item');
        let hasInvalidVariation = false;
        // ... (收集和驗證 variations 的邏輯不變) ...
        variationItems.forEach(item => {
            const id = item.querySelector('.variation-id').value;
            const name = item.querySelector('.variation-name').value.trim();
            const quantity = item.querySelector('.variation-quantity').value;
            if (!name || quantity === '' || quantity === null) {
                 if(variationItems.length > 1 || (variationItems.length === 1 && (name || quantity))) { alert('每個規格都必須填寫名稱和數量。'); hasInvalidVariation = true; return; }
                 else { return; }
            }
            const quantityInt = parseInt(quantity);
            if (isNaN(quantityInt) || quantityInt < 0) { alert(`規格 "${name}" 的數量必須是非負整數。`); hasInvalidVariation = true; return; }
            variations.push({ id: id ? parseInt(id) : null, name: name, quantity: quantityInt });
        });
        if (hasInvalidVariation) { return; }

        const figureData = {
            name: figureNameInput.value.trim(),
            image_url: figureImageUrlInput.value.trim() || null,
            purchase_price: parseFloat(figurePurchasePriceInput.value) || 0,
            selling_price: parseFloat(figureSellingPriceInput.value) || 0,
            ordering_method: figureOrderingMethodInput.value.trim() || null,
            is_selling: figureIsSellingInput.checked, // *** 新增: 獲取 is_selling 的值 ***
            variations: variations
        };

        const figureId = figureIdInput.value;
        const method = figureId ? 'PUT' : 'POST';
        const url = figureId ? `/api/admin/figures/${figureId}` : '/api/admin/figures';

        console.log(`Saving figure... Method: ${method}, URL: ${url}, Data:`, figureData);
        try {
            const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(figureData) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(`儲存失敗 (${response.status}): ${errorData.error || '未知錯誤'}`); }
            closeFigureModal();
            await fetchAndDisplayFigures();
            alert(`公仔 ${method === 'POST' ? '新增' : '更新'} 成功！`);
        } catch (error) {
            console.error("儲存公仔失敗:", error);
            alert(`儲存公仔失敗: ${error.message}`);
        }
    }

    /** 刪除公仔 */
    async function deleteFigure(id, name) { /* ... (保持不變) ... */
        if (!confirm(`確定要刪除公仔 "${name}" 嗎？\n（相關的規格資料也會一併刪除，但若有關聯的銷售紀錄則無法刪除）`)) { return; } // 更新提示
        try {
            const response = await fetch(`/api/admin/figures/${id}`, { method: 'DELETE' });
            if (response.status === 204) {
                 alert(`公仔 "${name}" 已成功刪除。`);
                 await fetchAndDisplayFigures();
             } else {
                 const errorData = await response.json();
                 throw new Error(`刪除失敗 (${response.status}): ${errorData.error || '未知錯誤'}`);
             }
        } catch (error) {
            console.error("刪除公仔失敗:", error);
            alert(`刪除公仔失敗: ${error.message}`);
        }
    }


    // --- *** 新增: 銷售 Modal 相關函數 *** ---

    /** 打開記錄銷售 Modal */
    function openSaleModal(variationId, variationName, currentStock) {
        saleForm.reset(); // 清空表單
        saleVariationIdInput.value = variationId;
        saleVariationNameInput.value = variationName;
        saleCurrentStockInput.value = currentStock;
        saleQuantitySoldInput.value = 1; // 預設售出 1 個
        saleQuantitySoldInput.max = currentStock; // 設定最大可售數量
        saleTimestampInput.value = ''; // 清空時間，後端會用 NOW()
        saleNotesInput.value = '';
        saleModal.style.display = 'block';
    }

     /** 關閉 Sale Modal */
    function closeSaleModal() { saleModal.style.display = 'none'; }

    /** 提交銷售紀錄 */
    async function submitSaleRecord(event) {
        event.preventDefault();

        const variationId = saleVariationIdInput.value;
        const quantitySold = parseInt(saleQuantitySoldInput.value);
        const currentStock = parseInt(saleCurrentStockInput.value);
        const saleTimestamp = saleTimestampInput.value || null; // 如果沒填就是 null
        const notes = saleNotesInput.value.trim() || null;

        // 前端再次驗證
        if (isNaN(quantitySold) || quantitySold <= 0) {
            alert('售出數量必須是正整數。');
            return;
        }
        if (quantitySold > currentStock) {
            alert(`售出數量 (${quantitySold}) 不能超過目前庫存 (${currentStock})。`);
            return;
        }

        const saleData = {
            quantity_sold: quantitySold,
            sale_timestamp: saleTimestamp, // 傳遞給後端，如果 null 後端會用 NOW()
            notes: notes
        };

        console.log(`Recording sale for variation ${variationId}... Data:`, saleData);

        try {
            const response = await fetch(`/api/admin/figures/variations/${variationId}/sell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saleData)
            });

            const result = await response.json(); // 讀取後端回應

            if (!response.ok) {
                throw new Error(`記錄銷售失敗 (${response.status}): ${result.error || '未知錯誤'}`);
            }

            alert(result.message || '銷售記錄成功！');
            closeSaleModal();
            await fetchAndDisplayFigures(); // 刷新列表以顯示更新後的庫存

        } catch (error) {
            console.error("記錄銷售失敗:", error);
            alert(`記錄銷售失敗: ${error.message}`);
        }
    }


    // --- 事件監聽器 ---
    addFigureBtn.addEventListener('click', openAddModal);
    figureCloseBtn.addEventListener('click', closeFigureModal);
    figureCancelBtn.addEventListener('click', closeFigureModal);
    figureForm.addEventListener('submit', saveFigure);
    addVariationBtn.addEventListener('click', () => addVariationInput());

    // *** 新增: Sale Modal 事件監聽器 ***
    saleCloseBtn.addEventListener('click', closeSaleModal);
    saleCancelBtn.addEventListener('click', closeSaleModal);
    saleForm.addEventListener('submit', submitSaleRecord);

    // *** 修改: 使用事件代理處理表格內的按鈕點擊 ***
    tableBody.addEventListener('click', (event) => {
        if (event.target.classList.contains('sell-btn')) {
            const button = event.target;
            const variationId = button.getAttribute('data-variation-id');
            const variationName = button.getAttribute('data-variation-name');
            const currentStock = button.getAttribute('data-current-stock');
            openSaleModal(variationId, variationName, currentStock);
        }
        // 可以為 edit-btn 和 delete-btn 也添加類似的代理，但目前 onclick 方式也有效
    });


    // Modal 外部點擊關閉 (兩個 Modal 都適用)
    window.addEventListener('click', (event) => {
        if (event.target == figureModal) { closeFigureModal(); }
        if (event.target == saleModal) { closeSaleModal(); }
    });

    // --- 初始載入 ---
    fetchAndDisplayFigures();
});