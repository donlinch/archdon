// card-game-admin.js - 翻牌對對碰管理腳本

document.addEventListener('DOMContentLoaded', () => {
    // 綁定分頁切換
    setupTabNavigation();
    
    // 載入模板列表
    loadCardTemplates();
    
    // 載入排行榜
    loadLeaderboard();
    
    // 綁定模板表單事件
    bindTemplateFormEvents();
});

// 設置分頁導航
function setupTabNavigation() {
    // 主標籤切換
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有標籤的活動狀態
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            
            // 設置當前標籤為活動狀態
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // 子標籤切換
    document.querySelectorAll('.subtab-btn').forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有子標籤的活動狀態
            document.querySelectorAll('.subtab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.subtab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            
            // 設置當前子標籤為活動狀態
            button.classList.add('active');
            const subtabId = button.getAttribute('data-subtab');
            document.getElementById(subtabId).classList.add('active');
        });
    });
}


// card-game-admin.js 中需要修改的部分，以支持翻牌對對碰管理

// 載入模板列表 - 使用翻牌對對碰的API
function loadCardTemplates() {
    const tableBody = document.querySelector('#card-template-list-table tbody');
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">正在載入模板列表...</td></tr>';
    
    fetch('/api/flip-card/templates')
        .then(response => {
            if (!response.ok) throw new Error('無法獲取模板列表');
            return response.json();
        })
        .then(data => {
            tableBody.innerHTML = '';
            
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">目前沒有任何模板</td></tr>';
                return;
            }
            
            data.forEach(template => {
                // 解析內容數據
                let contentData;
                try {
                    contentData = typeof template.content_data === 'string' ? 
                        JSON.parse(template.content_data) : template.content_data;
                } catch (e) {
                    contentData = { level1: [], level2: [], level3: [] };
                }
                
                // 格式化日期
                const createdDate = new Date(template.created_at).toLocaleString();
                
                // 建立卡片預覽
                let previewHtml = '<div class="card-preview">';
                // 每個關卡顯示最多4張圖片
                [
                    { level: 'level1', label: '關卡1' },
                    { level: 'level2', label: '關卡2' },
                    { level: 'level3', label: '關卡3' }
                ].forEach(({ level, label }) => {
                    if (contentData[level] && contentData[level].length > 0) {
                        // 只顯示前2張圖片
                        const previewImages = contentData[level].slice(0, 2);
                        previewImages.forEach(image => {
                            previewHtml += `
                                <div class="card-preview-item" style="background-image: url('${image}')">
                                    <div class="card-preview-label">${label}</div>
                                </div>
                            `;
                        });
                        
                        // 如有更多圖片，顯示計數
                        if (contentData[level].length > 2) {
                            previewHtml += `
                                <div class="card-preview-item" style="background-color: #f0f0f0; display: flex; justify-content: center; align-items: center;">
                                    <div style="text-align: center;">+${contentData[level].length - 2} 張</div>
                                </div>
                            `;
                        }
                    }
                });
                previewHtml += '</div>';
                
                // 建立表格行
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${template.id}</td>
                    <td>${template.template_name}</td>
                    <td>${previewHtml}</td>
                    <td>${createdDate}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editTemplate(${template.id})">編輯</button>
                        <button class="action-btn delete-btn" onclick="deleteTemplate(${template.id})">刪除</button>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('獲取模板列表失敗:', error);
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">載入模板列表時出錯: ${error.message}</td></tr>`;
        });
}

// 編輯模板 - 使用翻牌對對碰的API
function editTemplate(id) {
    // 清空表單
    document.getElementById('edit-template-form').reset();
    document.getElementById('edit-template-form-error').textContent = '';
    
    // 清空圖片列表
    const imageLists = [
        document.getElementById('edit-level-1-images'),
        document.getElementById('edit-level-2-images'),
        document.getElementById('edit-level-3-images')
    ];
    
    imageLists.forEach(list => {
        // 只保留添加按鈕
        const addButton = list.querySelector('.add-card-image');
        list.innerHTML = '';
        if (addButton) {
            list.appendChild(addButton);
        }
    });
    
    // 獲取模板數據
    fetch(`/api/flip-card/templates/${id}`)
        .then(response => {
            if (!response.ok) throw new Error('無法獲取模板詳情');
            return response.json();
        })
        .then(template => {
            // 填充表單數據
            document.getElementById('edit-template-id').value = template.id;
            document.getElementById('edit-template-name').value = template.template_name;
            
            // 解析內容數據
            let contentData;
            try {
                contentData = typeof template.content_data === 'string' ? 
                    JSON.parse(template.content_data) : template.content_data;
            } catch (e) {
                contentData = { level1: [], level2: [], level3: [] };
            }
            
            // 填充各關卡圖片
            ['level1', 'level2', 'level3'].forEach(level => {
                if (contentData[level] && Array.isArray(contentData[level])) {
                    const levelImages = contentData[level];
                    const levelNum = level.replace('level', '');
                    const listId = `edit-level-${levelNum}-images`;
                    const imagesList = document.getElementById(listId);
                    const addButton = imagesList.querySelector('.add-card-image');
                    
                    // 為每張圖片創建元素
                    levelImages.forEach((imagePath, index) => {
                        const imageItem = document.createElement('div');
                        imageItem.className = 'card-image-item';
                        imageItem.setAttribute('data-image', imagePath);
                        
                        const img = document.createElement('img');
                        img.src = imagePath;
                        img.alt = '卡片圖片';
                        
                        const removeBtn = document.createElement('button');
                        removeBtn.className = 'remove-btn';
                        removeBtn.innerHTML = '×';
                        removeBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            imageItem.remove();
                        });
                        
                        imageItem.appendChild(img);
                        imageItem.appendChild(removeBtn);
                        
                        // 點擊圖片項可以重新選擇
                        imageItem.addEventListener('click', function() {
                            const newIndex = Array.from(imagesList.querySelectorAll('.card-image-item')).indexOf(this);
                            showImageSelector(levelNum, newIndex, true);
                        });
                        
                        // 插入到添加按鈕之前
                        imagesList.insertBefore(imageItem, addButton);
                    });
                }
            });
            
            // 顯示模態框
            document.getElementById('edit-template-modal').style.display = 'flex';
        })
        .catch(error => {
            console.error('獲取模板詳情失敗:', error);
            alert(`載入模板資料時出錯: ${error.message}`);
        });
}

