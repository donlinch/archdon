// public/message-detail.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
    const messageContainer = document.getElementById('message-detail-main');
    const replyListContainer = document.getElementById('reply-list-container');
    const replyForm = document.getElementById('reply-form');
    const replyStatus = document.getElementById('reply-status');
    const submitReplyBtn = document.getElementById('submit-reply-btn');
    const replyFormParentIdInput = document.getElementById('reply-parent-id'); // 可選
    const replyFormContent = document.getElementById('reply-content');
    const replyFormAuthor = document.getElementById('reply-author-name');
    const replyFormLabel = document.querySelector('#reply-form label[for="reply-content"]');

    // --- 狀態變數 ---
    let currentMessageId = null;
    let isReplyingCooldown = false;
    let currentParentReplyId = null; // 記錄當前回覆的目標

    // --- 函數：從 URL 獲取 message ID ---
    function getMessageIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    // --- 函數：獲取並顯示留言詳情和回覆 ---
    async function fetchMessageDetail(messageId) {
        if (!messageContainer || !replyListContainer) { console.error("錯誤：找不到詳情或回覆列表容器。"); return; }
        messageContainer.innerHTML = '<p>正在載入留言內容...</p>';
        replyListContainer.innerHTML = '<p>正在載入回覆...</p>';

        // 發送 view 請求 (fire and forget)
        fetch(`/api/guestbook/message/${messageId}/view`, { method: 'POST' })
            .catch(err => console.warn('記錄瀏覽數時網路錯誤:', err));

        try {
            const response = await fetch(`/api/guestbook/message/${messageId}`);
            if (!response.ok) {
                if (response.status === 404) throw new Error('找不到指定的留言。');
                let errorMsg = `HTTP 錯誤 ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {}
                throw new Error(`無法獲取留言詳情 (${errorMsg})`);
            }
            const data = await response.json();
            if (!data || !data.message) throw new Error('從 API 獲取的資料格式不正確。');

            renderMessageDetail(data.message);
            renderNestedReplyList(data.replies || []); // 調用嵌套渲染函數

        } catch (error) {
            console.error('獲取詳情失敗:', error);
            messageContainer.innerHTML = `<p style="color: red;">無法載入留言：${error.message}</p>`;
            replyListContainer.innerHTML = '';
        }
    }

    // --- 函數：渲染主留言詳情 (包含 Like 按鈕) ---
    function renderMessageDetail(message) {
        if (!messageContainer || !message) return;
        messageContainer.innerHTML = ''; // 清空

        const authorSpan = document.createElement('span'); authorSpan.className = 'author'; authorSpan.textContent = message.author_name || '匿名';
        const timestampSpan = document.createElement('span'); timestampSpan.className = 'timestamp'; const createDate = new Date(message.created_at).toLocaleString('zh-TW'); timestampSpan.textContent = ` (${createDate})`;
        const hr = document.createElement('hr');
        const contentDiv = document.createElement('div'); contentDiv.className = 'message-content'; contentDiv.textContent = message.content || ''; contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.style.wordWrap = 'break-word';
        const metaP = document.createElement('p'); metaP.style.fontSize = '0.9em'; metaP.style.color = '#777'; metaP.style.marginTop = '15px';
        metaP.appendChild(document.createTextNode(`回覆: ${message.reply_count || 0} | 瀏覽: ${message.view_count || 0} | `));
        const likeButton = document.createElement('button'); likeButton.className = 'like-btn message-like-btn'; likeButton.dataset.id = message.id; likeButton.innerHTML = '❤️';
        const likeCountSpan = document.createElement('span'); likeCountSpan.id = `message-like-count-${message.id}`; likeCountSpan.textContent = ` ${message.like_count || 0}`; likeCountSpan.style.marginLeft = '5px';
        metaP.appendChild(likeButton); metaP.appendChild(likeCountSpan);

        messageContainer.appendChild(authorSpan); messageContainer.appendChild(timestampSpan); messageContainer.appendChild(hr); messageContainer.appendChild(contentDiv); messageContainer.appendChild(metaP);
    }

    // --- 【★ 渲染嵌套回覆列表 ★】 ---
    function renderNestedReplyList(replies) {
        if (!replyListContainer) return;
        replyListContainer.innerHTML = ''; // 清空

        if (!replies || replies.length === 0) {
            const p = document.createElement('p'); p.textContent = '目前沒有回覆。';
            replyListContainer.appendChild(p);
            return;
        }

        const repliesByParentId = new Map();
        replies.forEach(reply => {
            const parentId = reply.parent_reply_id === null ? 'root' : reply.parent_reply_id;
            if (!repliesByParentId.has(parentId)) repliesByParentId.set(parentId, []);
            repliesByParentId.get(parentId).push(reply);
        });

        const floorMap = new Map();
        const rootReplies = repliesByParentId.get('root') || [];
        rootReplies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // 確保第一層按時間排序
        rootReplies.forEach((reply, index) => {
            floorMap.set(reply.id, `B${index + 1}`);
        });

        function renderRepliesRecursive(parentId, level = 0) {
            const children = repliesByParentId.get(parentId === 'root' ? 'root' : parentId) || [];
             children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // 確保嵌套層也按時間排序
            if (children.length === 0 && level === 0 && parentId === 'root') return; // 如果根節點就沒回覆，這裡不需要返回(上面已處理)
            if (children.length === 0) return; // 遞迴終止條件

            children.forEach((reply) => {
                let floorNumber = '';
                if (level === 0) {
                    floorNumber = floorMap.get(reply.id);
                } else {
                    const parentFloor = floorMap.get(parentId);
                    if (parentFloor) {
                        const siblings = repliesByParentId.get(parentId) || [];
                        const replyIndex = siblings.findIndex(r => r.id === reply.id);
                        floorNumber = `${parentFloor}-${replyIndex + 1}`;
                        floorMap.set(reply.id, floorNumber);
                    } else { floorNumber = '?'; }
                }

                const replyDiv = document.createElement('div');
                replyDiv.className = reply.is_admin_reply ? 'reply-item admin-reply' : 'reply-item';
                if (level > 0) { replyDiv.classList.add('nested'); replyDiv.style.marginLeft = `${level * 25}px`; } // 增加縮排
                replyDiv.dataset.replyId = reply.id;
                replyDiv.dataset.floor = floorNumber;

                const metaP = document.createElement('p'); metaP.style.marginBottom = '5px';
                const floorSpan = document.createElement('span'); floorSpan.className = 'reply-floor'; floorSpan.textContent = floorNumber;
                const authorSpan = document.createElement('span'); authorSpan.className = 'author'; authorSpan.textContent = reply.is_admin_reply ? `[${reply.admin_identity_name || '管理員'}]` : (reply.author_name || '匿名');
                const timestampSpan = document.createElement('span'); timestampSpan.className = 'timestamp'; timestampSpan.textContent = ` (${new Date(reply.created_at).toLocaleString('zh-TW')})`;
                metaP.appendChild(floorSpan); metaP.appendChild(authorSpan); metaP.appendChild(timestampSpan);

                const contentDiv = document.createElement('div'); contentDiv.className = 'reply-content'; contentDiv.textContent = reply.content || ''; contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.style.wordWrap = 'break-word'; contentDiv.style.marginBottom = '5px';

                const actionsDiv = document.createElement('div'); actionsDiv.className = 'reply-item-actions';
                const replyButton = document.createElement('button'); replyButton.className = 'btn btn-link btn-sm reply-action-btn'; replyButton.textContent = '回覆'; replyButton.dataset.targetId = reply.id; replyButton.dataset.targetFloor = floorNumber;
                const quoteButton = document.createElement('button'); quoteButton.className = 'btn btn-link btn-sm quote-action-btn'; quoteButton.textContent = '引用'; quoteButton.dataset.targetId = reply.id; quoteButton.dataset.targetFloor = floorNumber; quoteButton.dataset.targetContent = reply.content || ''; quoteButton.style.marginLeft = '10px';
                const likeContainer = document.createElement('span'); likeContainer.style.marginLeft = '10px';
                const likeButton = document.createElement('button'); likeButton.className = 'like-btn reply-like-btn'; likeButton.dataset.id = reply.id; likeButton.innerHTML = '❤️';
                const likeCountSpan = document.createElement('span'); likeCountSpan.id = `reply-like-count-${reply.id}`; likeCountSpan.textContent = ` ${reply.like_count || 0}`; likeCountSpan.style.fontSize = '0.9em'; likeCountSpan.style.color = '#555'; likeCountSpan.style.marginLeft='3px';
                likeContainer.appendChild(likeButton); likeContainer.appendChild(likeCountSpan);
                actionsDiv.appendChild(replyButton); actionsDiv.appendChild(quoteButton); actionsDiv.appendChild(likeContainer);

                replyDiv.appendChild(metaP);
                replyDiv.appendChild(contentDiv);
                replyDiv.appendChild(actionsDiv);

                replyListContainer.appendChild(replyDiv);
                const hr = document.createElement('hr'); hr.style.borderTop = '1px dashed #eee'; hr.style.margin = '10px 0';
                replyListContainer.appendChild(hr);

                renderRepliesRecursive(reply.id, level + 1); // 遞迴
            });
        }
        renderRepliesRecursive('root', 0); // 開始渲染
    }


    // --- 事件監聽：提交回覆 (加入 parent_reply_id) ---
    if (replyForm && submitReplyBtn && replyStatus) {
        replyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentMessageId) { replyStatus.textContent = '錯誤：找不到留言 ID。'; replyStatus.style.color = 'red'; return; }
            if (isReplyingCooldown) { replyStatus.textContent = '回覆過於頻繁...'; replyStatus.style.color = 'orange'; return; }

            submitReplyBtn.disabled = true; replyStatus.textContent = '正在送出...'; replyStatus.style.color = 'blue'; isReplyingCooldown = true;

            const formData = new FormData(replyForm);
            const authorName = formData.get('reply_author_name')?.trim() || '匿名';
            const content = formData.get('reply_content')?.trim();
            const parentId = currentParentReplyId; // 使用全局變數記錄的目標 ID

            if (!content) {
                replyStatus.textContent = '錯誤：回覆內容不能為空！'; replyStatus.style.color = 'red'; submitReplyBtn.disabled = false; isReplyingCooldown = false; return;
            }

            try {
                const response = await fetch('/api/guestbook/replies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message_id: currentMessageId,
                        parent_reply_id: parentId, // 【★ 發送 parentId ★】
                        author_name: authorName,
                        content: content
                    }),
                });
                 if (!response.ok) { const errorData = await response.json().catch(() => ({ error: `HTTP 錯誤 ${response.status}` })); throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`); }

                 replyStatus.textContent = '回覆成功！'; replyStatus.style.color = 'green';
                 replyForm.reset(); // 清空表單
                 currentParentReplyId = null; // 重置回覆目標
                 if (replyFormLabel) replyFormLabel.textContent = '回覆內容 (必填):'; // 恢復 Label

                 fetchMessageDetail(currentMessageId); // 刷新

                 submitReplyBtn.textContent = '請稍候 (15s)';
                 setTimeout(() => { isReplyingCooldown = false; submitReplyBtn.disabled = false; submitReplyBtn.textContent = '送出回覆'; replyStatus.textContent = ''; }, 15000);

            } catch (error) {
                 console.error('回覆失敗:', error); replyStatus.textContent = `回覆失敗：${error.message}`; replyStatus.style.color = 'red'; submitReplyBtn.disabled = false; submitReplyBtn.textContent = '送出回覆'; isReplyingCooldown = false;
            }
        });
    }

    // --- 事件委派：處理按讚按鈕點擊 ---
    document.body.addEventListener('click', async (event) => {
        const target = event.target;
        let id = null; let apiUrl = null; let countSpanSelector = null;

        if (target.matches('.message-like-btn')) {
            id = target.dataset.id; apiUrl = `/api/guestbook/message/${id}/like`; countSpanSelector = `#message-like-count-${id}`;
        } else if (target.matches('.reply-like-btn')) {
            id = target.dataset.id; apiUrl = `/api/guestbook/replies/${id}/like`; countSpanSelector = `#reply-like-count-${id}`;
        }

        if (apiUrl && id && countSpanSelector) {
            target.disabled = true; target.style.opacity = '0.5';
            try {
                const response = await fetch(apiUrl, { method: 'POST' });
                if (!response.ok) { const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` })); throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`); }
                const data = await response.json();
                const countSpan = document.querySelector(countSpanSelector);
                if (countSpan) countSpan.textContent = ` ${data.like_count}`;
                setTimeout(() => { target.disabled = false; target.style.opacity = '1'; }, 1000);
            } catch (error) { console.error('按讚失敗:', error); alert(`按讚失敗：${error.message}`); target.disabled = false; target.style.opacity = '1'; }
        }
    });

    // --- 事件委派：處理回覆列表中的 "回覆" 和 "引用" 按鈕點擊 ---
    if (replyListContainer) {
        replyListContainer.addEventListener('click', (event) => {
            const target = event.target;
            let targetId = null;
            let targetFloor = null;
            let isQuote = false;

            if (target.matches('.reply-action-btn')) {
                targetId = target.dataset.targetId;
                targetFloor = target.dataset.targetFloor;
            } else if (target.matches('.quote-action-btn')) {
                targetId = target.dataset.targetId;
                targetFloor = target.dataset.targetFloor;
                isQuote = true;
            }

            if (targetId && targetFloor) {
                currentParentReplyId = targetId; // 記錄父 ID

                let prefix = `回覆 ${targetFloor}：\n`;
                if (isQuote) {
                    const targetContent = target.dataset.targetContent || '';
                    const quoteSnippet = targetContent.substring(0, 30) + (targetContent.length > 30 ? '...' : '');
                    prefix = `引用 ${targetFloor}：\n> ${quoteSnippet.replace(/\n/g, '\n> ')}\n---\n`;
                }

                if (replyFormLabel) replyFormLabel.textContent = isQuote ? `引用 ${targetFloor} 並回覆:` : `回覆 ${targetFloor} 的內容:`;
                if (replyFormContent) {
                    replyFormContent.value = prefix;
                    replyFormContent.focus();
                    replyFormContent.setSelectionRange(replyFormContent.value.length, replyFormContent.value.length);
                }
                replyForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
     }

    // --- 頁面初始載入 ---
    currentMessageId = getMessageIdFromUrl();
    if (currentMessageId) {
        fetchMessageDetail(currentMessageId);
    } else {
        if (messageContainer) messageContainer.innerHTML = '<p style="color:red;">錯誤：URL 中缺少有效的留言 ID。</p>';
        if (replyListContainer) replyListContainer.innerHTML = '';
    }
});