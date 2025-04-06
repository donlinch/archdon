// public/admin-message-detail.js
document.addEventListener('DOMContentLoaded', () => {
    const messageDetailContainer = document.getElementById('admin-message-detail-main');
    const replyListContainer = document.getElementById('admin-reply-list-container');
    const adminReplyForm = document.getElementById('admin-reply-form');
    const identitySelect = document.getElementById('admin-identity-select');
    const adminReplyContent = document.getElementById('admin-reply-content');
    const adminReplyStatus = document.getElementById('admin-reply-status');
    const submitAdminReplyBtn = document.getElementById('submit-admin-reply-btn');
    const messageIdDisplay = document.getElementById('message-id-display'); // 用於顯示留言 ID

    let currentMessageId = null;

    // --- 函數：從 URL 獲取 message ID ---
    function getMessageIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    // --- 函數：獲取並顯示留言詳情和所有回覆 ---
    async function fetchAdminMessageDetail(messageId) {
        if (!messageDetailContainer || !replyListContainer) return;
        messageDetailContainer.innerHTML = '<p>正在載入留言內容...</p>';
        replyListContainer.innerHTML = '<p>正在載入回覆...</p>';
        if (messageIdDisplay) messageIdDisplay.textContent = `(ID: ${messageId})`;

        try {
            const response = await fetch(`/api/admin/guestbook/message/${messageId}`);
            if (!response.ok) {
                let errorMsg = `HTTP 錯誤 ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {}
                if (response.status === 401) throw new Error('您需要登入才能訪問此功能。');
                if (response.status === 404) throw new Error('找不到指定的留言。');
                throw new Error(`無法獲取留言詳情 (${errorMsg})`);
            }
            const data = await response.json();

            renderAdminMessageDetail(data.message);
            renderAdminReplyList(data.replies);

        } catch (error) {
            console.error('獲取管理詳情失敗:', error);
            messageDetailContainer.innerHTML = `<p style="color: red;">無法載入留言：${error.message}</p>`;
            replyListContainer.innerHTML = ''; // 清空回覆區
            if (error.message.includes('登入')) alert('請先登入管理後台！');
        }
    }

    // --- 函數：渲染主留言詳情 (管理視圖) ---
    function renderAdminMessageDetail(message) {
        if (!messageDetailContainer || !message) return;
        const createDate = new Date(message.created_at).toLocaleString('zh-TW');
        const lastActivityDate = new Date(message.last_activity_at).toLocaleString('zh-TW');
        const statusText = message.is_visible ? '顯示中' : '已隱藏';
        const statusClass = message.is_visible ? 'status-visible' : 'status-hidden';
        const toggleVisibilityText = message.is_visible ? '設為隱藏' : '設為顯示';
        const toggleVisibilityAction = !message.is_visible;
         // 處理換行
        const formattedContent = escapeHtml(message.content || '').replace(/\n/g, '<br>');

        messageDetailContainer.innerHTML = `
            <p><strong>作者:</strong> ${escapeHtml(message.author_name || '匿名')}
               <span class="timestamp">(發表於: ${createDate})</span></p>
            <p><strong>最後活動:</strong> ${lastActivityDate}</p>
            <p><strong>狀態:</strong> <span class="${statusClass}">${statusText}</span>
               <button class="btn btn-secondary btn-sm" style="margin-left: 10px;"
                       onclick="toggleVisibility(${message.id}, 'message', ${toggleVisibilityAction})">
                   ${toggleVisibilityText}
               </button>
            </p>
             <p><strong>回覆數:</strong> ${message.reply_count || 0}</p>
            <hr>
            <strong>內容:</strong>
            <div class="message-content" style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 5px;">
                ${formattedContent}
            </div>
        `;
    }

    // --- 函數：渲染回覆列表 (管理視圖) ---
    function renderAdminReplyList(replies) {
        if (!replyListContainer) return;
        if (!replies || replies.length === 0) {
            replyListContainer.innerHTML = '<p>目前沒有回覆。</p>';
            return;
        }

        let html = '';
        replies.forEach(reply => {
            const replyDate = new Date(reply.created_at).toLocaleString('zh-TW');
            const authorDisplay = reply.is_admin_reply
                ? `[${escapeHtml(reply.admin_identity_name || '管理員')}]` // 使用身份名稱
                : escapeHtml(reply.author_name || '匿名');
            const replyClass = reply.is_admin_reply ? 'reply-item admin-reply' : 'reply-item';
            const statusText = reply.is_visible ? '顯示中' : '已隱藏';
            const statusClass = reply.is_visible ? 'status-visible' : 'status-hidden';
            const toggleVisibilityText = reply.is_visible ? '隱藏' : '顯示';
            const toggleVisibilityAction = !reply.is_visible;
            const formattedContent = escapeHtml(reply.content || '').replace(/\n/g, '<br>');

             // 添加 ID 到回覆行方便 JS 定位
            html += `
                <div class="${replyClass}" id="reply-row-${reply.id}" style="${reply.is_visible ? '' : 'opacity:0.6;'}">
                    <p style="margin-bottom: 5px;">
                        <span class="author">${authorDisplay}</span>
                        <span class="timestamp">(${replyDate})</span>
                        <span style="margin-left: 10px;">[狀態: <span class="${statusClass}">${statusText}</span>]</span>
                    </p>
                    <div class="reply-content" style="margin-bottom: 5px;">${formattedContent}</div>
                    <div class="reply-actions">
                        <button class="btn btn-warning btn-sm" onclick="toggleVisibility(${reply.id}, 'reply', ${toggleVisibilityAction})">${toggleVisibilityText}</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteItem(${reply.id}, 'reply')">刪除</button>
                    </div>
                </div>
                <hr style="border-top: 1px dashed #eee; margin: 10px 0;">
            `;
        });
        replyListContainer.innerHTML = html;
    }

    // --- 函數：獲取並填充管理員身份下拉選單 ---
    async function fetchAndPopulateIdentities() {
        if (!identitySelect) return;
        identitySelect.disabled = true; // 禁用直到載入完成
        identitySelect.innerHTML = '<option value="">載入中...</option>';
        try {
            const response = await fetch('/api/admin/identities');
            if (!response.ok) throw new Error('無法獲取身份列表');
            const identities = await response.json();

            if (identities && identities.length > 0) {
                let optionsHtml = '<option value="">-- 請選擇身份 --</option>';
                identities.forEach(identity => {
                    optionsHtml += `<option value="${identity.id}">${escapeHtml(identity.name)}</option>`;
                });
                identitySelect.innerHTML = optionsHtml;
                identitySelect.disabled = false;
            } else {
                identitySelect.innerHTML = '<option value="">沒有可用的身份</option>';
            }
        } catch (error) {
            console.error('獲取身份失敗:', error);
            identitySelect.innerHTML = '<option value="">獲取身份失敗</option>';
            // 可能需要提示管理員先去新增身份
            if (adminReplyStatus) {
                adminReplyStatus.textContent = '錯誤：無法載入回覆身份，請先至身份管理頁面新增。';
                adminReplyStatus.style.color = 'red';
            }
        }
    }

    // --- 事件監聽：提交管理員回覆 ---
    if (adminReplyForm && submitAdminReplyBtn && adminReplyStatus && identitySelect) {
        adminReplyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentMessageId) return; // 確保有 message ID

            const selectedIdentityId = identitySelect.value;
            const content = adminReplyContent.value.trim();

            if (!selectedIdentityId) {
                 adminReplyStatus.textContent = '請選擇回覆身份！';
                 adminReplyStatus.style.color = 'orange';
                return;
            }
            if (!content) {
                 adminReplyStatus.textContent = '回覆內容不能為空！';
                 adminReplyStatus.style.color = 'orange';
                 return;
            }

            submitAdminReplyBtn.disabled = true;
            adminReplyStatus.textContent = '正在送出...';
            adminReplyStatus.style.color = 'blue';

            try {
                const response = await fetch('/api/admin/guestbook/replies', { // 注意 API 路徑
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message_id: currentMessageId,
                        content: content,
                        admin_identity_id: selectedIdentityId
                    }),
                });

                const responseData = await response.json();
                 if (!response.ok) {
                     throw new Error(responseData.error || `HTTP 錯誤 ${response.status}`);
                 }

                 adminReplyStatus.textContent = '管理員回覆成功！';
                 adminReplyStatus.style.color = 'green';
                 adminReplyForm.reset(); // 清空表單 (保留 select 選項)
                 identitySelect.value = ""; // 重設下拉選單

                 // 重新載入回覆列表以顯示新回覆
                 fetchAdminMessageDetail(currentMessageId); // 刷新整個詳情（包含回覆）

                 setTimeout(() => { adminReplyStatus.textContent = ''; }, 3000);

            } catch (error) {
                 console.error('管理員回覆失敗:', error);
                 adminReplyStatus.textContent = `回覆失敗：${error.message}`;
                 adminReplyStatus.style.color = 'red';
            } finally {
                 submitAdminReplyBtn.disabled = false;
            }
        });
    }

    // --- 【★ 重要 ★】添加全局函數以供管理列表頁的按鈕調用 ---
    // --- 這些函數需要存在於 admin-message-detail.js 中，因為它們操作的是這個頁面上的元素 ---

    // --- 函數：切換可見度 (全局暴露給 onclick) ---
     window.toggleVisibility = async (id, type, targetVisibility) => {
         const endpoint = type === 'message'
            ? `/api/admin/guestbook/messages/${id}/visibility`
            : `/api/admin/guestbook/replies/${id}/visibility`;

         const buttonSelector = type === 'message'
            ? `#admin-message-detail-main button[onclick*="toggleVisibility(${id},"]` // 主留言按鈕
            : `#reply-row-${id} button[onclick*="toggleVisibility(${id},"]`; // 回覆按鈕
         const button = document.querySelector(buttonSelector);
         if(button) button.disabled = true;

         try {
             const response = await fetch(endpoint, {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ is_visible: targetVisibility })
             });
             if (!response.ok) { /* ... 錯誤處理 ... */ throw new Error('操作失敗'); }
             // 成功後重新載入整個詳情頁數據
             fetchAdminMessageDetail(currentMessageId);
         } catch (error) {
             console.error(`切換 ${type} ${id} 可見度失敗:`, error);
             alert(`操作失敗：${error.message}`);
             if(button) button.disabled = false;
         }
     };

     // --- 函數：刪除項目 (全局暴露給 onclick) ---
      window.deleteItem = async (id, type) => {
        const itemTypeText = type === 'message' ? '留言' : '回覆';
        if (confirm(`確定要刪除這個 ${itemTypeText} (ID: ${id}) 嗎？\n(如果是留言，其下的所有回覆也會被刪除)`)) {
             const endpoint = type === 'message'
                ? `/api/admin/guestbook/messages/${id}`
                : `/api/admin/guestbook/replies/${id}`;

             const buttonSelector = type === 'message' ? null : `#reply-row-${id} button[onclick*="deleteItem(${id},"]`; // 主留言刪除後跳轉，不禁用按鈕
             const button = buttonSelector ? document.querySelector(buttonSelector) : null;
             if(button) button.disabled = true;

            try {
                const response = await fetch(endpoint, { method: 'DELETE' });
                 if (!response.ok && response.status !== 204) { /* ... 錯誤處理 ... */ throw new Error('刪除失敗'); }

                 if (type === 'message') {
                     alert('主留言已刪除，將返回列表頁。');
                     window.location.href = '/guestbook-admin.html'; // 刪除主留言後返回列表
                 } else {
                     // 刪除回覆成功，刷新詳情頁
                     fetchAdminMessageDetail(currentMessageId);
                 }
            } catch (error) {
                 console.error(`刪除 ${type} ${id} 失敗:`, error);
                 alert(`刪除失敗：${error.message}`);
                 if(button) button.disabled = false;
            }
        }
     };

    // --- 輔助函數：HTML 特殊字符轉義 ---
     function escapeHtml(unsafe) { /* ... 同 guestbook.js ... */ }


    // --- 頁面初始載入 ---
    currentMessageId = getMessageIdFromUrl();
    if (currentMessageId) {
        fetchAdminMessageDetail(currentMessageId);
        fetchAndPopulateIdentities(); // 同時加載身份下拉選單
    } else {
        if (messageDetailContainer) messageDetailContainer.innerHTML = '<p style="color:red;">錯誤：找不到留言 ID。</p>';
    }
});