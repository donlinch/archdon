document.addEventListener('DOMContentLoaded', () => {
    const figureIsDisplayedInput = document.getElementById('figure-is-displayed');

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
    const variationsContainer = document.getElementById('variations-container');
    const addVariationBtn = document.getElementById('add-variation-btn');
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');

    let allFiguresData = []; // 用於編輯時查找數據

    // --- CRUD 函數 ---

    /** 獲取並顯示所有公仔 */
    async function fetchAndDisplayFigures() {
        tableBody.innerHTML = '<tr><td colspan="7">正在載入商品資料...</td></tr>';
        try {
            const response = await fetch('/api/admin/figures');
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            }
            allFiguresData = await response.json(); // 儲存數據供編輯使用
            displayFigures(allFiguresData);
        } catch (error) {
            console.error("獲取商品列表失敗:", error);
            tableBody.innerHTML = '<tr><td colspan="7">無法載入商品資料，請稍後再試。</td></tr>';
        }
    }

    /** 將公仔列表渲染到表格 */
    function displayFigures(figures) {
        tableBody.innerHTML = ''; // 清空表格

        if (!figures || figures.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">目前沒有商品資料。</td></tr>';
            return;
        }

        figures.forEach(figure => {
            const row = tableBody.insertRow();
            row.setAttribute('data-id', figure.id);

            // 圖片
            const cellImage = row.insertCell();
            const img = document.createElement('img');
            img.src = figure.image_url || '/images/placeholder.png'; // 使用預設圖片
            img.alt = figure.name;
            img.style.maxWidth = '80px';
            img.style.height = 'auto';
            cellImage.appendChild(img);

            // 商品名
            row.insertCell().textContent = figure.name;

            // 規格 & 數量
            const cellVariations = row.insertCell();
            const variationsList = document.createElement('ul');
            variationsList.className = 'variations-list';
            if (figure.variations && figure.variations.length > 0) {
                figure.variations.forEach(v => {
                    const listItem = document.createElement('li');
                    listItem.textContent = `${v.name}: ${v.quantity}`;
                    listItem.setAttribute('data-variation-id', v.id); // 添加規格ID
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

            // 操作按鈕
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

     /** 格式化貨幣 */
     function formatCurrency(amount) {
        const num = parseFloat(amount);
        if (isNaN(num)) { return '-'; }
        // 使用 Intl.NumberFormat 進行本地化格式化 (例如: NT$)
        // return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
        // 或者簡單顯示數字
        return `NT$ ${Math.round(num)}`; // 四捨五入到整數
     }

    /** 打開新增 Modal */
    function openAddModal() {
        modalTitle.textContent = '新增商品';
        figureForm.reset(); // 清空表單
        figureIdInput.value = ''; // 確保 ID 為空
        variationsContainer.innerHTML = ''; // 清空規格區域
        addVariationInput(); // 預設至少添加一組規格輸入
        modal.style.display = 'block';
    }

    /** 打開編輯 Modal */
    function openEditModal(id) {
        figureIsDisplayedInput.checked = figure.is_displayed !== false; 
        const figure = allFiguresData.find(f => f.id === id);

        if (!figure) {
            alert('找不到要編輯的商品資料！');
              return;
        }

       
        

        

        modalTitle.textContent = '編輯商品';
        figureForm.reset(); // 先清空

        // 填入基本資料
        figureIdInput.value = figure.id;
        figureNameInput.value = figure.name;
        figureImageUrlInput.value = figure.image_url || '';
        figurePurchasePriceInput.value = figure.purchase_price || 0;
        figureSellingPriceInput.value = figure.selling_price || 0;
        figureOrderingMethodInput.value = figure.ordering_method || '';

        // 填入規格資料
        variationsContainer.innerHTML = ''; // 清空
        if (figure.variations && figure.variations.length > 0) {
            figure.variations.forEach(v => addVariationInput(v.id, v.name, v.quantity));
        } else {
            addVariationInput(); // 如果沒有規格，至少顯示一組空的
        }

        modal.style.display = 'block';
    }

    /** 關閉 Modal */
    function closeModal() {
        modal.style.display = 'none';
    }

    /** 動態新增規格輸入欄位到表單 */
    function addVariationInput(id = '', name = '', quantity = 0) {
        const variationItem = document.createElement('div');
        variationItem.className = 'variation-item';
        // 隱藏的 ID 輸入 (用於更新)
        const idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.className = 'variation-id';
        idInput.value = id || ''; // 如果是新增，ID 為空

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'variation-name';
        nameInput.placeholder = '規格名稱 (例: 大號)';
        nameInput.value = name;
        nameInput.required = true; // 規格名稱必填

        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.className = 'variation-quantity';
        quantityInput.placeholder = '數量';
        quantityInput.min = '0';
        quantityInput.value = quantity;
        quantityInput.required = true; // 數量必填

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '移除';
        removeBtn.onclick = () => variationItem.remove(); // 點擊移除按鈕時刪除該行

        variationItem.appendChild(idInput);
        variationItem.appendChild(nameInput);
        variationItem.appendChild(quantityInput);
        variationItem.appendChild(removeBtn);
        variationsContainer.appendChild(variationItem);
    }

    /** 儲存 (新增或更新) 公仔 */
    async function saveFigure(event) {
        event.preventDefault(); // 阻止表單默認提交

        // 從表單收集規格資料
        const variations = [];
        const variationItems = variationsContainer.querySelectorAll('.variation-item');
        let hasInvalidVariation = false;
        variationItems.forEach(item => {
            const id = item.querySelector('.variation-id').value;
            const name = item.querySelector('.variation-name').value.trim();
            const quantity = item.querySelector('.variation-quantity').value;

             // 驗證: 名稱和數量都必須有值
            if (!name || quantity === '' || quantity === null) {
                 if(variationItems.length > 1 || (variationItems.length === 1 && (name || quantity))) {
                      // 如果有多個規格，或只有一個但用戶有輸入，才報錯
                     alert('每個規格都必須填寫名稱和數量。');
                     hasInvalidVariation = true;
                     return; // 跳過這個無效的規格
                 } else {
                     // 如果只有一個規格且都是空的，忽略它
                     return;
                 }
            }

            const quantityInt = parseInt(quantity);
            if (isNaN(quantityInt) || quantityInt < 0) {
                alert(`規格 "${name}" 的數量必須是非負整數。`);
                hasInvalidVariation = true;
                 return; // 跳過這個無效的規格
            }


            variations.push({
                id: id ? parseInt(id) : null, // 如果有 ID，轉成數字，否則為 null
                name: name,
                quantity: quantityInt
            });
        });

         if (hasInvalidVariation) {
             return; // 如果有驗證錯誤，停止儲存
         }


        // 準備請求資料
        const figureData = {
            name: figureNameInput.value.trim(),
            image_url: figureImageUrlInput.value.trim() || null,
            purchase_price: parseFloat(figurePurchasePriceInput.value) || 0,
            selling_price: parseFloat(figureSellingPriceInput.value) || 0,
            ordering_method: figureOrderingMethodInput.value.trim() || null,
            variations: variations, // 添加收集到的規格陣列
            is_displayed: figureIsDisplayedInput.checked,
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
                 const errorData = await response.json(); // 嘗試讀取錯誤訊息
                 throw new Error(`儲存失敗 (${response.status}): ${errorData.error || '未知錯誤'}`);
            }

            closeModal();
            await fetchAndDisplayFigures(); // 重新載入列表
             alert(`商品 ${method === 'POST' ? '新增' : '更新'} 成功！`);

        } catch (error) {
            console.error("儲存商品失敗:", error);
            alert(`儲存商品失敗: ${error.message}`);
        }
    }

    /** 刪除公仔 */
    async function deleteFigure(id, name) {
        if (!confirm(`確定要刪除商品 "${name}" 嗎？\n（相關的規格資料也會一併刪除）`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/figures/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                 if (response.status === 404) { throw new Error('找不到要刪除的商品。'); }
                 else { throw new Error(`刪除失敗 (${response.status})`); }
            }

            // response.status === 204 表示成功
            alert(`商品 "${name}" 已成功刪除。`);
            await fetchAndDisplayFigures(); // 重新載入列表

        } catch (error) {
            console.error("刪除商品失敗:", error);
            alert(`刪除商品失敗: ${error.message}`);
        }
    }

    // --- 事件監聽器 ---
    addFigureBtn.addEventListener('click', openAddModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => { // 點擊 modal 外部關閉
        if (event.target == modal) {
            closeModal();
        }
    });
    figureForm.addEventListener('submit', saveFigure);
    addVariationBtn.addEventListener('click', () => addVariationInput()); // 點擊按鈕新增一組規格欄位

    // --- 初始載入 ---
    fetchAndDisplayFigures();
});