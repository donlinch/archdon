 
// --- START OF FILE card-game.js ---

// 全局變量來緩存模板數據
let cachedTemplates = null; // 現在會存儲從 API 獲取的模板對象數組 {id, template_name, content_data, ...}

// 遊戲狀態和默認內容
const gameState = {
    boardSize: {rows: 4, cols: 5},
    contents: Array(20).fill('').map((_, i) => `內容 ${i+1}`), // 這是 *編輯器* 的內容
    revealed: Array(20).fill(false),
    contentPositions: Array(20).fill(0).map((_, i) => i), // 內容位置映射 (用於隨機化)
    cardTimerId: null, // 計時器ID追蹤變數
    // gameState.useServerStorage flag is removed, we always try the server first.
};

// DOM 元素引用獲取函數 - 避免在DOM加載前嘗試獲取元素
function getDOMElements() {
    return {
        configModal: document.getElementById('configModal'),
        configBtn: document.getElementById('configBtn'),
        templatesBtn: document.getElementById('templatesBtn'), // Button to open template manager
        closeBtn: document.querySelector('#configModal .close'), // Close button for config modal
        saveConfigBtn: document.getElementById('saveConfigBtn'),
        resetBtn: document.getElementById('resetBtn'),
        inputGrid: document.getElementById('inputGrid'),
        centeredCard: document.getElementById('centeredCard'),
        cardInner: document.getElementById('cardInner'),
        cardCloseBtn: document.querySelector('#centeredCard .card-close'), // Close button for centered card
        navToggle: document.getElementById('navToggle'),
        // Elements within the config modal's template section
        templateSelect: document.getElementById('templateSelect'),
        templateNameInput: document.getElementById('templateNameInput'),
        saveTemplateBtn: document.getElementById('saveTemplateBtn'),
        loadTemplateBtn: document.getElementById('loadTemplateBtn'),
        deleteTemplateBtn: document.getElementById('deleteTemplateBtn'),
        // Header and Footer for navigation
        gameHeader: document.getElementById('gameHeader'),
        gameFooter: document.getElementById('gameFooter'),
        gameBoard: document.getElementById('gameBoard')
        // Template Manager Modal elements (will be obtained when manager is shown)
    };
}

// 洗牌函數 (Fisher-Yates 算法)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 初始化遊戲板
function initializeBoard() {
    const { gameBoard } = getDOMElements();
    if (!gameBoard) {
        console.error("遊戲板元素未找到！");
        return;
    }
    gameBoard.innerHTML = ''; // 清空現有格子

    const totalCells = gameState.boardSize.rows * gameState.boardSize.cols;

    // 確保 contentPositions 陣列長度正確
    if (gameState.contentPositions.length !== totalCells) {
        console.warn("Content positions array length mismatch. Resetting.");
        gameState.contentPositions = Array(totalCells).fill(0).map((_, i) => i);
        shuffleArray(gameState.contentPositions);
    }
    // 確保 contents 陣列長度正確
     if (!Array.isArray(gameState.contents) || gameState.contents.length !== totalCells) {
         console.warn("Contents array length mismatch or not an array. Resetting to defaults.");
         gameState.contents = Array(totalCells).fill('').map((_, i) => `內容 ${i + 1}`);
     }
     // 確保 revealed 陣列長度正確
     if (gameState.revealed.length !== totalCells) {
         console.warn("Revealed array length mismatch. Resetting.");
         gameState.revealed = Array(totalCells).fill(false);
     }


    for (let i = 0; i < totalCells; i++) {
        const hole = document.createElement('div');
        hole.className = 'hole';
        hole.dataset.index = i;

        const front = document.createElement('div');
        front.className = 'hole-face hole-front';

        const back = document.createElement('div');
        back.className = 'hole-face hole-back';
        // 使用位置映射獲取內容
        const contentIndex = gameState.contentPositions[i];
        // 從 gameState.contents 獲取實際內容
        back.textContent = gameState.contents[contentIndex] || `?`; // 如果內容為空，顯示 ?

        hole.appendChild(front);
        hole.appendChild(back);
        gameBoard.appendChild(hole);

        if (gameState.revealed[i]) {
            hole.classList.add('revealed');
        }

        hole.addEventListener('click', revealHole);
    }
}


// 初始化配置模態窗口中的輸入框
function initializeInputs() {
    const { inputGrid } = getDOMElements();
     if (!inputGrid) {
        console.error("輸入網格元素未找到！");
        return;
     }
    inputGrid.innerHTML = ''; // 清空現有輸入框
    const totalCells = gameState.boardSize.rows * gameState.boardSize.cols;

    // 確保 gameState.contents 陣列長度正確
    if (!Array.isArray(gameState.contents) || gameState.contents.length !== totalCells) {
        console.warn("Contents array length mismatch or not an array during input init. Resetting to defaults.");
        gameState.contents = Array(totalCells).fill('').map((_, i) => `內容 ${i + 1}`);
    }

    for (let i = 0; i < totalCells; i++) {
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';

        const label = document.createElement('label');
        label.textContent = i + 1;
        label.setAttribute('for', `content-${i}`);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `content-${i}`;
        // 從 gameState.contents 讀取值來填充輸入框
        input.value = gameState.contents[i] || ''; // Use empty string if content is undefined/null
        input.placeholder = `格子 ${i+1} 內容`;

        inputGroup.appendChild(label);
        inputGroup.appendChild(input);
        inputGrid.appendChild(inputGroup);
    }
}


// 點擊揭示內容
function revealHole(event) {
    const hole = event.currentTarget;
    const index = parseInt(hole.dataset.index);

    if (!gameState.revealed[index]) {
        hole.classList.add('revealed');

        // 獲取內容索引（根據隨機位置映射）
        const contentIndex = gameState.contentPositions[index];

        // 確保內容索引有效
        if (contentIndex >= 0 && contentIndex < gameState.contents.length) {
            // 從 gameState.contents 獲取內容並顯示
            showCenteredCard(gameState.contents[contentIndex], index);
        } else {
            console.error(`無效的內容索引 ${contentIndex} 對於格子 ${index}`);
            showCenteredCard("錯誤", index); // 顯示錯誤提示
        }

        gameState.revealed[index] = true;
    }
}


// 顯示居中卡片
function showCenteredCard(content, index) {
    const { centeredCard, cardInner, cardCloseBtn } = getDOMElements();
    if (!centeredCard || !cardInner || !cardCloseBtn) return;

    // 清除之前的計時器
    if (gameState.cardTimerId !== null) {
        clearTimeout(gameState.cardTimerId);
        gameState.cardTimerId = null;
    }

    cardInner.textContent = content || "?"; // Show '?' if content is empty/null/undefined
    centeredCard.style.display = 'flex';
    centeredCard.classList.remove('closing'); // 確保移除關閉動畫類

    // 移除舊的事件監聽器（如果需要）並添加新的
    cardCloseBtn.onclick = closeCenteredCard; // 直接賦值 onclick 比較簡單
    centeredCard.onclick = closeCenteredCard; // 點擊背景關閉

    // 防止點擊內容區域關閉卡片
    const cardContentElement = document.querySelector('.centered-card-content');
    if (cardContentElement) {
        cardContentElement.onclick = (e) => e.stopPropagation();
    }


    // 10秒後自動關閉
    gameState.cardTimerId = setTimeout(() => {
        if (centeredCard.style.display === 'flex') {
            closeCenteredCard();
        }
    }, 10000);
}

// 關閉居中卡片
function closeCenteredCard() {
    const { centeredCard } = getDOMElements();
    if (!centeredCard || centeredCard.style.display === 'none') return; // 防止重複觸發

    // 清除計時器
    if (gameState.cardTimerId !== null) {
        clearTimeout(gameState.cardTimerId);
        gameState.cardTimerId = null;
    }

    centeredCard.classList.add('closing');

    // 等待動畫完成後隱藏
    setTimeout(() => {
        centeredCard.style.display = 'none';
        centeredCard.classList.remove('closing');
        // 移除事件監聽器
        centeredCard.onclick = null;
        const cardCloseBtn = document.querySelector('#centeredCard .card-close');
        if(cardCloseBtn) cardCloseBtn.onclick = null;
         const cardContentElement = document.querySelector('.centered-card-content');
        if(cardContentElement) cardContentElement.onclick = null;

    }, 500); // 動畫時間為 0.5s
}


