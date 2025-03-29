// public/app.js (SPA Rebuild - Step 1: Basic Routing and Product List)

const appContainer = document.getElementById('app');
const mainNav = document.getElementById('main-nav');
const apiBaseUrl = ''; // Assuming API is on the same origin

// --- Helper Functions ---
async function fetchData(url, options = {}) {
    // Basic fetch wrapper, no credentials needed for public GET yet
    // Keep the debug log from previous attempts, it's useful
    console.log("DEBUG: fetchData in app.js is executing. URL:", url, "Options:", options);
    try {
        const response = await fetch(apiBaseUrl + url, options);
        if (!response.ok) {
            let errorData;
            try { errorData = await response.json(); } catch (parseError) { throw new Error(`HTTP error! status: ${response.status}`); }
            const message = errorData.message || `HTTP error! status: ${response.status}`;
            console.error('API Error:', message, 'URL:', url, 'Options:', options);
            throw new Error(message);
        }
        // Only parse JSON if the content type is correct
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        // Return success for non-JSON responses (might be useful later)
        return { success: true, status: response.status };
    } catch (error) {
        console.error('Fetch Error:', error, 'URL:', url, 'Options:', options);
        throw error; // Re-throw error to be caught by the caller
    }
}

function renderLoading(container = appContainer) {
    if (container) container.innerHTML = '<div class="admin-section" style="text-align:center;"><p>正在載入...</p></div>';
}

function renderError(message, container = appContainer) {
     if (container) container.innerHTML = `<div class="admin-section" style="text-align:center;"><p style="color: red;">錯誤：${message}</p></div>`;
}

// --- View Rendering Functions ---

function renderHome() {
    if (!appContainer) return;
    appContainer.innerHTML = `
        <div class="admin-section"> {/* Reusing style class */}
            <h2>歡迎來到 SunnyYummy！</h2>
            <p>這裡是我們的展示網站。</p>
             <p class="api-links" style="margin-top: 20px;">
                <a href="#/products" class="admin-button">查看商品</a>
                <a href="#/music" class="admin-button">查看音樂</a>
                {/* Link to trigger admin route - which will eventually render login/dashboard */}
                <a href="#/admin" class="admin-button">後台管理</a>
            </p>
        </div>
    `;
    setActiveNav('#/');
}

// Function to render the product list view
async function renderProductList() {
    if (!appContainer) return;
    renderLoading(); // Show loading message first
    try {
        // Fetch products from the minimal API
        const products = await fetchData('/api/products');

        let content = '';
        if (!products || products.length === 0) {
            content = '<p>目前沒有商品可供展示。</p>';
        } else {
            // Generate HTML for each product card
            const productCards = products.map(product => `
                <div class="product-card" data-product-id="${product.id}">
                    <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name}">
                    <h3>${product.name}</h3>
                    <p>${product.description || ''}</p>
                    <p class="price">價格: $${product.price !== null ? product.price : '洽詢'}</p>
                    <div class="card-buttons" style="margin-top: 10px;">
                        ${product.seven_eleven_url ? `<a href="${product.seven_eleven_url}" class="button admin-button" target="_blank" rel="noopener noreferrer">前往 7-11 預購</a>` : ''}
                        {/* We'll add delete/edit buttons later when admin auth is ready */}
                    </div>
                </div>
            `).join('');
            content = `<div id="product-list" class="product-list">${productCards}</div>`;
        }

        // Update the main content area
        appContainer.innerHTML = `
            <div class="admin-section">
                <h2>商品列表</h2>
                ${content}
            </div>`;
        setActiveNav('#/products');

    } catch (error) {
        // Display error message if fetch fails
        renderError(`無法載入商品列表：${error.message}`);
        setActiveNav('#/products'); // Still highlight the nav link
    }
}

// Placeholder for music list (to be implemented)
function renderMusicList() {
     if (!appContainer) return;
     appContainer.innerHTML = `
        <div class="admin-section">
            <h2>音樂列表</h2>
            <p>此功能待開發...</p>
        </div>`;
    setActiveNav('#/music');
}

// Placeholder for admin section (to be implemented)
function renderAdminSection() {
     if (!appContainer) return;
     appContainer.innerHTML = `
        <div class="admin-section">
            <h2>後台管理</h2>
            <p>後台登入及管理功能待開發...</p>
            {/* Login form will be rendered here */}
        </div>`;
    setActiveNav('#/admin');
}


// --- Navigation Styling ---
function setActiveNav(hash) {
    if (!mainNav) return;
    mainNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
    // Use attribute selector for precise matching including the hash
    const activeLink = mainNav.querySelector(`a[href="${hash}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    // Add style rule in style.css: #main-nav a.active { font-weight: bold; /* or other styles */ }
}

// --- Router ---
function handleRouteChange() {
    if (!appContainer) {
        console.error("App container not found!");
        return;
    }
    const hash = window.location.hash || '#/';
    console.log('SPA Route changed to:', hash);

    // Basic hash routing
    if (hash === '#/') {
        renderHome();
    } else if (hash === '#/products') {
        renderProductList();
    } else if (hash === '#/music') {
        renderMusicList(); // Call placeholder
    } else if (hash === '#/admin') {
        renderAdminSection(); // Call placeholder
    }
    // Add more routes here later (e.g., #/admin/dashboard, #/admin/products/edit/:id)
    else {
        // Handle unknown hash routes
        appContainer.innerHTML = `<div class="admin-section"><h2>404 - 頁面未找到</h2><p>您想訪問的頁面不存在。</p></div>`;
        setActiveNav(''); // Clear active nav
    }
}

// --- App Initialization ---
// Add hashchange listener
window.addEventListener('hashchange', handleRouteChange);

// Handle initial page load
document.addEventListener('DOMContentLoaded', () => {
    if (!mainNav) {
        console.warn("Main navigation container '#main-nav' not found.");
    }
    if (!appContainer) {
        console.error("Fatal Error: App container '#app' not found on DOMContentLoaded!");
        document.body.innerHTML = "<p style='color:red; text-align: center; margin-top: 50px;'>頁面結構錯誤，無法初始化應用程式。</p>";
        return;
    }
    // No global click listeners needed yet (like delete)
    handleRouteChange(); // Process the initial hash route on page load
});