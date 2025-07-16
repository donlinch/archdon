// monopoly-game.js - 大富翁風格遊戲腳本

// 地圖格子資訊 - 每個格子有標題和描述
// game.js
window.cellInfo = [
    { title: "起點", description: "每經過起點可以獲得一次獎勵。" },
    { title: "台北", description: "台灣的首都，這裡有著名的台北101和夜市文化。" },
    { title: "機會", description: "抽取一張機會卡，可能帶來好運或厄運。" },
    { title: "台中", description: "台灣中部的大城市，有著舒適的生活步調。" },
    { title: "繳稅", description: "必須支付所有資產20%的稅款。" },
    { title: "高鐵", description: "快速交通系統，可以前往任意城市。" },
    { title: "高雄", description: "台灣南部的港口城市，有壯觀的港口和熱情的氣氛。" },
    { title: "命運", description: "抽取一張命運卡，看看命運將帶你何方。" },
    { title: "花蓮", description: "台灣東部的城市，以太魯閣國家公園聞名。" },
    { title: "台南", description: "台灣古都，有豐富的歷史和美食文化。" },
    { title: "免費停車", description: "在此休息一回合，不會受到任何影響。" },
    { title: "墾丁", description: "台灣南端的度假勝地，有美麗的海灘和陽光。" },
    { title: "機會", description: "抽取一張機會卡，可能帶來好運或厄運。" },
    { title: "宜蘭", description: "以溫泉和綠色自然風光著稱的城市。" },
    { title: "罰款", description: "違規停車，支付罰款$150。" },
    { title: "捷運", description: "便捷的城市交通，移動到前方3格。" },
    { title: "金門", description: "台灣外島，有獨特的戰地風光和高粱酒。" },
    { title: "命運", description: "抽取一張命運卡，看看命運將帶你何方。" },
    { title: "澎湖", description: "美麗的島嶼群，有著澎湖藍的海洋風光。" },
    { title: "醫院", description: "生病了！必須在醫院休養，暫停一回合。" }, // 原為進入醫院
    { title: "綠島", description: "知名的離島，有美麗的海底風光和歷史遺跡。" },
    { title: "小琉球", description: "台灣西南外海的珊瑚礁島嶼，生態豐富。" },
    // --- 新增的格子 ---
    { title: "新地點A", description: "這是新地點A的描述。" }, // 索引 22
    { title: "新地點B", description: "這是新地點B的描述。" }  // 索引 23
];
// 遊戲狀態
let gameState = {
    mapLoopSize: 22,  // 22格的環形地圖
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

// 彈窗元素
const modal = document.getElementById('location-modal');
const locationTitle = document.getElementById('location-title');
const locationDescription = document.getElementById('location-description');
const closeModalButtons = document.querySelectorAll('.close-modal, .close-btn');

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
    
    // 創建大富翁風格地圖
    createMonopolyMap();
    
    // 連接到WebSocket
    connectWebSocket();
    
    // 設置按鈕事件
    setupEventListeners();
});
function createMonopolyMap() {
    mapContainer.innerHTML = '';

    // ★★★ 更新總格子數 ★★★
    const totalCells = 24;

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'map-cell';
        cell.id = `cell-${i}`;
        cell.dataset.cellIndex = i; // 添加 data-* 屬性以供點擊事件使用

        const title = document.createElement('div');
        title.className = 'cell-title';
        // ★★★ 確保 cellInfo 和 cellInfo[i] 有內容 ★★★
        title.textContent = cellInfo && cellInfo[i] ? cellInfo[i].title : `格 ${i}`;
        cell.appendChild(title);

        const cellNumber = document.createElement('div');
        cellNumber.className = 'cell-number';
        cellNumber.textContent = i;
        cell.appendChild(cellNumber);

        // 位置樣式設置...
        if (i >= 0 && i <= 6) {        // 頂部行 (0-6)
            cell.classList.add('top-row');
        } else if (i >= 7 && i <= 12) {   // 右側列 (7-12)
            cell.classList.add('right-column');
        } else if (i >= 13 && i <= 18) { // ★★★ 底部行 (13-18) ★★★
            cell.classList.add('bottom-row');
        } else if (i >= 19 && i <= 23) { // ★★★ 左側列 (19-23) ★★★
            cell.classList.add('left-column');
        }
        
        // 添加點擊事件
        cell.addEventListener('click', function() {
            // 確保 cellInfo 和 cellInfo[i] 有內容
            if (cellInfo && cellInfo[i]) { // 檢查是否存在對應的格子信息
                 showLocationModal(i);
            } else {
                 console.warn(`找不到索引 ${i} 的格子資訊`);
            }
        });

        mapContainer.appendChild(cell);
    }
}
// 顯示地點詳情彈窗
function showLocationModal(cellIndex) {
    // 確保 cellInfo 和索引有效
    if (!cellInfo || !cellInfo[cellIndex]) {
        console.error(`無法顯示格子詳情：找不到索引 ${cellIndex} 的格子資訊`);
        return;
    }
    
    const cell = cellInfo[cellIndex];
    
    // 設置彈窗內容
    locationTitle.textContent = cell.title;
    locationDescription.textContent = cell.description;
    
    // 顯示彈窗
    modal.classList.remove('hidden');
}