// 刪除模板 - 使用翻牌對對碰的API
function deleteTemplate(id) {
    if (confirm(`確定要刪除ID為 ${id} 的翻牌模板嗎？此操作無法復原！`)) {
        fetch(`/api/flip-card/templates/${id}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) throw new Error('刪除模板失敗');
            loadCardTemplates();
            alert('模板已成功刪除！');
        })
        .catch(error => {
            console.error('刪除模板失敗:', error);
            alert(`刪除模板時出錯: ${error.message}`);
        });
    }
}

// 儲存模板 - 使用翻牌對對碰的API
function saveTemplate(isEdit) {
    const formId = isEdit ? 'edit-template-form' : 'add-template-form';
    const errorId = isEdit ? 'edit-template-form-error' : 'add-template-form-error';
    const form = document.getElementById(formId);
    const errorElement = document.getElementById(errorId);
    
    // 獲取模板名稱
    const templateName = isEdit ? 
        document.getElementById('edit-template-name').value.trim() : 
        document.getElementById('template-name').value.trim();
    
    if (!templateName) {
        errorElement.textContent = '請輸入模板名稱';
        return;
    }
    
    // 獲取各關卡圖片
    const prefix = isEdit ? 'edit-' : '';
    const level1Images = getImagesFromLevel(`${prefix}level-1-images`);
    const level2Images = getImagesFromLevel(`${prefix}level-2-images`);
    const level3Images = getImagesFromLevel(`${prefix}level-3-images`);
    
    // 檢查圖片數量
    if (level1Images.length < 2) {
        errorElement.textContent = '第一關至少需要2張不同圖片';
        return;
    }
    if (level2Images.length < 4) {
        errorElement.textContent = '第二關至少需要4張不同圖片';
        return;
    }
    if (level3Images.length < 8) {
        errorElement.textContent = '第三關至少需要8張不同圖片';
        return;
    }
    
    // 準備提交的數據
    const contentData = {
        level1: level1Images,
        level2: level2Images,
        level3: level3Images
    };
    
    // 構建請求數據
    const requestData = {
        template_name: templateName,
        content_data: contentData
    };
    
    // 判斷是新增還是編輯
    if (isEdit) {
        const templateId = document.getElementById('edit-template-id').value;
        // 更新模板
        fetch(`/api/flip-card/templates/${templateId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) throw new Error('更新模板失敗');
            return response.json();
        })
        .then(data => {
            closeEditTemplateModal();
            loadCardTemplates();
            alert('模板更新成功！');
        })
        .catch(error => {
            errorElement.textContent = error.message;
        });
    } else {
        // 新增模板
        fetch('/api/flip-card/templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) throw new Error('新增模板失敗');
            return response.json();
        })
        .then(data => {
            closeAddTemplateModal();
            loadCardTemplates();
            alert('模板新增成功！');
        })
        .catch(error => {
            errorElement.textContent = error.message;
        });
    }
}

// 獲取關卡圖片
function getImagesFromLevel(levelId) {
    const imagesList = document.getElementById(levelId);
    const imageItems = imagesList.querySelectorAll('.card-image-item');
    return Array.from(imageItems).map(item => item.getAttribute('data-image'));
}

