// public/guestbook.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
    const messageListContainer = document.getElementById('message-list-container');
    const paginationContainer = document.getElementById('pagination-container');
    const sortControls = document.querySelector('.sort-controls');
    // 發表 Modal 元素
    const newPostBtn = document.getElementById('new-post-btn');
    const postModal = document.getElementById('post-modal');
    const closePostModalBtn = postModal?.querySelector('#close-post-modal-btn'); // 使用 ID 或特定 class
    const postModalForm = postModal?.querySelector('#post-message-form');
    const postModalStatus = postModal?.querySelector('#post-status');
    const postModalSubmitBtn = postModal?.querySelector('#submit-message-btn');
    const postModalCancelBtns = postModal?.querySelectorAll('.close-modal-btn'); // 所有關閉發表 Modal 的按鈕
   // const postEmojiTrigger = document.getElementById('post-emoji-trigger');
   const postModalContentInput = document.getElementById('modal-message-content');

    // 詳情 Modal 元素
    const detailModal = document.getElementById('message-detail-modal');
    const closeDetailModalBtn = detailModal?.querySelector('#close-detail-modal-btn'); // 右上角關閉按鈕 ID
    const detailModalMain = document.getElementById('modal-message-detail-main');
    const detailModalReplyList = document.getElementById('modal-reply-list-container');
    const detailModalReplyForm = document.getElementById('modal-reply-form');
    const modalReplyFormLabel = detailModalReplyForm?.querySelector('label[for="modal-reply-content"]');
    const modalReplyFormContent = document.getElementById('modal-reply-content');
    const modalReplyFormAuthor = document.getElementById('modal-reply-author-name');
    const modalReplyStatus = document.getElementById('modal-reply-status');
    const modalSubmitReplyBtn = document.getElementById('modal-submit-reply-btn');
    const detailModalCancelBtns = detailModal?.querySelectorAll('.close-modal-btn'); // 詳情 Modal 內所有關閉按鈕 (可能包含底部的)
    //const replyEmojiTrigger = document.getElementById('reply-emoji-trigger'); // 詳情 Modal 內回覆的 Emoji 按鈕

    // --- 狀態變數 ---
    let currentPage = 1;
    let currentSort = 'latest';
    let isPostingCooldown = false;
    let isReplyingCooldown = false;
    let currentDetailMessageId = null;
    let currentParentReplyId = null;

    // --- 輔助函數 ---
    function openModal(modalElement) { if (modalElement) modalElement.style.display = 'flex'; }
    function closeModal(modalElement) { if (modalElement) modalElement.style.display = 'none'; }
    function updateSortButtonsActiveState(activeSort) {
        if (!sortControls) return;
        sortControls.querySelectorAll('.sort-btn').forEach(button => {
            button.classList.toggle('active', button.dataset.sort === activeSort);
        });
    }
    function insertTextAtCursor(textarea, text) {
        if (!textarea) return; const start = textarea.selectionStart; const end = textarea.selectionEnd; const value = textarea.value;
        textarea.value = value.substring(0, start) + text + value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + text.length; textarea.focus();
    }

    // --- 數據獲取與渲染 ---
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
            renderPagination(data.totalPages, data.currentPage);
        } catch (error) { console.error('獲取留言列表失敗:', error); messageListContainer.innerHTML = `<p style="color: red;">無法載入留言列表：${error.message}</p>`; }
    }

    function renderMessageList(messages) {
        if (!messageListContainer) return;
        messageListContainer.innerHTML = '';
        if (!messages || messages.length === 0) { const p = document.createElement('p'); p.textContent = '目前沒有留言。'; messageListContainer.appendChild(p); return; }
        messages.forEach(msg => {
            const messageItemDiv = document.createElement('div'); messageItemDiv.className = 'message-list-item';
            const authorSpan = document.createElement('span'); authorSpan.className = 'author'; authorSpan.textContent = msg.author_name || '匿名';
            const timestampSpan = document.createElement('span'); timestampSpan.className = 'timestamp'; const activityDate = new Date(msg.last_activity_at).toLocaleString('zh-TW'); timestampSpan.textContent = ` (${activityDate})`;
            const previewDiv = document.createElement('div'); previewDiv.className = 'content-preview view-detail-modal-btn'; previewDiv.dataset.messageId = msg.id; previewDiv.textContent = msg.content_preview || '(無內容預覽)'; previewDiv.style.cursor = 'pointer'; previewDiv.style.display = 'block'; previewDiv.style.margin = '0.5rem 0'; previewDiv.style.color = '#555'; previewDiv.style.lineHeight = '1.6';
            const metaSpan = document.createElement('span'); 
            metaSpan.className = 'meta view-detail-modal-btn'; 
            metaSpan.dataset.messageId = msg.id; 
            metaSpan.textContent = `回覆(${msg.reply_count || 0})`; 
            metaSpan.style.cursor = 'pointer'; 
            metaSpan.style.color = '#007bff'; 
            metaSpan.style.textDecoration = 'underline';



            

            const viewSpan = document.createElement('span'); viewSpan.className = 'meta'; viewSpan.textContent = `瀏覽(${msg.view_count || 0})`; viewSpan.style.marginLeft = '1rem';




 // --- 【★ 關鍵修正：重新加入這一段 ★】 ---
 const likeContainer = document.createElement('span'); // 創建包裹容器
 likeContainer.className = 'meta';
 likeContainer.style.marginLeft = '1rem';

 const likeButton = document.createElement('button'); // 創建按鈕
 likeButton.className = 'like-btn message-like-btn';
 likeButton.dataset.id = msg.id;
 likeButton.innerHTML = '❤️'; // 使用 Emoji 或圖標

 const likeCountSpan = document.createElement('span'); // 創建計數 span
 likeCountSpan.id = `message-like-count-${msg.id}`; // ID 用於更新計數
 likeCountSpan.textContent = ` ${msg.like_count || 0}`;
 likeCountSpan.style.fontSize = '0.9em'; // 數字樣式
 likeCountSpan.style.color = '#555';
 likeCountSpan.style.marginLeft = '3px';

 likeContainer.appendChild(likeButton); // 將按鈕加入容器
 likeContainer.appendChild(likeCountSpan); // 將計數加入容器
 // --- 【★ 修正結束 ★】 ---



            const likeSpan = document.createElement('span'); likeSpan.className = 'meta'; likeSpan.innerHTML = ` ❤️ ${msg.like_count || 0}`; likeSpan.style.marginLeft = '1rem';
           // const detailButton = document.createElement('button'); detailButton.className = 'btn btn-link btn-sm view-detail-modal-btn'; detailButton.dataset.messageId = msg.id; detailButton.textContent = '[查看詳情]'; detailButton.style.marginLeft = '1rem';
         
         
           


 // --- 組合元素 ---
 messageItemDiv.appendChild(authorSpan);
 messageItemDiv.appendChild(document.createTextNode(' '));
 messageItemDiv.appendChild(timestampSpan);
 messageItemDiv.appendChild(previewDiv);
 messageItemDiv.appendChild(metaSpan);      // 回覆數
 messageItemDiv.appendChild(viewSpan);      // 瀏覽數
 messageItemDiv.appendChild(likeContainer); // 添加 likeContainer



       
           messageListContainer.appendChild(messageItemDiv);
           const hr = document.createElement('hr'); 
           messageListContainer.appendChild(hr);


        });
    }

    function renderPagination(totalPages, currentPage) {
        if (!paginationContainer || totalPages <= 1) { paginationContainer.innerHTML = ''; return; }; paginationContainer.innerHTML = '';
        const prevButton = document.createElement('button'); prevButton.className = 'page-btn'; prevButton.dataset.page = currentPage - 1; prevButton.disabled = (currentPage === 1); prevButton.innerHTML = '<< 上一頁'; paginationContainer.appendChild(prevButton);
        const maxPagesToShow = 5; let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2)); let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1); if (endPage - startPage + 1 < maxPagesToShow) startPage = Math.max(1, endPage - maxPagesToShow + 1);
        if (startPage > 1) { const span = document.createElement('span'); span.textContent = '...'; paginationContainer.appendChild(span); }
        for (let i = startPage; i <= endPage; i++) { const pageButton = document.createElement('button'); pageButton.className = 'page-btn'; pageButton.dataset.page = i; pageButton.disabled = (i === currentPage); if (i === currentPage) pageButton.classList.add('current-page'); pageButton.textContent = i; paginationContainer.appendChild(pageButton); }
        if (endPage < totalPages) { const span = document.createElement('span'); span.textContent = '...'; paginationContainer.appendChild(span); }
        const nextButton = document.createElement('button'); nextButton.className = 'page-btn'; nextButton.dataset.page = currentPage + 1; nextButton.disabled = (currentPage === totalPages); nextButton.innerHTML = '下一頁 >>'; paginationContainer.appendChild(nextButton);
    }

    // --- 詳情 Modal 相關函數 ---
    async function fetchAndRenderDetailModal(messageId) {
        if (!detailModal || !detailModalMain || !detailModalReplyList) { console.error("錯誤：詳情 Modal 或其內部容器未找到！"); return; }
        currentDetailMessageId = messageId;
        detailModalMain.innerHTML = '<p>正在載入留言內容...</p>'; detailModalReplyList.innerHTML = '<p>正在載入回覆...</p>';
        if (detailModalReplyForm) detailModalReplyForm.reset(); if (modalReplyStatus) modalReplyStatus.textContent = ''; if (modalReplyFormLabel) modalReplyFormLabel.textContent = '回覆內容 (必填):'; currentParentReplyId = null;
        openModal(detailModal);
        fetch(`/api/guestbook/message/${messageId}/view`, { method: 'POST' }).catch(err => console.warn('記錄瀏覽數錯誤:', err));
        try {
            const response = await fetch(`/api/guestbook/message/${messageId}`);
            if (!response.ok) { if (response.status === 404) throw new Error('找不到指定的留言。'); let errorMsg = `HTTP 錯誤 ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {} throw new Error(`無法獲取留言詳情 (${errorMsg})`); }
            const data = await response.json(); if (!data || !data.message) throw new Error('API 返回的資料格式不正確。');
            renderModalMessageDetail(data.message); renderModalNestedReplyList(data.replies || []);
        } catch (error) { console.error('載入詳情 Modal 失敗:', error); detailModalMain.innerHTML = `<p style="color: red;">無法載入詳情：${error.message}</p>`; detailModalReplyList.innerHTML = ''; }
    }

    function renderModalMessageDetail(message) {
        if (!detailModalMain || !message) return; detailModalMain.innerHTML = '';
        const titleH2 = document.createElement('h2'); titleH2.textContent = `留言 #${message.id}`; titleH2.style.marginTop = '0';
        const authorP = document.createElement('p'); const authorSpan = document.createElement('span'); authorSpan.className = 'author'; authorSpan.textContent = message.author_name || '匿名'; const timestampSpan = document.createElement('span'); timestampSpan.className = 'timestamp'; const createDate = new Date(message.created_at).toLocaleString('zh-TW'); timestampSpan.textContent = ` (${createDate})`; authorP.appendChild(authorSpan); authorP.appendChild(timestampSpan);
        const hr = document.createElement('hr');
        const contentDiv = document.createElement('div'); contentDiv.className = 'message-content'; contentDiv.textContent = message.content || ''; contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.style.wordWrap = 'break-word'; contentDiv.style.padding = '10px 0';
        const metaP = document.createElement('p'); metaP.style.fontSize = '0.9em'; metaP.style.color = '#777'; metaP.style.marginTop = '15px'; 
        metaP.appendChild(document.createTextNode(`回覆: ${message.reply_count || 0} | 瀏覽: ${message.view_count || 0}`));
        



         // --- 【★ 重新加入 ★】按讚按鈕和計數 ---
    metaP.appendChild(document.createTextNode(' | ')); // 分隔符

    const likeButton = document.createElement('button');
    likeButton.className = 'like-btn message-like-btn'; // 使用正確 class
    likeButton.dataset.id = message.id;
    likeButton.innerHTML = '❤️';

    const likeCountSpan = document.createElement('span');
    likeCountSpan.id = `message-like-count-${message.id}`; // ID 用於更新
    likeCountSpan.textContent = ` ${message.like_count || 0}`;
    likeCountSpan.style.marginLeft = '5px'; // 與按鈕間隔

    metaP.appendChild(likeButton);
    metaP.appendChild(likeCountSpan);
    // --- 按讚部分結束 ---
        // 【★ 修正 ★】移除按讚按鈕
        // const likeButton = ... (移除)
        // const likeCountSpan = ... (移除)
        // metaP.appendChild(likeButton); (移除)
        // metaP.appendChild(likeCountSpan); (移除)
        detailModalMain.appendChild(titleH2); detailModalMain.appendChild(authorP); detailModalMain.appendChild(hr); detailModalMain.appendChild(contentDiv); detailModalMain.appendChild(metaP);
    }

    function renderModalNestedReplyList(replies) {
        if (!detailModalReplyList) { console.error("錯誤：找不到 Modal 內的回覆列表容器 #modal-reply-list-container"); return; }
        detailModalReplyList.innerHTML = '';
        if (!replies || replies.length === 0) { const p = document.createElement('p'); p.textContent = '目前沒有回覆。'; detailModalReplyList.appendChild(p); return; }
        const repliesByParentId = new Map(); replies.forEach(reply => { const parentId = reply.parent_reply_id === null ? 'root' : reply.parent_reply_id; if (!repliesByParentId.has(parentId)) repliesByParentId.set(parentId, []); repliesByParentId.get(parentId).push(reply); });
        const floorMap = new Map(); const rootReplies = repliesByParentId.get('root') || []; rootReplies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); rootReplies.forEach((reply, index) => { floorMap.set(reply.id, `B${index + 1}`); });
        function renderRepliesRecursive(parentId, level = 0) {
            const children = repliesByParentId.get(parentId === 'root' ? 'root' : parentId) || []; children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); 
            if (children.length === 0) return;






            children.forEach((reply) => { 
                let floorNumber = ''; if (level === 0) { floorNumber = floorMap.get(reply.id); } else { const parentFloor = floorMap.get(parentId); if (parentFloor) { const siblings = repliesByParentId.get(parentId) || []; const replyIndex = siblings.findIndex(r => r.id === reply.id); floorNumber = `${parentFloor}-${replyIndex + 1}`; floorMap.set(reply.id, floorNumber); } else { floorNumber = '?'; console.warn(`找不到父級 ${parentId} 的樓層號`); } } if (!floorNumber) floorNumber = "?";
                const replyDiv = document.createElement('div'); replyDiv.className = reply.is_admin_reply ? 'reply-item admin-reply' : 'reply-item'; if (level > 0) { replyDiv.classList.add('nested'); replyDiv.style.marginLeft = `${level * 25}px`; } replyDiv.dataset.replyId = reply.id; replyDiv.dataset.floor = floorNumber;
                const metaP = document.createElement('p'); metaP.style.marginBottom = '5px'; const floorSpan = document.createElement('span'); floorSpan.className = 'reply-floor'; floorSpan.textContent = floorNumber; const authorSpan = document.createElement('span'); authorSpan.className = 'author'; authorSpan.textContent = reply.is_admin_reply ? `[${reply.admin_identity_name || '管理員'}]` : (reply.author_name || '匿名'); const timestampSpan = document.createElement('span'); timestampSpan.className = 'timestamp'; timestampSpan.textContent = ` (${new Date(reply.created_at).toLocaleString('zh-TW')})`; metaP.appendChild(floorSpan); metaP.appendChild(authorSpan); metaP.appendChild(timestampSpan);
                const contentDiv = document.createElement('div'); contentDiv.className = 'reply-content'; contentDiv.textContent = reply.content || ''; contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.style.wordWrap = 'break-word'; contentDiv.style.marginBottom = '5px';
               
                const actionsDiv = document.createElement('div'); actionsDiv.className = 'reply-item-actions';
              
                
                const replyButton = document.createElement('button'); replyButton.className = 'btn btn-link btn-sm reply-action-btn'; replyButton.textContent = '回覆'; replyButton.dataset.targetId = reply.id; replyButton.dataset.targetFloor = floorNumber;

                
                const quoteButton = document.createElement('button'); quoteButton.className = 'btn btn-link btn-sm quote-action-btn'; quoteButton.textContent = '引用'; quoteButton.dataset.targetId = reply.id; quoteButton.dataset.targetFloor = floorNumber; quoteButton.dataset.targetContent = reply.content || ''; quoteButton.style.marginLeft = '10px';


                  

             
                

  // --- 【★ 修正點 2 ★】按讚按鈕使用 reply 變數 ---
  const likeContainer = document.createElement('span'); likeContainer.style.marginLeft = '10px';
  const likeButton = document.createElement('button');
  likeButton.className = 'like-btn reply-like-btn'; // class 正確
  likeButton.dataset.id = reply.id; // 使用 reply.id
  likeButton.innerHTML = '❤️';
  const likeCountSpan = document.createElement('span');
  likeCountSpan.id = `reply-like-count-${reply.id}`; // 使用 reply.id
  likeCountSpan.textContent = ` ${reply.like_count || 0}`; // 使用 reply.like_count
  likeCountSpan.style.fontSize = '0.9em'; likeCountSpan.style.color = '#555'; likeCountSpan.style.marginLeft='3px';
  likeContainer.appendChild(likeButton); likeContainer.appendChild(likeCountSpan);
  // --- 修正結束 ---




                actionsDiv.appendChild(replyButton); 
                actionsDiv.appendChild(quoteButton); 
                actionsDiv.appendChild(likeContainer);
                replyDiv.appendChild(metaP); 
                replyDiv.appendChild(contentDiv); 
                replyDiv.appendChild(actionsDiv);


                detailModalReplyList.appendChild(replyDiv); const hr = document.createElement('hr'); hr.style.borderTop = '1px dashed #eee'; hr.style.margin = '10px 0'; detailModalReplyList.appendChild(hr);
                renderRepliesRecursive(reply.id, level + 1);
            });
        }
        renderRepliesRecursive('root', 0);
    }

   

    // --- 事件監聽：打開新留言 Modal ---
    if (newPostBtn && postModal) {
        newPostBtn.addEventListener('click', () => {
            if(postModalForm) postModalForm.reset(); if(postModalStatus) postModalStatus.textContent = ''; if(postModalSubmitBtn) { postModalSubmitBtn.disabled = false; postModalSubmitBtn.textContent = '送出留言'; } isPostingCooldown = false;
            openModal(postModal);
        });
    } else { console.error("錯誤：發表新留言按鈕或 Modal 未找到！"); }

    // --- 事件監聽：關閉 Modal ---
    [postModal, detailModal].forEach(modal => {
        if (modal) {
            const closeBtns = modal.querySelectorAll('.close-modal-btn'); // 所有帶 class 的關閉按鈕
            closeBtns.forEach(btn => btn.addEventListener('click', () => closeModal(modal)));
            const specificCloseBtn = modal.querySelector('#close-' + modal.id + '-btn'); // 右上角 ID 按鈕
            if (specificCloseBtn && !specificCloseBtn.classList.contains('close-modal-btn')) { // 避免重複綁定
                specificCloseBtn.addEventListener('click', () => closeModal(modal));
            }
            window.addEventListener('click', (event) => { if (event.target == modal) closeModal(modal); });
        }
    });

    
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

    // --- 處理按讚 ---
    let likeId = null;       // 【★ 檢查點 ★】變數名是 likeId
    let likeApiUrl = null;   // 【★ 檢查點 ★】變數名是 likeApiUrl
    let countSpanSelector = null;
    let containerElement = null; // 【★ 新增 ★】用於限定搜尋範圍


        if (target.matches('.message-like-btn')) {
            likeId = target.dataset.id;
            likeApiUrl = `/api/guestbook/message/${likeId}/like`;
            countSpanSelector = `#message-like-count-${likeId}`;
            // **關鍵修正**：判斷是在 Modal 內還是列表內
            containerElement = target.closest('#message-detail-modal') || document;
        } else if (target.matches('.reply-like-btn')) {
            likeId = target.dataset.id;
            likeApiUrl = `/api/guestbook/replies/${likeId}/like`;
            countSpanSelector = `#reply-like-count-${likeId}`;
            // 回覆按鈕一定在 Modal 內
            containerElement = detailModal;
        }

        if (likeApiUrl && likeId && countSpanSelector && containerElement) {
            target.disabled = true; target.style.opacity = '0.5';
            try {
                const response = await fetch(likeApiUrl, { method: 'POST' });
                if (!response.ok) { const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` })); throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`); }
                const data = await response.json();
                // **關鍵修正**：在正確的範圍內尋找 countSpan
                const countSpan = containerElement.querySelector(countSpanSelector);
                if (countSpan) {
                    countSpan.textContent = ` ${data.like_count}`;
                    console.log(`Like count for ${countSpanSelector} updated to ${data.like_count} within`, containerElement);
                } else {
                     console.warn(`Count span '${countSpanSelector}' not found within`, containerElement);
                }
                setTimeout(() => { target.disabled = false; target.style.opacity = '1'; }, 1000);
            } catch (error) { console.error('按讚失敗:', error); alert(`按讚失敗：${error.message}`); target.disabled = false; target.style.opacity = '1'; }
            return; // 處理完按讚，結束本次點擊處理
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
    

              
                 // --- 處理點擊列表項打開 Modal (如果在這處理的話) ---
                 const triggerElement = target.closest('.view-detail-modal-btn');
        if (triggerElement && messageListContainer && messageListContainer.contains(triggerElement)) {
            const messageId = triggerElement.dataset.messageId;
            if (messageId) {
                fetchAndRenderDetailModal(messageId);
                // 不需要 return，因為打開 Modal 不應阻止其他可能的冒泡事件
            }
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
    

 // --- 【★ 新增 ★】輔助函數：在光標處插入文本 ---
 function insertTextAtCursor(textarea, text) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    // 插入文本並更新 value
    textarea.value = value.substring(0, start) + text + value.substring(end);
    // 將光標移動到插入文本之後
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus(); // 重新聚焦到輸入框
}




        // --- 初始載入 ---
        fetchGuestbookList(1, currentSort);
    });


    