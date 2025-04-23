 // rich-admin.js - 移動裝置優化版
        document.addEventListener('DOMContentLoaded', () => {
            // --- 添加移動設備檢測 ---
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                document.body.classList.add('mobile-view');
            }
            
            // --- DOM 元素 ---
            const templateSelect = document.getElementById('template-select');
            const loadTemplateBtn = document.getElementById('load-template-btn');
            const newTemplateBtn = document.getElementById('new-template-btn');
            const saveTemplateBtn = document.getElementById('save-template-btn');
            const deleteTemplateBtn = document.getElementById('delete-template-btn');
            const templateEditor = document.getElementById('template-editor');
            const statusMessage = document.getElementById('status-message');
        
            // --- 添加移動裝置的工具欄 ---
            if (isMobile) {
                createMobileToolbar();
            }
        
            // 樣式編輯器輸入框
            const templateIdInput = document.getElementById('template-id');
            const templateNameInput = document.getElementById('template-name');
            const templateDescriptionInput = document.getElementById('template-description');
            
            // 獲取所有樣式輸入框
            const styleInputs = {
                general: {
                    pageBgColor: document.getElementById('general-pageBgColor'),
                    primaryTextColor: document.getElementById('general-primaryTextColor'),
                    primaryFontFamily: document.getElementById('general-primaryFontFamily')
                },
                header: {
                    headerBgColor: document.getElementById('header-headerBgColor'),
                    headerTextColor: document.getElementById('header-headerTextColor'),
                    roomInfoColor: document.getElementById('header-roomInfoColor')
                },
                board: {
                    borderColor: document.getElementById('board-borderColor'),
                    borderWidth: document.getElementById('board-borderWidth'),
                    centerBgColor: document.getElementById('board-centerBgColor'),
                    centerImageUrl: document.getElementById('board-centerImageUrl')
                },
                mapCell: {
                    defaultBgColor: document.getElementById('mapCell-defaultBgColor'),
                    defaultBorderColor: document.getElementById('mapCell-defaultBorderColor'),
                    defaultBorderWidth: document.getElementById('mapCell-defaultBorderWidth'),
                    titleTextColor: document.getElementById('mapCell-titleTextColor'),
                    numberTextColor: document.getElementById('mapCell-numberTextColor'),
                    hoverBgColor: document.getElementById('mapCell-hoverBgColor'),
                    hoverBorderColor: document.getElementById('mapCell-hoverBorderColor')
                },
                playerMarker: {
                    shape: document.getElementById('playerMarker-shape'),
                    textColor: document.getElementById('playerMarker-textColor'),
                    boxShadow: document.getElementById('playerMarker-boxShadow'),
                    colors: [
                        document.getElementById('playerMarker-color1'),
                        document.getElementById('playerMarker-color2'),
                        document.getElementById('playerMarker-color3'),
                        document.getElementById('playerMarker-color4'),
                        document.getElementById('playerMarker-color5')
                    ]
                },
                controller: {
                    panelBackground: document.getElementById('controller-panelBackground'),
                    playerLabelColor: document.getElementById('controller-playerLabelColor'),
                    button: {
                        defaultBgColor: document.getElementById('controller-button-defaultBgColor'),
                        defaultTextColor: document.getElementById('controller-button-defaultTextColor'),
                        borderRadius: document.getElementById('controller-button-borderRadius'),
                        hoverBgColor: document.getElementById('controller-button-hoverBgColor'),
                        cooldownOpacity: document.getElementById('controller-button-cooldownOpacity')
                    }
                },
                info: {
                    panelBackground: document.getElementById('info-panelBackground'),
                    sectionTitleColor: document.getElementById('info-sectionTitleColor'),
                    playerListText: document.getElementById('info-playerListText'),
                    staticTextColor: document.getElementById('info-staticTextColor'),
                    leaveButton: {
                        defaultBgColor: document.getElementById('info-leaveButton-defaultBgColor'),
                        defaultTextColor: document.getElementById('info-leaveButton-defaultTextColor')
                    }
                },
                connection: {
                    onlineBgColor: document.getElementById('connection-onlineBgColor'),
                    onlineTextColor: document.getElementById('connection-onlineTextColor'),
                    offlineBgColor: document.getElementById('connection-offlineBgColor'),
                    offlineTextColor: document.getElementById('connection-offlineTextColor'),
                    connectingBgColor: document.getElementById('connection-connectingBgColor'),
                    connectingTextColor: document.getElementById('connection-connectingTextColor')
                },
                modal: {
                    overlayBgColor: document.getElementById('modal-overlayBgColor'),
                    contentBgColor: document.getElementById('modal-contentBgColor'),
                    headerBgColor: document.getElementById('modal-headerBgColor'),
                    headerTextColor: document.getElementById('modal-headerTextColor'),
                    bodyTextColor: document.getElementById('modal-bodyTextColor')
                }
            };
        
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
            let activeSection = null; // 用於跟踪當前開啟的折疊區段
            
            // --- 初始化 ---
            setupResponsiveUI();
            loadTemplateList();
        
            // --- 事件監聽器 ---
            loadTemplateBtn.addEventListener('click', handleLoadTemplate);
            newTemplateBtn.addEventListener('click', handleNewTemplate);
            saveTemplateBtn.addEventListener('click', handleSaveTemplate);
            deleteTemplateBtn.addEventListener('click', handleDeleteTemplate);
            saveModalChangesBtn.addEventListener('click', saveModalChangesToLocal);
            
            // 為顏色輸入添加實時預覽
            addColorPreviewHandlers();
            
            // 為欄位添加標籤觸控支持
            addLabelTapSupport();
            
            // 設置窗口尺寸變化處理
            window.addEventListener('resize', debounce(() => {
                const wasMobile = document.body.classList.contains('mobile-view');
                const isMobileNow = window.innerWidth <= 768;
                
                if (wasMobile !== isMobileNow) {
                    document.body.classList.toggle('mobile-view', isMobileNow);
                    setupResponsiveUI();
                }
            }, 250));
        
            // --- 響應式 UI 設置 ---
            function setupResponsiveUI() {
                const isMobile = window.innerWidth <= 768;
                
                // 設置折疊功能
                if (isMobile) {
                    setupMobileCollapsibles();
                } else {
                    removeMobileCollapsibles();
                }
                
                // 調整格子編輯器大小
                updateGridSize();
            }
            
            function createMobileToolbar() {
                const toolbar = document.createElement('div');
                toolbar.className = 'mobile-toolbar';
                toolbar.innerHTML = `
                    <button id="back-to-top" title="回到頂部">↑</button>
                    <button id="jump-to-grid" title="前往地圖編輯器">🗺️</button>
                    <button id="jump-to-save" title="前往儲存區域">💾</button>
                `;
                document.body.appendChild(toolbar);
                
                document.getElementById('back-to-top').addEventListener('click', () => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
                
                document.getElementById('jump-to-grid').addEventListener('click', () => {
                    const gridSection = document.getElementById('cell-editor');
                    gridSection.scrollIntoView({ behavior: 'smooth' });
                });
                
                document.getElementById('jump-to-save').addEventListener('click', () => {
                    saveTemplateBtn.scrollIntoView({ behavior: 'smooth' });
                });
            }
            
            function setupMobileCollapsibles() {
                // 為每個字段集添加折疊功能
                const fieldsets = document.querySelectorAll('fieldset');
                fieldsets.forEach(fieldset => {
                    if (!fieldset.classList.contains('collapsible-ready')) {
                        const legend = fieldset.querySelector('legend');
                        if (legend) {
                            legend.innerHTML = `<span class="toggle-icon">▼</span> ${legend.innerHTML}`;
                            legend.style.cursor = 'pointer';
                            legend.addEventListener('click', toggleFieldset);
                        }
                        
                        // 如果不是嵌套的 fieldset，則默認折疊
                        if (!fieldset.closest('fieldset fieldset')) {
                            const content = Array.from(fieldset.children).filter(el => el.tagName !== 'LEGEND');
                            content.forEach(el => el.style.display = 'none');
                            const icon = fieldset.querySelector('.toggle-icon');
                            if (icon) icon.textContent = '►';
                        }
                        
                        fieldset.classList.add('collapsible-ready');
                    }
                });
            }
            
            function removeMobileCollapsibles() {
                // 移除折疊並顯示所有內容
                const fieldsets = document.querySelectorAll('fieldset.collapsible-ready');
                fieldsets.forEach(fieldset => {
                    const content = Array.from(fieldset.children).filter(el => el.tagName !== 'LEGEND');
                    content.forEach(el => el.style.display = '');
                    
                    const icon = fieldset.querySelector('.toggle-icon');
                    if (icon) icon.textContent = '▼';
                });
            }
            
            function toggleFieldset(e) {
                const legend = e.currentTarget;
                const fieldset = legend.parentElement;
                const content = Array.from(fieldset.children).filter(el => el.tagName !== 'LEGEND');
                const icon = legend.querySelector('.toggle-icon');
                
                const isCollapsed = content[0] && content[0].style.display === 'none';
                
                if (isCollapsed) {
                    // 如果有活動的區段且不是當前區段，則折疊它
                    if (activeSection && activeSection !== fieldset) {
                        const activeLegend = activeSection.querySelector('legend');
                        const activeContent = Array.from(activeSection.children).filter(el => el.tagName !== 'LEGEND');
                        const activeIcon = activeLegend.querySelector('.toggle-icon');
                        
                        activeContent.forEach(el => el.style.display = 'none');
                        if (activeIcon) activeIcon.textContent = '►';
                    }
                    
                    // 展開當前區段
                    content.forEach(el => el.style.display = '');
                    if (icon) icon.textContent = '▼';
                    activeSection = fieldset;
                } else {
                    // 折疊當前區段
                    content.forEach(el => el.style.display = 'none');
                    if (icon) icon.textContent = '►';
                    activeSection = null;
                }
            }
            
            function updateGridSize() {
                const gridContainer = document.getElementById('admin-map-grid-container');
                if (!gridContainer) return;
                
                const isMobile = window.innerWidth <= 768;
                
                if (isMobile) {
                    // 在移動設備上，使用更適合觸控的大小
                    gridContainer.style.maxWidth = '100%';
                    
                    // 調整所有單元格的字體大小
                    const cells = document.querySelectorAll('.admin-map-cell');
                    cells.forEach(cell => {
                        const title = cell.querySelector('.admin-cell-title');
                        const index = cell.querySelector('.admin-cell-index');
                        
                        if (title) title.style.fontSize = '10px';
                        if (index) index.style.fontSize = '9px';
                    });
                } else {
                    // 恢復桌面大小
                    gridContainer.style.maxWidth = '700px';
                    
                    // 恢復默認字體大小
                    const cells = document.querySelectorAll('.admin-map-cell');
                    cells.forEach(cell => {
                        const title = cell.querySelector('.admin-cell-title');
                        const index = cell.querySelector('.admin-cell-index');
                        
                        if (title) title.style.fontSize = '';
                        if (index) index.style.fontSize = '';
                    });
                }
            }
            
            function addColorPreviewHandlers() {
                // 為所有顏色輸入添加實時預覽
                document.querySelectorAll('input[type="color"]').forEach(input => {
                    input.addEventListener('input', () => {
                        const label = input.closest('.form-group').querySelector('label');
                        if (label) {
                            // 提取變量名
                            const varName = label.textContent.split(':')[0].trim().toLowerCase().replace(/\s+/g, '-');
                            updatePreviewColor(varName, input.value);
                        }
                    });
                });
            }
            
            function updatePreviewColor(varName, value) {
                // 這個函數會根據輸入的值更新 CSS 變量，從而實時預覽變化
                // 由於我們沒有明確的映射，這裡使用一個簡單的方法
                
                // 嘗試映射常見的變量名
                const mappings = {
                    'page-background-color': '--template-page-bg-color',
                    'primary-text-color': '--template-primary-text-color',
                    'header-background-color': '--template-header-bg-color',
                    'header-text-color': '--template-header-text-color',
                    'border-color': '--template-board-border-color',
                    'default-background-color': '--template-cell-default-bg',
                    'default-border-color': '--template-cell-default-border-color',
                    'title-text-color': '--template-cell-title-text-color',
                    'number-text-color': '--template-cell-number-text-color',
                    'hover-background-color': '--template-cell-hover-bg-color',
                    'hover-border-color': '--template-cell-hover-border-color',
                    'header-bg-color': '--template-modal-header-bg-color'
                };
                
                const cssVar = mappings[varName] || null;
                if (cssVar) {
                    document.documentElement.style.setProperty(cssVar, value);
                }
            }
            
            function addLabelTapSupport() {
                // 在移動設備上，點擊標籤時聚焦對應的輸入框
                document.querySelectorAll('.form-group label').forEach(label => {
                    label.addEventListener('click', (e) => {
                        if (window.innerWidth <= 768) {
                            const input = label.nextElementSibling;
                            if (input && (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA')) {
                                input.focus();
                                e.preventDefault();
                            }
                        }
                    });
                });
            }
        
            // --- 模板相關函數 ---
            async function loadTemplateList() {
                try {
                    showLoader();
                    const response = await fetch('/api/admin/walk_map/templates');
                    hideLoader();
                    
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
                    hideLoader();
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
                    showLoader();
                    const response = await fetch(`/api/admin/walk_map/templates/${selectedId}`);
                    hideLoader();
                    
                    if (!response.ok) throw new Error(`無法載入模板 ${selectedId}: ${response.statusText}`);
                    const template = await response.json();
        
                    populateTemplateEditor(template);
                    currentCellInfo = template.cell_data || createDefaultCellData();
                    renderAdminGrid();
        
                    templateEditor.classList.remove('hidden');
                    deleteTemplateBtn.classList.remove('hidden');
                    currentEditingTemplateId = selectedId;
                    displayStatus(`模板 "${template.template_name}" 已載入。`);
                    
                    // 移動設備上聚焦到模板名稱
                    if (window.innerWidth <= 768) {
                        templateNameInput.scrollIntoView({ behavior: 'smooth' });
                    }
                } catch (error) {
                    hideLoader();
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
                
                // 移動設備上聚焦到模板ID
                if (window.innerWidth <= 768) {
                    templateIdInput.scrollIntoView({ behavior: 'smooth' });
                    setTimeout(() => templateIdInput.focus(), 300);
                }
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
                    showLoader();
                    const response = await fetch(url, {
                        method: method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(templateData)
                    });
                    hideLoader();
                    
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
                    hideLoader();
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
                    showLoader();
                    const response = await fetch(`/api/admin/walk_map/templates/${currentEditingTemplateId}`, { method: 'DELETE' });
                    hideLoader();
                    
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
                    hideLoader();
                    displayStatus(`刪除模板錯誤: ${error.message}`, true);
                }
            }
        
            function collectStyleData() {
                const playerColors = styleInputs.playerMarker.colors
                    .map(input => input.value)
                    .filter(color => color && color.toLowerCase() !== '#ffffff');
        
                return {
                    general: {
                        pageBgColor: styleInputs.general.pageBgColor.value,
                        primaryTextColor: styleInputs.general.primaryTextColor.value,
                        primaryFontFamily: styleInputs.general.primaryFontFamily.value.trim() || null,
                    },
                    header: {
                        headerBgColor: styleInputs.header.headerBgColor.value,
                        headerTextColor: styleInputs.header.headerTextColor.value,
                        roomInfoColor: styleInputs.header.roomInfoColor.value,
                    },
                    board: {
                         borderColor: styleInputs.board.borderColor.value,
                         borderWidth: styleInputs.board.borderWidth.value.trim() || null,
                         centerBgColor: styleInputs.board.centerBgColor.value,
                         centerImageUrl: styleInputs.board.centerImageUrl.value.trim() || null,
                    },
                    mapCell: {
                         defaultBgColor: styleInputs.mapCell.defaultBgColor.value,
                         defaultBorderColor: styleInputs.mapCell.defaultBorderColor.value,
                         defaultBorderWidth: styleInputs.mapCell.defaultBorderWidth.value.trim() || null,
                         titleTextColor: styleInputs.mapCell.titleTextColor.value,
                         numberTextColor: styleInputs.mapCell.numberTextColor.value,
                         hoverBgColor: styleInputs.mapCell.hoverBgColor.value,
                         hoverBorderColor: styleInputs.mapCell.hoverBorderColor.value,
                    },
                    playerMarker: {
                        shape: styleInputs.playerMarker.shape.value.trim() || null,
                        textColor: styleInputs.playerMarker.textColor.value,
                        boxShadow: styleInputs.playerMarker.boxShadow.value.trim() || null,
                        playerColors: playerColors.length > 0 ? playerColors : ["#1e88e5", "#ef5350", "#4caf50", "#ffb300", "#7e57c2"],
                    },
                    controller: {
                        panelBackground: styleInputs.controller.panelBackground.value,
                        playerLabelColor: styleInputs.controller.playerLabelColor.value,
                        controlButton: {
                             defaultBgColor: styleInputs.controller.button.defaultBgColor.value,
                             defaultTextColor: styleInputs.controller.button.defaultTextColor.value,
                             borderRadius: styleInputs.controller.button.borderRadius.value.trim() || null,
                             hoverBgColor: styleInputs.controller.button.hoverBgColor.value,
                             cooldownOpacity: styleInputs.controller.button.cooldownOpacity.value.trim() || null,
                        }
                    },
                    info: {
                        panelBackground: styleInputs.info.panelBackground.value,
                        sectionTitleColor: styleInputs.info.sectionTitleColor.value,
                        playerListText: styleInputs.info.playerListText.value,
                        staticTextColor: styleInputs.info.staticTextColor.value,
                        leaveButton: {
                            defaultBgColor: styleInputs.info.leaveButton.defaultBgColor.value,
                            defaultTextColor: styleInputs.info.leaveButton.defaultTextColor.value,
                        }
                    },
                    connection: {
                         onlineBgColor: styleInputs.connection.onlineBgColor.value,
                         onlineTextColor: styleInputs.connection.onlineTextColor.value,
                         offlineBgColor: styleInputs.connection.offlineBgColor.value,
                         offlineTextColor: styleInputs.connection.offlineTextColor.value,
                         connectingBgColor: styleInputs.connection.connectingBgColor.value,
                         connectingTextColor: styleInputs.connection.connectingTextColor.value,
                    },
                    modal: {
                         overlayBgColor: styleInputs.modal.overlayBgColor.value.trim() || null,
                         contentBgColor: styleInputs.modal.contentBgColor.value,
                         headerBgColor: styleInputs.modal.headerBgColor.value,
                         headerTextColor: styleInputs.modal.headerTextColor.value,
                         bodyTextColor: styleInputs.modal.bodyTextColor.value,
                    }
                };
            }
        
            function populateTemplateEditor(template) {
                templateIdInput.value = template.template_id || '';
                templateIdInput.readOnly = !!template.template_id;
                templateNameInput.value = template.template_name || '';
                templateDescriptionInput.value = template.description || '';
        
                const styles = template.style_data || {};
        
                // General section
                styleInputs.general.pageBgColor.value = styles.general?.pageBgColor || '#f5f5f5';
                styleInputs.general.primaryTextColor.value = styles.general?.primaryTextColor || '#333333';
                styleInputs.general.primaryFontFamily.value = styles.general?.primaryFontFamily || '';
                
                // Header section
                styleInputs.header.headerBgColor.value = styles.header?.headerBgColor || '#4CAF50';
                styleInputs.header.headerTextColor.value = styles.header?.headerTextColor || '#FFFFFF';
                styleInputs.header.roomInfoColor.value = styles.header?.roomInfoColor || '#FFFFFF';
                
                // Board section
                styleInputs.board.borderColor.value = styles.board?.borderColor || '#4CAF50';
                styleInputs.board.borderWidth.value = styles.board?.borderWidth || '2px';
                styleInputs.board.centerBgColor.value = styles.board?.centerBgColor || '#e8f5e9';
                styleInputs.board.centerImageUrl.value = styles.board?.centerImageUrl || '';
                
                // Map Cell section
                styleInputs.mapCell.defaultBgColor.value = styles.mapCell?.defaultBgColor || '#FFFFFF';
                styleInputs.mapCell.defaultBorderColor.value = styles.mapCell?.defaultBorderColor || '#4CAF50';
                styleInputs.mapCell.defaultBorderWidth.value = styles.mapCell?.defaultBorderWidth || '1px';
                styleInputs.mapCell.titleTextColor.value = styles.mapCell?.titleTextColor || '#333333';
                styleInputs.mapCell.numberTextColor.value = styles.mapCell?.numberTextColor || '#777777';
                styleInputs.mapCell.hoverBgColor.value = styles.mapCell?.hoverBgColor || '#e8f5e9';
                styleInputs.mapCell.hoverBorderColor.value = styles.mapCell?.hoverBorderColor || '#3e8e41';
                
                // Player Marker section
                styleInputs.playerMarker.shape.value = styles.playerMarker?.shape || '50%';
                styleInputs.playerMarker.textColor.value = styles.playerMarker?.textColor || '#FFFFFF';
                styleInputs.playerMarker.boxShadow.value = styles.playerMarker?.boxShadow || '0 2px 4px rgba(0,0,0,0.2)';
                
                const playerColors = styles.playerMarker?.playerColors || [];
                styleInputs.playerMarker.colors.forEach((input, i) => { 
                    input.value = playerColors[i] || '#cccccc'; 
                });
                
                // Controller section
                styleInputs.controller.panelBackground.value = styles.controller?.panelBackground || '#FFFFFF';
                styleInputs.controller.playerLabelColor.value = styles.controller?.playerLabelColor || '#333333';
                styleInputs.controller.button.defaultBgColor.value = styles.controller?.controlButton?.defaultBgColor || '#4CAF50';
                styleInputs.controller.button.defaultTextColor.value = styles.controller?.controlButton?.defaultTextColor || '#FFFFFF';
                styleInputs.controller.button.borderRadius.value = styles.controller?.controlButton?.borderRadius || '5px';
                styleInputs.controller.button.hoverBgColor.value = styles.controller?.controlButton?.hoverBgColor || '#3e8e41';
                styleInputs.controller.button.cooldownOpacity.value = styles.controller?.controlButton?.cooldownOpacity || '0.6';
                
                // Info section
                styleInputs.info.panelBackground.value = styles.info?.panelBackground || '#FFFFFF';
                styleInputs.info.sectionTitleColor.value = styles.info?.sectionTitleColor || '#333333';
                styleInputs.info.playerListText.value = styles.info?.playerListText || '#333333';
                styleInputs.info.staticTextColor.value = styles.info?.staticTextColor || '#333333';
                styleInputs.info.leaveButton.defaultBgColor.value = styles.info?.leaveButton?.defaultBgColor || '#f1f1f1';
                styleInputs.info.leaveButton.defaultTextColor.value = styles.info?.leaveButton?.defaultTextColor || '#333333';
                
                // Connection section
                styleInputs.connection.onlineBgColor.value = styles.connection?.onlineBgColor || '#dff0d8';
                styleInputs.connection.onlineTextColor.value = styles.connection?.onlineTextColor || '#3c763d';
                styleInputs.connection.offlineBgColor.value = styles.connection?.offlineBgColor || '#f2dede';
                styleInputs.connection.offlineTextColor.value = styles.connection?.offlineTextColor || '#a94442';
                styleInputs.connection.connectingBgColor.value = styles.connection?.connectingBgColor || '#fcf8e3';
                styleInputs.connection.connectingTextColor.value = styles.connection?.connectingTextColor || '#8a6d3b';
                
                // Modal section
                styleInputs.modal.overlayBgColor.value = styles.modal?.overlayBgColor || 'rgba(0, 0, 0, 0.7)';
                styleInputs.modal.contentBgColor.value = styles.modal?.contentBgColor || '#FFFFFF';
                styleInputs.modal.headerBgColor.value = styles.modal?.headerBgColor || '#4CAF50';
                styleInputs.modal.headerTextColor.value = styles.modal?.headerTextColor || '#FFFFFF';
                styleInputs.modal.bodyTextColor.value = styles.modal?.bodyTextColor || '#333333';
                
                // 更新預覽
                updatePreviewVariables();
            }  




            function updatePreviewVariables() {
                // 更新所有顯示預覽的 CSS 變量
                const styleData = collectStyleData();
                
                // 更新一般設置
                document.documentElement.style.setProperty('--template-page-bg-color', styleData.general.pageBgColor);
                document.documentElement.style.setProperty('--template-primary-text-color', styleData.general.primaryTextColor);
                
                // 更新頁眉設置
                document.documentElement.style.setProperty('--template-header-bg-color', styleData.header.headerBgColor);
                document.documentElement.style.setProperty('--template-header-text-color', styleData.header.headerTextColor);
                
                // 更新棋盤設置
                document.documentElement.style.setProperty('--template-board-border-color', styleData.board.borderColor);
                
                // 更新格子設置
                document.documentElement.style.setProperty('--template-cell-default-bg', styleData.mapCell.defaultBgColor);
                document.documentElement.style.setProperty('--template-cell-default-border-color', styleData.mapCell.defaultBorderColor);
                document.documentElement.style.setProperty('--template-cell-title-text-color', styleData.mapCell.titleTextColor);
                document.documentElement.style.setProperty('--template-cell-number-text-color', styleData.mapCell.numberTextColor);
                document.documentElement.style.setProperty('--template-cell-hover-bg-color', styleData.mapCell.hoverBgColor);
                document.documentElement.style.setProperty('--template-cell-hover-border-color', styleData.mapCell.hoverBorderColor);
                
                // 更新模態框設置
                document.documentElement.style.setProperty('--template-modal-header-bg-color', styleData.modal.headerBgColor);
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
                
                // 清除已展開的區段
                activeSection = null;
            }
             
            
            
            
            

            // 添加加載提示功能
function showLoader() {
    // 檢查是否已存在加載器
    if (document.getElementById('page-loader')) return;
    
    const loader = document.createElement('div');
    loader.id = 'page-loader';
    loader.innerHTML = `
        <div class="loader-content">
            <div class="spinner"></div>
            <div class="loader-text">處理中...</div>
        </div>
    `;
    document.body.appendChild(loader);
    document.body.classList.add('loading');
}

function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(loader);
            document.body.classList.remove('loading');
        }, 300);
    }
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
    
    // 添加一個控制標籤
    const gridLabel = document.createElement('h3');
    gridLabel.className = 'grid-title';
    gridLabel.textContent = '地圖格子預覽 (點擊格子進行編輯)';
    adminMapGrid.parentElement.insertBefore(gridLabel, adminMapGrid);

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
        // ★★★ 格子位置設置 ★★★
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

    // 更新模態框標題顯示
    document.getElementById('modal-cell-title-display').textContent = '編輯格子';
    modalCellIndexDisplay.textContent = index;
    editingCellIndexInput.value = index;
    modalCellTitleInput.value = cellData.title || '';
    modalCellDescTextarea.value = cellData.description || '';
    modalCellBgColorInput.value = cellData.cell_bg_color || '#ffffff';
    modalCellBgColorInput.dataset.cleared = String(!cellData.cell_bg_color);
    modalModalHeaderBgColorInput.value = cellData.modal_header_bg_color || '#ffffff';
    modalModalHeaderBgColorInput.dataset.cleared = String(!cellData.modal_header_bg_color);

    cellEditModal.classList.remove('hidden');
    
    // 在移動設備上，調整模態框的位置和大小
    if (window.innerWidth <= 768) {
        const modalContent = cellEditModal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.width = '90%';
            modalContent.style.maxHeight = '80vh';
            modalContent.style.overflow = 'auto';
            
            // 確保輸入框自動聚焦
            setTimeout(() => modalCellTitleInput.focus(), 100);
        }
    }
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
    
    // 顯示帶有確認按鈕的狀態消息
    const message = `格子 ${index} 變更已應用。`;
    
    if (window.innerWidth <= 768) {
        displayStatusWithAction(
            message, 
            '儲存全部', 
            () => {
                saveTemplateBtn.scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => saveTemplateBtn.classList.add('highlight-btn'), 500);
                setTimeout(() => saveTemplateBtn.classList.remove('highlight-btn'), 3000);
            }
        );
    } else {
        displayStatus(`${message}點擊「儲存模板樣式」以儲存所有變更。`);
    }
}

