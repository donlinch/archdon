// public/app.js
document.addEventListener('DOMContentLoaded', () => {
    // --- 獲取 DOM 元素 (只需要一次) ---
    const grid = document.getElementById('product-grid');
    const sortLinks = document.querySelectorAll('.sort-link');
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null; // 用於儲存 Swiper 實例

    // --- 函數定義 ---

    /**
     * 從後端 API 獲取 Banner 資料，隨機排序，並初始化輪播
     */
    async function fetchAndDisplayBanners() {
        if (!bannerWrapper) {
            console.warn("未找到 Banner 輪播的 swiper-wrapper 元素。");
            return;
        }
        // 可選: 顯示載入中狀態
        // bannerWrapper.innerHTML = '<div class="swiper-slide">Banner 載入中...</div>';

        try {
            const response = await fetch('/api/banners?page=home'); // 獲取首頁的 banners
            if (!response.ok) {
                throw new Error(`獲取 Banners 失敗 (HTTP ${response.status})`);
            }
            let banners = await response.json(); // *** 使用 let ***

            // --- 開始 Banner 隨機排序 ---
            if (banners && banners.length > 1) { // 確保有 banners 且數量超過 1 才排序
                 console.log("正在執行 Banner 隨機排序...");
                 banners = [...banners].sort(() => Math.random() - 0.5);
            }
            // --- Banner 隨機排序結束 ---

            bannerWrapper.innerHTML = ''; // 清空 Loading 或舊內容

            if (!banners || banners.length === 0) {
                // 如果沒有 Banner，可以顯示預設圖片或隱藏輪播
                bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy"></div>'; // 示例 Logo
                // document.getElementById('banner-carousel').style.display = 'none'; // 隱藏輪播
            } else {
                // 使用排序後的 banners 陣列來創建 slides
                banners.forEach(banner => {
                    const slide = document.createElement('div');
                    slide.className = 'swiper-slide';

                    const img = document.createElement('img');
                    img.src = banner.image_url;
                    img.alt = banner.alt_text || '輪播圖片';

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

            // *** 初始化 Swiper (使用隨機排序後的 banners) ***
            if (bannerSwiper) {
                bannerSwiper.destroy(true, true); // 銷毀舊實例
            }

            bannerSwiper = new Swiper('#banner-carousel', {
                direction: 'horizontal',
                loop: banners && banners.length > 1, // 只有一張以上圖片時才循環
                autoplay: {
                    delay: 12000,
                    disableOnInteraction: false,
                },
                slidesPerView: 1,
                spaceBetween: 0,
                grabCursor: true,
                pagination: {
                    el: '#banner-carousel .swiper-pagination',
                    clickable: true,
                },
                navigation: {
                    nextEl: '#banner-carousel .swiper-button-next',
                    prevEl: '#banner-carousel .swiper-button-prev',
                },
                touchEventsTarget: 'container',
            });

        } catch (error) {
            console.error("處理 Banner 輪播時出錯:", error);
            if (bannerWrapper) bannerWrapper.innerHTML = '<div class="swiper-slide">輪播圖載入失敗</div>';
        }
    } // --- End of fetchAndDisplayBanners ---

    /**
     * 從後端 API 獲取商品資料並觸發顯示
     * @param {string} sortBy - 排序方式 ('latest' 或 'popular')
     */
    async function fetchProducts(sortBy = 'latest') {
        if (!grid) {
            console.error("商品格線元素未找到！");
            return;
        }
        grid.innerHTML = '<p>正在加載商品...</p>';

        let apiUrl = '/api/products';
        if (sortBy === 'popular') {
            apiUrl = '/api/products?sort=popular';
        }
        // 不再需要處理 sortBy === 'random' for products

        try {
            console.log(`正在從 ${apiUrl} 獲取商品... (請求排序方式: ${sortBy})`);
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            }
            // *** 這裡改回 const，因為商品不需要客戶端隨機排序了 ***
            const products = await response.json();

            displayProducts(products); // 直接顯示獲取的商品

        } catch (error) {
            console.error("獲取商品失敗:", error);
            grid.innerHTML = '<p>無法加載商品，請稍後再試。</p>';
        }
    } // --- End of fetchProducts ---

    /**
     * 將商品列表渲染到頁面上
     * @param {Array} productList - 商品物件陣列
     */
    function displayProducts(productList) {
        if (!grid) { return; }
        grid.innerHTML = '';

        if (!productList || productList.length === 0) {
            grid.innerHTML = '<p>目前沒有商品可顯示。</p>';
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

            cardLink.addEventListener('click', (event) => {
                if (product.seven_eleven_url && product.id) {
                    event.preventDefault();
                    fetch(`/api/products/${product.id}/click`, { method: 'POST' })
                        .catch(err => console.error(`記錄商品 ${product.id} 點擊時網路錯誤:`, err));
                    window.open(product.seven_eleven_url, '_blank');
                }
            });

            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';
            const img = document.createElement('img');
            img.src = product.image_url || '/images/placeholder.png';
            img.alt = product.name || '商品圖片';
            imageContainer.appendChild(img);

            const contentDiv = document.createElement('div');
            contentDiv.className = 'card-content';
            const name = document.createElement('h3');
            name.textContent = product.name || '未命名商品';
            const description = document.createElement('p');
            description.textContent = product.description || ' ';
            const price = document.createElement('p');
            price.className = 'price';
            price.textContent = product.price !== null ? `NT$ ${Math.floor(product.price)}` : '價格洽詢';

            contentDiv.appendChild(name);
            contentDiv.appendChild(description);
            contentDiv.appendChild(price);

            cardLink.appendChild(imageContainer);
            cardLink.appendChild(contentDiv);

            grid.appendChild(cardLink);
        });
    } // --- End of displayProducts ---

    // --- 事件監聽器 ---
    if (sortLinks.length > 0) {
        sortLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                sortLinks.forEach(otherLink => otherLink.classList.remove('active'));
                link.classList.add('active');
                const sortBy = link.dataset.sort; // 獲取 'latest', 'popular', 或 HTML 中添加的 'random'

                // *** 如果你之前為商品添加了 random 排序連結，這裡會調用 fetchProducts('random')
                // *** 但現在 fetchProducts 不處理 random 了，你需要決定點擊 "隨機推薦" 連結時的行為
                // *** 1. 讓它依然調用 fetchProducts('random')，但效果等同於 fetchProducts('latest')
                // *** 2. 移除 HTML 中的 "隨機推薦" 連結
                // *** 3. 修改此處邏輯，例如點擊隨機時重新加載最新商品：
                // const effectiveSortBy = (sortBy === 'random') ? 'latest' : sortBy;
                // fetchProducts(effectiveSortBy);

                // 目前保持原樣，如果點擊 data-sort="random"，會調用 fetchProducts('random')
                // 而 fetchProducts 函數會忽略 'random' 並使用預設的 apiUrl
                if (sortBy) {
                    fetchProducts(sortBy);
                } else {
                    console.warn("排序連結缺少 data-sort 屬性:", link);
                    fetchProducts(); // 按預設排序
                }
            });
        });
    } else {
        console.warn("找不到排序連結元素 (.sort-link)");
    }

    // --- 頁面初始加載 ---
    fetchAndDisplayBanners(); // 載入並顯示 (隨機排序後的) Banner
    fetchProducts('latest');    // 載入預設商品 (最新)

}); // --- End of SINGLE DOMContentLoaded ---