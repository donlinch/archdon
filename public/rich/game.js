// --- START OF FILE game.js ---

// game.js - Simple Walker 遊戲頁面腳本

// ★★★ 默認遊戲狀態結構 (現在包含地圖信息) ★★★
let gameState = {
    mapType: 'circle', // 默認類型
    mapRows: null,
    mapCols: null,
    mapLoopSize: 10,   // 默認大小
    maxPlayers: 5,
    players: {},
    gameStarted: false
};

// 玩家資訊
let playerName = '';
let roomId = '';
let roomName = '';
let playerId = null; // 當前玩家的ID (WebSocket連接後由伺服器分配)
let isConnected = false;

// WebSocket連接
let ws = null;

// DOM元素
const playerNameDisplay = document.getElementById('player-name-display');
const roomNameDisplay = document.getElementById('room-name-display');
const roomIdDisplay = document.getElementById('room-id-display');
const playerCountDisplay = document.getElementById('player-count');
const maxPlayersDisplay = document.getElementById('max-players');
const playersList = document.getElementById('players-list');
const mapContainer = document.getElementById('map-container');
const playersContainer = document.getElementById('players-container'); // 用於玩家標記
const connectionStatus = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');
const moveForwardBtn = document.getElementById('move-forward');
const moveBackwardBtn = document.getElementById('move-backward');
const leaveGameBtn = document.getElementById('leave-game');

// 在頁面加載時，檢查 URL 中是否有房間 ID 和玩家名稱
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('roomId');
    playerName = urlParams.get('playerName');

    if (!roomId || !playerName) {
        alert('缺少必要參數，即將返回首頁');
        window.location.href = 'index.html';
        return;
    }

    // 設置初始顯示信息
    playerNameDisplay.textContent = playerName;
    roomIdDisplay.textContent = roomId;
    roomNameDisplay.textContent = '載入中...'; // 設置初始房間名
    maxPlayersDisplay.textContent = gameState.maxPlayers; // 顯示默認最大玩家數

    // 連接到 WebSocket
    connectWebSocket();

    // 設置按鈕事件
    setupEventListeners();

    // 添加窗口大小變化事件監聽
    window.addEventListener('resize', function() {
        // 延遲一點執行，確保DOM已經更新
        setTimeout(function() {
            updatePlayerMarkers(null);
        }, 200);
    });
});

// 設置按鈕事件
function setupEventListeners() {
    moveForwardBtn.addEventListener('click', function() {
        if (!isConnected || moveForwardBtn.disabled || moveForwardBtn.classList.contains('btn-cooldown')) return;
        sendMoveCommand('forward');
        applyButtonCooldown(moveForwardBtn);
    });

    moveBackwardBtn.addEventListener('click', function() {
        if (!isConnected || moveBackwardBtn.disabled || moveBackwardBtn.classList.contains('btn-cooldown')) return;
        sendMoveCommand('backward');
        applyButtonCooldown(moveBackwardBtn);
    });

    leaveGameBtn.addEventListener('click', function() {
        if (confirm('確定要離開遊戲嗎？')) {
            sessionStorage.removeItem('currentRoom');
            sessionStorage.removeItem('playerName');
            if (ws) ws.close();
            window.location.href = 'index.html';
        }
    });

    window.addEventListener('beforeunload', function() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });
}

