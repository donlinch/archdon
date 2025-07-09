// 全局變數
// 移除重複宣告的 currentItems 變數
        
// 訂單系統全局變量
let currentOrder = null; // 當前訂單的料理ID
let playerScore = 0;     // 玩家得分
let orderTimer = null;   // 訂單計時器
const ORDER_TIME = 120;  // 訂單完成時間（秒）
let remainingTime = ORDER_TIME; // 剩餘時間

// 訂單2系統全局變量
let currentOrder2 = null; // 訂單2的料理ID
let orderTimer2 = null;   // 訂單2計時器
let remainingTime2 = ORDER_TIME; // 訂單2剩餘時間

// 獲取用戶令牌
function getUserToken() {
    const userId = localStorage.getItem('boxCurrentUserId');
    if (!userId) return null;
    const tokenKey = `boxUserToken_${userId}`;
    return localStorage.getItem(tokenKey);
}

// API 請求工具函數
async function apiFetch(endpoint, options = {}) {
    const token = getUserToken();
    if (!token) {
        alert('權限不足或登入已超時，請重新登入。');
        window.location.href = '/cook-login.html?redirect=/cook-game.html';
        throw new Error('令牌未找到，無法發送請求');
    }

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    const mergedOptions = { ...defaultOptions, ...options };
    if (mergedOptions.body) {
        mergedOptions.body = JSON.stringify(mergedOptions.body);
    }

    try {
        const response = await fetch(`/cook-api${endpoint}`, mergedOptions);
        if (!response.ok) {
            if(response.status === 401 || response.status === 403) {
                alert('權限不足或登入已超時，請重新登入。');
                window.location.href = '/cook-login.html?redirect=/cook-game.html';
                throw new Error('認證失敗');
            }
            const errorData = await response.json().catch(() => ({ message: '無法解析來自伺服器的錯誤訊息' }));
            throw new Error(errorData.error || errorData.message || `HTTP 錯誤! 狀態碼: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API Fetch Error:', error);
        throw error;
    }
}

// 載入物品列表
async function loadItems() {
    try {
        const items = await apiFetch('/v3/items');
        currentItems = items;
    } catch (error) {
        console.error('載入物品失敗:', error);
        alert(`載入物品失敗: ${error.message}`);
    }
}

// 新增：載入所有食譜數據
let allRecipes = []; // 全局變量存儲所有食譜
let isLoadingRecipes = false; // 用於跟踪載入狀態

async function loadAllRecipes() {
    try {
        isLoadingRecipes = true; // 設置載入狀態
        console.log('開始載入所有食譜數據...');
        
        // 顯示載入中提示
        const simResultsElement = document.getElementById('simulationResults');
        if (simResultsElement) {
            simResultsElement.innerHTML = '<p class="text-info m-0"><i class="fas fa-spinner fa-spin"></i> 正在載入食譜數據...</p>';
        }
        
        const response = await apiFetch('/v3/all-recipes');
        if (response.success && response.recipes) {
            allRecipes = response.recipes;
            console.log(`成功載入 ${allRecipes.length} 個食譜`);
            
            // 將所有食譜緩存到 recipeCache 中，以便快速查找
            allRecipes.forEach(recipe => {
                cacheRecipe(recipe);
            });
            
            console.log('食譜數據已緩存');
            
            // 更新載入成功訊息
            if (simResultsElement) {
                simResultsElement.innerHTML = `<p class="text-success m-0">✓ 成功載入 ${allRecipes.length} 個食譜</p>`;
                // 短暫顯示後恢復原始提示
                setTimeout(() => {
                    simResultsElement.innerHTML = '<p class="text-muted m-0">請完成訂單...</p>';
                }, 2000);
            }
        }
    } catch (error) {
        console.error('載入所有食譜失敗:', error);
        const simResultsElement = document.getElementById('simulationResults');
        if (simResultsElement) {
            simResultsElement.innerHTML = `<p class="text-danger m-0"><i class="fas fa-exclamation-circle"></i> 載入食譜失敗: ${error.message}</p>`;
        }
    } finally {
        isLoadingRecipes = false; // 無論成功與否，都重置載入狀態
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
    await loadItems();
    await loadAllRecipes(); // 新增：載入所有食譜
    initializeSimulator();
});

// 模擬器全局變數
let simulatorItems = {
    t0: [], // 基礎食材
    t2: []  // 最終料理
};
let selectedCookingMethod = '';
let selectedT0Category = '肉類'; // 預設顯示肉類
// 新增: 緩存配方信息
let recipeCache = {};

// 更新分數顯示
function updateScoreDisplay() {
    const scoreDisplay = document.getElementById('simulationResults');
    if (scoreDisplay) {
        scoreDisplay.innerHTML = `<p class="simulation-success">當前分數: ${playerScore} 分</p>`;
    }
}

// 初始化模擬器
function initializeSimulator() {
    // 重置分數
    playerScore = 0;
    updateScoreDisplay();
    
    // 載入 T0 物品到模擬器
    simulatorItems.t0 = currentItems.filter(item => item.item_tier === 0);
    
    setupT0CategoryFilters();

    renderSimulatorItems();
    
    // 清空 T2 區域
    simulatorItems.t2 = [];
    
    // 清空組合區
    document.querySelectorAll('.crafting-slot').forEach(slot => {
        while (slot.firstChild) {
            slot.removeChild(slot.firstChild);
        }
    });
    
    // 重置烹飪方法選擇
    document.querySelectorAll('.cooking-method-btn').forEach(btn => {
        btn.classList.remove('active', 'recommended');
    });
    selectedCookingMethod = '';
    
    // 清空模擬結果
    document.getElementById('simulationResults').innerHTML = '<p class="text-muted m-0">請完成訂單...</p>';
    
    // 設置拖放事件
    setupCraftingSlotListeners();
    setupDraggableItemListeners();
    
    // 設置烹飪方法選擇
    setupCookingMethodSelection();
    
    // 新增: 顯示隨機T2料理 (訂單1)
    displayRandomT2Item();
    
    // 新增: 顯示隨機T2料理 (訂單2)
    displayRandomT2Item2();
}

function setupT0CategoryFilters() {
    const filterContainer = document.getElementById('t0CategoryFilters');
    if (!filterContainer) return;
    filterContainer.innerHTML = '';

    const categories = ['肉類', '蔬菜', '加工品', '調味醬料'];

    categories.forEach(category => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline-secondary mx-1';
        button.textContent = category;
        button.dataset.category = category;

        if (category === selectedT0Category) {
            button.classList.add('active');
        }

        button.addEventListener('click', function() {
            selectedT0Category = this.dataset.category;
            // Update active state
            filterContainer.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Re-render T0 items and re-attach listeners
            renderSimulatorItems();
            setupDraggableItemListeners();
        });
        filterContainer.appendChild(button);
    });
}

// 渲染模擬器物品
function renderSimulatorItems() {
    // 渲染 T0 物品
    const t0Container = document.getElementById('t0ItemsContainer');
    t0Container.innerHTML = '';
    
    const filteredT0Items = selectedT0Category === '全部'
        ? simulatorItems.t0
        : simulatorItems.t0.filter(item => item.category === selectedT0Category);

    filteredT0Items.forEach(item => {
        const itemElement = createSimItemElement(item, 0);
        t0Container.appendChild(itemElement);
    });
    
    // 渲染 T2 物品
    const t2Container = document.getElementById('t2ItemsContainer');
    t2Container.innerHTML = '';
    simulatorItems.t2.forEach(item => {
        const itemElement = createSimItemElement(item, 2);
        t2Container.appendChild(itemElement);
    });
    // 為新生成的 T2 物品按鈕綁定事件
    setupPathButtonListeners();
}

// 創建模擬物品元素
function createSimItemElement(item, tier) {
    const itemElement = document.createElement('div');
    itemElement.className = 'sim-item';
    itemElement.draggable = true;
    itemElement.dataset.itemId = item.item_id;
    itemElement.dataset.tier = tier;
    
    // 添加 ASCII 符號
    const symbolElement = document.createElement('div');
    symbolElement.className = 'ascii-symbol';
    symbolElement.textContent = item.ascii_symbol || '?';
    itemElement.appendChild(symbolElement);
    
    // 添加物品名稱
    const nameElement = document.createElement('div');
    nameElement.className = 'item-name';
    nameElement.title = item.item_name;
    nameElement.textContent = item.item_name;
    itemElement.appendChild(nameElement);
    
    // 移除檢視合成路徑按鈕，但保留為訂單項目以外的 T2 物品添加按鈕的功能
  //  if (tier === 2 && !itemElement.closest('#randomT2Item')) {
  //     const pathButton = document.createElement('button');
   //     pathButton.className = 'btn btn-sm btn-outline-info view-path-btn';
    //    pathButton.innerHTML = '🌳';
     //   pathButton.title = '檢視合成路徑';
      //  pathButton.dataset.itemId = item.item_id;
      //  itemElement.appendChild(pathButton);
   // }

    return itemElement;
}

// 設置可拖曳物品的事件
function setupDraggableItemListeners() {
    // 修改：同時選擇 T0 物品和工作區的物品
    const draggableItems = document.querySelectorAll('#t0ItemsContainer .sim-item, #craftingArea .sim-item');
    draggableItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
    });
}

// 設置組合區域的監聽器
function setupCraftingSlotListeners() {
    // 主要工作區的拖曳監聽
    const craftingSlots = document.querySelectorAll('#craftingArea .crafting-slot');
    craftingSlots.forEach(slot => {
        // 防止重複綁定監聽器
        if (slot.dataset.listenersAttached) return;
        
        slot.addEventListener('dragover', handleDragOver);
        slot.addEventListener('dragleave', handleDragLeave);
        slot.addEventListener('drop', handleDrop);
        
        // 點擊移除物品
        slot.addEventListener('click', function(e) {
            if (e.target.closest('.sim-item')) {
                e.target.closest('.sim-item').remove();
                updateRecommendedCookingMethod();
            }
        });
        
        slot.dataset.listenersAttached = 'true';
    });
    
    // 訂單1區域的拖曳監聽
    const orderSlots = document.querySelectorAll('.crafting-slot:not(.order2-slot)');
    orderSlots.forEach(slot => {
        if (!slot.closest('#craftingArea')) {  // 確保不重複添加監聽器給主要工作區
            // 防止重複綁定監聽器
            if (slot.dataset.listenersAttached) return;
            
            slot.addEventListener('dragover', handleDragOver);
            slot.addEventListener('dragleave', handleDragLeave);
            slot.addEventListener('drop', handleDrop);
            
            // 雙擊移除物品
            slot.addEventListener('dblclick', function(e) {
                const simItem = this.querySelector('.sim-item');
                if (simItem) {
                    simItem.remove();
                    updateSimulationResults('已移除物品', 'info');
                }
            });
            
            slot.dataset.listenersAttached = 'true';
        }
    });
    
    // 訂單2區域的拖曳監聽
    const order2Slots = document.querySelectorAll('.order2-slot');
    order2Slots.forEach(slot => {
        // 防止重複綁定監聽器
        if (slot.dataset.listenersAttached) return;
        
        slot.addEventListener('dragover', handleDragOver);
        slot.addEventListener('dragleave', handleDragLeave);
        slot.addEventListener('drop', handleDrop);
        
        // 雙擊移除物品
        slot.addEventListener('dblclick', function(e) {
            const simItem = this.querySelector('.sim-item');
            if (simItem) {
                simItem.remove();
                updateSimulationResults('已移除物品', 'info');
            }
        });
        
        slot.dataset.listenersAttached = 'true';
    });
}

// 拖放事件處理函數
function handleDragStart(e) {
    // 檢查是否是從工作區拖曳的物品
    const isFromCraftingArea = this.closest('#craftingArea') !== null;
    
    // 將物品信息和來源信息一起存儲
    e.dataTransfer.setData('text/plain', JSON.stringify({
        itemId: this.dataset.itemId,
        tier: this.dataset.tier,
        fromCraftingArea: isFromCraftingArea
    }));
    
    // 如果是從工作區拖曳，添加一個標記，以便在拖放完成後可以識別
    if (isFromCraftingArea) {
        this.dataset.beingDragged = 'true';
    }
}

function handleDragOver(e) {
    e.preventDefault();
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    // 檢查槽位是否已有物品
    if (this.querySelector('.sim-item')) {
        return; // 槽位已被佔用
    }
    
    try {
        // 獲取拖放的物品數據
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const itemId = data.itemId;
        const tier = parseInt(data.tier);
        const fromCraftingArea = data.fromCraftingArea || false;
        
        // 找到對應的物品
        let item;
        
        // 如果是從工作區拖來的物品，直接從 currentItems 中查找
        if (fromCraftingArea) {
            item = currentItems.find(i => i.item_id === itemId);
        } else {
            // 否則從對應的 tier 列表中查找
            if (tier === 0) {
                item = simulatorItems.t0.find(i => i.item_id === itemId);
            } else if (tier === 2) {
                item = simulatorItems.t2.find(i => i.item_id === itemId);
            }
        }
        
        if (!item) {
            console.error('找不到物品:', itemId, 'tier:', tier);
            return;
        }
        
        // 創建物品元素並添加到槽位
        const itemElement = createSimItemElement(item, tier);
        
        // 如果不是工作區，則禁用拖曳
        if (!this.closest('#craftingArea')) {
            itemElement.draggable = false;
        }
        
        this.appendChild(itemElement);
        
        // 如果是從工作區拖來的物品，清空原來的格子
        if (fromCraftingArea) {
            const originalItem = document.querySelector('#craftingArea .sim-item[data-being-dragged="true"]');
            if (originalItem) {
                originalItem.remove();
            }
        }
        
        // 更新推薦的烹飪方法，僅當操作在主工作區時
        if (this.closest('#craftingArea')) {
            updateRecommendedCookingMethod();
        }
        
        // 為新添加的物品設置拖曳事件（如果在工作區）
        if (this.closest('#craftingArea')) {
            setupDraggableItemListeners();
        }
    } catch (error) {
        console.error('處理拖放時發生錯誤:', error);
    }
}

// 設置烹飪方法選擇
function setupCookingMethodSelection() {
    const cookingMethodBtns = document.querySelectorAll('.cooking-method-btn');
    cookingMethodBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // 跳過出餐按鈕
            if (this.classList.contains('btn-serve-order')) return;
            
            // 移除其他按鈕的活動狀態
            cookingMethodBtns.forEach(b => {
                if (!b.classList.contains('btn-serve-order')) {
                    b.classList.remove('active');
                }
            });
            // 設置當前按鈕為活動狀態
            this.classList.add('active');
            // 更新選中的烹飪方法
            selectedCookingMethod = this.dataset.method;
            // 直接執行模擬
            executeSimulation();
        });
    });

    // 為訂單區域的出餐按鈕添加特殊處理
    const serveOrderBtns = document.querySelectorAll('.btn-serve-order');
    serveOrderBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // 設置烹飪方法為"組合"
            selectedCookingMethod = 'assembly';
            
            // 獲取訂單區域的格子中的物品
            const orderSlots = Array.from(this.closest('.d-flex.flex-column').querySelectorAll('.crafting-slot .sim-item')).map(item => ({
                itemId: item.dataset.itemId,
                tier: parseInt(item.dataset.tier)
            }));
            
            // 檢查是否有物品
            if (orderSlots.length === 0) {
                updateSimulationResults('請先將物品拖曳到訂單區域的格子中。', 'error');
                return;
            }
            
            // 準備模擬數據
            const simulationData = {
                items: orderSlots.map(item => item.itemId),
                cookingMethod: selectedCookingMethod
            };
            
            // 判斷是訂單1還是訂單2
            const isOrder2 = this.dataset.order === '2';
            
            // 執行模擬
            executeOrderSimulation(simulationData, orderSlots, isOrder2);
        });
    });
}

// 更新推薦的烹飪方法
function updateRecommendedCookingMethod() {
    // 獲取組合區中的所有物品
    const craftingItems = Array.from(document.querySelectorAll('#craftingArea .crafting-slot .sim-item'));
    
    // 檢查是否有 T2 物品
    const hasT2Items = craftingItems.some(item => parseInt(item.dataset.tier) === 2);
    
    // 移除所有推薦標記
    document.querySelectorAll('.cooking-method-btn').forEach(btn => {
        btn.classList.remove('recommended');
    });
    
    // 如果有 T2 物品，推薦「組合」方法
    if (hasT2Items) {
        const assemblyBtn = document.querySelector('.cooking-method-btn[data-method="assembly"]');
        if (assemblyBtn) {
            assemblyBtn.classList.add('recommended');
        }
    }
}

// 執行模擬
async function executeSimulation() {
    // --- DEBUGGING LOGS START ---
    console.log("--- [DEBUG] executeSimulation triggered ---");
    try {
        const mainCraftingArea = document.getElementById('craftingArea');
        console.log("[DEBUG] Cooking Method:", selectedCookingMethod);
        
        const craftingItemElements = mainCraftingArea.querySelectorAll('.crafting-slot .sim-item');
        const craftingItems = Array.from(craftingItemElements).map(item => ({
            itemId: item.dataset.itemId,
            tier: parseInt(item.dataset.tier),
            name: item.querySelector('.item-name').textContent
        }));
        
        console.log(`[DEBUG] Found ${craftingItems.length} items in #craftingArea:`, JSON.stringify(craftingItems, null, 2));

        // 檢查是否有物品
        if (craftingItems.length === 0) {
            updateSimulationResults('請先將物品拖曳到組合區。', 'error');
            console.log("[DEBUG] Aborting: No items in crafting area.");
            return;
        }
        
        // 檢查是否選擇了烹飪方法
        if (!selectedCookingMethod) {
            updateSimulationResults('請選擇一種烹飪方法。', 'error');
            console.log("[DEBUG] Aborting: No cooking method selected.");
            return;
        }
        
        // 準備模擬數據
        const simulationData = {
            items: craftingItems.map(item => item.itemId),
            cookingMethod: selectedCookingMethod
        };
        console.log("[DEBUG] Sending data to API /v3/simulate:", JSON.stringify(simulationData, null, 2));
        
        const cookingMethodMap = {
            'grill': '烤製',
            'pan_fry': '煎炒',
            'deep_fry': '油炸',
            'boil': '水煮',
            'assembly': '組合'
        };
        const methodText = cookingMethodMap[selectedCookingMethod] || selectedCookingMethod;
        
        const result = await apiFetch('/v3/simulate', {
            method: 'POST',
            body: simulationData
        });
        
        let cookTime = 3;
        if (result.success && result.recipe && result.recipe.cook_time_sec) {
            cookTime = result.recipe.cook_time_sec;
        }
        
        updateSimulationResults(`${methodText}中...`, 'info', cookTime);
        
        setTimeout(() => {
            handleSimulationResult(result, craftingItems);
        }, cookTime * 1000);
        
    } catch (error) {
        console.error("[DEBUG] A critical error occurred in executeSimulation:", error);
        updateSimulationResults(`模擬失敗: ${error.message}`, 'error');
    }
    // --- DEBUGGING LOGS END ---
}

// 新增: 訂單區域的模擬執行函數
async function executeOrderSimulation(simulationData, inputItems, isOrder2 = false) {
    try {
        // 顯示模擬訊息
        updateSimulationResults('組合中...', 'info', 3);
        
        // 呼叫模擬 API
        const result = await apiFetch('/v3/simulate', {
            method: 'POST',
            body: simulationData
        });
        
        // 獲取食譜的烹飪時間（如果成功）
        let cookTime = 3; // 默認3秒
        if (result.success && result.recipe && result.recipe.cook_time_sec) {
            cookTime = result.recipe.cook_time_sec;
        }
        
        // 延遲處理結果，模擬烹飪時間
        setTimeout(() => {
            // 傳入 'orderArea' 作為來源標識，並傳入是否為訂單2的標記
            handleSimulationResult(result, inputItems, isOrder2 ? 'orderArea2' : 'orderArea');
            
            // 清空訂單區域的格子 - 這個邏輯移到 handleSimulationResult 中
        }, cookTime * 1000);
        
    } catch (error) {
        updateSimulationResults(`模擬失敗: ${error.message}`, 'error');
    }
}

// 處理模擬結果
function handleSimulationResult(result, inputItems, source = 'craftingArea') {
    // --- DEBUGGING LOGS START ---
    console.log("--- [DEBUG] handleSimulationResult triggered ---");
    console.log("[DEBUG] Source of simulation:", source);
    console.log("[DEBUG] Raw result from server:", JSON.stringify(result, null, 2));
    console.log("[DEBUG] Input items for this simulation:", JSON.stringify(inputItems, null, 2));
    // --- DEBUGGING LOGS END ---

    // 移除任何可能存在的覆蓋層
    const existingBoilOverlay = document.getElementById('boilOverlay');
    if (existingBoilOverlay) {
        existingBoilOverlay.remove();
    }
    const existingFryOverlay = document.getElementById('fryOverlay');
    if (existingFryOverlay) {
        existingFryOverlay.remove();
    }
    const existingGrillOverlay = document.getElementById('grillOverlay');
    if (existingGrillOverlay) {
        existingGrillOverlay.remove();
    }
    const existingPanFryOverlay = document.getElementById('panFryOverlay');
    if (existingPanFryOverlay) {
        existingPanFryOverlay.remove();
    }
    const existingAssemblyOverlay = document.getElementById('assemblyOverlay');
    if (existingAssemblyOverlay) {
        existingAssemblyOverlay.remove();
    }
    
    // 清除倒數計時器
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }
    
    if (result.success) {
        // 顯示成功訊息
        const outputItem = result.outputItem;
        const outputTier = outputItem.item_tier;
        
        // 根據來源執行不同操作
        if (source === 'craftingArea') {
            // 來自主要工作區的烹飪，將成品放回工作區
            console.log("[DEBUG] Handling result for 'craftingArea'. Placing item in crafting area.");
            // 清空工作區的所有格子
            document.querySelectorAll('#craftingArea .crafting-slot .sim-item').forEach(item => item.remove());
            
            // 創建成品元素
            const craftingSlots = document.querySelectorAll('#craftingArea .crafting-slot');
            if (craftingSlots.length > 0) {
                const firstSlot = craftingSlots[0];
                const outputItemElement = createSimItemElement(outputItem, outputTier);
                
                // 添加到第一個格子
                firstSlot.appendChild(outputItemElement);
                
                // 重新為新生成的物品設置拖曳事件
                setupDraggableItemListeners();
            }
        } else if (source === 'orderArea') {
            // 來自訂單1區的組合，視為出餐，清空訂單區格子
            console.log("[DEBUG] Handling result for 'orderArea'. Clearing order slots.");
            document.querySelectorAll('.btn-serve-order:not([data-order="2"])').forEach(btn => {
                const slots = btn.closest('.d-flex.flex-column').querySelectorAll('.crafting-slot');
                slots.forEach(slot => {
                    while (slot.firstChild) {
                        slot.removeChild(slot.firstChild);
                    }
                });
            });
            
            // 檢查是否完成訂單1
            if (outputItem.item_id === currentOrder) {
                // 訂單1完成!
                const points = outputItem.base_points || 100; // 默認100分
                playerScore += points;
                
                // 更新分數顯示
                updateScoreDisplay();
                
                // 清除訂單計時器
                if (orderTimer) {
                    clearInterval(orderTimer);
                    orderTimer = null;
                }
                
                // 顯示訂單完成訊息
                updateSimulationResults(`訂單1完成! 獲得 ${points} 分`, "success");
                
                // 生成新訂單1
                setTimeout(() => displayRandomT2Item(), 1500);
            }
        } else if (source === 'orderArea2') {
            // 來自訂單2區的組合，視為出餐，清空訂單2區格子
            console.log("[DEBUG] Handling result for 'orderArea2'. Clearing order2 slots.");
            document.querySelectorAll('.btn-serve-order[data-order="2"]').forEach(btn => {
                const slots = btn.closest('.d-flex.flex-column').querySelectorAll('.crafting-slot');
                slots.forEach(slot => {
                    while (slot.firstChild) {
                        slot.removeChild(slot.firstChild);
                    }
                });
            });
            
            // 檢查是否完成訂單2
            if (outputItem.item_id === currentOrder2) {
                // 訂單2完成!
                const points = outputItem.base_points || 100; // 默認100分
                playerScore += points;
                
                // 更新分數顯示
                updateScoreDisplay();
                
                // 清除訂單2計時器
                if (orderTimer2) {
                    clearInterval(orderTimer2);
                    orderTimer2 = null;
                }
                
                // 顯示訂單完成訊息
                updateSimulationResults(`訂單2完成! 獲得 ${points} 分`, "success");
                
                // 生成新訂單2
                setTimeout(() => displayRandomT2Item2(), 1500);
            }
        }
        
        // 不再使用simulationHistory存儲模擬結果
        // 而是直接將配方信息存儲到API或本地緩存中
        if (result.recipe) {
            // 如果API返回了配方信息，可以將其緩存起來
            cacheRecipe(result.recipe);
        }
        
        // 顯示成功訊息
        const inputItemsText = inputItems.map(item => {
            return `${item.name}(T${item.tier})`;
        }).join(', ');
        
        const cookingMethodMap = {
            'grill': '烤製',
            'pan_fry': '煎炒',
            'deep_fry': '油炸',
            'boil': '水煮',
            'assembly': '組合'
        };
        
        const methodText = cookingMethodMap[selectedCookingMethod] || selectedCookingMethod;
        
        // 在結果區域顯示簡單成功訊息
        let resultHtml = `
            
            <div class="simulation-success">
                ✅ 成功! 獲得: [${outputItem.item_name}]  
            </div>
        `;
        
        // 更新結果區域
        document.getElementById('simulationResults').innerHTML = resultHtml;
        
        // 如果是水煮或油炸或烤製方法，顯示大型成功訊息覆蓋層
        if (selectedCookingMethod === 'boil' || selectedCookingMethod === 'deep_fry' || 
            selectedCookingMethod === 'grill' || selectedCookingMethod === 'pan_fry') {
            // 創建成功訊息覆蓋層
            const successOverlay = document.createElement('div');
            successOverlay.className = 'success-message-overlay';
            successOverlay.id = 'successOverlay';
            successOverlay.innerHTML = `
                <div class="success-message-content">
                    <div class="item-ascii">${outputItem.ascii_symbol || '?'}</div>
                    <div class="item-name-text">${outputItem.item_name}</div>
                    <div class="success-text">獲得！</div>
                </div>
            `;
            document.body.appendChild(successOverlay);
            
            // 3秒後自動移除成功訊息
            setTimeout(() => {
                const existingSuccessOverlay = document.getElementById('successOverlay');
                if (existingSuccessOverlay) {
                    existingSuccessOverlay.remove();
                }
            }, 3000);
        }
    } else {
        // 顯示錯誤訊息
        let errorMessage = result.error || '模擬失敗，未知錯誤。';
        
        // 檢查是否是 V3 規則錯誤
        if (result.ruleViolation) {
            errorMessage = `${result.ruleViolation}`;
        }
        
        updateSimulationResults(errorMessage, 'error');
        
        // 烹飪失敗時，食材保持原位，不做任何清理
    }
}

// 更新模擬結果
function updateSimulationResults(message, type = 'info', cookTime = 3) {
    const resultsElement = document.getElementById('simulationResults');
    
    // 移除任何可能存在的覆蓋層和計時器
    const existingOverlays = document.querySelectorAll('.fullscreen-boil-overlay, .fullscreen-fry-overlay, .fullscreen-grill-overlay, .fullscreen-pan-fry-overlay, .fullscreen-assembly-overlay');
    existingOverlays.forEach(overlay => overlay.remove());
    
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }
    
    // 檢查是否是水煮模擬
    if (message === '水煮中...') {
        // 在結果區域顯示簡單提示
        resultsElement.innerHTML = `<div class="simulation-${type}">${message}</div>`;
        
        // 創建全螢幕覆蓋層
        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-boil-overlay';
        overlay.id = 'boilOverlay';
        overlay.innerHTML = `
            <div class="fullscreen-boil-spinner">
                <svg viewBox="0 0 24 24" fill="currentColor" class="fullscreen-boil-wave">
                    <path d="M12.001 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624C13.666 10.618 15.027 12 18.001 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.337 6.182 14.976 4.8 12.001 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624 1.177 1.194 2.538 2.576 5.512 2.576 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C10.337 13.382 8.976 12 6.001 12z"></path>
                </svg>
            </div>
            <div class="fullscreen-boil-text">水煮中... <span id="countdownTimer">${cookTime}</span>秒</div>
        `;
        document.body.appendChild(overlay);
        
        // 設置倒數計時
        let timeLeft = cookTime;
        const countdownElement = document.getElementById('countdownTimer');
        window.countdownInterval = setInterval(() => {
            timeLeft--;
            if (countdownElement) {
                countdownElement.textContent = timeLeft;
            }
            if (timeLeft <= 0) {
                clearInterval(window.countdownInterval);
            }
        }, 1000);
    } 
    // 檢查是否是油炸模擬
    else if (message === '油炸中...') {
        // 在結果區域顯示簡單提示
        resultsElement.innerHTML = `<div class="simulation-${type}">${message}</div>`;
        
        // 創建全螢幕覆蓋層
        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-fry-overlay';
        overlay.id = 'fryOverlay';
        overlay.innerHTML = `
            <div class="fullscreen-fry-spinner">
                <div class="fullscreen-fry-bubbles">
                    <div class="fry-bubble"></div>
                    <div class="fry-bubble"></div>
                    <div class="fry-bubble"></div>
                    <div class="fry-bubble"></div>
                    <div class="fry-bubble"></div>
                </div>
            </div>
            <div class="fullscreen-fry-text">油炸中... <span id="countdownTimer">${cookTime}</span>秒</div>
        `;
        document.body.appendChild(overlay);
        
        // 設置倒數計時
        let timeLeft = cookTime;
        const countdownElement = document.getElementById('countdownTimer');
        window.countdownInterval = setInterval(() => {
            timeLeft--;
            if (countdownElement) {
                countdownElement.textContent = timeLeft;
            }
            if (timeLeft <= 0) {
                clearInterval(window.countdownInterval);
            }
        }, 1000);
    }
    // 檢查是否是烤製模擬
    else if (message === '烤製中...') {
        // 在結果區域顯示簡單提示
        resultsElement.innerHTML = `<div class="simulation-${type}">${message}</div>`;
        
        // 創建全螢幕覆蓋層
        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-grill-overlay';
        overlay.id = 'grillOverlay';
        overlay.innerHTML = `
            <div class="fire">
                <div class="fire-center">
                    <div class="main-fire"></div>
                    <div class="particle-fire"></div>
                </div>
                <div class="fire-right">
                    <div class="main-fire"></div>
                    <div class="particle-fire"></div>
                </div>
                <div class="fire-left">
                    <div class="main-fire"></div>
                    <div class="particle-fire"></div>
                </div>
                <div class="fire-bottom">
                    <div class="main-fire"></div>
                </div>
            </div>
            <div class="fullscreen-grill-text">烤製中... <span id="countdownTimer">${cookTime}</span>秒</div>
        `;
        document.body.appendChild(overlay);
        
        // 設置倒數計時
        let timeLeft = cookTime;
        const countdownElement = document.getElementById('countdownTimer');
        window.countdownInterval = setInterval(() => {
            timeLeft--;
            if (countdownElement) {
                countdownElement.textContent = timeLeft;
            }
            if (timeLeft <= 0) {
                clearInterval(window.countdownInterval);
            }
        }, 1000);
    }
    // 檢查是否是煎炒模擬
    else if (message === '煎炒中...') {
        // 在結果區域顯示簡單提示
        resultsElement.innerHTML = `<div class="simulation-${type}">${message}</div>`;
        
        // 創建全螢幕覆蓋層
        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-pan-fry-overlay';
        overlay.id = 'panFryOverlay';
        overlay.innerHTML = `
            <div class="loader">
                <div class="panWrapper">
                    <div class="pan">
                        <div class="food"></div>
                        <div class="panBase"></div>
                        <div class="panHandle"></div>
                        <div class="pan-flames">
                            <div class="flame"></div>
                            <div class="flame"></div>
                            <div class="flame"></div>
                            <div class="flame"></div>
                            <div class="flame"></div>
                        </div>
                    </div>
                    <div class="panShadow"></div>
                </div>
            </div>
            <div class="fullscreen-pan-fry-text">煎炒中... <span id="countdownTimer">${cookTime}</span>秒</div>
        `;
        document.body.appendChild(overlay);
        
        // 設置倒數計時
        let timeLeft = cookTime;
        const countdownElement = document.getElementById('countdownTimer');
        window.countdownInterval = setInterval(() => {
            timeLeft--;
            if (countdownElement) {
                countdownElement.textContent = timeLeft;
            }
            if (timeLeft <= 0) {
                clearInterval(window.countdownInterval);
            }
        }, 1000);
    }
    // 檢查是否是組合模擬
    else if (message === '組合中...') {
        // 在結果區域顯示簡單提示
        resultsElement.innerHTML = `<div class="simulation-${type}">${message}</div>`;
        
        // 創建全螢幕覆蓋層
        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-assembly-overlay';
        overlay.id = 'assemblyOverlay';
        overlay.innerHTML = `
            <div class="assembly-loader">
                <div class="ground"><div></div></div>
                <div class="box box0"><div></div></div>
                <div class="box box1"><div></div></div>
                <div class="box box2"><div></div></div>
                <div class="box box3"><div></div></div>
                <div class="box box4"><div></div></div>
                <div class="box box5"><div></div></div>
                <div class="box box6"><div></div></div>
                <div class="box box7"><div></div></div>
            </div>
            <div class="fullscreen-assembly-text">組合中... <span id="countdownTimer">${cookTime}</span>秒</div>
        `;
        document.body.appendChild(overlay);
        
        // 設置倒數計時
        let timeLeft = cookTime;
        const countdownElement = document.getElementById('countdownTimer');
        window.countdownInterval = setInterval(() => {
            timeLeft--;
            if (countdownElement) {
                countdownElement.textContent = timeLeft;
            }
            if (timeLeft <= 0) {
                clearInterval(window.countdownInterval);
            }
        }, 1000);
    }
    else {
        // 確保移除任何可能存在的覆蓋層
        const existingBoilOverlay = document.getElementById('boilOverlay');
        if (existingBoilOverlay) {
            existingBoilOverlay.remove();
        }
        const existingFryOverlay = document.getElementById('fryOverlay');
        if (existingFryOverlay) {
            existingFryOverlay.remove();
        }
        const existingGrillOverlay = document.getElementById('grillOverlay');
        if (existingGrillOverlay) {
            existingGrillOverlay.remove();
        }
        const existingPanFryOverlay = document.getElementById('panFryOverlay');
        if (existingPanFryOverlay) {
            existingPanFryOverlay.remove();
        }
        const existingAssemblyOverlay = document.getElementById('assemblyOverlay');
        if (existingAssemblyOverlay) {
            existingAssemblyOverlay.remove();
        }
        resultsElement.innerHTML = `<div class="simulation-${type}">${message}</div>`;
    }
}

