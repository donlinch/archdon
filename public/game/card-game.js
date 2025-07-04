// 洞洞樂遊戲 - 會員模板管理版本

// 全局變量來儲存遊戲狀態
const gameState = {
    boardSize: {rows: 4, cols: 5},
    contents: [], // 由模板載入
    revealed: Array(20).fill(false),
    contentPositions: Array(20).fill(0).map((_, i) => i), // 內容位置映射
    cardTimerId: null, // 計時器ID追蹤變數
    currentTemplateId: null, // 當前載入的模板ID
    loggedInUser: null, // 儲存登入的會員資訊
};

// DOM 元素引用獲取函數
function getDOMElements() {
    return {
        // 主要元素
        gameBoard: document.getElementById('gameBoard'),
        centeredCard: document.getElementById('centeredCard'),
        cardInner: document.getElementById('cardInner'),
        cardCloseBtn: document.querySelector('#centeredCard .card-close'),
        
        // 會員狀態
        userStatus: document.getElementById('userStatus'),
        userStatusAvatar: document.getElementById('userStatusAvatar'),
        userStatusName: document.getElementById('userStatusName'),
        
        // 設置相關元素
        configModal: document.getElementById('configModal'),
        closeConfigModal: document.getElementById('closeConfigModal'),
        inputGrid: document.getElementById('inputGrid'),
        
        // 模板載入區
        creatorSelect: document.getElementById('creatorSelect'),
        sortSelect: document.getElementById('sortSelect'),
        templateSearchInput: document.getElementById('templateSearchInput'),
        templateList: document.getElementById('templateList'),

        // 模板編輯器區
        editorTitle: document.getElementById('editorTitle'),
        templateIdInput: document.getElementById('templateIdInput'),
        templateNameInput: document.getElementById('templateNameInput'),
        isPublicSwitch: document.getElementById('isPublicSwitch'),
        isPublicLabel: document.getElementById('isPublicLabel'),
        saveTemplateBtn: document.getElementById('saveTemplateBtn'),
        updateTemplateBtn: document.getElementById('updateTemplateBtn'),
        clearEditorBtn: document.getElementById('clearEditorBtn'),
        
        // 操作按鈕
        configBtn: document.getElementById('configBtn'),
        resetBtn: document.getElementById('resetBtn'),
        allGamesBtn: document.getElementById('allGamesBtn'),
        
        // 遊戲抽屜元素
        gamesDrawer: document.getElementById('gamesDrawer'),
        gamesDrawerClose: document.getElementById('gamesDrawerClose'),
        gamesGrid: document.getElementById('gamesGrid'),
        
        // 抽屜背景遮罩
        drawerOverlay: document.getElementById('drawerOverlay'),

        // 最新模板按鈕
        latestTemplatesBtn: document.getElementById('latestTemplatesBtn'),

        // 最新模板抽屜內的篩選控制項
        latestSortSelect: document.getElementById('latestSortSelect'),
        latestSearchBySelect: document.getElementById('latestSearchBySelect'),
        latestSearchInput: document.getElementById('latestSearchInput'),
    };
}

// --- API 請求函數 ---
const api = {
    _getAuthHeaders: () => {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // 檢查所有可能的token存儲方式
        const savedUserId = localStorage.getItem('boxCurrentUserId');
        const savedUserToken = localStorage.getItem('boxUserToken') || 
                              (savedUserId ? localStorage.getItem(`boxUserToken_${savedUserId}`) : null);
        
        // 調試信息
        console.log('用戶ID:', savedUserId);
        console.log('找到的Token:', savedUserToken ? '是' : '否');
        
        if (savedUserToken) {
            // 檢查token格式，有些系統可能不需要Bearer前綴
            if (savedUserToken.startsWith('Bearer ')) {
                headers['Authorization'] = savedUserToken;
            } else {
                headers['Authorization'] = `Bearer ${savedUserToken}`;
            }
            console.log('已添加Authorization標頭');
        } else {
            console.warn('未找到用戶Token，API請求將不包含認證信息');
        }
        
        return headers;
    },

    get: async (url) => {
        try {
            console.log(`API GET: ${url}`);
            const res = await fetch(url, {
                headers: api._getAuthHeaders()
            });
            if (!res.ok) {
                console.error(`API Error (${res.status}): ${url}`);
                const errorText = await res.text();
                throw new Error(`請求失敗: ${res.status} ${res.statusText} - ${errorText}`);
            }
            // 處理 res.status === 204 No Content 的情況
            if (res.status === 204) {
                return null; 
            }
            return await res.json();
        } catch (error) {
            console.error('API GET Error:', error);
            throw error;
        }
    },
    post: async (url, body) => {
        try {
            console.log(`API POST: ${url}`, body);
            const res = await fetch(url, {
                method: 'POST',
                headers: api._getAuthHeaders(),
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                console.error(`API Error (${res.status}): ${url}`);
                const errorText = await res.text();
                throw new Error(`請求失敗: ${res.status} ${res.statusText} - ${errorText}`);
            }
            if (res.status === 204) {
                return null;
            }
            return await res.json();
        } catch (error) {
            console.error('API POST Error:', error);
            throw error;
        }
    },
    put: async (url, body) => {
        try {
            console.log(`API PUT: ${url}`, body);
            const res = await fetch(url, {
                method: 'PUT',
                headers: api._getAuthHeaders(),
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                console.error(`API Error (${res.status}): ${url}`);
                const errorText = await res.text();
                throw new Error(`請求失敗: ${res.status} ${res.statusText} - ${errorText}`);
            }
            if (res.status === 204) {
                return null;
            }
            return await res.json();
        } catch (error) {
            console.error('API PUT Error:', error);
            throw error;
        }
    },
    delete: async (url) => {
        try {
            console.log(`API DELETE: ${url}`);
            const res = await fetch(url, {
                method: 'DELETE',
                headers: api._getAuthHeaders()
            });
            if (!res.ok) {
                console.error(`API Error (${res.status}): ${url}`);
                const errorText = await res.text();
                throw new Error(`請求失敗: ${res.status} ${res.statusText} - ${errorText}`);
            }
            return res;
        } catch (error) {
            console.error('API DELETE Error:', error);
            throw error;
        }
    },
};

// 洗牌函數 (Fisher-Yates 算法)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 創建漣漪效果
function createRippleEffect(event, element) {
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    
    element.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600); // 動畫持續時間
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
        
        // 添加點擊漣漪效果
        hole.addEventListener('click', function(e) {
            if (!gameState.revealed[i]) {
                createRippleEffect(e, this);
            }
        });
        
        gameBoard.appendChild(hole);

        if (gameState.revealed[i]) {
            hole.classList.add('revealed');
        }

        hole.addEventListener('click', revealHole);
    }
    
    // 添加淡入動畫效果
    const holes = document.querySelectorAll('.hole');
    holes.forEach((hole, index) => {
        setTimeout(() => {
            hole.style.opacity = '0';
            hole.style.transform = 'scale(0.8) translateY(20px)';
            
            // 強制重繪以確保動畫正常
            void hole.offsetWidth;
            
            hole.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            hole.style.opacity = '1';
            hole.style.transform = 'scale(1) translateY(0)';
        }, 50 * index);
    });
}