// ★★★ 根據 gameState 創建地圖的主函數 ★★★
function createGameMap() {
    mapContainer.innerHTML = ''; // 清除之前的地圖
    playersContainer.innerHTML = ''; // 清除玩家標記

    // 設置玩家容器為與地圖容器相同大小且覆蓋在上方
    if (mapContainer.parentNode) {
        // 確保容器在DOM樹中
        playersContainer.style.position = 'absolute';
        playersContainer.style.top = '0';
        playersContainer.style.left = '0';
        playersContainer.style.width = '100%';
        playersContainer.style.height = '100%';
        playersContainer.style.zIndex = '10';
        playersContainer.style.pointerEvents = 'none'; // 讓點擊事件穿透到底層表格
        
        // 確保地圖容器有相對定位
        mapContainer.style.position = 'relative';
    }

    console.log('根據 gameState 創建地圖:', gameState);

    if (!gameState || !gameState.mapType) {
        console.error("無法創建地圖：缺少 gameState 或 mapType。");
        mapContainer.innerHTML = '<p style="color:red;">地圖加載失敗</p>';
        return;
    }

    if (gameState.mapType === 'rectangle' && gameState.mapRows && gameState.mapCols) {
        createRectangleMap(gameState.mapRows, gameState.mapCols);
    } else {
        // 默認為圓形或明確處理
        createCircleMap(gameState.mapLoopSize || 10); // 圓形也使用 mapLoopSize
    }

    // 地圖創建後，根據當前 gameState 更新玩家標記
    updatePlayerMarkers(null); // 初始創建時傳遞 null 作為 oldState
}

// ★★★ 創建圓形地圖函數 ★★★
function createCircleMap(size) {
    mapContainer.className = 'circle-map-container'; // 添加 class 以便特定樣式
    mapContainer.style.position = 'relative'; // 圓形佈局需要相對定位的容器
    mapContainer.style.width = '300px'; // 容器寬度
    mapContainer.style.height = '300px'; // 容器高度
    mapContainer.style.margin = '20px 0'; // 靠左顯示

    const radius = 120; // 圓形半徑
    const centerX = 150; // 容器中心X (300/2)
    const centerY = 150; // 容器中心Y (300/2)
    const cellSize = 40; // 格子大小

    for (let i = 0; i < size; i++) {
        const cell = document.createElement('div');
        cell.className = 'map-cell'; // 路徑格子的標準 class
        cell.id = `cell-${i}`;
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;
        cell.style.position = 'absolute';
        cell.style.display = 'flex';
        cell.style.justifyContent = 'center';
        cell.style.alignItems = 'center';
        cell.style.backgroundColor = 'white';
        cell.style.border = '1px solid #ccc';
        cell.style.borderRadius = '4px';

        // 計算每個格子的位置（以圓形排列）
        const angle = (i / size) * 2 * Math.PI - (Math.PI / 2); // 從頂部開始排列
        const x = centerX + radius * Math.cos(angle) - (cellSize / 2);
        const y = centerY + radius * Math.sin(angle) - (cellSize / 2);
        
        cell.style.left = `${x}px`;
        cell.style.top = `${y}px`;

        const cellNumber = document.createElement('span');
        cellNumber.className = 'map-cell-number';
        cellNumber.textContent = i;
        cellNumber.style.fontSize = '12px';
        cellNumber.style.color = '#666';

        cell.appendChild(cellNumber);
        mapContainer.appendChild(cell);
    }
}

