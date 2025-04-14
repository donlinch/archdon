
// 預先加載模板數據
let cachedTemplates = null;

// 遊戲狀態和默認內容
const gameState = {
    boardSize: {rows: 4, cols: 5},
    contents: Array(20).fill('').map((_, i) => `內容 ${i+1}`),
    revealed: Array(20).fill(false),
    contentPositions: Array(20).fill(0).map((_, i) => i), // 內容位置映射
    cardTimerId: null, // 計時器ID追蹤變數
    useServerStorage: true // 是否使用伺服器存儲 (如果伺服器連接失敗則自動回退到本地)
};

// 新增：模板相關常量
const TEMPLATES_STORAGE_KEY = 'sunnyYummy_cardGame_templates';
 
// DOM 元素
const configModal = document.getElementById('configModal');
const configBtn = document.getElementById('configBtn');
const templatesBtn = document.getElementById('templatesBtn');
const closeBtn = document.querySelector('.close');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const resetBtn = document.getElementById('resetBtn');
const inputGrid = document.getElementById('inputGrid');
const centeredCard = document.getElementById('centeredCard');
const cardInner = document.getElementById('cardInner');
const cardCloseBtn = document.querySelector('.card-close');
const navToggle = document.getElementById('navToggle');

// 新增：模板管理相關DOM元素
const templateSelect = document.getElementById('templateSelect');
const templateNameInput = document.getElementById('templateNameInput');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
const loadTemplateBtn = document.getElementById('loadTemplateBtn');
const deleteTemplateBtn = document.getElementById('deleteTemplateBtn');

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
    const board = document.getElementById('gameBoard');
    board.innerHTML = '';
    
    for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
        const hole = document.createElement('div');
        hole.className = 'hole';
        hole.dataset.index = i;
        
        const front = document.createElement('div');
        front.className = 'hole-face hole-front';
        
        const back = document.createElement('div');
        back.className = 'hole-face hole-back';
        // 使用位置映射獲取內容
        const contentIndex = gameState.contentPositions[i];
        back.textContent = gameState.contents[contentIndex];
        
        hole.appendChild(front);
        hole.appendChild(back);
        board.appendChild(hole);
        
        if (gameState.revealed[i]) {
            hole.classList.add('revealed');
        }
        
        hole.addEventListener('click', revealHole);
    }
}

// 初始化輸入框
function initializeInputs() {
    inputGrid.innerHTML = '';
    
    for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        
        const label = document.createElement('label');
        label.textContent = i + 1;
        label.setAttribute('for', `content-${i}`);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `content-${i}`;
        input.value = gameState.contents[i];
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
        // 添加翻轉動畫
        hole.classList.add('revealed');
        
        // 獲取位置映射的內容索引
        const contentIndex = gameState.contentPositions[index];
        
        // 顯示中央卡片
        showCenteredCard(gameState.contents[contentIndex], index);
        
        gameState.revealed[index] = true;
    }
}

// 顯示居中卡片
function showCenteredCard(content, index) {
    // 清除之前的計時器，如果存在的話
    if (gameState.cardTimerId !== null) {
        clearTimeout(gameState.cardTimerId);
        gameState.cardTimerId = null;
    }
    
    cardInner.textContent = content;
    centeredCard.style.display = 'flex';
    
    // 更新關閉按鈕引用並添加事件監聽
    const newCloseBtn = document.querySelector('.card-close');
    newCloseBtn.addEventListener('click', closeCenteredCard);
    
    // 10秒後關閉，並保存計時器ID
    gameState.cardTimerId = setTimeout(() => {
        if (centeredCard.style.display === 'flex') {
            closeCenteredCard();
        }
    }, 10000);
}

// 關閉居中卡片
function closeCenteredCard() {
    // 清除計時器
    if (gameState.cardTimerId !== null) {
        clearTimeout(gameState.cardTimerId);
        gameState.cardTimerId = null;
    }
    
    centeredCard.classList.add('closing');
    setTimeout(() => {
        centeredCard.style.display = 'none';
        centeredCard.classList.remove('closing');
    }, 500);
}

// 保存配置
function saveConfig() {
    for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
        const input = document.getElementById(`content-${i}`);
        gameState.contents[i] = input.value || `內容 ${i+1}`;
    }
    
    // 更新遊戲板上顯示的內容
    updateBoardContent();
    
    configModal.style.display = 'none';
}

