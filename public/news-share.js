// news-share.js
// 這個檔案用於 news-share.html，支援 ?id= 參數顯示新聞詳情

document.addEventListener('DOMContentLoaded', async () => {
    const contentArea = document.getElementById('news-content-area');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailMeta = document.getElementById('detail-meta');
    const detailBody = document.getElementById('detail-body');
    const loadingMessage = document.getElementById('loading-message');
    const categoryTabs = document.getElementById('category-tabs');

    console.log('loadingMessage:', loadingMessage);

    // 用於存儲 category.id -> index 的映射
    let categoryIndexMap = {}; 

    // --- 取得 ?id= 參數 ---
    function getNewsIdFromQuery() {
        const params = new URLSearchParams(window.location.search);
        return parseInt(params.get('id'));
    }
    const newsId = getNewsIdFromQuery();

    // --- 加載分類標籤 ---
    loadCategories();

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
        detailTitle.textContent = newsItem.title || '無標題';
        
        // 增强元数据的格式
        let metaHtml = '';
        if (newsItem.event_date) {
            const eventDate = new Date(newsItem.event_date);
            metaHtml += `<span class="event-date">📅 活動日期: ${eventDate.toLocaleDateString('zh-TW', {year: 'numeric', month: 'long', day: 'numeric'})}</span>`;
        }
        
        const updateDate = new Date(newsItem.updated_at);
        metaHtml += `<span class="update-date">🕒 更新時間: ${updateDate.toLocaleString('zh-TW')}</span>`;
        
        // 添加分类标签（如果有）
        if (newsItem.category_name) {
            const categoryIndex = categoryIndexMap[newsItem.category_id]; 
            let categoryClass = 'cat-other';
            if (categoryIndex !== undefined) {
                categoryClass = `category-index-${categoryIndex}`;
            }
            metaHtml += `<span class="category-tag ${categoryClass}" style="display: inline-block; margin-left: 10px; padding: 3px 10px; border-radius: 20px; color: white; font-size: 0.85rem;">${newsItem.category_name}</span>`;
        }
        
        detailMeta.innerHTML = metaHtml;
        
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

        // 更新分享链接
        const newsIdSpan = document.querySelector('.news-id');
        if (newsIdSpan) {
            newsIdSpan.textContent = newsId;
            const shareLink = newsIdSpan.closest('a');
            if (shareLink) {
                shareLink.href = `https://sunnyyummy.onrender.com/news-share.html?id=${newsId}`;
            }
        }

        // 动态更新页面 Title
        document.title = `${newsItem.title || 'SunnyYummy 新聞'} | SunnyYummy 新聞分享`;
        
        // 添加样式到分类标签
        applyStylesToElements();
        
    } catch (error) {
        console.error("載入新聞詳情失敗:", error);
        if (loadingMessage) {
            loadingMessage.textContent = `錯誤：${error.message}`;
            loadingMessage.style.color = 'red';
        } else {
            alert(`載入新聞詳情失敗：${error.message}`);
        }
    }

    // 应用样式到页面元素
    function applyStylesToElements() {
        // 设置分类标签的渐变色样式
        const categoryTag = document.querySelector('.category-tag');
        if (categoryTag) {
            const categoryClass = Array.from(categoryTag.classList).find(cls => cls.startsWith('category-index-'));
            if (categoryClass) {
                switch(categoryClass) {
                    case 'category-index-0':
                        categoryTag.style.background = 'linear-gradient(135deg, #00BCD4, #03A9F4)';
                        break;
                    case 'category-index-1':
                        categoryTag.style.background = 'linear-gradient(135deg, #FF9800, #FF5722)';
                        break;
                    case 'category-index-2':
                        categoryTag.style.background = 'linear-gradient(135deg, #4CAF50, #8BC34A)';
                        break;
                    case 'category-index-3':
                        categoryTag.style.background = 'linear-gradient(135deg, #E91E63, #F44336)';
                        break;
                    case 'category-index-4':
                        categoryTag.style.background = 'linear-gradient(135deg, #607D8B, #455A64)';
                        break;
                    default:
                        categoryTag.style.background = 'linear-gradient(135deg, #9C27B0, #673AB7)';
                }
            }
        }
    }

    // --- 加載分類標籤 ---
    async function loadCategories() {
        categoryIndexMap = {}; // 重置映射
        try {
            const response = await fetch('/api/news-categories'); // API應按所需順序返回分類
            if (!response.ok) throw new Error('API請求失敗');
            const categories = await response.json();

            if (Array.isArray(categories) && categories.length > 0) {
                const validCategories = categories.filter(cat => cat && cat.id && cat.name);
                // 建立索引映射
                validCategories.forEach((category, index) => {
                    categoryIndexMap[category.id] = index; 
                });
                renderCategories(validCategories); 
            } else {
                console.warn('API返回的分類數據無效或為空，使用備用分類');
                useBackupCategories(); 
            }
        } catch (error) {
            console.error('加載分類失敗:', error);
            useBackupCategories(); 
        }
    }

    // 使用備用分類
    function useBackupCategories() {
         const backupCats = [
            { id: 1, name: '最新消息', slug: 'latest' },
            { id: 2, name: '活動預告', slug: 'events' },
            { id: 3, name: '媒體報導', slug: 'media' },
            { id: 4, name: '合作推廣', slug: 'cooperation' },
            { id: 5, name: '其他資訊', slug: 'other' }
         ];
         categoryIndexMap = {}; // 重置
         backupCats.forEach((category, index) => {
            categoryIndexMap[category.id] = index;
         });
         renderCategories(backupCats);
    }

    // 渲染分類標籤
    function renderCategories(categories) {
        if (!categoryTabs) return;
        categoryTabs.innerHTML = '';

        const allLink = document.createElement('a');
        allLink.className = 'category-link category-index-all'; // "全部" 的 class
        allLink.setAttribute('data-category', 'all');
        allLink.href = '/news.html';
        allLink.textContent = '全部消息';
        categoryTabs.appendChild(allLink);

        categories.forEach(category => {
            const categoryIndex = categoryIndexMap[category.id]; // 獲取索引
            if (categoryIndex === undefined) return; // 如果映射中沒有，跳過

            const link = document.createElement('a');
            link.className = `category-link category-index-${categoryIndex}`; // 基於索引的 class
            link.setAttribute('data-category', category.id); 
            link.href = `/news.html?category=${category.id}`;
            link.textContent = category.name;
            categoryTabs.appendChild(link);
        });
    }
});
// news-share.js
// 這個檔案用於 news-share.html，支援 ?id= 參數顯示新聞詳情

