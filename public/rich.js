// ✅ rich.js (支援模組化格子資料 + 玩家頭像 + 模板選擇器 + 地圖玩家名稱顯示)
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

    // --- Global State Variables ---
    let pathCells = []; // Will be populated by loaded template
    let currentTemplateId = null; // Track the currently loaded template ID
    let currentLogoUrl = ''; // Track current logo
    let currentBgColor = '#fff0f5'; // Default/current background
    let currentPlayers = []; // Store loaded player data from template

    // --- Game State Variables ---
    let selectedPlayer = 1; // Which player is currently selected/active (from controller)
    let isMoving = false;   // Is any player token currently animating?
    let highlightedCell = null; // Which cell index/position is highlighted (usually the last moved to)
    let playerPathIndices = [0, 0, 0]; // Index in the pathCells array for each player (P1, P2, P3)
    const STEP_ANIMATION_DELAY = 300; // Milliseconds between steps in multi-step move
    // `playerTokens` might be less useful now we have containers, but kept for potential future use
    let playerTokens = [];
    const bgColors = { // Player token background color fallback if no avatar
      1: '#5b9df0', // Blue
      2: '#9270ca', // Purple
      3: '#ff544d'  // Red
    };
    let ws = null; // WebSocket connection object
    const wsUrl = `wss://${window.location.host}?clientType=game`; // WebSocket URL
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
        if(loadTemplateBtn) loadTemplateBtn.disabled = true;
        if (loadingSpinner) loadingSpinner.style.display = 'inline-block';

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
            pathCells = data.cells || [];
            currentLogoUrl = data.logo_url || '';
            // Ensure player data has player_number, even if minimal
             currentPlayers = (data.players || []).map((p, index) => ({
                 player_number: p.player_number || (index + 1),
                 name: p.name || null,
                 avatar_url: p.avatar_url || null
             }));
             // Ensure we always have data structure for players 1, 2, 3
             for (let i = 1; i <= 3; i++) {
                 if (!currentPlayers.some(p => p.player_number === i)) {
                     currentPlayers.push({ player_number: i, name: null, avatar_url: null });
                 }
             }
             currentPlayers.sort((a, b) => a.player_number - b.player_number); // Ensure correct order
            // --- End Update Global State ---

            applyTemplateBackgroundColor(currentBgColor);
            initPlayerPositions(); // Reset positions to start
            highlightedCell = null; // Clear highlight
            isMoving = false; // Reset moving state
            renderBoard(); // Render the new map
            sendGameStateToControllers(); // Inform controllers
            closeTemplateMenu();

            if (templateSelect) templateSelect.value = currentTemplateId; // Update dropdown selection

        } catch (error) {
            console.error(`Error loading template ${templateId}:`, error);
            alert(`載入模板失敗 (ID: ${templateId}):\n${error.message}`);
             if(gameBoard) gameBoard.innerHTML = `<p style="color:red; text-align:center; padding-top: 50px;">載入地圖失敗 (ID: ${templateId})</p>`;
             pathCells = [];
             currentTemplateId = null;
             currentPlayers = [];
             applyTemplateBackgroundColor('#e0e0e0');
        } finally {
            if(loadTemplateBtn) loadTemplateBtn.disabled = false;
            if (loadingSpinner) loadingSpinner.style.display = 'none';
        }
    }

     // --- Apply Background Color ---
     function applyTemplateBackgroundColor(color) {
        if (gameContainer) {
            gameContainer.style.backgroundColor = color || '#fff0f5';
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
        gameBoard.innerHTML = '';
        logoContainer.innerHTML = '';
        logoContainer.classList.remove('hidden');

        // Render Logo
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
            logoContainer.innerHTML = `<div class="logo-text">大富翁</div><div class="logo-subtitle">選擇模板開始遊戲</div>`;
        }
        gameBoard.appendChild(logoContainer);

        // Render Info Panel Structure
        const panel = document.createElement('div');
        panel.id = 'center-info';
        panel.className = 'center-info hidden';
        panel.innerHTML = `<div class="close-btn" onclick="this.parentElement.classList.add('hidden'); document.getElementById('logo-container').classList.remove('hidden')">×</div><div id="center-title" class="center-title"></div><div id="center-description" class="center-description"></div>`;
        gameBoard.appendChild(panel);

        // Render Cells
        if (!Array.isArray(pathCells)) {
             console.error("pathCells is not an array!", pathCells);
             gameBoard.innerHTML += '<p style="color:red; text-align:center; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);">地圖資料錯誤</p>';
             return;
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

            if (cellIdentifier === highlightedCell) {
                 div.classList.add('highlighted');
            }

             let contentHTML = '';
             if (cell.image_url) {
                 contentHTML += `<img src="${cell.image_url}" alt="${cell.title || ''}" style="max-width:80%; max-height:50%; object-fit:contain; margin-bottom:4px;" onerror="this.style.display='none'; console.warn('Cell image failed: ${cell.image_url}')">`;
             }
             contentHTML += `<div class="cell-title">${cell.title || ''}</div>`;

            div.innerHTML = `<div class="cell-content">${contentHTML}</div>`;
            div.addEventListener('click', () => showCellInfo(cellIdentifier));
            gameBoard.appendChild(div);
        });

        updatePlayerPositions(); // Render players on the new board
    }

    // --- Show Cell Info in Center Panel ---
    function showCellInfo(cellPos) {
        const panel = document.getElementById('center-info');
        const cell = pathCells.find(c => c.position == cellPos); // Use == for potential type difference

        if (panel && cell) {
            const titleEl = document.getElementById('center-title');
            const descEl = document.getElementById('center-description');
            if(titleEl) titleEl.textContent = cell.title || '無標題';
            if(descEl) descEl.textContent = cell.description || '無描述';
            panel.style.backgroundColor = cell.color || '#dddddd'; // Use cell color
            panel.classList.remove('hidden');
            if (logoContainer) logoContainer.classList.add('hidden'); // Hide logo
        } else {
            console.warn(`Could not find cell data for position: ${cellPos}`);
             hidePlayerInfo(); // Hide panel if cell data not found
        }
    }

    // --- Update Player Positions (with names below tokens) ---
    function updatePlayerPositions() {
        document.querySelectorAll('.player-map-item').forEach(el => el.remove());
        playerTokens = []; // Clear potentially outdated references

        if (!gameBoard || !Array.isArray(pathCells) || pathCells.length === 0) {
            // console.warn("Cannot update player positions: Board or pathCells not ready."); // Reduce noise
            return;
        }

        playerPathIndices.forEach((pathIndex, playerArrayIndex) => {
            const safePathIndex = (pathIndex >= 0 && pathIndex < pathCells.length) ? pathIndex : 0;
            const cellData = pathCells[safePathIndex];

            if (!cellData) {
                 console.warn(`Cannot find cell data for player ${playerArrayIndex + 1} at safePathIndex ${safePathIndex}`);
                 return;
             }

            const playerNum = playerArrayIndex + 1;
            // Find player config ensuring player_number matches
            const playerConfig = currentPlayers.find(p => p.player_number === playerNum) || { player_number: playerNum }; // Basic fallback

            // Create the main container for token + name
            const playerContainer = document.createElement('div');
            playerContainer.className = 'player-map-item'; // Use the container class from CSS

            // Create the visual token (circle)
            const tokenVisual = document.createElement('div');
            // Apply classes for styling: general visual style + player-specific background/border
            tokenVisual.className = `player-token-visual player${playerNum}-token-visual`;

            // Set content (avatar or text fallback)
            if (playerConfig.avatar_url) {
                 tokenVisual.style.backgroundColor = 'transparent';
                 // Added alt text and onerror fallback
                 tokenVisual.innerHTML = `<img src="${playerConfig.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="P${playerNum} Avatar" onerror="this.parentElement.textContent='P${playerNum}'; this.parentElement.style.backgroundColor='${bgColors[playerNum]}'; console.warn('Avatar failed: ${playerConfig.avatar_url}')">`;
            } else {
                // Text fallback uses P# (or name if available, though less likely without avatar)
                tokenVisual.textContent = `P${playerNum}`;
                tokenVisual.style.backgroundColor = bgColors[playerNum];
                // Apply text styles directly for fallback
                tokenVisual.style.fontSize = '14px';
                tokenVisual.style.fontWeight = 'bold';
                tokenVisual.style.color = 'white';
                tokenVisual.style.textShadow = '1px 1px 1px rgba(0,0,0,0.4)';
            }

            // Create the name element
            const nameDiv = document.createElement('div');
            nameDiv.className = 'player-map-name';
            const displayName = playerConfig.name || `玩家 ${playerNum}`; // Use name from config or fallback
            nameDiv.textContent = displayName;

            // Append token and name to the container
            playerContainer.appendChild(tokenVisual);
            playerContainer.appendChild(nameDiv);

            // Positioning Logic for the container
            const x = Number(cellData.x);
            const y = Number(cellData.y);
             if (isNaN(x) || isNaN(y)) {
                 console.warn(`Invalid coordinates for player ${playerNum}'s cell data:`, cellData);
                 return;
             }

            // Multi-player offset logic
            const angle = (2 * Math.PI / 3) * playerArrayIndex; // Distribute 3 players around center
            const radius = 15; // Offset distance
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * radius;
            // Position the container based on cell center + offset
            playerContainer.style.left = `${x * cellWidth + cellWidth / 2 + offsetX}px`;
            playerContainer.style.top = `${y * cellHeight + cellHeight / 2 + offsetY}px`;

            gameBoard.appendChild(playerContainer); // Add the container to the game board
        });
    }


    // --- Hide Center Info Panel (shows logo) ---
     function hidePlayerInfo() { // Reusing this function name, it hides the center panel
        const panel = document.getElementById('center-info');
        if (panel) panel.classList.add('hidden');
        if (logoContainer) logoContainer.classList.remove('hidden'); // Ensure logo is shown
    }

    // --- Handle Player Movement Logic ---
     function handleDirectionSelection(isForward, steps, player) {
        if (isMoving || player < 1 || player > 3) return; // Prevent moves if busy or invalid player
        if (!Array.isArray(pathCells) || pathCells.length === 0) {
            console.warn("Cannot move: Map data (pathCells) is not loaded or empty.");
            return;
        }

        isMoving = true;
        highlightedCell = null; // Clear previous highlight visually and in state
        document.querySelectorAll('.cell.highlighted').forEach(c => c.classList.remove('highlighted'));

        let currentPathIndex = playerPathIndices[player - 1];
        // Validate current index
        if (currentPathIndex < 0 || currentPathIndex >= pathCells.length) {
            console.warn(`Player ${player} has invalid starting index ${currentPathIndex}, resetting to 0.`);
            currentPathIndex = 0;
            playerPathIndices[player - 1] = 0; // Correct the state
        }

        let targetIndex = currentPathIndex; // Stores the final destination index

        function moveStep() {
            // Calculate next index based on direction and wrap around
            currentPathIndex = isForward
                ? (currentPathIndex + 1) % pathCells.length
                : (currentPathIndex - 1 + pathCells.length) % pathCells.length;

            playerPathIndices[player - 1] = currentPathIndex; // Update player's state
            targetIndex = currentPathIndex; // Keep track of the final index

            updatePlayerPositions(); // Move the token visually

            steps--; // Decrement remaining steps

            if (steps > 0) {
                 setTimeout(moveStep, STEP_ANIMATION_DELAY); // Continue if more steps
             } else {
                 finishMoving(targetIndex); // Finish when steps are done
             }
        }
        sendGameStateToControllers(); // Notify controllers movement started
        moveStep(); // Start the first step
    }

    // --- Finish Movement ---
     function finishMoving(finalIndex) {
        console.log(`Movement finished at index: ${finalIndex}`);
        isMoving = false;
        highlightedCell = finalIndex; // Set the final cell as highlighted in state

        // Apply highlight class to the target cell element
        const targetCellElement = gameBoard.querySelector(`.cell[data-index="${finalIndex}"]`);
        if (targetCellElement) {
             document.querySelectorAll('.cell.highlighted').forEach(c => c.classList.remove('highlighted')); // Clear old ones first
             targetCellElement.classList.add('highlighted');
        } else {
             console.warn(`Target cell element not found for highlight: index ${finalIndex}`);
         }

        updatePlayerPositions(); // Final position update
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
        if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
            console.log("Closing existing WebSocket connection before reconnecting.");
            ws.close();
        } else {
             // console.log("No existing WebSocket connection or already closed."); // Less verbose log
         }

        ws = new WebSocket(wsUrl);
        console.log("Attempting WebSocket connection...");

        ws.onopen = () => {
             console.log("WebSocket Connected");
             if (currentTemplateId) { // Only send state if a map is actually loaded
                  console.log("Sending initial game state as map is loaded.");
                  sendGameStateToControllers();
             } else {
                  console.log("WebSocket open, but no map loaded yet. Waiting for map load.");
              }
         };

        ws.onmessage = ({ data }) => {
            try {
                 // console.log("WebSocket Message Received:", data); // Log only if debugging needed
                const msg = JSON.parse(data);
                if (msg.type === 'controlCommand') {
                     // console.log("Handling control command:", msg.command, msg.params); // Log only if debugging needed
                    handleControlCommand(msg.command, msg.params);
                } else if (msg.type === 'requestGameState') {
                    console.log("Received requestGameState from controller");
                    sendGameStateToControllers();
                }
            } catch (err) {
                console.error('WS message processing error:', err);
            }
        };
        ws.onclose = (event) => {
             console.log(`WebSocket Closed. Code: ${event.code}, Reason: ${event.reason}. Reconnecting...`);
             ws = null;
            setTimeout(connectWebSocket, 5000); // Reconnect after 5 seconds
        };
         ws.onerror = (error) => {
             console.error("WebSocket Error:", error);
             // onclose usually follows, triggering reconnect logic
         };
    }

    // --- Send Game State to Controllers ---
     function sendGameStateToControllers() {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
             return; // Don't attempt to send if not connected
         }
        // Prepare player data for the controller
        const playersForController = currentPlayers.reduce((acc, p) => {
             // Ensure player_number exists and is used as key
             if (p.player_number) {
                  acc[p.player_number] = { avatarUrl: p.avatar_url || null, name: p.name || `玩家 ${p.player_number}` };
              }
             return acc;
         }, {});
         // Ensure players 1, 2, 3 structures exist even if template had fewer/different numbers
         for (let i = 1; i <= 3; i++) {
            if (!playersForController[i]) {
                playersForController[i] = { avatarUrl: null, name: `玩家 ${i}`};
            }
         }

        const gameState = {
             type: 'gameStateUpdate',
             data: {
                 currentTemplateId: currentTemplateId, // Useful for controller context
                 selectedPlayer: selectedPlayer,
                 playerPathIndices: playerPathIndices,
                 highlightedCell: highlightedCell,
                 isMoving: isMoving,
                 players: playersForController // Send processed player data
             }
         };
         // console.log("Sending game state to controllers:", JSON.stringify(gameState)); // Debug only if needed
         ws.send(JSON.stringify(gameState));
    }

    // --- Handle Commands from Controller ---
    function handleControlCommand(cmd, params) {
      // Validate player parameter if present
      const player = params ? parseInt(params.player) : null;
      if (['selectPlayer', 'movePlayer', 'showPlayerInfo'].includes(cmd)) {
          if (!player || player < 1 || player > 3) {
               console.warn(`Invalid player number received for command ${cmd}:`, params);
               return; // Ignore command with invalid player number
           }
      }

      console.log(`Handling command: ${cmd}`, params); // Log command being handled

      switch (cmd) {
        case 'selectPlayer':
          selectedPlayer = player;
          // console.log("Player selected via controller:", selectedPlayer); // Less verbose log
          sendGameStateToControllers(); // Notify other controllers
          break;
        case 'movePlayer':
          if (!isMoving) { // Prevent stacking move commands
             handleDirectionSelection(params.direction === 'forward', +params.steps || 1, player);
          } else {
             console.warn("Ignoring move command: Already moving.");
          }
          break;
        case 'showPlayerInfo':
           const playerIndexToShow = player - 1;
           if (playerIndexToShow >= 0 && playerIndexToShow < playerPathIndices.length) {
               const cellIndexOfPlayer = playerPathIndices[playerIndexToShow];
               if (cellIndexOfPlayer >= 0 && cellIndexOfPlayer < pathCells.length) {
                   const cellToShow = pathCells[cellIndexOfPlayer];
                   // Use position if available, otherwise index
                   const cellPosIdentifier = cellToShow.position !== undefined ? cellToShow.position : cellIndexOfPlayer;
                   showCellInfo(cellPosIdentifier); // Show info for the cell the player is on
               } else {
                    console.warn(`Invalid cell index ${cellIndexOfPlayer} for player ${player}`);
                    hidePlayerInfo();
               }
           } else {
                console.warn(`Invalid player index ${playerIndexToShow} for showPlayerInfo`);
                hidePlayerInfo();
           }
           break;
        case 'hidePlayerInfo':
           hidePlayerInfo();
           break;
        case 'getGameState': // Controller requests current state
            console.log("Controller requested game state.");
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

    // --- Event Listeners ---
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
                loadTemplate(selectedId);
            } else {
                alert("請先選擇一個模板！");
            }
        });
    } else {
        console.error("Load template button or select dropdown not found!");
    }

    // --- Listener to close menu when clicking outside ---
    if (gameContainer) { // Attach to the main game container
        gameContainer.addEventListener('click', (event) => {
            if (templateMenu && templateMenu.classList.contains('visible')) {
                const isClickInsideMenu = templateMenu.contains(event.target);
                const isClickOnToggleButton = templateNavToggle && templateNavToggle.contains(event.target);

                if (!isClickInsideMenu && !isClickOnToggleButton) {
                    // console.log("Click outside menu detected, closing menu."); // Less verbose
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
        applyTemplateBackgroundColor(currentBgColor); // Apply default bg
        if(gameBoard) gameBoard.innerHTML = '<p style="text-align:center; padding-top: 50px;">正在載入地圖列表...</p>';

        await fetchTemplateList(); // Populate dropdown

        // Attempt to load the first template by default
        const defaultTemplateId = templateSelect.options.length > 0 && templateSelect.value ? templateSelect.value : null;

        if (defaultTemplateId) {
             await loadTemplate(defaultTemplateId); // Load it
        } else {
             console.warn("No default template found or list failed to load.");
             if(gameBoard) gameBoard.innerHTML = '<p style="text-align:center; padding-top: 50px; color: orange;">沒有找到預設地圖。請從選單載入一個模板。</p>';
             applyTemplateBackgroundColor('#e0e0e0'); // Grey background
             // Ensure controls know no game is loaded
             sendGameStateToControllers(); // Send empty/default state if needed
        }
        connectWebSocket(); // Connect WebSocket regardless of map load success
    }

    initializeGame(); // Start the initialization process

}); // End DOMContentLoaded