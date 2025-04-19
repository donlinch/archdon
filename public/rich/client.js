// --- START OF FILE client.js ---

// client.js - Simple Walker 入口頁面腳本

// DOM 元素
const welcomePanel = document.getElementById('welcome-panel');
const createRoomPanel = document.getElementById('create-room-panel');
const joinRoomPanel = document.getElementById('join-room-panel');
const playerNamePanel = document.getElementById('player-name-panel');
const errorMessage = document.getElementById('error-message');
const activeRoomsList = document.getElementById('active-rooms-list');
const playerNameRoomInfo = document.getElementById('player-name-room-info');
const playerNameTitle = document.getElementById('player-name-title');

// ★★★ Map Options Elements ★★★
const mapTypeSelect = document.getElementById('map-type');
const rectangleOptionsDiv = document.getElementById('rectangle-options');
const mapRowsInput = document.getElementById('map-rows');
const mapColsInput = document.getElementById('map-cols');
const totalCellsSpan = document.getElementById('total-cells');
const mapPreviewContainer = document.getElementById('map-preview-container');


// 導航按鈕
document.getElementById('create-room-btn').addEventListener('click', showCreateRoomPanel);
document.getElementById('join-room-btn').addEventListener('click', showJoinRoomPanel);
document.getElementById('create-room-back').addEventListener('click', showWelcomePanel);
document.getElementById('join-room-back').addEventListener('click', showWelcomePanel);
document.getElementById('player-name-back').addEventListener('click', () => {
    const backToPanel = sessionStorage.getItem('previousPanel');
    if (backToPanel === 'join') {
        showJoinRoomPanel();
    } else {
        // ★★★ Always go back to create panel if map options were visible ★★★
        showCreateRoomPanel();
    }
});

// 表單提交
document.getElementById('create-room-submit').addEventListener('click', handleCreateRoom);
document.getElementById('join-room-submit').addEventListener('click', handleRoomSearch);
document.getElementById('player-name-submit').addEventListener('click', handleStartGame);

// ★★★ Map Options Event Listeners ★★★
mapTypeSelect.addEventListener('change', function() {
    if (this.value === 'rectangle') {
        rectangleOptionsDiv.classList.remove('hidden');
        updateMapPreview(); // Initial preview update
    } else {
        rectangleOptionsDiv.classList.add('hidden');
    }
});
mapRowsInput.addEventListener('input', updateMapPreview);
mapColsInput.addEventListener('input', updateMapPreview);


// 當頁面載入時執行
document.addEventListener('DOMContentLoaded', function() {
    // Check if we should show rectangle options on load (e.g., if validation failed and we came back)
    if (mapTypeSelect.value === 'rectangle') {
         rectangleOptionsDiv.classList.remove('hidden');
         updateMapPreview();
    }
    // Check for existing game session
    const savedRoom = sessionStorage.getItem('currentRoom');
    const savedName = sessionStorage.getItem('playerName');

    if (savedRoom && savedName) {
        // Directly enter game
        window.location.href = `game.html?roomId=${savedRoom}&playerName=${encodeURIComponent(savedName)}`;
    } else {
         // Ensure welcome panel is shown if no session
         showWelcomePanel();
    }
});

// 面板顯示函數
function showWelcomePanel() {
    hideAllPanels();
    welcomePanel.classList.remove('hidden');
    clearError();
}

function showCreateRoomPanel() {
    hideAllPanels();
    createRoomPanel.classList.remove('hidden');
    // ★★★ Reset map options to default when showing create panel ★★★
    mapTypeSelect.value = 'circle';
    rectangleOptionsDiv.classList.add('hidden');
    mapRowsInput.value = 6;
    mapColsInput.value = 7;
    clearError();
}

function showJoinRoomPanel() {
    hideAllPanels();
    joinRoomPanel.classList.remove('hidden');
    fetchActiveRooms(); // 顯示活躍房間列表
    clearError();
}

function showPlayerNamePanel(roomId, roomName, maxPlayers, comingFrom) {
    hideAllPanels();
    sessionStorage.setItem('previousPanel', comingFrom);
    sessionStorage.setItem('targetRoomId', roomId);

    // 設置標題和資訊
    playerNameTitle.textContent = comingFrom === 'create' ? '創建房間' : '加入房間';
    playerNameRoomInfo.textContent = `房間名稱: ${roomName} (最大人數: ${maxPlayers})`;

    playerNamePanel.classList.remove('hidden');
    document.getElementById('player-name').focus();
    clearError();
}

function hideAllPanels() {
    welcomePanel.classList.add('hidden');
    createRoomPanel.classList.add('hidden');
    joinRoomPanel.classList.add('hidden');
    playerNamePanel.classList.add('hidden');
}

// 錯誤處理
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function clearError() {
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
}

