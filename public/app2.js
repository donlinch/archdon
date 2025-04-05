// public/app.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
    const grid = document.getElementById('product-grid'); // 商品格線
    const sortLinks = document.querySelectorAll('.sort-link'); // 商品排序連結
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper'); // Banner 輪播容器
    let bannerSwiper = null; // Banner Swiper 實例變數

    // --- 輔助函數 ---

    /**
     * 輔助函數：原地隨機打亂一個陣列 (Fisher-Yates Algorithm)
     * @param {Array} array 要被打亂的陣列
     */
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            // 從 0 到 i (包含 i) 隨機選一個索引 j
            const j = Math.floor(Math.random() * (i + 1));
            // 交換 array[i] 和 array[j] 的位置
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // --- Banner 相關函數 ---

    /**
     * 從後端 API 獲取 Banner 資料，隨機排序後，初始化輪播
     */
    async function fetchAndDisplayBanners() {
        if (!bannerWrapper) {
            console.warn("未找到 Banner 輪播的 swiper-wrapper 元素。");
            return;
        }
        // bannerWrapper.innerHTML = '<div class="swiper-slide">載入中...</div>'; // 可選的載入狀態

        try {
            // 獲取 'home' 頁面的 banners
            const response = await fetch('/api/banners?page=home');
            if (!response.ok) {
                throw new Error(`獲取 Banners 失敗 (HTTP ${response.status})`);
            }
            // 使用 let 宣告 banners，因為我們要對它進行洗牌操作
            let banners = await response.json();

            // --- *** 在這裡進行 Banner 隨機排序 *** ---
            if (banners && banners.length > 1) { // 只有超過一張 banner 才需要洗牌
                 console.log("前端：正在隨機排序 Banner...");
                 shuffleArray(banners); // 直接修改 banners 陣列的順序
            }
            // --- *** 隨機排序結束 *** ---

            bannerWrapper.innerHTML = ''; // 清空載入中或舊的內容

            if (!banners || banners.length === 0) {
                // 如果沒有 Banner，顯示預設圖片
                bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy"></div>';
            } else {
                // 遍歷 *已經隨機排序過* 的 banners 陣列來建立 slide
                banners.forEach(banner => {
                    const slide = document.createElement('div');
                    slide.className = 'swiper-slide';

                    const img = document.createElement('img');
                    img.src = banner.image_url;
                    img.alt = banner.alt_text || '輪播圖片';

                    if (banner.link_url) {
                        // 有連結，包在 a 標籤內
                        const link = document.createElement('a');
                        link.href = banner.link_url;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.appendChild(img);
                        slide.appendChild(link);
                    } else {
                        // 沒有連結，直接放圖片
                        slide.appendChild(img);
                    }
                    bannerWrapper.appendChild(slide);
                });
            }

            // *** 初始化或重新初始化 Swiper ***
            if (bannerSwiper) {
                bannerSwiper.destroy(true, true); // 銷毀舊實例
            }
            bannerSwiper = new Swiper('#banner-carousel', {
                direction: 'horizontal',
                loop: banners.length > 1, // 超過一張才循環
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

    // --- 商品相關函數 ---

    /**
     * 從後端 API 獲取商品資料並觸發顯示
     * @param {string} sortBy - 排序方式 ('latest' 或 'popular')
     */
    async function fetchProducts(sortBy = 'latest') {
        if (!grid) {
            console.error("商品格線元素未找到！");
            return;
        }
        grid.innerHTML = '<p>正在加載商品...</p>'; // 顯示加載訊息

        let apiUrl = '/api/products'; // 基本 API URL
        if (sortBy === 'popular') {
            apiUrl = '/api/products?sort=popular'; // 熱門排序
        }

        try {
            const response = await fetch(apiUrl); // 請求 API
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            }
            const products = await response.json();
            displayProducts(products); // 顯示商品
        } catch (error) {
            console.error("獲取商品失敗:", error);
            grid.innerHTML = '<p>無法加載商品，請稍後再試。</p>'; // 顯示錯誤訊息
        }
    }

    /**
     * 將商品列表渲染到頁面上
     * @param {Array} productList - 商品物件陣列
     */
    function displayProducts(productList) {
        if (!grid) { return; } // 再次檢查 grid 是否存在
        grid.innerHTML = ''; // 清空

        if (!productList || productList.length === 0) {
            grid.innerHTML = '<p>目前沒有商品可顯示。</p>';
            return;
        }

        productList.forEach(product => {
            // 創建商品卡片連結 (<a>)
            const cardLink = document.createElement('a');
            cardLink.className = 'product-card';
            cardLink.href = product.seven_eleven_url || '#';
            if (product.seven_eleven_url) {
                cardLink.target = '_blank';
                cardLink.rel = 'noopener noreferrer';
            }

            // --- 商品卡片點擊事件 (記錄點擊) ---
            cardLink.addEventListener('click', (event) => {
                if (product.seven_eleven_url && product.id) {
                    event.preventDefault(); // 阻止默認跳轉
                    // 異步記錄點擊
                    fetch(`/api/products/${product.id}/click`, { method: 'POST' })
                        .then(response => {
                            if (!response.ok) {
                                console.warn(`記錄商品 ${product.id} 點擊可能失敗 (HTTP ${response.status})`);
                            }
                        })
                        .catch(err => {
                            console.error(`記錄商品 ${product.id} 點擊時網路錯誤:`, err);
                        });
                    // 手動打開連結
                    window.open(product.seven_eleven_url, '_blank');
                }
            });

            // --- 創建卡片內部元素 ---
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';
            const img = document.createElement('img');
            img.src = product.image_url || '/images/placeholder.png'; // 預設圖片
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
            price.textContent = product.price !== null ? `NT$ ${Math.floor(product.price)}` : '價格洽詢'; // 整數價格

            // 組合卡片內容
            contentDiv.appendChild(name);
            contentDiv.appendChild(description);
            contentDiv.appendChild(price);

            // 組合整個卡片連結
            cardLink.appendChild(imageContainer);
            cardLink.appendChild(contentDiv);

            // 添加到格線
            grid.appendChild(cardLink);
        }); // --- End of productList.forEach ---
    } // --- End of displayProducts function ---

    // --- 商品排序連結點擊事件處理 ---
    if (sortLinks.length > 0) {
        sortLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault(); // 阻止跳轉

                // 更新 active 狀態
                sortLinks.forEach(otherLink => otherLink.classList.remove('active'));
                link.classList.add('active');

                // 獲取排序方式
                const sortBy = link.dataset.sort;

                // 重新獲取並顯示商品
                if (sortBy) {
                    fetchProducts(sortBy);
                } else {
                    console.warn("排序連結缺少 data-sort 屬性:", link);
                    fetchProducts(); // 預設排序
                }
            });
        });
    } else {
        console.warn("找不到排序連結元素 (.sort-link)");
    }
    fetchAndDisplayBanners(); // *** 載入並隨機顯示 Banner ***

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
     * 從後端 API 獲取 Banner 資料並初始化輪播
     */
    async function fetchAndDisplayBanners() {
        if (!bannerWrapper) {
            console.warn("未找到 Banner 輪播的 swiper-wrapper 元素。");
            return;
        }
        // 可以先放一個 Loading 狀態的 slide (可選)
        // bannerWrapper.innerHTML = '<div class="swiper-slide">載入中...</div>';

        try {
            const response = await fetch('/api/banners?page=home');
            if (!response.ok) {
                throw new Error(`獲取 Banners 失敗 (HTTP ${response.status})`);
            }
            const banners = await response.json();

            bannerWrapper.innerHTML = ''; // 清空 Loading 或舊內容

            if (banners.length === 0) {
                // 如果沒有 Banner，可以顯示預設圖片或隱藏輪播
                bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy"></div>'; // 例如，顯示 Logo
                // 或者隱藏輪播區塊
                // document.getElementById('banner-carousel').style.display = 'none';
            } else {
                banners.forEach(banner => {
                    const slide = document.createElement('div');
                    slide.className = 'swiper-slide';

                    const img = document.createElement('img');
                    img.src = banner.image_url;
                    img.alt = banner.alt_text || '輪播圖片'; // 使用 alt_text 或預設文字

                    if (banner.link_url) {
                        // 如果有連結，整個 slide 內容包在 a 標籤內
                        const link = document.createElement('a');
                        link.href = banner.link_url;
                        link.target = '_blank'; // 在新分頁開啟
                        link.rel = 'noopener noreferrer';
                        link.appendChild(img);
                        slide.appendChild(link);
                    } else {
                        // 沒有連結，直接放圖片
                        slide.appendChild(img);
                    }
                    bannerWrapper.appendChild(slide);
                });
            }

            // *** 初始化 Swiper ***
            // 先銷毀舊的實例 (如果存在)
            if (bannerSwiper) {
                bannerSwiper.destroy(true, true);
            }
            // 創建新的 Swiper 實例
            bannerSwiper = new Swiper('#banner-carousel', {
                // Optional parameters
                direction: 'horizontal', // 水平輪播
                loop: banners.length > 1, // 只有一張以上圖片時才循環
                autoplay: {
                    delay: 12000, // 自動播放間隔 (毫秒)
                    disableOnInteraction: false, // 用戶操作後是否停止自動播放 (false=不停止)
                },
                slidesPerView: 1, // 每次顯示一張
                spaceBetween: 0, // Slide 之間的間距
                grabCursor: true, // 顯示抓取手勢

                // If we need pagination
                pagination: {
                    el: '#banner-carousel .swiper-pagination',
                    clickable: true, // 分頁點可點擊
                },

                // Navigation arrows
                navigation: {
                    nextEl: '#banner-carousel .swiper-button-next',
                    prevEl: '#banner-carousel .swiper-button-prev',
                },

                // And if we need scrollbar (可選)
                // scrollbar: {
                //   el: '.swiper-scrollbar',
                // },

                // Enable swiping on touch devices (預設啟用)
                touchEventsTarget: 'container', // 在容器上觸發滑動

                 // 適應不同螢幕尺寸 (可選)
                // breakpoints: {
                //     // when window width is >= 640px
                //     640: {
                //         slidesPerView: 1,
                //         spaceBetween: 0
                //     },
                //     // when window width is >= 768px
                //     768: {
                //          slidesPerView: 1,
                //          spaceBetween: 0
                //     }
                // }
            });

        } catch (error) {
            console.error("處理 Banner 輪播時出錯:", error);
            if (bannerWrapper) bannerWrapper.innerHTML = '<div class="swiper-slide">輪播圖載入失敗</div>';
        }
    } // --- End of fetchAndDisplayBanners ---


    // --- fetchProducts 和 displayProducts 函數保持不變 ---
    async function fetchProducts(sortBy = 'latest') { /* ... */ }
    function displayProducts(productList) { /* ... */ }
    // --- 排序連結事件處理保持不變 ---
    if (sortLinks.length > 0) { /* ... */ }

    // --- 頁面初始加載 ---
    fetchAndDisplayBanners(); // *** 載入 Banner ***
    fetchProducts('latest'); // 載入商品

});