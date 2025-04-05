// public/score-viewer.js
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

// 設定 Worker (使用 mjs 版本)
if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';
        console.log('PDF.js workerSrc 設定為 mjs 版本。');
    } catch (e) { console.warn('無法設定 PDF.js workerSrc:', e); }
} else { console.warn('PDF.js GlobalWorkerOptions 無法設定。'); }

// --- DOM 元素獲取 ---
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) { console.error(`錯誤: 找不到元素 ID "${id}"`); }
    return element;
}
const viewerTitle = getElement('viewer-title');
const mainYoutubePlayerContainer = getElement('youtube-player-viewer'); // 主要影片容器
const pdfOrAltContainer = getElement('pdf-or-alt-container'); // PDF 或替代內容的容器
const contentLoading = getElement('content-loading-viewer'); // 通用 Loading
const contentError = getElement('content-error-viewer'); // 通用錯誤
const alternativeVideoViewer = getElement('alternative-video-viewer'); // 替代影片容器
const pdfCanvas = getElement('pdf-canvas-viewer'); // PDF 畫布
const pdfPagination = getElement('pdf-pagination-viewer'); // PDF 分頁
const pdfPrevBtn = getElement('pdf-prev-viewer');
const pdfNextBtn = getElement('pdf-next-viewer');
const pdfPageNum = getElement('pdf-page-num-viewer');
const pdfPageCount = getElement('pdf-page-count-viewer');
const printBtn = getElement('print-score-btn');

// --- 狀態變數 ---
let currentPdfDoc = null;
let currentPageNum = 1;
let pdfPageRendering = false;
let pageNumPending = null;
let currentMusicData = null; // 儲存歌曲資料
let currentScoreData = null; // 儲存當前樂譜資料

// --- 從 URL 獲取參數 ---
const urlParams = new URLSearchParams(window.location.search);
const musicId = urlParams.get('musicId');
const scoreId = urlParams.get('scoreId');

// --- Helper: 從 URL 提取 YouTube ID ---
function extractYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;
    let videoId = null;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com')) {
            videoId = urlObj.searchParams.get('v');
        } else if (urlObj.hostname.includes('youtu.be')) {
            videoId = urlObj.pathname.slice(1); // Remove leading '/'
        }
        // Remove extra parameters like playlist info if present after '&'
        if (videoId && videoId.includes('&')) {
            videoId = videoId.split('&')[0];
        }
    } catch (e) {
        console.warn("無法解析 URL 或提取 YouTube ID:", url, e);
        // Fallback for simple regex check if URL parsing fails or for non-standard formats
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        if (match) videoId = match[1];
    }
    return videoId;
}


// --- 渲染主要 YouTube ---
function renderMainYouTube(videoId, title) {
    if (!mainYoutubePlayerContainer) return;
    mainYoutubePlayerContainer.style.display = 'block'; // 顯示主要影片容器
    if (videoId) {
        mainYoutubePlayerContainer.innerHTML = `
            <iframe
                src="https://www.youtube.com/embed/${videoId}"
                title="主要影片: ${title || ''}"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen>
            </iframe>`;
    } else {
        mainYoutubePlayerContainer.innerHTML = '<p>此歌曲沒有提供主要 YouTube 影片。</p>';
    }
}

// --- 渲染替代內容區域的 YouTube ---
function renderAlternativeVideo(videoId, title) {
    if (!alternativeVideoViewer || !pdfOrAltContainer) return;

    // 確保容器可見，並隱藏其他內容
    pdfOrAltContainer.style.display = 'flex';
    alternativeVideoViewer.style.display = 'block';
    if (pdfCanvas) pdfCanvas.style.display = 'none';
    if (pdfPagination) pdfPagination.style.display = 'none';
    if (contentError) contentError.style.display = 'none';
    if (contentLoading) contentLoading.style.display = 'none';

    alternativeVideoViewer.innerHTML = `
        <iframe
            src="https://www.youtube.com/embed/${videoId}"
            title="樂譜替代內容: ${title || ''}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen>
        </iframe>`;
}

// --- 顯示內容區域的錯誤訊息 ---
function showContentError(message) {
     if (!contentError || !pdfOrAltContainer) return;
     pdfOrAltContainer.style.display = 'flex'; // 顯示容器以展示錯誤
     contentError.textContent = message;
     contentError.style.display = 'block';

     // 隱藏其他可能的內容
     if (alternativeVideoViewer) alternativeVideoViewer.style.display = 'none';
     if (pdfCanvas) pdfCanvas.style.display = 'none';
     if (pdfPagination) pdfPagination.style.display = 'none';
     if (contentLoading) contentLoading.style.display = 'none';
}