// ★★★ Function to update map preview ★★★
function updateMapPreview() {
    if (mapTypeSelect.value !== 'rectangle') return; // Only for rectangle

    const rows = parseInt(mapRowsInput.value) || 0;
    const cols = parseInt(mapColsInput.value) || 0;

    // Validate range (2-8)
    const validRows = Math.min(Math.max(2, rows), 8);
    const validCols = Math.min(Math.max(2, cols), 8);

    // Correct input value if it was outside range
    if (rows !== validRows) mapRowsInput.value = validRows;
    if (cols !== validCols) mapColsInput.value = validCols;

    if (validRows < 2 || validCols < 2) {
        totalCellsSpan.textContent = 'N/A';
        mapPreviewContainer.innerHTML = '<p style="font-size: 0.8em; color: red;">行和列必須至少為 2</p>';
        mapPreviewContainer.style.display = 'block'; // Use block to show message
        return;
    }

    // Calculate total path cells
    const totalCells = 2 * validCols + 2 * (validRows - 2);
    totalCellsSpan.textContent = totalCells;

    // Update visual preview
    mapPreviewContainer.innerHTML = '';
    mapPreviewContainer.style.display = 'grid';
    mapPreviewContainer.style.gridTemplateColumns = `repeat(${validCols}, 15px)`; // Use fixed size from CSS

    let pathIndex = 0;
    for (let r = 0; r < validRows; r++) {
        for (let c = 0; c < validCols; c++) {
            const cell = document.createElement('div');
            const isPathCell = r === 0 || r === validRows - 1 || c === 0 || c === validCols - 1;

            if (isPathCell) {
                cell.classList.add('path-cell');
                // Calculate index for display (matches game.js logic)
                let currentPathIndex = -1;
                 if (r === 0) { // Top edge
                    currentPathIndex = c;
                } else if (c === validCols - 1 && r > 0 && r < validRows - 1) { // Right edge
                    currentPathIndex = validCols + (r - 1);
                } else if (r === validRows - 1) { // Bottom edge
                    currentPathIndex = validCols + (validRows - 2) + (validCols - 1 - c);
                } else if (c === 0 && r > 0 && r < validRows - 1) { // Left edge (Corrected logic matching reference)
                     currentPathIndex = 2 * validCols + validRows - 3 + (validRows - 1 - r);
                     // Let's re-verify:
                     // Example 6x7: Size 2*7 + 2*(6-2) = 14 + 8 = 22
                     // Top: 0-6 (7 cells)
                     // Right: 7 + (1-1)=7, 7+(2-1)=8, 7+(3-1)=9, 7+(4-1)=10 (4 cells) -> indices 7, 8, 9, 10
                     // Bottom: 7+(6-2)+(7-1-c) -> 11 + (6-c). c=6..0 -> 11, 12, 13, 14, 15, 16, 17 (7 cells) -> indices 11-17
                     // Left: 2*7 + 6 - 3 + (6-1-r) -> 14+6-3+(5-r) -> 17 + (5-r). r=5..1 -> 17, 18, 19, 20, 21 (5 cells?) -> Wait, r only goes 1 to rows-2 (1 to 4).
                     // Let's trace left edge path index calc from game.js:
                     // pathIndex = 2 * mapCols + mapRows - 3 + (mapRows - 1 - row);
                     // For 6x7: 2*7 + 6 - 3 + (6 - 1 - row) = 14 + 6 - 3 + (5 - row) = 17 + (5 - row)
                     // row=5 (bottom-left): index = 17+(5-5) = 17 (matches end of bottom edge?) No. Should be next.
                     // row=4: index = 17 + (5-4) = 18
                     // row=3: index = 17 + (5-3) = 19
                     // row=2: index = 17 + (5-2) = 20
                     // row=1 (top-left): index = 17 + (5-1) = 21 (matches start of top edge?) Yes.
                     // Okay, the calculation seems correct.

                     // Displaying the index:
                     cell.textContent = currentPathIndex;
                }

            } // else it's an empty cell, default style applies

            mapPreviewContainer.appendChild(cell);
        }
    }
}


// API 相關函數
async function handleCreateRoom() {
    const roomName = document.getElementById('room-name').value.trim();
    const maxPlayers = document.getElementById('max-players').value;
    // ★★★ Get Map Params ★★★
    const mapType = mapTypeSelect.value;
    let mapRows = null;
    let mapCols = null;

    if (mapType === 'rectangle') {
        mapRows = parseInt(mapRowsInput.value) || 6;
        mapCols = parseInt(mapColsInput.value) || 7;
        // Re-validate just in case input was invalid but preview didn't fully stop it
        mapRows = Math.min(Math.max(2, mapRows), 8);
        mapCols = Math.min(Math.max(2, mapCols), 8);
    }
    // ★★★ -------------- ★★★

    if (!roomName) {
        showError('請輸入房間名稱');
        return;
    }

    // ★★★ Create request body with map params ★★★
    const requestBody = {
        roomName,
        maxPlayers,
        mapType
    };
    if (mapType === 'rectangle') {
        requestBody.mapRows = mapRows;
        requestBody.mapCols = mapCols;
    }
    // ★★★ --------------------------------- ★★★

    try {
        const response = await fetch('/api/game-rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody) // Send the body with map params
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '創建房間失敗');
        }

        const roomData = await response.json();
        // The response itself might not contain map details if the server doesn't explicitly add them,
        // but it's okay because the game page will get the full state via WebSocket.
        showPlayerNamePanel(roomData.id, roomData.roomName, roomData.maxPlayers, 'create');
    } catch (error) {
        showError(`錯誤: ${error.message}`);
    }
}

