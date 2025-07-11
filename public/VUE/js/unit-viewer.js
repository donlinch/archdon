new Vue({
    el: '#app',
    data: {
        savedComponents: [],
        placedComponents: [],
        categories: ['人物', '物品', '背景', 'UI界面', '特效'],
        gridCols: 10,
        gridRows: 24,
        
        // Animation Playback
        animationStates: {},
        spritesheetCache: {},
        mainLoopId: null,

        // Component Library Filtering
        activeCategoryFilter: 'all',
        searchQuery: '',

        // Copy Notification
        copyNotification: {
            show: false,
            message: '',
            timer: null
        },

        // Pane Resizing
        isResizing: false,
        // Drag and Drop
        draggingComponentIndex: -1,
        hoverCellIndex: -1,
        selectedComponentIndex: -1, // Though not displayed, it's used in drag logic
        draggedItemInfo: null, // NEW: Store info about the dragged item
    },
    computed: {
        gridCellCount() {
            return this.gridCols * this.gridRows;
        },
        gridContainerStyle() {
            const cellSize = 32;
            const gap = 1;
            const width = this.gridCols * cellSize + (this.gridCols - 1) * gap;
            const height = this.gridRows * cellSize + (this.gridRows - 1) * gap;
            return {
                gridTemplateColumns: `repeat(${this.gridCols}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${this.gridRows}, ${cellSize}px)`,
                width: `${width}px`,
                height: `${height}px`,
            };
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
            
            if (!this.searchQuery) {
                return grouped;
            }

            const filteredGrouped = {};
            const query = this.searchQuery.toLowerCase();

            for (const category in grouped) {
                const names = grouped[category];
                const filteredNames = {};
                
                for (const name in names) {
                    if (name.toLowerCase().includes(query)) {
                        filteredNames[name] = names[name];
                    }
                }
                
                if (Object.keys(filteredNames).length > 0) {
                    if (!filteredGrouped[category]) {
                        filteredGrouped[category] = {};
                    }
                    filteredGrouped[category] = { ...filteredGrouped[category], ...filteredNames };
                }
            }
            
            return filteredGrouped;
        },
    },
    mounted() {
        this.loadFromDatabase(); // CHANGE: Load from DB instead of LocalStorage
        this.mainAnimationLoop();
    },
    beforeDestroy() {
        if (this.mainLoopId) {
            cancelAnimationFrame(this.mainLoopId);
        }
    },
    watch: {
        savedComponents: {
            handler(newComponents, oldComponents) {
                // This logic handles animations in the component library
                const activeLibIndexes = new Set();
                newComponents.forEach((component, index) => {
                    if (component.type === 'animation') {
                        const stateKey = `library-${index}`;
                        activeLibIndexes.add(stateKey);
                        if (!this.animationStates[stateKey]) {
                            this.$set(this.animationStates, stateKey, {
                                currentFrame: 0,
                                lastTime: 0,
                                componentRef: component,
                                canvasName: `anim-canvas-library-${index}`
                            });
                        }
                    }
                });
                
                // Clean up states for deleted library components
                Object.keys(this.animationStates).forEach(key => {
                    if (key.startsWith('library-') && !activeLibIndexes.has(key)) {
                        this.$delete(this.animationStates, key);
                    }
                });
            },
            deep: true
        },
        placedComponents: {
            handler(newComponents) {
                // This logic handles animations for components placed on the grid
                const activeGridIds = new Set();
                newComponents.forEach(pComponent => {
                    const originalComponent = this.getOriginalComponent(pComponent.componentId);
                    if (originalComponent && originalComponent.type === 'animation') {
                        const stateKey = `grid-${pComponent.id}`;
                        activeGridIds.add(stateKey);
                        if (!this.animationStates[stateKey]) {
                            this.$set(this.animationStates, stateKey, {
                                currentFrame: 0,
                                lastTime: 0,
                                componentRef: originalComponent, // Reference to the source component
                                canvasName: `anim-canvas-grid-${pComponent.id}`
                            });
                        }
                    }
                });

                // Clean up states for deleted grid components
                Object.keys(this.animationStates).forEach(key => {
                    if (key.startsWith('grid-') && !activeGridIds.has(key)) {
                        this.$delete(this.animationStates, key);
                    }
                });
            },
            deep: true,
            immediate: true,
        }
    },
    methods: {
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
                    console.log('已成功從資料庫載入並重繪元件資料 (Viewer)。');

                    // 清除現有的動畫狀態以強制重新初始化
                    this.animationStates = {}; 
                }).catch(error => {
                    console.error('Rehydration failed:', error);
                    alert(`元件資料重繪失敗: ${error.message}`);
                });

            } catch (error) {
                console.error('從資料庫載入資料失敗:', error);
                alert('從資料庫載入資料失敗，請檢查主控台訊息。');
            }
        },

        showCopyNotification(message) {
            if (this.copyNotification.timer) {
                clearTimeout(this.copyNotification.timer);
            }
            this.copyNotification.message = message;
            this.copyNotification.show = true;
            this.copyNotification.timer = setTimeout(() => {
                this.copyNotification.show = false;
            }, 2000);
        },
        
        copyComponentJson(component) {
            const componentToCopy = { ...this.savedComponents[component.originalIndex] };
            
            // 移除由前端產生的資料
            delete componentToCopy.originalIndex;
            delete componentToCopy.imageData;
            
            const jsonString = JSON.stringify(componentToCopy, null, 2);
            navigator.clipboard.writeText(jsonString).then(() => {
                this.showCopyNotification(`'${component.name}' 的 JSON 已複製！`);
            }).catch(err => {
                console.error('複製失敗:', err);
                this.showCopyNotification('複製失敗！請檢查主控台。');
            });
        },

        // The following methods are no longer needed as data is loaded from the DB
        // handleFileUpload, saveToLocalStorage, loadFromLocalStorage

        getSmartImageUrl(url) {
            if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
                return url;
            }
             // Assume other URLs might need CORS proxy
            return `/proxy-image?url=${encodeURIComponent(url)}`;
        },

        rehydrateState(state) {
            return new Promise((resolve, reject) => {
                if (!state.savedComponents || state.savedComponents.length === 0) {
                    return resolve(state);
                }

                // 檢測檔案類型的輔助函數
                const detectFileType = (url) => {
                    if (!url) return 'png';
                    const extension = url.split('.').pop().toLowerCase();
                    if (extension === 'gif') return 'gif';
                    if (['jpg', 'jpeg'].includes(extension)) return 'jpg';
                    return 'png';
                };

                const componentsByUrl = {};
                state.savedComponents.forEach(component => {
                    // 確保每個元件都有 fileType 欄位
                    if (!component.fileType) {
                        component.fileType = detectFileType(component.spritesheetUrl);
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
                            // Resolve even on error to not block other images from loading
                            resolveSprite(); 
                        };
                    });
                });

                Promise.all(promises).then(() => {
                    resolve(state);
                });
            });
        },
    
        getOriginalComponent(componentId) {
            if (typeof componentId === 'number' && this.savedComponents[componentId]) {
                return this.savedComponents[componentId];
            }
            // Return a dummy static component to prevent errors
            return { type: 'static' }; 
        },
    
        getPlacedComponentStyle(component) {
            const original = this.getOriginalComponent(component.componentId);
            
            // 處理 GIF 類型的元件
            if (original.type === 'static' && original.fileType === 'gif') {
                return {
                    position: 'absolute',
                    left: `${component.positionX}px`,
                    top: `${component.positionY}px`,
                    width: `${component.width}px`,
                    height: `${component.height}px`,
                    backgroundImage: `url(${original.spritesheetUrl})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '100% 100%',
                    zIndex: component.zIndex,
                };
            }
            
            // 處理其他靜態元件
            return {
                position: 'absolute',
                left: `${component.positionX}px`,
                top: `${component.positionY}px`,
                width: `${component.width}px`,
                height: `${component.height}px`,
                backgroundImage: `url(${original.imageData})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: '100% 100%',
                zIndex: component.zIndex,
            };
        },

        // ===== Drag and Drop Methods =====
        onDragStart(event, identifier, type = 'library') {
            this.draggedItemInfo = { id: identifier, type: type };

            let componentIndex;
            if (type === 'library') {
                componentIndex = identifier;
            } else { // type === 'grid'
                const placedComponent = this.placedComponents.find(p => p.id === identifier);
                if (placedComponent) {
                    componentIndex = placedComponent.componentId;
                    // Hide the original component on the grid while dragging
                    placedComponent.isDragging = true; 
                }
            }
            
            if (componentIndex === undefined) return;

            this.draggingComponentIndex = componentIndex;
            event.dataTransfer.setData('text/plain', 'component:' + componentIndex);
            event.dataTransfer.effectAllowed = 'copy';
            
            // Custom drag image logic to hide default
            const dragImage = document.createElement('div');
            dragImage.style.opacity = '0';
            document.body.appendChild(dragImage);
            event.dataTransfer.setDragImage(dragImage, 0, 0);
            setTimeout(() => {
                document.body.removeChild(dragImage);
            }, 0);
        },
        onDragEnd() {
            // If a drag from the grid is cancelled, make the component visible again
            if (this.draggedItemInfo && this.draggedItemInfo.type === 'grid') {
                const placedComponent = this.placedComponents.find(p => p.id === this.draggedItemInfo.id);
                if (placedComponent) {
                    placedComponent.isDragging = false;
                }
            }
            this.draggingComponentIndex = -1;
            this.hoverCellIndex = -1;
            this.draggedItemInfo = null;
        },
        onDragOver(event) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        },
        onDragEnter(index) {
            this.hoverCellIndex = index;
        },
        onDragLeave(index) {
            if (this.hoverCellIndex === index) {
                this.hoverCellIndex = -1;
            }
        },
        onDrop(event) {
            const cellIndex = this.hoverCellIndex;
            if (cellIndex === -1) return;

            const { x, y, row, col } = this.calculatePlacementPosition(cellIndex);

            // Case 1: Dragging from the grid (MOVE operation)
            if (this.draggedItemInfo && this.draggedItemInfo.type === 'grid') {
                const movedComponent = this.placedComponents.find(p => p.id === this.draggedItemInfo.id);
                if (movedComponent) {
                    // Update position
                    movedComponent.positionX = x - 0;
                    movedComponent.positionY = y - movedComponent.height;
                    movedComponent.gridX = col;
                    movedComponent.gridY = row;
                    
                    // Bring to front by setting the highest z-index
                    const maxZIndex = this.placedComponents.reduce((max, p) => Math.max(max, p.zIndex), 0);
                    movedComponent.zIndex = maxZIndex + 1;
                    
                    // Make it visible again
                    movedComponent.isDragging = false;
                }
            } 
            // Case 2: Dragging from the library (CREATE operation)
            else { 
                const data = event.dataTransfer.getData('text/plain');
                if (!data || !data.startsWith('component:')) {
                    this.hoverCellIndex = -1;
                    return;
                }
                
                const componentIndex = parseInt(data.split(':')[1]);
                const originalComponent = this.savedComponents[componentIndex];
                if (!originalComponent) {
                     this.hoverCellIndex = -1;
                    return;
                }

                const newPlacedComponent = {
                    id: `view_${Date.now()}`,
                    componentId: componentIndex,
                    width: originalComponent.width,
                    height: originalComponent.height,
                    positionX: x - 0,
                    positionY: y - originalComponent.height,
                    gridX: col,
                    gridY: row,
                    // New components also get the highest z-index
                    zIndex: this.placedComponents.reduce((max, p) => Math.max(max, p.zIndex), -1) + 1,
                    isDragging: false,
                };
                
                this.placedComponents.push(newPlacedComponent);
            }

            this.hoverCellIndex = -1;
        },
        
        calculatePlacementPosition(cellIndex) {
            const gridContainer = this.$refs.gridContainer;
            if (!gridContainer) return { x: 0, y: 0, row: 0, col: 0 };

            const gridWidth = this.gridCols;
            const row = Math.floor(cellIndex / gridWidth);
            const col = cellIndex % gridWidth;

            const cellElement = document.getElementById(`grid-cell-${cellIndex}`);
            if (cellElement) {
                const cellRect = {
                    left: cellElement.offsetLeft,
                    top: cellElement.offsetTop,
                    width: cellElement.offsetWidth,
                    height: cellElement.offsetHeight
                };
                const x = cellRect.left;
                const y = cellRect.top + cellRect.height;
                return { x, y, row, col };
            }
            
            // Fallback calculation
            const cellWidth = 32;
            const cellHeight = 32;
            const gap = 1;
            const x = col * (cellWidth + gap);
            const y = row * (cellHeight + gap) + cellHeight;
            return { x, y, row, col };
        },

        // ===== Pane Resizing Methods =====
        startResize(event) {
            event.preventDefault();
            this.isResizing = true;
            document.addEventListener('mousemove', this.resize);
            document.addEventListener('mouseup', this.stopResize);
        },
        resize(event) {
            if (!this.isResizing) return;
            const newWidth = window.innerWidth - event.clientX;
            if (this.$refs.inspectorPane) {
                this.$refs.inspectorPane.style.width = `${newWidth}px`;
            }
        },
        stopResize() {
            this.isResizing = false;
            document.removeEventListener('mousemove', this.resize);
            document.removeEventListener('mouseup', this.stopResize);
        },

        getOriginalComponent(componentId) {
            if (typeof componentId === 'number' && this.savedComponents[componentId]) {
                return this.savedComponents[componentId];
            }
            return { type: 'static' }; // Return a dummy static component to prevent errors
        },

        getPlacedComponentStyle(component) {
            const original = this.getOriginalComponent(component.componentId);
            return {
                position: 'absolute',
                left: `${component.positionX}px`,
                top: `${component.positionY}px`,
                width: `${component.width}px`,
                height: `${component.height}px`,
                backgroundImage: `url(${original.imageData})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: '100% 100%',
                zIndex: component.zIndex,
            };
        },

        mainAnimationLoop(currentTime) {
            Object.keys(this.animationStates).forEach(stateKey => {
                const state = this.animationStates[stateKey];
                if (!state || !state.componentRef) return;

                const component = state.componentRef;
                const spritesheetUrl = component.animation.spritesheetUrl;
                if (!spritesheetUrl) return;

                let sourceImage = this.spritesheetCache[spritesheetUrl];
                if (!sourceImage) {
                    const newImg = new Image();
                    newImg.crossOrigin = "Anonymous";
                    newImg.src = this.getSmartImageUrl(spritesheetUrl);
                    this.$set(this.spritesheetCache, spritesheetUrl, newImg);
                    return;
                }
                
                if (!sourceImage.complete || sourceImage.naturalHeight === 0) {
                    return;
                }

                const speed = component.animation.speed || 100;

                if (currentTime - state.lastTime > speed) {
                    state.lastTime = currentTime;
                    
                    let nextFrame = state.currentFrame + 1;
                    if (nextFrame >= component.animation.frames.length) {
                        nextFrame = component.animation.loop ? 0 : state.currentFrame;
                    }
                    state.currentFrame = nextFrame;
                    
                    const frameInfo = component.animation.frames[state.currentFrame];
                    const canvasRef = this.$refs[state.canvasName];

                    if (canvasRef && canvasRef[0]) {
                        const canvas = canvasRef[0];
                        const ctx = canvas.getContext('2d');
                        
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        
                        try {
                            ctx.drawImage(
                                sourceImage,
                                frameInfo.x, frameInfo.y, frameInfo.w, frameInfo.h,
                                0, 0, canvas.width, canvas.height
                            );
                        } catch (e) {
                            console.error('Error drawing animation frame:', e);
                        }
                    }
                }
            });

            this.mainLoopId = requestAnimationFrame(this.mainAnimationLoop);
        }
    }
}); 