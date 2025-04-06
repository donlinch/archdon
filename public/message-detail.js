// public/message-detail.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
    const messageContainer = document.getElementById('message-detail-main'); // 主留言容器 ID
    const replyListContainer = document.getElementById('reply-list-container'); // 回覆列表容器 ID
    const replyForm = document.getElementById('reply-form'); // 回覆表單 ID
    const replyStatus = document.getElementById('reply-status'); // 回覆狀態訊息元素 ID
    const submitReplyBtn = document.getElementById('submit-reply-btn'); // 回覆提交按鈕 ID

    // --- 狀態變數 ---
    let currentMessageId = null;
    let isReplyingCooldown = false;

    // --- 函數：從 URL 獲取 message ID ---
    function getMessageIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    // --- 函數：獲取並顯示留言詳情和回覆 ---
    async function fetchMessageDetail(messageId) {
        if (!messageContainer || !replyListContainer) {
            console.error("錯誤：找不到詳情或回覆列表容器。");
            return; // 確保元素存在
        }
        messageContainer.innerHTML = '<p>正在載入留言內容...</p>';
        replyListContainer.innerHTML = '<p>正在載入回覆...</p>'; // 初始顯示載入中

        // 【★ 新增 ★】先發送 view 請求 (fire and forget)
        // 這個請求會在後台增加瀏覽數，我們不需要等待它完成
        fetch(`/api/guestbook/message/${messageId}/view`, { method: 'POST' })
            .then(response => {
                if (!response.ok && response.status !== 204) { // 204 No Content 也算成功
                    console.warn(`記錄瀏覽數可能失敗 (HTTP ${response.status})`);
                }
            })
            .catch(err => console.warn('記錄瀏覽數時網路錯誤:', err));

        // 繼續獲取詳情數據
        try {
            const response = await fetch(`/api/guestbook/message/${messageId}`); // 【API 路徑】
            if (!response.ok) {
                 if (response.status === 404) throw new Error('找不到指定的留言。');
                 let errorMsg = `HTTP 錯誤 ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {}
                 if (response.status === 401) throw new Error('您需要登入才能訪問此功能。'); // 雖然公開頁面通常不用
                throw new Error(`無法獲取留言詳情 (${errorMsg})`);
            }
            const data = await response.json();

            if (!data || !data.message) { // 確保 API 回應結構正確
                throw new Error('從 API 獲取的資料格式不正確。');
            }

            renderMessageDetail(data.message);
            renderReplyList(data.replies || []); // 確保 replies 是陣列

        } catch (error) {
            console.error('獲取詳情失敗:', error);
            messageContainer.innerHTML = `<p style="color: red;">無法載入留言：${error.message}</p>`;
            replyListContainer.innerHTML = ''; // 清空回覆區錯誤提示
        }
    }

    // --- 函數：渲染主留言詳情 (使用 DOM 操作) ---
    function renderMessageDetail(message) {
         if (!messageContainer || !message) return;
         messageContainer.innerHTML = ''; // 清空載入提示

         const authorSpan = document.createElement('span');
         authorSpan.className = 'author';
         authorSpan.textContent = message.author_name || '匿名'; // 使用 textContent

         const timestampSpan = document.createElement('span');
         timestampSpan.className = 'timestamp';
         const createDate = new Date(message.created_at).toLocaleString('zh-TW');
         timestampSpan.textContent = ` (${createDate})`;

         const hr = document.createElement('hr');

         const contentDiv = document.createElement('div');
         contentDiv.className = 'message-content';
         // 【關鍵】使用 textContent，並依賴 CSS 處理換行
         contentDiv.textContent = message.content || '';
         contentDiv.style.whiteSpace = 'pre-wrap'; // 確保換行生效
         contentDiv.style.wordWrap = 'break-word';

         // 【★ 新增瀏覽數和回覆數顯示 ★】
         const metaP = document.createElement('p');
         metaP.style.fontSize = '0.9em';
         metaP.style.color = '#777';
         metaP.style.marginTop = '15px'; // 與內容間隔
         metaP.textContent = `回覆: ${message.reply_count || 0} | 瀏覽: ${message.view_count || 0}`;


         // 按順序添加到容器
         messageContainer.appendChild(authorSpan);
         messageContainer.appendChild(timestampSpan);
         messageContainer.appendChild(hr);
         messageContainer.appendChild(contentDiv);
         messageContainer.appendChild(metaP); // 添加計數顯示
    }

    // --- 函數：渲染回覆列表 (使用 DOM 操作) ---
    function renderReplyList(replies) {
        if (!replyListContainer) return;
        replyListContainer.innerHTML = ''; // 清空載入提示或舊列表

        if (!replies || replies.length === 0) {
            const p = document.createElement('p');
            p.textContent = '目前沒有回覆。';
            replyListContainer.appendChild(p);
            return;
        }

        replies.forEach(reply => {
            const replyDiv = document.createElement('div');
            replyDiv.className = reply.is_admin_reply ? 'reply-item admin-reply' : 'reply-item';
            replyDiv.dataset.replyId = reply.id; // data-* 屬性

            const metaP = document.createElement('p');
            metaP.style.marginBottom = '5px';

            const authorSpan = document.createElement('span');
            authorSpan.className = 'author';
            const authorDisplay = reply.is_admin_reply
                ? `[${reply.admin_identity_name || '管理員'}]`
                : (reply.author_name || '匿名');
            authorSpan.textContent = authorDisplay; // 使用 textContent

            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'timestamp';
            timestampSpan.textContent = ` (${new Date(reply.created_at).toLocaleString('zh-TW')})`;

            metaP.appendChild(authorSpan);
            metaP.appendChild(timestampSpan);

            const contentDiv = document.createElement('div');
            contentDiv.className = 'reply-content';
            contentDiv.textContent = reply.content || ''; // 使用 textContent
            contentDiv.style.whiteSpace = 'pre-wrap'; // 確保換行
            contentDiv.style.wordWrap = 'break-word';

            replyDiv.appendChild(metaP);
            replyDiv.appendChild(contentDiv);

            // 【★ 按讚功能預留位置，目前不創建按鈕 ★】
            // const likeContainer = document.createElement('div');
            // likeContainer.className = 'like-section';
            // const likeBtn = document.createElement('button'); ...
            // const likeCountSpan = document.createElement('span'); ...
            // replyDiv.appendChild(likeContainer);

            replyListContainer.appendChild(replyDiv);

            const hr = document.createElement('hr');
             hr.style.borderTop = '1px dashed #eee';
             hr.style.margin = '10px 0';
            replyListContainer.appendChild(hr);
        });
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
            // 確保 input name 匹配
            const authorName = formData.get('reply_author_name')?.trim() || '匿名';
            const content = formData.get('reply_content')?.trim();

            if (!content) {
                replyStatus.textContent = '錯誤：回覆內容不能為空！';
                replyStatus.style.color = 'red';
                submitReplyBtn.disabled = false;
                return;
            }

            try {
                const response = await fetch('/api/guestbook/replies', { // 【API 路徑】
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message_id: currentMessageId,
                        parent_reply_id: null, // 【★ 暫不處理嵌套，直接回覆主留言 ★】
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

                 // 【★ 關鍵 ★】重新載入整個留言詳情以顯示新回覆
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

    // --- 移除 escapeHtml 函數 ---

    // --- 頁面初始載入 ---
    currentMessageId = getMessageIdFromUrl();
    if (currentMessageId) {
        fetchMessageDetail(currentMessageId);
    } else {
        if (messageContainer) messageContainer.innerHTML = '<p style="color:red;">錯誤：URL 中缺少有效的留言 ID。</p>';
         if (replyListContainer) replyListContainer.innerHTML = ''; // 清空回覆區
    }
});