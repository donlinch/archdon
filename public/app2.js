// public/app.js
document.addEventListener('DOMContentLoaded', () => {
    // --- 獲取 DOM 元素 ---
    const grid = document.getElementById('product-grid');
    const sortLinks = document.querySelectorAll('.sort-link');
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null; // 用於儲存 Swiper 實例

    // --- 函數定義 ---

    /**
     * 從後端 API 獲取 Banner 資料並初始化輪播 (恢復預設順序)
     */
    async function fetchAndDisplayBanners() {
        if (!bannerWrapper) {
            console.warn("未找到 Banner 輪播的 swiper-wrapper 元素。");
            return;
        }
        try {
            const response = await fetch('/api/banners?page=home');
            if (!response.ok) {
                throw new Error(`獲取 Banners 失敗 (HTTP ${response.status})`);
            }
            // *** 改回 const，不再隨機排序 Banner ***
            const banners = await response.json();

            bannerWrapper.innerHTML = ''; // 清空舊內容

            if (!banners || banners.length === 0) {
                bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy"></div>';
            } else {
                // 使用從 API 獲取的原始順序創建 slides
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

            // *** 初始化 Swiper ***
            if (bannerSwiper) {
                bannerSwiper.destroy(true, true);
            }
            bannerSwiper = new Swiper('#banner-carousel', {
                direction: 'horizontal',
                loop: banners && banners.length > 1,
                autoplay: { delay: 12000, disableOnInteraction: false },
                slidesPerView: 1,
                spaceBetween: 0,
                grabCursor: true,
                pagination: { el: '#banner-carousel .swiper-pagination', clickable: true },
                navigation: { nextEl: '#banner-carousel .swiper-button-next', prevEl: '#banner-carousel .swiper-button-prev' },
                touchEventsTarget: 'container',
            });

        } catch (error) {
            console.error("處理 Banner 輪播時出錯:", error);
            if (bannerWrapper) bannerWrapper.innerHTML = '<div class="swiper-slide">輪播圖載入失敗</div>';
        }
    } // --- End of fetchAndDisplayBanners ---

    /**
     * 從後端 API 獲取商品資料，根據需要進行隨機排序，並觸發顯示
     * @param {string} sortBy - 排序方式 ('latest', 'popular', 或 'random')
     */
    async function fetchProducts(sortBy = 'latest') {
        if (!grid) {
            console.error("商品格線元素未找到！");
            return;
        }
        grid.innerHTML = '<p>正在加載商品...</p>';

        let apiUrl = '/api/products'; // 基礎 URL，預設獲取最新商品
        if (sortBy === 'popular') {
            apiUrl = '/api/products?sort=popular'; // 熱門排序由後端處理
        }
        // 注意：當 sortBy === 'random' 時，我們仍然從基礎 apiUrl 獲取數據，
        // 然後在客戶端進行隨機排序。

        try {
            console.log(`正在從 ${apiUrl} 獲取商品... (請求排序方式: ${sortBy})`);
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            }
            // *** 改回 let，因為需要隨機排序 ***
            let products = await response.json();

            // --- 客戶端商品隨機排序邏輯 ---
            if (sortBy === 'random') {
                console.log("正在執行客戶端商品隨機排序...");
                 if (products && products.length > 0) { // 確保有商品才排序
                    products = [...products].sort(() => Math.random() - 0.5);
                 }
            }
            // --- 排序邏輯結束 ---

            displayProducts(products); // 將獲取的 (可能已隨機排序的) 商品顯示出來

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
        // 這個函數保持不變，它只負責顯示傳入的 productList
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
                const sortBy = link.dataset.sort; // 獲取 'latest', 'popular', 或 'random'

                if (sortBy) {
                    fetchProducts(sortBy); // 調用 fetchProducts 處理排序
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
    fetchAndDisplayBanners(); // 載入 Banner (預設順序)
    fetchProducts('latest');    // 載入預設商品 (最新)

}); // --- End of SINGLE DOMContentLoaded ---