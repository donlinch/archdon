/**
 * 廚房急先鋒 - 多人協作料理遊戲服務器
 * 基於BBS風格的會員制文字遊戲
 * 針對行動裝置優化的多人協作料理遊戲
 * 
 * 注意：此服務與主服務器(server.js)分離運行，使用不同的端口和路徑
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

// 初始化Express應用
const app = express();
const server = http.createServer(app);

// 資料庫連接配置
const pool = new Pool({
  user: process.env.COOK_DB_USER || 'postgres',
  host: process.env.COOK_DB_HOST || 'localhost',
  database: process.env.COOK_DB_NAME || 'cook_game',
  password: process.env.COOK_DB_PASSWORD || 'postgres',
  port: process.env.COOK_DB_PORT || 5432,
});

// 中間件設置
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API前綴，避免與主系統路由衝突
const API_PREFIX = '/cook-api';

// JWT密鑰
const JWT_SECRET = process.env.COOK_JWT_SECRET || 'cook-kitchen-rush-secret-key';

// WebSocket服務器設置 - 使用特定路徑避免衝突
const wss = new WebSocket.Server({ 
  server,
  path: '/cook-ws'  // 使用特定路徑區分遊戲WebSocket
});

console.log('[COOK-GAME] 遊戲WebSocket服務器已初始化於路徑: /cook-ws');

// 活躍的遊戲房間
const gameRooms = new Map();
// 活躍的連接
const activeConnections = new Map();

// 用戶認證中間件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).send('未提供訪問令牌');
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send('無效的令牌');
    req.user = user;
    next();
  });
};

// API路由 - 會員登入 (使用前綴避免衝突)
app.post(`${API_PREFIX}/auth/login`, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 查詢用戶
    const userResult = await pool.query(
      'SELECT * FROM cook_users WHERE username = $1',
      [username]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: '用戶名或密碼錯誤' });
    }
    
    const user = userResult.rows[0];
    
    // 驗證密碼
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: '用戶名或密碼錯誤' });
    }
    
    // 更新最後登入時間
    await pool.query(
      'UPDATE cook_users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );
    
    // 生成JWT令牌
    const token = jwt.sign(
      { 
        id: user.user_id, 
        username: user.username,
        level: user.level
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ 
      token,
      user: {
        id: user.user_id,
        username: user.username,
        level: user.level,
        points: user.points
      }
    });
    
  } catch (error) {
    console.error('[COOK-GAME] 登入錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// API路由 - 獲取會員資料
app.get(`${API_PREFIX}/users/profile`, authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 查詢用戶基本資料
    const userResult = await pool.query(
      'SELECT user_id, username, email, level, points FROM cook_users WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    const user = userResult.rows[0];
    
    // 查詢用戶成就
    const achievementsResult = await pool.query(
      `SELECT a.achievement_id, a.achievement_name, a.description, ua.unlock_date
       FROM cook_achievements a
       JOIN cook_user_achievements ua ON a.achievement_id = ua.achievement_id
       WHERE ua.user_id = $1`,
      [userId]
    );
    
    res.json({
      user,
      achievements: achievementsResult.rows
    });
    
  } catch (error) {
    console.error('[COOK-GAME] 獲取用戶資料錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// API路由 - 獲取遊戲房間列表
app.get(`${API_PREFIX}/games/rooms`, authenticateToken, (req, res) => {
  const rooms = [];
  
  gameRooms.forEach((room, roomId) => {
    rooms.push({
      id: roomId,
      name: room.name,
      players: room.players.length,
      maxPlayers: 4,
      difficulty: room.difficulty,
      status: room.status
    });
  });
  
  res.json(rooms);
});

// API路由 - 創建遊戲房間
app.post(`${API_PREFIX}/games/rooms`, authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { name, difficulty } = req.body;
    
    // 生成唯一房間ID
    const roomId = `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // 創建房間
    const newRoom = {
      id: roomId,
      name: name || `${req.user.username}的房間`,
      difficulty: difficulty || 'normal',
      status: 'waiting',
      players: [],
      createdBy: userId,
      createdAt: new Date()
    };
    
    // 保存房間
    gameRooms.set(roomId, newRoom);
    
    res.status(201).json({
      roomId,
      name: newRoom.name,
      status: newRoom.status
    });
    
  } catch (error) {
    console.error('[COOK-GAME] 創建房間錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// WebSocket連接處理
wss.on('connection', (ws) => {
  console.log('[COOK-GAME] 新的WebSocket連接');
  
  // 分配臨時ID直到認證
  const connectionId = Date.now().toString();
  let userId = null;
  let currentRoomId = null;
  
  // 保存連接
  activeConnections.set(connectionId, ws);
  
  // 處理消息
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // 處理不同類型的消息
      switch (data.type) {
        case 'authenticate':
          // 驗證令牌
          try {
            const decoded = jwt.verify(data.token, JWT_SECRET);
            userId = decoded.id;
            ws.userId = userId;
            ws.send(JSON.stringify({ type: 'auth_success', userId }));
          } catch (err) {
            ws.send(JSON.stringify({ type: 'auth_error', message: '無效的令牌' }));
          }
          break;
          
        case 'join_room':
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', message: '需要先認證' }));
            return;
          }
          
          // 獲取要加入的房間
          const roomId = data.roomId;
          const room = gameRooms.get(roomId);
          
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: '房間不存在' }));
            return;
          }
          
          // 檢查房間是否已滿
          if (room.players.length >= 4) {
            ws.send(JSON.stringify({ type: 'error', message: '房間已滿' }));
            return;
          }
          
          // 獲取用戶信息
          const userResult = await pool.query(
            'SELECT username, level FROM cook_users WHERE user_id = $1',
            [userId]
          );
          
          if (userResult.rows.length === 0) {
            ws.send(JSON.stringify({ type: 'error', message: '用戶不存在' }));
            return;
          }
          
          const user = userResult.rows[0];
          
          // 將玩家加入房間
          const player = {
            id: userId,
            username: user.username,
            level: user.level,
            station: null, // 尚未選擇工作站
            ready: false
          };
          
          room.players.push(player);
          currentRoomId = roomId;
          
          // 通知房間內所有玩家
          broadcastToRoom(roomId, {
            type: 'player_joined',
            player: {
              id: player.id,
              username: player.username,
              level: player.level
            }
          });
          
          // 發送房間當前狀態給新加入的玩家
          ws.send(JSON.stringify({
            type: 'room_state',
            roomId,
            name: room.name,
            difficulty: room.difficulty,
            status: room.status,
            players: room.players
          }));
          
          break;
          
        case 'player_ready':
          if (!userId || !currentRoomId) {
            ws.send(JSON.stringify({ type: 'error', message: '需要先加入房間' }));
            return;
          }
          
          const currentRoom = gameRooms.get(currentRoomId);
          if (!currentRoom) {
            ws.send(JSON.stringify({ type: 'error', message: '房間不存在' }));
            return;
          }
          
          // 找到玩家並設置準備狀態
          const playerIndex = currentRoom.players.findIndex(p => p.id === userId);
          if (playerIndex === -1) {
            ws.send(JSON.stringify({ type: 'error', message: '玩家不在房間中' }));
            return;
          }
          
          currentRoom.players[playerIndex].ready = true;
          currentRoom.players[playerIndex].station = data.station;
          
          // 通知房間內所有玩家
          broadcastToRoom(currentRoomId, {
            type: 'player_ready',
            playerId: userId,
            station: data.station
          });
          
          // 檢查是否所有人都準備好
          const allReady = currentRoom.players.length >= 2 && 
                          currentRoom.players.every(p => p.ready);
          
          if (allReady) {
            // 開始遊戲
            currentRoom.status = 'starting';
            
            // 倒計時5秒後開始遊戲
            broadcastToRoom(currentRoomId, {
              type: 'game_starting',
              countdown: 5
            });
            
            setTimeout(() => {
              startGame(currentRoomId);
            }, 5000);
          }
          
          break;
          
        case 'game_action':
          if (!userId || !currentRoomId) {
            ws.send(JSON.stringify({ type: 'error', message: '需要先加入房間' }));
            return;
          }
          
          // 處理遊戲操作
          handleGameAction(currentRoomId, userId, data.action, data.params);
          break;
          
        case 'chat_message':
          if (!userId || !currentRoomId) {
            ws.send(JSON.stringify({ type: 'error', message: '需要先加入房間' }));
            return;
          }
          
          // 處理聊天消息
          broadcastToRoom(currentRoomId, {
            type: 'chat_message',
            userId,
            username: data.username,
            message: data.message,
            timestamp: new Date().toISOString()
          });
          break;
      }
      
    } catch (error) {
      console.error('[COOK-GAME] 處理WebSocket消息錯誤:', error);
      ws.send(JSON.stringify({ type: 'error', message: '處理請求時出錯' }));
    }
  });
  
  // 連接關閉
  ws.on('close', () => {
    console.log('[COOK-GAME] WebSocket連接關閉');
    
    // 從活躍連接中移除
    activeConnections.delete(connectionId);
    
    // 如果在房間中，通知其他玩家
    if (userId && currentRoomId) {
      const room = gameRooms.get(currentRoomId);
      if (room) {
        // 從房間中移除玩家
        room.players = room.players.filter(p => p.id !== userId);
        
        // 如果房間空了，刪除房間
        if (room.players.length === 0) {
          gameRooms.delete(currentRoomId);
        } else {
          // 通知其他玩家
          broadcastToRoom(currentRoomId, {
            type: 'player_left',
            playerId: userId
          });
        }
      }
    }
  });
});

// 向房間內所有玩家廣播消息
function broadcastToRoom(roomId, message) {
  const room = gameRooms.get(roomId);
  if (!room) return;
  
  const messageStr = JSON.stringify(message);
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && room.players.some(p => p.id === client.userId)) {
      client.send(messageStr);
    }
  });
}

// 開始遊戲
function startGame(roomId) {
  const room = gameRooms.get(roomId);
  if (!room) return;
  
  room.status = 'playing';
  room.gameState = {
    startTime: new Date(),
    timeRemaining: 10 * 60, // 10分鐘
    orders: generateInitialOrders(room.difficulty),
    playerStates: {},
    ingredients: {},
    score: 0
  };
  
  // 初始化每位玩家的狀態
  room.players.forEach(player => {
    room.gameState.playerStates[player.id] = {
      station: player.station,
      currentAction: null,
      actionProgress: 0,
      holdingItem: null
    };
  });
  
  // 通知所有玩家遊戲開始
  broadcastToRoom(roomId, {
    type: 'game_started',
    gameState: room.gameState
  });
  
  // 開始遊戲循環
  startGameLoop(roomId);
}

// 遊戲循環
function startGameLoop(roomId) {
  const room = gameRooms.get(roomId);
  if (!room || room.status !== 'playing') return;
  
  const gameLoopInterval = setInterval(() => {
    // 更新遊戲狀態
    updateGameState(roomId);
    
    // 檢查遊戲是否結束
    if (room.gameState.timeRemaining <= 0) {
      clearInterval(gameLoopInterval);
      endGame(roomId);
    } else {
      // 廣播更新的狀態
      broadcastToRoom(roomId, {
        type: 'state_update',
        gameState: room.gameState
      });
    }
    
    // 減少剩餘時間
    room.gameState.timeRemaining--;
    
  }, 1000); // 每秒更新一次
}

// 更新遊戲狀態
function updateGameState(roomId) {
  const room = gameRooms.get(roomId);
  if (!room) return;
  
  // 更新玩家操作進度
  Object.keys(room.gameState.playerStates).forEach(playerId => {
    const playerState = room.gameState.playerStates[playerId];
    if (playerState.currentAction) {
      playerState.actionProgress += 10; // 增加進度
      
      // 檢查操作是否完成
      if (playerState.actionProgress >= 100) {
        completeAction(roomId, playerId);
      }
    }
  });
  
  // 檢查訂單是否過期
  room.gameState.orders = room.gameState.orders.filter(order => {
    if (order.timeRemaining <= 0) {
      // 通知訂單失敗
      broadcastToRoom(roomId, {
        type: 'order_failed',
        orderId: order.id
      });
      return false;
    }
    
    // 減少訂單剩餘時間
    order.timeRemaining--;
    return true;
  });
  
  // 如果訂單不足，生成新訂單
  if (room.gameState.orders.length < 3) {
    const newOrder = generateOrder(room.difficulty);
    room.gameState.orders.push(newOrder);
    
    // 通知新訂單
    broadcastToRoom(roomId, {
      type: 'new_order',
      order: newOrder
    });
  }
}

// 處理遊戲操作
function handleGameAction(roomId, playerId, action, params) {
  const room = gameRooms.get(roomId);
  if (!room || room.status !== 'playing') return;
  
  const playerState = room.gameState.playerStates[playerId];
  if (!playerState) return;
  
  // 如果玩家正在進行操作，不能開始新操作
  if (playerState.currentAction) return;
  
  // 根據操作類型處理
  switch (action) {
    case 'cut':
      // 檢查玩家是否在前處理站
      if (playerState.station !== 'cutting') return;
      
      // 檢查是否有可切的食材
      const ingredientId = params.ingredientId;
      if (!room.gameState.ingredients[ingredientId]) return;
      
      // 開始切食材操作
      playerState.currentAction = {
        type: 'cut',
        ingredientId,
        startTime: Date.now()
      };
      playerState.actionProgress = 0;
      
      // 通知房間內所有玩家
      broadcastToRoom(roomId, {
        type: 'action_started',
        playerId,
        action: 'cut',
        ingredientId
      });
      break;
      
    case 'cook':
      // 類似地處理烹飪操作
      break;
      
    case 'assemble':
      // 類似地處理組裝操作
      break;
      
    case 'serve':
      // 類似地處理上菜操作
      break;
      
    case 'pick':
      // 拿取食材
      break;
      
    case 'place':
      // 放置食材
      break;
      
    case 'pass':
      // 傳遞食材
      break;
  }
}

// 完成操作
function completeAction(roomId, playerId) {
  const room = gameRooms.get(roomId);
  if (!room) return;
  
  const playerState = room.gameState.playerStates[playerId];
  if (!playerState || !playerState.currentAction) return;
  
  // 根據不同操作類型處理結果
  switch (playerState.currentAction.type) {
    case 'cut':
      const ingredientId = playerState.currentAction.ingredientId;
      const ingredient = room.gameState.ingredients[ingredientId];
      
      if (ingredient) {
        // 將原食材轉換為切好的食材
        ingredient.state = 'cut';
        
        // 通知房間內所有玩家
        broadcastToRoom(roomId, {
          type: 'ingredient_updated',
          ingredientId,
          state: 'cut'
        });
      }
      break;
      
    // 其他操作類型的處理...
  }
  
  // 重置玩家操作狀態
  playerState.currentAction = null;
  playerState.actionProgress = 0;
  
  // 通知操作完成
  broadcastToRoom(roomId, {
    type: 'action_completed',
    playerId
  });
}

// 結束遊戲
function endGame(roomId) {
  const room = gameRooms.get(roomId);
  if (!room) return;
  
  room.status = 'ended';
  
  // 計算最終分數
  const finalScore = room.gameState.score;
  
  // 為每位玩家記錄遊戲結果
  room.players.forEach(async (player) => {
    try {
      // 更新玩家積分
      await pool.query(
        'UPDATE cook_users SET points = points + $1 WHERE user_id = $2',
        [Math.floor(finalScore / room.players.length), player.id]
      );
      
      // 記錄遊戲對局
      await pool.query(
        `INSERT INTO cook_game_sessions 
         (start_time, end_time, player_count, difficulty_level, status) 
         VALUES ($1, $2, $3, $4, $5) RETURNING session_id`,
        [room.gameState.startTime, new Date(), room.players.length, room.difficulty, 'completed']
      );
      
      // 其他遊戲結束處理...
    } catch (error) {
      console.error('[COOK-GAME] 記錄遊戲結果錯誤:', error);
    }
  });
  
  // 通知所有玩家遊戲結束
  broadcastToRoom(roomId, {
    type: 'game_ended',
    score: finalScore,
    playerScores: {} // 這裡可以添加每位玩家的個別分數
  });
  
  // 一段時間後清理房間
  setTimeout(() => {
    gameRooms.delete(roomId);
  }, 300000); // 5分鐘後清理
}

// 生成初始訂單
function generateInitialOrders(difficulty) {
  const count = difficulty === 'easy' ? 1 : difficulty === 'normal' ? 2 : 3;
  const orders = [];
  
  for (let i = 0; i < count; i++) {
    orders.push(generateOrder(difficulty));
  }
  
  return orders;
}

// 生成訂單
function generateOrder(difficulty) {
  // 這裡可以實現更複雜的訂單生成邏輯
  const recipes = [
    {
      id: 'burger',
      name: '基本漢堡',
      ingredients: ['bun', 'patty', 'lettuce'],
      difficulty: 'easy',
      timeLimit: 90
    },
    {
      id: 'cheese_burger',
      name: '起司漢堡',
      ingredients: ['bun', 'patty', 'cheese', 'lettuce'],
      difficulty: 'normal',
      timeLimit: 120
    },
    {
      id: 'deluxe_burger',
      name: '豪華漢堡',
      ingredients: ['bun', 'patty', 'cheese', 'lettuce', 'tomato', 'onion'],
      difficulty: 'hard',
      timeLimit: 180
    }
  ];
  
  // 根據難度選擇配方
  let availableRecipes = recipes;
  if (difficulty === 'easy') {
    availableRecipes = recipes.filter(r => r.difficulty === 'easy');
  } else if (difficulty === 'normal') {
    availableRecipes = recipes.filter(r => r.difficulty !== 'hard');
  }
  
  const recipe = availableRecipes[Math.floor(Math.random() * availableRecipes.length)];
  
  return {
    id: `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    recipeId: recipe.id,
    name: recipe.name,
    ingredients: recipe.ingredients,
    timeRemaining: recipe.timeLimit,
    createdAt: new Date()
  };
}

// 添加健康檢查路由
app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({ status: 'ok', service: 'cook-kitchen-rush', version: '1.0.0' });
});

// 修改前端路徑映射，確保使用cook-前綴的頁面可以正確載入
app.get('/cook-*.html', (req, res) => {
  const filename = req.path.substring(1);
  res.sendFile(path.join(__dirname, 'public', filename));
});

// 啟動服務器 - 使用不同端口以避免與主服務器衝突
const COOK_PORT = process.env.COOK_PORT || 3001;
server.listen(COOK_PORT, () => {
  console.log(`[COOK-GAME] 廚房急先鋒遊戲服務器運行在端口 ${COOK_PORT}`);
  console.log(`[COOK-GAME] API路徑前綴: ${API_PREFIX}`);
  console.log(`[COOK-GAME] WebSocket路徑: /cook-ws`);
});

// 導出遊戲房間狀態，供其他模塊使用
module.exports = {
  gameRooms,
  wss
}; 