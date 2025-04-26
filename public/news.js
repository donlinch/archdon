// news.js
document.addEventListener('DOMContentLoaded', () => {
    // 獲取DOM元素
    const newsListContainer = document.getElementById('news-list');
    const paginationControls = document.getElementById('pagination-controls');
    const sortLinks = document.querySelectorAll('.sort-link');
    const backToTopButton = document.getElementById('back-to-top');
    const detailModal = document.getElementById('news-detail-modal');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailMeta = document.getElementById('detail-meta');
    const detailBody = document.getElementById('detail-body');
    const modalClose = document.querySelector('.modal-close');
    
    // 當前狀態
    let currentPage = 1;
    let currentSortBy = 'latest'; // 預設為最新消息
    let itemsPerPage = 10;
    let totalPages = 1;
    let currentCategoryId = null; // 当前选中的分类ID
    
    // 初始化各功能
    initSwiper();
    setupSortLinks();
    setupBackToTop();
    setupCharacterInteractions();
    setupNewsModal();
    
    /**
     * 初始化Swiper輪播
     */
    function initSwiper() {
        // 獲取banner數據
        fetch('/api/banners?page=news')
            .then(response => response.json())
            .then(banners => {
                const swiperWrapper = document.querySelector('.swiper-wrapper');
                
                // 清空現有內容
                swiperWrapper.innerHTML = '';
                
                // 添加輪播項
                if (banners.length === 0) {
                    // 如果沒有banner，顯示默認
                    swiperWrapper.innerHTML = `
                        <div class="swiper-slide">
                            <img src="/images/SunnyYummy.png" alt="SunnyYummy">
                        </div>
                    `;
                } else {
                    // 創建每個輪播項
                    banners.forEach(banner => {
                        const slide = document.createElement('div');
                        slide.className = 'swiper-slide';
                        
                        if (banner.link_url) {
                            slide.innerHTML = `
                                <a href="${banner.link_url}" target="_blank" rel="noopener noreferrer">
                                    <img src="${banner.image_url}" alt="${banner.alt_text || 'Banner'}">
                                </a>
                            `;
                        } else {
                            slide.innerHTML = `
                                <img src="${banner.image_url}" alt="${banner.alt_text || 'Banner'}">
                            `;
                        }
                        
                        swiperWrapper.appendChild(slide);
                    });
                }
                
                // 初始化Swiper
                new Swiper('#news-banner-carousel', {
                    loop: true,
                    autoplay: {
                        delay: 5000,
                        disableOnInteraction: false,
                    },
                    effect: 'fade',
                    fadeEffect: {
                        crossFade: true
                    },
                    pagination: {
                        el: '.swiper-pagination',
                        clickable: true,
                    },
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev',
                    },
                });
            })
            .catch(error => {
                console.error('獲取Banner時出錯:', error);
                const swiperWrapper = document.querySelector('.swiper-wrapper');
                swiperWrapper.innerHTML = `
                    <div class="swiper-slide">
                        <img src="/images/SunnyYummy.png" alt="SunnyYummy">
                    </div>
                `;
                
                // 即使出錯也初始化Swiper
                new Swiper('#news-banner-carousel', {
                    loop: false,
                    pagination: {
                        el: '.swiper-pagination',
                        clickable: true,
                    },
                });
            });
    }
    
    /**
     * 設置排序連結事件
     */
    function setupSortLinks() {
        if (sortLinks.length > 0) {
            sortLinks.forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    
                    // 移除所有連結的 active 類
                    sortLinks.forEach(otherLink => otherLink.classList.remove('active'));
                    // 為當前點擊的連結添加 active 類
                    link.classList.add('active');
                    
                    // 獲取排序方式
                    const sortBy = link.dataset.sort;
                    
                    if (sortBy) {
                        currentSortBy = sortBy;
                        currentPage = 1;
                        fetchNews(currentPage);
                    }
                });
            });
        }
    }
    
    /**
     * 獲取並顯示新聞
     */
    async function fetchNews(page = 1) {
        if (!newsListContainer || !paginationControls) {
            console.error("Element not found");
            return;
        }
        
        currentPage = page;
        newsListContainer.innerHTML = '<p>正在加載最新消息...</p>';
        paginationControls.innerHTML = '';
        
        try {
            const response = await fetch(`/api/news?page=${page}&limit=${itemsPerPage}`);
            if (!response.ok) {
                throw new Error(`獲取新聞失敗 (HTTP ${response.status})`);
            }
            
            const data = await response.json();
            totalPages = data.totalPages;
            
            // 根據當前排序過濾新聞
            let filteredNews = data.news;
            if (currentSortBy === 'upcoming') {
                // 假設活動預告是未來日期的新聞
                const now = new Date();
                filteredNews = data.news.filter(news => {
                    const eventDate = new Date(news.event_date);
                    return eventDate > now;
                });
            } else if (currentSortBy === 'cooperation') {
                // 假設合作推廣的新聞標題或摘要中包含"合作"或"推廣"關鍵字
                filteredNews = data.news.filter(news => {
                    return (news.title && news.title.includes('合作')) || 
                           (news.title && news.title.includes('推廣')) || 
                           (news.summary && news.summary.includes('合作')) || 
                           (news.summary && news.summary.includes('推廣'));
                });
            }
            
            if (filteredNews.length === 0) {
                newsListContainer.innerHTML = '<p>此分類暫無相關消息</p>';
                renderPagination(0, 1);
                return;
            }
            
            renderNewsCards(filteredNews);
            renderPagination(totalPages, currentPage);
            
            // 使用漸入效果顯示新聞
            animateNewsIn();
            
        } catch (error) {
            console.error('獲取新聞失敗:', error);
            newsListContainer.innerHTML = `<p class="error-text">無法加載最新消息，請稍後再試。</p>`;
        }
    }
    
    /**
     * 渲染新聞卡片
     */
    function renderNewsCards(newsItems) {
        if (!newsListContainer) return;
        
        newsListContainer.innerHTML = '';
        
        newsItems.forEach(news => {
            // 創建日期對象
            const eventDate = news.event_date ? new Date(news.event_date) : new Date(news.updated_at);
            const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
            const month = monthNames[eventDate.getMonth()];
            const day = eventDate.getDate();
            const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
            const weekDay = weekDays[eventDate.getDay()];
            
            // 創建新聞卡片
            const newsCard = document.createElement('div');
            newsCard.className = 'news-card';
            newsCard.dataset.id = news.id;
            newsCard.addEventListener('click', () => openNewsDetailModal(news.id));
            
            // 日期標籤
            const dateTag = document.createElement('div');
            dateTag.className = 'date-tag';
            dateTag.innerHTML = `
                <span class="month">${month}</span>
                <span class="day">${day}</span>
                <span class="weekday">${weekDay}</span>
            `;
            
            // 分類標籤
            const categoryLabel = document.createElement('div');
            categoryLabel.className = 'category-label';
            
            // 根據新聞類型決定標籤顏色和文字
            let categoryType = 'cat-other';
            let categoryText = '其他';
            
            if (news.category_id) {
                // 使用現有分類ID
                switch (news.category_id.toString()) {
                    case '1':
                        categoryType = 'cat-news';
                        categoryText = '最新消息';
                        break;
                    case '2':
                        categoryType = 'cat-events';
                        categoryText = '活動預告';
                        break;
                    case '3':
                        categoryType = 'cat-media';
                        categoryText = '媒體報導';
                        break;
                    default:
                        // 默認檢查內容決定分類
                        if ((news.title && news.title.includes('合作')) || 
                            (news.summary && news.summary.includes('合作')) ||
                            (news.title && news.title.includes('推廣')) || 
                            (news.summary && news.summary.includes('推廣'))) {
                            categoryType = 'cat-cooperation';
                            categoryText = '合作推廣';
                        }
                }
            } else {
                // 如果沒有分類ID，嘗試從內容判斷
                if (new Date(news.event_date) > new Date()) {
                    categoryType = 'cat-events';
                    categoryText = '活動預告';
                } else if ((news.title && news.title.includes('合作')) || 
                          (news.summary && news.summary.includes('合作')) ||
                          (news.title && news.title.includes('推廣')) || 
                          (news.summary && news.summary.includes('推廣'))) {
                    categoryType = 'cat-cooperation';
                    categoryText = '合作推廣';
                } else if ((news.title && news.title.includes('報導')) || 
                          (news.summary && news.summary.includes('報導')) ||
                          (news.title && news.title.includes('媒體')) || 
                          (news.summary && news.summary.includes('媒體'))) {
                    categoryType = 'cat-media';
                    categoryText = '媒體報導';
                } else {
                    categoryType = 'cat-news';
                    categoryText = '最新消息';
                }
            }
            
            categoryLabel.classList.add(categoryType);
            categoryLabel.textContent = categoryText;
            
            // 縮圖
            const thumbnail = document.createElement('div');
            thumbnail.className = 'thumbnail';
            thumbnail.innerHTML = `<img src="${news.thumbnail_url || '/images/placeholder.png'}" alt="${news.title || '新聞縮圖'}">`;
            
            // 內容區
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'content-wrapper';
            
            const title = document.createElement('h3');
            title.className = 'news-title';
            title.textContent = news.title || '未知標題';
            
            const summary = document.createElement('p');
            summary.className = 'news-summary';
            summary.textContent = news.summary || '';
            
            // 標籤 (如果適用)
            const tagsDiv = document.createElement('div');
            tagsDiv.className = 'tags';
            
            if (new Date(news.event_date) > new Date()) {
                const upcomingTag = document.createElement('span');
                upcomingTag.className = 'tag';
                upcomingTag.textContent = '即將到來';
                tagsDiv.appendChild(upcomingTag);
            }
            
            // 合作推廣標籤
            if ((news.title && news.title.includes('合作')) || 
                (news.summary && news.summary.includes('合作')) ||
                (news.title && news.title.includes('推廣')) || 
                (news.summary && news.summary.includes('推廣'))) {
                const coopTag = document.createElement('span');
                coopTag.className = 'tag';
                coopTag.textContent = '合作推廣';
                tagsDiv.appendChild(coopTag);
            }
            
            contentWrapper.appendChild(title);
            contentWrapper.appendChild(summary);
            if (tagsDiv.children.length > 0) {
                contentWrapper.appendChild(tagsDiv);
            }
            
            // 組合卡片（將分類標籤放在日曆標籤下方）
            const dateAndCategoryWrapper = document.createElement('div');
            dateAndCategoryWrapper.className = 'date-category-wrapper';
            
            dateAndCategoryWrapper.appendChild(dateTag);
            dateAndCategoryWrapper.appendChild(categoryLabel);
            
            newsCard.appendChild(dateAndCategoryWrapper);
            newsCard.appendChild(thumbnail);
            newsCard.appendChild(contentWrapper);
            
            newsListContainer.appendChild(newsCard);
        });
    }
    
    /**
     * 新聞卡片漸入動畫
     */
    function animateNewsIn() {
        const cards = document.querySelectorAll('.news-card');
        cards.forEach((card, index) => {
            // 設置初始狀態
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            // 設置延遲動畫以產生級聯效果
            setTimeout(() => {
                card.style.transition = 'opacity 0.5s, transform 0.5s';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 50 * index); // 每張卡片延遲 50ms
        });
    }
    
    /**
     * 渲染分頁控制
     */
    function renderPagination(totalPages, currentPage) {
        if (!paginationControls || totalPages <= 1) {
            paginationControls.innerHTML = '';
            return;
        }

        paginationControls.innerHTML = '';
        
        // 上一頁按鈕
        const prevButton = document.createElement('button');
        prevButton.textContent = '上一頁';
        prevButton.disabled = currentPage === 1;
        if (!prevButton.disabled) {
            prevButton.addEventListener('click', () => fetchNews(currentPage - 1));
        }
        paginationControls.appendChild(prevButton);
        
        // 頁碼按鈕
        const maxButtons = 5; // 最多顯示5個頁碼按鈕
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        
        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }
        
        // 第一頁按鈕
        if (startPage > 1) {
            const firstPageButton = document.createElement('button');
            firstPageButton.textContent = '1';
            firstPageButton.addEventListener('click', () => fetchNews(1));
            paginationControls.appendChild(firstPageButton);
            
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                paginationControls.appendChild(ellipsis);
            }
        }
        
        // 中間頁碼
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i.toString();
            if (i === currentPage) {
                pageButton.classList.add('active');
            } else {
                pageButton.addEventListener('click', () => fetchNews(i));
            }
            paginationControls.appendChild(pageButton);
        }
        
        // 最後一頁按鈕
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                paginationControls.appendChild(ellipsis);
            }
            
            const lastPageButton = document.createElement('button');
            lastPageButton.textContent = totalPages.toString();
            lastPageButton.addEventListener('click', () => fetchNews(totalPages));
            paginationControls.appendChild(lastPageButton);
        }
        
        // 下一頁按鈕
        const nextButton = document.createElement('button');
        nextButton.textContent = '下一頁';
        nextButton.disabled = currentPage === totalPages;
        if (!nextButton.disabled) {
            nextButton.addEventListener('click', () => fetchNews(currentPage + 1));
        }
        paginationControls.appendChild(nextButton);
    }
    
    /**
     * 打開新聞詳情模態框
     */
    async function openNewsDetailModal(newsId) {
        if (!detailModal || !detailImage || !detailTitle || !detailMeta || !detailBody) {
            console.error("Modal elements not found");
            return;
        }
        
        // 重置模態框內容
        detailImage.src = '';
        detailTitle.textContent = '加載中...';
        detailMeta.innerHTML = '';
        detailBody.textContent = '';
        
        // 顯示模態框
        detailModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // 防止背景滾動
        
        try {
            const response = await fetch(`/api/news/${newsId}`);
            if (!response.ok) {
                throw new Error(`獲取新聞詳情失敗 (HTTP ${response.status})`);
            }
            
            const news = await response.json();
            
            // 填充詳情內容
            if (news.image_url) {
                detailImage.src = news.image_url;
                detailImage.alt = news.title || '新聞圖片';
                detailImage.style.display = 'block';
            } else {
                detailImage.style.display = 'none';
            }
            
            detailTitle.textContent = news.title || '未知標題';
            
            // 格式化日期
            const eventDate = news.event_date ? new Date(news.event_date) : null;
            const updateDate = news.updated_at ? new Date(news.updated_at) : new Date();
            
            // 創建日期元素
            detailMeta.innerHTML = '';
            
            if (eventDate) {
                const eventDateSpan = document.createElement('span');
                eventDateSpan.className = 'event-date';
                eventDateSpan.textContent = `活動日期: ${eventDate.toLocaleDateString('zh-TW')}`;
                detailMeta.appendChild(eventDateSpan);
            }
            
            const updateDateSpan = document.createElement('span');
            updateDateSpan.className = 'update-date';
            updateDateSpan.textContent = `更新時間: ${updateDate.toLocaleDateString('zh-TW')}`;
            detailMeta.appendChild(updateDateSpan);
            
            // 處理內容中的連結
            if (news.content) {
                // 先進行 HTML 轉義
                const escapedContent = news.content
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
                
                // 換行符轉為 <br>
                let formattedContent = escapedContent.replace(/\n/g, '<br>');
                
                // 轉換 URL 為可點擊連結
                formattedContent = formattedContent.replace(
                    /(https?:\/\/[^\s<]+)/g,
                    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
                );
                
                detailBody.innerHTML = formattedContent;
            } else {
                detailBody.textContent = '沒有詳細內容。';
            }
            
        } catch (error) {
            console.error('獲取新聞詳情失敗:', error);
            detailTitle.textContent = '加載失敗';
            detailBody.textContent = `無法加載新聞詳情: ${error.message}`;
            detailImage.style.display = 'none';
        }
    }
    
    /**
     * 設置新聞詳情模態框
     */
    function setupNewsModal() {
        // 關閉按鈕點擊事件
        if (modalClose) {
            modalClose.addEventListener('click', closeNewsDetailModal);
        }
        
        // 點擊模態框背景關閉
        detailModal.addEventListener('click', (event) => {
            if (event.target === detailModal) {
                closeNewsDetailModal();
            }
        });
        
        // ESC 鍵關閉模態框
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && detailModal.style.display === 'flex') {
                closeNewsDetailModal();
            }
        });
    }
    
    /**
     * 關閉新聞詳情模態框
     */
    function closeNewsDetailModal() {
        if (detailModal) {
            detailModal.style.display = 'none';
            document.body.style.overflow = ''; // 恢復滾動
        }
    }
    
    /**
     * 設置回到頂部按鈕
     */
    function setupBackToTop() {
        if (!backToTopButton) {
            console.error("返回頂部按鈕元素未找到！");
            return;
        }
        
        // 監聽滾動事件
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
        });
        
        // 點擊回到頂部
        backToTopButton.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
    /**
     * 設置角色互動效果
     */
    function setupCharacterInteractions() {
        const characters = document.querySelectorAll('.floating-character');
        
        // 定義每個角色的對話內容
        const speeches = {
            'pink-character': ['哈囉！', '有看到新消息嗎？', '有什麼新活動？'],
            'blue-character': ['嗨！你好！', '新消息來囉！', '查看最新活動吧！'],
            'yellow-character': ['耶！找到我了！', '最新消息都在這！', '超級開心！']
        };
        
        // 為每個角色創建對話氣泡元素
        characters.forEach(character => {
            // 創建對話氣泡
            const speechBubble = document.createElement('div');
            speechBubble.className = 'character-speech';
            character.appendChild(speechBubble);
            
            // 獲取角色類型
            const characterType = Array.from(character.classList)
                .find(cls => cls.includes('-character') && cls !== 'floating-character');
            
            // 觸摸/點擊事件處理
            character.addEventListener('touchstart', handleInteraction, { passive: true });
            character.addEventListener('click', handleInteraction);
            
            function handleInteraction(e) {
                // 防止事件冒泡和默認行為
                e.stopPropagation();
                if (e.type === 'click') e.preventDefault();
                
                // 已經被觸摸，忽略
                if (character.classList.contains('touched') || 
                    character.classList.contains('bounce-back')) return;
                
                // 添加觸摸效果
                character.classList.add('touched');
                
                // 隨機選擇一句對話
                const possibleSpeeches = speeches[characterType] || ['嗨！'];
                const randomSpeech = possibleSpeeches[Math.floor(Math.random() * possibleSpeeches.length)];
                
                // 顯示對話氣泡
                speechBubble.textContent = randomSpeech;
                speechBubble.classList.add('visible');
                
                // 1秒後移除觸摸效果，添加彈回動畫
                setTimeout(() => {
                    character.classList.remove('touched');
                    character.classList.add('bounce-back');
                    
                    // 1.5秒後隱藏對話氣泡
                    setTimeout(() => {
                        speechBubble.classList.remove('visible');
                    }, 1500);
                    
                    // 動畫結束後移除彈回類
                    setTimeout(() => {
                        character.classList.remove('bounce-back');
                    }, 800);
                }, 1000);
            }
        });
    }
    
    /**
     * 檢測設備類型並適配
     */
    function detectDevice() {
        const isMobile = window.innerWidth <= 767;
        document.body.classList.toggle('is-mobile', isMobile);
    }
    
    // 初始化檢測設備類型
    detectDevice();
    
    // 窗口尺寸改變時重新檢測
    window.addEventListener('resize', detectDevice);

    // 获取并显示新闻分类
    async function loadCategories() {
        try {
            const response = await fetch('/api/news-categories');
            if (!response.ok) throw new Error('API請求失敗');
            const categories = await response.json();
            renderCategories(categories);
        } catch (error) {
            console.error('加載分類失敗:', error);
            // 使用硬編碼的備用分類
            renderCategories([
                { id: 'all', name: '全部消息', slug: 'all' },
                { id: 1, name: '最新消息', slug: 'latest' },
                { id: 2, name: '活動預告', slug: 'events' },
                { id: 3, name: '媒體報導', slug: 'media' }
            ]);
        }
        loadNews(1);
    }

    // 获取并显示新闻列表（支持分页和分类）
    async function loadNews(page = 1, categoryId = null) {
        const newsListContainer = document.getElementById('news-list');
        const paginationControls = document.getElementById('pagination-controls');
        if (!newsListContainer || !paginationControls) return;

        currentPage = page;
        currentCategoryId = categoryId; // 更新当前分类

        newsListContainer.innerHTML = '<p>正在加載最新消息...</p>';
        paginationControls.innerHTML = '';

        try {
            let url = `/api/news?page=${currentPage}&limit=${itemsPerPage}`;
            if (currentCategoryId !== null && currentCategoryId !== '') {
                url += `&category=${currentCategoryId}`; // 后端使用 'category' 参数
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`获取新闻失败 (HTTP ${response.status})`);
            }

            const data = await response.json();
            totalPages = data.totalPages;

            if (data.news.length === 0) {
                newsListContainer.innerHTML = '<p>此分類暫無相關消息</p>';
                renderPagination(0, 1);
                return;
            }

            renderNewsCards(data.news); // 调用你现有的渲染函数
            renderPagination(totalPages, currentPage); // 调用你现有的分页函数
            animateNewsIn(); // 调用你现有的动画函数

        } catch (error) {
            console.error('获取新闻失败:', error);
            newsListContainer.innerHTML = `<p class="error-text">無法加載最新消息，請稍後再試。</p>`;
            renderPagination(0, 1);
        }
    }

    // 绑定分类按钮点击事件的辅助函数
    function bindCategoryLinks() {
        const categoryTabs = document.getElementById('category-tabs');
        if (!categoryTabs) return;

        categoryTabs.querySelectorAll('.category-link').forEach(link => {
            // 移除旧监听器（如果有）
            link.removeEventListener('click', handleCategoryClick); 
            // 添加新监听器
            link.addEventListener('click', handleCategoryClick);
        });
    }

    // 分类按钮点击处理函数
    function handleCategoryClick(event) {
        event.preventDefault();
        
        // 'this' 指向被点击的链接
        const categoryTabs = document.getElementById('category-tabs');
        if (!categoryTabs) return;

        // 更新链接激活状态
        categoryTabs.querySelectorAll('.category-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');

        // 获取分类 ID 并加载新闻
        const categoryId = this.getAttribute('data-category');
        loadNews(1, categoryId); // 点击分类时，总是加载第一页
    }

    // 在 loadNews 函數之前添加
    function renderCategories(categories) {
        const categoryTabs = document.getElementById('category-tabs');
        if (!categoryTabs) return;
        
        categoryTabs.innerHTML = '';
        
        // 添加"全部"链接
        const allLink = document.createElement('a');
        allLink.className = 'category-link active';
        allLink.setAttribute('data-category', '');
        allLink.href = '#';
        allLink.textContent = '全部消息';
        categoryTabs.appendChild(allLink);
        
        // 添加其他分類链接
        categories.forEach(category => {
            if (category.id === 'all') return; // 跳過已添加的"全部"選項
            
            const link = document.createElement('a');
            link.className = 'category-link';
            link.setAttribute('data-category', category.id);
            link.href = '#';
            link.textContent = category.name;
            categoryTabs.appendChild(link);
        });
        
        // 綁定點擊事件
        bindCategoryLinks();
    }

    // *** 修改点：调用新的初始化函数 ***
    loadCategories(); // 首先加载分类
    loadNews(1);      // 然后加载第一页的全部新闻
});