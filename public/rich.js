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
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalDescription = document.getElementById('modal-description');
    const modalCloseBtn = document.getElementById('close-modal-btn');
    const modal = document.getElementById('modal');
    
    // 遊戲狀態
    let pathCells = [];
    let player1PathIndex = 0;
    let player2PathIndex = 0;
    let selectedPlayer = 1;
    let isMoving = false;
    let isRolling = false; // 新增並初始化isRolling變數
    let highlightedCell = null;
    let moveHistory = [];
    let modalAutoPopup = true; // 修改為true，讓玩家移動後自動顯示彈窗
    
    // 玩家標記元素
    let player1Token;
    let player2Token;
    
    // 初始化遊戲
    function initGame() {
      createPathCells();
      renderBoard();
      addEventListeners();
      updateUndoButtonState();
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
        cellElement.textContent = cell.title;
        cellElement.style.left = `${cell.x * cellSize}px`;
        cellElement.style.top = `${cell.y * cellSize}px`;
        cellElement.style.backgroundColor = cell.color;
        
        if (index === highlightedCell) {
          cellElement.classList.add('highlighted');
        }
        
        cellElement.addEventListener('click', () => handleCellClick(cell));
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
      const player1Position = getPlayerPosition(player1PathIndex);
      const player2Position = getPlayerPosition(player2PathIndex);
      
      player1Token.style.left = `${player1Position.x * cellSize + cellSize/2 - 15}px`;
      player1Token.style.top = `${player1Position.y * cellSize + cellSize/2 - 15}px`;
      
      player2Token.style.left = `${player2Position.x * cellSize + cellSize/2 - 15}px`;
      player2Token.style.top = `${player2Position.y * cellSize + cellSize/2 - 15}px`;
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
    
    // 處理格子點擊
    function handleCellClick(cell) {
      showModal(cell.title, cell.description, cell.color);
    }
    
    // 顯示彈窗
    function showModal(title, description, color) {
      modalTitle.textContent = title;
      modalDescription.textContent = description;
      modal.style.borderTopColor = color;
      modalOverlay.classList.remove('hidden');
    }
    
    // 關閉彈窗
    function closeModal() {
      modalOverlay.classList.add('hidden');
    }
    
    // 處理步數選擇
    function handleStepSelection(steps) {
      if (isMoving) return;
      
      // 在移動前保存當前狀態到歷史記錄
      const currentState = {
        player1PathIndex,
        player2PathIndex,
        selectedPlayer
      };
      moveHistory.push(currentState);
      updateUndoButtonState();
      
      // 移動玩家
      movePlayer(steps);
    }
    
    // 處理玩家移動
    function movePlayer(steps) {
      if (isMoving) return;
      
      isMoving = true;
      highlightedCell = null;
      
      // 決定當前移動的玩家
      const currentPlayerPathIndex = selectedPlayer === 1 ? player1PathIndex : player2PathIndex;
      
      // 計算新位置
      let newIndex = currentPlayerPathIndex + steps;
      
      // 如果超過或剛好到終點，停在起點/終點
      if (newIndex >= pathCells.length) {
        newIndex = 0; // 停在起點/終點
      }
      
      // 更新玩家位置
      if (selectedPlayer === 1) {
        player1PathIndex = newIndex;
      } else {
        player2PathIndex = newIndex;
      }
      
      // 更新玩家位置顯示
      updatePlayerPositions();
      
      // 移動完成後高亮格子
      setTimeout(() => {
        isMoving = false;
        highlightedCell = newIndex;
        renderBoard(); // 重新渲染以顯示高亮
        
        // 只有在設置了自動彈窗時才顯示格子信息
        if (modalAutoPopup) {
          // 顯示玩家到達的格子信息
          const arrivedCell = pathCells[newIndex];
          showModal(
            `玩家 ${selectedPlayer} 到達 ${arrivedCell.title}`,
            arrivedCell.description,
            arrivedCell.color
          );
        }
      }, 500);
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
      
      updateUndoButtonState();
    }
    
    // 更新回上一步按鈕狀態
    function updateUndoButtonState() {
      undoBtn.disabled = moveHistory.length === 0 || isMoving;
    }
    
    // 重置遊戲
    function resetGame() {
      player1PathIndex = 0;
      player2PathIndex = 0;
      highlightedCell = null;  // 移除對diceElement的引用
      selectPlayer(1);
      moveHistory = [];
      updateUndoButtonState();
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
      
      undoBtn.addEventListener('click', undoMove);
      resetBtn.addEventListener('click', resetGame);
      modalCloseBtn.addEventListener('click', closeModal);
    }
    
    // 初始化遊戲
    initGame();
  });