// 保存配置 (從輸入框更新 gameState.contents)
function saveConfig() {
    const { configModal } = getDOMElements();
    const totalCells = gameState.boardSize.rows * gameState.boardSize.cols;
    const newContents = [];

    for (let i = 0; i < totalCells; i++) {
        const input = document.getElementById(`content-${i}`);
        if (input) {
             // 如果輸入為空，存儲一個預設值或空字符串
            newContents.push(input.value || `格子 ${i+1}`);
        } else {
            // 如果找不到輸入框，保留舊內容或預設值
            newContents.push(gameState.contents[i] || `格子 ${i+1}`);
        }
    }
    // 更新 gameState
    gameState.contents = newContents;

    // 更新遊戲板上顯示的內容 (重要!)
    updateBoardContent();

    if(configModal) configModal.style.display = 'none';
    alert('設置已保存到當前遊戲。'); // 提示用戶設置已應用到當前遊戲
}


// 更新遊戲板格子背面的內容 (使用 gameState.contents)
function updateBoardContent() {
    const holes = document.querySelectorAll('#gameBoard .hole');
    const totalCells = gameState.boardSize.rows * gameState.boardSize.cols;

    if (holes.length !== totalCells) {
        console.error("遊戲板上的格子數量與預期不符！");
        initializeBoard(); // 嘗試重新初始化
        return;
    }
     // 確保 gameState.contents 是有效陣列且長度正確
    if (!Array.isArray(gameState.contents) || gameState.contents.length !== totalCells) {
        console.error("無法更新遊戲板：gameState.contents 無效或長度不正確。");
        return;
    }

    holes.forEach((hole, i) => {
        const back = hole.querySelector('.hole-back');
        if (back) {
            // 使用 gameState.contentPositions 確定該格子對應哪個內容索引
            const contentIndex = gameState.contentPositions[i];
             // 從 gameState.contents 中獲取實際內容
            back.textContent = gameState.contents[contentIndex] || `?`; // 使用預設值以防萬一
        }
    });
}


// 重置遊戲狀態並重新渲染
function resetGame() {
    const totalCells = gameState.boardSize.rows * gameState.boardSize.cols;
    gameState.revealed = Array(totalCells).fill(false);

    // 隨機打亂內容位置映射
    gameState.contentPositions = Array(totalCells).fill(0).map((_, i) => i);
    shuffleArray(gameState.contentPositions);

    // 重新渲染遊戲板（會使用最新的 gameState.contents 和隨機的 contentPositions）
    initializeBoard();

    // 如果導航菜單是打開的，關閉它
    closeNavigationIfOpen();
    alert('遊戲已重置！');
}


// 設置默認/示例內容到 gameState.contents
function setExampleContent() {
    const exampleContent = [
        '恭喜獲得100元', '再接再厲', '謝謝參與', '恭喜獲得50元',
        '幸運獎', '謝謝參與', '恭喜獲得20元', '再接再厲',
        '謝謝參與', '恭喜獲得10元', '加油', '謝謝參與',
        '恭喜獲得5元', '不要灰心', '謝謝參與', '恭喜獲得2元',
        '繼續努力', '謝謝參與', '恭喜獲得1元', '期待下次'
    ];
     const totalCells = gameState.boardSize.rows * gameState.boardSize.cols;
    // 確保示例內容長度足夠
    gameState.contents = Array(totalCells).fill('').map((_, i) => exampleContent[i % exampleContent.length]);
}


// 切換導航顯示狀態
function toggleNavigation() {
    const { gameHeader, gameFooter, navToggle } = getDOMElements();
    if (!gameHeader || !gameFooter || !navToggle) return false;

    let navVisible = gameHeader.classList.toggle('visible');

    if (navVisible) {
        gameFooter.style.display = 'block'; // Or 'flex', depending on your layout
        navToggle.textContent = '×'; // Change icon to close
    } else {
        gameFooter.style.display = 'none';
        navToggle.textContent = '≡'; // Change icon to menu
    }

    return navVisible;
}

// 檢查並關閉導航菜單（如果它是打開的）
function closeNavigationIfOpen() {
    const { gameHeader, navToggle } = getDOMElements();
    if (!gameHeader || !navToggle) return;

    if (gameHeader.classList.contains('visible')) {
        toggleNavigation(); // Call the toggle function to close it
    }
}


// ----- 模板管理相關函數 (已修改為使用 API) -----

