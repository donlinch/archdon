// public/news-share.js
// 這個檔案用於 news-share.html，支援 ?id= 參數顯示新聞詳情

document.addEventListener('DOMContentLoaded', async () => {
    const contentArea = document.getElementById('news-content-area');
    const detailImage = document.getElementById('news-detail-image');
    const detailTitleElement = document.getElementById('news-detail-title');
    const detailMeta = document.getElementById('news-detail-meta');
    const detailBody = document.getElementById('news-detail-body');
    const loadingMessage = document.getElementById('loading-message');

    // --- 取得 ?id= 參數 ---
    function getNewsIdFromQuery() {
        const params = new URLSearchParams(window.location.search);
        return parseInt(params.get('id'));
    }
    const newsId = getNewsIdFromQuery();

    // --- ID 無效處理 ---
    if (isNaN(newsId)) {
        loadingMessage.textContent = '錯誤：網址缺少 ?id= 參數或格式錯誤。';
        loadingMessage.style.color = 'red';
        return;
    }

    // --- 獲取並填充新聞數據 ---
    try {
        const response = await fetch(`/api/news/${newsId}`);
        if (!response.ok) {
            let errorText = `無法載入新聞內容 (HTTP ${response.status})`;
            if (response.status === 404) errorText = '找不到指定的新聞。';
            else { try { const data = await response.json(); errorText += `: ${data.error || ''}`; } catch (e) {} }
            throw new Error(errorText);
        }

        const newsItem = await response.json();

        // 隱藏載入訊息
        loadingMessage.style.display = 'none';

        // --- 填充基本內容 ---
        if (newsItem.image_url) {
            detailImage.src = newsItem.image_url;
            detailImage.alt = newsItem.title || '新聞圖片';
            detailImage.style.display = 'block';
        }
        detailTitleElement.textContent = newsItem.title || '無標題';
        let metaText = '';
        if (newsItem.event_date) metaText += `活動日期: ${new Date(newsItem.event_date).toLocaleDateString('zh-TW')} | `;
        metaText += `更新時間: ${new Date(newsItem.updated_at).toLocaleString('zh-TW')}`;
        detailMeta.textContent = metaText;
        if (newsItem.content) {
            let contentToRender = newsItem.content || '';
            contentToRender = contentToRender.replace(/\n{3,}/g, "\n\n");
            contentToRender = contentToRender.replace(/<br>\s*<br>\s*<br>/gi, '<br><br>');
            contentToRender = contentToRender.replace(/<p>\s*<\/p>/gi, '');
            contentToRender = contentToRender.replace(/<\/p>\s*<p>/gi, '</p><p>');
            contentToRender = contentToRender.trim();
            contentToRender = contentToRender.replace(/\n/g, '');
            detailBody.innerHTML = contentToRender;
            const links = detailBody.querySelectorAll('a');
            links.forEach(link => {
                if (!link.hasAttribute('target')) {
                    link.setAttribute('target', '_blank');
                }
            });
        } else {
            detailBody.textContent = '沒有詳細內容。';
        }

        // 動態更新頁面 Title
        document.title = `${newsItem.title || 'SunnyYummy 新聞'} | SunnyYummy 新聞分享`;
    } catch (error) {
        console.error("載入新聞詳情失敗:", error);
        loadingMessage.textContent = `錯誤：${error.message}`;
        loadingMessage.style.color = 'red';
    }
}); 