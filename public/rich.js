// ✅ rich.js（支援多組地圖模板 template_name 與玩家頭像模組）
document.addEventListener('DOMContentLoaded', () => {
  const cellWidth = 125;
  const cellHeight = 100;
  const gameBoard = document.getElementById('game-board');
  const logoContainer = document.getElementById('logo-container');
  const mapSelector = document.getElementById('map-template-selector');

  let gameConfig = {};
  let mapTemplates = [];
  let pathCells = [];
  let selectedPlayer = 1;
  let isMoving = false;
  let highlightedCell = null;
  let playerPathIndices = [0, 0, 0];
  const STEP_ANIMATION_DELAY = 300;
  let playerTokens = [];

  const bgColors = {
    1: '#5b9df0',
    2: '#9270ca',
    3: '#ff544d'
  };

  let ws = null;
  const wsUrl = `wss://${window.location.host}?clientType=game`;

  async function loadGameConfig() {
    try {
      const res = await fetch('/game-config.json');
      if (!res.ok) throw new Error();
      gameConfig = await res.json();
    } catch {
      console.warn('無法載入 game-config.json');
      gameConfig = {};
    }
  }

  async function loadMapTemplates() {
    try {
      const res = await fetch('/map-config.json');
      if (!res.ok) throw new Error();
      mapTemplates = await res.json();
      populateMapSelector();
    } catch {
      console.warn('無法載入 map-config.json');
      mapTemplates = [];
    }
  }

  function populateMapSelector() {
    mapSelector.innerHTML = '';
    mapTemplates.forEach((template, i) => {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = template.template_name;
      mapSelector.appendChild(option);
    });
  }

  function applySelectedMap() {
    const selectedIndex = parseInt(mapSelector.value);
    const selectedTemplate = mapTemplates[selectedIndex];
    if (!selectedTemplate || !Array.isArray(selectedTemplate.content_data)) return;
    pathCells = selectedTemplate.content_data.map((cell, i) => ({ ...cell, position: i }));
    renderBoard();
    sendGameStateToControllers();
  }

  function connectWebSocket() {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => sendGameStateToControllers();
    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'controlCommand') handleControlCommand(msg.command, msg.params);
      } catch (err) {
        console.error('WS message error:', err);
      }
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
      case 'selectPlayer':
        selectedPlayer = params.player;
        sendGameStateToControllers();
        break;
      case 'movePlayer':
        handleDirectionSelection(params.direction === 'forward', +params.steps || 1, params.player);
        break;
      case 'showPlayerInfo': showPlayerInfo(params.player); break;
      case 'hidePlayerInfo': hidePlayerInfo(); break;
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

  function handleDirectionSelection(isForward, steps, player) {
    if (isMoving || player < 1 || player > 3) return;
    isMoving = true;
    highlightedCell = null;
    let index = playerPathIndices[player - 1];

    function moveStep() {
      index = isForward ? (index + 1) % pathCells.length : (index - 1 + pathCells.length) % pathCells.length;
      playerPathIndices[player - 1] = index;
      updatePlayerPositions();
      if (--steps > 0) setTimeout(moveStep, STEP_ANIMATION_DELAY);
      else finishMoving(index);
    }

    setTimeout(moveStep, STEP_ANIMATION_DELAY);
  }

  function finishMoving(index) {
    isMoving = false;
    highlightedCell = index;
    renderBoard();
    sendGameStateToControllers();
  }

  function renderBoard() {
    gameBoard.innerHTML = '';
    logoContainer.innerHTML = '';
    logoContainer.classList.remove('hidden');
    if (gameConfig.centerLogoUrl) {
      const img = document.createElement('img');
      img.src = gameConfig.centerLogoUrl;
      img.className = 'game-logo-image';
      logoContainer.appendChild(img);
    } else {
      logoContainer.innerHTML = `<div class="logo-text">大富翁</div><div class="logo-subtitle">開始你的幸運之旅吧！</div>`;
    }
    gameBoard.appendChild(logoContainer);

    const panel = document.createElement('div');
    panel.id = 'center-info';
    panel.className = 'center-info hidden';
    panel.innerHTML = `<div class="close-btn" onclick="this.parentElement.classList.add('hidden'); document.getElementById('logo-container').classList.remove('hidden')">×</div><div id="center-title" class="center-title"></div><div id="center-description" class="center-description"></div>`;
    gameBoard.appendChild(panel);

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
      const cell = pathCells[index];
      const num = i + 1;
      const config = gameConfig[`player${num}`] || {};
      const token = document.createElement('div');
      token.className = `player-token player${num}-token`;
      token.style.position = 'absolute';
      token.style.width = '40px';
      token.style.height = '40px';
      token.style.transform = 'translate(-50%, -50%)';
      token.style.zIndex = '10';

      if (config.avatarUrl) {
        token.innerHTML = `<div style="width: 100%; height: 100%; border-radius: 50%; background-color: ${bgColors[num]}; display: flex; align-items: center; justify-content: center; padding: 4px;"><img src="${config.avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;"></div>`;
      } else {
        token.textContent = config.name || `P${num}`;
        token.style.backgroundColor = bgColors[num];
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

  mapSelector.addEventListener('change', applySelectedMap);

  initPlayerPositions();
  Promise.all([loadGameConfig(), loadMapTemplates()]).then(() => {
    applySelectedMap();
    connectWebSocket();
  });
});