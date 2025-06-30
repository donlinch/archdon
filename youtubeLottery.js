// youtubeLottery.js - YouTube 直播抽獎系統核心模組
const axios = require('axios');
const NodeCache = require('node-cache');

class YoutubeLottery {
  constructor(pool) {
    this.pool = pool; // PostgreSQL 連接池
    this.participants = new Map(); // 存儲當前參與者 {channelId: {displayName, profileImageUrl}}
    this.videoId = null; // 當前監控的直播ID
    this.keyword = null; // 抽獎關鍵字
    this.apiRateLimit = 10; // 預設 API 請求間隔（秒）
    this.chatPollingInterval = null; // 輪詢計時器
    this.pollingPageToken = null; // YouTube API 分頁標記
    this.cache = new NodeCache({ stdTTL: 600 }); // 10分鐘快取
    this.apiKey = process.env.YOUTUBE_API_KEY;
    this.webSocketServer = null; // WebSocket 伺服器實例，將由外部設置
  }

  // 設置 WebSocket 伺服器
  setWebSocketServer(wss) {
    this.webSocketServer = wss;
  }

  // 設置監控的直播
  async setTargetVideo(videoId, keyword, apiRateLimit = 10) {
    if (!this.apiKey) {
      throw new Error('YouTube API 金鑰未配置');
    }

    // 停止當前監控
    if (this.chatPollingInterval) {
      clearInterval(this.chatPollingInterval);
      this.chatPollingInterval = null;
    }

    // 重設狀態
    this.videoId = videoId;
    this.keyword = keyword;
    this.apiRateLimit = parseInt(apiRateLimit, 10);
    this.participants.clear();
    this.pollingPageToken = null;

    // 驗證直播存在
    try {
      const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
        params: {
          part: 'snippet,liveStreamingDetails',
          id: videoId,
          key: this.apiKey
        }
      });

      if (response.data.items.length === 0) {
        throw new Error('找不到指定的影片');
      }

      const video = response.data.items[0];
      if (!video.liveStreamingDetails || !video.liveStreamingDetails.activeLiveChatId) {
        throw new Error('指定的影片不是直播或沒有啟用聊天室');
      }

