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

// 打開控制面板
function toggleControlPanel() {
    const { gameControls, controlsToggle } = getDOMElements();
    if (!gameControls || !controlsToggle) return;

    if (gameControls.classList.contains('visible')) {
        gameControls.classList.remove('visible');
        controlsToggle.textContent = '⚙️';
    } else {
        gameControls.classList.add('visible');
        controlsToggle.textContent = '✖';
    }
}

// 打開模板抽屜
function openTemplateDrawer() {
    const { templateDrawer, drawerOverlay } = getDOMElements();
    if (!templateDrawer || !drawerOverlay) return;

    // 關閉其他抽屜
    closeGamesDrawer();
    
    // 更新模板列表
    updateTemplateDrawerContent();
    
    // 打開抽屜
    templateDrawer.classList.add('open');
    drawerOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden'; // 防止背景滾動
}

// 關閉模板抽屜
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
    const { gameControls, controlsToggle } = getDOMElements();
    if (gameControls && gameControls.classList.contains('visible')) {
        gameControls.classList.remove('visible');
        if (controlsToggle) controlsToggle.textContent = '⚙️';
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

// 從服務器加載所有模板
async function loadTemplates() {
    console.log("正在從 API 加載模板...");
    try {
        const response = await fetch('/api/card-game/templates');
        if (!response.ok) {
            // 嘗試獲取錯誤消息
            let errorMsg = `無法加載模板: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (parseError) {
                // 忽略，如果響應體不是 JSON 或為空
            }
            throw new Error(errorMsg);
        }
        const templates = await response.json(); // API 返回 {id, template_name, content_data, ...}[]
        console.log("從 API 成功加載模板:", templates);
        cachedTemplates = templates; // 直接緩存 API 返回的數組
        return templates;
    } catch (error) {
        console.error('從 API 加載模板失敗:', error);
        // 如果是第一次加載失敗，顯示提示
        if (!cachedTemplates) {
            showNotification('無法從服務器加載模板，將使用本地數據。', 'error');
            // 創建空數組作為緩存
            cachedTemplates = [];
        }
        return cachedTemplates || []; // 返回空數組表示失敗或無數據
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

// 更新模板抽屜內容
async function updateTemplateDrawerContent() {
    const { templateDrawerContent } = getDOMElements();
    if (!templateDrawerContent) return;
    
    // 顯示加載指示器
    templateDrawerContent.innerHTML = '<div style="text-align: center; padding: 20px;">正在加載模板列表...</div>';
    
    // 加載模板數據
    if (!cachedTemplates) {
        await loadTemplates();
    }
    
    // 清空容器
    templateDrawerContent.innerHTML = '';
    
    // 添加"全部"按鈕
    const allButton = document.createElement('button');
    allButton.textContent = '全部模板';
    allButton.classList.add('template-drawer-btn', 'active');
    allButton.onclick = () => {
        // 設置所有模板按鈕為活動
        document.querySelectorAll('.template-drawer-btn').forEach(btn => btn.classList.remove('active'));
        allButton.classList.add('active');
        
        // 這裡可以添加篩選功能，目前只顯示所有模板
        showNotification('顯示所有模板');
    };
    templateDrawerContent.appendChild(allButton);
    
    // 如果沒有模板，顯示提示
    if (!cachedTemplates || cachedTemplates.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.gridColumn = '1 / -1';
        emptyMessage.style.padding = '20px';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = '#666';
        emptyMessage.textContent = '目前沒有保存的模板。點擊"自定義內容"創建新模板！';
        templateDrawerContent.appendChild(emptyMessage);
        return;
    }
    
    // 添加每個模板按鈕
    cachedTemplates.forEach(template => {
        if (!template.template_name) return;
        
        const templateBtn = document.createElement('button');
        templateBtn.textContent = template.template_name;
        templateBtn.classList.add('template-drawer-btn');
        templateBtn.dataset.id = template.id;
        
        // 點擊加載該模板
        templateBtn.onclick = () => {
            document.querySelectorAll('.template-drawer-btn').forEach(btn => btn.classList.remove('active'));
            templateBtn.classList.add('active');
            
            // 加載該模板
            loadTemplateById(template.id, template.template_name, template.content_data);
            
            // 關閉抽屜
            closeTemplateDrawer();
        };
        
        templateDrawerContent.appendChild(templateBtn);
    });
}

// 清除模板緩存
function clearTemplateCache() {
    cachedTemplates = null;
    console.log("模板緩存已清除。");
}

// 保存當前內容為模板
async function saveCurrentAsTemplate() {
    const { templateNameInput } = getDOMElements();
    const templateName = templateNameInput.value.trim();

    // 1. 驗證名稱
    if (!templateName) {
        showNotification('請輸入模板名稱！', 'error');
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
            showNotification(`模板 "${templateName}" 已成功保存！`);
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
            showNotification(`保存模板失敗: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('保存模板時發生錯誤:', error);
        showNotification(`保存模板時出錯: ${error.message}`, 'error');
    }
}

// 從模板載入內容 (使用下拉選單的 data-* 屬性)
async function loadSelectedTemplate() {
    const { templateSelect } = getDOMElements();
    const selectedOption = templateSelect.options[templateSelect.selectedIndex];

    if (!selectedOption || !selectedOption.value) {
        showNotification('請選擇一個模板！', 'error');
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
            showNotification(`已成功載入模板 "${templateName}"！`);
        } else {
            showNotification(`無法載入模板 "${templateName}" 的內容！請嘗試重新加載頁面。`, 'error');
        }
        return;
    }

    try {
        const templateContent = JSON.parse(contentString); // 解析 JSON 字符串
        loadContentToInputs(templateContent); // 調用輔助函數填充輸入框
        showNotification(`已成功載入模板 "${templateName}"！`);
    } catch (error) {
        console.error(`解析模板 "${templateName}" (ID: ${templateId}) 內容時出錯:`, error);
        showNotification(`載入模板 "${templateName}" 失敗：內容格式錯誤。`, 'error');
    }
}

// 根據ID載入模板
function loadTemplateById(templateId, templateName, contentData) {
    if (!templateId) {
        showNotification('無效的模板ID', 'error');
        return;
    }
    
    try {
        // 將內容數據填入輸入框
        loadContentToInputs(contentData);
        showNotification(`已成功載入模板 "${templateName}"！`);
        
        // 打開配置模式窗
        const { configModal, templateNameInput } = getDOMElements();
        if (configModal) {
            configModal.style.display = 'block';
        }
        
        // 設置模板名稱輸入框
        if (templateNameInput) {
            templateNameInput.value = templateName;
        }
    } catch (error) {
        console.error(`載入模板 "${templateName}" (ID: ${templateId}) 時出錯:`, error);
        showNotification(`載入模板失敗：${error.message}`, 'error');
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
        showNotification('請選擇一個要刪除的模板！', 'error');
        return;
    }

    const templateName = selectedOption.value;
    const templateId = selectedOption.dataset.id; // **獲取模板 ID**

    if (!templateId) {
        showNotification('無法獲取模板 ID，無法刪除。', 'error');
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
            showNotification(`模板 "${templateName}" 已刪除！`);
            clearTemplateCache(); // 清除緩存
            await updateTemplateSelect(); // 更新下拉列表
            await updateTemplateDrawerContent(); // 更新抽屜內容
        } else if (response.status === 404) {
            console.warn(`嘗試刪除模板 ID ${templateId} 失敗：未找到。`);
            showNotification(`刪除模板 "${templateName}" 失敗：在服務器上找不到該模板。可能已被其他人刪除。`, 'error');
            clearTemplateCache(); // 清除緩存並刷新列表
            await updateTemplateSelect();
            await updateTemplateDrawerContent();
        } else {
            // 其他錯誤
            let errorMsg = `刪除模板失敗: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) { /* ignore */ }
            console.error('刪除模板失敗:', response.status, errorMsg);
            showNotification(`刪除模板 "${templateName}" 失敗: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('刪除模板時發生網絡錯誤:', error);
        showNotification(`刪除模板時出錯: ${error.message}`, 'error');
    }
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
        elements.configBtn.addEventListener('click', () => {
            if (elements.configModal) {
                initializeInputs(); // 初始化輸入框
                updateTemplateSelect(); // 更新模板下拉列表
                elements.configModal.style.display = 'block';
            }
        });
    }
    
    if (elements.mobileConfigBtn) {
        elements.mobileConfigBtn.addEventListener('click', () => {
            if (elements.configModal) {
                initializeInputs();
                updateTemplateSelect();
                elements.configModal.style.display = 'block';
                if (elements.gameControls) {
                    elements.gameControls.classList.remove('visible');
                }
                if (elements.controlsToggle) {
                    elements.controlsToggle.textContent = '⚙️';
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
            if (elements.controlsToggle) {
                elements.controlsToggle.textContent = '⚙️';
            }
        });
    }
    
    // 模板相關按鈕
    if (elements.templatesBtn) {
        elements.templatesBtn.addEventListener('click', openTemplateDrawer);
    }
    
    if (elements.mobileTemplatesBtn) {
        elements.mobileTemplatesBtn.addEventListener('click', () => {
            openTemplateDrawer();
            if (elements.gameControls) {
                elements.gameControls.classList.remove('visible');
            }
            if (elements.controlsToggle) {
                elements.controlsToggle.textContent = '⚙️';
            }
        });
    }
    
    if (elements.templateDrawerClose) {
        elements.templateDrawerClose.addEventListener('click', closeTemplateDrawer);
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
    
    // 控制面板開關
    if (elements.controlsToggle) {
        elements.controlsToggle.addEventListener('click', toggleControlPanel);
    }
    
    // 分享按鈕
    if (elements.shareBtn) {
        elements.shareBtn.addEventListener('click', () => {
            shareGame();
            if (elements.gameControls) {
                elements.gameControls.classList.remove('visible');
            }
            if (elements.controlsToggle) {
                elements.controlsToggle.textContent = '⚙️';
            }
        });
    }
    
    // 模板管理相關按鈕
    if (elements.saveTemplateBtn) {
        elements.saveTemplateBtn.addEventListener('click', saveCurrentAsTemplate);
    }
    
    if (elements.loadTemplateBtn) {
        elements.loadTemplateBtn.addEventListener('click', loadSelectedTemplate);
    }
    
    if (elements.deleteTemplateBtn) {
        elements.deleteTemplateBtn.addEventListener('click', deleteSelectedTemplate);
    }
    
    // 鍵盤事件處理
    document.addEventListener('keydown', (e) => {
        // ESC 鍵關閉所有彈窗和抽屜
        if (e.key === 'Escape') {
            closeAllDrawers();
        }
    });
}

// 初始化應用
async function initializeApp() {
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

        // 5. 預加載模板數據
        await loadTemplates();

        // 6. 顯示控制按鈕
        const { gameControls } = getDOMElements();
        if (gameControls && window.innerWidth <= 767) {
            // 在移動設備上顯示切換按鈕，但不立即顯示控制面板
            const { controlsToggle } = getDOMElements();
            if (controlsToggle) {
                controlsToggle.style.display = 'flex';
            }
        } else if (gameControls) {
            // 在桌面顯示控制面板
            gameControls.classList.add('visible');
        }

        console.log("洞洞樂遊戲初始化完成。");
    } catch (error) {
        console.error('初始化應用時發生嚴重錯誤:', error);
        // 顯示錯誤通知
        showNotification('應用初始化失敗，請刷新頁面重試：' + error.message, 'error');
    }
}

// 檢測設備類型
function detectDevice() {
    const isMobile = window.innerWidth <= 767;
    document.body.classList.toggle('is-mobile', isMobile);
    
    // 根據設備類型調整控制面板
    const { gameControls, controlsToggle } = getDOMElements();
    if (gameControls) {
        if (isMobile) {
            // 移動設備上隱藏控制面板，顯示切換按鈕
            gameControls.classList.remove('visible');
            if (controlsToggle) {
                controlsToggle.style.display = 'flex';
            }
        } else {
            // 桌面設備上顯示控制面板，隱藏切換按鈕
            gameControls.classList.add('visible');
            if (controlsToggle) {
                controlsToggle.style.display = 'none';
            }
        }
    }
}

// 監聽設備寬度變化
window.addEventListener('resize', detectDevice);

// 初始化遊戲應用
document.addEventListener('DOMContentLoaded', () => {
    detectDevice();
    initializeApp();
});// 洞洞樂遊戲 - 重新設計的 JavaScript 文件

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
        
        // 操作按鈕
        configBtn: document.getElementById('configBtn'),
        templatesBtn: document.getElementById('templatesBtn'),
        resetBtn: document.getElementById('resetBtn'),
        allGamesBtn: document.getElementById('allGamesBtn'),
        
        // 移動端操作按鈕
        mobileConfigBtn: document.getElementById('mobileConfigBtn'),
        mobileTemplatesBtn: document.getElementById('mobileTemplatesBtn'),
        mobileResetBtn: document.getElementById('mobileResetBtn'),
        shareBtn: document.getElementById('shareBtn'),
        controlsToggle: document.getElementById('controlsToggle'),
        gameControls: document.getElementById('gameControls'),
        
        // 模板管理元素
        templateSelect: document.getElementById('templateSelect'),
        templateNameInput: document.getElementById('templateNameInput'),
        saveTemplateBtn: document.getElementById('saveTemplateBtn'),
        loadTemplateBtn: document.getElementById('loadTemplateBtn'),
        deleteTemplateBtn: document.getElementById('deleteTemplateBtn'),
        
        // 模板抽屜元素
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

// 打開控制面板
function toggleControlPanel() {
    const { gameControls, controlsToggle } = getDOMElements();
    if (!gameControls || !controlsToggle) return;

    if (gameControls.classList.contains('visible')) {
        gameControls.classList.remove('visible');
        controlsToggle.textContent = '⚙️';
    } else {
        gameControls.classList.add('visible');
        controlsToggle.textContent = '✖';
    }
}

// 打開模板抽屜
function openTemplateDrawer() {
    const { templateDrawer, drawerOverlay } = getDOMElements();
    if (!templateDrawer || !drawerOverlay) return;

    // 關閉其他抽屜
    closeGamesDrawer();
    
    // 更新模板列表
    updateTemplateDrawerContent();
    
    // 打開抽屜
    templateDrawer.classList.add('open');
    drawerOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden'; // 防止背景滾動
}

// 關閉模板抽屜
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
    const { gameControls, controlsToggle } = getDOMElements();
    if (gameControls && gameControls.classList.contains('visible')) {
        gameControls.classList.remove('visible');
        if (controlsToggle) controlsToggle.textContent = '⚙️';
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

// 從服務器加載所有模板
async function loadTemplates() {
    console.log("正在從 API 加載模板...");
    try {
        const response = await fetch('/api/card-game/templates');
        if (!response.ok) {
            // 嘗試獲取錯誤消息
            let errorMsg = `無法加載模板: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (parseError) {
                // 忽略，如果響應體不是 JSON 或為空
            }
            throw new Error(errorMsg);
        }
        const templates = await response.json(); // API 返回 {id, template_name, content_data, ...}[]
        console.log("從 API 成功加載模板:", templates);
        cachedTemplates = templates; // 直接緩存 API 返回的數組
        return templates;
    } catch (error) {
        console.error('從 API 加載模板失敗:', error);
        // 如果是第一次加載失敗，顯示提示
        if (!cachedTemplates) {
            showNotification('無法從服務器加載模板，將使用本地數據。', 'error');
            // 創建空數組作為緩存
            cachedTemplates = [];
        }
        return cachedTemplates || []; // 返回空數組表示失敗或無數據
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

// 更新模板抽屜內容
async function updateTemplateDrawerContent() {
    const { templateDrawerContent } = getDOMElements();
    if (!templateDrawerContent) return;
    
    // 顯示加載指示器
    templateDrawerContent.innerHTML = '<div style="text-align: center; padding: 20px;">正在加載模板列表...</div>';
    
    // 加載模板數據
    if (!cachedTemplates) {
        await loadTemplates();
    }
    
    // 清空容器
    templateDrawerContent.innerHTML = '';
    
    // 添加"全部"按鈕
    const allButton = document.createElement('button');
    allButton.textContent = '全部模板';
    allButton.classList.add('template-drawer-btn', 'active');
    allButton.onclick = () => {
        // 設置所有模板按鈕為活動
        document.querySelectorAll('.template-drawer-btn').forEach(btn => btn.classList.remove('active'));
        allButton.classList.add('active');
        
        // 這裡可以添加篩選功能，目前只顯示所有模板
        showNotification('顯示所有模板');
    };
    templateDrawerContent.appendChild(allButton);
    
    // 如果沒有模板，顯示提示
    if (!cachedTemplates || cachedTemplates.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.gridColumn = '1 / -1';
        emptyMessage.style.padding = '20px';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = '#666';
        emptyMessage.textContent = '目前沒有保存的模板。點擊"自定義內容"創建新模板！';
        templateDrawerContent.appendChild(emptyMessage);
        return;
    }
    
    // 添加每個模板按鈕
    cachedTemplates.forEach(template => {
        if (!template.template_name) return;
        
        const templateBtn = document.createElement('button');
        templateBtn.textContent = template.template_name;
        templateBtn.classList.add('template-drawer-btn');
        templateBtn.dataset.id = template.id;
        
        // 點擊加載該模板
        templateBtn.onclick = () => {
            document.querySelectorAll('.template-drawer-btn').forEach(btn => btn.classList.remove('active'));
            templateBtn.classList.add('active');
            
            // 加載該模板
            loadTemplateById(template.id, template.template_name, template.content_data);
            
            // 關閉抽屜
            closeTemplateDrawer();
        };
        
        templateDrawerContent.appendChild(templateBtn);
    });
}

// 清除模板緩存
function clearTemplateCache() {
    cachedTemplates = null;
    console.log("模板緩存已清除。");
}

// 保存當前內容為模板
async function saveCurrentAsTemplate() {
    const { templateNameInput } = getDOMElements();
    const templateName = templateNameInput.value.trim();

    // 1. 驗證名稱
    if (!templateName) {
        showNotification('請輸入模板名稱！', 'error');
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
            showNotification(`模板 "${templateName}" 已成功保存！`);
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
            showNotification(`保存模板失敗: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('保存模板時發生錯誤:', error);
        showNotification(`保存模板時出錯: ${error.message}`, 'error');
    }
}

// 從模板載入內容 (使用下拉選單的 data-* 屬性)
async function loadSelectedTemplate() {
    const { templateSelect } = getDOMElements();
    const selectedOption = templateSelect.options[templateSelect.selectedIndex];

    if (!selectedOption || !selectedOption.value) {
        showNotification('請選擇一個模板！', 'error');
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
            showNotification(`已成功載入模板 "${templateName}"！`);
        } else {
            showNotification(`無法載入模板 "${templateName}" 的內容！請嘗試重新加載頁面。`, 'error');
        }
        return;
    }

    try {
        const templateContent = JSON.parse(contentString); // 解析 JSON 字符串
        loadContentToInputs(templateContent); // 調用輔助函數填充輸入框
        showNotification(`已成功載入模板 "${templateName}"！`);
    } catch (error) {
        console.error(`解析模板 "${templateName}" (ID: ${templateId}) 內容時出錯:`, error);
        showNotification(`載入模板 "${templateName}" 失敗：內容格式錯誤。`, 'error');
    }
}

// 根據ID載入模板
function loadTemplateById(templateId, templateName, contentData) {
    if (!templateId) {
        showNotification('無效的模板ID', 'error');
        return;
    }
    
    try {
        // 將內容數據填入輸入框
        loadContentToInputs(contentData);
        showNotification(`已成功載入模板 "${templateName}"！`);


        // 打開配置模式窗
        const { configModal, templateNameInput } = getDOMElements();
        if (configModal) {
            configModal.style.display = 'block';
        }
        
        // 設置模板名稱輸入框
        if (templateNameInput) {
            templateNameInput.value = templateName;
        }
    } catch (error) {
        console.error(`載入模板 "${templateName}" (ID: ${templateId}) 時出錯:`, error);
        showNotification(`載入模板失敗：${error.message}`, 'error');
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
        showNotification('請選擇一個要刪除的模板！', 'error');
        return;
    }

    const templateName = selectedOption.value;
    const templateId = selectedOption.dataset.id; // **獲取模板 ID**

    if (!templateId) {
        showNotification('無法獲取模板 ID，無法刪除。', 'error');
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
            showNotification(`模板 "${templateName}" 已刪除！`);
            clearTemplateCache(); // 清除緩存
            await updateTemplateSelect(); // 更新下拉列表
            await updateTemplateDrawerContent(); // 更新抽屜內容
        } else if (response.status === 404) {
            console.warn(`嘗試刪除模板 ID ${templateId} 失敗：未找到。`);
            showNotification(`刪除模板 "${templateName}" 失敗：在服務器上找不到該模板。可能已被其他人刪除。`, 'error');
            clearTemplateCache(); // 清除緩存並刷新列表
            await updateTemplateSelect();
            await updateTemplateDrawerContent();
        } else {
            // 其他錯誤
            let errorMsg = `刪除模板失敗: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) { /* ignore */ }
            console.error('刪除模板失敗:', response.status, errorMsg);
            showNotification(`刪除模板 "${templateName}" 失敗: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('刪除模板時發生網絡錯誤:', error);
        showNotification(`刪除模板時出錯: ${error.message}`, 'error');
    }
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
        elements.configBtn.addEventListener('click', () => {
            if (elements.configModal) {
                initializeInputs(); // 初始化輸入框
                updateTemplateSelect(); // 更新模板下拉列表
                elements.configModal.style.display = 'block';
            }
        });
    }
    
    if (elements.mobileConfigBtn) {
        elements.mobileConfigBtn.addEventListener('click', () => {
            if (elements.configModal) {
                initializeInputs();
                updateTemplateSelect();
                elements.configModal.style.display = 'block';
                if (elements.gameControls) {
                    elements.gameControls.classList.remove('visible');
                }
                if (elements.controlsToggle) {
                    elements.controlsToggle.textContent = '⚙️';
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
            if (elements.controlsToggle) {
                elements.controlsToggle.textContent = '⚙️';
            }
        });
    }
    
    // 模板相關按鈕
    if (elements.templatesBtn) {
        elements.templatesBtn.addEventListener('click', openTemplateDrawer);
    }
    
    if (elements.mobileTemplatesBtn) {
        elements.mobileTemplatesBtn.addEventListener('click', () => {
            openTemplateDrawer();
            if (elements.gameControls) {
                elements.gameControls.classList.remove('visible');
            }
            if (elements.controlsToggle) {
                elements.controlsToggle.textContent = '⚙️';
            }
        });
    }
    
    if (elements.templateDrawerClose) {
        elements.templateDrawerClose.addEventListener('click', closeTemplateDrawer);
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
    
    // 控制面板開關
    if (elements.controlsToggle) {
        elements.controlsToggle.addEventListener('click', toggleControlPanel);
    }
    
    // 分享按鈕
    if (elements.shareBtn) {
        elements.shareBtn.addEventListener('click', () => {
            shareGame();
            if (elements.gameControls) {
                elements.gameControls.classList.remove('visible');
            }
            if (elements.controlsToggle) {
                elements.controlsToggle.textContent = '⚙️';
            }
        });
    }
    
    // 模板管理相關按鈕
    if (elements.saveTemplateBtn) {
        elements.saveTemplateBtn.addEventListener('click', saveCurrentAsTemplate);
    }
    
    if (elements.loadTemplateBtn) {
        elements.loadTemplateBtn.addEventListener('click', loadSelectedTemplate);
    }
    
    if (elements.deleteTemplateBtn) {
        elements.deleteTemplateBtn.addEventListener('click', deleteSelectedTemplate);
    }
    
    // 鍵盤事件處理
    document.addEventListener('keydown', (e) => {
        // ESC 鍵關閉所有彈窗和抽屜
        if (e.key === 'Escape') {
            closeAllDrawers();
        }
    });
}

// 初始化應用
async function initializeApp() {
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

        // 5. 預加載模板數據
        await loadTemplates();

        // 6. 顯示控制按鈕
        const { gameControls } = getDOMElements();
        if (gameControls && window.innerWidth <= 767) {
            // 在移動設備上顯示切換按鈕，但不立即顯示控制面板
            const { controlsToggle } = getDOMElements();
            if (controlsToggle) {
                controlsToggle.style.display = 'flex';
            }
        } else if (gameControls) {
            // 在桌面顯示控制面板
            gameControls.classList.add('visible');
        }

        console.log("洞洞樂遊戲初始化完成。");
    } catch (error) {
        console.error('初始化應用時發生嚴重錯誤:', error);
        // 顯示錯誤通知
        showNotification('應用初始化失敗，請刷新頁面重試：' + error.message, 'error');
    }
}

// 檢測設備類型
function detectDevice() {
    const isMobile = window.innerWidth <= 767;
    document.body.classList.toggle('is-mobile', isMobile);
    
    // 根據設備類型調整控制面板
    const { gameControls, controlsToggle } = getDOMElements();
    if (gameControls) {
        if (isMobile) {
            // 移動設備上隱藏控制面板，顯示切換按鈕
            gameControls.classList.remove('visible');
            if (controlsToggle) {
                controlsToggle.style.display = 'flex';
            }
        } else {
            // 桌面設備上顯示控制面板，隱藏切換按鈕
            gameControls.classList.add('visible');
            if (controlsToggle) {
                controlsToggle.style.display = 'none';
            }
        }
    }
}

// 監聽設備寬度變化
window.addEventListener('resize', detectDevice);

// 初始化遊戲應用
document.addEventListener('DOMContentLoaded', () => {
    detectDevice();
    initializeApp();
});