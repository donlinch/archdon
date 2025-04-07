// public/admin-message-detail.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
    const messageDetailContainer = document.getElementById('admin-message-detail-main');
    const replyListContainer = document.getElementById('admin-reply-list-container');
    const adminReplyForm = document.getElementById('admin-reply-form');
    const identitySelect = document.getElementById('admin-identity-select');
    const adminReplyContent = document.getElementById('admin-reply-content');
    const adminReplyStatus = document.getElementById('admin-reply-status');
    const submitAdminReplyBtn = document.getElementById('submit-admin-reply-btn');
    const messageIdDisplay = document.getElementById('message-id-display');
    const backToListLink = document.querySelector('a[href="/guestbook-admin.html"]'); // 返回列表連結
    const adminReplyEmojiTrigger = document.getElementById('admin-reply-emoji-trigger');
    const adminReplyFormLabel = document.querySelector('#admin-reply-form label[for="admin-reply-content"]');
    const cancelAdminReplyTargetBtn = document.getElementById('cancel-admin-reply-target-btn');

    
    // --- 狀態變數 ---
    let currentMessageId = null;
    let isReplyingCooldown = false; // 管理員回覆冷卻
    let currentAdminParentReplyId = null; // 記錄管理員回覆的目標 ID


    // --- 函數：從 URL 獲取 message ID ---
    function getMessageIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }



 // --- 函數：更新回覆表單提示 ---
 function updateAdminReplyFormLabel() {
    if (!adminReplyFormLabel) return;
    if (currentAdminParentReplyId) {
        // 嘗試從 DOM 獲取樓層號
        const targetReplyDiv = document.querySelector(`.reply-item[data-reply-id="${currentAdminParentReplyId}"]`);
        const floor = targetReplyDiv ? targetReplyDiv.dataset.floor : `ID ${currentAdminParentReplyId}`;
        adminReplyFormLabel.innerHTML = `回覆 <span style="font-weight:bold; color:#007bff;">${floor}</span> 的內容 (必填):`;
        if (cancelAdminReplyTargetBtn) cancelAdminReplyTargetBtn.style.display = 'inline-block';
    } else {
        adminReplyFormLabel.textContent = '回覆內容 (必填):'; // 恢復預設
        if (cancelAdminReplyTargetBtn) cancelAdminReplyTargetBtn.style.display = 'none';
    }
}


// --- 事件監聽：點擊「回覆此樓層」按鈕 (使用事件委派) ---
if (replyListContainer) {
    replyListContainer.addEventListener('click', (event) => {
        const target = event.target;
        if (target.matches('.admin-reply-action-btn')) {
            currentAdminParentReplyId = target.dataset.targetId;
            console.log("Admin replying to reply ID:", currentAdminParentReplyId);
            updateAdminReplyFormLabel();
            // 將頁面滾動到回覆表單
            adminReplyForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
            adminReplyContent.focus(); // 聚焦輸入框
        }
    });
}

