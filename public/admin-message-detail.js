// public/admin-message-detail.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
    const messageDetailContainer = document.getElementById('admin-message-detail-main');
    const replyListContainer = document.getElementById('admin-reply-list-container');
    const adminReplyForm = document.getElementById('admin-reply-form');
    const identitySelect = document.getElementById('admin-identity-select');
    const adminReplyContent = document.getElementById('admin-reply-content');
    const adminReplyStatus = document.getElementById('admin-reply-status');
    const submitAdminReplyBtn = document.getElementById('submit-admin-reply-btn');
    const messageIdDisplay = document.getElementById('message-id-display');
    const backToListLink = document.querySelector('a[href="/guestbook-admin.html"]');
    const adminReplyEmojiTrigger = document.getElementById('admin-reply-emoji-trigger'); // 你可能沒有這個，只是示例
    const adminReplyFormLabel = document.querySelector('#admin-reply-form label[for="admin-reply-content"]');
    const cancelAdminReplyTargetBtn = document.getElementById('cancel-admin-reply-target-btn');
    const getAiReplyBtn = document.getElementById('get-ai-reply-btn');

    // START: 新增的圖片上傳相關 DOM 元素
    const adminReplyImageInput = document.getElementById('admin-reply-image');
    const adminReplyImagePreviewContainer = document.getElementById('admin-reply-image-preview-container');
    const clearAdminReplyImageBtn = document.getElementById('clear-admin-reply-image-btn');
    const adminReplyImageUploadStatusContainer = document.getElementById('admin-reply-image-upload-status-container');
    const adminReplyImageUploadStatus = document.getElementById('admin-reply-image-upload-status');
    // END: 新增的圖片上傳相關 DOM 元素

    // --- 狀態變數 ---
    let currentMessageId = null;
    let isReplyingCooldown = false;
    let currentAdminParentReplyId = null;
    let mainMessageData = null;

    // --- 函數：從 URL 獲取 message ID ---
    function getMessageIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    // --- 函數：更新回覆表單提示 ---
    function updateAdminReplyFormLabel() {
        if (!adminReplyFormLabel) return;
        if (currentAdminParentReplyId) {
            const targetReplyDiv = document.querySelector(`.reply-item[data-reply-id="${currentAdminParentReplyId}"]`);
            const floor = targetReplyDiv ? targetReplyDiv.dataset.floor : `ID ${currentAdminParentReplyId}`;
            adminReplyFormLabel.innerHTML = `回覆 <span style="font-weight:bold; color:#007bff;">${floor}</span> 的內容 (必填):`;
            if (cancelAdminReplyTargetBtn) cancelAdminReplyTargetBtn.style.display = 'inline-block';
        } else {
            adminReplyFormLabel.textContent = '回覆內容 (必填):';
            if (cancelAdminReplyTargetBtn) cancelAdminReplyTargetBtn.style.display = 'none';
        }
    }

    // --- 事件監聽：點擊「取消指定回覆」按鈕 ---
    if (cancelAdminReplyTargetBtn) {
        cancelAdminReplyTargetBtn.addEventListener('click', () => {
            currentAdminParentReplyId = null;
            if (adminReplyContent) adminReplyContent.value = '';
            updateAdminReplyFormLabel();
        });
    }
    
    // START: 圖片上傳的函式與事件監聽
    function updateAdminReplyImagePreview() {
        if (!adminReplyImageInput || !adminReplyImagePreviewContainer || !clearAdminReplyImageBtn) return;

        adminReplyImagePreviewContainer.innerHTML = ''; // 清空預覽
        if (adminReplyImageInput.files && adminReplyImageInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.maxWidth = '200px';
                img.style.maxHeight = '150px';
                img.style.borderRadius = '4px';
                adminReplyImagePreviewContainer.appendChild(img);
            };
            reader.readAsDataURL(adminReplyImageInput.files[0]);
            clearAdminReplyImageBtn.style.display = 'inline-block';
        } else {
            clearAdminReplyImageBtn.style.display = 'none';
        }
    }

    if (adminReplyImageInput) {
        adminReplyImageInput.addEventListener('change', updateAdminReplyImagePreview);
    }

    if (clearAdminReplyImageBtn) {
        clearAdminReplyImageBtn.addEventListener('click', () => {
            if (adminReplyImageInput) {
                adminReplyImageInput.value = ''; // 清空 file input
            }
            updateAdminReplyImagePreview(); // 更新預覽 (會清空)
            if(adminReplyImageUploadStatusContainer) adminReplyImageUploadStatusContainer.style.display = 'none';
            if(adminReplyImageUploadStatus) adminReplyImageUploadStatus.textContent = '';
        });
    }
    // END: 圖片上傳的函式与事件監聽


    // --- 函數：獲取並顯示留言詳情和所有回覆 ---
    async function fetchAdminMessageDetail(messageId) {
        if (!messageId) {
            showError("錯誤：URL 中缺少有效的留言 ID。");
            return;
        }
        if (!messageDetailContainer || !replyListContainer) {
            console.error("錯誤：找不到必要的頁面容器元素。");
            return;
        }

        messageDetailContainer.innerHTML = '<p>正在載入留言內容...</p>';
        replyListContainer.innerHTML = '<p>正在載入回覆...</p>';
        if (messageIdDisplay) messageIdDisplay.textContent = `(ID: ${messageId})`;

        try {
            const response = await fetch(`/api/admin/guestbook/message/${messageId}`);
            if (!response.ok) {
                let errorMsg = `HTTP 錯誤 ${response.status}`;
                try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {}
                if (response.status === 401) throw new Error('您需要登入才能訪問此功能。');
                if (response.status === 404) throw new Error('找不到指定的留言 (ID: ' + messageId + ')。');
                throw new Error(`無法獲取留言詳情 (${errorMsg})`);
            }
            const data = await response.json();

            if (!data.message) {
                throw new Error('API 返回的資料結構不正確，缺少 message 物件。');
            }

            mainMessageData = data.message;
            renderAdminMessageDetail(data.message);
            renderAdminReplyList(data.replies || []);

        } catch (error) {
            console.error('獲取管理詳情失敗:', error);
            showError(`無法載入留言：${error.message}`);
            replyListContainer.innerHTML = '';
            if (error.message.includes('登入')) {
               alert('請先登入管理後台！');
            }
        }
    }

    // --- 函數：顯示錯誤訊息 ---
    function showError(message) {
        if (messageDetailContainer) {
            messageDetailContainer.innerHTML = `<p class="error">${message}</p>`;
        }
        if (replyListContainer) {
            replyListContainer.innerHTML = '';
        }
    }

    // --- 函數：渲染主留言詳情 ---
    function renderAdminMessageDetail(message) {
        if (!messageDetailContainer || !message) return;
        messageDetailContainer.innerHTML = '';

        const authorP = createParagraphWithLabel('作者: ', message.author_name || '匿名');
        const createDate = new Date(message.created_at).toLocaleString('zh-TW');
        addTimestamp(authorP, `(發表於: ${createDate})`);

        const activityP = createParagraphWithLabel('最後活動: ', new Date(message.last_activity_at).toLocaleString('zh-TW'));

        const statusP = document.createElement('p');
        const statusStrong = document.createElement('strong'); statusStrong.textContent = '狀態: ';
        statusP.appendChild(statusStrong);
        const statusSpan = document.createElement('span');
        statusSpan.className = message.is_visible ? 'status-visible' : 'status-hidden';
        statusSpan.textContent = message.is_visible ? '顯示中' : '已隱藏';
        statusP.appendChild(statusSpan);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn btn-secondary btn-sm toggle-visibility-btn';
        toggleBtn.style.marginLeft = '10px';
        toggleBtn.textContent = message.is_visible ? '設為隱藏' : '設為顯示';
        toggleBtn.dataset.id = message.id;
        toggleBtn.dataset.type = 'message';
        toggleBtn.dataset.targetVisibility = !message.is_visible;
        statusP.appendChild(toggleBtn);

        const replyCountP = createParagraphWithLabel('回覆數: ', message.reply_count || 0);
        const hr = document.createElement('hr');
        const contentLabel = document.createElement('strong'); contentLabel.textContent = '內容:';
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content'; 
        contentDiv.style.backgroundColor = '#f8f9fa'; contentDiv.style.padding = '10px'; contentDiv.style.borderRadius = '4px'; contentDiv.style.marginTop = '5px';
        contentDiv.textContent = message.content || '';
        contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.style.wordWrap = 'break-word';

        [authorP, activityP, statusP, replyCountP, hr, contentLabel, contentDiv].forEach(el => messageDetailContainer.appendChild(el));
        
        // 如果主留言有圖片，也顯示出來
        if (message.image_url) {
            const imageContainer = document.createElement('div');
            imageContainer.style.marginTop = '10px';
            imageContainer.style.marginBottom = '10px';
            const imgLabel = document.createElement('strong');
            imgLabel.textContent = '圖片: ';
            imageContainer.appendChild(imgLabel);
            
            const img = document.createElement('img');
            img.src = message.image_url;
            img.alt = '留言圖片';
            img.style.maxWidth = '300px';
            img.style.maxHeight = '250px';
            img.style.borderRadius = '4px';
            img.style.display = 'block';
            img.style.marginTop = '5px';
            img.style.cursor = 'pointer';
            img.addEventListener('click', () => window.open(message.image_url, '_blank'));
            imageContainer.appendChild(img);
            messageDetailContainer.appendChild(imageContainer);
        }
    }

    // --- 函數：渲染回覆列表 (包含樓層和操作按鈕) ---
    function renderAdminReplyList(replies) {
        if (!replyListContainer) return;
        replyListContainer.innerHTML = '';

        if (!replies || replies.length === 0) {
            const p = document.createElement('p'); p.textContent = '目前沒有回覆。';
            replyListContainer.appendChild(p);
            return;
        }

        const repliesByParentId = new Map();
        replies.forEach(reply => {
            const parentId = reply.parent_reply_id === null ? 'root' : reply.parent_reply_id;
            if (!repliesByParentId.has(parentId)) repliesByParentId.set(parentId, []);
            repliesByParentId.get(parentId).push(reply);
        });

        const floorMap = new Map();
        function assignFloors(parentId, parentFloorPrefix = 'B', level = 0) {
            const children = repliesByParentId.get(parentId) || [];
            children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            children.forEach((reply, index) => {
                const currentFloor = level === 0 ? `${parentFloorPrefix}${index + 1}` : `${parentFloorPrefix}-${index + 1}`;
                floorMap.set(reply.id, currentFloor);
                assignFloors(reply.id, currentFloor, level + 1);
            });
        }
        assignFloors('root');

        function renderRepliesRecursive(parentId, level = 0) {
            const children = repliesByParentId.get(parentId) || [];
            children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            if (children.length === 0 && level === 0 && parentId === 'root') return;

            children.forEach((reply) => {
                const floorNumber = floorMap.get(reply.id) || '?';
                const replyDiv = document.createElement('div');
                replyDiv.className = reply.is_admin_reply ? 'reply-item admin-reply' : 'reply-item';
                replyDiv.id = `reply-row-${reply.id}`;
                if (level > 0) { replyDiv.classList.add('nested'); replyDiv.style.marginLeft = `${level * 25}px`; }
                replyDiv.dataset.replyId = reply.id;
                replyDiv.dataset.floor = floorNumber;
                if (!reply.is_visible) replyDiv.style.opacity = '0.6';

                const metaP = document.createElement('p'); metaP.style.marginBottom = '5px';
                const floorSpan = document.createElement('span');
                floorSpan.className = 'reply-floor'; floorSpan.textContent = floorNumber; floorSpan.style.fontWeight = 'bold'; floorSpan.style.marginRight = '8px';
                const authorSpan = document.createElement('span');
                authorSpan.className = 'author'; authorSpan.textContent = reply.is_admin_reply ? `[${reply.admin_identity_name || '管理員'}]` : (reply.author_name || '匿名');
                const timestampSpan = document.createElement('span');
                timestampSpan.className = 'timestamp'; timestampSpan.textContent = ` (${new Date(reply.created_at).toLocaleString('zh-TW')})`;
                const statusSpanContainer = document.createElement('span');
                statusSpanContainer.style.marginLeft = '10px'; statusSpanContainer.innerHTML = `[狀態: <span class="${reply.is_visible ? 'status-visible' : 'status-hidden'}">${reply.is_visible ? '顯示中' : '已隱藏'}</span>]`;
                metaP.appendChild(floorSpan); metaP.appendChild(authorSpan); metaP.appendChild(timestampSpan); metaP.appendChild(statusSpanContainer);

                const contentDiv = document.createElement('div');
                contentDiv.className = 'reply-content'; contentDiv.style.marginBottom = '5px'; contentDiv.textContent = reply.content || ''; contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.style.wordWrap = 'break-word';

                const actionsDiv = document.createElement('div'); actionsDiv.className = 'reply-actions';
                const replyToBtn = document.createElement('button');
                replyToBtn.className = 'btn btn-secondary btn-sm admin-reply-action-btn'; replyToBtn.textContent = '回覆'; replyToBtn.dataset.targetId = reply.id; replyToBtn.dataset.targetFloor = floorNumber;
                const quoteBtn = document.createElement('button');
                quoteBtn.className = 'btn btn-link btn-sm admin-quote-action-btn'; quoteBtn.textContent = '引用'; quoteBtn.dataset.targetId = reply.id; quoteBtn.dataset.targetFloor = floorNumber; quoteBtn.dataset.targetContent = reply.content || '';
                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'btn btn-warning btn-sm toggle-visibility-btn'; toggleBtn.textContent = reply.is_visible ? '隱藏' : '顯示'; toggleBtn.dataset.id = reply.id; toggleBtn.dataset.type = 'reply'; toggleBtn.dataset.targetVisibility = !reply.is_visible;
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-danger btn-sm delete-item-btn'; deleteBtn.textContent = '刪除'; deleteBtn.dataset.id = reply.id; deleteBtn.dataset.type = 'reply'; deleteBtn.dataset.name = `回覆 ${floorNumber}`;
                actionsDiv.appendChild(replyToBtn); actionsDiv.appendChild(quoteBtn); actionsDiv.appendChild(toggleBtn); actionsDiv.appendChild(deleteBtn);

                if (reply.is_reported) {
                    const unreportBtn = document.createElement('button');
                    unreportBtn.className = 'btn btn-success btn-sm unreport-reply-btn'; unreportBtn.textContent = '解除檢舉'; unreportBtn.dataset.replyId = reply.id; unreportBtn.style.marginLeft = '5px';
                    actionsDiv.appendChild(unreportBtn);
                }

                replyDiv.appendChild(metaP); replyDiv.appendChild(contentDiv);
                if (reply.image_url) { // 這裡處理回覆的圖片顯示
                    const imageContainer = document.createElement('div'); imageContainer.style.marginTop = '8px'; imageContainer.style.marginBottom = '8px';
                    const img = document.createElement('img'); img.src = reply.image_url; img.alt = '回覆圖片'; img.style.maxWidth = '200px'; img.style.maxHeight = '150px'; img.style.borderRadius = '4px'; img.style.display = 'block'; img.style.cursor = 'pointer';
                    img.addEventListener('click', () => window.open(reply.image_url, '_blank'));
                    imageContainer.appendChild(img);
                    replyDiv.appendChild(imageContainer);
                }
                replyDiv.appendChild(actionsDiv);
                replyListContainer.appendChild(replyDiv);
                const hr = document.createElement('hr'); hr.style.borderTop = '1px dashed #eee'; hr.style.margin = '10px 0';
                replyListContainer.appendChild(hr);
                renderRepliesRecursive(reply.id, level + 1);
            });
        }
        renderRepliesRecursive('root', 0);
    }

    // --- 函數：獲取並填充管理員身份下拉選單 ---
    async function fetchAndPopulateIdentities() {
        if (!identitySelect) return;
        identitySelect.disabled = true;
        identitySelect.innerHTML = '<option value="">載入中...</option>';
        try {
            const response = await fetch('/api/admin/identities');
            if (!response.ok) throw new Error('無法獲取身份列表');
            const identities = await response.json();
            if (identities && identities.length > 0) {
                identitySelect.innerHTML = '';
                const defaultOption = document.createElement('option'); defaultOption.value = ''; defaultOption.textContent = '-- 請選擇身份 --'; identitySelect.appendChild(defaultOption);
                identities.forEach(identity => { const option = document.createElement('option'); option.value = identity.id; option.textContent = identity.name; identitySelect.appendChild(option); });
                identitySelect.disabled = false;
            } else {
                identitySelect.innerHTML = '<option value="">沒有可用的身份</option>';
            }
        } catch (error) {
            console.error('獲取身份失敗:', error);
            identitySelect.innerHTML = '<option value="">獲取身份失敗</option>';
            if (adminReplyStatus) { adminReplyStatus.textContent = '錯誤：無法載入回覆身份。'; adminReplyStatus.style.color = 'red'; }
        }
    }

    // --- Emoji Picker 初始化 (如果有用到) ---
    if (adminReplyEmojiTrigger && adminReplyContent && window.EmojiButton && typeof window.EmojiButton.EmojiButton === 'function') {
        try {
            const adminPicker = new EmojiButton.EmojiButton({ position: 'top-start', autoHide: true });
            adminPicker.on('emoji', selection => insertTextAtCursor(adminReplyContent, selection.emoji));
            adminReplyEmojiTrigger.addEventListener('click', () => adminPicker.togglePicker(adminReplyEmojiTrigger));
            console.log("Emoji Picker initialized for admin reply.");
        } catch (e) {
            console.error("Error initializing Emoji Picker for admin reply:", e);
        }
    } else {
        // console.warn("Admin reply Emoji Picker elements not found or EmojiButton library not fully loaded.");
    }

    // --- 事件監聽：點擊回覆列表中的「回覆」或「引用」按鈕 ---
    if (replyListContainer) {
        replyListContainer.addEventListener('click', (event) => {
            const target = event.target;
            let targetId = null;
            let targetFloor = null;
            let isQuote = false;
            let targetContentForQuote = null;

            if (target.matches('.admin-reply-action-btn')) {
                targetId = target.dataset.targetId;
                targetFloor = target.dataset.targetFloor;
            } else if (target.matches('.admin-quote-action-btn')) {
                targetId = target.dataset.targetId;
                targetFloor = target.dataset.targetFloor;
                targetContentForQuote = target.dataset.targetContent;
                isQuote = true;
            }

            if (targetId && targetFloor) {
                currentAdminParentReplyId = targetId;
                let prefix = `回覆 ${targetFloor}：\n`;
                if (isQuote) {
                    const quoteSnippet = (targetContentForQuote || '').substring(0, 50) + ((targetContentForQuote || '').length > 50 ? '...' : '');
                    const formattedQuote = quoteSnippet.split('\n').map(line => `> ${line}`).join('\n');
                    prefix = `引用 ${targetFloor}：\n${formattedQuote}\n---\n`;
                }
                updateAdminReplyFormLabel();
                if (adminReplyContent) {
                    adminReplyContent.value = prefix;
                    adminReplyContent.focus();
                    adminReplyContent.setSelectionRange(prefix.length, prefix.length);
                }
                adminReplyForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    // --- 事件監聽：提交管理員回覆 (已更新處理圖片上傳) ---
    if (adminReplyForm && submitAdminReplyBtn && adminReplyStatus && identitySelect) {
        adminReplyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentMessageId) return;
            if (isReplyingCooldown) { adminReplyStatus.textContent = '回覆過於頻繁...'; adminReplyStatus.style.color = 'orange'; return; }
            
            const selectedIdentityId = identitySelect.value;
            const content = adminReplyContent.value.trim();
            // 獲取選擇的圖片檔案
            const imageFile = adminReplyImageInput && adminReplyImageInput.files[0] ? adminReplyImageInput.files[0] : null;
    
            if (!selectedIdentityId) { adminReplyStatus.textContent = '請選擇回覆身份！'; adminReplyStatus.style.color = 'orange'; return; }
            if (!content) { adminReplyStatus.textContent = '回覆內容不能為空！'; adminReplyStatus.style.color = 'orange'; return; }
    
            submitAdminReplyBtn.disabled = true;
            adminReplyStatus.textContent = '正在送出...';
            adminReplyStatus.style.color = 'blue';
            isReplyingCooldown = true;
    
            let uploadedImageUrl = null; // 用於儲存上傳成功後的圖片 URL
    
            // 步驟 1: 如果有圖片，先上傳圖片
            if (imageFile) {
                if (adminReplyImageUploadStatusContainer) adminReplyImageUploadStatusContainer.style.display = 'block';
                if (adminReplyImageUploadStatus) {
                    adminReplyImageUploadStatus.textContent = '正在上傳圖片...';
                    adminReplyImageUploadStatus.style.color = 'blue';
                }
    
                const formData = new FormData();
                formData.append('image', imageFile); // 'image' 欄位名需要與後端 multer 設定一致
    
                try {
                    // 使用你現有的安全圖片上傳端點
                    const uploadResponse = await fetch('/api/upload', { // <--- 修改這裡
                        method: 'POST',
                        body: formData,
                        // 注意：使用 FormData 時，不需要手動設定 Content-Type header，瀏覽器會自動處理
                    });
    
                    const uploadData = await uploadResponse.json();
                    if (!uploadResponse.ok || !uploadData.success) {
                        throw new Error(uploadData.error || `圖片上傳失敗 (${uploadResponse.status})`);
                    }
                    uploadedImageUrl = uploadData.url; // 從後端獲取圖片 URL
                    if (adminReplyImageUploadStatus) {
                        adminReplyImageUploadStatus.textContent = '圖片上傳成功！';
                        adminReplyImageUploadStatus.style.color = 'green';
                    }
                    // 短暫顯示成功訊息後隱藏
                    setTimeout(() => {
                        if(adminReplyImageUploadStatusContainer) adminReplyImageUploadStatusContainer.style.display = 'none';
                    }, 2000);
    
                } catch (uploadError) {
                    console.error('圖片上傳失敗:', uploadError);
                    adminReplyStatus.textContent = `圖片上傳失敗：${uploadError.message}`;
                    adminReplyStatus.style.color = 'red';
                    if (adminReplyImageUploadStatus) {
                        adminReplyImageUploadStatus.textContent = `圖片上傳失敗：${uploadError.message}`;
                        adminReplyImageUploadStatus.style.color = 'red';
                    }
                    submitAdminReplyBtn.disabled = false;
                    // 稍微縮短冷卻時間，讓使用者可以重試
                    setTimeout(() => { isReplyingCooldown = false; }, 1000); 
                    return; // 圖片上傳失敗，終止後續操作
                }
            } else {
                // 如果沒有圖片，確保上傳狀態區域是隱藏的
                if(adminReplyImageUploadStatusContainer) adminReplyImageUploadStatusContainer.style.display = 'none';
                if(adminReplyImageUploadStatus) adminReplyImageUploadStatus.textContent = '';
            }
    
            // 步驟 2: 送出回覆 (包含圖片 URL，如果有的話)
            try {
                const replyPayload = {
                    message_id: currentMessageId,
                    parent_reply_id: currentAdminParentReplyId,
                    content: content,
                    admin_identity_id: selectedIdentityId,
                };
                if (uploadedImageUrl) {
                    replyPayload.image_url = uploadedImageUrl; // 將圖片 URL 加入 payload
                }
    
                const response = await fetch('/api/admin/guestbook/replies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(replyPayload),
                });
                const responseData = await response.json();
                if (!response.ok) throw new Error(responseData.error || `HTTP 錯誤 ${response.status}`);
    
                adminReplyStatus.textContent = '管理員回覆成功！';
                adminReplyStatus.style.color = 'green';
                adminReplyForm.reset(); // 重設整個表單
                identitySelect.value = ""; // 確保身份選擇也被重設
                currentAdminParentReplyId = null;
                updateAdminReplyFormLabel();
                if (adminReplyImageInput) adminReplyImageInput.value = ''; // 清除圖片選擇
                updateAdminReplyImagePreview(); // 清除預覽
                if(adminReplyImageUploadStatusContainer) adminReplyImageUploadStatusContainer.style.display = 'none'; // 隱藏圖片上傳狀態
    
                fetchAdminMessageDetail(currentMessageId); // 重新載入留言和回覆
                setTimeout(() => { adminReplyStatus.textContent = ''; }, 3000);
    
            } catch (error) {
                console.error('管理員回覆失敗:', error);
                adminReplyStatus.textContent = `回覆失敗：${error.message}`;
                adminReplyStatus.style.color = 'red';
            } finally {
                submitAdminReplyBtn.disabled = false;
                setTimeout(() => { isReplyingCooldown = false; }, 15000); // 正常冷卻時間
            }
        });
    }


    // --- 「取得 AI 回覆建議」按鈕事件監聽 (保持不變) ---
    if (getAiReplyBtn && adminReplyContent) {
        getAiReplyBtn.addEventListener('click', async () => {
            if (!currentMessageId) {
                alert('錯誤：尚未載入留言詳情，無法提供 AI 建議。');
                return;
            }
            if (!mainMessageData) {
                alert('錯誤：主留言資料尚未載入，請稍候再試。');
                return;
            }

            getAiReplyBtn.textContent = 'AI 思考中...';
            getAiReplyBtn.disabled = true;

            const mainAuthor = mainMessageData.author_name || "某用戶";
            const mainContent = mainMessageData.content || "";
            let quotedContentText = null;
            let targetForAiReplyText = mainContent;

            if (currentAdminParentReplyId) {
                const targetReplyDiv = document.querySelector(`.reply-item[data-reply-id="${currentAdminParentReplyId}"]`);
                const targetReplyContentElement = targetReplyDiv ? targetReplyDiv.querySelector('.reply-content') : null;
                if (targetReplyContentElement) {
                    quotedContentText = targetReplyContentElement.textContent.trim();
                    targetForAiReplyText = quotedContentText;
                } else {
                    console.warn(`AI建議：找不到 ID 為 ${currentAdminParentReplyId} 的引用回覆內容，將以主留言為目標。`);
                }
            }

            let currentDraftText = adminReplyContent.value.trim();
            if (currentAdminParentReplyId) {
                const targetReplyDiv = document.querySelector(`.reply-item[data-reply-id="${currentAdminParentReplyId}"]`);
                const floor = targetReplyDiv ? targetReplyDiv.dataset.floor : `ID ${currentAdminParentReplyId}`;
                const replyPrefix = `回覆 ${floor}：\n`;
                const quotePrefixPattern = new RegExp(`^引用 ${floor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}：\\n(> [^\\n]*\\n)*---\\n`, 'i');

                if (currentDraftText.startsWith(replyPrefix)) {
                    currentDraftText = currentDraftText.substring(replyPrefix.length).trimStart();
                } else if (quotePrefixPattern.test(currentDraftText)) {
                    currentDraftText = currentDraftText.replace(quotePrefixPattern, '').trimStart();
                }
            }

            console.log("AI 建議請求上下文:", {
                mainMessageAuthor: mainAuthor,
                mainMessageContent: mainContent.substring(0,100)+"...",
                quotedReplyContent: quotedContentText ? quotedContentText.substring(0,100)+"..." : null,
                currentReplyDraft: currentDraftText.substring(0,50)+"...",
                targetCommentForReply: targetForAiReplyText.substring(0,100)+"..."
            });

            try {
                const response = await fetch('/api/generate-guestbook-reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mainMessageAuthor: mainAuthor,
                        mainMessageContent: mainContent,
                        quotedReplyContent: quotedContentText,
                        currentReplyDraft: currentDraftText,
                        targetCommentForReply: targetForAiReplyText
                    })
                });

                if (!response.ok) {
                    let errorMsg = `伺服器錯誤 ${response.status}`;
                    try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {}
                    throw new Error(errorMsg);
                }

                const data = await response.json();
                const suggestedReply = data.suggestedReply;
                let prefixToKeep = "";
                if (currentAdminParentReplyId) {
                    const targetReplyDiv = document.querySelector(`.reply-item[data-reply-id="${currentAdminParentReplyId}"]`);
                    const floor = targetReplyDiv ? targetReplyDiv.dataset.floor : `ID ${currentAdminParentReplyId}`;
                     if (adminReplyContent.value.trim().startsWith(`引用 ${floor}：`)) {
                        prefixToKeep = adminReplyContent.value.substring(0, adminReplyContent.value.indexOf('---\n') + 4);
                    } else if (adminReplyContent.value.trim().startsWith(`回覆 ${floor}：`)) {
                        prefixToKeep = adminReplyContent.value.substring(0, adminReplyContent.value.indexOf('：\n') + 2);
                    }
                }
                
                adminReplyContent.value = prefixToKeep + (currentDraftText ? currentDraftText + "\n" : "") + suggestedReply;
                adminReplyContent.focus();
                adminReplyContent.selectionStart = adminReplyContent.value.length;
                adminReplyContent.selectionEnd = adminReplyContent.value.length;

            } catch (error) {
                console.error('取得 AI 回覆失敗:', error);
                alert(`取得 AI 回覆建議失敗：${error.message}`);
            } finally {
                getAiReplyBtn.textContent = '取得 AI 回覆建議';
                getAiReplyBtn.disabled = false;
            }
        });
    }

    // --- 事件委派：處理主留言和回覆列表中的按鈕點擊 (顯隱、刪除、解除檢舉) ---
    // (這部分保持不變)
    document.body.addEventListener('click', async (event) => {
        const target = event.target;

        if (target.matches('.toggle-visibility-btn')) {
            const id = target.dataset.id; const type = target.dataset.type; const targetVisibility = target.dataset.targetVisibility === 'true';
            const endpoint = type === 'message' ? `/api/admin/guestbook/messages/${id}/visibility` : `/api/admin/guestbook/replies/${id}/visibility`;
            target.disabled = true;
            try {
                const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_visible: targetVisibility }) });
                if (!response.ok) { let errorMsg = `HTTP ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {} throw new Error(errorMsg); }
                fetchAdminMessageDetail(currentMessageId);
            } catch (error) { console.error(`切換 ${type} ${id} 可見度失敗:`, error); alert(`操作失敗：${error.message}`); target.disabled = false; }
        } else if (target.matches('.delete-item-btn')) {
            const id = target.dataset.id; const type = target.dataset.type; const name = target.dataset.name || `項目 #${id}`; const itemTypeText = type === 'message' ? '留言' : '回覆';
            if (confirm(`確定要刪除這個 ${itemTypeText} (${name}) 嗎？\n(如果是留言，其下的所有回覆也會被刪除)`)) {
                const endpoint = type === 'message' ? `/api/admin/guestbook/messages/${id}` : `/api/admin/guestbook/replies/${id}`;
                target.disabled = true;
                try {
                    const response = await fetch(endpoint, { method: 'DELETE' });
                    if (!response.ok && response.status !== 204) { let errorMsg = `HTTP ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {} throw new Error(errorMsg); }
                    if (type === 'message') { alert('主留言已刪除，將返回列表頁。'); if (backToListLink) backToListLink.click(); else window.location.href = '/guestbook-admin.html'; }
                    else { fetchAdminMessageDetail(currentMessageId); }
                } catch (error) { console.error(`刪除 ${type} ${id} 失敗:`, error); alert(`刪除失敗：${error.message}`); target.disabled = false; }
            }
        } else if (target.matches('.unreport-reply-btn')) {
            const replyId = target.dataset.replyId; if (!replyId) { console.error('解除檢舉按鈕缺少 replyId'); alert('操作失敗：缺少回覆 ID。'); return; }
            if (confirm(`確定要解除對此回覆 (ID: ${replyId}) 的檢舉嗎？\n這會將其標記為未檢舉且設為可見。`)) {
                target.disabled = true; const endpoint = `/api/admin/guestbook/replies/${replyId}/status`; const body = { is_reported: false, is_visible: true };
                try {
                    const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                    if (!response.ok) { let errorMsg = `HTTP ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch {} throw new Error(errorMsg); }
                    fetchAdminMessageDetail(currentMessageId);
                } catch (error) { console.error(`解除回覆 ${replyId} 檢舉失敗:`, error); alert(`操作失敗：${error.message}`); target.disabled = false; }
            }
        }
    });

    // --- 輔助函數 ---
    function createParagraphWithLabel(label, textContent) {
        const p = document.createElement('p'); const strong = document.createElement('strong'); strong.textContent = label; p.appendChild(strong); p.appendChild(document.createTextNode(textContent || '')); return p;
    }
    function addTimestamp(parentElement, textContent) {
        const span = document.createElement('span'); span.className = 'timestamp'; span.textContent = textContent || ''; parentElement.appendChild(document.createTextNode(' ')); parentElement.appendChild(span);
    }
    function insertTextAtCursor(textarea, text) {
        if (!textarea) return; const start = textarea.selectionStart; const end = textarea.selectionEnd; const value = textarea.value; textarea.value = value.substring(0, start) + text + value.substring(end); textarea.selectionStart = textarea.selectionEnd = start + text.length; textarea.focus();
    }

    // --- 頁面初始載入 ---
    currentMessageId = getMessageIdFromUrl();
    if (currentMessageId) {
        fetchAdminMessageDetail(currentMessageId);
        fetchAndPopulateIdentities();
        updateAdminReplyFormLabel();
    } else {
        showError("錯誤：URL 中缺少有效的留言 ID。");
    }
});