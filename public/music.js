// public/music.js (完整替換)
document.addEventListener('DOMContentLoaded', () => {
    const artistFilterNav = document.getElementById('artist-filter');
    const musicListContainer = document.getElementById('music-list'); // 確保 ID 正確
    let currentArtistFilter = null;

    // --- Banner 相關代碼 ---
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper'); // 確保 HTML 中有這個元素
    let bannerSwiper = null;

    async function fetchAndDisplayBanners() {
        console.log("[Music Banner] fetchAndDisplayBanners called"); // 添加日誌
        if (!bannerWrapper) {
             console.warn("[Music Banner] 未找到 Banner wrapper 元素 (#banner-carousel .swiper-wrapper)。");
             const carouselElement = document.getElementById('banner-carousel');
             if (carouselElement) carouselElement.style.display = 'none'; // 隱藏輪播區
             return;
        }
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#f0f0f0;">Banner 載入中...</div>';

        try {
            // **重要：目前這會獲取所有 Banner，因為你的 API (/api/banners) 還沒有按頁面篩選功能**
            // **如果你之後實現了後端篩選，這裡需要改成 fetch('/api/banners?page=music')**
            const response = await fetch('/api/banners');
            console.log("[Music Banner] API Response Status:", response.status); // 添加日誌

            if (!response.ok) {
                let errorText = `獲取 Banners 失敗 (HTTP ${response.status})`;
                try { const data = await response.json(); errorText += `: ${data.error || response.statusText}`; } catch (e) {}
                throw new Error(errorText);
            }
            const banners = await response.json();
            console.log("[Music Banner] Received banners:", banners); // 添加日誌

            bannerWrapper.innerHTML = ''; // 清空 Loading

            if (!banners || banners.length === 0) {
                console.log("[Music Banner] 未收到 Banner 數據，顯示預設 Logo。");
                bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy Logo" style="max-height: 80%; object-fit: contain;"></div>';
            } else {
                 console.log(`[Music Banner] 渲染 ${banners.length} 個 Banner Slides...`); // 添加日誌
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
            }

            if (bannerSwiper) {
                console.log("[Music Banner] 銷毀舊 Swiper 實例。");
                bannerSwiper.destroy(true, true);
                bannerSwiper = null;
            }

            if (bannerWrapper.children.length > 0) {
                console.log("[Music Banner] 初始化 Swiper...");
                bannerSwiper = new Swiper('#banner-carousel', { // 確保 HTML 中有 #banner-carousel
                    loop: banners && banners.length > 1,
                     // *** 輪播速度 (12000毫秒 = 12秒) ***
                    autoplay: { delay: 12000, disableOnInteraction: false, pauseOnMouseEnter: true },
                    pagination: { el: '#banner-carousel .swiper-pagination', clickable: true },
                    navigation: { nextEl: '#banner-carousel .swiper-button-next', prevEl: '#banner-carousel .swiper-button-prev' },
                    slidesPerView: 1,
                    spaceBetween: 0,
                    grabCursor: true,
                    keyboard: { enabled: true },
                });
                console.log("[Music Banner] Swiper 初始化完成。");
            } else {
                 console.log("[Music Banner] Wrapper 為空，不初始化 Swiper。");
            }

        } catch (error) {
            console.error("[Music Banner] 處理 Banner 時出錯:", error);
            bannerWrapper.innerHTML = `<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#fdd; color: #d33;">輪播圖載入失敗: ${error.message}</div>`;
            // 隱藏導航和分頁
             const carouselElement = document.getElementById('banner-carousel');
             if (carouselElement) {
                 const navNext = carouselElement.querySelector('.swiper-button-next');
                 const navPrev = carouselElement.querySelector('.swiper-button-prev');
                 const pagination = carouselElement.querySelector('.swiper-pagination');
                 if(navNext) navNext.style.display = 'none';
                 if(navPrev) navPrev.style.display = 'none';
                 if(pagination) pagination.style.display = 'none';
             }
        }
    }
    // --- Banner 代碼結束 ---


    async function fetchAndDisplayArtists() {
        // ... (你的 fetchAndDisplayArtists 函數內容不變) ...
        if (!artistFilterNav) { console.error("歌手篩選導覽列 'artist-filter' 未找到！"); return; } artistFilterNav.innerHTML = '<p>正在加載歌手列表...</p>'; try { const response = await fetch('/api/artists'); if (!response.ok) throw new Error(`獲取歌手列表失敗 (HTTP ${response.status})`); const artists = await response.json(); artistFilterNav.innerHTML = ''; const allButton = document.createElement('button'); allButton.textContent = '全部歌手'; allButton.classList.add('active'); allButton.addEventListener('click', () => { setActiveArtistButton(allButton); currentArtistFilter = null; fetchAndDisplayAlbums(currentArtistFilter); }); artistFilterNav.appendChild(allButton); artists.forEach(artist => { const button = document.createElement('button'); button.textContent = artist; button.dataset.artist = artist; button.addEventListener('click', () => { setActiveArtistButton(button); currentArtistFilter = artist; fetchAndDisplayAlbums(currentArtistFilter); }); artistFilterNav.appendChild(button); }); } catch (error) { console.error("獲取歌手列表失敗:", error); if (artistFilterNav) artistFilterNav.innerHTML = '<p>無法加載歌手列表。</p>'; }
    }

    async function fetchAndDisplayAlbums(artist = null) {
        // ... (你的 fetchAndDisplayAlbums 函數內容不變) ...
         if (!musicListContainer) { console.error("音樂列表容器 'music-list' 未找到！"); return; } musicListContainer.innerHTML = '<p>正在加載音樂列表...</p>'; let apiUrl = '/api/music'; if (artist) { apiUrl += `?artist=${encodeURIComponent(artist)}`; } console.log(`正在獲取音樂: ${apiUrl}`); try { const response = await fetch(apiUrl); if (!response.ok) throw new Error(`獲取音樂列表失敗 (HTTP ${response.status})`); const musicList = await response.json(); console.log("獲取的音樂數據:", musicList); musicListContainer.innerHTML = ''; if (musicList.length === 0) { musicListContainer.innerHTML = '<p>找不到相關的音樂項目。</p>'; return; } musicList.forEach((music, index) => { console.log(`正在渲染第 ${index + 1} 項音樂: ${music.title}`); const item = document.createElement('div'); item.className = 'music-list-item'; const coverDiv = document.createElement('div'); coverDiv.className = 'cover'; const img = document.createElement('img'); img.src = music.cover_art_url || '/images/placeholder.png'; img.alt = music.title || '封面'; coverDiv.appendChild(img); const infoDiv = document.createElement('div'); infoDiv.className = 'info'; const titleSpan = document.createElement('span'); titleSpan.className = 'title'; titleSpan.textContent = music.title || '未知標題'; const artistSpan = document.createElement('span'); artistSpan.className = 'artist'; artistSpan.textContent = music.artist || '未知歌手'; infoDiv.appendChild(titleSpan); infoDiv.appendChild(artistSpan); const playLink = document.createElement('a'); playLink.className = 'play-link'; playLink.href = music.platform_url || '#'; if (music.platform_url) { playLink.target = '_blank'; playLink.rel = 'noopener noreferrer'; playLink.setAttribute('title', `在外部平台播放 ${music.title}`); } else { playLink.style.opacity = '0.5'; playLink.style.cursor = 'default'; playLink.onclick = (e) => e.preventDefault(); } const dateSpan = document.createElement('span'); dateSpan.className = 'release-date'; dateSpan.textContent = music.release_date ? new Date(music.release_date).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-') : '---- -- --'; item.appendChild(coverDiv); item.appendChild(infoDiv); item.appendChild(playLink); item.appendChild(dateSpan); musicListContainer.appendChild(item); }); } catch (error) { console.error("處理音樂列表時出錯:", error); if (musicListContainer) musicListContainer.innerHTML = '<p>無法加載音樂列表。</p>'; }
    }

    function setActiveArtistButton(activeButton) {
        // ... (你的 setActiveArtistButton 函數內容不變) ...
         if (!artistFilterNav) return; artistFilterNav.querySelectorAll('button').forEach(btn => btn.classList.remove('active')); if (activeButton) { activeButton.classList.add('active'); }
    }

    // --- 頁面初始加載 ---
    async function initializePage() {
        console.log("Music Page: Initializing..."); // 添加日誌
        // *** 修改這裡：同時開始加載 Banner 和 Artists ***
        fetchAndDisplayBanners(); // 開始獲取 Banner
        await fetchAndDisplayArtists(); // 等待歌手列表加載完成
        fetchAndDisplayAlbums();      // 加載所有音樂項目
        console.log("Music Page: Initialization sequence complete."); // 添加日誌
    }

    initializePage(); // 執行初始化

}); // End of DOMContentLoaded