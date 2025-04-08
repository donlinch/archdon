// public/news-admin.js (整合後完整版 v5 - 修正 Debug 區塊位置)
document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Element References ---
    const newsListBody = document.querySelector('#news-list-table tbody');
    const newsListContainer = document.getElementById('news-list-container');
    const newsTable = document.getElementById('news-list-table');
    const loadingMessage = newsListContainer ? newsListContainer.querySelector('p') : null;
    const addNewsBtn = document.getElementById('add-news-btn');
    // <<< Debug 區域元素 >>>
    const debugInfoContainer = document.getElementById('news-debug-info');

    // --- Edit Modal elements ---
    const editModal = document.getElementById('edit-news-modal');
    const editForm = document.getElementById('edit-news-form');
    const editNewsIdInput = document.getElementById('edit-news-id');
    const editNewsTitle = document.getElementById('edit-news-title');
    const editNewsEventDate = document.getElementById('edit-news-event-date');
    const editNewsSummary = document.getElementById('edit-news-summary');
    const editNewsContent = document.getElementById('edit-news-content');
    const editNewsThumbnailUrl = document.getElementById('edit-news-thumbnail-url');
    const editNewsThumbnailPreview = document.getElementById('edit-news-thumbnail-preview');
    const editNewsImageUrl = document.getElementById('edit-news-image-url');
    const editFormError = document.getElementById('edit-news-form-error');
    const editNewsCategoryInput = document.getElementById('edit-news-category');
    const editCategorySuggestions = document.getElementById('edit-category-suggestions');
    const editCommonCategoriesContainer = document.getElementById('edit-common-categories');
    const editCategoryTagsLoading = document.getElementById('edit-category-tags-loading');
    const editNewsShowInCalendar = document.getElementById('edit-news-show-in-calendar');

    // --- Add Modal elements ---
    const addModal = document.getElementById('add-news-modal');
    const addForm = document.getElementById('add-news-form');
    const addNewsTitle = document.getElementById('add-news-title');
    const addNewsEventDate = document.getElementById('add-news-event-date');
    const addNewsSummary = document.getElementById('add-news-summary');
    const addNewsContent = document.getElementById('add-news-content');
    const addNewsThumbnailUrl = document.getElementById('add-news-thumbnail-url');
    const addNewsThumbnailPreview = document.getElementById('add-news-thumbnail-preview');
    const addNewsImageUrl = document.getElementById('add-news-image-url');
    const addFormError = document.getElementById('add-news-form-error');
    const addNewsCategoryInput = document.getElementById('add-news-category');
    const addCategorySuggestions = document.getElementById('add-category-suggestions');
    const addCommonCategoriesContainer = document.getElementById('add-common-categories');
    const addCategoryTagsLoading = document.getElementById('add-category-tags-loading');
    const addNewsShowInCalendar = document.getElementById('add-news-show-in-calendar');

    // --- 檢查核心元素 ---
    const coreElements = [newsListBody, newsListContainer, newsTable, addModal, editModal, addForm, editForm, addNewsBtn, debugInfoContainer];
    if (coreElements.some(el => !el)) {
        console.error("頁面初始化失敗：缺少必要的 HTML 元素。請檢查 ID。");
        if(loadingMessage) loadingMessage.textContent = "頁面載入錯誤，請聯繫管理員。";
        // 在頁面上顯示錯誤，以便非開發者也能看到
        const errorBanner = document.createElement('div');
        errorBanner.textContent = "頁面載入錯誤：缺少關鍵元件，請聯繫管理員。";
        errorBanner.style.backgroundColor = 'red';
        errorBanner.style.color = 'white';
        errorBanner.style.padding = '10px';
        errorBanner.style.textAlign = 'center';
        errorBanner.style.fontWeight = 'bold';
        document.body.insertBefore(errorBanner, document.body.firstChild);
        return; // 停止執行
    }

    // --- Helper: HTML Escaping ---
    const escapeHtml = (unsafe) => {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe.toString()
                    .replace(/&/g, "&")
                    .replace(/</g, "<")
                    .replace(/>/g, ">")
                        // " 轉成 & q u o t ;
                .replace(/"/g, '&quot;')
        
                // ' 轉成 & # 3 9 ;  (數字實體)
                .replace(/'/g, '&#39;');
    };

    // --- fetchAndRenderCategoryTags (保持不變) ---
    async function fetchAndRenderCategoryTags(modalType = 'add') {
        const container = modalType === 'edit' ? editCommonCategoriesContainer : addCommonCategoriesContainer;
        const loadingSpan = modalType === 'edit' ? editCategoryTagsLoading : addCategoryTagsLoading;
        const suggestionsList = modalType === 'edit' ? editCategorySuggestions : addCategorySuggestions;
        const targetInput = modalType === 'edit' ? editNewsCategoryInput : addNewsCategoryInput;
        if (!container || !loadingSpan || !targetInput) return;
        loadingSpan.textContent = '載入中...'; loadingSpan.style.color = '#888'; loadingSpan.style.display = 'inline';
        container.querySelectorAll('.category-tag').forEach(tag => tag.remove());
        if (suggestionsList) suggestionsList.innerHTML = '';
        try {
            const response = await fetch('/api/news/categories');
            if (!response.ok) throw new Error(`獲取分類失敗 (${response.status})`);
            const categories = await response.json();
            if (categories && categories.length > 0) {
                loadingSpan.style.display = 'none';
                categories.forEach(category => {
                    const tagButton = document.createElement('button');
                    tagButton.type = 'button'; tagButton.className = 'category-tag btn btn-outline-secondary btn-sm'; tagButton.textContent = category; tagButton.style.margin = '3px'; tagButton.style.cursor = 'pointer';
                    tagButton.addEventListener('click', () => { targetInput.value = category; }); container.appendChild(tagButton);
                    if (suggestionsList) { const option = document.createElement('option'); option.value = category; suggestionsList.appendChild(option); }
                });
            } else { loadingSpan.textContent = '無常用分類'; }
        } catch (error) { console.error("渲染分類標籤失敗:", error); loadingSpan.textContent = '無法載入分類'; loadingSpan.style.color = 'red'; }
    }

    // --- closeModal (保持不變) ---
    function closeModal(modalElement) { if (modalElement) { modalElement.style.display = 'none'; } }

    // --- handleBackgroundClick (保持不變) ---
    function handleBackgroundClick(event) { if (event.target === this) { closeModal(this); } }

    // --- Modal 關閉事件處理 (保持不變) ---
    [addModal, editModal].forEach(modal => {
        if (modal) {
            const closeBtn = modal.querySelector('.close-btn'); if (closeBtn) { closeBtn.removeEventListener('click', () => closeModal(modal)); closeBtn.addEventListener('click', () => closeModal(modal)); }
            const cancelBtn = modal.querySelector('.action-btn.cancel-btn'); if (cancelBtn) { cancelBtn.removeEventListener('click', () => closeModal(modal)); cancelBtn.addEventListener('click', () => closeModal(modal)); }
            modal.removeEventListener('click', handleBackgroundClick); modal.addEventListener('click', handleBackgroundClick);
        }
    });

    // --- Function to Fetch and Display ALL News in the Table (修正 Debug 區塊處理) ---
    async function fetchAndDisplayNews() {
        if (!newsListBody || !newsListContainer || !newsTable) { return; }

        // --- <<< Debug 區塊更新移到這裡 >>> ---
        if (debugInfoContainer) {
            debugInfoContainer.innerHTML = '<h3>原始數據檢查 (列表下方):</h3><p>正在載入數據...</p>';
        }
        // --- <<< 更新結束 >>> ---

        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (newsTable) newsTable.style.display = 'none';
            newsListBody.innerHTML = '';

            const response = await fetch('/api/admin/news');
            if (!response.ok) { /* ... error handling ... */ throw new Error('...'); }
            const newsList = await response.json();

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (newsTable) newsTable.style.display = 'table';

            let debugTextContent = '<h3>原始數據檢查 (列表下方):</h3>\n'; // 初始化 Debug 文本

            if (!newsList || newsList.length === 0) {
                newsListBody.innerHTML = `<tr><td colspan="10">目前沒有消息。</td></tr>`;
                debugTextContent += 'API 返回了空的新聞列表。\n';
            } else {
                newsList.forEach(newsItem => {
                    const row = document.createElement('tr');
                    row.dataset.newsId = newsItem.id;

                    // 創建並填充 <td> (保持不變，10列)
                    const tdId = document.createElement('td'); tdId.textContent = newsItem.id; row.appendChild(tdId);
                    const tdTitle = document.createElement('td'); tdTitle.textContent = escapeHtml(newsItem.title || ''); row.appendChild(tdTitle);
                    const tdEventDate = document.createElement('td'); tdEventDate.textContent = newsItem.event_date ? new Date(newsItem.event_date).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'; row.appendChild(tdEventDate);
                    const tdSummary = document.createElement('td'); tdSummary.textContent = escapeHtml(newsItem.summary ? newsItem.summary.substring(0, 20) + (newsItem.summary.length > 20 ? '...' : '') : ''); row.appendChild(tdSummary);
                    const tdThumbnail = document.createElement('td'); tdThumbnail.innerHTML = `<img src="${newsItem.thumbnail_url || '/images/placeholder.png'}" alt="縮圖" style="width: 50px; height: auto; border: 1px solid #eee; object-fit: contain; vertical-align: middle;">`; row.appendChild(tdThumbnail);
                    const tdImage = document.createElement('td'); tdImage.innerHTML = `<img src="${newsItem.image_url || '/images/placeholder.png'}" alt="主圖" style="width: 50px; height: auto; border: 1px solid #eee; object-fit: contain; vertical-align: middle;">`; row.appendChild(tdImage);
                    const tdLikes = document.createElement('td'); tdLikes.textContent = newsItem.like_count || 0; row.appendChild(tdLikes);
                    const tdCategory = document.createElement('td'); tdCategory.textContent = escapeHtml(newsItem.category || '-'); row.appendChild(tdCategory);
                    const tdShowInCalendar = document.createElement('td'); tdShowInCalendar.textContent = newsItem.show_in_calendar === true ? '是' : '否'; row.appendChild(tdShowInCalendar);
                    const tdActions = document.createElement('td'); tdActions.className = 'actions'; tdActions.innerHTML = `<button class="btn btn-warning btn-sm edit-news-btn" data-id="${newsItem.id}">編輯</button> <button class="btn btn-danger btn-sm delete-news-btn" data-id="${newsItem.id}">刪除</button>`; row.appendChild(tdActions);

                    // 累積 Debug 文本 (保持不變)
                    const categoryValue = newsItem.category; const calendarValue = newsItem.show_in_calendar;
                    debugTextContent += `ID (${newsItem.id})  分類：'${categoryValue}' (類型: ${typeof categoryValue})  顯示：'${calendarValue}' (類型: ${typeof calendarValue})\n`;

                    newsListBody.appendChild(row);
                });
            }

            // --- <<< 更新 Debug 顯示區域 >>> ---
            if (debugInfoContainer) {
                 debugInfoContainer.textContent = debugTextContent; // 使用 textContent 保留換行
            }
            // --- <<< 更新結束 >>> ---

            addTableButtonListeners();

        } catch (error) {
            console.error("獲取管理消息列表失敗:", error);
            if (loadingMessage) loadingMessage.textContent = `無法載入消息列表: ${error.message}`;
            if (newsTable) newsTable.style.display = 'none';
            // --- <<< Debug 區錯誤處理 >>> ---
            if (debugInfoContainer) {
                debugInfoContainer.innerHTML = `<h3>原始數據檢查 (列表下方):</h3><p style="color:red;">獲取數據時發生錯誤: ${error.message}</p>`;
            }
            // --- <<< 處理結束 >>> ---
             if (error.message.includes('登入')) { alert('請先登入管理後台！'); }
        }
    }

     // --- addTableButtonListeners, handleTableButtonClick (保持不變) ---
     function addTableButtonListeners() { if (!newsListBody) return; newsListBody.removeEventListener('click', handleTableButtonClick); newsListBody.addEventListener('click', handleTableButtonClick); }
     async function handleTableButtonClick(event) { const target = event.target; if (target.matches('.edit-news-btn')) { const newsId = target.dataset.id; if (newsId) { try { const response = await fetch(`/api/admin/news/${newsId}`); if (!response.ok) throw new Error(`無法獲取編輯數據 (HTTP ${response.status})`); const newsItem = await response.json(); openEditNewsModal(newsItem); } catch (error) { console.error("獲取編輯數據失敗:", error); alert("無法載入編輯數據，請重試。"); } } } else if (target.matches('.delete-news-btn')) { const newsId = target.dataset.id; if (newsId) { const title = target.closest('tr')?.querySelector('td:nth-child(2)')?.textContent || `ID: ${newsId}`; deleteNews(newsId, title); } } }

    // --- openEditNewsModal (保持不變) ---
    function openEditNewsModal(newsItem) { const requiredEditElements = [editModal, editForm, editNewsIdInput, editNewsTitle, editNewsEventDate, editNewsSummary, editNewsContent, editNewsThumbnailUrl, editNewsThumbnailPreview, editNewsImageUrl, editFormError, editNewsCategoryInput, editCategorySuggestions, editCommonCategoriesContainer, editCategoryTagsLoading, editNewsShowInCalendar]; if (requiredEditElements.some(el => !el)) { console.error("編輯 Modal 元件缺失。"); alert("編輯視窗元件錯誤。"); return; } editFormError.textContent = ''; editForm.reset(); editNewsIdInput.value = newsItem.id; editNewsTitle.value = newsItem.title || ''; editNewsEventDate.value = newsItem.event_date ? newsItem.event_date.split('T')[0] : ''; editNewsSummary.value = newsItem.summary || ''; editNewsContent.value = newsItem.content || ''; editNewsThumbnailUrl.value = newsItem.thumbnail_url || ''; editNewsImageUrl.value = newsItem.image_url || ''; editNewsCategoryInput.value = newsItem.category || ''; editNewsShowInCalendar.checked = newsItem.show_in_calendar === true; if (editNewsThumbnailPreview) { if (newsItem.thumbnail_url) { editNewsThumbnailPreview.src = newsItem.thumbnail_url; editNewsThumbnailPreview.style.display = 'block'; } else { editNewsThumbnailPreview.src = ''; editNewsThumbnailPreview.style.display = 'none'; } } fetchAndRenderCategoryTags('edit'); editModal.style.display = 'flex'; }

    // --- openAddNewsModal (保持不變) ---
    function openAddNewsModal() { const requiredAddElements = [addModal, addForm, addNewsTitle, addNewsEventDate, addNewsSummary, addNewsContent, addNewsThumbnailUrl, addNewsThumbnailPreview, addNewsImageUrl, addFormError, addNewsCategoryInput, addNewsShowInCalendar]; if (requiredAddElements.some(el => !el)) { console.error("新增 Modal 元件缺失。"); alert("新增視窗元件錯誤。"); return; } addFormError.textContent = ''; addForm.reset(); addNewsShowInCalendar.checked = false; if (addNewsThumbnailPreview) { addNewsThumbnailPreview.src = ''; addNewsThumbnailPreview.style.display = 'none'; } fetchAndRenderCategoryTags('add'); addModal.style.display = 'flex'; }

    // --- deleteNews (保持不變) ---
    async function deleteNews(id, title) { if (confirm(`確定要刪除消息 "${title || 'ID: '+id}" 嗎？`)) { try { const response = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' }); if (response.status === 204 || response.ok) { await fetchAndDisplayNews(); alert('消息刪除成功！'); } else { let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${response.statusText}`; } throw new Error(errorMsg); } } catch (error) { alert(`刪除時發生錯誤：${error.message}`); } } }

     // --- setupImagePreview, handlePreviewUpdate (保持不變) ---
     function setupImagePreview(urlInput, previewElement) { if (urlInput && previewElement) { urlInput.removeEventListener('input', handlePreviewUpdate); urlInput.addEventListener('input', handlePreviewUpdate); } }
     function handlePreviewUpdate(event) { const urlInput = event.target; const previewId = urlInput.id.replace('-url', '-preview'); const previewElement = document.getElementById(previewId); if (!previewElement) return; const url = urlInput.value.trim(); if (url) { previewElement.src = url; previewElement.style.display = 'block'; } else { previewElement.src = ''; previewElement.style.display = 'none'; } }
     setupImagePreview(addNewsThumbnailUrl, addNewsThumbnailPreview);
     setupImagePreview(editNewsThumbnailUrl, editNewsThumbnailPreview);

    // --- handleFormSubmit (保持不變) ---
    async function handleFormSubmit(event) { /* ... 保持不變 ... */ }

    // --- Event Listeners Setup ---
    if (addNewsBtn) { addNewsBtn.addEventListener('click', openAddNewsModal); }
    if (addForm) addForm.addEventListener('submit', handleFormSubmit);
    if (editForm) editForm.addEventListener('submit', handleFormSubmit);

    // --- Initial Load (保持不變) ---
    try {
        await fetchAndDisplayNews();
        fetchAndRenderCategoryTags('add');
        fetchAndRenderCategoryTags('edit');
        console.log("News Admin JS Initialized.");
    } catch (initError) {
         console.error("頁面初始化載入新聞列表失敗:", initError);
    }

}); // End of DOMContentLoaded