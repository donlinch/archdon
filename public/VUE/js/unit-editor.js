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
        selectedComponentIndex: -1,
        // Component categorization
        componentCategory: '人物', // Default category
        categories: ['人物', '物品', '背景'], // Available categories
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
                // 修正：預設分類應該在建立時就設定好
                const category = component.category || '物品';
                if (!grouped[category]) {
                    grouped[category] = [];
                }
                grouped[category].push(componentWithIndex);
            });
            return grouped;
        },
    },
    mounted() {
        // 載入本地儲存的資料
        this.loadFromLocalStorage();
        
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
                
                this.saveToLocalStorage(); // Save any changes (like deletions)
            },
            deep: true
        },
        scale() {
            this.saveToLocalStorage();
            // 縮放變更時重新計算選擇區域
            this.$nextTick(() => {
                this.$forceUpdate();
            });
        },
    },
    methods: {
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
                    newImg.src = spritesheetUrl;
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
            this.saveToLocalStorage();
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
                    if (this.$refs.componentCanvas) {
                        const previewCtx = this.$refs.componentCanvas.getContext('2d');
                        previewCtx.clearRect(0, 0, sw, sh);
                        const img = new Image();
                        img.onload = () => {
                            previewCtx.drawImage(img, 0, 0);
                        };
                        img.src = this.componentImageData;
                    }
                });
            } catch (e) {
                console.error("無法從 Canvas 提取圖片:", e);
                alert("圖片提取失敗。如果圖片來自其他網站，這可能是 CORS 安全限制。請嘗試將圖片下載後，透過本地伺服器或圖片上傳網站（如 imgur）來載入。");
                this.componentImageData = null;
            }
        },
        
        // ===== Component Creation and Management =====
        saveComponent() {
            if (!this.componentImageData) return;
            
            const newComponent = {
                type: 'static',
                imageData: this.componentImageData,
                spritesheetUrl: this.imageUrl, // Save source URL
                sourceRect: {
                    x: Math.round(Math.min(this.selectionStart.x, this.selectionEnd.x)),
                    y: Math.round(Math.min(this.selectionStart.y, this.selectionEnd.y)),
                    w: Math.round(this.selectionWidth),
                    h: Math.round(this.selectionHeight)
                },
                width: Math.round(this.selectionWidth),
                height: Math.round(this.selectionHeight),
                category: this.componentCategory,
                scale: 1, // Default scale for components
                anchor: this.anchorPoint,
            };
            
            this.savedComponents.push(newComponent);
            this.saveToLocalStorage();
            this.clearSelection();
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
        saveAnimationComponent() {
            if (this.multiSelectionFrames.length === 0) return;

            const firstFrame = this.multiSelectionFrames[0];
            
            const newAnimationComponent = {
                type: 'animation',
                category: this.componentCategory,
                width: Math.round(firstFrame.sourceRect.w),
                height: Math.round(firstFrame.sourceRect.h),
                scale: 1,
                anchor: this.anchorPoint,
                animation: {
                    spritesheetUrl: this.imageUrl, // Save source URL
                    frames: this.multiSelectionFrames.map(f => f.sourceRect),
                    speed: this.animationSpeed,
                    loop: this.animationLoop
                }
            };
            
            this.savedComponents.push(newAnimationComponent);
            this.saveToLocalStorage();
            this.clearAnimationFrames();
        },
        clearAnimationFrames() {
            this.multiSelectionFrames = [];
            this.addedFrameCoordinates = [];
        },
        selectComponent(index) {
            this.selectedComponentIndex = index;
        },
        deleteComponent(index) {
            if (confirm(`確定要刪除這個元件嗎？`)) {
                this.savedComponents.splice(index, 1);
                this.saveToLocalStorage();
                
                if (this.selectedComponentIndex === index) {
                    this.selectedComponentIndex = -1;
                }
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
                // Replace the old component with the edited version
                this.$set(this.savedComponents, this.editingComponentIndex, this.editingComponent);
                this.saveToLocalStorage();
                this.closeEditModal();
            }
        },
        closeEditModal() {
            this.isEditing = false;
            this.editingComponent = null;
            this.editingComponentIndex = -1;
        },
        
        getAnchorMarkerStyle() {
            if (!this.$refs.componentCanvas) return {};

            const canvasHeight = this.$refs.componentCanvas.height;
            let style = {
                bottom: '0px',
                left: '0px'
            };

            // This logic is simplified because anchor is always bottom-left
            style = {
                left: `0px`,
                top: `${canvasHeight}px`
            };
            
            return style;
        },
        pasteComponent() {
            navigator.clipboard.readText().then(text => {
                if (!text) {
                    alert('剪貼簿是空的。');
                    return;
                }
                try {
                    const component = JSON.parse(text);

                    // Basic validation
                    if (!component.type || !component.width || !component.height) {
                        throw new Error('無效的元件資料格式。');
                    }
                    if(component.type === 'animation' && (!component.animation || !component.animation.frames || !component.animation.spritesheetUrl)) {
                        throw new Error('無效的動畫元件資料格式。');
                    }
                    if(component.type === 'static' && !component.spritesheetUrl) {
                        throw new Error('無效的靜態元件資料格式。');
                    }


                    // Add to library
                    this.savedComponents.push(component);
                    this.saveToLocalStorage();

                    alert('元件已成功貼上！');

                } catch (err) {
                    console.error('貼上元件失敗:', err);
                    alert('貼上失敗，無效的元件 JSON 格式。');
                }
            }).catch(err => {
                console.error('無法讀取剪貼簿:', err);
                alert('無法讀取剪貼簿。請確認您已授權瀏覽器讀取剪貼簿的權限。');
            });
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
