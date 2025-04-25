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

    // --- 分類管理相關代碼 ---
    // DOM元素引用
    const categoryListBody = document.querySelector('#category-list-table tbody');
    const categoryListContainer = document.getElementById('category-list-container');
    const categoryTable = document.getElementById('category-list-table');
    const categoryLoading = document.getElementById('category-loading');
    const categoryCount = document.getElementById('category-count');

    // 編輯分類模態框元素
    const editCategoryModal = document.getElementById('edit-category-modal');
    const editCategoryForm = document.getElementById('edit-category-form');
    const editCategoryId = document.getElementById('edit-category-id');
    const editCategoryName = document.getElementById('edit-category-name');
    const editCategorySlug = document.getElementById('edit-category-slug');
    const editCategoryDescription = document.getElementById('edit-category-description');
    const editCategoryOrder = document.getElementById('edit-category-order');
    const editCategoryActive = document.getElementById('edit-category-active');
    const editCategoryFormError = document.getElementById('edit-category-form-error');

    // 新增分類模態框元素
    const addCategoryModal = document.getElementById('add-category-modal');
    const addCategoryForm = document.getElementById('add-category-form');
    const addCategoryName = document.getElementById('add-category-name');
    const addCategorySlug = document.getElementById('add-category-slug');
    const addCategoryDescription = document.getElementById('add-category-description');
    const addCategoryOrder = document.getElementById('add-category-order');
    const addCategoryActive = document.getElementById('add-category-active');
    const addCategoryFormError = document.getElementById('add-category-form-error');

    // 新聞表單中的分類選擇器
    const addNewsCategory = document.getElementById('add-news-category');
    const editNewsCategory = document.getElementById('edit-news-category');

    // 分類數據
    let categories = [];

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
                // 獲取分類名稱
                const categoryName = newsItem.category_name || '未分類';
                
                // 添加分類欄位
                row.innerHTML = `
                    <td>${newsItem.id}</td>
                    <td>${newsItem.title || ''}</td>
                    <td>${categoryName}</td> <!-- 分類欄位 -->
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

            // 設置分類值
            if (editNewsCategory && newsItem.category_id) {
                editNewsCategory.value = newsItem.category_id;
            }
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
                const response = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' }); // *** 修改 API URL ***
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
                 category_id: editNewsCategory ? parseInt(editNewsCategory.value) || null : null
            };
            // *** 驗證消息數據 ***
            if (!updatedData.title) { editFormError.textContent = '標題不能為空。'; return; }
            // 可以添加更多驗證...

            try { // *** 發送 PUT 請求到 /api/news/:id ***
                const response = await fetch(`/api/admin/news/${newsId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) });
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
                category_id: addNewsCategory ? parseInt(addNewsCategory.value) || null : null
            };
            // *** 驗證新增消息數據 ***
             if (!newNewsData.title) { addFormError.textContent = '標題不能為空。'; return; }
             // 可以添加更多驗證...

            try { // *** 發送 POST 請求到 /api/news ***
                const response = await fetch(`/api/admin/news`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newNewsData) });
                if (!response.ok) { let errorMsg = `新增失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
                closeAddNewsModal(); // *** 修改調用函數 ***
                await fetchAndDisplayNews(); // *** 修改調用函數 ***
            } catch (error) { addFormError.textContent = `新增錯誤：${error.message}`; }
        });
    } else { console.error("新增消息表單元素未找到。"); }

    // --- 分類管理相關函數 ---
    // 獲取並顯示分類列表
    async function fetchAndDisplayCategories() {
        try {
            if (categoryLoading) categoryLoading.style.display = 'block';
            if (categoryTable) categoryTable.style.display = 'none';

            const response = await fetch('/api/admin/news-categories');
            if (!response.ok) throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            categories = await response.json();

            if (categoryCount) categoryCount.textContent = categories.length;
            if (categoryLoading) categoryLoading.style.display = 'none';
            if (categoryTable) categoryTable.style.display = 'table';
            
            if (!categoryListBody) return;
            categoryListBody.innerHTML = '';

            if (categories.length === 0) {
                categoryListBody.innerHTML = '<tr><td colspan="7" class="text-center">目前沒有分類。</td></tr>';
            } else {
                categories.forEach(category => {
                    const row = document.createElement('tr');
                    const statusClass = category.is_active ? 'status-active' : 'status-inactive';
                    const statusText = category.is_active ? '啟用中' : '已停用';
                    
                    row.innerHTML = `
                        <td>${category.id}</td>
                        <td>${category.name || ''}</td>
                        <td>${category.slug || ''}</td>
                        <td>${category.description || ''}</td>
                        <td>${category.display_order}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>
                            <div class="action-btn-group">
                                <button class="action-btn edit-btn" onclick="editCategory(${category.id})">
                                    <i class="bi bi-pencil"></i>編輯
                                </button>
                                <button class="action-btn delete-btn" onclick="deleteCategory(${category.id})">
                                    <i class="bi bi-trash"></i>刪除
                                </button>
                            </div>
                        </td>
                    `;
                    categoryListBody.appendChild(row);
                });
            }

            // 填充新聞表單中的分類選擇器
            populateCategoryDropdowns();
        } catch (error) {
            console.error("獲取分類列表失敗:", error);
            if (categoryLoading) categoryLoading.innerHTML = `<div class="text-danger">載入失敗: ${error.message}</div>`;
        }
    }

    // 填充分類下拉選擇器
    function populateCategoryDropdowns() {
        if (!categories.length) return;
        
        // 構建選項HTML
        const optionsHTML = categories.map(category => 
            `<option value="${category.id}">${category.name}</option>`
        ).join('');
        
        // 新增表單中的分類選擇器
        if (addNewsCategory) {
            addNewsCategory.innerHTML = '<option value="">-- 選擇分類 --</option>' + optionsHTML;
        }
        
        // 編輯表單中的分類選擇器
        if (editNewsCategory) {
            editNewsCategory.innerHTML = '<option value="">-- 選擇分類 --</option>' + optionsHTML;
        }
    }

    // 打開編輯分類模態框並填充資料
    async function openEditCategoryModal(id) {
        if (!editCategoryFormError || !editCategoryForm) return;
        
        editCategoryFormError.textContent = '';
        editCategoryForm.reset();

        try {
            const response = await fetch(`/api/admin/news-categories/${id}`);
            if (!response.ok) {
                if (response.status === 404) throw new Error('找不到該分類。');
                throw new Error(`無法獲取分類資料 (HTTP ${response.status})`);
            }
            
            const category = await response.json();
            
            // 填充表單數據
            editCategoryId.value = category.id;
            editCategoryName.value = category.name || '';
            editCategorySlug.value = category.slug || '';
            editCategoryDescription.value = category.description || '';
            editCategoryOrder.value = category.display_order || 0;
            editCategoryActive.checked = category.is_active;
            
            editCategoryModal.style.display = 'flex';
        } catch (error) {
            console.error(`獲取分類 ${id} 進行編輯時出錯:`, error);
            alert(`無法載入編輯資料： ${error.message}`);
        }
    }

    // 關閉分類模態框
    window.closeEditCategoryModal = function() {
        if (editCategoryModal) editCategoryModal.style.display = 'none';
    };

    window.closeAddCategoryModal = function() {
        if (addCategoryModal) addCategoryModal.style.display = 'none';
    };

    // 打開新增分類模態框
    window.showAddCategoryForm = function() {
        if (!addCategoryFormError || !addCategoryForm) return;
        
        addCategoryFormError.textContent = '';
        addCategoryForm.reset();
        addCategoryOrder.value = '0';
        addCategoryActive.checked = true;
        addCategoryModal.style.display = 'flex';
    };

    // 全局編輯分類函數
    window.editCategory = function(id) {
        openEditCategoryModal(id);
    };

    // 全局刪除分類函數
    window.deleteCategory = async function(id) {
        if (confirm(`確定要刪除分類 ID: ${id} 嗎？\n注意：如果有消息使用此分類，將無法刪除。`)) {
            try {
                const response = await fetch(`/api/admin/news-categories/${id}`, { method: 'DELETE' });
                
                if (response.status === 204 || response.ok) {
                    await fetchAndDisplayCategories();
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorMsg;
                    } catch (e) {
                        errorMsg = `${errorMsg}: ${response.statusText}`;
                    }
                    throw new Error(errorMsg);
                }
            } catch (error) {
                alert(`刪除時發生錯誤：${error.message}`);
            }
        }
    };

    // 格式化slug，自動從名稱生成
    function formatSlug(text) {
        return text.toLowerCase()
            .replace(/[^\w\s-]/g, '') // 移除特殊字符
            .replace(/[\s_-]+/g, '-') // 替換空格和下划線為連字符
            .replace(/^-+|-+$/g, ''); // 移除前後的連字符
    }

    // 監聽分類表單事件
    if (addCategoryForm) {
        // 名稱輸入時自動更新slug
        addCategoryName.addEventListener('input', () => {
            if (!addCategorySlug.value || addCategorySlug._autoFilled) {
                addCategorySlug.value = formatSlug(addCategoryName.value);
                addCategorySlug._autoFilled = true;
            }
        });

        addCategorySlug.addEventListener('input', () => {
            addCategorySlug._autoFilled = false;
        });

        // 提交新增分類表單
        addCategoryForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            addCategoryFormError.textContent = '';
            
            // 收集新增數據
            const newCategoryData = {
                name: addCategoryName.value.trim(),
                slug: addCategorySlug.value.trim(),
                description: addCategoryDescription.value.trim() || null,
                display_order: parseInt(addCategoryOrder.value) || 0,
                is_active: addCategoryActive.checked
            };
            
            // 驗證
            if (!newCategoryData.name) {
                addCategoryFormError.textContent = '分類名稱不能為空。';
                return;
            }
            if (!newCategoryData.slug) {
                addCategoryFormError.textContent = '分類標識符不能為空。';
                return;
            }
            if (!/^[a-z0-9-]+$/.test(newCategoryData.slug)) {
                addCategoryFormError.textContent = '標識符只能包含小寫字母、數字和連字符。';
                return;
            }
            
            try {
                const response = await fetch(`/api/admin/news-categories`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newCategoryData)
                });
                
                if (!response.ok) {
                    let errorMsg = `新增失敗 (HTTP ${response.status})`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorMsg;
                    } catch (e) {}
                    throw new Error(errorMsg);
                }
                
                closeAddCategoryModal();
                await fetchAndDisplayCategories();
            } catch (error) {
                addCategoryFormError.textContent = `新增錯誤：${error.message}`;
            }
        });
    }

    if (editCategoryForm) {
        // 提交編輯分類表單
        editCategoryForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            editCategoryFormError.textContent = '';
            
            const categoryId = editCategoryId.value;
            if (!categoryId) {
                editCategoryFormError.textContent = '無效的分類ID。';
                return;
            }
            
            // 收集更新數據
            const updatedData = {
                name: editCategoryName.value.trim(),
                slug: editCategorySlug.value.trim(),
                description: editCategoryDescription.value.trim() || null,
                display_order: parseInt(editCategoryOrder.value) || 0,
                is_active: editCategoryActive.checked
            };
            
            // 驗證
            if (!updatedData.name) {
                editCategoryFormError.textContent = '分類名稱不能為空。';
                return;
            }
            if (!updatedData.slug) {
                editCategoryFormError.textContent = '分類標識符不能為空。';
                return;
            }
            if (!/^[a-z0-9-]+$/.test(updatedData.slug)) {
                editCategoryFormError.textContent = '標識符只能包含小寫字母、數字和連字符。';
                return;
            }
            
            try {
                const response = await fetch(`/api/admin/news-categories/${categoryId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });
                
                if (!response.ok) {
                    let errorMsg = `儲存失敗 (HTTP ${response.status})`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorMsg;
                    } catch (e) {}
                    throw new Error(errorMsg);
                }
                
                closeEditCategoryModal();
                await fetchAndDisplayCategories();
            } catch (error) {
                editCategoryFormError.textContent = `儲存錯誤：${error.message}`;
            }
        });
    }

    // --- Initial Load ---
    fetchAndDisplayNews(); // *** 修改調用函數 ***
    fetchAndDisplayCategories();

    // 分页切换功能
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // 初始化显示默认标签页
    showTabContent('news-management');

    // 为标签按钮添加点击事件
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            
            // 更新按钮状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // 显示对应内容
            showTabContent(targetId);
        });
    });

    // 显示特定标签页内容
    function showTabContent(targetId) {
        tabContents.forEach(content => {
            if (content.id === targetId) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
        
        // 根据当前标签页加载相应数据
        if (targetId === 'news-management') {
            fetchAndDisplayNews();
        } else if (targetId === 'category-management') {
            fetchAndDisplayCategories();
        }
    }

}); // End of DOMContentLoaded 