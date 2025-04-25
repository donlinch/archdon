// template-functions.js - 用于处理模板相关功能

// 模板相关变量
let currentTemplateId = '';
let isTemplateLoading = false;

// 加载并展示可用的模板列表
async function loadTemplateList() {
    const templateSelect = document.getElementById('template-select');
    const loadingIndicator = document.querySelector('.loading-indicator');
    
    if (!templateSelect) return;
    
    try {
        // 显示加载中提示
        loadingIndicator.style.display = 'block';
        
        // 发送请求获取模板列表
        const response = await fetch('/api/admin/walk_map/templates');        
        if (!response.ok) {
            throw new Error(`无法获取模板列表: ${response.statusText}`);
        }
        
        const templates = await response.json();
        
        // 清除现有选项，保留第一个默认选项
        templateSelect.innerHTML = '<option value="">-- 请选择模板 --</option>';
        
        // 添加模板选项
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.template_id;
            option.textContent = template.template_name;
            templateSelect.appendChild(option);
        });
        
        // 隐藏加载中提示
        loadingIndicator.style.display = 'none';
        
        console.log('模板列表已成功加载');
    } catch (error) {
        console.error('加载模板列表失败:', error);
        loadingIndicator.style.display = 'none';
        
        // 添加一个错误选项
        const errorOption = document.createElement('option');
        errorOption.value = '';
        errorOption.textContent = '-- 加载失败，请重试 --';
        templateSelect.innerHTML = '';
        templateSelect.appendChild(errorOption);
    }
}

