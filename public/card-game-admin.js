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

// 顯示圖片選擇器
function showImageSelector(level, index, isEdit = false) {
    // 保存當前操作的關卡和索引
    window.currentImageSelector = {
        level: level,
        index: index,
        isEdit: isEdit
    };
    
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
                        selectImage(file.file_path);
                    });
                    
                    imageGrid.appendChild(imageItem);
                }
            });
        })
        .catch(error => {
            console.error('載入圖片時發生錯誤:', error);
            imageGrid.innerHTML = `<div style="text-align: center; width: 100%; padding: 20px;">載入圖片時發生錯誤: ${error.message}</div>`;
        });
}

// 選擇圖片
function selectImage(imagePath) {
    const { level, index, isEdit } = window.currentImageSelector;
    
    // 決定要操作的元素ID前綴
    const prefix = isEdit ? 'edit-' : '';
    const listId = `${prefix}level-${level}-images`;
    const imagesList = document.getElementById(listId);
    
    // 創建或更新圖片項
    let imageItem;
    const existingItems = imagesList.querySelectorAll('.card-image-item');
    
    if (index < existingItems.length) {
        // 更新現有項
        imageItem = existingItems[index];
        const img = imageItem.querySelector('img');
        img.src = imagePath;
        imageItem.setAttribute('data-image', imagePath);
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
        imagesList.insertBefore(imageItem, addButton);
    }
    
    // 關閉選擇器
    closeImageSelectorModal();
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