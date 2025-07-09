// 使用 Vue 3 的 CDN 版本
const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

// 遊戲狀態管理
const gameStore = {
    state: reactive({
        // 寵物狀態
        pet: {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            targetX: null,
            targetY: null,
            state: 'wandering', // wandering, goingToA, goingToB, goingToC, carrying
            carryingItem: null,
            speed: 3,
            lastWanderTime: 0,
            wanderInterval: 3000, // 3秒改變一次閒逛方向
        },
        
        // 區域位置
        zones: {
            a: { x: window.innerWidth * 0.1, y: window.innerHeight * 0.2, label: 'Ⓐ' },
            b: { x: window.innerWidth * 0.9, y: window.innerHeight * 0.2, label: 'Ⓑ' },
            c: { x: window.innerWidth * 0.1, y: window.innerHeight * 0.8, label: 'Ⓒ' }
        },
        
        // 物品管理
        items: [],
        nextItemId: 1,
        
        // 選單狀態
        itemMenu: {
            visible: false,
            x: 0,
            y: 0,
            sourceZone: null
        },
        
        // B區網格
        grid: {
            cells: [],
            cellSize: 40,
            rows: 5,
            cols: 5
        },
        
        // 遊戲狀態
        gameTime: 0,
        isRunning: true,
        lastFrameTime: 0
    }),
    
    // 初始化遊戲
    init() {
        // 初始化B區網格
        this.initGrid();
        
        // 開始遊戲循環
        requestAnimationFrame(this.gameLoop.bind(this));
    },
    
    // 初始化B區網格
    initGrid() {
        const { grid, zones } = this.state;
        grid.cells = [];
        
        // 計算網格的左上角位置
        const gridLeft = zones.b.x - (grid.cellSize * grid.cols / 2);
        const gridTop = zones.b.y - (grid.cellSize * grid.rows / 2) + 40; // 向下偏移一些
        
        // 創建網格單元格
        for (let row = 0; row < grid.rows; row++) {
            for (let col = 0; col < grid.cols; col++) {
                grid.cells.push({
                    row,
                    col,
                    x: gridLeft + col * grid.cellSize,
                    y: gridTop + row * grid.cellSize,
                    occupied: false,
                    itemId: null
                });
            }
        }
    },
    
    // 遊戲主循環
    gameLoop(timestamp) {
        if (!this.state.isRunning) return;
        
        // 計算時間增量
        const deltaTime = this.state.lastFrameTime ? (timestamp - this.state.lastFrameTime) / 1000 : 0;
        this.state.lastFrameTime = timestamp;
        this.state.gameTime += deltaTime;
        
        // 更新寵物位置和狀態
        this.updatePet(deltaTime);
        
        // 繼續循環
        requestAnimationFrame(this.gameLoop.bind(this));
    },
    
    // 更新寵物位置和狀態
    updatePet(deltaTime) {
        const { pet, zones, gameTime } = this.state;
        
        // 根據當前狀態更新寵物行為
        switch (pet.state) {
            case 'wandering':
                // 閒逛狀態 - 隨機移動或找任務
                if (gameTime - pet.lastWanderTime > pet.wanderInterval / 1000) {
                    // 時間到了，改變方向或尋找任務
                    pet.lastWanderTime = gameTime;
                    
                    // 有10%的機會尋找任務
                    if (Math.random() < 0.1) {
                        this.findNextTask();
                    } else {
                        // 隨機設定一個新的目標點
                        pet.targetX = Math.random() * window.innerWidth * 0.8 + window.innerWidth * 0.1;
                        pet.targetY = Math.random() * window.innerHeight * 0.8 + window.innerHeight * 0.1;
                    }
                }
                
                // 移動寵物
                this.movePetToTarget(deltaTime);
                break;
                
            case 'goingToA':
                // 前往A區
                pet.targetX = zones.a.x;
                pet.targetY = zones.a.y;
                this.movePetToTarget(deltaTime);
                
                // 檢查是否到達
                if (this.hasReachedTarget()) {
                    // 到達A區，顯示物品選單
                    this.openItemMenu('a');
                }
                break;
                
            case 'goingToC':
                // 前往C區
                pet.targetX = zones.c.x;
                pet.targetY = zones.c.y;
                this.movePetToTarget(deltaTime);
                
                // 檢查是否到達
                if (this.hasReachedTarget()) {
                    // 到達C區，顯示物品選單
                    this.openItemMenu('c');
                }
                break;
                
            case 'carrying':
                // 攜帶物品前往B區
                pet.targetX = zones.b.x;
                pet.targetY = zones.b.y;
                this.movePetToTarget(deltaTime);
                
                // 檢查是否到達
                if (this.hasReachedTarget()) {
                    // 到達B區，放下物品
                    this.placeItemInGrid();
                }
                break;
        }
        
        // 如果寵物攜帶物品，更新物品位置
        if (pet.carryingItem !== null) {
            const item = this.state.items.find(i => i.id === pet.carryingItem);
            if (item) {
                item.x = pet.x;
                item.y = pet.y - 30; // 物品顯示在寵物上方
            }
        }
    },
    
    // 移動寵物到目標位置
    movePetToTarget(deltaTime) {
        const { pet } = this.state;
        
        // 確保有目標位置
        if (pet.targetX === null || pet.targetY === null) return;
        
        // 計算方向向量
        const dx = pet.targetX - pet.x;
        const dy = pet.targetY - pet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 如果距離很小，直接到達目標
        if (distance < 1) {
            pet.x = pet.targetX;
            pet.y = pet.targetY;
            return;
        }
        
        // 根據物品類型調整速度
        let currentSpeed = pet.speed;
        if (pet.carryingItem !== null) {
            const item = this.state.items.find(i => i.id === pet.carryingItem);
            if (item) {
                // 不同物品有不同的減速效果
                switch (item.type) {
                    case '🎁': currentSpeed *= 0.8; break; // 禮物減速20%
                    case '🍖': currentSpeed *= 0.7; break; // 肉減速30%
                    case '🦴': currentSpeed *= 0.9; break; // 骨頭減速10%
                    case '🧸': currentSpeed *= 0.6; break; // 泰迪熊減速40%
                }
            }
        }
        
        // 應用緩動函數 - 慢-快-慢
        const progress = Math.min(distance / 100, 1); // 距離越遠，進度越接近1
        const easeInOutFactor = this.easeInOutSine(progress);
        currentSpeed *= easeInOutFactor * 2; // 調整速度曲線
        
        // 計算這一幀的移動距離
        const moveDistance = currentSpeed * deltaTime * 60; // 基於60fps標準化
        
        // 計算單位向量
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        // 更新位置
        pet.x += dirX * Math.min(moveDistance, distance);
        pet.y += dirY * Math.min(moveDistance, distance);
    },
    
    // 緩動函數：慢-快-慢
    easeInOutSine(x) {
        return -(Math.cos(Math.PI * x) - 1) / 2;
    },
    
    // 檢查是否到達目標
    hasReachedTarget() {
        const { pet } = this.state;
        if (pet.targetX === null || pet.targetY === null) return false;
        
        const dx = pet.targetX - pet.x;
        const dy = pet.targetY - pet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance < 5; // 5像素內視為到達
    },
    
    // 尋找下一個任務
    findNextTask() {
        const { pet, zones, items } = this.state;
        
        // 如果已經有任務，不再尋找
        if (pet.state !== 'wandering') return;
        
        // 檢查B區是否已滿
        if (this.isBZoneFull()) return;
        
        // 計算寵物到A區和C區的距離
        const distToA = Math.sqrt(
            Math.pow(pet.x - zones.a.x, 2) + 
            Math.pow(pet.y - zones.a.y, 2)
        );
        
        const distToC = Math.sqrt(
            Math.pow(pet.x - zones.c.x, 2) + 
            Math.pow(pet.y - zones.c.y, 2)
        );
        
        // 選擇較近的區域
        if (distToA <= distToC) {
            pet.state = 'goingToA';
        } else {
            pet.state = 'goingToC';
        }
    },
    
    // 檢查B區是否已滿
    isBZoneFull() {
        return this.state.grid.cells.every(cell => cell.occupied);
    },
    
    // 打開物品選單
    openItemMenu(zoneId) {
        const { zones, itemMenu } = this.state;
        const zone = zones[zoneId];
        
        itemMenu.visible = true;
        itemMenu.x = zone.x;
        itemMenu.y = zone.y;
        itemMenu.sourceZone = zoneId;
    },
    
    // 關閉物品選單
    closeItemMenu() {
        this.state.itemMenu.visible = false;
        
        // 如果寵物沒有拿到物品，回到閒逛狀態
        if (this.state.pet.carryingItem === null && 
            (this.state.pet.state === 'goingToA' || this.state.pet.state === 'goingToC')) {
            this.state.pet.state = 'wandering';
        }
    },
    
    // 選擇物品
    selectItem(itemType) {
        const { pet, itemMenu, nextItemId } = this.state;
        
        // 創建新物品
        const newItem = {
            id: nextItemId,
            type: itemType,
            x: pet.x,
            y: pet.y - 30, // 顯示在寵物上方
            placed: false
        };
        
        this.state.items.push(newItem);
        this.state.nextItemId++;
        
        // 寵物拿起物品
        pet.carryingItem = newItem.id;
        pet.state = 'carrying';
        
        // 關閉選單
        this.closeItemMenu();
    },
    
    // 在網格中放置物品
    placeItemInGrid() {
        const { pet, items, grid } = this.state;
        
        // 確保寵物正在攜帶物品
        if (pet.carryingItem === null) {
            pet.state = 'wandering';
            return;
        }
        
        // 找到物品
        const itemIndex = items.findIndex(i => i.id === pet.carryingItem);
        if (itemIndex === -1) {
            pet.carryingItem = null;
            pet.state = 'wandering';
            return;
        }
        
        // 尋找空閒的網格單元格
        const availableCell = grid.cells.find(cell => !cell.occupied);
        
        if (availableCell) {
            // 更新物品位置到網格中
            items[itemIndex].x = availableCell.x + grid.cellSize / 2;
            items[itemIndex].y = availableCell.y + grid.cellSize / 2;
            items[itemIndex].placed = true;
            
            // 標記網格已佔用
            availableCell.occupied = true;
            availableCell.itemId = items[itemIndex].id;
            
            // 寵物放下物品，回到閒逛狀態
            pet.carryingItem = null;
            pet.state = 'wandering';
        } else {
            // 網格已滿，保持攜帶狀態
            console.log("B區已滿，無法放置更多物品");
        }
    },
    
    // 點擊區域
    clickZone(zoneId) {
        const { pet } = this.state;
        
        switch (zoneId) {
            case 'a':
                if (pet.state === 'wandering') {
                    pet.state = 'goingToA';
                } else {
                    // 直接打開選單，不管當前狀態
                    this.openItemMenu('a');
                }
                break;
                
            case 'b':
                // B區是放置區，不需要特殊處理
                break;
                
            case 'c':
                if (pet.state === 'wandering') {
                    pet.state = 'goingToC';
                } else {
                    // 直接打開選單，不管當前狀態
                    this.openItemMenu('c');
                }
                break;
        }
    }
};