// 載入排行榜 - 使用翻牌對對碰的API
function loadLeaderboard() {
    const tableBody = document.querySelector('#leaderboard-table tbody');
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">正在載入排行榜...</td></tr>';
    
    fetch('/api/flip-card/leaderboard')
        .then(response => {
            if (!response.ok) throw new Error('無法獲取排行榜資料');
            return response.json();
        })
        .then(data => {
            tableBody.innerHTML = '';
            
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">目前沒有任何排行榜紀錄</td></tr>';
                return;
            }
            
            // 排序並顯示前20筆資料
            data.slice(0, 20).forEach((entry, index) => {
                const row = document.createElement('tr');
                
                // 格式化日期和時間
                const playedDate = new Date(entry.created_at).toLocaleString();
                const completionTime = entry.completion_time ? `${entry.completion_time.toFixed(2)}秒` : '-';
                
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${entry.player_name}</td>
                    <td>${entry.total_moves}</td>
                    <td>${completionTime}</td>
                    <td>${entry.template_name || '-'}</td>
                    <td>${playedDate}</td>
                `;
                
                tableBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('獲取排行榜失敗:', error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">載入排行榜時出錯: ${error.message}</td></tr>`;
        });
}

// 顯示圖片選擇器
function showImageSelector(levelNum, index, isEdit) {
    // 保存當前操作上下文
    window.currentImageContext = {
        levelNum: levelNum,
        index: index,
        isEdit: isEdit
    };
    
    // 載入圖片選擇器內容
    loadImageSelectorContent();
    
    // 顯示圖片選擇器模態框
    document.getElementById('image-selector-modal').style.display = 'flex';
}

// 載入圖片選擇器內容
function loadImageSelectorContent() {
    const imageGrid = document.getElementById('image-grid');
    imageGrid.innerHTML = '<div style="text-align: center; padding: 20px;">載入圖片列表中...</div>';
    
    // 從服務器獲取圖片列表
    fetch('/api/admin/files?type=image')
        .then(response => {
            if (!response.ok) throw new Error('獲取圖片列表失敗');
            return response.json();
        })
        .then(data => {
            imageGrid.innerHTML = '';
            
            if (data.length === 0) {
                imageGrid.innerHTML = '<div style="text-align: center; padding: 20px;">沒有可用的圖片</div>';
                return;
            }
            
            // 顯示圖片列表
            data.forEach(file => {
                const imageItem = document.createElement('div');
                imageItem.className = 'image-selector-item';
                imageItem.style.cssText = 'width: 100px; height: 100px; overflow: hidden; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;';
                
                const img = document.createElement('img');
                img.src = file.file_path;
                img.alt = file.original_filename;
                img.style.cssText = 'width: 100%; height: 100%; object-fit: contain;';
                
                imageItem.appendChild(img);
                imageItem.addEventListener('click', () => selectImage(file.file_path));
                
                imageGrid.appendChild(imageItem);
            });
        })
        .catch(error => {
            console.error('載入圖片列表失敗:', error);
            imageGrid.innerHTML = `<div style="text-align: center; padding: 20px;">載入圖片列表時出錯: ${error.message}</div>`;
        });
}




// 文件上傳功能實現 (處理卡片圖片上傳問題)

/**
 * 上傳文件到服務器
 * @param {File} file - 要上傳的文件
 * @returns {Promise<Object>} - 返回上傳結果
 */
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/admin/files/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `上傳失敗: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('文件上傳錯誤:', error);
        throw error;
    }
}

/**
 * 添加上傳按鈕的點擊事件處理
 */
function setupUploadButtons() {
    // 獲取所有添加圖片按鈕
    const addButtons = document.querySelectorAll('.add-card-image');
    
    addButtons.forEach(button => {
        // 清空原有事件監聽
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // 添加新事件監聽 - 先顯示上傳選項
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // 從按鈕中獲取關卡信息
            const levelElement = this.closest('.template-level');
            const levelId = levelElement.id;
            const isEdit = levelId.startsWith('edit');
            const levelNum = isEdit ? 
                levelId.replace('edit-level-', '') : 
                levelId.replace('level-', '');
            
            const imagesList = this.parentNode;
            const currentIndex = imagesList.querySelectorAll('.card-image-item').length;
            
            // 創建並顯示上傳選項模態框
            showUploadOptionsModal(levelNum, currentIndex, isEdit);
        });
    });
}

/**
 * 顯示上傳選項模態框
 */
function showUploadOptionsModal(levelNum, index, isEdit) {
    // 保存上下文
    window.currentImageContext = {
        levelNum,
        index,
        isEdit
    };
    
    // 檢查是否已有上傳選項模態框
    let modalElement = document.getElementById('upload-options-modal');
    
    if (!modalElement) {
        // 創建模態框
        modalElement = document.createElement('div');
        modalElement.id = 'upload-options-modal';
        modalElement.className = 'modal';
        modalElement.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <span class="close-btn" onclick="closeUploadOptionsModal()">×</span>
                <h3>選擇圖片來源</h3>
                <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
                    <button id="upload-new-image-btn" class="action-btn" style="padding: 12px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        上傳新圖片
                    </button>
                    <button id="select-existing-image-btn" class="action-btn" style="padding: 12px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        選擇已有圖片
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modalElement);
        
        // 添加按鈕事件
        document.getElementById('upload-new-image-btn').addEventListener('click', function() {
            closeUploadOptionsModal();
            showUploadImageModal();
        });
        
        document.getElementById('select-existing-image-btn').addEventListener('click', function() {
            closeUploadOptionsModal();
            const { levelNum, index, isEdit } = window.currentImageContext;
            showImageSelector(levelNum, index, isEdit);
        });
    }
    
    // 顯示模態框
    modalElement.style.display = 'flex';
}

/**
 * 關閉上傳選項模態框
 */
function closeUploadOptionsModal() {
    const modalElement = document.getElementById('upload-options-modal');
    if (modalElement) {
        modalElement.style.display = 'none';
    }
}

/**
 * 顯示上傳圖片模態框
 */
function showUploadImageModal() {
    // 檢查是否已有上傳圖片模態框
    let modalElement = document.getElementById('upload-image-modal');
    
    if (!modalElement) {
        // 創建模態框
        modalElement = document.createElement('div');
        modalElement.id = 'upload-image-modal';
        modalElement.className = 'modal';
        modalElement.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <span class="close-btn" onclick="closeUploadImageModal()">×</span>
                <h3>上傳新圖片</h3>
                <form id="upload-image-form">
                    <div class="form-group">
                        <label for="image-file">選擇圖片:</label>
                        <input type="file" id="image-file" name="file" accept="image/*" required>
                    </div>
                    <div style="margin-top: 15px;">
                        <img id="image-preview" src="" alt="預覽" style="max-width: 100%; max-height: 200px; display: none; margin-top: 10px; border: 1px solid #ddd;">
                    </div>
                    <div class="form-actions" style="margin-top: 20px; text-align: right;">
                        <button type="submit" class="action-btn save-btn">上傳圖片</button>
                        <button type="button" class="action-btn cancel-btn" onclick="closeUploadImageModal()">取消</button>
                    </div>
                    <p id="upload-error" style="color: red; margin-top: 10px;"></p>
                </form>
            </div>
        `;
        document.body.appendChild(modalElement);
        
        // 文件選擇後預覽圖片
        document.getElementById('image-file').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('image-preview');
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
        
        // 表單提交處理
        document.getElementById('upload-image-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const fileInput = document.getElementById('image-file');
            const file = fileInput.files[0];
            const errorElement = document.getElementById('upload-error');
            
            if (!file) {
                errorElement.textContent = '請選擇要上傳的圖片';
                return;
            }
            
            // 檢查文件類型
            if (!file.type.startsWith('image/')) {
                errorElement.textContent = '請選擇有效的圖片文件';
                return;
            }
            
            // 顯示上傳中狀態
            const submitButton = this.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = '上傳中...';
            submitButton.disabled = true;
            errorElement.textContent = '';
            
            try {
                // 上傳文件
                const result = await uploadFile(file);
                
                // 上傳成功，關閉模態框
                closeUploadImageModal();
                
                // 使用上傳的圖片
                const { levelNum, index, isEdit } = window.currentImageContext;
                selectImage(result.file.file_path);
            } catch (error) {
                console.error('上傳圖片失敗:', error);
                errorElement.textContent = `上傳失敗: ${error.message}`;
                
                // 恢復按鈕狀態
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
    
    // 重置表單
    const form = document.getElementById('upload-image-form');
    if (form) {
        form.reset();
    }
    
    // 隱藏預覽圖
    const preview = document.getElementById('image-preview');
    if (preview) {
        preview.style.display = 'none';
        preview.src = '';
    }
    
    // 清空錯誤訊息
    const errorElement = document.getElementById('upload-error');
    if (errorElement) {
        errorElement.textContent = '';
    }
    
    // 顯示模態框
    modalElement.style.display = 'flex';
}

/**
 * 關閉上傳圖片模態框
 */
function closeUploadImageModal() {
    const modalElement = document.getElementById('upload-image-modal');
    if (modalElement) {
        modalElement.style.display = 'none';
    }
}

// 頁面加載完成後設置上傳按鈕
document.addEventListener('DOMContentLoaded', function() {
    setupUploadButtons();
    
    // 監聽模態框開啟事件，動態設置上傳按鈕
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'style' && 
                (mutation.target.id === 'add-template-modal' || mutation.target.id === 'edit-template-modal') &&
                mutation.target.style.display === 'flex') {
                // 模態框被打開，設置上傳按鈕
                setTimeout(setupUploadButtons, 100);
            }
        });
    });
    
    // 監聽添加和編輯模態框
    const addModal = document.getElementById('add-template-modal');
    const editModal = document.getElementById('edit-template-modal');
    
    if (addModal) {
        observer.observe(addModal, { attributes: true });
    }
    
    if (editModal) {
        observer.observe(editModal, { attributes: true });
    }
});








