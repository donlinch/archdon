// --- START OF FILE game.js ---

// game.js - Simple Walker 遊戲頁面腳本

// ★★★ 默認遊戲狀態結構 (包含地圖信息) ★★★
let gameState = {
    mapType: 'circle',      // 默認地圖類型
    mapRows: null,          // 矩形地圖行數
    mapCols: null,          // 矩形地圖列數
    mapLoopSize: 10,        // 地圖循環格子總數 (圓形或矩形計算後)
    maxPlayers: 5,          // 最大玩家數
    players: {},            // 玩家物件 { playerId: { name, position } }
    gameStarted: false,     // 遊戲是否已開始 (目前未使用)
    activeMapTemplateId: null // 當前活動的地圖內容模板 ID
};

// 玩家資訊
let playerName = '';        // 當前客戶端的玩家名稱
let roomId = '';            // 當前房間 ID
let roomName = '';          // 當前房間名稱
let playerId = null;        // 當前客戶端的玩家 ID (由伺服器分配)
let isConnected = false;    // WebSocket 是否已連接

// WebSocket 連接實例
let ws = null;

// 地圖內容緩存
let currentMapContent = []; // 儲存當前活動模板的格子內容 [{cell_index, title, content, image_url}, ...]

// DOM 元素引用
const playerNameDisplay = document.getElementById('player-name-display');
const roomNameDisplay = document.getElementById('room-name-display');
const roomIdDisplay = document.getElementById('room-id-display');
const playerCountDisplay = document.getElementById('player-count');
const maxPlayersDisplay = document.getElementById('max-players');
const playersList = document.getElementById('players-list');
const mapContainer = document.getElementById('map-container');       // 地圖格子容器
const playersContainer = document.getElementById('players-container'); // 玩家標記容器
const connectionStatus = document.getElementById('connection-status'); // 連接狀態指示器
const statusText = document.getElementById('status-text');            // 連接狀態文字
const moveForwardBtn = document.getElementById('move-forward');       // 前進按鈕
const moveBackwardBtn = document.getElementById('move-backward');     // 後退按鈕
const leaveGameBtn = document.getElementById('leave-game');           // 離開遊戲按鈕

// 地圖主題選擇器相關 DOM 元素
const templateSelectorDiv = document.getElementById('template-selector'); // 主題選擇器容器 Div
const templateSelect = document.getElementById('map-template-select');    // 主題下拉選單 Select
const applyTemplateBtn = document.getElementById('apply-template-btn');   // 套用主題按鈕 Button

// 格子詳細資訊彈出視窗相關 DOM 元素
const cellDetailPopup = document.getElementById('cell-detail-popup');     // 彈出視窗 Div
const popupTitle = document.getElementById('popup-title');          // 彈出視窗標題 H4
const popupContent = document.getElementById('popup-content');        // 彈出視窗內容 P
const popupImage = document.getElementById('popup-image');          // 彈出視窗圖片 Img
const closePopupBtn = document.getElementById('close-popup-btn');     // 彈出視窗關閉按鈕 Button


// === 初始化與事件綁定 ===

// 當頁面加載完成時執行的函數
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('roomId');
    playerName = urlParams.get('playerName');

    // 檢查必要的 URL 參數是否存在
    if (!roomId || !playerName) {
        alert('缺少房間 ID 或玩家名稱，即將返回首頁');
        window.location.href = 'index.html'; // 重定向回首頁
        return;
    }

    // 設置初始的顯示資訊
    playerNameDisplay.textContent = playerName;
    roomIdDisplay.textContent = roomId;
    roomNameDisplay.textContent = '載入中...'; // 初始房間名
    maxPlayersDisplay.textContent = gameState.maxPlayers; // 顯示預設最大玩家數

    // 連接到 WebSocket 伺服器
    connectWebSocket();

    // 綁定按鈕等元素的事件監聽器
    setupEventListeners();

    // 添加窗口大小變化事件監聽，用於重新計算玩家標記位置
    window.addEventListener('resize', function() {
        // 稍微延遲執行，確保 DOM 尺寸更新完成
        setTimeout(function() {
            updatePlayerMarkers(null); // 傳遞 null 表示非狀態更新觸發
        }, 200);
    });

    // 初始加載時嘗試更新一次模板選擇 UI
    updateTemplateSelectionUI();
});

