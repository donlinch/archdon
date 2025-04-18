// scores.js - 樂譜頁面 JavaScript 代碼

// 引入 pdf.js 函式庫 (ES Module 方式)
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

// --- 全局變數 ---
let allSongsData = [];
let currentPdfDoc = null;
let currentPageNum = 1;
let currentSongId = null;
let currentArtist = 'All'; // 預設顯示全部
let pdfPageRendering = false;
let pageNumPending = null;
let currentViewMode = 'list'; // 修改預設為列表視圖
let albumCovers = {}; // 儲存歌曲封面圖片的對應關係

// 設定 PDF.js worker 的來源路徑
if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';
        console.log('PDF.js workerSrc 設定完成。');
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

// 獲取頁面元素
const filterToggleBtn = getElement('filter-toggle');
const artistFilterPanel = getElement('artist-filter-panel');
const songsContainer = getElement('songs-container');
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
const backToTopButton = getElement('back-to-top');
const viewModeLinks = document.querySelectorAll('.view-mode-link');

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

// 預先獲取專輯封面
async function fetchAlbumCovers() {
    try {
        const albumsData = await fetchApi('/api/music', 'Error fetching album covers');
        // 建立歌手/歌曲與封面的映射
        albumsData.forEach(album => {
            if (album.artist && album.cover_art_url) {
                if (!albumCovers[album.artist]) {
                    albumCovers[album.artist] = [];
                }
                albumCovers[album.artist].push({
                    title: album.title,
                    cover_url: album.cover_art_url
                });
            }
        });
        console.log('專輯封面資料已載入:', Object.keys(albumCovers).length, '位歌手');
    } catch (error) {
        console.error('無法獲取專輯封面:', error);
        // 失敗時不中斷程序
    }
}

// 根據歌手和標題查找封面
function findAlbumCover(artist, title) {
    if (!albumCovers[artist]) return null;
    
    // 嘗試找到完全匹配的標題
    const exactMatch = albumCovers[artist].find(album => 
        album.title.toLowerCase() === title.toLowerCase()
    );
    if (exactMatch) return exactMatch.cover_url;
    
    // 如果沒有完全匹配，嘗試找包含相同關鍵字的標題
    const partialMatch = albumCovers[artist].find(album => 
        title.toLowerCase().includes(album.title.toLowerCase()) || 
        album.title.toLowerCase().includes(title.toLowerCase())
    );
    if (partialMatch) return partialMatch.cover_url;
    
    // 如果都沒有，返回該歌手的第一張封面
    return albumCovers[artist][0].cover_url;
}

async function fetchArtists() {
    if (!artistFilterPanel) return;
    
    artistFilterPanel.innerHTML = '<p>載入歌手中...</p>';
    
    try {
        const artists = await fetchApi('/api/scores/artists', 'Error fetching artists');
        renderArtistFilters(artists);
    } catch (error) {
        artistFilterPanel.innerHTML = '<p style="color: red;">無法載入歌手列表。</p>';
    }
}

async function fetchSongs(artist = 'All') {
    if (!songsContainer) return;
    
    songsContainer.innerHTML = '<p class="loading-message">載入歌曲中...</p>';
    currentSongId = null;
    
    if (songDetailContainer) songDetailContainer.style.display = 'none';
    
    try {
        const decodedArtist = decodeURIComponent(artist);
        const url = decodedArtist === 'All' ? '/api/scores/songs' : `/api/scores/songs?artist=${artist}`;
        allSongsData = await fetchApi(url, `Error fetching songs for artist ${decodedArtist}`);
        
        // 依據當前視圖模式渲染歌曲列表
        if (currentViewMode === 'grid') {
            renderSongsGrid(allSongsData);
        } else {
            renderSongsList(allSongsData);
        }
        
        // 更新歌手過濾器按鈕
        updateArtistFilterActiveState(decodedArtist);
        
    } catch (error) {
        songsContainer.innerHTML = '<p class="error-message">無法載入歌曲列表。<button onclick="location.reload()" class="retry-button">重試</button></p>';
        allSongsData = []; // 出錯時清空
    }
}

// --- 渲染函數 ---
function renderArtistFilters(artists) {
    if (!artistFilterPanel) return;
    
    const decodedCurrentArtist = decodeURIComponent(currentArtist);
    let buttonsHTML = `<button class="artist-filter-btn ${decodedCurrentArtist === 'All' ? 'active' : ''}" data-artist="All">全部歌手</button>`;
    
    artists.forEach(artist => {
        const encodedArtist = encodeURIComponent(artist);
        buttonsHTML += `<button class="artist-filter-btn ${decodedCurrentArtist === artist ? 'active' : ''}" data-artist="${encodedArtist}">${artist}</button>`;
    });
    
    artistFilterPanel.innerHTML = buttonsHTML;
}

