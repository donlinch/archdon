// 排行榜系統
// 定義排行榜基本結構
const defaultLeaderboard = {
    "3": [], // 3人模式的排行
    "4": [], // 4人模式的排行
    "5": [], // 5人模式的排行
    "6": [], // 6人模式的排行
    "7": [], // 7人模式的排行
    "8": []  // 8人模式的排行
  };
  
  // 初始化排行榜
  function initLeaderboard() {
    if (!localStorage.getItem('bridgeGameLeaderboard')) {
      localStorage.setItem('bridgeGameLeaderboard', JSON.stringify(defaultLeaderboard));
    }
  }
  
  // 添加排行榜記錄
  function addLeaderboardEntry(playerCount, playerName, completionTime) {
    const leaderboard = JSON.parse(localStorage.getItem('bridgeGameLeaderboard'));
    
    // 確保該玩家數量的陣列存在
    if (!leaderboard[playerCount]) {
      leaderboard[playerCount] = [];
    }
    
    // 新增記錄
    leaderboard[playerCount].push({
      name: playerName,
      time: completionTime, // 以秒為單位
      date: new Date().toISOString()
    });
    
    // 按照完成時間排序 (從小到大)
    leaderboard[playerCount].sort((a, b) => a.time - b.time);
    
    // 只保留前10名
    if (leaderboard[playerCount].length > 10) {
      leaderboard[playerCount] = leaderboard[playerCount].slice(0, 10);
    }
    
    // 保存更新後的排行榜
    localStorage.setItem('bridgeGameLeaderboard', JSON.stringify(leaderboard));
    
    return leaderboard;
  }
  


  // 獲取排行榜數據