// --- PDF.js 相關函數 (基本不變，但加強 show/hide 控制) ---
async function loadPdf(encodedPdfUrl) {
    // 檢查必要元素
    const required = [contentLoading, contentError, pdfCanvas, pdfOrAltContainer, pdfPagination, pdfPrevBtn, pdfNextBtn, pdfPageNum, pdfPageCount];
    if (required.some(el => !el)) {
        console.error("loadPdf: 缺少必要的 DOM 元素。");
        showContentError("頁面元件載入不全，無法顯示 PDF。");
        return;
    }
     if (!encodedPdfUrl || typeof encodedPdfUrl !== 'string') {
        showContentError("無效的 PDF 連結。");
        return;
     }

    console.log("loadPdf: 開始載入 PDF...");
    pdfOrAltContainer.style.display = 'flex'; // 確保容器可見
    contentLoading.style.display = 'block';   // 顯示 Loading
    contentError.style.display = 'none';      // 隱藏舊錯誤
    pdfCanvas.style.display = 'none';         // 隱藏 Canvas
    pdfPagination.style.display = 'none';     // 隱藏分頁
    alternativeVideoViewer.style.display = 'none'; // 隱藏替代影片

    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;
    pdfPageNum.textContent = '-';
    pdfPageCount.textContent = '-';
    currentPdfDoc = null;
    currentPageNum = 1;

    const proxyUrl = `/api/scores/proxy?url=${encodedPdfUrl}`;
    console.log("loadPdf: 透過代理請求 PDF:", proxyUrl);

    try {
        const loadingTask = pdfjsLib.getDocument({
             url: proxyUrl,
             cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/', // 確保 cMap 路徑正確
             cMapPacked: true,
        });
        currentPdfDoc = await loadingTask.promise;
        console.log('loadPdf: PDF 載入成功. 頁數:', currentPdfDoc.numPages);
        contentLoading.style.display = 'none'; // 載入成功，隱藏 Loading
        pdfPageCount.textContent = currentPdfDoc.numPages;
        // renderPage 會負責顯示 Canvas 和 Pagination
        renderPage(currentPageNum);
    } catch (reason) {
        console.error('loadPdf: 載入 PDF 時出錯:', reason);
        contentLoading.style.display = 'none'; // 出錯也要隱藏 Loading
        let errorText = `無法載入 PDF。請檢查連結是否有效或稍後再試。`;
        if (reason && reason.message) {
            // 檢查是否是代理 403 錯誤
            if (reason.message.includes("Unexpected server response (403)")) {
                 errorText += ` (代理拒絕存取來源檔案)`;
            } else {
                 errorText += ` (錯誤: ${reason.message})`;
            }
        } else if (typeof reason === 'string') {
             errorText += ` (${reason})`;
        }
         showContentError(errorText); // 使用通用錯誤顯示函數
    }
}

function renderPage(num) {
    if (!currentPdfDoc || !pdfCanvas || !pdfOrAltContainer || !pdfPageNum || !pdfPrevBtn || !pdfNextBtn) {
        console.error("renderPage: 缺少 PDF 文件或必要 DOM 元素。");
        return; // 避免後續錯誤
    }
    pdfPageRendering = true;
    pdfPageNum.textContent = num;
    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;

     // 確保 PDF 相關元素可見，替代影片隱藏
     pdfCanvas.style.display = 'block'; // 準備渲染前顯示 Canvas
     pdfPagination.style.display = 'flex'; // 顯示分頁
     alternativeVideoViewer.style.display = 'none';
     contentError.style.display = 'none';

    currentPdfDoc.getPage(num).then(function(page) {
        console.log(`[renderPage] 獲取到頁面 ${num} 物件，準備渲染。`);
        requestAnimationFrame(() => {
             let containerWidth = pdfOrAltContainer.clientWidth;
             if (containerWidth <= 0) {
                 console.warn(`[renderPage] PDF 容器寬度無效，使用 90vw 後備。`);
                 containerWidth = window.innerWidth * 0.9;
             }
             const viewportOriginal = page.getViewport({ scale: 1 });
             const scale = (viewportOriginal.width > 0 && containerWidth > 0) ? containerWidth / viewportOriginal.width : 1;
             const viewport = page.getViewport({ scale: scale });
             renderPageWithViewport(page, viewport, num);
        });
    }).catch(function(pageError){
         console.error(`[renderPage] 獲取頁面 ${num} 時出錯:`, pageError);
         showContentError(`讀取 PDF 頁面 ${num} 失敗。`);
         pdfPageRendering = false;
         if(pdfCanvas) pdfCanvas.style.display = 'none'; // 出錯隱藏 Canvas
         if(pdfPagination) pdfPagination.style.display = 'none'; // 出錯隱藏分頁
         // 保持按鈕狀態（可選）
         // if(pdfPrevBtn) pdfPrevBtn.disabled = (num <= 1);
         // if(currentPdfDoc && pdfNextBtn) pdfNextBtn.disabled = (num >= currentPdfDoc.numPages);
    });
}

