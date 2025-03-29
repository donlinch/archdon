// public/admin.js (完整版)

const adminContent = document.getElementById('admin-content');
const logoutLink = document.getElementById('logout-link');
const apiBaseUrl = ''; // Assume API is on the same origin

// --- Helper Functions ---
async function fetchData(url, options = {}) {
    try {
        const response = await fetch(apiBaseUrl + url, options);
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (parseError) {
                // If response is not JSON or parsing failed
                console.error("Failed to parse error response:", parseError, "URL:", url);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // If error JSON was parsed successfully
            const message = errorData.message || `HTTP error! status: ${response.status}`;
            console.error('API Error:', message, 'URL:', url, 'Options:', options);
            throw new Error(message); // Throw the message from the backend
        }
        // Check if response is JSON (logout API might return 200 with no content)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        // If not JSON (e.g., successful logout), return a success object
        return { success: true, status: response.status };
    } catch (error) {
        console.error('Fetch Error:', error, 'URL:', url, 'Options:', options);
        // Re-throw the error for the caller to handle
        throw error;
    }
}

function renderLoading() {
    adminContent.innerHTML = '<div class="admin-section"><p>正在載入...</p></div>';
}

function renderError(message, context = "") {
    console.error(`Error ${context}: ${message}`);
    // Display error within the admin content area
    adminContent.innerHTML = `
        <div class="admin-section">
            <h2 style="color:red;">操作失敗</h2>
            <p>${message}</p>
            <button class="admin-button" onclick="renderDashboard()">返回儀表板</button>
        </div>`;
}

// --- Admin State ---
let currentView = 'loading'; // Tracks the current view being displayed

// --- Core Rendering Logic ---

async function initializeAdmin() {
    renderLoading();
    try {
        const status = await fetchData('/api/auth/status');
        if (status.isAdmin) {
            if (logoutLink) logoutLink.style.display = 'inline';
            renderDashboard(); // Show dashboard if logged in
        } else {
            if (logoutLink) logoutLink.style.display = 'none';
            renderLogin(); // Show login form if not logged in
        }
    } catch (error) {
        renderError(`無法驗證登入狀態: ${error.message}`, "initializing admin");
        // Fallback to login screen even if status check fails
        if (logoutLink) logoutLink.style.display = 'none';
        renderLogin();
    }
}

// --- View Rendering Functions ---

function renderLogin() {
    currentView = 'login';
    adminContent.innerHTML = `
        <div class="admin-section">
            <h2>管理後台登入</h2>
            <div class="form-container" style="max-width: 400px; margin: auto;">
                <form id="login-form">
                    <div class="form-group">
                        <label for="password">管理員密碼:</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <div class="form-buttons">
                        <button type="submit">登入</button>
                    </div>
                    <p id="login-error"></p>
                </form>
            </div>
        </div>
    `;
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
}

function renderDashboard() {
    currentView = 'dashboard';
    adminContent.innerHTML = `
        <div class="admin-section">
            <h2>儀表板</h2>
            <p>歡迎來到管理後台！</p>
            <div class="dashboard-links">
                <ul>
                    <li><button class="admin-button" onclick="renderProductList()">管理商品</button></li>
                    <li><button class="admin-button" onclick="renderMusicList()">管理音樂</button></li>
                </ul>
            </div>
            {/* Placeholder for future stats */}
            {/* <div class="stats-container admin-section" style="margin-top: 1.5rem;">...</div> */}
        </div>
    `;
}

// --- Product CRUD Views ---
async function renderProductList() {
    currentView = 'products';
    renderLoading();
    try {
        const products = await fetchData('/api/products');
        let tableRows = `<tr><td colspan="7">目前沒有商品。</td></tr>`;
        if (products && products.length > 0) {
            tableRows = products.map(p => `
                <tr data-id="${p.id}">
                    <td>${p.id}</td>
                    <td><img src="${p.image_url || '/images/placeholder.png'}" alt="${p.name}"></td>
                    <td>${p.name}</td>
                    <td>${p.price ?? ''}</td>
                    <td>${p.description || ''}</td>
                    <td><a href="${p.seven_eleven_url || '#'}" target="_blank" ${p.seven_eleven_url ? '' : 'style="pointer-events: none; color: grey;"'}>${p.seven_eleven_url ? '連結' : '無'}</a></td>
                    <td class="actions">
                        <button class="edit-btn" onclick="renderProductForm(${p.id})">編輯</button>
                        <button class="delete-btn" data-type="product" data-id="${p.id}">刪除</button>
                    </td>
                </tr>`).join('');
        }
        adminContent.innerHTML = `
            <div class="admin-section">
                <h2>管理商品 <button class="back-button" onclick="renderDashboard()">返回儀表板</button></h2>
                <button onclick="renderProductForm()" class="add-button">新增商品</button>
                <table class="admin-table">
                    <thead><tr><th>ID</th><th>圖片</th><th>名稱</th><th>價格</th><th>描述</th><th>7-11 連結</th><th>操作</th></tr></thead>
                    <tbody id="admin-list-body">${tableRows}</tbody>
                </table>
            </div>`;
        attachDeleteListeners();
    } catch (error) {
        renderError(`無法載入商品列表: ${error.message}`, "rendering product list");
    }
}

