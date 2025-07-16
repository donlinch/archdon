// youtube-chat-server.js - 獨立的 YouTube 聊天 WebSocket 伺服器
require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');

// 創建 HTTP 伺服器
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('YouTube Chat WebSocket Server');
});

// 創建 WebSocket 伺服器
const wss = new WebSocket.Server({ server });

// 存儲所有連接的客戶端
const clients = new Set();

// 處理 WebSocket 連接
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[YouTube Chat] 新的客戶端已連接！IP: ${ip}`);
  
  // 添加到客戶端集合
  clients.add(ws);
  
  // 發送歡迎訊息
  ws.send(JSON.stringify({
    type: 'welcome',
    message: '已連接到 YouTube 聊天 WebSocket 伺服器',
    timestamp: new Date().getTime()
  }));
  
  // 處理訊息
  ws.on('message', (message) => {
    try {
      console.log(`[YouTube Chat] 收到訊息: ${message}`);
      const data = JSON.parse(message);
      
      // 根據訊息類型處理
      switch (data.type) {
        case 'chat_message':
          // 廣播訊息給所有客戶端
          broadcastMessage({
            type: 'chat_message',
            content: data.content,
            sender: data.sender || 'YouTube Bot',
            timestamp: new Date().getTime()
          });
          break;
          
        default:
          // 回應確認
          ws.send(JSON.stringify({
            type: 'ack',
            originalType: data.type,
            message: '訊息已收到',
            timestamp: new Date().getTime()
          }));
      }
    } catch (error) {
      console.error('[YouTube Chat] 處理訊息時出錯:', error);
    }
  });
  
  // 處理連接關閉
  ws.on('close', () => {
    console.log('[YouTube Chat] 客戶端連接已關閉');
    clients.delete(ws);
  });
  
  // 處理錯誤
  ws.on('error', (error) => {
    console.error('[YouTube Chat] WebSocket 錯誤:', error);
    clients.delete(ws);
  });
});

// 廣播訊息給所有客戶端
function broadcastMessage(message) {
  const messageStr = JSON.stringify(message);
  console.log(`[YouTube Chat] 廣播訊息: ${messageStr}`);
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// 設置伺服器端口
const PORT = process.env.YOUTUBE_CHAT_PORT || 9001;
server.listen(PORT, () => {
  console.log(`[YouTube Chat] WebSocket 伺服器已啟動，監聽端口 ${PORT}`);
  console.log(`[YouTube Chat] WebSocket URL: ws://localhost:${PORT}`);
});

// 處理程序終止
process.on('SIGINT', () => {
  console.log('[YouTube Chat] 伺服器關閉中...');
  
  // 關閉所有連接
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close(1000, '伺服器關閉');
    }
  });
  
  // 關閉伺服器
  server.close(() => {
    console.log('[YouTube Chat] 伺服器已關閉');
    process.exit(0);
  });
});