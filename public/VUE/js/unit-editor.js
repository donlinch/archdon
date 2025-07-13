new Vue({
    el: '#app',
    data: {
        imageUrl: '',
        previewImageUrl: '',
        scale: 2,
        mouseX: 0,
        mouseY: 0,
        isSelecting: false,
        hasSelection: false,
        selectionStart: { x: 0, y: 0 },
        selectionEnd: { x: 0, y: 0 },
        componentImageData: null,
        savedComponents: [],
        placedComponents: [], // For data model consistency with viewer and backend
        selectedComponentIndex: -1,
        // Component categorization
        componentCategory: '人物', // Default category
        componentName: '',
        componentSubcategory: '', // 新增：子分類欄位（選填）
        displayScale: 100, // 預設顯示比例為 100%
        categories: ['人物', '物品', '背景', 'UI界面', '特效'], // Available categories
        // Hardcoded settings
        anchorPoint: 'bottom-left',
        // Animation creation
        multiSelectionFrames: [],
        animationSpeed: 100,
        animationLoop: true,
        addedFrameCoordinates: [],
        // Component Editing
        isEditing: false,
        editingComponent: null,
        editingComponentIndex: -1,
        // Animation Playback
        animationStates: {},
        spritesheetCache: {}, // Replaces spritesheetImage
        mainLoopId: null,
        // Component Library Filtering
        activeCategoryFilter: 'all',
        copiedFeedback: {}, // 用於顯示複製成功的回饋
        isResizing: false,
    },
    computed: {
        selectionStyle() {
            const left = Math.min(this.selectionStart.x, this.selectionEnd.x) * this.scale;
            const top = Math.min(this.selectionStart.y, this.selectionEnd.y) * this.scale;
            const width = Math.abs(this.selectionEnd.x - this.selectionStart.x) * this.scale;
            const height = Math.abs(this.selectionEnd.y - this.selectionStart.y) * this.scale;
            
            return {
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`
            };
        },
        addedFrameStyles() {
            return this.addedFrameCoordinates.map(coords => {
                return {
                    left: `${coords.x * this.scale}px`,
                    top: `${coords.y * this.scale}px`,
                    width: `${coords.w * this.scale}px`,
                    height: `${coords.h * this.scale}px`,
                };
            });
        },
        selectionWidth() {
            return Math.abs(this.selectionEnd.x - this.selectionStart.x);
        },
        selectionHeight() {
            return Math.abs(this.selectionEnd.y - this.selectionStart.y);
        },
        categorizedComponents() {
            const grouped = {};
            this.savedComponents.forEach((component, index) => {
                const componentWithIndex = { ...component, originalIndex: index };
                const category = component.category || '物品';
                const name = component.name || '未命名';

                if (!grouped[category]) {
                    grouped[category] = {};
                }
                
                if (!grouped[category][name]) {
                    grouped[category][name] = [];
                }
                grouped[category][name].push(componentWithIndex);
            });
            return grouped;
        },
    },
    mounted() {
        // 從資料庫載入資料
        this.loadFromDatabase();
        
        // 監聽滑鼠移動以更新座標
        window.addEventListener('mousemove', this.updateMouseCoordinates);

        // Start the main animation loop
        this.mainAnimationLoop();
    },
    beforeDestroy() {
        window.removeEventListener('mousemove', this.updateMouseCoordinates);
        // Stop the main animation loop
        if (this.mainLoopId) {
            cancelAnimationFrame(this.mainLoopId);
        }
    },
    watch: {
        savedComponents: {
            handler(newComponents) {
                const activeAnimationIndexes = new Set();
                newComponents.forEach((component, index) => {
                    if (component.type === 'animation') {
                        activeAnimationIndexes.add(index);
                        // If it's a new animation, initialize its state
                        if (!this.animationStates[index]) {
                            this.$set(this.animationStates, index, {
                                currentFrame: 0,
                                lastTime: 0,
                            });
                        }
                    }
                });

                // Clean up states for deleted components
                Object.keys(this.animationStates).forEach(indexKey => {
                    if (!activeAnimationIndexes.has(parseInt(indexKey))) {
                        this.$delete(this.animationStates, indexKey);
                    }
                });
                
                // 保存操作改為由用戶點擊按鈕觸發，避免在每次數據變動時都向後端發送請求
                // this.saveToDatabase(); 
            },
            deep: true
        },
        scale() {
            // 介面縮放屬性為UI狀態，不儲存到資料庫
            // this.saveToLocalStorage();
            // 縮放變更時重新計算選擇區域
            this.$nextTick(() => {
                this.$forceUpdate();
            });
        },
    },
    methods: {
        // ===== 檔案類型檢測 =====
        detectFileType(url) {
            if (!url) return 'png'; // 預設為 png
            
            // 從 URL 中提取副檔名
            const extension = url.split('.').pop().toLowerCase();
            
            // 檢查是否為 GIF
            if (extension === 'gif') return 'gif';
            
            // 檢查是否為 JPG/JPEG
            if (['jpg', 'jpeg'].includes(extension)) return 'jpg';
            
            // 預設為 PNG
            return 'png';
        },
        
        // ===== Database & State Methods =====
        async loadFromDatabase() {
            try {
                const response = await fetch('/api/units/all');
                if (!response.ok) {
                    throw new Error(`伺服器錯誤: ${response.statusText}`);
                }
                const state = await response.json();
                
                // 在載入前重繪狀態
                this.rehydrateState(state).then(hydratedState => {
                    this.savedComponents = hydratedState.savedComponents || [];
                    this.placedComponents = hydratedState.placedComponents || [];
                    console.log('已成功從資料庫載入並重繪元件資料。');

                    // 如果舊的 spritesheet URL 存在，也載入它
                    if (localStorage.getItem('unitEditorImageUrl')) {
                        this.imageUrl = localStorage.getItem('unitEditorImageUrl');
                        this.previewImage();
                    }
                }).catch(error => {
                    console.error('Rehydration failed:', error);
                    alert(`元件資料重繪失敗: ${error.message}`);
                });

            } catch (error) {
                console.error('從資料庫載入資料失敗:', error);
                alert('從資料庫載入資料失敗，請檢查主控台訊息。');
            }
        },

        async saveToDatabase() {
            try {
                // Create a clean copy of the state to save
                const componentsToSave = this.savedComponents.map(component => {
                    // Create a clean copy without the imageData
                    const cleanComponent = { ...component };
                    delete cleanComponent.imageData;
                    return cleanComponent;
                });
                
                const stateToSave = {
                    savedComponents: componentsToSave,
                    placedComponents: this.placedComponents || [] // 編輯器中通常沒有放置的元件
                };

                const response = await fetch('/api/units/all', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(stateToSave),
                });

                if (!response.ok) {
                    throw new Error(`伺服器錯誤: ${response.statusText}`);
                }

                const result = await response.json();
                if (result.success) {
                    console.log('已成功儲存所有元件到資料庫。');
                    // 關鍵修復：儲存成功後，立即重新載入以獲取正確的 ID
                    await this.loadFromDatabase(); 
                } else {
                    throw new Error(result.error || '未知的儲存錯誤');
                }
            } catch (error) {
                console.error('儲存到資料庫失敗:', error);
                alert(`儲存到資料庫失敗: ${error.message}`);
                // 儲存失敗時，不要中斷程序，讓用戶可以繼續操作
                return false;
            }
            
            return true;
        },

        rehydrateState(state) {
            return new Promise((resolve, reject) => {
                if (!state.savedComponents || state.savedComponents.length === 0) {
                    return resolve(state);
                }

                const componentsByUrl = {};
                state.savedComponents.forEach(component => {
                    // 確保每個元件都有 fileType 欄位
                    if (!component.fileType) {
                        component.fileType = this.detectFileType(component.spritesheetUrl);
                    }
                    
                    const url = component.type === 'animation' 
                        ? component.animation?.spritesheetUrl 
                        : component.spritesheetUrl;
                    
                    if (url) {
                        if (!componentsByUrl[url]) {
                            componentsByUrl[url] = [];
                        }
                        componentsByUrl[url].push(component);
                    }
                });

                const promises = Object.keys(componentsByUrl).map(url => {
                    return new Promise((resolveSprite, rejectSprite) => {
                        // 檢查是否有 GIF 類型的元件
                        const gifComponents = componentsByUrl[url].filter(comp => 
                            comp.type === 'static' && comp.fileType === 'gif'
                        );
                        
                        // 如果這個 URL 只包含 GIF 元件，不需要重繪
                        if (gifComponents.length > 0 && gifComponents.length === componentsByUrl[url].length) {
                            resolveSprite();
                            return;
                        }
                        
                        // 處理非 GIF 元件
                        const spritesheet = new Image();
                        spritesheet.crossOrigin = 'Anonymous';
                        spritesheet.src = this.getSmartImageUrl(url);

                        spritesheet.onload = () => {
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            
                            componentsByUrl[url].forEach(component => {
                                // 只有靜態非 GIF 元件需要重繪 imageData
                                if (component.type === 'static' && component.fileType !== 'gif' && component.sourceRect) {
                                    const { x, y, w, h } = component.sourceRect;
                                    canvas.width = w;
                                    canvas.height = h;
                                    ctx.clearRect(0, 0, w, h);
                                    try {
                                        ctx.drawImage(spritesheet, x, y, w, h, 0, 0, w, h);
                                        component.imageData = canvas.toDataURL();
                                    } catch (e) {
                                        console.error(`Error rehydrating component for url ${url}:`, component, e);
                                    }
                                }
                            });
                            resolveSprite();
                        };

                        spritesheet.onerror = () => {
                            console.error(`無法載入 spritesheet: ${url}`);
                            resolveSprite(); 
                        };
                    });
                });

                Promise.all(promises).then(() => {
                    resolve(state);
                });
            });
        },
        
        // ===== Animation Playback Methods =====
        mainAnimationLoop(currentTime) {
            Object.keys(this.animationStates).forEach(indexKey => {
                const componentIndex = parseInt(indexKey);
                const component = this.savedComponents[componentIndex];
                const state = this.animationStates[indexKey];

                if (!component || component.type !== 'animation' || !state) return;

                const spritesheetUrl = component.animation.spritesheetUrl;
                if (!spritesheetUrl) return;

                // --- Image Caching Logic ---
                let sourceImage = this.spritesheetCache[spritesheetUrl];
                if (!sourceImage) {
                    // If image is not in cache, create and start loading it
                    const newImg = new Image();
                    newImg.crossOrigin = "Anonymous";
                    newImg.src = this.getSmartImageUrl(spritesheetUrl);
                    // Use Vue.$set to make the cache reactive
                    this.$set(this.spritesheetCache, spritesheetUrl, newImg);
                    return; // Skip drawing this frame
                }
                
                if (!sourceImage.complete || sourceImage.naturalHeight === 0) {
                    return; // Image is still loading, skip drawing
                }
                // --- End Caching Logic ---

                const speed = component.animation.speed || 100;

                if (currentTime - state.lastTime > speed) {
                    state.lastTime = currentTime;
                    
                    let nextFrame = state.currentFrame + 1;
                    if (nextFrame >= component.animation.frames.length) {
                        nextFrame = component.animation.loop ? 0 : state.currentFrame;
                    }
                    state.currentFrame = nextFrame;
                    
                    const frameInfo = component.animation.frames[state.currentFrame];
                    const canvasRef = this.$refs['anim-canvas-' + componentIndex];

                    if (canvasRef && canvasRef[0]) {
                        const canvas = canvasRef[0];
                        const ctx = canvas.getContext('2d');
                        
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        
                        try {
                            ctx.drawImage(
                                sourceImage, // Use the cached image
                                frameInfo.x, frameInfo.y, frameInfo.w, frameInfo.h, // Source rect
                                0, 0, canvas.width, canvas.height                  // Destination rect
                            );
                        } catch (e) {
                            console.error('Error drawing animation frame:', e);
                        }
                    }
                }
            });

            this.mainLoopId = requestAnimationFrame(this.mainAnimationLoop);
        },

        // ===== Image and Selection Methods =====
        getPreviewImageStyle() {
            return {
                transform: `scale(${this.scale})`,
                transformOrigin: 'top left'
            };
        },
        getSelectionAreaStyle() {
            if (!this.$refs.previewImage) return {};
            const width = this.$refs.previewImage.naturalWidth || 0;
            const height = this.$refs.previewImage.naturalHeight || 0;
            return {
                width: `${width * this.scale}px`,
                height: `${height * this.scale}px`
            };
        },
        getSmartImageUrl(url) {
            if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
                return url;
            }
             // Assume other URLs might need CORS proxy
            return `/proxy-image?url=${encodeURIComponent(url)}`;
        },
        previewImage() {
            if (!this.imageUrl) {
                alert('請先輸入圖片 URL');
                return;
            }
            this.previewImageUrl = this.getSmartImageUrl(this.imageUrl);
            // 將當前使用的 imageUrl 存到 localstorage，方便下次開啟時直接載入
            localStorage.setItem('unitEditorImageUrl', this.imageUrl);
        },
        handleImageError() {
            alert('圖片載入失敗，請檢查 URL 是否正確，或是否有 CORS 問題。');
            this.previewImageUrl = ''; // Clear the image on error
        },
        getAppState() {
            // 只儲存必要的狀態
            return {
                imageUrl: this.imageUrl,
                savedComponents: this.savedComponents,
                scale: this.scale,
            };
        },
        saveToLocalStorage() {
            try {
                const appState = this.getAppState();
                localStorage.setItem('unitEditorState', JSON.stringify(appState));
            } catch (error) {
                console.error("無法儲存到 Local Storage:", error);
            }
        },
        loadFromLocalStorage() {
            const savedState = localStorage.getItem('unitEditorState');
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    this.imageUrl = state.imageUrl || '';
                    this.savedComponents = state.savedComponents || [];
                    this.scale = state.scale || 1;
                    
                    if (this.imageUrl) {
                        this.previewImage();
                    }

                } catch (error) {
                    console.error("無法從 Local Storage 載入狀態:", error);
                    // If parsing fails, you might want to reset the state
                }
            }
        },
        updateMouseCoordinates(event) {
            if (this.$refs.previewImage) {
                const rect = this.$refs.selectionArea.getBoundingClientRect();
                const x = (event.clientX - rect.left) / this.scale;
                const y = (event.clientY - rect.top) / this.scale;
                
                this.mouseX = Math.round(x);
                this.mouseY = Math.round(y);
            }
        },
        initializeSelection() {
             this.clearSelection();
        },
        startSelection(event) {
            if (event.button !== 0) return; // Only react to left-click
            this.isSelecting = true;
            this.hasSelection = false;
            this.selectionStart.x = this.mouseX;
            this.selectionStart.y = this.mouseY;
            this.selectionEnd.x = this.mouseX;
            this.selectionEnd.y = this.mouseY;
            this.componentImageData = null;
        },
        updateSelection(event) {
            if (this.isSelecting) {
                this.selectionEnd.x = this.mouseX;
                this.selectionEnd.y = this.mouseY;
            }
        },
        endSelection(event) {
            if (!this.isSelecting) return;
            this.isSelecting = false;
            
            // Ensure selection has a size
            if (this.selectionWidth > 0 && this.selectionHeight > 0) {
                this.hasSelection = true;
                this.extractComponent();
            } else {
                this.hasSelection = false;
            }
        },
        clearSelection() {
            this.isSelecting = false;
            this.hasSelection = false;
            this.selectionStart = { x: 0, y: 0 };
            this.selectionEnd = { x: 0, y: 0 };
            this.componentImageData = null;
            this.addedFrameCoordinates = [];
            this.displayScale = 100; // 重置顯示比例為預設值
            // 不重置元件名稱，但重置子分類
            this.componentSubcategory = '';
        },
        extractComponent() {
            if (!this.hasSelection || !this.$refs.previewImage) return;
            
            const image = this.$refs.previewImage;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const sx = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const sy = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const sw = this.selectionWidth;
            const sh = this.selectionHeight;
            
            canvas.width = sw;
            canvas.height = sh;
            
            try {
                ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
                this.componentImageData = canvas.toDataURL();
                 // Update the component preview canvas immediately
                this.$nextTick(() => {
                    // 更新元件預覽畫布
                    if (this.$refs.componentCanvas) {
                        const previewCtx = this.$refs.componentCanvas.getContext('2d');
                        previewCtx.clearRect(0, 0, sw, sh);
                        const img = new Image();
                        img.onload = () => {
                            previewCtx.drawImage(img, 0, 0);
                        };
                        img.src = this.componentImageData;
                    }
                    
                    // 更新網格預覽
                    // 不需要額外的代碼，因為預覽組件會使用 getGridPreviewStyle 自動更新
                });
            } catch (e) {
                console.error("無法從 Canvas 提取圖片:", e);
                alert("圖片提取失敗。如果圖片來自其他網站，這可能是 CORS 安全限制。請嘗試將圖片下載後，透過本地伺服器或圖片上傳網站（如 imgur）來載入。");
                this.componentImageData = null;
            }
        },
        
        // ===== Component Creation and Management =====
        async saveComponent() {
            if (!this.componentImageData) return;
            
            // 檢測檔案類型
            const fileType = this.detectFileType(this.imageUrl);
            
            const newComponent = {
                name: this.componentName || '未命名',
                type: 'static',
                fileType: fileType, // 添加檔案類型欄位
                spritesheetUrl: this.imageUrl, // Save source URL
                width: Math.round(this.selectionWidth),
                height: Math.round(this.selectionHeight),
                category: this.componentCategory,
                subcategory: this.componentSubcategory || '', // 新增：子分類欄位
                scale: 1, // Default scale for components
                displayScale: this.displayScale || 100, // 顯示比例
                anchor: this.anchorPoint,
            };
            
            // 只有非 GIF 才需要提取 imageData 和 sourceRect
            if (fileType !== 'gif') {
                newComponent.imageData = this.componentImageData;
                newComponent.sourceRect = {
                    x: Math.round(Math.min(this.selectionStart.x, this.selectionEnd.x)),
                    y: Math.round(Math.min(this.selectionStart.y, this.selectionEnd.y)),
                    w: Math.round(this.selectionWidth),
                    h: Math.round(this.selectionHeight)
                };
            }
            
            this.savedComponents.push(newComponent);
            
            const success = await this.saveToDatabase();
            if (success) {
                this.clearSelection();
                // 只清空子分類，保留元件名稱
                this.componentSubcategory = '';
            }
        },
        addFrameToAnimation() {
            if (!this.componentImageData) return;
            
            this.multiSelectionFrames.push({
                imageData: this.componentImageData,
                sourceRect: {
                    x: Math.round(Math.min(this.selectionStart.x, this.selectionEnd.x)),
                    y: Math.round(Math.min(this.selectionStart.y, this.selectionEnd.y)),
                    w: Math.round(this.selectionWidth),
                    h: Math.round(this.selectionHeight)
                }
            });

            this.addedFrameCoordinates.push({
                x: Math.min(this.selectionStart.x, this.selectionEnd.x),
                y: Math.min(this.selectionStart.y, this.selectionEnd.y),
                w: this.selectionWidth,
                h: this.selectionHeight,
            });

            // Keep selection active to allow adding more frames from nearby areas
            this.hasSelection = false; 
            this.componentImageData = null;
        },
        async saveAnimationComponent() {
            if (this.multiSelectionFrames.length === 0) return;

            const firstFrame = this.multiSelectionFrames[0];
            
            const newAnimationComponent = {
                name: this.componentName || '未命名動畫',
                type: 'animation',
                category: this.componentCategory,
                subcategory: this.componentSubcategory || '', // 新增：子分類欄位
                width: Math.round(firstFrame.sourceRect.w),
                height: Math.round(firstFrame.sourceRect.h),
                scale: 1,
                displayScale: this.displayScale || 100, // 顯示比例
                anchor: this.anchorPoint,
                animation: {
                    spritesheetUrl: this.imageUrl, // Save source URL
                    frames: this.multiSelectionFrames.map(f => f.sourceRect),
                    speed: this.animationSpeed,
                    loop: this.animationLoop
                }
            };
            
            this.savedComponents.push(newAnimationComponent);

            const success = await this.saveToDatabase();
            if (success) {
                this.clearAnimationFrames();
                // 只清空子分類，保留元件名稱
                this.componentSubcategory = '';
            }
        },
        clearAnimationFrames() {
            this.multiSelectionFrames = [];
            this.addedFrameCoordinates = [];
            this.displayScale = 100; // 重置顯示比例為預設值
            // 不重置元件名稱，但重置子分類
            this.componentSubcategory = '';
        },
        selectComponent(index) {
            this.selectedComponentIndex = index;
        },
        deleteComponent(index) {
            if (confirm(`確定要刪除這個元件嗎？`)) {
                this.savedComponents.splice(index, 1);
                this.saveToDatabase().then(success => {
                    if (success && this.selectedComponentIndex === index) {
                        this.selectedComponentIndex = -1;
                    }
                });
            }
        },
        openEditModal(index) {
            this.editingComponentIndex = index;
            // Create a deep copy for editing to avoid modifying the original data directly
            this.editingComponent = JSON.parse(JSON.stringify(this.savedComponents[index]));
            this.isEditing = true;
        },
        saveComponentChanges() {
            if (this.editingComponent && this.editingComponentIndex !== -1) {
                // 保存原始元件的一些屬性
                const originalComponent = this.savedComponents[this.editingComponentIndex];
                const imageData = originalComponent.imageData;
                const fileType = originalComponent.fileType || this.detectFileType(originalComponent.spritesheetUrl);
                
                // 替換舊元件
                this.$set(this.savedComponents, this.editingComponentIndex, this.editingComponent);
                
                // 確保 fileType 欄位被保留
                if (!this.savedComponents[this.editingComponentIndex].fileType) {
                    this.savedComponents[this.editingComponentIndex].fileType = fileType;
                }
                
                // 根據檔案類型處理 imageData
                if (this.savedComponents[this.editingComponentIndex].type === 'static') {
                    if (fileType === 'gif') {
                        // GIF 不需要 imageData，但需要確保 spritesheetUrl 正確
                        delete this.savedComponents[this.editingComponentIndex].imageData;
                    } else if (imageData) {
                        // 非 GIF 靜態元件需要 imageData
                        this.savedComponents[this.editingComponentIndex].imageData = imageData;
                    }
                } 
                // 動畫元件處理
                else if (originalComponent.type === 'animation') {
                    // 確保動畫狀態被正確維護
                    const animState = this.animationStates[this.editingComponentIndex];
                    if (animState) {
                        this.$set(this.animationStates, this.editingComponentIndex, {
                            ...animState,
                            componentRef: this.savedComponents[this.editingComponentIndex]
                        });
                    }
                }
                
                this.saveToDatabase().then(success => {
                    if (success) {
                        this.closeEditModal();
                    }
                });
            }
        },
        closeEditModal() {
            this.isEditing = false;
            this.editingComponent = null;
            this.editingComponentIndex = -1;
        },
        
        getAnchorMarkerStyle() {
            if (!this.editingComponent) return {};
            const anchor = this.editingComponent.anchor || 'bottom-left';
            const [yAlign, xAlign] = anchor.split('-');

            let top = '50%', left = '50%';
            if (yAlign === 'top') top = '0%';
            if (yAlign === 'bottom') top = '100%';
            if (xAlign === 'left') left = '0%';
            if (xAlign === 'right') left = '100%';

            return { top, left };
        },

        // 網格預覽樣式
        getGridPreviewStyle() {
            if (!this.componentImageData) return {};

            const scale = (this.displayScale || 100) / 100;
            const componentWidth = this.selectionWidth * scale;
            const componentHeight = this.selectionHeight * scale;

            // Align the component's bottom-left corner to the grid's bottom-left cell's corner.
            return {
                backgroundImage: `url(${this.componentImageData})`,
                backgroundSize: '100% 100%', // Ensure the background image scales with the container
                width: `${componentWidth}px`,
                height: `${componentHeight}px`,
                left: '0px',
                // The grid container is 101px high (2*50px + 1px gap) inside a 110px preview area.
                // This leaves 9px of space at the bottom.
                bottom: '9px', 
            };
        },
        getCleanStateForExport() {
            // 從當前 Vue 實例的狀態創建一個深拷貝，以避免修改原始數據
            const exportState = JSON.parse(JSON.stringify({
                savedComponents: this.savedComponents,
                placedComponents: this.placedComponents || []
            }));

            // imageUrl 是編輯器特有的，匯出的資料中不需要
            delete exportState.imageUrl;

            // 輔助函式：移除代理URL前綴
            const cleanUrl = (url) => {
                const prefix = '/proxy-image?url=';
                if (typeof url === 'string' && url.startsWith(prefix)) {
                    try {
                        return decodeURIComponent(url.substring(prefix.length));
                    } catch (e) {
                        console.error('Failed to decode URL:', url, e);
                        return url;
                    }
                }
                return url;
            };

            // 清理元件中的URL，並移除 imageData 和資料庫 id
            if (exportState.savedComponents && Array.isArray(exportState.savedComponents)) {
                exportState.savedComponents.forEach(component => {
                    // imageData 是用於即時預覽的，不包含在匯出狀態中
                    delete component.imageData;
                    // 資料庫 ID 不是可攜式格式的一部分
                    delete component.id;

                    if (component.type === 'static' && component.spritesheetUrl) {
                        component.spritesheetUrl = cleanUrl(component.spritesheetUrl);
                    } else if (component.type === 'animation' && component.animation && component.animation.spritesheetUrl) {
                        component.animation.spritesheetUrl = cleanUrl(component.animation.spritesheetUrl);
                    }
                });
            }

            // 清理放置元件的即時狀態 (例如 isDragging)
            if (exportState.placedComponents && Array.isArray(exportState.placedComponents)) {
                exportState.placedComponents.forEach(pComponent => {
                    pComponent.isDragging = false;
                });
            }
            
            return exportState;
        },
        copyAllState() {
            const exportState = this.getCleanStateForExport();
            if (!exportState) {
                alert('沒有儲存的資料可以複製。');
                return;
            }
            try {
                const dataStr = JSON.stringify(exportState, null, 2);
                navigator.clipboard.writeText(dataStr).then(() => {
                    alert('已複製所有設定到剪貼簿！');
                }).catch(err => {
                    console.error('無法複製到剪貼簿:', err);
                    alert('複製失敗，詳情請見控制台。');
                });
            } catch (error) {
                console.error('複製失敗:', error);
                alert('複製失敗，請檢查主控台中的錯誤訊息。');
            }
        },

        exportToFile() {
            const exportState = this.getCleanStateForExport();
            if (!exportState) {
                alert('沒有儲存的資料可以匯出。');
                return;
            }

            try {
                const dataStr = JSON.stringify(exportState, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = 'unit-layout.json';
                document.body.appendChild(a);
                a.click();

                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('匯出檔案失敗:', error);
                alert('匯出檔案失敗，請檢查主控台中的錯誤訊息。');
            }
        },

        // ===== Component Actions =====
        setCategory(category) {
            this.componentCategory = category;
        },

        copyComponentData(index) {
            const component = this.savedComponents[index];
            if (!component) return;

            const exportComponent = { ...component };
            delete exportComponent.imageData;
            
            if (exportComponent.type === 'animation' && exportComponent.animation && exportComponent.animation.frames) {
                exportComponent.animation.frames.forEach(frame => delete frame.imageData);
            }

            const jsonString = JSON.stringify(exportComponent, null, 2);

            navigator.clipboard.writeText(jsonString).then(() => {
                this.$set(this.copiedFeedback, index, true);
                
                setTimeout(() => {
                    this.$set(this.copiedFeedback, index, false);
                }, 2000);

            }).catch(err => {
                console.error('無法複製元件:', err);
                alert('複製失敗，詳情請見控制台。');
            });
        },

        // ===== Pane Resizing Methods =====
        startResize(event) {
            event.preventDefault();
            this.isResizing = true;
            window.addEventListener('mousemove', this.resize);
            window.addEventListener('mouseup', this.stopResize);
        },
        resize(event) {
            if (!this.isResizing) return;
            const container = this.$el;
            const editorPane = container.querySelector('.editor-pane');
            const inspectorPane = container.querySelector('.inspector-pane');
            const minWidth = 300; // Minimum width for inspector

            const totalWidth = container.offsetWidth;
            const newInspectorWidth = totalWidth - event.clientX;
            
            if (newInspectorWidth > minWidth && event.clientX > 300) { 
                inspectorPane.style.width = newInspectorWidth + 'px';
            }
        },
        stopResize() {
            this.isResizing = false;
            window.removeEventListener('mousemove', this.resize);
            window.removeEventListener('mouseup', this.stopResize);
        }
    }
});