// 新增：為路徑檢視按鈕綁定事件
function setupPathButtonListeners() {
    document.querySelectorAll('.view-path-btn').forEach(btn => {
        // 為防止重複綁定，先移除舊的監聽器
        btn.replaceWith(btn.cloneNode(true));
    });
    // 重新為複製的節點綁定事件
    document.querySelectorAll('.view-path-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            showSynthesisPath(this.dataset.itemId);
        });
    });
}

// 新增：顯示合成路徑
function showSynthesisPath(t2ItemId) {
    const pathModal = new bootstrap.Modal(document.getElementById('synthesisPathModal'));
    const t2Item = currentItems.find(item => item.item_id === t2ItemId);
    
    if (!t2Item) return;

    document.getElementById('synthesisPathModalLabel').textContent = `🍔 ${t2Item.item_name} (T2) - 合成路徑`;
    
    // 使用異步函數獲取路徑樹
    buildPathTreeAsync(t2ItemId).then(pathHtml => {
        document.getElementById('synthesisPathContent').innerHTML = `<ul>${pathHtml}</ul>`;
    pathModal.show();
    }).catch(error => {
        console.error('獲取合成路徑失敗:', error);
        document.getElementById('synthesisPathContent').innerHTML = `<p class="text-danger">獲取合成路徑失敗</p>`;
        pathModal.show();
    });
}