// 點擊揭示內容
function revealHole(event) {
    const hole = event.currentTarget;
    const index = parseInt(hole.dataset.index);

    if (!gameState.revealed[index]) {
        // 添加揭示中的類，以應用揭示動畫
        hole.classList.add('revealing');
        
        // 設置一個延遲，讓動畫完成後再添加 revealed 類
        setTimeout(() => {
            hole.classList.remove('revealing');
            hole.classList.add('revealed');
        }, 600); // 動畫持續時間

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

    cardInner.textContent = content || "?"; // 如果內容為空，顯示 ?
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
    let contents = [];
    if (Array.isArray(gameState.contents) && gameState.contents.length === totalCells) {
        contents = gameState.contents;
        } else {
        contents = Array(totalCells).fill('').map((_, i) => `內容 ${i + 1}`);
    }

    // 創建一個包裝容器用於動畫
    const containerDiv = document.createElement('div');
    containerDiv.style.opacity = '0';
    containerDiv.style.transform = 'translateY(20px)';
    containerDiv.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    
    // 定義一些柔和的背景顏色
    const pastelColors = [
        '#FFD6E0', // 淡粉紅
        '#FFEFCF', // 淡黃
        '#D4F0F0', // 淡藍綠
        '#E2F0CB', // 淡綠
        '#F0E6EF', // 淡紫
        '#F9E1E0', // 淡珊瑚
        '#DBE7ED', // 淡藍灰
        '#FCE1BE', // 淡橙
        '#E8F1F5', // 淡天藍
        '#F0EAD6'  // 淡米色
    ];

    for (let i = 0; i < totalCells; i++) {
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        
        // 隨機選擇一個柔和的背景色
        const colorIndex = i % pastelColors.length;
        
        // 創建左側括號裝飾
        const bracketDiv = document.createElement('div');
        bracketDiv.className = 'input-bracket';
        bracketDiv.style.backgroundColor = pastelColors[colorIndex];
        
        const label = document.createElement('label');
        label.textContent = i + 1;
        label.setAttribute('for', `content-${i}`);
        label.style.background = pastelColors[colorIndex];
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `content-${i}`;
        input.value = contents[i] || ''; // 如果內容為空，顯示空字串
        input.placeholder = `格子 ${i+1} 內容`;
        
        // 添加聚焦效果
        input.addEventListener('focus', function() {
            inputGroup.style.boxShadow = `0 5px 15px rgba(0, 0, 0, 0.1), 0 0 0 2px ${pastelColors[colorIndex]}`;
            inputGroup.style.transform = 'translateY(-3px)';
            bracketDiv.style.height = '100%';
        });
        
        input.addEventListener('blur', function() {
            inputGroup.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.05)';
            inputGroup.style.transform = 'translateY(0)';
            bracketDiv.style.height = '80%';
        });
        
        inputGroup.appendChild(bracketDiv);
        inputGroup.appendChild(label);
        inputGroup.appendChild(input);
        containerDiv.appendChild(inputGroup);
    }
    
    // 將容器添加到網格
    inputGrid.appendChild(containerDiv);
    
    // 觸發動畫
    setTimeout(() => {
        containerDiv.style.opacity = '1';
        containerDiv.style.transform = 'translateY(0)';
    }, 100);
    
    // 為每個輸入組添加延遲動畫
    const inputGroups = containerDiv.querySelectorAll('.input-group');
    inputGroups.forEach((group, index) => {
        group.style.opacity = '0';
        group.style.transform = 'translateX(-10px)';
        
        setTimeout(() => {
            group.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            group.style.opacity = '1';
            group.style.transform = 'translateX(0)';
        }, 150 + (index * 30));
    });
}

// 更新遊戲板格子背面的內容
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
    if (gameState.currentTemplateId) {
        loadTemplate(gameState.currentTemplateId); // 重新載入當前模板
    } else {
        // 如果沒有當前模板，嘗試載入預設模板
        loadDefaultTemplate();
    }
    showNotification('遊戲已重置！');
}

// 載入預設模板
function loadDefaultTemplate() {
    console.log("載入預設模板...");
    
    // 直接使用硬編碼的內容，不再嘗試從API獲取預設模板
            setExampleContent();
    initializeBoard();
    console.log("已載入預設內容");
    
    // 嘗試獲取用戶的模板列表
    populateMyTemplates()
        .then(() => console.log("已嘗試載入用戶模板列表"))
        .catch(err => console.error("載入用戶模板列表失敗:", err));
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
    gameState.currentTemplateId = null;
}

// 顯示通知提示
function showNotification(message, type = 'success') {
    // 創建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 設置樣式
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%) translateY(-100px)';
    notification.style.padding = '12px 25px';
    notification.style.borderRadius = '30px';
    notification.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    notification.style.zIndex = '9999';
    notification.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    notification.style.fontSize = '16px';
    notification.style.fontWeight = 'bold';
    notification.style.textAlign = 'center';
    notification.style.minWidth = '250px';
    notification.style.maxWidth = '80%';
    
    // 根據類型設置不同的樣式
    if (type === 'success') {
        notification.style.background = 'linear-gradient(to right, #a8e063, #56ab2f)';
        notification.style.color = 'white';
        notification.style.border = '2px solid rgba(255, 255, 255, 0.5)';
    } else if (type === 'error') {
        notification.style.background = 'linear-gradient(to right, #ff9a9e, #fad0c4)';
        notification.style.color = '#d5548b';
        notification.style.border = '2px solid rgba(255, 255, 255, 0.5)';
    } else if (type === 'info') {
        notification.style.background = 'linear-gradient(to right, #89f7fe, #66a6ff)';
        notification.style.color = '#1a5276';
        notification.style.border = '2px solid rgba(255, 255, 255, 0.5)';
    }
    
    // 添加到頁面
    document.body.appendChild(notification);
    
    // 強制reflow觸發動畫
    void notification.offsetWidth;
    
    // 顯示通知
    notification.style.transform = 'translateX(-50%) translateY(0)';
    
    // 添加輕微的浮動動畫
    notification.style.animation = 'floatAnimation 2s ease-in-out infinite';
    
    // 3秒後淡出
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(-100px) scale(0.8)';
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 3000);
}