// 更新遊戲板內容
function updateBoardContent() {
    const holes = document.querySelectorAll('.hole');
    holes.forEach((hole, i) => {
        const back = hole.querySelector('.hole-back');
        const contentIndex = gameState.contentPositions[i];
        back.textContent = gameState.contents[contentIndex];
    });
}

// 重置遊戲
function resetGame() {
    gameState.revealed = Array(20).fill(false);
    
    // 隨機打亂內容位置
    gameState.contentPositions = Array(20).fill(0).map((_, i) => i);
    shuffleArray(gameState.contentPositions);
    
    initializeBoard();
    
    // 如果導航菜單是打開的，關閉它
    closeNavigationIfOpen();
}

// 設置示例內容
function setExampleContent() {
    const exampleContent = [
        '恭喜獲得100元', '再接再厲', '謝謝參與', '恭喜獲得50元',
        '幸運獎', '謝謝參與', '恭喜獲得20元', '再接再厲',
        '謝謝參與', '恭喜獲得10元', '加油', '謝謝參與',
        '恭喜獲得5元', '不要灰心', '謝謝參與', '恭喜獲得2元',
        '繼續努力', '謝謝參與', '恭喜獲得1元', '期待下次'
    ];
    
    gameState.contents = exampleContent;
}

// 切換導航顯示狀態
function toggleNavigation() {
    const gameHeader = document.getElementById('gameHeader');
    const gameFooter = document.getElementById('gameFooter');
    let navVisible = gameHeader.classList.contains('visible');
    
    navVisible = !navVisible;
    if (navVisible) {
        gameHeader.classList.add('visible');
        gameFooter.style.display = 'block';
        navToggle.textContent = '×';
    } else {
        gameHeader.classList.remove('visible');
        gameFooter.style.display = 'none';
        navToggle.textContent = '≡';
    }
    
    return navVisible;
}

// 檢查並關閉導航菜單（如果它是打開的）
function closeNavigationIfOpen() {
    const gameHeader = document.getElementById('gameHeader');
    if (gameHeader.classList.contains('visible')) {
        navToggle.click();
    }
}

// ----- 模板管理相關函數 -----

// 從 localStorage 加載模板
function loadTemplatesFromLocalStorage() {
    const templatesJson = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (templatesJson) {
        try {
            return JSON.parse(templatesJson);
        } catch (e) {
            console.error('解析本地模板數據時出錯:', e);
            return {};
        }
    }
    return {};
}

