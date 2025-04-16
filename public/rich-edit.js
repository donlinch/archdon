// --- DOM 元素獲取 ---
const container = document.getElementById('game-container');
const board = document.getElementById('game-board');
const editorPanel = document.getElementById('editor-panel');
// (格子編輯面板內的元素)
const titleInput = document.getElementById('edit-title');
const descInput = document.getElementById('edit-description');
const colorInput = document.getElementById('edit-color');
const imageInput = document.getElementById('edit-image');

// (Logo 元素)
const logoUrlInput = document.getElementById('edit-logo-url');
const logoPreview = document.getElementById('logo-preview');
// (版本控制元素)
const templateSelect = document.getElementById('template-select');
const loadTemplateBtn = document.getElementById('load-template-btn');
const saveTemplateBtn = document.getElementById('save-template-btn');
// (玩家設定表格)
const playerConfigTableBody = document.querySelector('#player-config-table tbody');
const saveAsNewBtn = document.getElementById('save-as-new-btn');
const createNewBtn = document.getElementById('create-new-btn');
const deleteTemplateBtn = document.getElementById('delete-template-btn');

// 背景顏色相關元素
const backgroundColorInput = document.getElementById('edit-background-color');
const backgroundColorPreview = document.getElementById('background-color-preview');
const colorPreviewBox = document.getElementById('color-preview-box');

// --- 全域變數 ---
let editingIndex = -1;
let cells = [];
let currentTemplateId = null; // 初始設為 null，表示尚未載入
let backgroundColor = '#fff0f5';
let currentLogoUrl = '';
let currentPlayers = []; // 儲存玩家設定

// --- 函數定義 ---

// 更新備註列表
function updateNotesList() {
    const notesContainer = document.getElementById('notes-container');
    if (!notesContainer) return;
    
    // 清空現有內容
    notesContainer.innerHTML = '';
    
    // 篩選有備註的格子
    const cellsWithNotes = cells.filter(cell => cell.note && cell.note.trim());
    
    if (cellsWithNotes.length === 0) {
        notesContainer.innerHTML = '<div class="empty-notes">尚無格子備註</div>';
        return;
    }
    
    // 添加每個備註項目
    cellsWithNotes.forEach(cell => {
        const noteItem = document.createElement('div');
        noteItem.className = 'note-item';
        
        const noteTitle = document.createElement('div');
        noteTitle.className = 'note-title';
        noteTitle.textContent = cell.title || '無標題';
        
        const noteText = document.createElement('div');
        noteText.className = 'note-text';
        noteText.textContent = `備註: ${cell.note}`;
        
        noteItem.appendChild(noteTitle);
        noteItem.appendChild(noteText);
        notesContainer.appendChild(noteItem);
        
        // 添加點擊事件，點擊備註項目時打開對應的格子編輯
        noteItem.addEventListener('click', () => {
            const index = cells.indexOf(cell);
            if (index !== -1) {
                openEditor(index);
                // 可選：高亮顯示對應的格子
                highlightCell(index);
            }
        });
    });
}

// 套用背景顏色
function applyTemplateBackgroundColor(color) {
    backgroundColor = color || '#fff0f5';
    if (container) {
        container.style.backgroundColor = backgroundColor;
    } else {
        console.error("無法找到 ID 為 'game-container' 的元素來設定背景色");
    }
}

// 初始化背景顏色輸入框
function initBackgroundColorInput() {
    if (!backgroundColorInput || !backgroundColorPreview || !colorPreviewBox) {
        console.warn("背景顏色編輯元素未完全找到");
        return;
    }
  
    // 設置初始值
    backgroundColorInput.value = backgroundColor;
    backgroundColorPreview.textContent = backgroundColor;
    colorPreviewBox.style.backgroundColor = backgroundColor;
  
    // 添加事件監聽器
    backgroundColorInput.addEventListener('input', handleBackgroundColorChange);
}
  