// 選擇圖片
function selectImage(imagePath) {
    const context = window.currentImageContext;
    if (!context) return;
    
    const { levelNum, index, isEdit } = context;
    const prefix = isEdit ? 'edit-' : '';
    const levelId = `${prefix}level-${levelNum}-images`;
    const imagesList = document.getElementById(levelId);
    
    // 檢查是否是更新現有圖片
    const imageItems = imagesList.querySelectorAll('.card-image-item');
    
    if (index < imageItems.length) {
        // 更新現有圖片
        const imageItem = imageItems[index];
        imageItem.setAttribute('data-image', imagePath);
        const img = imageItem.querySelector('img');
        if (img) {
            img.src = imagePath;
        }
    } else {
        // 添加新圖片
        const addButton = imagesList.querySelector('.add-card-image');
        
        const imageItem = document.createElement('div');
        imageItem.className = 'card-image-item';
        imageItem.setAttribute('data-image', imagePath);
        
        const img = document.createElement('img');
        img.src = imagePath;
        img.alt = '卡片圖片';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            imageItem.remove();
        });
        
        imageItem.appendChild(img);
        imageItem.appendChild(removeBtn);
        
        // 點擊圖片項可以重新選擇
        imageItem.addEventListener('click', function() {
            const newIndex = Array.from(imagesList.querySelectorAll('.card-image-item')).indexOf(this);
            showImageSelector(levelNum, newIndex, isEdit);
        });
        
        // 插入到添加按鈕之前
        imagesList.insertBefore(imageItem, addButton);
    }
    
    // 關閉圖片選擇器
    closeImageSelectorModal();
}