// 連接到WebSocket
function connectWebSocket() {
    updateConnectionStatus('connecting', '連接中...');
    
    // 確定WebSocket URL (支援HTTPS)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/simple-walker?clientType=controller&roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;    
    // ★★★ 在這裡加上這行來創建 WebSocket 物件 ★★★
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
        console.error('WebSocket錯誤詳情:', error);
        console.error('WebSocket連接狀態:', ws.readyState);
        updateConnectionStatus('offline', '連接錯誤');
    };
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
    
    // 關閉彈窗按鈕
    closeModalButtons.forEach(button => {
        button.addEventListener('click', function() {
            modal.classList.add('hidden');
        });
    });
    
    // 點擊彈窗外區域關閉彈窗
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.classList.add('hidden');
        }
    });
    
    // 窗口關閉時清理
    window.addEventListener('beforeunload', function() {
        if (ws) {
            ws.close();
        }
    });
}


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
            
            case 'templateUpdate':
                // 處理模板更新 - 增強版
                if (message.templateId && message.templateData) {
                    console.log(`接收模板更新: ${message.templateId}`);
                    
                    try {
                        // 應用樣式數據
                        if (message.templateData.style_data) {
                            applyTemplateStyles(message.templateData.style_data);
                            
                            // 特別處理中央圖片
                            if (message.templateData.style_data.board && 
                                message.templateData.style_data.board.centerImageUrl) {
                                const centerImageContainer = document.getElementById('map-center-image-container');
                                if (centerImageContainer) {
                                    const centerImage = centerImageContainer.querySelector('img');
                                    if (centerImage) {
                                        // 保存原圖片URL以便處理錯誤
                                        const originalSrc = centerImage.src;
                                        centerImage.src = message.templateData.style_data.board.centerImageUrl;
                                        console.log('已更新中央圖片:', message.templateData.style_data.board.centerImageUrl);
                                        
                                        // 添加錯誤處理
                                        centerImage.onerror = function() {
                                            console.error('圖片載入失敗:', centerImage.src);
                                            centerImage.src = originalSrc; // 恢復原圖片
                                            console.log('已恢復原圖片');
                                        };
                                    }
                                }
                            }
                        }
                        
                        // 更新格子內容
                        if (message.templateData.cell_data && Array.isArray(message.templateData.cell_data)) {
                            // 確保 cellInfo 已經定義
                            if (typeof cellInfo === 'undefined') {
                                console.warn('cellInfo 未定義，嘗試初始化後更新格子內容');
                                window.cellInfo = [];
                            }
                            
                            // 嘗試更新格子內容
                            try {
                                updateCellContents(message.templateData.cell_data);
                                console.log('已更新格子內容');
                            } catch (cellError) {
                                console.error('更新格子內容時出錯:', cellError);
                            }
                        } else {
                            console.warn('模板數據中無有效的格子數據');
                        }
                        
                        // 保存當前模板ID
                        currentTemplateId = message.templateId;
                        console.log(`伺服器已更新模板: ${message.templateData.template_name}`);
                    } catch (templateError) {
                        console.error('處理模板更新時出錯:', templateError);
                    }
                }
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


