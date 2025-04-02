// public/scores.js

// 引入 pdf.js 函式庫 (ES Module 方式) - 確保只有這一行引入 pdfjsLib
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

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
const scoreSelectorContainer = getElement('score-selector');
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
            return {};
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

async function fetchSongs(artist = 'All') {
     if (!songList) return;
    songList.innerHTML = '<p>載入歌曲中...</p>';
    currentSongId = null;
    if (songDetailContainer) songDetailContainer.classList.remove('visible');
    try {
        const decodedArtist = decodeURIComponent(artist);
        const url = decodedArtist === 'All' ? '/api/scores/songs' : `/api/scores/songs?artist=${artist}`;
        const songs = await fetchApi(url, `Error fetching songs for artist ${decodedArtist}`);
        renderSongList(songs);
    } catch (error) {
        songList.innerHTML = '<p style="color: red;">無法載入歌曲列表。</p>';
    }
}

async function fetchSongDetail(songId) {
     const requiredElements = [songDetailContainer, songInfo, youtubePlayerContainer, scoreSelectorContainer, pdfViewerContainer];
     if (requiredElements.some(el => !el)) {
         console.error("獲取歌曲詳情所需的 DOM 元素不完整。");
         return;
     }
    if (currentSongId === songId) {
        console.log("已顯示此歌曲:", songId);
        return;
    }

    currentSongId = songId;
    songInfo.textContent = '載入歌曲詳情中...';
    youtubePlayerContainer.innerHTML = '';
    scoreSelectorContainer.innerHTML = '';
    pdfViewerContainer.style.display = 'none';
    if(pdfError) pdfError.style.display = 'none';
    if(pdfLoading) pdfLoading.style.display = 'none';
    if(pdfPagination) pdfPagination.style.display = 'none';
    songDetailContainer.classList.add('visible');

    document.querySelectorAll('#song-list li').forEach(li => {
        li.classList.toggle('active', li.dataset.songId === songId.toString());
    });

    try {
        const song = await fetchApi(`/api/music/${songId}`, `Error fetching song detail for id ${songId}`);
        renderSongDetail(song);

        // 不再自動載入第一個樂譜
        if (song.scores && song.scores.length > 0) {
             console.log(`歌曲 ${songId} 包含 ${song.scores.length} 個樂譜。等待使用者選擇。`);
        } else {
             console.log(`歌曲 ${songId} 沒有樂譜。`);
             pdfViewerContainer.style.display = 'none';
        }

    } catch (error) {
        songInfo.textContent = '無法載入歌曲詳情。';
        console.error('Song Detail Fetch Error:', error);
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

function renderSongList(songs) {
     if (!songList) return;
    if (!songs || !Array.isArray(songs) || songs.length === 0) {
        songList.innerHTML = '<p>此分類下沒有包含樂譜的歌曲。</p>';
        return;
    }
    songList.innerHTML = songs.map(song => `
        <li data-song-id="${song.id}">
            <span class="song-title">${song.title || '未知標題'}</span>
            <span class="song-artist">${song.artist || '未知歌手'}</span>
        </li>
    `).join('');
}

function renderSongDetail(song) {
    if (!songInfo || !youtubePlayerContainer || !scoreSelectorContainer) return;

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
    } else {
        youtubePlayerContainer.innerHTML = '<p>此歌曲沒有可用的 YouTube 影片。</p>';
    }

    if (song.scores && Array.isArray(song.scores) && song.scores.length > 0) {
        const scoreButtonsHTML = song.scores
            .filter(score => score.type && score.pdf_url)
            .map(score => `
            <button class="action-btn score-type-btn" data-pdf-url="${encodeURIComponent(score.pdf_url)}">
                ${score.type}
            </button>
        `).join('');

        if (scoreButtonsHTML) {
             scoreSelectorContainer.innerHTML = `<h3>選擇樂譜類型:</h3> ${scoreButtonsHTML}`;
        } else {
             scoreSelectorContainer.innerHTML = '<p>此歌曲沒有可用的樂譜連結。</p>';
             if(pdfViewerContainer) pdfViewerContainer.style.display = 'none';
        }
    } else {
        scoreSelectorContainer.innerHTML = '<p>此歌曲沒有可用的樂譜。</p>';
        if(pdfViewerContainer) pdfViewerContainer.style.display = 'none';
    }
}

// --- PDF.js 相關函數 ---
async function loadPdf(encodedPdfUrl) {
    if (!encodedPdfUrl || typeof encodedPdfUrl !== 'string') {
        console.warn('沒有提供 PDF URL 或格式無效。');
        if(pdfViewerContainer) pdfViewerContainer.style.display = 'none';
        return;
    }
    if (!pdfLoading || !pdfError || !pdfCanvas || !pdfViewerContainer || !pdfPagination || !pdfPrevBtn || !pdfNextBtn || !pdfPageNum || !pdfPageCount) {
        console.error("PDF 檢視器 DOM 元素缺失。");
        return;
    }

    pdfLoading.style.display = 'block';
    pdfError.style.display = 'none';
    pdfCanvas.style.display = 'none';
    pdfPagination.style.display = 'none';
    pdfViewerContainer.style.display = 'block';
    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;
    pdfPageNum.textContent = '-';
    pdfPageCount.textContent = '-';
    currentPdfDoc = null;
    currentPageNum = 1;

    const proxyUrl = `/api/scores/proxy?url=${encodedPdfUrl}`;
    console.log("透過代理請求 PDF:", proxyUrl);

    try {
        const loadingTask = pdfjsLib.getDocument({
            url: proxyUrl,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
        });
        currentPdfDoc = await loadingTask.promise;
        console.log('PDF 載入成功. 頁數:', currentPdfDoc.numPages);
        pdfLoading.style.display = 'none';
        pdfPageCount.textContent = currentPdfDoc.numPages;
        pdfCanvas.style.display = 'block';
        pdfPagination.style.display = 'block'; // 使用 block 或 flex 取決於你的 CSS
        renderPage(currentPageNum);
    } catch (reason) {
        console.error('載入 PDF 時出錯:', reason);
        pdfLoading.style.display = 'none';
        pdfError.textContent = `無法載入 PDF。請檢查連結是否有效或稍後再試。`;
        if (reason && reason.message) pdfError.textContent += ` (錯誤: ${reason.message})`;
        else if (typeof reason === 'string') pdfError.textContent += ` (${reason})`;
        pdfError.style.display = 'block';
        pdfCanvas.style.display = 'none';
        pdfPagination.style.display = 'none';
    }
}

// *** 使用固定比例渲染的測試版本 ***
function renderPage(num) {
    if (!currentPdfDoc || !pdfCanvas || !pdfViewerContainer || !pdfPageNum || !pdfPrevBtn || !pdfNextBtn) {
        console.error("無法渲染頁面：缺少 PDF 文件物件或必要的 DOM 元素。");
        return;
    }
    pdfPageRendering = true;
    pdfPageNum.textContent = num;

    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;

    currentPdfDoc.getPage(num).then(function(page) {
        console.log(`獲取到頁面 ${num} 物件，使用固定比例 1.0 進行渲染測試。`);

        // *** 直接使用固定比例 1.0 ***
        const fixedScale = 1.0; // 你可以試試改成 1.5 或 0.8 看看效果
        const viewport = page.getViewport({ scale: fixedScale });
        renderPageWithViewport(page, viewport, num); // 直接調用渲染函數

    }).catch(function(pageError){
         console.error(`獲取頁面 ${num} 時出錯:`, pageError);
         pdfPageRendering = false;
         if(pdfError) {
             pdfError.textContent = `獲取頁面 ${num} 時出錯。`;
             pdfError.style.display = 'block';
         }
         if(pdfPrevBtn) pdfPrevBtn.disabled = (num <= 1);
         if(pdfNextBtn && currentPdfDoc) pdfNextBtn.disabled = (num >= currentPdfDoc.numPages);
    });
}

// 實際的 Canvas 渲染邏輯
function renderPageWithViewport(page, viewport, pageNumber) {
    if (!pdfCanvas || !pdfError || !pdfPrevBtn || !pdfNextBtn) {
        console.error("渲染頁面時缺少必要的 Canvas 或控制按鈕。");
        pdfPageRendering = false;
        return;
    }
    const canvasContext = pdfCanvas.getContext('2d');
    if (!canvasContext) {
         console.error("無法獲取 Canvas 2D 上下文。");
         pdfPageRendering = false;
         pdfError.textContent = '無法渲染 PDF (Canvas Context Error)。';
         pdfError.style.display = 'block';
         pdfPrevBtn.disabled = (pageNumber <= 1);
         if(currentPdfDoc) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
         return;
    }
    pdfCanvas.height = viewport.height;
    pdfCanvas.width = viewport.width;

    const renderContext = {
        canvasContext: canvasContext,
        viewport: viewport
    };
    const renderTask = page.render(renderContext);

    renderTask.promise.then(function() {
        console.log(`頁面 ${pageNumber} 渲染完成`);
        pdfPageRendering = false;

        // 更新按鈕狀態
        pdfPrevBtn.disabled = (pageNumber <= 1);
        if(currentPdfDoc) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);

        if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
        }
    }).catch(function(renderError) {
        console.error(`渲染頁面 ${pageNumber} 時出錯:`, renderError);
        pdfPageRendering = false;
        pdfError.textContent = `渲染頁面 ${pageNumber} 時出錯。`;
        pdfError.style.display = 'block';
        pdfPrevBtn.disabled = (pageNumber <= 1);
        if(currentPdfDoc) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
    });
}

// 渲染請求排隊
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
    const listItem = event.target.closest('li[data-song-id]');
    if (listItem) {
        const songId = listItem.dataset.songId;
        if(songId) fetchSongDetail(songId);
    }
}

function handleScoreButtonClick(event) {
    const target = event.target;
    if (target && target.tagName === 'BUTTON' && target.classList.contains('score-type-btn')) {
        if (!scoreSelectorContainer) return;
        scoreSelectorContainer.querySelectorAll('.score-type-btn').forEach(btn => btn.classList.remove('active'));
        target.classList.add('active');
        const encodedPdfUrl = target.dataset.pdfUrl;
        if(encodedPdfUrl) loadPdf(encodedPdfUrl);
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
    const essentialElements = [artistFilterContainer, songList, scoreSelectorContainer, pdfPrevBtn, pdfNextBtn, pdfPagination, pdfCanvas, pdfViewerContainer, pdfLoading, pdfError, pdfPageNum, pdfPageCount];
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
    scoreSelectorContainer.addEventListener('click', handleScoreButtonClick);
    pdfPrevBtn.addEventListener('click', onPrevPage);
    pdfNextBtn.addEventListener('click', onNextPage);
});