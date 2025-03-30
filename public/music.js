// public/music.js
document.addEventListener('DOMContentLoaded', () => {
    const artistFilterNav = document.getElementById('artist-filter');
    const albumGrid = document.getElementById('album-grid');

    let currentArtistFilter = null; // 用於追蹤當前篩選的歌手

    /**
     * 獲取並顯示歌手篩選按鈕
     */
    async function fetchAndDisplayArtists() {
        if (!artistFilterNav) return; // 如果找不到容器就返回
        artistFilterNav.innerHTML = '<p>正在加載歌手列表...</p>'; // 顯示加載訊息

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
                setActiveArtistButton(allButton); // 更新按鈕樣式
                currentArtistFilter = null; // 清除篩選
                fetchAndDisplayAlbums(currentArtistFilter); // 重新獲取所有專輯
            });
            artistFilterNav.appendChild(allButton);

            // 為每個歌手創建按鈕
            artists.forEach(artist => {
                const button = document.createElement('button');
                button.textContent = artist;
                button.dataset.artist = artist; // 將歌手名存儲在 data 屬性中
                button.addEventListener('click', () => {
                    setActiveArtistButton(button); // 更新按鈕樣式
                    currentArtistFilter = artist; // 設定當前篩選
                    fetchAndDisplayAlbums(currentArtistFilter); // 獲取該歌手的專輯
                });
                artistFilterNav.appendChild(button);
            });

        } catch (error) {
            console.error("獲取歌手列表失敗:", error);
            artistFilterNav.innerHTML = '<p>無法加載歌手列表。</p>';
        }
    }

    /**
     * 獲取並顯示音樂專輯
     * @param {string|null} artist - 要篩選的歌手名稱，或 null 表示全部
     */
    async function fetchAndDisplayAlbums(artist = null) {
        if (!albumGrid) return;
        albumGrid.innerHTML = '<p>正在加載音樂專輯...</p>'; // 顯示加載訊息

        let apiUrl = '/api/music';
        if (artist) {
            // 如果有歌手篩選，添加到 URL 查詢參數 (需要 encodeURIComponent 處理特殊字符)
            apiUrl += `?artist=${encodeURIComponent(artist)}`;
        }

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`獲取音樂專輯失敗 (HTTP ${response.status})`);
            const albums = await response.json();

            albumGrid.innerHTML = ''; // 清空加載訊息

            if (albums.length === 0) {
                albumGrid.innerHTML = '<p>找不到相關的音樂專輯。</p>';
                return;
            }

            // 渲染專輯卡片
            albums.forEach(album => {
                const card = document.createElement('a'); // 讓整個卡片可點擊
                card.className = 'album-card';
                card.href = album.platform_url || '#'; // 連結到平台或 '#'
                if(album.platform_url) {
                   card.target = '_blank';
                   card.rel = 'noopener noreferrer';
                }

                const coverDiv = document.createElement('div');
                coverDiv.className = 'cover-image';
                const img = document.createElement('img');
                img.src = album.cover_art_url || '/images/placeholder.png'; // 專輯封面
                img.alt = album.title || '專輯封面';
                coverDiv.appendChild(img);

                const infoDiv = document.createElement('div');
                infoDiv.className = 'album-info';
                const titleH3 = document.createElement('h3');
                titleH3.textContent = album.title || '未知標題';
                const artistP = document.createElement('p');
                artistP.className = 'artist';
                artistP.textContent = album.artist || '未知歌手';
                const dateP = document.createElement('p');
                dateP.className = 'release-date';
                // 格式化日期 (可選)
                dateP.textContent = album.release_date ? new Date(album.release_date).toLocaleDateString() : '';


                infoDiv.appendChild(titleH3);
                infoDiv.appendChild(artistP);
                infoDiv.appendChild(dateP);

                card.appendChild(coverDiv);
                card.appendChild(infoDiv);

                albumGrid.appendChild(card);
            });

        } catch (error) {
            console.error("獲取音樂專輯失敗:", error);
            albumGrid.innerHTML = '<p>無法加載音樂專輯。</p>';
        }
    }

    /**
     * 輔助函數：設置當前活躍的歌手按鈕樣式
     * @param {HTMLElement} activeButton - 被點擊的按鈕元素
     */
    function setActiveArtistButton(activeButton) {
        // 移除所有按鈕的 active class
        artistFilterNav.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        // 為當前按鈕添加 active class
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    // --- 頁面初始加載 ---
    async function initializePage() {
        await fetchAndDisplayArtists(); // 首先加載歌手按鈕
        fetchAndDisplayAlbums();      // 然後加載所有最新專輯
    }

    initializePage(); // 執行初始化

}); // End of DOMContentLoaded