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
    this.isLive = false; // 新增：標記是否為直播模式
    this.liveChatId = null; // 新增：儲存直播聊天室 ID
  }

  // 設置監控的直播或影片（智慧偵測）
  async setTargetVideo(videoId, keyword, apiRateLimit = 10, forceLiveMode = null) {
    if (!this.apiKey) {
      throw new Error('YouTube API 金鑰未配置');
    }

    // 停止當前監控
    this.stopMonitoring();

    // 重設狀態
    this.videoId = videoId;
    this.keyword = keyword;
    this.apiRateLimit = parseInt(apiRateLimit, 10);
    this.participants.clear();
    this.pollingPageToken = null;

    // 驗證影片存在
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
      const videoTitle = video.snippet.title;

      // 是否為直播
      const hasLiveChatId = video.liveStreamingDetails && video.liveStreamingDetails.activeLiveChatId;
      
      // 使用用戶指定的模式或自動偵測
      if (forceLiveMode !== null) {
        this.isLive = forceLiveMode;
        console.log(`使用者指定模式: ${forceLiveMode ? '直播' : '影片'}`);
      } else {
        this.isLive = hasLiveChatId;
        console.log(`自動偵測模式: ${hasLiveChatId ? '直播' : '影片'}`);
      }

      // 處理不同模式
      if (this.isLive) {
        // 模式：直播
        if (!hasLiveChatId) {
          console.warn('警告：該影片不是直播或沒有活躍的聊天室，但仍按照直播模式處理');
        } else {
        this.liveChatId = video.liveStreamingDetails.activeLiveChatId;
        }
        
        if (this.liveChatId) {
          console.log(`開始監控直播聊天室: "${videoTitle}"...`);
        this.startChatPolling(this.liveChatId);
        } else {
          throw new Error('直播模式錯誤：找不到聊天室ID');
        }
        return { success: true, videoTitle, isLive: true };
      } else {
        // 模式：一般影片或已結束的直播
        console.log(`開始抓取影片留言: "${videoTitle}"...`);
        await this.fetchAllComments();
        return { success: true, videoTitle, isLive: false, participantCount: this.participants.size };
      }
    } catch (error) {
      console.error('設置監控影片時出錯:', error);
      const errorMessage = error.response ? (error.response.data.error.message || error.message) : error.message;
      throw new Error(`設置監控影片失敗: ${errorMessage}`);
    }
  }

  // 停止監控
  stopMonitoring() {
    if (this.chatPollingInterval) {
      clearInterval(this.chatPollingInterval);
      this.chatPollingInterval = null;
      console.log(`已停止監控 Video ID: ${this.videoId}`);
    }
    // 重置狀態
    this.videoId = null;
    this.keyword = null;
    this.participants.clear();
    this.pollingPageToken = null;
    this.isLive = false;
    this.liveChatId = null;
    return { success: true, message: '已停止監控' };
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
  }

  // 處理單條訊息
  async processMessage(message) {
    if (message.snippet.type !== 'textMessageEvent') return;

    const messageText = message.snippet.displayMessage;
    const { channelId, displayName, profileImageUrl } = message.authorDetails;

    // 檢查是否包含關鍵字
    if (this.keyword && messageText.includes(this.keyword)) {
      await this.addParticipant(channelId, displayName, profileImageUrl, messageText);
    }
  }

  // (新) 添加參與者核心邏輯
  async addParticipant(channelId, displayName, profileImageUrl, commentText = '') {
    // 添加到參與者列表
    if (!this.participants.has(channelId)) {
      this.participants.set(channelId, {
        displayName,
        profileImageUrl,
        joinTime: new Date(),
        commentText
      });

      // 更新用戶畫像資料
      try {
        await this.updateUserProfile(channelId, displayName, profileImageUrl);
      } catch (error) {
        console.error('更新用戶畫像時出錯:', error);
      }

      // 直播模式下才發送確認訊息
      if (this.isLive && process.env.ENABLE_CHAT_RESPONSES === 'true') {
        await this.sendChatResponse(channelId, displayName);
      }
    }
  }

  // (新) 獲取影片所有留言
  async fetchAllComments() {
    console.log(`正在為影片 ID 抓取留言: ${this.videoId}`);
    let pageToken = null;
    let participantsFound = 0;

    do {
      try {
        const params = {
          part: 'snippet',
          videoId: this.videoId,
          textFormat: 'plainText',
          maxResults: 100,
          key: this.apiKey,
          pageToken,
        };
        const response = await axios.get('https://www.googleapis.com/youtube/v3/commentThreads', { params });
        
        const { items, nextPageToken } = response.data;

        for (const item of items) {
          const comment = item.snippet.topLevelComment.snippet;
          const commentText = comment.textDisplay;
          if (this.keyword && commentText.includes(this.keyword)) {
            const { authorChannelId, authorDisplayName, authorProfileImageUrl } = comment;
            // The authorChannelId object is { value: "..." }
            if (authorChannelId && authorChannelId.value) {
                await this.addParticipant(authorChannelId.value, authorDisplayName, authorProfileImageUrl, commentText);
                participantsFound++;
            }
          }
        }
        
        pageToken = nextPageToken;

      } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('獲取影片留言時出錯:', errorMessage);
        
        // 如果是留言已停用等錯誤，就直接中斷
        if (errorMessage.includes('commentsDisabled')) {
           console.warn(`影片 ${this.videoId} 的留言功能已停用。`);
           // 拋出一個更友善的錯誤給前端
           throw new Error(`此影片的留言功能已關閉，無法進行抽獎。`);
        }
        // 其他錯誤也中斷，避免無限循環
        break;
      }
    } while (pageToken);
    
    console.log(`留言抓取完成。共有 ${participantsFound} 位參與者符合關鍵字。`);
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

  // 刪除指定參與者
  async removeParticipant(channelId) {
    if (!this.participants.has(channelId)) {
      throw new Error('找不到指定的參與者');
    }

    try {
      // 從參與者列表中移除
      const removedParticipant = this.participants.get(channelId);
      this.participants.delete(channelId);

      // 先找到要更新的記錄
      const recordToUpdate = await this.pool.query(
        `SELECT id FROM participation_records 
         WHERE user_channel_id = $1 
         AND video_id = $2 
         AND is_removed = false
         ORDER BY participated_at DESC 
         LIMIT 1`,
        [channelId, this.videoId]
      );

      if (recordToUpdate.rows.length > 0) {
        // 然後更新找到的記錄
        await this.pool.query(
          `UPDATE participation_records 
           SET is_removed = true, 
               removed_at = NOW(), 
               removal_reason = '管理員手動移除'
           WHERE id = $1`,
          [recordToUpdate.rows[0].id]
        );
      }

      return {
        success: true,
        removedParticipant: {
          channelId,
          ...removedParticipant
        }
      };
    } catch (error) {
      console.error('刪除參與者時出錯:', error);
      throw new Error(`刪除參與者失敗: ${error.message}`);
    }
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
         (video_id, lottery_keyword, winner_name, winner_avatar_url, winner_channel_id, winner_comment, total_participants, 
          duration_minutes, animation_mode, participants_list) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
         RETURNING id`,
        [
          this.videoId,
          this.keyword,
          winnerData.displayName,
          winnerData.profileImageUrl,
          winnerChannelId,
          winnerData.commentText || 'N/A',
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

  // (新增) 儲存從前端發起的抽獎紀錄
  async saveLotteryHistory(winnerData) {
    const {
        video_id,
        lottery_keyword,
        winner_channel_id,
        winner_name,
        winner_avatar_url,
        winner_comment,
        total_participants,
        animation_mode
    } = winnerData;

    if (!winner_channel_id || !winner_name) {
        throw new Error('中獎者資訊不完整，無法儲存紀錄。');
    }

    const client = await this.pool.connect();
    try {
        await client.query('BEGIN');

        const insertResult = await client.query(
            `INSERT INTO youtube_lottery_history
             (video_id, lottery_keyword, winner_name, winner_avatar_url, winner_channel_id, winner_comment, total_participants, animation_mode)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
                video_id,
                lottery_keyword,
                winner_name,
                winner_avatar_url,
                winner_channel_id,
                winner_comment,
                total_participants,
                animation_mode
            ]
        );
        const lotteryId = insertResult.rows[0].id;

        // 更新中獎者的資料
        await client.query(
            `UPDATE user_profiles
             SET total_wins = total_wins + 1
             WHERE user_channel_id = $1`,
            [winner_channel_id]
        );

        // 更新參與記錄
        const recordToUpdate = await client.query(
            `SELECT id FROM participation_records
             WHERE user_channel_id = $1 AND video_id = $2
             ORDER BY participated_at DESC LIMIT 1`,
            [winner_channel_id, video_id]
        );

        if (recordToUpdate.rows.length > 0) {
            await client.query(
                `UPDATE participation_records
                 SET is_winner = true, lottery_id = $1
                 WHERE id = $2`,
                [lotteryId, recordToUpdate.rows[0].id]
            );
        }

        await client.query('COMMIT');
        return { success: true, lotteryId };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('記錄前端抽獎結果時出錯:', error);
        throw new Error(`儲存抽獎紀錄失敗: ${error.message}`);
    } finally {
        client.release();
    }
  }
}

module.exports = YoutubeLottery; 