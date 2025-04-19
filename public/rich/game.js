// game.js - Simple Walker 遊戲頁面腳本

// 遊戲狀態
let gameState = {
    mapLoopSize: 10,
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
const playersContainer = document.getElementById('players-container');
const connectionStatus = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');
const moveForwardBtn = document.getElementById('move-forward');
const moveBackwardBtn = document.getElementById('move-backward');
const leaveGameBtn = document.getElementById('leave-game');

// 在頁面加載時，檢查 URL 中是否有房間 ID 和玩家名稱
document.addEventListener('DOMContentLoaded', function() {
    // 獲取 URL 參數
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('roomId');
    playerName = urlParams.get('playerName');
    
    if (!roomId || !playerName) {
        alert('缺少必要參數，即將返回首頁');
        window.location.href = 'index.html';
        return;
    }
    
    // 設置顯示玩家名稱和房間 ID
    playerNameDisplay.textContent = playerName;
    roomIdDisplay.textContent = roomId;
    
    // 創建遊戲地圖
    createGameMap();
    
    // 連接到 WebSocket
    connectWebSocket();
    
    // 設置按鈕事件
    setupEventListeners();
    
    // 向伺服器請求玩家位置
    requestPlayerPositionFromServer();
});

// 請求玩家位置
function requestPlayerPositionFromServer() {
    if (!roomId || !playerName) {
        console.error('無法請求玩家位置，缺少房間 ID 或玩家名稱');
        return;
    }

    // 假設你的伺服器有一個 API 來返回玩家的最後位置
    fetch(`/api/player-position?roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updatePlayerPosition(data.position); // 更新玩家的位置
            } else {
                console.error('無法獲取玩家位置');
            }
        })
        .catch(error => console.error('請求錯誤:', error));
}

// 更新玩家位置
function updatePlayerPosition(position) {
    const playerMarker = document.getElementById(`player-${playerId}`);
    const cell = document.getElementById(`cell-${position}`);
    const cellRect = cell.getBoundingClientRect();
    
    // 更新玩家標記的位置
    playerMarker.style.left = `${cellRect.left + (cell.offsetWidth / 2) - 15}px`;
    playerMarker.style.top = `${cellRect.top + (cell.offsetHeight / 2) - 15}px`;
}

// 設置按鈕事件
function setupEventListeners() {
    // 移動按鈕
    moveForwardBtn.addEventListener('click', function() {
        if (!isConnected || moveForwardBtn.classList.contains('btn-cooldown')) return;
        
        sendMoveCommand('forward');
        applyButtonCooldown(moveForwardBtn);
    });
    
    moveBackwardBtn.addEventListener('click', function() {
        if (!isConnected || moveBackwardBtn.classList.contains('btn-cooldown')) return;
        
        sendMoveCommand('backward');
        applyButtonCooldown(moveBackwardBtn);
    });
    
    // 離開遊戲按鈕
    leaveGameBtn.addEventListener('click', function() {
        if (confirm('確定要離開遊戲嗎？')) {
            // 清除保存的會話信息
            sessionStorage.removeItem('currentRoom');
            sessionStorage.removeItem('playerName');
            
            // 關閉WebSocket連接
            if (ws) {
                ws.close();
            }
            
            // 返回首頁
            window.location.href = 'index.html';
        }
    });
    
    // 窗口關閉時清理
    window.addEventListener('beforeunload', function() {
        if (ws) {
            ws.close();
        }
    });
}

// 創建遊戲地圖
function createGameMap() {
    mapContainer.innerHTML = '';
    
    // 創建10個格子的環形地圖
    for (let i = 0; i < 10; i++) {
        const cell = document.createElement('div');
        cell.className = 'map-cell';
        cell.id = `cell-${i}`;
        
        const cellNumber = document.createElement('span');
        cellNumber.className = 'map-cell-number';
        cellNumber.textContent = i;
        
        cell.appendChild(cellNumber);
        mapContainer.appendChild(cell);
    }
}

// 連接到WebSocket
function connectWebSocket() {
    updateConnectionStatus('connecting', '連接中...');
    
    // 確定WebSocket URL (支援HTTPS)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?clientType=controller&roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;
    
    // 創建WebSocket連接
    ws = new WebSocket(wsUrl);
    
    // 連接打開時
    ws.onopen = function() {
        console.log('WebSocket連接已建立');
        isConnected = true;
        updateConnectionStatus('online', '已連接');
    };
    
    // 收到消息時
    ws.onmessage = function(event) {
        handleWebSocketMessage(event.data);
    };
    
    // 連接關閉時
    ws.onclose = function(event) {
        console.log('WebSocket連接已關閉', event.code, event.reason);
        isConnected = false;
        updateConnectionStatus('offline', '已斷線');
        
        // 嘗試重新連接
        setTimeout(connectWebSocket, 3000);
    };
    
    // 連接錯誤時
    ws.onerror = function(error) {
        console.error('WebSocket錯誤:', error);
        updateConnectionStatus('offline', '連接錯誤');
    };
}

// 處理收到的WebSocket消息
function handleWebSocketMessage(data) {
    try {
        const message = JSON.parse(data);
        
        switch (message.type) {
            case 'gameStateUpdate':
                // 更新遊戲狀態
                updateGameState(message);
                break;
            
            case 'playerInfo':
                // 接收玩家ID和名稱確認
                playerId = message.playerId;
                console.log(`收到玩家ID: ${playerId}`);
                break;
            
            case 'error':
                // 處理錯誤消息
                console.error('伺服器錯誤:', message.message);
                alert(`伺服器錯誤: ${message.message}`);
                break;
            
            default:
                console.log('收到未知類型消息:', message);
        }
    } catch (error) {
        console.error('解析消息錯誤:', error, data);
    }
}

// 更新遊戲狀態
function updateGameState(message) {
    const oldState = { ...gameState };
    
    // 更新房間資訊
    if (message.roomName && roomName !== message.roomName) {
        roomName = message.roomName;
        roomNameDisplay.textContent = roomName;
    }
    
    // 更新遊戲狀態
    gameState = message.gameState;
    
    // 更新最大玩家數顯示
    maxPlayersDisplay.textContent = gameState.maxPlayers;
    
    // 更新玩家數量顯示
    const playerCount = Object.keys(gameState.players).length;
    playerCountDisplay.textContent = playerCount;
    
    // 更新玩家列表
    updatePlayersList();
    
    // 更新玩家位置標記
    updatePlayerMarkers(oldState);
}

// 更新玩家列表
function updatePlayersList() {
    playersList.innerHTML = '';
    
    const playerIds = Object.keys(gameState.players);
    if (playerIds.length === 0) {
        const li = document.createElement('li');
        li.textContent = '沒有玩家連接';
        playersList.appendChild(li);
        return;
    }
    
    // 為每個玩家創建一個列表項
    let colorIndex = 1;
    playerIds.forEach(id => {
        const player = gameState.players[id];
        const li = document.createElement('li');
        li.textContent = `${player.name} (位置: ${player.position})`;
        li.style.borderColor = getPlayerColor(colorIndex);
        
        // 標記當前玩家
        if (id === playerId) {
            li.textContent += ' (你)';
            li.style.fontWeight = 'bold';
        }
        
        playersList.appendChild(li);
        colorIndex++;
    });
}

// 更新玩家位置標記
function updatePlayerMarkers(oldState) {
    // 清空玩家容器
    playersContainer.innerHTML = '';
    
    // 獲取格子位置信息
    const cells = document.querySelectorAll('.map-cell');
    
    // 為每個玩家創建標記
    let colorIndex = 1;
    for (const id in gameState.players) {
        const player = gameState.players[id];
        const oldPlayer = oldState.players && oldState.players[id];
        
        // 創建玩家標記元素
        const marker = document.createElement('div');
        marker.className = `player-marker player-color-${colorIndex}`;
        marker.id = `player-${id}`;
        marker.textContent = player.name.charAt(0).toUpperCase();
        marker.title = player.name;
        
        // 設置標記位置
        const cellIndex = player.position;
        const cellElement = cells[cellIndex];
        if (cellElement) {
            const cellRect = cellElement.getBoundingClientRect();
            const containerRect = playersContainer.getBoundingClientRect();
            
            // 計算相對於容器的位置
            const left = cellElement.offsetLeft + (cellElement.offsetWidth / 2) - 15;
            const top = cellElement.offsetTop + (cellElement.offsetHeight / 2) - 15;
            
            marker.style.left = `${left}px`;
            marker.style.top = `${top}px`;
            
            // 如果位置變化了，添加動畫效果
            if (oldPlayer && oldPlayer.position !== player.position) {
                marker.classList.add('player-moving');
                setTimeout(() => {
                    marker.classList.remove('player-moving');
                }, 500);
            }
        }
        
        playersContainer.appendChild(marker);
        colorIndex++;
        
        // 最多支持5個玩家顏色
        if (colorIndex > 5) colorIndex = 1;
    }
}

// 玩家移動時更新位置
function sendMoveCommand(direction) {
    if (!isConnected || !ws) return;

    const moveCommand = {
        type: 'moveCommand',
        direction: direction
    };

    ws.send(JSON.stringify(moveCommand));
    console.log(`發送移動命令: ${direction}`);
    
    // 更新玩家位置到資料庫
    updatePlayerPositionInServer(direction);
}

// 更新伺服器中的玩家位置
function updatePlayerPositionInServer(direction) {
    const position = gameState.players[playerId].position;
    
    // 向伺服器發送更新位置請求
    fetch(`/api/update-player-position`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            roomId: roomId,
            playerName: playerName,
            newPosition: position
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.error('無法更新玩家位置');
        }
    })
    .catch(error => console.error('請求錯誤:', error));
}

// 應用按鈕冷卻時間
function applyButtonCooldown(button) {
    button.classList.add('btn-cooldown');
    button.disabled = true;
    
    setTimeout(() => {
        button.classList.remove('btn-cooldown');
        button.disabled = false;
    }, 500); // 500ms 冷卻時間
}
  
// 更新連接狀態顯示
function updateConnectionStatus(status, message) {
    connectionStatus.className = status;
    statusText.textContent = message;
}

// 獲取玩家顏色
function getPlayerColor(index) {
    const colors = [
        '#e74c3c', // 紅色
        '#3498db', // 藍色
        '#2ecc71', // 綠色
        '#f39c12', // 橙色
        '#9b59b6'  // 紫色
    ];
    
    // 確保索引在範圍內
    index = (index - 1) % colors.length;
    if (index < 0) index = 0;
    
    return colors[index];
}
