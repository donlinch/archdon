// ✅ 修正版 rich.js（遊戲主頁面）
document.addEventListener('DOMContentLoaded', () => {
    const cellWidth = 125;
    const cellHeight = 100;
    const gameBoard = document.getElementById('game-board');
    const logoContainer = document.getElementById('logo-container');
  
    let gameConfig = {};
    let pathCells = [];
    let selectedPlayer = 1;
    let isMoving = false;
    let highlightedCell = null;
    let playerPathIndices = [0, 0, 0];
    const STEP_ANIMATION_DELAY = 300;
  
    const colors = { geekBlue: '#5b9df0', cyan: '#0cd8b6', grey: '#5d7092', sunriseYellow: '#fbd115', dustRed: '#f9584a', daybreakBlue: '#6dc8ec', goldenPurple: '#9270ca', sunsetOrange: '#ff544d', darkGreen: '#26b9a9', magenta: '#ff94c3' };
  
    let ws = null;
    const wsUrl = `wss://${window.location.host}?clientType=game`;
  
    async function loadGameConfig() {
      try {
        const res = await fetch('/game-config.json');
        gameConfig = await res.json();
      } catch {
        gameConfig = {};
      }
    }
  
    function connectWebSocket() {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => sendGameStateToControllers();
      ws.onmessage = ({ data }) => {
        const msg = JSON.parse(data);
        if (msg.type === 'controlCommand') handleControlCommand(msg.command, msg.params);
      };
      ws.onclose = () => setTimeout(connectWebSocket, 3000);
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
          players: {
            1: { avatarUrl: gameConfig.player1?.avatarUrl || null },
            2: { avatarUrl: gameConfig.player2?.avatarUrl || null },
            3: { avatarUrl: gameConfig.player3?.avatarUrl || null }
          }
        }
      }));
    }
  
    function handleControlCommand(cmd, params) {
      switch (cmd) {
        case 'selectPlayer': selectPlayer(params.player); break;
        case 'movePlayer': handleDirectionSelection(params.direction === 'forward', +params.steps || 1, params.player); break;
        case 'jumpToPosition':
          if (params.player >= 1 && params.player <= 3 && params.position >= 0 && params.position < pathCells.length) {
            playerPathIndices[params.player - 1] = params.position;
            highlightedCell = params.position;
            renderBoard();
            sendGameStateToControllers();
          }
          break;
      }
    }
  
    function selectPlayer(num) {
      if (num < 1 || num > 3 || isMoving) return;
      if (selectedPlayer !== num) {
        selectedPlayer = num;
        sendGameStateToControllers();
      }
    }
  
    function handleDirectionSelection(isForward, totalSteps, playerToMove) {
      if (isMoving) return;
      if (playerToMove < 1 || playerToMove > 3) return;
      isMoving = true;
      highlightedCell = null;
      let currentIndex = playerPathIndices[playerToMove - 1];
      let stepsLeft = totalSteps;
      function moveStep() {
        currentIndex = isForward ? (currentIndex + 1) % pathCells.length : (currentIndex - 1 + pathCells.length) % pathCells.length;
        playerPathIndices[playerToMove - 1] = currentIndex;
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
      sendGameStateToControllers();
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
  
    function createBoardCells() {
      const boardWidth = 7, sideHeight = 4;
      const topColors = [colors.goldenPurple, colors.geekBlue, colors.cyan, colors.grey, colors.sunriseYellow, colors.dustRed, colors.goldenPurple];
      const rightColors = [colors.daybreakBlue, colors.sunsetOrange, colors.darkGreen, colors.magenta];
      const bottomColors = [colors.goldenPurple, colors.sunsetOrange, colors.darkGreen, colors.magenta, colors.geekBlue, colors.cyan, colors.goldenPurple];
      const leftColors = [colors.daybreakBlue, colors.grey, colors.sunriseYellow, colors.dustRed];
      pathCells = [];
      pathCells.push({ x: 0, y: sideHeight + 1, title: '左下角', color: colors.goldenPurple, position: 0 });
      for (let i = 1; i < boardWidth - 1; i++) pathCells.push({ x: i, y: sideHeight + 1, title: `底部 ${i}`, color: bottomColors[i], position: pathCells.length });
      pathCells.push({ x: boardWidth - 1, y: sideHeight + 1, title: '右下角', color: colors.goldenPurple, position: pathCells.length });
      for (let i = 0; i < sideHeight; i++) pathCells.push({ x: boardWidth - 1, y: sideHeight - i, title: `右側 ${i+1}`, color: rightColors[i], position: pathCells.length });
      pathCells.push({ x: boardWidth - 1, y: 0, title: '右上角', color: colors.goldenPurple, position: pathCells.length });
      for (let i = boardWidth - 2; i > 0; i--) pathCells.push({ x: i, y: 0, title: `頂部 ${boardWidth - 1 - i}`, color: topColors[i], position: pathCells.length });
      pathCells.push({ x: 0, y: 0, title: '左上角', color: colors.goldenPurple, position: pathCells.length });
      for (let i = 0; i < sideHeight; i++) pathCells.push({ x: 0, y: i + 1, title: `左側 ${i+1}`, color: leftColors[i], position: pathCells.length });
    }
  
    function renderBoard() {
      gameBoard.innerHTML = '';
      if (gameConfig.centerLogoUrl && logoContainer) {
        const logo = document.createElement('img');
        logo.src = gameConfig.centerLogoUrl;
        logo.className = 'game-logo-image';
        logoContainer.innerHTML = '';
        logoContainer.appendChild(logo);
      }
      gameBoard.appendChild(logoContainer);
      pathCells.forEach(cell => {
        const div = document.createElement('div');
        div.className = `cell cell-pos-${cell.position}`;
        div.dataset.index = cell.position;
        div.style.left = `${cell.x * cellWidth}px`;
        div.style.top = `${cell.y * cellHeight}px`;
        div.style.backgroundColor = cell.color;
        div.innerHTML = `<div class="cell-content"><div class="cell-title">${cell.title}</div></div>`;
        gameBoard.appendChild(div);
      });
      updatePlayerPositions();
    }
  
    async function initGame() {
      await loadGameConfig();
      createBoardCells();
      renderBoard();
      connectWebSocket();
    }
  
    initGame();
  });
  