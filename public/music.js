// public/music.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素引用 ---
    const artistFilterNav = document.getElementById('artist-filter');
    const musicListContainer = document.getElementById('music-list');
    let currentArtistFilter = null;

    // --- Banner 相關元素 ---
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null;

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
 
        // 顯示載中狀態
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#f0f0f0;">載入輪播圖中...</div>';

        try {
            // 重點修改：只請求 music 頁面的輪播圖
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

            const banners = await response.json();
            
            console.log(`[Music] Received ${banners.length} banners for music page`);

            bannerWrapper.innerHTML = ''; // 清空載入狀態

            if (banners.length === 0) {
                // 沒有專用輪播圖時顯示預設圖片
                console.log("[Music] No banners for music page, showing default");
                const defaultSlide = document.createElement('div');
                defaultSlide.className = 'swiper-slide';
                defaultSlide.innerHTML = '<img src="/images/music-default-banner.jpg" alt="音樂專輯" style="width:100%; height:100%; object-fit:cover;">';
                bannerWrapper.appendChild(defaultSlide);
            } else {
                // 渲染輪播圖
                banners.forEach(banner => {
                    const slide = document.createElement('div');
                    slide.className = 'swiper-slide';

                    if (banner.link_url) {
                        const link = document.createElement('a');
                        link.href = banner.link_url;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.innerHTML = `<img src="${banner.image_url}" alt="${banner.alt_text || '音樂專輯輪播圖'}" style="width:100%; height:100%; object-fit:cover;">`;
                        slide.appendChild(link);
                    } else {
                        slide.innerHTML = `<img src="${banner.image_url}" alt="${banner.alt_text || '音樂專輯輪播圖'}" style="width:100%; height:100%; object-fit:cover;">`;
                    }

                    bannerWrapper.appendChild(slide);
                });
            }

            // 初始化/重新初始化 Swiper
            if (bannerSwiper) {
                bannerSwiper.destroy(true, true);
                bannerSwiper = null;
            }

            if (bannerWrapper.children.length > 0) {
                bannerSwiper = new Swiper('#banner-carousel', {
                    loop: banners.length > 1,
                    autoplay: {
                        delay: 10000,  // 10秒輪播
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
                    fadeEffect: {
                        crossFade: true
                    }
                });
            }
        } catch (error) {
            console.error("[Music] Banner error:", error);
            bannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#fdd; color:#d33;">輪播圖載入失敗</div>';
            
            // 隱藏導航元素
            const carouselElement = document.getElementById('banner-carousel');
            if (carouselElement) {
                const navElements = carouselElement.querySelectorAll('.swiper-button-next, .swiper-button-prev, .swiper-pagination');
                navElements.forEach(el => el.style.display = 'none');
            }
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
            allButton.classList.add('artist-filter-btn', 'active');  // 添加 artist-filter-btn
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
                button.classList.add('artist-filter-btn');  // 添加這行

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