// 異步構建路徑樹
async function buildPathTreeAsync(itemId) {
    try {
    const item = currentItems.find(i => i.item_id === itemId);
    if (!item) return `<li>未知物品: ${itemId}</li>`;

        // 對於T0物品，直接返回
        if (item.item_tier === 0) {
            return `<li><span class="badge bg-secondary">T0</span> ${item.ascii_symbol} ${item.item_name}</li>`;
        }

        // 首先檢查緩存
        let recipes = getCachedRecipesByOutput(itemId);
        let recipe = recipes.length > 0 ? recipes[0] : null;
        
        // 如果緩存中沒有，嘗試從API獲取
    if (!recipe) {
            try {
                const response = await apiFetch('/v3/recipe-by-output', {
                    method: 'POST',
                    body: { outputItemId: itemId }
                });
                if (response.success && response.recipe) {
                    recipe = response.recipe;
                    cacheRecipe(recipe);
                }
            } catch (error) {
                console.error('獲取食譜信息失敗:', error);
            }
        }
        
        // 如果API獲取失敗，嘗試從本地查找可能的配方
        if (!recipe) {
            const possibleRecipes = await findPossibleRecipes(item);
            if (possibleRecipes && possibleRecipes.length > 0) {
                recipe = possibleRecipes[0];
            } else {
                return `<li><span class="badge ${item.item_tier === 1 ? 'bg-warning text-dark' : 'bg-success'}">T${item.item_tier}</span> ${item.ascii_symbol} ${item.item_name} <small class="text-muted">(未知合成方法)</small></li>`;
            }
        }

        // 烹飪方法映射
    const cookingMethodMap = {
        'grill': '烤製', 'pan_fry': '煎炒', 'deep_fry': '油炸',
        'boil': '水煮', 'assembly': '組合'
    };
        const methodText = cookingMethodMap[recipe.cooking_method] || recipe.cooking_method;
    const tierBadge = item.item_tier === 1 ? 'bg-warning text-dark' : 'bg-success';
    
        // 獲取原料信息
        const requirements = recipe.requirements || [];
        
        // 處理食材數量 - 合併相同食材並計算數量
        const ingredientCounts = {};
        requirements.forEach(req => {
            const reqItemId = req.item_id;
            if (!ingredientCounts[reqItemId]) {
                ingredientCounts[reqItemId] = {
                    count: 0,
                    itemId: reqItemId
                };
            }
            ingredientCounts[reqItemId].count += req.quantity || 1; // 如果沒有指定數量，默認為1
        });
        
        // 獲取每種食材的詳細信息並構建子節點
        let childrenHtml = '<ul>';
        for (const [reqItemId, countInfo] of Object.entries(ingredientCounts)) {
            const inputItem = currentItems.find(i => i.item_id === reqItemId) || 
                             { item_id: reqItemId, item_name: reqItemId, ascii_symbol: '?', item_tier: 0 };
            
            // 遞歸構建子節點
            const childHtml = await buildPathTreeAsync(reqItemId);
            
            // 如果數量大於1，添加數量標記
            const quantityText = countInfo.count > 1 ? ` × ${countInfo.count}` : '';
            
            // 替換子節點中的第一個<li>標籤，添加數量信息
            const updatedChildHtml = childHtml.replace(/<li>/, `<li data-quantity="${countInfo.count}">`).replace(
                /<\/span> ([^<]+)<\/li>/, 
                `</span> $1${quantityText}</li>`
            );
            
            childrenHtml += updatedChildHtml;
        }
        childrenHtml += '</ul>';

    return `
        <li>
            <span class="badge ${tierBadge}">T${item.item_tier}</span>
            ${item.ascii_symbol} ${item.item_name}
            <small class="text-muted">(來自: ${methodText})</small>
            ${childrenHtml}
        </li>
    `;
    } catch (error) {
        console.error('構建路徑樹失敗:', error);
        return `<li class="text-danger">構建路徑失敗</li>`;
    }
}