// 處理背景顏色變更
function handleBackgroundColorChange(event) {
    const newColor = event.target.value;
    
    // 更新全局變量
    backgroundColor = newColor;
    
    // 更新 UI
    if (backgroundColorPreview) {
        backgroundColorPreview.textContent = newColor;
    }
    if (colorPreviewBox) {
        colorPreviewBox.style.backgroundColor = newColor;
    }
    
    // 立即應用背景顏色到遊戲容器
    applyTemplateBackgroundColor(newColor);
    
    console.log(`背景顏色已變更為: ${newColor} (尚未儲存)`);
}

// 渲染遊戲板
function renderBoard() {
    if (!board) {
        console.error("找不到遊戲板元素！");
        return;
    }
    
    // 清空遊戲板
    board.innerHTML = '';
    
    // 渲染每個格子
    cells.forEach((cell, i) => {
        const div = document.createElement('div');
        div.className = 'cell';
        
        // 位置設定
        div.style.left = `${(i % 7) * 125}px`;
        div.style.top = `${Math.floor(i / 7) * 100}px`;
        
        // 顏色設定
        div.style.backgroundColor = cell.color || '#f0f0f0';
        
        // 如果有圖片，添加圖片
        if (cell.image_url) {
            const img = document.createElement('img');
            img.src = cell.image_url;
            img.alt = cell.title || '格子圖片';
            img.onerror = () => { img.style.display = 'none'; };
            div.appendChild(img);
        }

        // 添加標題
        const titleDiv = document.createElement('div');
        titleDiv.className = 'title';
        titleDiv.textContent = cell.title || '';
        div.appendChild(titleDiv);

        // 添加描述
        const descDiv = document.createElement('div');
        descDiv.className = 'description';
        descDiv.textContent = cell.description || '';
        div.appendChild(descDiv);
        
        // 添加備註顯示
        if (cell.note && cell.note.trim()) {
            const noteDiv = document.createElement('div');
            noteDiv.className = 'note';
            noteDiv.textContent = `備註: ${cell.note}`;
            div.appendChild(noteDiv);
        }

        // 添加點擊事件
        div.onclick = () => openEditor(i);
        board.appendChild(div);
    });
    
    // 渲染完格子後更新備註列表
    updateNotesList();
}

// 處理刪除模板的函數
async function deleteCurrentTemplate() {
    if (!currentTemplateId) {
        alert("錯誤：尚未載入任何模板，無法刪除！");
        return;
    }

    // 增加保護，不允許刪除 ID=1
    if (currentTemplateId === 1) {
        alert("錯誤：不允許刪除預設模板 (ID=1)！");
        return;
    }

    const templateName = templateSelect.options[templateSelect.selectedIndex]?.text || `ID: ${currentTemplateId}`; // 獲取當前選中模板的名稱
    if (!confirm(`確定要永久刪除模板 "${templateName}" 嗎？\n這個操作無法復原！`)) {
        return; // 使用者取消
    }

    console.log(`準備刪除模板 ID: ${currentTemplateId}`);
    deleteTemplateBtn.disabled = true; // 禁用按鈕
    deleteTemplateBtn.textContent = '刪除中...';

    try {
        const response = await fetch(`/api/rich-map/templates/${currentTemplateId}`, {
            method: 'DELETE'
        });

        if (response.status === 204) { // 成功刪除 (No Content)
            alert(`✅ 模板 "${templateName}" 已成功刪除！`);
            // 清空當前狀態並刷新列表
            currentTemplateId = null;
            cells = [];
            currentLogoUrl = '';
            currentPlayers = [];
            if (board) board.innerHTML = '';
            if (logoUrlInput) logoUrlInput.value = '';
            if (logoPreview) logoPreview.src = '';
            if (playerConfigTableBody) playerConfigTableBody.innerHTML = '<tr><td colspan="4">請選擇或建立模板</td></tr>';
            applyTemplateBackgroundColor('#fff0f5');
            saveTemplateBtn.disabled = true; // 禁用儲存
            await fetchTemplateList(); // 刷新下拉選單 (會自動載入第一個)
        } else {
            // 如果伺服器回傳錯誤 (例如 404, 500)
            const errData = await response.json().catch(() => ({}));
            throw new Error(`刪除失敗 ${response.status}: ${errData.error || response.statusText}`);
        }
    } catch (err) {
        console.error('❌ 刪除模板失敗:', err);
        alert(`刪除模板失敗：\n${err.message}`);
    } finally {
        // 恢復按鈕狀態 (如果按鈕還存在的話)
        if (deleteTemplateBtn) {
            deleteTemplateBtn.disabled = false;
            deleteTemplateBtn.textContent = '🗑️ 刪除目前版本';
        }
    }
}