async function handleRoomSearch() {
    const roomId = document.getElementById('join-room-id').value.trim();

    if (roomId) {
        try {
            // The GET /api/game-rooms/:roomId might need updating if we want to show map type here
            // But for joining, just getting id, name, maxPlayers is enough to proceed to player name panel.
            const response = await fetch(`/api/game-rooms/${roomId}`);

            if (!response.ok) {
                 // Check specific status codes for better messages
                 if (response.status === 404) {
                    throw new Error('找不到指定的房間代碼');
                }
                const errorData = await response.json();
                throw new Error(errorData.error || '查詢房間時發生錯誤');
            }

            const roomData = await response.json();
            showPlayerNamePanel(roomData.id, roomData.roomName, roomData.maxPlayers, 'join');
        } catch (error) {
            showError(`錯誤: ${error.message}`);
            // Optionally clear the room list if search fails
            document.getElementById('room-list').classList.add('hidden');
            activeRoomsList.innerHTML = '';
        }
    } else {
        // If no ID entered, show active rooms list
        document.getElementById('room-list').classList.remove('hidden');
        fetchActiveRooms();
    }
}

async function fetchActiveRooms() {
    try {
        const response = await fetch('/api/game-rooms');

        if (!response.ok) {
            throw new Error('獲取房間列表失敗');
        }

        const rooms = await response.json();
        displayActiveRooms(rooms);
    } catch (error) {
        // Don't use showError here as it might overwrite a search error
        activeRoomsList.innerHTML = `<li>獲取房間列表時出錯: ${error.message}</li>`;
        document.getElementById('room-list').classList.remove('hidden');
    }
}

function displayActiveRooms(rooms) {
    activeRoomsList.innerHTML = ''; // Clear previous list

    if (!Array.isArray(rooms)) {
         activeRoomsList.innerHTML = '<li>無法解析房間列表數據</li>';
         document.getElementById('room-list').classList.remove('hidden');
         return;
    }

    if (rooms.length === 0) {
        activeRoomsList.innerHTML = '<li>目前沒有活躍的房間</li>';
        document.getElementById('room-list').classList.remove('hidden');
        return;
    }

    rooms.forEach(room => {
        const li = document.createElement('li');
        // Access gameState properties safely
        const playerCount = Object.keys(room.game_state?.players || {}).length;
        const maxPlayers = room.game_state?.maxPlayers || '?';
        const mapType = room.game_state?.mapType || '未知';
        const mapSize = room.game_state?.mapLoopSize || '?';
        const mapDisplay = mapType === 'rectangle' ? `矩形 (${mapSize}格)` : `圓形 (${mapSize}格)`;

        li.textContent = `${room.room_name} (${playerCount}/${maxPlayers}) - ${mapDisplay}`;
        li.dataset.roomId = room.room_id; // Store id for click handler

        // Add click listener to join this room
        li.addEventListener('click', () => {
             // Need to get full room details again potentially, or just use stored data
             showPlayerNamePanel(room.room_id, room.room_name, maxPlayers, 'join');
        });
        activeRoomsList.appendChild(li);
    });

    document.getElementById('room-list').classList.remove('hidden');
}


async function handleStartGame() {
    const playerName = document.getElementById('player-name').value.trim();
    const roomId = sessionStorage.getItem('targetRoomId');

    if (!playerName) {
        showError('請輸入玩家名稱');
        return;
    }

    if (playerName.length > 10) {
        showError('玩家名稱不能超過10個字元');
        return;
    }

    try {
        // Perform the pre-join check (server validates name uniqueness and room capacity)
        const response = await fetch(`/api/game-rooms/${roomId}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ playerName })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '無法加入房間 (可能已滿或名稱重複)');
        }

        // Save room and player name to sessionStorage for potential reconnect
        sessionStorage.setItem('currentRoom', roomId);
        sessionStorage.setItem('playerName', playerName);

        // Navigate to the game page
        window.location.href = `game.html?roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;
    } catch (error) {
        showError(`加入房間失敗: ${error.message}`);
    }
}

// --- END OF FILE client.js ---