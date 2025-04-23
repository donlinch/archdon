// game.js - Simple Walker 遊戲頁面腳本

// 遊戲狀態
// 修改游戏状态中的地图大小
let gameState = {
    mapLoopSize: 42, // 7×6=42个格子
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

// 頁面載入時執行
document.addEventListener('DOMContentLoaded', function() {
    // 獲取URL參數
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('roomId');
    playerName = urlParams.get('playerName');
    
    if (!roomId || !playerName) {
        alert('缺少必要參數，即將返回首頁');
        window.location.href = 'index.html';
        return;
    }
    
    // 設置基本顯示
    playerNameDisplay.textContent = playerName;
    roomIdDisplay.textContent = roomId;
    
    // 創建地圖
    createGameMap();
    
    // 連接到WebSocket
    connectWebSocket();
    
    // 設置按鈕事件
    setupEventListeners();
});

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

// 修改创建地图的函数

// 修改创建地图的函数
// 修正後的createGameMap函數
function createGameMap() {
    mapContainer.innerHTML = '';
    
    // 設定網格佈局
    mapContainer.style.display = 'grid';
    mapContainer.style.gridTemplateColumns = 'repeat(7, 1fr)';
    mapContainer.style.gridTemplateRows = 'repeat(6, 1fr)';
    mapContainer.style.gap = '5px';
    mapContainer.style.width = '100%';
    mapContainer.style.height = '400px';
    
    // 創建7×6的環形地圖 (總共42個格子)
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
            // 計算格子在環中的索引位置
            let index = -1;
            
            // 第一行 (0-6) 從左到右
            if (row === 0) {
                index = col;
            }
            // 最後一行 (35-41) 從右到左
            else if (row === 5) {
                index = 41 - col;
            }
            // 右側列 (7-13) 從上到下
            else if (col === 6) {
                index = 7 + (row - 1);
            }
            // 左側列 (28-34) 從下到上
            else if (col === 0) {
                index = 34 - (row - 1);
            }
            // 中間部分不顯示格子
            else {
                continue;
            }
            
            const cell = document.createElement('div');
            cell.className = 'map-cell';
            cell.id = `cell-${index}`;
            
            // 設置網格位置
            cell.style.gridRow = row + 1;
            cell.style.gridColumn = col + 1;
            
            // 顯示格子編號
            const cellNumber = document.createElement('span');
            cellNumber.className = 'map-cell-number';
            cellNumber.textContent = index;
            
            cell.appendChild(cellNumber);
            mapContainer.appendChild(cell);
            
            // 將邊界格子著色，便於偵錯
            if (index === 9 || index === 10 || index === 11) {
                cell.style.backgroundColor = '#f8d7da'; // 淡紅色
            }
        }
    }
    
    // 添加可視化的環路路徑
    const path = document.createElement('div');
    path.className = 'map-path';
    mapContainer.appendChild(path);
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

// 改進的WebSocket消息處理函數
function handleWebSocketMessage(data) {
    try {
        const message = JSON.parse(data);
        console.log('收到消息:', message);
        
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

// 改進的遊戲狀態更新函數
function updateGameState(message) {
    const oldState = { ...gameState };
    
    // 更新房間資訊
    if (message.roomName && roomName !== message.roomName) {
        roomName = message.roomName;
        roomNameDisplay.textContent = roomName;
    }
    
    // 更新遊戲狀態
    gameState = message.gameState;
    
    // 確保地圖大小正確
    if (gameState.mapLoopSize !== undefined) {
        console.log(`地圖大小: ${gameState.mapLoopSize}`);
    }
    
    // 檢查是否需要重新創建地圖 (地圖大小變化)
    if (oldState.mapLoopSize !== gameState.mapLoopSize) {
        console.log(`地圖大小變更: ${oldState.mapLoopSize} -> ${gameState.mapLoopSize}`);
        // 如果地圖大小發生變化，則重新創建地圖
        createGameMap();
    }
    
    // 更新最大玩家數顯示
    maxPlayersDisplay.textContent = gameState.maxPlayers;
    
    // 更新玩家數量顯示
    const playerCount = Object.keys(gameState.players).length;
    playerCountDisplay.textContent = playerCount;
    
    // 更新玩家列表
    updatePlayersList();
    
    // 更新玩家位置標記
    updatePlayerMarkers(oldState);
    
    // 記錄所有玩家的位置 (用於調試)
    console.log("目前所有玩家位置:");
    for (const pid in gameState.players) {
        console.log(`玩家 ${gameState.players[pid].name} (${pid}): 位置 ${gameState.players[pid].position}`);
    }
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





// 修正後的updatePlayerMarkers函數
function updatePlayerMarkers(oldState) {
    // 清空玩家容器
    playersContainer.innerHTML = '';
    
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
        
        // 獲取正確的格子索引和元素
        const position = player.position;
        const cellId = `cell-${position}`;
        const cell = document.getElementById(cellId);
        
        if (cell) {
            // 獲取格子的位置
            const cellRect = cell.getBoundingClientRect();
            const mapRect = mapContainer.getBoundingClientRect();
            
            // 設置標記到格子中央
            const cellBox = cell.getBoundingClientRect();
            const containerBox = mapContainer.getBoundingClientRect();
            
            // 計算相對於mapContainer的位置
            const relativeLeft = cell.offsetLeft + (cell.offsetWidth / 2) - 15;
            const relativeTop = cell.offsetTop + (cell.offsetHeight / 2) - 15;
            
            // 設置絕對位置
            marker.style.left = `${relativeLeft}px`;
            marker.style.top = `${relativeTop}px`;
            
            // 如果位置變化了，添加動畫效果
            if (oldPlayer && oldPlayer.position !== player.position) {
                marker.classList.add('player-moving');
                setTimeout(() => {
                    marker.classList.remove('player-moving');
                }, 500);
            }
            
            // 添加當前玩家強調樣式
            if (id === playerId) {
                marker.classList.add('current-player');
            }
        } else {
            console.error(`找不到格子: cell-${position}`);
        }
        
        playersContainer.appendChild(marker);
        colorIndex++;
        
        // 最多支持5個玩家顏色
        if (colorIndex > 5) colorIndex = 1;
    }
}







// 發送移動命令
function sendMoveCommand(direction) {
    if (!isConnected || !ws) return;
    
    const moveCommand = {
        type: 'moveCommand',
        direction: direction
    };
    
    ws.send(JSON.stringify(moveCommand));
    console.log(`發送移動命令: ${direction}`);
}

// 在客户端，当收到游戏状态更新时记录日志
console.log(`收到游戏状态更新: `, message.gameState);
console.log(`地图大小: ${message.gameState.mapLoopSize}`);

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