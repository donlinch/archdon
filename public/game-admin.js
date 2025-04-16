// games-admin.js - 遊戲管理後台完整 JavaScript 代碼（API已實現）

document.addEventListener('DOMContentLoaded', () => {
    // 初始化頁面 - 加載遊戲列表
    fetchAndDisplayGames();

    // 預覽圖片功能
    document.getElementById('add-game-image-url').addEventListener('input', function() {
        previewImage('add-image-preview', this.value);
    });

    document.getElementById('edit-game-image-url').addEventListener('input', function() {
        previewImage('edit-image-preview', this.value);
    });

    // 新增遊戲表單提交
    document.getElementById('add-game-form').addEventListener('submit', function(e) {
        e.preventDefault();
        // 表單驗證和提交邏輯
        const formData = {
            name: document.getElementById('add-game-name').value.trim(),
            description: document.getElementById('add-game-description').value.trim(),
            play_url: document.getElementById('add-game-play-url').value.trim(),
            image_url: document.getElementById('add-game-image-url').value.trim(),
            sort_order: parseInt(document.getElementById('add-game-sort-order').value) || 0,
            is_active: document.getElementById('add-game-is-active').value === '1'
        };

        // 驗證表單
        if (!formData.name) {
            document.getElementById('add-form-error').textContent = '遊戲名稱不能為空';
            return;
        }
        if (!formData.play_url) {
            document.getElementById('add-form-error').textContent = '遊戲連結不能為空';
            return;
        }

        // 實際API調用
        fetch('/api/admin/games', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) throw new Error('新增遊戲失敗');
            return response.json();
        })
        .then(data => {
            closeAddModal();
            fetchAndDisplayGames();
        })
        .catch(error => {
            document.getElementById('add-form-error').textContent = error.message;
        });
    });

    // 編輯遊戲表單提交
    document.getElementById('edit-game-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const gameId = document.getElementById('edit-game-id').value;
        const formData = {
            name: document.getElementById('edit-game-name').value.trim(),
            description: document.getElementById('edit-game-description').value.trim(),
            play_url: document.getElementById('edit-game-play-url').value.trim(),
            image_url: document.getElementById('edit-game-image-url').value.trim(),
            sort_order: parseInt(document.getElementById('edit-game-sort-order').value) || 0,
            is_active: document.getElementById('edit-game-is-active').value === '1'
        };

        // 驗證表單
        if (!formData.name) {
            document.getElementById('edit-form-error').textContent = '遊戲名稱不能為空';
            return;
        }
        if (!formData.play_url) {
            document.getElementById('edit-form-error').textContent = '遊戲連結不能為空';
            return;
        }

        // 實際API調用
        fetch(`/api/admin/games/${gameId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) throw new Error('更新遊戲失敗');
            return response.json();
        })
        .then(data => {
            closeModal();
            fetchAndDisplayGames();
        })
        .catch(error => {
            document.getElementById('edit-form-error').textContent = error.message;
        });
    });
});

// 顯示新增表單
function showAddForm() {
    document.getElementById('add-form-error').textContent = '';
    document.getElementById('add-game-form').reset();
    document.getElementById('add-image-preview').style.display = 'none';
    document.getElementById('add-modal').style.display = 'flex';
}

// 關閉新增表單
function closeAddModal() {
    document.getElementById('add-modal').style.display = 'none';
}

// 關閉編輯表單
function closeModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

// 編輯遊戲
function editGame(id) {
    document.getElementById('edit-form-error').textContent = '';
    document.getElementById('edit-game-form').reset();
    document.getElementById('edit-image-preview').style.display = 'none';
    
    // 實際API調用
    fetch(`/api/admin/games/${id}`)
    .then(response => {
        if (!response.ok) throw new Error('獲取遊戲詳情失敗');
        return response.json();
    })
    .then(game => {
        // 填充表單
        document.getElementById('edit-game-id').value = game.id;
        document.getElementById('edit-game-name').value = game.title;
        document.getElementById('edit-game-description').value = game.description || '';
        document.getElementById('edit-game-play-url').value = game.play_url;
        document.getElementById('edit-game-image-url').value = game.image_url || '';
        document.getElementById('edit-game-sort-order').value = game.sort_order || 0;
        document.getElementById('edit-game-is-active').value = game.is_active ? '1' : '0';
        document.getElementById('edit-game-play-count').textContent = game.play_count || 0;
        
        // 預覽圖片
        previewImage('edit-image-preview', game.image_url);
        
        // 顯示編輯表單
        document.getElementById('edit-modal').style.display = 'flex';
    })
    .catch(error => {
        alert(`載入遊戲資料時出錯: ${error.message}`);
    });
}

// 刪除遊戲
function deleteGame(id) {
    if (confirm(`確定要刪除ID為 ${id} 的遊戲嗎？此操作無法復原！`)) {
        // 實際API調用
        fetch(`/api/admin/games/${id}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) throw new Error('刪除遊戲失敗');
            fetchAndDisplayGames();
        })
        .catch(error => {
            alert(`刪除遊戲時出錯: ${error.message}`);
        });
    }
}

