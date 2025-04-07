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
        if (!newsListBody || !newsListContainer || !newsTable || !loadingMessage) {
            console.error("獲取新聞列表所需的 DOM 元素不完整。");
            if(loadingMessage) loadingMessage.textContent = '頁面結構錯誤，無法載入列表。';
            return;
       }         try {
        loadingMessage.style.display = 'block';
        loadingMessage.textContent = '正在載入消息...'; // 更新提示文字
        newsTable.style.display = 'none';
        newsListBody.innerHTML = ''; // 清空舊內容

       // 使用後台 API 端點
       const response = await fetch('/api/admin/news');

       if (!response.ok) {
           let errorMsg = `HTTP 錯誤！狀態: ${response.status}`;
            if (response.status === 401 || response.status === 403) {
                errorMsg += ` - 請確認您已登入且有權限訪問此資源。`;
                alert('請先登入管理後台才能查看此內容。'); // 直接提示用戶
            } else {
               try { const errData = await response.json(); errorMsg += `: ${errData.error || '未知錯誤'}`; } catch (e) {}
            }
           throw new Error(errorMsg);
       }

            // --- 【★ 關鍵修正：直接使用回應的陣列 ★】 ---
            const newsList = await response.json();
            // 不再需要 const newsList = data.news;
            // --- 修正結束 ---

            loadingMessage.style.display = 'none';
            newsTable.style.display = 'table';

            if (!Array.isArray(newsList)) { // 添加一個檢查，確保收到的是陣列
                throw new Error("API 返回的數據不是預期的陣列格式。");
           }

           if (newsList.length === 0) {
               newsListBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">目前沒有消息。</td></tr>';
               return;
           }


            // 渲染表格行 (forEach 邏輯不變)
            newsList.forEach(newsItem => {
                const row = document.createElement('tr');
                row.dataset.newsId = newsItem.id;
                // 格式化日期和時間
                const eventDateStr = newsItem.event_date ? new Date(newsItem.event_date).toLocaleDateString('zh-TW') : 'N/A';
                const updatedDateStr = newsItem.updated_at ? new Date(newsItem.updated_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short', hour12: false }) : 'N/A';

                row.innerHTML = `
                    <td>${newsItem.id}</td>
                    <td title="${newsItem.title || ''}">${newsItem.title || ''}</td>
                    <td>${eventDateStr}</td>
                    <td><img src="${newsItem.thumbnail_url || '/images/placeholder.png'}" alt="${newsItem.title || ''}" style="width: 50px; height: auto; border: 1px solid #eee; object-fit: contain; vertical-align: middle;"></td>
                    <td>${updatedDateStr}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editNews(${newsItem.id})">編輯</button>
                        <button class="action-btn delete-btn" onclick="deleteNews(${newsItem.id})">刪除</button>
                    </td>
                `;
                newsListBody.appendChild(row);
            });
        } catch (error) {
            console.error("獲取管理消息列表失敗:", error);
            if(loadingMessage) loadingMessage.textContent = `無法載入消息列表：${error.message}`;
            if(newsTable) newsTable.style.display = 'none';
        }
    }
     // --- Function to Open and Populate the Edit News Modal (保持不變) ---
     async function openEditNewsModal(id) {
        const requiredEditElements = [editModal, editForm, editNewsId, editNewsTitle, editNewsEventDate, editNewsSummary, editNewsContent, editNewsThumbnailUrl, editNewsThumbnailPreview, editNewsImageUrl, editFormError];
        if (requiredEditElements.some(el => !el)) { /* ... 報錯 ... */ return; }
        editFormError.textContent = ''; editForm.reset(); editNewsThumbnailPreview.style.display = 'none'; editNewsThumbnailPreview.src = '';

        try {
            // 注意：編輯時仍然請求公開的 /api/news/:id，因為保護的是修改操作，不是讀取
            const response = await fetch(`/api/news/${id}`);
            if (!response.ok) { /* ... 錯誤處理 ... */ }
            const newsItem = await response.json();



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
       const requiredAddElements = [addModal, addForm, addNewsTitle, addNewsEventDate, addNewsSummary, addNewsContent, addNewsThumbnailUrl, addNewsImageUrl, addFormError, addNewsThumbnailPreview]; // 補上 addNewsThumbnailPreview
        if (requiredAddElements.some(el => !el)) { alert("新增視窗元件錯誤，無法開啟。"); return; }
        addFormError.textContent = ''; addForm.reset();
        if(addNewsThumbnailPreview) { addNewsThumbnailPreview.src=''; addNewsThumbnailPreview.style.display='none'; } // 清空預覽
        addModal.style.display = 'flex';
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
                if (!response.ok) { let errorMsg = `儲存失敗 (HTTP ${response.status})`; 
                try { const errorData = await response.json(); 
                    errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }

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