// 修復玩家可見性切換按鈕消失的問題

function updatePlayersList() {
    playersList.innerHTML = '';
  
    // 先把所有 IDs 拿出來
    const allIds = Object.keys(gameState.players);
    // 排序，讓自己排第一
    const orderedIds = [
      ...allIds.filter(id => id === playerId),
      ...allIds.filter(id => id !== playerId)
    ];
  
    orderedIds.forEach(id => {
      const player = gameState.players[id];
      const li = document.createElement('li');
  
      // 顯示名字和位置
      const playerInfo = document.createElement('span');
      // 安全地存取 cellInfo
      const position = player.position;
      let locationName = "未知位置";
      if (cellInfo && cellInfo[position] && cellInfo[position].title) {
        locationName = cellInfo[position].title;
      }
      playerInfo.textContent = `${player.name} (${locationName})`;
      
      if (id === playerId) {
        playerInfo.textContent += ' (你)';
        playerInfo.style.fontWeight = 'bold';
        
        // 顯示/隱藏按鈕 - 無論玩家狀態如何，都應該顯示此按鈕
        const btn = document.createElement('button');
        const isVisible = player.visible !== false; // 預設為 true
        
        // 根據目前可見性狀態設定按鈕樣式
        btn.className = `btn-toggle-visibility ${isVisible ? 'visible' : 'hidden'}`;
        btn.textContent = isVisible ? '👁️ 顯示中' : '👁️‍🗨️ 已隱藏';
        
        // 點擊事件 - 使用當前的 player.visible 屬性而非閉包中的常數
        btn.onclick = () => {
          console.log(`Toggle button clicked for player ID: ${playerId}`); // Log entry
          try {
            // 直接從 gameState 獲取最新的可見性狀態
            if (!gameState.players[playerId]) {
              console.error(`Player with ID ${playerId} not found in gameState.`);
              return; // Exit if player data is missing
            }
            const currentVisibility = gameState.players[playerId].visible !== false;
            console.log(`Current visibility: ${currentVisibility}`); // Log current state

            const newVisibility = !currentVisibility;
            console.log(`New visibility to send: ${newVisibility}`); // Log new state

            // 發送切換可見性的請求給伺服器
            ws.send(JSON.stringify({
              type: 'toggleVisibility',
              visible: newVisibility
            }));
            console.log("Sent toggleVisibility message to server."); // Log send confirmation

            // 即時更新按鈕外觀以提供視覺反饋
            btn.className = `btn-toggle-visibility ${newVisibility ? 'visible' : 'hidden'}`;
            btn.textContent = newVisibility ? '👁️ 顯示中' : '👁️‍🗨️ 已隱藏';
            console.log(`Button updated immediately. Class: ${btn.className}, Text: ${btn.textContent}`); // Log UI update
          } catch (error) {
            console.error("Error in toggleVisibility click handler:", error); // Log any errors
          }
        };
        
        li.appendChild(playerInfo);
        li.appendChild(btn); // 無論狀態如何，都添加按鈕
      } else {
        li.appendChild(playerInfo);
      }
      
      playersList.appendChild(li);
    });
  }