// ★★★ 創建矩形地圖函數 ★★★
function createRectangleMap(mapRows, mapCols) {
    // 確保有效的行列數
    mapRows = Math.min(Math.max(2, mapRows), 8);
    mapCols = Math.min(Math.max(2, mapCols), 8);

    mapContainer.className = 'rectangle-map-container'; // 添加 class
    
    // 使用CSS Grid佈局
    mapContainer.style.display = 'grid';
    mapContainer.style.gridTemplateColumns = `repeat(${mapCols}, 1fr)`;
    mapContainer.style.gridTemplateRows = `repeat(${mapRows}, 1fr)`;
    mapContainer.style.gap = '1px';
    mapContainer.style.backgroundColor = '#ccc';
    mapContainer.style.border = '1px solid #aaa';
    mapContainer.style.padding = '5px';
    mapContainer.style.position = 'relative';
    mapContainer.style.width = '85%';
    mapContainer.style.margin = '20px 0'; // 改為靠左，移除 auto
    
    // 計算循環大小以確保索引正確
    const mapLoopSize = 2 * mapCols + 2 * (mapRows - 2);

    for (let r = 0; r < mapRows; r++) {
        for (let c = 0; c < mapCols; c++) {
            const cell = document.createElement('div');
            const isPathCell = r === 0 || r === mapRows - 1 || c === 0 || c === mapCols - 1;

            cell.className = isPathCell ? 'map-cell' : 'map-cell empty';
            
            // 為格子添加樣式
            cell.style.backgroundColor = 'white';
            cell.style.display = 'flex';
            cell.style.justifyContent = 'center';
            cell.style.alignItems = 'center';
            cell.style.aspectRatio = '1'; // 保持正方形
            cell.style.position = 'relative'; // 確保子元素可以相對它定位

            if (isPathCell) {
                // 計算路徑索引 (順序循環索引)
                let pathIndex = -1;
                if (r === 0) { // 頂邊 (左到右)
                    pathIndex = c;
                } else if (c === mapCols - 1 && r > 0 && r < mapRows - 1) { // 右邊 (上到下)
                    pathIndex = mapCols + (r - 1);
                } else if (r === mapRows - 1) { // 底邊 (右到左)
                    pathIndex = mapCols + (mapRows - 2) + (mapCols - 1 - c);
                } else if (c === 0 && r > 0 && r < mapRows - 1) { // 左邊 (下到上)
                    pathIndex = 2 * mapCols + mapRows - 3 + (mapRows - 1 - r);
                }

                // 驗證索引計算 - 應為 0 到 mapLoopSize-1
                if (pathIndex >= 0 && pathIndex < mapLoopSize) {
                    cell.id = `cell-${pathIndex}`; // 僅為有效的路徑格子分配 ID
                    const cellNumber = document.createElement('span');
                    cellNumber.className = 'map-cell-number';
                    cellNumber.textContent = pathIndex;
                    cellNumber.style.fontSize = '12px';
                    cellNumber.style.color = '#666';
                    cell.appendChild(cellNumber);
                } else {
                    console.error(`計算出無效的路徑索引: ${pathIndex} 對於格子 (${r},${c})`);
                    cell.classList.add('error'); // 標記計算錯誤的格子
                    cell.textContent = 'E';
                }
            } else {
                // 空格子樣式
                cell.style.opacity = '0.5';
            }
            mapContainer.appendChild(cell);
        }
    }
}

