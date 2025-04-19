// --- START OF FILE game.js ---

// game.js - Simple Walker 遊戲頁面腳本

// ★★★ Default Game State Structure (Now includes map info) ★★★
let gameState = {
    mapType: 'circle', // Default type
    mapRows: null,
    mapCols: null,
    mapLoopSize: 10,   // Default size
    maxPlayers: 5,
    players: {},
    gameStarted: false
};

// Player資訊
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
const playersContainer = document.getElementById('players-container'); // For player markers
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

    // Set initial display info
    playerNameDisplay.textContent = playerName;
    roomIdDisplay.textContent = roomId;
    roomNameDisplay.textContent = '載入中...'; // Set initial room name
    maxPlayersDisplay.textContent = gameState.maxPlayers; // Show default max players

    // ★★★ Delay map creation until gamestate received ★★★
    // createGameMap(); // Don't create map here initially

    // 連接到 WebSocket
    connectWebSocket();

    // 設置按鈕事件
    setupEventListeners();

    // Request initial position (optional, WS gameState update handles this too)
    // requestPlayerPositionFromServer(); // Commented out as WS provides state
});

// Function to request player position (optional, WS handles state)
// function requestPlayerPositionFromServer() { ... }

// Function to update player position based on gameState (called by updatePlayerMarkers)
// function updatePlayerPosition(position) { ... } // Not needed directly, marker logic handles it

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

// ★★★ Master function to create map based on gameState ★★★
function createGameMap() {
    mapContainer.innerHTML = ''; // Clear previous map
    playersContainer.innerHTML = ''; // Clear player markers

    console.log('Creating map based on gameState:', gameState);

    if (!gameState || !gameState.mapType) {
        console.error("Cannot create map: gameState or mapType missing.");
        mapContainer.innerHTML = '<p style="color:red;">地圖加載失敗</p>';
        return;
    }

    if (gameState.mapType === 'rectangle' && gameState.mapRows && gameState.mapCols) {
        createRectangleMap(gameState.mapRows, gameState.mapCols);
    } else {
        // Default to circle or handle explicitly
        createCircleMap(gameState.mapLoopSize || 10); // Use mapLoopSize for circle too
    }

     // After map is created, update player markers based on current gameState
     updatePlayerMarkers(null); // Pass null as oldState on initial creation
}

// ★★★ Create Circle Map Function ★★★
function createCircleMap(size) {
    mapContainer.className = 'circle-map-container'; // Add class for potential specific styling
    for (let i = 0; i < size; i++) {
        const cell = document.createElement('div');
        cell.className = 'map-cell'; // Standard class for path cells
        cell.id = `cell-${i}`;

        const cellNumber = document.createElement('span');
        cellNumber.className = 'map-cell-number';
        cellNumber.textContent = i;

        cell.appendChild(cellNumber);
        mapContainer.appendChild(cell);
    }
    // Position circle cells (Example - requires specific CSS or JS positioning logic)
    // This part might need refinement based on your desired circle layout CSS
    const cells = mapContainer.querySelectorAll('.map-cell');
    const radius = 120; // Adjust as needed
    const centerX = mapContainer.offsetWidth / 2;
    const centerY = mapContainer.offsetHeight / 2;
    cells.forEach((cell, index) => {
        const angle = (index / size) * 2 * Math.PI - (Math.PI / 2); // Start from top
        const x = centerX + radius * Math.cos(angle) - cell.offsetWidth / 2;
        const y = centerY + radius * Math.sin(angle) - cell.offsetHeight / 2;
        cell.style.position = 'absolute'; // Required for positioning
        cell.style.left = `${x}px`;
        cell.style.top = `${y}px`;
    });

}

