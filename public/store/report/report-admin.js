// /public/js/report-admin.js (管理後台專用)

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
    const reportListContainer = document.getElementById('report-list')?.querySelector('ul');
    const refreshListBtn = document.getElementById('refresh-list-btn');

    // --- 狀態變數 ---
    let isSubmitting = false;

    // --- 輔助函數 ---
    const showStatus = (message, isError = false) => {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = isError ? 'status-error' : 'status-success';
        statusMessage.style.display = 'block'; // 確保可見
    };

    const clearStatus = () => {
        if (statusMessage) {
            statusMessage.textContent = '';
            statusMessage.style.display = 'none'; // 隱藏
        }
    };

    function formatBytes(bytes, decimals = 2) {
        if (bytes === null || bytes === undefined || !+bytes || bytes === 0) return '0 Bytes'; // 處理 null, undefined, 0
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        // 處理 bytes < 1 的情況 (理論上不應發生，但以防萬一)
         if (bytes < 1) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const index = Math.min(i, sizes.length - 1);
        return `${parseFloat((bytes / Math.pow(k, index)).toFixed(dm))} ${sizes[index]}`;
    }

    const resetForm = () => {
        if(reportTitleInput) reportTitleInput.value = '';
        if(htmlContentInput) htmlContentInput.value = '';
        if(editingReportIdInput) editingReportIdInput.value = '';
        if(saveButton) {
            saveButton.textContent = '儲存新報告';
            saveButton.disabled = false;
        }
        if(cancelEditButton) cancelEditButton.style.display = 'none';
        isSubmitting = false;
        clearStatus();
    };

    // --- 主要功能函數 ---

    // 載入報告列表 (管理版)
    const loadReportList = async () => {
        if (!reportListContainer) {
            console.error("錯誤：找不到列表容器 ul");
            showStatus("頁面錯誤：無法顯示列表。", true);
            return;
        }
        reportListContainer.innerHTML = '<li>正在載入列表...</li>';
        console.log('正在載入管理列表...');
        clearStatus(); // 清除舊狀態

        try {
            // *** 使用管理 API 路徑 ***
            const response = await fetch('/api/admin/reports'); // GET /api/admin/reports
            console.log(`管理列表 API 回應狀態: ${response.status}`);

            if (response.status === 401) { // 未授權
                throw new Error('需要管理員權限才能訪問此列表。請確認您已登入。');
            }
            if (!response.ok) {
                const errData = await response.json().catch(()=>({}));
                throw new Error(errData.error || `無法載入列表 (${response.status})`);
            }

            const reports = await response.json();
            console.log(`載入了 ${reports.length} 個報告 (管理員)`);

            reportListContainer.innerHTML = ''; // 清空

            if (reports.length === 0) {
                reportListContainer.innerHTML = '<li>尚無任何報告。</li>';
            } else {
                reports.forEach(report => {
                    const li = document.createElement('li');
                    li.dataset.reportId = report.id;

                    const reportInfo = document.createElement('div');
                    reportInfo.className = 'report-info';
                    const titleSpan = document.createElement('span');
                    titleSpan.textContent = report.title;
                    titleSpan.className = 'title'; // 添加 class 方便選取或樣式化
                    const dateSpan = document.createElement('span');
                    dateSpan.textContent = ` (更新: ${new Date(report.updated_at).toLocaleString('zh-TW')})`;
                    dateSpan.className = 'meta';
                    reportInfo.appendChild(titleSpan);
                    reportInfo.appendChild(dateSpan);

                    const sizeSpan = document.createElement('span');
                    sizeSpan.className = 'report-size';
                    sizeSpan.textContent = `大小: ${formatBytes(report.size_bytes)}`; // 使用格式化函數

                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'report-actions';

                    const viewLink = document.createElement('a');
                    // *** 查看連結指向公開版的檢視頁面 ***
                    viewLink.href = `/store/report/report-view.html?id=${report.id}`;
                    viewLink.textContent = '查看';
                    viewLink.target = '_blank';
                    viewLink.className = 'button-like';
                    actionsDiv.appendChild(viewLink);

                    const editBtn = document.createElement('button');
                    editBtn.textContent = '編輯';
                    editBtn.className = 'edit-btn'; // 移除 secondary，用 CSS 控制樣式
                    editBtn.dataset.id = report.id;
                    actionsDiv.appendChild(editBtn);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '刪除';
                    deleteBtn.className = 'delete-btn danger';
                    deleteBtn.dataset.id = report.id;
                    actionsDiv.appendChild(deleteBtn);

                    li.appendChild(reportInfo);
                    li.appendChild(sizeSpan);
                    li.appendChild(actionsDiv);
                    reportListContainer.appendChild(li);
                });
            }
        } catch (err) {
            console.error('載入報告列表失敗:', err);
            reportListContainer.innerHTML = ''; // 清空載入提示
            // 在列表區顯示錯誤，而不是狀態區
            const errorLi = document.createElement('li');
            errorLi.className = 'status-error';
            errorLi.style.backgroundColor = '#f8d7da'; // 讓錯誤更明顯
            errorLi.textContent = `無法載入報告列表：${err.message}`;
            reportListContainer.appendChild(errorLi);
        }
    };

    // 處理表單提交 (新增或更新) - 管理版
    const handleFormSubmit = async (event) => {
        // event.preventDefault(); // 因為按鈕是 type="button" 故不需要
        if (isSubmitting) return;

        const title = reportTitleInput?.value.trim();
        const htmlContent = htmlContentInput?.value;
        const editingId = editingReportIdInput?.value; // UUID

        if (!title) {
            showStatus('報告標題不能為空！', true);
            reportTitleInput?.focus();
            return;
        }
         if (typeof htmlContent !== 'string') {
             showStatus('HTML 內容必須是文字！', true);
             htmlContentInput?.focus();
             return;
         }

        isSubmitting = true;
        if(saveButton){
            saveButton.disabled = true;
            saveButton.textContent = editingId ? '更新中...' : '儲存中...';
        }
        clearStatus();

        // *** 使用管理 API 路徑 ***
        const url = editingId ? `/api/admin/reports/${editingId}` : '/api/admin/reports';
        const method = editingId ? 'PUT' : 'POST';
        const bodyData = { title, html_content: htmlContent };

        console.log(`發送 ${method} 請求到 ${url}`);

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                // 注意：如果您的 basicAuthMiddleware 設計為檢查 Header，
                // fetch 可能不需要特別處理。但如果它是 Session/Cookie 基礎的，
                // 瀏覽器會自動帶上。
                body: JSON.stringify(bodyData),
            });

            const result = await response.json();
            console.log('後端回應:', result);

            if (!response.ok) {
                throw new Error(result.error || `操作失敗 (${response.status})`);
            }

            showStatus(editingId ? `報告 ID ${editingId.substring(0,8)}... 更新成功！` : `報告新增成功！ID: ${result.id.substring(0,8)}...`, false);
            resetForm();
            loadReportList(); // 重新載入列表

        } catch (err) {
            console.error('儲存/更新報告失敗:', err);
            showStatus(`操作失敗：${err.message}`, true);
        } finally {
            if(saveButton){
                saveButton.textContent = editingIdInput?.value ? '更新報告' : '儲存新報告'; // 根據是否有編輯ID恢復文字
                saveButton.disabled = false;
            }
            isSubmitting = false;
        }
    };

    // 處理點擊列表中的按鈕 (編輯/刪除) - 管理版
    const handleListClick = async (event) => {
        const target = event.target;
        const reportId = target.dataset.id; // UUID

        if (!reportId || !target.closest('button')) return;

        // --- 編輯 ---
        if (target.classList.contains('edit-btn')) {
            console.log(`請求編輯報告 UUID: ${reportId}`);
            showStatus(`正在載入報告 ${reportId.substring(0,8)}... 以供編輯...`);
            resetForm();

            try {
                // *** 使用管理 API 路徑獲取完整資料 ***
                const response = await fetch(`/api/admin/reports/${reportId}`);
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || `無法載入報告 (${response.status})`);
                }
                const report = await response.json(); // 獲取完整物件

                // 填充表單
                if(reportTitleInput) reportTitleInput.value = report.title || '';
                if(htmlContentInput) htmlContentInput.value = report.html_content || '';
                if(editingReportIdInput) editingReportIdInput.value = report.id; // 存儲 UUID
                if(saveButton) saveButton.textContent = '更新報告';
                if(cancelEditButton) cancelEditButton.style.display = 'inline-block';

                showStatus(`正在編輯報告 ID: ${report.id.substring(0,8)}...`);
                window.scrollTo(0, 0);
                reportTitleInput?.focus();

            } catch (err) {
                console.error('載入編輯內容失敗:', err);
                showStatus(`載入編輯內容失敗: ${err.message}`, true);
                resetForm();
            }
        }

        // --- 刪除 ---
        else if (target.classList.contains('delete-btn')) {
            if (!confirm(`您確定要永久刪除報告 ID ${reportId.substring(0,8)}... 嗎？`)) {
                return;
            }

            console.log(`請求刪除報告 UUID: ${reportId}`);
            showStatus(`正在刪除報告 ID ${reportId.substring(0,8)}...`);
            target.disabled = true;

            try {
                // *** 使用管理 API 路徑 ***
                const response = await fetch(`/api/admin/reports/${reportId}`, { method: 'DELETE' });

                if (response.status === 204 || response.ok) {
                    showStatus(`報告 ID ${reportId.substring(0,8)}... 已成功刪除。`, false);
                    loadReportList(); // 重新載入列表
                } else {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || `刪除失敗 (${response.status})`);
                }
   
            } catch (err) {
                console.error('刪除報告失敗:', err);
                showStatus(`刪除報告 ID ${reportId.substring(0,8)}... 失敗: ${err.message}`, true);
                target.disabled = false; // 恢復按鈕
            }
        }
    };

    // --- 事件監聽器綁定 ---
    if (saveButton) {
        saveButton.addEventListener('click', handleFormSubmit); // 綁定到點擊事件
    } else {
         console.error("錯誤：找不到儲存按鈕");
    }

    if (reportListContainer) {
        reportListContainer.addEventListener('click', handleListClick);
    } else {
         console.error("錯誤：找不到列表容器 ul");
    }

    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', resetForm);
    }

    if (refreshListBtn) {
        refreshListBtn.addEventListener('click', loadReportList);
    }

    // --- 初始化 ---
    loadReportList(); // 頁面載入時自動載入報告列表

}); // End of DOMContentLoaded