// public/app.js
document.addEventListener('DOMContentLoaded', () => {
    // 獲取商品格線和排序連結的 DOM 元素
    const grid = document.getElementById('product-grid');
    const sortLinks = document.querySelectorAll('.sort-link'); // 獲取所有排序連結

    /**
     * 從後端 API 獲取商品資料並觸發顯示
     * @param {string} sortBy - 排序方式 ('latest' 或 'popular')
     */
    async function fetchProducts(sortBy = 'latest') { // 函數接受排序參數，預設為 'latest'
        if (!grid) {
            console.error("商品格線元素未找到！");
            return;
        } 
        grid.innerHTML = '<p>正在加載商品...</p>'; // 顯示加載訊息

        let apiUrl = '/api/products'; // 基本 API URL
        if (sortBy === 'popular') {
            apiUrl = '/api/products?sort=popular'; // 如果按熱門排序，添加查詢參數
        }
        // 未來可以擴展其他排序方式: else if (sortBy === 'manual') { apiUrl = '/api/products?sort=manual'; }

        try {
            const response = await fetch(apiUrl); // 根據排序方式請求 API
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            }
            const products = await response.json();
            displayProducts(products); // 將獲取的商品數據傳給 displayProducts 函數
        } catch (error) {
            console.error("獲取商品失敗:", error);
            grid.innerHTML = '<p>無法加載商品，請稍後再試。</p>'; // 顯示錯誤訊息
        }
    }

    /**
     * 將商品列表渲染到頁面上，並為每個商品卡片添加點擊記錄邏輯
     * @param {Array} productList - 商品物件陣列
     */
    function displayProducts(productList) {
        if (!grid) { return; } // 再次檢查 grid 是否存在
        grid.innerHTML = ''; // 清空加載訊息或舊內容

        if (!productList || productList.length === 0) {
            grid.innerHTML = '<p>目前沒有商品可顯示。</p>';
            return;
        }

        productList.forEach(product => {
            // 創建商品卡片的連結元素 (<a>)
            const cardLink = document.createElement('a');
            cardLink.className = 'product-card';
            cardLink.href = product.seven_eleven_url || '#'; // 設定連結，若無則指向 '#'
            if (product.seven_eleven_url) {
                cardLink.target = '_blank'; // 在新分頁打開
                cardLink.rel = 'noopener noreferrer';
            }

            // --- 為商品卡片連結添加點擊事件監聽器 ---
            cardLink.addEventListener('click', (event) => {
                // 只處理有實際外部連結的商品點擊
                if (product.seven_eleven_url && product.id) {
                    event.preventDefault(); // 阻止 <a> 標籤的默認跳轉行為

                    // 異步發送請求記錄點擊 (不需要等待完成)
                    fetch(`/api/products/${product.id}/click`, { method: 'POST' })
                        .then(response => { // 可以選擇性地處理回應
                            if (!response.ok) {
                                console.warn(`記錄商品 ${product.id} 點擊可能失敗 (HTTP ${response.status})`);
                            }
                        })
                        .catch(err => { // 捕捉網路錯誤
                            console.error(`記錄商品 ${product.id} 點擊時網路錯誤:`, err);
                        });

                    // 手動在新分頁打開商品連結
                    window.open(product.seven_eleven_url, '_blank');
                }
                // 如果沒有 seven_eleven_url，則不阻止默認行為 (跳轉到 '#')
            });

            // --- 創建卡片內部元素 ---
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';
            const img = document.createElement('img');
            img.src = product.image_url || '/images/placeholder.png'; // 使用預設圖片(如果需要)
            img.alt = product.name || '商品圖片';
            imageContainer.appendChild(img);

            const contentDiv = document.createElement('div');
            contentDiv.className = 'card-content';
            const name = document.createElement('h3');
            name.textContent = product.name || '未命名商品';
            const description = document.createElement('p');
            description.textContent = product.description || ' '; // 顯示空格而非 null
            const price = document.createElement('p');
            price.className = 'price';
            price.textContent = product.price !== null ? `NT$ ${Math.floor(product.price)}` : '價格洽詢'; // 顯示整數價格

            // 組合卡片內容
            contentDiv.appendChild(name);
            contentDiv.appendChild(description);
            contentDiv.appendChild(price);

            // 組合整個卡片連結
            cardLink.appendChild(imageContainer);
            cardLink.appendChild(contentDiv);

            // 將完成的卡片連結添加到格線中
            grid.appendChild(cardLink);
        }); // --- End of productList.forEach ---
    } // --- End of displayProducts function ---

    // --- 為「最新商品」和「熱門商品」排序連結添加點擊事件處理 ---
    if (sortLinks.length > 0) {
        sortLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault(); // 阻止默認的錨點跳轉

                // 處理連結的 active 狀態
                sortLinks.forEach(otherLink => otherLink.classList.remove('active')); // 移除所有連結的 active
                link.classList.add('active'); // 為當前點擊的連結添加 active

                // 獲取排序方式 ('latest' 或 'popular')
                const sortBy = link.dataset.sort;

                // 根據選擇的排序方式重新獲取並顯示商品
                if (sortBy) {
                    fetchProducts(sortBy);
                } else {
                    console.warn("排序連結缺少 data-sort 屬性:", link);
                    fetchProducts(); // 如果缺少屬性，則按預設排序
                }
            });
        });
    } else {
        console.warn("找不到排序連結元素 (.sort-link)");
    }

    // --- 頁面初始加載 ---
    // 預設獲取並顯示最新商品
    fetchProducts('latest');

}); // --- End of DOMContentLoaded ---


// public/app.js
document.addEventListener('DOMContentLoaded', () => {
    // 獲取商品格線和排序連結的 DOM 元素 (保持不變)
    const grid = document.getElementById('product-grid');
    const sortLinks = document.querySelectorAll('.sort-link');







    // *** 新增: 獲取 Banner 輪播相關元素 ***
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null;

    /**
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 從後端 API 獲取 Banner 資料並初始化輪播
     */
    
    


    async function fetchAndDisplayBanners() {
        console.log("[home] Fetching banners for home page");
        
        try {
            const response = await fetch('/api/banners?page=home'); /* 選擇 home 或 music 或 news */
            console.log("[home] Banner API response status:", response.status);/* 選擇 home 或 music 或 news */

            if (!response.ok) {
                throw new Error(`獲取輪播圖失敗 (HTTP ${response.status})`);
            }

            const homePageBanners = await response.json();
            console.log(`[home] Received ${homePageBanners.length} home page banners`);

            // 直接渲染隨機輪播圖
            renderRandomBanner(homePageBanners);

        } catch (error) {
            console.error("[home] Banner error:", error);
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











    // --- fetchProducts 和 displayProducts 函數保持不變 ---
    async function fetchProducts(sortBy = 'latest') { /* ... */ }
    function displayProducts(productList) { /* ... */ }
    // --- 排序連結事件處理保持不變 ---
    if (sortLinks.length > 0) { /* ... */ }

    // --- 頁面初始加載 ---
    fetchAndDisplayBanners(); // *** 載入 Banner ***
    fetchProducts('latest'); // 載入商品

});