function displayStatusWithAction(message, actionText, actionCallback) {
    // 移除先前的狀態消息
    const oldStatus = document.getElementById('status-message');
    if (oldStatus.querySelector('.action-btn')) {
        oldStatus.innerHTML = '';
    }
    
    // 創建新的帶按鈕的狀態消息
    oldStatus.className = 'status-success';
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    oldStatus.appendChild(messageSpan);
    
    const actionButton = document.createElement('button');
    actionButton.className = 'action-btn';
    actionButton.textContent = actionText;
    actionButton.addEventListener('click', actionCallback);
    
    oldStatus.appendChild(actionButton);
    
    // 自動隱藏
    setTimeout(() => {
        if (oldStatus.contains(actionButton)) {
            oldStatus.innerHTML = '';
            oldStatus.className = '';
        }
    }, 8000);
}

// --- 工具函數 ---
function displayStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = isError ? 'status-error' : 'status-success';
    
    // 在移動設備上，確保狀態訊息可見
    if (window.innerWidth <= 768 && !isInViewport(statusMessage)) {
        statusMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    // 自動隱藏狀態訊息
    setTimeout(() => {
        if (statusMessage.textContent === message) {
             statusMessage.textContent = '';
             statusMessage.className = '';
        }
    }, isError ? 8000 : 5000); // 錯誤訊息顯示時間更長
}