// 從服務器加載所有模板
async function loadTemplates() {
    console.log("正在從 API 加載模板...");
    try {
        const response = await fetch('/api/card-game/templates');
        if (!response.ok) {
            // Try to get error message from response body
            let errorMsg = `無法加載模板: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (parseError) {
                // Ignore if response body is not JSON or empty
            }
            throw new Error(errorMsg);
        }
        const templates = await response.json(); // API 返回 {id, template_name, content_data, ...}[]
        console.log("從 API 成功加載模板:", templates);
        cachedTemplates = templates; // 直接緩存 API 返回的數組
        return templates;
    } catch (error) {
        console.error('從 API 加載模板失敗:', error);
        alert(`加載模板列表失敗: ${error.message}`);
        cachedTemplates = []; // 出錯時設置為空數組
        return []; // 返回空數組表示失敗或無數據
    }
}
// 更新模板下拉選單 (使用 cachedTemplates 數組)
async function updateTemplateSelect() {
    const { templateSelect, loadTemplateBtn, deleteTemplateBtn } = getDOMElements();
    if (!templateSelect || !loadTemplateBtn || !deleteTemplateBtn) return;

    // 清空當前選項
    templateSelect.innerHTML = '<option value="" disabled selected>-- 選擇已保存的模板 --</option>';

    // 如果緩存不存在或為空，嘗試加載
    if (!cachedTemplates || cachedTemplates.length === 0) {
        console.log("緩存為空，嘗試重新加載模板...");
        await loadTemplates(); // loadTemplates 會更新 cachedTemplates
    }

    // 檢查加載後的緩存
    if (!cachedTemplates || cachedTemplates.length === 0) {
        console.log("沒有找到任何模板。");
        loadTemplateBtn.disabled = true;
        deleteTemplateBtn.disabled = true;
        return;
    }

    // 啟用按鈕
    loadTemplateBtn.disabled = false;
    deleteTemplateBtn.disabled = false;

    // 添加模板選項
    cachedTemplates.forEach(template => {
        // 確保 template 有所有必要的屬性
        if (!template.id || !template.template_name) {
            console.warn("跳過不完整的模板數據:", template);
            return;
        }

        // 確保 content_data 是有效的
        let contentData = template.content_data;
        if (!contentData) {
            console.warn(`模板 "${template.template_name}" 無內容數據，將使用空陣列`);
            contentData = [];
        }
        
        const option = document.createElement('option');
        option.value = template.template_name; // value 仍然用 name，方便查找
        option.textContent = template.template_name;
        option.dataset.id = template.id; // 存儲模板 ID
        
        // 安全地處理 JSON 字符串化
        try {
            option.dataset.content = JSON.stringify(contentData);
        } catch (e) {
            console.error(`無法將模板 "${template.template_name}" 的內容轉換為 JSON:`, e);
            option.dataset.content = '[]'; // 出錯時使用空陣列
        }
        
        templateSelect.appendChild(option);
    });
    
    console.log("模板下拉選單已更新，共 " + cachedTemplates.length + " 個模板");
}

// 清除模板緩存
function clearTemplateCache() {
    cachedTemplates = null;
    console.log("模板緩存已清除。");
}
// 保存當前內容為模板 (使用 API) - 修正 JSON 格式問題
async function saveCurrentAsTemplate() {
    const { templateNameInput } = getDOMElements();
    const templateName = templateNameInput.value.trim();

    // 1. 驗證名稱
    if (!templateName) {
        alert('請輸入模板名稱！');
        templateNameInput.focus();
        return;
    }

    // 2. 獲取當前輸入框的內容 - 確保是陣列格式
    const templateContent = [];  // 一定要是陣列！
    const totalCells = gameState.boardSize.rows * gameState.boardSize.cols;
    let hasContent = false; // 檢查是否有實際內容
    
    for (let i = 0; i < totalCells; i++) {
        const input = document.getElementById(`content-${i}`);
        const content = input ? (input.value || `格子 ${i+1}`) : `格子 ${i+1}`;
        templateContent.push(content);  // 將內容加入陣列
        
        // 檢查是否至少有一個非預設內容的格子
        if (input && input.value && input.value.trim() !== `格子 ${i+1}`) {
            hasContent = true;
        }
    }
    
    // 3. 檢查資料完整性
    if (!hasContent) {
        if (!confirm('所有格子內容似乎都是預設值。確定要儲存此模板嗎？')) {
            return;
        }
    }

    // 檢查名稱是否與現有模板衝突
    if (cachedTemplates && cachedTemplates.some(t => t.template_name === templateName)) {
        if (!confirm(`模板 "${templateName}" 已存在。若繼續將創建一個新模板。是否繼續？`)) {
            templateNameInput.focus();
            return;
        }
    }

    console.log(`正在嘗試保存模板: ${templateName}`, templateContent);
    console.log("templateContent 類型:", Array.isArray(templateContent) ? "陣列" : typeof templateContent);
    
    // 4. 確保傳送有效的 JSON 資料格式
    try {
        // 先測試我們的資料是否能被正確地序列化為 JSON
        const testJson = JSON.stringify(templateContent);
        console.log("資料可序列化為有效 JSON:", testJson.substring(0, 100) + "...");
        
        // 5. 調用 API 保存模板
        const response = await fetch('/api/card-game/templates', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                template_name: templateName,
                content_data: templateContent,  // 確保這是一個陣列！
                is_public: true
            })
        });

        // 檢查回應
        if (response.status === 201) { // Created
            const newTemplate = await response.json();
            console.log("模板保存成功:", newTemplate);
            alert(`模板 "${templateName}" 已成功保存！`);
            clearTemplateCache();
            await updateTemplateSelect();
            templateNameInput.value = '';
            
            // 選中新創建的模板
            const { templateSelect } = getDOMElements();
            if(templateSelect) templateSelect.value = templateName;
        } else {
            // 詳細處理錯誤
            let errorMsg = `保存模板失敗: ${response.status} ${response.statusText}`;
            let errorDetail = "";
            
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
                errorDetail = JSON.stringify(errorData);
            } catch (parseError) {
                errorDetail = "無法解析錯誤回應";
            }
            
            console.error('保存模板失敗:', errorMsg, errorDetail);
            alert(`保存模板失敗: ${errorMsg}\n\n${errorDetail}`);
        }
    } catch (error) {
        console.error('保存模板時發生錯誤:', error);
        alert(`保存模板時出錯: ${error.message}`);
    }
}

// 從模板載入內容 (使用下拉選單的 data-* 屬性)
async function loadSelectedTemplate() {
    const { templateSelect } = getDOMElements();
    const selectedOption = templateSelect.options[templateSelect.selectedIndex];

    if (!selectedOption || !selectedOption.value) {
        alert('請選擇一個模板！');
        return;
    }

    const templateName = selectedOption.value;
    const templateId = selectedOption.dataset.id;
    const contentString = selectedOption.dataset.content; // 獲取存儲的內容字符串

    console.log(`嘗試載入模板: Name=${templateName}, ID=${templateId}`);

    if (!contentString) {
         // 如果 data-content 為空，嘗試從緩存查找（備用方案）
         console.warn(`模板 "${templateName}" 在選項中沒有找到內容，嘗試從緩存加載...`);
         if (!cachedTemplates) {
             await loadTemplates(); // 確保緩存存在
         }
         const foundTemplate = cachedTemplates ? cachedTemplates.find(t => t.id === parseInt(templateId)) : null;
         if (foundTemplate && foundTemplate.content_data) {
             loadContentToInputs(foundTemplate.content_data);
             alert(`已成功載入模板 "${templateName}"！（來自緩存）`);
         } else {
             alert(`無法載入模板 "${templateName}" 的內容！請嘗試重新加載頁面或檢查模板數據。`);
         }
         return;
     }


    try {
        const templateContent = JSON.parse(contentString); // 解析 JSON 字符串
        loadContentToInputs(templateContent); // 調用輔助函數填充輸入框
        alert(`已成功載入模板 "${templateName}"！`);
    } catch (error) {
        console.error(`解析模板 "${templateName}" (ID: ${templateId}) 內容時出錯:`, error);
        alert(`載入模板 "${templateName}" 失敗：內容格式錯誤。`);
    }
}

// 輔助函數：將內容數組填充到輸入框
function loadContentToInputs(contentArray) {
    const totalCells = gameState.boardSize.rows * gameState.boardSize.cols;
    if (!Array.isArray(contentArray)) {
        console.error("無法加載內容：提供的不是有效陣列。");
        return;
    }

    for (let i = 0; i < totalCells; i++) {
        const input = document.getElementById(`content-${i}`);
        if (input) {
            // 使用數組中的內容，如果索引超出或內容為空，則留空
            input.value = (i < contentArray.length && contentArray[i]) ? contentArray[i] : '';
        }
    }
    console.log("模板內容已加載到輸入框。");
     // 重要：加載模板後，也需要更新當前的遊戲狀態 contents
     saveConfig(); // 調用 saveConfig 將輸入框內容同步到 gameState.contents 並更新棋盤
}


// 刪除選中的模板 (使用 API)
async function deleteSelectedTemplate() {
    const { templateSelect } = getDOMElements();
    const selectedOption = templateSelect.options[templateSelect.selectedIndex];

    if (!selectedOption || !selectedOption.value) {
        alert('請選擇一個要刪除的模板！');
        return;
    }

    const templateName = selectedOption.value;
    const templateId = selectedOption.dataset.id; // **獲取模板 ID**

    if (!templateId) {
        alert('無法獲取模板 ID，無法刪除。');
        return;
    }

    if (!confirm(`確定要刪除模板 "${templateName}" (ID: ${templateId}) 嗎？此操作無法復原。`)) {
        return;
    }

    console.log(`正在嘗試刪除模板: Name=${templateName}, ID=${templateId}`);
    try {
        const response = await fetch(`/api/card-game/templates/${templateId}`, {
            method: 'DELETE'
        });

        if (response.status === 204) { // No Content (Success)
            console.log(`模板 ID ${templateId} 已成功刪除。`);
            alert(`模板 "${templateName}" 已刪除！`);
            clearTemplateCache(); // 清除緩存
            await updateTemplateSelect(); // 更新下拉列表
        } else if (response.status === 404) {
             console.warn(`嘗試刪除模板 ID ${templateId} 失敗：未找到。`);
             alert(`刪除模板 "${templateName}" 失敗：在服務器上找不到該模板。可能已被其他人刪除。`);
             clearTemplateCache(); // 清除緩存並刷新列表
             await updateTemplateSelect();
        } else {
            // 其他錯誤
            let errorMsg = `刪除模板失敗: ${response.status} ${response.statusText}`;
             try {
                 const errorData = await response.json();
                 errorMsg = errorData.error || errorMsg;
             } catch (e) { /* ignore */ }
            console.error('刪除模板失敗:', response.status, errorMsg);
            alert(`刪除模板 "${templateName}" 失敗: ${errorMsg}`);
        }
    } catch (error) {
        console.error('刪除模板時發生網絡錯誤:', error);
        alert(`刪除模板時出錯: ${error.message}`);
    }
}


// 設置事件監聽器
function setupEventListeners() {
    const elements = getDOMElements();
    if (!elements.configBtn || !elements.closeBtn || !elements.saveConfigBtn || !elements.resetBtn || !elements.saveTemplateBtn || !elements.loadTemplateBtn || !elements.deleteTemplateBtn || !elements.navToggle || !elements.templatesBtn) {
        console.error("一個或多個必要的 DOM 元素未找到，無法設置事件監聽器。");
        return;
    }

    // 配置模態窗口按鈕
    elements.configBtn.addEventListener('click', async () => { // 改為 async
        initializeInputs(); // 確保輸入框基於當前 gameState.contents 初始化
        await updateTemplateSelect(); // **異步更新**下拉列表
        if(elements.configModal) elements.configModal.style.display = 'block';
        closeNavigationIfOpen();
    });

     // 模板管理按鈕（顯示模態窗口）
     elements.templatesBtn.addEventListener('click', () => {
         showTemplateManager(); // 顯示增強的模板管理器
         closeNavigationIfOpen();
     });


    elements.closeBtn.addEventListener('click', () => {
        if(elements.configModal) elements.configModal.style.display = 'none';
    });

    elements.saveConfigBtn.addEventListener('click', saveConfig); // 保存當前輸入到遊戲狀態
    elements.resetBtn.addEventListener('click', resetGame);

    // 模板操作按鈕 (在配置模態窗口內)
    elements.saveTemplateBtn.addEventListener('click', saveCurrentAsTemplate);
    elements.loadTemplateBtn.addEventListener('click', loadSelectedTemplate);
    elements.deleteTemplateBtn.addEventListener('click', deleteSelectedTemplate);

    // 點擊彈窗外區域關閉配置模態窗口
    window.addEventListener('click', (event) => {
        if (elements.configModal && event.target === elements.configModal) {
            elements.configModal.style.display = 'none';
        }
         // 關閉模板管理器模態窗口
         const managerModal = document.getElementById('templateManagerModal');
         if (managerModal && event.target === managerModal) {
             managerModal.style.display = 'none';
         }
         // 關閉預覽模態窗口
         const previewModal = document.getElementById('templatePreviewModal');
         if (previewModal && event.target === previewModal) {
             previewModal.style.display = 'none';
         }
    });

    // 導航欄控制
    elements.navToggle.addEventListener('click', toggleNavigation);

    // 居中卡片的關閉邏輯已在 showCenteredCard/closeCenteredCard 中處理
}

// 在頁面載入時初始化應用
async function initializeApp() {
    console.log("應用程序初始化開始...");
    try {
        // 1. 設置初始內容 (示例或空)
        setExampleContent(); // 或者 gameState.contents = Array(20).fill('');

        // 2. 初始隨機排列內容位置
        shuffleArray(gameState.contentPositions);

        // 3. 初始化遊戲板
        initializeBoard();

        // 4. 顯示底部操作欄
        const { gameFooter } = getDOMElements();
        if (gameFooter) gameFooter.style.display = 'block'; // Or 'flex'

        // 5. 嘗試預加載模板數據 (錯誤會被 loadTemplates 內部處理)
        console.log("嘗試預加載模板...");
        await loadTemplates(); // This will populate cachedTemplates

        // 6. 設置事件監聽器
        setupEventListeners();

        // 7. 初始化增強的模板管理功能 (會添加按鈕和樣式)
        initTemplateManager(); // <--- 初始化增強功能

        console.log("應用程序初始化完成。");

    } catch (error) {
        console.error('初始化應用時發生嚴重錯誤:', error);
        // 可以在頁面上顯示一個錯誤消息給用戶
        const body = document.querySelector('body');
        if(body) body.innerHTML = `<p style="color: red; padding: 20px;">應用初始化失敗，請刷新頁面或聯繫管理員。錯誤：${error.message}</p>`;
    }
}


// ----- 模板管理增强功能 (Enhancements - Kept as is, relies on the modified core functions) -----

// 1. 创建模板管理界面
function createTemplateManager() {
    const existingManager = document.getElementById('templateManagerModal');
    if (existingManager) document.body.removeChild(existingManager);

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'templateManagerModal';
    modal.style.zIndex = '1000'; // Ensure it's on top

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const closeBtn = document.createElement('span');
    closeBtn.className = 'close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.style.display = 'none';

    const title = document.createElement('h2');
    title.textContent = '模板管理';

    // View Toggle
    const viewToggle = document.createElement('div');
    /* ... view toggle button creation ... */
     viewToggle.style.display = 'flex';
     viewToggle.style.justifyContent = 'center';
     viewToggle.style.marginBottom = '15px';

     const gridViewBtn = document.createElement('button');
     gridViewBtn.textContent = '格狀視圖';
     gridViewBtn.className = 'view-btn active'; // Default view
     gridViewBtn.onclick = () => switchView('grid');


     const listViewBtn = document.createElement('button');
     listViewBtn.textContent = '列表視圖';
     listViewBtn.className = 'view-btn';
     listViewBtn.onclick = () => switchView('list');

     viewToggle.appendChild(gridViewBtn);
     viewToggle.appendChild(listViewBtn);


    // Filter Area
    const filterArea = document.createElement('div');
    /* ... filter input and sort select creation ... */
     filterArea.className = 'filter-area';
     filterArea.style.marginBottom = '15px';
     filterArea.style.display = 'flex';
     filterArea.style.gap = '10px';


     const searchInput = document.createElement('input');
     searchInput.type = 'text';
     searchInput.placeholder = '搜索模板名稱...';
     searchInput.className = 'template-input'; // Reuse existing style
     searchInput.style.flexGrow = '1';
     searchInput.oninput = filterTemplates;


     const sortSelect = document.createElement('select');
     sortSelect.className = 'template-select'; // Reuse existing style
     const sortOptions = [
         { value: 'name-asc', text: '按名稱 (A-Z)' },
         { value: 'name-desc', text: '按名稱 (Z-A)' },
         { value: 'date-desc', text: '按日期 (新到舊)' }, // Default sort?
         { value: 'date-asc', text: '按日期 (舊到新)' }
     ];
     sortOptions.forEach(optData => {
         const option = document.createElement('option');
         option.value = optData.value;
         option.textContent = optData.text;
         sortSelect.appendChild(option);
     });
     sortSelect.value = 'date-desc'; // Set default sort
     sortSelect.onchange = sortTemplates;


     filterArea.appendChild(searchInput);
     filterArea.appendChild(sortSelect);


    // Import/Export/New Area
    const importExportArea = document.createElement('div');
    /* ... import, export, new button creation ... */
     importExportArea.className = 'import-export-area';
     importExportArea.style.display = 'flex';
     importExportArea.style.justifyContent = 'space-between';
     importExportArea.style.marginBottom = '20px';
     importExportArea.style.gap = '10px';


     const importBtn = document.createElement('button');
     importBtn.textContent = '導入模板 (.json)';
     importBtn.className = 'template-action-btn';
     importBtn.onclick = importTemplates;


     const newTemplateBtn = document.createElement('button');
     newTemplateBtn.textContent = '+ 新建空白模板';
     newTemplateBtn.className = 'template-action-btn save-template-btn'; // Use save color
     newTemplateBtn.onclick = createNewTemplate;


     const exportBtn = document.createElement('button');
     exportBtn.textContent = '匯出所有模板';
     exportBtn.className = 'template-action-btn';
     exportBtn.onclick = exportAllTemplates;


     importExportArea.appendChild(importBtn);
     importExportArea.appendChild(newTemplateBtn);
     importExportArea.appendChild(exportBtn);


    // Grid View Container
    const gridView = document.createElement('div');
    gridView.id = 'gridView';
    gridView.className = 'template-grid';
    gridView.style.display = 'grid'; // Default view
    gridView.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))'; // Adjusted minmax
    gridView.style.gap = '15px';
     gridView.style.maxHeight = '55vh'; // Limit height and enable scroll
     gridView.style.overflowY = 'auto';
     gridView.style.padding = '5px'; // Padding for scrollbar


    // List View Container
    const listViewContainer = document.createElement('div');
    listViewContainer.id = 'listViewContainer';
    listViewContainer.style.display = 'none'; // Hidden by default
     listViewContainer.style.maxHeight = '55vh'; // Limit height and enable scroll
     listViewContainer.style.overflowY = 'auto';
     listViewContainer.style.border = '1px solid #eee'; // Add border for clarity


    const listView = document.createElement('table');
    listView.id = 'listView';
    listView.className = 'template-list';
    listView.style.width = '100%';
    listView.style.borderCollapse = 'collapse';

    const thead = document.createElement('thead');
    /* ... table header creation ... */
     const headerRow = document.createElement('tr');
     // Adjusted headers slightly
     const headers = ['★', '模板名稱', '格子數', '更新日期', '操作'];
     headers.forEach(headerText => {
         const th = document.createElement('th');
         th.textContent = headerText;
         th.style.padding = '12px 10px'; // Increase padding
         th.style.textAlign = 'left';
         th.style.borderBottom = '2px solid #ddd'; // Thicker bottom border
         th.style.background = '#f8f9fa'; // Header background
         th.style.position = 'sticky'; // Make header sticky
         th.style.top = '0';
         th.style.zIndex = '1'; // Ensure header is above content
         headerRow.appendChild(th);
     });
     thead.appendChild(headerRow);
     listView.appendChild(thead);


    const tbody = document.createElement('tbody');
    tbody.id = 'listViewBody';
    listView.appendChild(tbody);
    listViewContainer.appendChild(listView); // Append table to its container

    modalContent.appendChild(closeBtn);
    modalContent.appendChild(title);
    modalContent.appendChild(viewToggle);
    modalContent.appendChild(filterArea);
    modalContent.appendChild(importExportArea);
    modalContent.appendChild(gridView);
    modalContent.appendChild(listViewContainer); // Add list view container
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    return modal;
}

// 2. Function to switch between views
function switchView(viewType) {
    const gridView = document.getElementById('gridView');
    const listViewContainer = document.getElementById('listViewContainer'); // Target container now
    const gridBtn = document.querySelector('.view-btn:nth-child(1)'); // Assuming grid is first
    const listBtn = document.querySelector('.view-btn:nth-child(2)'); // Assuming list is second

    if (!gridView || !listViewContainer || !gridBtn || !listBtn) return;

    if (viewType === 'grid') {
        gridView.style.display = 'grid';
        listViewContainer.style.display = 'none';
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    } else if (viewType === 'list') {
        gridView.style.display = 'none';
        listViewContainer.style.display = 'block'; // Use block for the container
        gridBtn.classList.remove('active');
        listBtn.classList.add('active');
    }
}


// 3. Populate Template Views (Adjusted)
// Uses cachedTemplates which is [{id, template_name, content_data, created_at, updated_at}, ...]
function populateTemplateViews(templatesArray) {
    const gridView = document.getElementById('gridView');
    const listViewBody = document.getElementById('listViewBody');

    if (!gridView || !listViewBody) return;

    // Clear existing content
    gridView.innerHTML = '';
    listViewBody.innerHTML = '';

    if (!templatesArray || templatesArray.length === 0) {
        const emptyMsg = '目前沒有保存的模板。點擊 "+ 新建空白模板" 開始創建！';
        gridView.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: #777;">${emptyMsg}</div>`;
        listViewBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #777;">${emptyMsg}</td></tr>`;
        return;
    }

    // Populate views
    templatesArray.forEach(template => {
        // Use template.updated_at or template.created_at for date info
        const displayDate = template.updated_at || template.created_at;
        const card = createTemplateCard(template.id, template.template_name, template.content_data, displayDate);
        gridView.appendChild(card);
        const row = createTemplateListRow(template.id, template.template_name, template.content_data, displayDate);
        listViewBody.appendChild(row);
    });

     // Apply current sort after populating
     sortTemplates();
     // Apply current filter after populating
     filterTemplates();

}


// 4. Create Template Card (Adjusted)
// Takes id, name, content, and date as arguments
function createTemplateCard(templateId, templateName, templateContent, displayDate) {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.dataset.templateId = templateId; // Store ID
    card.dataset.templateName = templateName; // Store Name for filtering/sorting
    card.dataset.creationDate = displayDate; // Store Date for sorting
    card.style.backgroundColor = '#ffffff';
    card.style.borderRadius = '8px';
    card.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
    card.style.overflow = 'hidden';
    card.style.transition = 'transform 0.2s, box-shadow 0.2s';
    card.style.cursor = 'pointer';
    card.style.display = 'flex'; // Use flex for better structure
    card.style.flexDirection = 'column'; // Stack vertically

    // Header
    const cardHeader = document.createElement('div');
     cardHeader.style.padding = '10px 12px'; // Slightly more padding
     cardHeader.style.borderBottom = '1px solid #eee';
     cardHeader.style.display = 'flex';
     cardHeader.style.justifyContent = 'space-between';
     cardHeader.style.alignItems = 'center'; // Align items vertically

    const cardTitle = document.createElement('h3');
    cardTitle.textContent = templateName;
     cardTitle.style.margin = '0';
     cardTitle.style.fontSize = '15px'; // Slightly smaller title
     cardTitle.style.fontWeight = '500'; // Medium weight
     cardTitle.style.overflow = 'hidden';
     cardTitle.style.textOverflow = 'ellipsis';
     cardTitle.style.whiteSpace = 'nowrap';
     cardTitle.title = templateName; // Tooltip for long names


    const favoriteBtn = document.createElement('button');
    // ... favorite button setup (same as before) ...
     favoriteBtn.innerHTML = '★';
     favoriteBtn.style.backgroundColor = 'transparent';
     favoriteBtn.style.border = 'none';
     favoriteBtn.style.fontSize = '18px'; // Larger star
     favoriteBtn.style.cursor = 'pointer';
     favoriteBtn.style.padding = '0';
     favoriteBtn.style.lineHeight = '1'; // Prevent extra spacing
     const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
     favoriteBtn.style.color = favorites.includes(templateName) ? '#FFC107' : '#ccc'; // Use a brighter yellow
     favoriteBtn.onclick = (e) => { e.stopPropagation(); toggleFavoriteTemplate(templateName, templateId); }; // Pass ID too


    cardHeader.appendChild(cardTitle);
    cardHeader.appendChild(favoriteBtn);

    // Content Preview
    const cardContent = document.createElement('div');
    cardContent.style.padding = '12px';
     cardContent.style.fontSize = '13px'; // Base size for preview
     cardContent.style.color = '#555';
     cardContent.style.flexGrow = '1'; // Allow content to take available space
     cardContent.style.minHeight = '60px'; // Ensure minimum height


    // Display first few non-empty items
     const previewItems = Array.isArray(templateContent) ? templateContent.filter(item => item && item.trim() !== '').slice(0, 4) : []; // Get first 4 non-empty
     if (previewItems.length > 0) {
         previewItems.forEach(item => {
             const p = document.createElement('p');
             p.textContent = item;
             p.style.margin = '0 0 4px 0';
             p.style.overflow = 'hidden';
             p.style.textOverflow = 'ellipsis';
             p.style.whiteSpace = 'nowrap';
             p.title = item; // Show full text on hover
             cardContent.appendChild(p);
         });
         if (templateContent.length > 4) {
             const more = document.createElement('p');
             more.textContent = '...';
             more.style.margin = '0';
             more.style.textAlign = 'center';
             cardContent.appendChild(more);
         }
     } else {
         cardContent.textContent = '(無內容預覽)';
         cardContent.style.fontStyle = 'italic';
         cardContent.style.color = '#999';
     }



    // Footer
    const cardFooter = document.createElement('div');
    cardFooter.style.padding = '10px 12px';
     cardFooter.style.borderTop = '1px solid #eee';
     cardFooter.style.display = 'flex';
     cardFooter.style.justifyContent = 'space-between';
     cardFooter.style.alignItems = 'center';
     cardFooter.style.backgroundColor = '#f8f9fa'; // Footer background


    const dateInfo = document.createElement('small');
    dateInfo.textContent = `更新: ${new Date(displayDate).toLocaleDateString()}`;
    dateInfo.style.color = '#777';
     dateInfo.style.fontSize = '11px';


    const actionBtns = document.createElement('div');
    // ... action button creation (load, delete) ...
     const loadBtn = document.createElement('button');
     loadBtn.textContent = '載入';
     loadBtn.className = 'template-action-btn load-template-btn';
     loadBtn.style.padding = '4px 8px'; // Smaller buttons
     loadBtn.style.fontSize = '12px';
     loadBtn.style.marginRight = '5px';


     const deleteBtn = document.createElement('button');
     deleteBtn.textContent = '刪除';
     deleteBtn.className = 'template-action-btn delete-template-btn';
     deleteBtn.style.padding = '4px 8px';
     deleteBtn.style.fontSize = '12px';


     actionBtns.appendChild(loadBtn);
     actionBtns.appendChild(deleteBtn);


    cardFooter.appendChild(dateInfo);
    cardFooter.appendChild(actionBtns);

    card.appendChild(cardHeader);
    card.appendChild(cardContent);
    card.appendChild(cardFooter);

    // Event Handlers
    loadBtn.onclick = (e) => {
        e.stopPropagation();
        loadTemplateContentFromManager(templateId, templateName, templateContent); // Use specific function
    };
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        confirmDeleteTemplate(templateId, templateName); // Pass ID and name
    };
    card.onclick = () => {
        showTemplatePreview(templateId, templateName, templateContent); // Pass ID
    };

     // Hover effect more subtle
     card.onmouseenter = () => card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
     card.onmouseleave = () => card.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';


    return card;
}


