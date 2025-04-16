// --- DOM 元素獲取 ---
const container = document.getElementById('game-container');
const board = document.getElementById('game-board');
const editorPanel = document.getElementById('editor-panel');
// (格子編輯面板內的元素)
const titleInput = document.getElementById('edit-title');
const descInput = document.getElementById('edit-description');
const colorInput = document.getElementById('edit-color');
const imageInput = document.getElementById('edit-image');
const panelImageFile = document.getElementById('panel-image-file');
const uploadPanelImageBtn = document.getElementById('upload-panel-image-btn');
// (Logo 元素)
const logoUrlInput = document.getElementById('edit-logo-url');
const logoPreview = document.getElementById('logo-preview');
// (版本控制元素)
const templateSelect = document.getElementById('template-select');
const loadTemplateBtn = document.getElementById('load-template-btn');
const saveTemplateBtn = document.getElementById('save-template-btn');

// --- 全域變數 ---
let editingIndex = -1;
let cells = [];
let currentTemplateId = null; // 初始設為 null，表示尚未載入
let backgroundColor = '#fff0f5';
let currentLogoUrl = '';
// (玩家設定變數，先預留)
// let currentPlayers = [];

// --- 函數定義 ---

// 套用背景顏色
function applyTemplateBackgroundColor(color) {
  backgroundColor = color || '#fff0f5';
  // 確保 container 存在才操作
  if (container) {
      container.style.backgroundColor = backgroundColor;
  } else {
      console.error("無法找到 ID 為 'game-container' 的元素來設定背景色");
  }
}

// 渲染地圖格子
function renderBoard() {
    // 確保 board 存在才操作
    if (!board) {
        console.error("無法找到 ID 為 'game-board' 的元素來渲染格子");
        return;
    }
  board.innerHTML = ''; // 清空格子
  cells.forEach((cell, i) => {
    const div = document.createElement('div');
    div.className = 'cell';
    // 確保 x, y 是有效的數字
    const x = Number(cell.x);
    const y = Number(cell.y);
    if (!isNaN(x) && !isNaN(y)) {
        div.style.left = `${x * 125}px`;
        div.style.top = `${y * 100}px`;
    } else {
        console.warn(`格子 ${i} 的 x 或 y 座標無效:`, cell);
    }
    div.style.backgroundColor = cell.color || '#cccccc'; // 提供預設顏色

    if (cell.image_url) {
      const img = document.createElement('img');
      img.src = cell.image_url;
      img.alt = cell.title || '格子圖片'; // 提供預設 alt
      img.onerror = () => { img.style.display = 'none'; }; // 圖片載入失敗時隱藏
      div.appendChild(img);
    }

    // 使用 class 方便 CSS 控制樣式
    const titleDiv = document.createElement('div');
    titleDiv.className = 'title'; // <--- 加入 class
    titleDiv.textContent = cell.title || ''; // 確保有預設值
    div.appendChild(titleDiv);

    const descDiv = document.createElement('div');
    descDiv.className = 'description'; // <--- 加入 class
    descDiv.textContent = cell.description || ''; // 確保有預設值
    div.appendChild(descDiv);

    div.onclick = () => openEditor(i);
    board.appendChild(div);
  });
}


// 打開編輯器
function openEditor(index) {
    if (!editorPanel || !titleInput || !descInput || !colorInput || !imageInput) {
        console.error("編輯器面板的 DOM 元素未完全找到！");
        return;
    }
  editingIndex = index;
  const cell = cells[editingIndex];
  if (!cell) {
      console.error(`無法找到索引為 ${index} 的格子資料`);
      return;
  }
  titleInput.value = cell.title || '';
  descInput.value = cell.description || '';
  colorInput.value = cell.color || '#ffffff';
  imageInput.value = cell.image_url || '';
  // 更新圖片預覽
  const previewImage = document.getElementById('preview-image');
  if (previewImage) {
    previewImage.src = cell.image_url || '';
  }
  editorPanel.style.display = 'flex';
}

// 儲存單一格子編輯（更新前端記憶體）
function saveCellChanges() {
    if (editingIndex < 0 || !cells[editingIndex]) {
        console.error("儲存格子時編輯索引無效");
        return;
    }
    const cell = cells[editingIndex];
    cell.title = titleInput.value.trim();
    cell.description = descInput.value.trim();
    cell.color = colorInput.value;
    cell.image_url = imageInput.value.trim() || null; // 空字串存為 null

    renderBoard(); // 重新渲染以顯示變更
    if (editorPanel) {
        editorPanel.style.display = 'none'; // 關閉面板
    }
}

