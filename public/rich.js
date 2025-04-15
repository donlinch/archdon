// public/script.js
document.addEventListener('DOMContentLoaded', () => {
  // 定義遊戲板的大小和格子尺寸
  const boardSize = 7;
  const cellSize = 90;
  
  // DOM 元素
  const gameBoard = document.getElementById('game-board');
  const player1Btn = document.getElementById('player1-btn');
  const player2Btn = document.getElementById('player2-btn');
  const player3Btn = document.getElementById('player3-btn'); // 新增玩家3按鈕
  const forwardBtn = document.getElementById('forward-btn');
  const backwardBtn = document.getElementById('backward-btn');
  
  // 遊戲狀態
  let pathCells = [];
  let player1PathIndex = 0;
  let player2PathIndex = 0;
  let player3PathIndex = 0; // 新增玩家3路徑索引
  let selectedPlayer = 1;
  let isMoving = false;
  let highlightedCell = null;
  
  // 動畫相關變數
  const STEP_ANIMATION_DELAY = 300; // 每步移動的延遲時間(毫秒)
  
  // 玩家標記元素
  let player1Token;
  let player2Token;
  let player3Token; // 新增玩家3標記
  
  // 初始化遊戲
  function initGame() {
    createPathCells();
    renderBoard();
    addEventListeners();
  }
  
  // 創建路徑格子
  function createPathCells() {
    pathCells = [];
    
    // 首先添加起點/終點 (右下角)
    pathCells.push({
      x: boardSize - 1,
      y: boardSize - 1,
      title: '起點/終點',
      description: '遊戲的起點和終點。',
      color: '#FFA500'
    });
    
    // 1. 右側從下到上 (第一步往上)
    for (let y = boardSize - 2; y >= 0; y--) {
      pathCells.push({
        x: boardSize - 1,
        y,
        title: `右側 ${boardSize - y - 1}`,
        description: `這是右側第 ${boardSize - y - 1} 格。`,
        color: getRandomColor()
      });
    }
    
    // 2. 頂部從右到左 (右上到左上)
    for (let x = boardSize - 2; x >= 0; x--) {
      pathCells.push({
        x,
        y: 0,
        title: `頂部 ${boardSize - x - 1}`,
        description: `這是頂部第 ${boardSize - x - 1} 格。`,
        color: getRandomColor()
      });
    }
    
    // 3. 左側從上到下 (左上到左下)
    for (let y = 1; y < boardSize; y++) {
      pathCells.push({
        x: 0,
        y,
        title: `左側 ${y}`,
        description: `這是左側第 ${y} 格。`,
        color: getRandomColor()
      });
    }
    
    // 4. 底部從左到右 (左下到右下，不包括起點/終點)
    for (let x = 1; x < boardSize - 1; x++) {
      pathCells.push({
        x,
        y: boardSize - 1,
        title: `底部 ${x}`,
        description: `這是底部第 ${x} 格。`,
        color: getRandomColor()
      });
    }
  }
  
  // 生成隨機顏色
  function getRandomColor() {
    const colors = ['#FFD700', '#FF6347', '#4682B4', '#32CD32', '#9370DB', '#FF69B4', '#20B2AA'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  // 渲染遊戲板
  function renderBoard() {
    // 清空遊戲板
    gameBoard.innerHTML = '';
    
    // 渲染路徑格子
    pathCells.forEach((cell, index) => {
      const cellElement = document.createElement('div');
      cellElement.className = 'cell';
      
      // 創建格子內容：標題和描述
      const cellContent = document.createElement('div');
      cellContent.className = 'cell-content';
      
      const titleElement = document.createElement('div');
      titleElement.className = 'cell-title';
      titleElement.textContent = cell.title;
      
      const descriptionElement = document.createElement('div');
      descriptionElement.className = 'cell-description';
      descriptionElement.textContent = cell.description;
      
      cellContent.appendChild(titleElement);
      cellContent.appendChild(descriptionElement);
      cellElement.appendChild(cellContent);
      
      cellElement.style.left = `${cell.x * cellSize}px`;
      cellElement.style.top = `${cell.y * cellSize}px`;
      cellElement.style.backgroundColor = cell.color;
      
      if (index === highlightedCell) {
        cellElement.classList.add('highlighted');
      }
      
      gameBoard.appendChild(cellElement);
    });
    
    // 創建玩家1標記
    player1Token = document.createElement('div');
    player1Token.className = 'player-token player1-token';
    player1Token.textContent = 'P1';
    gameBoard.appendChild(player1Token);
    
    // 創建玩家2標記
    player2Token = document.createElement('div');
    player2Token.className = 'player-token player2-token';
    player2Token.textContent = 'P2';
    gameBoard.appendChild(player2Token);
    
    // 創建玩家3標記
    player3Token = document.createElement('div');
    player3Token.className = 'player-token player3-token';
    player3Token.textContent = 'P3';
    gameBoard.appendChild(player3Token);
    
    // 更新玩家位置
    updatePlayerPositions();
  }
  
  // 更新玩家位置
  function updatePlayerPositions() {
    updatePlayerPosition(1, player1PathIndex);
    updatePlayerPosition(2, player2PathIndex);
    updatePlayerPosition(3, player3PathIndex);
  }
  
  // 更新特定玩家的位置
  function updatePlayerPosition(playerNum, pathIndex) {
    let playerToken;
    let offsetX = 0;
    
    // 根據玩家編號選擇對應的標記
    if (playerNum === 1) {
      playerToken = player1Token;
      offsetX = -15; // 左側偏移
    } else if (playerNum === 2) {
      playerToken = player2Token;
      offsetX = 0; // 居中偏移
    } else {
      playerToken = player3Token;
      offsetX = 15; // 右側偏移
    }
    
    const position = getPlayerPosition(pathIndex);
    
    playerToken.style.left = `${position.x * cellSize + cellSize/2 + offsetX}px`;
    playerToken.style.top = `${position.y * cellSize + cellSize/2 - 15}px`;
  }
  
  // 獲取玩家位置
  function getPlayerPosition(playerPathIndex) {
    if (pathCells.length === 0) {
      return { x: boardSize - 1, y: boardSize - 1 }; // 預設在右下角
    }
    
    return {
      x: pathCells[playerPathIndex].x,
      y: pathCells[playerPathIndex].y
    };
  }
  
  // 處理方向選擇 (前進或後退)
  function handleDirectionSelection(isForward) {
    if (isMoving) return;
    
    // 移動玩家一步
    movePlayerStepByStep(1, isForward);
  }
  
  // 逐步移動玩家
  function movePlayerStepByStep(totalSteps, isForward) {
    if (isMoving) return;
    
    isMoving = true;
    highlightedCell = null;
    
    // 禁用所有按鈕
    enableDisableButtons(false);
    
    // 決定當前移動的玩家
    const currentPlayer = selectedPlayer;
    const currentPathIndex = currentPlayer === 1 ? player1PathIndex : 
                            (currentPlayer === 2 ? player2PathIndex : player3PathIndex);
    
    // 逐步移動
    let stepsLeft = totalSteps;
    let currentIndex = currentPathIndex;
    
    function moveOneStep() {
      // 計算下一步的位置
      let nextIndex;
      
      if (isForward) {
        nextIndex = currentIndex + 1;
        // 如果到達終點，回到起點
        if (nextIndex >= pathCells.length) {
          nextIndex = 0;
        }
      } else {
        nextIndex = currentIndex - 1;
        // 如果到達起點之前，回到終點
        if (nextIndex < 0) {
          nextIndex = pathCells.length - 1;
        }
      }
      
      // 更新當前位置
      currentIndex = nextIndex;
      
      // 更新玩家位置
      if (currentPlayer === 1) {
        player1PathIndex = currentIndex;
        updatePlayerPosition(1, player1PathIndex);
      } else if (currentPlayer === 2) {
        player2PathIndex = currentIndex;
        updatePlayerPosition(2, player2PathIndex);
      } else {
        player3PathIndex = currentIndex;
        updatePlayerPosition(3, player3PathIndex);
      }
      
      // 減少剩餘步數
      stepsLeft--;
      
      // 如果還有步數，繼續移動
      if (stepsLeft > 0) {
        setTimeout(moveOneStep, STEP_ANIMATION_DELAY);
      } else {
        // 移動完成
        finishMoving(currentIndex);
      }
    }
    
    // 開始移動
    setTimeout(moveOneStep, STEP_ANIMATION_DELAY);
  }
  
  // 完成移動
  function finishMoving(finalIndex) {
    isMoving = false;
    highlightedCell = finalIndex;
    
    // 重新渲染以顯示高亮
    renderBoard();
    
    // 啟用按鈕
    enableDisableButtons(true);
  }
  
  // 啟用/禁用按鈕
  function enableDisableButtons(enable) {
    // 玩家選擇按鈕
    player1Btn.disabled = !enable;
    player2Btn.disabled = !enable;
    player3Btn.disabled = !enable;
    
    // 方向按鈕
    forwardBtn.disabled = !enable;
    backwardBtn.disabled = !enable;
  }
  
  // 選擇玩家
  function selectPlayer(playerNum) {
    selectedPlayer = playerNum;
    
    // 更新玩家按鈕樣式
    player1Btn.classList.remove('selected');
    player2Btn.classList.remove('selected');
    player3Btn.classList.remove('selected');
    
    if (playerNum === 1) {
      player1Btn.classList.add('selected');
    } else if (playerNum === 2) {
      player2Btn.classList.add('selected');
    } else {
      player3Btn.classList.add('selected');
    }
  }
  
  // 添加事件監聽器
  function addEventListeners() {
    player1Btn.addEventListener('click', () => selectPlayer(1));
    player2Btn.addEventListener('click', () => selectPlayer(2));
    player3Btn.addEventListener('click', () => selectPlayer(3));
    
    // 添加方向按鈕的事件監聽器
    forwardBtn.addEventListener('click', () => handleDirectionSelection(true));
    backwardBtn.addEventListener('click', () => handleDirectionSelection(false));
  }
  
  // 初始化遊戲
  initGame();
});