// 開啟編輯器函數
function openEditor(index) {
    editingIndex = index;
    const cell = cells[editingIndex];
    if (!cell) {
        console.error(`無法找到索引為 ${index} 的格子資料`);
        return;
    }
    
    // 填充資料
    titleInput.value = cell.title || '';
    descInput.value = cell.description || '';
    colorInput.value = cell.color || '#ffffff';
    imageInput.value = cell.image_url || '';
    
    // 添加備註值設定
    const noteInput = document.getElementById('edit-note');
    if (noteInput) {
        noteInput.value = cell.note || '';
    }
    
    const previewImage = document.getElementById('preview-image');
    if (previewImage) {
        previewImage.src = cell.image_url || '';
    }
    
    // 重置編輯面板位置到中間
    // 清除任何已設定的 left/top 值
    editorPanel.style.left = '';
    editorPanel.style.top = '';
    // 確保 transform 有正確設定為居中
    editorPanel.style.transform = 'translate(-50%, -50%)';
    
    // 顯示編輯面板
    editorPanel.style.display = 'flex';
}

// 保存格子變更
function saveCellChanges() {
    if (editingIndex < 0 || !cells[editingIndex]) {
        console.error("保存格子時編輯索引無效");
        return;
    }
    
    const cell = cells[editingIndex];
    cell.title = titleInput.value.trim();
    cell.description = descInput.value.trim();
    cell.color = colorInput.value;
    cell.image_url = imageInput.value.trim() || null;
    
    // 添加備註保存
    const noteInput = document.getElementById('edit-note');
    if (noteInput) {
        cell.note = noteInput.value.trim();
    }

    renderBoard();
    editorPanel.style.display = 'none';
}

// 獲取並填充模板列表
async function fetchTemplateList(selectId = null) {
    if (!templateSelect || !loadTemplateBtn) {
        console.error("模板選擇器的 DOM 元素未找到！");
        return;
    }
    try {
        const response = await fetch('/api/rich-map/templates');
        if (!response.ok) {
            throw new Error(`獲取模板列表失敗: ${response.status} ${response.statusText}`);
        }
        const templates = await response.json();
        templateSelect.innerHTML = '';

        if (!Array.isArray(templates) || templates.length === 0) {
            templateSelect.innerHTML = '<option value="">-- 沒有可用模板 --</option>';
            loadTemplateBtn.disabled = true;
            saveTemplateBtn.disabled = true;
            if (board) board.innerHTML = '';
            if (logoUrlInput) logoUrlInput.value = '';
            if (logoPreview) logoPreview.src = '';
            applyTemplateBackgroundColor('#fff0f5');
            if (playerConfigTableBody) playerConfigTableBody.innerHTML = '<tr><td colspan="4">請先建立模板</td></tr>'; // 清空玩家表格
            return;
        }

        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = `${template.template_name} (ID: ${template.id})`;
            templateSelect.appendChild(option);
        });
        
        // 決定要選中哪個 ID
        let idToSelect = selectId; // 優先使用傳入的 ID
        if (!idToSelect && templates.length > 0) {
            idToSelect = templates[0].id; // 否則選中第一個
        }

        if (idToSelect) {
            templateSelect.value = idToSelect; // 設置選中項
            loadTemplateBtn.disabled = false;
            // 如果是新建或另存後刷新，則自動載入新選中的模板
            if (selectId) {
                await loadTemplate(idToSelect);
            } else if (templates.length > 0 && templateSelect.value == templates[0].id){
                // 如果是頁面首次載入，且有模板，自動載入第一個
                await loadTemplate(templates[0].id);
            } else {
                // 否則，只更新下拉選單，不自動載入 (例如，只是刷新列表)
                saveTemplateBtn.disabled = true; // 需要手動載入後才能儲存
            }
        } else {
            loadTemplateBtn.disabled = true;
            saveTemplateBtn.disabled = true;
        }
    } catch (err) {
        console.error('❌ 獲取模板列表時出錯:', err);
        alert(`獲取模板列表失敗：\n${err.message}`);
        templateSelect.innerHTML = '<option value="">-- 載入失敗 --</option>';
        loadTemplateBtn.disabled = true;
        saveTemplateBtn.disabled = true;
    }
}

