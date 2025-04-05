// public/music.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素引用 ---
    const artistFilterNav = document.getElementById('artist-filter');
    const musicListContainer = document.getElementById('music-list');
    let currentArtistFilter = null;

    // --- 輪播圖相關元素 ---
    const randomBannerWrapper = document.querySelector('#random-banner-carousel .swiper-wrapper');
    let randomBannerSwiper = null;

    // --- 函數定義 ---

    /**
     * 獲取並顯示隨機輪播圖
     */
    async function fetchAndDisplayBanners() {
        console.log("[Music] Fetching banners for music page");
        
        try {
            const response = await fetch('/api/banners?page=home'); /* 選擇 home 或 music 或 news */
            console.log("[home] Banner API response status:", response.status);/* 選擇 home 或 music 或 news */

            if (!response.ok) {
                throw new Error(`獲取輪播圖失敗 (HTTP ${response.status})`);
            }

            const musicPageBanners = await response.json();
            console.log(`[Music] Received ${musicPageBanners.length} music page banners`);

            // 直接渲染隨機輪播圖
            renderRandomBanner(musicPageBanners);

        } catch (error) {
            console.error("[Music] Banner error:", error);
            handleBannerError();
        }
    }

    /**
     * 渲染隨機輪播圖
     */
    function renderRandomBanner(sourceBanners) {
        if (!randomBannerWrapper) return;

        randomBannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#f0f0f0;">載入隨機輪播圖中...</div>';

        // 從音樂頁輪播圖中隨機選擇
        const randomBanners = getRandomBanners(sourceBanners);

        setTimeout(() => {
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
     * 從音樂頁輪播圖中隨機選擇
     */
    function getRandomBanners(sourceBanners) {
        if (sourceBanners.length === 0) return [];
        
        // Fisher-Yates 洗牌算法
        const shuffled = [...sourceBanners];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled.slice(0, 5); // 返回最多5個隨機項目
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
                 style="object-fit:contain; background-color:#FFB74D;">
        `;
        wrapper.appendChild(defaultSlide);
    }

    /**
     * 處理輪播圖錯誤
     */
    function handleBannerError() {
        if (randomBannerWrapper) {
            randomBannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#fdd; color:#d33;">輪播圖載入失敗</div>';
        }
    }





    /**
     * 獲取並顯示歌手列表
     */
    async function fetchAndDisplayArtists() {
        if (!artistFilterNav) {
            console.error("Artist filter nav element not found");
            return;
        }

        artistFilterNav.innerHTML = '<p>正在加載歌手列表...</p>';

        try {
            const response = await fetch('/api/artists');
            if (!response.ok) {
                throw new Error(`獲取歌手列表失敗 (HTTP ${response.status})`);
            }

            const artists = await response.json();
            artistFilterNav.innerHTML = '';

            // 全部歌手按鈕
            const allButton = document.createElement('button');
            allButton.textContent = '全部歌手';
            allButton.classList.add('artist-filter-btn', 'active');
            allButton.addEventListener('click', () => {
                setActiveArtistButton(allButton);
                currentArtistFilter = null;
                fetchAndDisplayAlbums(currentArtistFilter);
            });
            artistFilterNav.appendChild(allButton);

            // 各歌手按鈕
            artists.forEach(artist => {
                const button = document.createElement('button');
                button.textContent = artist;
                button.classList.add('artist-filter-btn');
                button.dataset.artist = artist;
                button.addEventListener('click', () => {
                    setActiveArtistButton(button);
                    currentArtistFilter = artist;
                    fetchAndDisplayAlbums(currentArtistFilter);
                });
                artistFilterNav.appendChild(button);
            });

        } catch (error) {
            console.error("[Music] Fetch artists error:", error);
            if (artistFilterNav) {
                artistFilterNav.innerHTML = '<p>無法加載歌手列表</p>';
            }
        }
    }

    /**
     * 設置當前選中的歌手按鈕
     */
    function setActiveArtistButton(activeButton) {
        if (!artistFilterNav) return;
        
        // 移除所有按鈕的 active 類
        artistFilterNav.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 添加 active 類到當前按鈕
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    /**
     * 獲取並顯示專輯列表
     */
    async function fetchAndDisplayAlbums(artist = null) {
        if (!musicListContainer) {
            console.error("Music list container not found");
            return;
        }

        musicListContainer.innerHTML = '<p>正在加載音樂列表...</p>';

        try {
            let apiUrl = '/api/music';
            if (artist) {
                apiUrl += `?artist=${encodeURIComponent(artist)}`;
            }

            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`獲取音樂列表失敗 (HTTP ${response.status})`);
            }

            const musicList = await response.json();
            musicListContainer.innerHTML = '';

            if (musicList.length === 0) {
                musicListContainer.innerHTML = '<p>找不到相關的音樂項目</p>';
                return;
            }

            // 創建專輯格線容器
            const albumGrid = document.createElement('div');
            albumGrid.className = 'album-grid';

            // 填充專輯卡片
            musicList.forEach(music => {
                const albumCard = document.createElement('a');
                albumCard.className = 'album-card';
                albumCard.href = music.platform_url || '#';
                
                if (music.platform_url) {
                    albumCard.target = '_blank';
                    albumCard.rel = 'noopener noreferrer';
                } else {
                    albumCard.onclick = (e) => e.preventDefault();
                }

                // 封面圖片
                const coverDiv = document.createElement('div');
                coverDiv.className = 'cover-image';
                const coverImg = document.createElement('img');
                coverImg.src = music.cover_art_url || '/images/placeholder.png';
                coverImg.alt = music.title || '專輯封面';
                coverDiv.appendChild(coverImg);

                // 專輯資訊
                const infoDiv = document.createElement('div');
                infoDiv.className = 'album-info';
                
                const title = document.createElement('h3');
                title.textContent = music.title || '未知專輯';
                
                const artist = document.createElement('p');
                artist.className = 'artist';
                artist.textContent = music.artist || '未知歌手';
                
                const date = document.createElement('p');
                date.className = 'release-date';
                date.textContent = music.release_date 
                    ? new Date(music.release_date).toLocaleDateString('zh-TW') 
                    : '發行日期未知';

                infoDiv.appendChild(title);
                infoDiv.appendChild(artist);
                infoDiv.appendChild(date);

                albumCard.appendChild(coverDiv);
                albumCard.appendChild(infoDiv);
                albumGrid.appendChild(albumCard);
            });

            musicListContainer.appendChild(albumGrid);

        } catch (error) {
            console.error("[Music] Fetch albums error:", error);
            if (musicListContainer) {
                musicListContainer.innerHTML = `<p>無法加載音樂列表: ${error.message}</p>`;
            }
        }
    }

    // --- 頁面初始化 ---
    async function initializePage() {
        console.log("[Music] Initializing page");
        try {
            await Promise.all([
                fetchAndDisplayBanners(), // 只需初始化一個輪播
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