// 新增: 顯示隨機T2料理
async function displayRandomT2Item() {
    const randomT2Display = document.getElementById('randomT2Item');
    if (!randomT2Display) return;
    
    // 清空現有內容
    randomT2Display.innerHTML = '';
    
    try {
        // 顯示載入中動畫
        randomT2Display.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="width: 100%; height: 100%;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">載入中...</span>
                </div>
            </div>
        `;
        
        // 獲取所有T2物品
        const t2Items = currentItems.filter(item => item.item_tier === 2);
        
        // 如果沒有T2物品，顯示提示
        if (t2Items.length === 0) {
            randomT2Display.innerHTML = '<p class="text-muted">無可用的T2料理</p>';
            return;
        }
        
        // 隨機選擇一個T2物品
        const randomIndex = Math.floor(Math.random() * t2Items.length);
        const randomItem = t2Items[randomIndex];
        
        // 設置當前訂單
        currentOrder = randomItem.item_id;
        
        // 創建物品元素
        const itemElement = createSimItemElement(randomItem, 2);
        itemElement.classList.add('order-item-display'); // 添加專用 class
        itemElement.draggable = false;
        
        // 添加訂單標識
        itemElement.classList.add('order-highlight');
        
        // 清空並添加到顯示區域
        randomT2Display.innerHTML = '';
        randomT2Display.appendChild(itemElement);
        
        // 添加訂單標題
        const orderTitle = document.createElement('div');
        orderTitle.className = 'order-title';
        orderTitle.textContent = '';
        randomT2Display.insertBefore(orderTitle, randomT2Display.firstChild);
        
        // 設置提示框
        setupRecipeTooltip(itemElement, randomItem);
        
        // 啟動訂單計時器
        startOrderTimer();
        
        // 顯示新訂單訊息
        updateSimulationResults(`收到新訂單：${randomItem.item_name}!`, 'info');
        
    } catch (error) {
        console.error('顯示隨機T2物品失敗:', error);
        randomT2Display.innerHTML = `
            <div class="text-danger">
                <i class="fas fa-exclamation-circle"></i>
                載入失敗
            </div>
        `;
    }
}

// 新增: 顯示隨機T2料理 (訂單2)
async function displayRandomT2Item2() {
    const randomT2Display = document.getElementById('randomT2Item2');
    if (!randomT2Display) return;
    
    // 清空現有內容
    randomT2Display.innerHTML = '';
    
    try {
        // 顯示載入中動畫
        randomT2Display.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="width: 100%; height: 100%;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">載入中...</span>
                </div>
            </div>
        `;
        
        // 獲取所有T2物品
        const t2Items = currentItems.filter(item => item.item_tier === 2);
        
        // 如果沒有T2物品，顯示提示
        if (t2Items.length === 0) {
            randomT2Display.innerHTML = '<p class="text-muted">無可用的T2料理</p>';
            return;
        }
        
        // 隨機選擇一個T2物品 (與訂單1不同)
        let randomIndex;
        let randomItem;
        do {
            randomIndex = Math.floor(Math.random() * t2Items.length);
            randomItem = t2Items[randomIndex];
        } while (randomItem.item_id === currentOrder); // 確保與訂單1不同
        
        // 設置當前訂單2
        currentOrder2 = randomItem.item_id;
        
        // 創建物品元素
        const itemElement = createSimItemElement(randomItem, 2);
        itemElement.classList.add('order-item-display'); // 添加專用 class
        itemElement.draggable = false;
        
        // 添加訂單標識
        itemElement.classList.add('order-highlight');
        itemElement.classList.add('order-highlight2'); // 添加訂單2專用標識
        
        // 清空並添加到顯示區域
        randomT2Display.innerHTML = '';
        randomT2Display.appendChild(itemElement);
        
        // 添加訂單標題
        const orderTitle = document.createElement('div');
        orderTitle.className = 'order-title';
        orderTitle.textContent = '';
        randomT2Display.insertBefore(orderTitle, randomT2Display.firstChild);
        
        // 設置提示框
        setupRecipeTooltip(itemElement, randomItem);
        
        // 啟動訂單2計時器
        startOrderTimer2();
        
        // 顯示新訂單訊息
        updateSimulationResults(`收到新訂單2：${randomItem.item_name}!`, 'info');
        
    } catch (error) {
        console.error('顯示隨機T2物品失敗 (訂單2):', error);
        randomT2Display.innerHTML = `
            <div class="text-danger">
                <i class="fas fa-exclamation-circle"></i>
                載入失敗
            </div>
        `;
    }
}

