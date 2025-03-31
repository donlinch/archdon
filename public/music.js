// public/music.js (完整替換 - 加入 page=music 參數)
document.addEventListener('DOMContentLoaded', () => {
    const artistFilterNav = document.getElementById('artist-filter');
    const musicListContainer = document.getElementById('music-list');
    let currentArtistFilter = null;

    // --- Banner 相關代碼 ---
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null;

    // *** 修改 fetchAndDisplayBanners 函數，傳入 pageIdentifier ***
    async function fetchAndDisplayBanners(pageIdentifier = 'music') { // <-- 預設為 'music'
        console.log(`[Music Banner] fetchAndDisplayBanners called for page: ${pageIdentifier}`);
        if (!bannerWrapper) {
             console.warn("[Music Banner] 未找到 Banner wrapper 元素。");
             const carouselElement = document.getElementById('banner-carousel');
             if (carouselElement) carouselElement.style.display = 'none';
             return;
        }
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="...">Banner 載入中...</div>';

        try {
            // *** 修改這裡：使用 pageIdentifier 構建 API URL ***
            const apiUrl = `/api/banners?page=${encodeURIComponent(pageIdentifier)}`;
            console.log(`[Music Banner] Fetching banners from: ${apiUrl}`);
            const response = await fetch(apiUrl);
            console.log("[Music Banner] API Response Status:", response.status);

            if (!response.ok) { /* ... 錯誤處理 ... */ throw new Error(`獲取 Banners 失敗 (HTTP ${response.status})`); }
            const banners = await response.json();
            console.log(`[Music Banner] Received ${banners.length} banners for page '${pageIdentifier}'.`);

            bannerWrapper.innerHTML = ''; // 清空

            if (!banners || banners.length === 0) {
                 console.log(`[Music Banner] 未收到 Banner 數據，顯示預設 Logo。`);
                 bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy Logo" style="..."></div>';
            } else {
                 console.log(`[Music Banner] 渲染 ${banners.length} 個 Banner Slides...`);
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
                 console.log("[Music Banner] Swiper 初始化完成。");
            } else {
                 console.log("[Music Banner] Wrapper 為空，不初始化 Swiper。");
            }
        } catch (error) {
             console.error("[Music Banner] 處理 Banner 時出錯:", error);
             bannerWrapper.innerHTML = `<div class="swiper-slide" style="...">輪播圖載入失敗: ${error.message}</div>`;
             // 隱藏導航和分頁... (保持不變)
        }
    }
    // --- Banner 代碼結束 ---

    // --- 音樂頁面原有代碼 ---
    async function fetchAndDisplayArtists() { /* ... */ }
    async function fetchAndDisplayAlbums(artist = null) { /* ... */ }
    function setActiveArtistButton(activeButton) { /* ... */ }

    // --- 頁面初始加載 ---
    async function initializePage() {
        console.log("Music Page: Initializing...");
        // *** 修改這裡：傳入 'music' 給 Banner 函數 ***
        fetchAndDisplayBanners('music');
        await fetchAndDisplayArtists();
        fetchAndDisplayAlbums();
        console.log("Music Page: Initialization sequence complete.");
    }

    initializePage();
});