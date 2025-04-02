// public/score-viewer.js
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

// 設定 Worker (使用 mjs 版本)
if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';
        console.log('PDF.js workerSrc 設定為 mjs 版本。');
    } catch (e) { console.warn('無法設定 PDF.js workerSrc:', e); }
} else { console.warn('PDF.js GlobalWorkerOptions 無法設定。'); }

// --- DOM 元素獲取 (使用新 ID) ---
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) { console.error(`錯誤: 找不到元素 ID "${id}"`); }
    return element;
}
const viewerTitle = getElement('viewer-title');
const youtubePlayerContainer = getElement('youtube-player-viewer');
const pdfViewerContainer = getElement('pdf-viewer-container-viewer');
const pdfCanvas = getElement('pdf-canvas-viewer');
const pdfLoading = getElement('pdf-loading-viewer');
const pdfError = getElement('pdf-error-viewer');
const pdfPrevBtn = getElement('pdf-prev-viewer');
const pdfNextBtn = getElement('pdf-next-viewer');
const pdfPageNum = getElement('pdf-page-num-viewer');
const pdfPageCount = getElement('pdf-page-count-viewer');
const pdfPagination = getElement('pdf-pagination-viewer');
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
const scoreId = urlParams.get('scoreId'); // 我們需要 scoreId 來找到正確的 PDF

// --- 渲染 YouTube ---
function renderYouTube(videoId, title) {
    if (!youtubePlayerContainer) return;
    if (videoId) {
        youtubePlayerContainer.innerHTML = `
            <iframe
                src="https://www.youtube.com/embed/${videoId}"
                title="YouTube video player for ${title || ''}"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen>
            </iframe>`;
        youtubePlayerContainer.style.display = 'block';
    } else {
        youtubePlayerContainer.innerHTML = '<p style="text-align:center; color:#666;">此歌曲沒有可用的 YouTube 影片。</p>';
        youtubePlayerContainer.style.display = 'block';
    }
}

// --- PDF.js 渲染邏輯 (與 scores.js 基本相同，但使用新 ID) ---
async function loadPdf(encodedPdfUrl) {
    if (!encodedPdfUrl || typeof encodedPdfUrl !== 'string') { /* ... 錯誤處理 ... */ return; }
    if (!pdfLoading || !pdfError || !pdfCanvas || !pdfViewerContainer || !pdfPagination) return;

    console.log("loadPdf: 開始載入 PDF...");
    pdfLoading.style.display = 'block';
    pdfError.style.display = 'none';
    pdfCanvas.style.display = 'none';
    pdfPagination.style.display = 'none';
    pdfViewerContainer.style.display = 'flex'; // 確保容器可見

    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;
    pdfPageNum.textContent = '-';
    pdfPageCount.textContent = '-';
    currentPdfDoc = null;
    currentPageNum = 1;

    const proxyUrl = `/api/scores/proxy?url=${encodedPdfUrl}`;
    console.log("loadPdf: 透過代理請求 PDF:", proxyUrl);

    try {
        const loadingTask = pdfjsLib.getDocument({ url: proxyUrl /*, cMap... */ });
        currentPdfDoc = await loadingTask.promise;
        console.log('loadPdf: PDF 載入成功. 頁數:', currentPdfDoc.numPages);
        pdfLoading.style.display = 'none';
        pdfPageCount.textContent = currentPdfDoc.numPages;
        renderPage(currentPageNum);
    } catch (reason) {
        console.error('loadPdf: 載入 PDF 時出錯:', reason);
        pdfLoading.style.display = 'none';
        pdfError.textContent = `無法載入 PDF。請檢查連結是否有效或稍後再試。(錯誤: ${reason.message || reason})`;
        pdfError.style.display = 'block';
        pdfCanvas.style.display = 'none';
        pdfPagination.style.display = 'none';
    }
}

function renderPage(num) {
    if (!currentPdfDoc || !pdfCanvas || !pdfViewerContainer || !pdfPageNum || !pdfPrevBtn || !pdfNextBtn) return;
    pdfPageRendering = true;
    pdfPageNum.textContent = num;
    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;

    currentPdfDoc.getPage(num).then(function(page) {
        console.log(`[renderPage] 獲取到頁面 ${num} 物件，準備渲染。`);
        requestAnimationFrame(() => {
            // *** 這裡的寬度計算邏輯更簡單，直接用容器寬度 ***
             let containerWidth = pdfViewerContainer.clientWidth;
             if (containerWidth <= 0) {
                 console.warn(`[renderPage] PDF 檢視器容器寬度 (${containerWidth}) 無效，使用 90vw 作為後備。`);
                 containerWidth = window.innerWidth * 0.9; // Fallback: 90% of viewport width
             }
             console.log(`[renderPage] 計算得到的 containerWidth: ${containerWidth}`);

            const viewportOriginal = page.getViewport({ scale: 1 });
            const scale = (viewportOriginal.width > 0 && containerWidth > 0) ? containerWidth / viewportOriginal.width : 1;
            const viewport = page.getViewport({ scale: scale });
            console.log(`[renderPage] 計算得到的 scale: ${scale}, viewport width: ${viewport.width}, height: ${viewport.height}`);

            renderPageWithViewport(page, viewport, num);
        });
    }).catch(function(pageError){ /* ... 錯誤處理 ... */ });
}

