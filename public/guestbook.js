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
        if (!messageListContainer || !paginationContainer) return;
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

    // --- 函數：渲染留言列表 ---
    function renderMessageList(messages) {
        if (!messageListContainer) return;
        if (!messages || messages.length === 0) {
            messageListContainer.innerHTML = '<p>目前沒有留言。</p>';
            return;
        }

        let html = '';
        messages.forEach(msg => {
            // 格式化時間 (可選，或用更專業的庫如 date-fns, moment)
            const activityDate = new Date(msg.last_activity_at).toLocaleString('zh-TW', {
                 year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }); // 或顯示相對時間

            html += `
                <div class="message-list-item">
                    <span class="author">${escapeHtml(msg.author_name || '匿名')}</span>
                    <span class="timestamp">(${activityDate})</span>
                    <a href="/message-detail.html?id=${msg.id}" class="content-preview">
                        ${escapeHtml(msg.content_preview || '(無內容預覽)')}
                    </a>
                    <span class="meta">回覆(${msg.reply_count || 0})</span>
                    <a href="/message-detail.html?id=${msg.id}" class="view-detail-btn">[查看詳情]</a>
                </div>
                <hr>
            `;
        });
        messageListContainer.innerHTML = html;
    }

    // --- 函數：渲染分頁控制 ---
    function renderPagination(totalPages, currentPage) {
        if (!paginationContainer || totalPages <= 1) {
             paginationContainer.innerHTML = ''; // 只有一頁或沒有則不顯示分頁
            return;
        };

        let paginationHtml = '';

        // 上一頁按鈕
        paginationHtml += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}><< 上一頁</button>`;

        // 頁碼按鈕 (可做更複雜的省略號邏輯)
        const maxPagesToShow = 5; // 最多顯示幾個頁碼按鈕
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
         if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }


        if (startPage > 1) paginationHtml += `<span>...</span>`;
        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `<button class="page-btn" data-page="${i}" ${i === currentPage ? 'disabled style="font-weight:bold;"' : ''}>${i}</button>`;
        }
        if (endPage < totalPages) paginationHtml += `<span>...</span>`;

        // 下一頁按鈕
        paginationHtml += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>下一頁 >></button>`;

        paginationContainer.innerHTML = paginationHtml;
    }

    // --- 事件監聽：提交新留言 ---
    if (postForm && submitMessageBtn && postStatus) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // 阻止表單默認提交

            if (isPostingCooldown) {
                postStatus.textContent = '留言過於頻繁，請稍候...';
                postStatus.style.color = 'orange';
                return;
            }

            submitMessageBtn.disabled = true; // 禁用按鈕
            postStatus.textContent = '正在送出...';
            postStatus.style.color = 'blue';

            const formData = new FormData(postForm);
            const authorName = formData.get('author_name')?.trim() || '匿名'; // 處理匿名
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
                    body: JSON.stringify({ author_name: authorName, content: content }),
                });

                if (!response.ok) {
                     const errorData = await response.json().catch(() => ({ error: `HTTP 錯誤 ${response.status}` }));
                    throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`);
                }

                postStatus.textContent = '留言成功！';
                postStatus.style.color = 'green';
                postForm.reset(); // 清空表單
                fetchGuestbookList(1); // 刷新到第一頁

                // 啟動冷卻
                isPostingCooldown = true;
                submitMessageBtn.textContent = '請稍候 (15s)';
                setTimeout(() => {
                    isPostingCooldown = false;
                    submitMessageBtn.disabled = false;
                    submitMessageBtn.textContent = '送出留言';
                    postStatus.textContent = ''; // 清除狀態訊息
                }, 15000); // 15 秒冷卻

            } catch (error) {
                console.error('留言失敗:', error);
                postStatus.textContent = `留言失敗：${error.message}`;
                postStatus.style.color = 'red';
                submitMessageBtn.disabled = false; // 失敗時恢復按鈕
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

    // --- 輔助函數：HTML 特殊字符轉義 ---
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
        function escapeHtml(unsafe) {
            if (!unsafe) return '';
            return unsafe
                // & 轉成 & a m p ;
                .replace(/&/g, '&amp;')
        
                // < 轉成 & l t ;
                .replace(/</g, '&lt;')
        
                // > 轉成 & g t ;
                .replace(/>/g, '&gt;')
        
                // " 轉成 & q u o t ;
                .replace(/"/g, '&quot;')
        
                // ' 轉成 & # 3 9 ;  (數字實體)
                .replace(/'/g, '&#39;');
        
                // 或者 ' 轉成 & a p o s ; (命名實體，較少用於單引號)
                // .replace(/'/g, '& a p o s ;');
        }
    }

    // --- 初始載入 ---
    fetchGuestbookList(1);
});