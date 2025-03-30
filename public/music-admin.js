// public/music-admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References (修改選擇器 ID) ---
    const albumListBody = document.querySelector('#album-list-table tbody'); // *** 修改 ID ***
    const albumListContainer = document.getElementById('album-list-container'); // *** 修改 ID ***
    const albumTable = document.getElementById('album-list-table'); // *** 修改 ID ***
    const loadingMessage = albumListContainer ? albumListContainer.querySelector('p') : null;

    // --- Edit Modal elements (修改 ID) ---
    const editModal = document.getElementById('edit-music-modal'); // *** 修改 ID ***
    const editForm = document.getElementById('edit-music-form'); // *** 修改 ID ***
    const editMusicId = document.getElementById('edit-music-id'); // *** 修改 ID ***
    const editMusicTitle = document.getElementById('edit-music-title'); // *** 修改 ID ***
    const editMusicArtist = document.getElementById('edit-music-artist'); // *** 修改 ID ***
    const editMusicReleaseDate = document.getElementById('edit-music-release-date'); // *** 新增 ***
    const editMusicDescription = document.getElementById('edit-music-description'); // *** 修改 ID ***
    const editMusicCoverUrl = document.getElementById('edit-music-cover-url'); // *** 修改 ID ***
    const editCoverPreview = document.getElementById('edit-cover-preview'); // *** 修改 ID ***
    const editMusicPlatformUrl = document.getElementById('edit-music-platform-url'); // *** 修改 ID ***
    // const editProductClickCount = ...; // *** 移除點擊次數相關 ***
    const editFormError = document.getElementById('edit-music-form-error'); // *** 修改 ID ***

    // --- Add Modal elements (修改 ID) ---
    const addModal = document.getElementById('add-music-modal'); // *** 修改 ID ***
    const addForm = document.getElementById('add-music-form'); // *** 修改 ID ***
    const addMusicTitle = document.getElementById('add-music-title'); // *** 修改 ID ***
    const addMusicArtist = document.getElementById('add-music-artist'); // *** 修改 ID ***
    const addMusicReleaseDate = document.getElementById('add-music-release-date'); // *** 新增 ***
    const addMusicDescription = document.getElementById('add-music-description'); // *** 修改 ID ***
    const addMusicCoverUrl = document.getElementById('add-music-cover-url'); // *** 修改 ID ***
    // const addImagePreview = ...; // Add modal HTML 中沒有預覽 ID
    const addMusicPlatformUrl = document.getElementById('add-music-platform-url'); // *** 修改 ID ***
    const addFormError = document.getElementById('add-music-form-error'); // *** 修改 ID ***

    // --- Function to Fetch and Display ALL Music in the Table ---
    async function fetchAndDisplayMusic() { // *** 修改函數名 ***
        if (!albumListBody || !albumListContainer || !albumTable) { /* ... 錯誤處理 ... */ return; }
        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (albumTable) albumTable.style.display = 'none';

            const response = await fetch('/api/music'); // *** 修改 API URL ***
            if (!response.ok) throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            const musicList = await response.json(); // *** 修改變數名 ***

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (albumTable) albumTable.style.display = 'table';
            albumListBody.innerHTML = '';

            if (musicList.length === 0) {
                albumListBody.innerHTML = '<tr><td colspan="6">目前沒有音樂項目。</td></tr>'; // *** 修改 Colspan ***
                return;
            }

            musicList.forEach(music => { // *** 修改變數名 ***
                const row = document.createElement('tr');
                row.dataset.musicId = music.id; // *** 修改 dataset ***
                // *** 修改 row.innerHTML 以匹配音樂欄位 ***
                row.innerHTML = `
                    <td>${music.id}</td>
                    <td>${music.title || ''}</td>
                    <td>${music.artist || ''}</td>
                    <td>${music.release_date ? new Date(music.release_date).toLocaleDateString() : 'N/A'}</td> <!-- 格式化日期 -->
                    <td><img src="${music.cover_art_url || '/images/placeholder.png'}" alt="${music.title || ''}" style="width: 50px; height: auto; border: 1px solid #eee;"></td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editMusic(${music.id})">編輯</button> <!-- *** 修改 onclick *** -->
                        <button class="action-btn delete-btn" onclick="deleteMusic(${music.id})">刪除</button> <!-- *** 修改 onclick *** -->
                    </td>
                `;
                albumListBody.appendChild(row);
            });
        } catch (error) { console.error("獲取管理音樂列表失敗:", error); /* ... 錯誤處理 ... */ }
    }

    // --- Function to Open and Populate the Edit Music Modal ---
    async function openEditMusicModal(id) { // *** 修改函數名 ***
         const requiredEditElements = [editModal, editForm, editMusicId, editMusicTitle, editMusicArtist, editMusicReleaseDate, editMusicDescription, editMusicCoverUrl, editCoverPreview, editMusicPlatformUrl, editFormError]; // *** 更新檢查列表 ***
         if (requiredEditElements.some(el => !el)) { /* ... 報錯 ... */ return; }
         editFormError.textContent = ''; editForm.reset(); editCoverPreview.style.display = 'none'; editCoverPreview.src = ''; // *** 修改預覽 ID ***

         try {
             const response = await fetch(`/api/music/${id}`); // *** 修改 API URL ***
             if (!response.ok) { if (response.status === 404) throw new Error('找不到該音樂項目。'); throw new Error(`無法獲取音樂資料 (HTTP ${response.status})`); }
             const music = await response.json(); // *** 修改變數名 ***

             // *** 填充音樂表單欄位 ***
             editMusicId.value = music.id;
             editMusicTitle.value = music.title || '';
             editMusicArtist.value = music.artist || '';
             // 處理日期格式 (需要 YYYY-MM-DD)
             editMusicReleaseDate.value = music.release_date ? music.release_date.split('T')[0] : '';
             editMusicDescription.value = music.description || '';
             editMusicCoverUrl.value = music.cover_art_url || '';
             editMusicPlatformUrl.value = music.platform_url || '';
             // *** 移除點擊次數填充 ***

             if (music.cover_art_url) { editCoverPreview.src = music.cover_art_url; editCoverPreview.style.display = 'block'; } // *** 修改預覽 ID 和 src ***
             else { editCoverPreview.style.display = 'none'; }
             editModal.style.display = 'flex';
         } catch (error) { console.error(`獲取音樂 ${id} 進行編輯時出錯:`, error); alert(`無法載入編輯資料： ${error.message}`); }
    }

    // --- Function to Close the Edit Music Modal ---
    window.closeEditMusicModal = function() { if (editModal) { editModal.style.display = 'none'; } } // *** 修改函數名 ***

    // --- Function to Close the Add Music Modal ---
    window.closeAddMusicModal = function() { if (addModal) { addModal.style.display = 'none'; } } // *** 修改函數名 ***

    // --- Attach Edit Function to Global Scope ---
    window.editMusic = function(id) { openEditMusicModal(id); }; // *** 修改函數名 ***

    // --- Attach Delete Function to Global Scope ---
    window.deleteMusic = async function(id) { // *** 修改函數名 ***
        if (confirm(`確定要刪除音樂 ID: ${id} 嗎？`)) {
            try {
                const response = await fetch(`/api/music/${id}`, { method: 'DELETE' }); // *** 修改 API URL ***
                if (response.status === 204 || response.ok) {
                    await fetchAndDisplayMusic(); // *** 修改調用函數 ***
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${response.statusText}`; } throw new Error(errorMsg);
                }
            } catch (error) { alert(`刪除時發生錯誤：${error.message}`); }
        }
    };

    // --- Attach Show Add Form Function to Global Scope ---
    window.showAddMusicForm = function() { // *** 修改函數名 ***
        const requiredAddElements = [addModal, addForm, addMusicTitle, addMusicArtist, addMusicReleaseDate, addMusicDescription, addMusicCoverUrl, addMusicPlatformUrl, addFormError]; // *** 更新檢查列表 ***
        if (requiredAddElements.some(el => !el)) { alert("新增視窗元件錯誤，無法開啟。"); return; }
        addFormError.textContent = ''; addForm.reset(); addModal.style.display = 'flex';
    }

    // --- Close Modals if User Clicks Outside ---
    window.onclick = function(event) { if (event.target == editModal) { closeEditMusicModal(); } else if (event.target == addModal) { closeAddMusicModal(); } } // *** 修改調用函數 ***

    // --- Edit Music Form Submission Listener ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault(); editFormError.textContent = ''; const musicId = editMusicId.value; if (!musicId) { /* ... 報錯 ... */ return; }
            // *** 收集音樂表單數據 ***
            const updatedData = {
                 title: editMusicTitle.value.trim(),
                 artist: editMusicArtist.value.trim(),
                 release_date: editMusicReleaseDate.value || null, // 直接取 date input 的值
                 description: editMusicDescription.value.trim(),
                 cover_art_url: editMusicCoverUrl.value.trim() || null,
                 platform_url: editMusicPlatformUrl.value.trim() || null
            };
            // *** 驗證音樂數據 ***
            if (!updatedData.title) { editFormError.textContent = '專輯標題不能為空。'; return; }
            if (!updatedData.artist) { editFormError.textContent = '歌手名稱不能為空。'; return; }
            // 可以添加更嚴格的日期驗證
            const isValidUrl = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
            if (!isValidUrl(updatedData.cover_art_url)) { editFormError.textContent = '封面圖片路徑格式不正確。'; return; }
            if (!isValidUrl(updatedData.platform_url)) { editFormError.textContent = '平台連結格式不正確。'; return; }

            try { // *** 發送 PUT 請求到 /api/music/:id ***
                const response = await fetch(`/api/music/${musicId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) });
                if (!response.ok) { let errorMsg = `儲存失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
                closeEditMusicModal(); // *** 修改調用函數 ***
                await fetchAndDisplayMusic(); // *** 修改調用函數 ***
            } catch (error) { editFormError.textContent = `儲存錯誤：${error.message}`; }
        });
    } else { console.error("編輯音樂表單元素未找到。"); }

    // --- Add Music Form Submission Listener ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault(); addFormError.textContent = '';
            // *** 收集新增音樂表單數據 ***
            const newMusicData = {
                title: addMusicTitle.value.trim(),
                artist: addMusicArtist.value.trim(),
                release_date: addMusicReleaseDate.value || null,
                description: addMusicDescription.value.trim(),
                cover_art_url: addMusicCoverUrl.value.trim() || null,
                platform_url: addMusicPlatformUrl.value.trim() || null
            };
            // *** 驗證新增音樂數據 ***
             if (!newMusicData.title) { addFormError.textContent = '專輯標題不能為空。'; return; }
             if (!newMusicData.artist) { addFormError.textContent = '歌手名稱不能為空。'; return; }
             const isValidUrl = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
             if (!isValidUrl(newMusicData.cover_art_url)) { addFormError.textContent = '封面圖片路徑格式不正確。'; return; }
             if (!isValidUrl(newMusicData.platform_url)) { addFormError.textContent = '平台連結格式不正確。'; return; }

            try { // *** 發送 POST 請求到 /api/music ***
                const response = await fetch(`/api/music`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newMusicData) });
                if (!response.ok) { let errorMsg = `新增失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
                closeAddMusicModal(); // *** 修改調用函數 ***
                await fetchAndDisplayMusic(); // *** 修改調用函數 ***
            } catch (error) { addFormError.textContent = `新增錯誤：${error.message}`; }
        });
    } else { console.error("新增音樂表單元素未找到。"); }

    // --- Initial Load ---
    fetchAndDisplayMusic(); // *** 修改調用函數 ***

}); // End of DOMContentLoaded