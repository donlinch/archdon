// public/script.js
document.addEventListener('DOMContentLoaded', () => {
    // 定義遊戲板的大小和格子尺寸
    const boardSize = 7;
    const cellSize = 90;
    
    // DOM 元素
    const gameBoard = document.getElementById('game-board');
    const player1Btn = document.getElementById('player1-btn');
    const player2Btn = document.getElementById('player2-btn');
    const stepBtns = [
      document.getElementById('step-1-btn'),
      document.getElementById('step-2-btn'),
      document.getElementById('step-3-btn'),
      document.getElementById('step-4-btn'),
      document.getElementById('step-5-btn'),
      document.getElementById('step-6-btn')
    ];
    const undoBtn = document.getElementById('undo-btn');
    const resetBtn = document.getElementById('reset-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const backwardBtn = document.getElementById('backward-btn');
    
    // 遊戲狀態
    let pathCells = [];
    let player1PathIndex = 0;
    let player2PathIndex = 0;
    let selectedPlayer = 1;
    let isMoving = false;
    let isRolling = false; 
    let highlightedCell = null;
    let moveHistory = [];
    let selectedSteps = 0; // 儲存所選的步數
    let directionSelected = false; // 是否已選擇方向
    
    // 動畫相關變數
    const STEP_ANIMATION_DELAY = 300; // 每步移動的延遲時間(毫秒)
    
    // 玩家標記元素
    let player1Token;
    let player2Token;
    
    // 初始化遊戲
    function initGame() {
      createPathCells();
      renderBoard();
      addEventListeners();
      updateUndoButtonState();
      updateDirectionButtonState();
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
      
      // 更新玩家位置
      updatePlayerPositions();
    }
    
    // 更新玩家位置
    function updatePlayerPositions() {
      updatePlayerPosition(1, player1PathIndex);
      updatePlayerPosition(2, player2PathIndex);
    }
    
    // 更新特定玩家的位置
    function updatePlayerPosition(playerNum, pathIndex) {
      const playerToken = playerNum === 1 ? player1Token : player2Token;
      const position = getPlayerPosition(pathIndex);
      
      playerToken.style.left = `${position.x * cellSize + cellSize/2 - 15}px`;
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
    
    // 處理步數選擇
    function handleStepSelection(steps) {
      if (isMoving) return;
      
      selectedSteps = steps;
      directionSelected = false;
      
      // 移除所有步數按鈕選中狀態
      stepBtns.forEach(btn => btn.classList.remove('selected'));
      
      // 添加選中的步數按鈕的選中狀態
      stepBtns[steps - 1].classList.add('selected');
      
      // 啟用方向按鈕
      updateDirectionButtonState();
    }
    
    // 處理方向選擇
    function handleDirectionSelection(isForward) {
      if (isMoving || selectedSteps === 0) return;
      
      // 在移動前保存當前狀態到歷史記錄
      const currentState = {
        player1PathIndex,
        player2PathIndex,
        selectedPlayer
      };
      moveHistory.push(currentState);
      
      // 移動玩家
      movePlayerStepByStep(selectedSteps, isForward);
      
      // 重置選擇狀態
      directionSelected = true;
      updateDirectionButtonState();
      updateUndoButtonState();
    }
    
    // 更新方向按鈕狀態
    function updateDirectionButtonState() {
      const buttonsEnabled = selectedSteps > 0 && !isMoving && !directionSelected;
      forwardBtn.disabled = !buttonsEnabled;
      backwardBtn.disabled = !buttonsEnabled;
      
      if (buttonsEnabled) {
        forwardBtn.classList.add('active');
        backwardBtn.classList.add('active');
      } else {
        forwardBtn.classList.remove('active');
        backwardBtn.classList.remove('active');
      }
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
      const currentPathIndex = currentPlayer === 1 ? player1PathIndex : player2PathIndex;
      
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
        } else {
          player2PathIndex = currentIndex;
          updatePlayerPosition(2, player2PathIndex);
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
      selectedSteps = 0;
      
      // 移除步數按鈕選中狀態
      stepBtns.forEach(btn => btn.classList.remove('selected'));
      
      // 重新渲染以顯示高亮
      renderBoard();
      
      // 啟用按鈕
      enableDisableButtons(true);
      
      // 更新方向按鈕狀態
      updateDirectionButtonState();
      
      // 更新回上一步按鈕狀態
      updateUndoButtonState();
    }
    
    // 啟用/禁用按鈕
    function enableDisableButtons(enable) {
      // 步數按鈕
      stepBtns.forEach(btn => {
        btn.disabled = !enable;
      });
      
      // 玩家選擇按鈕
      player1Btn.disabled = !enable;
      player2Btn.disabled = !enable;
      
      // 方向按鈕
      forwardBtn.disabled = !enable;
      backwardBtn.disabled = !enable;
      
      // 方向按鈕樣式
      if (!enable) {
        forwardBtn.classList.remove('active');
        backwardBtn.classList.remove('active');
      }
      
      // 回上一步按鈕
      if (enable) {
        updateUndoButtonState();
      } else {
        undoBtn.disabled = true;
      }
      
      // 重置按鈕
      resetBtn.disabled = !enable;
    }
    
    // 選擇玩家
    function selectPlayer(playerNum) {
      selectedPlayer = playerNum;
      
      // 更新玩家按鈕樣式
      if (playerNum === 1) {
        player1Btn.classList.add('selected');
        player2Btn.classList.remove('selected');
      } else {
        player1Btn.classList.remove('selected');
        player2Btn.classList.add('selected');
      }
      
      // 重置選擇狀態
      selectedSteps = 0;
      directionSelected = false;
      stepBtns.forEach(btn => btn.classList.remove('selected'));
      updateDirectionButtonState();
    }
    
    // 回上一步
    function undoMove() {
      if (moveHistory.length === 0 || isRolling || isMoving) return;
      
      const prevState = moveHistory.pop();
      player1PathIndex = prevState.player1PathIndex;
      player2PathIndex = prevState.player2PathIndex;
      selectPlayer(prevState.selectedPlayer);
      
      // 更新玩家位置
      updatePlayerPositions();
      highlightedCell = null;
      renderBoard();
      
      // 重置選擇狀態
      selectedSteps = 0;
      directionSelected = false;
      stepBtns.forEach(btn => btn.classList.remove('selected'));
      
      // 更新按鈕狀態
      updateUndoButtonState();
      updateDirectionButtonState();
    }
    
    // 更新回上一步按鈕狀態
    function updateUndoButtonState() {
      undoBtn.disabled = moveHistory.length === 0 || isMoving;
    }
    
    // 重置遊戲
    function resetGame() {
      player1PathIndex = 0;
      player2PathIndex = 0;
      highlightedCell = null;
      selectPlayer(1);
      moveHistory = [];
      selectedSteps = 0;
      directionSelected = false;
      
      // 移除步數按鈕選中狀態
      stepBtns.forEach(btn => btn.classList.remove('selected'));
      
      updateUndoButtonState();
      updateDirectionButtonState();
      renderBoard();
    }
    
    // 添加事件監聽器
    function addEventListeners() {
      player1Btn.addEventListener('click', () => selectPlayer(1));
      player2Btn.addEventListener('click', () => selectPlayer(2));
      
      // 添加步數按鈕的事件監聽器
      stepBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => handleStepSelection(index + 1));
      });
      
      // 添加方向按鈕的事件監聽器
      forwardBtn.addEventListener('click', () => handleDirectionSelection(true));
      backwardBtn.addEventListener('click', () => handleDirectionSelection(false));
      
      undoBtn.addEventListener('click', undoMove);
      resetBtn.addEventListener('click', resetGame);
    }
    
    // 初始化遊戲
    initGame();
  });