// 5. Create Template List Row (Adjusted)
// Takes id, name, content, and date
function createTemplateListRow(templateId, templateName, templateContent, displayDate) {
    const row = document.createElement('tr');
    row.dataset.templateId = templateId; // Store ID
    row.dataset.templateName = templateName; // Store Name for filtering/sorting
    row.dataset.creationDate = displayDate; // Store Date for sorting
    row.style.borderBottom = '1px solid #eee'; // Add border to rows

    // Favorite Cell
    const favCell = document.createElement('td');
     favCell.style.padding = '10px';
     favCell.style.textAlign = 'center'; // Center the star
     const favoriteIcon = document.createElement('span');
     favoriteIcon.innerHTML = '★';
     favoriteIcon.style.cursor = 'pointer';
     favoriteIcon.style.fontSize = '18px';
     const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
     favoriteIcon.style.color = favorites.includes(templateName) ? '#FFC107' : '#ccc';
     favoriteIcon.onclick = () => toggleFavoriteTemplate(templateName, templateId); // Pass ID
     favCell.appendChild(favoriteIcon);


    // Name Cell
    const nameCell = document.createElement('td');
    nameCell.textContent = templateName;
    nameCell.style.padding = '10px';
     nameCell.style.fontWeight = '500'; // Make name slightly bolder


    // Count Cell
    const countCell = document.createElement('td');
    countCell.textContent = Array.isArray(templateContent) ? templateContent.length : '0'; // Default to 0 if not array
    countCell.style.padding = '10px';
     countCell.style.textAlign = 'center'; // Center count


    // Date Cell
    const dateCell = document.createElement('td');
    dateCell.textContent = new Date(displayDate).toLocaleDateString();
    dateCell.style.padding = '10px';
     dateCell.style.fontSize = '13px'; // Smaller date text
     dateCell.style.color = '#666';


    // Action Cell
    const actionCell = document.createElement('td');
    actionCell.style.padding = '10px';
    // ... action button creation (preview, load, delete) ...
     const previewBtn = document.createElement('button');
     previewBtn.textContent = '預覽';
     previewBtn.className = 'template-action-btn'; // General style
     previewBtn.style.padding = '4px 8px';
     previewBtn.style.fontSize = '12px';
     previewBtn.style.marginRight = '5px';
     previewBtn.style.backgroundColor = '#6c757d'; // Grey preview button


     const loadBtn = document.createElement('button');
     loadBtn.textContent = '載入';
     loadBtn.className = 'template-action-btn load-template-btn';
     loadBtn.style.padding = '4px 8px';
     loadBtn.style.fontSize = '12px';
     loadBtn.style.marginRight = '5px';


     const deleteBtn = document.createElement('button');
     deleteBtn.textContent = '刪除';
     deleteBtn.className = 'template-action-btn delete-template-btn';
     deleteBtn.style.padding = '4px 8px';
     deleteBtn.style.fontSize = '12px';


     actionCell.appendChild(previewBtn);
     actionCell.appendChild(loadBtn);
     actionCell.appendChild(deleteBtn);


    // Event Handlers
    previewBtn.onclick = () => showTemplatePreview(templateId, templateName, templateContent); // Pass ID
    loadBtn.onclick = () => loadTemplateContentFromManager(templateId, templateName, templateContent); // Use specific function
    deleteBtn.onclick = () => confirmDeleteTemplate(templateId, templateName); // Pass ID

    row.appendChild(favCell); // Add favorite cell
    row.appendChild(nameCell);
    row.appendChild(countCell);
    row.appendChild(dateCell);
    row.appendChild(actionCell);

    return row;
}

