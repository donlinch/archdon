// report-viewer.js 修改版
document.addEventListener('DOMContentLoaded', async () => {
    console.log("報告檢視器初始化 (修復版)...");

    // --- DOM 元素獲取 ---
    const container = document.getElementById('report-container');
    const printButton = document.getElementById('print-report-btn');
    const controlsDiv = document.getElementById('controls');
    const reportTitle = document.querySelector('.controls-title'); // 如果有這個元素

    // --- 輔助函數 ---
    const showError = (message) => {
        console.error("檢視器錯誤:", message);
        if (container) {
            container.innerHTML = `
                <div class="error">
                    <div class="error-icon">⚠️</div>
                    <p>錯誤：${message}</p>
                    <button onclick="location.reload()" style="margin-top:15px; padding:8px 16px; background-color:#f44336; color:white; border:none; border-radius:20px; cursor:pointer;">重新載入</button>
                </div>`;
        }
        if (controlsDiv) controlsDiv.style.display = 'none';
    };
    
    const showLoading = () => {
        if (container) {
            container.innerHTML = `
                <div class="loading">
                    <div class="loading-icon">🎀</div>
                    <p>正在載入報告...</p>
                </div>`;
        }
    };

    // --- 主要邏輯 ---
    if (!container) {
        console.error("關鍵錯誤：找不到 ID 為 'report-container' 的容器元素。");
        document.body.innerHTML = '<div class="error" style="padding:30px; text-align:center; color:#e53935; font-weight:bold;">頁面載入錯誤，缺少必要元件。</div>';
        return;
    }

    // 1. 從 URL 查詢參數中獲取報告 ID
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('id');

    if (!reportId) {
        showError('網址中缺少報告 ID。');
        return;
    }
    console.log(`獲取到的報告 ID: ${reportId}`);

    // 更新頁面標題
    document.title = `報告檢視 (${reportId.substring(0, 8)}...)`;
    if (reportTitle) {
        reportTitle.textContent = `報告檢視 (#${reportId.substring(0, 8)}...)`;
    }

    // 顯示載入動畫
    showLoading();

    try {
        // 2. 向後端 API 發送請求
        const apiUrl = `/api/reports/${reportId}`;
        console.log(`正在從 ${apiUrl} 獲取報告數據...`);

        const response = await fetch(apiUrl);
        console.log(`後端回應狀態: ${response.status}`);

        if (!response.ok) {
            let errorMsg = `無法載入報告 (錯誤 ${response.status})`;
            try {
                const errData = await response.json();
                errorMsg = errData.error || errorMsg;
            } catch {}
            throw new Error(errorMsg);
        }

        const reportData = await response.json();

        // 3. 清空容器
        container.innerHTML = '';

        // 4. 檢查有效的 HTML 內容
        if (reportData && typeof reportData.html_content === 'string') {
            console.log("成功獲取 HTML 內容，準備創建 iframe...");

            // 5. 創建 iframe
            const iframe = document.createElement('iframe');
            iframe.id = 'report-iframe';
            iframe.style.opacity = '1'; // 確保 iframe 可見
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';

            // 6. 添加到容器中 (先添加，再設置內容)
            container.appendChild(iframe);

            // 7. 添加 load 事件處理
            iframe.onload = function() {
                console.log("iframe 內容已完全載入");
                iframe.style.opacity = '1';
                
                // 顯示控制列
                if (controlsDiv) {
                    controlsDiv.style.display = 'flex';
                }
                
                // 啟用列印按鈕
                if (printButton) {
                    printButton.disabled = false;
                }
            };

            // 8. 設置 iframe 內容 
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(reportData.html_content);





            
            iframeDoc.close();

            // 9. 更新標題
            if (reportTitle && reportData.title) {
                reportTitle.textContent = reportData.title;
                document.title = `${reportData.title} - 報告檢視`;
            }

            // 10. 處理列印按鈕
            if (printButton) {
                printButton.onclick = () => {
                    if (iframe && iframe.contentWindow) {
                        try {
                            iframe.contentWindow.focus();
                            iframe.contentWindow.print();
                            console.log("已觸發 iframe 列印。");
                        } catch (e) {
                            console.error("無法觸發 iframe 列印:", e);
                            alert("無法自動觸發列印。請嘗試右鍵點擊報告區域選擇列印。");
                        }
                    } else {
                        alert("報告內容似乎尚未完全載入，暫時無法列印。");
                    }
                };
            }

        } else {
            showError('報告內容為空或格式不正確。');
        }

    } catch (err) {
        console.error('載入或顯示報告時發生錯誤:', err);
        showError(`載入報告失敗：${err.message}`);
    }
}); // End of DOMContentLoaded