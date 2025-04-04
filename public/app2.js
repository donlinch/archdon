// public/app.js
document.addEventListener('DOMContentLoaded', () => {
    // 獲取商品格線和排序連結的 DOM 元素
    const grid = document.getElementById('product-grid');
    const sortLinks = document.querySelectorAll('.sort-link'); // 獲取所有排序連結

    // *** 新增: 獲取 Banner 輪播相關元素 ***
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null;

    // 將獲取的 Banner 圖片隨機排序
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));  // 隨機選擇一個索引
            [array[i], array[j]] = [array[j], array[i]];    // 交換元素
        }
    }

    /**
     * 從後端 API 獲取 Banner 資料並初始化輪播
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
            const banners = await response.json();

            // 隨機打亂圖片順序
            shuffleArray(banners);

            bannerWrapper.innerHTML = ''; // 清空之前的內容

            if (banners.length === 0) {
                bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy"></div>';
            } else {
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

            // 初始化 Swiper
            if (bannerSwiper) {
                bannerSwiper.destroy(true, true);
            }
            bannerSwiper = new Swiper('#banner-carousel', {
                direction: 'horizontal',
                loop: banners.length > 1,
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
            });

        } catch (error) {
            console.error("處理 Banner 輪播時出錯:", error);
            if (bannerWrapper) bannerWrapper.innerHTML = '<div class="swiper-slide">輪播圖載入失敗</div>';
        }
    }

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
    fetchAndDisplayBanners(); // *** 載入 Banner ***
    fetchProducts('latest'); // 載入商品

}); // --- End of DOMContentLoaded ---
