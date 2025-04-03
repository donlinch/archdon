document.addEventListener('DOMContentLoaded', () => {
    const productListBody = document.querySelector('#product-list-table tbody');
    const productListContainer = document.getElementById('product-list-container');
    const productTable = document.getElementById('product-list-table');
    const loadingMessage = productListContainer ? productListContainer.querySelector('p') : null;

    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-product-form');
    const editProductId = document.getElementById('edit-product-id');
    const editProductName = document.getElementById('edit-product-name');
    const editProductDescription = document.getElementById('edit-product-description');
    const editProductPrice = document.getElementById('edit-product-price');
    const editProductImageUrl = document.getElementById('edit-product-image-url');
    const editImagePreview = document.getElementById('edit-image-preview');
    const editProductSevenElevenUrl = document.getElementById('edit-product-seven-eleven-url');
    const editProductClickCount = document.getElementById('edit-product-click-count');
    const editFormError = document.getElementById('edit-form-error');

    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-product-form');
    const addProductName = document.getElementById('add-product-name');
    const addProductDescription = document.getElementById('add-product-description');
    const addProductPrice = document.getElementById('add-product-price');
    const addProductImageUrl = document.getElementById('add-product-image-url');
    const addImagePreview = document.getElementById('add-image-preview');
    const addProductSevenElevenUrl = document.getElementById('add-product-seven-eleven-url');
    const addFormError = document.getElementById('add-form-error');
    const addVariationsContainer = document.getElementById('add-variations-container');

    // --- Fetch and Display All Products ---
    async function fetchAndDisplayProducts() {
        if (!productListBody || !productListContainer || !productTable) return;
        try {
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (productTable) productTable.style.display = 'none';

            const response = await fetch('/api/products');
            if (!response.ok) { throw new Error(`HTTP 錯誤！狀態: ${response.status}`); }
            const products = await response.json();

            if (loadingMessage) loadingMessage.style.display = 'none';
            if (productTable) productTable.style.display = 'table';
            productListBody.innerHTML = '';

            if (products.length === 0) {
                productListBody.innerHTML = '<tr><td colspan="6">目前沒有商品。</td></tr>';
                return;
            }

            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td title="${product.name || ''}">${product.name || ''}</td>
                    <td style="text-align:right; padding-right: 15px;">${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
                    <td style="text-align:center;">${product.click_count !== null ? product.click_count : '0'}</td>
                    <td style="text-align:center;">
                        <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="max-width: 50px; max-height: 50px; height: auto; border: 1px solid #eee; display: inline-block; vertical-align: middle;">
                    </td>
                    <td style="text-align:center;">
                        <button class="action-btn edit-btn" onclick="window.editProduct(${product.id})">編輯</button>
                        <button class="action-btn delete-btn" onclick="window.deleteProduct(${product.id})">刪除</button>
                    </td>
                `;
                productListBody.appendChild(row);
            });
        } catch (error) {
            console.error("獲取管理商品列表失敗:", error);
            if (loadingMessage) loadingMessage.textContent = '無法載入商品列表。';
            if (productTable) productTable.style.display = 'none';
        }
    }

    // --- Open Edit Modal ---
    async function openEditModal(id) {
        if (!checkElements(editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError)) return;

        editFormError.textContent = ''; editForm.reset(); editImagePreview.style.display = 'none'; editImagePreview.src = '';

        try {
            const response = await fetch(`/api/products/${id}`);
            if (!response.ok) { throw new Error('無法獲取商品資料'); }
            const product = await response.json();

            editProductId.value = product.id;
            editProductName.value = product.name || '';
            editProductDescription.value = product.description || '';
            editProductPrice.value = product.price !== null ? product.price : '';
            editProductImageUrl.value = product.image_url || '';
            editProductSevenElevenUrl.value = product.seven_eleven_url || '';
            editProductClickCount.textContent = product.click_count !== null ? product.click_count : '0';
            if (product.image_url) { editImagePreview.src = product.image_url; editImagePreview.style.display = 'block'; } else { editImagePreview.style.display = 'none'; }

            // Fetch variations and populate them
            if (product.variations) {
                product.variations.forEach((variation, index) => {
                    window.addVariationInputRow('edit');
                    const row = document.querySelector(`#edit-variations-container .variation-input-row:nth-child(${index + 1})`);
                    if (row) {
                        row.querySelector('input[name="variations[${index}][name]"]').value = variation.name;
                        row.querySelector('input[name="variations[${index}][inventory_count]"]').value = variation.inventory_count;
                        row.querySelector('input[name="variations[${index}][sku]"]').value = variation.sku || '';
                    }
                });
            }

            editModal.style.display = 'flex';
        } catch (error) { console.error(`獲取商品 ${id} 編輯資料出錯:`, error); alert(`無法載入編輯資料： ${error.message}`); }
    }

    // --- Handle Add Product Form Submission ---
    addForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value);
        const newProductData = {
            name: addProductName.value.trim(),
            description: addProductDescription.value.trim(),
            price: priceValue,
            image_url: addProductImageUrl.value.trim() || null,
            seven_eleven_url: addProductSevenElevenUrl.value.trim() || null,
            variations: [] // Initialize variations array
        };

        const variationRows = addVariationsContainer.querySelectorAll('.variation-input-row');
        variationRows.forEach((row, index) => {
            const name = row.querySelector(`input[name="variations[${index}][name]"]`).value.trim();
            const inventoryCount = parseInt(row.querySelector(`input[name="variations[${index}][inventory_count]"]`).value.trim());
            const sku = row.querySelector(`input[name="variations[${index}][sku]"]`).value.trim();

            if (name && !isNaN(inventoryCount)) {
                newProductData.variations.push({ name, inventory_count: inventoryCount, sku });
            }
        });

        try {
            const response = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProductData) });
            if (!response.ok) {
                throw new Error('新增商品失敗');
            }
            closeAddModal();
            await fetchAndDisplayProducts();
        } catch (error) {
            addFormError.textContent = `新增錯誤：${error.message}`;
        }
    });

    // --- Helper Functions ---
    function closeModal() { if (editModal) { editModal.style.display = 'none'; } }
    function closeAddModal() { if (addModal) { addModal.style.display = 'none'; } }

    window.editProduct = openEditModal;
    window.deleteProduct = async function(id) {
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) {
            try {
                const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    await fetchAndDisplayProducts();
                } else {
                    throw new Error(`刪除失敗`);
                }
            } catch (error) {
                alert(`刪除商品時發生錯誤：${error.message}`);
            }
        }
    };

    fetchAndDisplayProducts();
});