// 預覽圖片
function previewImage(previewId, imageUrl) {
    const preview = document.getElementById(previewId);
    if (imageUrl) {
        preview.src = imageUrl;
        preview.style.display = 'block';
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }
}

// 獲取並顯示遊戲列表
function fetchAndDisplayGames() {
    // 顯示載入中提示
    const tableBody = document.querySelector('#games-list-table tbody');
    tableBody.innerHTML = '<tr><td colspan="6">正在載入遊戲列表...</td></tr>';
    
    // 獲取遊戲列表
    fetch('/api/admin/games')
    .then(response => {
        if (!response.ok) throw new Error('獲取遊戲列表失敗');
        return response.json();
    })
    .then(data => {
        // 更新遊戲列表
        tableBody.innerHTML = '';
        
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">目前沒有任何遊戲</td></tr>';
            return;
        }
        
        data.forEach(game => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${game.id}</td>
                <td>${game.title}</td>
                <td>${game.description || ''}</td>
                <td>${game.play_count || 0}</td>
                <td><img src="${game.image_url || '/images/placeholder.png'}" alt="${game.title}" style="width: 50px; height: auto; border: 1px solid #eee;"></td>
                <td>
                    <button class="action-btn edit-btn" onclick="editGame(${game.id})">編輯</button>
                    <button class="action-btn delete-btn" onclick="deleteGame(${game.id})">刪除</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // 更新統計數據
        updateStatistics(data);
    })
    .catch(error => {
        tableBody.innerHTML = `<tr><td colspan="6">載入遊戲列表時出錯: ${error.message}</td></tr>`;
        console.error('獲取遊戲列表失敗:', error);
    });
}

// 更新統計數據
function updateStatistics(data) {
    if (data) {
        // 從遊戲列表數據中計算統計數據
        const totalGames = data.length;
        const totalPlays = data.reduce((sum, game) => sum + (game.play_count || 0), 0);
        const mostPopular = data.sort((a, b) => (b.play_count || 0) - (a.play_count || 0))[0];
        
        document.getElementById('total-games-count').textContent = totalGames;
        document.getElementById('total-plays-count').textContent = totalPlays;
        document.getElementById('most-popular-game').textContent = mostPopular ? mostPopular.title : '-';
    }
       
    // 獲取今日遊玩次數
    fetch('/api/admin/games/stats/today')
    .then(response => response.json())
    .then(data => {
        document.getElementById('today-plays-count').textContent = data.today_count;
    })
    .catch(error => {
        console.error('獲取今日遊玩統計失敗:', error);
        document.getElementById('today-plays-count').textContent = '0';
    });
}

// 點擊外部關閉模態窗
window.onclick = function(event) {
    const addModal = document.getElementById('add-modal');
    const editModal = document.getElementById('edit-modal');
    
    if (event.target === addModal) {
        closeAddModal();
    } else if (event.target === editModal) {
        closeModal();
    }
};