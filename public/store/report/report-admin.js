// report-admin.js - 增加過濾guest標題功能

document.addEventListener('DOMContentLoaded', () => {
    console.log('報告管理後台初始化...');

    // --- DOM 元素獲取 ---
    const reportForm = document.getElementById('report-form');
    const reportTitleInput = document.getElementById('report-title');
    const htmlContentInput = document.getElementById('html-content');
    const saveButton = document.getElementById('save-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const editingReportIdInput = document.getElementById('editing-report-id');
    const statusMessage = document.getElementById('status-message');
    const reportListElement = document.getElementById('report-list');
    const refreshListBtn = document.getElementById('refresh-list-btn');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const paginationContainer = document.getElementById('pagination');
    
    // 新增的過濾控制項
    const filterGuestCheckbox = document.getElementById('filter-guest-checkbox');
    const filterToggle = document.getElementById('filter-toggle');

    // --- 狀態變數 ---
    let isSubmitting = false;
    let currentPage = 1;
    let totalPages = 1;
    let searchTerm = '';
    let hideGuestReports = false; // 預設不隱藏guest報告
    const itemsPerPage = 10; // 每頁顯示數量

    // --- 輔助函數 ---
    
    // 顯示狀態訊息
    const showStatus = (message, isError = false) => {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = isError ? 'alert alert-danger' : 'alert alert-success';
        statusMessage.classList.remove('hidden');
        
        // 自動隱藏訊息（成功訊息 3 秒，錯誤訊息 5 秒）
        const hideTimeout = isError ? 5000 : 3000;
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, hideTimeout);
    };

    // 清除狀態訊息
    const clearStatus = () => {
        if (statusMessage) {
            statusMessage.textContent = '';
            statusMessage.classList.add('hidden');
        }
    };

    // 格式化檔案大小
    function formatBytes(bytes, decimals = 2) {
        if (bytes === null || bytes === undefined || !+bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const index = Math.min(i, sizes.length - 1);
        return `${parseFloat((bytes / Math.pow(k, index)).toFixed(dm))} ${sizes[index]}`;
    }

    // 取得檔案大小的分類（用於 CSS 樣式）
    function getSizeClass(bytes) {
        if (!bytes || bytes < 1024 * 50) return 'size-small';       // < 50KB
        if (bytes < 1024 * 500) return 'size-medium';               // < 500KB
        return 'size-large';                                        // > 500KB
    }

    // 計算 HTML 字串的字節大小
    function calculateByteSize(htmlString) {
        if (!htmlString) return 0;
        // 使用 TextEncoder 來計算 UTF-8 編碼的字節大小
        return new TextEncoder().encode(htmlString).length;
    }

    // 重設表單
    const resetForm = () => {
        if (reportTitleInput) reportTitleInput.value = '';
        if (htmlContentInput) htmlContentInput.value = '';
        if (editingReportIdInput) editingReportIdInput.value = '';
        if (saveButton) {
            saveButton.textContent = '儲存新報告';
            saveButton.disabled = false;
        }
        if (cancelEditButton) cancelEditButton.style.display = 'none';
        isSubmitting = false;
        clearStatus();
    };

    // 生成分頁 UI
    function generatePagination(currentPage, totalPages) {
        if (!paginationContainer) return;
        
        const paginationList = paginationContainer.querySelector('.pagination');
        if (!paginationList) return;
        
        paginationList.innerHTML = '';
        
        // 只有一頁時不顯示分頁
        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }
        
        paginationContainer.style.display = 'block';
        
        // 上一頁按鈕
        const prevItem = document.createElement('li');
        prevItem.className = currentPage === 1 ? 'disabled' : '';
        const prevLink = document.createElement('a');
        prevLink.href = '#';
        prevLink.textContent = '«';
        if (currentPage > 1) {
            prevLink.addEventListener('click', (e) => {
                e.preventDefault();
                navigateToPage(currentPage - 1);
            });
        }
        prevItem.appendChild(prevLink);
        paginationList.appendChild(prevItem);
        
        // 頁碼按鈕
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageItem = document.createElement('li');
            pageItem.className = i === currentPage ? 'active' : '';
            const pageLink = document.createElement('a');
            pageLink.href = '#';
            pageLink.textContent = i;
            pageLink.addEventListener('click', (e) => {
                e.preventDefault();
                navigateToPage(i);
            });
            pageItem.appendChild(pageLink);
            paginationList.appendChild(pageItem);
        }
        
        // 下一頁按鈕
        const nextItem = document.createElement('li');
        nextItem.className = currentPage === totalPages ? 'disabled' : '';
        const nextLink = document.createElement('a');
        nextLink.href = '#';
        nextLink.textContent = '»';
        if (currentPage < totalPages) {
            nextLink.addEventListener('click', (e) => {
                e.preventDefault();
                navigateToPage(currentPage + 1);
            });
        }
        nextItem.appendChild(nextLink);
        paginationList.appendChild(nextItem);
    }

    // 切換到指定頁數
    function navigateToPage(page) {
        if (page < 1 || page > totalPages || page === currentPage) return;
        currentPage = page;
        loadReportList();
    }

    // --- 主要功能函數 ---

    // 載入報告列表
    const loadReportList = async () => {
        if (!reportListElement) {
            console.error("錯誤：找不到報告列表元素");
            return;
        }

        reportListElement.innerHTML = '<tr><td colspan="5" style="text-align: center;">正在載入報告列表...</td></tr>';
        console.log(`正在載入報告列表（第 ${currentPage} 頁，搜尋字詞：${searchTerm || '無'}，隱藏guest：${hideGuestReports}）...`);
        
        try {
            // 構建 API URL，包含分頁和搜尋參數
            let apiUrl = `/api/admin/reports?page=${currentPage}&limit=${itemsPerPage}`;
            if (searchTerm) {
                apiUrl += `&search=${encodeURIComponent(searchTerm)}`;
            }
            
            const response = await fetch(apiUrl);
            
            if (response.status === 401) {
                throw new Error('需要管理員權限才能訪問此列表。請確認您已登入。');
            }
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `無法載入列表 (${response.status})`);
            }

            const result = await response.json();
            const { reports, total_pages, current_page, total_items } = result;
            
            currentPage = current_page;
            totalPages = total_pages;
            
            console.log(`載入了 ${reports.length} 個報告（總計 ${total_items} 個）`);

            // 在前端過濾掉標題為 "guest" 的報告（如果過濾選項啟用）
            let displayedReports = reports;
            if (hideGuestReports) {
                displayedReports = reports.filter(report => report.title.toLowerCase() !== 'guest');
                console.log(`過濾後剩餘 ${displayedReports.length} 個報告`);
            }

            // 更新分頁 UI
            generatePagination(currentPage, totalPages);

            reportListElement.innerHTML = '';

            if (displayedReports.length === 0) {
                let message = '尚無報告';
                if (hideGuestReports) {
                    message = '尚無非guest報告或沒有符合搜尋條件的結果';
                } else if (searchTerm) {
                    message = '沒有符合搜尋條件的結果';
                }
                reportListElement.innerHTML = `<tr><td colspan="5" style="text-align: center;">${message}</td></tr>`;
                return;
            }

            displayedReports.forEach((report, index) => {
                const tr = document.createElement('tr');
                
                // 標記guest報告的行
                if (report.title.toLowerCase() === 'guest') {
                    tr.className = 'guest-report-row';
                }
                
                // 編號列（根據當前頁碼和每頁數量計算）
                const indexCell = document.createElement('td');
                indexCell.textContent = (currentPage - 1) * itemsPerPage + index + 1;
                tr.appendChild(indexCell);
                
                // 標題列
                const titleCell = document.createElement('td');
                titleCell.textContent = report.title;
                if (report.title.toLowerCase() === 'guest') {
                    titleCell.innerHTML = `<span class="guest-title">${report.title}</span>`;
                }
                tr.appendChild(titleCell);
                
                // 檔案大小列
                const sizeCell = document.createElement('td');
                const sizeBadge = document.createElement('span');
                sizeBadge.className = `size-badge ${getSizeClass(report.size_bytes)}`;
                sizeBadge.textContent = formatBytes(report.size_bytes);
                sizeCell.appendChild(sizeBadge);
                tr.appendChild(sizeCell);
                
                // 更新時間列
                const timeCell = document.createElement('td');
                timeCell.textContent = new Date(report.updated_at).toLocaleString('zh-TW');
                tr.appendChild(timeCell);
                
                // 操作列
                const actionCell = document.createElement('td');
                actionCell.className = 'table-actions';
                
                // 查看按鈕
                const viewBtn = document.createElement('a');
                viewBtn.href = `/store/report/report-view.html?id=${report.id}`;
                viewBtn.className = 'btn btn-secondary';
                viewBtn.textContent = '查看';
                viewBtn.target = '_blank';
                actionCell.appendChild(viewBtn);
                
                // 編輯按鈕
                const editBtn = document.createElement('button');
                editBtn.className = 'btn btn-primary';
                editBtn.textContent = '編輯';
                editBtn.dataset.id = report.id;
                editBtn.addEventListener('click', () => handleEditReport(report.id));
                actionCell.appendChild(editBtn);
                
                // 刪除按鈕
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-danger';
                deleteBtn.textContent = '刪除';
                deleteBtn.dataset.id = report.id;
                deleteBtn.addEventListener('click', () => handleDeleteReport(report.id));
                actionCell.appendChild(deleteBtn);
                
                tr.appendChild(actionCell);
                reportListElement.appendChild(tr);
            });

        } catch (err) {
            console.error('載入報告列表失敗:', err);
            reportListElement.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">載入失敗：${err.message}</td></tr>`;
            showStatus(`無法載入報告列表：${err.message}`, true);
        }
    };

    // 處理編輯報告
    const handleEditReport = async (reportId) => {
        console.log(`請求編輯報告 ID: ${reportId}`);
        showStatus(`正在載入報告資料以供編輯...`);
        resetForm();

        try {
            const response = await fetch(`/api/admin/reports/${reportId}`);
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `無法載入報告 (${response.status})`);
            }
            
            const report = await response.json();

            // 填充表單
            if (reportTitleInput) reportTitleInput.value = report.title || '';
            if (htmlContentInput) htmlContentInput.value = report.html_content || '';
            if (editingReportIdInput) editingReportIdInput.value = report.id;
            if (saveButton) saveButton.textContent = '更新報告';
            if (cancelEditButton) cancelEditButton.style.display = 'inline-block';

            showStatus(`正在編輯報告「${report.title}」`);
            window.scrollTo(0, 0);
            reportTitleInput?.focus();

        } catch (err) {
            console.error('載入編輯內容失敗:', err);
            showStatus(`載入編輯內容失敗: ${err.message}`, true);
            resetForm();
        }
    };

    // 處理刪除報告
    const handleDeleteReport = async (reportId) => {
        if (!confirm(`您確定要永久刪除此報告嗎？此操作無法撤銷。`)) {
            return;
        }

        console.log(`請求刪除報告 ID: ${reportId}`);
        showStatus(`正在刪除報告...`);

        try {
            const response = await fetch(`/api/admin/reports/${reportId}`, { method: 'DELETE' });

            if (response.status === 204 || response.ok) {
                showStatus(`報告已成功刪除`, false);
                loadReportList(); // 重新載入列表
            } else {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `刪除失敗 (${response.status})`);
            }
        } catch (err) {
            console.error('刪除報告失敗:', err);
            showStatus(`刪除報告失敗: ${err.message}`, true);
        }
    };

    // 處理表單提交（新增或更新報告）
    const handleFormSubmit = async () => {
        if (isSubmitting) return;

        const title = reportTitleInput?.value.trim();
        const htmlContent = htmlContentInput?.value;
        const editingId = editingReportIdInput?.value;

        if (!title) {
            showStatus('報告標題不能為空！', true);
            reportTitleInput?.focus();
            return;
        }
        
        if (!htmlContent) {
            showStatus('HTML 內容不能為空！', true);
            htmlContentInput?.focus();
            return;
        }

        // 計算內容字節大小
        const contentSizeBytes = calculateByteSize(htmlContent);
        console.log(`報告內容大小：${formatBytes(contentSizeBytes)}`);

        isSubmitting = true;
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = editingId ? '更新中...' : '儲存中...';
        }
        clearStatus();

        // 決定要使用的 API 端點和方法
        const url = editingId ? `/api/admin/reports/${editingId}` : '/api/admin/reports';
        const method = editingId ? 'PUT' : 'POST';
        const bodyData = { 
            title, 
            html_content: htmlContent,
            size_bytes: contentSizeBytes  // 傳送計算出的字節大小
        };

        console.log(`發送 ${method} 請求到 ${url}`);

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData),
            });

            // 嘗試解析回應
            let result;
            try {
                result = await response.json();
            } catch (e) {
                // 如果無法解析 JSON，使用狀態文字作為結果
                result = { error: response.statusText };
            }

            if (!response.ok) {
                throw new Error(result.error || `操作失敗 (${response.status})`);
            }

            showStatus(
                editingId 
                    ? `報告「${title}」更新成功！` 
                    : `報告「${title}」新增成功！`, 
                false
            );
            
            resetForm();
            loadReportList(); // 重新載入列表

        } catch (err) {
            console.error('儲存/更新報告失敗:', err);
            showStatus(`操作失敗：${err.message}`, true);
        } finally {
            if (saveButton) {
                saveButton.textContent = editingId ? '更新報告' : '儲存新報告';
                saveButton.disabled = false;
            }
            isSubmitting = false;
        }

    };

    // 執行搜尋
    const handleSearch = () => {
        searchTerm = searchInput.value.trim();
        currentPage = 1; // 搜尋時重置到第一頁
        loadReportList();
    };
    
    // 切換是否隱藏guest報告
    const toggleGuestFilter = () => {
        hideGuestReports = filterGuestCheckbox.checked;
        // 更新過濾狀態顯示
        filterToggle.textContent = hideGuestReports ? '僅顯示非guest報告中...' : '顯示全部報告';
        filterToggle.className = hideGuestReports ? 'filter-status active' : 'filter-status';
        
        // 重新載入報告列表（恢復到第一頁）
        currentPage = 1;
        loadReportList();
    };

    // --- 事件監聽器綁定 ---
    if (saveButton) {
        saveButton.addEventListener('click', handleFormSubmit);
    } else {
        console.error("錯誤：找不到儲存按鈕");
    }

    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', resetForm);
    }

    if (refreshListBtn) {
        refreshListBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchTerm = '';
            currentPage = 1;
            loadReportList();
        });
    }

    if (searchButton) {
        searchButton.addEventListener('click', handleSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });
    }
    
    // 綁定過濾切換事件
    if (filterGuestCheckbox) {
        filterGuestCheckbox.addEventListener('change', toggleGuestFilter);
    }

    // --- 初始化 ---
    
    // 檢查本地儲存中是否有隱藏guest的設定
    try {
        const storedPreference = localStorage.getItem('hideGuestReports');
        if (storedPreference !== null) {
            hideGuestReports = storedPreference === 'true';
            if (filterGuestCheckbox) {
                filterGuestCheckbox.checked = hideGuestReports;
            }
            if (filterToggle) {
                filterToggle.textContent = hideGuestReports ? '僅顯示非guest報告中...' : '顯示全部報告';
                filterToggle.className = hideGuestReports ? 'filter-status active' : 'filter-status';
            }
        }
    } catch (e) {
        console.warn('無法讀取本地儲存的過濾設定', e);
    }
    
    loadReportList(); // 頁面載入時自動載入報告列表
});