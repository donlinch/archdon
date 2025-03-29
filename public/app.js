app.js// public/app.js

const apiBaseUrl = ''; // 如果 API 和前端在同一個伺服器，可以留空
const appContainer = document.getElementById('app');
const mainNav = document.getElementById('main-nav'); // 獲取導覽列容器

// --- Helper Functions ---
async function fetchData(url, options = {}) {
    try {
        const response = await fetch(apiBaseUrl + url, options);
        if (!response.ok) {
            // 嘗試解析錯誤訊息 JSON
            let errorData;
            try {
                errorData = await response.json();
            } catch (parseError) {
                // 如果回應不是 JSON 或解析失敗
                console.error("Failed to parse error response:", parseError);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // 如果成功解析錯誤 JSON
            const message = errorData.message || `HTTP error! status: ${response.status}`;
            console.error('API Error:', message, 'URL:', url, 'Options:', options);
            throw new Error(message); // 拋出後端提供的錯誤訊息
        }
        // 檢查回應是否為 JSON (登出 API 可能返回 200 但無內容)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        // 如果不是 JSON (例如登出成功)，返回一個表示成功的物件
        return { success: true, status: response.status };
    } catch (error) {
        console.error('Fetch Error:', error, 'URL:', url, 'Options:', options);
        // 將錯誤再次拋出，讓呼叫者處理
        throw error;
    }
}

// 渲染 Loading 狀態
function renderLoading() {
    appContainer.innerHTML = '<p>正在載入...</p>';
}

// 渲染錯誤訊息
function renderError(message) {
    appContainer.innerHTML = `<p style="color: red;">錯誤：${message}</p>`;
}

// --- View Rendering Functions ---

// 首頁視圖 (簡單範例)
function renderHome() {
    appContainer.innerHTML = `
        <h2>歡迎來到 SunnyYummy！</h2>
        <p>這裡是我們的展示網站。</p>
         <p class="api-links">
            <a href="#/products">查看商品</a> |
            <a href="#/music">查看音樂</a>
        </p>
    `;
    setActiveNav('#/'); // 設置導覽列活動狀態
}

// 商品列表視圖 (前台)
async function renderProductList() {
    renderLoading();
    try {
        const products = await fetchData('/api/products');
        if (!products || products.length === 0) {
            appContainer.innerHTML = '<h2>商品列表</h2><p>目前沒有商品。</p>';
            return;
        }

        const productCards = products.map(product => `
            <div class="product-card">
                <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p>${product.description || ''}</p>
                <p class="price">價格: $${product.price !== null ? product.price : '洽詢'}</p>
                ${product.seven_eleven_url ? `<a href="${product.seven_eleven_url}" class="button" target="_blank" rel="noopener noreferrer">前往 7-11 預購</a>` : ''}
            </div>
        `).join('');

        appContainer.innerHTML = `<h2>商品列表</h2><div id="product-list">${productCards}</div>`;
        setActiveNav('#/products');
    } catch (error) {
        renderError(`無法載入商品列表：${error.message}`);
    }
}

// 音樂列表視圖 (前台)
async function renderMusicList() {
    renderLoading();
    try {
        const musicTracks = await fetchData('/api/music'); // 使用 /api/music
        if (!musicTracks || musicTracks.length === 0) {
            appContainer.innerHTML = '<h2>音樂列表</h2><p>目前沒有音樂作品。</p>';
            return;
        }

        const musicCards = musicTracks.map(track => `
            <div class="product-card music-card">
                <img src="${track.cover_art_url || '/images/placeholder.png'}" alt="${track.title}">
                <h3>${track.title}</h3>
                <p>演出者: ${track.artist}</p>
                ${track.release_date ? `<p>發行日期: ${new Date(track.release_date).toLocaleDateString()}</p>` : ''}
                <p>${track.description || ''}</p>
                ${track.platform_url ? `<a href="${track.platform_url}" class="button" target="_blank" rel="noopener noreferrer">前往收聽</a>` : ''}
            </div>
        `).join('');

        appContainer.innerHTML = `<h2>音樂列表</h2><div id="music-list" class="product-list">${musicCards}</div>`; // 可以共用 product-list 的 flex 樣式
        setActiveNav('#/music');
    } catch (error) {
        renderError(`無法載入音樂列表：${error.message}`);
    }
}


// --- Admin Section ---
let isAdminLoggedIn = false; // 簡單的狀態變數

// 檢查登入狀態
async function checkLoginStatus() {
    try {
        const data = await fetchData('/api/auth/status');
        isAdminLoggedIn = data.isAdmin;
    } catch (error) {
        console.error("檢查登入狀態失敗:", error);
        isAdminLoggedIn = false; // 假設未登入
    }
}

// 渲染後台主入口
async function renderAdmin() {
    renderLoading();
    await checkLoginStatus(); // 每次進入後台都檢查

    if (isAdminLoggedIn) {
        renderAdminDashboard();
    } else {
        renderAdminLogin();
    }
    setActiveNav('#/admin'); // 設置活動導覽連結
}

// 渲染管理員登入表單
function renderAdminLogin() {
    appContainer.innerHTML = `
        <h2>管理後台登入</h2>
        <div class="form-container" style="max-width: 400px;">
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
    `;

    // 添加表單提交事件監聽
    const loginForm = document.getElementById('login-form');
    const errorP = document.getElementById('login-error');
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // 阻止表單預設提交
        errorP.textContent = ''; // 清除舊錯誤
        const password = document.getElementById('password').value;
        try {
            const result = await fetchData('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (result.success) {
                isAdminLoggedIn = true;
                // 登入成功，導向後台主頁 (改變 hash)
                window.location.hash = '#/admin/dashboard';
            } else {
                 // API 返回登入失敗 (雖然我們在 fetchData 裡處理了 401)
                 errorP.textContent = result.message || '登入失敗';
            }
        } catch (error) {
            // 捕獲 fetchData 拋出的錯誤 (例如網路錯誤或 401)
            errorP.textContent = error.message || '登入時發生錯誤';
        }
    });
}

