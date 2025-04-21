// enhanced-report-editor.js - 增加字節限制與提交限制功能

document.addEventListener('DOMContentLoaded', () => {
    console.log('增強型報告產生器初始化...');

    // --- DOM 元素獲取 ---
    const reportForm = document.getElementById('report-form');
    const reportTitleInput = document.getElementById('report-title');
    const htmlContentInput = document.getElementById('html-content');
    const saveButton = document.getElementById('save-button');
    const statusError = document.getElementById('status-error');
    const linkDisplayArea = document.getElementById('link-display-area');
    const generatedLinkInput = document.getElementById('generated-link');
    const copyLinkButton = document.getElementById('copy-link-button');
    
    // --- 配置常數 ---
    const MAX_BYTES = 50000; // 最大允許50,000字節
    const REMAINING_INFO_ID = 'bytes-remaining-info';
    const MAX_DAILY_REPORTS = 10; // 每日最大提交數量

    // --- 狀態變數 ---
    let isSubmitting = false;
    let currentSubmitCount = 0; // 當日提交計數

    // --- 輔助函數 ---
    const calculateByteSize = (text) => {
        // 使用 TextEncoder 計算 UTF-8 字節大小
        return new TextEncoder().encode(text).length;
    };

    const showError = (message) => {
        console.error('前端錯誤:', message);
        if (statusError) {
            statusError.textContent = message;
            statusError.style.display = 'block';
            
            // 添加動畫效果
            statusError.style.animation = 'none';
            setTimeout(() => {
                statusError.style.animation = 'slideDown 0.5s ease';
            }, 10);
        }
        if (linkDisplayArea) linkDisplayArea.style.display = 'none';
    };

    const clearError = () => {
        if (statusError) {
            statusError.textContent = '';
            statusError.style.display = 'none';
        }
    };

    const showGeneratedLink = (uuid) => {
        const reportViewPath = '/store/report/report-view.html';
        const fullUrl = `${window.location.origin}${reportViewPath}?id=${uuid}`;

        if (generatedLinkInput && linkDisplayArea) {
            generatedLinkInput.value = fullUrl;
            linkDisplayArea.style.display = 'block';
            
            // 添加動畫效果
            linkDisplayArea.style.animation = 'none';
            setTimeout(() => {
                linkDisplayArea.style.animation = 'slideDown 0.5s ease';
            }, 10);
            
            clearError();
            if (htmlContentInput) htmlContentInput.value = '';
            generatedLinkInput.focus();
            generatedLinkInput.select();
            
            // 增加本地提交計數
            incrementSubmitCount();
            
            // 添加完成音效 (可選)
            try {
                const audio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbsAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MUxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
                audio.play();
            } catch (e) {
                console.log('音效播放失敗，忽略此錯誤', e);
            }
        } else {
            console.error("連結顯示區域元素未找到！");
        }
    };

    // --- 計數功能 ---
    const getCurrentDate = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    const loadSubmitCount = () => {
        try {
            const savedData = localStorage.getItem('reportSubmitStats');
            if (savedData) {
                const data = JSON.parse(savedData);
                const today = getCurrentDate();
                if (data.date === today) {
                    currentSubmitCount = data.count;
                    return;
                }
            }
            // 如果是新的一天或沒有數據，重置計數
            resetSubmitCount();
        } catch (e) {
            console.error('讀取提交統計失敗:', e);
            resetSubmitCount();
        }
    };

    const saveSubmitCount = () => {
        try {
            const data = {
                date: getCurrentDate(),
                count: currentSubmitCount
            };
            localStorage.setItem('reportSubmitStats', JSON.stringify(data));
        } catch (e) {
            console.error('保存提交統計失敗:', e);
        }
    };

    const incrementSubmitCount = () => {
        currentSubmitCount++;
        saveSubmitCount();
        updateSubmitCountUI();
    };

    const resetSubmitCount = () => {
        currentSubmitCount = 0;
        saveSubmitCount();
    };

    const updateSubmitCountUI = () => {
        // 如果UI中有顯示提交計數的元素，可以在這裡更新它
        const remainingSubmits = MAX_DAILY_REPORTS - currentSubmitCount;
        const countInfoElement = document.getElementById('submit-count-info');
        
        if (countInfoElement) {
            countInfoElement.textContent = `今日還能提交 ${remainingSubmits} 次報告`;
            countInfoElement.style.color = remainingSubmits < 3 ? '#e53935' : '#4CAF50';
        }
    };

    // --- 主要功能函數 ---
    
    // 檢查並顯示剩餘字節數
    const updateRemainingBytes = () => {
        if (!htmlContentInput) return;
        
        const currentContent = htmlContentInput.value;
        const byteSize = calculateByteSize(currentContent);
        const remainingBytes = MAX_BYTES - byteSize;
        
        // 查找或創建顯示元素
        let bytesInfoElement = document.getElementById(REMAINING_INFO_ID);
        if (!bytesInfoElement) {
            bytesInfoElement = document.createElement('div');
            bytesInfoElement.id = REMAINING_INFO_ID;
            bytesInfoElement.style.marginTop = '8px';
            bytesInfoElement.style.fontSize = '0.9em';
            htmlContentInput.parentNode.insertBefore(bytesInfoElement, htmlContentInput.nextSibling);
        }
        
        // 更新顯示內容
        const percentUsed = Math.floor((byteSize / MAX_BYTES) * 100);
        bytesInfoElement.textContent = `已使用 ${byteSize.toLocaleString()} / ${MAX_BYTES.toLocaleString()} 字節 (${percentUsed}%)`;
        
        // 根據使用量改變顏色提示
        if (remainingBytes < 0) {
            bytesInfoElement.style.color = '#e53935'; // 紅色警告
            bytesInfoElement.textContent += ` - 超出 ${Math.abs(remainingBytes).toLocaleString()} 字節`;
        } else if (remainingBytes < MAX_BYTES * 0.1) {
            bytesInfoElement.style.color = '#FF9800'; // 橙色警告
        } else {
            bytesInfoElement.style.color = '#4CAF50'; // 綠色正常
        }
        
        return byteSize;
    };

    // 處理表單提交
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        if (isSubmitting) {
            console.log("正在提交，請稍候...");
            return;
        }

        // 檢查今日提交次數
        if (currentSubmitCount >= MAX_DAILY_REPORTS) {
            showError(`超出每日提交限制 (${MAX_DAILY_REPORTS} 次)。請明天再試或聯繫管理員。`);
            return;
        }

        const title = reportTitleInput?.value.trim() || "guest";
        const htmlContent = htmlContentInput?.value;

        // 檢查內容是否為空
        if (typeof htmlContent !== 'string' || htmlContent.length === 0) {
            showError('HTML 內容不能為空！');
            htmlContentInput?.focus();
            return;
        }
        
        // 檢查字節大小限制
        const byteSize = calculateByteSize(htmlContent);
        if (byteSize > MAX_BYTES) {
            const exceededBy = byteSize - MAX_BYTES;
            showError(`HTML 內容超出大小限制 ${exceededBy.toLocaleString()} 字節。請減少內容後再試。`);
            htmlContentInput?.focus();
            return;
        }

        isSubmitting = true;
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = '儲存中...';
            saveButton.style.background = '#FFA726';
        }
        clearError();
        if (linkDisplayArea) linkDisplayArea.style.display = 'none';

        const url = '/api/reports';
        const method = 'POST';
        const bodyData = { 
            title, 
            html_content: htmlContent,
            size_bytes: byteSize // 發送字節大小給後端
        };

        console.log(`發送 ${method} 請求到 ${url}`);

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData),
            });

            const result = await response.json();
            console.log('後端回應:', result);

            if (!response.ok) {
                throw new Error(result.error || `儲存失敗 (${response.status})`);
            }

            if (result.success && result.id) {
                 showGeneratedLink(result.id);
            } else {
                 throw new Error('儲存成功，但後端未返回有效的報告 ID。');
            }

        } catch (err) {
            console.error('儲存報告時發生錯誤:', err);
            showError(`儲存失敗：${err.message || '請檢查網路連線或聯繫管理員。'}`);
        } finally {
             if (saveButton) {
                 saveButton.textContent = '儲存並產生分享連結';
                 saveButton.disabled = false;
                 saveButton.style.background = '#FFB74D';
             }
             isSubmitting = false;
        }
    };

    // 複製連結按鈕功能
    const handleCopyLink = () => {
        if (!generatedLinkInput || !generatedLinkInput.value) return;

        generatedLinkInput.select();
        generatedLinkInput.setSelectionRange(0, 99999);

        try {
            navigator.clipboard.writeText(generatedLinkInput.value).then(() => {
                if(copyLinkButton) {
                    copyLinkButton.textContent = '已複製! ✓';
                    copyLinkButton.style.backgroundColor = '#4CAF50';
                    setTimeout(() => {
                        if(copyLinkButton) {
                            copyLinkButton.textContent = '複製連結';
                            copyLinkButton.style.backgroundColor = '#90CAF9';
                        }
                    }, 1500);
                }
            }).catch(err => {
                console.warn('Clipboard API 複製失敗:', err, '嘗試使用舊方法...');
                const successful = document.execCommand('copy');
                if (successful) {
                    if(copyLinkButton) {
                        copyLinkButton.textContent = '已複製! ✓';
                        copyLinkButton.style.backgroundColor = '#4CAF50';
                        setTimeout(() => {
                            if(copyLinkButton) {
                                copyLinkButton.textContent = '複製連結';
                                copyLinkButton.style.backgroundColor = '#90CAF9';
                            }
                        }, 1500);
                    }
                } else {
                    console.error('document.execCommand 複製也失敗');
                    alert('自動複製失敗，請手動選取並複製連結。');
                }
            });
        } catch (err) {
            console.error('複製操作出錯:', err);
            alert('自動複製失敗，請手動選取並複製連結。');
        }
    };

    // --- 初始化 ---
    // 加載提交計數
    loadSubmitCount();
    updateSubmitCountUI();
    
    // 創建並添加提交計數顯示元素
    const createSubmitCountElement = () => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        formGroup.style.marginTop = '15px';
        
        const countInfo = document.createElement('div');
        countInfo.id = 'submit-count-info';
        countInfo.style.fontWeight = 'bold';
        countInfo.style.textAlign = 'right';
        
        formGroup.appendChild(countInfo);
        
        // 尋找保存按鈕並在前面插入這個元素
        if (saveButton && saveButton.parentNode) {
            saveButton.parentNode.insertBefore(formGroup, saveButton);
        }
        
        updateSubmitCountUI();
    };
    
    createSubmitCountElement();
    
    // --- 事件監聽器綁定 ---
    if (htmlContentInput) {
        // 添加輸入事件來更新字節計數
        htmlContentInput.addEventListener('input', updateRemainingBytes);
        // 初始更新一次
        updateRemainingBytes();
        
        // 添加動畫效果
        htmlContentInput.addEventListener('focus', () => {
            htmlContentInput.style.transition = 'all 0.3s';
            htmlContentInput.style.transform = 'scale(1.01)';
        });
        htmlContentInput.addEventListener('blur', () => {
            htmlContentInput.style.transform = 'scale(1)';
        });
    }

    if (reportForm) {
        reportForm.addEventListener('submit', handleFormSubmit);
    } else {
        console.error('錯誤：找不到 ID 為 "report-form" 的表單元素。');
    }

    if (copyLinkButton) {
        copyLinkButton.addEventListener('click', handleCopyLink);
    } else {
        console.error('錯誤：找不到 ID 為 "copy-link-button" 的按鈕元素。');
    }

    console.log('增強型報告產生器 JS 初始化完成。');
}); // End of DOMContentLoaded