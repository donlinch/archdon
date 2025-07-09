// main.js - Vue 應用主入口
const { createApp, ref } = Vue;

const app = createApp({
    setup() {
        // 遊戲列表數據
        const games = ref([
            {
                id: 1,
                title: '廚房急先鋒 V3 完整版',
                description: '快速料理美食，挑戰你的廚藝極限！',
                image: './assets/login.png',
                url: './cooking-game.html'
            },
            {
                id: 2,
                title: '拳打快攻',
                description: '考驗反應速度的拳擊遊戲',
                image: '../images/game2.png',
                url: '../punch-a-hole.html'
            },
            {
                id: 3,
                title: '幸運轉盤',
                description: '轉動命運之輪，贏取豐厚獎勵',
                image: '../images/game3.png',
                url: '../lottery-history.html'
            }
        ]);

        // 用戶資料
        const user = ref({
            loggedIn: false,
            username: '',
            points: 0
        });

        // 檢查用戶是否已登入
        const checkLoginStatus = () => {
            // 這裡應該是從伺服器獲取用戶資訊的邏輯
            // 目前使用模擬數據
            const savedUser = localStorage.getItem('gameUser');
            if (savedUser) {
                try {
                    const userData = JSON.parse(savedUser);
                    user.value = {
                        loggedIn: true,
                        username: userData.username,
                        points: userData.points || 0
                    };
                } catch(e) {
                    console.error('解析用戶資料失敗', e);
                }
            }
        };

        // 登入功能
        const login = () => {
            // 實際場景中應該導向登入頁面或彈出登入表單
            window.location.href = '../member-login.html';
        };

        // 登出功能
        const logout = () => {
            user.value = {
                loggedIn: false,
                username: '',
                points: 0
            };
            localStorage.removeItem('gameUser');
        };

        // 點擊遊戲時的處理函數
        const playGame = (game) => {
            // 如果需要登入才能玩
            if (requireLogin.value && !user.value.loggedIn) {
                alert('請先登入再遊玩！');
                login();
                return;
            }
            
            // 導向遊戲頁面
            window.location.href = game.url;
        };

        // 是否需要登入
        const requireLogin = ref(false);

        // 頁面加載後檢查登入狀態
        checkLoginStatus();

        // 公告訊息
        const announcements = ref([
            { id: 1, title: '新遊戲上線！', content: '全新遊戲「廚房急先鋒」已經上線，立即體驗！' },
            { id: 2, title: '週末活動', content: '本週末所有遊戲積分雙倍，不要錯過！' }
        ]);

        // 展示公告的開關
        const showAnnouncements = ref(true);

        // 關閉公告
        const closeAnnouncements = () => {
            showAnnouncements.value = false;
        };

        return {
            games,
            user,
            login,
            logout,
            playGame,
            requireLogin,
            announcements,
            showAnnouncements,
            closeAnnouncements
        };
    },
    template: `
        <div class="mobile-game-container">
            <!-- 頂部導航 -->
            <header class="game-header">
                <h1 class="game-title">SunnyYummy 遊戲中心</h1>
                <div class="user-panel" v-if="user.loggedIn">
                    <span class="username">{{ user.username }}</span>
                    <span class="points">{{ user.points }} 點</span>
                    <button class="logout-btn" @click="logout">登出</button>
                </div>
                <button v-else class="login-btn" @click="login">登入</button>
            </header>
            
            <!-- 公告區塊 -->
            <div class="announcements" v-if="showAnnouncements && announcements.length > 0">
                <div class="announcements-header">
                    <h3>最新公告</h3>
                    <button class="close-btn" @click="closeAnnouncements">×</button>
                </div>
                <div class="announcement-content">
                    <div v-for="announcement in announcements" :key="announcement.id" class="announcement-item">
                        <h4>{{ announcement.title }}</h4>
                        <p>{{ announcement.content }}</p>
                    </div>
                </div>
            </div>

            <!-- 遊戲列表 -->
            <div class="games-container">
                <div
                    v-for="game in games"
                    :key="game.id"
                    class="game-card"
                    @click="playGame(game)"
                >
                    <div class="game-image">
                        <img :src="game.image" :alt="game.title">
                    </div>
                    <div class="game-info">
                        <h2 class="game-name">{{ game.title }}</h2>
                        <p class="game-description">{{ game.description }}</p>
                        <button class="play-btn">立即遊玩</button>
                    </div>
                </div>
            </div>

            <!-- 底部導航 -->
            <footer class="game-footer">
                <div class="footer-nav">
                    <div class="nav-item active">
                        <i class="icon-games"></i>
                        <span>遊戲</span>
                    </div>
                    <div class="nav-item">
                        <i class="icon-leaderboard"></i>
                        <span>排行榜</span>
                    </div>
                    <div class="nav-item">
                        <i class="icon-rewards"></i>
                        <span>獎勵</span>
                    </div>
                    <div class="nav-item">
                        <i class="icon-profile"></i>
                        <span>個人</span>
                    </div>
                </div>
            </footer>
        </div>
    `
});

// 掛載 Vue 應用
app.mount('#app');

// 添加動畫效果
document.addEventListener('DOMContentLoaded', () => {
    // 使用GSAP為遊戲卡片添加動畫效果
    gsap.from('.game-card', {
        y: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: 'power2.out'
    });
    
    // 為標題添加動畫
    gsap.from('.game-title', {
        opacity: 0,
        scale: 0.8,
        duration: 1,
        ease: 'elastic.out(1, 0.5)'
    });
    
    // 為公告添加動畫
    gsap.from('.announcements', {
        x: -50,
        opacity: 0,
        duration: 0.5,
        delay: 0.3
    });
});