// 应用模板样式
function applyTemplateStyles(styleData) {
    if (!styleData) {
        console.warn('无样式数据可应用');
        return;
    }
    
    // 1. 应用整体页面样式
    if (styleData.general) {
        document.body.style.backgroundColor = styleData.general.pageBgColor || '';
        document.body.style.color = styleData.general.primaryTextColor || '';
        if (styleData.general.primaryFontFamily) {
            document.body.style.fontFamily = styleData.general.primaryFontFamily;
        }
    }
    
    // 2. 应用头部样式
    const gameHeader = document.querySelector('.game-header');
    if (gameHeader && styleData.header) {
        gameHeader.style.backgroundColor = styleData.header.headerBgColor || '';
        gameHeader.style.color = styleData.header.headerTextColor || '';
        
        const roomInfo = document.getElementById('room-info');
        if (roomInfo && styleData.header.roomInfoColor) {
            roomInfo.style.color = styleData.header.roomInfoColor;
        }
    }
    
    // 3. 应用游戏地图样式
    const gameMap = document.getElementById('game-map');
    if (gameMap && styleData.board) {
        if (styleData.board.borderColor) {
            gameMap.style.borderColor = styleData.board.borderColor;
        }
        if (styleData.board.borderWidth) {
            gameMap.style.borderWidth = styleData.board.borderWidth;
        }
        
        // 中央背景颜色
        if (styleData.board.centerBgColor) {
            gameMap.style.backgroundColor = styleData.board.centerBgColor;
        }
        
        // 中央图片
        const mapCenterImage = document.querySelector('#map-center-image-container img');
        if (mapCenterImage && styleData.board.centerImageUrl) {
            mapCenterImage.src = styleData.board.centerImageUrl;
        }
    }
    
    // 4. 应用地图格子样式
    if (styleData.mapCell) {
        const cells = document.querySelectorAll('.map-cell');
        cells.forEach(cell => {
            // 只应用没有自定义样式的格子
            if (!cell.hasAttribute('data-custom-style')) {
                if (styleData.mapCell.defaultBgColor) {
                    cell.style.backgroundColor = styleData.mapCell.defaultBgColor;
                }
                if (styleData.mapCell.defaultBorderColor) {
                    cell.style.borderColor = styleData.mapCell.defaultBorderColor;
                }
                if (styleData.mapCell.defaultBorderWidth) {
                    cell.style.borderWidth = styleData.mapCell.defaultBorderWidth;
                }
            }
            
            // 应用文字颜色
            const title = cell.querySelector('.cell-title');
            const number = cell.querySelector('.cell-number');
            
            if (title && styleData.mapCell.titleTextColor) {
                title.style.color = styleData.mapCell.titleTextColor;
            }
            
            if (number && styleData.mapCell.numberTextColor) {
                number.style.color = styleData.mapCell.numberTextColor;
            }
        });
        
        // 添加悬停样式
        if (styleData.mapCell.hoverBgColor || styleData.mapCell.hoverBorderColor) {
            const styleElement = document.getElementById('dynamic-hover-style') || document.createElement('style');
            if (!styleElement.id) styleElement.id = 'dynamic-hover-style';
            
            let hoverStyle = '.map-cell:hover, .map-cell:active {';
            if (styleData.mapCell.hoverBgColor) {
                hoverStyle += `background-color: ${styleData.mapCell.hoverBgColor} !important;`;
            }
            if (styleData.mapCell.hoverBorderColor) {
                hoverStyle += `border-color: ${styleData.mapCell.hoverBorderColor} !important;`;
            }
            hoverStyle += '}';
            
            styleElement.textContent = hoverStyle;
            if (!styleElement.parentNode) {
                document.head.appendChild(styleElement);
            }
        }
    }
    
    // 5. 应用玩家标记样式
    if (styleData.playerMarker) {
        const markers = document.querySelectorAll('.player-marker');
        
        // 形状 (border-radius)
        if (styleData.playerMarker.shape) {
            markers.forEach(marker => {
                marker.style.borderRadius = styleData.playerMarker.shape;
            });
        }
        
        // 文字颜色
        if (styleData.playerMarker.textColor) {
            markers.forEach(marker => {
                marker.style.color = styleData.playerMarker.textColor;
            });
        }
        
        // 阴影
        if (styleData.playerMarker.boxShadow) {
            markers.forEach(marker => {
                marker.style.boxShadow = styleData.playerMarker.boxShadow;
            });
        }
        
        // 玩家颜色
        if (styleData.playerMarker.playerColors && styleData.playerMarker.playerColors.length > 0) {
            const styleElement = document.getElementById('dynamic-player-colors') || document.createElement('style');
            if (!styleElement.id) styleElement.id = 'dynamic-player-colors';
            
            let colorStyles = '';
            for (let i = 0; i < styleData.playerMarker.playerColors.length && i < 5; i++) {
                colorStyles += `.player-color-${i+1} { background-color: ${styleData.playerMarker.playerColors[i]} !important; }\n`;
            }
            
            styleElement.textContent = colorStyles;
            if (!styleElement.parentNode) {
                document.head.appendChild(styleElement);
            }
        }
    }
    
    // 6. 应用控制区样式
    const controllerArea = document.getElementById('controller-area');
    if (controllerArea && styleData.controller) {
        if (styleData.controller.panelBackground) {
            controllerArea.style.backgroundColor = styleData.controller.panelBackground;
        }
        
        // 玩家信息标签颜色
        const playerInfo = controllerArea.querySelector('.player-info');
        if (playerInfo && styleData.controller.playerLabelColor) {
            playerInfo.style.color = styleData.controller.playerLabelColor;
        }
        
        // 控制按钮样式
        const controlButtons = controllerArea.querySelectorAll('.btn-control, .btn-dice');
        if (controlButtons.length && styleData.controller.controlButton) {
            controlButtons.forEach(button => {
                if (styleData.controller.controlButton.defaultBgColor) {
                    button.style.backgroundColor = styleData.controller.controlButton.defaultBgColor;
                }
                if (styleData.controller.controlButton.defaultTextColor) {
                    button.style.color = styleData.controller.controlButton.defaultTextColor;
                }
                if (styleData.controller.controlButton.borderRadius) {
                    button.style.borderRadius = styleData.controller.controlButton.borderRadius;
                }
            });
            
            // 按钮悬停样式
            if (styleData.controller.controlButton.hoverBgColor) {
                const styleElement = document.getElementById('dynamic-button-hover') || document.createElement('style');
                if (!styleElement.id) styleElement.id = 'dynamic-button-hover';
                
                styleElement.textContent = `.btn-control:hover, .btn-dice:hover { background-color: ${styleData.controller.controlButton.hoverBgColor} !important; }`;
                if (!styleElement.parentNode) {
                    document.head.appendChild(styleElement);
                }
            }
            
            // 按钮冷却样式
            if (styleData.controller.controlButton.cooldownOpacity) {
                const styleElement = document.getElementById('dynamic-button-cooldown') || document.createElement('style');
                if (!styleElement.id) styleElement.id = 'dynamic-button-cooldown';
                
                styleElement.textContent = `.btn-cooldown { opacity: ${styleData.controller.controlButton.cooldownOpacity} !important; }`;
                if (!styleElement.parentNode) {
                    document.head.appendChild(styleElement);
                }
            }
        }
    }
    
    // 7. 应用信息区样式
    const infoArea = document.getElementById('info-area');
    if (infoArea && styleData.info) {
        if (styleData.info.panelBackground) {
            infoArea.style.backgroundColor = styleData.info.panelBackground;
        }
        
        // 区块标题颜色
        const sectionTitles = infoArea.querySelectorAll('h3');
        if (sectionTitles.length && styleData.info.sectionTitleColor) {
            sectionTitles.forEach(title => {
                title.style.color = styleData.info.sectionTitleColor;
            });
        }
        
        // 玩家列表文字颜色
        const playersList = document.getElementById('players-list');
        if (playersList && styleData.info.playerListText) {
            playersList.style.color = styleData.info.playerListText;
        }
        
        // 静态文字颜色
        const gameStatus = document.getElementById('game-status');
        if (gameStatus && styleData.info.staticTextColor) {
            gameStatus.style.color = styleData.info.staticTextColor;
        }
        
        // 离开游戏按钮
        const leaveButton = document.getElementById('leave-game');
        if (leaveButton && styleData.info.leaveButton) {
            if (styleData.info.leaveButton.defaultBgColor) {
                leaveButton.style.backgroundColor = styleData.info.leaveButton.defaultBgColor;
            }
            if (styleData.info.leaveButton.defaultTextColor) {
                leaveButton.style.color = styleData.info.leaveButton.defaultTextColor;
            }
        }
    }
    
    // 8. 应用连接状态样式
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus && styleData.connection) {
        const statusClass = connectionStatus.className;
        
        if (statusClass === 'online' && styleData.connection.onlineBgColor && styleData.connection.onlineTextColor) {
            connectionStatus.style.backgroundColor = styleData.connection.onlineBgColor;
            connectionStatus.style.color = styleData.connection.onlineTextColor;
        } else if (statusClass === 'offline' && styleData.connection.offlineBgColor && styleData.connection.offlineTextColor) {
            connectionStatus.style.backgroundColor = styleData.connection.offlineBgColor;
            connectionStatus.style.color = styleData.connection.offlineTextColor;
        } else if (statusClass === 'connecting' && styleData.connection.connectingBgColor && styleData.connection.connectingTextColor) {
            connectionStatus.style.backgroundColor = styleData.connection.connectingBgColor;
            connectionStatus.style.color = styleData.connection.connectingTextColor;
        }
    }
    
    // 9. 应用模态框样式
    const modal = document.getElementById('location-modal');
    if (modal && styleData.modal) {
        // 遮罩背景色
        if (styleData.modal.overlayBgColor) {
            modal.style.backgroundColor = styleData.modal.overlayBgColor;
        }
        
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent && styleData.modal.contentBgColor) {
            modalContent.style.backgroundColor = styleData.modal.contentBgColor;
        }
        
        const modalHeader = modal.querySelector('.modal-header');
        if (modalHeader && styleData.modal.headerBgColor) {
            modalHeader.style.backgroundColor = styleData.modal.headerBgColor;
        }
        
        if (modalHeader && styleData.modal.headerTextColor) {
            modalHeader.style.color = styleData.modal.headerTextColor;
        }
        
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody && styleData.modal.bodyTextColor) {
            modalBody.style.color = styleData.modal.bodyTextColor;
        }
    }
    
    console.log('模板样式已成功应用');
}

