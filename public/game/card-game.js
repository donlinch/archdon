// 預先加載模板數據
let cachedTemplates = null;

// 遊戲狀態和默認內容
const gameState = {
    boardSize: {rows: 4, cols: 5},
    contents: Array(20).fill('').map((_, i) => `內容 ${i+1}`),
    revealed: Array(20).fill(false),
    contentPositions: Array(20).fill(0).map((_, i) => i), // 內容位置映射
    cardTimerId: null, // 計時器ID追蹤變數
    useServerStorage: true // 如果伺服器連接失敗則自動回退到本地
};

// 新增：模板相關常量
const TEMPLATES_STORAGE_KEY = 'sunnyYummy_cardGame_templates';
 
// DOM 元素引用獲取函數 - 避免在DOM加載前嘗試獲取元素
function getDOMElements() {
    return {
        configModal: document.getElementById('configModal'),
        configBtn: document.getElementById('configBtn'),
        templatesBtn: document.getElementById('templatesBtn'),
        closeBtn: document.querySelector('.close'),
        saveConfigBtn: document.getElementById('saveConfigBtn'),
        resetBtn: document.getElementById('resetBtn'),
        inputGrid: document.getElementById('inputGrid'),
        centeredCard: document.getElementById('centeredCard'),
        cardInner: document.getElementById('cardInner'),
        cardCloseBtn: document.querySelector('.card-close'),
        navToggle: document.getElementById('navToggle'),
        templateSelect: document.getElementById('templateSelect'),
        templateNameInput: document.getElementById('templateNameInput'),
        saveTemplateBtn: document.getElementById('saveTemplateBtn'),
        loadTemplateBtn: document.getElementById('loadTemplateBtn'),
        deleteTemplateBtn: document.getElementById('deleteTemplateBtn'),
        gameHeader: document.getElementById('gameHeader'),
        gameFooter: document.getElementById('gameFooter'),
        gameBoard: document.getElementById('gameBoard')
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
    gameBoard.innerHTML = '';
    
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
        gameBoard.appendChild(hole);
        
        if (gameState.revealed[i]) {
            hole.classList.add('revealed');
        }
        
        hole.addEventListener('click', revealHole);
    }
}

// 初始化輸入框
function initializeInputs() {
    const { inputGrid } = getDOMElements();
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
    const { centeredCard, cardInner } = getDOMElements();
    
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
    const { centeredCard } = getDOMElements();
    
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
    const { configModal } = getDOMElements();
    
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
    const { gameHeader, gameFooter, navToggle } = getDOMElements();
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
    const { gameHeader, navToggle } = getDOMElements();
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

// 更新模板下拉選單
async function updateTemplateSelect() {
    const { templateSelect, loadTemplateBtn, deleteTemplateBtn } = getDOMElements();
    
    // 清空当前选项
    templateSelect.innerHTML = '<option value="" disabled selected>-- 選擇已保存的模板 --</option>';
    
    try {
        // 强制重新加载模板，不使用缓存
        cachedTemplates = null; // 重要：强制清除缓存
        cachedTemplates = await loadTemplates();
        
        // 如果没有模板，禁用相关按钮
        if (Object.keys(cachedTemplates).length === 0) {
            loadTemplateBtn.disabled = true;
            deleteTemplateBtn.disabled = true;
            return;
        } else {
            loadTemplateBtn.disabled = false;
            deleteTemplateBtn.disabled = false;
        }
        
        // 添加模板选项
        for (const templateName in cachedTemplates) {
            const option = document.createElement('option');
            option.value = templateName;
            option.textContent = templateName;
            templateSelect.appendChild(option);
        }
    } catch (error) {
        console.error('更新模板選單時出錯:', error);
        loadTemplateBtn.disabled = true;
        deleteTemplateBtn.disabled = true;
    }
}

// 當保存新模板或刪除模板時，清除緩存
function clearTemplateCache() {
    cachedTemplates = null;
}

// 保存當前內容為模板
async function saveCurrentAsTemplate() {
    const { templateNameInput, templateSelect } = getDOMElements();
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
        cachedTemplates = await loadTemplates();
        await updateTemplateSelect();
        
        // 更新選中的模板
        templateSelect.value = templateName;
        
        // 清空輸入框
        templateNameInput.value = '';
        
        alert(`模板 "${templateName}" 已成功保存！`);
    } else {
        alert('保存模板失敗，請稍後再試。');
    }
}

// 從模板載入內容
async function loadSelectedTemplate() {
    const { templateSelect } = getDOMElements();
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
        clearTemplateCache();
        await updateTemplateSelect();
        return;
    }
    
    // 更新輸入框
    for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
        const input = document.getElementById(`content-${i}`);
        input.value = templateContent[i] || `內容 ${i+1}`;
    }
    
    alert(`已成功載入模板 "${templateName}"！`);
}

// 刪除選中的模板
async function deleteSelectedTemplate() {
    const { templateSelect } = getDOMElements();
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
        clearTemplateCache();
        await updateTemplateSelect();
        alert(`模板 "${templateName}" 已刪除！`);
    } else {
        alert(`刪除模板 "${templateName}" 失敗，請稍後再試。`);
    }
}

