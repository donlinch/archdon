// cooking-game.js - 料理急先鋒 V3 完整版遊戲邏輯
import { rawIngredients, intermediateGoods, finalDishes, recipes } from './cooking-game-data.js';
import confetti from 'https://cdn.skypack.dev/canvas-confetti';

// 確保 Vue 和 ElementPlus 已經被全局載入
const { createApp, ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } = Vue;
const { ElMessage, ElNotification } = ElementPlus;

// 創建 Vue 應用
const app = createApp({
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

        // 拖拽處理函數
        const onDragStart = (event, item) => {
            event.dataTransfer.setData('application/json', JSON.stringify(item));
            event.target.classList.add('dragging');
        };

        const onDragEnd = (event) => {
            event.target.classList.remove('dragging');
        };

        const onDragOver = (event) => {
            event.preventDefault();
            event.currentTarget.classList.add('dragover');
        };

        const onDragLeave = (event) => {
            event.currentTarget.classList.remove('dragover');
        };

        const onDrop = (event, targetArea, slotIndex) => {
            event.preventDefault();
            event.currentTarget.classList.remove('dragover');
            
            try {
                const itemData = JSON.parse(event.dataTransfer.getData('application/json'));
                
                if (targetArea === 'cookingStation') {
                    // 檢查烹飪站是否已滿
                    if (cookingStation.value.length >= 4) {
                        ElMessage.warning('烹飪站已滿，無法放入更多食材');
                        return;
                    }

                    // 檢查是否已有相同物品
                    if (cookingStation.value.some(item => item.id === itemData.id)) {
                        ElMessage.warning('已經放入相同的食材了');
                        return;
                    }
                    
                    // 如果是從目標空格1拖過來的，從目標空格移除
                    const targetIndex1 = targetSlots1.value.findIndex(item => item && item.id === itemData.id);
                    if (targetIndex1 !== -1) {
                        targetSlots1.value[targetIndex1] = null;
                    }

                    // 如果是從目標空格2拖過來的，從目標空格移除
                    const targetIndex2 = targetSlots2.value.findIndex(item => item && item.id === itemData.id);
                    if (targetIndex2 !== -1) {
                        targetSlots2.value[targetIndex2] = null;
                    }

                    cookingStation.value.push(itemData);
                } else if (targetArea === 'targetSlot1') {
                    // 檢查目標空格是否已有物品
                    if (targetSlots1.value[slotIndex]) {
                        ElMessage.warning('此空格已有物品');
                        return;
                    }
                    
                    // 如果是從烹飪站拖過來的，從烹飪站移除
                    const stationIndex = cookingStation.value.findIndex(item => item.id === itemData.id);
                    if (stationIndex !== -1) {
                        cookingStation.value.splice(stationIndex, 1);
                    }
                    
                    // 放入目標空格
                    targetSlots1.value[slotIndex] = itemData;
                } else if (targetArea === 'targetSlot2') {
                    // 檢查目標空格是否已有物品
                    if (targetSlots2.value[slotIndex]) {
                        ElMessage.warning('此空格已有物品');
                        return;
                    }
                    
                    // 如果是從烹飪站拖過來的，從烹飪站移除
                    const stationIndex = cookingStation.value.findIndex(item => item.id === itemData.id);
                    if (stationIndex !== -1) {
                        cookingStation.value.splice(stationIndex, 1);
                    }
                    
                    // 放入目標空格
                    targetSlots2.value[slotIndex] = itemData;
                }
            } catch (error) {
                console.error('拖放處理錯誤:', error);
            }
        };
        
        // 從烹飪區移除物品
        const removeFromStation = (index) => {
            cookingStation.value.splice(index, 1);
        };

        // 從目標空格移除物品 1
        const removeFromTargetSlot1 = (index) => {
            if (targetSlots1.value[index]) {
                // 將物品移到烹飪站
                if (cookingStation.value.length < 4) {
                    cookingStation.value.push(targetSlots1.value[index]);
                    targetSlots1.value[index] = null;
                } else {
                    ElMessage.warning('烹飪站已滿');
                }
            }
        };

        // 從目標空格移除物品 2
        const removeFromTargetSlot2 = (index) => {
            if (targetSlots2.value[index]) {
                // 將物品移到烹飪站
                if (cookingStation.value.length < 4) {
                    cookingStation.value.push(targetSlots2.value[index]);
                    targetSlots2.value[index] = null;
                } else {
                    ElMessage.warning('烹飪站已滿');
                }
            }
        };

        // 選擇烹飪方法
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
        
        return {
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
            filteredRawIngredients,
            categories,
            canCook,
            gameData,
            findItemById,
            onDragStart,
            onDragEnd,
            onDragOver,
            onDragLeave,
            onDrop,
            removeFromStation,
            removeFromTargetSlot1,
            removeFromTargetSlot2,
            selectMethod,
            selectAssemblyMethod1,
            assembleTargetSlots1,
            assembleTargetSlots2, // Added this
            cook,
            showRecipeInfo,
            hideRecipeInfo,
            resetGame,
            // Target 1 properties
            targetDish1,
            targetSlots1,
            timeRemaining1,
            timerPercentage1,
            timerStatus1,
            // Target 2 properties
            targetDish2,
            targetSlots2,
            timeRemaining2,
            timerPercentage2,
            timerStatus2,
            selectAssemblyMethod2,
            // Common
            formatTime,
            // Game Over
            isGameOver,
            gameTimeRemaining
        };
    },
    template: `
        <div class="game-container">
            <!-- 頂部導航 -->
            <header class="game-header">
                <div class="game-timer">遊戲時間: {{ formatTime(gameTimeRemaining) }}</div>
            </header>
            
            <!-- 遊戲主區域 -->
            <div class="game-main">
                <!-- 目標料理區域 - 移到最上方 -->
                <div class="row">
                    <div class="target-dish-section">
                       
                        <div class="target-container">
                            
                            <div class="target-dish" v-if="targetDish1" ref="targetDish1Ref">
                                <div class="item-card tier-2 large-item" @mouseover="showRecipeInfo($event, targetDish1)" @mouseleave="hideRecipeInfo">
                                   <div class="item-image">{{ targetDish1.symbol }}</div>
                                    <div class="item-name">{{ targetDish1.name }}</div>
                                    <span class="tier-badge">T2</span>
                                </div>
                                
                                <!-- 計時條 -->
                                <div class="timer-bar-container" 
                                     :class="{ 'critical': timerStatus1 === 'critical' }"
                                     :data-percentage="timerStatus1">
                                    <div class="timer-bar" :style="{ width: timerPercentage1 + '%' }"></div>
                                    <div class="timer-text">{{ formatTime(timeRemaining1) }}</div>
                                </div>
                            </div>
                            
                            <!-- 4個空格排成一排 -->
                            <div class="target-slots">
                          
                                <div 
                                    v-for="(slot, index) in targetSlots1" 
                                    :key="'t1-'+index"
                                    class="target-slot"
                                    @dragover="onDragOver"
                                    @dragleave="onDragLeave"
                                    @drop="(event) => onDrop(event, 'targetSlot1', index)"
                                >
                                    <div v-if="slot" 
                                        class="item-card" 
                                        :class="'tier-' + slot.tier"
                                        @click="removeFromTargetSlot1(index)"
                                        @mouseover="showRecipeInfo($event, slot)"
                                        @mouseleave="hideRecipeInfo"
                                        draggable="true"
                                        @dragstart="onDragStart($event, slot)"
                                        @dragend="onDragEnd"
                                    >
                                        <div class="item-image">{{ slot.symbol }}</div>
                                        <div class="item-name">{{ slot.name }}</div>
                                        <span class="tier-badge">T{{ slot.tier }}</span>
                                    </div>
                                    <div v-else class="empty-slot">
                                        <div class="slot-number">{{ index + 1 }}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 右側出餐按鈕 -->
                            <div class="assembly-btn-container">
                                <div 
                                    class="method-item assembly-btn" 
                                    @click="selectAssemblyMethod1"
                                >
                                    <div class="method-icon">🍽️</div>
                                    <div class="method-name">出餐</div>
                                </div>
                            </div>
                        </div>

                        <div class="target-container">
                            
                            <div class="target-dish" v-if="targetDish2" ref="targetDish2Ref">
                                <div class="item-card tier-2 large-item" @mouseover="showRecipeInfo($event, targetDish2)" @mouseleave="hideRecipeInfo">
                                   <div class="item-image">{{ targetDish2.symbol }}</div>
                                    <div class="item-name">{{ targetDish2.name }}</div>
                                    <span class="tier-badge">T2</span>
                                </div>
                                
                                <!-- 計時條 -->
                                <div class="timer-bar-container" 
                                     :class="{ 'critical': timerStatus2 === 'critical' }"
                                     :data-percentage="timerStatus2">
                                    <div class="timer-bar" :style="{ width: timerPercentage2 + '%' }"></div>
                                    <div class="timer-text">{{ formatTime(timeRemaining2) }}</div>
                                </div>
                            </div>
                            
                            <!-- 4個空格排成一排 -->
                            <div class="target-slots">
                          
                                <div 
                                    v-for="(slot, index) in targetSlots2" 
                                    :key="'t2-'+index"
                                    class="target-slot"
                                    @dragover="onDragOver"
                                    @dragleave="onDragLeave"
                                    @drop="(event) => onDrop(event, 'targetSlot2', index)"
                                >
                                    <div v-if="slot" 
                                        class="item-card" 
                                        :class="'tier-' + slot.tier"
                                        @click="removeFromTargetSlot2(index)"
                                        @mouseover="showRecipeInfo($event, slot)"
                                        @mouseleave="hideRecipeInfo"
                                        draggable="true"
                                        @dragstart="onDragStart($event, slot)"
                                        @dragend="onDragEnd"
                                    >
                                        <div class="item-image">{{ slot.symbol }}</div>
                                        <div class="item-name">{{ slot.name }}</div>
                                        <span class="tier-badge">T{{ slot.tier }}</span>
                                    </div>
                                    <div v-else class="empty-slot">
                                        <div class="slot-number">{{ index + 1 }}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 右側出餐按鈕 -->
                            <div class="assembly-btn-container">
                                <div 
                                    class="method-item assembly-btn"
                                    @click="selectAssemblyMethod2"
                                >
                                    <div class="method-icon">🍽️</div>
                                    <div class="method-name">出餐</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row">
                    <!-- 烹飪區域 -->
                    <div class="cooking-section">
                        <!-- 烹飪方法選擇 -->
                        <div class="cooking-methods-container">
                             <div class="cooking-methods-slider">
                                <div 
                                    class="method-item" 
                                    :class="{ active: selectedMethod === 'grill' }"
                                    @click="selectMethod('grill')"
                                >
                                    <div class="method-icon">🔥</div>
                                    <div class="method-name">烤製</div>
                                </div>
                                <div 
                                    class="method-item" 
                                    :class="{ active: selectedMethod === 'pan_fry' }"
                                    @click="selectMethod('pan_fry')"
                                >
                                    <div class="method-icon">🍳</div>
                                    <div class="method-name">煎炒</div>
                                </div>
                                <div 
                                    class="method-item" 
                                    :class="{ active: selectedMethod === 'deep_fry' }"
                                    @click="selectMethod('deep_fry')"
                                >
                                    <div class="method-icon">🍤</div>
                                    <div class="method-name">油炸</div>
                                </div>
                                <div 
                                    class="method-item" 
                                    :class="{ active: selectedMethod === 'boil' }"
                                    @click="selectMethod('boil')"
                                >
                                    <div class="method-icon">🥣</div>
                                    <div class="method-name">水煮</div>
                                </div>
                                <!-- 移除組合方法 -->
                            </div>
                        </div>
                        
                        <!-- 烹飪站 -->
                        <div class="cooking-area">
                            <h2 class="cooking-title">烹飪站</h2>
                            <!-- 移除烹飪方法指示器 -->
                            <div 
                                class="cooking-station"
                                :class="{ active: cookingStation.length > 0, cooking: isCooking }"
                                @dragover="onDragOver"
                                @dragleave="onDragLeave"
                                @drop="onDrop($event, 'cookingStation')"
                            >
                                <div v-if="cookingStation.length === 0" class="station-placeholder">
                                    拖拽食材到這裡
                                </div>
                                <div 
                                    v-for="(item, index) in cookingStation" 
                                    :key="index"
                                    class="item-card"
                                    :class="'tier-' + item.tier"
                                    @click="removeFromStation(index)"
                                    @mouseover="showRecipeInfo($event, item)"
                                    @mouseleave="hideRecipeInfo"
                                    draggable="true"
                                    @dragstart="onDragStart($event, item)"
                                    @dragend="onDragEnd"
                                >
                                    <div class="item-image">{{ item.symbol }}</div>
                                    <div class="item-name">{{ item.name }}</div>
                                    <span class="tier-badge">T{{ item.tier }}</span>
                                </div>
                            </div>
                            <!-- 移除手動烹飪按鈕 -->
                        </div>
                    </div>
                </div>
                
                <div class="row">
                    <!-- 食材區域 -->
                    <div class="ingredients-section">
                        <!-- 分類過濾按鈕 -->
                        <div class="category-filters">
                            <button 
                                v-for="category in categories" 
                                :key="category.name"
                                class="category-button"
                                :class="{ active: activeCategory === category.name }"
                                @click="activeCategory = category.name"
                            >
                                <span class="category-emoji">{{ category.emoji }}</span>
                                {{ category.name }}
                            </button>
                        </div>
                        
                        <!-- T0 基礎食材區 -->
                        <div class="ingredients-area">
                            <h2 class="area-title">基礎食材 (T0)</h2>
                            <div class="ingredients-grid">
                                <div 
                                    v-for="item in filteredRawIngredients" 
                                    :key="item.id"
                                    class="item-card tier-0"
                                    draggable="true"
                                    @dragstart="onDragStart($event, item)"
                                    @dragend="onDragEnd"
                                    @mouseover="showRecipeInfo($event, item)"
                                    @mouseleave="hideRecipeInfo"
                                >
                                    <div class="item-image">{{ item.symbol }}</div>
                                    <div class="item-name">{{ item.name }}</div>
                                    <span class="tier-badge">T0</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 移除 T1 半成品區 -->
                        
                        <!-- 移除 T2 最終料理區 -->
                    </div>
                    
                    <!-- 移除食譜參考部分 -->
                </div>
            </div>
            
            <!-- 烹飪動畫覆蓋層 -->
            <div v-if="showCookingAnimation" class="cooking-animation-overlay">
                <div class="cooking-animation">
                    <div v-if="cookingAnimationMethod === 'grill'" class="grill-animation">🔥</div>
                    <div v-else-if="cookingAnimationMethod === 'pan_fry'" class="pan-fry-animation">🍳</div>
                    <div v-else-if="cookingAnimationMethod === 'deep_fry'" class="deep-fry-animation">🍤</div>
                    <div v-else-if="cookingAnimationMethod === 'boil'" class="boil-animation">🥣</div>
                    <div v-else-if="cookingAnimationMethod === 'assembly'" class="assembly-animation">🔧</div>
                </div>
                <div class="cooking-text">
                    {{ cookingAnimationMethod === 'grill' ? '🔥 烤製中...' : 
                       cookingAnimationMethod === 'pan_fry' ? '🍳 煎炒中...' : 
                       cookingAnimationMethod === 'deep_fry' ? '🍤 油炸中...' : 
                       cookingAnimationMethod === 'boil' ? '🥣 水煮中...' : '🔧 組合中...' }}
                </div>
            </div>
            
            <!-- 成功訊息 -->
            <div v-if="showSuccessMessage && successItem" class="success-message">
                <div class="success-title">烹飪成功！</div>
                <div class="success-symbol">{{ successItem.symbol }}</div>
                <div>{{ successItem.name }}</div>
            </div>
            
            <!-- 食譜提示 -->
            <div 
                v-if="showRecipeTooltip"
                ref="recipeTooltipRef"
                class="recipe-tooltip"
                :style="{ left: recipeTooltipPosition.x + 'px', top: recipeTooltipPosition.y + 'px' }"
            >
                <h4>{{ recipeTooltipContent.item.name }}</h4>
                <h5>相關食譜:</h5>
                <ul>
                    <li v-for="recipe in recipeTooltipContent.recipes" :key="recipe.outputId">
                        <span v-if="recipe.outputId === recipeTooltipContent.item.id">
                           <strong></strong> {{ recipe.requirements.map(r => findItemById(r.itemId).name).join(' + ') }} ({{ recipe.method }})
                        </span>
                        <span v-else>
                            <strong></strong> {{ findItemById(recipe.outputId).name }}
                        </span>
                    </li>
                </ul>
            </div>
            
            <!-- 遊戲結束 Modal -->
            <div v-if="isGameOver" class="game-over-overlay">
                <div class="game-over-modal">
                    <h2>遊戲結束</h2>
                    <p>時間到！</p>
                    <el-button type="primary" size="large" @click="resetGame">重新開始</el-button>
                </div>
            </div>
        </div>
    `,
    methods: {
        findItemById(itemId) {
            if (!itemId) return null;
            const allItems = [
                ...this.gameData.rawIngredients,
                ...this.gameData.intermediateGoods,
                ...this.gameData.finalDishes
            ];
            return allItems.find(item => item.id === itemId);
        }
    }
});

// 掛載應用
app.use(ElementPlus);
app.mount('#cooking-game');