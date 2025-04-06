// public/guestbook.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
    const messageListContainer = document.getElementById('message-list-container');
    const paginationContainer = document.getElementById('pagination-container');
    const sortControls = document.querySelector('.sort-controls');
    // 發表 Modal 元素
    const newPostBtn = document.getElementById('new-post-btn');
    const postModal = document.getElementById('post-modal');
    // 使用更精確的選擇器獲取 Modal 內的元素
    const closePostModalBtn = postModal?.querySelector('#close-post-modal-btn'); // 假設右上角關閉按鈕 ID
    const postModalForm = postModal?.querySelector('#post-message-form');
    const postModalStatus = postModal?.querySelector('#post-status');
    const postModalSubmitBtn = postModal?.querySelector('#submit-message-btn');
    const postModalCancelBtns = postModal?.querySelectorAll('.close-modal-btn'); // 假設底部也有 .close-modal-btn

    // 詳情 Modal 元素
    const detailModal = document.getElementById('message-detail-modal');
    const closeDetailModalBtn = detailModal?.querySelector('#close-detail-modal-btn');
    const detailModalMain = document.getElementById('modal-message-detail-main');
    const detailModalReplyList = document.getElementById('modal-reply-list-container');
    const detailModalReplyForm = document.getElementById('modal-reply-form');
    const modalReplyFormLabel = detailModalReplyForm?.querySelector('label[for="modal-reply-content"]');
    const modalReplyFormContent = document.getElementById('modal-reply-content');
    const modalReplyFormAuthor = document.getElementById('modal-reply-author-name');
    const modalReplyStatus = document.getElementById('modal-reply-status');
    const modalSubmitReplyBtn = document.getElementById('modal-submit-reply-btn');
    const detailModalCancelBtns = detailModal?.querySelectorAll('.close-modal-btn'); // 詳情 Modal 內的關閉按鈕

    // --- 狀態變數 ---
    let currentPage = 1;
    let currentSort = 'latest';
    let isPostingCooldown = false;
    let isReplyingCooldown = false;
    let currentDetailMessageId = null;
    let currentParentReplyId = null;

    // --- 函數：打開 Modal ---
    function openModal(modalElement) {
        if (modalElement) modalElement.style.display = 'flex';
    }

    // --- 函數：關閉 Modal ---
    function closeModal(modalElement) {
        if (modalElement) modalElement.style.display = 'none';
    }

    // --- 函數：更新排序按鈕狀態 ---
    function updateSortButtonsActiveState(activeSort) {
        if (!sortControls) return;
        const buttons = sortControls.querySelectorAll('.sort-btn');
        buttons.forEach(button => {
            button.classList.toggle('active', button.dataset.sort === activeSort);
        });
    }

    // --- 函數：獲取並顯示留言列表 ---
    async function fetchGuestbookList(page = 1, sort = 'latest') {
        if (!messageListContainer || !paginationContainer) return;
        messageListContainer.innerHTML = '<p>正在載入留言...</p>'; paginationContainer.innerHTML = '';
        currentPage = page; currentSort = sort;
        try {
            const response = await fetch(`/api/guestbook?page=${page}&limit=10&sort=${sort}`);
            if (!response.ok) throw new Error(`無法獲取留言列表 (HTTP ${response.status})`);
            const data = await response.json();
            updateSortButtonsActiveState(data.sort || 'latest');
            renderMessageList(data.messages);
            renderPagination(data.totalPages, data.currentPage); // 【★ 修正 ★】調用修正後的 renderPagination
        } catch (error) { console.error('獲取留言列表失敗:', error); messageListContainer.innerHTML = `<p style="color: red;">無法載入留言列表：${error.message}</p>`; }
    }

    // --- 函數：渲染留言列表 (觸發 Modal) ---
    function renderMessageList(messages) {
        if (!messageListContainer) return;
        messageListContainer.innerHTML = '';
        if (!messages || messages.length === 0) { const p = document.createElement('p'); p.textContent = '目前沒有留言。'; messageListContainer.appendChild(p); return; }

        messages.forEach(msg => {
            const messageItemDiv = document.createElement('div'); messageItemDiv.className = 'message-list-item';
            const authorSpan = document.createElement('span'); authorSpan.className = 'author'; authorSpan.textContent = msg.author_name || '匿名';
            const timestampSpan = document.createElement('span'); timestampSpan.className = 'timestamp'; const activityDate = new Date(msg.last_activity_at).toLocaleString('zh-TW'); timestampSpan.textContent = `(${activityDate})`;
            const previewDiv = document.createElement('div'); previewDiv.className = 'content-preview view-detail-modal-btn'; previewDiv.dataset.messageId = msg.id; previewDiv.textContent = msg.content_preview || '(無內容預覽)'; previewDiv.style.cursor = 'pointer'; previewDiv.style.display = 'block'; previewDiv.style.margin = '0.5rem 0'; previewDiv.style.color = '#555'; previewDiv.style.lineHeight = '1.6';
            // CSS 限制行數: .content-preview { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
            const metaSpan = document.createElement('span'); metaSpan.className = 'meta view-detail-modal-btn'; metaSpan.dataset.messageId = msg.id; metaSpan.textContent = `回覆(${msg.reply_count || 0})`; metaSpan.style.cursor = 'pointer'; metaSpan.style.color = '#007bff'; metaSpan.style.textDecoration = 'underline';
            const viewSpan = document.createElement('span'); viewSpan.className = 'meta'; viewSpan.textContent = `瀏覽(${msg.view_count || 0})`; viewSpan.style.marginLeft = '1rem';
            const likeSpan = document.createElement('span'); likeSpan.className = 'meta'; likeSpan.innerHTML = ` ❤️ ${msg.like_count || 0}`; likeSpan.style.marginLeft = '1rem';
            const detailButton = document.createElement('button'); detailButton.className = 'btn btn-link btn-sm view-detail-modal-btn'; detailButton.dataset.messageId = msg.id; detailButton.textContent = ''; detailButton.style.marginLeft = '1rem';

            messageItemDiv.appendChild(authorSpan); messageItemDiv.appendChild(document.createTextNode(' ')); messageItemDiv.appendChild(timestampSpan);
            messageItemDiv.appendChild(previewDiv); messageItemDiv.appendChild(metaSpan); messageItemDiv.appendChild(viewSpan); messageItemDiv.appendChild(likeSpan);
            messageItemDiv.appendChild(detailButton);
            messageListContainer.appendChild(messageItemDiv);
            const hr = document.createElement('hr'); messageListContainer.appendChild(hr);
        });
    }

    // --- 【★ 修正 ★】函數：渲染分頁控制 (只有一個定義) ---
    function renderPagination(totalPages, currentPage) {
        if (!paginationContainer || totalPages <= 1) { paginationContainer.innerHTML = ''; return; };
        paginationContainer.innerHTML = '';

        const prevButton = document.createElement('button'); prevButton.className = 'page-btn'; prevButton.dataset.page = currentPage - 1; prevButton.disabled = (currentPage === 1); prevButton.innerHTML = '<< 上一頁'; paginationContainer.appendChild(prevButton);
        const maxPagesToShow = 5; let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2)); let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1); if (endPage - startPage + 1 < maxPagesToShow) startPage = Math.max(1, endPage - maxPagesToShow + 1);
        if (startPage > 1) { const span = document.createElement('span'); span.textContent = '...'; paginationContainer.appendChild(span); }
        for (let i = startPage; i <= endPage; i++) { const pageButton = document.createElement('button'); pageButton.className = 'page-btn'; pageButton.dataset.page = i; pageButton.disabled = (i === currentPage); if (i === currentPage) pageButton.classList.add('current-page'); pageButton.textContent = i; paginationContainer.appendChild(pageButton); }
        if (endPage < totalPages) { const span = document.createElement('span'); span.textContent = '...'; paginationContainer.appendChild(span); }
        const nextButton = document.createElement('button'); nextButton.className = 'page-btn'; nextButton.dataset.page = currentPage + 1; nextButton.disabled = (currentPage === totalPages); nextButton.innerHTML = '下一頁 >>'; paginationContainer.appendChild(nextButton);
    }









    
        // --- 【★★★ 詳情 Modal 相關函數 ★★★】 ---
    
        // --- 函數：獲取並渲染詳情 Modal 內容 ---
        async function fetchAndRenderDetailModal(messageId) {
            if (!detailModal || !detailModalMain || !detailModalReplyList) {
                 console.error("錯誤：詳情 Modal 或其內部容器未找到！");
                 return; // 確保元素存在
            }
            currentDetailMessageId = messageId; // 記錄當前查看的 ID
    
            // 顯示載入中狀態
            detailModalMain.innerHTML = '<p>正在載入留言內容...</p>';
            detailModalReplyList.innerHTML = '<p>正在載入回覆...</p>';
            // 重置回覆表單狀態
            if (detailModalReplyForm) detailModalReplyForm.reset();
            if (modalReplyStatus) modalReplyStatus.textContent = '';
            if (modalReplyFormLabel) modalReplyFormLabel.textContent = '回覆內容 (必填):'; // 恢復 Label
            currentParentReplyId = null; // 清除之前的回覆目標
    
            openModal(detailModal); // 打開 Modal
    
            // 發送 view 請求 (增加瀏覽數)
            fetch(`/api/guestbook/message/${messageId}/view`, { method: 'POST' })
                .catch(err => console.warn('記錄瀏覽數時網路錯誤:', err));
    
            // 獲取詳情數據
            try {
                const response = await fetch(`/api/guestbook/message/${messageId}`); // API 路徑
                if (!response.ok) {
                    if (response.status === 404) throw new Error('找不到指定的留言。');
                    let errorMsg = `HTTP 錯誤 ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {}
                    throw new Error(`無法獲取留言詳情 (${errorMsg})`);
                }
                const data = await response.json();
                if (!data || !data.message) throw new Error('API 返回的資料格式不正確。');
    
                renderModalMessageDetail(data.message); // 渲染 Modal 主留言
                renderModalNestedReplyList(data.replies || []); // 渲染 Modal 嵌套回覆
    
            } catch (error) {
                console.error('載入詳情 Modal 失敗:', error);
                detailModalMain.innerHTML = `<p style="color: red;">無法載入詳情：${error.message}</p>`;
                detailModalReplyList.innerHTML = '';
            }
        }
    
        // --- 函數：渲染 Modal 中的主留言詳情 ---
        function renderModalMessageDetail(message) {
            if (!detailModalMain || !message) return;
            detailModalMain.innerHTML = ''; // 清空
    
            const titleH2 = document.createElement('h2');
            titleH2.textContent = `留言 #${message.id}`; // 顯示 ID 作為標題
            titleH2.style.marginTop = '0'; // 移除預設 H2 margin
    
            const authorP = document.createElement('p');
            const authorSpan = document.createElement('span'); authorSpan.className = 'author'; authorSpan.textContent = message.author_name || '匿名';
            const timestampSpan = document.createElement('span'); timestampSpan.className = 'timestamp'; const createDate = new Date(message.created_at).toLocaleString('zh-TW'); timestampSpan.textContent = ` (${createDate})`;
            authorP.appendChild(authorSpan); authorP.appendChild(timestampSpan);
    
            const hr = document.createElement('hr');
    
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = message.content || '';
            contentDiv.style.whiteSpace = 'pre-wrap';
            contentDiv.style.wordWrap = 'break-word';
            contentDiv.style.padding = '10px 0'; // 上下留白
    
            const metaP = document.createElement('p');
            metaP.style.fontSize = '0.9em'; metaP.style.color = '#777'; metaP.style.marginTop = '15px';
            metaP.appendChild(document.createTextNode(`回覆: ${message.reply_count || 0} | 瀏覽: ${message.view_count || 0}`));    
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
            detailModalMain.appendChild(titleH2);
            detailModalMain.appendChild(authorP);
            detailModalMain.appendChild(hr);
            detailModalMain.appendChild(contentDiv);
            detailModalMain.appendChild(metaP);
        }
    
        // --- 函數：渲染 Modal 中的嵌套回覆列表 ---
        function renderModalNestedReplyList(replies) {
            if (!detailModalReplyList) { console.error("錯誤：找不到 Modal 內的回覆列表容器 #modal-reply-list-container"); return; }
            detailModalReplyList.innerHTML = '';
            if (!replies || replies.length === 0) { const p = document.createElement('p'); p.textContent = '目前沒有回覆。'; detailModalReplyList.appendChild(p); return; }
    
            const repliesByParentId = new Map();
            replies.forEach(reply => { const parentId = reply.parent_reply_id === null ? 'root' : reply.parent_reply_id; if (!repliesByParentId.has(parentId)) repliesByParentId.set(parentId, []); repliesByParentId.get(parentId).push(reply); });
            const floorMap = new Map();
            const rootReplies = repliesByParentId.get('root') || [];
            rootReplies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            rootReplies.forEach((reply, index) => { floorMap.set(reply.id, `B${index + 1}`); });
    
            function renderRepliesRecursive(parentId, level = 0) {
                const children = repliesByParentId.get(parentId === 'root' ? 'root' : parentId) || [];
                children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                if (children.length === 0) return;
    
                children.forEach((reply) => {
                    let floorNumber = '';
                    if (level === 0) { floorNumber = floorMap.get(reply.id); }
                    else { const parentFloor = floorMap.get(parentId); if (parentFloor) { const siblings = repliesByParentId.get(parentId) || []; const replyIndex = siblings.findIndex(r => r.id === reply.id); floorNumber = `${parentFloor}-${replyIndex + 1}`; floorMap.set(reply.id, floorNumber); } else { floorNumber = '?'; console.warn(`找不到父級 ${parentId} 的樓層號`); } }
                    if (!floorNumber) floorNumber = "?";
    
                    const replyDiv = document.createElement('div');
                    replyDiv.className = reply.is_admin_reply ? 'reply-item admin-reply' : 'reply-item';
                    if (level > 0) { replyDiv.classList.add('nested'); replyDiv.style.marginLeft = `${level * 25}px`; }
                    replyDiv.dataset.replyId = reply.id; replyDiv.dataset.floor = floorNumber;
    
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
    
                    replyDiv.appendChild(metaP); replyDiv.appendChild(contentDiv); replyDiv.appendChild(actionsDiv);
                    detailModalReplyList.appendChild(replyDiv);
                    const hr = document.createElement('hr'); hr.style.borderTop = '1px dashed #eee'; hr.style.margin = '10px 0';
                    detailModalReplyList.appendChild(hr);
    
                    renderRepliesRecursive(reply.id, level + 1); // 遞迴
                });
            }
            renderRepliesRecursive('root', 0); // 開始渲染
        }
    
    
        // --- 事件監聽：打開新留言 Modal ---
        if (newPostBtn && postModal && postModalForm && postModalStatus && postModalSubmitBtn) {
            newPostBtn.addEventListener('click', () => {
                postModalForm.reset();
                postModalStatus.textContent = '';
                postModalSubmitBtn.disabled = false;
                postModalSubmitBtn.textContent = '送出留言';
                isPostingCooldown = false; // 重置冷卻
                openModal(postModal);
            });
        } else { console.error("錯誤：發表新留言相關的 Modal 元素未完全找到！"); }
    





// --- 事件監聽：打開新留言 Modal ---
if (newPostBtn && postModal) { // 簡化檢查
    newPostBtn.addEventListener('click', () => {
        if(postModalForm) postModalForm.reset();
        if(postModalStatus) postModalStatus.textContent = '';
        if(postModalSubmitBtn) {
            postModalSubmitBtn.disabled = false;
            postModalSubmitBtn.textContent = '送出留言';
        }
        isPostingCooldown = false;
        openModal(postModal);
    });
} else { console.error("錯誤：發表新留言按鈕或 Modal 未找到！"); }

// --- 事件監聽：關閉新留言 Modal ---
if (postModal && postModalCancelBtns) {
     postModalCancelBtns.forEach(btn => btn.addEventListener('click', () => closeModal(postModal)));
     // 使用者也可能點擊右上角的 X
     if (closePostModalBtn) closePostModalBtn.addEventListener('click', () => closeModal(postModal));
     window.addEventListener('click', (event) => { if (event.target == postModal) closeModal(postModal); });
}

        // --- 事件監聽：提交新留言 (Modal 表單) ---
        if (postModalForm && postModalSubmitBtn && postModalStatus) {
            postModalForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (isPostingCooldown) { postModalStatus.textContent = '留言過於頻繁...'; postModalStatus.style.color = 'orange'; return; }
    
                postModalSubmitBtn.disabled = true; postModalStatus.textContent = '正在送出...'; postModalStatus.style.color = 'blue'; isPostingCooldown = true;
    
                const formData = new FormData(postModalForm);
                const authorName = formData.get('author_name')?.trim() || '匿名';
                const content = formData.get('content')?.trim();
    
                if (!content) { postModalStatus.textContent = '錯誤：留言內容不能為空！'; postModalStatus.style.color = 'red'; postModalSubmitBtn.disabled = false; isPostingCooldown = false; return; }
    
                try {
                    const response = await fetch('/api/guestbook', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ author_name: authorName, content: content }),
                    });
                    if (!response.ok) { const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` })); throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`); }
    
                    postModalStatus.textContent = '留言成功！'; postModalStatus.style.color = 'green';
                    postModalForm.reset();
                    fetchGuestbookList(1, currentSort);
    
                    setTimeout(() => { if (postModal && postModal.style.display !== 'none') closeModal(postModal); }, 1000);
    
                    postModalSubmitBtn.textContent = '請稍候 (15s)';
                    setTimeout(() => {
                        isPostingCooldown = false;
                        if (postModalSubmitBtn && postModalSubmitBtn.disabled) { postModalSubmitBtn.disabled = false; postModalSubmitBtn.textContent = '送出留言'; }
                        if (postModalStatus && postModalStatus.style.color === 'green') { postModalStatus.textContent = ''; }
                    }, 15000);
    
                } catch (error) {
                    console.error('留言失敗:', error); postModalStatus.textContent = `留言失敗：${error.message}`; postModalStatus.style.color = 'red'; postModalSubmitBtn.disabled = false; postModalSubmitBtn.textContent = '送出留言'; isPostingCooldown = false;
                }
            });
        } else { console.error("錯誤：無法找到發表留言 Modal 的表單、提交按鈕或狀態元素。"); }
    
        // --- 事件監聽：提交詳情 Modal 中的回覆 ---
        if (detailModalReplyForm && modalSubmitReplyBtn && modalReplyStatus) {
             detailModalReplyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!currentDetailMessageId) { modalReplyStatus.textContent = '錯誤：未知留言 ID。'; modalReplyStatus.style.color = 'red'; return; }
                if (isReplyingCooldown) { modalReplyStatus.textContent = '回覆過於頻繁...'; modalReplyStatus.style.color = 'orange'; return; }
    
                modalSubmitReplyBtn.disabled = true; modalReplyStatus.textContent = '正在送出...'; modalReplyStatus.style.color = 'blue'; isReplyingCooldown = true;
    
                const authorName = modalReplyFormAuthor?.value.trim() || '匿名';
                const content = modalReplyFormContent?.value.trim();
                const parentId = currentParentReplyId; // 使用全局變數
    
                if (!content) { modalReplyStatus.textContent = '錯誤：回覆內容不能為空！'; modalReplyStatus.style.color = 'red'; modalSubmitReplyBtn.disabled = false; isReplyingCooldown = false; return; }
    
                try {
                    const response = await fetch('/api/guestbook/replies', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message_id: currentDetailMessageId,
                            parent_reply_id: parentId, // 發送記錄的父 ID
                            author_name: authorName,
                            content: content
                        }),
                    });
                     if (!response.ok) { const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` })); throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`); }
    
                     modalReplyStatus.textContent = '回覆成功！'; modalReplyStatus.style.color = 'green';
                     detailModalReplyForm.reset();
                     currentParentReplyId = null; // 重置回覆目標
                     if (modalReplyFormLabel) modalReplyFormLabel.textContent = '回覆內容 (必填):';
    
                     // 只刷新 Modal 內的內容
                     await fetchAndRenderDetailModal(currentDetailMessageId); // 使用 await 確保渲染完再計時
    
                     modalSubmitReplyBtn.textContent = '請稍候 (15s)';
                     setTimeout(() => { isReplyingCooldown = false; if (modalSubmitReplyBtn) { modalSubmitReplyBtn.disabled = false; modalSubmitReplyBtn.textContent = '送出回覆'; } if (modalReplyStatus) { modalReplyStatus.textContent = ''; } }, 15000);
    
                } catch (error) {
                     console.error('Modal 內回覆失敗:', error); modalReplyStatus.textContent = `回覆失敗：${error.message}`; modalReplyStatus.style.color = 'red'; if (modalSubmitReplyBtn) { modalSubmitReplyBtn.disabled = false; modalSubmitReplyBtn.textContent = '送出回覆'; } isReplyingCooldown = false;
                }
            });
        } else { console.error("錯誤：無法找到詳情 Modal 中的回覆表單元素。"); }
    
        // --- 事件監聽：點擊排序按鈕 ---
         if (sortControls) {
            sortControls.addEventListener('click', (e) => {
                if (e.target.matches('.sort-btn') && !e.target.classList.contains('active')) {
                    const newSort = e.target.dataset.sort;
                    if (newSort) {
                        updateSortButtonsActiveState(newSort);
                        fetchGuestbookList(1, newSort);
                    }
                }
            });
         } else { console.warn("警告：未找到排序按鈕容器 '.sort-controls'。"); }
    
        // --- 事件監聽：點擊分頁按鈕 ---
        if (paginationContainer) {
            paginationContainer.addEventListener('click', (e) => {
                if (e.target.matches('.page-btn') && !e.target.disabled) {
                    const page = parseInt(e.target.dataset.page, 10);
                    if (!isNaN(page)) {
                        fetchGuestbookList(page, currentSort);
                    }
                }
            });
        }
    
        // --- 事件委派：處理按讚、回覆、引用按鈕 ---
        document.body.addEventListener('click', async (event) => {
            const target = event.target;
            let id = null; let apiUrl = null; let countSpanSelector = null;
        
            // 【★ 修改 ★】只處理回覆的按讚
            if (target.matches('.reply-like-btn')) {
                id = target.dataset.id; apiUrl = `/api/guestbook/replies/${id}/like`; countSpanSelector = `#reply-like-count-${id}`;
            }
            if (likeApiUrl && likeId && likeCountSpanSelector) {
                target.disabled = true; target.style.opacity = '0.5';
                try {
                    const response = await fetch(likeApiUrl, { method: 'POST' });
                    if (!response.ok) { const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` })); throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`); }
                    const data = await response.json();
                    const countSpan = document.querySelector(likeCountSpanSelector);
                    if (countSpan) countSpan.textContent = ` ${data.like_count}`;
                    setTimeout(() => { target.disabled = false; target.style.opacity = '1'; }, 1000);
                } catch (error) { console.error('按讚失敗:', error); alert(`按讚失敗：${error.message}`); target.disabled = false; target.style.opacity = '1'; }
                return; // 處理完按讚
            }
    
            // --- 處理詳情 Modal 內的 "回覆" 和 "引用" 按鈕 ---
            // 【★ 修改 ★】確保事件目標是在 detailModal 內部
            if (detailModal && detailModal.contains(target)) {
                let targetId = null, targetFloor = null, isQuote = false, targetContent = null;
                if (target.matches('.reply-action-btn')) {
                    targetId = target.dataset.targetId; targetFloor = target.dataset.targetFloor;
                } else if (target.matches('.quote-action-btn')) {
                    targetId = target.dataset.targetId; targetFloor = target.dataset.targetFloor; targetContent = target.dataset.targetContent; isQuote = true;
                }
    
                if (targetId && targetFloor) {
                    currentParentReplyId = targetId; // 記錄父 ID
                    let prefix = `回覆 ${targetFloor}：\n`;
                    if (isQuote) { const quoteSnippet = (targetContent || '').substring(0, 30) + ((targetContent || '').length > 30 ? '...' : ''); prefix = `引用 ${targetFloor}：\n> ${quoteSnippet.replace(/\n/g, '\n> ')}\n---\n`; }
                    if (modalReplyFormLabel) modalReplyFormLabel.textContent = isQuote ? `引用 ${targetFloor} 並回覆:` : `回覆 ${targetFloor} 的內容:`;
                    if (modalReplyFormContent) { modalReplyFormContent.value = prefix; modalReplyFormContent.focus(); modalReplyFormContent.setSelectionRange(prefix.length, prefix.length); }
                    modalReplyForm?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        });
    
        // --- 事件委派：處理點擊留言列表項以打開詳情 Modal ---
        if (messageListContainer && detailModal) {
            messageListContainer.addEventListener('click', (event) => {
                 const triggerElement = event.target.closest('.view-detail-modal-btn');
                if (triggerElement) {
                    const messageId = triggerElement.dataset.messageId;
                    if (messageId) {
                        fetchAndRenderDetailModal(messageId); // 調用獲取並渲染 Modal 的函數
                    }
                }
            });
        }


// --- 【★ 新增 ★】事件監聽：關閉詳情 Modal ---
if (detailModal) {
    // 【★ 修改 ★】確保能選到所有關閉按鈕，包括右上角的和底部的
    const closeBtns = detailModal.querySelectorAll('.close-modal-btn, #close-detail-modal-btn'); // 同時選取 class 和 ID
    closeBtns.forEach(btn => {
        if (btn) { // 確保按鈕存在
           btn.removeEventListener('click', () => closeModal(detailModal)); // 先移除舊監聽器(以防萬一重複添加)
           btn.addEventListener('click', () => closeModal(detailModal)); // 再添加
        }
    });
    // 點擊 Modal 外部區域關閉 (保持不變)
    window.addEventListener('click', (event) => { if (event.target == detailModal) closeModal(detailModal); });
}

    
      // --- 事件監聽：關閉詳情 Modal ---
    if (detailModal) {
        // 【★ 修正 ★】使用修正後的關閉邏輯
        const specificCloseBtn = detailModal.querySelector('#close-detail-modal-btn');
        if (specificCloseBtn) {
            specificCloseBtn.removeEventListener('click', () => closeModal(detailModal)); // 移除舊的
            specificCloseBtn.addEventListener('click', () => closeModal(detailModal));
        } else { console.warn("警告：未找到詳情 Modal 的右上角關閉按鈕 #close-detail-modal-btn"); }
        // 處理底部的關閉按鈕 (如果有)
        const bottomCloseBtns = detailModal.querySelectorAll('.close-modal-btn');
        bottomCloseBtns.forEach(btn => {
             btn.removeEventListener('click', () => closeModal(detailModal));
             btn.addEventListener('click', () => closeModal(detailModal));
        });
        // 點擊外部關閉
        window.addEventListener('click', (event) => { if (event.target == detailModal) closeModal(detailModal); });
    }
    
        // --- 初始載入 ---
        fetchGuestbookList(1, currentSort);
    });


    