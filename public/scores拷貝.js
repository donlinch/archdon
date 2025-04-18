// public/scores.js

// 引入 pdf.js 函式庫 (ES Module 方式)
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

// 全局變量
let allSongsData = [];
let currentPdfDoc = null;
let currentPageNum = 1;
let currentSongId = null;
let currentArtist = 'All';
let pdfPageRendering = false;
let pageNumPending = null;
let currentView = 'grid';

// 設定 PDF.js worker
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

// DOM 元素獲取函數
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: Element with ID "${id}" not found.`);
    }
    return element;
}

// 獲取所有需要的DOM元素
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
const artistFilterBtn = getElement('artist-filter-btn');
const currentArtistDisplay = getElement('current-artist-display');
const artistModal = getElement('artist-modal');
const modalCloseBtn = document.querySelector('.modal-close');
const viewButtons = document.querySelectorAll('.view-btn');

// API 請求函數
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
    if (songDetailContainer) songDetailContainer.style.display = 'none';
    
    try {
        const decodedArtist = decodeURIComponent(artist);
        const url = decodedArtist === 'All' ? '/api/scores/songs' : `/api/scores/songs?artist=${artist}`;
        allSongsData = await fetchApi(url, `Error fetching songs for artist ${decodedArtist}`);
        renderSongList(allSongsData);
        
        if (currentArtistDisplay) {
            currentArtistDisplay.textContent = decodedArtist === 'All' ? '全部歌手' : decodedArtist;
        }
    } catch (error) {
        songList.innerHTML = '<p style="color: red;">無法載入歌曲列表。</p>';
        allSongsData = [];
    }
}

// 渲染函數
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
    
    songList.className = currentView === 'grid' ? 'songs-grid-view' : 'songs-list-view';
    
    songList.innerHTML = songs.map(song => {
        let scoreButtonsHTML = '';
        if (song.scores && Array.isArray(song.scores)) {
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

        const isActive = currentSongId === song.id;
        if (currentView === 'grid') {
            return `
                <li data-song-id="${song.id}" class="${isActive ? 'active' : ''}">
                    <div class="song-card">
                        <div class="song-card-header">
                            <div class="song-title">${song.title || '未知標題'}</div>
                            <div class="song-artist">${song.artist || '未知歌手'}</div>
                        </div>
                        <div class="song-card-body">
                            ${scoreButtonsHTML}
                        </div>
                    </div>
                </li>
            `;
        } else {
            return `
                <li data-song-id="${song.id}" class="${isActive ? 'active' : ''}">
                    <div class="song-list-info">
                        <span class="song-title">${song.title || '未知標題'}</span>
                        <span class="song-artist">${song.artist || '未知歌手'}</span>
                        <div class="song-list-scores">
                            ${scoreButtonsHTML}
                        </div>
                    </div>
                </li>
            `;
        }
    }).join('');
}

function renderSongDetail(song) {
    if (!songInfo || !youtubePlayerContainer || !songDetailContainer) return;

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

    songDetailContainer.style.display = 'flex';
    songDetailContainer.style.flexDirection = 'column';
    songDetailContainer.classList.remove('visible');
}

// PDF 相關函數
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
    pdfCanvas.style.display = 'none';
    pdfPagination.style.display = 'none';
    pdfViewerContainer.style.display = 'flex';
    pdfViewerContainer.style.flexDirection = 'column';

    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;
    pdfPageNum.textContent = '-';
    pdfPageCount.textContent = '-';
    currentPdfDoc = null;
    currentPageNum = 1;

    const proxyUrl = `/api/scores/proxy?url=${encodedPdfUrl}`;
    
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
        if (reason?.message) pdfError.textContent += ` (錯誤: ${reason.message})`;
        else if (typeof reason === 'string') pdfError.textContent += ` (${reason})`;
        pdfError.style.display = 'block';
        pdfCanvas.style.display = 'none';
        pdfPagination.style.display = 'none';
    }
}

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
        requestAnimationFrame(() => {
            if (window.getComputedStyle(pdfViewerContainer).display === 'none') {
                pdfViewerContainer.style.display = 'flex';
                pdfViewerContainer.style.flexDirection = 'column';
            }

            let desiredWidth = pdfViewerContainer.clientWidth * 0.95;
            if (desiredWidth <= 0) desiredWidth = 600;
            
            const viewportOriginal = page.getViewport({ scale: 1 });
            const scale = (viewportOriginal.width > 0 && desiredWidth > 0) ? 
                desiredWidth / viewportOriginal.width : 1;
            const viewport = page.getViewport({ scale: scale });
            
            renderPageWithViewport(page, viewport, num);
        });
    }).catch(function(pageError) {
        console.error(`[renderPage] 獲取頁面 ${num} 時出錯:`, pageError);
        pdfPageRendering = false;
        if(pdfError) {
            pdfError.textContent = `獲取頁面 ${num} 時出錯。`;
            pdfError.style.display = 'block';
        }
        if(pdfCanvas) pdfCanvas.style.display = 'none';
        if(pdfPagination) pdfPagination.style.display = 'none';
    });
}

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
        pdfViewerContainer.style.display = 'flex';
        pdfCanvas.style.display = 'none';
        pdfPagination.style.display = 'none';
        return;
    }

    pdfCanvas.style.display = 'block';
    pdfViewerContainer.style.display = 'flex';
    pdfViewerContainer.style.flexDirection = 'column';
    pdfPagination.style.display = 'flex';
    pdfError.style.display = 'none';

    pdfCanvas.height = Math.ceil(viewport.height);
    pdfCanvas.width = Math.ceil(viewport.width);
    pdfCanvas.style.width = `${pdfCanvas.width}px`;
    pdfCanvas.style.height = `${pdfCanvas.height}px`;

    const renderContext = {
        canvasContext: canvasContext,
        viewport: viewport
    };
    
    const renderTask = page.render(renderContext);
    renderTask.promise.then(function() {
        pdfPageRendering = false;
        if(pdfPrevBtn) pdfPrevBtn.disabled = (pageNumber <= 1);
        if(currentPdfDoc && pdfNextBtn) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
        if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
        }
    }).catch(function(renderError) {
        console.error(`渲染頁面 ${pageNumber} 時出錯:`, renderError);
        pdfPageRendering = false;
        if (pdfError) {
            pdfError.textContent = `渲染頁面 ${pageNumber} 時出錯。`;
            pdfError.style.display = 'block';
        }
        pdfCanvas.style.display = 'none';
        pdfPagination.style.display = 'none';
    });
}

function queueRenderPage(num) {
    if (pdfPageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// 事件處理函數
function handleArtistFilterClick(event) {
    const target = event.target;
    if (target?.tagName === 'BUTTON' && target.classList.contains('artist-filter-btn')) {
        if (!artistFilterContainer) return;
        artistFilterContainer.querySelectorAll('.artist-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        target.classList.add('active');
        currentArtist = target.dataset.artist;
        fetchSongs(currentArtist);
        closeArtistModal();
    }
}

function handleSongListItemClick(event) {
    const target = event.target;
    if (target?.tagName === 'BUTTON' && target.classList.contains('list-score-btn')) {
        const songId = target.dataset.songId;
        const scoreId = target.dataset.scoreId;
        
        if (songId && scoreId) {
            window.location.href = `/score-viewer.html?musicId=${songId}&scoreId=${scoreId}`;
        } else {
            alert('無法打開樂譜，按鈕數據不完整。');
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

function openArtistModal() {
    if (artistModal) {
        artistModal.style.display = 'block';
    }
}

function closeArtistModal() {
    if (artistModal) {
        artistModal.style.display = 'none';
    }
}

function switchView(viewType) {
    if (currentView === viewType) return;
    currentView = viewType;
    
    viewButtons.forEach(btn => {
        if (btn.dataset.view === viewType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    renderSongList(allSongsData);
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    const essentialElements = [
        artistFilterContainer, songList, pdfPrevBtn, pdfNextBtn, 
        pdfPagination, pdfCanvas, pdfViewerContainer, pdfLoading, 
        pdfError, pdfPageNum, pdfPageCount, songDetailContainer, 
        songInfo, youtubePlayerContainer
    ];
    
    if (essentialElements.some(el => !el)) {
        console.error("頁面初始化失敗：缺少必要的 DOM 元素。");
        document.body.innerHTML = '<p style="color:red; padding: 2rem; text-align: center;">頁面載入錯誤，缺少必要的元件。</p>';
        return;
    }

    fetchArtists();
    fetchSongs('All');

    // 事件監聽器
    artistFilterContainer?.addEventListener('click', handleArtistFilterClick);
    songList?.addEventListener('click', handleSongListItemClick);
    pdfPrevBtn?.addEventListener('click', onPrevPage);
    pdfNextBtn?.addEventListener('click', onNextPage);
    
    artistFilterBtn?.addEventListener('click', openArtistModal);
    modalCloseBtn?.addEventListener('click', closeArtistModal);
    
    if (artistModal) {
        artistModal.addEventListener('click', (e) => {
            if (e.target === artistModal) {
                closeArtistModal();
            }
        });
    }
    
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
        });
    });

    if(songDetailContainer) {
        songDetailContainer.style.display = 'none';
    }
});