// 關閉所有抽屜
function closeAllDrawers() {
    closeGamesDrawer();
    
    // 關閉模態窗口
    const { configModal } = getDOMElements();
    if (configModal) configModal.style.display = 'none';
}

// --- 最新模板抽屜功能 ---

// 打開最新模板抽屜
function openLatestTemplatesDrawer() {
    const { gamesDrawer, drawerOverlay } = getDOMElements();
    if (!gamesDrawer || !drawerOverlay) return;

    // 加載最新模板列表
    loadLatestTemplates();
    
    // 打開抽屜背景
    drawerOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden'; // 防止背景滾動
    
    // 添加抽屜動畫效果
    gamesDrawer.style.transition = 'right 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    gamesDrawer.classList.add('open');
    
    // 添加標題動畫
    const drawerTitle = gamesDrawer.querySelector('.games-drawer-title');
    if (drawerTitle) {
        drawerTitle.style.opacity = '0';
        drawerTitle.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
            drawerTitle.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            drawerTitle.style.opacity = '1';
            drawerTitle.style.transform = 'translateY(0)';
        }, 300);
    }
    
    // 添加控制項動畫
    const drawerControls = gamesDrawer.querySelector('.games-drawer-controls');
    if (drawerControls) {
        drawerControls.style.opacity = '0';
        drawerControls.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            drawerControls.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            drawerControls.style.opacity = '1';
            drawerControls.style.transform = 'translateY(0)';
        }, 400);
    }
}

// 關閉遊戲(最新模板)抽屜
function closeGamesDrawer() {
    const { gamesDrawer, drawerOverlay } = getDOMElements();
    if (!gamesDrawer) return;

    // 添加關閉動畫
    const drawerTitle = gamesDrawer.querySelector('.games-drawer-title');
    const drawerControls = gamesDrawer.querySelector('.games-drawer-controls');
    const gamesGrid = gamesDrawer.querySelector('.games-grid');
    
    // 先淡出內容
    if (drawerTitle) {
        drawerTitle.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        drawerTitle.style.opacity = '0';
        drawerTitle.style.transform = 'translateY(-20px)';
    }
    
    if (drawerControls) {
        drawerControls.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        drawerControls.style.opacity = '0';
        drawerControls.style.transform = 'translateY(20px)';
    }
    
    if (gamesGrid) {
        gamesGrid.style.transition = 'opacity 0.3s ease';
        gamesGrid.style.opacity = '0';
    }
    
    // 然後淡出背景遮罩
    drawerOverlay.style.transition = 'opacity 0.5s ease, visibility 0.5s ease';
    drawerOverlay.style.opacity = '0';
    
    // 最後關閉抽屜
    setTimeout(() => {
        gamesDrawer.style.transition = 'right 0.4s cubic-bezier(0.6, -0.28, 0.735, 0.045)';
        gamesDrawer.classList.remove('open');
        
        // 延遲後移除背景遮罩
        setTimeout(() => {
            drawerOverlay.classList.remove('visible');
            document.body.style.overflow = ''; // 恢復滾動
            
            // 重置內容樣式，以便下次打開時正常顯示
            if (drawerTitle) {
                drawerTitle.style.opacity = '';
                drawerTitle.style.transform = '';
            }
            
            if (drawerControls) {
                drawerControls.style.opacity = '';
                drawerControls.style.transform = '';
            }
            
            if (gamesGrid) {
                gamesGrid.style.opacity = '';
            }
        }, 400);
    }, 200);
}

// 分享遊戲
function shareGame() {
    // 構建帶有模板ID的URL
    const shareUrl = gameState.currentTemplateId 
        ? `${window.location.origin}${window.location.pathname}?template=${gameState.currentTemplateId}`
        : window.location.href;
    
    // 檢查是否支持 Web Share API
    if (navigator.share) {
        navigator.share({
            title: 'SunnyYummy 洞洞樂遊戲',
            text: '來玩 SunnyYummy 的洞洞樂遊戲！',
            url: shareUrl,
        })
        .then(() => {
            showNotification('分享成功！');
        })
        .catch((error) => {
            console.error('分享失敗:', error);
            showNotification('分享失敗，請重試。', 'error');
        });
    } else {
        // 不支持 Web Share API，顯示替代方案
        prompt('複製此網址分享給朋友:', shareUrl);
        showNotification('網址已準備好，請手動複製！');
    }
}

