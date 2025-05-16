// public/guestbook-admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 (原有) ---
    const guestbookAdminList = document.getElementById('guestbook-admin-list');
    const paginationContainer = document.getElementById('admin-pagination-container');
    const filterStatus = document.getElementById('filter-status');
    const searchTermInput = document.getElementById('search-term');
    const searchButton = document.getElementById('search-button');

    // --- 新增: Tab 相關 DOM 元素 ---
    const adminTabsContainer = document.querySelector('.admin-tabs');
    const reportedCountBadge = document.getElementById('reported-count-badge');
    const tableHeadRow = document.querySelector('#guestbook-admin-table thead tr');

    // --- Modal 相關 DOM 元素 (發表新留言) ---
    const adminPostNewMessageBtn = document.getElementById('admin-post-new-message-btn');
    const adminPostModal = document.getElementById('admin-post-modal');
    const closeAdminPostModalBtn = document.getElementById('close-admin-post-modal-btn');
    const adminPostForm = document.getElementById('admin-post-form');
    const adminPostIdentitySelect = document.getElementById('admin-post-identity-select');
    const adminPostContent = document.getElementById('admin-post-content');
    const adminPostStatus = document.getElementById('admin-post-status');
    const submitAdminPostBtn = document.getElementById('submit-admin-post-btn');
    const adminPostCancelBtns = adminPostModal ? adminPostModal.querySelectorAll('.close-modal-btn') : [];
    // START: 新增的圖片上傳相關 DOM 元素 (用於發表新留言 Modal)
    const adminPostImageInput = document.getElementById('admin-post-image');
    const adminPostImagePreviewContainer = document.getElementById('admin-post-image-preview-container');
    const clearAdminPostImageBtn = document.getElementById('clear-admin-post-image-btn');
    const adminPostImageUploadStatusContainer = document.getElementById('admin-post-image-upload-status-container');
    const adminPostImageUploadStatus = document.getElementById('admin-post-image-upload-status');
    // END: 新增的圖片上傳相關 DOM 元素

    // --- 處理檢舉 Modal DOM 元素 ---
    const processReportModal = document.getElementById('process-report-modal');
    const closeProcessReportModalBtn = document.getElementById('close-process-report-modal-btn');
    const reportItemIdSpan = document.getElementById('report-item-id');
    const reportItemTypeSpan = document.getElementById('report-item-type');
    const reportItemAuthorSpan = document.getElementById('report-item-author');
    const reportItemContentPreviewDiv = document.getElementById('report-item-content-preview');
    const reportActionUnreportBtn = document.getElementById('report-action-unreport');
    const processReportStatusP = document.getElementById('process-report-status');

    // --- 狀態變數 (原有) ---
    let currentPage = 1;
    let currentFilter = 'all';
    let currentSearch = '';
    let currentSort = 'latest';
    let activeTab = 'all-messages';

    // --- 輔助函數 ---
    function closeModal(modalElement) {
        if (modalElement) modalElement.style.display = 'none';
    }
    function openModal(modalElement) {
        if (modalElement) modalElement.style.display = 'flex';
    }

    // --- 獲取並填充管理員身份下拉選單 ---
    async function fetchAndPopulateAdminIdentities(selectElement) {
        // ... (此函數保持不變)
        if (!selectElement) return;
        selectElement.disabled = true;
        selectElement.innerHTML = '<option value="">載入身份中...</option>';
        try {
            const response = await fetch('/api/admin/identities'); 
            if (!response.ok) throw new Error('無法獲取身份列表');
            const identities = await response.json();

            if (identities && identities.length > 0) {
                selectElement.innerHTML = ''; 
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '-- 請選擇身份 --';
                selectElement.appendChild(defaultOption);

                identities.forEach(identity => {
                    const option = document.createElement('option');
                    option.value = identity.id;
                    option.textContent = identity.name; 
                    selectElement.appendChild(option);
                });
                selectElement.disabled = false;
            } else {
                selectElement.innerHTML = '<option value="">沒有可用的身份</option>';
            }
        } catch (error) {
            console.error('獲取身份失敗:', error);
            selectElement.innerHTML = '<option value="">獲取身份失敗</option>';
            if (adminPostStatus) { adminPostStatus.textContent = '錯誤：無法載入發表身份。'; adminPostStatus.style.color = 'red'; }
        }
    }

    // START: 發表新留言 Modal 的圖片預覽和清除功能
    function updateAdminPostImagePreview() {
        if (!adminPostImageInput || !adminPostImagePreviewContainer || !clearAdminPostImageBtn) return;

        adminPostImagePreviewContainer.innerHTML = '';
        if (adminPostImageInput.files && adminPostImageInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                // 樣式可以通過 CSS 設定，或者在這裡直接設定
                // img.style.maxWidth = '200px'; 
                // img.style.maxHeight = '150px';
                // img.style.borderRadius = '4px';
                adminPostImagePreviewContainer.appendChild(img);
            };
            reader.readAsDataURL(adminPostImageInput.files[0]);
            clearAdminPostImageBtn.style.display = 'inline-block';
        } else {
            clearAdminPostImageBtn.style.display = 'none';
        }
    }

    if (adminPostImageInput) {
        adminPostImageInput.addEventListener('change', updateAdminPostImagePreview);
    }

    if (clearAdminPostImageBtn) {
        clearAdminPostImageBtn.addEventListener('click', () => {
            if (adminPostImageInput) {
                adminPostImageInput.value = '';
            }
            updateAdminPostImagePreview();
            if(adminPostImageUploadStatusContainer) adminPostImageUploadStatusContainer.style.display = 'none';
            if(adminPostImageUploadStatus) adminPostImageUploadStatus.textContent = '';
        });
    }
    // END: 發表新留言 Modal 的圖片預覽和清除功能

    // --- 打開管理員發表新留言 Modal 的函數 ---
    async function openAdminPostModal() {
        if (!adminPostModal || !adminPostForm || !adminPostStatus || !adminPostIdentitySelect) {
            console.error("無法打開 Modal：缺少必要的 Modal 元素。");
            alert("打開視窗時出錯，請檢查頁面元件。");
            return;
        }
        adminPostForm.reset();
        adminPostStatus.textContent = '';
        submitAdminPostBtn.disabled = false;
        submitAdminPostBtn.textContent = '確認發表';

        // 清除圖片預覽和狀態 (如果之前有)
        if (adminPostImageInput) adminPostImageInput.value = '';
        updateAdminPostImagePreview();
        if(adminPostImageUploadStatusContainer) adminPostImageUploadStatusContainer.style.display = 'none';
        if(adminPostImageUploadStatus) adminPostImageUploadStatus.textContent = '';


        await fetchAndPopulateAdminIdentities(adminPostIdentitySelect);
        openModal(adminPostModal);
        adminPostIdentitySelect.focus();
    }

    // --- 關閉管理員發表新留言 Modal 的函數 ---
    function closeAdminPostModal() {
        closeModal(adminPostModal);
    }

    // --- 更新表頭函數 ---
    function updateTableHeaders(tabName) {
        // ... (此函數保持不變)
        if (!tableHeadRow) return;
        tableHeadRow.innerHTML = ''; 

        let headers = [];
        if (tabName === 'all-messages') {
            headers = ['ID', '類型', '作者/身份', '內容預覽', '回覆數', '最後活動', '狀態', '檢舉狀態', '操作'];
        } else if (tabName === 'reported-content') {
            headers = ['ID', '類型', '作者', '內容預覽', '檢舉時間', '操作'];
        }

        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            tableHeadRow.appendChild(th);
        });
    }

    // --- 更新檢舉數量徽章 ---
    async function updateReportedCountBadge() {
        // ... (此函數保持不變)
        if (!reportedCountBadge) return;
        try {
            const response = await fetch('/api/admin/guestbook/reported-content');
            if (!response.ok) {
                console.error('無法獲取檢舉數量');
                return;
            }
            const data = await response.json();
            const count = data.totalReported || 0;
            reportedCountBadge.textContent = count;
            reportedCountBadge.style.display = count > 0 ? 'inline-block' : 'none';
        } catch (error) {
            console.error('更新檢舉數量失敗:', error);
            reportedCountBadge.style.display = 'none';
        }
    }

    // --- 函數：獲取並顯示管理列表 ---
    async function fetchAdminGuestbookList(page = 1, filter = 'all', search = '', sort = 'latest') {
        // ... (此函數大部分保持不變，除了更新表頭的部分)
        if (!guestbookAdminList || !paginationContainer) {
            console.error('錯誤：找不到列表或分頁容器。');
            return;
        }
        // 確保在 "所有留言" Tab 時使用正確的表頭
        if (activeTab === 'all-messages') {
             updateTableHeaders('all-messages');
        }
        guestbookAdminList.innerHTML = `<tr><td colspan="${tableHeadRow.cells.length}">正在載入資料...</td></tr>`;
        paginationContainer.innerHTML = '';

        currentPage = page;
        currentFilter = filter;
        currentSearch = search;
        currentSort = sort;

        const params = new URLSearchParams({
            page: currentPage, limit: 15, filter: currentFilter,
            search: currentSearch, sort: currentSort
        });
        const apiUrl = `/api/admin/guestbook?${params.toString()}`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                let errorMsg = `HTTP 錯誤 ${response.status}`;
                try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
                if (response.status === 401) throw new Error('您需要登入才能訪問此功能。');
                if (response.status === 403) throw new Error('您沒有權限訪問此功能。');
                throw new Error(`無法獲取管理列表 (${errorMsg})`);
            }
            const data = await response.json();
            renderAdminList(data.messages);
            renderAdminPagination(data.totalPages, data.currentPage);

        } catch (error) {
            console.error('獲取管理列表失敗:', error);
            guestbookAdminList.innerHTML = `<tr><td colspan="${tableHeadRow.cells.length}" style="color: red;">無法載入列表：${error.message}</td></tr>`;
            if (error.message.includes('登入')) {
               alert('請先登入管理後台！');
            }
        }
    }

     // --- 函數：渲染管理列表 ---
     function renderAdminList(messages) {
        // ... (此函數保持不變)
        if (!guestbookAdminList) return;
        guestbookAdminList.innerHTML = '';
        if (!messages || messages.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = tableHeadRow.cells.length; 
            td.textContent = '找不到符合條件的留言。';
            tr.appendChild(td);
            guestbookAdminList.appendChild(tr);
            return;
        }

        messages.forEach(msg => {
            const tr = document.createElement('tr');
            tr.id = `message-row-${msg.id}`;

            if (msg.is_admin_post) {
                 tr.style.backgroundColor = "#fffaf0"; 
            }

            const tdId = document.createElement('td'); tdId.textContent = msg.id;
            const tdType = document.createElement('td'); tdType.textContent = '留言';
            const tdAuthor = document.createElement('td');
                tdAuthor.textContent = msg.author_name || '匿名';
                if (msg.is_admin_post) {
                    const adminBadge = document.createElement('span');
                    adminBadge.textContent = ' (管理員)';
                    adminBadge.style.color = '#FF8F00'; 
                    adminBadge.style.fontSize = '0.8em';
                    tdAuthor.appendChild(adminBadge);
                }
            const tdPreview = document.createElement('td'); tdPreview.className = 'content-preview';
                const previewLink = document.createElement('a');
                previewLink.href = `/admin-message-detail.html?id=${msg.id}`;
                previewLink.textContent = msg.content_preview || '';
                previewLink.style.whiteSpace = 'pre-wrap';
                previewLink.style.wordWrap = 'break-word';
            tdPreview.appendChild(previewLink);
            const tdReplyCount = document.createElement('td'); tdReplyCount.textContent = msg.reply_count || 0;
            const tdLastActivity = document.createElement('td'); tdLastActivity.textContent = new Date(msg.last_activity_at).toLocaleString('zh-TW');
            const tdStatus = document.createElement('td');
                const statusSpan = document.createElement('span');
                statusSpan.className = msg.is_visible ? 'status-visible' : 'status-hidden';
                statusSpan.textContent = msg.is_visible ? '顯示中' : '已隱藏';
            tdStatus.appendChild(statusSpan);

            const tdReportedStatus = document.createElement('td');
            tdReportedStatus.textContent = msg.is_reported ? '是' : '否';
            if (msg.is_reported) {
                tdReportedStatus.style.color = 'red';
                tdReportedStatus.style.fontWeight = 'bold';
            }

            const tdActions = document.createElement('td');
            tdActions.className = 'actions';
                const toggleBtn = document.createElement('button'); 
                toggleBtn.className = 'btn btn-warning btn-sm toggle-visibility-btn';
                toggleBtn.textContent = msg.is_visible ? '隱藏' : '顯示';
                toggleBtn.dataset.id = msg.id;
                toggleBtn.dataset.type = 'message';
                toggleBtn.dataset.targetVisibility = !msg.is_visible;

                const deleteBtn = document.createElement('button'); 
                deleteBtn.className = 'btn btn-danger btn-sm delete-item-btn';
                deleteBtn.textContent = '刪除';
                deleteBtn.dataset.id = msg.id;
                deleteBtn.dataset.type = 'message';
                deleteBtn.dataset.name = `留言 #${msg.id}`;

                const detailLink = document.createElement('a'); 
                detailLink.className = 'btn btn-info btn-sm';
                detailLink.href = `/admin-message-detail.html?id=${msg.id}`;
                detailLink.textContent = '詳情/回覆';
            
            tdActions.appendChild(toggleBtn);
            tdActions.appendChild(deleteBtn);
            tdActions.appendChild(detailLink);

            if (msg.is_reported) {
                const processReportBtn = document.createElement('button');
                processReportBtn.className = 'btn btn-info btn-sm process-report-btn';
                processReportBtn.textContent = '處理檢舉';
                processReportBtn.dataset.id = msg.id;
                processReportBtn.dataset.type = 'message'; 
                processReportBtn.style.marginLeft = '5px';
                tdActions.appendChild(processReportBtn);
            }

            tr.appendChild(tdId);
            tr.appendChild(tdType);
            tr.appendChild(tdAuthor);
            tr.appendChild(tdPreview);
            tr.appendChild(tdReplyCount);
            tr.appendChild(tdLastActivity);
            tr.appendChild(tdStatus);
            tr.appendChild(tdReportedStatus); 
            tr.appendChild(tdActions);

            guestbookAdminList.appendChild(tr);
        });
    }

     // --- 函數：渲染管理分頁控制 ---
     function renderAdminPagination(totalPages, currentPage) {
        // ... (此函數保持不變)
        if (!paginationContainer || totalPages <= 1) {
            if(paginationContainer) paginationContainer.innerHTML = '';
            return;
        }
        paginationContainer.innerHTML = ''; 
        const createPageButton = (pageNumber, text, isDisabled = false, isActive = false) => {
            const button = document.createElement('button');
            button.dataset.page = pageNumber;
            button.textContent = text;
            button.disabled = isDisabled;
            button.className = 'page-btn';
            if (isActive) button.classList.add('current-page');
            return button;
        };
        paginationContainer.appendChild(createPageButton(currentPage - 1, '<< 上一頁', currentPage === 1));
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        if (endPage - startPage + 1 < maxPagesToShow) { startPage = Math.max(1, endPage - maxPagesToShow + 1); }
        if (startPage > 1) { const first = createPageButton(1, '1'); paginationContainer.appendChild(first); if (startPage > 2) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; paginationContainer.appendChild(ellipsis); } }
        for (let i = startPage; i <= endPage; i++) { paginationContainer.appendChild(createPageButton(i, i, false, i === currentPage)); }
        if (endPage < totalPages) { if (endPage < totalPages - 1) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; paginationContainer.appendChild(ellipsis); } const last = createPageButton(totalPages, totalPages); paginationContainer.appendChild(last); }
        paginationContainer.appendChild(createPageButton(currentPage + 1, '下一頁 >>', currentPage === totalPages));
     }

     // --- 事件監聽：篩選、搜尋、分頁 ---
     if (filterStatus) {
         filterStatus.addEventListener('change', () => {
             fetchAdminGuestbookList(1, filterStatus.value, currentSearch, currentSort);
         });
     }
     if (searchButton && searchTermInput) {
         const triggerSearch = () => fetchAdminGuestbookList(1, currentFilter, searchTermInput.value.trim(), currentSort);
         searchButton.addEventListener('click', triggerSearch);
         searchTermInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') triggerSearch(); });
     }
     if (paginationContainer) {
        paginationContainer.addEventListener('click', (e) => {
            if (e.target.matches('.page-btn') && !e.target.disabled) {
                const page = parseInt(e.target.dataset.page, 10);
                if (!isNaN(page)) {
                    fetchAdminGuestbookList(page, currentFilter, currentSearch, currentSort);
                }
            }
        });
     }

   // --- 事件監聽 - 打開/關閉管理員發表 Modal ---
   if (adminPostNewMessageBtn) {
    adminPostNewMessageBtn.addEventListener('click', openAdminPostModal);
    }
    if (closeAdminPostModalBtn) {
        closeAdminPostModalBtn.addEventListener('click', closeAdminPostModal);
    }
    adminPostCancelBtns.forEach(btn => {
        btn.addEventListener('click', closeAdminPostModal);
    });
    if (adminPostModal) {
        adminPostModal.addEventListener('click', (event) => {
            if (event.target === adminPostModal) {
                closeAdminPostModal();
            }
        });
    }

    // --- 處理檢舉 Modal 的關閉事件 ---
    if (closeProcessReportModalBtn && processReportModal) {
        closeProcessReportModalBtn.addEventListener('click', () => closeModal(processReportModal));
    }
    if (processReportModal) {
        processReportModal.addEventListener('click', (event) => {
            if (event.target === processReportModal) {
                closeModal(processReportModal);
            }
        });
    }

    // --- 處理檢舉 Modal 內部操作按鈕的事件監聽器 ---
    const setupReportActionButtons = () => {
        // ... (此函數保持不變)
        const reportModal = processReportModal;
        if (!reportModal) return;

        const itemId = () => reportModal.dataset.itemId;
        const itemType = () => reportModal.dataset.itemType;

        const handleUnreportAction = async () => {
            const currentItemId = itemId();
            const currentItemType = itemType();

            if (!currentItemId || !currentItemType) {
                processReportStatusP.textContent = '錯誤：缺少項目ID或類型。';
                processReportStatusP.style.color = 'red';
                return;
            }
            
            if(reportActionUnreportBtn) reportActionUnreportBtn.disabled = true;
            processReportStatusP.textContent = `正在解除檢舉...`;
            processReportStatusP.style.color = 'blue';

            const endpoint = `/api/admin/guestbook/${currentItemType}s/${currentItemId}/status`;
            const body = { is_reported: false, is_visible: true };

            try {
                const response = await fetch(endpoint, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(body)
                });
                if (!response.ok && response.status !== 204) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || `操作失敗 (HTTP ${response.status})`);
                }
                processReportStatusP.textContent = `解除檢舉成功！`;
                processReportStatusP.style.color = 'green';
                setTimeout(() => {
                    closeModal(reportModal);
                    // 根據當前活動的 Tab 刷新對應的列表
                    if (activeTab === 'all-messages') {
                        fetchAdminGuestbookList(currentPage, currentFilter, currentSearch, currentSort);
                    } else if (activeTab === 'reported-content') {
                        fetchAndRenderReportedContent();
                    }
                }, 1500);
            } catch (error) {
                console.error(`解除檢舉失敗:`, error);
                processReportStatusP.textContent = `解除檢舉失敗: ${error.message}`;
                processReportStatusP.style.color = 'red';
            } finally {
                if(reportActionUnreportBtn) reportActionUnreportBtn.disabled = false;
            }
        };

        if (reportActionUnreportBtn) {
            reportActionUnreportBtn.addEventListener('click', handleUnreportAction);
        }
    };
    setupReportActionButtons();


    // --- 事件監聽 - 提交管理員發表表單 (★ 已更新處理圖片上傳 ★) ---
    if (adminPostForm && submitAdminPostBtn && adminPostStatus && adminPostIdentitySelect && adminPostContent) {
        adminPostForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const selectedIdentityId = adminPostIdentitySelect.value;
            const content = adminPostContent.value.trim();
            // 獲取選擇的圖片檔案 (用於發表新留言 Modal)
            const imageFile = adminPostImageInput && adminPostImageInput.files[0] ? adminPostImageInput.files[0] : null;


            if (!selectedIdentityId) {
                adminPostStatus.textContent = '請選擇一個發表身份！';
                adminPostStatus.style.color = 'orange';
                return;
            }
            if (!content) {
                adminPostStatus.textContent = '留言內容不能為空！';
                adminPostStatus.style.color = 'orange';
                return;
            }

            submitAdminPostBtn.disabled = true;
            adminPostStatus.textContent = '正在發表...';
            adminPostStatus.style.color = 'blue';

            let uploadedImageUrl = null;

            // 步驟 1: 如果有圖片，先上傳圖片
            if (imageFile) {
                if (adminPostImageUploadStatusContainer) adminPostImageUploadStatusContainer.style.display = 'block';
                if (adminPostImageUploadStatus) {
                    adminPostImageUploadStatus.textContent = '正在上傳圖片...';
                    adminPostImageUploadStatus.style.color = 'blue';
                }

                const formData = new FormData();
                formData.append('image', imageFile); // 'image' 欄位名，需與 /api/upload 的 Multer 設定一致

                try {
                    // 使用 /api/upload 端點
                    const uploadResponse = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData,
                    });

                    const uploadData = await uploadResponse.json();
                    if (!uploadResponse.ok || !uploadData.success) {
                        throw new Error(uploadData.error || `圖片上傳失敗 (${uploadResponse.status})`);
                    }
                    uploadedImageUrl = uploadData.url;
                    if (adminPostImageUploadStatus) {
                        adminPostImageUploadStatus.textContent = '圖片上傳成功！';
                        adminPostImageUploadStatus.style.color = 'green';
                    }
                    setTimeout(() => {
                        if(adminPostImageUploadStatusContainer) adminPostImageUploadStatusContainer.style.display = 'none';
                    }, 2000);

                } catch (uploadError) {
                    console.error('發表新留言時圖片上傳失敗:', uploadError);
                    adminPostStatus.textContent = `圖片上傳失敗：${uploadError.message}`;
                    adminPostStatus.style.color = 'red';
                    if (adminPostImageUploadStatus) {
                        adminPostImageUploadStatus.textContent = `圖片上傳失敗：${uploadError.message}`;
                        adminPostImageUploadStatus.style.color = 'red';
                    }
                    submitAdminPostBtn.disabled = false;
                    setTimeout(() => { /* 這裡可以選擇是否重置 isReplyingCooldown，如果有的話 */ }, 1000);
                    return;
                }
            } else {
                if(adminPostImageUploadStatusContainer) adminPostImageUploadStatusContainer.style.display = 'none';
                if(adminPostImageUploadStatus) adminPostImageUploadStatus.textContent = '';
            }

            // 步驟 2: 送出留言 (包含圖片 URL，如果有的話)
            try {
                const messagePayload = {
                    admin_identity_id: selectedIdentityId,
                    content: content,
                };
                if (uploadedImageUrl) {
                    messagePayload.image_url = uploadedImageUrl;
                }

                const response = await fetch('/api/admin/guestbook/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(messagePayload),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                    throw new Error(errorData.error || `發表失敗 (${response.status})`);
                }

                adminPostStatus.textContent = '管理員留言發表成功！';
                adminPostStatus.style.color = 'green';
                adminPostForm.reset();
                if (adminPostImageInput) adminPostImageInput.value = '';
                updateAdminPostImagePreview();
                if(adminPostImageUploadStatusContainer) adminPostImageUploadStatusContainer.style.display = 'none';


                fetchAdminGuestbookList(1, 'all', '', 'latest');
                setTimeout(closeAdminPostModal, 1500);

            } catch (error) {
                 console.error('管理員發表留言失敗:', error);
                 adminPostStatus.textContent = `發表失敗：${error.message}`;
                 adminPostStatus.style.color = 'red';
                 submitAdminPostBtn.disabled = false;
            }
            // 不需要 finally 中的 submitAdminPostBtn.disabled = false; 因為有延遲關閉
        });
    } else {
        console.error("錯誤：管理員發表 Modal 的相關表單元素未完全找到。");
    }

    // --- Tab 切換事件監聽 ---
    if (adminTabsContainer) {
        adminTabsContainer.addEventListener('click', (event) => {
            // ... (此函數保持不變)
            const clickedTab = event.target.closest('.tab-link');
            if (!clickedTab) return;

            document.querySelectorAll('.admin-tabs .tab-link').forEach(tab => tab.classList.remove('active'));
            clickedTab.classList.add('active');
            activeTab = clickedTab.dataset.tab;

            if (filterStatus) filterStatus.value = 'all';
            if (searchTermInput) searchTermInput.value = '';
            currentFilter = 'all';
            currentSearch = '';
            currentPage = 1; 

            if (activeTab === 'all-messages') {
                if (filterStatus) filterStatus.disabled = false;
                if (searchTermInput) searchTermInput.disabled = false;
                if (searchButton) searchButton.disabled = false;
                fetchAdminGuestbookList(1, 'all', '', 'latest');
            } else if (activeTab === 'reported-content') {
                if (filterStatus) filterStatus.disabled = true;
                if (searchTermInput) searchTermInput.disabled = true;
                if (searchButton) searchButton.disabled = true;
                fetchAndRenderReportedContent();
            }
        });
    }

    // --- 獲取並渲染已檢舉內容列表 ---
    async function fetchAndRenderReportedContent() {
        // ... (此函數保持不變，除了更新表頭的部分)
        if (!guestbookAdminList || !tableHeadRow) return;
        updateTableHeaders('reported-content'); // 確保是檢舉列表的表頭
        guestbookAdminList.innerHTML = `<tr><td colspan="${tableHeadRow.cells.length}">正在載入已檢舉內容...</td></tr>`;
        if (paginationContainer) paginationContainer.innerHTML = '';

        try {
            const response = await fetch('/api/admin/guestbook/reported-content');
            if (!response.ok) {
                let errorMsg = `HTTP 錯誤 ${response.status}`;
                try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
                throw new Error(`無法獲取已檢舉內容 (${errorMsg})`);
            }
            const data = await response.json();
            renderReportedList(data.reportedItems || []);
            updateReportedCountBadge();
        } catch (error) {
            console.error('獲取已檢舉內容失敗:', error);
            guestbookAdminList.innerHTML = `<tr><td colspan="${tableHeadRow.cells.length}" style="color: red;">無法載入已檢舉內容：${error.message}</td></tr>`;
        }
    }

    // --- 渲染已檢舉內容列表 ---
    function renderReportedList(items) {
        // ... (此函數保持不變)
        if (!guestbookAdminList) return;
        guestbookAdminList.innerHTML = '';

        if (!items || items.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = tableHeadRow.cells.length;
            td.textContent = '目前沒有待處理的檢舉。';
            tr.appendChild(td);
            guestbookAdminList.appendChild(tr);
            return;
        }

        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.id = `${item.type}-row-${item.id}`;

            const tdId = document.createElement('td'); tdId.textContent = item.id;
            const tdType = document.createElement('td'); tdType.textContent = item.type === 'message' ? '留言' : '回覆';
            const tdAuthor = document.createElement('td'); tdAuthor.textContent = item.author_name || '匿名';
            const tdPreview = document.createElement('td');
                const previewText = item.content_preview || '';
                tdPreview.textContent = previewText;
                tdPreview.title = previewText;
                tdPreview.style.whiteSpace = 'pre-wrap';
                tdPreview.style.wordWrap = 'break-word';
                tdPreview.style.maxWidth = '300px'; 
                tdPreview.style.overflow = 'hidden';
                tdPreview.style.textOverflow = 'ellipsis';


            const tdReportTime = document.createElement('td');
            tdReportTime.textContent = new Date(item.updated_at || item.created_at).toLocaleString('zh-TW');

            const tdActions = document.createElement('td');
            tdActions.className = 'actions';

            const unreportBtn = document.createElement('button');
            unreportBtn.className = 'btn btn-success btn-sm unreport-item-btn';
            unreportBtn.textContent = '解除檢舉';
            unreportBtn.dataset.itemId = item.id;
            unreportBtn.dataset.itemType = item.type;

            const detailLink = document.createElement('a');
            detailLink.className = 'btn btn-info btn-sm';
            detailLink.textContent = '查看詳情';
            detailLink.style.marginLeft = '5px';
            if (item.type === 'message') {
                detailLink.href = `/admin-message-detail.html?id=${item.id}`;
            } else if (item.type === 'reply') {
                detailLink.href = `/admin-message-detail.html?id=${item.message_id}#reply-row-${item.id}`;
            }
            detailLink.target = '_blank';

            tdActions.appendChild(unreportBtn);
            tdActions.appendChild(detailLink);

            tr.appendChild(tdId);
            tr.appendChild(tdType);
            tr.appendChild(tdAuthor);
            tr.appendChild(tdPreview);
            tr.appendChild(tdReportTime);
            tr.appendChild(tdActions);

            guestbookAdminList.appendChild(tr);
        });
    }

    // --- 全局點擊事件監聽器 (包含處理不同 Tab 下的按鈕) ---
    if (guestbookAdminList) {
        guestbookAdminList.addEventListener('click', async (event) => {
            const target = event.target;

            // --- 處理 "處理檢舉" 按鈕 (來自主列表) ---
            if (target.matches('.process-report-btn')) {
                 const id = target.dataset.id;
                 const type = target.dataset.type;
                 const row = target.closest('tr');
                 if (row && reportItemIdSpan && reportItemTypeSpan && reportItemAuthorSpan && reportItemContentPreviewDiv && processReportStatusP) {
                     reportItemIdSpan.textContent = id;
                     reportItemTypeSpan.textContent = type === 'message' ? '留言' : '回覆';
                     const authorCell = row.cells[2];
                     const contentPreviewCell = row.cells[3]?.querySelector('a');
                     reportItemAuthorSpan.textContent = authorCell ? authorCell.textContent.split(' (管理員)')[0].trim() : 'N/A';
                     reportItemContentPreviewDiv.textContent = contentPreviewCell ? contentPreviewCell.textContent : '無法載入預覽';
                     processReportStatusP.textContent = '';
                     if(processReportModal) processReportModal.dataset.itemId = id;
                     if(processReportModal) processReportModal.dataset.itemType = type;
                     openModal(processReportModal);
                 } else {
                     console.error('無法找到 Modal 元素或表格行來填充檢舉信息。');
                     alert('打開處理視窗時發生錯誤。');
                 }
            }
            // --- 處理顯隱按鈕 ---
            else if (target.matches('.toggle-visibility-btn')) {
                const id = target.dataset.id;
                const type = target.dataset.type;
                const targetVisibility = target.dataset.targetVisibility === 'true';
                const endpoint = type === 'message'
                    ? `/api/admin/guestbook/messages/${id}/visibility`
                    : `/api/admin/guestbook/replies/${id}/visibility`;
                target.disabled = true;
                try {
                    const response = await fetch(endpoint, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_visible: targetVisibility })
                    });
                     if (!response.ok) { let errorMsg = `HTTP ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {} throw new Error(errorMsg); }
                    // 根據當前 Tab 刷新對應的列表
                    if (activeTab === 'all-messages') {
                        fetchAdminGuestbookList(currentPage, currentFilter, currentSearch, currentSort);
                    } else if (activeTab === 'reported-content') {
                        fetchAndRenderReportedContent();
                    }
                } catch (error) {
                    console.error(`切換 ${type} ${id} 可見度失敗:`, error);
                    alert(`操作失敗：${error.message}`);
                    target.disabled = false;
                }
            }
            // --- 處理刪除按鈕 ---
            else if (target.matches('.delete-item-btn')) {
                const id = target.dataset.id;
                const type = target.dataset.type;
                const name = target.dataset.name || `項目 #${id}`;
                 const itemTypeText = type === 'message' ? '留言' : '回覆';
                if (confirm(`確定要刪除這個 ${itemTypeText} (${name}) 嗎？\n(如果是留言，其下的所有回覆也會被刪除)`)) {
                     const endpoint = type === 'message'
                        ? `/api/admin/guestbook/messages/${id}`
                        : `/api/admin/guestbook/replies/${id}`;
                    target.disabled = true;
                    try {
                        const response = await fetch(endpoint, { method: 'DELETE' });
                         if (!response.ok && response.status !== 204) { let errorMsg = `HTTP ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {} throw new Error(errorMsg); }
                        // 根據當前 Tab 刷新對應的列表
                        if (activeTab === 'all-messages') {
                            fetchAdminGuestbookList(currentPage, currentFilter, currentSearch, currentSort);
                        } else if (activeTab === 'reported-content') {
                            fetchAndRenderReportedContent();
                        }
                    } catch (error) {
                         console.error(`刪除 ${type} ${id} 失敗:`, error);
                         alert(`刪除失敗：${error.message}`);
                         target.disabled = false;
                    }
                }
            }
            // --- 處理「待處理檢舉」列表中的解除檢舉按鈕 ---
            else if (target.matches('.unreport-item-btn')) {
                const itemId = target.dataset.itemId;
                const itemType = target.dataset.itemType;

                if (!itemId || !itemType) {
                    alert('錯誤：缺少項目ID或類型以解除檢舉。');
                    return;
                }

                if (confirm(`確定要解除此 ${itemType === 'message' ? '留言' : '回覆'} (ID: ${itemId}) 的檢舉嗎？\n這會將其設為「未檢舉」且「顯示中」。`)) {
                    target.disabled = true;
                    const endpoint = `/api/admin/guestbook/${itemType}s/${itemId}/status`;
                    const body = { is_reported: false, is_visible: true }; // 解除檢舉並設為可見

                    try {
                        const response = await fetch(endpoint, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });
                        if (!response.ok && response.status !== 204) {
                            const errData = await response.json().catch(() => ({}));
                            throw new Error(errData.error || `操作失敗 (HTTP ${response.status})`);
                        }
                        // 成功後刷新檢舉列表
                        fetchAndRenderReportedContent();
                        // 同時更新徽章
                        updateReportedCountBadge();
                    } catch (error) {
                        console.error(`解除檢舉 ${itemType} ${itemId} 失敗:`, error);
                        alert(`解除檢舉失敗: ${error.message}`);
                        target.disabled = false;
                    }
                }
            }
        });
    }

    // --- 初始載入 ---
    fetchAdminGuestbookList(1, 'all', '', 'latest');
    updateReportedCountBadge();
});