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

    const templateInputs = { // 保持不變
        id: document.getElementById('template-id'),
        name: document.getElementById('template-name'),
        description: document.getElementById('template-description'),
        'general-pageBgColor': document.getElementById('general-pageBgColor'),
        'general-primaryTextColor': document.getElementById('general-primaryTextColor'),
        'general-primaryFontFamily': document.getElementById('general-primaryFontFamily'),
        'header-headerBgColor': document.getElementById('header-headerBgColor'),
        'header-headerTextColor': document.getElementById('header-headerTextColor'),
        'header-roomInfoColor': document.getElementById('header-roomInfoColor'),
        'board-borderColor': document.getElementById('board-borderColor'),
        'board-borderWidth': document.getElementById('board-borderWidth'),
        'board-centerBgColor': document.getElementById('board-centerBgColor'),
        'board-centerImageUrl': document.getElementById('board-centerImageUrl'),
        'mapCell-defaultBgColor': document.getElementById('mapCell-defaultBgColor'),
        'mapCell-defaultBorderColor': document.getElementById('mapCell-defaultBorderColor'),
        'mapCell-defaultBorderWidth': document.getElementById('mapCell-defaultBorderWidth'),
        'mapCell-titleTextColor': document.getElementById('mapCell-titleTextColor'),
        'mapCell-numberTextColor': document.getElementById('mapCell-numberTextColor'),
        'mapCell-hoverBgColor': document.getElementById('mapCell-hoverBgColor'),
        'mapCell-hoverBorderColor': document.getElementById('mapCell-hoverBorderColor'),
        'playerMarker-shape': document.getElementById('playerMarker-shape'),
        'playerMarker-textColor': document.getElementById('playerMarker-textColor'),
        'playerMarker-boxShadow': document.getElementById('playerMarker-boxShadow'),
        'playerMarker-color1': document.getElementById('playerMarker-color1'),
        'playerMarker-color2': document.getElementById('playerMarker-color2'),
        'playerMarker-color3': document.getElementById('playerMarker-color3'),
        'playerMarker-color4': document.getElementById('playerMarker-color4'),
        'playerMarker-color5': document.getElementById('playerMarker-color5'),
        'controller-panelBackground': document.getElementById('controller-panelBackground'),
        'controller-playerLabelColor': document.getElementById('controller-playerLabelColor'),
        'controller-button-defaultBgColor': document.getElementById('controller-button-defaultBgColor'),
        'controller-button-defaultTextColor': document.getElementById('controller-button-defaultTextColor'),
        'controller-button-borderRadius': document.getElementById('controller-button-borderRadius'),
        'controller-button-hoverBgColor': document.getElementById('controller-button-hoverBgColor'),
        'controller-button-cooldownOpacity': document.getElementById('controller-button-cooldownOpacity'),
        'info-panelBackground': document.getElementById('info-panelBackground'),
        'info-sectionTitleColor': document.getElementById('info-sectionTitleColor'),
        'info-playerListText': document.getElementById('info-playerListText'),
        'info-staticTextColor': document.getElementById('info-staticTextColor'),
        'info-leaveButton-defaultBgColor': document.getElementById('info-leaveButton-defaultBgColor'),
        'info-leaveButton-defaultTextColor': document.getElementById('info-leaveButton-defaultTextColor'),
        'modal-overlayBgColor': document.getElementById('modal-overlayBgColor'),
        'modal-contentBgColor': document.getElementById('modal-contentBgColor'),
        'modal-headerBgColor': document.getElementById('modal-headerBgColor'),
        'modal-headerTextColor': document.getElementById('modal-headerTextColor'),
        'modal-bodyTextColor': document.getElementById('modal-bodyTextColor'),
    };

    const adminMapGrid = document.getElementById('admin-map-grid');
    const saveAllCellDataBtn = document.getElementById('save-all-cell-data-btn');
    const cellEditModal = document.getElementById('cell-edit-modal');
    const modalCellIndexDisplay = document.getElementById('modal-cell-index-display');
    const editingCellIndexInput = document.getElementById('editing-cell-index');
    const modalCellTitleInput = document.getElementById('modal-cell-title-input');
    const modalCellDescTextarea = document.getElementById('modal-cell-desc-textarea');
    const modalCellBgColorInput = document.getElementById('modal-cell-bg-color-input');
    const modalModalHeaderBgColorInput = document.getElementById('modal-modal-header-bg-color-input');
    const saveModalChangesBtn = document.getElementById('save-modal-changes-btn');

    // 狀態變數
    let currentEditingTemplateId = null;
    let currentCellInfo = [];
    let cellDataChanged = false;

    // --- 函式定義 ---

    async function loadTemplateList() {
        try {
            const response = await fetch('/api/admin/walk_map/templates');
            if (!response.ok) throw new Error(`無法獲取模板列表: ${response.statusText}`);
            const templates = await response.json();
            templateSelect.innerHTML = '<option value="">-- 請選擇或新增 --</option>';
            if (templates && templates.length > 0) { // 檢查是否有模板資料
                templates.forEach(t => {
                    const option = document.createElement('option');
                    option.value = t.template_id;
                    option.textContent = t.template_name;
                    templateSelect.appendChild(option);
                });
            } else {
                console.log("API 返回了空的模板列表。");
            }
            console.log("模板列表載入完成。");
        } catch (error) {
            displayStatus(`載入模板列表錯誤: ${error.message}`, true);
            console.error("載入模板列表失敗:", error); // 添加詳細錯誤日誌
        }
    }

    async function handleLoadTemplate() {
        const selectedId = templateSelect.value;
        if (!selectedId) { displayStatus("請先選擇一個要載入的模板。", true); return; }
        clearTemplateEditor();
        console.log(`Attempting to load template: ${selectedId}`); // **除錯日誌**
        try {
            const response = await fetch(`/api/admin/walk_map/templates/${selectedId}`);
            if (!response.ok) throw new Error(`無法載入模板 ${selectedId}: ${response.statusText} (${response.status})`);
            const template = await response.json();
            populateTemplateEditor(template);
            applyTemplateStylesToPreview(template.style_data);
            console.log("Showing template editor after load."); // **除錯日誌**
            templateEditor.classList.remove('hidden'); // 確保移除 hidden class
            deleteTemplateBtn.classList.remove('hidden');
            currentEditingTemplateId = selectedId;
            displayStatus(`模板 "${template.template_name}" 已載入。`);
        } catch (error) {
            displayStatus(`載入模板錯誤: ${error.message}`, true);
            console.error("載入模板失敗:", error); // **除錯日誌**
            templateEditor.classList.add('hidden');
            deleteTemplateBtn.classList.add('hidden');
            applyTemplateStylesToPreview({});
        }
    }

    function handleNewTemplate() {
        clearTemplateEditor();
        templateInputs.id.value = generateTemplateId();
        templateInputs.name.value = "新的模板";
        console.log("Showing template editor for new template."); // **除錯日誌**
        templateEditor.classList.remove('hidden'); // 確保移除 hidden class
        deleteTemplateBtn.classList.add('hidden');
        currentEditingTemplateId = null;
        displayStatus("請輸入新模板的設定。");
        templateInputs.name.focus(); // 將焦點移到名稱欄位
    }

    async function handleSaveTemplate() {
         // ... (函數內容不變) ...
         const templateId = templateInputs.id.value.trim();
         const templateName = templateInputs.name.value.trim();
         if (!templateId || !templateName) { displayStatus("模板 ID 和名稱為必填項。", true); return; }
         const styleData = collectStyleData();
         const templateData = {
             template_id: templateId,
             template_name: templateName,
             description: templateInputs.description.value.trim(),
             style_data: styleData
         };
         const method = currentEditingTemplateId ? 'PUT' : 'POST';
         const url = currentEditingTemplateId ? `/api/admin/walk_map/templates/${currentEditingTemplateId}` : '/api/admin/walk_map/templates';
         if (!currentEditingTemplateId && templateId !== generateTemplateId()) {
             console.log("正在使用用戶提供的 ID 創建新模板:", templateId);
         } else if (currentEditingTemplateId && templateId !== currentEditingTemplateId) {
             displayStatus("無法修改現有模板的 ID。", true);
             templateInputs.id.value = currentEditingTemplateId;
             return;
         }
         try {
             const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(templateData) });
             if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(errorData.error || `儲存模板失敗: ${response.statusText}`); }
             const savedTemplate = await response.json();
             displayStatus(`模板 "${savedTemplate.template_name}" 儲存成功！`);
             if (!currentEditingTemplateId) {
                 currentEditingTemplateId = savedTemplate.template_id;
                 templateInputs.id.value = savedTemplate.template_id;
                 loadTemplateList();
                 templateSelect.value = savedTemplate.template_id;
                 deleteTemplateBtn.classList.remove('hidden');
             } else {
                 const option = templateSelect.querySelector(`option[value="${currentEditingTemplateId}"]`);
                 if (option && option.textContent !== templateName) option.textContent = templateName;
             }
         } catch (error) { displayStatus(`儲存模板錯誤: ${error.message}`, true); }
    }

    async function handleDeleteTemplate() {
         // ... (函數內容不變) ...
         if (!currentEditingTemplateId || !confirm(`確定要刪除模板 "${templateInputs.name.value}" 嗎？此操作無法復原。`)) return;
         try {
             const response = await fetch(`/api/admin/walk_map/templates/${currentEditingTemplateId}`, { method: 'DELETE' });
             if (!response.ok) { if (response.status === 404) throw new Error("找不到要刪除的模板。"); const errorData = await response.json().catch(() => ({})); throw new Error(errorData.error || `刪除模板失敗: ${response.statusText}`); }
             displayStatus(`模板 "${templateInputs.name.value}" 已成功刪除。`);
             clearTemplateEditor();
             loadTemplateList();
         } catch (error) { displayStatus(`刪除模板錯誤: ${error.message}`, true); }
    }

    function populateTemplateEditor(template) {
        // ... (函數內容不變) ...
        templateInputs.id.value = template.template_id;
        templateInputs.name.value = template.template_name || '';
        templateInputs.description.value = template.description || '';
        const styles = template.style_data || {};
        Object.keys(templateInputs).forEach(key => {
             if (key === 'id' || key === 'name' || key === 'description') return;
             const path = key.split('-');
             let value = styles;
             try { path.forEach(p => { value = value[p]; }); } catch (e) { value = undefined; }
             if (key.startsWith('playerMarker-color')) {
                 const index = parseInt(key.replace('playerMarker-color', '')) - 1;
                 const colors = styles.playerMarker?.playerColors || [];
                 templateInputs[key].value = colors[index] || '#cccccc';
             } else if (templateInputs[key]) {
                 templateInputs[key].value = value !== undefined && value !== null ? value : (templateInputs[key].type === 'color' ? '#ffffff' : '');
             }
         });
         templateInputs['modal-headerBgColor'].value = styles.modal?.headerBgColor || '#4CAF50';
    }

    function collectStyleData() {
        // ... (函數內容不變) ...
        const data = {};
        Object.keys(templateInputs).forEach(key => {
             if (key === 'id' || key === 'name' || key === 'description') return;
             const path = key.split('-');
             let current = data;
             for (let i = 0; i < path.length - 1; i++) { if (!current[path[i]]) current[path[i]] = {}; current = current[path[i]]; }
             if (key.startsWith('playerMarker-color')) {
                 if (!current.playerColors) current.playerColors = [];
                 const index = parseInt(key.replace('playerMarker-color', '')) - 1;
                 if (templateInputs[key].value !== '#cccccc') current.playerColors[index] = templateInputs[key].value;
             } else {
                 current[path[path.length - 1]] = templateInputs[key].value.trim() || null;
                 if (key === 'controller-button-cooldownOpacity' && current[path[path.length - 1]]) { current[path[path.length - 1]] = parseFloat(current[path[path.length - 1]]) || 0.6; }
             }
         });
         if(data.playerMarker?.playerColors) data.playerMarker.playerColors = data.playerMarker.playerColors.filter(color => color);
        return data;
    }

    function clearTemplateEditor() {
        // ... (函數內容不變) ...
         Object.keys(templateInputs).forEach(key => {
             if (key === 'id' || key === 'name' || key === 'description') templateInputs[key].value = '';
             else if (templateInputs[key].type === 'color') templateInputs[key].value = '#ffffff'; // 改成重設為白色
             else templateInputs[key].value = '';
         });
        // 特別重設可能影響預設值的顏色
        templateInputs['general-pageBgColor'].value = '#f5f5f5';
        templateInputs['general-primaryTextColor'].value = '#333333';
        templateInputs['header-headerBgColor'].value = '#4CAF50';
        templateInputs['board-borderColor'].value = '#4CAF50';
        templateInputs['board-centerBgColor'].value = '#e8f5e9';
        templateInputs['mapCell-defaultBgColor'].value = '#FFFFFF';
        templateInputs['mapCell-defaultBorderColor'].value = '#4CAF50';
        templateInputs['mapCell-titleTextColor'].value = '#333333';
        templateInputs['mapCell-numberTextColor'].value = '#777777';
        templateInputs['mapCell-hoverBgColor'].value = '#e8f5e9';
        templateInputs['mapCell-hoverBorderColor'].value = '#3e8e41';
        templateInputs['playerMarker-textColor'].value = '#FFFFFF';
        for (let i = 1; i <= 5; i++) { templateInputs[`playerMarker-color${i}`].value = '#cccccc'; }
        templateInputs['controller-panelBackground'].value = '#FFFFFF';
        templateInputs['controller-playerLabelColor'].value = '#333333';
        templateInputs['controller-button-defaultBgColor'].value = '#4CAF50';
        templateInputs['controller-button-defaultTextColor'].value = '#FFFFFF';
        templateInputs['info-panelBackground'].value = '#FFFFFF';
        templateInputs['info-leaveButton-defaultBgColor'].value = '#f1f1f1';
        templateInputs['info-leaveButton-defaultTextColor'].value = '#333333';
        templateInputs['modal-headerBgColor'].value = '#4CAF50';

        templateEditor.classList.add('hidden');
        deleteTemplateBtn.classList.add('hidden');
        currentEditingTemplateId = null;
        templateSelect.value = "";
        applyTemplateStylesToPreview({});
    }

    function generateTemplateId() {
        // ... (函數內容不變) ...
         const name = templateInputs.name.value.trim() || "new_template";
         return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    function initializeTemplatePreviewListeners() {
        // ... (函數內容不變) ...
        console.log("Initializing template preview listeners...");
        Object.keys(templateInputs).forEach(key => {
            const inputElement = templateInputs[key];
            if (!inputElement || key === 'id' || key === 'name' || key === 'description' || key.startsWith('playerMarker-color')) return;
            const eventType = (inputElement.type === 'color' || inputElement.type === 'text' || inputElement.type === 'url' || inputElement.tagName === 'TEXTAREA') ? 'input' : 'change';
            inputElement.addEventListener(eventType, (event) => updateCssVariableFromInput(key, event.target.value));
        });
        console.log("Template preview listeners initialized.");
    }

    function updateCssVariableFromInput(inputId, value) {
        // ... (函數內容不變) ...
        const cssVarMap={ 'general-pageBgColor': '--template-page-bg-color', 'general-primaryTextColor': '--template-primary-text-color', 'general-primaryFontFamily': '--template-primary-font-family', 'header-headerBgColor': '--template-header-bg-color', 'header-headerTextColor': '--template-header-text-color', 'header-roomInfoColor': '--template-room-info-color', 'board-borderColor': '--template-board-border-color', 'board-borderWidth': '--template-board-border-width', 'board-centerBgColor': '--template-center-bg-color', 'board-centerImageUrl': '--template-center-image-url', 'mapCell-defaultBgColor': '--template-cell-default-bg', 'mapCell-defaultBorderColor': '--template-cell-default-border-color', 'mapCell-defaultBorderWidth': '--template-cell-default-border-width', 'mapCell-titleTextColor': '--template-cell-title-text-color', 'mapCell-numberTextColor': '--template-cell-number-text-color', 'mapCell-hoverBgColor': '--template-cell-hover-bg-color', 'mapCell-hoverBorderColor': '--template-cell-hover-border-color', 'modal-headerBgColor': '--template-modal-header-bg-color' };
        const cssVarName=cssVarMap[inputId];
        if(cssVarName){ let cssValue=value.trim(); if(inputId==='board-centerImageUrl')cssValue=cssValue?`url("${cssValue}")`:'none'; if(inputId==='general-primaryFontFamily'&&!cssValue)cssValue='sans-serif'; document.documentElement.style.setProperty(cssVarName,cssValue); }
    }

    function applyTemplateStylesToPreview(styleData) {
        // ... (函數內容不變) ...
         console.log("Applying template styles to preview...");
         const styles = styleData || {};
         const cssVarMap = { 'general-pageBgColor': '--template-page-bg-color', 'general-primaryTextColor': '--template-primary-text-color', 'general-primaryFontFamily': '--template-primary-font-family', 'header-headerBgColor': '--template-header-bg-color', 'header-headerTextColor': '--template-header-text-color', 'header-roomInfoColor': '--template-room-info-color', 'board-borderColor': '--template-board-border-color', 'board-borderWidth': '--template-board-border-width', 'board-centerBgColor': '--template-center-bg-color', 'board-centerImageUrl': '--template-center-image-url', 'mapCell-defaultBgColor': '--template-cell-default-bg', 'mapCell-defaultBorderColor': '--template-cell-default-border-color', 'mapCell-defaultBorderWidth': '--template-cell-default-border-width', 'mapCell-titleTextColor': '--template-cell-title-text-color', 'mapCell-numberTextColor': '--template-cell-number-text-color', 'mapCell-hoverBgColor': '--template-cell-hover-bg-color', 'mapCell-hoverBorderColor': '--template-cell-hover-border-color', 'modal-headerBgColor': '--template-modal-header-bg-color' };
         Object.keys(templateInputs).forEach(key => {
             if (key === 'id' || key === 'name' || key === 'description' || key.startsWith('playerMarker-color')) return;
             const path = key.split('-');
             let value = styles;
             try { path.forEach(p => { value = value[p]; }); } catch (e) { value = undefined; }
             if (value !== undefined) { updateCssVariableFromInput(key, value || ''); }
             else {
                 // Attempt to reset to browser/CSS default if not in styleData
                 const cssVarName = cssVarMap[key];
                 if (cssVarName) {
                     // Get initial value defined in :root (or browser default if not set)
                     const initialValue = getComputedStyle(document.documentElement).getPropertyValue(cssVarName);
                     document.documentElement.style.setProperty(cssVarName, initialValue || ''); // Use initial or empty
                 }
             }
         });
         if (!styles?.board?.centerImageUrl) updateCssVariableFromInput('board-centerImageUrl', '');
         console.log("Template styles applied to preview.");
    }


    async function loadCellDataAndRenderAdminGrid() {
        // ... (函數內容不變) ...
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
        // ... (函數內容不變) ...
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
             const descP = document.createElement('p');
             descP.className = 'admin-cell-desc';
             const shortDesc = cellData.description ? cellData.description.substring(0, 20) + (cellData.description.length > 20 ? '...' : '') : '(無描述)';
             descP.textContent = shortDesc;
             descP.title = cellData.description || '';
             const indexSpan = document.createElement('span');
             indexSpan.className = 'admin-cell-index';
             indexSpan.textContent = i;
             cellDiv.appendChild(titleSpan);
             cellDiv.appendChild(descP);
             cellDiv.appendChild(indexSpan);
             cellDiv.style.backgroundColor = cellData.cell_bg_color || '';
             cellDiv.addEventListener('click', () => openCellEditModal(i));
             adminMapGrid.appendChild(cellDiv);
         }
         applyGridPositioningCSSClasses();
         console.log("管理地圖網格渲染完成。");
    }

    function applyGridPositioningCSSClasses() {
        // ... (函數內容不變) ...
         const cells = adminMapGrid.querySelectorAll('.admin-map-cell');
         cells.forEach(cell => {
             const i = parseInt(cell.dataset.cellIndex);
             cell.className = 'admin-map-cell'; // Reset
             if (i >= 0 && i <= 6) { cell.classList.add('top-row', `col-${i}`); }
             else if (i >= 7 && i <= 12) { cell.classList.add('right-column', `row-${i-6}`); }
             else if (i >= 13 && i <= 18) { cell.classList.add('bottom-row', `col-rev-${6-(i-13)}`); }
             else if (i >= 19 && i <= 23) { cell.classList.add('left-column', `row-rev-${6-(i-19)}`); }
         });
         console.log("已應用格子定位 CSS Classes。需要在 admin-style.css 中定義 grid-area。");
    }


    function openCellEditModal(index) {
        // ... (函數內容不變) ...
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
        // ... (函數內容不變) ...
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
             if (descP) { const shortDesc = newDesc ? newDesc.substring(0, 20) + (newDesc.length > 20 ? '...' : '') : '(無描述)'; descP.textContent = shortDesc; descP.title = newDesc || ''; }
             adminCellDiv.style.backgroundColor = newBgColor || '';
         }
         cellDataChanged = true;
         closeCellEditModal();
         displayStatus(`格子 ${index} 的變更已暫存。點擊 "儲存所有格子變更" 以提交。`, false, true); // 添加第三個參數表示暫存
    }

    async function saveAllCellDataToBackend() {
        // ... (函數內容不變) ...
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

    // displayStatus 增加一個參數用於區分普通消息和暫存消息
    function displayStatus(message, isError = false, isTemporary = false) {
        statusMessage.textContent = message;
        if (isError) {
            statusMessage.className = 'status-error';
        } else if (isTemporary) {
            statusMessage.className = 'status-temporary'; // 可以定義一個不同的樣式
        } else {
            statusMessage.className = 'status-success';
        }
        // 對於非暫存消息，5秒後清除
        if (!isTemporary) {
            setTimeout(() => {
                if (statusMessage.textContent === message) { statusMessage.textContent = ''; statusMessage.className = ''; }
            }, 5000);
        }
    }


    // 綁定全域函數
    window.closeCellEditModal = closeCellEditModal;
    window.clearColorInput = (inputId) => {
        const input = document.getElementById(inputId);
        if (input) { input.value = '#ffffff'; input.dataset.cleared = 'true'; }
    };

    // --- 初始化呼叫 ---
    initializeTemplatePreviewListeners();
    loadTemplateList();
    loadCellDataAndRenderAdminGrid();

}); // DOMContentLoaded End