// 綁定所有事件監聽器的函數
function setupEventListeners() {
    // 前進按鈕點擊事件
    moveForwardBtn.addEventListener('click', function() {
        // 檢查是否已連接、按鈕是否可用、是否在冷卻中
        if (!isConnected || moveForwardBtn.disabled || moveForwardBtn.classList.contains('btn-cooldown')) return;
        sendMoveCommand('forward');     // 發送移動指令
        applyButtonCooldown(moveForwardBtn); // 應用按鈕冷卻
    });

    // 後退按鈕點擊事件
    moveBackwardBtn.addEventListener('click', function() {
        if (!isConnected || moveBackwardBtn.disabled || moveBackwardBtn.classList.contains('btn-cooldown')) return;
        sendMoveCommand('backward');
        applyButtonCooldown(moveBackwardBtn);
    });

    // 離開遊戲按鈕點擊事件
    leaveGameBtn.addEventListener('click', function() {
        if (confirm('確定要離開遊戲嗎？')) {
            // 清除本地存儲的房間和玩家資訊
            sessionStorage.removeItem('currentRoom');
            sessionStorage.removeItem('playerName');
            if (ws) ws.close(); // 關閉 WebSocket 連接
            window.location.href = 'index.html'; // 返回首頁
        }
    });

    // 彈出視窗關閉按鈕點擊事件
    if (closePopupBtn) {
        closePopupBtn.addEventListener('click', closeCellDetailsPopup);
    }

    // 套用主題按鈕點擊事件
    if (applyTemplateBtn && templateSelect) {
        applyTemplateBtn.addEventListener('click', async () => {
            const selectedTemplateId = templateSelect.value; // 獲取選中的模板 ID (或空字串)
            console.log(`準備套用模板 ID: '${selectedTemplateId}'`);
            applyTemplateBtn.disabled = true; // 禁用按鈕防止重複提交

            try {
                // 將空字串轉換為 null，以便後端 API 正確處理清除模板的請求
                const templateIdToSend = selectedTemplateId === "" ? null : parseInt(selectedTemplateId);

                // 向後端發送選擇模板的請求
                const response = await fetch(`/api/game-rooms/${roomId}/select-template`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ templateId: templateIdToSend })
                 });

                 if (!response.ok) {
                     const errorData = await response.json();
                     throw new Error(errorData.error || '套用模板失敗');
                 }
                 // 請求成功，後端會處理並通過 WebSocket 廣播 gameStateUpdate
                 console.log("套用模板請求已成功發送。等待 gameState 更新...");

             } catch (error) {
                 console.error("套用模板時發生錯誤:", error);
                 alert(`套用地圖主題失敗: ${error.message}`);
             } finally {
                 applyTemplateBtn.disabled = false; // 無論結果如何，重新啟用按鈕
             }
        });
    } else {
         // console.warn("未找到模板選擇按鈕或下拉選單元素。");
    }

    // 監聽瀏覽器窗口關閉或刷新事件，確保關閉 WebSocket
    window.addEventListener('beforeunload', function() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });
}

// === WebSocket 相關函數 ===

