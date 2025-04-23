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
// 在DOMContentLoaded事件中整合所有修改

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
    
    // 創建地圖 - 使用修正後的函數
    createGameMap();
    
    // 驗證地圖
    if (!validateMap()) {
        console.warn('初始地圖驗證失敗，嘗試緊急修復');
        emergencyMapRepair();
    }
    
    // 連接到WebSocket
    connectWebSocket();
    
    // 設置按鈕事件
    setupEventListeners();
    
    // 添加窗口大小變化處理
    window.addEventListener('resize', function() {
        // 地圖重新計算
        if (gameState && gameState.players) {
            // 保存當前狀態
            const oldState = { ...gameState };
            // 更新所有玩家標記位置
            updatePlayerMarkers(oldState);
        }
    });
    
    // 添加調試按鈕 (僅在調試模式下)
    if (DEBUG_MODE) {
        addDebugControls();
    }
});



// 添加調試控制按鈕
function addDebugControls() {
    const debugPanel = document.createElement('div');
    debugPanel.className = 'debug-panel';
    debugPanel.innerHTML = `
        <div style="position: fixed; bottom: 50px; right: 10px; z-index: 1000; background: rgba(0,0,0,0.7); padding: 5px; border-radius: 5px; color: white;">
            <button id="debug-validate">驗證地圖</button>
            <button id="debug-repair">修復地圖</button>
            <button id="debug-toggle">顯示/隱藏格子號</button>
        </div>
    `;
    document.body.appendChild(debugPanel);
    
    // 添加事件監聽
    document.getElementById('debug-validate').addEventListener('click', validateMap);
    document.getElementById('debug-repair').addEventListener('click', emergencyMapRepair);
    document.getElementById('debug-toggle').addEventListener('click', function() {
        const numbers = document.querySelectorAll('.map-cell-number');
        numbers.forEach(num => {
            num.style.display = num.style.display === 'none' ? '' : 'none';
        });
    });
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

// 修改创建地图的函数
// 完整重寫createGameMap函數，確保創建完整的42格環形地圖
function createGameMap() {
    // 清空地圖容器
    mapContainer.innerHTML = '';
    
    // 設置地圖容器樣式
    mapContainer.style.position = 'relative';
    mapContainer.style.width = '100%';
    mapContainer.style.height = '400px';
    
    // 定義環形地圖的路徑點
    const mapPoints = [];
    
    // 上方行 (0-6) - 從左到右
    for (let i = 0; i <= 6; i++) {
        mapPoints.push({
            index: i,
            x: (i / 6) * 100, // 百分比位置
            y: 0
        });
    }
    
    // 右側列 (7-13) - 從上到下
    for (let i = 1; i <= 5; i++) {
        mapPoints.push({
            index: 6 + i,
            x: 100,
            y: (i / 5) * 100
        });
    }
    
    // 下方行 (14-20) - 從右到左
    for (let i = 0; i <= 6; i++) {
        mapPoints.push({
            index: 20 - i,
            x: ((6 - i) / 6) * 100,
            y: 100
        });
    }
    
    // 左側列 (21-27) - 從下到上
    for (let i = 1; i <= 5; i++) {
        mapPoints.push({
            index: 27 - i + 1,
            x: 0,
            y: ((5 - i) / 5) * 100
        });
    }
    
    // 再添加一列，達到42個格子
    // 額外上方行 (28-34) - 從左到右
    for (let i = 0; i <= 6; i++) {
        mapPoints.push({
            index: 28 + i,
            x: (i / 6) * 100,
            y: 15 // 稍微下移
        });
    }
    
    // 額外右側列 (35-41) - 從上到下
    for (let i = 1; i <= 5; i++) {
        mapPoints.push({
            index: 34 + i,
            x: 85, // 稍微左移
            y: (i / 5) * 100
        });
    }
    
    // 確保我們有42個點
    console.log(`創建了 ${mapPoints.length} 個地圖點`);
    
    // 創建每個格子
    mapPoints.forEach(point => {
        const cell = document.createElement('div');
        cell.className = 'map-cell';
        cell.id = `cell-${point.index}`; // 每個格子的ID為 cell-0, cell-1 等
        
        // 設置位置
        cell.style.position = 'absolute';
        cell.style.left = `${point.x}%`;
        cell.style.top = `${point.y}%`;
        cell.style.transform = 'translate(-50%, -50%)'; // 居中
        cell.style.width = '40px';
        cell.style.height = '40px';
        
        // 添加格子編號
        const cellNumber = document.createElement('span');
        cellNumber.className = 'map-cell-number';
        cellNumber.textContent = point.index;
        
        // 為特定格子添加特殊樣式 (調試用)
        if (point.index >= 9 && point.index <= 14) {
            cell.style.backgroundColor = '#ffecec'; // 淡紅色背景
            cell.style.border = '2px solid #ffadad'; // 紅色邊框
        }
        
        cell.appendChild(cellNumber);
        mapContainer.appendChild(cell);
    });
    
    // 添加環形路徑指示
    const pathEl = document.createElement('div');
    pathEl.className = 'map-path';
    mapContainer.appendChild(pathEl);
    
    console.log(`完成地圖創建，總共 ${mapContainer.querySelectorAll('.map-cell').length} 個格子`);
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

// 修改handleWebSocketMessage函數，加入錯誤處理
function handleWebSocketMessage(data) {
    try {
        const message = JSON.parse(data);
        debugLog('收到消息:', message);
        
        switch (message.type) {
            case 'gameStateUpdate':
                // 更新前先驗證地圖
                if (!validateMap()) {
                    console.warn('地圖驗證失敗，嘗試修復');
                    emergencyMapRepair();
                }
                
                // 更新遊戲狀態
                updateGameState(message);
                break;
            
            case 'playerInfo':
                // 接收玩家ID和名稱確認
                playerId = message.playerId;
                debugLog(`收到玩家ID: ${playerId}`);
                break;
            
            case 'error':
                // 處理錯誤消息
                console.error('伺服器錯誤:', message.message);
                alert(`伺服器錯誤: ${message.message}`);
                break;
            
            default:
                debugLog('收到未知類型消息:', message);
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



// 完全重寫的玩家標記更新函數
function updatePlayerMarkers(oldState) {
    // 清空玩家標記容器
    playersContainer.innerHTML = '';
    
    // 為每個玩家創建標記
    let colorIndex = 1;
    
    for (const id in gameState.players) {
        const player = gameState.players[id];
        const oldPosition = oldState.players && oldState.players[id] ? oldState.players[id].position : null;
        
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
            // 直接使用getBoundingClientRect獲取格子位置
            const cellRect = cell.getBoundingClientRect();
            const containerRect = mapContainer.getBoundingClientRect();
            
            // 計算格子中心點相對於容器的位置
            const relativeLeft = cell.offsetLeft + (cell.offsetWidth / 2) - 15;
            const relativeTop = cell.offsetTop + (cell.offsetHeight / 2) - 15;
            
            marker.style.left = `${relativeLeft}px`;
            marker.style.top = `${relativeTop}px`;
            
            // 記錄日誌，幫助調試
            console.log(`放置玩家 ${player.name} 標記到位置 ${position}, 對應格子 ${cellId}, 坐標: (${relativeLeft}, ${relativeTop})`);
            
            // 如果位置變化了，添加動畫效果
            if (oldPosition !== null && oldPosition !== position) {
                console.log(`玩家 ${player.name} 從位置 ${oldPosition} 移動到 ${position}`);
                marker.classList.add('player-moving');
                
                setTimeout(() => {
                    marker.classList.remove('player-moving');
                }, 500);
            }
            
            // 標記當前玩家
            if (id === playerId) {
                marker.classList.add('current-player');
                marker.textContent += '★'; // 添加星號表示當前玩家
            }
        } else {
            console.error(`找不到格子: cell-${position}，無法放置玩家標記`);
            // 緊急備用方案：即使找不到格子，也生成一個可見的標記在地圖中央
            marker.style.left = '50%';
            marker.style.top = '50%';
            marker.style.backgroundColor = 'red';
            marker.style.opacity = '0.7';
            marker.classList.add('error-marker');
        }
        
        playersContainer.appendChild(marker);
        colorIndex++;
        
        // 最多支持5個玩家顏色
        if (colorIndex > 5) colorIndex = 1;
    }
}






// 添加備用地圖創建
function createEmergencyMap() {
    console.warn('創建備用地圖');
    
    // 清空並設置容器
    mapContainer.innerHTML = '';
    mapContainer.style.display = 'flex';
    mapContainer.style.flexWrap = 'wrap';
    mapContainer.style.justifyContent = 'center';
    
    // 創建簡單的線性地圖
    for (let i = 0; i < gameState.mapLoopSize; i++) {
        const cell = document.createElement('div');
        cell.className = 'map-cell';
        cell.id = `cell-${i}`;
        cell.style.position = 'relative';
        cell.style.margin = '5px';
        cell.style.transform = 'none';
        
        const cellNumber = document.createElement('span');
        cellNumber.className = 'map-cell-number';
        cellNumber.textContent = i;
        
        cell.appendChild(cellNumber);
        mapContainer.appendChild(cell);
    }
    
    // 確認所有格子都已創建
    validateMap();
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