function getLeaderboard(playerCount) {
    // 顯示載入中提示
    const leaderboardBody = document.getElementById('leaderboardBody');
    leaderboardBody.innerHTML = '<tr><td colspan="3" class="loading">載入中...</td></tr>';
    
    // 發送AJAX請求
    fetch(`/api/bridge-game/leaderboard?player_count=${playerCount}`)
      .then(response => response.json())
      .then(data => {
        // 清空現有內容
        leaderboardBody.innerHTML = '';
        
        if (data.length === 0) {
          const row = document.createElement('tr');
          row.innerHTML = '<td colspan="3" class="no-records">目前尚無記錄</td>';
          leaderboardBody.appendChild(row);
          return;
        }
        
        // 填充排行榜
        data.forEach((entry, index) => {
          const row = document.createElement('tr');
          
          // 決定排名的樣式
          let rankClass = '';
          if (index === 0) rankClass = 'rank-gold';
          else if (index === 1) rankClass = 'rank-silver';
          else if (index === 2) rankClass = 'rank-bronze';
          
          // 格式化時間
          const formattedTime = formatTime(entry.completion_time);
          
          row.innerHTML = `
            <td class="rank ${rankClass}">${index + 1}</td>
            <td class="name">${entry.player_name}</td>
            <td class="time">${formattedTime}</td>
          `;
          
          leaderboardBody.appendChild(row);
        });
      })
      .catch(error => {
        leaderboardBody.innerHTML = `<tr><td colspan="3" class="error">載入失敗: ${error.message}</td></tr>`;
      });
  }
  
  // 提交成績
  function submitScore(event) {
    event.preventDefault();
    
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName) {
      alert('請輸入您的名稱！');
      return;
    }
    
    const playerCount = document.getElementById('playerCount').value;
    const completionTime = parseInt(document.getElementById('completionTimeValue').value);
    
    // 禁用提交按鈕，防止重複提交
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
    
    // 發送AJAX請求
    fetch('/api/bridge-game/submit-score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        player_name: playerName,
        player_count: parseInt(playerCount),
        completion_time: completionTime
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        alert(`提交失敗: ${data.error}`);
      } else {
        // 關閉提交對話框並打開排行榜
        closeScoreSubmitModal();
        openLeaderboardModal();
      }
    })
    .catch(error => {
      alert(`提交失敗: ${error.message}`);
    })
    .finally(() => {
      // 恢復提交按鈕
      submitBtn.disabled = false;
      submitBtn.textContent = '提交成績';
    });
  }
  // 遊戲變數
  let currentStep = 0;
  let totalSteps = 15;
  let time = 120;
  let gameActive = true;
  let safePattern = [];
  let isMoving = false;
  let currentPlayerIndex = 0;
  let players = [];
  let playerCount = 8;
  const playerColors = ['pink', 'yellow-pink', 'green-pink', 'blue-pink', 'purple-pink', 'orange-pink', 'cyan-pink', 'brown-pink'];
  const playerNames = ['小紅', '小黃', '小綠', '小藍', '小紫', '小橙', '小青', '小棕'];
  const playerCountSelect = document.getElementById('playerCount');
  let lastFailPosition = 0;
  let currentViewStage = 0; // 當前視圖的階段（0-3，每4步調整一次）
  
  // 元素
  const bridge = document.getElementById('bridge');
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const message = document.getElementById('message');
  const timerElement = document.querySelector('.timer');
  const progressElement = document.querySelector('.progress');
  const gameOverElement = document.getElementById('gameOver');
  const gameOverText = document.getElementById('gameOverText');
  const character = document.getElementById('character');
  const characterBody = document.getElementById('characterBody');
  const playersContainer = document.getElementById('players');
  
  // 新增導航欄控制
  const navToggle = document.getElementById('navToggle');
  const gameHeader = document.getElementById('gameHeader');
  const gameFooter = document.getElementById('gameFooter');
  let navVisible = false;
  
  navToggle.addEventListener('click', function() {
      navVisible = !navVisible;
      if (navVisible) {
          gameHeader.classList.add('visible');
          gameFooter.classList.add('visible');
          navToggle.textContent = '×';
      } else {
          gameHeader.classList.remove('visible');
          gameFooter.classList.remove('visible');
          navToggle.textContent = '≡';
      }
  });
  
  // 玩家數量選擇事件
  playerCountSelect.addEventListener('change', function() {
      playerCount = parseInt(this.value);
      restartGame();
  });
  
  // 初始化玩家列表
  function initPlayers() {
      players = [];
      for (let i = 0; i < playerCount; i++) {
          players.push({
              name: playerNames[i],
              color: playerColors[i],
              active: i === 0,
              lastFailPosition: 0
          });
      }
  }
  
  // 更新玩家UI
  function updatePlayersUI() {
      playersContainer.innerHTML = '';
    players.forEach((player, index) => {
      const playerElement = document.createElement('div');
      playerElement.className = 'player';
      playerElement.id = `player${index+1}`;
      
      const playerFigure = document.createElement('div');
      playerFigure.className = 'player-figure';
      
      const playerBody = document.createElement('div');
      playerBody.className = `player-body ${player.color}`;
      
      const playerHead = document.createElement('div');
      playerHead.className = 'player-head';
      
      // 添加當前玩家指示器，現在直接放在玩家圖示上
      if (player.active) {
          const indicator = document.createElement('div');
          indicator.className = 'current-player-indicator-icon';
          playerFigure.appendChild(indicator);
      }
      
      playerBody.appendChild(playerHead);
      playerFigure.appendChild(playerBody);
      
      playerElement.appendChild(playerFigure);
      
      if (!player.active && index <= currentPlayerIndex) {
          playerElement.style.opacity = '0.5';
      }
      
      playersContainer.appendChild(playerElement);
    });
  }
  
  // 初始化遊戲
  function initGame() {
      // 生成安全路徑
      safePattern = [];
      for (let i = 0; i < totalSteps; i++) {
          safePattern.push(Math.random() < 0.5 ? 'left' : 'right');
      }
      
      // 創建橋面板
      createBridge();
      
      // 初始化玩家
      initPlayers();
      currentPlayerIndex = 0;
      lastFailPosition = 0;
      updatePlayersUI();
      
      // 放置小人在起點
      positionCharacter(0);
      
      // 更新小人顏色
      updateCharacterColor();
      
      // 更新進度顯示
      updateProgress();
      
      // 重置遊戲提示訊息
      message.innerText = `接力挑戰！${playerCount}位玩家輪流挑戰。當一位玩家失敗，下一位玩家將從該位置繼續！`;
      
      // 重置橋的位置
      resetBridgePosition();
      
      // 重置視角階段
      currentViewStage = 0;
      
      // 啟動計時器
      startTimer();
  }
  
  // 重置橋的位置
  function resetBridgePosition() {
      bridge.style.transform = 'translateY(0)';
  }
  
  // 創建橋
  function createBridge() {
      bridge.innerHTML = '';
      for (let i = 0; i < totalSteps; i++) {
          const row = document.createElement('div');
          row.className = 'bridge-row';
          row.setAttribute('data-index', i);
          row.style.opacity = 1 - (i * 0.04);
          
          const leftPanel = document.createElement('div');
          leftPanel.className = 'glass-panel';
          leftPanel.innerText = `L${i+1}`;
          
          const rightPanel = document.createElement('div');
          rightPanel.className = 'glass-panel';
          rightPanel.innerText = `R${i+1}`;
          
          // 添加血跡效果的div
          const leftBlood = document.createElement('div');
          leftBlood.className = 'blood';
          leftPanel.appendChild(leftBlood);
          
          const rightBlood = document.createElement('div');
          rightBlood.className = 'blood';
          rightPanel.appendChild(rightBlood);
          
          row.appendChild(leftPanel);
          row.appendChild(rightPanel);
          bridge.appendChild(row);
      }
  }
  
  // 放置小人在指定位置
  function positionCharacter(stepPosition) {
      if (stepPosition === 0) {
          // 回到起點
          character.style.bottom = '20px';
          character.style.left = '50%';
          character.style.top = '';
          character.style.transform = 'translateX(-50%)';
      } else {
          // 放在指定的步數位置
          const rows = document.querySelectorAll('.bridge-row');
          // 找到正確的行，注意索引計算
          const rowIndex = totalSteps - stepPosition;
          if (rowIndex >= 0 && rowIndex < rows.length) {
              const targetRow = rows[rowIndex];
              if (targetRow) {
                  const rowRect = targetRow.getBoundingClientRect();
                  character.style.top = `${rowRect.top + rowRect.height/2 - 30}px`;
                  character.style.left = '50%';
                  character.style.bottom = '';
                  character.style.transform = 'translate(-50%, -50%) rotateX(60deg)';
              }
          }
      }
      
      character.classList.remove('fall-animation');
  }
  
  // 更新小人顏色
  function updateCharacterColor() {
      if (currentPlayerIndex >= 0 && currentPlayerIndex < players.length) {
          characterBody.className = `character-body ${players[currentPlayerIndex].color}`;
          
          // 更新腿部顏色
          const legs = characterBody.querySelectorAll('.character-leg');
          legs.forEach(leg => {
              leg.className = `character-leg ${players[currentPlayerIndex].color}`;
          });
      }
  }
  
  // 計時器
  function startTimer() {
      const timer = setInterval(() => {
          if (!gameActive) {
              clearInterval(timer);
              return;
          }
          
          time--;
          const minutes = Math.floor(time / 60);
          const seconds = time % 60;
          timerElement.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          
          if (time <= 0) {
              gameActive = false;
              endGame(false, "時間到！");
              clearInterval(timer);
          }
      }, 1000);
  }
  
  // 切換到下一個玩家
  function switchToNextPlayer() {
      if (currentPlayerIndex >= 0 && currentPlayerIndex < players.length) {
          players[currentPlayerIndex].active = false;
      }
      
      // 尋找下一個可用的玩家
      let foundNextPlayer = false;
      for (let i = currentPlayerIndex + 1; i < players.length; i++) {
          if (!players[i].active) {
              currentPlayerIndex = i;
              players[i].active = true;
              foundNextPlayer = true;
              break;
          }
      }
      
      if (foundNextPlayer) {
          updatePlayersUI();
          updateCharacterColor();
          // 從上一個玩家失敗的位置開始
          positionCharacter(lastFailPosition);
          message.innerText = `${players[currentPlayerIndex].name}開始接力！從第${lastFailPosition}步開始`;
          
          // 根據失敗位置調整視圖
          adjustBridgeViewByPosition(lastFailPosition);
          
          // 恢復按鈕
          setTimeout(() => {
              isMoving = false;
              leftBtn.disabled = false;
              rightBtn.disabled = false;
          }, 500);
      } else {
          // 所有玩家都用完了
          endGame(false, "所有玩家都失敗了！");
      }
  }
  
  // 獲取當前行
  function getCurrentRow() {
      const stepToCheck = Math.max(currentStep, lastFailPosition);
      if (stepToCheck >= totalSteps) return null;
      
      const rows = document.querySelectorAll('.bridge-row');
      const rowIndex = totalSteps - stepToCheck - 1;
      
      if (rowIndex >= 0 && rowIndex < rows.length) {
          return rows[rowIndex];
      }
      return null;
  }
  
  // 根據當前位置調整橋的視圖
  function adjustBridgeViewByPosition(position) {
      // 每4步進行一次調整
      const targetStage = Math.floor(position / 3);
      
      // 如果需要移動到新階段
      if (targetStage !== currentViewStage) {
          currentViewStage = targetStage;
          
          // 計算需要移動的距離
          const bridgeHeight = bridge.getBoundingClientRect().height;
          // 根據當前階段計算不同的移動距離
          const stageShift = bridgeHeight * 0.4 * targetStage; // 每個階段移動25%高度
          
          // 向下移動橋（正值表示向下移動）
          bridge.style.transform = `translateY(${stageShift}px)`;
          
          // 重新定位角色
          setTimeout(() => {
              positionCharacter(position);
          }, 500);
      }
  }
  
  // 跳躍
  function jump(side) {
      if (!gameActive || isMoving) return;
      
      // 防止重複點擊
      isMoving = true;
      leftBtn.disabled = true;
      rightBtn.disabled = true;
      
      const stepToCheck = Math.max(currentStep, lastFailPosition);
      const currentRow = getCurrentRow();
      
      if (!currentRow) {
          console.error("找不到目標行", stepToCheck);
          isMoving = false;
          leftBtn.disabled = false;
          rightBtn.disabled = false;
          return;
      }
      
      const leftPanel = currentRow.children[0];
      const rightPanel = currentRow.children[1];
      
      if (!leftPanel || !rightPanel) {
          console.error("找不到面板");
          isMoving = false;
          leftBtn.disabled = false;
          rightBtn.disabled = false;
          return;
      }
      
      const isSafe = (side === safePattern[stepToCheck]);
      
      // 計算小人的位置
      const rowRect = currentRow.getBoundingClientRect();
      const leftRect = leftPanel.getBoundingClientRect();
      const rightRect = rightPanel.getBoundingClientRect();
      
      const targetPanel = side === 'left' ? leftPanel : rightPanel;
      const targetRect = side === 'left' ? leftRect : rightRect;
      
      // 移動小人到選擇的面板上
      const panelCenterX = targetRect.left + (targetRect.width / 2);
      const panelCenterY = targetRect.top + (targetRect.height / 2) - 30; // 稍微調整高度
      
      character.style.left = `${panelCenterX}px`;
      character.style.top = `${panelCenterY}px`;
      character.style.transform = 'translate(-50%, -50%) rotateX(60deg)';
      
      setTimeout(() => {
          if (isSafe) {
              // 安全通過
              targetPanel.classList.add('safe');
              
              // 如果是從接力位置繼續，則更新當前步數
              if (lastFailPosition > currentStep) {
                  currentStep = lastFailPosition;
              }
              
              // 前進一步
              currentStep++;
              updateProgress();
              message.innerText = `${players[currentPlayerIndex].name} 安全! 繼續前進`;
              
              // 根據當前位置調整視圖
              adjustBridgeViewByPosition(currentStep);
              
              // 按鈕恢復
              setTimeout(() => {
                  isMoving = false;
                  leftBtn.disabled = false;
                  rightBtn.disabled = false;
              }, 500);
              
              // 檢查是否勝利
              if (currentStep >= totalSteps) {
                  endGame(true, `恭喜! ${players[currentPlayerIndex].name} 成功穿過了玻璃橋!`);
              }
          } else {
              // 失敗，玻璃破裂
              targetPanel.classList.add('broken');
              
              // 顯示血跡
              const blood = targetPanel.querySelector('.blood');
              if (blood) {
                  blood.style.opacity = '0.7';
              }
              
              // 小人墜落動畫
              character.classList.add('fall-animation');
              
              // 記錄當前失敗位置（用於接力）
              lastFailPosition = Math.max(currentStep, lastFailPosition);
              
              setTimeout(() => {
                  // 切換到下一個玩家
                  switchToNextPlayer();
              }, 2000);
          }
      }, 500);
  }
  
  // 更新進度
  function updateProgress() {
      progressElement.innerText = `進度: ${currentStep}/${totalSteps}`;
  }
  
  // 結束遊戲
  function endGame(isWin, msg) {
      gameActive = false;
      gameOverText.innerText = msg;
      gameOverElement.style.display = 'flex';
      gameOverElement.style.backgroundColor = isWin ? 'rgba(0, 100, 0, 0.9)' : 'rgba(100, 0, 0, 0.9)';
      leftBtn.disabled = true;
      rightBtn.disabled = true;
      
      // 勝利時顯示提交成績對話框
      if (isWin) {
          // 延遲一下再彈出提交對話框，讓玩家先看到勝利消息
          setTimeout(() => {
              openScoreSubmitModal(time); // 傳入剩餘時間
          }, 1500);
      }
  }
  
  // 重新開始遊戲
  function restartGame() {
      gameOverElement.style.display = 'none';
      leftBtn.disabled = false;
      rightBtn.disabled = false;
      time = 120;
      gameActive = true;
      isMoving = false;
      currentStep = 0;
      lastFailPosition = 0;
      currentPlayerIndex = 0;
      updateProgress();
      initGame();
  }
  
  // 按鈕事件
  leftBtn.addEventListener('click', () => jump('left'));
  rightBtn.addEventListener('click', () => jump('right'));
  
  // 添加觸摸事件支持
  leftBtn.addEventListener('touchstart', (e) => {
      e.preventDefault(); // 防止預設行為
      jump('left');
  });
  
  rightBtn.addEventListener('touchstart', (e) => {
      e.preventDefault(); // 防止預設行為
      jump('right');
  });
         
  // 初始啟動遊戲
  document.addEventListener('DOMContentLoaded', function() {
      // 初始化排行榜系統
      initLeaderboard();
      
      // 綁定排行榜按鈕事件
      document.getElementById('leaderboardBtn').addEventListener('click', openLeaderboardModal);
      
      // 綁定排行榜切換分類的事件
      document.getElementById('leaderboardPlayerCount').addEventListener('change', function() {
          changeLeaderboardCategory(this.value);
      });
      
      // 綁定其他相關事件
      document.getElementById('closeLeaderboardBtn').addEventListener('click', closeLeaderboardModal);
      document.getElementById('closeScoreSubmitBtn').addEventListener('click', closeScoreSubmitModal);
      document.getElementById('scoreForm').addEventListener('submit', submitScore);
      
      // 啟動遊戲
      initGame();
  });