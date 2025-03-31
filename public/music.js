// public/music.js
document.addEventListener('DOMContentLoaded', () => {
    const artistFilterNav = document.getElementById('artist-filter');
    // *** 修改: 獲取正確的列表容器 ID ***
    const musicListContainer = document.getElementById('music-list');

    let currentArtistFilter = null; // 用於追蹤當前篩選的歌手


// --- 複製過來的 Banner 相關代碼 ---
const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
let bannerSwiper = null;

async function fetchAndDisplayBanners() {
    if (!bannerWrapper) { /* ... */ return; }
    bannerWrapper.innerHTML = '<div class="swiper-slide" style="...">載入中...</div>';
    try {
        const response = await fetch('/api/banners'); // **注意：這裡獲取所有 banner**
        if (!response.ok) { throw new Error(/* ... */); }
        const banners = await response.json();
        bannerWrapper.innerHTML = '';
        if (!banners || banners.length === 0) {
             bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy Logo" style="..."></div>';
        } else {
            banners.forEach(banner => { /* ... 生成 slide ... */ });
        }
        if (bannerSwiper) { bannerSwiper.destroy(true, true); bannerSwiper = null; }
        if (bannerWrapper.children.length > 0) {
            bannerSwiper = new Swiper('#banner-carousel', {
                loop: banners && banners.length > 1,
                autoplay: { delay: 12000, disableOnInteraction: false, pauseOnMouseEnter: true }, // <-- 速度在這裡調
                pagination: { el: '#banner-carousel .swiper-pagination', clickable: true },
                navigation: { nextEl: '#banner-carousel .swiper-button-next', prevEl: '#banner-carousel .swiper-button-prev' },
                // ... 其他 Swiper 選項
            });
        }
    } catch (error) { /* ... 錯誤處理 ... */ }
}
// --- Banner 代碼結束 ---


    /**
     * 獲取並顯示歌手篩選按鈕
     */
    async function fetchAndDisplayArtists() {
        if (!artistFilterNav) {
            console.error("歌手篩選導覽列 'artist-filter' 未找到！");
            return;
        }
        artistFilterNav.innerHTML = '<p>正在加載歌手列表...</p>';

        try {
            const response = await fetch('/api/artists');
            if (!response.ok) throw new Error(`獲取歌手列表失敗 (HTTP ${response.status})`);
            const artists = await response.json();

            artistFilterNav.innerHTML = ''; // 清空加載訊息

            // 創建 "全部歌手" 按鈕
            const allButton = document.createElement('button');
            allButton.textContent = '全部歌手';
            allButton.classList.add('active'); // 預設選中 "全部"
            allButton.addEventListener('click', () => {
                setActiveArtistButton(allButton);
                currentArtistFilter = null;
                fetchAndDisplayAlbums(currentArtistFilter); // 重新獲取所有音樂項目
            });
            artistFilterNav.appendChild(allButton);

            // 為每個歌手創建按鈕
            artists.forEach(artist => {
                const button = document.createElement('button');
                button.textContent = artist;
                button.dataset.artist = artist;
                button.addEventListener('click', () => {
                    setActiveArtistButton(button);
                    currentArtistFilter = artist;
                    fetchAndDisplayAlbums(currentArtistFilter); // 獲取該歌手的音樂項目
                });
                artistFilterNav.appendChild(button);
            });

        } catch (error) {
            console.error("獲取歌手列表失敗:", error);
            if (artistFilterNav) artistFilterNav.innerHTML = '<p>無法加載歌手列表。</p>';
        }
    }

    /**
     * 獲取並顯示音樂項目列表
     * @param {string|null} artist - 要篩選的歌手名稱，或 null 表示全部
     */
    async function fetchAndDisplayAlbums(artist = null) { // 函數名保持 albums 也可以，或者改成 fetchAndDisplayMusic
        // *** 修改: 檢查正確的容器變數 ***
        if (!musicListContainer) {
             console.error("音樂列表容器 'music-list' 未找到！");
             return;
        }
        // *** 修改: 使用正確的容器變數顯示加載訊息 ***
        musicListContainer.innerHTML = '<p>正在加載音樂列表...</p>';

        let apiUrl = '/api/music';
        if (artist) {
            apiUrl += `?artist=${encodeURIComponent(artist)}`;
        }
        console.log(`正在獲取音樂: ${apiUrl}`); // [除錯]

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`獲取音樂列表失敗 (HTTP ${response.status})`);
            const musicList = await response.json(); // *** 修改變數名 ***
            console.log("獲取的音樂數據:", musicList); // [除錯]

            // *** 修改: 使用正確的容器變數清空內容 ***
            musicListContainer.innerHTML = '';

            if (musicList.length === 0) {
                musicListContainer.innerHTML = '<p>找不到相關的音樂項目。</p>';
                return;
            }

            // --- 渲染音樂列表項目 (使用新的橫向列表結構) ---
            musicList.forEach((music, index) => { // *** 修改變數名 ***
                console.log(`正在渲染第 ${index + 1} 項音樂: ${music.title}`); // [除錯]
                const item = document.createElement('div'); // 創建列表項目的 div
                item.className = 'music-list-item';

                // 1. 封面
                const coverDiv = document.createElement('div');
                coverDiv.className = 'cover';
                const img = document.createElement('img');
                img.src = music.cover_art_url || '/images/placeholder.png';
                img.alt = music.title || '封面';
                coverDiv.appendChild(img);

                // 2. 歌曲資訊 (標題 + 歌手)
                const infoDiv = document.createElement('div');
                infoDiv.className = 'info';
                const titleSpan = document.createElement('span');
                titleSpan.className = 'title';
                titleSpan.textContent = music.title || '未知標題';
                const artistSpan = document.createElement('span');
                artistSpan.className = 'artist';
                artistSpan.textContent = music.artist || '未知歌手';
                infoDiv.appendChild(titleSpan);
                infoDiv.appendChild(artistSpan);

                // 3. 播放按鈕 (連結)
                const playLink = document.createElement('a');
                playLink.className = 'play-link';
                playLink.href = music.platform_url || '#';
                if (music.platform_url) {
                    playLink.target = '_blank';
                    playLink.rel = 'noopener noreferrer';
                    playLink.setAttribute('title', `在外部平台播放 ${music.title}`);
                } else {
                    playLink.style.opacity = '0.5';
                    playLink.style.cursor = 'default';
                    playLink.onclick = (e) => e.preventDefault();
                }
                // 播放圖標由 CSS 提供

                // 4. 發行日期
                const dateSpan = document.createElement('span');
                dateSpan.className = 'release-date';
                dateSpan.textContent = music.release_date ? new Date(music.release_date).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-') : '---- -- --'; // 格式化 YYYY-MM-DD

                // 組合列表項目
                item.appendChild(coverDiv);
                item.appendChild(infoDiv);
                item.appendChild(playLink);
                item.appendChild(dateSpan);

                // *** 修改: 使用正確的容器變數添加項目 ***
                musicListContainer.appendChild(item);
            }); // --- End of musicList.forEach ---

        } catch (error) {
            console.error("處理音樂列表時出錯:", error);
            // *** 修改: 使用正確的容器變數顯示錯誤 ***
            if (musicListContainer) musicListContainer.innerHTML = '<p>無法加載音樂列表。</p>';
        }
    } // --- End of fetchAndDisplayAlbums ---

    /**
     * 輔助函數：設置當前活躍的歌手按鈕樣式
     * @param {HTMLElement} activeButton - 被點擊的按鈕元素
     */
    function setActiveArtistButton(activeButton) {
        if (!artistFilterNav) return; // 添加保護
        artistFilterNav.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    // --- 頁面初始加載 ---
    async function initializePage() {
        await fetchAndDisplayArtists(); // 首先加載歌手按鈕
        fetchAndDisplayAlbums();      // 然後加載所有最新音樂項目
    }

    initializePage(); // 執行初始化

}); // End of DOMContentLoaded