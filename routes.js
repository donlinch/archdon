const express = require('express');
const router = express.Router();

// --- 1. 公開 API 路由 ---
// 遊戲相關
router.get('/api/game-rooms', async (req, res) => {
    // ... existing code ...
});

router.post('/api/game-rooms/:roomId/join', async (req, res) => {
    // ... existing code ...
});

// UI 元素
router.get('/api/ui-elements', async (req, res) => {
    // ... existing code ...
});

// 留言板
router.get('/api/guestbook', async (req, res) => {
    // ... existing code ...
});

// 音樂
router.get('/api/artists', async (req, res) => {
    // ... existing code ...
});

// 新聞
router.get('/api/news', async (req, res) => {
    // ... existing code ...
});

// --- 2. 管理員認證中介軟體 ---
router.use(['/api/admin', '/api/analytics'], isAdminAuthenticated);

// --- 3. 受保護的管理員 API ---
router.use('/api/admin', adminRouter);
router.use('/api/admin/walk_map', walkMapAdminRouter);

// 分析相關
router.get('/api/analytics/traffic', async (req, res) => {
    // ... existing code ...
});

router.get('/api/analytics/monthly-traffic', async (req, res) => {
    // ... existing code ...
});

module.exports = router; 