// 格式化時間顯示 (分:秒)
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    return `${minutes}:${remainingSecs.toString().padStart(2, '0')}`;
}

// 啟動訂單計時器
function startOrderTimer() {
    // 清除現有計時器
    if (orderTimer) {
        clearInterval(orderTimer);
    }
    
    // 重置時間
    remainingTime = ORDER_TIME;
    updateOrderTimerDisplay();
    
    // 設置新計時器
    orderTimer = setInterval(() => {
        remainingTime--;
        updateOrderTimerDisplay();
        
        if (remainingTime <= 0) {
            // 訂單過期
            clearInterval(orderTimer);
            updateSimulationResults("訂單過期!", "error");
            // 生成新訂單
            setTimeout(() => displayRandomT2Item(), 1500);
        }
    }, 1000);
}

// 啟動訂單2計時器
function startOrderTimer2() {
    // 清除現有計時器
    if (orderTimer2) {
        clearInterval(orderTimer2);
    }
    
    // 重置時間
    remainingTime2 = ORDER_TIME;
    updateOrderTimerDisplay2();
    
    // 設置新計時器
    orderTimer2 = setInterval(() => {
        remainingTime2--;
        updateOrderTimerDisplay2();
        
        if (remainingTime2 <= 0) {
            // 訂單過期
            clearInterval(orderTimer2);
            updateSimulationResults("訂單2過期!", "error");
            // 生成新訂單2
            setTimeout(() => displayRandomT2Item2(), 1500);
        }
    }, 1000);
}

