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