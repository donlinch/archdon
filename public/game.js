// games.js - 遊戲導覽頁面 JavaScript 代碼 (API已實現)

document.addEventListener('DOMContentLoaded', async () => {
    const gamesContainer = document.getElementById('games-container');
    
    // 顯示載入中提示
    gamesContainer.innerHTML = '<div class="loading-message">正在載入遊戲列表...</div>';
    
    try {
        // 從API獲取遊戲列表
        const response = await fetch('/api/games');
        if (!response.ok) throw new Error('無法獲取遊戲列表');
        const games = await response.json();
        
        // 清空容器
        gamesContainer.innerHTML = '';
        
        // 檢查是否有遊戲
        if (games.length === 0) {
            gamesContainer.innerHTML = '<div class="no-games-message">暫無遊戲，敬請期待！</div>';
            return;
        }
        
        // 為每個遊戲創建卡片
        games.forEach(game => {
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            gameCard.innerHTML = `
                <img src="${game.image_url || '/images/placeholder.png'}" alt="${game.title}" class="game-image">
                <div class="game-info">
                    <h3 class="game-title">${game.title}</h3>
                    <p class="game-description">${game.description || '暫無描述'}</p>
                    <a href="${game.play_url}" class="play-button" data-game-id="${game.id}">立即遊玩</a>
                </div>
            `;
            gamesContainer.appendChild(gameCard);
        });
        
        // 為所有遊戲按鈕添加點擊事件以記錄遊玩次數
        document.querySelectorAll('.play-button').forEach(button => {
            button.addEventListener('click', function(e) {
                // 獲取遊戲ID
                const gameId = this.getAttribute('data-game-id');
                
                // 記錄遊玩次數 (使用非阻塞方式)
                fetch(`/api/games/${gameId}/play`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }).catch(error => {
                    // 靜默處理錯誤，不阻止用戶遊玩
                    console.error('記錄遊玩次數失敗:', error);
                });
                
                // 不阻止默認行為，讓用戶跳轉到遊戲頁面
            });
        });
        
    } catch (error) {
        console.error('載入遊戲列表失敗:', error);
        gamesContainer.innerHTML = `
            <div class="error-message">
                載入遊戲列表時出錯: ${error.message}
                <button onclick="location.reload()" class="retry-button">重試</button>
            </div>
        `;
    }
});