function updateArtistFilterActiveState(artist) {
    if (!artistFilterPanel) return;
    
    const buttons = artistFilterPanel.querySelectorAll('.artist-filter-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.artist === artist || (artist === 'All' && btn.dataset.artist === 'All')) {
            btn.classList.add('active');
        }
    });
}

function renderSongsGrid(songs) {
    if (!songsContainer) return;
    
    if (!songs || !Array.isArray(songs) || songs.length === 0) {
        songsContainer.innerHTML = '<p class="no-songs-message">此分類下沒有包含樂譜的歌曲。</p>';
        return;
    }
    
    // 確保容器是格狀視圖
    songsContainer.className = 'songs-grid';
    
    let htmlContent = '';
    
    songs.forEach((song, index) => {
        // 嘗試查找該歌曲的封面圖片
        let coverImage = '';
        let hasCover = false;
        
        if (song.artist) {
            const coverUrl = findAlbumCover(song.artist, song.title);
            if (coverUrl) {
                coverImage = `<img src="${coverUrl}" alt="${song.title || '歌曲封面'}" />`;
                hasCover = true;
            }
        }
        
        // 如果沒有找到封面，則使用音符圖示
        if (!hasCover) {
            coverImage = '🎵';
        }
        
        // 建立樂譜按鈕
        let scoreButtonsHTML = '';
        if (song.scores && Array.isArray(song.scores) && song.scores.length > 0) {
            scoreButtonsHTML = song.scores
                .filter(score => score.type && score.pdf_url && score.id)
                .map(score => `
                    <button class="score-type-btn" 
                            data-song-id="${song.id}"
                            data-score-id="${score.id}"
                            title="查看 ${song.title} - ${score.type}">
                        ${score.type}
                    </button>
                `).join('');
        }
        
        htmlContent += `
            <div class="song-card" data-song-id="${song.id}" data-index="${index}">
                <div class="song-image">${coverImage}</div>
                <div class="song-info">
                    <h3 class="song-title">${song.title || '未知標題'}</h3>
                    <p class="song-artist">${song.artist || '未知歌手'}</p>
                    <div class="score-buttons">
                        ${scoreButtonsHTML}
                    </div>
                </div>
            </div>
        `;
    });
    
    songsContainer.innerHTML = htmlContent;
    
    // 添加動畫效果
    setTimeout(() => {
        const cards = document.querySelectorAll('.song-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('animate');
            }, 50 * index);
        });
    }, 100);
}




function renderSongsList(songs) {
    if (!songsContainer) return;
    
    if (!songs || !Array.isArray(songs) || songs.length === 0) {
        songsContainer.innerHTML = '<p class="no-songs-message">此分類下沒有包含樂譜的歌曲。</p>';
        return;
    }
    
    // 確保容器是列表視圖
    songsContainer.className = 'songs-list';
    
    let htmlContent = '';
    
    songs.forEach((song, index) => {
        // 建立樂譜按鈕
        let scoreButtonsHTML = '';
        if (song.scores && Array.isArray(song.scores) && song.scores.length > 0) {
            scoreButtonsHTML = song.scores
                .filter(score => score.type && score.pdf_url && score.id)
                .map(score => `
                    <button class="score-type-btn" 
                            data-song-id="${song.id}"
                            data-score-id="${score.id}"
                            title="查看 ${song.title} - ${score.type}">
                        ${score.type}
                    </button>
                `).join('');
        }
        
        // 查找歌曲封面圖片
        let coverImage = '';
        if (song.artist) {
            const coverUrl = findAlbumCover(song.artist, song.title);
            if (coverUrl) {
                coverImage = `<img src="${coverUrl}" alt="${song.title || '歌曲封面'}" />`;
            }
        }
        
        htmlContent += `
            <div class="song-list-item" data-song-id="${song.id}" data-index="${index}">
                <div class="song-list-icon">
                    ${coverImage || '🎵'}
                </div>
                <div class="song-list-info">
                    <div class="song-list-header">
                        <h3 class="song-list-title">${song.title || '未知標題'}</h3>
                        <span class="song-list-artist">${song.artist || '未知歌手'}</span>
                    </div>
                    <div class="song-list-scores">
                        ${scoreButtonsHTML}
                    </div>
                </div>
            </div>
        `;
    });
    
    songsContainer.innerHTML = htmlContent;
    
    // 添加動畫效果
    setTimeout(() => {
        const items = document.querySelectorAll('.song-list-item');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('animate');
            }, 50 * index);
        });
    }, 100);
}








