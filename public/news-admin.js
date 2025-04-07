// public/news-admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const newsListBody = document.querySelector('#news-list-table tbody'); // *** 修改 ID ***
    const newsListContainer = document.getElementById('news-list-container'); // *** 修改 ID ***
    const newsTable = document.getElementById('news-list-table'); // *** 修改 ID ***
    const loadingMessage = newsListContainer ? newsListContainer.querySelector('p') : null;

    // --- Edit Modal elements ---
    const editModal = document.getElementById('edit-news-modal'); // *** 修改 ID ***
    const editForm = document.getElementById('edit-news-form'); // *** 修改 ID ***
    const editNewsId = document.getElementById('edit-news-id'); // *** 修改 ID ***
    const editNewsTitle = document.getElementById('edit-news-title'); // *** 修改 ID ***
    const editNewsEventDate = document.getElementById('edit-news-event-date'); // *** 新增 ***
    const editNewsSummary = document.getElementById('edit-news-summary'); // *** 新增 ***
    const editNewsContent = document.getElementById('edit-news-content'); // *** 新增 ***
    const editNewsThumbnailUrl = document.getElementById('edit-news-thumbnail-url'); // *** 修改 ID ***
    const editNewsThumbnailPreview = document.getElementById('edit-news-thumbnail-preview'); // *** 修改 ID ***
    const editNewsImageUrl = document.getElementById('edit-news-image-url'); // *** 新增 ***
    const editFormError = document.getElementById('edit-news-form-error'); // *** 修改 ID ***

    // --- Add Modal elements ---
    const addModal = document.getElementById('add-news-modal'); // *** 修改 ID ***
    const addForm = document.getElementById('add-news-form'); // *** 修改 ID ***
    const addNewsTitle = document.getElementById('add-news-title'); // *** 修改 ID ***
    const addNewsEventDate = document.getElementById('add-news-event-date'); // *** 新增 ***
    const addNewsSummary = document.getElementById('add-news-summary'); // *** 新增 ***
    const addNewsContent = document.getElementById('add-news-content'); // *** 新增 ***
    const addNewsThumbnailUrl = document.getElementById('add-news-thumbnail-url'); // *** 修改 ID ***
    // const addNewsThumbnailPreview = document.getElementById('add-news-thumbnail-preview'); // HTML 中有此 ID
    const addNewsImageUrl = document.getElementById('add-news-image-url'); // *** 新增 ***
    const addFormError = document.getElementById('add-news-form-error'); // *** 修改 ID ***

    // --- Function to Fetch and Display ALL News in the Table ---
    async function fetchAndDisplayNews() { // *** 修改函數名 ***
        if (!newsListBody || !newsListContainer || !newsTable) { /* ... 錯誤處理 ... */ return; }
        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (newsTable) newsTable.style.display = 'none';

            const response = await fetch('/api/news?limit=999'); // *** 修改 API URL (暫不分頁，獲取全部) ***
            if (!response.ok) throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            const data = await response.json(); // API 返回 { news: [...] } 結構
            const newsList = data.news; // *** 提取 news 陣列 ***

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (newsTable) newsTable.style.display = 'table';
            newsListBody.innerHTML = '';

            if (newsList.length === 0) {
                newsListBody.innerHTML = '<tr><td colspan="6">目前沒有消息。</td></tr>'; // *** 修改 Colspan ***
                return;
            }

            newsList.forEach(newsItem => { // *** 修改變數名 ***
                const row = document.createElement('tr');
                row.dataset.newsId = newsItem.id; // *** 修改 dataset ***
                // *** 修改 row.innerHTML 以匹配消息欄位 ***
                row.innerHTML = `
                    <td>${newsItem.id}</td>
                    <td>${newsItem.title || ''}</td>
                    <td>${newsItem.event_date ? new Date(newsItem.event_date).toLocaleDateString() : 'N/A'}</td>
                    <td><img src="${newsItem.thumbnail_url || '/images/placeholder.png'}" alt="${newsItem.title || ''}" style="width: 50px; height: auto; border: 1px solid #eee;"></td>
                    <td>${newsItem.updated_at ? new Date(newsItem.updated_at).toLocaleString() : 'N/A'}</td> <!-- 顯示更新時間 -->
                    <td>
                        <button class="action-btn edit-btn" onclick="editNews(${newsItem.id})">編輯</button> <!-- *** 修改 onclick *** -->
                        <button class="action-btn delete-btn" onclick="deleteNews(${newsItem.id})">刪除</button> <!-- *** 修改 onclick *** -->
                    </td>
                `;
                newsListBody.appendChild(row);
            });
        } catch (error) { console.error("獲取管理消息列表失敗:", error); /* ... 錯誤處理 ... */ }
    }

    // --- Function to Open and Populate the Edit News Modal ---
    async function openEditNewsModal(id) { // *** 修改函數名 ***
        const requiredEditElements = [editModal, editForm, editNewsId, editNewsTitle, editNewsEventDate, editNewsSummary, editNewsContent, editNewsThumbnailUrl, editNewsThumbnailPreview, editNewsImageUrl, editFormError]; // *** 更新檢查列表 ***
        if (requiredEditElements.some(el => !el)) { /* ... 報錯 ... */ return; }
        editFormError.textContent = ''; editForm.reset(); editNewsThumbnailPreview.style.display = 'none'; editNewsThumbnailPreview.src = ''; // *** 修改預覽 ID ***

        try {
            const response = await fetch(`/api/news/${id}`); // *** 修改 API URL ***
            if (!response.ok) { if (response.status === 404) throw new Error('找不到該消息。'); throw new Error(`無法獲取消息資料 (HTTP ${response.status})`); }
            const newsItem = await response.json(); // *** 修改變數名 ***

            // *** 填充消息表單欄位 ***
            editNewsId.value = newsItem.id;
            editNewsTitle.value = newsItem.title || '';
            editNewsEventDate.value = newsItem.event_date ? newsItem.event_date.split('T')[0] : ''; // 處理日期格式
            editNewsSummary.value = newsItem.summary || '';
            editNewsContent.value = newsItem.content || '';
            editNewsThumbnailUrl.value = newsItem.thumbnail_url || '';
            editNewsImageUrl.value = newsItem.image_url || '';

            if (newsItem.thumbnail_url) { editNewsThumbnailPreview.src = newsItem.thumbnail_url; editNewsThumbnailPreview.style.display = 'block'; } // *** 修改預覽 ID 和 src ***
            else { editNewsThumbnailPreview.style.display = 'none'; }
            editModal.style.display = 'flex';
        } catch (error) { console.error(`獲取消息 ${id} 進行編輯時出錯:`, error); alert(`無法載入編輯資料： ${error.message}`); }
    }

    // --- Function to Close the Edit News Modal ---
    window.closeEditNewsModal = function() { if (editModal) { editModal.style.display = 'none'; } } // *** 修改函數名 ***

    // --- Function to Close the Add News Modal ---
    window.closeAddNewsModal = function() { if (addModal) { addModal.style.display = 'none'; } } // *** 修改函數名 ***

    // --- Attach Edit Function to Global Scope ---
    window.editNews = function(id) { openEditNewsModal(id); }; // *** 修改函數名 ***

    // --- Attach Delete Function to Global Scope ---
    window.deleteNews = async function(id) { // *** 修改函數名 ***
        if (confirm(`確定要刪除消息 ID: ${id} 嗎？`)) {
            try {
                const response = await fetch(`/api/news/${id}`, { method: 'DELETE' }); // *** 修改 API URL ***
                if (response.status === 204 || response.ok) {
                    await fetchAndDisplayNews(); // *** 修改調用函數 ***
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${response.statusText}`; } throw new Error(errorMsg);
                }
            } catch (error) { alert(`刪除時發生錯誤：${error.message}`); }
        }
    };

    // --- Attach Show Add Form Function to Global Scope ---
    window.showAddNewsForm = function() { // *** 修改函數名 ***
        const requiredAddElements = [addModal, addForm, addNewsTitle, addNewsEventDate, addNewsSummary, addNewsContent, addNewsThumbnailUrl, addNewsImageUrl, addFormError]; // *** 更新檢查列表 ***
        if (requiredAddElements.some(el => !el)) { alert("新增視窗元件錯誤，無法開啟。"); return; }
        addFormError.textContent = ''; addForm.reset(); addModal.style.display = 'flex';
    }

    // --- Close Modals if User Clicks Outside ---
    window.onclick = function(event) { if (event.target == editModal) { closeEditNewsModal(); } else if (event.target == addModal) { closeAddNewsModal(); } } // *** 修改調用函數 ***

    // --- Edit News Form Submission Listener ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault(); editFormError.textContent = ''; const newsId = editNewsId.value; if (!newsId) { /* ... 報錯 ... */ return; }
            // *** 收集消息表單數據 ***
            const updatedData = {
                 title: editNewsTitle.value.trim(),
                 event_date: editNewsEventDate.value || null,
                 summary: editNewsSummary.value.trim(),
                 content: editNewsContent.value.trim(),
                 thumbnail_url: editNewsThumbnailUrl.value.trim() || null,
                 image_url: editNewsImageUrl.value.trim() || null,
            };
            // *** 驗證消息數據 ***
            if (!updatedData.title) { editFormError.textContent = '標題不能為空。'; return; }
            // 可以添加更多驗證...

            try { // *** 發送 PUT 請求到 /api/news/:id ***
                const response = await fetch(`/api/news/${newsId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) });
                if (!response.ok) { let errorMsg = `儲存失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
                closeEditNewsModal(); // *** 修改調用函數 ***
                await fetchAndDisplayNews(); // *** 修改調用函數 ***
            } catch (error) { editFormError.textContent = `儲存錯誤：${error.message}`; }
        });
    } else { console.error("編輯消息表單元素未找到。"); }

    // --- Add News Form Submission Listener ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault(); addFormError.textContent = '';
            // *** 收集新增消息表單數據 ***
            const newNewsData = {
                title: addNewsTitle.value.trim(),
                event_date: addNewsEventDate.value || null,
                summary: addNewsSummary.value.trim(),
                content: addNewsContent.value.trim(),
                thumbnail_url: addNewsThumbnailUrl.value.trim() || null,
                image_url: addNewsImageUrl.value.trim() || null,
            };
            // *** 驗證新增消息數據 ***
             if (!newNewsData.title) { addFormError.textContent = '標題不能為空。'; return; }
             // 可以添加更多驗證...

            try { // *** 發送 POST 請求到 /api/news ***
                const response = await fetch(`/api/news`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newNewsData) });
                if (!response.ok) { let errorMsg = `新增失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
                closeAddNewsModal(); // *** 修改調用函數 ***
                await fetchAndDisplayNews(); // *** 修改調用函數 ***
            } catch (error) { addFormError.textContent = `新增錯誤：${error.message}`; }
        });
    } else { console.error("新增消息表單元素未找到。"); }

    // --- Initial Load ---
    fetchAndDisplayNews(); // *** 修改調用函數 ***

}); // End of DOMContentLoaded