// 6. Show Template Preview (Adjusted)
// Takes id, name, content
function showTemplatePreview(templateId, templateName, templateContent) {
    const existingPreview = document.getElementById('templatePreviewModal');
    if (existingPreview) document.body.removeChild(existingPreview);

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'templatePreviewModal';
    modal.style.zIndex = '1001';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.maxHeight = '90vh'; // Allow more height for preview

    const closeBtn = document.createElement('span');
    closeBtn.className = 'close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.style.display = 'none';

    const title = document.createElement('h2');
    title.textContent = `模板預覽: ${templateName}`;
    title.style.marginBottom = '10px';

    const previewContainer = document.createElement('div');
     previewContainer.style.margin = '15px 0';
     previewContainer.style.maxHeight = '60vh'; // Limit grid height
     previewContainer.style.overflowY = 'auto'; // Scroll if needed
     previewContainer.style.border = '1px solid #eee';
     previewContainer.style.padding = '10px';
     previewContainer.style.borderRadius = '4px';
     previewContainer.style.background = '#f8f9fa';


    const previewGrid = document.createElement('div');
    previewGrid.style.display = 'grid';
    previewGrid.style.gridTemplateColumns = 'repeat(5, 1fr)'; // 5 columns
    previewGrid.style.gap = '8px'; // Smaller gap

    const previewItems = Array.isArray(templateContent) ? templateContent : [];
    previewItems.forEach((content, index) => {
        const itemWrapper = document.createElement('div');
        itemWrapper.style.position = 'relative';
         itemWrapper.style.border = '1px solid #ddd';
         itemWrapper.style.borderRadius = '4px';
         itemWrapper.style.background = '#fff';
         itemWrapper.style.minHeight = '60px'; // Ensure min height
         itemWrapper.style.display = 'flex';
         itemWrapper.style.flexDirection = 'column'; // Stack index and content

         const indexBadge = document.createElement('div');
         indexBadge.textContent = index + 1;
         indexBadge.style.backgroundColor = '#6c757d'; // Use grey for index
         indexBadge.style.color = 'white';
         indexBadge.style.padding = '2px 4px';
         indexBadge.style.fontSize = '10px';
         indexBadge.style.borderTopLeftRadius = '4px';
         indexBadge.style.borderBottomRightRadius = '4px'; // Style corner
         indexBadge.style.position = 'absolute';
         indexBadge.style.top = '0';
         indexBadge.style.left = '0';

         const previewItemContent = document.createElement('div');
         previewItemContent.textContent = content || '(空)';
         previewItemContent.style.padding = '5px';
         previewItemContent.style.textAlign = 'center';
         previewItemContent.style.fontSize = '13px';
         previewItemContent.style.wordBreak = 'break-word'; // Break long words
         previewItemContent.style.flexGrow = '1'; // Allow content to take space
         previewItemContent.style.display = 'flex';
         previewItemContent.style.alignItems = 'center';
         previewItemContent.style.justifyContent = 'center';
         previewItemContent.style.marginTop = '15px'; // Space below index


        itemWrapper.appendChild(indexBadge);
        itemWrapper.appendChild(previewItemContent);
        previewGrid.appendChild(itemWrapper);
    });

    previewContainer.appendChild(previewGrid);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.gap = '15px';
    buttonContainer.style.marginTop = '20px';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = '載入此模板';
    loadBtn.className = 'template-action-btn load-template-btn';
    loadBtn.style.padding = '10px 20px';

    const editBtn = document.createElement('button');
    editBtn.textContent = '編輯此模板';
    editBtn.className = 'template-action-btn'; // Use a neutral color, maybe green?
    editBtn.style.backgroundColor = '#28a745'; // Green for edit
    editBtn.style.padding = '10px 20px';

    buttonContainer.appendChild(loadBtn);
    buttonContainer.appendChild(editBtn);

    // Event Handlers
    loadBtn.onclick = () => {
        loadTemplateContentFromManager(templateId, templateName, templateContent);
        modal.style.display = 'none';
    };
    editBtn.onclick = () => {
        editTemplateContent(templateId, templateName, templateContent); // Pass ID
        modal.style.display = 'none';
    };

    modalContent.appendChild(closeBtn);
    modalContent.appendChild(title);
    modalContent.appendChild(previewContainer);
    modalContent.appendChild(buttonContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    modal.style.display = 'block';
}

// 從管理器中載入模板內容
function loadTemplateContentFromManager(templateId, templateName, templateContent) {
    const { configModal, templateNameInput } = getDOMElements();

    // 確保內容是有效的陣列
    let contents = [];
    if (Array.isArray(templateContent)) {
        contents = templateContent;
    } else if (typeof templateContent === 'string') {
        try {
            // 嘗試解析 JSON 字符串
            contents = JSON.parse(templateContent);
            if (!Array.isArray(contents)) {
                console.warn(`模板 "${templateName}" 的內容解析後不是陣列，將使用空陣列`);
                contents = [];
            }
        } catch (e) {
            console.error(`無法解析模板 "${templateName}" 的內容:`, e);
            contents = [];
        }
    } else {
        console.warn(`模板 "${templateName}" 的內容不是陣列或字符串，將使用空陣列`);
    }

    console.log(`載入模板 "${templateName}" (ID: ${templateId}) 的內容:`, contents);

    // 更新輸入欄位
    loadContentToInputs(contents);

    // 在輸入欄位中設置模板名稱（如果使用者想稍後保存更改）
    if (templateNameInput) {
        templateNameInput.value = templateName;
        templateNameInput.dataset.editMode = 'false'; // 重置編輯模式狀態
        templateNameInput.dataset.originalName = '';
    }

    // 關閉管理器和預覽模態窗口
    const managerModal = document.getElementById('templateManagerModal');
    if (managerModal) managerModal.style.display = 'none';
    const previewModal = document.getElementById('templatePreviewModal');
    if (previewModal) previewModal.style.display = 'none';

    // 打開配置模態窗口進行潛在的編輯/保存
    if (configModal) configModal.style.display = 'block';

    alert(`模板 "${templateName}" 已載入編輯器。請點擊 "保存設置" 將其應用到遊戲。`);
}

// 8. Edit Template Content (Adjusted)
// Loads content and sets up the config modal for editing this template
function editTemplateContent(templateId, templateName, templateContent) {
    const { configModal, templateNameInput } = getDOMElements();

    // Load content into input fields
    loadContentToInputs(Array.isArray(templateContent) ? templateContent : []);

    // Set template name and edit mode flags
    if (templateNameInput) {
        templateNameInput.value = templateName;
        templateNameInput.dataset.editMode = 'true'; // Indicate we are editing
        templateNameInput.dataset.originalId = templateId; // Store the ID we are editing
    }

    // Close other modals
    const managerModal = document.getElementById('templateManagerModal');
    if (managerModal) managerModal.style.display = 'none';
    const previewModal = document.getElementById('templatePreviewModal');
    if (previewModal) previewModal.style.display = 'none';

    // Show config modal
    if (configModal) configModal.style.display = 'block';

    alert(`正在編輯模板 "${templateName}"。修改後請點擊 "保存為模板" 進行更新。`);
}


// 9. Confirm Delete Template (Adjusted)
// Now takes ID and Name
function confirmDeleteTemplate(templateId, templateName) {
    if (!templateId) {
        console.error("無法刪除：缺少模板 ID。");
        return;
    }
    if (confirm(`確定要刪除模板 "${templateName}" (ID: ${templateId}) 嗎？此操作無法復原。`)) {
        deleteTemplateAndUpdateUI(templateId, templateName); // Pass ID and name
    }
}

// 10. Delete Template and Update UI (Adjusted)
// Now takes ID and Name
async function deleteTemplateAndUpdateUI(templateId, templateName) {
     console.log(`請求刪除模板 ID: ${templateId}, Name: ${templateName}`);
    try {
        // Call API to delete
        const response = await fetch(`/api/card-game/templates/${templateId}`, {
            method: 'DELETE'
        });

        if (response.status === 204) { // Success
            alert(`模板 "${templateName}" 已成功刪除！`);
            clearTemplateCache();
            // Update favorites
             const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
             const updatedFavorites = favorites.filter(name => name !== templateName); // Remove by name
             localStorage.setItem('favorite_templates', JSON.stringify(updatedFavorites));

            // Refresh the manager view if it's open
            const managerModal = document.getElementById('templateManagerModal');
            if (managerModal && managerModal.style.display === 'block') {
                cachedTemplates = await loadTemplates(); // Reload data
                populateTemplateViews(cachedTemplates); // Repopulate
            }
             // Also update the dropdown in the config modal if it's open
             await updateTemplateSelect();


        } else if (response.status === 404) {
            alert(`刪除失敗：找不到模板 "${templateName}" (ID: ${templateId})。可能已被刪除。`);
             clearTemplateCache();
             // Refresh views
             const managerModal = document.getElementById('templateManagerModal');
            if (managerModal && managerModal.style.display === 'block') {
                 cachedTemplates = await loadTemplates();
                 populateTemplateViews(cachedTemplates);
             }
              await updateTemplateSelect();
        } else {
             // Other server errors
             let errorMsg = `服務器錯誤 (${response.status})`;
             try {
                 const errorData = await response.json();
                 errorMsg = errorData.error || errorMsg;
             } catch(e) { /* ignore */ }
            alert(`刪除模板 "${templateName}" 失敗: ${errorMsg}`);
        }
    } catch (error) {
        console.error(`刪除模板 ID ${templateId} 時發生網絡錯誤:`, error);
        alert(`刪除模板時發生錯誤: ${error.message}`);
    }
}


// 11. Toggle Favorite Template (Adjusted)
// Takes Name and ID (ID currently unused here, but good practice)
function toggleFavoriteTemplate(templateName, templateId) {
    const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
    const index = favorites.indexOf(templateName);

    if (index === -1) {
        favorites.push(templateName);
         console.log(`模板 "${templateName}" 已加入收藏。`);
    } else {
        favorites.splice(index, 1);
         console.log(`模板 "${templateName}" 已從收藏移除。`);
    }

    localStorage.setItem('favorite_templates', JSON.stringify(favorites));
    updateFavoriteStatus(templateName); // Update UI
}


// 12. Update Favorite Status Display (Adjusted)
// Updates favorite indicators in both views
function updateFavoriteStatus(templateName) {
    const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
    const isFavorite = favorites.includes(templateName);
    const favColor = '#FFC107'; // Brighter yellow
    const defaultColor = '#ccc';

    // Update Grid View Card
    const card = document.querySelector(`.template-card[data-template-name="${templateName}"]`);
    if (card) {
        const favBtn = card.querySelector('button'); // Assumes the fav button is the first/only button in header
        if (favBtn && favBtn.innerHTML === '★') { // Check it's the star button
            favBtn.style.color = isFavorite ? favColor : defaultColor;
        }
    }

    // Update List View Row
    const row = document.querySelector(`#listViewBody tr[data-template-name="${templateName}"]`);
    if (row) {
        const favIcon = row.querySelector('td:first-child span'); // Assumes star is in the first cell's span
        if (favIcon && favIcon.innerHTML === '★') {
            favIcon.style.color = isFavorite ? favColor : defaultColor;
        }
    }
}

// 13. Filter Templates (Adjusted for new data attributes)
function filterTemplates() {
    const searchInput = document.querySelector('#templateManagerModal .filter-area input');
    if (!searchInput) return; // Element might not exist if modal is closed
    const searchTerm = searchInput.value.toLowerCase();

    // Filter Grid View
    const gridCards = document.querySelectorAll('#gridView .template-card');
    gridCards.forEach(card => {
        const templateName = card.dataset.templateName?.toLowerCase() || '';
        card.style.display = templateName.includes(searchTerm) ? 'flex' : 'none'; // Use flex for card display
    });

    // Filter List View
    const listRows = document.querySelectorAll('#listViewBody tr');
    listRows.forEach(row => {
        const templateName = row.dataset.templateName?.toLowerCase() || '';
        row.style.display = templateName.includes(searchTerm) ? '' : 'none'; // Use default display for table rows
    });
}


// 14. Sort Templates (No changes needed)
function sortTemplates() {
    const sortSelect = document.querySelector('#templateManagerModal .filter-area select');
    if (!sortSelect) return;
    const sortType = sortSelect.value;
    const gridView = document.getElementById('gridView');
    const listViewBody = document.getElementById('listViewBody');
    if (!gridView || !listViewBody) return;
    const gridCards = Array.from(gridView.querySelectorAll('.template-card'));
    const listRows = Array.from(listViewBody.querySelectorAll('tr'));
    const sortFunction = (a, b) => {
        const nameA = a.dataset.templateName?.toLowerCase() || '';
        const nameB = b.dataset.templateName?.toLowerCase() || '';
        const dateA = new Date(a.dataset.creationDate || 0);
        const dateB = new Date(b.dataset.creationDate || 0);
        const timeA = isNaN(dateA) ? 0 : dateA.getTime();
        const timeB = isNaN(dateB) ? 0 : dateB.getTime();
        switch (sortType) {
            case 'name-asc': return nameA.localeCompare(nameB);
            case 'name-desc': return nameB.localeCompare(nameA);
            case 'date-desc': return timeB - timeA;
            case 'date-asc': return timeA - timeB;
            default: return 0;
        }
    };
    gridCards.sort(sortFunction).forEach(card => gridView.appendChild(card));
    listRows.sort(sortFunction).forEach(row => listViewBody.appendChild(row));
}

// 15. Import Templates (Final API Version)
async function importTemplates() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');

        reader.onload = async (readerEvent) => {
            let importedData;
            try {
                importedData = JSON.parse(readerEvent.target.result);
                // Basic validation: check if it's an object (or potentially an array of objects)
                if (typeof importedData !== 'object' || importedData === null) {
                    throw new Error('文件內容不是有效的 JSON 對象或陣列。');
                }
            } catch (error) {
                console.error('解析導入文件失敗:', error);
                alert(`導入失敗：文件格式錯誤或無法解析。\n${error.message}`);
                return;
            }

            let templatesToImport = {};
            // Handle both object format {name: content} and array format [{name: name, content: content}]
             if (Array.isArray(importedData)) {
                importedData.forEach(item => {
                    if (item.template_name && item.content_data) {
                        templatesToImport[item.template_name] = item.content_data;
                    } else {
                         console.warn("導入陣列中跳過無效項目:", item);
                    }
                });
            } else {
                 // Assume object format {name: content}
                 templatesToImport = importedData;
             }


            if (Object.keys(templatesToImport).length === 0) {
                alert('導入失敗：文件中未找到有效的模板數據。');
                return;
            }

            let successCount = 0;
            let conflictCount = 0;
            let errorCount = 0;
            const totalToImport = Object.keys(templatesToImport).length;
            const statusMessages = [];

            // Process each template individually
            for (const templateName in templatesToImport) {
                const contentData = templatesToImport[templateName];

                // Basic content validation (ensure it's an array)
                if (!Array.isArray(contentData)) {
                    console.warn(`跳過模板 "${templateName}": content_data 不是陣列。`);
                    statusMessages.push(`❌ ${templateName}: 內容格式錯誤`);
                    errorCount++;
                    continue;
                }

                try {
                    const response = await fetch('/api/card-game/templates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            template_name: templateName,
                            content_data: contentData,
                            is_public: true
                        })
                    });

                    if (response.status === 201) {
                        successCount++;
                        statusMessages.push(`✅ ${templateName}: 導入成功`);
                    } else if (response.status === 409) { // Conflict
                        conflictCount++;
                        statusMessages.push(`⚠️ ${templateName}: 名稱已存在，跳過`);
                        // Optionally, prompt user to overwrite here? More complex.
                    } else {
                        errorCount++;
                        let errMsg = `服務器錯誤 (${response.status})`;
                         try { const errData = await response.json(); errMsg = errData.error || errMsg; } catch(e){}
                        statusMessages.push(`❌ ${templateName}: ${errMsg}`);
                    }
                } catch (networkError) {
                    errorCount++;
                    statusMessages.push(`❌ ${templateName}: 網絡錯誤 (${networkError.message})`);
                    console.error(`導入模板 "${templateName}" 時發生網絡錯誤:`, networkError);
                }
            }

            // Show summary message
            alert(`導入完成 (共 ${totalToImport} 個):\n- 成功: ${successCount}\n- 名稱衝突跳過: ${conflictCount}\n- 錯誤: ${errorCount}\n\n詳細信息:\n${statusMessages.join('\n')}`);

            // Refresh the template list if any succeeded
            if (successCount > 0) {
                clearTemplateCache();
                 const managerModal = document.getElementById('templateManagerModal');
                 if (managerModal && managerModal.style.display === 'block') {
                     cachedTemplates = await loadTemplates(); // Reload data
                     populateTemplateViews(cachedTemplates); // Repopulate
                 }
                  await updateTemplateSelect(); // Update dropdown as well
            }
        };

        reader.onerror = (error) => {
            console.error("讀取文件失敗:", error);
            alert("無法讀取導入文件。");
        };
    };

    input.click(); // Trigger file selection dialog
}

