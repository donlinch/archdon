// public/message-detail.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
    const messageContainer = document.getElementById('message-detail-main'); // 主留言容器 ID
    const replyListContainer = document.getElementById('reply-list-container'); // 回覆列表容器 ID
    const replyForm = document.getElementById('reply-form'); // 回覆表單 ID
    const replyStatus = document.getElementById('reply-status'); // 回覆狀態訊息元素 ID
    const submitReplyBtn = document.getElementById('submit-reply-btn'); // 回覆提交按鈕 ID

    const replyFormParentIdInput = document.getElementById('reply-parent-id'); // 【★ 新增 ★】假設 HTML 中有隱藏欄位存 parentId
    const replyFormContent = document.getElementById('reply-content'); // 獲取回覆內容輸入框
    const replyFormAuthor = document.getElementById('reply-author-name'); // 獲取回覆者名稱輸入框
    const replyFormLabel = document.querySelector('#reply-form label[for="reply-content"]'); // 獲取回覆內容的 label




    // --- 狀態變數 ---
    let currentMessageId = null;
    let isReplyingCooldown = false;
    let currentParentReplyId = null; // 【★ 新增 ★】記錄當前回覆的目標


    // --- 函數：從 URL 獲取 message ID ---
    function getMessageIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    // --- 函數：獲取並顯示留言詳情和回覆 ---
    async function fetchMessageDetail(messageId) {
        if (!messageContainer || !replyListContainer) {
            console.error("錯誤：找不到詳情或回覆列表容器。");
            return;
        }
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
            renderReplyList(data.replies || []); // 確保是陣列

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

         const authorSpan = document.createElement('span');
         authorSpan.className = 'author';
         authorSpan.textContent = message.author_name || '匿名';

         const timestampSpan = document.createElement('span');
         timestampSpan.className = 'timestamp';
         const createDate = new Date(message.created_at).toLocaleString('zh-TW');
         timestampSpan.textContent = ` (${createDate})`;

         const hr = document.createElement('hr');

         const contentDiv = document.createElement('div');
         contentDiv.className = 'message-content';
         contentDiv.textContent = message.content || '';
         contentDiv.style.whiteSpace = 'pre-wrap';
         contentDiv.style.wordWrap = 'break-word';

         const metaP = document.createElement('p');
         metaP.style.fontSize = '0.9em'; metaP.style.color = '#777'; metaP.style.marginTop = '15px';
         metaP.appendChild(document.createTextNode(`回覆: ${message.reply_count || 0} | 瀏覽: ${message.view_count || 0} | `));

         // 添加 Like 按鈕和計數
         const likeButton = document.createElement('button');
         likeButton.className = 'like-btn message-like-btn';
         likeButton.dataset.id = message.id;
         likeButton.innerHTML = '❤️';

         const likeCountSpan = document.createElement('span');
         likeCountSpan.id = `message-like-count-${message.id}`;
         likeCountSpan.textContent = ` ${message.like_count || 0}`;
         likeCountSpan.style.marginLeft = '5px';

         metaP.appendChild(likeButton);
         metaP.appendChild(likeCountSpan);

         // 按順序添加到容器
         messageContainer.appendChild(authorSpan);
         messageContainer.appendChild(timestampSpan);
         messageContainer.appendChild(hr);
         messageContainer.appendChild(contentDiv);
         messageContainer.appendChild(metaP);
    }



    // --- 【★ 新增/重構 ★】渲染嵌套回覆列表 ---
    function renderNestedReplyList(replies) {
        if (!replyListContainer) return;
        replyListContainer.innerHTML = ''; // 清空

        if (!replies || replies.length === 0) {
            const p = document.createElement('p'); p.textContent = '目前沒有回覆。';
            replyListContainer.appendChild(p);
            return;
        }

        // 1. 將扁平列表轉換為按 parent_id 分組的 Map
        const repliesByParentId = new Map();
        replies.forEach(reply => {
            const parentId = reply.parent_reply_id === null ? 'root' : reply.parent_reply_id;
            if (!repliesByParentId.has(parentId)) {
                repliesByParentId.set(parentId, []);
            }
            repliesByParentId.get(parentId).push(reply);
        });

        // 2. 計算第一層樓層編號 (B1, B2...)
        const rootReplies = repliesByParentId.get('root') || [];
        const floorMap = new Map(); // 存儲 reply.id -> 'Bx-y'
        rootReplies.forEach((reply, index) => {
            floorMap.set(reply.id, `B${index + 1}`);
        });

        // 3. 定義遞迴渲染函數
        function renderRepliesRecursive(parentId, level = 0) {
            const children = repliesByParentId.get(parentId === 'root' ? 'root' : parentId) || [];
            if (children.length === 0) return;

            children.forEach((reply, index) => {
                let floorNumber = '';
                if (level === 0) { // 第一層
                    floorNumber = floorMap.get(reply.id); // 應該已經計算好
                } else { // 嵌套層
                    const parentFloor = floorMap.get(parentId);
                    if (parentFloor) {
                        // 計算 Bx-y 中的 y
                        const siblings = repliesByParentId.get(parentId) || [];
                        const replyIndex = siblings.findIndex(r => r.id === reply.id);
                        floorNumber = `${parentFloor}-${replyIndex + 1}`;
                        floorMap.set(reply.id, floorNumber); // 存儲計算好的嵌套樓層
                    } else {
                        floorNumber = '?'; // 預防父樓層未找到
                    }
                }

                const replyDiv = document.createElement('div');
                replyDiv.className = reply.is_admin_reply ? 'reply-item admin-reply' : 'reply-item';
                if (level > 0) {
                    replyDiv.classList.add('nested');
                    replyDiv.style.marginLeft = `${level * 20}px`; // 簡單縮排
                }
                replyDiv.dataset.replyId = reply.id;
                replyDiv.dataset.floor = floorNumber; // 存儲樓層

                // --- 創建回覆內容元素 (與之前類似，但加入樓層和回覆按鈕) ---
                const metaP = document.createElement('p'); metaP.style.marginBottom = '5px';
                const floorSpan = document.createElement('span'); floorSpan.className = 'reply-floor'; floorSpan.textContent = floorNumber; floorSpan.style.fontWeight = 'bold'; floorSpan.style.marginRight = '8px';
                const authorSpan = document.createElement('span'); authorSpan.className = 'author'; authorSpan.textContent = reply.is_admin_reply ? `[${reply.admin_identity_name || '管理員'}]` : (reply.author_name || '匿名');
                const timestampSpan = document.createElement('span'); timestampSpan.className = 'timestamp'; timestampSpan.textContent = ` (${new Date(reply.created_at).toLocaleString('zh-TW')})`;
                metaP.appendChild(floorSpan); metaP.appendChild(authorSpan); metaP.appendChild(timestampSpan);

                const contentDiv = document.createElement('div'); contentDiv.className = 'reply-content'; contentDiv.textContent = reply.content || ''; contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.style.wordWrap = 'break-word'; contentDiv.style.marginBottom = '5px';

                const actionsDiv = document.createElement('div'); actionsDiv.className = 'reply-item-actions';
                const replyButton = document.createElement('button'); replyButton.className = 'btn btn-link btn-sm reply-action-btn'; replyButton.textContent = '回覆'; replyButton.dataset.targetId = reply.id; replyButton.dataset.targetFloor = floorNumber;
                const likeContainer = document.createElement('span'); likeContainer.style.marginLeft = '10px';
                const likeButton = document.createElement('button'); likeButton.className = 'like-btn reply-like-btn'; likeButton.dataset.id = reply.id; likeButton.innerHTML = '❤️';
                const likeCountSpan = document.createElement('span'); likeCountSpan.id = `reply-like-count-${reply.id}`; likeCountSpan.textContent = ` ${reply.like_count || 0}`; likeCountSpan.style.fontSize = '0.9em'; likeCountSpan.style.color = '#555'; likeCountSpan.style.marginLeft='3px';
                likeContainer.appendChild(likeButton); likeContainer.appendChild(likeCountSpan);
                actionsDiv.appendChild(replyButton); actionsDiv.appendChild(likeContainer);

                replyDiv.appendChild(metaP);
                replyDiv.appendChild(contentDiv);
                replyDiv.appendChild(actionsDiv);

                replyListContainer.appendChild(replyDiv);
                const hr = document.createElement('hr'); hr.style.borderTop = '1px dashed #eee'; hr.style.margin = '10px 0';
                replyListContainer.appendChild(hr);

                // 遞迴渲染子回覆
                renderRepliesRecursive(reply.id, level + 1);
            });
        }

        // 4. 開始從根節點 ('root') 渲染
        renderRepliesRecursive('root', 0);
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
            isReplyingCooldown = true; // 開始冷卻

            const formData = new FormData(replyForm);
            const authorName = formData.get('reply_author_name')?.trim() || '匿名';
            const content = formData.get('reply_content')?.trim();

            if (!content) {
                // 【★ 實際的錯誤處理程式碼 ★】
                replyStatus.textContent = '錯誤：回覆內容不能為空！'; // 在狀態區顯示錯誤訊息
                replyStatus.style.color = 'red'; // 將訊息設為紅色
                submitReplyBtn.disabled = false; // 恢復提交按鈕的可用狀態
                isReplyingCooldown = false; // 如果因為錯誤而中斷，解除冷卻狀態
                return; // 終止函數執行，不再繼續發送 API 請求
            }

            
            try {
                const response = await fetch('/api/guestbook/replies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message_id: currentMessageId,
                        parent_reply_id: null, // 保持簡單，直接回覆主留言
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
                 replyForm.reset();

                 // 重新載入詳情以顯示新回覆
                 fetchMessageDetail(currentMessageId);

                 // 啟動冷卻計時器
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
                 isReplyingCooldown = false; // 出錯也要解除冷卻
            }
        });
    }

    // --- 事件委派：處理按讚按鈕點擊 ---
    document.body.addEventListener('click', async (event) => {
        const target = event.target;
        let id = null;
        let apiUrl = null;
        let countSpanSelector = null; // 改用選擇器

        if (target.matches('.message-like-btn')) {
            id = target.dataset.id;
            apiUrl = `/api/guestbook/message/${id}/like`;
            countSpanSelector = `#message-like-count-${id}`; // 使用 ID 選擇器
        } else if (target.matches('.reply-like-btn')) {
            id = target.dataset.id;
            apiUrl = `/api/guestbook/replies/${id}/like`;
            countSpanSelector = `#reply-like-count-${id}`; // 使用 ID 選擇器
        }

        if (apiUrl && id && countSpanSelector) {
            target.disabled = true;
            target.style.opacity = '0.5';

            try {
                const response = await fetch(apiUrl, { method: 'POST' });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                    throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`);
                }
                const data = await response.json();

                // 更新對應的讚數顯示
                const countSpan = document.querySelector(countSpanSelector);
                if (countSpan) {
                    countSpan.textContent = ` ${data.like_count}`;
                }
                 // 成功後可以永久禁用或短暫禁用
                 // 這裡選擇短暫禁用
                 setTimeout(() => {
                     target.disabled = false;
                     target.style.opacity = '1';
                 }, 1000); // 1秒後恢復

            } catch (error) {
                console.error('按讚失敗:', error);
                alert(`按讚失敗：${error.message}`);
                target.disabled = false;
                target.style.opacity = '1';
            }
        }
    });


// --- 【★ 新增 ★】事件委派：處理回覆列表中的 "回覆" 按鈕點擊 ---
if (replyListContainer) {
    replyListContainer.addEventListener('click', (event) => {
        if (event.target.matches('.reply-action-btn')) {
            const targetId = event.target.dataset.targetId;
            const targetFloor = event.target.dataset.targetFloor;

            currentParentReplyId = targetId; // 記錄要回覆的 ID

            // 更新回覆框標籤並預填內容
            if (replyFormLabel) {
                 replyFormLabel.textContent = `回覆 ${targetFloor} 的內容:`;
            }
            if (replyFormContent) {
                 replyFormContent.value = `回覆 ${targetFloor}：\n`; // 預填引用和換行
                 replyFormContent.focus(); // 將焦點移到輸入框
                 // 將光標移到末尾 (可選)
                 replyFormContent.setSelectionRange(replyFormContent.value.length, replyFormContent.value.length);
            }
             // 滾動到回覆框
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

    // --- 移除 escapeHtml 函數 ---
});