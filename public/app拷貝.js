// app.js
document.addEventListener('DOMContentLoaded', () => {
    // 獲取DOM元素
    const grid = document.getElementById('product-grid');
    const sortLinks = document.querySelectorAll('.sort-link');
    const backToTopButton = document.getElementById('back-to-top');
    
    // 初始化各功能
    initSwiper();
    fetchProducts('latest');
    setupSortLinks();
    setupBackToTop();
    setupCharacterInteractions();
    
    /**
     * 初始化Swiper輪播
     */
    function initSwiper() {
        // 獲取banner數據
        fetch('/api/banners?page=home')
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
                new Swiper('#banner-carousel', {
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
                new Swiper('#banner-carousel', {
                    loop: false,
                    pagination: {
                        el: '.swiper-pagination',
                        clickable: true,
                    },
                });
            });
    }
    
    /**
     * 從API獲取商品數據
     */
    async function fetchProducts(sortBy = 'latest') {
        if (!grid) {
            console.error("商品格線元素未找到！");
            return;
        }
        
        grid.innerHTML = '<p class="loading-text">正在加載商品...</p>';
        
        let apiUrl = `/api/products${sortBy === 'popular' ? '?sort=popular' : ''}`;
        
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            }
            const products = await response.json();
            displayProducts(products);
        } catch (error) {
            console.error("獲取商品失敗:", error);
            grid.innerHTML = '<p class="error-text">無法加載商品，請稍後再試。</p>';
        }
    }
    
    /**
     * 展示商品
     */
    function displayProducts(productList) {
        if (!grid) return;
        grid.innerHTML = '';
        
        if (!productList || productList.length === 0) {
            grid.innerHTML = '<p class="no-products">目前沒有商品可顯示。</p>';
            return;
        }
        
        productList.forEach(product => {
            const cardLink = document.createElement('a');
            cardLink.className = 'product-card';
            cardLink.href = product.seven_eleven_url || '#';
            if (product.seven_eleven_url) {
                cardLink.target = '_blank';
                cardLink.rel = 'noopener noreferrer';
            }
            
            // 添加點擊事件
            cardLink.addEventListener('click', (event) => {
                if (product.seven_eleven_url && product.id) {
                    event.preventDefault();
                    
                    // 發送點擊記錄請求
                    fetch(`/api/products/${product.id}/click`, { method: 'POST' })
                        .catch(err => {
                            console.error(`記錄商品 ${product.id} 點擊時網路錯誤:`, err);
                        });
                    
                    // 在新視窗打開商品連結
                    window.open(product.seven_eleven_url, '_blank');
                }
            });
            
            // 創建商品卡片內容
            cardLink.innerHTML = `
                <div class="image-container">
                    <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || '商品圖片'}">
                </div>
                <div class="card-content">
                    <h3>${product.name || '未命名商品'}</h3>
                    <p class="price">${product.price !== null ? `NT$ ${Math.floor(product.price)}` : '價格洽詢'}</p>
                </div>
            `;
            
            grid.appendChild(cardLink);
        });
        
        // 使用漸入效果顯示商品
        animateProductsIn();
    }
     /**
     * 商品卡片漸入動畫
     */
    function animateProductsIn() {
        const cards = document.querySelectorAll('.product-card');
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
                        fetchProducts(sortBy);
                    } else {
                        console.warn("排序連結缺少 data-sort 屬性:", link);
                        fetchProducts();
                    }
                });
            });
        }
    }
    
    /**
     * 設置回到頂部按鈕
     */
    async function setupBackToTop() {
        try {
            // 從API獲取設定
            const response = await fetch('/api/ui-elements?type=back_to_top');
            if (!response.ok) {
                throw new Error(`獲取UI元素失敗: HTTP ${response.status}`);
            }
            
            const settings = await response.json();
            
            if (!backToTopButton) {
                console.error("返回頂部按鈕元素未找到！");
                return;
            }
            
            // 如果設定為不顯示，則直接返回
            if (!settings.is_visible) {
                backToTopButton.style.display = 'none';
                return;
            }
            
            // 更新圖片（如果有設定）
            const logoImg = backToTopButton.querySelector('img');
            if (logoImg && settings.image_url) {
                logoImg.src = settings.image_url;
                logoImg.alt = settings.alt_text || 'Back to top';
            }
            
            // 應用自定義CSS（如果有設定）
            if (settings.custom_css) {
                try {
                    Object.assign(backToTopButton.style, JSON.parse(settings.custom_css));
                } catch (e) {
                    console.warn("解析自定義CSS時出錯:", e);
                }
            }
            
            // 監聽滾動事件
            window.addEventListener('scroll', function() {
                const scrollTrigger = settings.settings?.scroll_trigger || 300;
                if (window.scrollY > scrollTrigger) {
                    backToTopButton.classList.add('visible');
                } else {
                    backToTopButton.classList.remove('visible');
                }
            });
            
            // 點擊回到頂部
            backToTopButton.addEventListener('click', function() {
                // 使用設定中的滾動速度
                window.scrollTo({
                    top: 0,
                    behavior: settings.settings?.scroll_speed || 'smooth'
                });
            });
        } catch (err) {
            console.error('獲取返回頂部按鈕設定時出錯:', err);
            // 使用默認行為作為備份
            setupDefaultBackToTop();
        }
    }

    // 默認行為作為備份
    function setupDefaultBackToTop() {
        if (backToTopButton) {
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
                // 平滑滾動回頂部
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
        }
    }
    
    /**
     * 設置角色互動效果
     */
    async function setupCharacterInteractions() {
        try {
            // 從API獲取角色設定
            const response = await fetch('/api/floating-characters');
            if (!response.ok) {
                throw new Error(`獲取浮動角色失敗: HTTP ${response.status}`);
            }
            
            const charactersData = await response.json();
            
            // 獲取DOM中的角色元素
            const pinkCharacter = document.querySelector('.pink-character');
            const blueCharacter = document.querySelector('.blue-character');
            const yellowCharacter = document.querySelector('.yellow-character');
            
            // 設定角色顯示/隱藏
            charactersData.forEach(character => {
                let characterElement;
                
                switch(character.character_type) {
                    case 'pink':
                        characterElement = pinkCharacter;
                        break;
                    case 'blue':
                        characterElement = blueCharacter;
                        break;
                    case 'yellow':
                        characterElement = yellowCharacter;
                        break;
                }
                
                if (characterElement) {
                    // 設置顯示/隱藏
                    characterElement.style.display = character.is_visible ? 'block' : 'none';
                    
                    // 更新圖片
                    if (character.image_url) {
                        characterElement.style.backgroundImage = `url('${character.image_url}')`;
                    }
                    
                    // 設置位置
                    if (character.position_top) characterElement.style.top = character.position_top;
                    if (character.position_left) characterElement.style.left = character.position_left;
                    if (character.position_right) characterElement.style.right = character.position_right;
                    
                    // 設置動畫
                    if (character.animation_type) {
                        // 移除所有動畫類
                        characterElement.classList.remove('float1', 'float2', 'float3');
                        // 添加新動畫類
                        characterElement.classList.add(character.animation_type);
                    }
                    
                    // 如果角色可見，設置交互功能
                    if (character.is_visible) {
                        // 創建對話氣泡
                        const speechBubble = document.createElement('div');
                        speechBubble.className = 'character-speech';
                        characterElement.appendChild(speechBubble);
                        
                        // 設置對話內容
                        let speeches = ['嗨！']; // 默認對話
                        try {
                            if (character.speech_phrases) {
                                speeches = JSON.parse(character.speech_phrases);
                                if (!Array.isArray(speeches)) speeches = ['嗨！'];
                            }
                        } catch (e) {
                            console.warn(`解析角色對話內容時出錯:`, e);
                        }
                        
                        // 觸摸/點擊事件處理
                        characterElement.addEventListener('touchstart', handleInteraction, { passive: true });
                        characterElement.addEventListener('click', handleInteraction);
                        
                        function handleInteraction(e) {
                            // 防止事件冒泡和默認行為
                            e.stopPropagation();
                            if (e.type === 'click') e.preventDefault();
                            
                            // 已經被觸摸，忽略
                            if (characterElement.classList.contains('touched') || 
                                characterElement.classList.contains('bounce-back')) return;
                            
                            // 添加觸摸效果
                            characterElement.classList.add('touched');
                            
                            // 隨機選擇一句對話
                            const randomSpeech = speeches[Math.floor(Math.random() * speeches.length)];
                            
                            // 顯示對話氣泡
                            speechBubble.textContent = randomSpeech;
                            speechBubble.classList.add('visible');
                            
                            // 1秒後移除觸摸效果，添加彈回動畫
                            setTimeout(() => {
                                characterElement.classList.remove('touched');
                                characterElement.classList.add('bounce-back');
                                
                                // 1.5秒後隱藏對話氣泡
                                setTimeout(() => {
                                    speechBubble.classList.remove('visible');
                                }, 1500);
                                
                                // 動畫結束後移除彈回類
                                setTimeout(() => {
                                    characterElement.classList.remove('bounce-back');
                                }, 800);
                            }, 1000);
                        }
                    }
                }
            });
            
        } catch (err) {
            console.error('獲取浮動角色設定時出錯:', err);
            // 使用預設設定作為備份
            setupDefaultCharacterInteractions();
        }
    }
    
    /**
     * 預設角色互動設定
     */
    function setupDefaultCharacterInteractions() {
        const characters = document.querySelectorAll('.floating-character');
        
        // 定義每個角色的對話內容
        const speeches = {
            'pink-character': ['哈囉！', '點我有獎勵哦！', '好可愛～'],
            'blue-character': ['嗨！你好！', '今天過得如何？', '有什麼新商品？'],
            'yellow-character': ['耶！找到我了！', '我們一起玩吧！', '超級開心！']
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