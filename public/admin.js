// public/admin.js

const adminContent = document.getElementById('admin-content');
const logoutLink = document.getElementById('logout-link');
const apiBaseUrl = ''; // 同 server.js

// --- Helper Functions (可以從 app.js 複製過來) ---
async function fetchData(url, options = {}) {
    // ... (從 app.js 複製 fetchData 函數的完整內容) ...
     try {
        const response = await fetch(apiBaseUrl + url, options);
        if (!response.ok) {
            let errorData;
            try { errorData = await response.json(); } catch (parseError) { throw new Error(`HTTP error! status: ${response.status}`); }
            const message = errorData.message || `HTTP error! status: ${response.status}`;
            console.error('API Error:', message, 'URL:', url, 'Options:', options);
            throw new Error(message);
        }
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) { return await response.json(); }
        return { success: true, status: response.status };
    } catch (error) {
        console.error('Fetch Error:', error, 'URL:', url, 'Options:', options);
        throw error;
    }
}

function renderLoading() {
    adminContent.innerHTML = '<p>正在載入...</p>';
}

function renderError(message, context = "") {
    console.error(`Error ${context}: ${message}`);
    // 可以選擇在特定區域顯示錯誤，或用 alert
    adminContent.innerHTML = `<div class="admin-section"><h2 style="color:red;">操作失敗</h2><p>${message}</p><button onclick="renderDashboard()">返回儀表板</button></div>`;
    // 或者 alert(`錯誤: ${message}`);
}

// --- Admin State ---
let currentView = 'loading'; // 'login', 'dashboard', 'products', 'productForm', 'music', 'musicForm'

// --- Core Rendering Logic ---

// 檢查登入狀態並決定顯示哪個主視圖
async function initializeAdmin() {
    renderLoading();
    try {
        // *** 這裡呼叫 /api/auth/status ***
        const status = await fetchData('/api/auth/status');
        if (status.isAdmin) {
            logoutLink.style.display = 'inline'; // 顯示登出連結
            renderDashboard(); // 已登入，顯示儀表板
        } else {
            logoutLink.style.display = 'none'; // 隱藏登出連結
            renderLogin(); // 未登入，顯示登入表單
        }
    } catch (error) {
        // 即使檢查狀態失敗，也顯示登入頁面
        renderError(`無法驗證登入狀態: ${error.message}`, "initializing admin");
        renderLogin(); // 作為備用
    }
}

// --- View Rendering Functions ---

