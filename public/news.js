// public/news.js (完整替換)
document.addEventListener('DOMContentLoaded', () => {
    // News specific elements
    const newsListContainer = document.getElementById('news-list');   // 獲取正確的列表容器 ID
    const paginationControls = document.getElementById('pagination-controls');
    const detailModal = document.getElementById('news-detail-modal');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailMeta = document.getElementById('detail-meta');
    const detailBody = document.getElementById('detail-body');

    // Banner related elements
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper'); // 確保 HTML 中有 #banner-carousel
    let bannerSwiper = null;

    // --- Banner Function ---
    async function fetchAndDisplayBanners() {
        console.log("[News Banner] fetchAndDisplayBanners called"); // 添加日誌
        if (!bannerWrapper) {
            console.warn("[News Banner] 未找到 Banner wrapper 元素 (#banner-carousel .swiper-wrapper)。");
            const carouselElement = document.getElementById('banner-carousel');
            if (carouselElement) carouselElement.style.display = 'none';
            return;
        }
        bannerWrapper.innerHTML = '<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background-color:#f0f0f0;">Banner 載入中...</div>';

        try {
            // **重要：目前這會獲取所有 Banner，因為你的 API (/api/banners) 還沒有按頁面篩選功能**
            // **如果你之後實現了後端篩選，這裡需要改成 fetch('/api/banners?page=news')**
            const response = await fetch('/api/banners');
             console.log("[News Banner] API Response Status:", response.status); // 添加日誌
            if (!response.ok) {
                 let errorText = `獲取 Banners 失敗 (HTTP ${response.status})`;
                 try { const data = await response.json(); errorText += `: ${data.error || response.statusText}`; } catch (e) {}
                 throw new Error(errorText);
            }
            const banners = await response.json();
            console.log("[News Banner] Received banners:", banners); // 添加日誌

            bannerWrapper.innerHTML = ''; // 清空 Loading

            if (!banners || banners.length === 0) {
                 console.log("[News Banner] 未收到 Banner 數據，顯示預設 Logo。");
                 bannerWrapper.innerHTML = '<div class="swiper-slide"><img src="/images/SunnyYummy.png" alt="Sunny Yummy Logo" style="max-height: 80%; object-fit: contain;"></div>';
            } else {
                 console.log(`[News Banner] 渲染 ${banners.length} 個 Banner Slides...`); // 添加日誌
                banners.forEach(banner => {
                    const slide = document.createElement('div');
                    slide.className = 'swiper-slide';
                    const img = document.createElement('img');
                    img.src = banner.image_url;
                    img.alt = banner.alt_text || `Banner ${banner.id || ''}`;
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

            if (bannerSwiper) {
                 console.log("[News Banner] 銷毀舊 Swiper 實例。");
                 bannerSwiper.destroy(true, true);
                 bannerSwiper = null;
            }

            if (bannerWrapper.children.length > 0) {
                 console.log("[News Banner] 初始化 Swiper...");
                 bannerSwiper = new Swiper('#banner-carousel', { // 確保 HTML 中有 #banner-carousel
                    loop: banners && banners.length > 1,
                    autoplay: { delay: 12000, disableOnInteraction: false, pauseOnMouseEnter: true }, // 速度 12 秒
                    pagination: { el: '#banner-carousel .swiper-pagination', clickable: true },
                    navigation: { nextEl: '#banner-carousel .swiper-button-next', prevEl: '#banner-carousel .swiper-button-prev' },
                    slidesPerView: 1,
                    spaceBetween: 0,
                    grabCursor: true,
                    keyboard: { enabled: true },
                });
                 console.log("[News Banner] Swiper 初始化完成。");
            } else {
                 console.log("[News Banner] Wrapper 為空，不初始化 Swiper。");
            }
        } catch (error) {
             console.error("[News Banner] 處理 Banner 時出錯:", error);
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
    }
    // --- Banner 代碼結束 ---


    // --- News specific variables and functions ---
    let currentPage = 1;
    const itemsPerPage = 10;

    async function fetchNews(page = 1) {
        // ... (fetchNews 函數內容不變) ...
        if (!newsListContainer || !paginationControls) { console.error("頁面缺少列表或分頁容器元素。"); return; } currentPage = page; newsListContainer.innerHTML = '<p>正在加載最新消息...</p>'; paginationControls.innerHTML = ''; try { const response = await fetch(`/api/news?page=${page}&limit=${itemsPerPage}`); if (!response.ok) throw new Error(`獲取消息失敗 (HTTP ${response.status})`); const data = await response.json(); displayNews(data.news); renderPagination(data.totalPages, data.currentPage); } catch (error) { console.error("獲取或顯示消息時出錯:", error); if (newsListContainer) newsListContainer.innerHTML = '<p>無法加載消息。</p>'; }
    }

    function displayNews(newsList) {
        // ... (displayNews 函數內容不變) ...
        if (!newsListContainer) return; newsListContainer.innerHTML = ''; if (newsList.length === 0) { newsListContainer.innerHTML = '<p>目前沒有最新消息。</p>'; return; } newsList.forEach(newsItem => { const card = document.createElement('div'); card.className = 'news-card'; const dateTag = document.createElement('div'); dateTag.className = 'date-tag'; if (newsItem.event_date) { const eventDate = new Date(newsItem.event_date); const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]; const dayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]; dateTag.innerHTML = `<span class="month">${monthNames[eventDate.getMonth()]}</span><span class="day">${eventDate.getDate()}</span><span class="weekday">${dayNames[eventDate.getDay()]}</span>`; } else { const updatedDate = new Date(newsItem.updated_at); dateTag.innerHTML = `<span class="month">${updatedDate.getMonth() + 1}月</span><span class="day">${updatedDate.getDate()}</span><span class="weekday">更新</span>`; } const thumbnailDiv = document.createElement('div'); thumbnailDiv.className = 'thumbnail'; const thumbnailImg = document.createElement('img'); thumbnailImg.src = newsItem.thumbnail_url || '/images/placeholder.png'; thumbnailImg.alt = newsItem.title || '縮圖'; thumbnailDiv.appendChild(thumbnailImg); const contentWrapper = document.createElement('div'); contentWrapper.className = 'content-wrapper'; contentWrapper.onclick = () => openNewsDetailModal(newsItem.id); contentWrapper.style.cursor = 'pointer'; const titleH3 = document.createElement('h3'); titleH3.className = 'news-title'; titleH3.textContent = newsItem.title || '無標題'; const summaryP = document.createElement('p'); summaryP.className = 'news-summary'; summaryP.textContent = newsItem.summary || ''; contentWrapper.appendChild(titleH3); contentWrapper.appendChild(summaryP); const actionsDiv = document.createElement('div'); actionsDiv.className = 'actions'; const likeButton = document.createElement('button'); likeButton.className = 'like-button'; likeButton.innerHTML = '<span class="heart-icon">♡</span>'; const likeCountSpan = document.createElement('span'); likeCountSpan.className = 'like-count'; likeCountSpan.textContent = newsItem.like_count || 0; likeButton.onclick = async (event) => { event.stopPropagation(); await likeNews(newsItem.id, likeButton, likeCountSpan); }; actionsDiv.appendChild(likeButton); actionsDiv.appendChild(likeCountSpan); card.appendChild(dateTag); card.appendChild(thumbnailDiv); card.appendChild(contentWrapper); card.appendChild(actionsDiv); newsListContainer.appendChild(card); });
    }

    function renderPagination(totalPages, currentPage) {
        // ... (renderPagination 函數內容不變) ...
        if (!paginationControls) return; paginationControls.innerHTML = ''; if (totalPages <= 1) return; const createPageButton = (pageNumber, text = pageNumber, isActive = false, isDisabled = false) => { const button = document.createElement('button'); button.textContent = text; button.disabled = isDisabled; if (isActive) { button.classList.add('active'); } else { button.onclick = () => fetchNews(pageNumber); } return button; }; paginationControls.appendChild(createPageButton(currentPage - 1, '上一頁', false, currentPage === 1)); for (let i = 1; i <= totalPages; i++) { paginationControls.appendChild(createPageButton(i, i, i === currentPage)); } paginationControls.appendChild(createPageButton(currentPage + 1, '下一頁', false, currentPage === totalPages));
    }

    async function openNewsDetailModal(newsId) {
        // ... (openNewsDetailModal 函數內容不變) ...
         if (!detailModal || !detailImage || !detailTitle || !detailMeta || !detailBody) { console.error("缺少詳情 Modal 的必要元素。"); return; } detailImage.src = ''; detailTitle.textContent = '加載中...'; detailMeta.textContent = ''; detailBody.textContent = ''; detailModal.style.display = 'flex'; try { const response = await fetch(`/api/news/${newsId}`); if (!response.ok) throw new Error(`無法獲取消息詳情 (HTTP ${response.status})`); const newsItem = await response.json(); detailImage.src = newsItem.image_url || '/images/placeholder.png'; detailImage.alt = newsItem.title || '消息圖片'; detailTitle.textContent = newsItem.title || '無標題'; let metaText = ''; if(newsItem.event_date) metaText += `活動日期: ${new Date(newsItem.event_date).toLocaleDateString()} | `; metaText += `更新時間: ${new Date(newsItem.updated_at).toLocaleString()}`; detailMeta.textContent = metaText; detailBody.textContent = newsItem.content || '沒有詳細內容。'; } catch (error) { console.error("加載消息詳情失敗:", error); detailTitle.textContent = '加載失敗'; detailBody.textContent = error.message; }
    }

    window.closeNewsDetailModal = function() {
        // ... (closeNewsDetailModal 函數內容不變) ...
         if (detailModal) { detailModal.style.display = 'none'; }
    }

    async function likeNews(newsId, likeButtonElement, countElement) {
        // ... (likeNews 函數內容不變) ...
        const isLiked = likeButtonElement.classList.contains('liked'); const currentCount = parseInt(countElement.textContent) || 0; if (isLiked) { console.log("已經按過讚了"); return; } else { likeButtonElement.classList.add('liked'); likeButtonElement.querySelector('.heart-icon').textContent = '♥'; countElement.textContent = currentCount + 1; likeButtonElement.disabled = true; } try { const response = await fetch(`/api/news/${newsId}/like`, { method: 'POST' }); if (!response.ok) { if (!isLiked) { likeButtonElement.classList.remove('liked'); likeButtonElement.querySelector('.heart-icon').textContent = '♡'; countElement.textContent = currentCount; } throw new Error(`按讚失敗 (HTTP ${response.status})`); } const data = await response.json(); if (data && data.like_count !== undefined) { countElement.textContent = data.like_count; likeButtonElement.classList.add('liked'); likeButtonElement.querySelector('.heart-icon').textContent = '♥'; } } catch (error) { console.error("按讚 API 請求失敗:", error); if (!isLiked) { likeButtonElement.classList.remove('liked'); likeButtonElement.querySelector('.heart-icon').textContent = '♡'; countElement.textContent = currentCount; } } finally { likeButtonElement.disabled = false; }
    }

    // Close Modal if User Clicks Outside
    window.onclick = function(event) { if (event.target == detailModal) { closeNewsDetailModal(); } }

    // --- 頁面初始加載 ---
    function initializePage() {
        console.log("News Page: Initializing..."); // 添加日誌
        fetchAndDisplayBanners(); // *** 新增：調用 Banner 函數 ***
        fetchNews(1);             // 加載第一頁新聞
        console.log("News Page: Initialization sequence complete."); // 添加日誌
    }

    initializePage(); // 執行初始化

 }); // End of DOMContentLoaded