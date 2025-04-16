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
        if (!+bytes) return '0 Bytes'; // Handle 0 or invalid input

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
             .replace(/&/g, "&")
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
        // 清空當前視圖的內容
        if (currentView === 'list' && listTableBody) listTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">正在載入...</td></tr>`;
        if (currentView === 'grid' && fileGridView) fileGridView.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">正在載入...</p>';
        if (paginationControls) paginationControls.innerHTML = '';

        currentPage = page; // 更新當前頁碼狀態

        console.log(`Fetching page ${currentPage}, filter: ${currentFileType}, sort: ${currentSortBy}, search: ${currentSearch}`);

        const params = new URLSearchParams({
            page: currentPage,
            limit: 15, // 每頁數量 (可以設為變數)
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

            console.log("API Response Data:", data); // 檢查返回的數據

            renderFiles(data.files || []); // 渲染檔案列表
            renderPagination(data.totalPages || 1, data.currentPage || 1); // 渲染分頁

        } catch (err) {
            console.error('❌ 獲取檔案列表失敗:', err);
            showError(`無法載入檔案列表：${err.message}`);
            // 清空兩個視圖的內容
            if (listTableBody) listTableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align: center;">載入失敗</td></tr>`;
            if (fileGridView) fileGridView.innerHTML = `<p style="color:red; text-align: center; grid-column: 1 / -1;">載入失敗</p>`;
        } finally {
            showLoading(false);
        }
    }

    function renderFiles(files) {
        // 先清空，確保舊數據被移除
        if (listTableBody) listTableBody.innerHTML = '';
        if (fileGridView) fileGridView.innerHTML = '';

        if (!Array.isArray(files) || files.length === 0) {
             if (currentView === 'list' && listTableBody) listTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">找不到符合條件的檔案。</td></tr>';
             if (currentView === 'grid' && fileGridView) fileGridView.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">找不到符合條件的檔案。</p>';
            return;
        }

        // 根據當前視圖渲染
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
        listTableBody.innerHTML = ''; // 確保再次清空

        files.forEach(file => {
            const row = listTableBody.insertRow();
            row.dataset.fileId = file.id;

            // 預覽
            const cellPreview = row.insertCell();
            cellPreview.style.textAlign = 'center';
            if (file.file_type === 'image' && file.file_path) {
                cellPreview.innerHTML = `<img src="${escapeHtml(file.file_path)}" alt="預覽" class="preview-icon" style="max-width: 60px; max-height: 40px;">`; // 限制大小
            } else if (file.file_type === 'pdf') {
                cellPreview.innerHTML = '<span class="preview-icon" style="font-size: 1.5rem; color: #dc3545;">📄</span>'; // PDF 圖示
            } else {
                cellPreview.innerHTML = '<span class="preview-icon" style="font-size: 1.5rem; color: #6c757d;">❓</span>'; // 其他檔案圖示
            }

            // 原始檔名
            const cellOrigName = row.insertCell();
            cellOrigName.textContent = file.original_filename;
            cellOrigName.title = file.original_filename;

            // 檔案路徑 (URL) + 複製按鈕
            const cellPath = row.insertCell();
            cellPath.style.wordBreak = 'break-all';
            cellPath.style.whiteSpace = 'normal';
            const pathSpan = document.createElement('span');


            // --- ▼▼▼ 修改這裡 ▼▼▼ ---
            const siteUrl = window.location.origin; // 獲取基礎 URL (例如 https://sunnyyummy.onrender.com)
            const relativePath = file.file_path || ''; // 確保有值
            const fullUrl = siteUrl + relativePath; // 拼接完整 URL
            pathSpan.textContent = fullUrl; // 顯示完整 URL
            // --- ▲▲▲ 修改結束 ▲▲▲ ---
           
           
           
           
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-url-btn btn btn-sm btn-outline-secondary'; // 使用 Bootstrap-like class
            copyBtn.textContent = '複製';
            copyBtn.dataset.filePath = file.file_path;
            cellPath.appendChild(pathSpan);
            cellPath.appendChild(copyBtn);

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
            deleteBtn.className = 'delete-file-btn btn btn-sm btn-danger'; // 使用 Bootstrap-like class
            deleteBtn.textContent = '刪除';
            deleteBtn.dataset.fileId = file.id;
            deleteBtn.dataset.fileName = file.original_filename;
            cellActions.appendChild(deleteBtn);
        });
    }

   // --- ★★★ 替換 renderGridView 函數 ★★★ ---
