// music.js - 整合樂譜功能
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM元素獲取 ---
    const musicListContainer = document.getElementById('music-list');
    const scoresListContainer = document.getElementById('scores-list');
    const songList = document.getElementById('song-list');
    
    // 音樂專輯相關元素
    const artistDrawerContent = document.getElementById('artist-drawer-content');
    const artistDrawerBtn = document.getElementById('artist-drawer-btn');
    const artistDrawer = document.getElementById('artist-drawer');
    const artistDrawerClose = document.getElementById('artist-drawer-close');
    const drawerOverlay = document.getElementById('drawer-overlay');
    
    // 樂譜相關新增元素
    const scoresFilterBtn = document.getElementById('scores-filter-btn');
    const scoresFilterModal = document.getElementById('scores-filter-modal');
    const scoresFilterClose = document.getElementById('scores-filter-close');
    const scoresFilterOverlay = document.getElementById('scores-filter-overlay');
    const scoresFilterArtists = document.getElementById('scores-filter-artists');
    
    



    
    const sortLinks = document.querySelectorAll('.sort-link');
    const backToTopButton = document.getElementById('back-to-top');
    
    // --- 當前狀態 ---
    let currentArtistFilter = null;        // 當前音樂專輯的歌手篩選
    let currentScoresArtistFilter = null;  // 當前樂譜的歌手篩選
    let currentSortBy = 'music';           // 預設為音樂專輯
    let allSongsData = [];                 // 儲存樂譜的歌曲數據
    
    // --- 檢查是否為移動設備 ---
    const isMobileDevice = () => window.innerWidth <= 767;
    
    // --- 初始化各功能 ---
    initSwiper();
    setupSortLinks();
    setupDrawer();
    setupScoresFilter();
    setupBackToTop();
    setupCharacterInteractions();
    
    // 初始加載音樂專輯
    fetchAndDisplayAlbums();

      // 加載歌手列表 - 確保這行代碼被執行
      fetchAndDisplayArtists();
    


      function updateArtistButtonForScores() {
        artistDrawerBtn.textContent = '歌手篩選';
        
        // 載入有樂譜的歌手列表
        loadScoresArtistDrawer(); // 確保這個函數可以正確工作
    }
      
    /**
     * 
     * 
     * 
     * 
     * 初始化Swiper輪播
     */
    function initSwiper() {
        // 獲取banner數據
        fetch('/api/banners?page=music')
            .then(response => response.json())
            .then(banners => {
                const swiperWrapper = document.querySelector('.swiper-wrapper');
                
                // 清空現有內容
                swiperWrapper.innerHTML = '';
                
                // 添加輪播項
                if (banners.length === 0) {
                    // 如果沒有banner，顯示默認
                    swiperWrapper.innerHTML = `
                        <div class="swiper-slide">
                            <img src="/images/SunnyYummy.png" alt="SunnyYummy">
                        </div>
                    `;
                } else {
                    // 創建每個輪播項
                    banners.forEach(banner => {
                        const slide = document.createElement('div');
                        slide.className = 'swiper-slide';
                        
                        if (banner.link_url) {
                            slide.innerHTML = `
                                <a href="${banner.link_url}" target="_blank" rel="noopener noreferrer">
                                    <img src="${banner.image_url}" alt="${banner.alt_text || 'Banner'}">
                                </a>
                            `;
                        } else {
                            slide.innerHTML = `
                                <img src="${banner.image_url}" alt="${banner.alt_text || 'Banner'}">
                            `;
                        }
                        
                        swiperWrapper.appendChild(slide);
                    });
                }
                
                // 初始化Swiper
                new Swiper('#music-banner-carousel', {
                    loop: true,
                    autoplay: {
                        delay: 5000,
                        disableOnInteraction: false,
                    },
                    effect: 'fade',
                    fadeEffect: {
                        crossFade: true
                    },
                    pagination: {
                        el: '.swiper-pagination',
                        clickable: true,
                    },
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev',
                    },
                });
            })
            .catch(error => {
                console.error('獲取Banner時出錯:', error);
                const swiperWrapper = document.querySelector('.swiper-wrapper');
                swiperWrapper.innerHTML = `
                    <div class="swiper-slide">
                        <img src="/images/SunnyYummy.png" alt="SunnyYummy">
                    </div>
                `;
                
                // 即使出錯也初始化Swiper
                new Swiper('#music-banner-carousel', {
                    loop: false,
                    pagination: {
                        el: '.swiper-pagination',
                        clickable: true,
                    },
                });
            });
    }
    
    /**
     * 設置歌手導航抽屜
     */
    function setupDrawer() {
        // 點擊按鈕打開抽屜
        if (artistDrawerBtn) {
            artistDrawerBtn.addEventListener('click', () => {
                openDrawer();
            });
        }
        
        // 點擊關閉按鈕關閉抽屜
        if (artistDrawerClose) {
            artistDrawerClose.addEventListener('click', () => {
                closeDrawer();
            });
        }
        
        // 點擊遮罩關閉抽屜
        if (drawerOverlay) {
            drawerOverlay.addEventListener('click', () => {
                closeDrawer();
            });
        }
        
        // ESC 鍵關閉抽屜
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && artistDrawer && artistDrawer.classList.contains('open')) {
                closeDrawer();
            }
        });
    }
    
    // 打開抽屜函數
    function openDrawer() {
        if (artistDrawer) artistDrawer.classList.add('open');
        if (drawerOverlay) drawerOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden'; // 防止背景滾動
    }
    
    // 關閉抽屜函數
    function closeDrawer() {
        if (artistDrawer) artistDrawer.classList.remove('open');
        if (drawerOverlay) drawerOverlay.classList.remove('visible');
        document.body.style.overflow = ''; // 恢復滾動
    }
    
    /**
     * 設置樂譜篩選彈窗
     */
    function setupScoresFilter() {
        // 點擊按鈕打開彈窗
        if (scoresFilterBtn) {
            scoresFilterBtn.addEventListener('click', () => {
                openScoresFilter();
                
                // 如果歌手列表還沒加載，則加載
                if (!scoresFilterArtists || scoresFilterArtists.children.length <= 1) {
                    loadScoresFilterArtists();
                }
            });
        }
        
        // 點擊關閉按鈕關閉彈窗
        if (scoresFilterClose) {
            scoresFilterClose.addEventListener('click', () => {
                closeScoresFilter();
            });
        }
        
        // 點擊遮罩關閉彈窗
        if (scoresFilterOverlay) {
            scoresFilterOverlay.addEventListener('click', () => {
                closeScoresFilter();
            });
        }
        
        // ESC 鍵關閉彈窗
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && scoresFilterModal && scoresFilterModal.classList.contains('open')) {
                closeScoresFilter();
            }
        });
    }
    
    // 打開樂譜篩選彈窗
    function openScoresFilter() {
        if (scoresFilterModal) scoresFilterModal.classList.add('open');
        if (scoresFilterOverlay) scoresFilterOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden'; // 防止背景滾動
    }
    
    // 關閉樂譜篩選彈窗
    function closeScoresFilter() {
        if (scoresFilterModal) scoresFilterModal.classList.remove('open');
        if (scoresFilterOverlay) scoresFilterOverlay.classList.remove('visible');
        document.body.style.overflow = ''; // 恢復滾動
    }
    
    /**
     * 專輯卡片漸入動畫
     */
    function animateAlbumsIn() {
        const cards = document.querySelectorAll('.album-card');
        cards.forEach((card, index) => {
            // 設置初始狀態
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            // 設置延遲動畫以產生級聯效果
            setTimeout(() => {
                card.style.transition = 'opacity 0.5s, transform 0.5s';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 50 * index); // 每張卡片延遲 50ms
        });
    }
    
    /**  
     * 樂譜列表漸入動畫
     */
    function animateSongsIn() {
        const items = document.querySelectorAll('#song-list li');
        items.forEach((item, index) => {
            // 設置初始狀態
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            
            // 設置延遲動畫
            setTimeout(() => {
                item.style.transition = 'opacity 0.5s, transform 0.5s';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, 50 * index);
        });
    }
    
    /**
     * 設置排序連結事件
     */
    function setupSortLinks() {
        if (sortLinks.length > 0) {
            sortLinks.forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    
                    // 移除所有連結的 active 類
                    sortLinks.forEach(otherLink => otherLink.classList.remove('active'));
                    // 為當前點擊的連結添加 active 類
                    link.classList.add('active');
                    
                    // 獲取排序方式
                    const sortBy = link.dataset.sort;
                    
                    if (sortBy) {
                        currentSortBy = sortBy;
                        
                        // 根據選擇的類型顯示不同內容
                        if (sortBy === 'scores') {
                            artistDrawerBtn.style.display = 'none'; // 隱藏歌手列表按鈕
                            showScoresList(); // 顯示樂譜列表
                        } else {
                            artistDrawerBtn.style.display = 'block'; // 顯示歌手列表按鈕
                            showMusicAlbums(); // 顯示音樂專輯
                        }
                    }
                });
            });
        }
    }
    
    /**
     * 顯示音樂專輯列表
     */
    function showMusicAlbums() {
        if (musicListContainer) musicListContainer.style.display = 'block';
        if (scoresListContainer) scoresListContainer.style.display = 'none';
        
        // 如果還沒加載過音樂專輯，則加載
        if (musicListContainer.innerHTML === '' || musicListContainer.innerHTML === '<p>正在加載音樂列表...</p>') {
            fetchAndDisplayAlbums(currentArtistFilter);
        }
    }
    
    /**
     * 顯示樂譜列表
     */
    function showScoresList() {
        if (musicListContainer) musicListContainer.style.display = 'none';
        if (scoresListContainer) scoresListContainer.style.display = 'block';
        
        // 總是加載樂譜，以確保所有樂譜都顯示出來
        fetchSongs(currentScoresArtistFilter || 'All');
    }
    
    /**
     * 設置回到頂部按鈕
     */
    function setupBackToTop() {
        if (!backToTopButton) {
            console.error("返回頂部按鈕元素未找到！");
            return;
        }
        
        // 監聽滾動事件
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
        });
        
        // 點擊回到頂部
        backToTopButton.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
    /**
     * 設置角色互動效果
     */
    function setupCharacterInteractions() {
        const characters = document.querySelectorAll('.floating-character');
        
        // 定義每個角色的對話內容
        const speeches = {
            'pink-character': ['哈囉！', '喜歡音樂嗎？', '試聽新歌了嗎？'],
            'blue-character': ['嗨！你好！', '有新歌啦！', '聽聽我的新專輯吧！'],
            'yellow-character': ['耶！找到我了！', '來聽音樂吧！', '超級開心！']
        };
        
        // 為每個角色創建對話氣泡元素
        characters.forEach(character => {
            // 創建對話氣泡
            const speechBubble = document.createElement('div');
            speechBubble.className = 'character-speech';
            character.appendChild(speechBubble);
            
            // 獲取角色類型
            const characterType = Array.from(character.classList)
                .find(cls => cls.includes('-character') && cls !== 'floating-character');
            
            // 觸摸/點擊事件處理
            character.addEventListener('touchstart', handleInteraction, { passive: true });
            character.addEventListener('click', handleInteraction);
            
            function handleInteraction(e) {
                // 防止事件冒泡和默認行為
                e.stopPropagation();
                if (e.type === 'click') e.preventDefault();
                
                // 已經被觸摸，忽略
                if (character.classList.contains('touched') || 
                    character.classList.contains('bounce-back')) return;
                
                // 添加觸摸效果
                character.classList.add('touched');
                
                // 隨機選擇一句對話
                const possibleSpeeches = speeches[characterType] || ['嗨！'];
                const randomSpeech = possibleSpeeches[Math.floor(Math.random() * possibleSpeeches.length)];
                
                // 顯示對話氣泡
                speechBubble.textContent = randomSpeech;
                speechBubble.classList.add('visible');
                
                // 1秒後移除觸摸效果，添加彈回動畫
                setTimeout(() => {
                    character.classList.remove('touched');
                    character.classList.add('bounce-back');
                    
                    // 1.5秒後隱藏對話氣泡
                    setTimeout(() => {
                        speechBubble.classList.remove('visible');
                    }, 1500);
                    
                    // 動畫結束後移除彈回類
                    setTimeout(() => {
                        character.classList.remove('bounce-back');
                    }, 800);
                }, 1000);
            }
        });
    }
    
    // --- 音樂專輯相關功能 ---
    /**
 * 獲取並顯示歌手列表（音樂專輯）
 */// 修改 fetchAndDisplayArtists 函數
