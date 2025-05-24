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
    const addExpirationType = document.getElementById('add-expiration-type');
    const addDateRangeGroup = document.getElementById('add-date-range-group');
    const addStartDate = document.getElementById('add-start-date');
    const addEndDate = document.getElementById('add-end-date');
    
    const categoryOptionsDatalist = document.getElementById('categoryOptions');

    const tagsList = document.getElementById('tags-list');
    const addTagForm = document.getElementById('add-tag-form');
    const addTagInput = document.getElementById('add-tag-input');
    const tagManagementError = document.getElementById('tag-management-error');

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

    let sourceDistributionChart = null;
    let sourceTrendChart = null;
    let sourceRankingChart = null; // 雖然HTML中沒有此ID，但保留變數以防未來使用
    let sourceConversionChart = null; // 同上
    let sourceGeoChart = null; // 同上

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

                // --- 開始：在前端計算商品狀態 ---
                let statusDisplay = '';
                let statusClass = '';
                
                const expirationType = product.expiration_type !== undefined ? product.expiration_type : 0;

                if (expirationType === 1 && product.start_date && product.end_date) {
                    const now = new Date();
                    const startDateString = product.start_date;
                    const endDateString = product.end_date;
                    
                    let startDate = null;
                    let endDate = null;

                    if(startDateString) {
                        try { startDate = new Date(startDateString); } catch(e) { console.warn("Invalid start_date string for product", product.id, ":", startDateString); }
                    }
                    if(endDateString) {
                        try { endDate = new Date(endDateString); } catch(e) { console.warn("Invalid end_date string for product", product.id, ":", endDateString); }
                    }

                    if (startDate && !isNaN(startDate.getTime()) && endDate && !isNaN(endDate.getTime())) {
                        const endOfDayEndDate = new Date(endDate);
                        endOfDayEndDate.setHours(23, 59, 59, 999);

                        if (now < startDate) {
                            statusDisplay = '未開始';
                            statusClass = 'status-not-started';
                        } else if (now > endOfDayEndDate) {
                            statusDisplay = '已過期';
                            statusClass = 'status-expired';
                        } else {
                            const daysRemaining = Math.ceil((endOfDayEndDate - now) / (1000 * 60 * 60 * 24));
                            statusDisplay = `期限內 (剩 ${daysRemaining} 天)`;
                            statusClass = 'status-active';
                        }
                    } else {
                        statusDisplay = '日期錯誤';
                        statusClass = 'status-error';
                    }
                } else if (expirationType === 0) {
                    statusDisplay = '不限期';
                    statusClass = 'status-unlimited';
                } else {
                    statusDisplay = '日期未設'; 
                    statusClass = 'status-error';
                }
                // --- 結束：在前端計算商品狀態 ---

                const startDateDisplay = expirationType === 1 ? formatDate(product.start_date) : 'N/A';
                const endDateDisplay = expirationType === 1 ? formatDate(product.end_date) : 'N/A';
                
                const historicalClicks = product.historical_click_count !== null ? parseInt(product.historical_click_count, 10) : 0;
                const todayIncrement = product.today_click_increment !== null ? parseInt(product.today_click_increment, 10) : 0;
                const totalClicksCombined = historicalClicks + todayIncrement;
                let clickDisplayHtml = `${totalClicksCombined}`;
                if (todayIncrement > 0) {
                    clickDisplayHtml += ` <span style="color: red;">(+${todayIncrement})</span>`;
                }

                row.innerHTML = `
                    <td>${product.id}</td>
                    <td>${product.name || ''}</td>
                    <td>${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
                    <td>${clickDisplayHtml}</td>
                    <td>${product.category || '未分類'}</td>
                    <td><img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="width: 50px; height: auto; border: 1px solid #eee;"></td>
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
            if (loadingMessage) loadingMessage.textContent = `無法載入商品列表: ${error.message}`; 
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
            editProductId.value = product.id;
            // 填充ID顯示
            const idDisplaySpan = document.getElementById('edit-product-id-display');
            if (idDisplaySpan) idDisplaySpan.textContent = product.id;

            editProductName.value = product.name || '';
            editProductDescription.value = product.description || ''; 
            editProductPrice.value = product.price !== null ? product.price : ''; 
            editProductImageUrl.value = product.image_url || ''; 
            editProductSevenElevenUrl.value = product.seven_eleven_url || ''; 
            
            // 處理點擊數顯示
            const historicalClicks = product.historical_click_count !== null ? parseInt(product.historical_click_count, 10) : 0;
            const todayIncrement = product.today_click_increment !== null ? parseInt(product.today_click_increment, 10) : 0;
            const totalClicksCombinedForEdit = historicalClicks + todayIncrement;
            editProductClickCount.textContent = `${totalClicksCombinedForEdit} ${todayIncrement > 0 ? '(今日 +' + todayIncrement + ')' : ''}`;
            
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
                // product.tags 從伺服器端返回的是 tag_name 陣列，但 populateTagCheckboxes 需要 tag_id 陣列
                // 因此，我們需要先根據 tag_name 找到對應的 tag_id
                // 假設 /api/products/:id 返回的 tags 是 id 陣列 (如 server.js 中 COALESCE(json_agg(t.tag_id)...)
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
            
            try {
                const response = await fetch('/api/products', { // 注意：這裡應該是 /api/admin/products
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
    }

    function refreshAllCharts() {
        if (typeof displayTrafficChart === 'function') displayTrafficChart(currentGranularity);
        if (typeof displayPageRankingChart === 'function') displayPageRankingChart();
        if (typeof displayPageComparisonChart === 'function') displayPageComparisonChart();
        if (typeof displaySourceDistribution === 'function') displaySourceDistribution();
        if (typeof displaySourceTrend === 'function') displaySourceTrend();
        if (typeof updateSourceTable === 'function') updateSourceTable();
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
            Array.from(pageSelectMulti.options).slice(0, Math.min(5, pageSelectMulti.options.length)).forEach(opt => opt.selected = true);
            if (typeof displayPageComparisonChart === 'function') { // 確保圖表已初始化
                const selectedPages = Array.from(pageSelectMulti.selectedOptions).map(opt => opt.value);
                displayPageComparisonChart(selectedPages);
            }
        } catch (error) {
            console.error('获取页面列表失败:', error);
        }
    }

    async function displayPageComparisonChart(selectedPages = []) {
        if (!pageComparisonChartCanvas) return;
        if (chartLoadingMsg) chartLoadingMsg.style.display = 'block';
        if (chartErrorMsg) chartErrorMsg.style.display = 'none';
        if (pageComparisonChart) pageComparisonChart.destroy();
        
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
            const sortedDates = Array.from(dates).sort((a, b) => new Date(a) - new Date(b)); // Sort dates chronologically
            
            let datasetsToDisplay = [];
            if (selectedPages && selectedPages.length > 0) {
                 datasetsToDisplay = selectedPages.map((page, index) => {
                    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
                    return {
                        label: page,
                        data: sortedDates.map(date => pageData[page]?.[date] || 0),
                        borderColor: colors[index % colors.length],
                        backgroundColor: 'transparent',
                        tension: 0.2
                    };
                }).filter(ds => ds.data.some(d => d > 0)); // Filter out pages with no data in range
            }
            
            const ctx = pageComparisonChartCanvas.getContext('2d');
            pageComparisonChart = new Chart(ctx, {
                type: 'line',
                data: { labels: sortedDates, datasets: datasetsToDisplay },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, stacked: false }, x: { ticks: { maxRotation: 45, minRotation: 45 } } },
                    plugins: { title: { display: true, text: '熱門頁面訪問量對比' }, tooltip: { mode: 'index', intersect: false }, legend: { onClick: null } }
                }
            });
        } catch (error) {
            console.error('加載頁面對比圖表失敗:', error);
            if (chartErrorMsg) {
                chartErrorMsg.textContent = `無法加載頁面對比圖表: ${error.message}`;
                chartErrorMsg.style.display = 'block';
            }
        } finally {
            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
        }
    }

    async function displayPageRankingChart() {
        if (!pageRankingChartCanvas) return;
        if (pageRankingChart) pageRankingChart.destroy();
        try {
            const response = await fetch(`/api/analytics/page-views/ranking?startDate=${currentTimeRange.startDate}&endDate=${currentTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            const top10Pages = data.slice(0, 10); // Already sorted by API
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
                    plugins: { title: { display: true, text: `頁面訪問量排行榜 (Top 10)` }, legend: { display: false } }
                }
            });
        } catch (error) { console.error('加載頁面排行榜圖表失敗:', error); }
    }

    async function displayTrafficChart(granularity = 'daily') {
        if (!trafficChartCanvas) return;
        const ctx = trafficChartCanvas.getContext('2d');
        currentGranularity = granularity;

        if (startDateInput && endDateInput) { // Ensure date inputs are updated
            currentTimeRange.startDate = startDateInput.value || currentTimeRange.startDate;
            currentTimeRange.endDate = endDateInput.value || currentTimeRange.endDate;
        }
        
        if (chartLoadingMsg) chartLoadingMsg.style.display = 'block';
        if (chartErrorMsg) chartErrorMsg.style.display = 'none';
        if (currentChart) currentChart.destroy();
        trafficChartCanvas.style.display = 'none';
        
        let apiUrl = granularity === 'monthly' ? '/api/analytics/monthly-traffic' : '/api/analytics/traffic';
        apiUrl += `?startDate=${currentTimeRange.startDate}&endDate=${currentTimeRange.endDate}`;
        
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) { 
                let errorData = await response.json().catch(() => ({ error: `HTTP錯誤 ${response.status}` }));
                throw new Error(errorData.error || `HTTP錯誤 ${response.status}`); 
            }
            const trafficData = await response.json();
            trafficChartCanvas.style.display = 'block';
            if (trafficData.length === 0) {
                if (chartErrorMsg) { chartErrorMsg.textContent = '（選定日期範圍內尚無流量數據）'; chartErrorMsg.style.display = 'block'; chartErrorMsg.style.color = '#888'; }
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
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { ticks: { autoSkip: true, maxTicksLimit: granularity === 'daily' ? 15 : 12 } } },
                    responsive: true, maintainAspectRatio: false,
                    plugins: { title: { display: false }, legend: { display: true, position: 'top' } }
                }
            });
        } catch (error) {
            console.error(`繪製 ${granularity} 流量圖表失敗:`, error);
            if (chartErrorMsg) { chartErrorMsg.textContent = `無法載入圖表: ${error.message}`; chartErrorMsg.style.display = 'block'; chartErrorMsg.style.color = 'red'; }
        } finally {
             if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
        }
    }

    if (btnDaily && btnMonthly) {
        const toggleButtons = [btnDaily, btnMonthly];
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const newGranularity = button.dataset.granularity;
                toggleButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                displayTrafficChart(newGranularity); 
            });
        });
    }
    
    if (applyDateBtn) {
        applyDateBtn.addEventListener('click', function() {
            if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
                if (new Date(startDateInput.value) > new Date(endDateInput.value)) {
                    alert('開始日期不能晚於結束日期。'); return;
                }
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

    async function populateTagCheckboxes(container, selectedTagIds = []) {
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
                // 確保比較時類型一致
                checkbox.checked = selectedTagIds.map(id => String(id)).includes(String(tag.tag_id));
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
                        <button class="action-btn edit-btn" onclick="editTag(${tag.tag_id}, '${tag.tag_name.replace(/'/g, "\\'")}')">編輯</button>
                        <button class="action-btn delete-btn" onclick="deleteTag(${tag.tag_id})">刪除</button>
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
                const response = await fetch('/api/tags', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tag_name: tagName })
                });
                if (!response.ok) {
                    let errorData = await response.json().catch(() => ({error: `無法新增標籤 (HTTP ${response.status})`}));
                    throw new Error(errorData.error);
                }
                addTagInput.value = ''; await fetchAndDisplayTags();
            } catch (error) { console.error('新增標籤失敗:', error); if (tagManagementError) tagManagementError.textContent = `新增標籤錯誤: ${error.message}`; }
        });
    }

    window.editTag = async function(id, currentName) {
        const newName = prompt('請輸入新的標籤名稱:', currentName);
        if (newName === null || newName.trim() === '') return;
        
        try {
            const response = await fetch(`/api/tags/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag_name: newName.trim() })
            });
            if (!response.ok) {
                let errorData = await response.json().catch(() => ({error: `無法更新標籤 (HTTP ${response.status})`}));
                throw new Error(errorData.error);
            }
            await fetchAndDisplayTags();
            // Optionally refresh product tag checkboxes if they are visible
            if (addTagsContainer && addModal.style.display === 'flex') await populateTagCheckboxes(addTagsContainer, []);
            if (editTagsContainer && editModal.style.display === 'flex') {
                const currentProductId = editProductId.value;
                if(currentProductId) { // Re-fetch product to get updated tag list for checkboxes
                    const productResponse = await fetch(`/api/products/${currentProductId}`);
                    const product = await productResponse.json();
                    await populateTagCheckboxes(editTagsContainer, product.tags || []);
                }
            }
        } catch (error) {
            console.error(`更新標籤 ${id} 失敗:`, error);
            const targetErrorDisplay = tagManagementError || { textContent: '' }; // Fallback if tagManagementError is not visible
            targetErrorDisplay.textContent = `更新標籤失敗: ${error.message}`;
            if (!tagManagementError) alert(`更新標籤失敗: ${error.message}`);
        }
    };

    window.deleteTag = async function(id) {
        if (confirm(`確定要刪除此標籤嗎？此操作無法復原，並會從所有使用此標籤的商品中移除。`)) {
            try {
                const response = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
                if (!response.ok && response.status !== 204) { 
                    let errorData = await response.json().catch(() => ({error: `無法刪除標籤 (HTTP ${response.status})`}));
                    throw new Error(errorData.error);
                }
                await fetchAndDisplayTags();
                await fetchAndDisplayProducts(); 
                // Optionally refresh product tag checkboxes
                if (addTagsContainer && addModal.style.display === 'flex') await populateTagCheckboxes(addTagsContainer, []);
                if (editTagsContainer && editModal.style.display === 'flex') {
                     const currentProductId = editProductId.value;
                     if(currentProductId) {
                         const productResponse = await fetch(`/api/products/${currentProductId}`);
                         const product = await productResponse.json();
                         await populateTagCheckboxes(editTagsContainer, product.tags || []);
                     } else {
                         await populateTagCheckboxes(editTagsContainer, []);
                     }
                }
            } catch (error) {
                console.error(`刪除標籤 ${id} 失敗:`, error);
                const targetErrorDisplay = tagManagementError || { textContent: '' };
                targetErrorDisplay.textContent = `刪除標籤失敗: ${error.message}`;
                if (!tagManagementError) alert(`刪除標籤失敗: ${error.message}`);
            }
        }
    };

    const tabButtons = document.querySelectorAll('.tab-button');
    function switchTab(targetTabId) {
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = content.id === targetTabId ? 'block' : 'none';
            content.classList.toggle('active', content.id === targetTabId);
        });
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-tab') === targetTabId);
        });
        if (targetTabId === 'tag-management-tab') fetchAndDisplayTags();
        if (targetTabId === 'analytics-tab') {
            initializeDatePickers(); // Ensure dates are set for analytics
            refreshAllCharts();
        }
    }

    if (tabButtons.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                switchTab(this.getAttribute('data-tab'));
            });
        });
        // Initialize first tab or remembered tab
        const defaultTab = 'product-list-tab'; // Or read from localStorage
        switchTab(defaultTab);
    }
    
    // Initial data load
    fetchAndDisplayProducts(); 
    fetchCategories();         
    initializePageSelect(); 
    // Analytics charts will be loaded when tab is clicked

    // --- Source Analytics related functions (copied from previous context) ---
    function initializeSourceDatePickers() {
        const sourceStartDateEl = document.getElementById('source-start-date'); // Assuming you might add these later
        const sourceEndDateEl = document.getElementById('source-end-date');
        if (sourceStartDateEl && sourceEndDateEl) {
            sourceStartDateEl.value = sourceTimeRange.startDate;
            sourceEndDateEl.value = sourceTimeRange.endDate;
        }
    }

    function refreshSourceCharts() {
        if (typeof displaySourceDistribution === 'function') displaySourceDistribution();
        if (typeof displaySourceTrend === 'function') displaySourceTrend();
        // if (typeof displaySourceRanking === 'function') displaySourceRanking(); // HTML element for this chart might be missing
        // if (typeof displaySourceConversion === 'function') displaySourceConversion(); // HTML element for this chart might be missing
        // if (typeof displaySourceGeo === 'function') displaySourceGeo(); // HTML element for this chart might be missing
        if (typeof updateSourceTable === 'function') updateSourceTable();
    }

    async function displaySourceDistribution() {
        const canvas = document.getElementById('source-distribution-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const loadingMsg = document.getElementById('source-chart-loading');
        if (loadingMsg) loadingMsg.style.display = 'block';
        try {
            const response = await fetch(`/api/analytics/source-traffic?startDate=${sourceTimeRange.startDate}&endDate=${sourceTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            const sourceTypes = {};
            let totalViewsOverall = 0;
            data.forEach(item => {
                const views = parseInt(item.total_views) || 0; // Use total_views if available from API
                if (!sourceTypes[item.source_type]) sourceTypes[item.source_type] = 0;
                sourceTypes[item.source_type] += views;
                totalViewsOverall += views;
            });
            if (sourceDistributionChart) sourceDistributionChart.destroy();
            sourceDistributionChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: Object.keys(sourceTypes).map(type => {
                        const total = sourceTypes[type];
                        const percentage = totalViewsOverall > 0 ? ((total / totalViewsOverall) * 100).toFixed(1) : 0;
                        return `${type} (${total} / ${percentage}%)`;
                    }),
                    datasets: [{ data: Object.values(sourceTypes), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'] }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw} 訪問` } } } }
            });
        } catch (error) { console.error('載入來源分布圖表失敗:', error); } finally { if (loadingMsg) loadingMsg.style.display = 'none'; }
    }

    async function displaySourceTrend() {
        const canvas = document.getElementById('source-trend-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const loadingMsg = document.getElementById('source-trend-loading');
        if (loadingMsg) loadingMsg.style.display = 'block';
        try {
            const response = await fetch(`/api/analytics/source-trend?startDate=${sourceTimeRange.startDate}&endDate=${sourceTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            const dates = [...new Set(data.map(item => item.view_date))].sort((a,b) => new Date(a) - new Date(b));
            const sourceTypesPresent = [...new Set(data.map(item => item.source_type))];
            const datasets = sourceTypesPresent.map((sourceType, index) => {
                const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
                return {
                    label: sourceType,
                    data: dates.map(date => data.find(item => item.view_date === date && item.source_type === sourceType)?.views || 0),
                    borderColor: colors[index % colors.length], backgroundColor: colors[index % colors.length] + '40', fill: true, tension: 0.4
                };
            });
            if (sourceTrendChart) sourceTrendChart.destroy();
            sourceTrendChart = new Chart(ctx, {
                type: 'line', data: { labels: dates, datasets: datasets },
                options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index'}, scales: { y: { beginAtZero: true, stacked: true }, x: { ticks: { maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 15 } } }, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} 訪問` } } } }
            });
        } catch (error) { console.error('載入來源趨勢圖表失敗:', error); } finally { if (loadingMsg) loadingMsg.style.display = 'none'; }
    }
    
    async function updateSourceTable() {
        const tbody = document.getElementById('source-data-body');
        if (!tbody) return;
        try {
            const response = await fetch(`/api/analytics/source-details?startDate=${sourceTimeRange.startDate}&endDate=${sourceTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            tbody.innerHTML = '';
            if(data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">選定日期範圍內無來源數據</td></tr>';
                return;
            }
            data.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.source_type}</td>
                    <td>${item.source_name || '-'}</td>
                    <td><a href="${item.source_url || '#'}" target="_blank" rel="noopener noreferrer">${item.source_url ? (item.source_url.length > 30 ? item.source_url.substring(0, 30) + '...' : item.source_url) : '-'}</a></td>
                    <td>${item.total_views}</td>
                    <td>${item.unique_pages}</td>
                    <td>${formatDuration(item.avg_time_on_site)}</td>
                    <td>${(parseFloat(item.bounce_rate || 0) * 100).toFixed(2)}%</td>
                    <td>${(parseFloat(item.conversion_rate || 0) * 100).toFixed(2)}%</td>
                    <td><button class="action-btn" onclick="viewSourceDetails('${item.source_type}', '${item.source_name}')">詳情</button></td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('更新來源數據表格失敗:', error);
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">載入數據失敗</td></tr>';
        }
    }

    function formatDuration(seconds) {
        if (seconds === null || seconds === undefined || isNaN(seconds)) return '-';
        const totalSeconds = Math.round(seconds);
        const minutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        return `${minutes}分 ${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}秒`;
    }

    window.viewSourceDetails = async function(sourceType, sourceName) {
        try {
            const response = await fetch(`/api/analytics/source-pages?sourceType=${encodeURIComponent(sourceType)}&sourceName=${encodeURIComponent(sourceName)}&startDate=${currentTimeRange.startDate}&endDate=${currentTimeRange.endDate}`);
            if (!response.ok) throw new Error(`HTTP錯誤 ${response.status}`);
            const data = await response.json();
            const modalDiv = document.createElement('div');
            modalDiv.className = 'modal';
            modalDiv.style.display = 'flex';
            let tableRows = data.map(item => `<tr><td>${item.page}</td><td>${item.views}</td></tr>`).join('');
            if(data.length === 0) tableRows = '<tr><td colspan="2" style="text-align: center;">此來源在此日期範圍內無特定頁面數據</td></tr>';
            modalDiv.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                    <h2><i class="fas fa-chart-bar"></i> 來源頁面訪問詳情</h2>
                    <p><strong>來源類型:</strong> ${sourceType}</p>
                    <p><strong>來源名稱:</strong> ${sourceName || '-'}</p>
                    <p><strong>日期範圍:</strong> ${currentTimeRange.startDate} 至 ${currentTimeRange.endDate}</p>
                    <div class="table-container" style="max-height: 400px; overflow-y: auto; margin-top: 1rem;">
                        <table class="product-list-table"><thead><tr><th>頁面路徑</th><th>訪問量</th></tr></thead><tbody>${tableRows}</tbody></table>
                    </div>
                    <div class="modal-actions"><button class="primary-btn" onclick="this.closest('.modal').remove()">關閉</button></div>
                </div>`;
            document.body.appendChild(modalDiv);
        } catch (error) { console.error('獲取來源詳情失敗:', error); alert(`無法獲取詳細資訊: ${error.message}`); }
    };
});

window.showTagManagement = function() { // Make sure this is globally accessible for admin.html
    const tabButton = document.querySelector('.tab-button[data-tab="tag-management-tab"]');
    if(tabButton) tabButton.click(); // Simulate click to use existing switchTab logic
};