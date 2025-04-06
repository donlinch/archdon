// public/message-detail.js
document.addEventListener('DOMContentLoaded', () => {
    const messageContainer = document.getElementById('message-detail-main'); // 假設主留言容器 ID
    const replyListContainer = document.getElementById('reply-list-container'); // 假設回覆列表容器 ID
    const replyForm = document.getElementById('reply-form'); // 假設回覆表單 ID
    const replyStatus = document.getElementById('reply-status'); // 假設回覆狀態訊息元素 ID
    const submitReplyBtn = document.getElementById('submit-reply-btn'); // 假設回覆提交按鈕 ID

    let currentMessageId = null;
    let isReplyingCooldown = false;

    // --- 函數：從 URL 獲取 message ID ---
    function getMessageIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    // --- 函數：獲取並顯示留言詳情和回覆 ---
    async function fetchMessageDetail(messageId) {
        if (!messageContainer || !replyListContainer) return;
        messageContainer.innerHTML = '<p>載入中...</p>';
        replyListContainer.innerHTML = '';

        try {
            const response = await fetch(`/api/guestbook/message/${messageId}`);
            if (!response.ok) {
                 if (response.status === 404) throw new Error('找不到指定的留言。');
                throw new Error(`無法獲取留言詳情 (HTTP ${response.status})`);
            }
            const data = await response.json();

            renderMessageDetail(data.message);
            renderReplyList(data.replies);

        } catch (error) {
            console.error('獲取詳情失敗:', error);
            messageContainer.innerHTML = `<p style="color: red;">無法載入留言：${error.message}</p>`;
        }
    }

    // --- 函數：渲染主留言詳情 ---
    function renderMessageDetail(message) {
         if (!messageContainer || !message) return;
         const createDate = new Date(message.created_at).toLocaleString('zh-TW');
         // 處理換行：將 \n 替換為 <br>
         const formattedContent = escapeHtml(message.content || '').replace(/\n/g, '<br>');

         messageContainer.innerHTML = `
            <span class="author">${escapeHtml(message.author_name || '匿名')}</span>
            <span class="timestamp">(${createDate})</span>
            <hr>
            <div class="message-content">
                ${formattedContent}
            </div>
         `;
    }

    // --- 函數：渲染回覆列表 ---
    function renderReplyList(replies) {
        if (!replyListContainer) return;
        if (!replies || replies.length === 0) {
            replyListContainer.innerHTML = '<p>目前沒有回覆。</p>';
            return;
        }

        let html = '';
        replies.forEach(reply => {
            const replyDate = new Date(reply.created_at).toLocaleString('zh-TW');
            const authorDisplay = reply.is_admin_reply
                ? `[${escapeHtml(reply.admin_identity_name || '管理員')}]`
                : escapeHtml(reply.author_name || '匿名');
            const replyClass = reply.is_admin_reply ? 'reply-item admin-reply' : 'reply-item';
             // 處理換行
            const formattedContent = escapeHtml(reply.content || '').replace(/\n/g, '<br>');

            html += `
                <div class="${replyClass}" data-reply-id="${reply.id}">
                    <span class="author">${authorDisplay}</span>
                    <span class="timestamp">(${replyDate})</span>
                    <div class="reply-content">${formattedContent}</div>
                    <!-- 基本版不加回覆按鈕 -->
                </div>
            `;
        });
        replyListContainer.innerHTML = html;
    }

    // --- 事件監聽：提交回覆 ---
    if (replyForm && submitReplyBtn && replyStatus) {
        replyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!currentMessageId) {
                replyStatus.textContent = '錯誤：找不到留言 ID。';
                replyStatus.style.color = 'red';
                return;
            }
            if (isReplyingCooldown) {
                 replyStatus.textContent = '回覆過於頻繁，請稍候...';
                 replyStatus.style.color = 'orange';
                return;
            }

            submitReplyBtn.disabled = true;
            replyStatus.textContent = '正在送出...';
            replyStatus.style.color = 'blue';

            const formData = new FormData(replyForm);
            const authorName = formData.get('reply_author_name')?.trim() || '匿名'; // 注意 name 屬性
            const content = formData.get('reply_content')?.trim(); // 注意 name 屬性

            if (!content) {
                replyStatus.textContent = '錯誤：回覆內容不能為空！';
                replyStatus.style.color = 'red';
                submitReplyBtn.disabled = false;
                return;
            }

            try {
                const response = await fetch('/api/guestbook/replies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message_id: currentMessageId,
                        author_name: authorName,
                        content: content
                    }),
                });

                 if (!response.ok) {
                     const errorData = await response.json().catch(() => ({ error: `HTTP 錯誤 ${response.status}` }));
                    throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`);
                }

                 replyStatus.textContent = '回覆成功！';
                 replyStatus.style.color = 'green';
                 replyForm.reset(); // 清空表單

                 // 重新載入整個留言詳情以顯示新回覆
                 fetchMessageDetail(currentMessageId);

                 // 啟動冷卻
                 isReplyingCooldown = true;
                 submitReplyBtn.textContent = '請稍候 (15s)';
                 setTimeout(() => {
                     isReplyingCooldown = false;
                     submitReplyBtn.disabled = false;
                     submitReplyBtn.textContent = '送出回覆';
                     replyStatus.textContent = '';
                 }, 15000);

            } catch (error) {
                 console.error('回覆失敗:', error);
                 replyStatus.textContent = `回覆失敗：${error.message}`;
                 replyStatus.style.color = 'red';
                 submitReplyBtn.disabled = false;
                 submitReplyBtn.textContent = '送出回覆';
            }
        }); 
    }

    // --- 輔助函數：HTML 特殊字符轉義 ---
     function escapeHtml(unsafe) { /* ... 同 guestbook.js ... */
        if (!unsafe) return ''; return unsafe
        .replace(/&/g, "&")
            .replace(/</g, "<")
            .replace(/>/g, ">")
            .replace(/"/g, "&#34;")
            .replace(/'/g, "&#39;");


            replace(/"/g, "&#34;")
             .replace(/'/g, "&#39;");
     }


    // --- 頁面初始載入 ---
    currentMessageId = getMessageIdFromUrl();
    if (currentMessageId) {
        fetchMessageDetail(currentMessageId);
    } else {
        if (messageContainer) messageContainer.innerHTML = '<p style="color:red;">錯誤：找不到留言 ID。</p>';
    }
});