// 渲染後台儀表板 (登入後)
function renderAdminDashboard() {
     if (!isAdminLoggedIn) { window.location.hash = '#/admin'; return; } // 如果未登入，跳回登入頁

     // (可選) 顯示計數器的地方
     const statsHtml = `
        <div class="stats-container" style="margin-top: 30px; padding: 20px; background-color: #e9ecef; border-radius: 5px;">
             <h3>網站瀏覽統計 (待實現)</h3>
             <p>總瀏覽量: <strong id="total-views">N/A</strong></p>
             <p>今日瀏覽量: <strong id="today-views">N/A</strong></p>
             <p>本月瀏覽量: <strong id="month-views">N/A</strong></p>
        </div>
     `;

    appContainer.innerHTML = `
        <h2>管理後台</h2>
        <p>您已登入。</p>
        ${statsHtml}
        <ul style="margin-top: 30px;">
            <li><a href="#/admin/products">管理商品</a></li>
            <li><a href="#/admin/music">管理音樂</a></li>
            <li><a href="#" id="logout-link">登出</a></li>
        </ul>
    `;

    // 添加登出連結事件
    document.getElementById('logout-link').addEventListener('click', async (event) => {
        event.preventDefault();
        try {
            await fetchData('/api/logout', { method: 'POST' });
            isAdminLoggedIn = false;
            window.location.hash = '#/admin'; // 登出後跳回登入頁面
        } catch (error) {
            alert(`登出失敗: ${error.message}`);
        }
    });

     // 在這裡可以呼叫函數來加載統計數據
     // loadStats();
}

// --- Admin Product CRUD ---
async function renderAdminProductList() {
     if (!isAdminLoggedIn) { window.location.hash = '#/admin'; return; }
     renderLoading();
     try {
        const products = await fetchData('/api/products');
        let tableRows = '<tr><td colspan="7">目前沒有商品。</td></tr>'; // colspan 調整為 7

        if (products && products.length > 0) {
            tableRows = products.map(product => `
                 <tr data-id="${product.id}">
                     <td>${product.id}</td>
                     <td><img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name}"></td>
                     <td>${product.name}</td>
                     <td>${product.price !== null ? product.price : ''}</td>
                     <td>${product.description || ''}</td>
                     <td><a href="${product.seven_eleven_url || '#'}" target="_blank">${product.seven_eleven_url ? '連結' : ''}</a></td>
                     <td class="actions">
                         <a href="#/admin/products/edit/${product.id}">編輯</a>
                         <a href="#" class="delete-link" data-type="product" data-id="${product.id}">刪除</a>
                     </td>
                 </tr>
            `).join('');
        }

         appContainer.innerHTML = `
            <h2>管理商品</h2>
             <p><a href="#/admin/dashboard">返回儀表板</a></p>
             <a href="#/admin/products/new" class="add-button">新增商品</a>
             <table class="admin-table">
                 <thead>
                     <tr>
                         <th>ID</th><th>圖片</th><th>名稱</th><th>價格</th><th>描述</th><th>7-11 連結</th><th>操作</th>
                     </tr>
                 </thead>
                 <tbody id="admin-list-body">
                     ${tableRows}
                 </tbody>
             </table>
        `;
        // 添加刪除事件監聽
        attachDeleteListeners();

     } catch (error) {
        renderError(`無法載入商品管理列表：${error.message}`);
     }
}

