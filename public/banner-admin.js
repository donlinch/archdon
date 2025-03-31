// public/banner-admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const bannerListBody = document.querySelector('#banner-list-table tbody');
    const bannerListContainer = document.getElementById('banner-list-container');
    const bannerTable = document.getElementById('banner-list-table');
    const loadingMessage = bannerListContainer ? bannerListContainer.querySelector('p') : null;

    // --- Edit Modal elements ---
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

    // --- Add Modal elements ---
    const addModal = document.getElementById('add-banner-modal');
    const addForm = document.getElementById('add-banner-form');
    const addBannerImageUrl = document.getElementById('add-banner-image-url');
    const addBannerLinkUrl = document.getElementById('add-banner-link-url');
    const addBannerDisplayOrder = document.getElementById('add-banner-display-order');
    const addBannerAltText = document.getElementById('add-banner-alt-text');
    const addBannerPreview = document.getElementById('add-banner-preview');
    const addFormError = document.getElementById('add-banner-form-error');
    const addBannerPageLocation = document.getElementById('add-banner-page-location');

    // --- Function to Fetch and Display ALL Banners in the Table ---
    async function fetchAndDisplayBanners() {
        console.log("fetchAndDisplayBanners called");
        if (!bannerListBody || !bannerListContainer || !bannerTable) {
            if(loadingMessage) loadingMessage.textContent='頁面元素缺失';
            console.error("Table elements missing!");
            return;
        }
        
        bannerListBody.innerHTML = '';
        if (loadingMessage) loadingMessage.style.display = 'block';
        if (bannerTable) bannerTable.style.display = 'none';

        try {
            const response = await fetch('/api/admin/banners');
            console.log("API Response Status:", response.status);
            
            if (!response.ok) {
                let errorText = `HTTP 錯誤！狀態: ${response.status}`;
                try {
                    const data = await response.json();
                    errorText += `: ${data.error || response.statusText}`;
                } catch (e) {}
                throw new Error(errorText);
            }
            
            const banners = await response.json();
            console.log("Admin Banners Fetched:", banners);

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (bannerTable) bannerTable.style.display = 'table';

            if (!banners || banners.length === 0) {
                bannerListBody.innerHTML = '<tr><td colspan="7">目前沒有輪播圖。</td></tr>';
                return;
            }

            const getLocationDisplayName = (locationKey) => {
                switch(locationKey) {
                    case 'home': return '首頁';
                    case 'music': return '音樂頁';
                    case 'news': return '消息頁';
                    default: return locationKey || '未知';
                }
            };

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
        } catch (error) {
            console.error("獲取管理 Banners 列表失敗:", error);
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
            const response = await fetch(`/api/admin/banners`);
            if (!response.ok) {
                throw new Error(`無法獲取 Banner 資料 (HTTP ${response.status})`);
            }
            
            const banners = await response.json();
            const banner = banners.find(b => b.id === id);
            
            if (!banner) {
                throw new Error(`在返回的列表中找不到 ID 為 ${id} 的 Banner。`);
            }
            
            console.log("找到要編輯的 Banner:", banner);

            editBannerId.value = banner.id;
            editBannerImageUrl.value = banner.image_url || '';
            editBannerLinkUrl.value = banner.link_url || '';
            editBannerDisplayOrder.value = banner.display_order !== null ? banner.display_order : 0;
            editBannerAltText.value = banner.alt_text || '';
            editBannerPageLocation.value = banner.page_location || 'home';

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
    window.closeEditBannerModal = function() {
        console.log("Closing Edit Modal");
        if (editModal) {
            editModal.style.display = 'none';
        }
    };
    
    window.closeAddBannerModal = function() {
        console.log("Closing Add Modal");
        if (addModal) {
            addModal.style.display = 'none';
        }
    };

    // --- Attach Edit/Delete/ShowAddForm Functions to window scope ---
    window.editBanner = function(id) {
        console.log(`編輯 Banner ID: ${id}`);
        openEditBannerModal(id);
    };
    
    window.deleteBanner = async function(id) {
        console.log(`準備刪除 Banner ID: ${id}`);
        if (confirm(`確定要刪除輪播圖 ID: ${id} 嗎？`)) {
            try {
                const response = await fetch(`/api/admin/banners/${id}`, {
                    method: 'DELETE'
                });
                
                if (response.status === 204 || response.ok) {
                    console.log(`Banner ID: ${id} 刪除成功。`);
                    await fetchAndDisplayBanners();
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`;
                    try {
                        const errorData = await response.json();
                        errorMsg = `${errorMsg}: ${errorData.error || 'No error message provided.'}`;
                    } catch (e) {}
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
        addBannerDisplayOrder.value = 0;
        addBannerPageLocation.value = 'home';
        addModal.style.display = 'flex';
    };

    // --- setupImagePreview ---
    function setupImagePreview(urlInput, previewImg) {
        if (urlInput && previewImg) {
            urlInput.addEventListener('input', () => {
                const url = urlInput.value.trim();
                if (url) {
                    previewImg.src = url;
                    previewImg.style.display = 'block';
                    previewImg.onerror = () => {
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

    // --- Close Modals on Click Outside ---
    window.onclick = function(event) {
        if (event.target == editModal) {
            closeEditBannerModal();
        } else if (event.target == addModal) {
            closeAddBannerModal();
        }
    };

    // --- Edit Banner Form Submission Listener ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            editFormError.textContent = '';
            
            const bannerId = editBannerId.value;
            if (!bannerId) {
                editFormError.textContent = '錯誤：找不到 Banner ID。';
                return;
            }
            
            const displayOrderInput = editBannerDisplayOrder.value.trim();
            const displayOrder = displayOrderInput === '' ? 0 : parseInt(displayOrderInput);
            
            if (isNaN(displayOrder)) {
                editFormError.textContent = '排序必須是有效的數字。';
                return;
            }
            
            console.log("Edit form - Page Location selected value:", editBannerPageLocation.value);
            
            const updatedData = {
                image_url: editBannerImageUrl.value.trim(),
                link_url: editBannerLinkUrl.value.trim() || null,
                display_order: displayOrder,
                alt_text: editBannerAltText.value.trim() || null,
                page_location: editBannerPageLocation.value
            };
            
            console.log("準備更新 Banner:", bannerId, JSON.stringify(updatedData, null, 2));
            
            if (!updatedData.image_url) {
                editFormError.textContent = '圖片網址不能為空。';
                return;
            }
            
            if (!updatedData.page_location) {
                editFormError.textContent = '請選擇顯示頁面。';
                return;
            }
            
            try {
                const response = await fetch(`/api/admin/banners/${bannerId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updatedData)
                });
                
                if (!response.ok) {
                    let errorMsg = `儲存失敗 (HTTP ${response.status})`;
                    try {
                        const errorData = await response.json();
                        errorMsg = `${errorMsg}: ${errorData.error || 'No error message provided.'}`;
                    } catch (e) {}
                    throw new Error(errorMsg);
                }
                
                console.log("Banner 更新成功，關閉 Modal 並刷新列表。");
                closeEditBannerModal();
                await fetchAndDisplayBanners();
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
            const displayOrder = displayOrderInput === '' ? 0 : parseInt(displayOrderInput);
            
            if (isNaN(displayOrder)) {
                addFormError.textContent = '排序必須是有效的數字。';
                return;
            }
            
            console.log("Add form - Page Location selected value:", addBannerPageLocation.value);
            
            const newBannerData = {
                image_url: addBannerImageUrl.value.trim(),
                link_url: addBannerLinkUrl.value.trim() || null,
                display_order: displayOrder,
                alt_text: addBannerAltText.value.trim() || null,
                page_location: addBannerPageLocation.value
            };
            
            console.log("準備新增 Banner:", JSON.stringify(newBannerData, null, 2));
            
            if (!newBannerData.image_url) {
                addFormError.textContent = '圖片網址不能為空。';
                return;
            }
            
            if (!newBannerData.page_location) {
                addFormError.textContent = '請選擇顯示頁面。';
                return;
            }
            
            try {
                const response = await fetch(`/api/admin/banners`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(newBannerData)
                });
                
                if (!response.ok) {
                    let errorMsg = `新增失敗 (HTTP ${response.status})`;
                    try {
                        const errorData = await response.json();
                        errorMsg = `${errorMsg}: ${errorData.error || 'No error message provided.'}`;
                    } catch (e) {}
                    throw new Error(errorMsg);
                }
                
                console.log("Banner 新增成功，關閉 Modal 並刷新列表。");
                closeAddBannerModal();
                await fetchAndDisplayBanners();
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
    fetchAndDisplayBanners();
});