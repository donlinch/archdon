// ✅ rich.js (支援模組化格子資料 + 玩家頭像 + 模板選擇器)
document.addEventListener('DOMContentLoaded', () => {
  const cellWidth = 125;
  const cellHeight = 100;
  const gameBoard = document.getElementById('game-board');
  const logoContainer = document.getElementById('logo-container');
  const gameContainer = document.getElementById('game-container'); // Get game container for background

  // --- Template Menu Elements ---
  const templateNavToggle = document.getElementById('templateNavToggle');
  const templateMenu = document.getElementById('templateMenu');
  const templateMenuClose = document.getElementById('templateMenuClose');
  const templateSelect = document.getElementById('templateSelect');
  const loadTemplateBtn = document.getElementById('loadTemplateBtn');
  const loadingSpinner = document.getElementById('loadingSpinner');
  // --- End New Elements ---

  let gameConfig = {}; // Keep for potential fallback or other settings
  let pathCells = []; // Will be populated by loaded template
  let currentTemplateId = null; // Track the currently loaded template ID
  let currentLogoUrl = ''; // Track current logo
  let currentBgColor = '#fff0f5'; // Default/current background
  let currentPlayers = []; // Store loaded player data

  // --- Game State Variables ---
  let selectedPlayer = 1;
  let isMoving = false;
  let highlightedCell = null;
  let playerPathIndices = [0, 0, 0]; // Index in the pathCells array for each player
  const STEP_ANIMATION_DELAY = 300;
  let playerTokenContainers = []; // 追踪玩家令牌容器，而不僅僅是令牌
  const bgColors = { // Player token background color fallback
    1: '#5b9df0', // Blue
    2: '#9270ca', // Purple
    3: '#ff544d'  // Red
  };
  let ws = null;
  const wsUrl = `wss://${window.location.host}?clientType=game`;
  // --- End Game State Variables ---

  // --- Fetch Template List ---
  async function fetchTemplateList() {
      try {
          const response = await fetch('/api/rich-map/templates');
          if (!response.ok) throw new Error(`Failed to fetch templates list: ${response.status}`);
          const templates = await response.json();

          templateSelect.innerHTML = ''; // Clear loading/previous options
          if (templates.length === 0) {
              templateSelect.innerHTML = '<option value="">無可用模板</option>';
              loadTemplateBtn.disabled = true;
          } else {
              templates.forEach(template => {
                  const option = document.createElement('option');
                  option.value = template.id;
                  option.textContent = `${template.template_name} (ID: ${template.id})`;
                  templateSelect.appendChild(option);
              });
              loadTemplateBtn.disabled = false;
              // Select the current one if it exists in the list, otherwise select the first
              if (currentTemplateId && templates.some(t => t.id == currentTemplateId)) {
                  templateSelect.value = currentTemplateId;
              } else if (templates.length > 0) {
                   templateSelect.value = templates[0].id; // Select first if nothing loaded yet
              }
          }
      } catch (error) {
          console.error("Error fetching template list:", error);
          templateSelect.innerHTML = '<option value="">載入列表失敗</option>';
          loadTemplateBtn.disabled = true;
      }
  }

  // --- Load Full Template Data ---
  async function loadTemplate(templateId) {
      if (!templateId) return;
      templateId = parseInt(templateId); // Ensure it's a number
      console.log(`Loading template ID: ${templateId}`);
      loadTemplateBtn.disabled = true;
      if (loadingSpinner) loadingSpinner.style.display = 'inline-block'; // Show spinner

      try {
          const response = await fetch(`/api/rich-map/templates/${templateId}/full`);
          if (!response.ok) {
               const errData = await response.json().catch(() => ({}));
               throw new Error(`伺服器錯誤 ${response.status}: ${errData.error || response.statusText}`);
          }
          const data = await response.json();
          console.log("Loaded template data:", data);

          // --- Update Global State ---
          currentTemplateId = templateId;
          currentBgColor = data.background_color || '#fff0f5'; // Default Lavender Blush
          pathCells = data.cells || [];
          currentLogoUrl = data.logo_url || '';
          currentPlayers = data.players || [];
          // --- End Update Global State ---

          // Apply updates to UI
          applyTemplateBackgroundColor(currentBgColor);
          initPlayerPositions(); // Reset positions based on new map (to index 0)
          highlightedCell = null; // Clear highlight on new map load
          isMoving = false; // Ensure moving state is reset
          renderBoard(); // Re-render board with new data
          sendGameStateToControllers(); // Update controllers with the new state
          closeTemplateMenu(); // Close menu after successful load

          // Update the select dropdown to show the loaded template
          if (templateSelect) templateSelect.value = currentTemplateId;

          // 初始化選擇視覺效果
          updateSelectedPlayerVisuals(selectedPlayer);

      } catch (error) {
          console.error(`Error loading template ${templateId}:`, error);
          alert(`載入模板失敗 (ID: ${templateId}):\n${error.message}`);
          // Optionally clear the board or show an error state
           if(gameBoard) gameBoard.innerHTML = `<p style="color:red; text-align:center; padding-top: 50px;">載入地圖失敗 (ID: ${templateId})</p>`;
           pathCells = []; // Clear cells on failure
           currentTemplateId = null; // Reset current ID
           applyTemplateBackgroundColor('#e0e0e0'); // Grey background
           // You might want to disable controls or clear player tokens here too
      } finally {
          loadTemplateBtn.disabled = false;
          if (loadingSpinner) loadingSpinner.style.display = 'none'; // Hide spinner
      }
  }

   // --- Apply Background Color ---
   function applyTemplateBackgroundColor(color) {
      if (gameContainer) {
          gameContainer.style.backgroundColor = color || '#fff0f5'; // Fallback color
      } else {
          console.error("Game container element not found for background color.");
      }
   }

  // --- Render Board using template data ---
  function renderBoard() {
      if (!gameBoard || !logoContainer) {
           console.error("Required board or logo container elements not found!");
           return;
       }
      gameBoard.innerHTML = ''; // Clear previous board content
      logoContainer.innerHTML = ''; // Clear previous logo content
      logoContainer.classList.remove('hidden'); // Ensure logo container is visible initially

      // Render Logo from template data
      if (currentLogoUrl) {
          const img = document.createElement('img');
          img.src = currentLogoUrl;
          img.alt = "遊戲 Logo";
          img.className = 'game-logo-image'; // Use the class defined in HTML's style
           img.onerror = () => {
               console.warn("Logo image failed to load:", currentLogoUrl);
               logoContainer.innerHTML = `<div class="logo-text" style="font-size: 2rem; color: #cc0000;">Logo載入失敗</div>`; // Fallback text
           };
          logoContainer.appendChild(img);
      } else {
          // Default text if no logo URL in template
          logoContainer.innerHTML = `<div class="logo-text">大富翁</div><div class="logo-subtitle">選擇模板開始遊戲</div>`;
      }
      gameBoard.appendChild(logoContainer); // Add logo container back to the board

      // Render the hidden info panel structure
      const panel = document.createElement('div');
      panel.id = 'center-info';
      panel.className = 'center-info hidden'; // Start hidden
      panel.innerHTML = `<div class="close-btn" onclick="this.parentElement.classList.add('hidden'); document.getElementById('logo-container').classList.remove('hidden')">×</div><div id="center-title" class="center-title"></div><div id="center-description" class="center-description"></div>`;
      gameBoard.appendChild(panel);

      // Render Cells from template data (pathCells)
      if (!Array.isArray(pathCells)) {
           console.error("pathCells is not an array!", pathCells);
           gameBoard.innerHTML += '<p style="color:red; text-align:center; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);">地圖資料錯誤</p>';
           return;
       }

      pathCells.forEach((cell, index) => {
          const div = document.createElement('div');
          // Use position property if available and valid, otherwise fallback to index
          const cellIdentifier = (cell.position !== undefined && !isNaN(parseInt(cell.position))) ? parseInt(cell.position) : index;
          div.className = `cell cell-pos-${cellIdentifier}`;
          div.dataset.index = cellIdentifier; // Store the identifier for potential lookups

          const x = Number(cell.x);
          const y = Number(cell.y);

          if (isNaN(x) || isNaN(y)) {
               console.warn(`Invalid coordinates for cell at index ${index}:`, cell);
               return; // Skip rendering this cell
           }

          div.style.position = 'absolute'; // Ensure positioning is absolute
          div.style.left = `${x * cellWidth}px`;
          div.style.top = `${y * cellHeight}px`;
          div.style.backgroundColor = cell.color || '#cccccc'; // Use cell color from data

          // Apply highlight if this cell is the highlighted one
          if (cellIdentifier === highlightedCell) {
               div.classList.add('highlighted');
          }

           // Cell Content (Image and Title)
           let contentHTML = '';
           if (cell.image_url) {
               // Added error handling for cell images
               contentHTML += `<img src="${cell.image_url}" alt="${cell.title || ''}" style="max-width:80%; max-height:50%; object-fit:contain; margin-bottom:4px;" onerror="this.style.display='none'; console.warn('Cell image failed: ${cell.image_url}')">`;
           }
           contentHTML += `<div class="cell-title">${cell.title || ''}</div>`;
           // Optionally add description to cell here if needed:
           // contentHTML += `<div class="cell-description" style="font-size:0.7rem; line-height: 1.1;">${cell.description || ''}</div>`;

          div.innerHTML = `<div class="cell-content">${contentHTML}</div>`;

          // Click event to show info panel (using the cell's own data)
          div.addEventListener('click', () => showCellInfo(cellIdentifier)); // Pass identifier
          gameBoard.appendChild(div);
      });

      updatePlayerPositions(); // Render players based on the newly rendered map
  }

  // --- Show Cell Info (Modified from showPlayerInfo) ---
  function showCellInfo(cellPos) {
      const panel = document.getElementById('center-info');
      // Find the cell data using the position/identifier
      const cell = pathCells.find(c => c.position == cellPos); // Use == for potential type difference

      if (panel && cell) {
          document.getElementById('center-title').textContent = cell.title || '無標題';
          document.getElementById('center-description').textContent = cell.description || '無描述';
          panel.style.backgroundColor = cell.color || '#dddddd'; // Use cell color or a default grey
          panel.classList.remove('hidden');
          if (logoContainer) logoContainer.classList.add('hidden'); // Hide logo
      } else {
          console.warn(`Could not find cell data for position: ${cellPos}`);
          // Optionally hide the panel if cell data not found
           hidePlayerInfo(); // Reuse hidePlayerInfo to hide panel and show logo
      }
  }

  // --- Update Player Positions using loaded template data ---
  function updatePlayerPositions() {
    // 移除先前的玩家令牌
    document.querySelectorAll('.player-token-container').forEach(el => el.remove());
    playerTokenContainers = []; // 清空數組

    if (!gameBoard || !Array.isArray(pathCells) || pathCells.length === 0) {
      console.warn("無法更新玩家位置：遊戲板或路徑單元格尚未準備好。");
      return; // 如果地圖未就緒，不渲染玩家
    }

    playerPathIndices.forEach((pathIndex, playerArrayIndex) => {
      // 確保 pathIndex 對當前 pathCells 長度有效
      const safePathIndex = (pathIndex >= 0 && pathIndex < pathCells.length) ? pathIndex : 0;
      // 通過 pathCells 中的數組索引查找與玩家當前位置索引對應的單元格數據
      const cellData = pathCells[safePathIndex]; // 按數組索引獲取單元格數據

      if (!cellData) {
        console.warn(`無法為 ${playerArrayIndex + 1} 號玩家在 safePathIndex ${safePathIndex} 找到單元格數據`);
        return; // 如果缺少該位置的單元格數據，則跳過此玩家
      }

      const playerNum = playerArrayIndex + 1;
      // 從加載的模板數據獲取玩家配置 (currentPlayers)
      const playerConfig = currentPlayers.find(p => p.player_number === playerNum) || {};
      
      // *** 新增：創建一個容器元素來持有令牌和名稱標籤 ***
      const container = document.createElement('div');
      container.className = 'player-token-container';
      container.style.position = 'absolute';
      container.style.zIndex = '10';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.transition = 'left 0.3s ease-in-out, top 0.3s ease-in-out'; // 平滑移動

      // *** 創建令牌元素（頭像）***
      const token = document.createElement('div');
      token.className = `player-token player${playerNum}-token`; // 應用一般和特定玩家類
      // 直接應用常見樣式
      token.style.width = '40px';
      token.style.height = '40px';
      token.style.borderRadius = '50%'; // 確保它是圓形的
      token.style.display = 'flex';
      token.style.alignItems = 'center';
      token.style.justifyContent = 'center';
      token.style.overflow = 'hidden'; // 隱藏圖像/文本的溢出部分
      token.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
      token.style.border = '2px solid white';
      token.style.zIndex = '10';

      // 獲取玩家名稱，如果在配置中存在，否則使用 P# 格式
      const playerName = playerConfig.name || `P${playerNum}`;

      // 使用配置中的頭像或後備
      if (playerConfig.avatar_url) {
        token.style.backgroundColor = 'transparent'; // 如果使用圖像，使背景透明
        token.innerHTML = `<img src="${playerConfig.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="P${playerNum} Avatar" onerror="this.parentElement.style.backgroundColor='${bgColors[playerNum]}'; this.remove(); console.warn('Avatar failed: ${playerConfig.avatar_url}')">`;
      } else {
        // 後備到文本（名稱或 P#）和背景顏色
        token.textContent = playerName.charAt(0); // 只用名稱的第一個字母
        token.style.backgroundColor = bgColors[playerNum];
        token.style.fontSize = '14px';
        token.style.fontWeight = 'bold';
        token.style.color = 'white';
        token.style.textShadow = '1px 1px 1px rgba(0,0,0,0.4)';
      }

      // *** 新增：創建名稱標籤 ***
      const nameLabel = document.createElement('div');
      nameLabel.className = 'player-name-label';
      nameLabel.textContent = playerName;
      nameLabel.style.backgroundColor = bgColors[playerNum];
      nameLabel.style.color = 'white';
      nameLabel.style.padding = '2px 6px';
      nameLabel.style.borderRadius = '10px';
      nameLabel.style.fontSize = '10px';
      nameLabel.style.fontWeight = 'bold';
      nameLabel.style.marginTop = '3px';
      nameLabel.style.whiteSpace = 'nowrap';
      nameLabel.style.maxWidth = '70px';
      nameLabel.style.overflow = 'hidden';
      nameLabel.style.textOverflow = 'ellipsis';
      nameLabel.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
      nameLabel.style.textShadow = '0px 1px 1px rgba(0,0,0,0.2)';

      // --- 定位邏輯 ---
      const x = Number(cellData.x); // 基於單元格數據的位置（x, y 網格）
      const y = Number(cellData.y);
      
      if (isNaN(x) || isNaN(y)) {
        console.warn(`${playerNum} 號玩家的單元格數據坐標無效:`, cellData);
        return; // 如果坐標無效則跳過定位
      }

      // 多玩家偏移邏輯
      const angle = (2 * Math.PI / 3) * playerArrayIndex; // 分配 3 個玩家
      const radius = 15; // 距離中心多遠
      const offsetX = Math.cos(angle) * radius;
      const offsetY = Math.sin(angle) * radius;
      
      // 相對於單元格中心的位置
      container.style.left = `${x * cellWidth + cellWidth / 2 + offsetX}px`;
      container.style.top = `${y * cellHeight + cellHeight / 2 + offsetY}px`;
      container.style.transform = 'translate(-50%, -50%)'; // 中心於位置
      // --- 結束定位邏輯 ---

      // 將令牌和名稱標籤添加到容器中
      container.appendChild(token);
      container.appendChild(nameLabel);
      
      // 將容器添加到遊戲板中
      gameBoard.appendChild(container);
      playerTokenContainers.push(container); // 存儲容器的引用以便將來更新
    });
    
    // 在更新玩家位置後也更新視覺效果
    updateSelectedPlayerVisuals(selectedPlayer);
  }

  // --- Hide Info Panel (shows logo) ---
   function hidePlayerInfo() { // Renamed for clarity, still hides center panel
      const panel = document.getElementById('center-info');
      if (panel) panel.classList.add('hidden');
      if (logoContainer) logoContainer.classList.remove('hidden'); // Show logo
  }

  // --- Handle Player Movement ---
  function handleDirectionSelection(isForward, steps, player) {
      if (isMoving || player < 1 || player > 3) return;
      if (!Array.isArray(pathCells) || pathCells.length === 0) {
          console.warn("Cannot move: Map data (pathCells) is not loaded or empty.");
          return; // Don't move if map isn't ready
      }

      isMoving = true;
      highlightedCell = null; // Clear previous highlight
      // Clear highlight class from all cells first
      document.querySelectorAll('.cell.highlighted').forEach(c => c.classList.remove('highlighted'));

      let currentPathIndex = playerPathIndices[player - 1];
      // Validate current index before starting movement
      if (currentPathIndex < 0 || currentPathIndex >= pathCells.length) {
          console.warn(`Player ${player} has invalid starting index ${currentPathIndex}, resetting to 0.`);
          currentPathIndex = 0;
          playerPathIndices[player - 1] = 0; // Correct the state
      }

      let targetIndex = currentPathIndex; // Store the final target index

      function moveStep() {
          // Calculate next index based on direction
          currentPathIndex = isForward
              ? (currentPathIndex + 1) % pathCells.length
              : (currentPathIndex - 1 + pathCells.length) % pathCells.length;

          // Update the player's state *immediately*
          playerPathIndices[player - 1] = currentPathIndex;
          targetIndex = currentPathIndex; // Keep track of the final index for highlighting

          // Update visual position
          updatePlayerPositions(); // This moves the token visually

          steps--; // Decrement remaining steps

          if (steps > 0) {
               setTimeout(moveStep, STEP_ANIMATION_DELAY); // Continue moving if steps remain
           } else {
               finishMoving(targetIndex); // Finish when steps are done
           }
      }

      // Start the first step
      sendGameStateToControllers(); // Notify controllers that movement started
      moveStep(); // Initiate movement
  }

  // --- Finish Movement ---
   function finishMoving(finalIndex) {
    console.log(`移動結束於索引: ${finalIndex}`);
    isMoving = false;
    highlightedCell = finalIndex; // 將最終單元格設為高亮顯示

    // 應用高亮顯示類到目標單元格
    const targetCellElement = gameBoard.querySelector(`.cell[data-index="${finalIndex}"]`);
    if (targetCellElement) {
      // 首先清除現有高亮以確保安全
      document.querySelectorAll('.cell.highlighted').forEach(c => c.classList.remove('highlighted'));
      targetCellElement.classList.add('highlighted');
    } else {
      console.warn(`找不到要高亮顯示的目標單元格元素: 索引 ${finalIndex}`);
    }

    // 確保玩家位置完全正確 (updatePlayerPositions 可能有輕微的異步延遲視覺效果)
    updatePlayerPositions();

    sendGameStateToControllers(); // 發送最終狀態更新
  }

  // --- Initialize Player Positions ---
  function initPlayerPositions() {
      // Reset all players to the start of the path (index 0)
      playerPathIndices = [0, 0, 0];
      console.log("Player positions initialized to:", playerPathIndices);
  }

  // --- WebSocket Connection ---
   function connectWebSocket() {
      // Close existing connection if any to prevent multiple connections
      if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
          console.log("Closing existing WebSocket connection before reconnecting.");
          ws.close();
      } else {
           console.log("No existing WebSocket connection or already closed.");
       }

      ws = new WebSocket(wsUrl);
      console.log("Attempting WebSocket connection...");

      ws.onopen = () => {
           console.log("WebSocket Connected");
           // Send initial state ONLY if a map has been successfully loaded
           if (currentTemplateId) {
                console.log("Sending initial game state as map is loaded.");
                sendGameStateToControllers();
           } else {
                console.log("WebSocket open, but no map loaded yet. Waiting for map load.");
            }
       };

      ws.onmessage = ({ data }) => {
          try {
               console.log("WebSocket Message Received:", data);
              const msg = JSON.parse(data);
              if (msg.type === 'controlCommand') {
                   console.log("Handling control command:", msg.command, msg.params);
                  handleControlCommand(msg.command, msg.params);
              } else if (msg.type === 'requestGameState') { // Handle requests from controller
                  console.log("Received requestGameState from controller");
                  sendGameStateToControllers();
              }
          } catch (err) {
              console.error('WS message processing error:', err);
          }
      };
      ws.onclose = (event) => {
           console.log(`WebSocket Closed. Code: ${event.code}, Reason: ${event.reason}. Reconnecting...`);
           ws = null; // Ensure ws is nullified
          // Implement robust reconnection with backoff if needed
          setTimeout(connectWebSocket, 5000); // Increased reconnect delay
      };
       ws.onerror = (error) => {
           console.error("WebSocket Error:", error);
           // onclose will likely fire after an error, triggering reconnection
       };
  }

  // --- Send Game State to Controllers ---
   function sendGameStateToControllers() {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
           // console.warn("Cannot send game state: WebSocket not open."); // Reduce noise, log only on errors/major events
           return;
       }
      // Prepare simplified player data for the controller
      const playersForController = currentPlayers.reduce((acc, p) => {
           acc[p.player_number] = { avatarUrl: p.avatar_url || null, name: p.name || `P${p.player_number}` };
           return acc;
       }, {});

       // Ensure players 1, 2, 3 exist even if template has fewer
       for (let i = 1; i <= 3; i++) {
          if (!playersForController[i]) {
              playersForController[i] = { avatarUrl: null, name: `P${i}`};
          }
       }


      const gameState = {
           type: 'gameStateUpdate',
           data: {
               currentTemplateId: currentTemplateId,
               selectedPlayer: selectedPlayer,
               playerPathIndices: playerPathIndices,
               highlightedCell: highlightedCell,
               isMoving: isMoving,
               players: playersForController // Send processed player data
           }
       };
      // console.log("Sending game state to controllers:", gameState); // Log selectively for debugging movement/load issues
       ws.send(JSON.stringify(gameState));
  }

  // --- Handle Commands from Controller ---
  function handleControlCommand(cmd, params) {
    // 基本驗證
    const player = params ? parseInt(params.player) : null;
    if (cmd === 'selectPlayer' || cmd === 'movePlayer' || cmd === 'showPlayerInfo') {
      if (!player || player < 1 || player > 3) {
        console.warn(`收到命令 ${cmd} 的玩家編號無效:`, params);
        return;
      }
    }

    switch (cmd) {
      case 'selectPlayer':
        selectedPlayer = player;
        console.log("通過控制器選擇了玩家:", selectedPlayer);
        
        // 更新玩家選擇的視覺提示
        updateSelectedPlayerVisuals(selectedPlayer);
        
        sendGameStateToControllers(); // 通知其他控制器
        break;
      case 'movePlayer':
        if (!isMoving) { // Prevent multiple move commands while already moving
           handleDirectionSelection(params.direction === 'forward', +params.steps || 1, player);
        } else {
           console.warn("Ignoring move command: Already moving.");
        }
        break;
      case 'showPlayerInfo':
         // Find the position of the requested player
         const playerIndexToShow = player - 1;
         if (playerIndexToShow >= 0 && playerIndexToShow < playerPathIndices.length) {
             const cellIndexOfPlayer = playerPathIndices[playerIndexToShow];
             // Find the cell identifier (position) from the cell data at that index
             if (cellIndexOfPlayer >= 0 && cellIndexOfPlayer < pathCells.length) {
                 const cellToShow = pathCells[cellIndexOfPlayer];
                 const cellPosIdentifier = cellToShow.position !== undefined ? cellToShow.position : cellIndexOfPlayer;
                 showCellInfo(cellPosIdentifier); // Show info for the cell the player is on
             } else {
                  console.warn(`Invalid cell index ${cellIndexOfPlayer} for player ${player}`);
                  hidePlayerInfo(); // Hide panel if player position is invalid
             }
         } else {
              console.warn(`Invalid player index ${playerIndexToShow} for showPlayerInfo`);
              hidePlayerInfo();
         }
         break;
      case 'hidePlayerInfo':
         hidePlayerInfo();
         break;
      case 'getGameState': // Respond to specific request from controller
          console.log("Received getGameState command from controller");
          sendGameStateToControllers();
          break;
      default:
          console.warn("Unknown control command received:", cmd);
    }
  }

  // 添加用於更新玩家視覺選擇的新函數
  function updateSelectedPlayerVisuals(playerNumber) {
    if (!Array.isArray(playerTokenContainers)) {
      console.warn("playerTokenContainers 不是數組，無法更新視覺效果");
      return;
    }
    
    // 從所有玩家容器中移除 selected 類
    playerTokenContainers.forEach((container, index) => {
      if (container) {
        container.classList.toggle('selected', index + 1 === playerNumber);
      }
    });
    
    // 可以在這裡添加其他視覺提示，如面板顏色變化等
  }

  // --- Menu Toggle Logic ---
  function toggleTemplateMenu() {
      if (templateMenu) templateMenu.classList.toggle('visible');
  }
  function closeTemplateMenu() {
      if (templateMenu) templateMenu.classList.remove('visible');
  }

  // --- Event Listeners for Menu ---
  if (templateNavToggle) {
      templateNavToggle.addEventListener('click', toggleTemplateMenu);
  } else {
      console.error("Template toggle button not found!");
  }
  if (templateMenuClose) {
      templateMenuClose.addEventListener('click', closeTemplateMenu);
  } else {
      console.error("Template menu close button not found!");
  }
  if (loadTemplateBtn && templateSelect) {
      loadTemplateBtn.addEventListener
      loadTemplateBtn.addEventListener('click', () => {
        const selectedId = templateSelect.value;
        if (selectedId) {
            loadTemplate(selectedId); // Pass the value directly
        } else {
            alert("請先選擇一個模板！");
        }
    });
} else {
    console.error("Load template button or select dropdown not found!");
}