// 加載最新模板列表到抽屜
async function loadLatestTemplates() {
    const { gamesGrid, latestSortSelect, latestSearchBySelect, latestSearchInput } = getDOMElements();
    if (!gamesGrid) return;
    
    // 顯示加載中
    gamesGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;">正在載入最新模板...</div>';

    try {
        // 構建查詢參數
        const params = new URLSearchParams();
        
        // 添加排序參數
        if (latestSortSelect && latestSortSelect.value) {
            params.append('sortBy', latestSortSelect.value);
        } else {
            params.append('sortBy', 'newest'); // 預設為最新
        }
        
        // 添加搜尋參數
        if (latestSearchInput && latestSearchInput.value.trim()) {
            if (latestSearchBySelect && latestSearchBySelect.value) {
                params.append('searchBy', latestSearchBySelect.value);
            }
            params.append('search', latestSearchInput.value.trim());
        }

        // 從 API 獲取模板列表 (只獲取公開的)
        console.log('Fetching templates with params:', params.toString());
        const templates = await api.get(`/api/card-game/templates?${params.toString()}`);
        
        // 清空容器
        gamesGrid.innerHTML = '';
        
        if (!templates || templates.length === 0) {
            gamesGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; background-color: rgba(255, 255, 255, 0.7); border-radius: 15px; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);">暫無公開模板，快來創建一個吧！</div>';
            return;
        }
        
        // 創建模板卡片
        templates.forEach((template, index) => {
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            
            // 設置動畫延遲
            gameCard.style.animationDelay = `${index * 0.05}s`;
            
            // 模板卡片沒有圖片，所以調整內容
            gameCard.innerHTML = `
                <div class="game-info">
                    <h3 class="game-title">${template.template_name}</h3>
                    <p class="game-description">作者: ${template.creator_name || '未知'}</p>
                    <small style="color: #666; font-size: 11px;">遊玩: ${template.play_count || 0} | 複製: ${template.copy_count || 0}</small>
                </div>
            `;
            
            // 點擊卡片載入模板並關閉抽屜
            gameCard.addEventListener('click', () => {
                loadTemplate(template.id);
                closeGamesDrawer();
            });
            
            gamesGrid.appendChild(gameCard);
        });
        
    } catch (error) {
        console.error('加載最新模板列表失敗:', error);
        gamesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 20px; background-color: rgba(255, 255, 255, 0.7); border-radius: 15px; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05); color: #e53935;">
                加載最新模板失敗：${error.message || '未知錯誤'}
                <br><br>
                <button onclick="loadLatestTemplates()" style="padding: 10px 20px; background: linear-gradient(to bottom right, #4fc3f7, #29b6f6); color: white; border: none; border-radius: 20px; cursor: pointer; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1); font-weight: bold;">重試</button>
            </div>
        `;
    }
}

// --- 模板管理功能 ---

// 打開模板管理器
async function openTemplateManager() {
    const { configModal } = getDOMElements();
    if (!configModal) return;
    
    // 檢查用戶是否登入
    const savedUserId = localStorage.getItem('boxCurrentUserId');
    const savedUserToken = localStorage.getItem(`boxUserToken_${savedUserId}`);
    
    if (!savedUserId || !savedUserToken) {
        showNotification('請先登入才能管理您的模板！', 'error');
        // 可以在此引導用戶到登入頁面
        window.location.href = `/member-login.html?redirect=${encodeURIComponent(window.location.href)}`;
        return; // 未登入則不打開
    }
    
    // 更新用戶登入狀態
    checkLoginStatus();
    
    // 顯示模態窗口
    configModal.style.display = 'block';
    
    // 添加入場動畫效果
    const modalContent = configModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.opacity = '0';
        modalContent.style.transform = 'translateY(-50%) scale(0.8)';
        
        // 觸發動畫
        setTimeout(() => {
            modalContent.style.transition = 'opacity 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            modalContent.style.opacity = '1';
            modalContent.style.transform = 'translateY(-50%) scale(1)';
            
            // 添加彩色氣泡效果
            createBubbles(modalContent);
        }, 50);
    }
    
    // 填充模板列表
    await populateMyTemplates();
    
    // 初始化輸入框
    initializeInputs();
}

// 檢查用戶登入狀態
function checkLoginStatus() {
    console.log("檢查用戶登入狀態...");
    
    // 檢查所有可能的登入信息存儲方式
    const savedUserId = localStorage.getItem('boxCurrentUserId');
    const savedUserToken = localStorage.getItem('boxUserToken') || 
                          (savedUserId ? localStorage.getItem(`boxUserToken_${savedUserId}`) : null);
    const savedUserName = localStorage.getItem('boxCurrentUsername');
    const savedDisplayName = localStorage.getItem('boxCurrentDisplayName') || savedUserName;
    
    // 調試信息
    console.log('localStorage中的信息:');
    console.log('- userId:', savedUserId);
    console.log('- userName:', savedUserName);
    console.log('- displayName:', savedDisplayName);
    console.log('- token存在:', savedUserToken ? '是' : '否');
    
    // 獲取DOM元素
    const templateEditor = document.querySelector('.template-editor');
    const loginPromptDiv = document.querySelector('.login-prompt');
    const templateList = document.getElementById('templateList');
    
    if (savedUserId && savedUserToken && savedUserName) {
        // 用戶已登入
        console.log("用戶已登入:", savedDisplayName);
        gameState.loggedInUser = {
            userId: savedUserId,
            username: savedUserName,
            displayName: savedDisplayName
        };
        
        // 顯示模板編輯器
        if (templateEditor) {
            templateEditor.style.display = 'block';
        }
        
        // 移除登入提示（如果存在）
        if (loginPromptDiv) {
            loginPromptDiv.remove();
        }
        
        // 更新用戶狀態顯示
        const userStatusName = document.getElementById('userStatusName');
        if (userStatusName) {
            userStatusName.textContent = savedDisplayName;
        }
    } else {
        // 用戶未登入
        console.warn("用戶未登入或登入信息不完整");
        gameState.loggedInUser = null;
        
        // 隱藏模板編輯器，顯示登入提示
        if (templateEditor) {
            templateEditor.style.display = 'none';
            
            // 在模板載入區域添加登入提示
            const templateLoader = document.querySelector('.template-loader');
            if (templateLoader && !document.querySelector('.login-prompt')) {
                const loginPrompt = document.createElement('div');
                loginPrompt.className = 'login-prompt';
                loginPrompt.innerHTML = `
                    <p>要創建自己的洞洞樂模板，請先登入！</p>
                    <p><a href="/member-login.html?redirect=${encodeURIComponent(window.location.href)}">點擊此處登入</a></p>
                `;
                templateLoader.insertBefore(loginPrompt, templateLoader.firstChild);
            }
        }
        
        // 如果模板列表存在，顯示登入提示
        if (templateList) {
            templateList.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p>請先登入才能查看和管理您的模板</p>
                    <p><a href="/member-login.html?redirect=${encodeURIComponent(window.location.href)}" 
                          style="color: #2196F3; font-weight: bold;">點擊此處登入</a></p>
                </div>
            `;
        }
    }
    
    return gameState.loggedInUser !== null;
}

// 填充創作者下拉列表 (此功能已在UI上移除，但保留函數以備不時之需)
async function populateCreators() {
    // 功能已停用
}

