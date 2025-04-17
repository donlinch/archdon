// music.js
document.addEventListener('DOMContentLoaded', () => {
    // 獲取DOM元素
    const musicListContainer = document.getElementById('music-list');
    const artistDrawerContent = document.getElementById('artist-drawer-content');
    const artistDrawerBtn = document.getElementById('artist-drawer-btn');
    const artistDrawer = document.getElementById('artist-drawer');
    const artistDrawerClose = document.getElementById('artist-drawer-close');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const sortLinks = document.querySelectorAll('.sort-link');
    const backToTopButton = document.getElementById('back-to-top');
    
    // 當前狀態
    let currentArtistFilter = null;
    let currentSortBy = 'music'; // 預設為音樂專輯
    
    // 檢查是否為移動設備
    const isMobileDevice = () => window.innerWidth <= 767;
    
    // 初始化各功能
    initSwiper();
    fetchAndDisplayArtists();
    fetchAndDisplayAlbums();
    setupSortLinks();
    setupDrawer();
    setupBackToTop();
    setupCharacterInteractions();
    
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
        
        // ESC 鍵關閉抽屜
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && artistDrawer.classList.contains('open')) {
                closeDrawer();
            }
        });
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
                            loadScores(); // 載入樂譜
                        } else {
                            fetchAndDisplayAlbums(currentArtistFilter); // 載入音樂專輯
                        }
                    }
                });
            });
        }
    }
    
    /**
     * 載入樂譜內容（示例函數）
     */
    async function loadScores() {
        if (!musicListContainer) return;
        
        musicListContainer.innerHTML = '<p class="loading-text">正在加載樂譜資料...</p>';
        
        try {
            // 這裡可以替換為實際的樂譜 API 調用
            const response = await fetch('/api/scores');
            if (!response.ok) {
                throw new Error(`獲取樂譜失敗 (HTTP ${response.status})`);
            }
            
            const scores = await response.json();
            
            if (!scores || scores.length === 0) {
                musicListContainer.innerHTML = '<p class="no-products">目前沒有樂譜可顯示。</p>';
                return;
            }
            
            // 創建樂譜格線容器
            const scoresGrid = document.createElement('div');
            scoresGrid.className = 'album-grid'; // 使用相同的格線佈局
            
            // 填充樂譜卡片
            scores.forEach(score => {
                const scoreCard = document.createElement('a');
                scoreCard.className = 'album-card';
                scoreCard.href = score.download_url || '#';
                
                if (score.download_url) {
                    scoreCard.target = '_blank';
                    scoreCard.rel = 'noopener noreferrer';
                }
                
                // 樂譜封面
                const coverDiv = document.createElement('div');
                coverDiv.className = 'cover-image';
                const coverImg = document.createElement('img');
                coverImg.src = score.image_url || '/images/score-placeholder.png';
                coverImg.alt = score.title || '樂譜封面';
                coverDiv.appendChild(coverImg);
                
                // 樂譜資訊
                const infoDiv = document.createElement('div');
                infoDiv.className = 'album-info';
                
                const title = document.createElement('h3');
                title.textContent = score.title || '未知樂譜';
                
                const composer = document.createElement('p');
                composer.className = 'artist';
                composer.textContent = score.composer || '未知作曲家';
                
                const description = document.createElement('p');
                description.className = 'release-date';
                description.textContent = score.description || '點擊下載樂譜';
                
                infoDiv.appendChild(title);
                infoDiv.appendChild(composer);
                infoDiv.appendChild(description);
                
                scoreCard.appendChild(coverDiv);
                scoreCard.appendChild(infoDiv);
                scoresGrid.appendChild(scoreCard);
            });
            
            musicListContainer.innerHTML = '';
            musicListContainer.appendChild(scoresGrid);
            
            // 使用漸入效果顯示樂譜
            animateAlbumsIn();
            
        } catch (error) {
            console.error('載入樂譜失敗:', error);
            musicListContainer.innerHTML = '<p class="error-text">無法加載樂譜，請稍後再試。</p>';
            
            // 如果 API 尚未實現，顯示提示信息
            musicListContainer.innerHTML = '<p class="info-text">樂譜功能即將推出，敬請期待！</p>';
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
    
    /**
     * 獲取並顯示歌手列表
     */
    async function fetchAndDisplayArtists() {
        if (!artistDrawerContent) {
            console.error("Artist drawer content element not found");
            return;
        }

        // 清除之前內容並顯示加載中
        // 保留原始的靜態按鈕
        const existingButtons = Array.from(artistDrawerContent.querySelectorAll('.artist-drawer-btn'));
        
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
     * 關閉抽屜函數
     */
    function closeDrawer() {
        artistDrawer.classList.remove('open');
        drawerOverlay.classList.remove('visible');
        document.body.style.overflow = ''; // 恢復滾動
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