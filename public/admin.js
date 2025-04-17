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
    const editFormError = document.getElementById('edit-form-error');

    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-product-form');
    const addProductName = document.getElementById('add-product-name');
    const addProductDescription = document.getElementById('add-product-description');
    const addProductPrice = document.getElementById('add-product-price');
    const addProductImageUrl = document.getElementById('add-product-image-url');
    const addProductSevenElevenUrl = document.getElementById('add-product-seven-eleven-url');
    const addFormError = document.getElementById('add-form-error');

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
            
            const response = await fetch('/api/products'); 
            if (!response.ok) { 
                throw new Error(`HTTP 錯誤！狀態: ${response.status}`); 
            } 
            
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
                    <td>${product.name || ''}</td>
                    <td>${product.price !== null ? Math.floor(product.price) : 'N/A'}</td>
                    <td>${product.click_count !== null ? product.click_count : '0'}</td>
                    <td><img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="width: 50px; height: auto; border: 1px solid #eee;"></td>
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
        const requiredEditElements = [editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError]; 
        
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
            
            if (product.image_url) { 
                editImagePreview.src = product.image_url; 
                editImagePreview.style.display = 'block'; 
            } else { 
                editImagePreview.style.display = 'none'; 
            } 
            
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

    // --- Attach Delete Function to Global Scope ---
    window.deleteProduct = async function(id) {
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) { 
            try { 
                const response = await fetch(`/api/products/${id}`, { method: 'DELETE' }); 
                if (response.status === 204 || response.ok) { 
                    await fetchAndDisplayProducts(); 
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
        const requiredAddElements = [addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addProductSevenElevenUrl, addFormError]; 
        
        if (requiredAddElements.some(el => !el)) { 
            alert("新增視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。"); 
            return; 
        } 
        
        addFormError.textContent = ''; 
        addForm.reset(); 
        addModal.style.display = 'flex';
    }

    // --- Close Modals if User Clicks Outside of Modal Content ---
    window.onclick = function(event) { 
        if (event.target == editModal) { 
            closeModal(); 
        } else if (event.target == addModal) { 
            closeAddModal(); 
        } 
    }

    // --- Edit Form Submission Listener ---
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
                image_url: editProductImageUrl.value.trim() || null, 
                seven_eleven_url: editProductSevenElevenUrl.value.trim() || null 
            }; 
            
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
            if (!isBasicUrlValid(updatedData.seven_eleven_url)) { 
                editFormError.textContent = '7-11 連結格式不正確 (應為 http/https 開頭)。'; 
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
            } catch (error) { 
                editFormError.textContent = `儲存錯誤：${error.message}`; 
            }
        });
    } else { 
        console.error("編輯表單元素未找到。"); 
    }

    // --- Add Form Submission Listener ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
            event.preventDefault(); 
            addFormError.textContent = ''; 
            
            let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value); 
            const newProductData = { 
                name: addProductName.value.trim(), 
                description: addProductDescription.value.trim(), 
                price: priceValue, 
                image_url: addProductImageUrl.value.trim() || null, 
                seven_eleven_url: addProductSevenElevenUrl.value.trim() || null 
            }; 
            
            if (!newProductData.name) { 
                addFormError.textContent = '商品名稱不能為空。'; 
                return; 
            } 
            
            if (newProductData.price !== null && isNaN(newProductData.price)) { 
                addFormError.textContent = '價格必須是有效的數字。'; 
                return; 
            } 
            
            if (newProductData.price !== null && newProductData.price < 0) { 
                addFormError.textContent = '價格不能是負數。'; 
                return; 
            } 
            
            const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'); 
            if (!isBasicUrlValid(newProductData.seven_eleven_url)) { 
                addFormError.textContent = '7-11 連結格式不正確 (應為 http/https 開頭)。'; 
                return; 
            } 
            
            try { 
                const response = await fetch(`/api/products`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(newProductData) 
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
initializeDatePickers(); // 初始化日期選擇器
initializePageSelect(); // 初始化頁面選擇器

// 延遲載入圖表，避免同時初始化多個圖表
setTimeout(() => {
    displayTrafficChart('daily'); // 預設載入每日流量圖表
}, 300);

}); // --- End of DOMContentLoaded ---