// 寵物元件
const PetCharacter = {
    props: ['pet'],
    template: `
        <div class="pet" :style="{ left: pet.x + 'px', top: pet.y + 'px', transform: 'translate(-50%, -50%)' }">
            🐶
        </div>
    `
};

// 區域元件
const Zone = {
    props: ['zone', 'id', 'label'],
    template: `
        <div class="zone" :class="'zone-' + id" 
             :style="{ left: zone.x + 'px', top: zone.y + 'px', transform: 'translate(-50%, -50%)' }"
             @click="$emit('click', $event)">
            {{ label }}
        </div>
    `
};

// 物品元件
const Item = {
    props: ['item'],
    template: `
        <div class="item" :style="{ left: item.x + 'px', top: item.y + 'px', transform: 'translate(-50%, -50%)' }">
            {{ item.type }}
        </div>
    `
};

// 物品選單元件
const ItemMenu = {
    props: ['menu'],
    template: `
        <div v-if="menu.visible" class="item-menu" 
             :style="{ left: menu.x + 'px', top: menu.y + 'px', transform: 'translate(-50%, -50%)' }">
            <div class="item-option" @click="selectItem('🎁')">🎁</div>
            <div class="item-option" @click="selectItem('🍖')">🍖</div>
            <div class="item-option" @click="selectItem('🦴')">🦴</div>
            <div class="item-option" @click="selectItem('🧸')">🧸</div>
        </div>
    `,
    methods: {
        selectItem(type) {
            gameStore.selectItem(type);
        }
    }
};

