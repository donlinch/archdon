// rich.js（整合單機繪製 + 聯機控制）

document.addEventListener('DOMContentLoaded', () => {
    const cellWidth = 125;
    const cellHeight = 100;
    const gameBoard = document.getElementById('game-board');
    const player1Btn = document.getElementById('player1-btn');
    const player2Btn = document.getElementById('player2-btn');
    const player3Btn = document.getElementById('player3-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const backwardBtn = document.getElementById('backward-btn');
    const logoContainer = document.getElementById('logo-container');
  
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
  
    function initGame() {
      createBoardCells();
      renderBoard();
      updatePlayerButtonStyles();
      addEventListeners();
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
  
    function renderBoard() {
      gameBoard.innerHTML = '';
      gameBoard.appendChild(logoContainer);
  
      const centerInfo = document.createElement('div');
      centerInfo.className = 'center-info hidden';
      centerInfo.id = 'center-info';
      centerInfo.innerHTML = `<div class="close-btn" onclick="this.parentElement.classList.add('hidden'); logoContainer.classList.remove('hidden')">×</div><div id="center-title" class="center-title">表格內容</div><div id="center-description" class="center-description">點擊任意格子顯示詳細資訊</div>`;
      gameBoard.appendChild(centerInfo);
  
      pathCells.forEach(cell => {
        const div = document.createElement('div');
        div.className = `cell cell-${cell.position}`;
        div.style.left = `${cell.x * cellWidth}px`;
        div.style.top = `${cell.y * cellHeight}px`;
        div.style.backgroundColor = cell.color;
        if (cell.position === highlightedCell) div.classList.add('highlighted');
  
        div.innerHTML = `<div class="cell-content"><div class="cell-title">${cell.title}</div><div class="cell-description">${cell.description}</div></div>`;
        div.addEventListener('click', () => {
          updateCenterInfo(cell.title, cell.description);
          document.getElementById('center-info').style.backgroundColor = cell.color;
          document.getElementById('center-info').classList.remove('hidden');
          logoContainer.classList.add('hidden');
        });
        gameBoard.appendChild(div);
      });
  
      updatePlayerPositions();
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
      enableDisableButtons(false);
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
      enableDisableButtons(true);
      sendGameStateToControllers();
    }
  
    function enableDisableButtons(enable) {
      [player1Btn, player2Btn, player3Btn, forwardBtn, backwardBtn].forEach(btn => btn.disabled = !enable);
    }
  
    function selectPlayer(num) {
      if (num < 1 || num > 3 || isMoving) return;
      selectedPlayer = num;
      updatePlayerButtonStyles();
      sendGameStateToControllers();
    }
  
    function updatePlayerButtonStyles() {
      [player1Btn, player2Btn, player3Btn].forEach((btn, idx) => btn.classList.toggle('selected', idx + 1 === selectedPlayer));
    }
  
    function addEventListeners() {
      player1Btn.addEventListener('click', () => selectPlayer(1));
      player2Btn.addEventListener('click', () => selectPlayer(2));
      player3Btn.addEventListener('click', () => selectPlayer(3));
      forwardBtn.addEventListener('click', () => handleDirectionSelection(true, 1));
      backwardBtn.addEventListener('click', () => handleDirectionSelection(false, 1));
    }
  
    function initPlayerPositions() {
      playerPathIndices = [0, 0, 0];
    }
  
    initPlayerPositions();
    initGame();
  });
  