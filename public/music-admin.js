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
    const editMusicArtist = document.getElementById('edit-music-artist'); // Textarea for artists
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
    const addMusicArtist = document.getElementById('add-music-artist'); // Textarea for artists
    const addMusicReleaseDate = document.getElementById('add-music-release-date');
    const addMusicDescription = document.getElementById('add-music-description');
    const addMusicCoverUrl = document.getElementById('add-music-cover-url');
    const addCoverPreview = document.getElementById('add-cover-preview');
    const addMusicPlatformUrl = document.getElementById('add-music-platform-url');
    const addMusicYoutubeId = document.getElementById('add-music-youtube-id');
    const addScoresContainer = document.getElementById('add-scores-container');
    const addFormError = document.getElementById('add-music-form-error');

    // --- 預覽圖片功能 ---
    function setupImagePreview(inputElement, previewElement) {
        if (inputElement && previewElement) {
            inputElement.addEventListener('input', () => {
                const url = inputElement.value.trim();
                previewElement.src = url;
                if (url) {
                    previewElement.style.display = 'block';
                    previewElement.onerror = () => {
                        console.warn("圖片預覽失敗，URL:", url);
                        previewElement.style.display = 'none';
                        previewElement.src = '';
                    };
                } else {
                    previewElement.style.display = 'none';
                    previewElement.src = '';
                }
            });
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
    setupImagePreview(addMusicCoverUrl, addCoverPreview);
    setupImagePreview(editMusicCoverUrl, editCoverPreview);


    // --- 動態添加樂譜輸入行的函數 ---
    window.addScoreInputRow = function(modalPrefix) {
        const container = document.getElementById(`${modalPrefix}-scores-container`);
        if (!container) {
            console.error(`找不到樂譜容器： #${modalPrefix}-scores-container`);
            return;
        }
        const scoreIndex = container.querySelectorAll('.score-input-row').length;
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
        albumListBody.innerHTML = ''; 

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
            // 假設 music.artists 是一個像 [{id: 1, name: '歌手A'}, {id: 2, name: '歌手B'}] 的陣列
            const artistsDisplay = music.artists && music.artists.length > 0 
                ? music.artists.map(a => a.name).join(', ') 
                : 'N/A';
            row.innerHTML = `
                <td>${music.id}</td>
                <td title="${music.title || ''}">${music.title || ''}</td>
                <td title="${artistsDisplay}">${artistsDisplay}</td>
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
        artistFilterButtonsContainer.innerHTML = ''; 

        // 從 music.artists 陣列中提取所有唯一的歌手名稱
        const artistsWithDuplicates = musicList.flatMap(music => 
            music.artists ? music.artists.map(artist => artist.name) : []
        );
        const artists = [...new Set(artistsWithDuplicates.filter(artist => artist))].sort();

        const showAllButton = document.createElement('button');
        showAllButton.textContent = '顯示全部';
        showAllButton.classList.add('action-btn'); 
        showAllButton.style.marginRight = '5px';
        showAllButton.style.marginBottom = '5px';
        showAllButton.onclick = () => {
            renderMusicList(allMusicData); 
            setActiveButton(showAllButton);
        };
        artistFilterButtonsContainer.appendChild(showAllButton);

        artists.forEach(artistName => { // Changed variable name for clarity
            const button = document.createElement('button');
            button.textContent = artistName;
            button.classList.add('action-btn');
            button.style.marginRight = '5px';
            button.style.marginBottom = '5px';
            button.onclick = () => {
                const filteredMusic = allMusicData.filter(music => 
                    music.artists && music.artists.some(a => a.name === artistName)
                );
                renderMusicList(filteredMusic);
                setActiveButton(button);
            };
            artistFilterButtonsContainer.appendChild(button);
        });
        
        if (allMusicData.length > 0 && showAllButton) { 
             setActiveButton(showAllButton);
        }
    }
    
    function setActiveButton(activeBtn) {
        const buttons = artistFilterButtonsContainer.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.style.backgroundColor = ''; 
            btn.style.color = ''; // Reset text color as well
            btn.style.fontWeight = 'normal';
        });
        activeBtn.style.backgroundColor = '#007bff'; 
        activeBtn.style.color = 'white';
        activeBtn.style.fontWeight = 'bold';
    }


    // --- 獲取並顯示所有音樂 ---
    async function fetchAndDisplayMusic(filterArtistName = null) { // Parameter renamed for clarity
        if (!albumListBody || !albumListContainer || !albumTable || !loadingMessage) {
            console.error("音樂列表的 DOM 元素不完整。");
            return;
        }
        try {
            loadingMessage.style.display = 'block';
            loadingMessage.textContent = '正在加載音樂...';
            albumTable.style.display = 'none';
            albumListBody.innerHTML = '';

            if (allMusicData.length === 0) {
                const response = await fetch('/api/music');
                if (!response.ok) throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
                allMusicData = await response.json();
                renderArtistButtons(allMusicData); 
            }
            
            loadingMessage.style.display = 'none';

            let musicToDisplay = allMusicData;
            if (filterArtistName) { // Use renamed parameter
                musicToDisplay = allMusicData.filter(music => 
                    music.artists && music.artists.some(a => a.name === filterArtistName)
                );
            }
            
            renderMusicList(musicToDisplay);

        } catch (error) {
            console.error("獲取管理音樂列表失敗:", error);
            if(loadingMessage) loadingMessage.textContent = '無法載入音樂列表。';
            if(albumTable) albumTable.style.display = 'none';
            allMusicData = []; 
        }
    }


    // --- 開啟並填充編輯音樂 Modal ---
    async function openEditMusicModal(id) {
        const requiredEditElements = [editModal, editForm, editMusicId, editMusicTitle, editMusicArtist, editMusicReleaseDate, editMusicDescription, editMusicCoverUrl, editCoverPreview, editMusicPlatformUrl, editMusicYoutubeId, editScoresContainer, editFormError];
        if (requiredEditElements.some(el => !el)) {
            console.error("編輯 Modal 的必要元素缺失。", {editModal, editForm, editMusicId, editMusicTitle, editMusicArtist, editMusicReleaseDate, editMusicDescription, editMusicCoverUrl, editCoverPreview, editMusicPlatformUrl, editMusicYoutubeId, editScoresContainer, editFormError});
            alert("無法開啟編輯視窗，頁面元件錯誤。請檢查控制台。");
            return;
        }
        editFormError.textContent = '';
        editForm.reset();
        editCoverPreview.src = '';
        editCoverPreview.style.display = 'none';
        editScoresContainer.innerHTML = ''; 

        try {
            const response = await fetch(`/api/music/${id}`); 
            if (!response.ok) {
                if (response.status === 404) throw new Error('找不到該音樂項目。');
                throw new Error(`無法獲取音樂資料 (HTTP ${response.status})`);
            }
            const music = await response.json();

            editMusicId.value = music.id;
            editMusicTitle.value = music.title || '';
            // 將 artists 陣列轉換為逗號分隔的字串填入 textarea
            editMusicArtist.value = music.artists && music.artists.length > 0 
                ? music.artists.map(a => a.name).join(', ') 
                : '';
            editMusicReleaseDate.value = music.release_date ? music.release_date.split('T')[0] : '';
            editMusicDescription.value = music.description || '';
            editMusicCoverUrl.value = music.cover_art_url || '';
            editMusicPlatformUrl.value = music.platform_url || '';
            editMusicYoutubeId.value = music.youtube_video_id || '';

             setupImagePreview(editMusicCoverUrl, editCoverPreview); 
             const event = new Event('input', { bubbles: true }); 
             editMusicCoverUrl.dispatchEvent(event); 


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
                    allMusicData = []; // 清空緩存以便重新獲取
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
             console.error("新增 Modal 的必要元素缺失。", {addModal, addForm, addMusicTitle, addMusicArtist, addMusicReleaseDate, addMusicDescription, addMusicCoverUrl, addMusicPlatformUrl, addMusicYoutubeId, addScoresContainer, addFormError, addCoverPreview});
             alert("新增視窗元件錯誤，無法開啟。請檢查控制台。");
             return;
        }
        addFormError.textContent = '';
        addForm.reset();
        addScoresContainer.innerHTML = ''; 
        addCoverPreview.src = ''; 
        addCoverPreview.style.display = 'none'; 
        addModal.style.display = 'flex';
    }

    // --- 點擊 Modal 外部關閉 (已停用，僅能透過關閉按鈕關閉) ---
    /*
    window.onclick = function(event) {
        if (event.target == editModal) closeEditMusicModal();
        else if (event.target == addModal) closeAddMusicModal();
    }
    */

    // --- 表單提交處理函數 (共用邏輯) ---
    async function handleFormSubmit(event, isEditMode) {
        event.preventDefault();
        const form = event.target;
        const modalPrefix = isEditMode ? 'edit' : 'add';
        const formErrorElement = document.getElementById(`${modalPrefix}-music-form-error`);
        formErrorElement.textContent = ''; 

        const musicId = isEditMode ? document.getElementById('edit-music-id').value : null;

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

            if (typeValue || urlValue) {
                 if (!typeValue) {
                     formErrorElement.textContent = '樂譜類型不能為空 (如果已填寫 URL)。';
                     typeInput.focus();
                     scoreValidationError = true;
                     return;
                 }
                 if (!urlValue || !(urlValue.startsWith('/') || urlValue.startsWith('http://') || urlValue.startsWith('https://'))) {
                     formErrorElement.textContent = '請輸入有效的 PDF 網址 (需以 / 或 http(s):// 開頭)。';
                     urlInput.focus();
                     scoreValidationError = true;
                     return;
                 }
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

        const artistNamesString = form.elements['artist'].value.trim();
        const artist_names = artistNamesString 
            ? artistNamesString.split(/[,，\n]/)
                               .map(name => name.trim())
                               .filter(name => name) 
            : [];

        const formData = {
             title: form.elements['title'].value.trim(),
             artist_names: artist_names, 
             release_date: form.elements['release_date'].value || null,
             description: form.elements['description'].value.trim(),
             cover_art_url: form.elements['cover_art_url'].value.trim() || null,
             platform_url: form.elements['platform_url'].value.trim() || null,
             youtube_video_id: form.elements['youtube_video_id'] ? form.elements['youtube_video_id'].value.trim() || null : null,
             scores: scores
        };

        if (!formData.title) { formErrorElement.textContent = '專輯標題不能為空。'; return; }
        if (artistNamesString && formData.artist_names.length === 0 && artistNamesString.length > 0) { 
             formErrorElement.textContent = '請輸入有效的歌手名稱 (用逗號或換行分隔)。'; return;
        }
        if (formData.artist_names.length === 0) { 
            formErrorElement.textContent = '歌手名稱不能為空。'; return;
        }

        const isValidUrlOrPath = (url) => !url || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');
        if (formData.cover_art_url && !isValidUrlOrPath(formData.cover_art_url)) { formErrorElement.textContent = '封面圖片路徑格式不正確 (應為 / 開頭或 http(s):// 開頭)。'; return; }
        if (formData.platform_url && !(formData.platform_url.startsWith('http://') || formData.platform_url.startsWith('https://'))) { formErrorElement.textContent = '平台連結格式不正確 (需以 http(s):// 開頭)。'; return; }
         if (formData.youtube_video_id && !/^[a-zA-Z0-9_-]{11}$/.test(formData.youtube_video_id)) {
             formErrorElement.textContent = 'YouTube 影片 ID 格式不正確 (應為 11 位英數字元、底線或減號)。'; return;
         }


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
            allMusicData = []; // 清空緩存以便重新獲取更新後的列表
            await fetchAndDisplayMusic(); 

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
    fetchAndDisplayMusic(); 

}); // End of DOMContentLoaded