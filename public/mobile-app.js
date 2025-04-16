// mobile-app.js - 與現有 app.js 整合的增強版本

document.addEventListener('DOMContentLoaded', function() {
    // 添加圖標到導航菜單
    initNavIcons();
    
    // 設置回到頂部按鈕
    setupBackToTop();
    
    // 設置滾動指示器
    setupScrollIndicator();
    
    // 隨機添加喜愛標記到部分產品
    addFavoriteTags();
    
    // 初始化產品卡片動畫
    setupProductAnimation();
});

// 為導航項目添加圖標
function initNavIcons() {
    // 圖標映射
    const icons = {
        '週邊商品': 'fas fa-store',
        '音樂專輯': 'fas fa-music',
        '最新消息': 'fas fa-newspaper',
        '樂譜與舞蹈': 'fas fa-guitar',
        '互動遊戲': 'fas fa-gamepad',
        '留言板': 'fas fa-comments',
        '關於我們': 'fas fa-info-circle', 
        '常見問題': 'fas fa-question-circle'
    };
    
    // 獲取所有導航項目
    const navLinks = document.querySelectorAll('.category-nav a');
    navLinks.forEach(link => {
        const text = link.textContent.trim();
        if (icons[text]) {
            // 創建圖標元素
            const iconElement = document.createElement('i');
            iconElement.className = icons[text];
            link.insertBefore(iconElement, link.firstChild);
        }
    });
}

// 設置回到頂部按鈕
function setupBackToTop() {
    // 創建按鈕元素
    const backToTopBtn = document.createElement('button');
    backToTopBtn.className = 'back-to-top';
    backToTopBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    document.body.appendChild(backToTopBtn);
    
    // 監聽滾動事件
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });
    
    // 點擊回到頂部按鈕
    backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// 設置滾動指示器
function setupScrollIndicator() {
    // 創建指示器容器
    const indicatorContainer = document.createElement('div');
    indicatorContainer.className = 'scroll-indicator';
    
    // 創建三個點
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        if (i === 0) dot.classList.add('active');
        indicatorContainer.appendChild(dot);
    }
    
    // 插入到產品網格後面
    const productGrid = document.getElementById('product-grid');
    if (productGrid) {
        productGrid.parentNode.insertBefore(indicatorContainer, productGrid.nextSibling);
    }
    
    // 更新指示器狀態的函數
    function updateScrollIndicator() {
        const scrollTop = window.pageYOffset;
        const docHeight = document.body.clientHeight;
        const winHeight = window.innerHeight;
        const scrollPercent = scrollTop / (docHeight - winHeight);
        
        const dots = document.querySelectorAll('.scroll-indicator .dot');
        
        // 根據滾動位置激活對應的點
        if (scrollPercent < 0.33) {
            setActiveDot(dots, 0);
        } else if (scrollPercent < 0.66) {
            setActiveDot(dots, 1);
        } else {
            setActiveDot(dots, 2);
        }
    }
    
    // 輔助函數：設置活動點
    function setActiveDot(dots, index) {
        dots.forEach((dot, i) => {
            if (i === index) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }
    
    // 綁定滾動事件
    window.addEventListener('scroll', updateScrollIndicator);
}

// 隨機添加喜愛標記到商品卡片
function addFavoriteTags() {
    // 監視產品網格變化
    const productGrid = document.getElementById('product-grid');
    if (!productGrid) return;
    
    // 創建一個 MutationObserver 來監聽DOM變化
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                const productCards = document.querySelectorAll('.product-card');
                
                // 為大約1/3的卡片添加喜愛標記
                productCards.forEach((card, index) => {
                    // 檢查是否已經有喜愛標記
                    if (!card.querySelector('.favorite-tag') && index % 3 === 0) {
                        const tag = document.createElement('span');
                        tag.className = 'favorite-tag';
                        tag.innerHTML = '★';
                        card.appendChild(tag);
                    }
                });
            }
        });
    });
    
    // 開始監聽變化
    observer.observe(productGrid, { childList: true, subtree: true });
    
    // 對當前已有的卡片添加標記
    const existingCards = document.querySelectorAll('.product-card');
    existingCards.forEach((card, index) => {
        if (index % 3 === 0) {
            const tag = document.createElement('span');
            tag.className = 'favorite-tag';
            tag.innerHTML = '★';
            card.appendChild(tag);
        }
    });
}

// 設置產品卡片進入視口時的動畫
function setupProductAnimation() {
    // 檢查瀏覽器是否支持 Intersection Observer
    if (!('IntersectionObserver' in window)) return;
    
    // 創建 CSS 類
    const style = document.createElement('style');
    style.textContent = `
        .product-card {
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .product-card.visible {
            opacity: 1;
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);
    
    // 設置觀察器
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1  // 當10%的元素可見時觸發
    });
    
    // 監聽現有卡片
    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => observer.observe(card));
    
    // 監視將來添加的卡片
    const productGrid = document.getElementById('product-grid');
    if (productGrid) {
        const gridObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(node => {
                        if (node.classList && node.classList.contains('product-card')) {
                            observer.observe(node);
                        }
                    });
                }
            });
        });
        
        gridObserver.observe(productGrid, { childList: true });
    }
}



// 為 Footer 中的回到頂部按鈕添加功能
document.addEventListener('DOMContentLoaded', function() {
    const backToTopBtn = document.getElementById('backToTopBtn');
    
    if (backToTopBtn) {
      backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }
  });

// 如果原 app.js 中存在功能的增強
// 確保保持與原來 fetchProducts 和 displayProducts 函數的兼容性