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
    const viewModeDbBtn = document.getElementById('view-mode-db'); // 新增：資料庫模式按鈕
    const viewModeDiskBtn = document.getElementById('view-mode-disk'); // 新增：磁碟模式按鈕

    const fileLoading = document.getElementById('file-loading');
    const fileError = document.getElementById('file-error');

    // 資料庫視圖容器
    const fileListView = document.getElementById('file-list-view');
    const fileGridView = document.getElementById('file-grid-view');
    const listTableBody = document.querySelector('#file-list-table tbody');
    const paginationControls = document.getElementById('pagination-controls');

    // 磁碟檔案視圖容器
    const diskFileListView = document.getElementById('disk-file-list-view'); // 新增
    const diskFileGridView = document.getElementById('disk-file-grid-view'); // 新增
    const diskListTableBody = document.querySelector('#disk-file-list-table tbody'); // 新增

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
    let currentView = 'list'; // 'list' or 'grid' - 指的是列表或格狀
    let currentDataMode = 'database'; // 'database' or 'disk' - 指的是數據來源模式

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
        // 清理所有可能的視圖
        if (listTableBody) listTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">正在載入資料庫檔案...</td></tr>`;
        if (fileGridView) fileGridView.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">正在載入資料庫檔案...</p>';
        if (diskListTableBody) diskListTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">正在載入磁碟檔案...</td></tr>`; // 磁碟列表有7列
        if (diskFileGridView) diskFileGridView.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">正在載入磁碟檔案...</p>';
        
        if (paginationControls) paginationControls.innerHTML = ''; // 分頁只用於資料庫模式

        currentPage = page; // currentPage 主要用於資料庫模式的分頁

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
            console.log("API Response Data (DB Files):", data);
            renderFiles(data.files || []); // 這個 renderFiles 會根據 currentView 決定渲染到哪個 DB 視圖
            renderPagination(data.totalPages || 1, data.currentPage || 1); // 分頁只用於資料庫模式

        } catch (err) {
            console.error('❌ 獲取資料庫檔案列表失敗:', err);
            showError(`無法載入資料庫檔案列表：${err.message}`);
            if (listTableBody) listTableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align: center;">資料庫檔案載入失敗</td></tr>`;
            if (fileGridView) fileGridView.innerHTML = `<p style="color:red; text-align: center; grid-column: 1 / -1;">資料庫檔案載入失敗</p>`;
        } finally {
            showLoading(false);
        }
    }

    // 新增：獲取磁碟檔案列表
    async function fetchDiskFiles() {
        showLoading(true);
        hideError();
        if (diskListTableBody) diskListTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">正在載入磁碟檔案...</td></tr>`;
        if (diskFileGridView) diskFileGridView.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">正在載入磁碟檔案...</p>';
        if (paginationControls) paginationControls.innerHTML = ''; // 磁碟模式暫無分頁

        console.log(`Fetching disk files...`);

        try {
            const response = await fetch(`/api/admin/disk-files`);
            if (!response.ok) {
                let errorMsg = `HTTP 錯誤 ${response.status}`;
                try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
                throw new Error(`無法獲取磁碟檔案列表 (${errorMsg})`);
            }
            const diskFiles = await response.json();
            console.log("API Response Data (Disk Files):", diskFiles);
            renderDiskFiles(diskFiles || []);
        } catch (err) {
            console.error('❌ 獲取磁碟檔案列表失敗:', err);
            showError(`無法載入磁碟檔案列表：${err.message}`);
            if (diskListTableBody) diskListTableBody.innerHTML = `<tr><td colspan="7" style="color:red; text-align: center;">磁碟檔案載入失敗</td></tr>`;
            if (diskFileGridView) diskFileGridView.innerHTML = `<p style="color:red; text-align: center; grid-column: 1 / -1;">磁碟檔案載入失敗</p>`;
        } finally {
            showLoading(false);
        }
    }


    function renderFiles(files) { // 用於渲染資料庫檔案
        if (listTableBody) listTableBody.innerHTML = '';
        if (fileGridView) fileGridView.innerHTML = '';

        if (!Array.isArray(files) || files.length === 0) {
             if (currentView === 'list' && listTableBody) listTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">找不到符合條件的資料庫檔案。</td></tr>';
             if (currentView === 'grid' && fileGridView) fileGridView.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">找不到符合條件的資料庫檔案。</p>';
            return;
        }

        if (currentView === 'list') {
            renderDbListView(files);
        } else {
            renderDbGridView(files);
        }
        addActionButtonListeners();
    }

    // --- 修改：列表模式使用 Input Box 顯示 URL (針對資料庫檔案) ---
    function renderDbListView(files) {
        console.log("Rendering Database list view...");
        if (!listTableBody) return;
        listTableBody.innerHTML = '';

        files.forEach(file => {
            const row = listTableBody.insertRow();
            row.dataset.fileId = file.id; // 用於資料庫檔案的刪除

            // 預覽 (資料庫檔案)
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

    // 新增：渲染磁碟檔案列表
    function renderDiskFiles(diskFiles) {
        if (currentView === 'list') {
            renderDiskListView(diskFiles);
        } else {
            renderDiskGridView(diskFiles);
        }
        addActionButtonListeners(); // 確保為新渲染的按鈕綁定事件
    }

    function renderDiskListView(files) {
        console.log("Rendering Disk File list view...");
        if (!diskListTableBody) return;
        diskListTableBody.innerHTML = '';

        if (!Array.isArray(files) || files.length === 0) {
            diskListTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">找不到任何磁碟檔案。</td></tr>';
            return;
        }

        files.forEach(file => {
            const row = diskListTableBody.insertRow();
            row.dataset.filename = file.filename; // 用於磁碟檔案的刪除

            // 預覽
            const cellPreview = row.insertCell();
            cellPreview.style.textAlign = 'center';
            if (file.type === 'image' && file.urlPath) {
                const img = document.createElement('img');
                img.src = file.urlPath;
                img.alt = `預覽: ${escapeHtml(file.filename)}`;
                img.className = 'preview-icon';
                img.style.maxWidth = '60px'; img.style.maxHeight = '40px';
                img.onerror = () => cellPreview.innerHTML = '<span class="preview-icon" title="圖片載入失敗" style="font-size: 1.5rem; color: #ffc107;">⚠️</span>';
                cellPreview.appendChild(img);
            } else if (file.type === 'pdf') {
                cellPreview.innerHTML = '<img src="/images/pdf_icon.png" alt="PDF" class="preview-icon" style="width:30px; height:auto;">';
            } else {
                cellPreview.innerHTML = '<img src="/images/file_icon.png" alt="File" class="preview-icon" style="width:30px; height:auto;">';
            }

            // 檔名
            row.insertCell().textContent = file.filename;
            // URL 路徑
            const cellUrl = row.insertCell();
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.className = 'file-url-input';
            urlInput.readOnly = true;
            urlInput.value = window.location.origin + file.urlPath;
            urlInput.onclick = function() { this.select(); };
            cellUrl.appendChild(urlInput);
            // 類型
            row.insertCell().textContent = file.type;
            // 大小
            const cellSize = row.insertCell();
            cellSize.textContent = formatBytes(file.size);
            cellSize.style.textAlign = 'right';
            // 修改時間
            row.insertCell().textContent = file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : 'N/A';
            // 操作
            const cellActions = row.insertCell();
            cellActions.style.textAlign = 'center';
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-disk-file-btn btn btn-sm btn-danger'; // 新 class
            deleteBtn.textContent = '刪除';
            deleteBtn.dataset.filename = file.filename;
            cellActions.appendChild(deleteBtn);
        });
    }


    // --- 修改：格狀模式使用 Input Box 顯示 URL (針對資料庫檔案) ---
    function renderDbGridView(files) {
        console.log("Rendering Database grid view...");
        if (!fileGridView) return;
        fileGridView.innerHTML = '';

        if (!Array.isArray(files) || files.length === 0) {
            fileGridView.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">找不到符合條件的資料庫檔案。</p>';
            return;
        }

        files.forEach(file => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.dataset.fileId = file.id; // 用於資料庫檔案的刪除

            // 預覽區 (資料庫檔案)
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

    // 新增：渲染磁碟檔案格狀視圖
    function renderDiskGridView(files) {
        console.log("Rendering Disk File grid view...");
        if (!diskFileGridView) return;
        diskFileGridView.innerHTML = '';

        if (!Array.isArray(files) || files.length === 0) {
            diskFileGridView.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">找不到任何磁碟檔案。</p>';
            return;
        }

        files.forEach(file => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.dataset.filename = file.filename; // 用於磁碟檔案的刪除

            const previewDiv = document.createElement('div');
            previewDiv.className = 'preview';
            if (file.type === 'image' && file.urlPath) {
                const img = document.createElement('img');
                img.src = file.urlPath;
                img.alt = `預覽: ${escapeHtml(file.filename)}`;
                img.onerror = () => previewDiv.innerHTML = '<span title="圖片載入失敗" style="font-size: 2.5rem; color: #ffc107;">⚠️</span>';
                previewDiv.appendChild(img);
            } else if (file.type === 'pdf') {
                 previewDiv.innerHTML = '<img src="/images/pdf_icon.png" alt="PDF" style="max-width: 50px; max-height: 50px; object-fit: contain;">';
            } else {
                 previewDiv.innerHTML = '<img src="/images/file_icon.png" alt="File" style="max-width: 50px; max-height: 50px; object-fit: contain;">';
            }
            card.appendChild(previewDiv);

            const filenameDiv = document.createElement('div');
            filenameDiv.className = 'filename';
            filenameDiv.textContent = file.filename;
            filenameDiv.title = file.filename;
            card.appendChild(filenameDiv);
            
            const urlLineDiv = document.createElement('div');
            urlLineDiv.className = 'url-line';
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.className = 'file-url-input';
            urlInput.readOnly = true;
            urlInput.value = window.location.origin + file.urlPath;
            urlInput.onclick = function() { this.select(); };
            urlLineDiv.appendChild(urlInput);
            card.appendChild(urlLineDiv);

            const metaDiv = document.createElement('div');
            metaDiv.className = 'meta';
            metaDiv.innerHTML = `類型: ${file.type}<br>大小: ${formatBytes(file.size)}<br>修改: ${file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'N/A'}`;
            card.appendChild(metaDiv);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-disk-file-btn-grid btn btn-sm btn-danger'; // 新 class
            deleteBtn.textContent = '刪除';
            deleteBtn.dataset.filename = file.filename;
            card.appendChild(deleteBtn);

            diskFileGridView.appendChild(card);
        });
    }


    function renderPagination(totalPagesReceived, currentPageReceived) {
        totalPages = totalPagesReceived;
        currentPage = currentPageReceived;
        console.log(`Rendering pagination (DB mode): Total ${totalPages}, Current ${currentPage}`);
        if (!paginationControls) return;
        
        if (currentDataMode !== 'database' || totalPages <= 1) { // 只在資料庫模式且有多頁時顯示分頁
            paginationControls.innerHTML = '';
            return;
        }
        paginationControls.innerHTML = ''; // 清空舊的分頁

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

    function switchView(view) { // 切換列表/格狀
        if (view === currentView) return;
        currentView = view;
        console.log("Switching list/grid view to:", currentView);

        if (viewListBtn) viewListBtn.classList.toggle('active', currentView === 'list');
        if (viewGridBtn) viewGridBtn.classList.toggle('active', currentView === 'grid');

        // 根據 currentDataMode 顯示/隱藏正確的視圖容器
        document.querySelectorAll('.database-view').forEach(el => {
            el.style.display = (currentDataMode === 'database' && el.dataset.viewtype === currentView) ? (currentView === 'grid' ? 'grid' : 'block') : 'none';
        });
        document.querySelectorAll('.disk-view').forEach(el => {
            el.style.display = (currentDataMode === 'disk' && el.dataset.viewtype === currentView) ? (currentView === 'grid' ? 'grid' : 'block') : 'none';
        });
        
        // 如果當前是磁碟模式，且對應的視圖容器是空的，則獲取數據
        if (currentDataMode === 'disk') {
            const activeDiskView = (currentView === 'list') ? diskListTableBody : diskFileGridView;
            if (activeDiskView && activeDiskView.innerHTML.trim() === '') { // 簡單檢查是否為空
                fetchDiskFiles();
            }
        } else { // 資料庫模式總是重新獲取（因為有分頁和篩選）
             fetchFiles();
        }
    }

    function switchDataMode(mode) {
        if (mode === currentDataMode) return;
        currentDataMode = mode;
        console.log("Switching data mode to:", currentDataMode);

        if(viewModeDbBtn) viewModeDbBtn.classList.toggle('active', currentDataMode === 'database');
        if(viewModeDiskBtn) viewModeDiskBtn.classList.toggle('active', currentDataMode === 'disk');

        // 控制篩選器和分頁的可見性
        const dbControlsVisible = currentDataMode === 'database';
        if(searchInput) searchInput.style.display = dbControlsVisible ? '' : 'none';
        if(typeFilter) typeFilter.style.display = dbControlsVisible ? '' : 'none';
        if(sortBySelect) sortBySelect.style.display = dbControlsVisible ? '' : 'none';
        if(paginationControls) paginationControls.style.display = dbControlsVisible ? '' : 'none';


        // 根據新的數據模式和當前的列表/格狀視圖來顯示正確的容器
        switchView(currentView); // 調用 switchView 來處理容器的顯示/隱藏和數據獲取

        if (currentDataMode === 'database') {
            fetchFiles(1); // 切換回資料庫模式時，重置到第一頁並獲取數據
        } else if (currentDataMode === 'disk') {
            fetchDiskFiles(); // 切換到磁碟模式時，獲取磁碟檔案數據
        }
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
        if (event.target.closest('.delete-file-btn, .delete-file-btn-grid')) { // 資料庫檔案刪除
            handleDeleteFile(event);
        } else if (event.target.closest('.delete-disk-file-btn, .delete-disk-file-btn-grid')) { // 磁碟檔案刪除
            handleDeleteDiskFileClick(event);
        }
    }

    async function handleDeleteDiskFileClick(event) {
        const button = event.target.closest('.delete-disk-file-btn, .delete-disk-file-btn-grid');
        if (!button) return;
        const filename = button.dataset.filename;
        if (!filename) return;

        if (!confirm(`確定要從磁碟永久刪除檔案 "${escapeHtml(filename)}" 嗎？\n此操作無法復原！`)) {
            return;
        }

        try {
            button.disabled = true;
            button.textContent = '刪除中...';
            const response = await fetch(`/api/admin/disk-files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            if (response.status === 204 || response.ok) {
                alert(`檔案 "${escapeHtml(filename)}" 已成功從磁碟刪除。`);
                fetchDiskFiles(); // 刷新磁碟檔案列表
            } else {
                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                throw new Error(errorData.error || `刪除失敗 (${response.status})`);
            }
        } catch (error) {
            console.error('刪除磁碟檔案失敗:', error);
            alert(`刪除磁碟檔案失敗: ${error.message}`);
            button.disabled = false;
            button.textContent = '刪除';
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
    if (refreshBtn) refreshBtn.addEventListener('click', () => fetchFiles());

    // 視圖切換 (列表/格狀)
    if (viewListBtn) viewListBtn.addEventListener('click', () => switchView('list'));
    if (viewGridBtn) viewGridBtn.addEventListener('click', () => switchView('grid'));

    // 數據模式切換 (資料庫/磁碟)
    if (viewModeDbBtn) viewModeDbBtn.addEventListener('click', () => switchDataMode('database'));
    if (viewModeDiskBtn) viewModeDiskBtn.addEventListener('click', () => switchDataMode('disk'));


    // 分頁控制 (事件委派) - 只在資料庫模式下有效
    if (paginationControls) {
        paginationControls.addEventListener('click', (e) => {
            if (currentDataMode === 'database' && e.target.matches('button.page-btn') && !e.target.disabled) {
                const page = parseInt(e.target.dataset.page);
                if (!isNaN(page) && page !== currentPage) {
                    fetchFiles(page);
                }
            }
        });
    }

    // --- 初始化 ---
    console.log("Initializing File Admin Page...");
    // 預設載入資料庫檔案列表
    switchDataMode('database'); // 這會觸發 fetchFiles()

}); // End of DOMContentLoaded