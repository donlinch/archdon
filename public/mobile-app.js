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



// 在 mobile-app.js 新增以下功能代碼：

/**
 * 當一個商品類別頁面有太多商品時，提供分頁載入功能
 * 可以逐步載入商品，提高頁面性能
 */
function setupInfiniteScroll() {
    let page = 1;
    const limit = 10; // 每次載入的商品數量
    let isLoading = false;
    let hasMoreItems = true;
    
    // 在頁面底部添加載入提示
    const loadingIndicator = document.createElement('div');
    loadingIndicator.classList.add('loading-indicator');
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>載入更多商品...</p>';
    loadingIndicator.style.display = 'none';
    document.querySelector('main').appendChild(loadingIndicator);
    
    // 監聽滾動事件
    window.addEventListener('scroll', function() {
      // 檢查是否滾動到接近頁面底部
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        if (!isLoading && hasMoreItems) {
          loadMoreProducts();
        }
      }
    });
    
    // 載入更多商品的函數
    function loadMoreProducts() {
      isLoading = true;
      loadingIndicator.style.display = 'flex';
      
      // 獲取當前的排序方式
      const activeSort = document.querySelector('.sort-link.active').dataset.sort || 'latest';
      
      // 構建API URL
      let apiUrl = `/api/products?page=${page}&limit=${limit}`;
      if (activeSort === 'popular') {
        apiUrl += '&sort=popular';
      }
      
      // 發送請求獲取更多商品
      fetch(apiUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(products => {
          // 如果返回的商品數量小於limit，表示沒有更多商品了
          if (products.length < limit) {
            hasMoreItems = false;
            loadingIndicator.innerHTML = '<p>已顯示全部商品</p>';
          }
          
          // 添加商品到頁面
          if (products.length > 0) {
            displayProductsEnhanced(products);
            page++;
          } else {
            hasMoreItems = false;
            loadingIndicator.innerHTML = '<p>已顯示全部商品</p>';
          }
          
          isLoading = false;
        })
        .catch(error => {
          console.error('獲取更多商品失敗:', error);
          loadingIndicator.innerHTML = '<p>載入失敗，請重試</p>';
          isLoading = false;
        });
    }
  }
  
  /**
   * 商品展示動畫效果
   * 當商品卡片進入視口時添加漸入動畫
   */
  function setupProductAnimation() {
    // 檢查瀏覽器是否支持 Intersection Observer
    if ('IntersectionObserver' in window) {
      const productGrid = document.getElementById('product-grid');
      
      // 創建一個觀察器
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          // 當商品卡片進入視口
          if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
            // 一旦添加動畫，不再觀察此元素
            observer.unobserve(entry.target);
          }
        });
      }, {
        root: null, // 視口
        threshold: 0.1 // 元素10%進入視口時觸發
      });
      
      // 當新的商品卡片添加到DOM時，開始觀察它們
      const gridObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.addedNodes.length) {
            mutation.addedNodes.forEach(node => {
              if (node.classList && node.classList.contains('product-card')) {
                // 添加初始狀態類
                node.classList.add('product-hidden');
                // 開始觀察
                observer.observe(node);
              }
            });
          }
        });
      });
      
      // 開始觀察產品網格的變化
      gridObserver.observe(productGrid, { childList: true });
    }
  }
  
  /**
   * 商品篩選功能
   * 允許用戶按標籤或價格範圍篩選商品
   */
  function setupProductFilters() {
    // 創建篩選UI
    const filterSection = document.createElement('div');
    filterSection.className = 'filter-section';
    filterSection.innerHTML = `
      <button class="filter-toggle">
        <i class="fas fa-filter"></i> 篩選商品
      </button>
      <div class="filter-panel">
        <div class="filter-group">
          <h4>價格範圍</h4>
          <div class="price-range">
            <input type="range" min="0" max="1000" step="100" value="1000" id="priceFilter">
            <span id="priceValue">NT$ 1000+</span>
          </div>
        </div>
        <div class="filter-group">
          <h4>商品類型</h4>
          <div class="tag-filters">
            <button class="tag-filter active" data-tag="all">全部</button>
            <button class="tag-filter" data-tag="clothing">服飾</button>
            <button class="tag-filter" data-tag="accessory">配飾</button>
            <button class="tag-filter" data-tag="stationery">文具</button>
          </div>
        </div>
        <button class="apply-filters">套用篩選</button>
      </div>
    `;
    
    // 插入到排序導覽後面
    const sortNav = document.querySelector('.sort-nav');
    sortNav.after(filterSection);
    
    // 篩選面板開關
    const filterToggle = document.querySelector('.filter-toggle');
    const filterPanel = document.querySelector('.filter-panel');
    
    filterToggle.addEventListener('click', () => {
      filterPanel.classList.toggle('open');
      filterToggle.classList.toggle('active');
    });
    
    // 價格範圍選擇器
    const priceFilter = document.getElementById('priceFilter');
    const priceValue = document.getElementById('priceValue');
    
    priceFilter.addEventListener('input', () => {
      const value = priceFilter.value;
      priceValue.textContent = value >= 1000 ? `NT$ 1000+` : `NT$ ${value}`;
    });
    
    // 標籤選擇器
    const tagFilters = document.querySelectorAll('.tag-filter');
    
    tagFilters.forEach(filter => {
      filter.addEventListener('click', () => {
        tagFilters.forEach(f => f.classList.remove('active'));
        filter.classList.add('active');
      });
    });
    
    // 應用篩選
    const applyButton = document.querySelector('.apply-filters');
    
    applyButton.addEventListener('click', () => {
      const maxPrice = priceFilter.value;
      const selectedTag = document.querySelector('.tag-filter.active').dataset.tag;
      
      // 這裡應與後端API整合，以下示例假設使用現有的fetchProducts函數
      const activeSort = document.querySelector('.sort-link.active').dataset.sort || 'latest';
      
      // 構建API URL (實際實現時需要修改fetchProducts函數或創建新函數)
      let apiUrl = `/api/products?sort=${activeSort}`;
      if (maxPrice < 1000) {
        apiUrl += `&maxPrice=${maxPrice}`;
      }
      if (selectedTag && selectedTag !== 'all') {
        apiUrl += `&tag=${selectedTag}`;
      }
      
      // 關閉篩選面板
      filterPanel.classList.remove('open');
      filterToggle.classList.remove('active');
      
      // 顯示加載中提示
      const grid = document.getElementById('product-grid');
      grid.innerHTML = '<p class="loading">正在加載篩選後的商品...</p>';
      
      // 假設fetchProducts已存在
      if (typeof fetchProducts === 'function') {
        // 實際實現時需要修改fetchProducts接受篩選參數
        fetchProducts(activeSort, { maxPrice, tag: selectedTag });
      } else {
        // 備用方案：直接調用API並處理響應
        fetch(apiUrl)
          .then(response => response.json())
          .then(products => {
            displayProductsEnhanced(products);
          })
          .catch(error => {
            console.error('篩選商品時出錯:', error);
            grid.innerHTML = '<p>無法加載篩選後的商品，請稍後再試。</p>';
          });
      }
    });
  }
  
  // 在文檔加載完成後調用
  document.addEventListener('DOMContentLoaded', function() {
    // 調用這些函數以啟用功能
    // setupInfiniteScroll();
    // setupProductAnimation();
    // setupProductFilters();
    
    // 注意：這些功能默認被注釋掉了，可以根據需要啟用
  });