async function renderProductForm(productId = null) {
    currentView = 'productForm';
    renderLoading();
    let product = { id: null, name: '', description: '', price: '', image_url: '', seven_eleven_url: '' };
    const isEditMode = productId !== null;
    if (isEditMode) {
        try {
            product = await fetchData(`/api/products/${productId}`);
        }
        catch (error) {
            renderError(`無法載入商品 (ID: ${productId}): ${error.message}`, "loading product form"); return;
        }
    }
    adminContent.innerHTML = `
        <div class="admin-section">
            <h2>${isEditMode ? '編輯商品' : '新增商品'} <button class="back-button" onclick="renderProductList()">返回列表</button></h2>
            <div class="form-container">
                <form id="product-form">
                    <input type="hidden" name="productId" value="${product.id || ''}">
                    <div class="form-group"><label for="name">名稱:</label><input type="text" id="name" name="name" value="${product.name || ''}" required></div>
                    <div class="form-group"><label for="description">描述:</label><textarea id="description" name="description">${product.description || ''}</textarea></div>
                    <div class="form-group"><label for="price">價格:</label><input type="number" id="price" name="price" step="0.01" min="0" value="${product.price ?? ''}"></div>
                    <div class="form-group"><label for="image_url">圖片網址:</label><input type="text" id="image_url" name="image_url" placeholder="/images/your_image.jpg 或 https://..." value="${product.image_url || ''}"></div>
                    <div class="form-group"><label for="seven_eleven_url">7-11連結:</label><input type="text" id="seven_eleven_url" name="seven_eleven_url" value="${product.seven_eleven_url || ''}"></div>
                    <div class="form-buttons">
                        <button type="button" onclick="renderProductList()">取消</button>
                        <button type="submit">${isEditMode ? '更新' : '新增'}</button>
                    </div>
                    <p id="form-error"></p>
                </form>
            </div>
        </div>`;
    const productForm = document.getElementById('product-form');
    if(productForm) {
        productForm.addEventListener('submit', handleProductFormSubmit);
    }
}

// --- Music CRUD Views ---
async function renderMusicList() {
    currentView = 'music';
    renderLoading();
     try {
        const musicTracks = await fetchData('/api/music');
        let tableRows = `<tr><td colspan="7">目前沒有音樂作品。</td></tr>`;
        if (musicTracks && musicTracks.length > 0) {
            tableRows = musicTracks.map(t => {
                 let releaseDateStr = '';
                 if (t.release_date) { try { releaseDateStr = new Date(t.release_date).toLocaleDateString(); } catch(e){} }
                 return `
                    <tr data-id="${t.id}">
                        <td>${t.id}</td>
                        <td><img src="${t.cover_art_url || '/images/placeholder.png'}" alt="${t.title}"></td>
                        <td>${t.title}</td>
                        <td>${t.artist}</td>
                        <td>${releaseDateStr}</td>
                        <td><a href="${t.platform_url || '#'}" target="_blank" ${t.platform_url ? '' : 'style="pointer-events: none; color: grey;"'}>${t.platform_url ? '連結' : '無'}</a></td>
                        <td class="actions">
                            <button class="edit-btn" onclick="renderMusicForm(${t.id})">編輯</button>
                            <button class="delete-btn" data-type="music" data-id="${t.id}">刪除</button>
                        </td>
                    </tr>`}).join('');
        }
        adminContent.innerHTML = `
            <div class="admin-section">
                <h2>管理音樂 <button class="back-button" onclick="renderDashboard()">返回儀表板</button></h2>
                <button onclick="renderMusicForm()" class="add-button">新增音樂</button>
                <table class="admin-table">
                    <thead>
                        <tr><th>ID</th><th>封面</th><th>標題</th><th>演出者</th><th>發行日期</th><th>平台連結</th><th>操作</th></tr>
                    </thead>
                    <tbody id="admin-list-body">
                        ${tableRows}
                    </tbody>
                </table>
            </div>`;
        attachDeleteListeners();
    } catch (error) {
        renderError(`無法載入音樂列表: ${error.message}`, "rendering music list");
    }
}