// 更新訂單計時器顯示
function updateOrderTimerDisplay() {
    const timerBar = document.getElementById('orderTimerBar');

    // 計算剩餘時間百分比
    const timePercentage = (remainingTime / ORDER_TIME) * 100;
    
    // 更新進度條寬度
    if(timerBar) {
        timerBar.style.width = `${timePercentage}%`;
        // 更新進度條顏色
        timerBar.classList.remove('warning', 'urgent');
        if (timePercentage < 20) {
            timerBar.classList.add('urgent');
        } else if (timePercentage < 50) {
            timerBar.classList.add('warning');
        }
    }
    
    // 獲取訂單卡片元素
    const orderItem = document.querySelector('.order-highlight');
    
    if (orderItem) {
        // 時間少於30%時添加警示樣式
        if (timePercentage < 30) {
            orderItem.classList.add('order-urgent');
        } else {
            orderItem.classList.remove('order-urgent');
        }
    }
}

// 更新訂單2計時器顯示
function updateOrderTimerDisplay2() {
    const timerBar = document.getElementById('orderTimerBar2');

    // 計算剩餘時間百分比
    const timePercentage = (remainingTime2 / ORDER_TIME) * 100;
    
    // 更新進度條寬度
    if(timerBar) {
        timerBar.style.width = `${timePercentage}%`;
        // 更新進度條顏色
        timerBar.classList.remove('warning', 'urgent');
        if (timePercentage < 20) {
            timerBar.classList.add('urgent');
        } else if (timePercentage < 50) {
            timerBar.classList.add('warning');
        }
    }
    
    // 獲取訂單2卡片元素
    const orderItem2 = document.querySelector('.order-highlight2');
    
    if (orderItem2) {
        // 時間少於30%時添加警示樣式
        if (timePercentage < 30) {
            orderItem2.classList.add('order-urgent');
        } else {
            orderItem2.classList.remove('order-urgent');
        }
    }
}

