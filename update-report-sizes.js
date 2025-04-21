/**
 * update-report-sizes.js - 更新現有報告的大小欄位
 * 
 * 這個腳本會連接到資料庫，獲取所有報告，
 * 計算每個報告的 HTML 內容大小，並更新 size_bytes 欄位。
 * 
 * 使用方法：
 * 1. 將此檔案放在專案根目錄
 * 2. 確保已安裝 pg 套件：npm install pg
 * 3. 執行：node update-report-sizes.js
 */

// 載入環境變數
require('dotenv').config();

// 引入 PostgreSQL 客戶端
const { Pool } = require('pg');

// 初始化資料庫連接池
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 主要功能：更新所有報告的大小
async function updateAllReportSizes() {
    console.log('開始更新報告大小...');
    
    const client = await pool.connect();
    
    try {
        // 開始一個事務
        await client.query('BEGIN');
        
        // 取得所有報告
        const getReportsResult = await client.query('SELECT id, html_content FROM report_templates ORDER BY id');
        const reports = getReportsResult.rows;
        
        console.log(`找到 ${reports.length} 個報告需要更新大小`);
        
        // 遍歷每個報告，計算其大小並更新
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < reports.length; i++) {
            const report = reports[i];
            try {
                // 計算內容大小（以字節為單位）
                const contentSizeBytes = Buffer.byteLength(report.html_content || '', 'utf8');
                
                // 更新資料庫
                await client.query(
                    'UPDATE report_templates SET size_bytes = $1 WHERE id = $2',
                    [contentSizeBytes, report.id]
                );
                
                successCount++;
                console.log(`[${i+1}/${reports.length}] 已更新報告 ID ${report.id}：${contentSizeBytes} 字節`);
            } catch (err) {
                errorCount++;
                console.error(`[${i+1}/${reports.length}] 更新報告 ID ${report.id} 失敗:`, err.message);
            }
        }
        
        // 提交事務
        await client.query('COMMIT');
        
        console.log('========== 更新報告大小完成 ==========');
        console.log(`成功更新: ${successCount} 個報告`);
        console.log(`失敗: ${errorCount} 個報告`);
        
    } catch (err) {
        // 如果有錯誤，回滾事務
        await client.query('ROLLBACK');
        console.error('更新報告大小時發生錯誤:', err);
    } finally {
        // 釋放客戶端
        client.release();
        // 關閉連接池
        pool.end();
    }
}

// 執行主函數
updateAllReportSizes().catch(err => {
    console.error('腳本執行失敗:', err);
    process.exit(1);
});