// 關閉圖片選擇器模態框
function closeImageSelectorModal() {
    document.getElementById('image-selector-modal').style.display = 'none';
    window.currentImageContext = null;
}

// 添加模板表單相關函數
function showAddTemplateForm() {
    // 清空表單
    document.getElementById('add-template-form').reset();
    document.getElementById('add-template-form-error').textContent = '';
    
    // 清空圖片列表
    ['level-1-images', 'level-2-images', 'level-3-images'].forEach(levelId => {
        const imagesList = document.getElementById(levelId);
        const addButton = imagesList.querySelector('.add-card-image');
        imagesList.innerHTML = '';
        if (addButton) {
            imagesList.appendChild(addButton);
        }
    });
    
    // 顯示模態框
    document.getElementById('add-template-modal').style.display = 'flex';
}

function closeAddTemplateModal() {
    document.getElementById('add-template-modal').style.display = 'none';
}

function closeEditTemplateModal() {
    document.getElementById('edit-template-modal').style.display = 'none';
}

// 添加選項卡切換功能
document.addEventListener('DOMContentLoaded', function() {
    // 主選項卡切換
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // 更新按鈕狀態
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // 更新面板狀態
            document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // 子選項卡切換
    const subtabButtons = document.querySelectorAll('.subtab-btn');
    subtabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const subtabId = this.getAttribute('data-subtab');
            
            // 更新按鈕狀態
            subtabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // 更新面板狀態
            document.querySelectorAll('.subtab-panel').forEach(panel => panel.classList.remove('active'));
            document.getElementById(subtabId).classList.add('active');
            
            // 根據子標籤載入相應內容
            if (subtabId === 'templates-subtab') {
                loadCardTemplates();
            } else if (subtabId === 'leaderboard-subtab') {
                loadLeaderboard();
            }
        });
    });
    
    // 初始化載入翻牌對對碰模板列表
    loadCardTemplates();
});


/**
 * 為管理介面添加上傳預設卡片的UI元素
 */
function addDefaultCardUploadInterface() {
    // 這個函數可以在管理介面中添加一個上傳預設卡片的按鈕和介面
    // 例如:
    const uploadSection = document.createElement('div');
    uploadSection.className = 'default-cards-upload-section';
    uploadSection.innerHTML = `
        <h3>上傳預設卡片</h3>
        <p>這些卡片將被用作遊戲的預設卡片，如果模板中沒有足夠的卡片。</p>
        <div class="default-cards-list">
            <div class="default-card">
                <label>預設卡片 1:</label>
                <input type="file" class="default-card-upload" data-name="default_card_1.jpg">
            </div>
            <!-- 其他預設卡片... -->
        </div>
        <button id="upload-all-default-cards">上傳所有預設卡片</button>
    `;
    
    // 添加到管理介面
    // document.querySelector('.admin-container').appendChild(uploadSection);
}




// 綁定模板表單事件
function bindTemplateFormEvents() {
    // 新增模板表單提交
    const addTemplateForm = document.getElementById('add-template-form');
    if (addTemplateForm) {
        addTemplateForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveTemplate(false);
        });
    }
    
    // 編輯模板表單提交
    const editTemplateForm = document.getElementById('edit-template-form');
    if (editTemplateForm) {
        editTemplateForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveTemplate(true);
        });
    }
    
    // 圖片搜索功能
    const imageSearch = document.getElementById('image-search');
    if (imageSearch) {
        imageSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const imageElements = document.querySelectorAll('#image-grid .image-item');
            
            imageElements.forEach(element => {
                const filename = element.getAttribute('data-filename').toLowerCase();
                if (filename.includes(searchTerm)) {
                    element.style.display = 'block';
                } else {
                    element.style.display = 'none';
                }
            });
        });
    }
}

// 顯示新增模板表單
function showAddTemplateForm() {
    // 重置表單
    document.getElementById('add-template-form').reset();
    document.getElementById('add-template-form-error').textContent = '';
    
    // 清空圖片選擇器
    const imageLists = [
        document.getElementById('level-1-images'),
        document.getElementById('level-2-images'),
        document.getElementById('level-3-images')
    ];
    
    imageLists.forEach(list => {
        // 移除所有現有圖片，保留添加按鈕
        const addButton = list.querySelector('.add-card-image');
        list.innerHTML = '';
        if (addButton) {
            list.appendChild(addButton);
        }
    });
    
    // 顯示模態框
    document.getElementById('add-template-modal').style.display = 'flex';
}

// 關閉新增模板表單
function closeAddTemplateModal() {
    document.getElementById('add-template-modal').style.display = 'none';
}

