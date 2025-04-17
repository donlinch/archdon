// guestbook-new.js - 优化后的留言板 JavaScript

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素获取 ---
    const messageListContainer = document.getElementById('message-list-container');
    const paginationContainer = document.getElementById('pagination-container');
    const sortBtns = document.querySelectorAll('.sort-btn');
    const viewModeLinks = document.querySelectorAll('.view-mode-link');
    const backToTopButton = document.getElementById('back-to-top');
    
    // 发表 Modal 元素
    const newPostBtn = document.getElementById('new-post-btn');
    const postModal = document.getElementById('post-modal');
    const closePostModalBtn = document.getElementById('close-post-modal-btn');
    const postModalForm = document.getElementById('post-message-form');
    const postModalStatus = document.getElementById('post-status');
    const postModalSubmitBtn = document.getElementById('submit-message-btn');
    const postModalCancelBtns = postModal?.querySelectorAll('.close-modal-btn');
    const postModalContentInput = document.getElementById('modal-message-content');

    // 详情 Modal 元素
    const detailModal = document.getElementById('message-detail-modal');
    const closeDetailModalBtn = document.getElementById('close-detail-modal-btn');
    const detailModalMain = document.getElementById('modal-message-detail-main');
    const detailModalReplyList = document.getElementById('modal-reply-list-container');
    const detailModalReplyForm = document.getElementById('modal-reply-form');
    const modalReplyFormLabel = document.getElementById('modal-reply-form-label');
    const modalReplyFormContent = document.getElementById('modal-reply-content');
    const modalReplyFormAuthor = document.getElementById('modal-reply-author-name');
    const modalReplyStatus = document.getElementById('modal-reply-status');
    const modalSubmitReplyBtn = document.getElementById('modal-submit-reply-btn');
    const detailModalCancelBtns = detailModal?.querySelectorAll('.close-modal-btn');

    // --- 状态变量 ---
    let currentPage = 1;
    let currentSort = 'latest';
    let currentViewMode = 'grid'; // 默认为格状视图
    let isPostingCooldown = false;
    let isReplyingCooldown = false;
    let currentDetailMessageId = null;
    let currentParentReplyId = null;

    // --- 辅助函数 ---
    function openModal(modalElement) { 
        if (modalElement) {
            modalElement.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // 防止背景滚动
        }
    }
    
    function closeModal(modalElement) { 
        if (modalElement) {
            modalElement.style.display = 'none';
            document.body.style.overflow = ''; // 恢复滚动
        }
    }
    
    function updateSortButtonsActiveState(activeSort) {
        sortBtns.forEach(button => {
            button.classList.toggle('active', button.dataset.sort === activeSort);
        });
    }
    
    function updateViewModeActiveState(activeView) {
        viewModeLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.view === activeView);
        });
    }
    
    function insertTextAtCursor(textarea, text) {
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        
        textarea.value = value.substring(0, start) + text + value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
    }

    // --- 设置回到顶部按钮 ---
    function setupBackToTop() {
        if (!backToTopButton) return;
        
        // 监听滚动事件
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
        });
        
        // 点击回到顶部
        backToTopButton.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
    // --- 设置视图模式切换 ---
    function setupViewModeToggle() {
        if (!viewModeLinks.length) return;
        
        viewModeLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                // 移除所有链接的 active 类
                viewModeLinks.forEach(otherLink => otherLink.classList.remove('active'));
                // 为当前点击的链接添加 active 类
                link.classList.add('active');
                
                // 获取视图模式
                const viewMode = link.dataset.view;
                
                if (viewMode && viewMode !== currentViewMode) {
                    currentViewMode = viewMode;
                    updateViewMode();
                    fetchGuestbookList(currentPage, currentSort); // 重新加载留言列表
                }
            });
        });
    }
    
    // --- 更新视图模式 ---
    function updateViewMode() {
        if (!messageListContainer) return;
        
        if (currentViewMode === 'grid') {
            messageListContainer.className = 'messages-grid';
        } else if (currentViewMode === 'list') {
            messageListContainer.className = 'messages-list';
        }
    }

    // --- 数据获取与渲染 ---
    async function fetchGuestbookList(page = 1, sort = 'latest') {
        if (!messageListContainer || !paginationContainer) return;
        
        messageListContainer.innerHTML = '<p>正在載入留言...</p>';
        paginationContainer.innerHTML = '';
        
        currentPage = page;
        currentSort = sort;
        
        try {
            const response = await fetch(`/api/guestbook?page=${page}&limit=10&sort=${sort}`);
            if (!response.ok) throw new Error(`無法獲取留言列表 (HTTP ${response.status})`);
            
            const data = await response.json();

            updateSortButtonsActiveState(data.sort || 'latest');
            
            // 根据当前视图模式渲染留言列表
            if (currentViewMode === 'grid') {
                renderMessagesAsGrid(data.messages);
            } else {
                renderMessagesAsList(data.messages);
            }
            
            renderPagination(data.totalPages, data.currentPage);
        } catch (error) {
            console.error('獲取留言列表失敗:', error);
            messageListContainer.innerHTML = `<p style="color: red;">無法載入留言列表：${error.message}</p>`;
        }
    }

    // --- 以格状视图渲染留言 ---
    function renderMessagesAsGrid(messages) {
        if (!messageListContainer) return;
        
        messageListContainer.innerHTML = '';
        
        if (!messages || messages.length === 0) {
            messageListContainer.innerHTML = '<p>目前沒有留言。成為第一個留言的人吧！</p>';
            return;
        }
        
        messages.forEach((msg, index) => {
            const messageCard = document.createElement('div');
            messageCard.className = 'message-card';
            messageCard.dataset.messageId = msg.id;
            
            const authorSpan = document.createElement('span');
            authorSpan.className = 'author';
            authorSpan.textContent = msg.author_name || '匿名';
            
            // 根据是否是管理员发帖添加样式
            if (msg.is_admin_post === true) {
                authorSpan.classList.add('admin-author');
                const badge = document.createElement('span');
                badge.textContent = ' [管理員]';
                badge.style.fontSize = '0.8em';
                badge.style.color = '#C07000';
                authorSpan.appendChild(badge);
            }
            
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'timestamp';
            const activityDate = new Date(msg.last_activity_at).toLocaleString('zh-TW');
            timestampSpan.textContent = ` (${activityDate})`;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'content-preview';
            contentDiv.textContent = msg.content_preview || '(無內容預覽)';
            
            const metaContainer = document.createElement('div');
            metaContainer.className = 'message-meta-container';
            
            const replySpan = document.createElement('span');
            replySpan.className = 'meta';
            replySpan.innerHTML = `<i>💬</i> ${msg.reply_count || 0}`;
            
            const viewSpan = document.createElement('span');
            viewSpan.className = 'meta';
            viewSpan.innerHTML = `<i>👁️</i> ${msg.view_count || 0}`;
            
            const likeContainer = document.createElement('span');
            likeContainer.className = 'meta';
            
            const likeButton = document.createElement('button');
            likeButton.className = 'like-btn message-like-btn';
            likeButton.dataset.id = msg.id;
            likeButton.innerHTML = '❤️';
            
            const likeCountSpan = document.createElement('span');
            likeCountSpan.id = `message-like-count-${msg.id}`;
            likeCountSpan.textContent = ` ${msg.like_count || 0}`;
            
            likeContainer.appendChild(likeButton);
            likeContainer.appendChild(likeCountSpan);
            
            metaContainer.appendChild(replySpan);
            metaContainer.appendChild(viewSpan);
            metaContainer.appendChild(likeContainer);
            
            messageCard.appendChild(authorSpan);
            messageCard.appendChild(document.createTextNode(' '));
            messageCard.appendChild(timestampSpan);
            messageCard.appendChild(contentDiv);
            messageCard.appendChild(metaContainer);
            
            messageListContainer.appendChild(messageCard);
            
            // 添加动画效果
            setTimeout(() => {
                messageCard.classList.add('animate');
            }, 50 * index);
        });
        
        // 为所有留言卡片添加点击事件
        setupMessageCardEvents();
    }

    // --- 以列表视图渲染留言 ---
    function renderMessagesAsList(messages) {
        if (!messageListContainer) return;
        
        messageListContainer.innerHTML = '';
        
        if (!messages || messages.length === 0) {
            messageListContainer.innerHTML = '<p>目前沒有留言。成為第一個留言的人吧！</p>';
            return;
        }
        
        messages.forEach((msg, index) => {
            const messageItem = document.createElement('div');
            messageItem.className = 'message-list-item';
            messageItem.dataset.messageId = msg.id;
            
            const headerDiv = document.createElement('div');
            headerDiv.style.display = 'flex';
            headerDiv.style.justifyContent = 'space-between';
            headerDiv.style.marginBottom = '8px';
            
            const authorInfoDiv = document.createElement('div');
            
            const authorSpan = document.createElement('span');
            authorSpan.className = 'author';
            authorSpan.textContent = msg.author_name || '匿名';
            
            // 根据是否是管理员发帖添加样式
            if (msg.is_admin_post === true) {
                authorSpan.classList.add('admin-author');
                const badge = document.createElement('span');
                badge.textContent = ' [管理員]';
                badge.style.fontSize = '0.8em';
                badge.style.color = '#C07000';
                authorSpan.appendChild(badge);
            }
            
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'timestamp';
            const activityDate = new Date(msg.last_activity_at).toLocaleString('zh-TW');
            timestampSpan.textContent = ` (${activityDate})`;
            
            authorInfoDiv.appendChild(authorSpan);
            authorInfoDiv.appendChild(timestampSpan);
            
            const metaInfoDiv = document.createElement('div');
            metaInfoDiv.style.display = 'flex';
            metaInfoDiv.style.gap = '10px';
            
            const replySpan = document.createElement('span');
            replySpan.className = 'meta';
            replySpan.innerHTML = `<i>💬</i> ${msg.reply_count || 0}`;
            
            const viewSpan = document.createElement('span');
            viewSpan.className = 'meta';
            viewSpan.innerHTML = `<i>👁️</i> ${msg.view_count || 0}`;
            
            const likeContainer = document.createElement('span');
            likeContainer.className = 'meta';
            
            const likeButton = document.createElement('button');
            likeButton.className = 'like-btn message-like-btn';
            likeButton.dataset.id = msg.id;
            likeButton.innerHTML = '❤️';
            
            const likeCountSpan = document.createElement('span');
            likeCountSpan.id = `message-like-count-${msg.id}`;
            likeCountSpan.textContent = ` ${msg.like_count || 0}`;
            
            likeContainer.appendChild(likeButton);
            likeContainer.appendChild(likeCountSpan);
            
            metaInfoDiv.appendChild(replySpan);
            metaInfoDiv.appendChild(viewSpan);
            metaInfoDiv.appendChild(likeContainer);
            
            headerDiv.appendChild(authorInfoDiv);
            headerDiv.appendChild(metaInfoDiv);
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'content-preview';
            contentDiv.textContent = msg.content_preview || '(無內容預覽)';
            
            const viewDetailsBtn = document.createElement('button');
            viewDetailsBtn.className = 'btn btn-primary';
            viewDetailsBtn.textContent = '查看詳情';
            viewDetailsBtn.style.marginTop = '10px';
            viewDetailsBtn.style.alignSelf = 'flex-end';
            
            messageItem.appendChild(headerDiv);
            messageItem.appendChild(contentDiv);
            messageItem.appendChild(viewDetailsBtn);
            
            messageListContainer.appendChild(messageItem);
            
            // 添加动画效果
            setTimeout(() => {
                messageItem.classList.add('animate');
            }, 50 * index);
        });
        
        // 为所有留言项添加点击事件
        setupMessageCardEvents();
    }

    // --- 渲染分页控件 ---
    function renderPagination(totalPages, currentPage) {
        if (!paginationContainer || totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        paginationContainer.innerHTML = '';
        
        const prevButton = document.createElement('button');
        prevButton.className = 'page-btn';
        prevButton.dataset.page = currentPage - 1;
        prevButton.disabled = (currentPage === 1);
        prevButton.innerHTML = '<< 上一頁';
        paginationContainer.appendChild(prevButton);
        
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        if (startPage > 1) {
            const span = document.createElement('span');
            span.textContent = '...';
            paginationContainer.appendChild(span);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = 'page-btn';
            pageButton.dataset.page = i;
            pageButton.disabled = (i === currentPage);
            
            if (i === currentPage) {
                pageButton.classList.add('current-page');
            }
            
            pageButton.textContent = i;
            paginationContainer.appendChild(pageButton);
        }
        
        if (endPage < totalPages) {
            const span = document.createElement('span');
            span.textContent = '...';
            paginationContainer.appendChild(span);
        }
        
        const nextButton = document.createElement('button');
        nextButton.className = 'page-btn';
        nextButton.dataset.page = currentPage + 1;
        nextButton.disabled = (currentPage === totalPages);
        nextButton.innerHTML = '下一頁 >>';
        paginationContainer.appendChild(nextButton);
    }

    // --- 设置留言卡片点击事件 ---
    function setupMessageCardEvents() {
        // 处理卡片点击
        document.querySelectorAll('.message-card, .message-list-item').forEach(card => {
            card.addEventListener('click', function(e) {
                // 如果点击的是按赞按钮，让按钮的事件处理器处理
                if (e.target.classList.contains('like-btn') || e.target.parentElement.classList.contains('like-btn')) {
                    return;
                }
                
                const messageId = this.dataset.messageId;
                if (messageId) {
                    fetchAndRenderDetailModal(messageId);
                }
            });
            
            // 添加指针光标样式，表示可点击
            card.style.cursor = 'pointer';
        });
        
        // 单独处理"查看详情"按钮点击
        document.querySelectorAll('.message-list-item .btn-primary').forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation(); // 防止事件冒泡
                
                const messageItem = this.closest('.message-list-item');
                const messageId = messageItem.dataset.messageId;
                
                if (messageId) {
                    fetchAndRenderDetailModal(messageId);
                }
            });
        });
    }

    // --- 详情 Modal 相关函数 ---
    async function fetchAndRenderDetailModal(messageId) {
        if (!detailModal || !detailModalMain || !detailModalReplyList) {
            console.error("錯誤：詳情 Modal 或其內部容器未找到！");
            return;
        }
        
        currentDetailMessageId = messageId;
        detailModalMain.innerHTML = '<p>正在載入留言內容...</p>';
        detailModalReplyList.innerHTML = '<p>正在載入回覆...</p>';
        
        if (detailModalReplyForm) detailModalReplyForm.reset();
        if (modalReplyStatus) modalReplyStatus.textContent = '';
        if (modalReplyFormLabel) modalReplyFormLabel.textContent = '回覆內容 (必填):';
        
        currentParentReplyId = null;
        openModal(detailModal);
        
        // 记录浏览数
        fetch(`/api/guestbook/message/${messageId}/view`, { method: 'POST' })
            .catch(err => console.warn('記錄瀏覽數錯誤:', err));
        
        try {
            const response = await fetch(`/api/guestbook/message/${messageId}`);
            
            if (!response.ok) {
                if (response.status === 404) throw new Error('找不到指定的留言。');
                
                let errorMsg = `HTTP 錯誤 ${response.status}`;
                try {
                    const d = await response.json();
                    errorMsg = d.error || errorMsg;
                } catch {}
                
                throw new Error(`無法獲取留言詳情 (${errorMsg})`);
            }
            
            const data = await response.json();
            
            if (!data || !data.message) throw new Error('API 返回的資料格式不正確。');
            
            renderModalMessageDetail(data.message);
            renderModalNestedReplyList(data.replies || []);
        } catch (error) {
            console.error('載入詳情 Modal 失敗:', error);
            detailModalMain.innerHTML = `<p style="color: red;">無法載入詳情：${error.message}</p>`;
            detailModalReplyList.innerHTML = '';
        }
    }

    // --- 渲染 Modal 中的留言详情 ---
    function renderModalMessageDetail(message) {
        if (!detailModalMain || !message) return;
        
        detailModalMain.innerHTML = '';
        
        const authorP = document.createElement('p');
        authorP.style.display = 'flex';
        authorP.style.justifyContent = 'space-between';
        authorP.style.alignItems = 'center';
        
        const authorInfoDiv = document.createElement('div');
        
        const authorSpan = document.createElement('span');
        authorSpan.className = 'author';
        authorSpan.textContent = message.author_name || '匿名';
        
        // 根据是否是管理员发帖添加样式
        if (message.is_admin_post === true) {
            authorSpan.classList.add('admin-author');
            const badge = document.createElement('span');
            badge.textContent = ' [管理員]';
            badge.style.fontSize = '0.8em';
            badge.style.color = '#C07000';
            authorSpan.appendChild(badge);
        }
        
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'timestamp';
        const createDate = new Date(message.created_at).toLocaleString('zh-TW');
        timestampSpan.textContent = ` (${createDate})`;
        
        authorInfoDiv.appendChild(authorSpan);
        authorInfoDiv.appendChild(timestampSpan);
        
        const metaInfoDiv = document.createElement('div');
        
        metaInfoDiv.style.display = 'flex';
        metaInfoDiv.style.gap = '10px';
        metaInfoDiv.style.alignItems = 'center';
        
        const viewCountSpan = document.createElement('span');
        viewCountSpan.className = 'meta';
        viewCountSpan.innerHTML = `<i>👁️</i> ${message.view_count || 0}`;
        
        const replyCountSpan = document.createElement('span');
        replyCountSpan.className = 'meta';
        replyCountSpan.innerHTML = `<i>💬</i> ${message.reply_count || 0}`;
        
        const likeContainer = document.createElement('span');
        likeContainer.className = 'meta';
        
        const likeButton = document.createElement('button');
        likeButton.className = 'like-btn message-like-btn';
        likeButton.dataset.id = message.id;
        likeButton.innerHTML = '❤️';
        
        const likeCountSpan = document.createElement('span');
        likeCountSpan.id = `message-like-count-${message.id}`;
        likeCountSpan.textContent = ` ${message.like_count || 0}`;
        
        likeContainer.appendChild(likeButton);
        likeContainer.appendChild(likeCountSpan);
        
        metaInfoDiv.appendChild(viewCountSpan);
        metaInfoDiv.appendChild(replyCountSpan);
        metaInfoDiv.appendChild(likeContainer);
        
        authorP.appendChild(authorInfoDiv);
        authorP.appendChild(metaInfoDiv);
        
        const hr = document.createElement('hr');
        hr.style.margin = '15px 0';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message.content || '';
        contentDiv.style.whiteSpace = 'pre-wrap';
        contentDiv.style.wordWrap = 'break-word';
        contentDiv.style.padding = '15px';
        contentDiv.style.background = '#f9f9f9';
        contentDiv.style.borderRadius = '8px';
        contentDiv.style.border = '1px solid #eee';
        contentDiv.style.margin = '10px 0 15px';
        contentDiv.style.lineHeight = '1.6';
        
        detailModalMain.appendChild(authorP);
        detailModalMain.appendChild(hr);
        detailModalMain.appendChild(contentDiv);
    }

    // --- 渲染 Modal 中的嵌套回复列表 ---
    function renderModalNestedReplyList(replies) {
        if (!detailModalReplyList) {
            console.error("錯誤：找不到 Modal 內的回覆列表容器 #modal-reply-list-container");
            return;
        }
        
        detailModalReplyList.innerHTML = '';
        
        if (!replies || replies.length === 0) {
            const p = document.createElement('p');
            p.textContent = '目前沒有回覆。';
            p.style.margin = '15px 0';
            p.style.color = '#666';
            p.style.textAlign = 'center';
            detailModalReplyList.appendChild(p);
            return;
        }
        
        // 计算回复楼层
        const repliesByParentId = new Map();
        
        replies.forEach(reply => {
            const parentId = reply.parent_reply_id === null ? 'root' : reply.parent_reply_id;
            
            if (!repliesByParentId.has(parentId)) {
                repliesByParentId.set(parentId, []);
            }
            
            repliesByParentId.get(parentId).push(reply);
        });
        
        // 计算根回复的楼层号
        const floorMap = new Map();
        const rootReplies = repliesByParentId.get('root') || [];
        
        rootReplies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        rootReplies.forEach((reply, index) => {
            floorMap.set(reply.id, `B${index + 1}`);
        });
        
        // 递归渲染回复
        function renderRepliesRecursive(parentId, level = 0) {
            const children = repliesByParentId.get(parentId === 'root' ? 'root' : parentId) || [];
            
            children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            
            if (children.length === 0) return;
            
            children.forEach((reply) => {
                // 计算当前回复的楼层号
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
                    } else {
                        floorNumber = '?';
                        console.warn(`找不到父級 ${parentId} 的樓層號`);
                    }
                }
                
                if (!floorNumber) floorNumber = "?";
                
                // 创建回复元素
                const replyDiv = document.createElement('div');
                replyDiv.className = reply.is_admin_reply ? 'reply-item admin-reply' : 'reply-item';
                
                // 为嵌套回复添加样式
                if (level > 0) {
                    replyDiv.classList.add('nested');
                    replyDiv.style.marginLeft = `${level * 25}px`;
                    replyDiv.style.marginTop = '12px';
                }
                
                replyDiv.dataset.replyId = reply.id;
                replyDiv.dataset.floor = floorNumber;
                
                // 回复信息
                const metaP = document.createElement('p');
                metaP.style.marginBottom = '5px';
                metaP.style.display = 'flex';
                metaP.style.alignItems = 'center';
                
                const floorSpan = document.createElement('span');
                floorSpan.className = 'reply-floor';
                floorSpan.textContent = floorNumber;
                
                const authorSpan = document.createElement('span');
                authorSpan.className = 'author';
                authorSpan.style.marginLeft = '8px';
                
                if (reply.is_admin_reply) {
                    authorSpan.textContent = `[${reply.admin_identity_name || '管理員'}]`;
                    authorSpan.style.color = '#C07000';
                } else {
                    authorSpan.textContent = reply.author_name || '匿名';
                }
                
                const timestampSpan = document.createElement('span');
                timestampSpan.className = 'timestamp';
                timestampSpan.textContent = ` (${new Date(reply.created_at).toLocaleString('zh-TW')})`;
                
                metaP.appendChild(floorSpan);
                metaP.appendChild(authorSpan);
                metaP.appendChild(timestampSpan);
                
                // 回复内容
                const contentDiv = document.createElement('div');
                contentDiv.className = 'reply-content';
                contentDiv.textContent = reply.content || '';
                contentDiv.style.whiteSpace = 'pre-wrap';
                contentDiv.style.wordWrap = 'break-word';
                contentDiv.style.marginBottom = '8px';
                contentDiv.style.lineHeight = '1.5';
                
                // 回复操作按钮
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'reply-item-actions';
                
                const replyButton = document.createElement('button');
                replyButton.className = 'btn btn-link btn-sm reply-action-btn';
                replyButton.textContent = '回覆';
                replyButton.dataset.targetId = reply.id;
                replyButton.dataset.targetFloor = floorNumber;
                
                const quoteButton = document.createElement('button');
                quoteButton.className = 'btn btn-link btn-sm quote-action-btn';
                quoteButton.textContent = '引用';
                quoteButton.dataset.targetId = reply.id;
                quoteButton.dataset.targetFloor = floorNumber;
                quoteButton.dataset.targetContent = reply.content || '';
                quoteButton.style.marginLeft = '10px';
                
                const likeContainer = document.createElement('span');
                likeContainer.style.marginLeft = '10px';
                
                const likeButton = document.createElement('button');
                likeButton.className = 'like-btn reply-like-btn';
                likeButton.dataset.id = reply.id;
                likeButton.innerHTML = '❤️';
                
                const likeCountSpan = document.createElement('span');
                likeCountSpan.id = `reply-like-count-${reply.id}`;
                likeCountSpan.textContent = ` ${reply.like_count || 0}`;
                likeCountSpan.style.fontSize = '0.9em';
                likeCountSpan.style.color = '#555';
                likeCountSpan.style.marginLeft = '3px';
                
                likeContainer.appendChild(likeButton);
                likeContainer.appendChild(likeCountSpan);
                
                actionsDiv.appendChild(replyButton);
                actionsDiv.appendChild(quoteButton);
                actionsDiv.appendChild(likeContainer);
                
                // 组装回复项
                replyDiv.appendChild(metaP);
                replyDiv.appendChild(contentDiv);
                replyDiv.appendChild(actionsDiv);
                
                // 添加到容器
                detailModalReplyList.appendChild(replyDiv);
                
                const hr = document.createElement('hr');
                hr.style.borderTop = '1px dashed #eee';
                hr.style.margin = '10px 0';
                detailModalReplyList.appendChild(hr);
                
                // 递归渲染子回复
                renderRepliesRecursive(reply.id, level + 1);
            });
        }
        
        // 从根回复开始渲染
        renderRepliesRecursive('root', 0);
    }
    
    // --- 事件监听：打开新留言 Modal ---
    if (newPostBtn && postModal) {
        newPostBtn.addEventListener('click', () => {
            if (postModalForm) postModalForm.reset();
            if (postModalStatus) postModalStatus.textContent = '';
            if (postModalSubmitBtn) {
                postModalSubmitBtn.disabled = false;
                postModalSubmitBtn.textContent = '送出留言';
            }
            
            isPostingCooldown = false;
            openModal(postModal);
        });
    } else {
        console.error("錯誤：發表新留言按鈕或 Modal 未找到！");
    }
    
    // --- 事件监听：关闭 Modal ---
    [postModal, detailModal].forEach(modal => {
        if (modal) {
            const closeBtns = modal.querySelectorAll('.close-modal-btn');
            closeBtns.forEach(btn => btn.addEventListener('click', () => closeModal(modal)));
            
            const specificCloseBtn = modal.querySelector(`#close-${modal.id}-btn`);
            if (specificCloseBtn && !specificCloseBtn.classList.contains('close-modal-btn')) {
                specificCloseBtn.addEventListener('click', () => closeModal(modal));
            }
            
            window.addEventListener('click', (event) => {
                if (event.target == modal) closeModal(modal);
            });
        }
    });
    
    // --- 事件监听：提交新留言 (Modal 表单) ---
    if (postModalForm && postModalSubmitBtn && postModalStatus) {
        postModalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (isPostingCooldown) {
                postModalStatus.textContent = '留言過於頻繁...';
                postModalStatus.style.color = 'orange';
                return;
            }
            
            postModalSubmitBtn.disabled = true;
            postModalStatus.textContent = '正在送出...';
            postModalStatus.style.color = 'blue';
            isPostingCooldown = true;
            
            const formData = new FormData(postModalForm);
            const authorName = formData.get('author_name')?.trim() || '匿名';
            const content = formData.get('content')?.trim();
            
            if (!content) {
                postModalStatus.textContent = '錯誤：留言內容不能為空！';
                postModalStatus.style.color = 'red';
                postModalSubmitBtn.disabled = false;
                isPostingCooldown = false;
                return;
            }
            
            try {
                const response = await fetch('/api/guestbook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ author_name: authorName, content: content }),
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                    throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`);
                }
                
                postModalStatus.textContent = '留言成功！';
                postModalStatus.style.color = 'green';
                postModalForm.reset();
                
                // 重新加载留言列表
                fetchGuestbookList(1, currentSort);
                
                // 延迟关闭 Modal
                setTimeout(() => {
                    if (postModal && postModal.style.display !== 'none') closeModal(postModal);
                }, 1000);
                
                // 设置冷却时间
                postModalSubmitBtn.textContent = '請稍候 (15s)';
                setTimeout(() => {
                    isPostingCooldown = false;
                    if (postModalSubmitBtn && postModalSubmitBtn.disabled) {
                        postModalSubmitBtn.disabled = false;
                        postModalSubmitBtn.textContent = '送出留言';
                    }
                    if (postModalStatus && postModalStatus.style.color === 'green') {
                        postModalStatus.textContent = '';
                    }
                }, 15000);
            } catch (error) {
                console.error('留言失敗:', error);
                postModalStatus.textContent = `留言失敗：${error.message}`;
                postModalStatus.style.color = 'red';
                postModalSubmitBtn.disabled = false;
                postModalSubmitBtn.textContent = '送出留言';
                isPostingCooldown = false;
            }
        });
    } else {
        console.error("錯誤：無法找到發表留言 Modal 的表單、提交按鈕或狀態元素。");
    }
    
    // --- 事件监听：提交详情 Modal 中的回复 ---
    if (detailModalReplyForm && modalSubmitReplyBtn && modalReplyStatus) {
        detailModalReplyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!currentDetailMessageId) {
                modalReplyStatus.textContent = '錯誤：未知留言 ID。';
                modalReplyStatus.style.color = 'red';
                return;
            }
            
            if (isReplyingCooldown) {
                modalReplyStatus.textContent = '回覆過於頻繁...';
                modalReplyStatus.style.color = 'orange';
                return;
            }
            
            modalSubmitReplyBtn.disabled = true;
            modalReplyStatus.textContent = '正在送出...';
            modalReplyStatus.style.color = 'blue';
            isReplyingCooldown = true;
            
            const authorName = modalReplyFormAuthor?.value.trim() || '匿名';
            const content = modalReplyFormContent?.value.trim();
            const parentId = currentParentReplyId;
            
            if (!content) {
                modalReplyStatus.textContent = '錯誤：回覆內容不能為空！';
                modalReplyStatus.style.color = 'red';
                modalSubmitReplyBtn.disabled = false;
                isReplyingCooldown = false;
                return;
            }
            
            try {
                const response = await fetch('/api/guestbook/replies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message_id: currentDetailMessageId,
                        parent_reply_id: parentId,
                        author_name: authorName,
                        content: content
                    }),
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                    throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`);
                }
                
                modalReplyStatus.textContent = '回覆成功！';
                modalReplyStatus.style.color = 'green';
                detailModalReplyForm.reset();
                currentParentReplyId = null;
                
                if (modalReplyFormLabel) modalReplyFormLabel.textContent = '回覆內容 (必填):';
                
                // 只刷新 Modal 內的內容
                await fetchAndRenderDetailModal(currentDetailMessageId);
                
                // 设置冷却时间
                modalSubmitReplyBtn.textContent = '請稍候 (15s)';
                setTimeout(() => {
                    isReplyingCooldown = false;
                    if (modalSubmitReplyBtn) {
                        modalSubmitReplyBtn.disabled = false;
                        modalSubmitReplyBtn.textContent = '送出回覆';
                    }
                    if (modalReplyStatus) {
                        modalReplyStatus.textContent = '';
                    }
                }, 15000);
            } catch (error) {
                console.error('Modal 內回覆失敗:', error);
                modalReplyStatus.textContent = `回覆失敗：${error.message}`;
                modalReplyStatus.style.color = 'red';
                if (modalSubmitReplyBtn) {
                    modalSubmitReplyBtn.disabled = false;
                    modalSubmitReplyBtn.textContent = '送出回覆';
                }
                isReplyingCooldown = false;
            }
        });
    } else {
        console.error("錯誤：無法找到詳情 Modal 中的回覆表單元素。");
    }
    
    // --- 事件监听：点击排序按钮 ---
    sortBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!btn.classList.contains('active')) {
                const newSort = btn.dataset.sort;
                if (newSort) {
                    updateSortButtonsActiveState(newSort);
                    fetchGuestbookList(1, newSort);
                }
            }
        });
    });
    
    // --- 事件监听：点击分页按钮 ---
    if (paginationContainer) {
        paginationContainer.addEventListener('click', (e) => {
            if (e.target.matches('.page-btn') && !e.target.disabled) {
                const page = parseInt(e.target.dataset.page, 10);
                if (!isNaN(page)) {
                    fetchGuestbookList(page, currentSort);
                    
                    // 滚动到列表顶部
                    messageListContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    }
    
    // --- 事件委派：处理按赞、回复、引用按钮 ---
    document.body.addEventListener('click', async (event) => {
        const target = event.target;
        
        // --- 处理按赞 ---
        let likeId = null;
        let likeApiUrl = null;
        let countSpanSelector = null;
        let containerElement = null;
        
        if (target.matches('.message-like-btn')) {
            likeId = target.dataset.id;
            likeApiUrl = `/api/guestbook/message/${likeId}/like`;
            countSpanSelector = `#message-like-count-${likeId}`;
            containerElement = target.closest('#message-detail-modal') || document;
        } else if (target.matches('.reply-like-btn')) {
            likeId = target.dataset.id;
            likeApiUrl = `/api/guestbook/replies/${likeId}/like`;
            countSpanSelector = `#reply-like-count-${likeId}`;
            containerElement = detailModal;
        }
        
        if (likeApiUrl && likeId && countSpanSelector && containerElement) {
            target.disabled = true;
            target.style.opacity = '0.5';
            
            try {
                const response = await fetch(likeApiUrl, { method: 'POST' });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                    throw new Error(errorData.error || `HTTP 錯誤 ${response.status}`);
                }
                
                const data = await response.json();
                const countSpan = containerElement.querySelector(countSpanSelector);
                
                if (countSpan) {
                    countSpan.textContent = ` ${data.like_count}`;
                } else {
                    console.warn(`Count span '${countSpanSelector}' not found within`, containerElement);
                }
                
                // 点赞按钮效果
                target.classList.add('liked');
                
                // 恢复按钮状态
                setTimeout(() => {
                    target.disabled = false;
                    target.style.opacity = '1';
                }, 1000);
            } catch (error) {
                console.error('按讚失敗:', error);
                alert(`按讚失敗：${error.message}`);
                target.disabled = false;
                target.style.opacity = '1';
            }
            
            return; // 处理完按赞，结束本次点击处理
        }
        
        // --- 处理详情 Modal 内的 "回复" 和 "引用" 按钮 ---
        if (detailModal && detailModal.contains(target)) {
            let targetId = null;
            let targetFloor = null;
            let isQuote = false;
            let targetContent = null;
            
            if (target.matches('.reply-action-btn')) {
                targetId = target.dataset.targetId;
                targetFloor = target.dataset.targetFloor;
            } else if (target.matches('.quote-action-btn')) {
                targetId = target.dataset.targetId;
                targetFloor = target.dataset.targetFloor;
                targetContent = target.dataset.targetContent;
                isQuote = true;
            }
            
            if (targetId && targetFloor) {
                currentParentReplyId = targetId;
                
                let prefix = `回覆 ${targetFloor}：\n`;
                
                if (isQuote) {
                    const quoteSnippet = (targetContent || '').substring(0, 30) + ((targetContent || '').length > 30 ? '...' : '');
                    prefix = `引用 ${targetFloor}：\n> ${quoteSnippet.replace(/\n/g, '\n> ')}\n---\n`;
                }
                
                if (modalReplyFormLabel) {
                    modalReplyFormLabel.textContent = isQuote ? `引用 ${targetFloor} 並回覆:` : `回覆 ${targetFloor} 的內容:`;
                }
                
                if (modalReplyFormContent) {
                    modalReplyFormContent.value = prefix;
                    modalReplyFormContent.focus();
                    modalReplyFormContent.setSelectionRange(prefix.length, prefix.length);
                }
                
                // 滚动到回复表单
                modalReplyForm?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    });
    
    // --- 初始化 ---
    setupBackToTop();
    setupViewModeToggle();
    updateViewMode(); // 初始化视图模式
    fetchGuestbookList(1, currentSort); // 初始加载留言列表
    
    // --- 检测设备类型 ---
    function detectDevice() {
        const isMobile = window.innerWidth <= 767;
        document.body.classList.toggle('is-mobile', isMobile);
    }
    
    // 初始化检测设备类型
    detectDevice();
    
    // 窗口尺寸改变时重新检测
    window.addEventListener('resize', detectDevice);
});