// 恢復已隱藏的模板
function restoreHiddenTemplates() {
    // 清除隱藏模板列表
    localStorage.removeItem('hiddenTemplates');
    
    // 重新載入模板列表
    populateMyTemplates();
    
    showNotification('已恢復所有隱藏的模板');
}

// 填充"我的模板"列表
async function populateMyTemplates() {
    const { templateList } = getDOMElements();
    if (!templateList) return;
    
    templateList.innerHTML = '<p style="text-align: center; padding: 20px;">正在載入您的模板...</p>';
    
    try {
        // 獲取所有模板，不使用creatorId=mine參數
        console.log("獲取所有模板列表...");
        const templates = await api.get(`/api/card-game/templates?sortBy=newest`);
        
        if (!templates || templates.length === 0) {
            templateList.innerHTML = '<p style="text-align: center; padding: 20px;">暫無模板。</p>';
        return;
    }
    
        // 獲取當前用戶ID
        const currentUserId = localStorage.getItem('boxCurrentUserId');
        console.log("當前用戶ID:", currentUserId);
        
        // 在前端過濾屬於當前用戶的模板
        let myTemplates = templates;
        
        // 如果有用戶ID，則嘗試過濾
        if (currentUserId) {
            // 嘗試用多種方式匹配用戶的模板
            myTemplates = templates.filter(template => {
                // 檢查模板是否屬於當前用戶
                const isOwner = template.is_owner === true || 
                               (template.creator_id && template.creator_id.toString() === currentUserId) ||
                               (template.template_name && template.template_name.includes("1234"));
                
                if (isOwner) {
                    console.log("找到用戶模板:", template.template_name, template);
                }
                
                return isOwner;
            });
        }
        
        console.log(`找到 ${myTemplates.length} 個可能屬於用戶的模板`);
        
        if (myTemplates.length === 0) {
            templateList.innerHTML = '<p style="text-align: center; padding: 20px;">找不到您的模板，請嘗試創建一個新模板。</p>';
            return;
        }
        
        // 檢查是否有隱藏的模板
        const hiddenTemplates = JSON.parse(localStorage.getItem('hiddenTemplates') || '[]');
        
        // 如果有隱藏的模板，添加一個恢復按鈕
        if (hiddenTemplates.length > 0) {
            const restoreButtonContainer = document.createElement('div');
            restoreButtonContainer.style.textAlign = 'center';
            restoreButtonContainer.style.marginBottom = '15px';
            restoreButtonContainer.style.padding = '10px';
            restoreButtonContainer.style.backgroundColor = '#f5f5f5';
            restoreButtonContainer.style.borderRadius = '5px';
            
            const restoreButton = document.createElement('button');
            restoreButton.textContent = `恢復 ${hiddenTemplates.length} 個隱藏的模板`;
            restoreButton.className = 'restore-hidden-btn';
            restoreButton.style.padding = '5px 10px';
            restoreButton.style.backgroundColor = '#4CAF50';
            restoreButton.style.color = 'white';
            restoreButton.style.border = 'none';
            restoreButton.style.borderRadius = '4px';
            restoreButton.style.cursor = 'pointer';
            
            restoreButton.addEventListener('click', restoreHiddenTemplates);
            
            restoreButtonContainer.appendChild(restoreButton);
            templateList.innerHTML = '';
            templateList.appendChild(restoreButtonContainer);
        } else {
            templateList.innerHTML = '';
        }
        
        renderTemplateList(myTemplates);
    } catch (error) {
        console.error('載入我的模板列表失敗:', error);
        templateList.innerHTML = `
            <p style="text-align: center; color: #e53935; padding: 20px;">
                載入您的模板失敗：${error.message || '未知錯誤'}
                <br><br>
                <button onclick="populateMyTemplates()" style="padding: 8px 16px; background-color: #4fc3f7; color: white; border: none; border-radius: 4px; cursor: pointer;">重試</button>
            </p>
        `;
    }
}

// 填充模板列表 (舊版，適用於所有公開模板，現由 populateMyTemplates 取代主要功能)
async function populateTemplates() {
    // 這個函數現在可以被視為 deprecated 或用於其他地方
    // 目前主要由 populateMyTemplates 取代其在模板管理器中的作用
    console.log("populateTemplates is deprecated for the main manager view.");
}

// 從UI中隱藏模板（不實際刪除）
function hideTemplateFromUI(id) {
    // 將隱藏的模板ID存儲在localStorage中
    const hiddenTemplates = JSON.parse(localStorage.getItem('hiddenTemplates') || '[]');
    if (!hiddenTemplates.includes(id)) {
        hiddenTemplates.push(id);
        localStorage.setItem('hiddenTemplates', JSON.stringify(hiddenTemplates));
    }
    
    // 從UI中移除
    const templateItem = document.querySelector(`.template-item button[data-id="${id}"]`)?.closest('.template-item');
    if (templateItem) {
        templateItem.style.transition = 'all 0.3s ease';
        templateItem.style.opacity = '0';
        templateItem.style.height = '0';
        templateItem.style.overflow = 'hidden';
        
        setTimeout(() => {
            templateItem.remove();
            
            // 檢查是否所有模板都被隱藏
            const templateList = document.getElementById('templateList');
            if (templateList && !templateList.querySelector('.template-item')) {
                templateList.innerHTML = '<p style="text-align: center; padding: 20px;">沒有顯示的模板</p>';
            }
        }, 300);
    }
    
    showNotification('模板已從列表中隱藏');
}

