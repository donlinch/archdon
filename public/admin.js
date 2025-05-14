// public/admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References (商品列表和 Modal) ---
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
    const editProductCategory = document.getElementById('edit-product-category');
    const editFormError = document.getElementById('edit-form-error');
    const editExistingCategoriesDiv = document.getElementById('edit-existing-categories');
    // 標籤相關元素 - 編輯表單
    const editTagsContainer = document.getElementById('edit-tags-container');
    // 編輯商品表單的期限相關元素
    const editExpirationType = document.getElementById('edit-expiration-type');
    const editDateRangeGroup = document.getElementById('edit-date-range-group');
    const editStartDate = document.getElementById('edit-start-date');
    const editEndDate = document.getElementById('edit-end-date');

    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-product-form');
    const addProductName = document.getElementById('add-product-name');
    const addProductDescription = document.getElementById('add-product-description');
    const addProductPrice = document.getElementById('add-product-price');
    const addProductCategory = document.getElementById('add-product-category');
    const addProductImageUrl = document.getElementById('add-product-image-url');
    const addProductSevenElevenUrl = document.getElementById('add-product-seven-eleven-url');
    const addFormError = document.getElementById('add-form-error');
    const addExistingCategoriesDiv = document.getElementById('add-existing-categories');
    // 標籤相關元素 - 新增表單
    const addTagsContainer = document.getElementById('add-tags-container');
    // 新增商品表單的期限相關元素
    const addExpirationType = document.getElementById('add-expiration-type');
    const addDateRangeGroup = document.getElementById('add-date-range-group');
    const addStartDate = document.getElementById('add-start-date');
    const addEndDate = document.getElementById('add-end-date');
    
    const categoryOptionsDatalist = document.getElementById('categoryOptions');

    // 標籤管理相關元素
    const tagManagementSection = document.getElementById('tag-management-section');
    const tagsList = document.getElementById('tags-list');
    const addTagForm = document.getElementById('add-tag-form');
    const addTagInput = document.getElementById('add-tag-input');
    const tagManagementError = document.getElementById('tag-management-error');

    // --- *** 圖表相關元素 *** ---
    const trafficChartCanvas = document.getElementById('traffic-chart');
    const pageRankingChartCanvas = document.getElementById('page-ranking-chart');
    const pageComparisonChartCanvas = document.getElementById('page-comparison-chart');
    const chartLoadingMsg = document.getElementById('chart-loading-msg');
    const chartErrorMsg = document.getElementById('chart-error-msg');
    const btnDaily = document.getElementById('btn-daily');
    const btnMonthly = document.getElementById('btn-monthly');
    
    // 日期選擇器和頁面對比相關元素
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const applyDateBtn = document.getElementById('apply-date');
    const resetDateBtn = document.getElementById('reset-date');
    const pageSelectMulti = document.getElementById('page-select');
    const updateComparisonBtn = document.getElementById('update-comparison');
    
    // 圖表實例追蹤
    let currentChart = null;
    let pageRankingChart = null;
    let pageComparisonChart = null;
    let currentGranularity = 'daily';
    
    // 時間範圍追蹤
    let currentTimeRange = {
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    };

    // --- Event Listeners for Expiration Type Change ---
    if (addExpirationType && addDateRangeGroup) {
        addExpirationType.addEventListener('change', function() {
            addDateRangeGroup.style.display = this.value === '1' ? 'block' : 'none';
            if (this.value === '0') { // 如果是不限期，清空日期
                if(addStartDate) addStartDate.value = '';
                if(addEndDate) addEndDate.value = '';
            }
        });
    }

    if (editExpirationType && editDateRangeGroup) {
        editExpirationType.addEventListener('change', function() {
            editDateRangeGroup.style.display = this.value === '1' ? 'block' : 'none';
            if (this.value === '0') { // 如果是不限期，清空日期
                if(editStartDate) editStartDate.value = '';
                if(editEndDate) editEndDate.value = '';
            }
        });
    }

    // 初始化日期選擇器的值
    function initializeDatePickers() {
        if (startDateInput && endDateInput) {
            startDateInput.value = currentTimeRange.startDate;
            endDateInput.value = currentTimeRange.endDate;
        }
    }

    // --- Function to Fetch and Display ALL Products in the Table ---
    async function fetchAndDisplayProducts() {
        if (!productListBody || !productListContainer || !productTable) { 
            console.error("Admin page table elements not found."); 
            if(loadingMessage) loadingMessage.textContent = '頁面結構錯誤，無法載入列表。'; 
            return; 
        } 
        
        try { 
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (productTable) productTable.style.display = 'none';
            
            const response = await fetch('/api/storemarket/products'); // <--- 修改 API 路徑
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
            } 
            
            const products = await response.json(); 
            if (loadingMessage) loadingMessage.style.display = 'none'; 
            if (productTable) productTable.style.display = 'table'; 
            
            productListBody.innerHTML = '';
            if (products.length === 0) {
                productListBody.innerHTML = '<tr><td colspan="11">目前沒有商品。</td></tr>'; // Updated colspan
                return;
            }
            
            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;

                // Helper to format date as YYYY-MM-DD, or return 'N/A'
                const formatDate = (dateString) => {
                    if (!dateString) return 'N/A';
                    try {
                        const date = new Date(dateString);
                        // Check if date is valid after parsing
                        if (isNaN(date.getTime())) return 'N/A';
                        return date.toISOString().split('T')[0];
                    } catch (e) {
                        return 'N/A'; // Handle invalid date strings
                    }
                };

                const startDateDisplay = product.expiration_type === 1 ? formatDate(product.start_date) : 'N/A';
                const endDateDisplay = product.expiration_type === 1 ? formatDate(product.end_date) : 'N/A';

                row.innerHTML = `
                    <td>${product.id}</td>
                    <td>${product.name || ''}</td>
                    <td>${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
                    <td>${product.click_count !== null ? product.click_count : '0'}</td>
                    <td>${product.category || '未分類'}</td>
                    <td><img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="width: 50px; height: auto; border: 1px solid #eee;"></td>
                    <td>${product.product_status || 'N/A'}</td>
                    <td>${startDateDisplay}</td>
                    <td>${endDateDisplay}</td>
                    <td>${product.tags && product.tags.length ? product.tags.map(tag =>
                         `<span class="product-tag">${tag}</span>`).join('') : '無標籤'}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editProduct(${product.id})">編輯</button>
                        <button class="action-btn delete-btn" onclick="deleteProduct(${product.id})">刪除</button>
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

    // --- Function to Open and Populate the Edit Modal ---
    async function openEditModal(id) {
        const requiredEditElements = [editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editProductCategory, editFormError]; 
        
        if (requiredEditElements.some(el => !el)) { 
            console.error("一個或多個編輯 Modal 元件在 HTML 中缺失。"); 
            alert("編輯視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。"); 
            return; 
        } 
        
        editFormError.textContent = ''; 
        editForm.reset(); 
        editImagePreview.style.display = 'none'; 
        editImagePreview.src = ''; 
        
        try { 
            const response = await fetch(`/api/products/${id}`); 
            if (!response.ok) { 
                if (response.status === 404) throw new Error('找不到該商品。'); 
                throw new Error(`無法獲取商品資料 (HTTP ${response.status})`); 
            } 
            
            const product = await response.json(); 
            editProductId.value = product.id; 
            editProductName.value = product.name || ''; 
            editProductDescription.value = product.description || ''; 
            editProductPrice.value = product.price !== null ? product.price : ''; 
            editProductImageUrl.value = product.image_url || ''; 
            editProductSevenElevenUrl.value = product.seven_eleven_url || ''; 
            editProductClickCount.textContent = product.click_count !== null ? product.click_count : '0'; 
            editProductCategory.value = product.category || '';
            
            if (product.image_url) { 
                editImagePreview.src = product.image_url; 
                editImagePreview.style.display = 'block'; 
            } else { 
                editImagePreview.style.display = 'none'; 
            } 
            
            // 填充標籤選項
            if (editTagsContainer) {
                await populateTagCheckboxes(editTagsContainer, product.tags || []);
            }

            // --- 填充並處理商品期限欄位 ---
            if (editExpirationType) {
                editExpirationType.value = product.expiration_type !== undefined ? product.expiration_type.toString() : '0';
            }
            if (editStartDate) {
                // 確保 product.start_date 存在且是有效日期字串才嘗試 split
                editStartDate.value = product.start_date && typeof product.start_date === 'string' ? product.start_date.split('T')[0] : '';
            }
            if (editEndDate) {
                editEndDate.value = product.end_date && typeof product.end_date === 'string' ? product.end_date.split('T')[0] : '';
            }
            if (editDateRangeGroup && editExpirationType) {
                editDateRangeGroup.style.display = editExpirationType.value === '1' ? 'block' : 'none';
            }
            // --- 期限欄位處理結束 ---
            
            editModal.style.display = 'flex';
        } catch (error) { 
            console.error(`獲取商品 ${id} 進行編輯時出錯:`, error); 
            alert(`無法載入編輯資料： ${error.message}`); 
        }
    }

    // --- Function to Close the Edit Modal ---
    window.closeModal = function() { 
        if (editModal) { 
            editModal.style.display = 'none'; 
        } 
    }

    // --- Function to Close the Add Modal ---
    window.closeAddModal = function() { 
        if (addModal) { 
            addModal.style.display = 'none'; 
        } 
    }

    // --- Attach Edit Function to Global Scope ---
    window.editProduct = function(id) { 
        openEditModal(id); 
    };


    // --- 修改：刪除商品函數 ---
    window.deleteProduct = async function(id) {
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) {
            try {
                // --- 主要更改點 ---
                const response = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
                // --- 更改結束 ---
                if (response.status === 204 || response.ok) {
                    await fetchAndDisplayProducts();
                    await fetchCategories();
                } else {
                    let errorMsg = `刪除失敗 (HTTP ${response.status})`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorMsg;
                    } catch (e) {
                        errorMsg = `${errorMsg}: ${response.statusText}`;
                    }
                    throw new Error(errorMsg);
                }
            } catch (error) {
                alert(`刪除時發生錯誤：${error.message}`);
            }
        }
    };
    // --- Attach Show Add Form Function to Global Scope ---
    window.showAddForm = function() {
        const requiredAddElements = [addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductCategory, addProductImageUrl, addProductSevenElevenUrl, addFormError]; 
        
        if (requiredAddElements.some(el => !el)) { 
            alert("新增視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。"); 
            return; 
        } 
        
        addFormError.textContent = ''; 
        addForm.reset(); 
        
        // 填充標籤選項 - 新增表單
        if (addTagsContainer) {
            populateTagCheckboxes(addTagsContainer, []);
        }
        
        addModal.style.display = 'flex';
    }











    // --- 修改：編輯商品表單提交監聽器 ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            editFormError.textContent = '';

            const productId = editProductId.value;
            if (!productId) {
                editFormError.textContent = '錯誤：找不到商品 ID。';
                return;
            }

            let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value);
            const updatedData = {
                name: editProductName.value.trim(),
                description: editProductDescription.value.trim(),
                price: priceValue,
                category: editProductCategory.value.trim() || null,
                image_url: editProductImageUrl.value.trim() || null,
                seven_eleven_url: editProductSevenElevenUrl.value.trim() || null,
                // Correctly get expiration_type from the form, or keep existing if not available (though it should be)
                expiration_type: editExpirationType ? parseInt(editExpirationType.value) : (existingProduct ? existingProduct.expiration_type : 0),
                start_date: null, // Initialize, will be set below
                end_date: null // Initialize, will be set below
            };

            // Logic for setting start_date and end_date based on expiration_type for edit
            if (updatedData.expiration_type === 1) {
                updatedData.start_date = editStartDate ? (editStartDate.value || null) : null;
                updatedData.end_date = editEndDate ? (editEndDate.value || null) : null;
            } else { // expiration_type is 0 (or other, defaulting to no specific dates)
                updatedData.start_date = null;
                updatedData.end_date = null;
            }

            if (editTagsContainer) {
                const selectedTags = [];
                const checkboxes = editTagsContainer.querySelectorAll('input[type="checkbox"]:checked');
                checkboxes.forEach(checkbox => {
                    selectedTags.push(parseInt(checkbox.value, 10));
                });
                updatedData.tags = selectedTags;
            }

            if (!updatedData.name) {
                editFormError.textContent = '商品名稱不能為空。';
                return; 
            } 
            
            if (updatedData.price !== null && isNaN(updatedData.price)) { 
                editFormError.textContent = '價格必須是有效的數字。'; 
                return; 
            } 
            
            if (updatedData.price !== null && updatedData.price < 0) { 
                editFormError.textContent = '價格不能是負數。'; 
                return; 
            } 
            
            const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'); 
            if (!isBasicUrlValid(updatedData.image_url) || !isBasicUrlValid(updatedData.seven_eleven_url)) {
                editFormError.textContent = '圖片路徑或 7-11 連結格式不正確 (應以 http://, https:// 或 / 開頭)。';
                return;
            } 
            
            try { 
                const response = await fetch(`/api/admin/products/${productId}`, {
                    method: 'PUT', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(updatedData) 
                }); 
                
                if (!response.ok) { 
                    let errorMsg = `儲存失敗 (HTTP ${response.status})`; 
                    try { 
                        const errorData = await response.json(); 
                        errorMsg = errorData.error || errorMsg; 
                    } catch (e) {} 
                    throw new Error(errorMsg); 
                } 
                
                closeModal(); 
                await fetchAndDisplayProducts();
                await fetchCategories();
            } catch (error) { 
                editFormError.textContent = `儲存錯誤：${error.message}`; 
            }
        });
    } else { 
        console.error("編輯表單元素未找到。"); 
    }

 
    // --- 修改：新增商品表單提交監聽器 ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            addFormError.textContent = '';

            let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value);
            const newData = {
                name: addProductName.value.trim(),
                description: addProductDescription.value.trim(),
                price: priceValue,
                category: addProductCategory.value.trim() || null,
                image_url: addProductImageUrl.value.trim() || null,
                seven_eleven_url: addProductSevenElevenUrl.value.trim() || null,
                expiration_type: addExpirationType ? parseInt(addExpirationType.value) : 0,
                start_date: addStartDate && addExpirationType && addExpirationType.value === '1' ? (addStartDate.value || null) : null,
                end_date: addEndDate && addExpirationType && addExpirationType.value === '1' ? (addEndDate.value || null) : null
            };

            if (addTagsContainer) {
                const selectedTags = [];
                const checkboxes = addTagsContainer.querySelectorAll('input[type="checkbox"]:checked');
                checkboxes.forEach(checkbox => {
                    selectedTags.push(parseInt(checkbox.value, 10));
                });
                newData.tags = selectedTags;
            }

            if (!newData.name) {
                addFormError.textContent = '商品名稱不能為空。';
                return;
            }
        
        if (newData.price !== null && isNaN(newData.price)) { 
            addFormError.textContent = '價格必須是有效的數字。'; 
            return; 
        } 
        
        if (newData.price !== null && newData.price < 0) { 
            addFormError.textContent = '價格不能是負數。'; 
            return; 
        } 
        
        const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'); 
        if (!isBasicUrlValid(newData.image_url) || !isBasicUrlValid(newData.seven_eleven_url)) {
            addFormError.textContent = '圖片路徑或 7-11 連結格式不正確 (應以 http://, https:// 或 / 開頭)。';
            return;
        } 
        
        try { 
                const response = await fetch('/api/admin/products', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(newData) 
            }); 
            
            if (!response.ok) { 
                let errorMsg = `新增失敗 (HTTP ${response.status})`; 
                try { 
                    const errorData = await response.json(); 
                    errorMsg = errorData.error || errorMsg; 
                } catch (e) {} 
                throw new Error(errorMsg); 
            } 
            
            closeAddModal(); 
            await fetchAndDisplayProducts();
            await fetchCategories();
        } catch (error) { 
            addFormError.textContent = `新增錯誤：${error.message}`; 
        }
    });
} else { 
    console.error("新增表單元素未找到。"); 
}
    // --- *** 圖表相關邏輯 *** ---

    // 統一刷新所有圖表的函數
    function refreshAllCharts() {
        displayTrafficChart(currentGranularity);
    }

    // 初始化页面列表选择器
    async function initializePageSelect() {
        if (!pageSelectMulti) return;
        
        try {
            const response = await fetch('/api/analytics/page-list');
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            
            const pages = await response.json();
            
            // 清空现有选项
            pageSelectMulti.innerHTML = '';
            
            // 添加所有页面作为选项
            pages.forEach(page => {
                const option = document.createElement('option');
                option.value = page;
                option.textContent = page;
                pageSelectMulti.appendChild(option);
            });
            
            // 默认选中前5个
            Array.from(pageSelectMulti.options).slice(0, 5).forEach(opt => opt.selected = true);
        } catch (error) {
            console.error('获取页面列表失败:', error);
        }
    }

    async function displayPageComparisonChart(selectedPages = []) {
        if (!pageComparisonChartCanvas) {
            console.warn("找不到頁面對比圖表元素。");
            return;
        }
        
        if (chartLoadingMsg) chartLoadingMsg.style.display = 'block';
        if (chartErrorMsg) chartErrorMsg.style.display = 'none';
        
        // 確保先銷毀舊圖表
        if (pageComparisonChart) {
            pageComparisonChart.destroy();
            pageComparisonChart = null;
        }
        
        try {
            const response = await fetch(`/api/analytics/page-views?startDate=${currentTimeRange.startDate}&endDate=${currentTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            
            const data = await response.json();
            
            // 處理數據，按頁面分組
            const pageData = {};
            const dates = new Set();
            
            data.forEach(item => {
                if (!pageData[item.page]) pageData[item.page] = {};
                pageData[item.page][item.view_date] = item.count;
                dates.add(item.view_date);
            });
            
            // 排序日期
            const sortedDates = Array.from(dates).sort();
            
            // 準備圖表數據
            let datasets = Object.keys(pageData)
                .sort((a, b) => {
                    // 計算總訪問量以排序
                    const totalA = Object.values(pageData[a]).reduce((sum, val) => sum + val, 0);
                    const totalB = Object.values(pageData[b]).reduce((sum, val) => sum + val, 0);
                    return totalB - totalA;
                })
                .map((page, index) => {
                    // 為每個頁面創建一個數據集，使用不同顏色
                    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#4BC0C0', '#9966FF', '#36A2EB', '#FF6384'];
                    return {
                        label: page,
                        data: sortedDates.map(date => pageData[page][date] || 0),
                        borderColor: colors[index % colors.length],
                        backgroundColor: 'transparent',
                        tension: 0.2
                    };
                });
            
            // 如果提供了选定页面，则只显示这些页面
            if (selectedPages && selectedPages.length > 0) {
                const filteredDatasets = datasets.filter(ds => selectedPages.includes(ds.label));
                // 如果没有匹配，使用前5个（原始行为）
                if (filteredDatasets.length > 0) {
                    datasets = filteredDatasets;
                } else {
                    datasets = datasets.slice(0, 5);
                }
            } else {
                // 没有指定，默认取前5个
                datasets = datasets.slice(0, 5);
            }
            
            // 創建圖表
            const ctx = pageComparisonChartCanvas.getContext('2d');
            pageComparisonChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sortedDates,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true },
                        x: { ticks: { maxRotation: 45, minRotation: 45 } }
                    },
                    plugins: {
                        title: { 
                            display: true, 
                            text: '熱門頁面訪問量對比'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    }
                }
            });
            
            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
            
        } catch (error) {
            console.error('加載頁面對比圖表失敗:', error);
            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
            if (chartErrorMsg) {
                chartErrorMsg.textContent = `無法加載頁面對比圖表: ${error.message}`;
                chartErrorMsg.style.display = 'block';
            }
        }
    }

    async function displayPageRankingChart() {
        if (!pageRankingChartCanvas) {
            console.warn("找不到頁面排行榜圖表元素。");
            return;
        }
        
        // 確保先銷毀舊圖表
        if (pageRankingChart) {
            pageRankingChart.destroy();
            pageRankingChart = null;
        }
        
        try {
            const response = await fetch(`/api/analytics/page-views/ranking?startDate=${currentTimeRange.startDate}&endDate=${currentTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            
            const data = await response.json();
            
            // 排序頁面按總訪問量
            data.sort((a, b) => b.total_count - a.total_count);
            const top10Pages = data.slice(0, 10);
            
            // 創建圖表
            const ctx = pageRankingChartCanvas.getContext('2d');
            pageRankingChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: top10Pages.map(item => item.page),
                    datasets: [{
                        label: '總訪問量',
                        data: top10Pages.map(item => item.total_count),
                        backgroundColor: 'rgba(54, 162, 235, 0.8)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: '頁面訪問量排行榜 (前10名)'
                        },
                        legend: {
                            display: false
                        }
                    }
                }
            });
        } catch (error) {
            console.error('加載頁面排行榜圖表失敗:', error);
        }
    }

    /**
     * 獲取並繪製流量圖表
     * @param {string} granularity - 'daily' 或 'monthly'
     */
    async function displayTrafficChart(granularity = 'daily') {
        if (!trafficChartCanvas) { 
            console.warn("找不到 traffic-chart canvas 元素。"); 
            return; 
        }
        
        const ctx = trafficChartCanvas.getContext('2d');
        currentGranularity = granularity;

        // 更新時間範圍
        if (granularity === 'daily') {
            if (!startDateInput || !endDateInput || startDateInput.value === '' || endDateInput.value === '') {
                currentTimeRange.startDate = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
                currentTimeRange.endDate = new Date().toISOString().split('T')[0];
            }
        } else if (granularity === 'monthly') {
            if (!startDateInput || !endDateInput || startDateInput.value === '' || endDateInput.value === '') {
                currentTimeRange.startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];
                currentTimeRange.endDate = new Date().toISOString().split('T')[0];
            }
        }

        if (startDateInput && endDateInput) {
            startDateInput.value = currentTimeRange.startDate;
            endDateInput.value = currentTimeRange.endDate;
        }

        if (chartLoadingMsg) chartLoadingMsg.style.display = 'block';
        if (chartErrorMsg) chartErrorMsg.style.display = 'none';
        
        // 確保先銷毀舊圖表
        if (currentChart) { 
            currentChart.destroy(); 
            currentChart = null; 
        }
        
        trafficChartCanvas.style.display = 'none';

        let apiUrl = '/api/analytics/traffic';
        if (granularity === 'monthly') { 
            apiUrl = '/api/analytics/monthly-traffic'; 
        }

        // 添加日期範圍参数
        apiUrl += `?startDate=${currentTimeRange.startDate}&endDate=${currentTimeRange.endDate}`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) { 
                let errorMsg = `無法獲取流量數據 (HTTP ${response.status})`; 
                try { 
                    const errorData = await response.json(); 
                    errorMsg = errorData.error || errorMsg; 
                } catch(e){} 
                throw new Error(errorMsg); 
            }
            
            const trafficData = await response.json();

            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
            trafficChartCanvas.style.display = 'block';

            if (trafficData.length === 0) {
                if (chartErrorMsg) { 
                    chartErrorMsg.textContent = '（尚無流量數據）'; 
                    chartErrorMsg.style.display = 'block'; 
                    chartErrorMsg.style.color = '#888'; 
                }
                return;
            }

            const labels = trafficData.map(item => item.date || item.month);
            const dataPoints = trafficData.map(item => item.count);

            currentChart = new Chart(ctx, {
                type: 'line',
                data: { 
                    labels: labels, 
                    datasets: [{ 
                        label: granularity === 'daily' ? '每日頁面瀏覽量' : '每月頁面瀏覽量', 
                        data: dataPoints, 
                        borderColor: granularity === 'daily' ? 'rgb(54, 162, 235)' : 'rgb(255, 159, 64)', 
                        backgroundColor: granularity === 'daily' ? 'rgba(54, 162, 235, 0.1)' : 'rgba(255, 159, 64, 0.1)', 
                        fill: true, 
                        tension: 0.2 
                    }] 
                },
                options: { 
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            ticks: { 
                                stepSize: granularity === 'daily' ? 1 : undefined 
                            } 
                        } 
                    }, 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { 
                        title: { 
                            display: false 
                        }, 
                        legend: { 
                            display: true, 
                            position: 'top' 
                        } 
                    } 
                }
            });
            
            // 當總體流量圖表更新後，也更新其他相關圖表
            setTimeout(() => {
                displayPageRankingChart();
                setTimeout(() => {
                    displayPageComparisonChart();
                }, 300);
            }, 300);
            
        } catch (error) {
            console.error(`繪製 ${granularity} 流量圖表失敗:`, error);
            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
            if (chartErrorMsg) { 
                chartErrorMsg.textContent = `無法載入圖表: ${error.message}`; 
                chartErrorMsg.style.display = 'block'; 
                chartErrorMsg.style.color = 'red'; 
            }
        }
    }

    // --- 為切換按鈕添加事件監聽器 ---
    if (btnDaily && btnMonthly) {
        const toggleButtons = [btnDaily, btnMonthly];
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const newGranularity = button.dataset.granularity;
                if (newGranularity !== currentGranularity) {
                    toggleButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    displayTrafficChart(newGranularity);
                }
            });
        });
    } else { 
        console.warn("找不到圖表切換按鈕。"); 
    }
 // 添加日期控制事件監聽器
 if (applyDateBtn) {
    applyDateBtn.addEventListener('click', function() {
        if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
            currentTimeRange.startDate = startDateInput.value;
            currentTimeRange.endDate = endDateInput.value;
            refreshAllCharts();
        } else {
            alert('請選擇有效的開始和結束日期');
        }
    });
}

if (resetDateBtn) {
    resetDateBtn.addEventListener('click', function() {
        // 重置為默認時間範圍（近30天）
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const today = new Date();
        
        if (startDateInput && endDateInput) {
            startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
            endDateInput.value = today.toISOString().split('T')[0];
            
            currentTimeRange.startDate = startDateInput.value;
            currentTimeRange.endDate = endDateInput.value;
            
            refreshAllCharts();
        }
    });
}

// 添加頁面對比更新按鈕監聽器
if (updateComparisonBtn && pageSelectMulti) {
    updateComparisonBtn.addEventListener('click', function() {
        const selectedPages = Array.from(pageSelectMulti.selectedOptions).map(opt => opt.value);
        displayPageComparisonChart(selectedPages);
    });
}

// --- Initial Load ---
fetchAndDisplayProducts(); // 載入商品列表
fetchCategories();         
initializeDatePickers(); 
initializePageSelect(); 
setTimeout(() => { displayTrafficChart('daily'); }, 300);

// --- *** 新增: 獲取並填充分類 (Datalist + 顯示標籤) *** ---
async function fetchCategories() {
    if (!categoryOptionsDatalist) return;
    // 同時檢查顯示標籤的 div 是否存在
    const displayDivsExist = addExistingCategoriesDiv && editExistingCategoriesDiv;

    try {
        const response = await fetch('/api/products/categories');
        if (!response.ok) throw new Error(`無法獲取分類列表 (HTTP ${response.status})`);
        const categories = await response.json();

        // 清空舊選項 (Datalist 和顯示區)
        categoryOptionsDatalist.innerHTML = ''; 
        if (displayDivsExist) {
            addExistingCategoriesDiv.innerHTML = '';
            editExistingCategoriesDiv.innerHTML = '';
        }

        categories.forEach(category => {
            // 填充 Datalist
            const option = document.createElement('option');
            option.value = category;
            categoryOptionsDatalist.appendChild(option);

            // 如果顯示區存在，則創建並添加可點擊標籤
            if (displayDivsExist) {
                const tag = document.createElement('a'); // 使用 a 標籤方便樣式和點擊
                tag.href = '#'; // 避免頁面跳轉
                tag.classList.add('category-tag');
                tag.textContent = category;
                tag.dataset.category = category; // 將分類名存在 data-* 屬性中

                // 為標籤添加點擊事件 (Add Modal)
                const addTagClone = tag.cloneNode(true);
                addTagClone.addEventListener('click', (e) => {
                    e.preventDefault(); // 阻止 a 標籤的默認行為
                    if (addProductCategory) {
                        addProductCategory.value = e.target.dataset.category;
                    }
                });
                addExistingCategoriesDiv.appendChild(addTagClone);

                // 為標籤添加點擊事件 (Edit Modal)
                const editTagClone = tag.cloneNode(true);
                editTagClone.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (editProductCategory) {
                        editProductCategory.value = e.target.dataset.category;
                    }
                });
                editExistingCategoriesDiv.appendChild(editTagClone);
            }
        });
        
        // 如果沒有分類，可以顯示提示 (可選)
        if (categories.length === 0 && displayDivsExist) {
             addExistingCategoriesDiv.innerHTML = '<small style="color: #888;">尚無現有分類</small>';
             editExistingCategoriesDiv.innerHTML = '<small style="color: #888;">尚無現有分類</small>';
        }

    } catch (error) {
        console.error('獲取分類列表失敗:', error);
        if (displayDivsExist) {
            addExistingCategoriesDiv.innerHTML = '<small style="color: red;">無法載入分類</small>';
            editExistingCategoriesDiv.innerHTML = '<small style="color: red;">無法載入分類</small>';
        }
    }
}

// --- *** 標籤相關功能 *** ---

// 填充標籤複選框
async function populateTagCheckboxes(container, selectedTags = []) {
    if (!container) return;
    
    try {
        container.innerHTML = '<div class="tag-loading">載入中...</div>';
        
        const response = await fetch('/api/tags');
        if (!response.ok) throw new Error(`無法獲取標籤 (HTTP ${response.status})`);
        
        const tags = await response.json();
        container.innerHTML = '';
        
        if (tags.length === 0) {
            container.innerHTML = '<p class="no-tags-message">尚無標籤，請先在標籤管理頁面新增標籤。</p>';
            return;
        }
        
        // 創建複選框
        tags.forEach(tag => {
            const checkboxId = `tag-${container.id}-${tag.tag_id}`;
            
            const wrapper = document.createElement('div');
            wrapper.className = 'tag-checkbox-wrapper';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.value = tag.tag_id;
            checkbox.checked = selectedTags.includes(tag.tag_id);
            
            const label = document.createElement('label');
            label.htmlFor = checkboxId;
            label.textContent = tag.tag_name;
            
            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);
            container.appendChild(wrapper);
        });
    } catch (error) {
        console.error('載入標籤失敗:', error);
        container.innerHTML = `<p class="error-message">無法載入標籤: ${error.message}</p>`;
    }
}

// 獲取並顯示所有標籤
async function fetchAndDisplayTags() {
    if (!tagsList) return;
    
    try {
        tagsList.innerHTML = '<div class="loading-tags">載入標籤中...</div>';
        
        const response = await fetch('/api/tags');
        if (!response.ok) throw new Error(`載入標籤失敗 (HTTP ${response.status})`);
        
        const tags = await response.json();
        tagsList.innerHTML = '';
        
        if (tags.length === 0) {
            tagsList.innerHTML = '<p class="no-tags">尚無標籤，請使用上方表單新增標籤。</p>';
            return;
        }
        
        tags.forEach(tag => {
            const tagItem = document.createElement('div');
            tagItem.className = 'tag-item';
            tagItem.dataset.tagId = tag.tag_id;
            
            tagItem.innerHTML = `
                <span class="tag-name">${tag.tag_name}</span>
                <div class="tag-actions">
                    <button class="edit-tag-btn" onclick="editTag(${tag.tag_id}, '${tag.tag_name}')">編輯</button>
                    <button class="delete-tag-btn" onclick="deleteTag(${tag.tag_id})">刪除</button>
                </div>
            `;
            
            tagsList.appendChild(tagItem);
        });
    } catch (error) {
        console.error('獲取標籤失敗:', error);
        tagsList.innerHTML = `<p class="error-message">無法載入標籤: ${error.message}</p>`;
    }
}

// 新增標籤功能
if (addTagForm) {
    addTagForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        if (tagManagementError) tagManagementError.textContent = '';
        
        const tagName = addTagInput.value.trim();
        if (!tagName) {
            if (tagManagementError) tagManagementError.textContent = '標籤名稱不能為空';
            return;
        }
        
        try {
            const adminPassword = prompt("請輸入管理員密碼以新增標籤：");
            if (!adminPassword) {
                alert("未提供管理員密碼，操作取消。");
                if (tagManagementError) tagManagementError.textContent = '操作已取消。';
                return;
            }

            const response = await fetch('/api/tags', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Password': adminPassword
                },
                body: JSON.stringify({ tag_name: tagName })
            });
            
            if (!response.ok) {
                let errorMsg = `無法新增標籤 (HTTP ${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) {}
                throw new Error(errorMsg);
            }
            
            addTagInput.value = '';
            await fetchAndDisplayTags();
        } catch (error) {
            console.error('新增標籤失敗:', error);
            if (tagManagementError) tagManagementError.textContent = `新增標籤錯誤: ${error.message}`;
        }
    });
}

