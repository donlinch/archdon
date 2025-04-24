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


// 添加到 client.js 文件末尾或創建一個新的 guide.js 文件

document.addEventListener('DOMContentLoaded', function() {
    // 返回頂部按鈕功能
    const backToTopBtn = document.getElementById('back-to-top');
    if (backToTopBtn) {
        // 滾動超過 200px 時顯示按鈕
        window.addEventListener('scroll', function() {
            if (window.scrollY > 200) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });
        
        // 點擊按鈕返回頂部
        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
    // 行動呼籲按鈕功能
    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', function() {
            // 滾動到表單區域或顯示創建房間面板
            const welcomePanel = document.getElementById('welcome-panel');
            if (welcomePanel) {
                welcomePanel.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    
    // 為遊戲步驟添加入場動畫
    const guideSteps = document.querySelectorAll('.guide-step');
    if (guideSteps.length > 0) {
        // 使用 Intersection Observer API 檢測元素是否進入視圖
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // 當元素進入視圖時添加動畫效果
                    entry.target.style.opacity = '0';
                    entry.target.style.transform = 'translateY(20px)';
                    
                    setTimeout(() => {
                        entry.target.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, 100);
                    
                    // 元素已經被觀察到，不需要再次觀察
                    observer.unobserve(entry.target);
                }
            });
        }, {
            root: null,  // 使用視窗作為觀察器的根元素
            rootMargin: '0px',
            threshold: 0.1  // 當元素10%進入視圖時觸發
        });
        
        // 觀察每個遊戲步驟元素
        guideSteps.forEach(step => {
            observer.observe(step);
        });
    }
    
    // 為圖片添加載入錯誤處理
    const screenshots = document.querySelectorAll('.screenshot img');
    screenshots.forEach(img => {
        // 當圖片載入失敗時使用備用圖片
        img.addEventListener('error', function() {
            this.src = 'https://sunnyyummy.onrender.com/uploads/1744875326039-16458.png';
        });
    });
});