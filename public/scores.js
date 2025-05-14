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

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
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
    
    setupBackToTop();
    
    fetchAlbumCovers().then(() => {
        fetchArtists();
        fetchSongs('All'); 
    }).catch(error => {
        console.error("獲取專輯封面時出錯:", error);
        fetchArtists();
        fetchSongs('All');
    });
    
    document.querySelectorAll('.view-mode-link').forEach(link => {
        link.addEventListener('click', handleViewModeClick);
    });
    
    if (filterToggleBtn) {
        filterToggleBtn.addEventListener('click', toggleArtistFilterPanel);
    }
    
    if (artistFilterPanel) {
        artistFilterPanel.addEventListener('click', handleArtistFilterClick);
    }
    
    if (songsContainer) {
        songsContainer.addEventListener('click', handleSongCardClick);
    }
    
    if (scoreSelectorContainer) {
        scoreSelectorContainer.addEventListener('click', handleScoreButtonClick);
    }
    
    if (pdfPrevBtn) {
        pdfPrevBtn.addEventListener('click', onPrevPage);
    }
    
    if (pdfNextBtn) {
        pdfNextBtn.addEventListener('click', onNextPage);
    }
    
    if (songDetailContainer) {
        songDetailContainer.style.display = 'none';
    }
    
    window.addEventListener('resize', function() {
        if (currentPdfDoc && currentPageNum) {
            queueRenderPage(currentPageNum);
        }
    });
});

async function fetchAlbumCovers() {
    try {
        console.log('開始載入專輯封面資料...');
        const albumsData = await fetchApi('/api/music', 'Error fetching album covers');
        
        albumsData.forEach(album => {
            const primaryArtist = album.artists && album.artists.length > 0 ? album.artists[0].name : null;
            if (primaryArtist && album.cover_art_url) {
                if (!albumCovers[primaryArtist]) {
                    albumCovers[primaryArtist] = [];
                }
                albumCovers[primaryArtist].push({
                    title: album.title,
                    cover_url: album.cover_art_url
                });
            } else if (album.cover_art_url) {
                 const fallbackKey = "unknown_artist_covers";
                 if (!albumCovers[fallbackKey]) albumCovers[fallbackKey] = [];
                 albumCovers[fallbackKey].push({ title: album.title, cover_url: album.cover_art_url });
            }
        });
        
        console.log('專輯封面資料已載入:', Object.keys(albumCovers).length, '個關聯鍵');
        return albumCovers;
    } catch (error) {
        console.error('無法獲取專輯封面:', error);
        return {};
    }
}

function findAlbumCover(artist, title) {
    if (!albumCovers[artist]) { // Try fallback if specific artist not found
        if (albumCovers["unknown_artist_covers"]) {
            const fallbackMatch = albumCovers["unknown_artist_covers"].find(album => album.title.toLowerCase() === title.toLowerCase());
            if (fallbackMatch) return fallbackMatch.cover_url;
        }
        return null;
    }
    
    const exactMatch = albumCovers[artist].find(album => 
        album.title.toLowerCase() === title.toLowerCase()
    );
    if (exactMatch) return exactMatch.cover_url;
    
    const partialMatch = albumCovers[artist].find(album => 
        title.toLowerCase().includes(album.title.toLowerCase()) || 
        album.title.toLowerCase().includes(title.toLowerCase())
    );
    if (partialMatch) return partialMatch.cover_url;
    
    return albumCovers[artist][0]?.cover_url || null; // Return first cover or null
}

async function fetchArtists() {
    if (!artistFilterPanel) return;
    
    artistFilterPanel.innerHTML = '<p>載入歌手中...</p>';
    
    try {
        // Assuming /api/artists now returns [{id, name}, ...] from the new 'artists' table
        const artistsData = await fetchApi('/api/artists', 'Error fetching artists');
        // We need only names for the filter buttons
        const artistNames = artistsData.map(artist => artist.name);
        renderArtistFilters(artistNames);
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
        // The /api/music endpoint now handles artist filtering and returns songs with their scores and artists array
        const url = decodedArtist === 'All' ? '/api/music' : `/api/music?artist=${artist}`;
        allSongsData = await fetchApi(url, `Error fetching songs for artist ${decodedArtist}`);
        
        // Filter songs that actually have scores
        const songsWithScores = allSongsData.filter(song => song.scores && song.scores.length > 0);

        if (currentViewMode === 'grid') {
            renderSongsGrid(songsWithScores);
        } else {
            renderSongsList(songsWithScores);
        }
        
        updateArtistFilterActiveState(decodedArtist);
        
    } catch (error) {
        songsContainer.innerHTML = '<p class="error-message">無法載入歌曲列表。<button onclick="location.reload()" class="retry-button">重試</button></p>';
        allSongsData = [];
    }
}

