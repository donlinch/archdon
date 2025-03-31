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

    // --- Function to Open and Populate the Edit Banner Modal --- (保持不變)
    async function openEditBannerModal(id) { /* ... */ }

    // --- Function to Close Modals --- (保持不變)
    window.closeEditBannerModal = function() { /* ... */ };
    window.closeAddBannerModal = function() { /* ... */ };

    // --- Attach Edit/Delete/ShowAddForm Functions to window scope --- (保持不變)
    window.editBanner = function(id) { openEditBannerModal(id); };
    window.deleteBanner = async function(id) { /* ... */ };
    window.showAddBannerForm = function() { /* ... */ };

    // --- setupImagePreview --- (保持不變)
    function setupImagePreview(urlInput, previewImg) { /* ... */ }
    setupImagePreview(addBannerImageUrl, addBannerPreview);
    setupImagePreview(editBannerImageUrl, editBannerPreview);

    // --- Close Modals on Click Outside --- (保持不變)
    window.onclick = function(event) { /* ... */ };

    // --- Edit Banner Form Submission Listener --- (保持不變)
    if (editForm) { editForm.addEventListener('submit', async (event) => { /* ... */ }); }
    else { console.error("編輯 Banner 表單元素 (#edit-banner-form) 未找到。"); }

    // --- Add Banner Form Submission Listener --- (保持不變)
    if (addForm) { addForm.addEventListener('submit', async (event) => { /* ... */ }); }
    else { console.error("新增 Banner 表單元素 (#add-banner-form) 未找到。"); }

    // --- Initial Load --- (保持不變)
    console.log("Banner Admin JS: Initializing page...");
    fetchAndDisplayBanners(); // 初始載入列表 (現在會分組顯示)
});