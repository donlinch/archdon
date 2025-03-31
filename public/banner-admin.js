// public/banner-admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const bannerListBody = document.querySelector('#banner-list-table tbody'); // 修改 ID
    const bannerListContainer = document.getElementById('banner-list-container'); // 修改 ID
    const bannerTable = document.getElementById('banner-list-table'); // 修改 ID
    const loadingMessage = bannerListContainer ? bannerListContainer.querySelector('p') : null;

    // --- Edit Modal elements ---
    const editModal = document.getElementById('edit-banner-modal'); // 修改 ID
    const editForm = document.getElementById('edit-banner-form'); // 修改 ID
    const editBannerId = document.getElementById('edit-banner-id'); // 修改 ID
    const editBannerImageUrl = document.getElementById('edit-banner-image-url'); // 修改 ID
    const editBannerLinkUrl = document.getElementById('edit-banner-link-url'); // 修改 ID
    const editBannerDisplayOrder = document.getElementById('edit-banner-display-order'); // 修改 ID
    const editBannerAltText = document.getElementById('edit-banner-alt-text'); // 新增 Alt Text
    const editBannerPreview = document.getElementById('edit-banner-preview'); // 新增預覽
    const editFormError = document.getElementById('edit-banner-form-error'); // 修改 ID

    // --- Add Modal elements ---
    const addModal = document.getElementById('add-banner-modal'); // 修改 ID
    const addForm = document.getElementById('add-banner-form'); // 修改 ID
    const addBannerImageUrl = document.getElementById('add-banner-image-url'); // 修改 ID
    const addBannerLinkUrl = document.getElementById('add-banner-link-url'); // 修改 ID
    const addBannerDisplayOrder = document.getElementById('add-banner-display-order'); // 修改 ID
    const addBannerAltText = document.getElementById('add-banner-alt-text'); // 新增 Alt Text
    const addBannerPreview = document.getElementById('add-banner-preview'); // 新增預覽
    const addFormError = document.getElementById('add-banner-form-error'); // 修改 ID

    // --- Function to Fetch and Display ALL Banners in the Table ---
    async function fetchAndDisplayBanners() { // 修改函數名
        if (!bannerListBody || !bannerListContainer || !bannerTable) { if(loadingMessage) loadingMessage.textContent='頁面元素缺失'; return; }
        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (bannerTable) bannerTable.style.display = 'none';

            // 使用管理 API 獲取數據
            const response = await fetch('/api/admin/banners'); // 修改 API URL
            if (!response.ok) throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            const banners = await response.json(); // API 直接返回陣列

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (bannerTable) bannerTable.style.display = 'table';
            bannerListBody.innerHTML = ''; // 清空現有內容

            if (banners.length === 0) {
                bannerListBody.innerHTML = '<tr><td colspan="6">目前沒有輪播圖。</td></tr>'; // 修改 Colspan 和文字
                return;
            }

            banners.forEach(banner => { // 修改變數名
                const row = document.createElement('tr');
                row.dataset.bannerId = banner.id; // 修改 dataset
                // 修改 row.innerHTML 以匹配 Banner 欄位
                row.innerHTML = `
                    <td>${banner.id}</td>
                    <td><img src="${banner.image_url || '/images/placeholder.png'}" alt="${banner.alt_text || '預覽'}" class="preview-image"></td>
                    <td style="white-space: normal; word-break: break-all;">${banner.image_url || ''}</td> <!-- 允許網址換行 -->
                    <td style="white-space: normal; word-break: break-all;">${banner.link_url || 'N/A'}</td> <!-- 允許網址換行 -->
                    <td>${banner.display_order}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editBanner(${banner.id})">編輯</button> <!-- 修改 onclick -->
                        <button class="action-btn delete-btn" onclick="deleteBanner(${banner.id})">刪除</button> <!-- 修改 onclick -->
                    </td>
                `;
                bannerListBody.appendChild(row);
            });
        } catch (error) {
            console.error("獲取管理 Banners 列表失敗:", error);
            if (loadingMessage) loadingMessage.textContent = '無法載入輪播圖列表。';
            if (bannerTable) bannerTable.style.display = 'none';
        }
    }

    // --- Function to Open and Populate the Edit Banner Modal ---
    async function openEditBannerModal(id) { // 修改函數名
        const requiredEditElements = [editModal, editForm, editBannerId, editBannerImageUrl, editBannerLinkUrl, editBannerDisplayOrder, editBannerAltText, editBannerPreview, editFormError]; // 更新檢查列表
        if (requiredEditElements.some(el => !el)) { alert("編輯 Modal 元件缺失"); return; }
        editFormError.textContent = ''; editForm.reset(); editBannerPreview.style.display = 'none'; editBannerPreview.src = ''; // 重置預覽

        try {
            // 可以直接從表格行獲取數據，或重新 fetch
            // 這裡用 fetch 確保最新
            const response = await fetch(`/api/admin/banners`); // 獲取所有 banners (或之後改成單個的 API /api/admin/banners/:id)
             if (!response.ok) { throw new Error(`無法獲取 Banner 資料 (HTTP ${response.status})`); }
             const banners = await response.json();
             const banner = banners.find(b => b.id === id); // 從列表中找到對應的 banner
             if (!banner) { throw new Error('找不到該 Banner。'); }


            // 填充表單欄位
            editBannerId.value = banner.id;
            editBannerImageUrl.value = banner.image_url || '';
            editBannerLinkUrl.value = banner.link_url || '';
            editBannerDisplayOrder.value = banner.display_order !== null ? banner.display_order : 0;
            editBannerAltText.value = banner.alt_text || '';

             // 顯示圖片預覽
             if (banner.image_url) {
                editBannerPreview.src = banner.image_url;
                editBannerPreview.style.display = 'block';
             }

            editModal.style.display = 'flex';
        } catch (error) {
            console.error(`獲取 Banner ${id} 進行編輯時出錯:`, error);
            alert(`無法載入編輯資料： ${error.message}`);
        }
    }

    // --- Function to Close the Edit Banner Modal ---
    window.closeEditBannerModal = function() { if (editModal) { editModal.style.display = 'none'; } } // 修改函數名

    // --- Function to Close the Add Banner Modal ---
    window.closeAddBannerModal = function() { if (addModal) { addModal.style.display = 'none'; } } // 修改函數名

    // --- Attach Edit Function to Global Scope ---
    window.editBanner = function(id) { openEditBannerModal(id); }; // 修改函數名

    // --- Attach Delete Function to Global Scope ---
    window.deleteBanner = async function(id) { // 修改函數名
        if (confirm(`確定要刪除輪播圖 ID: ${id} 嗎？`)) {
            try {
                const response = await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' }); // 修改 API URL
                if (response.status === 204 || response.ok) {
                    await fetchAndDisplayBanners(); // 修改調用函數
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`;
                     try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {}
                     throw new Error(errorMsg);
                }
            } catch (error) {
                alert(`刪除時發生錯誤：${error.message}`);
            }
        }
    };

    // --- Attach Show Add Form Function to Global Scope ---
    window.showAddBannerForm = function() { // 修改函數名
        const requiredAddElements = [addModal, addForm, addBannerImageUrl, addBannerLinkUrl, addBannerDisplayOrder, addBannerAltText, addBannerPreview, addFormError]; // 更新檢查列表
        if (requiredAddElements.some(el => !el)) { alert("新增視窗元件錯誤。"); return; }
        addFormError.textContent = '';
        addForm.reset(); // 重置表單
        addBannerPreview.style.display = 'none'; // 隱藏預覽
        addBannerPreview.src = '';
        addBannerDisplayOrder.value = 0; // 預設排序為 0
        addModal.style.display = 'flex';
    }

    // --- Update Preview Image on URL Input Change ---
    function setupImagePreview(urlInput, previewImg) {
        if (urlInput && previewImg) {
            urlInput.addEventListener('input', () => {
                const url = urlInput.value.trim();
                if (url) {
                    previewImg.src = url;
                    previewImg.style.display = 'block';
                    previewImg.onerror = () => { // 處理圖片加載失敗
                         previewImg.style.display = 'none';
                         previewImg.src = '';
                    };
                } else {
                    previewImg.style.display = 'none';
                    previewImg.src = '';
                }
            });
        }
    }
    setupImagePreview(addBannerImageUrl, addBannerPreview);
    setupImagePreview(editBannerImageUrl, editBannerPreview);


    // --- Close Modals if User Clicks Outside ---
    window.onclick = function(event) {
        if (event.target == editModal) { closeEditBannerModal(); } // 修改調用函數
        else if (event.target == addModal) { closeAddBannerModal(); } // 修改調用函數
    }

    // --- Edit Banner Form Submission Listener ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            editFormError.textContent = '';
            const bannerId = editBannerId.value;
            if (!bannerId) { editFormError.textContent = '錯誤：找不到 Banner ID。'; return; }

            // 收集表單數據
            const displayOrder = parseInt(editBannerDisplayOrder.value);
            if (isNaN(displayOrder)) { editFormError.textContent = '排序必須是有效的數字。'; return; }

            const updatedData = {
                 image_url: editBannerImageUrl.value.trim(),
                 link_url: editBannerLinkUrl.value.trim() || null, // 空字串轉為 null
                 display_order: displayOrder,
                 alt_text: editBannerAltText.value.trim() || null,
            };

            // 驗證
            if (!updatedData.image_url) { editFormError.textContent = '圖片網址不能為空。'; return; }
            // 可以在此添加更嚴格的 URL 驗證

            try {
                const response = await fetch(`/api/admin/banners/${bannerId}`, { // 修改 API URL
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });
                if (!response.ok) {
                    let errorMsg = `儲存失敗 (HTTP ${response.status})`;
                     try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {}
                     throw new Error(errorMsg);
                }
                closeEditBannerModal(); // 修改調用函數
                await fetchAndDisplayBanners(); // 修改調用函數
            } catch (error) {
                editFormError.textContent = `儲存錯誤：${error.message}`;
            }
        });
    } else {
        console.error("編輯 Banner 表單元素未找到。");
    }

    // --- Add Banner Form Submission Listener ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            addFormError.textContent = '';

            // 收集新增表單數據
            const displayOrder = parseInt(addBannerDisplayOrder.value);
            if (isNaN(displayOrder)) { addFormError.textContent = '排序必須是有效的數字。'; return; }

            const newBannerData = {
                image_url: addBannerImageUrl.value.trim(),
                link_url: addBannerLinkUrl.value.trim() || null,
                display_order: displayOrder,
                 alt_text: addBannerAltText.value.trim() || null,
            };

            // 驗證
             if (!newBannerData.image_url) { addFormError.textContent = '圖片網址不能為空。'; return; }
             // 可以在此添加更嚴格的 URL 驗證

            try {
                const response = await fetch(`/api/admin/banners`, { // 修改 API URL
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newBannerData)
                });
                if (!response.ok) {
                    let errorMsg = `新增失敗 (HTTP ${response.status})`;
                    try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {}
                    throw new Error(errorMsg);
                }
                closeAddBannerModal(); // 修改調用函數
                await fetchAndDisplayBanners(); // 修改調用函數
            } catch (error) {
                addFormError.textContent = `新增錯誤：${error.message}`;
            }
        });
    } else {
        console.error("新增 Banner 表單元素未找到。");
    }

    // --- Initial Load ---
    fetchAndDisplayBanners(); // 修改調用函數

}); // End of DOMContentLoaded 