// public/news-detail.js
document.addEventListener('DOMContentLoaded', async () => {
    const contentArea = document.getElementById('news-content-area');
    const detailImage = document.getElementById('news-detail-image');
    const detailTitleElement = document.getElementById('news-detail-title');
    const detailMeta = document.getElementById('news-detail-meta');
    const detailBody = document.getElementById('news-detail-body');
    const loadingMessage = contentArea.querySelector('p');

    // 分享元素
    const shareSection = document.querySelector('.news-share'); // 獲取整個分享區塊
    const facebookShareLink = document.getElementById('share-facebook');
    const threadsCopyButton = document.getElementById('share-threads-copy');
    const instagramProfileLink = document.getElementById('share-instagram-profile');

    // --- 獲取新聞 ID ---
    function getNewsIdFromUrl() {
        const pathSegments = window.location.pathname.split('/');
        const potentialId = pathSegments.pop() || pathSegments.pop();
        return parseInt(potentialId);
    }
    const newsId = getNewsIdFromUrl();

    // --- 初始隱藏分享區塊 ---
    if (shareSection) shareSection.style.display = 'none';

    // --- ID 無效處理 ---
    if (isNaN(newsId)) {
        loadingMessage.textContent = '錯誤：無效的新聞 ID。';
        console.error("Invalid News ID in URL");
        return; // 不再執行後續 fetch
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
            detailImage.style.display = 'block'; // 顯示圖片
        }
        detailTitleElement.textContent = newsItem.title || '無標題';
        let metaText = '';
        if (newsItem.event_date) metaText += `活動日期: ${new Date(newsItem.event_date).toLocaleDateString('zh-TW')} | `;
        metaText += `更新時間: ${new Date(newsItem.updated_at).toLocaleString('zh-TW')}`;
        detailMeta.textContent = metaText;
        if (newsItem.content) {
            // Process content as in news.html
            let contentToRender = newsItem.content || '';
            
            // 處理可能的文字格式問題
            // 1. 移除多餘的空行
            contentToRender = contentToRender.replace(/\n{3,}/g, "\n\n");
            
            // 2. 確保 <br> 標籤不會產生多餘的空行
            contentToRender = contentToRender.replace(/<br>\s*<br>\s*<br>/gi, '<br><br>');
            
            // 3. 空段落處理
            contentToRender = contentToRender.replace(/<p>\s*<\/p>/gi, '');
            
            // 4. 標準化段落間距
            contentToRender = contentToRender.replace(/<\/p>\s*<p>/gi, '</p><p>');
            
            // 5. 處理可能的空白問題
            contentToRender = contentToRender.trim();
            
            // 添加這一步來完全移除所有換行符
            contentToRender = contentToRender.replace(/\n/g, '');
            
            // 渲染處理後的內容
            detailBody.innerHTML = contentToRender;
            
            // 確保所有鏈接在新標籤打開
            const links = detailBody.querySelectorAll('a');
            links.forEach(link => {
                if (!link.hasAttribute('target')) {
                    link.setAttribute('target', '_blank');
                }
            });
        } else {
            detailBody.textContent = '沒有詳細內容。';
        }

        // --- 處理分享連結和 Meta ---
        const currentPageUrl = window.location.href;
        const shareTitle = newsItem.title || 'SunnyYummy 最新消息';
        // OG Image 優先使用新聞大圖，其次縮圖，最後通用圖
        const shareImageUrl = newsItem.image_url || newsItem.thumbnail_url || 'https://sunnyyummy.onrender.com/images/share-preview.jpg';

        // 1. 更新頁面 Title
        document.title = `${shareTitle} | SunnyYummy 新聞`;

        // 2. 更新 Open Graph Meta 標籤
        updateMetaTag('property', 'og:title', shareTitle);
        updateMetaTag('property', 'og:url', currentPageUrl);
        updateMetaTag('property', 'og:image', shareImageUrl);
        if (newsItem.summary) { // 更新描述 (如果新聞有摘要)
           updateMetaTag('property', 'og:description', newsItem.summary);
        }

        // 3. 設定 Facebook 分享連結
        if (facebookShareLink) {
            const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentPageUrl)}`;
            facebookShareLink.href = facebookShareUrl;
        }

        // 4. 設定 Threads 複製連結按鈕
        if (threadsCopyButton) {
            threadsCopyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(currentPageUrl).then(() => {
                    // 複製成功提示
                    const originalText = threadsCopyButton.textContent;
                    threadsCopyButton.textContent = '已複製!';
                    threadsCopyButton.disabled = true;
                    setTimeout(() => {
                        threadsCopyButton.textContent = originalText;
                        threadsCopyButton.disabled = false;
                    }, 1500); // 1.5秒後恢復
                }).catch(err => {
                    console.error('無法複製連結: ', err);
                    alert('抱歉，複製連結失敗。請手動複製網址。');
                });
            });
        }

        // 5. 設定 Instagram Profile 連結 (確保 HTML 中的連結是正確的)
        // instagramProfileLink 的 href 已在 HTML 中設定

        // --- 顯示分享區塊 ---
        if (shareSection) shareSection.style.display = 'block';


    } catch (error) {
        console.error("載入新聞詳情失敗:", error);
        loadingMessage.textContent = `錯誤：${error.message}`;
        loadingMessage.style.color = 'red';
    }
});

// --- 輔助函數：更新 Meta 標籤 ---
function updateMetaTag(attrName, attrValue, content) {
    let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (element) {
        element.setAttribute('content', content);
        // console.log(`Updated meta ${attrValue} to: ${content}`); // Debug
    } else {
        console.warn(`Meta tag with ${attrName}="${attrValue}" not found.`);
        // (可選) 動態創建缺失的 Meta 標籤
        // element = document.createElement('meta');
        // element.setAttribute(attrName, attrValue);
        // element.setAttribute('content', content);
        // document.head.appendChild(element);
    }
}