// 16. Export All Templates (Final API Version)
async function exportAllTemplates() {
    // Ensure templates are loaded from API
    if (!cachedTemplates) {
        console.log("緩存為空，正在從 API 加載模板以供匯出...");
        await loadTemplates();
    }

    if (!cachedTemplates || cachedTemplates.length === 0) {
        alert('沒有可導出的模板。');
        return;
    }

    // Prepare data for export (using the structure from the API)
    // We can optionally filter out unnecessary fields if needed, but exporting the full structure is fine.
    const exportData = JSON.stringify(cachedTemplates, null, 2); // Pretty print JSON
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(exportData);

    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const exportFileName = `sunnyyummy_card_templates_${dateStr}.json`;

    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', dataUri);
    downloadLink.setAttribute('download', exportFileName);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    console.log(`${cachedTemplates.length} 個模板已匯出到 ${exportFileName}`);
}


// 17. Create New Template (UI Preparation - No changes needed)
function createNewTemplate() {
    const { configModal, templateNameInput } = getDOMElements();

    // Close template manager if open
    const managerModal = document.getElementById('templateManagerModal');
    if (managerModal) managerModal.style.display = 'none';

    // Clear content inputs in the config modal
    const totalCells = gameState.boardSize.rows * gameState.boardSize.cols;
    for (let i = 0; i < totalCells; i++) {
        const input = document.getElementById(`content-${i}`);
        if (input) input.value = ''; // Clear value
    }

    // Clear template name input and reset edit state
    if (templateNameInput) {
        templateNameInput.value = '';
        templateNameInput.dataset.editMode = 'false';
        templateNameInput.dataset.originalId = '';
    }

    // Show the config modal
    if (configModal) configModal.style.display = 'block';

    // Focus the first content input
    const firstInput = document.getElementById('content-0');
    if (firstInput) firstInput.focus();
}

