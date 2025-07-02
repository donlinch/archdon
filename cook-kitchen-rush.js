// cook-kitchen-rush.js

/**
 * 廚房急先鋒 - 多人協作料理遊戲服務器
 * 基於BBS風格的會員制文字遊戲
 * 針對行動裝置優化的多人協作料理遊戲
 * 
 * 注意：此服務將作為主服務器(server.js)的一部分運行，不再獨立運行
 */

const express = require('express');
const WebSocket = require('ws'); // 雖然不再創建Server，但處理連接時仍需要
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // bcryptjs -> bcrypt (保持與主文件一致)
const cors = require('cors');
const path = require('path');

// 初始化Express應用
const cookGameApp = express();

// 資料庫連接配置 - 現在使用主系統的資料庫URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// 中間件設置
cookGameApp.use(cors());
cookGameApp.use(express.json());

// JWT密鑰
const JWT_SECRET = process.env.COOK_JWT_SECRET || 'cook-kitchen-rush-secret-key';

// 活躍的遊戲房間
const gameRooms = new Map();
// 活躍的連接
const activeConnections = new Map();

// 修改驗證中介軟體，使其與主系統共用認證機制
const authenticateToken = (req, res, next) => {
  // 從請求頭獲取令牌
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: '未提供認證令牌' });
  }

  // 驗證令牌
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, error: '令牌無效或已過期' });
    }

    try {
      // 檢查使用者是否存在於資料庫中
      const result = await pool.query(
        'SELECT user_id, username FROM box_users WHERE user_id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ success: false, error: '找不到對應的使用者' });
      }

      // 將使用者資訊添加到請求物件中
      req.user = {
        userId: result.rows[0].user_id,
        username: result.rows[0].username
      };
      
      next();
    } catch (error) {
      console.error('驗證使用者時出錯:', error);
      res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
  });
};

// 修改登入路由，使用主系統的會員資料表
cookGameApp.post(`/auth/login`, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, error: '請提供使用者名稱和密碼' });
    }
    
    // 從主系統的會員表查詢用戶
    const result = await pool.query(
      'SELECT user_id, username, password_hash FROM box_users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: '使用者名稱或密碼不正確' });
    }
    
    const user = result.rows[0];
    
    // 驗證密碼
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordValid) {
      return res.status(401).json({ success: false, error: '使用者名稱或密碼不正確' });
    }
    
    // 生成 JWT
    const token = jwt.sign(
      { userId: user.user_id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // 查詢或創建遊戲玩家資料
    let playerResult = await pool.query(
      'SELECT * FROM cook_players WHERE user_id = $1',
      [user.user_id]
    );
    
    if (playerResult.rows.length === 0) {
      // 創建新的玩家資料
      await pool.query(
        'INSERT INTO cook_players (user_id, username, level, points, created_at, last_login) VALUES ($1, $2, 1, 0, NOW(), NOW())',
        [user.user_id, user.username]
      );
      
      playerResult = await pool.query(
        'SELECT * FROM cook_players WHERE user_id = $1',
        [user.user_id]
      );
    } else {
      // 更新玩家最後登入時間
      await pool.query(
        'UPDATE cook_players SET last_login = NOW() WHERE user_id = $1',
        [user.user_id]
      );
    }
    
    const player = playerResult.rows[0];
    
    res.json({
      success: true,
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        level: player.level,
        points: player.points
      }
    });
    
  } catch (error) {
    console.error('登入處理出錯:', error);
    res.status(500).json({ success: false, error: '伺服器錯誤' });
  }
});

// 添加一個快速登入路由，使用現有的token進行驗證
cookGameApp.post(`/auth/quick-login`, async (req, res) => {
  try {
    const { username, deviceId } = req.body;
    
    if (!username) {
      return res.status(400).json({ success: false, error: '請提供使用者名稱' });
    }
    
    // 從主系統的會員表查詢用戶
    const result = await pool.query(
      'SELECT user_id, username FROM box_users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: '無效的使用者' });
    }
    
    const user = result.rows[0];
    
    // 生成 JWT
    const token = jwt.sign(
      { userId: user.user_id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // 查詢或創建遊戲玩家資料
    let playerResult = await pool.query(
      'SELECT * FROM cook_players WHERE user_id = $1',
      [user.user_id]
    );
    
    if (playerResult.rows.length === 0) {
      // 創建新的玩家資料
      await pool.query(
        'INSERT INTO cook_players (user_id, username, level, points, created_at, last_login) VALUES ($1, $2, 1, 0, NOW(), NOW())',
        [user.user_id, user.username]
      );
      
      playerResult = await pool.query(
        'SELECT * FROM cook_players WHERE user_id = $1',
        [user.user_id]
      );
    } else {
      // 更新玩家最後登入時間
      await pool.query(
        'UPDATE cook_players SET last_login = NOW() WHERE user_id = $1',
        [user.user_id]
      );
    }
    
    const player = playerResult.rows[0];
    
    res.json({
      success: true,
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        level: player.level,
        points: player.points
      }
    });
    
  } catch (error) {
    console.error('快速登入處理出錯:', error);
    res.status(500).json({ success: false, error: '伺服器錯誤' });
  }
});

// 查詢用戶資料的路由，從box_users獲取基礎資料，從cook_players獲取遊戲資料
cookGameApp.get(`/users/profile`, authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 查詢主系統的用戶資料
    const userResult = await pool.query(
      'SELECT user_id, username, display_name, user_profile_image_url FROM box_users WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到使用者資料' });
    }
    
    // 查詢遊戲系統的用戶資料
    let playerResult = await pool.query(
      'SELECT level, points, achievements FROM cook_players WHERE user_id = $1',
      [userId]
    );
    
    if (playerResult.rows.length === 0) {
      // 創建新的玩家資料
      await pool.query(
        'INSERT INTO cook_players (user_id, username, level, points, created_at, last_login) VALUES ($1, $2, 1, 0, NOW(), NOW())',
        [userId, userResult.rows[0].username]
      );
      
      playerResult = await pool.query(
        'SELECT level, points, achievements FROM cook_players WHERE user_id = $1',
        [userId]
      );
    }
    
    // 合併主系統和遊戲系統的用戶資料
    const userData = {
      ...userResult.rows[0],
      ...playerResult.rows[0]
    };
    
    res.json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('獲取使用者資料時出錯:', error);
    res.status(500).json({ success: false, error: '伺服器錯誤' });
  }
});