// 載入選定模板的完整資料
async function loadTemplate(templateId) {
    if (!templateId) {
        console.warn("載入模板時未提供 ID");
        alert("請先選擇一個模板！");
        return;
    }
    console.log(`正在載入模板 ID: ${templateId}...`);
    currentTemplateId = templateId;

    if (board) board.innerHTML = '<p style="text-align: center;">載入中...</p>';
    if (logoUrlInput) logoUrlInput.value = '';
    if (logoPreview) logoPreview.src = '';
    backgroundColor = '#fff0f5';
    applyTemplateBackgroundColor(backgroundColor);
    saveTemplateBtn.disabled = true;
    if (playerConfigTableBody) playerConfigTableBody.innerHTML = '<tr><td colspan="4">載入中...</td></tr>'; // 清空舊玩家表格

    try {
        const response = await fetch(`/api/rich-map/templates/${currentTemplateId}/full`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`伺服器錯誤 ${response.status}: ${errData.error || response.statusText}`);
        }
        const data = await response.json();
        console.log("載入的模板資料:", data);

        // 套用背景顏色
        applyTemplateBackgroundColor(data.background_color);
        cells = data.cells || [];
        currentLogoUrl = data.logo_url || '';
        if (logoUrlInput) logoUrlInput.value = currentLogoUrl;
        if (logoPreview) logoPreview.src = currentLogoUrl;

        // 更新背景顏色輸入框
        if (backgroundColorInput) backgroundColorInput.value = data.background_color || '#fff0f5';
        if (backgroundColorPreview) backgroundColorPreview.textContent = data.background_color || '#fff0f5';
        if (colorPreviewBox) colorPreviewBox.style.backgroundColor = data.background_color || '#fff0f5';

        currentPlayers = data.players || []; // 處理玩家資料
        renderPlayerConfigUI(); // 渲染玩家UI

        renderBoard();
        saveTemplateBtn.disabled = false;
    } catch (err) {
        console.error('❌ 載入模板失敗:', err);
        alert(`無法載入模板資料 (ID: ${currentTemplateId})：\n${err.message}\n請檢查後端 API 是否正常運作，以及模板 ID 是否存在。`);
        if (board) board.innerHTML = '<p style="color: red; text-align: center;">載入地圖失敗</p>';
        cells = [];
        currentLogoUrl = '';
        if (logoUrlInput) logoUrlInput.value = '';
        if (logoPreview) logoPreview.src = '';
        currentPlayers = []; // 清空玩家
        if (playerConfigTableBody) playerConfigTableBody.innerHTML = '<tr><td colspan="4" style="color:red;">載入玩家設定失敗</td></tr>';
        saveTemplateBtn.disabled = true;
        currentTemplateId = null;
    }
}