// 渲染登入表單
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
                    <p id="login-error" style="color: red; margin-top: 10px;"></p>
                </form>
            </div>
        </div>
    `;
    // 添加登入表單提交事件
    document.getElementById('login-form').addEventListener('submit', handleLoginSubmit);
}

// 渲染儀表板
function renderDashboard() {
    currentView = 'dashboard';
    // ... (可以加入計數器等) ...
    adminContent.innerHTML = `
        <div class="admin-section">
            <h2>儀表板</h2>
            <p>歡迎來到管理後台！</p>
            <ul>
                <li><button onclick="renderProductList()">管理商品</button></li>
                <li><button onclick="renderMusicList()">管理音樂</button></li>
            </ul>
            <!-- (計數器顯示區域) -->
        </div>
    `;
}

// --- Product CRUD Views ---
async function renderProductList() {
    currentView = 'products';
    renderLoading();
    try {
        const products = await fetchData('/api/products');
        let tableRows = '<tr><td colspan="7">目前沒有商品。</td></tr>';
        if (products && products.length > 0) {
            tableRows = products.map(p => `
                <tr data-id="${p.id}">
                    <td>${p.id}</td><td><img src="${p.image_url || '/images/placeholder.png'}" alt="${p.name}"></td><td>${p.name}</td><td>${p.price ?? ''}</td><td>${p.description || ''}</td><td><a href="${p.seven_eleven_url || '#'}" target="_blank">${p.seven_eleven_url ? '連結' : ''}</a></td>
                    <td class="actions"><button onclick="renderProductForm(${p.id})">編輯</button> <button class="delete-btn" data-type="product" data-id="${p.id}">刪除</button></td>
                </tr>`).join('');
        }
        adminContent.innerHTML = `
            <div class="admin-section">
                <h2>管理商品 <button onclick="renderDashboard()" style="float:right; font-size:0.8em;">返回儀表板</button></h2>
                <button onclick="renderProductForm()" class="add-button">新增商品</button>
                <table class="admin-table"><thead><tr><th>ID</th><th>圖片</th><th>名稱</th><th>價格</th><th>描述</th><th>7-11 連結</th><th>操作</th></tr></thead><tbody id="admin-list-body">${tableRows}</tbody></table>
            </div>`;
        attachDeleteListeners(); // 附加刪除事件
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
        try { product = await fetchData(`/api/products/${productId}`); }
        catch (error) { renderError(`無法載入商品 (ID: ${productId}): ${error.message}`, "loading product form"); return; }
    }
    adminContent.innerHTML = `
        <div class="admin-section">
            <h2>${isEditMode ? '編輯商品' : '新增商品'} <button onclick="renderProductList()" style="float:right; font-size:0.8em;">返回列表</button></h2>
            <div class="form-container">
                <form id="product-form">
                    <input type="hidden" name="productId" value="${product.id || ''}">
                    <div class="form-group"><label>名稱:</label><input type="text" name="name" value="${product.name || ''}" required></div>
                    <div class="form-group"><label>描述:</label><textarea name="description">${product.description || ''}</textarea></div>
                    <div class="form-group"><label>價格:</label><input type="number" name="price" step="0.01" min="0" value="${product.price || ''}"></div>
                    <div class="form-group"><label>圖片網址:</label><input type="text" name="image_url" value="${product.image_url || ''}"></div>
                    <div class="form-group"><label>7-11連結:</label><input type="text" name="seven_eleven_url" value="${product.seven_eleven_url || ''}"></div>
                    <div class="form-buttons"><button type="button" onclick="renderProductList()">取消</button><button type="submit">${isEditMode ? '更新' : '新增'}</button></div>
                    <p id="form-error" style="color: red; margin-top: 10px;"></p>
                </form>
            </div>
        </div>`;
    document.getElementById('product-form').addEventListener('submit', handleProductFormSubmit);
}

// --- Music CRUD Views (與 Product 類似，需要完成) ---
async function renderMusicList() {
    currentView = 'music';
    renderLoading();
     try {
        const musicTracks = await fetchData('/api/music');
        let tableRows = '<tr><td colspan="7">目前沒有音樂作品。</td></tr>';
        if (musicTracks && musicTracks.length > 0) {
            tableRows = musicTracks.map(t => {
                 let releaseDateStr = t.release_date ? new Date(t.release_date).toLocaleDateString() : '';
                return `
                <tr data-id="${t.id}">
                    <td>${t.id}</td><td><img src="${t.cover_art_url || '/images/placeholder.png'}" alt="${t.title}"></td><td>${t.title}</td><td>${t.artist}</td><td>${releaseDateStr}</td><td><a href="${t.platform_url || '#'}" target="_blank">${t.platform_url ? '連結' : ''}</a></td>
                    <td class="actions"><button onclick="renderMusicForm(${t.id})">編輯</button> <button class="delete-btn" data-type="music" data-id="${t.id}">刪除</button></td>
                </tr>`}).join('');
        }
        adminContent.innerHTML = `
            <div class="admin-section">
                <h2>管理音樂 <button onclick="renderDashboard()" style="float:right; font-size:0.8em;">返回儀表板</button></h2>
                <button onclick="renderMusicForm()" class="add-button">新增音樂</button>
                <table class="admin-table"><thead><tr><th>ID</th><th>封面</th><th>標題</th><th>演出者</th><th>發行日期</th><th>平台連結</th><th>操作</th></tr></thead><tbody id="admin-list-body">${tableRows}</tbody></table>
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
         try { track = await fetchData(`/api/music/${musicId}`); }
         catch (error) { renderError(`無法載入音樂 (ID: ${musicId}): ${error.message}`, "loading music form"); return; }
     }
     let releaseDateValue = '';
     if (track.release_date) { try { releaseDateValue = new Date(track.release_date).toISOString().split('T')[0]; } catch(e){} }

    adminContent.innerHTML = `
         <div class="admin-section">
             <h2>${isEditMode ? '編輯音樂' : '新增音樂'} <button onclick="renderMusicList()" style="float:right; font-size:0.8em;">返回列表</button></h2>
             <div class="form-container">
                 <form id="music-form">
                     <input type="hidden" name="musicId" value="${track.id || ''}">
                     <div class="form-group"><label>標題:</label><input type="text" name="title" value="${track.title || ''}" required></div>
                     <div class="form-group"><label>演出者:</label><input type="text" name="artist" value="${track.artist || ''}" required></div>
                     <div class="form-group"><label>簡介:</label><textarea name="description">${track.description || ''}</textarea></div>
                     <div class="form-group"><label>發行日期:</label><input type="date" name="release_date" value="${releaseDateValue}"></div>
                     <div class="form-group"><label>封面網址:</label><input type="text" name="cover_art_url" value="${track.cover_art_url || ''}"></div>
                     <div class="form-group"><label>平台連結:</label><input type="text" name="platform_url" value="${track.platform_url || ''}"></div>
                     <div class="form-buttons"><button type="button" onclick="renderMusicList()">取消</button><button type="submit">${isEditMode ? '更新' : '新增'}</button></div>
                     <p id="form-error" style="color: red; margin-top: 10px;"></p>
                 </form>
             </div>
         </div>`;
     document.getElementById('music-form').addEventListener('submit', handleMusicFormSubmit);
}


