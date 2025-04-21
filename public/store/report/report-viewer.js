// /public/js/report-viewer.js (美化版)

document.addEventListener('DOMContentLoaded', async () => {
    console.log("報告檢視器初始化 (美化版)...");

    // --- DOM 元素獲取 ---
    const container = document.getElementById('report-container');
    const printButton = document.getElementById('print-report-btn');
    const controlsDiv = document.getElementById('controls');
    const reportTitle = document.getElementById('report-title');

    // --- 輔助函數 ---
    const showError = (message) => {
        console.error("檢視器錯誤:", message);
        if (container) {
            // 清空容器並顯示錯誤
            container.innerHTML = `
                <div class="error">
                    <div class="error-icon">⚠️</div>
                    <p>錯誤：${message}</p>
                    <button onclick="location.reload()" style="margin-top:15px; padding:8px 16px; background-color:#f44336; color:white; border:none; border-radius:20px; cursor:pointer;">重新載入</button>
                </div>`;
        }
        // 隱藏控制列
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

    // 1. 從 URL 查詢參數中獲取報告 ID (UUID)
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('id'); // 這個 id 應該是 UUID 字串

    if (!reportId) {
        showError('網址中缺少報告 ID。');
        return;
    }
    console.log(`獲取到的報告 ID (UUID): ${reportId}`);

    // (可選) 動態設定頁面標題和控制列標題
    document.title = `報告檢視 (${reportId.substring(0, 8)}...)`;
    if (reportTitle) {
        reportTitle.textContent = `報告檢視 (#${reportId.substring(0, 8)}...)`;
    }

    // 顯示載入動畫
    showLoading();

    try {
        // 2. 向後端 API 發送 GET 請求獲取報告內容
        // *** API 路徑確認是 /api/reports/:id ***
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

        // 3. 清空容器，準備放入 iframe
        container.innerHTML = '';

        // 4. 檢查是否有有效的 HTML 內容
        if (reportData && typeof reportData.html_content === 'string') {
            console.log("成功獲取 HTML 內容，準備創建 iframe...");

            // 5. 創建 iframe 元素
            const iframe = document.createElement('iframe');
            iframe.id = 'report-iframe';

            // 6. 使用 srcdoc 將 HTML 內容載入 iframe
            iframe.srcdoc = reportData.html_content;

            // 7. (可選) 添加 sandbox
            // iframe.sandbox = 'allow-same-origin'; // 例如

            // 8. 將 iframe 添加到容器中
            container.appendChild(iframe);

            // 9. 更新控制列標題（如果有更詳細的報告標題）
            if (reportTitle && reportData.title) {
                reportTitle.textContent = reportData.title;
                // 同時更新頁面標題
                document.title = `${reportData.title} - 報告檢視`;
            }

            // 10. 處理控制列和列印按鈕
            if (controlsDiv) {
                controlsDiv.style.display = 'flex'; // 顯示控制列
                
                // 添加淡入動畫
                controlsDiv.style.opacity = '0';
                setTimeout(() => {
                    controlsDiv.style.transition = 'opacity 0.5s ease';
                    controlsDiv.style.opacity = '1';
                }, 100);
            }
            
            if (printButton) {
                // 延遲一段時間再啟用按鈕，確保內容載入
                setTimeout(() => {
                    printButton.disabled = false; // 啟用列印按鈕
                }, 1000);
                
                printButton.onclick = () => {
                    if (iframe && iframe.contentWindow) {
                        try {
                            // 添加按鈕按下的視覺反饋
                            printButton.style.transform = 'scale(0.95)';
                            printButton.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
                            
                            setTimeout(() => {
                                printButton.style.transform = '';
                                printButton.style.boxShadow = '';
                                
                                iframe.contentWindow.focus();
                                iframe.contentWindow.print();
                                console.log("已觸發 iframe 列印。");
                            }, 150);
                        } catch (e) {
                            console.error("無法觸發 iframe 列印:", e);
                            alert("無法自動觸發列印。請嘗試右鍵點擊報告區域選擇列印。");
                        }
                    } else {
                        console.warn("無法列印，iframe 或其 contentWindow 不可用。");
                        alert("報告內容似乎尚未完全載入，暫時無法列印。");
                    }
                };
            } else {
                 console.warn("找不到列印按鈕元素。");
            }
            console.log("報告內容已載入 iframe。");

        } else {
            showError('報告內容為空或格式不正確。');
        }

    } catch (err) {
        console.error('載入或顯示報告時發生錯誤:', err);
        showError(`載入報告失敗：${err.message}`);
    }
    
    // 添加視窗大小調整處理
    window.addEventListener('resize', () => {
        // 如果需要對窗口大小變化做出反應，可以在這裡處理
        console.log('窗口大小已變更，適配新尺寸...');
    });
    
}); // End of DOMContentLoaded