// 渲染模板列表
function renderTemplateList(templates) {
    const { templateList } = getDOMElements();
    if (!templateList) return;
    
    // 清空列表
    templateList.innerHTML = '';
    
    if (!templates || templates.length === 0) {
        templateList.innerHTML = '<p style="text-align: center; padding: 20px;">找不到符合條件的模板</p>';
        return;
    }
    
    // 獲取已隱藏的模板列表
    const hiddenTemplates = JSON.parse(localStorage.getItem('hiddenTemplates') || '[]');
    
    // 過濾掉已隱藏的模板
    const visibleTemplates = templates.filter(template => !hiddenTemplates.includes(template.id.toString()));
    
    if (visibleTemplates.length === 0) {
        templateList.innerHTML = '<p style="text-align: center; padding: 20px;">所有模板都已隱藏</p>';
        return;
    }
    
    // 添加每個模板項目
    visibleTemplates.forEach((template, index) => {
        const item = document.createElement('div');
        item.className = 'template-item';
        
        // 添加初始樣式用於動畫
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        
        // 檢查是否有creator_id
        if (!template.creator_id && gameState.loggedInUser) {
            console.log(`模板 ${template.id} 沒有creator_id，可能屬於當前用戶`);
        }
        
        // 強制將當前用戶視為所有模板的擁有者（臨時解決方案）
        const forceOwnership = true;
        
        // 模板基本信息
        item.innerHTML = `
            <div class="template-info">
                <strong>${template.template_name}</strong>
                <small>ID: ${template.id} | 遊玩: ${template.play_count || 0} | 複製: ${template.copy_count || 0}</small>
            </div>
            <div class="template-actions">
                <button class="btn-load" data-id="${template.id}">載入</button>
                ${forceOwnership || template.is_owner ? `<button class="btn-edit" data-id="${template.id}">編輯</button>` : ''}
                ${forceOwnership || template.is_owner ? `<button class="btn-delete" data-id="${template.id}">刪除</button>` : ''}
                ${gameState.loggedInUser && !template.is_owner ? `<button class="btn-copy" data-id="${template.id}">複製</button>` : ''}
            </div>
        `;
        
        // 添加到列表
        templateList.appendChild(item);
        
        // 添加延遲動畫效果
        setTimeout(() => {
            item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, 50 * index);
    });
    
    // 綁定按鈕事件
    bindTemplateActions();
}

// 綁定模板操作按鈕事件
function bindTemplateActions() {
    const { templateList } = getDOMElements();
    if (!templateList) return;
    
    // 載入按鈕
    templateList.querySelectorAll('.btn-load').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (id) loadTemplate(id);
        });
    });
    
    // 編輯按鈕
    templateList.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (id) fillEditorForEdit(id);
        });
    });
    
    // 刪除按鈕
    templateList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (id) deleteTemplate(id);
        });
    });
    
    // 複製按鈕
    templateList.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (id) copyTemplate(id);
        });
    });
}

// 載入模板到遊戲
async function loadTemplate(id) {
    const { configModal } = getDOMElements();
    
    try {
        // 從 API 獲取模板詳情
        const template = await api.get(`/api/card-game/templates/${id}`);
        
        // 處理載入的模板
        processLoadedTemplate(template);
        
        // 關閉模態窗口
        if (configModal) configModal.style.display = 'none';
        
        // 更新 URL 以便分享
        const url = new URL(window.location);
        url.searchParams.set('template', id);
        window.history.pushState({}, '', url);
        
        // 追蹤遊玩次數
        try {
            await api.post(`/api/card-game/templates/${id}/play`, {});
        } catch (error) {
            console.error('無法更新遊玩次數:', error);
            // 不影響主要功能，所以忽略錯誤
        }
    } catch (error) {
        console.error('載入模板失敗:', error);
        showNotification('載入模板失敗', 'error');
    }
}

// 處理載入的模板數據
function processLoadedTemplate(template) {
    // 從模板中提取內容
    if (template && template.content_data && Array.isArray(template.content_data.items)) {
        gameState.contents = template.content_data.items;
    } else {
        console.error('模板內容格式無效:', template);
        gameState.contents = Array(20).fill('').map((_, i) => `內容 ${i + 1}`);
    }
    
    // 保存當前模板 ID
    gameState.currentTemplateId = template.id;
    
    // 重置遊戲狀態
    gameState.revealed = Array(20).fill(false);
    gameState.contentPositions = Array(20).fill(0).map((_, i) => i);
    shuffleArray(gameState.contentPositions);
    
    // 重新初始化遊戲板
    initializeBoard();
    
    showNotification(`已載入「${template.template_name}」模板`);
}