function renderPageWithViewport(page, viewport, pageNumber) {
     // 檢查元素
    if (!pdfCanvas || !pdfPagination || !pdfPrevBtn || !pdfNextBtn) {
        console.error("[renderPageWithViewport] 缺少 Canvas 或分頁元素。");
        pdfPageRendering = false;
        return;
    }
    const canvasContext = pdfCanvas.getContext('2d');
    if (!canvasContext) {
        showContentError('無法渲染 PDF (Canvas Context Error)。');
        pdfPageRendering = false;
        pdfCanvas.style.display = 'none'; // 隱藏 Canvas
        pdfPagination.style.display = 'none'; // 隱藏分頁
        return;
    }

    // 確保 Canvas 和分頁可見，隱藏錯誤和替代影片
    pdfCanvas.style.display = 'block';
    pdfPagination.style.display = 'flex';
    alternativeVideoViewer.style.display = 'none';
    contentError.style.display = 'none';

    pdfCanvas.height = Math.ceil(viewport.height);
    pdfCanvas.width = Math.ceil(viewport.width);
    console.log(`[renderPageWithViewport] 設定 canvas 尺寸: W=${pdfCanvas.width}, H=${pdfCanvas.height}`);

    const renderContext = { canvasContext: canvasContext, viewport: viewport };
    const renderTask = page.render(renderContext);

    renderTask.promise.then(function() {
        console.log(`[renderPageWithViewport] 頁面 ${pageNumber} 渲染完成`);
        pdfPageRendering = false;
        pdfPrevBtn.disabled = (pageNumber <= 1);
        pdfNextBtn.disabled = (!currentPdfDoc || pageNumber >= currentPdfDoc.numPages); // 修正 Next 按鈕禁用條件
        if (pageNumPending !== null) {
            console.log(`[renderPageWithViewport] 處理待定頁面: ${pageNumPending}`);
            renderPage(pageNumPending);
            pageNumPending = null;
        }
    }).catch(function(renderError) {
        console.error(`[renderPageWithViewport] 渲染頁面 ${pageNumber} 時出錯:`, renderError);
        showContentError(`渲染 PDF 頁面 ${pageNumber} 失敗。`);
        pdfPageRendering = false;
        pdfCanvas.style.display = 'none'; // 渲染出錯隱藏 Canvas
        pdfPagination.style.display = 'none'; // 渲染出錯隱藏分頁
    });
}

function queueRenderPage(num) {
    if (pdfPageRendering) { pageNumPending = num; } else { renderPage(num); }
}

function onPrevPage() {
    if (currentPageNum <= 1) return;
    currentPageNum--;
    queueRenderPage(currentPageNum);
}

function onNextPage() {
    if (!currentPdfDoc || currentPageNum >= currentPdfDoc.numPages) return;
    currentPageNum++;
    queueRenderPage(currentPageNum);
}

