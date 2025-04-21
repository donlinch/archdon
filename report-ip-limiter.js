// report-ip-limiter.js - IP 限制中間件

/**
 * 報告生成 IP 限制中間件
 * 用於限制同一 IP 每日報告生成次數
 */

// 內存中存儲 IP 請求記錄
const ipRequestTracker = new Map();

/**
 * 清理過期的 IP 記錄
 * 每天凌晨 00:00 執行，清除昨天的請求記錄
 */
function setupDailyCleanup() {
    const now = new Date();
    // 計算到今天結束還有多少毫秒
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    // 設置定時器，在午夜清理數據
    setTimeout(() => {
        console.log('[IP限制器] 執行每日清理任務');
        ipRequestTracker.clear(); // 清空所有記錄
        
        // 設置下一次清理
        setupDailyCleanup();
    }, timeUntilMidnight);

    console.log(`[IP限制器] 已設置每日清理任務，將在 ${new Date(tomorrow).toLocaleString()} 執行`);
}

/**
 * 獲取當前日期的字符串表示 YYYY-MM-DD
 */
function getCurrentDateStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * 創建報告 IP 限制中間件
 * @param {number} maxRequestsPerDay - 每個 IP 每天允許的最大請求數
 * @returns {Function} Express 中間件函數
 */
function createReportRateLimiter(maxRequestsPerDay = 10) {
    console.log(`[IP限制器] 已創建報告 IP 限制器，每日最大請求數: ${maxRequestsPerDay}`);
    
    // 啟動午夜清理任務
    setupDailyCleanup();
    
    return function reportRateLimiter(req, res, next) {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const today = getCurrentDateStr();
        
        // 檢查是否已存在該 IP 的今日記錄
        let ipRecord = ipRequestTracker.get(ip);
        
        if (!ipRecord || ipRecord.date !== today) {
            // 不存在或是舊日期，創建新記錄
            ipRecord = { date: today, count: 0 };
        }
        
        // 檢查是否超出今日限制
        if (ipRecord.count >= maxRequestsPerDay) {
            console.log(`[IP限制器] IP ${ip} 已達每日限制 (${maxRequestsPerDay}次)`);
            return res.status(429).json({ 
                error: '超出每日報告生成限制',
                detail: `每個 IP 每天最多可生成 ${maxRequestsPerDay} 個報告`,
                dailyLimit: maxRequestsPerDay,
                currentCount: ipRecord.count,
                resetTime: '次日 00:00'
            });
        }
        
        // 增加計數並更新記錄
        ipRecord.count++;
        ipRequestTracker.set(ip, ipRecord);
        
        // 將當前計數添加到響應頭中供前端參考
        res.set('X-RateLimit-Limit', String(maxRequestsPerDay));
        res.set('X-RateLimit-Remaining', String(maxRequestsPerDay - ipRecord.count));
        
        console.log(`[IP限制器] IP ${ip} 已使用 ${ipRecord.count}/${maxRequestsPerDay} 次報告生成`);
        
        // 繼續處理請求
        next();
    };
}

module.exports = createReportRateLimiter;