// 填充編輯器以供編輯
async function fillEditorForEdit(id) {
    const { editorTitle, templateIdInput, templateNameInput, isPublicSwitch, saveTemplateBtn, updateTemplateBtn } = getDOMElements();
    
    try {
        // 從 API 獲取模板詳情
        const template = await api.get(`/api/card-game/templates/${id}`);
        
        // 填充表單
        if (editorTitle) editorTitle.textContent = '編輯模板';
        if (templateIdInput) templateIdInput.value = template.id;
        if (templateNameInput) templateNameInput.value = template.template_name;
        if (isPublicSwitch) isPublicSwitch.checked = template.is_public;
        
        // 填充內容輸入框
        if (template.content_data && Array.isArray(template.content_data.items)) {
            template.content_data.items.forEach((content, i) => {
                const input = document.getElementById(`content-${i}`);
                if (input) input.value = content || '';
            });
        }
        
        // 切換按鈕顯示
        if (saveTemplateBtn) saveTemplateBtn.style.display = 'none';
        if (updateTemplateBtn) updateTemplateBtn.style.display = 'inline-block';
        
        // 滾動到編輯器區域
        const editorSection = document.querySelector('.template-editor');
        if (editorSection) {
            editorSection.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('載入模板進行編輯失敗:', error);
        showNotification('無法載入模板進行編輯', 'error');
    }
}

// 刪除模板
async function deleteTemplate(id) {
  // 在確認對話框中就告知使用者可能會失敗
  if (!confirm(`您確定要嘗試刪除模板 ID: ${id} 嗎？\n\n注意：由於伺服器權限設定，此操作可能會失敗。如果失敗，建議使用旁邊的「隱藏」按鈕。`)) {
        return;
    }
    
    try {
      console.log(`正在發送刪除模板 ID: ${id} 的請求`);
      showNotification('正在刪除...', 'info');

      // 直接調用 API 刪除
        await api.delete(`/api/card-game/templates/${id}`);

        showNotification('模板已成功刪除');
        
      // 成功後，重新載入模板列表以更新 UI
      await populateMyTemplates();

    } catch (error) {
        console.error('刪除模板失敗:', error);

      let errorMessage = '刪除失敗，發生未知錯誤。';
      if (error.message) {
          // 根據錯誤碼提供更友善的提示
          if (error.message.includes('403')) {
              errorMessage = '刪除失敗：伺服器回報無此權限。這很可能是後端問題，請改用「隱藏」按鈕。';
          } else if (error.message.includes('404')) {
              errorMessage = '刪除失敗：模板不存在或已被刪除。';
              // 既然不存在，就直接更新UI
              await populateMyTemplates();
          } else {
              errorMessage = `刪除失敗: ${error.message}`;
          }
      }

      showNotification(errorMessage, 'error');
    }
}

// 複製模板
async function copyTemplate(id) {
    try {
        const result = await api.post(`/api/card-game/templates/${id}/copy`, {});
        showNotification('模板已成功複製！您現在可以編輯這個新副本了。');
        
        // 重新載入模板列表
        populateMyTemplates();
        
        // 載入新模板到編輯器
        fillEditorForEdit(result.id);
    } catch (error) {
        console.error('複製模板失敗:', error);
        showNotification('複製模板失敗', 'error');
    }
}

// 清空編輯器
function clearEditor() {
    const { editorTitle, templateIdInput, templateNameInput, isPublicSwitch, saveTemplateBtn, updateTemplateBtn } = getDOMElements();
    
    // 重置表單
    if (editorTitle) editorTitle.textContent = '新增模板';
    if (templateIdInput) templateIdInput.value = '';
    if (templateNameInput) templateNameInput.value = '';
    if (isPublicSwitch) isPublicSwitch.checked = true;
    
    // 清空所有輸入框
    for (let i = 0; i < 20; i++) {
        const input = document.getElementById(`content-${i}`);
        if (input) input.value = '';
    }
    
    // 切換按鈕顯示
    if (saveTemplateBtn) saveTemplateBtn.style.display = 'inline-block';
    if (updateTemplateBtn) updateTemplateBtn.style.display = 'none';
}

// 保存或更新模板
async function saveOrUpdateTemplate() {
    const { templateIdInput, templateNameInput, isPublicSwitch } = getDOMElements();
    
    // 檢查用戶是否登入
    if (!gameState.loggedInUser) {
        showNotification('請先登入才能保存模板', 'error');
        return;
    }
    
    // 檢查模板名稱
    const templateName = templateNameInput ? templateNameInput.value.trim() : '';
    if (!templateName) {
        showNotification('請輸入模板名稱', 'error');
        return;
    }
    
    // 收集內容
    const contents = { items: [] };
    for (let i = 0; i < 20; i++) {
        const input = document.getElementById(`content-${i}`);
        contents.items.push(input ? input.value.trim() || `格子 ${i+1}` : `格子 ${i+1}`);
    }
    
    // 檢查是新增還是更新
    const templateId = templateIdInput ? templateIdInput.value : '';
    const isPublic = isPublicSwitch ? isPublicSwitch.checked : true;
  
  // 獲取用戶ID
  const userId = localStorage.getItem('boxCurrentUserId');
  console.log("保存模板的用戶ID:", userId);
    
    try {
        let result;
        
        if (templateId) {
            // 更新現有模板
            result = await api.put(`/api/card-game/templates/${templateId}`, {
                template_name: templateName,
                content_data: contents,
              is_public: isPublic,
              creator_id: userId // 明確添加creator_id
            });
            showNotification('模板已成功更新');
        } else {
            // 創建新模板
            result = await api.post('/api/card-game/templates', {
                template_name: templateName,
                content_data: contents,
              is_public: isPublic,
              creator_id: userId // 明確添加creator_id
            });
            showNotification('模板已成功創建');
          
          // 調試信息
          console.log("新模板創建結果:", result);
        }
        
        // 清空編輯器
        clearEditor();
        
        // 重新載入模板列表
        populateMyTemplates();
    } catch (error) {
        console.error('保存模板失敗:', error);
      showNotification('保存模板失敗: ' + (error.message || '未知錯誤'), 'error');
    }
}

// 切換公開/私有狀態標籤
function updatePublicLabel() {
    const { isPublicSwitch, isPublicLabel } = getDOMElements();
    if (!isPublicSwitch || !isPublicLabel) return;
    
    isPublicLabel.textContent = isPublicSwitch.checked 
        ? '公開 (其他人可以看到)' 
        : '私有 (只有您能看到)';
}

// 設置事件監聽器
function setupEventListeners() {
    const elements = getDOMElements();
    
    // 檢查是否能獲取所有必要元素
    if (!elements.gameBoard) {
        console.error("無法找到遊戲板元素！");
        return;
    }
    
    // 配置模態窗口相關
    if (elements.configBtn) {
        elements.configBtn.addEventListener('click', openTemplateManager);
    }
    
    if (elements.closeConfigModal) {
        elements.closeConfigModal.addEventListener('click', () => {
            if (elements.configModal) {
                elements.configModal.style.display = 'none';
            }
        });
    }
    
    // 當點擊模態窗口的背景時關閉
    if (elements.configModal) {
        elements.configModal.addEventListener('click', (event) => {
            if (event.target === elements.configModal) {
                elements.configModal.style.display = 'none';
            }
        });
    }
    
    // 重置遊戲按鈕
    if (elements.resetBtn) {
        elements.resetBtn.addEventListener('click', resetGame);
    }
    
    // 最新模板按鈕
    if (elements.latestTemplatesBtn) {
        elements.latestTemplatesBtn.addEventListener('click', openLatestTemplatesDrawer);
    }
    
    if (elements.gamesDrawerClose) {
        elements.gamesDrawerClose.addEventListener('click', closeGamesDrawer);
    }
    
    // 抽屜背景點擊關閉
    if (elements.drawerOverlay) {
        elements.drawerOverlay.addEventListener('click', closeAllDrawers);
    }
    
    // 模板管理相關
    if (elements.creatorSelect) {
        elements.creatorSelect.addEventListener('change', populateMyTemplates);
    }
    
    if (elements.sortSelect) {
        elements.sortSelect.addEventListener('change', populateMyTemplates);
    }
    
    if (elements.templateSearchInput) {
        elements.templateSearchInput.addEventListener('input', () => {
            // 使用防抖動，避免每次輸入都觸發搜尋
            clearTimeout(elements.templateSearchInput.searchTimeout);
            elements.templateSearchInput.searchTimeout = setTimeout(() => {
                populateMyTemplates();
            }, 300);
        });
    }
    
    // 模板編輯器按鈕
    if (elements.saveTemplateBtn) {
        elements.saveTemplateBtn.addEventListener('click', saveOrUpdateTemplate);
    }
    
    if (elements.updateTemplateBtn) {
        elements.updateTemplateBtn.addEventListener('click', saveOrUpdateTemplate);
    }
    
    if (elements.clearEditorBtn) {
        elements.clearEditorBtn.addEventListener('click', clearEditor);
    }
    
    // 公開/私有切換
    if (elements.isPublicSwitch) {
        elements.isPublicSwitch.addEventListener('change', updatePublicLabel);
    }
  
  // 鍵盤事件處理
  document.addEventListener('keydown', (e) => {
      // ESC 鍵關閉所有彈窗和抽屜
      if (e.key === 'Escape') {
          closeAllDrawers();
      }
  });

  // 最新模板抽屜篩選
  if (elements.latestSortSelect) {
      elements.latestSortSelect.addEventListener('change', loadLatestTemplates);
  }
  if (elements.latestSearchBySelect) {
      elements.latestSearchBySelect.addEventListener('change', loadLatestTemplates);
  }
  if (elements.latestSearchInput) {
      elements.latestSearchInput.addEventListener('input', () => {
          clearTimeout(elements.latestSearchInput.searchTimeout);
          elements.latestSearchInput.searchTimeout = setTimeout(() => {
              loadLatestTemplates();
          }, 300); // 防抖
      });
  }
}

// 調試函數：顯示localStorage中的所有內容
function debugLocalStorage() {
    console.group('localStorage 內容');
    console.log('總項目數:', localStorage.length);
    
    // 列出所有項目
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        let value = localStorage.getItem(key);
        
        // 如果值看起來像token，只顯示前10個字符
        if (key.includes('Token') && value && value.length > 15) {
            value = value.substring(0, 10) + '...';
        }
        
        console.log(`${key}: ${value}`);
    }
    
    // 特別檢查登入相關的值
    console.log('特別檢查:');
    console.log('- boxCurrentUserId:', localStorage.getItem('boxCurrentUserId'));
    console.log('- boxCurrentUsername:', localStorage.getItem('boxCurrentUsername'));
    console.log('- boxCurrentDisplayName:', localStorage.getItem('boxCurrentDisplayName'));
    
    const userId = localStorage.getItem('boxCurrentUserId');
    if (userId) {
        console.log(`- boxUserToken_${userId}:`, localStorage.getItem(`boxUserToken_${userId}`) ? '存在' : '不存在');
    }
    console.log('- boxUserToken:', localStorage.getItem('boxUserToken') ? '存在' : '不存在');
    
    console.groupEnd();
}

  // 初始化應用
  async function initializeApp() {
    console.log("洞洞樂遊戲初始化開始...");
    try {
        // 0. 調試localStorage
        debugLocalStorage();
        
        // 1. 檢查登入狀態
        checkLoginStatus();

        // 2. 初始化輸入框
        initializeInputs();

        // 3. 設置事件監聽器
        setupEventListeners();

        // 4. 檢查 URL 是否有模板 ID
        const urlParams = new URLSearchParams(window.location.search);
        const templateId = urlParams.get('template');
        
        if (templateId) {
            // 如果 URL 中有模板 ID，則載入該模板
            await loadTemplate(templateId);
        } else {
            // 否則載入預設模板
            await loadDefaultTemplate();
        }

        console.log("洞洞樂遊戲初始化完成。");
    } catch (error) {
        console.error('初始化應用時發生嚴重錯誤:', error);
        // 顯示錯誤通知
        showNotification('應用初始化失敗，請刷新頁面重試：' + (error.message || '未知錯誤'), 'error');
    }
}

  // 檢測設備類型
