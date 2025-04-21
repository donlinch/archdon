// /public/js/report-viewer.js (UUID Version)

document.addEventListener('DOMContentLoaded', async () => {
    console.log("報告檢視器初始化 (UUID 版本)...");

    // --- DOM 元素獲取 ---
    const container = document.getElementById('report-container');
    const printButton = document.getElementById('print-report-btn');
    const controlsDiv = document.getElementById('controls');

    // --- 輔助函數 ---
    const showError = (message) => {
        console.error("檢視器錯誤:", message);
        if (container) {
            // 清空容器並顯示錯誤
            container.innerHTML = `<p class="error">錯誤：${message}</p>`;
        }
        // 隱藏控制列
        if (controlsDiv) controlsDiv.style.display = 'none';
    };

    // --- 主要邏輯 ---
    if (!container) {
        console.error("關鍵錯誤：找不到 ID 為 'report-container' 的容器元素。");
        document.body.innerHTML = '<p class="error">頁面載入錯誤，缺少必要元件。</p>';
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

    // (可選) 動態設定頁面標題
    document.title = `報告檢視 (${reportId.substring(0, 8)}...)`; // 只顯示部分 UUID

    // 初始載入提示已在 HTML 中

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

            // 9. 處理控制列和列印按鈕
            if (controlsDiv) controlsDiv.style.display = 'block'; // 顯示控制列
            if (printButton) {
                printButton.disabled = false; // 啟用列印按鈕
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
}); // End of DOMContentLoaded