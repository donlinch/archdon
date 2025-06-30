// chatResponder.js - YouTube 聊天室自動回覆模組
const axios = require('axios');

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
  }

  // 回覆確認訊息
  async sendConfirmation(liveChatId, userName) {
    if (!this.isEnabled) return false;
    
    const message = this.responseTemplates.confirmation.replace('{userName}', userName);
    return await this.sendChatMessage(liveChatId, message);
  }

  // 回覆已在名單中訊息
  async sendDuplicateNotice(liveChatId, userName) {
    if (!this.isEnabled) return false;
    
    const message = this.responseTemplates.duplicate.replace('{userName}', userName);
    return await this.sendChatMessage(liveChatId, message);
  }

  // 發送中獎通知
  async sendWinnerAnnouncement(liveChatId, userName) {
    if (!this.isEnabled) return false;
    
    const message = this.responseTemplates.winner.replace('{userName}', userName);
    return await this.sendChatMessage(liveChatId, message);
  }

  // 發送倒數計時通知
  async sendCountdownNotice(liveChatId, minutes, keyword) {
    if (!this.isEnabled) return false;
    
    const message = this.responseTemplates.countdown
      .replace('{minutes}', minutes)
      .replace('{keyword}', keyword);
    return await this.sendChatMessage(liveChatId, message);
  }

  // 發送最後一分鐘通知
  async sendLastMinuteNotice(liveChatId) {
    if (!this.isEnabled) return false;
    
    const message = this.responseTemplates.lastMinute;
    return await this.sendChatMessage(liveChatId, message);
  }

  // 發送自訂訊息
  async sendCustomMessage(liveChatId, message) {
    if (!this.isEnabled) return false;
    
    return await this.sendChatMessage(liveChatId, message);
  }

  // 實際發送訊息的方法
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
}

module.exports = ChatResponder; 