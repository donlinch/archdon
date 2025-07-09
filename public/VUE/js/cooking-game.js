// cooking-game.js - 料理急先鋒 V3 完整版遊戲邏輯
import { rawIngredients, intermediateGoods, finalDishes, recipes } from './cooking-game-data.js';
import confetti from 'https://cdn.skypack.dev/canvas-confetti';

// 確保 Vue 和 ElementPlus 已經被全局載入
const { createApp, ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } = Vue;
const { ElMessage, ElNotification } = ElementPlus;

// 創建 Vue 應用
const app = createApp({
    template: `
        <div class="game-container" @mousemove="onGameAreaMouseMove" @click="onGameAreaClick">
            <!-- 跟隨滑鼠的物品圖示 -->
            <div v-if="heldItem" class="item-follower" :style="followerStyle">
                <div class="item-card" :class="'tier-' + heldItem.tier">
                    <div class="item-image">{{ heldItem.symbol }}</div>
                    <div class="item-name">{{ heldItem.name }}</div>
                </div>
            </div>

            <!-- 遊戲結束遮罩 -->
            <div v-if="isGameOver" class="game-over-overlay">
                <div class="game-over-modal">
                    <h2>遊戲結束</h2>
                    <p>時間到！</p>
                    <el-button type="primary" size="large" @click="resetGame">重新開始</el-button>
                </div>
            </div>
            
            <!-- 烹飪動畫 -->
            <div v-if="showCookingAnimation" class="cooking-animation-overlay">
                <div class="cooking-animation">
                    <span v-if="cookingAnimationMethod === 'grill'" class="grill-animation">🔥</span>
                    <span v-if="cookingAnimationMethod === 'pan-fry'" class="pan-fry-animation">🍳</span>
                    <span v-if="cookingAnimationMethod === 'boil'" class="boil-animation">🍲</span>
                    <span v-if="cookingAnimationMethod === 'deep-fry'" class="deep-fry-animation">🍤</span>
                    <span v-if="cookingAnimationMethod === 'assembly'" class="assembly-animation">👨‍🍳</span>
                </div>
                <div class="cooking-text">正在{{ getMethodDisplayName(cookingAnimationMethod) }}...</div>
            </div>
            
            <!-- 成功訊息 -->
            <div v-if="showSuccessMessage" class="success-message">
                <div class="success-title">製作成功！</div>
                <div class="success-symbol">{{ successItem.symbol }}</div>
                <div>{{ successItem.name }}</div>
            </div>

            <!-- 食譜提示 -->
            <div v-if="showRecipeTooltip" class="recipe-tooltip" :style="{ top: recipeTooltipPosition.y + 'px', left: recipeTooltipPosition.x + 'px' }" ref="recipeTooltipRef">
                <div v-if="recipeTooltipContent">
                    <div class="recipe-title">
                        合成【{{ recipeTooltipContent.output.name }}】需要:
                    </div>
                    <div v-for="req in recipeTooltipContent.requirements" :key="req.itemId" class="recipe-ingredient">
                        <span class="recipe-symbol">{{ findItemById(req.itemId)?.symbol }}</span>
                        <span>{{ findItemById(req.itemId)?.name }} x {{ req.quantity }}</span>
                    </div>
                    <div class="recipe-method">
                        方法: {{ getMethodDisplayName(recipeTooltipContent.method) }}
                    </div>
                </div>
            </div>

            <!-- 頂部資訊欄 -->
            <div class="game-header">
                <div class="game-title">料理急先鋒</div>
                <div class="game-timer">遊戲時間: {{ formatTime(gameTimeRemaining) }}</div>
            </div>
            
            <!-- 主要遊戲區域 -->
            <div class="game-main">
                <!-- 目標料理區域 -->
                <div class="target-dish-section">
                    <!-- 目標 1 -->
                    <div class="target-container" ref="targetDish1Ref">
                         <div v-if="targetDish1" class="target-dish" @mouseover="showRecipeInfo($event, targetDish1)" @mouseleave="hideRecipeInfo">
                            <div class="item-card large-item" :class="'tier-' + targetDish1.tier">
                                <div class="item-image">{{ targetDish1.symbol }}</div>
                                <div class="item-name">{{ targetDish1.name }}</div>
                            </div>
                            <div class="timer-bar-container" :data-percentage="timerStatus1">
                                <div class="timer-bar" :style="{ width: timerPercentage1 + '%' }"></div>
                                <div class="timer-text">{{ formatTime(timeRemaining1) }}</div>
                            </div>
                        </div>
                        <div class="target-slots">
                            <div v-for="(_, index) in targetSlots1" :key="'ts1-'+index" class="target-slot" @click="handleTargetClick('targetSlot1', index)">
                                <div v-if="targetSlots1[index]" class="item-card" :class="'tier-' + targetSlots1[index].tier" @click.stop="handleItemClick(targetSlots1[index], { from: 'targetSlot1', index })" @mouseover="showRecipeInfo($event, targetSlots1[index])" @mouseleave="hideRecipeInfo">
                                    <div class="item-image">{{ targetSlots1[index].symbol }}</div>
                                    <div class="item-name">{{ targetSlots1[index].name }}</div>
                                </div>
                                <div v-else class="empty-slot">
                                    <div class="slot-number">{{ index + 1 }}</div>
                                </div>
                            </div>
                        </div>
                        <div class="assembly-btn-container">
                            <button class="assembly-btn" @click="assembleTargetSlots1">
                                <span class="method-icon">🍽️</span>
                            </button>
                        </div>
                    </div>
                    <!-- 目標 2 -->
                    <div class="target-container" ref="targetDish2Ref">
                         <div v-if="targetDish2" class="target-dish" @mouseover="showRecipeInfo($event, targetDish2)" @mouseleave="hideRecipeInfo">
                            <div class="item-card large-item" :class="'tier-' + targetDish2.tier">
                                <div class="item-image">{{ targetDish2.symbol }}</div>
                                <div class="item-name">{{ targetDish2.name }}</div>
                            </div>
                            <div class="timer-bar-container" :data-percentage="timerStatus2">
                                <div class="timer-bar" :style="{ width: timerPercentage2 + '%' }"></div>
                                <div class="timer-text">{{ formatTime(timeRemaining2) }}</div>
                            </div>
                        </div>
                        <div class="target-slots">
                            <div v-for="(_, index) in targetSlots2" :key="'ts2-'+index" class="target-slot" @click="handleTargetClick('targetSlot2', index)">
                                <div v-if="targetSlots2[index]" class="item-card" :class="'tier-' + targetSlots2[index].tier" @click.stop="handleItemClick(targetSlots2[index], { from: 'targetSlot2', index })" @mouseover="showRecipeInfo($event, targetSlots2[index])" @mouseleave="hideRecipeInfo">
                                    <div class="item-image">{{ targetSlots2[index].symbol }}</div>
                                    <div class="item-name">{{ targetSlots2[index].name }}</div>
                                </div>
                                <div v-else class="empty-slot">
                                    <div class="slot-number">{{ index + 1 }}</div>
                                </div>
                            </div>
                        </div>
                        <div class="assembly-btn-container">
                            <button class="assembly-btn" @click="assembleTargetSlots2">
                                <span class="method-icon">🍽️</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 下半部分 -->
                <div class="row">
                    <!-- 烹飪區 -->
                    <div class="cooking-section">
                        <!-- 烹飪方法 -->
                        <div class="cooking-methods-container">
                             <div class="methods-title">烹飪方法</div>
                             <div class="cooking-methods-slider">
                                <div v-for="method in ['grill', 'pan-fry', 'boil', 'deep-fry']" :key="method" 
                                     class="method-item" :class="{ active: selectedMethod === method }" @click="selectMethod(method)">
                                    <div class="method-icon">{{ getMethodEmoji(method) }}</div>
                                    <div class="method-name">{{ getMethodDisplayName(method) }}</div>
                                </div>
                            </div>
                        </div>
                        <!-- 烹飪站 -->
                        <div class="cooking-area">
                            <div class="cooking-title">
                                <span>烹飪站</span>
                                <el-button v-if="canCook" type="primary" size="small" @click="cook" class="cook-button">
                                    <span class="cook-button-icon">🍳</span> 開始烹飪
                                </el-button>
                            </div>
                            <div class="cooking-station" @click="handleTargetClick('cookingStation')">
                                <div v-if="!cookingStation.length" class="station-placeholder">點擊下方食材拿取</div>
                                <div v-for="(item, index) in cookingStation" :key="item.id" class="item-card" :class="'tier-' + item.tier" @click.stop="handleItemClick(item, { from: 'cookingStation', index })" @mouseover="showRecipeInfo($event, item)" @mouseleave="hideRecipeInfo">
                                    <div class="item-image">{{ item.symbol }}</div>
                                    <div class="item-name">{{ item.name }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                 <!-- 食材區 -->
                <div class="ingredients-section">
                    <div class="ingredients-area">
                        <div class="category-filters">
                            <button v-for="cat in categories" :key="cat.name" class="category-button" :class="{ active: activeCategory === cat.name }" @click="activeCategory = cat.name">
                                <span class="category-emoji">{{ cat.emoji }}</span>
                                {{ cat.name }}
                            </button>
                        </div>
                        <div class="ingredients-grid">
                            <div v-for="item in filteredRawIngredients" :key="item.id" class="item-card" :class="'tier-' + item.tier" @click.stop="handleItemClick(item, { from: 'ingredientsGrid' })" @mouseover="showRecipeInfo($event, item)" @mouseleave="hideRecipeInfo">
                                <div class="item-image">{{ item.symbol }}</div>
                                <div class="item-name">{{ item.name }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        // 遊戲數據
        const gameData = reactive({
            rawIngredients,
            intermediateGoods,
            finalDishes,
            recipes
        });

        // 遊戲狀態
        const activeCategory = ref('蔬菜'); // 當前選中的食材分類，預設為蔬菜
        const cookingStation = ref([]); // 烹飪站中的物品
        const selectedMethod = ref(''); // 選中的烹飪方法
        const isCooking = ref(false); // 是否正在烹飪
        const showCookingAnimation = ref(false); // 是否顯示烹飪動畫
        const cookingAnimationMethod = ref(''); // 烹飪動畫方法
        const showSuccessMessage = ref(false); // 是否顯示成功訊息
        const successItem = ref(null); // 成功製作的物品
        const showRecipeTooltip = ref(false); // 是否顯示食譜提示
        const recipeTooltipPosition = ref({ x: 0, y: 0 }); // 食譜提示位置
        const recipeTooltipContent = ref(null); // 食譜提示內容
        const recipeTooltipRef = ref(null); // 食譜提示 DOM 元素引用
        const targetDish1Ref = ref(null);
        const targetDish2Ref = ref(null);
        
        // 全局遊戲計時器
        const gameTimeTotal = 180; // 3分鐘
        const gameTimeRemaining = ref(gameTimeTotal);
        const isGameOver = ref(false);
        let gameTimerInterval = null;
        
        // 目標料理區域 1
        const targetDish1 = ref(null); // 隨機選擇的目標T2料理
        const targetSlots1 = ref(Array(4).fill(null)); // 目標料理的4個空格
        
        // 目標料理區域 2
        const targetDish2 = ref(null);
        const targetSlots2 = ref(Array(4).fill(null));
        
        // 計時器相關 1
        const timerDuration = 120; // 計時器持續時間（秒）
        const timeRemaining1 = ref(timerDuration); // 剩餘時間
        const timerPercentage1 = ref(100); // 計時條百分比
        const timerStatus1 = ref('high'); // 計時條狀態：high, medium, low, critical
        let timerInterval1 = null; // 計時器間隔

        // 計時器相關 2
        const timeRemaining2 = ref(timerDuration);
        const timerPercentage2 = ref(100);
        const timerStatus2 = ref('high');
        let timerInterval2 = null;
        
        // 計算屬性
        const filteredRawIngredients = computed(() => {
            if (activeCategory.value === '全部') {
                return gameData.rawIngredients;
            }
            return gameData.rawIngredients.filter(item => item.category === activeCategory.value);
        });

        const categories = computed(() => {
            // 只返回除了"全部"之外的分類，並為每個分類添加emoji
            const categoryEmojis = {
                '蔬菜': '🥬',
                '肉類': '🥩',
                '加工品': '🥫',
                '調味醬料': '🧂'
            };
            
            const uniqueCategories = [...new Set(gameData.rawIngredients.map(item => item.category))];
            return uniqueCategories.map(category => ({
                name: category,
                emoji: categoryEmojis[category] || '🍴'
            }));
        });

        const canCook = computed(() => {
            return cookingStation.value.length > 0 && selectedMethod.value && !isCooking.value;
        });

        // 所有物品（包括T0、T1和T2）
        const allItems = computed(() => {
            return [
                ...gameData.rawIngredients,
                ...gameData.intermediateGoods,
                ...gameData.finalDishes
            ];
        });

        // 根據ID查找物品
        const findItemById = (itemId) => {
            if (!itemId) return null;
            return allItems.value.find(item => item.id === itemId);
        };

        // 根據需求查找食譜
        const findRecipeByRequirements = (items, method) => {
            // 將烹飪站中的物品轉換為需求格式
            const stationItems = items.map(item => ({ itemId: item.id, quantity: 1 }));
            
            // 尋找匹配的食譜
            return gameData.recipes.find(recipe => {
                // 檢查烹飪方法是否匹配
                if (recipe.method !== method) return false;
                
                // 檢查需求數量是否匹配
                if (recipe.requirements.length !== stationItems.length) return false;
                
                // 檢查每個需求是否都能在烹飪站中找到
                return recipe.requirements.every(req => 
                    stationItems.some(item => item.itemId === req.itemId)
                );
            });
        };

        // 驗證食譜是否符合層級規則
        const validateRecipeTier = (recipe, items) => {
            // 獲取輸出物品
            const outputItem = findItemById(recipe.outputId);
            if (!outputItem) return false;
            
            // 檢查層級規則
            if (outputItem.tier === 1) {
                // T1食譜只能使用T0食材
                return items.every(item => item.tier === 0);
            } else if (outputItem.tier === 2) {
                // T2食譜可以使用T1半成品和/或T0食材，但必須使用assembly方法
                if (recipe.method !== 'assembly') return false;
                return items.every(item => item.tier === 0 || item.tier === 1);
            }
            
            return false;
        };

        // 拖拽處理函數 (現在已無用，可以刪除)
        /*
        const onDragStart = (event, item) => { ... };
        const onDragEnd = (event) => { ... };
        const onDragOver = (event) => { ... };
        const onDragLeave = (event) => { ... };
        const onDrop = (event, targetArea, slotIndex) => { ... };
        */

        // 從烹飪區移除物品 (現在由 handleItemClick 處理)
        /*
        const removeFromStation = (index) => {
            cookingStation.value.splice(index, 1);
        };
        */

        // 從目標空格移除物品 (現在由 handleItemClick 處理)
        /*
        const removeFromTargetSlot1 = (index) => { ... };
        const removeFromTargetSlot2 = (index) => { ... };
        */
        
        const getMethodDisplayName = (method) => {
            const names = {
                'grill': '烤',
                'pan-fry': '煎',
                'boil': '煮',
                'deep-fry': '炸',
                'assembly': '組合'
            };
            return names[method] || method;
        };

        const getMethodEmoji = (method) => {
            const emojis = {
                'grill': '🔥',
                'pan-fry': '🍳',
                'boil': '🍲',
                'deep-fry': '🍤'
            };
            return emojis[method] || '🍴';
        };


        const selectMethod = (method) => {
            selectedMethod.value = method;
            
            // 自動烹飪：選擇烹飪方法時，如果烹飪站已有食材，則自動開始烹飪
            if (cookingStation.value.length > 0 && !isCooking.value) {
                cook();
            }
        };

        // 選擇組合方法 1
        const selectAssemblyMethod1 = () => {
            selectedMethod.value = 'assembly';
            
            // 檢查目標空格是否有食材
            const filledSlots = targetSlots1.value.filter(slot => slot !== null);
            if (filledSlots.length > 0) {
                // 直接在目標料理區域進行組合
                assembleTargetSlots1();
            } else {
                ElMessage.warning('請先在目標空格1放入食材');
            }
        };
        
        // 在目標料理區域進行組合 1
        const assembleTargetSlots1 = () => {
            // 獲取目標空格中的所有食材
            const slotItems = targetSlots1.value.filter(item => item !== null);
            
            if (slotItems.length === 0) {
                ElMessage.warning('請先在目標空格1放入食材');
                return;
            }
            
            // 查找匹配的食譜
            const recipe = findRecipeByRequirements(slotItems, 'assembly');
            
            if (!recipe) {
                ElMessage.error('沒有找到匹配的食譜');
                return;
            }
            
            // 驗證食譜是否符合層級規則
            if (!validateRecipeTier(recipe, slotItems)) {
                ElMessage.error('食譜不符合層級規則');
                return;
            }
            
            // 開始烹飪動畫
            isCooking.value = true;
            showCookingAnimation.value = true;
            cookingAnimationMethod.value = 'assembly';
            
            // 模擬烹飪時間
            setTimeout(() => {
                // 尋找輸出物品
                const outputItem = findItemById(recipe.outputId);
                
                if (outputItem) {
                    // 顯示成功訊息
                    successItem.value = outputItem;
                    showSuccessMessage.value = true;
                    setTimeout(() => {
                        showSuccessMessage.value = false;
                    }, 2000);
                    
                    // 清空目標空格
                    targetSlots1.value = Array(4).fill(null);
                    
                    // 檢查是否與目標料理匹配
                    if (outputItem.id === targetDish1.value.id) {
                        triggerConfetti(targetDish1Ref.value);
                        // 如果匹配成功，選擇新的目標料理
                        ElMessage.success('恭喜！你成功製作了目標料理1！');
                        selectRandomTargetDish1();
                    } else {
                        ElMessage.info('你製作了一道料理，但不是目標料理1');
                    }
                    
                    // 不在烹飪站生成T2料理
                } else {
                    ElMessage.error('組合失敗，找不到對應的成品');
                }
                
                selectedMethod.value = '';
                isCooking.value = false;
                showCookingAnimation.value = false;
            }, 2000); // 2秒的組合時間
        };

        // 烹飪處理
        const cook = () => {
            // 如果是組合方法，不在烹飪站處理
            if (selectedMethod.value === 'assembly') {
                ElMessage.warning('組合方法只能在目標料理區域使用');
                selectedMethod.value = '';
                return;
            }
            
            if (cookingStation.value.length === 0) {
                ElMessage.warning('請先放入食材');
                return;
            }

            if (!selectedMethod.value) {
                ElMessage.warning('請選擇烹飪方法');
                return;
            }
            
            // 查找匹配的食譜
            const recipe = findRecipeByRequirements(cookingStation.value, selectedMethod.value);

            if (!recipe) {
                ElMessage.error('沒有找到匹配的食譜');
                return;
            }
            
            // 驗證食譜是否符合層級規則
            if (!validateRecipeTier(recipe, cookingStation.value)) {
                ElMessage.error('食譜不符合層級規則');
                return;
            }

            // 開始烹飪動畫
            isCooking.value = true;
            showCookingAnimation.value = true;
            cookingAnimationMethod.value = selectedMethod.value;
            
            // 模擬烹飪時間
            setTimeout(() => {
                // 尋找輸出物品
                const outputItem = findItemById(recipe.outputId);
                
                if (outputItem) {
                    // 顯示成功訊息
                    successItem.value = outputItem;
                    showSuccessMessage.value = true;
                    setTimeout(() => {
                        showSuccessMessage.value = false;
                    }, 2000);
                    
                    // 修改：直接在烹飪站生成新料理，不再放入目標空格
                    cookingStation.value = [outputItem];
                } else {
                    ElMessage.error('烹飪失敗，找不到對應的成品');
                    // 清空烹飪站
                    cookingStation.value = [];
                }
                
                selectedMethod.value = '';
                isCooking.value = false;
                showCookingAnimation.value = false;
            }, 2000); // 2秒的烹飪時間
        };

        // 顯示食譜提示
        const showRecipeInfo = (event, item) => {
            // 尋找使用此物品的食譜
            const relatedRecipes = gameData.recipes.filter(recipe => 
                recipe.requirements.some(req => req.itemId === item.id) ||
                recipe.outputId === item.id
            );
            
            if (relatedRecipes.length > 0) {
                recipeTooltipContent.value = {
                    item,
                    recipes: relatedRecipes
                };
                
                // 設置初始位置
                recipeTooltipPosition.value = {
                    x: event.clientX + 15,
                    y: event.clientY + 15
                };
                
                showRecipeTooltip.value = true;
            }
        };

        const hideRecipeInfo = () => {
            showRecipeTooltip.value = false;
        };

        // 監聽 tooltip 的顯示狀態，以便在 DOM 更新後調整位置
        watch(showRecipeTooltip, (newValue) => {
            if (newValue) {
                nextTick(() => {
                    if (recipeTooltipRef.value) {
                        const tooltipEl = recipeTooltipRef.value;
                        const { width, height } = tooltipEl.getBoundingClientRect();
                        const { innerWidth, innerHeight } = window;
                        
                        let newX = recipeTooltipPosition.value.x;
                        let newY = recipeTooltipPosition.value.y;

                        // 檢查右邊界
                        if (newX + width > innerWidth) {
                            newX = innerWidth - width - 15;
                        }
                        // 檢查下邊界
                        if (newY + height > innerHeight) {
                            newY = innerHeight - height - 15;
                        }
                        // 檢查左邊界 (雖然初始是在右邊，以防萬一)
                        if (newX < 0) {
                            newX = 15;
                        }
                        // 檢查上邊界
                        if (newY < 0) {
                            newY = 15;
                        }

                        recipeTooltipPosition.value = { x: newX, y: newY };
                    }
                });
            }
        });

        const stopGameTimer = () => {
            if (gameTimerInterval) {
                clearInterval(gameTimerInterval);
                gameTimerInterval = null;
            }
        };

        const startGameTimer = () => {
            stopGameTimer();
            gameTimeRemaining.value = gameTimeTotal;
            isGameOver.value = false;

            gameTimerInterval = setInterval(() => {
                if (gameTimeRemaining.value > 0) {
                    gameTimeRemaining.value--;
                } else {
                    stopGameTimer();
                    stopTimer1();
                    stopTimer2();
                    isGameOver.value = true;
                }
            }, 1000);
        };

        // 重置遊戲
        const resetGame = () => {
            cookingStation.value = [];
            selectedMethod.value = '';
            isCooking.value = false;
            showCookingAnimation.value = false;
            targetSlots1.value = Array(4).fill(null);
            targetSlots2.value = Array(4).fill(null);
            
            // 重新開始全局計時器
            startGameTimer();
            
            ElMessage.success('遊戲已重置');

            // 先同步選擇料理，避免畫面延遲
            selectRandomTargetDish1(false);
            selectRandomTargetDish2(false);

            // 延遲顯示通知
            showDishNotifications();
        };

        // 開始目標料理計時器 1
        const startTimer1 = () => {
            // 清除現有計時器
            if (timerInterval1) {
                clearInterval(timerInterval1);
            }
            
            // 重置計時器
            timeRemaining1.value = timerDuration;
            timerPercentage1.value = 100;
            timerStatus1.value = 'high';
            
            // 設置新計時器
            timerInterval1 = setInterval(() => {
                if (timeRemaining1.value > 0) {
                    timeRemaining1.value--;
                    timerPercentage1.value = (timeRemaining1.value / timerDuration) * 100;
                    
                    // 更新計時條狀態
                    if (timerPercentage1.value <= 10) {
                        timerStatus1.value = 'critical';
                    } else if (timerPercentage1.value <= 40) {
                        timerStatus1.value = 'low';
                    } else if (timerPercentage1.value <= 70) {
                        timerStatus1.value = 'medium';
                    } else {
                        timerStatus1.value = 'high';
                    }
                } else {
                    // 時間到
                    clearInterval(timerInterval1);
                    
                    // 顯示提示
                    ElMessage.warning('時間到！目標料理1已更換');
                    
                    // 清空目標空格
                    targetSlots1.value = Array(4).fill(null);
                    
                    // 選擇新的目標料理
                    selectRandomTargetDish1();
                }
            }, 1000);
        };
        
        // 停止計時器 1
        const stopTimer1 = () => {
            if (timerInterval1) {
                clearInterval(timerInterval1);
                timerInterval1 = null;
            }
        };

        // 開始目標料理計時器 2
        const startTimer2 = () => {
            if (timerInterval2) clearInterval(timerInterval2);
            timeRemaining2.value = timerDuration;
            timerPercentage2.value = 100;
            timerStatus2.value = 'high';
            
            timerInterval2 = setInterval(() => {
                if (timeRemaining2.value > 0) {
                    timeRemaining2.value--;
                    timerPercentage2.value = (timeRemaining2.value / timerDuration) * 100;
                    if (timerPercentage2.value <= 10) timerStatus2.value = 'critical';
                    else if (timerPercentage2.value <= 40) timerStatus2.value = 'low';
                    else if (timerPercentage2.value <= 70) timerStatus2.value = 'medium';
                    else timerStatus2.value = 'high';
                } else {
                    clearInterval(timerInterval2);
                    ElMessage.warning('時間到！目標料理2已更換');
                    targetSlots2.value = Array(4).fill(null);
                    selectRandomTargetDish2();
                }
            }, 1000);
        };

        // 停止計時器 2
        const stopTimer2 = () => {
            if (timerInterval2) {
                clearInterval(timerInterval2);
                timerInterval2 = null;
            }
        };

        // 在目標料理區域進行組合 2
        const assembleTargetSlots2 = () => {
            const slotItems = targetSlots2.value.filter(item => item !== null);
            if (slotItems.length === 0) {
                ElMessage.warning('請先在目標料理2的空格放入食材');
                return;
            }
            const recipe = findRecipeByRequirements(slotItems, 'assembly');
            if (!recipe) {
                ElMessage.error('沒有找到匹配的食譜');
                return;
            }
            if (!validateRecipeTier(recipe, slotItems)) {
                ElMessage.error('食譜不符合層級規則');
                return;
            }
            
            isCooking.value = true;
            showCookingAnimation.value = true;
            cookingAnimationMethod.value = 'assembly';
            
            setTimeout(() => {
                const outputItem = findItemById(recipe.outputId);
                if (outputItem) {
                    successItem.value = outputItem;
                    showSuccessMessage.value = true;
                    setTimeout(() => showSuccessMessage.value = false, 2000);
                    targetSlots2.value = Array(4).fill(null);
                    if (outputItem.id === targetDish2.value.id) {
                        triggerConfetti(targetDish2Ref.value);
                        ElMessage.success('恭喜！你成功製作了目標料理2！');
                        selectRandomTargetDish2();
                    } else {
                        ElMessage.info('你製作了一道料理，但不是目標料理2');
                    }
                } else {
                    ElMessage.error('組合失敗，找不到對應的成品');
                }
                selectedMethod.value = '';
                isCooking.value = false;
                showCookingAnimation.value = false;
            }, 2000);
        };

        const showDishNotifications = () => {
            setTimeout(() => {
                ElNotification({
                    title: '新目標料理 1',
                    message: `你的新目標料理是：${targetDish1.value.name}`,
                    type: 'info',
                    duration: 3000
                });
            }, 300);

            setTimeout(() => {
                ElNotification({
                    title: '新目標料理 2',
                    message: `你的新目標料理是：${targetDish2.value.name}`,
                    type: 'info',
                    duration: 3000
                });
            }, 600);
        }

        const triggerConfetti = (element) => {
            if (!element) return;
            const rect = element.getBoundingClientRect();
            const origin = {
                x: (rect.left + rect.width / 2) / window.innerWidth,
                y: (rect.top + rect.height / 2) / window.innerHeight
            };

            confetti({
                particleCount: 150,
                spread: 90,
                origin: origin,
                zIndex: 3000
            });
        };

        // 隨機選擇一個T2料理 1
        const selectRandomTargetDish1 = (showNotification = true) => {
            if (gameData.finalDishes && gameData.finalDishes.length > 0) {
                const availableDishes = gameData.finalDishes.filter(dish => 
                    (!targetDish1.value || dish.id !== targetDish1.value.id) && 
                    (!targetDish2.value || dish.id !== targetDish2.value.id)
                );
                
                const dishPool = availableDishes.length > 0 ? availableDishes : gameData.finalDishes;
                const randomIndex = Math.floor(Math.random() * dishPool.length);
                targetDish1.value = dishPool[randomIndex];
                targetSlots1.value = Array(4).fill(null);
                
                if (showNotification) {
                    ElNotification({
                        title: '新目標料理 1',
                        message: `你的新目標料理是：${targetDish1.value.name}`,
                        type: 'info',
                        duration: 3000
                    });
                }
                
                startTimer1();
            }
        };

        // 隨機選擇一個T2料理 2
        const selectRandomTargetDish2 = (showNotification = true) => {
            if (gameData.finalDishes && gameData.finalDishes.length > 0) {
                const availableDishes = gameData.finalDishes.filter(dish => 
                    (!targetDish2.value || dish.id !== targetDish2.value.id) &&
                    (!targetDish1.value || dish.id !== targetDish1.value.id)
                );
                
                const dishPool = availableDishes.length > 0 ? availableDishes : gameData.finalDishes;
                const randomIndex = Math.floor(Math.random() * dishPool.length);
                targetDish2.value = dishPool[randomIndex];
                targetSlots2.value = Array(4).fill(null);
                
                if (showNotification) {
                    ElNotification({
                        title: '新目標料理 2',
                        message: `你的新目標料理是：${targetDish2.value.name}`,
                        type: 'info',
                        duration: 3000
                    });
                }

                startTimer2();
            }
        };
        
        const formatTime = (seconds) => {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        };

        // 生命週期鉤子
        onMounted(() => {
            // 先同步選擇料理，避免畫面延遲
            selectRandomTargetDish1(false);
            selectRandomTargetDish2(false);
            startGameTimer();
            
            ElNotification({
                title: '歡迎',
                message: '歡迎來到料理急先鋒 V3 完整版！',
                type: 'success',
                duration: 3000
            });

            showDishNotifications();
        });

        onUnmounted(() => {
            stopTimer1();
            stopTimer2();
            stopGameTimer();
        });

        // 選擇組合方法 2
        const selectAssemblyMethod2 = () => {
            selectedMethod.value = 'assembly';
            
            // 檢查目標空格是否有食材
            const filledSlots = targetSlots2.value.filter(slot => slot !== null);
            if (filledSlots.length > 0) {
                // 直接在目標料理區域進行組合
                assembleTargetSlots2();
            } else {
                ElMessage.warning('請先在目標空格2放入食材');
            }
        };
        
        // 新增的狀態
        const heldItem = ref(null); // 當前手持的物品
        const heldItemSource = ref(null); // 手持物品的來源資訊
        const followerStyle = ref({ top: '-999px', left: '-999px' });

        const onGameAreaMouseMove = (event) => {
            if (heldItem.value) {
                followerStyle.value = {
                    transform: `translate(${event.clientX + 10}px, ${event.clientY}px)`
                };
            }
        };

        const handleItemClick = (item, source) => {
            if (heldItem.value) { // 如果手上有物品
                if (heldItem.value.id === item.id) { // 點擊的是同一個物品，則放下
                    heldItem.value = null;
                    heldItemSource.value = null;
                } else { // 點擊不同物品，則交換
                    // 為了簡化，目前不支持交換，先放下當前的
                    ElMessage.info('請先將手中的 ' + heldItem.value.name + ' 放置好');
                }
            } else { // 如果手上沒有物品，則拿起
                heldItem.value = item;
                heldItemSource.value = source;

                // 從源頭暫時移除 (視覺上)
                if (source.from === 'cookingStation') {
                    cookingStation.value.splice(source.index, 1);
                } else if (source.from === 'targetSlot1') {
                    targetSlots1.value[source.index] = null;
                } else if (source.from === 'targetSlot2') {
                    targetSlots2.value[source.index] = null;
                }
                // 食材區的物品不移除，因為它們是無限的
            }
        };

        const handleTargetClick = (targetArea, slotIndex = -1) => {
            if (!heldItem.value) return; // 手上沒東西，不處理

            // 放置邏輯
            if (targetArea === 'cookingStation') {
                if (cookingStation.value.length >= 4) {
                    ElMessage.warning('烹飪站已滿');
                    return;
                }
                if (cookingStation.value.some(i => i.id === heldItem.value.id)) {
                    ElMessage.warning('烹飪站已有相同物品');
                    return;
                }
                cookingStation.value.push(heldItem.value);
            } else if (targetArea === 'targetSlot1') {
                if (targetSlots1.value[slotIndex]) {
                    ElMessage.warning('該位置已有物品');
                    return;
                }
                targetSlots1.value[slotIndex] = heldItem.value;
            } else if (targetArea === 'targetSlot2') {
                 if (targetSlots2.value[slotIndex]) {
                    ElMessage.warning('該位置已有物品');
                    return;
                }
                targetSlots2.value[slotIndex] = heldItem.value;
            } else {
                // 無效放置區域
                return;
            }

            // 放置成功，清空手持物品
            heldItem.value = null;
            heldItemSource.value = null;
        };

        const onGameAreaClick = () => {
            if (heldItem.value) {
                 // 如果點擊背景，將物品放回原位
                if (heldItemSource.value) {
                    const { from, index } = heldItemSource.value;
                    if (from === 'cookingStation') {
                        cookingStation.value.splice(index, 0, heldItem.value);
                    } else if (from === 'targetSlot1') {
                        targetSlots1.value[index] = heldItem.value;
                    } else if (from === 'targetSlot2') {
                        targetSlots2.value[index] = heldItem.value;
                    }
                }
                heldItem.value = null;
                heldItemSource.value = null;
            }
        };

        return {
            // 返回所有需要在模板中使用的數據和方法
            // ...原有的返回...
            heldItem,
            followerStyle,
            onGameAreaMouseMove,
            handleItemClick,
            handleTargetClick,
            onGameAreaClick,
            getMethodDisplayName,
            getMethodEmoji,

            // 以下為原有需要返回的內容
            gameData,
            activeCategory,
            cookingStation,
            selectedMethod,
            isCooking,
            showCookingAnimation,
            cookingAnimationMethod,
            showSuccessMessage,
            successItem,
            showRecipeTooltip,
            recipeTooltipPosition,
            recipeTooltipContent,
            recipeTooltipRef,
            targetDish1Ref,
            targetDish2Ref,
            gameTimeTotal,
            gameTimeRemaining,
            isGameOver,
            targetDish1,
            targetSlots1,
            targetDish2,
            targetSlots2,
            timeRemaining1,
            timerPercentage1,
            timerStatus1,
            timeRemaining2,
            timerPercentage2,
            timerStatus2,
            filteredRawIngredients,
            categories,
            canCook,
            findItemById,
            selectMethod,
            cook,
            showRecipeInfo,
            hideRecipeInfo,
            resetGame,
            assembleTargetSlots1,
            assembleTargetSlots2,
            formatTime
        };
    }
});

app.mount('#cooking-game');