async function renderMusicForm(musicId = null) {
    currentView = 'musicForm';
    renderLoading();
     let track = { id: null, title: '', artist: '', description: '', release_date: '', cover_art_url: '', platform_url: '' };
     const isEditMode = musicId !== null;
     if (isEditMode) {
         try {
             track = await fetchData(`/api/music/${musicId}`);
         }
         catch (error) {
             renderError(`無法載入音樂 (ID: ${musicId}): ${error.message}`, "loading music form"); return;
         }
     }
     let releaseDateValue = '';
     // Format date for input type=date (YYYY-MM-DD)
     if (track.release_date) {
         try {
             releaseDateValue = new Date(track.release_date).toISOString().split('T')[0];
         } catch(e){ console.error("Error parsing music release date", track.release_date); }
     }

    adminContent.innerHTML = `
         <div class="admin-section">
             <h2>${isEditMode ? '編輯音樂' : '新增音樂'} <button class="back-button" onclick="renderMusicList()">返回列表</button></h2>
             <div class="form-container">
                 <form id="music-form">
                     <input type="hidden" name="musicId" value="${track.id || ''}">
                     <div class="form-group"><label for="title">標題:</label><input type="text" id="title" name="title" value="${track.title || ''}" required></div>
                     <div class="form-group"><label for="artist">演出者:</label><input type="text" id="artist" name="artist" value="${track.artist || ''}" required></div>
                     <div class="form-group"><label for="description">簡介:</label><textarea id="description" name="description">${track.description || ''}</textarea></div>
                     <div class="form-group"><label for="release_date">發行日期:</label><input type="date" id="release_date" name="release_date" value="${releaseDateValue}"></div>
                     <div class="form-group"><label for="cover_art_url">封面網址:</label><input type="text" id="cover_art_url" name="cover_art_url" placeholder="/images/cover.jpg 或 https://..." value="${track.cover_art_url || ''}"></div>
                     <div class="form-group"><label for="platform_url">平台連結:</label><input type="text" id="platform_url" name="platform_url" placeholder="https://..." value="${track.platform_url || ''}"></div>
                     <div class="form-buttons">
                         <button type="button" onclick="renderMusicList()">取消</button>
                         <button type="submit">${isEditMode ? '更新' : '新增'}</button>
                     </div>
                     <p id="form-error"></p>
                 </form>
             </div>
         </div>`;
    const musicForm = document.getElementById('music-form');
    if (musicForm) {
         musicForm.addEventListener('submit', handleMusicFormSubmit);
    }
}


// --- Event Handlers ---
async function handleLoginSubmit(event) {
    event.preventDefault();
    const passwordInput = document.getElementById('password');
    const errorP = document.getElementById('login-error');
    if (!passwordInput || !errorP) return; // Defensive check
    errorP.textContent = '';
    const password = passwordInput.value;
    try {
        const result = await fetchData('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (result.success) {
            if (logoutLink) logoutLink.style.display = 'inline';
            renderDashboard();
        } else {
            errorP.textContent = result.message || '登入失敗';
        }
    } catch (error) {
        errorP.textContent = error.message || '登入時發生錯誤';
    }
}

async function handleLogoutClick(event) {
     event.preventDefault();
     try {
         await fetchData('/api/logout', { method: 'POST' });
         if (logoutLink) logoutLink.style.display = 'none';
         renderLogin();
     } catch (error) {
         // Display error, but still attempt to render login as user is likely logged out
         renderError(`登出失敗: ${error.message}`, "logging out");
         renderLogin(); // Fallback to login screen
     }
}