// 新增: 設置組合提示功能
function setupRecipeTooltip(element, item) {
    // 將元素包裝在 recipe-container 中
    const container = document.createElement('div');
    container.className = 'recipe-container';
    
    // 創建新的提示框元素
    const newTooltip = document.createElement('div');
    newTooltip.className = 'recipe-tooltip-new';
    newTooltip.innerHTML = '<div class="recipe-tooltip-content">載入中...</div>';
    
    // 將元素移到父元素前
    element.parentNode.insertBefore(container, element);
    
    // 將元素移動到容器中
    container.appendChild(element);
    
    // 將提示框添加到容器中
    container.appendChild(newTooltip);
    
    // 預加載配方數據
    loadRecipeData(item, newTooltip);
}

// 新增: 預加載配方數據
async function loadRecipeData(item, tooltip) {
    try {
        if (!item || !item.item_id) {
            tooltip.querySelector('.recipe-tooltip-content').innerHTML = '無法顯示食譜：物品資料不完整';
            return;
        }
        
        // 首先檢查緩存
        let recipes = getCachedRecipesByOutput(item.item_id);
        let recipeInfo = recipes.length > 0 ? recipes[0] : null;
        
        // 如果緩存中沒有，嘗試從全局 allRecipes 中查找
        if (!recipeInfo && allRecipes.length > 0) {
            const foundRecipe = allRecipes.find(r => {
                const recipeOutputId = r.output_item_id ? r.output_item_id.toString() : '';
                const itemId = item.item_id ? item.item_id.toString() : '';
                return recipeOutputId === itemId;
            });
            
            if (foundRecipe) {
                recipeInfo = foundRecipe;
                cacheRecipe(recipeInfo);
            }
        }
        
        // 如果仍然沒有找到，嘗試從API獲取
        if (!recipeInfo) {
            try {
                const recipes = await findPossibleRecipes(item);
                if (recipes && recipes.length > 0) {
                    recipeInfo = recipes[0];
                } else {
                    tooltip.querySelector('.recipe-tooltip-content').innerHTML = `
                        <div class="text-warning">未找到食譜</div>
                        <div>無法獲取 ${item.item_name} 的配方資訊</div>
                    `;
                    return;
                }
            } catch (error) {
                console.error(`獲取 ${item.item_id} 的食譜失敗:`, error);
                tooltip.querySelector('.recipe-tooltip-content').innerHTML = `
                    <div class="text-danger">載入失敗</div>
                    <div>無法獲取食譜: ${error.message}</div>
                `;
                return;
            }
        }
        
        // 從食譜中獲取原料信息
        const requirements = recipeInfo.requirements || [];
        
        // 處理食材數量 - 合併相同食材並計算數量
        const ingredientCounts = {};
        requirements.forEach(req => {
            const itemId = req.item_id;
            if (!ingredientCounts[itemId]) {
                ingredientCounts[itemId] = {
                    count: 0,
                    item: null
                };
            }
            ingredientCounts[itemId].count += req.quantity || 1; // 如果沒有指定數量，默認為1
        });
        
        // 獲取每種食材的詳細信息
        const inputItemsPromises = Object.keys(ingredientCounts).map(async itemId => {
            const inputItem = currentItems.find(i => i.item_id === itemId);
            const item = inputItem || { item_name: itemId, ascii_symbol: '?', item_tier: 0 };
            return {
                ...item,
                quantity: ingredientCounts[itemId].count
            };
        });
        
        const inputItems = await Promise.all(inputItemsPromises);
        
        // 烹飪方法映射
        const cookingMethodMap = {
            'grill': '烤製', 'pan_fry': '煎炒', 'deep_fry': '油炸',
            'boil': '水煮', 'assembly': '組合'
        };
        const methodText = cookingMethodMap[recipeInfo.cooking_method] || recipeInfo.cooking_method;
        
        // 生成提示內容
        let tooltipContent = `
            <h5>${item.item_name}</h5>
            <div class="recipe-method">
                烹飪方法: <span class="recipe-method-tag">${methodText}</span>
            </div>
            <div class="recipe-ingredients">
        `;
        
        // 添加原料列表，顯示數量
        inputItems.forEach(inputItem => {
            const quantityText = inputItem.quantity > 1 ? ` × ${inputItem.quantity}` : '';
            tooltipContent += `
                <div class="recipe-ingredient">
                    <span class="recipe-ingredient-icon">${inputItem.ascii_symbol}</span>
                    <span>${inputItem.item_name}${quantityText}</span>
                </div>
            `;
        });
        
        tooltipContent += '</div>';
        
        // 如果是T2料理，嘗試查找T1原料的合成路徑
        if (item.item_tier === 2) {
            let t1Info = '';
            
            for (const inputItem of inputItems) {
                if (inputItem.item_tier === 1) {
                    // 首先檢查緩存
                    let t1Recipes = getCachedRecipesByOutput(inputItem.item_id);
                    let t1Recipe = t1Recipes.length > 0 ? t1Recipes[0] : null;
                    
                    // 如果緩存中沒有，嘗試從全局 allRecipes 中查找
                    if (!t1Recipe && allRecipes.length > 0) {
                        const foundT1Recipe = allRecipes.find(r => {
                            const recipeOutputId = r.output_item_id ? r.output_item_id.toString() : '';
                            const itemId = inputItem.item_id ? inputItem.item_id.toString() : '';
                            return recipeOutputId === itemId;
                        });
                        
                        if (foundT1Recipe) {
                            t1Recipe = foundT1Recipe;
                            cacheRecipe(t1Recipe);
                        }
                    }
                    
                    // 如果全局中也沒有，嘗試查找可能的配方
                    if (!t1Recipe) {
                        try {
                            const t1Recipes = await findPossibleRecipes(inputItem);
                            if (t1Recipes && t1Recipes.length > 0) {
                                t1Recipe = t1Recipes[0];
                            }
                        } catch (error) {
                            console.error('查找T1配方失敗:', error);
                        }
                    }
                    
                    if (t1Recipe) {
                        const t1Requirements = t1Recipe.requirements || [];
                        
                        // 處理T1食材的數量
                        const t1IngredientCounts = {};
                        t1Requirements.forEach(req => {
                            const itemId = req.item_id;
                            if (!t1IngredientCounts[itemId]) {
                                t1IngredientCounts[itemId] = {
                                    count: 0,
                                    item: null
                                };
                            }
                            t1IngredientCounts[itemId].count += req.quantity || 1;
                        });
                        
                        // 獲取T1食材的詳細信息
                        const t1InputsPromises = Object.keys(t1IngredientCounts).map(async itemId => {
                            const t1InputItem = currentItems.find(i => i.item_id === itemId);
                            const item = t1InputItem || { item_name: itemId, ascii_symbol: '?', item_tier: 0 };
                            return {
                                ...item,
                                quantity: t1IngredientCounts[itemId].count
                            };
                        });
                        
                        const t1Inputs = await Promise.all(t1InputsPromises);

                        const t1MethodText = cookingMethodMap[t1Recipe.cooking_method] || t1Recipe.cooking_method;
                        
                        // 顯示T1食材的數量
                        const quantityText = inputItem.quantity > 1 ? ` × ${inputItem.quantity}` : '';
                        
                        t1Info += `
                            <div class="recipe-t1-info">
                                <div class="recipe-ingredient">
                                    <span class="recipe-ingredient-icon">${inputItem.ascii_symbol}</span>
                                    <span>${inputItem.item_name}${quantityText}</span>
                                    <span class="recipe-method-tag">${t1MethodText}</span>
                                </div>
                                <div class="recipe-t1-ingredients">
                        `;
                        
                        t1Inputs.forEach(t1Input => {
                            const t1QuantityText = t1Input.quantity > 1 ? ` × ${t1Input.quantity}` : '';
                            t1Info += `
                                <div class="recipe-ingredient" style="margin-left: 20px;">
                                    <span class="recipe-ingredient-icon">${t1Input.ascii_symbol}</span>
                                    <span>${t1Input.item_name}${t1QuantityText}</span>
                                </div>
                            `;
                        });
                        
                        t1Info += '</div></div>';
                    }
                }
            }
            
            if (t1Info) {
                tooltipContent += `
                    <hr style="margin: 10px 0;">
                    <div class="recipe-t1-section">
                        <h6>半成品製作方法:</h6>
                        ${t1Info}
                    </div>
                `;
            }
        }
        
        // 更新提示框內容
        tooltip.querySelector('.recipe-tooltip-content').innerHTML = tooltipContent;
        
    } catch (error) {
        console.error('載入配方數據失敗:', error);
        tooltip.querySelector('.recipe-tooltip-content').innerHTML = `
            <div class="text-danger">錯誤</div>
            <div>載入失敗: ${error.message}</div>
        `;
    }
}
 
