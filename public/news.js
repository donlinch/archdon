// public/news.js
document.addEventListener('DOMContentLoaded', () => {
    const newsListContainer = document.getElementById('news-list');
    const paginationControls = document.getElementById('pagination-controls');
    const detailModal = document.getElementById('news-detail-modal');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailMeta = document.getElementById('detail-meta');
    const detailBody = document.getElementById('detail-body');

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
        currentPage = page; // 更新當前頁碼
        newsListContainer.innerHTML = '<p>正在加載最新消息...</p>'; // 顯示加載訊息
        paginationControls.innerHTML = ''; // 清空分頁

        try {
            const response = await fetch(`/api/news?page=${page}&limit=${itemsPerPage}`);
            if (!response.ok) throw new Error(`獲取消息失敗 (HTTP ${response.status})`);
            const data = await response.json(); // { totalItems, totalPages, currentPage, news: [...] }

            displayNews(data.news); // 顯示消息列表
            renderPagination(data.totalPages, data.currentPage); // 渲染分頁控制

        } catch (error) {
            console.error("獲取或顯示消息時出錯:", error);
            newsListContainer.innerHTML = '<p>無法加載消息。</p>';
        }
    }

    /**
     * 渲染消息列表
     * @param {Array} newsList - 消息物件陣列
     */
    function displayNews(newsList) {
        newsListContainer.innerHTML = ''; // 清空容器

        if (newsList.length === 0) {
            newsListContainer.innerHTML = '<p>目前沒有最新消息。</p>';
            return;
        }

        newsList.forEach(newsItem => {
            const card = document.createElement('div');
            card.className = 'news-card';
            // *** 讓整個卡片可點擊打開 Modal ***
            card.onclick = () => openNewsDetailModal(newsItem.id);

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
                // 如果沒有活動日期，可以顯示發布日期或其他
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

            // 3. 內容區
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'content-wrapper';

            const titleH3 = document.createElement('h3');
            titleH3.className = 'news-title';
            titleH3.textContent = newsItem.title || '無標題';

            const summaryP = document.createElement('p');
            summaryP.className = 'news-summary';
            summaryP.textContent = newsItem.summary || '';

            // 4. 互動區 (愛心按鈕)
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions';
            const likeButton = document.createElement('button');
            likeButton.className = 'like-button';
            likeButton.innerHTML = '<span class="heart-icon">♡</span>'; // 初始是空心
            const likeCountSpan = document.createElement('span');
            likeCountSpan.className = 'like-count';
            likeCountSpan.textContent = newsItem.like_count || 0;

            // --- 按讚按鈕的點擊事件 ---
            likeButton.onclick = async (event) => {
                 event.stopPropagation(); // *** 阻止事件冒泡到卡片點擊 ***
                 likeNews(newsItem.id, likeButton, likeCountSpan);
            };

            actionsDiv.appendChild(likeButton);
            actionsDiv.appendChild(likeCountSpan);

            contentWrapper.appendChild(titleH3);
            contentWrapper.appendChild(summaryP);
            contentWrapper.appendChild(actionsDiv);

            // 組合卡片
            card.appendChild(dateTag);
            card.appendChild(thumbnailDiv);
            card.appendChild(contentWrapper);

            newsListContainer.appendChild(card);
        });
    }

   /**
    * 渲染分頁控制按鈕
    * @param {number} totalPages - 總頁數
    * @param {number} currentPage - 當前頁碼
    */
   function renderPagination(totalPages, currentPage) {
       paginationControls.innerHTML = ''; // 清空舊按鈕
       if (totalPages <= 1) return; // 只有一頁或沒有內容，則不顯示分頁

       const createPageButton = (pageNumber, text = pageNumber, isActive = false, isDisabled = false) => {
           const button = document.createElement('button');
           button.textContent = text;
           button.disabled = isDisabled;
           if (isActive) {
               button.classList.add('active');
           } else {
               button.onclick = () => fetchNews(pageNumber);
           }
           return button;
       };

       // 上一頁按鈕
       paginationControls.appendChild(createPageButton(currentPage - 1, '上一頁', false, currentPage === 1));

       // 頁碼按鈕 (可以添加省略邏輯，但我們先做簡單的)
       for (let i = 1; i <= totalPages; i++) {
           // 簡單顯示所有頁碼，如果頁數過多可以加入省略邏輯
           // 例如: 只顯示當前頁前後幾頁，以及第一頁和最後一頁
           paginationControls.appendChild(createPageButton(i, i, i === currentPage));
       }

       // 下一頁按鈕
       paginationControls.appendChild(createPageButton(currentPage + 1, '下一頁', false, currentPage === totalPages));
   }


    /**
     * 打開並填充消息詳情 Modal
     * @param {number} newsId - 要顯示的消息 ID
     */
    async function openNewsDetailModal(newsId) {
        if (!detailModal || !detailImage || !detailTitle || !detailMeta || !detailBody) {
            console.error("缺少詳情 Modal 的必要元素。");
            return;
        }
        // 清空舊內容
        detailImage.src = '';
        detailTitle.textContent = '加載中...';
        detailMeta.textContent = '';
        detailBody.innerHTML = '';
        detailModal.style.display = 'flex'; // 顯示 Modal

        try {
            const response = await fetch(`/api/news/${newsId}`);
            if (!response.ok) throw new Error(`無法獲取消息詳情 (HTTP ${response.status})`);
            const newsItem = await response.json();

            detailImage.src = newsItem.image_url || '/images/placeholder.png'; // 使用大圖 URL
            detailImage.alt = newsItem.title || '消息圖片';
            detailTitle.textContent = newsItem.title || '無標題';
            // 組合 Meta 信息
            let metaText = '';
            if(newsItem.event_date) metaText += `活動日期: ${new Date(newsItem.event_date).toLocaleDateString()} | `;
            metaText += `更新時間: ${new Date(newsItem.updated_at).toLocaleString()}`;
            detailMeta.textContent = metaText;
            detailBody.textContent = newsItem.content || '沒有詳細內容。'; // 使用 textContent 避免 XSS

        } catch (error) {
            console.error("加載消息詳情失敗:", error);
            detailTitle.textContent = '加載失敗';
            detailBody.textContent = error.message;
        }
    }

    /**
     * 關閉消息詳情 Modal
     */
    window.closeNewsDetailModal = function() { // 綁定到 window 讓 HTML onclick 可以調用
        if (detailModal) {
            detailModal.style.display = 'none';
        }
    }


   /**
    * 處理按讚請求
    * @param {number} newsId - 被按讚的消息 ID
    * @param {HTMLElement} likeButtonElement - 被點擊的按鈕元素
    * @param {HTMLElement} countElement - 顯示數量的元素
    */
   async function likeNews(newsId, likeButtonElement, countElement) {
       // (可選) 前端立即反饋：改變圖標和數量
       const isLiked = likeButtonElement.classList.contains('liked');
       const currentCount = parseInt(countElement.textContent) || 0;

       if (isLiked) {
            // 如果已經是 liked 狀態，這裡可以選擇不做任何事，或者實現取消讚
            console.log("已經按過讚了 (或取消讚功能未實現)");
            return; // 暫時不做取消讚
       } else {
            likeButtonElement.classList.add('liked'); // 添加 liked class
            likeButtonElement.querySelector('.heart-icon').textContent = '♥'; // 變實心
            countElement.textContent = currentCount + 1; // 數量 +1
            likeButtonElement.disabled = true; // 暫時禁用按鈕防止重複點擊
       }


       try {
           const response = await fetch(`/api/news/${newsId}/like`, { method: 'POST' });

           if (!response.ok) {
               // 如果 API 失敗，嘗試恢復前端狀態
                if (!isLiked) { // 只有在原本未按讚的情況下才恢復
                    likeButtonElement.classList.remove('liked');
                    likeButtonElement.querySelector('.heart-icon').textContent = '♡';
                    countElement.textContent = currentCount;
                }
                throw new Error(`按讚失敗 (HTTP ${response.status})`);
           }

           // API 成功，可以選擇用 API 返回的數字更新 (更準確)
           const data = await response.json(); // { like_count: newCount }
           if (data && data.like_count !== undefined) {
               countElement.textContent = data.like_count;
                // 確保是 liked 狀態 (如果 API 更新成功)
                likeButtonElement.classList.add('liked');
                likeButtonElement.querySelector('.heart-icon').textContent = '♥';
           }

       } catch (error) {
            console.error("按讚 API 請求失敗:", error);
            // 可以在這裡提示用戶按讚失敗
            // 恢復前端狀態
             if (!isLiked) {
                likeButtonElement.classList.remove('liked');
                likeButtonElement.querySelector('.heart-icon').textContent = '♡';
                countElement.textContent = currentCount;
            }
       } finally {
            likeButtonElement.disabled = false; // 無論成功失敗都重新啟用按鈕
       }
   }

   // --- Close Modal if User Clicks Outside ---
   window.onclick = function(event) {
       if (event.target == detailModal) { // 點擊 Modal 背景
           closeNewsDetailModal();
       }
       // 保留之前的 Modal 關閉邏輯 (如果需要)
       // else if (event.target == editModal) { closeModal(); }
       // else if (event.target == addModal) { closeAddModal(); }
   }

    // --- 頁面初始加載 ---
    fetchNews(1); // 預設加載第一頁

}); // End of DOMContentLoaded