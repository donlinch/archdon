// public/news22.js (完整替換版本)
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
    const itemsPerPage = 10; // 每頁顯示數量

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
        // ... (fetchAndDisplayBanners 函數的其他內容保持不變) ...
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
            displayNews(data.news); // <--- 調用修改後的 displayNews
            renderPagination(data.totalPages, data.currentPage);
        } catch (error) {
            console.error("[News] Fetch news error:", error);
            if (newsListContainer) { newsListContainer.innerHTML = `<p class="error">無法加載消息: ${error.message}</p>`; }
        }
    }

    // --- *** 這裡是被替換的 displayNews 函數 *** ---
    /**
     * 渲染消息列表 (新佈局)
     */
    function displayNews(newsList) {
        if (!newsListContainer) return;
        newsListContainer.innerHTML = '';
        if (!newsList || newsList.length === 0) {
            newsListContainer.innerHTML = '<p>目前沒有最新消息。</p>';
            return;
        }
        newsList.forEach(newsItem => {
            const card = document.createElement('div');
            card.className = 'news-card'; // 卡片容器 class 不變

            // --- 新佈局邏輯 ---

            // 1. 創建左側容器 (包含縮圖和日期)
            const leftColumn = document.createElement('div');
            leftColumn.className = 'news-card-left'; // 使用新的 CSS class

            // 2. 縮圖 (放入左側容器)
            const thumbnailDiv = document.createElement('div');
            thumbnailDiv.className = 'thumbnail';
            const thumbnailImg = document.createElement('img');
            thumbnailImg.src = newsItem.thumbnail_url || '/images/placeholder.png';
            thumbnailImg.alt = newsItem.title || '縮圖';
            thumbnailDiv.appendChild(thumbnailImg);
            leftColumn.appendChild(thumbnailDiv); // 將縮圖放入左欄

            // 3. 創建並格式化新日期元素
            const dateSpan = document.createElement('span');
            dateSpan.className = 'news-card-date'; // 使用新的 CSS class
            // 優先使用 event_date，若無或無效則用 updated_at
            let displayDate;
            if (newsItem.event_date && !isNaN(new Date(newsItem.event_date))) {
                displayDate = new Date(newsItem.event_date);
            } else if (newsItem.updated_at && !isNaN(new Date(newsItem.updated_at))) {
                displayDate = new Date(newsItem.updated_at);
            } else {
                displayDate = new Date(); // 後備使用當前日期
                console.warn(`News item ID ${newsItem.id} has invalid date, using current date.`);
            }
            const month = displayDate.getMonth() + 1;
            const day = displayDate.getDate();
            const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
            const weekDay = dayNames[displayDate.getDay()];
            dateSpan.textContent = `${month}/${day} (${weekDay})`;
            leftColumn.appendChild(dateSpan); // 將日期放入左欄，在縮圖下方

            // 4. 創建右側內容容器
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'content-wrapper';
            // 將點擊事件綁定到整個卡片上
            card.onclick = () => openNewsDetailModal(newsItem.id);
            card.style.cursor = 'pointer'; // 給整個卡片加手型指標

            const titleH3 = document.createElement('h3');
            titleH3.className = 'news-title';
            titleH3.textContent = newsItem.title || '無標題';

            const summaryP = document.createElement('p');
            summaryP.className = 'news-summary';
            summaryP.textContent = newsItem.summary || '';

            contentWrapper.appendChild(titleH3);
            contentWrapper.appendChild(summaryP);

            // 5. （已移除）舊的 dateTag 和 actionsDiv 的創建代碼

            // 6. 將新的左右欄添加到卡片中
            card.appendChild(leftColumn);   // 添加左欄
            card.appendChild(contentWrapper); // 添加右欄 (內容區)

            // --- 佈局邏輯結束 ---

            newsListContainer.appendChild(card);
        });
    }
    // --- *** displayNews 函數替換結束 *** ---


    /**
     * 渲染分頁控制按鈕
     */
    function renderPagination(totalPages, currentPage) {
        // ... (renderPagination 函數內容保持不變) ...
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
            if (!isDisabled && !isActive) { button.addEventListener('click', () => fetchNews(page)); }
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
        // ... (openNewsDetailModal 函數內容保持不變) ...
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


            // --- 處理內文中的網址轉換為連結 ---
            if (newsItem.content) {
                // 1. HTML Escape (非常重要，防止 XSS)
                const escapedContent = newsItem.content
                    .replace(/&/g, "&")
                    .replace(/</g, "<")
                    .replace(/>/g, ">")
                         // " 轉成 & q u o t ;
                .replace(/"/g, '&quot;')
        
                // ' 轉成 & # 3 9 ;  (數字實體)
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
     * 處理按讚請求 (雖然移除了按鈕，但函數保留以防萬一)
     */
    async function likeNews(newsId, likeButtonElement, countElement) {
       console.log("Like button clicked for", newsId, "but functionality is removed.");
        // 由於按鈕已移除，此函數理論上不會被觸發
        // 但保留基本結構以防未來重新啟用
        /*
        const isLiked = likeButtonElement.classList.contains('liked');
        const currentCount = parseInt(countElement.textContent) || 0;
        if (isLiked) { console.log("Already liked"); return; }
        // ... (原來的按讚請求邏輯) ...
        */
    }

    // --- 全局函數 ---
    window.closeNewsDetailModal = function() { if (detailModal) { detailModal.style.display = 'none'; } };
    window.onclick = function(event) { if (event.target === detailModal) { closeNewsDetailModal(); } };

    // --- 頁面初始化 ---
    async function initializePage() {
        console.log("[News] Initializing page with new layout");
        if (!newsListContainer || !paginationControls || !detailModal || !bannerWrapper) {
            console.error("頁面初始化失敗：缺少必要的 HTML 元素。請檢查 news2.html 的 ID。");
            // 可以在頁面上顯示更明顯的錯誤提示
            document.body.innerHTML = '<p style="color:red; text-align:center; padding: 2rem;">頁面載入錯誤，請聯繫管理員。</p>';
            return;
        }
        try {
            // 同時開始獲取 Banner 和第一頁新聞
            await Promise.all([
                fetchAndDisplayBanners(),
                fetchNews(1)
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