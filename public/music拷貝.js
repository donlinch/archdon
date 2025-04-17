// music.js - 整合樂譜功能
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM元素獲取 ---
    const musicListContainer = document.getElementById('music-list');
    const scoresListContainer = document.getElementById('scores-list');
    const songList = document.getElementById('song-list');
    const artistDrawerContent = document.getElementById('artist-drawer-content');
    const artistDrawerBtn = document.getElementById('artist-drawer-btn');
    const artistDrawer = document.getElementById('artist-drawer');
    const artistDrawerClose = document.getElementById('artist-drawer-close');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const sortLinks = document.querySelectorAll('.sort-link');
    const backToTopButton = document.getElementById('back-to-top');
    
    // --- 當前狀態 ---
    let currentArtistFilter = null;
    let currentSortBy = 'music'; // 預設為音樂專輯
    let allSongsData = []; // 儲存樂譜的歌曲數據
    
    // --- 檢查是否為移動設備 ---
    const isMobileDevice = () => window.innerWidth <= 767;
    
    // --- 初始化各功能 ---
    initSwiper();
    setupSortLinks();
    setupDrawer();
    setupBackToTop();
    setupCharacterInteractions();
    
    // 初始加載音樂專輯
    fetchAndDisplayAlbums();
    // 預加載樂譜歌手列表（但不顯示）
    fetchArtists();
    
    /**
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
        artistDrawerBtn.addEventListener('click', () => {
            openDrawer();
        });
        
        // 點擊關閉按鈕關閉抽屜
        artistDrawerClose.addEventListener('click', () => {
            closeDrawer();
        });
        
        // 點擊遮罩關閉抽屜
        drawerOverlay.addEventListener('click', () => {
            closeDrawer();
        });
        
        // ESC 鍵關閉抽屜
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && artistDrawer.classList.contains('open')) {
                closeDrawer();
            }
        });
    }
    
    // 打開抽屜函數
    function openDrawer() {
        artistDrawer.classList.add('open');
        drawerOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden'; // 防止背景滾動
    }
    
    // 關閉抽屜函數
    function closeDrawer() {
        artistDrawer.classList.remove('open');
        drawerOverlay.classList.remove('visible');
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
                        
                        // 在這裡實現對不同類型內容的處理
                        if (sortBy === 'scores') {
                            updateArtistButtonForScores(); // 更新歌手按鈕文字和功能為樂譜歌手
                            showScoresList(); // 顯示樂譜列表
                        } else {
                            updateArtistButtonForMusic(); // 更新歌手按鈕文字和功能為音樂專輯的歌手
                            showMusicAlbums(); // 顯示音樂專輯
                        }
                    }
                });
            });
        }
    }
    
    /**
     * 更新歌手按鈕為音樂專輯模式
     */
    function updateArtistButtonForMusic() {
        artistDrawerBtn.textContent = '歌手列表';
        
        // 重新載入音樂專輯歌手列表
        fetchAndDisplayArtists();
    }
    
    /**
     * 更新歌手按鈕為樂譜模式
     */
    function updateArtistButtonForScores() {
        artistDrawerBtn.textContent = '歌手篩選';
        
        // 載入有樂譜的歌手列表
        loadScoresArtistDrawer();
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
        
        // 如果還沒加載過樂譜，則加載
        if (songList.innerHTML === '' || songList.innerHTML === '<p>載入樂譜中...</p>') {
            fetchSongs(currentArtistFilter || 'All');
        }
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
     */
    async function fetchAndDisplayArtists() {
        if (!artistDrawerContent) {
            console.error("Artist drawer content element not found");
            return;
        }

        // 清除之前內容並顯示加載中
        artistDrawerContent.innerHTML = '<button class="artist-drawer-btn active">全部歌手</button><button class="artist-drawer-btn">載入中...</button>';
        
        try {
            const response = await fetch('/api/artists');
            if (!response.ok) {
                throw new Error(`獲取歌手列表失敗 (HTTP ${response.status})`);
            }

            const artists = await response.json();
            
            // 清除現有按鈕但保留「全部歌手」
            artistDrawerContent.innerHTML = '';

            // 全部歌手按鈕
            const allButton = document.createElement('button');
            allButton.textContent = '全部歌手';
            allButton.classList.add('artist-drawer-btn', 'active');
            allButton.addEventListener('click', () => {
                setActiveArtistButton(allButton);
                currentArtistFilter = null;
                fetchAndDisplayAlbums(currentArtistFilter);
                closeDrawer(); // 點擊後關閉抽屜
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
                    closeDrawer(); // 點擊後關閉抽屜
                });
                artistDrawerContent.appendChild(button);
            });

        } catch (error) {
            console.error("[Music] Fetch artists error:", error);
            // API 失敗時顯示靜態按鈕
            artistDrawerContent.innerHTML = '';
            
            // 添加靜態歌手列表按鈕並設置點擊事件
            const staticArtists = [
                '全部歌手', 'Paula', 'SunnyYummy樂團', '亞米媽媽', 
                '亞米爸爸', '恬恬', '林莉C亞米', '皓皓justin', 
                '盒盒', '雪球軟糖'
            ];
            
            staticArtists.forEach((artist, index) => {
                const button = document.createElement('button');
                button.textContent = artist;
                button.classList.add('artist-drawer-btn');
                if (index === 0) {
                    button.classList.add('active');
                }
                
                button.addEventListener('click', () => {
                    // 移除所有按鈕的active類
                    artistDrawerContent.querySelectorAll('.artist-drawer-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    
                    // 添加active類到當前按鈕
                    button.classList.add('active');
                    
                    // 設置過濾條件
                    currentArtistFilter = index === 0 ? null : artist;
                    
                    // 更新專輯列表
                    fetchAndDisplayAlbums(currentArtistFilter);
                    
                    // 關閉抽屜
                    closeDrawer();
                });
                
                artistDrawerContent.appendChild(button);
            });
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
            
            // 專輯資訊
            const infoDiv = document.createElement('div');
            infoDiv.className = 'album-info';
            
            const title = document.createElement('h3');
            title.textContent = music.title || '未知專輯';
            
            const artistElem = document.createElement('p');
            artistElem.className = 'artist';
            artistElem.textContent = music.artist || '未知歌手';
            
            const date = document.createElement('p');
            date.className = 'release-date';
            date.textContent = music.release_date 
                ? new Date(music.release_date).toLocaleDateString('zh-TW') 
                : '發行日期未知';
            
            infoDiv.appendChild(title);
            infoDiv.appendChild(artistElem);
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
     * 獲取並顯示有樂譜的歌手列表
     */
    async function fetchArtists() {
        try {
            const response = await fetch('/api/scores/artists');
            if (!response.ok) {
                throw new Error('Error fetching artists');
            }
            const artists = await response.json();
            // 暫時先不顯示，等待切換到樂譜頁面時使用
            return artists;
        } catch (error) {
            console.error('獲取樂譜歌手列表失敗:', error);
            return [];
        }
    }

    /**
     * 載入樂譜歌手抽屜內容
     */
    async function loadScoresArtistDrawer() {
        if (!artistDrawerContent) return;
        
        artistDrawerContent.innerHTML = '<button class="artist-drawer-btn active">全部歌手</button><button class="artist-drawer-btn">載入中...</button>';
        
        try {
            const artists = await fetchArtists();
            
            // 清空現有內容
            artistDrawerContent.innerHTML = '';
            
            // 添加「全部歌手」按鈕
            const allButton = document.createElement('button');
            allButton.textContent = '全部歌手';
            allButton.classList.add('artist-drawer-btn', 'active');
            allButton.addEventListener('click', () => {
                // 選擇全部歌手
                setActiveArtistButton(allButton);
                currentArtistFilter = 'All';
                fetchSongs('All');
                closeDrawer();
            });
            artistDrawerContent.appendChild(allButton);
            
            // 添加各歌手按鈕
            artists.forEach(artist => {
                const button = document.createElement('button');
                button.textContent = artist;
                button.classList.add('artist-drawer-btn');
                button.addEventListener('click', () => {
                    setActiveArtistButton(button);
                    currentArtistFilter = artist;
                    fetchSongs(encodeURIComponent(artist));
                    closeDrawer();
                });
                artistDrawerContent.appendChild(button);
            });
            
        } catch (error) {
            console.error('載入樂譜歌手抽屜內容失敗:', error);
            
            // 失敗時顯示默認內容
            artistDrawerContent.innerHTML = '';
            const defaultButton = document.createElement('button');
            defaultButton.textContent = '全部歌手';
            defaultButton.classList.add('artist-drawer-btn', 'active');
            artistDrawerContent.appendChild(defaultButton);
            
            const errorMsg = document.createElement('p');
            errorMsg.textContent = '無法載入歌手列表';
            errorMsg.style.color = 'red';
            errorMsg.style.padding = '10px';
            artistDrawerContent.appendChild(errorMsg);
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
            allSongsData = await fetch(url).then(response => {
                if (!response.ok) {
                    throw new Error(`Error fetching songs for artist ${decodedArtist}`);
                }
                return response.json();
            });
            
            renderSongList(allSongsData);
        } catch (error) {
            console.error('獲取樂譜歌曲列表失敗:', error);
            songList.innerHTML = '<p style="color: red;">無法載入歌曲列表。</p>';
            allSongsData = []; // 出錯時清空
        }
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
});