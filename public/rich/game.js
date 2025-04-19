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

// 更新玩家位置標記
function updatePlayerMarkers(oldState) {
     // Ensure map elements exist before trying to place markers
     if (!mapContainer.firstChild) {
          console.warn("Map container is empty, cannot update player markers yet.");
          return;
      }

    // Clear only the players container
    playersContainer.innerHTML = '';

    // For each player in the current gameState
    let colorIndex = 1;
    const playerIds = Object.keys(gameState.players || {});

    playerIds.forEach(id => {
        const player = gameState.players[id];
        const oldPlayer = oldState?.players?.[id]; // Safely access old player data

        // Get the map cell element corresponding to the player's position
        const cellElement = document.getElementById(`cell-${player.position}`);

        if (cellElement) {
            // Create player marker element
            const marker = document.createElement('div');
            marker.className = `player-marker player-color-${colorIndex}`; // Use CSS for color
            marker.id = `player-${id}`;
            // Use first initial, handle potential empty names
            marker.textContent = player.name ? player.name.charAt(0).toUpperCase() : '?';
            marker.title = player.name || '未知玩家'; // Tooltip

            // Calculate position RELATIVE TO THE MAP CONTAINER
            // This works for both circle and rectangle layouts as long as cells have correct IDs
            const markerSize = 30; // Match CSS marker size
            const cellRect = cellElement.getBoundingClientRect();
            const containerRect = mapContainer.getBoundingClientRect(); // Use map container as reference

            // Position marker center over cell center
             // Use offsetLeft/Top relative to the mapContainer's offsetParent
             const left = cellElement.offsetLeft + (cellElement.offsetWidth / 2) - (markerSize / 2);
             const top = cellElement.offsetTop + (cellElement.offsetHeight / 2) - (markerSize / 2);

            marker.style.position = 'absolute'; // Essential for left/top positioning
            marker.style.left = `${left}px`;
            marker.style.top = `${top}px`;

            // Animate if position changed
            if (oldPlayer && oldPlayer.position !== player.position) {
                marker.classList.add('player-moving');
                // Remove class after animation duration (match CSS)
                setTimeout(() => {
                    marker.classList.remove('player-moving');
                }, 500);
            }

            playersContainer.appendChild(marker);

        } else {
            console.warn(`Could not find cell element for ID: cell-${player.position} for player ${player.name}`);
        }

        // Increment color index
        colorIndex++;
        if (colorIndex > 5) colorIndex = 1;
    });
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