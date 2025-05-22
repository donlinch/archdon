// public/admin.js
document.addEventListener('DOMContentLoaded', () => {
    // --- 管理員密碼功能已移除 ---

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
    const editTagsContainer = document.getElementById('edit-tags-container');
    // --- 新增：編輯表單的期限相關元素 ---
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
    const addTagsContainer = document.getElementById('add-tags-container');
    // --- 新增：新增表單的期限相關元素 ---
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
    
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const applyDateBtn = document.getElementById('apply-date');
    const resetDateBtn = document.getElementById('reset-date');
    const pageSelectMulti = document.getElementById('page-select');
    const updateComparisonBtn = document.getElementById('update-comparison');
    
    let currentChart = null;
    let pageRankingChart = null;
    let pageComparisonChart = null;
    let currentGranularity = 'daily';
    
    let currentTimeRange = {
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    };

    // --- 來源分析相關變量 ---
    let sourceDistributionChart = null;
    let sourceTrendChart = null;
    let sourceRankingChart = null;
    let sourceConversionChart = null;
    let sourceGeoChart = null;

    let sourceTimeRange = {
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    };

    function initializeDatePickers() {
        if (startDateInput && endDateInput) {
            startDateInput.value = currentTimeRange.startDate;
            endDateInput.value = currentTimeRange.endDate;
        }
    }

    // --- Event Listeners for Expiration Type Change ---
    if (addExpirationType && addDateRangeGroup) {
        addExpirationType.addEventListener('change', function() {
            addDateRangeGroup.style.display = this.value === '1' ? 'block' : 'none';
            if (this.value === '0') {
                if(addStartDate) addStartDate.value = '';
                if(addEndDate) addEndDate.value = '';
            }
        });
    }

    if (editExpirationType && editDateRangeGroup) {
        editExpirationType.addEventListener('change', function() {
            editDateRangeGroup.style.display = this.value === '1' ? 'block' : 'none';
            if (this.value === '0') {
                if(editStartDate) editStartDate.value = '';
                if(editEndDate) editEndDate.value = '';
            }
        });
    }

    async function fetchAndDisplayProducts() {
        if (!productListBody || !productListContainer || !productTable) { 
            console.error("Admin page table elements not found."); 
            if(loadingMessage) loadingMessage.textContent = '頁面結構錯誤，無法載入列表。'; 
            return; 
        } 
        
        try { 
            if (loadingMessage) loadingMessage.style.display = 'block'; 
            if (productTable) productTable.style.display = 'none'; 
            
            const response = await fetch('/api/admin/products');
            if (!response.ok) { 
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`); 
            } 
            
            const products = await response.json(); 
            if (loadingMessage) loadingMessage.style.display = 'none'; 
            if (productTable) productTable.style.display = 'table'; 
            
            productListBody.innerHTML = ''; 
            if (products.length === 0) { 
                productListBody.innerHTML = '<tr><td colspan="11">目前沒有商品。</td></tr>'; 
                return; 
            } 
            
            products.forEach(product => { 
                const row = document.createElement('tr'); 
                row.dataset.productId = product.id; 

                const formatDate = (dateString) => {
                    if (!dateString) return 'N/A';
                    try {
                        const date = new Date(dateString);
                        if (isNaN(date.getTime())) return 'N/A';
                        return date.toISOString().split('T')[0];
                    } catch (e) {
                        return 'N/A';
                    }
                };
 // 從 API 獲取歷史點擊和今日增量
 const historicalClicks = product.historical_click_count !== null ? parseInt(product.historical_click_count, 10) : 0;
 const todayIncrement = product.today_click_increment !== null ? parseInt(product.today_click_increment, 10) : 0;
 
 // 計算總點擊 (歷史 + 今日)
 const totalClicksCombined = historicalClicks + todayIncrement;

 // 構建點擊數的 HTML
 let clickDisplayHtml = `${totalClicksCombined}`; // 總點擊數
 if (todayIncrement > 0) {
     clickDisplayHtml += ` <span style="color: red;">(+${todayIncrement})</span>`; // 今日新增，紅色
 }

 row.innerHTML = `
     <td>${product.id}</td>
     <td>${product.name || ''}</td>
     <td>${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
     <td>${clickDisplayHtml}</td> {/* <--- 修改這裡 */}
     <td>${product.category || '未分類'}</td>
     <td><img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="width: 50px; height: auto; border: 1px solid #eee;"></td>
     {/* ... 其他欄位保持與您 admin.html 中一致 ... */}
     <td><span class="${statusClass}">${statusDisplay}</span></td>
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

    async function openEditModal(id) {
        const requiredEditElements = [editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editProductCategory, editFormError, editExpirationType, editDateRangeGroup, editStartDate, editEndDate]; 
        
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
            console.log('Product data for editing:', JSON.stringify(product, null, 2));
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
            
            if (editExpirationType) {
                editExpirationType.value = product.expiration_type !== undefined ? product.expiration_type.toString() : '0';
            }
            if (editStartDate) {
                editStartDate.value = product.start_date && typeof product.start_date === 'string' ? product.start_date.split('T')[0] : '';
            }
            if (editEndDate) {
                editEndDate.value = product.end_date && typeof product.end_date === 'string' ? product.end_date.split('T')[0] : '';
            }
            if (editDateRangeGroup && editExpirationType) {
                editDateRangeGroup.style.display = editExpirationType.value === '1' ? 'block' : 'none';
            }
            
            if (editTagsContainer) {
                await populateTagCheckboxes(editTagsContainer, product.tags || []);
            }
            
            editModal.style.display = 'flex'; 
        } catch (error) { 
            console.error(`獲取商品 ${id} 進行編輯時出錯:`, error); 
            alert(`無法載入編輯資料： ${error.message}`); 
        }
    }

    window.closeModal = function() { 
        if (editModal) { 
            editModal.style.display = 'none'; 
        } 
    }

    window.closeAddModal = function() { 
        if (addModal) { 
            addModal.style.display = 'none'; 
        } 
    }

    window.editProduct = function(id) { 
        openEditModal(id); 
    };

    window.deleteProduct = async function(id) {
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) {
            try {
                // 前端原本就沒有在此處發送密碼，所以這裡不需要改動密碼相關邏輯
                const response = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
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
    
    window.showAddForm = function() {
        const requiredAddElements = [addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductCategory, addProductImageUrl, addProductSevenElevenUrl, addFormError, addExpirationType, addDateRangeGroup, addStartDate, addEndDate]; 
        
        if (requiredAddElements.some(el => !el)) { 
            alert("新增視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。"); 
            return; 
        } 
        
        addFormError.textContent = ''; 
        addForm.reset(); 
        if(addExpirationType) addExpirationType.value = '0';
        if(addDateRangeGroup) addDateRangeGroup.style.display = 'none';
        if(addStartDate) addStartDate.value = '';
        if(addEndDate) addEndDate.value = '';
        
        if (addTagsContainer) {
            populateTagCheckboxes(addTagsContainer, []);
        }
        
        addModal.style.display = 'flex';
    }

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
                expiration_type: editExpirationType ? parseInt(editExpirationType.value) : 0,
                start_date: null,
                end_date: null
            };

            if (updatedData.expiration_type === 1) {
                updatedData.start_date = editStartDate ? (editStartDate.value || null) : null;
                updatedData.end_date = editEndDate ? (editEndDate.value || null) : null;
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
            
            console.log('Submitting updated product data:', updatedData);
            try {
                // 前端原本就沒有在此處發送密碼
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
                start_date: null,
                end_date: null
            };

            if (newData.expiration_type === 1) {
                newData.start_date = addStartDate ? (addStartDate.value || null) : null;
                newData.end_date = addEndDate ? (addEndDate.value || null) : null;
            }

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
            
            console.log('Submitting new product data:', newData);
            try {
                // 前端原本就沒有在此處發送密碼
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

    function refreshAllCharts() {
        displayTrafficChart(currentGranularity);
        displayPageRankingChart();
        displayPageComparisonChart();
        displaySourceDistribution();
        displaySourceTrend();
        updateSourceTable();
    }

    async function initializePageSelect() {
        if (!pageSelectMulti) return;
        try {
            const response = await fetch('/api/analytics/page-list');
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const pages = await response.json();
            pageSelectMulti.innerHTML = '';
            pages.forEach(page => {
                const option = document.createElement('option');
                option.value = page;
                option.textContent = page;
                pageSelectMulti.appendChild(option);
            });
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
        if (pageComparisonChart) {
            pageComparisonChart.destroy();
            pageComparisonChart = null;
        }
        try {
            const response = await fetch(`/api/analytics/page-views?startDate=${currentTimeRange.startDate}&endDate=${currentTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            const pageData = {};
            const dates = new Set();
            data.forEach(item => {
                if (!pageData[item.page]) pageData[item.page] = {};
                pageData[item.page][item.view_date] = item.count;
                dates.add(item.view_date);
            });
            const sortedDates = Array.from(dates).sort();
            let datasets = Object.keys(pageData)
                .sort((a, b) => {
                    const totalA = Object.values(pageData[a]).reduce((sum, val) => sum + val, 0);
                    const totalB = Object.values(pageData[b]).reduce((sum, val) => sum + val, 0);
                    return totalB - totalA;
                })
                .map((page, index) => {
                    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#4BC0C0', '#9966FF', '#36A2EB', '#FF6384'];
                    return {
                        label: page,
                        data: sortedDates.map(date => pageData[page][date] || 0),
                        borderColor: colors[index % colors.length],
                        backgroundColor: 'transparent',
                        tension: 0.2
                    };
                });
            if (selectedPages && selectedPages.length > 0) {
                const filteredDatasets = datasets.filter(ds => selectedPages.includes(ds.label));
                if (filteredDatasets.length > 0) {
                    datasets = filteredDatasets;
                } else {
                    datasets = datasets.slice(0, 5);
                }
            } else {
                datasets = datasets.slice(0, 5);
            }
            const ctx = pageComparisonChartCanvas.getContext('2d');
            pageComparisonChart = new Chart(ctx, {
                type: 'line',
                data: { labels: sortedDates, datasets: datasets },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true }, x: { ticks: { maxRotation: 45, minRotation: 45 } } },
                    plugins: { title: { display: true, text: '熱門頁面訪問量對比' }, tooltip: { mode: 'index', intersect: false } }
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
        if (!pageRankingChartCanvas) { console.warn("找不到頁面排行榜圖表元素。"); return; }
        if (pageRankingChart) { pageRankingChart.destroy(); pageRankingChart = null; }
        try {
            const response = await fetch(`/api/analytics/page-views/ranking?startDate=${currentTimeRange.startDate}&endDate=${currentTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            data.sort((a, b) => b.total_count - a.total_count);
            const top10Pages = data.slice(0, 10);
            const ctx = pageRankingChartCanvas.getContext('2d');
            pageRankingChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: top10Pages.map(item => item.page),
                    datasets: [{
                        label: '總訪問量', data: top10Pages.map(item => item.total_count),
                        backgroundColor: 'rgba(54, 162, 235, 0.8)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                    plugins: { title: { display: true, text: '頁面訪問量排行榜 (前10名)' }, legend: { display: false } }
                }
            });
        } catch (error) { console.error('加載頁面排行榜圖表失敗:', error); }
    }

    async function displayTrafficChart(granularity = 'daily') {
        if (!trafficChartCanvas) { console.warn("找不到 traffic-chart canvas 元素。"); return; }
        const ctx = trafficChartCanvas.getContext('2d');
        currentGranularity = granularity;
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
        if (currentChart) { currentChart.destroy(); currentChart = null; }
        trafficChartCanvas.style.display = 'none';
        let apiUrl = granularity === 'monthly' ? '/api/analytics/monthly-traffic' : '/api/analytics/traffic';
        apiUrl += `?startDate=${currentTimeRange.startDate}&endDate=${currentTimeRange.endDate}`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) { 
                let errorMsg = `無法獲取流量數據 (HTTP ${response.status})`; 
                try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch(e){} 
                throw new Error(errorMsg); 
            }
            const trafficData = await response.json();
            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
            trafficChartCanvas.style.display = 'block';
            if (trafficData.length === 0) {
                if (chartErrorMsg) { chartErrorMsg.textContent = '（尚無流量數據）'; chartErrorMsg.style.display = 'block'; chartErrorMsg.style.color = '#888'; }
                return;
            }
            const labels = trafficData.map(item => item.date || item.month);
            const dataPoints = trafficData.map(item => item.count);

            currentChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: granularity === 'daily' ? '每日頁面瀏覽量' : '每月頁面瀏覽量',
                        data: dataPoints,
                        backgroundColor: granularity === 'daily' ? 'rgba(54, 162, 235, 0.7)' : 'rgba(255, 159, 64, 0.7)',
                        borderColor: granularity === 'daily' ? 'rgb(54, 162, 235)' : 'rgb(255, 159, 64)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: granularity === 'daily' ? 1 : undefined
                            }
                        },
                        x: { ticks: {} }
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: false },
                        legend: { display: true, position: 'top' }
                    }
                }
            });
            setTimeout(() => { displayPageRankingChart(); setTimeout(() => { displayPageComparisonChart(); }, 300); }, 300);
        } catch (error) {
            console.error(`繪製 ${granularity} 流量圖表失敗:`, error);
            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
            if (chartErrorMsg) { chartErrorMsg.textContent = `無法載入圖表: ${error.message}`; chartErrorMsg.style.display = 'block'; chartErrorMsg.style.color = 'red'; }
        }
    }

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
    } else { console.warn("找不到圖表切換按鈕。"); }
    
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
            const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
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

    if (updateComparisonBtn && pageSelectMulti) {
        updateComparisonBtn.addEventListener('click', function() {
            const selectedPages = Array.from(pageSelectMulti.selectedOptions).map(opt => opt.value);
            displayPageComparisonChart(selectedPages);
        });
    }

    fetchAndDisplayProducts(); 
    fetchCategories();         
    initializeDatePickers(); 
    initializePageSelect(); 
    setTimeout(() => { displayTrafficChart('daily'); }, 300);

    async function fetchCategories() {
        if (!categoryOptionsDatalist) return;
        const displayDivsExist = addExistingCategoriesDiv && editExistingCategoriesDiv;
        try {
            const response = await fetch('/api/products/categories');
            if (!response.ok) throw new Error(`無法獲取分類列表 (HTTP ${response.status})`);
            const categories = await response.json();
            categoryOptionsDatalist.innerHTML = ''; 
            if (displayDivsExist) { addExistingCategoriesDiv.innerHTML = ''; editExistingCategoriesDiv.innerHTML = ''; }
            categories.forEach(category => {
                const option = document.createElement('option'); option.value = category; categoryOptionsDatalist.appendChild(option);
                if (displayDivsExist) {
                    const tag = document.createElement('a'); tag.href = '#'; tag.classList.add('category-tag');
                    tag.textContent = category; tag.dataset.category = category; 
                    const addTagClone = tag.cloneNode(true);
                    addTagClone.addEventListener('click', (e) => { e.preventDefault(); if (addProductCategory) addProductCategory.value = e.target.dataset.category; });
                    addExistingCategoriesDiv.appendChild(addTagClone);
                    const editTagClone = tag.cloneNode(true);
                    editTagClone.addEventListener('click', (e) => { e.preventDefault(); if (editProductCategory) editProductCategory.value = e.target.dataset.category; });
                    editExistingCategoriesDiv.appendChild(editTagClone);
                }
            });
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

    async function populateTagCheckboxes(container, selectedTags = []) {
        if (!container) return;
        try {
            container.innerHTML = '<div class="tag-loading">載入中...</div>';
            const response = await fetch('/api/tags');
            if (!response.ok) throw new Error(`無法獲取標籤 (HTTP ${response.status})`);
            const tags = await response.json();
            container.innerHTML = '';
            if (tags.length === 0) { container.innerHTML = '<p class="no-tags-message">尚無標籤，請先在標籤管理頁面新增標籤。</p>'; return; }
            tags.forEach(tag => {
                const checkboxId = `tag-${container.id}-${tag.tag_id}`;
                const wrapper = document.createElement('div'); wrapper.className = 'tag-checkbox-wrapper';
                const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = checkboxId; checkbox.value = tag.tag_id;
                checkbox.checked = selectedTags.map(String).includes(String(tag.tag_id));
                const label = document.createElement('label'); label.htmlFor = checkboxId; label.textContent = tag.tag_name;
                wrapper.appendChild(checkbox); wrapper.appendChild(label); container.appendChild(wrapper);
            });
        } catch (error) { console.error('載入標籤失敗:', error); container.innerHTML = `<p class="error-message">無法載入標籤: ${error.message}</p>`; }
    }

    async function fetchAndDisplayTags() {
        if (!tagsList) return;
        try {
            tagsList.innerHTML = '<div class="loading-tags">載入標籤中...</div>';
            const response = await fetch('/api/tags');
            if (!response.ok) throw new Error(`載入標籤失敗 (HTTP ${response.status})`);
            const tags = await response.json();
            tagsList.innerHTML = '';
            if (tags.length === 0) { tagsList.innerHTML = '<p class="no-tags">尚無標籤，請使用上方表單新增標籤。</p>'; return; }
            tags.forEach(tag => {
                const tagItem = document.createElement('div'); tagItem.className = 'tag-item'; tagItem.dataset.tagId = tag.tag_id;
                tagItem.innerHTML = `
                    <span class="tag-name">${tag.tag_name}</span>
                    <div class="tag-actions">
                        <button class="edit-tag-btn" onclick="editTag(${tag.tag_id}, '${tag.tag_name}')">編輯</button>
                        <button class="delete-tag-btn" onclick="deleteTag(${tag.tag_id})">刪除</button>
                    </div>
                `;
                tagsList.appendChild(tagItem);
            });
        } catch (error) { console.error('獲取標籤失敗:', error); tagsList.innerHTML = `<p class="error-message">無法載入標籤: ${error.message}</p>`; }
    }

    if (addTagForm) {
        addTagForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (tagManagementError) tagManagementError.textContent = '';
            const tagName = addTagInput.value.trim();
            if (!tagName) { if (tagManagementError) tagManagementError.textContent = '標籤名稱不能為空'; return; }
            try {
                // 密碼相關邏輯已移除
                const response = await fetch('/api/tags', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                        // 移除了 'x-admin-password'
                    },
                    body: JSON.stringify({ tag_name: tagName })
                });
                if (!response.ok) {
                    let errorMsg = `無法新增標籤 (HTTP ${response.status})`;
                    try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {}
                    throw new Error(errorMsg);
                }
                addTagInput.value = ''; await fetchAndDisplayTags();
            } catch (error) { console.error('新增標籤失敗:', error); if (tagManagementError) tagManagementError.textContent = `新增標籤錯誤: ${error.message}`; }
        });
    }

    window.editTag = async function(id, currentName) {
        const newName = prompt('請輸入新的標籤名稱:', currentName);
        if (newName === null || newName.trim() === '') return;
        
        // 密碼相關邏輯已移除
        try {
            const response = await fetch(`/api/tags/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                    // 移除了 'x-admin-password'
                },
                body: JSON.stringify({ tag_name: newName.trim() })
            });
            if (!response.ok) {
                let errorMsg = `無法更新標籤 (HTTP ${response.status})`;
                try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {}
                throw new Error(errorMsg);
            }
            await fetchAndDisplayTags();
            if (typeof populateTagCheckboxes === 'function') {
                if (addTagsContainer) await populateTagCheckboxes(addTagsContainer, []);
                if (editTagsContainer) await populateTagCheckboxes(editTagsContainer, []);
            }
        } catch (error) {
            console.error(`更新標籤 ${id} 失敗:`, error);
            if (tagManagementError) tagManagementError.textContent = `更新標籤失敗: ${error.message}`;
            else alert(`更新標籤失敗: ${error.message}`);
        }
    };

    window.deleteTag = async function(id) {
        if (confirm(`確定要刪除此標籤嗎？此操作無法復原，並會從所有使用此標籤的商品中移除。`)) {
            // 密碼相關邏輯已移除
            try {
                const response = await fetch(`/api/tags/${id}`, {
                    method: 'DELETE'
                    // 移除了 headers: { 'x-admin-password': ... }
                });
                if (!response.ok && response.status !== 204) { 
                    let errorMsg = `無法刪除標籤 (HTTP ${response.status})`;
                    try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {}
                    throw new Error(errorMsg);
                }
                await fetchAndDisplayTags();
                await fetchAndDisplayProducts(); 
                if (typeof populateTagCheckboxes === 'function') {
                    if (addTagsContainer) await populateTagCheckboxes(addTagsContainer, []);
                    if (editTagsContainer) await populateTagCheckboxes(editTagsContainer, []);
                }
            } catch (error) {
                console.error(`刪除標籤 ${id} 失敗:`, error);
                if (tagManagementError) tagManagementError.textContent = `刪除標籤失敗: ${error.message}`;
                else alert(`刪除標籤失敗: ${error.message}`);
            }
        }
    };

    const tabButtons = document.querySelectorAll('.tab-button');
    if (tabButtons.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                const targetTab = this.getAttribute('data-tab');
                document.querySelectorAll('.tab-content').forEach(content => { content.style.display = 'none'; });
                tabButtons.forEach(btn => { btn.classList.remove('active'); });
                document.getElementById(targetTab).style.display = 'block';
                this.classList.add('active');
                if (targetTab === 'tag-management-tab') { fetchAndDisplayTags(); }
                if (targetTab === 'analytics-tab') { refreshAllCharts(); }
            });
        });
    }
    
    const activeTabButton = document.querySelector('.tab-button.active');
    if (activeTabButton) {
        const activeTabId = activeTabButton.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = content.id === activeTabId ? 'block' : 'none';
        });
        if (activeTabId === 'tag-management-tab') { fetchAndDisplayTags(); }
        if (activeTabId === 'analytics-tab') { refreshAllCharts(); }
    } else if (tabButtons.length > 0) { 
        tabButtons[0].click();
    }

    // --- 來源分析相關函數 ---
    function initializeSourceDatePickers() {
        const sourceStartDate = document.getElementById('source-start-date');
        const sourceEndDate = document.getElementById('source-end-date');
        if (sourceStartDate && sourceEndDate) {
            sourceStartDate.value = sourceTimeRange.startDate;
            sourceEndDate.value = sourceTimeRange.endDate;
        }
    }

    function refreshSourceCharts() {
        displaySourceDistribution();
        displaySourceTrend();
        displaySourceRanking();
        displaySourceConversion();
        displaySourceGeo();
        updateSourceTable();
    }

    async function displaySourceDistribution() {
        const ctx = document.getElementById('source-distribution-chart').getContext('2d');
        const loadingMsg = document.getElementById('source-chart-loading');
        
        if (loadingMsg) loadingMsg.style.display = 'block';
        
        try {
            const response = await fetch(`/api/analytics/source-traffic?startDate=${sourceTimeRange.startDate}&endDate=${sourceTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            
            const sourceTypes = {};
            data.forEach(item => {
                if (!sourceTypes[item.source_type]) {
                    sourceTypes[item.source_type] = 0;
                }
                sourceTypes[item.source_type] += parseInt(item.total_views);
            });

            if (sourceDistributionChart) {
                sourceDistributionChart.destroy();
            }

            sourceDistributionChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: Object.keys(sourceTypes).map(type => {
                        const total = sourceTypes[type];
                        const percentage = ((total / Object.values(sourceTypes).reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                        return `${type} (${percentage}%)`;
                    }),
                    datasets: [{
                        data: Object.values(sourceTypes),
                        backgroundColor: [
                            '#FF6384',
                            '#36A2EB',
                            '#FFCE56',
                            '#4BC0C0',
                            '#9966FF'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    if (data.labels.length && data.datasets.length) {
                                        return data.labels.map((label, i) => {
                                            const meta = chart.getDatasetMeta(0);
                                            const style = meta.controller.getStyle(i);
                                            return {
                                                text: label,
                                                fillStyle: style.backgroundColor,
                                                strokeStyle: style.borderColor,
                                                lineWidth: style.borderWidth,
                                                hidden: false,
                                                index: i
                                            };
                                        });
                                    }
                                    return [];
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    return `${label}: ${value} 訪問`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('載入來源分布圖表失敗:', error);
            if (ctx.canvas) {
                ctx.canvas.style.display = 'none';
            }
        } finally {
            if (loadingMsg) loadingMsg.style.display = 'none';
        }
    }

    async function displaySourceTrend() {
        const ctx = document.getElementById('source-trend-chart').getContext('2d');
        const loadingMsg = document.getElementById('source-trend-loading');
        
        if (loadingMsg) loadingMsg.style.display = 'block';
        
        try {
            const response = await fetch(`/api/analytics/source-trend?startDate=${sourceTimeRange.startDate}&endDate=${sourceTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            
            const dates = [...new Set(data.map(item => item.view_date))].sort();
            const sourceTypes = [...new Set(data.map(item => item.source_type))];
            
            const datasets = sourceTypes.map((sourceType, index) => {
                const color = [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF'
                ][index % 5];
                
                return {
                    label: sourceType,
                    data: dates.map(date => {
                        const match = data.find(item => item.view_date === date && item.source_type === sourceType);
                        return match ? match.views : 0;
                    }),
                    borderColor: color,
                    backgroundColor: color + '40',
                    fill: true,
                    tension: 0.4
                };
            });

            if (sourceTrendChart) {
                sourceTrendChart.destroy();
            }

            sourceTrendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            stacked: true
                        },
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.dataset.label}: ${context.parsed.y} 訪問`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('載入來源趨勢圖表失敗:', error);
            if (ctx.canvas) {
                ctx.canvas.style.display = 'none';
            }
        } finally {
            if (loadingMsg) loadingMsg.style.display = 'none';
        }
    }

    async function displaySourceRanking() {
        const ctx = document.getElementById('source-ranking-chart').getContext('2d');
        const loadingMsg = document.getElementById('source-ranking-loading');
        
        if (loadingMsg) loadingMsg.style.display = 'block';
        
        try {
            const response = await fetch(`/api/analytics/source-ranking?startDate=${sourceTimeRange.startDate}&endDate=${sourceTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            
            // 取前10名來源
            const top10Sources = data.slice(0, 10);
            
            if (sourceRankingChart) {
                sourceRankingChart.destroy();
            }

            sourceRankingChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: top10Sources.map(item => item.source_name || item.source_type),
                    datasets: [{
                        label: '訪問量',
                        data: top10Sources.map(item => item.total_views),
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
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `訪問量: ${context.parsed.x}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('載入來源排行圖表失敗:', error);
            if (ctx.canvas) {
                ctx.canvas.style.display = 'none';
            }
        } finally {
            if (loadingMsg) loadingMsg.style.display = 'none';
        }
    }

    async function displaySourceConversion() {
        const ctx = document.getElementById('source-conversion-chart').getContext('2d');
        const loadingMsg = document.getElementById('source-conversion-loading');
        
        if (loadingMsg) loadingMsg.style.display = 'block';
        
        try {
            const response = await fetch(`/api/analytics/source-conversion?startDate=${sourceTimeRange.startDate}&endDate=${sourceTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            
            if (sourceConversionChart) {
                sourceConversionChart.destroy();
            }

            sourceConversionChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(item => item.source_type),
                    datasets: [
                        {
                            label: '轉換率 (%)',
                            data: data.map(item => (item.conversion_rate * 100).toFixed(2)),
                            backgroundColor: 'rgba(75, 192, 192, 0.8)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1,
                            yAxisID: 'y'
                        },
                        {
                            label: '訪問量',
                            data: data.map(item => item.total_views),
                            backgroundColor: 'rgba(54, 162, 235, 0.4)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: '轉換率 (%)'
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                                display: true,
                                text: '訪問量'
                            },
                            grid: {
                                drawOnChartArea: false
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('載入來源轉換率圖表失敗:', error);
            if (ctx.canvas) {
                ctx.canvas.style.display = 'none';
            }
        } finally {
            if (loadingMsg) loadingMsg.style.display = 'none';
        }
    }

    async function displaySourceGeo() {
        const ctx = document.getElementById('source-geo-chart').getContext('2d');
        const loadingMsg = document.getElementById('source-geo-loading');
        
        if (loadingMsg) loadingMsg.style.display = 'block';
        
        try {
            const response = await fetch(`/api/analytics/source-geo?startDate=${sourceTimeRange.startDate}&endDate=${sourceTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            
            if (sourceGeoChart) {
                sourceGeoChart.destroy();
            }

            // 按國家/地區分組數據
            const regions = {};
            data.forEach(item => {
                if (!regions[item.region]) {
                    regions[item.region] = 0;
                }
                regions[item.region] += parseInt(item.views);
            });

            sourceGeoChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: Object.keys(regions),
                    datasets: [{
                        label: '訪問量',
                        data: Object.values(regions),
                        backgroundColor: 'rgba(153, 102, 255, 0.8)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: '各地區訪問量分布'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('載入地理分布圖表失敗:', error);
            if (ctx.canvas) {
                ctx.canvas.style.display = 'none';
            }
        } finally {
            if (loadingMsg) loadingMsg.style.display = 'none';
        }
    }

    async function updateSourceTable() {
        const tbody = document.getElementById('source-data-body');
        if (!tbody) return;
        
        try {
            const response = await fetch(`/api/analytics/source-details?startDate=${sourceTimeRange.startDate}&endDate=${sourceTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            
            tbody.innerHTML = '';
            data.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.source_type}</td>
                    <td>${item.source_name || '-'}</td>
                    <td>${item.source_url || '-'}</td>
                    <td>${item.total_views}</td>
                    <td>${item.unique_pages}</td>
                    <td>${formatDuration(item.avg_time_on_site)}</td>
                    <td>${(item.bounce_rate * 100).toFixed(2)}%</td>
                    <td>${(item.conversion_rate * 100).toFixed(2)}%</td>
                    <td>
                        <button class="action-btn" onclick="viewSourceDetails('${item.source_type}', '${item.source_name}')">
                            查看詳情
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('更新來源數據表格失敗:', error);
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">載入數據失敗</td></tr>';
        }
    }

    function formatDuration(seconds) {
        if (!seconds) return '-';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}分${remainingSeconds}秒`;
    }

    // 初始化來源分析頁面
    document.addEventListener('DOMContentLoaded', () => {
        const sourceStartDate = document.getElementById('source-start-date');
        const sourceEndDate = document.getElementById('source-end-date');
        const sourceApplyDate = document.getElementById('source-apply-date');
        const sourceResetDate = document.getElementById('source-reset-date');

        if (sourceStartDate && sourceEndDate) {
            initializeSourceDatePickers();
        }

        if (sourceApplyDate) {
            sourceApplyDate.addEventListener('click', () => {
                if (sourceStartDate && sourceEndDate && sourceStartDate.value && sourceEndDate.value) {
                    sourceTimeRange.startDate = sourceStartDate.value;
                    sourceTimeRange.endDate = sourceEndDate.value;
                    refreshSourceCharts();
                } else {
                    alert('請選擇有效的開始和結束日期');
                }
            });
        }

        if (sourceResetDate) {
            sourceResetDate.addEventListener('click', () => {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const today = new Date();

                if (sourceStartDate && sourceEndDate) {
                    sourceStartDate.value = thirtyDaysAgo.toISOString().split('T')[0];
                    sourceEndDate.value = today.toISOString().split('T')[0];
                    sourceTimeRange.startDate = sourceStartDate.value;
                    sourceTimeRange.endDate = sourceEndDate.value;
                    refreshSourceCharts();
                }
            });
        }

        // 當切換到來源分析 tab 時初始化圖表
        const sourceTabButton = document.querySelector('.tab-button[data-tab="source-analysis-tab"]');
        if (sourceTabButton) {
            sourceTabButton.addEventListener('click', () => {
                setTimeout(refreshSourceCharts, 100);
            });
        }
    });

    // 實現查看詳情功能
    window.viewSourceDetails = async function(sourceType, sourceName) {
        try {
            // 獲取指定日期範圍內該來源的詳細數據
            const response = await fetch(`/api/analytics/source-pages?sourceType=${encodeURIComponent(sourceType)}&sourceName=${encodeURIComponent(sourceName)}&startDate=${currentTimeRange.startDate}&endDate=${currentTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            
            // 創建一個模態框來顯示詳細信息
            const modalDiv = document.createElement('div');
            modalDiv.className = 'modal';
            modalDiv.style.display = 'flex';
            
            let tableRows = '';
            data.forEach(item => {
                tableRows += `
                    <tr>
                        <td>${item.page}</td>
                        <td>${item.views}</td>
                    </tr>
                `;
            });
            
            modalDiv.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                    <h2><i class="fas fa-chart-bar"></i> 來源頁面訪問詳情</h2>
                    <p><strong>來源類型:</strong> ${sourceType}</p>
                    <p><strong>來源名稱:</strong> ${sourceName || '-'}</p>
                    <p><strong>日期範圍:</strong> ${currentTimeRange.startDate} 至 ${currentTimeRange.endDate}</p>
                    
                    <div class="table-container" style="max-height: 400px; overflow-y: auto; margin-top: 1rem;">
                        <table class="product-list-table">
                            <thead>
                                <tr>
                                    <th>頁面路徑</th>
                                    <th>訪問量</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows || '<tr><td colspan="2" style="text-align: center;">無數據</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="primary-btn" onclick="this.closest('.modal').remove()">關閉</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modalDiv);
            
        } catch (error) {
            console.error('獲取來源詳情失敗:', error);
            alert(`無法獲取詳細資訊: ${error.message}`);
        }
    };

}); // --- End of DOMContentLoaded ---

window.showTagManagement = function() {
    const tagManagementTab = document.getElementById('tag-management-tab');
    const tagTabButton = document.querySelector('.tab-button[data-tab="tag-management-tab"]');
    if (tagManagementTab && tagTabButton) {
        document.querySelectorAll('.tab-content').forEach(content => { content.style.display = 'none'; });
        document.querySelectorAll('.tab-button').forEach(btn => { btn.classList.remove('active'); });
        tagManagementTab.style.display = 'block';
        tagTabButton.classList.add('active');
        if (typeof fetchAndDisplayTags === 'function') { fetchAndDisplayTags(); }
    }
};