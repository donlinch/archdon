// games.js - 遊戲導覽頁面 JavaScript 代碼

document.addEventListener('DOMContentLoaded', async () => {
    // 获取DOM元素
    const gamesContainer = document.getElementById('games-container');
    const backToTopButton = document.getElementById('back-to-top');
    const viewModeLinks = document.querySelectorAll('.view-mode-link');
    
    // 当前游戏视图模式
    let currentViewMode = 'grid';
    
    // 初始化各功能
    setupViewModeToggle();
    setupBackToTop();
    fetchAndDisplayGames();
    
    /**
     * 设置视图模式切换
     */
    function setupViewModeToggle() {
        if (!viewModeLinks.length) return;
        
        viewModeLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                // 移除所有链接的 active 类
                viewModeLinks.forEach(otherLink => otherLink.classList.remove('active'));
                // 为当前点击的链接添加 active 类
                link.classList.add('active');
                
                // 获取视图模式
                const viewMode = link.dataset.view;
                
                if (viewMode && viewMode !== currentViewMode) {
                    currentViewMode = viewMode;
                    updateViewMode();
                    fetchAndDisplayGames(); // 重新加载游戏列表
                }
            });
        });
    }
    
    /**
     * 更新视图模式
     */
    function updateViewMode() {
        if (!gamesContainer) return;
        
        if (currentViewMode === 'grid') {
            gamesContainer.className = 'games-grid';
        } else if (currentViewMode === 'list') {
            gamesContainer.className = 'games-list';
        }
    }
    
    /**
     * 设置回到顶部按钮
     */
    function setupBackToTop() {
        if (!backToTopButton) return;
        
        // 监听滚动事件
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
        });
        
        // 点击回到顶部
        backToTopButton.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
    /**
     * 获取并显示游戏列表
     */
    async function fetchAndDisplayGames() {
        if (!gamesContainer) {
            console.error("Games container not found");
            return;
        }
        
        // 显示加载中提示
        gamesContainer.innerHTML = '<div class="loading-message">正在載入遊戲列表...</div>';
        
        try {
            // 从API获取游戏列表
            const response = await fetch('/api/games');
            if (!response.ok) throw new Error('無法獲取遊戲列表');
            const games = await response.json();
            
            // 清空容器
            gamesContainer.innerHTML = '';
            
            // 检查是否有游戏
            if (games.length === 0) {
                gamesContainer.innerHTML = '<div class="no-games-message">暫無遊戲，敬請期待！</div>';
                return;
            }
            
            // 根据当前视图模式显示游戏
            if (currentViewMode === 'grid') {
                displayGamesAsGrid(games);
            } else {
                displayGamesAsList(games);
            }
            
        } catch (error) {
            console.error('載入遊戲列表失敗:', error);
            gamesContainer.innerHTML = `
                <div class="error-message">
                    載入遊戲列表時出錯: ${error.message}
                    <button onclick="location.reload()" class="retry-button">重試</button>
                </div>
            `;
        }
    }
    
    /**
     * 以格状视图显示游戏
     */
    function displayGamesAsGrid(games) {
        games.forEach((game, index) => {
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            gameCard.setAttribute('data-game-id', game.id);
            gameCard.setAttribute('data-game-url', game.play_url);
            
            gameCard.innerHTML = `
                <img src="${game.image_url || '/images/placeholder.png'}" alt="${game.title}" class="game-image">
                <div class="game-play-count">👾 ${game.play_count || 0}</div>
                <div class="game-info">
                    <h3 class="game-title">${game.title}</h3>
                    <p class="game-description">${game.description || '暫無描述'}</p>
                </div>
            `;
            
            gamesContainer.appendChild(gameCard);
            
            // 添加动画效果，延迟显示
            setTimeout(() => {
                gameCard.classList.add('animate');
            }, 50 * index);
        });
        
        // 为所有游戏卡片添加点击事件
        setupGameCardEvents();
    }
    
    /**
     * 以列表视图显示游戏
     */
    function displayGamesAsList(games) {
        games.forEach((game, index) => {
            const gameItem = document.createElement('div');
            gameItem.className = 'game-list-item';
            gameItem.setAttribute('data-game-id', game.id);
            gameItem.setAttribute('data-game-url', game.play_url);
            
            gameItem.innerHTML = `
                <img src="${game.image_url || '/images/placeholder.png'}" alt="${game.title}" class="game-list-image">
                <div class="game-list-info">
                    <h3 class="game-list-title">${game.title}</h3>
                    <p class="game-list-description">${game.description || '暫無描述'}</p>
                </div>
                <button class="play-button">開始遊戲</button>
            `;
            
            gamesContainer.appendChild(gameItem);
            
            // 添加动画效果，延迟显示
            setTimeout(() => {
                gameItem.classList.add('animate');
            }, 50 * index);
        });
        
        // 为所有游戏卡片添加点击事件
        setupGameCardEvents();
    }
    
    /**
     * 设置游戏卡片点击事件
     */
    function setupGameCardEvents() {
        // 处理卡片点击
        document.querySelectorAll('.game-card, .game-list-item').forEach(card => {
            card.addEventListener('click', function(e) {
                // 如果点击的是按钮，让按钮的事件处理器处理
                if (e.target.classList.contains('play-button')) {
                    return;
                }
                
                // 获取游戏ID和URL
                const gameId = this.getAttribute('data-game-id');
                const gameUrl = this.getAttribute('data-game-url');
                
                // 记录游玩次数
                recordGamePlay(gameId);
                
                // 跳转到游戏页面
                window.location.href = gameUrl;
            });
            
            // 添加指针光标样式，表示可点击
            card.style.cursor = 'pointer';
        });
        
        // 单独处理播放按钮点击
        document.querySelectorAll('.play-button').forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation(); // 防止事件冒泡
                
                // 获取游戏ID和URL
                const gameItem = this.closest('.game-list-item');
                const gameId = gameItem.getAttribute('data-game-id');
                const gameUrl = gameItem.getAttribute('data-game-url');
                
                // 记录游玩次数
                recordGamePlay(gameId);
                
                // 跳转到游戏页面
                window.location.href = gameUrl;
            });
        });
    }
    
    /**
     * 记录游戏游玩次数
     */
    function recordGamePlay(gameId) {
        fetch(`/api/games/${gameId}/play`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }    
        }).catch(error => {
            // 静默处理错误，不阻止用户游玩
            console.error('记录游玩次数失败:', error);
        });
    }
    
    /**
     * 检测设备类型并适配
     */
    function detectDevice() {
        const isMobile = window.innerWidth <= 767;
        document.body.classList.toggle('is-mobile', isMobile);
    }
    
    // 初始化检测设备类型
    detectDevice();
    
    // 窗口尺寸改变时重新检测
    window.addEventListener('resize', detectDevice);
});