// ★★★ 更新玩家標記函數（完全重寫） ★★★
function updatePlayerMarkers(oldState) {
    // 先清除所有現有的玩家標記
    document.querySelectorAll('.player-marker').forEach(marker => marker.remove());
    
    const playerIds = Object.keys(gameState.players || {});
    if (playerIds.length === 0) return;
    
    // 按名稱排序玩家，以確保顏色分配一致
    const sortedPlayerIds = [...playerIds].sort((a, b) => {
        const nameA = gameState.players[a]?.name || '';
        const nameB = gameState.players[b]?.name || '';
        return nameA.localeCompare(nameB);
    });
    
    // 為每個玩家分配顏色索引
    const playerIdToColorIndex = new Map();
    sortedPlayerIds.forEach((id, index) => {
        playerIdToColorIndex.set(id, (index % 5) + 1); // 顏色索引 1-5
    });
    
    // 將玩家按位置分組
    const playersByPosition = new Map();
    playerIds.forEach(id => {
        const player = gameState.players[id];
        if (!player) return;
        
        const position = player.position;
        if (!playersByPosition.has(position)) {
            playersByPosition.set(position, []);
        }
        playersByPosition.get(position).push(id);
    });
    
    // 為每個位置創建玩家標記
    playersByPosition.forEach((playerIdsAtPosition, position) => {
        const cell = document.getElementById(`cell-${position}`);
        if (!cell) {
            console.warn(`找不到位置 ${position} 的格子元素`);
            return;
        }
        
        // 獲取格子的大小和位置
        const cellRect = cell.getBoundingClientRect();
        const mapRect = mapContainer.getBoundingClientRect();
        
        // 計算格子相對於地圖容器的中心位置
        const cellCenterX = cell.offsetLeft + (cell.offsetWidth / 2);
        const cellCenterY = cell.offsetTop + (cell.offsetHeight / 2);
        
        // 計算玩家在同一格子的偏移
        const offsetsForPosition = getPlayerOffsets(playerIdsAtPosition.length);
        
        // 為每個在此位置的玩家創建標記
        playerIdsAtPosition.forEach((pid, index) => {
            const player = gameState.players[pid];
            const colorIndex = playerIdToColorIndex.get(pid) || 1;
            const offset = offsetsForPosition[index] || { x: 0, y: 0 };
            
            const marker = document.createElement('div');
            marker.className = `player-marker player-color-${colorIndex}`;
            marker.id = `player-marker-${pid}`;
            marker.textContent = player.name.charAt(0).toUpperCase();
            marker.title = player.name;
            
            // 設置基本樣式
            marker.style.position = 'absolute';
            marker.style.width = '30px';
            marker.style.height = '30px';
            marker.style.borderRadius = '50%';
            marker.style.backgroundColor = getPlayerColor(colorIndex);
            marker.style.color = 'white';
            marker.style.display = 'flex';
            marker.style.justifyContent = 'center';
            marker.style.alignItems = 'center';
            marker.style.fontWeight = 'bold';
            marker.style.fontSize = '16px';
            marker.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
            marker.style.zIndex = (pid === playerId) ? '20' : '10'; // 自己的標記置頂
            marker.style.transform = 'translate(-50%, -50%)'; // 中心點對齊
            
            // 應用位置偏移
            marker.style.left = `${cellCenterX + offset.x}px`;
            marker.style.top = `${cellCenterY + offset.y}px`;
            
            // 高亮當前玩家的標記
            if (pid === playerId) {
                marker.style.border = '2px solid white';
            }
            
            // 添加移動動畫效果
            if (oldState && oldState.players && oldState.players[pid] &&
                oldState.players[pid].position !== player.position) {
                marker.classList.add('player-moving');
                setTimeout(() => {
                    marker.classList.remove('player-moving');
                }, 500);
            }
            
            // 將標記添加到玩家容器中
            playersContainer.appendChild(marker);
        });
    });
}

// ★★★ 輔助函數：根據格子上的玩家數量計算偏移量數組 ★★★
function getPlayerOffsets(count) {
    const offsets = [];
    // 獲取單個格子的平均尺寸
    const avgCellSize = Math.min(
        mapContainer.clientWidth / (gameState.mapCols || 7),
        mapContainer.clientHeight / (gameState.mapRows || 6)
    );
    
    // 根據格子大小調整偏移量
    const baseOffset = avgCellSize * 0.25; // 格子尺寸的25%
    
    switch (count) {
        case 1:
            offsets.push({ x: 0, y: 0 }); // 居中
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
        default: // 5個或更多
            // 計算圓形分佈
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * 2 * Math.PI;
                offsets.push({
                    x: Math.cos(angle) * baseOffset,
                    y: Math.sin(angle) * baseOffset
                });
            }
            break;
    }

    return offsets;
}

// ★★★ 更新遊戲顯示 (從狀態更新中分離出來) ★★★
function updateGameDisplay(oldState) {
    // 更新最大玩家數顯示 (來自當前 gameState)
    maxPlayersDisplay.textContent = gameState.maxPlayers || 5;

    // 更新玩家計數顯示
    const playerCount = Object.keys(gameState.players || {}).length;
    playerCountDisplay.textContent = playerCount;

    // 更新 UI 中的玩家列表
    updatePlayersList();

    // 更新地圖上的玩家標記
    updatePlayerMarkers(oldState); // 傳遞 oldState 用於動畫檢查
}