async function renderAdminProductForm(productId = null) {
    if (!isAdminLoggedIn) { window.location.hash = '#/admin'; return; }
    renderLoading();

    let product = { id: null, name: '', description: '', price: '', image_url: '', seven_eleven_url: '' };
    const isEditMode = productId !== null;

    if (isEditMode) {
        try {
            product = await fetchData(`/api/products/${productId}`);
        } catch (error) {
            renderError(`無法載入商品資料 (ID: ${productId})：${error.message}`);
            return;
        }
    }

    appContainer.innerHTML = `
        <h2>${isEditMode ? '編輯商品' : '新增商品'}</h2>
        <p><a href="#/admin/products">返回商品列表</a></p>
        <div class="form-container">
            <form id="product-form">
                <input type="hidden" id="productId" name="productId" value="${product.id || ''}">
                <div class="form-group">
                    <label for="name">商品名稱:</label>
                    <input type="text" id="name" name="name" value="${product.name || ''}" required>
                </div>
                <div class="form-group">
                    <label for="description">商品描述:</label>
                    <textarea id="description" name="description">${product.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="price">價格:</label>
                    <input type="number" id="price" name="price" step="0.01" min="0" value="${product.price || ''}">
                </div>
                <div class="form-group">
                    <label for="image_url">圖片網址:</label>
                    <input type="text" id="image_url" name="image_url" placeholder="/images/your_image.jpg 或 https://..." value="${product.image_url || ''}">
                </div>
                <div class="form-group">
                    <label for="seven_eleven_url">7-11 賣貨便連結:</label>
                    <input type="text" id="seven_eleven_url" name="seven_eleven_url" value="${product.seven_eleven_url || ''}">
                </div>
                <div class="form-buttons">
                    <button type="button" onclick="window.location.hash='#/admin/products'">取消</button>
                    <button type="submit">${isEditMode ? '更新商品' : '新增商品'}</button>
                </div>
                 <p id="form-error" style="color: red; margin-top: 10px;"></p>
            </form>
        </div>
    `;

    // 添加表單提交事件
    document.getElementById('product-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const errorP = document.getElementById('form-error');
        errorP.textContent = ''; // 清除舊錯誤

        const formData = {
            name: document.getElementById('name').value,
            description: document.getElementById('description').value,
            price: document.getElementById('price').value || null, // 如果空白則為 null
            image_url: document.getElementById('image_url').value,
            seven_eleven_url: document.getElementById('seven_eleven_url').value
        };

        // 如果價格有輸入，轉為數字
        if (formData.price !== null) {
           formData.price = parseFloat(formData.price);
           if (isNaN(formData.price)) {
              errorP.textContent = '價格必須是有效的數字。';
              return;
           }
        }


        const url = isEditMode ? `/api/products/${productId}` : '/api/products';
        const method = isEditMode ? 'PUT' : 'POST';

        try {
            const result = await fetchData(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (result.success) {
                alert(`商品已成功${isEditMode ? '更新' : '新增'}！`);
                window.location.hash = '#/admin/products'; // 操作成功後跳回列表
            } else {
                 errorP.textContent = result.message || `無法${isEditMode ? '更新' : '新增'}商品`;
            }
        } catch (error) {
            errorP.textContent = error.message || `操作商品時發生錯誤`;
        }
    });
}