// 更新格子内容
function updateCellContents(cellData) {
    if (!cellData || !Array.isArray(cellData)) {
        console.warn('无有效格子数据可更新');
        return;
    }
    
    try {
        // 直接使用 cellData 更新全局 cellInfo 变量
        // 检查 cellInfo 是否是一个有效的全局变量
        if (typeof cellInfo !== 'undefined') {
            // 根据 cell_index 更新目标格子
            cellData.forEach(cell => {
                const index = cell.cell_index;
                if (index !== undefined && index >= 0 && index < cellInfo.length) {
                    cellInfo[index] = {
                        title: cell.title || '格子',
                        description: cell.description || '这是一个游戏格子。'
                    };
                }
            });
            
            console.log('格子信息已更新', cellInfo);
        } else {
            console.error('全局 cellInfo 变量不存在，无法更新');
        }
        
        // 更新 DOM 中的格子
        cellData.forEach(cell => {
            const cellElement = document.getElementById(`cell-${cell.cell_index}`);
            if (!cellElement) return;
            
            // 更新标题
            const titleElement = cellElement.querySelector('.cell-title');
            if (titleElement) {
                titleElement.textContent = cell.title || '格子';
            }
            
            // 应用自定义背景颜色 (如果有)
            if (cell.cell_bg_color) {
                cellElement.style.backgroundColor = cell.cell_bg_color;
                cellElement.setAttribute('data-custom-style', 'true');
            } else {
                cellElement.removeAttribute('data-custom-style');
                // 恢复为模板默认颜色
                cellElement.style.backgroundColor = '';
            }
        });
        
        console.log('DOM 格子内容已成功更新');
    } catch (error) {
        console.error('更新格子内容时发生错误:', error);
    }
}

