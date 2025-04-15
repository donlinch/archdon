// rich.js (Relevant Sections Modified)

document.addEventListener('DOMContentLoaded', () => {
  // ... (keep existing DOM element variables: gameBoard, buttons, etc.) ...
  const cellWidth = 125;
  const cellHeight = 100;
  const gameBoard = document.getElementById('game-board');
  const player1Btn = document.getElementById('player1-btn');
  const player2Btn = document.getElementById('player2-btn');
  const player3Btn = document.getElementById('player3-btn');
  const forwardBtn = document.getElementById('forward-btn');
  const backwardBtn = document.getElementById('backward-btn');
  const logoContainer = document.getElementById('logo-container');


  // ... (keep existing game state variables: pathCells, selectedPlayer, etc.) ...
  let pathCells = [];
  let selectedPlayer = 1;
  let isMoving = false;
  let highlightedCell = null;
  let activePlayerCount = 3;
  let playerPathIndices = [0, 0, 0];
  const STEP_ANIMATION_DELAY = 300;
  let playerTokens = [];
  const colors = { /* ... your colors ... */
      geekBlue: '#5b9df0', cyan: '#0cd8b6', grey: '#5d7092', sunriseYellow: '#fbd115', dustRed: '#f9584a', daybreakBlue: '#6dc8ec', goldenPurple: '#9270ca', sunsetOrange: '#ff544d', darkGreen: '#26b9a9', magenta: '#ff94c3'
   };

  // --- WebSocket Variables ---
  let ws = null;
  const wsUrl = `wss://${window.location.host}?clientType=game`; // Use wss:// for secure connection on Render

  // --- Remove or Comment Out BroadcastChannel ---
  // const broadcastChannel = new BroadcastChannel('rich_game_channel');
  // broadcastChannel.onmessage = (event) => { ... };

  // Initialize Game
  function initGame() {
      createBoardCells();
      renderBoard();
      updatePlayerButtonStyles();
      addEventListeners();
      connectWebSocket(); // Connect WebSocket instead of initWebSocket
      initPlayerPositions(); // Ensure positions are set initially
  }

  // --- WebSocket Connection Logic ---
  function connectWebSocket() {
      console.log(`Attempting to connect WebSocket to ${wsUrl}`);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
          console.log('WebSocket connection established (Game)');
          // Optionally send an initial state message or ready signal
          sendGameStateToControllers(); // Send initial state
      };

      ws.onmessage = (event) => {
          console.log('WebSocket message received (Game):', event.data);
          try {
              const message = JSON.parse(event.data);
              // Expecting messages of type 'controlCommand' from server
              if (message.type === 'controlCommand') {
                  handleControlCommand(message.command, message.params || {});
              } else {
                   console.log("Received non-command message:", message);
               }
          } catch (error) {
              console.error('Failed to parse WebSocket message or invalid format:', error);
          }
      };

      ws.onerror = (error) => {
          console.error('WebSocket error (Game):', error);
      };

      ws.onclose = (event) => {
          console.log(`WebSocket connection closed (Game): Code=${event.code}, Reason=${event.reason}`);
          ws = null;
          // Attempt to reconnect after a delay
          setTimeout(connectWebSocket, 5000); // Reconnect every 5 seconds
      };
  }

  // --- Send Game State via WebSocket ---
  function sendGameStateToControllers() {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
          console.log('WebSocket not open, cannot send game state.');
          return;
      }

      const gameState = {
          selectedPlayer,
          playerPathIndices: [...playerPathIndices], // Send a copy
          pathCells: pathCells.map(cell => ({ // Send simplified cell info
              title: cell.title,
              // description: cell.description, // Maybe not needed by controller?
              position: cell.position,
              color: cell.color
          })),
          highlightedCell,
          isMoving
      };

      const message = {
          type: 'gameStateUpdate', // Specific type for state updates
          data: gameState
      };

      console.log('Sending game state update via WebSocket:', message);
      ws.send(JSON.stringify(message));
  }


  // Handle Control Commands (received via WebSocket)
  function handleControlCommand(command, params) {
      console.log('Executing control command:', command, params);

      switch (command) {
          case 'selectPlayer':
              selectPlayer(params.player);
              break;

          case 'movePlayer':
               // Check steps validity if needed
              const steps = parseInt(params.steps) || 1;
              if (steps < 1 || steps > 12) {
                  console.warn("Invalid steps received:", steps);
                  // Optionally send error back? For now, just use default 1
                  handleDirectionSelection(params.direction === 'forward', 1);
              } else {
                   handleDirectionSelection(params.direction === 'forward', steps);
               }
              break;

          case 'jumpToPosition':
              if (typeof params.position === 'number' && params.player >= 1 && params.player <= 3) {
                  selectPlayer(params.player); // Select first
                  playerPathIndices[params.player - 1] = params.position;
                  updatePlayerPositions(); // Update internal state
                  renderBoard(); // Update UI
                  // Send updated state back to controllers AFTER the jump
                  sendGameStateToControllers();
              } else {
                   console.warn("Invalid jumpToPosition params:", params);
               }
              break;

          case 'showInfo':
              // Show info based on highlighted cell
              const currentCellIndex = highlightedCell !== null ? highlightedCell : playerPathIndices[selectedPlayer - 1];
              const cellToShow = pathCells[currentCellIndex];
              const centerInfo = document.getElementById('center-info');
              if (centerInfo && logoContainer && cellToShow) {
                  updateCenterInfo(cellToShow.title, cellToShow.description);
                  centerInfo.style.backgroundColor = cellToShow.color;
                  centerInfo.classList.remove('hidden');
                  logoContainer.classList.add('hidden');
              }
              break;

          case 'hideInfo':
              const centerInfoHide = document.getElementById('center-info');
              if (centerInfoHide && logoContainer) {
                  centerInfoHide.classList.add('hidden');
                  logoContainer.classList.remove('hidden');
              }
              break;

          case 'resetGame':
              initPlayerPositions();
              highlightedCell = null;
              renderBoard();
              // Send updated state back
              sendGameStateToControllers();
              break;

           case 'getGameState': // Controller requested state
               sendGameStateToControllers();
               break;

           default:
               console.warn(`Unknown command received: ${command}`);

      }
  }

  // --- Modify functions that change state to send updates ---

  // Modified: selectPlayer
  function selectPlayer(playerNum) {
      if (playerNum < 1 || playerNum > 3 || isMoving) {
          return;
      }
      selectedPlayer = playerNum;
      updatePlayerButtonStyles();
      console.log(`Player ${selectedPlayer} selected.`);
      // Send state update after selection
      sendGameStateToControllers();
  }

  // Modified: finishMoving
  function finishMoving(finalIndex) {
      isMoving = false;
      highlightedCell = finalIndex;
      renderBoard(); // Render first

      const cell = pathCells[finalIndex];
      if (cell) {
         updateCenterInfo(cell.title, cell.description); // Update info content
         const centerInfo = document.getElementById('center-info');
         if (centerInfo) centerInfo.style.backgroundColor = cell.color;
      }

      enableDisableButtons(true);
      console.log(`Player ${selectedPlayer} finished moving to index ${finalIndex}.`);
      // Send state update after movement finishes
      sendGameStateToControllers();
  }

  // Modified: initPlayerPositions
  function initPlayerPositions() {
      const startPositionIndex = 0;
      playerPathIndices = [startPositionIndex, startPositionIndex, startPositionIndex];
      console.log("Player positions initialized.");
      // No need to send state here, usually called during reset or init
  }

  // Keep existing functions like:
  // createBoardCells, renderBoard, updatePlayerPositions, updatePlayerPosition,
  // updateCenterInfo, handleDirectionSelection, movePlayerStepByStep,
  // enableDisableButtons, updatePlayerButtonStyles, addEventListeners

  // --- Remove or Modify window.gameControl if it was for cross-window ---
  // If gameControl was only for the bridge, it's not needed.
  // If it was for potential direct JS calls, keep it, but it won't work cross-device.
  // window.gameControl = { ... }; // Comment out or remove if unused


  // --- Ensure addEventListeners doesn't rely on postMessage ---
  function addEventListeners() {
      // Keep button listeners for local control (optional)
      if (player1Btn) player1Btn.addEventListener('click', () => selectPlayer(1));
      if (player2Btn) player2Btn.addEventListener('click', () => selectPlayer(2));
      if (player3Btn) player3Btn.addEventListener('click', () => selectPlayer(3));
      if (forwardBtn) forwardBtn.addEventListener('click', () => handleDirectionSelection(true, 1)); // Default 1 step for local
      if (backwardBtn) backwardBtn.addEventListener('click', () => handleDirectionSelection(false, 1)); // Default 1 step for local

      // Remove the postMessage listener
      // window.addEventListener('message', (event) => { ... });
  }









  function createBoardCells() {
    pathCells = [];

    const layout = [
        { title: '起點', description: '從這裡出發', x: 0, y: 0, color: colors.geekBlue },
        { title: '甜甜圈', description: '甜而不膩，元氣滿滿！', x: 1, y: 0, color: colors.sunriseYellow },
        { title: '拉麵', description: '濃郁湯頭加麵免費！', x: 2, y: 0, color: colors.cyan },
        { title: '火鍋', description: '麻辣到爆汗', x: 3, y: 0, color: colors.sunsetOrange },
        { title: '巧克力', description: '熱量爆表但快樂翻倍', x: 4, y: 0, color: colors.magenta },
        { title: '壽司', description: '滑進嘴裡的幸福', x: 5, y: 0, color: colors.daybreakBlue },
        { title: '左上轉角', description: '轉彎啦～', x: 6, y: 0, color: colors.goldenPurple },

        { title: '牛奶', description: '早睡早起身體好', x: 6, y: 1, color: colors.cyan },
        { title: '炸雞', description: '配可樂才對味！', x: 6, y: 2, color: colors.sunsetOrange },
        { title: '蛋糕', description: '生日快樂～', x: 6, y: 3, color: colors.sunriseYellow },
        { title: '關卡', description: '要回答問題才能過', x: 6, y: 4, color: colors.grey },
        { title: '右下轉角', description: '再轉一次！', x: 6, y: 5, color: colors.goldenPurple },

        { title: '冰淇淋', description: '消暑良方', x: 5, y: 5, color: colors.magenta },
        { title: '燒肉', description: '油脂香氣逼人', x: 4, y: 5, color: colors.sunsetOrange },
        { title: '水果盤', description: '平衡飲食補充纖維', x: 3, y: 5, color: colors.cyan },
        { title: '左下轉角', description: '下一站是什麼？', x: 2, y: 5, color: colors.goldenPurple },

        { title: '三明治', description: '輕食能量補給', x: 1, y: 5, color: colors.daybreakBlue },
        { title: '吐司', description: '烤焦也好吃', x: 0, y: 5, color: colors.sunriseYellow },

        { title: '健康便當', description: '低脂高纖，超營養', x: 0, y: 4, color: colors.darkGreen },
        { title: '左轉再來', description: '這裡沒什麼', x: 0, y: 3, color: colors.grey },
        { title: '咖哩飯', description: '香氣逼人，來自印度', x: 0, y: 2, color: colors.magenta },
        { title: '轉回原點', description: '回到原點吧', x: 0, y: 1, color: colors.goldenPurple },

        { title: '再轉一次！', description: '你確定不是迷路了嗎？', x: 1, y: 1, color: colors.grey },
        { title: '漢堡', description: '雙層起司！', x: 2, y: 1, color: colors.sunsetOrange },
        { title: '冷氣房', description: '稍作休息', x: 3, y: 1, color: colors.cyan },
        { title: '主餐時間', description: '準備大啖美食！', x: 4, y: 1, color: colors.sunriseYellow },
        { title: '右轉即出現', description: '轉出來！', x: 5, y: 1, color: colors.goldenPurple }
    ];

    layout.forEach((item, index) => {
        pathCells.push({
            title: item.title,
            description: item.description,
            x: item.x,
            y: item.y,
            position: index,
            color: item.color
        });
    });
}









  // Start the game
  initGame();

}); // End DOMContentLoaded