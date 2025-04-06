// public/guestbook-admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
    const guestbookAdminList = document.getElementById('guestbook-admin-list'); // 表格 tbody
    const paginationContainer = document.getElementById('admin-pagination-container');
    const filterStatus = document.getElementById('filter-status');
    const searchTermInput = document.getElementById('search-term');
    const searchButton = document.getElementById('search-button');
    // 注意：後台詳情頁和身份管理頁的按鈕不在此文件中處理

    // --- 狀態變數 ---
    let currentPage = 1;
    let currentFilter = 'all';
    let currentSearch = '';
    let currentSort = 'latest'; // 雖然 API 支持，但前端目前未做排序切換按鈕

    // --- 函數：獲取並顯示管理列表 ---
    async function fetchAdminGuestbookList(page = 1, filter = 'all', search = '', sort = 'latest') {
        if (!guestbookAdminList || !paginationContainer) {
             console.error('錯誤：找不到列表或分頁容器。');
             return;
        }
        guestbookAdminList.innerHTML = '<tr><td colspan="8">正在載入資料...</td></tr>';
        paginationContainer.innerHTML = '';

        // 更新當前狀態
        currentPage = page;
        currentFilter = filter;
        currentSearch = search;
        currentSort = sort; // 保存當前排序狀態

        // 構建 API URL
        const params = new URLSearchParams({
            page: currentPage,
            limit: 15, // 管理頁面每頁顯示 15 筆
            filter: currentFilter,
            search: currentSearch,
            sort: currentSort // 將排序參數傳給後端
        });
        const apiUrl = `/api/admin/guestbook?${params.toString()}`; //【API 路徑】

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

            renderAdminList(data.messages); // 後端 API 回傳 messages 陣列
            renderAdminPagination(data.totalPages, data.currentPage);

        } catch (error) {
            console.error('獲取管理列表失敗:', error);
            guestbookAdminList.innerHTML = `<tr><td colspan="8" style="color: red;">無法載入列表：${error.message}</td></tr>`;
            if (error.message.includes('登入')) {
               alert('請先登入管理後台！');
            }
        }
    }

    // --- 函數：渲染管理列表 (使用 DOM 操作) ---
    function renderAdminList(messages) {
         if (!guestbookAdminList) return;
         guestbookAdminList.innerHTML = ''; // 清空

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

            const tdId = document.createElement('td'); tdId.textContent = msg.id;
            const tdType = document.createElement('td'); tdType.textContent = '留言'; // 目前只有留言
            const tdAuthor = document.createElement('td'); tdAuthor.textContent = msg.author_name || '匿名';
            const tdPreview = document.createElement('td'); tdPreview.className = 'content-preview'; // 可以用 CSS 限制寬度
                const previewLink = document.createElement('a'); // 讓預覽也可點擊
                previewLink.href = `/admin-message-detail.html?id=${msg.id}`;
                previewLink.textContent = msg.content_preview || '';
                previewLink.style.whiteSpace = 'pre-wrap'; // CSS 或 JS 處理換行
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

            // 顯隱按鈕
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'btn btn-warning btn-sm toggle-visibility-btn';
            toggleBtn.textContent = msg.is_visible ? '隱藏' : '顯示';
            toggleBtn.dataset.id = msg.id;
            toggleBtn.dataset.type = 'message';
            toggleBtn.dataset.targetVisibility = !msg.is_visible; // Boolean 值直接存儲

            // 刪除按鈕
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-sm delete-item-btn';
            deleteBtn.textContent = '刪除';
            deleteBtn.dataset.id = msg.id;
            deleteBtn.dataset.type = 'message';
            deleteBtn.dataset.name = `留言 #${msg.id}`; // 用於確認訊息

            // 詳情/回覆連結
            const detailLink = document.createElement('a');
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

            // 【待辦】如果 API 返回回覆，需要在此處遞迴或疊代渲染回覆行
        });
    }

     // --- 函數：渲染管理分頁控制 (使用 DOM 操作) ---
     function renderAdminPagination(totalPages, currentPage) {
         if (!paginationContainer || totalPages <= 1) {
             paginationContainer.innerHTML = '';
             return;
        }
        paginationContainer.innerHTML = ''; // 清空

        // 上一頁按鈕
        const prevButton = document.createElement('button');
        prevButton.className = 'page-btn';
        prevButton.dataset.page = currentPage - 1;
        prevButton.disabled = (currentPage === 1);
        prevButton.innerHTML = '<< 上一頁';
        paginationContainer.appendChild(prevButton);

        // 頁碼按鈕
        const maxPagesToShow = 5; let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2)); let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1); if (endPage - startPage + 1 < maxPagesToShow) startPage = Math.max(1, endPage - maxPagesToShow + 1);
        if (startPage > 1) { const span = document.createElement('span'); span.textContent = '...'; paginationContainer.appendChild(span); }
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = 'page-btn';
            pageButton.dataset.page = i;
            pageButton.disabled = (i === currentPage);
            if (i === currentPage) pageButton.classList.add('current-page'); // 用 class
            pageButton.textContent = i;
            paginationContainer.appendChild(pageButton);
        }
        if (endPage < totalPages) { const span = document.createElement('span'); span.textContent = '...'; paginationContainer.appendChild(span); }

        // 下一頁按鈕
        const nextButton = document.createElement('button');
        nextButton.className = 'page-btn';
        nextButton.dataset.page = currentPage + 1;
        nextButton.disabled = (currentPage === totalPages);
        nextButton.innerHTML = '下一頁 >>';
        paginationContainer.appendChild(nextButton);
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

    // --- 移除全局函數 (改用事件委派) ---
    // window.toggleVisibility = ...
    // window.deleteItem = ...

    // --- 初始載入 ---
    fetchAdminGuestbookList(1, 'all', '', 'latest'); // 載入第一頁，所有狀態，無搜尋，最新活動排序

});