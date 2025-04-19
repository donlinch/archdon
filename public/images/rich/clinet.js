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
        showCreateRoomPanel();
    }
});

// 表單提交
document.getElementById('create-room-submit').addEventListener('click', handleCreateRoom);
document.getElementById('join-room-submit').addEventListener('click', handleRoomSearch);
document.getElementById('player-name-submit').addEventListener('click', handleStartGame);

// 當頁面載入時執行
document.addEventListener('DOMContentLoaded', function() {
    // 檢查之前是否有保存狀態
    const savedRoom = sessionStorage.getItem('currentRoom');
    const savedName = sessionStorage.getItem('playerName');
    
    if (savedRoom && savedName) {
        // 直接進入遊戲
        window.location.href = `game.html?roomId=${savedRoom}&playerName=${encodeURIComponent(savedName)}`;
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

// API 相關函數
async function handleCreateRoom() {
    const roomName = document.getElementById('room-name').value.trim();
    const maxPlayers = document.getElementById('max-players').value;
    
    if (!roomName) {
        showError('請輸入房間名稱');
        return;
    }
    
    try {
        const response = await fetch('/api/game-rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ roomName, maxPlayers })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '創建房間失敗');
        }
        
        const roomData = await response.json();
        showPlayerNamePanel(roomData.id, roomData.roomName, roomData.maxPlayers, 'create');
    } catch (error) {
        showError(`錯誤: ${error.message}`);
    }
}

async function handleRoomSearch() {
    const roomId = document.getElementById('join-room-id').value.trim();
    
    if (roomId) {
        try {
            const response = await fetch(`/api/game-rooms/${roomId}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '找不到房間');
            }
            
            const roomData = await response.json();
            showPlayerNamePanel(roomData.id, roomData.roomName, roomData.maxPlayers, 'join');
        } catch (error) {
            showError(`錯誤: ${error.message}`);
        }
    } else {
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
        showError(`錯誤: ${error.message}`);
    }
}

function displayActiveRooms(rooms) {
    activeRoomsList.innerHTML = '';
    
    if (rooms.length === 0) {
        activeRoomsList.innerHTML = '<li>目前沒有活躍的房間</li>';
        return;
    }
    
    rooms.forEach(room => {
        const li = document.createElement('li');
        li.textContent = `${room.roomName} (${room.playerCount}/${room.maxPlayers})`;
        li.addEventListener('click', () => {
            showPlayerNamePanel(room.id, room.roomName, room.maxPlayers, 'join');
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
        // 在實際加入之前先檢查房間是否有空間
        const response = await fetch(`/api/game-rooms/${roomId}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ playerName })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '加入房間失敗');
        }
        
        // 保存房間和玩家名稱到sessionStorage，以便斷線重連
        sessionStorage.setItem('currentRoom', roomId);
        sessionStorage.setItem('playerName', playerName);
        
        // 導航到遊戲頁面
        window.location.href = `game.html?roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;
    } catch (error) {
        showError(`錯誤: ${error.message}`);
    }
}