// --- Admin Music CRUD (與 Product 類似，你需要仿照上面來完成) ---
async function renderAdminMusicList() {
     if (!isAdminLoggedIn) { window.location.hash = '#/admin'; return; }
     renderLoading();
     try {
        const musicTracks = await fetchData('/api/music');
        let tableRows = '<tr><td colspan="7">目前沒有音樂作品。</td></tr>'; // colspan 調整為 7

        if (musicTracks && musicTracks.length > 0) {
            tableRows = musicTracks.map(track => `
                 <tr data-id="${track.id}">
                     <td>${track.id}</td>
                     <td><img src="${track.cover_art_url || '/images/placeholder.png'}" alt="${track.title}"></td>
                     <td>${track.title}</td>
                     <td>${track.artist}</td>
                     <td>${track.release_date ? new Date(track.release_date).toLocaleDateString() : ''}</td>
                     <td><a href="${track.platform_url || '#'}" target="_blank">${track.platform_url ? '連結' : ''}</a></td>
                     <td class="actions">
                         <a href="#/admin/music/edit/${track.id}">編輯</a>
                         <a href="#" class="delete-link" data-type="music" data-id="${track.id}">刪除</a>
                     </td>
                 </tr>
            `).join('');
        }

         appContainer.innerHTML = `
            <h2>管理音樂</h2>
             <p><a href="#/admin/dashboard">返回儀表板</a></p>
             <a href="#/admin/music/new" class="add-button">新增音樂</a>
             <table class="admin-table">
                 <thead>
                     <tr>
                         <th>ID</th><th>封面</th><th>標題</th><th>演出者</th><th>發行日期</th><th>平台連結</th><th>操作</th>
                     </tr>
                 </thead>
                 <tbody id="admin-list-body">
                     ${tableRows}
                 </tbody>
             </table>
        `;
         // 添加刪除事件監聽
         attachDeleteListeners();

     } catch (error) {
        renderError(`無法載入音樂管理列表：${error.message}`);
     }
}

async function renderAdminMusicForm(musicId = null) {
    if (!isAdminLoggedIn) { window.location.hash = '#/admin'; return; }
    renderLoading();

    let track = { id: null, title: '', artist: '', description: '', release_date: '', cover_art_url: '', platform_url: '' };
    const isEditMode = musicId !== null;

    if (isEditMode) {
        try {
            track = await fetchData(`/api/music/${musicId}`);
        } catch (error) {
            renderError(`無法載入音樂資料 (ID: ${musicId})：${error.message}`);
            return;
        }
    }

    // 處理日期格式， DBeaver 回傳的可能是 timestamp，input type=date 需要 YYYY-MM-DD
    let releaseDateValue = '';
    if (track.release_date) {
      try {
        releaseDateValue = new Date(track.release_date).toISOString().split('T')[0];
      } catch(e){ console.error("Error parsing release date", track.release_date)}
    }


    appContainer.innerHTML = `
        <h2>${isEditMode ? '編輯音樂' : '新增音樂'}</h2>
        <p><a href="#/admin/music">返回音樂列表</a></p>
        <div class="form-container">
            <form id="music-form">
                <input type="hidden" id="musicId" name="musicId" value="${track.id || ''}">
                <div class="form-group">
                    <label for="title">標題:</label>
                    <input type="text" id="title" name="title" value="${track.title || ''}" required>
                </div>
                 <div class="form-group">
                    <label for="artist">演出者:</label>
                    <input type="text" id="artist" name="artist" value="${track.artist || ''}" required>
                </div>
                 <div class="form-group">
                    <label for="description">簡介:</label>
                    <textarea id="description" name="description">${track.description || ''}</textarea>
                </div>
                 <div class="form-group">
                    <label for="release_date">發行日期:</label>
                    <input type="date" id="release_date" name="release_date" value="${releaseDateValue}">
                </div>
                <div class="form-group">
                    <label for="cover_art_url">封面圖片網址:</label>
                    <input type="text" id="cover_art_url" name="cover_art_url" placeholder="/images/cover.jpg 或 https://..." value="${track.cover_art_url || ''}">
                </div>
                <div class="form-group">
                    <label for="platform_url">音樂平台連結:</label>
                    <input type="text" id="platform_url" name="platform_url" placeholder="https://..." value="${track.platform_url || ''}">
                </div>
                <div class="form-buttons">
                     <button type="button" onclick="window.location.hash='#/admin/music'">取消</button>
                     <button type="submit">${isEditMode ? '更新音樂' : '新增音樂'}</button>
                </div>
                 <p id="form-error" style="color: red; margin-top: 10px;"></p>
            </form>
        </div>
    `;

     // 添加表單提交事件
    document.getElementById('music-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const errorP = document.getElementById('form-error');
        errorP.textContent = '';

        const formData = {
            title: document.getElementById('title').value,
            artist: document.getElementById('artist').value,
            description: document.getElementById('description').value,
            release_date: document.getElementById('release_date').value || null, // 如果空白則為 null
            cover_art_url: document.getElementById('cover_art_url').value,
            platform_url: document.getElementById('platform_url').value
        };

        const url = isEditMode ? `/api/music/${musicId}` : '/api/music';
        const method = isEditMode ? 'PUT' : 'POST';

        try {
            const result = await fetchData(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (result.success) {
                alert(`音樂已成功${isEditMode ? '更新' : '新增'}！`);
                window.location.hash = '#/admin/music'; // 操作成功後跳回列表
            } else {
                errorP.textContent = result.message || `無法${isEditMode ? '更新' : '新增'}音樂`;
            }
        } catch (error) {
            errorP.textContent = error.message || `操作音樂時發生錯誤`;
        }
    });
}

