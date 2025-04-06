// public/guestbook.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
    const messageListContainer = document.getElementById('message-list-container');
    const paginationContainer = document.getElementById('pagination-container');
    const postForm = document.getElementById('post-message-form');
    const postStatus = document.getElementById('post-status');
    const submitMessageBtn = document.getElementById('submit-message-btn');
    const sortControls = document.querySelector('.sort-controls'); // 獲取排序按鈕容器

    // --- 狀態變數 ---
    let currentPage = 1;
    let currentSort = 'latest';
    let isPostingCooldown = false;

    // --- 函數：更新排序按鈕的 active 狀態 ---
    function updateSortButtonsActiveState(activeSort) {
        // 【★ 修正 ★】在使用前檢查 sortControls 是否成功獲取
        if (!sortControls) {
            // console.warn("無法更新排序按鈕狀態：未找到 '.sort-controls' 容器。");
            return;
        }
        const buttons = sortControls.querySelectorAll('.sort-btn');
        buttons.forEach(button => {
            if (button.dataset.sort === activeSort) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    // --- 函數：獲取並顯示留言列表 ---
    async function fetchGuestbookList(page = 1, sort = 'latest') {
        if (!messageListContainer || !paginationContainer) {
            console.error("列表或分頁容器未找到！");
            return;
        }
        messageListContainer.innerHTML = '<p>正在載入留言...</p>';
        paginationContainer.innerHTML = '';

        currentPage = page;
        currentSort = sort;

        try {
            const response = await fetch(`/api/guestbook?page=${page}&limit=10&sort=${sort}`);
            if (!response.ok) {
                let errorMsg = `HTTP 錯誤 ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {}
                throw new Error(`無法獲取留言列表 (${errorMsg})`);
            }
            const data = await response.json();

            // 【★ 確保在這裡調用 updateSortButtonsActiveState ★】
            updateSortButtonsActiveState(data.sort || 'latest');

            renderMessageList(data.messages);
            renderPagination(data.totalPages, data.currentPage);

        } catch (error) {
            console.error('獲取留言列表失敗:', error);
            messageListContainer.innerHTML = `<p style="color: red;">無法載入留言列表：${error.message}</p>`;
        }
    }

    // --- 函數：渲染留言列表 (使用 DOM 操作) ---
    function renderMessageList(messages) {
        // ... (這部分程式碼不變，保持之前的版本) ...
        if (!messageListContainer) return;
        messageListContainer.innerHTML = ''; // 清空舊內容
        if (!messages || messages.length === 0) { const p = document.createElement('p'); p.textContent = '目前沒有留言。'; messageListContainer.appendChild(p); return; }
        messages.forEach(msg => {
            const messageItemDiv = document.createElement('div'); messageItemDiv.className = 'message-list-item'; messageItemDiv.id = `message-row-${msg.id}`;
            const authorSpan = document.createElement('span'); authorSpan.className = 'author'; authorSpan.textContent = msg.author_name || '匿名';
            const timestampSpan = document.createElement('span'); timestampSpan.className = 'timestamp'; const activityDate = new Date(msg.last_activity_at).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); timestampSpan.textContent = `(${activityDate})`;
            const previewLink = document.createElement('a'); previewLink.className = 'content-preview'; previewLink.href = `/message-detail.html?id=${msg.id}`; previewLink.textContent = msg.content_preview || '(無內容預覽)'; previewLink.style.whiteSpace = 'pre-wrap'; previewLink.style.wordWrap = 'break-word';
            const metaSpan = document.createElement('span'); metaSpan.className = 'meta'; metaSpan.textContent = `回覆(${msg.reply_count || 0})`;
            const likeSpan = document.createElement('span'); likeSpan.className = 'meta'; likeSpan.innerHTML = ` ❤️ ${msg.like_count || 0}`; likeSpan.style.marginLeft = '1rem';
            const viewSpan = document.createElement('span'); viewSpan.className = 'meta'; viewSpan.textContent = `瀏覽(${msg.view_count || 0})`; viewSpan.style.marginLeft = '1rem';
            const detailLink = document.createElement('a'); detailLink.className = 'view-detail-btn'; detailLink.href = `/message-detail.html?id=${msg.id}`; detailLink.textContent = '[查看詳情]';
            messageItemDiv.appendChild(authorSpan); messageItemDiv.appendChild(document.createTextNode(' ')); messageItemDiv.appendChild(timestampSpan); messageItemDiv.appendChild(previewLink); messageItemDiv.appendChild(metaSpan); messageItemDiv.appendChild(viewSpan); messageItemDiv.appendChild(likeSpan); messageItemDiv.appendChild(document.createTextNode(' ')); messageItemDiv.appendChild(detailLink);
            messageListContainer.appendChild(messageItemDiv);
            const hr = document.createElement('hr'); messageListContainer.appendChild(hr);
        });
    }

    // --- 函數：渲染分頁控制 (使用 DOM 操作) ---
    function renderPagination(totalPages, currentPage) {
        // ... (這部分程式碼不變，保持之前的版本) ...
        if (!paginationContainer || totalPages <= 1) { paginationContainer.innerHTML = ''; return; }; paginationContainer.innerHTML = '';
        const prevButton = document.createElement('button'); prevButton.className = 'page-btn'; prevButton.dataset.page = currentPage - 1; prevButton.disabled = (currentPage === 1); prevButton.innerHTML = '<< 上一頁'; paginationContainer.appendChild(prevButton);
        const maxPagesToShow = 5; let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2)); let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1); if (endPage - startPage + 1 < maxPagesToShow) startPage = Math.max(1, endPage - maxPagesToShow + 1);
        if (startPage > 1) { const span = document.createElement('span'); span.textContent = '...'; paginationContainer.appendChild(span); }
        for (let i = startPage; i <= endPage; i++) { const pageButton = document.createElement('button'); pageButton.className = 'page-btn'; pageButton.dataset.page = i; pageButton.disabled = (i === currentPage); if (i === currentPage) pageButton.classList.add('current-page'); pageButton.textContent = i; paginationContainer.appendChild(pageButton); }
        if (endPage < totalPages) { const span = document.createElement('span'); span.textContent = '...'; paginationContainer.appendChild(span); }
        const nextButton = document.createElement('button'); nextButton.className = 'page-btn'; nextButton.dataset.page = currentPage + 1; nextButton.disabled = (currentPage === totalPages); nextButton.innerHTML = '下一頁 >>'; paginationContainer.appendChild(nextButton);
    }

    // --- 事件監聽：提交新留言 ---
    if (postForm && submitMessageBtn && postStatus) {
        postForm.addEventListener('submit', async (e) => {
            // ... (這部分程式碼不變，保持之前的版本) ...
            e.preventDefault(); if (isPostingCooldown) { postStatus.textContent = '留言過於頻繁，請稍候...'; postStatus.style.color = 'orange'; return; } submitMessageBtn.disabled = true; postStatus.textContent = '正在送出...'; postStatus.style.color = 'blue';
            const formData = new FormData(postForm); const authorName = formData.get('author_name')?.trim() || '匿名'; const content = formData.get('content')?.trim();
            if (!content) { postStatus.textContent = '錯誤：留言內容不能為空！'; postStatus.style.color = 'red'; submitMessageBtn.disabled = false; return; }
            try {
                const response = await fetch('/api/guestbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ author_name: authorName, content: content }), });
                if (!response.ok) { const errorData = await response.json().catch(() => ({ error: `HTTP 錯誤 ${response.status}` })); throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`); }
                postStatus.textContent = '留言成功！'; postStatus.style.color = 'green'; postForm.reset(); fetchGuestbookList(1, currentSort); // 刷新時也帶上當前排序
                isPostingCooldown = true; submitMessageBtn.textContent = '請稍候 (15s)';
                setTimeout(() => { isPostingCooldown = false; submitMessageBtn.disabled = false; submitMessageBtn.textContent = '送出留言'; postStatus.textContent = ''; }, 15000);
            } catch (error) { console.error('留言失敗:', error); postStatus.textContent = `留言失敗：${error.message}`; postStatus.style.color = 'red'; submitMessageBtn.disabled = false; submitMessageBtn.textContent = '送出留言'; }
        });
    }

     // --- 事件監聽：點擊排序按鈕 ---
     if (sortControls) { // 【★ 修正 ★】 在添加監聽器前檢查是否存在
        sortControls.addEventListener('click', (e) => {
            if (e.target.matches('.sort-btn') && !e.target.classList.contains('active')) {
                const newSort = e.target.dataset.sort;
                if (newSort) {
                    // 更新按鈕狀態（立即反饋）
                    updateSortButtonsActiveState(newSort); // 調用更新函數
                    // 使用新的排序方式獲取第一頁數據
                    fetchGuestbookList(1, newSort);
                }
            }
        });
     } else {
         console.warn("警告：未找到排序按鈕容器 '.sort-controls'。排序功能將不可用。");
     }

    // --- 事件監聽：點擊分頁按鈕 ---
    if (paginationContainer) { // 【★ 修正 ★】 同樣在使用前檢查
        paginationContainer.addEventListener('click', (e) => {
            if (e.target.matches('.page-btn') && !e.target.disabled) {
                const page = parseInt(e.target.dataset.page, 10);
                if (!isNaN(page)) {
                    // 分頁時使用當前的排序方式
                    fetchGuestbookList(page, currentSort);
                }
            }
        });
    }

    // --- 初始載入 ---
    fetchGuestbookList(1, currentSort); // 初始載入時傳遞預設排序
});