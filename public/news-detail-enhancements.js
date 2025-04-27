// news-detail-enhancements.js - 增強新聞詳情頁面的功能

document.addEventListener('DOMContentLoaded', () => {
    // 獲取DOM元素
    const backToTopButton = document.getElementById('back-to-top');
    const categoryTabsContainer = document.getElementById('category-tabs');

    // 初始化各功能
    setupBackToTop();
    setupCharacterInteractions();
    loadCategories();

    /**
     * 載入分類標籤
     */
    async function loadCategories() {
        try {
            if (!categoryTabsContainer) return;
            
            const response = await fetch('/api/news-categories');
            if (!response.ok) {
                throw new Error(`獲取分類失敗 (HTTP ${response.status})`);
            }
            
            const categories = await response.json();
            
            if (categories && categories.length > 0) {
                renderCategories(categories);
            } else {
                useBackupCategories();
            }
        } catch (error) {
            console.error('載入分類標籤失敗:', error);
            useBackupCategories();
        }
    }

    /**
     * 使用備用分類
     */
    function useBackupCategories() {
        if (!categoryTabsContainer) return;
        
        const backupCategories = [
            { id: 1, name: '最新消息', slug: 'latest' },
            { id: 2, name: '活動預告', slug: 'events' },
            { id: 3, name: '媒體報導', slug: 'media' },
            { id: 4, name: '合作推廣', slug: 'cooperation' }
        ];
        
        // 建立分類索引映射
        const categoryIndexMap = {};
        backupCategories.forEach((category, index) => {
            categoryIndexMap[category.id] = index;
        });
        
        renderCategories(backupCategories);
    }

    /**
     * 渲染分類標籤
     */
    function renderCategories(categories) {
        if (!categoryTabsContainer) return;
        
        categoryTabsContainer.innerHTML = '';
        
        // 首先添加"全部"按鈕
        const allLink = document.createElement('a');
        allLink.href = '/news.html';
        allLink.textContent = '全部消息';
        allLink.classList.add('category-link', 'category-index-all', 'active');
        allLink.setAttribute('data-category', 'all');
        categoryTabsContainer.appendChild(allLink);
        
        // 建立分類索引映射
        const categoryIndexMap = {};
        categories.forEach((category, index) => {
            categoryIndexMap[category.id] = index;
        });
        
        // 添加其他分類
        categories.forEach(category => {
            const categoryIndex = categoryIndexMap[category.id];
            if (categoryIndex === undefined) return;
            
            const categoryLink = document.createElement('a');
            categoryLink.href = `/news.html?category=${category.id}`;
            categoryLink.textContent = category.name;
            categoryLink.classList.add('category-link', `category-index-${categoryIndex}`);
            categoryLink.setAttribute('data-category', category.id);
            categoryTabsContainer.appendChild(categoryLink);
        });
    }

    /**
     * 設置返回頂部按鈕
     */
    function setupBackToTop() {
        if (!backToTopButton) return;
        
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
        });
        
        backToTopButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    /**
     * 設置浮動角色互動
     */
    function setupCharacterInteractions() {
        const characters = document.querySelectorAll('.floating-character');
        
        if (characters.length === 0) return;
        
        // 角色互動性
        characters.forEach(character => {
            let speechElement = document.createElement('div');
            speechElement.className = 'character-speech';
            character.appendChild(speechElement);
            
            character.addEventListener('touchstart', handleInteraction, { passive: true });
            character.addEventListener('mousedown', handleInteraction);
            
            // 隨機語句
            function handleInteraction(e) {
                e.preventDefault();
                
                // 避免同時點擊多個角色
                const otherCharacters = document.querySelectorAll('.floating-character.touched');
                if (otherCharacters.length > 0) return;
                
                // 添加點擊效果類
                character.classList.add('touched');
                
                // 隨機選擇一句話
                const messages = [
                    '你好！今天過得如何？',
                    '有什麼新消息嗎？',
                    '點擊下方消息查看詳情！',
                    '歡迎光臨 SunnyYummy！',
                    '想了解更多資訊嗎？',
                    '有什麼想告訴我的嗎？',
                    '希望你今天過得愉快！',
                    '謝謝你的支持！'
                ];
                
                const randomMessage = messages[Math.floor(Math.random() * messages.length)];
                
                // 顯示對話泡泡
                speechElement.textContent = randomMessage;
                speechElement.classList.add('visible');
                
                // 移除效果的定時器
                setTimeout(() => {
                    speechElement.classList.remove('visible');
                    character.classList.remove('touched');
                    character.classList.add('bounce-back');
                    
                    // 移除彈回動畫
                    setTimeout(() => {
                        character.classList.remove('bounce-back');
                    }, 800);
                }, 3000);
            }
        });
    }
}); 