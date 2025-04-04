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

    let salesTrendChartInstance = null;
    let topProductsChartInstance = null;




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


     const renderSalesTrendChart = (trendData) => {
        if (salesTrendChartInstance) {
            salesTrendChartInstance.destroy();
        }
        const labels = trendData.map(item => item.date);
        const quantities = trendData.map(item => item.quantity);

        salesTrendChartInstance = new Chart(salesTrendChartCtx, {
            type: 'bar', // *** 修改這裡：從 'line' 改為 'bar' ***
            data: {
                labels: labels,
                datasets: [{
                    label: '每日銷售件數',
                    data: quantities,
                    backgroundColor: 'rgba(229, 115, 115, 0.6)', // 稍微調整透明度或使用實色
                    borderColor: '#E57373', // 邊框顏色
                    borderWidth: 1 // 可以設置邊框寬度
                    // tension: 0.1, // 線條張力，直條圖不需要，移除
                    // fill: true     // 填充區域，直條圖不需要，移除
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            tooltipFormat: 'yyyy-MM-dd',
                            displayFormats: {
                                day: 'MM/dd' // 格式化 X 軸標籤
                            }
                        },
                        adapters: {
                             date: {
                                 locale: dateFns.locale.zhTW // 指定 date-fns 的 locale
                             }
                         },
                        title: { display: true, text: '日期' }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '銷售件數' },
                        ticks: { // 確保 Y 軸刻度為整數
                             stepSize: 1,
                             callback: function(value) { if (Number.isInteger(value)) { return value; } },
                         }
                    }
                },
                plugins: {
                    tooltip: {
                         callbacks: {
                             title: function(tooltipItems) {
                                 // 格式化 tooltip 標題
                                 const date = new Date(tooltipItems[0].parsed.x);
                                 return dateFns.format(date, 'yyyy年MM月dd日', { locale: dateFns.locale.zhTW });
                             }
                         }
                     },
                     legend: { // 如果只有一個數據集，可以考慮隱藏圖例
                         display: false
                     }
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


    // --- Initial Load & Event Listeners Setup ---
    salesForm.addEventListener('submit', handleFormSubmit);
    cancelEditBtn.addEventListener('click', clearForm);
    applyFilterBtn.addEventListener('click', handleApplyFilter);
    clearFilterBtn.addEventListener('click', handleClearFilter);

    setDefaultSaleTimestamp(); // 頁面載入時設定預設時間
    refreshData(); // 初始載入數據 (預設無篩選)

});