// 洞洞樂遊戲 - 移除模板列表按鈕後的 JavaScript 文件

// 全局變量來緩存模板數據
let cachedTemplates = null;

// 遊戲狀態和默認內容
const gameState = {
    boardSize: {rows: 4, cols: 5},
    contents: Array(20).fill('').map((_, i) => `內容 ${i+1}`), // 編輯器的內容
    revealed: Array(20).fill(false),
    contentPositions: Array(20).fill(0).map((_, i) => i), // 內容位置映射 (用於隨機化)
    cardTimerId: null, // 計時器ID追蹤變數
};

// DOM 元素引用獲取函數 - 避免在DOM加載前嘗試獲取元素
function getDOMElements() {
    return {
        // 主要元素
        gameBoard: document.getElementById('gameBoard'),
        centeredCard: document.getElementById('centeredCard'),
        cardInner: document.getElementById('cardInner'),
        cardCloseBtn: document.querySelector('#centeredCard .card-close'),
        
        // 設置相關元素
        configModal: document.getElementById('configModal'),
        closeConfigModal: document.getElementById('closeConfigModal'),
        inputGrid: document.getElementById('inputGrid'),
        saveConfigBtn: document.getElementById('saveConfigBtn'),
        
        // 操作按鈕 (移除了 templatesBtn)
        configBtn: document.getElementById('configBtn'),
        resetBtn: document.getElementById('resetBtn'),
        allGamesBtn: document.getElementById('allGamesBtn'),
        
        // 移動端操作按鈕 (移除了 mobileTemplatesBtn)
        mobileConfigBtn: document.getElementById('mobileConfigBtn'),
        mobileResetBtn: document.getElementById('mobileResetBtn'),
        shareBtn: document.getElementById('shareBtn'),
        gameControls: document.getElementById('gameControls'),
        // controlsToggle 已從這裡移除
        
        // 模板管理元素 (保留以避免函數錯誤)
        templateSelect: document.getElementById('templateSelect'),
        templateNameInput: document.getElementById('templateNameInput'),
        saveTemplateBtn: document.getElementById('saveTemplateBtn'),
        loadTemplateBtn: document.getElementById('loadTemplateBtn'),
        deleteTemplateBtn: document.getElementById('deleteTemplateBtn'),
        
        // 模板抽屜元素 (保留以避免函數錯誤)
        templateDrawer: document.getElementById('templateDrawer'),
        templateDrawerClose: document.getElementById('templateDrawerClose'),
        templateDrawerContent: document.getElementById('templateDrawerContent'),
        
        // 遊戲抽屜元素
        gamesDrawer: document.getElementById('gamesDrawer'),
        gamesDrawerClose: document.getElementById('gamesDrawerClose'),
        gamesGrid: document.getElementById('gamesGrid'),
        
        // 抽屜背景遮罩
        drawerOverlay: document.getElementById('drawerOverlay')
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
        input.value = gameState.contents[i] || ''; // 如果內容為空，顯示空字串
        input.placeholder = `格子 ${i+1} 內容`;
        
        // 添加輸入框動畫效果
        input.style.opacity = '0';
        input.style.transform = 'translateX(-10px)';
        
        // 延遲顯示每個輸入框，創建淡入效果
        setTimeout(() => {
            input.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            input.style.opacity = '1';
            input.style.transform = 'translateX(0)';
        }, 30 * i);

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

    // 更新遊戲板上顯示的內容
    updateBoardContent();

    if(configModal) configModal.style.display = 'none';
    
    // 顯示保存成功的提示，帶動畫效果
    showNotification('設置已成功保存！');
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
    notification.style.padding = '10px 20px';
    notification.style.background = type === 'success' ? '#4CAF50' : '#F44336';
    notification.style.color = 'white';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.style.zIndex = '9999';
    notification.style.transition = 'transform 0.3s ease-out';
    
    // 添加到頁面
    document.body.appendChild(notification);
    
    // 強制reflow觸發動畫
    void notification.offsetWidth;
    
    // 顯示通知
    notification.style.transform = 'translateX(-50%) translateY(0)';
    
    // 3秒後淡出
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(-100px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);

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

    // 關閉所有可能打開的抽屜
    closeAllDrawers();
    
    // 顯示重置成功的提示
    showNotification('遊戲已重置！');
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

// 打開控制面板 - 移除控制面板切換功能
function toggleControlPanel() {
    const { gameControls } = getDOMElements();
    if (!gameControls) return;

    // 始終顯示控制面板
    gameControls.classList.add('visible');
}

// 打開模板抽屜 (保留函數但不再實際使用)
function openTemplateDrawer() {
    console.log("模板列表功能已移除");
    showNotification('模板列表功能已移除', 'error');
}

// 關閉模板抽屜 (保留函數但不再實際使用)
function closeTemplateDrawer() {
    const { templateDrawer, drawerOverlay } = getDOMElements();
    if (!templateDrawer) return;

    templateDrawer.classList.remove('open');
    if (!document.querySelector('.games-drawer.open')) {
        drawerOverlay.classList.remove('visible');
        document.body.style.overflow = ''; // 恢復滾動
    }
}

// 打開遊戲抽屜
function openGamesDrawer() {
    const { gamesDrawer, drawerOverlay } = getDOMElements();
    if (!gamesDrawer || !drawerOverlay) return;

    // 關閉其他抽屜
    closeTemplateDrawer();
    
    // 加載遊戲列表
    loadGames();
    
    // 打開抽屜
    gamesDrawer.classList.add('open');
    drawerOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden'; // 防止背景滾動
}

// 關閉遊戲抽屜
function closeGamesDrawer() {
    const { gamesDrawer, drawerOverlay } = getDOMElements();
    if (!gamesDrawer) return;

    gamesDrawer.classList.remove('open');
    if (!document.querySelector('.template-drawer.open')) {
        drawerOverlay.classList.remove('visible');
        document.body.style.overflow = ''; // 恢復滾動
    }
}

// 關閉所有抽屜
function closeAllDrawers() {
    closeTemplateDrawer();
    closeGamesDrawer();
    
    // 關閉控制面板
    const { gameControls } = getDOMElements();
    if (gameControls && gameControls.classList.contains('visible')) {
        gameControls.classList.remove('visible');
    }
    
    // 關閉模態窗口
    const { configModal } = getDOMElements();
    if (configModal) configModal.style.display = 'none';
}

// 分享遊戲
function shareGame() {
    // 檢查是否支持 Web Share API
    if (navigator.share) {
        navigator.share({
            title: 'SunnyYummy 洞洞樂遊戲',
            text: '來玩 SunnyYummy 的洞洞樂遊戲！',
            url: window.location.href,
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
        prompt('複製此網址分享給朋友:', window.location.href);
        showNotification('網址已準備好，請手動複製！');
    }
}

// 從服務器加載所有模板 (保留但不再使用)
async function loadTemplates() {
    console.log("模板功能已移除，此函數不再使用");
    return [];
}

// 加載遊戲列表到抽屜
async function loadGames() {
    const { gamesGrid } = getDOMElements();
    if (!gamesGrid) return;
    
    // 顯示加載中
    gamesGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;">正在加載遊戲列表...</div>';
    
    try {
        // 從 API 獲取遊戲列表
        const response = await fetch('/api/games');
        if (!response.ok) {
            throw new Error(`獲取遊戲列表失敗：HTTP ${response.status}`);
        }
        
        const games = await response.json();
        
        // 清空容器
        gamesGrid.innerHTML = '';
        
        if (!games || games.length === 0) {
            gamesGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;">暫無遊戲，敬請期待！</div>';
            return;
        }
        
        // 創建遊戲卡片
        games.forEach((game, index) => {
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            gameCard.style.opacity = '0';
            gameCard.style.transform = 'translateY(20px)';
            
            gameCard.innerHTML = `
                <img src="${game.image_url || '/images/placeholder.png'}" alt="${game.title}" class="game-image">
                <div class="game-info">
                    <h3 class="game-title">${game.title}</h3>
                    <p class="game-description">${game.description || '暫無描述'}</p>
                </div>
            `;
            
            // 點擊卡片跳轉到遊戲頁面
            gameCard.addEventListener('click', () => {
                window.location.href = game.play_url || '/games.html';
            });
            
            gamesGrid.appendChild(gameCard);
            
            // 添加動畫效果，延遲顯示
            setTimeout(() => {
                gameCard.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                gameCard.style.opacity = '1';
                gameCard.style.transform = 'translateY(0)';
            }, 50 * index);
        });
        
    } catch (error) {
        console.error('加載遊戲列表失敗:', error);
        gamesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #e53935;">
                加載遊戲列表失敗：${error.message}
                <br><br>
                <button onclick="loadGames()" style="padding: 8px 16px; background-color: #4fc3f7; color: white; border: none; border-radius: 4px; cursor: pointer;">重試</button>
            </div>
        `;
    }
}

// 設置事件監聽器 - 移除齒輪按鈕相關的監聽器
function setupEventListeners() {
    const elements = getDOMElements();
    
    // 檢查是否能獲取所有必要元素
    if (!elements.gameBoard) {
        console.error("無法找到遊戲板元素！");
        return;
    }
    
    // 配置模態窗口相關
    if (elements.configBtn) {
        elements.configBtn.addEventListener('click', () => {
            if (elements.configModal) {
                initializeInputs(); // 初始化輸入框
                elements.configModal.style.display = 'block';
            }
        });
    }
    
    if (elements.mobileConfigBtn) {
        elements.mobileConfigBtn.addEventListener('click', () => {
            if (elements.configModal) {
                initializeInputs();
                elements.configModal.style.display = 'block';
                if (elements.gameControls) {
                    elements.gameControls.classList.remove('visible');
                }
            }
        });
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
    
    // 保存配置按鈕
    if (elements.saveConfigBtn) {
        elements.saveConfigBtn.addEventListener('click', saveConfig);
    }
    
    // 重置遊戲按鈕
    if (elements.resetBtn) {
        elements.resetBtn.addEventListener('click', resetGame);
    }
    
    if (elements.mobileResetBtn) {
        elements.mobileResetBtn.addEventListener('click', () => {
            resetGame();
            if (elements.gameControls) {
                elements.gameControls.classList.remove('visible');
            }
        });
    }
    
    // 全部遊戲按鈕
    if (elements.allGamesBtn) {
        elements.allGamesBtn.addEventListener('click', openGamesDrawer);
    }
    
    if (elements.gamesDrawerClose) {
        elements.gamesDrawerClose.addEventListener('click', closeGamesDrawer);
    }
    
    // 抽屜背景點擊關閉
    if (elements.drawerOverlay) {
        elements.drawerOverlay.addEventListener('click', closeAllDrawers);
    }
    
    // 分享按鈕
    if (elements.shareBtn) {
        elements.shareBtn.addEventListener('click', () => {
            shareGame();
            if (elements.gameControls) {
                elements.gameControls.classList.remove('visible');
            }
        });
    }
    
    // 鍵盤事件處理
    document.addEventListener('keydown', (e) => {
        // ESC 鍵關閉所有彈窗和抽屜
        if (e.key === 'Escape') {
            closeAllDrawers();
        }
    });
}

// 初始化應用 - 移除齒輪按鈕
function initializeApp() {
    console.log("洞洞樂遊戲初始化開始...");
    try {
        // 1. 設置初始內容
        setExampleContent();

        // 2. 初始隨機排列內容位置
        shuffleArray(gameState.contentPositions);

        // 3. 初始化遊戲板
        initializeBoard();

        // 4. 設置事件監聽器
        setupEventListeners();

        // 5. 顯示控制按鈕 (移動設備上始終顯示控制面板)
        const { gameControls } = getDOMElements();
        if (gameControls) {
            // 始終顯示控制面板
            gameControls.classList.add('visible');
        }

        console.log("洞洞樂遊戲初始化完成。");
    } catch (error) {
        console.error('初始化應用時發生嚴重錯誤:', error);
        // 顯示錯誤通知
        showNotification('應用初始化失敗，請刷新頁面重試：' + error.message, 'error');
    }
}

// 檢測設備類型 (移除齒輪按鈕相關代碼)
function detectDevice() {
    const isMobile = window.innerWidth <= 767;
    document.body.classList.toggle('is-mobile', isMobile);
    
    // 根據設備類型調整控制面板
    const { gameControls } = getDOMElements();
    if (gameControls) {
        // 無論移動還是桌面設備，始終顯示控制面板
        gameControls.classList.add('visible');
    }
}

// 監聽設備寬度變化
window.addEventListener('resize', detectDevice);

// 初始化遊戲應用
document.addEventListener('DOMContentLoaded', () => {
    detectDevice();
    initializeApp();
});