// 模板管理功能
let availableTemplates = []; // 存儲可用的模板
let currentTemplateId = null; // 當前套用的模板ID

// 初始化模板選擇器
function initTemplateSelector() {
    // 添加模板選擇器到 DOM
    const templateSelectorHtml = document.getElementById('template-selector');
    if (!templateSelectorHtml) {
        document.body.insertAdjacentHTML('beforeend', `
            <!-- 模板選擇器 -->
            <div id="template-selector" class="template-selector">
                <div class="selector-header">
                    <h3>選擇地圖風格</h3>
                    <button id="close-template-selector" class="btn-close">×</button>
                </div>
                <div class="selector-body">
                    <div class="loading-indicator">載入中...</div>
                    <select id="template-select" class="template-dropdown">
                        <option value="">-- 請選擇模板 --</option>
                    </select>
                    <div class="template-preview">
                        <div class="preview-title">預覽</div>
                        <div id="template-preview-image" class="preview-image">
                            選擇模板來預覽
                        </div>
                        <div id="template-description" class="template-description">
                            選擇一個模板以查看描述
                        </div>
                    </div>
                </div>
                <div class="selector-footer">
                    <button id="apply-template" class="btn btn-primary">套用模板</button>
                    <button id="cancel-template" class="btn btn-secondary">取消</button>
                </div>
            </div>

            <!-- 模板選擇器按鈕 -->
            <button id="open-template-selector" class="template-selector-btn">
                <span>更換主題</span>
            </button>
        `);

        // 添加基本的 CSS
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .template-selector {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80%;
                max-width: 500px;
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 1000;
                display: none;
            }

            .selector-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid #eee;
            }

            .selector-header h3 {
                margin: 0;
                font-size: 18px;
            }

            .btn-close {
                background: none;
                border: none;
                font-size: 22px;
                cursor: pointer;
            }

            .selector-body {
                padding: 16px;
            }

            .template-dropdown {
                width: 100%;
                padding: 8px;
                margin-bottom: 16px;
                border-radius: 4px;
                border: 1px solid #ddd;
            }

            .template-preview {
                border: 1px solid #eee;
                border-radius: 4px;
                padding: 12px;
                margin-bottom: 16px;
            }

            .preview-title {
                font-weight: bold;
                margin-bottom: 8px;
            }

            .preview-image {
                height: 120px;
                background-color: #f5f5f5;
                border-radius: 4px;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #888;
            }

            .template-description {
                font-size: 14px;
                color: #666;
            }

            .selector-footer {
                display: flex;
                justify-content: flex-end;
                padding: 12px 16px;
                border-top: 1px solid #eee;
                gap: 12px;
            }

            .template-selector-btn {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: #4caf50;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 8px 12px;
                cursor: pointer;
                z-index: 900;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            }

            .loading-indicator {
                text-align: center;
                padding: 20px;
                color: #888;
                display: none;
            }
        `;
        document.head.appendChild(styleElement);
    }

    // 設置事件監聽器
    document.getElementById('open-template-selector').addEventListener('click', openTemplateSelector);
    document.getElementById('close-template-selector').addEventListener('click', closeTemplateSelector);
    document.getElementById('cancel-template').addEventListener('click', closeTemplateSelector);
    document.getElementById('apply-template').addEventListener('click', applySelectedTemplate);
    document.getElementById('template-select').addEventListener('change', previewSelectedTemplate);

    // 獲取可用模板列表
    fetchTemplates();
}

// 獲取可用的模板列表
async function fetchTemplates() {
    try {
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) loadingIndicator.style.display = 'block';

        const response = await fetch('/api/admin/walk_map/templates');
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const templates = await response.json();
        availableTemplates = templates;

        // 填充選擇下拉框
        const selectElement = document.getElementById('template-select');
        selectElement.innerHTML = '<option value="">-- 請選擇模板 --</option>';
        
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.template_id;
            option.textContent = template.template_name;
            selectElement.appendChild(option);
        });

        if (loadingIndicator) loadingIndicator.style.display = 'none';
    } catch (error) {
        console.error('獲取模板列表失敗:', error);
        alert('無法載入模板列表，請稍後再試。');
        if (document.querySelector('.loading-indicator')) {
            document.querySelector('.loading-indicator').style.display = 'none';
        }
    }
}

// 打開模板選擇器
function openTemplateSelector() {
    const selector = document.getElementById('template-selector');
    if (selector) {
        selector.style.display = 'block';
    }
}

// 關閉模板選擇器
function closeTemplateSelector() {
    const selector = document.getElementById('template-selector');
    if (selector) {
        selector.style.display = 'none';
    }
}

// 預覽選擇的模板
async function previewSelectedTemplate() {
    const selectElement = document.getElementById('template-select');
    const templateId = selectElement.value;
    const descriptionElement = document.getElementById('template-description');
    const previewImageElement = document.getElementById('template-preview-image');

    if (!templateId) {
        descriptionElement.textContent = '選擇一個模板以查看描述';
        previewImageElement.innerHTML = '選擇模板來預覽';
        return;
    }

    try {
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) loadingIndicator.style.display = 'block';

        const response = await fetch(`/api/admin/walk_map/templates/${templateId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const templateData = await response.json();
        
        // 更新描述
        descriptionElement.textContent = templateData.description || '無描述';
        
        // 簡單預覽 (這裡可以更複雜，顯示實際地圖外觀)
        previewImageElement.innerHTML = `<div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div style="background-color: ${templateData.style_data?.board?.centerBgColor || '#f0f0f0'}; 
                     border: ${templateData.style_data?.board?.borderWidth || '2px'} solid ${templateData.style_data?.board?.borderColor || '#333'};
                     width: 80%; height: 70%; border-radius: 8px; display: flex; justify-content: center; align-items: center;">
                <span style="color: ${templateData.style_data?.mapCell?.titleTextColor || '#333'}; font-weight: bold;">
                    ${templateData.template_name}
                </span>
            </div>
        </div>`;

        if (loadingIndicator) loadingIndicator.style.display = 'none';
    } catch (error) {
        console.error('獲取模板詳情失敗:', error);
        descriptionElement.textContent = '無法載入模板詳情';
        previewImageElement.innerHTML = '載入預覽失敗';
        if (document.querySelector('.loading-indicator')) {
            document.querySelector('.loading-indicator').style.display = 'none';
        }
    }
}