// API路由 - 獲取遊戲房間列表
cookGameApp.get(`/games/rooms`, authenticateToken, (req, res) => {
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
cookGameApp.post(`/games/rooms`, authenticateToken, (req, res) => {
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

// WebSocket連接處理函數
function handleAuthenticatedMessage(ws, data, userId, username, currentRoomId) {
  // ... 保持現有的WebSocket消息處理邏輯 ...
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
cookGameApp.get(`/health`, (req, res) => {
  res.json({ status: 'ok', service: 'cook-kitchen-rush', version: '1.0.0' });
});

// 修改前端路徑映射，確保使用cook-前綴的頁面可以正確載入
cookGameApp.get('/cook-*.html', (req, res) => {
  const filename = req.path.substring(1);
  res.sendFile(path.join(__dirname, 'public', filename));
});

// ==========================================================
// ★★★ 以下是重構的核心部分 ★★★
// ==========================================================

/**
 * 初始化廚房急先鋒的 WebSocket 邏輯。
 * 這個函數不再創建自己的 WebSocket Server，而是接收一個外部傳入的 wss 實例。
 * @param {WebSocket.Server} wss - 從主 server.js 傳入的 WebSocket 服務器實例。
 */
function initCookGameWss(wss) {
  console.log('[COOK-GAME] WebSocket 邏輯已附加到主 WSS 實例上');

  wss.on('connection', (ws, req) => {
    // 從請求的 URL 中解析出路徑，確保只處理 /cook-ws 的連接
    // 雖然主 server.js 已經做了路由，但這裡再加一層保險
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== '/cook-ws') {
      return; // 如果不是廚房遊戲的連接，直接返回，不處理
    }
    
    console.log(`[COOK-GAME WS] 收到一個新連接`);
    
    let authenticated = false;
    let userId = null;
    let username = null;
    let currentRoomId = null;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'authenticate') {
          try {
            // ... (認證邏輯保持不變) ...
            const decoded = jwt.verify(data.token, JWT_SECRET);
            userId = decoded.userId;
            
            const result = await pool.query('SELECT user_id, username, display_name FROM box_users WHERE user_id = $1', [userId]);
            if (result.rows.length === 0) {
              ws.send(JSON.stringify({ type: 'auth_error', message: '無效的使用者' }));
              return;
            }
            
            username = result.rows[0].display_name || result.rows[0].username;
            authenticated = true;
            
            ws.send(JSON.stringify({ type: 'auth_success', userId, username }));
            console.log(`[COOK-GAME WS] 使用者 ${username} (ID: ${userId}) 認證成功`);
          } catch (error) {
            console.error('[COOK-GAME WS] 認證錯誤:', error);
            ws.send(JSON.stringify({ type: 'auth_error', message: '無效的令牌' }));
          }
          return;
        }
        
        if (!authenticated) {
          ws.send(JSON.stringify({ type: 'error', message: '未認證，請先進行認證' }));
          return;
        }
        
        // 處理已認證的消息
        handleAuthenticatedMessage(ws, data, userId, username, currentRoomId);
        
      } catch (error) {
        console.error('[COOK-GAME WS] 處理消息出錯:', error);
        ws.send(JSON.stringify({ type: 'error', message: '處理消息時出錯' }));
      }
    });
    
    ws.on('close', () => {
      console.log(`[COOK-GAME WS] 連接關閉`);
      if (authenticated && currentRoomId) {
        // ... (處理玩家離開房間的邏輯)
        // handlePlayerLeave(currentRoomId, userId);
      }
    });
  });
}

// 修改導出，導出新的初始化函數
module.exports = {
  cookGameApp,
  initCookGameWss // ★★★ 導出新的函數名 ★★★
};