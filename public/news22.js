// public/news.js (整合新聞列表和行事曆功能)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素引用 ---
    // 新聞列表相關
    const newsListContainer = document.getElementById('news-list');
    const paginationControls = document.getElementById('pagination-controls');
    const detailModal = document.getElementById('news-detail-modal');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailMeta = document.getElementById('detail-meta');
    const detailBody = document.getElementById('detail-body');

    // Banner 相關元素
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null;

    // 行事曆相關元素
    const calendarSection = document.getElementById('calendar-section');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarLoading = calendarGrid ? calendarGrid.querySelector('.calendar-loading') : null;
    const calendarLegend = document.getElementById('calendar-legend');
    const eventDetailModal = document.getElementById('event-detail-modal');
    const eventModalTitle = document.getElementById('event-modal-title');
    const eventModalBody = document.getElementById('event-modal-body');

    // --- 狀態變數 ---
    let currentPage = 1;
    const itemsPerPage = 10;
    let currentCalendarDate = new Date();
    let calendarEventsCache = new Map();
    let categoryColors = {};

    // --- 工具函數 ---
    const escapeHtml = (unsafe) => {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    function formatDateYYYYMMDD(date) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // --- Banner 相關函數 ---
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

    // --- 新聞列表相關函數 ---
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
    
            if (newsItem.content) {
                let formattedContent = newsItem.content.replace(/\n/g, '<br>');
                formattedContent = formattedContent.replace(
                    /(https?:\/\/[^\s]+)/g, 
                    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
                );
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

    // --- 行事曆相關函數 ---
    function updateCalendarDisplay(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        if(calendarMonthYear) calendarMonthYear.textContent = `${year} 年 ${month + 1} 月`;
        generateCalendarGrid(year, month);
        fetchAndMarkCalendarEvents(year, month + 1);
    }

    function generateCalendarGrid(year, month) {
        if (!calendarGrid) return;
        calendarGrid.innerHTML = '';

        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startingDayOfWeek = firstDayOfMonth.getDay();

        const today = new Date();
        const todayString = formatDateYYYYMMDD(today);

        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyCell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            const currentDate = new Date(year, month, day);
            const dateString = formatDateYYYYMMDD(currentDate);
            dayCell.dataset.date = dateString;

            const dayNumberSpan = document.createElement('span');
            dayNumberSpan.className = 'day-number';
            dayNumberSpan.textContent = day;
            dayCell.appendChild(dayNumberSpan);

            if (dateString === todayString) {
                dayCell.classList.add('today');
            }

            const markersContainer = document.createElement('div');
            markersContainer.className = 'event-markers';
            dayCell.appendChild(markersContainer);

            calendarGrid.appendChild(dayCell);
        }

        const totalCells = startingDayOfWeek + daysInMonth;
        const remainingCells = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < remainingCells; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyCell);
        }
    }

    async function fetchAndMarkCalendarEvents(year, month) {
        const cacheKey = `${year}-${month.toString().padStart(2, '0')}`;
        console.log(`[Calendar] Fetching events for ${cacheKey}`);

        if (calendarEventsCache.has(cacheKey)) {
            console.log(`[Calendar] Using cached events for ${cacheKey}`);
            markCalendarDates(calendarEventsCache.get(cacheKey));
            return;
        }

        if(calendarLoading) calendarLoading.style.display = 'block';

        try {
            const response = await fetch(`/api/news/calendar?year=${year}&month=${month}`);
            if (!response.ok) throw new Error(`獲取行事曆事件失敗 (HTTP ${response.status})`);
            const events = await response.json();
            console.log(`[Calendar] Fetched ${events.length} events for ${cacheKey}`);
            calendarEventsCache.set(cacheKey, events);
            markCalendarDates(events);
        } catch (error) {
            console.error("[Calendar] Fetch events error:", error);
        } finally {
            if(calendarLoading) calendarLoading.style.display = 'none';
        }
    }

    function markCalendarDates(events) {
        if (!calendarGrid || !events) return;

        calendarGrid.querySelectorAll('.calendar-day.has-event').forEach(cell => {
            cell.classList.remove('has-event');
            const markers = cell.querySelector('.event-markers');
            if (markers) markers.innerHTML = '';
            cell.onclick = null;
        });

        const eventsByDate = {};
        events.forEach(event => {
            if (!eventsByDate[event.date]) {
                eventsByDate[event.date] = [];
            }
            eventsByDate[event.date].push(event);
        });

        for (const dateString in eventsByDate) {
            const dayCell = calendarGrid.querySelector(`.calendar-day[data-date="${dateString}"]`);
            if (dayCell) {
                dayCell.classList.add('has-event');
                const markersContainer = dayCell.querySelector('.event-markers');
                if (markersContainer) {
                    eventsByDate[dateString].forEach(event => {
                        const marker = document.createElement('span');
                        marker.className = 'event-marker';
                        if (event.category) {
                            const categoryClass = `category-${event.category.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
                            marker.classList.add(categoryClass);
                            marker.title = event.category;
                        }
                        markersContainer.appendChild(marker);
                    });
                }
                dayCell.onclick = () => openEventModal(dateString, eventsByDate[dateString]);
            }
        }
        renderCalendarLegend(events);
    }

    function renderCalendarLegend(events) {
        if (!calendarLegend) return;
        const uniqueCategories = [...new Set(events.map(e => e.category).filter(Boolean))];
        if (uniqueCategories.length === 0) {
            calendarLegend.innerHTML = '';
            return;
        }
        let legendHTML = '圖例: ';
        uniqueCategories.forEach(category => {
             const categoryClass = `category-${category.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
             legendHTML += `<span style="display: inline-flex; align-items: center; margin-right: 10px;"><span class="event-marker ${categoryClass}" style="margin-right: 4px;"></span>${escapeHtml(category)}</span>`;
        });
        calendarLegend.innerHTML = legendHTML;
    }

    function openEventModal(dateString, events) {
        if (!eventDetailModal || !eventModalTitle || !eventModalBody) return;

        const dateObj = new Date(dateString + 'T00:00:00');
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        eventModalTitle.textContent = `${dateObj.toLocaleDateString('zh-TW', options)} 活動`;

        eventModalBody.innerHTML = '';

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
                        <button class="btn btn-primary btn-sm" onclick="window.location.href='/news/${event.id}'">查看詳情</button>
                    </div>
                `;
                eventModalBody.appendChild(itemDiv);
            });
        }
        eventDetailModal.style.display = 'flex';
    }

    function handleBackgroundClick(event) {
        if (event.target === eventDetailModal || event.target === detailModal) {
            closeModal(event.target);
        }
    }

    function closeModal(modalElement) {
        if (modalElement) modalElement.style.display = 'none';
    }

    // --- 事件監聽器 ---
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

    if(eventDetailModal) {
        const allCloseBtns = eventDetailModal.querySelectorAll('.close-btn, .close-modal-btn');
        allCloseBtns.forEach(btn => {
             btn.addEventListener('click', () => closeModal(eventDetailModal));
        });
         eventDetailModal.addEventListener('click', handleBackgroundClick);
    }

    // --- 全局函數 ---
    window.closeNewsDetailModal = function() { closeModal(detailModal); };
    window.onclick = function(event) { handleBackgroundClick(event); };

    // --- 頁面初始化 ---
    async function initializePage() {
        console.log("[News] Initializing page");
        try {
            await Promise.all([fetchAndDisplayBanners(), fetchNews(1)]);
            updateCalendarDisplay(currentCalendarDate);
            console.log("[News] Page initialized");
        } catch (error) { 
            console.error("[News] Initialization error:", error); 
        }
    }

    initializePage();
});