document.addEventListener('DOMContentLoaded', async () => {
    const contentArea = document.getElementById('news-content-area');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailMeta = document.getElementById('detail-meta');
    const detailBody = document.getElementById('detail-body');
    const loadingMessage = document.getElementById('loading-message');
    const categoryTabs = document.getElementById('category-tabs');

    console.log('loadingMessage:', loadingMessage);

    // 用於存儲 category.id -> index 的映射
    let categoryIndexMap = {}; 

    // --- 取得 ?id= 參數 ---
    function getNewsIdFromQuery() {
        const params = new URLSearchParams(window.location.search);
        return parseInt(params.get('id'));
    }
    const newsId = getNewsIdFromQuery();

    // --- 加載分類標籤 ---
    loadCategories();

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
        detailTitle.textContent = newsItem.title || '無標題';
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

    // --- 加載分類標籤 ---
    async function loadCategories() {
        categoryIndexMap = {}; // 重置映射
        try {
            const response = await fetch('/api/news-categories'); // API應按所需順序返回分類
            if (!response.ok) throw new Error('API請求失敗');
            const categories = await response.json();

            if (Array.isArray(categories) && categories.length > 0) {
                const validCategories = categories.filter(cat => cat && cat.id && cat.name);
                // 建立索引映射
                validCategories.forEach((category, index) => {
                    categoryIndexMap[category.id] = index; 
                });
                renderCategories(validCategories); 
            } else {
                console.warn('API返回的分類數據無效或為空，使用備用分類');
                useBackupCategories(); 
            }
        } catch (error) {
            console.error('加載分類失敗:', error);
            useBackupCategories(); 
        }
    }

    // 使用備用分類
    function useBackupCategories() {
         const backupCats = [
            { id: 1, name: '最新消息', slug: 'latest' },
            { id: 2, name: '活動預告', slug: 'events' },
            { id: 3, name: '媒體報導', slug: 'media' },
            { id: 4, name: '合作推廣', slug: 'cooperation' }
         ];
         categoryIndexMap = {}; // 重置
         backupCats.forEach((category, index) => {
            categoryIndexMap[category.id] = index;
         });
         renderCategories(backupCats);
    }

    // 渲染分類標籤
    function renderCategories(categories) {
        if (!categoryTabs) return;
        categoryTabs.innerHTML = '';

        const allLink = document.createElement('a');
        allLink.className = 'category-link active category-index-all'; // "全部" 的 class
        allLink.setAttribute('data-category', 'all');
        allLink.href = '/news.html';
        allLink.textContent = '全部消息';
        categoryTabs.appendChild(allLink);

        categories.forEach(category => {
            const categoryIndex = categoryIndexMap[category.id]; // 獲取索引
            if (categoryIndex === undefined) return; // 如果映射中沒有，跳過

            const link = document.createElement('a');
            link.className = `category-link category-index-${categoryIndex}`; // 基於索引的 class
            link.setAttribute('data-category', category.id); 
            link.href = `/news.html?category=${category.id}`;
            link.textContent = category.name;
            categoryTabs.appendChild(link);
        });
    }
});