// 處理新建/另存的核心 API 呼叫函數
async function createNewTemplateInAPI(payload) {
    console.log("準備發送 POST 請求創建模板:", payload);
    try {
        const response = await fetch('/api/rich-map/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json(); // 嘗試解析回應

        if (!response.ok) {
            throw new Error(result.error || `伺服器錯誤 ${response.status}`);
        }

        console.log("模板創建/另存成功:", result);
        alert(`✅ 操作成功！\n新模板名稱: ${result.newTemplate.template_name}\n新模板 ID: ${result.newTemplate.id}`);

        // 刷新模板列表並選中新創建的模板
        await fetchTemplateList(result.newTemplate.id); // 將新 ID 傳過去
    } catch (err) {
        console.error('❌ 創建/另存模板失敗:', err);
        alert(`操作失敗：\n${err.message}`);
    }
}

// 渲染玩家設定 UI
function renderPlayerConfigUI() {
    if (!playerConfigTableBody) {
        console.error("找不到玩家設定表格的 tbody！");
        return;
    }
    playerConfigTableBody.innerHTML = '';

    // 確保至少有基本結構，即使 API 沒返回 players
    const playersToRender = currentPlayers.length > 0 ? currentPlayers : [
        { player_number: 1, name: null, avatar_url: null },
        { player_number: 2, name: null, avatar_url: null },
        { player_number: 3, name: null, avatar_url: null } // 假設最多3個玩家
    ];
    // 如果 API 返回的玩家數不足 3，補足到 3 個
    while (playersToRender.length < 3) {
        playersToRender.push({ player_number: playersToRender.length + 1, name: null, avatar_url: null });
    }
    // 只保留前 3 個玩家的設定
    const finalPlayers = playersToRender.slice(0, 3);
    currentPlayers = finalPlayers; // 更新全域變數

    finalPlayers.forEach((player, index) => {
        const row = document.createElement('tr');

        const cellNum = document.createElement('td');
        cellNum.textContent = `P${player.player_number}`;
        row.appendChild(cellNum);

        const cellName = document.createElement('td');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = player.name || '';
        nameInput.placeholder = `玩家 ${player.player_number} 名稱`;
        nameInput.dataset.playerIndex = index;
        nameInput.addEventListener('input', handlePlayerInputChange);
        cellName.appendChild(nameInput);
        row.appendChild(cellName);

        const cellAvatarUrl = document.createElement('td');
        const avatarUrlInput = document.createElement('input');
        avatarUrlInput.type = 'url';
        avatarUrlInput.value = player.avatar_url || '';
        avatarUrlInput.placeholder = `玩家 ${player.player_number} 頭像 URL`;
        avatarUrlInput.dataset.playerIndex = index;
        avatarUrlInput.addEventListener('input', handlePlayerInputChange);
        cellAvatarUrl.appendChild(avatarUrlInput);
        row.appendChild(cellAvatarUrl);

        const cellAvatarPreview = document.createElement('td');
        const avatarPreviewImg = document.createElement('img');
        avatarPreviewImg.src = player.avatar_url || `https://via.placeholder.com/40?text=P${player.player_number}`;
        avatarPreviewImg.alt = `玩家 ${player.player_number} 頭像預覽`;
        avatarPreviewImg.onerror = () => { avatarPreviewImg.src = 'https://via.placeholder.com/40?text=X'; }; // 改成顯示 X
        avatarPreviewImg.id = `player-avatar-preview-${index}`;
        cellAvatarPreview.appendChild(avatarPreviewImg);
        row.appendChild(cellAvatarPreview);

        playerConfigTableBody.appendChild(row);
    });
}

// 處理玩家輸入框變更
function handlePlayerInputChange(event) {
    const inputElement = event.target;
    const playerIndex = parseInt(inputElement.dataset.playerIndex);

    // 確保索引有效且 currentPlayers[playerIndex] 存在
    if (isNaN(playerIndex) || playerIndex < 0 || playerIndex >= currentPlayers.length || !currentPlayers[playerIndex]) {
        console.error(`處理玩家輸入時索引無效或玩家資料不存在: index=${playerIndex}`);
        return;
    }
    const player = currentPlayers[playerIndex];

    if (inputElement.type === 'text') {
        player.name = inputElement.value.trim() || null; // 空字串存為 null
    } else if (inputElement.type === 'url') {
        const newUrl = inputElement.value.trim();
        player.avatar_url = newUrl || null;
        const previewImg = document.getElementById(`player-avatar-preview-${playerIndex}`);
        if (previewImg) {
            previewImg.src = newUrl || `https://via.placeholder.com/40?text=P${player.player_number}`;
        }
    }
}

// 保存所有變更到伺服器
function saveAllChanges() {
    if (!currentTemplateId) {
        console.error("儲存時沒有當前模板 ID");
        alert("錯誤：沒有載入模板，無法儲存！");
        return;
    }
    
    // 確保 cells 資料包含 note 欄位
    const cellsToSave = cells.map(cell => ({
        ...cell, 
        note: cell.note || null // 確保 note 欄位存在且值有效
    }));
    
    const body = JSON.stringify({
        background_color: backgroundColor,
        logo_url: currentLogoUrl,
        cells: cellsToSave, // 使用包含備註的格子資料
        players: currentPlayers
    });

    saveTemplateBtn.disabled = true;
    saveTemplateBtn.textContent = '儲存中...';

    fetch(`/api/rich-map/templates/${currentTemplateId}/full`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body
    })
    .then(res => {
        if (res.ok) {
            return res.json();
        } else {
            return res.json().then(errData => {
                throw new Error(`伺服器錯誤 ${res.status}: ${errData.error || '未知錯誤'}`);
            }).catch(() => {
                throw new Error(`伺服器錯誤 ${res.status}`);
            });
        }
    })
    .then(data => {
        console.log("儲存成功回應:", data);
        alert(`✅ 儲存成功！ (${data.message || ''})`);
    })
    .catch(err => {
        console.error('❌ 儲存失敗:', err);
        alert(`儲存失敗：\n${err.message}\n請檢查後端連線及伺服器日誌。`);
    })
    .finally(() => {
        saveTemplateBtn.disabled = false;
        saveTemplateBtn.textContent = '💾 儲存目前版本';
    });
}