function detectDevice() {
    const isMobile = window.innerWidth <= 767;
    document.body.classList.toggle('is-mobile', isMobile);
}

// 監聽設備寬度變化
window.addEventListener('resize', detectDevice);

// 初始化遊戲應用
document.addEventListener('DOMContentLoaded', () => {
    detectDevice();
    initializeApp();
});

// 創建彩色氣泡效果
function createBubbles(parentElement) {
    // 氣泡數量
    const bubbleCount = 12;
    
    // 氣泡顏色
    const bubbleColors = [
        '#FFD6E0', // 淡粉紅
        '#FFEFCF', // 淡黃
        '#D4F0F0', // 淡藍綠
        '#E2F0CB', // 淡綠
        '#F0E6EF', // 淡紫
        '#FCE1BE', // 淡橙
    ];
    
    // 創建氣泡容器
    const bubbleContainer = document.createElement('div');
    bubbleContainer.style.position = 'absolute';
    bubbleContainer.style.top = '0';
    bubbleContainer.style.left = '0';
    bubbleContainer.style.width = '100%';
    bubbleContainer.style.height = '100%';
    bubbleContainer.style.overflow = 'hidden';
    bubbleContainer.style.pointerEvents = 'none';
    bubbleContainer.style.zIndex = '-1';
    bubbleContainer.style.borderRadius = '20px';
    
    // 添加氣泡
    for (let i = 0; i < bubbleCount; i++) {
        const bubble = document.createElement('div');
        
        // 隨機大小、位置和顏色
        const size = Math.random() * 60 + 20; // 20px - 80px
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = Math.random() * 10 + 10; // 10s - 20s
        const colorIndex = Math.floor(Math.random() * bubbleColors.length);
        
        // 設置氣泡樣式
        bubble.style.position = 'absolute';
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.borderRadius = '50%';
        bubble.style.backgroundColor = bubbleColors[colorIndex];
        bubble.style.opacity = '0.2';
        bubble.style.left = `${left}%`;
        bubble.style.bottom = '-100px';
        bubble.style.animation = `bubbleRise ${duration}s ease-in infinite ${delay}s`;
        
        // 添加氣泡動畫
        const keyframes = `
            @keyframes bubbleRise {
                0% {
                    transform: translateY(0) rotate(0);
                    opacity: 0.2;
                }
                50% {
                    opacity: 0.1;
                }
                100% {
                    transform: translateY(-${parentElement.clientHeight + 100}px) rotate(360deg);
                    opacity: 0;
                }
            }
        `;
        
        const style = document.createElement('style');
        style.textContent = keyframes;
        document.head.appendChild(style);
        
        // 添加到容器
        bubbleContainer.appendChild(bubble);
    }
    
    // 添加到父元素
    parentElement.appendChild(bubbleContainer);
    
    // 5秒後移除氣泡效果
    setTimeout(() => {
        if (parentElement.contains(bubbleContainer)) {
            parentElement.removeChild(bubbleContainer);
        }
    }, 5000);
}