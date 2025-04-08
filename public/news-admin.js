// public/news-admin.js (整合後完整版)
document.addEventListener('DOMContentLoaded', async () => { // <-- 將初始化移至 DOMContentLoaded
    // --- DOM Element References ---
    const newsListBody = document.querySelector('#news-list-table tbody');
    const newsListContainer = document.getElementById('news-list-container');
    const newsTable = document.getElementById('news-list-table');
    const loadingMessage = newsListContainer ? newsListContainer.querySelector('p') : null;
    const addNewsBtn = document.getElementById('add-news-btn'); // 新增按鈕的 ID

    // --- Edit Modal elements ---
    const editModal = document.getElementById('edit-news-modal');
    const editForm = document.getElementById('edit-news-form');
    const editNewsIdInput = document.getElementById('edit-news-id'); // 假設 Edit Modal 儲存 ID 的隱藏 input
    const editNewsTitle = document.getElementById('edit-news-title');
    const editNewsEventDate = document.getElementById('edit-news-event-date');
    const editNewsSummary = document.getElementById('edit-news-summary');
    const editNewsContent = document.getElementById('edit-news-content');
    const editNewsThumbnailUrl = document.getElementById('edit-news-thumbnail-url');
    const editNewsThumbnailPreview = document.getElementById('edit-news-thumbnail-preview');
    const editNewsImageUrl = document.getElementById('edit-news-image-url');
    const editFormError = document.getElementById('edit-news-form-error');
    // 新增: Edit Modal 的新元素
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
    const addNewsThumbnailPreview = document.getElementById('add-news-thumbnail-preview'); // HTML 中應有此 ID
    const addNewsImageUrl = document.getElementById('add-news-image-url');
    const addFormError = document.getElementById('add-news-form-error');
    // 新增: Add Modal 的新元素
    const addNewsCategoryInput = document.getElementById('add-news-category');
    const addCategorySuggestions = document.getElementById('add-category-suggestions');
    const addCommonCategoriesContainer = document.getElementById('add-common-categories');
    const addCategoryTagsLoading = document.getElementById('add-category-tags-loading');
    const addNewsShowInCalendar = document.getElementById('add-news-show-in-calendar');

    // --- 檢查核心元素 ---
    const coreElements = [newsListBody, newsListContainer, newsTable, addModal, editModal, addForm, editForm];
    if (coreElements.some(el => !el)) {
        console.error("頁面初始化失敗：缺少必要的 HTML 元素 (表格、Modal 或表單)。請檢查 ID。");
        if(loadingMessage) loadingMessage.textContent = "頁面載入錯誤，請聯繫管理員。";
        return; // 停止執行
    }

    // --- 獲取並渲染常用分類標籤 ---
    async function fetchAndRenderCategoryTags(modalType = 'add') {
        const container = modalType === 'edit' ? editCommonCategoriesContainer : addCommonCategoriesContainer;
        const loadingSpan = modalType === 'edit' ? editCategoryTagsLoading : addCategoryTagsLoading;
        const suggestionsList = modalType === 'edit' ? editCategorySuggestions : addCategorySuggestions;
        const targetInput = modalType === 'edit' ? editNewsCategoryInput : addNewsCategoryInput;

        if (!container || !loadingSpan || !targetInput) {
            console.warn(`無法為 ${modalType} modal 找到分類標籤容器、載入提示或輸入框。`);
            return;
        }

        loadingSpan.textContent = '載入中...'; // 重置載入提示文字
        loadingSpan.style.color = '#888';    // 重置顏色
        loadingSpan.style.display = 'inline';

        // 清空舊標籤
        const existingTags = container.querySelectorAll('.category-tag');
        existingTags.forEach(tag => tag.remove());
        if (suggestionsList) suggestionsList.innerHTML = '';

        try {
            const response = await fetch('/api/news/categories');
            if (!response.ok) throw new Error(`獲取分類失敗 (${response.status})`);
            const categories = await response.json();

            if (categories && categories.length > 0) {
                loadingSpan.style.display = 'none';

                categories.forEach(category => {
                    const tagButton = document.createElement('button');
                    tagButton.type = 'button';
                    tagButton.className = 'category-tag btn btn-outline-secondary btn-sm';
                    tagButton.textContent = category;
                    tagButton.style.margin = '3px';
                    tagButton.style.cursor = 'pointer';
                    tagButton.addEventListener('click', () => {
                        targetInput.value = category;
                    });
                    container.appendChild(tagButton);

                    if (suggestionsList) {
                        const option = document.createElement('option');
                        option.value = category;
                        suggestionsList.appendChild(option);
                    }
                });
            } else {
                loadingSpan.textContent = '無常用分類';
            }
        } catch (error) {
            console.error("渲染分類標籤失敗:", error);
            loadingSpan.textContent = '無法載入分類';
            loadingSpan.style.color = 'red';
        }
    }

    // --- Function to Fetch and Display ALL News in the Table ---
    async function fetchAndDisplayNews() {
        if (!newsListBody || !newsListContainer || !newsTable) { return; }
        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (newsTable) newsTable.style.display = 'none';
            newsListBody.innerHTML = ''; // 清空

            // 後台獲取所有新聞，不需要分頁 limit=999 是一個 workaround，更好的方式是後端提供不分頁的選項
            const response = await fetch('/api/admin/news'); // *** 使用受保護的管理 API ***
            if (!response.ok) {
                 let errorMsg = `HTTP 錯誤！狀態: ${response.status}`;
                 try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
                 if (response.status === 401) throw new Error('您需要登入才能查看管理列表。');
                throw new Error(errorMsg);
            }
            const newsList = await response.json(); // *** 管理 API 直接返回陣列 ***

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (newsTable) newsTable.style.display = 'table';

            if (!newsList || newsList.length === 0) {
                newsListBody.innerHTML = `<tr><td colspan="12">目前沒有消息。</td></tr>`; // *** 更新 Colspan ***
                return;
            }

            newsList.forEach(newsItem => {
                const row = document.createElement('tr');
                row.dataset.newsId = newsItem.id;
                // 使用輔助函數防止 XSS
                const escapeHtml = (unsafe) => {
                     if (unsafe === null || unsafe === undefined) return '';
                     // 修正：確保替換順序正確，先替換 &
                     return unsafe.toString()
                     .replace(/&/g, '&amp;')
        
                     // < 轉成 & l t ;
                     .replace(/</g, '&lt;')
             
                     // > 轉成 & g t ;
                     .replace(/>/g, '&gt;')
             
                     // " 轉成 & q u o t ;
                     .replace(/"/g, '&quot;')
             
                     // ' 轉成 & # 3 9 ;  (數字實體)
                     .replace(/'/g, '&#39;');
                };

                // 確保所有 12 個欄位都正確生成
                row.innerHTML = `
                    <td>${newsItem.id}</td>
                    <td>${escapeHtml(newsItem.title || '')}</td>
                    <td>${newsItem.event_date ? new Date(newsItem.event_date).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'}</td>
                    <td>${escapeHtml(newsItem.summary ? newsItem.summary.substring(0, 20) + (newsItem.summary.length > 20 ? '...' : '') : '')}</td>
                    <td><img src="${newsItem.thumbnail_url || '/images/placeholder.png'}" alt="縮圖" style="width: 50px; height: auto; border: 1px solid #eee; object-fit: contain; vertical-align: middle;"></td>
                    <td><img src="${newsItem.image_url || '/images/placeholder.png'}" alt="主圖" style="width: 50px; height: auto; border: 1px solid #eee; object-fit: contain; vertical-align: middle;"></td>
                    <td>${newsItem.like_count || 0}</td>
                    <td>${escapeHtml(newsItem.category || '-')}</td>
                    <td>${newsItem.show_in_calendar ? '是' : '否'}</td>
                    <td>${newsItem.created_at ? new Date(newsItem.created_at).toLocaleString('zh-TW') : '-'}</td>
                    <td>${newsItem.updated_at ? new Date(newsItem.updated_at).toLocaleString('zh-TW') : '-'}</td>
                    <td class="actions">
                        <button class="btn btn-warning btn-sm edit-news-btn" data-id="${newsItem.id}">編輯</button>
                        <button class="btn btn-danger btn-sm delete-news-btn" data-id="${newsItem.id}">刪除</button>
                    </td>
                `;
                newsListBody.appendChild(row);
            });

            // (如果沒有新聞) 更新 Colspan
            if (!newsList || newsList.length === 0) {
                newsListBody.innerHTML = `<tr><td colspan="12">目前沒有消息。</td></tr>`; // <<< Colspan 應為 12
            }

             // 在渲染完表格後，為按鈕添加事件監聽器 (使用事件委派)
             addTableButtonListeners(); // 確保這行在 forEach 之後

        } catch (error) {
            console.error("獲取管理消息列表失敗:", error);
            if (loadingMessage) loadingMessage.textContent = `無法載入消息列表: ${error.message}`;
            if (newsTable) newsTable.style.display = 'none';
             if (error.message.includes('登入')) {
                alert('請先登入管理後台！');
                // window.location.href = '/login.html'; // 或導向登入頁
            }
        }
    }

     // --- 為表格按鈕添加事件監聽 (事件委派) ---
     function addTableButtonListeners() {
        if (!newsListBody) return;

        newsListBody.removeEventListener('click', handleTableButtonClick); // 先移除舊監聽器
        newsListBody.addEventListener('click', handleTableButtonClick);
     }

     // --- 表格按鈕點擊處理函數 ---
     async function handleTableButtonClick(event) {
        const target = event.target;
        if (target.matches('.edit-news-btn')) {
            const newsId = target.dataset.id;
            if (newsId) {
                // 獲取完整的 newsItem 數據來填充表單
                 try {
                    const response = await fetch(`/api/admin/news/${newsId}`);
                    if (!response.ok) throw new Error('無法獲取編輯數據');
                    const newsItem = await response.json();
                    openEditNewsModal(newsItem); // 傳遞完整數據
                 } catch (error) {
                    console.error("獲取編輯數據失敗:", error);
                    alert("無法載入編輯數據，請重試。");
                 }
            }
        } else if (target.matches('.delete-news-btn')) {
            const newsId = target.dataset.id;
            if (newsId) {
                deleteNews(newsId);
            }
        }
     }


    // --- Function to Open and Populate the Edit News Modal ---
    function openEditNewsModal(newsItem) {
        const requiredElements = [editModal, editForm, editNewsIdInput, editNewsTitle, editNewsEventDate, editNewsSummary, editNewsContent, editNewsThumbnailUrl, editNewsThumbnailPreview, editNewsImageUrl, editFormError, editNewsCategoryInput, editNewsShowInCalendar];
        if (requiredElements.some(el => !el)) { console.error("編輯 Modal 元件缺失。"); alert("編輯視窗元件錯誤。"); return; }

        editFormError.textContent = '';
        editForm.reset(); // 先重置表單

        // 填充表單欄位
        editNewsIdInput.value = newsItem.id;
        editNewsTitle.value = newsItem.title || '';
        editNewsEventDate.value = newsItem.event_date ? newsItem.event_date.split('T')[0] : '';
        editNewsSummary.value = newsItem.summary || '';
        editNewsContent.value = newsItem.content || '';
        editNewsThumbnailUrl.value = newsItem.thumbnail_url || '';
        editNewsImageUrl.value = newsItem.image_url || '';
        editNewsCategoryInput.value = newsItem.category || ''; // 填充分類
        editNewsShowInCalendar.checked = newsItem.show_in_calendar || false; // 填充 Checkbox

        // 處理預覽圖
        if (editNewsThumbnailPreview) {
            if (newsItem.thumbnail_url) {
                editNewsThumbnailPreview.src = newsItem.thumbnail_url;
                editNewsThumbnailPreview.style.display = 'block';
            } else {
                editNewsThumbnailPreview.src = '';
                editNewsThumbnailPreview.style.display = 'none';
            }
        }

        fetchAndRenderCategoryTags('edit'); // 為 Edit Modal 載入標籤
        editModal.style.display = 'flex';
    }

    // --- Function to Open Add News Modal ---
    function openAddNewsModal() {
        const requiredElements = [addModal, addForm, addNewsTitle, addNewsEventDate, addNewsSummary, addNewsContent, addNewsThumbnailUrl, addNewsThumbnailPreview, addNewsImageUrl, addFormError, addNewsCategoryInput, addNewsShowInCalendar];
        if (requiredElements.some(el => !el)) { console.error("新增 Modal 元件缺失。"); alert("新增視窗元件錯誤。"); return; }

        addFormError.textContent = '';
        addForm.reset(); // 重置表單
        if(addNewsShowInCalendar) addNewsShowInCalendar.checked = false; // 預設不勾選
        // 處理縮圖預覽
        if (addNewsThumbnailPreview) {
             addNewsThumbnailPreview.src = '';
             addNewsThumbnailPreview.style.display = 'none';
        }

        fetchAndRenderCategoryTags('add'); // 為 Add Modal 載入標籤
        addModal.style.display = 'flex';
    }


    // --- Function to Close Modals ---
    function closeModal(modalElement) {
        if (modalElement) { modalElement.style.display = 'none'; }
    }

    // --- Function to Delete News Item ---
    async function deleteNews(id) {
        if (confirm(`確定要刪除消息 ID: ${id} 嗎？`)) {
            try {
                const response = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' });
                if (response.status === 204 || response.ok) {
                    await fetchAndDisplayNews(); // 刷新列表
                     alert('消息刪除成功！');
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${response.statusText}`; } throw new Error(errorMsg);
                }
            } catch (error) { alert(`刪除時發生錯誤：${error.message}`); }
        }
    }

     // --- 處理縮圖預覽更新 ---
     function setupImagePreview(urlInput, previewElement) {
         if (urlInput && previewElement) {
             urlInput.addEventListener('input', () => {
                 const url = urlInput.value.trim();
                 if (url) {
                     previewElement.src = url;
                     previewElement.style.display = 'block';
                 } else {
                     previewElement.src = '';
                     previewElement.style.display = 'none';
                 }
             });
         }
     }
     setupImagePreview(addNewsThumbnailUrl, addNewsThumbnailPreview);
     setupImagePreview(editNewsThumbnailUrl, editNewsThumbnailPreview);


    // --- Form Submission Handler (Unified for Add/Edit) ---
    async function handleFormSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const isEditMode = form.id === 'edit-news-form';
        const newsId = isEditMode ? editNewsIdInput.value : null;
        const formErrorElement = isEditMode ? editFormError : addFormError;

        formErrorElement.textContent = ''; // 清除舊錯誤

        // 獲取表單數據
        const titleInput = document.getElementById(isEditMode ? 'edit-news-title' : 'add-news-title');
        const eventDateInput = document.getElementById(isEditMode ? 'edit-news-event-date' : 'add-news-event-date');
        const summaryInput = document.getElementById(isEditMode ? 'edit-news-summary' : 'add-news-summary');
        const contentInput = document.getElementById(isEditMode ? 'edit-news-content' : 'add-news-content');
        const thumbnailUrlInput = document.getElementById(isEditMode ? 'edit-news-thumbnail-url' : 'add-news-thumbnail-url');
        const imageUrlInput = document.getElementById(isEditMode ? 'edit-news-image-url' : 'add-news-image-url');
        const categoryInput = document.getElementById(isEditMode ? 'edit-news-category' : 'add-news-category');
        const showInCalendarCheckbox = document.getElementById(isEditMode ? 'edit-news-show-in-calendar' : 'add-news-show-in-calendar');

        // 檢查元素是否存在
        const inputs = [titleInput, eventDateInput, summaryInput, contentInput, thumbnailUrlInput, imageUrlInput, categoryInput, showInCalendarCheckbox];
        if (inputs.some(el => !el)) {
            formErrorElement.textContent = '表單元件查找失敗，請檢查 HTML ID。';
            console.error("表單元素缺失", inputs);
            return;
        }


        const title = titleInput.value.trim();
        const event_date = eventDateInput.value; // YYYY-MM-DD 或空字串
        const summary = summaryInput.value.trim();
        const content = contentInput.value.trim();
        const thumbnail_url = thumbnailUrlInput.value.trim();
        const image_url = imageUrlInput.value.trim();
        const category = categoryInput.value.trim();
        const show_in_calendar = showInCalendarCheckbox.checked;

        // 驗證
        if (!title) { formErrorElement.textContent = '消息標題為必填項！'; return; }

        const newsData = {
            title: title,
            event_date: event_date || null, // 後端會處理空字串
            summary: summary || null,
            content: content || null,
            thumbnail_url: thumbnail_url || null,
            image_url: image_url || null,
            category: category || null,
            show_in_calendar: show_in_calendar
        };

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
            await fetchAndDisplayNews(); // 刷新列表
            alert(`消息已成功${isEditMode ? '更新' : '新增'}！`);

        } catch (error) {
            console.error('儲存消息失敗:', error);
            formErrorElement.textContent = `儲存失敗: ${error.message}`;
            alert(`儲存失敗: ${error.message}`);
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    }


    // --- Event Listeners ---
    if (addNewsBtn) { // 綁定新增按鈕
        addNewsBtn.addEventListener('click', openAddNewsModal);
    } else {
        console.warn("警告：未找到新增按鈕 #add-news-btn");
    }

    // 綁定表單提交事件
    if (addForm) addForm.addEventListener('submit', handleFormSubmit);
    if (editForm) editForm.addEventListener('submit', handleFormSubmit);

    // 綁定 Modal 關閉事件
    [addModal, editModal].forEach(modal => {
         if (modal) {
             const closeBtn = modal.querySelector('.close-btn');
             if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal));
             // 點擊背景關閉 (可選)
             // modal.addEventListener('click', (event) => { if(event.target === modal) closeModal(modal); });
         }
    });


    // --- Initial Load ---
    await fetchAndDisplayNews(); // 使用 await 確保列表先載入
    fetchAndRenderCategoryTags('add');   // 預載 Add Modal 的分類
    fetchAndRenderCategoryTags('edit');  // 預載 Edit Modal 的分類

    console.log("News Admin JS Initialized.");

}); // End of DOMContentLoaded