// 保存模板到 localStorage
function saveTemplatesToLocalStorage(templates) {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

// 從服務器加載所有模板
async function loadTemplatesFromServer() {
    try {
        const response = await fetch('/api/card-game/templates');
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const templates = await response.json();
        
        // 將服務器格式轉換為本地格式
        const formattedTemplates = {};
        templates.forEach(template => {
            formattedTemplates[template.template_name] = template.content_data;
        });
        
        return formattedTemplates;
    } catch (error) {
        console.warn('從服務器加載模板失敗，回退到本地存儲:', error);
        return loadTemplatesFromLocalStorage();
    }
}

// 統一的加載模板函數
async function loadTemplates() {
    if (gameState.useServerStorage) {
        try {
            return await loadTemplatesFromServer();
        } catch (error) {
            console.warn('服務器連接失敗，回退到本地存儲:', error);
            gameState.useServerStorage = false; // 自動回退到本地模式
            return loadTemplatesFromLocalStorage();
        }
    } else {
        return loadTemplatesFromLocalStorage();
    }
}

// 保存模板到服務器
async function saveTemplateToServer(templateName, contentData) {
    try {
        const response = await fetch('/api/card-game/templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                template_name: templateName,
                content_data: contentData,
                is_public: true // 預設為公開
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `服務器返回錯誤: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.warn('保存模板到服務器失敗:', error);
        return null;
    }
}

// 統一的保存模板函數
async function saveTemplate(templateName, contentData) {
    if (gameState.useServerStorage) {
        try {
            const serverResult = await saveTemplateToServer(templateName, contentData);
            if (!serverResult) {
                throw new Error('服務器保存失敗');
            }
            return true;
        } catch (error) {
            console.warn('服務器保存失敗，回退到本地存儲:', error);
            gameState.useServerStorage = false; // 自動回退到本地模式
            
            // 回退到本地存儲
            const templates = loadTemplatesFromLocalStorage();
            templates[templateName] = contentData;
            saveTemplatesToLocalStorage(templates);
            return true;
        }
    } else {
        const templates = loadTemplatesFromLocalStorage();
        templates[templateName] = contentData;
        saveTemplatesToLocalStorage(templates);
        return true;
    }
}

// 刪除服務器上的模板
async function deleteTemplateFromServer(templateName) {
    try {
        // 首先需要獲取模板ID
        const templates = await loadTemplatesFromServer();
        const templateId = Object.keys(templates).find(id => templates[id].template_name === templateName);
        
        if (!templateId) {
            throw new Error(`找不到模板: ${templateName}`);
        }
        
        const response = await fetch(`/api/card-game/templates/${templateId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok && response.status !== 404) {
            throw new Error(`服務器返回錯誤: ${response.status}`);
        }
        
        return true;
    } catch (error) {
        console.warn('從服務器刪除模板失敗:', error);
        return false;
    }
}

// 統一的刪除模板函數
async function deleteTemplate(templateName) {
    if (gameState.useServerStorage) {
        try {
            const serverResult = await deleteTemplateFromServer(templateName);
            if (!serverResult) {
                throw new Error('服務器刪除失敗');
            }
            return true;
        } catch (error) {
            console.warn('服務器刪除失敗，回退到本地存儲:', error);
            gameState.useServerStorage = false; // 自動回退到本地模式
            
            // 回退到本地存儲
            const templates = loadTemplatesFromLocalStorage();
            if (templates[templateName]) {
                delete templates[templateName];
                saveTemplatesToLocalStorage(templates);
            }
            return true;
        }
    } else {
        const templates = loadTemplatesFromLocalStorage();
        if (templates[templateName]) {
            delete templates[templateName];
            saveTemplatesToLocalStorage(templates);
        }
        return true;
    }
}
// 更新模板下拉選單 - 修正版本
async function updateTemplateSelect() {
    // 清空當前選項
    templateSelect.innerHTML = '<option value="" disabled selected>-- 選擇已保存的模板 --</option>';
    
    try {
        // 獲取保存的模板 (使用緩存或重新加載)
        if (!cachedTemplates) {
            cachedTemplates = await loadTemplates();
        }
        
        // 如果沒有模板，禁用相關按鈕
        if (Object.keys(cachedTemplates).length === 0) {
            loadTemplateBtn.disabled = true;
            deleteTemplateBtn.disabled = true;
            return;
        } else {
            loadTemplateBtn.disabled = false;
            deleteTemplateBtn.disabled = false;
        }
        
        // 添加模板選項
        for (const templateName in cachedTemplates) {
            const option = document.createElement('option');
            option.value = templateName;
            option.textContent = templateName;
            templateSelect.appendChild(option);
        }
    } catch (error) {
        console.error('更新模板選單時出錯:', error);
        // 即使出錯也要啟用按鈕，以便使用者可以嘗試創建新模板
        loadTemplateBtn.disabled = true;
        deleteTemplateBtn.disabled = true;
    }
}

// 當保存新模板或刪除模板時，清除緩存
function clearTemplateCache() {
    cachedTemplates = null;
}

// 保存當前內容為模板 - 修正版本
async function saveCurrentAsTemplate() {
    const templateName = templateNameInput.value.trim();
    
    // 驗證名稱
    if (!templateName) {
        alert('請輸入模板名稱！');
        templateNameInput.focus();
        return;
    }
    
    // 獲取當前輸入框的內容
    const templateContent = [];
    for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
        const input = document.getElementById(`content-${i}`);
        templateContent.push(input.value || `內容 ${i+1}`);
    }
    
    // 確保模板緩存已加載
    if (!cachedTemplates) {
        cachedTemplates = await loadTemplates();
    }
    
    // 詢問是否覆蓋現有模板
    if (cachedTemplates[templateName] && !confirm(`模板 "${templateName}" 已存在，是否覆蓋？`)) {
        return;
    }
    
    // 保存模板
    const success = await saveTemplate(templateName, templateContent);
    
    if (success) {
        // 清除緩存並更新下拉選單
        clearTemplateCache();
        cachedTemplates = await loadTemplates(); // 重新加載緩存
        await updateTemplateSelect();
        
        // 更新選中的模板
        templateSelect.value = templateName;
        
        // 清空輸入框
        templateNameInput.value = '';
        
        // 顯示成功訊息
        alert(`模板 "${templateName}" 已成功保存！`);
    } else {
        alert('保存模板失敗，請稍後再試。');
    }
}

// 從模板載入內容 - 修正版本
async function loadSelectedTemplate() {
    const templateName = templateSelect.value;
    
    if (!templateName) {
        alert('請選擇一個模板！');
        return;
    }
    
    // 確保模板緩存已加載
    if (!cachedTemplates) {
        cachedTemplates = await loadTemplates();
    }
    
    const templateContent = cachedTemplates[templateName];
    
    if (!templateContent) {
        alert(`找不到模板 "${templateName}"！`);
        clearTemplateCache(); // 緩存可能已過期
        await updateTemplateSelect(); // 重新載入模板列表
        return;
    }
    
    // 更新輸入框
    for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
        const input = document.getElementById(`content-${i}`);
        input.value = templateContent[i] || `內容 ${i+1}`;
    }
    
    alert(`已成功載入模板 "${templateName}"！`);
}

