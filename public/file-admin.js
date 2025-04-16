// public/file-admin.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("File Admin JS Loaded");

    // --- DOM 元素 ---
    const uploadBtn = document.getElementById('upload-new-file-btn');
    const searchInput = document.getElementById('file-search-input');
    const typeFilter = document.getElementById('file-type-filter');
    const sortBySelect = document.getElementById('file-sort-by');
    const refreshBtn = document.getElementById('refresh-list-btn');
    const viewListBtn = document.getElementById('view-toggle-list');
    const viewGridBtn = document.getElementById('view-toggle-grid');
    const fileLoading = document.getElementById('file-loading');
    const fileError = document.getElementById('file-error');
    const fileListView = document.getElementById('file-list-view');
    const fileGridView = document.getElementById('file-grid-view');
    const listTableBody = document.querySelector('#file-list-table tbody');
    const paginationControls = document.getElementById('pagination-controls');
    const uploadModal = document.getElementById('upload-modal');
    const closeUploadModalBtn = document.getElementById('close-upload-modal');
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const uploadPreview = document.getElementById('upload-preview');
    const uploadStatus = document.getElementById('upload-status');
    const confirmUploadBtn = document.getElementById('confirm-upload-btn');
    const uploadModalCancelBtns = uploadModal ? uploadModal.querySelectorAll('.close-modal-btn') : [];

    // --- 狀態變數 ---
    let currentPage = 1;
    let totalPages = 1;
    let currentSortBy = 'newest';
    let currentFileType = 'all';
    let currentSearch = '';
    let currentView = 'list'; // 'list' or 'grid'

    // --- 輔助函數 ---
    const showLoading = (show) => { if(fileLoading) fileLoading.style.display = show ? 'block' : 'none'; };
    const showError = (message) => { if(fileError) { fileError.textContent = message; fileError.style.display = 'block'; } };
    const hideError = () => { if(fileError) fileError.style.display = 'none'; };
    const openModal = (modal) => { if(modal) modal.style.display = 'flex'; };
    const closeModal = (modal) => { if(modal) modal.style.display = 'none'; };

    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe
             .toString()
             .replace(/&/g, "&") // & 符號要先替換
             .replace(/</g, "<")
             .replace(/>/g, ">")
            // " 轉成 & q u o t ;
            .replace(/"/g, '&quot;')
        
            // ' 轉成 & # 3 9 ;  (數字實體)
            .replace(/'/g, '&#39;');
    }

    // --- 主要功能函數 ---
    async function fetchFiles(page = currentPage) {
        showLoading(true);
        hideError();
        if (currentView === 'list' && listTableBody) listTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">正在載入...</td></tr>`;
        if (currentView === 'grid' && fileGridView) fileGridView.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">正在載入...</p>';
        if (paginationControls) paginationControls.innerHTML = '';

        currentPage = page;

        console.log(`Fetching page ${currentPage}, filter: ${currentFileType}, sort: ${currentSortBy}, search: ${currentSearch}`);

        const params = new URLSearchParams({
            page: currentPage,
            limit: 15,
            sortBy: currentSortBy,
            fileType: currentFileType,
            search: currentSearch
        });

        try {
            const response = await fetch(`/api/admin/files?${params.toString()}`);
            if (!response.ok) {
                let errorMsg = `HTTP 錯誤 ${response.status}`;
                try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
                throw new Error(`無法獲取檔案列表 (${errorMsg})`);
            }
            const data = await response.json();
            console.log("API Response Data:", data);
            renderFiles(data.files || []);
            renderPagination(data.totalPages || 1, data.currentPage || 1);

        } catch (err) {
            console.error('❌ 獲取檔案列表失敗:', err);
            showError(`無法載入檔案列表：${err.message}`);
            if (listTableBody) listTableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align: center;">載入失敗</td></tr>`;
            if (fileGridView) fileGridView.innerHTML = `<p style="color:red; text-align: center; grid-column: 1 / -1;">載入失敗</p>`;
        } finally {
            showLoading(false);
        }
    }

    function renderFiles(files) {
        if (listTableBody) listTableBody.innerHTML = '';
        if (fileGridView) fileGridView.innerHTML = '';

        if (!Array.isArray(files) || files.length === 0) {
             if (currentView === 'list' && listTableBody) listTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">找不到符合條件的檔案。</td></tr>';
             if (currentView === 'grid' && fileGridView) fileGridView.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">找不到符合條件的檔案。</p>';
            return;
        }

        if (currentView === 'list') {
            renderListView(files);
        } else {
            renderGridView(files);
        }
        addActionButtonListeners(); // 渲染後綁定事件 (現在只處理刪除按鈕)
    }

    // --- 修改：列表模式使用 Input Box 顯示 URL ---
    function renderListView(files) {
        console.log("Rendering list view...");
        if (!listTableBody) return;
        listTableBody.innerHTML = '';

        files.forEach(file => {
            const row = listTableBody.insertRow();
            row.dataset.fileId = file.id;

            // 預覽
            const cellPreview = row.insertCell();
            cellPreview.style.textAlign = 'center';
            if (file.file_type === 'image' && file.file_path) {
                const img = document.createElement('img');
                img.src = file.file_path; // 直接使用路徑
                img.alt = `預覽: ${escapeHtml(file.original_filename)}`;
                img.className = 'preview-icon';
                img.style.maxWidth = '60px';
                img.style.maxHeight = '40px';
                img.onerror = () => cellPreview.innerHTML = '<span class="preview-icon" title="圖片載入失敗" style="font-size: 1.5rem; color: #ffc107;">⚠️</span>';
                cellPreview.appendChild(img);
            } else if (file.file_type === 'pdf') {
                cellPreview.innerHTML = '<span class="preview-icon" title="PDF 文件" style="font-size: 1.5rem; color: #dc3545;">📄</span>';
            } else {
                cellPreview.innerHTML = '<span class="preview-icon" title="其他檔案" style="font-size: 1.5rem; color: #6c757d;">❓</span>';
            }

            // 原始檔名
            const cellOrigName = row.insertCell();
            cellOrigName.textContent = file.original_filename;
            cellOrigName.title = file.original_filename;

            // 檔案路徑 (URL) - 改用 Input Box
            const cellPath = row.insertCell();
            cellPath.style.wordBreak = 'break-all';
            cellPath.style.whiteSpace = 'normal';

            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.className = 'file-url-input'; // 套用新樣式
            urlInput.readOnly = true;

            const siteUrl = window.location.origin;
            const relativePath = file.file_path || '';
            const fullUrl = siteUrl + relativePath;
            urlInput.value = fullUrl; // 設定 input 的值為完整 URL

            urlInput.onclick = function() { this.select(); }; // 點擊選取

            cellPath.appendChild(urlInput);

            // 類型
            row.insertCell().textContent = file.file_type || '未知';

            // 大小
            const cellSize = row.insertCell();
            cellSize.textContent = formatBytes(file.size_bytes);
            cellSize.style.textAlign = 'right';

            // 操作
            const cellActions = row.insertCell();
            cellActions.style.textAlign = 'center';
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-file-btn btn btn-sm btn-danger';
            deleteBtn.textContent = '刪除';
            deleteBtn.dataset.fileId = file.id;
            deleteBtn.dataset.fileName = file.original_filename;
            cellActions.appendChild(deleteBtn);
        });
    }

    // --- 修改：格狀模式使用 Input Box 顯示 URL ---
    function renderGridView(files) {
        console.log("Rendering grid view...");
        if (!fileGridView) return;
        fileGridView.innerHTML = '';

        if (!Array.isArray(files) || files.length === 0) {
            fileGridView.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">找不到符合條件的檔案。</p>';
            return;
        }

        files.forEach(file => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.dataset.fileId = file.id;

            // 預覽區
            const previewDiv = document.createElement('div');
            previewDiv.className = 'preview';
            if (file.file_type === 'image' && file.file_path) {
                const img = document.createElement('img');
                img.src = file.file_path;
                img.alt = `預覽: ${escapeHtml(file.original_filename)}`;
                img.onerror = () => previewDiv.innerHTML = '<span title="圖片載入失敗" style="font-size: 2.5rem; color: #ffc107;">⚠️</span>';
                previewDiv.appendChild(img);
            } else if (file.file_type === 'pdf') {
                previewDiv.innerHTML = '<span title="PDF 文件" style="font-size: 2.5rem; color: #dc3545;">📄</span>';
            } else {
                previewDiv.innerHTML = '<span title="其他檔案" style="font-size: 2.5rem; color: #6c757d;">❓</span>';
            }
            card.appendChild(previewDiv);

            // 檔名
            const filenameDiv = document.createElement('div');
            filenameDiv.className = 'filename';
            filenameDiv.textContent = file.original_filename;
            filenameDiv.title = file.original_filename;
            card.appendChild(filenameDiv);

            // URL 顯示區 - 改用 Input Box
            const urlLineDiv = document.createElement('div');
            urlLineDiv.className = 'url-line';

            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.className = 'file-url-input';
            urlInput.readOnly = true;

            const siteUrl = window.location.origin;
            const relativePath = file.file_path || '';
            const fullUrl = siteUrl + relativePath;
            urlInput.value = fullUrl;

            urlInput.onclick = function() { this.select(); };

            urlLineDiv.appendChild(urlInput);
            card.appendChild(urlLineDiv);

            // Meta
            const metaDiv = document.createElement('div');
            metaDiv.className = 'meta';
            metaDiv.textContent = `類型: ${file.file_type || '未知'} | 大小: ${formatBytes(file.size_bytes)}`;
            card.appendChild(metaDiv);

            // 刪除按鈕
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-file-btn-grid btn btn-sm btn-danger';
            deleteBtn.textContent = '刪除';
            deleteBtn.dataset.fileId = file.id;
            deleteBtn.dataset.fileName = file.original_filename;
            card.appendChild(deleteBtn);

            fileGridView.appendChild(card);
        });
    }


    function renderPagination(totalPagesReceived, currentPageReceived) {
        totalPages = totalPagesReceived;
        currentPage = currentPageReceived;
        console.log(`Rendering pagination: Total ${totalPages}, Current ${currentPage}`);
        if (!paginationControls || totalPages <= 1) {
            if (paginationControls) paginationControls.innerHTML = '';
            return;
        }
        paginationControls.innerHTML = '';

        const createButton = (page, text, isDisabled = false, isActive = false) => {
            const button = document.createElement('button');
            button.dataset.page = page;
            button.textContent = text;
            button.disabled = isDisabled;
            button.className = 'page-btn';
            if (isActive) button.classList.add('active');
            if (isDisabled) button.classList.add('disabled');
            return button;
        };

        paginationControls.appendChild(createButton(currentPage - 1, '<< 上一頁', currentPage === 1));

        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        if (endPage - startPage + 1 < maxPagesToShow) { startPage = Math.max(1, endPage - maxPagesToShow + 1); }

        if (startPage > 1) {
            paginationControls.appendChild(createButton(1, '1'));
            if (startPage > 2) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; paginationControls.appendChild(ellipsis); }
        }
        for (let i = startPage; i <= endPage; i++) {
            paginationControls.appendChild(createButton(i, i.toString(), false, i === currentPage));
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; paginationControls.appendChild(ellipsis); }
            paginationControls.appendChild(createButton(totalPages, totalPages.toString()));
        }

        paginationControls.appendChild(createButton(currentPage + 1, '下一頁 >>', currentPage === totalPages));
    }

    function switchView(view) {
        if (view === currentView) return;
        currentView = view;
        console.log("Switching view to:", currentView);
        if (viewListBtn) viewListBtn.classList.toggle('active', currentView === 'list');
        if (viewGridBtn) viewGridBtn.classList.toggle('active', currentView === 'grid');
        if (fileListView) fileListView.style.display = currentView === 'list' ? 'block' : 'none';
        if (fileGridView) fileGridView.style.display = currentView === 'grid' ? 'grid' : 'none';
        // 重新 fetch 資料以在新的視圖中渲染
        fetchFiles();
    }

    async function handleUpload(event) {
        event.preventDefault();
        if (!fileInput.files || fileInput.files.length === 0) {
            uploadStatus.textContent = '請先選擇一個檔案！'; uploadStatus.style.color = 'orange'; return;
        }
        const file = fileInput.files[0];
        const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
             uploadStatus.textContent = '不支援的檔案類型！'; uploadStatus.style.color = 'red'; return;
        }
        if (file.size > 2 * 1024 * 1024) { // 2MB
             uploadStatus.textContent = '檔案大小超過 2MB 限制！'; uploadStatus.style.color = 'red'; return;
        }

        const formData = new FormData();
        formData.append('file', file);

        confirmUploadBtn.disabled = true; uploadStatus.textContent = '上傳中...'; uploadStatus.style.color = 'blue';

        try {
             const response = await fetch('/api/admin/files/upload', { method: 'POST', body: formData });
             const result = await response.json();
             if (!response.ok || !result.success) {
                 throw new Error(result.error || `上傳失敗 (${response.status})`);
             }
             uploadStatus.textContent = '上傳成功！正在刷新列表...'; uploadStatus.style.color = 'green';
             setTimeout(() => {
                 closeModal(uploadModal);
                 currentPage = 1;
                 currentSortBy = 'newest';
                 if(sortBySelect) sortBySelect.value = 'newest';
                 fetchFiles();
             }, 1000);
        } catch (error) {
            console.error('上傳檔案失敗:', error);
            uploadStatus.textContent = `上傳失敗: ${error.message}`; uploadStatus.style.color = 'red';
        } finally {
             confirmUploadBtn.disabled = false;
        }
    }

    // --- 移除：handleCopyUrl 函數 ---
    // function handleCopyUrl(event) { ... } // 整段刪除

    async function handleDeleteFile(event) {
        const button = event.target.closest('.delete-file-btn, .delete-file-btn-grid');
        if (!button) return;
        const fileId = button.dataset.fileId;
        const fileName = button.dataset.fileName || `檔案ID ${fileId}`;
        if (!fileId) return;

        if (!confirm(`確定要刪除檔案 "${escapeHtml(fileName)}" 嗎？\n此操作將從伺服器永久刪除檔案且無法復原！`)) {
            return;
        }

        try {
             button.disabled = true;
             button.textContent = '刪除中...';
             const response = await fetch(`/api/admin/files/${fileId}`, { method: 'DELETE' });
             if (response.status === 204 || response.ok) {
                 alert(`檔案 "${escapeHtml(fileName)}" 已成功刪除。`);
                 fetchFiles(); // 留在當前頁刷新
             } else {
                 const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                 throw new Error(errorData.error || `刪除失敗 (${response.status})`);
             }
        } catch (error) {
             console.error('刪除檔案失敗:', error);
             alert(`刪除檔案失敗: ${error.message}`);
             button.disabled = false;
             button.textContent = '刪除';
        }
    }

    function addActionButtonListeners() {
        const displayArea = document.getElementById('file-display-area');
        if (displayArea) {
            displayArea.removeEventListener('click', handleDynamicButtonClick);
            displayArea.addEventListener('click', handleDynamicButtonClick);
        }
    }

    // --- 修改：統一處理動態按鈕點擊的函數 (移除複製按鈕的處理) ---
    function handleDynamicButtonClick(event) {
        // 只處理刪除按鈕
        if (event.target.closest('.delete-file-btn, .delete-file-btn-grid')) {
            handleDeleteFile(event);
        }
        // 註：點擊 Input Box 的 select 功能是直接綁定在元素上的 onclick，不需要在這裡處理
    }


    // --- 事件監聽器綁定 (保持不變) ---
    if (uploadBtn) uploadBtn.addEventListener('click', () => {
         if(uploadForm) uploadForm.reset();
         if(uploadPreview) uploadPreview.innerHTML = '';
         if(uploadStatus) uploadStatus.textContent = '';
         openModal(uploadModal);
    });
    if (closeUploadModalBtn) closeUploadModalBtn.addEventListener('click', () => closeModal(uploadModal));
    if (uploadModal) uploadModal.addEventListener('click', (e) => { if (e.target === uploadModal) closeModal(uploadModal); });
    if (uploadForm) uploadForm.addEventListener('submit', handleUpload);
    if (fileInput) fileInput.addEventListener('change', () => {
        if(uploadPreview) uploadPreview.innerHTML = '';
        if(uploadStatus) uploadStatus.textContent = '';
        if (fileInput.files && fileInput.files[0]) {
             const file = fileInput.files[0];
             if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                 reader.onload = (e) => { if(uploadPreview) uploadPreview.innerHTML = `<img src="${e.target.result}" alt="預覽" style="max-width: 100%; max-height: 150px; object-fit: contain;">`; }
                 reader.readAsDataURL(file);
             } else if (file.type === 'application/pdf') {
                 if(uploadPreview) uploadPreview.innerHTML = '<span>📄 PDF 檔案已選擇</span>';
             } else {
                 if(uploadPreview) uploadPreview.innerHTML = `<span>其他檔案: ${escapeHtml(file.name)}</span>`;
             }
        }
    });
     uploadModalCancelBtns.forEach(btn => btn.addEventListener('click', () => closeModal(uploadModal)));

    // 篩選和排序控制
    if (searchInput) searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') { currentSearch = searchInput.value.trim(); currentPage = 1; fetchFiles(); } });
    if (typeFilter) typeFilter.addEventListener('change', () => { currentFileType = typeFilter.value; currentPage = 1; fetchFiles(); });
    if (sortBySelect) sortBySelect.addEventListener('change', () => { currentSortBy = sortBySelect.value; currentPage = 1; fetchFiles(); });
    if (refreshBtn) refreshBtn.addEventListener('click', () => fetchFiles());

    // 視圖切換
    if (viewListBtn) viewListBtn.addEventListener('click', () => switchView('list'));
    if (viewGridBtn) viewGridBtn.addEventListener('click', () => switchView('grid'));

    // 分頁控制 (事件委派)
    if (paginationControls) {
        paginationControls.addEventListener('click', (e) => {
            if (e.target.matches('button.page-btn') && !e.target.disabled) {
                const page = parseInt(e.target.dataset.page);
                if (!isNaN(page) && page !== currentPage) {
                    fetchFiles(page);
                }
            }
        });
    }

    // --- 初始化 ---
    console.log("Initializing File Admin Page...");
    fetchFiles(); // 初始載入第一頁

}); // End of DOMContentLoaded