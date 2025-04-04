// public/banner-admin.js (完整替換)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References --- (保持不變)
    const bannerListBody = document.querySelector('#banner-list-table tbody');
    const bannerListContainer = document.getElementById('banner-list-container');
    const bannerTable = document.getElementById('banner-list-table');
    const loadingMessage = bannerListContainer ? bannerListContainer.querySelector('p') : null;
    const editModal = document.getElementById('edit-banner-modal');
    const editForm = document.getElementById('edit-banner-form');
    const editBannerId = document.getElementById('edit-banner-id');
    const editBannerImageUrl = document.getElementById('edit-banner-image-url');
    const editBannerLinkUrl = document.getElementById('edit-banner-link-url');
    const editBannerDisplayOrder = document.getElementById('edit-banner-display-order');
    const editBannerAltText = document.getElementById('edit-banner-alt-text');
    const editBannerPreview = document.getElementById('edit-banner-preview');
    const editFormError = document.getElementById('edit-banner-form-error');
    const editBannerPageLocation = document.getElementById('edit-banner-page-location');
    const addModal = document.getElementById('add-banner-modal');
    const addForm = document.getElementById('add-banner-form');
    const addBannerImageUrl = document.getElementById('add-banner-image-url');
    const addBannerLinkUrl = document.getElementById('add-banner-link-url');
    const addBannerDisplayOrder = document.getElementById('add-banner-display-order');
    const addBannerAltText = document.getElementById('add-banner-alt-text');
    const addBannerPreview = document.getElementById('add-banner-preview');
    const addFormError = document.getElementById('add-banner-form-error');
    const addBannerPageLocation = document.getElementById('add-banner-page-location');

    // --- Helper Function for Display Name --- (保持不變)
    const getLocationDisplayName = (locationKey) => {
        switch(locationKey) {
            case 'home': return '首頁';
            case 'music': return '音樂頁';
            case 'news': return '最新消息頁';
            default: return locationKey || '未知';
        }
    };

    // --- *** 修改這個函數來實現分組和排序渲染 *** ---
    async function fetchAndDisplayBanners() {
        console.log("fetchAndDisplayBanners called for grouping");
        if (!bannerListBody || !bannerListContainer || !bannerTable) {
            if(loadingMessage) loadingMessage.textContent='頁面元素缺失 (表格)';
            console.error("Table elements missing!");
            return;
        }

        bannerListBody.innerHTML = ''; // 清空舊內容
        if (loadingMessage) loadingMessage.style.display = 'block';
        if (bannerTable) bannerTable.style.display = 'none';

        try {
            const response = await fetch('/api/admin/banners'); // 獲取所有 admin banners
            console.log("API Response Status:", response.status);

            if (!response.ok) {
                let errorText = `HTTP 錯誤！狀態: ${response.status}`;
                try { const data = await response.json(); errorText += `: ${data.error || response.statusText}`; } catch (e) {}
                throw new Error(errorText);
            }

            const allBanners = await response.json(); // 獲取包含所有信息的 Banner 陣列
            console.log("Admin Banners Fetched (for grouping):", allBanners);

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (bannerTable) bannerTable.style.display = 'table';

            // --- **開始分組和排序** ---
            const groupedBanners = {
                home: [],
                music: [],
                news: [],
                other: [] // 用於存放 page_location 為 null 或其他未知值的 banner
            };

            // 1. 分組
            allBanners.forEach(banner => {
                switch (banner.page_location) {
                    case 'home':
                        groupedBanners.home.push(banner);
                        break;
                    case 'music':
                        groupedBanners.music.push(banner);
                        break;
                    case 'news':
                        groupedBanners.news.push(banner);
                        break;
                    default:
                        groupedBanners.other.push(banner);
                        break;
                }
            });

            // 2. 組內排序 (雖然 API 可能已排序，但前端再排一次更保險)
            const sortFn = (a, b) => (a.display_order - b.display_order) || (a.id - b.id);
            groupedBanners.home.sort(sortFn);
            groupedBanners.music.sort(sortFn);
            groupedBanners.news.sort(sortFn);
            groupedBanners.other.sort(sortFn); // 其他組也排序

            // --- **開始渲染分組後的列表** ---
            bannerListBody.innerHTML = ''; // 再次清空，確保從頭開始渲染

            // 輔助函數：渲染一個分組到表格
            const renderGroup = (title, banners) => {
                // 添加組標題行
                const headerRow = document.createElement('tr');
                headerRow.className = 'banner-group-header'; // 添加 class 以便 CSS 定位
                headerRow.innerHTML = `<td colspan="7" style="background-color: #e9ecef; font-weight: bold; padding: 12px 10px;">${title}</td>`;
                bannerListBody.appendChild(headerRow);

                if (banners.length === 0) {
                    // 如果該組沒有 Banner
                    const emptyRow = document.createElement('tr');
                    emptyRow.innerHTML = `<td colspan="7" style="text-align: center; color: #888; padding: 15px;">此分類下沒有輪播圖</td>`;
                    bannerListBody.appendChild(emptyRow);
                } else {
                    // 渲染該組的所有 Banner
                    banners.forEach(banner => {
                        const row = document.createElement('tr');
                        row.dataset.bannerId = banner.id;
                        row.innerHTML = `
                            <td>${banner.id || 'N/A'}</td>
                            <td><img src="${banner.image_url || '/images/placeholder.png'}" alt="${banner.alt_text || '預覽'}" class="preview-image"></td>
                            <td style="white-space: normal; word-break: break-all;">${banner.image_url || ''}</td>
                            <td style="white-space: normal; word-break: break-all;">${banner.link_url || 'N/A'}</td>
                            <td>${getLocationDisplayName(banner.page_location)}</td>
                            <td>${banner.display_order !== null ? banner.display_order : 'N/A'}</td>
                            <td>
                                <button class="action-btn edit-btn" onclick="editBanner(${banner.id})">編輯</button>
                                <button class="action-btn delete-btn" onclick="deleteBanner(${banner.id})">刪除</button>
                            </td>
                        `;
                        bannerListBody.appendChild(row);
                    });
                }
            };

            // 3. 按指定順序渲染分組
            renderGroup('首頁 (Home)', groupedBanners.home);
            renderGroup('音樂頁 (Music)', groupedBanners.music);
            renderGroup('最新消息頁 (News)', groupedBanners.news);

            // (可選) 如果需要顯示未分類的 Banner
            if (groupedBanners.other.length > 0) {
                renderGroup('其他/未分類', groupedBanners.other);
            }

            // --- **渲染結束** ---

        } catch (error) {
            console.error("獲取或處理管理 Banners 列表失敗:", error);
            if (loadingMessage) loadingMessage.textContent = `無法載入輪播圖列表: ${error.message}`;
            if (bannerTable) bannerTable.style.display = 'none';
        }
    }

    // --- Function to Open and Populate the Edit Banner Modal ---
    async function openEditBannerModal(id) {
        console.log(`openEditBannerModal called for ID: ${id}`);

        const requiredEditElements = [editModal, editForm, editBannerId, editBannerImageUrl,
                                   editBannerLinkUrl, editBannerDisplayOrder, editBannerAltText,
                                   editBannerPreview, editFormError, editBannerPageLocation];

        if (requiredEditElements.some(el => !el)) {
            console.error("編輯 Modal 元件缺失:", requiredEditElements.map((el, i) => el ? '' : i).filter(String));
            alert("編輯視窗元件錯誤，請檢查 HTML。");
            return;
        }

        editFormError.textContent = '';
        editForm.reset();
        editBannerPreview.style.display = 'none';
        editBannerPreview.src = '';

        try {
            // *** 修改: 使用新的 API 獲取單一 Banner ***
            const response = await fetch(`/api/admin/banners/${id}`);
            if (!response.ok) {
                 let errorText = `無法獲取 Banner 資料 (HTTP ${response.status})`;
                 if (response.status === 404) errorText = '找不到指定的 Banner。';
                 else { try { const data = await response.json(); errorText += `: ${data.error || response.statusText}`; } catch (e) {} }
                 throw new Error(errorText);
            }

            const banner = await response.json(); // 直接獲取單一 Banner 對象
            console.log("找到要編輯的 Banner:", banner);

            editBannerId.value = banner.id;
            editBannerImageUrl.value = banner.image_url || '';
            editBannerLinkUrl.value = banner.link_url || '';
             // *** 確保 display_order 被正確處理 ***
            editBannerDisplayOrder.value = banner.display_order !== null ? banner.display_order : 0;
            editBannerAltText.value = banner.alt_text || '';
             // *** 確保 page_location 被正確處理 ***
            editBannerPageLocation.value = banner.page_location || 'home'; // 設置 select 的值

            if (banner.image_url) {
                editBannerPreview.src = banner.image_url;
                editBannerPreview.style.display = 'block';
            } else {
                editBannerPreview.style.display = 'none';
            }

            editModal.style.display = 'flex';
        } catch (error) {
            console.error(`獲取 Banner ${id} 進行編輯時出錯:`, error);
            alert(`無法載入編輯資料： ${error.message}`);
        }
    }

    // --- Function to Close Modals ---
    window.closeEditBannerModal = function() { if (editModal) editModal.style.display = 'none'; };
    window.closeAddBannerModal = function() { if (addModal) addModal.style.display = 'none'; };

    // --- Attach Edit/Delete/ShowAddForm Functions to window scope ---
    window.editBanner = function(id) { openEditBannerModal(id); };

    window.deleteBanner = async function(id) {
        console.log(`準備刪除 Banner ID: ${id}`);
        if (confirm(`確定要刪除輪播圖 ID: ${id} 嗎？`)) {
            try {
                // *** API 路徑正確 ***
                const response = await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' });

                if (response.status === 204 || response.ok) {
                    console.log(`Banner ID: ${id} 刪除成功。`);
                    await fetchAndDisplayBanners(); // 刷新列表
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`;
                    try { const errorData = await response.json(); errorMsg = `${errorMsg}: ${errorData.error || 'No error message provided.'}`; } catch (e) {}
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error(`刪除 Banner ID ${id} 時發生錯誤:`, error);
                alert(`刪除時發生錯誤：${error.message}`);
            }
        }
    };

    window.showAddBannerForm = function() {
        console.log("顯示新增 Banner 表單");
        const requiredAddElements = [addModal, addForm, addBannerImageUrl, addBannerLinkUrl,
                                    addBannerDisplayOrder, addBannerAltText, addBannerPreview,
                                    addFormError, addBannerPageLocation];

        if (requiredAddElements.some(el => !el)) {
            console.error("新增視窗元件錯誤:", requiredAddElements.map((el, i) => el ? '' : i).filter(String));
            alert("新增視窗元件錯誤，請檢查 HTML。");
            return;
        }

        addFormError.textContent = '';
        addForm.reset();
        addBannerPreview.style.display = 'none';
        addBannerPreview.src = '';
        addBannerDisplayOrder.value = 0; // 預設值
        addBannerPageLocation.value = 'home'; // 預設值
        addModal.style.display = 'flex';
    };

    // --- setupImagePreview ---
    function setupImagePreview(urlInput, previewImg) {
        if (urlInput && previewImg) {
            urlInput.addEventListener('input', () => {
                const url = urlInput.value.trim();
                previewImg.src = url || ''; // 設置 src，即使是空的
                previewImg.style.display = url ? 'block' : 'none'; // 根據是否有 url 決定顯示
                // 可以移除 onerror，因為即使 url 無效，img 標籤也會顯示一個破損圖標
            });
        }
    }

    setupImagePreview(addBannerImageUrl, addBannerPreview);
    setupImagePreview(editBannerImageUrl, editBannerPreview);

    // --- Close Modals on Click Outside ---
    window.onclick = function(event) {
        if (event.target == editModal) closeEditBannerModal();
        else if (event.target == addModal) closeAddBannerModal();
    };

    // --- Edit Banner Form Submission Listener ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            editFormError.textContent = '';

            const bannerId = editBannerId.value;
            if (!bannerId) { editFormError.textContent = '錯誤：找不到 Banner ID。'; return; }

            const displayOrderInput = editBannerDisplayOrder.value.trim();
            // *** 確保 display_order 是數字 ***
            const displayOrder = displayOrderInput === '' ? 0 : parseInt(displayOrderInput);
            if (isNaN(displayOrder)) { editFormError.textContent = '排序必須是有效的數字。'; return; }

            // *** 獲取 page_location ***
            const pageLocation = editBannerPageLocation.value;

            const updatedData = {
                image_url: editBannerImageUrl.value.trim(),
                link_url: editBannerLinkUrl.value.trim() || null,
                display_order: displayOrder, // 使用處理過的數字
                alt_text: editBannerAltText.value.trim() || null,
                page_location: pageLocation // 加入 page_location
            };

            console.log("準備更新 Banner:", bannerId, JSON.stringify(updatedData, null, 2));

            if (!updatedData.image_url) { editFormError.textContent = '圖片網址不能為空。'; return; }
            if (!updatedData.page_location) { editFormError.textContent = '請選擇顯示頁面。'; return; } // 驗證 page_location

            try {
                // *** API 路徑正確 ***
                const response = await fetch(`/api/admin/banners/${bannerId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });

                if (!response.ok) {
                    let errorMsg = `儲存失敗 (HTTP ${response.status})`;
                    try { const errorData = await response.json(); errorMsg = `${errorMsg}: ${errorData.error || 'No error message provided.'}`; } catch (e) {}
                    throw new Error(errorMsg);
                }

                console.log("Banner 更新成功，關閉 Modal 並刷新列表。");
                closeEditBannerModal();
                await fetchAndDisplayBanners(); // 刷新列表
            } catch (error) {
                console.error("更新 Banner 時發生錯誤:", error);
                editFormError.textContent = `儲存錯誤：${error.message}`;
            }
        });
    } else {
        console.error("編輯 Banner 表單元素 (#edit-banner-form) 未找到。");
    }

    // --- Add Banner Form Submission Listener ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            addFormError.textContent = '';

            const displayOrderInput = addBannerDisplayOrder.value.trim();
             // *** 確保 display_order 是數字 ***
            const displayOrder = displayOrderInput === '' ? 0 : parseInt(displayOrderInput);
            if (isNaN(displayOrder)) { addFormError.textContent = '排序必須是有效的數字。'; return; }

            // *** 獲取 page_location ***
            const pageLocation = addBannerPageLocation.value;

            const newBannerData = {
                image_url: addBannerImageUrl.value.trim(),
                link_url: addBannerLinkUrl.value.trim() || null,
                display_order: displayOrder, // 使用處理過的數字
                alt_text: addBannerAltText.value.trim() || null,
                page_location: pageLocation // 加入 page_location
            };

            console.log("準備新增 Banner:", JSON.stringify(newBannerData, null, 2));

            if (!newBannerData.image_url) { addFormError.textContent = '圖片網址不能為空。'; return; }
            if (!newBannerData.page_location) { addFormError.textContent = '請選擇顯示頁面。'; return; } // 驗證 page_location
 
            try {
                // *** API 路徑正確 ***
                const response = await fetch(`/api/admin/banners`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newBannerData)
                });

                if (!response.ok) {
                    let errorMsg = `新增失敗 (HTTP ${response.status})`;
                    try { const errorData = await response.json(); errorMsg = `${errorMsg}: ${errorData.error || 'No error message provided.'}`; } catch (e) {}
                    throw new Error(errorMsg);
                }

                console.log("Banner 新增成功，關閉 Modal 並刷新列表。");
                closeAddBannerModal();
                await fetchAndDisplayBanners(); // 刷新列表
            } catch (error) {
                console.error("新增 Banner 時發生錯誤:", error);
                addFormError.textContent = `新增錯誤：${error.message}`;
            }
        });
    } else {
        console.error("新增 Banner 表單元素 (#add-banner-form) 未找到。");
    }

    // --- Initial Load ---
    console.log("Banner Admin JS: Initializing page...");
    fetchAndDisplayBanners(); // 初始載入列表
});