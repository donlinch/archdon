// public/news.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素引用 ---
    const newsListContainer = document.getElementById('news-list');
    const paginationControls = document.getElementById('pagination-controls');
    const detailModal = document.getElementById('news-detail-modal');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailMeta = document.getElementById('detail-meta');
    const detailBody = document.getElementById('detail-body');

    // --- Banner 相關元素 ---
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null;

    // --- 分頁變數 ---
    let currentPage = 1;
    const itemsPerPage = 10;

    // --- 函數定義 ---
/**
 * 獲取並顯示隨機的 News 類型輪播圖
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
        // 確保 API 請求指定的是 news 頁面的資料
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

        // 初始化 Swiper
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
    async function fetchNews(page = 1) {
        console.log(`[News] Fetching news page ${page}`);
        if (!newsListContainer || !paginationControls) { console.error("Missing required elements"); return; }
        currentPage = page;
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
            displayNews(data.news);
            renderPagination(data.totalPages, data.currentPage);
        } catch (error) {
            console.error("[News] Fetch news error:", error);
            if (newsListContainer) { newsListContainer.innerHTML = `<p class="error">無法加載消息: ${error.message}</p>`; }
        }
    }

    /**
     * 渲染消息列表
     */
    function displayNews(newsList) {
        if (!newsListContainer) return;
        newsListContainer.innerHTML = '';
        if (!newsList || newsList.length === 0) { newsListContainer.innerHTML = '<p>目前沒有最新消息。</p>'; return; }
        newsList.forEach(newsItem => {
            const card = document.createElement('div');
            card.className = 'news-card';
            const dateTag = document.createElement('div');
            dateTag.className = 'date-tag';
            if (newsItem.event_date) {
                const eventDate = new Date(newsItem.event_date);
                const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
                const dayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
                dateTag.innerHTML = `<span class="month">${monthNames[eventDate.getMonth()]}</span><span class="day">${eventDate.getDate()}</span><span class="weekday">${dayNames[eventDate.getDay()]}</span>`;
            } else {
                const updatedDate = new Date(newsItem.updated_at);
                dateTag.innerHTML = `<span class="month">${updatedDate.getMonth() + 1}月</span><span class="day">${updatedDate.getDate()}</span><span class="weekday">更新</span>`;
            }
            const thumbnailDiv = document.createElement('div');
            thumbnailDiv.className = 'thumbnail';
            const thumbnailImg = document.createElement('img');
            thumbnailImg.src = newsItem.thumbnail_url || '/images/placeholder.png';
            thumbnailImg.alt = newsItem.title || '縮圖';
            thumbnailDiv.appendChild(thumbnailImg);
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'content-wrapper';
            contentWrapper.onclick = () => openNewsDetailModal(newsItem.id);
            contentWrapper.style.cursor = 'pointer';
            const titleH3 = document.createElement('h3');
            titleH3.className = 'news-title';
            titleH3.textContent = newsItem.title || '無標題';
            const summaryP = document.createElement('p');
            summaryP.className = 'news-summary';
            summaryP.textContent = newsItem.summary || '';
            contentWrapper.appendChild(titleH3);
            contentWrapper.appendChild(summaryP);
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions';
            const likeButton = document.createElement('button');
            likeButton.className = 'like-button';
            likeButton.innerHTML = '<span class="heart-icon">♡</span>';
            const likeCountSpan = document.createElement('span');
            likeCountSpan.className = 'like-count';
            likeCountSpan.textContent = newsItem.like_count || 0;
            likeButton.onclick = async (event) => { event.stopPropagation(); await likeNews(newsItem.id, likeButton, likeCountSpan); };
            actionsDiv.appendChild(likeButton);
            actionsDiv.appendChild(likeCountSpan);
            card.appendChild(dateTag);
            card.appendChild(thumbnailDiv);
            card.appendChild(contentWrapper);
            card.appendChild(actionsDiv);
            newsListContainer.appendChild(card);
        });
    }

    /**
     * 渲染分頁控制按鈕
     */
    function renderPagination(totalPages, currentPage) {
        if (!paginationControls || totalPages <= 1) return;
        paginationControls.innerHTML = '';
        const createButton = (page, text, isActive = false, isDisabled = false) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.disabled = isDisabled;
            if (isActive) button.classList.add('active');
            if (!isDisabled && !isActive) { button.addEventListener('click', () => fetchNews(page)); }
            return button;
        };
        paginationControls.appendChild(createButton(currentPage - 1, '上一頁', false, currentPage === 1));
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
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
        detailTitle.textContent = '加載中...'; 
        detailMeta.textContent = ''; 
        detailBody.innerHTML = '';
        detailModal.style.display = 'flex';
        
        try {
            const response = await fetch(`/api/news/${newsId}`);
            if (!response.ok) {
                let errorText = `無法獲取消息詳情 (HTTP ${response.status})`;
                try { 
                    const data = await response.json(); 
                    errorText += `: ${data.error || response.statusText}`; 
                } catch (e) {}
                throw new Error(errorText);
            }
            
            const newsItem = await response.json();
    
            detailImage.src = newsItem.image_url || '/images/placeholder.png';
            detailImage.alt = newsItem.title || '消息圖片';
            detailTitle.textContent = newsItem.title || '無標題';
            
            let metaText = '';
            if (newsItem.event_date) { 
                metaText += `活動日期: ${new Date(newsItem.event_date).toLocaleDateString('zh-TW')} | `; 
            }
            metaText += `更新時間: ${new Date(newsItem.updated_at).toLocaleString('zh-TW')}`;
            detailMeta.textContent = metaText;
    
            // --- 修改這裡：處理內文中的網址轉換為連結 ---
            if (newsItem.content) {
                // 1. 先將換行符 (\n) 替換成 <br>
                let formattedContent = newsItem.content.replace(/\n/g, '<br>');
                
                // 2. 使用正則表達式將網址轉換為 <a> 標籤
                formattedContent = formattedContent.replace(
                    /(https?:\/\/[^\s]+)/g, 
                    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
                );
                
                // 3. 使用 innerHTML 安全地插入處理後的內容
                detailBody.innerHTML = formattedContent;
            } else {
                detailBody.textContent = '沒有詳細內容。';
            }
            
        } catch (error) {
            console.error("[News] Detail modal error:", error);
            detailTitle.textContent = '加載失敗';
            detailBody.textContent = error.message;
        }
    }
    /**
     * 處理按讚請求
     */
    async function likeNews(newsId, likeButtonElement, countElement) {
        const isLiked = likeButtonElement.classList.contains('liked');
        const currentCount = parseInt(countElement.textContent) || 0;
        if (isLiked) { console.log("Already liked"); return; }
        likeButtonElement.classList.add('liked');
        likeButtonElement.querySelector('.heart-icon').textContent = '♥';
        countElement.textContent = currentCount + 1;
        likeButtonElement.disabled = true;
        try {
            const response = await fetch(`/api/news/${newsId}/like`, { method: 'POST' });
            if (!response.ok) { throw new Error(`按讚失敗 (HTTP ${response.status})`); }
            const data = await response.json();
            if (data?.like_count !== undefined) { countElement.textContent = data.like_count; }
        } catch (error) {
            console.error("[News] Like error:", error);
            likeButtonElement.classList.remove('liked');
            likeButtonElement.querySelector('.heart-icon').textContent = '♡';
            countElement.textContent = currentCount;
        } finally {
            likeButtonElement.disabled = false;
        }
    }

    // --- 全局函數 ---
    window.closeNewsDetailModal = function() { if (detailModal) { detailModal.style.display = 'none'; } };
    window.onclick = function(event) { if (event.target === detailModal) { closeNewsDetailModal(); } };

    // --- 頁面初始化 ---
// 頁面初始化
async function initializePage() {
    console.log("[News] Initializing page");
    try {
        await Promise.all([ fetchAndDisplayBanners(), fetchNews(1) ]);  // 同時初始化輪播圖與新聞
        console.log("[News] Page initialized");
    } catch (error) { 
        console.error("[News] Initialization error:", error); 
    }
}

initializePage();

});