// 上傳圖片工具函數
function uploadImage(file, callback) {
    const formData = new FormData();
    formData.append('image', file);

    fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(errData => {
                throw new Error(`圖片上傳失敗 ${res.status}: ${errData.error || '伺服器錯誤'}`);
            }).catch(() => {
                throw new Error(`圖片上傳失敗 ${res.status}`);
            });
        }
        return res.json();
    })
    .then(data => {
        if (data.success && data.url) {
            callback(data.url);
        } else {
            throw new Error(data.error || '上傳成功但未返回 URL');
        }
    })
    .catch(err => {
        alert(`❌ 圖片上傳失敗：\n${err.message}`);
        console.error(err);
        callback(null);
    });
}

// 高亮格子的輔助函數
function highlightCell(index) {
    const cells = document.querySelectorAll('.cell');
    if (cells[index]) {
        // 添加高亮类
        cells[index].classList.add('cell-highlight');
        // 1秒后移除高亮
        setTimeout(() => {
            cells[index].classList.remove('cell-highlight');
        }, 1000);
    }
}

// 顯示臨時消息的輔助函數
function showTemporaryMessage(message) {
    // 创建一个消息元素
    const msgEl = document.createElement('div');
    msgEl.className = 'temp-message';
    msgEl.textContent = message;
    msgEl.style.position = 'fixed';
    msgEl.style.top = '10px';
    msgEl.style.left = '50%';
    msgEl.style.transform = 'translateX(-50%)';
    msgEl.style.padding = '10px 20px';
    msgEl.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    msgEl.style.color = 'white';
    msgEl.style.borderRadius = '5px';
    msgEl.style.zIndex = 1000;
    
    // 添加到页面
    document.body.appendChild(msgEl);
    
    // 3秒后删除
    setTimeout(() => {
        document.body.removeChild(msgEl);
    }, 3000);
}