async function fetchAndDisplayArtists() {
    if (!artistDrawerContent) {
        console.error("Artist drawer content element not found");
        return;
    }

    // 清除之前內容並顯示加載中
    artistDrawerContent.innerHTML = '<button class="artist-drawer-btn active">全部歌手</button><button class="artist-drawer-btn">載入中...</button>';
    
    try {
        // 修改 API 路徑為 /api/scores/artists 與 scores.js 一致
        const response = await fetch('/api/scores/artists');
        if (!response.ok) {
            throw new Error(`獲取歌手列表失敗 (HTTP ${response.status})`);
        }

        const artists = await response.json();
        
        // 清除現有按鈕
        artistDrawerContent.innerHTML = '';

        // 全部歌手按鈕
        const allButton = document.createElement('button');
        allButton.textContent = '全部歌手';
        allButton.classList.add('artist-drawer-btn', 'active');
        allButton.addEventListener('click', () => {
            setActiveArtistButton(allButton);
            currentArtistFilter = null;
            fetchAndDisplayAlbums(currentArtistFilter);
            closeDrawer();
        });
        artistDrawerContent.appendChild(allButton);

        // 各歌手按鈕
        artists.forEach(artist => {
            const button = document.createElement('button');
            button.textContent = artist;
            button.classList.add('artist-drawer-btn');
            button.addEventListener('click', () => {
                setActiveArtistButton(button);
                currentArtistFilter = artist;
                fetchAndDisplayAlbums(currentArtistFilter);
                closeDrawer();
            });
            artistDrawerContent.appendChild(button);
        });

        console.log("歌手列表加載成功：", artists);

    } catch (error) {
        console.error("[Music] Fetch artists error:", error);
        // 顯示錯誤訊息
        artistDrawerContent.innerHTML = '<button class="artist-drawer-btn active">全部歌手</button><p style="color:red;padding:10px;">無法載入歌手列表</p>';
    }
}
    /**
     * 設置當前選中的歌手按鈕
     */
    function setActiveArtistButton(activeButton) {
        if (!artistDrawerContent) return;
        
        // 移除所有按鈕的 active 類
        artistDrawerContent.querySelectorAll('.artist-drawer-btn').forEach(btn => {
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

        musicListContainer.innerHTML = '<p class="loading-text">正在加載音樂列表...</p>';

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
            
            if (musicList.length === 0) {
                musicListContainer.innerHTML = '<p class="no-products">找不到相關的音樂項目</p>';
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

                // 歌手名稱 - 放在 cover-image 裡
                const artistElem = document.createElement('p');
                artistElem.className = 'artist';
                // 修改以處理 music.artists 陣列
                const artistsDisplay = music.artists && music.artists.length > 0
                    ? music.artists.map(a => a.name).join(', ')
                    : '未知歌手';
                artistElem.textContent = artistsDisplay;
                coverDiv.appendChild(artistElem);
                
                // 專輯資訊
                const infoDiv = document.createElement('div');
                infoDiv.className = 'album-info';
                
                const title = document.createElement('h3');
                title.textContent = music.title || '未知專輯';
                
                const date = document.createElement('p');
                date.className = 'release-date';
                date.textContent = music.release_date 
                    ? new Date(music.release_date).toLocaleDateString('zh-TW') 
                    : '發行日期未知';

                infoDiv.appendChild(title);
                infoDiv.appendChild(date);

                albumCard.appendChild(coverDiv);
                albumCard.appendChild(infoDiv);
                albumGrid.appendChild(albumCard);
            });

            musicListContainer.innerHTML = '';
            musicListContainer.appendChild(albumGrid);
            
            // 使用漸入效果顯示專輯
            animateAlbumsIn();

        } catch (error) {
            console.error("[Music] Fetch albums error:", error);
            if (musicListContainer) {
                musicListContainer.innerHTML = `<p class="error-text">無法加載音樂列表: ${error.message}</p>`;
                
                // 如果API不可用，顯示模擬數據
                displayMockAlbums(artist);
            }
        }
    }
    
    /**
     * 顯示模擬專輯數據（API不可用時）
     */
    function displayMockAlbums(artist = null) {
        // 模擬數據
        const mockAlbums = [
            {
                title: '陽光美味',
                artist: 'SunnyYummy樂團',
                cover_art_url: '/images/album1.jpg',
                release_date: '2023-05-15',
                platform_url: '#'
            },
            {
                title: '快樂星球',
                artist: 'Paula',
                cover_art_url: '/images/album2.jpg',
                release_date: '2023-02-20',
                platform_url: '#'
            },
            {
                title: '童話世界',
                artist: '亞米媽媽',
                cover_art_url: '/images/album3.jpg',
                release_date: '2022-12-10',
                platform_url: '#'
            },
            {
                title: '彩虹之歌',
                artist: '盒盒',
                cover_art_url: '/images/album4.jpg',
                release_date: '2022-10-05',
                platform_url: '#'
            }
        ];
        
        // 依據歌手過濾
        let filteredAlbums = mockAlbums;
        if (artist) {
            filteredAlbums = mockAlbums.filter(album => album.artist === artist);
        }
        
        if (filteredAlbums.length === 0) {
            musicListContainer.innerHTML = '<p class="no-products">找不到相關的音樂項目</p>';
            return;
        }
        
        // 創建專輯格線容器
        const albumGrid = document.createElement('div');
        albumGrid.className = 'album-grid';
        
        // 填充專輯卡片
        filteredAlbums.forEach(music => {
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
            
            // 歌手名稱 - 放在 cover-image 裡
            const artistElem = document.createElement('p');
            artistElem.className = 'artist';
            artistElem.textContent = music.artist || '未知歌手';
            coverDiv.appendChild(artistElem);
            
            // 專輯資訊
            const infoDiv = document.createElement('div');
            infoDiv.className = 'album-info';
            
            const title = document.createElement('h3');
            title.textContent = music.title || '未知專輯';
            
            const date = document.createElement('p');
            date.className = 'release-date';
            date.textContent = music.release_date 
                ? new Date(music.release_date).toLocaleDateString('zh-TW') 
                : '發行日期未知';
            
            infoDiv.appendChild(title);
            infoDiv.appendChild(date);
            
            albumCard.appendChild(coverDiv);
            albumCard.appendChild(infoDiv);
            albumGrid.appendChild(albumCard);
        });
        
        musicListContainer.innerHTML = '<p class="info-text">使用示範數據顯示（API連接失敗）</p>';
        musicListContainer.appendChild(albumGrid);
        
        // 使用漸入效果顯示專輯
        animateAlbumsIn();
    }




    // --- 樂譜相關功能 ---

    /**
     * 獲取API數據的通用函數
     */
    async function fetchApi(url, errorMessage) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                let errorDetails = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorDetails += `, message: ${errorData.error || response.statusText}`;
                } catch (parseError) {
                    errorDetails += `, message: ${response.statusText}`;
                }
                throw new Error(errorDetails);
            }
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            } else {
                console.warn(`API ${url} did not return JSON. Content-Type: ${contentType}`);
                return {};
            }
        } catch (error) {
            console.error(`${errorMessage}:`, error);
            throw error;
        }
    }
    
    
   async function fetchArtists() {
    try {
        const artists = await fetchApi('/api/scores/artists', 'Error fetching artists');
        console.log('API 返回的歌手列表:', artists); // 增加日誌輸出
        return artists; // 確保這裡返回數組
    } catch (error) {
        console.error('獲取樂譜歌手列表失敗:', error);
        // 返回預設歌手列表作為後備方案
        return ['Paula', 'SunnyYummy樂團', '亞米媽媽', '林莉C亞米', '皓皓justin'];
    }
}
    
    
    
    async function loadScoresFilterArtists() {
    // 檢查元素存在性
    const scoresFilterArtists = document.getElementById('scores-filter-artists');
    if (!scoresFilterArtists) {
        console.error('scores-filter-artists 元素不存在!');
        return;
    }
    
    // 顯示加載中狀態
    scoresFilterArtists.innerHTML = '<button class="scores-filter-btn active">全部歌手</button><button class="scores-filter-btn">載入中...</button>';
    
    try {
        // 確保等待 Promise 完成
        const artists = await fetchArtists();
        console.log('獲取的歌手列表:', artists); // 調試日誌
        
        // 再次檢查元素是否仍然存在（DOM 可能在等待期間變化）
        if (!document.getElementById('scores-filter-artists')) {
            console.error('處理數據時 scores-filter-artists 元素已不存在!');
            return;
        }
        
        // 清空現有內容
        scoresFilterArtists.innerHTML = '';
        
        // 添加「全部歌手」按鈕
        const allButton = document.createElement('button');
        allButton.textContent = '全部歌手';
        allButton.classList.add('scores-filter-btn', 'active');
        allButton.addEventListener('click', () => {
            setActiveScoresFilterButton(allButton);
            currentScoresArtistFilter = 'All';
            fetchSongs('All');
            closeScoresFilter();
        });
        scoresFilterArtists.appendChild(allButton);
        
        // 添加各歌手按鈕
        if (artists && artists.length > 0) {
            artists.forEach(artist => {
                const button = document.createElement('button');
                button.textContent = artist;
                button.classList.add('scores-filter-btn');
                button.addEventListener('click', () => {
                    setActiveScoresFilterButton(button);
                    currentScoresArtistFilter = artist;
                    fetchSongs(encodeURIComponent(artist));
                    closeScoresFilter();
                });
                scoresFilterArtists.appendChild(button);
            });
        } else {
            // 如果沒有歌手數據，顯示提示
            const noArtistsMsg = document.createElement('p');
            noArtistsMsg.textContent = '暫無歌手數據';
            noArtistsMsg.style.padding = '10px';
            noArtistsMsg.style.color = '#666';
            scoresFilterArtists.appendChild(noArtistsMsg);
        }
    } catch (error) {
        console.error('載入樂譜歌手篩選內容失敗:', error);
        
        // 再次檢查元素
        if (!document.getElementById('scores-filter-artists')) return;
        
        // 顯示錯誤信息
        scoresFilterArtists.innerHTML = '';
        const errorMsg = document.createElement('p');
        errorMsg.textContent = '載入歌手列表失敗';
        errorMsg.style.color = 'red';
        errorMsg.style.padding = '10px';
        scoresFilterArtists.appendChild(errorMsg);
    }
}
    /**
     * 設置活躍的樂譜歌手篩選按鈕
     */
    function setActiveScoresFilterButton(activeButton) {
        if (!scoresFilterArtists) return;
        
        // 移除所有按鈕的 active 類
        scoresFilterArtists.querySelectorAll('.scores-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 添加 active 類到當前按鈕
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    /**
     * 獲取並顯示樂譜歌曲列表
     */
    async function fetchSongs(artist = 'All') {
        if (!songList) return;
        
        songList.innerHTML = '<p>載入歌曲中...</p>';
        
        try {
            const decodedArtist = decodeURIComponent(artist);
            const url = decodedArtist === 'All' ? '/api/scores/songs' : `/api/scores/songs?artist=${artist}`;
            allSongsData = await fetchApi(url, `Error fetching songs for artist ${decodedArtist}`);
            
            renderSongList(allSongsData);
        } catch (error) {
            console.error('獲取樂譜歌曲列表失敗:', error);
            songList.innerHTML = '<p style="color: red;">無法載入歌曲列表。</p>';
            
            // 顯示模擬樂譜數據
            displayMockSongs(artist);
        }
    }
    
    /**
     * 在API不可用時顯示模擬樂譜數據
     */
    function displayMockSongs(artist = 'All') {
        // 模擬樂譜數據
        const mockSongs = [
            {
                id: "song1",
                title: "陽光美味之歌",
                artist: "SunnyYummy樂團",
                scores: [
                    { id: "score1", type: "鋼琴譜" },
                    { id: "score2", type: "吉他譜" }
                ]
            },
            {
                id: "song2",
                title: "快樂星球",
                artist: "Paula",
                scores: [
                    { id: "score3", type: "鋼琴譜" },
                    { id: "score4", type: "烏克麗麗譜" }
                ]
            },
            {
                id: "song3",
                title: "童話世界",
                artist: "亞米媽媽",
                scores: [
                    { id: "score5", type: "鋼琴譜" }
                ]
            },
            {
                id: "song4",
                title: "彩虹之歌",
                artist: "林莉C亞米",
                scores: [
                    { id: "score6", type: "鋼琴譜" },
                    { id: "score7", type: "吉他譜" },
                    { id: "score8", type: "簡譜" }
                ]
            }
        ];
        
        // 依據歌手過濾
        let filteredSongs = mockSongs;
        if (artist !== 'All') {
            const decodedArtist = decodeURIComponent(artist);
            filteredSongs = mockSongs.filter(song => song.artist === decodedArtist);
        }
        
        // 設置數據並渲染
        allSongsData = filteredSongs;
        renderSongList(allSongsData);
        
        // 添加示範數據提示
        const infoMsg = document.createElement('p');
        infoMsg.className = 'info-text';
        infoMsg.textContent = '使用示範數據顯示（API連接失敗）';
        infoMsg.style.textAlign = 'center';
        infoMsg.style.color = '#666';
        infoMsg.style.marginBottom = '15px';
        songList.parentNode.insertBefore(infoMsg, songList);
    }
    
    /**
     * 渲染樂譜歌曲列表
     */
    function renderSongList(songs) {
        if (!songList) return;
        
        if (!songs || !Array.isArray(songs) || songs.length === 0) {
            songList.innerHTML = '<p>此分類下沒有包含樂譜的歌曲。</p>';
            return;
        }
        
        let html = '';
        songs.forEach(song => {
            // 確保有樂譜數據
            if (song.scores && Array.isArray(song.scores) && song.scores.length > 0) {
                let scoreButtonsHTML = '';
                
                // 創建各種樂譜按鈕
                song.scores.forEach(score => {
                    if (score.type && score.id) {
                        scoreButtonsHTML += `
                            <button class="list-score-btn"
                                data-song-id="${song.id}"
                                data-score-id="${score.id}" 
                                title="查看 ${song.title} - ${score.type}">
                                ${score.type}
                            </button>
                        `;
                    }
                });
                
                // 只有有樂譜的歌曲才顯示
                if (scoreButtonsHTML) {
                    html += `
                        <li data-song-id="${song.id}">
                            <div class="song-list-info">
                                <span class="song-title">${song.title || '未知標題'}</span>
                                <span class="song-artist">${song.artist || '未知歌手'}</span>
                                <div class="song-list-scores">
                                    ${scoreButtonsHTML}
                                </div>
                            </div>
                        </li>
                    `;
                }
            }
        });
        
        if (html === '') {
            songList.innerHTML = '<p>找不到包含樂譜的歌曲。</p>';
        } else {
            songList.innerHTML = html;
            
            // 為樂譜按鈕添加事件監聽
            document.querySelectorAll('.list-score-btn').forEach(button => {
                button.addEventListener('click', handleScoreButtonClick);
            });
            
            // 應用動畫效果
            animateSongsIn();
        }
    }
    
    /**
     * 處理樂譜按鈕點擊事件
     */
    function handleScoreButtonClick(event) {
        const songId = event.target.dataset.songId;
        const scoreId = event.target.dataset.scoreId;
        
        if (songId && scoreId) {
            // 跳轉到樂譜查看頁面
            window.location.href = `/score-viewer.html?musicId=${songId}&scoreId=${scoreId}`;
        } else {
            console.warn('無法處理樂譜按鈕點擊：缺少 songId 或 scoreId。');
        }
    }

    /**
     * 檢測設備類型並適配
     */
    function detectDevice() {
        const isMobile = window.innerWidth <= 767;
        document.body.classList.toggle('is-mobile', isMobile);
    }
    
    // 初始化檢測設備類型
    detectDevice();
    
    // 窗口尺寸改變時重新檢測
    window.addEventListener('resize', detectDevice);
    
    // 初始加載音樂專輯歌手列表
    fetchAndDisplayArtists();
});