// 關閉編輯模板表單
function closeEditTemplateModal() {
    document.getElementById('edit-template-modal').style.display = 'none';
}
// 修復圖片選擇功能
function showImageSelector(level, index, isEdit = false) {
    console.log(`顯示圖片選擇器: 關卡=${level}, 索引=${index}, 是否編輯模式=${isEdit}`);
    
    // 保存當前操作的關卡和索引
    window.currentImageSelector = {
        level: level,
        index: index,
        isEdit: isEdit
    };
    
    // 清空搜尋
    document.getElementById('image-search').value = '';
    
    // 載入圖片列表
    loadAvailableImages();
    
    // 顯示模態框
    document.getElementById('image-selector-modal').style.display = 'flex';
}

// 關閉圖片選擇器
function closeImageSelectorModal() {
    document.getElementById('image-selector-modal').style.display = 'none';
}

// 載入可用圖片








// 修復載入可用圖片
function loadAvailableImages() {
    const imageGrid = document.getElementById('image-grid');
    imageGrid.innerHTML = '<div style="text-align: center; width: 100%; padding: 20px;">正在載入圖片...</div>';
    
    // 從後端API獲取上傳的圖片列表
    fetch('/api/admin/files?fileType=image')
        .then(response => {
            if (!response.ok) throw new Error('無法獲取圖片列表');
            return response.json();
        })
        .then(data => {
            imageGrid.innerHTML = '';
            
            // 檢查是否有圖片
            if (!data.files || data.files.length === 0) {
                imageGrid.innerHTML = '<div style="text-align: center; width: 100%; padding: 20px;">找不到圖片，請先上傳圖片。</div>';
                return;
            }
            
            // 顯示圖片
            data.files.forEach(file => {
                if (file.file_type === 'image') {
                    const imageItem = document.createElement('div');
                    imageItem.className = 'image-item';
                    imageItem.setAttribute('data-filename', file.original_filename);
                    imageItem.style.cursor = 'pointer';
                    imageItem.style.border = '1px solid #ddd';
                    imageItem.style.borderRadius = '5px';
                    imageItem.style.overflow = 'hidden';
                    imageItem.style.position = 'relative';
                    
                    const img = document.createElement('img');
                    img.src = file.file_path;
                    img.style.width = '100%';
                    img.style.height = '100px';
                    img.style.objectFit = 'cover';
                    
                    const label = document.createElement('div');
                    label.style.padding = '5px';
                    label.style.fontSize = '12px';
                    label.style.overflow = 'hidden';
                    label.style.textOverflow = 'ellipsis';
                    label.style.whiteSpace = 'nowrap';
                    label.style.backgroundColor = '#f5f5f5';
                    label.textContent = file.original_filename;
                    
                    imageItem.appendChild(img);
                    imageItem.appendChild(label);
                    
                    // 點擊選擇圖片
                    imageItem.addEventListener('click', () => {
                        console.log(`選擇圖片: ${file.file_path}`);
                        selectImage(file.file_path);
                    });
                    
                    imageGrid.appendChild(imageItem);
                }
            });
            
            // 添加搜尋功能
            document.getElementById('image-search').addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase().trim();
                const imageElements = document.querySelectorAll('#image-grid .image-item');
                
                imageElements.forEach(element => {
                    const filename = element.getAttribute('data-filename').toLowerCase();
                    if (filename.includes(searchTerm)) {
                        element.style.display = 'block';
                    } else {
                        element.style.display = 'none';
                    }
                });
            });
        })
        .catch(error => {
            console.error('載入圖片時發生錯誤:', error);
            imageGrid.innerHTML = `<div style="text-align: center; width: 100%; padding: 20px;">載入圖片時發生錯誤: ${error.message}</div>`;
        });
}

// 修復選擇圖片函數
function selectImage(imagePath) {
    console.log(`處理選擇的圖片: ${imagePath}`);
    
    // 如果找不到當前選擇器狀態，則退出
    if (!window.currentImageSelector) {
        console.error('無法找到當前圖片選擇器狀態');
        closeImageSelectorModal();
        return;
    }
    
    const { level, index, isEdit } = window.currentImageSelector;
    console.log(`當前選擇器: 關卡=${level}, 索引=${index}, 是否編輯模式=${isEdit}`);
    
    // 決定要操作的元素ID前綴
    const prefix = isEdit ? 'edit-' : '';
    const listId = `${prefix}level-${level}-images`;
    const imagesList = document.getElementById(listId);
    
    if (!imagesList) {
        console.error(`找不到圖片列表元素: ${listId}`);
        closeImageSelectorModal();
        return;
    }
    
    // 創建或更新圖片項
    let imageItem;
    const existingItems = imagesList.querySelectorAll('.card-image-item');
    
    if (index < existingItems.length) {
        // 更新現有項
        imageItem = existingItems[index];
        const img = imageItem.querySelector('img');
        if (img) {
            img.src = imagePath;
        }
        imageItem.setAttribute('data-image', imagePath);
        console.log(`更新了現有圖片項: 索引=${index}`);
    } else {
        // 創建新項
        imageItem = document.createElement('div');
        imageItem.className = 'card-image-item';
        imageItem.setAttribute('data-image', imagePath);
        
        const img = document.createElement('img');
        img.src = imagePath;
        img.alt = '卡片圖片';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            imageItem.remove();
        });
        
        imageItem.appendChild(img);
        imageItem.appendChild(removeBtn);
        
        // 點擊圖片項可以重新選擇
        imageItem.addEventListener('click', function() {
            const newIndex = Array.from(imagesList.querySelectorAll('.card-image-item')).indexOf(this);
            showImageSelector(level, newIndex, isEdit);
        });
        
        // 插入到添加按鈕之前
        const addButton = imagesList.querySelector('.add-card-image');
        if (addButton) {
            imagesList.insertBefore(imageItem, addButton);
            console.log(`創建了新圖片項: 索引=${index}`);
        } else {
            imagesList.appendChild(imageItem);
            console.log(`添加按鈕不存在，附加到列表末尾`);
        }
    }
    
    // 關閉選擇器
    closeImageSelectorModal();
}