// 修改: 查找可能的食譜配方
async function findPossibleRecipes(item) {
    if (!item || !item.item_id) {
        return [];
    }

    // 檢查是否有快取
    const cachedRecipes = getCachedRecipesByOutput(item.item_id);
    if (cachedRecipes.length > 0) {
        console.log(`在快取中找到 ${item.item_id} 的配方`);
        return cachedRecipes;
    }

    // 嘗試在 allRecipes 中查找
    const recipesFromAll = allRecipes.filter(recipe => recipe.output_item_id == item.item_id);
    if (recipesFromAll.length > 0) {
        console.log(`在全局變數 allRecipes 中找到 ${item.item_id} 的配方`);
        recipesFromAll.forEach(recipe => cacheRecipe(recipe));
        return recipesFromAll;
    }

    // 如果快取和全局變數中都沒有，則從 API 獲取
    console.log(`嘗試從API獲取 ${item.item_id} 的配方`);
    const response = await apiFetch('/v3/recipes-by-output', {
        method: 'POST',
        body: { outputItemId: item.item_id }
    });

    if (response.success && response.recipes && response.recipes.length > 0) {
        console.log(`API返回了 ${response.recipes.length} 個配方`);
        response.recipes.forEach(recipe => {
            cacheRecipe(recipe);
        });
        return response.recipes;
    }

    console.log(`未能從任何來源找到 ${item.item_id} 的配方。`);
    return [];
}
 
// 新增: 隱藏組合提示
function hideRecipeTooltip(tooltip) {
    // 這個函數現在不再需要，我們使用CSS懸停效果
    // 保留此函數是為了避免代碼中的引用出錯
    console.log('使用新的提示框樣式，此函數已不再使用');
}

// 新增: 緩存配方信息
function cacheRecipe(recipe) {
    if (!recipe || !recipe.output_item_id) return;
    
    const id = recipe.output_item_id.toString();

    // 如果此物品的快取尚不存在，則初始化為一個空陣列
    if (!recipeCache[id]) {
        recipeCache[id] = [];
    }
    
    // 檢查是否已存在相同的配方（避免重複添加）
    if (!recipeCache[id].some(r => r.id === recipe.id)) {
        recipeCache[id].push(recipe);
    }
}
 
// 新增: 從緩存中獲取配方列表
function getCachedRecipesByOutput(outputItemId) {
    const id = outputItemId.toString();
    return recipeCache[id] || [];
}