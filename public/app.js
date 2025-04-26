// app.js
document.addEventListener('DOMContentLoaded', () => {
    // 獲取DOM元素
    const grid = document.getElementById('product-grid');
    const sortLinks = document.querySelectorAll('.sort-link');
    const backToTopButton = document.getElementById('back-to-top');
    const categoryFilterContainer = document.getElementById('category-filter-buttons');
    
    // 修改: 初始狀態
    let currentSort = 'latest'; 
    let currentCategory = null; // 使用 null 代表未選擇/全部
    
    // 初始化各功能
    initSwiper();
    fetchCategoriesAndProducts();
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
    async function fetchCategoriesAndProducts() {
        await fetchAndDisplayCategories();
        fetchProducts(currentSort, currentCategory);
    }
    
    async function fetchAndDisplayCategories() {
        if (!categoryFilterContainer) return;
        
        categoryFilterContainer.innerHTML = '';
        
        try {
            const response = await fetch('/api/products/categories');
            if (!response.ok) throw new Error(`無法獲取分類 (HTTP ${response.status})`);
            const categories = await response.json();
            
            if (categories.length > 0) {
                categories.forEach((category, index) => {
                    const button = createCategoryButton(category, category);
                    categoryFilterContainer.appendChild(button);
                });
            } else {
                // 如果沒有分類，可以選擇隱藏容器或顯示提示
                 categoryFilterContainer.innerHTML = '<span style="font-size: 14px; color: #888;"></span>';
            }
            
        } catch (error) {
            console.error('獲取分類列表失敗:', error);
            categoryFilterContainer.innerHTML = '<span style="font-size: 14px; color: red;">無法載入分類</span>';
        }
    }
    
    function createCategoryButton(categoryValue, categoryText) {
        const button = document.createElement('button');
        button.classList.add('filter-btn', 'category-link');
        button.dataset.category = categoryValue;
        button.textContent = categoryText;
        button.addEventListener('click', handleCategoryClick);
        return button;
    }
    
    function handleCategoryClick(event) {
        const clickedButton = event.target;
        const selectedCategory = clickedButton.dataset.category;
        
        // 如果點擊的是當前已選中的分類，則取消選中，顯示全部
        if (clickedButton.classList.contains('active')) {
            currentCategory = null; // 設為 null 代表全部
            clickedButton.classList.remove('active');
        } else {
            // 否則，選中點擊的分類
            currentCategory = selectedCategory;
            // 更新按鈕 active 狀態
            document.querySelectorAll('.category-link').forEach(btn => btn.classList.remove('active'));
            clickedButton.classList.add('active');
        }
        
        // 根據新的分類和當前的排序重新獲取商品
        fetchProducts(currentSort, currentCategory);
    }
    
    /**
     * 從API獲取商品數據
     */
    async function fetchProducts(sortBy = 'latest', category = null) {
        if (!grid) {
            console.error("商品格線元素未找到！");
            return;
        }
        
        grid.innerHTML = '<p class="loading-text">正在加載商品...</p>';
        
        currentSort = sortBy;
        currentCategory = category;
        
        let apiUrl = '/api/products';
        const params = new URLSearchParams();
        if (sortBy === 'popular') {
            params.append('sort', 'popular');
        } else {
             params.append('sort', 'latest'); // 確保總是有 sort 參數或預設行為
        }
        if (category) { 
            params.append('category', category);
        }
        const queryString = params.toString();
        if (queryString) {
            apiUrl += `?${queryString}`;
        }
        
        console.log("Fetching products from:", apiUrl);
        
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
            grid.innerHTML = '<p class="no-products">目前沒有符合條件的商品。</p>';
            return;
        }

        productList.forEach(product => {
            const cardContainer = document.createElement('div');
            cardContainer.className = 'product-card animate__animated animate__fadeIn';

            if (product.seven_eleven_url) {
                cardContainer.style.cursor = 'pointer';
                cardContainer.addEventListener('click', (event) => {
                    if (event.target.closest('.favorite-btn')) return;
                    event.preventDefault();
                    if (product.id) {
                        fetch(`/api/products/${product.id}/click`, { method: 'POST' })
                            .catch(err => {
                                console.error(`記錄商品 ${product.id} 點擊時網路錯誤:`, err);
                            });
                    }
                    window.open(product.seven_eleven_url, '_blank');
                });
            }

            // Create tags HTML if product has tags
            let tagsHtml = '';
            if (product.tags && product.tags.length > 0) {
                tagsHtml = `
                <div class="tags-container">
                    ${product.tags.map(tag => {
                        // Handle different possible tag formats
                        const tagName = tag.tag_name || tag.name || tag;
                        return `<span class="product-tag">${tagName}</span>`;
                    }).join('')}
                </div>`;
            }

            cardContainer.innerHTML = ` 
            <div class="position-relative">
                <img src="${product.image_url || '/images/placeholder.png'}" class="card-img-top" alt="${product.name || '商品圖片'}">
                ${product.price !== null ? `<span class="price-badge">NT$ ${Math.floor(product.price)}</span>` : ''}
                ${tagsHtml}
                <!-- (可選) 在此顯示分類 -->
                ${product.category ? `<span class="category-badge">${product.category}</span>` : ''} 
            </div>
            <div class="card-body">
                <h5 class="card-title">${product.name || '未命名商品'}</h5>
                ${product.description ? `<p class="card-text">${product.description}</p>` : '<p class="card-text">&nbsp;</p>'}
            </div>
             <div class="add-hint">
                 <i class="bi bi-plus-circle"></i> 點擊加入購物車 
             </div> 
        `; // <--- 確保這個反引號存在且位置正確

            grid.appendChild(cardContainer);
        });

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
                    const clickedSort = link.dataset.sort;
                    if (clickedSort === currentSort) return; 
                    
                    sortLinks.forEach(otherLink => otherLink.classList.remove('active'));
                    link.classList.add('active');
                    
                    currentSort = clickedSort; 
                    
                    fetchProducts(currentSort, currentCategory); 
                });
            });
        }
    }
    
    /**
     * 設置回到頂部按鈕
     */
    async function setupBackToTop() {
        try {
          // 修正 API 路徑
        const response = await fetch('/api/ui-elements/type/back_to_top');
        if (!response.ok) {
            throw new Error(`獲取UI元素失敗: HTTP ${response.status}`);
        }
        
        const element = await response.json();
        
        if (!backToTopButton) {
            console.error("返回頂部按鈕元素未找到！");
            return;
        }
        
        // 如果設定為不顯示，則直接返回
        if (!element.is_visible) {
            backToTopButton.style.display = 'none';
            return;
        }
        
        // 更新圖片（如果有設定）
        const logoImg = backToTopButton.querySelector('img');
        if (logoImg && element.image_url) {
            logoImg.src = element.image_url;
            logoImg.alt = element.alt_text || 'Back to top';
        }
          // 安全解析 settings
          let settings = { scroll_trigger: 300, scroll_speed: 'smooth' };
          try {
              if (element.settings) {
                  if (typeof element.settings === 'string') {
                      settings = {...settings, ...JSON.parse(element.settings)};
                  } else if (typeof element.settings === 'object') {
                      settings = {...settings, ...element.settings};
                  }
              }
          } catch (e) {
              console.warn("解析 settings 時出錯:", e);
          }
          
          // 應用自定義CSS（如果有設定）
          if (element.custom_css) {
              try {
                  Object.assign(backToTopButton.style, JSON.parse(element.custom_css));
              } catch (e) {
                  console.warn("解析自定義CSS時出錯:", e);
              }
          }
          
          // 監聽滾動事件
          window.addEventListener('scroll', function() {
              const scrollTrigger = settings.scroll_trigger || 300;
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
                  behavior: settings.scroll_speed || 'smooth'
              });
          });
          
          // 確保按鈕可見
          backToTopButton.style.display = '';
          
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
                throw new Error(`獲取浮動角色設定失敗: HTTP ${response.status}`);
            }
            
            const charactersData = await response.json();
            
            // 獲取DOM中的角色元素
            const pinkCharacter = document.querySelector('.pink-character');
            const blueCharacter = document.querySelector('.blue-character');
            const yellowCharacter = document.querySelector('.yellow-character');
            
            // 清除舊的交互（如果有的話）
            [pinkCharacter, blueCharacter, yellowCharacter].forEach(el => {
                if (el) {
                    const oldBubble = el.querySelector('.character-speech');
                    if (oldBubble) el.removeChild(oldBubble);
                    // 移除舊的監聽器是比較複雜的，這裡假設重新設置即可
                    // 如果遇到問題，可能需要更複雜的事件處理管理
                }
            });
            
            // 設定角色顯示/隱藏
            charactersData.forEach(character => {
                let characterElement;
                
                switch(character.character_type) {
                    case 'pink': characterElement = pinkCharacter; break;
                    case 'blue': characterElement = blueCharacter; break;
                    case 'yellow': characterElement = yellowCharacter; break;
                }
                
                if (characterElement) {
                    characterElement.style.display = character.is_visible ? 'block' : 'none';
                    if (character.image_url) {
                        characterElement.style.backgroundImage = `url('${character.image_url}')`;
                    }
                    if (character.position_top) characterElement.style.top = character.position_top;
                    if (character.position_left) characterElement.style.left = character.position_left;
                    if (character.position_right) characterElement.style.right = character.position_right;
                    
                    characterElement.classList.remove('float1', 'float2', 'float3');
                    if (character.animation_type) {
                        characterElement.classList.add(character.animation_type);
                    }
                    
                    if (character.is_visible) {
                        const speechBubble = document.createElement('div');
                        speechBubble.className = 'character-speech';
                        characterElement.appendChild(speechBubble);
                        
                        let speeches = ['嗨！'];
                        try {
                            if (character.speech_phrases) {
                                speeches = JSON.parse(character.speech_phrases);
                                if (!Array.isArray(speeches) || speeches.length === 0) speeches = ['嗨！'];
                            }
                        } catch (e) { console.warn(`解析角色對話內容時出錯:`, e); }
                        
                        const handleInteraction = (e) => { // 使用箭頭函數以便移除
                            e.stopPropagation();
                            if (e.type === 'click') e.preventDefault();
                            if (characterElement.classList.contains('touched') || characterElement.classList.contains('bounce-back')) return;
                            
                            characterElement.classList.add('touched');
                            const randomSpeech = speeches[Math.floor(Math.random() * speeches.length)];
                            speechBubble.textContent = randomSpeech;
                            speechBubble.classList.add('visible');
                            
                            setTimeout(() => {
                                characterElement.classList.remove('touched');
                                characterElement.classList.add('bounce-back');
                                setTimeout(() => { speechBubble.classList.remove('visible'); }, 1500);
                                setTimeout(() => { characterElement.classList.remove('bounce-back'); }, 800);
                            }, 1000);
                        };
                        
                        // 移除舊監聽器（雖然可能效果有限）並添加新監聽器
                        characterElement.removeEventListener('touchstart', handleInteraction);
                        characterElement.removeEventListener('click', handleInteraction);
                        characterElement.addEventListener('touchstart', handleInteraction, { passive: true });
                        characterElement.addEventListener('click', handleInteraction);
                    }
                }
            });
            
        } catch (err) {
            console.error('獲取或設置浮動角色設定時出錯:', err);
            setupDefaultCharacterInteractions(); // 出錯時使用預設
        }
    }
    
    /**
     * 預設角色互動設定
     */
    function setupDefaultCharacterInteractions() {
        const characters = document.querySelectorAll('.floating-character');
        const speeches = {
            'pink-character': ['哈囉！', '點我有獎勵哦！', '好可愛～'],
            'blue-character': ['嗨！你好！', '今天過得如何？', '有什麼新商品？'],
            'yellow-character': ['耶！找到我了！', '我們一起玩吧！', '超級開心！']
        };
        
        characters.forEach(character => {
            // 確保每個角色只有一個 speechBubble
            let speechBubble = character.querySelector('.character-speech');
            if (!speechBubble) {
                 speechBubble = document.createElement('div');
                 speechBubble.className = 'character-speech';
                 character.appendChild(speechBubble);
            }

            const characterType = Array.from(character.classList).find(cls => cls.includes('-character') && cls !== 'floating-character');
            
            const handleInteraction = (e) => {
                e.stopPropagation();
                if (e.type === 'click') e.preventDefault();
                if (character.classList.contains('touched') || character.classList.contains('bounce-back')) return;
                
                character.classList.add('touched');
                const possibleSpeeches = speeches[characterType] || ['嗨！'];
                const randomSpeech = possibleSpeeches[Math.floor(Math.random() * possibleSpeeches.length)];
                speechBubble.textContent = randomSpeech;
                speechBubble.classList.add('visible');
                
                setTimeout(() => {
                    character.classList.remove('touched');
                    character.classList.add('bounce-back');
                    setTimeout(() => { speechBubble.classList.remove('visible'); }, 1500);
                    setTimeout(() => { character.classList.remove('bounce-back'); }, 800);
                }, 1000);
            };
            
            // 移除可能存在的舊監聽器並添加
            character.removeEventListener('touchstart', handleInteraction);
            character.removeEventListener('click', handleInteraction);
            character.addEventListener('touchstart', handleInteraction, { passive: true });
            character.addEventListener('click', handleInteraction);
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

}); // --- End of DOMContentLoaded ---