let currentChart = null;  // 用來存儲當前的圖表

// 獲取銷售資料並處理
async function fetchSalesData() {
    const response = await fetch('/api/sales');
    const sales = await response.json();
    salesData = sales;  // 將資料存入全局變數
    generateChart('monthly');  // 默認顯示月度圖表
}

function generateChart(type) {
    const ctx = document.getElementById('sales-chart').getContext('2d');

    let labels = [];  // 用來存放月份或年份
    let data = [];  // 用來存放每月/每年的銷售數量
    let datasets = [];  // 用來存放每個月的銷售數據項目

    // 按月統計銷售數量
    if (type === 'monthly') {
        const monthlySales = {};
        salesData.forEach(sale => {
            const month = new Date(sale.sale_date).toLocaleString('default', { month: 'short' });
            if (!monthlySales[month]) {
                monthlySales[month] = [];
            }
            monthlySales[month].push({ name: sale.name, quantity: sale.quantity });
        });

        labels = Object.keys(monthlySales);
        data = labels.map(month => monthlySales[month].reduce((total, sale) => total + sale.quantity, 0));

        // 將每個月的銷售項目加入 datasets
        datasets = labels.map(month => {
            return {
                label: month,
                data: monthlySales[month].map(sale => sale.quantity),
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                monthData: monthlySales[month]  // 保存每月的銷售項目資料
            };
        });
    }
    
    // 按年統計銷售數量
    else if (type === 'yearly') {
        const yearlySales = {};
        salesData.forEach(sale => {
            const year = new Date(sale.sale_date).getFullYear();
            if (!yearlySales[year]) {
                yearlySales[year] = [];
            }
            yearlySales[year].push({ name: sale.name, quantity: sale.quantity });
        });

        labels = Object.keys(yearlySales);
        data = Object.values(yearlySales).map(yearData => yearData.reduce((total, sale) => total + sale.quantity, 0));

        // 將每個年的銷售項目加入 datasets
        datasets = labels.map(year => {
            return {
                label: year,
                data: yearlySales[year].map(sale => sale.quantity),
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                monthData: yearlySales[year]  // 保存每年的銷售項目資料
            };
        });
    }

    // 銷毀舊的圖表（如果存在）
    if (currentChart) {
        currentChart.destroy();
    }

    // 配置圖表
    currentChart = new Chart(ctx, {
        type: 'bar',  // 可根據需求更改圖表類型
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        // 自定義提示框顯示內容
                        label: function(tooltipItem) {
                            const dataset = tooltipItem.dataset;
                            const item = dataset.monthData[tooltipItem.dataIndex];
                            return `${tooltipItem.label}: ${item.quantity} 銷售數量\n${item.name} 數量: ${item.quantity}`;
                        }
                    }
                }
            },
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
