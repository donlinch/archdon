// public/news-admin.js (整合後完整版 v2 - 匹配最新 HTML)
document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Element References ---
    const newsListBody = document.querySelector('#news-list-table tbody');
    const newsListContainer = document.getElementById('news-list-container');
    const newsTable = document.getElementById('news-list-table');
    const loadingMessage = newsListContainer ? newsListContainer.querySelector('p') : null;
    const addNewsBtn = document.getElementById('add-news-btn'); // 新增按鈕的 ID

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
    const addNewsThumbnailPreview = document.getElementById('add-news-thumbnail-preview');
    const addNewsImageUrl = document.getElementById('add-news-image-url');
    const addFormError = document.getElementById('add-news-form-error');
    // 新增: Add Modal 的新元素
    const addNewsCategoryInput = document.getElementById('add-news-category');
    const addCategorySuggestions = document.getElementById('add-category-suggestions');
    const addCommonCategoriesContainer = document.getElementById('add-common-categories');
    const addCategoryTagsLoading = document.getElementById('add-category-tags-loading');
    const addNewsShowInCalendar = document.getElementById('add-news-show-in-calendar');

    // --- 檢查核心元素 ---
    const coreElements = [newsListBody, newsListContainer, newsTable, addModal, editModal, addForm, editForm, addNewsBtn]; // 加入 addNewsBtn 檢查
    if (coreElements.some(el => !el)) {
        console.error("頁面初始化失敗：缺少必要的 HTML 元素 (表格、Modal、表單或新增按鈕)。請檢查 ID。");
        if(loadingMessage) loadingMessage.textContent = "頁面載入錯誤，請聯繫管理員。";
        return; // 停止執行
    }

    // --- 獲取並渲染常用分類標籤 ---
    async function fetchAndRenderCategoryTags(modalType = 'add') {
        const container = modalType === 'edit' ? editCommonCategoriesContainer : addCommonCategoriesContainer;
        const loadingSpan = modalType === 'edit' ? editCategoryTagsLoading : addCategoryTagsLoading;
        const suggestionsList = modalType === 'edit' ? editCategorySuggestions : addCategorySuggestions;
        const targetInput = modalType === 'edit' ? editNewsCategoryInput : addNewsCategoryInput;

        // 確保元素存在才繼續
        if (!container || !loadingSpan || !targetInput) {
            console.warn(`分類標籤相關元素未找到 (modalType: ${modalType})。`);
            return;
        }

        loadingSpan.textContent = '載入中...';
        loadingSpan.style.color = '#888';
        loadingSpan.style.display = 'inline';

        // 清空舊標籤
        const existingTags = container.querySelectorAll('.category-tag');
        existingTags.forEach(tag => tag.remove());
        if (suggestionsList) suggestionsList.innerHTML = '';

        try {
            const response = await fetch('/api/news/categories'); // 使用公開 API 獲取分類
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
                        targetInput.value = category; // 點擊填入輸入框
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



// --- **修改/新增 Modal 關閉事件處理** ---
[addModal, editModal].forEach(modal => {
    if (modal) {
        // 處理右上角 X 按鈕
        const closeBtn = modal.querySelector('.close-btn');
        if (closeBtn) {
            // 使用 removeEventListener 確保只綁定一次
            closeBtn.removeEventListener('click', () => closeModal(modal));
            closeBtn.addEventListener('click', () => closeModal(modal));
        } else {
            console.warn(`未找到 Modal (ID: ${modal.id}) 的右上角關閉按鈕 (.close-btn)`);
        }

        // --- *** 新增: 處理底部的取消按鈕 *** ---
        const cancelBtn = modal.querySelector('.action-btn.cancel-btn'); // 查找 class 為 action-btn cancel-btn 的按鈕
        if (cancelBtn) {
            cancelBtn.removeEventListener('click', () => closeModal(modal));
            cancelBtn.addEventListener('click', () => closeModal(modal));
        } else {
            console.warn(`未找到 Modal (ID: ${modal.id}) 的底部取消按鈕 (.action-btn.cancel-btn)`);
        }

        // 點擊背景關閉 (可選)
        modal.removeEventListener('click', handleBackgroundClick); // 移除舊的
        modal.addEventListener('click', handleBackgroundClick); // 添加新的
    }
});

// 提取背景點擊處理函數
function handleBackgroundClick(event) {
    if (event.target === this) { // this 指的是被點擊的 modal 元素
        closeModal(this);
    }
}
// --- Modal 關閉事件處理結束 ---



    // --- Function to Fetch and Display ALL News in the Table ---
    async function fetchAndDisplayNews() {
        if (!newsListBody || !newsListContainer || !newsTable) { return; }
        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (newsTable) newsTable.style.display = 'none';
            newsListBody.innerHTML = '';

            const response = await fetch('/api/admin/news'); // 使用管理 API
            if (!response.ok) {
                 let errorMsg = `HTTP 錯誤！狀態: ${response.status}`;
                 try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
                 if (response.status === 401) throw new Error('您需要登入才能查看管理列表。');
                throw new Error(errorMsg);
            }
            const newsList = await response.json();

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (newsTable) newsTable.style.display = 'table';

            // 使用輔助函數防止 XSS
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

            if (!newsList || newsList.length === 0) {
                newsListBody.innerHTML = `<tr><td colspan="12">目前沒有消息。</td></tr>`; // Colspan 應為 12
                return;
            }

            newsList.forEach(newsItem => {
                const row = document.createElement('tr');
                row.dataset.newsId = newsItem.id;

                // 生成表格行內容 (確保 12 個 <td>)
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
                     <td class="actions">
                        <button class="btn btn-warning btn-sm edit-news-btn" data-id="${newsItem.id}">編輯</button>
                        <button class="btn btn-danger btn-sm delete-news-btn" data-id="${newsItem.id}">刪除</button>
                    </td>
                `;
                newsListBody.appendChild(row);
            });

             addTableButtonListeners(); // 添加事件監聽器
 
        } catch (error) {
            console.error("獲取管理消息列表失敗:", error);
            if (loadingMessage) loadingMessage.textContent = `無法載入消息列表: ${error.message}`;
            if (newsTable) newsTable.style.display = 'none';
             if (error.message.includes('登入')) {
                alert('請先登入管理後台！');
             }
        }
    }

     // --- 為表格按鈕添加事件監聽 (事件委派) ---
     function addTableButtonListeners() {
        if (!newsListBody) return;
        newsListBody.removeEventListener('click', handleTableButtonClick); // 移除舊監聽器
        newsListBody.addEventListener('click', handleTableButtonClick);
     }

     // --- 表格按鈕點擊處理函數 ---
     async function handleTableButtonClick(event) {
        const target = event.target;
        if (target.matches('.edit-news-btn')) {
            const newsId = target.dataset.id;
            if (newsId) {
                 try {
                    const response = await fetch(`/api/admin/news/${newsId}`); // 使用管理 API
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
                // 獲取標題用於確認對話框 (可選)
                const title = target.closest('tr')?.querySelector('td:nth-child(2)')?.textContent || `ID: ${newsId}`;
                deleteNews(newsId, title);
            }
        }
     }


    // --- Function to Open and Populate the Edit News Modal ---
    function openEditNewsModal(newsItem) {
        // 檢查必要的編輯 Modal 元素是否存在
        const requiredEditElements = [editModal, editForm, editNewsIdInput, editNewsTitle, editNewsEventDate, editNewsSummary, editNewsContent, editNewsThumbnailUrl, editNewsThumbnailPreview, editNewsImageUrl, editFormError, editNewsCategoryInput, editNewsShowInCalendar];
        if (requiredEditElements.some(el => !el)) { console.error("編輯 Modal 元件缺失。"); alert("編輯視窗元件錯誤。"); return; }

        editFormError.textContent = '';
        editForm.reset();

        // 填充表單欄位
        editNewsIdInput.value = newsItem.id;
        editNewsTitle.value = newsItem.title || '';
        // 將 ISO 日期格式化為 YYYY-MM-DD 給 date input
        editNewsEventDate.value = newsItem.event_date ? newsItem.event_date.split('T')[0] : '';
        editNewsSummary.value = newsItem.summary || '';
        editNewsContent.value = newsItem.content || '';
        editNewsThumbnailUrl.value = newsItem.thumbnail_url || '';
        editNewsImageUrl.value = newsItem.image_url || '';
        console.log('分類預設值：', newsItem.category);
        editNewsCategoryInput.value = newsItem.category || '';
                editNewsShowInCalendar.checked = (newsItem.show_in_calendar === true || newsItem.show_in_calendar === 'true');

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
        // 檢查必要的新增 Modal 元素是否存在
        const requiredAddElements = [addModal, addForm, addNewsTitle, addNewsEventDate, addNewsSummary, addNewsContent, addNewsThumbnailUrl, addNewsThumbnailPreview, addNewsImageUrl, addFormError, addNewsCategoryInput, addNewsShowInCalendar];
        if (requiredAddElements.some(el => !el)) { console.error("新增 Modal 元件缺失。"); alert("新增視窗元件錯誤。"); return; }

        addFormError.textContent = '';
        addForm.reset();
        addNewsShowInCalendar.checked = false; // 新增時預設不勾選
        if (addNewsThumbnailPreview) { // 重置縮圖預覽
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
    async function deleteNews(id, title) { // 加入 title 參數用於確認
        if (confirm(`確定要刪除消息 "${title || 'ID: '+id}" 嗎？`)) {
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
            // 先移除舊的監聽器，防止重複綁定
            urlInput.removeEventListener('input', handlePreviewUpdate);
            // 添加新的監聽器
            urlInput.addEventListener('input', handlePreviewUpdate);
         }
     }
     // 將預覽更新邏輯提取成獨立函數
     function handlePreviewUpdate(event) {
        const urlInput = event.target;
        // 根據 input ID 找到對應的 preview 元素
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
        }
     }

     // 為兩個 Modal 的縮圖輸入框設置預覽
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

        // --- ** 統一從 ID 獲取元素，確保獲取的是當前操作 Modal 的元素 ** ---
        const titleInput = document.getElementById(isEditMode ? 'edit-news-title' : 'add-news-title');
        const eventDateInput = document.getElementById(isEditMode ? 'edit-news-event-date' : 'add-news-event-date');
        const summaryInput = document.getElementById(isEditMode ? 'edit-news-summary' : 'add-news-summary');
        const contentInput = document.getElementById(isEditMode ? 'edit-news-content' : 'add-news-content');
        const thumbnailUrlInput = document.getElementById(isEditMode ? 'edit-news-thumbnail-url' : 'add-news-thumbnail-url');
        const imageUrlInput = document.getElementById(isEditMode ? 'edit-news-image-url' : 'add-news-image-url');
        const categoryInput = document.getElementById(isEditMode ? 'edit-news-category' : 'add-news-category');
        const showInCalendarCheckbox = document.getElementById(isEditMode ? 'edit-news-show-in-calendar' : 'add-news-show-in-calendar');

        // 再次檢查，確保元素都獲取到了
        const inputs = [titleInput, eventDateInput, summaryInput, contentInput, thumbnailUrlInput, imageUrlInput, categoryInput, showInCalendarCheckbox];
        if (inputs.some(el => !el)) {
            const missingIds = inputs.map((el, i) => !el ? (isEditMode ? ['edit-news-title', 'edit-news-event-date', /*...*/ 'edit-news-category', 'edit-news-show-in-calendar'] : ['add-news-title', 'add-news-event-date', /*...*/ 'add-news-category', 'add-news-show-in-calendar'])[i] : null).filter(Boolean);
            formErrorElement.textContent = `表單元件查找失敗，請檢查 HTML ID: ${missingIds.join(', ')}。`;
            console.error("表單元素缺失", missingIds);
            return;
        }

        // 獲取表單數據
        const title = titleInput.value.trim();
        const event_date = eventDateInput.value;
        const summary = summaryInput.value.trim();
        const content = contentInput.value.trim();
        const thumbnail_url = thumbnailUrlInput.value.trim();
        const image_url = imageUrlInput.value.trim();
  

        const category = categoryInput ? categoryInput.value.trim() : '';
        const show_in_calendar = showInCalendarCheckbox ? showInCalendarCheckbox.checked : false;
        console.log('讀取的分類:', category); // <-- 添加檢查
        console.log('讀取的行事曆顯示狀態:', show_in_calendar); // <-- 添加檢查



        // 驗證
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
        console.log('準備發送的 newsData:', newsData); // <-- 添加檢查

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


    // --- Event Listeners Setup ---
    if (addNewsBtn) {
        addNewsBtn.addEventListener('click', openAddNewsModal);
    }
    // 綁定表單提交事件
    if (addForm) addForm.addEventListener('submit', handleFormSubmit);
    if (editForm) editForm.addEventListener('submit', handleFormSubmit);

    // 綁定 Modal 關閉按鈕事件 (使用事件委派)
    document.addEventListener('click', (event) => {
        if (event.target.matches('.close-btn')) {
            const modal = event.target.closest('.modal');
            if (modal) {
                closeModal(modal);
            }
        }
         // 點擊背景關閉 (可選)
         // if (event.target.matches('.modal')) {
         //     closeModal(event.target);
         // }
    });


    // --- Initial Load ---
    try {
        await fetchAndDisplayNews(); // 載入新聞列表
        // 同時異步預載分類，不需要 await，讓頁面更快顯示列表
        fetchAndRenderCategoryTags('add');
        fetchAndRenderCategoryTags('edit');
        console.log("News Admin JS Initialized.");
    } catch (initError) {
         console.error("頁面初始化載入新聞列表失敗:", initError);
         // 可以在頁面顯示一個更明顯的全局錯誤提示
    }

}); // End of DOMContentLoaded