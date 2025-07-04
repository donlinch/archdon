// public/sales-report.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const salesForm = document.getElementById('sales-form');
    const formTitle = document.getElementById('form-title');
    const saleIdInput = document.getElementById('sale-id');
    const productNameInput = document.getElementById('product-name');
    const quantitySoldInput = document.getElementById('quantity-sold');
    const saleTimestampInput = document.getElementById('sale-timestamp');
    const saveBtn = document.getElementById('save-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const formError = document.getElementById('form-error');

    const filterStartDateInput = document.getElementById('filter-start-date');
    const filterEndDateInput = document.getElementById('filter-end-date');
    const filterProductNameInput = document.getElementById('filter-product-name');
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const clearFilterBtn = document.getElementById('clear-filter-btn');

    const salesTableBody = document.getElementById('sales-table-body');
    const loadingIndicator = document.getElementById('loading-indicator');

    const summaryTotalItems = document.getElementById('summary-total-items');
    const summaryTopProductName = document.getElementById('summary-top-product-name');
    const summaryTopProductQty = document.getElementById('summary-top-product-qty');
    const summaryTopProductName2 = document.getElementById('summary-top-product-name-2');
    const summaryTopProductQty2 = document.getElementById('summary-top-product-qty-2');
    const summaryTopProductName3 = document.getElementById('summary-top-product-name-3');
    const summaryTopProductQty3 = document.getElementById('summary-top-product-qty-3');
    const existingProductsListSpan = document.getElementById('existing-products-list');
const productSuggestionsDatalist = document.getElementById('product-suggestions'); 

    const salesTrendChartCtx = document.getElementById('sales-trend-chart').getContext('2d');
    const topProductsChartCtx = document.getElementById('top-products-chart').getContext('2d');

    // Drawer elements
    const openDrawerBtn = document.getElementById('open-drawer-btn');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const exportExcelBtn = document.getElementById('export-excel-btn'); // 新增：匯出按鈕的 DOM 引用
    const slideOutDrawer = document.getElementById('slide-out-drawer');
    const drawerTabButtons = document.querySelectorAll('.drawer-tab-button');
    const drawerTabContents = document.querySelectorAll('.drawer-tab-content');

    let salesTrendChartInstance = null;
    let topProductsChartInstance = null;
    let allSalesRecords = []; // <--- 1. 儲存詳細銷售數據的變數


    const fetchExistingProductNames = async () => {
        try {
            const response = await fetch('/api/admin/sales/product-names');
            if (!response.ok) {
                throw new Error(`獲取商品名稱失敗: ${response.statusText}`);
            }
            const productNames = await response.json();
            renderExistingProductNames(productNames);
        } catch (error) {
            console.error('獲取現有商品名稱時出錯:', error);
            if (existingProductsListSpan) {
                 existingProductsListSpan.textContent = '載入商品名稱失敗。';
                 existingProductsListSpan.style.color = 'red';
            }
            if (productSuggestionsDatalist) { // 可選
                productSuggestionsDatalist.innerHTML = '';
            }
        }
    };



    // --- Utility Functions ---
    const showLoading = (show = true) => {
        loadingIndicator.style.display = show ? 'block' : 'none';
    };

    const showFormError = (message) => {
        formError.textContent = message;
    };

    const clearFormError = () => {
        formError.textContent = '';
    };

    const clearForm = () => {
        salesForm.reset(); // 重置表單
        saleIdInput.value = ''; // 清空隱藏 ID
        formTitle.textContent = '新增銷售紀錄';
        saveBtn.textContent = '新增紀錄';
        cancelEditBtn.style.display = 'none'; // 隱藏取消編輯按鈕
        clearFormError();
        setDefaultSaleTimestamp(); // 重設時間為當前
    };

    // 將 ISO 格式的日期時間 (YYYY-MM-DDTHH:mm:ss.sssZ) 轉換為 datetime-local 需要的格式 (YYYY-MM-DDTHH:mm)
     const formatTimestampForInput = (isoTimestamp) => {
        if (!isoTimestamp) return '';
        try {
            const date = new Date(isoTimestamp);
             // 檢查日期是否有效
             if (isNaN(date.getTime())) {
                 console.error("Invalid date for formatting:", isoTimestamp);
                 return ""; // 返回空字符串或默認值
             }
            // 手動補零
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (e) {
            console.error("Error formatting timestamp:", isoTimestamp, e);
            return ""; // 出錯時返回空字符串
        }
    };

    // 設定銷售時間預設為目前時間
    const setDefaultSaleTimestamp = () => {
        const now = new Date();
        now.setSeconds(0, 0); // 移除秒和毫秒
        saleTimestampInput.value = formatTimestampForInput(now.toISOString());
    };


    // --- API Fetch Functions ---
    const fetchSalesData = async (params = {}) => {
        showLoading(true);
        salesTableBody.innerHTML = ''; // 清空表格內容
        try {
            const urlParams = new URLSearchParams(params);
            const response = await fetch(`/api/admin/sales?${urlParams.toString()}`);
            if (!response.ok) {
                throw new Error(`獲取銷售數據失敗: ${response.statusText}`);
            }
            const sales = await response.json();
            allSalesRecords = sales; // <--- 1. 填充詳細銷售數據
            renderSalesTable(sales);
        } catch (error) {
            console.error('獲取銷售數據時出錯:', error);
            salesTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">加載失敗: ${error.message}</td></tr>`;
        } finally {
            showLoading(false);
        }
    };

     const fetchSummaryData = async (params = {}) => {
        try {
            const urlParams = new URLSearchParams(params);
            const response = await fetch(`/api/admin/sales/summary?${urlParams.toString()}`);
            if (!response.ok) {
                throw new Error(`獲取彙總數據失敗: ${response.statusText}`);
            }
            const summary = await response.json();
            renderSummary(summary);
            renderCharts(summary);
        } catch (error) {
            console.error('獲取彙總數據時出錯:', error);
            // 可以在此處顯示錯誤訊息或重置彙總區塊
             resetSummary();
             resetCharts();
        }
    };


    // --- Rendering Functions ---
    const renderSalesTable = (sales) => {
        if (sales.length === 0) {
            salesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">找不到符合條件的銷售紀錄。</td></tr>';
            return;
        }

        salesTableBody.innerHTML = sales.map(sale => `
            <tr>
                <td>${new Date(sale.sale_timestamp).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short', hour12: false })}</td>
                <td>${escapeHtml(sale.product_name)}</td>
                <td>${sale.quantity_sold}</td>
                <td class="actions">
                    <button class="btn-warning edit-btn" data-id="${sale.id}" data-name="${escapeHtml(sale.product_name)}" data-quantity="${sale.quantity_sold}" data-timestamp="${sale.sale_timestamp}">編輯</button>
                    <button class="btn-danger delete-btn" data-id="${sale.id}" data-name="${escapeHtml(sale.product_name)}">刪除</button>
                </td>
            </tr>
        `).join('');

        // 為新生成的按鈕添加事件監聽器
        addTableButtonListeners();
    };

    const resetSummary = () => {
         summaryTotalItems.textContent = '0';
         summaryTopProductName.textContent = '-';
         summaryTopProductQty.textContent = '0 件';
         summaryTopProductName2.textContent = '-';
         summaryTopProductQty2.textContent = '0 件';
         summaryTopProductName3.textContent = '-';
         summaryTopProductQty3.textContent = '0 件';
    };

    const renderSummary = (summary) => {
         summaryTotalItems.textContent = summary.totalItems || 0;
         const top1 = summary.topProducts[0];
         const top2 = summary.topProducts[1];
         const top3 = summary.topProducts[2];

         summaryTopProductName.textContent = top1 ? escapeHtml(top1.product_name) : '-';
         summaryTopProductQty.textContent = top1 ? `${top1.total_sold} 件` : '0 件';
         summaryTopProductName2.textContent = top2 ? escapeHtml(top2.product_name) : '-';
         summaryTopProductQty2.textContent = top2 ? `${top2.total_sold} 件` : '0 件';
         summaryTopProductName3.textContent = top3 ? escapeHtml(top3.product_name) : '-';
         summaryTopProductQty3.textContent = top3 ? `${top3.total_sold} 件` : '0 件';
    };

     const resetCharts = () => {
         if (salesTrendChartInstance) {
             salesTrendChartInstance.destroy();
             salesTrendChartInstance = null;
         }
         if (topProductsChartInstance) {
             topProductsChartInstance.destroy();
             topProductsChartInstance = null;
         }
     };
 
     // --- 2. 輔助函數：聚合每日商品詳情 ---
     const getDetailedItemsForDate = (targetDateString, salesRecords) => {
         if (!salesRecords || salesRecords.length === 0) {
             return [];
         }
         const dailyItemsMap = new Map();
         salesRecords.forEach(record => {
             // 確保 record.sale_timestamp 是有效的日期時間字符串
             if (record.sale_timestamp) {
                 const recordDate = new Date(record.sale_timestamp).toISOString().split('T')[0];
                 if (recordDate === targetDateString) {
                     const productName = record.product_name;
                     const quantity = parseInt(record.quantity_sold, 10);
                     if (dailyItemsMap.has(productName)) {
                         dailyItemsMap.set(productName, dailyItemsMap.get(productName) + quantity);
                     } else {
                         dailyItemsMap.set(productName, quantity);
                     }
                 }
             }
         });
         // 轉換 Map 為期望的數組格式
         const detailedItems = [];
         dailyItemsMap.forEach((quantity, name) => {
             detailedItems.push({ name: name, quantity: quantity });
         });
         return detailedItems.sort((a,b) => b.quantity - a.quantity); // 按數量降序排列
     };
 
      const renderCharts = (summary) => {
         // 明確銷毀舊圖表實例
         if (salesTrendChartInstance) {
             salesTrendChartInstance.destroy();
             salesTrendChartInstance = null; // 確保完全清除
         }
         if (topProductsChartInstance) {
             topProductsChartInstance.destroy();
             topProductsChartInstance = null; // 確保完全清除
         }
     
         // --- 3. 修改 renderCharts ---
         // 3.1 數據準備: 為 summary.salesTrend 的每個條目添加 detailedItems
         const salesTrendWithDetails = summary.salesTrend.map(trendItem => {
             return {
                 date: trendItem.date, // X 軸的值
                 quantity: trendItem.quantity, // Y 軸的值 (總量)
                 detailedItems: getDetailedItemsForDate(trendItem.date, allSalesRecords) // 當日詳細銷售
             };
         });
     
         salesTrendChartInstance = new Chart(salesTrendChartCtx, {
             type: 'bar',
             data: {
                 // labels 不再直接使用 trendLabels，因為 x 軸會從數據對象中解析
                 datasets: [{
                     label: '每日銷售件數',
                     data: salesTrendWithDetails, // <--- 使用包含詳細資訊的數據
                     backgroundColor: 'rgba(75, 192, 192, 0.6)',
                     borderColor: 'rgb(75, 192, 192)',
                     borderWidth: 1
                 }]
             },
             options: { // <--- 3.2 添加 parsing 配置
                 parsing: {
                     xAxisKey: 'date',
                     yAxisKey: 'quantity'
                 },
                responsive: true,
                maintainAspectRatio: false,
                interaction: { // 增強互動
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                const dataPoint = tooltipItems[0].chart.data.datasets[tooltipItems[0].datasetIndex].data[tooltipItems[0].dataIndex];
                                if (dataPoint && dataPoint.date) {
                                    const date = new Date(dataPoint.date + 'T00:00:00'); // 確保解析為本地日期
                                    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
                                }
                                return '';
                            },
                            label: function(tooltipItem) {
                                // datasetLabel 是 '每日銷售件數', raw.quantity 是總數
                                return `${tooltipItem.dataset.label}: ${tooltipItem.raw.quantity}`;
                            },
                            afterBody: function(tooltipItems) { // <--- 3.3 修改 afterBody 回調
                                const tooltipItem = tooltipItems[0];
                                const dataPoint = tooltipItem.chart.data.datasets[tooltipItem.datasetIndex].data[tooltipItem.dataIndex];
                                if (dataPoint && dataPoint.detailedItems && dataPoint.detailedItems.length > 0) {
                                    let productLines = ['']; // 加一個空行分隔
                                    productLines.push('當日銷售商品:');
                                    dataPoint.detailedItems.forEach(product => {
                                        productLines.push(`  - ${escapeHtml(product.name)}: ${product.quantity} 件`);
                                    });
                                    // 限制顯示的商品數量，避免工具提示過長
                                    const maxItemsToShow = 5;
                                    if (productLines.length > maxItemsToShow + 2) { // +2 for separator and title
                                        productLines = productLines.slice(0, maxItemsToShow + 2);
                                        productLines.push('  ...等更多');
                                    }
                                    return productLines;
                                }
                                return [];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            tooltipFormat: 'yyyy-MM-dd', // Chart.js v3+ 使用 'P' for date-fns
                            displayFormats: {
                                day: 'MM/dd'
                            }
                        },
                        title: { display: true, text: '日期', font: { weight: 'bold' } }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '銷售件數', font: { weight: 'bold' } },
                        ticks: {
                            stepSize: 1, // 確保整數刻度
                            precision: 0 // 無小數
                        }
                    }
                }
            }
        });
        // 2. 熱銷商品圖 (長條圖 - 保持不變，但可優化配置)
        const topProductLabels = summary.topProducts.map(item => escapeHtml(item.product_name));
        const topProductData = summary.topProducts.map(item => item.total_sold);

        topProductsChartInstance = new Chart(topProductsChartCtx, {
            type: 'bar',
            data: {
                labels: topProductLabels,
                datasets: [{
                    label: '銷售數量',
                    data: topProductData,
                    backgroundColor: [ // 可以為每個條形指定不同顏色
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                 indexAxis: 'y', // 讓商品名稱在 Y 軸，更易讀
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                     x: { // X 軸代表數量
                        beginAtZero: true,
                        title: { display: true, text: '銷售數量 (件)' },
                         ticks: {
                             stepSize: 1,
                             precision: 0
                        }
                    },
                    y: { // Y 軸代表商品
                        title: { display: true, text: '商品名稱' }
                    }
                },
                plugins: {
                    legend: { display: false } // 通常單一數據集不需要圖例
                }
            }
        });
    };




    

     // HTML Escaping function
    function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe
             .toString()
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;")
     }


    // --- Event Handlers ---
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        clearFormError();

        const id = saleIdInput.value;
        const productName = productNameInput.value.trim();
        const quantitySold = quantitySoldInput.value;
        const saleTimestamp = saleTimestampInput.value;

        if (!productName || !quantitySold || !saleTimestamp) {
            showFormError('請填寫所有必填欄位 (*)。');
            return;
        }
         const quantity = parseInt(quantitySold);
         if (isNaN(quantity) || quantity <= 0) {
             showFormError('銷售數量必須是有效的正整數。');
             return;
         }
         // 驗證時間格式是否有效 (datetime-local 應該會處理大部分，但再檢查一次)
        if (!saleTimestamp) {
             showFormError('請輸入有效的銷售時間。');
             return;
         }
        // datetime-local 的值可以直接使用，因為伺服器端會解析
        const data = {
            product_name: productName,
            quantity_sold: quantity,
            sale_timestamp: saleTimestamp // 直接傳送 YYYY-MM-DDTHH:mm 格式字串
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/admin/sales/${id}` : '/api/admin/sales';

        console.log(`Submitting ${method} request to ${url} with data:`, data);

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = id ? '更新中...' : '新增中...';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `操作失敗: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Operation successful:', result);
            clearForm();
            await refreshData(); // 重新載入表格和彙總數據
            alert(`銷售紀錄已成功${id ? '更新' : '新增'}！`);

        } catch (error) {
            console.error('儲存銷售紀錄時出錯:', error);
            showFormError(`儲存失敗: ${error.message}`);
             alert(`儲存銷售紀錄失敗: ${error.message}`); // 也用 alert 提示
        } finally {
             saveBtn.disabled = false;
             // 如果是編輯狀態，按鈕文字會在 clearForm() 中被重置
             if (id) {
                 // 如果提交的是更新，確保按鈕文字恢復
                 saveBtn.textContent = '新增紀錄';
             } else {
                  saveBtn.textContent = '新增紀錄';
             }
        }
    };

    const handleEditClick = (event) => {
        const button = event.target;
        const id = button.dataset.id;
        const name = button.dataset.name; // 已在渲染時 escapeHtml
        const quantity = button.dataset.quantity;
        const timestamp = button.dataset.timestamp;

        console.log("Editing data:", { id, name, quantity, timestamp });

        saleIdInput.value = id;
        productNameInput.value = name; // 直接使用已處理的 name
        quantitySoldInput.value = quantity;
        saleTimestampInput.value = formatTimestampForInput(timestamp); // 轉換格式

        formTitle.textContent = '編輯銷售紀錄';
        saveBtn.textContent = '更新紀錄';
        cancelEditBtn.style.display = 'inline-block'; // 顯示取消按鈕
        clearFormError();

        // 新增：打開 drawer 並切換到表單 tab
        openDrawer();
        switchTab('add-sale-tab');

        // 將頁面滾動到表單位置，方便編輯
        salesForm.scrollIntoView({ behavior: 'smooth' });
    };

    const handleDeleteClick = async (event) => {
        const button = event.target;
        const id = button.dataset.id;
        const name = button.dataset.name; // 已在渲染時 escapeHtml

        if (!confirm(`確定要刪除商品 "${name}" 的這筆銷售紀錄嗎？此操作無法復原。`)) {
            return;
        }

        try {
             showLoading(true); // 顯示載入提示
            const response = await fetch(`/api/admin/sales/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                 if (response.status === 404) {
                    throw new Error('找不到該筆紀錄，可能已被刪除。');
                }
                const errorData = await response.json(); // 嘗試解析錯誤訊息
                throw new Error(errorData.error || `刪除失敗: ${response.statusText}`);
            }

            // 狀態碼 204 表示成功，沒有響應體
             if (response.status === 204) {
                console.log(`Sales record ID ${id} deleted successfully.`);
                await refreshData(); // 重新載入數據
                 alert('銷售紀錄已成功刪除！');
             } else {
                 // 處理其他可能的成功狀態碼 (雖然 DELETE 通常是 204)
                 const result = await response.json();
                 console.log('Deletion result:', result);
                 await refreshData();
                  alert('銷售紀錄已成功刪除！');
             }
            // 如果正在編輯的是被刪除的項目，清除表單
            if (saleIdInput.value === id) {
                 clearForm();
            }


        } catch (error) {
            console.error(`刪除銷售紀錄 ID ${id} 時出錯:`, error);
            alert(`刪除失敗: ${error.message}`);
        } finally {
             showLoading(false); // 隱藏載入提示
        }
    };

    // 為表格中的編輯和刪除按鈕添加事件監聽
    const addTableButtonListeners = () => {
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.removeEventListener('click', handleEditClick); // 防止重複綁定
            button.addEventListener('click', handleEditClick);
        });
        document.querySelectorAll('.delete-btn').forEach(button => {
             button.removeEventListener('click', handleDeleteClick); // 防止重複綁定
            button.addEventListener('click', handleDeleteClick);
        });
    };

    const handleApplyFilter = () => {
        const params = {};
        const startDate = filterStartDateInput.value;
        const endDate = filterEndDateInput.value;
        const productName = filterProductNameInput.value.trim();

        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        if (productName) params.productName = productName;

        console.log("Applying filters:", params);
        refreshData(params);
    };

    const handleClearFilter = () => {
        filterStartDateInput.value = '';
        filterEndDateInput.value = '';
        filterProductNameInput.value = '';
        console.log("Filters cleared.");
        refreshData(); // 不帶參數，獲取預設數據
    };

     // 刷新所有頁面數據 (表格 + 彙總 + 圖表)
     const refreshData = async (filterParams = {}) => {
        // 如果篩選參數為空，則嘗試從篩選器讀取當前值
         if (Object.keys(filterParams).length === 0) {
             const startDate = filterStartDateInput.value;
             const endDate = filterEndDateInput.value;
             const productName = filterProductNameInput.value.trim();
             if (startDate) filterParams.startDate = startDate;
             if (endDate) filterParams.endDate = endDate;
             if (productName) filterParams.productName = productName;
         }
         await fetchSalesData(filterParams);
         await fetchSummaryData(filterParams); // 確保使用相同的篩選條件
     };

    // --- Drawer Control Functions ---
    const openDrawer = () => {
        if (slideOutDrawer) slideOutDrawer.classList.add('open');
        if (drawerOverlay) drawerOverlay.classList.add('open');
        // Optional: Add class to body to prevent scrolling when drawer is open
        // document.body.classList.add('drawer-open-no-scroll');
    };

    const closeDrawer = () => {
        if (slideOutDrawer) slideOutDrawer.classList.remove('open');
        if (drawerOverlay) drawerOverlay.classList.remove('open');
        // Optional: Remove class from body
        // document.body.classList.remove('drawer-open-no-scroll');
    };

    const switchTab = (targetTabId) => {
        if (!targetTabId) return;

        drawerTabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === targetTabId) {
                content.classList.add('active');
            }
        });
        drawerTabButtons.forEach(button => {
            button.classList.remove('active');
            // The button's data-tab attribute should match the content's ID
            if (button.dataset.tab === targetTabId) {
                button.classList.add('active');
            }
        });
    };

    // --- Helper function for date ranges ---
    const getDateRange = (rangeType) => {
        const today = new Date();
        let startDate = new Date();
        let endDate = new Date();

        switch (rangeType) {
            case 'today':
                startDate = today;
                endDate = today;
                break;
            case 'yesterday':
                startDate.setDate(today.getDate() - 1);
                endDate.setDate(today.getDate() - 1);
                break;
            case 'this_week': // 週一到週日
                const firstDayOfWeek = today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1); // 週一為第一天
                startDate = new Date(today.setDate(firstDayOfWeek));
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;
            case 'last_week':
                const firstDayOfLastWeek = today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) - 7;
                startDate = new Date(new Date().setDate(firstDayOfLastWeek)); // 重新獲取當前日期再計算
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;
            case 'this_month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'last_month':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'last_7_days':
                startDate.setDate(today.getDate() - 6); // 包括今天共7天
                endDate = today;
                break;
            case 'last_30_days':
                startDate.setDate(today.getDate() - 29); // 包括今天共30天
                endDate = today;
                break;
            default:
                return null;
        }
        // Format to YYYY-MM-DD
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        return { startDate: formatDate(startDate), endDate: formatDate(endDate) };
    };

    // --- Initial Load & Event Listeners Setup ---
    salesForm.addEventListener('submit', handleFormSubmit);
    cancelEditBtn.addEventListener('click', clearForm);
    applyFilterBtn.addEventListener('click', handleApplyFilter);
    clearFilterBtn.addEventListener('click', handleClearFilter);

    // Drawer event listeners
    if (openDrawerBtn) openDrawerBtn.addEventListener('click', openDrawer);
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

    drawerTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Ensure the data-tab attribute on the button matches the ID of the content to show
            switchTab(button.dataset.tab);
        });
    });

    // Add event listeners for quick date filters
    const quickDateFilterButtons = document.querySelectorAll('.quick-date-filters button[data-range]');
    quickDateFilterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const rangeType = button.dataset.range;
            const dates = getDateRange(rangeType);
            if (dates) {
                filterStartDateInput.value = dates.startDate;
                filterEndDateInput.value = dates.endDate;
                handleApplyFilter(); // Automatically apply filter
            }
        });
    });

    // 將匯出按鈕的事件監聽器放在 DOMContentLoaded 內部，確保頁面載入時綁定
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportDataToExcel);
    }
    setDefaultSaleTimestamp(); // 頁面載入時設定預設時間
    refreshData(); // 初始載入數據 (預設無篩選)

    // Ensure the first tab is active on load (if not already set by HTML)
    // HTML structure already sets the first tab and content as active, so this is a fallback/explicit set.
    if (drawerTabButtons.length > 0) {
        const firstTabId = drawerTabButtons[0].dataset.tab;
        // Check if any tab content is already active, if not, activate the first one.
        const isActiveContentPresent = Array.from(drawerTabContents).some(tc => tc.classList.contains('active'));
        if (!isActiveContentPresent && document.getElementById(firstTabId)) {
             switchTab(firstTabId);
        } else if (!document.querySelector('.drawer-tab-button.active') && drawerTabButtons.length > 0) {
            // If no button is active, activate the first one.
            drawerTabButtons[0].classList.add('active');
        }
    }
});



 
function exportDataToExcel() {
    // --- 1. 收集數據 ---

    // a) 從表格中獲取詳細銷售紀錄
    const salesTableBody = document.getElementById('sales-table-body');
    const tableRows = salesTableBody.querySelectorAll('tr');
    const salesRecords = [];
    const salesHeaders = ['銷售時間', '商品名稱', '銷售數量'];
    salesRecords.push(salesHeaders); // 加入標題列

    tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        // 確保這是數據列，而不是「載入中」或「無數據」的提示訊息
        if (cells.length === salesHeaders.length + 1) { // +1 是因為有「操作」欄
            const record = [
                cells[0].innerText, // 銷售時間
                cells[1].innerText, // 商品名稱
                parseInt(cells[2].innerText, 10) || 0 // 銷售數量 (轉換為數字)
            ];
            salesRecords.push(record);
        }
    });

    // 檢查是否有數據可匯出
    if (salesRecords.length <= 1) { // 如果只有標題列
        alert('沒有可匯出的詳細銷售紀錄！');
        return;
    }

    // b) 從資訊卡中獲取總覽數據
    const summaryData = [
        ['報表項目', '數值'], // 總覽的標題列
        ['篩選期間總銷售件數', parseInt(document.getElementById('summary-total-items').innerText, 10) || 0],
        [], // 加入一個空行作為分隔
        ['熱銷商品排行', '銷售件數'],
        [
            `Top 1: ${document.getElementById('summary-top-product-name').innerText}`,
            document.getElementById('summary-top-product-qty').innerText
        ],
        [
            `Top 2: ${document.getElementById('summary-top-product-name-2').innerText}`,
            document.getElementById('summary-top-product-qty-2').innerText
        ],
        [
            `Top 3: ${document.getElementById('summary-top-product-name-3').innerText}`,
            document.getElementById('summary-top-product-qty-3').innerText
        ]



        
    ];
    // --- 2. 使用 SheetJS 建立 Excel 檔案 ---

    // 建立一個新的工作簿 (Workbook)
    const wb = XLSX.utils.book_new();

    // 從收集到的數據建立工作表 (Worksheet)
    const wsSales = XLSX.utils.aoa_to_sheet(salesRecords);
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

    // 設定欄寬以提高可讀性 (可選，但建議)
    // 單位約為字元寬度
    wsSales['!cols'] = [ { wch: 20 }, { wch: 40 }, { wch: 15 } ]; // 時間, 商品名稱, 數量
    wsSummary['!cols'] = [ { wch: 30 }, { wch: 20 } ]; // 項目, 數值

    // 將工作表加入到工作簿中，並命名
    XLSX.utils.book_append_sheet(wb, wsSales, '詳細銷售紀錄');
    XLSX.utils.book_append_sheet(wb, wsSummary, '銷售總覽');

    // --- 3. 觸發下載 ---

    // 使用當前日期生成檔名
    const today = new Date().toISOString().slice(0, 10); // 格式: YYYY-MM-DD
    const fileName = `SunnyYummy-銷售報告-${today}.xlsx`;

    // 寫入工作簿並觸發瀏覽器下載
    XLSX.writeFile(wb, fileName);
}