  // 遊戲狀態和默認內容
  const gameState = {
    boardSize: {rows: 4, cols: 5},
    contents: Array(20).fill('').map((_, i) => `內容 ${i+1}`),
    revealed: Array(20).fill(false),
    contentPositions: Array(20).fill(0).map((_, i) => i), // 內容位置映射
    cardTimerId: null // 計時器ID追蹤變數
}; 

// DOM 元素
const configModal = document.getElementById('configModal');
const configBtn = document.getElementById('configBtn');
const closeBtn = document.querySelector('.close');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const resetBtn = document.getElementById('resetBtn');
const inputGrid = document.getElementById('inputGrid');
const centeredCard = document.getElementById('centeredCard');
const cardInner = document.getElementById('cardInner');
const cardCloseBtn = document.querySelector('.card-close');


 

// 新增導航欄控制
const navToggle = document.getElementById('navToggle');
        const gameHeader = document.getElementById('gameHeader');
        const gameFooter = document.getElementById('gameFooter');
        let navVisible = false;
        
        navToggle.addEventListener('click', function() {
            navVisible = !navVisible;
            if (navVisible) {
                gameHeader.classList.add('visible');
                gameFooter.classList.add('visible');
                navToggle.textContent = '×';
            } else {
                gameHeader.classList.remove('visible');
                gameFooter.classList.remove('visible');
                navToggle.textContent = '≡';
            }
        });






// 洗牌函數 (Fisher-Yates 算法)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 初始化遊戲板
function initializeBoard() {
    const board = document.getElementById('gameBoard');
    board.innerHTML = '';
    
    for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
        const hole = document.createElement('div');
        hole.className = 'hole';
        hole.dataset.index = i;
        
        const front = document.createElement('div');
        front.className = 'hole-face hole-front';
        
        const back = document.createElement('div');
        back.className = 'hole-face hole-back';
        // 使用位置映射獲取內容
        const contentIndex = gameState.contentPositions[i];
        back.textContent = gameState.contents[contentIndex];
        
        hole.appendChild(front);
        hole.appendChild(back);
        board.appendChild(hole);
        
        if (gameState.revealed[i]) {
            hole.classList.add('revealed');
        }
        
        hole.addEventListener('click', revealHole);
    }
}

// 初始化輸入框
function initializeInputs() {
    inputGrid.innerHTML = '';
    
    for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        
        const label = document.createElement('label');
        label.textContent = i + 1;
        label.setAttribute('for', `content-${i}`);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `content-${i}`;
        input.value = gameState.contents[i];
        input.placeholder = `格子 ${i+1} 內容`;
        
        inputGroup.appendChild(label);
        inputGroup.appendChild(input);
        inputGrid.appendChild(inputGroup);
    }
}

// 點擊揭示內容
function revealHole(event) {
    const hole = event.currentTarget;
    const index = parseInt(hole.dataset.index);
    
    if (!gameState.revealed[index]) {
        // 添加翻轉動畫
        hole.classList.add('revealed');
        
        // 獲取位置映射的內容索引
        const contentIndex = gameState.contentPositions[index];
        
        // 顯示中央卡片
        showCenteredCard(gameState.contents[contentIndex], index);
        
        gameState.revealed[index] = true;
    }
}

// 顯示居中卡片
function showCenteredCard(content, index) {
    // 清除之前的計時器，如果存在的話
    if (gameState.cardTimerId !== null) {
        clearTimeout(gameState.cardTimerId);
        gameState.cardTimerId = null;
    }
    
    cardInner.textContent = content;
    centeredCard.style.display = 'flex';
    
    // 更新關閉按鈕引用並添加事件監聽
    const newCloseBtn = document.querySelector('.card-close');
    newCloseBtn.addEventListener('click', closeCenteredCard);
    
    // 10秒後關閉，並保存計時器ID
    gameState.cardTimerId = setTimeout(() => {
        if (centeredCard.style.display === 'flex') {
            closeCenteredCard();
        }
    }, 10000);
}

// 關閉居中卡片
function closeCenteredCard() {
    // 清除計時器
    if (gameState.cardTimerId !== null) {
        clearTimeout(gameState.cardTimerId);
        gameState.cardTimerId = null;
    }
    
    centeredCard.classList.add('closing');
    setTimeout(() => {
        centeredCard.style.display = 'none';
        centeredCard.classList.remove('closing');
    }, 500);
}

// 保存配置
function saveConfig() {
    for (let i = 0; i < gameState.boardSize.rows * gameState.boardSize.cols; i++) {
        const input = document.getElementById(`content-${i}`);
        gameState.contents[i] = input.value || `內容 ${i+1}`;
    }
    
    // 更新遊戲板上顯示的內容
    updateBoardContent();
    
    configModal.style.display = 'none';
}

// 更新遊戲板內容
function updateBoardContent() {
    const holes = document.querySelectorAll('.hole');
    holes.forEach((hole, i) => {
        const back = hole.querySelector('.hole-back');
        const contentIndex = gameState.contentPositions[i];
        back.textContent = gameState.contents[contentIndex];
    });
}

// 重置遊戲
function resetGame() {
    gameState.revealed = Array(20).fill(false);
    
    // 隨機打亂內容位置
    gameState.contentPositions = Array(20).fill(0).map((_, i) => i);
    shuffleArray(gameState.contentPositions);
    
    initializeBoard();
}

// 設置示例內容
function setExampleContent() {
    const exampleContent = [
        '恭喜獲得100元', '再接再厲', '謝謝參與', '恭喜獲得50元',
        '幸運獎', '謝謝參與', '恭喜獲得20元', '再接再厲',
        '謝謝參與', '恭喜獲得10元', '加油', '謝謝參與',
        '恭喜獲得5元', '不要灰心', '謝謝參與', '恭喜獲得2元',
        '繼續努力', '謝謝參與', '恭喜獲得1元', '期待下次'
    ];
    
    gameState.contents = exampleContent;
}

// 事件監聽
configBtn.addEventListener('click', () => {
    initializeInputs();
    configModal.style.display = 'block';
});

closeBtn.addEventListener('click', () => {
    configModal.style.display = 'none';
});

saveConfigBtn.addEventListener('click', saveConfig);

resetBtn.addEventListener('click', resetGame);

// 點擊彈窗外區域關閉彈窗
window.addEventListener('click', (event) => {
    if (event.target === configModal) {
        configModal.style.display = 'none';
    }
});

// 初始化遊戲
window.addEventListener('DOMContentLoaded', () => {
    setExampleContent();
    // 初始隨機排列內容
    shuffleArray(gameState.contentPositions);
    initializeBoard();
    
    // 新增：點擊整個卡片區域關閉
    centeredCard.addEventListener('click', (e) => {
        // 點擊卡片任何位置都會關閉
        closeCenteredCard();
    });
    
    // 防止點擊卡片內容區域時事件冒泡到外層
    document.querySelector('.centered-card-content').addEventListener('click', (e) => {
        // 取消事件冒泡，讓點擊內容區域時不會關閉卡片
        // e.stopPropagation(); 
        
        // 如果想讓點擊任何位置都關閉，請移除這個事件監聽器或註釋掉 stopPropagation
    });
});