// --- 事件監聽器設定 ---

// 載入模板按鈕
if (loadTemplateBtn && templateSelect) {
    loadTemplateBtn.addEventListener('click', () => {
        const selectedId = templateSelect.value;
        if (selectedId) {
            loadTemplate(parseInt(selectedId));
        } else {
            alert("請先從下拉選單中選擇一個模板！");
        }
    });
} else {
    console.warn("載入模板按鈕或下拉選單未找到。");
}

// 儲存模板按鈕
if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener('click', () => {
        saveAllChanges();
    });
} else {
    console.warn("儲存模板按鈕未找到。");
}

// Logo URL 輸入框即時預覽
if (logoUrlInput && logoPreview) {
    logoUrlInput.addEventListener('input', () => {
        currentLogoUrl = logoUrlInput.value.trim();
        logoPreview.src = currentLogoUrl;
    });
} else {
    console.warn("Logo URL 輸入框或預覽圖片元素未找到。");
}

// Ctrl+S 儲存快捷鍵
document.addEventListener('keydown', e => {
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        console.log("偵測到 Ctrl+S，觸發儲存...");
        if (currentTemplateId && saveTemplateBtn && !saveTemplateBtn.disabled) { // 檢查按鈕是否可用
            saveAllChanges();
        } else if (!currentTemplateId) {
            console.warn("Ctrl+S 儲存失敗：沒有載入模板。");
        } else {
            console.warn("Ctrl+S 儲存失敗：儲存按鈕目前被禁用(可能正在儲存中)。");
        }
    }
});

// "另存為新版本..." 按鈕
if (saveAsNewBtn) {
    saveAsNewBtn.addEventListener('click', () => {
        const newName = prompt("請輸入新版本的名稱：");
        if (newName && newName.trim()) {
            // 收集當前所有資料
            const currentData = {
                template_name: newName.trim(),
                background_color: backgroundColor,
                logo_url: currentLogoUrl,
                cells: cells,
                players: currentPlayers
            };
            createNewTemplateInAPI(currentData); // 呼叫 API 函數
        } else if (newName !== null) { // 使用者沒取消，但輸入了空值
            alert("模板名稱不能為空！");
        }
    });
} else {
    console.warn("另存為新版本按鈕未找到。");
}

// "新建地圖..." 按鈕
if (createNewBtn) {
    createNewBtn.addEventListener('click', () => {
        const newName = prompt("請輸入新地圖的名稱：");
        if (newName && newName.trim()) {
            // 只傳送新名稱，後端會知道要用預設資料
            const payload = {
                template_name: newName.trim(),
                // 可以在這裡加一個標記，讓後端更明確知道是新建
                // is_new_creation: true
            };
            createNewTemplateInAPI(payload); // 呼叫 API 函數
        } else if (newName !== null) {
            alert("地圖名稱不能為空！");
        }
    });
} else {
    console.warn("新建地圖按鈕未找到。");
}

// 刪除模板按鈕
if (deleteTemplateBtn) {
    deleteTemplateBtn.addEventListener('click', deleteCurrentTemplate);
} else {
    console.warn("刪除模板按鈕未找到。");
}

// 保存格子按鈕
const saveCellBtn = document.getElementById('save-cell-btn');
if (saveCellBtn) {
    saveCellBtn.addEventListener('click', saveCellChanges);
} else {
    console.warn("保存格子按鈕未找到");
}

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM 已載入，開始初始化...");
    fetchTemplateList(); // 獲取模板列表並自動載入第一個
    initBackgroundColorInput();
});