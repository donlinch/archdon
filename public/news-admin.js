// public/news-admin.js (整合後完整版 v4 - 分離渲染邏輯)
document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Element References (保持不變) ---
    const newsListBody = document.querySelector('#news-list-table tbody');
    const newsListContainer = document.getElementById('news-list-container');
    const newsTable = document.getElementById('news-list-table');
    const loadingMessage = newsListContainer ? newsListContainer.querySelector('p') : null;
    const addNewsBtn = document.getElementById('add-news-btn');
    const debugInfoContainer = document.getElementById('news-debug-info'); // Debug 區

    // --- Edit Modal elements (保持不變) ---
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

    // --- Add Modal elements (保持不變) ---
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

    // --- 檢查核心元素 (保持不變) ---
    const coreElements = [newsListBody, newsListContainer, newsTable, addModal, editModal, addForm, editForm, addNewsBtn, debugInfoContainer];
    if (coreElements.some(el => !el)) {
        console.error("頁面初始化失敗：缺少必要的 HTML 元素。請檢查 ID。");
        if(loadingMessage) loadingMessage.textContent = "頁面載入錯誤，請聯繫管理員。";
        return;
    }

    // --- Helper: HTML Escaping (保持不變) ---
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
                    const tagButton = document.createElement('button'); /* ... button setup ... */
                    tagButton.type = 'button'; tagButton.className = 'category-tag btn btn-outline-secondary btn-sm'; tagButton.textContent = category; tagButton.style.margin = '3px'; tagButton.style.cursor = 'pointer';
                    tagButton.addEventListener('click', () => { targetInput.value = category; }); container.appendChild(tagButton);
                    if (suggestionsList) { const option = document.createElement('option'); option.value = category; suggestionsList.appendChild(option); }
                });
            } else { loadingSpan.textContent = '無常用分類'; }
        } catch (error) { console.error("渲染分類標籤失敗:", error); loadingSpan.textContent = '無法載入分類'; loadingSpan.style.color = 'red'; }
    }

    // --- closeModal, handleBackgroundClick (保持不變) ---
    function closeModal(modalElement) { if (modalElement) { modalElement.style.display = 'none'; } }
    function handleBackgroundClick(event) { if (event.target === this) { closeModal(this); } }
    [addModal, editModal].forEach(modal => { /* ... modal close listeners ... */
        if (modal) {
            const closeBtn = modal.querySelector('.close-btn'); if (closeBtn) { closeBtn.removeEventListener('click', () => closeModal(modal)); closeBtn.addEventListener('click', () => closeModal(modal)); }
            const cancelBtn = modal.querySelector('.action-btn.cancel-btn'); if (cancelBtn) { cancelBtn.removeEventListener('click', () => closeModal(modal)); cancelBtn.addEventListener('click', () => closeModal(modal)); }
            modal.removeEventListener('click', handleBackgroundClick); modal.addEventListener('click', handleBackgroundClick);
        }
    });

    // --- *** 修改後的 fetchAndDisplayNews *** ---
    async function fetchAndDisplayNews() {
        if (!newsListBody || !newsListContainer || !newsTable) { return; }
        if (debugInfoContainer) debugInfoContainer.innerHTML = '<h3>原始數據檢查 (列表下方):</h3><p>正在載入數據...</p>';

        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (newsTable) newsTable.style.display = 'none';
            newsListBody.innerHTML = '';

            const response = await fetch('/api/admin/news');
            if (!response.ok) { /* ... error handling ... */
                 let errorMsg = `HTTP 錯誤！狀態: ${response.status}`; try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {} if (response.status === 401) throw new Error('您需要登入才能查看管理列表。'); throw new Error(errorMsg);
            }
            const newsList = await response.json();

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (newsTable) newsTable.style.display = 'table';

            let debugTextContent = '<h3>原始數據檢查 (列表下方):</h3>\n';

            if (!newsList || newsList.length === 0) {
                newsListBody.innerHTML = `<tr><td colspan="10">目前沒有消息。</td></tr>`;
                debugTextContent += 'API 返回了空的新聞列表。\n';
            } else {
                newsList.forEach(newsItem => {
                    const row = document.createElement('tr');
                    row.dataset.newsId = newsItem.id;

                    // --- <<< 逐個創建 <td> >>> ---

                    // 1. ID
                    const tdId = document.createElement('td');
                    tdId.textContent = newsItem.id;
                    row.appendChild(tdId);

                    // 2. 標題
                    const tdTitle = document.createElement('td');
                    tdTitle.textContent = escapeHtml(newsItem.title || '');
                    row.appendChild(tdTitle);

                    // 3. 活動日期
                    const tdEventDate = document.createElement('td');
                    tdEventDate.textContent = newsItem.event_date ? new Date(newsItem.event_date).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-';
                    row.appendChild(tdEventDate);

                    // 4. 摘要
                    const tdSummary = document.createElement('td');
                    tdSummary.textContent = escapeHtml(newsItem.summary ? newsItem.summary.substring(0, 20) + (newsItem.summary.length > 20 ? '...' : '') : '');
                    row.appendChild(tdSummary);

                    // 5. 縮圖
                    const tdThumbnail = document.createElement('td');
                    tdThumbnail.innerHTML = `<img src="${newsItem.thumbnail_url || '/images/placeholder.png'}" alt="縮圖" style="width: 50px; height: auto; border: 1px solid #eee; object-fit: contain; vertical-align: middle;">`;
                    row.appendChild(tdThumbnail);

                    // 6. 主圖
                    const tdImage = document.createElement('td');
                    tdImage.innerHTML = `<img src="${newsItem.image_url || '/images/placeholder.png'}" alt="主圖" style="width: 50px; height: auto; border: 1px solid #eee; object-fit: contain; vertical-align: middle;">`;
                    row.appendChild(tdImage);

                    // 7. 讚數
                    const tdLikes = document.createElement('td');
                    tdLikes.textContent = newsItem.like_count || 0;
                    row.appendChild(tdLikes);

                    // 8. 分類 (使用 textContent)
                    const tdCategory = document.createElement('td');
                    tdCategory.textContent = escapeHtml(newsItem.category || '-');
                    // 如果值是 '1234'，這裡應該會顯示 '1234'
                    row.appendChild(tdCategory);

                    // 9. 顯示於行事曆 (使用 textContent)
                    const tdShowInCalendar = document.createElement('td');
                    // 直接檢查布林值
                    tdShowInCalendar.textContent = newsItem.show_in_calendar === true ? '是' : '否';
                    // 如果值是 true，這裡應該會顯示 '是'
                    row.appendChild(tdShowInCalendar);

                    // 10. 操作
                    const tdActions = document.createElement('td');
                    tdActions.className = 'actions';
                    tdActions.innerHTML = `
                        <button class="btn btn-warning btn-sm edit-news-btn" data-id="${newsItem.id}">編輯</button>
                        <button class="btn btn-danger btn-sm delete-news-btn" data-id="${newsItem.id}">刪除</button>
                    `;
                    row.appendChild(tdActions);

                    // --- <<< 累積 Debug 文本 (保持不變) >>> ---
                    const categoryValue = newsItem.category;
                    const calendarValue = newsItem.show_in_calendar;
                    debugTextContent += `ID (${newsItem.id})  分類：'${categoryValue}' (類型: ${typeof categoryValue})  顯示：'${calendarValue}' (類型: ${typeof calendarValue})\n`;
                    // --- <<< 累積結束 >>> ---

                    newsListBody.appendChild(row); // 將完成的行添加到表格
                });
            }

            // 更新 Debug 顯示區域
            if (debugInfoContainer) {
                 debugInfoContainer.textContent = debugTextContent;
            }

            addTableButtonListeners();

        } catch (error) {
            console.error("獲取管理消息列表失敗:", error);
            if (loadingMessage) loadingMessage.textContent = `無法載入消息列表: ${error.message}`;
            if (newsTable) newsTable.style.display = 'none';
            if (debugInfoContainer) {
                debugInfoContainer.innerHTML = `<h3>原始數據檢查 (列表下方):</h3><p style="color:red;">獲取數據時發生錯誤: ${error.message}</p>`;
            }
             if (error.message.includes('登入')) {
                alert('請先登入管理後台！');
             }
        }
    }

     // --- addTableButtonListeners, handleTableButtonClick (保持不變) ---
     function addTableButtonListeners() {
        if (!newsListBody) return;
        newsListBody.removeEventListener('click', handleTableButtonClick);
        newsListBody.addEventListener('click', handleTableButtonClick);
     }     async function handleTableButtonClick(event) { 
        const target = event.target;
        if (target.matches('.edit-news-btn')) {
            const newsId = target.dataset.id;
            if (newsId) {
                 try {
                    const response = await fetch(`/api/admin/news/${newsId}`);
                    if (!response.ok) throw new Error(`無法獲取編輯數據 (HTTP ${response.status})`);
                    const newsItem = await response.json();
                    openEditNewsModal(newsItem);
                 } catch (error) {
                    console.error("獲取編輯數據失敗:", error);
                    alert("無法載入編輯數據，請重試。");
                 }
            }
        } else if (target.matches('.delete-news-btn')) {
            const newsId = target.dataset.id;
            if (newsId) {
                const title = target.closest('tr')?.querySelector('td:nth-child(2)')?.textContent || `ID: ${newsId}`;
                deleteNews(newsId, title);
            }
        } }

    // --- openEditNewsModal (保持不變, 注意裡面填充 checkbox 的邏輯已修正) ---
    function openEditNewsModal(newsItem) {
        // 檢查必要的編輯 Modal 元素是否存在
        const requiredEditElements = [
            editModal, editForm, editNewsIdInput, editNewsTitle, editNewsEventDate,
            editNewsSummary, editNewsContent, editNewsThumbnailUrl, editNewsThumbnailPreview,
            editNewsImageUrl, editFormError, editNewsCategoryInput, editCategorySuggestions,
            editCommonCategoriesContainer, editCategoryTagsLoading, editNewsShowInCalendar
        ];
        if (requiredEditElements.some(el => !el)) {
            console.error("編輯 Modal 元件缺失。請檢查 HTML ID 是否都正確。");
            alert("編輯視窗元件錯誤，無法打開。");
            return;
        }

        // 清除之前的錯誤訊息並重置表單狀態
        editFormError.textContent = '';
        editForm.reset(); // 重置表單以清除舊值

        // 填充表單欄位
        editNewsIdInput.value = newsItem.id; // 設置隱藏的 ID
        editNewsTitle.value = newsItem.title || ''; // 填充標題
        // 將 ISO 日期格式化為 YYYY-MM-DD 給 date input
        editNewsEventDate.value = newsItem.event_date ? newsItem.event_date.split('T')[0] : '';
        editNewsSummary.value = newsItem.summary || ''; // 填充摘要
        editNewsContent.value = newsItem.content || ''; // 填充內容
        editNewsThumbnailUrl.value = newsItem.thumbnail_url || ''; // 填充縮圖 URL
        editNewsImageUrl.value = newsItem.image_url || ''; // 填充主圖 URL

        // 填充分類輸入框
        editNewsCategoryInput.value = newsItem.category || '';
        console.log('填充編輯表單 - 分類:', newsItem.category); // 增加 Log

        // --- <<< 填充行事曆顯示勾選框 >>> ---
        // 確保從 newsItem 中正確讀取布林值來設定 checked 狀態
        editNewsShowInCalendar.checked = newsItem.show_in_calendar === true;
        console.log('填充編輯表單 - 顯示於行事曆:', newsItem.show_in_calendar, '-> checked:', editNewsShowInCalendar.checked); // 增加 Log
        // --- <<< 填充結束 >>> ---

        // 處理縮圖預覽
        if (editNewsThumbnailPreview) { // 確保預覽元素存在
            if (newsItem.thumbnail_url) {
                editNewsThumbnailPreview.src = newsItem.thumbnail_url;
                editNewsThumbnailPreview.style.display = 'block'; // 有 URL 才顯示
            } else {
                editNewsThumbnailPreview.src = ''; // 清空 src
                editNewsThumbnailPreview.style.display = 'none'; // 隱藏
            }
        }

        // 為當前打開的 Edit Modal 異步獲取並渲染常用分類標籤
        fetchAndRenderCategoryTags('edit');

        // 顯示 Modal
        editModal.style.display = 'flex'; // 使用 flex 以便垂直居中
    }
    // --- openAddNewsModal (保持不變) ---
    function openAddNewsModal() {
        const requiredAddElements = [addModal, addForm, addNewsTitle, addNewsEventDate, addNewsSummary, addNewsContent, addNewsThumbnailUrl, addNewsThumbnailPreview, addNewsImageUrl, addFormError, addNewsCategoryInput, addNewsShowInCalendar];
        if (requiredAddElements.some(el => !el)) { console.error("新增 Modal 元件缺失。"); alert("新增視窗元件錯誤。"); return; }

        addFormError.textContent = '';
        addForm.reset();
        addNewsShowInCalendar.checked = false;
        if (addNewsThumbnailPreview) {
             addNewsThumbnailPreview.src = '';
             addNewsThumbnailPreview.style.display = 'none';
        }

        fetchAndRenderCategoryTags('add');
        addModal.style.display = 'flex'; }

    // --- deleteNews (保持不變) ---
    async function deleteNews(id, title) {
        if (confirm(`確定要刪除消息 "${title || 'ID: '+id}" 嗎？`)) {
            try {
                const response = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' });
                if (response.status === 204 || response.ok) {
                    await fetchAndDisplayNews();
                     alert('消息刪除成功！');
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${response.statusText}`; } throw new Error(errorMsg);
                }
            } catch (error) { alert(`刪除時發生錯誤：${error.message}`); }
        } }

     // --- setupImagePreview, handlePreviewUpdate (保持不變) ---
     function setupImagePreview(urlInput, previewElement) { 
        if (urlInput && previewElement) {
           urlInput.removeEventListener('input', handlePreviewUpdate);
           urlInput.addEventListener('input', handlePreviewUpdate);
        } }
     function handlePreviewUpdate(event) { 
        const urlInput = event.target;
        const previewId = urlInput.id.replace('-url', '-preview');
        const previewElement = document.getElementById(previewId);
        if (!previewElement) return;
        const url = urlInput.value.trim();
        if (url) {
            previewElement.src = url;
            previewElement.style.display = 'block';
        } else {
            previewElement.src = '';
            previewElement.style.display = 'none';
        } }
     setupImagePreview(addNewsThumbnailUrl, addNewsThumbnailPreview);
     setupImagePreview(editNewsThumbnailUrl, editNewsThumbnailPreview);

    // --- handleFormSubmit (保持不變) ---
    async function handleFormSubmit(event) { 
        event.preventDefault();
        const form = event.target;
        const isEditMode = form.id === 'edit-news-form';
        const newsId = isEditMode ? editNewsIdInput.value : null;
        const formErrorElement = isEditMode ? editFormError : addFormError;

        formErrorElement.textContent = '';

        const titleInput = document.getElementById(isEditMode ? 'edit-news-title' : 'add-news-title');
        const eventDateInput = document.getElementById(isEditMode ? 'edit-news-event-date' : 'add-news-event-date');
        const summaryInput = document.getElementById(isEditMode ? 'edit-news-summary' : 'add-news-summary');
        const contentInput = document.getElementById(isEditMode ? 'edit-news-content' : 'add-news-content');
        const thumbnailUrlInput = document.getElementById(isEditMode ? 'edit-news-thumbnail-url' : 'add-news-thumbnail-url');
        const imageUrlInput = document.getElementById(isEditMode ? 'edit-news-image-url' : 'add-news-image-url');
        const categoryInput = document.getElementById(isEditMode ? 'edit-news-category' : 'add-news-category');
        const showInCalendarCheckbox = document.getElementById(isEditMode ? 'edit-news-show-in-calendar' : 'add-news-show-in-calendar');

        const inputs = [titleInput, eventDateInput, summaryInput, contentInput, thumbnailUrlInput, imageUrlInput, categoryInput, showInCalendarCheckbox];
        if (inputs.some(el => !el)) {
            const missingIds = inputs.map((el, i) => !el ? (isEditMode ? ['edit-news-title', /*...*/ 'edit-news-category', 'edit-news-show-in-calendar'] : ['add-news-title', /*...*/ 'add-news-category', 'add-news-show-in-calendar'])[i] : null).filter(Boolean);
            formErrorElement.textContent = `表單元件查找失敗: ${missingIds.join(', ')}。`;
            console.error("表單元素缺失", missingIds);
            return;
        }

        const title = titleInput.value.trim();
        const event_date = eventDateInput.value;
        const summary = summaryInput.value.trim();
        const content = contentInput.value.trim();
        const thumbnail_url = thumbnailUrlInput.value.trim();
        const image_url = imageUrlInput.value.trim();
        const category = categoryInput.value.trim();
        const show_in_calendar = showInCalendarCheckbox.checked;
        console.log('讀取的分類 (提交前):', category);
        console.log('讀取的行事曆顯示狀態 (提交前):', show_in_calendar);

        if (!title) { formErrorElement.textContent = '消息標題為必填項！'; return; }

        const newsData = {
            title: title,
            event_date: event_date || null,
            summary: summary || null,
            content: content || null,
            thumbnail_url: thumbnail_url || null,
            image_url: image_url || null,
            category: category || null,
            show_in_calendar: show_in_calendar
        };
        console.log('準備發送的 newsData:', newsData);

        const method = isEditMode ? 'PUT' : 'POST';
        const url = isEditMode ? `/api/admin/news/${newsId}` : '/api/admin/news';

        const saveButton = form.querySelector('button[type="submit"]');
        if (saveButton) saveButton.disabled = true;

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newsData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                throw new Error(errorData.error || `操作失敗: ${response.statusText}`);
            }

            closeModal(isEditMode ? editModal : addModal);
            await fetchAndDisplayNews();
            alert(`消息已成功${isEditMode ? '更新' : '新增'}！`);

        } catch (error) {
            console.error('儲存消息失敗:', error);
            formErrorElement.textContent = `儲存失敗: ${error.message}`;
            alert(`儲存失敗: ${error.message}`);
        } finally {
            if (saveButton) saveButton.disabled = false;
        } }

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