function renderSongDetail(song) {
    if (!songInfo || !youtubePlayerContainer || !songDetailContainer) return;

    // Reset/hide PDF viewer elements when changing songs
    if (pdfViewerContainer) pdfViewerContainer.style.display = 'none';
    if (pdfCanvas) pdfCanvas.style.display = 'none';
    if (pdfPagination) pdfPagination.style.display = 'none';
    if (pdfLoading) pdfLoading.style.display = 'none';
    if (pdfError) pdfError.style.display = 'none';
    currentPdfDoc = null;

    if (scoreSelectorContainer) {
        // 生成樂譜類型選擇按鈕
        if (song.scores && Array.isArray(song.scores) && song.scores.length > 0) {
            let scoreButtonsHTML = '<h3>選擇樂譜類型:</h3><div class="score-buttons">';
            
            song.scores.forEach(score => {
                if (score.type && score.pdf_url && score.id) {
                    scoreButtonsHTML += `
                        <button class="score-type-btn" 
                                data-song-id="${song.id}"
                                data-score-id="${score.id}"
                                data-pdf-url="${encodeURIComponent(score.pdf_url)}"
                                title="查看 ${song.title} - ${score.type}">
                            ${score.type}
                        </button>
                    `;
                }
            });
            
            scoreButtonsHTML += '</div>';
            scoreSelectorContainer.innerHTML = scoreButtonsHTML;
        } else {
            scoreSelectorContainer.innerHTML = '<p>此歌曲沒有可用的樂譜。</p>';
        }
    }

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

    // 顯示歌曲詳情容器
    songDetailContainer.style.display = 'flex';
    songDetailContainer.style.flexDirection = 'column';
    
    // 平滑滾動到詳情區域
    songDetailContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    pdfCanvas.style.display = 'none'; // 初始隱藏畫布
    pdfPagination.style.display = 'none'; // 初始隱藏分頁控制
    
    // 顯示 PDF 檢視器容器
    pdfViewerContainer.style.display = 'flex';
    pdfViewerContainer.style.flexDirection = 'column';

    // 重置分頁控制
    pdfPrevBtn.disabled = true;
    pdfNextBtn.disabled = true;
    pdfPageNum.textContent = '-';
    pdfPageCount.textContent = '-';
    currentPdfDoc = null;
    currentPageNum = 1;

    // 構建代理 URL
    const proxyUrl = `/api/scores/proxy?url=${encodedPdfUrl}`;
    console.log("loadPdf: 透過代理請求 PDF:", proxyUrl);

    try {
        // 使用 PDF.js 加載 PDF 文件
        const loadingTask = pdfjsLib.getDocument({
            url: proxyUrl,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
        });
        
        // 等待 PDF 加載完成
        currentPdfDoc = await loadingTask.promise;
        console.log('loadPdf: PDF 載入成功. 頁數:', currentPdfDoc.numPages);
        
        // 隱藏加載提示，更新頁數信息
        pdfLoading.style.display = 'none';
        pdfPageCount.textContent = currentPdfDoc.numPages;
        
        // 渲染第一頁
        renderPage(currentPageNum);
        
        // 滾動到 PDF 檢視區域
        pdfViewerContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
    } catch (reason) {
        // 處理錯誤
        console.error('loadPdf: 載入 PDF 時出錯:', reason);
        pdfLoading.style.display = 'none';
        pdfError.textContent = `無法載入 PDF。請檢查連結是否有效或稍後再試。`;
        
        if (reason && reason.message) {
            pdfError.textContent += ` (錯誤: ${reason.message})`;
        } else if (typeof reason === 'string') {
            pdfError.textContent += ` (${reason})`;
        }
        
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

    // 獲取頁面
    currentPdfDoc.getPage(num).then(function(page) {
        console.log(`[renderPage] 獲取到頁面 ${num} 物件，準備渲染。`);

        // 使用 requestAnimationFrame 延遲寬度計算
        requestAnimationFrame(() => {
            // 確保容器可見
            if (window.getComputedStyle(pdfViewerContainer).display === 'none') {
                console.warn("[renderPage] pdfViewerContainer 在計算寬度前是 display:none，強制設為 flex。");
                pdfViewerContainer.style.display = 'flex';
                pdfViewerContainer.style.flexDirection = 'column';
            }

            // 根據容器計算合適的寬度
            let desiredWidth = pdfViewerContainer.clientWidth * 0.95; // 容器寬度的95%
            if (desiredWidth <= 0) {
                console.warn(`[renderPage] PDF 檢視器容器寬度 (${pdfViewerContainer.clientWidth}) 無效，使用後備寬度 600px。`);
                desiredWidth = 600; // 後備寬度
            }
            console.log(`[renderPage] 計算得到的 desiredWidth: ${desiredWidth}`);

            // 計算比例
            const viewportOriginal = page.getViewport({ scale: 1 });
            const scale = (viewportOriginal.width > 0 && desiredWidth > 0) 
                ? desiredWidth / viewportOriginal.width 
                : 1;
            const viewport = page.getViewport({ scale: scale });
            
            console.log(`[renderPage] 計算得到的 scale: ${scale}, viewport width: ${viewport.width}, height: ${viewport.height}`);

            // 使用計算出的視口渲染頁面
            renderPageWithViewport(page, viewport, num);
        });
    }).catch(function(pageError) {
        console.error(`[renderPage] 獲取頁面 ${num} 時出錯:`, pageError);
        pdfPageRendering = false;
        
        if(pdfError) {
            pdfError.textContent = `獲取頁面 ${num} 時出錯。`;
            pdfError.style.display = 'block';
        }
        
        // 保持容器可見以顯示錯誤
        if(pdfCanvas) pdfCanvas.style.display = 'none';
        if(pdfPagination) pdfPagination.style.display = 'none';
        if(pdfPrevBtn) pdfPrevBtn.disabled = (num <= 1);
        if(pdfNextBtn && currentPdfDoc) pdfNextBtn.disabled = (num >= currentPdfDoc.numPages);
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
        
        pdfViewerContainer.style.display = 'flex'; // 保持容器可見
        pdfCanvas.style.display = 'none';
        pdfPagination.style.display = 'none';
        
        if(pdfPrevBtn) pdfPrevBtn.disabled = (pageNumber <= 1);
        if(currentPdfDoc && pdfNextBtn) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
        return;
    }

    // 在繪製前確保元素可見
    pdfCanvas.style.display = 'block';
    pdfViewerContainer.style.display = 'flex'; 
    pdfViewerContainer.style.flexDirection = 'column';
    pdfPagination.style.display = 'flex';
    pdfError.style.display = 'none'; // 隱藏之前的錯誤

    // 設置畫布尺寸，使用 Math.ceil 避免小數像素
    pdfCanvas.height = Math.ceil(viewport.height);
    pdfCanvas.width = Math.ceil(viewport.width);
    console.log(`[renderPageWithViewport] 設置畫布尺寸: 寬=${pdfCanvas.width}, 高=${pdfCanvas.height}`);

    // 同時設置畫布的樣式尺寸
    pdfCanvas.style.width = `${pdfCanvas.width}px`;
    pdfCanvas.style.height = `${pdfCanvas.height}px`;

    // 渲染PDF頁面
    const renderContext = {
        canvasContext: canvasContext,
        viewport: viewport
    };
    
    const renderTask = page.render(renderContext);

    renderTask.promise.then(function() {
        console.log(`[renderPageWithViewport] 頁面 ${pageNumber} 渲染完成`);
        pdfPageRendering = false;
        
        // 更新分頁按鈕狀態
        if(pdfPrevBtn) pdfPrevBtn.disabled = (pageNumber <= 1);
        if(currentPdfDoc && pdfNextBtn) pdfNextBtn.disabled = (pageNumber >= currentPdfDoc.numPages);
        
        // 處理待處理的頁面
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

// --- 功能函數 ---
function toggleArtistFilterPanel() {
    if (!artistFilterPanel) return;
    
    artistFilterPanel.classList.toggle('active');
}

function updateViewMode(mode) {
    if (!songsContainer) return;
    
    currentViewMode = mode;
    
    // 更新視圖模式按鈕
    document.querySelectorAll('.view-mode-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.view === mode) {
            link.classList.add('active');
        }
    });
    
    // 重新渲染歌曲列表
    if (allSongsData.length > 0) {
        if (mode === 'grid') {
            renderSongsGrid(allSongsData);
        } else {
            renderSongsList(allSongsData);
        }
    }
}

function setupBackToTop() {
    if (!backToTopButton) return;
    
    // 監聽滾動事件
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    });
    
    // 點擊回到頂部
    backToTopButton.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// --- 事件處理函數 ---
function handleViewModeClick(event) {
    event.preventDefault();
    
    const target = event.target;
    if (target && target.classList.contains('view-mode-link')) {
        const viewMode = target.dataset.view;
        if (viewMode && viewMode !== currentViewMode) {
            updateViewMode(viewMode);
        }
    }
}

function handleArtistFilterClick(event) {
    const target = event.target;
    if (target && target.classList.contains('artist-filter-btn')) {
        // 更新按鈕激活狀態
        artistFilterPanel.querySelectorAll('.artist-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        target.classList.add('active');
        
        // 更新當前歌手並獲取歌曲
        currentArtist = target.dataset.artist;
        fetchSongs(currentArtist);
        
        // 折疊歌手過濾面板
        artistFilterPanel.classList.remove('active');
    }
}

function handleSongCardClick(event) {
    let target = event.target;
    
    // 如果點擊的是樂譜按鈕，則執行特定處理
    if (target.classList.contains('score-type-btn')) {
        const songId = target.dataset.songId;
        const scoreId = target.dataset.scoreId;
        
        if (songId && scoreId) {
            console.log(`跳轉至: /score-viewer.html?musicId=${songId}&scoreId=${scoreId}`);
            window.location.href = `/score-viewer.html?musicId=${songId}&scoreId=${scoreId}`;
            return;
        }
    }
    
    // 如果點擊的不是樂譜按鈕，尋找最近的歌曲卡片或列表項
    while (target && !target.classList.contains('song-card') && !target.classList.contains('song-list-item')) {
        target = target.parentNode;
        if (!target || target === document) return;
    }
    
    if (target) {
        const songId = target.dataset.songId;
        if (songId) {
            displaySongDetail(songId);
        }
    }
}

function handleScoreButtonClick(event) {
    if (!event.target.classList.contains('score-type-btn')) return;
    
    const target = event.target;
    const pdfUrl = target.dataset.pdfUrl;
    if (pdfUrl) {
        loadPdf(pdfUrl);
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

// --- 顯示歌曲詳情 ---
function displaySongDetail(songId) {
    if (!allSongsData || !Array.isArray(allSongsData)) return;
    
    const song = allSongsData.find(s => s.id.toString() === songId.toString());
    if (!song) {
        console.error(`找不到 ID 為 ${songId} 的歌曲`);
        return;
    }
    
    currentSongId = song.id;
    renderSongDetail(song);
}

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    // 檢查必要元素
    const essentialElements = [
        songsContainer, 
        pdfPrevBtn, 
        pdfNextBtn, 
        pdfPagination, 
        pdfCanvas, 
        pdfViewerContainer, 
        pdfLoading, 
        pdfError, 
        pdfPageNum, 
        pdfPageCount, 
        songDetailContainer, 
        songInfo, 
        youtubePlayerContainer
    ];
    
    if (essentialElements.some(el => !el)) {
        console.error("頁面初始化失敗：缺少必要的 DOM 元素。請檢查 HTML 結構和 ID 是否正確。");
        if(document.body) {
            document.body.innerHTML = '<p style="color:red; padding: 2rem; text-align: center;">頁面載入錯誤，缺少必要的元件。</p>';
        }
        return;
    }
    
    // 初始化功能
    setupBackToTop();
    fetchArtists();
    fetchAlbumCovers(); // 獲取專輯封面資訊
    fetchSongs('All'); // 預設載入所有歌曲
    
    // 綁定事件監聽器
    
    // 視圖模式切換
    document.querySelectorAll('.view-mode-link').forEach(link => {
        link.addEventListener('click', handleViewModeClick);
    });
    
    // 歌手過濾面板
    if (filterToggleBtn) {
        filterToggleBtn.addEventListener('click', toggleArtistFilterPanel);
    }
    
    if (artistFilterPanel) {
        artistFilterPanel.addEventListener('click', handleArtistFilterClick);
    }
    
    // 歌曲列表點擊
    if (songsContainer) {
        songsContainer.addEventListener('click', handleSongCardClick);
    }
    
    // 樂譜選擇
    if (scoreSelectorContainer) {
        scoreSelectorContainer.addEventListener('click', handleScoreButtonClick);
    }
    
    // PDF 翻頁控制
    if (pdfPrevBtn) {
        pdfPrevBtn.addEventListener('click', onPrevPage);
    }
    
    if (pdfNextBtn) {
        pdfNextBtn.addEventListener('click', onNextPage);
    }
    
    // 初始隱藏詳情容器
    if (songDetailContainer) {
        songDetailContainer.style.display = 'none';
    }
    
    // 監聽窗口大小變化
    window.addEventListener('resize', function() {
        // 如果當前正在查看PDF，重新渲染以適應新大小
        if (currentPdfDoc && currentPageNum) {
            queueRenderPage(currentPageNum);
        }
    });
});