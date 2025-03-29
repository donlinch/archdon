// public/app.js (完整版 - 前台 SPA + 前台刪除按鈕)

const appContainer = document.getElementById('app');
const mainNav = document.getElementById('main-nav'); // For active link styling
const apiBaseUrl = ''; // Assuming same origin

// --- Helper Functions ---
async function fetchData(url, options = {}) {
    try {
        // *** CRITICAL: Include credentials to send session cookie (for admin actions like delete) ***
        const fetchOptions = {
            ...options,
            credentials: 'include'
        };
        // Debug log to confirm execution and credentials option
        console.log("DEBUG: fetchData in app.js is executing. URL:", url, "Options:", fetchOptions);
        const response = await fetch(apiBaseUrl + url, fetchOptions);
        if (!response.ok) {
            let errorData;
            try { errorData = await response.json(); } catch (parseError) { throw new Error(`HTTP error! status: ${response.status}`); }
            const message = errorData.message || `HTTP error! status: ${response.status}`;
            console.error('API Error:', message, 'URL:', url, 'Options:', fetchOptions);
            throw new Error(message);
        }
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) { return await response.json(); }
        return { success: true, status: response.status }; // For non-JSON success responses
    } catch (error) {
        console.error('Fetch Error:', error, 'URL:', url, 'Options:', options); // Log original options for clarity
        throw error;
    }
}

function renderLoading() {
    if (appContainer) appContainer.innerHTML = '<div class="admin-section" style="text-align:center;"><p>正在載入...</p></div>'; // Use a container for consistency
}

function renderError(message) {
     if (appContainer) appContainer.innerHTML = `<div class="admin-section" style="text-align:center;"><p style="color: red;">錯誤：${message}</p></div>`;
}

// --- View Rendering Functions ---

function renderHome() {
    if (!appContainer) return;
    appContainer.innerHTML = `
        <div class="admin-section"> {/* You can reuse admin-section for similar styling */}
            <h2>歡迎來到 SunnyYummy！</h2>
            <p>這裡是我們的展示網站。</p>
             <p class="api-links" style="margin-top: 20px;">
                <a href="#/products" class="admin-button">查看商品</a>
                <a href="#/music" class="admin-button">查看音樂</a>
                <a href="/admin" class="admin-button">前往後台</a> {/* Direct link to /admin */}
            </p>
        </div>
    `;
    setActiveNav('#/');
}


async function renderProductList() {
    if (!appContainer) return;
    renderLoading();
    try {
        const products = await fetchData('/api/products');
        let content = '';
        if (!products || products.length === 0) {
            content = '<p>目前沒有商品。</p>';
        } else {
            const productCards = products.map(product => `
                <div class="product-card" data-product-id="${product.id}">
                    <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name}">
                    <h3>${product.name}</h3>
                    <p>${product.description || ''}</p>
                    <p class="price">價格: $${product.price !== null ? product.price : '洽詢'}</p>
                    <div class="card-buttons" style="margin-top: 10px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                        ${product.seven_eleven_url ? `<a href="${product.seven_eleven_url}" class="button admin-button" target="_blank" rel="noopener noreferrer">前往 7-11 預購</a>` : ''}
                        {/* Delete Button - styled similarly */}
                        <button class="delete-product-btn admin-button delete-btn" data-id="${product.id}">刪除</button>
                    </div>
                </div>
            `).join('');
             content = `<div id="product-list" class="product-list">${productCards}</div>`; // Use class for flex styling
        }

        appContainer.innerHTML = `
            <div class="admin-section">
                <h2>商品列表</h2>
                ${content}
            </div>`;
        setActiveNav('#/products');
        // Delete listener is attached globally via delegation
    } catch (error) {
        renderError(`無法載入商品列表：${error.message}`);
        setActiveNav('#/products');
    }
}

async function renderMusicList() {
    if (!appContainer) return;
    renderLoading();
    try {
        const musicTracks = await fetchData('/api/music');
         let content = '';
        if (!musicTracks || musicTracks.length === 0) {
            content = '<p>目前沒有音樂作品。</p>';
        } else {
            const musicCards = musicTracks.map(track => {
                let releaseDateStr = '';
                if (track.release_date) { try { releaseDateStr = new Date(track.release_date).toLocaleDateString(); } catch(e){} }
                return `
                <div class="product-card music-card">
                    <img src="${track.cover_art_url || '/images/placeholder.png'}" alt="${track.title}">
                    <h3>${track.title}</h3>
                    <p>演出者: ${track.artist}</p>
                    ${releaseDateStr ? `<p>發行日期: ${releaseDateStr}</p>` : ''}
                    <p>${track.description || ''}</p>
                    ${track.platform_url ? `<a href="${track.platform_url}" class="button admin-button" target="_blank" rel="noopener noreferrer">前往收聽</a>` : ''}
                </div>
                `}).join('');
             content = `<div id="music-list" class="product-list">${musicCards}</div>`;
        }

        appContainer.innerHTML = `
             <div class="admin-section">
                <h2>音樂列表</h2>
                ${content}
             </div>`;
        setActiveNav('#/music');
    } catch (error) {
        renderError(`無法載入音樂列表：${error.message}`);
         setActiveNav('#/music');
    }
}


