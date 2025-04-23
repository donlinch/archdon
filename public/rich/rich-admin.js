// rich-admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素 ---
    const templateSelect = document.getElementById('template-select');
    const loadTemplateBtn = document.getElementById('load-template-btn');
    const newTemplateBtn = document.getElementById('new-template-btn');
    const saveTemplateBtn = document.getElementById('save-template-btn');
    const deleteTemplateBtn = document.getElementById('delete-template-btn');
    const templateEditor = document.getElementById('template-editor');
    const statusMessage = document.getElementById('status-message');

    // 模板編輯器所有輸入框 (使用物件方便管理)
    const templateInputs = {
        id: document.getElementById('template-id'),
        name: document.getElementById('template-name'),
        description: document.getElementById('template-description'),
        // General
        'general-pageBgColor': document.getElementById('general-pageBgColor'),
        'general-primaryTextColor': document.getElementById('general-primaryTextColor'),
        'general-primaryFontFamily': document.getElementById('general-primaryFontFamily'),
        // Header
        'header-headerBgColor': document.getElementById('header-headerBgColor'),
        'header-headerTextColor': document.getElementById('header-headerTextColor'),
        'header-roomInfoColor': document.getElementById('header-roomInfoColor'),
        // Board
        'board-borderColor': document.getElementById('board-borderColor'),
        'board-borderWidth': document.getElementById('board-borderWidth'),
        'board-centerBgColor': document.getElementById('board-centerBgColor'),
        'board-centerImageUrl': document.getElementById('board-centerImageUrl'),
        // MapCell
        'mapCell-defaultBgColor': document.getElementById('mapCell-defaultBgColor'),
        'mapCell-defaultBorderColor': document.getElementById('mapCell-defaultBorderColor'),
        'mapCell-defaultBorderWidth': document.getElementById('mapCell-defaultBorderWidth'),
        'mapCell-titleTextColor': document.getElementById('mapCell-titleTextColor'),
        'mapCell-numberTextColor': document.getElementById('mapCell-numberTextColor'),
        'mapCell-hoverBgColor': document.getElementById('mapCell-hoverBgColor'),
        'mapCell-hoverBorderColor': document.getElementById('mapCell-hoverBorderColor'),
        // PlayerMarker
        'playerMarker-shape': document.getElementById('playerMarker-shape'),
        'playerMarker-textColor': document.getElementById('playerMarker-textColor'),
        'playerMarker-boxShadow': document.getElementById('playerMarker-boxShadow'),
        'playerMarker-color1': document.getElementById('playerMarker-color1'),
        'playerMarker-color2': document.getElementById('playerMarker-color2'),
        'playerMarker-color3': document.getElementById('playerMarker-color3'),
        'playerMarker-color4': document.getElementById('playerMarker-color4'),
        'playerMarker-color5': document.getElementById('playerMarker-color5'),
        // Controller
        'controller-panelBackground': document.getElementById('controller-panelBackground'),
        'controller-playerLabelColor': document.getElementById('controller-playerLabelColor'),
        'controller-button-defaultBgColor': document.getElementById('controller-button-defaultBgColor'),
        'controller-button-defaultTextColor': document.getElementById('controller-button-defaultTextColor'),
        'controller-button-borderRadius': document.getElementById('controller-button-borderRadius'),
        'controller-button-hoverBgColor': document.getElementById('controller-button-hoverBgColor'),
        'controller-button-cooldownOpacity': document.getElementById('controller-button-cooldownOpacity'),
        // Info Area
        'info-panelBackground': document.getElementById('info-panelBackground'),
        'info-sectionTitleColor': document.getElementById('info-sectionTitleColor'),
        'info-playerListText': document.getElementById('info-playerListText'),
        'info-staticTextColor': document.getElementById('info-staticTextColor'),
        'info-leaveButton-defaultBgColor': document.getElementById('info-leaveButton-defaultBgColor'),
        'info-leaveButton-defaultTextColor': document.getElementById('info-leaveButton-defaultTextColor'),
        // Connection Status (省略，預覽意義不大，但收集資料時要包含)
        // Modal (模板預設)
        'modal-overlayBgColor': document.getElementById('modal-overlayBgColor'),
        'modal-contentBgColor': document.getElementById('modal-contentBgColor'),
        'modal-headerBgColor': document.getElementById('modal-headerBgColor'), // 模板預設頭部顏色
        'modal-headerTextColor': document.getElementById('modal-headerTextColor'),
        'modal-bodyTextColor': document.getElementById('modal-bodyTextColor'),
    };

    // 地圖格子編輯器元素
    const adminMapGrid = document.getElementById('admin-map-grid');
    const saveAllCellDataBtn = document.getElementById('save-all-cell-data-btn');

    // 格子編輯彈窗元素
    const cellEditModal = document.getElementById('cell-edit-modal');
    const modalCellIndexDisplay = document.getElementById('modal-cell-index-display');
    const editingCellIndexInput = document.getElementById('editing-cell-index');
    const modalCellTitleInput = document.getElementById('modal-cell-title-input');
    const modalCellDescTextarea = document.getElementById('modal-cell-desc-textarea');
    const modalCellBgColorInput = document.getElementById('modal-cell-bg-color-input');
    const modalModalHeaderBgColorInput = document.getElementById('modal-modal-header-bg-color-input');
    const saveModalChangesBtn = document.getElementById('save-modal-changes-btn');

    // --- 狀態變數 ---
    let currentEditingTemplateId = null;
    let currentCellInfo = [];
    let cellDataChanged = false;

    // --- 初始化 ---
    initializeTemplatePreviewListeners(); // **新增**: 設定即時預覽監聽器
    loadTemplateList();
    loadCellDataAndRenderAdminGrid();

    // --- 事件監聽 ---
    loadTemplateBtn.addEventListener('click', handleLoadTemplate);
    newTemplateBtn.addEventListener('click', handleNewTemplate);
    saveTemplateBtn.addEventListener('click', handleSaveTemplate);
    deleteTemplateBtn.addEventListener('click', handleDeleteTemplate);
    saveAllCellDataBtn.addEventListener('click', saveAllCellDataToBackend);
    saveModalChangesBtn.addEventListener('click', saveModalChangesToLocal);


    // --- ★★★ 新增：模板即時預覽相關函式 ★★★ ---
    function initializeTemplatePreviewListeners() {
        console.log("Initializing template preview listeners...");
        // 監聽模板編輯器中所有輸入框的 'input' 或 'change' 事件
        Object.keys(templateInputs).forEach(key => {
            const inputElement = templateInputs[key];
            if (!inputElement) {
                 console.warn(`Template input element not found for key: ${key}`);
                 return; // 跳過未找到的元素
            }

            const eventType = (inputElement.type === 'color' || inputElement.type === 'text' || inputElement.type === 'url' || inputElement.tagName === 'TEXTAREA') ? 'input' : 'change';

            inputElement.addEventListener(eventType, (event) => {
                 // 根據輸入框 ID 更新對應的 CSS 變數
                updateCssVariableFromInput(key, event.target.value);
            });
        });
         // 處理玩家顏色組
         for (let i = 1; i <= 5; i++) {
             const colorInput = templateInputs[`playerMarker-color${i}`];
             if (colorInput) {
                 colorInput.addEventListener('input', (event) => {
                     // 這個不需要更新 CSS 變數，顏色組是數據
                 });
             }
         }
        console.log("Template preview listeners initialized.");
    }

     // 根據輸入框 ID 和值更新對應的 CSS 變數
     function updateCssVariableFromInput(inputId, value) {
        const cssVarMap = { // 將 input ID 映射到 CSS 變數名稱
             'general-pageBgColor': '--template-page-bg-color',
             'general-primaryTextColor': '--template-primary-text-color',
             'general-primaryFontFamily': '--template-primary-font-family',
             'header-headerBgColor': '--template-header-bg-color',
             'header-headerTextColor': '--template-header-text-color', // 暫無預覽
             'header-roomInfoColor': '--template-room-info-color',     // 暫無預覽
             'board-borderColor': '--template-board-border-color',
             'board-borderWidth': '--template-board-border-width',
             'board-centerBgColor': '--template-center-bg-color',
             'board-centerImageUrl': '--template-center-image-url',
             'mapCell-defaultBgColor': '--template-cell-default-bg',
             'mapCell-defaultBorderColor': '--template-cell-default-border-color',
             'mapCell-defaultBorderWidth': '--template-cell-default-border-width',
             'mapCell-titleTextColor': '--template-cell-title-text-color',
             'mapCell-numberTextColor': '--template-cell-number-text-color',
             'mapCell-hoverBgColor': '--template-cell-hover-bg-color',
             'mapCell-hoverBorderColor': '--template-cell-hover-border-color',
             'modal-headerBgColor': '--template-modal-header-bg-color', // 模板預設彈窗頭部
            // ... (添加所有需要預覽的樣式的映射)
        };

        const cssVarName = cssVarMap[inputId];
        if (cssVarName) {
             let cssValue = value.trim();
            // 特殊處理圖片 URL
             if (inputId === 'board-centerImageUrl') {
                 cssValue = cssValue ? `url("${cssValue}")` : 'none';
             }
             // 特殊處理字體，如果為空則設為預設
             if (inputId === 'general-primaryFontFamily' && !cssValue) {
                 cssValue = 'sans-serif'; // 或其他備用字體
             }
             // 更新 CSS 變數
            document.documentElement.style.setProperty(cssVarName, cssValue);
            // console.log(`CSS Variable Updated: ${cssVarName} = ${cssValue}`);
         }
     }

     // 根據載入的 style_data 初始化所有 CSS 預覽變數
     function applyTemplateStylesToPreview(styleData) {
         console.log("Applying template styles to preview...");
         const styles = styleData || {};
         // 遍歷 templateInputs，根據其 ID 和 styleData 中的值設置 CSS 變數
         Object.keys(templateInputs).forEach(key => {
            // 從 style_data 中找到對應的值
             const path = key.split('-'); // e.g., ['general', 'pageBgColor']
             let value = styles;
             for (const p of path) {
                 if (value && typeof value === 'object' && p in value) {
                     value = value[p];
                 } else {
                     value = undefined; // 未找到值
                     break;
                 }
             }
            // 如果找到了值，或者處理玩家顏色，則更新 CSS 變數
            if (value !== undefined || key.startsWith('playerMarker-color')) {
                 // 處理玩家顏色 (不需要設置 CSS 變數)
                 if(key.startsWith('playerMarker-color')) {
                     // 數值已由 populateTemplateEditor 設置到 input 中
                 } else {
                     // 設置其他樣式的 CSS 變數
                     updateCssVariableFromInput(key, value || ''); // 傳遞空字串讓 updateCssVariableFromInput 處理預設
                 }
             }
         });
        console.log("Template styles applied to preview.");
     }

    // --- 模板相關函式 (已有，增加調用 applyTemplateStylesToPreview) ---
    async function handleLoadTemplate() {
        const selectedId = templateSelect.value;
        if (!selectedId) { displayStatus("請先選擇一個要載入的模板。", true); return; }
        clearTemplateEditor();
        try {
            const response = await fetch(`/api/admin/walk_map/templates/${selectedId}`);
            if (!response.ok) throw new Error(`無法載入模板 ${selectedId}: ${response.statusText}`);
            const template = await response.json();
            populateTemplateEditor(template); // 填充表單
            applyTemplateStylesToPreview(template.style_data); // **新增**: 應用樣式到預覽
            templateEditor.classList.remove('hidden');
            deleteTemplateBtn.classList.remove('hidden');
            currentEditingTemplateId = selectedId;
            displayStatus(`模板 "${template.template_name}" 已載入。`);
        } catch (error) {
            displayStatus(`載入模板錯誤: ${error.message}`, true);
            templateEditor.classList.add('hidden');
            deleteTemplateBtn.classList.add('hidden');
             applyTemplateStylesToPreview({}); // 清空預覽樣式
        }
    }
    // (populateTemplateEditor, collectStyleData, handleSaveTemplate, handleDeleteTemplate, clearTemplateEditor 基本不變，除了 clear 要重設預覽)
     function clearTemplateEditor() {
         templateIdInput.value = '';
         templateNameInput.value = '';
         templateDescriptionInput.value = '';
         // 重設所有輸入框...
         // ... (重設所有 templateInputs 的值) ...
         generalPageBgColorInput.value = '#f5f5f5'; // 範例
         templateEditor.classList.add('hidden');
         deleteTemplateBtn.classList.add('hidden');
         currentEditingTemplateId = null;
         templateSelect.value = "";
         applyTemplateStylesToPreview({}); // **新增**: 重設預覽區為預設樣式
     }

    // --- 地圖格子相關函式 (基本不變) ---
    async function loadCellDataAndRenderAdminGrid() {
        try {
            const response = await fetch('/api/admin/walk_map/cells');
            if (!response.ok) throw new Error(`無法獲取格子資料: ${response.statusText}`);
            const cellsFromApi = await response.json();
            currentCellInfo = [];
            const totalCells = 24;
            const apiCellsMap = new Map(cellsFromApi.map(c => [c.cell_index, c]));
            for (let i = 0; i < totalCells; i++) {
                currentCellInfo.push(apiCellsMap.get(i) || { cell_index: i, title: `(未定義 ${i})`, description: '', cell_bg_color: null, modal_header_bg_color: null });
            }
            renderAdminGrid();
            cellDataChanged = false;
            displayStatus("地圖格子資料已載入。");
        } catch (error) {
            displayStatus(`載入格子資料錯誤: ${error.message}`, true);
            currentCellInfo = Array(24).fill({}).map((_, i) => ({ cell_index: i, title: `錯誤 ${i}`, description: '無法載入', cell_bg_color: null, modal_header_bg_color: null }));
            renderAdminGrid();
        }
    }

    function renderAdminGrid() {
        adminMapGrid.innerHTML = '';
        const totalCells = 24;
        for (let i = 0; i < totalCells; i++) {
            const cellData = currentCellInfo[i];
            const cellDiv = document.createElement('div');
            cellDiv.className = 'admin-map-cell';
            cellDiv.id = `admin-cell-${i}`;
            cellDiv.dataset.cellIndex = i;
            const titleSpan = document.createElement('span');
            titleSpan.className = 'admin-cell-title';
            titleSpan.textContent = cellData.title || '(無標題)';
            titleSpan.title = cellData.title || '';
            const descP = document.createElement('p'); // 新增描述元素
            descP.className = 'admin-cell-desc';
            const shortDesc = cellData.description ? cellData.description.substring(0, 20) + (cellData.description.length > 20 ? '...' : '') : '(無描述)';
            descP.textContent = shortDesc;
            descP.title = cellData.description || ''; // 完整描述放 tooltip
            const indexSpan = document.createElement('span');
            indexSpan.className = 'admin-cell-index';
            indexSpan.textContent = i;
            cellDiv.appendChild(titleSpan);
            cellDiv.appendChild(descP); // 添加描述
            cellDiv.appendChild(indexSpan);
            // **重要**: 這裡設置的背景色是格子自身的，優先於模板預設
            cellDiv.style.backgroundColor = cellData.cell_bg_color || ''; // null 或空字串會使用 CSS 變數
            cellDiv.addEventListener('click', () => openCellEditModal(i));
            adminMapGrid.appendChild(cellDiv);
        }
        applyGridPositioningCSSClasses(); // 應用定位 Class
    }

    function applyGridPositioningCSSClasses() {
        const cells = adminMapGrid.querySelectorAll('.admin-map-cell');
        cells.forEach(cell => {
            const i = parseInt(cell.dataset.cellIndex);
            // 清除舊 class
            cell.className = 'admin-map-cell'; // 重設為基礎 class
             // 添加新 class - 這裡需要你有對應的 CSS 規則
             if (i >= 0 && i <= 6) { cell.classList.add('top-row', `col-${i}`); } // CSS: .top-row.col-0 { grid-area: ... }
             else if (i >= 7 && i <= 12) { cell.classList.add('right-column', `row-${i-6}`); }
             else if (i >= 13 && i <= 18) { cell.classList.add('bottom-row', `col-rev-${6-(i-13)}`); }
             else if (i >= 19 && i <= 23) { cell.classList.add('left-column', `row-rev-${6-(i-19)}`); }
         });
         console.log("已應用格子定位 CSS Classes。");
    }


    function openCellEditModal(index) {
        const cellData = currentCellInfo[index];
        if (!cellData) { displayStatus(`找不到格子 ${index} 的資料。`, true); return; }
        modalCellIndexDisplay.textContent = index;
        editingCellIndexInput.value = index;
        modalCellTitleInput.value = cellData.title || '';
        modalCellDescTextarea.value = cellData.description || '';
        modalCellBgColorInput.value = cellData.cell_bg_color || '#ffffff';
        modalCellBgColorInput.dataset.cleared = 'false';
        modalModalHeaderBgColorInput.value = cellData.modal_header_bg_color || '#ffffff';
        modalModalHeaderBgColorInput.dataset.cleared = 'false';
        cellEditModal.classList.remove('hidden');
    }

    function saveModalChangesToLocal() {
        const index = parseInt(editingCellIndexInput.value, 10);
        if (isNaN(index) || !currentCellInfo[index]) { displayStatus("錯誤：無效的格子索引。", true); return; }
        const cellData = currentCellInfo[index];
        const newTitle = modalCellTitleInput.value.trim();
        const newDesc = modalCellDescTextarea.value.trim();
        let newBgColor = modalCellBgColorInput.value;
        if (modalCellBgColorInput.dataset.cleared === 'true' || newBgColor === '#ffffff') newBgColor = null;
        let newModalHeaderBgColor = modalModalHeaderBgColorInput.value;
        if (modalModalHeaderBgColorInput.dataset.cleared === 'true' || newModalHeaderBgColor === '#ffffff') newModalHeaderBgColor = null;
        cellData.title = newTitle;
        cellData.description = newDesc;
        cellData.cell_bg_color = newBgColor;
        cellData.modal_header_bg_color = newModalHeaderBgColor;
        const adminCellDiv = document.getElementById(`admin-cell-${index}`);
        if (adminCellDiv) {
            const titleSpan = adminCellDiv.querySelector('.admin-cell-title');
            const descP = adminCellDiv.querySelector('.admin-cell-desc');
            if (titleSpan) titleSpan.textContent = newTitle || '(無標題)';
            if (descP) {
                 const shortDesc = newDesc ? newDesc.substring(0, 20) + (newDesc.length > 20 ? '...' : '') : '(無描述)';
                 descP.textContent = shortDesc;
                 descP.title = newDesc || '';
             }
            adminCellDiv.style.backgroundColor = newBgColor || ''; // 更新預覽背景
        }
        cellDataChanged = true;
        closeCellEditModal();
        displayStatus(`格子 ${index} 的變更已暫存。`);
    }

    async function saveAllCellDataToBackend() {
        if (!cellDataChanged) { displayStatus("沒有格子資料變更需要儲存。"); return; }
        const dataToSend = currentCellInfo.map(cell => ({
            cell_index: cell.cell_index, title: cell.title, description: cell.description,
            cell_bg_color: cell.cell_bg_color, modal_header_bg_color: cell.modal_header_bg_color
        }));
        try {
            const response = await fetch('/api/admin/walk_map/cells', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSend) });
            if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(errorData.error || `儲存格子資料失敗: ${response.statusText}`); }
            cellDataChanged = false;
            displayStatus("所有格子變更已成功儲存！");
        } catch (error) { displayStatus(`儲存格子資料錯誤: ${error.message}`, true); }
    }

    // --- 通用工具函式 ---
    function displayStatus(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.className = isError ? 'status-error' : 'status-success';
        setTimeout(() => { if (statusMessage.textContent === message) { statusMessage.textContent = ''; statusMessage.className = ''; } }, 5000);
    }

    // 將輔助函數綁定到 window，以便 HTML onclick 調用
    window.closeCellEditModal = closeCellEditModal;
    window.clearColorInput = (inputId) => {
        const input = document.getElementById(inputId);
        if (input) { input.value = '#ffffff'; input.dataset.cleared = 'true'; }
    };

}); // DOMContentLoaded End