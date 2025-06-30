// userProfile.js - 用戶畫像管理模組
class UserProfile {
  constructor(pool) {
    this.pool = pool; // PostgreSQL 連接池
  }

  // 獲取所有用戶畫像
  async getAllProfiles(limit = 100, offset = 0) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM user_profiles 
         ORDER BY total_participations DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return result.rows;
    } catch (error) {
      console.error('獲取所有用戶畫像時出錯:', error);
      throw new Error(`獲取用戶畫像失敗: ${error.message}`);
    }
  }

  // 獲取單一用戶畫像
  async getProfile(channelId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM user_profiles WHERE user_channel_id = $1',
        [channelId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error(`獲取用戶 ${channelId} 畫像時出錯:`, error);
      throw new Error(`獲取用戶畫像失敗: ${error.message}`);
    }
  }

  // 獲取用戶參與歷史
  async getUserParticipationHistory(channelId, limit = 50, offset = 0) {
    try {
      const result = await this.pool.query(
        `SELECT pr.*, ylh.lottery_keyword, ylh.draw_timestamp
         FROM participation_records pr
         LEFT JOIN youtube_lottery_history ylh ON pr.lottery_id = ylh.id
         WHERE pr.user_channel_id = $1
         ORDER BY pr.participated_at DESC
         LIMIT $2 OFFSET $3`,
        [channelId, limit, offset]
      );
      return result.rows;
    } catch (error) {
      console.error(`獲取用戶 ${channelId} 參與歷史時出錯:`, error);
      throw new Error(`獲取參與歷史失敗: ${error.message}`);
    }
  }

  // 獲取忠實粉絲清單
  async getLoyalFans(minParticipations = 5, limit = 50, offset = 0) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM user_profiles 
         WHERE total_participations >= $1
         ORDER BY total_participations DESC, participation_frequency DESC
         LIMIT $2 OFFSET $3`,
        [minParticipations, limit, offset]
      );
      return result.rows;
    } catch (error) {
      console.error('獲取忠實粉絲時出錯:', error);
      throw new Error(`獲取忠實粉絲失敗: ${error.message}`);
    }
  }

  // 獲取超級粉絲清單
  async getSuperFans(minParticipations = 20, limit = 50, offset = 0) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM user_profiles 
         WHERE total_participations >= $1
         ORDER BY total_participations DESC, participation_frequency DESC
         LIMIT $2 OFFSET $3`,
        [minParticipations, limit, offset]
      );
      return result.rows;
    } catch (error) {
      console.error('獲取超級粉絲時出錯:', error);
      throw new Error(`獲取超級粉絲失敗: ${error.message}`);
    }
  }

  // 更新用戶標籤
  async updateUserTags(channelId, tags) {
    if (!Array.isArray(tags)) {
      throw new Error('標籤必須是陣列格式');
    }

    try {
      const result = await this.pool.query(
        `UPDATE user_profiles 
         SET user_tags = $1, updated_at = NOW()
         WHERE user_channel_id = $2
         RETURNING *`,
        [tags, channelId]
      );

      if (result.rows.length === 0) {
        throw new Error('找不到指定的用戶');
      }

      return result.rows[0];
    } catch (error) {
      console.error(`更新用戶 ${channelId} 標籤時出錯:`, error);
      throw new Error(`更新用戶標籤失敗: ${error.message}`);
    }
  }

  // 獲取參與統計資料
  async getParticipationStats() {
    try {
      // 總用戶數
      const totalUsersResult = await this.pool.query('SELECT COUNT(*) FROM user_profiles');
      const totalUsers = parseInt(totalUsersResult.rows[0].count);

      // 新用戶數 (過去 7 天內首次參與)
      const newUsersResult = await this.pool.query(
        `SELECT COUNT(*) FROM user_profiles 
         WHERE first_participation_date > NOW() - INTERVAL '7 days'`
      );
      const newUsers = parseInt(newUsersResult.rows[0].count);

      // 回歸用戶數 (過去 7 天內參與，但不是首次參與)
      const returningUsersResult = await this.pool.query(
        `SELECT COUNT(*) FROM user_profiles 
         WHERE last_participation_date > NOW() - INTERVAL '7 days'
         AND first_participation_date <= NOW() - INTERVAL '7 days'`
      );
      const returningUsers = parseInt(returningUsersResult.rows[0].count);

      // 活躍用戶數 (過去 30 天內參與過)
      const activeUsersResult = await this.pool.query(
        `SELECT COUNT(*) FROM user_profiles 
         WHERE last_participation_date > NOW() - INTERVAL '30 days'`
      );
      const activeUsers = parseInt(activeUsersResult.rows[0].count);

      // 忠實粉絲數 (參與次數 >= 5)
      const loyalFansResult = await this.pool.query(
        'SELECT COUNT(*) FROM user_profiles WHERE total_participations >= 5'
      );
      const loyalFans = parseInt(loyalFansResult.rows[0].count);

      // 超級粉絲數 (參與次數 >= 20)
      const superFansResult = await this.pool.query(
        'SELECT COUNT(*) FROM user_profiles WHERE total_participations >= 20'
      );
      const superFans = parseInt(superFansResult.rows[0].count);

      return {
        totalUsers,
        newUsers,
        returningUsers,
        activeUsers,
        loyalFans,
        superFans,
        newUserRatio: totalUsers > 0 ? (newUsers / totalUsers * 100).toFixed(2) : 0,
        returningUserRatio: totalUsers > 0 ? (returningUsers / totalUsers * 100).toFixed(2) : 0,
        loyalFanRatio: totalUsers > 0 ? (loyalFans / totalUsers * 100).toFixed(2) : 0,
        superFanRatio: totalUsers > 0 ? (superFans / totalUsers * 100).toFixed(2) : 0
      };
    } catch (error) {
      console.error('獲取參與統計資料時出錯:', error);
      throw new Error(`獲取參與統計失敗: ${error.message}`);
    }
  }
}

module.exports = UserProfile; 