function renderPageWithViewport(page, viewport, pageNumber) {
    if (!pdfCanvas || !pdfError || !pdfPrevBtn || !pdfNextBtn || !pdfPagination) return;
    const canvasContext = pdfCanvas.getContext('2d');
    if (!canvasContext) { /* ... 錯誤處理 ... */ return; }

    pdfCanvas.style.display = 'block';
    pdfPagination.style.display = 'flex'; // 確保分頁可見
    pdfError.style.display = 'none';

    pdfCanvas.height = Math.ceil(viewport.height);
    pdfCanvas.width = Math.ceil(viewport.width);
    // *** 不需要再設置 style 的寬高，因為 CSS 已經設為 100% ***
    // pdfCanvas.style.width = `${pdfCanvas.width}px`;
    // pdfCanvas.style.height = `${pdfCanvas.height}px`;
    console.log(`[renderPageWithViewport] Setting canvas dimensions: W=${pdfCanvas.width}, H=${pdfCanvas.height}`);

    const renderContext = { canvasContext: canvasContext, viewport: viewport };
    const renderTask = page.render(renderContext);

    renderTask.promise.then(function() {
        console.log(`[renderPageWithViewport] 頁面 ${pageNumber} 渲染完成`);
        pdfPageRendering = false;
        pdfPrevBtn.disabled = (pageNumber <= 1);
        pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
        if (pageNumPending !== null) { /* ... 處理待定頁面 ... */ }
    }).catch(function(renderError) { /* ... 錯誤處理 ... */ });
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
    if (!musicId || !scoreId) {
        if (viewerTitle) viewerTitle.textContent = '錯誤';
        if (pdfError) {
            pdfError.textContent = '錯誤：缺少歌曲 ID 或樂譜 ID。';
            pdfError.style.display = 'block';
        }
        if(pdfViewerContainer) pdfViewerContainer.style.display = 'flex'; // 顯示錯誤容器
        console.error('缺少 musicId 或 scoreId');
        return;
    }

    try {
        // 獲取歌曲數據
        const response = await fetch(`/api/music/${musicId}`);
        if (!response.ok) throw new Error(`無法獲取歌曲資料 (HTTP ${response.status})`);
        currentMusicData = await response.json();

        if (!currentMusicData || !currentMusicData.scores) {
            throw new Error('找不到歌曲資料或樂譜列表。');
        }

        // 找到目標樂譜
        currentScoreData = currentMusicData.scores.find(s => s.id.toString() === scoreId);

        if (!currentScoreData || !currentScoreData.pdf_url) {
            throw new Error(`在歌曲 ${musicId} 中找不到樂譜 ID ${scoreId} 或其 PDF URL。`);
        }

        // 更新頁面標題和 Header
        const pageTitle = `${currentMusicData.title || '樂譜'} - ${currentScoreData.type || '檢視'} | SunnyYummy`;
        document.title = pageTitle;
        if (viewerTitle) viewerTitle.textContent = `${currentMusicData.title} - ${currentScoreData.type}`;

        // 渲染 YouTube
        renderYouTube(currentMusicData.youtube_video_id, currentMusicData.title);

        // 載入 PDF
        loadPdf(encodeURIComponent(currentScoreData.pdf_url));

    } catch (error) {
        console.error("初始化樂譜檢視器失敗:", error);
        if (viewerTitle) viewerTitle.textContent = '載入錯誤';
        if (pdfError) {
            pdfError.textContent = `載入失敗：${error.message}`;
            pdfError.style.display = 'block';
        }
        if(pdfViewerContainer) pdfViewerContainer.style.display = 'flex'; // 顯示錯誤容器
    }
}

// --- 事件監聽器 ---
document.addEventListener('DOMContentLoaded', () => {
    if (!musicId || !scoreId) {
        if (viewerTitle) viewerTitle.textContent = '錯誤';
         if (pdfError) {
            pdfError.textContent = '無效的頁面連結。';
            pdfError.style.display = 'block';
         }
        if(pdfViewerContainer) pdfViewerContainer.style.display = 'flex';
        return;
    }

    initializeViewer();

    if (pdfPrevBtn) pdfPrevBtn.addEventListener('click', onPrevPage);
    if (pdfNextBtn) pdfNextBtn.addEventListener('click', onNextPage);
    if (printBtn) printBtn.addEventListener('click', () => window.print());
});