// 刪除選中的模板 - 修正版本
async function deleteSelectedTemplate() {
    const templateName = templateSelect.value;
    
    if (!templateName) {
        alert('請選擇一個要刪除的模板！');
        return;
    }
    
    if (!confirm(`確定要刪除模板 "${templateName}" 嗎？此操作無法復原。`)) {
        return;
    }
    
    const success = await deleteTemplate(templateName);
    
    if (success) {
        // 清除緩存並更新下拉選單
        clearTemplateCache();
        await updateTemplateSelect();
        alert(`模板 "${templateName}" 已刪除！`);
    } else {
        alert(`刪除模板 "${templateName}" 失敗，請稍後再試。`);
    }
}

// 在頁面載入時預先加載模板
window.addEventListener('DOMContentLoaded', async () => {
    setExampleContent();
    // 初始隨機排列內容
    shuffleArray(gameState.contentPositions);
    initializeBoard();
    
    // 預先加載模板 (在背景進行，不阻塞頁面載入)
    try {
        cachedTemplates = await loadTemplates();
    } catch (error) {
        console.warn('預載模板失敗:', error);
    }
    
    // 檢查是否支持服務器連接
    fetch('/api/card-game/templates')
        .then(response => {
            if (!response.ok) {
                console.warn('服務器模板API不可用，使用本地存儲。');
                gameState.useServerStorage = false;
            } else {
                console.log('服務器模板API可用。');
            }
        })
        .catch(error => {
            console.warn('服務器模板API連接錯誤，使用本地存儲:', error);
            gameState.useServerStorage = false;
        });
    
    // 新增：點擊整個卡片區域關閉
    centeredCard.addEventListener('click', (e) => {
        // 點擊卡片任何位置都會關閉
        closeCenteredCard();
    });
    
    // 防止點擊卡片內容區域時事件冒泡到外層
    document.querySelector('.centered-card-content').addEventListener('click', (e) => {
        // 如果想讓點擊任何位置都關閉，請移除這個事件監聽器或註釋掉 stopPropagation
    });
});
// ----- 事件監聽 -----



// 自定義內容按鈕點擊事件
configBtn.addEventListener('click', () => {
    // 首先打開配置模態窗口
    initializeInputs();
    updateTemplateSelect(); // 更新模板下拉選單
    configModal.style.display = 'block';
    
    // 如果導航菜單是打開的，關閉它
    closeNavigationIfOpen();
});

// 模板按鈕點擊事件
templatesBtn.addEventListener('click', () => {
    // 直接打開配置模態窗口，專注於模板部分
    initializeInputs();
    updateTemplateSelect();
    configModal.style.display = 'block';
    
    // 聚焦到模板選擇下拉選單
    setTimeout(() => {
        templateSelect.focus();
    }, 300);
    
    // 如果導航菜單是打開的，關閉它
    closeNavigationIfOpen();
});

// 關閉按鈕點擊事件
closeBtn.addEventListener('click', () => {
    configModal.style.display = 'none';
});

// 保存設置按鈕點擊事件
saveConfigBtn.addEventListener('click', saveConfig);

// 重置按鈕點擊事件
resetBtn.addEventListener('click', resetGame);

// 新增：模板相關事件監聽
saveTemplateBtn.addEventListener('click', saveCurrentAsTemplate);
loadTemplateBtn.addEventListener('click', loadSelectedTemplate);
deleteTemplateBtn.addEventListener('click', deleteSelectedTemplate);

// 點擊彈窗外區域關閉彈窗
window.addEventListener('click', (event) => {
    if (event.target === configModal) {
        configModal.style.display = 'none';
    }
});

// 导航栏控制
navToggle.addEventListener('click', toggleNavigation);