// --- START OF FILE public/rich/admin.js (Corrected) ---

document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    // ★★★ 修改這裡：使用正確的 ID 'admin-panel' ★★★
    const adminContent = document.getElementById('admin-panel');
    const refreshButton = document.getElementById('refresh-rooms-btn');
    const roomListContainer = document.getElementById('room-list-container');
    const roomDetailsContainer = document.getElementById('room-details-container');
    const detailsContent = document.getElementById('details-content');
    const deleteRoomButton = document.getElementById('delete-room-btn');
    const errorMessageDiv = document.getElementById('error-message'); // Make sure this ID exists in HTML
    const successMessageDiv = document.getElementById('success-message'); // Make sure this ID exists in HTML

    // Check if adminContent was found before trying to use it
    if (!adminContent) {
        console.error("嚴重錯誤：找不到 ID 為 'admin-panel' 的主要內容元素！請檢查 rich-admin.html。");
        // Optionally display an error message on the page itself
        document.body.innerHTML = "<p style='color:red; font-weight:bold; padding: 20px;'>頁面載入錯誤：缺少必要的 HTML 元素 (admin-panel)。</p>";
        return; // Stop script execution if the main container is missing
    }

    let selectedRoomId = null;

    // --- Initialization ---
    adminContent.classList.remove('hidden'); // Now this should work
    fetchRooms();

    // --- Event Listeners ---
    refreshButton.addEventListener('click', fetchRooms);
    deleteRoomButton.addEventListener('click', handleDeleteRoom);

    // --- Utility Functions ---
    function showTemporaryMessage(element, message) {
         if (!element) return; // Add null check for message elements
        element.textContent = message;
        element.classList.remove('hidden');
        setTimeout(() => {
             element.classList.add('hidden');
             element.textContent = '';
        }, 5000);
    }

    function showError(message) {
        console.error("Admin Error:", message);
        showTemporaryMessage(errorMessageDiv, `錯誤：${message}`);
        if (successMessageDiv) { // Null check
            successMessageDiv.classList.add('hidden');
            successMessageDiv.textContent = '';
        }
    }

     function showSuccess(message) {
        console.log("Admin Success:", message);
        showTemporaryMessage(successMessageDiv, `成功：${message}`);
        if (errorMessageDiv) { // Null check
            errorMessageDiv.classList.add('hidden');
            errorMessageDiv.textContent = '';
        }
    }

    function clearMessages() {
        if(errorMessageDiv) errorMessageDiv.classList.add('hidden');
        if(errorMessageDiv) errorMessageDiv.textContent = '';
        if(successMessageDiv) successMessageDiv.classList.add('hidden');
        if(successMessageDiv) successMessageDiv.textContent = '';
    }

    async function fetchApi(url, options = {}) {
        clearMessages();
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...options.headers,
                },
            });

            if (!response.ok) {
                let errorMsg = `伺服器錯誤 (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorData.message || errorMsg;
                } catch (e) { errorMsg = `${errorMsg}: ${response.statusText}`; }
                throw new Error(errorMsg);
            }

            if (response.status === 204 || response.headers.get("content-length") === "0") {
                 return { success: true };
            }

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            } else {
                 console.warn(`API response for ${url} was not JSON. Content-Type: ${contentType}`);
                 return { success: true, data: await response.text() };
            }
        } catch (error) {
            showError(error.message || '網路請求失敗或伺服器無回應');
            return null;
        }
    }

    // --- Core Functions ---
    async function fetchRooms() {
        // Add null check for containers
        if (!roomListContainer || !roomDetailsContainer || !deleteRoomButton) {
             console.error("Error: Missing required room list/details elements in HTML.");
             showError("頁面元件載入不完整，無法顯示房間列表。");
             return;
        }
        roomListContainer.innerHTML = '<p>正在載入房間列表...</p>';
        roomDetailsContainer.classList.add('hidden');
        deleteRoomButton.classList.add('hidden');
        selectedRoomId = null;

        const rooms = await fetchApi('/api/admin/rooms');

        if (rooms === null || !Array.isArray(rooms)) {
            roomListContainer.innerHTML = '<p style="color: red;">無法載入房間列表。請檢查伺服器狀態或控制台錯誤。</p>';
            return;
        }

        if (rooms.length === 0) {
            roomListContainer.innerHTML = '<p>目前資料庫中沒有任何房間。</p>';
            return;
        }

        roomListContainer.innerHTML = '';
        rooms.forEach(room => {
            const item = document.createElement('div');
            item.classList.add('room-list-item');
            if (room.isStale) {
                item.classList.add('stale');
                item.title = `此房間最後活動時間為 ${new Date(room.lastActive).toLocaleString()}，可能已不活躍。`;
            }
            item.innerHTML = `
                <div class="room-info">
                    <span><strong>ID:</strong> ${room.id}</span>
                    <span><strong>名稱:</strong> ${room.roomName || '(未命名)'}</span>
                    <span><strong>人數:</strong> ${room.playerCount}/${room.maxPlayers}</span>
                    <span><strong>最後活動:</strong> ${new Date(room.lastActive).toLocaleString()}</span>
                </div>
                <div class="room-actions">
                    <button class="btn btn-info btn-sm view-details-btn" data-roomid="${room.id}">查看詳情</button>
                    <button class="btn btn-danger btn-sm delete-room-btn-list" data-roomid="${room.id}">刪除</button>
                </div>
            `;
            roomListContainer.appendChild(item);
        });
        attachListButtonListeners();
    }

    function attachListButtonListeners() {
        document.querySelectorAll('.view-details-btn').forEach(button => {
            button.addEventListener('click', () => {
                fetchRoomDetails(button.dataset.roomid);
                if (roomDetailsContainer) roomDetailsContainer.scrollIntoView({ behavior: 'smooth' });
            });
        });
        document.querySelectorAll('.delete-room-btn-list').forEach(button => {
            button.addEventListener('click', (e) => {
                 e.stopPropagation();
                 handleDeleteRoomFromList(button.dataset.roomid);
            });
        });
    }

    async function fetchRoomDetails(roomId) {
         if (!detailsContent || !roomDetailsContainer || !deleteRoomButton) {
             console.error("Error: Missing required room details elements in HTML.");
             showError("頁面元件載入不完整，無法顯示房間詳情。");
             return;
         }
        selectedRoomId = roomId;
        detailsContent.innerHTML = `<p>正在載入房間 ${roomId} 的詳情...</p>`;
        roomDetailsContainer.classList.remove('hidden');
        deleteRoomButton.classList.add('hidden');

        const roomDetails = await fetchApi(`/api/admin/rooms/${roomId}`);

        if (!roomDetails) {
            detailsContent.innerHTML = `<p style="color: red;">無法載入房間 ${roomId} 的詳情。</p>`;
            selectedRoomId = null;
            return;
        }

        const formattedGameState = JSON.stringify(roomDetails.gameState, null, 2);
        detailsContent.innerHTML = `
            <p><strong>房間 ID:</strong> ${roomDetails.id}</p>
            <p><strong>房間名稱:</strong> ${roomDetails.roomName || '(未命名)'}</p>
            <p><strong>創建時間:</strong> ${new Date(roomDetails.createdAt).toLocaleString()}</p>
            <p><strong>最後活動:</strong> ${new Date(roomDetails.lastActive).toLocaleString()}</p>
            <p><strong>遊戲狀態 (GameState):</strong></p>
            <pre>${formattedGameState}</pre>
        `;
        deleteRoomButton.classList.remove('hidden');
    }

     function handleDeleteRoomFromList(roomId) {
         if (confirm(`您確定要刪除房間 ${roomId} 嗎？此操作無法復原！`)) {
              deleteRoom(roomId);
         }
     }

    function handleDeleteRoom() {
        if (!selectedRoomId) {
            showError("沒有選擇要刪除的房間。");
            return;
        }
        if (confirm(`您確定要刪除目前查看的房間 ${selectedRoomId} 嗎？此操作無法復原！`)) {
             deleteRoom(selectedRoomId);
        }
    }

    async function deleteRoom(roomId) {
         console.log(`請求刪除房間: ${roomId}`);
         const result = await fetchApi(`/api/admin/rooms/${roomId}`, { method: 'DELETE' });

         if (result && result.success) {
            showSuccess(result.message || `房間 ${roomId} 已成功刪除。`);
            fetchRooms();
            if (roomDetailsContainer) roomDetailsContainer.classList.add('hidden');
            if (deleteRoomButton) deleteRoomButton.classList.add('hidden');
            selectedRoomId = null;
         } else {
             console.error(`刪除房間 ${roomId} 失敗`);
             if (!errorMessageDiv || !errorMessageDiv.textContent) { // Check if error was already shown
                  showError(`刪除房間 ${roomId} 失敗。請檢查控制台。`);
             }
         }
    }
});

// --- END OF FILE public/rich/admin.js ---