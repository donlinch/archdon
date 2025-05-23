// /public/js/report-editor.js (美化版 - 增強互動)

document.addEventListener('DOMContentLoaded', () => {
    console.log('報告產生器初始化 (美化版)...');

    // --- DOM 元素獲取 ---
    const reportForm = document.getElementById('report-form');
    const reportTitleInput = document.getElementById('report-title');
    const htmlContentInput = document.getElementById('html-content');
    const saveButton = document.getElementById('save-button');
    const statusError = document.getElementById('status-error'); // 顯示錯誤
    const linkDisplayArea = document.getElementById('link-display-area');
    const generatedLinkInput = document.getElementById('generated-link');
    const copyLinkButton = document.getElementById('copy-link-button');

    // --- 狀態變數 ---
    let isSubmitting = false;

    // --- 輔助函數 ---
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
        if (linkDisplayArea) linkDisplayArea.style.display = 'none'; // 出錯時隱藏連結區
    };

    const clearError = () => {
        if (statusError) {
            statusError.textContent = '';
            statusError.style.display = 'none';
        }
    };

    const showGeneratedLink = (uuid) => {
        // *** 組裝檢視頁面的完整 URL ***
        // *** 請確保這個路徑與您 report-view.html 實際存放的路徑一致 ***
        const reportViewPath = '/store/report/report-view.html';
        const fullUrl = `${window.location.origin}${reportViewPath}?id=${uuid}`;

        if (generatedLinkInput && linkDisplayArea) {
            generatedLinkInput.value = fullUrl;
            linkDisplayArea.style.display = 'block'; // 顯示連結區域
            
            // 添加動畫效果
            linkDisplayArea.style.animation = 'none';
            setTimeout(() => {
                linkDisplayArea.style.animation = 'slideDown 0.5s ease';
            }, 10);
            
            clearError();
            // 清空 HTML 內容輸入框以便產生下一個 (但保持隱藏的標題欄位不變)
            if (htmlContentInput) htmlContentInput.value = '';
            // 聚焦並選取連結，方便複製
            generatedLinkInput.focus();
            generatedLinkInput.select();
            
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

    // --- 主要功能函數 ---

    // 處理表單提交 (只處理新增)
    const handleFormSubmit = async (event) => {
        event.preventDefault(); // 阻止表單的預設提交
        if (isSubmitting) {
            console.log("正在提交，請稍候...");
            return;
        }

        // 使用預設標題 "guest"，從隱藏欄位獲取
        const title = reportTitleInput?.value.trim() || "guest";
        const htmlContent = htmlContentInput?.value;

        // 只檢查 HTML 內容是否為空
        if (typeof htmlContent !== 'string' || htmlContent.length === 0) { // 確保內容不是空字串
            showError('HTML 內容不能為空！');
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

        // *** API 路徑確認是 /api/reports ***
        const url = '/api/reports';
        const method = 'POST';
        const bodyData = { title, html_content: htmlContent };

        console.log(`發送 ${method} 請求到 ${url}`);

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData),
            });

            const result = await response.json(); // 等待並解析 JSON
            console.log('後端回應:', result);

            if (!response.ok) {
                // 如果回應狀態不是 2xx，則拋出錯誤
                throw new Error(result.error || `儲存失敗 (${response.status})`);
            }

            // 檢查後端是否成功返回包含 UUID 的資料
            if (result.success && result.id) {
                 showGeneratedLink(result.id); // 顯示連結
            } else {
                 // 如果後端回應成功但資料格式不對
                 throw new Error('儲存成功，但後端未返回有效的報告 ID。');
            }

        } catch (err) {
            console.error('儲存報告時發生錯誤:', err);
            showError(`儲存失敗：${err.message || '請檢查網路連線或聯繫管理員。'}`);
        } finally {
             // 無論請求成功或失敗，最後都要恢復按鈕狀態
             if (saveButton) {
                 saveButton.textContent = '儲存並產生分享連結';
                 saveButton.disabled = false;
                 saveButton.style.background = '#FFB74D';
             }
             isSubmitting = false; // 重設提交狀態
        }
    };

    // 複製連結按鈕功能
    const handleCopyLink = () => {
        if (!generatedLinkInput || !generatedLinkInput.value) return;

        generatedLinkInput.select(); // 選取輸入框中的文本
        generatedLinkInput.setSelectionRange(0, 99999); // 對於移動設備

        try {
            // 優先使用 navigator.clipboard API
            navigator.clipboard.writeText(generatedLinkInput.value).then(() => {
                if(copyLinkButton) {
                    copyLinkButton.textContent = '已複製! ✓';
                    copyLinkButton.style.backgroundColor = '#4CAF50';
                    setTimeout(() => {
                        if(copyLinkButton) {
                            copyLinkButton.textContent = '複製連結';
                            copyLinkButton.style.backgroundColor = '#90CAF9';
                        }
                    }, 1500); // 1.5秒後恢復
                }
            }).catch(err => {
                console.warn('Clipboard API 複製失敗:', err, '嘗試使用舊方法...');
                // 降級使用 document.execCommand
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

    // --- 事件監聽器綁定 ---
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

    // 添加動畫效果和互動 (僅保留 HTML 內容的互動效果)
    if (htmlContentInput) {
        htmlContentInput.addEventListener('focus', () => {
            htmlContentInput.style.transition = 'all 0.3s';
            htmlContentInput.style.transform = 'scale(1.01)';
        });
        htmlContentInput.addEventListener('blur', () => {
            htmlContentInput.style.transform = 'scale(1)';
        });
    }

    console.log('報告產生器 JS 初始化完成。');

}); // End of DOMContentLoaded