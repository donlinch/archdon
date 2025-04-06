// public/admin-identities.js
document.addEventListener('DOMContentLoaded', () => {
    const identityForm = document.getElementById('identity-form');
    const identityIdInput = document.getElementById('identity-id');
    const identityNameInput = document.getElementById('identity-name');
    const identityDescriptionInput = document.getElementById('identity-description');
    const saveIdentityBtn = document.getElementById('save-identity-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const identityListBody = document.getElementById('identity-list-body');
    const formStatus = document.getElementById('identity-form-status');

    // --- 函數：獲取並顯示身份列表 ---
    async function fetchIdentities() {
        if (!identityListBody) return;
        identityListBody.innerHTML = '<tr><td colspan="4">正在載入身份列表...</td></tr>';
        try {
            // 【注意】假設你的管理 API 都放在 /api/admin/ 路徑下
            const response = await fetch('/api/admin/identities');
            if (!response.ok) {
                 // 嘗試解析錯誤訊息
                 let errorMsg = `HTTP 錯誤 ${response.status}`;
                 try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
                 // 如果是 401 未授權，提示登入
                 if (response.status === 401) {
                     throw new Error('您需要登入才能訪問此功能。');
                 }
                throw new Error(`無法獲取身份列表 (${errorMsg})`);
            }
            const identities = await response.json();
            renderIdentityList(identities);
        } catch (error) {
            console.error('獲取身份列表失敗:', error);
            identityListBody.innerHTML = `<tr><td colspan="4" style="color: red;">無法載入身份列表：${error.message}</td></tr>`;
            // 如果是未授權，可以在頁面上給出更明顯的提示或跳轉
             if (error.message.includes('登入')) {
                // 可以考慮顯示一個登入連結或提示
                // alert('請先登入管理後台！');
             }
        }
    }

    // --- 函數：渲染身份列表 ---
    function renderIdentityList(identities) {
        if (!identityListBody) return;
        if (!identities || identities.length === 0) {
            identityListBody.innerHTML = '<tr><td colspan="4">目前沒有任何管理員身份。</td></tr>';
            return;
        }

        let html = '';
        identities.forEach(identity => {
            // 對 description 做轉義，避免潛在的 XSS 風險（雖然是管理員輸入，但好習慣）
            const escapedDescription = escapeHtml(identity.description || '');
             // 將名稱和描述中的特殊字符也轉義，以便正確放入 onclick 的參數中
            const escapedName = escapeHtml(identity.name || '');

            html += `
                <tr>
                    <td>${identity.id}</td>
                    <td>${escapeHtml(identity.name || '')}</td>
                    <td>${escapedDescription}</td>
                    <td class="actions">
                        <button class="btn btn-warning btn-sm" onclick="editIdentity(${identity.id}, '${escapeJsString(escapedName)}', '${escapeJsString(escapedDescription)}')">編輯</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteIdentity(${identity.id}, '${escapeJsString(escapedName)}')">刪除</button>
                    </td>
                </tr>
            `;
        });
        identityListBody.innerHTML = html;
    }

    // --- 函數：準備編輯身份 (由按鈕的 onclick 調用) ---
    window.editIdentity = (id, name, description) => {
        identityIdInput.value = id;
        // 將 HTML 實體轉回原始字符以便編輯
        identityNameInput.value = decodeHtmlEntities(name);
        identityDescriptionInput.value = decodeHtmlEntities(description);
        cancelEditBtn.style.display = 'inline-block'; // 顯示取消按鈕
        saveIdentityBtn.textContent = '更新身份';
        formStatus.textContent = ''; // 清除舊訊息
        window.scrollTo(0, 0); // 滾動到頁面頂部方便編輯
    };

     // --- 函數：取消編輯狀態 ---
     function cancelEditMode() {
        identityForm.reset(); // 清空表單
        identityIdInput.value = ''; // 清除隱藏的 ID
        cancelEditBtn.style.display = 'none'; // 隱藏取消按鈕
        saveIdentityBtn.textContent = '儲存身份';
        formStatus.textContent = '';
     }

     // --- 事件監聽：點擊取消編輯按鈕 ---
     if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', cancelEditMode);
     }


    // --- 事件監聽：提交表單 (新增或更新) ---
    if (identityForm && saveIdentityBtn && formStatus) {
        identityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            saveIdentityBtn.disabled = true;
            formStatus.textContent = '處理中...';
            formStatus.style.color = 'blue';

            const id = identityIdInput.value;
            const name = identityNameInput.value.trim();
            const description = identityDescriptionInput.value.trim();

            if (!name) {
                formStatus.textContent = '錯誤：身份名稱不能為空！';
                formStatus.style.color = 'red';
                saveIdentityBtn.disabled = false;
                return;
            }

            const url = id ? `/api/admin/identities/${id}` : '/api/admin/identities';
            const method = id ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description }),
                });

                 const responseData = await response.json(); // 總嘗試解析

                if (!response.ok) {
                    throw new Error(responseData.error || `HTTP 錯誤 ${response.status}`);
                }

                formStatus.textContent = id ? '身份更新成功！' : '身份新增成功！';
                formStatus.style.color = 'green';
                cancelEditMode(); // 清空表單並重置按鈕
                fetchIdentities(); // 刷新列表

            } catch (error) {
                console.error('儲存身份失敗:', error);
                formStatus.textContent = `儲存失敗：${error.message}`;
                formStatus.style.color = 'red';
            } finally {
                 saveIdentityBtn.disabled = false;
                 // 可以加個 setTimeout 清除成功訊息
                 setTimeout(() => { if (formStatus.style.color === 'green') formStatus.textContent = ''; }, 3000);
            }
        });
    }

    // --- 函數：刪除身份 (由按鈕的 onclick 調用) ---
    window.deleteIdentity = async (id, name) => {
        // 使用 decodeHtmlEntities 顯示正確的名稱
        const decodedName = decodeHtmlEntities(name);
        if (confirm(`確定要刪除身份 "${decodedName}" (ID: ${id}) 嗎？\n使用此身份的回覆將顯示為預設名稱。`)) {
             // 可以在這裡添加一個 loading 狀態，例如暫時禁用所有刪除按鈕
             document.querySelectorAll('.btn-danger').forEach(btn => btn.disabled = true);
            try {
                const response = await fetch(`/api/admin/identities/${id}`, { method: 'DELETE' });
                if (!response.ok) {
                     // 嘗試解析錯誤訊息
                    let errorMsg = `HTTP 錯誤 ${response.status}`;
                    try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
                    throw new Error(`刪除失敗 (${errorMsg})`);
                }
                // 刪除成功，刷新列表
                fetchIdentities();
                // 如果表單正在編輯這個被刪除的 ID，則清空表單
                 if (identityIdInput.value === String(id)) {
                     cancelEditMode();
                 }

            } catch (error) {
                console.error('刪除身份失敗:', error);
                alert(`刪除失敗：${error.message}`); // 使用 alert 提示錯誤
            } finally {
                 // 恢復按鈕狀態
                 document.querySelectorAll('.btn-danger').forEach(btn => btn.disabled = false);
            }
        }
    };

    // --- 輔助函數：HTML 特殊字符轉義 ---
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, """)
             .replace(/'/g, "'");
    }

     // --- 輔助函數：JS 字串轉義 (用於 onclick 參數) ---
    function escapeJsString(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/\\/g, '\\\\') // 先替換反斜線
            .replace(/'/g, "\\'")  // 替換單引號
            .replace(/"/g, '\\"')  // 替換雙引號 (雖然我們主要用單引號，但也加上)
            .replace(/\n/g, '\\n') // 替換換行符
            .replace(/\r/g, '\\r') // 替換回車符
            .replace(/\t/g, '\\t') // 替換 Tab
            // .replace(/</g, '\\x3C') // 可選：轉義 HTML 標籤開始
            // .replace(/>/g, '\\x3E'); // 可選：轉義 HTML 標籤結束
    }

     // --- 輔助函數：將 HTML 實體解碼回字符 (用於編輯) ---
    function decodeHtmlEntities(encodedString) {
        if (!encodedString) return '';
        const textarea = document.createElement('textarea');
        textarea.innerHTML = encodedString;
        return textarea.value;
    }

    // --- 初始載入 ---
    fetchIdentities();
});