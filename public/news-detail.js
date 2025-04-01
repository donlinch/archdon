// public/news-detail.js (示意)
document.addEventListener('DOMContentLoaded', async () => {
    const contentArea = document.getElementById('news-content-area');
    const detailImage = document.getElementById('news-detail-image');
    const detailTitle = document.getElementById('news-detail-title');
    const detailMeta = document.getElementById('news-detail-meta');
    const detailBody = document.getElementById('news-detail-body');
    const loadingMessage = contentArea.querySelector('p');

    function getNewsIdFromUrl() {
        const pathSegments = window.location.pathname.split('/');
        // 獲取路徑的最後一部分，並嘗試轉為數字
        const potentialId = pathSegments.pop() || pathSegments.pop(); // 處理結尾可能有 / 的情況
        return parseInt(potentialId);
    }

    const newsId = getNewsIdFromUrl();

    if (isNaN(newsId)) {
        loadingMessage.textContent = '錯誤：無效的新聞 ID。';
        console.error("Invalid News ID in URL");
        return;
    }

    try {
        const response = await fetch(`/api/news/${newsId}`);
        if (!response.ok) {
             let errorText = `無法載入新聞內容 (HTTP ${response.status})`;
             if (response.status === 404) errorText = '找不到指定的新聞。';
             else { try { const data = await response.json(); errorText += `: ${data.error || ''}`; } catch(e){} }
             throw new Error(errorText);
        }

        const newsItem = await response.json();

        // 隱藏載入訊息
        loadingMessage.style.display = 'none';

        // 填充內容
        if (newsItem.image_url) {
            detailImage.src = newsItem.image_url;
            detailImage.alt = newsItem.title || '新聞圖片';
            detailImage.style.display = 'block';
        } else {
             detailImage.style.display = 'none';
        }

        detailTitle.textContent = newsItem.title || '無標題';

        let metaText = '';
        if (newsItem.event_date) metaText += `活動日期: ${new Date(newsItem.event_date).toLocaleDateString('zh-TW')} | `;
        metaText += `更新時間: ${new Date(newsItem.updated_at).toLocaleString('zh-TW')}`;
        detailMeta.textContent = metaText;

        // 使用 textContent 以防止 XSS，如果內容確定是安全的 HTML，可以用 innerHTML
        detailBody.textContent = newsItem.content || '沒有詳細內容。';
        // 如果 content 可能包含換行，可以使用 pre-wrap 樣式或替換換行符為 <br>
        // detailBody.style.whiteSpace = 'pre-wrap';


    } catch (error) {
        console.error("載入新聞詳情失敗:", error);
        loadingMessage.textContent = `錯誤：${error.message}`;
        loadingMessage.style.color = 'red';
    }
});