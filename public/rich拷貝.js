// 大富翁遊戲腳本
document.addEventListener('DOMContentLoaded', () => {
    // 定義遊戲板的大小和格子尺寸
    const cellWidth = 125;
    const cellHeight = 100;
    
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
    let selectedPlayer = 1; // 當前選擇的玩家
    let isMoving = false;
    let highlightedCell = null;
    let activePlayerCount = 3; // 固定3名玩家
    
    // 全域變數存儲玩家位置
    let playerPathIndices = [0, 0, 0]; // 初始化為從起點開始
    
    // 動畫相關變數
    const STEP_ANIMATION_DELAY = 300; // 每步移動的延遲時間(毫秒)
    
    // 玩家標記元素
    let playerTokens = [];
    
    // 定義新的顏色方案
    const colors = {
      geekBlue: '#5b9df0',    // Geek Blue
      cyan: '#0cd8b6',        // Cyan
      grey: '#5d7092',        // Grey
      sunriseYellow: '#fbd115', // Sunrise Yellow
      dustRed: '#f9584a',     // Dust Red
      daybreakBlue: '#6dc8ec', // Daybreak Blue
      goldenPurple: '#9270ca', // Golden Purple
      sunsetOrange: '#ff544d', // Sunset Orange
      darkGreen: '#26b9a9',   // Dark Green
      magenta: '#ff94c3'      // Magenta
    };
    
    // 初始化遊戲
    function initGame() {
      createBoardCells();
      renderBoard();
      updatePlayerButtonStyles();
      addEventListeners();
    }
    
    // 初始化玩家位置
    function initPlayerPositions() {
      const startPositionIndex = 0; // 玩家從起點開始 (左下角)
      playerPathIndices = [startPositionIndex, startPositionIndex, startPositionIndex];
    }
    
    // 創建 7x6 棋盤格子 (7個橫向格子，兩邊各4個縱向格子)
    function createBoardCells() {
      pathCells = [];
      const boardWidth = 7; // 水平方向格子數量
      const sideHeight = 4; // 左右兩側的格子數量（不包括角落）
      
      // 定義顏色
      // 頂部顏色排序
      const topColors = [
          colors.goldenPurple, // 頂部左角
          colors.geekBlue,    // 頂部 1
          colors.cyan,        // 頂部 2
          colors.grey,        // 頂部 3
          colors.sunriseYellow, // 頂部 4
          colors.dustRed,     // 頂部 5
          colors.goldenPurple  // 頂部右角
      ];
      
      // 右側顏色排序
      const rightColors = [
          colors.daybreakBlue, // 右側 1
          colors.sunsetOrange, // 右側 2
          colors.darkGreen,   // 右側 3
          colors.magenta     // 右側 4
      ];
      
      // 底部顏色排序
      const bottomColors = [
          colors.goldenPurple, // 底部左角
          colors.sunsetOrange, // 底部 1
          colors.darkGreen,   // 底部 2
          colors.magenta,     // 底部 3
          colors.geekBlue,    // 底部 4
          colors.cyan,        // 底部 5
          colors.goldenPurple  // 底部右角
      ];
      
      // 左側顏色排序
      const leftColors = [
          colors.daybreakBlue, // 左側 1
          colors.grey,        // 左側 2
          colors.sunriseYellow, // 左側 3
          colors.dustRed     // 左側 4
      ];
      
      // 左下角起點
      pathCells.push({
          x: 0,
          y: sideHeight + 1,
          title: `左下角`,
          description: `遊戲開始的地方。`,
          color: colors.goldenPurple,
          position: 'corner'
      });
      
      // 底部 (從左到右)
      for (let i = 1; i < boardWidth - 1; i++) {
          pathCells.push({
              x: i,
              y: sideHeight + 1,
              title: `底部 ${i}`,
              description: `這是底部第 ${i} 格。`,
              color: bottomColors[i],
              position: 'bottom'
          });
      }
      
      // 右下角
      pathCells.push({
          x: boardWidth - 1,
          y: sideHeight + 1,
          title: `右下角`,
          description: `右下角格子。`,
          color: colors.goldenPurple,
          position: 'corner'
      });
      
      // 右側 (從下到上)
      for (let i = 0; i < sideHeight; i++) {
          pathCells.push({
              x: boardWidth - 1,
              y: sideHeight - i,
              title: `右側 ${i + 1}`,
              description: `這是右側第 ${i + 1} 格。`,
              color: rightColors[i],
              position: 'right'
          });
      }
      
      // 右上角
      pathCells.push({
          x: boardWidth - 1,
          y: 0,
          title: `右上角`,
          description: `右上角格子。`,
          color: colors.goldenPurple,
          position: 'corner'
      });
      
      // 頂部 (從右到左)
      for (let i = boardWidth - 2; i > 0; i--) {
          pathCells.push({
              x: i,
              y: 0,
              title: `頂部 ${boardWidth - 1 - i}`,
              description: `這是頂部第 ${boardWidth - 1 - i} 格。`,
              color: topColors[i],
              position: 'top'
          });
      }
      
      // 左上角
      pathCells.push({
          x: 0,
          y: 0,
          title: `左上角`,
          description: `左上角格子。`,
          color: colors.goldenPurple,
          position: 'corner'
      });
      
      // 左側 (從上到下)
      for (let i = 0; i < sideHeight; i++) {
          pathCells.push({
              x: 0,
              y: i + 1,
              title: `左側 ${i + 1}`,
              description: `這是左側第 ${i + 1} 格。`,
              color: leftColors[i],
              position: 'left'
          });
      }
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
      
      // 計算棋盤位置偏移，使其居中
      const boardOffset = {
          x: 0,
          y: 0
      };
      
      // 渲染路徑格子
      pathCells.forEach((cell, index) => {
          const cellElement = document.createElement('div');
          cellElement.className = `cell cell-${cell.position}`;
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
          
          cellElement.style.left = `${boardOffset.x + cell.x * cellWidth}px`;
          cellElement.style.top = `${boardOffset.y + cell.y * cellHeight}px`;
          cellElement.style.backgroundColor = cell.color;
          
          if (index === highlightedCell) {
              cellElement.classList.add('highlighted');
          }
          
          gameBoard.appendChild(cellElement);
      });
      
      // 清空玩家標記陣列
      playerTokens = [];
      
      // 創建玩家標記 (只有3個玩家)
      for (let i = 1; i <= 3; i++) {
          const playerToken = document.createElement('div');
          playerToken.className = `player-token player${i}-token`;
          playerToken.textContent = `P${i}`;
          gameBoard.appendChild(playerToken);
          playerTokens.push(playerToken);
      }
      
      // 更新玩家位置
      updatePlayerPositions();
    }
    
    // 更新玩家位置
    function updatePlayerPositions() {
      for (let i = 0; i < 3; i++) {
          updatePlayerPosition(i + 1, playerPathIndices[i]);
      }
    }
    
    // 更新特定玩家的位置
    function updatePlayerPosition(playerNum, pathIndex) {
      if (playerNum > 3) return;
      
      const playerToken = playerTokens[playerNum - 1];
      if (!playerToken) return;
      
      // 計算水平偏移以避免玩家標記重疊
      let offsetX = 0;
      let offsetY = 0;
      
      // 根據玩家數量計算偏移量，排成圓形
      const angle = (2 * Math.PI / 3) * (playerNum - 1);
      const radius = 15;
      offsetX = Math.cos(angle) * radius;
      offsetY = Math.sin(angle) * radius;
      
      // 計算棋盤位置偏移，使其居中
      const boardOffset = {
          x: 0,
          y: 0
      };
      
      const cell = pathCells[pathIndex];
      const position = {
          x: boardOffset.x + cell.x * cellWidth,
          y: boardOffset.y + cell.y * cellHeight
      };
      
      playerToken.style.left = `${position.x + cellWidth/2 + offsetX}px`;
      playerToken.style.top = `${position.y + cellHeight/2 + offsetY}px`;
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
    
    // 處理方向選擇 (前進或後退)
    function handleDirectionSelection(isForward) {
      if (isMoving) return;
      
      // 確保選擇的玩家不超過活躍玩家數量
      if (selectedPlayer > 3) {
          selectedPlayer = 1;
      }
      
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
      const currentPathIndex = playerPathIndices[currentPlayer - 1];
      
      // 逐步移動
      let stepsLeft = totalSteps;
      let currentIndex = currentPathIndex;
      
      function moveOneStep() {
          // 計算下一步的位置
          let nextIndex;
          
          // 前進是順時針移動，後退則相反
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
          
          // 更新玩家位置索引
          playerPathIndices[currentPlayer - 1] = currentIndex;
          
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
      // 確保玩家編號不超過3
      if (playerNum > 3) {
          return;
      }
      
      selectedPlayer = playerNum;
      
      // 更新玩家按鈕樣式
      updatePlayerButtonStyles();
    }
    
    // 更新玩家按鈕樣式
    function updatePlayerButtonStyles() {
      // 先移除所有按鈕的selected類
      player1Btn.classList.remove('selected');
      player2Btn.classList.remove('selected');
      player3Btn.classList.remove('selected');
      
      // 根據選擇的玩家添加selected類
      switch (selectedPlayer) {
          case 1: player1Btn.classList.add('selected'); break;
          case 2: player2Btn.classList.add('selected'); break;
          case 3: player3Btn.classList.add('selected'); break;
      }
    }
    
    // 添加事件監聽器
    function addEventListeners() {
      // 玩家選擇按鈕
      if (player1Btn) player1Btn.addEventListener('click', () => selectPlayer(1));
      if (player2Btn) player2Btn.addEventListener('click', () => selectPlayer(2));
      if (player3Btn) player3Btn.addEventListener('click', () => selectPlayer(3));
      
      // 方向按鈕
      if (forwardBtn) forwardBtn.addEventListener('click', () => handleDirectionSelection(true));
      if (backwardBtn) backwardBtn.addEventListener('click', () => handleDirectionSelection(false));
    }
    
    // 初始化遊戲
    initPlayerPositions(); // 初始化玩家位置
    initGame();
  });