// --- 事件監聽：點擊「取消指定回覆」按鈕 ---
if (cancelAdminReplyTargetBtn) {
    cancelAdminReplyTargetBtn.addEventListener('click', () => {
        currentAdminParentReplyId = null;
        updateAdminReplyFormLabel();
    });
}



    // --- 函數：獲取並顯示留言詳情和所有回覆 ---
    async function fetchAdminMessageDetail(messageId) {
        if (!messageId) {
            showError("錯誤：URL 中缺少留言 ID。");
            return;
        }
        if (!messageDetailContainer || !replyListContainer) {
             console.error("錯誤：找不到詳情或回覆列表容器。");
             showError("頁面結構錯誤，無法載入內容。");
             return;
        }

        messageDetailContainer.innerHTML = '<p>正在載入留言內容...</p>';
        replyListContainer.innerHTML = '<p>正在載入回覆...</p>';
        if (messageIdDisplay) messageIdDisplay.textContent = `(ID: ${messageId})`;

        try {
            // 【API 路徑】
            const response = await fetch(`/api/admin/guestbook/message/${messageId}`);
            if (!response.ok) {
                let errorMsg = `HTTP 錯誤 ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {}
                if (response.status === 401) throw new Error('您需要登入才能訪問此功能。');
                if (response.status === 404) throw new Error('找不到指定的留言 (ID: ' + messageId + ')。');
                throw new Error(`無法獲取留言詳情 (${errorMsg})`);
            }
            const data = await response.json();

            if (!data.message) {
                throw new Error('API 返回的資料結構不正確，缺少 message 物件。');
            }

            renderAdminMessageDetail(data.message);
            renderAdminReplyList(data.replies || []); // 確保即使 replies 不存在也是空陣列

        } catch (error) {
            console.error('獲取管理詳情失敗:', error);
            showError(`無法載入留言：${error.message}`);
            replyListContainer.innerHTML = ''; // 清空回覆區
            if (error.message.includes('登入')) {
               alert('請先登入管理後台！');
               // window.location.href = '/login.html';
            }
        }
    }

    // --- 函數：顯示錯誤訊息 ---
    function showError(message) {
        if (messageDetailContainer) {
            messageDetailContainer.innerHTML = `<p class="error">${message}</p>`;
        }
         if (replyListContainer) {
            replyListContainer.innerHTML = ''; // 清空可能的回覆載入提示
         }
    }


    // --- 函數：渲染主留言詳情 (管理視圖，使用 DOM 操作) ---
    function renderAdminMessageDetail(message) {
        if (!messageDetailContainer || !message) return;
        messageDetailContainer.innerHTML = ''; // 清空

        const authorP = createParagraphWithLabel('作者: ', message.author_name || '匿名');
        const createDate = new Date(message.created_at).toLocaleString('zh-TW');
        addTimestamp(authorP, `(發表於: ${createDate})`);

        const activityP = createParagraphWithLabel('最後活動: ', new Date(message.last_activity_at).toLocaleString('zh-TW'));

        const statusP = document.createElement('p');
        const statusStrong = document.createElement('strong'); statusStrong.textContent = '狀態: ';
        statusP.appendChild(statusStrong);
        const statusSpan = document.createElement('span');
        statusSpan.className = message.is_visible ? 'status-visible' : 'status-hidden';
        statusSpan.textContent = message.is_visible ? '顯示中' : '已隱藏';
        statusP.appendChild(statusSpan);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn btn-secondary btn-sm toggle-visibility-btn'; // 使用 class 方便事件委派
        toggleBtn.style.marginLeft = '10px';
        toggleBtn.textContent = message.is_visible ? '設為隱藏' : '設為顯示';
        toggleBtn.dataset.id = message.id;
        toggleBtn.dataset.type = 'message';
        toggleBtn.dataset.targetVisibility = !message.is_visible;
        statusP.appendChild(toggleBtn);

        const replyCountP = createParagraphWithLabel('回覆數: ', message.reply_count || 0);

        const hr = document.createElement('hr');

        const contentLabel = document.createElement('strong'); contentLabel.textContent = '內容:';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.style.backgroundColor = '#f8f9fa'; contentDiv.style.padding = '10px'; contentDiv.style.borderRadius = '4px'; contentDiv.style.marginTop = '5px';
        contentDiv.textContent = message.content || '';
        contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.style.wordWrap = 'break-word';

        // 將元素添加到容器
        [authorP, activityP, statusP, replyCountP, hr, contentLabel, contentDiv].forEach(el => messageDetailContainer.appendChild(el));
    }

    // --- 函數：渲染回覆列表 (管理視圖，使用 DOM 操作) ---
    function renderAdminReplyList(replies) {
        if (!replyListContainer) return;
        replyListContainer.innerHTML = ''; // 清空

        if (!replies || replies.length === 0) {
            const p = document.createElement('p'); p.textContent = '目前沒有回覆。';
            replyListContainer.appendChild(p);
            return;
        }

        replies.forEach(reply => {
            const replyDiv = document.createElement('div');
            replyDiv.className = reply.is_admin_reply ? 'reply-item admin-reply' : 'reply-item';
            replyDiv.id = `reply-row-${reply.id}`;
            if (!reply.is_visible) replyDiv.style.opacity = '0.6';

            const metaP = document.createElement('p'); metaP.style.marginBottom = '5px';

            const authorSpan = document.createElement('span'); authorSpan.className = 'author';
            authorSpan.textContent = reply.is_admin_reply ? `[${reply.admin_identity_name || '管理員'}]` : (reply.author_name || '匿名');

            const timestampSpan = document.createElement('span'); timestampSpan.className = 'timestamp';
            timestampSpan.textContent = ` (${new Date(reply.created_at).toLocaleString('zh-TW')})`;

            const statusSpanContainer = document.createElement('span'); statusSpanContainer.style.marginLeft = '10px';
            statusSpanContainer.innerHTML = `[狀態: <span class="${reply.is_visible ? 'status-visible' : 'status-hidden'}">${reply.is_visible ? '顯示中' : '已隱藏'}</span>]`;

            metaP.appendChild(authorSpan);
            metaP.appendChild(timestampSpan);
            metaP.appendChild(statusSpanContainer);

            const contentDiv = document.createElement('div'); contentDiv.className = 'reply-content'; contentDiv.style.marginBottom = '5px';
            contentDiv.textContent = reply.content || '';
            contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.style.wordWrap = 'break-word';

            const actionsDiv = document.createElement('div'); actionsDiv.className = 'reply-actions';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'btn btn-warning btn-sm toggle-visibility-btn';
            toggleBtn.textContent = reply.is_visible ? '隱藏' : '顯示';
            toggleBtn.dataset.id = reply.id;
            toggleBtn.dataset.type = 'reply';
            toggleBtn.dataset.targetVisibility = !reply.is_visible;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-sm delete-item-btn';
            deleteBtn.textContent = '刪除';
            deleteBtn.dataset.id = reply.id;
            deleteBtn.dataset.type = 'reply';
            deleteBtn.dataset.name = `回覆 #${reply.id}`; // 用於確認訊息



 // --- 【★ 新增 ★】回覆此樓層按鈕 ---
 const replyToBtn = document.createElement('button');
 replyToBtn.className = 'btn btn-secondary btn-sm admin-reply-action-btn'; // 新增 class
 replyToBtn.textContent = '回覆';
 replyToBtn.dataset.targetId = reply.id; // 儲存目標回覆 ID
 replyToBtn.dataset.targetFloor = replyDiv.dataset.floor || `ID ${reply.id}`; // 儲存樓層號或 ID

 // --- 按鈕添加到 actionsDiv ---
 actionsDiv.appendChild(toggleBtn);
 actionsDiv.appendChild(deleteBtn);
 actionsDiv.appendChild(replyToBtn); // 添加新按鈕



            actionsDiv.appendChild(toggleBtn);
            actionsDiv.appendChild(deleteBtn);

            replyDiv.appendChild(metaP);
            replyDiv.appendChild(contentDiv);
            replyDiv.appendChild(actionsDiv);

            replyListContainer.appendChild(replyDiv);

            const hr = document.createElement('hr'); hr.style.borderTop = '1px dashed #eee'; hr.style.margin = '10px 0';
            replyListContainer.appendChild(hr);
        });
    }

    // --- 函數：獲取並填充管理員身份下拉選單 ---
    async function fetchAndPopulateIdentities() {
        if (!identitySelect) return;
        identitySelect.disabled = true;
        identitySelect.innerHTML = '<option value="">載入中...</option>';
        try {
            const response = await fetch('/api/admin/identities'); //【API 路徑】
            if (!response.ok) throw new Error('無法獲取身份列表');
            const identities = await response.json();

            if (identities && identities.length > 0) {
                identitySelect.innerHTML = ''; // 清空 "載入中..."
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '-- 請選擇身份 --';
                identitySelect.appendChild(defaultOption);

                identities.forEach(identity => {
                    const option = document.createElement('option');
                    option.value = identity.id;
                    option.textContent = identity.name; // 使用 textContent
                    identitySelect.appendChild(option);
                });
                identitySelect.disabled = false;
            } else {
                identitySelect.innerHTML = '<option value="">沒有可用的身份</option>';
            }
        } catch (error) {
            console.error('獲取身份失敗:', error);
            identitySelect.innerHTML = '<option value="">獲取身份失敗</option>';
            if (adminReplyStatus) { adminReplyStatus.textContent = '錯誤：無法載入回覆身份。'; adminReplyStatus.style.color = 'red'; }
        }
    }



 // --- 【★ 新增 ★】初始化管理員回覆框的 Emoji Picker ---
 if (adminReplyEmojiTrigger && adminReplyContent && window.EmojiButton) {
    const adminPicker = new EmojiButton.EmojiButton({ position: 'top-start', autoHide: true });

    adminPicker.on('emoji', selection => {
        insertTextAtCursor(adminReplyContent, selection.emoji);
    });

    adminReplyEmojiTrigger.addEventListener('click', () => {
        adminPicker.togglePicker(adminReplyEmojiTrigger);
    });
} else {
    console.warn("未找到管理員回覆 Modal 的 Emoji 按鈕或輸入框，或 EmojiButton 庫未載入。");
}



    // --- 事件監聽：提交管理員回覆 ---
    if (adminReplyForm && submitAdminReplyBtn && adminReplyStatus && identitySelect) {
        adminReplyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentMessageId) return;
            if (isReplyingCooldown) { adminReplyStatus.textContent = '回覆過於頻繁...'; adminReplyStatus.style.color = 'orange'; return; }

            const selectedIdentityId = identitySelect.value;
            const content = adminReplyContent.value.trim();

            if (!selectedIdentityId) { adminReplyStatus.textContent = '請選擇回覆身份！'; adminReplyStatus.style.color = 'orange'; return; }
            if (!content) { adminReplyStatus.textContent = '回覆內容不能為空！'; adminReplyStatus.style.color = 'orange'; return; }

            submitAdminReplyBtn.disabled = true;
            adminReplyStatus.textContent = '正在送出...';
            adminReplyStatus.style.color = 'blue';
            isReplyingCooldown = true;

            try {
                const response = await fetch('/api/admin/guestbook/replies', { //【API 路徑】
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message_id: currentMessageId,
                        parent_reply_id: currentAdminParentReplyId, // 【★ 修改 ★】傳遞目標 ID
                        content: content,
                        admin_identity_id: selectedIdentityId
                    }),
                });
                const responseData = await response.json();
                if (!response.ok) throw new Error(responseData.error || `HTTP 錯誤 ${response.status}`);

                adminReplyStatus.textContent = '管理員回覆成功！';
                adminReplyStatus.style.color = 'green';
                adminReplyForm.reset();
                identitySelect.value = "";
                currentAdminParentReplyId = null; // 重置目標 ID
                updateAdminReplyFormLabel(); // 更新表單提示
                fetchAdminMessageDetail(currentMessageId); // 刷新

                setTimeout(() => { adminReplyStatus.textContent = ''; }, 3000);

            } catch (error) {
                 console.error('管理員回覆失敗:', error);
                 adminReplyStatus.textContent = `回覆失敗：${error.message}`;
                 adminReplyStatus.style.color = 'red';
            } finally {
                 submitAdminReplyBtn.disabled = false;
                 // 啟動冷卻計時器
                 setTimeout(() => { isReplyingCooldown = false; }, 15000);
            }
        });
    }

    // --- 【★ 新增 ★】事件委派：處理主留言和回覆列表中的按鈕點擊 ---
    document.body.addEventListener('click', async (event) => {
        const target = event.target;

        // --- 處理顯隱按鈕 ---
        if (target.matches('.toggle-visibility-btn')) {
            const id = target.dataset.id;
            const type = target.dataset.type;
            const targetVisibility = target.dataset.targetVisibility === 'true'; // 字串轉 boolean
            const endpoint = type === 'message'
               ? `/api/admin/guestbook/messages/${id}/visibility`
               : `/api/admin/guestbook/replies/${id}/visibility`;

            target.disabled = true; // 禁用當前按鈕

            try {
                const response = await fetch(endpoint, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_visible: targetVisibility })
                });
                if (!response.ok) { let errorMsg = `HTTP ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {} throw new Error(errorMsg); }
                // 成功後重新載入整個詳情頁數據
                fetchAdminMessageDetail(currentMessageId);
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

                target.disabled = true;

                try {
                    const response = await fetch(endpoint, { method: 'DELETE' });
                     if (!response.ok && response.status !== 204) { let errorMsg = `HTTP ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {} throw new Error(errorMsg); }

                     if (type === 'message') {
                         alert('主留言已刪除，將返回列表頁。');
                         if (backToListLink) backToListLink.click(); // 模擬點擊返回
                         else window.location.href = '/guestbook-admin.html';
                     } else {
                         // 刪除回覆成功，刷新詳情頁
                         fetchAdminMessageDetail(currentMessageId);
                     }
                } catch (error) {
                     console.error(`刪除 ${type} ${id} 失敗:`, error);
                     alert(`刪除失敗：${error.message}`);
                     target.disabled = false;
                }
            }
        }
    });


    // --- 移除全局函數 ---
    // window.toggleVisibility = ...
    // window.deleteItem = ...

    // --- 輔助函數：創建帶標籤的段落 ---
    function createParagraphWithLabel(label, textContent) {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = label;
        p.appendChild(strong);
        p.appendChild(document.createTextNode(textContent || '')); // 確保 textContent 不為 null/undefined
        return p;
    }
    // --- 輔助函數：添加時間戳 Span ---
    function addTimestamp(parentElement, textContent) {
        const span = document.createElement('span');
        span.className = 'timestamp';
        span.textContent = textContent || '';
        parentElement.appendChild(document.createTextNode(' '));
        parentElement.appendChild(span);
    }



 // --- 【★ 新增 ★】輔助函數：在光標處插入文本 ---
 function insertTextAtCursor(textarea, text) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    // 插入文本並更新 value
    textarea.value = value.substring(0, start) + text + value.substring(end);
    // 將光標移動到插入文本之後
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus(); // 重新聚焦到輸入框
}




    // --- 頁面初始載入 ---
    currentMessageId = getMessageIdFromUrl();
    if (currentMessageId) {
        fetchAdminMessageDetail(currentMessageId);
        fetchAndPopulateIdentities(); // 同時加載身份下拉選單
        updateAdminReplyFormLabel(); // 初始化回覆表單提示
    } else {
        showError("錯誤：URL 中缺少有效的留言 ID。");
    }
});