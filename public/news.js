// news.js
document.addEventListener('DOMContentLoaded', () => {
    // 先尝试加载分类，即使失败也会在后面加载新闻
    loadCategories();
    
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
            
            // 組合卡片
            newsCard.appendChild(dateTag);
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
});

// 修改后的loadCategories函数
async function loadCategories() {
  try {
    const response = await fetch('/api/news-categories'); 
    
    if (!response.ok) {
      throw new Error('加载分类失败');
    }
    
    const categories = await response.json();
    const categoryNav = document.getElementById('category-nav');
    if (!categoryNav) return; // If nav doesn't exist, exit
    
    // 清空现有按钮
    categoryNav.innerHTML = '';
    
    // 添加"全部"选项
    categoryNav.innerHTML += `<button class="category-btn active" data-category="">全部消息</button>`;
    
    // 添加各分类按钮
    categories.forEach(category => {
      categoryNav.innerHTML += `
        <button class="category-btn" data-category="${category.id}" data-slug="${category.slug}">
          ${category.name}
        </button>
      `;
    });
    
    // 添加点击事件监听
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const categoryId = this.getAttribute('data-category');
        loadNews(1, categoryId); // Always load page 1 when category changes
      });
    });
    
    // 加载所有新闻
    loadNews(1);
  } catch (error) {
    console.error('加载分类失败:', error);
    
    // 即使分类加载失败，也显示默认分类
    const categoryNav = document.getElementById('category-nav');
    if (categoryNav) {
      categoryNav.innerHTML = `
        <button class="category-btn active" data-category="">全部消息</button>
        <button class="category-btn" data-category="news">最新消息</button>
        <button class="category-btn" data-category="events">活動預告</button>
        <button class="category-btn" data-category="promo">合作推廣</button>
      `;
      
      // 添加默认分类点击事件 (使用 fetchNewsByFilter 可能不再需要，改為直接調用 loadNews)
      document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          const categoryId = this.getAttribute('data-category'); // 'news', 'events', 'promo' or ''
          // --- FIX: Call loadNews with category ID ---
          loadNews(1, categoryId); // Assuming backend handles slugs or IDs
        });
      });
    }
    
    console.log('Executing fetchNews from catch block due to category load failure.'); 
    // --- FIX: Ensure fetchNews is called with correct parameters ---
    loadNews(1); // Load page 1 of all news if categories fail
  }
}

// 添加一个按筛选器加载新闻的函数
function fetchNewsByFilter(filter) {
  if (!filter || filter === '') {
    fetchNews(1); // 加载所有新闻
    return;
  }
  
  // 根据不同类型筛选
  currentPage = 1;
  if (filter === 'events') {
    currentSortBy = 'upcoming';
  } else if (filter === 'promo') {
    currentSortBy = 'cooperation';
  } else {
    currentSortBy = 'latest';
  }
  
  fetchNews(1);
}

// --- Function to Fetch and Display ALL News in the Table ---
// --- FIX: Added categoryId parameter and updated URL construction ---
async function loadNews(page = 1, categoryId = null) { 
    const newsListContainer = document.getElementById('news-list');
    const paginationControls = document.getElementById('pagination-controls');
    if (!newsListContainer || !paginationControls) {
        console.error("Element not found for news list or pagination");
        return;
    }
    
    currentPage = page;
    newsListContainer.innerHTML = '<p>正在加載最新消息...</p>';
    paginationControls.innerHTML = '';
    
    try {
        // --- FIX: Construct URL correctly ---
        let url = `/api/news?page=${page}&limit=${itemsPerPage}`;
        if (categoryId !== null && categoryId !== '') { // Check if categoryId is provided and not empty
             url += `&category=${categoryId}`; // Use 'category' query param as per backend
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`獲取新聞失敗 (HTTP ${response.status})`);
        }
        
        const data = await response.json();
        totalPages = data.totalPages;
        
        if (data.news.length === 0) {
            newsListContainer.innerHTML = '<p>此分類暫無相關消息</p>';
            renderPagination(0, 1); // Pass 0 total pages
            return;
        }
        
        renderNewsCards(data.news);
        renderPagination(totalPages, currentPage);
        animateNewsIn();
        
    } catch (error) {
        console.error('獲取新聞失敗:', error);
        newsListContainer.innerHTML = `<p class="error-text">無法加載最新消息，請稍後再試。</p>`;
        renderPagination(0, 1); // Clear pagination on error
    }
}

// ... (rest of the functions: initSwiper, renderNewsCards, renderPagination, openNewsDetailModal, etc.) ...