// dbClient.js - 封裝 PostgreSQL 操作的模組

const { Pool } = require('pg');

// 創建連接池
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * 獲取資料庫連接
 * @returns {Promise<import('pg').PoolClient>} 資料庫客戶端
 */
async function getClient() {
    return await pool.connect();
}

/**
 * 創建一個新的遊戲房間
 * @param {string} roomId 房間 ID
 * @param {string} roomName 房間名稱
 * @param {number} maxPlayers 最大玩家數
 * @returns {Promise<Object>} 創建的房間資訊
 */
async function createRoom(roomId, roomName, maxPlayers = 5) {
    const gameState = {
        mapLoopSize: 10,
        maxPlayers: parseInt(maxPlayers),
        players: {},
        gameStarted: false
    };

    const query = `
        INSERT INTO game_rooms(room_id, room_name, last_active, game_state) 
        VALUES($1, $2, NOW(), $3)
        RETURNING room_id, room_name, created_at, last_active, game_state
    `;

    const { rows } = await pool.query(query, [roomId, roomName, JSON.stringify(gameState)]);
    return rows[0];
}

/**
 * 獲取房間信息
 * @param {string} roomId 房間 ID
 * @returns {Promise<Object|null>} 房間信息，如果不存在則返回 null
 */
async function getRoom(roomId) {
    const query = 'SELECT * FROM game_rooms WHERE room_id = $1';
    const { rows } = await pool.query(query, [roomId]);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * 獲取活躍房間列表
 * @param {number} minutes 最後活動在幾分鐘內的房間視為活躍
 * @returns {Promise<Array>} 活躍房間列表
 */
async function getActiveRooms(minutes = 30) {
    const query = `
        SELECT room_id, room_name, created_at, last_active, game_state
        FROM game_rooms
        WHERE last_active > NOW() - INTERVAL '${minutes} minutes'
        ORDER BY last_active DESC
    `;
    const { rows } = await pool.query(query);
    return rows;
}

/**
 * 更新房間的遊戲狀態
 * @param {string} roomId 房間 ID
 * @param {Object} gameState 新的遊戲狀態
 * @returns {Promise<Object|null>} 更新後的房間信息
 */
async function updateRoomState(roomId, gameState) {
    const query = `
        UPDATE game_rooms 
        SET game_state = $1, last_active = NOW() 
        WHERE room_id = $2
        RETURNING room_id, room_name, game_state
    `;
    const { rows } = await pool.query(query, [JSON.stringify(gameState), roomId]);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * 添加玩家到房間
 * @param {string} roomId 房間 ID
 * @param {string} playerId 玩家 ID
 * @param {string} playerName 玩家名稱
 * @returns {Promise<Object|null>} 更新後的房間信息
 */
async function addPlayerToRoom(roomId, playerId, playerName) {
    // 首先獲取當前房間狀態
    const room = await getRoom(roomId);
    if (!room) return null;

    const gameState = room.game_state;
    
    // 檢查人數是否已滿
    if (Object.keys(gameState.players).length >= gameState.maxPlayers) {
        throw new Error('房間已滿');
    }
    
    // 檢查名稱是否重複
    for (const pid in gameState.players) {
        if (gameState.players[pid].name === playerName) {
            throw new Error('玩家名稱已被使用');
        }
    }
    
    // 添加玩家
    gameState.players[playerId] = {
        name: playerName,
        position: 0 // 初始位置
    };
    
    // 更新房間狀態
    return await updateRoomState(roomId, gameState);
}

/**
 * 從房間中移除玩家
 * @param {string} roomId 房間 ID
 * @param {string} playerId 玩家 ID
 * @returns {Promise<Object|null>} 更新後的房間信息
 */
async function removePlayerFromRoom(roomId, playerId) {
    // 首先獲取當前房間狀態
    const room = await getRoom(roomId);
    if (!room) return null;

    const gameState = room.game_state;
    
    // 檢查玩家是否存在
    if (!gameState.players[playerId]) {
        return room; // 玩家不存在，直接返回原來的房間
    }
    
    // 移除玩家
    delete gameState.players[playerId];
    
    // 更新房間狀態
    return await updateRoomState(roomId, gameState);
}

/**
 * 更新玩家位置
 * @param {string} roomId 房間 ID
 * @param {string} playerId 玩家 ID
 * @param {number} newPosition 新位置
 * @returns {Promise<Object|null>} 更新後的房間信息
 */
async function updatePlayerPosition(roomId, playerId, newPosition) {
    // 首先獲取當前房間狀態
    const room = await getRoom(roomId);
    if (!room) return null;

    const gameState = room.game_state;
    
    // 檢查玩家是否存在
    if (!gameState.players[playerId]) {
        throw new Error('玩家不存在');
    }
    
    // 更新位置
    gameState.players[playerId].position = newPosition;
    
    // 更新房間狀態
    return await updateRoomState(roomId, gameState);
}

/**
 * 清理不活躍的房間
 * @param {number} hours 幾小時前的房間視為不活躍
 * @returns {Promise<number>} 清理的房間數量
 */
async function cleanInactiveRooms(hours = 1) {
    const query = `
        DELETE FROM game_rooms 
        WHERE last_active < NOW() - INTERVAL '${hours} hours'
    `;
    const result = await pool.query(query);
    return result.rowCount;
}

/**
 * 關閉所有資料庫連接
 */
async function close() {
    await pool.end();
}

module.exports = {
    getClient,
    createRoom,
    getRoom,
    getActiveRooms,
    updateRoomState,
    addPlayerToRoom,
    removePlayerFromRoom,
    updatePlayerPosition,
    cleanInactiveRooms,
    close
};