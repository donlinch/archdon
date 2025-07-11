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
    const viewModeDbBtn = document.getElementById('view-mode-db');
    const viewModeDiskBtn = document.getElementById('view-mode-disk');

    const fileLoading = document.getElementById('file-loading');
    const fileError = document.getElementById('file-error');

    // 資料庫視圖容器
    const fileListView = document.getElementById('file-list-view');
    const fileGridView = document.getElementById('file-grid-view');
    const listTableBody = document.querySelector('#file-list-table tbody');
    const paginationControls = document.getElementById('pagination-controls');

    // 磁碟檔案視圖容器
    const diskFileListView = document.getElementById('disk-file-list-view');
    const diskFileGridView = document.getElementById('disk-file-grid-view');
    const diskListTableBody = document.querySelector('#disk-file-list-table tbody');

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
 let currentSortBy = 'newest';       // For DB mode when/if switched
 let currentFileType = 'all';        // For DB mode when/if switched
 let currentSearch = '';           // For DB mode when/if switched
 
 // ★★★ 設定期望的初始狀態 ★★★
 let currentView = 'grid';           // 初始視圖為格狀
 let currentDataMode = 'disk';         // 初始數據模式為磁碟

 // 磁碟檔案模式的狀態
 let currentDiskPage = 1;
 let totalDiskPages = 1;
 let currentDiskSortBy = 'date_desc';  // 初始排序 (磁碟模式)

    // --- 輔助函數 ---
    const showLoading = (show) => { if(fileLoading) fileLoading.style.display = show ? 'block' : 'none'; };
    const showError = (message) => { if(fileError) { fileError.textContent = message; fileError.style.display = 'block'; } };
    const hideError = () => { if(fileError) fileError.style.display = 'none'; };
    const openModal = (modal) => { if(modal) modal.style.display = 'flex'; };
    const closeModal = (modal) => { if(modal) modal.style.display = 'none'; };

    // 複製文本到剪貼板並顯示視覺反饋
    function copyToClipboard(input) {
        input.select(); // 選中文本
        document.execCommand('copy'); // 複製到剪貼板
        
        // 添加視覺反饋
        input.classList.add('copied');
        
        // 2秒後移除視覺反饋
        setTimeout(() => {
            input.classList.remove('copied');
        }, 2000);
    }

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
        return unsafe.toString()
              .replace(/&/g, '&amp;')
        
                // < 轉成 & l t ;
                .replace(/</g, '&lt;')
        
                // > 轉成 & g t ;
                .replace(/>/g, '&gt;')
        
                // " 轉成 & q u o t ;
                .replace(/"/g, '&quot;')
        
                // ' 轉成 & # 3 9 ;  (數字實體)
                .replace(/'/g, '&#39;');
    }

    // --- 主要功能函數 ---
    async function fetchFiles(page = currentPage) { // For Database Files
        showLoading(true);
        hideError();
        currentPage = page;
        if (listTableBody) listTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">正在載入資料庫檔案...</td></tr>`;
        if (fileGridView) fileGridView.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">正在載入資料庫檔案...</p>';
        if (paginationControls) paginationControls.innerHTML = '';

        console.log(`Fetching DB files: page ${currentPage}, filter: ${currentFileType}, sort: ${currentSortBy}, search: ${currentSearch}`);
        const params = new URLSearchParams({
            page: currentPage,
            limit: 50,
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
            renderFiles(data.files || []);
            renderPagination(data.totalPages || 1, data.currentPage || 1);
        } catch (err) {
            console.error('❌ 獲取資料庫檔案列表失敗:', err);
            showError(`無法載入資料庫檔案列表：${err.message}`);
            if (listTableBody) listTableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align: center;">資料庫檔案載入失敗</td></tr>`;
            if (fileGridView) fileGridView.innerHTML = `<p style="color:red; text-align: center; grid-column: 1 / -1;">資料庫檔案載入失敗</p>`;
        } finally {
            showLoading(false);
        }
    }

    async function fetchDiskFiles(page = currentDiskPage) { // For Disk Files
        showLoading(true);
        hideError();
        currentDiskPage = page;
        if (diskListTableBody) diskListTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">正在載入磁碟檔案...</td></tr>`;
        if (diskFileGridView) diskFileGridView.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">正在載入磁碟檔案...</p>';
        if (paginationControls) paginationControls.innerHTML = '';

        console.log(`Fetching disk files: page ${currentDiskPage}, sort: ${currentDiskSortBy}`);
        const params = new URLSearchParams({
            page: currentDiskPage,
            limit: 15,
            sortBy: currentDiskSortBy
        });
        try {
            const response = await fetch(`/api/admin/disk-files?${params.toString()}`);
            if (!response.ok) {
                let errorMsg = `HTTP 錯誤 ${response.status}`;
                try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
                throw new Error(`無法獲取磁碟檔案列表 (${errorMsg})`);
            }
            const data = await response.json();
            renderDiskFiles(data.files || []);
            totalDiskPages = data.totalPages || 1;
            renderDiskPagination(totalDiskPages, data.currentPage || 1);
        } catch (err) {
            console.error('❌ 獲取磁碟檔案列表失敗:', err);
            showError(`無法載入磁碟檔案列表：${err.message}`);
            if (diskListTableBody) diskListTableBody.innerHTML = `<tr><td colspan="7" style="color:red; text-align: center;">磁碟檔案載入失敗</td></tr>`;
            if (diskFileGridView) diskFileGridView.innerHTML = `<p style="color:red; text-align: center; grid-column: 1 / -1;">磁碟檔案載入失敗</p>`;
        } finally {
            showLoading(false);
        }
    }

    function renderFiles(files) { // Renders DB files
        if (listTableBody) listTableBody.innerHTML = '';
        if (fileGridView) fileGridView.innerHTML = '';
        if (!Array.isArray(files) || files.length === 0) {
             if (currentView === 'list' && listTableBody) listTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">找不到符合條件的資料庫檔案。</td></tr>';
             if (currentView === 'grid' && fileGridView) fileGridView.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">找不到符合條件的資料庫檔案。</p>';
            return;
        }
        if (currentView === 'list') renderDbListView(files);
        else renderDbGridView(files);
        addActionButtonListeners();
    }

    function renderDbListView(files) {
        if (!listTableBody) return;
        listTableBody.innerHTML = '';
        files.forEach(file => {
            const row = listTableBody.insertRow();
            row.dataset.fileId = file.id;
            const cellPreview = row.insertCell();
            cellPreview.style.textAlign = 'center';
            if (file.file_type === 'image' && file.file_path) {
                const img = document.createElement('img');
                img.src = file.file_path;
                img.alt = `預覽: ${escapeHtml(file.original_filename)}`;
                img.className = 'preview-icon';
                img.onerror = () => cellPreview.innerHTML = '<span class="preview-icon" title="圖片載入失敗">⚠️</span>';
                cellPreview.appendChild(img);
            } else if (file.file_type === 'pdf') {
                cellPreview.innerHTML = '<span class="preview-icon" title="PDF 文件">📄</span>';
            } else {
                cellPreview.innerHTML = '<span class="preview-icon" title="其他檔案">❓</span>';
            }
            row.insertCell().textContent = file.original_filename;
            const cellPath = row.insertCell();
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.className = 'file-url-input';
            urlInput.readOnly = true;
            urlInput.value = window.location.origin + (file.file_path || '');
            urlInput.onclick = function() { copyToClipboard(this); };
            cellPath.appendChild(urlInput);
            row.insertCell().textContent = file.file_type || '未知';
            const cellSize = row.insertCell();
            cellSize.textContent = formatBytes(file.size_bytes);
            cellSize.style.textAlign = 'right';
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

    function renderDbGridView(files) {
        if (!fileGridView) return;
        fileGridView.innerHTML = '';
        files.forEach(file => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.dataset.fileId = file.id;
            const previewDiv = document.createElement('div');
            previewDiv.className = 'preview';
            if (file.file_type === 'image' && file.file_path) {
                const img = document.createElement('img');
                img.src = file.file_path;
                img.alt = `預覽: ${escapeHtml(file.original_filename)}`;
                img.onerror = () => previewDiv.innerHTML = '<span title="圖片載入失敗">⚠️</span>';
                previewDiv.appendChild(img);
            } else if (file.file_type === 'pdf') {
                previewDiv.innerHTML = '<span title="PDF 文件">📄</span>';
            } else {
                previewDiv.innerHTML = '<span title="其他檔案">❓</span>';
            }
            card.appendChild(previewDiv);
            const filenameDiv = document.createElement('div');
            filenameDiv.className = 'filename';
            filenameDiv.textContent = file.original_filename;
            card.appendChild(filenameDiv);
            const urlLineDiv = document.createElement('div');
            urlLineDiv.className = 'url-line';
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.className = 'file-url-input';
            urlInput.readOnly = true;
            urlInput.value = window.location.origin + (file.file_path || '');
            urlInput.onclick = function() { copyToClipboard(this); };
            urlLineDiv.appendChild(urlInput);
            card.appendChild(urlLineDiv);
            const metaDiv = document.createElement('div');
            metaDiv.className = 'meta';
            metaDiv.textContent = `類型: ${file.file_type || '未知'} | 大小: ${formatBytes(file.size_bytes)}`;
            card.appendChild(metaDiv);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-file-btn-grid btn btn-sm btn-danger';
            deleteBtn.textContent = '刪除';
            deleteBtn.dataset.fileId = file.id;
            deleteBtn.dataset.fileName = file.original_filename;
            card.appendChild(deleteBtn);
            fileGridView.appendChild(card);
        });
    }

    function renderDiskFiles(files) { // Renders Disk files
        if (diskListTableBody) diskListTableBody.innerHTML = '';
        if (diskFileGridView) diskFileGridView.innerHTML = '';
        if (!Array.isArray(files) || files.length === 0) {
            if (currentView === 'list' && diskListTableBody) diskListTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">找不到任何磁碟檔案。</td></tr>';
            if (currentView === 'grid' && diskFileGridView) diskFileGridView.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">找不到任何磁碟檔案。</p>';
            return;
        }
        if (currentView === 'list') renderDiskListView(files);
        else renderDiskGridView(files);
        addActionButtonListeners();
    }

    function renderDiskListView(files) {
        if (!diskListTableBody) return;
        diskListTableBody.innerHTML = '';
        files.forEach(file => {
            const row = diskListTableBody.insertRow();
            row.dataset.filename = file.filename;
            const cellPreview = row.insertCell();
            cellPreview.style.textAlign = 'center';
            if (file.type === 'image' && file.urlPath) {
                const img = document.createElement('img');
                img.src = file.urlPath;
                img.alt = `預覽: ${escapeHtml(file.filename)}`;
                img.className = 'preview-icon'; // 確保有這個 class
                img.style.maxWidth = '60px';    // 與 DB 視圖一致
                img.style.maxHeight = '40px';   // 與 DB 視圖一致
                img.style.objectFit = 'contain';// 確保圖片等比縮放
                img.onerror = () => cellPreview.innerHTML = '<span class="preview-icon" title="圖片載入失敗">⚠️</span>';
                cellPreview.appendChild(img);
            } else if (file.type === 'pdf') {
                // 使用 CSS class 控制大小，而不是內聯 style 的 width/height
                cellPreview.innerHTML = '<img src="/images/pdf_icon.png" alt="PDF" class="preview-icon">';
            } else {
                cellPreview.innerHTML = '<img src="/images/file_icon.png" alt="File" class="preview-icon">';
            }
            row.insertCell().textContent = file.filename;
            const cellUrl = row.insertCell();
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.className = 'file-url-input';
            urlInput.readOnly = true;
            urlInput.value = window.location.origin + file.urlPath;
            urlInput.onclick = function() { copyToClipboard(this); };
            cellUrl.appendChild(urlInput);
            row.insertCell().textContent = file.type;
            const cellSize = row.insertCell();
            cellSize.textContent = formatBytes(file.size);
            cellSize.style.textAlign = 'right';
            row.insertCell().textContent = file.modifiedTimeString || (file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : 'N/A');
            const cellActions = row.insertCell();
            cellActions.style.textAlign = 'center';
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-disk-file-btn btn btn-sm btn-danger';
            deleteBtn.textContent = '刪除';
            deleteBtn.dataset.filename = file.filename;
            cellActions.appendChild(deleteBtn);
        });
    }

    function renderDiskGridView(files) {
        if (!diskFileGridView) return;
        diskFileGridView.innerHTML = '';
        files.forEach(file => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.dataset.filename = file.filename;
            const previewDiv = document.createElement('div');
            previewDiv.className = 'preview';
            if (file.type === 'image' && file.urlPath) {
                const img = document.createElement('img');
                img.src = file.urlPath;
                img.alt = `預覽: ${escapeHtml(file.filename)}`;
                img.onerror = () => previewDiv.innerHTML = '<span title="圖片載入失敗">⚠️</span>';
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
            card.appendChild(filenameDiv);
            const urlLineDiv = document.createElement('div');
            urlLineDiv.className = 'url-line';
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.className = 'file-url-input';
            urlInput.readOnly = true;
            urlInput.value = window.location.origin + file.urlPath;
            urlInput.onclick = function() { copyToClipboard(this); };
            urlLineDiv.appendChild(urlInput);
            card.appendChild(urlLineDiv);
            const metaDiv = document.createElement('div');
            metaDiv.className = 'meta';
            const modifiedTimeDisplay = file.modifiedTimeString || (file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'N/A');
            metaDiv.innerHTML = `類型: ${file.type}<br>大小: ${formatBytes(file.size)}<br>修改: ${modifiedTimeDisplay}`;
            card.appendChild(metaDiv);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-disk-file-btn-grid btn btn-sm btn-danger';
            deleteBtn.textContent = '刪除';
            deleteBtn.dataset.filename = file.filename;
            card.appendChild(deleteBtn);
            diskFileGridView.appendChild(card);
        });
    }

    function renderPagination(totalPagesReceived, currentPageReceived) { // For DB mode
        totalPages = totalPagesReceived;
        currentPage = currentPageReceived;
        if (!paginationControls || currentDataMode !== 'database' || totalPages <= 1) {
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

    function renderDiskPagination(totalPagesReceived, currentPageReceived) { // For Disk mode
        totalDiskPages = totalPagesReceived;
        currentDiskPage = currentPageReceived;
        if (!paginationControls || currentDataMode !== 'disk' || totalDiskPages <= 1) {
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
        paginationControls.appendChild(createButton(currentDiskPage - 1, '<< 上一頁', currentDiskPage === 1));
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentDiskPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalDiskPages, startPage + maxPagesToShow - 1);
        if (endPage - startPage + 1 < maxPagesToShow) { startPage = Math.max(1, endPage - maxPagesToShow + 1); }
        if (startPage > 1) {
            paginationControls.appendChild(createButton(1, '1'));
            if (startPage > 2) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; paginationControls.appendChild(ellipsis); }
        }
        for (let i = startPage; i <= endPage; i++) {
            paginationControls.appendChild(createButton(i, i.toString(), false, i === currentDiskPage));
        }
        if (endPage < totalDiskPages) {
            if (endPage < totalDiskPages - 1) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; paginationControls.appendChild(ellipsis); }
            paginationControls.appendChild(createButton(totalDiskPages, totalDiskPages.toString()));
        }
        paginationControls.appendChild(createButton(currentDiskPage + 1, '下一頁 >>', currentDiskPage === totalDiskPages));
    }








    function updateSortByOptions() {
        if (!sortBySelect) return;
        const previousValue = sortBySelect.value; // 保存用戶可能已選的值
        sortBySelect.innerHTML = '';
        let options;
        let defaultSortValue;

        if (currentDataMode === 'database') {
            options = [
                { value: 'newest', text: '最新上傳 (資料庫)' },
                { value: 'oldest', text: '最早上傳 (資料庫)' },
                { value: 'name_asc', text: '名稱 (A-Z)' },
                { value: 'name_desc', text: '名稱 (Z-A)' },
                { value: 'size_asc', text: '大小 (小→大)' },
                { value: 'size_desc', text: '大小 (大→小)' }
            ];
            defaultSortValue = 'newest';
            currentSortBy = options.some(opt => opt.value === previousValue) && previousValue ? previousValue : defaultSortValue;
        } else { // disk mode
            options = [
                { value: 'date_desc', text: '修改日期 (新→舊)' },
                { value: 'date_asc', text: '修改日期 (舊→新)' },
                { value: 'name_asc', text: '名稱 (A-Z)' },
                { value: 'name_desc', text: '名稱 (Z-A)' },
                { value: 'size_asc', text: '大小 (小→大)' },
                { value: 'size_desc', text: '大小 (大→小)' }
            ];
            defaultSortValue = 'date_desc';
            currentDiskSortBy = options.some(opt => opt.value === previousValue) && previousValue ? previousValue : defaultSortValue;
        }

        options.forEach(opt => {
            const optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.textContent = opt.text;
            sortBySelect.appendChild(optionEl);
        });
        
        // 設置 sortBySelect 的當前值
        if (currentDataMode === 'database') {
            sortBySelect.value = currentSortBy;
        } else {
            sortBySelect.value = currentDiskSortBy;
        }
    }

    function switchView(view) { // view 是 'list' 或 'grid'
        if (view === currentView && 
            ((currentDataMode === 'database' && (currentView === 'list' ? fileListView.style.display !== 'none' : fileGridView.style.display !== 'none')) ||
             (currentDataMode === 'disk' && (currentView === 'list' ? diskFileListView.style.display !== 'none' : diskFileGridView.style.display !== 'none')))
        ) {
             // 如果目標視圖已經是當前視圖且已顯示，則不重複操作
            return;
        }
        currentView = view;

        if (viewListBtn) viewListBtn.classList.toggle('active', currentView === 'list');
        if (viewGridBtn) viewGridBtn.classList.toggle('active', currentView === 'grid');

        // 先隱藏所有主要視圖容器
        if(fileListView) fileListView.style.display = 'none';
        if(fileGridView) fileGridView.style.display = 'none';
        if(diskFileListView) diskFileListView.style.display = 'none';
        if(diskFileGridView) diskFileGridView.style.display = 'none';

        // 根據 currentDataMode 和 currentView 顯示正確的容器
        if (currentDataMode === 'database') {
            if (currentView === 'list' && fileListView) fileListView.style.display = 'block';
            else if (currentView === 'grid' && fileGridView) fileGridView.style.display = 'grid';
        } else if (currentDataMode === 'disk') {
            if (currentView === 'list' && diskFileListView) diskFileListView.style.display = 'block';
            else if (currentView === 'grid' && diskFileGridView) diskFileGridView.style.display = 'grid';
        }

        // 如果切換到的視圖內容為空，則獲取數據
        // 這個邏輯在 fetchDiskFiles/fetchFiles 內部已經有了清空提示，這裡主要是確保視圖容器正確顯示
        const contentArea = (currentView === 'list') ?
                            (currentDataMode === 'database' ? listTableBody : diskListTableBody) :
                            (currentDataMode === 'database' ? fileGridView : diskFileGridView);
        if (contentArea && (!contentArea.hasChildNodes() || (contentArea.firstElementChild && contentArea.firstElementChild.textContent.includes("找不到")))) {
            if (currentDataMode === 'database' && currentPage > 0) fetchFiles(currentPage); // 確保 currentPage 有效
            else if (currentDataMode === 'disk' && currentDiskPage > 0) fetchDiskFiles(currentDiskPage); // 確保 currentDiskPage 有效
        }
    }




    // --- 初始化 ---
    async function initializePage() {
        console.log("Initializing File Admin Page...");

        // 1. JS 狀態變數已在頂部設定為 'disk' 和 'grid'

        // 2. 更新 UI 按鈕以反映初始狀態
        if(viewModeDbBtn) viewModeDbBtn.classList.toggle('active', currentDataMode === 'database');
        if(viewModeDiskBtn) viewModeDiskBtn.classList.toggle('active', currentDataMode === 'disk');
        if(viewListBtn) viewListBtn.classList.toggle('active', currentView === 'list');
        if(viewGridBtn) viewGridBtn.classList.toggle('active', currentView === 'grid');

        // 3. 根據初始模式更新排序選項和相關 UI
        const isDbMode = currentDataMode === 'database';
        if(searchInput) searchInput.style.display = isDbMode ? '' : 'none';
        if(typeFilter) typeFilter.style.display = isDbMode ? '' : 'none';
        updateSortByOptions();

        // 4. 隱藏所有視圖容器
        document.querySelectorAll('.file-view').forEach(el => el.style.display = 'none');
        
        // 5. 顯示預期的初始視圖容器
        if (currentDataMode === 'disk') {
            if (currentView === 'grid' && diskFileGridView) {
                diskFileGridView.style.display = 'grid';
            } else if (currentView === 'list' && diskFileListView) { // 雖然初始是grid，但以防萬一
                diskFileListView.style.display = 'block';
            }
            await fetchDiskFiles(currentDiskPage); // 獲取初始數據
        } else { // 'database' 模式 (雖然我們設定初始為 'disk')
            if (currentView === 'grid' && fileGridView) {
                fileGridView.style.display = 'grid';
            } else if (currentView === 'list' && fileListView) {
                fileListView.style.display = 'block';
            }
            await fetchFiles(currentPage); // 獲取初始數據
        }
    }

    initializePage(); // 執行初始化

    
    function switchDataMode(mode) { // mode 是 'database' 或 'disk'
        if (mode === currentDataMode) return;
        currentDataMode = mode;

        if(viewModeDbBtn) viewModeDbBtn.classList.toggle('active', currentDataMode === 'database');
        if(viewModeDiskBtn) viewModeDiskBtn.classList.toggle('active', currentDataMode === 'disk');
        
        const isDbMode = currentDataMode === 'database';
        if(searchInput) searchInput.style.display = isDbMode ? '' : 'none'; // 搜尋只在 DB 模式下可用
        if(typeFilter) typeFilter.style.display = isDbMode ? '' : 'none'; // 類型過濾只在 DB 模式下可用
        
        updateSortByOptions(); // 更新排序下拉選單以匹配新模式
        if(paginationControls) paginationControls.innerHTML = ''; // 清空分頁

        // 根據新模式獲取數據並觸發視圖更新
        if (currentDataMode === 'database') {
            currentPage = 1; // 重置頁碼
            // currentSortBy 已由 updateSortByOptions 處理
            fetchFiles(currentPage); // fetchFiles 內部會調用 renderFiles，renderFiles 會根據 currentView 渲染
        } else if (currentDataMode === 'disk') {
            currentDiskPage = 1; // 重置頁碼
            // currentDiskSortBy 已由 updateSortByOptions 處理
            fetchDiskFiles(currentDiskPage); // fetchDiskFiles 內部會調用 renderDiskFiles
        }
        // 在 fetchXXX 完成後，確保視圖容器正確顯示
        // switchView 函數會處理顯示哪個 view div
        switchView(currentView);
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
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
             uploadStatus.textContent = '檔案大小超過 5MB 限制！'; uploadStatus.style.color = 'red'; return;
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
                 // If current mode is DB, refresh DB list. If Disk, refresh Disk list.
                 if (currentDataMode === 'database') {
                    currentPage = 1; // Go to first page
                    currentSortBy = 'newest'; // Default sort for DB
                    if(sortBySelect && currentDataMode === 'database') sortBySelect.value = currentSortBy;
                    fetchFiles();
                 } else {
                    currentDiskPage = 1;
                    currentDiskSortBy = 'date_desc'; // Default sort for Disk
                     if(sortBySelect && currentDataMode === 'disk') sortBySelect.value = currentDiskSortBy;
                    fetchDiskFiles();
                 }
             }, 1000);
        } catch (error) {
            console.error('上傳檔案失敗:', error);
            uploadStatus.textContent = `上傳失敗: ${error.message}`; uploadStatus.style.color = 'red';
        } finally {
             confirmUploadBtn.disabled = false;
        }
    }

    async function handleDeleteFile(event) { // For DB files
        const button = event.target.closest('.delete-file-btn, .delete-file-btn-grid');
        if (!button) return;
        const fileId = button.dataset.fileId;
        const fileName = button.dataset.fileName || `檔案ID ${fileId}`;
        if (!fileId || !confirm(`確定要刪除資料庫記錄及檔案 "${escapeHtml(fileName)}" 嗎？\n此操作無法復原！`)) return;
        try {
             button.disabled = true; button.textContent = '刪除中...';
             const response = await fetch(`/api/admin/files/${fileId}`, { method: 'DELETE' });
             if (response.status === 204 || response.ok) {
                 alert(`檔案 "${escapeHtml(fileName)}" 已成功刪除。`);
                 fetchFiles(currentPage); // Refresh current page of DB files
             } else {
                 const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                 throw new Error(errorData.error || `刪除失敗 (${response.status})`);
             }
        } catch (error) {
             console.error('刪除檔案失敗:', error);
             alert(`刪除檔案失敗: ${error.message}`);
        } finally {
            if(button) { button.disabled = false; button.textContent = '刪除';}
        }
    }

    async function handleDeleteDiskFileClick(event) { // For Disk files
        const button = event.target.closest('.delete-disk-file-btn, .delete-disk-file-btn-grid');
        if (!button) return;
        const filename = button.dataset.filename;
        if (!filename || !confirm(`確定要從磁碟永久刪除檔案 "${escapeHtml(filename)}" 嗎？\n此操作無法復原！`)) return;
        try {
            button.disabled = true; button.textContent = '刪除中...';
            const response = await fetch(`/api/admin/disk-files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            if (response.status === 204 || response.ok) {
                alert(`檔案 "${escapeHtml(filename)}" 已成功從磁碟刪除。`);
                fetchDiskFiles(currentDiskPage); // Refresh current page of disk files
            } else {
                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                throw new Error(errorData.error || `刪除失敗 (${response.status})`);
            }
        } catch (error) {
            console.error('刪除磁碟檔案失敗:', error);
            alert(`刪除磁碟檔案失敗: ${error.message}`);
        } finally {
             if(button) { button.disabled = false; button.textContent = '刪除'; }
        }
    }
    
    function addActionButtonListeners() {
        const displayArea = document.getElementById('file-display-area');
        if (displayArea) {
            displayArea.removeEventListener('click', handleDynamicButtonClick);
            displayArea.addEventListener('click', handleDynamicButtonClick);
        }
    }

    function handleDynamicButtonClick(event) {
        if (event.target.closest('.delete-file-btn, .delete-file-btn-grid')) {
            handleDeleteFile(event);
        } else if (event.target.closest('.delete-disk-file-btn, .delete-disk-file-btn-grid')) {
            handleDeleteDiskFileClick(event);
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
    if (searchInput) searchInput.addEventListener('keyup', (e) => { 
        if (e.key === 'Enter' && currentDataMode === 'database') { 
            currentSearch = searchInput.value.trim(); 
            currentPage = 1; 
            fetchFiles(); 
        } 
    });
    if (typeFilter) typeFilter.addEventListener('change', () => { 
        if (currentDataMode === 'database') {
            currentFileType = typeFilter.value; 
            currentPage = 1; 
            fetchFiles(); 
        }
    });
    if (sortBySelect) {
        sortBySelect.addEventListener('change', () => { 
            if (currentDataMode === 'database') {
                currentSortBy = sortBySelect.value; 
                currentPage = 1; 
                fetchFiles(); 
            } else if (currentDataMode === 'disk') {
                currentDiskSortBy = sortBySelect.value;
                currentDiskPage = 1;
                fetchDiskFiles();
            }
        });
    }
    if (refreshBtn) refreshBtn.addEventListener('click', () => {
        if (currentDataMode === 'database') fetchFiles(currentPage); 
        else fetchDiskFiles(currentDiskPage);
    });

    // 視圖切換 (列表/格狀)
    if (viewListBtn) viewListBtn.addEventListener('click', () => switchView('list'));
    if (viewGridBtn) viewGridBtn.addEventListener('click', () => switchView('grid'));

    // 數據模式切換 (資料庫/磁碟)
    if (viewModeDbBtn) viewModeDbBtn.addEventListener('click', () => switchDataMode('database'));
    if (viewModeDiskBtn) viewModeDiskBtn.addEventListener('click', () => switchDataMode('disk'));

    // 分頁控制 (事件委派)
    if (paginationControls) {
        paginationControls.addEventListener('click', (e) => {
            if (e.target.matches('button.page-btn') && !e.target.disabled) {
                const page = parseInt(e.target.dataset.page);
                if (!isNaN(page)) {
                    if (currentDataMode === 'database' && page !== currentPage) {
                        fetchFiles(page);
                    } else if (currentDataMode === 'disk' && page !== currentDiskPage) {
                        fetchDiskFiles(page); 
                    }
                }
            }
        });
    }

    // --- 初始化 ---
    console.log("Initializing File Admin Page...");
    updateSortByOptions(); // 更新排序選項以匹配預設模式 (disk)
    
    // 手動設置初始按鈕狀態和視圖顯示，以匹配預設值
    if(viewModeDbBtn) viewModeDbBtn.classList.remove('active');
    if(viewModeDiskBtn) viewModeDiskBtn.classList.add('active');
    if(viewListBtn) viewListBtn.classList.remove('active');
    if(viewGridBtn) viewGridBtn.classList.add('active');

    document.querySelectorAll('.file-view').forEach(el => el.style.display = 'none');
    if (diskFileGridView) diskFileGridView.style.display = 'grid'; // 預設是磁碟格狀

    // 直接獲取初始數據
    if (currentDataMode === 'disk') {
        fetchDiskFiles(currentDiskPage);
    } else { // 備用，如果預設不是 disk
        fetchFiles(currentPage);
    }

}); // End of DOMContentLoaded