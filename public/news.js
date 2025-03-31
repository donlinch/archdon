// public/news.js (再次修正 - 確保呼叫 Banner 函數)
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
    async function fetchAndDisplayBanners() {
        console.log("[News Banner] fetchAndDisplayBanners called");
        if (!bannerWrapper) {
            console.warn("[News Banner] 未找到 Banner wrapper 元素");
            const carouselElement = document.getElementById('banner-carousel');
            if (carouselElement) carouselElement.style.display = 'none';
            return;
        }
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="...">Banner 載入中...</div>';

        try {
            // *** API URL 已包含 ?page=news ***
            const response = await fetch('/api/banners?page=news');
            console.log("[News Banner] API Response Status:", response.status);
            if (!response.ok) {
                 let errorText = `獲取 Banners 失敗 (HTTP ${response.status})`;
                 try { const data = await response.json(); errorText += `: ${data.error || response.statusText}`; } catch (e) {}
                 throw new Error(errorText);
            }
            const banners = await response.json();
            console.log("[News Banner] Received banners:", banners);

            bannerWrapper.innerHTML = ''; // 清空

            if (!banners || banners.length === 0) {
                 console.log("[News Banner] 未收到 'news' 頁面的 Banner 數據，顯示預設 Logo。");
                 bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy Logo" style="max-height: 80%; object-fit: contain;"></div>';
                 // 或者你可以選擇完全隱藏輪播區
                 // const carouselElement = document.getElementById('banner-carousel');
                 // if (carouselElement) carouselElement.style.display = 'none';
            } else {
                console.log(`[News Banner] 渲染 ${banners.length} 個 Banner Slides...`);
                 banners.forEach(banner => {
                    // --- 生成 Slide 的邏輯 ---
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

            // 初始化 Swiper... (保持不變)
            if (bannerSwiper) { bannerSwiper.destroy(true, true); bannerSwiper = null; } // 加上 true, true 更好
            if (bannerWrapper.children.length > 0) {
                bannerSwiper = new Swiper('#banner-carousel', {
                    loop: banners && banners.length > 1,
                    autoplay: { delay: 12000, disableOnInteraction: false, pauseOnMouseEnter: true }, // 速度 12 秒
                    pagination: { el: '#banner-carousel .swiper-pagination', clickable: true }, // 選擇器更精確
                    navigation: { nextEl: '#banner-carousel .swiper-button-next', prevEl: '#banner-carousel .swiper-button-prev' }, // 選擇器更精確
                    slidesPerView: 1,
                    spaceBetween: 0,
                    grabCursor: true,
                    keyboard: { enabled: true },
                    observer: true, // 添加 observer 可能有助於動態內容
                    observeParents: true // 添加 observeParents
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
    window.onclick = function(event) { if (event.target == detailModal) { closeNewsDetailModal(); } }

    // --- 頁面初始加載 ---
    // *** 修改這裡：定義 initializePage 並在裡面呼叫兩個函數 ***
    function initializePage() {
        console.log("News Page: Initializing...");
        fetchAndDisplayBanners(); // <--- **確保呼叫這個函數**
        fetchNews(1);
        console.log("News Page: Initialization sequence complete.");
    }

    initializePage(); // <--- **確保執行 initializePage**

 }); // End of DOMContentLoaded