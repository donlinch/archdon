// public/app.js (SPA Rebuild - With Modal Editing for Products)

const appContainer = document.getElementById('app');
const mainNav = document.getElementById('main-nav');
const apiBaseUrl = ''; // Assuming same origin

// --- DOM Elements for Modal ---
const modal = document.getElementById('edit-product-modal');
const modalForm = document.getElementById('edit-product-form');
const modalProductIdInput = document.getElementById('edit-product-id');
const modalErrorP = document.getElementById('edit-form-error');

// --- Helper Functions ---
async function fetchData(url, options = {}) {
    // Includes credentials: 'include' for potential future use or consistency
    // Includes debug log
    console.log("DEBUG: fetchData in app.js is executing. URL:", url, "Options:", options);
    try {
        const fetchOptions = {
            ...options,
            credentials: 'include' // Important for sending cookies if auth is added later
        };
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
        return { success: true, status: response.status };
    } catch (error) {
        console.error('Fetch Error:', error, 'URL:', url, 'Options:', options);
        throw error;
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
        <div class="admin-section">
            <h2>歡迎來到 SunnyYummy！</h2>
            <p>這裡是我們的展示網站。</p>
             <p class="api-links" style="margin-top: 20px;">
                <a href="#/products" class="admin-button">查看商品</a>
                <a href="#/music" class="admin-button">查看音樂</a>
                <a href="#/admin" class="admin-button">後台管理</a> {/* SPA route target */}
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
            content = '<p>目前沒有商品可供展示。</p>';
        } else {
            const productCards = products.map(product => `
                {/* Add unique IDs to elements within the card for easy update */}
                <div class="product-card" data-product-id="${product.id}">
                    <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name}" id="img-${product.id}">
                    <h3 id="name-${product.id}">${product.name}</h3>
                    <p id="desc-${product.id}">${product.description || ''}</p>
                    <p class="price" id="price-${product.id}">價格: $${product.price !== null ? product.price : '洽詢'}</p>
                    <div class="card-buttons" style="margin-top: 10px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                        <a href="${product.seven_eleven_url || '#'}" target="_blank" rel="noopener noreferrer" class="button admin-button ${product.seven_eleven_url ? '' : 'disabled'}" id="link-${product.id}" ${product.seven_eleven_url ? '' : 'style="pointer-events: none; background-color: #ccc;"'}>${product.seven_eleven_url ? '前往 7-11 預購' : '無連結'}</a>
                        {/* Edit Button */}
                        <button class="edit-product-btn admin-button edit-btn" data-id="${product.id}">編輯</button>
                        {/* Delete button can be added here if needed later */}
                    </div>
                </div>
            `).join('');
            content = `<div id="product-list" class="product-list">${productCards}</div>`;
        }
        appContainer.innerHTML = `<div class="admin-section"><h2>商品列表</h2>${content}</div>`;
        setActiveNav('#/products');
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
                    {/* Edit button for music could be added here similarly */}
                </div>
                `}).join('');
             content = `<div id="music-list" class="product-list">${musicCards}</div>`;
        }
        appContainer.innerHTML = `<div class="admin-section"><h2>音樂列表</h2>${content}</div>`;
        setActiveNav('#/music');
    } catch (error) {
        renderError(`無法載入音樂列表：${error.message}`);
         setActiveNav('#/music');
    }
}

// Placeholder for admin section - will eventually show login or dashboard
function renderAdminSection() {
     if (!appContainer) return;
     appContainer.innerHTML = `
        <div class="admin-section">
            <h2>後台管理</h2>
            <p>後台登入及管理功能待開發...</p>
            {/* Login form or dashboard will be rendered here based on auth status */}
        </div>`;
    setActiveNav('#/admin');
    // TODO: Implement login check and render login form or dashboard
}


// --- Navigation Styling ---
function setActiveNav(hash) {
    if (!mainNav) return;
    mainNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
    const activeLink = mainNav.querySelector(`a[href="${hash}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// --- Modal Logic ---

async function openEditModal(productId) {
    if (!modal || !modalForm || !modalErrorP || !modalProductIdInput) {
        console.error("Modal elements not found!");
        return;
    }
    console.log(`Opening edit modal for product ID: ${productId}`);
    modalErrorP.textContent = ''; // Clear previous errors
    modalForm.reset(); // Reset form fields

    try {
        const product = await fetchData(`/api/products/${productId}`); // Fetch current data

        modalProductIdInput.value = product.id;
        modalForm.querySelector('#edit-product-name').value = product.name || '';
        modalForm.querySelector('#edit-product-description').value = product.description || '';
        modalForm.querySelector('#edit-product-price').value = product.price ?? '';
        modalForm.querySelector('#edit-product-image_url').value = product.image_url || '';
        modalForm.querySelector('#edit-product-seven_eleven_url').value = product.seven_eleven_url || '';

        modal.style.display = 'block'; // Show the modal

    } catch (error) {
        console.error(`Failed to load product data for modal (ID: ${productId}):`, error);
        // Display error outside the modal if it fails to load
        renderError(`無法載入編輯資料：${error.message}`, appContainer);
    }
}

// Function provided globally in index.html via onclick, but good practice to define it
window.closeEditModal = function() { // Assign to window to make it globally accessible from inline onclick
    if (modal) {
        modal.style.display = 'none';
    }
    if (modalErrorP) modalErrorP.textContent = '';
}

async function handleEditFormSubmit(event) {
    event.preventDefault();
    if (!modalForm || !modalErrorP) { console.error("Modal form elements missing!"); return;}

    modalErrorP.textContent = '';
    const formData = new FormData(modalForm);
    const productData = Object.fromEntries(formData.entries());
    const productId = productData.productId;

    if (!productId) { modalErrorP.textContent = '錯誤：找不到商品 ID。'; return; }

    productData.price = productData.price ? parseFloat(productData.price) : null;
    if (productData.price !== null && isNaN(productData.price)) {
        modalErrorP.textContent = '價格必須是有效的數字。'; return;
    }
    delete productData.productId;

    console.log(`Submitting update for product ID: ${productId} with data:`, productData);

    try {
        // PUT /api/products/:id is temporarily without requireAdmin in server.js
        const result = await fetchData(`/api/products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });

        if (result.success && result.product) {
            alert('商品更新成功！');
            closeEditModal();

            // Dynamically update the product card in the list
            const updatedProduct = result.product;
            // Find the card using querySelector and the data attribute
            const card = appContainer.querySelector(`.product-card[data-product-id="${productId}"]`);
            if (card) {
                 const nameEl = card.querySelector(`#name-${productId}`);
                 const descEl = card.querySelector(`#desc-${productId}`);
                 const priceEl = card.querySelector(`#price-${productId}`);
                 const imgEl = card.querySelector(`#img-${productId}`);
                 const linkEl = card.querySelector(`#link-${productId}`); // Use the ID added in renderProductList

                 if (nameEl) nameEl.textContent = updatedProduct.name;
                 if (descEl) descEl.textContent = updatedProduct.description || '';
                 if (priceEl) priceEl.textContent = `價格: $${updatedProduct.price !== null ? updatedProduct.price : '洽詢'}`;
                 if (imgEl) imgEl.src = updatedProduct.image_url || '/images/placeholder.png';
                 if (linkEl) {
                     linkEl.href = updatedProduct.seven_eleven_url || '#';
                     linkEl.textContent = updatedProduct.seven_eleven_url ? '前往 7-11 預購' : '無連結';
                      // Update disabled state/style for the link based on URL presence
                      if (updatedProduct.seven_eleven_url) {
                        linkEl.classList.remove('disabled'); // Assuming 'disabled' class controls appearance
                        linkEl.style.pointerEvents = 'auto';
                        linkEl.style.backgroundColor = ''; // Reset or set to default button color
                      } else {
                        linkEl.classList.add('disabled');
                        linkEl.style.pointerEvents = 'none';
                        linkEl.style.backgroundColor = '#ccc'; // Example disabled style
                      }
                 }
            } else {
                 console.warn(`Card for product ID ${productId} not found in the current view for update.`);
                 // Optional: If the card isn't found (maybe user navigated away?),
                 // we might just skip the dynamic update or force a list refresh on next view.
            }

        } else {
            // Display error within the modal
            modalErrorP.textContent = result.message || '無法更新商品';
        }
    } catch (error) {
        // Display error within the modal
        modalErrorP.textContent = `更新過程中發生錯誤: ${error.message}`;
    }
}

// --- Global Event Listeners ---

function handleGlobalClick(event) {
    // Handle Edit Button Clicks using event delegation on #app
    if (event.target.classList.contains('edit-product-btn')) {
        const productId = event.target.getAttribute('data-id');
        if (productId) {
            openEditModal(productId);
        }
    }

    // Note: Modal overlay click is handled by inline onclick in index.html now
    // Note: Delete button click listener removed (add back if needed)
}

// --- Router ---
function handleRouteChange() {
    if (!appContainer) { console.error("App container not found!"); return; }
    const hash = window.location.hash || '#/';
    console.log('SPA Route changed to:', hash);

    // Close modal on route change (optional, but good practice)
    closeEditModal();

    if (hash === '#/') { renderHome(); }
    else if (hash === '#/products') { renderProductList(); }
    else if (hash === '#/music') { renderMusicList(); }
    else if (hash === '#/admin') { renderAdminSection(); }
    else {
        appContainer.innerHTML = `<div class="admin-section"><h2>404 - 頁面未找到</h2><p>您想訪問的頁面不存在。</p></div>`;
        setActiveNav('');
    }
}

// --- App Initialization ---
window.addEventListener('hashchange', handleRouteChange);

document.addEventListener('DOMContentLoaded', () => {
    if (!mainNav) { console.warn("Main navigation container '#main-nav' not found."); }
    if (!appContainer) { console.error("Fatal Error: App container '#app' not found!"); return; }
    if (!modal) { console.warn("Edit product modal '#edit-product-modal' not found!");}
    if (!modalForm) { console.warn("Edit product form '#edit-product-form' not found!");}
    else {
        // Add submit listener to the modal form once
        modalForm.addEventListener('submit', handleEditFormSubmit);
    }

    // Add global click listener for edit buttons (using delegation is efficient)
    // We listen on body or a persistent container like #app
    document.body.addEventListener('click', handleGlobalClick);

    // Handle initial route on page load
    handleRouteChange();
});