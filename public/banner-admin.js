// banner-admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References - Banner 部分 ---
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

    // --- DOM Element References - UI元素部分 ---
    const uiElementsListBody = document.querySelector('#ui-elements-table tbody');
    const uiElementsContainer = document.getElementById('ui-elements-container');
    const uiElementsTable = document.getElementById('ui-elements-table');
    const uiElementsLoadingMessage = uiElementsContainer ? uiElementsContainer.querySelector('p') : null;
    const addUIModal = document.getElementById('add-ui-modal');
    const addUIForm = document.getElementById('add-ui-form');
    const addUIType = document.getElementById('add-ui-element-type');
    const addUIImageUrl = document.getElementById('add-ui-image-url');
    const addUIAltText = document.getElementById('add-ui-alt-text');
    const addUIIsVisible = document.getElementById('add-ui-is-visible');
    const addUIPreview = document.getElementById('add-ui-preview');
    const addUIFormError = document.getElementById('add-ui-form-error');
    const addCharacterFields = document.getElementById('add-character-fields');
    const addBackToTopFields = document.getElementById('add-backtotop-fields');
    const editUIModal = document.getElementById('edit-ui-modal');
    const editUIForm = document.getElementById('edit-ui-form');
    const editUIId = document.getElementById('edit-ui-id');
    const editUIType = document.getElementById('edit-ui-element-type');
    const editUITypeDisplay = document.getElementById('edit-ui-element-type-display');
    const editUIImageUrl = document.getElementById('edit-ui-image-url');
    const editUIAltText = document.getElementById('edit-ui-alt-text');
    const editUIIsVisible = document.getElementById('edit-ui-is-visible');
    const editUIPreview = document.getElementById('edit-ui-preview');
    const editUIFormError = document.getElementById('edit-ui-form-error');
    const editCharacterFields = document.getElementById('edit-character-fields');
    const editBackToTopFields = document.getElementById('edit-backtotop-fields');

    // --- 標籤切換 ---
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            // 激活當前標籤
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // 顯示對應內容
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${target}-tab`) {
                    content.classList.add('active');
                }
            });
             // --- 修改開始 ---
            // 如果切換到UI元素標籤，加載UI元素 (移除 !window.uiElementsLoaded 判斷)
            if (target === 'ui-elements') {
                fetchAndDisplayUIElements(); // <--- 每次點擊都調用
                // window.uiElementsLoaded = true; // <--- 刪除或註解掉這一行
            }
            // --- 修改結束 ---
        });
    });

    // --- Helper Functions ---
    
    // 獲取位置顯示名稱
    const getLocationDisplayName = (locationKey) => {
        switch(locationKey) {
            case 'home': return '首頁';
            case 'music': return '音樂頁';
            case 'news': return '最新消息頁';
            default: return locationKey || '未知';
        }
    };

    // 獲取元素類型顯示名稱
    const getElementTypeDisplayName = (typeKey) => {
        switch(typeKey) {
            case 'back_to_top': return '返回頂部按鈕';
            case 'pink_character': return '粉紅角色';
            case 'blue_character': return '藍色角色';
            case 'yellow_character': return '黃色角色';
            default: return typeKey || '未知元素';
        }
    };

    // 元素類型簡化映射（用於API交互）
    const elementTypeMapping = {
        'back_to_top': 'back_to_top',
        'pink_character': 'pink',
        'blue_character': 'blue',
        'yellow_character': 'yellow'
    };

    // 反向元素類型映射
    const reverseElementTypeMapping = {
        'back_to_top': 'back_to_top',
        'pink': 'pink_character',
        'blue': 'blue_character',
        'yellow': 'yellow_character'
    };

    // --- Banner相關函數 ---
    
    // 獲取並顯示Banner
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
            const response = await fetch('/api/admin/banners');
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

    // 開啟編輯Banner表單
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

    // --- UI元素相關函數 ---
    
    // 獲取並顯示UI元素
    async function fetchAndDisplayUIElements() {
        console.log("fetchAndDisplayUIElements called");
        if (!uiElementsListBody || !uiElementsContainer || !uiElementsTable) {
            if(uiElementsLoadingMessage) uiElementsLoadingMessage.textContent='頁面元素缺失 (表格)';
            console.error("UI Elements table elements missing!");
            return;
        }

        uiElementsListBody.innerHTML = ''; // 清空舊內容
        if (uiElementsLoadingMessage) uiElementsLoadingMessage.style.display = 'block';
        if (uiElementsTable) uiElementsTable.style.display = 'none';

        try {
            const response = await fetch('/api/ui-elements');
            console.log("UI Elements API Response Status:", response.status);

            if (!response.ok) {
                let errorText = `HTTP 錯誤！狀態: ${response.status}`;
                try { 
                    const data = await response.json(); 
                    errorText += `: ${data.error || response.statusText}`; 
                } catch (e) {}
                throw new Error(errorText);
            }

            const uiElements = await response.json();
            console.log("UI Elements Fetched:", uiElements);

            if (uiElementsLoadingMessage) uiElementsLoadingMessage.style.display = 'none';
            if (uiElementsTable) uiElementsTable.style.display = 'table';

            // 如果沒有UI元素
            if (!uiElements || uiElements.length === 0) {
                uiElementsListBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">沒有找到UI元素。請新增一些元素。</td></tr>`;
                return;
            }

            // 渲染UI元素列表
            uiElements.forEach(element => {
                const row = document.createElement('tr');
                row.dataset.elementId = element.id;
                
                // 預覽欄位的內容
                let previewContent = '';
                if (element.element_type === 'back_to_top') {
                    // 返回頂部按鈕預覽
            const settings = element.settings || {}; // 如果 element.settings 是 null 或 undefined，給一個空物件
                } else {
                    // 角色預覽（背景圖片）
                    previewContent = `<div class="character-preview" style="background-image: url('${element.image_url || `/images/${element.element_type}-character.png`}')"></div>`;
                }
                
                // 顯示狀態開關
                const visibilitySwitch = `
                    <label class="switch">
                        <input type="checkbox" ${element.is_visible ? 'checked' : ''} onchange="toggleUIElementVisibility(${element.id}, this.checked)">
                        <span class="slider"></span>
                    </label>
                `;
                
                // 描述/選項欄位
                let descriptionContent = '';
                if (element.element_type === 'back_to_top') {
                    // 返回頂部按鈕描述
                    const settings = element.settings || {}; // 如果 element.settings 是 null 或 undefined，給一個空物件
                    descriptionContent = `
                        顯示觸發: ${settings.scroll_trigger || 300}px<br>
                        滾動速度: ${settings.scroll_speed || 'smooth'}
                    `;
                } else {
                    const speechPhrases = element.speech_phrases || []; // 如果 element.speech_phrases 是 null 或 undefined，給一個空陣列
                    const speechPhrasesCount = speechPhrases.length; // 直接獲取陣列長度
                    // 角色描述
                    descriptionContent = `
                        位置: ${element.position_top || 'auto'} ${element.position_left ? `left: ${element.position_left}` : ''} ${element.position_right ? `right: ${element.position_right}` : ''}<br>
                        動畫: ${element.animation_type || 'float1'}<br>
                        對話數量: ${element.speech_phrases ? JSON.parse(element.speech_phrases).length : 0}條
                    `;
                }
                
                row.innerHTML = `
                    <td>${element.id || 'N/A'}</td>
                    <td>${getElementTypeDisplayName(reverseElementTypeMapping[element.element_type] || element.element_type)}</td>
                    <td>${previewContent}</td>
                    <td>${visibilitySwitch}</td>
                    <td style="white-space: normal; word-break: break-all;">${element.image_url || 'N/A'}</td>
                    <td style="white-space: normal; word-break: break-all;">${descriptionContent}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editUIElement(${element.id})">編輯</button>
                        <button class="action-btn delete-btn" onclick="deleteUIElement(${element.id})">刪除</button>
                    </td>
                `;
                uiElementsListBody.appendChild(row);
            });

        } catch (error) {
            console.error("獲取或處理UI元素列表失敗:", error);
            if (uiElementsLoadingMessage) uiElementsLoadingMessage.textContent = `無法載入UI元素列表: ${error.message}`;
            if (uiElementsTable) uiElementsTable.style.display = 'none';
        }
    }

    // 根據UI元素類型顯示不同的表單欄位
    function handleUITypeChange(mode) {
        const elementType = mode === 'add' ? addUIType.value : 
                           (editUIType.value || editUITypeDisplay.dataset.originalType);
        
        const characterFields = mode === 'add' ? addCharacterFields : editCharacterFields;
        const backToTopFields = mode === 'add' ? addBackToTopFields : editBackToTopFields;
        
        // 隱藏所有特殊欄位
        characterFields.style.display = 'none';
        backToTopFields.style.display = 'none';
        
        // 顯示對應的欄位
        if (elementType === 'pink_character' || elementType === 'blue_character' || elementType === 'yellow_character' ||
            elementType === 'pink' || elementType === 'blue' || elementType === 'yellow') {
            characterFields.style.display = 'block';
        } else if (elementType === 'back_to_top') {
            backToTopFields.style.display = 'block';
        }
    }

    // 開啟編輯UI元素表單
    async function openEditUIElementModal(id) {
        console.log(`openEditUIElementModal called for ID: ${id}`);

        const requiredEditElements = [
            editUIModal, editUIForm, editUIId, editUIType, 
            editUIImageUrl, editUIAltText, editUIIsVisible, 
            editUIPreview, editUIFormError, editUITypeDisplay
        ];

        if (requiredEditElements.some(el => !el)) {
            console.error("編輯UI Modal元件缺失:", requiredEditElements.map((el, i) => el ? '' : i).filter(String));
            alert("編輯UI視窗元件錯誤，請檢查HTML。");
            return;
        }

        editUIFormError.textContent = '';
        editUIForm.reset();
        editUIPreview.style.display = 'none';
        editUIPreview.src = '';

        try {
            const response = await fetch(`/api/ui-elements/${id}`);
            if (!response.ok) {
                let errorText = `無法獲取UI元素資料 (HTTP ${response.status})`;
                if (response.status === 404) errorText = '找不到指定的UI元素。';
                else { 
                    try { 
                        const data = await response.json(); 
                        errorText += `: ${data.error || response.statusText}`; 
                    } catch (e) {} 
                }
                throw new Error(errorText);
            }

            const element = await response.json();
            console.log("找到要編輯的UI元素:", element);

            // 設置通用欄位
            editUIId.value = element.id;
            const mappedType = reverseElementTypeMapping[element.element_type] || element.element_type;
            editUIType.value = mappedType;
            editUITypeDisplay.value = getElementTypeDisplayName(mappedType);
            editUITypeDisplay.dataset.originalType = mappedType;
            editUIImageUrl.value = element.image_url || '';
            editUIAltText.value = element.alt_text || '';
            editUIIsVisible.checked = element.is_visible;

            // 顯示預覽
            if (element.image_url) {
                editUIPreview.src = element.image_url;
                editUIPreview.style.display = 'block';
            }

            // 根據元素類型設置特定欄位
            handleUITypeChange('edit');

            if (element.element_type === 'back_to_top') {
                // 返回頂部按鈕特定欄位
                const settings = element.settings || {};
                document.getElementById('edit-ui-scroll-trigger').value = settings.scroll_trigger || 300;
                document.getElementById('edit-ui-scroll-speed').value = settings.scroll_speed || 'smooth';
            } else {
                // 角色特定欄位
                document.getElementById('edit-ui-position-top').value = element.position_top || '';
                document.getElementById('edit-ui-position-left').value = element.position_left || '';
                document.getElementById('edit-ui-position-right').value = element.position_right || '';
                document.getElementById('edit-ui-animation-type').value = element.animation_type || 'float1';
                
                // 處理對話短語
                const speechPhrases = element.speech_phrases || [];
                document.getElementById('edit-ui-speech-phrases').value = speechPhrases.join(',');
            }

            // 顯示Modal
            editUIModal.style.display = 'flex';
        } catch (error) {
            console.error(`獲取UI元素 ${id} 進行編輯時出錯:`, error);
            alert(`無法載入編輯資料： ${error.message}`);
        }
    }

    // --- 設置圖片預覽 ---
    function setupImagePreview(urlInput, previewImg) {
        if (urlInput && previewImg) {
            urlInput.addEventListener('input', () => {
                const url = urlInput.value.trim();
                previewImg.src = url || '';
                previewImg.style.display = url ? 'block' : 'none';
            });
        }
    }

    setupImagePreview(addBannerImageUrl, addBannerPreview);
    setupImagePreview(editBannerImageUrl, editBannerPreview);
    setupImagePreview(addUIImageUrl, addUIPreview);
    setupImagePreview(editUIImageUrl, editUIPreview);

    // --- Close Modals on Click Outside ---
    window.onclick = function(event) {
        if (event.target == editModal) closeEditBannerModal();
        else if (event.target == addModal) closeAddBannerModal();
        else if (event.target == editUIModal) closeEditUIModal();
        else if (event.target == addUIModal) closeAddUIModal();
    };

    // --- 設置UI元素類型改變時的處理函數 ---
    if (addUIType) {
        addUIType.addEventListener('change', () => handleUITypeChange('add'));
    }

    // --- 新增UI元素表單提交 ---
    if (addUIForm) {
        addUIForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            addUIFormError.textContent = '';

            const elementType = addUIType.value;
            if (!elementType) {
                addUIFormError.textContent = '請選擇元素類型。';
                return;
            }

            // 準備通用數據
            const newElementData = {
                element_type: elementTypeMapping[elementType] || elementType,
                is_visible: addUIIsVisible.checked,
                image_url: addUIImageUrl.value.trim() || null,
                alt_text: addUIAltText.value.trim() || null
            };

            // 根據元素類型添加特定數據
            if (elementType === 'back_to_top') {
                // 返回頂部按鈕
                const scrollTrigger = document.getElementById('add-ui-scroll-trigger').value;
                const scrollSpeed = document.getElementById('add-ui-scroll-speed').value;
                newElementData.settings = JSON.stringify({
                    scroll_trigger: isNaN(parseInt(scrollTrigger)) ? 300 : parseInt(scrollTrigger),
                    scroll_speed: scrollSpeed || 'smooth'
                });
            } else {
                // 角色
                newElementData.position_top = document.getElementById('add-ui-position-top').value.trim() || null;
                newElementData.position_left = document.getElementById('add-ui-position-left').value.trim() || null;
                newElementData.position_right = document.getElementById('add-ui-position-right').value.trim() || null;
                newElementData.animation_type = document.getElementById('add-ui-animation-type').value || 'float1';
                
                // 處理對話短語
                const speechPhrasesInput = document.getElementById('add-ui-speech-phrases').value.trim();
                if (speechPhrasesInput) {
                    const phrases = speechPhrasesInput.split(',').map(phrase => phrase.trim()).filter(Boolean);
                    newElementData.speech_phrases = JSON.stringify(phrases);
                } else {
                    newElementData.speech_phrases = JSON.stringify(['嗨！']);
                }
            }

            console.log("準備新增UI元素:", JSON.stringify(newElementData, null, 2));

            try {
                const response = await fetch('/api/ui-elements', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newElementData)
                });

                if (!response.ok) {
                    let errorMsg = `新增失敗 (HTTP ${response.status})`;
                    try { const errorData = await response.json(); errorMsg = `${errorMsg}: ${errorData.error || 'No error message provided.'}`; } catch (e) {}
                    throw new Error(errorMsg);
                }

                console.log("UI元素新增成功，關閉Modal並刷新列表。");
                closeAddUIModal();
                await fetchAndDisplayUIElements(); // 重新載入列表
            } catch (error) {
                console.error("新增UI元素時發生錯誤:", error);
                addUIFormError.textContent = `新增錯誤：${error.message}`;
            }
        });
    }

    // --- 編輯UI元素表單提交 ---
    if (editUIForm) {
        editUIForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            editUIFormError.textContent = '';

            const elementId = editUIId.value;
            if (!elementId) {
                editUIFormError.textContent = '錯誤：找不到元素ID。';
                return;
            }

            const elementType = editUIType.value;
            
            // 準備更新數據
            const updatedData = {
                is_visible: editUIIsVisible.checked,
                image_url: editUIImageUrl.value.trim() || null,
                alt_text: editUIAltText.value.trim() || null
            };

            // 根據元素類型添加特定數據
            if (elementType === 'back_to_top') {
                // 返回頂部按鈕
                const scrollTrigger = document.getElementById('edit-ui-scroll-trigger').value;
                const scrollSpeed = document.getElementById('edit-ui-scroll-speed').value;
                updatedData.settings = JSON.stringify({
                    scroll_trigger: isNaN(parseInt(scrollTrigger)) ? 300 : parseInt(scrollTrigger),
                    scroll_speed: scrollSpeed || 'smooth'
                });
            } else {
                // 角色
                updatedData.position_top = document.getElementById('edit-ui-position-top').value.trim() || null;
                updatedData.position_left = document.getElementById('edit-ui-position-left').value.trim() || null;
                updatedData.position_right = document.getElementById('edit-ui-position-right').value.trim() || null;
                updatedData.animation_type = document.getElementById('edit-ui-animation-type').value || 'float1';
                
                // 處理對話短語
                const speechPhrasesInput = document.getElementById('edit-ui-speech-phrases').value.trim();
                if (speechPhrasesInput) {
                    const phrases = speechPhrasesInput.split(',').map(phrase => phrase.trim()).filter(Boolean);
                    updatedData.speech_phrases = JSON.stringify(phrases);
                } else {
                    updatedData.speech_phrases = JSON.stringify(['嗨！']);
                }
            }

            console.log("準備更新UI元素:", elementId, JSON.stringify(updatedData, null, 2));

            try {
                const response = await fetch(`/api/ui-elements/${elementId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });

                if (!response.ok) {
                    let errorMsg = `更新失敗 (HTTP ${response.status})`;
                    try { const errorData = await response.json(); errorMsg = `${errorMsg}: ${errorData.error || 'No error message provided.'}`; } catch (e) {}
                    throw new Error(errorMsg);
                }

                console.log("UI元素更新成功，關閉Modal並刷新列表。");
                closeEditUIModal();
                await fetchAndDisplayUIElements(); // 重新載入列表
            } catch (error) {
                console.error("更新UI元素時發生錯誤:", error);
                editUIFormError.textContent = `更新錯誤：${error.message}`;
            }
        });
    }

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

    // --- 公開給全局的函數 ---
    
    // 關閉Modal函數
    window.closeEditBannerModal = function() { if (editModal) editModal.style.display = 'none'; };
    window.closeAddBannerModal = function() { if (addModal) addModal.style.display = 'none'; };
    window.closeEditUIModal = function() { if (editUIModal) editUIModal.style.display = 'none'; };
    window.closeAddUIModal = function() { if (addUIModal) addUIModal.style.display = 'none'; };

    // 編輯Banner函數
    window.editBanner = function(id) { openEditBannerModal(id); };

    // 刪除Banner函數
    window.deleteBanner = async function(id) {
        console.log(`準備刪除 Banner ID: ${id}`);
        if (confirm(`確定要刪除輪播圖 ID: ${id} 嗎？`)) {
            try {
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

    // 編輯UI元素函數
    window.editUIElement = function(id) { openEditUIElementModal(id); };

    // 刪除UI元素函數
    window.deleteUIElement = async function(id) {
        console.log(`準備刪除 UI元素 ID: ${id}`);
        if (confirm(`確定要刪除此UI元素嗎？`)) {
            try {
                const response = await fetch(`/api/ui-elements/${id}`, { method: 'DELETE' });

                if (response.status === 204 || response.ok) {
                    console.log(`UI元素 ID: ${id} 刪除成功。`);
                    await fetchAndDisplayUIElements(); // 刷新列表
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`;
                    try { const errorData = await response.json(); errorMsg = `${errorMsg}: ${errorData.error || 'No error message provided.'}`; } catch (e) {}
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error(`刪除 UI元素 ID ${id} 時發生錯誤:`, error);
                alert(`刪除時發生錯誤：${error.message}`);
            }
        }
    };

    // 切換UI元素顯示/隱藏狀態
    window.toggleUIElementVisibility = async function(id, isVisible) {
        console.log(`切換 UI元素 ID: ${id} 可見性為: ${isVisible}`);
        try {
            const response = await fetch(`/api/ui-elements/${id}/visibility`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_visible: isVisible })
            });

            if (!response.ok) {
                let errorMsg = `更新失敗 (HTTP ${response.status})`;
                try { const errorData = await response.json(); errorMsg = `${errorMsg}: ${errorData.error || 'No error message provided.'}`; } catch (e) {}
                throw new Error(errorMsg);
            }

            console.log(`UI元素 ID: ${id} 可見性更新成功。`);
            // 不需要刷新整個列表，UI已經通過checkbox實時更新
        } catch (error) {
            console.error(`更新 UI元素 ID ${id} 可見性時發生錯誤:`, error);
            alert(`更新可見性時發生錯誤：${error.message}`);
            await fetchAndDisplayUIElements(); // 在出錯時刷新列表以還原UI狀態
        }
    };

    // 顯示新增Banner表單
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

    // 顯示新增UI元素表單
    window.showAddUIElementForm = function() {
        console.log("顯示新增 UI元素表單");
        const requiredAddElements = [
            addUIModal, addUIForm, addUIType, addUIImageUrl, 
            addUIAltText, addUIIsVisible, addUIPreview, addUIFormError
        ];

        if (requiredAddElements.some(el => !el)) {
            console.error("新增UI視窗元件錯誤:", requiredAddElements.map((el, i) => el ? '' : i).filter(String));
            alert("新增UI視窗元件錯誤，請檢查HTML。");
            return;
        }

        addUIFormError.textContent = '';
        addUIForm.reset();
        addUIPreview.style.display = 'none';
        addUIPreview.src = '';
        addUIIsVisible.checked = true; // 預設顯示
        addUIType.value = ''; // 清空選擇
        
        // 隱藏所有特定欄位
        addCharacterFields.style.display = 'none';
        addBackToTopFields.style.display = 'none';

        // 顯示UI元素新增Modal
        addUIModal.style.display = 'flex';
    };

    // --- 初始載入 ---
    console.log("Banner & UI Elements Admin JS: Initializing page...");
    fetchAndDisplayBanners(); // 初始載入輪播圖列表
});

                    