// --- Event Handlers ---
async function handleLoginSubmit(event) {
    event.preventDefault();
    const passwordInput = document.getElementById('password');
    const errorP = document.getElementById('login-error');
    errorP.textContent = '';
    if (!passwordInput) return;
    const password = passwordInput.value;
    try {
        // *** 這裡呼叫 POST /api/login ***
        // *** 如果 server.js 的 /api/login 404，這裡會報錯 ***
        const result = await fetchData('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (result.success) {
            logoutLink.style.display = 'inline'; // 顯示登出
            renderDashboard(); // 登入成功，顯示儀表板
        } else {
            errorP.textContent = result.message || '登入失敗';
        }
    } catch (error) {
        // *** 404 錯誤會顯示在這裡 ***
        errorP.textContent = error.message || '登入時發生錯誤';
    }
}

async function handleLogoutClick(event) {
     event.preventDefault();
     try {
         await fetchData('/api/logout', { method: 'POST' });
         logoutLink.style.display = 'none'; // 隱藏登出
         renderLogin(); // 跳回登入頁
     } catch (error) {
         renderError(`登出失敗: ${error.message}`, "logging out");
     }
}

async function handleProductFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const errorP = form.querySelector('#form-error');
    errorP.textContent = '';
    const formData = new FormData(form);
    const productData = Object.fromEntries(formData.entries());
    const productId = productData.productId || null;
    const isEditMode = productId !== null;

    // 處理空價格和轉數字
    productData.price = productData.price ? parseFloat(productData.price) : null;
     if (productData.price !== null && isNaN(productData.price)) {
        errorP.textContent = '價格必須是有效的數字。';
        return;
     }

    delete productData.productId; // 從提交數據中移除 id

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
            renderProductList(); // 返回列表
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
     errorP.textContent = '';
     const formData = new FormData(form);
     const musicData = Object.fromEntries(formData.entries());
     const musicId = musicData.musicId || null;
     const isEditMode = musicId !== null;

     // 處理空日期
     musicData.release_date = musicData.release_date || null;
     delete musicData.musicId;

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
             renderMusicList(); // 返回列表
         } else {
             errorP.textContent = result.message || `無法${isEditMode ? '更新' : '新增'}音樂`;
         }
     } catch (error) {
         errorP.textContent = error.message || `操作音樂時發生錯誤`;
     }
}

// 統一的刪除事件監聽 (使用事件委派)
function attachDeleteListeners() {
    adminContent.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            event.preventDefault();
            const btn = event.target;
            const type = btn.getAttribute('data-type');
            const id = btn.getAttribute('data-id');
            const row = btn.closest('tr');
            const nameElement = row.querySelector('td:nth-child(3)');
            const name = nameElement ? nameElement.textContent : `ID ${id}`;

            if (confirm(`確定要刪除 ${type === 'product' ? '商品' : '音樂'} "${name}" (ID: ${id}) 嗎？`)) {
                const url = `/api/${type}s/${id}`;
                try {
                    const result = await fetchData(url, { method: 'DELETE' });
                    if (result.success) {
                        alert(`${type === 'product' ? '商品' : '音樂'}刪除成功！`);
                        row.remove();
                        // 可選: 檢查列表是否為空
                        const listBody = document.getElementById('admin-list-body');
                        if (listBody && listBody.children.length === 0) {
                           const colspan = type === 'product' ? 7 : 7;
                           listBody.innerHTML = `<tr><td colspan="${colspan}">列表已空。</td></tr>`;
                        }
                    } else {
                        renderError(`刪除失敗: ${result.message || '未知錯誤'}`, `deleting ${type}`);
                    }
                } catch (error) {
                    renderError(`刪除錯誤: ${error.message}`, `deleting ${type}`);
                }
            }
        }
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeAdmin(); // 頁面載入時初始化
    // 登出連結事件
    if(logoutLink) {
      logoutLink.addEventListener('click', handleLogoutClick);
    } else {
      console.error("Logout link not found");
    }
});

// 添加一些 CSS 樣式 (可以移到 style.css)
const style = document.createElement('style');
style.textContent = `
    button { cursor: pointer; padding: 5px 10px; margin: 0 5px; border-radius: 3px; border: 1px solid #ccc; }
    .add-button { background-color: #28a745; color: white; border-color: #28a745; margin-bottom: 10px; display: inline-block; padding: 8px 12px; text-decoration: none;}
    .delete-btn { background-color: #dc3545; color: white; border-color: #dc3545; }
    .admin-table img { max-width: 40px; height: auto; vertical-align: middle; margin-right: 5px; }
    #admin-list-body button { font-size: 0.9em; padding: 3px 6px;}
    .admin-section button[onclick^="render"] { font-size: 1em; padding: 8px 15px;} /* Dashboard buttons */
    .form-buttons button[type=submit] { background-color: #007bff; color: white; border-color: #007bff; }
`;
document.head.appendChild(style);