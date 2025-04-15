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
          // pathCells: ... // 可以考慮是否真的需要每次都發送完整的格子信息
          // ★ 新增：將玩家配置信息發送給控制器 ★
          players: {
              1: { avatarUrl: playersConfig.player1.avatarUrl },
              2: { avatarUrl: playersConfig.player2.avatarUrl },
              3: { avatarUrl: playersConfig.player3.avatarUrl }
          }
          }
      }));
    }
  
    function handleControlCommand(command, params) {
      switch (command) {
        case 'selectPlayer':
          selectPlayer(params.player);
          break;
















          case 'movePlayer':
            // ★ 確保這裡使用的是從 params 傳來的 player 參數 ★
            // 之前的代碼可能直接用了本地 selectedPlayer，這裡確認一下
            handleDirectionSelection(params.direction === 'forward', parseInt(params.steps) || 1, params.player); // <-- ★ 傳遞 params.player ★
            break;
      
          // --- ★ 加回 jumpToPosition case ★ ---
          case 'jumpToPosition':
            if (params.player >= 1 && params.player <= 3 && params.position >= 0 && params.position < pathCells.length) {
              playerPathIndices[params.player - 1] = params.position;
              highlightedCell = params.position; // 更新高亮
              renderBoard();
              sendGameStateToControllers();
            }
            break;








  // --- ★ 新增 Case ★ ---
  case 'showPlayerInfo':
    const playerToShow = params.player;
    // 驗證玩家編號是否有效
    if (playerToShow >= 1 && playerToShow <= 3) {
        const playerIndex = playerToShow - 1;
         // 確保索引在範圍內
        if (playerIndex < playerPathIndices.length) {
            const currentPositionIndex = playerPathIndices[playerIndex];
            // 確保位置索引在範圍內
            if (currentPositionIndex >= 0 && currentPositionIndex < pathCells.length) {
                const targetCell = pathCells[currentPositionIndex];
                if (targetCell) {
                    console.log(`Received showPlayerInfo for P${playerToShow} at pos ${currentPositionIndex}, showing info for:`, targetCell.title);
                    updateCenterInfo(targetCell.title, targetCell.description); // 更新文字
                    const infoPanel = document.getElementById('center-info');
                    if (infoPanel) {
                        infoPanel.style.backgroundColor = targetCell.color; // 更新背景色
                        infoPanel.classList.remove('hidden'); // 顯示面板
                    }
                    if (logoContainer) {
                        logoContainer.classList.add('hidden'); // 隱藏 Logo
                    }
                } else {
                     console.error(`showPlayerInfo: 無法在 pathCells 中找到位置 ${currentPositionIndex} 的數據`);
                }
            } else {
                console.error(`showPlayerInfo: 玩家 ${playerToShow} 的位置索引 ${currentPositionIndex} 無效`);
            }
        } else {
             console.error(`showPlayerInfo: 無效的玩家索引 ${playerIndex}`);
        }
    } else {
         console.error(`showPlayerInfo: 無效的玩家編號 ${playerToShow}`);
    }
    break; // <--- 不要忘記 break

case 'hidePlayerInfo':
    console.log('Received hidePlayerInfo command');
    const infoPanelToHide = document.getElementById('center-info');
    if (infoPanelToHide) {
        infoPanelToHide.classList.add('hidden'); // 隱藏面板
    }
    if (logoContainer) {
        logoContainer.classList.remove('hidden'); // 顯示 Logo
    }
    break; // <--- 不要忘記 break
// --- ★ 新增 Case 結束 ★ ---




        
          







      }
    }
  
    async function initGame() { // <-- ★ 將 initGame 標記為 async ★
        await loadGameConfig(); // <-- ★ 等待配置加載完成 ★

        createBoardCells();
        renderBoard(); // <-- renderBoard 現在可以使用 gameConfig 了
        // updatePlayerButtonStyles(); // 保持刪除
        // addEventListeners();      // 保持刪除
        connectWebSocket();




 // --- ★ 新增：全局點擊監聽器，用於關閉中央面板 ★ ---
        document.addEventListener('click', (event) => {
            const centerInfoPanel = document.getElementById('center-info');
            const clickedElement = event.target;

            // 檢查中央面板是否存在且當前是可見的
            if (centerInfoPanel && !centerInfoPanel.classList.contains('hidden')) {
                // 檢查點擊的是否在中央面板內部 (包括關閉按鈕)
                const isClickInsideInfo = centerInfoPanel.contains(clickedElement);
                // 檢查點擊的是否在任何一個遊戲格子上
                const isClickOnCell = clickedElement.closest('.cell'); // .closest 會查找自身及父元素

                // 如果點擊既不在面板內部，也不在任何格子上
                if (!isClickInsideInfo && !isClickOnCell) {
                    console.log('點擊在面板和格子外部，關閉面板');
                    centerInfoPanel.classList.add('hidden'); // 隱藏面板
                    if (logoContainer) {
                        logoContainer.classList.remove('hidden'); // 顯示 Logo
                    }
                }
            }
        });
        // --- ★ 全局點擊監聽器結束 ★ ---



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


            logoImg.classList.add('game-logo-image');



            
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
    // 清除舊的 token 元素
    document.querySelectorAll('.player-token').forEach(el => el.remove());
    // 清空 token 數組 (如果有的話，或者直接在這裡創建)
    playerTokens = []; // 確保 playerTokens 數組被清空或重新填充

    playerPathIndices.forEach((index, i) => {
        const playerNum = i + 1;
        const cell = pathCells[index];

        // --- ★ 獲取玩家配置 ★ ---
        // 提供一個空對象作為後備，防止 gameConfig 還沒加載完或缺少玩家數據時出錯
        const playerConfig = gameConfig[`player${playerNum}`] || {};

        const token = document.createElement('div');
        token.className = `player-token player${playerNum}-token`; // 保持基本 class

        // --- ★ 根據配置決定內容 ★ ---
        if (playerConfig.avatarUrl) {
            // 如果有頭像 URL，創建 img 元素
            token.innerHTML = `<img src="${playerConfig.avatarUrl}"
                                   alt="${playerConfig.name || `P${playerNum}`}"
                                   style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            // 移除背景色，讓圖片顯示
            token.style.backgroundColor = 'transparent';
             // 可以保留或調整邊框
             token.style.border = '1px solid white';
        } else {
            // 如果沒有頭像 URL，顯示預設文字
            token.textContent = playerConfig.name || `P${playerNum}`;
            // 確保背景色能正確顯示 (移除可能存在的透明設置)
            token.style.backgroundColor = ''; // 恢復使用 CSS 的背景色
             token.style.border = '2px solid white'; // 恢復預設邊框
        }
        // --- ★ 內容決定結束 ★ ---

        // 計算位置 (這部分不變)
        const angle = (2 * Math.PI / 3) * i;
        const radius = 15;
        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius;
        token.style.left = `${cell.x * cellWidth + cellWidth / 2 + offsetX}px`;
        token.style.top = `${cell.y * cellHeight + cellHeight / 2 + offsetY}px`;

        gameBoard.appendChild(token);
        playerTokens.push(token); // 將新創建的 token 加入數組 (如果需要引用)
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
  