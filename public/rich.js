// 大富翁遊戲腳本
document.addEventListener('DOMContentLoaded', () => {
  // 定義遊戲板的大小和格子尺寸
  const boardSize = 7; // 維持原來的7x7格子數量
  const cellWidth = 125; // 格子寬度
  const cellHeight = 100; // 格子高度 (4:5的寬高比)
  
  // DOM 元素
  const gameBoard = document.getElementById('game-board');
  const player1Btn = document.getElementById('player1-btn');
  const player2Btn = document.getElementById('player2-btn');
  const player3Btn = document.getElementById('player3-btn');
  const forwardBtn = document.getElementById('forward-btn');
  const backwardBtn = document.getElementById('backward-btn');
  const logoContainer = document.getElementById('logo-container');
  
  // 遊戲狀態
  let pathCells = [];
  let player1PathIndex = 0;
  let player2PathIndex = 0;
  let player3PathIndex = 0;
  let selectedPlayer = 1;
  let isMoving = false;
  let highlightedCell = null;
  
  // 動畫相關變數
  const STEP_ANIMATION_DELAY = 300; // 每步移動的延遲時間(毫秒)
  
  // 玩家標記元素
  let player1Token;
  let player2Token;
  let player3Token;
  
  // 初始化遊戲
  function initGame() {
      createPathCells();
      renderBoard();
      addEventListeners();
  }
  
  // 創建路徑格子 - 使用粉色系顏色
  function createPathCells() {
      pathCells = [];
      
      // 首先添加起點/終點 (右下角)
      pathCells.push({
        x: boardSize - 1,
        y: boardSize - 1,
        title: '起點/終點',
        description: '遊戲的起點和終點。',
        color: '#ff80ab' // 粉紅色
      });
      
      // 1. 右側從下到上 (第一步往上)
      for (let y = boardSize - 2; y >= 0; y--) {
        pathCells.push({
          x: boardSize - 1,
          y,
          title: `右側 ${boardSize - y - 1}`,
          description: `這是右側第 ${boardSize - y - 1} 格。`,
          color: getRandomPinkColor()
        });
      }
      
      // 2. 頂部從右到左 (右上到左上)
      for (let x = boardSize - 2; x >= 0; x--) {
        pathCells.push({
          x,
          y: 0,
          title: `頂部 ${boardSize - x - 1}`,
          description: `這是頂部第 ${boardSize - x - 1} 格。`,
          color: getRandomPinkColor()
        });
      }
      
      // 3. 左側從上到下 (左上到左下)
      for (let y = 1; y < boardSize; y++) {
        pathCells.push({
          x: 0,
          y,
          title: `左側 ${y}`,
          description: `這是左側第 ${y} 格。`,
          color: getRandomPinkColor()
        });
      }
      
      // 4. 底部從左到右 (左下到右下，不包括起點/終點)
      for (let x = 1; x < boardSize - 1; x++) {
        pathCells.push({
          x,
          y: boardSize - 1,
          title: `底部 ${x}`,
          description: `這是底部第 ${x} 格。`,
          color: getRandomPinkColor()
        });
      }
  }
  
  // 生成隨機粉色系顏色
  function getRandomPinkColor() {
    const pinkColors = [
      '#ff80ab', '#ff4081', '#f8bbd0', '#f48fb1', 
      '#ec407a', '#ad1457', '#d81b60', '#c2185b',
      '#f06292', '#e91e63', '#fce4ec', '#f06292',
      '#ba68c8', '#9c27b0', '#ea80fc', '#e040fb'
    ];
    return pinkColors[Math.floor(Math.random() * pinkColors.length)];
  }
  
  // 渲染遊戲板
  function renderBoard() {
    // 清空遊戲板
    gameBoard.innerHTML = '';
    
    // 添加LOGO元素
    gameBoard.appendChild(logoContainer);
    
    // 創建中央資訊顯示區
    const centerInfo = document.createElement('div');
    centerInfo.className = 'center-info hidden'; // 默認隱藏
    centerInfo.id = 'center-info';
    
    const centerTitle = document.createElement('div');
    centerTitle.className = 'center-title';
    centerTitle.textContent = '表格內容';
    centerTitle.id = 'center-title';
    
    const centerDescription = document.createElement('div');
    centerDescription.className = 'center-description';
    centerDescription.textContent = '點擊任意格子顯示詳細資訊';
    centerDescription.id = 'center-description';
    
    // 添加關閉按鈕
    const closeBtn = document.createElement('div');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function(event) {
      event.stopPropagation(); // 阻止事件冒泡
      document.getElementById('center-info').classList.add('hidden');
      document.getElementById('logo-container').classList.remove('hidden');
    });
    
    centerInfo.appendChild(closeBtn);
    centerInfo.appendChild(centerTitle);
    centerInfo.appendChild(centerDescription);
    gameBoard.appendChild(centerInfo);
    
    // 渲染路徑格子
    pathCells.forEach((cell, index) => {
      const cellElement = document.createElement('div');
      cellElement.className = 'cell';
      cellElement.dataset.index = index; // 添加索引屬性方便識別
      
      // 添加點擊事件
      cellElement.addEventListener('click', function() {
        // 更新中央資訊
        updateCenterInfo(cell.title, cell.description);
        // 更新中央資訊區域的背景顏色與點擊的格子顏色一致
        document.getElementById('center-info').style.backgroundColor = cell.color;
        // 顯示中央資訊
        document.getElementById('center-info').classList.remove('hidden');
        // 隱藏LOGO
        document.getElementById('logo-container').classList.add('hidden');
      });
      
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
      
      cellElement.style.left = `${cell.x * cellWidth}px`;
      cellElement.style.top = `${cell.y * cellHeight}px`;
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
    
    playerToken.style.left = `${position.x * cellWidth + cellWidth/2 + offsetX}px`;
    playerToken.style.top = `${position.y * cellHeight + cellHeight/2 - 15}px`;
  }
  
  // 更新中央資訊
  function updateCenterInfo(title, description) {
    const centerTitle = document.getElementById('center-title');
    const centerDescription = document.getElementById('center-description');
    
    if (centerTitle && centerDescription) {
      // 更新內容
      centerTitle.textContent = title;
      centerDescription.textContent = description;
      
      // 添加動畫效果
      const centerInfo = document.getElementById('center-info');
      centerInfo.style.animation = 'none';
      // 觸發重繪
      void centerInfo.offsetWidth;
      centerInfo.style.animation = 'pulse 1s';
    }
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
    
    // 修改為只移動一步
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
      } else if (currentPlayer === 2) {
        player2PathIndex = currentIndex;
      } else {
        player3PathIndex = currentIndex;
      }
      
      // 更新玩家位置
      updatePlayerPosition(currentPlayer, currentIndex);
      
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
    
    // 不再自動顯示中央資訊
    // 只更新資訊內容，以便點擊時正確顯示
    const cell = pathCells[finalIndex];
    updateCenterInfo(cell.title, cell.description);
    document.getElementById('center-info').style.backgroundColor = cell.color;
    
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
    // 確保所有元素都存在再添加事件監聽器
    if (player1Btn) {
      player1Btn.addEventListener('click', () => selectPlayer(1));
    }
    
    if (player2Btn) {
      player2Btn.addEventListener('click', () => selectPlayer(2));
    }
    
    if (player3Btn) {
      player3Btn.addEventListener('click', () => selectPlayer(3));
    }
    
    // 添加方向按鈕的事件監聽器
    if (forwardBtn) {
      forwardBtn.addEventListener('click', () => handleDirectionSelection(true));
    }
    
    if (backwardBtn) {
      backwardBtn.addEventListener('click', () => handleDirectionSelection(false));
    }
  }
  
  // 初始化遊戲
  initGame();
});