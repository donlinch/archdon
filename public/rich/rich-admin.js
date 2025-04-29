// 移動設備優化的 JavaScript 代碼

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
    
    // 獲取所有樣式輸入框 (保持原有的結構)
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
    initializeColorHexFields();

    // --- 事件監聽器 ---
    loadTemplateBtn.addEventListener('click', handleLoadTemplate);
    newTemplateBtn.addEventListener('click', handleNewTemplate);
    saveTemplateBtn.addEventListener('click', handleSaveTemplate);
    deleteTemplateBtn.addEventListener('click', handleDeleteTemplate);
    saveModalChangesBtn.addEventListener('click', saveModalChangesToLocal);

    const saveAsTemplateBtn = document.getElementById('save-as-template-btn');
    saveAsTemplateBtn.addEventListener('click', handleSaveAsTemplate);

    
    
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

    
// 增强 initializeColorHexFields 函數 - 確保顏色同步更新
function initializeColorHexFields() {
    const colorInputs = document.querySelectorAll('input[type="color"]');
    const hexInputs = document.querySelectorAll('.color-hex');
    
    // 顏色選擇器更改時更新文本框
    colorInputs.forEach(input => {
        // 移除之前的事件監聽器以避免重複
        input.removeEventListener('input', updateHexFromColor);
        input.addEventListener('input', updateHexFromColor);
        
        // 初始化賦值
        if (input.value) {
            updateHexFromColorElement(input);
        }
    });
    
    // 文本框更改時更新顏色選擇器
    hexInputs.forEach(input => {
        // 移除之前的事件監聽器以避免重複
        input.removeEventListener('input', updateColorFromHex);
        input.addEventListener('input', updateColorFromHex);
    });
}


// 從顏色選擇器更新十六進制值
function updateHexFromColor() {
    const hexInput = document.querySelector(`.color-hex[data-color-for="${this.id}"]`);
    if (hexInput) {
        hexInput.value = this.value.toUpperCase();
    }
}

// 為單個元素更新十六進制值
function updateHexFromColorElement(element) {
    const hexInput = document.querySelector(`.color-hex[data-color-for="${element.id}"]`);
    if (hexInput) {
        hexInput.value = element.value.toUpperCase();
    }
}

// 從十六進制輸入更新顏色選擇器
function updateColorFromHex() {
    const colorId = this.getAttribute('data-color-for');
    const colorInput = document.getElementById(colorId);
    if (colorInput && /^#[0-9A-F]{6}$/i.test(this.value)) {
        colorInput.value = this.value;
    }
}

// 添加 API 回應檢查函數 - 載入模板時使用
async function loadTemplateWithErrorCheck(templateId) {
    try {
        showLoader();
        const response = await fetch(`/api/admin/walk_map/templates/${templateId}`);
        
        // 檢查響應
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('找不到指定的模板。模板可能已被刪除或ID無效。');
            }
            if (response.status === 403) {
                throw new Error('無權限訪問此模板。請確認您的管理員權限。');
            }
            throw new Error(`載入模板失敗: HTTP 狀態 ${response.status}`);
        }
        
        // 嘗試解析 JSON
        let template;
        try {
            template = await response.json();
        } catch (e) {
            throw new Error('解析模板數據失敗，服務器返回了無效的 JSON 格式。');
        }
        
        // 檢查模板數據結構
        if (!template || !template.template_id) {
            throw new Error('收到的模板數據不完整或無效。');
        }
        
        // 檢查樣式數據
        if (!template.style_data) {
            console.warn('警告: 模板中無樣式數據，將使用默認值');
            template.style_data = {};
        }
        
        hideLoader();
        return template;
    } catch (error) {
        hideLoader();
        displayStatus(`載入模板錯誤: ${error.message}`, true);
        throw error;
    }
}



