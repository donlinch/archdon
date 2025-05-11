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
    const modalMessageImageInput = document.getElementById('modal-message-image'); // 新增
    const modalMessageImagePreview = document.getElementById('modal-message-image-preview'); // 新增

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
    const modalReplyImageInput = document.getElementById('modal-reply-image'); // 新增
    const modalReplyImagePreview = document.getElementById('modal-reply-image-preview'); // 新增

    // 編輯 Modal 元素 (新增)
    const editModal = document.getElementById('edit-modal');
    const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
    const editItemForm = document.getElementById('edit-item-form');
    const editItemIdInput = document.getElementById('edit-item-id');
    const editItemTypeInput = document.getElementById('edit-item-type');
    const editPasswordGroup = document.getElementById('edit-password-group');
    const editPasswordInput = document.getElementById('edit-password-input');
    const editContentGroup = document.getElementById('edit-content-group');
    const editContentTextarea = document.getElementById('edit-content-textarea');
    const editStatus = document.getElementById('edit-status');
    const verifyPasswordBtn = document.getElementById('verify-password-btn');
    const submitEditBtn = document.getElementById('submit-edit-btn');
    const editModalCancelBtns = editModal?.querySelectorAll('.close-modal-btn');

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

    function linkify(text) {
        if (!text) return '';
        const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        return text.replace(urlRegex, function(url) {
            let fullUrl = url;
            if (!url.match(/^[a-zA-Z]+:\/\//)) {
                fullUrl = 'http://' + url;
            }
            return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
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

            if (msg.is_reported) {
                messageCard.classList.add('reported-content-hidden');
                const reportedNotice = document.createElement('p');
                reportedNotice.textContent = '此留言已被檢舉，等待管理員審核。';
                reportedNotice.style.color = '#dc3545';
                reportedNotice.style.fontStyle = 'italic';
                reportedNotice.style.padding = '10px';
                messageCard.appendChild(reportedNotice);
                messageListContainer.appendChild(messageCard);
                return; // 跳過此留言的其餘渲染
            }
            
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

            // 新增：顯示圖片 (如果存在)
            if (msg.image_url) {
                const imagePreview = document.createElement('img');
                imagePreview.src = msg.image_url;
                imagePreview.alt = '留言圖片';
                imagePreview.style.maxWidth = '100%';
                imagePreview.style.maxHeight = '200px'; // 限制預覽高度
                imagePreview.style.borderRadius = '8px';
                imagePreview.style.marginTop = '10px';
                imagePreview.style.objectFit = 'cover';
                contentDiv.appendChild(imagePreview); // 將圖片放在內容預覽下方
            }
            
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

            // 添加編輯按鈕 (如果 msg.has_edit_password 為 true)
            if (msg.has_edit_password) {
                const editButton = document.createElement('button');
                editButton.className = 'btn btn-link btn-sm edit-message-btn';
                editButton.dataset.id = msg.id;
                editButton.dataset.type = 'message';
                editButton.textContent = '編輯';
                editButton.style.marginLeft = '8px';
                metaContainer.appendChild(editButton);
            }

            // 新增：檢舉按鈕 (格狀視圖)
            if (msg.can_be_reported && !msg.is_reported) {
                const reportButton = document.createElement('button');
                reportButton.className = 'btn btn-link btn-sm report-btn';
                reportButton.dataset.id = msg.id;
                reportButton.dataset.type = 'message';
                reportButton.textContent = '檢舉';
                reportButton.style.color = '#dc3545'; // 紅色以示警告
                reportButton.style.marginLeft = '8px';
                metaContainer.appendChild(reportButton);
            } else if (msg.is_reported) {
                const reportedSpan = document.createElement('span');
                reportedSpan.className = 'reported-text';
                reportedSpan.textContent = '(已檢舉)';
                reportedSpan.style.color = '#6c757d';
                reportedSpan.style.fontSize = '0.8em';
                reportedSpan.style.marginLeft = '8px';
                metaContainer.appendChild(reportedSpan);
            }
            
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

            if (msg.is_reported) {
                messageItem.classList.add('reported-content-hidden');
                const reportedNotice = document.createElement('p');
                reportedNotice.textContent = '此留言已被檢舉，等待管理員審核。';
                reportedNotice.style.color = '#dc3545';
                reportedNotice.style.fontStyle = 'italic';
                reportedNotice.style.padding = '10px 0';
                messageItem.appendChild(reportedNotice);
                messageListContainer.appendChild(messageItem);
                return; // 跳過此留言的其餘渲染
            }
            
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

            // 添加編輯按鈕 (如果 msg.has_edit_password 為 true)
            if (msg.has_edit_password) {
                const editButton = document.createElement('button');
                editButton.className = 'btn btn-link btn-sm edit-message-btn';
                editButton.dataset.id = msg.id;
                editButton.dataset.type = 'message';
                editButton.textContent = '編輯';
                // editButton.style.marginLeft = 'auto'; // 嘗試將編輯按鈕推到最右邊
                metaInfoDiv.appendChild(editButton);
            }

            // 新增：檢舉按鈕 (列表視圖)
            if (msg.can_be_reported && !msg.is_reported) {
                const reportButton = document.createElement('button');
                reportButton.className = 'btn btn-link btn-sm report-btn';
                reportButton.dataset.id = msg.id;
                reportButton.dataset.type = 'message';
                reportButton.textContent = '檢舉';
                reportButton.style.color = '#dc3545';
                // reportButton.style.marginLeft = 'auto'; // 如果想推到最右
                metaInfoDiv.appendChild(reportButton);
            } else if (msg.is_reported) {
                const reportedSpan = document.createElement('span');
                reportedSpan.className = 'reported-text';
                reportedSpan.textContent = '(已檢舉)';
                reportedSpan.style.color = '#6c757d';
                reportedSpan.style.fontSize = '0.8em';
                metaInfoDiv.appendChild(reportedSpan);
            }
            
            headerDiv.appendChild(authorInfoDiv);
            headerDiv.appendChild(metaInfoDiv);
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'content-preview';
            contentDiv.textContent = msg.content_preview || '(無內容預覽)';

            // 新增：顯示圖片 (如果存在)
            if (msg.image_url) {
                const imagePreview = document.createElement('img');
                imagePreview.src = msg.image_url;
                imagePreview.alt = '留言圖片';
                imagePreview.style.maxWidth = '100%';
                imagePreview.style.maxHeight = '150px'; // 列表視圖中圖片可以小一點
                imagePreview.style.borderRadius = '8px';
                imagePreview.style.marginTop = '8px';
                imagePreview.style.objectFit = 'cover';
                contentDiv.appendChild(imagePreview);
            }
            
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

        // 添加主留言編輯按鈕 (如果 message.has_edit_password 為 true)
        if (message.has_edit_password) {
            const editMessageButton = document.createElement('button');
            editMessageButton.className = 'btn btn-link btn-sm edit-message-btn';
            editMessageButton.dataset.id = message.id;
            editMessageButton.dataset.type = 'message';
            editMessageButton.textContent = '編輯此留言';
            editMessageButton.style.marginLeft = '10px';
            metaInfoDiv.appendChild(editMessageButton);
        }
        
        authorP.appendChild(authorInfoDiv);
        authorP.appendChild(metaInfoDiv);
        
        const hr = document.createElement('hr');
        hr.style.margin = '15px 0';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = linkify(message.content || ''); // 修改此處
        contentDiv.style.whiteSpace = 'pre-wrap';
        contentDiv.style.wordWrap = 'break-word';
        contentDiv.style.padding = '15px';
        contentDiv.style.background = '#f9f9f9';
        contentDiv.style.borderRadius = '8px';
        contentDiv.style.border = '1px solid #eee';
        contentDiv.style.margin = '10px 0 15px';
        contentDiv.style.lineHeight = '1.6';

        // 新增：在 Modal 中顯示主留言的圖片 (如果存在)
        if (message.image_url) {
            const messageImage = document.createElement('img');
            messageImage.src = message.image_url;
            messageImage.alt = '留言圖片';
            messageImage.style.maxWidth = '100%';
            messageImage.style.borderRadius = '8px';
            messageImage.style.marginTop = '10px';
            messageImage.style.marginBottom = '15px';
            detailModalMain.appendChild(messageImage);
        }
        
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
                // 创建回复元素
                const replyDiv = document.createElement('div');
                replyDiv.className = reply.is_admin_reply ? 'reply-item admin-reply' : 'reply-item';
                replyDiv.dataset.replyId = reply.id;

                if (reply.is_reported) {
                    replyDiv.classList.add('reported-content-hidden');
                    const reportedNotice = document.createElement('p');
                    reportedNotice.textContent = '此回覆已被檢舉，等待管理員審核。';
                    reportedNotice.style.color = '#dc3545';
                    reportedNotice.style.fontStyle = 'italic';
                    reportedNotice.style.padding = '5px 0';
                    replyDiv.appendChild(reportedNotice);
                    detailModalReplyList.appendChild(replyDiv);
                    
                    // 即使被檢舉，也可能需要渲染其子回覆，所以這裡不直接 return
                    // 但為了簡化，我們先假設被檢舉的回覆其子回覆也不顯示
                    // 如果需要顯示子回覆，則需要調整這裡的邏輯
                    // 並且，如果被檢舉，就不再添加分隔線 hr
                    // renderRepliesRecursive(reply.id, level + 1); // 如果要顯示子回覆，則取消註釋這行
                    return; // 目前：不顯示被檢舉回覆的子回覆
                }


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
                
                // replyDiv 的創建已移到 is_reported 判斷之前
                
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
                contentDiv.innerHTML = linkify(reply.content || ''); // 修改此處
                contentDiv.style.whiteSpace = 'pre-wrap';
                contentDiv.style.wordWrap = 'break-word';
                // marginBottom 和 lineHeight 會在下方根據是否有圖片動態調整
                
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

                // 添加回覆編輯按鈕 (如果 reply.has_edit_password 為 true)
                if (reply.has_edit_password) {
                    const editReplyButton = document.createElement('button');
                    editReplyButton.className = 'btn btn-link btn-sm edit-reply-btn';
                    editReplyButton.dataset.id = reply.id;
                    editReplyButton.dataset.type = 'reply';
                    editReplyButton.textContent = '編輯';
                    editReplyButton.style.marginLeft = '10px';
                    actionsDiv.appendChild(editReplyButton);
                }
    
                // 新增：檢舉按鈕 (回覆列表)
                if (reply.can_be_reported && !reply.is_reported) {
                    const reportReplyButton = document.createElement('button');
                    reportReplyButton.className = 'btn btn-link btn-sm report-btn';
                    reportReplyButton.dataset.id = reply.id;
                    reportReplyButton.dataset.type = 'reply';
                    reportReplyButton.textContent = '檢舉';
                    reportReplyButton.style.color = '#dc3545';
                    reportReplyButton.style.marginLeft = '10px';
                    actionsDiv.appendChild(reportReplyButton);
                } else if (reply.is_reported) {
                    const reportedSpan = document.createElement('span');
                    reportedSpan.className = 'reported-text';
                    reportedSpan.textContent = '(已檢舉)';
                    reportedSpan.style.color = '#6c757d';
                    reportedSpan.style.fontSize = '0.8em';
                    reportedSpan.style.marginLeft = '10px';
                    actionsDiv.appendChild(reportedSpan);
                }
                
                // 组装回复项
                replyDiv.appendChild(metaP);
                replyDiv.appendChild(contentDiv);

                // 新增：在 Modal 中顯示回覆的圖片 (如果存在)，放在 contentDiv 之後，actionsDiv 之前
                if (reply.image_url) {
                    const imageContainer = document.createElement('div');
                    imageContainer.className = 'reply-image-container';
                    imageContainer.style.marginTop = '10px'; // 與文字內容的間隔
                    imageContainer.style.marginBottom = '10px'; // 與下方操作按鈕的間隔
                    // 為了實現類似「一排顯示兩個的大小」，這裡假設Modal寬度足夠，
                    // 並且圖片本身有最大寬度限制。如果有多張圖片，則需要更複雜的flex或grid佈局。
                    // 這裡主要處理單張圖片的顯示優化。

                    const replyImage = document.createElement('img');
                    replyImage.src = reply.image_url;
                    replyImage.alt = '回覆圖片';
                    // 調整樣式以符合期望
                    replyImage.style.maxWidth = 'calc(50% - 4px)'; // 嘗試讓圖片佔容器一半寬度，留點間隙
                                                                // 如果希望圖片更大，可以調整為例如 '70%' 或 '100%'
                    replyImage.style.maxHeight = '250px'; // 增加最大高度限制
                    replyImage.style.borderRadius = '8px';
                    replyImage.style.objectFit = 'contain'; // 改為 contain 以完整顯示圖片，避免重要部分被裁切
                    replyImage.style.cursor = 'pointer'; // 暗示可點擊放大
                    replyImage.style.display = 'block'; // 讓圖片獨佔一行，如果需要並排則用inline-block
                    replyImage.style.marginLeft = 'auto'; // 如果是 block，可以嘗試居中
                    replyImage.style.marginRight = 'auto';// 如果是 block，可以嘗試居中
                    replyImage.classList.add('reply-image-preview'); // 添加class用於點擊放大事件
                    replyImage.dataset.fullImageUrl = reply.image_url; // 儲存完整圖片URL供放大使用

                    imageContainer.appendChild(replyImage);
                    replyDiv.appendChild(imageContainer);
                    contentDiv.style.marginBottom = '0px'; // 如果有圖片，減少文字下方的margin
                } else {
                    contentDiv.style.marginBottom = '8px'; // 如果沒有圖片，保持原來的margin
                }
                contentDiv.style.lineHeight = '1.5'; // 無論是否有圖片都設置行高


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
            // 重置圖片預覽
            if (modalMessageImageInput) modalMessageImageInput.value = '';
            if (modalMessageImagePreview) {
                modalMessageImagePreview.src = '#';
                modalMessageImagePreview.style.display = 'none';
            }
            openModal(postModal);
        });
    } else {
        console.error("錯誤：發表新留言按鈕或 Modal 未找到！");
    }
    
    // --- 事件监听：关闭 Modal ---
    [postModal, detailModal, editModal].forEach(modal => { // 新增 editModal
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
            const editPassword = formData.get('edit_password')?.trim(); // 獲取編輯密碼
            
            if (!content) {
                postModalStatus.textContent = '錯誤：留言內容不能為空！';
                postModalStatus.style.color = 'red';
                postModalSubmitBtn.disabled = false;
                isPostingCooldown = false;
                return;
            }
            
            try {
                let imageUrl = null;
                const imageFile = modalMessageImageInput?.files[0];

                if (imageFile) {
                    postModalStatus.textContent = '正在上傳圖片...';
                    const imageFormData = new FormData();
                    imageFormData.append('image', imageFile); // 後端 multer 設定的 field name

                    const uploadResponse = await fetch('/api/upload', { // 確認這是你的圖片上傳API
                        method: 'POST',
                        body: imageFormData,
                    });

                    if (!uploadResponse.ok) {
                        const errorData = await uploadResponse.json().catch(() => ({ error: `圖片上傳失敗 (HTTP ${uploadResponse.status})` }));
                        throw new Error(errorData.error || `圖片上傳失敗 (HTTP ${uploadResponse.status})`);
                    }
                    const uploadResult = await uploadResponse.json();
                    if (!uploadResult.success || !uploadResult.url) {
                        throw new Error(uploadResult.error || '圖片上傳成功但未返回有效URL');
                    }
                    imageUrl = uploadResult.url;
                    postModalStatus.textContent = '圖片上傳成功，正在送出留言...';
                }


                const response = await fetch('/api/guestbook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        author_name: authorName,
                        content: content,
                        edit_password: editPassword,
                        image_url: imageUrl // 新增 image_url
                    }),
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
            const editPassword = document.getElementById('modal-reply-edit-password')?.value.trim(); // 獲取回覆的編輯密碼
            const parentId = currentParentReplyId;
            
            if (!content) {
                modalReplyStatus.textContent = '錯誤：回覆內容不能為空！';
                modalReplyStatus.style.color = 'red';
                modalSubmitReplyBtn.disabled = false;
                isReplyingCooldown = false;
                return;
            }
            
            try {
                let imageUrl = null;
                const imageFile = modalReplyImageInput?.files[0];

                if (imageFile) {
                    modalReplyStatus.textContent = '正在上傳圖片...';
                    const imageFormData = new FormData();
                    imageFormData.append('image', imageFile); // 後端 multer 設定的 field name

                    const uploadResponse = await fetch('/api/upload', { // 確認這是你的圖片上傳API
                        method: 'POST',
                        body: imageFormData,
                    });

                    if (!uploadResponse.ok) {
                        const errorData = await uploadResponse.json().catch(() => ({ error: `圖片上傳失敗 (HTTP ${uploadResponse.status})` }));
                        throw new Error(errorData.error || `圖片上傳失敗 (HTTP ${uploadResponse.status})`);
                    }
                    const uploadResult = await uploadResponse.json();
                    if (!uploadResult.success || !uploadResult.url) {
                        throw new Error(uploadResult.error || '圖片上傳成功但未返回有效URL');
                    }
                    imageUrl = uploadResult.url;
                    modalReplyStatus.textContent = '圖片上傳成功，正在送出回覆...';
                }

                const response = await fetch('/api/guestbook/replies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message_id: currentDetailMessageId,
                        parent_reply_id: parentId,
                        author_name: authorName,
                        content: content,
                        edit_password: editPassword, // 新增 edit_password
                        image_url: imageUrl // 新增 image_url
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
                // 重置回覆圖片預覽
                if (modalReplyImageInput) modalReplyImageInput.value = '';
                if (modalReplyImagePreview) {
                    modalReplyImagePreview.src = '#';
                    modalReplyImagePreview.style.display = 'none';
                }
                
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
        
        // --- 处理按赞 和 編輯按鈕 ---
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

        // --- 处理编辑按钮点击 (新增) ---
        if (target.matches('.edit-message-btn, .edit-reply-btn')) {
            event.preventDefault();
            const itemId = target.dataset.id;
            const itemType = target.dataset.type; // 'message' or 'reply'

            if (editModal && editItemIdInput && editItemTypeInput && editPasswordInput && editContentTextarea && editStatus && verifyPasswordBtn && submitEditBtn && editPasswordGroup && editContentGroup) {
                editItemIdInput.value = itemId;
                editItemTypeInput.value = itemType;
                
                // 重置 Modal 狀態
                editItemForm.reset(); // 清空表單
                editStatus.textContent = '';
                editStatus.style.color = '';
                
                editPasswordGroup.style.display = 'block'; // 顯示密碼輸入
                editContentGroup.style.display = 'none';  // 隱藏內容編輯
                
                verifyPasswordBtn.style.display = 'inline-block'; // 顯示驗證按鈕
                verifyPasswordBtn.disabled = false;
                submitEditBtn.style.display = 'none'; // 隱藏儲存按鈕
                
                document.getElementById('edit-modal-title').textContent = itemType === 'message' ? '編輯留言' : '編輯回覆';

                openModal(editModal);
            } else {
                console.error("編輯 Modal 或其內部元素未找到!");
            }
        }

        // --- 处理检举按钮点击 (新增) ---
        if (target.matches('.report-btn')) {
            event.preventDefault();
            const itemId = target.dataset.id;
            const itemType = target.dataset.type; // 'message' or 'reply'
            
            // 阻止重複點擊（如果按鈕已被禁用）
            if (target.disabled || target.classList.contains('reported')) {
                return;
            }

            showReportVerificationModal(itemId, itemType, target);
            return; // 處理完檢舉按鈕點擊，等待 Modal 交互
        }

    });
    
    // --- 數學驗證 Modal 相關 (用於檢舉) ---
    let reportVerificationModal = null;
    let currentReportChallenge = {
        itemId: null,
        itemType: null,
        question: '',
        answer: null,
        reportButtonElement: null
    };

    function createReportVerificationModal() {
        if (document.getElementById('report-verification-modal')) return;

        reportVerificationModal = document.createElement('div');
        reportVerificationModal.id = 'report-verification-modal';
        reportVerificationModal.className = 'modal'; // 使用現有的 modal class
        // 樣式與其他 modal 類似，但 z-index 可以更高一些如果需要
        reportVerificationModal.style.zIndex = '2000';


        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.maxWidth = '350px';

        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-btn close-modal-btn'; // 確保可以被通用邏輯關閉
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => closeModal(reportVerificationModal);

        const title = document.createElement('h2');
        title.textContent = '檢舉驗證';
        title.style.marginBottom = '15px';

        const questionP = document.createElement('p');
        questionP.id = 'report-verification-question';
        questionP.style.fontSize = '1.1em';
        questionP.style.marginBottom = '10px';
        questionP.style.textAlign = 'center';


        const answerInput = document.createElement('input');
        answerInput.type = 'number'; // 限制數字輸入
        answerInput.id = 'report-verification-answer';
        answerInput.className = 'form-control';
        answerInput.placeholder = '請輸入答案';
        answerInput.style.marginBottom = '15px';
        answerInput.style.textAlign = 'center';

        const statusP = document.createElement('p');
        statusP.id = 'report-verification-status';
        statusP.style.minHeight = '1.2em';
        statusP.style.marginTop = '5px';


        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'form-actions';

        const submitBtn = document.createElement('button');
        submitBtn.id = 'submit-report-verification-btn';
        submitBtn.className = 'btn btn-primary';
        submitBtn.textContent = '提交驗證';
// --- 數學驗證 Modal 相關 (用於檢舉) ---
    let reportVerificationModal = null;
    let currentReportChallenge = {
        itemId: null,
        itemType: null,
        question: '',
        answer: null,
        reportButtonElement: null
    };

    function createReportVerificationModal() {
        if (document.getElementById('report-verification-modal')) return;

        reportVerificationModal = document.createElement('div');
        reportVerificationModal.id = 'report-verification-modal';
        reportVerificationModal.className = 'modal'; // 使用現有的 modal class
        reportVerificationModal.style.zIndex = '2000';


        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.maxWidth = '350px';

        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-btn close-modal-btn'; 
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => closeModal(reportVerificationModal);

        const title = document.createElement('h2');
        title.textContent = '檢舉驗證';
        title.style.marginBottom = '15px';

        const questionP = document.createElement('p');
        questionP.id = 'report-verification-question';
        questionP.style.fontSize = '1.1em';
        questionP.style.marginBottom = '10px';
        questionP.style.textAlign = 'center';


        const answerInput = document.createElement('input');
        answerInput.type = 'number'; 
        answerInput.id = 'report-verification-answer';
        answerInput.className = 'form-control';
        answerInput.placeholder = '請輸入答案';
        answerInput.style.marginBottom = '15px';
        answerInput.style.textAlign = 'center';

        const statusP = document.createElement('p');
        statusP.id = 'report-verification-status';
        statusP.style.minHeight = '1.2em';
        statusP.style.marginTop = '5px';


        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'form-actions';

        const submitBtn = document.createElement('button');
        submitBtn.id = 'submit-report-verification-btn';
        submitBtn.className = 'btn btn-primary';
        submitBtn.textContent = '提交驗證';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button'; 
        cancelBtn.className = 'btn btn-secondary close-modal-btn'; 
        cancelBtn.textContent = '取消';
        cancelBtn.onclick = () => closeModal(reportVerificationModal);


        actionsDiv.appendChild(cancelBtn);
        actionsDiv.appendChild(submitBtn);

        modalContent.appendChild(closeBtn);
        modalContent.appendChild(title);
        modalContent.appendChild(questionP);
        modalContent.appendChild(answerInput);
        modalContent.appendChild(statusP);
        modalContent.appendChild(actionsDiv);
        reportVerificationModal.appendChild(modalContent);
        document.body.appendChild(reportVerificationModal);

        // 提交驗證
        submitBtn.addEventListener('click', async () => {
            const userAnswer = parseInt(answerInput.value, 10);
            const statusElement = document.getElementById('report-verification-status');
            
            if (isNaN(userAnswer)) {
                statusElement.textContent = '請輸入數字答案。';
                statusElement.style.color = 'red';
                return;
            }

            if (userAnswer === currentReportChallenge.answer) {
                statusElement.textContent = '驗證成功，正在提交檢舉...';
                statusElement.style.color = 'green';
                submitBtn.disabled = true;
                cancelBtn.disabled = true;

                const { itemId, itemType, reportButtonElement } = currentReportChallenge;
                
                try {
                    const reportUrl = itemType === 'message' ? `/api/guestbook/message/${itemId}/report` : `/api/guestbook/reply/${itemId}/report`;
                    const response = await fetch(reportUrl, { method: 'POST' });
                    const data = await response.json();

                    if (response.ok && data.success) {
                        if (reportButtonElement) {
                            reportButtonElement.textContent = '已檢舉';
                            reportButtonElement.classList.add('reported');
                            reportButtonElement.style.color = '#6c757d';
                            reportButtonElement.style.pointerEvents = 'none';
                            reportButtonElement.disabled = true; 
                        }
                        
                        const itemElement = itemType === 'message' 
                            ? document.querySelector(`.message-card[data-message-id="${itemId}"], .message-list-item[data-message-id="${itemId}"]`)
                            : detailModalReplyList?.querySelector(`.reply-item[data-reply-id="${itemId}"]`);
                        
                        if (itemElement) {
                            const existingReportedText = itemElement.querySelector('.reported-status-text');
                            if (!existingReportedText) {
                                const reportedStatusText = document.createElement('span');
                                reportedStatusText.textContent = ' (已提報待審)';
                                reportedStatusText.style.color = 'orange';
                                reportedStatusText.style.fontSize = '0.9em';
                                reportedStatusText.classList.add('reported-status-text');
                                
                                if (itemType === 'message' && (itemElement.classList.contains('message-card') || itemElement.classList.contains('message-list-item'))) {
                                    const metaContainer = itemElement.querySelector('.message-meta-container, div[style*="gap: 10px"]');
                                    metaContainer?.appendChild(reportedStatusText);
                                } else if (itemType === 'reply' && itemElement.classList.contains('reply-item')) {
                                    const actionsDiv = itemElement.querySelector('.reply-item-actions');
                                    actionsDiv?.appendChild(reportedStatusText);
                                }
                            }
                        }
                        statusElement.textContent = data.message || '檢舉成功！';
                        setTimeout(() => closeModal(reportVerificationModal), 1500);

                    } else {
                        statusElement.textContent = data.error || '檢舉失敗，請稍後再試。';
                        statusElement.style.color = 'red';
                        submitBtn.disabled = false;
                        cancelBtn.disabled = false;
                    }
                } catch (error) {
                    console.error('檢舉時發生錯誤:', error);
                    statusElement.textContent = '檢舉過程中發生網路或伺服器錯誤。';
                    statusElement.style.color = 'red';
                    submitBtn.disabled = false;
                    cancelBtn.disabled = false;
                }

            } else {
                statusElement.textContent = '答案錯誤，請重試。';
                statusElement.style.color = 'red';
                answerInput.value = '';
                answerInput.focus();
            }
        });
    }

    function showReportVerificationModal(itemId, itemType, reportButtonElement) {
        if (!reportVerificationModal || !document.getElementById('report-verification-modal')) {
            createReportVerificationModal();
        }

        const num1 = Math.floor(Math.random() * 9) + 1; 
        const num2 = Math.floor(Math.random() * 9) + 1; 
        currentReportChallenge = {
            itemId,
            itemType,
            question: `${num1} + ${num2} = ?`,
            answer: num1 + num2,
            reportButtonElement
        };

        document.getElementById('report-verification-question').textContent = currentReportChallenge.question;
        const answerInput = document.getElementById('report-verification-answer');
        answerInput.value = '';
        const statusP = document.getElementById('report-verification-status');
        statusP.textContent = '';
        document.getElementById('submit-report-verification-btn').disabled = false;
        const verificationCancelBtn = reportVerificationModal?.querySelector('.btn-secondary.close-modal-btn');
        if(verificationCancelBtn) verificationCancelBtn.disabled = false;

        openModal(reportVerificationModal);
        answerInput.focus();
    }

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button'; // 防止表單提交
        cancelBtn.className = 'btn btn-secondary close-modal-btn'; // 確保可以被通用邏輯關閉
        cancelBtn.textContent = '取消';
        cancelBtn.onclick = () => closeModal(reportVerificationModal);


        actionsDiv.appendChild(cancelBtn);
        actionsDiv.appendChild(submitBtn);

        modalContent.appendChild(closeBtn);
        modalContent.appendChild(title);
        modalContent.appendChild(questionP);
        modalContent.appendChild(answerInput);
        modalContent.appendChild(statusP);
        modalContent.appendChild(actionsDiv);
        reportVerificationModal.appendChild(modalContent);
        document.body.appendChild(reportVerificationModal);

        // 提交驗證
        submitBtn.addEventListener('click', async () => {
            const userAnswer = parseInt(answerInput.value, 10);
            const statusElement = document.getElementById('report-verification-status');
            
            if (isNaN(userAnswer)) {
                statusElement.textContent = '請輸入數字答案。';
                statusElement.style.color = 'red';
                return;
            }

            if (userAnswer === currentReportChallenge.answer) {
                statusElement.textContent = '驗證成功，正在提交檢舉...';
                statusElement.style.color = 'green';
                submitBtn.disabled = true;
                cancelBtn.disabled = true;

                const { itemId, itemType, reportButtonElement } = currentReportChallenge;
                
                try {
                    const reportUrl = itemType === 'message' ? `/api/guestbook/message/${itemId}/report` : `/api/guestbook/reply/${itemId}/report`;
                    const response = await fetch(reportUrl, { method: 'POST' });
                    const data = await response.json();

                    if (response.ok && data.success) {
                        if (reportButtonElement) {
                            reportButtonElement.textContent = '已檢舉';
                            reportButtonElement.classList.add('reported');
                            reportButtonElement.style.color = '#6c757d';
                            reportButtonElement.style.pointerEvents = 'none';
                            reportButtonElement.disabled = true; // 確保禁用
                        }
                        
                        const itemElement = itemType === 'message'
                            ? document.querySelector(`.message-card[data-message-id="${itemId}"], .message-list-item[data-message-id="${itemId}"]`)
                            : detailModalReplyList?.querySelector(`.reply-item[data-reply-id="${itemId}"]`);
                        
                        if (itemElement) {
                            const existingReportedText = itemElement.querySelector('.reported-status-text');
                            if (!existingReportedText) {
                                const reportedStatusText = document.createElement('span');
                                reportedStatusText.textContent = ' (已提報待審)';
                                reportedStatusText.style.color = 'orange';
                                reportedStatusText.style.fontSize = '0.9em';
                                reportedStatusText.classList.add('reported-status-text');
                                
                                if (itemType === 'message' && (itemElement.classList.contains('message-card') || itemElement.classList.contains('message-list-item'))) {
                                    const metaContainer = itemElement.querySelector('.message-meta-container, div[style*="gap: 10px"]');
                                    metaContainer?.appendChild(reportedStatusText);
                                } else if (itemType === 'reply' && itemElement.classList.contains('reply-item')) {
                                    const actionsDiv = itemElement.querySelector('.reply-item-actions');
                                    actionsDiv?.appendChild(reportedStatusText);
                                }
                            }
                        }
                        // alert(data.message || '檢舉成功！內容將等待管理員審核。');
                        statusElement.textContent = data.message || '檢舉成功！';
                        setTimeout(() => closeModal(reportVerificationModal), 1500);

                    } else {
                        statusElement.textContent = data.error || '檢舉失敗，請稍後再試。';
                        statusElement.style.color = 'red';
                        submitBtn.disabled = false;
                        cancelBtn.disabled = false;
                    }
                } catch (error) {
                    console.error('檢舉時發生錯誤:', error);
                    statusElement.textContent = '檢舉過程中發生網路或伺服器錯誤。';
                    statusElement.style.color = 'red';
                    submitBtn.disabled = false;
                    cancelBtn.disabled = false;
                }

            } else {
                statusElement.textContent = '答案錯誤，請重試。';
                statusElement.style.color = 'red';
                answerInput.value = '';
                answerInput.focus();
            }
        });
    }

    function showReportVerificationModal(itemId, itemType, reportButtonElement) {
        if (!reportVerificationModal || !document.getElementById('report-verification-modal')) {
            createReportVerificationModal();
        }

        const num1 = Math.floor(Math.random() * 9) + 1; // 1-9
        const num2 = Math.floor(Math.random() * 9) + 1; // 1-9
        currentReportChallenge = {
            itemId,
            itemType,
            question: `${num1} + ${num2} = ?`,
            answer: num1 + num2,
            reportButtonElement
        };

        document.getElementById('report-verification-question').textContent = currentReportChallenge.question;
        const answerInput = document.getElementById('report-verification-answer');
        answerInput.value = '';
        const statusP = document.getElementById('report-verification-status');
        statusP.textContent = '';
        document.getElementById('submit-report-verification-btn').disabled = false;
        // Ensure cancel button inside verification modal is also enabled
        const verificationCancelBtn = reportVerificationModal?.querySelector('.btn-secondary.close-modal-btn');
        if(verificationCancelBtn) verificationCancelBtn.disabled = false;


        openModal(reportVerificationModal);
        answerInput.focus();
    }

    // --- 圖片放大 Modal 相關 ---
    let imageZoomModal = null;

    function createImageZoomModal() {
        if (document.getElementById('image-zoom-modal')) return;

        imageZoomModal = document.createElement('div');
        imageZoomModal.id = 'image-zoom-modal';
        imageZoomModal.style.display = 'none';
        imageZoomModal.style.position = 'fixed';
        imageZoomModal.style.zIndex = '2000'; // 比其他 Modal 更高
        imageZoomModal.style.left = '0';
        imageZoomModal.style.top = '0';
        imageZoomModal.style.width = '100%';
        imageZoomModal.style.height = '100%';
        imageZoomModal.style.overflow = 'auto';
        imageZoomModal.style.backgroundColor = 'rgba(0,0,0,0.85)';
        imageZoomModal.style.justifyContent = 'center';
        imageZoomModal.style.alignItems = 'center';
        imageZoomModal.style.cursor = 'zoom-out';


        const modalContent = document.createElement('img');
        modalContent.id = 'zoomed-image-content';
        modalContent.style.maxWidth = '90%';
        modalContent.style.maxHeight = '90%';
        modalContent.style.objectFit = 'contain';
        modalContent.style.borderRadius = '8px';
        modalContent.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';

        imageZoomModal.appendChild(modalContent);
        document.body.appendChild(imageZoomModal);

        imageZoomModal.addEventListener('click', () => {
            imageZoomModal.style.display = 'none';
            document.body.style.overflow = ''; // 恢復背景滾動
        });
    }

    // 使用事件委派處理回覆圖片點擊
    if (detailModalReplyList) {
        detailModalReplyList.addEventListener('click', (event) => {
            if (event.target.classList.contains('reply-image-preview')) {
                const fullImageUrl = event.target.dataset.fullImageUrl;
                if (fullImageUrl) {
                    if (!imageZoomModal || !document.getElementById('image-zoom-modal')) {
                        createImageZoomModal(); // 如果 Modal 不存在則創建
                    }
                    const zoomedImageContent = document.getElementById('zoomed-image-content');
                    if (imageZoomModal && zoomedImageContent) {
                        zoomedImageContent.src = fullImageUrl;
                        imageZoomModal.style.display = 'flex'; // 使用 flex 來居中
                        document.body.style.overflow = 'hidden'; // 防止背景滾動
                    }
                }
            }
        });
    }


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

    // --- 圖片預覽功能 (新增) ---
    function setupImagePreview(inputElement, previewElement) {
        if (inputElement && previewElement) {
            inputElement.addEventListener('change', function() {
                const file = this.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        previewElement.src = e.target.result;
                        previewElement.style.display = 'block';
                    }
                    reader.readAsDataURL(file);
                } else {
                    previewElement.src = '#';
                    previewElement.style.display = 'none';
                }
            });
        }
    }
    setupImagePreview(modalMessageImageInput, modalMessageImagePreview);
    setupImagePreview(modalReplyImageInput, modalReplyImagePreview);


    // --- 編輯 Modal 內部邏輯 (新增) ---
    if (editModal && verifyPasswordBtn && submitEditBtn && editItemForm && editStatus && editPasswordGroup && editContentGroup && editContentTextarea && editItemIdInput && editItemTypeInput && editPasswordInput) {
        
        // 驗證密碼按鈕點擊
        verifyPasswordBtn.addEventListener('click', async () => {
            const itemId = editItemIdInput.value;
            const itemType = editItemTypeInput.value;
            const password = editPasswordInput.value;

            if (!password) {
                editStatus.textContent = '請輸入編輯密碼。';
                editStatus.style.color = 'red';
                return;
            }

            verifyPasswordBtn.disabled = true;
            editStatus.textContent = '正在驗證密碼...';
            editStatus.style.color = 'blue';

            try {
                const verifyUrl = itemType === 'message' ? `/api/guestbook/message/${itemId}/verify-password` : `/api/guestbook/reply/${itemId}/verify-password`;
                const response = await fetch(verifyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ edit_password: password })
                });

                const data = await response.json();

                if (response.ok && data.verified) {
                    editStatus.textContent = '密碼驗證成功！請編輯內容。';
                    editStatus.style.color = 'green';
                    editPasswordGroup.style.display = 'none';
                    editContentGroup.style.display = 'block';
                    verifyPasswordBtn.style.display = 'none';
                    submitEditBtn.style.display = 'inline-block';
                    submitEditBtn.disabled = false;

                    // 預填充內容 - 這裡需要獲取原始內容
                    // 暫時留空，或提示用戶輸入
                    // 為了簡化，我們先假設用戶會重新輸入，或者後續從詳情API獲取
                    // 如果是編輯留言，我們可能需要重新fetch一次留言詳情來獲取完整內容
                    // 如果是編輯回覆，則需要從當前回覆列表中找到該回覆的內容
                    // 這裡先簡單處理，讓用戶自行輸入
                    if (itemType === 'message') {
                         // 嘗試從詳情 Modal 的主留言內容獲取 (如果已加載)
                        const mainMessageContentElement = detailModalMain?.querySelector('.message-content');
                        if (mainMessageContentElement && currentDetailMessageId === itemId) {
                            // 移除HTML標籤，只取文本
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = mainMessageContentElement.innerHTML;
                            editContentTextarea.value = tempDiv.textContent || tempDiv.innerText || "";
                        } else {
                             // 如果無法從詳情 Modal 獲取，則提示用戶或留空
                            editContentTextarea.value = ''; // 或者提示用戶
                            editContentTextarea.placeholder = '請輸入新的留言內容';
                        }
                    } else if (itemType === 'reply') {
                        const replyElement = detailModalReplyList?.querySelector(`.reply-item[data-reply-id="${itemId}"] .reply-content`);
                        if (replyElement) {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = replyElement.innerHTML;
                            editContentTextarea.value = tempDiv.textContent || tempDiv.innerText || "";
                        } else {
                            editContentTextarea.value = '';
                            editContentTextarea.placeholder = '請輸入新的回覆內容';
                        }
                    }


                } else {
                    editStatus.textContent = data.error || '密碼驗證失敗。';
                    editStatus.style.color = 'red';
                    verifyPasswordBtn.disabled = false;
                }
            } catch (error) {
                console.error('驗證密碼時出錯:', error);
                editStatus.textContent = '驗證過程中發生錯誤。';
                editStatus.style.color = 'red';
                verifyPasswordBtn.disabled = false;
            }
        });

        // 儲存變更表單提交
        editItemForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // 因為我們是手動觸發 submitEditBtn 的點擊

            if (submitEditBtn.style.display === 'none' || submitEditBtn.disabled) {
                return; // 如果儲存按鈕不可見或禁用，則不執行
            }

            const itemId = editItemIdInput.value;
            const itemType = editItemTypeInput.value;
            const newContent = editContentTextarea.value.trim();
            const password = editPasswordInput.value; // 密碼在驗證後仍然保留在輸入框中

            if (!newContent) {
                editStatus.textContent = '內容不能為空。';
                editStatus.style.color = 'red';
                return;
            }

            submitEditBtn.disabled = true;
            editStatus.textContent = '正在儲存變更...';
            editStatus.style.color = 'blue';

            try {
                const updateUrl = itemType === 'message' ? `/api/guestbook/message/${itemId}/content` : `/api/guestbook/reply/${itemId}/content`;
                const response = await fetch(updateUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: newContent, edit_password: password })
                });

                if (response.ok) {
                    editStatus.textContent = '儲存成功！';
                    editStatus.style.color = 'green';
                    
                    setTimeout(() => {
                        closeModal(editModal);
                        // 刷新列表或詳情
                        if (itemType === 'message') {
                            fetchGuestbookList(currentPage, currentSort); // 刷新主列表
                            // 如果詳情 Modal 正好是這個 message，也刷新它
                            if (detailModal.style.display === 'flex' && currentDetailMessageId === itemId) {
                                fetchAndRenderDetailModal(itemId);
                            }
                        } else if (itemType === 'reply') {
                            // 如果詳情 Modal 開著，刷新回覆列表
                            if (detailModal.style.display === 'flex' && currentDetailMessageId) {
                                fetchAndRenderDetailModal(currentDetailMessageId);
                            } else {
                                // 理論上編輯回覆時，詳情 Modal 應該是開著的
                                // 但以防萬一，如果沒開，也刷新主列表（因為回覆數可能變了）
                                fetchGuestbookList(currentPage, currentSort);
                            }
                        }
                    }, 1000);

                } else {
                    const data = await response.json().catch(() => ({error: `HTTP 錯誤 ${response.status}`}));
                    editStatus.textContent = data.error || '儲存失敗。';
                    editStatus.style.color = 'red';
                    submitEditBtn.disabled = false;
                }
            } catch (error) {
                console.error('儲存變更時出錯:', error);
                editStatus.textContent = '儲存過程中發生錯誤。';
                editStatus.style.color = 'red';
                submitEditBtn.disabled = false;
            }
        });
    } else {
        console.error("編輯 Modal 或其核心表單元素未完全獲取，編輯功能可能無法正常運作。");
    }
});