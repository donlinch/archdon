// public/admin-identities.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
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
        if (!identityListBody) {
            console.error('錯誤：找不到身份列表容器 #identity-list-body');
            return;
        }
        identityListBody.innerHTML = '<tr><td colspan="4">正在載入身份列表...</td></tr>';
        try {
            const response = await fetch('/api/admin/identities'); // 【API 路徑】
            if (!response.ok) {
                 let errorMsg = `HTTP 錯誤 ${response.status}`;
                 try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
                 if (response.status === 401) throw new Error('您需要登入才能訪問此功能。');
                 if (response.status === 403) throw new Error('您沒有權限訪問此功能。'); // 雖然 Basic Auth 通常只有過或不過
                throw new Error(`無法獲取身份列表 (${errorMsg})`);
            }
            const identities = await response.json();
            renderIdentityList(identities);
        } catch (error) {
            console.error('獲取身份列表失敗:', error);
            identityListBody.innerHTML = `<tr><td colspan="4" style="color: red;">無法載入身份列表：${error.message}</td></tr>`;
            if (error.message.includes('登入')) {
               alert('請先登入管理後台！');
               // window.location.href = '/login.html'; // 可選：導向登入頁
            }
        }
    }

    // --- 函數：渲染身份列表 (使用 DOM 操作) ---
    function renderIdentityList(identities) {
        if (!identityListBody) return;
        identityListBody.innerHTML = ''; // 清空

        if (!identities || identities.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 4;
            td.textContent = '目前沒有任何管理員身份。';
            tr.appendChild(td);
            identityListBody.appendChild(tr);
            return;
        }

        identities.forEach(identity => {
            const tr = document.createElement('tr');
            tr.id = `identity-row-${identity.id}`;

            const tdId = document.createElement('td');
            tdId.textContent = identity.id;

            const tdName = document.createElement('td');
            tdName.textContent = identity.name || ''; // 使用 textContent

            const tdDescription = document.createElement('td');
            tdDescription.textContent = identity.description || ''; // 使用 textContent
            tdDescription.style.whiteSpace = 'pre-wrap'; // 讓描述中的換行生效

            const tdActions = document.createElement('td');
            tdActions.className = 'actions';

            // 編輯按鈕
            const editButton = document.createElement('button');
            editButton.className = 'btn btn-warning btn-sm edit-identity-btn';
            editButton.textContent = '編輯';
            editButton.dataset.id = identity.id;
            editButton.dataset.name = identity.name || ''; // 將原始值存入 data-*
            editButton.dataset.description = identity.description || '';
            // 事件監聽器將由事件委派處理

            // 刪除按鈕
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-danger btn-sm delete-identity-btn';
            deleteButton.textContent = '刪除';
            deleteButton.dataset.id = identity.id;
            deleteButton.dataset.name = identity.name || '';
            // 事件監聽器將由事件委派處理

            tdActions.appendChild(editButton);
            tdActions.appendChild(deleteButton);

            tr.appendChild(tdId);
            tr.appendChild(tdName);
            tr.appendChild(tdDescription);
            tr.appendChild(tdActions);

            identityListBody.appendChild(tr);
        });
    }

    // --- 函數：準備編輯身份 (由事件委派調用) ---
    function prepareEditIdentity(id, name, description) {
        identityIdInput.value = id;
        identityNameInput.value = name; // 直接使用從 data-* 讀取的值
        identityDescriptionInput.value = description;
        cancelEditBtn.style.display = 'inline-block';
        saveIdentityBtn.textContent = '更新身份';
        formStatus.textContent = '';
        identityForm.scrollIntoView({ behavior: 'smooth' }); // 滾動到表單
    }

    // --- 函數：取消編輯狀態 ---
    function cancelEditMode() {
        identityForm.reset();
        identityIdInput.value = '';
        cancelEditBtn.style.display = 'none';
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

                const responseData = await response.json();

                if (!response.ok) {
                    // 後端應該在 responseData.error 中提供錯誤訊息
                    throw new Error(responseData.error || `HTTP 錯誤 ${response.status}`);
                }

                formStatus.textContent = id ? '身份更新成功！' : '身份新增成功！';
                formStatus.style.color = 'green';
                cancelEditMode();
                await fetchIdentities(); // 使用 await 確保刷新完成

            } catch (error) {
                console.error('儲存身份失敗:', error);
                formStatus.textContent = `儲存失敗：${error.message}`;
                formStatus.style.color = 'red';
            } finally {
                 saveIdentityBtn.disabled = false;
                 setTimeout(() => { if (formStatus.style.color === 'green') formStatus.textContent = ''; }, 3000);
            }
        });
    }

     // --- 【★ 新增 ★】事件委派監聽器，處理編輯和刪除按鈕 ---
     if (identityListBody) {
        identityListBody.addEventListener('click', async (event) => {
            const target = event.target;

            // --- 處理編輯按鈕 ---
            if (target.matches('.edit-identity-btn')) {
                const id = target.dataset.id;
                const name = target.dataset.name;
                const description = target.dataset.description;
                prepareEditIdentity(id, name, description); // 調用準備編輯的函數
            }

            // --- 處理刪除按鈕 ---
            else if (target.matches('.delete-identity-btn')) {
                const id = target.dataset.id;
                const name = target.dataset.name;

                if (confirm(`確定要刪除身份 "${name}" (ID: ${id}) 嗎？\n使用此身份的回覆將顯示為預設名稱。`)) {
                    target.disabled = true; // 禁用當前按鈕
                    try {
                        const response = await fetch(`/api/admin/identities/${id}`, { method: 'DELETE' });
                        if (!response.ok && response.status !== 204) { // 204 No Content 也是成功
                             let errorMsg = `HTTP 錯誤 ${response.status}`;
                             try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
                            throw new Error(`刪除失敗 (${errorMsg})`);
                        }
                        // 刪除成功，刷新列表
                        await fetchIdentities();
                        // 如果表單正在編輯這個被刪除的 ID，則清空表單
                         if (identityIdInput.value === String(id)) {
                             cancelEditMode();
                         }

                    } catch (error) {
                        console.error('刪除身份失敗:', error);
                        alert(`刪除失敗：${error.message}`);
                        target.disabled = false; // 恢復按鈕
                    }
                    // 不需要 finally 再啟用按鈕，因為成功後按鈕會隨列表刷新重新創建
                }
            }
        });
    }

    // --- 移除全局函數 (因為改用事件委派) ---
    // window.editIdentity = ...
    // window.deleteIdentity = ...

    // --- 初始載入 ---
    fetchIdentities();
});