// 獲取並填充模板列表
async function fetchTemplateList() {
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

        templateSelect.innerHTML = ''; // 清空

        if (!Array.isArray(templates) || templates.length === 0) {
            templateSelect.innerHTML = '<option value="">-- 沒有可用模板 --</option>';
            loadTemplateBtn.disabled = true;
            saveTemplateBtn.disabled = true; // 沒有模板也不能儲存
             // 清空畫面
             if (board) board.innerHTML = '';
             if (logoUrlInput) logoUrlInput.value = '';
             if (logoPreview) logoPreview.src = '';
             applyTemplateBackgroundColor('#fff0f5'); // 重設背景
            return;
        }

        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = `${template.template_name} (ID: ${template.id})`; // 顯示名稱和 ID
            templateSelect.appendChild(option);
        });

        // 預設選中第一個並載入
        templateSelect.value = templates[0].id;
        loadTemplateBtn.disabled = false;
        saveTemplateBtn.disabled = true; // 初始載入時先禁用儲存，等待載入完成
        await loadTemplate(templates[0].id); // 自動載入第一個

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

    // 顯示載入中狀態
    if (board) board.innerHTML = '<p style="text-align: center;">載入中...</p>';
    if (logoUrlInput) logoUrlInput.value = '';
    if (logoPreview) logoPreview.src = '';
    backgroundColor = '#fff0f5';
    applyTemplateBackgroundColor(backgroundColor);
    saveTemplateBtn.disabled = true; // 載入過程中禁用儲存

    try {
        const response = await fetch(`/api/rich-map/templates/${currentTemplateId}/full`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`伺服器錯誤 ${response.status}: ${errData.error || response.statusText}`);
        }
        const data = await response.json();
        console.log("載入的模板資料:", data);

        applyTemplateBackgroundColor(data.background_color);
        cells = data.cells || [];
        currentLogoUrl = data.logo_url || '';
        if (logoUrlInput) logoUrlInput.value = currentLogoUrl;
        if (logoPreview) logoPreview.src = currentLogoUrl;

        // (預留載入玩家資料)
        // currentPlayers = data.players || [];
        // renderPlayerConfigUI();

        renderBoard();
        saveTemplateBtn.disabled = false; // 載入成功，啟用儲存

    } catch (err) {
        console.error('❌ 載入模板失敗:', err);
        alert(`無法載入模板資料 (ID: ${currentTemplateId})：\n${err.message}\n請檢查後端 API 是否正常運作，以及模板 ID 是否存在。`);
        if (board) board.innerHTML = '<p style="color: red; text-align: center;">載入地圖失敗</p>';
        cells = [];
        currentLogoUrl = '';
        if (logoUrlInput) logoUrlInput.value = '';
        if (logoPreview) logoPreview.src = '';
        saveTemplateBtn.disabled = true;
        currentTemplateId = null; // 重設 ID
    }
}

// 儲存目前編輯的模板資料到後端
function saveAllChanges() {
    if (!currentTemplateId) {
        alert("錯誤：尚未載入任何模板，無法儲存！");
        return;
    }

    console.log(`準備儲存模板 ID: ${currentTemplateId}`, { backgroundColor, currentLogoUrl, cells });
    const body = JSON.stringify({
        background_color: backgroundColor,
        logo_url: currentLogoUrl,
        cells: cells, // cells 陣列已經透過 saveCellChanges 更新了
        // (預留傳送玩家資料)
        // players: currentPlayers
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
        if (!res.ok) { // 增加錯誤處理
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
            callback(data.url); // 成功才回調 URL
        } else {
            throw new Error(data.error || '上傳成功但未返回 URL');
        }
    })
    .catch(err => {
        alert(`❌ 圖片上傳失敗：\n${err.message}`);
        console.error(err);
        callback(null); // 失敗回調 null
    });
}

// --- 事件監聽器 ---

// 編輯面板內的圖片上傳按鈕
if (uploadPanelImageBtn && panelImageFile && imageInput) {
    uploadPanelImageBtn.addEventListener('click', () => {
      if (panelImageFile.files.length > 0) {
        const file = panelImageFile.files[0];
        uploadPanelImageBtn.textContent = '上傳中..'; // 增加提示
        uploadPanelImageBtn.disabled = true;
        uploadImage(file, (uploadedUrl) => {
          uploadPanelImageBtn.textContent = '上傳'; // 恢復按鈕文字
          uploadPanelImageBtn.disabled = false;
          if (uploadedUrl) {
            imageInput.value = uploadedUrl;
            const previewImage = document.getElementById('preview-image');
            if (previewImage) previewImage.src = uploadedUrl;
            // alert('圖片上傳成功！URL 已填入。'); // 可選：成功提示已在 uploadImage 中
          }
          // 失敗提示已在 uploadImage 中處理
        });
      } else {
        alert('請先選擇要上傳的圖片檔案。');
      }
    });
} else {
    console.warn("編輯面板的上傳相關 DOM 元素未完全找到，上傳功能可能異常。");
}

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
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { // 兼容大小寫 S
        e.preventDefault();
        console.log("偵測到 Ctrl+S，觸發儲存...");
        // 確保有模板已載入且儲存按鈕是啟用的
        if (currentTemplateId && !saveTemplateBtn.disabled) {
            saveAllChanges();
        } else if (!currentTemplateId) {
            console.warn("Ctrl+S 儲存失敗：沒有載入模板。");
        } else {
            console.warn("Ctrl+S 儲存失敗：儲存按鈕目前被禁用。");
        }
    }
});

// 拖曳編輯面板
const dragPanel = document.getElementById('editor-panel');
const header = dragPanel ? dragPanel.querySelector('.editor-header') : null;

if (dragPanel && header) {
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', e => {
        // 防止在輸入框上觸發拖曳
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'LABEL') {
            return;
        }
        isDragging = true;
        // 計算滑鼠相對於面板左上角的位置
        const rect = dragPanel.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        header.style.cursor = 'grabbing'; // 改變滑鼠樣式
        // 移除可能存在的 transform 以便 left/top 定位生效
        dragPanel.style.transform = 'translate(0, 0)';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = 'grab'; // 恢復滑鼠樣式
        }
    });

    document.addEventListener('mousemove', e => {
        if (isDragging) {
            // 設定面板的新位置 (滑鼠位置 - 偏移量)
            dragPanel.style.left = `${e.clientX - offsetX}px`;
            dragPanel.style.top = `${e.clientY - offsetY}px`;
        }
    });
} else {
    console.warn("編輯面板或其標題頭未找到，拖曳功能將無法使用。");
}


// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM 已載入，開始初始化...");
    // 確保 DOM 完全載入後再執行初始化邏輯
    fetchTemplateList(); // 獲取模板列表並自動載入第一個
});