// 添加另存新檔功能的處理函數
async function handleSaveAsTemplate() {
    // 如果沒有正在編輯的模板，無法執行另存新檔
    if (!templateEditor.classList.contains('hidden')) {
        // 獲取目前模板數據
        const currentStyleData = collectStyleData();
        
        // 創建輸入框讓用戶輸入新的模板 ID 和名稱
        const newTemplateId = prompt(
            "請輸入新模板的 ID (僅限小寫英文、數字和底線):", 
            `${currentEditingTemplateId || 'new_template'}_copy`
        );
        
        // 檢查用戶是否取消輸入或輸入為空
        if (!newTemplateId) return;
        
        // 驗證 ID 格式
        if (!/^[a-z0-9_]+$/.test(newTemplateId)) {
            displayStatus("模板 ID 只能包含小寫字母、數字和底線。", true);
            return;
        }
        
        const newTemplateName = prompt(
            "請輸入新模板的名稱:", 
            `${templateNameInput.value || '新模板'} 副本`
        );
        
        // 檢查用戶是否取消輸入或輸入為空
        if (!newTemplateName) return;
        
        // 準備新模板數據
        const newTemplateData = {
            template_id: newTemplateId,
            template_name: newTemplateName,
            description: templateDescriptionInput.value + ' (複製自 ' + (currentEditingTemplateId || '草稿') + ')',
            style_data: currentStyleData,
            cell_data: JSON.parse(JSON.stringify(currentCellInfo)) // 深拷貝格子數據
        };
        
        try {
            showLoader();
            // 發送創建請求
            const response = await fetch('/api/admin/walk_map/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTemplateData)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                throw new Error(errorData.error || `另存新檔失敗: ${response.statusText}`);
            }
            
            const savedTemplateResult = await response.json();
            hideLoader();
            
            // 更新模板列表
            await loadTemplateList();
            
            // 切換到新創建的模板
            templateSelect.value = newTemplateId;
            currentEditingTemplateId = newTemplateId;
            templateIdInput.value = newTemplateId;
            templateIdInput.readOnly = true;
            templateNameInput.value = newTemplateName;
            deleteTemplateBtn.classList.remove('hidden');
            
            displayStatus(`模板已另存為 "${newTemplateName}" (ID: ${newTemplateId})`);
            
            // 在移動設備上顯示成功通知並滾動到頂部
            if (window.innerWidth <= 768) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                templateSelect.classList.add('highlight-select');
                setTimeout(() => templateSelect.classList.remove('highlight-select'), 2000);
            }
            
        } catch (error) {
            hideLoader();
            displayStatus(`另存新檔錯誤: ${error.message}`, true);
        }
    } else {
        displayStatus("請先開啟一個模板或創建新模板後再使用另存新檔功能。", true);
    }
}



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
        // 工具欄已在 HTML 中直接定義，這裡只需要添加事件監聽
        const backToTopBtn = document.getElementById('back-to-top');
        const jumpToGridBtn = document.getElementById('jump-to-grid');
        const jumpToSaveBtn = document.getElementById('jump-to-save');
        
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
        jumpToGridBtn.addEventListener('click', () => {
            const gridSection = document.getElementById('cell-editor');
            gridSection.scrollIntoView({ behavior: 'smooth' });
        });
        
        jumpToSaveBtn.addEventListener('click', () => {
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
                    // 圖標已在 HTML 中添加，這裡只添加監聽
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
            
            // 添加平滑滾動到當前展開的區段
            fieldset.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                
                // 增加觸控區域
                cell.style.minHeight = '36px';
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
                cell.style.minHeight = '';
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
                    
                    // 同步更新對應的 hex 輸入框
                    const hexInput = document.querySelector(`.color-hex[data-color-for="${input.id}"]`);
                    if (hexInput) {
                        hexInput.value = input.value.toUpperCase();
                    }
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
                    // 如果下一個元素是顏色輸入組
                    if (input && input.classList.contains('color-input-group')) {
                        const colorInput = input.querySelector('input[type="color"]');
                        if (colorInput) {
                            // 模擬點擊顏色選擇器
                            colorInput.click();
                        }
                        e.preventDefault();
                    }
                    // 如果下一個元素是直接的輸入框
                    else if (input && (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA')) {
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
            
            if (!response.ok) {
                throw new Error(`獲取模板列表失敗: ${response.status} ${response.statusText}`);
            }
            
            const templates = await response.json();
            templateSelect.innerHTML = '<option value="">-- 請選擇或新增 --</option>';
            
            templates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.template_id;
                option.textContent = template.name || `未命名模板 (${template.template_id})`;
                templateSelect.appendChild(option);
            });
            
            hideLoader();
        } catch (error) {
            hideLoader();
            displayStatus(`載入模板列表錯誤: ${error.message}`, true);
        }
    }