// 編輯標籤（全局函數）
window.editTag = async function(id, currentName) {
    const newName = prompt('請輸入新的標籤名稱:', currentName);
    if (newName === null || newName.trim() === '') return;

    const adminPassword = prompt("請輸入管理員密碼：");
    if (!adminPassword) {
        alert("未提供管理員密碼，操作取消。");
        return;
    }
    
    try {
        const response = await fetch(`/api/tags/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Password': adminPassword
            },
            body: JSON.stringify({ tag_name: newName.trim() })
        });
        
        if (!response.ok) {
            let errorMsg = `無法更新標籤 (HTTP ${response.status})`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {}
            throw new Error(errorMsg);
        }
        
        await fetchAndDisplayTags();
    } catch (error) {
        console.error(`更新標籤 ${id} 失敗:`, error);
        alert(`更新標籤失敗: ${error.message}`);
    }
};

// 刪除標籤（全局函數）
window.deleteTag = async function(id) {
    if (confirm(`確定要刪除此標籤嗎？此操作無法復原，並會從所有使用此標籤的商品中移除。`)) {
        const adminPassword = prompt("請輸入管理員密碼：");
        if (!adminPassword) {
            alert("未提供管理員密碼，操作取消。");
            return;
        }
        try {
            const response = await fetch(`/api/tags/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-Admin-Password': adminPassword
                }
            });
            
            if (!response.ok) {
                let errorMsg = `無法刪除標籤 (HTTP ${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) {}
                throw new Error(errorMsg);
            }
            
            await fetchAndDisplayTags();
            await fetchAndDisplayProducts(); // 更新商品列表，因為標籤可能有變化
        } catch (error) {
            console.error(`刪除標籤 ${id} 失敗:`, error);
            alert(`刪除標籤失敗: ${error.message}`);
        }
    }
};

// 在標籤管理頁籤切換時更新標籤列表
const tabButtons = document.querySelectorAll('.tab-button');
if (tabButtons.length > 0) {
    tabButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const targetTab = this.getAttribute('data-tab');
            
            // 隱藏所有內容區域
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
            });
            
            // 移除所有按鈕的 active 類別
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            
            // 顯示目標內容區域
            document.getElementById(targetTab).style.display = 'block';
            
            // 將點擊的按鈕設為 active
            this.classList.add('active');
            
            // 如果切換到標籤管理頁籤，刷新標籤列表
            if (targetTab === 'tag-management-tab') {
                fetchAndDisplayTags();
            }
        });
    });
}

// --- Initial Load ---
fetchAndDisplayProducts(); // 載入商品列表
fetchCategories();         
initializeDatePickers(); 
initializePageSelect(); 
setTimeout(() => { displayTrafficChart('daily'); }, 300);

// 如果標籤管理部分可見，載入標籤
if (document.getElementById('tag-management-tab') && 
    document.getElementById('tag-management-tab').style.display !== 'none') {
    fetchAndDisplayTags();
}

// --- *** 新增: 獲取並填充分類 (Datalist + 顯示標籤) *** ---
async function fetchCategories() {
    if (!categoryOptionsDatalist) return;
    // 同時檢查顯示標籤的 div 是否存在
    const displayDivsExist = addExistingCategoriesDiv && editExistingCategoriesDiv;

    try {
        const response = await fetch('/api/products/categories');
        if (!response.ok) throw new Error(`無法獲取分類列表 (HTTP ${response.status})`);
        const categories = await response.json();

        // 清空舊選項 (Datalist 和顯示區)
        categoryOptionsDatalist.innerHTML = ''; 
        if (displayDivsExist) {
            addExistingCategoriesDiv.innerHTML = '';
            editExistingCategoriesDiv.innerHTML = '';
        }

        categories.forEach(category => {
            // 填充 Datalist
            const option = document.createElement('option');
            option.value = category;
            categoryOptionsDatalist.appendChild(option);

            // 如果顯示區存在，則創建並添加可點擊標籤
            if (displayDivsExist) {
                const tag = document.createElement('a'); // 使用 a 標籤方便樣式和點擊
                tag.href = '#'; // 避免頁面跳轉
                tag.classList.add('category-tag');
                tag.textContent = category;
                tag.dataset.category = category; // 將分類名存在 data-* 屬性中

                // 為標籤添加點擊事件 (Add Modal)
                const addTagClone = tag.cloneNode(true);
                addTagClone.addEventListener('click', (e) => {
                    e.preventDefault(); // 阻止 a 標籤的默認行為
                    if (addProductCategory) {
                        addProductCategory.value = e.target.dataset.category;
                    }
                });
                addExistingCategoriesDiv.appendChild(addTagClone);

                // 為標籤添加點擊事件 (Edit Modal)
                const editTagClone = tag.cloneNode(true);
                editTagClone.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (editProductCategory) {
                        editProductCategory.value = e.target.dataset.category;
                    }
                });
                editExistingCategoriesDiv.appendChild(editTagClone);
            }
        });
        
        // 如果沒有分類，可以顯示提示 (可選)
        if (categories.length === 0 && displayDivsExist) {
             addExistingCategoriesDiv.innerHTML = '<small style="color: #888;">尚無現有分類</small>';
             editExistingCategoriesDiv.innerHTML = '<small style="color: #888;">尚無現有分類</small>';
        }

    } catch (error) {
        console.error('獲取分類列表失敗:', error);
        if (displayDivsExist) {
            addExistingCategoriesDiv.innerHTML = '<small style="color: red;">無法載入分類</small>';
            editExistingCategoriesDiv.innerHTML = '<small style="color: red;">無法載入分類</small>';
        }
    }
}

}); // --- End of DOMContentLoaded ---

// 切換標籤管理視圖的全局函數
window.showTagManagement = function() {
    // 隱藏所有內容區域
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // 移除所有按鈕的 active 類別
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 顯示標籤管理內容區域
    const tagManagementTab = document.getElementById('tag-management-tab');
    if (tagManagementTab) {
        tagManagementTab.style.display = 'block';
        
        // 將對應按鈕設為 active
        const tagTabButton = document.querySelector('.tab-button[data-tab="tag-management-tab"]');
        if (tagTabButton) {
            tagTabButton.classList.add('active');
        }
        
        // 刷新標籤列表
        const tagsList = document.getElementById('tags-list');
        if (tagsList) {
            // 檢查是否有全局函數
            if (typeof fetchAndDisplayTags === 'function') {
                fetchAndDisplayTags();
            } else {
                // 直接在這裡實現載入標籤的邏輯
                (async function() {
                    try {
                        tagsList.innerHTML = '<div class="loading-tags">載入標籤中...</div>';
                        
                        const response = await fetch('/api/tags');
                        if (!response.ok) throw new Error(`載入標籤失敗 (HTTP ${response.status})`);
                        
                        const tags = await response.json();
                        tagsList.innerHTML = '';
                        
                        if (tags.length === 0) {
                            tagsList.innerHTML = '<p class="no-tags">尚無標籤，請使用上方表單新增標籤。</p>';
                            return;
                        }
                        
                        tags.forEach(tag => {
                            const tagItem = document.createElement('div');
                            tagItem.className = 'tag-item';
                            tagItem.dataset.tagId = tag.tag_id;
                            
                            tagItem.innerHTML = `
                                <span class="tag-name">${tag.tag_name}</span>
                                <div class="tag-actions">
                                    <button class="edit-tag-btn" onclick="editTag(${tag.tag_id}, '${tag.tag_name}')">編輯</button>
                                    <button class="delete-tag-btn" onclick="deleteTag(${tag.tag_id})">刪除</button>
                                </div>
                            `;
                            
                            tagsList.appendChild(tagItem);
                        });
                    } catch (error) {
                        console.error('獲取標籤失敗:', error);
                        tagsList.innerHTML = `<p class="error-message">無法載入標籤: ${error.message}</p>`;
                    }
                })();
            }
        }
    }
}