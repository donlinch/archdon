// /public/js/report-viewer.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM 元素獲取 ---
    const container = document.getElementById('report-container');
    const printButton = document.getElementById('print-report-btn');
    const controlsDiv = document.getElementById('controls'); // (可選) 控制列容器

    // --- 輔助函數 ---
    const showError = (message) => {
        if (container) {
            container.innerHTML = `<p class="error">錯誤：${message}</p>`;
        }
        // 發生錯誤時隱藏控制列或列印按鈕
        if (controlsDiv) controlsDiv.style.display = 'none';
    };

    // --- 主要邏輯 ---
    if (!container) {
        console.error("錯誤：找不到 ID 為 'report-container' 的元素。");
        // 可以在頁面上顯示更明顯的錯誤
        document.body.innerHTML = '<p class="error">頁面結構錯誤，無法顯示報告。</p>';
        return;
    }

    // 1. 從 URL 查詢參數中獲取報告 ID
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('id');

    if (!reportId) {
        showError('網址中缺少報告 ID。');
        return;
    }

    // (可選) 動態設定頁面標題
    document.title = `報告檢視 (ID: ${reportId})`;

    // 初始顯示載入中訊息 (HTML 中已有，這裡確保 JS 知道初始狀態)
    // container.innerHTML = '<p class="loading">正在載入報告...</p>';

    try {
        // 2. 向後端 API 發送 GET 請求獲取報告內容
        const response = await fetch(`/api/reports/${reportId}`); // 使用之前定義的 API

        if (!response.ok) {
            let errorMsg = `無法載入報告 (錯誤 ${response.status})`;
            try {
                // 嘗試解析後端返回的 JSON 錯誤訊息
                const errData = await response.json();
                errorMsg = errData.error || errorMsg;
            } catch {
                // 如果後端沒有返回 JSON 或解析失敗，使用狀態碼
            }
            throw new Error(errorMsg);
        }

        const reportData = await response.json(); // 解析成功的 JSON 回應

        // 3. 清空容器，準備放入 iframe
        container.innerHTML = '';

        // 4. 檢查是否有 HTML 內容
        if (reportData && typeof reportData.html_content === 'string') {

            // 5. 創建 iframe 元素
            const iframe = document.createElement('iframe');
            iframe.id = 'report-iframe'; // 賦予 ID 以便 CSS 選取

            // 6. 使用 srcdoc 將 HTML 內容安全地載入 iframe
            // srcdoc 是顯示靜態 HTML 字串的推薦方式
            iframe.srcdoc = reportData.html_content;

            // 7. (可選) 添加 sandbox 屬性以增強安全性
            //    - 空字串 '' 或不設置：允許所有操作 (最不安全，但方便測試)
            //    - 'allow-scripts': 允許執行腳本
            //    - 'allow-same-origin': 允許 iframe 將其來源視為與父頁面相同 (需要時才開啟)
            //    - 'allow-forms': 允許提交表單
            //    - 'allow-popups': 允許彈出視窗
            // 根據您報告內容的需要和安全考量來配置 sandbox。如果只是顯示靜態 HTML/CSS，可以不加或設為較嚴格。
            // iframe.sandbox = 'allow-same-origin'; // 示例：只允許同源操作，禁止腳本

            // 8. 將 iframe 添加到容器 div 中
            container.appendChild(iframe);

            // 9. 處理列印按鈕
            if (printButton) {
                printButton.style.display = 'inline-block'; // 顯示列印按鈕
                printButton.onclick = () => {
                    if (iframe && iframe.contentWindow) {
                        try {
                            // 觸發 iframe 內部的列印對話框
                            iframe.contentWindow.focus(); // 嘗試聚焦
                            iframe.contentWindow.print();
                        } catch (e) {
                            console.error("無法觸發 iframe 列印:", e);
                            // 提示使用者可能需要手動列印
                            alert("無法自動觸發列印。您可能需要右鍵點擊報告內容區域選擇列印，或檢查瀏覽器設置。");
                        }
                    } else {   
                        alert("報告內容尚未完全載入，無法列印。");
                    }
                };
            } else {
                 console.warn("找不到 ID 為 'print-report-btn' 的列印按鈕。");
            }
             // 內容載入成功後顯示控制列
             if(controlsDiv) controlsDiv.style.display = 'block';


        } else {
            // 如果後端返回了數據，但沒有 html_content
            showError('報告內容為空或格式不正確。');
        }

    } catch (err) {
        console.error('載入報告失敗:', err);
        showError(`載入報告失敗：${err.message}`);
    }
}); // End of DOMContentLoaded