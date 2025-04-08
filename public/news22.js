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





// public/news2.js (整合行事曆功能)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const newsListContainer = document.getElementById('news-list');
    const paginationControls = document.getElementById('pagination-controls');

    // Calendar elements
    const calendarSection = document.getElementById('calendar-section');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarLoading = calendarGrid ? calendarGrid.querySelector('.calendar-loading') : null;
    const calendarLegend = document.getElementById('calendar-legend'); // 可選的圖例

    // Event Modal elements
    const eventDetailModal = document.getElementById('event-detail-modal');
    const eventModalTitle = document.getElementById('event-modal-title');
    const eventModalBody = document.getElementById('event-modal-body');
    const closeEventModalBtn = document.getElementById('close-event-modal-btn'); // 右上角 X
    const modalCloseBtns = eventDetailModal ? eventDetailModal.querySelectorAll('.close-modal-btn') : []; // 所有帶 class 的關閉按鈕

    // --- State Variables ---
    let currentNewsPage = 1; //下方新聞列表的當前頁
    let currentCalendarDate = new Date(); // 行事曆當前顯示的年月
    let calendarEventsCache = new Map(); // 緩存 API 獲取的事件數據 { "YYYY-MM": [events] }
    let categoryColors = {}; // 用於存儲分類和顏色的映射 (可選)

    // --- Helper Functions ---
    const escapeHtml = (unsafe) => { /* ... (同 news-admin.js 中的 escapeHtml) ... */
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe.toString().replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">")
             // " 轉成 & q u o t ;
             .replace(/"/g, '&quot;')
        
             // ' 轉成 & # 3 9 ;  (數字實體)
             .replace(/'/g, '&#39;');
    };
    function openModal(modalElement) { if (modalElement) modalElement.style.display = 'flex'; }
    function closeModal(modalElement) { if (modalElement) modalElement.style.display = 'none'; }
    function formatDateYYYYMMDD(date) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // --- News List Functions (下方列表) ---
    async function fetchNewsList(page = 1) {
        console.log(`[NewsList] Fetching news page ${page}`);
        if (!newsListContainer || !paginationControls) { console.error("Missing news list or pagination elements"); return; }
        currentNewsPage = page;
        newsListContainer.innerHTML = '<p>正在加載最新消息...</p>';
        paginationControls.innerHTML = '';
        try {
            // 注意：這裡不傳 category，獲取所有新聞
            const response = await fetch(`/api/news?page=${page}&limit=10`);
            if (!response.ok) { /* ... error handling ... */ throw new Error(`獲取消息失敗 (HTTP ${response.status})`); }
            const data = await response.json();
            renderNewsList(data.news);
            renderNewsPagination(data.totalPages, data.currentPage);
        } catch (error) { console.error("[NewsList] Fetch error:", error); if (newsListContainer) { newsListContainer.innerHTML = `<p class="error">無法加載消息: ${error.message}</p>`; } }
    }

    function renderNewsList(newsList) { // 渲染下方列表的邏輯 (基本與 news.js 相同)
        if (!newsListContainer) return;
        newsListContainer.innerHTML = '';
        if (!newsList || newsList.length === 0) { newsListContainer.innerHTML = '<p>目前沒有最新消息。</p>'; return; }
        newsList.forEach(newsItem => {
            const card = document.createElement('div'); card.className = 'news-card';
            // 點擊卡片跳轉到詳情頁
            card.onclick = () => { window.location.href = `/news/${newsItem.id}`; };
            card.style.cursor = 'pointer';

            const dateTag = document.createElement('div'); dateTag.className = 'date-tag'; /* ... (填充日期標籤 HTML) ... */
            if (newsItem.event_date) { const d = new Date(newsItem.event_date); const m = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]; const w = ["日", "一", "二", "三", "四", "五", "六"]; dateTag.innerHTML = `<span class="month">${m[d.getMonth()]}</span><span class="day">${d.getDate()}</span><span class="weekday">星期${w[d.getDay()]}</span>`; }
             else { const d = new Date(newsItem.updated_at); dateTag.innerHTML = `<span class="month">${d.getMonth() + 1}月</span><span class="day">${d.getDate()}</span><span class="weekday">更新</span>`; }

            const thumbnailDiv = document.createElement('div'); thumbnailDiv.className = 'thumbnail'; thumbnailDiv.innerHTML = `<img src="${newsItem.thumbnail_url || '/images/placeholder.png'}" alt="${escapeHtml(newsItem.title || '縮圖')}">`;
            const contentWrapper = document.createElement('div'); contentWrapper.className = 'content-wrapper';
            contentWrapper.innerHTML = `
                <h3 class="news-title">${escapeHtml(newsItem.title || '無標題')}</h3>
                <p class="news-summary">${escapeHtml(newsItem.summary || '')}</p>
                <div class="actions">
                    <button class="like-button" data-news-id="${newsItem.id}" onclick="event.stopPropagation(); handleLikeClick(this, ${newsItem.id});">
                        <span class="heart-icon">♡</span>
                    </button>
                    <span class="like-count" id="like-count-${newsItem.id}">${newsItem.like_count || 0}</span>
                </div>
            `;
            card.appendChild(dateTag); card.appendChild(thumbnailDiv); card.appendChild(contentWrapper);
            newsListContainer.appendChild(card);
        });
    }

    function renderNewsPagination(totalPages, currentPage) { // 渲染下方列表的分頁
        if (!paginationControls || totalPages <= 1) { paginationControls.innerHTML = ''; return; }
        paginationControls.innerHTML = '';
        const createButton = (page, text, isActive = false, isDisabled = false) => { /* ... (同 news.js 的 createButton) ... */
             const button = document.createElement('button'); button.textContent = text; button.disabled = isDisabled; if (isActive) button.classList.add('active'); if (!isDisabled && !isActive) { button.addEventListener('click', () => fetchNewsList(page)); } return button; // <<< 注意這裡是 fetchNewsList >>>
        };
        paginationControls.appendChild(createButton(currentPage - 1, '<< 上一頁', false, currentPage === 1));
        const startPage = Math.max(1, currentPage - 2); const endPage = Math.min(totalPages, currentPage + 2);
        if (startPage > 1) { paginationControls.appendChild(createButton(1, '1')); if (startPage > 2) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; paginationControls.appendChild(ellipsis); } }
        for (let i = startPage; i <= endPage; i++) { paginationControls.appendChild(createButton(i, i.toString(), i === currentPage)); }
        if (endPage < totalPages) { if (endPage < totalPages - 1) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; paginationControls.appendChild(ellipsis); } paginationControls.appendChild(createButton(totalPages, totalPages.toString())); }
        paginationControls.appendChild(createButton(currentPage + 1, '下一頁 >>', false, currentPage === totalPages));
    }

    // Like 按鈕處理函數 (需要設為全局或使用事件委派)
    window.handleLikeClick = async (buttonElement, newsId) => {
        if (!buttonElement || buttonElement.disabled) return;
        const countElement = document.getElementById(`like-count-${newsId}`);
        if (!countElement) return;

        const isLiked = buttonElement.classList.contains('liked');
        if (isLiked) return; // 簡單處理，不允許取消讚

        buttonElement.disabled = true;
        const originalCount = parseInt(countElement.textContent) || 0;

        // --- 樂觀更新 UI ---
        buttonElement.classList.add('liked');
        buttonElement.querySelector('.heart-icon').textContent = '♥';
        countElement.textContent = originalCount + 1;
        // --- ---

        try {
            const response = await fetch(`/api/news/${newsId}/like`, { method: 'POST' });
            if (!response.ok) { throw new Error(`按讚請求失敗 (HTTP ${response.status})`); }
            const data = await response.json();
            // 使用伺服器返回的最新計數更新 (可選，如果擔心併發)
            if (data && data.like_count !== undefined) {
                countElement.textContent = data.like_count;
            }
        } catch (error) {
            console.error("[NewsList] Like error:", error);
            // --- 回滾 UI ---
            buttonElement.classList.remove('liked');
            buttonElement.querySelector('.heart-icon').textContent = '♡';
            countElement.textContent = originalCount;
            alert("按讚失敗，請稍後再試。");
            // --- ---
        } finally {
            // 延遲一小段時間再恢復按鈕，防止快速連點
             setTimeout(() => { buttonElement.disabled = false; }, 500);
        }
    };


    // --- Calendar Functions ---
    function updateCalendarDisplay(date) {
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11
        if(calendarMonthYear) calendarMonthYear.textContent = `${year} 年 ${month + 1} 月`;
        generateCalendarGrid(year, month);
        fetchAndMarkCalendarEvents(year, month + 1); // API 需要 1-12 的月份
    }

    function generateCalendarGrid(year, month) {
        if (!calendarGrid) return;
        calendarGrid.innerHTML = ''; // 清空舊格子

        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startingDayOfWeek = firstDayOfMonth.getDay(); // 0=Sun, 1=Mon, ...

        const today = new Date();
        const todayString = formatDateYYYYMMDD(today);

        // 填充上個月的空白格子
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyCell);
        }

        // 填充本月日期格子
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            const currentDate = new Date(year, month, day);
            const dateString = formatDateYYYYMMDD(currentDate);
            dayCell.dataset.date = dateString; // 添加 data-date 屬性

            const dayNumberSpan = document.createElement('span');
            dayNumberSpan.className = 'day-number';
            dayNumberSpan.textContent = day;
            dayCell.appendChild(dayNumberSpan);

            // 標記今天
            if (dateString === todayString) {
                dayCell.classList.add('today');
            }

            // 添加事件標記的容器
            const markersContainer = document.createElement('div');
            markersContainer.className = 'event-markers';
            dayCell.appendChild(markersContainer);

            calendarGrid.appendChild(dayCell);
        }

        // 填充下個月的空白格子 (確保總格子數是 7 的倍數)
        const totalCells = startingDayOfWeek + daysInMonth;
        const remainingCells = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < remainingCells; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyCell);
        }
    }

    async function fetchAndMarkCalendarEvents(year, month) { // month is 1-12
        const cacheKey = `${year}-${month.toString().padStart(2, '0')}`;
        console.log(`[Calendar] Fetching events for ${cacheKey}`);

        if (calendarEventsCache.has(cacheKey)) {
            console.log(`[Calendar] Using cached events for ${cacheKey}`);
            markCalendarDates(calendarEventsCache.get(cacheKey));
            return;
        }

        if(calendarLoading) calendarLoading.style.display = 'block'; // 顯示載入提示

        try {
            const response = await fetch(`/api/news/calendar?year=${year}&month=${month}`);
            if (!response.ok) throw new Error(`獲取行事曆事件失敗 (HTTP ${response.status})`);
            const events = await response.json();
            console.log(`[Calendar] Fetched ${events.length} events for ${cacheKey}`);
            calendarEventsCache.set(cacheKey, events); // 緩存結果
            markCalendarDates(events);
        } catch (error) {
            console.error("[Calendar] Fetch events error:", error);
            // 可以在日曆區域顯示錯誤，或者僅在 console 顯示
        } finally {
            if(calendarLoading) calendarLoading.style.display = 'none'; // 隱藏載入提示
        }
    }

    function markCalendarDates(events) {
        if (!calendarGrid || !events) return;

        // 先清除舊的標記 (如果有的話)
        calendarGrid.querySelectorAll('.calendar-day.has-event').forEach(cell => {
            cell.classList.remove('has-event');
            const markers = cell.querySelector('.event-markers');
            if (markers) markers.innerHTML = '';
            cell.onclick = null; // 移除舊的點擊事件
        });

        const eventsByDate = {};
        events.forEach(event => {
            if (!eventsByDate[event.date]) {
                eventsByDate[event.date] = [];
            }
            eventsByDate[event.date].push(event);
        });

        // 遍歷有事件的日期
        for (const dateString in eventsByDate) {
            const dayCell = calendarGrid.querySelector(`.calendar-day[data-date="${dateString}"]`);
            if (dayCell) {
                dayCell.classList.add('has-event');
                const markersContainer = dayCell.querySelector('.event-markers');
                if (markersContainer) {
                    // 為每個事件添加標記
                    eventsByDate[dateString].forEach(event => {
                        const marker = document.createElement('span');
                        marker.className = 'event-marker';
                        // 根據分類添加 class (確保 CSS 中有對應規則)
                        if (event.category) {
                            // 將分類名稱轉換為安全的 CSS class name (移除空格、特殊字符)
                            const categoryClass = `category-${event.category.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
                            marker.classList.add(categoryClass);
                            marker.title = event.category; // 滑鼠懸停顯示分類
                        }
                        markersContainer.appendChild(marker);
                    });
                }
                // 為日期格子添加點擊事件
                dayCell.onclick = () => openEventModal(dateString, eventsByDate[dateString]);
            }
        }
         // (可選) 更新圖例
         renderCalendarLegend(events);
    }

    // --- (可選) 渲染行事曆圖例 ---
    function renderCalendarLegend(events) {
        if (!calendarLegend) return;
        const uniqueCategories = [...new Set(events.map(e => e.category).filter(Boolean))]; // 獲取不重複的分類
        if (uniqueCategories.length === 0) {
            calendarLegend.innerHTML = ''; // 沒有分類就清空
            return;
        }
        let legendHTML = '圖例: ';
        uniqueCategories.forEach(category => {
             const categoryClass = `category-${category.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
             legendHTML += `<span style="display: inline-flex; align-items: center; margin-right: 10px;"><span class="event-marker ${categoryClass}" style="margin-right: 4px;"></span>${escapeHtml(category)}</span>`;
        });
        calendarLegend.innerHTML = legendHTML;
    }


    // --- Event Modal Functions ---
    function openEventModal(dateString, events) {
        if (!eventDetailModal || !eventModalTitle || !eventModalBody) return;

        const dateObj = new Date(dateString + 'T00:00:00'); // 確保解析為本地時區
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        eventModalTitle.textContent = `${dateObj.toLocaleDateString('zh-TW', options)} 活動`;

        eventModalBody.innerHTML = ''; // 清空舊內容

        if (!events || events.length === 0) {
            eventModalBody.innerHTML = '<p>這天沒有特別活動。</p>';
        } else {
            events.forEach(event => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'modal-event-item';
                itemDiv.innerHTML = `
                    <div class="modal-event-content">
                        <img src="${event.thumbnail_url || '/images/placeholder.png'}" alt="${escapeHtml(event.title || '事件縮圖')}" class="modal-event-thumbnail">
                        <div class="modal-event-text">
                            ${event.category ? `<span class="modal-event-category">[${escapeHtml(event.category)}]</span>` : ''}
                            <h4 class="modal-event-title">${escapeHtml(event.title || '無標題')}</h4>
                            <p class="modal-event-summary">${escapeHtml(event.summary || '')}</p>
                        </div>
                    </div>
                    <div class="modal-event-actions">
                        <a href="news-detail.html?id=${event.id}" class="btn btn-primary btn-sm">查看詳情</a>
                    </div>
                `;
                eventModalBody.appendChild(itemDiv);
                 // 不再需要分隔線，因為 CSS 會處理 margin 和 border
            });
        }
        openModal(eventDetailModal);
    }

    // --- Event Listeners ---
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            updateCalendarDisplay(currentCalendarDate);
        });
    }
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            updateCalendarDisplay(currentCalendarDate);
        });
    }
    // 日期格子點擊事件已在 markCalendarDates 中綁定

    // Modal 關閉按鈕 (合併處理)
    if(eventDetailModal) {
        const allCloseBtns = eventDetailModal.querySelectorAll('.close-btn, .close-modal-btn');
        allCloseBtns.forEach(btn => {
             btn.removeEventListener('click', () => closeModal(eventDetailModal)); // 移除舊的
             btn.addEventListener('click', () => closeModal(eventDetailModal));
        });
         eventDetailModal.removeEventListener('click', handleBackgroundClick); // 移除舊的
         eventDetailModal.addEventListener('click', handleBackgroundClick); // 添加新的
    }


}




    // --- 全局函數 ---
    window.closeNewsDetailModal = function() { if (detailModal) { detailModal.style.display = 'none'; } };
    window.onclick = function(event) { if (event.target === detailModal) { closeNewsDetailModal(); } };

    // --- 頁面初始化 ---






 // --- Initial Load ---
    async function initializePage() {
        console.log("[NewsPage] Initializing...");
        // 先加載行事曆框架和當月事件
        updateCalendarDisplay(currentCalendarDate);
        // 再異步加載下方新聞列表的第一頁
        fetchNewsList(1);
        console.log("[NewsPage] Initialized.");
    }

initializePage();

});

 