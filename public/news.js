// public/news.js (嘗試 async/await 結構)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References --- (保持不變)
    const newsListContainer = document.getElementById('news-list');
    const paginationControls = document.getElementById('pagination-controls');
    const detailModal = document.getElementById('news-detail-modal');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailMeta = document.getElementById('detail-meta');
    const detailBody = document.getElementById('detail-body');
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null;

    // --- Banner Function --- (函數內容保持不變)
    async function fetchAndDisplayBanners(pageIdentifier = 'news') {
        console.log(`[News Banner] fetchAndDisplayBanners called for page: ${pageIdentifier}`);
        if (!bannerWrapper) { /* ... */ return; }
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="...">Banner 載入中...</div>';
        try {
            const apiUrl = `/api/banners?page=${encodeURIComponent(pageIdentifier)}`;
            console.log(`[News Banner] Fetching banners from: ${apiUrl}`);
            const response = await fetch(apiUrl);
            console.log("[News Banner] API Response Status:", response.status);
            if (!response.ok) { /* ... 錯誤處理 ... */ throw new Error(`獲取 Banners 失敗 (HTTP ${response.status})`); }
            const banners = await response.json();
            console.log(`[News Banner] Received ${banners.length} banners for page '${pageIdentifier}'.`);
            bannerWrapper.innerHTML = ''; // 清空 Loading
            if (!banners || banners.length === 0) {
                 console.log(`[News Banner] 未收到 '${pageIdentifier}' 頁面的 Banner 數據，顯示預設 Logo。`);
                 bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy Logo" style="..."></div>';
                 const carouselElement = document.getElementById('banner-carousel');
                 if (carouselElement) carouselElement.style.display = 'none'; // 沒有 Banner 就隱藏
            } else {
                console.log(`[News Banner] 渲染 ${banners.length} 個 Banner Slides...`);
                 banners.forEach(banner => { /* ... 生成 slide ... */ });

                // 初始化 Swiper
                if (bannerSwiper) { bannerSwiper.destroy(true, true); bannerSwiper = null; }
                console.log("[News Banner] 初始化 Swiper...");
                bannerSwiper = new Swiper('#banner-carousel', {
                    loop: banners.length > 1, // *** 修正：應該是 banners.length > 1 ***
                    autoplay: { delay: 12000, disableOnInteraction: false, pauseOnMouseEnter: true },
                    pagination: { el: '#banner-carousel .swiper-pagination', clickable: true },
                    navigation: { nextEl: '#banner-carousel .swiper-button-next', prevEl: '#banner-carousel .swiper-button-prev' },
                    slidesPerView: 1,
                    spaceBetween: 0,
                    grabCursor: true,
                    keyboard: { enabled: true },
                    observer: true,
                    observeParents: true
                });
                 console.log("[News Banner] Swiper 初始化完成。");
                 const carouselElement = document.getElementById('banner-carousel');
                 if (carouselElement) carouselElement.style.display = 'block';
            }
        } catch (error) { /* ... 錯誤處理 ... */ }
    }
    // --- Banner 代碼結束 ---


    // --- News specific variables and functions --- (保持不變)
    let currentPage = 1;
    const itemsPerPage = 10;
    async function fetchNews(page = 1) {
        console.log(`[News List] Fetching news page ${page}...`); // 添加日誌
        // ... (其餘 fetchNews 內容不變) ...
        if (!newsListContainer || !paginationControls) { console.error("頁面缺少列表或分頁容器元素。"); return; } currentPage = page; newsListContainer.innerHTML = '<p>正在加載最新消息...</p>'; paginationControls.innerHTML = ''; try { const response = await fetch(`/api/news?page=${page}&limit=${itemsPerPage}`); if (!response.ok) throw new Error(`獲取消息失敗 (HTTP ${response.status})`); const data = await response.json(); displayNews(data.news); renderPagination(data.totalPages, data.currentPage); } catch (error) { console.error("獲取或顯示消息時出錯:", error); if (newsListContainer) newsListContainer.innerHTML = '<p>無法加載消息。</p>'; }
    }
    function displayNews(newsList) { /* ... */ }
    function renderPagination(totalPages, currentPage) { /* ... */ }
    async function openNewsDetailModal(newsId) { /* ... */ }
    window.closeNewsDetailModal = function() { /* ... */ }
    async function likeNews(newsId, likeButtonElement, countElement) { /* ... */ }
    window.onclick = function(event) { if (event.target == detailModal) { closeNewsDetailModal(); } }


    // --- **頁面初始加載 (修改這裡)** ---
    async function initializePage() { // <-- **改成 async**
        console.log("News Page: Initializing...");
        try {
            await fetchAndDisplayBanners('news'); // <-- **加上 await**
            await fetchNews(1);             // <-- **加上 await (確保 Banner 完成後再取新聞)**
            console.log("News Page: Initialization sequence complete.");
        } catch (error) {
            // 雖然函數內部有 catch，但在這裡加一個以防萬一
            console.error("Error during page initialization:", error);
        }
    }

    initializePage(); // 執行初始化

 }); // End of DOMContentLoaded