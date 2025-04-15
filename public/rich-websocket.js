// rich-websocket.js
// 這個文件處理 WebSocket 通訊

class GameWebSocketServer {
    constructor(port = 8080) {
      this.port = port;
      this.wss = null;
      this.clients = new Set();
      this.game = null;
    }
  
    // 設置遊戲實例的引用
    setGame(gameInstance) {
      this.game = gameInstance;
    }
  
    // 啟動 WebSocket 服務器
    start() {
      // 檢查環境是否支持 WebSocket（伺服器端）
      if (typeof require !== 'undefined') {
        try {
          const WebSocket = require('ws');
          this.wss = new WebSocket.Server({ port: this.port });
          console.log(`WebSocket 服務器啟動在端口 ${this.port}`);
  
          this.wss.on('connection', (ws) => {
            console.log('新的客戶端已連接');
            this.clients.add(ws);
  
            // 發送當前遊戲狀態
            this.sendGameState(ws);
  
            ws.on('message', (message) => {
              try {
                const data = JSON.parse(message);
                this.handleMessage(data, ws);
              } catch (error) {
                console.error('處理消息時出錯:', error);
                this.sendError(ws, '無效的消息格式');
              }
            });
  
            ws.on('close', () => {
              console.log('客戶端已斷開連接');
              this.clients.delete(ws);
            });
          });
  
          this.wss.on('error', (error) => {
            console.error('WebSocket 服務器錯誤:', error);
          });
        } catch (error) {
          console.error('啟動 WebSocket 服務器失敗:', error);
          console.log('請確保已安裝 ws 套件 (npm install ws)');
        }
      } else {
        console.log('當前環境不支持創建 WebSocket 服務器');
      }
    }
  
    // 停止 WebSocket 服務器
    stop() {
      if (this.wss) {
        this.wss.close(() => {
          console.log('WebSocket 服務器已關閉');
        });
      }
    }
  
    // 向所有連接的客戶端廣播消息
    broadcast(message) {
      if (!this.clients.size) return;
  
      const messageStr = JSON.stringify(message);
      this.clients.forEach((client) => {
        if (client.readyState === 1) { // OPEN
          client.send(messageStr);
        }
      });
    }
  
    // 向特定客戶端發送消息
    sendToClient(client, message) {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify(message));
      }
    }
  
    // 發送錯誤消息
    sendError(client, errorMessage) {
      this.sendToClient(client, {
        type: 'error',
        message: errorMessage
      });
    }
  
    // 發送遊戲狀態
    sendGameState(client = null) {
      if (!this.game) return;
  
      const gameState = {
        selectedPlayer: this.game.selectedPlayer,
        playerPathIndices: this.game.playerPathIndices,
        pathCells: this.game.pathCells.map(cell => ({
          title: cell.title,
          description: cell.description,
          position: cell.position,
          color: cell.color
        })),
        highlightedCell: this.game.highlightedCell,
        isMoving: this.game.isMoving
      };
  
      const message = {
        type: 'gameState',
        data: gameState
      };
  
      if (client) {
        this.sendToClient(client, message);
      } else {
        this.broadcast(message);
      }
    }
  
    // 處理接收到的消息
    handleMessage(data, client) {
      if (!this.game) {
        this.sendError(client, '遊戲未初始化');
        return;
      }
  
      switch (data.type) {
        case 'getGameState':
          this.sendGameState(client);
          break;
  
        case 'selectPlayer':
          if (data.player >= 1 && data.player <= 3) {
            this.game.selectPlayer(data.player);
            this.sendGameState();
          } else {
            this.sendError(client, '無效的玩家編號');
          }
          break;
  
        case 'movePlayer':
          if (this.game.isMoving) {
            this.sendError(client, '玩家正在移動中');
            return;
          }
  
          const { player, direction, steps } = data;
          if (player < 1 || player > 3) {
            this.sendError(client, '無效的玩家編號');
            return;
          }
  
          const stepsCount = parseInt(steps) || 1;
          if (stepsCount < 1 || stepsCount > 12) {
            this.sendError(client, '步數必須在 1-12 之間');
            return;
          }
  
          // 先選擇玩家
          this.game.selectPlayer(player);
          
          // 然後移動
          if (direction === 'forward') {
            this.game.movePlayerStepByStep(stepsCount, true);
          } else if (direction === 'backward') {
            this.game.movePlayerStepByStep(stepsCount, false);
          } else {
            this.sendError(client, '無效的移動方向');
            return;
          }
  
          // 發送移動結果
          this.broadcast({
            type: 'moveResult',
            player,
            direction,
            steps: stepsCount,
            position: this.game.pathCells[this.game.playerPathIndices[player - 1]].title || `位置 ${this.game.playerPathIndices[player - 1]}`
          });
          break;
  
        case 'jumpToPosition':
          const { player: jumpPlayer, position } = data;
          if (jumpPlayer < 1 || jumpPlayer > 3) {
            this.sendError(client, '無效的玩家編號');
            return;
          }
  
          if (position < 0 || position >= this.game.pathCells.length) {
            this.sendError(client, '無效的位置');
            return;
          }
  
          this.game.selectPlayer(jumpPlayer);
          this.game.playerPathIndices[jumpPlayer - 1] = position;
          this.game.updatePlayerPositions();
          this.sendGameState();
          break;
  
        case 'showInfo':
          // 顯示中央資訊
          const centerInfo = document.getElementById('center-info');
          const logoContainer = document.getElementById('logo-container');
          if (centerInfo && logoContainer) {
            centerInfo.classList.remove('hidden');
            logoContainer.classList.add('hidden');
          }
          break;
  
        case 'hideInfo':
          // 隱藏中央資訊
          const centerInfoHide = document.getElementById('center-info');
          const logoContainerShow = document.getElementById('logo-container');
          if (centerInfoHide && logoContainerShow) {
            centerInfoHide.classList.add('hidden');
            logoContainerShow.classList.remove('hidden');
          }
          break;
  
        case 'resetGame':
          // 重置遊戲
          this.game.initPlayerPositions();
          this.game.renderBoard();
          this.sendGameState();
          break;
  
        default:
          this.sendError(client, `未知的消息類型: ${data.type}`);
      }
    }
  
    // 當遊戲狀態發生變化時通知控制器
    notifyGameStateChanged() {
      this.sendGameState();
    }
  }
  
  // 導出 WebSocket 服務器實例
  // 注意：此部分在瀏覽器中會被忽略，在 Node.js 中使用
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameWebSocketServer;
  }