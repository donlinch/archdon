new Vue({
    el: '#app',
    data: {
        imageUrl: '',
        previewImageUrl: '',
        placedComponents: [], // 改名並初始化為空陣列
        editorState: {
            imageUrl: '',
            placedComponents: [], // 對應更改
            scale: 2,
            selection: null,
            savedComponents: [],
            alignmentMode: 'grid',
            anchorPoint: 'bottom-left',
            offsetX: 0,
            offsetY: 0
        },
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
        selectedCellIndex: -1, // 這個未來可能需要被 selectedPlacedComponentId 取代
        selectedPlacedComponentId: null, // 用於選中網格上的元件
        draggingComponentIndex: -1,
        isDraggingCanvas: false,
        hoverCellIndex: -1,
        alignmentMode: 'grid',
        anchorPoint: 'bottom-left', // 預設為左下角
        offsetX: 0,
        offsetY: 0,
        anchorPoints: [
            { value: 'top-left', icon: '↖' },
            { value: 'top-center', icon: '↑' },
            { value: 'top-right', icon: '↗' },
            { value: 'middle-left', icon: '←' },
            { value: 'center', icon: '·' },
            { value: 'middle-right', icon: '→' },
            { value: 'bottom-left', icon: '↙' },
            { value: 'bottom-center', icon: '↓' },
            { value: 'bottom-right', icon: '↘' }
        ]
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
        selectionWidth() {
            return Math.abs(this.selectionEnd.x - this.selectionStart.x);
        },
        selectionHeight() {
            return Math.abs(this.selectionEnd.y - this.selectionStart.y);
        },
        canApplyToGrid() {
            return (this.selectedComponentIndex !== -1 || this.componentImageData) && this.selectedCellIndex !== -1;
        }
    },
    mounted() {
        // 載入本地儲存的資料
        this.loadFromLocalStorage();
        
        // 監聽滑鼠移動以更新座標
        window.addEventListener('mousemove', this.updateMouseCoordinates);
        
        // 設置網格覆蓋層
        this.$nextTick(() => {
            this.setupGridOverlay();
            // 這裡的調試繪製邏輯需要更新，因為數據結構變了
            this.redrawPlacedComponentOverlays();
        });
    },
    beforeDestroy() {
        window.removeEventListener('mousemove', this.updateMouseCoordinates);
    },
    watch: {
        scale() {
            this.editorState.scale = this.scale;
            this.saveToLocalStorage();
            // 縮放變更時重新計算選擇區域
            this.$nextTick(() => {
                this.$forceUpdate();
            });
        },
        alignmentMode() {
            this.editorState.alignmentMode = this.alignmentMode;
            this.saveToLocalStorage();
        },
        anchorPoint() {
            this.editorState.anchorPoint = this.anchorPoint;
            this.saveToLocalStorage();
        },
        offsetX() {
            this.editorState.offsetX = this.offsetX;
            this.saveToLocalStorage();
        },
        offsetY() {
            this.editorState.offsetY = this.offsetY;
            this.saveToLocalStorage();
        },
        // 新增對 placedComponents 的監聽，以便在變動時重繪調試層
        placedComponents: {
            handler() {
                this.$nextTick(() => {
                    this.redrawPlacedComponentOverlays();
                });
                this.saveToLocalStorage(); // 確保每次變動都保存
            },
            deep: true
        }
    },
    methods: {
        getPreviewImageStyle() {
            return {
                transform: `scale(${this.scale})`,
                transformOrigin: 'top left',
                maxWidth: 'none',
                maxHeight: 'none',
                display: 'block'
            };
        },
        getSelectionAreaStyle() {
            // 只在圖片載入後才設置尺寸
            if (!this.$refs.previewImage || !this.$refs.previewImage.complete) {
                return {
                    minHeight: '200px',
                    minWidth: '200px'
                };
            }
            
            const width = this.$refs.previewImage.naturalWidth || this.$refs.previewImage.width;
            const height = this.$refs.previewImage.naturalHeight || this.$refs.previewImage.height;
            
            return {
                height: height * this.scale + 'px',
                width: width * this.scale + 'px',
                overflow: 'visible'
            };
        },
        // getCellStyle 不再負責渲染元件，只保留基本樣式
        getCellStyle(index) {
            // 這個方法現在可以用於例如高亮滑鼠懸停的格子等
            // 但不再負責顯示元件的背景圖
            return {};
        },
        // 新增：用於獲取單個已放置元件的樣式
        getPlacedComponentStyle(component) {
            return {
                position: 'absolute',
                left: `${component.positionX}px`,
                top: `${component.positionY}px`,
                width: `${component.width}px`,
                height: `${component.height}px`,
                backgroundImage: `url(${component.componentData})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'contain', // 或 '100% 100%'
                zIndex: component.zIndex, // z-index
                // 用於選中效果
                border: this.selectedPlacedComponentId === component.id ? '2px dashed #ff0000' : 'none'
            };
        },
        previewImage() {
            if (this.imageUrl) {
                // 使用伺服器的代理API來避免CORS問題
                this.previewImageUrl = `/proxy-image?url=${encodeURIComponent(this.imageUrl)}`;
                this.editorState.imageUrl = this.imageUrl;
                this.saveToLocalStorage();
                
                // 重置選擇區域
                this.hasSelection = false;
                this.componentImageData = null;
                
                // 確保在圖片載入後更新選擇區域大小
                if (this.$refs.previewImage) {
                    this.$refs.previewImage.onload = () => {
                        this.$forceUpdate();
                        this.initializeSelection();
                    };
                }
            }
        },
        handleImageError() {
            alert('圖片載入失敗，請檢查URL是否正確');
            this.previewImageUrl = '';
        },
        saveToLocalStorage() {
            // 更新 editorState 中要保存的數據
            this.editorState.placedComponents = this.placedComponents;
            this.editorState.savedComponents = this.savedComponents;
            localStorage.setItem('unitEditorState', JSON.stringify(this.editorState));
            console.log('狀態已保存到 localStorage');
        },
        loadFromLocalStorage() {
            const savedState = localStorage.getItem('unitEditorState');
            if (savedState) {
                console.log('從 localStorage 載入狀態');
                const parsedState = JSON.parse(savedState);
                
                // 為了兼容舊的數據結構 (gridData)，我們可以做一個轉換
                if (parsedState.gridData && !parsedState.placedComponents) {
                    console.warn('偵測到舊的 gridData 格式，將其轉換...');
                    parsedState.placedComponents = this.convertGridDataToPlacedComponents(parsedState.gridData);
                    delete parsedState.gridData; // 刪除舊數據
                }

                this.editorState = parsedState;
                this.imageUrl = parsedState.imageUrl || '';
                this.scale = parsedState.scale || 2;
                this.alignmentMode = parsedState.alignmentMode || 'grid';
                this.anchorPoint = parsedState.anchorPoint || 'bottom-left';
                this.offsetX = parsedState.offsetX || 0;
                this.offsetY = parsedState.offsetY || 0;
                
                if (this.imageUrl) {
                    this.previewImage();
                }
                // 使用新的 placedComponents 數據
                if (parsedState.placedComponents) {
                    this.placedComponents = parsedState.placedComponents;
                }
                if (parsedState.savedComponents && parsedState.savedComponents.length > 0) {
                    this.savedComponents = parsedState.savedComponents;
                }
                if (parsedState.selection) {
                    this.selectionStart = parsedState.selection.start;
                    this.selectionEnd = parsedState.selection.end;
                    this.hasSelection = true;
                }
                 this.$nextTick(() => {
                    this.redrawPlacedComponentOverlays();
                });
            }
        },
        // 新增：用於從舊格式轉換數據
        convertGridDataToPlacedComponents(gridData) {
            const newPlacedComponents = [];
            gridData.forEach((cell, index) => {
                if (cell && cell.componentData) {
                    newPlacedComponents.push({
                        id: `comp_${Date.now()}_${index}`,
                        ...cell,
                        zIndex: newPlacedComponents.length // 設置初始 zIndex
                    });
                }
            });
            return newPlacedComponents;
        },
        updateMouseCoordinates(event) {
            if (!this.$refs.selectionArea) return;
            
            const rect = this.$refs.selectionArea.getBoundingClientRect();
            const x = Math.floor((event.clientX - rect.left) / this.scale);
            const y = Math.floor((event.clientY - rect.top) / this.scale);
            
            // 只有在選擇區域內才更新座標
            if (x >= 0 && y >= 0 && x <= rect.width / this.scale && y <= rect.height / this.scale) {
                this.mouseX = x;
                this.mouseY = y;
            }
        },
        initializeSelection() {
            // 圖片載入後，更新選擇區域大小
            this.$forceUpdate();
            
            // 圖片載入後，如果有保存的選擇區域，則恢復它
            if (this.editorState.selection && this.hasSelection) {
                this.extractComponent();
            }
        },
        startSelection(event) {
            const rect = this.$refs.selectionArea.getBoundingClientRect();
            const x = (event.clientX - rect.left) / this.scale;
            const y = (event.clientY - rect.top) / this.scale;
            
            this.selectionStart = { x, y };
            this.selectionEnd = { x, y };
            this.isSelecting = true;
            
            // 防止拖曳時選中文字
            event.preventDefault();
        },
        updateSelection(event) {
            if (!this.isSelecting) return;
            
            const rect = this.$refs.selectionArea.getBoundingClientRect();
            const x = (event.clientX - rect.left) / this.scale;
            const y = (event.clientY - rect.top) / this.scale;
            
            // 確保選擇區域在圖片範圍內
            this.selectionEnd = { 
                x: Math.max(0, Math.min(rect.width / this.scale, x)),
                y: Math.max(0, Math.min(rect.height / this.scale, y))
            };
            
            // 防止拖曳時選中文字
            event.preventDefault();
        },
        endSelection(event) {
            if (!this.isSelecting) return;
            
            this.isSelecting = false;
            
            // 確保選擇區域有大小
            if (this.selectionWidth > 5 && this.selectionHeight > 5) {
                this.hasSelection = true;
                
                // 保存選擇區域
                this.editorState.selection = {
                    start: this.selectionStart,
                    end: this.selectionEnd,
                    scale: this.scale // 保存當前縮放比例
                };
                this.saveToLocalStorage();
                
                // 提取選擇區域的圖像
                this.extractComponent();
            } else {
                this.cancelSelection();
            }
        },
        cancelSelection() {
            if (this.isSelecting) {
                this.isSelecting = false;
            }
            // 不要在這裡重置 hasSelection，只在明確點擊取消按鈕時重置
        },
        clearSelection() {
            // 新增一個明確的清除選擇方法
            this.hasSelection = false;
            this.componentImageData = null;
            delete this.editorState.selection;
            this.saveToLocalStorage();
        },
        extractComponent() {
            if (!this.$refs.previewImage || !this.$refs.previewImage.complete) {
                console.error('提取元件失敗: 預覽圖片未加載完成');
                return;
            }
            
            const img = this.$refs.previewImage;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 計算實際的選擇區域（不考慮縮放因素，因為selectionStart和selectionEnd已經是原始坐標）
            const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
            const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);
            
            console.log('提取元件參數:', {
                left, top, width, height,
                imgNaturalWidth: img.naturalWidth,
                imgNaturalHeight: img.naturalHeight,
                imgWidth: img.width,
                imgHeight: img.height,
                scale: this.scale,
                selectionStart: this.selectionStart,
                selectionEnd: this.selectionEnd
            });
            
            // 設置畫布大小為實際選擇區域的大小
            canvas.width = width;
            canvas.height = height;
            
            try {
                // 從原始圖像提取選擇區域
                ctx.drawImage(
                    img,
                    left, top, width, height,
                    0, 0, width, height
                );
                
                // 確保生成的圖像數據有效
                this.componentImageData = canvas.toDataURL('image/png');
                console.log('提取元件成功，生成的圖像數據長度:', this.componentImageData.length);
                
                // 在元件預覽畫布上繪製圖像
                this.$nextTick(() => {
                    if (this.$refs.componentCanvas) {
                        const componentCtx = this.$refs.componentCanvas.getContext('2d');
                        const componentImg = new Image();
                        componentImg.onload = () => {
                            componentCtx.clearRect(0, 0, width, height);
                            componentCtx.drawImage(componentImg, 0, 0);
                            console.log('元件預覽畫布繪製完成');
                        };
                        componentImg.onerror = (err) => {
                            console.error('元件圖像加載失敗:', err);
                        };
                        componentImg.src = this.componentImageData;
                    } else {
                        console.error('找不到元件預覽畫布');
                    }
                });
            } catch (error) {
                console.error('提取元件失敗:', error, {
                    left, top, width, height,
                    imgWidth: img.naturalWidth,
                    imgHeight: img.naturalHeight,
                    scale: this.scale
                });
                alert('提取元件失敗，請重新選擇區域');
            }
        },
        saveComponent() {
            if (!this.componentImageData) {
                console.error('保存元件失敗: 沒有元件數據');
                return;
            }
            
            console.log('保存元件:', {
                width: this.selectionWidth,
                height: this.selectionHeight,
                dataLength: this.componentImageData.length
            });
            
            // 創建測試圖像確認數據是否有效
            const testImg = new Image();
            testImg.onload = () => {
                console.log('元件圖像數據有效，尺寸:', {
                    width: testImg.width,
                    height: testImg.height
                });
                
                this.savedComponents.push({
                    imageData: this.componentImageData,
                    width: this.selectionWidth,
                    height: this.selectionHeight
                });
                
                this.selectedComponentIndex = this.savedComponents.length - 1;
                this.saveToLocalStorage();
                console.log('元件已保存，總數:', this.savedComponents.length);
            };
            testImg.onerror = () => {
                console.error('元件圖像數據無效，無法加載');
                alert('元件圖像數據無效，請重新提取');
            };
            testImg.src = this.componentImageData;
        },
        selectComponent(index) {
            this.selectedComponentIndex = index;
        },
        onDragStart(event, index) {
            this.draggingComponentIndex = index;
            this.selectedComponentIndex = index;
            
            // 設置拖曳的數據
            event.dataTransfer.setData('text/plain', 'component:' + index);
            event.dataTransfer.effectAllowed = 'copy';
            
            // 創建一個隱形的拖曳圖像，使用自定義的預覽效果
            const dragImage = document.createElement('div');
            dragImage.style.opacity = '0';
            document.body.appendChild(dragImage);
            event.dataTransfer.setDragImage(dragImage, 0, 0);
            
            // 延遲移除拖曳圖像
            setTimeout(() => {
                document.body.removeChild(dragImage);
            }, 0);
        },
        onDragStartCanvas(event) {
            this.isDraggingCanvas = true;
            
            // 設置拖曳的數據
            event.dataTransfer.setData('text/plain', 'canvas');
            event.dataTransfer.effectAllowed = 'copy';
            
            // 創建一個隱形的拖曳圖像，使用自定義的預覽效果
            const dragImage = document.createElement('div');
            dragImage.style.opacity = '0';
            document.body.appendChild(dragImage);
            event.dataTransfer.setDragImage(dragImage, 0, 0);
            
            // 延遲移除拖曳圖像
            setTimeout(() => {
                document.body.removeChild(dragImage);
            }, 0);
        },
        onDragEnd() {
            this.draggingComponentIndex = -1;
            this.isDraggingCanvas = false;
            this.hoverCellIndex = -1;
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
            if (cellIndex === -1) {
                console.warn('拖放失敗: 沒有有效的目標格子');
                return;
            }
            
            const data = event.dataTransfer.getData('text/plain');
            let componentData, componentWidth, componentHeight;
            
            if (data.startsWith('component:')) {
                const componentIndex = parseInt(data.split(':')[1]);
                if (componentIndex >= 0 && componentIndex < this.savedComponents.length) {
                    const component = this.savedComponents[componentIndex];
                    componentData = component.imageData;
                    componentWidth = component.width;
                    componentHeight = component.height;
                } else { return; }
            } else if (data === 'canvas' && this.componentImageData) {
                componentData = this.componentImageData;
                componentWidth = this.selectionWidth;
                componentHeight = this.selectionHeight;
            } else { return; }
            
            if (!componentData) { return; }
            
            const testImg = new Image();
            testImg.onload = () => {
                // 將 event 傳遞給 calculatePlacementPosition
                const { x, y } = this.calculatePlacementPosition(cellIndex, event);
                let anchorOffsetX = 0;
                let anchorOffsetY = 0;
                
                switch(this.anchorPoint) {
                    case 'top-center': anchorOffsetX = -componentWidth / 2; break;
                    case 'top-right': anchorOffsetX = -componentWidth; break;
                    case 'middle-left': anchorOffsetY = -componentHeight / 2; break;
                    case 'center':
                        anchorOffsetX = -componentWidth / 2;
                        anchorOffsetY = -componentHeight / 2;
                        break;
                    case 'middle-right':
                        anchorOffsetX = -componentWidth;
                        anchorOffsetY = -componentHeight / 2;
                        break;
                    case 'bottom-left': anchorOffsetY = -componentHeight; break;
                    case 'bottom-center':
                        anchorOffsetX = -componentWidth / 2;
                        anchorOffsetY = -componentHeight;
                        break;
                    case 'bottom-right':
                        anchorOffsetX = -componentWidth;
                        anchorOffsetY = -componentHeight;
                        break;
                }
                
                const finalX = x + anchorOffsetX;
                const finalY = y + anchorOffsetY;
                
                // 新增元件到 placedComponents 陣列
                const newComponent = {
                    id: `comp_${Date.now()}`,
                    componentData: componentData,
                    width: componentWidth,
                    height: componentHeight,
                    positionX: finalX,
                    positionY: finalY,
                    anchorPoint: this.anchorPoint,
                    alignmentMode: this.alignmentMode,
                    zIndex: this.placedComponents.length // 新的元件在最上層
                };
                
                this.placedComponents.push(newComponent);
                
                console.log('元件已放置:', newComponent);
                
                this.saveToLocalStorage(); // 保存狀態
                this.hoverCellIndex = -1;
            };
            
            testImg.onerror = () => {
                alert('元件圖像數據無效，無法放置');
            };
            
            testImg.src = componentData;
        },
        deleteComponent(index) {
            this.savedComponents.splice(index, 1);
            if (this.selectedComponentIndex === index) {
                this.selectedComponentIndex = -1;
            } else if (this.selectedComponentIndex > index) {
                this.selectedComponentIndex--;
            }
            this.saveToLocalStorage();
        },
        handleCellClick(index) {
            // 這個點擊邏輯現在應該用來取消選中任何已選中的元件
            this.selectedPlacedComponentId = null;
            this.selectedCellIndex = -1; // 也可以保留，用於其他目的
        },
        // 新增：點擊已放置的元件
        handlePlacedComponentClick(component, event) {
            event.stopPropagation(); // 防止觸發 grid-container 的點擊事件
            this.selectedPlacedComponentId = component.id;
            console.log(`已選中元件: ${component.id}`);
        },
        applySelectedComponentToGrid() {
            // 這個方法的作用需要重新考慮，因為現在是拖放機制
            console.warn('applySelectedComponentToGrid 已過時');
        },
        // clearSelectedCell 被 deleteSelectedPlacedComponent 取代
        deleteSelectedPlacedComponent() {
            if (!this.selectedPlacedComponentId) return;
            const index = this.placedComponents.findIndex(c => c.id === this.selectedPlacedComponentId);
            if (index !== -1) {
                this.placedComponents.splice(index, 1);
                this.selectedPlacedComponentId = null;
                // 可選：重新計算 zIndex
                this.recalculateZIndexes();
                this.saveToLocalStorage();
            }
        },
        applyComponentToGrid(index) {
            // 這個方法已過時
            console.warn('applyComponentToGrid 已過時');
        },
        clearGrid() {
            if (confirm('確定要清除整個網格嗎？')) {
                this.placedComponents = []; // 清空陣列
                this.saveToLocalStorage();
                // 清除調試覆蓋層
                this.$nextTick(() => {
                    this.clearDebugCanvas();
                });
            }
        },
        saveGrid() {
            alert('網格已自動儲存到本地！');
            this.saveToLocalStorage();
        },
        setupGridOverlay() {
            if (!this.$refs.gridOverlay) return;
            
            const canvas = this.$refs.gridOverlay;
            const ctx = canvas.getContext('2d');
            const gridContainer = this.$refs.gridContainer;
            
            if (!gridContainer) return;
            
            canvas.width = gridContainer.clientWidth;
            canvas.height = gridContainer.clientHeight;
            
            // 繪製網格線
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 0.5;
            
            // 繪製垂直線
            for (let x = 0; x <= 5; x++) {
                const xPos = x * 33 + 10; // 32px cell + 1px gap
                ctx.beginPath();
                ctx.moveTo(xPos, 0);
                ctx.lineTo(xPos, canvas.height);
                ctx.stroke();
            }
            
            // 繪製水平線
            for (let y = 0; y <= 5; y++) {
                const yPos = y * 33 + 10; // 32px cell + 1px gap
                ctx.beginPath();
                ctx.moveTo(0, yPos);
                ctx.lineTo(canvas.width, yPos);
                ctx.stroke();
            }
        },
        getAnchorMarkerStyle() {
            // 根據錨點位置計算標記的位置
            let x = 0, y = 0;
            const width = this.selectionWidth;
            const height = this.selectionHeight;
            
            switch(this.anchorPoint) {
                case 'top-left':
                    x = 0; y = 0;
                    break;
                case 'top-center':
                    x = width / 2; y = 0;
                    break;
                case 'top-right':
                    x = width; y = 0;
                    break;
                case 'middle-left':
                    x = 0; y = height / 2;
                    break;
                case 'center':
                    x = width / 2; y = height / 2;
                    break;
                case 'middle-right':
                    x = width; y = height / 2;
                    break;
                case 'bottom-left':
                    x = 0; y = height;
                    break;
                case 'bottom-center':
                    x = width / 2; y = height;
                    break;
                case 'bottom-right':
                    x = width; y = height;
                    break;
            }
            
            return {
                left: `${x}px`,
                top: `${y}px`
            };
        },
        calculatePlacementPosition(cellIndex, event) { // 接收 event 物件
            const gridContainer = this.$refs.gridContainer;
            if (!gridContainer) {
                return { x: 0, y: 0, row: 0, col: 0 };
            }
            
            const gridRect = gridContainer.getBoundingClientRect();
            const gridWidth = 5;
            const cellWidth = 32;
            const cellHeight = 32;
            const gap = 1;

            const row = Math.floor(cellIndex / gridWidth);
            const col = cellIndex % gridWidth;

            let x, y;

            switch (this.alignmentMode) {
                case 'free':
                    // 自由模式：基於滑鼠精確位置，但相對於 grid container
                    // 這需要 onDrop 事件傳遞 clientX/Y
                    if (event) {
                        const dropX = event.clientX - gridRect.left;
                        const dropY = event.clientY - gridRect.top;
                        x = dropX;
                        y = dropY;
                    } else {
                        // 如果沒有事件（例如從舊數據加載），則回退到網格對齊
                        x = col * (cellWidth + gap);
                        y = row * (cellHeight + gap);
                    }
                    break;
                case 'half-grid':
                    // 半格對齊
                    // 同樣需要滑鼠位置
                     if (event) {
                        const dropHalfX = event.clientX - gridRect.left;
                        const dropHalfY = event.clientY - gridRect.top;
                        x = Math.round(dropHalfX / (cellWidth / 2)) * (cellWidth / 2);
                        y = Math.round(dropHalfY / (cellHeight / 2)) * (cellHeight / 2);
                    } else {
                        x = col * (cellWidth + gap);
                        y = row * (cellHeight + gap);
                    }
                    break;
                case 'grid':
                default:
                    // 嚴格網格對齊
                    x = col * (cellWidth + gap);
                    y = row * (cellHeight + gap);
                    break;
            }

            return { x, y, row, col };
        },
        // renderComponentDebugOverlay 需要重做
        redrawPlacedComponentOverlays() {
            const canvas = this.$refs.gridOverlay;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            this.clearDebugCanvas(ctx);

            this.placedComponents.forEach(component => {
                this.renderComponentDebugOverlay(ctx, component);
            });
        },
        clearDebugCanvas(context) {
             const ctx = context || (this.$refs.gridOverlay ? this.$refs.gridOverlay.getContext('2d') : null);
             if(ctx) {
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                // ممكن نعيد رسم الشبكة هنا إذا مسحناها
             }
        },

        renderComponentDebugOverlay(ctx, component) {
            if (!component) return;

            const { positionX, positionY, width, height, anchorPoint } = component;

            // 繪製紅色除錯外框
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
            ctx.lineWidth = 1;
            ctx.strokeRect(positionX, positionY, width, height);

            // 計算錨點在畫布上的絕對位置
            let anchorX = positionX;
            let anchorY = positionY;

            switch (anchorPoint) {
                case 'top-center': anchorX += width / 2; break;
                case 'top-right': anchorX += width; break;
                case 'middle-left': anchorY += height / 2; break;
                case 'center':
                    anchorX += width / 2;
                    anchorY += height / 2;
                    break;
                case 'middle-right':
                    anchorX += width;
                    anchorY += height / 2;
                    break;
                case 'bottom-left': anchorY += height; break;
                case 'bottom-center':
                    anchorX += width / 2;
                    anchorY += height;
                    break;
                case 'bottom-right':
                    anchorX += width;
                    anchorY += height;
                    break;
            }

            // 繪製錨點
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(anchorX, anchorY, 3, 0, 2 * Math.PI);
            ctx.fill();
        },

        // 新增輔助方法
        recalculateZIndexes() {
            this.placedComponents.forEach((c, index) => {
                c.zIndex = index;
            });
        }
    }
});
