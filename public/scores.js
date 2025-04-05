// public/scores.js

// 引入 pdf.js 函式庫 (ES Module 方式) - 確保只有這一行引入 pdfjsLib
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

// --- 將 allSongsData 宣告移到最前面 ---
let allSongsData = [];
// --- 修改結束 ---

// 設定 PDF.js worker 的來源路徑
if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';
        console.log('PDF.js workerSrc 設定回 mjs 版本。');
    } catch (e) {
        console.warn('無法設定 PDF.js workerSrc:', e);
    }
} else {
    console.warn('PDF.js GlobalWorkerOptions 無法設定。');
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
let currentArtist = 'All';
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
                .filter(score => score.type && score.pdf_url && score.id)
                .map(score => `
                    <button class="action-btn score-type-btn list-score-btn"
                            data-song-id="${song.id}"
                            data-score-id="${score.id}"
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

// --- 修改 renderSongDetail 函數 ---
// 增加檢查 YouTube 影片並顯示
function renderSongDetail(song) {
    if (!songInfo || !youtubePlayerContainer || !songDetailContainer) return;

    // Reset/hide PDF viewer elements when changing songs
    if (pdfViewerContainer) pdfViewerContainer.style.display = 'none';
    if (pdfCanvas) pdfCanvas.style.display = 'none';
    if (pdfPagination) pdfPagination.style.display = 'none';
    if (pdfLoading) pdfLoading.style.display = 'none';
    if (pdfError) pdfError.style.display = 'none';
    currentPdfDoc = null;

    if (scoreSelectorContainer) scoreSelectorContainer.innerHTML = '';

    songInfo.textContent = `${song.title || '未知標題'} - ${song.artist || '未知歌手'}`;

    // 檢查 YouTube 影片 ID
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

    // 顯示歌曲詳細資料
    songDetailContainer.style.display = 'flex';
    songDetailContainer.style.flexDirection = 'column'; 
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
        renderPage(currentPageNum);
    } catch (reason) {
        console.error('loadPdf: 載入 PDF 時出錯:', reason);
        pdfLoading.style.display = 'none';
        pdfError.textContent = `無法載入 PDF。請檢查連結是否有效或稍後再試。`;
        pdfError.style.display = 'block';
        pdfCanvas.style.display = 'none';
        pdfPagination.style.display = 'none';
    }
}

// --- 渲染頁面 ---
function renderPage(num) {
    if (!currentPdfDoc || !pdfCanvas || !pdfViewerContainer || !pdfPageNum || !pdfPrevBtn || !pdfNextBtn) {
        console.error("renderPage: 無法渲染頁面：缺少 PDF 文件物件或必要的 DOM 元素。");
        return;
    }
    pdfPageRendering = true;
    pdfPageNum.textContent = num;

    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;

    currentPdfDoc.getPage(num).then(function(page) {
        console.log(`[renderPage] 獲取到頁面 ${num} 物件，準備渲染。`);

        // 使用 requestAnimationFrame 延遲寬度讀取
        requestAnimationFrame(() => {
             let desiredWidth = pdfViewerContainer.clientWidth * 0.95; 
            if (desiredWidth <= 0) {
                console.warn(`[renderPage] PDF 檢視器容器寬度 (${pdfViewerContainer.clientWidth}) 無效，使用後備寬度 600px。`);
                desiredWidth = 600; 
            }

            const viewportOriginal = page.getViewport({ scale: 1 });
            const scale = (viewportOriginal.width > 0 && desiredWidth > 0) ? desiredWidth / viewportOriginal.width : 1;
            const viewport = page.getViewport({ scale: scale });
            renderPageWithViewport(page, viewport, num);
        });

    }).catch(function(pageError){
         console.error(`[renderPage] 獲取頁面 ${num} 時出錯:`, pageError);
    });
}
