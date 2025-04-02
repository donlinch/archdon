// public/scores.js

// 引入 pdf.js 函式庫 (ES Module 方式) - 確保只有這一行引入 pdfjsLib
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

// --- *** 將 allSongsData 宣告移到最前面 *** ---
let allSongsData = [];
// --- *** 修改結束 *** ---

// 設定 PDF.js worker 的來源路徑
if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions && typeof pdfjsLib.GlobalWorkerOptions.workerSrc === 'string') {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';
    } catch (e) {
        console.warn('無法設定 PDF.js workerSrc (可能在不支援的環境中):', e);
    }
} else {
    console.warn('PDF.js GlobalWorkerOptions.workerSrc 無法設定，可能使用預設 worker 或發生錯誤。');
}

// --- DOM 元素獲取 ---
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: Element with ID "${id}" not found.`);
    }
    return element;
}

const artistFilterContainer = getElement('artist-filter');
const songList = getElement('song-list');
const songDetailContainer = getElement('song-detail-container');
const songInfo = getElement('song-info');
const youtubePlayerContainer = getElement('youtube-player');
const scoreSelectorContainer = getElement('score-selector'); // 雖然不用了，但保留以防萬一
const pdfViewerContainer = getElement('pdf-viewer-container');
const pdfCanvas = getElement('pdf-canvas');
const pdfLoading = getElement('pdf-loading');
const pdfError = getElement('pdf-error');
const pdfPrevBtn = getElement('pdf-prev');
const pdfNextBtn = getElement('pdf-next');
const pdfPageNum = getElement('pdf-page-num');
const pdfPageCount = getElement('pdf-page-count');
const pdfPagination = getElement('pdf-pagination');

// --- 狀態變數 ---
let currentPdfDoc = null;
let currentPageNum = 1;
let currentSongId = null;
let currentArtist = 'All'; // 預設顯示全部
let pdfPageRendering = false;
let pageNumPending = null;

// --- API 請求函數 ---
async function fetchApi(url, errorMessage) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            let errorDetails = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorDetails += `, message: ${errorData.error || response.statusText}`;
            } catch (parseError) {
                errorDetails += `, message: ${response.statusText}`;
            }
            throw new Error(errorDetails);
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return await response.json();
        } else {
            console.warn(`API ${url} did not return JSON. Content-Type: ${contentType}`);
            return {}; // 返回空物件
        }
    } catch (error) {
        console.error(`${errorMessage}:`, error);
        throw error;
    }
}

async function fetchArtists() {
    if (!artistFilterContainer) return;
    artistFilterContainer.innerHTML = '<p>載入歌手中...</p>';
    try {
        const artists = await fetchApi('/api/scores/artists', 'Error fetching artists');
        renderArtistFilters(artists);
    } catch (error) {
        artistFilterContainer.innerHTML = '<p style="color: red;">無法載入歌手列表。</p>';
    }
}

// --- 修改後的獲取歌曲列表函數 ---
async function fetchSongs(artist = 'All') {
    if (!songList) return;
    songList.innerHTML = '<p>載入歌曲中...</p>';
    currentSongId = null;
    // *** CHANGE: Use display: none to hide ***
    if (songDetailContainer) songDetailContainer.style.display = 'none';
    try {
        const decodedArtist = decodeURIComponent(artist);
        const url = decodedArtist === 'All' ? '/api/scores/songs' : `/api/scores/songs?artist=${artist}`;
        allSongsData = await fetchApi(url, `Error fetching songs for artist ${decodedArtist}`);
        renderSongList(allSongsData);
    } catch (error) {
        songList.innerHTML = '<p style="color: red;">無法載入歌曲列表。</p>';
        allSongsData = []; // 出錯時清空
    }
}
// --- 渲染函數 ---
function renderArtistFilters(artists) {
     if (!artistFilterContainer) return;
     const decodedCurrentArtist = decodeURIComponent(currentArtist);
    let buttonsHTML = `<button class="artist-filter-btn ${decodedCurrentArtist === 'All' ? 'active' : ''}" data-artist="All">全部歌手</button>`;
    artists.forEach(artist => {
        const encodedArtist = encodeURIComponent(artist);
        buttonsHTML += `<button class="artist-filter-btn ${decodedCurrentArtist === artist ? 'active' : ''}" data-artist="${encodedArtist}">${artist}</button>`;
    });
    artistFilterContainer.innerHTML = buttonsHTML;
}

// --- 渲染歌曲列表 (直接包含樂譜按鈕) ---
function renderSongList(songs) {
    if (!songList) return;
    if (!songs || !Array.isArray(songs) || songs.length === 0) {
        songList.innerHTML = '<p>此分類下沒有包含樂譜的歌曲。</p>';
        return;
    }
    songList.innerHTML = songs.map(song => {
        let scoreButtonsHTML = '';
        if (song.scores && Array.isArray(song.scores) && song.scores.length > 0) {
            scoreButtonsHTML = song.scores
                .filter(score => score.type && score.pdf_url)
                .map(score => `
                    <button class="action-btn score-type-btn list-score-btn"
                            data-song-id="${song.id}"
                            data-pdf-url="${encodeURIComponent(score.pdf_url)}"
                            title="查看 ${song.title} - ${score.type}">
                        ${score.type}
                    </button>
                `).join('');
        }

        const isActive = currentSongId !== null && currentSongId === song.id;
        return `
            <li data-song-id="${song.id}" class="${isActive ? 'active' : ''}">
                <div class="song-list-info">
                     <span class="song-title">${song.title || '未知標題'}</span>
                     <span class="song-artist">${song.artist || '未知歌手'}</span>
                 </div>
                 <div class="song-list-scores">
                     ${scoreButtonsHTML}
                 </div>
            </li>
        `;
    }).join('');
}

// --- *** MODIFY renderSongDetail to use visibility class *** ---
function renderSongDetail(song) {
    if (!songInfo || !youtubePlayerContainer || !songDetailContainer) return;

    // Reset/hide PDF viewer elements when changing songs (Keep this logic)
    if (pdfViewerContainer) pdfViewerContainer.style.display = 'none';
    if (pdfCanvas) pdfCanvas.style.display = 'none';
    if (pdfPagination) pdfPagination.style.display = 'none';
    if (pdfLoading) pdfLoading.style.display = 'none';
    if (pdfError) pdfError.style.display = 'none';
    currentPdfDoc = null;

    if (scoreSelectorContainer) scoreSelectorContainer.innerHTML = '';

    songInfo.textContent = `${song.title || '未知標題'} - ${song.artist || '未知歌手'}`;

    if (song.youtube_video_id) {
        youtubePlayerContainer.innerHTML = `
            <iframe
                src="https://www.youtube.com/embed/${song.youtube_video_id}"
                title="YouTube video player for ${song.title || ''}"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen>
            </iframe>`;
        youtubePlayerContainer.style.display = 'block';
    } else {
        youtubePlayerContainer.innerHTML = '<p>此歌曲沒有可用的 YouTube 影片。</p>';
        youtubePlayerContainer.style.display = 'block';
    }

    // ** CHANGE HERE: Set display to flex directly **
    songDetailContainer.style.display = 'flex';
    songDetailContainer.style.flexDirection = 'column'; // Ensure direction is set

    // Remove the class if it was added previously
    songDetailContainer.classList.remove('visible');
}


// --- PDF.js 相關函數 ---
async function loadPdf(encodedPdfUrl) {
    if (!encodedPdfUrl || typeof encodedPdfUrl !== 'string') {
        console.warn('loadPdf: 沒有提供 PDF URL 或格式無效。');
        if(pdfViewerContainer) pdfViewerContainer.style.display = 'none';
        return;
    }
    const requiredElements = [pdfLoading, pdfError, pdfCanvas, pdfViewerContainer, pdfPagination, pdfPrevBtn, pdfNextBtn, pdfPageNum, pdfPageCount];
    if (requiredElements.some(el => !el)) {
        console.error("loadPdf: PDF 檢視器 DOM 元素缺失。");
        return;
    }

    console.log("loadPdf: 開始載入 PDF...");
    pdfLoading.style.display = 'block';
    pdfError.style.display = 'none';
    pdfCanvas.style.display = 'none'; // Hide canvas initially
    pdfPagination.style.display = 'none'; // Hide pagination initially
    // *** CHANGE: Ensure PDF viewer container is flex and visible ***
    pdfViewerContainer.style.display = 'flex';
    pdfViewerContainer.style.flexDirection = 'column'; // Stack canvas and pagination

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
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
        });
        currentPdfDoc = await loadingTask.promise;
        console.log('loadPdf: PDF 載入成功. 頁數:', currentPdfDoc.numPages);
        pdfLoading.style.display = 'none';
        pdfPageCount.textContent = currentPdfDoc.numPages;
        // Don't show canvas/pagination here, let renderPage handle it
        renderPage(currentPageNum);
    } catch (reason) {
        console.error('loadPdf: 載入 PDF 時出錯:', reason);
        pdfLoading.style.display = 'none';
        pdfError.textContent = `無法載入 PDF。請檢查連結是否有效或稍後再試。`;
        if (reason && reason.message) pdfError.textContent += ` (錯誤: ${reason.message})`;
        else if (typeof reason === 'string') pdfError.textContent += ` (${reason})`;
        pdfError.style.display = 'block';
        pdfCanvas.style.display = 'none';
        pdfPagination.style.display = 'none';
        // Keep pdfViewerContainer visible to show the error
    }
}

// --- *** MODIFY renderPage to delay width reading *** ---
function renderPage(num) {
    if (!currentPdfDoc || !pdfCanvas || !pdfViewerContainer || !pdfPageNum || !pdfPrevBtn || !pdfNextBtn) {
        console.error("renderPage: 無法渲染頁面：缺少 PDF 文件物件或必要的 DOM 元素。");
        return;
    }
    pdfPageRendering = true;
    pdfPageNum.textContent = num;

    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;

    // Use getPage promise
    currentPdfDoc.getPage(num).then(function(page) {
        console.log(`[renderPage] 獲取到頁面 ${num} 物件，準備渲染。`);

        // ** CHANGE: Use requestAnimationFrame to delay width reading slightly **
        requestAnimationFrame(() => {
             // Double-check visibility before reading width
            if (window.getComputedStyle(pdfViewerContainer).display === 'none') {
                 console.warn("[renderPage] pdfViewerContainer 在計算寬度前是 display:none，強制設為 flex。");
                 pdfViewerContainer.style.display = 'flex';
                 pdfViewerContainer.style.flexDirection = 'column';
            }

            // Calculate width based on the container *now*
            let desiredWidth = pdfViewerContainer.clientWidth * 0.95; // 95% of container width
            if (desiredWidth <= 0) {
                console.warn(`[renderPage] PDF 檢視器容器寬度 (${pdfViewerContainer.clientWidth}) 無效，使用後備寬度 600px。`);
                desiredWidth = 600; // Fallback width
            }
            console.log(`[renderPage] 計算得到的 desiredWidth: ${desiredWidth}`);

            const viewportOriginal = page.getViewport({ scale: 1 });
            // Prevent division by zero or negative width
            const scale = (viewportOriginal.width > 0 && desiredWidth > 0) ? desiredWidth / viewportOriginal.width : 1;
            const viewport = page.getViewport({ scale: scale });
            console.log(`[renderPage] 計算得到的 scale: ${scale}, viewport width: ${viewport.width}, height: ${viewport.height}`);

            renderPageWithViewport(page, viewport, num);
        });

    }).catch(function(pageError){
         console.error(`[renderPage] 獲取頁面 ${num} 時出錯:`, pageError);
         pdfPageRendering = false;
         if(pdfError) {
             pdfError.textContent = `獲取頁面 ${num} 時出錯。`;
             pdfError.style.display = 'block';
         }
         // Keep viewer container visible for error
         if(pdfCanvas) pdfCanvas.style.display = 'none';
         if(pdfPagination) pdfPagination.style.display = 'none';
         if(pdfPrevBtn) pdfPrevBtn.disabled = (num <= 1);
         if(pdfNextBtn && currentPdfDoc) pdfNextBtn.disabled = (num >= currentPdfDoc.numPages);
    });
}

// --- *** MODIFY renderPageWithViewport to ensure visibility *** ---
function renderPageWithViewport(page, viewport, pageNumber) {
    if (!pdfCanvas || !pdfError || !pdfPrevBtn || !pdfNextBtn || !pdfViewerContainer || !pdfPagination) {
        console.error("[renderPageWithViewport] 渲染頁面時缺少必要的 Canvas 或控制按鈕或容器或分頁。");
        pdfPageRendering = false;
        return;
    }
    const canvasContext = pdfCanvas.getContext('2d');
    if (!canvasContext) {
         console.error("[renderPageWithViewport] 無法獲取 Canvas 2D 上下文。");
         pdfPageRendering = false;
         if (pdfError) {
            pdfError.textContent = '無法渲染 PDF (Canvas Context Error)。';
            pdfError.style.display = 'block';
         }
         pdfViewerContainer.style.display = 'flex'; // Keep container visible
         pdfCanvas.style.display = 'none';
         pdfPagination.style.display = 'none';
         if(pdfPrevBtn) pdfPrevBtn.disabled = (pageNumber <= 1);
         if(currentPdfDoc && pdfNextBtn) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
         return;
    }

    // *** Ensure elements are visible *before* drawing ***
    pdfCanvas.style.display = 'block';
    pdfViewerContainer.style.display = 'flex'; // Ensure container is flex
    pdfViewerContainer.style.flexDirection = 'column'; // Stack content
    pdfPagination.style.display = 'flex'; // Use flex for pagination centering
    pdfError.style.display = 'none'; // Hide any previous errors

    // Use Math.ceil to avoid fractional pixels which can cause issues
    pdfCanvas.height = Math.ceil(viewport.height);
    pdfCanvas.width = Math.ceil(viewport.width);
    console.log(`[renderPageWithViewport] Setting canvas display: block, dimensions: W=${pdfCanvas.width}, H=${pdfCanvas.height}`);

    // Set canvas style dimensions as well to prevent potential CSS override issues (optional but can help)
    pdfCanvas.style.width = `${pdfCanvas.width}px`;
    pdfCanvas.style.height = `${pdfCanvas.height}px`;


    const renderContext = {
        canvasContext: canvasContext,
        viewport: viewport
    };
    const renderTask = page.render(renderContext);

    renderTask.promise.then(function() {
        console.log(`[renderPageWithViewport] 頁面 ${pageNumber} 渲染完成`);
        pdfPageRendering = false;
        if(pdfPrevBtn) pdfPrevBtn.disabled = (pageNumber <= 1);
        if(currentPdfDoc && pdfNextBtn) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
        if (pageNumPending !== null) {
            console.log(`[renderPageWithViewport] 處理待定頁面: ${pageNumPending}`);
            renderPage(pageNumPending);
            pageNumPending = null;
        }
    }).catch(function(renderError) {
        console.error(`[renderPageWithViewport] 渲染頁面 ${pageNumber} 時出錯:`, renderError);
        pdfPageRendering = false;
        if (pdfError) {
            pdfError.textContent = `渲染頁面 ${pageNumber} 時出錯。`;
            pdfError.style.display = 'block';
        }
         pdfCanvas.style.display = 'none';
         pdfPagination.style.display = 'none';
        if(pdfPrevBtn) pdfPrevBtn.disabled = (pageNumber <= 1);
        if(currentPdfDoc && pdfNextBtn) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
    });
}


function queueRenderPage(num) {
    if (pdfPageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// --- 事件處理函數 ---
function handleArtistFilterClick(event) {
    const target = event.target;
    if (target && target.tagName === 'BUTTON' && target.classList.contains('artist-filter-btn')) {
        if (!artistFilterContainer) return;
        artistFilterContainer.querySelectorAll('.artist-filter-btn').forEach(btn => btn.classList.remove('active'));
        target.classList.add('active');
        currentArtist = target.dataset.artist;
        fetchSongs(currentArtist);
    }
}

function handleSongListItemClick(event) {
    const target = event.target;

    if (target.tagName === 'BUTTON' && target.classList.contains('list-score-btn')) {
        const songId = target.dataset.songId;
        const encodedPdfUrl = target.dataset.pdfUrl;

        if (songId && encodedPdfUrl && allSongsData) {
            console.log(`樂譜按鈕點擊: Song ID ${songId}, PDF URL (encoded): ${encodedPdfUrl}`);

            const songData = allSongsData.find(song => song.id.toString() === songId);

            if (songData) {
                const previousSongId = currentSongId;
                currentSongId = parseInt(songId, 10);

                // *** Only render song details if the song ID actually changed ***
                if (previousSongId !== currentSongId) {
                    renderSongDetail(songData); // This now sets display: flex
                } else if (songDetailContainer.style.display === 'none') {
                    // If clicking a different score for the *same* song, but the container was hidden, show it.
                    songDetailContainer.style.display = 'flex';
                    songDetailContainer.style.flexDirection = 'column';
                }


                // Update active states
                document.querySelectorAll('.list-score-btn.active').forEach(btn => btn.classList.remove('active'));
                target.classList.add('active');
                document.querySelectorAll('#song-list li.active').forEach(li => li.classList.remove('active'));
                target.closest('li')?.classList.add('active');

                loadPdf(encodedPdfUrl); // Load the PDF
            } else {
                console.error(`找不到歌曲 ID ${songId} 的快取數據。`);
            }
        } else {
             console.warn('無法處理樂譜按鈕點擊：缺少 songId 或 pdfUrl 或 allSongsData。');
        }
    }
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

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    const essentialElements = [artistFilterContainer, songList, pdfPrevBtn, pdfNextBtn, pdfPagination, pdfCanvas, pdfViewerContainer, pdfLoading, pdfError, pdfPageNum, pdfPageCount, songDetailContainer, songInfo, youtubePlayerContainer]; // 補上檢查
    if (essentialElements.some(el => !el)) {
        console.error("頁面初始化失敗：缺少必要的 DOM 元素。請檢查 HTML 結構和 ID 是否正確。");
        if(document.body) document.body.innerHTML = '<p style="color:red; padding: 2rem; text-align: center;">頁面載入錯誤，缺少必要的元件。</p>';
        return;
    }

    fetchArtists();
    fetchSongs('All'); // 預設載入所有歌曲

    // --- 事件監聽器綁定 ---
    artistFilterContainer.addEventListener('click', handleArtistFilterClick);
    songList.addEventListener('click', handleSongListItemClick);
    pdfPrevBtn.addEventListener('click', onPrevPage);
    pdfNextBtn.addEventListener('click', onNextPage);

    // Initially hide the detail container
    if(songDetailContainer) {
        songDetailContainer.classList.remove('visible');
    }
});