// public/news-share.js
// 這個檔案用於 news-share.html，支援 ?id= 參數顯示新聞詳情

document.addEventListener('DOMContentLoaded', async () => {
    const contentArea = document.getElementById('news-content-area');
    const detailImage = document.getElementById('detail-image');
    const detailTitleElement = document.getElementById('news-detail-title');
    const detailMeta = document.getElementById('news-detail-meta');
    const detailBody = document.getElementById('news-detail-body');
    const loadingMessage = document.getElementById('loading-message');

    console.log('loadingMessage:', loadingMessage);

    // --- 取得 ?id= 參數 ---
    function getNewsIdFromQuery() {
        const params = new URLSearchParams(window.location.search);
        return parseInt(params.get('id'));
    }
    const newsId = getNewsIdFromQuery();

    // --- ID 無效處理 ---
    if (isNaN(newsId)) {
        if (loadingMessage) {
            loadingMessage.textContent = '錯誤：網址缺少 ?id= 參數或格式錯誤。';
            loadingMessage.style.color = 'red';
        }
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
        if (loadingMessage) loadingMessage.style.display = 'none';

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

            // 1. 移除多餘的空行
            contentToRender = contentToRender.replace(/\n{3,}/g, "\n\n");

            // 2. 多餘 <br> 合併
            contentToRender = contentToRender.replace(/(<br>[\s]*){2,}/gi, '<br>');

            // 3. 空段落處理
            contentToRender = contentToRender.replace(/<p>\s*<\/p>/gi, '');

            // 4. 標準化段落間距
            contentToRender = contentToRender.replace(/<\/p>\s*<p>/gi, '</p><p>');

            // 5. 移除段落前後多餘空白
            contentToRender = contentToRender.trim();

            // 6. 移除所有換行符（避免多餘空白）
            contentToRender = contentToRender.replace(/\n+/g, '');

            // 7. 移除段落開頭和結尾的 <br>
            contentToRender = contentToRender.replace(/^(<br\s*\/?>)+/i, '');
            contentToRender = contentToRender.replace(/(<br\s*\/?>)+$/i, '');

            // 8. 移除多餘的空白字元
            contentToRender = contentToRender.replace(/&nbsp;/g, ' ');

            // 9. 最後再 trim 一次
            contentToRender = contentToRender.trim();

            // 渲染處理後的內容
            if (detailBody) {
                detailBody.innerHTML = contentToRender;
                // 確保所有鏈接在新標籤打開
                const links = detailBody.querySelectorAll('a');
                links.forEach(link => {
                    if (!link.hasAttribute('target')) {
                        link.setAttribute('target', '_blank');
                    }
                });
            }
        } else {
            if (detailBody) {
                detailBody.textContent = '沒有詳細內容。';
            }
        }

        // 動態更新頁面 Title
        document.title = `${newsItem.title || 'SunnyYummy 新聞'} | SunnyYummy 新聞分享`;
    } catch (error) {
        console.error("載入新聞詳情失敗:", error);
        if (loadingMessage) {
            loadingMessage.textContent = `錯誤：${error.message}`;
            loadingMessage.style.color = 'red';
        } else {
            alert(`載入新聞詳情失敗：${error.message}`);
        }
    }
}); 