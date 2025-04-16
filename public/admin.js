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
    // const addImagePreview = document.getElementById('add-image-preview'); // HTML 中沒有此 ID
    const addProductSevenElevenUrl = document.getElementById('add-product-seven-eleven-url');
    const addFormError = document.getElementById('add-form-error');

    // --- *** 圖表相關元素 *** ---
    const trafficChartCanvas = document.getElementById('traffic-chart');
    const chartLoadingMsg = document.getElementById('chart-loading-msg'); // 確保 HTML 中有此 ID
    const chartErrorMsg = document.getElementById('chart-error-msg');     // 確保 HTML 中有此 ID
    const btnDaily = document.getElementById('btn-daily');
    const btnMonthly = document.getElementById('btn-monthly');
    let currentChart = null; // 用於儲存 Chart.js 實例
    let currentGranularity = 'daily'; // 當前圖表粒度 

    // --- Function to Fetch and Display ALL Products in the Table ---
    async function fetchAndDisplayProducts() {
        // ... (這個函數的內部邏輯保持不變) ...
        if (!productListBody || !productListContainer || !productTable) { console.error("Admin page table elements not found."); if(loadingMessage) loadingMessage.textContent = '頁面結構錯誤，無法載入列表。'; return; } try { if (loadingMessage) loadingMessage.style.display = 'block'; if (productTable) productTable.style.display = 'none'; const response = await fetch('/api/products'); if (!response.ok) { throw new Error(`HTTP 錯誤！狀態: ${response.status}`); } const products = await response.json(); if (loadingMessage) loadingMessage.style.display = 'none'; if (productTable) productTable.style.display = 'table'; productListBody.innerHTML = ''; if (products.length === 0) { productListBody.innerHTML = '<tr><td colspan="6">目前沒有商品。</td></tr>'; return; } products.forEach(product => { const row = document.createElement('tr'); row.dataset.productId = product.id; row.innerHTML = `<td>${product.id}</td><td>${product.name || ''}</td><td>${product.price !== null ? Math.floor(product.price) : 'N/A'}</td><td>${product.click_count !== null ? product.click_count : '0'}</td><td><img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name || ''}" style="width: 50px; height: auto; border: 1px solid #eee;"></td><td><button class="action-btn edit-btn" onclick="editProduct(${product.id})">編輯</button><button class="action-btn delete-btn" onclick="deleteProduct(${product.id})">刪除</button></td>`; productListBody.appendChild(row); }); } catch (error) { console.error("獲取管理商品列表失敗:", error); if (loadingMessage) loadingMessage.textContent = '無法載入商品列表。'; if (productTable) productTable.style.display = 'none'; }
    }

    // --- Function to Open and Populate the Edit Modal ---
    async function openEditModal(id) {
        // ... (這個函數的內部邏輯保持不變, 確保包含填充點擊數) ...
        const requiredEditElements = [editModal, editForm, editProductId, editProductName, editProductDescription, editProductPrice, editProductImageUrl, editImagePreview, editProductSevenElevenUrl, editProductClickCount, editFormError]; if (requiredEditElements.some(el => !el)) { console.error("一個或多個編輯 Modal 元件在 HTML 中缺失。"); alert("編輯視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。"); return; } editFormError.textContent = ''; editForm.reset(); editImagePreview.style.display = 'none'; editImagePreview.src = ''; try { const response = await fetch(`/api/products/${id}`); if (!response.ok) { if (response.status === 404) throw new Error('找不到該商品。'); throw new Error(`無法獲取商品資料 (HTTP ${response.status})`); } const product = await response.json(); editProductId.value = product.id; editProductName.value = product.name || ''; editProductDescription.value = product.description || ''; editProductPrice.value = product.price !== null ? product.price : ''; editProductImageUrl.value = product.image_url || ''; editProductSevenElevenUrl.value = product.seven_eleven_url || ''; editProductClickCount.textContent = product.click_count !== null ? product.click_count : '0'; if (product.image_url) { editImagePreview.src = product.image_url; editImagePreview.style.display = 'block'; } else { editImagePreview.style.display = 'none'; } editModal.style.display = 'flex'; } catch (error) { console.error(`獲取商品 ${id} 進行編輯時出錯:`, error); alert(`無法載入編輯資料： ${error.message}`); }
    }

    // --- Function to Close the Edit Modal ---
    window.closeModal = function() { if (editModal) { editModal.style.display = 'none'; } }

    // --- Function to Close the Add Modal ---
    window.closeAddModal = function() { if (addModal) { addModal.style.display = 'none'; } }

    // --- Attach Edit Function to Global Scope ---
    window.editProduct = function(id) { openEditModal(id); };

    // --- Attach Delete Function to Global Scope ---
    window.deleteProduct = async function(id) {
        // ... (這個函數的內部邏輯保持不變) ...
        if (confirm(`確定要刪除商品 ID: ${id} 嗎？此操作無法復原！`)) { try { const response = await fetch(`/api/products/${id}`, { method: 'DELETE' }); if (response.status === 204 || response.ok) { await fetchAndDisplayProducts(); } else { let errorMsg = `刪除失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${response.statusText}`; } throw new Error(errorMsg); } } catch (error) { alert(`刪除時發生錯誤：${error.message}`); } }
    };

    // --- Attach Show Add Form Function to Global Scope ---
    window.showAddForm = function() {
         // ... (這個函數的內部邏輯保持不變) ...
         const requiredAddElements = [addModal, addForm, addProductName, addProductDescription, addProductPrice, addProductImageUrl, addProductSevenElevenUrl, addFormError]; if (requiredAddElements.some(el => !el)) { alert("新增視窗元件錯誤，無法開啟。請檢查 admin.html 檔案。"); return; } addFormError.textContent = ''; addForm.reset(); addModal.style.display = 'flex';
    }

    // --- Close Modals if User Clicks Outside of Modal Content ---
    window.onclick = function(event) { if (event.target == editModal) { closeModal(); } else if (event.target == addModal) { closeAddModal(); } }

    // --- Edit Form Submission Listener ---
    if (editForm) {
        editForm.addEventListener('submit', async (event) => {
             // ... (這個函數的內部邏輯保持不變) ...
             event.preventDefault(); editFormError.textContent = ''; const productId = editProductId.value; if (!productId) { editFormError.textContent = '錯誤：找不到商品 ID。'; return; } let priceValue = editProductPrice.value.trim() === '' ? null : parseFloat(editProductPrice.value); const updatedData = { name: editProductName.value.trim(), description: editProductDescription.value.trim(), price: priceValue, image_url: editProductImageUrl.value.trim() || null, seven_eleven_url: editProductSevenElevenUrl.value.trim() || null }; if (!updatedData.name) { editFormError.textContent = '商品名稱不能為空。'; return; } if (updatedData.price !== null && isNaN(updatedData.price)) { editFormError.textContent = '價格必須是有效的數字。'; return; } if (updatedData.price !== null && updatedData.price < 0) { editFormError.textContent = '價格不能是負數。'; return; } const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'); if (!isBasicUrlValid(updatedData.seven_eleven_url)) { editFormError.textContent = '7-11 連結格式不正確 (應為 http/https 開頭)。'; return; } try { const response = await fetch(`/api/products/${productId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) }); if (!response.ok) { let errorMsg = `儲存失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); } closeModal(); await fetchAndDisplayProducts(); } catch (error) { editFormError.textContent = `儲存錯誤：${error.message}`; }
        });
    } else { console.error("編輯表單元素未找到。"); }

    // --- Add Form Submission Listener ---
    if (addForm) {
        addForm.addEventListener('submit', async (event) => {
             // ... (這個函數的內部邏輯保持不變) ...
             event.preventDefault(); addFormError.textContent = ''; let priceValue = addProductPrice.value.trim() === '' ? null : parseFloat(addProductPrice.value); const newProductData = { name: addProductName.value.trim(), description: addProductDescription.value.trim(), price: priceValue, image_url: addProductImageUrl.value.trim() || null, seven_eleven_url: addProductSevenElevenUrl.value.trim() || null }; if (!newProductData.name) { addFormError.textContent = '商品名稱不能為空。'; return; } if (newProductData.price !== null && isNaN(newProductData.price)) { addFormError.textContent = '價格必須是有效的數字。'; return; } if (newProductData.price !== null && newProductData.price < 0) { addFormError.textContent = '價格不能是負數。'; return; } const isBasicUrlValid = (url) => !url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'); if (!isBasicUrlValid(newProductData.seven_eleven_url)) { addFormError.textContent = '7-11 連結格式不正確 (應為 http/https 開頭)。'; return; } try { const response = await fetch(`/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProductData) }); if (!response.ok) { let errorMsg = `新增失敗 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {} throw new Error(errorMsg); } closeAddModal(); await fetchAndDisplayProducts(); } catch (error) { addFormError.textContent = `新增錯誤：${error.message}`; }
        });
    } else { console.error("新增表單元素未找到。"); }


    // --- *** 圖表相關邏輯 *** ---





    async function displayPageComparisonChart() {
        if (chartLoadingMsg) chartLoadingMsg.style.display = 'block';
        if (chartErrorMsg) chartErrorMsg.style.display = 'none';
        
        try {
          // 获取最近30天的数据
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const startDate = thirtyDaysAgo.toISOString().split('T')[0];
          const endDate = new Date().toISOString().split('T')[0];
          
          const response = await fetch(`/api/analytics/page-views?startDate=${startDate}&endDate=${endDate}`);
          if (!response.ok) throw new Error(`HTTP错误 ${response.status}`);
          
          const data = await response.json();
          
          // 处理数据，按页面分组
          const pageData = {};
          const dates = new Set();
          
          data.forEach(item => {
            if (!pageData[item.page]) pageData[item.page] = {};
            pageData[item.page][item.view_date] = item.count;
            dates.add(item.view_date);
          });
          
          // 排序日期
          const sortedDates = Array.from(dates).sort();
          
          // 准备图表数据
          const datasets = Object.keys(pageData)
            .sort((a, b) => {
              // 计算总访问量以排序
              const totalA = Object.values(pageData[a]).reduce((sum, val) => sum + val, 0);
              const totalB = Object.values(pageData[b]).reduce((sum, val) => sum + val, 0);
              return totalB - totalA;
            })
            .slice(0, 5) // 只取前5个最热门页面
            .map((page, index) => {
              // 为每个页面创建一个数据集，使用不同颜色
              const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
              return {
                label: page,
                data: sortedDates.map(date => pageData[page][date] || 0),
                borderColor: colors[index % colors.length],
                backgroundColor: 'transparent',
                tension: 0.2
              };
            });
          
          // 创建图表
          const ctx = document.getElementById('page-comparison-chart').getContext('2d');
          new Chart(ctx, {
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
                  text: '热门页面访问量对比 (前5名)'
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
          console.error('加载页面对比图表失败:', error);
          if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
          if (chartErrorMsg) {
            chartErrorMsg.textContent = `无法加载页面对比图表: ${error.message}`;
            chartErrorMsg.style.display = 'block';
          }
        }
      }




      async function displayPageRankingChart() {
        try {
          const response = await fetch('/api/analytics/page-views/ranking');
          if (!response.ok) throw new Error(`HTTP错误 ${response.status}`);
          
          const data = await response.json();
          
          // 排序页面按总访问量
          data.sort((a, b) => b.total_count - a.total_count);
          const top10Pages = data.slice(0, 10);
          
          // 创建图表
          const ctx = document.getElementById('page-ranking-chart').getContext('2d');
          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: top10Pages.map(item => item.page),
              datasets: [{
                label: '总访问量',
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
                  text: '页面访问量排行榜 (前10名)'
                },
                legend: {
                  display: false
                }
              }
            }
          });
        } catch (error) {
          console.error('加载页面排行榜图表失败:', error);
        }
      }



    /**
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 獲取並繪製流量圖表
     * @param {string} granularity - 'daily' 或 'monthly'
     */
    async function displayTrafficChart(granularity = 'daily') {
        if (!trafficChartCanvas) { console.warn("找不到 traffic-chart canvas 元素。"); return; }
        const ctx = trafficChartCanvas.getContext('2d');
        currentGranularity = granularity;

        if (chartLoadingMsg) chartLoadingMsg.style.display = 'block';
        if (chartErrorMsg) chartErrorMsg.style.display = 'none';
        if (currentChart) { currentChart.destroy(); currentChart = null; }
        trafficChartCanvas.style.display = 'none';

        let apiUrl = '/api/analytics/traffic';
        if (granularity === 'monthly') { apiUrl = '/api/analytics/monthly-traffic'; }

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) { let errorMsg = `無法獲取流量數據 (HTTP ${response.status})`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch(e){} throw new Error(errorMsg); }
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
                type: 'line',
                data: { labels: labels, datasets: [{ label: granularity === 'daily' ? '每日頁面瀏覽量' : '每月頁面瀏覽量', data: dataPoints, borderColor: granularity === 'daily' ? 'rgb(54, 162, 235)' : 'rgb(255, 159, 64)', backgroundColor: granularity === 'daily' ? 'rgba(54, 162, 235, 0.1)' : 'rgba(255, 159, 64, 0.1)', fill: true, tension: 0.2 }] },
                options: { scales: { y: { beginAtZero: true, ticks: { stepSize: granularity === 'daily' ? 1 : undefined } } }, responsive: true, maintainAspectRatio: false, plugins: { title: { display: false }, legend: { display: true, position: 'top' } } }
            });
        } catch (error) {
            console.error(`繪製 ${granularity} 流量圖表失敗:`, error);
            if (chartLoadingMsg) chartLoadingMsg.style.display = 'none';
            if (chartErrorMsg) { chartErrorMsg.textContent = `無法載入圖表: ${error.message}`; chartErrorMsg.style.display = 'block'; chartErrorMsg.style.color = 'red'; }
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
    } else { console.warn("找不到圖表切換按鈕。"); }

    // --- Initial Load ---
    fetchAndDisplayProducts(); // 載入商品列表
    displayTrafficChart('daily'); // 預設載入每日流量圖表

}); // --- End of DOMContentLoaded ---