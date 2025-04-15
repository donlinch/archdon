// rich.js（整合單機繪製 + 聯機控制）

document.addEventListener('DOMContentLoaded', () => {
    const cellWidth = 125;
    const cellHeight = 100;
    const gameBoard = document.getElementById('game-board');
    
    const logoContainer = document.getElementById('logo-container');
  
    let gameConfig = {}; // <-- ★ 新增：全局變數儲存配置 ★







    let pathCells = [];
    let selectedPlayer = 1;
    let isMoving = false;
    let highlightedCell = null;
    let activePlayerCount = 3;
    let playerPathIndices = [0, 0, 0];
    const STEP_ANIMATION_DELAY = 300;
    let playerTokens = [];
  
    const colors = {
      geekBlue: '#5b9df0',
      cyan: '#0cd8b6',
      grey: '#5d7092',
      sunriseYellow: '#fbd115',
      dustRed: '#f9584a',
      daybreakBlue: '#6dc8ec',
      goldenPurple: '#9270ca',
      sunsetOrange: '#ff544d',
      darkGreen: '#26b9a9',
      magenta: '#ff94c3'
    };
  
    let ws = null;
    const wsUrl = `wss://${window.location.host}?clientType=game`;
  




  // --- ★ 新增：異步函數加載配置 ---
  async function loadGameConfig() {
    try {
        // 使用相對路徑或絕對路徑，確保能正確訪問到 public 文件夾下的 json
        const response = await fetch('/game-config.json'); // <-- 假設 game-config.json 在 public 根目錄
        if (!response.ok) {
            throw new Error(`無法加載 game-config.json: ${response.status}`);
        }
        gameConfig = await response.json();
        console.log('遊戲配置已加載:', gameConfig);
    } catch (error) {
        console.error('加載遊戲配置失敗:', error);
        // 提供一個基本的預設值，以防配置加載失敗
        gameConfig = { centerLogoUrl: null }; // 預設沒有 Logo
    }
}






    function connectWebSocket() {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        console.log('WebSocket connected');
        sendGameStateToControllers();
      };
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'controlCommand') {
            handleControlCommand(message.command, message.params);
          }
        } catch (e) {
          console.error('WS message parse error:', e);
        }
      };
      ws.onclose = () => setTimeout(connectWebSocket, 5000);
    }
  
    function sendGameStateToControllers() {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({
        type: 'gameStateUpdate',
        data: {
          selectedPlayer,
          playerPathIndices,
          highlightedCell,
          isMoving,
          pathCells: pathCells.map(({ title, position, color }) => ({ title, position, color }))
        }
      }));
    }
  
    function handleControlCommand(command, params) {
      switch (command) {
        case 'selectPlayer':
          selectPlayer(params.player);
          break;
        case 'movePlayer':
          handleDirectionSelection(params.direction === 'forward', parseInt(params.steps) || 1);
          break;
        case 'jumpToPosition':
          if (params.player >= 1 && params.player <= 3) {
            playerPathIndices[params.player - 1] = params.position;
            renderBoard();
            sendGameStateToControllers();
          }
          break;
        case 'showInfo':
          const cell = pathCells[highlightedCell ?? playerPathIndices[selectedPlayer - 1]];
          if (cell) {
            updateCenterInfo(cell.title, cell.description);
            document.getElementById('center-info').style.backgroundColor = cell.color;
            document.getElementById('center-info').classList.remove('hidden');
            logoContainer.classList.add('hidden');
          }
          break;
        case 'hideInfo':
          document.getElementById('center-info').classList.add('hidden');
          logoContainer.classList.remove('hidden');
          break;
        case 'resetGame':
          initPlayerPositions();
          highlightedCell = null;
          renderBoard();
          sendGameStateToControllers();
          break;
        case 'getGameState':
          sendGameStateToControllers();
          break;
      }
    }
  
    async function initGame() { // <-- ★ 將 initGame 標記為 async ★
        await loadGameConfig(); // <-- ★ 等待配置加載完成 ★

        createBoardCells();
        renderBoard(); // <-- renderBoard 現在可以使用 gameConfig 了
        // updatePlayerButtonStyles(); // 保持刪除
        // addEventListeners();      // 保持刪除
        connectWebSocket();
    }



  
    function createBoardCells() {
      const boardWidth = 7;
      const sideHeight = 4;
      pathCells = [];
  
      const topColors = [colors.goldenPurple, colors.geekBlue, colors.cyan, colors.grey, colors.sunriseYellow, colors.dustRed, colors.goldenPurple];
      const rightColors = [colors.daybreakBlue, colors.sunsetOrange, colors.darkGreen, colors.magenta];
      const bottomColors = [colors.goldenPurple, colors.sunsetOrange, colors.darkGreen, colors.magenta, colors.geekBlue, colors.cyan, colors.goldenPurple];
      const leftColors = [colors.daybreakBlue, colors.grey, colors.sunriseYellow, colors.dustRed];
  
      pathCells.push({ x: 0, y: sideHeight + 1, title: '左下角', description: '起點', color: colors.goldenPurple, position: 0 });
      for (let i = 1; i < boardWidth - 1; i++) pathCells.push({ x: i, y: sideHeight + 1, title: `底部 ${i}`, description: `底部格 ${i}`, color: bottomColors[i], position: pathCells.length });
      pathCells.push({ x: boardWidth - 1, y: sideHeight + 1, title: '右下角', description: '轉角', color: colors.goldenPurple, position: pathCells.length });
      for (let i = 0; i < sideHeight; i++) pathCells.push({ x: boardWidth - 1, y: sideHeight - i, title: `右側 ${i+1}`, description: `右邊第 ${i+1} 格`, color: rightColors[i], position: pathCells.length });
      pathCells.push({ x: boardWidth - 1, y: 0, title: '右上角', description: '轉角', color: colors.goldenPurple, position: pathCells.length });
      for (let i = boardWidth - 2; i > 0; i--) pathCells.push({ x: i, y: 0, title: `頂部 ${boardWidth - 1 - i}`, description: `頂部格`, color: topColors[i], position: pathCells.length });
      pathCells.push({ x: 0, y: 0, title: '左上角', description: '轉角', color: colors.goldenPurple, position: pathCells.length });
      for (let i = 0; i < sideHeight; i++) pathCells.push({ x: 0, y: i + 1, title: `左側 ${i+1}`, description: `左邊第 ${i+1} 格`, color: leftColors[i], position: pathCells.length });
    }
  
  // --- ★ 修改：renderBoard 函數，使用配置顯示 Logo ---
    function renderBoard() {
        gameBoard.innerHTML = ''; // 清空遊戲板

        // 確保 Logo 容器存在並清空
        if (!logoContainer) {
            console.error("找不到 logo-container 元素！");
            // 如果找不到，可以動態創建一個，或者報錯停止
            return;
        }
        logoContainer.innerHTML = ''; // 清空舊的 Logo 或文字
        logoContainer.classList.remove('hidden'); // 確保 Logo 容器預設是可見的

        // 根據配置決定顯示圖片還是預設文字
        if (gameConfig.centerLogoUrl) {
            console.log('正在渲染 Logo 圖片:', gameConfig.centerLogoUrl);
            const logoImg = document.createElement('img');
            logoImg.src = gameConfig.centerLogoUrl;
            logoImg.alt = "遊戲 Logo";
            // 調整樣式以適應您的 500x400 圖片和容器大小 (350x300)
            logoImg.style.display = 'block'; // 確保圖片是塊級元素
            logoImg.style.maxWidth = '100%'; // 限制最大寬度為容器寬度
            logoImg.style.maxHeight = '100%'; // 限制最大高度為容器高度
            logoImg.style.width = 'auto';     // 讓寬度自動調整以保持比例
            logoImg.style.height = 'auto';    // 讓高度自動調整以保持比例
            logoImg.style.margin = 'auto';    // 嘗試在容器內居中
            // 可選：如果圖片加載失敗的處理
            logoImg.onerror = () => {
                console.error("Logo 圖片加載失敗:", gameConfig.centerLogoUrl);
                logoContainer.innerHTML = '<p style="color:red;">Logo 加載失敗</p>'; // 顯示錯誤提示
            };
            logoContainer.appendChild(logoImg);
        } else {
            console.log('沒有配置 Logo URL，顯示預設文字 Logo');
            // 如果沒有配置 URL，顯示預設文字
            logoContainer.innerHTML = `
                <div class="logo-text">大富翁</div>
                <div class="logo-subtitle">開始你的幸運之旅吧！</div>
            `;
        }
        gameBoard.appendChild(logoContainer); // 將 Logo 容器加回遊戲板



 // --- ★ 加回中央資訊面板的創建 ★ ---
 const centerInfo = document.createElement('div');
 centerInfo.className = 'center-info hidden'; // 初始隱藏
 centerInfo.id = 'center-info';
 // 注意 onclick 裡要重新顯示 logoContainer
 centerInfo.innerHTML = `<div class="close-btn" onclick="this.parentElement.classList.add('hidden'); document.getElementById('logo-container').classList.remove('hidden')">×</div><div id="center-title" class="center-title"></div><div id="center-description" class="center-description"></div>`;
 gameBoard.appendChild(centerInfo);
 // --- 中央資訊面板創建結束 ---





  
     
 

    // --- 渲染格子 ---
    pathCells.forEach(cell => {
        const div = document.createElement('div');
        // ↓↓↓ 使用 cell.position 或 cell.index (取決於您 createBoardCells 如何定義) 來設置 class 和 data 屬性 ↓↓↓
        const positionIdentifier = typeof cell.position !== 'undefined' ? cell.position : pathCells.indexOf(cell); // 使用 position 或 index
        div.className = `cell cell-pos-${positionIdentifier}`; // <-- 用 position 或 index 作為 class
        div.dataset.index = positionIdentifier; // <-- 儲存索引，方便點擊時查找數據
        // ↑↑↑ --- ↑↑↑

        div.style.left = `${cell.x * cellWidth}px`;
        div.style.top = `${cell.y * cellHeight}px`;
        div.style.backgroundColor = cell.color;
        if (positionIdentifier === highlightedCell) div.classList.add('highlighted');

        // --- ★ 修改格子內容的創建 ★ ---
        // 只創建包含標題的內容
        div.innerHTML = `
            <div class="cell-content">
                <div class="cell-title">${cell.title}</div>
             </div>
        `;
        // --- ★ 修改結束 ★ ---

        // --- ★ 修改點擊事件處理 ★ ---
        div.addEventListener('click', () => {
            // 從 pathCells 數組中通過索引找到完整的格子數據
            const fullCellData = pathCells[positionIdentifier];
            if (fullCellData) {
                // 更新中央面板的標題和描述
                updateCenterInfo(fullCellData.title, fullCellData.description); // <-- 使用完整數據
                const infoPanel = document.getElementById('center-info');
                infoPanel.style.backgroundColor = fullCellData.color; // <-- 使用完整數據
                infoPanel.classList.remove('hidden');
                logoContainer.classList.add('hidden'); // 點擊格子時隱藏 Logo
            } else {
                console.error(`無法找到索引為 ${positionIdentifier} 的格子數據`);
            }
        });
        // --- ★ 修改結束 ★ ---

        gameBoard.appendChild(div);
    });
    // --- 渲染格子結束 ---
    updatePlayerPositions(); // 渲染玩家標記
}










  
    function updateCenterInfo(title, description) {
      document.getElementById('center-title').textContent = title;
      document.getElementById('center-description').textContent = description;
    }
  
    function updatePlayerPositions() {
      document.querySelectorAll('.player-token').forEach(el => el.remove());
      playerPathIndices.forEach((index, i) => {
        const cell = pathCells[index];
        const token = document.createElement('div');
        token.className = `player-token player${i+1}-token`;
        token.textContent = `P${i+1}`;
        const angle = (2 * Math.PI / 3) * i;
        const radius = 15;
        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius;
        token.style.left = `${cell.x * cellWidth + cellWidth / 2 + offsetX}px`;
        token.style.top = `${cell.y * cellHeight + cellHeight / 2 + offsetY}px`;
        gameBoard.appendChild(token);
      });
    }
  
    function handleDirectionSelection(isForward, totalSteps) {
        if (isMoving) return;
        isMoving = true;
        // enableDisableButtons(false); // 已刪除
        let currentIndex = playerPathIndices[selectedPlayer - 1];
        let stepsLeft = totalSteps;
  
      function moveStep() {
        currentIndex = isForward ? (currentIndex + 1) % pathCells.length : (currentIndex - 1 + pathCells.length) % pathCells.length;
        playerPathIndices[selectedPlayer - 1] = currentIndex;
        updatePlayerPositions();
        if (--stepsLeft > 0) setTimeout(moveStep, STEP_ANIMATION_DELAY);
        else finishMoving(currentIndex);
      }
  
      setTimeout(moveStep, STEP_ANIMATION_DELAY);
    }
  
    function finishMoving(finalIndex) {
        isMoving = false;
        highlightedCell = finalIndex;
        renderBoard();
        // enableDisableButtons(true); // 已刪除
        sendGameStateToControllers();
      }
  
    function enableDisableButtons(enable) {
     }
  
     function selectPlayer(num) {
        if (num < 1 || num > 3 || isMoving) return;
        selectedPlayer = num;
        // updatePlayerButtonStyles(); // 已刪除
        sendGameStateToControllers();
      }
  
    
  
    function initPlayerPositions() {
      playerPathIndices = [0, 0, 0];
    }
  
    initPlayerPositions();
    initGame();
  });
  