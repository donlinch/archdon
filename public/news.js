// public/news.js (再次修正 - 確保呼叫時傳遞 'news')
document.addEventListener('DOMContentLoaded', () => {
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
    // *** 這個函數現在接受一個參數 pageIdentifier ***
    async function fetchAndDisplayBanners(pageIdentifier = 'news') { // <-- 指定預設值為 'news'
        console.log(`[News Banner] fetchAndDisplayBanners called for page: ${pageIdentifier}`);
        if (!bannerWrapper) {
             console.warn("[News Banner] 未找到 Banner wrapper 元素。");
             const carouselElement = document.getElementById('banner-carousel');
             if (carouselElement) carouselElement.style.display = 'none';
             return;
        }
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#f0f0f0;">Banner 載入中...</div>';

        try {
            // *** 修改這裡：使用 pageIdentifier 構建 API URL ***
            const apiUrl = `/api/banners?page=${encodeURIComponent(pageIdentifier)}`;
            console.log(`[News Banner] Fetching banners from: ${apiUrl}`); // 確認 URL 是否正確
            const response = await fetch(apiUrl);
            console.log("[News Banner] API Response Status:", response.status);

            if (!response.ok) {
                 let errorText = `獲取 Banners 失敗 (HTTP ${response.status})`;
                 try { const data = await response.json(); errorText += `: ${data.error || response.statusText}`; } catch (e) {}
                 throw new Error(errorText);
            }
            const banners = await response.json();
             console.log(`[News Banner] Received ${banners.length} banners for page '${pageIdentifier}'.`);

            bannerWrapper.innerHTML = ''; // 清空 Loading

            if (!banners || banners.length === 0) {
                 console.log(`[News Banner] 未收到 '${pageIdentifier}' 頁面的 Banner 數據，顯示預設 Logo。`);
                 bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy Logo" style="max-height: 80%; object-fit: contain;"></div>';
            } else {
                console.log(`[News Banner] 渲染 ${banners.length} 個 Banner Slides...`);
                 banners.forEach(banner => {
                     // --- 生成 Slide 的邏輯 (與你舊版本相同) ---
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
                     // --- 生成 Slide 結束 ---
                 });
            }

            // 初始化 Swiper... (保持不變，速度仍為 12 秒)
            if (bannerSwiper) { bannerSwiper.destroy(true, true); bannerSwiper = null; }
            if (bannerWrapper.children.length > 0) {
                bannerSwiper = new Swiper('#banner-carousel', {
                    loop: banners && banners.length > 1,
                    autoplay: { delay: 12000, disableOnInteraction: false, pauseOnMouseEnter: true },
                    pagination: { el: '#banner-carousel .swiper-pagination', clickable: true },
                    navigation: { nextEl: '#banner-carousel .swiper-button-next', prevEl: '#banner-carousel .swiper-button-prev' },
                    slidesPerView: 1,
                    spaceBetween: 0,
                    grabCursor: true,
                    keyboard: { enabled: true },
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
        // *** 修改這裡：明確呼叫 Banner 函數並傳遞 'news' ***
        fetchAndDisplayBanners('news');
        fetchNews(1);
        console.log("News Page: Initialization sequence complete.");
    }

    initializePage(); // 執行初始化

 }); // End of DOMContentLoaded