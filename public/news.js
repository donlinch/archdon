// public/news.js (加入 displayNews 內部詳細日誌)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References --- (保持不變)
    const newsListContainer = document.getElementById('news-list');
    const paginationControls = document.getElementById('pagination-controls');
    const detailModal = document.getElementById('news-detail-modal');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailMeta = document.getElementById('detail-meta');
    const detailBody = document.getElementById('detail-body');
    const bannerWrapper = document.querySelector('#banner-carousel .swiper-wrapper');
    let bannerSwiper = null;

    // --- Banner Function --- (保持不變)
    async function fetchAndDisplayBanners(pageIdentifier = 'news') { /* ... */ }
    // --- Banner 代碼結束 ---


    // --- News specific variables and functions ---
    let currentPage = 1;
    const itemsPerPage = 10;

    async function fetchNews(page = 1) {
        console.log(`[News List DEBUG] fetchNews called for page ${page}.`);
        if (!newsListContainer || !paginationControls) { /* ... */ return; }
        currentPage = page;
        newsListContainer.innerHTML = '<p>正在加載最新消息...</p>';
        paginationControls.innerHTML = '';

        try {
            console.log(`[News List DEBUG] Attempting to fetch: /api/news?page=${page}&limit=${itemsPerPage}`);
            const response = await fetch(`/api/news?page=${page}&limit=${itemsPerPage}`);
            console.log(`[News List DEBUG] API Response Status: ${response.status}`);

            if (!response.ok) {
                 let errorText = `獲取消息失敗 (HTTP ${response.status})`;
                 try { const errorData = await response.json(); errorText += `: ${errorData.error || 'No specific error.'}`; } catch(e) { errorText += `: ${response.statusText || 'Failed to parse error.'}`; }
                 console.error("[News List DEBUG] Fetch failed:", errorText);
                 throw new Error(errorText);
            }

            console.log("[News List DEBUG] Fetch successful, attempting to parse JSON...");
            const data = await response.json();
            console.log("[News List DEBUG] JSON parsed successfully:", data);

            console.log("[News List DEBUG] Calling displayNews..."); // **日誌 6**
            displayNews(data.news); // 顯示新聞內容
            console.log("[News List DEBUG] displayNews finished."); // **新增日誌 6.5**

            console.log("[News List DEBUG] Calling renderPagination..."); // **日誌 7**
            renderPagination(data.totalPages, data.currentPage); // 渲染分頁按鈕
            console.log("[News List DEBUG] renderPagination finished."); // **新增日誌 7.5**

            console.log("[News List DEBUG] fetchNews finished successfully."); // **日誌 8**

        } catch (error) {
            console.error("[News List DEBUG] Error caught in fetchNews:", error);
            if (newsListContainer) { newsListContainer.innerHTML = `<p>無法加載消息: ${error.message}</p>`; }
        }
    }

    // *** 修改 displayNews 加入詳細日誌 ***
    function displayNews(newsList) {
        console.log("[News List DEBUG - displayNews] Called with newsList:", newsList); // **Log D1**
        if (!newsListContainer) {
             console.error("[News List DEBUG - displayNews] newsListContainer is null!");
             return;
        }
        console.log("[News List DEBUG - displayNews] Clearing newsListContainer innerHTML..."); // **Log D2**
        newsListContainer.innerHTML = ''; // 清空 '正在加載...'

        if (!newsList || newsList.length === 0) {
            console.log("[News List DEBUG - displayNews] newsList is empty, showing 'no news' message."); // **Log D3a**
            newsListContainer.innerHTML = '<p>目前沒有最新消息。</p>';
            return;
        }

        console.log(`[News List DEBUG - displayNews] Starting to loop through ${newsList.length} news items.`); // **Log D3b**
        newsList.forEach((newsItem, index) => {
            try { // 在循環的每一步周圍加上 try...catch
                console.log(`[News List DEBUG - displayNews] Processing item ${index}, ID: ${newsItem.id}`); // **Log D4**

                const card = document.createElement('div');
                card.className = 'news-card';

                // 1. Date Tag
                console.log(`[News List DEBUG - displayNews] Creating date tag for item ${index}...`); // **Log D4.1**
                const dateTag = document.createElement('div');
                dateTag.className = 'date-tag';
                if (newsItem.event_date) {
                    const eventDate = new Date(newsItem.event_date);
                    // ... (處理 event_date) ...
                     const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]; const dayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]; dateTag.innerHTML = `<span class="month">${monthNames[eventDate.getMonth()]}</span><span class="day">${eventDate.getDate()}</span><span class="weekday">${dayNames[eventDate.getDay()]}</span>`;
                } else if (newsItem.updated_at) { // 添加對 updated_at 的檢查
                    const updatedDate = new Date(newsItem.updated_at);
                    dateTag.innerHTML = `<span class="month">${updatedDate.getMonth() + 1}月</span><span class="day">${updatedDate.getDate()}</span><span class="weekday">更新</span>`;
                } else {
                     dateTag.innerHTML = `<span class="month">--</span><span class="day">--</span><span class="weekday">未知</span>`; // 預設顯示
                }

                // 2. Thumbnail
                console.log(`[News List DEBUG - displayNews] Creating thumbnail for item ${index}...`); // **Log D4.2**
                const thumbnailDiv = document.createElement('div');
                thumbnailDiv.className = 'thumbnail';
                const thumbnailImg = document.createElement('img');
                thumbnailImg.src = newsItem.thumbnail_url || '/images/placeholder.png';
                thumbnailImg.alt = newsItem.title || '縮圖';
                thumbnailDiv.appendChild(thumbnailImg);

                // 3. Content Wrapper
                console.log(`[News List DEBUG - displayNews] Creating content wrapper for item ${index}...`); // **Log D4.3**
                const contentWrapper = document.createElement('div');
                contentWrapper.className = 'content-wrapper';
                const titleH3 = document.createElement('h3');
                titleH3.className = 'news-title';
                titleH3.textContent = newsItem.title || '無標題';
                const summaryP = document.createElement('p');
                summaryP.className = 'news-summary';
                summaryP.textContent = newsItem.summary || '';
                contentWrapper.appendChild(titleH3);
                contentWrapper.appendChild(summaryP);
                contentWrapper.onclick = () => openNewsDetailModal(newsItem.id);
                contentWrapper.style.cursor = 'pointer';

                // 4. Actions (Like)
                console.log(`[News List DEBUG - displayNews] Creating actions for item ${index}...`); // **Log D4.4**
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'actions';
                const likeButton = document.createElement('button');
                likeButton.className = 'like-button';
                likeButton.innerHTML = '<span class="heart-icon">♡</span>';
                const likeCountSpan = document.createElement('span');
                likeCountSpan.className = 'like-count';
                likeCountSpan.textContent = newsItem.like_count || 0;
                likeButton.onclick = async (event) => {
                    event.stopPropagation();
                    await likeNews(newsItem.id, likeButton, likeCountSpan);
                };
                actionsDiv.appendChild(likeButton);
                actionsDiv.appendChild(likeCountSpan);

                // Appending elements to card
                console.log(`[News List DEBUG - displayNews] Appending elements to card for item ${index}...`); // **Log D5**
                card.appendChild(dateTag);
                card.appendChild(thumbnailDiv);
                card.appendChild(contentWrapper);
                card.appendChild(actionsDiv);

                // Appending card to container
                newsListContainer.appendChild(card);
                console.log(`[News List DEBUG - displayNews] Appended card for item ${index}.`); // **Log D6**

            } catch (loopError) {
                 // 如果循環內部出錯，會打印錯誤
                 console.error(`[News List DEBUG - displayNews] Error processing item at index ${index}:`, loopError);
            }
        });
         console.log("[News List DEBUG - displayNews] Finished looping through news items."); // **Log D7**
    }

    // --- renderPagination, openNewsDetailModal, etc. (保持不變) ---
    function renderPagination(totalPages, currentPage) { /* ... */ }
    async function openNewsDetailModal(newsId) { /* ... */ }
    window.closeNewsDetailModal = function() { /* ... */ }
    async function likeNews(newsId, likeButtonElement, countElement) { /* ... */ }
    window.onclick = function(event) { if (event.target == detailModal) { closeNewsDetailModal(); } }


    // --- 頁面初始加載 --- (保持不變)
    async function initializePage() {
        console.log("News Page: Initializing...");
        try {
            await fetchAndDisplayBanners('news');
            await fetchNews(1);
            console.log("News Page: Initialization sequence complete.");
        } catch (error) {
            console.error("Error during page initialization:", error);
        }
    }
    initializePage();

 }); // End of DOMContentLoaded