// ★★★ Create Rectangle Map Function (Adapted from reference) ★★★
function createRectangleMap(mapRows, mapCols) {
     mapContainer.className = 'rectangle-map-container'; // Add class for potential specific styling
     // Set grid styles directly on the mapContainer
     mapContainer.style.display = 'grid';
     mapContainer.style.gridTemplateColumns = `repeat(${mapCols}, auto)`; // Adjust column width as needed
     mapContainer.style.gridTemplateRows = `repeat(${mapRows}, auto)`;    // Adjust row height as needed
     mapContainer.style.maxWidth = `${mapCols * 60}px`; // Example max width based on cell size
     mapContainer.style.margin = '0 auto'; // Center the grid

     // Calculate loop size to ensure indices are correct
     const mapLoopSize = 2 * mapCols + 2 * (mapRows - 2);

    for (let r = 0; r < mapRows; r++) {
        for (let c = 0; c < mapCols; c++) {
            const cell = document.createElement('div');
            const isPathCell = r === 0 || r === mapRows - 1 || c === 0 || c === mapCols - 1;

            cell.className = isPathCell ? 'map-cell' : 'map-cell empty'; // Add 'empty' class for non-path cells

            if (isPathCell) {
                // Calculate the path index (Sequential loop index)
                let pathIndex = -1;
                if (r === 0) { // Top edge (left to right)
                    pathIndex = c;
                } else if (c === mapCols - 1 && r > 0 && r < mapRows - 1) { // Right edge (top to bottom)
                    pathIndex = mapCols + (r - 1);
                } else if (r === mapRows - 1) { // Bottom edge (right to left)
                    pathIndex = mapCols + (mapRows - 2) + (mapCols - 1 - c);
                } else if (c === 0 && r > 0 && r < mapRows - 1) { // Left edge (bottom to top)
                    pathIndex = 2 * mapCols + mapRows - 3 + (mapRows - 1 - r); // Corrected based on re-check
                    // Alternative calculation: start from end index and go backwards
                    // pathIndex = mapLoopSize - (rows - 1 - r); -> Not quite right
                }

                // Validate index calculation - should be 0 to mapLoopSize-1
                if (pathIndex >= 0 && pathIndex < mapLoopSize) {
                    cell.id = `cell-${pathIndex}`; // Assign ID only to valid path cells
                    const cellNumber = document.createElement('span');
                    cellNumber.className = 'map-cell-number';
                    cellNumber.textContent = pathIndex;
                    cell.appendChild(cellNumber);
                } else {
                     console.error(`Calculated invalid pathIndex: ${pathIndex} for cell (${r},${c})`);
                     cell.classList.add('error'); // Mark cells with bad index calculation
                     cell.textContent = 'E';
                }

            } else {
                 // Style empty cells differently (e.g., make them less prominent)
                 // The 'empty' class can be used in CSS
            }
            mapContainer.appendChild(cell);
        }
    }
}