      // 開始輪詢聊天室
      this.startChatPolling(video.liveStreamingDetails.activeLiveChatId);
      return { success: true, videoTitle: video.snippet.title };
    } catch (error) {
      console.error('設置監控直播時出錯:', error);
      throw new Error(`設置監控直播失敗: ${error.message}`);
    }
  }

  // 開始輪詢聊天室
  startChatPolling(liveChatId) {
    this.chatPollingInterval = setInterval(async () => {
      try {
        await this.fetchChatMessages(liveChatId);
      } catch (error) {
        console.error('輪詢聊天室時出錯:', error);
        // 如果是配額耗盡，可能需要臨時增加間隔或暫停
        if (error.response && error.response.status === 403) {
          console.warn('可能達到 API 配額限制，暫時增加輪詢間隔');
          clearInterval(this.chatPollingInterval);
          setTimeout(() => this.startChatPolling(liveChatId), this.apiRateLimit * 2000);
        }
      }
    }, this.apiRateLimit * 1000);
  }

  // 獲取聊天訊息
  async fetchChatMessages(liveChatId) {
    const params = {
      part: 'snippet,authorDetails',
      liveChatId: liveChatId,
      maxResults: 200,
      key: this.apiKey
    };

    if (this.pollingPageToken) {
      params.pageToken = this.pollingPageToken;
    }

    const response = await axios.get('https://www.googleapis.com/youtube/v3/liveChat/messages', { params });
    const { items, nextPageToken, pollingIntervalMillis } = response.data;

    this.pollingPageToken = nextPageToken;

    // 處理訊息
    for (const message of items) {
      await this.processMessage(message);
    }

    // 廣播更新
    this.broadcastParticipantsUpdate();
  }

  // 處理單條訊息
  async processMessage(message) {
    if (message.snippet.type !== 'textMessageEvent') return;

    const messageText = message.snippet.displayMessage;
    const { channelId, displayName, profileImageUrl } = message.authorDetails;

    // 檢查是否包含關鍵字
    if (this.keyword && messageText.includes(this.keyword)) {
      // 添加到參與者列表
      if (!this.participants.has(channelId)) {
        this.participants.set(channelId, {
          displayName,
          profileImageUrl,
          joinTime: new Date()
        });

        // 更新用戶畫像資料
        try {
          await this.updateUserProfile(channelId, displayName, profileImageUrl);
        } catch (error) {
          console.error('更新用戶畫像時出錯:', error);
        }

        // 發送確認訊息
        if (process.env.ENABLE_CHAT_RESPONSES === 'true') {
          await this.sendChatResponse(channelId, displayName);
        }
      }
    }
  }

  // 更新用戶畫像資料
  async updateUserProfile(channelId, displayName, profileImageUrl) {
    try {
      // 首先檢查用戶是否存在
      const checkResult = await this.pool.query(
        'SELECT * FROM user_profiles WHERE user_channel_id = $1',
        [channelId]
      );

      const currentDate = new Date();

      if (checkResult.rows.length === 0) {
        // 新用戶 - 插入記錄
        await this.pool.query(
          `INSERT INTO user_profiles 
           (user_channel_id, display_name, profile_image_url, total_participations, 
            first_participation_date, last_participation_date) 
           VALUES ($1, $2, $3, 1, $4, $5)`,
          [channelId, displayName, profileImageUrl, currentDate, currentDate]
        );
      } else {
        // 更新現有用戶
        const user = checkResult.rows[0];
        const newParticipationCount = user.total_participations + 1;
        
        // 計算參與頻率 (0-5.00 範圍)
        const daysSinceFirstParticipation = Math.max(1, Math.floor(
          (currentDate - new Date(user.first_participation_date)) / (1000 * 60 * 60 * 24)
        ));
        
        const participationFrequency = Math.min(5, 
          (newParticipationCount / daysSinceFirstParticipation) * 10
        ).toFixed(2);
        
        await this.pool.query(
          `UPDATE user_profiles 
           SET display_name = $1, 
               profile_image_url = $2, 
               total_participations = $3, 
               last_participation_date = $4,
               participation_frequency = $5,
               updated_at = NOW()
           WHERE user_channel_id = $6`,
          [
            displayName, 
            profileImageUrl, 
            newParticipationCount, 
            currentDate,
            participationFrequency,
            channelId
          ]
        );
      }

      // 記錄本次參與
      await this.pool.query(
        `INSERT INTO participation_records 
         (user_channel_id, video_id, participated_at) 
         VALUES ($1, $2, $3)`,
        [channelId, this.videoId, currentDate]
      );
    } catch (error) {
      console.error('更新用戶畫像資料時出錯:', error);
      throw error;
    }
  }

  // 發送聊天回應訊息
  async sendChatResponse(channelId, displayName) {
    try {
      // 這裡需要實現向 YouTube 發送聊天訊息的邏輯
      // 實際的 API 呼叫會因需要 OAuth2 而複雜，此處僅記錄
      console.log(`已加入抽獎: @${displayName}`);
    } catch (error) {
      console.error('發送聊天回應時出錯:', error);
    }
  }

  // 獲取參與者列表
  async getParticipants() {
    return Array.from(this.participants.entries()).map(([channelId, data]) => ({
      channelId,
      ...data
    }));
  }

  // 執行抽獎
  async drawWinner(animationMode = 'turntable', duration = 0) {
    if (this.participants.size === 0) {
      throw new Error('沒有參與者可以抽獎');
    }

    // 從參與者中隨機選擇一位
    const participantEntries = Array.from(this.participants.entries());
    const randomIndex = Math.floor(Math.random() * participantEntries.length);
    const [winnerChannelId, winnerData] = participantEntries[randomIndex];

    // 記錄抽獎結果到資料庫
    try {
      const result = await this.pool.query(
        `INSERT INTO youtube_lottery_history 
         (video_id, lottery_keyword, winner_name, total_participants, 
          duration_minutes, animation_mode, participants_list) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id`,
        [
          this.videoId,
          this.keyword,
          winnerData.displayName,
          this.participants.size,
          duration,
          animationMode,
          JSON.stringify(Object.fromEntries(this.participants))
        ]
      );

      const lotteryId = result.rows[0].id;

      // 更新中獎者的資料
      await this.pool.query(
        `UPDATE user_profiles 
         SET total_wins = total_wins + 1 
         WHERE user_channel_id = $1`,
        [winnerChannelId]
      );

      // 更新參與記錄 - 修復 SQL 語法錯誤 (PostgreSQL 不支持在 UPDATE 中使用 ORDER BY 和 LIMIT)
      // 先用 SELECT 找出要更新的記錄
      const recordToUpdate = await this.pool.query(
        `SELECT id FROM participation_records
         WHERE user_channel_id = $1 AND video_id = $2
         ORDER BY participated_at DESC LIMIT 1`,
        [winnerChannelId, this.videoId]
      );
      
      if (recordToUpdate.rows.length > 0) {
        // 然後只更新這個記錄
        await this.pool.query(
          `UPDATE participation_records
           SET is_winner = true, lottery_id = $1
           WHERE id = $2`,
          [lotteryId, recordToUpdate.rows[0].id]
        );
      }

      // 返回中獎者資訊
      return {
        channelId: winnerChannelId,
        displayName: winnerData.displayName,
        profileImageUrl: winnerData.profileImageUrl,
        lotteryId: lotteryId
      };
    } catch (error) {
      console.error('記錄抽獎結果時出錯:', error);
      throw new Error(`抽獎失敗: ${error.message}`);
    }
  }

  // 獲取抽獎歷史
  async getLotteryHistory(limit = 50, offset = 0) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM youtube_lottery_history 
         ORDER BY draw_timestamp DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return result.rows;
    } catch (error) {
      console.error('獲取抽獎歷史時出錯:', error);
      throw new Error(`獲取抽獎歷史失敗: ${error.message}`);
    }
  }

  // 廣播參與者更新
  broadcastParticipantsUpdate() {
    if (this.webSocketServer) {
      const participantsArray = Array.from(this.participants.entries()).map(([channelId, data]) => ({
        channelId,
        ...data
      }));

      const message = JSON.stringify({
        type: 'update_participants',
        participants: participantsArray,
        count: participantsArray.length
      });

      // 向所有連接的客戶端廣播，不進行權限限制
      this.webSocketServer.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          // 對所有的YouTube抽獎相關客戶端發送訊息，不檢查權限
          if (client.isYoutubeLottery) {
            client.send(message);
          }
        }
      });
    }
  }
}

module.exports = YoutubeLottery; 