// 檢查元素是否在視口中
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
    );
}

// 防抖函數，用於處理窗口大小調整等頻繁事件
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
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

// 關閉格子編輯彈窗
function closeCellEditModal() {
    cellEditModal.classList.add('hidden');
}

window.closeCellEditModal = closeCellEditModal;
window.clearColorInput = (inputId) => {
     const input = document.getElementById(inputId);
     input.value = '#ffffff';
     input.dataset.cleared = 'true';
     
     // 若有對應的預覽變數，也要更新
     const label = input.closest('.form-group').querySelector('label');
     if (label) {
         const varName = label.textContent.split(':')[0].trim().toLowerCase().replace(/\s+/g, '-');
         // 簡單判斷是否可能與預覽相關
         if (varName.includes('bg-color') || varName.includes('background')) {
             updatePreviewColor(varName, '');
         }
     }
 };
 
// 添加鍵盤快捷鍵支持
document.addEventListener('keydown', (e) => {
    // Ctrl+S 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (templateEditor.classList.contains('hidden')) return;
        saveTemplateBtn.click();
    }
    
    // Esc 關閉模態框
    if (e.key === 'Escape') {
        if (!cellEditModal.classList.contains('hidden')) {
            closeCellEditModal();
        }
    }
});

// 在加載完成時執行最終的初始化
setTimeout(() => {
    // 添加移動友好的提示
    if (isMobile) {
        const topTip = document.createElement('div');
        topTip.className = 'mobile-tip';
        topTip.textContent = '提示：點擊標題可以展開/收起設定區域';
        templateEditor.insertBefore(topTip, templateEditor.firstChild);
        
        // 監聽手勢
        setupTouchGestures();
    }
}, 1000);

// 設置觸摸手勢 (簡單的左右滑動)
function setupTouchGestures() {
    let startX, startY;
    const minSwipeDistance = 50;
    
    document.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        if (!startX || !startY) return;
        
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        
        const diffX = endX - startX;
        const diffY = endY - startY;
        
        // 水平滑動距離要大於垂直滑動
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance) {
            // 從右向左滑動：前往下一個區域
            if (diffX < 0) {
                const cellEditor = document.getElementById('cell-editor');
                if (cellEditor && isInViewport(cellEditor)) {
                    saveTemplateBtn.scrollIntoView({ behavior: 'smooth' });
                } else {
                    document.getElementById('cell-editor').scrollIntoView({ behavior: 'smooth' });
                }
            }
            // 從左向右滑動：返回上一個區域
            else {
                const templateSection = document.querySelector('#template-editor > h2');
                if (templateSection) {
                    templateSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        }
        
        startX = null;
        startY = null;
    }, { passive: true });
}

}); // End DOMContentLoaded