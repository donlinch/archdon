// rich.js (Version with Status UI, Server-Pushed State, Template Loading)

document.addEventListener('DOMContentLoaded', () => {
  // --- Constants and Configuration ---
  const cellWidth = 125;
  const cellHeight = 100;
  const STEP_ANIMATION_DELAY = 400; // Slightly faster animation
  const MOVEMENT_TRANSITION_TIME = '0.35s'; // Sync with animation delay
  const bgColors = { // Player token background color fallback
      1: '#5b9df0', // Blue
      2: '#9270ca', // Purple
      3: '#ff544d'  // Red
  };

  // --- DOM Element References ---
  const gameBoard = document.getElementById('game-board');
  const logoContainer = document.getElementById('logo-container');
  const gameContainer = document.getElementById('game-container');
  const templateNavToggle = document.getElementById('templateNavToggle');
  const templateMenu = document.getElementById('templateMenu');
  const templateMenuClose = document.getElementById('templateMenuClose');
  const templateSelect = document.getElementById('templateSelect');
  const loadTemplateBtn = document.getElementById('loadTemplateBtn');
  const loadingSpinner = document.getElementById('loadingSpinner');
  

  // --- Global State Variables ---
  let pathCells = []; // Array of cell data objects for the current map path
  let currentTemplateId = null; // ID of the currently loaded template
  let currentLogoUrl = '';      // URL of the current logo
  let currentBgColor = '#fff0f5'; // Default/current background color
  let currentPlayers = [];    // Array of player config objects { player_number, name, avatar_url }

  let selectedPlayer = 1;     // Which player is currently visually selected (often matches server's activePlayer)
  let isMoving = false;       // Flag to prevent concurrent movements
  let highlightedCell = null; // Index or position of the cell to highlight (usually destination)
  let playerPathIndices = [0, 0, 0]; // Index in the pathCells array for each player (P1, P2, P3)
  let playerTokenContainers = []; // References to the DOM elements containing player tokens and names

  let ws = null; // WebSocket instance
  let roomId = null; // Room ID obtained from URL

  // ================================================
  //          Status UI Functions
  // ================================================

  function updateGameStatusUI(message, isError = false) {
      if (logoContainer) {
          const statusTextElement = logoContainer.querySelector('#game-status-text') || document.createElement('div');
          statusTextElement.id = 'game-status-text';
          statusTextElement.style.fontSize = '1.5rem';
          statusTextElement.style.textAlign = 'center';
          statusTextElement.style.padding = '20px';
          statusTextElement.textContent = message;
          statusTextElement.style.color = isError ? '#cc0000' : '#555';

          logoContainer.innerHTML = ''; // Clear previous content (like old logo)
          logoContainer.appendChild(statusTextElement);
          logoContainer.classList.remove('hidden'); // Ensure container is visible

          // Dim the board slightly when showing status
          if (gameBoard) gameBoard.style.opacity = message ? '0.7' : '1';

      } else {
          console.warn("logo-container not found, cannot display status.");
      }
  }

  function clearGameStatusUI() {
      if (logoContainer) {
           // Restore the logo or default content if applicable
           // This will be handled by renderBoard which redraws the logo
      }
       if (gameBoard) gameBoard.style.opacity = '1'; // Restore opacity
       // The actual clearing happens in renderBoard when it redraws the logo/cells
  }


  // ================================================
  //          Template Loading Functions
  // ================================================

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
              // Select the current one if it exists, otherwise select the first
              if (currentTemplateId && templates.some(t => t.id == currentTemplateId)) {
                  templateSelect.value = currentTemplateId;
              } else if (templates.length > 0 && !templateSelect.value) {
                   // Only select first if nothing is loaded and list is not empty
                   templateSelect.value = templates[0].id;
              }
          }
      } catch (error) {
          console.error("Error fetching template list:", error);
          templateSelect.innerHTML = '<option value="">載入列表失敗</option>';
          loadTemplateBtn.disabled = true;
      }
  }

  async function loadTemplate(templateId) {
      if (!templateId || isNaN(parseInt(templateId))) {
           console.error("Invalid templateId provided:", templateId);
           updateGameStatusUI("無效的地圖 ID", true);
           return; // Stop loading if ID is invalid
       }
       templateId = parseInt(templateId);
       console.log(`Loading template ID: ${templateId}`);
       loadTemplateBtn.disabled = true;
       if (loadingSpinner) loadingSpinner.style.display = 'inline-block';
       updateGameStatusUI("正在載入地圖數據..."); // Show loading status

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
           currentBgColor = data.background_color || '#fff0f5';
           pathCells = data.cells || []; // Ensure pathCells is always an array
           currentLogoUrl = data.logo_url || '';
           currentPlayers = data.players || []; // Ensure players is always an array

           // Validate loaded data
           if (!Array.isArray(pathCells)) {
               console.error("Loaded template data cells is not an array:", data.cells);
               pathCells = []; // Reset to empty array on invalid data
               throw new Error("地圖格子數據格式錯誤。");
           }

           // --- Apply updates (Defer state application until after render) ---
           applyTemplateBackgroundColor(currentBgColor);
           initPlayerPositions(); // Reset positions for the new map
           highlightedCell = null; // Clear highlight
           isMoving = false;     // Reset moving state

           // Render the board using the new data
           renderBoard();

           closeTemplateMenu(); // Close menu after successful load attempt

           // Select the loaded template in the dropdown
           if (templateSelect) templateSelect.value = currentTemplateId;

           // Do NOT send game state here. State update will happen via updateLocalGameState
           // which is called after receiving state from server AFTER template load completes.
           // sendGameStateToControllers(); // Removed from here

       } catch (error) {
           console.error(`Error loading template ${templateId}:`, error);
           updateGameStatusUI(`載入地圖 ${templateId} 失敗: ${error.message}`, true);
           // Reset state variables on failure
           pathCells = [];
           currentTemplateId = null;
           currentLogoUrl = '';
           currentPlayers = [];
           applyTemplateBackgroundColor('#e0e0e0'); // Grey background
           if(gameBoard) gameBoard.innerHTML = ''; // Clear the board content on error
           // The status UI will show the error message
           loadTemplateBtn.disabled = false; // Re-enable button on failure
       } finally {
           if (loadingSpinner) loadingSpinner.style.display = 'none'; // Hide spinner regardless of outcome
       }
  }

  function applyTemplateBackgroundColor(color) {
      if (gameContainer) {
          gameContainer.style.backgroundColor = color || '#fff0f5';
      } else {
          console.error("Game container element not found for background color.");
      }
  }

  // ================================================
  //          Board Rendering Functions
  // ================================================

  function renderBoard() {
      if (!gameBoard || !logoContainer) {
           console.error("Required board or logo container elements not found!");
           updateGameStatusUI("遊戲板渲染錯誤", true);
           return;
       }
       gameBoard.innerHTML = ''; // Clear previous board content
       logoContainer.innerHTML = ''; // Clear logo container
       logoContainer.classList.remove('hidden'); // Ensure logo container exists conceptually

       // Render Logo or Initial/Loading State
       if (currentLogoUrl) {
           const img = document.createElement('img');
           img.src = currentLogoUrl;
           img.alt = "遊戲 Logo";
           img.className = 'game-logo-image';
            img.onerror = () => {
                console.warn("Logo image failed to load:", currentLogoUrl);
                logoContainer.innerHTML = `<div class="logo-text" style="font-size: 2rem; color: #cc0000;">Logo載入失敗</div>`;
            };
           logoContainer.appendChild(img);
       } else {
           // If status message is not active, show default text
           if (!logoContainer.querySelector('#game-status-text')) {
                logoContainer.innerHTML = `<div class="logo-text">大富翁</div><div class="logo-subtitle">等待遊戲開始</div>`;
           }
       }
       gameBoard.appendChild(logoContainer);

       // Render the hidden info panel structure
       const panel = document.createElement('div');
       panel.id = 'center-info';
       panel.className = 'center-info hidden';
       panel.innerHTML = `<div class="close-btn" onclick="document.getElementById('center-info').classList.add('hidden'); document.getElementById('logo-container').classList.remove('hidden')">×</div><div id="center-title" class="center-title"></div><div id="center-description" class="center-description"></div>`;
       gameBoard.appendChild(panel);

       // Render Cells
       if (!Array.isArray(pathCells) || pathCells.length === 0) {
            console.warn("No path cells to render.");
            // Keep the logo/status visible if no cells
            return; // Don't try to render cells or players
        }

       pathCells.forEach((cell, index) => {
           const div = document.createElement('div');
           const cellIdentifier = (cell.position !== undefined && !isNaN(parseInt(cell.position))) ? parseInt(cell.position) : index;
           div.className = `cell cell-pos-${cellIdentifier}`;
           div.dataset.index = cellIdentifier;

           const x = Number(cell.x);
           const y = Number(cell.y);

           if (isNaN(x) || isNaN(y)) {
                console.warn(`Invalid coordinates for cell at index ${index}:`, cell);
                return;
            }

           div.style.position = 'absolute';
           div.style.left = `${x * cellWidth}px`;
           div.style.top = `${y * cellHeight}px`;
           div.style.backgroundColor = cell.color || '#cccccc';

           // Apply highlight if needed
           if (cellIdentifier === highlightedCell) {
                div.classList.add('highlighted');
           }

            // Cell Content
            let contentHTML = '';
            if (cell.image_url) {
                contentHTML += `<img src="${cell.image_url}" alt="${cell.title || ''}" style="max-width:80%; max-height:50%; object-fit:contain; margin-bottom:4px;" onerror="this.style.display='none'; console.warn('Cell image failed: ${cell.image_url}')">`;
            }
            contentHTML += `<div class="cell-title">${cell.title || ''}</div>`;

           div.innerHTML = `<div class="cell-content">${contentHTML}</div>`;
           div.addEventListener('click', () => showCellInfo(cellIdentifier));
           gameBoard.appendChild(div);
       });

       updatePlayerPositions(); // Render players based on the newly rendered map
  }

  function updatePlayerPositions() {
      // Remove previous player tokens+containers
      playerTokenContainers.forEach(container => container.remove());
      playerTokenContainers = []; // Clear the array

      if (!gameBoard || !Array.isArray(pathCells) || pathCells.length === 0) {
          // console.warn("Cannot update player positions: Board or path cells not ready.");
          return; // Do nothing if map isn't ready
      }

      playerPathIndices.forEach((pathIndex, playerArrayIndex) => {
          const safePathIndex = (pathIndex >= 0 && pathIndex < pathCells.length) ? pathIndex : 0;
          const cellData = pathCells[safePathIndex];

          if (!cellData) {
              console.warn(`Cannot find cell data for player ${playerArrayIndex + 1} at safePathIndex ${safePathIndex}`);
              return;
          }

          const playerNum = playerArrayIndex + 1;
          const playerConfig = currentPlayers.find(p => p.player_number === playerNum) || {};

          // Create container
          const container = document.createElement('div');
          container.className = 'player-token-container';
           // Apply selected class if this player is selected
           container.classList.toggle('selected', playerNum === selectedPlayer);

          // Create token (avatar or colored div)
          const token = document.createElement('div');
          token.className = `player-token player${playerNum}-token`; // General and specific player class

          const playerName = playerConfig.name || `P${playerNum}`;
          const avatarUrl = (playerConfig.avatar_url || '').trim();

          if (avatarUrl) {
              token.style.backgroundColor = 'transparent'; // Use transparent background for images
              token.innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="${playerName} Avatar" onerror="this.parentElement.style.backgroundColor='${bgColors[playerNum]}'; this.parentElement.textContent='${playerName.charAt(0) || 'P'}'; this.remove(); console.warn('Avatar failed: ${avatarUrl}')">`;
          } else {
              token.textContent = playerName.charAt(0) || 'P'; // Fallback to first letter or 'P'
              token.style.backgroundColor = bgColors[playerNum];
              token.style.color = 'white';
              token.style.fontSize = '14px';
              token.style.fontWeight = 'bold';
              token.style.textShadow = '1px 1px 1px rgba(0,0,0,0.4)';
          }
           // Apply common token styles (important for consistency)
          Object.assign(token.style, {
              width: '40px', height: '40px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
              border: '2px solid white', zIndex: '11' // Ensure token is above container bg if needed
          });


          // Create name label
          const nameLabel = document.createElement('div');
          nameLabel.className = 'player-name-label';
          nameLabel.textContent = playerName;
          Object.assign(nameLabel.style, {
               backgroundColor: bgColors[playerNum], color: 'white', padding: '2px 6px',
               borderRadius: '10px', fontSize: '10px', fontWeight: 'bold',
               marginTop: '3px', whiteSpace: 'nowrap', maxWidth: '70px',
               overflow: 'hidden', textOverflow: 'ellipsis',
               boxShadow: '0 1px 3px rgba(0,0,0,0.3)', textShadow: '0px 1px 1px rgba(0,0,0,0.2)'
           });


          // Positioning Logic
          const x = Number(cellData.x);
          const y = Number(cellData.y);

          if (isNaN(x) || isNaN(y)) {
              console.warn(`Invalid coordinates for player ${playerNum}:`, cellData);
              return;
          }

          // Offset multiple players within the same cell
          const angle = (2 * Math.PI / 3) * playerArrayIndex;
          const radius = 15;
          const offsetX = Math.cos(angle) * radius;
          const offsetY = Math.sin(angle) * radius;

          Object.assign(container.style, {
               position: 'absolute', zIndex: '15', // Container z-index
               display: 'flex', flexDirection: 'column', alignItems: 'center',
               left: `${x * cellWidth + cellWidth / 2 + offsetX}px`,
               top: `${y * cellHeight + cellHeight / 2 + offsetY}px`,
               transform: 'translate(-50%, -50%)',
               transition: `left ${MOVEMENT_TRANSITION_TIME} ease-out, top ${MOVEMENT_TRANSITION_TIME} ease-out`
           });

          container.appendChild(token);
          container.appendChild(nameLabel);
          gameBoard.appendChild(container);
          playerTokenContainers[playerArrayIndex] = container; // Store reference using playerArrayIndex
      });
  }

  function updateSelectedPlayerVisuals(playerNumber) {
       if (!Array.isArray(playerTokenContainers)) return;
       playerTokenContainers.forEach((container, index) => {
           if (container) {
               container.classList.toggle('selected', index + 1 === playerNumber);
           }
       });
   }

  function showCellInfo(cellPos) {
      const panel = document.getElementById('center-info');
      const cell = pathCells.find(c => c.position == cellPos) || pathCells[cellPos]; // Find by position or index fallback

      if (panel && cell) {
          document.getElementById('center-title').textContent = cell.title || '無標題';
          document.getElementById('center-description').textContent = cell.description || '無描述';
          panel.style.backgroundColor = cell.color || '#dddddd';
          panel.classList.remove('hidden');
          if (logoContainer) logoContainer.classList.add('hidden');
      } else {
          console.warn(`Could not find cell data for position/index: ${cellPos}`);
          hidePlayerInfo(); // Hide panel if cell data not found
      }
  }

  function hidePlayerInfo() {
      const panel = document.getElementById('center-info');
      if (panel) panel.classList.add('hidden');
      if (logoContainer) logoContainer.classList.remove('hidden');
  }

  // ================================================
  //          Game Logic Functions
  // ================================================

   function initPlayerPositions() {
      playerPathIndices = [0, 0, 0];
      console.log("Player positions initialized to:", playerPathIndices);
  }

  function handleDirectionSelection(isForward, steps, player) {
    if (isMoving || player < 1 || player > 3) return;
    if (!Array.isArray(pathCells) || pathCells.length === 0) {
      console.warn("Cannot move: Map data (pathCells) is not loaded or empty.");
      return;
    }

    isMoving = true;
    highlightedCell = null; // Clear previous highlight
    // Clear highlight class from all cells first
    document.querySelectorAll('.cell.highlighted').forEach(c => c.classList.remove('highlighted'));

    let currentPathIndex = playerPathIndices[player - 1];
    if (currentPathIndex < 0 || currentPathIndex >= pathCells.length) {
      console.warn(`Player ${player} has invalid starting index ${currentPathIndex}, resetting to 0.`);
      currentPathIndex = 0;
      playerPathIndices[player - 1] = 0;
    }

    let targetIndex = currentPathIndex;
    let stepsRemaining = steps;

    // Add moving visual effect
    const playerContainer = playerTokenContainers[player - 1];
    if (playerContainer) {
      playerContainer.classList.add('moving');
    }

    function moveStep() {
      if (stepsRemaining <= 0) {
        finishMoving(targetIndex, player);
        return;
      }

      const nextIndex = isForward
        ? (currentPathIndex + 1) % pathCells.length
        : (currentPathIndex - 1 + pathCells.length) % pathCells.length;

      playerPathIndices[player - 1] = nextIndex;
      targetIndex = nextIndex;
      currentPathIndex = nextIndex;

      // Update visual position
      updatePlayerPositions();

      stepsRemaining--;

      setTimeout(moveStep, STEP_ANIMATION_DELAY);
    }

    sendGameStateToControllers(); // Notify controllers movement started
    moveStep();
  }

  function finishMoving(finalIndex, player) {
    console.log(`Player ${player} finished moving at index: ${finalIndex}`);
    isMoving = false;
    highlightedCell = finalIndex;

    // Remove moving class, add arrival bounce effect
    const playerContainer = playerTokenContainers[player - 1];
    if (playerContainer) {
      playerContainer.classList.remove('moving');
      playerContainer.classList.add('arrived');
      setTimeout(() => {
        if(playerContainer) playerContainer.classList.remove('arrived');
      }, 500); // Duration of the bounce animation
    }

    // Apply highlight to the destination cell
    const targetCellElement = gameBoard.querySelector(`.cell[data-index="${finalIndex}"]`);
    if (targetCellElement) {
      document.querySelectorAll('.cell.highlighted').forEach(c => c.classList.remove('highlighted'));
      targetCellElement.classList.add('highlighted');
    } else {
      console.warn(`Could not find target cell element to highlight: Index ${finalIndex}`);
    }

    // Final position update might be needed if animation timings are complex
    updatePlayerPositions();

    sendGameStateToControllers(); // Send final state
  }


  // ================================================
  //          WebSocket Functions
  // ================================================

   function connectWebSocket() {
      if (ws && ws.readyState === WebSocket.OPEN) return;

      const urlParams = new URLSearchParams(window.location.search);
      roomId = urlParams.get('roomId');

      if (!roomId) {
          console.error("No roomId found in URL!");
          updateGameStatusUI("錯誤：缺少房間 ID！", true);
          return;
      }

      const wsFullUrl = `wss://${window.location.host}?clientType=game&roomId=${roomId}`;
      console.log(`[WS] Attempting to connect game client to: ${wsFullUrl}`);
      updateGameStatusUI("正在連接到房間...");
      ws = new WebSocket(wsFullUrl);

      ws.onopen = () => {
          console.log(`[WS] Game WebSocket Connected to room ${roomId}`);
          updateGameStatusUI("等待遊戲狀態...");
          // Server should push initial state upon connection
      };

      ws.onmessage = ({ data }) => {
          try {
              const msg = JSON.parse(data);
              console.log("[WS] Game client received message:", msg);

              if (msg.type === 'gameStateUpdate') {
                  const serverTemplateId = msg.data.currentTemplateId ? parseInt(msg.data.currentTemplateId) : null;
                  const localTemplateId = currentTemplateId ? parseInt(currentTemplateId) : null;

                  // If template ID exists and is different, load it first
                  if (serverTemplateId && serverTemplateId !== localTemplateId) {
                      console.log(`[WS] Received state with new template ID ${serverTemplateId}. Loading template...`);
                      updateGameStatusUI("正在載入地圖...");
                      // Use await here IF updateLocalGameState must wait for loadTemplate
                      // BUT careful about blocking further messages. A promise chain is safer.
                       loadTemplate(serverTemplateId).then(() => {
                            console.log("[WS] Template loaded, applying received game state.");
                            updateLocalGameState(msg.data); // Apply the full state AFTER loading
                       }).catch(err => {
                            console.error("Failed to load template after receiving state update:", err);
                            updateGameStatusUI("地圖載入失敗!", true);
                       });
                  }
                  // If template ID exists and is the same, OR if template ID is null/missing (use current/default)
                  else if (serverTemplateId === localTemplateId || !serverTemplateId){
                       // Check if serverTemplateId is missing and we haven't loaded anything
                       if(!serverTemplateId && !localTemplateId) {
                           console.error("Server did not provide template ID, and none is loaded locally.");
                           updateGameStatusUI("錯誤：伺服器未提供地圖信息", true);
                           // Optionally clear board or show error state
                           if(gameBoard) gameBoard.innerHTML = `<p style="color:red; text-align:center; padding-top: 50px;">錯誤：無法獲取地圖信息</p>`;
                           applyTemplateBackgroundColor('#e0e0e0');
                       } else {
                           // Template is correct or server didn't specify one (use existing)
                           updateLocalGameState(msg.data);
                       }
                  }
              } else if (msg.type === 'controlCommand') {
                  handleControlCommand(msg.command, msg.params);
              } else {
                  console.warn("[WS] Game client received unknown message type:", msg.type);
              }
          } catch (err) {
              console.error('[WS] Game client message processing error:', err, "Raw data:", data);
          }
      };

      ws.onclose = (event) => {
          console.log(`[WS] Game WebSocket Closed. Code: ${event.code}, Reason: '${event.reason}'. Reconnecting...`);
          ws = null;
          updateGameStatusUI("與伺服器斷線，嘗試重連...", true);
          setTimeout(connectWebSocket, 5000 + Math.random() * 1000); // Add jitter
      };
      ws.onerror = (error) => {
          console.error("[WS] Game WebSocket Error:", error);
          // updateGameStatusUI("WebSocket 連接錯誤", true); // Let onclose handle UI
      };
  }

  function sendGameStateToControllers() {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
           // console.warn("Cannot send game state: WebSocket not open."); // Reduce log noise
           return;
       }
       // Prepare player data { player_number: { avatarUrl, name } }
       const playersDataForState = {};
       for (let i = 1; i <= 3; i++) {
           const config = currentPlayers.find(p => p.player_number === i) || {};
           playersDataForState[i] = {
               avatarUrl: config.avatar_url || null,
               name: config.name || `P${i}`
           };
       }


      const gameState = {
           type: 'gameStateUpdate',
           data: {
               currentTemplateId: currentTemplateId,
               currentBgColor: currentBgColor, // Send background color too
               selectedPlayer: selectedPlayer, // Send visually selected player (might differ from active player during moves)
               playerPositions: playerPathIndices, // Use correct variable name
               highlightedCell: highlightedCell,
               isMoving: isMoving,
               players: playersDataForState // Send structured player data
           }
       };
       try {
           // console.log("Sending game state:", gameState); // Debug log if needed
           ws.send(JSON.stringify(gameState));
       } catch (e) {
           console.error("Error sending game state:", e);
       }
  }

  // --- Central State Update Function ---
  function updateLocalGameState(serverState) {
      console.log("[State Update] Applying server state:", serverState);
      let needsRender = false;

      // Update Template Info if changed (though loadTemplate should handle the primary load)
      const serverTemplateId = serverState.currentTemplateId ? parseInt(serverState.currentTemplateId) : null;
      if (serverTemplateId && serverTemplateId !== currentTemplateId) {
          console.warn("State update received template ID, but loadTemplate should handle the change. Applying state anyway.");
          // It's better if loadTemplate handles this change fully.
          // If loadTemplate was successful, currentTemplateId should already match.
      }
      // Update Background Color if needed
      if (serverState.currentBgColor && serverState.currentBgColor !== currentBgColor) {
           currentBgColor = serverState.currentBgColor;
           applyTemplateBackgroundColor(currentBgColor);
       }

      // Update Player Config if changed
      if (serverState.players && JSON.stringify(serverState.players) !== JSON.stringify(currentPlayers.reduce((acc, p) => { acc[p.player_number] = p; return acc; }, {}))) {
           // Convert serverState.players (object keyed by number) to array expected by currentPlayers
           currentPlayers = Object.entries(serverState.players).map(([num, data]) => ({
              player_number: parseInt(num),
              name: data.name,
              avatar_url: data.avatarUrl
           }));
           needsRender = true; // Need to re-render player tokens with new names/avatars
           console.log("[State Update] Player config updated:", currentPlayers);
      }

      // Update Game State Variables
      selectedPlayer = serverState.selectedPlayer || 1;
      playerPathIndices = serverState.playerPositions || [0, 0, 0];
      isMoving = serverState.isMoving || false;
      highlightedCell = serverState.highlightedCell !== undefined ? serverState.highlightedCell : null;

      // Determine if a full re-render is needed (positions changed significantly)
      // Simple approach: always re-render positions if state updates
      needsRender = true;

      // Perform UI Updates
      if (needsRender) {
           renderBoard(); // Re-renders cells and player positions based on updated state
      } else {
           // If only selection or highlight changed, update those specifically
           updateSelectedPlayerVisuals(selectedPlayer);
           // Update highlight separately if needed
           document.querySelectorAll('.cell.highlighted').forEach(c => c.classList.remove('highlighted'));
           if (highlightedCell !== null) {
              const targetCellElement = gameBoard.querySelector(`.cell[data-index="${highlightedCell}"]`);
              if (targetCellElement) targetCellElement.classList.add('highlighted');
           }
      }

      // Clear status UI after successful state update
      clearGameStatusUI();

      console.log("[State Update] Local state updated:", { currentTemplateId, selectedPlayer, playerPathIndices, isMoving, highlightedCell });
  }

  // --- Handle Commands from Controller ---
  function handleControlCommand(cmd, params) {
      const player = params ? parseInt(params.player) : null;
      if (cmd === 'selectPlayer' || cmd === 'movePlayer' || cmd === 'showPlayerInfo') {
          if (!player || player < 1 || player > 3) {
              console.warn(`[Game Client] Received command ${cmd} with invalid player number:`, params);
              return;
          }
      }

      console.log(`[Game Client] Received command: ${cmd}`, params);

      switch (cmd) {
          case 'selectPlayer':
              selectedPlayer = player;
              updateSelectedPlayerVisuals(selectedPlayer);
              // Send state update back to sync controllers
              sendGameStateToControllers();
              break;
          case 'movePlayer':
              if (!isMoving) {
                  const steps = parseInt(params.steps) || 1;
                  handleDirectionSelection(params.direction === 'forward', steps, player);
              } else {
                  console.warn("[Game Client] Ignoring move command: Already moving.");
              }
              break;
          case 'showPlayerInfo':
              const playerIndexToShow = player - 1;
              if (playerIndexToShow >= 0 && playerIndexToShow < playerPathIndices.length) {
                  const cellIndexOfPlayer = playerPathIndices[playerIndexToShow];
                  const cellData = pathCells[cellIndexOfPlayer];
                  if (cellData) {
                      const cellIdentifier = cellData.position !== undefined ? cellData.position : cellIndexOfPlayer;
                      showCellInfo(cellIdentifier);
                  } else {
                      console.warn(`[Game Client] Cannot find cell data for player ${player} at index ${cellIndexOfPlayer}`);
                      hidePlayerInfo();
                  }
              } else {
                  console.warn(`[Game Client] Invalid player index ${playerIndexToShow} for showPlayerInfo`);
                  hidePlayerInfo();
              }
              break;
          case 'hidePlayerInfo':
              hidePlayerInfo();
              break;
          case 'getGameState': // Server should handle this for controllers
               console.log("[Game Client] Received getGameState (logging only, sending current state back)");
               sendGameStateToControllers(); // Send current state back to server->controllers
               break;
          default:
              console.warn("[Game Client] Unknown control command received:", cmd);
      }
  }

  // ================================================
  //          Menu Functions
  // ================================================

  function toggleTemplateMenu() {
      if (templateMenu) templateMenu.classList.toggle('visible');
  }
  function closeTemplateMenu() {
      if (templateMenu) templateMenu.classList.remove('visible');
  }

  // ================================================
  //          Event Listeners
  // ================================================

  if (templateNavToggle) templateNavToggle.addEventListener('click', toggleTemplateMenu);
  if (templateMenuClose) templateMenuClose.addEventListener('click', closeTemplateMenu);

  if (loadTemplateBtn && templateSelect) {
      loadTemplateBtn.addEventListener('click', () => {
          const selectedId = templateSelect.value;
          if (selectedId) {
               // --- ★★★ Send command to server to change template ★★★ ---
               console.log(`Requesting template change to ID: ${selectedId}`);
               if (ws && ws.readyState === WebSocket.OPEN) {
                   ws.send(JSON.stringify({
                       type: 'controlCommand',
                       command: 'changeTemplate',
                       params: { templateId: selectedId },
                       roomId: roomId
                   }));
                   // The actual template loading will happen when the server
                   // pushes back a gameStateUpdate with the new templateId.
                   closeTemplateMenu(); // Close menu after sending request
               } else {
                   alert("無法變更模板：未連接到伺服器。");
               }
              // loadTemplate(selectedId); // <<< REMOVE direct loading call here
          } else {
              alert("請先選擇一個模板！");
          }
      });
  }

  // Listener to close menu when clicking outside
  if (gameContainer) {
      gameContainer.addEventListener('click', (event) => {
          if (templateMenu && templateMenu.classList.contains('visible')) {
              const isClickInsideMenu = templateMenu.contains(event.target);
              const isClickOnToggleButton = templateNavToggle && templateNavToggle.contains(event.target);
              if (!isClickInsideMenu && !isClickOnToggleButton) {
                  closeTemplateMenu();
              }
          }
      });
  }

  // ================================================
  //          Initialization
  // ================================================

  async function initializeGame() {
      console.log("Initializing game...");
      applyTemplateBackgroundColor(currentBgColor); // Apply default bg
      updateGameStatusUI("正在初始化..."); // Initial status

      // Fetch template list for the dropdown first
      await fetchTemplateList();

      // Now connect WebSocket. Initial state push will trigger template load.
      connectWebSocket();
  }

  initializeGame(); // Start the game

}); // End DOMContentLoaded