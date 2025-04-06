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
    let isReplyingCooldown = false; // 為管理員回覆也加上冷卻

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
            // 【注意】API 路徑是 /api/admin/...
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
        messageDetailContainer.innerHTML = ''; // 清空

        const authorP = document.createElement('p');
        const authorStrong = document.createElement('strong'); authorStrong.textContent = '作者: ';
        authorP.appendChild(authorStrong);
        authorP.appendChild(document.createTextNode(message.author_name || '匿名'));
        const createTimestampSpan = document.createElement('span'); createTimestampSpan.className = 'timestamp';
        createTimestampSpan.textContent = ` (發表於: ${new Date(message.created_at).toLocaleString('zh-TW')})`;
        authorP.appendChild(createTimestampSpan);

        const activityP = document.createElement('p');
        const activityStrong = document.createElement('strong'); activityStrong.textContent = '最後活動: ';
        activityP.appendChild(activityStrong);
        activityP.appendChild(document.createTextNode(new Date(message.last_activity_at).toLocaleString('zh-TW')));

        const statusP = document.createElement('p');
        const statusStrong = document.createElement('strong'); statusStrong.textContent = '狀態: ';
        statusP.appendChild(statusStrong);
        const statusSpan = document.createElement('span');
        statusSpan.className = message.is_visible ? 'status-visible' : 'status-hidden';
        statusSpan.textContent = message.is_visible ? '顯示中' : '已隱藏';
        statusP.appendChild(statusSpan);
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn btn-secondary btn-sm';
        toggleBtn.style.marginLeft = '10px';
        toggleBtn.textContent = message.is_visible ? '設為隱藏' : '設為顯示';
        toggleBtn.onclick = () => toggleVisibility(message.id, 'message', !message.is_visible); // 直接綁定事件
        statusP.appendChild(toggleBtn);

        const replyCountP = document.createElement('p');
        const replyCountStrong = document.createElement('strong'); replyCountStrong.textContent = '回覆數: ';
        replyCountP.appendChild(replyCountStrong);
        replyCountP.appendChild(document.createTextNode(message.reply_count || 0));

        const hr = document.createElement('hr');

        const contentLabel = document.createElement('strong'); contentLabel.textContent = '內容:';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.style.backgroundColor = '#f8f9fa';
        contentDiv.style.padding = '10px';
        contentDiv.style.borderRadius = '4px';
        contentDiv.style.marginTop = '5px';
        contentDiv.textContent = message.content || ''; // 使用 textContent
        contentDiv.style.whiteSpace = 'pre-wrap';
        contentDiv.style.wordWrap = 'break-word';

        messageDetailContainer.appendChild(authorP);
        messageDetailContainer.appendChild(activityP);
        messageDetailContainer.appendChild(statusP);
        messageDetailContainer.appendChild(replyCountP);
        messageDetailContainer.appendChild(hr);
        messageDetailContainer.appendChild(contentLabel);
        messageDetailContainer.appendChild(contentDiv);
    }

    // --- 函數：渲染回覆列表 (管理視圖) ---
    function renderAdminReplyList(replies) {
        if (!replyListContainer) return;
        replyListContainer.innerHTML = ''; // 清空

        if (!replies || replies.length === 0) {
            const p = document.createElement('p');
            p.textContent = '目前沒有回覆。';
            replyListContainer.appendChild(p);
            return;
        }

        replies.forEach(reply => {
            const replyDiv = document.createElement('div');
            replyDiv.className = reply.is_admin_reply ? 'reply-item admin-reply' : 'reply-item';
            replyDiv.id = `reply-row-${reply.id}`;
            if (!reply.is_visible) {
                replyDiv.style.opacity = '0.6';
            }

            const metaP = document.createElement('p');
            metaP.style.marginBottom = '5px';

            const authorSpan = document.createElement('span');
            authorSpan.className = 'author';
            const authorDisplay = reply.is_admin_reply
                ? `[${reply.admin_identity_name || '管理員'}]`
                : (reply.author_name || '匿名');
            authorSpan.textContent = authorDisplay;

            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'timestamp';
            timestampSpan.textContent = ` (${new Date(reply.created_at).toLocaleString('zh-TW')})`;

            const statusSpanContainer = document.createElement('span');
            statusSpanContainer.style.marginLeft = '10px';
            statusSpanContainer.innerHTML = `[狀態: <span class="${reply.is_visible ? 'status-visible' : 'status-hidden'}">${reply.is_visible ? '顯示中' : '已隱藏'}</span>]`;

            metaP.appendChild(authorSpan);
            metaP.appendChild(timestampSpan);
            metaP.appendChild(statusSpanContainer);

            const contentDiv = document.createElement('div');
            contentDiv.className = 'reply-content';
            contentDiv.style.marginBottom = '5px';
            contentDiv.textContent = reply.content || '';
            contentDiv.style.whiteSpace = 'pre-wrap';
            contentDiv.style.wordWrap = 'break-word';

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'reply-actions';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'btn btn-warning btn-sm';
            toggleBtn.textContent = reply.is_visible ? '隱藏' : '顯示';
            toggleBtn.onclick = () => toggleVisibility(reply.id, 'reply', !reply.is_visible);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-sm';
            deleteBtn.textContent = '刪除';
            deleteBtn.onclick = () => deleteItem(reply.id, 'reply');

            actionsDiv.appendChild(toggleBtn);
            actionsDiv.appendChild(deleteBtn);

            replyDiv.appendChild(metaP);
            replyDiv.appendChild(contentDiv);
            replyDiv.appendChild(actionsDiv);

            replyListContainer.appendChild(replyDiv);

            const hr = document.createElement('hr');
             hr.style.borderTop = '1px dashed #eee';
             hr.style.margin = '10px 0';
            replyListContainer.appendChild(hr);
        });
    }

    // --- 函數：獲取並填充管理員身份下拉選單 ---
    async function fetchAndPopulateIdentities() {
        if (!identitySelect) return;
        identitySelect.disabled = true;
        identitySelect.innerHTML = '<option value="">載入中...</option>';
        try {
            const response = await fetch('/api/admin/identities');
            if (!response.ok) throw new Error('無法獲取身份列表');
            const identities = await response.json();

            if (identities && identities.length > 0) {
                let optionsHtml = '<option value="">-- 請選擇身份 --</option>';
                identities.forEach(identity => {
                    // 使用 textContent 設置選項顯示文本
                    const option = document.createElement('option');
                    option.value = identity.id;
                    option.textContent = identity.name; // 直接用 textContent
                    optionsHtml += option.outerHTML; // 獲取帶屬性的 HTML
                });
                identitySelect.innerHTML = optionsHtml;
                identitySelect.disabled = false;
            } else {
                identitySelect.innerHTML = '<option value="">沒有可用的身份</option>';
            }
        } catch (error) {
            console.error('獲取身份失敗:', error);
            identitySelect.innerHTML = '<option value="">獲取身份失敗</option>';
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
            if (!currentMessageId) return;

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

            // 啟動冷卻
            isReplyingCooldown = true; // 假設有這個變數

            try {
                const response = await fetch('/api/admin/guestbook/replies', { // API 路徑正確
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
                 adminReplyForm.reset();
                 identitySelect.value = ""; // 重設下拉選單

                 // 重新載入回覆列表
                 fetchAdminMessageDetail(currentMessageId); // 刷新整個詳情

                 setTimeout(() => { adminReplyStatus.textContent = ''; }, 3000);

            } catch (error) {
                 console.error('管理員回覆失敗:', error);
                 adminReplyStatus.textContent = `回覆失敗：${error.message}`;
                 adminReplyStatus.style.color = 'red';
            } finally {
                 submitAdminReplyBtn.disabled = false;
                 isReplyingCooldown = false; // 假設冷卻結束或失敗
            }
        });
    }

    // --- 【★ 重要 ★】添加全局函數以供按鈕調用 ---
     window.toggleVisibility = async (id, type, targetVisibility) => {
         const endpoint = type === 'message'
            ? `/api/admin/guestbook/messages/${id}/visibility`
            : `/api/admin/guestbook/replies/${id}/visibility`;

        // 找到對應的按鈕並禁用 (需要確保按鈕有唯一的標識或 class)
         let button = null;
         if (type === 'message') {
             button = messageDetailContainer.querySelector(`button[onclick*="toggleVisibility(${id},"]`);
         } else {
             const row = document.getElementById(`reply-row-${id}`);
             if (row) button = row.querySelector(`button[onclick*="toggleVisibility(${id},"]`);
         }
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
             // 成功後重新載入整個詳情頁數據
             fetchAdminMessageDetail(currentMessageId);
         } catch (error) {
             console.error(`切換 ${type} ${id} 可見度失敗:`, error);
             alert(`操作失敗：${error.message}`);
             if(button) button.disabled = false; // 恢復按鈕
         }
     };

      window.deleteItem = async (id, type) => {
        const itemTypeText = type === 'message' ? '留言' : '回覆';
        if (confirm(`確定要刪除這個 ${itemTypeText} (ID: ${id}) 嗎？\n(如果是留言，其下的所有回覆也會被刪除)`)) {
             const endpoint = type === 'message'
                ? `/api/admin/guestbook/messages/${id}`
                : `/api/admin/guestbook/replies/${id}`;

            // 找到對應的按鈕並禁用
            let button = null;
            if (type !== 'message') {
                 const row = document.getElementById(`reply-row-${id}`);
                 if (row) button = row.querySelector(`button[onclick*="deleteItem(${id},"]`);
            }
             if(button) button.disabled = true;

            try {
                const response = await fetch(endpoint, { method: 'DELETE' });
                 if (!response.ok && response.status !== 204) {
                     let errorMsg = `HTTP ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {} throw new Error(errorMsg);
                 }

                 if (type === 'message') {
                     alert('主留言已刪除，將返回列表頁。');
                     window.location.href = '/guestbook-admin.html';
                 } else {
                     // 刪除回覆成功，刷新詳情頁
                     fetchAdminMessageDetail(currentMessageId);
                 }
            } catch (error) {
                 console.error(`刪除 ${type} ${id} 失敗:`, error);
                 alert(`刪除失敗：${error.message}`);
                 if(button) button.disabled = false; // 恢復按鈕
            }
        }
     };

    // --- 輔助函數：HTML 特殊字符轉義 (如果需要，但 .textContent 已處理大部分) ---
     function escapeHtml(unsafe) {
        // 保持之前的版本即可
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


    // --- 頁面初始載入 ---
    currentMessageId = getMessageIdFromUrl();
    if (currentMessageId) {
        fetchAdminMessageDetail(currentMessageId);
        fetchAndPopulateIdentities(); // 同時加載身份下拉選單
    } else {
        if (messageDetailContainer) messageDetailContainer.innerHTML = '<p style="color:red;">錯誤：找不到留言 ID。</p>';
    }
});