// Set active state for navigation links
function setActiveNav(hash) {
    if (!mainNav) return;
    mainNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
    const activeLink = mainNav.querySelector(`a[href="${hash}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    // Add style rule in style.css: #main-nav a.active { font-weight: bold; /* or other styles */ }
}

// --- Frontend Delete Button Handler ---
async function handleFrontendDeleteClick(event) {
    // Target only the delete buttons within the #app container
    if (event.target.classList.contains('delete-product-btn') && appContainer && appContainer.contains(event.target)) {
        event.preventDefault();

        const button = event.target;
        const productId = button.getAttribute('data-id');
        const card = button.closest('.product-card');
        const productNameElement = card ? card.querySelector('h3') : null;
        const productName = productNameElement ? productNameElement.textContent : `ID ${productId}`;

        if (!productId || !card) {
            console.error("Could not get product ID or card for deletion.");
            return;
        }

        if (confirm(`【前台操作】確定要刪除商品 "${productName}" (ID: ${productId}) 嗎？\n（注意：此操作需要管理員權限）`)) {
            console.log(`[Frontend] Attempting to delete product ID: ${productId}`);
            const url = `/api/products/${productId}`;
            try {
                // fetchData includes credentials: 'include'
                const result = await fetchData(url, { method: 'DELETE' });
                if (result.success) {
                    alert(`商品 "${productName}" 刪除成功！`);
                    card.remove(); // Remove the card from the DOM

                    // Check if the list is now empty
                    const productList = document.getElementById('product-list');
                    if (productList && productList.children.length === 0) {
                         // Check if appContainer exists and contains productList before modifying innerHTML
                         if (appContainer && appContainer.contains(productList)) {
                             // Re-render the empty state within the section
                             appContainer.innerHTML = `
                                <div class="admin-section">
                                    <h2>商品列表</h2>
                                    <p>目前沒有商品。</p>
                                </div>`;
                         }
                    }
                } else {
                    // API returned a failure JSON (e.g., 404 Not Found - should not happen for DELETE if ID exists)
                    alert(`刪除失敗：${result.message || '未知錯誤'}`);
                }
            } catch (error) {
                // fetchData caught an error (e.g., 401 Unauthorized, 500 Server Error, Network Error)
                console.error("[Frontend] Delete request failed:", error);
                alert(`刪除過程中發生錯誤: ${error.message}`); // error.message usually contains the reason (like 'Unauthorized...')
            }
        } else {
            console.log('[Frontend] Deletion cancelled');
        }
    }
}


// --- Router ---
function handleRouteChange() {
    if (!appContainer) {
        console.error("App container not found!");
        return;
    }
    const hash = window.location.hash || '#/';
    console.log('Frontend Route changed to:', hash);

    if (hash === '#/') {
        renderHome();
    } else if (hash === '#/products') {
        renderProductList();
    } else if (hash === '#/music') {
        renderMusicList();
    } else if (hash === '#/admin') {
         // Provide a link to the separate admin page
         appContainer.innerHTML = `<div class="admin-section"><h2>管理後台</h2><p><a href="/admin" class="admin-button">點擊這裡進入管理後台頁面。</a></p></div>`;
         setActiveNav(''); // No specific nav link for this message
    } else {
        // Handle unknown hash routes
        appContainer.innerHTML = `<div class="admin-section"><h2>404 - 頁面未找到</h2><p>您想訪問的頁面不存在。</p></div>`;
        setActiveNav('');
    }
}

// --- App Initialization ---
window.addEventListener('hashchange', handleRouteChange);

document.addEventListener('DOMContentLoaded', () => {
    if (!mainNav) {
        console.warn("Main navigation container '#main-nav' not found.");
    }
     // Use event delegation on the #app container for delete buttons
    if (appContainer) {
        // Remove listener first to prevent duplicates if script re-runs in some environments
        appContainer.removeEventListener('click', handleFrontendDeleteClick);
        appContainer.addEventListener('click', handleFrontendDeleteClick);
    } else {
        console.error("App container not found! Cannot attach delete listener.");
    }

    handleRouteChange(); // Process the initial hash route on page load
});