// 加载模板和初始化模板选择器
function initTemplateSelector() {
    const templateSelector = document.getElementById('template-selector');
    const openTemplateBtn = document.getElementById('open-template-selector');
    const closeTemplateBtn = document.getElementById('close-template-selector');
    const applyTemplateBtn = document.getElementById('apply-template');
    const cancelTemplateBtn = document.getElementById('cancel-template');
    const templateSelect = document.getElementById('template-select');
    const templatePreviewImage = document.getElementById('template-preview-image');
    const templateDescription = document.getElementById('template-description');
    
    // 检查必要元素是否存在
    if (!templateSelector || !openTemplateBtn) {
        console.error('模板选择器所需元素不存在');
        return;
    }
    
    // 加载模板列表
    loadTemplateList();
    
    // 打开模板选择器
    openTemplateBtn.addEventListener('click', () => {
        templateSelector.style.display = 'block';
    });
    
    // 关闭模板选择器
    if (closeTemplateBtn) {
        closeTemplateBtn.addEventListener('click', () => {
            templateSelector.style.display = 'none';
        });
    }
    
    if (cancelTemplateBtn) {
        cancelTemplateBtn.addEventListener('click', () => {
            templateSelector.style.display = 'none';
        });
    }
    
    // 模板选择变化时
    if (templateSelect) {
        templateSelect.addEventListener('change', async () => {
            const selectedTemplateId = templateSelect.value;
            if (!selectedTemplateId) {
                if (templatePreviewImage) {
                    templatePreviewImage.innerHTML = '选择模板来预览';
                }
                if (templateDescription) {
                    templateDescription.textContent = '选择一个模板以查看描述';
                }
                return;
            }
            
            try {
                const response = await fetch(`/api/admin/walk_map/templates/${selectedTemplateId}`);                if (!response.ok) {
                    throw new Error(`无法获取模板预览: ${response.statusText}`);
                }
                
                const templateData = await response.json();
                
                // 更新预览
                if (templatePreviewImage) {
                    const centerImage = templateData.style_data?.board?.centerImageUrl;
                    if (centerImage) {
                        templatePreviewImage.innerHTML = `<img src="${centerImage}" alt="模板预览" style="max-width: 100%; max-height: 100%;">`;
                    } else {
                        templatePreviewImage.innerHTML = '此模板没有预览图片';
                    }
                }
                
                // 更新描述
                if (templateDescription) {
                    templateDescription.textContent = templateData.description || '没有描述信息';
                }
            } catch (error) {
                console.error('获取模板预览失败:', error);
                if (templatePreviewImage) {
                    templatePreviewImage.innerHTML = '无法加载预览';
                }
                if (templateDescription) {
                    templateDescription.textContent = '无法加载模板信息';
                }
            }
        });
    }
    
    // 应用模板
    if (applyTemplateBtn) {
        applyTemplateBtn.addEventListener('click', async () => {
            const selectedTemplateId = templateSelect.value;
            if (!selectedTemplateId) {
                alert('请先选择一个模板');
                return;
            }
            
            // 防止重复点击
            if (isTemplateLoading) return;
            isTemplateLoading = true;
            applyTemplateBtn.disabled = true;
            applyTemplateBtn.textContent = '应用中...';
            
            try {
                // 向服务器发送请求应用模板
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'applyTemplate',
                        templateId: selectedTemplateId
                    }));
                    
                    // 等待服务器响应 (通过 WebSocket 消息接收)
                    // 延迟关闭选择器，给用户一些视觉反馈
                    setTimeout(() => {
                        templateSelector.style.display = 'none';
                        isTemplateLoading = false;
                        applyTemplateBtn.disabled = false;
                        applyTemplateBtn.textContent = '套用模板';
                    }, 1000);
                } else {
                    throw new Error('WebSocket 连接未建立或已关闭');
                }
            } catch (error) {
                console.error('应用模板失败:', error);
                alert(`应用模板失败: ${error.message}`);
                isTemplateLoading = false;
                applyTemplateBtn.disabled = false;
                applyTemplateBtn.textContent = '套用模板';
            }
        });
    }
}

// 当文档加载完成后初始化模板功能
document.addEventListener('DOMContentLoaded', () => {
    // 初始化模板选择器
    initTemplateSelector();
});