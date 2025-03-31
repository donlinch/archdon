// public/app.js
document.addEventListener('DOMContentLoaded', () => {
    // 獲取商品格線和排序連結的 DOM 元素 (保持不變)
    const grid = document.getElementById('product-grid');
    const sortLinks = document.querySelectorAll('.sort-link');

    // *** 新增: 獲取 Banner 輪播相關元素 ***
    // !! 重要: 請確保你的 index.html 中輪播容器的 ID 是 'banner-carousel' !!
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null; // 用於儲存 Swiper 實例

    /**
     * 從後端 API 獲取 Banner 資料並初始化輪播
     */
    async function fetchAndDisplayBanners() {
        if (!bannerWrapper) {
            console.warn("未找到 Banner 輪播的 swiper-wrapper 元素 (選擇器: #banner-carousel .swiper-wrapper)。請檢查 index.html。");
            // 可以嘗試顯示錯誤或隱藏輪播區
             const carouselElement = document.getElementById('banner-carousel');
             if (carouselElement) carouselElement.style.display = 'none'; // 隱藏輪播區
            return;
        }
        // 可以先放一個 Loading 狀態的 slide (可選)
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#f0f0f0;">載入中...</div>';

        try {
            const response = await fetch('/api/banners'); // 從後端獲取 banners
            if (!response.ok) {
                throw new Error(`獲取 Banners 失敗 (HTTP ${response.status})`);
            }
            const banners = await response.json();

            bannerWrapper.innerHTML = ''; // 清空 Loading 或舊內容

            if (!banners || banners.length === 0) {
                // 如果沒有 Banner，顯示預設圖片或Logo
                console.log("後端未返回 Banner 數據，顯示預設內容。");
                bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy Logo" style="max-height: 80%; object-fit: contain;"></div>';
                // 如果連預設圖都沒有，可以隱藏
                // const carouselElement = document.getElementById('banner-carousel');
                // if (carouselElement) carouselElement.style.display = 'none';
            } else {
                // 有 Banner 數據，創建 Slides
                banners.forEach(banner => {
                    const slide = document.createElement('div');
                    slide.className = 'swiper-slide'; // Swiper 需要的 class

                    const img = document.createElement('img');
                    img.src = banner.image_url;
                     // 嘗試從 image_url 推斷 alt 或使用後端提供的 alt (如果有的話)
                    img.alt = banner.alt_text || `Banner ${banner.id || ''}`; // 你可能需要在後端 API 和管理介面加上 alt_text 欄位

                    // 如果 banner 有 link_url，則將圖片包在連結中
                    if (banner.link_url) {
                        const link = document.createElement('a');
                        link.href = banner.link_url;
                        link.target = '_blank'; // 在新分頁開啟
                        link.rel = 'noopener noreferrer'; // 安全性考量
                        link.appendChild(img);
                        slide.appendChild(link);
                    } else {
                        // 沒有連結，直接放置圖片
                        slide.appendChild(img);
                    }
                    bannerWrapper.appendChild(slide); // 將 slide 添加到 wrapper
                });
            }

            // *** 初始化 Swiper ***
            // 先銷毀可能存在的舊 Swiper 實例，防止重複初始化
            if (bannerSwiper) {
                console.log("銷毀舊的 Swiper 實例。");
                bannerSwiper.destroy(true, true); // true, true 表示同時移除事件監聽器和樣式
                bannerSwiper = null;
            }

            // 只有在確定有 Slide (即使是預設 Slide) 的情況下才初始化
            if (bannerWrapper.children.length > 0) {
                console.log("初始化新的 Swiper 實例。");
                // !! 重要: 確保你的 index.html 中輪播容器的 ID 是 'banner-carousel' !!
                bannerSwiper = new Swiper('#banner-carousel', {
                    // --- Swiper 配置 ---
                    direction: 'horizontal',        // 方向: 水平
                    loop: banners && banners.length > 1, // 只有多於一張圖時才循環
                    autoplay: {
                        delay: 4000,                // 自動播放延遲 (4秒)
                        disableOnInteraction: false,// 用戶互動後不停止自動播放
                        pauseOnMouseEnter: true,    // 滑鼠移入時暫停 (可選)
                    },
                    slidesPerView: 1,              // 每次只顯示1張
                    spaceBetween: 0,               // Slide 之間無間距
                    grabCursor: true,              // 顯示手型游標

                    // 分頁器 (小圓點)
                    pagination: {
                        el: '#banner-carousel .swiper-pagination', // 選擇器指向分頁容器
                        clickable: true,             // 允許點擊小圓點切換
                    },

                    // 導航按鈕 (左右箭頭)
                    navigation: {
                        nextEl: '#banner-carousel .swiper-button-next', // 選擇器指向下一頁按鈕
                        prevEl: '#banner-carousel .swiper-button-prev', // 選擇器指向上一頁按鈕
                    },

                    // 鍵盤控制 (可選)
                    keyboard: {
                        enabled: true,
                    },

                    // 滾輪控制 (可選, 可能干擾頁面滾動)
                    // mousewheel: true,
                });
                console.log("Swiper 初始化完成。");
            } else {
                 console.log("Wrapper 中沒有 Slides，不初始化 Swiper。");
            }


        } catch (error) {
            console.error("獲取或處理 Banner 輪播時出錯:", error);
            // 顯示錯誤訊息
            bannerWrapper.innerHTML = `<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#fdd; color: #d33;">輪播圖載入失敗: ${error.message}</div>`;
             // 可以考慮隱藏導航和分頁
             const carouselElement = document.getElementById('banner-carousel');
             if (carouselElement) {
                 const navNext = carouselElement.querySelector('.swiper-button-next');
                 const navPrev = carouselElement.querySelector('.swiper-button-prev');
                 const pagination = carouselElement.querySelector('.swiper-pagination');
                 if(navNext) navNext.style.display = 'none';
                 if(navPrev) navPrev.style.display = 'none';
                 if(pagination) pagination.style.display = 'none';
             }
        }
    } // --- End of fetchAndDisplayBanners ---


    // --- fetchProducts 和 displayProducts 函數定義 (保持不變) ---
    async function fetchProducts(sortBy = 'latest') {
        if (!grid) { console.error("商品格線元素未找到！"); return; } grid.innerHTML = '<p>正在加載商品...</p>'; let apiUrl = '/api/products'; if (sortBy === 'popular') { apiUrl = '/api/products?sort=popular'; } try { const response = await fetch(apiUrl); if (!response.ok) { throw new Error(`HTTP 錯誤！狀態: ${response.status}`); } const products = await response.json(); displayProducts(products); } catch (error) { console.error("獲取商品失敗:", error); grid.innerHTML = '<p>無法加載商品，請稍後再試。</p>'; }
    }
    function displayProducts(productList) {
        if (!grid) { return; } grid.innerHTML = ''; if (!productList || productList.length === 0) { grid.innerHTML = '<p>目前沒有商品可顯示。</p>'; return; } productList.forEach(product => { const cardLink = document.createElement('a'); cardLink.className = 'product-card'; cardLink.href = product.seven_eleven_url || '#'; if (product.seven_eleven_url) { cardLink.target = '_blank'; cardLink.rel = 'noopener noreferrer'; } cardLink.addEventListener('click', (event) => { if (product.seven_eleven_url && product.id) { event.preventDefault(); fetch(`/api/products/${product.id}/click`, { method: 'POST' }).then(response => { if (!response.ok) { console.warn(`記錄商品 ${product.id} 點擊可能失敗 (HTTP ${response.status})`); } }).catch(err => { console.error(`記錄商品 ${product.id} 點擊時網路錯誤:`, err); }); window.open(product.seven_eleven_url, '_blank'); } }); const imageContainer = document.createElement('div'); imageContainer.className = 'image-container'; const img = document.createElement('img'); img.src = product.image_url || '/images/placeholder.png'; img.alt = product.name || '商品圖片'; imageContainer.appendChild(img); const contentDiv = document.createElement('div'); contentDiv.className = 'card-content'; const name = document.createElement('h3'); name.textContent = product.name || '未命名商品'; const description = document.createElement('p'); description.textContent = product.description || ' '; const price = document.createElement('p'); price.className = 'price'; price.textContent = product.price !== null ? `NT$ ${Math.floor(product.price)}` : '價格洽詢'; contentDiv.appendChild(name); contentDiv.appendChild(description); contentDiv.appendChild(price); cardLink.appendChild(imageContainer); cardLink.appendChild(contentDiv); grid.appendChild(cardLink); });
    }
    // --- 排序連結事件處理 (保持不變) ---
    if (sortLinks.length > 0) {
        sortLinks.forEach(link => { link.addEventListener('click', (event) => { event.preventDefault(); sortLinks.forEach(otherLink => otherLink.classList.remove('active')); link.classList.add('active'); const sortBy = link.dataset.sort; if (sortBy) { fetchProducts(sortBy); } else { console.warn("排序連結缺少 data-sort 屬性:", link); fetchProducts(); } }); });
    } else {
        console.warn("找不到排序連結元素 (.sort-link)");
    }

    // --- 頁面初始加載 ---
    // 同時開始加載 Banner 和商品
    console.log("頁面初始加載：開始獲取 Banners 和 Products。");
    fetchAndDisplayBanners(); // *** 載入 Banner ***
    fetchProducts('latest'); // 載入最新商品

}); // --- End of DOMContentLoaded ---