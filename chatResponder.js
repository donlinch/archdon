// chatResponder.js - YouTube 聊天室自動回覆模組
const axios = require('axios');
const WebSocket = require('ws'); // 添加 WebSocket 支援

class ChatResponder {
  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY;
    this.oauthToken = process.env.YOUTUBE_OAUTH_TOKEN;
    this.isEnabled = process.env.ENABLE_CHAT_RESPONSES === 'true';
    this.responseTemplates = {
      confirmation: '@{userName} 已成功參與抽獎！🎉',
      duplicate: '@{userName} 您已在抽獎名單中囉！😊',
      winner: '🎊 恭喜 @{userName} 獲得抽獎！🎊',
      countdown: '📢 抽獎倒數 {minutes} 分鐘！還沒參加的朋友請輸入「{keyword}」參加！',
      lastMinute: '⏰ 抽獎即將結束！最後 1 分鐘！'
    };
    
    // WebSocket 連接
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000; // 5 秒
  }

  // 連接到 WebSocket 伺服器
  connect(serverUrl = 'ws://localhost:9001') {
    if (this.ws) {
      this.disconnect();
    }

    console.log(`[ChatResponder] 嘗試連接到 WebSocket 伺服器: ${serverUrl}`);
    
    try {
      this.ws = new WebSocket(serverUrl);
      
      this.ws.on('open', () => {
        console.log('[ChatResponder] WebSocket 連接成功！');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // 發送認證訊息 (如果需要)
        this.ws.send(JSON.stringify({
          type: 'auth',
          token: this.oauthToken || 'youtube-bot-token',
          userId: 'youtube-bot',
          username: 'YouTube Bot'
        }));
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log('[ChatResponder] 收到 WebSocket 訊息:', message);
        } catch (error) {
          console.error('[ChatResponder] 解析 WebSocket 訊息失敗:', error);
        }
      });
      
      this.ws.on('close', (code, reason) => {
        console.log(`[ChatResponder] WebSocket 連接關閉。代碼: ${code}, 原因: ${reason}`);
        this.isConnected = false;
        this.handleReconnect();
      });
      
      this.ws.on('error', (error) => {
        console.error('[ChatResponder] WebSocket 錯誤:', error);
        this.isConnected = false;
      });
      
    } catch (error) {
      console.error('[ChatResponder] 建立 WebSocket 連接時出錯:', error);
      this.handleReconnect();
    }
    
    return this;
  }
  
  // 處理重新連接
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[ChatResponder] 嘗試重新連接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.error('[ChatResponder] 達到最大重連次數，停止嘗試連接。');
    }
  }
  
  // 斷開 WebSocket 連接
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      console.log('[ChatResponder] WebSocket 連接已斷開。');
    }
    return this;
  }

  // 透過 WebSocket 發送訊息
  sendViaWebSocket(message) {
    if (!this.isConnected || !this.ws) {
      console.warn('[ChatResponder] 無法發送 WebSocket 訊息：未連接');
      return false;
    }
    
    try {
      this.ws.send(JSON.stringify({
        type: 'chat_message',
        content: message
      }));
      console.log('[ChatResponder] WebSocket 訊息發送成功:', message);
      return true;
    } catch (error) {
      console.error('[ChatResponder] 發送 WebSocket 訊息時出錯:', error);
      return false;
    }
  }

  // 回覆確認訊息
  async sendConfirmation(liveChatId, userName) {
    if (!this.isEnabled) return false;
    
    const message = this.responseTemplates.confirmation.replace('{userName}', userName);
    
    // 嘗試透過 WebSocket 發送
    if (this.isConnected) {
      return this.sendViaWebSocket(message);
    }
    
    // 如果 WebSocket 未連接，則使用 HTTP API
    return await this.sendChatMessage(liveChatId, message);
  }

  // 回覆已在名單中訊息
  async sendDuplicateNotice(liveChatId, userName) {
    if (!this.isEnabled) return false;
    
    const message = this.responseTemplates.duplicate.replace('{userName}', userName);
    
    // 嘗試透過 WebSocket 發送
    if (this.isConnected) {
      return this.sendViaWebSocket(message);
    }
    
    // 如果 WebSocket 未連接，則使用 HTTP API
    return await this.sendChatMessage(liveChatId, message);
  }

  // 發送中獎通知
  async sendWinnerAnnouncement(liveChatId, userName) {
    if (!this.isEnabled) return false;
    
    const message = this.responseTemplates.winner.replace('{userName}', userName);
    
    // 嘗試透過 WebSocket 發送
    if (this.isConnected) {
      return this.sendViaWebSocket(message);
    }
    
    // 如果 WebSocket 未連接，則使用 HTTP API
    return await this.sendChatMessage(liveChatId, message);
  }

  // 發送倒數計時通知
  async sendCountdownNotice(liveChatId, minutes, keyword) {
    if (!this.isEnabled) return false;
    
    const message = this.responseTemplates.countdown
      .replace('{minutes}', minutes)
      .replace('{keyword}', keyword);
    
    // 嘗試透過 WebSocket 發送
    if (this.isConnected) {
      return this.sendViaWebSocket(message);
    }
    
    // 如果 WebSocket 未連接，則使用 HTTP API
    return await this.sendChatMessage(liveChatId, message);
  }

  // 發送最後一分鐘通知
  async sendLastMinuteNotice(liveChatId) {
    if (!this.isEnabled) return false;
    
    const message = this.responseTemplates.lastMinute;
    
    // 嘗試透過 WebSocket 發送
    if (this.isConnected) {
      return this.sendViaWebSocket(message);
    }
    
    // 如果 WebSocket 未連接，則使用 HTTP API
    return await this.sendChatMessage(liveChatId, message);
  }

  // 發送自訂訊息
  async sendCustomMessage(liveChatId, message) {
    if (!this.isEnabled) return false;
    
    // 嘗試透過 WebSocket 發送
    if (this.isConnected) {
      return this.sendViaWebSocket(message);
    }
    
    // 如果 WebSocket 未連接，則使用 HTTP API
    return await this.sendChatMessage(liveChatId, message);
  }

  // 實際發送訊息的方法 (HTTP API)
  async sendChatMessage(liveChatId, message) {
    if (!this.oauthToken) {
      console.warn('無法發送聊天訊息：缺少 YouTube OAuth Token');
      return false;
    }

    try {
      // 注意：這裡需要 OAuth2 授權，不只是 API Key
      const response = await axios.post(
        'https://www.googleapis.com/youtube/v3/liveChat/messages',
        {
          snippet: {
            liveChatId: liveChatId,
            type: 'textMessageEvent',
            textMessageDetails: {
              messageText: message
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.oauthToken}`
          }
        }
      );

      console.log('聊天訊息發送成功:', message);
      return true;
    } catch (error) {
      console.error('發送聊天訊息時出錯:', error.response?.data || error.message);
      return false;
    }
  }

  // 檢查是否啟用聊天回應
  isResponseEnabled() {
    return this.isEnabled;
  }

  // 設置啟用狀態
  setEnabled(enabled) {
    this.isEnabled = enabled;
    return this.isEnabled;
  }

  // 更新回應模板
  updateTemplates(templates) {
    if (templates && typeof templates === 'object') {
      this.responseTemplates = {
        ...this.responseTemplates,
        ...templates
      };
      return true;
    }
    return false;
  }

  // 獲取當前模板
  getTemplates() {
    return { ...this.responseTemplates };
  }
  
  // 檢查 WebSocket 連接狀態
  isWebSocketConnected() {
    return this.isConnected;
  }
}

module.exports = ChatResponder;