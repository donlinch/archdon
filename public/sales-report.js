let salesData = [];  // 存放銷售資料

// 獲取銷售資料並處理
async function fetchSalesData() {
    const response = await fetch('/api/sales');
    const sales = await response.json();
    salesData = sales;  // 將資料存入全局變數
    generateChart('monthly');  // 默認顯示月度圖表
}

// 根據月度來生成圖表
function generateChart(type) {
    const ctx = document.getElementById('sales-chart').getContext('2d');

    let labels = [];  // 用來存放月份或年份
    let data = [];  // 用來存放每月/每年的銷售數量

    // 按月統計銷售數量
    if (type === 'monthly') {
        const monthlySales = {};
        salesData.forEach(sale => {
            const month = new Date(sale.sale_date).toLocaleString('default', { month: 'short' });
            if (!monthlySales[month]) {
                monthlySales[month] = 0;
            }
            monthlySales[month] += sale.quantity;
        });
        labels = Object.keys(monthlySales);
        data = Object.values(monthlySales);
    }
    
    // 按年統計銷售數量
    else if (type === 'yearly') {
        const yearlySales = {};
        salesData.forEach(sale => {
            const year = new Date(sale.sale_date).getFullYear();
            if (!yearlySales[year]) {
                yearlySales[year] = 0;
            }
            yearlySales[year] += sale.quantity;
        });
        labels = Object.keys(yearlySales);
        data = Object.values(yearlySales);
    }

    // 配置圖表
    new Chart(ctx, {
        type: 'bar',  // 可根據需求更改圖表類型
        data: {
            labels: labels,
            datasets: [{
                label: '銷售數量',
                data: data,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 顯示月度銷售圖表
function showMonthlyChart() {
    generateChart('monthly');
}

// 顯示年度銷售圖表
function showYearlyChart() {
    generateChart('yearly');
}

// 初始化時獲取資料
fetchSalesData();
