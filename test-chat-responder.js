// test-chat-responder.js - 測試 ChatResponder WebSocket 連接
require('dotenv').config();
const ChatResponder = require('./chatResponder');
const http = require('http');
const { exec } = require('child_process');

// 創建 ChatResponder 實例
const chatResponder = new ChatResponder();

// 設置連接參數 - 嘗試多個端口
const ports = [3000, 9000, 8080, 5000];
let currentPortIndex = 0;
let connectionSuccessful = false;
let successPort = null;

// 檢查伺服器是否運行
console.log('[Test] 檢查伺服器狀態...');
exec('ps aux | grep node | grep server.js', (error, stdout, stderr) => {
  if (stdout) {
    console.log('[Test] 找到運行中的 Node.js 伺服器進程:');
    console.log(stdout);
  } else {
    console.warn('[Test] 警告: 未找到運行中的 server.js 進程，請確保伺服器已啟動');
  }
  
  // 檢查端口
  console.log('[Test] 檢查端口狀態...');
  ports.forEach(port => {
    checkPort(port);
  });
  
  // 開始嘗試連接
  setTimeout(() => {
    tryNextPort();
  }, 1000);
});

// 檢查端口是否開放
function checkPort(port) {
  const options = {
    host: 'localhost',
    port: port,
    timeout: 1000
  };
  
  const req = http.get(options, (res) => {
    console.log(`[Test] 端口 ${port} 已開放，HTTP 狀態碼: ${res.statusCode}`);
    req.destroy();
  }).on('error', (err) => {
    console.log(`[Test] 端口 ${port} 未開放或拒絕連接: ${err.message}`);
  });
}

function tryNextPort() {
  if (currentPortIndex >= ports.length) {
    console.error('[Test] 所有端口嘗試失敗，無法連接到 WebSocket 伺服器');
    console.log('[Test] 請確保伺服器正在運行，並且 WebSocket 服務已正確配置');
    console.log('[Test] 嘗試以下解決方案:');
    console.log('1. 啟動伺服器: node server.js');
    console.log('2. 檢查 server.js 中的 WebSocket 配置');
    console.log('3. 確認 WebSocket 路徑是否為 /chat');
    process.exit(1);
    return;
  }
  
  const PORT = ports[currentPortIndex];
  // 嘗試不同的路徑
  const paths = ['/chat', '/ws', '/socket', '/'];
  const pathIndex = 0;
  tryPath(PORT, paths, pathIndex);
}

function tryPath(port, paths, pathIndex) {
  if (pathIndex >= paths.length) {
    // 所有路徑都嘗試過了，嘗試下一個端口
    currentPortIndex++;
    setTimeout(tryNextPort, 500);
    return;
  }
  
  const path = paths[pathIndex];
  const WS_URL = `ws://localhost:${port}${path}?token=test-token&userId=youtube-bot&username=YouTube%20Bot`;
  
  console.log(`[Test] 嘗試連接到 WebSocket 伺服器: ${WS_URL}`);
  
  // 設置一個事件處理器來檢測連接失敗
  const errorHandler = () => {
    console.log(`[Test] 端口 ${port} 路徑 ${path} 連接失敗，嘗試下一個配置...`);
    // 嘗試下一個路徑
    setTimeout(() => {
      tryPath(port, paths, pathIndex + 1);
    }, 500);
  };
  
  // 設置一個事件處理器來檢測連接成功
  const connectHandler = () => {
    console.log(`[Test] 成功連接到 WebSocket 伺服器！端口: ${port}, 路徑: ${path}`);
    connectionSuccessful = true;
    successPort = port;
    chatResponder.ws.removeListener('error', errorHandler);
    
    // 連接成功後立即測試
    testConnection();
  };
  
  // 連接到 WebSocket 伺服器
  chatResponder.connect(WS_URL);
  
  // 添加一次性事件處理器
  if (chatResponder.ws) {
    chatResponder.ws.once('error', errorHandler);
    chatResponder.ws.once('open', connectHandler);
  } else {
    console.error('[Test] WebSocket 對象創建失敗');
    errorHandler();
  }
}

// 測試連接
function testConnection() {
  if (chatResponder.isWebSocketConnected()) {
    console.log('[Test] WebSocket 連接成功！');
    
    // 發送測試訊息
    chatResponder.sendViaWebSocket('這是一條測試訊息，來自 YouTube Bot');
    
    // 測試其他方法
    chatResponder.sendConfirmation(null, '測試用戶');
    
    console.log('[Test] 測試訊息已發送');
    
    // 顯示成功信息和使用說明
    console.log('\n[Test] ✅ 連接測試成功！');
    console.log(`[Test] 請在你的 ChatResponder 實例中使用以下連接 URL:`);
    console.log(`chatResponder.connect('ws://localhost:${successPort}/chat?token=your-token&userId=youtube-bot&username=YouTube%20Bot');`);
    
    // 5 秒後斷開連接
    setTimeout(() => {
      console.log('[Test] 測試完成，斷開連接');
      chatResponder.disconnect();
      process.exit(0);
    }, 5000);
  } else {
    console.error('[Test] WebSocket 連接失敗！');
    // 繼續嘗試下一個配置
    currentPortIndex++;
    setTimeout(tryNextPort, 500);
  }
}

// 處理程序終止
process.on('SIGINT', () => {
  console.log('[Test] 程序被中斷，斷開連接');
  chatResponder.disconnect();
  process.exit(0);
});