// --- NEW: Listener to close menu when clicking outside ---
// We attach it to the game container, assuming it covers the main clickable area below the menu.
if (gameContainer) {
  gameContainer.addEventListener('click', (event) => {
      // Check if the menu element exists and is currently visible
      if (templateMenu && templateMenu.classList.contains('visible')) {
          // Check if the click originated *inside* the menu itself
          const isClickInsideMenu = templateMenu.contains(event.target);
          // Check if the click was on the toggle button (which handles its own state)
          const isClickOnToggleButton = templateNavToggle && templateNavToggle.contains(event.target);

          // If the click was *not* inside the menu and *not* on the toggle button, close the menu
          if (!isClickInsideMenu && !isClickOnToggleButton) {
              console.log("Click outside menu detected, closing menu."); // Debug log
              closeTemplateMenu();
          }
      }
  });
} else {
    console.error("Game container element not found, cannot add outside click listener.");
}
// --- End NEW Listener ---

// --- Initialization ---
async function initializeGame() {
    console.log("Initializing game...");
    applyTemplateBackgroundColor(currentBgColor); // Apply default background initially
    if(gameBoard) gameBoard.innerHTML = '<p style="text-align:center; padding-top: 50px;">正在載入地圖列表...</p>'; // Initial message

    // Fetch the list first to populate the dropdown
    await fetchTemplateList();

    // Then, attempt to load the first template from the list as default
    const defaultTemplateId = templateSelect.options.length > 0 && templateSelect.value ? templateSelect.value : null;

    if (defaultTemplateId) {
         await loadTemplate(defaultTemplateId); // Load the default map
    } else {
         console.warn("No default template found or list failed to load.");
         if(gameBoard) gameBoard.innerHTML = '<p style="text-align:center; padding-top: 50px; color: orange;">沒有找到預設地圖。請從選單載入一個模板。</p>';
         applyTemplateBackgroundColor('#e0e0e0'); // Grey background
    }
    connectWebSocket(); // Connect WebSocket after initial setup attempt
}

initializeGame(); // Start the initialization process

}); // End DOMContentLoaded