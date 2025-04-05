// public/music.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素引用 ---
    const artistFilterNav = document.getElementById('artist-filter');
    const musicListContainer = document.getElementById('music-list');
    let currentArtistFilter = null;

    // --- 輪播圖相關元素 ---
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    const randomBannerWrapper = document.querySelector('#random-banner-carousel .swiper-wrapper');
    let bannerSwiper = null;
    let randomBannerSwiper = null;
    let musicPageBanners = []; // 新增：儲存音樂頁輪播圖數據

    // --- 函數定義 ---

    /**
     * 獲取並顯示音樂頁專用輪播圖
     */
    async function fetchAndDisplayBanners() {
        console.log("[Music] Fetching banners for music page");
        if (!bannerWrapper) {
            console.warn("Banner wrapper element not found");
            const carouselElement = document.getElementById('banner-carousel');
            if (carouselElement) carouselElement.style.display = 'none';
            return;
        }
 
        // 顯示載入狀態
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#f0f0f0;">載入輪播圖中...</div>';

        try {
            // 只請求 music 頁面的輪播圖
            const response = await fetch('/api/banners?page=music');
            console.log("[Music] Banner API response status:", response.status);

            if (!response.ok) {
                let errorText = `獲取輪播圖失敗 (HTTP ${response.status})`;
                try {
                    const data = await response.json();
                    errorText += `: ${data.error || response.statusText}`;
                } catch (e) {}
                throw new Error(errorText);
            }

            musicPageBanners = await response.json(); // 儲存音樂頁輪播圖數據
            console.log(`[Music] Received ${musicPageBanners.length} music page banners`);

            // 渲染主要輪播圖
            renderMainBanner(musicPageBanners);
            
            // 渲染隨機輪播圖
            renderRandomBanner(musicPageBanners);

        } catch (error) {
            console.error("[Music] Banner error:", error);
            handleBannerError();
        }
    }

    /**
     * 渲染主要輪播圖
     */
    function renderMainBanner(banners) {
        bannerWrapper.innerHTML = ''; // 清空載入狀態

        if (banners.length === 0) {
            showDefaultBanner(bannerWrapper, "音樂專輯");
        } else {
            banners.forEach(banner => {
                createBannerSlide(banner, bannerWrapper);
            });
        }

        // 初始化/重新初始化 Swiper
        initMainSwiper(banners.length);
    }

    /**
     * 渲染隨機輪播圖
     */
    function renderRandomBanner(sourceBanners) {
        if (!randomBannerWrapper) return;

        randomBannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#f0f0f0;">載入隨機輪播圖中...</div>';

        // 從音樂頁輪播圖中隨機選擇
        const randomBanners = getRandomBanners(sourceBanners);

        setTimeout(() => { // 確保DOM更新後執行
            randomBannerWrapper.innerHTML = '';
            
            if (randomBanners.length === 0) {
                showDefaultBanner(randomBannerWrapper, "隨機推薦");
            } else {
                randomBanners.forEach(banner => {
                    createBannerSlide(banner, randomBannerWrapper);
                });
            }

            initRandomSwiper(randomBanners.length);
        }, 0);
    }

    /**
     * 從音樂頁輪播圖中隨機選擇(排除主要輪播圖已顯示的項目)
     */
    function getRandomBanners(sourceBanners) {
        if (sourceBanners.length <= 1) return []; // 如果只有1個或沒有就不顯示隨機
        
        // 深拷貝避免修改原始數據
        const availableBanners = [...sourceBanners];
        
        // 移除第一個項目(主要輪播圖當前顯示的)
        if (availableBanners.length > 1) {
            availableBanners.shift();
        }

        // Fisher-Yates 洗牌算法
        for (let i = availableBanners.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableBanners[i], availableBanners[j]] = [availableBanners[j], availableBanners[i]];
        }

        return availableBanners.slice(0, 3); // 返回最多3個隨機項目
    }

    /**
     * 初始化主要輪播圖的 Swiper
     */
    function initMainSwiper(bannerCount) {
        if (bannerSwiper) {
            bannerSwiper.destroy(true, true);
            bannerSwiper = null;
        }

        if (bannerWrapper.children.length > 0) {
            bannerSwiper = new Swiper('#banner-carousel', {
                loop: bannerCount > 1,
                autoplay: {
                    delay: 10000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true
                },
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev'
                },
                slidesPerView: 1,
                spaceBetween: 0,
                effect: 'fade',
                fadeEffect: { crossFade: true }
            });
        }
    }

    /**
     * 初始化隨機輪播圖的 Swiper
     */
    function initRandomSwiper(bannerCount) {
        if (randomBannerSwiper) {
            randomBannerSwiper.destroy(true, true);
            randomBannerSwiper = null;
        }

        if (randomBannerWrapper.children.length > 0) {
            randomBannerSwiper = new Swiper('#random-banner-carousel', {
                loop: bannerCount > 1,
                autoplay: {
                    delay: 8000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true
                },
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true
                },
                slidesPerView: 1,
                spaceBetween: 0,
                effect: 'slide'
            });
        }
    }

    /**
     * 創建輪播圖幻燈片
     */
    function createBannerSlide(banner, wrapper) {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';

        const content = banner.link_url 
            ? `<a href="${banner.link_url}" target="_blank" rel="noopener noreferrer">
                 <img src="${banner.image_url}" alt="${banner.alt_text || '輪播圖'}" class="banner-image">
               </a>`
            : `<img src="${banner.image_url}" alt="${banner.alt_text || '輪播圖'}" class="banner-image">`;

        slide.innerHTML = content;
        wrapper.appendChild(slide);
    }

    /**
     * 顯示預設輪播圖
     */
    function showDefaultBanner(wrapper, altText) {
        const defaultSlide = document.createElement('div');
        defaultSlide.className = 'swiper-slide';
        defaultSlide.innerHTML = `
            <img src="/images/music-default-banner.jpg" 
                 alt="${altText}" 
                 class="banner-image"
                 style="object-fit:contain; background-color:#f8f9fa;">
        `;
        wrapper.appendChild(defaultSlide);
    }

    /**
     * 處理輪播圖錯誤
     */
    function handleBannerError() {
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#fdd; color:#d33;">輪播圖載入失敗</div>';
        
        const carouselElement = document.getElementById('banner-carousel');
        if (carouselElement) {
            carouselElement.querySelectorAll('.swiper-button-next, .swiper-button-prev, .swiper-pagination')
                .forEach(el => el.style.display = 'none');
        }
    }

    // ... 保持原有的歌手列表和專輯列表相關函數不變 ...

    // --- 頁面初始化 ---
    async function initializePage() {
        console.log("[Music] Initializing page");
        try {
            await Promise.all([
                fetchAndDisplayBanners(),
                fetchAndDisplayArtists()
            ]);
            await fetchAndDisplayAlbums();
            console.log("[Music] Page initialized");
        } catch (error) {
            console.error("[Music] Initialization error:", error);
        }
    }

    initializePage();
});