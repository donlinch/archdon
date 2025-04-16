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
  let playerTokens = [];
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
      // Remove previous player tokens
      document.querySelectorAll('.player-token').forEach(el => el.remove());
      playerTokens = []; // Clear the array

      if (!gameBoard || !Array.isArray(pathCells) || pathCells.length === 0) {
          console.warn("Cannot update player positions: Board or pathCells not ready.");
          return; // Don't render players if map isn't ready
      }

      playerPathIndices.forEach((pathIndex, playerArrayIndex) => {
          // Ensure pathIndex is valid for the current pathCells length
          const safePathIndex = (pathIndex >= 0 && pathIndex < pathCells.length) ? pathIndex : 0;
          // Find the cell data corresponding to the player's current position index in pathCells
          const cellData = pathCells[safePathIndex]; // Get cell data by array index

          if (!cellData) {
               console.warn(`Cannot find cell data for player ${playerArrayIndex + 1} at safePathIndex ${safePathIndex}`);
               return; // Skip this player if cell data is missing for their position
           }

          const playerNum = playerArrayIndex + 1;
          // Get player config from loaded template data (currentPlayers)
          const playerConfig = currentPlayers.find(p => p.player_number === playerNum) || {};

          const token = document.createElement('div');
          token.className = `player-token player${playerNum}-token`; // Apply general and specific player class
          // Apply common styles directly
          token.style.position = 'absolute';
          token.style.width = '40px';
          token.style.height = '40px';
          token.style.borderRadius = '50%'; // Ensure it's circular
          token.style.display = 'flex';
          token.style.alignItems = 'center';
          token.style.justifyContent = 'center';
          token.style.overflow = 'hidden'; // Hide overflowing parts of image/text
          token.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
          token.style.border = '2px solid white';
          token.style.transform = 'translate(-50%, -50%)'; // Center on position
          token.style.zIndex = '10';
          token.style.transition = 'left 0.3s ease-in-out, top 0.3s ease-in-out'; // Smooth movement

          // Use avatar from loaded config or fallback
          if (playerConfig.avatar_url) {
               token.style.backgroundColor = 'transparent'; // Make background transparent if image is used
               token.innerHTML = `<img src="${playerConfig.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="P${playerNum} Avatar" onerror="this.parentElement.style.backgroundColor='${bgColors[playerNum]}'; this.remove(); console.warn('Avatar failed: ${playerConfig.avatar_url}')">`;
          } else {
              // Fallback to text (name or P#) and background color
              token.textContent = playerConfig.name || `P${playerNum}`;
              token.style.backgroundColor = bgColors[playerNum];
              token.style.fontSize = '14px';
              token.style.fontWeight = 'bold';
              token.style.color = 'white';
              token.style.textShadow = '1px 1px 1px rgba(0,0,0,0.4)';
          }

          // --- Positioning Logic ---
          const x = Number(cellData.x); // Position based on the cell data (x, y grid)
          const y = Number(cellData.y);
           if (isNaN(x) || isNaN(y)) {
               console.warn(`Invalid coordinates for player ${playerNum}'s cell data:`, cellData);
               return; // Skip positioning if coordinates invalid
           }

          // Multi-player offset logic
          const angle = (2 * Math.PI / 3) * playerArrayIndex; // Distribute 3 players
          const radius = 15; // How far from center
          const offsetX = Math.cos(angle) * radius;
          const offsetY = Math.sin(angle) * radius;
          // Position relative to the center of the cell
          token.style.left = `${x * cellWidth + cellWidth / 2 + offsetX}px`;
          token.style.top = `${y * cellHeight + cellHeight / 2 + offsetY}px`;
          // --- End Positioning Logic ---

          gameBoard.appendChild(token);
          playerTokens.push(token);
      });
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
      console.log(`Movement finished at index: ${finalIndex}`);
      isMoving = false;
      highlightedCell = finalIndex; // Set the final cell as highlighted

      // Apply highlight class to the target cell
      const targetCellElement = gameBoard.querySelector(`.cell[data-index="${finalIndex}"]`);
      if (targetCellElement) {
           // Clear existing highlights first to be safe
           document.querySelectorAll('.cell.highlighted').forEach(c => c.classList.remove('highlighted'));
           targetCellElement.classList.add('highlighted');
      } else {
           console.warn(`Target cell element not found for highlight: index ${finalIndex}`);
       }

      // Ensure player position is exactly correct (updatePlayerPositions might have slight async delay visual)
      updatePlayerPositions();

      sendGameStateToControllers(); // Send final state update
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
    // Basic validation
    const player = params ? parseInt(params.player) : null;
    if (cmd === 'selectPlayer' || cmd === 'movePlayer' || cmd === 'showPlayerInfo') {
        if (!player || player < 1 || player > 3) {
             console.warn(`Invalid player number received for command ${cmd}:`, params);
             return;
         }
    }

    switch (cmd) {
      case 'selectPlayer':
        selectedPlayer = player;
        console.log("Player selected via controller:", selectedPlayer);
        sendGameStateToControllers(); // Notify other controllers
        // Maybe add a visual cue on the game board? (e.g., subtle highlight around token)
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