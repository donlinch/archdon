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

    // 樣式編輯器輸入框
    const templateIdInput = document.getElementById('template-id');
    const templateNameInput = document.getElementById('template-name');
    const templateDescriptionInput = document.getElementById('template-description');
    const generalPageBgColorInput = document.getElementById('general-pageBgColor');
    const generalPrimaryTextColorInput = document.getElementById('general-primaryTextColor');
    const generalPrimaryFontFamilyInput = document.getElementById('general-primaryFontFamily');
    const headerHeaderBgColorInput = document.getElementById('header-headerBgColor');
    const headerHeaderTextColorInput = document.getElementById('header-headerTextColor');
    const headerRoomInfoColorInput = document.getElementById('header-roomInfoColor');
    const boardBorderColorInput = document.getElementById('board-borderColor');
    const boardBorderWidthInput = document.getElementById('board-borderWidth');
    const boardCenterBgColorInput = document.getElementById('board-centerBgColor');
    const boardCenterImageUrlInput = document.getElementById('board-centerImageUrl');
    const mapCellDefaultBgColorInput = document.getElementById('mapCell-defaultBgColor');
    const mapCellDefaultBorderColorInput = document.getElementById('mapCell-defaultBorderColor');
    const mapCellDefaultBorderWidthInput = document.getElementById('mapCell-defaultBorderWidth');
    const mapCellTitleTextColorInput = document.getElementById('mapCell-titleTextColor');
    const mapCellNumberTextColorInput = document.getElementById('mapCell-numberTextColor');
    const mapCellHoverBgColorInput = document.getElementById('mapCell-hoverBgColor');
    const mapCellHoverBorderColorInput = document.getElementById('mapCell-hoverBorderColor');
    const playerMarkerShapeInput = document.getElementById('playerMarker-shape');
    const playerMarkerTextColorInput = document.getElementById('playerMarker-textColor');
    const playerMarkerBoxShadowInput = document.getElementById('playerMarker-boxShadow');
    const playerMarkerColorInputs = [
        document.getElementById('playerMarker-color1'),
        document.getElementById('playerMarker-color2'),
        document.getElementById('playerMarker-color3'),
        document.getElementById('playerMarker-color4'),
        document.getElementById('playerMarker-color5'),
    ];
    const controllerPanelBackgroundInput = document.getElementById('controller-panelBackground');
    const controllerPlayerLabelColorInput = document.getElementById('controller-playerLabelColor');
    const controllerButtonDefaultBgColorInput = document.getElementById('controller-button-defaultBgColor');
    const controllerButtonDefaultTextColorInput = document.getElementById('controller-button-defaultTextColor');
    const controllerButtonBorderRadiusInput = document.getElementById('controller-button-borderRadius');
    const controllerButtonHoverBgColorInput = document.getElementById('controller-button-hoverBgColor');
    const controllerButtonCooldownOpacityInput = document.getElementById('controller-button-cooldownOpacity');
    const infoPanelBackgroundInput = document.getElementById('info-panelBackground');
    const infoSectionTitleColorInput = document.getElementById('info-sectionTitleColor');
    const infoPlayerListTextInput = document.getElementById('info-playerListText');
    const infoStaticTextColorInput = document.getElementById('info-staticTextColor');
    const infoLeaveButtonDefaultBgColorInput = document.getElementById('info-leaveButton-defaultBgColor');
    const infoLeaveButtonDefaultTextColorInput = document.getElementById('info-leaveButton-defaultTextColor');
    const connectionOnlineBgColorInput = document.getElementById('connection-onlineBgColor');
    const connectionOnlineTextColorInput = document.getElementById('connection-onlineTextColor');
    const connectionOfflineBgColorInput = document.getElementById('connection-offlineBgColor');
    const connectionOfflineTextColorInput = document.getElementById('connection-offlineTextColor');
    const connectionConnectingBgColorInput = document.getElementById('connection-connectingBgColor');
    const connectionConnectingTextColorInput = document.getElementById('connection-connectingTextColor');
    const modalOverlayBgColorInput = document.getElementById('modal-overlayBgColor');
    const modalContentBgColorInput = document.getElementById('modal-contentBgColor');
    const modalHeaderBgColorInput_Template = document.getElementById('modal-headerBgColor');
    const modalHeaderTextColorInput = document.getElementById('modal-headerTextColor');
    const modalBodyTextColorInput = document.getElementById('modal-bodyTextColor');

    // 地圖格子編輯器元素
    const adminMapGrid = document.getElementById('admin-map-grid');

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

    // --- 初始化 ---
    loadTemplateList();

    // --- 事件監聽器 ---
    loadTemplateBtn.addEventListener('click', handleLoadTemplate);
    newTemplateBtn.addEventListener('click', handleNewTemplate);
    saveTemplateBtn.addEventListener('click', handleSaveTemplate);
    deleteTemplateBtn.addEventListener('click', handleDeleteTemplate);
    saveModalChangesBtn.addEventListener('click', saveModalChangesToLocal);

    // --- 模板相關函數 ---
    async function loadTemplateList() {
        try {
            const response = await fetch('/api/admin/walk_map/templates');
            if (!response.ok) throw new Error(`無法獲取模板列表: ${response.statusText}`);
            const templates = await response.json();

            templateSelect.innerHTML = '<option value="">-- 請選擇或新增 --</option>';
            templates.forEach(t => {
                const option = document.createElement('option');
                option.value = t.template_id;
                option.textContent = t.template_name;
                templateSelect.appendChild(option);
            });
            console.log("模板列表已載入。");
        } catch (error) {
            displayStatus(`載入模板列表錯誤: ${error.message}`, true);
        }
    }

    async function handleLoadTemplate() {
        const selectedId = templateSelect.value;
        if (!selectedId) {
            displayStatus("請選擇一個模板來載入。", true);
            clearTemplateEditor();
            adminMapGrid.innerHTML = '';
            return;
        }
        clearTemplateEditor();
        try {
            const response = await fetch(`/api/admin/walk_map/templates/${selectedId}`);
            if (!response.ok) throw new Error(`無法載入模板 ${selectedId}: ${response.statusText}`);
            const template = await response.json();

            populateTemplateEditor(template);
            currentCellInfo = template.cell_data || createDefaultCellData();
            renderAdminGrid();

            templateEditor.classList.remove('hidden');
            deleteTemplateBtn.classList.remove('hidden');
            currentEditingTemplateId = selectedId;
            displayStatus(`模板 "${template.template_name}" 已載入。`);
        } catch (error) {
            displayStatus(`載入模板錯誤: ${error.message}`, true);
            templateEditor.classList.add('hidden');
            deleteTemplateBtn.classList.add('hidden');
            adminMapGrid.innerHTML = '';
            currentCellInfo = [];
        }
    }

    function handleNewTemplate() {
        clearTemplateEditor();
        templateIdInput.value = '';
        templateIdInput.readOnly = false;
        templateIdInput.placeholder = "請輸入英文ID (例如 new_style)";
        templateNameInput.value = "新的模板";

        currentCellInfo = createDefaultCellData();
        renderAdminGrid();

        templateEditor.classList.remove('hidden');
        deleteTemplateBtn.classList.add('hidden');
        currentEditingTemplateId = null;
        displayStatus("請為新模板輸入設定 (包含 ID)。格子資料已使用預設值。");
    }

    async function handleSaveTemplate() {
        const templateId = templateIdInput.value.trim();
        const templateName = templateNameInput.value.trim();
        if (!templateId || !templateName) {
            displayStatus("模板 ID 和名稱為必填項。", true);
            return;
        }
        if (!/^[a-z0-9_]+$/.test(templateId)) {
             displayStatus("模板 ID 只能包含小寫字母、數字和底線。", true);
             return;
        }

        const styleData = collectStyleData();
        const templateData = {
            template_id: templateId,
            template_name: templateName,
            description: templateDescriptionInput.value.trim(),
            style_data: styleData,
            cell_data: currentCellInfo
        };

        const isCreating = !currentEditingTemplateId;
        const method = isCreating ? 'POST' : 'PUT';
        const url = isCreating ? '/api/admin/walk_map/templates' : `/api/admin/walk_map/templates/${currentEditingTemplateId}`;

        if (!isCreating && templateId !== currentEditingTemplateId) {
             displayStatus("錯誤：無法在此表單更改現有模板的 ID。", true);
             templateIdInput.value = currentEditingTemplateId;
             return;
         }

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateData)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                 throw new Error(errorData.error || `儲存模板失敗: ${response.statusText}`);
            }
            const savedTemplateResult = await response.json();
            displayStatus(`模板 "${templateData.template_name}" (ID: ${templateData.template_id}) 已成功儲存！`);

            if (isCreating) {
                currentEditingTemplateId = templateData.template_id;
                templateIdInput.value = currentEditingTemplateId;
                templateIdInput.readOnly = true;
                deleteTemplateBtn.classList.remove('hidden');
                await loadTemplateList();
                templateSelect.value = currentEditingTemplateId;
            } else {
                 const option = templateSelect.querySelector(`option[value="${currentEditingTemplateId}"]`);
                 if (option && option.textContent !== templateName) {
                     option.textContent = templateName;
                 }
            }

        } catch (error) {
            displayStatus(`儲存模板錯誤: ${error.message}`, true);
        }
    }

    async function handleDeleteTemplate() {
        if (!currentEditingTemplateId) {
            displayStatus("未選擇要刪除的模板。", true);
            return;
        }
        const currentName = templateNameInput.value || `ID: ${currentEditingTemplateId}`;
        if (!confirm(`你確定要刪除模板 "${currentName}" (ID: ${currentEditingTemplateId}) 嗎？此操作無法復原。`)) {
            return;
        }
        try {
            const response = await fetch(`/api/admin/walk_map/templates/${currentEditingTemplateId}`, { method: 'DELETE' });
            if (!response.ok) {
                 if (response.status === 404) throw new Error("伺服器上找不到模板。");
                 const errorData = await response.json().catch(() => ({}));
                 throw new Error(errorData.error || `刪除模板失敗: ${response.statusText}`);
             }
            displayStatus(`模板 "${currentName}" 已成功刪除。`);
            clearTemplateEditor();
            adminMapGrid.innerHTML = '';
            currentCellInfo = [];
            await loadTemplateList();
            templateSelect.value = "";
        } catch (error) {
            displayStatus(`刪除模板錯誤: ${error.message}`, true);
        }
    }

    function populateTemplateEditor(template) {
        templateIdInput.value = template.template_id || '';
        templateIdInput.readOnly = !!template.template_id;
        templateNameInput.value = template.template_name || '';
        templateDescriptionInput.value = template.description || '';

        const styles = template.style_data || {};

        generalPageBgColorInput.value = styles.general?.pageBgColor || '#f5f5f5';
        generalPrimaryTextColorInput.value = styles.general?.primaryTextColor || '#333333';
        generalPrimaryFontFamilyInput.value = styles.general?.primaryFontFamily || '';
        headerHeaderBgColorInput.value = styles.header?.headerBgColor || '#4CAF50';
        headerHeaderTextColorInput.value = styles.header?.headerTextColor || '#FFFFFF';
        headerRoomInfoColorInput.value = styles.header?.roomInfoColor || '#FFFFFF';
        boardBorderColorInput.value = styles.board?.borderColor || '#4CAF50';
        boardBorderWidthInput.value = styles.board?.borderWidth || '2px';
        boardCenterBgColorInput.value = styles.board?.centerBgColor || '#e8f5e9';
        boardCenterImageUrlInput.value = styles.board?.centerImageUrl || '';
        mapCellDefaultBgColorInput.value = styles.mapCell?.defaultBgColor || '#FFFFFF';
        mapCellDefaultBorderColorInput.value = styles.mapCell?.defaultBorderColor || '#4CAF50';
        mapCellDefaultBorderWidthInput.value = styles.mapCell?.defaultBorderWidth || '1px';
        mapCellTitleTextColorInput.value = styles.mapCell?.titleTextColor || '#333333';
        mapCellNumberTextColorInput.value = styles.mapCell?.numberTextColor || '#777777';
        mapCellHoverBgColorInput.value = styles.mapCell?.hoverBgColor || '#e8f5e9';
        mapCellHoverBorderColorInput.value = styles.mapCell?.hoverBorderColor || '#3e8e41';
        playerMarkerShapeInput.value = styles.playerMarker?.shape || '50%';
        playerMarkerTextColorInput.value = styles.playerMarker?.textColor || '#FFFFFF';
        playerMarkerBoxShadowInput.value = styles.playerMarker?.boxShadow || '0 2px 4px rgba(0,0,0,0.2)';
        const playerColors = styles.playerMarker?.playerColors || [];
        playerMarkerColorInputs.forEach((input, i) => { input.value = playerColors[i] || '#cccccc'; });
        controllerPanelBackgroundInput.value = styles.controller?.panelBackground || '#FFFFFF';
        controllerPlayerLabelColorInput.value = styles.controller?.playerLabelColor || '#333333';
        controllerButtonDefaultBgColorInput.value = styles.controller?.controlButton?.defaultBgColor || '#4CAF50';
        controllerButtonDefaultTextColorInput.value = styles.controller?.controlButton?.defaultTextColor || '#FFFFFF';
        controllerButtonBorderRadiusInput.value = styles.controller?.controlButton?.borderRadius || '5px';
        controllerButtonHoverBgColorInput.value = styles.controller?.controlButton?.hoverBgColor || '#3e8e41';
        controllerButtonCooldownOpacityInput.value = styles.controller?.controlButton?.cooldownOpacity || '0.6';
        infoPanelBackgroundInput.value = styles.info?.panelBackground || '#FFFFFF';
        infoSectionTitleColorInput.value = styles.info?.sectionTitleColor || '#333333';
        infoPlayerListTextInput.value = styles.info?.playerListText || '#333333';
        infoStaticTextColorInput.value = styles.info?.staticTextColor || '#333333';
        infoLeaveButtonDefaultBgColorInput.value = styles.info?.leaveButton?.defaultBgColor || '#f1f1f1';
        infoLeaveButtonDefaultTextColorInput.value = styles.info?.leaveButton?.defaultTextColor || '#333333';
        connectionOnlineBgColorInput.value = styles.connection?.onlineBgColor || '#dff0d8';
        connectionOnlineTextColorInput.value = styles.connection?.onlineTextColor || '#3c763d';
        connectionOfflineBgColorInput.value = styles.connection?.offlineBgColor || '#f2dede';
        connectionOfflineTextColorInput.value = styles.connection?.offlineTextColor || '#a94442';
        connectionConnectingBgColorInput.value = styles.connection?.connectingBgColor || '#fcf8e3';
        connectionConnectingTextColorInput.value = styles.connection?.connectingTextColor || '#8a6d3b';
        modalOverlayBgColorInput.value = styles.modal?.overlayBgColor || 'rgba(0, 0, 0, 0.7)';
        modalContentBgColorInput.value = styles.modal?.contentBgColor || '#FFFFFF';
        modalHeaderBgColorInput_Template.value = styles.modal?.headerBgColor || '#4CAF50';
        modalHeaderTextColorInput.value = styles.modal?.headerTextColor || '#FFFFFF';
        modalBodyTextColorInput.value = styles.modal?.bodyTextColor || '#333333';
    }

    function collectStyleData() {
        const playerColors = playerMarkerColorInputs
            .map(input => input.value)
            .filter(color => color && color.toLowerCase() !== '#ffffff');

        return {
            general: {
                pageBgColor: generalPageBgColorInput.value,
                primaryTextColor: generalPrimaryTextColorInput.value,
                primaryFontFamily: generalPrimaryFontFamilyInput.value.trim() || null,
            },
            header: {
                headerBgColor: headerHeaderBgColorInput.value,
                headerTextColor: headerHeaderTextColorInput.value,
                roomInfoColor: headerRoomInfoColorInput.value,
            },
            board: {
                 borderColor: boardBorderColorInput.value,
                 borderWidth: boardBorderWidthInput.value.trim() || null,
                 centerBgColor: boardCenterBgColorInput.value,
                 centerImageUrl: boardCenterImageUrlInput.value.trim() || null,
            },
            mapCell: {
                 defaultBgColor: mapCellDefaultBgColorInput.value,
                 defaultBorderColor: mapCellDefaultBorderColorInput.value,
                 defaultBorderWidth: mapCellDefaultBorderWidthInput.value.trim() || null,
                 titleTextColor: mapCellTitleTextColorInput.value,
                 numberTextColor: mapCellNumberTextColorInput.value,
                 hoverBgColor: mapCellHoverBgColorInput.value,
                 hoverBorderColor: mapCellHoverBorderColorInput.value,
            },
            playerMarker: {
                shape: playerMarkerShapeInput.value.trim() || null,
                textColor: playerMarkerTextColorInput.value,
                boxShadow: playerMarkerBoxShadowInput.value.trim() || null,
                playerColors: playerColors.length > 0 ? playerColors : ["#1e88e5", "#ef5350", "#4caf50", "#ffb300", "#7e57c2"],
            },
            controller: {
                panelBackground: controllerPanelBackgroundInput.value,
                playerLabelColor: controllerPlayerLabelColorInput.value,
                controlButton: {
                     defaultBgColor: controllerButtonDefaultBgColorInput.value,
                     defaultTextColor: controllerButtonDefaultTextColorInput.value,
                     borderRadius: controllerButtonBorderRadiusInput.value.trim() || null,
                     hoverBgColor: controllerButtonHoverBgColorInput.value,
                     cooldownOpacity: controllerButtonCooldownOpacityInput.value.trim() || null,
                }
            },
            info: {
                panelBackground: infoPanelBackgroundInput.value,
                sectionTitleColor: infoSectionTitleColorInput.value,
                playerListText: infoPlayerListTextInput.value,
                staticTextColor: infoStaticTextColorInput.value,
                leaveButton: {
                    defaultBgColor: infoLeaveButtonDefaultBgColorInput.value,
                    defaultTextColor: infoLeaveButtonDefaultTextColorInput.value,
                }
            },
            connection: {
                 onlineBgColor: connectionOnlineBgColorInput.value,
                 onlineTextColor: connectionOnlineTextColorInput.value,
                 offlineBgColor: connectionOfflineBgColorInput.value,
                 offlineTextColor: connectionOfflineTextColorInput.value,
                 connectingBgColor: connectionConnectingBgColorInput.value,
                 connectingTextColor: connectionConnectingTextColorInput.value,
            },
            modal: {
                 overlayBgColor: modalOverlayBgColorInput.value.trim() || null,
                 contentBgColor: modalContentBgColorInput.value,
                 headerBgColor: modalHeaderBgColorInput_Template.value,
                 headerTextColor: modalHeaderTextColorInput.value,
                 bodyTextColor: modalBodyTextColorInput.value,
            }
        };
    }

    function clearTemplateEditor() {
        templateIdInput.value = '';
        templateIdInput.placeholder = '';
        templateIdInput.readOnly = false;
        templateNameInput.value = '';
        templateDescriptionInput.value = '';
        populateTemplateEditor({ style_data: {} });
        adminMapGrid.innerHTML = '';
        currentCellInfo = [];
        templateEditor.classList.add('hidden');
        deleteTemplateBtn.classList.add('hidden');
        currentEditingTemplateId = null;
        templateSelect.value = "";
    }

    // --- 地圖格子相關函數 ---
    function renderAdminGrid() {
        adminMapGrid.innerHTML = '';
        const totalCells = 24;

        if (!Array.isArray(currentCellInfo)) {
            console.error("currentCellInfo 不是陣列!", currentCellInfo);
            currentCellInfo = createDefaultCellData();
        }
        if (currentCellInfo.length !== totalCells) {
             console.warn(`格子資料數量 (${currentCellInfo.length}) 不等於預期的 ${totalCells}，將使用預設值填充。`);
             currentCellInfo = createDefaultCellData();
        }

        currentCellInfo.sort((a, b) => (a.cell_index || 0) - (b.cell_index || 0));
        for (let i = 0; i < totalCells; i++) {
             if (!currentCellInfo[i] || currentCellInfo[i].cell_index !== i) {
                 console.warn(`修復/替換索引 ${i} 的格子資料。`);
                 currentCellInfo[i] = {
                    cell_index: i, title: `預設 ${i}`, description: '', cell_bg_color: null, modal_header_bg_color: null
                 };
             }
        }

        currentCellInfo.forEach((cellData, i) => {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'admin-map-cell';
            cellDiv.id = `admin-cell-${i}`;
            cellDiv.dataset.cellIndex = i;

            const titleSpan = document.createElement('span');
            titleSpan.className = 'admin-cell-title';
            titleSpan.textContent = cellData.title || '(無標題)';

            const indexSpan = document.createElement('span');
            indexSpan.className = 'admin-cell-index';
            indexSpan.textContent = i;

            cellDiv.appendChild(titleSpan);
            cellDiv.appendChild(indexSpan);
            cellDiv.style.backgroundColor = cellData.cell_bg_color || '';

            cellDiv.addEventListener('click', () => { openCellEditModal(i); });
            adminMapGrid.appendChild(cellDiv);
        });
        applyGridPositioningCSS();
    }

    function applyGridPositioningCSS() {
         const cells = adminMapGrid.querySelectorAll('.admin-map-cell');
         cells.forEach(cell => {
            const i = parseInt(cell.dataset.cellIndex);
            // ★★★ 修正右下角和左下角的邏輯 ★★★
            if (i >= 0 && i <= 6) { // Top row (0-6)
                cell.style.gridArea = `${1} / ${i + 1} / ${2} / ${i + 2}`;
            } else if (i >= 7 && i <= 11) { // Right column excluding corner (7-11)
                cell.style.gridArea = `${i - 7 + 2} / ${7} / ${i - 7 + 3} / ${8}`;
            } else if (i === 12) { // Bottom right corner (12)
                 cell.style.gridArea = `7 / 7 / 8 / 8`;
            } else if (i >= 13 && i <= 18) { // Bottom row (13-18)
                cell.style.gridArea = `${7} / ${7 - (i - 12)} / ${8} / ${7 - (i - 12) + 1}`; // 調整計算基數
            } else if (i >= 19 && i <= 23) { // Left column (19-23)
                 cell.style.gridArea = `${7 - (i - 18)} / ${1} / ${7 - (i - 18) + 1} / ${2}`; // 調整計算基數
            }
         });
    }


    function openCellEditModal(index) {
         if (index < 0 || index >= currentCellInfo.length) {
             displayStatus(`錯誤：無效的格子索引 ${index}`, true);
             return;
         }
         const cellData = currentCellInfo[index];

        modalCellIndexDisplay.textContent = index;
        editingCellIndexInput.value = index;
        modalCellTitleInput.value = cellData.title || '';
        modalCellDescTextarea.value = cellData.description || '';
        modalCellBgColorInput.value = cellData.cell_bg_color || '#ffffff';
        modalCellBgColorInput.dataset.cleared = String(!cellData.cell_bg_color);
        modalModalHeaderBgColorInput.value = cellData.modal_header_bg_color || '#ffffff';
        modalModalHeaderBgColorInput.dataset.cleared = String(!cellData.modal_header_bg_color);

        cellEditModal.classList.remove('hidden');
    }

    function saveModalChangesToLocal() {
        const index = parseInt(editingCellIndexInput.value, 10);
        if (isNaN(index) || index < 0 || index >= currentCellInfo.length) {
            displayStatus("錯誤：無效的格子索引，無法儲存。", true);
            return;
        }
        const cellData = currentCellInfo[index];

        const newTitle = modalCellTitleInput.value.trim();
        const newDesc = modalCellDescTextarea.value.trim();
        let newBgColor = (modalCellBgColorInput.dataset.cleared === 'true')
                         ? null : modalCellBgColorInput.value;
        let newModalHeaderBgColor = (modalModalHeaderBgColorInput.dataset.cleared === 'true')
                                  ? null : modalModalHeaderBgColorInput.value;

        cellData.title = newTitle;
        cellData.description = newDesc;
        cellData.cell_bg_color = newBgColor;
        cellData.modal_header_bg_color = newModalHeaderBgColor;

        const adminCellDiv = document.getElementById(`admin-cell-${index}`);
        if (adminCellDiv) {
            const titleSpan = adminCellDiv.querySelector('.admin-cell-title');
            if (titleSpan) titleSpan.textContent = newTitle || '(無標題)';
            adminCellDiv.style.backgroundColor = newBgColor || '';
        }

        closeCellEditModal();
        displayStatus(`格子 ${index} 變更已應用。點擊「儲存模板樣式」以儲存所有變更。`);
    }

    // --- 工具函數 ---
    function displayStatus(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.className = isError ? 'status-error' : 'status-success';
        setTimeout(() => {
            if (statusMessage.textContent === message) {
                 statusMessage.textContent = '';
                 statusMessage.className = '';
            }
        }, 5000);
    }

    function createDefaultCellData() {
        const defaultCells = [];
        const defaultTitles = [
            "起點", "住宅區A", "機會", "住宅區B", "所得稅", "車站北站", "監獄(探訪)",
            "商業區A", "命運", "商業區B", "商業區C", "電廠", "免費停車",
            "住宅區D", "機會", "住宅區E", "車站西站", "公園", "命運", "住宅區F",
            "進監獄", "豪宅區A", "水廠", "豪宅區B"
        ];
        for (let i = 0; i < 24; i++) {
            defaultCells.push({
                cell_index: i,
                title: defaultTitles[i] || `格位 ${i}`,
                description: `這裡是 ${defaultTitles[i] || `格位 ${i}`}。`,
                cell_bg_color: null,
                modal_header_bg_color: null
            });
        }
        return defaultCells;
    }

    window.closeCellEditModal = closeCellEditModal;
    window.clearColorInput = (inputId) => {
         const input = document.getElementById(inputId);
         input.value = '#ffffff';
         input.dataset.cleared = 'true';
     };

}); // End DOMContentLoaded