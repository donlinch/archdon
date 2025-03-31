// public/news.js (完整替換 - 加入 page=news 參數)
document.addEventListener('DOMContentLoaded', () => {
    // News specific elements... (保持不變)
    const newsListContainer = document.getElementById('news-list');
    const paginationControls = document.getElementById('pagination-controls');
    const detailModal = document.getElementById('news-detail-modal');
    // ... 其他 news 元素 ...

    // Banner related elements
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null;

    // --- Banner Function ---
    // *** 修改 fetchAndDisplayBanners 函數，傳入 pageIdentifier ***
    async function fetchAndDisplayBanners(pageIdentifier = 'news') { // <-- 預設為 'news'
        console.log(`[News Banner] fetchAndDisplayBanners called for page: ${pageIdentifier}`);
        if (!bannerWrapper) {
             console.warn("[News Banner] 未找到 Banner wrapper 元素。");
             const carouselElement = document.getElementById('banner-carousel');
             if (carouselElement) carouselElement.style.display = 'none';
             return;
        }
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="...">Banner 載入中...</div>';

        try {
            // *** 修改這裡：使用 pageIdentifier 構建 API URL ***
            const apiUrl = `/api/banners?page=${encodeURIComponent(pageIdentifier)}`;
            console.log(`[News Banner] Fetching banners from: ${apiUrl}`);
            const response = await fetch(apiUrl);
            console.log("[News Banner] API Response Status:", response.status);

            if (!response.ok) { /* ... 錯誤處理 ... */ throw new Error(`獲取 Banners 失敗 (HTTP ${response.status})`); }
            const banners = await response.json();
             console.log(`[News Banner] Received ${banners.length} banners for page '${pageIdentifier}'.`);

            bannerWrapper.innerHTML = ''; // 清空

            if (!banners || banners.length === 0) {
                 console.log(`[News Banner] 未收到 Banner 數據，顯示預設 Logo。`);
                 bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy Logo" style="..."></div>';
            } else {
                console.log(`[News Banner] 渲染 ${banners.length} 個 Banner Slides...`);
                 banners.forEach(banner => { /* ... 生成 slide ... */ });
            }

            // 初始化 Swiper... (保持不變)
            if (bannerSwiper) { bannerSwiper.destroy(true, true); bannerSwiper = null; }
            if (bannerWrapper.children.length > 0) {
                bannerSwiper = new Swiper('#banner-carousel', {
                    loop: banners && banners.length > 1,
                    autoplay: { delay: 12000, disableOnInteraction: false, pauseOnMouseEnter: true },
                    pagination: { el: '#banner-carousel .swiper-pagination', clickable: true },
                    navigation: { nextEl: '#banner-carousel .swiper-button-next', prevEl: '#banner-carousel .swiper-button-prev' },
                     // ... 其他 Swiper 選項 ...
                });
                console.log("[News Banner] Swiper 初始化完成。");
            } else {
                console.log("[News Banner] Wrapper 為空，不初始化 Swiper。");
            }
        } catch (error) {
             console.error("[News Banner] 處理 Banner 時出錯:", error);
             bannerWrapper.innerHTML = `<div class="swiper-slide" style="...">輪播圖載入失敗: ${error.message}</div>`;
             // 隱藏導航和分頁... (保持不變)
        }
    }
    // --- Banner 代碼結束 ---

    // --- News specific variables and functions --- (保持不變)
    let currentPage = 1;
    const itemsPerPage = 10;
    async function fetchNews(page = 1) { /* ... */ }
    function displayNews(newsList) { /* ... */ }
    function renderPagination(totalPages, currentPage) { /* ... */ }
    async function openNewsDetailModal(newsId) { /* ... */ }
    window.closeNewsDetailModal = function() { /* ... */ }
    async function likeNews(newsId, likeButtonElement, countElement) { /* ... */ }
    window.onclick = function(event) { /* ... */ }


    // --- 頁面初始加載 ---
    function initializePage() {
        console.log("News Page: Initializing...");
        // *** 修改這裡：傳入 'news' 給 Banner 函數 ***
        fetchAndDisplayBanners('news');
        fetchNews(1);
        console.log("News Page: Initialization sequence complete.");
    }

    initializePage();

 });