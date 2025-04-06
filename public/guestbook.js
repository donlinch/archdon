// public/guestbook.js

document.addEventListener('DOMContentLoaded', () => {
    const guestbookList = document.getElementById('guestbook-list');
    const paginationControls = document.getElementById('pagination-controls');
    const newMessageForm = document.getElementById('new-message-form');
    const authorNameInput = document.getElementById('author-name');
    const messageContentInput = document.getElementById('message-content');
    const mainEmojiTrigger = document.getElementById('main-emoji-trigger');
    const formStatus = newMessageForm.querySelector('.form-status');

    let currentPage = 1;
    const limit = 10; // 每頁顯示多少則主留言 (應與後端預設或期望值一致)

    // --- Emoji Picker 初始化 ---
    const mainPicker = new EmojiButton.EmojiButton({
        position: 'bottom-start', // 彈出位置
        theme: 'auto' // 跟隨系統亮暗模式
    });

    // 當選擇了 Emoji
    mainPicker.on('emoji', selection => {
        insertTextAtCursor(messageContentInput, selection.emoji);
    });

    // 為主留言框的觸發按鈕添加事件
    if (mainEmojiTrigger) {
        mainEmojiTrigger.addEventListener('click', () => mainPicker.togglePicker(mainEmojiTrigger));
    }

    // --- 輔助函數：在光標處插入文本 ---
    function insertTextAtCursor(textarea, text) {
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        textarea.value = value.substring(0, start) + text + value.substring(end);
        // 更新光標位置
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus(); // 重新聚焦
    }

    // --- 輔助函數：格式化時間 ---
    function formatTimestamp(isoString) {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            // 根據需要調整顯示格式
            return date.toLocaleString('zh-TW', {
                year: 'numeric', month: 'numeric', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            });
        } catch (e) {
            console.error("Error formatting timestamp:", e);
            return isoString; // 出錯時返回原始字串
        }
    }

    // --- 核心函數：獲取並渲染留言板資料 ---
    async function fetchAndRenderGuestbook(page = 1) {
        if (!guestbookList || !paginationControls) {
            console.error("Guestbook list or pagination controls element not found.");
            return;
        }
        guestbookList.innerHTML = '<p class="loading-message">正在載入留言...</p>';
        paginationControls.innerHTML = ''; // 清空分頁

        try {
            const response = await fetch(`/api/guestbook?page=${page}&limit=${limit}`);
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            }
            const data = await response.json();

            currentPage = data.currentPage;
            guestbookList.innerHTML = ''; // 清空載入訊息

            if (!data.messages || data.messages.length === 0) {
                guestbookList.innerHTML = '<p>目前沒有留言。</p>';
            } else {
                data.messages.forEach(message => {
                    guestbookList.appendChild(createMessageElement(message, data.replies[message.id] || []));
                });
            }

            renderPagination(data.totalPages, data.currentPage);

        } catch (error) {
            console.error("獲取留言失敗:", error);
            guestbookList.innerHTML = `<p class="error-message">無法載入留言，請稍後再試。</p>`;
        }
    }

    // --- 函數：創建單個主留言的 HTML 元素 (包含其回覆) ---
    function createMessageElement(message, replies) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-item';
        messageDiv.dataset.messageId = message.id; // 儲存 ID

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="author-name">${escapeHtml(message.author_name)}</span>
                <span class="timestamp">${formatTimestamp(message.created_at)}</span>
            </div>
            <div class="message-content">${escapeHtml(message.content)}</div>
            <div class="message-actions">
                <button class="reply-button" data-target-type="message" data-target-id="${message.id}">回覆</button>
                <button class="like-button" data-target-type="message" data-target-id="${message.id}" title="喜歡這則留言">
                    ❤️ <span class="count">${message.like_count || 0}</span>
                </button>
            </div>
            <div class="replies-container"></div>
            <div class="reply-form-container" style="display: none;"></div> <!-- 簡易回覆框的容器 -->
        `;

        // 遞迴渲染回覆
        const repliesContainer = messageDiv.querySelector('.replies-container');
        const repliesMap = buildReplyTree(replies); // 將扁平的回覆列表構建成樹狀結構
        renderReplies(repliesContainer, repliesMap, null); // 從根節點開始渲染

        return messageDiv;
    }

    // --- 函數：創建單個回覆的 HTML 元素 (遞迴用) ---
    function createReplyElement(reply, repliesMap) {
        const replyDiv = document.createElement('div');
        replyDiv.className = `reply-item ${reply.is_admin_reply ? 'admin-reply' : 'user-reply'}`; // 根據是否管理員套用 class
        replyDiv.dataset.replyId = reply.id; // 儲存 ID

        // 決定顯示的作者名稱
        const authorDisplayName = reply.is_admin_reply
            ? `[${escapeHtml(reply.admin_identity_name || '管理員')}]` // 管理員顯示身份名稱
            : escapeHtml(reply.author_name); // 訪客顯示訪客名稱

        replyDiv.innerHTML = `
            <div class="reply-header">
                <span class="author-name">${authorDisplayName}</span>
                <span class="timestamp">${formatTimestamp(reply.created_at)}</span>
            </div>
            <div class="reply-content">${escapeHtml(reply.content)}</div>
            <div class="reply-actions">
                <button class="reply-button" data-target-type="reply" data-target-id="${reply.id}" data-message-id="${reply.message_id}">回覆</button>
                <button class="like-button" data-target-type="reply" data-target-id="${reply.id}" title="喜歡這則回覆">
                    👍 <span class="count">${reply.like_count || 0}</span>
                </button>
            </div>
            <div class="replies-container"></div> <!-- 下一層回覆的容器 -->
             <div class="reply-form-container" style="display: none;"></div> <!-- 簡易回覆框的容器 -->
        `;

        // 遞迴渲染該回覆的子回覆
        const repliesContainer = replyDiv.querySelector('.replies-container');
        renderReplies(repliesContainer, repliesMap, reply.id); // 渲染下一層

        return replyDiv;
    }

    // --- 輔助函數：將扁平的回覆列表構建成以 parent_reply_id 為 key 的樹狀 Map ---
    function buildReplyTree(replies) {
        const repliesMap = {}; // { parentId: [reply1, reply2], ... }
        if (!replies) return repliesMap;

        replies.forEach(reply => {
            const parentId = reply.parent_reply_id || 'root'; // 沒有 parent 的回覆視為根回覆 (直接回覆主留言)
            if (!repliesMap[parentId]) {
                repliesMap[parentId] = [];
            }
            repliesMap[parentId].push(reply);
        });
        return repliesMap;
    }

    // --- 輔助函數：遞迴渲染回覆 ---
    function renderReplies(container, repliesMap, parentId) {
        const key = parentId === null ? 'root' : parentId; // 獲取當前層級的 key
        const children = repliesMap[key];

        if (children && children.length > 0) {
            children.forEach(reply => {
                const replyElement = createReplyElement(reply, repliesMap); // 創建回覆元素
                container.appendChild(replyElement); // 添加到父容器
                // 注意：下一層的遞迴調用已在 createReplyElement 內部完成
            });
        }
    }


    // --- 函數：渲染分頁控制 ---
    function renderPagination(totalPages, currentPage) {
        paginationControls.innerHTML = ''; // 清空舊的分頁

        if (totalPages <= 1) return; // 只有一頁或沒有內容時不顯示分頁

        // 上一頁按鈕
        const prevButton = document.createElement('button');
        prevButton.textContent = '<< 上一頁';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                fetchAndRenderGuestbook(currentPage - 1);
            }
        });
        paginationControls.appendChild(prevButton);

        // 頁碼按鈕 (可以根據需要優化，例如只顯示當前頁前後幾頁)
        // 簡單版本：顯示所有頁碼
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            if (i === currentPage) {
                pageButton.classList.add('current-page');
                pageButton.disabled = true; // 當前頁不可點
            } else {
                pageButton.addEventListener('click', () => fetchAndRenderGuestbook(i));
            }
            paginationControls.appendChild(pageButton);
        }

        // 下一頁按鈕
        const nextButton = document.createElement('button');
        nextButton.textContent = '下一頁 >>';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                fetchAndRenderGuestbook(currentPage + 1);
            }
        });
        paginationControls.appendChild(nextButton);
    }

    // --- 事件處理：提交新留言 ---
    if (newMessageForm) {
        newMessageForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // 阻止表單默認提交

            const authorName = authorNameInput.value.trim();
            const content = messageContentInput.value.trim();

            if (!authorName || !content) {
                formStatus.textContent = '名稱和內容不能為空！';
                formStatus.style.color = 'red';
                return;
            }
             formStatus.textContent = '正在送出...';
             formStatus.style.color = 'orange';


            try {
                const response = await fetch('/api/guestbook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ author_name: authorName, content: content })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP 錯誤！狀態: ${response.status}`);
                }

                // 成功後的操作
                formStatus.textContent = '留言成功！';
                formStatus.style.color = 'green';
                newMessageForm.reset(); // 清空表單
                // 可選：延遲一段時間後清空成功訊息
                setTimeout(() => { formStatus.textContent = ''; }, 3000);

                // 重新載入第一頁留言，以顯示最新留言
                fetchAndRenderGuestbook(1);

            } catch (error) {
                console.error("提交留言失敗:", error);
                formStatus.textContent = `提交失敗：${error.message}`;
                formStatus.style.color = 'red';
            }
        });
    }

    // --- 事件處理：點擊 "回覆" 或 "按讚" 按鈕 (使用事件委派) ---
    guestbookList.addEventListener('click', async (event) => {
        const target = event.target;

        // 處理點擊 "回覆" 按鈕
        if (target.classList.contains('reply-button')) {
            handleReplyButtonClick(target);
        }

        // 處理點擊 "按讚" 按鈕
        if (target.closest('.like-button')) { // 點擊到按鈕或內部的 span
             const likeButton = target.closest('.like-button');
             handleLikeButtonClick(likeButton);
        }
    });

    // --- 函數：處理點擊 "回覆" 按鈕 ---
    function handleReplyButtonClick(button) {
        const targetType = button.dataset.targetType; // 'message' or 'reply'
        const targetId = button.dataset.targetId;
        // 找到包含此按鈕的留言或回覆項目元素
        const parentItem = button.closest('.message-item, .reply-item');
        if (!parentItem) return;

        const replyFormContainer = parentItem.querySelector('.reply-form-container');
        if (!replyFormContainer) return;

        // 切換顯示簡易回覆框
        const isVisible = replyFormContainer.style.display === 'block';
        if (isVisible) {
            replyFormContainer.style.display = 'none';
            replyFormContainer.innerHTML = ''; // 清空內容
        } else {
            // 創建並顯示回覆框
            replyFormContainer.innerHTML = createReplyFormHtml(targetType, targetId, parentItem.dataset.messageId); // 傳遞 messageId 給 reply 類型的按鈕
            replyFormContainer.style.display = 'block';

            // 為新生成的回覆框內的 Emoji 按鈕初始化 Picker
            const emojiTrigger = replyFormContainer.querySelector('.reply-emoji-trigger');
            const replyInput = replyFormContainer.querySelector('.reply-content-input');
            if (emojiTrigger && replyInput) {
                const replyPicker = new EmojiButton.EmojiButton({ position: 'bottom-start' });
                replyPicker.on('emoji', selection => {
                    insertTextAtCursor(replyInput, selection.emoji);
                });
                emojiTrigger.addEventListener('click', () => replyPicker.togglePicker(emojiTrigger));
            }

             // 為新生成的回覆框內的表單添加提交事件
             const replyForm = replyFormContainer.querySelector('form');
             if (replyForm) {
                 replyForm.addEventListener('submit', handleReplyFormSubmit);
             }
        }
    }

    // --- 函數：創建簡易回覆框的 HTML ---
    function createReplyFormHtml(targetType, targetId, messageId) {
        // 如果是回覆 'reply'，需要知道它屬於哪個 'message'
        const msgId = targetType === 'message' ? targetId : messageId;
        // 如果是回覆 'reply'，則 parent_reply_id 就是 targetId
        const parentReplyId = targetType === 'reply' ? targetId : ''; // 如果是 message 則為空

        return `
            <form class="reply-form" data-message-id="${msgId}" data-parent-reply-id="${parentReplyId}">
                <label>您的名稱：</label>
                <input type="text" name="author_name" required maxlength="100">
                <label>回覆內容：</label>
                <textarea name="content" class="reply-content-input" required maxlength="2000"></textarea>
                <button type="button" class="emoji-trigger reply-emoji-trigger" title="選擇表情符號">😊</button>
                <div style="margin-top: 0.5em;">
                     <button type="submit">送出回覆</button>
                     <button type="button" class="cancel-reply-button">取消</button>
                </div>
                <p class="form-status" style="margin-top: 0.5em; color: green;"></p>
            </form>
        `;
    }

     // --- 事件處理：提交簡易回覆 --- (需要用事件委派，因為表單是動態生成的) ---
     guestbookList.addEventListener('submit', async function(event) {
         if (event.target.classList.contains('reply-form')) {
             event.preventDefault();
             handleReplyFormSubmit(event);
         }
     });

    // --- 事件處理：點擊取消回覆按鈕 --- (需要用事件委派) ---
    guestbookList.addEventListener('click', function(event) {
         if (event.target.classList.contains('cancel-reply-button')) {
             const formContainer = event.target.closest('.reply-form-container');
             if (formContainer) {
                 formContainer.style.display = 'none';
                 formContainer.innerHTML = '';
             }
         }
     });


    // --- 函數：處理簡易回覆表單的提交 ---
    async function handleReplyFormSubmit(event) {
        const form = event.target;
        const messageId = form.dataset.messageId;
        const parentReplyId = form.dataset.parentReplyId || null; // 獲取父回覆 ID，可能為空
        const authorName = form.querySelector('input[name="author_name"]').value.trim();
        const content = form.querySelector('textarea[name="content"]').value.trim();
        const statusP = form.querySelector('.form-status');

        if (!authorName || !content || !messageId) {
            statusP.textContent = '名稱、內容和目標留言 ID 不能为空！';
            statusP.style.color = 'red';
            return;
        }
        statusP.textContent = '正在送出...';
        statusP.style.color = 'orange';
        const submitButton = form.querySelector('button[type="submit"]');
        if(submitButton) submitButton.disabled = true; // 防止重複提交

        try {
            const response = await fetch('/api/guestbook/replies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message_id: messageId,
                    parent_reply_id: parentReplyId, // 傳遞 parent ID
                    author_name: authorName,
                    content: content
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP 錯誤！狀態: ${response.status}`);
            }

            // 成功後，重新載入當前頁面以顯示新回覆 (簡單方式)
            // 也可以只請求新回覆並動態插入，但較複雜
            statusP.textContent = '回覆成功！正在刷新...';
            statusP.style.color = 'green';
            setTimeout(() => {
                 fetchAndRenderGuestbook(currentPage); // 刷新當前頁
            }, 1500);


        } catch (error) {
            console.error("提交回覆失敗:", error);
            statusP.textContent = `提交失敗：${error.message}`;
            statusP.style.color = 'red';
             if(submitButton) submitButton.disabled = false; // 允許重試
        }
    }

    // --- 函數：處理點擊 "按讚" 按鈕 ---
    async function handleLikeButtonClick(button) {
        const targetType = button.dataset.targetType; // 'message' or 'reply'
        const targetId = button.dataset.targetId;

        if (!targetType || !targetId) return;

        const apiUrl = `/api/guestbook/${targetType}s/${targetId}/like`; // 組合 API URL
        button.disabled = true; // 暫時禁用按鈕防止連點

        try {
            const response = await fetch(apiUrl, { method: 'POST' });

            if (!response.ok) {
                const errorData = await response.json();
                // 如果是 403 (禁止按讚隱藏內容)，可以給用戶提示
                if(response.status === 403) {
                    console.warn(`無法按讚：${errorData.error || '目標可能已被隱藏'}`);
                     // alert('無法對已隱藏的內容按讚'); // 可選：給用戶提示
                } else {
                    throw new Error(errorData.error || `HTTP 錯誤！狀態: ${response.status}`);
                }
                 button.disabled = false; // 出錯時重新啟用按鈕
                 return; // 不更新計數
            }

            const result = await response.json();

            // 更新頁面上的計數
            const countSpan = button.querySelector('.count');
            if (countSpan) {
                countSpan.textContent = result.like_count;
            }
            // 成功按讚後可以保持禁用一小段時間或永久禁用 (取決於設計)
            // setTimeout(() => { button.disabled = false; }, 1000); // 1秒後重新啟用

        } catch (error) {
            console.error(`按讚 ${targetType} ${targetId} 失敗:`, error);
            button.disabled = false; // 出錯時確保按鈕可用
        }
    }

    // --- 輔助函數：簡單 HTML 轉義 ---
    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
 

    // --- 頁面初始載入 ---
    fetchAndRenderGuestbook(1); // 載入第一頁

}); // --- End of DOMContentLoaded ---