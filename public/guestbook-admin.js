// public/guestbook-admin.js
document.addEventListener('DOMContentLoaded', () => {
    const guestbookAdminList = document.getElementById('guestbook-admin-list');
    const paginationContainer = document.getElementById('admin-pagination-container');
    const filterStatus = document.getElementById('filter-status');
    const searchTermInput = document.getElementById('search-term');
    const searchButton = document.getElementById('search-button');
    // const manageIdentitiesBtn = document.getElementById('manage-identities-btn'); // 如果按鈕存在

    let currentPage = 1;
    let currentFilter = 'all';
    let currentSearch = '';

    // --- 函數：獲取並顯示管理列表 ---
    async function fetchAdminGuestbookList(page = 1, filter = 'all', search = '') {
        if (!guestbookAdminList || !paginationContainer) return;
        guestbookAdminList.innerHTML = '<tr><td colspan="8">正在載入資料...</td></tr>';
        paginationContainer.innerHTML = '';

        currentPage = page; // 更新當前狀態
        currentFilter = filter;
        currentSearch = search;

        // 構建 API URL
        const params = new URLSearchParams({
            page: currentPage,
            limit: 15, // 管理頁面每頁顯示 15 筆
            filter: currentFilter,
            search: currentSearch
        });
        const apiUrl = `/api/admin/guestbook?${params.toString()}`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                let errorMsg = `HTTP 錯誤 ${response.status}`;
                try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
                if (response.status === 401) throw new Error('您需要登入才能訪問此功能。');
                throw new Error(`無法獲取管理列表 (${errorMsg})`);
            }
            const data = await response.json();

            renderAdminList(data.messages); // 後端 API 目前只回傳 messages
            renderAdminPagination(data.totalPages, data.currentPage);

        } catch (error) {
            console.error('獲取管理列表失敗:', error);
            guestbookAdminList.innerHTML = `<tr><td colspan="8" style="color: red;">無法載入列表：${error.message}</td></tr>`;
            if (error.message.includes('登入')) {
                alert('請先登入管理後台！');
                // 或者可以導向登入頁面（如果有的話）
            }
        }
    }

    // --- 函數：渲染管理列表 ---
    function renderAdminList(messages) {
         if (!guestbookAdminList) return;
        if (!messages || messages.length === 0) {
            guestbookAdminList.innerHTML = '<tr><td colspan="8">找不到符合條件的留言。</td></tr>';
            return;
        }

        let html = '';
        messages.forEach(msg => {
            const activityDate = new Date(msg.last_activity_at).toLocaleString('zh-TW');
            const statusText = msg.is_visible ? '顯示中' : '已隱藏';
            const statusClass = msg.is_visible ? 'status-visible' : 'status-hidden';
            const toggleVisibilityText = msg.is_visible ? '隱藏' : '顯示';
            const toggleVisibilityAction = !msg.is_visible; // 要切換成的狀態

            html += `
                <tr id="message-row-${msg.id}">
                    <td>${msg.id}</td>
                    <td>留言</td> <!-- 目前 API 只回傳留言 -->
                    <td>${escapeHtml(msg.author_name || '匿名')}</td>
                    <td>${escapeHtml(msg.content_preview || '')}</td>
                    <td>${msg.reply_count || 0}</td>
                    <td>${activityDate}</td>
                    <td class="${statusClass}">${statusText}</td>
                    <td class="actions">
                        <button class="btn btn-warning btn-sm" onclick="toggleVisibility(${msg.id}, 'message', ${toggleVisibilityAction})">${toggleVisibilityText}</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteItem(${msg.id}, 'message')">刪除</button>
                        <a href="/admin-message-detail.html?id=${msg.id}" class="btn btn-info btn-sm">詳情/回覆</a>
                    </td>
                </tr>
                `;
                // 【待辦】如果需要在列表頁也顯示回覆，需要修改 API 並在這裡加入渲染回覆的邏輯
        });
        guestbookAdminList.innerHTML = html;
    }

     // --- 函數：渲染管理分頁控制 ---
     function renderAdminPagination(totalPages, currentPage) {
        if (!paginationContainer || totalPages <= 1) {
             paginationContainer.innerHTML = '';
             return;
        }
        // (分頁 HTML 生成邏輯同 guestbook.js, 確保按鈕有 data-page 屬性)
        let paginationHtml = '';
        paginationHtml += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}><< 上一頁</button>`;
        const maxPagesToShow = 5; let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2)); let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1); if (endPage - startPage + 1 < maxPagesToShow) startPage = Math.max(1, endPage - maxPagesToShow + 1);
        if (startPage > 1) paginationHtml += `<span>...</span>`;
        for (let i = startPage; i <= endPage; i++) { paginationHtml += `<button class="page-btn" data-page="${i}" ${i === currentPage ? 'disabled style="font-weight:bold;"' : ''}>${i}</button>`; }
        if (endPage < totalPages) paginationHtml += `<span>...</span>`;
        paginationHtml += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>下一頁 >></button>`;
        paginationContainer.innerHTML = paginationHtml;
     }

     // --- 事件監聽：篩選、搜尋、分頁 ---
     if (filterStatus) {
         filterStatus.addEventListener('change', () => {
             fetchAdminGuestbookList(1, filterStatus.value, currentSearch);
         });
     }
     if (searchButton && searchTermInput) {
         searchButton.addEventListener('click', () => {
             fetchAdminGuestbookList(1, currentFilter, searchTermInput.value.trim());
         });
         searchTermInput.addEventListener('keyup', (e) => { // 按 Enter 也能搜尋
             if (e.key === 'Enter') {
                fetchAdminGuestbookList(1, currentFilter, searchTermInput.value.trim());
             }
         });
     }
     if (paginationContainer) {
        paginationContainer.addEventListener('click', (e) => {
            if (e.target.matches('.page-btn') && !e.target.disabled) {
                const page = parseInt(e.target.dataset.page, 10);
                if (!isNaN(page)) {
                    fetchAdminGuestbookList(page, currentFilter, currentSearch);
                }
            }
        });
     }

     // --- 函數：切換可見度 (全局暴露給 onclick) ---
     window.toggleVisibility = async (id, type, targetVisibility) => {
         const endpoint = type === 'message'
            ? `/api/admin/guestbook/messages/${id}/visibility`
            : `/api/admin/guestbook/replies/${id}/visibility`;

         // 可選：暫時禁用按鈕
         const button = document.querySelector(`#message-row-${id} .btn-warning, #reply-row-${id} .btn-warning`); // 需要為回覆行添加 ID
         if(button) button.disabled = true;

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
             fetchAdminGuestbookList(currentPage, currentFilter, currentSearch);
         } catch (error) {
             console.error(`切換 ${type} ${id} 可見度失敗:`, error);
             alert(`操作失敗：${error.message}`);
             if(button) button.disabled = false; // 恢復按鈕
         }
     };

     // --- 函數：刪除項目 (全局暴露給 onclick) ---
      window.deleteItem = async (id, type) => {
        const itemTypeText = type === 'message' ? '留言' : '回覆';
        if (confirm(`確定要刪除這個 ${itemTypeText} (ID: ${id}) 嗎？\n(如果是留言，其下的所有回覆也會被刪除)`)) {
             const endpoint = type === 'message'
                ? `/api/admin/guestbook/messages/${id}`
                : `/api/admin/guestbook/replies/${id}`;

             // 可選：暫時禁用按鈕
             const button = document.querySelector(`#message-row-${id} .btn-danger, #reply-row-${id} .btn-danger`);
             if(button) button.disabled = true;

            try {
                const response = await fetch(endpoint, { method: 'DELETE' });
                 if (!response.ok) {
                     if (response.status === 204) { // DELETE 成功通常回 204
                        // 成功
                     } else {
                         let errorMsg = `HTTP ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {} throw new Error(errorMsg);
                     }
                 }
                 // 成功後刷新列表
                 fetchAdminGuestbookList(currentPage, currentFilter, currentSearch);
            } catch (error) {
                 console.error(`刪除 ${type} ${id} 失敗:`, error);
                 alert(`刪除失敗：${error.message}`);
                 if(button) button.disabled = false; // 恢復按鈕
            }
        }
     };

     // --- 輔助函數：HTML 特殊字符轉義 ---
     function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
        .replace(/&/g, '&amp;')
        
        // < 轉成 & l t ;
        .replace(/</g, '&lt;')

        // > 轉成 & g t ;
        .replace(/>/g, '&gt;')

        // " 轉成 & q u o t ;
        .replace(/"/g, '&quot;')

        // ' 轉成 & # 3 9 ;  (數字實體)
        .replace(/'/g, '&#39;');
     }

    // --- 初始載入 ---
    fetchAdminGuestbookList(1);

});