function renderArtistFilters(artists) {
    if (!artistFilterPanel) return;
    
    const decodedCurrentArtist = decodeURIComponent(currentArtist);
    let buttonsHTML = `<button class="artist-filter-btn ${decodedCurrentArtist === 'All' ? 'active' : ''}" data-artist="All">全部歌手</button>`;
    
    artists.forEach(artistName => { // artists is now an array of names
        const encodedArtist = encodeURIComponent(artistName);
        buttonsHTML += `<button class="artist-filter-btn ${decodedCurrentArtist === artistName ? 'active' : ''}" data-artist="${encodedArtist}">${artistName}</button>`;
    });
    
    artistFilterPanel.innerHTML = buttonsHTML;
}

function updateArtistFilterActiveState(artist) {
    if (!artistFilterPanel) return;
    
    const buttons = artistFilterPanel.querySelectorAll('.artist-filter-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        // Ensure comparison is with decoded artist name from dataset
        if (decodeURIComponent(btn.dataset.artist) === artist || (artist === 'All' && btn.dataset.artist === 'All')) {
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
    
    songsContainer.className = 'songs-grid';
    let htmlContent = '';
    
    songs.forEach((song, index) => {
        let coverImage = '';
        let hasCover = false;
        
        const primaryArtistForCover = song.artists && song.artists.length > 0 ? song.artists[0].name : null;
        if (primaryArtistForCover) {
            const coverUrl = findAlbumCover(primaryArtistForCover, song.title);
            if (coverUrl) {
                coverImage = `<img src="${coverUrl}" alt="${song.title || '歌曲封面'}" />`;
                hasCover = true;
            }
        }
        
        if (!hasCover) {
            coverImage = '🎵';
        }
        
        let scoreButtonsHTML = '';
        if (song.scores && Array.isArray(song.scores) && song.scores.length > 0) {
            scoreButtonsHTML = song.scores
                .filter(score => score.type && score.pdf_url && score.id)
                .map(score => `
                    <button class="score-type-btn"
                            data-song-id="${song.id}"
                            data-score-id="${score.id}"
                            data-pdf-url="${encodeURIComponent(score.pdf_url)}"
                            data-song-title="${encodeURIComponent(song.title || '未知歌曲')}"
                            data-score-type="${encodeURIComponent(score.type)}"
                            title="查看 ${song.title} - ${score.type}">
                        ${score.type}
                    </button>
                `).join('');
        }

        const artistsDisplay = song.artists && song.artists.length > 0
            ? song.artists.map(a => a.name).join(', ')
            : '未知歌手';
        
        htmlContent += `
            <div class="song-card" data-song-id="${song.id}" data-index="${index}">
                <div class="song-image">${coverImage}</div>
                <div class="song-info">
                    <h3 class="song-title">${song.title || '未知標題'}</h3>
                    <p class="song-artist">${artistsDisplay}</p>
                    <div class="score-buttons">
                        ${scoreButtonsHTML}
                    </div>
                </div>
            </div>
        `;
    });
    
    songsContainer.innerHTML = htmlContent;
    
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
    
    songsContainer.className = 'songs-list';
    let htmlContent = '';
    
    songs.forEach((song, index) => {
        let scoreButtonsHTML = '';
        if (song.scores && Array.isArray(song.scores) && song.scores.length > 0) {
            scoreButtonsHTML = song.scores
                .filter(score => score.type && score.pdf_url && score.id)
                .map(score => `
                    <button class="score-type-btn"
                            data-song-id="${song.id}"
                            data-score-id="${score.id}"
                            data-pdf-url="${encodeURIComponent(score.pdf_url)}"
                            data-song-title="${encodeURIComponent(song.title || '未知歌曲')}"
                            data-score-type="${encodeURIComponent(score.type)}"
                            title="查看 ${song.title} - ${score.type}">
                        ${score.type}
                    </button>
                `).join('');
        }
        
        let coverImage = '';
        const primaryArtistForCoverList = song.artists && song.artists.length > 0 ? song.artists[0].name : null;
        if (primaryArtistForCoverList) {
            const coverUrl = findAlbumCover(primaryArtistForCoverList, song.title);
            if (coverUrl) {
                coverImage = `<img src="${coverUrl}" alt="${song.title || '歌曲封面'}" />`;
            }
        }
        
        const artistsDisplayList = song.artists && song.artists.length > 0
            ? song.artists.map(a => a.name).join(', ')
            : '未知歌手';

        htmlContent += `
            <div class="song-list-item" data-song-id="${song.id}" data-index="${index}">
                <div class="song-list-icon">
                    ${coverImage || '🎵'}
                </div>
                <div class="song-list-info">
                    <div class="song-list-header">
                        <h3 class="song-list-title">${song.title || '未知標題'}</h3>
                        <span class="song-list-artist">${artistsDisplayList}</span>
                    </div>
                    <div class="song-list-scores">
                        ${scoreButtonsHTML}
                    </div>
                </div>
            </div>
        `;
    });
    
    songsContainer.innerHTML = htmlContent;
    
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

    if (pdfViewerContainer) pdfViewerContainer.style.display = 'none';
    if (pdfCanvas) pdfCanvas.style.display = 'none';
    if (pdfPagination) pdfPagination.style.display = 'none';
    if (pdfLoading) pdfLoading.style.display = 'none';
    if (pdfError) pdfError.style.display = 'none';
    currentPdfDoc = null;

    if (scoreSelectorContainer) {
        if (song.scores && Array.isArray(song.scores) && song.scores.length > 0) {
            let scoreButtonsHTML = '<h3>選擇樂譜類型:</h3><div class="score-buttons">';
            
            song.scores.forEach(score => {
                if (score.type && score.pdf_url && score.id) {
                    scoreButtonsHTML += `
                        <button class="score-type-btn"
                                data-song-id="${song.id}"
                                data-score-id="${score.id}"
                                data-pdf-url="${encodeURIComponent(score.pdf_url)}"
                                data-song-title="${encodeURIComponent(song.title || '未知歌曲')}"
                                data-score-type="${encodeURIComponent(score.type)}"
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

    const artistsDetailDisplay = song.artists && song.artists.length > 0
        ? song.artists.map(a => a.name).join(', ')
        : '未知歌手';
    songInfo.textContent = `${song.title || '未知標題'} - ${artistsDetailDisplay}`;
    
    youtubePlayerContainer.innerHTML = '';
    if (song.youtube_video_id) {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${song.youtube_video_id}`;
        iframe.title = "YouTube video player";
        iframe.frameBorder = "0";
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        youtubePlayerContainer.appendChild(iframe);
        youtubePlayerContainer.style.display = 'block';
    } else {
        youtubePlayerContainer.style.display = 'none';
    }

    songDetailContainer.style.display = 'flex';
    songDetailContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadPdf(encodedPdfUrl) {
    if (!pdfViewerContainer || !pdfCanvas || !pdfLoading || !pdfError || !pdfPagination) return;

    const pdfUrl = decodeURIComponent(encodedPdfUrl);
    pdfLoading.style.display = 'block';
    pdfError.style.display = 'none';
    pdfCanvas.style.display = 'none';
    pdfPagination.style.display = 'none';
    currentPageNum = 1;

    try {
        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
        currentPdfDoc = await loadingTask.promise;
        pdfLoading.style.display = 'none';
        pdfCanvas.style.display = 'block';
        pdfPagination.style.display = 'block';
        if (pdfPageCount) pdfPageCount.textContent = currentPdfDoc.numPages;
        renderPage(currentPageNum);
    } catch (reason) {
        console.error('Error loading PDF:', reason);
        pdfLoading.style.display = 'none';
        pdfError.textContent = `無法載入樂譜：${reason.message || '未知錯誤'}`;
        pdfError.style.display = 'block';
        currentPdfDoc = null;
    }
}

function renderPage(num) {
    if (!currentPdfDoc) return;
    pdfPageRendering = true;

    currentPdfDoc.getPage(num).then(page => {
        let viewport = page.getViewport({ scale: 1 });
        const containerWidth = pdfViewerContainer.clientWidth * 0.95; 
        const scale = containerWidth / viewport.width;
        viewport = page.getViewport({ scale: scale });
        
        renderPageWithViewport(page, viewport, num);

    }).catch(err => {
        console.error("Error rendering page:", err);
        pdfPageRendering = false;
        if (pdfError) {
            pdfError.textContent = `無法渲染頁面 ${num}：${err.message || '未知錯誤'}`;
            pdfError.style.display = 'block';
        }
    });
}

function renderPageWithViewport(page, viewport, pageNumber) {
    if (!pdfCanvas || !pdfPageNum) {
        pdfPageRendering = false;
        return;
    }
    const canvas = pdfCanvas;
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    const renderTask = page.render(renderContext);

    renderTask.promise.then(() => {
        pdfPageRendering = false;
        if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
        }
        pdfPageNum.textContent = pageNumber;
        
        // 確保 canvas 在渲染後可見
        canvas.style.display = 'block'; 
        if (pdfPagination) pdfPagination.style.display = 'flex';


    }).catch(err => {
        console.error("Error during page render task:", err);
        pdfPageRendering = false;
        if (pdfError) {
            pdfError.textContent = `渲染頁面 ${pageNumber} 時發生錯誤：${err.message || '未知錯誤'}`;
            pdfError.style.display = 'block';
        }
    });
}


function queueRenderPage(num) {
    if (pdfPageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

function toggleArtistFilterPanel() {
    if (artistFilterPanel) {
        artistFilterPanel.classList.toggle('active');
        if (filterToggleBtn) {
            filterToggleBtn.textContent = artistFilterPanel.classList.contains('active') ? '隱藏歌手篩選' : '顯示歌手篩選';
        }
    }
}

function updateViewMode(mode) {
    currentViewMode = mode;
    if (songsContainer) { // 確保 songsContainer 存在
        if (mode === 'grid') {
            songsContainer.className = 'songs-grid';
            renderSongsGrid(allSongsData.filter(song => song.scores && song.scores.length > 0));
        } else {
            songsContainer.className = 'songs-list';
            renderSongsList(allSongsData.filter(song => song.scores && song.scores.length > 0));
        }
    }
    // 更新按鈕的 active 狀態
    viewModeLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.mode === mode);
    });
}

function setupBackToTop() {
    if (!backToTopButton) return;
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    });
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
    const newMode = event.currentTarget.dataset.mode;
    if (newMode && newMode !== currentViewMode) {
        updateViewMode(newMode);
    }
}

function handleArtistFilterClick(event) {
    if (event.target.classList.contains('artist-filter-btn')) {
        const selectedArtist = event.target.dataset.artist;
        currentArtist = selectedArtist; // 更新全局變數
        fetchSongs(selectedArtist);
        if (artistFilterPanel.classList.contains('active') && window.innerWidth < 768) { // 如果是移動設備，選擇後關閉面板
            toggleArtistFilterPanel();
        }
    }
}

function handleSongCardClick(event) {
    const card = event.target.closest('.song-card, .song-list-item');
    const scoreButton = event.target.closest('.score-type-btn');

    if (scoreButton) { // 如果點擊的是樂譜按鈕
        event.preventDefault(); // 阻止可能的父元素<a>標籤跳轉
        event.stopPropagation(); // 阻止事件冒泡到卡片
        
        const pdfUrl = scoreButton.dataset.pdfUrl; // Already encoded
        const songTitle = scoreButton.dataset.songTitle; // Already encoded
        const scoreType = scoreButton.dataset.scoreType; // Already encoded

        if (pdfUrl) {
            const viewerUrl = `score-viewer.html?pdf=${pdfUrl}&title=${songTitle}&type=${scoreType}`;
            window.location.href = viewerUrl;
        } else {
            console.error('PDF URL not found on score button dataset for songId:', scoreButton.dataset.songId);
            alert('此樂譜暫無有效的 PDF 連結。');
        }
    } else if (card) { // 如果點擊的是卡片本身 (非樂譜按鈕)
        const songId = card.dataset.songId;
        displaySongDetail(songId); // This will show details, and then user can click a score type button
    }
}

function handleScoreButtonClick(event) {
    // This function is attached to scoreSelectorContainer.
    // It will also handle clicks on .score-type-btn within the song detail view.
    if (event.target.classList.contains('score-type-btn')) {
        const button = event.target;
        const pdfUrl = button.dataset.pdfUrl; // Already encoded
        const songTitle = button.dataset.songTitle; // Already encoded
        const scoreType = button.dataset.scoreType; // Already encoded

        if (pdfUrl) {
            const viewerUrl = `score-viewer.html?pdf=${pdfUrl}&title=${songTitle}&type=${scoreType}`;
            window.location.href = viewerUrl;
        } else {
            console.error('PDF URL not found on score button (detail view) for songId:', button.dataset.songId);
            alert('此樂譜暫無有效的 PDF 連結。');
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

// 顯示歌曲詳情
function displaySongDetail(songId) {
    const song = allSongsData.find(s => s.id.toString() === songId);
    if (song) {
        currentSongId = song.id;
        renderSongDetail(song);
        // 預設不自動加載第一個樂譜，讓用戶選擇
        if (pdfViewerContainer) pdfViewerContainer.style.display = 'block'; // 確保容器可見
        if (pdfCanvas) pdfCanvas.style.display = 'none'; // 初始隱藏 canvas
        if (pdfPagination) pdfPagination.style.display = 'none'; // 初始隱藏翻頁
    } else {
        console.error(`找不到 ID 為 ${songId} 的歌曲`);
    }
}
// 確保 DOMContentLoaded 事件監聽器是最後執行的，或者將其內容移到文件末尾
// (已在文件開頭定義，無需重複)