// 18. Add Template Manager Button (Inside config modal - No changes needed)
function addTemplateManagerButton() {
    const { configModal, templatesBtn } = getDOMElements(); // templatesBtn is the main nav one

    // Modify main nav 'Templates' button to open manager
    if (templatesBtn) {
        // Ensure previous listeners are removed if necessary, or use onclick
        templatesBtn.onclick = () => {
            showTemplateManager();
            closeNavigationIfOpen();
        };
    }

    // Add "All Templates" button inside the config modal
    const templateManagerSection = document.querySelector('#configModal .template-manager');
    if (templateManagerSection && !templateManagerSection.querySelector('.show-manager-btn')) { // Prevent duplicates
        const allTemplatesBtn = document.createElement('button');
        allTemplatesBtn.textContent = '查看所有模板 »';
        allTemplatesBtn.className = 'template-action-btn show-manager-btn'; // Add a class for identification
        allTemplatesBtn.style.marginLeft = 'auto'; // Push to the right if in a flex container
        allTemplatesBtn.style.marginTop = '10px'; // Add some space


        allTemplatesBtn.onclick = () => {
            if (configModal) configModal.style.display = 'none'; // Close config modal first
            showTemplateManager();
        };

        // Append it appropriately, maybe after the save/load/delete row
        const templateControls = templateManagerSection.querySelector('.template-controls'); // Assuming this div exists
        if(templateControls) {
             templateControls.appendChild(allTemplatesBtn);
        } else {
             // Fallback: append directly to the manager section
             templateManagerSection.appendChild(allTemplatesBtn);
        }

    }
}