// 更新玩家列表
function updatePlayersList() {
    playersList.innerHTML = '';
    const playerIds = Object.keys(gameState.players || {});

    if (playerIds.length === 0) {
        playersList.innerHTML = '<li>沒有玩家連接</li>';
        return;
    }

    // --- 使用 playerIdToColorIndex 確保顏色一致 ---
    // 1. 按名稱排序以確定顏色順序
    const sortedPlayerIdsForColor = playerIds.sort((a, b) => {
        const nameA = gameState.players[a]?.name || '';
        const nameB = gameState.players[b]?.name || '';
        return nameA.localeCompare(nameB);
    });
    const playerIdToColorIndex = new Map();
    sortedPlayerIdsForColor.forEach((id, index) => {
        playerIdToColorIndex.set(id, (index % 5) + 1); // 顏色索引 1-5
    });
    // --- 顏色分配結束 ---

    // 按顯示順序排序（可以按名稱，或者按加入順序等，這裡按名稱）
    const sortedPlayerIdsForList = Object.keys(gameState.players || {}).sort((a, b) => {
        const nameA = gameState.players[a]?.name || '';
        const nameB = gameState.players[b]?.name || '';
        return nameA.localeCompare(nameB);
    });


    sortedPlayerIdsForList.forEach(id => {
        const player = gameState.players[id];
        const li = document.createElement('li');
        // 使用 textContent 更安全
        li.textContent = `${player.name} (位置: ${player.position})`;
        const colorIndex = playerIdToColorIndex.get(id) || 1; // 獲取對應顏色
        li.style.borderLeft = `5px solid ${getPlayerColor(colorIndex)}`; // 用顏色標識
        li.style.paddingLeft = '10px';
        li.style.marginBottom = '5px';

        if (id === playerId) {
            li.textContent += ' (你)';
            li.style.fontWeight = 'bold';
            li.classList.add('current-player');
        }

        playersList.appendChild(li);
    });
}