// 連接到WebSocket
function connectWebSocket() {
    updateConnectionStatus('connecting', '連接中...');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Pass player name correctly encoded
    const wsUrl = `${protocol}//${window.location.host}?clientType=controller&roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = function() {
        console.log('WebSocket連接已建立');
        isConnected = true;
        updateConnectionStatus('online', '已連接');
        // No longer need to request state explicitly, server sends on connect
    };

    ws.onmessage = function(event) {
        handleWebSocketMessage(event.data);
    };

    ws.onclose = function(event) {
        console.log('WebSocket連接已關閉', event.code, event.reason);
        isConnected = false;
        updateConnectionStatus('offline', `已斷線 (${event.code})`);
        // Handle specific close codes (e.g., room full, name taken)
        if (event.code === 4001) { // Example: Room Full code from server
            alert('無法重新連接：房間已滿。');
            window.location.href = 'index.html';
        } else if (event.code === 1011 && event.reason.includes("找不到房間")) {
             alert('房間不存在或已被關閉。');
             window.location.href = 'index.html';
        } else if (event.code >= 4000) { // General application errors
             alert(`連接錯誤: ${event.reason || '未知錯誤'}`);
             // Maybe allow retry or redirect
             // setTimeout(connectWebSocket, 5000); // Retry after 5s
             window.location.href = 'index.html'; // Or just redirect
        } else if (event.code !== 1000 && event.code !== 1001 && event.code !== 1005) { // Don't retry on normal close or no status
            // Attempt to reconnect on unexpected closures
            console.log('Attempting to reconnect in 5 seconds...');
            setTimeout(connectWebSocket, 5000);
        }
    };

    ws.onerror = function(error) {
        console.error('WebSocket錯誤:', error);
        updateConnectionStatus('offline', '連接錯誤');
        // Error event often precedes close event, let onclose handle reconnect logic
    };
}

// 處理收到的WebSocket消息
function handleWebSocketMessage(data) {
    try {
        const message = JSON.parse(data);
        // console.log("Received WS message:", message.type);

        switch (message.type) {
            case 'gameStateUpdate':
                // ★★★ Store the received state ★★★
                const oldState = { ...gameState }; // Keep copy for comparison
                gameState = message.gameState; // OVERWRITE local state with server state
                // ★★★ Update room name from message ★★★
                if (message.roomName && roomName !== message.roomName) {
                    roomName = message.roomName;
                    roomNameDisplay.textContent = roomName;
                }
                // ★★★ Re-create map ONLY if map config changes (or first time) ★★★
                if (!oldState || oldState.mapLoopSize !== gameState.mapLoopSize || oldState.mapType !== gameState.mapType) {
                     console.log("Map configuration changed or initial load, recreating map.");
                     createGameMap(); // This will now use the new gameState
                 }
                updateGameDisplay(oldState); // Update player list, counts, markers
                break;

            case 'playerInfo':
                playerId = message.playerId; // Store our own ID
                console.log(`Received player ID: ${playerId}`);
                // Initial gameStateUpdate usually follows, so no need to update display here
                break;

            case 'error':
                console.error('伺服器錯誤:', message.message);
                alert(`伺服器錯誤: ${message.message}`);
                 // Consider closing WS or redirecting based on error severity
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

// ★★★ Update Game Display (Separated from state update) ★★★
function updateGameDisplay(oldState) {
    // Update max players display (from current gameState)
    maxPlayersDisplay.textContent = gameState.maxPlayers || 5;

    // Update player count display
    const playerCount = Object.keys(gameState.players || {}).length;
    playerCountDisplay.textContent = playerCount;

    // Update players list in UI
    updatePlayersList();

    // Update player markers on the map
    updatePlayerMarkers(oldState); // Pass oldState for animation check
}


// 更新玩家列表
function updatePlayersList() {
    playersList.innerHTML = '';
    const playerIds = Object.keys(gameState.players || {}); // Use current gameState

    if (playerIds.length === 0) {
        playersList.innerHTML = '<li>沒有玩家連接</li>';
        return;
    }

    let colorIndex = 1;
    playerIds.sort((a, b) => gameState.players[a].name.localeCompare(gameState.players[b].name)); // Sort alphabetically

    playerIds.forEach(id => {
        const player = gameState.players[id];
        const li = document.createElement('li');
        // Use textContent for security
        li.textContent = `${player.name} (位置: ${player.position})`;
        li.style.borderLeft = `5px solid ${getPlayerColor(colorIndex)}`; // Style with color

        if (id === playerId) {
            li.textContent += ' (你)';
            li.style.fontWeight = 'bold';
            li.classList.add('current-player');
        }

        playersList.appendChild(li);
        colorIndex++;
        if (colorIndex > 5) colorIndex = 1; // Cycle through 5 colors
    });
}
// ★★★ 更新玩家標記函數 (已修改，處理重疊問題) ★★★
function updatePlayerMarkers(oldState) {
    // 確保地圖元素已加載，才能放置標記
    if (!mapContainer.firstChild) {
        console.warn("地圖容器為空，暫時無法更新玩家標記。");
        return;
    }

    // 只清空玩家標記的容器
    playersContainer.innerHTML = '';

    // --- 步驟 1: 按位置將玩家分組 ---
    const positionToPlayersMap = new Map(); // 結構: Map<位置索引, [玩家ID1, 玩家ID2, ...]>
    const playerIds = Object.keys(gameState.players || {}); // 使用當前的 gameState

    playerIds.forEach(id => {
        const player = gameState.players[id];
        if (player) { // 確保玩家數據存在
            const position = player.position;
            if (!positionToPlayersMap.has(position)) {
                positionToPlayersMap.set(position, []);
            }
            positionToPlayersMap.get(position).push(id);
        }
    });

    // --- 步驟 2: 確定一致的顏色分配 ---
    // 按玩家名稱字母順序排序 ID，確保每次更新顏色分配都一樣
    const sortedPlayerIds = playerIds.sort((a, b) => {
        const nameA = gameState.players[a]?.name || ''; // 安全獲取名稱
        const nameB = gameState.players[b]?.name || '';
        return nameA.localeCompare(nameB); // 使用本地化比較
    });
    const playerIdToColorIndex = new Map(); // 結構: Map<玩家ID, 顏色索引(1-5)>
    sortedPlayerIds.forEach((id, index) => {
        playerIdToColorIndex.set(id, (index % 5) + 1); // 分配 1 到 5 的顏色索引
    });


    // --- 步驟 3: 遍歷每個有玩家的位置並放置標記 ---
    positionToPlayersMap.forEach((playerIdsOnCell, position) => {
        // 獲取該位置對應的地圖格子元素
        const cellElement = document.getElementById(`cell-${position}`);
        if (!cellElement) {
            console.warn(`找不到 ID 為 cell-${position} 的格子元素`);
            return; // 如果格子不存在，跳過處理
        }

        const numPlayersOnCell = playerIdsOnCell.length; // 這個格子上的玩家數量
        const offsets = getPlayerOffsets(numPlayersOnCell); // 獲取對應數量的偏移量數組

        // 計算格子中心點的基礎坐標 (相對於地圖容器)
        const markerSize = 30; // 標記的大小，需要與 CSS 匹配
        // 使用 offsetLeft/offsetTop 相對於其 offsetParent (通常是 mapContainer)
        const cellCenterX = cellElement.offsetLeft + (cellElement.offsetWidth / 2);
        const cellCenterY = cellElement.offsetTop + (cellElement.offsetHeight / 2);
        // 計算標記左上角的基礎位置（使其中心對準格子中心）
        const baseLeft = cellCenterX - (markerSize / 2);
        const baseTop = cellCenterY - (markerSize / 2);


        // --- 步驟 4: 為這個格子上的每個玩家創建並定位標記 ---
        // 將格子內的玩家按 ID 排序，確保偏移量分配穩定
        playerIdsOnCell.sort((a, b) => a.localeCompare(b));

        playerIdsOnCell.forEach((playerId, indexInCell) => {
            const player = gameState.players[playerId];
            const oldPlayer = oldState?.players?.[playerId]; // 安全獲取舊狀態
            const colorIndex = playerIdToColorIndex.get(playerId) || 1; // 獲取一致的顏色索引

            // 創建標記元素
            const marker = document.createElement('div');
            marker.className = `player-marker player-color-${colorIndex}`; // 使用 CSS class 控制顏色
            marker.id = `player-${playerId}`;
            // 顯示玩家名字的首字母（大寫），處理名字可能為空的情況
            marker.textContent = player.name ? player.name.charAt(0).toUpperCase() : '?';
            marker.title = player.name || '未知玩家'; // 鼠標懸停提示

            // 計算最終位置（基礎位置 + 偏移量）
            const offset = offsets[indexInCell]; // 獲取這個玩家在這個格子內的偏移量
            const finalLeft = baseLeft + offset.x;
            const finalTop = baseTop + offset.y;

            marker.style.position = 'absolute'; // 必須是絕對定位
            marker.style.left = `${finalLeft}px`;
            marker.style.top = `${finalTop}px`;
            // 簡單地設置 z-index，讓後來的玩家疊在上面（如果偏移不足以完全分開）
            marker.style.zIndex = indexInCell + 1;

            // 如果玩家的位置 (position) 改變了，應用移動動畫
            if (oldPlayer && oldPlayer.position !== player.position) {
                // 動畫前最好再次確認目標格子存在
                const newCellElement = document.getElementById(`cell-${player.position}`);
                if (newCellElement) {
                    marker.classList.add('player-moving');
                    // 動畫結束後移除 class (時間要與 CSS 動畫時間匹配)
                    setTimeout(() => {
                        marker.classList.remove('player-moving');
                    }, 500);
                }
            }
            // 注意：如果玩家 position 沒變，但因為同格玩家數變化導致 offset 變了，
            // 標記會直接“跳”到新位置，目前沒有為這種情況加動畫，通常是可接受的。

            // 將創建好的標記添加到標記容器中
            playersContainer.appendChild(marker);
        });
    });
}

// ★★★ 輔助函數：根據格子上的玩家數量計算偏移量數組 ★★★
function getPlayerOffsets(count) {
    const offsets = [];
    const baseOffset = 10; // 基礎偏移量，可以調整這個值來改變分散程度
    const smallOffset = 7; // 小一點的偏移量

    // 預設偏移量，可以根據需要調整這些值以獲得最佳視覺效果
    switch (count) {
        case 1: // 1 個玩家：居中
            offsets.push({ x: 0, y: 0 });
            break;
        case 2: // 2 個玩家：左右分開
            offsets.push({ x: -smallOffset, y: 0 });
            offsets.push({ x: smallOffset, y: 0 });
            break;
        case 3: // 3 個玩家：小三角形
            offsets.push({ x: 0, y: -smallOffset }); // 上
            offsets.push({ x: -smallOffset, y: smallOffset }); // 左下
            offsets.push({ x: smallOffset, y: smallOffset }); // 右下
            break;
        case 4: // 4 個玩家：四角
            offsets.push({ x: -smallOffset, y: -smallOffset }); // 左上
            offsets.push({ x: smallOffset, y: -smallOffset }); // 右上
            offsets.push({ x: -smallOffset, y: smallOffset }); // 左下
            offsets.push({ x: smallOffset, y: smallOffset }); // 右下
            break;
        case 5: // 5 個玩家：梅花形 (中間 + 四角)
            offsets.push({ x: 0, y: 0 }); // 中
            offsets.push({ x: -baseOffset, y: -baseOffset }); // 左上
            offsets.push({ x: baseOffset, y: -baseOffset }); // 右上
            offsets.push({ x: -baseOffset, y: baseOffset }); // 左下
            offsets.push({ x: baseOffset, y: baseOffset }); // 右下
            break;
        default: // 超過 5 個玩家：隨機分散或使用固定模式（這裡簡單處理為疊加在5的基礎上）
             // 這裡只是個示例，可能需要更複雜的邏輯來處理更多玩家
             offsets.push({ x: 0, y: 0 });
             offsets.push({ x: -baseOffset, y: -baseOffset });
             offsets.push({ x: baseOffset, y: -baseOffset });
             offsets.push({ x: -baseOffset, y: baseOffset });
             offsets.push({ x: baseOffset, y: baseOffset });
             // 額外的玩家稍微再偏一點
             for(let i = 5; i < count; i++) {
                 offsets.push({ x: (i % 2 === 0 ? 1 : -1) * (baseOffset + 3), y: (Math.floor(i / 2) % 2 === 0 ? 1: -1) * (baseOffset+3) });
             }
            break;
    }

    // 確保返回的數組長度與 count 匹配 (如果 default 邏輯不完美)
    while (offsets.length < count) {
        // 添加一些備用位置，避免出錯
        offsets.push({ x: (Math.random() - 0.5) * 2 * baseOffset, y: (Math.random() - 0.5) * 2 * baseOffset });
    }

    return offsets.slice(0, count); // 只返回需要的數量
}









// Send move command via WebSocket
function sendMoveCommand(direction) {
    if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
         console.warn("WebSocket not connected, cannot send move command.");
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
         console.error("Failed to send move command via WebSocket:", error);
         // Maybe update UI to indicate error or attempt reconnect
         updateConnectionStatus('offline', '發送錯誤');
    }

    // ★★★ Remove direct call to update server position via HTTP POST ★★★
    // The WebSocket message handler on the server should now handle the DB update.
    // updatePlayerPositionInServer(direction); // REMOVE THIS LINE
}

// ★★★ Remove updatePlayerPositionInServer function ★★★
// function updatePlayerPositionInServer(direction) { ... } // REMOVE THIS FUNCTION


// 應用按鈕冷卻時間
function applyButtonCooldown(button) {
    button.disabled = true; // Disable immediately
    button.classList.add('btn-cooldown');

    setTimeout(() => {
        // Only re-enable if still connected
        if (isConnected) {
            button.disabled = false;
        }
        button.classList.remove('btn-cooldown');
    }, 500); // 500ms cooldown
}

// 更新連接狀態顯示
function updateConnectionStatus(status, message) {
    connectionStatus.className = status; // CSS class: 'online', 'offline', 'connecting'
    statusText.textContent = message;

     // Disable/Enable movement buttons based on connection status
     const isOnline = status === 'online';
     moveForwardBtn.disabled = !isOnline;
     moveBackwardBtn.disabled = !isOnline;
     if (!isOnline) {
         moveForwardBtn.classList.remove('btn-cooldown'); // Remove cooldown if disconnected
         moveBackwardBtn.classList.remove('btn-cooldown');
     }
}

// 獲取玩家顏色 (Based on index)
function getPlayerColor(index) {
    const colors = [
        '#e74c3c', // Red
        '#3498db', // Blue
        '#2ecc71', // Green
        '#f1c40f', // Yellow (Changed from orange for better contrast maybe)
        '#9b59b6'  // Purple
    ];
    return colors[(index - 1) % colors.length]; // Use modulo for cycling
}

// --- END OF FILE game.js ---