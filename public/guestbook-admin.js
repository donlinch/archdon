// public/guestbook-admin2.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 (原有) ---
    const guestbookAdminList = document.getElementById('guestbook-admin-list');
    const paginationContainer = document.getElementById('admin-pagination-container');
    const filterStatus = document.getElementById('filter-status');
    const searchTermInput = document.getElementById('search-term');
    const searchButton = document.getElementById('search-button');

    // --- ★ 新增: Modal 相關 DOM 元素 ★ ---
    const adminPostNewMessageBtn = document.getElementById('admin-post-new-message-btn');
    const adminPostModal = document.getElementById('admin-post-modal');
    const closeAdminPostModalBtn = document.getElementById('close-admin-post-modal-btn');
    const adminPostForm = document.getElementById('admin-post-form');
    const adminPostIdentitySelect = document.getElementById('admin-post-identity-select');
    const adminPostContent = document.getElementById('admin-post-content');
    const adminPostStatus = document.getElementById('admin-post-status');
    const submitAdminPostBtn = document.getElementById('submit-admin-post-btn');
    const adminPostCancelBtns = adminPostModal ? adminPostModal.querySelectorAll('.close-modal-btn') : []; // 獲取所有關閉按鈕

    // --- 狀態變數 (原有) ---
    let currentPage = 1;
    let currentFilter = 'all';
    let currentSearch = '';
    let currentSort = 'latest';

    // --- 輔助函數 ---
    function closeModal(modalElement) {
        if (modalElement) modalElement.style.display = 'none';
    }
    function openModal(modalElement) {
        if (modalElement) modalElement.style.display = 'flex';
    }

    // --- ★ 新增: 獲取並填充管理員身份下拉選單 (用於新 Modal) ★ ---
    async function fetchAndPopulateAdminIdentities(selectElement) {
        if (!selectElement) return;
        selectElement.disabled = true;
        selectElement.innerHTML = '<option value="">載入身份中...</option>';
        try {
            const response = await fetch('/api/admin/identities'); // API 路徑正確
            if (!response.ok) throw new Error('無法獲取身份列表');
            const identities = await response.json();

            if (identities && identities.length > 0) {
                selectElement.innerHTML = ''; // 清空
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '-- 請選擇身份 --';
                selectElement.appendChild(defaultOption);

                identities.forEach(identity => {
                    const option = document.createElement('option');
                    option.value = identity.id;
                    option.textContent = identity.name; // 使用 textContent
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

    // --- ★ 新增: 打開管理員發表新留言 Modal 的函數 ★ ---
    async function openAdminPostModal() {
        if (!adminPostModal || !adminPostForm || !adminPostStatus || !adminPostIdentitySelect) {
            console.error("無法打開 Modal：缺少必要的 Modal 元素。");
            alert("打開視窗時出錯，請檢查頁面元件。");
            return;
        }
        adminPostForm.reset(); // 清空表單
        adminPostStatus.textContent = ''; // 清空狀態
        submitAdminPostBtn.disabled = false; // 確保按鈕可用
        submitAdminPostBtn.textContent = '確認發表';

        // 異步加載身份列表
        await fetchAndPopulateAdminIdentities(adminPostIdentitySelect);

        openModal(adminPostModal); // 顯示 Modal
        adminPostIdentitySelect.focus(); // 聚焦到身份選擇
    }

    // --- ★ 新增: 關閉管理員發表新留言 Modal 的函數 ★ ---
    function closeAdminPostModal() {
        closeModal(adminPostModal);
    }


    // --- 函數：獲取並顯示管理列表 (原有，但可能需要更新渲染邏輯) ---
    async function fetchAdminGuestbookList(page = 1, filter = 'all', search = '', sort = 'latest') {
        // ... (函數開頭的檢查和參數更新保持不變) ...
        if (!guestbookAdminList || !paginationContainer) {
            console.error('錯誤：找不到列表或分頁容器。');
            return;
        }
        guestbookAdminList.innerHTML = '<tr><td colspan="8">正在載入資料...</td></tr>';
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

            renderAdminList(data.messages); // <--- 調用修改後的 renderAdminList
            renderAdminPagination(data.totalPages, data.currentPage);

        } catch (error) {
            console.error('獲取管理列表失敗:', error);
            guestbookAdminList.innerHTML = `<tr><td colspan="8" style="color: red;">無法載入列表：${error.message}</td></tr>`;
            if (error.message.includes('登入')) {
               alert('請先登入管理後台！');
            }
        }
    }

     // --- 函數：渲染管理列表 (★ 可能需要微調以顯示管理員標記 ★) ---
     function renderAdminList(messages) {
        if (!guestbookAdminList) return;
        guestbookAdminList.innerHTML = '';
        if (!messages || messages.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 8; // 注意表格列數
            td.textContent = '找不到符合條件的留言。';
            tr.appendChild(td);
            guestbookAdminList.appendChild(tr);
            return;
        }

        messages.forEach(msg => {
            const tr = document.createElement('tr');
            tr.id = `message-row-${msg.id}`;

            // ★ 可選：根據 is_admin_post 改變行的樣式
            if (msg.is_admin_post) {
                 tr.style.backgroundColor = "#fffaf0"; // 淡黃色背景
            }

            const tdId = document.createElement('td'); tdId.textContent = msg.id;
            const tdType = document.createElement('td'); tdType.textContent = '留言';
            const tdAuthor = document.createElement('td');
                // ★ 顯示作者，如果是管理員發的，加個標記
                tdAuthor.textContent = msg.author_name || '匿名';
                if (msg.is_admin_post) {
                    const adminBadge = document.createElement('span');
                    adminBadge.textContent = ' (管理員)';
                    adminBadge.style.color = '#FF8F00'; // 橙色
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

            const tdActions = document.createElement('td');
            tdActions.className = 'actions';
                const toggleBtn = document.createElement('button'); /* ... 顯隱按鈕代碼不變 ... */
                toggleBtn.className = 'btn btn-warning btn-sm toggle-visibility-btn';
                toggleBtn.textContent = msg.is_visible ? '隱藏' : '顯示';
                toggleBtn.dataset.id = msg.id;
                toggleBtn.dataset.type = 'message';
                toggleBtn.dataset.targetVisibility = !msg.is_visible;

                const deleteBtn = document.createElement('button'); /* ... 刪除按鈕代碼不變 ... */
                deleteBtn.className = 'btn btn-danger btn-sm delete-item-btn';
                deleteBtn.textContent = '刪除';
                deleteBtn.dataset.id = msg.id;
                deleteBtn.dataset.type = 'message';
                deleteBtn.dataset.name = `留言 #${msg.id}`;

                const detailLink = document.createElement('a'); /* ... 詳情連結代碼不變 ... */
                detailLink.className = 'btn btn-info btn-sm';
                detailLink.href = `/admin-message-detail.html?id=${msg.id}`;
                detailLink.textContent = '詳情/回覆';

            tdActions.appendChild(toggleBtn);
            tdActions.appendChild(deleteBtn);
            tdActions.appendChild(detailLink);

            tr.appendChild(tdId);
            tr.appendChild(tdType);
            tr.appendChild(tdAuthor);
            tr.appendChild(tdPreview);
            tr.appendChild(tdReplyCount);
            tr.appendChild(tdLastActivity);
            tr.appendChild(tdStatus);
            tr.appendChild(tdActions);

            guestbookAdminList.appendChild(tr);
        });
    }

     // --- 函數：渲染管理分頁控制 (原有) ---
     function renderAdminPagination(totalPages, currentPage) {
        // ... (函數內容保持不變) ...
        if (!paginationContainer || totalPages <= 1) {
            if(paginationContainer) paginationContainer.innerHTML = '';
            return;
        }
        paginationContainer.innerHTML = ''; // Clear previous pagination
        const createPageButton = (pageNumber, text, isDisabled = false, isActive = false) => {
            const button = document.createElement('button');
            button.dataset.page = pageNumber;
            button.textContent = text;
            button.disabled = isDisabled;
            button.className = 'page-btn';
            if (isActive) button.classList.add('current-page');
            return button;
        };
        // Prev button
        paginationContainer.appendChild(createPageButton(currentPage - 1, '<< 上一頁', currentPage === 1));
        // Page numbers
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        if (endPage - startPage + 1 < maxPagesToShow) { startPage = Math.max(1, endPage - maxPagesToShow + 1); }
        if (startPage > 1) { const first = createPageButton(1, '1'); paginationContainer.appendChild(first); if (startPage > 2) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; paginationContainer.appendChild(ellipsis); } }
        for (let i = startPage; i <= endPage; i++) { paginationContainer.appendChild(createPageButton(i, i, false, i === currentPage)); }
        if (endPage < totalPages) { if (endPage < totalPages - 1) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; paginationContainer.appendChild(ellipsis); } const last = createPageButton(totalPages, totalPages); paginationContainer.appendChild(last); }
        // Next button
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

     // --- 【★ 新增 ★】事件委派監聽器，處理顯隱和刪除按鈕 ---
     if (guestbookAdminList) {
        guestbookAdminList.addEventListener('click', async (event) => {
            const target = event.target;

            // --- 處理顯隱按鈕 ---
            if (target.matches('.toggle-visibility-btn')) {
                const id = target.dataset.id;
                const type = target.dataset.type; // 'message' 或 'reply'
                // data-target-visibility 存的是 boolean，需要轉換
                const targetVisibility = target.dataset.targetVisibility === 'true';
                const endpoint = type === 'message'
                    ? `/api/admin/guestbook/messages/${id}/visibility`
                    : `/api/admin/guestbook/replies/${id}/visibility`;

                target.disabled = true; // 禁用按鈕

                try {
                    const response = await fetch(endpoint, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_visible: targetVisibility })
                    });
                     if (!response.ok) {
                         let errorMsg = `HTTP ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {} throw new Error(errorMsg);
                     }
                    // 成功後刷新當前頁面列表
                    fetchAdminGuestbookList(currentPage, currentFilter, currentSearch, currentSort);
                } catch (error) {
                    console.error(`切換 ${type} ${id} 可見度失敗:`, error);
                    alert(`操作失敗：${error.message}`);
                    target.disabled = false; // 恢復按鈕
                }
            }

            // --- 處理刪除按鈕 ---
            else if (target.matches('.delete-item-btn')) {
                const id = target.dataset.id;
                const type = target.dataset.type;
                const name = target.dataset.name || `項目 #${id}`; // 用於確認訊息
                 const itemTypeText = type === 'message' ? '留言' : '回覆';

                if (confirm(`確定要刪除這個 ${itemTypeText} (${name}) 嗎？\n(如果是留言，其下的所有回覆也會被刪除)`)) {
                     const endpoint = type === 'message'
                        ? `/api/admin/guestbook/messages/${id}`
                        : `/api/admin/guestbook/replies/${id}`;

                    target.disabled = true; // 禁用按鈕

                    try {
                        const response = await fetch(endpoint, { method: 'DELETE' });
                         if (!response.ok && response.status !== 204) { // 204 也算成功
                             let errorMsg = `HTTP ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {} throw new Error(errorMsg);
                         }
                         // 成功後刷新列表
                         fetchAdminGuestbookList(currentPage, currentFilter, currentSearch, currentSort);
                    } catch (error) {
                         console.error(`刪除 ${type} ${id} 失敗:`, error);
                         alert(`刪除失敗：${error.message}`);
                         target.disabled = false; // 恢復按鈕
                    }
                }
            }
        });
     } 

   // --- ★ 新增: 事件監聽 - 打開/關閉管理員發表 Modal ★ ---
   if (adminPostNewMessageBtn) {
    adminPostNewMessageBtn.addEventListener('click', openAdminPostModal);
}
if (closeAdminPostModalBtn) {
    closeAdminPostModalBtn.addEventListener('click', closeAdminPostModal);
}
adminPostCancelBtns.forEach(btn => { // 處理所有 class="close-modal-btn" 的取消按鈕
    btn.addEventListener('click', closeAdminPostModal);
});
// 點擊 Modal 外部關閉
if (adminPostModal) {
    adminPostModal.addEventListener('click', (event) => {
        if (event.target === adminPostModal) { // 確保點擊的是背景，而不是內容
            closeAdminPostModal();
        }
    });
}

// --- ★ 新增: 事件監聽 - 提交管理員發表表單 ★ ---
if (adminPostForm && submitAdminPostBtn && adminPostStatus && adminPostIdentitySelect && adminPostContent) {
    adminPostForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // 阻止表單預設提交

        const selectedIdentityId = adminPostIdentitySelect.value;
        const content = adminPostContent.value.trim();

        // 基本驗證
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

        try {
            const response = await fetch('/api/admin/guestbook/messages', { // 調用新的 API
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admin_identity_id: selectedIdentityId,
                    content: content
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                throw new Error(errorData.error || `發表失敗 (${response.status})`);
            }

            adminPostStatus.textContent = '管理員留言發表成功！';
            adminPostStatus.style.color = 'green';
            adminPostForm.reset(); // 清空表單

            // 成功後刷新列表並關閉 Modal
            fetchAdminGuestbookList(1, 'all', '', 'latest'); // 跳回第一頁看最新留言
            setTimeout(closeAdminPostModal, 1500); // 延遲關閉

        } catch (error) {
             console.error('管理員發表留言失敗:', error);
             adminPostStatus.textContent = `發表失敗：${error.message}`;
             adminPostStatus.style.color = 'red';
             submitAdminPostBtn.disabled = false; // 允許重試
             submitAdminPostBtn.textContent = '確認發表';
        } finally {
             // 在 finally 中確保按鈕狀態恢復 (如果上面沒有延遲關閉)
             // submitAdminPostBtn.disabled = false;
             // submitAdminPostBtn.textContent = '確認發表';
             // 但因為有延遲關閉，按鈕狀態會在下次打開時重置
        }
    });
} else {
    console.error("錯誤：管理員發表 Modal 的相關表單元素未完全找到。");
}

    // --- 初始載入 ---
    fetchAdminGuestbookList(1, 'all', '', 'latest'); // 載入第一頁，所有狀態，無搜尋，最新活動排序

});  