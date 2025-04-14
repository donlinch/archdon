// script.js

// --- DOMContentLoaded ---
// 確保 HTML 完全載入後再執行 JavaScript
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');

    // --- DOM 元素引用 ---
    const gameContainer = document.getElementById('game-container'); // 主要容器
    const boardElement = document.getElementById('board');
    const playersInfoElement = document.getElementById('players');
    const currentPlayerElement = document.getElementById('current-player');
    const diceDisplayElement = document.getElementById('dice-display');
    const rollDiceButton = document.getElementById('roll-dice-button');
    const logMessagesElement = document.getElementById('log-messages');

    // 彈窗相關元素
    const settingsModal = document.getElementById('settings-modal');
    const playerCountInput = document.getElementById('player-count');
    const targetLapsInput = document.getElementById('target-laps-input');
    const startGameButton = document.getElementById('start-game-button');

    const cardModal = document.getElementById('card-modal');
    const cardTypeElement = document.getElementById('card-type');
    const cardDescriptionElement = document.getElementById('card-description');
    const closeCardButton = document.getElementById('close-card-button');

    const gameOverModal = document.getElementById('game-over-modal');
    const winnerAnnouncementElement = document.getElementById('winner-announcement');
    const finalScoresElement = document.getElementById('final-scores');
    const restartGameButton = document.getElementById('restart-game-button');


    // --- 遊戲核心設定 ---
    const BOARD_SIZE = 28; // 格子總數 (外圈)
    let TARGET_LAPS = 1; // 目標圈數 (會從設定讀取)
    const PASS_GO_BONUS = 10; // 經過起點獎勵
    const INITIAL_UNITS = 50; // 初始單位
    const JAIL_TURNS_TO_SKIP = 2; // 在監獄需跳過的回合數
    const BOARD_DIMENSION = 8; // 棋盤是 8x8 的基礎 (用於計算格子位置)
    const CORNER_INDICES = { START: 0, JAIL: 7, HOSPITAL: 14, LOTTERY: 21 }; // 特殊角落索引

    // --- 棋盤格子資料 ---
    // (和之前定義的相同)
    const boardSquaresData = [
        { id: 0, name: "起點", type: 'start', effect: { units: PASS_GO_BONUS } },
        { id: 1, name: "空地", type: 'action', effect: { units: 0 } },
        { id: 2, name: "工作", type: 'action', effect: { units: 3 } },
        { id: 3, name: "機會", type: 'chance' },
        { id: 4, name: "空地", type: 'action', effect: { units: 0 } },
        { id: 5, name: "購物", type: 'action', effect: { units: -3 } },
        { id: 6, name: "命運", type: 'fate' },
        { id: 7, name: "監獄", type: 'jail' }, // 角落：監獄/探望
        { id: 8, name: "空地", type: 'action', effect: { units: 0 } },
        { id: 9, name: "工作", type: 'action', effect: { units: 3 } },
        { id: 10, name: "機會", type: 'chance' },
        { id: 11, name: "空地", type: 'action', effect: { units: 0 } },
        { id: 12, name: "購物", type: 'action', effect: { units: -3 } },
        { id: 13, name: "命運", type: 'fate' },
        { id: 14, name: "醫院", type: 'hospital', effect: { units: -5 } }, // 角落：醫院
        { id: 15, name: "空地", type: 'action', effect: { units: 0 } },
        { id: 16, name: "工作", type: 'action', effect: { units: 3 } },
        { id: 17, name: "機會", type: 'chance' },
        { id: 18, name: "空地", type: 'action', effect: { units: 0 } },
        { id: 19, name: "購物", type: 'action', effect: { units: -3 } },
        { id: 20, name: "命運", type: 'fate' },
        { id: 21, name: "抽獎站", type: 'lottery' }, // 角落：抽獎
        { id: 22, name: "空地", type: 'action', effect: { units: 0 } },
        { id: 23, name: "工作", type: 'action', effect: { units: 3 } },
        { id: 24, name: "機會", type: 'chance' },
        { id: 25, name: "空地", type: 'action', effect: { units: 0 } },
        { id: 26, name: "購物", type: 'action', effect: { units: -3 } },
        { id: 27, name: "命運", type: 'fate' },
    ];

    // --- 卡片資料 (稍後填充實際內容和效果) ---
    let fateCardsData = [
        { description: "加薪：獲得+6單位", action: (player) => player.addUnits(6) },
        { description: "罰款：失去-3單位", action: (player) => player.subtractUnits(3) },
        { description: "中獎：獲得+4單位", action: (player) => player.addUnits(4) },
        { description: "朋友借錢：失去-2單位", action: (player) => player.subtractUnits(2) },
        { description: "遺產：獲得+8單位", action: (player) => player.addUnits(8) },
        { description: "搬家：失去-5單位", action: (player) => player.subtractUnits(5) },
        { description: "股票大漲：獲得+7單位", action: (player) => player.addUnits(7) },
        { description: "醫療費：失去-4單位", action: (player) => player.subtractUnits(4) },
        { description: "獎學金：獲得+5單位", action: (player) => player.addUnits(5) },
        { description: "電子設備壞了：失去-3單位", action: (player) => player.subtractUnits(3) },
    ];
    let chanceCardsData = [
        // 注意：需要傳入 game 實例或特定函數來處理移動等複雜操作
        { description: "向前走3步", action: (player, game) => game.moveCurrentPlayerSteps(3) },
        { description: "向後退2步", action: (player, game) => game.moveCurrentPlayerSteps(-2) },
        { description: "直接進監獄", action: (player, game) => game.sendPlayerToJail(player) },
        { description: "前往起點", action: (player, game) => game.movePlayerToSquare(player, CORNER_INDICES.START, true) }, // collectGoBonus = true
        { description: "免費通行證 (暫未實現)", action: (player, game) => addLogMessage(`${player.name} 獲得免費通行證 (效果待實現)`) },
        { description: "獎勵回合 (暫未實現)", action: (player, game) => addLogMessage(`${player.name} 獲得獎勵回合 (效果待實現)`) },
        { description: "懲罰回合 (暫未實現)", action: (player, game) => game.makePlayerMissTurn(player) }, // 實作跳過下回合
        { description: "前往醫院", action: (player, game) => game.movePlayerToSquare(player, CORNER_INDICES.HOSPITAL) },
        { description: "前往最近的工作崗位", action: (player, game) => game.moveToNearestSquareType(player, '工作') },
        { description: "前往購物中心", action: (player, game) => game.moveToNearestSquareType(player, '購物') }, // 替換度假
    ];
    let fateDeck = [];
    let chanceDeck = [];

    // --- 遊戲狀態變數 ---
    let players = []; // 存放玩家物件的陣列
    let currentPlayerIndex = 0;
    let gameActive = false; // 遊戲是否進行中
    let boardSquares = []; // 存放渲染後的格子 DOM 元素和資料
    let diceRollEnabled = false; // 控制擲骰子按鈕是否可用

    // --- 輔助函數 ---
    /**
     * 延遲指定毫秒
     * @param {number} ms 毫秒數
     * @returns {Promise<void>}
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 擲骰子函數
     * @returns {number} 1-6 的隨機整數
     */
    function rollDice() {
        return Math.floor(Math.random() * 6) + 1;
    }

    /**
     * 洗牌函數 (Fisher-Yates shuffle)
     * @param {Array} array 要洗的牌堆
     */
    function shuffleDeck(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // --- 遊戲初始化與設置 ---

    /**
     * 初始化遊戲
     * @param {number} numPlayers 玩家數量
     * @param {number} targetLaps 設定的目標圈數
     */
    function initializeGame(numPlayers, targetLapsSetting) {
        console.log(`Initializing game with ${numPlayers} players, targeting ${targetLapsSetting} laps...`);
        TARGET_LAPS = targetLapsSetting; // 設定目標圈數
        gameActive = true;
        diceRollEnabled = false; // 開始時禁用，輪到玩家時啟用
        players = [];
        currentPlayerIndex = 0;
        boardElement.innerHTML = ''; // 清空舊棋盤
        playersInfoElement.innerHTML = ''; // 清空舊玩家資訊
        logMessagesElement.innerHTML = '<p>遊戲初始化...</p>'; // 重設日誌
        gameOverModal.classList.add('hidden'); // 確保結束彈窗隱藏

        // 1. 創建玩家物件 (包含內部方法)
        const colors = ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA', '#FB8C00']; // 紅, 藍, 綠, 黃, 紫, 橙
        for (let i = 0; i < numPlayers; i++) {
            const player = {
                id: i,
                name: `玩家 ${String.fromCharCode(65 + i)}`,
                units: INITIAL_UNITS,
                position: CORNER_INDICES.START,
                lapsCompleted: 0,
                isInJail: false,
                jailTurnsRemaining: 0,
                missNextTurn: false,
                color: colors[i % colors.length],
                tokenElement: null,
                infoElement: null,
                // 增加內部方法方便管理單位
                addUnits: function(amount) {
                    if (amount > 0) {
                        this.units += amount;
                        addLogMessage(`${this.name} 獲得 ${amount} 單位. 現在有 ${this.units} 單位.`);
                        // 可以加動畫效果
                        updatePlayerInfo(this); // 更新顯示
                    }
                },
                subtractUnits: function(amount) {
                    if (amount > 0) {
                        const actualAmount = Math.min(this.units, amount); // 最多只能扣到 0
                        this.units -= actualAmount;
                        addLogMessage(`${this.name} 失去 ${actualAmount} 單位. 現在有 ${this.units} 單位.`);
                        if (this.units === 0 && actualAmount < amount) {
                             addLogMessage(`${this.name} 單位不足！`);
                             // 可以在這裡處理破產邏輯，但目前先只扣到 0
                        }
                         // 可以加動畫效果
                        updatePlayerInfo(this); // 更新顯示
                        return actualAmount; // 返回實際扣除的數量
                    }
                    return 0;
                },
                // (其他方法可以在需要時添加)
            };
            players.push(player);
        }
        console.log('Players created:', players);

        // 2. 渲染棋盤格子
        renderBoard();

        // 3. 創建玩家棋子和資訊顯示
        players.forEach(player => {
            createPlayerToken(player);
            createPlayerInfoDisplay(player);
            updatePlayerInfo(player); // 更新初始資訊顯示
        });

        // 4. 初始化卡片牌堆
        initializeDecks();

        // 5. 更新 UI
        updateCurrentPlayerDisplay();
        addLogMessage(`遊戲開始！目標 ${TARGET_LAPS} 圈。`);

        // 6. 開始第一個回合
        startTurn();
    }

    /**
     * 渲染棋盤格子到 DOM
     */
     function renderBoard() {
        boardSquares = []; // 清空舊的格子數據
        const boardWidth = boardElement.offsetWidth;
        const boardHeight = boardElement.offsetHeight;
        // 簡化格子大小計算: 角落格子大小約為總寬度的 1/8 * 1.5，邊緣格子填滿剩餘空間
        const cornerSize = Math.floor(boardWidth / BOARD_DIMENSION * 1.3); // 角落格子稍大
        const sideSquareCount = BOARD_DIMENSION - 2; // 每條邊中間的格子數
        const sideWidthTotal = boardWidth - 2 * cornerSize; // 兩邊角落佔去的寬度
        const sideHeightTotal = boardHeight - 2 * cornerSize; // 上下角落佔去的高度
        const sideWidth = Math.floor(sideWidthTotal / sideSquareCount);
        const sideHeight = Math.floor(sideHeightTotal / sideSquareCount);

        // 為了讓格子剛好填滿，計算剩餘像素並分配
        const widthRemainder = sideWidthTotal - (sideWidth * sideSquareCount);
        const heightRemainder = sideHeightTotal - (sideHeight * sideSquareCount);
        // 將剩餘像素加到中間的格子 (簡單處理)
        const extraWidthIndices = Array.from({length: widthRemainder}, (_, i) => Math.floor(sideSquareCount / 2) - Math.floor(widthRemainder / 2) + i);
        const extraHeightIndices = Array.from({length: heightRemainder}, (_, i) => Math.floor(sideSquareCount / 2) - Math.floor(heightRemainder / 2) + i);


        boardSquaresData.forEach((sqData, index) => {
            const square = document.createElement('div');
            square.classList.add('square');
            square.id = `square-${index}`;

            // 創建格子名稱和小圖示（可選）
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('square-name');
            nameSpan.textContent = sqData.name;
            square.appendChild(nameSpan);

            if (sqData.effect && sqData.effect.units !== 0) {
                const effectSpan = document.createElement('span');
                effectSpan.classList.add('square-effect');
                effectSpan.textContent = `${sqData.effect.units > 0 ? '+' : ''}${sqData.effect.units} U`;
                effectSpan.style.color = sqData.effect.units > 0 ? 'green' : 'red';
                square.appendChild(effectSpan);
            } else if (sqData.type === 'fate') {
                 square.innerHTML += '<span class="square-icon">❓</span>'; // 命運圖示
                 square.style.backgroundColor = '#fff9c4'; // 淡黃
            } else if (sqData.type === 'chance') {
                 square.innerHTML += '<span class="square-icon">✨</span>'; // 機會圖示
                 square.style.backgroundColor = '#b3e5fc'; // 淡藍
            } else if (sqData.type === 'jail') {
                 square.innerHTML += '<span class="square-icon">🔒</span>';
                 square.style.backgroundColor = '#cfd8dc'; // 監獄灰
            } else if (sqData.type === 'hospital') {
                 square.innerHTML += '<span class="square-icon">➕</span>';
                 square.style.backgroundColor = '#ffcdd2'; // 醫院粉
            } else if (sqData.type === 'lottery') {
                 square.innerHTML += '<span class="square-icon">💰</span>';
                 square.style.backgroundColor = '#c8e6c9'; // 抽獎綠
            } else if (sqData.type === 'start') {
                square.innerHTML += '<span class="square-icon">🏁</span>';
                square.style.backgroundColor = '#d1c4e9'; // 起點紫
            }


            // --- 計算並設定每個格子的位置和大小 ---
            let top = 0, left = 0, width = 0, height = 0;
            const isCorner = Object.values(CORNER_INDICES).includes(index);

            // 簡化定位邏輯，使用 index 判斷在哪條邊
            const squaresPerSide = BOARD_DIMENSION - 1; // 每邊的格子數 (含半個角落)

            if (index >= 0 && index < squaresPerSide) { // 下邊 (從右到左)
                width = (index === 0 || index === squaresPerSide -1) ? cornerSize : sideWidth;
                height = cornerSize;
                top = boardHeight - height;
                if (index === 0) { // 起點 (右下角)
                    left = boardWidth - width;
                } else { // 下邊中間格子
                    const sideIndex = index -1;
                    left = boardWidth - cornerSize - (sideIndex + 1) * sideWidth - extraWidthIndices.filter(i => i >= sideIndex).length; // 累積寬度
                    width += extraWidthIndices.includes(sideIndex) ? 1:0; // 分配剩餘像素
                }
                if (index === CORNER_INDICES.JAIL) width = cornerSize; // 左下角確保是角落大小

            } else if (index >= squaresPerSide && index < squaresPerSide * 2) { // 左邊 (從下到上)
                width = cornerSize;
                height = (index === squaresPerSide || index === squaresPerSide * 2 -1) ? cornerSize : sideHeight;
                left = 0;
                 if (index === squaresPerSide) { // 監獄 (左下角)
                    top = boardHeight - height;
                } else { // 左邊中間格子
                    const sideIndex = index - squaresPerSide - 1;
                    top = boardHeight - cornerSize - (sideIndex + 1) * sideHeight - extraHeightIndices.filter(i => i >= sideIndex).length; // 累計高度
                     height += extraHeightIndices.includes(sideIndex) ? 1 : 0; // 分配剩餘像素
                }
                 if (index === CORNER_INDICES.HOSPITAL) height = cornerSize; // 左上角確保是角落大小

            } else if (index >= squaresPerSide * 2 && index < squaresPerSide * 3) { // 上邊 (從左到右)
                width = (index === squaresPerSide * 2 || index === squaresPerSide * 3 -1) ? cornerSize : sideWidth;
                height = cornerSize;
                top = 0;
                if (index === squaresPerSide * 2) { // 醫院 (左上角)
                    left = 0;
                } else { // 上邊中間格子
                    const sideIndex = index - squaresPerSide * 2 - 1;
                    left = cornerSize + sideIndex * sideWidth + extraWidthIndices.filter(i => i < sideIndex).length; // 累計寬度
                     width += extraWidthIndices.includes(sideIndex) ? 1 : 0; // 分配剩餘像素
                }
                 if (index === CORNER_INDICES.LOTTERY) width = cornerSize; // 右上角確保是角落大小

            } else { // 右邊 (從上到下) index >= squaresPerSide * 3
                width = cornerSize;
                height = (index === squaresPerSide * 3 || index === squaresPerSide * 4 -1) ? cornerSize : sideHeight; // BOARD_SIZE -1 is the last square before start
                left = boardWidth - width;
                 if (index === squaresPerSide * 3) { // 抽獎 (右上角)
                    top = 0;
                } else { // 右邊中間格子
                    const sideIndex = index - squaresPerSide * 3 - 1;
                    top = cornerSize + sideIndex * sideHeight + extraHeightIndices.filter(i => i < sideIndex).length; // 累計高度
                     height += extraHeightIndices.includes(sideIndex) ? 1 : 0; // 分配剩餘像素
                }
                // 不需要特殊處理右下角，因為 index 0 已經處理
            }


            square.style.top = `${top}px`;
            square.style.left = `${left}px`;
            square.style.width = `${width}px`;
            square.style.height = `${height}px`;

            square.dataset.type = sqData.type;
            square.dataset.index = index;

            if (isCorner) square.classList.add('corner-square');

            boardElement.appendChild(square);
            // 存儲格子中心點用於棋子定位
            const centerX = left + width / 2;
            const centerY = top + height / 2;
            boardSquares.push({ element: square, data: sqData, x: centerX, y: centerY });
        });
        console.log('Board rendered.');
    }

    /**
     * 創建玩家棋子 DOM 元素
     */
    function createPlayerToken(player) {
        const token = document.createElement('div');
        token.classList.add('player-token');
        token.id = `token-${player.id}`;
        token.style.backgroundColor = player.color;
        token.textContent = player.name.charAt(player.name.length - 1); // 顯示 A, B, C...
        player.tokenElement = token;
        boardElement.appendChild(token);
        movePlayerToken(player, player.position, false); // 初始定位無動畫
        console.log(`Token created for ${player.name}`);
    }

    /**
     * 創建玩家資訊顯示 DOM 元素
     */
     function createPlayerInfoDisplay(player) {
        const infoDiv = document.createElement('div');
        infoDiv.id = `player-info-${player.id}`;
        infoDiv.classList.add('player-info-entry'); // 添加 class 方便選取
        infoDiv.style.borderLeft = `5px solid ${player.color}`;
        player.infoElement = infoDiv;
        playersInfoElement.appendChild(infoDiv);
    }

    /**
     * 更新指定玩家的資訊顯示
     */
    function updatePlayerInfo(player) {
        if (!player || !player.infoElement) return; // 防錯
        let status = '';
        if (player.isInJail) {
            status = ` (在監獄 ${player.jailTurnsRemaining} 回合)`;
        } else if (player.missNextTurn) {
            status = ' (跳過下回合)';
        }
        player.infoElement.innerHTML = `
            <strong>${player.name}</strong>:
            單位 ${player.units},
            位置 ${player.position} (${boardSquaresData[player.position]?.name || '未知'}),
            圈 ${player.lapsCompleted}
            <span class="player-status">${status}</span>
        `;
    }

    /**
     * 更新所有玩家的資訊顯示
     */
    function updateAllPlayerInfo() {
        players.forEach(player => updatePlayerInfo(player));
    }

    /**
     * 更新當前回合玩家的顯示，並高亮其資訊欄
     */
     function updateCurrentPlayerDisplay() {
        if (!players || players.length === 0) return; // 防錯
        const currentPlayer = players[currentPlayerIndex];
        currentPlayerElement.textContent = currentPlayer.name;
        currentPlayerElement.style.color = currentPlayer.color;

        // 高亮當前玩家資訊欄
        document.querySelectorAll('.player-info-entry').forEach(div => {
            div.classList.remove('active-player'); // 移除其他玩家的高亮
        });
        if (currentPlayer.infoElement) {
            currentPlayer.infoElement.classList.add('active-player'); // 添加高亮
        }
    }

     /**
     * 在遊戲日誌中添加訊息
     */
    function addLogMessage(message) {
        const p = document.createElement('p');
        // 簡單處理換行，讓訊息更清晰
        p.innerHTML = message.replace(/\n/g, '<br>');
        logMessagesElement.appendChild(p);
        logMessagesElement.scrollTop = logMessagesElement.scrollHeight; // 自動滾動
        console.log("Log:", message);
    }

    /**
     * 移動玩家棋子到指定格子 (視覺上)
     */
    function movePlayerToken(player, targetIndex, animate = true) {
        if (!boardSquares[targetIndex]) {
            console.error(`無法移動到無效索引: ${targetIndex}`);
            return;
        }
        const targetSquare = boardSquares[targetIndex];
        if (!targetSquare || !player.tokenElement) return;

        const tokenElement = player.tokenElement;
        const tokenSize = tokenElement.offsetWidth; // 獲取棋子實際寬度
        const playersOnSameSquare = players.filter(p => p.position === targetIndex && p.id !== player.id); // 其他在這格的玩家

        // 計算棋子在格子內部的基礎偏移量 (讓棋子在格子中間)
        let baseOffsetX = targetSquare.x - tokenSize / 2;
        let baseOffsetY = targetSquare.y - tokenSize / 2;

        // 根據格子上的玩家數量和當前玩家 ID 調整偏移，避免完全重疊
        const maxOffset = tokenSize / 3; // 最大偏移量
        const angleStep = Math.PI * 2 / (playersOnSameSquare.length + 1); // 玩家越多，角度越小
        const offsetDistance = Math.min(maxOffset, tokenSize / 4) * (playersOnSameSquare.length > 0 ? 1 : 0); // 如果只有自己，不偏移

        // 自己的偏移角度 (給一點隨機性或固定偏移)
        // 簡單版本：基於 ID 偏移
        const playerAngleOffset = player.id * 0.5; // 每個玩家錯開一點角度
        const offsetX = Math.cos(angleStep * playersOnSameSquare.findIndex(p => p.id === player.id) + playerAngleOffset) * offsetDistance;
        const offsetY = Math.sin(angleStep * playersOnSameSquare.findIndex(p => p.id === player.id) + playerAngleOffset) * offsetDistance;

        const targetX = baseOffsetX + offsetX;
        const targetY = baseOffsetY + offsetY;


        // --- 更新棋子位置 ---
        if (animate) {
            // 確保 transition 屬性存在 (在 CSS 中設定)
            tokenElement.style.left = `${targetX}px`;
            tokenElement.style.top = `${targetY}px`;
        } else {
            const currentTransition = tokenElement.style.transition;
            tokenElement.style.transition = 'none'; // 暫時移除動畫
            tokenElement.style.left = `${targetX}px`;
            tokenElement.style.top = `${targetY}px`;
            // 強制瀏覽器重繪以立即應用更改
            tokenElement.offsetHeight;
            tokenElement.style.transition = currentTransition; // 恢復動畫設定
        }
        // 注意：這裡只負責視覺移動，玩家數據的 player.position 由移動邏輯更新
    }

    /**
     * 初始化命運和機會卡牌堆
     */
    function initializeDecks() {
        fateDeck = [...fateCardsData]; // 複製一份原始數據
        chanceDeck = [...chanceCardsData];
        shuffleDeck(fateDeck);
        shuffleDeck(chanceDeck);
        addLogMessage("卡牌堆已洗牌。");
    }

    /**
     * 從指定牌堆抽一張卡
     * @param {'fate' | 'chance'} type 牌堆類型
     * @returns {object | null} 抽到的卡片物件，如果牌堆為空則返回 null
     */
    function drawCard(type) {
        const deck = type === 'fate' ? fateDeck : chanceDeck;
        const sourceDeck = type === 'fate' ? fateCardsData : chanceCardsData; // 原始數據

        if (deck.length === 0) {
            addLogMessage(`${type === 'fate' ? '命運' : '機會'}卡牌堆已空，重新洗牌！`);
            deck.push(...sourceDeck); // 重新填滿
            shuffleDeck(deck);
        }

        const card = deck.shift(); // 從頂部抽一張
        deck.push(card); // 放回底部 (經典大富翁規則)
        return card;
    }

    /**
     * 顯示卡片彈窗
     * @param {'fate' | 'chance'} type 卡片類型
     * @param {object} card 卡片物件
     */
    function showCardModal(type, card) {
        cardTypeElement.textContent = type === 'fate' ? '命運卡' : '機會卡';
        cardDescriptionElement.textContent = card.description;
        cardModal.classList.remove('hidden');
        // 按鈕的事件監聽器在下面統一設置
    }


    // --- 遊戲流程控制 ---

    /**
     * 開始回合，處理玩家狀態檢查
     */
    function startTurn() {
        if (!gameActive) return;

        const player = players[currentPlayerIndex];
        updateCurrentPlayerDisplay(); // 高亮當前玩家
        addLogMessage(`--- 輪到 ${player.name} (位置: ${player.position}, 單位: ${player.units}) ---`);
        diceRollEnabled = false; // 先禁用按鈕
        rollDiceButton.disabled = true;

        // 異步處理，允許 UI 更新和延遲
        setTimeout(async () => {
            // 0. 檢查是否跳過回合
            if (player.missNextTurn) {
                player.missNextTurn = false;
                addLogMessage(`${player.name} 本回合被跳過.`);
                updatePlayerInfo(player);
                await delay(1000);
                nextTurn();
                return;
            }

            // 1. 檢查是否在監獄
            if (player.isInJail) {
                player.jailTurnsRemaining--;
                addLogMessage(`${player.name} 在監獄中，還需停留 ${player.jailTurnsRemaining + 1} 回合.`);
                updatePlayerInfo(player);
                if (player.jailTurnsRemaining < 0) {
                    addLogMessage(`${player.name} 刑滿釋放！下回合可以行動。`);
                    player.isInJail = false;
                     // 釋放後正常進行回合 (或者規則是釋放後當回合就行動？這裡設為下回合)
                     await delay(1000);
                     nextTurn(); // 移交給下一個玩家
                     return;
                    // 如果規則是釋放後本回合就行動，則移除 nextTurn()，繼續下面步驟
                } else {
                    // 還在監獄，跳過本回合
                    await delay(1000);
                    nextTurn();
                    return;
                }
            }

            // 2. 允許擲骰子
            addLogMessage(`${player.name} 請擲骰子...`);
            diceDisplayElement.innerHTML = '<span class="die">?</span>'; // 重置骰子顯示
            diceRollEnabled = true; // 允許點擊
            rollDiceButton.disabled = false; // 啟用按鈕
        }, 100); // 短延遲確保 log 等先顯示
    }

    /**
     * 擲骰子按鈕的事件處理器
     */
     async function onRollDiceClick() {
        if (!gameActive || !diceRollEnabled) return;

        diceRollEnabled = false; // 防止重複點擊
        rollDiceButton.disabled = true;
        const player = players[currentPlayerIndex];

        // --- 骰子動畫 (簡單版) ---
        let rollCount = 0;
        const maxRolls = 15; // 滾動次數
        const rollIntervalTime = 70; // 每次滾動間隔 (毫秒)
        const rollInterval = setInterval(() => {
             const randomDie = rollDice();
             // 可以用圖片或 Unicode 符號
             diceDisplayElement.innerHTML = `<span class="die die-rolling">${['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][randomDie-1]}</span>`;
             rollCount++;
             if (rollCount >= maxRolls) {
                 clearInterval(rollInterval);
                 // 確定最終點數
                 const diceValue = rollDice();
                 diceDisplayElement.innerHTML = `<span class="die">${['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][diceValue-1]} (${diceValue})</span>`;
                 addLogMessage(`${player.name} 擲出了 ${diceValue} 點!`);
                 // 異步處理移動和降落
                 processPlayerMove(player, diceValue);
             }
         }, rollIntervalTime);
        // --- 動畫結束 ---
    }

    /**
     * 處理玩家的移動和降落效果 (由擲骰子觸發)
     * @param {object} player 執行移動的玩家
     * @param {number} steps 移動步數
     */
    async function processPlayerMove(player, steps) {
        const oldPosition = player.position;
        const newPosition = (oldPosition + steps + BOARD_SIZE) % BOARD_SIZE; // +BOARD_SIZE 處理負數步數
        let passedGo = false;

        addLogMessage(`${player.name} 從 ${oldPosition} 移動 ${steps} 步...`);

        // --- 執行移動動畫 (一步一步) ---
        await animateMoveSequence(player, oldPosition, newPosition, steps > 0);

        // 更新玩家的邏輯位置
        player.position = newPosition;

        // --- 檢查是否經過或停在起點 ---
        // 條件：前進，且新位置索引小於舊位置索引 (表示繞過了一圈)，或者剛好停在起點
        if (steps > 0 && (newPosition < oldPosition || newPosition === CORNER_INDICES.START)) {
             // 如果剛好停在起點，效果由格子效果處理，這裡只處理經過
             if (newPosition !== CORNER_INDICES.START) {
                passedGo = true;
                player.lapsCompleted++;
                addLogMessage(`${player.name} 經過起點，獲得 ${PASS_GO_BONUS} 單位獎勵！`);
                player.addUnits(PASS_GO_BONUS); // addUnits 內部會更新 UI
                addLogMessage(`${player.name} 完成了第 ${player.lapsCompleted} 圈.`);
            }
        }
         // 更新一次玩家位置信息 (因為 addUnits 可能已經更新過一次，確保位置也對)
        updatePlayerInfo(player);

        // --- 觸發降落格子的效果 ---
        const landedSquare = boardSquares[newPosition];
        if (!landedSquare) {
             console.error("錯誤：找不到降落的格子數據！Index:", newPosition);
             nextTurn(); // 嚴重錯誤，跳到下一回合
             return;
        }
        const landedSquareData = landedSquare.data;
        addLogMessage(`${player.name} 降落在 ${newPosition}: ${landedSquareData.name}.`);
        await handleSquareEffect(player, landedSquareData); // 異步處理格子效果

        // --- 再次更新玩家資訊 (格子效果可能改變了單位等) ---
        updatePlayerInfo(player);

        // --- 檢查遊戲是否結束 ---
        // 條件：有玩家達到目標圈數，並且是輪到最後一位玩家結束回合時才判斷
        let gameOver = false;
        if (players.some(p => p.lapsCompleted >= TARGET_LAPS)) {
            // 檢查是否是最後一個玩家剛完成回合
            if (currentPlayerIndex === players.length - 1) {
                addLogMessage("有玩家達到目標圈數，檢查遊戲結束條件...");
                gameOver = true;
            } else {
                 addLogMessage(`玩家 ${players.find(p => p.lapsCompleted >= TARGET_LAPS)?.name || ''} 已達到目標圈數，等待本輪結束...`);
            }
        }

        if (gameOver) {
            endGame();
        } else {
            // --- 輪到下一位玩家 ---
            await delay(500); // 短暫停頓讓玩家看清log
            nextTurn();
        }
    }

    /**
     * 動畫：讓棋子一步一步移動
     * @param {object} player 玩家物件
     * @param {number} startIdx 起始格子索引
     * @param {number} endIdx 終點格子索引
     * @param {boolean} forward 移動方向是否為前進
     */
    async function animateMoveSequence(player, startIdx, endIdx, forward = true) {
        const stepDuration = 250; // 每一步動畫時間 (毫秒)
        let current = startIdx;

        while (current !== endIdx) {
            if (forward) {
                current = (current + 1) % BOARD_SIZE;
            } else {
                current = (current - 1 + BOARD_SIZE) % BOARD_SIZE;
            }
            movePlayerToken(player, current, true); // 移動到下一格 (帶動畫)

            // 如果是起點，短暫停留強調
            if (current === CORNER_INDICES.START && forward) {
                 await delay(stepDuration * 1.5); // 在起點多停一會兒
            } else {
                 await delay(stepDuration);
            }
        }
        // 移動動畫完成後，確保棋子在最終位置 (處理多人重疊)
        await delay(50); // 短暫等待動畫結束
        movePlayerToken(player, endIdx, false); // 重新定位（無動畫），處理重疊
    }


    /**
     * 處理玩家降落在特定格子的效果
     * @param {object} player 降落的玩家
     * @param {object} squareData 降落的格子數據
     */
    async function handleSquareEffect(player, squareData) {
        switch (squareData.type) {
            case 'start':
                // 停在起點，除了經過獎勵，再給一次獎勵
                addLogMessage(`停在起點！額外獲得 ${squareData.effect.units} 單位！`);
                player.addUnits(squareData.effect.units);
                player.lapsCompleted++; // 停在起點也算完成一圈
                addLogMessage(`${player.name} 完成了第 ${player.lapsCompleted} 圈.`);
                break;
            case 'action':
                // 普通獎懲格子 (工作, 購物等)
                if (squareData.effect && squareData.effect.units !== 0) {
                    if (squareData.effect.units > 0) {
                        player.addUnits(squareData.effect.units);
                    } else {
                        player.subtractUnits(Math.abs(squareData.effect.units));
                    }
                } else {
                    addLogMessage("這裡似乎沒什麼事。");
                }
                break;
            case 'fate':
            case 'chance':
                addLogMessage(`抽一張 ${squareData.type === 'fate' ? '命運' : '機會'} 卡...`);
                await delay(500);
                const card = drawCard(squareData.type);
                if (card) {
                    showCardModal(squareData.type, card);
                    // 卡片效果的執行移到關閉彈窗按鈕的事件中
                } else {
                    addLogMessage("錯誤：無法抽到卡片！");
                }
                break;
            case 'jail':
                // 如果直接降落在監獄格，而不是被卡片送進去
                addLogMessage(`${player.name} 只是來探望監獄，不用停留。`);
                // 如果有 "Go to Jail" 格子，需要另外處理
                break;
            case 'hospital':
                addLogMessage(`支付醫院費用...`);
                if (squareData.effect && squareData.effect.units < 0) {
                    player.subtractUnits(Math.abs(squareData.effect.units));
                }
                break;
            case 'lottery':
                // 抽獎站，隨機給單位
                const lotteryMin = 2;
                const lotteryMax = 8;
                const winnings = Math.floor(Math.random() * (lotteryMax - lotteryMin + 1)) + lotteryMin;
                addLogMessage(`在抽獎站贏得了 ${winnings} 單位！`);
                player.addUnits(winnings);
                break;
            default:
                addLogMessage("未知的格子類型！");
        }
        // 確保效果處理完畢後 UI 是最新的
        updatePlayerInfo(player);
        await delay(500); // 效果處理後短暫停頓
    }

    /**
     * 將玩家送進監獄
     * @param {object} player
     */
    function sendPlayerToJail(player) {
        addLogMessage(`壞運氣！ ${player.name} 被送進監獄！`);
        player.position = CORNER_INDICES.JAIL;
        player.isInJail = true;
        player.jailTurnsRemaining = JAIL_TURNS_TO_SKIP;
        movePlayerToken(player, player.position, true); // 移動棋子到監獄格
        updatePlayerInfo(player);
    }

    /**
     * 讓玩家跳過下個回合
     * @param {object} player
     */
    function makePlayerMissTurn(player) {
         addLogMessage(`${player.name} 下回合將被跳過.`);
         player.missNextTurn = true;
         updatePlayerInfo(player);
    }

     /**
     * 移動玩家到指定格子 (通常由卡片觸發)
     * @param {object} player
     * @param {number} targetIndex 目標格子索引
     * @param {boolean} collectGoBonus 如果經過起點是否收集獎勵
     */
    async function movePlayerToSquare(player, targetIndex, collectGoBonus = false) {
        const oldPosition = player.position;
        targetIndex = targetIndex % BOARD_SIZE; // 確保索引有效
        addLogMessage(`${player.name} 被要求移動到位置 ${targetIndex} (${boardSquaresData[targetIndex]?.name || ''})...`);

        // 判斷是否經過起點 (僅在前進且跨過0時)
        const isMovingForward = (targetIndex > oldPosition) || (targetIndex < oldPosition && targetIndex < BOARD_SIZE / 2 && oldPosition > BOARD_SIZE / 2); // 簡單判斷跨越
        const passedGo = collectGoBonus && isMovingForward && targetIndex < oldPosition;

        // 使用動畫移動
        await animateMoveSequence(player, oldPosition, targetIndex, isMovingForward);

        // 更新邏輯位置
        player.position = targetIndex;
        updatePlayerInfo(player); // 更新位置顯示

        // 處理經過起點獎勵
        if (passedGo) {
             player.lapsCompleted++;
             addLogMessage(`${player.name} 經過起點，獲得 ${PASS_GO_BONUS} 單位獎勵！`);
             player.addUnits(PASS_GO_BONUS);
             addLogMessage(`${player.name} 完成了第 ${player.lapsCompleted} 圈.`);
             updatePlayerInfo(player); // 再次更新確保顯示正確
        }

         // 到達新位置後，觸發該格效果 (如果規則需要)
         // 目前的卡片效果通常是移動，不需要再觸發效果，除非卡片說明要觸發
         // addLogMessage(`到達 ${boardSquaresData[targetIndex]?.name}.`);
         // await handleSquareEffect(player, boardSquaresData[targetIndex]); // 可選：如果卡片移動後要觸發效果
    }

     /**
      * 移動當前玩家相對步數 (由卡片觸發)
      * @param {number} steps 正數向前，負數向後
      */
     async function moveCurrentPlayerSteps(steps) {
         const player = players[currentPlayerIndex];
         await processPlayerMove(player, steps); // 復用移動邏輯
     }

     /**
      * 移動玩家到最近的某種類型的格子
      * @param {object} player
      * @param {string} targetName 格子名稱 (例如 "工作", "購物")
      */
     async function moveToNearestSquareType(player, targetName) {
         let nearestIndex = -1;
         let minDistance = BOARD_SIZE;
         for (let i = 0; i < BOARD_SIZE; i++) {
             const square = boardSquaresData[i];
             if (square.name === targetName) {
                 const distance = (i - player.position + BOARD_SIZE) % BOARD_SIZE; // 計算順時針距離
                 if (distance > 0 && distance < minDistance) { // 必須是前方的格子
                     minDistance = distance;
                     nearestIndex = i;
                 }
             }
         }
         // 如果沒找到前方的，就找第一個該類型的格子（繞一圈）
         if (nearestIndex === -1) {
              for (let i = 0; i < BOARD_SIZE; i++) {
                  const square = boardSquaresData[i];
                  if (square.name === targetName) {
                       nearestIndex = i;
                       break;
                  }
              }
         }

         if (nearestIndex !== -1) {
             addLogMessage(`${player.name} 前往最近的 ${targetName}...`);
             await movePlayerToSquare(player, nearestIndex, true); // 移動並收集經過起點獎勵
         } else {
              addLogMessage(`棋盤上找不到 ${targetName} 格子？`);
         }
     }

    /**
     * 輪到下一位玩家
     */
    function nextTurn() {
        if (!gameActive) return;
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        startTurn(); // 開始下一位玩家的回合
    }

    /**
     * 結束遊戲，顯示結果
     */
     function endGame() {
        gameActive = false;
        diceRollEnabled = false;
        rollDiceButton.disabled = true;
        addLogMessage("<<<<< 遊戲結束 >>>>>");

        // 計算分數並排序
        players.sort((a, b) => b.units - a.units); // 單位多的排前面

        // 宣布勝利者
        const winner = players[0];
        winnerAnnouncementElement.textContent = `🎉 勝利者是 ${winner.name}！ 🎉`;
        winnerAnnouncementElement.style.color = winner.color;

        // 顯示最終分數
        finalScoresElement.innerHTML = '<h3>最終排名：</h3>';
        players.forEach((p, index) => {
            const scoreP = document.createElement('p');
            scoreP.innerHTML = `#${index + 1}: ${p.name} - ${p.units} 單位`;
            if (index === 0) scoreP.style.fontWeight = 'bold';
            finalScoresElement.appendChild(scoreP);
        });

        // 顯示結束彈窗
        gameOverModal.classList.remove('hidden');
    }

    // --- 事件監聽器 ---
    // 開始遊戲按鈕
    startGameButton.addEventListener('click', () => {
        const numPlayers = parseInt(playerCountInput.value);
        const targetLaps = parseInt(targetLapsInput.value);
        if (numPlayers >= 2 && numPlayers <= 6 && targetLaps >= 1 && targetLaps <= 10) {
            settingsModal.classList.add('hidden'); // 隱藏設定彈窗
            initializeGame(numPlayers, targetLaps);
        } else {
            alert("請輸入有效的玩家人數 (2-6) 和目標圈數 (1-10)！");
        }
    });

    // 擲骰子按鈕
    rollDiceButton.addEventListener('click', onRollDiceClick);

    // 關閉卡片彈窗按鈕
    closeCardButton.addEventListener('click', async () => {
        cardModal.classList.add('hidden');
        const player = players[currentPlayerIndex];
        const cardType = cardTypeElement.textContent.includes('命運') ? 'fate' : 'chance';
        const cardDescription = cardDescriptionElement.textContent;

        // 找到對應的卡片數據來執行 action
        const deckData = cardType === 'fate' ? fateCardsData : chanceCardsData;
        const cardData = deckData.find(c => c.description === cardDescription);

        if (cardData && cardData.action) {
            addLogMessage(`${player.name} 執行卡片效果: ${cardData.description}`);
            // 執行卡片效果，需要傳遞 game object (或相關方法)
            // 創建一個包含必要方法的 game object 引用
            const gameContext = {
                 moveCurrentPlayerSteps: moveCurrentPlayerSteps,
                 sendPlayerToJail: sendPlayerToJail,
                 movePlayerToSquare: movePlayerToSquare,
                 makePlayerMissTurn: makePlayerMissTurn,
                 moveToNearestSquareType: moveToNearestSquareType,
                 addLogMessage: addLogMessage // 卡片效果可能需要記錄log
            };
            try {
                 await cardData.action(player, gameContext); // 異步執行效果
            } catch (error) {
                 console.error("執行卡片效果時出錯:", error);
                 addLogMessage("執行卡片效果時發生錯誤。");
            }
        } else {
             addLogMessage("錯誤：找不到卡片效果或描述不匹配！");
        }

        // 卡片效果執行完畢後，可能需要再次檢查遊戲狀態或輪到下一位
        // 取決於卡片效果是否結束回合 (例如，進監獄就結束了)
        // 簡單處理：假設所有卡片效果執行完畢後輪到下一位
        // (除了需要特殊處理的卡片，如獎勵回合)
        // *** 這個邏輯可能需要根據具體卡片調整 ***
        if (!gameActive) return; // 如果遊戲在卡片效果中結束了

        // 檢查是否因為卡片效果導致遊戲結束(例如破產)
        if (players.some(p => p.lapsCompleted >= TARGET_LAPS) && currentPlayerIndex === players.length - 1) {
             endGame();
        } else { 
             // 等待效果顯示
             await delay(500);
             // 如果卡片效果沒有給予額外回合或跳過回合等，則正常進入下一回合
             if (!player.missNextTurn /* && !player.hasExtraTurn */ ) {
                // nextTurn(); // 注意：如果卡片效果包含移動，移動函數內部已經調用了 nextTurn，這裡可能重複調用
                // 暫時註解掉，讓移動卡片效果後的 nextTurn 生效
             } else {
                 // 如果卡片效果導致跳過回合，需要更新顯示並準備下下回合
                 updatePlayerInfo(player);
                 // nextTurn(); // 仍然需要 nextTurn 來切換到下一個玩家
             }
             // 需要更精確的狀態管理來處理額外回合等情況
        }
    });

    // 重新開始遊戲按鈕
    restartGameButton.addEventListener('click', () => {
        gameOverModal.classList.add('hidden');
        settingsModal.classList.remove('hidden'); // 顯示設定彈窗
        // 清理工作在 initializeGame 中完成
    });

    // --- 初始狀態 ---
    // 頁面載入後，顯示設定彈窗，禁用擲骰子按鈕
    rollDiceButton.disabled = true;
    settingsModal.classList.remove('hidden'); // 確保設定彈窗可見

}); // End of DOMContentLoaded