document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('figure-table-body');
    const addFigureBtn = document.getElementById('add-figure-btn');
    const modal = document.getElementById('figure-modal');
    const modalTitle = document.getElementById('modal-title');
    const figureForm = document.getElementById('figure-form');
    const figureIdInput = document.getElementById('figure-id');
    const figureNameInput = document.getElementById('figure-name');
    const figureImageUrlInput = document.getElementById('figure-image-url');
    // --- START: 新增獲取 is_displayed checkbox ---
    const figureIsDisplayedInput = document.getElementById('figure-is-displayed');
    // --- END: 新增獲取 is_displayed checkbox ---
    const figurePurchasePriceInput = document.getElementById('figure-purchase-price');
    const figureSellingPriceInput = document.getElementById('figure-selling-price');
    const figureOrderingMethodInput = document.getElementById('figure-ordering-method');
    const variationsContainer = document.getElementById('variations-container');
    const addVariationBtn = document.getElementById('add-variation-btn');
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');

    let allFiguresData = []; // 用於編輯時查找數據

    // --- CRUD 函數 ---

    /** 獲取並顯示所有公仔 */
    async function fetchAndDisplayFigures() {
        // --- Colspan +1 ---
        tableBody.innerHTML = '<tr><td colspan="8">正在載入公仔資料...</td></tr>';
        try {
            const response = await fetch('/api/admin/figures'); // API 已更新排序
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            }
            allFiguresData = await response.json(); // 儲存數據供編輯使用
            displayFigures(allFiguresData);
        } catch (error) {
            console.error("獲取公仔列表失敗:", error);
            // --- Colspan +1 ---
            tableBody.innerHTML = '<tr><td colspan="8">無法載入公仔資料，請稍後再試。</td></tr>';
        }
    }

    /** 將公仔列表渲染到表格 */
    function displayFigures(figures) {
        tableBody.innerHTML = ''; // 清空表格

        if (!figures || figures.length === 0) {
            // --- Colspan +1 ---
            tableBody.innerHTML = '<tr><td colspan="8">目前沒有公仔資料。</td></tr>';
            return;
        }

        figures.forEach(figure => {
            const row = tableBody.insertRow();
            row.setAttribute('data-id', figure.id);

            // 圖片 (不變)
            const cellImage = row.insertCell();
            const img = document.createElement('img');
            img.src = figure.image_url || '/images/placeholder.png';
            img.alt = figure.name;
            img.style.maxWidth = '80px';
            img.style.height = 'auto';
            cellImage.appendChild(img);

            // 商品名 (不變)
            row.insertCell().textContent = figure.name;

            // 規格 & 數量 (不變)
            const cellVariations = row.insertCell();
            const variationsList = document.createElement('ul');
            variationsList.className = 'variations-list';
            if (figure.variations && figure.variations.length > 0) {
                figure.variations.forEach(v => {
                    const listItem = document.createElement('li');
                    listItem.textContent = `${v.name}: ${v.quantity}`;
                    listItem.setAttribute('data-variation-id', v.id);
                    variationsList.appendChild(listItem);
                });
            } else {
                variationsList.innerHTML = '<li>無規格</li>';
            }
            cellVariations.appendChild(variationsList);

            // --- START: 新增顯示 '是/否' 的儲存格 ---
            const cellDisplay = row.insertCell();
            cellDisplay.textContent = figure.is_displayed ? '是' : '否';
            cellDisplay.style.fontWeight = figure.is_displayed ? 'bold' : 'normal';
            cellDisplay.style.color = figure.is_displayed ? 'green' : '#aaa'; // 綠色表示顯示, 灰色表示隱藏
            // --- END: 新增顯示 '是/否' 的儲存格 ---

            // 買入價格 (不變)
            row.insertCell().textContent = formatCurrency(figure.purchase_price);

            // 賣出價格 (不變)
            row.insertCell().textContent = formatCurrency(figure.selling_price);

            // 叫貨方法 (不變)
            row.insertCell().textContent = figure.ordering_method || '-';

            // 操作按鈕 (不變)
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

    /** 格式化貨幣 (不變) */
    function formatCurrency(amount) {
       // ... (函數內容不變) ...
       const num = parseFloat(amount);
       if (isNaN(num)) { return '-'; }
       return `NT$ ${Math.round(num)}`;
    }

    /** 打開新增 Modal */
    function openAddModal() {
        modalTitle.textContent = '新增公仔';
        figureForm.reset(); // 清空表單
        figureIdInput.value = ''; // 確保 ID 為空
        // --- START: 重置 is_displayed checkbox 為預設勾選 ---
        figureIsDisplayedInput.checked = true;
        // --- END: 重置 is_displayed checkbox 為預設勾選 ---
        variationsContainer.innerHTML = ''; // 清空規格區域
        addVariationInput(); // 預設至少添加一組規格輸入
        modal.style.display = 'block';
    }

    /** 打開編輯 Modal */
    function openEditModal(id) {
        const figure = allFiguresData.find(f => f.id === id);
        if (!figure) {
            alert('找不到要編輯的公仔資料！');
            return;
        }

        modalTitle.textContent = '編輯公仔';
        figureForm.reset(); // 先清空

        // 填入基本資料
        figureIdInput.value = figure.id;
        figureNameInput.value = figure.name;
        figureImageUrlInput.value = figure.image_url || '';
        // --- START: 根據數據設置 is_displayed checkbox ---
        figureIsDisplayedInput.checked = figure.is_displayed;
        // --- END: 根據數據設置 is_displayed checkbox ---
        figurePurchasePriceInput.value = figure.purchase_price || 0;
        figureSellingPriceInput.value = figure.selling_price || 0;
        figureOrderingMethodInput.value = figure.ordering_method || '';

        // 填入規格資料 (不變)
        variationsContainer.innerHTML = ''; // 清空
        if (figure.variations && figure.variations.length > 0) {
            figure.variations.forEach(v => addVariationInput(v.id, v.name, v.quantity));
        } else {
            addVariationInput(); // 如果沒有規格，至少顯示一組空的
        }

        modal.style.display = 'block';
    }

    /** 關閉 Modal (不變) */
    function closeModal() {
        modal.style.display = 'none';
    }

    /** 動態新增規格輸入欄位到表單 (不變) */
    function addVariationInput(id = '', name = '', quantity = 0) {
        // ... (函數內容不變) ...
         const variationItem = document.createElement('div');
        variationItem.className = 'variation-item';
        const idInput = document.createElement('input');
        idInput.type = 'hidden'; idInput.className = 'variation-id'; idInput.value = id || '';
        const nameInput = document.createElement('input');
        nameInput.type = 'text'; nameInput.className = 'variation-name'; nameInput.placeholder = '規格名稱 (例: 大號)'; nameInput.value = name; nameInput.required = true;
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number'; quantityInput.className = 'variation-quantity'; quantityInput.placeholder = '數量'; quantityInput.min = '0'; quantityInput.value = quantity; quantityInput.required = true;
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button'; removeBtn.textContent = '移除'; removeBtn.onclick = () => variationItem.remove();
        variationItem.appendChild(idInput); variationItem.appendChild(nameInput); variationItem.appendChild(quantityInput); variationItem.appendChild(removeBtn);
        variationsContainer.appendChild(variationItem);
    }

    /** 儲存 (新增或更新) 公仔 */
    async function saveFigure(event) {
        event.preventDefault(); // 阻止表單默認提交

        // 從表單收集規格資料 (不變)
        const variations = [];
        const variationItems = variationsContainer.querySelectorAll('.variation-item');
        let hasInvalidVariation = false;
        variationItems.forEach(item => {
            // ... (規格收集和驗證邏輯不變) ...
             const id = item.querySelector('.variation-id').value;
             const name = item.querySelector('.variation-name').value.trim();
             const quantity = item.querySelector('.variation-quantity').value;
             if (!name || quantity === '' || quantity === null) {
                  if(variationItems.length > 1 || (variationItems.length === 1 && (name || quantity))) {
                       alert('每個規格都必須填寫名稱和數量。');
                       hasInvalidVariation = true; return;
                  } else { return; }
             }
             const quantityInt = parseInt(quantity);
             if (isNaN(quantityInt) || quantityInt < 0) {
                 alert(`規格 "${name}" 的數量必須是非負整數。`);
                 hasInvalidVariation = true; return;
             }
             variations.push({ id: id ? parseInt(id) : null, name: name, quantity: quantityInt });
        });
         if (hasInvalidVariation) { return; }


        // 準備請求資料
        const figureData = {
            name: figureNameInput.value.trim(),
            image_url: figureImageUrlInput.value.trim() || null,
            // --- START: 加入 is_displayed 值 ---
            is_displayed: figureIsDisplayedInput.checked, // checkbox 的 checked 屬性直接是布林值
            // --- END: 加入 is_displayed 值 ---
            purchase_price: parseFloat(figurePurchasePriceInput.value) || 0,
            selling_price: parseFloat(figureSellingPriceInput.value) || 0,
            ordering_method: figureOrderingMethodInput.value.trim() || null,
            variations: variations // 添加收集到的規格陣列
        };

        const figureId = figureIdInput.value;
        const method = figureId ? 'PUT' : 'POST';
        const url = figureId ? `/api/admin/figures/${figureId}` : '/api/admin/figures';

        console.log(`Saving figure... Method: ${method}, URL: ${url}, Data:`, figureData);

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(figureData)
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(`儲存失敗 (${response.status}): ${errorData.error || '未知錯誤'}`);
            }

            closeModal();
            await fetchAndDisplayFigures(); // 重新載入列表 (會按新的排序)
            alert(`公仔 ${method === 'POST' ? '新增' : '更新'} 成功！`);

        } catch (error) {
            console.error("儲存公仔失敗:", error);
            alert(`儲存公仔失敗: ${error.message}`);
        }
    }

    /** 刪除公仔 (不變) */
    async function deleteFigure(id, name) {
       // ... (函數內容不變) ...
        if (!confirm(`確定要刪除公仔 "${name}" 嗎？\n（相關的規格資料也會一併刪除）`)) { return; }
        try {
            const response = await fetch(`/api/admin/figures/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                 if (response.status === 404) { throw new Error('找不到要刪除的公仔。'); }
                 else { throw new Error(`刪除失敗 (${response.status})`); }
            }
            alert(`公仔 "${name}" 已成功刪除。`);
            await fetchAndDisplayFigures();
        } catch (error) {
            console.error("刪除公仔失敗:", error);
            alert(`刪除公仔失敗: ${error.message}`);
        }
    }

    // --- 事件監聽器 (不變) ---
    addFigureBtn.addEventListener('click', openAddModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target == modal) { closeModal(); }
    });
    figureForm.addEventListener('submit', saveFigure);
    addVariationBtn.addEventListener('click', () => addVariationInput());

    // --- 初始載入 ---
    fetchAndDisplayFigures(); // 第一次載入時就會按照新的排序規則
});