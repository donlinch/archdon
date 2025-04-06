// public/guestbook.js
document.addEventListener('DOMContentLoaded', () => {
    const messageListContainer = document.getElementById('message-list-container');
    const paginationContainer = document.getElementById('pagination-container');
    const postForm = document.getElementById('post-message-form');
    const postStatus = document.getElementById('post-status');
    const submitMessageBtn = document.getElementById('submit-message-btn');

    let currentPage = 1;
    let isPostingCooldown = false; // 發文冷卻狀態

    // --- 函數：獲取並顯示留言列表 ---
    async function fetchGuestbookList(page = 1) {
        if (!messageListContainer || !paginationContainer) {
            console.error("列表或分頁容器未找到！");
            return;
        }
        messageListContainer.innerHTML = '<p>正在載入留言...</p>'; // 顯示載入中
        paginationContainer.innerHTML = ''; // 清空分頁

        try {
            const response = await fetch(`/api/guestbook?page=${page}&limit=10`); // 每頁 10 筆
            if (!response.ok) {
                throw new Error(`無法獲取留言列表 (HTTP ${response.status})`);
            }
            const data = await response.json();
            currentPage = data.currentPage; // 更新當前頁碼

            renderMessageList(data.messages);
            renderPagination(data.totalPages, data.currentPage);

        } catch (error) {
            console.error('獲取留言列表失敗:', error);
            messageListContainer.innerHTML = `<p style="color: red;">無法載入留言列表：${error.message}</p>`;
        }
    }

    // --- 函數：渲染留言列表 (使用 textContent 和 DOM 操作) ---
    function renderMessageList(messages) {
        if (!messageListContainer) return;
        messageListContainer.innerHTML = ''; // 清空舊內容

        if (!messages || messages.length === 0) {
            const p = document.createElement('p');
            p.textContent = '目前沒有留言。';
            messageListContainer.appendChild(p);
            return;
        }

        messages.forEach(msg => {
            const messageItemDiv = document.createElement('div');
            messageItemDiv.className = 'message-list-item';
            messageItemDiv.id = `message-row-${msg.id}`;

            const authorSpan = document.createElement('span');
            authorSpan.className = 'author';
            authorSpan.textContent = msg.author_name || '匿名'; // 使用 textContent

            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'timestamp';
            const activityDate = new Date(msg.last_activity_at).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            timestampSpan.textContent = `(${activityDate})`;

            const previewLink = document.createElement('a');
            previewLink.className = 'content-preview';
            previewLink.href = `/message-detail.html?id=${msg.id}`;
            previewLink.textContent = msg.content_preview || '(無內容預覽)'; // 使用 textContent
            // 處理預覽內容的換行需要 CSS: .content-preview { white-space: pre-wrap; word-wrap: break-word; }

            const metaSpan = document.createElement('span');
            metaSpan.className = 'meta';
            metaSpan.textContent = `回覆(${msg.reply_count || 0})`;

// 【★ 新增 Like 數顯示 ★】
const likeSpan = document.createElement('span');
likeSpan.className = 'meta';
likeSpan.innerHTML = ` ❤️ ${msg.like_count || 0}`; // 直接用 Emoji
likeSpan.style.marginLeft = '1rem';





            const viewSpan = document.createElement('span');
viewSpan.className = 'meta'; // 可以共用 meta 樣式或新建
viewSpan.textContent = `瀏覽(${msg.view_count || 0})`;
viewSpan.style.marginLeft = '1rem'; // 和回覆數分開一點

            const detailLink = document.createElement('a');
            detailLink.className = 'view-detail-btn';
            detailLink.href = `/message-detail.html?id=${msg.id}`;
            detailLink.textContent = '[查看詳情]';

            // 按順序添加到 messageItemDiv
            messageItemDiv.appendChild(authorSpan);
messageItemDiv.appendChild(document.createTextNode(' '));
messageItemDiv.appendChild(timestampSpan);
messageItemDiv.appendChild(previewLink);
messageItemDiv.appendChild(metaSpan); // 回覆數
messageItemDiv.appendChild(viewSpan); // 瀏覽數
messageItemDiv.appendChild(likeSpan);      // 按讚數
messageItemDiv.appendChild(document.createTextNode(' '));
messageItemDiv.appendChild(detailLink);

messageListContainer.appendChild(messageItemDiv);
            // 添加分隔線
            const hr = document.createElement('hr');
            messageListContainer.appendChild(hr);
        });
    }

    // --- 函數：渲染分頁控制 (使用 DOM 操作) ---
    function renderPagination(totalPages, currentPage) {
        if (!paginationContainer || totalPages <= 1) {
             paginationContainer.innerHTML = '';
            return;
        };
        paginationContainer.innerHTML = ''; // 清空

        // 上一頁按鈕
        const prevButton = document.createElement('button');
        prevButton.className = 'page-btn';
        prevButton.dataset.page = currentPage - 1;
        prevButton.disabled = (currentPage === 1);
        prevButton.innerHTML = '<< 上一頁';
        paginationContainer.appendChild(prevButton);

        // 頁碼按鈕
        const maxPagesToShow = 5; let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2)); let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1); if (endPage - startPage + 1 < maxPagesToShow) startPage = Math.max(1, endPage - maxPagesToShow + 1);
        if (startPage > 1) { const span = document.createElement('span'); span.textContent = '...'; paginationContainer.appendChild(span); }
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = 'page-btn';
            pageButton.dataset.page = i;
            pageButton.disabled = (i === currentPage);
            if (i === currentPage) {
                pageButton.style.fontWeight = 'bold';
                // 可以添加一個 .current-page class 來應用 CSS 樣式
                pageButton.classList.add('current-page');
            }
            pageButton.textContent = i;
            paginationContainer.appendChild(pageButton);
        }
        if (endPage < totalPages) { const span = document.createElement('span'); span.textContent = '...'; paginationContainer.appendChild(span); }

        // 下一頁按鈕
        const nextButton = document.createElement('button');
        nextButton.className = 'page-btn';
        nextButton.dataset.page = currentPage + 1;
        nextButton.disabled = (currentPage === totalPages);
        nextButton.innerHTML = '下一頁 >>';
        paginationContainer.appendChild(nextButton);
    }

    // --- 事件監聽：提交新留言 ---
    if (postForm && submitMessageBtn && postStatus) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (isPostingCooldown) {
                postStatus.textContent = '留言過於頻繁，請稍候...';
                postStatus.style.color = 'orange';
                return;
            }

            submitMessageBtn.disabled = true;
            postStatus.textContent = '正在送出...';
            postStatus.style.color = 'blue';

            const formData = new FormData(postForm);
            // 【★ 移除標題獲取 ★】
            const authorName = formData.get('author_name')?.trim() || '匿名';
            const content = formData.get('content')?.trim();

            if (!content) {
                postStatus.textContent = '錯誤：留言內容不能為空！';
                postStatus.style.color = 'red';
                submitMessageBtn.disabled = false;
                return;
            }

            try {
                const response = await fetch('/api/guestbook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // 【★ 移除標題發送 ★】
                    body: JSON.stringify({ author_name: authorName, content: content }),
                });

                if (!response.ok) {
                     const errorData = await response.json().catch(() => ({ error: `HTTP 錯誤 ${response.status}` }));
                    throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`);
                }

                postStatus.textContent = '留言成功！';
                postStatus.style.color = 'green';
                postForm.reset();
                fetchGuestbookList(1); // 刷新到第一頁

                // 啟動冷卻
                isPostingCooldown = true;
                submitMessageBtn.textContent = '請稍候 (15s)';
                setTimeout(() => {
                    isPostingCooldown = false;
                    submitMessageBtn.disabled = false;
                    submitMessageBtn.textContent = '送出留言';
                    postStatus.textContent = '';
                }, 15000);

            } catch (error) {
                console.error('留言失敗:', error);
                postStatus.textContent = `留言失敗：${error.message}`;
                postStatus.style.color = 'red';
                submitMessageBtn.disabled = false;
                submitMessageBtn.textContent = '送出留言';
            }
        });
    }

    // --- 事件監聽：點擊分頁按鈕 ---
    if (paginationContainer) {
        paginationContainer.addEventListener('click', (e) => {
            if (e.target.matches('.page-btn') && !e.target.disabled) {
                const page = parseInt(e.target.dataset.page, 10);
                if (!isNaN(page)) {
                    fetchGuestbookList(page);
                }
            }
        });
    }

    // --- 移除 escapeHtml 函數 ---
    // function escapeHtml(unsafe) { ... }

    // --- 初始載入 ---
    fetchGuestbookList(1);
});