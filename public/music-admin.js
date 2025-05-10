// public/music-admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素引用 ---
    const albumListBody = document.querySelector('#album-list-table tbody');
    const albumListContainer = document.getElementById('album-list-container');
    const albumTable = document.getElementById('album-list-table');
    const loadingMessage = albumListContainer ? albumListContainer.querySelector('p') : null;
    const artistFilterButtonsContainer = document.getElementById('artist-filter-buttons'); // 新增歌手按鈕容器

    let allMusicData = []; // 用於存儲從 API獲取的所有音樂數據

    // --- 編輯 Modal 元素 ---
    const editModal = document.getElementById('edit-music-modal');
    const editForm = document.getElementById('edit-music-form');
    const editMusicId = document.getElementById('edit-music-id');
    const editMusicTitle = document.getElementById('edit-music-title');
    const editMusicArtist = document.getElementById('edit-music-artist');
    const editMusicReleaseDate = document.getElementById('edit-music-release-date');
    const editMusicDescription = document.getElementById('edit-music-description');
    const editMusicCoverUrl = document.getElementById('edit-music-cover-url');
    const editCoverPreview = document.getElementById('edit-cover-preview');
    const editMusicPlatformUrl = document.getElementById('edit-music-platform-url');
    const editMusicYoutubeId = document.getElementById('edit-music-youtube-id');
    const editScoresContainer = document.getElementById('edit-scores-container');
    const editFormError = document.getElementById('edit-music-form-error');

    // --- 新增 Modal 元素 ---
    const addModal = document.getElementById('add-music-modal');
    const addForm = document.getElementById('add-music-form');
    const addMusicTitle = document.getElementById('add-music-title');
    const addMusicArtist = document.getElementById('add-music-artist');
    const addMusicReleaseDate = document.getElementById('add-music-release-date');
    const addMusicDescription = document.getElementById('add-music-description');
    const addMusicCoverUrl = document.getElementById('add-music-cover-url');
    const addCoverPreview = document.getElementById('add-cover-preview'); // 確保 HTML 中有此 ID
    const addMusicPlatformUrl = document.getElementById('add-music-platform-url');
    const addMusicYoutubeId = document.getElementById('add-music-youtube-id');
    const addScoresContainer = document.getElementById('add-scores-container');
    const addFormError = document.getElementById('add-music-form-error');

    // --- 預覽圖片功能 ---
    function setupImagePreview(inputElement, previewElement) {
        if (inputElement && previewElement) {
            inputElement.addEventListener('input', () => {
                const url = inputElement.value.trim();
                previewElement.src = url; // 嘗試設置 src
                if (url) {
                    previewElement.style.display = 'block';
                    previewElement.onerror = () => { // 監聽錯誤
                        console.warn("圖片預覽失敗，URL:", url);
                        previewElement.style.display = 'none';
                        previewElement.src = '';
                    };
                } else {
                    previewElement.style.display = 'none';
                    previewElement.src = '';
                }
            });
             // 確保頁面載入或 Modal 打開時也能觸發一次檢查
            const initialUrl = inputElement.value.trim();
             if (initialUrl) {
                 previewElement.src = initialUrl;
                 previewElement.style.display = 'block';
                 previewElement.onerror = () => { previewElement.style.display = 'none'; previewElement.src = ''; };
             } else {
                 previewElement.style.display = 'none';
             }
        } else {
             console.warn("圖片預覽設定失敗：找不到輸入元素或預覽元素。 Input ID:", inputElement?.id, "Preview ID:", previewElement?.id);
        }
    }
    // 在 DOMContentLoaded 後為兩個 Modal 的預覽設置監聽
    setupImagePreview(addMusicCoverUrl, addCoverPreview);
    setupImagePreview(editMusicCoverUrl, editCoverPreview);


    // --- 動態添加樂譜輸入行的函數 ---
    window.addScoreInputRow = function(modalPrefix) {
        const container = document.getElementById(`${modalPrefix}-scores-container`);
        if (!container) {
            console.error(`找不到樂譜容器： #${modalPrefix}-scores-container`);
            return;
        }
        const scoreIndex = container.querySelectorAll('.score-input-row').length; // 更可靠的計算方式
        const div = document.createElement('div');
        div.classList.add('score-input-row');
        div.innerHTML = `
            <input type="hidden" name="scores[${scoreIndex}][id]" value="">
            <input type="text" name="scores[${scoreIndex}][type]" placeholder="樂譜類型 (例: 鋼琴譜)" style="flex: 1;" required>
            <input type="url" name="scores[${scoreIndex}][pdf_url]" placeholder="PDF 網址 (https://...)" style="flex: 2;" required>
            <input type="number" name="scores[${scoreIndex}][display_order]" value="0" title="排序 (數字越小越前)" style="width: 70px; text-align: center;" required>
            <button type="button" onclick="this.parentElement.remove()" title="移除此樂譜">移除</button>
        `;
        container.appendChild(div);
    }

    // --- 渲染音樂列表到表格 ---
    function renderMusicList(musicToRender) {
        if (!albumListBody || !albumTable) {
            console.error("音樂列表的 DOM 元素不完整 (renderMusicList)。");
            return;
        }
        albumListBody.innerHTML = ''; // 清空現有列表

        if (musicToRender.length === 0) {
            albumTable.style.display = 'table';
            albumListBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 1rem;">沒有符合條件的音樂項目。</td></tr>';
            return;
        }

        albumTable.style.display = 'table';
        musicToRender.forEach(music => {
            const row = document.createElement('tr');
            row.dataset.musicId = music.id;
            const releaseDateFormatted = music.release_date
                ? new Date(music.release_date).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
                : 'N/A';
            row.innerHTML = `
                <td>${music.id}</td>
                <td title="${music.title || ''}">${music.title || ''}</td>
                <td title="${music.artist || ''}">${music.artist || ''}</td>
                <td>${releaseDateFormatted}</td>
                <td><img src="${music.cover_art_url || '/images/placeholder.png'}" alt="${music.title || ''} 封面" style="max-width: 60px; max-height: 60px; height: auto; border: 1px solid #eee; object-fit: contain; display: block; margin: auto;"></td>
                <td>
                    <button class="action-btn edit-btn" onclick="window.editMusic(${music.id})">編輯</button>
                    <button class="action-btn delete-btn" onclick="window.deleteMusic(${music.id})">刪除</button>
                </td>
            `;
            albumListBody.appendChild(row);
        });
    }

    // --- 渲染歌手篩選按鈕 ---
    function renderArtistButtons(musicList) {
        if (!artistFilterButtonsContainer) {
            console.error("歌手篩選按鈕容器未找到。");
            return;
        }
        artistFilterButtonsContainer.innerHTML = ''; // 清空舊按鈕

        const artists = [...new Set(musicList.map(music => music.artist).filter(artist => artist))].sort(); // 獲取唯一歌手並排序

        // 新增「顯示全部」按鈕
        const showAllButton = document.createElement('button');
        showAllButton.textContent = '顯示全部';
        showAllButton.classList.add('action-btn'); // 可以使用現有樣式或自訂
        showAllButton.style.marginRight = '5px';
        showAllButton.style.marginBottom = '5px';
        showAllButton.onclick = () => {
            renderMusicList(allMusicData); // 使用存儲的完整列表
            setActiveButton(showAllButton);
        };
        artistFilterButtonsContainer.appendChild(showAllButton);

        artists.forEach(artist => {
            const button = document.createElement('button');
            button.textContent = artist;
            button.classList.add('action-btn');
            button.style.marginRight = '5px';
            button.style.marginBottom = '5px';
            button.onclick = () => {
                const filteredMusic = allMusicData.filter(music => music.artist === artist);
                renderMusicList(filteredMusic);
                setActiveButton(button);
            };
            artistFilterButtonsContainer.appendChild(button);
        });
        
        // 預設選中「顯示全部」
        if (artists.length > 0) {
             setActiveButton(showAllButton);
        }
    }
    
    function setActiveButton(activeBtn) {
        const buttons = artistFilterButtonsContainer.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.style.backgroundColor = ''; // 重置背景色
            btn.style.fontWeight = 'normal';
        });
        activeBtn.style.backgroundColor = '#007bff'; // 例如：高亮顏色
        activeBtn.style.color = 'white';
        activeBtn.style.fontWeight = 'bold';
    }


    // --- 獲取並顯示所有音樂 ---
    async function fetchAndDisplayMusic(filterArtist = null) {
        if (!albumListBody || !albumListContainer || !albumTable || !loadingMessage) {
            console.error("音樂列表的 DOM 元素不完整。");
            return;
        }
        try {
            loadingMessage.style.display = 'block';
            loadingMessage.textContent = '正在加載音樂...';
            albumTable.style.display = 'none';
            albumListBody.innerHTML = '';

            // 只有在 allMusicData 為空時才從 API 獲取
            if (allMusicData.length === 0) {
                const response = await fetch('/api/music');
                if (!response.ok) throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
                allMusicData = await response.json();
                renderArtistButtons(allMusicData); // 首次獲取數據後渲染按鈕
            }
            
            loadingMessage.style.display = 'none';

            let musicToDisplay = allMusicData;
            if (filterArtist) {
                musicToDisplay = allMusicData.filter(music => music.artist === filterArtist);
            }
            
            renderMusicList(musicToDisplay);

        } catch (error) {
            console.error("獲取管理音樂列表失敗:", error);
            if(loadingMessage) loadingMessage.textContent = '無法載入音樂列表。';
            if(albumTable) albumTable.style.display = 'none';
            allMusicData = []; // 出錯時清空，以便下次重試時重新獲取
        }
    }


    // --- 開啟並填充編輯音樂 Modal ---
    async function openEditMusicModal(id) {
        const requiredEditElements = [editModal, editForm, editMusicId, editMusicTitle, editMusicArtist, editMusicReleaseDate, editMusicDescription, editMusicCoverUrl, editCoverPreview, editMusicPlatformUrl, editMusicYoutubeId, editScoresContainer, editFormError];
        if (requiredEditElements.some(el => !el)) {
            console.error("編輯 Modal 的必要元素缺失。Elements:", {editModal, editForm, editMusicId, editMusicTitle, editMusicArtist, editMusicReleaseDate, editMusicDescription, editMusicCoverUrl, editCoverPreview, editMusicPlatformUrl, editMusicYoutubeId, editScoresContainer, editFormError});
            alert("無法開啟編輯視窗，頁面元件錯誤。請檢查控制台。");
            return;
        }
        editFormError.textContent = '';
        editForm.reset();
        editCoverPreview.src = '';
        editCoverPreview.style.display = 'none';
        editScoresContainer.innerHTML = ''; // 清空舊的樂譜行

        try {
            const response = await fetch(`/api/music/${id}`); // 後端需返回 scores
            if (!response.ok) {
                if (response.status === 404) throw new Error('找不到該音樂項目。');
                throw new Error(`無法獲取音樂資料 (HTTP ${response.status})`);
            }
            const music = await response.json();

            // 填充基礎資訊
            editMusicId.value = music.id;
            editMusicTitle.value = music.title || '';
            editMusicArtist.value = music.artist || '';
            editMusicReleaseDate.value = music.release_date ? music.release_date.split('T')[0] : '';
            editMusicDescription.value = music.description || '';
            editMusicCoverUrl.value = music.cover_art_url || '';
            editMusicPlatformUrl.value = music.platform_url || '';
            editMusicYoutubeId.value = music.youtube_video_id || '';

            // 手動觸發封面預覽更新
             setupImagePreview(editMusicCoverUrl, editCoverPreview); // 確保監聽器已設定
             const event = new Event('input', { bubbles: true }); // 創建 input 事件
             editMusicCoverUrl.dispatchEvent(event); // 觸發事件以更新預覽


            // 填充現有樂譜
            if (music.scores && Array.isArray(music.scores)) {
                music.scores.forEach((score, index) => {
                    if (typeof window.addScoreInputRow === 'function') {
                        window.addScoreInputRow('edit');
                        const row = editScoresContainer.children[index];
                        if (row) {
                            row.querySelector('input[name^="scores"][name$="[id]"]').value = score.id || '';
                            row.querySelector('input[name^="scores"][name$="[type]"]').value = score.type || '';
                            row.querySelector('input[name^="scores"][name$="[pdf_url]"]').value = score.pdf_url || '';
                            row.querySelector('input[name^="scores"][name$="[display_order]"]').value = score.display_order !== undefined ? score.display_order : 0;
                        } else { console.error(`無法找到索引為 ${index} 的樂譜輸入行。`); }
                    } else { console.error('addScoreInputRow 函數未定義在 window 上。'); }
                });
            } else {
                 console.log(`音樂 ID ${id} 沒有關聯的樂譜資料。`);
            }

            editModal.style.display = 'flex';
        } catch (error) {
            console.error(`獲取音樂 ${id} 進行編輯時出錯:`, error);
            alert(`無法載入編輯資料： ${error.message}`);
        }
    }

    // --- 關閉 Modal ---
    window.closeEditMusicModal = function() { if (editModal) editModal.style.display = 'none'; }
    window.closeAddMusicModal = function() { if (addModal) addModal.style.display = 'none'; }

    // --- 將編輯和刪除函數掛載到 window ---
    window.editMusic = openEditMusicModal;
    window.deleteMusic = async function(id) {
        if (confirm(`確定要刪除音樂 ID: ${id} 嗎？此操作也會刪除關聯的樂譜。`)) {
            try {
                const response = await fetch(`/api/music/${id}`, { method: 'DELETE' });
                if (response.status === 204 || response.ok) {
                    console.log(`音樂 ID ${id} 已刪除。`);
                    await fetchAndDisplayMusic();
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`;
                    try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { /*忽略*/ }
                    throw new Error(errorMsg);
                }
            } catch (error) {
                alert(`刪除時發生錯誤：${error.message}`);
                console.error(`刪除音樂 ID ${id} 時出錯:`, error);
            }
        }
    };

    // --- 顯示新增 Modal ---
    window.showAddMusicForm = function() {
        const requiredAddElements = [addModal, addForm, addMusicTitle, addMusicArtist, addMusicReleaseDate, addMusicDescription, addMusicCoverUrl, addMusicPlatformUrl, addMusicYoutubeId, addScoresContainer, addFormError, addCoverPreview];
        if (requiredAddElements.some(el => !el)) {
             console.error("新增 Modal 的必要元素缺失。Elements:", {addModal, addForm, addMusicTitle, addMusicArtist, addMusicReleaseDate, addMusicDescription, addMusicCoverUrl, addMusicPlatformUrl, addMusicYoutubeId, addScoresContainer, addFormError, addCoverPreview});
             alert("新增視窗元件錯誤，無法開啟。請檢查控制台。");
             return;
        }
        addFormError.textContent = '';
        addForm.reset();
        addScoresContainer.innerHTML = ''; // 清空樂譜區
        addCoverPreview.src = ''; // 清空預覽 src
        addCoverPreview.style.display = 'none'; // 隱藏預覽
        addModal.style.display = 'flex';
    }

    // --- 點擊 Modal 外部關閉 ---
    window.onclick = function(event) {
        if (event.target == editModal) closeEditMusicModal();
        else if (event.target == addModal) closeAddMusicModal();
    }

    // --- 表單提交處理函數 (共用邏輯) ---
    async function handleFormSubmit(event, isEditMode) {
        event.preventDefault();
        const form = event.target;
        const modalPrefix = isEditMode ? 'edit' : 'add';
        const formErrorElement = document.getElementById(`${modalPrefix}-music-form-error`);
        formErrorElement.textContent = ''; // 清除舊錯誤

        const musicId = isEditMode ? document.getElementById('edit-music-id').value : null;

        // --- 收集樂譜數據 ---
        const scoresContainer = document.getElementById(`${modalPrefix}-scores-container`);
        const scoreRows = scoresContainer.querySelectorAll('.score-input-row');
        const scores = [];
        let scoreValidationError = false;

        scoreRows.forEach(row => {
            if (scoreValidationError) return;

            const idInput = row.querySelector('input[name^="scores"][name$="[id]"]');
            const typeInput = row.querySelector('input[name^="scores"][name$="[type]"]');
            const urlInput = row.querySelector('input[name^="scores"][name$="[pdf_url]"]');
            const orderInput = row.querySelector('input[name^="scores"][name$="[display_order]"]');

            const typeValue = typeInput.value.trim();
            const urlValue = urlInput.value.trim();
            const orderValue = orderInput.value.trim();

            // 只要填了其中一個就進行驗證
            if (typeValue || urlValue) {
                 if (!typeValue) {
                     formErrorElement.textContent = '樂譜類型不能為空 (如果已填寫 URL)。';
                     typeInput.focus();
                     scoreValidationError = true;
                     return;
                 }
                 // 稍微放寬 URL 驗證，允許相對路徑和 http/https
                 if (!urlValue || !(urlValue.startsWith('/') || urlValue.startsWith('http://') || urlValue.startsWith('https://'))) {
                     formErrorElement.textContent = '請輸入有效的 PDF 網址 (需以 / 或 http(s):// 開頭)。';
                     urlInput.focus();
                     scoreValidationError = true;
                     return;
                 }
                  // 驗證排序是否為數字
                 const orderNum = parseInt(orderValue, 10);
                  if (isNaN(orderNum)) {
                      formErrorElement.textContent = '樂譜排序必須是數字。';
                      orderInput.focus();
                      scoreValidationError = true;
                      return;
                  }

                scores.push({
                    id: isEditMode && idInput && idInput.value ? parseInt(idInput.value, 10) : undefined,
                    type: typeValue,
                    pdf_url: urlValue,
                    display_order: orderNum
                });
             }
        });

        if (scoreValidationError) return;
        // --- 樂譜數據收集結束 ---

        // 收集基礎音樂數據
        const formData = {
             title: form.elements['title'].value.trim(),
             artist: form.elements['artist'].value.trim(),
             release_date: form.elements['release_date'].value || null,
             description: form.elements['description'].value.trim(),
             cover_art_url: form.elements['cover_art_url'].value.trim() || null,
             platform_url: form.elements['platform_url'].value.trim() || null,
             youtube_video_id: form.elements['youtube_video_id'] ? form.elements['youtube_video_id'].value.trim() || null : null,
             scores: scores
        };

        // 基礎數據驗證
        if (!formData.title) { formErrorElement.textContent = '專輯標題不能為空。'; return; }
        if (!formData.artist) { formErrorElement.textContent = '歌手名稱不能為空。'; return; }
        const isValidUrlOrPath = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');
        if (formData.cover_art_url && !isValidUrlOrPath(formData.cover_art_url)) { formErrorElement.textContent = '封面圖片路徑格式不正確 (應為 / 開頭或 http(s):// 開頭)。'; return; }
        if (formData.platform_url && !(formData.platform_url.startsWith('http://') || formData.platform_url.startsWith('https://'))) { formErrorElement.textContent = '平台連結格式不正確 (需以 http(s):// 開頭)。'; return; }
         if (formData.youtube_video_id && !/^[a-zA-Z0-9_-]{11}$/.test(formData.youtube_video_id)) {
             formErrorElement.textContent = 'YouTube 影片 ID 格式不正確 (應為 11 位英數字元、底線或減號)。'; return;
         }


        // --- 發送請求 ---
        const apiUrl = isEditMode ? `/api/music/${musicId}` : '/api/music';
        const method = isEditMode ? 'PUT' : 'POST';
        const successAction = isEditMode ? '更新' : '新增';
        const errorAction = isEditMode ? '儲存' : '新增';

        try {
            console.log(`Sending ${method} data to ${apiUrl}:`, JSON.stringify(formData, null, 2));
            const response = await fetch(apiUrl, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                let errorMsg = `${successAction}失敗 (HTTP ${response.status})`;
                try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { /*忽略*/ }
                throw new Error(errorMsg);
            }

            console.log(`音樂 ${successAction}成功。`);
            if (isEditMode) {
                closeEditMusicModal();
            } else {
                closeAddMusicModal();
            }
            await fetchAndDisplayMusic(); // 重新載入列表

        } catch (error) {
            formErrorElement.textContent = `${errorAction}錯誤：${error.message}`;
            console.error(`${errorAction}音樂時發生錯誤:`, error);
        }
    }

    // --- 綁定表單提交事件 ---
    if (editForm) {
        editForm.addEventListener('submit', (event) => handleFormSubmit(event, true));
    } else {
        console.error("編輯音樂表單元素未找到。");
    }

    if (addForm) {
        addForm.addEventListener('submit', (event) => handleFormSubmit(event, false));
    } else {
        console.error("新增音樂表單元素未找到。");
    }

    // --- 初始載入 ---
    fetchAndDisplayMusic(); // 頁面載入時獲取音樂列表

}); // End of DOMContentLoaded