// 連接到 WebSocket 伺服器
function connectWebSocket() {
    updateConnectionStatus('connecting', '連接中...'); // 更新 UI 狀態
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 構建 WebSocket URL，包含房間 ID 和編碼後的玩家名稱
    const wsUrl = `${protocol}//${window.location.host}?clientType=controller&roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;

    ws = new WebSocket(wsUrl); // 創建 WebSocket 實例

    // 連接成功時的回調
    ws.onopen = function() {
        console.log('WebSocket 連接已建立');
        isConnected = true;
        updateConnectionStatus('online', '已連接');
        // 連接成功後伺服器會主動推送 playerInfo 和 gameStateUpdate，無需客戶端請求
    };

    // 收到伺服器訊息時的回調
    ws.onmessage = function(event) {
        handleWebSocketMessage(event.data); // 處理收到的訊息
    };

    // 連接關閉時的回調
    ws.onclose = function(event) {
        console.log(`WebSocket 連接已關閉，代碼: ${event.code}, 原因: ${event.reason}`);
        isConnected = false;
        updateConnectionStatus('offline', `已斷線 (${event.code})`); // 更新 UI 狀態

        // 根據關閉代碼決定是否重定向或顯示特定訊息
        if (event.code === 4001) { // 假設 4001 是房間滿了
            alert('無法重新連接：房間已滿。');
            window.location.href = 'index.html';
        } else if (event.code === 1011 && event.reason.includes("找不到房間")) { // 伺服器關閉房間
             alert('房間不存在或已被關閉。');
             window.location.href = 'index.html';
        } else if (event.code >= 4000 && event.code < 5000) { // 一般應用錯誤 (4xxx)
             alert(`連接錯誤: ${event.reason || '未知伺服器錯誤'}`);
             window.location.href = 'index.html'; // 通常需要返回首頁
        } else if (![1000, 1001, 1005, 1006].includes(event.code)) { // 排除正常關閉、離開、無狀態碼、異常關閉(由onerror處理)
            // 嘗試重新連接非預期的斷線
            console.log('連接意外斷開，5 秒後嘗試重新連接...');
            setTimeout(connectWebSocket, 5000); // 5秒後重試
        }
    };

    // 連接發生錯誤時的回調
    ws.onerror = function(error) {
        console.error('WebSocket 發生錯誤:', error);
        updateConnectionStatus('offline', '連接錯誤');
        // onerror 通常會觸發 onclose，讓 onclose 處理重連邏輯
    };
}

// 處理收到的 WebSocket 訊息
function handleWebSocketMessage(data) {
    try {
        const message = JSON.parse(data);
        // console.log("收到 WS 訊息:", message.type);

        switch (message.type) {
            case 'gameStateUpdate':
                const oldState = { ...gameState }; // 保存舊狀態用於比較
                gameState = message.gameState; // 更新本地遊戲狀態

                // 更新房間名稱顯示
                if (message.roomName && roomName !== message.roomName) {
                    roomName = message.roomName;
                    roomNameDisplay.textContent = roomName;
                }

                // 檢查地圖結構是否改變 (大小、類型)
                const mapChanged = !oldState.mapType || oldState.mapLoopSize !== gameState.mapLoopSize || oldState.mapType !== gameState.mapType || oldState.mapRows !== gameState.mapRows || oldState.mapCols !== gameState.mapCols;
                // 檢查活動模板 ID 是否改變
                const templateChanged = oldState.activeMapTemplateId !== gameState.activeMapTemplateId;

                if (mapChanged) {
                    // 地圖結構改變，必須重新繪製地圖
                    console.log("地圖設定已變更，重新建立地圖。");
                    createGameMap(); // 重新創建視覺地圖格子

                    // 如果新狀態有活動模板，則獲取其內容
                    if (gameState.activeMapTemplateId !== null) {
                         fetchAndDisplayMapContent(gameState.activeMapTemplateId);
                    } else {
                         clearMapContentDisplay(); // 清除舊內容
                    }
                } else {
                    // 地圖結構未變，僅更新玩家標記等
                    updateGameDisplay(oldState);

                    // 如果僅模板改變，獲取新內容
                    if (templateChanged) {
                         console.log(`活動模板變更為: ${gameState.activeMapTemplateId}`);
                         if (gameState.activeMapTemplateId !== null) {
                              fetchAndDisplayMapContent(gameState.activeMapTemplateId);
                         } else {
                              clearMapContentDisplay(); // 清除內容
                         }
                    }
                }

                // 更新模板選擇 UI 以反映最新狀態
                updateTemplateSelectionUI();
                break;

            case 'playerInfo':
                playerId = message.playerId; // 儲存自己的玩家 ID
                console.log(`從伺服器收到玩家 ID: ${playerId}`);
                // 初始的 gameStateUpdate 會緊隨其後，更新玩家列表等
                break;

            case 'error':
                console.error('收到伺服器錯誤訊息:', message.message);
                alert(`伺服器錯誤: ${message.message}`);
                // 根據錯誤類型決定是否關閉連接或重定向
                if (message.message === "房間已滿" || message.message === "玩家名稱已被使用" || message.message.includes("伺服器狀態錯誤")) {
                     if(ws) ws.close(1000, "客戶端因伺服器錯誤而離開"); // 正常關閉
                     window.location.href = 'index.html'; // 返回首頁
                 }
                break;

            default:
                console.log('收到未知類型的訊息:', message);
        }
    } catch (error) {
        console.error('處理 WebSocket 訊息時出錯:', error, data);
    }
}

// 通過 WebSocket 發送移動命令給伺服器
function sendMoveCommand(direction) {
    if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
         console.warn("WebSocket 未連接，無法發送移動命令。");
         return;
     }

    const moveCommand = {
        type: 'moveCommand', // 命令類型
        direction: direction // 移動方向 ('forward' 或 'backward')
    };

    try {
        ws.send(JSON.stringify(moveCommand)); // 發送 JSON 字串
        console.log(`已發送移動命令: ${direction}`);
    } catch (error) {
         console.error("通過 WebSocket 發送移動命令失敗:", error);
         updateConnectionStatus('offline', '發送錯誤'); // 更新狀態
    }
}

// === 地圖與玩家顯示相關函數 ===

// ★★★ 根據 gameState 創建遊戲地圖的主函數 ★★★
function createGameMap() {
    mapContainer.innerHTML = ''; // 清除舊的地圖格子
    playersContainer.innerHTML = ''; // 清除舊的玩家標記

    // 確保玩家標記容器正確覆蓋在地圖容器之上
    if (mapContainer.parentNode) {
        playersContainer.style.position = 'absolute';
        playersContainer.style.top = '0';
        playersContainer.style.left = '0';
        playersContainer.style.width = '100%';
        playersContainer.style.height = '100%';
        playersContainer.style.zIndex = '10'; // 確保在格子之上
        playersContainer.style.pointerEvents = 'none'; // 讓點擊穿透到格子
        mapContainer.style.position = 'relative'; // 父容器必須有定位基準
    }

    console.log('根據 gameState 創建地圖:', gameState);

    // 檢查 gameState 和 mapType 是否有效
    if (!gameState || !gameState.mapType) {
        console.error("無法創建地圖：缺少 gameState 或 mapType。");
        mapContainer.innerHTML = '<p style="color:red;">地圖加載失敗</p>';
        return;
    }

    // 根據 mapType 調用不同的繪製函數
    if (gameState.mapType === 'rectangle' && gameState.mapRows && gameState.mapCols) {
        createRectangleMap(gameState.mapRows, gameState.mapCols);
    } else {
        // 默認或明確指定為圓形地圖
        createCircleMap(gameState.mapLoopSize || 10); // 使用 mapLoopSize
    }

    // 地圖創建完成後，立即根據當前 gameState 更新玩家標記
    updatePlayerMarkers(null); // 初始創建傳遞 null
}

// ★★★ 創建圓形地圖函數 ★★★
function createCircleMap(size) {
    mapContainer.className = 'circle-map-container'; // 應用特定 CSS class
    mapContainer.style.position = 'relative';
    mapContainer.style.width = '300px'; // 固定容器大小
    mapContainer.style.height = '300px';
    mapContainer.style.margin = '20px auto'; // 居中顯示

    const radius = 120; // 圓的半徑
    const centerX = 150; // 容器中心 X
    const centerY = 150; // 容器中心 Y
    const cellSize = 40; // 格子大小

    for (let i = 0; i < size; i++) {
        const cell = document.createElement('div');
        cell.className = 'map-cell';
        cell.id = `cell-${i}`; // 為每個格子設置 ID
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;
        cell.style.position = 'absolute'; // 絕對定位
        cell.style.display = 'flex';
        cell.style.justifyContent = 'center';
        cell.style.alignItems = 'center';
        cell.style.border = '1px solid #ccc';
        cell.style.borderRadius = '50%'; // 圓形格子
        cell.style.backgroundColor = 'white';
        cell.style.boxSizing = 'border-box';

        // 計算格子在圓周上的位置
        const angle = (i / size) * 2 * Math.PI - (Math.PI / 2); // 從頂部 (12點鐘方向) 開始排列
        const x = centerX + radius * Math.cos(angle) - (cellSize / 2);
        const y = centerY + radius * Math.sin(angle) - (cellSize / 2);
        cell.style.left = `${x}px`;
        cell.style.top = `${y}px`;

        // 顯示格子編號
        const cellNumber = document.createElement('span');
        cellNumber.className = 'map-cell-number';
        cellNumber.textContent = i;
        cell.appendChild(cellNumber);
        mapContainer.appendChild(cell); // 添加到地圖容器
    }
}

// ★★★ 創建矩形地圖函數 ★★★
function createRectangleMap(mapRows, mapCols) {
    mapRows = Math.min(Math.max(2, mapRows), 8); // 限制行數範圍
    mapCols = Math.min(Math.max(2, mapCols), 8); // 限制列數範圍

    mapContainer.className = 'rectangle-map-container'; // 應用特定 CSS class

    // 使用 CSS Grid 佈局
    mapContainer.style.display = 'grid';
    mapContainer.style.gridTemplateColumns = `repeat(${mapCols}, 1fr)`; // 設置列數
    mapContainer.style.gridTemplateRows = `repeat(${mapRows}, 1fr)`;    // 設置行數
    mapContainer.style.gap = '1px';             // 格子間隙
    mapContainer.style.border = '1px solid #aaa'; // 邊框
    mapContainer.style.padding = '5px';          // 內邊距
    mapContainer.style.width = '90%';           // 寬度
    mapContainer.style.maxWidth = '500px';      // 最大寬度
    mapContainer.style.margin = '20px auto';    // 居中顯示
    mapContainer.style.position = 'relative';   // 相對定位基準

    const mapLoopSize = 2 * mapCols + 2 * (mapRows - 2); // 計算實際路徑格子數

    for (let r = 0; r < mapRows; r++) {
        for (let c = 0; c < mapCols; c++) {
            const cell = document.createElement('div');
            // 判斷是否為邊界格子 (路徑)
            const isPathCell = r === 0 || r === mapRows - 1 || c === 0 || c === mapCols - 1;

            cell.className = isPathCell ? 'map-cell' : 'map-cell empty'; // 應用不同 class
            cell.style.backgroundColor = 'white';
            cell.style.display = 'flex';
            cell.style.justifyContent = 'center';
            cell.style.alignItems = 'center';
            cell.style.aspectRatio = '1'; // 保持正方形
            cell.style.position = 'relative'; // 相對定位基準
            cell.style.boxSizing = 'border-box';

            if (isPathCell) {
                // 計算路徑索引 (順時針)
                let pathIndex = -1;
                if (r === 0) { // 頂邊 (左 -> 右)
                    pathIndex = c;
                } else if (c === mapCols - 1 && r > 0 && r < mapRows - 1) { // 右邊 (上 -> 下)
                    pathIndex = mapCols + (r - 1);
                } else if (r === mapRows - 1) { // 底邊 (右 -> 左)
                    pathIndex = mapCols + (mapRows - 2) + (mapCols - 1 - c);
                } else if (c === 0 && r > 0 && r < mapRows - 1) { // 左邊 (下 -> 上)
                    pathIndex = 2 * mapCols + mapRows - 3 + (mapRows - 1 - r);
                }

                // 驗證索引並設置 ID 和編號
                if (pathIndex >= 0 && pathIndex < mapLoopSize) {
                    cell.id = `cell-${pathIndex}`; // 設置 ID
                    const cellNumber = document.createElement('span');
                    cellNumber.className = 'map-cell-number';
                    cellNumber.textContent = pathIndex; // 顯示編號
                    cell.appendChild(cellNumber);
                } else {
                    console.error(`計算出無效的路徑索引: ${pathIndex} 對於格子 (${r},${c})`);
                    cell.classList.add('error'); // 標記錯誤
                    cell.textContent = 'E';
                }
            } else {
                // 非路徑格子樣式
                cell.style.backgroundColor = '#f8f8f8'; // 更淺的背景色
                cell.style.opacity = '0.6';
            }
            mapContainer.appendChild(cell); // 添加到地圖容器
        }
    }
}

// ★★★ 更新玩家標記顯示函數 ★★★
function updatePlayerMarkers(oldState) {
    // 先清除所有現有的玩家標記
    document.querySelectorAll('.player-marker').forEach(marker => marker.remove());

    const playerIds = Object.keys(gameState.players || {});
    if (playerIds.length === 0) return; // 沒有玩家則返回

    // 1. 按名稱排序以確保顏色分配穩定
    const sortedPlayerIdsForColor = [...playerIds].sort((a, b) => {
        const nameA = gameState.players[a]?.name || '';
        const nameB = gameState.players[b]?.name || '';
        return nameA.localeCompare(nameB);
    });
    const playerIdToColorIndex = new Map();
    sortedPlayerIdsForColor.forEach((id, index) => {
        playerIdToColorIndex.set(id, (index % 5) + 1); // 分配 1-5 的顏色索引
    });

    // 2. 將玩家按當前位置分組
    const playersByPosition = new Map();
    playerIds.forEach(id => {
        const player = gameState.players[id];
        if (!player) return;
        const position = player.position;
        if (!playersByPosition.has(position)) {
            playersByPosition.set(position, []);
        }
        playersByPosition.get(position).push(id); // 將玩家 ID 添加到對應位置的陣列中
    });

    // 3. 為每個有玩家的位置創建標記
    playersByPosition.forEach((playerIdsAtPosition, position) => {
        const cell = document.getElementById(`cell-${position}`); // 找到對應的格子元素
        if (!cell) {
            console.warn(`找不到位置 ${position} 的格子元素`);
            return;
        }

        // 計算格子中心點相對於地圖容器的位置
        const cellCenterX = cell.offsetLeft + (cell.offsetWidth / 2);
        const cellCenterY = cell.offsetTop + (cell.offsetHeight / 2);

        // 根據同一格子上的玩家數量計算偏移量
        const offsets = getPlayerOffsets(playerIdsAtPosition.length);

        // 為這個位置上的每個玩家創建標記
        playerIdsAtPosition.forEach((pid, index) => {
            const player = gameState.players[pid];
            const colorIndex = playerIdToColorIndex.get(pid) || 1; // 獲取顏色索引
            const offset = offsets[index] || { x: 0, y: 0 }; // 獲取偏移量

            const marker = document.createElement('div');
            marker.className = `player-marker player-color-${colorIndex}`; // 應用顏色 class
            marker.id = `player-marker-${pid}`; // 設置標記 ID
            marker.textContent = player.name.charAt(0).toUpperCase(); // 顯示玩家名稱首字母
            marker.title = player.name; // 滑鼠懸停時顯示完整名稱

            // 設置標記樣式
            marker.style.position = 'absolute';
            marker.style.width = '30px';  // 固定標記大小
            marker.style.height = '30px';
            marker.style.borderRadius = '50%';
            marker.style.backgroundColor = getPlayerColor(colorIndex); // 應用背景色
            marker.style.color = 'white';
            marker.style.display = 'flex';
            marker.style.justifyContent = 'center';
            marker.style.alignItems = 'center';
            marker.style.fontWeight = 'bold';
            marker.style.fontSize = '16px';
            marker.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
            marker.style.zIndex = (pid === playerId) ? '20' : '15'; // 自己的標記顯示在最上層
            marker.style.transform = 'translate(-50%, -50%)'; // 使標記中心對齊計算出的位置
            marker.style.transition = 'left 0.4s ease-in-out, top 0.4s ease-in-out'; // 平滑移動動畫

            // 應用計算出的位置 (中心點 + 偏移量)
            marker.style.left = `${cellCenterX + offset.x}px`;
            marker.style.top = `${cellCenterY + offset.y}px`;

            // 高亮顯示當前客戶端的玩家標記
            if (pid === playerId) {
                marker.style.border = '3px solid yellow'; // 添加黃色邊框
            }

            // 應用移動動畫效果 (如果玩家位置發生了變化)
            if (oldState && oldState.players && oldState.players[pid] &&
                oldState.players[pid].position !== player.position) {
                marker.classList.add('player-moving'); // 添加放大動畫 class
                setTimeout(() => {
                    marker.classList.remove('player-moving'); // 移除動畫 class
                }, 500); // 動畫持續時間
            }

            // 將標記添加到 playersContainer 中
            playersContainer.appendChild(marker);
        });
    });
}

// ★★★ 輔助函數：根據格子上的玩家數量計算偏移量 ★★★
function getPlayerOffsets(count) {
    const offsets = [];
    const baseOffset = 8; // 基礎偏移量 (像素)，可根據標記大小調整

    switch (count) {
        case 1:
            offsets.push({ x: 0, y: 0 }); // 單個玩家居中
            break;
        case 2:
            offsets.push({ x: -baseOffset, y: 0 }); // 左
            offsets.push({ x: baseOffset, y: 0 });  // 右
            break;
        case 3:
            offsets.push({ x: 0, y: -baseOffset });           // 上
            offsets.push({ x: -baseOffset, y: baseOffset }); // 左下
            offsets.push({ x: baseOffset, y: baseOffset });  // 右下
            break;
        case 4:
            offsets.push({ x: -baseOffset, y: -baseOffset }); // 左上
            offsets.push({ x: baseOffset, y: -baseOffset });  // 右上
            offsets.push({ x: -baseOffset, y: baseOffset });  // 左下
            offsets.push({ x: baseOffset, y: baseOffset });   // 右下
            break;
        default: // 5個或更多，環形排列
            const angleStep = (2 * Math.PI) / count;
            for (let i = 0; i < count; i++) {
                const angle = i * angleStep - (Math.PI / 2); // 從上方開始
                offsets.push({
                    x: Math.cos(angle) * baseOffset * 1.2, // 稍微擴大半徑
                    y: Math.sin(angle) * baseOffset * 1.2
                });
            }
            break;
    }
    return offsets;
}

// ★★★ 更新遊戲介面顯示 (除地圖格子本身外) ★★★
function updateGameDisplay(oldState) {
    // 更新最大玩家數
    maxPlayersDisplay.textContent = gameState.maxPlayers || 5;

    // 更新當前玩家數
    const playerCount = Object.keys(gameState.players || {}).length;
    playerCountDisplay.textContent = playerCount;

    // 更新 UI 中的玩家列表
    updatePlayersList();

    // 更新地圖上的玩家標記位置
    updatePlayerMarkers(oldState); // 傳遞 oldState 以判斷是否需要動畫
}

// 更新玩家列表顯示 (在下方資訊區域)
function updatePlayersList() {
    playersList.innerHTML = ''; // 清空現有列表
    const playerIds = Object.keys(gameState.players || {});

    if (playerIds.length === 0) {
        playersList.innerHTML = '<li>目前沒有玩家</li>';
        return;
    }

    // --- 使用顏色索引確保列表項與標記顏色一致 ---
    const sortedPlayerIdsForColor = [...playerIds].sort((a, b) => (gameState.players[a]?.name || '').localeCompare(gameState.players[b]?.name || ''));
    const playerIdToColorIndex = new Map();
    sortedPlayerIdsForColor.forEach((id, index) => {
        playerIdToColorIndex.set(id, (index % 5) + 1);
    });
    // --- 顏色分配結束 ---

    // 再次按名稱排序以確定列表顯示順序
    const sortedPlayerIdsForList = [...playerIds].sort((a, b) => (gameState.players[a]?.name || '').localeCompare(gameState.players[b]?.name || ''));

    sortedPlayerIdsForList.forEach(id => {
        const player = gameState.players[id];
        const li = document.createElement('li');
        li.textContent = `${player.name} (位置: ${player.position})`;
        const colorIndex = playerIdToColorIndex.get(id) || 1;
        li.style.borderLeft = `5px solid ${getPlayerColor(colorIndex)}`; // 左側顏色條
        li.style.paddingLeft = '10px';
        li.style.marginBottom = '5px';

        // 標記自己
        if (id === playerId) {
            li.textContent += ' (你)';
            li.style.fontWeight = 'bold';
            li.style.backgroundColor = '#eee'; // 給自己加點背景色
        }
        playersList.appendChild(li);
    });
}

// === 地圖內容相關函數 ===

// ★★★ 獲取並顯示地圖內容 ★★★
async function fetchAndDisplayMapContent(templateId) {
    // 如果 templateId 為 null 或 undefined，表示清除主題
    if (templateId === null || templateId === undefined) {
        console.log("沒有活動模板，清除地圖內容。");
        currentMapContent = []; // 清空內容緩存
        clearMapContentDisplay(); // 清除地圖上的顯示
        return;
    }

    console.log(`正在獲取模板 ID: ${templateId} 的內容...`);
    try {
        // 向後端 API 請求當前活動模板的內容
        const response = await fetch(`/api/game-rooms/${roomId}/active-map-content`);
        if (!response.ok) {
            throw new Error(`獲取地圖內容失敗 (${response.status})`);
        }
        currentMapContent = await response.json(); // 儲存獲取到的內容
        console.log("成功獲取地圖內容:", currentMapContent);
        displayMapContentOnCells(); // 在地圖格子上顯示內容
    } catch (error) {
        console.error("獲取或顯示地圖內容時發生錯誤:", error);
        currentMapContent = []; // 出錯時清空緩存
        clearMapContentDisplay(); // 出錯時清除顯示
        // 可選：顯示錯誤提示給玩家
    }
}

// ★★★ 將獲取到的地圖內容顯示在對應的格子裡 ★★★
function displayMapContentOnCells() {
    clearMapContentDisplay(); // 先清除舊的內容

    if (!currentMapContent || currentMapContent.length === 0) {
        return; // 沒有內容則返回
    }

    currentMapContent.forEach(cellData => {
        const cellElement = document.getElementById(`cell-${cellData.cell_index}`);
        if (cellElement) {
            // 隱藏格子編號
            const numberSpan = cellElement.querySelector('.map-cell-number');
            if (numberSpan) numberSpan.style.display = 'none';

            // 創建標題覆蓋層
            const titleOverlay = document.createElement('div');
            titleOverlay.className = 'map-cell-title-overlay';
            titleOverlay.textContent = cellData.title;
            titleOverlay.title = `點擊查看詳情：${cellData.title}`;

            // 添加點擊事件，顯示詳細資訊彈出視窗
            titleOverlay.addEventListener('click', (e) => {
                 e.stopPropagation(); // 阻止事件冒泡
                 showCellDetails(cellData); // 顯示彈出視窗
            });
            titleOverlay.style.pointerEvents = 'auto'; // 確保可點擊

            cellElement.appendChild(titleOverlay);
            cellElement.style.cursor = 'pointer'; // 提示可點擊
        } else {
             console.warn(`找不到索引為 ${cellData.cell_index} 的格子元素。`);
        }
    });
}

// ★★★ 清除地圖格子上的內容覆蓋層 ★★★
function clearMapContentDisplay() {
    // 移除所有標題覆蓋層
    document.querySelectorAll('.map-cell-title-overlay').forEach(overlay => overlay.remove());
    // 恢復顯示格子編號
    document.querySelectorAll('.map-cell .map-cell-number').forEach(span => {
        span.style.display = '';
    });
    // 恢復默認滑鼠樣式
    document.querySelectorAll('.map-cell').forEach(cell => {
        cell.style.cursor = 'default';
    });
    // 關閉可能開啟的彈出視窗
    closeCellDetailsPopup();
}

// ★★★ 顯示格子詳細資訊彈出視窗 ★★★
function showCellDetails(cellData) {
    if (!cellDetailPopup || !popupTitle || !popupContent || !popupImage) {
        console.error("彈出視窗的 DOM 元素未找到！");
        // 備用方案：使用 alert
        alert(`格子 ${cellData.cell_index}: ${cellData.title}\n\n${cellData.content || '(無內容)'}\n\n${cellData.image_url ? '圖片: ' + cellData.image_url : ''}`);
        return;
    }

    // 填充內容
    popupTitle.textContent = `格子 ${cellData.cell_index}: ${cellData.title}`;
    popupContent.textContent = cellData.content || '(此格無詳細內容)';

    // 處理圖片
    if (cellData.image_url) {
        popupImage.src = cellData.image_url;
        popupImage.alt = cellData.title;
        popupImage.classList.remove('hidden'); // 顯示圖片
    } else {
        popupImage.classList.add('hidden'); // 隱藏圖片
        popupImage.src = "";
        popupImage.alt = "";
    }

    // 顯示彈出視窗
    cellDetailPopup.classList.remove('hidden');
}

// ★★★ 關閉格子詳細資訊彈出視窗 ★★★
function closeCellDetailsPopup() {
    if (cellDetailPopup) {
        cellDetailPopup.classList.add('hidden');
    }
}


// ★★★ 更新地圖主題選擇的 UI (下拉選單) ★★★
async function updateTemplateSelectionUI() {
    if (!templateSelect || !applyTemplateBtn || !templateSelectorDiv || gameState.mapLoopSize === undefined || gameState.mapLoopSize === null) {
        if(templateSelectorDiv) templateSelectorDiv.style.display = 'none'; // 確保隱藏
        return; // UI 元素不完整或地圖大小未知
    }

    try {
        // 請求適合當前地圖大小的模板列表
        const response = await fetch(`/api/game-rooms/${roomId}/map-templates`);
        if (!response.ok) throw new Error('獲取模板列表失敗');
        const availableTemplates = await response.json();

        // 填充下拉選單
        templateSelect.innerHTML = '<option value="">-- 無主題 --</option>'; // 清除/預設選項
        if (availableTemplates.length > 0) {
            availableTemplates.forEach(tpl => {
                const option = document.createElement('option');
                option.value = tpl.id;
                option.textContent = tpl.name; // 顯示模板名稱
                // 如果是當前活動模板，則預選
                if (tpl.id === gameState.activeMapTemplateId) {
                     option.selected = true;
                }
                templateSelect.appendChild(option);
            });
            templateSelectorDiv.style.display = 'flex'; // 顯示選擇器
        } else {
             templateSelectorDiv.style.display = 'none'; // 沒有可用模板則隱藏
        }

    } catch (error) {
        console.error("更新模板選擇 UI 時發生錯誤:", error);
        templateSelectorDiv.style.display = 'none'; // 出錯時隱藏
    }
}


// === 其他輔助函數 ===

// 應用按鈕冷卻效果
function applyButtonCooldown(button) {
    button.disabled = true; // 禁用按鈕
    button.classList.add('btn-cooldown'); // 添加冷卻樣式

    setTimeout(() => {
        // 僅在仍然連接時才重新啟用按鈕
        if (isConnected) {
            button.disabled = false;
        }
        button.classList.remove('btn-cooldown'); // 移除冷卻樣式
    }, 500); // 冷卻時間 500 毫秒
}

// 更新連接狀態的顯示
function updateConnectionStatus(status, message) {
    connectionStatus.className = status; // 應用 CSS class ('online', 'offline', 'connecting')
    statusText.textContent = message;   // 更新顯示文字

    // 根據連接狀態啟用/禁用移動按鈕
    const isOnline = status === 'online';
    moveForwardBtn.disabled = !isOnline;
    moveBackwardBtn.disabled = !isOnline;
    // 如果斷開連接，清除按鈕的冷卻狀態
    if (!isOnline) {
        moveForwardBtn.classList.remove('btn-cooldown');
        moveBackwardBtn.classList.remove('btn-cooldown');
    }
}

// 根據顏色索引獲取對應的顏色碼
function getPlayerColor(index) {
    const colors = [
        '#e74c3c', // 紅色
        '#3498db', // 藍色
        '#2ecc71', // 綠色
        '#f1c40f', // 黃色
        '#9b59b6'  // 紫色
    ];
    // 使用模數運算確保索引在顏色陣列範圍內循環
    return colors[((index || 1) - 1) % colors.length];
}

// --- END OF FILE game.js ---