// --- 初始化頁面 ---
async function initializeViewer() {
    // 初始隱藏所有內容區
    if(mainYoutubePlayerContainer) mainYoutubePlayerContainer.style.display = 'none';
    if(pdfOrAltContainer) pdfOrAltContainer.style.display = 'none';
    // 不需要在開始時顯示 loading，由後續邏輯決定

    if (!musicId || !scoreId) {
        if (viewerTitle) viewerTitle.textContent = '錯誤';
        // 可以顯示一個全局錯誤，或利用 contentError
        showContentError('錯誤：缺少歌曲 ID 或樂譜 ID。');
        console.error('缺少 musicId 或 scoreId');
        return;
    }

    try {
        // 獲取歌曲數據
        const response = await fetch(`/api/music/${musicId}`);
        if (!response.ok) throw new Error(`無法獲取歌曲資料 (HTTP ${response.status})`);
        currentMusicData = await response.json();

        if (!currentMusicData || !Array.isArray(currentMusicData.scores)) {
            throw new Error('找不到歌曲資料或樂譜列表格式錯誤。');
        }

        // 找到目標樂譜
        currentScoreData = currentMusicData.scores.find(s => s && s.id !== undefined && s.id.toString() === scoreId);

        if (!currentScoreData) {
            throw new Error(`在歌曲 ${musicId} 中找不到樂譜 ID ${scoreId}。`);
        }

        const scoreUrl = currentScoreData.pdf_url; // 獲取 URL
        const mainVideoId = currentMusicData.youtube_video_id; // 獲取主要影片 ID
        const scoreType = currentScoreData.type || '檢視';
        const musicTitle = currentMusicData.title || '樂譜';

        // 更新頁面標題和 Header
        document.title = `${musicTitle} - ${scoreType} | SunnyYummy`;
        if (viewerTitle) viewerTitle.textContent = `${musicTitle} - ${scoreType}`;

        // 1. 始終嘗試渲染主要影片 (如果存在)
        renderMainYouTube(mainVideoId, musicTitle);

        // 2. 處理 PDF 或替代內容區域
        pdfOrAltContainer.style.display = 'flex'; // 顯示下方容器框架
        let isPdf = false;
        if (scoreUrl && typeof scoreUrl === 'string') {
             isPdf = scoreUrl.toLowerCase().trim().endsWith('.pdf');
             console.log(`檢查樂譜 URL: "${scoreUrl}", 是否為 PDF: ${isPdf}`);
        } else {
            console.log("樂譜 URL 為空或非字串。");
        }

        if (isPdf) {
            // --- 顯示 PDF ---
            console.log("操作: 顯示 PDF。");
            // loadPdf 會處理 loading 和內部元素的顯示/隱藏
            loadPdf(encodeURIComponent(scoreUrl));
        } else {
            // --- 嘗試顯示替代內容 (YouTube) ---
            console.log("操作: 嘗試顯示替代內容 (非 PDF)。");
            const alternativeVideoId = extractYouTubeId(scoreUrl); // 嘗試從 scoreUrl 提取 ID

            if (alternativeVideoId) {
                console.log(`操作: 找到替代 YouTube 影片 ID (${alternativeVideoId})，顯示影片。`);
                renderAlternativeVideo(alternativeVideoId, scoreType); // 使用 scoreType 作為替代影片標題的一部分
            } else {
                // --- 非 PDF，也無法提取 YouTube ID ---
                 console.log("操作: 樂譜 URL 非 PDF 且無法識別為 YouTube 連結。");
                 let errorMsg = `指定的樂譜內容 (${scoreType}) 不是有效的 PDF 檔案`;
                 if(scoreUrl) errorMsg += `，提供的連結也不是可識別的 YouTube 影片連結。`;
                 else errorMsg += `，且未提供有效連結。`;
                 showContentError(errorMsg);
            }
        }

    } catch (error) {
        console.error("初始化樂譜檢視器失敗:", error);
        if (viewerTitle) viewerTitle.textContent = '載入錯誤';
        showContentError(`頁面載入失敗：${error.message}`);
        // 確保主要影片區也處理錯誤 (如果需要)
        if(!mainYoutubePlayerContainer || mainYoutubePlayerContainer.style.display === 'none') {
           renderMainYouTube(null, "主要影片載入失敗"); // 顯示錯誤提示
        }
    }
}

// --- 事件監聽器 ---
document.addEventListener('DOMContentLoaded', () => {
    // 確保在呼叫 initializeViewer 前，DOM 元素已存在
    const requiredElements = [
        viewerTitle, mainYoutubePlayerContainer, pdfOrAltContainer, contentLoading, contentError,
        alternativeVideoViewer, pdfCanvas, pdfPagination, pdfPrevBtn, pdfNextBtn,
        pdfPageNum, pdfPageCount, printBtn
    ];
    if (requiredElements.some(el => !el)) {
        console.error("頁面初始化失敗：缺少必要的 DOM 元素。請檢查 score-viewer.html 的 ID 是否正確。");
        document.body.innerHTML = '<p style="color:red; padding: 2rem; text-align: center;">頁面載入錯誤，缺少必要的元件。</p>';
        return;
    }

    initializeViewer(); // DOM 加載後才開始初始化

    if (pdfPrevBtn) pdfPrevBtn.addEventListener('click', onPrevPage);
    if (pdfNextBtn) pdfNextBtn.addEventListener('click', onNextPage);
    if (printBtn) printBtn.addEventListener('click', () => {
        // 列印前確保 PDF Canvas 是主要的顯示內容（如果當前顯示的是替代影片，列印會是空白）
        if (currentPdfDoc && pdfCanvas.style.display === 'block') {
             window.print();
        } else if (currentPdfDoc) {
            alert("請先確保 PDF 樂譜已載入並顯示，才能進行列印。");
        } else {
            alert("沒有可列印的 PDF 樂譜內容。");
        }
    });
});