// public/guestbook.js
document.addEventListener('DOMContentLoaded', () => {
    console.log('Guestbook JS Loaded'); // 確認 JS 已載入

    // --- DOM 元素獲取 ---
    const guestbookList = document.getElementById('guestbook-list');
    const paginationControls = document.getElementById('pagination-controls');
    const sortLinks = document.querySelectorAll('.sort-link');
    const postModal = document.getElementById('post-modal');
    const postForm = document.getElementById('post-message-form');
    const postSubmitBtn = document.getElementById('post-submit-btn');
    const postStatusMsg = document.getElementById('post-status-msg');
    const detailModal = document.getElementById('detail-modal');
    const detailTitle = document.getElementById('detail-title');
    const detailAuthor = document.getElementById('detail-author');
    const detailTime = document.getElementById('detail-time');
    const detailViews = document.getElementById('detail-views');
    const detailContent = document.getElementById('detail-content');
    const repliesContainer = document.getElementById('replies-container');
    const replyForm = document.getElementById('reply-form');
    const replyMessageIdInput = document.getElementById('reply-message-id');
    const replyParentIdInput = document.getElementById('reply-parent-id');
    const replyTargetIndicator = document.getElementById('reply-target-indicator');
    const replySubmitBtn = document.getElementById('reply-submit-btn');
    const replyStatusMsg = document.getElementById('reply-status-msg');

    // --- 狀態變數 ---
    let currentPage = 1;
    let currentSort = 'latest'; // 預設排序
    let currentLimit = 10; // 每頁顯示數量 (可調整)
    let totalPages = 1;
    let currentDetailMessageId = null; // 用於記錄當前查看詳情的留言 ID
    let isPostingCooldown = false; // 發文冷卻狀態
    let isReplyingCooldown = false; // 回覆冷卻狀態
    const COOLDOWN_SECONDS = 15;

    // --- Helper 函數 ---


    async function fetchGuestbookList(page = 1, sort = 'latest') {
        try {
            const response = await fetch(`/api/guestbook?page=${page}&limit=10&sort=${sort}`);
            const data = await response.json();
            console.log('List data received:', data);
            // 渲染留言和分頁等...
        } catch (error) {
            console.error('無法載入留言列表：', error);
        }
    }
    







    /**
     * 格式化日期時間 (簡易版)
     * @param {string | Date} dateInput - 日期字串或 Date 物件
     * @returns {string} 格式化後的日期時間或相對時間
     */
    function formatDateTime(dateInput) {
        if (!dateInput) return '未知時間';
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) return '無效日期';

            const now = new Date();
            const diffSeconds = Math.round((now - date) / 1000);
            const diffMinutes = Math.round(diffSeconds / 60);
            const diffHours = Math.round(diffMinutes / 60);
            const diffDays = Math.round(diffHours / 24);

            if (diffSeconds < 60) return `${diffSeconds} 秒前`;
            if (diffMinutes < 60) return `${diffMinutes} 分鐘前`;
            if (diffHours < 24) return `${diffHours} 小時前`;
            if (diffDays < 7) return `${diffDays} 天前`;

            // 超過一週，顯示完整日期時間
            return date.toLocaleString('zh-TW', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false // 使用 24 小時制
            });
        } catch (e) {
            console.error("日期格式化錯誤:", e);
            return '日期錯誤';
        }
    }

    /**
     * 顯示狀態訊息
     * @param {HTMLElement} element - 要顯示訊息的元素
     * @param {string} message - 訊息內容
     * @param {boolean} isError - 是否為錯誤訊息
     */
    function showStatusMessage(element, message, isError = false) {
        if (!element) return;
        element.textContent = message;
        element.className = 'status-msg'; // Reset class
        if (isError) {
            element.classList.add('error-msg');
        } else {
             element.classList.add('success-msg'); // Assume success if not error
        }
         // 短暫顯示後消失 (可選)
         // setTimeout(() => { element.textContent = ''; element.className = 'status-msg'; }, 5000);
    }

    /**
     * 開始冷卻計時器
     * @param {'posting' | 'replying'} type - 冷卻類型
     * @param {HTMLButtonElement} button - 要禁用的按鈕
     */
    function startCooldown(type, button) {
        if (type === 'posting') {
            isPostingCooldown = true;
        } else if (type === 'replying') {
            isReplyingCooldown = true;
        }
        button.disabled = true;
        button.textContent = `請稍候 ${COOLDOWN_SECONDS} 秒`;
        let countdown = COOLDOWN_SECONDS;

        const intervalId = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                button.textContent = `請稍候 ${countdown} 秒`;
            } else {
                clearInterval(intervalId);
                if (type === 'posting') {
                    isPostingCooldown = false;
                    button.textContent = '送出留言'; // 恢復按鈕文字
                } else if (type === 'replying') {
                    isReplyingCooldown = false;
                     button.textContent = '送出回覆'; // 恢復按鈕文字
                }
                button.disabled = false;
            }
        }, 1000);
    }






    // --- API 請求函數 ---

    /**
     * 獲取留言列表資料
     * @param {number} page - 頁碼
     * @param {string} sort - 排序方式
     */
    async function fetchGuestbookList(page = 1, sort = 'latest') {
        console.log(`Fetching list: page=${page}, sort=${sort}`);
        if (!guestbookList) return;
        guestbookList.innerHTML = '<p style="text-align:center; color:#888;">正在載入留言...</p>'; // 顯示載入中

        try {
            const response = await fetch(`/api/guestbook?page=${page}&limit=${currentLimit}&sort=${sort}`);
            if (!response.ok) {
                throw new Error(`無法獲取留言列表 (${response.status})`);
            }
            const data = await response.json();
            console.log('List data received:', data);

            currentPage = data.currentPage;
            totalPages = data.totalPages;
            currentSort = data.currentSort || sort; // 更新當前排序狀態

            renderGuestbookList(data.messages);
            renderPagination(data);
            updateSortLinkStates(); // 更新排序連結的 active 狀態

        } catch (error) {
            console.error('獲取留言列表失敗:', error);
            guestbookList.innerHTML = `<p style="text-align:center; color:red;">無法載入留言列表：${error.message}</p>`;
             paginationControls.innerHTML = ''; // 清空分頁
        }
    }

    /**
     * 獲取單一留言詳情
     * @param {number} messageId - 留言 ID
     */
     async function fetchMessageDetail(messageId) {
        console.log(`Fetching detail for message ID: ${messageId}`);
        currentDetailMessageId = messageId; // 記錄當前 ID
        replyMessageIdInput.value = messageId; // 設定回覆表單的 message ID
        replyParentIdInput.value = ''; // 清空父回覆 ID
        replyTargetIndicator.textContent = ''; // 清空回覆對象提示

        // 顯示 Loading 狀態 (可選)
        detailTitle.textContent = '載入中...';
        detailAuthor.textContent = '';
        detailTime.textContent = '';
        detailViews.textContent = '';
        detailContent.textContent = '';
        repliesContainer.innerHTML = '<p style="color:#888;">正在載入回覆...</p>';
        showModal('detail-modal'); // 先顯示 Modal 框架

        // 發送 view count 請求 (無需等待)
        fetch(`/api/guestbook/message/${messageId}/view`, { method: 'POST' })
            .catch(err => console.warn(`記錄瀏覽次數失敗 (ID: ${messageId}):`, err));

        try {
            const response = await fetch(`/api/guestbook/message/${messageId}`);
            if (!response.ok) {
                 if (response.status === 404) {
                     throw new Error('找不到該留言或已被移除。');
                 }
                throw new Error(`無法獲取留言詳情 (${response.status})`);
            }
            const data = await response.json();
            console.log('Detail data received:', data);

            renderMessageDetail(data.message);
            renderReplies(data.replies); // 調用渲染回覆的函數

        } catch (error) {
            console.error(`獲取留言 ${messageId} 詳情失敗:`, error);
            // 在 Modal 中顯示錯誤
            detailTitle.textContent = '錯誤';
             detailContent.innerHTML = `<p style="color:red;">無法載入留言詳情：${error.message}</p>`;
             repliesContainer.innerHTML = ''; // 清空回覆區
        }
    }


    // --- 渲染函數 ---

    /**
     * 渲染留言列表
     * @param {Array} messages - 留言物件陣列
     */
    function renderGuestbookList(messages) {
        if (!guestbookList) return;
        guestbookList.innerHTML = ''; // 清空舊列表

        if (!messages || messages.length === 0) {
            guestbookList.innerHTML = '<p style="text-align:center; color:#888;">目前沒有留言。</p>';
            return;
        }

        messages.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'message-item';
            item.innerHTML = `
                <div class="message-info">
                    <a href="#" class="message-title" data-id="${msg.id}">${msg.title || '(無標題)'}</a>
                    <span class="message-meta">
                        <span class="author">${msg.author_name || '匿名'}</span> -
                        <span class="time">${formatDateTime(msg.last_activity_at || msg.created_at)}</span>
                    </span>
                </div>
                <div class="message-stats">
                    <span title="回覆數">💬 ${msg.reply_count || 0}</span> |
                    <span title="瀏覽數">👁️ ${msg.view_count || 0}</span>
                </div>
            `;
            // 為標題添加點擊事件監聽器
            const titleLink = item.querySelector('.message-title');
            if (titleLink) {
                titleLink.addEventListener('click', (event) => {
                    event.preventDefault(); // 阻止 a 標籤的默認行為
                    const messageId = event.target.getAttribute('data-id');
                    if (messageId) {
                        fetchMessageDetail(parseInt(messageId));
                    }
                });
            }
            guestbookList.appendChild(item);
        });
    }

    /**
     * 渲染分頁控制項
     * @param {object} data - API 回傳的包含分頁資訊的物件
     */
    function renderPagination(data) {
        if (!paginationControls) return;
        paginationControls.innerHTML = ''; // 清空舊的分頁

        const { currentPage, totalPages } = data;

        if (totalPages <= 1) return; // 只有一頁或沒有內容時不顯示分頁

        // 上一頁按鈕
        const prevButton = document.createElement('button');
        prevButton.textContent = '<< 上一頁';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                fetchGuestbookList(currentPage - 1, currentSort);
            }
        });
        paginationControls.appendChild(prevButton);

        // 頁碼按鈕 (簡易版：只顯示當前頁和前後幾頁)
        // 更好的版本會顯示 ... 省略號
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
         // 如果結尾頁數不足，調整起始頁數（如果可以）
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        if (startPage > 1) {
             // 第一頁按鈕
             const firstButton = document.createElement('button');
             firstButton.textContent = '1';
             firstButton.addEventListener('click', () => fetchGuestbookList(1, currentSort));
             paginationControls.appendChild(firstButton);
             if (startPage > 2) {
                 const ellipsis = document.createElement('span');
                 ellipsis.textContent = '...';
                 paginationControls.appendChild(ellipsis);
             }
        }


        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            if (i === currentPage) {
                pageButton.classList.add('active');
                pageButton.disabled = true;
            } else {
                pageButton.addEventListener('click', () => fetchGuestbookList(i, currentSort));
            }
            paginationControls.appendChild(pageButton);
        }

         if (endPage < totalPages) {
             if (endPage < totalPages - 1) {
                 const ellipsis = document.createElement('span');
                 ellipsis.textContent = '...';
                 paginationControls.appendChild(ellipsis);
             }
             // 最後一頁按鈕
             const lastButton = document.createElement('button');
             lastButton.textContent = totalPages;
             lastButton.addEventListener('click', () => fetchGuestbookList(totalPages, currentSort));
             paginationControls.appendChild(lastButton);
         }

        // 下一頁按鈕
        const nextButton = document.createElement('button');
        nextButton.textContent = '下一頁 >>';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                fetchGuestbookList(currentPage + 1, currentSort);
            }
        });
        paginationControls.appendChild(nextButton);
    }

    /**
     * 渲染單一留言詳情的主體部分
     * @param {object} message - 主留言物件
     */
    function renderMessageDetail(message) {
        detailTitle.textContent = message.title || '(無標題)';
        detailAuthor.textContent = `作者：${message.author_name || '匿名'}`;
        detailTime.textContent = `發表於：${formatDateTime(message.created_at)}`;
        detailViews.textContent = `👁️ ${message.view_count || 0} 次瀏覽`;
        detailContent.textContent = message.content || ''; // 使用 textContent 避免 XSS，並依賴 CSS white-space: pre-wrap;
    }

    /**
     * 渲染回覆列表 (包含巢狀結構和樓層)
     * @param {Array} replies - 從 API 獲取的回覆陣列
     */
    function renderReplies(replies) {
        if (!repliesContainer) return;
        repliesContainer.innerHTML = ''; // 清空

        if (!replies || replies.length === 0) {
            repliesContainer.innerHTML = '<p style="color:#888;">目前沒有回覆。</p>';
            return;
        }

        // 1. 將回覆按 parent_reply_id 分組
        const repliesByParent = {}; // { parentId: [reply1, reply2] }
        replies.forEach(reply => {
            const parentId = reply.parent_reply_id || 'root'; // 'root' 代表直接回覆主留言
            if (!repliesByParent[parentId]) {
                repliesByParent[parentId] = [];
            }
            repliesByParent[parentId].push(reply);
        });

        // 2. 遞迴函數來渲染回覆和其子回覆
        function buildReplyHtml(parentId, level, floorPrefix) {
            const children = repliesByParent[parentId] || [];
            if (children.length === 0) return ''; // 沒有子回覆，返回空字串

            let html = '';
            children.forEach((reply, index) => {
                // 計算樓層編號
                const currentFloor = floorPrefix ? `${floorPrefix}-${index + 1}` : `B${index + 1}`;
                const isAdmin = reply.is_admin_reply;
                const authorDisplay = isAdmin ? `[${reply.admin_identity_name || '管理員'}]` : (reply.author_name || '匿名');

                html += `
                    <div class="reply-item ${level > 0 ? 'nested' : ''} ${isAdmin ? 'admin-reply' : ''}" data-reply-id="${reply.id}" data-floor="${currentFloor}">
                        <div class="reply-header">
                            <span class="reply-floor">${currentFloor}</span>
                            <span class="reply-author">${authorDisplay}</span>
                            <span class="reply-timestamp">(${formatDateTime(reply.created_at)})</span>
                        </div>
                        <div class="reply-content">${reply.content || ''}</div>
                        <div class="reply-actions">
                            <button class="reply-trigger-btn" data-target-id="${reply.id}" data-target-floor="${currentFloor}">回覆</button>
                        </div>
                    </div>
                `;
                // 遞迴渲染子回覆
                html += buildReplyHtml(reply.id, level + 1, currentFloor);
            });
            return html;
        }

        // 3. 開始渲染 (從 'root' 開始)
        repliesContainer.innerHTML = buildReplyHtml('root', 0, '');

        // 4. 為新渲染的回覆按鈕添加事件監聽器
        addReplyButtonListeners();
    }

     /** 為回覆按鈕添加事件監聽器 */
    function addReplyButtonListeners() {
        const replyTriggerBtns = repliesContainer.querySelectorAll('.reply-trigger-btn');
        replyTriggerBtns.forEach(btn => {
            btn.addEventListener('click', (event) => {
                const targetId = event.target.getAttribute('data-target-id');
                const targetFloor = event.target.getAttribute('data-target-floor');

                replyParentIdInput.value = targetId; // 設定要回覆的目標 ID
                replyTargetIndicator.textContent = `回覆 ${targetFloor}：`;
                replyForm.querySelector('#reply-content').focus(); // 將焦點移至輸入框
            });
        });
    }

    /** 更新排序連結的 active 狀態 */
    function updateSortLinkStates() {
        sortLinks.forEach(link => {
            if (link.getAttribute('data-sort') === currentSort) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }


    // --- 事件監聽器 ---

    // 排序連結點擊
    sortLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            const newSort = event.target.getAttribute('data-sort');
            if (newSort && newSort !== currentSort) {
                fetchGuestbookList(1, newSort); // 從第一頁開始載入新排序
            }
        });
    });

    // 提交新留言表單
    if (postForm) {
        postForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // 阻止表單默認提交
            if (isPostingCooldown) {
                 showStatusMessage(postStatusMsg, `操作太頻繁，請稍候再試。`, true);
                return;
            }

            const author = document.getElementById('post-author-name').value;
            const title = document.getElementById('post-title').value.trim();
            const content = document.getElementById('post-content').value.trim();

            if (!title || !content) {
                showStatusMessage(postStatusMsg, '標題和內容為必填項。', true);
                return;
            }
             if (title.length > 255) {
                 showStatusMessage(postStatusMsg, '標題過長 (最多 255 字元)。', true);
                 return;
             }

            postSubmitBtn.disabled = true; // 禁用按鈕防止重複提交
            postStatusMsg.textContent = '正在送出...';
            postStatusMsg.className = 'status-msg'; // Reset class

            try {
                const response = await fetch('/api/guestbook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ author_name: author, title: title, content: content })
                });

                const responseData = await response.json(); // 嘗試解析 JSON

                if (!response.ok) {
                    // 使用 API 回傳的錯誤訊息 (如果有的話)
                    throw new Error(responseData.error || `無法發表留言 (${response.status})`);
                }

                console.log('留言成功:', responseData);
                showStatusMessage(postStatusMsg, '留言發表成功！', false);
                closeModal('post-modal'); // 關閉 Modal
                fetchGuestbookList(1, 'latest'); // 發表成功後，跳到最新留言的第一頁
                startCooldown('posting', postSubmitBtn); // 開始冷卻

            } catch (error) {
                console.error('發表留言失敗:', error);
                showStatusMessage(postStatusMsg, `發表失敗：${error.message}`, true);
                postSubmitBtn.disabled = false; // 失敗時恢復按鈕
            }
        });
    }

    // 提交回覆表單
    if (replyForm) {
        replyForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (isReplyingCooldown) {
                 showStatusMessage(replyStatusMsg, `操作太頻繁，請稍候再試。`, true);
                return;
            }

            const messageId = replyMessageIdInput.value;
            const parentId = replyParentIdInput.value || null; // 如果 input 為空，設為 null
            const author = document.getElementById('reply-author-name').value;
            const content = document.getElementById('reply-content').value.trim();

            if (!content) {
                 showStatusMessage(replyStatusMsg, '回覆內容不能為空。', true);
                return;
            }
            if (!messageId) {
                 showStatusMessage(replyStatusMsg, '錯誤：缺少留言 ID。', true);
                return;
            }

            replySubmitBtn.disabled = true;
            replyStatusMsg.textContent = '正在送出...';
            replyStatusMsg.className = 'status-msg';

            try {
                 const response = await fetch('/api/guestbook/replies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message_id: parseInt(messageId),
                        parent_reply_id: parentId ? parseInt(parentId) : null,
                        author_name: author,
                        content: content
                    })
                });

                 const responseData = await response.json();

                if (!response.ok) {
                    throw new Error(responseData.error || `無法送出回覆 (${response.status})`);
                }

                console.log('回覆成功:', responseData);
                showStatusMessage(replyStatusMsg, '回覆成功！', false);
                 replyForm.reset(); // 清空表單
                 replyTargetIndicator.textContent = ''; // 清空提示
                 replyParentIdInput.value = ''; // 清空父 ID

                // 重新載入詳情以顯示新回覆
                if (currentDetailMessageId) {
                     await fetchMessageDetail(currentDetailMessageId); // 等待詳情更新完成
                }
                 startCooldown('replying', replySubmitBtn); // 開始冷卻

            } catch (error) {
                 console.error('送出回覆失敗:', error);
                 showStatusMessage(replyStatusMsg, `回覆失敗：${error.message}`, true);
                 replySubmitBtn.disabled = false; // 恢復按鈕
            }
        });
    }


    // --- 初始化 ---
    fetchGuestbookList(currentPage, currentSort); // 頁面載入時獲取第一頁最新留言

}); // --- End of DOMContentLoaded ---