// 關閉圖片選擇器
function closeImageSelectorModal() {
    document.getElementById('image-selector-modal').style.display = 'none';
}








// 儲存模板
function saveTemplate(isEdit) {
    const formId = isEdit ? 'edit-template-form' : 'add-template-form';
    const errorId = isEdit ? 'edit-template-form-error' : 'add-template-form-error';
    const form = document.getElementById(formId);
    const errorElement = document.getElementById(errorId);
    
    // 獲取模板名稱
    const templateName = isEdit ? 
        document.getElementById('edit-template-name').value.trim() : 
        document.getElementById('template-name').value.trim();
    
    if (!templateName) {
        errorElement.textContent = '請輸入模板名稱';
        return;
    }
    
    // 獲取各關卡圖片
    const prefix = isEdit ? 'edit-' : '';
    const level1Images = getImagesFromLevel(`${prefix}level-1-images`);
    const level2Images = getImagesFromLevel(`${prefix}level-2-images`);
    const level3Images = getImagesFromLevel(`${prefix}level-3-images`);
    
    // 檢查圖片數量
    if (level1Images.length < 2) {
        errorElement.textContent = '第一關至少需要2張不同圖片';
        return;
    }
    if (level2Images.length < 4) {
        errorElement.textContent = '第二關至少需要4張不同圖片';
        return;
    }
    if (level3Images.length < 8) {
        errorElement.textContent = '第三關至少需要8張不同圖片';
        return;
    }
    
    // 準備提交的數據
    const contentData = {
        level1: level1Images,
        level2: level2Images,
        level3: level3Images
    };
    
    // 構建請求數據
    const requestData = {
        template_name: templateName,
        content_data: contentData
    };
    
    // 判斷是新增還是編輯
    if (isEdit) {
        const templateId = document.getElementById('edit-template-id').value;
        // 更新模板
        fetch(`/api/card-game/templates/${templateId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) throw new Error('更新模板失敗');
            return response.json();
        })
        .then(data => {
            closeEditTemplateModal();
            loadCardTemplates();
            alert('模板更新成功！');
        })
        .catch(error => {
            errorElement.textContent = error.message;
        });
    } else {
        // 新增模板
        fetch('/api/card-game/templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) throw new Error('新增模板失敗');
            return response.json();
        })
        .then(data => {
            closeAddTemplateModal();
            loadCardTemplates();
            alert('模板新增成功！');
        })
        .catch(error => {
            errorElement.textContent = error.message;
        });
    }
}

// 獲取關卡中的圖片
function getImagesFromLevel(levelId) {
    const imageItems = document.querySelectorAll(`#${levelId} .card-image-item`);
    return Array.from(imageItems).map(item => item.getAttribute('data-image'));
}

// 載入模板列表
function loadCardTemplates() {
    const tableBody = document.querySelector('#card-template-list-table tbody');
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">正在載入模板列表...</td></tr>';
    
    fetch('/api/card-game/templates')
        .then(response => {
            if (!response.ok) throw new Error('無法獲取模板列表');
            return response.json();
        })
        .then(data => {
            tableBody.innerHTML = '';
            
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">目前沒有任何模板</td></tr>';
                return;
            }
            
            data.forEach(template => {
                // 解析內容數據
                let contentData;
                try {
                    contentData = typeof template.content_data === 'string' ? 
                        JSON.parse(template.content_data) : template.content_data;
                } catch (e) {
                    contentData = { level1: [], level2: [], level3: [] };
                }
                
                // 格式化日期
                const createdDate = new Date(template.created_at).toLocaleString();
                
                // 建立卡片預覽
                let previewHtml = '<div class="card-preview">';
                // 每個關卡顯示最多4張圖片
                [
                    { level: 'level1', label: '關卡1' },
                    { level: 'level2', label: '關卡2' },
                    { level: 'level3', label: '關卡3' }
                ].forEach(({ level, label }) => {
                    if (contentData[level] && contentData[level].length > 0) {
                        // 只顯示前2張圖片
                        const previewImages = contentData[level].slice(0, 2);
                        previewImages.forEach(image => {
                            previewHtml += `
                                <div class="card-preview-item" style="background-image: url('${image}')">
                                    <div class="card-preview-label">${label}</div>
                                </div>
                            `;
                        });
                        
                        // 如有更多圖片，顯示計數
                        if (contentData[level].length > 2) {
                            previewHtml += `
                                <div class="card-preview-item" style="background-color: #f0f0f0; display: flex; justify-content: center; align-items: center;">
                                    <div style="text-align: center;">+${contentData[level].length - 2} 張</div>
                                </div>
                            `;
                        }
                    }
                });
                previewHtml += '</div>';
                
                // 建立表格行
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${template.id}</td>
                    <td>${template.template_name}</td>
                    <td>${previewHtml}</td>
                    <td>${createdDate}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editTemplate(${template.id})">編輯</button>
                        <button class="action-btn delete-btn" onclick="deleteTemplate(${template.id})">刪除</button>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('獲取模板列表失敗:', error);
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">載入模板列表時出錯: ${error.message}</td></tr>`;
        });
}

// 編輯模板
function editTemplate(id) {
    // 清空表單
    document.getElementById('edit-template-form').reset();
    document.getElementById('edit-template-form-error').textContent = '';
    
    // 清空圖片列表
    const imageLists = [
        document.getElementById('edit-level-1-images'),
        document.getElementById('edit-level-2-images'),
        document.getElementById('edit-level-3-images')
    ];
    
    imageLists.forEach(list => {
        // 只保留添加按鈕
        const addButton = list.querySelector('.add-card-image');
        list.innerHTML = '';
        if (addButton) {
            list.appendChild(addButton);
        }
    });
    
    // 獲取模板數據
    fetch(`/api/card-game/templates/${id}`)
        .then(response => {
            if (!response.ok) throw new Error('無法獲取模板詳情');
            return response.json();
        })
        .then(template => {
            // 填充表單數據
            document.getElementById('edit-template-id').value = template.id;
            document.getElementById('edit-template-name').value = template.template_name;
            
            // 解析內容數據
            let contentData;
            try {
                contentData = typeof template.content_data === 'string' ? 
                    JSON.parse(template.content_data) : template.content_data;
            } catch (e) {
                contentData = { level1: [], level2: [], level3: [] };
            }
            
            // 填充各關卡圖片
            ['level1', 'level2', 'level3'].forEach(level => {
                if (contentData[level] && Array.isArray(contentData[level])) {
                    const levelImages = contentData[level];
                    const levelNum = level.replace('level', '');
                    const listId = `edit-level-${levelNum}-images`;
                    const imagesList = document.getElementById(listId);
                    const addButton = imagesList.querySelector('.add-card-image');
                    
                    // 為每張圖片創建元素
                    levelImages.forEach((imagePath, index) => {
                        const imageItem = document.createElement('div');
                        imageItem.className = 'card-image-item';
                        imageItem.setAttribute('data-image', imagePath);
                        
                        const img = document.createElement('img');
                        img.src = imagePath;
                        img.alt = '卡片圖片';
                        
                        const removeBtn = document.createElement('button');
                        removeBtn.className = 'remove-btn';
                        removeBtn.innerHTML = '×';
                        removeBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            imageItem.remove();
                        });
                        
                        imageItem.appendChild(img);
                        imageItem.appendChild(removeBtn);
                        
                        // 點擊圖片項可以重新選擇
                        imageItem.addEventListener('click', function() {
                            const newIndex = Array.from(imagesList.querySelectorAll('.card-image-item')).indexOf(this);
                            showImageSelector(levelNum, newIndex, true);
                        });
                        
                        // 插入到添加按鈕之前
                        imagesList.insertBefore(imageItem, addButton);
                    });
                }
            });
            
            // 顯示模態框
            document.getElementById('edit-template-modal').style.display = 'flex';
        })
        .catch(error => {
            console.error('獲取模板詳情失敗:', error);
            alert(`載入模板資料時出錯: ${error.message}`);
        });
}

// 刪除模板
function deleteTemplate(id) {
    if (confirm(`確定要刪除ID為 ${id} 的翻牌模板嗎？此操作無法復原！`)) {
        fetch(`/api/card-game/templates/${id}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) throw new Error('刪除模板失敗');
            loadCardTemplates();
            alert('模板已成功刪除！');
        })
        .catch(error => {
            console.error('刪除模板失敗:', error);
            alert(`刪除模板時出錯: ${error.message}`);
        });
    }
}

// 載入排行榜
function loadLeaderboard() {
    const tableBody = document.querySelector('#leaderboard-table tbody');
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">正在載入排行榜...</td></tr>';
    
    // 假設API路徑為 /api/card-game/leaderboard
    fetch('/api/card-game/leaderboard')
        .then(response => {
            if (!response.ok) throw new Error('無法獲取排行榜資料');
            return response.json();
        })
        .then(data => {
            tableBody.innerHTML = '';
            
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">目前沒有任何排行榜紀錄</td></tr>';
                return;
            }
            
            // 排序並顯示前20筆資料
            data.slice(0, 20).forEach((entry, index) => {
                const row = document.createElement('tr');
                
                // 格式化日期
                const playedDate = new Date(entry.created_at).toLocaleString();
                
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${entry.player_name}</td>
                    <td>${entry.total_moves}</td>
                    <td>${entry.completion_time || '-'}</td>
                    <td>${entry.template_name || '-'}</td>
                    <td>${playedDate}</td>
                `;
                
                tableBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('獲取排行榜失敗:', error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">載入排行榜時出錯: ${error.message}</td></tr>`;
        });
}

// 點擊外部關閉模態窗
window.onclick = function(event) {
    const modals = [
        document.getElementById('add-template-modal'),
        document.getElementById('edit-template-modal'),
        document.getElementById('image-selector-modal')
    ];
    
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
};