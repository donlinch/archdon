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
    function formatBytes(bytes, decimals = 2) { /* ... 省略，稍後添加 ... */ }
    function escapeHtml(unsafe) { /* ... 省略，稍後添加 ... */ }

    // --- 主要功能函數 (待填充) ---
    async function fetchFiles() {
        showLoading(true);
        hideError();
        if (currentView === 'list' && listTableBody) listTableBody.innerHTML = '';
        if (currentView === 'grid' && fileGridView) fileGridView.innerHTML = '';
        if (paginationControls) paginationControls.innerHTML = '';
        console.log(`Fetching page ${currentPage}, filter: ${currentFileType}, sort: ${currentSortBy}, search: ${currentSearch}`);

        // TODO: 呼叫 GET /api/admin/files API
        // TODO: 處理回應
        // TODO: 呼叫 renderFiles
        // TODO: 呼叫 renderPagination
        // TODO: 錯誤處理
        // TODO: 隱藏 Loading

        // 模擬載入
        await new Promise(resolve => setTimeout(resolve, 500));
        showLoading(false);
        if (currentView === 'list' && listTableBody) listTableBody.innerHTML = '<tr><td colspan="6">尚未載入資料</td></tr>';
         if (currentView === 'grid' && fileGridView) fileGridView.innerHTML = '<p>尚未載入資料</p>';
        console.warn("fetchFiles 尚未完全實作！");
    }

    function renderFiles(files) {
        if (currentView === 'list') {
            renderListView(files);
        } else {
            renderGridView(files);
        }
        addActionButtonListeners(); // 渲染後綁定事件
    }

    function renderListView(files) {
        console.log("Rendering list view...");
        if (!listTableBody) return;
        // TODO: 填充表格內容
         listTableBody.innerHTML = '<tr><td colspan="6">列表視圖待實作...</td></tr>';
    }

    function renderGridView(files) {
        console.log("Rendering grid view...");
        if (!fileGridView) return;
        // TODO: 填充卡片內容
        fileGridView.innerHTML = '<p>格狀視圖待實作...</p>';
    }

    function renderPagination(totalPagesReceived, currentPageReceived) {
        totalPages = totalPagesReceived;
        currentPage = currentPageReceived;
        console.log(`Rendering pagination: Total ${totalPages}, Current ${currentPage}`);
        if (!paginationControls) return;
        // TODO: 實作分頁按鈕
        paginationControls.innerHTML = `<span>分頁待實作 (總 ${totalPages} 頁)</span>`;
    }

    function switchView(view) {
        if (view === currentView) return;
        currentView = view;
        console.log("Switching view to:", currentView);
        if (viewListBtn) viewListBtn.classList.toggle('active', currentView === 'list');
        if (viewGridBtn) viewGridBtn.classList.toggle('active', currentView === 'grid');
        if (fileListView) fileListView.style.display = currentView === 'list' ? 'block' : 'none';
        if (fileGridView) fileGridView.style.display = currentView === 'grid' ? 'grid' : 'none'; // grid 使用 grid 佈局
        // 通常切換視圖後需要重新獲取數據並渲染，因為元素結構不同
        fetchFiles();
    }

    async function handleUpload(event) {
        event.preventDefault();
        if (!fileInput.files || fileInput.files.length === 0) {
            uploadStatus.textContent = '請先選擇一個檔案！'; uploadStatus.style.color = 'orange'; return;
        }
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file); // 確保欄位名是 'file'

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
                 fetchFiles(); // 上傳成功後刷新列表
             }, 1000);
        } catch (error) {
            console.error('上傳檔案失敗:', error);
            uploadStatus.textContent = `上傳失敗: ${error.message}`; uploadStatus.style.color = 'red';
        } finally {
             confirmUploadBtn.disabled = false;
        }
    }

    function handleCopyUrl(event) {
        const button = event.target.closest('.copy-url-btn, .copy-url-btn-grid'); // 處理兩種按鈕
        if (!button) return;
        const filePath = button.dataset.filePath;
        if (!filePath) return;

        navigator.clipboard.writeText(filePath).then(() => {
            const originalText = button.textContent;
            button.textContent = '已複製!';
            button.classList.add('copy-success-indicator');
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copy-success-indicator');
            }, 1500);
        }).catch(err => {
            console.error('複製 URL 失敗:', err);
            alert('複製 URL 失敗，請手動複製。');
        });
    }

    async function handleDeleteFile(event) {
        const button = event.target.closest('.delete-file-btn, .delete-file-btn-grid');
        if (!button) return;
        const fileId = button.dataset.fileId;
        const fileName = button.dataset.fileName || `檔案ID ${fileId}`;
        if (!fileId) return;

        if (!confirm(`確定要刪除檔案 "${fileName}" 嗎？\n此操作將從伺服器永久刪除檔案且無法復原！`)) {
            return;
        }

        try {
             button.disabled = true; // 禁用按鈕防止重複點擊
             const response = await fetch(`/api/admin/files/${fileId}`, { method: 'DELETE' });
             if (response.status === 204 || response.ok) {
                 alert(`檔案 "${fileName}" 已成功刪除。`);
                 fetchFiles(); // 刪除成功後刷新
             } else {
                 const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                 throw new Error(errorData.error || `刪除失敗 (${response.status})`);
             }
        } catch (error) {
             console.error('刪除檔案失敗:', error);
             alert(`刪除檔案失敗: ${error.message}`);
             button.disabled = false; // 恢復按鈕
        }
    }

    function addActionButtonListeners() {
        // 使用事件委派來處理複製和刪除
        const displayArea = document.getElementById('file-display-area');
        if (displayArea) {
            // 先移除舊監聽器，避免重複綁定
            displayArea.removeEventListener('click', handleCopyUrl);
            displayArea.removeEventListener('click', handleDeleteFile);
            // 再添加新的
            displayArea.addEventListener('click', handleCopyUrl);
            displayArea.addEventListener('click', handleDeleteFile);
        }
    }

    // --- 事件監聽器綁定 ---
    if (uploadBtn) uploadBtn.addEventListener('click', () => {
         uploadForm.reset(); uploadPreview.innerHTML = ''; uploadStatus.textContent = '';
         openModal(uploadModal);
    });
    if (closeUploadModalBtn) closeUploadModalBtn.addEventListener('click', () => closeModal(uploadModal));
    if (uploadModal) uploadModal.addEventListener('click', (e) => { if (e.target === uploadModal) closeModal(uploadModal); });
    if (uploadForm) uploadForm.addEventListener('submit', handleUpload);
    if (fileInput) fileInput.addEventListener('change', () => { // 檔案選擇預覽
        uploadPreview.innerHTML = ''; uploadStatus.textContent = '';
        if (fileInput.files && fileInput.files[0]) {
             const file = fileInput.files[0];
             if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                 reader.onload = (e) => { uploadPreview.innerHTML = `<img src="${e.target.result}" alt="預覽" style="max-width: 100%; max-height: 150px; object-fit: contain;">`; }
                 reader.readAsDataURL(file);
             } else if (file.type === 'application/pdf') {
                 uploadPreview.innerHTML = '<span>📄 PDF 檔案已選擇</span>';
             } else {
                 uploadPreview.innerHTML = `<span>其他檔案: ${escapeHtml(file.name)}</span>`;
             }
        }
    });
     uploadModalCancelBtns.forEach(btn => btn.addEventListener('click', () => closeModal(uploadModal)));


    if (searchInput) searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') { currentSearch = searchInput.value.trim(); currentPage = 1; fetchFiles(); } });
    if (typeFilter) typeFilter.addEventListener('change', () => { currentFileType = typeFilter.value; currentPage = 1; fetchFiles(); });
    if (sortBySelect) sortBySelect.addEventListener('change', () => { currentSortBy = sortBySelect.value; currentPage = 1; fetchFiles(); });
    if (refreshBtn) refreshBtn.addEventListener('click', () => fetchFiles());
    if (viewListBtn) viewListBtn.addEventListener('click', () => switchView('list'));
    if (viewGridBtn) viewGridBtn.addEventListener('click', () => switchView('grid'));
    if (paginationControls) paginationControls.addEventListener('click', (e) => {
        if (e.target.matches('button') && !e.target.disabled) {
            const page = parseInt(e.target.dataset.page);
            if (!isNaN(page) && page !== currentPage) { fetchFiles(page); }
        }
    });

    // --- 初始化 ---
    console.log("Initializing File Admin Page...");
    fetchFiles(); // 初始載入第一頁

});