// 設置事件監聽器
function setupEventListeners() {
    const {
        configBtn, templatesBtn, closeBtn, saveConfigBtn, resetBtn,
        saveTemplateBtn, loadTemplateBtn, deleteTemplateBtn,
        configModal, centeredCard, navToggle
    } = getDOMElements();
    
    // 自定義內容按鈕點擊事件
    configBtn.addEventListener('click', () => {
        initializeInputs();
        updateTemplateSelect();
        configModal.style.display = 'block';
        closeNavigationIfOpen();
    });
    
    // 模板按鈕點擊事件
    templatesBtn.addEventListener('click', () => {
        showTemplateManager();
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
    
    // 模板相關事件監聽
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
    
    // 點擊卡片區域關閉
    centeredCard.addEventListener('click', closeCenteredCard);
    
    // 防止點擊卡片內容區域時事件冒泡
    document.querySelector('.centered-card-content').addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// 在頁面載入時初始化應用
async function initializeApp() {
    try {
        // 設置示例內容
        setExampleContent();
        
        // 初始隨機排列內容
        shuffleArray(gameState.contentPositions);
        
        // 初始化遊戲板
        initializeBoard();
        
        // 顯示底部導航欄
        const { gameFooter } = getDOMElements();
        gameFooter.style.display = 'block';
        
        // 嘗試預先加載模板
        try {
            cachedTemplates = await loadTemplates();
            console.log('已載入模板數:', Object.keys(cachedTemplates).length);
        } catch (error) {
            console.warn('預載模板失敗:', error);
            cachedTemplates = {};
        }
        
        // 檢查是否支持服務器連接
        try {
            const response = await fetch('/api/card-game/templates');
            if (!response.ok) {
                console.warn('服務器模板API不可用，使用本地存儲。');
                gameState.useServerStorage = false;
            } else {
                console.log('服務器模板API可用。');
            }
        } catch (error) {
            console.warn('服務器模板API連接錯誤，使用本地存儲:', error);
            gameState.useServerStorage = false;
        }
        
        // 設置事件監聽器
        setupEventListeners();
        initTemplateManager();
    } catch (error) {
        console.error('初始化應用時出錯:', error);
    }
}

// 等待DOM完全加載後初始化應用
document.addEventListener('DOMContentLoaded', initializeApp);











// 模板管理增强功能

// 1. 创建模板管理界面
function createTemplateManager() {
    // 如果已存在，先删除
    const existingManager = document.getElementById('templateManagerModal');
    if (existingManager) {
      document.body.removeChild(existingManager);
    }
  
  // 13. 筛选模板
  function filterTemplates() {
    const searchInput = document.querySelector('.filter-area input');
    const searchTerm = searchInput.value.toLowerCase();
    
    // 筛选网格视图
    const gridCards = document.querySelectorAll('.template-card');
    gridCards.forEach(card => {
      const templateName = card.dataset.templateName.toLowerCase();
      if (templateName.includes(searchTerm)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
    
    // 筛选列表视图
    const listRows = document.querySelectorAll('#listViewBody tr');
    listRows.forEach(row => {
      const templateName = row.dataset.templateName.toLowerCase();
      if (templateName.includes(searchTerm)) {
        row.style.display = 'table-row';
      } else {
        row.style.display = 'none';
      }
    });
  }
  
  // 14. 排序模板
  function sortTemplates() {
    const sortSelect = document.querySelector('.filter-area select');
    const sortType = sortSelect.value;
    
    // 获取所有模板元素
    const gridCards = Array.from(document.querySelectorAll('.template-card'));
    const listRows = Array.from(document.querySelectorAll('#listViewBody tr'));
    
    // 定义排序函数
    const sortFunction = (a, b) => {
      const nameA = a.dataset.templateName;
      const nameB = b.dataset.templateName;
      const dateA = new Date(a.dataset.creationDate);
      const dateB = new Date(b.dataset.creationDate);
      
      switch (sortType) {
        case 'name-asc':
          return nameA.localeCompare(nameB);
        case 'name-desc':
          return nameB.localeCompare(nameA);
        case 'date':
          return dateB - dateA; // 最新在前
        default:
          return 0;
      }
    };
    
    // 排序并重新添加到父元素
    const gridView = document.getElementById('gridView');
    gridCards.sort(sortFunction).forEach(card => {
      gridView.appendChild(card);
    });
    
    const listViewBody = document.getElementById('listViewBody');
    listRows.sort(sortFunction).forEach(row => {
      listViewBody.appendChild(row);
    });
  }
  
  // 15. 导入模板
  function importTemplates() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.readAsText(file, 'UTF-8');
      
      reader.onload = async (readerEvent) => {
        try {
          const importedTemplates = JSON.parse(readerEvent.target.result);
          
          // 验证导入的模板格式
          if (typeof importedTemplates !== 'object') {
            throw new Error('导入的文件格式不正确');
          }
          
          // 获取现有模板
          let existingTemplates = await loadTemplates();
          let importCount = 0;
          let skipCount = 0;
          
          // 记录模板创建日期
          const templateDates = JSON.parse(localStorage.getItem('template_dates') || '{}');
          const now = new Date().toISOString();
          
          // 处理每个导入的模板
          for (const templateName in importedTemplates) {
            if (existingTemplates[templateName] && !confirm(`模板 "${templateName}" 已存在，是否覆盖？`)) {
              skipCount++;
              continue;
            }
            
            existingTemplates[templateName] = importedTemplates[templateName];
            templateDates[templateName] = now;
            importCount++;
          }
          
          // 保存更新后的模板
          if (gameState.useServerStorage) {
            // 如果使用服务器存储，逐个保存模板
            for (const templateName in importedTemplates) {
              if (existingTemplates[templateName] === importedTemplates[templateName]) {
                await saveTemplate(templateName, importedTemplates[templateName]);
              }
            }
          } else {
            // 本地存储：一次性保存所有模板
            saveTemplatesToLocalStorage(existingTemplates);
          }
          
          // 保存模板日期
          localStorage.setItem('template_dates', JSON.stringify(templateDates));
          
          // 更新界面
          clearTemplateCache();
          cachedTemplates = await loadTemplates();
          populateTemplateViews(cachedTemplates);
          
          alert(`导入完成！\n成功导入: ${importCount} 个模板\n跳过: ${skipCount} 个模板`);
        } catch (error) {
          console.error('导入模板失败:', error);
          alert(`导入失败: ${error.message}`);
        }
      };
    };
    
    input.click();
  }
  
  // 16. 导出所有模板
  function exportAllTemplates() {
    if (!cachedTemplates || Object.keys(cachedTemplates).length === 0) {
      alert('没有可导出的模板');
      return;
    }
    
    // 创建导出数据
    const exportData = JSON.stringify(cachedTemplates, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(exportData);
    
    // 设置导出文件名
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const exportFileName = `sunnyyummy_templates_${dateStr}.json`;
    
    // 创建下载链接
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', dataUri);
    downloadLink.setAttribute('download', exportFileName);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    
    // 触发下载
    downloadLink.click();
    
    // 移除下载链接
    document.body.removeChild(downloadLink);
  }
  
  // 17. 创建新模板
  function createNewTemplate() {
    const { configModal } = getDOMElements();
    
    // 关闭模板管理界面
    const templateManagerModal = document.getElementById('templateManagerModal');
    if (templateManagerModal) {
      templateManagerModal.style.display = 'none';
    }
    
    // 清空所有输入框
    for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
      const input = document.getElementById(`content-${i}`);
      if (input) {
        input.value = '';
      }
    }
    
    // 清空模板名称输入框
    const { templateNameInput } = getDOMElements();
    templateNameInput.value = '';
    templateNameInput.dataset.editMode = 'false';
    templateNameInput.dataset.originalName = '';
    
    // 显示配置模态窗口
    configModal.style.display = 'block';
    
    // 聚焦到第一个输入框
    const firstInput = document.getElementById('content-0');
    if (firstInput) {
      firstInput.focus();
    }
  }
  
  // 18. 添加查看模板管理界面的按钮
  function addTemplateManagerButton() {
    const { configModal, templatesBtn } = getDOMElements();
    
    // 修改原有的模板按钮行为
    templatesBtn.removeEventListener('click', initializeInputs);
    templatesBtn.onclick = () => {
      showTemplateManager();
      closeNavigationIfOpen();
    };
    
    // 添加模板管理按钮到配置模态窗口
    const templateManagerBtn = document.createElement('button');
    templateManagerBtn.textContent = '所有模板';
    templateManagerBtn.className = 'template-action-btn';
    templateManagerBtn.style.marginLeft = '15px';
    
    templateManagerBtn.onclick = () => {
      configModal.style.display = 'none';
      showTemplateManager();
    };
    
    // 插入按钮到模板管理区域
    const templateRow = document.querySelector('.template-row');
    if (templateRow) {
      templateRow.appendChild(templateManagerBtn);
    }
  }
  
  // 19. 初始化模板管理功能
  function initTemplateManager() {
    // 确保模板日期记录存在
    if (!localStorage.getItem('template_dates')) {
      localStorage.setItem('template_dates', '{}');
    }
    
    // 添加模板管理按钮
    addTemplateManagerButton();
    
    // 添加模板管理样式
    addTemplateManagerStyles();
  }
  
  // 20. 添加模板管理所需的样式
  function addTemplateManagerStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .view-btn {
        padding: 8px 15px;
        border: none;
        border-radius: 4px;
        background-color: #f0f0f0;
        cursor: pointer;
        margin: 0 5px;
      }
      
      .view-btn.active {
        background-color: #3498db;
        color: white;
      }
      
      .template-card {
        transition: all 0.3s ease;
      }
      
      .template-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 15px rgba(0,0,0,0.1);
      }
      
      .template-list th {
        position: sticky;
        top: 0;
        background-color: #f5f7fa;
        z-index: 10;
      }
      
      /* 确保按钮样式统一 */
      .template-action-btn {
        background-color: #3498db;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s;
      }
      
      .template-action-btn:hover {
        background-color: #2980b9;
      }
      
      .template-action-btn.load-template-btn {
        background-color: #3498db;
      }
      
      .template-action-btn.delete-template-btn {
        background-color: #e74c3c;
      }
      
      .template-action-btn.delete-template-btn:hover {
        background-color: #c0392b;
      }
      
      .template-action-btn.save-template-btn {
        background-color: #2ecc71;
      }
      
      .template-action-btn.save-template-btn:hover {
        background-color: #27ae60;
      }
    `;
    
    document.head.appendChild(styleElement);
  }
  
  // 21. 注册到现有系统
  function registerTemplateManager() {
    // 在页面加载完成后初始化
    document.addEventListener('DOMContentLoaded', function() {
      // 在原有初始化之后添加模板管理功能
      const originalInitApp = initializeApp;
      initializeApp = async function() {
        await originalInitApp.call(this);
        initTemplateManager();
      };
    });
  }
    
    // 创建模态窗口
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'templateManagerModal';
    
    // 创建模态内容
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // 添加关闭按钮
    const closeBtn = document.createElement('span');
    closeBtn.className = 'close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.style.display = 'none';
    
    // 创建标题
    const title = document.createElement('h2');
    title.textContent = '模板管理';
    
    // 创建视图切换按钮
    const viewToggle = document.createElement('div');
    viewToggle.className = 'view-toggle';
    viewToggle.style.display = 'flex';
    viewToggle.style.justifyContent = 'center';
    viewToggle.style.margin = '15px 0';
    
    const gridViewBtn = document.createElement('button');
    gridViewBtn.textContent = '格狀視圖';
    gridViewBtn.className = 'view-btn active';
    gridViewBtn.onclick = () => {
      gridViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
      document.getElementById('gridView').style.display = 'grid';
      document.getElementById('listView').style.display = 'none';
    };
    
    const listViewBtn = document.createElement('button');
    listViewBtn.textContent = '列表視圖';
    listViewBtn.className = 'view-btn';
    listViewBtn.onclick = () => {
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
      document.getElementById('gridView').style.display = 'none';
      document.getElementById('listView').style.display = 'table';
    };
    
    viewToggle.appendChild(gridViewBtn);
    viewToggle.appendChild(listViewBtn);
    
    // 添加搜索和筛选区域
    const filterArea = document.createElement('div');
    filterArea.className = 'filter-area';
    filterArea.style.margin = '15px 0';
    filterArea.style.display = 'flex';
    filterArea.style.gap = '10px';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '搜索模板...';
    searchInput.className = 'template-input';
    searchInput.style.flexGrow = '1';
    searchInput.oninput = filterTemplates;
    
    const sortSelect = document.createElement('select');
    sortSelect.className = 'template-select';
    
    const sortOptions = [
      { value: 'name-asc', text: '按名稱 (A-Z)' },
      { value: 'name-desc', text: '按名稱 (Z-A)' },
      { value: 'date', text: '按建立日期' }
    ];
    
    sortOptions.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.text;
      sortSelect.appendChild(opt);
    });
    
    sortSelect.onchange = sortTemplates;
    
    filterArea.appendChild(searchInput);
    filterArea.appendChild(sortSelect);
    
    // 创建导入/导出按钮区域
    const importExportArea = document.createElement('div');
    importExportArea.className = 'import-export-area';
    importExportArea.style.display = 'flex';
    importExportArea.style.justifyContent = 'space-between';
    importExportArea.style.margin = '15px 0';
    
    const importBtn = document.createElement('button');
    importBtn.textContent = '導入模板';
    importBtn.className = 'template-action-btn';
    importBtn.onclick = importTemplates;
    
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '匯出所有模板';
    exportBtn.className = 'template-action-btn';
    exportBtn.onclick = exportAllTemplates;
    
    const newTemplateBtn = document.createElement('button');
    newTemplateBtn.textContent = '新建空白模板';
    newTemplateBtn.className = 'template-action-btn save-template-btn';
    newTemplateBtn.onclick = createNewTemplate;
    
    importExportArea.appendChild(importBtn);
    importExportArea.appendChild(newTemplateBtn);
    importExportArea.appendChild(exportBtn);
    
    // 创建网格视图容器
    const gridView = document.createElement('div');
    gridView.id = 'gridView';
    gridView.className = 'template-grid';
    gridView.style.display = 'grid';
    gridView.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    gridView.style.gap = '15px';
    
    // 创建列表视图容器
    const listView = document.createElement('table');
    listView.id = 'listView';
    listView.className = 'template-list';
    listView.style.width = '100%';
    listView.style.borderCollapse = 'collapse';
    listView.style.display = 'none';
    
    // 创建表头
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = ['模板名稱', '格子數量', '建立日期', '操作'];
    
    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      th.style.padding = '10px';
      th.style.textAlign = 'left';
      th.style.borderBottom = '1px solid #ddd';
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    listView.appendChild(thead);
    
    // 创建表格主体
    const tbody = document.createElement('tbody');
    tbody.id = 'listViewBody';
    listView.appendChild(tbody);
    
    // 添加所有元素到DOM
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(title);
    modalContent.appendChild(viewToggle);
    modalContent.appendChild(filterArea);
    modalContent.appendChild(importExportArea);
    modalContent.appendChild(gridView);
    modalContent.appendChild(listView);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    return modal;
  }
  
  // 2. 加载并显示所有模板
  // 显示模板管理界面
  async function showTemplateManager() {
    // 创建模板管理界面
    const modal = createTemplateManager();
    
    // 显示加载中提示
    const gridView = document.getElementById('gridView');
    const loadingDiv = document.createElement('div');
    loadingDiv.textContent = '載入模板中...';
    loadingDiv.style.gridColumn = '1 / -1';
    loadingDiv.style.textAlign = 'center';
    loadingDiv.style.padding = '20px';
    gridView.appendChild(loadingDiv);
    
    try {
      // 清除缓存并重新加载模板
      clearTemplateCache();
      cachedTemplates = await loadTemplates();
      
      // 移除加载提示
      gridView.removeChild(loadingDiv);
      
      // 填充模板视图
      populateTemplateViews(cachedTemplates);
      
      // 显示模态窗口
      modal.style.display = 'block';
    } catch (error) {
      console.error('加载模板失败:', error);
      gridView.removeChild(loadingDiv);
      
      const errorDiv = document.createElement('div');
      errorDiv.textContent = '載入模板失敗，請稍後再試';
      errorDiv.style.gridColumn = '1 / -1';
      errorDiv.style.textAlign = 'center';
      errorDiv.style.color = 'red';
      errorDiv.style.padding = '20px';
      gridView.appendChild(errorDiv);
      
      modal.style.display = 'block';
    }
  }
  
  // 3. 填充模板视图
  function populateTemplateViews(templates) {
    const gridView = document.getElementById('gridView');
    const listViewBody = document.getElementById('listViewBody');
    
    // 清空现有内容
    gridView.innerHTML = '';
    listViewBody.innerHTML = '';
    
    // 检查是否有模板
    if (Object.keys(templates).length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.textContent = '目前沒有保存的模板';
      emptyDiv.style.gridColumn = '1 / -1';
      emptyDiv.style.textAlign = 'center';
      emptyDiv.style.padding = '20px';
      gridView.appendChild(emptyDiv);
      return;
    }
    
    // 获取模板创建日期（如果有）
    const templateDates = JSON.parse(localStorage.getItem('template_dates') || '{}');
    
    // 遍历所有模板
    for (const templateName in templates) {
      const templateContent = templates[templateName];
      const creationDate = templateDates[templateName] || new Date().toISOString();
      
      // 创建网格视图卡片
      const card = createTemplateCard(templateName, templateContent, creationDate);
      gridView.appendChild(card);
      
      // 创建列表视图行
      const row = createTemplateListRow(templateName, templateContent, creationDate);
      listViewBody.appendChild(row);
    }
  }
  
  // 4. 创建模板卡片
  function createTemplateCard(templateName, templateContent, creationDate) {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.dataset.templateName = templateName;
    card.dataset.creationDate = creationDate;
    
    card.style.backgroundColor = '#ffffff';
    card.style.borderRadius = '8px';
    card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    card.style.overflow = 'hidden';
    card.style.transition = 'transform 0.3s, box-shadow 0.3s';
    card.style.cursor = 'pointer';
    
    card.onmouseover = () => {
      card.style.transform = 'translateY(-5px)';
      card.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    };
    
    card.onmouseout = () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    };
    
    // 卡片顶部栏
    const cardHeader = document.createElement('div');
    cardHeader.style.backgroundColor = '#f5f5f5';
    cardHeader.style.padding = '10px';
    cardHeader.style.borderBottom = '1px solid #eee';
    cardHeader.style.display = 'flex';
    cardHeader.style.justifyContent = 'space-between';
    
    const cardTitle = document.createElement('h3');
    cardTitle.className = 'template-card-title';
    cardTitle.textContent = templateName;
    cardTitle.style.margin = '0';
    cardTitle.style.fontSize = '16px';
    cardTitle.style.overflow = 'hidden';
    cardTitle.style.textOverflow = 'ellipsis';
    cardTitle.style.whiteSpace = 'nowrap';
    
    const favoriteBtn = document.createElement('button');
    favoriteBtn.innerHTML = '★';
    favoriteBtn.style.backgroundColor = 'transparent';
    favoriteBtn.style.border = 'none';
    favoriteBtn.style.fontSize = '16px';
    favoriteBtn.style.cursor = 'pointer';
    favoriteBtn.style.color = '#ccc';
    
    // 检查是否为收藏
    const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
    if (favorites.includes(templateName)) {
      favoriteBtn.style.color = '#FFB74D';
    }
    
    favoriteBtn.onclick = (e) => {
      e.stopPropagation();
      toggleFavoriteTemplate(templateName);
    };
    
    cardHeader.appendChild(cardTitle);
    cardHeader.appendChild(favoriteBtn);
    
    // 卡片内容预览
    const cardContent = document.createElement('div');
    cardContent.style.padding = '10px';
    
    // 创建网格预览
    const previewGrid = document.createElement('div');
    previewGrid.style.display = 'grid';
    previewGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    previewGrid.style.gap = '5px';
    
    // 显示前6个内容项
    const previewItems = Array.isArray(templateContent) ? templateContent : [];
    for (let i = 0; i < Math.min(6, previewItems.length); i++) {
      const previewItem = document.createElement('div');
      previewItem.textContent = previewItems[i] || '';
      previewItem.style.backgroundColor = '#f9f9f9';
      previewItem.style.padding = '5px';
      previewItem.style.borderRadius = '4px';
      previewItem.style.fontSize = '12px';
      previewItem.style.overflow = 'hidden';
      previewItem.style.textOverflow = 'ellipsis';
      previewItem.style.whiteSpace = 'nowrap';
      previewGrid.appendChild(previewItem);
    }
    
    cardContent.appendChild(previewGrid);
    
    if (previewItems.length > 6) {
      const moreItems = document.createElement('div');
      moreItems.textContent = `...還有 ${previewItems.length - 6} 個項目`;
      moreItems.style.textAlign = 'center';
      moreItems.style.fontSize = '12px';
      moreItems.style.color = '#888';
      moreItems.style.marginTop = '5px';
      cardContent.appendChild(moreItems);
    }
    
    // 卡片底部按钮
    const cardFooter = document.createElement('div');
    cardFooter.style.padding = '10px';
    cardFooter.style.borderTop = '1px solid #eee';
    cardFooter.style.display = 'flex';
    cardFooter.style.justifyContent = 'space-between';
    
    const dateInfo = document.createElement('small');
    dateInfo.textContent = new Date(creationDate).toLocaleDateString();
    dateInfo.style.color = '#999';
    
    const actionBtns = document.createElement('div');
    
    const loadBtn = document.createElement('button');
    loadBtn.textContent = '載入';
    loadBtn.className = 'template-action-btn load-template-btn';
    loadBtn.style.padding = '3px 8px';
    loadBtn.style.fontSize = '12px';
    loadBtn.style.marginRight = '5px';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '刪除';
    deleteBtn.className = 'template-action-btn delete-template-btn';
    deleteBtn.style.padding = '3px 8px';
    deleteBtn.style.fontSize = '12px';
    
    actionBtns.appendChild(loadBtn);
    actionBtns.appendChild(deleteBtn);
    
    cardFooter.appendChild(dateInfo);
    cardFooter.appendChild(actionBtns);
    
    // 组合卡片
    card.appendChild(cardHeader);
    card.appendChild(cardContent);
    card.appendChild(cardFooter);
    
    // 添加事件处理
    loadBtn.onclick = (e) => {
      e.stopPropagation();
      loadTemplateContent(templateName, templateContent);
    };
    
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      confirmDeleteTemplate(templateName);
    };
    
    card.onclick = () => {
      showTemplatePreview(templateName, templateContent);
    };
    
    return card;
  }
  
  // 6. 显示模板预览
  function showTemplatePreview(templateName, templateContent) {
    // 如果已存在，先删除
    const existingPreview = document.getElementById('templatePreviewModal');
    if (existingPreview) {
      document.body.removeChild(existingPreview);
    }
    
    // 创建模态窗口
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'templatePreviewModal';
    modal.style.zIndex = '1001'; // 确保显示在模板管理界面之上
    
    // 创建模态内容
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // 添加关闭按钮
    const closeBtn = document.createElement('span');
    closeBtn.className = 'close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.style.display = 'none';
    
    // 创建标题
    const title = document.createElement('h2');
    title.textContent = `模板預覽: ${templateName}`;
    
    // 创建预览网格
    const previewContainer = document.createElement('div');
    previewContainer.style.margin = '20px 0';
    
    const previewGrid = document.createElement('div');
    previewGrid.style.display = 'grid';
    previewGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
    previewGrid.style.gap = '10px';
    previewGrid.style.marginBottom = '20px';
    
    // 添加所有内容项
    const previewItems = Array.isArray(templateContent) ? templateContent : [];
    previewItems.forEach((content, index) => {
      const previewItem = document.createElement('div');
      previewItem.textContent = content || '';
      previewItem.style.backgroundColor = '#f0f0f0';
      previewItem.style.padding = '15px 10px';
      previewItem.style.borderRadius = '8px';
      previewItem.style.textAlign = 'center';
      previewItem.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      previewItem.style.minHeight = '50px';
      previewItem.style.display = 'flex';
      previewItem.style.alignItems = 'center';
      previewItem.style.justifyContent = 'center';
      
      // 添加序号
      const indexBadge = document.createElement('div');
      indexBadge.textContent = index + 1;
      indexBadge.style.position = 'absolute';
      indexBadge.style.top = '5px';
      indexBadge.style.left = '5px';
      indexBadge.style.backgroundColor = '#3498db';
      indexBadge.style.color = 'white';
      indexBadge.style.borderRadius = '50%';
      indexBadge.style.width = '20px';
      indexBadge.style.height = '20px';
      indexBadge.style.display = 'flex';
      indexBadge.style.alignItems = 'center';
      indexBadge.style.justifyContent = 'center';
      indexBadge.style.fontSize = '12px';
      
      const itemWrapper = document.createElement('div');
      itemWrapper.style.position = 'relative';
      itemWrapper.appendChild(indexBadge);
      itemWrapper.appendChild(previewItem);
      
      previewGrid.appendChild(itemWrapper);
    });
    
    previewContainer.appendChild(previewGrid);
    
    // 添加按钮
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.gap = '20px';
    
    const loadBtn = document.createElement('button');
    loadBtn.textContent = '載入此模板';
    loadBtn.className = 'template-action-btn load-template-btn';
    loadBtn.style.padding = '10px 20px';
    
    const editBtn = document.createElement('button');
    editBtn.textContent = '編輯此模板';
    editBtn.className = 'template-action-btn';
    editBtn.style.padding = '10px 20px';
    editBtn.style.backgroundColor = '#4CAF50';
    
    buttonContainer.appendChild(loadBtn);
    buttonContainer.appendChild(editBtn);
    
    // 添加事件处理
    loadBtn.onclick = () => {
      loadTemplateContent(templateName, templateContent);
      modal.style.display = 'none';
    };
    
    editBtn.onclick = () => {
      editTemplateContent(templateName, templateContent);
      modal.style.display = 'none';
    };
    
    // 添加所有元素到DOM
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(title);
    modalContent.appendChild(previewContainer);
    modalContent.appendChild(buttonContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // 显示模态窗口
    modal.style.display = 'block';
  }
  
  // 7. 加载模板内容到编辑器
  function loadTemplateContent(templateName, templateContent) {
    const { configModal } = getDOMElements();
    
    // 确保内容是数组
    const contents = Array.isArray(templateContent) ? templateContent : [];
    
    // 更新输入框
    for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
      const input = document.getElementById(`content-${i}`);
      if (input) {
        input.value = contents[i] || `內容 ${i+1}`;
      }
    }
    
    // 关闭模板管理界面
    const templateManagerModal = document.getElementById('templateManagerModal');
    if (templateManagerModal) {
      templateManagerModal.style.display = 'none';
    }
    
    // 关闭预览界面
    const previewModal = document.getElementById('templatePreviewModal');
    if (previewModal) {
      previewModal.style.display = 'none';
    }
    
    // 确保配置模态窗口显示
    configModal.style.display = 'block';
    
    // 显示成功消息
    alert(`已成功載入模板 "${templateName}"！`);
  }
  
  // 8. 编辑模板内容
  function editTemplateContent(templateName, templateContent) {
    // 首先加载内容到编辑器
    loadTemplateContent(templateName, templateContent);
    
    // 设置当前编辑的模板名称
    const { templateNameInput } = getDOMElements();
    templateNameInput.value = templateName;
    
    // 可选：设置编辑模式标志
    templateNameInput.dataset.editMode = 'true';
    templateNameInput.dataset.originalName = templateName;
  }
  
  // 9. 确认删除模板
  function confirmDeleteTemplate(templateName) {
    if (confirm(`確定要刪除模板 "${templateName}" 嗎？此操作無法復原。`)) {
      deleteTemplateAndUpdateUI(templateName);
    }
  }
  
  // 10. 删除模板并更新界面
  async function deleteTemplateAndUpdateUI(templateName) {
    try {
      const success = await deleteTemplate(templateName);
      
      if (success) {
        // 清除缓存
        clearTemplateCache();
        
        // 重新加载模板
        cachedTemplates = await loadTemplates();
        
        // 更新收藏
        const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
        const updatedFavorites = favorites.filter(name => name !== templateName);
        localStorage.setItem('favorite_templates', JSON.stringify(updatedFavorites));
        
        // 更新模板日期记录
        const templateDates = JSON.parse(localStorage.getItem('template_dates') || '{}');
        if (templateDates[templateName]) {
          delete templateDates[templateName];
          localStorage.setItem('template_dates', JSON.stringify(templateDates));
        }
        
        // 更新界面
        populateTemplateViews(cachedTemplates);
        
        alert(`模板 "${templateName}" 已删除！`);
      } else {
        alert(`删除模板 "${templateName}" 失败，请稍后再试。`);
      }
    } catch (error) {
      console.error('删除模板时出错:', error);
      alert('删除模板时出错，请稍后再试。');
    }
  }
  
  // 11. 切换模板收藏状态
  function toggleFavoriteTemplate(templateName) {
    const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
    
    const index = favorites.indexOf(templateName);
    if (index === -1) {
      // 添加到收藏
      favorites.push(templateName);
    } else {
      // 从收藏中移除
      favorites.splice(index, 1);
    }
    
    localStorage.setItem('favorite_templates', JSON.stringify(favorites));
    
    // 更新UI
    updateFavoriteStatus(templateName);
  }
  
  // 12. 更新收藏状态显示
  // 更新界面上收藏状态的图标
  function updateFavoriteStatus(templateName) {
    const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
    const isFavorite = favorites.includes(templateName);
    
    // 更新网格视图中的收藏图标
    const gridCards = document.querySelectorAll('.template-card');
    gridCards.forEach(card => {
      if (card.dataset.templateName === templateName) {
        const favoriteBtn = card.querySelector('button');
        if (favoriteBtn) {
          favoriteBtn.style.color = isFavorite ? '#FFB74D' : '#ccc';
        }
      }
    });
    
    // 更新列表视图中的收藏图标
    const listRows = document.querySelectorAll('#listViewBody tr');
    listRows.forEach(row => {
      if (row.dataset.templateName === templateName) {
        const favoriteIcon = row.querySelector('span');
        if (favoriteIcon) {
          favoriteIcon.style.color = isFavorite ? '#FFB74D' : '#ccc';
        }
      }
    });
  }
  
  // 5. 创建模板列表行
  // 创建每个模板在表格视图中的行
  function createTemplateListRow(templateName, templateContent, creationDate) {
    const row = document.createElement('tr');
    row.dataset.templateName = templateName;
    row.dataset.creationDate = creationDate;
    
    // 名称列
    const nameCell = document.createElement('td');
    nameCell.style.padding = '10px';
    nameCell.style.borderBottom = '1px solid #eee';
    
    const nameContainer = document.createElement('div');
    nameContainer.style.display = 'flex';
    nameContainer.style.alignItems = 'center';
    
    const favoriteIcon = document.createElement('span');
    favoriteIcon.innerHTML = '★';
    favoriteIcon.style.marginRight = '5px';
    favoriteIcon.style.cursor = 'pointer';
    
    // 检查是否为收藏
    const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
    favoriteIcon.style.color = favorites.includes(templateName) ? '#FFB74D' : '#ccc';
    
    favoriteIcon.onclick = () => {
      toggleFavoriteTemplate(templateName);
    };
    
    const nameText = document.createElement('span');
    nameText.textContent = templateName;
    
    nameContainer.appendChild(favoriteIcon);
    nameContainer.appendChild(nameText);
    nameCell.appendChild(nameContainer);
    
    // 格子数量列
    const countCell = document.createElement('td');
    countCell.textContent = Array.isArray(templateContent) ? templateContent.length : '未知';
    countCell.style.padding = '10px';
    countCell.style.borderBottom = '1px solid #eee';
    
    // 创建日期列
    const dateCell = document.createElement('td');
    dateCell.textContent = new Date(creationDate).toLocaleDateString();
    dateCell.style.padding = '10px';
    dateCell.style.borderBottom = '1px solid #eee';
    
    // 操作按钮列
    const actionCell = document.createElement('td');
    actionCell.style.padding = '10px';
    actionCell.style.borderBottom = '1px solid #eee';
    
    const previewBtn = document.createElement('button');
    previewBtn.textContent = '預覽';
    previewBtn.className = 'template-action-btn';
    previewBtn.style.padding = '3px 8px';
    previewBtn.style.fontSize = '12px';
    previewBtn.style.marginRight = '5px';
    
    const loadBtn = document.createElement('button');
    loadBtn.textContent = '載入';
    loadBtn.className = 'template-action-btn load-template-btn';
    loadBtn.style.padding = '3px 8px';
    loadBtn.style.fontSize = '12px';
    loadBtn.style.marginRight = '5px';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '刪除';
    deleteBtn.className = 'template-action-btn delete-template-btn';
    deleteBtn.style.padding = '3px 8px';
    deleteBtn.style.fontSize = '12px';
    
    actionCell.appendChild(previewBtn);
    actionCell.appendChild(loadBtn);
    actionCell.appendChild(deleteBtn);
    
    // 添加事件处理
    previewBtn.onclick = () => {
      showTemplatePreview(templateName, templateContent);
    };
    
    loadBtn.onclick = () => {
      loadTemplateContent(templateName, templateContent);
    };
    
    deleteBtn.onclick = () => {
      confirmDeleteTemplate(templateName);
    };
    
    // 添加所有单元格到行
    row.appendChild(nameCell);
    row.appendChild(countCell);
    row.appendChild(dateCell);
    row.appendChild(actionCell);
    
    return row;
}

// 6. 显示模板预览
function showTemplatePreview(templateName, templateContent) {
  // 如果已存在，先删除
  const existingPreview = document.getElementById('templatePreviewModal');
  if (existingPreview) {
    document.body.removeChild(existingPreview);
  }
  
  // 创建模态窗口
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'templatePreviewModal';
  modal.style.zIndex = '1001'; // 确保显示在模板管理界面之上
  
  // 创建模态内容
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  // 添加关闭按钮
  const closeBtn = document.createElement('span');
  closeBtn.className = 'close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => modal.style.display = 'none';
  
  // 创建标题
  const title = document.createElement('h2');
  title.textContent = `模板預覽: ${templateName}`;
  
  // 创建预览网格
  const previewContainer = document.createElement('div');
  previewContainer.style.margin = '20px 0';
  
  const previewGrid = document.createElement('div');
  previewGrid.style.display = 'grid';
  previewGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
  previewGrid.style.gap = '10px';
  previewGrid.style.marginBottom = '20px';
  
  // 添加所有内容项
  const previewItems = Array.isArray(templateContent) ? templateContent : [];
  previewItems.forEach((content, index) => {
    const previewItem = document.createElement('div');
    previewItem.textContent = content || '';
    previewItem.style.backgroundColor = '#f0f0f0';
    previewItem.style.padding = '15px 10px';
    previewItem.style.borderRadius = '8px';
    previewItem.style.textAlign = 'center';
    previewItem.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    previewItem.style.minHeight = '50px';
    previewItem.style.display = 'flex';
    previewItem.style.alignItems = 'center';
    previewItem.style.justifyContent = 'center';
    
    // 添加序号
    const indexBadge = document.createElement('div');
    indexBadge.textContent = index + 1;
    indexBadge.style.position = 'absolute';
    indexBadge.style.top = '5px';
    indexBadge.style.left = '5px';
    indexBadge.style.backgroundColor = '#3498db';
    indexBadge.style.color = 'white';
    indexBadge.style.borderRadius = '50%';
    indexBadge.style.width = '20px';
    indexBadge.style.height = '20px';
    indexBadge.style.display = 'flex';
    indexBadge.style.alignItems = 'center';
    indexBadge.style.justifyContent = 'center';
    indexBadge.style.fontSize = '12px';
    
    const itemWrapper = document.createElement('div');
    itemWrapper.style.position = 'relative';
    itemWrapper.appendChild(indexBadge);
    itemWrapper.appendChild(previewItem);
    
    previewGrid.appendChild(itemWrapper);
  });
  
  previewContainer.appendChild(previewGrid);
  
  // 添加按钮
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.justifyContent = 'center';
  buttonContainer.style.gap = '20px';
  
  const loadBtn = document.createElement('button');
  loadBtn.textContent = '載入此模板';
  loadBtn.className = 'template-action-btn load-template-btn';
  loadBtn.style.padding = '10px 20px';
  
  const editBtn = document.createElement('button');
  editBtn.textContent = '編輯此模板';
  editBtn.className = 'template-action-btn';
  editBtn.style.padding = '10px 20px';
  editBtn.style.backgroundColor = '#4CAF50';
  
  buttonContainer.appendChild(loadBtn);
  buttonContainer.appendChild(editBtn);
  
  // 添加事件处理
  loadBtn.onclick = () => {
    loadTemplateContent(templateName, templateContent);
    modal.style.display = 'none';
  };
  
  editBtn.onclick = () => {
    editTemplateContent(templateName, templateContent);
    modal.style.display = 'none';
  };
  
  // 添加所有元素到DOM
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(title);
  modalContent.appendChild(previewContainer);
  modalContent.appendChild(buttonContainer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // 显示模态窗口
  modal.style.display = 'block';
}

// 7. 加载模板内容到编辑器
function loadTemplateContent(templateName, templateContent) {
  const { configModal } = getDOMElements();
  
  // 确保内容是数组
  const contents = Array.isArray(templateContent) ? templateContent : [];
  
  // 更新输入框
  for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
    const input = document.getElementById(`content-${i}`);
    if (input) {
      input.value = contents[i] || `內容 ${i+1}`;
    }
  }
  
  // 关闭模板管理界面
  const templateManagerModal = document.getElementById('templateManagerModal');
  if (templateManagerModal) {
    templateManagerModal.style.display = 'none';
  }
  
  // 关闭预览界面
  const previewModal = document.getElementById('templatePreviewModal');
  if (previewModal) {
    previewModal.style.display = 'none';
  }
  
  // 确保配置模态窗口显示
  configModal.style.display = 'block';
  
  // 显示成功消息
  alert(`已成功載入模板 "${templateName}"！`);
}

// 8. 编辑模板内容
function editTemplateContent(templateName, templateContent) {
  // 首先加载内容到编辑器
  loadTemplateContent(templateName, templateContent);
  
  // 设置当前编辑的模板名称
  const { templateNameInput } = getDOMElements();
  templateNameInput.value = templateName;
  
  // 可选：设置编辑模式标志
  templateNameInput.dataset.editMode = 'true';
  templateNameInput.dataset.originalName = templateName;
}

// 9. 确认删除模板
function confirmDeleteTemplate(templateName) {
  if (confirm(`確定要刪除模板 "${templateName}" 嗎？此操作無法復原。`)) {
    deleteTemplateAndUpdateUI(templateName);
  }
}

// 10. 删除模板并更新界面
async function deleteTemplateAndUpdateUI(templateName) {
  try {
    const success = await deleteTemplate(templateName);
    
    if (success) {
      // 清除缓存
      clearTemplateCache();
      
      // 重新加载模板
      cachedTemplates = await loadTemplates();
      
      // 更新收藏
      const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
      const updatedFavorites = favorites.filter(name => name !== templateName);
      localStorage.setItem('favorite_templates', JSON.stringify(updatedFavorites));
      
      // 更新模板日期记录
      const templateDates = JSON.parse(localStorage.getItem('template_dates') || '{}');
      if (templateDates[templateName]) {
        delete templateDates[templateName];
        localStorage.setItem('template_dates', JSON.stringify(templateDates));
      }
      
      // 更新界面
      populateTemplateViews(cachedTemplates);
      
      alert(`模板 "${templateName}" 已删除！`);
    } else {
      alert(`删除模板 "${templateName}" 失败，请稍后再试。`);
    }
  } catch (error) {
    console.error('删除模板时出错:', error);
    alert('删除模板时出错，请稍后再试。');
  }
}

// 11. 切换模板收藏状态
function toggleFavoriteTemplate(templateName) {
  const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
  
  const index = favorites.indexOf(templateName);
  if (index === -1) {
    // 添加到收藏
    favorites.push(templateName);
  } else {
    // 从收藏中移除
    favorites.splice(index, 1);
  }
  
  localStorage.setItem('favorite_templates', JSON.stringify(favorites));
  
  // 更新UI
  updateFavoriteStatus(templateName);
}

// 12. 更新收藏状态显示
function updateFavoriteStatus(templateName) {
  const favorites = JSON.parse(localStorage.getItem('favorite_templates') || '[]');
  const isFavorite = favorites.includes(templateName);
  
  // 更新网格视图中的收藏图标
  const gridCards = document.querySelectorAll('.template-card');
  gridCards.forEach(card => {
    if (card.dataset.templateName === templateName) {
      const favoriteBtn = card.querySelector('button');
      if (favoriteBtn) {
        favoriteBtn.style.color = isFavorite ? '#FFB74D' : '#ccc';
      }
    }
  });
  
  // 更新列表视图中的收藏图标
  const listRows = document.querySelectorAll('#listViewBody tr');
  listRows.forEach(row => {
    if (row.dataset.templateName === templateName) {
      const favoriteIcon = row.querySelector('span');
      if (favoriteIcon) {
        favoriteIcon.style.color = isFavorite ? '#FFB74D' : '#ccc';
      }
    }
  });
}

// 13. 筛选模板
function filterTemplates() {
  const searchInput = document.querySelector('.filter-area input');
  const searchTerm = searchInput.value.toLowerCase();
  
  // 筛选网格视图
  const gridCards = document.querySelectorAll('.template-card');
  gridCards.forEach(card => {
    const templateName = card.dataset.templateName.toLowerCase();
    if (templateName.includes(searchTerm)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
  
  // 筛选列表视图
  const listRows = document.querySelectorAll('#listViewBody tr');
  listRows.forEach(row => {
    const templateName = row.dataset.templateName.toLowerCase();
    if (templateName.includes(searchTerm)) {
      row.style.display = 'table-row';
    } else {
      row.style.display = 'none';
    }
  });
}

// 14. 排序模板
function sortTemplates() {
  const sortSelect = document.querySelector('.filter-area select');
  const sortType = sortSelect.value;
  
  // 获取所有模板元素
  const gridCards = Array.from(document.querySelectorAll('.template-card'));
  const listRows = Array.from(document.querySelectorAll('#listViewBody tr'));
  
  // 定义排序函数
  const sortFunction = (a, b) => {
    const nameA = a.dataset.templateName;
    const nameB = b.dataset.templateName;
    const dateA = new Date(a.dataset.creationDate);
    const dateB = new Date(b.dataset.creationDate);
    
    switch (sortType) {
      case 'name-asc':
        return nameA.localeCompare(nameB);
      case 'name-desc':
        return nameB.localeCompare(nameA);
      case 'date':
        return dateB - dateA; // 最新在前
      default:
        return 0;
    }
  };
  
  // 排序并重新添加到父元素
  const gridView = document.getElementById('gridView');
  gridCards.sort(sortFunction).forEach(card => {
    gridView.appendChild(card);
  });
  
  const listViewBody = document.getElementById('listViewBody');
  listRows.sort(sortFunction).forEach(row => {
    listViewBody.appendChild(row);
  });
}

// 15. 导入模板
function importTemplates() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    
    reader.onload = async (readerEvent) => {
      try {
        const importedTemplates = JSON.parse(readerEvent.target.result);
        
        // 验证导入的模板格式
        if (typeof importedTemplates !== 'object') {
          throw new Error('导入的文件格式不正确');
        }
        
        // 获取现有模板
        let existingTemplates = await loadTemplates();
        let importCount = 0;
        let skipCount = 0;
        
        // 记录模板创建日期
        const templateDates = JSON.parse(localStorage.getItem('template_dates') || '{}');
        const now = new Date().toISOString();
        
        // 处理每个导入的模板
        for (const templateName in importedTemplates) {
          if (existingTemplates[templateName] && !confirm(`模板 "${templateName}" 已存在，是否覆盖？`)) {
            skipCount++;
            continue;
          }
          
          existingTemplates[templateName] = importedTemplates[templateName];
          templateDates[templateName] = now;
          importCount++;
        }
        
        // 保存更新后的模板
        if (gameState.useServerStorage) {
          // 如果使用服务器存储，逐个保存模板
          for (const templateName in importedTemplates) {
            if (existingTemplates[templateName] === importedTemplates[templateName]) {
              await saveTemplate(templateName, importedTemplates[templateName]);
            }
          }
        } else {
          // 本地存储：一次性保存所有模板
          saveTemplatesToLocalStorage(existingTemplates);
        }
        
        // 保存模板日期
        localStorage.setItem('template_dates', JSON.stringify(templateDates));
        
        // 更新界面
        clearTemplateCache();
        cachedTemplates = await loadTemplates();
        populateTemplateViews(cachedTemplates);
        
        alert(`导入完成！\n成功导入: ${importCount} 个模板\n跳过: ${skipCount} 个模板`);
      } catch (error) {
        console.error('导入模板失败:', error);
        alert(`导入失败: ${error.message}`);
      }
    };
  };
  
  input.click();
}

// 16. 导出所有模板
function exportAllTemplates() {
  if (!cachedTemplates || Object.keys(cachedTemplates).length === 0) {
    alert('没有可导出的模板');
    return;
  }
  
  // 创建导出数据
  const exportData = JSON.stringify(cachedTemplates, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(exportData);
  
  // 设置导出文件名
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  const exportFileName = `sunnyyummy_templates_${dateStr}.json`;
  
  // 创建下载链接
  const downloadLink = document.createElement('a');
  downloadLink.setAttribute('href', dataUri);
  downloadLink.setAttribute('download', exportFileName);
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  
  // 触发下载
  downloadLink.click();
  
  // 移除下载链接
  document.body.removeChild(downloadLink);
}

// 17. 创建新模板
function createNewTemplate() {
  const { configModal } = getDOMElements();
  
  // 关闭模板管理界面
  const templateManagerModal = document.getElementById('templateManagerModal');
  if (templateManagerModal) {
    templateManagerModal.style.display = 'none';
  }
  
  // 清空所有输入框
  for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
    const input = document.getElementById(`content-${i}`);
    if (input) {
      input.value = '';
    }
  }
  
  // 清空模板名称输入框
  const { templateNameInput } = getDOMElements();
  templateNameInput.value = '';
  templateNameInput.dataset.editMode = 'false';
  templateNameInput.dataset.originalName = '';
  
  // 显示配置模态窗口
  configModal.style.display = 'block';
  
  // 聚焦到第一个输入框
  const firstInput = document.getElementById('content-0');
  if (firstInput) {
    firstInput.focus();
  }
}

// 18. 添加查看模板管理界面的按钮
function addTemplateManagerButton() {
  const { configModal, templatesBtn } = getDOMElements();
  
  // 修改原有的模板按钮行为
  templatesBtn.removeEventListener('click', initializeInputs);
  templatesBtn.onclick = () => {
    showTemplateManager();
    closeNavigationIfOpen();
  };
  
  // 添加模板管理按钮到配置模态窗口
  const templateManagerBtn = document.createElement('button');
  templateManagerBtn.textContent = '所有模板';
  templateManagerBtn.className = 'template-action-btn';
  templateManagerBtn.style.marginLeft = '15px';
  
  templateManagerBtn.onclick = () => {
    configModal.style.display = 'none';
    showTemplateManager();
  };
  
  // 插入按钮到模板管理区域
  const templateRow = document.querySelector('.template-row');
  if (templateRow) {
    templateRow.appendChild(templateManagerBtn);
  }
}

// 19. 初始化模板管理功能
function initTemplateManager() {
  // 确保模板日期记录存在
  if (!localStorage.getItem('template_dates')) {
    localStorage.setItem('template_dates', '{}');
  }
  
  // 添加模板管理按钮
  addTemplateManagerButton();
  
  // 添加模板管理样式
  addTemplateManagerStyles();
}

// 20. 添加模板管理所需的样式
function addTemplateManagerStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .view-btn {
      padding: 8px 15px;
      border: none;
      border-radius: 4px;
      background-color: #f0f0f0;
      cursor: pointer;
      margin: 0 5px;
    }
    
    .view-btn.active {
      background-color: #3498db;
      color: white;
    }
    
    .template-card {
      transition: all 0.3s ease;
    }
    
    .template-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 15px rgba(0,0,0,0.1);
    }
    
    .template-list th {
      position: sticky;
      top: 0;
      background-color: #f5f7fa;
      z-index: 10;
    }
    
    /* 确保按钮样式统一 */
    .template-action-btn {
      background-color: #3498db;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    
    .template-action-btn:hover {
      background-color: #2980b9;
    }
    
    .template-action-btn.load-template-btn {
      background-color: #3498db;
    }
    
    .template-action-btn.delete-template-btn {
      background-color: #e74c3c;
    }
    
    .template-action-btn.delete-template-btn:hover {
      background-color: #c0392b;
    }
    
    .template-action-btn.save-template-btn {
      background-color: #2ecc71;
    }
    
    .template-action-btn.save-template-btn:hover {
      background-color: #27ae60;
    }
  `;
  
  document.head.appendChild(styleElement);
}

// 21. 注册到现有系统
function registerTemplateManager() {
  // 在页面加载完成后初始化
  document.addEventListener('DOMContentLoaded', function() {
    // 在原有初始化之后添加模板管理功能
    const originalInitApp = initializeApp;
    initializeApp = async function() {
      await originalInitApp.call(this);
      initTemplateManager();
    };
  });
}
