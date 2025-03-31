// public/news.js (最終修正版)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    // News specific elements
    const newsListContainer = document.getElementById('news-list');
    const paginationControls = document.getElementById('pagination-controls');
    const detailModal = document.getElementById('news-detail-modal');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailMeta = document.getElementById('detail-meta');
    const detailBody = document.getElementById('detail-body');
    // Banner related elements
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null;

    // --- Banner Function ---
    async function fetchAndDisplayBanners(pageIdentifier = 'news') { // 預設獲取 news 頁的
        console.log(`[News Banner] fetchAndDisplayBanners called for page: ${pageIdentifier}`);
        if (!bannerWrapper) {
             console.warn("[News Banner] 未找到 Banner wrapper 元素 (#banner-carousel .swiper-wrapper)。");
             const carouselElement = document.getElementById('banner-carousel');
             if (carouselElement) carouselElement.style.display = 'none';
             return; // 如果找不到 wrapper，就不用繼續執行了
        }
        // 顯示載入中...
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#f0f0f0;">Banner 載入中...</div>';

        try {
            // 請求特定頁面的 Banner
            const apiUrl = `/api/banners?page=${encodeURIComponent(pageIdentifier)}`;
            console.log(`[News Banner] Fetching banners from: ${apiUrl}`);
            const response = await fetch(apiUrl);
            console.log("[News Banner] API Response Status:", response.status);

            if (!response.ok) {
                let errorText = `獲取 Banners 失敗 (HTTP ${response.status})`;
                try { const data = await response.json(); errorText += `: ${data.error || response.statusText}`; } catch (e) {}
                throw new Error(errorText);
            }
            const banners = await response.json();
            console.log(`[News Banner] Received ${banners.length} banners for page '${pageIdentifier}'.`);

            bannerWrapper.innerHTML = ''; // 清空載入訊息

            if (!banners || banners.length === 0) {
                console.log(`[News Banner] 未收到 '${pageIdentifier}' 頁面的 Banner 數據，顯示預設 Logo。`);
                bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy Logo" style="max-height: 80%; object-fit: contain;"></div>';
                // 如果連預設圖都沒有，可以考慮隱藏
                 const carouselElement = document.getElementById('banner-carousel');
                 if (carouselElement) carouselElement.style.display = 'none'; // 沒有 Banner 就隱藏
            } else {
                // 渲染 Banner Slides
                console.log(`[News Banner] 渲染 ${banners.length} 個 Banner Slides...`);
                banners.forEach(banner => {
                    const slide = document.createElement('div');
                    slide.className = 'swiper-slide';
                    const img = document.createElement('img');
                    img.src = banner.image_url;
                    img.alt = banner.alt_text || `Banner ${banner.id || ''}`;
                    if (banner.link_url) {
                        const link = document.createElement('a');
                        link.href = banner.link_url;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.appendChild(img);
                        slide.appendChild(link);
                    } else {
                        slide.appendChild(img);
                    }
                    bannerWrapper.appendChild(slide);
                });

                // 只有實際有 Banner 才初始化 Swiper
                if (bannerSwiper) {
                    console.log("[News Banner] 銷毀舊 Swiper 實例。");
                    bannerSwiper.destroy(true, true);
                    bannerSwiper = null;
                }

                console.log("[News Banner] 初始化 Swiper...");
                bannerSwiper = new Swiper('#banner-carousel', {
                    loop: banners.length > 1, // 只有多於一張圖時才循環
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
                 // 確保輪播容器是可見的 (如果之前隱藏了)
                 const carouselElement = document.getElementById('banner-carousel');
                 if (carouselElement) carouselElement.style.display = 'block';
            }
        } catch (error) {
             console.error("[News Banner] 處理 Banner 時出錯:", error);
             bannerWrapper.innerHTML = `<div class="swiper-slide" style="...">輪播圖載入失敗: ${error.message}</div>`;
             // 隱藏導航和分頁
             const carouselElement = document.getElementById('banner-carousel');
             if (carouselElement) { /* ... 隱藏導航元件 ... */ }
        }
    }
    // --- Banner 代碼結束 ---


    // --- News specific variables and functions --- (保持不變)
    let currentPage = 1;
    const itemsPerPage = 10;
    async function fetchNews(page = 1) {
         console.log(`[News List] Fetching news page ${page}...`); // 添加日誌
         if (!newsListContainer || !paginationControls) { console.error("頁面缺少列表或分頁容器元素。"); return; } currentPage = page; newsListContainer.innerHTML = '<p>正在加載最新消息...</p>'; paginationControls.innerHTML = ''; try { const response = await fetch(`/api/news?page=${page}&limit=${itemsPerPage}`); if (!response.ok) throw new Error(`獲取消息失敗 (HTTP ${response.status})`); const data = await response.json(); displayNews(data.news); renderPagination(data.totalPages, data.currentPage); } catch (error) { console.error("獲取或顯示消息時出錯:", error); if (newsListContainer) newsListContainer.innerHTML = '<p>無法加載消息。</p>'; }
    }
    function displayNews(newsList) { /* ... */ }
    function renderPagination(totalPages, currentPage) { /* ... */ }
    async function openNewsDetailModal(newsId) { /* ... */ }
    window.closeNewsDetailModal = function() { /* ... */ }
    async function likeNews(newsId, likeButtonElement, countElement) { /* ... */ }
    window.onclick = function(event) { if (event.target == detailModal) { closeNewsDetailModal(); } }

    // --- **頁面初始加載 (關鍵修改)** ---
    async function initializePage() { // <-- 改成 async 函數更好
        console.log("News Page: Initializing...");
        // *** 使用 Promise.all 同時開始獲取 Banner 和 News，但不互相等待 ***
        // *** 這樣可以稍微加快頁面內容的顯示速度 ***
        await Promise.all([
            fetchAndDisplayBanners('news'), // <--- 確保呼叫 Banner 函數並傳遞 'news'
            fetchNews(1)                    // <--- 確保呼叫 News 函數
        ]);
        console.log("News Page: Initialization sequence complete.");
    }

    initializePage(); // <--- **確保執行 initializePage**

 }); // End of DOMContentLoaded