// 網格單元格元件
const GridCell = {
    props: ['cell'],
    template: `
        <div class="grid-cell" 
             :class="{ occupied: cell.occupied }"
             :style="{ left: cell.x + 'px', top: cell.y + 'px' }">
        </div>
    `
};

// 狀態顯示元件
const StatusDisplay = {
    props: ['pet', 'items'],
    computed: {
        statusText() {
            const { state, carryingItem } = this.pet;
            
            switch (state) {
                case 'wandering': 
                    return '狗狗正在閒逛';
                case 'goingToA': 
                    return '狗狗正在前往A區';
                case 'goingToB': 
                    return '狗狗正在前往B區';
                case 'goingToC': 
                    return '狗狗正在前往C區';
                case 'carrying':
                    const item = this.items.find(i => i.id === carryingItem);
                    return `狗狗正在攜帶${item ? item.type : '物品'}前往B區`;
                default:
                    return '狗狗狀態未知';
            }
        }
    },
    template: `
        <div class="status-display">
            {{ statusText }}
        </div>
    `
};

// 主應用元件
const App = {
    setup() {
        // 從遊戲狀態獲取響應式數據
        const pet = computed(() => gameStore.state.pet);
        const zones = computed(() => gameStore.state.zones);
        const items = computed(() => gameStore.state.items);
        const itemMenu = computed(() => gameStore.state.itemMenu);
        const gridCells = computed(() => gameStore.state.grid.cells);
        
        // 生命週期鉤子
        onMounted(() => {
            gameStore.init();
            
            // 添加點擊事件監聽器，用於關閉選單
            document.addEventListener('click', (event) => {
                // 檢查點擊是否在選單外部
                if (gameStore.state.itemMenu.visible) {
                    const menuEl = document.querySelector('.item-menu');
                    if (menuEl && !menuEl.contains(event.target) && 
                        !event.target.classList.contains('zone')) {
                        gameStore.closeItemMenu();
                    }
                }
            });
            
            // 監聽窗口大小變化
            window.addEventListener('resize', handleResize);
        });
        
        // 處理窗口大小變化
        const handleResize = () => {
            // 更新區域位置
            gameStore.state.zones.a.x = window.innerWidth * 0.1;
            gameStore.state.zones.a.y = window.innerHeight * 0.2;
            
            gameStore.state.zones.b.x = window.innerWidth * 0.9;
            gameStore.state.zones.b.y = window.innerHeight * 0.2;
            
            gameStore.state.zones.c.x = window.innerWidth * 0.1;
            gameStore.state.zones.c.y = window.innerHeight * 0.8;
            
            // 重新初始化網格
            gameStore.initGrid();
        };
        
        // 處理區域點擊
        const handleZoneClick = (zoneId, event) => {
            // 阻止事件冒泡，避免觸發文檔點擊事件
            if (event) {
                event.stopPropagation();
            }
            
            gameStore.clickZone(zoneId);
        };
        
        return {
            pet,
            zones,
            items,
            itemMenu,
            gridCells,
            handleZoneClick
        };
    },
    components: {
        PetCharacter,
        Zone,
        Item,
        ItemMenu,
        GridCell,
        StatusDisplay
    },
    template: `
        <div class="game-container">
            <!-- 寵物角色 -->
            <PetCharacter :pet="pet" />
            
            <!-- 區域 -->
            <Zone v-for="(zone, id) in zones" :key="id" 
                  :zone="zone" :id="id" :label="zone.label"
                  @click="handleZoneClick(id, $event)" />
            
            <!-- 物品 -->
            <Item v-for="item in items" :key="item.id" :item="item" />
            
            <!-- 物品選單 -->
            <ItemMenu :menu="itemMenu" />
            
            <!-- 網格單元格 -->
            <GridCell v-for="cell in gridCells" :key="cell.row + '-' + cell.col" :cell="cell" />
            
            <!-- 狀態顯示 -->
            <StatusDisplay :pet="pet" :items="items" />
        </div>
    `
};

// 創建並掛載 Vue 應用
const app = createApp(App);
app.mount('#pet-game');