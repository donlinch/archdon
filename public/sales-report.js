document.addEventListener('DOMContentLoaded', function() {
    // 初始化變數
    let salesChart;
    let currentData = [];
    
    // DOM元素
    const periodSelect = document.getElementById('period-select');
    const productFilter = document.getElementById('product-filter');
    const customDateRange = document.getElementById('custom-date-range');
    const refreshBtn = document.getElementById('refresh-btn');
    const salesTable = document.getElementById('sales-table').getElementsByTagName('tbody')[0];
    const totalSalesElement = document.getElementById('total-sales');
    const totalQuantityElement = document.getElementById('total-quantity');
    const productCountElement = document.getElementById('product-count');
    const chartCanvas = document.getElementById('sales-chart');
    

// 在現有的代碼中添加以下內容

// 初始化模態框相關元素
const modal = document.getElementById('sales-modal');
const modalTitle = document.getElementById('modal-title');
const salesForm = document.getElementById('sales-form');
const recordIdInput = document.getElementById('record-id');
const productNameInput = document.getElementById('product-name');
const quantityInput = document.getElementById('quantity');
const unitPriceInput = document.getElementById('unit-price');
const saleDateInput = document.getElementById('sale-date');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const closeBtn = document.querySelector('.close-btn');
const addSaleBtn = document.getElementById('add-sale-btn');

// 添加事件監聽器
addSaleBtn.addEventListener('click', () => openModal('add'));
closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
salesForm.addEventListener('submit', handleFormSubmit);

// 打開模態框
function openModal(action, recordId = null) {
    if (action === 'add') {
        modalTitle.textContent = '新增銷售記錄';
        recordIdInput.value = '';
        salesForm.reset();
        saleDateInput.value = new Date().toISOString().slice(0, 16);
    } else if (action === 'edit' && recordId) {
        modalTitle.textContent = '編輯銷售記錄';
        fetchRecordForEdit(recordId);
    }
    
    modal.style.display = 'block';
}

// 關閉模態框
function closeModal() {
    modal.style.display = 'none';
}

// 獲取要編輯的記錄
async function fetchRecordForEdit(recordId) {
    try {
        const response = await fetch(`/api/sales/${recordId}`);
        if (!response.ok) throw new Error('獲取記錄失敗');
        
        const record = await response.json();
        
        // 填充表單
        recordIdInput.value = record.id;
        productNameInput.value = record.product_name;
        quantityInput.value = record.quantity;
        unitPriceInput.value = record.unit_price;
        
        // 格式化日期時間
        const saleDate = new Date(record.sale_date);
        const formattedDate = saleDate.toISOString().slice(0, 16);
        saleDateInput.value = formattedDate;
    } catch (error) {
        console.error('獲取銷售記錄失敗:', error);
        alert('無法獲取銷售記錄，請稍後再試');
        closeModal();
    }
}

// 處理表單提交
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const recordId = recordIdInput.value;
    const isEditMode = !!recordId;
    
    const formData = {
        product_name: productNameInput.value,
        quantity: quantityInput.value,
        unit_price: unitPriceInput.value,
        sale_date: saleDateInput.value || new Date().toISOString()
    };
    
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';
    
    try {
        let response;
        
        if (isEditMode) {
            response = await fetch(`/api/sales/${recordId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            response = await fetch('/api/sales', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '保存失敗');
        }
        
        closeModal();
        fetchData(); // 刷新數據
        
    } catch (error) {
        console.error('保存銷售記錄失敗:', error);
        alert(`保存失敗: ${error.message}`);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存';
    }
}

// 修改renderTable函數，添加編輯和刪除按鈕
function renderTable() {
    salesTable.innerHTML = '';
    
    currentData.forEach(item => {
        const row = salesTable.insertRow();
        
        // 如果是分組數據
        if (item.total_quantity) {
            row.insertCell().textContent = item.name;
            row.insertCell().textContent = item.total_quantity;
            row.insertCell().textContent = '-';
            row.insertCell().textContent = `NT$ ${item.total_amount.toFixed(2)}`;
            row.insertCell().textContent = `${new Date(item.first_sale_date).toLocaleDateString()} - ${new Date(item.last_sale_date).toLocaleDateString()}`;
        } 
        // 如果是詳細數據
        else {
            row.insertCell().textContent = item.name;
            row.insertCell().textContent = item.quantity;
            row.insertCell().textContent = `NT$ ${item.unit_price.toFixed(2)}`;
            row.insertCell().textContent = `NT$ ${item.amount.toFixed(2)}`;
            row.insertCell().textContent = new Date(item.sale_date).toLocaleDateString();
            
            // 添加操作按鈕
            const actionCell = row.insertCell();
            
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.textContent = '編輯';
            editBtn.addEventListener('click', () => openModal('edit', item.id));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '刪除';
            deleteBtn.addEventListener('click', () => confirmDelete(item.id));
            
            actionCell.appendChild(editBtn);
            actionCell.appendChild(deleteBtn);
        }
    });
}

// 確認刪除
async function confirmDelete(recordId) {
    if (!confirm('確定要刪除此銷售記錄嗎？此操作無法撤銷。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/sales/${recordId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('刪除失敗');
        }
        
        fetchData(); // 刷新數據
    } catch (error) {
        console.error('刪除銷售記錄失敗:', error);
        alert('刪除銷售記錄失敗，請稍後再試');
    }
}

// 點擊模態框外部關閉模態框
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});



    // 事件監聽器
    periodSelect.addEventListener('change', function() {
        customDateRange.style.display = this.value === 'custom' ? 'block' : 'none';
    });
    
    refreshBtn.addEventListener('click', fetchData);
    
    // 初始化頁面
    loadProductOptions();
    fetchData();
    
    // 載入產品選項
    async function loadProductOptions() {
        try {
            const response = await fetch('/api/sales?group_by_name=true');
            const data = await response.json();
            
            productFilter.innerHTML = '<option value="">全部產品</option>';
            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.name;
                option.textContent = item.name;
                productFilter.appendChild(option);
            });
        } catch (error) {
            console.error('載入產品選項失敗:', error);
        }
    }
    
    // 獲取數據
    async function fetchData() {
        const period = periodSelect.value;
        const productName = productFilter.value;
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        let url = '/api/sales?';
        url += `period=${period}`;
        if (productName) url += `&name=${encodeURIComponent(productName)}`;
        if (period === 'custom' && startDate && endDate) {
            url += `&start_date=${startDate}&end_date=${endDate}`;
        }
        
        try {
            const response = await fetch(url);
            currentData = await response.json();
            updateSummary();
            renderTable();
            
            // 如果是查看全部產品，則同時載入圖表數據
            if (!productName) {
                fetchChartData();
            } else {
                // 如果有篩選特定產品，則隱藏圖表
                if (salesChart) {
                    salesChart.destroy();
                }
                chartCanvas.style.display = 'none';
            }
        } catch (error) {
            console.error('獲取銷售數據失敗:', error);
            alert('獲取數據失敗，請稍後再試');
        }
    }
    
    // 獲取圖表數據
    async function fetchChartData() {
        const period = periodSelect.value;
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        let url = '/api/sales/report?';
        url += `period=${period}`;
        if (period === 'custom' && startDate && endDate) {
            url += `&start_date=${startDate}&end_date=${endDate}`;
        }
        
        try {
            const response = await fetch(url);
            const chartData = await response.json();
            renderChart(chartData);
            chartCanvas.style.display = 'block';
        } catch (error) {
            console.error('獲取圖表數據失敗:', error);
        }
    }
    
    // 更新摘要統計
    function updateSummary() {
        const totalSales = currentData.reduce((sum, item) => sum + (item.amount || item.total_amount || 0), 0);
        const totalQuantity = currentData.reduce((sum, item) => sum + (item.quantity || item.total_quantity || 0), 0);
        const productCount = new Set(currentData.map(item => item.name)).size;
        
        totalSalesElement.textContent = `NT$ ${totalSales.toLocaleString()}`;
        totalQuantityElement.textContent = totalQuantity.toLocaleString();
        productCountElement.textContent = productCount;
    }
    
    // 渲染表格
    function renderTable() {
        salesTable.innerHTML = '';
        
        currentData.forEach(item => {
            const row = salesTable.insertRow();
            
            // 如果是分組數據
            if (item.total_quantity) {
                row.insertCell().textContent = item.name;
                row.insertCell().textContent = item.total_quantity;
                row.insertCell().textContent = '-'; // 分組數據沒有單一單價
                row.insertCell().textContent = `NT$ ${item.total_amount.toFixed(2)}`;
                row.insertCell().textContent = `${new Date(item.first_sale_date).toLocaleDateString()} - ${new Date(item.last_sale_date).toLocaleDateString()}`;
            } 
            // 如果是詳細數據
            else {
                row.insertCell().textContent = item.name;
                row.insertCell().textContent = item.quantity;
                row.insertCell().textContent = `NT$ ${item.unit_price.toFixed(2)}`;
                row.insertCell().textContent = `NT$ ${item.amount.toFixed(2)}`;
                row.insertCell().textContent = new Date(item.sale_date).toLocaleDateString();
            }
        });
    }
    
    // 渲染圖表
    function renderChart(chartData) {
        if (salesChart) {
            salesChart.destroy();
        }
        
        salesChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: '銷售數量',
                        data: chartData.quantities,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                        yAxisID: 'y'
                    },
                    {
                        label: '銷售金額 (NT$)',
                        data: chartData.amounts,
                        borderColor: 'rgb(54, 162, 235)',
                        tension: 0.1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: '銷售數量'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: '銷售金額 (NT$)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }
});



// --- 刪除銷售記錄 API ---
app.delete('/api/sales/:id', async (req, res) => {
    const { id } = req.params;
    
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: '無效的銷售記錄ID' });
    }
    
    try {
        const result = await pool.query('DELETE FROM sales WHERE id = $1', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '找不到指定的銷售記錄' });
        }
        
        res.status(204).send();
    } catch (err) {
        console.error(`刪除銷售記錄 ID ${id} 時出錯:`, err.stack || err);
        res.status(500).json({ error: '刪除銷售記錄時發生內部伺服器錯誤' });
    }
});