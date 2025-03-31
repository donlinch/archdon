// public/app.js (完整替換)
document.addEventListener('DOMContentLoaded', () => {
    // 獲取商品格線和排序連結的 DOM 元素
    const grid = document.getElementById('product-grid');
    const sortLinks = document.querySelectorAll('.sort-link');

    // 獲取 Banner 輪播相關元素
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null; // 用於儲存 Swiper 實例

    /**
     * 從後端 API 獲取指定頁面的 Banner 資料並初始化輪播
     * @param {string} pageIdentifier - 頁面標識符 ('home', 'music', 'news')
     */
    async function fetchAndDisplayBanners(pageIdentifier = 'home') { // 預設獲取 home
        if (!bannerWrapper) {
            console.warn("未找到 Banner 輪播的 swiper-wrapper 元素 (選擇器: #banner-carousel .swiper-wrapper)。請檢查 index.html。");
            const carouselElement = document.getElementById('banner-carousel');
            if (carouselElement) carouselElement.style.display = 'none';
            return;
        }

        bannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#f0f0f0;">載入中...</div>';

        try {
            // *** 修改這裡：添加 ?page= Query 參數 ***
            const apiUrl = `/api/banners?page=${encodeURIComponent(pageIdentifier)}`;
            console.log(`[Banner] Fetching banners from: ${apiUrl}`); // 除錯日誌
            const response = await fetch(apiUrl);

            if (!response.ok) {
                 let errorText = `獲取 Banners 失敗 (HTTP ${response.status})`;
                 try { const data = await response.json(); errorText += `: ${data.error || response.statusText}`; } catch (e) {}
                 throw new Error(errorText);
            }
            const banners = await response.json();
            console.log(`[Banner] Received ${banners.length} banners for page '${pageIdentifier}'.`); // 除錯日誌

            bannerWrapper.innerHTML = ''; // 清空 Loading

            if (!banners || banners.length === 0) {
                console.log(`[Banner] 後端未返回 '${pageIdentifier}' 頁面的 Banner 數據，顯示預設內容。`);
                // 顯示預設圖片或Logo
                bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy Logo" style="max-height: 80%; object-fit: contain;"></div>';
            } else {
                // 有 Banner 數據，創建 Slides
                banners.forEach(banner => {
                    const slide = document.createElement('div');
                    slide.className = 'swiper-slide';

                    const img = document.createElement('img');
                    img.src = banner.image_url;
                    // 使用後端提供的 alt_text 或預設文字
                    img.alt = banner.alt_text || `Banner ${banner.id || ''}`;

                    // 如果 banner 有 link_url，則將圖片包在連結中
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
                console.log("[Banner] 銷毀舊的 Swiper 實例。");
                bannerSwiper.destroy(true, true);
                bannerSwiper = null;
            }

            if (bannerWrapper.children.length > 0) {
                console.log("[Banner] 初始化新的 Swiper 實例。");
                bannerSwiper = new Swiper('#banner-carousel', {
                    direction: 'horizontal',
                    // *** 只有在 banners 陣列確實有數據且多於1張時才 loop ***
                    loop: banners && banners.length > 1,
                    autoplay: {
                        delay: 4000,
                        disableOnInteraction: false,
                        pauseOnMouseEnter: true,
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
                    keyboard: {
                        enabled: true,
                    },
                });
                console.log("[Banner] Swiper 初始化完成。");
            } else {
                 console.log("[Banner] Wrapper 中沒有 Slides，不初始化 Swiper。");
            }

        } catch (error) {
            console.error("[Banner] 獲取或處理 Banner 輪播時出錯:", error);
            bannerWrapper.innerHTML = `<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#fdd; color: #d33;">輪播圖載入失敗: ${error.message}</div>`;
            // 隱藏導航和分頁
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
    console.log("頁面初始加載：開始獲取 Banners 和 Products。");
    // *** 修改這裡：明確指定獲取 'home' 頁面的 Banner ***
    fetchAndDisplayBanners('home');
    fetchProducts('latest'); // 載入最新商品

}); // --- End of DOMContentLoaded ---