// 應用選擇的模板
async function applySelectedTemplate() {
    const selectElement = document.getElementById('template-select');
    const templateId = selectElement.value;

    if (!templateId) {
        alert('請先選擇一個模板');
        return;
    }

    try {
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) loadingIndicator.style.display = 'block';

        const response = await fetch(`/api/admin/walk_map/templates/${templateId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const templateData = await response.json();
        
        // 應用模板樣式
        applyTemplateStyles(templateData.style_data);
        
        // 更新格子內容
        updateCellContents(templateData.cell_data);
        
        // 保存當前模板ID
        currentTemplateId = templateId;
        
        // 關閉選擇器
        closeTemplateSelector();
        
        // 通知用戶
        alert(`已成功套用模板: ${templateData.template_name}`);

        if (loadingIndicator) loadingIndicator.style.display = 'none';
    } catch (error) {
        console.error('應用模板失敗:', error);
        alert('套用模板失敗，請稍後再試。');
        if (document.querySelector('.loading-indicator')) {
            document.querySelector('.loading-indicator').style.display = 'none';
        }
    }
}

// 應用模板樣式到頁面
function applyTemplateStyles(styleData) {
    if (!styleData) return;

    // 清除之前的樣式
    const oldStyleElement = document.getElementById('template-styles');
    if (oldStyleElement) {
        oldStyleElement.remove();
    }

    // 創建新的樣式元素
    const styleElement = document.createElement('style');
    styleElement.id = 'template-styles';
    
    // 構建 CSS
    let css = '';

    // 全局樣式
    if (styleData.general) {
        const general = styleData.general;
        css += `
            body {
                background-color: ${general.pageBgColor || '#f5f5f5'};
                color: ${general.primaryTextColor || '#333333'};
                ${general.primaryFontFamily ? `font-family: ${general.primaryFontFamily};` : ''}
            }
        `;
    }

    // 標題區樣式
    if (styleData.header) {
        const header = styleData.header;
        css += `
            .game-header {
                background-color: ${header.headerBgColor || '#4caf50'};
            }
            .game-header h1 {
                color: ${header.headerTextColor || '#ffffff'};
            }
            #room-info {
                color: ${header.roomInfoColor || '#e0e0e0'};
            }
        `;
    }

    // 地圖區樣式
    if (styleData.board) {
        const board = styleData.board;
        css += `
            #game-map {
                border: ${board.borderWidth || '2px'} solid ${board.borderColor || '#333'};
            }
            #map-center-image-container {
                background-color: ${board.centerBgColor || 'transparent'};
                ${board.centerImageUrl ? `background-image: url(${board.centerImageUrl});` : ''}
            }
        `;
    }

    // 格子預設樣式
    if (styleData.mapCell) {
        const mapCell = styleData.mapCell;
        css += `
            .map-cell {
                background-color: ${mapCell.defaultBgColor || '#ffffff'};
                border: ${mapCell.defaultBorderWidth || '1px'} solid ${mapCell.defaultBorderColor || '#cccccc'};
            }
            .cell-title {
                color: ${mapCell.titleTextColor || '#333333'};
            }
            .cell-number {
                color: ${mapCell.numberTextColor || '#777777'};
            }
            .map-cell:hover {
                background-color: ${mapCell.hoverBgColor || '#f0f0f0'};
                border-color: ${mapCell.hoverBorderColor || '#999999'};
            }
        `;
    }

    // 玩家標記樣式
    if (styleData.playerMarker) {
        const playerMarker = styleData.playerMarker;
        const playerColors = playerMarker.playerColors || ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"];
        
        css += `
            .player-marker {
                color: ${playerMarker.textColor || '#ffffff'};
                border-radius: ${playerMarker.shape || '50%'};
                box-shadow: ${playerMarker.boxShadow || '0 2px 4px rgba(0,0,0,0.2)'};
            }
        `;
        
        // 為每個玩家設置顏色
        playerColors.forEach((color, index) => {
            css += `
                .player-color-${index + 1} {
                    background-color: ${color};
                }
            `;
        });
    }

    // 控制區樣式
    if (styleData.controller) {
        const controller = styleData.controller;
        css += `
            #controller-area {
                background-color: ${controller.panelBackground || '#f9f9f9'};
            }
            .player-info {
                color: ${controller.playerLabelColor || '#555555'};
            }
        `;
        
        // 控制按鈕
        if (controller.button) {
            const button = controller.button;
            css += `
                .btn-control {
                    background-color: ${button.defaultBgColor || '#4caf50'};
                    color: ${button.defaultTextColor || '#ffffff'};
                    border-radius: ${button.borderRadius || '4px'};
                }
                .btn-control:hover {
                    background-color: ${button.hoverBgColor || '#45a049'};
                }
                .btn-cooldown {
                    opacity: ${button.cooldownOpacity || '0.6'};
                }
            `;
        }
    }

    // 資訊區樣式
    if (styleData.info) {
        const info = styleData.info;
        css += `
            .info-panel {
                background-color: ${info.panelBackground || '#f9f9f9'};
            }
            .info-panel h3 {
                color: ${info.sectionTitleColor || '#333333'};
            }
            #players-list li {
                color: ${info.playerListText || '#555555'};
            }
            #game-status p {
                color: ${info.staticTextColor || '#777777'};
            }
        `;
        
        // 離開遊戲按鈕
        if (info.leaveButton) {
            const leaveButton = info.leaveButton;
            css += `
                #leave-game {
                    background-color: ${leaveButton.defaultBgColor || '#f44336'};
                    color: ${leaveButton.defaultTextColor || '#ffffff'};
                }
            `;
        }
    }

    // 連接狀態樣式
    if (styleData.connection) {
        const connection = styleData.connection;
        css += `
            #connection-status.online {
                background-color: ${connection.onlineBgColor || '#4caf50'};
                color: ${connection.onlineTextColor || '#ffffff'};
            }
            #connection-status.offline {
                background-color: ${connection.offlineBgColor || '#f44336'};
                color: ${connection.offlineTextColor || '#ffffff'};
            }
            #connection-status.connecting {
                background-color: ${connection.connectingBgColor || '#ff9800'};
                color: ${connection.connectingTextColor || '#ffffff'};
            }
        `;
    }

    // 地點彈窗樣式
    if (styleData.modal) {
        const modal = styleData.modal;
        css += `
            #location-modal {
                background-color: ${modal.overlayBgColor || 'rgba(0, 0, 0, 0.7)'};
            }
            .modal-content {
                background-color: ${modal.contentBgColor || '#ffffff'};
            }
            .modal-header {
                background-color: ${modal.headerBgColor || '#4caf50'};
            }
            .modal-header h2 {
                color: ${modal.headerTextColor || '#ffffff'};
            }
            .modal-body p {
                color: ${modal.bodyTextColor || '#333333'};
            }
        `;
    }

    // 添加樣式到頁面
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
}

// 更新格子內容
function updateCellContents(cellData) {
    if (!cellData || !Array.isArray(cellData) || cellData.length === 0) return;

    // 先更新 cellInfo 數組
    cellInfo = [];
    cellData.forEach(cell => {
        if (cell && typeof cell === 'object') {
            cellInfo[cell.cell_index] = {
                title: cell.title || `格 ${cell.cell_index}`,
                description: cell.description || ''
            };
        }
    });

    // 更新 DOM 中的格子顯示
    cellData.forEach(cell => {
        if (cell && typeof cell === 'object') {
            const cellElement = document.getElementById(`cell-${cell.cell_index}`);
            if (cellElement) {
                // 更新標題
                const titleElement = cellElement.querySelector('.cell-title');
                if (titleElement) {
                    titleElement.textContent = cell.title || `格 ${cell.cell_index}`;
                }

                // 設置特殊背景顏色 (如果有)
                if (cell.cell_bg_color) {
                    cellElement.style.backgroundColor = cell.cell_bg_color;
                } else {
                    // 恢復預設背景色
                    cellElement.style.backgroundColor = '';
                }
                
                // 這裡我們不需要更新數字，因為那是固定的索引
            }
        }
    });
}

// 載入預設模板
async function loadDefaultTemplate() {
    // 你可以設置一個預設模板ID，或者從本地存儲中獲取
    const defaultTemplateId = localStorage.getItem('defaultTemplateId');
    
    if (defaultTemplateId) {
        try {
            const response = await fetch(`/api/admin/walk_map/templates/${defaultTemplateId}`);
            
            if (response.ok) {
                const templateData = await response.json();
                applyTemplateStyles(templateData.style_data);
                updateCellContents(templateData.cell_data);
                currentTemplateId = defaultTemplateId;
                console.log(`已載入預設模板: ${templateData.template_name}`);
            }
        } catch (error) {
            console.error('載入預設模板失敗:', error);
            // 如果載入失敗，不需要顯示錯誤給用戶，我們只用預設樣式即可
        }
    }
}

document.addEventListener('DOMContentLoaded', initTemplateSelector);


// 在頁面載入後初始化
document.addEventListener('DOMContentLoaded', function() {
    // 延遲初始化，確保其他 DOM 元素已加載
    setTimeout(() => {
        initTemplateSelector();
        // 可選：載入預設模板
        // loadDefaultTemplate();
    }, 1000);
});