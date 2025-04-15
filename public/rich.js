// rich.js（整合單機繪製 + 聯機控制）

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

  const bgColors = {
    1: '#5b9df0',
    2: '#9270ca',
    3: '#ff544d'
  };

  let ws = null;
  const wsUrl = `wss://${window.location.host}?clientType=game`;

  async function loadGameConfig() {
    try {
      const response = await fetch('/game-config.json');
      if (!response.ok) throw new Error(`載入失敗: ${response.status}`);
      gameConfig = await response.json();
    } catch (err) {
      console.error('讀取配置錯誤:', err);
      gameConfig = { centerLogoUrl: null };
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
        const msg = JSON.parse(event.data);
        if (msg.type === 'controlCommand') {
          handleControlCommand(msg.command, msg.params);
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };
    ws.onclose = () => setTimeout(connectWebSocket, 3000);
  }

  function sendGameStateToControllers() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const p1 = gameConfig.player1?.avatarUrl || null;
    const p2 = gameConfig.player2?.avatarUrl || null;
    const p3 = gameConfig.player3?.avatarUrl || null;

    ws.send(JSON.stringify({
      type: 'gameStateUpdate',
      data: {
        selectedPlayer,
        playerPathIndices,
        highlightedCell,
        isMoving,
        players: {
          1: { avatarUrl: p1 },
          2: { avatarUrl: p2 },
          3: { avatarUrl: p3 }
        }
      }
    }));
  }

  function handleControlCommand(command, params) {
    switch (command) {
      case 'selectPlayer':
        selectedPlayer = params.player;
        sendGameStateToControllers();
        break;
      case 'movePlayer':
        handleDirectionSelection(params.direction === 'forward', parseInt(params.steps) || 1, params.player);
        break;
      case 'showPlayerInfo':
        showPlayerInfo(params.player);
        break;
      case 'hidePlayerInfo':
        hidePlayerInfo();
        break;
    }
  }

  function showPlayerInfo(playerNum) {
    const panel = document.getElementById('center-info');
    const index = playerPathIndices[playerNum - 1];
    const cell = pathCells[index];
    if (panel && cell) {
      document.getElementById('center-title').textContent = cell.title;
      document.getElementById('center-description').textContent = cell.description;
      panel.style.backgroundColor = cell.color;
      panel.classList.remove('hidden');
      logoContainer.classList.add('hidden');
    }
  }

  function hidePlayerInfo() {
    const panel = document.getElementById('center-info');
    if (panel) panel.classList.add('hidden');
    logoContainer.classList.remove('hidden');
  }

  function handleDirectionSelection(isForward, totalSteps, player) {
    if (isMoving || player < 1 || player > 3) return;
    isMoving = true;
    highlightedCell = null;
    let index = playerPathIndices[player - 1];

    function moveStep() {
      index = isForward ? (index + 1) % pathCells.length : (index - 1 + pathCells.length) % pathCells.length;
      playerPathIndices[player - 1] = index;
      updatePlayerPositions();
      if (--totalSteps > 0) setTimeout(moveStep, STEP_ANIMATION_DELAY);
      else finishMoving(index);
    }

    setTimeout(moveStep, STEP_ANIMATION_DELAY);
  }

  function finishMoving(finalIndex) {
    isMoving = false;
    highlightedCell = finalIndex;
    renderBoard();
    sendGameStateToControllers();
  }

  function createBoardCells() {
    const boardWidth = 7;
    const sideHeight = 4;
    pathCells = [];
    const top = [colors.goldenPurple, colors.geekBlue, colors.cyan, colors.grey, colors.sunriseYellow, colors.dustRed, colors.goldenPurple];
    const right = [colors.daybreakBlue, colors.sunsetOrange, colors.darkGreen, colors.magenta];
    const bottom = [colors.goldenPurple, colors.sunsetOrange, colors.darkGreen, colors.magenta, colors.geekBlue, colors.cyan, colors.goldenPurple];
    const left = [colors.daybreakBlue, colors.grey, colors.sunriseYellow, colors.dustRed];

    pathCells.push({ x: 0, y: sideHeight + 1, title: '左下角', description: '起點', color: colors.goldenPurple, position: 0 });
    for (let i = 1; i < boardWidth - 1; i++) pathCells.push({ x: i, y: sideHeight + 1, title: `底部 ${i}`, description: `底部格 ${i}`, color: bottom[i], position: pathCells.length });
    pathCells.push({ x: boardWidth - 1, y: sideHeight + 1, title: '右下角', description: '轉角', color: colors.goldenPurple, position: pathCells.length });
    for (let i = 0; i < sideHeight; i++) pathCells.push({ x: boardWidth - 1, y: sideHeight - i, title: `右側 ${i+1}`, description: `右邊第 ${i+1} 格`, color: right[i], position: pathCells.length });
    pathCells.push({ x: boardWidth - 1, y: 0, title: '右上角', description: '轉角', color: colors.goldenPurple, position: pathCells.length });
    for (let i = boardWidth - 2; i > 0; i--) pathCells.push({ x: i, y: 0, title: `頂部 ${boardWidth - 1 - i}`, description: `頂部格`, color: top[i], position: pathCells.length });
    pathCells.push({ x: 0, y: 0, title: '左上角', description: '轉角', color: colors.goldenPurple, position: pathCells.length });
    for (let i = 0; i < sideHeight; i++) pathCells.push({ x: 0, y: i + 1, title: `左側 ${i+1}`, description: `左邊第 ${i+1} 格`, color: left[i], position: pathCells.length });
  }

  function renderBoard() {
    gameBoard.innerHTML = '';
    logoContainer.innerHTML = '';
    logoContainer.classList.remove('hidden');
    if (gameConfig.centerLogoUrl) {
      const logoImg = document.createElement('img');
      logoImg.src = gameConfig.centerLogoUrl;
      logoImg.classList.add('game-logo-image');
      logoContainer.appendChild(logoImg);
    } else {
      logoContainer.innerHTML = `<div class="logo-text">大富翁</div><div class="logo-subtitle">開始你的幸運之旅吧！</div>`;
    }
    gameBoard.appendChild(logoContainer);

    const infoPanel = document.createElement('div');
    infoPanel.id = 'center-info';
    infoPanel.className = 'center-info hidden';
    infoPanel.innerHTML = `<div class="close-btn" onclick="this.parentElement.classList.add('hidden'); document.getElementById('logo-container').classList.remove('hidden')">×</div><div id="center-title" class="center-title"></div><div id="center-description" class="center-description"></div>`;
    gameBoard.appendChild(infoPanel);

    pathCells.forEach(cell => {
      const div = document.createElement('div');
      div.className = `cell cell-pos-${cell.position}`;
      div.dataset.index = cell.position;
      div.style.left = `${cell.x * cellWidth}px`;
      div.style.top = `${cell.y * cellHeight}px`;
      div.style.backgroundColor = cell.color;
      if (cell.position === highlightedCell) div.classList.add('highlighted');
      div.innerHTML = `<div class="cell-content"><div class="cell-title">${cell.title}</div></div>`;
      div.addEventListener('click', () => showPlayerInfo(selectedPlayer));
      gameBoard.appendChild(div);
    });
    updatePlayerPositions();
  }

  function updatePlayerPositions() {
    document.querySelectorAll('.player-token').forEach(el => el.remove());
    playerTokens = [];

    playerPathIndices.forEach((index, i) => {
      const playerNum = i + 1;
      const cell = pathCells[index];
      const playerConfig = gameConfig[`player${playerNum}`] || {};
      const token = document.createElement('div');
      token.className = `player-token player${playerNum}-token`;
      token.style.position = 'absolute';
      token.style.width = '40px';
      token.style.height = '40px';
      token.style.transform = 'translate(-50%, -50%)';
      token.style.zIndex = '10';

      if (playerConfig.avatarUrl) {
        token.innerHTML = `<div style="width: 100%; height: 100%; border-radius: 50%; background-color: ${bgColors[playerNum]}; display: flex; align-items: center; justify-content: center; padding: 4px;"><img src="${playerConfig.avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;"></div>`;
      } else {
        token.textContent = playerConfig.name || `P${playerNum}`;
        token.style.backgroundColor = bgColors[playerNum];
        token.style.border = '2px solid white';
      }

      const angle = (2 * Math.PI / 3) * i;
      const radius = 15;
      const offsetX = Math.cos(angle) * radius;
      const offsetY = Math.sin(angle) * radius;
      token.style.left = `${cell.x * cellWidth + cellWidth / 2 + offsetX}px`;
      token.style.top = `${cell.y * cellHeight + cellHeight / 2 + offsetY}px`;

      gameBoard.appendChild(token);
      playerTokens.push(token);
    });
  }

  function initPlayerPositions() {
    playerPathIndices = [0, 0, 0];
  }

  initPlayerPositions();
  loadGameConfig().then(() => {
    createBoardCells();
    renderBoard();
    connectWebSocket();
  });
});