// --- Common Admin Functions ---
// 統一的刪除事件監聽器
function attachDeleteListeners() {
    // 使用事件委派，監聽整個列表容器
    const listBody = document.getElementById('admin-list-body');
    if (!listBody) return;

    listBody.addEventListener('click', async (event) => {
        // 檢查點擊的是否是刪除連結
        if (event.target.classList.contains('delete-link')) {
            event.preventDefault(); // 阻止預設行為

            const link = event.target;
            const type = link.getAttribute('data-type'); // 'product' or 'music'
            const id = link.getAttribute('data-id');
            const row = link.closest('tr'); // 找到對應的表格行
            // 嘗試獲取名稱/標題用於確認訊息
            const nameElement = row.querySelector('td:nth-child(3)'); // 第3個 td 通常是名稱/標題
            const name = nameElement ? nameElement.textContent : `ID ${id}`;

            if (confirm(`確定要刪除 ${type === 'product' ? '商品' : '音樂'} "${name}" (ID: ${id}) 嗎？這個操作無法復原！`)) {
                console.log(`準備刪除 ${type} ID: ${id}`);
                const url = `/api/${type}s/${id}`; // 構建 API URL
                try {
                    const result = await fetchData(url, { method: 'DELETE' });
                    if (result.success) {
                        alert(`${type === 'product' ? '商品' : '音樂'}刪除成功！`);
                        // 從畫面上移除該行，避免重新載入整個列表
                        row.remove();
                         // 可選：如果列表為空，顯示提示
                         if (listBody.children.length === 0) {
                            const colspan = type === 'product' ? 7 : 7; // 根據類型確定列數
                            listBody.innerHTML = `<tr><td colspan="${colspan}">目前沒有${type === 'product' ? '商品' : '音樂作品'}。</td></tr>`;
                         }
                    } else {
                         alert(`刪除失敗：${result.message || '未知錯誤'}`);
                    }
                } catch (error) {
                    console.error("刪除請求失敗:", error);
                    alert(`刪除過程中發生網路或程式錯誤: ${error.message}`);
                }
            } else {
                console.log('取消刪除');
            }
        }
    });
}

// 設置導覽列的活動狀態 (簡單實現)
function setActiveNav(hash) {
    // 移除所有連結的 active class
    mainNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
    // 為匹配的連結添加 active class
    const activeLink = mainNav.querySelector(`a[href="${hash}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
     // 你需要在 style.css 中定義 .active 的樣式，例如：
     // #main-nav a.active { font-weight: bold; color: #ffcc00; }
}


// --- Router ---
function handleRouteChange() {
    const hash = window.location.hash || '#/';
    console.log('Route changed to:', hash); // 調試信息

    // 移除片段標識符並分割路徑
    const pathParts = hash.substring(1).split('/'); // 例: #/admin/products/edit/5 -> ["", "admin", "products", "edit", "5"]

    // 基本路由匹配
    if (hash === '#/') {
        renderHome();
    } else if (hash === '#/products') {
        renderProductList();
    } else if (hash === '#/music') {
        renderMusicList();
    } else if (hash === '#/admin') {
        renderAdmin();
    } else if (hash === '#/admin/dashboard') {
        renderAdminDashboard();
    } else if (hash === '#/admin/products') {
        renderAdminProductList();
    } else if (hash === '#/admin/products/new') {
        renderAdminProductForm(); // 不帶 ID 調用
    } else if (pathParts[1] === 'admin' && pathParts[2] === 'products' && pathParts[3] === 'edit' && pathParts[4]) {
        renderAdminProductForm(pathParts[4]); // 帶 ID 調用
    } else if (hash === '#/admin/music') {
         renderAdminMusicList();
    } else if (hash === '#/admin/music/new') {
        renderAdminMusicForm(); // 不帶 ID
    } else if (pathParts[1] === 'admin' && pathParts[2] === 'music' && pathParts[3] === 'edit' && pathParts[4]) {
        renderAdminMusicForm(pathParts[4]); // 帶 ID
    }
    // ... 其他路由
    else {
        appContainer.innerHTML = '<h2>404 - 頁面未找到</h2>';
        setActiveNav(''); // 清除活動狀態
    }
}

// --- App Initialization ---
window.addEventListener('hashchange', handleRouteChange); // 監聽 hash 變化

// 初始頁面載入時處理路由
document.addEventListener('DOMContentLoaded', () => {
    handleRouteChange(); // 處理初始 hash
});