// 修改 handleLoadTemplate 函數使用新的載入函數
async function handleLoadTemplate() {
    // 獲取選擇的模板ID
    const templateId = templateSelect.value;
    if (!templateId) {
        displayStatus('請先選擇一個模板', true);
        return;
    }
    
    try {
        showLoader();
        // Change endpoint from /api/rich-map/templates/ to /api/admin/walk_map/templates/
        const response = await fetch(`/api/admin/walk_map/templates/${templateId}`);
        
        if (!response.ok) {
            throw new Error(`載入模板失敗: ${response.status} ${response.statusText}`);
        }
        
        const template = await response.json();
        
        // 檢查模板數據結構
        if (!template || !template.template_id) {
            throw new Error('收到的模板數據不完整或無效');
        }
        
        // 顯示模板編輯區
        populateTemplateEditor(template);
        templateEditor.classList.remove('hidden');
        deleteTemplateBtn.classList.remove('hidden');
        currentEditingTemplateId = template.template_id;
        
        hideLoader();
    } catch (error) {
        hideLoader();
        displayStatus(`載入模板錯誤: ${error.message}`, true);
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




// 修改 clearColorInput 函數 - 確保清除時也更新十六進制輸入框
function clearColorInput(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    input.value = '#ffffff';
    input.dataset.cleared = 'true';
    
    // 更新對應的十六進制輸入框
    const hexInput = document.querySelector(`.color-hex[data-color-for="${inputId}"]`);
    if (hexInput) {
        hexInput.value = '#FFFFFF (已清除)';
    }
    
    // 如果有對應的預覽變數，也要更新
    const label = input.closest('.form-group')?.querySelector('label');
    if (label) {
        const varName = label.textContent.split(':')[0].trim().toLowerCase().replace(/\s+/g, '-');
        if (typeof updatePreviewColor === 'function') {
            updatePreviewColor(varName, '');
        }
    }
}
    async function handleSaveTemplate() {
        // 從輸入獲取模板ID和名稱
        const templateId = templateIdInput.value.trim();
        const templateName = templateNameInput.value.trim();
        
        // 驗證必填字段
        if (!templateId) {
            displayStatus('請輸入模板 ID', true);
            templateIdInput.focus();
            return;
        }
        
        if (!templateName) {
            displayStatus('請輸入模板名稱', true);
            templateNameInput.focus();
            return;
        }
        
        // 檢查 ID 格式 (只允許小寫字母、數字和底線)
        if (!/^[a-z0-9_]+$/.test(templateId)) {
            displayStatus('模板 ID 只能包含小寫字母、數字和底線', true);
            templateIdInput.focus();
            return;
        }
        
        // 準備模板數據
        const isCreating = !currentEditingTemplateId;
        const templateData = {
            template_id: templateId,
            name: templateName,
            description: templateDescriptionInput.value.trim(),
            style_data: collectStyleData(),
            cell_data: currentCellInfo
        };
        
        try {
            showLoader();
            // 使用 PUT 更新或 POST 創建
            const method = isCreating ? 'POST' : 'PUT';
            const url = isCreating ? '/api/admin/walk_map/templates' : `/api/admin/walk_map/templates/${currentEditingTemplateId}`;
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(templateData)
            });
            
            if (!response.ok) {
                throw new Error(`儲存模板失敗: ${response.status} ${response.statusText}`);
            }
            
            // 保存成功後更新當前編輯模板ID
            currentEditingTemplateId = templateId;
            
            // 顯示成功消息
            displayStatus(`模板 "${templateName}" 已成功${isCreating ? '新增' : '更新'}！`);
            
            // 重新載入模板列表
            await loadTemplateList();
            
            // 選中當前模板
            const templateOptions = Array.from(templateSelect.options);
            const targetOption = templateOptions.find(option => option.value === templateId);
            if (targetOption) {
                templateSelect.value = templateId;
            }
            
            // 顯示刪除按鈕
            deleteTemplateBtn.classList.remove('hidden');
            
            hideLoader();
        } catch (error) {
            hideLoader();
            displayStatus(`儲存模板失敗: ${error.message}`, true);
        }
    }

    async function handleDeleteTemplate() {
        if (!currentEditingTemplateId) {
            displayStatus('錯誤：無模板被選中，無法刪除', true);
            return;
        }
        
        // 確認刪除
        if (!confirm(`確定要刪除模板 "${templateNameInput.value}"?\n此操作無法撤銷!`)) {
            return;
        }
        
        try {
            showLoader();
            const response = await fetch(`/api/admin/walk_map/templates/${currentEditingTemplateId}`, { 
                method: 'DELETE' 
            });
            
            if (!response.ok) {
                throw new Error(`刪除模板失敗: ${response.status} ${response.statusText}`);
            }
            
            // 成功刪除後，清空編輯器並重設狀態
            clearTemplateEditor();
            templateEditor.classList.add('hidden');
            deleteTemplateBtn.classList.add('hidden');
            currentEditingTemplateId = null;
            currentCellInfo = [];
            
            // 重新載入模板列表
            await loadTemplateList();
            
            displayStatus(`模板已成功刪除`);
            hideLoader();
        } catch (error) {
            hideLoader();
            displayStatus(`刪除模板失敗: ${error.message}`, true);
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
    
   
// 替换 populateTemplateEditor 函数 - 确保完整载入所有颜色值
function populateTemplateEditor(template) {
    // Check if template exists
    if (!template) {
        console.error("無法填充模板編輯器：模板數據為空");
        return;
    }

    // Log the received template data to debug
    console.log("接收到的模板數據:", JSON.stringify(template));
    
    // Template basic info
    templateIdInput.value = template.template_id || '';
    templateIdInput.readOnly = !!template.template_id;
    templateNameInput.value = template.template_name || '';
    templateDescriptionInput.value = template.description || '';

    const styles = template.style_data || {};
    
    // For debugging, log the styles object
    console.log("模板樣式數據:", JSON.stringify(styles));

    // General section
    if (styleInputs.general) {
        styleInputs.general.pageBgColor.value = styles.general?.pageBgColor || '#f5f5f5';
        styleInputs.general.primaryTextColor.value = styles.general?.primaryTextColor || '#333333';
        styleInputs.general.primaryFontFamily.value = styles.general?.primaryFontFamily || '';
    }

    // Header section
    if (styleInputs.header) {
        styleInputs.header.headerBgColor.value = styles.header?.headerBgColor || '#4CAF50';
        styleInputs.header.headerTextColor.value = styles.header?.headerTextColor || '#FFFFFF';
        styleInputs.header.roomInfoColor.value = styles.header?.roomInfoColor || '#E8F5E9';
    }

    // Board section
    if (styleInputs.board) {
        styleInputs.board.borderColor.value = styles.board?.borderColor || '#CCCCCC';
        styleInputs.board.borderWidth.value = styles.board?.borderWidth || '2px';
        styleInputs.board.centerBgColor.value = styles.board?.centerBgColor || '#F9FBE7';
        styleInputs.board.centerImageUrl.value = styles.board?.centerImageUrl || '';
    }

    // Map Cell section
    if (styleInputs.mapCell) {
        styleInputs.mapCell.defaultBgColor.value = styles.mapCell?.defaultBgColor || '#E3F2FD';
        styleInputs.mapCell.defaultBorderColor.value = styles.mapCell?.defaultBorderColor || '#BBDEFB';
        styleInputs.mapCell.defaultBorderWidth.value = styles.mapCell?.defaultBorderWidth || '1px';
        styleInputs.mapCell.titleTextColor.value = styles.mapCell?.titleTextColor || '#0D47A1';
        styleInputs.mapCell.numberTextColor.value = styles.mapCell?.numberTextColor || '#757575';
        styleInputs.mapCell.hoverBgColor.value = styles.mapCell?.hoverBgColor || '#BBDEFB';
        styleInputs.mapCell.hoverBorderColor.value = styles.mapCell?.hoverBorderColor || '#64B5F6';
    }

    // Player Marker section
    if (styleInputs.playerMarker) {
        styleInputs.playerMarker.shape.value = styles.playerMarker?.shape || '50%';
        styleInputs.playerMarker.textColor.value = styles.playerMarker?.textColor || '#FFFFFF';
        styleInputs.playerMarker.boxShadow.value = styles.playerMarker?.boxShadow || '0 2px 4px rgba(0,0,0,0.2)';
        
        // 處理玩家顏色組
        const playerColors = styles.playerMarker?.playerColors || ["#1e88e5", "#ef5350", "#4caf50", "#ffb300", "#7e57c2"];
        for (let i = 0; i < styleInputs.playerMarker.colors.length && i < playerColors.length; i++) {
            styleInputs.playerMarker.colors[i].value = playerColors[i];
        }
    }

    // Controller section
    if (styleInputs.controller) {
        styleInputs.controller.panelBackground.value = styles.controller?.panelBackground || '#F5F5F5';
        styleInputs.controller.playerLabelColor.value = styles.controller?.playerLabelColor || '#424242';
        
        if (styleInputs.controller.button) {
            styleInputs.controller.button.defaultBgColor.value = styles.controller?.controlButton?.defaultBgColor || '#E0E0E0';
            styleInputs.controller.button.defaultTextColor.value = styles.controller?.controlButton?.defaultTextColor || '#212121';
            styleInputs.controller.button.borderRadius.value = styles.controller?.controlButton?.borderRadius || '4px';
            styleInputs.controller.button.hoverBgColor.value = styles.controller?.controlButton?.hoverBgColor || '#BDBDBD';
            styleInputs.controller.button.cooldownOpacity.value = styles.controller?.controlButton?.cooldownOpacity || '0.6';
        }
    }

    // Info section
    if (styleInputs.info) {
        styleInputs.info.panelBackground.value = styles.info?.panelBackground || '#F5F5F5';
        styleInputs.info.sectionTitleColor.value = styles.info?.sectionTitleColor || '#424242';
        styleInputs.info.playerListText.value = styles.info?.playerListText || '#616161';
        styleInputs.info.staticTextColor.value = styles.info?.staticTextColor || '#757575';
        
        if (styleInputs.info.leaveButton) {
            styleInputs.info.leaveButton.defaultBgColor.value = styles.info?.leaveButton?.defaultBgColor || '#F44336';
            styleInputs.info.leaveButton.defaultTextColor.value = styles.info?.leaveButton?.defaultTextColor || '#FFFFFF';
        }
    }

    // Connection section
    if (styleInputs.connection) {
        styleInputs.connection.onlineBgColor.value = styles.connection?.onlineBgColor || '#4CAF50';
        styleInputs.connection.onlineTextColor.value = styles.connection?.onlineTextColor || '#FFFFFF';
        styleInputs.connection.offlineBgColor.value = styles.connection?.offlineBgColor || '#F44336';
        styleInputs.connection.offlineTextColor.value = styles.connection?.offlineTextColor || '#FFFFFF';
        styleInputs.connection.connectingBgColor.value = styles.connection?.connectingBgColor || '#FFC107';
        styleInputs.connection.connectingTextColor.value = styles.connection?.connectingTextColor || '#212121';
    }

    // Modal section
    if (styleInputs.modal) {
        styleInputs.modal.overlayBgColor.value = styles.modal?.overlayBgColor || 'rgba(0, 0, 0, 0.7)';
        styleInputs.modal.contentBgColor.value = styles.modal?.contentBgColor || '#FFFFFF';
        styleInputs.modal.headerBgColor.value = styles.modal?.headerBgColor || '#4CAF50';
        styleInputs.modal.headerTextColor.value = styles.modal?.headerTextColor || '#FFFFFF';
        styleInputs.modal.bodyTextColor.value = styles.modal?.bodyTextColor || '#212121';
    }

    // Update all hex inputs with corresponding color values
    updateColorHexInputs();
    
    // Update preview variables
    updatePreviewVariables();
}
    
    // 更新所有顏色輸入框對應的十六進制文本框
    function updateColorHexInputs() {
        document.querySelectorAll('input[type="color"]').forEach(input => {
            input.dispatchEvent(new Event('input'));
        });
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
        
        // 移動設備上回到頂部
        if (window.innerWidth <= 768) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
     
    // 添加加載提示功能
    function showLoader() {
        // 檢查是否已存在加載器
        if (!document.getElementById('page-loader').classList.contains('hidden')) return;
    
        document.getElementById('page-loader').classList.remove('hidden');
        document.body.classList.add('loading');
    }
    
    function hideLoader() {
        const loader = document.getElementById('page-loader');
        if (!loader.classList.contains('hidden')) {
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.classList.add('hidden');
                loader.classList.remove('fade-out');
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
    
            // 添加觸摸反饋
            cellDiv.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.95)';
            });
            
            cellDiv.addEventListener('touchend', function() {
                this.style.transform = '';
                openCellEditModal(i);
            });
            
            // 保留點擊事件
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
        document.getElementById('modal-cell-title-display').innerHTML = `<i class="fas fa-edit"></i> 編輯格子 ${index}`;
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
                modalContent.style.width = '85%';  // 縮小寬度
                modalContent.style.maxHeight = '70vh';  // 控制最大高度
                modalContent.style.overflow = 'auto';
                
                // 調整字型大小和內邊距
                const modalHeader = modalContent.querySelector('.modal-header');
                if (modalHeader) {
                    modalHeader.style.padding = '8px 0';
                }
                
                const formGroups = modalContent.querySelectorAll('.form-group');
                formGroups.forEach(group => {
                    group.style.marginBottom = '12px';
                });
                
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
            
            // 添加更新動畫效果
            adminCellDiv.classList.add('cell-updated');
            setTimeout(() => adminCellDiv.classList.remove('cell-updated'), 1000);
        }
    
        closeCellEditModal();
    
        // 顯示帶有確認按鈕的狀態消息
        const message = `格子 ${index} 變更已應用。`;
    
        if (window.innerWidth <= 768) {
            displayStatusWithAction(
                message, 
                '<i class="fas fa-save"></i> 儲存全部', 
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
        actionButton.innerHTML = actionText;
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
    
    // 在移動設備上初始化滑動手勢
    if (window.innerWidth <= 768) {
        setupTouchGestures();
    }
    
    // 為顏色輸入框添加雙擊清除功能
    document.querySelectorAll('input[type="color"]').forEach(input => {
        input.addEventListener('dblclick', () => {
            const inputId = input.id;
            const label = input.closest('.form-group').querySelector('label');
            if (confirm('是否要清除此顏色並使用預設值？')) {
                clearColorInput(inputId);
                // 更新十六進制顯示框
                const hexInput = document.querySelector(`.color-hex[data-color-for="${inputId}"]`);
                if (hexInput) {
                    hexInput.value = '#ffffff (已清除)';
                }
                if (label) {
                    displayStatus(`已清除 ${label.textContent.split(':')[0]} 的顏色設定。使用預設值。`);
                }
            }
        });
    });
    
    // 創建一個簡易的圓形進度指示器用於模擬載入
    function showProgressLoader(message, seconds) {
        const loader = document.getElementById('page-loader');
        const loaderText = loader.querySelector('.loader-text');
        loaderText.textContent = message || '處理中...';
        
        loader.classList.remove('hidden');
        document.body.classList.add('loading');
        
        let progress = 0;
        const interval = seconds ? (seconds * 1000) / 100 : 50;
        
        const progressInterval = setInterval(() => {
            progress++;
            if (progress >= 100) {
                clearInterval(progressInterval);
                hideLoader();
            }
        }, interval);
        
        // 讓函數返回一個可以提前完成的方法
        return {
            complete: () => {
                clearInterval(progressInterval);
                hideLoader();
            }
        };
    }
    
    // 添加額外的縮放處理
    document.addEventListener('gesturestart', function(e) {
        e.preventDefault();
        // 防止iOS中的默認縮放手勢
    });
    window.clearColorInput = clearColorInput;
    // 初始化調整所有顏色填充顯示
    updateColorHexInputs();
}); // End DOMContentLoaded