// 更新玩家位置標記 - 優化版
function updatePlayerMarkers(oldState) {
    // 清空所有舊的 marker DOM
    playersContainer.innerHTML = '';
  
    // 取得所有玩家 ID 及可見玩家
    const playerIds = Object.keys(gameState.players);
    const visiblePlayers = playerIds.filter(id => gameState.players[id].visible !== false);
    
    // 計算每個格子上有多少玩家
    const cellPlayerCount = {};
    visiblePlayers.forEach(id => {
        const position = gameState.players[id].position;
        if (!cellPlayerCount[position]) {
            cellPlayerCount[position] = 0;
        }
        cellPlayerCount[position]++;
    });
    
    // 每個格子的玩家計數器
    const cellPlayerIndex = {};
    
    // 開始生成玩家標記
    let colorIndex = 1;
    
    visiblePlayers.forEach(id => {
        const player = gameState.players[id];
        const oldPlayer = oldState.players ? oldState.players[id] : null;
        const cellPosition = player.position;
        
        // 計算此玩家是該格子的第幾個玩家
        if (!cellPlayerIndex[cellPosition]) {
            cellPlayerIndex[cellPosition] = 0;
        }
        const playerIndexInCell = cellPlayerIndex[cellPosition]++;
        const totalPlayersInCell = cellPlayerCount[cellPosition];
        
        // 創建玩家標記元素
        const marker = document.createElement('div');
        marker.className = `player-marker player-color-${colorIndex}`;
        marker.id = `player-${id}`;
        marker.textContent = player.name.charAt(0).toUpperCase();
        marker.title = player.name;
        
        // 設置標記位置
        const cellElement = document.getElementById(`cell-${cellPosition}`);
        
        if (cellElement) {
            // 獲取格子位置和大小
            const cellCenterX = cellElement.offsetLeft + (cellElement.offsetWidth / 2);
            const cellCenterY = cellElement.offsetTop + (cellElement.offsetHeight / 2);
            
            // 根據該格子玩家數量計算偏移
            let offsetX, offsetY;
            
            if (totalPlayersInCell <= 1) {
                // 只有一個玩家，放在中間
                offsetX = 0;
                offsetY = 0;
            } else if (totalPlayersInCell <= 5) {
                // 2-5個玩家，環形排列
                const radius = 16;
                const angle = (2 * Math.PI * playerIndexInCell) / totalPlayersInCell;
                offsetX = Math.sin(angle) * radius;
                offsetY = -Math.cos(angle) * radius;
            } else {
                // 6-20個玩家，雙環排列
                const isInnerRing = playerIndexInCell < 5;
                const ringIndex = isInnerRing ? 0 : 1;
                const indexInRing = isInnerRing ? playerIndexInCell : (playerIndexInCell - 5) % 15;
                const playersInRing = isInnerRing ? Math.min(totalPlayersInCell, 5) : Math.min(totalPlayersInCell - 5, 15);
                
                const radius = isInnerRing ? 14 : 28;
                const angle = (2 * Math.PI * indexInRing) / playersInRing;
                offsetX = Math.sin(angle) * radius;
                offsetY = -Math.cos(angle) * radius;
            }
            
            // 應用偏移
            marker.style.left = `${cellCenterX + offsetX - 12.5}px`; // 12.5px 是 marker 寬度的一半
            marker.style.top = `${cellCenterY + offsetY - 12.5}px`; // 12.5px 是 marker 高度的一半
            
            // 如果位置變化了，添加動畫效果
            if (oldPlayer && oldPlayer.position !== player.position) {
                marker.classList.add('player-moving');
                setTimeout(() => {
                    marker.classList.remove('player-moving');
                }, 500);
            }
            
            // 當前玩家標記加粗顯示
            if (id === playerId) {
                marker.style.fontWeight = 'bold';
                marker.style.border = '2px solid white';
            }
        }
        
        playersContainer.appendChild(marker);
        colorIndex++;
        
        // 最多支持5個玩家顏色
        if (colorIndex > 5) colorIndex = 1;
    });
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