// 連接到WebSocket
function connectWebSocket() {
    updateConnectionStatus('connecting', '連接中...');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 正確編碼傳遞玩家名稱
    const wsUrl = `${protocol}//${window.location.host}?clientType=controller&roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = function() {
        console.log('WebSocket連接已建立');
        isConnected = true;
        updateConnectionStatus('online', '已連接');
        // 不再需要顯式請求狀態，服務器會在連接時發送
    };

    ws.onmessage = function(event) {
        handleWebSocketMessage(event.data);
    };

    ws.onclose = function(event) {
        console.log('WebSocket連接已關閉', event.code, event.reason);
        isConnected = false;
        updateConnectionStatus('offline', `已斷線 (${event.code})`);
        // 處理特定的關閉代碼 (例如，房間滿了、名稱被佔用)
        if (event.code === 4001) { // 示例：房間滿了的代碼 (由服務器定義)
            alert('無法重新連接：房間已滿。');
            window.location.href = 'index.html';
        } else if (event.code === 1011 && event.reason.includes("找不到房間")) {
             alert('房間不存在或已被關閉。');
             window.location.href = 'index.html';
        } else if (event.code >= 4000) { // 一般應用程序錯誤
             alert(`連接錯誤: ${event.reason || '未知錯誤'}`);
             // 可以允許重試或重定向
             window.location.href = 'index.html'; // 或者直接重定向
        } else if (event.code !== 1000 && event.code !== 1001 && event.code !== 1005) { // 不在正常關閉或無狀態碼時重試
            // 在意外關閉時嘗試重新連接
            console.log('5秒後嘗試重新連接...');
            setTimeout(connectWebSocket, 5000);
        }
    };

    ws.onerror = function(error) {
        console.error('WebSocket錯誤:', error);
        updateConnectionStatus('offline', '連接錯誤');
        // error 事件通常在 close 事件之前，讓 onclose 處理重連邏輯
    };
}

// 處理收到的WebSocket消息
function handleWebSocketMessage(data) {
    try {
        const message = JSON.parse(data);
        // console.log("收到 WS 消息:", message.type);

        switch (message.type) {
            case 'gameStateUpdate':
                // ★★★ 存儲收到的狀態 ★★★
                const oldState = { ...gameState }; // 保留副本用於比較
                gameState = message.gameState; // 用服務器狀態覆蓋本地狀態
                // ★★★ 從消息更新房間名稱 ★★★
                if (message.roomName && roomName !== message.roomName) {
                    roomName = message.roomName;
                    roomNameDisplay.textContent = roomName;
                }
                // ★★★ 僅在地圖配置更改（或首次加載）時重新創建地圖 ★★★
                if (!oldState.mapType || oldState.mapLoopSize !== gameState.mapLoopSize || oldState.mapType !== gameState.mapType || oldState.mapRows !== gameState.mapRows || oldState.mapCols !== gameState.mapCols) {
                     console.log("地圖配置更改或初始加載，重新創建地圖。");
                     createGameMap(); // 這將使用新的 gameState
                 } else {
                     // 如果地圖結構沒變，只更新顯示（玩家列表、標記位置等）
                     updateGameDisplay(oldState);
                 }
                break;

            case 'playerInfo':
                playerId = message.playerId; // 存儲我們自己的 ID
                console.log(`收到玩家 ID: ${playerId}`);
                // 初始 gameStateUpdate 通常緊隨其後，所以這裡無需更新顯示
                break;

            case 'error':
                console.error('伺服器錯誤:', message.message);
                alert(`伺服器錯誤: ${message.message}`);
                 // 根據錯誤嚴重性考慮關閉 WS 或重定向
                 if (message.message === "房間已滿" || message.message === "玩家名稱已被使用") {
                     if(ws) ws.close();
                     window.location.href = 'index.html';
                 }
                break;

            default:
                console.log('收到未知類型消息:', message);
        }
    } catch (error) {
        console.error('解析消息錯誤:', error, data);
    }
}

// 通過 WebSocket 發送移動命令
function sendMoveCommand(direction) {
    if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
         console.warn("WebSocket 未連接，無法發送移動命令。");
         return;
     }

    const moveCommand = {
        type: 'moveCommand',
        direction: direction
    };

    try {
        ws.send(JSON.stringify(moveCommand));
        console.log(`發送移動命令: ${direction}`);
    } catch (error) {
         console.error("通過 WebSocket 發送移動命令失敗:", error);
         updateConnectionStatus('offline', '發送錯誤');
    }
}

// 應用按鈕冷卻時間
function applyButtonCooldown(button) {
    button.disabled = true; // 立即禁用
    button.classList.add('btn-cooldown');

    setTimeout(() => {
        // 僅在仍連接時重新啟用
        if (isConnected) {
            button.disabled = false;
        }
        button.classList.remove('btn-cooldown');
    }, 500); // 500ms 冷卻
}

// 更新連接狀態顯示
function updateConnectionStatus(status, message) {
    connectionStatus.className = status; // CSS class: 'online', 'offline', 'connecting'
    statusText.textContent = message;

     // 根據連接狀態禁用/啟用移動按鈕
     const isOnline = status === 'online';
     moveForwardBtn.disabled = !isOnline;
     moveBackwardBtn.disabled = !isOnline;
     if (!isOnline) {
         moveForwardBtn.classList.remove('btn-cooldown'); // 如果斷開連接，移除冷卻狀態
         moveBackwardBtn.classList.remove('btn-cooldown');
     }
}

// 獲取玩家顏色 (基於索引)
function getPlayerColor(index) {
    const colors = [
        '#e74c3c', // 紅
        '#3498db', // 藍
        '#2ecc71', // 綠
        '#f1c40f', // 黃
        '#9b59b6'  // 紫
    ];
    return colors[(index - 1) % colors.length]; // 使用模數循環
}

// --- END OF FILE game.js ---