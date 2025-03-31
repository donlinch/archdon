// public/news.js (加入詳細除錯日誌)
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

    // --- Banner Function --- (保持不變)
    async function fetchAndDisplayBanners(pageIdentifier = 'news') {
        console.log(`[News Banner] fetchAndDisplayBanners called for page: ${pageIdentifier}`);
        if (!bannerWrapper) { /* ... */ return; }
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="...">Banner 載入中...</div>';
        try {
            const apiUrl = `/api/banners?page=${encodeURIComponent(pageIdentifier)}`;
            console.log(`[News Banner] Fetching banners from: ${apiUrl}`);
            const response = await fetch(apiUrl);
            console.log("[News Banner] API Response Status:", response.status);
            if (!response.ok) { throw new Error(`獲取 Banners 失敗 (HTTP ${response.status})`); }
            const banners = await response.json();
            console.log(`[News Banner] Received ${banners.length} banners for page '${pageIdentifier}'.`);
            bannerWrapper.innerHTML = '';
            if (!banners || banners.length === 0) {
                 console.log(`[News Banner] 未收到 '${pageIdentifier}' 頁面的 Banner 數據，顯示預設 Logo。`);
                 bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy Logo" style="..."></div>';
                 const carouselElement = document.getElementById('banner-carousel');
                 if (carouselElement) carouselElement.style.display = 'none';
            } else {
                console.log(`[News Banner] 渲染 ${banners.length} 個 Banner Slides...`);
                banners.forEach(banner => { /* ... 生成 slide ... */ });
                if (bannerSwiper) { bannerSwiper.destroy(true, true); bannerSwiper = null; }
                console.log("[News Banner] 初始化 Swiper...");
                bannerSwiper = new Swiper('#banner-carousel', { /* ... Swiper options ... */ });
                console.log("[News Banner] Swiper 初始化完成。");
                const carouselElement = document.getElementById('banner-carousel');
                if (carouselElement) carouselElement.style.display = 'block';
            }
        } catch (error) {
             console.error("[News Banner] 處理 Banner 時出錯:", error);
             bannerWrapper.innerHTML = `<div class="swiper-slide" style="...">輪播圖載入失敗: ${error.message}</div>`;
             // ... 隱藏導航 ...
        }
    }
    // --- Banner 代碼結束 ---


    // --- News specific variables and functions ---
    let currentPage = 1;
    const itemsPerPage = 10;

    // *** 修改 fetchNews 加入詳細日誌 ***
    async function fetchNews(page = 1) {
        console.log(`[News List DEBUG] fetchNews called for page ${page}.`); // **新增日誌 1**
        if (!newsListContainer || !paginationControls) {
            console.error("[News List DEBUG] 頁面缺少列表或分頁容器元素。");
            return;
        }
        currentPage = page;
        newsListContainer.innerHTML = '<p>正在加載最新消息...</p>';
        paginationControls.innerHTML = '';

        try {
            console.log(`[News List DEBUG] Attempting to fetch: /api/news?page=${page}&limit=${itemsPerPage}`); // **新增日誌 2**
            const response = await fetch(`/api/news?page=${page}&limit=${itemsPerPage}`);
            console.log(`[News List DEBUG] API Response Status: ${response.status}`); // **新增日誌 3**

            if (!response.ok) {
                // 嘗試讀取錯誤訊息
                let errorText = `獲取消息失敗 (HTTP ${response.status})`;
                try {
                    const errorData = await response.json();
                    errorText += `: ${errorData.error || 'No specific error message.'}`;
                } catch(e) {
                     errorText += `: ${response.statusText || 'Failed to parse error response.'}`;
                }
                 console.error("[News List DEBUG] Fetch failed:", errorText); // **新增錯誤日誌**
                 throw new Error(errorText); // 拋出帶有信息的錯誤
            }

            console.log("[News List DEBUG] Fetch successful, attempting to parse JSON..."); // **新增日誌 4**
            const data = await response.json();
            console.log("[News List DEBUG] JSON parsed successfully:", data); // **新增日誌 5 (查看返回的數據)**

            console.log("[News List DEBUG] Calling displayNews..."); // **新增日誌 6**
            displayNews(data.news); // 顯示新聞內容
            console.log("[News List DEBUG] Calling renderPagination..."); // **新增日誌 7**
            renderPagination(data.totalPages, data.currentPage); // 渲染分頁按鈕
            console.log("[News List DEBUG] fetchNews finished successfully."); // **新增日誌 8**

        } catch (error) {
            // 這個 catch 會捕捉 fetch 失敗 或 response.ok 為 false 時拋出的錯誤，或 JSON 解析錯誤，或 displayNews/renderPagination 中的錯誤
            console.error("[News List DEBUG] Error caught in fetchNews:", error); // **修改錯誤日誌**
            if (newsListContainer) {
                 newsListContainer.innerHTML = `<p>無法加載消息: ${error.message}</p>`; // 在頁面顯示更詳細的錯誤
            }
        }
    }

    // --- displayNews, renderPagination, etc. (保持不變) ---
    function displayNews(newsList) { /* ... */ }
    function renderPagination(totalPages, currentPage) { /* ... */ }
    async function openNewsDetailModal(newsId) { /* ... */ }
    window.closeNewsDetailModal = function() { /* ... */ }
    async function likeNews(newsId, likeButtonElement, countElement) { /* ... */ }
    window.onclick = function(event) { if (event.target == detailModal) { closeNewsDetailModal(); } }

    // --- 頁面初始加載 --- (保持不變)
    async function initializePage() {
        console.log("News Page: Initializing...");
        try {
            await fetchAndDisplayBanners('news');
            await fetchNews(1);
            console.log("News Page: Initialization sequence complete.");
        } catch (error) {
            console.error("Error during page initialization:", error);
        }
    }

    initializePage();

 });