async function handleProductFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const errorP = form.querySelector('#form-error');
    if (!errorP) return;
    errorP.textContent = '';
    const formData = new FormData(form);
    const productData = Object.fromEntries(formData.entries());
    const productId = productData.productId || null;
    const isEditMode = productId !== null;

    // Handle empty price and convert to number
    productData.price = productData.price ? parseFloat(productData.price) : null;
     if (productData.price !== null && isNaN(productData.price)) {
        errorP.textContent = '價格必須是有效的數字。';
        return;
     }

    delete productData.productId; // Remove id from submitted data

    const url = isEditMode ? `/api/products/${productId}` : '/api/products';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
        const result = await fetchData(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
        if (result.success) {
            alert(`商品已成功${isEditMode ? '更新' : '新增'}！`);
            renderProductList(); // Go back to list on success
        } else {
            errorP.textContent = result.message || `無法${isEditMode ? '更新' : '新增'}商品`;
        }
    } catch (error) {
        errorP.textContent = error.message || `操作商品時發生錯誤`;
    }
}

async function handleMusicFormSubmit(event) {
     event.preventDefault();
     const form = event.target;
     const errorP = form.querySelector('#form-error');
     if (!errorP) return;
     errorP.textContent = '';
     const formData = new FormData(form);
     const musicData = Object.fromEntries(formData.entries());
     const musicId = musicData.musicId || null;
     const isEditMode = musicId !== null;

     // Handle empty date
     musicData.release_date = musicData.release_date || null;
     delete musicData.musicId; // Remove id from submitted data

     const url = isEditMode ? `/api/music/${musicId}` : '/api/music';
     const method = isEditMode ? 'PUT' : 'POST';

     try {
         const result = await fetchData(url, {
             method: method,
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(musicData)
         });
         if (result.success) {
             alert(`音樂已成功${isEditMode ? '更新' : '新增'}！`);
             renderMusicList(); // Go back to list on success
         } else {
             errorP.textContent = result.message || `無法${isEditMode ? '更新' : '新增'}音樂`;
         }
     } catch (error) {
         errorP.textContent = error.message || `操作音樂時發生錯誤`;
     }
}

// Unified delete event listener using event delegation
function attachDeleteListeners() {
    // Remove previous listener to prevent duplicates if called multiple times
    adminContent.removeEventListener('click', handleDeleteClick);
    // Add the listener
    adminContent.addEventListener('click', handleDeleteClick);
}

// Separate handler function for delete clicks
async function handleDeleteClick(event) {
    if (event.target.classList.contains('delete-btn')) {
        event.preventDefault();
        const btn = event.target;
        const type = btn.getAttribute('data-type'); // 'product' or 'music'
        const id = btn.getAttribute('data-id');
        const row = btn.closest('tr');
        if (!type || !id || !row) return; // Exit if essential data is missing

        const nameElement = row.querySelector('td:nth-child(3)'); // 3rd td is usually name/title
        const name = nameElement ? nameElement.textContent : `ID ${id}`;

        if (confirm(`確定要刪除 ${type === 'product' ? '商品' : '音樂'} "${name}" (ID: ${id}) 嗎？這個操作無法復原！`)) {
            console.log(`Attempting to delete ${type} ID: ${id}`);
            const url = `/api/${type}s/${id}`; // Build API URL
            try {
                const result = await fetchData(url, { method: 'DELETE' });
                if (result.success) {
                    alert(`${type === 'product' ? '商品' : '音樂'}刪除成功！`);
                    row.remove(); // Remove row from the table
                    // Optional: check if table body is empty and display a message
                    const listBody = document.getElementById('admin-list-body');
                    if (listBody && listBody.children.length === 0) {
                       const colspan = type === 'product' ? 7 : 7; // Adjust colspan based on type
                       listBody.innerHTML = `<tr><td colspan="${colspan}">列表已空。</td></tr>`;
                    }
                } else {
                    // Display error, but don't stop the admin interface
                    alert(`刪除失敗：${result.message || '未知錯誤'}`);
                }
            } catch (error) {
                console.error("Delete request failed:", error);
                alert(`刪除過程中發生網路或程式錯誤: ${error.message}`);
            }
        } else {
            console.log('Deletion cancelled');
        }
    }
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the admin interface
    initializeAdmin();

    // Attach logout listener only once
    if(logoutLink) {
      logoutLink.addEventListener('click', handleLogoutClick);
    } else {
      // This might happen if the script runs before the logout link exists (e.g., on login screen)
      // It will be displayed and listener added after successful login.
      console.log("Logout link not found on initial load, will be handled after login.");
    }
});