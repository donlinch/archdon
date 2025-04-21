// /public/js/report-editor.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
    const reportForm = document.getElementById('report-form');
    const reportTitleInput = document.getElementById('report-title');
    const htmlContentInput = document.getElementById('html-content');
    const saveButton = document.getElementById('save-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const editingReportIdInput = document.getElementById('editing-report-id');
    const statusMessage = document.getElementById('status-message');
    const reportListContainer = document.getElementById('report-list')?.querySelector('ul'); // 獲取 ul 元素
    const refreshListBtn = document.getElementById('refresh-list-btn');

    // --- 狀態變數 ---
    let isSubmitting = false; // 防止重複提交

    // --- 輔助函數 ---
    const showStatus = (message, isError = false) => {
        statusMessage.textContent = message;
        statusMessage.className = isError ? 'status-error' : 'status-success';
    };

    const clearStatus = () => {
        statusMessage.textContent = '';
        statusMessage.className = '';
    };

    const resetForm = () => {
        reportForm.reset(); // 清空表單所有欄位
        editingReportIdInput.value = ''; // 清除正在編輯的 ID
        saveButton.textContent = '儲存新報告';
        saveButton.disabled = false;
        cancelEditButton.style.display = 'none'; // 隱藏取消按鈕
        isSubmitting = false;
        clearStatus();
    };

    // --- 主要功能函數 ---

    // 載入報告列表
    const loadReportList = async () => {
        if (!reportListContainer) return;
        reportListContainer.innerHTML = '<li>正在載入列表...</li>'; // 清空並顯示載入中

        try {
            const response = await fetch('/api/reports'); // GET 請求獲取列表
            if (!response.ok) {
                throw new Error(`無法載入列表 (${response.status})`);
            }
            const reports = await response.json();

            reportListContainer.innerHTML = ''; // 清空載入提示

            if (reports.length === 0) {
                reportListContainer.innerHTML = '<li>尚無任何報告。</li>';
            } else {
                reports.forEach(report => {
                    const li = document.createElement('li');
                    li.dataset.reportId = report.id; // 將 ID 存在 li 上方便操作

                    // 報告標題和更新時間
                    const reportInfo = document.createElement('span');
                    const updatedDate = new Date(report.updated_at).toLocaleString('zh-TW');
                    reportInfo.textContent = `${report.title} (更新於: ${updatedDate})`;

                    // 操作按鈕容器
                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'report-actions';

                    // 查看按鈕 (連結)
                    const viewLink = document.createElement('a');
                    viewLink.href = `/store/todolist/report-view.html?id=${report.id}`;
                    viewLink.textContent = '查看';
                    viewLink.target = '_blank'; // 在新分頁開啟
                    viewLink.className = 'button-like'; // 讓連結看起來像按鈕
                    actionsDiv.appendChild(viewLink);

                    // 編輯按鈕
                    const editBtn = document.createElement('button');
                    editBtn.textContent = '編輯';
                    editBtn.className = 'edit-btn secondary'; // 加 edit-btn class
                    editBtn.dataset.id = report.id; // 將 ID 存在按鈕上
                    actionsDiv.appendChild(editBtn);

                    // 刪除按鈕
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '刪除';
                    deleteBtn.className = 'delete-btn danger'; // 加 delete-btn class
                    deleteBtn.dataset.id = report.id; // 將 ID 存在按鈕上
                    actionsDiv.appendChild(deleteBtn);

                    li.appendChild(reportInfo);
                    li.appendChild(actionsDiv);
                    reportListContainer.appendChild(li);
                });
            }
        } catch (err) {
            console.error('載入報告列表失敗:', err);
            reportListContainer.innerHTML = `<li class="status-error">無法載入報告列表：${err.message}</li>`;
        }
    };

    // 處理表單提交 (新增或更新)
    const handleFormSubmit = async (event) => {
        event.preventDefault(); // 阻止表單默認提交行為
        if (isSubmitting) return; // 如果正在提交，則不執行

        const title = reportTitleInput.value.trim();
        const htmlContent = htmlContentInput.value; // HTML 內容不需要 trim
        const editingId = editingReportIdInput.value;

        if (!title) {
            showStatus('報告標題不能為空！', true);
            reportTitleInput.focus();
            return;
        }
        // 檢查 htmlContent (允許空字串，但如果需要內容，可以在這裡加驗證)
        // if (!htmlContent) { ... }

        isSubmitting = true;
        saveButton.disabled = true;
        saveButton.textContent = editingId ? '更新中...' : '儲存中...';
        clearStatus();

        const url = editingId ? `/api/reports/${editingId}` : '/api/reports';
        const method = editingId ? 'PUT' : 'POST';
        const bodyData = { title, html_content: htmlContent };

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData),
            });

            const result = await response.json(); // 嘗試解析 JSON 回應

            if (!response.ok) {
                throw new Error(result.error || `操作失敗 (${response.status})`);
            }

            showStatus(editingId ? `報告 ID ${editingId} 更新成功！` : `報告新增成功！ID: ${result.id}`, false);
            resetForm();      // 成功後重置表單
            loadReportList(); // 重新載入列表以顯示最新狀態

        } catch (err) {
            console.error('儲存/更新報告失敗:', err);
            showStatus(`操作失敗：${err.message}`, true);
            saveButton.textContent = editingId ? '更新' : '儲存新報告'; // 恢復按鈕文字
            saveButton.disabled = false; // 恢復按鈕
            isSubmitting = false; // 允許重新提交
        }
    };

    // 處理點擊列表中的按鈕 (編輯/刪除) - 使用事件委派
    const handleListClick = async (event) => {
        const target = event.target;
        const reportId = target.dataset.id; // 獲取按鈕上的 data-id

        if (!reportId) return; // 如果點擊的不是帶有 data-id 的按鈕，則忽略

        // --- 處理編輯 ---
        if (target.classList.contains('edit-btn')) {
            console.log(`請求編輯報告 ID: ${reportId}`);
            showStatus(`正在載入報告 ${reportId} 以供編輯...`);
            resetForm(); // 先重置表單

            try {
                const response = await fetch(`/api/reports/${reportId}`); // GET 請求報告內容
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || `無法載入報告 (${response.status})`);
                }
                const report = await response.json();

                // 將報告內容填入表單
                reportTitleInput.value = report.title || '';
                htmlContentInput.value = report.html_content || '';
                editingReportIdInput.value = report.id; // 設置正在編輯的 ID
                saveButton.textContent = '更新報告'; // 改變按鈕文字
                cancelEditButton.style.display = 'inline-block'; // 顯示取消按鈕
                showStatus(`正在編輯報告 ID: ${report.id}`);
                window.scrollTo(0, 0); // 滾動到頁面頂部方便編輯
                reportTitleInput.focus();

            } catch (err) {
                console.error('載入編輯內容失敗:', err);
                showStatus(`載入編輯內容失敗: ${err.message}`, true);
                resetForm(); // 失敗時也重置表單
            }
        }

        // --- 處理刪除 ---
        else if (target.classList.contains('delete-btn')) {
            if (!confirm(`您確定要永久刪除報告 ID ${reportId} 嗎？此操作無法復原。`)) {
                return; // 使用者取消
            }

            console.log(`請求刪除報告 ID: ${reportId}`);
            showStatus(`正在刪除報告 ID ${reportId}...`);
            target.disabled = true; // 暫時禁用刪除按鈕

            try {
                const response = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });

                // DELETE 成功通常回 204 No Content，沒有 JSON body
                if (response.status === 204 || response.ok) {
                    showStatus(`報告 ID ${reportId} 已成功刪除。`, false);
                    // 直接從 DOM 移除列表項，或重新載入列表
                    // target.closest('li')?.remove(); // 從 DOM 移除 (更即時)
                    loadReportList(); // 重新載入列表 (更保險)
                } else {
                    // 嘗試解析可能的錯誤訊息
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || `刪除失敗 (${response.status})`);
                }

            } catch (err) {
                console.error('刪除報告失敗:', err);
                showStatus(`刪除報告 ID ${reportId} 失敗: ${err.message}`, true);
                target.disabled = false; // 恢復按鈕
            }
        }
    };

    // --- 事件監聽器綁定 ---
    if (reportForm) {
        reportForm.addEventListener('submit', handleFormSubmit);
    }

    if (reportListContainer) {
        reportListContainer.addEventListener('click', handleListClick); // 事件委派
    }

    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', resetForm); // 取消編輯按鈕重置表單
    }

    if (refreshListBtn) {
        refreshListBtn.addEventListener('click', loadReportList); // 重新整理按鈕
    }

    // --- 初始化 ---
    loadReportList(); // 頁面載入時自動載入報告列表

}); // End of DOMContentLoaded