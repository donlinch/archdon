// 創建 tracking.js 文件
function trackConversion(type, element) {
    fetch('/api/track/conversion', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            conversionType: type,
            sourcePath: window.location.pathname
        })
    })
    .then(response => {
        if (!response.ok) {
            console.error('轉換追蹤失敗');
        }
    })
    .catch(error => {
        console.error('轉換追蹤錯誤:', error);
    });
}

// 在不同類型元素上添加點擊事件
function setupConversionTracking() {
    // 商品卡片追蹤
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', function() {
            trackConversion('product_view', this);
        });
    });

    // 新聞頁面追蹤
    document.querySelectorAll('.news-card').forEach(card => {
        card.addEventListener('click', function() {
            trackConversion('news_view', this);
        });
    });

    // 音樂專輯追蹤
    document.querySelectorAll('.album-card').forEach(card => {
        card.addEventListener('click', function() {
            trackConversion('music_view', this);
        });
    });
}

// 頁面載入時設置追蹤
document.addEventListener('DOMContentLoaded', setupConversionTracking);

// 如果內容是動態加載的，提供公共函數來重新綁定事件
window.rebindConversionTracking = setupConversionTracking;
