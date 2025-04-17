// news.js 更新版本
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素引用 ---
    const newsListContainer = document.getElementById('news-list');
    const paginationControls = document.getElementById('pagination-controls');
    const detailModal = document.getElementById('news-detail-modal');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailMeta = document.getElementById('detail-meta');
    const detailBody = document.getElementById('detail-body');
    const backToTopButton = document.getElementById('back-to-top');
    const sortLinks = document.querySelectorAll('.sort-link');

    // --- Banner 相關元素 ---
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null;

    // --- 分頁變數 ---
    let currentPage = 1;
    const itemsPerPage = 10; // 每頁顯示數量
    let currentSortType = 'latest'; // 當前排序

    // --- 函數定義 ---

    /**
     * 獲取並顯示 News 類型輪播圖
     */
    async function fetchAndDisplayBanners() {
        console.log("[News] Fetching banners for news page");
        if (!bannerWrapper) {
            console.warn("Banner wrapper element not found");
            const carouselElement = document.getElementById('banner-carousel');
            if (carouselElement) carouselElement.style.display = 'none';
            return;
        }
        
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#f0f0f0;">載入輪播圖中...</div>';

        try {
            const response = await fetch('/api/banners?page=news');
            console.log("[News] Banner API response status:", response.status);
            if (!response.ok) {
                let errorText = `獲取輪播圖失敗 (HTTP ${response.status})`;
                try { const data = await response.json(); errorText += `: ${data.error || response.statusText}`; } catch (e) {}
                throw new Error(errorText);
            }
            const banners = await response.json();
            console.log(`[News] Received ${banners.length} banners for news page`);
            bannerWrapper.innerHTML = '';
            if (banners.length === 0) {
                console.log("[News] No banners for news page, showing default");
                const defaultSlide = document.createElement('div');
                defaultSlide.className = 'swiper-slide';
                defaultSlide.innerHTML = '<img src="/images/news-default-banner.jpg" alt="最新消息" style="width:100%; height:100%; object-fit:cover;">';
                bannerWrapper.appendChild(defaultSlide);
            } else {
                banners.forEach(banner => {
                    const slide = document.createElement('div');
                    slide.className = 'swiper-slide';
                    if (banner.link_url) {
                        const link = document.createElement('a');
                        link.href = banner.link_url;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.innerHTML = `<img src="${banner.image_url}" alt="${banner.alt_text || '最新消息輪播圖'}" style="width:100%; height:100%; object-fit:cover;">`;
                        slide.appendChild(link);
                    } else {
                        slide.innerHTML = `<img src="${banner.image_url}" alt="${banner.alt_text || '最新消息輪播圖'}" style="width:100%; height:100%; object-fit:cover;">`;
                    }
                    bannerWrapper.appendChild(slide);
                });
            }
            if (bannerSwiper) {
                bannerSwiper.destroy(true, true);
                bannerSwiper = null;
            }
            if (bannerWrapper.children.length > 0) {
                bannerSwiper = new Swiper('#banner-carousel', {
                    loop: banners.length > 1,
                    autoplay: { delay: 8000, disableOnInteraction: false, pauseOnMouseEnter: true },
                    pagination: { el: '.swiper-pagination', clickable: true },
                    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
                    slidesPerView: 1,
                    spaceBetween: 0,
                    effect: 'fade',
                    fadeEffect: { crossFade: true }
                });
            }
        } catch (error) {
            console.error("[News] Banner error:", error);
            bannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#fdd; color:#d33;">輪播圖載入失敗</div>';
            const carouselElement = document.getElementById('banner-carousel');
            if (carouselElement) {
                const navElements = carouselElement.querySelectorAll('.swiper-button-next, .swiper-button-prev, .swiper-pagination');
                navElements.forEach(el => el.style.display = 'none');
            }
        }
    }

    /**
     * 獲取並顯示指定頁數的消息
     */
    async function fetchNews(page = 1, sortType = 'latest') {
        console.log(`[News] Fetching news page ${page} with sort: ${sortType}`);
        if (!newsListContainer || !paginationControls) { console.error("Missing required elements"); return; }
        currentPage = page;
        currentSortType = sortType;
        newsListContainer.innerHTML = '<p>正在加載最新消息...</p>';
        paginationControls.innerHTML = '';
        
        try {
            const response = await fetch(`/api/news?page=${page}&limit=${itemsPerPage}`);
            if (!response.ok) {
                let errorText = `獲取消息失敗 (HTTP ${response.status})`;
                try { const data = await response.json(); errorText += `: ${data.error || response.statusText}`; } catch (e) {}
                throw new Error(errorText);
            }
            const data = await response.json();
            console.log(`[News] Received ${data.news.length} news items`);
            
            // 依據排序類型過濾結果
            let filteredNews = data.news;
            
            // 如果是活動預告，只顯示未來的事件
            if (sortType === 'upcoming') {
                const now = new Date();
                filteredNews = data.news.filter(item => {
                    if (!item.event_date) return false;
                    const eventDate = new Date(item.event_date);
                    return eventDate > now;
                });
            } 
            // 如果是合作推廣，只顯示含有特定標籤或關鍵字的項目（假設標題或摘要中含有「合作」、「推廣」等字樣）
            else if (sortType === 'promotion') {
                const keywords = ['合作', '推廣', '聯名', '限定'];
                filteredNews = data.news.filter(item => {
                    return keywords.some(keyword => 
                        (item.title && item.title.includes(keyword)) || 
                        (item.summary && item.summary.includes(keyword))
                    );
                });
            }
            
            displayNews(filteredNews);
            renderPagination(data.totalPages, data.currentPage);
        } catch (error) {
            console.error("[News] Fetch news error:", error);
            if (newsListContainer) { newsListContainer.innerHTML = `<p class="error">無法加載消息: ${error.message}</p>`; }
        }
    }

    /**
     * 渲染消息列表 (新佈局)
     */
    function displayNews(newsList) {
        if (!newsListContainer) return;
        newsListContainer.innerHTML = '';
        if (!newsList || newsList.length === 0) {
            newsListContainer.innerHTML = '<p>沒有符合條件的消息。</p>';
            return;
        }
        
        newsList.forEach(newsItem => {
            // 創建卡片容器
            const card = document.createElement('div');
            card.className = 'product-card'; // 使用與商品卡片相同的樣式基礎
            card.onclick = () => openNewsDetailModal(newsItem.id);
            card.style.cursor = 'pointer';
            
            // 創建圖片容器
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';
            const imageElement = document.createElement('img');
            imageElement.src = newsItem.thumbnail_url || '/images/placeholder.png';
            imageElement.alt = newsItem.title || '新聞縮圖';
            imageContainer.appendChild(imageElement);
            
            // 創建內容區域
            const contentDiv = document.createElement('div');
            contentDiv.className = 'card-content';
            
            // 添加標題
            const titleElement = document.createElement('h3');
            titleElement.textContent = newsItem.title || '無標題';
            
            // 添加日期
            const dateParagraph = document.createElement('p');
            dateParagraph.className = 'news-date';
            
            // 格式化日期
            let displayDate = '日期未知';
            if (newsItem.event_date && !isNaN(new Date(newsItem.event_date))) {
                displayDate = new Date(newsItem.event_date).toLocaleDateString('zh-TW');
            } else if (newsItem.updated_at && !isNaN(new Date(newsItem.updated_at))) {
                displayDate = new Date(newsItem.updated_at).toLocaleDateString('zh-TW');
            }
            dateParagraph.textContent = displayDate;
            
            // 添加摘要
            const summaryParagraph = document.createElement('p');
            summaryParagraph.className = 'news-summary';
            summaryParagraph.textContent = newsItem.summary || '';
            
            // 組裝內容
            contentDiv.appendChild(titleElement);
            contentDiv.appendChild(dateParagraph);
            contentDiv.appendChild(summaryParagraph);
            
            // 組裝卡片
            card.appendChild(imageContainer);
            card.appendChild(contentDiv);
            
            // 添加到容器
            newsListContainer.appendChild(card);
        });
        
        // 添加卡片動畫
        animateNewsCardsIn();
    }

    /**
     * 新聞卡片漸入動畫
     */
    function animateNewsCardsIn() {
        const cards = document.querySelectorAll('.product-card');
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
     * 渲染分頁控制按鈕
     */
    function renderPagination(totalPages, currentPage) {
        if (!paginationControls || totalPages <= 1) {
             if (paginationControls) paginationControls.innerHTML = ''; // 清空以防萬一
             return;
        }
        paginationControls.innerHTML = '';
        const createButton = (page, text, isActive = false, isDisabled = false) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.disabled = isDisabled;
            if (isActive) button.classList.add('active');
            if (!isDisabled && !isActive) { button.addEventListener('click', () => fetchNews(page, currentSortType)); }
            return button;
        };
        paginationControls.appendChild(createButton(currentPage - 1, '上一頁', false, currentPage === 1));
        const maxPagesToShow = 5; // 最多顯示多少個頁碼按鈕
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        // 如果結束頁碼太小，重新調整開始頁碼
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        if (startPage > 1) { paginationControls.appendChild(createButton(1, '1')); if (startPage > 2) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; paginationControls.appendChild(ellipsis); } }
        for (let i = startPage; i <= endPage; i++) { paginationControls.appendChild(createButton(i, i.toString(), i === currentPage)); }
        if (endPage < totalPages) { if (endPage < totalPages - 1) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; paginationControls.appendChild(ellipsis); } paginationControls.appendChild(createButton(totalPages, totalPages.toString())); }
        paginationControls.appendChild(createButton(currentPage + 1, '下一頁', false, currentPage === totalPages));
    }

    /**
     * 打開並填充消息詳情 Modal
     */
    async function openNewsDetailModal(newsId) {
        if (!detailModal || !detailImage || !detailTitle || !detailMeta || !detailBody) {
            console.error("Missing modal elements");
            return;
        }

        detailImage.src = '';
        detailImage.style.display = 'none'; // 先隱藏圖片
        detailTitle.textContent = '加載中...';
        detailMeta.textContent = '';
        detailBody.innerHTML = ''; // 清空舊內容
        detailModal.style.display = 'flex'; // 顯示 Modal

        try {
            const response = await fetch(`/api/news/${newsId}`);
            if (!response.ok) {
                let errorText = `無法獲取消息詳情 (HTTP ${response.status})`;
                if (response.status === 404) {
                    errorText = '找不到指定的消息。';
                } else {
                    try {
                        const data = await response.json();
                        errorText += `: ${data.error || response.statusText}`;
                    } catch (e) {}
                }
                throw new Error(errorText);
            }

            const newsItem = await response.json();

            // 填充 Modal 內容
            if (newsItem.image_url) { // 檢查是否有大圖 URL
               detailImage.src = newsItem.image_url;
               detailImage.alt = newsItem.title || '消息圖片';
               detailImage.style.display = 'block'; // 有 URL 才顯示
            } else {
                detailImage.style.display = 'none'; // 沒有 URL 就隱藏
            }
            detailTitle.textContent = newsItem.title || '無標題';

            let metaText = '';
            if (newsItem.event_date && !isNaN(new Date(newsItem.event_date))) {
                metaText += `活動日期: ${new Date(newsItem.event_date).toLocaleDateString('zh-TW')} | `;
            }
            if (newsItem.updated_at && !isNaN(new Date(newsItem.updated_at))) {
                metaText += `更新時間: ${new Date(newsItem.updated_at).toLocaleString('zh-TW')}`;
            } else {
                 metaText += `更新時間: N/A`; // 如果 updated_at 也無效
            }
            detailMeta.textContent = metaText.trim().endsWith('|') ? metaText.trim().slice(0, -1).trim() : metaText.trim(); // 移除結尾多餘的 |

            // 處理內文中的網址轉換為連結
            if (newsItem.content) {
                // 1. HTML Escape (防止 XSS)
                const escapedContent = newsItem.content
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');

                // 2. 將換行符 (\n) 替換成 <br>
                let formattedContent = escapedContent.replace(/\n/g, '<br>');

                // 3. 使用正則表達式將網址轉換為 <a> 標籤
                formattedContent = formattedContent.replace(
                    /(https?:\/\/[^\s<]+)/g, // 避免匹配到已生成的 <br> 或其他 HTML 標籤
                    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
                );

                // 4. 使用 innerHTML 插入處理後的內容
                detailBody.innerHTML = formattedContent;
            } else {
                detailBody.textContent = '沒有詳細內容。';
            }

        } catch (error) {
            console.error("[News] Detail modal error:", error);
            detailTitle.textContent = '加載失敗';
            detailBody.textContent = error.message;
            detailImage.style.display = 'none'; // 加載失敗也隱藏圖片區
        }
    }

    /**
     * 設置返回頂部按鈕
     */
    function setupBackToTop() {
        if (!backToTopButton) {
            console.error("返回頂部按鈕元素未找到！");
            return;
        }
        
        // 監聽滾動事件
        window.addEventListener('scroll', function() {
            const scrollTrigger = 300;
            if (window.scrollY > scrollTrigger) {
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
                        fetchNews(1, sortBy);
                    } else {
                        console.warn("排序連結缺少 data-sort 屬性:", link);
                        fetchNews(1, 'latest');
                    }
                });
            });
        }
    }

    // --- 全局函數 ---
    window.closeNewsDetailModal = function() { 
        if (detailModal) { detailModal.style.display = 'none'; } 
    };
    
    window.onclick = function(event) { 
        if (event.target === detailModal) { closeNewsDetailModal(); } 
    };

    // --- 頁面初始化 ---
    async function initializePage() {
        console.log("[News] Initializing page with new layout");
        if (!newsListContainer || !paginationControls || !detailModal || !bannerWrapper) {
            console.error("頁面初始化失敗：缺少必要的 HTML 元素。");
            // 可以在頁面上顯示更明顯的錯誤提示
            document.body.innerHTML = '<p style="color:red; text-align:center; padding: 2rem;">頁面載入錯誤，請聯繫管理員。</p>';
            return;
        }
        
        // 設置返回頂部按鈕
        setupBackToTop();
        
        // 設置排序連結事件
        setupSortLinks();
        
        try {
            // 同時獲取 Banner 和第一頁新聞
            await Promise.all([
                fetchAndDisplayBanners(),
                fetchNews(1, 'latest')
            ]);
            console.log("[News] Page initialized successfully");
        } catch (error) {
            console.error("[News] Initialization failed:", error);
            // 可以在 newsListContainer 顯示錯誤
             if (newsListContainer) {
                 newsListContainer.innerHTML = `<p class="error">頁面初始化失敗: ${error.message}</p>`;
             }
        }
    }

    initializePage();

}); // End of DOMContentLoaded