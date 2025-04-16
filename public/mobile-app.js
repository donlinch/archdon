// mobile-app.js - 為手機版添加的額外 JavaScript 功能

document.addEventListener('DOMContentLoaded', function() {
    // 回到頂部按鈕功能
    const backToTopBtn = document.getElementById('backToTop');
    
    // 監聽滾動事件，決定是否顯示回到頂部按鈕
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
        
        // 更新滾動指示器 (簡單版本)
        updateScrollIndicator();
    });
    
    // 點擊回到頂部按鈕
    backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // 滾動指示器功能
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const dots = document.querySelectorAll('.scroll-indicator .dot');
    
    function updateScrollIndicator() {
        // 計算滾動位置百分比
        const scrollTop = window.pageYOffset;
        const docHeight = document.body.clientHeight;
        const winHeight = window.innerHeight;
        const scrollPercent = scrollTop / (docHeight - winHeight);
        
        // 根據滾動位置更新指示點
        if (scrollPercent < 0.33) {
            setActiveDot(0);
        } else if (scrollPercent < 0.66) {
            setActiveDot(1);
        } else {
            setActiveDot(2);
        }
    }
    
    function setActiveDot(index) {
        dots.forEach((dot, i) => {
            if (i === index) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }
    
    // 針對產品卡片的優化
    function enhanceProductCards() {
        // 當產品卡片被載入後
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    const productCards = document.querySelectorAll('.product-card');
                    
                    // 為部分卡片添加喜愛標記 (隨機選擇大約1/3的卡片)
                    productCards.forEach((card, index) => {
                        if (index % 3 === 0) {
                            // 檢查是否已經有喜愛標記
                            if (!card.querySelector('.favorite-tag')) {
                                const favoriteTag = document.createElement('span');
                                favoriteTag.className = 'favorite-tag';
                                favoriteTag.innerHTML = '★';
                                card.appendChild(favoriteTag);
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(document.getElementById('product-grid'), { 
            childList: true,
            subtree: true
        });
    }
    
    // 調用函數以增強產品卡片
    enhanceProductCards();
    
    // 修改當前的 fetchProducts 函數中的排序行為
    const sortLinks = document.querySelectorAll('.sort-link');
    if (sortLinks.length > 0) {
        sortLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                // 移除所有 active 類
                sortLinks.forEach(otherLink => otherLink.classList.remove('active'));
                // 為當前點擊的添加 active 類
                this.classList.add('active');
                
                // 獲取排序方式
                const sortBy = this.dataset.sort;
                
                // 調用原有的 fetchProducts 函數
                if (typeof fetchProducts === 'function') {
                    fetchProducts(sortBy);
                }
            });
        });
    }
});

// 優化滾動體驗 - 讓導覽列項目在滾動時更加突出
document.addEventListener('scroll', function() {
    // 在滾動時稍微縮放當前選中的導覽項
    const activeNavItem = document.querySelector('.category-nav a.active .nav-icon');
    if (activeNavItem) {
        activeNavItem.style.transform = 'scale(1.05)';
        setTimeout(() => {
            activeNavItem.style.transform = 'scale(1.1)';
        }, 150);
    }
});

// 優化產品卡片顯示
function displayProductsEnhanced(productList) {
    // 嘗試使用原有的 displayProducts 函數
    if (typeof displayProducts === 'function') {
        displayProducts(productList);
        return;
    }
    
    // 如果原函數不存在，提供一個基本實現
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (!productList || productList.length === 0) {
        grid.innerHTML = '<p>目前沒有商品可顯示。</p>';
        return;
    }
    
    productList.forEach(product => {
        const cardLink = document.createElement('a');
        cardLink.className = 'product-card';
        cardLink.href = product.seven_eleven_url || '#';
        if (product.seven_eleven_url) {
            cardLink.target = '_blank';
            cardLink.rel = 'noopener noreferrer';
        }
        
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';
        const img = document.createElement('img');
        img.src = product.image_url || '/images/placeholder.png';
        img.alt = product.name || '商品圖片';
        imageContainer.appendChild(img);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'card-content';
        const name = document.createElement('h3');
        name.textContent = product.name || '未命名商品';
        const description = document.createElement('p');
        description.textContent = product.description || ' ';
        const price = document.createElement('p');
        price.className = 'price';
        price.textContent = product.price !== null ? `NT$ ${Math.floor(product.price)}` : '價格洽詢';
        
        contentDiv.appendChild(name);
        contentDiv.appendChild(description);
        contentDiv.appendChild(price);
        
        cardLink.appendChild(imageContainer);
        cardLink.appendChild(contentDiv);
        
        // 隨機為部分卡片添加喜愛標記
        if (Math.random() > 0.6) {
            const favoriteTag = document.createElement('span');
            favoriteTag.className = 'favorite-tag';
            favoriteTag.innerHTML = '★';
            cardLink.appendChild(favoriteTag);
        }
        
        grid.appendChild(cardLink);
    });
}

// 嘗試替換原有的 displayProducts 函數，如果存在的話
if (typeof window.displayProducts === 'function') {
    const originalDisplayProducts = window.displayProducts;
    window.displayProducts = function(productList) {
        displayProductsEnhanced(productList);
    };
}