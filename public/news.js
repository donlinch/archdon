// public/news.js
document.addEventListener('DOMContentLoaded', () => {
    const artistFilterNav = document.getElementById('artist-filter'); // news 頁面實際沒有用到，但保留以防複製錯誤
    const newsListContainer = document.getElementById('news-list');   // 獲取正確的列表容器 ID
    const paginationControls = document.getElementById('pagination-controls');
    const detailModal = document.getElementById('news-detail-modal');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailMeta = document.getElementById('detail-meta');
    const detailBody = document.getElementById('detail-body');


// --- 複製過來的 Banner 相關代碼 ---
const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
let bannerSwiper = null;

async function fetchAndDisplayBanners() {
    if (!bannerWrapper) {
        console.warn("Banner wrapper not found");
        return;
    }

    bannerWrapper.innerHTML = '<div class="swiper-slide">載入中...</div>';

    try {
        const response = await fetch('/api/banners?page=news');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const banners = await response.json();
        bannerWrapper.innerHTML = '';

        if (banners.length === 0) {
            bannerWrapper.innerHTML = `
                <div class="swiper-slide">
                    <img src="/images/default-banner.jpg" alt="預設 Banner">
                </div>
            `;
        } else {
            banners.forEach(banner => {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                // ...slide 內容構建...
                bannerWrapper.appendChild(slide);
            });
        }

        // 確保 Swiper 容器可見
        document.getElementById('banner-carousel').style.display = 'block';
        
        // 初始化 Swiper
        if (bannerSwiper) bannerSwiper.destroy();
        bannerSwiper = new Swiper('#banner-carousel', {
            loop: banners.length > 1,
            autoplay: { delay: 12000 },
            pagination: { el: '.swiper-pagination' },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            observer: true
        });

    } catch (error) {
        console.error("Banner 錯誤:", error);
        bannerWrapper.innerHTML = `
            <div class="swiper-slide error-slide">
                輪播加載失敗: ${error.message}
            </div>
        `;
    }
}



    let currentPage = 1;
    const itemsPerPage = 10; // 每頁顯示數量

    /**
     * 獲取並顯示指定頁數的消息
     * @param {number} page - 要獲取的頁碼
     */
    async function fetchNews(page = 1) {
        if (!newsListContainer || !paginationControls) {
            console.error("頁面缺少列表或分頁容器元素。");
            return;
        }
        currentPage = page;
        newsListContainer.innerHTML = '<p>正在加載最新消息...</p>';
        paginationControls.innerHTML = '';

        try {
            const response = await fetch(`/api/news?page=${page}&limit=${itemsPerPage}`);
            if (!response.ok) throw new Error(`獲取消息失敗 (HTTP ${response.status})`);
            const data = await response.json();

            displayNews(data.news);
            renderPagination(data.totalPages, data.currentPage);

        } catch (error) {
            console.error("獲取或顯示消息時出錯:", error);
            if (newsListContainer) newsListContainer.innerHTML = '<p>無法加載消息。</p>';
        }
    }

    /**
     * 渲染消息列表
     * @param {Array} newsList - 消息物件陣列
     */
    function displayNews(newsList) {
        if (!newsListContainer) return;
        newsListContainer.innerHTML = '';

        if (newsList.length === 0) {
            newsListContainer.innerHTML = '<p>目前沒有最新消息。</p>';
            return;
        }

        newsList.forEach(newsItem => {
            // 卡片是 div
            const card = document.createElement('div');
            card.className = 'news-card';

            // 1. 日期標籤
            const dateTag = document.createElement('div');
            dateTag.className = 'date-tag';
            if (newsItem.event_date) {
                const eventDate = new Date(newsItem.event_date);
                const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
                const dayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
                dateTag.innerHTML = `
                    <span class="month">${monthNames[eventDate.getMonth()]}</span>
                    <span class="day">${eventDate.getDate()}</span>
                    <span class="weekday">${dayNames[eventDate.getDay()]}</span>
                `;
            } else {
                const updatedDate = new Date(newsItem.updated_at);
                 dateTag.innerHTML = `
                    <span class="month">${updatedDate.getMonth() + 1}月</span>
                    <span class="day">${updatedDate.getDate()}</span>
                    <span class="weekday">更新</span>`;
            }

            // 2. 縮圖
            const thumbnailDiv = document.createElement('div');
            thumbnailDiv.className = 'thumbnail';
            const thumbnailImg = document.createElement('img');
            thumbnailImg.src = newsItem.thumbnail_url || '/images/placeholder.png';
            thumbnailImg.alt = newsItem.title || '縮圖';
            thumbnailDiv.appendChild(thumbnailImg);

            // 3. 主要內容區
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'content-wrapper';
            // *** 將打開 Modal 的點擊事件綁定到這裡 ***
            contentWrapper.onclick = () => openNewsDetailModal(newsItem.id);
            contentWrapper.style.cursor = 'pointer'; // 添加手型指標

            const titleH3 = document.createElement('h3');
            titleH3.className = 'news-title';
            titleH3.textContent = newsItem.title || '無標題';
            const summaryP = document.createElement('p');
            summaryP.className = 'news-summary';
            summaryP.textContent = newsItem.summary || '';
            contentWrapper.appendChild(titleH3);
            contentWrapper.appendChild(summaryP);


            // 4. 互動區 (按讚)
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions';
            const likeButton = document.createElement('button');
            likeButton.className = 'like-button';
            likeButton.innerHTML = '<span class="heart-icon">♡</span>'; // 初始空心
            const likeCountSpan = document.createElement('span');
            likeCountSpan.className = 'like-count';
            likeCountSpan.textContent = newsItem.like_count || 0;

            // 按讚按鈕事件 - 阻止冒泡很重要
            likeButton.onclick = async (event) => {
                 event.stopPropagation(); // 阻止事件冒泡到 contentWrapper 的 onclick
                 await likeNews(newsItem.id, likeButton, likeCountSpan);
            };

            actionsDiv.appendChild(likeButton);
            actionsDiv.appendChild(likeCountSpan);

            // *** 按正確順序添加到 card ***
            card.appendChild(dateTag);
            card.appendChild(thumbnailDiv);
            card.appendChild(contentWrapper); // 主要內容在中間
            card.appendChild(actionsDiv);     // 按讚區塊在最右邊

            newsListContainer.appendChild(card);
        });
    }

    /**
     * 渲染分頁控制按鈕
     * @param {number} totalPages - 總頁數
     * @param {number} currentPage - 當前頁碼
     */
    function renderPagination(totalPages, currentPage) {
        if (!paginationControls) return;
        paginationControls.innerHTML = '';
        if (totalPages <= 1) return;

        const createPageButton = (pageNumber, text = pageNumber, isActive = false, isDisabled = false) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.disabled = isDisabled;
            if (isActive) { button.classList.add('active'); }
            else { button.onclick = () => fetchNews(pageNumber); }
            return button;
        };

        paginationControls.appendChild(createPageButton(currentPage - 1, '上一頁', false, currentPage === 1));
        // 簡單分頁邏輯：顯示所有頁碼 (如果頁數多需要改進)
        for (let i = 1; i <= totalPages; i++) {
            paginationControls.appendChild(createPageButton(i, i, i === currentPage));
        }
        paginationControls.appendChild(createPageButton(currentPage + 1, '下一頁', false, currentPage === totalPages));
    }


     /**
      * 打開並填充消息詳情 Modal
      * @param {number} newsId - 要顯示的消息 ID
      */
     async function openNewsDetailModal(newsId) {
         if (!detailModal || !detailImage || !detailTitle || !detailMeta || !detailBody) { console.error("缺少詳情 Modal 的必要元素。"); return; }
         detailImage.src = ''; detailTitle.textContent = '加載中...'; detailMeta.textContent = ''; detailBody.textContent = ''; // 用 textContent 清空
         detailModal.style.display = 'flex';

         try {
             const response = await fetch(`/api/news/${newsId}`);
             if (!response.ok) throw new Error(`無法獲取消息詳情 (HTTP ${response.status})`);
             const newsItem = await response.json();

             detailImage.src = newsItem.image_url || '/images/placeholder.png';
             detailImage.alt = newsItem.title || '消息圖片';
             detailTitle.textContent = newsItem.title || '無標題';
             let metaText = '';
             if(newsItem.event_date) metaText += `活動日期: ${new Date(newsItem.event_date).toLocaleDateString()} | `;
             metaText += `更新時間: ${new Date(newsItem.updated_at).toLocaleString()}`;
             detailMeta.textContent = metaText;
             // 使用 textContent 設置內容以避免潛在的 XSS 風險，除非你確定 content 是安全的 HTML
             detailBody.textContent = newsItem.content || '沒有詳細內容。';
             // 如果 content 確定是安全的 HTML: detailBody.innerHTML = newsItem.content || '沒有詳細內容。';

         } catch (error) {
             console.error("加載消息詳情失敗:", error);
             detailTitle.textContent = '加載失敗';
             detailBody.textContent = error.message;
         }
     }

     /**
      * 關閉消息詳情 Modal
      */
     window.closeNewsDetailModal = function() { if (detailModal) { detailModal.style.display = 'none'; } }


    /**
     * 處理按讚請求
     * @param {number} newsId - 被按讚的消息 ID
     * @param {HTMLElement} likeButtonElement - 被點擊的按鈕元素
     * @param {HTMLElement} countElement - 顯示數量的元素
     */
    async function likeNews(newsId, likeButtonElement, countElement) {
        const isLiked = likeButtonElement.classList.contains('liked');
        const currentCount = parseInt(countElement.textContent) || 0;

        if (isLiked) { console.log("已經按過讚了"); return; } // 暫不處理取消讚
        else { // 前端樂觀更新 (Optimistic Update)
             likeButtonElement.classList.add('liked');
             likeButtonElement.querySelector('.heart-icon').textContent = '♥';
             countElement.textContent = currentCount + 1;
             likeButtonElement.disabled = true; // 暫時禁用
        }

        try {
            const response = await fetch(`/api/news/${newsId}/like`, { method: 'POST' });
            if (!response.ok) {
                 // API 失敗，恢復前端狀態
                 if (!isLiked) { likeButtonElement.classList.remove('liked'); likeButtonElement.querySelector('.heart-icon').textContent = '♡'; countElement.textContent = currentCount; }
                 throw new Error(`按讚失敗 (HTTP ${response.status})`);
            }
            const data = await response.json(); // 獲取後端返回的真實數量
            if (data && data.like_count !== undefined) {
                countElement.textContent = data.like_count; // 更新為真實數量
                // 確保狀態正確 (防止極端情況下 API 成功但前端未更新)
                likeButtonElement.classList.add('liked');
                likeButtonElement.querySelector('.heart-icon').textContent = '♥';
            }
        } catch (error) {
             console.error("按讚 API 請求失敗:", error);
             // API 失敗，恢復前端狀態
             if (!isLiked) { likeButtonElement.classList.remove('liked'); likeButtonElement.querySelector('.heart-icon').textContent = '♡'; countElement.textContent = currentCount; }
             // 可以選擇性地 alert 提示用戶
             // alert(`按讚失敗: ${error.message}`);
        } finally {
             likeButtonElement.disabled = false; // 重新啟用按鈕
        }
    }

    // --- Close Modal if User Clicks Outside ---
    window.onclick = function(event) { if (event.target == detailModal) { closeNewsDetailModal(); } }

     // --- 頁面初始加載 ---
     fetchNews(1);

 }); // End of DOMContentLoaded