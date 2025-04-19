// --- START OF FILE public/rich/admin.js ---

document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const adminContent = document.getElementById('admin-content'); // Main content area
    const refreshButton = document.getElementById('refresh-rooms-btn');
    const roomListContainer = document.getElementById('room-list-container');
    const roomDetailsContainer = document.getElementById('room-details-container');
    const detailsContent = document.getElementById('details-content');
    const deleteRoomButton = document.getElementById('delete-room-btn'); // Button within details view
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');

    let selectedRoomId = null; // To keep track of the room currently being viewed

    // --- Initialization ---
    // Show content immediately since there's no auth
    adminContent.classList.remove('hidden');
    // Fetch rooms when the page loads
    fetchRooms();

    // --- Event Listeners ---
    refreshButton.addEventListener('click', fetchRooms);
    deleteRoomButton.addEventListener('click', handleDeleteRoom); // For the button in the details view

    // --- Utility Functions ---

    /**
     * Displays a message (error or success) and hides it after a delay.
     * @param {HTMLElement} element The message container element.
     * @param {string} message The message text.
     */
    function showTemporaryMessage(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
        // Automatically hide the message after 5 seconds
        setTimeout(() => {
             element.classList.add('hidden');
             element.textContent = '';
        }, 5000);
    }

    /**
     * Shows an error message.
     * @param {string} message The error message text.
     */
    function showError(message) {
        console.error("Admin Error:", message);
        showTemporaryMessage(errorMessageDiv, `錯誤：${message}`);
        // Ensure success message is hidden if an error occurs
        successMessageDiv.classList.add('hidden');
        successMessageDiv.textContent = '';
    }

    /**
     * Shows a success message.
     * @param {string} message The success message text.
     */
     function showSuccess(message) {
        console.log("Admin Success:", message);
        showTemporaryMessage(successMessageDiv, `成功：${message}`);
        // Ensure error message is hidden if a success occurs
        errorMessageDiv.classList.add('hidden');
        errorMessageDiv.textContent = '';
    }

    /**
     * Clears any currently displayed error or success messages.
     */
    function clearMessages() {
        errorMessageDiv.classList.add('hidden');
        errorMessageDiv.textContent = '';
        successMessageDiv.classList.add('hidden');
        successMessageDiv.textContent = '';
    }

    /**
     * Helper function to make API calls.
     * Handles basic error checking and JSON parsing.
     * @param {string} url The API endpoint URL.
     * @param {object} options Fetch options (method, body, etc.).
     * @returns {Promise<object|null>} Parsed JSON data or null if request failed.
     */
    async function fetchApi(url, options = {}) {
        clearMessages(); // Clear previous messages on new request

        try {
            const response = await fetch(url, {
                ...options,
                headers: { // Set default headers
                    'Content-Type': 'application/json',
                    'Accept': 'application/json', // Expect JSON response
                    ...options.headers, // Allow overriding headers
                },
            });

            // Check if the request was successful
            if (!response.ok) {
                let errorMsg = `伺服器錯誤 (${response.status})`;
                try {
                    // Try to parse error details from response body
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorData.message || errorMsg;
                } catch (e) {
                    // If parsing fails, use the status text
                    errorMsg = `${errorMsg}: ${response.statusText}`;
                }
                throw new Error(errorMsg);
            }

            // Handle successful responses with no content (e.g., DELETE 204)
            if (response.status === 204 || response.headers.get("content-length") === "0") {
                 return { success: true }; // Indicate success with no data
            }

            // Check content type before parsing JSON
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json(); // Parse and return JSON data
            } else {
                 // Handle non-JSON successful responses if necessary
                 console.warn(`API response for ${url} was not JSON. Content-Type: ${contentType}`);
                 // Return success but indicate non-JSON data if needed
                 return { success: true, data: await response.text() };
            }

        } catch (error) {
            showError(error.message || '網路請求失敗或伺服器無回應');
            return null; // Indicate failure
        }
    }

    // --- Core Functions ---

    /**
     * Fetches the list of all game rooms from the backend and displays them.
     */
    async function fetchRooms() {
        roomListContainer.innerHTML = '<p>正在載入房間列表...</p>';
        roomDetailsContainer.classList.add('hidden'); // Hide details pane
        deleteRoomButton.classList.add('hidden');     // Hide delete button in details pane
        selectedRoomId = null;                        // Reset selected room

        const rooms = await fetchApi('/api/admin/rooms');

        // Check if the API call failed or returned unexpected data
        if (rooms === null || !Array.isArray(rooms)) {
            roomListContainer.innerHTML = '<p style="color: red;">無法載入房間列表。請檢查伺服器狀態或控制台錯誤。</p>';
            return;
        }

        if (rooms.length === 0) {
            roomListContainer.innerHTML = '<p>目前資料庫中沒有任何房間。</p>';
            return;
        }

        // Clear loading message and render the room list
        roomListContainer.innerHTML = '';
        rooms.forEach(room => {
            const item = document.createElement('div');
            item.classList.add('room-list-item');
            if (room.isStale) { // Add visual indicator for inactive rooms
                item.classList.add('stale');
                item.title = `此房間最後活動時間為 ${new Date(room.lastActive).toLocaleString()}，可能已不活躍。`;
            }

            // Create list item content
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

        // Add event listeners to the newly created buttons
        attachListButtonListeners();
    }

    /**
     * Attaches event listeners to buttons within the room list.
     */
    function attachListButtonListeners() {
        document.querySelectorAll('.view-details-btn').forEach(button => {
            button.addEventListener('click', () => {
                fetchRoomDetails(button.dataset.roomid);
                // Optional: Scroll to details section
                roomDetailsContainer.scrollIntoView({ behavior: 'smooth' });
            });
        });
        document.querySelectorAll('.delete-room-btn-list').forEach(button => {
            button.addEventListener('click', (e) => {
                 e.stopPropagation(); // Prevent potential parent event triggers
                 handleDeleteRoomFromList(button.dataset.roomid);
            });
        });
    }

    /**
     * Fetches and displays detailed information for a specific room.
     * @param {string} roomId The ID of the room to fetch details for.
     */
    async function fetchRoomDetails(roomId) {
        selectedRoomId = roomId; // Store the selected room ID
        detailsContent.innerHTML = `<p>正在載入房間 ${roomId} 的詳情...</p>`;
        roomDetailsContainer.classList.remove('hidden'); // Show the details pane
        deleteRoomButton.classList.add('hidden');     // Hide delete button initially

        const roomDetails = await fetchApi(`/api/admin/rooms/${roomId}`);

        if (!roomDetails) { // Check if API call failed
            detailsContent.innerHTML = `<p style="color: red;">無法載入房間 ${roomId} 的詳情。</p>`;
            selectedRoomId = null; // Reset selected ID on failure
            return;
        }

        // Format the gameState JSON for better readability
        const formattedGameState = JSON.stringify(roomDetails.gameState, null, 2); // Indent with 2 spaces

        // Display the fetched details
        detailsContent.innerHTML = `
            <p><strong>房間 ID:</strong> ${roomDetails.id}</p>
            <p><strong>房間名稱:</strong> ${roomDetails.roomName || '(未命名)'}</p>
            <p><strong>創建時間:</strong> ${new Date(roomDetails.createdAt).toLocaleString()}</p>
            <p><strong>最後活動:</strong> ${new Date(roomDetails.lastActive).toLocaleString()}</p>
            <p><strong>遊戲狀態 (GameState):</strong></p>
            <pre>${formattedGameState}</pre>
        `;
        deleteRoomButton.classList.remove('hidden'); // Show the delete button now that details are loaded
    }

    /**
     * Handles the delete request originating from a button in the room list.
     * @param {string} roomId The ID of the room to delete.
     */
     function handleDeleteRoomFromList(roomId) {
         if (confirm(`您確定要刪除房間 ${roomId} 嗎？此操作無法復原！`)) {
              deleteRoom(roomId);
         }
     }

    /**
     * Handles the delete request originating from the button within the details view.
     */
    function handleDeleteRoom() {
        if (!selectedRoomId) {
            showError("沒有選擇要刪除的房間。");
            return;
        }

        if (confirm(`您確定要刪除目前查看的房間 ${selectedRoomId} 嗎？此操作無法復原！`)) {
             deleteRoom(selectedRoomId);
        }
    }

    /**
     * Sends a DELETE request to the backend to remove a room.
     * @param {string} roomId The ID of the room to delete.
     */
    async function deleteRoom(roomId) {
         console.log(`請求刪除房間: ${roomId}`);
         const result = await fetchApi(`/api/admin/rooms/${roomId}`, { method: 'DELETE' });

         // Check if the API call was successful (fetchApi returns { success: true } for DELETE 204)
         if (result && result.success) {
            showSuccess(result.message || `房間 ${roomId} 已成功刪除。`);
            fetchRooms(); // Refresh the room list
            // Hide details pane as the viewed room is now gone
            roomDetailsContainer.classList.add('hidden');
            deleteRoomButton.classList.add('hidden');
            selectedRoomId = null;
         } else {
             // Error message should have been displayed by fetchApi
             console.error(`刪除房間 ${roomId} 失敗`);
             // Optionally show a generic error if fetchApi didn't, though it should have
             if (!errorMessageDiv.textContent && !successMessageDiv.textContent) {
                  showError(`刪除房間 ${roomId} 失敗。請檢查控制台。`);
             }
         }
    }

});

// --- END OF FILE public/rich/admin.js ---