function renderGridView(files) {
    console.log("Rendering grid view...");
    if (!fileGridView) return;
    fileGridView.innerHTML = ''; // 清空

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
            // --- ▼▼▼ 修改開始 ▼▼▼ ---
            const img = document.createElement('img');
            img.src = file.file_path; // ★ 直接使用 file_path，不要 escapeHtml
            img.alt = `預覽: ${escapeHtml(file.original_filename)}`; // Alt text 還是需要 escape
            // ★ 添加 onerror 處理 ★
            img.onerror = () => {
                console.warn(`圖片預覽載入失敗: ${file.file_path}`);
                previewDiv.innerHTML = '<span title="圖片載入失敗" style="font-size: 2.5rem; color: #ffc107;">⚠️</span>'; // 顯示警告圖示
            };
            previewDiv.appendChild(img); // 將 img 元素加入 previewDiv
            // --- ▲▲▲ 修改結束 ▲▲▲ ---
        } else if (file.file_type === 'pdf') {
            previewDiv.innerHTML = '<span title="PDF 文件" style="font-size: 2.5rem; color: #dc3545;">📄</span>';
        } else {
            previewDiv.innerHTML = '<span title="其他檔案" style="font-size: 2.5rem; color: #6c757d;">❓</span>';
        }
        card.appendChild(previewDiv); // 添加預覽區

        // --- 檔名、URL、Meta、刪除按鈕 (保持不變) ---
        const filenameDiv = document.createElement('div');
        filenameDiv.className = 'filename';
        filenameDiv.textContent = file.original_filename;
        filenameDiv.title = file.original_filename;

        const urlLineDiv = document.createElement('div');
        urlLineDiv.className = 'url-line';
        const urlSpan = document.createElement('span');
        urlSpan.className = 'url-path';


  // --- ▼▼▼ 修改這裡 ▼▼▼ ---
  const siteUrl = window.location.origin; // 獲取基礎 URL
  const relativePath = file.file_path || ''; // 確保有值
  const fullUrl = siteUrl + relativePath; // 拼接完整 URL
  urlSpan.textContent = fullUrl; // 顯示完整 URL
  // --- ▲▲▲ 修改結束 ▲▲▲ ---




        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-url-btn-grid';
        copyBtn.textContent = '複製';
        copyBtn.dataset.filePath = file.file_path;
        urlLineDiv.appendChild(urlSpan);
        urlLineDiv.appendChild(copyBtn);

        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta';
        metaDiv.textContent = `類型: ${file.file_type || '未知'} | 大小: ${formatBytes(file.size_bytes)}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-file-btn-grid btn btn-sm btn-danger'; // 添加 btn class
        deleteBtn.textContent = '刪除';
        deleteBtn.dataset.fileId = file.id;
        deleteBtn.dataset.fileName = file.original_filename;

        card.appendChild(filenameDiv);
        card.appendChild(urlLineDiv);
        card.appendChild(metaDiv);
        card.appendChild(deleteBtn);
        // --- (保持不變的部分結束) ---

        fileGridView.appendChild(card);
    });
}
// --- ★★★ renderGridView 函數結束 ★★★ ---

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
            button.className = 'page-btn'; // 基礎 class
            if (isActive) button.classList.add('active'); // 當前頁
            if (isDisabled) button.classList.add('disabled'); // 禁用狀態
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
        // 重新渲染，因為 DOM 結構不同，但不需要重新 fetch
        // 需要一個變數來儲存上次 fetch 的結果
        // 為了簡化，我們還是重新 fetch
        fetchFiles();
    }

    async function handleUpload(event) {
        event.preventDefault();
        if (!fileInput.files || fileInput.files.length === 0) {
            uploadStatus.textContent = '請先選擇一個檔案！'; uploadStatus.style.color = 'orange'; return;
        }
        const file = fileInput.files[0];
        // 可以在此處添加檔案大小或類型的客戶端驗證
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
                 currentPage = 1; // 上傳後跳回第一頁
                 currentSortBy = 'newest'; // 按最新排序
                 sortBySelect.value = 'newest'; // 更新下拉選單
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
        const button = event.target.closest('.copy-url-btn, .copy-url-btn-grid');
        if (!button) return;


  // --- ▼▼▼ 修改/添加這裡 ▼▼▼ ---
  const relativePath = button.dataset.filePath; // 從 data-* 獲取相對路徑
  if (!relativePath) return; // 如果沒有路徑，不執行

  const siteUrl = window.location.origin; // 獲取基礎 URL
  const fullUrl = siteUrl + relativePath; // 拼接成完整 URL
  // --- ▲▲▲ 修改/添加結束 ▲▲▲ ---
        navigator.clipboard.writeText(filePath).then(() => {
            const originalText = button.textContent;
            button.textContent = '✓'; // 用打勾符號
            button.classList.add('copy-success-indicator');
            button.disabled = true; // 複製後禁用一段時間
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copy-success-indicator');
                button.disabled = false;
            }, 1500);
        }).catch(err => {
            console.error('複製 URL 失敗:', err);
            alert('複製 URL 失敗，請手動複製。\n可能需要瀏覽器允許剪貼簿權限。');
        });
    }

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
                 // 刪除成功後留在當前頁刷新
                 fetchFiles();
             } else {
                 const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                 throw new Error(errorData.error || `刪除失敗 (${response.status})`);
             }
        } catch (error) {
             console.error('刪除檔案失敗:', error);
             alert(`刪除檔案失敗: ${error.message}`);
             button.disabled = false; // 恢復按鈕
             button.textContent = '刪除'; // 恢復文字
        }
    }

    function addActionButtonListeners() {
        const displayArea = document.getElementById('file-display-area');
        if (displayArea) {
            // 使用事件委派處理動態生成的按鈕
            displayArea.removeEventListener('click', handleDynamicButtonClick); // 移除舊監聽器
            displayArea.addEventListener('click', handleDynamicButtonClick); // 添加新監聽器
        }
    }

    // 統一處理動態按鈕點擊的函數
    function handleDynamicButtonClick(event) {
        if (event.target.closest('.copy-url-btn, .copy-url-btn-grid')) {
            handleCopyUrl(event);
        } else if (event.target.closest('.delete-file-btn, .delete-file-btn-grid')) {
            handleDeleteFile(event);
        }
    }


    // --- 事件監聽器綁定 ---
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
    if (refreshBtn) refreshBtn.addEventListener('click', () => fetchFiles()); // 刷新使用當前參數

    // 視圖切換
    if (viewListBtn) viewListBtn.addEventListener('click', () => switchView('list'));
    if (viewGridBtn) viewGridBtn.addEventListener('click', () => switchView('grid'));

    // 分頁控制 (事件委派)
    if (paginationControls) {
        paginationControls.addEventListener('click', (e) => {
            if (e.target.matches('button.page-btn') && !e.target.disabled) { // 使用 .page-btn class
                const page = parseInt(e.target.dataset.page);
                if (!isNaN(page) && page !== currentPage) {
                    fetchFiles(page); // Fetch the requested page
                }
            }
        });
    }

    // --- 初始化 ---
    console.log("Initializing File Admin Page...");
    fetchFiles(); // 初始載入第一頁

}); // End of DOMContentLoaded