// 19. Initialize Template Manager Features (No changes needed)
function initTemplateManager() {
    // This primarily sets up buttons and styles now
    addTemplateManagerButton();
    addTemplateManagerStyles();
    // Ensure favorites exist in local storage
    if (!localStorage.getItem('favorite_templates')) {
        localStorage.setItem('favorite_templates', '[]');
    }
}

// 20. Add Template Manager Styles (No changes needed)
function addTemplateManagerStyles() {
    // Check if styles already exist
    if (document.getElementById('template-manager-styles')) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'template-manager-styles'; // Add ID to prevent duplicates
    styleElement.textContent = `
    .view-btn { padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; background-color: #f0f0f0; cursor: pointer; margin: 0 3px; font-size: 13px; }
    .view-btn.active { background-color: #3498db; color: white; border-color: #3498db; }
    .template-card:hover { transform: translateY(-3px); box-shadow: 0 6px 12px rgba(0,0,0,0.1); }
    .template-list th { position: sticky; top: 0; background-color: #f8f9fa; z-index: 1; }
    .template-list td { vertical-align: middle; }
    .template-action-btn { background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; padding: 6px 10px; font-size: 13px; }
    .template-action-btn:hover { background-color: #0056b3; }
    .load-template-btn { background-color: #007bff; } .load-template-btn:hover { background-color: #0056b3; }
    .delete-template-btn { background-color: #dc3545; } .delete-template-btn:hover { background-color: #c82333; }
    .save-template-btn { background-color: #28a745; } .save-template-btn:hover { background-color: #218838; }
    /* Style for the new 'All Templates' button */
    .show-manager-btn { background-color: #6c757d; } .show-manager-btn:hover { background-color: #5a6268; }
    /* Ensure modal content is scrollable */
    #templateManagerModal .modal-content { display: flex; flex-direction: column; max-height: 85vh; }
    #templateManagerModal .template-grid, #templateManagerModal #listViewContainer { flex-grow: 1; overflow-y: auto; /* Make grid/list scrollable */ }
    `;
    document.head.appendChild(styleElement);
}

// 21. Switch View Function (No changes needed)
function switchView(viewType) {
    const gridView = document.getElementById('gridView');
    const listViewContainer = document.getElementById('listViewContainer');
    const gridBtn = document.querySelector('.view-btn:nth-child(1)');
    const listBtn = document.querySelector('.view-btn:nth-child(2)');
    if (!gridView || !listViewContainer || !gridBtn || !listBtn) return;
    if (viewType === 'grid') {
        gridView.style.display = 'grid';
        listViewContainer.style.display = 'none';
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    } else if (viewType === 'list') {
        gridView.style.display = 'none';
        listViewContainer.style.display = 'block';
        gridBtn.classList.remove('active');
        listBtn.classList.add('active');
    }
}

// Remove functions related to local storage template saving/loading if they exist
// e.g., remove loadTemplatesFromLocalStorage, saveTemplatesToLocalStorage if they were defined before.

// Wait for DOM and run initialization
document.addEventListener('DOMContentLoaded', initializeApp);

// --- END OF FILE card-game.js ---