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
    async function fetchAndDisplayNews() {
        if (!newsListBody || !newsListContainer || !newsTable || !loadingMessage) {
            console.error("消息列表的 DOM 元素不完整。");
            if(loadingMessage) loadingMessage.textContent = '頁面元件錯誤。';
            return;
        }
        try {
            if (loadingMessage) {
                 loadingMessage.style.display = 'block';
                 loadingMessage.textContent = '正在加載消息...';
            }
            if (newsTable) newsTable.style.display = 'none';
            newsListBody.innerHTML = ''; // 清空舊內容
    
            // --- 修改 API URL ---
            const response = await fetch('/api/admin/news');
    
            // --- 處理可能的錯誤 ---
            if (!response.ok) {
                let errorMsg = `HTTP 錯誤！狀態: ${response.status}`;
                try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {}
                // --- 檢查是否為 401 Unauthorized ---
                if (response.status === 401) {
                    alert('您需要登入才能查看管理列表！');
                    // 可以選擇性地跳轉到登入頁面或顯示登入提示
                    // window.location.href = '/login.html'; // 如果有登入頁
                }
                throw new Error(errorMsg);
            }
    
            // --- 直接使用回應的陣列 ---
            const newsList = await response.json();
    
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (newsTable) newsTable.style.display = 'table';
            newsListBody.innerHTML = ''; // 確保清空
    
            if (newsList.length === 0) {
                newsListBody.innerHTML = '<tr><td colspan="6">目前沒有消息。</td></tr>'; // Colspan 確保正確
                return;
            }
    
            newsList.forEach(newsItem => {
                const row = document.createElement('tr');
                row.dataset.newsId = newsItem.id;
                // 檢查 event_date 是否存在且有效
                let eventDateFormatted = 'N/A';
                if (newsItem.event_date) {
                    try {
                        eventDateFormatted = new Date(newsItem.event_date).toLocaleDateString('zh-TW');
                    } catch (e) { console.warn(`Invalid event_date format for news ID ${newsItem.id}: ${newsItem.event_date}`); }
                }
                // 檢查 updated_at 是否存在且有效
                let updatedAtFormatted = 'N/A';
                if (newsItem.updated_at) {
                    try {
                        updatedAtFormatted = new Date(newsItem.updated_at).toLocaleString('zh-TW');
                    } catch (e) { console.warn(`Invalid updated_at format for news ID ${newsItem.id}: ${newsItem.updated_at}`); }
                }
    
                row.innerHTML = `
                    <td>${newsItem.id}</td>
                    <td>${newsItem.title || ''}</td>
                    <td>${eventDateFormatted}</td>
                    <td><img src="${newsItem.thumbnail_url || '/images/placeholder.png'}" alt="${newsItem.title || ''}" style="width: 50px; height: auto; border: 1px solid #eee;"></td>
                    <td>${updatedAtFormatted}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="window.editNews(${newsItem.id})">編輯</button>
                        <button class="action-btn delete-btn" onclick="window.deleteNews(${newsItem.id})">刪除</button>
                    </td>
                `;
                newsListBody.appendChild(row);
            });
        } catch (error) {
            console.error("獲取管理消息列表失敗:", error);
            if (loadingMessage) loadingMessage.textContent = `無法載入消息列表：${error.message}`;
            if (newsTable) newsTable.style.display = 'none';
            if(newsListBody) newsListBody.innerHTML = `<tr><td colspan="6" style="color:red;text-align:center;">載入失敗: ${error.message}</td></tr>`; // 顯示錯誤
        }
    }
    // --- Function to Open and Populate the Edit News Modal ---
    async function openEditNewsModal(id) { // *** 修改函數名 ***
        const requiredEditElements = [editModal, editForm, editNewsId, editNewsTitle, editNewsEventDate, editNewsSummary, editNewsContent, editNewsThumbnailUrl, editNewsThumbnailPreview, editNewsImageUrl, editFormError]; // *** 更新檢查列表 ***
        if (requiredEditElements.some(el => !el)) { /* ... 報錯 ... */ return; }
        editFormError.textContent = ''; editForm.reset(); editNewsThumbnailPreview.style.display = 'none'; editNewsThumbnailPreview.src = ''; // *** 修改預覽 ID ***

        try {
            // --- 修改 API URL ---
            const response = await fetch(`/api/admin/news/${id}`);
    
            if (!response.ok) {
                let errorMsg = `無法獲取消息資料 (HTTP ${response.status})`;
                if (response.status === 404) errorMsg = '找不到該消息。';
                else { try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} }
                 // --- 檢查是否為 401 Unauthorized ---
                 if (response.status === 401) {
                    alert('您需要登入才能編輯消息！');
                 }
                throw new Error(errorMsg);
            }
            const newsItem = await response.json();
    
            // --- 填充表單欄位 (保持不變) ---
            editNewsId.value = newsItem.id;
            editNewsTitle.value = newsItem.title || '';
            // 確保日期格式正確 (YYYY-MM-DD)
            editNewsEventDate.value = newsItem.event_date ? newsItem.event_date.split('T')[0] : '';
            editNewsSummary.value = newsItem.summary || '';
            editNewsContent.value = newsItem.content || '';
            editNewsThumbnailUrl.value = newsItem.thumbnail_url || '';
            editNewsImageUrl.value = newsItem.image_url || '';
    
            if (newsItem.thumbnail_url) {
                editNewsThumbnailPreview.src = newsItem.thumbnail_url;
                editNewsThumbnailPreview.style.display = 'block';
            } else {
                editNewsThumbnailPreview.style.display = 'none';
            }
            editModal.style.display = 'flex';
        } catch (error) {
            console.error(`獲取消息 ${id} 進行編輯時出錯:`, error);
            alert(`無法載入編輯資料： ${error.message}`);
        }
    }
    // 將函數掛載到 window (保持不變)
    window.editNews = openEditNewsModal;
    // --- Function to Close the Edit News Modal ---
    window.closeEditNewsModal = function() { if (editModal) { editModal.style.display = 'none'; } } // *** 修改函數名 ***

    // --- Function to Close the Add News Modal ---
    window.closeAddNewsModal = function() { if (addModal) { addModal.style.display = 'none'; } } // *** 修改函數名 ***

    // --- Attach Edit Function to Global Scope ---
    window.editNews = function(id) { openEditNewsModal(id); }; // *** 修改函數名 ***

   
window.deleteNews = async function(id) {
    if (confirm(`確定要刪除消息 ID: ${id} 嗎？`)) {
        try {
            // --- 修改 API URL ---
            const response = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' });

            if (response.status === 401) {
                alert('您需要登入才能刪除消息！');
                return; // 阻止後續操作
            }

            if (response.status === 204 || response.ok) { // 204 表示成功無內容
                console.log(`消息 ID ${id} 已刪除。`);
                await fetchAndDisplayNews(); // 重新載入列表
            } else {
                let errorMsg = `刪除失敗 (HTTP ${response.status})`;
                // 404 Not Found
                if (response.status === 404) {
                     errorMsg = "找不到要刪除的消息。";
                } else {
                     // 嘗試讀取錯誤 body
                     try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${response.statusText}`; }
                }
                throw new Error(errorMsg);
            }
        } catch (error) {
            alert(`刪除時發生錯誤：${error.message}`);
            console.error(`刪除消息 ID ${id} 時出錯:`, error);
        }
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